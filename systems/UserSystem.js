// systems/UserSystem.js
import User from '../models/User.js';
import Counter from '../models/Counter.js';
import { getLevelFromEarned, today } from '../utils/helpers.js';

// ✅ متغير عالمي لحالة البوت
let BOT_PAUSED = false;

export default class UserSystem {
  constructor() {
    console.log('👤 UserSystem جاهز');
  }

  // ===================================
  // ✅ حالة البوت
  // ===================================
  isBotPaused() {
    return BOT_PAUSED;
  }

  setBotPaused(value) {
    BOT_PAUSED = value;
    console.log(`🤖 حالة البوت: ${value ? 'متوقف' : 'يعمل'}`);
  }

  // ===================================
  // توليد ID
  // ===================================
  async generateUserId() {
    const counter = await Counter.findOneAndUpdate(
      { _id: 'userId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const seq = counter.seq;
    const padLength = Math.max(3, seq.toString().length);
    return `M${String(seq).padStart(padLength, '0')}R`;
  }

  async getOrCreate(platformId, platform) {
    let user = await User.findOne({ platformId, platform });
    if (user) {
      user.lastActive = new Date();
      await user.save();
      return user;
    }

    let userId;
    const adminPlatformId = (process.env.ADMIN_PLATFORM_ID || '').trim();

    if (adminPlatformId && adminPlatformId === platformId) {
      const existing = await User.findOne({ userId: 'M000R' });
      userId = existing ? await this.generateUserId() : 'M000R';
    } else {
      const adminExists = await User.findOne({ userId: 'M000R' });
      if (!adminExists && !adminPlatformId) {
        const userCount = await User.countDocuments();
        userId = userCount === 0 ? 'M000R' : await this.generateUserId();
      } else {
        userId = await this.generateUserId();
      }
    }

    const isAdmin = userId === 'M000R';

    user = new User({
      userId,
      platformId,
      platform,
      isAdmin,
      referralCode: userId,
      registeredAt: new Date(),
      lastActive: new Date()
    });

    await user.save();

    if (isAdmin) {
      console.log(`✅ تم إنشاء الأدمن الرئيسي: ${userId} (${platform}:${platformId})`);
    } else {
      console.log(`✅ لاعب جديد: ${userId} (${platform}:${platformId})`);
    }

    return user;
  }

  async findByUserId(userId) {
    if (!userId) return null;
    return await User.findOne({ userId: userId.trim().toUpperCase() });
  }

  async findByIdentifier(input) {
    if (!input) return null;
    const clean = input.trim();

    let user = await User.findOne({ userId: clean.toUpperCase() });
    if (user) return user;

    if (/^\d+$/.test(clean)) {
      const padded = String(clean).padStart(3, '0');
      user = await User.findOne({ userId: `M${padded}R` });
      if (user) return user;
      user = await User.findOne({ userId: `M${clean}R` });
      if (user) return user;
    }

    const mMatch = clean.match(/^M(\d+)R$/i);
    if (mMatch) {
      const padded = String(mMatch[1]).padStart(3, '0');
      user = await User.findOne({ userId: `M${padded}R` });
      if (user) return user;
    }

    return null;
  }

  async updateLevel(user) {
    const newLevel = getLevelFromEarned(user.totalEarned);
    if (newLevel !== user.level) {
      user.level = newLevel;
      await user.save();
    }
    return user.level;
  }

  // ===================================
  // تجميد / فك تجميد
  // ===================================
  async freeze(userId, reason = 'تجميد إداري') {
    const user = await this.findByUserId(userId);
    if (!user) return { error: '❌ اللاعب غير موجود' };
    if (user.userId === 'M000R') return { error: '❌ لا يمكن تجميد الأدمن الرئيسي' };

    user.isFrozen = true;
    user.frozenReason = reason;
    user.frozenAt = new Date();
    user.lastFrozenNotice = null;
    await user.save();
    return { success: true, user };
  }

  async unfreeze(userId) {
    const user = await this.findByUserId(userId);
    if (!user) return { error: '❌ اللاعب غير موجود' };

    user.isFrozen = false;
    user.frozenReason = null;
    user.frozenAt = null;
    await user.save();
    return { success: true, user };
  }

  async deleteUser(userId) {
    const user = await this.findByUserId(userId);
    if (!user) return { error: '❌ اللاعب غير موجود' };
    if (user.userId === 'M000R') return { error: '❌ لا يمكن حذف الأدمن الرئيسي' };

    const deletedId = user.userId;
    await user.deleteOne();
    return { success: true, deletedId };
  }

  shouldNotifyFrozen(user) {
    if (!user.isFrozen) return false;
    const sessionGapMs = 30 * 60 * 1000;
    if (!user.lastFrozenNotice) return true;
    return (Date.now() - new Date(user.lastFrozenNotice).getTime()) > sessionGapMs;
  }

  async markFrozenNotified(user) {
    user.lastFrozenNotice = new Date();
    await user.save();
  }

  async getStats() {
    const totalUsers = await User.countDocuments();
    const frozen = await User.countDocuments({ isFrozen: true });
    const totalRio = await User.aggregate([
      { $group: { _id: null, sum: { $sum: '$rio' } } }
    ]);
    const totalEarned = await User.aggregate([
      { $group: { _id: null, sum: { $sum: '$totalEarned' } } }
    ]);

    return {
      totalUsers,
      frozen,
      totalRio: totalRio[0]?.sum || 0,
      totalEarned: totalEarned[0]?.sum || 0
    };
  }

  // ===================================
  // ✅ وضع الاختبار
  // ===================================
  async setTestMode(userId, enabled) {
    const user = await this.findByUserId(userId);
    if (!user) return { error: '❌ اللاعب غير موجود' };

    user.isTestMode = enabled;
    await user.save();

    return {
      success: true,
      message: enabled
        ? `🧪 تم تفعيل وضع الاختبار لـ ${user.userId}\n\n💡 يمكنه اللعب بلا حدود`
        : `✅ تم إلغاء وضع الاختبار لـ ${user.userId}`
    };
  }
}
