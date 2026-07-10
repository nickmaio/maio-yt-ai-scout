import { AppError } from './errors.js';

export function normalizeLanguageTag(value) {
  if (!value || value === 'any') return 'any';
  try {
    return Intl.getCanonicalLocales(value)[0];
  } catch {
    throw new AppError('originalLanguage must be a valid BCP 47 language tag', 400, 'INVALID_LANGUAGE');
  }
}

export function baseLanguage(value) {
  if (!value || value === 'any') return undefined;
  return new Intl.Locale(value).language;
}

export function languageMatches(declared, selected) {
  if (selected === 'any') return true;
  if (!declared) return false;
  let declaredTag;
  let selectedTag;
  try {
    declaredTag = normalizeLanguageTag(declared);
    selectedTag = normalizeLanguageTag(selected);
  } catch {
    return false;
  }
  const selectedLocale = new Intl.Locale(selectedTag);
  const declaredLocale = new Intl.Locale(declaredTag);
  const requestedSpecificLocale = selectedTag.includes('-');
  return requestedSpecificLocale
    ? declaredTag.toLowerCase() === selectedTag.toLowerCase()
    : declaredLocale.language === selectedLocale.language;
}

export function evaluateLanguage(video, selected, policy) {
  const raw = video.snippet?.defaultAudioLanguage;
  let normalized;
  if (raw) {
    try { normalized = normalizeLanguageTag(raw); } catch { normalized = undefined; }
  }

  if (selected === 'any' || policy === 'any') {
    return { include: true, raw, normalized, source: raw ? 'youtube-declared' : 'unknown' };
  }

  if (languageMatches(raw, selected)) {
    return { include: true, raw, normalized, source: 'youtube-declared' };
  }

  // Phase 1 deliberately keeps best-effort deterministic until the optional
  // language inference service is implemented.
  return { include: false, raw, normalized, source: raw ? 'youtube-declared' : 'unknown' };
}
