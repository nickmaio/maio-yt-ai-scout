import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyVideoRelevance, expandNicheQueries } from '../src/services/ollamaService.js';

const config = {
  ollama: {
    baseUrl: 'http://ollama.test:11434',
    model: 'test-model',
    timeoutMs: 5000,
    relevanceBatchSize: 25
  }
};

test('AI query expansion is schema-validated, deduplicated, and exact-niche first', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    message: { content: JSON.stringify({ queryVariants: ['room makeovers', 'interior design', 'room makeovers'] }) }
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const variants = await expandNicheQueries(config, 'interior design', 3);
    assert.deepEqual(variants, ['interior design', 'room makeovers']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('AI relevance ignores hallucinated video IDs', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    message: { content: JSON.stringify({ decisions: [
      { id: 'real', relevant: true, confidence: 0.9, reason: 'Matches niche' },
      { id: 'invented', relevant: false, confidence: 1, reason: 'Not supplied' }
    ] }) }
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const decisions = await classifyVideoRelevance(config, 'interior design', [
      { videoId: 'real', title: 'A room', description: 'Design' }
    ]);
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].id, 'real');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
