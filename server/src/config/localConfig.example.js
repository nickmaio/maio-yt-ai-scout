export const localConfig = Object.freeze({
  server: {
    host: '127.0.0.1',
    port: 5000,
    clientOrigin: 'http://127.0.0.1:5173',
    timeZone: 'Europe/Moscow'
  },
  mongo: {
    uri: 'mongodb://127.0.0.1:27017/yt-research',
    dbName: 'yt-research'
  },
  youtube: {
    apiKey: 'PASTE_YOUTUBE_DATA_API_KEY_HERE',
    apiBaseUrl: 'https://www.googleapis.com/youtube/v3',
    defaultRegion: 'US',
    safeSearch: 'moderate',
    dailySearchCallBudget: 90,
    requestTimeoutMs: 10000
  },
  ollama: {
    enabled: false,
    baseUrl: 'http://127.0.0.1:11434',
    model: 'qwen3:4b',
    timeoutMs: 15000,
    maxVariants: 3,
    relevanceEnabled: true,
    relevanceBatchSize: 25,
    maxRelevanceVideos: 50
  },
  research: {
    defaultPeriodPreset: 'recent-3-months',
    defaultMinViews: 100000,
    defaultLanguage: 'any',
    defaultLanguagePolicy: 'any',
    maxPeriodMonths: 12,
    maxPagesPerSearch: 2,
    defaultDiscoveryMode: 'broad',
    maxQueryVariants: 3,
    minTopPercentileSample: 100,
    channelBaselineEnabled: true,
    maxBaselineChannels: 8,
    baselineVideosPerChannel: 12,
    minChannelBaselineVideos: 5,
    channelBaselineCacheHours: 24,
    searchCacheHours: 12,
    videoCacheHours: 6
  }
});
