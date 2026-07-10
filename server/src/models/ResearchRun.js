import mongoose from 'mongoose';

const researchRunSchema = new mongoose.Schema({
  cacheKey: { type: String, required: true, index: true },
  nicheInput: String,
  nicheKey: String,
  publishedAfter: Date,
  publishedBefore: Date,
  startDate: String,
  endDate: String,
  periodPreset: String,
  timeZone: String,
  minViews: Number,
  regionCode: String,
  originalLanguage: String,
  languagePolicy: String,
  format: String,
  discoveryMode: { type: String, enum: ['focused', 'broad', 'ai'], default: 'focused' },
  queryVariants: [{
    query: String,
    pageToken: String,
    exhausted: { type: Boolean, default: false }
  }],
  ai: {
    requested: { type: Boolean, default: false },
    expansionUsed: { type: Boolean, default: false },
    relevanceUsed: { type: Boolean, default: false },
    fallback: { type: Boolean, default: false },
    model: String,
    error: String
  },
  aiRelevanceDecisions: [{
    videoId: String,
    relevant: Boolean,
    confidence: Number,
    reason: String
  }],
  channelBaseline: {
    used: { type: Boolean, default: false },
    error: String
  },
  videoIds: [String],
  candidateVideoIds: [String],
  candidateCount: { type: Number, default: 0 },
  unknownLanguageExcludedCount: { type: Number, default: 0 },
  pageCount: { type: Number, default: 1 },
  youtubeCalls: {
    search: { type: Number, default: 0 },
    videos: { type: Number, default: 0 },
    channels: { type: Number, default: 0 },
    playlistItems: { type: Number, default: 0 }
  },
  status: { type: String, enum: ['running', 'complete', 'partial', 'failed'], default: 'running' },
  cacheExpiresAt: Date
}, { timestamps: true });

researchRunSchema.index({ cacheExpiresAt: 1 }, { expireAfterSeconds: 0 });

export const ResearchRun = mongoose.model('ResearchRun', researchRunSchema);
