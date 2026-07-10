import { DateTime } from 'luxon';
import mongoose from 'mongoose';
import { Video } from '../models/Video.js';
import { VideoSnapshot } from '../models/VideoSnapshot.js';
import { ResearchRun } from '../models/ResearchRun.js';
import { AppError } from '../lib/errors.js';
import { makeCacheKey } from '../lib/cacheKey.js';
import { resolvePublicationWindow } from '../lib/dateWindow.js';
import { baseLanguage, evaluateLanguage, normalizeLanguageTag } from '../lib/language.js';
import { generateQueryVariants } from '../lib/queryVariants.js';
import { scoreVideoCohorts } from '../lib/scoring.js';
import { fetchVideos, searchVideoIds } from './youtubeService.js';
import { classifyVideoRelevance, expandNicheQueries } from './ollamaService.js';
import { ensureChannelBaselines, getChannelBaselineMap } from './channelBaselineService.js';

function normalizeNiche(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function parseDurationSeconds(value) {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value ?? '');
  if (!match) return undefined;
  return Number(match[1] ?? 0) * 86400 + Number(match[2] ?? 0) * 3600 + Number(match[3] ?? 0) * 60 + Number(match[4] ?? 0);
}

function safeCount(value) {
  if (value === undefined) return undefined;
  const count = Number(value);
  return Number.isSafeInteger(count) ? count : Number.MAX_SAFE_INTEGER;
}

function toVideoRecord(item, nicheKey, query, languageResult) {
  const durationSeconds = parseDurationSeconds(item.contentDetails?.duration);
  return {
    videoId: item.id,
    title: item.snippet?.title || 'Untitled video',
    description: item.snippet?.description,
    channelId: item.snippet?.channelId,
    channelTitle: item.snippet?.channelTitle,
    publishedAt: new Date(item.snippet?.publishedAt),
    thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
    durationSeconds,
    format: durationSeconds === undefined ? 'unknown' : durationSeconds <= 180 ? 'short' : 'long',
    statistics: {
      viewCount: safeCount(item.statistics?.viewCount) ?? 0,
      likeCount: safeCount(item.statistics?.likeCount),
      commentCount: safeCount(item.statistics?.commentCount)
    },
    language: {
      defaultAudioLanguageRaw: languageResult.raw,
      normalizedAudioLanguage: languageResult.normalized,
      metadataLanguageRaw: item.snippet?.defaultLanguage,
      source: languageResult.source
    },
    lastFetchedAt: new Date(),
    discoveredBy: { nicheKey, query, discoveredAt: new Date() }
  };
}

function serializeVideo(video, outlier, aiRelevance) {
  const publishedAt = new Date(video.publishedAt);
  const ageDays = Math.max((Date.now() - publishedAt.getTime()) / 86400000, 1);
  return {
    videoId: video.videoId,
    title: video.title,
    description: video.description,
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    publishedAt: publishedAt.toISOString(),
    thumbnailUrl: video.thumbnailUrl,
    durationSeconds: video.durationSeconds,
    format: video.format,
    viewCount: video.statistics?.viewCount ?? 0,
    likeCount: video.statistics?.likeCount,
    commentCount: video.statistics?.commentCount,
    viewsPerDay: Math.round((video.statistics?.viewCount ?? 0) / ageDays),
    language: video.language,
    outlier,
    aiRelevance,
    youtubeUrl: `https://www.youtube.com/watch?v=${video.videoId}`
  };
}

async function findVideosInOrder(ids) {
  if (!ids.length) return [];
  const videos = await Video.find({ videoId: { $in: ids } }).lean();
  const byId = new Map(videos.map((video) => [video.videoId, video]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

async function persistVideosAndSnapshots(records) {
  if (!records.length) return;
  await Video.bulkWrite(records.map(({ discoveredBy, ...record }) => ({
    updateOne: {
      filter: { videoId: record.videoId },
      update: { $set: record, $push: { discoveredBy } },
      upsert: true
    }
  })));

  const capturedAt = new Date();
  const capturedAtBucket = new Date(Math.floor(capturedAt.getTime() / 3600000) * 3600000);
  await VideoSnapshot.bulkWrite(records.map((record) => ({
    updateOne: {
      filter: { videoId: record.videoId, capturedAtBucket },
      update: {
        $set: {
          capturedAt,
          viewCount: record.statistics.viewCount,
          likeCount: record.statistics.likeCount,
          commentCount: record.statistics.commentCount
        }
      },
      upsert: true
    }
  })));
}

function canLoadMore(run, config) {
  return run.pageCount < config.research.maxPagesPerSearch && run.queryVariants.some((variant) => !variant.exhausted && variant.pageToken);
}

async function responseFor(run, config, { cached, quota } = {}) {
  const [videos, candidates] = await Promise.all([
    findVideosInOrder(run.videoIds),
    findVideosInOrder(run.candidateVideoIds)
  ]);
  const channelBaselines = await getChannelBaselineMap(candidates.map((video) => video.channelId));
  const scores = scoreVideoCohorts(candidates, {
    minimumSample: config.research.minTopPercentileSample,
    minimumChannelSample: config.research.minChannelBaselineVideos,
    channelBaselines
  });
  const relevanceById = new Map((run.aiRelevanceDecisions ?? []).map((decision) => [decision.videoId, {
    relevant: decision.relevant,
    confidence: decision.confidence,
    reason: decision.reason,
    source: 'ollama'
  }]));
  const cohortSizes = candidates.reduce((counts, video) => {
    counts[video.format] = (counts[video.format] ?? 0) + 1;
    return counts;
  }, {});
  const serializedVideos = videos
    .map((video) => serializeVideo(video, scores.get(video.videoId), relevanceById.get(video.videoId)))
    .sort((a, b) => (b.outlier?.percentile ?? 0) - (a.outlier?.percentile ?? 0) || b.viewCount - a.viewCount);

  return {
    query: {
      niche: run.nicheInput,
      publishedAfter: run.publishedAfter.toISOString(),
      publishedBefore: run.publishedBefore.toISOString(),
      startDate: run.startDate,
      endDate: run.endDate,
      periodPreset: run.periodPreset,
      timeZone: run.timeZone,
      minViews: run.minViews,
      region: run.regionCode,
      originalLanguage: run.originalLanguage,
      languagePolicy: run.languagePolicy,
      format: run.format,
      discoveryMode: run.discoveryMode,
      queryVariants: run.queryVariants.map((variant) => variant.query),
      ai: {
        requested: run.ai?.requested,
        expansionUsed: run.ai?.expansionUsed,
        relevanceUsed: run.ai?.relevanceUsed,
        fallback: run.ai?.fallback,
        model: run.ai?.model
      },
      mode: 'threshold-with-sampled-ranking'
    },
    items: serializedVideos,
    meta: {
      candidateCount: run.candidateCount,
      uniqueSampleSize: candidates.length,
      cohortSizes,
      minimumPercentileSample: config.research.minTopPercentileSample,
      channelBaselineCoverage: channelBaselines.size,
      qualifyingCount: run.videoIds.length,
      unknownLanguageExcludedCount: run.unknownLanguageExcludedCount,
      cached: Boolean(cached),
      partial: canLoadMore(run, config),
      nextCursor: canLoadMore(run, config) ? run._id.toString() : null,
      quota,
      disclaimer: 'Percentiles describe the discovered sample, not every video on YouTube. Search results may be incomplete.'
    }
  };
}

export function createResearchService(config) {
  async function research(input) {
    if (input.cursor) return loadMore(input.cursor);

    const nicheInput = input.niche.trim().replace(/\s+/g, ' ');
    const nicheKey = normalizeNiche(nicheInput);
    const timeZone = input.timeZone || config.server.timeZone;
    const window = resolvePublicationWindow({
      startDate: input.startDate,
      endDate: input.endDate,
      timeZone,
      maxPeriodMonths: config.research.maxPeriodMonths
    });
    const originalLanguage = normalizeLanguageTag(input.originalLanguage || config.research.defaultLanguage);
    const languagePolicy = originalLanguage === 'any' ? 'any' : input.languagePolicy || 'strict';
    if (languagePolicy === 'best-effort') {
      throw new AppError('Best-effort spoken-language estimation is not enabled because metadata alone is unreliable', 400, 'FEATURE_UNAVAILABLE');
    }
    const discoveryMode = input.discoveryMode || config.research.defaultDiscoveryMode;
    const query = {
      nicheKey,
      startDate: window.startDate,
      endDate: window.endDate,
      timeZone,
      periodPreset: window.periodPreset,
      minViews: input.minViews,
      regionCode: input.regionCode,
      originalLanguage,
      languagePolicy,
      format: input.format,
      discoveryMode,
      aiModel: discoveryMode === 'ai' ? config.ollama.model : undefined
    };
    const cacheKey = makeCacheKey(query);
    const cachedRun = await ResearchRun.findOne({
      cacheKey,
      status: { $in: ['complete', 'partial'] },
      cacheExpiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });
    if (cachedRun) return responseFor(cachedRun, config, { cached: true });

    let variants;
    const ai = {
      requested: discoveryMode === 'ai',
      expansionUsed: false,
      relevanceUsed: false,
      fallback: false,
      model: discoveryMode === 'ai' ? config.ollama.model : undefined
    };
    if (discoveryMode === 'ai' && config.ollama.enabled) {
      try {
        variants = await expandNicheQueries(config, nicheInput, Math.min(config.ollama.maxVariants, config.research.maxQueryVariants));
        ai.expansionUsed = true;
      } catch (error) {
        variants = generateQueryVariants(nicheInput, 'broad', config.research.maxQueryVariants);
        ai.fallback = true;
        ai.error = error.message;
      }
    } else if (discoveryMode === 'ai') {
      variants = generateQueryVariants(nicheInput, 'broad', config.research.maxQueryVariants);
      ai.fallback = true;
      ai.error = 'Ollama is disabled';
    } else {
      variants = generateQueryVariants(nicheInput, discoveryMode, config.research.maxQueryVariants);
    }

    const run = await ResearchRun.create({
      cacheKey,
      nicheInput,
      nicheKey,
      publishedAfter: window.publishedAfter,
      publishedBefore: window.publishedBefore,
      startDate: window.startDate,
      endDate: window.endDate,
      periodPreset: window.periodPreset,
      timeZone,
      minViews: input.minViews,
      regionCode: input.regionCode,
      originalLanguage,
      languagePolicy,
      format: input.format,
      discoveryMode,
      ai,
      queryVariants: variants.map((variant) => ({ query: variant, exhausted: false })),
      cacheExpiresAt: DateTime.utc().plus({ hours: config.research.searchCacheHours }).toJSDate()
    });

    try {
      const result = await executeWave(run);
      return responseFor(run, config, { cached: false, quota: result.quota });
    } catch (error) {
      run.status = 'failed';
      await run.save();
      throw error;
    }
  }

  async function executeWave(run) {
    const foundIds = new Set();
    const discoveryQueryById = new Map();
    let quota;
    let searchCalls = 0;

    for (const variant of run.queryVariants) {
      if (variant.exhausted) continue;
      const search = await searchVideoIds(config, {
        query: variant.query,
        publishedAfter: run.publishedAfter,
        publishedBefore: run.publishedBefore,
        regionCode: run.regionCode,
        relevanceLanguage: baseLanguage(run.originalLanguage),
        pageToken: variant.pageToken
      });
      quota = search.quota;
      searchCalls += 1;
      for (const id of search.ids) {
        foundIds.add(id);
        if (!discoveryQueryById.has(id)) discoveryQueryById.set(id, variant.query);
      }
      variant.pageToken = search.nextPageToken;
      variant.exhausted = !search.nextPageToken;
    }

    const ids = [...foundIds];
    const items = [];
    let videoCalls = 0;
    for (let index = 0; index < ids.length; index += 50) {
      const batch = await fetchVideos(config, ids.slice(index, index + 50));
      items.push(...batch);
      if (batch.length) videoCalls += 1;
    }

    const candidates = [];
    let unknownExcluded = 0;
    for (const item of items) {
      const publishedAt = new Date(item.snippet?.publishedAt);
      const languageResult = evaluateLanguage(item, run.originalLanguage, run.languagePolicy);
      if (!languageResult.include && !languageResult.raw) unknownExcluded += 1;
      const duration = parseDurationSeconds(item.contentDetails?.duration);
      const format = duration === undefined ? 'unknown' : duration <= 180 ? 'short' : 'long';
      if (
        publishedAt < run.publishedAfter ||
        publishedAt > run.publishedBefore ||
        !languageResult.include ||
        (run.format !== 'all' && format !== run.format) ||
        item.status?.privacyStatus !== 'public'
      ) continue;
      candidates.push(toVideoRecord(item, run.nicheKey, discoveryQueryById.get(item.id) || run.nicheInput, languageResult));
    }

    await persistVideosAndSnapshots(candidates);
    const candidateIds = candidates.map((video) => video.videoId);
    let qualifyingCandidates = candidates.filter((video) => video.statistics.viewCount >= run.minViews);

    if (run.ai?.requested && config.ollama.enabled && config.ollama.relevanceEnabled && qualifyingCandidates.length) {
      try {
        const classifyInput = [...qualifyingCandidates]
          .sort((a, b) => b.statistics.viewCount - a.statistics.viewCount)
          .slice(0, config.ollama.maxRelevanceVideos);
        const decisions = await classifyVideoRelevance(config, run.nicheInput, classifyInput);
        const existing = new Map((run.aiRelevanceDecisions ?? []).map((decision) => [decision.videoId, decision.toObject?.() ?? decision]));
        decisions.forEach((decision) => existing.set(decision.id, {
          videoId: decision.id,
          relevant: decision.relevant,
          confidence: decision.confidence,
          reason: decision.reason
        }));
        run.aiRelevanceDecisions = [...existing.values()];
        const decisionMap = new Map(decisions.map((decision) => [decision.id, decision]));
        qualifyingCandidates = qualifyingCandidates.filter((video) => decisionMap.get(video.videoId)?.relevant !== false);
        run.ai.relevanceUsed = true;
      } catch (error) {
        run.ai.fallback = true;
        run.ai.error = run.ai.error ? `${run.ai.error}; ${error.message}` : error.message;
      }
    }

    let baselineCalls = { channels: 0, playlistItems: 0, videos: 0 };
    try {
      baselineCalls = await ensureChannelBaselines(config, qualifyingCandidates);
      run.channelBaseline.used = true;
    } catch (error) {
      run.channelBaseline.error = error.message;
    }

    const qualifyingIds = qualifyingCandidates.map((video) => video.videoId);
    run.candidateVideoIds = [...new Set([...run.candidateVideoIds, ...candidateIds])];
    run.videoIds = [...new Set([...run.videoIds, ...qualifyingIds])];
    run.candidateCount += items.length;
    run.unknownLanguageExcludedCount += unknownExcluded;
    run.youtubeCalls.search += searchCalls;
    run.youtubeCalls.videos += videoCalls + baselineCalls.videos;
    run.youtubeCalls.channels += baselineCalls.channels;
    run.youtubeCalls.playlistItems += baselineCalls.playlistItems;
    run.status = canLoadMore(run, config) ? 'partial' : 'complete';
    run.markModified('queryVariants');
    run.markModified('ai');
    run.markModified('channelBaseline');
    await run.save();
    return { quota };
  }

  async function loadMore(cursor) {
    if (!mongoose.isValidObjectId(cursor)) {
      throw new AppError('Invalid research cursor', 400, 'INVALID_CURSOR');
    }
    const run = await ResearchRun.findById(cursor);
    if (!run || run.cacheExpiresAt <= new Date()) {
      throw new AppError('Research cursor expired', 410, 'CURSOR_EXPIRED');
    }
    if (!canLoadMore(run, config)) {
      throw new AppError('No more result pages are available', 400, 'NO_MORE_RESULTS');
    }
    run.pageCount += 1;
    const result = await executeWave(run);
    return responseFor(run, config, { cached: false, quota: result.quota });
  }

  return { research };
}
