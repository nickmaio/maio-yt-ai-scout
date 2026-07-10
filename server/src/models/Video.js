import mongoose from 'mongoose';

const languageSchema = new mongoose.Schema({
  defaultAudioLanguageRaw: String,
  normalizedAudioLanguage: String,
  metadataLanguageRaw: String,
  source: { type: String, enum: ['youtube-declared', 'estimated', 'unknown'], default: 'unknown' },
  confidence: Number
}, { _id: false });

const statisticsSchema = new mongoose.Schema({
  viewCount: { type: Number, default: 0 },
  likeCount: Number,
  commentCount: Number
}, { _id: false });

const discoveredBySchema = new mongoose.Schema({
  nicheKey: String,
  query: String,
  discoveredAt: Date
}, { _id: false });

const videoSchema = new mongoose.Schema({
  videoId: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  description: String,
  channelId: String,
  channelTitle: String,
  publishedAt: { type: Date, required: true, index: true },
  thumbnailUrl: String,
  durationSeconds: Number,
  format: { type: String, enum: ['short', 'long', 'unknown'], default: 'unknown' },
  statistics: statisticsSchema,
  language: languageSchema,
  lastFetchedAt: Date,
  discoveredBy: [discoveredBySchema]
}, { timestamps: true });

export const Video = mongoose.model('Video', videoSchema);
