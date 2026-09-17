// models/Counter.js
import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  letter: { type: String, default: 'R' },  // الحرف الحالي
  seq: { type: Number, default: 0 }         // آخر رقم
});

export default mongoose.model('Counter', counterSchema);
