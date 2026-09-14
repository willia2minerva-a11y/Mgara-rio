// models/ActiveGame.js
import mongoose from 'mongoose';

const activeGameSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  questionIndex: { type: Number, default: 1 },  // 1-5
  score: { type: Number, default: 0 },
  currentQuestion: {
    text: String,
    options: [String],
    correctIndex: Number,
    sentAt: { type: Date, default: Date.now }
  },
  usedFiftyFifty: { type: Boolean, default: false },
  usedSkip: { type: Boolean, default: false },
  usedRetry: { type: Boolean, default: false },
  startedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// TTL: حذف تلقائي بعد ساعة
activeGameSchema.index({ startedAt: 1 }, { expireAfterSeconds: 3600 });

export default mongoose.model('ActiveGame', activeGameSchema);
