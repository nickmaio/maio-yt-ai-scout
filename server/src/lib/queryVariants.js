export function generateQueryVariants(niche, mode = 'focused', maxVariants = 3) {
  const clean = niche.trim().replace(/\s+/g, ' ');
  const candidates = mode === 'broad'
    ? [clean, `${clean} ideas`, `${clean} tips`]
    : [clean];
  return [...new Set(candidates)].slice(0, maxVariants);
}
