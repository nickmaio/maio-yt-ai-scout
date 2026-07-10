import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';
import mongoose from 'mongoose';
import { createResearchRouter } from './routes/researchRoutes.js';
import { getSearchQuota } from './services/quotaService.js';
import { checkOllama } from './services/ollamaService.js';

export function createApp({ config, researchService, logger }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.server.clientOrigin }));
  app.use(express.json({ limit: '64kb' }));
  if (logger) app.use(pinoHttp({ logger }));
  app.use('/api', rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false
  }));

  app.get('/api/health', async (_request, response) => {
    let quota = { used: 0, limit: config.youtube.dailySearchCallBudget };
    if (mongoose.connection.readyState === 1) {
      quota = await getSearchQuota(config.youtube.dailySearchCallBudget);
    }
    const ollama = config.ollama.enabled ? await checkOllama(config) : { available: false, modelAvailable: false };
    response.json({
      status: mongoose.connection.readyState === 1 ? 'ok' : 'degraded',
      mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      youtube: { configured: !config.youtube.apiKey.includes('PASTE_YOUTUBE'), quota },
      ollama: { enabled: config.ollama.enabled, model: config.ollama.model, ...ollama }
    });
  });

  app.get('/api/config/public', (_request, response) => {
    response.json({
      defaultRegion: config.youtube.defaultRegion,
      defaultTimeZone: config.server.timeZone,
      defaultMinViews: config.research.defaultMinViews,
      defaultPeriodPreset: config.research.defaultPeriodPreset,
      defaultDiscoveryMode: config.research.defaultDiscoveryMode,
      maxQueryVariants: config.research.maxQueryVariants,
      minimumPercentileSample: config.research.minTopPercentileSample,
      aiDiscoveryEnabled: config.ollama.enabled,
      aiModel: config.ollama.model,
      channelBaselineEnabled: config.research.channelBaselineEnabled,
      maxPeriodMonths: config.research.maxPeriodMonths,
      bestEffortLanguageEnabled: false,
      languages: [
        ['any', 'Any language'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'],
        ['de', 'German'], ['pt', 'Portuguese'], ['ru', 'Russian'], ['ar', 'Arabic'],
        ['hi', 'Hindi'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese'],
        ['it', 'Italian'], ['nl', 'Dutch'], ['pl', 'Polish'], ['tr', 'Turkish'],
        ['uk', 'Ukrainian'], ['id', 'Indonesian'], ['vi', 'Vietnamese'], ['th', 'Thai']
      ].map(([code, name]) => ({ code, name }))
    });
  });

  app.use('/api/research', createResearchRouter(researchService));

  app.use((request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${request.method} ${request.path}` } });
  });

  app.use((error, request, response, _next) => {
    request.log?.error({ err: error }, 'request failed');
    const status = error.status ?? 500;
    response.status(status).json({
      error: {
        code: error.code ?? 'INTERNAL_ERROR',
        message: status >= 500 && !error.status ? 'Unexpected server error' : error.message,
        details: error.details
      }
    });
  });
  return app;
}
