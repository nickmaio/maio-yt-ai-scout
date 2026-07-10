import test from 'node:test';
import assert from 'node:assert/strict';
import { datesForPreset, toLocalDateInput } from './datePresets.js';

test('uses three calendar months rather than 90 days', () => {
  assert.deepEqual(datesForPreset('recent-3-months', new Date(2026, 6, 10)), {
    startDate: '2026-04-10',
    endDate: '2026-07-10'
  });
});

test('clamps month-end dates', () => {
  assert.equal(datesForPreset('recent-3-months', new Date(2026, 4, 31)).startDate, '2026-02-28');
});

test('formats local dates for date inputs', () => {
  assert.equal(toLocalDateInput(new Date(2026, 0, 2)), '2026-01-02');
});
