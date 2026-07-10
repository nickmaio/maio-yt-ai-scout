import mongoose from 'mongoose';

const videoSnapshotSchema = new mongoose.Schema({
  videoId: { type: String, required: true, index: true },
  capturedAt: { type: Date, required: true },
  capturedAtBucket: { type: Date, required: true },
  viewCount: { type: Number, required: true },
  likeCount: Number,
  commentCount: Number
}, { timestamps: true });

videoSnapshotSchema.index({ videoId: 1, capturedAtBucket: 1 }, { unique: true });

export const VideoSnapshot = mongoose.model('VideoSnapshot', videoSnapshotSchema);
