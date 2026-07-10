function pad(value) {
  return String(value).padStart(2, '0');
}

export function toLocalDateInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function subtractMonths(date, months) {
  const result = new Date(date);
  const targetDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() - months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(targetDay, lastDay));
  return result;
}

export function datesForPreset(preset, now = new Date()) {
  const endDate = toLocalDateInput(now);
  if (preset === 'recent-30-days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return { startDate: toLocalDateInput(start), endDate };
  }
  const months = { 'recent-3-months': 3, 'recent-6-months': 6, 'recent-12-months': 12 }[preset];
  return months ? { startDate: toLocalDateInput(subtractMonths(now, months)), endDate } : null;
}
