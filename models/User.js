// models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // ===================================
  // الهوية
  // ===================================
  userId: { type: String, required: true, unique: true, index: true },
  platformId: { type: String, required: true, index: true },
  platform: { type: String, enum: ['facebook', 'telegram'], required: true },

  // ✅ الصلاحيات
  isAdmin: { type: Boolean, default: false },           // أدمن مساعد
  isMainAdmin: { type: Boolean, default: false },       // أدمن رئيسي
  isRootAdmin: { type: Boolean, default: false },       // R_000 (محدد من ENV)

  // ===================================
  // العملة والمستوى
  // ===================================
  rio: { type: Number, default: 0, min: 0 },
  totalEarned: { type: Number, default: 0, min: 0 },
  level: { type: Number, default: 1, min: 1 },

  // ===================================
  // Streak والهدية
  // ===================================
  streak: { type: Number, default: 0 },
  lastGiftDate: { type: String, default: null },

  // ===================================
  // الألعاب
  // ===================================
  gamesPlayedToday: {
    type: Map,
    of: String,
    default: {}
  },
  lastGameDate: { type: String, default: null },

  unlockedGames: { type: [String], default: [] },
  gameSessions: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },

  // ===================================
  // الاسم والديكور
  // ===================================
  customName: { type: String, default: null },
  customNameApproved: { type: Boolean, default: false },
  displayedBadge: { type: String, default: null },
  ownedBadges: { type: [String], default: [] },

  // ===================================
  // الحالة
  // ===================================
  isFrozen: { type: Boolean, default: false },
  frozenReason: { type: String, default: null },
  frozenAt: { type: Date, default: null },
  lastFrozenNotice: { type: Date, default: null },

  // ===================================
  // الإحصائيات
  // ===================================
  totalGamesPlayed: { type: Number, default: 0 },
  totalGamesWon: { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 0 },
  totalChallengesDone: { type: Number, default: 0 },

  isTestMode: { type: Boolean, default: false },
  gameStats: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },

  // ===================================
  // الشارات
  // ===================================
  achievements: { type: [String], default: [] },

  // ===================================
  // المشتريات
  // ===================================
  purchases: [{
    item: String,
    price: Number,
    date: { type: Date, default: Date.now }
  }],

  // ===================================
  // الميزات الدائمة
  // ===================================
  permanentPerks: {
    extraTime: { type: Number, default: 0 },
    extraDiscount: { type: Number, default: 0 },
    extraGift: { type: Number, default: 0 },
    freeSkip: { type: Boolean, default: false },
    extraQuestion: { type: Number, default: 0 }
  },

  permanentItems: { type: [String], default: [] },

  // ===================================
  // المساعدات
  // ===================================
  inventory: {
    fifty_fifty: { type: Number, default: 0 },
    skip: { type: Number, default: 0 },
    retry: { type: Number, default: 0 }
  },

  // ===================================
  // الإحالة
  // ===================================
  referralCode: { type: String, default: null },
  referredBy: { type: String, default: null },
  referralCount: { type: Number, default: 0 },
  referralRewardsToday: { type: Number, default: 0 },
  lastReferralDate: { type: String, default: null },

  // ===================================
  // المهام الأسبوعية
  // ===================================
  weeklyMissions: {
    weekStart: { type: String, default: null },
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    purchases: { type: Number, default: 0 },
    gifts: { type: Number, default: 0 },
    referrals: { type: Number, default: 0 },
    completed: { type: [String], default: [] }
  },

  // ===================================
  // التواريخ
  // ===================================
  registeredAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
}, { timestamps: true });

userSchema.index({ platformId: 1, platform: 1 }, { unique: true });
userSchema.index({ totalEarned: -1 });
userSchema.index({ rio: -1 });
userSchema.index({ isAdmin: 1 });
userSchema.index({ isMainAdmin: 1 });

export default mongoose.model('User', userSchema);
