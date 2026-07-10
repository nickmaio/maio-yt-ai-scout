import { z } from 'zod';

const expansionSchema = {
  type: 'object',
  properties: {
    queryVariants: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 }
  },
  required: ['queryVariants'],
  additionalProperties: false
};

const expansionResult = z.object({
  queryVariants: z.array(z.string().trim().min(2).max(120)).min(1).max(5)
});

const relevanceSchema = {
  type: 'object',
  properties: {
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          relevant: { type: 'boolean' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          reason: { type: 'string', maxLength: 160 }
        },
        required: ['id', 'relevant', 'confidence', 'reason'],
        additionalProperties: false
      }
    }
  },
  required: ['decisions'],
  additionalProperties: false
};

const relevanceResult = z.object({
  decisions: z.array(z.object({
    id: z.string(),
    relevant: z.boolean(),
    confidence: z.number().min(0).max(1),
    reason: z.string().transform((value) => value.slice(0, 160))
  }))
});

async function chat(config, messages, format) {
  const response = await fetch(new URL('/api/chat', config.ollama.baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.ollama.model,
      messages,
      format,
      stream: false,
      think: false,
      options: { temperature: 0 },
      keep_alive: '10m'
    }),
    signal: AbortSignal.timeout(config.ollama.timeoutMs)
  });
  if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);
  return JSON.parse(payload.message?.content ?? '{}');
}

export async function checkOllama(config) {
  try {
    const response = await fetch(new URL('/api/tags', config.ollama.baseUrl), {
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) return { available: false, modelAvailable: false };
    const payload = await response.json();
    const models = (payload.models ?? []).map((item) => item.name || item.model);
    return { available: true, modelAvailable: models.includes(config.ollama.model) };
  } catch {
    return { available: false, modelAvailable: false };
  }
}

export async function expandNicheQueries(config, niche, maximum) {
  const parsed = expansionResult.parse(await chat(config, [{
    role: 'system',
    content: 'Generate concise YouTube search queries for niche research. Preserve the niche meaning. Return only schema-valid data.'
  }, {
    role: 'user',
    content: `Niche: ${niche}\nReturn up to ${maximum} distinct search phrases, including the exact niche.`
  }], expansionSchema));
  return [...new Set([niche, ...parsed.queryVariants])].slice(0, maximum);
}

export async function classifyVideoRelevance(config, niche, videos) {
  const decisions = [];
  for (let index = 0; index < videos.length; index += config.ollama.relevanceBatchSize) {
    const batch = videos.slice(index, index + config.ollama.relevanceBatchSize);
    const compact = batch.map((video) => ({
      id: video.videoId,
      title: video.title,
      description: (video.description || '').slice(0, 240)
    }));
    const parsed = relevanceResult.parse(await chat(config, [{
      role: 'system',
      content: 'Classify whether each YouTube video is genuinely about the requested niche. Be conservative. Return one decision for every supplied ID. Keep each reason under 120 characters.'
    }, {
      role: 'user',
      content: `Niche: ${niche}\nVideos: ${JSON.stringify(compact)}`
    }], relevanceSchema));
    const allowedIds = new Set(batch.map((video) => video.videoId));
    decisions.push(...parsed.decisions.filter((decision) => allowedIds.has(decision.id)));
  }
  return decisions;
}
