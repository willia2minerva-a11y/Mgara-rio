// models/ShopItem.js
import mongoose from 'mongoose';

const shopItemSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  price: { type: Number, required: true, min: 1 },
  quantity: { type: Number, default: -1 },
  description: { type: String, default: '' },
  category: {
    type: String,
    enum: ['help', 'cosmetic', 'permanent', 'external', 'wheel'],
    default: 'external'
  },
  effect: { type: String, default: null },
  value: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  wheelPrizes: { type: Array, default: null },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('ShopItem', shopItemSchema);
