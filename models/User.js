// models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // الهوية
  userId: { type: String, required: true, unique: true, index: true },
  platformId: { type: String, required: true, index: true },
  platform: { type: String, enum: ['facebook', 'telegram'], required: true },
  isAdmin: { type: Boolean, default: false },

  // العملة والمستوى
  rio: { type: Number, default: 0, min: 0 },          // الرصيد الحالي
  totalEarned: { type: Number, default: 0, min: 0 },  // إجمالي ما جمعه (للمستوى)
  level: { type: Number, default: 1, min: 1 },

  // Streak الهدية
  streak: { type: Number, default: 0 },
  lastGiftDate: { type: String, default: null },

  // الحالة
  isFrozen: { type: Boolean, default: false },
  frozenReason: { type: String, default: null },
  frozenAt: { type: Date, default: null },
  lastFrozenNotice: { type: Date, default: null },

  // إحصائيات
  gamesPlayed: { type: Number, default: 0 },
  gamesWon: { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 0 },
  dailyChallengesDone: { type: Number, default: 0 },

  // الشارات
  achievements: { type: [String], default: [] },

  // المشتريات
  purchases: [{
    item: String,
    price: Number,
    date: { type: Date, default: Date.now }
  }],

  // الميزات الدائمة
  permanentPerks: {
    extraTime: { type: Number, default: 0 },
    extraDiscount: { type: Number, default: 0 },
    extraGift: { type: Number, default: 0 },
    freeSkip: { type: Boolean, default: false }
  },

  // المساعدات (inventory)
  inventory: {
    fifty_fifty: { type: Number, default: 0 },
    skip: { type: Number, default: 0 },
    extra_question: { type: Number, default: 0 },
    retry: { type: Number, default: 0 }
  },

  // الإحالة
  referralCode: { type: String, default: null },
  referredBy: { type: String, default: null },
  referralCount: { type: Number, default: 0 },
  referralRewardsToday: { type: Number, default: 0 },
  lastReferralDate: { type: String, default: null },

  // المهام الأسبوعية
  weeklyMissions: {
    weekStart: { type: String, default: null },
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    purchases: { type: Number, default: 0 },
    gifts: { type: Number, default: 0 },
    referrals: { type: Number, default: 0 },
    completed: { type: [String], default: [] }
  },
  
  lastGameDate: { type: String, default: null },
  // التحدي اليومي
  lastDailyChallenge: { type: String, default: null },

  // التواريخ
  registeredAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
}, { timestamps: true });

userSchema.index({ platformId: 1, platform: 1 }, { unique: true });
userSchema.index({ totalEarned: -1 });
userSchema.index({ rio: -1 });

export default mongoose.model('User', userSchema);
