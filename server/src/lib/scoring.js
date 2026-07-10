function percentileRanks(values) {
  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);
  const ranks = Array(values.length).fill(0);
  let cursor = 0;
  while (cursor < sorted.length) {
    let end = cursor;
    while (end + 1 < sorted.length && sorted[end + 1].value === sorted[cursor].value) end += 1;
    const averageRank = (cursor + end) / 2;
    const percentile = sorted.length === 1 ? 1 : averageRank / (sorted.length - 1);
    for (let i = cursor; i <= end; i += 1) ranks[sorted[i].index] = percentile;
    cursor = end + 1;
  }
  return ranks;
}

export function scoreVideoCohorts(videos, {
  minimumSample = 100,
  minimumChannelSample = 5,
  channelBaselines = new Map(),
  now = Date.now()
} = {}) {
  const result = new Map();
  const cohorts = new Map();
  for (const video of videos) {
    const key = video.format || 'unknown';
    if (!cohorts.has(key)) cohorts.set(key, []);
    cohorts.get(key).push(video);
  }

  for (const cohort of cohorts.values()) {
    const views = cohort.map((video) => Math.log1p(video.statistics?.viewCount ?? 0));
    const velocities = cohort.map((video) => {
      const ageDays = Math.max((now - new Date(video.publishedAt).getTime()) / 86400000, 1);
      return Math.log1p((video.statistics?.viewCount ?? 0) / ageDays);
    });
    const viewRanks = percentileRanks(views);
    const velocityRanks = percentileRanks(velocities);
    const multipliers = cohort.map((video) => {
      const baseline = channelBaselines.get(video.channelId);
      const preferred = baseline?.cohorts?.[video.format];
      const fallback = baseline?.cohorts?.all;
      const selected = preferred?.sampleSize >= minimumChannelSample ? preferred
        : fallback?.sampleSize >= minimumChannelSample ? fallback : undefined;
      return selected?.medianViews > 0
        ? { value: (video.statistics?.viewCount ?? 0) / selected.medianViews, sampleSize: selected.sampleSize }
        : undefined;
    });
    const validMultiplierIndexes = multipliers.map((value, index) => value ? index : -1).filter((index) => index >= 0);
    const rankedMultipliers = percentileRanks(validMultiplierIndexes.map((index) => Math.log1p(multipliers[index].value)));
    const channelRanks = Array(cohort.length).fill(undefined);
    validMultiplierIndexes.forEach((videoIndex, rankIndex) => { channelRanks[videoIndex] = rankedMultipliers[rankIndex]; });
    const composite = cohort.map((_video, index) => channelRanks[index] === undefined
      ? 0.7 * viewRanks[index] + 0.3 * velocityRanks[index]
      : 0.5 * viewRanks[index] + 0.3 * channelRanks[index] + 0.2 * velocityRanks[index]);
    const compositeRanks = percentileRanks(composite);

    cohort.forEach((video, index) => {
      const percentile = compositeRanks[index];
      const sampleQualified = cohort.length >= minimumSample;
      const label = sampleQualified && percentile >= 0.99
        ? 'top-1%-sample'
        : percentile >= 0.9 ? 'sample-high-performer' : 'threshold-match';
      result.set(video.videoId, {
        score: Math.round(composite[index] * 1000) / 10,
        percentile: Math.round(percentile * 1000) / 10,
        viewPercentile: Math.round(viewRanks[index] * 1000) / 10,
        velocityPercentile: Math.round(velocityRanks[index] * 1000) / 10,
        channelPercentile: channelRanks[index] === undefined ? undefined : Math.round(channelRanks[index] * 1000) / 10,
        channelMultiplier: multipliers[index] ? Math.round(multipliers[index].value * 100) / 100 : undefined,
        channelBaselineSampleSize: multipliers[index]?.sampleSize,
        cohort: video.format || 'unknown',
        cohortSize: cohort.length,
        minimumSample,
        sampleQualified,
        label
      });
    });
  }
  return result;
}
