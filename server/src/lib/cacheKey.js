import { createHash } from 'node:crypto';

export function makeCacheKey(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
