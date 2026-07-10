import { YouTubeError } from '../lib/errors.js';
import { consumeSearchQuota } from './quotaService.js';

async function youtubeRequest(config, path, params) {
  const url = new URL(path, `${config.youtube.apiBaseUrl}/`);
  for (const [key, value] of Object.entries({ ...params, key: config.youtube.apiKey })) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(config.youtube.requestTimeoutMs) });
  } catch (error) {
    const message = error?.name === 'TimeoutError'
      ? 'YouTube request timed out'
      : 'Could not connect to YouTube Data API';
    throw new YouTubeError(message, 502, { cause: error?.message });
  }

  if (!response.ok) {
    let payload;
    try { payload = await response.json(); } catch { payload = {}; }
    const reason = payload?.error?.errors?.[0]?.reason;
    const message = payload?.error?.message || `YouTube API returned HTTP ${response.status}`;
    const status = response.status === 403 && reason?.toLowerCase().includes('quota') ? 429 : 502;
    throw new YouTubeError(message, status, { httpStatus: response.status, reason });
  }
  return response.json();
}

export async function searchVideoIds(config, params) {
  const quota = await consumeSearchQuota(config.youtube.dailySearchCallBudget);
  const payload = await youtubeRequest(config, 'search', {
    part: 'snippet',
    type: 'video',
    q: params.query,
    publishedAfter: params.publishedAfter.toISOString(),
    publishedBefore: params.publishedBefore.toISOString(),
    order: 'viewCount',
    maxResults: 50,
    regionCode: params.regionCode,
    relevanceLanguage: params.relevanceLanguage,
    safeSearch: config.youtube.safeSearch,
    pageToken: params.pageToken
  });

  return {
    ids: (payload.items ?? []).map((item) => item.id?.videoId).filter(Boolean),
    nextPageToken: payload.nextPageToken,
    quota
  };
}

export async function fetchVideos(config, ids) {
  if (!ids.length) return [];
  const payload = await youtubeRequest(config, 'videos', {
    part: 'snippet,statistics,contentDetails,status',
    id: ids.join(',')
  });
  return payload.items ?? [];
}

export async function fetchChannels(config, ids) {
  if (!ids.length) return [];
  const payload = await youtubeRequest(config, 'channels', {
    part: 'snippet,contentDetails',
    id: ids.slice(0, 50).join(','),
    maxResults: 50
  });
  return payload.items ?? [];
}

export async function fetchPlaylistVideoIds(config, playlistId, maxResults) {
  if (!playlistId) return [];
  const payload = await youtubeRequest(config, 'playlistItems', {
    part: 'contentDetails',
    playlistId,
    maxResults: Math.min(maxResults, 50)
  });
  return (payload.items ?? []).map((item) => item.contentDetails?.videoId).filter(Boolean);
}
