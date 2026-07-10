import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { localConfig } from '../src/config/localConfig.example.js';
import { validateConfig } from '../src/config/validateConfig.js';

test('local configuration is structurally valid and detects the placeholder key', () => {
  assert.doesNotThrow(() => validateConfig(localConfig, { requireApiKey: false }));
  assert.throws(() => validateConfig(localConfig), /Set youtube\.apiKey/);
});

test('public config never exposes the YouTube key', async () => {
  const app = createApp({ config: localConfig, researchService: { research: async () => ({}) } });
  const response = await request(app).get('/api/config/public').expect(200);
  assert.equal(JSON.stringify(response.body).includes('PASTE_YOUTUBE'), false);
  assert.equal(response.body.defaultPeriodPreset, 'recent-3-months');
  assert.equal(response.body.defaultDiscoveryMode, 'broad');
});

test('research route validates the niche', async () => {
  const app = createApp({ config: localConfig, researchService: { research: async () => ({}) } });
  const response = await request(app).get('/api/research').expect(400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('research route passes normalized query input to the service', async () => {
  let received;
  const app = createApp({
    config: localConfig,
    researchService: {
      research: async (input) => {
        received = input;
        return { items: [], meta: {} };
      }
    }
  });
  await request(app)
    .get('/api/research?niche=interior%20design&region=gb&originalLanguage=en&languagePolicy=strict&discoveryMode=broad')
    .expect(200);
  assert.equal(received.niche, 'interior design');
  assert.equal(received.regionCode, 'GB');
  assert.equal(received.originalLanguage, 'en');
  assert.equal(received.discoveryMode, 'broad');
});
