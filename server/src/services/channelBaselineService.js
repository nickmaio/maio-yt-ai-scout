import { DateTime } from 'luxon';
import { ChannelBaseline } from '../models/ChannelBaseline.js';
import { fetchChannels, fetchPlaylistVideoIds, fetchVideos } from './youtubeService.js';

function durationSeconds(value) {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value ?? '');
  if (!match) return undefined;
  return Number(match[1] ?? 0) * 86400 + Number(match[2] ?? 0) * 3600 + Number(match[3] ?? 0) * 60 + Number(match[4] ?? 0);
}

function median(values) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function cohort(values) {
  return { medianViews: median(values), sampleSize: values.length };
}

export async function ensureChannelBaselines(config, candidateVideos) {
  if (!config.research.channelBaselineEnabled || !candidateVideos.length) {
    return { channels: 0, playlistItems: 0, videos: 0 };
  }
  const uniqueChannels = [];
  const seen = new Set();
  for (const video of [...candidateVideos].sort((a, b) => b.statistics.viewCount - a.statistics.viewCount)) {
    if (video.channelId && !seen.has(video.channelId)) {
      seen.add(video.channelId);
      uniqueChannels.push({ channelId: video.channelId, channelTitle: video.channelTitle });
    }
    if (uniqueChannels.length >= config.research.maxBaselineChannels) break;
  }

  const cached = await ChannelBaseline.find({
    channelId: { $in: uniqueChannels.map((channel) => channel.channelId) },
    expiresAt: { $gt: new Date() }
  }).lean();
  const cachedIds = new Set(cached.map((item) => item.channelId));
  const missing = uniqueChannels.filter((channel) => !cachedIds.has(channel.channelId));
  if (!missing.length) return { channels: 0, playlistItems: 0, videos: 0 };

  const channelResources = await fetchChannels(config, missing.map((channel) => channel.channelId));
  let playlistCalls = 0;
  const channelVideoIds = new Map();
  for (const channel of channelResources) {
    const playlistId = channel.contentDetails?.relatedPlaylists?.uploads;
    if (!playlistId) continue;
    const ids = await fetchPlaylistVideoIds(config, playlistId, config.research.baselineVideosPerChannel);
    playlistCalls += 1;
    channelVideoIds.set(channel.id, { playlistId, ids, title: channel.snippet?.title });
  }

  const allIds = [...new Set([...channelVideoIds.values()].flatMap((item) => item.ids))];
  const resources = [];
  let videoCalls = 0;
  for (let index = 0; index < allIds.length; index += 50) {
    const batch = await fetchVideos(config, allIds.slice(index, index + 50));
    resources.push(...batch);
    if (batch.length) videoCalls += 1;
  }
  const byId = new Map(resources.map((video) => [video.id, video]));
  const expiresAt = DateTime.utc().plus({ hours: config.research.channelBaselineCacheHours }).toJSDate();

  for (const [channelId, value] of channelVideoIds) {
    const all = [];
    const short = [];
    const long = [];
    for (const id of value.ids) {
      const video = byId.get(id);
      const views = Number(video?.statistics?.viewCount);
      if (!Number.isFinite(views)) continue;
      all.push(views);
      const seconds = durationSeconds(video.contentDetails?.duration);
      if (seconds !== undefined && seconds <= 180) short.push(views);
      else if (seconds !== undefined) long.push(views);
    }
    await ChannelBaseline.findOneAndUpdate({ channelId }, {
      $set: {
        channelTitle: value.title,
        uploadsPlaylistId: value.playlistId,
        cohorts: { all: cohort(all), short: cohort(short), long: cohort(long) },
        collectedAt: new Date(),
        expiresAt
      }
    }, { upsert: true });
  }
  return { channels: channelResources.length ? 1 : 0, playlistItems: playlistCalls, videos: videoCalls };
}

export async function getChannelBaselineMap(channelIds) {
  const baselines = await ChannelBaseline.find({
    channelId: { $in: [...new Set(channelIds.filter(Boolean))] },
    expiresAt: { $gt: new Date() }
  }).lean();
  return new Map(baselines.map((baseline) => [baseline.channelId, baseline]));
}
