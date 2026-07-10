import mongoose from 'mongoose';
import pino from 'pino';
import { localConfig } from './config/localConfig.js';
import { validateConfig } from './config/validateConfig.js';
import { createResearchService } from './services/researchService.js';
import { createApp } from './app.js';

const logger = pino({ level: 'info' });

async function start() {
  const config = validateConfig(localConfig);
  await mongoose.connect(config.mongo.uri, { dbName: config.mongo.dbName, serverSelectionTimeoutMS: 5000 });
  logger.info({ database: config.mongo.dbName }, 'MongoDB connected');

  const researchService = createResearchService(config);
  const app = createApp({ config, researchService, logger });
  const server = app.listen(config.server.port, config.server.host, () => {
    logger.info({
      url: `http://${config.server.host}:${config.server.port}`,
      youtubeConfigured: true,
      ollamaEnabled: config.ollama.enabled
    }, 'Maio YT AI Scout API ready');
  });

  async function shutdown(signal) {
    logger.info({ signal }, 'Shutting down');
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error) => {
  logger.fatal({ err: error }, 'Server failed to start');
  process.exit(1);
});
