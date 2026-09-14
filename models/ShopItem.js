// models/ShopItem.js
import mongoose from 'mongoose';

const shopItemSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  price: { type: Number, required: true, min: 1 },
  quantity: { type: Number, default: -1 },  // -1 = لانهائي
  description: { type: String, default: '' },
  category: { type: String, enum: ['help', 'cosmetic', 'permanent'], default: 'help' },
  effect: { type: String, default: null },  // fifty_fifty, skip, retry, extra_question, extra_time, discount, etc
  value: { type: Number, default: 0 },      // قيمة التأثير
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('ShopItem', shopItemSchema);
