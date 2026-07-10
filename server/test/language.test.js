import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLanguage, languageMatches, normalizeLanguageTag } from '../src/lib/language.js';

test('normalizes and compares BCP 47 language tags', () => {
  assert.equal(normalizeLanguageTag('pt-br'), 'pt-BR');
  assert.equal(languageMatches('pt-BR', 'pt'), true);
  assert.equal(languageMatches('pt-PT', 'pt-BR'), false);
  assert.equal(languageMatches('en-US', 'fr'), false);
});

test('strict language mode excludes missing declarations', () => {
  assert.equal(evaluateLanguage({ snippet: {} }, 'en', 'strict').include, false);
  const result = evaluateLanguage({ snippet: { defaultAudioLanguage: 'en-US' } }, 'en', 'strict');
  assert.equal(result.include, true);
  assert.equal(result.source, 'youtube-declared');
});

test('any language includes videos with unknown language', () => {
  const result = evaluateLanguage({ snippet: {} }, 'any', 'any');
  assert.equal(result.include, true);
  assert.equal(result.source, 'unknown');
});
