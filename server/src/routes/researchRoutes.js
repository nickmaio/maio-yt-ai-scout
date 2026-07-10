import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';

const querySchema = z.object({
  cursor: z.string().optional(),
  niche: z.string().trim().min(2).max(120).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  timeZone: z.string().min(1).max(80).optional(),
  minViews: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(100000),
  region: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).default('US'),
  originalLanguage: z.string().trim().max(35).default('any'),
  languagePolicy: z.enum(['any', 'strict', 'best-effort']).default('any'),
  discoveryMode: z.enum(['focused', 'broad', 'ai']).optional(),
  format: z.enum(['all', 'short', 'long']).default('all')
}).superRefine((value, context) => {
  if (!value.cursor && !value.niche) {
    context.addIssue({ code: 'custom', path: ['niche'], message: 'niche is required' });
  }
});

export function createResearchRouter(researchService) {
  const router = Router();
  router.get('/', async (request, response, next) => {
    try {
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        throw new AppError('Invalid research parameters', 400, 'VALIDATION_ERROR', parsed.error.flatten());
      }
      const data = await researchService.research({
        ...parsed.data,
        regionCode: parsed.data.region
      });
      response.json(data);
    } catch (error) {
      next(error);
    }
  });
  return router;
}
