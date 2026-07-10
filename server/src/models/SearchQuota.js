import mongoose from 'mongoose';

const searchQuotaSchema = new mongoose.Schema({
  day: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 }
}, { timestamps: true });

export const SearchQuota = mongoose.model('SearchQuota', searchQuotaSchema);
