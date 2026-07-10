import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreVideoCohorts } from '../src/lib/scoring.js';

function video(videoId, format, viewCount, daysOld, now, channelId) {
  return {
    videoId,
    channelId,
    format,
    statistics: { viewCount },
    publishedAt: new Date(now - daysOld * 86400000)
  };
}

test('scores format cohorts independently and labels a qualified top percentile', () => {
  const now = Date.UTC(2026, 6, 10);
  const videos = [
    video('a', 'short', 100, 10, now),
    video('b', 'short', 200, 10, now),
    video('c', 'short', 300, 10, now),
    video('d', 'short', 1000, 5, now),
    video('long-a', 'long', 5000, 20, now)
  ];
  const scores = scoreVideoCohorts(videos, { minimumSample: 4, now });
  assert.equal(scores.get('d').percentile, 100);
  assert.equal(scores.get('d').label, 'top-1%-sample');
  assert.equal(scores.get('d').cohortSize, 4);
  assert.equal(scores.get('long-a').cohortSize, 1);
  assert.equal(scores.get('long-a').sampleQualified, false);
});

test('does not claim top 1% below the sample threshold', () => {
  const now = Date.UTC(2026, 6, 10);
  const scores = scoreVideoCohorts([
    video('a', 'long', 100, 10, now),
    video('b', 'long', 1000, 10, now)
  ], { minimumSample: 100, now });
  assert.notEqual(scores.get('b').label, 'top-1%-sample');
  assert.equal(scores.get('b').label, 'sample-high-performer');
});

test('adds a channel-relative multiplier when a sufficient baseline exists', () => {
  const now = Date.UTC(2026, 6, 10);
  const videos = [
    video('a', 'long', 1000, 10, now, 'channel-a'),
    video('b', 'long', 2000, 10, now, 'channel-b')
  ];
  const channelBaselines = new Map([
    ['channel-a', { cohorts: { long: { medianViews: 100, sampleSize: 8 }, all: { medianViews: 100, sampleSize: 8 } } }],
    ['channel-b', { cohorts: { long: { medianViews: 1000, sampleSize: 8 }, all: { medianViews: 1000, sampleSize: 8 } } }]
  ]);
  const scores = scoreVideoCohorts(videos, { minimumSample: 100, minimumChannelSample: 5, channelBaselines, now });
  assert.equal(scores.get('a').channelMultiplier, 10);
  assert.equal(scores.get('a').channelBaselineSampleSize, 8);
  assert.equal(scores.get('b').channelMultiplier, 2);
  assert.ok(scores.get('a').channelPercentile > scores.get('b').channelPercentile);
});
