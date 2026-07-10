async function apiRequest(path, signal) {
  const response = await fetch(path, { signal });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || `Request failed with HTTP ${response.status}`);
    error.code = payload.error?.code;
    error.details = payload.error?.details;
    throw error;
  }
  return payload;
}

export function getPublicConfig(signal) {
  return apiRequest('/api/config/public', signal);
}

export function researchVideos(params, signal) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  return apiRequest(`/api/research?${search}`, signal);
}
