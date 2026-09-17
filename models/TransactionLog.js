// models/TransactionLog.js
import mongoose from 'mongoose';

const transactionLogSchema = new mongoose.Schema({
  adminId: { type: String, required: true, index: true },
  targetId: { type: String, required: true, index: true },
  action: {
    type: String,
    enum: ['add', 'remove', 'freeze', 'unfreeze', 'delete', 'promote', 'demote'],
    required: true
  },
  amount: { type: Number, default: 0 },
  reason: { type: String, required: true },
  reasonKey: { type: String, required: true },   // كلمة مفتاحية لسهولة البحث
  date: { type: String, required: true, index: true },   // YYYY-MM-DD
  timestamp: { type: Date, default: Date.now }
});

// ✅ فهرس مركّب لمنع التكرار
transactionLogSchema.index(
  { targetId: 1, reasonKey: 1, date: 1 },
  { unique: true, partialFilterExpression: { action: 'add' } }
);

// TTL: حذف تلقائي بعد 90 يوم
transactionLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model('TransactionLog', transactionLogSchema);
