// models/Archive.js
import mongoose from 'mongoose';

const archiveSchema = new mongoose.Schema({
  archiveId: { type: String, required: true, unique: true },   // R1, R2, I1...
  letter: { type: String, required: true, index: true },        // R, I, O...
  index: { type: Number, required: true },                      // 1, 2, 3...
  fromId: { type: String, required: true },                     // R_000
  toId: { type: String, required: true },                       // R_099
  playerCount: { type: Number, default: 0 },
  activeCount: { type: Number, default: 0 },
  frozenCount: { type: Number, default: 0 },
  totalRio: { type: Number, default: 0 },
  topPlayerId: { type: String, default: null },                 // أعلى رصيد
  topRio: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

archiveSchema.index({ letter: 1, index: 1 });

export default mongoose.model('Archive', archiveSchema);
