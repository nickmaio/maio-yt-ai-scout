import { DateTime } from 'luxon';
import { AppError } from './errors.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value, timeZone, field) {
  if (!ISO_DATE.test(value ?? '')) {
    throw new AppError(`${field} must use YYYY-MM-DD`, 400, 'INVALID_DATE_RANGE');
  }
  const parsed = DateTime.fromISO(value, { zone: timeZone });
  if (!parsed.isValid || parsed.toISODate() !== value) {
    throw new AppError(`${field} is not a real calendar date`, 400, 'INVALID_DATE_RANGE');
  }
  return parsed;
}

export function resolvePublicationWindow({
  startDate,
  endDate,
  timeZone,
  maxPeriodMonths,
  now = DateTime.utc()
}) {
  const localNow = now.setZone(timeZone);
  let start;
  let end;
  let periodPreset = 'custom';

  if (!startDate && !endDate) {
    start = localNow.minus({ months: 3 }).startOf('day');
    end = localNow;
    periodPreset = 'recent-3-months';
  } else {
    if (!startDate || !endDate) {
      throw new AppError('startDate and endDate must be provided together', 400, 'INVALID_DATE_RANGE');
    }
    start = parseDate(startDate, timeZone, 'startDate').startOf('day');
    const selectedEnd = parseDate(endDate, timeZone, 'endDate');

    if (start > localNow || selectedEnd.startOf('day') > localNow.startOf('day')) {
      throw new AppError('Publication dates cannot be in the future', 400, 'INVALID_DATE_RANGE');
    }
    end = selectedEnd.hasSame(localNow, 'day') ? localNow : selectedEnd.endOf('day');
  }

  if (start > end) {
    throw new AppError('startDate must be on or before endDate', 400, 'INVALID_DATE_RANGE');
  }
  if (start < end.minus({ months: maxPeriodMonths }).startOf('day')) {
    throw new AppError(`Publication window cannot exceed ${maxPeriodMonths} months`, 400, 'INVALID_DATE_RANGE');
  }

  return {
    publishedAfter: start.toUTC().toJSDate(),
    publishedBefore: end.toUTC().toJSDate(),
    startDate: start.toISODate(),
    endDate: end.toISODate(),
    timeZone,
    periodPreset
  };
}
