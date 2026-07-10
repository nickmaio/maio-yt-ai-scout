import { z } from 'zod';

const configSchema = z.object({
  server: z.object({
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    clientOrigin: z.url(),
    timeZone: z.string().refine((value) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, 'Invalid IANA time zone')
  }),
  mongo: z.object({ uri: z.string().min(1), dbName: z.string().min(1) }),
  youtube: z.object({
    apiKey: z.string().min(1),
    apiBaseUrl: z.url(),
    defaultRegion: z.string().regex(/^[A-Z]{2}$/),
    safeSearch: z.enum(['none', 'moderate', 'strict']),
    dailySearchCallBudget: z.number().int().min(1).max(100),
    requestTimeoutMs: z.number().int().min(1000)
  }),
  ollama: z.object({
    enabled: z.boolean(),
    baseUrl: z.url(),
    model: z.string().min(1),
    timeoutMs: z.number().int().min(1000),
    maxVariants: z.number().int().min(1).max(10),
    relevanceEnabled: z.boolean(),
    relevanceBatchSize: z.number().int().min(5).max(50),
    maxRelevanceVideos: z.number().int().min(5).max(200)
  }),
  research: z.object({
    defaultPeriodPreset: z.literal('recent-3-months'),
    defaultMinViews: z.number().int().nonnegative(),
    defaultLanguage: z.string(),
    defaultLanguagePolicy: z.enum(['any', 'strict', 'best-effort']),
    maxPeriodMonths: z.number().int().min(1).max(24),
    maxPagesPerSearch: z.number().int().min(1).max(10),
    defaultDiscoveryMode: z.enum(['focused', 'broad']),
    maxQueryVariants: z.number().int().min(1).max(5),
    minTopPercentileSample: z.number().int().min(20).max(1000),
    channelBaselineEnabled: z.boolean(),
    maxBaselineChannels: z.number().int().min(1).max(25),
    baselineVideosPerChannel: z.number().int().min(5).max(50),
    minChannelBaselineVideos: z.number().int().min(3).max(25),
    channelBaselineCacheHours: z.number().positive(),
    searchCacheHours: z.number().positive(),
    videoCacheHours: z.number().positive()
  })
});

export function validateConfig(config, { requireApiKey = true } = {}) {
  const parsed = configSchema.parse(config);
  if (requireApiKey && parsed.youtube.apiKey.includes('PASTE_YOUTUBE')) {
    throw new Error('Set youtube.apiKey in server/src/config/localConfig.js');
  }
  return parsed;
}
