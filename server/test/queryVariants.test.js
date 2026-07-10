import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQueryVariants } from '../src/lib/queryVariants.js';

test('focused discovery uses only the exact niche', () => {
  assert.deepEqual(generateQueryVariants('  interior   design ', 'focused', 3), ['interior design']);
});

test('broad discovery is deterministic and bounded', () => {
  assert.deepEqual(generateQueryVariants('interior design', 'broad', 2), [
    'interior design',
    'interior design ideas'
  ]);
});
