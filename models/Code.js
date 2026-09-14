// models/Code.js
import mongoose from 'mongoose';

const codeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  rio: { type: Number, required: true, min: 1 },
  maxUses: { type: Number, required: true, min: 1 },
  usedCount: { type: Number, default: 0 },
  usedBy: { type: [String], default: [] },
  active: { type: Boolean, default: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Code', codeSchema);
