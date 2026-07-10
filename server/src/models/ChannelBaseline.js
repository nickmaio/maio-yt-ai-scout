import mongoose from 'mongoose';

const cohortSchema = new mongoose.Schema({
  medianViews: Number,
  sampleSize: Number
}, { _id: false });

const channelBaselineSchema = new mongoose.Schema({
  channelId: { type: String, required: true, unique: true, index: true },
  channelTitle: String,
  uploadsPlaylistId: String,
  cohorts: {
    all: cohortSchema,
    short: cohortSchema,
    long: cohortSchema
  },
  collectedAt: Date,
  expiresAt: Date
}, { timestamps: true });

channelBaselineSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ChannelBaseline = mongoose.model('ChannelBaseline', channelBaselineSchema);
