import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { resolvePublicationWindow } from '../src/lib/dateWindow.js';

test('defaults to the trailing three calendar months', () => {
  const result = resolvePublicationWindow({
    timeZone: 'Europe/Moscow',
    maxPeriodMonths: 12,
    now: DateTime.fromISO('2026-07-10T12:00:00Z')
  });
  assert.equal(result.startDate, '2026-04-10');
  assert.equal(result.endDate, '2026-07-10');
  assert.equal(result.periodPreset, 'recent-3-months');
});

test('custom dates use inclusive local-day UTC boundaries', () => {
  const result = resolvePublicationWindow({
    startDate: '2026-05-01',
    endDate: '2026-05-02',
    timeZone: 'Europe/Moscow',
    maxPeriodMonths: 12,
    now: DateTime.fromISO('2026-07-10T12:00:00Z')
  });
  assert.equal(result.publishedAfter.toISOString(), '2026-04-30T21:00:00.000Z');
  assert.equal(result.publishedBefore.toISOString(), '2026-05-02T20:59:59.999Z');
});

test('rejects incomplete and reversed ranges', () => {
  assert.throws(() => resolvePublicationWindow({
    startDate: '2026-05-01', timeZone: 'UTC', maxPeriodMonths: 12,
    now: DateTime.fromISO('2026-07-10T12:00:00Z')
  }), /provided together/);
  assert.throws(() => resolvePublicationWindow({
    startDate: '2026-06-02', endDate: '2026-06-01', timeZone: 'UTC', maxPeriodMonths: 12,
    now: DateTime.fromISO('2026-07-10T12:00:00Z')
  }), /on or before/);
});
