import { DateTime } from 'luxon';
import { SearchQuota } from '../models/SearchQuota.js';
import { AppError } from '../lib/errors.js';

export async function consumeSearchQuota(limit) {
  const day = DateTime.now().setZone('America/Los_Angeles').toISODate();
  let updated = await SearchQuota.findOneAndUpdate(
    { day, count: { $lt: limit } },
    { $inc: { count: 1 } },
    { new: true }
  );

  if (!updated) {
    try {
      updated = await SearchQuota.create({ day, count: 1 });
    } catch (error) {
      if (error?.code === 11000) {
        throw new AppError('Local YouTube search budget exhausted for today', 429, 'SEARCH_QUOTA_EXHAUSTED');
      }
      throw error;
    }
  }
  return { used: updated.count, limit, day };
}

export async function getSearchQuota(limit) {
  const day = DateTime.now().setZone('America/Los_Angeles').toISODate();
  const record = await SearchQuota.findOne({ day }).lean();
  return { used: record?.count ?? 0, limit, day };
}
