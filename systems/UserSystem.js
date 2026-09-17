// systems/UserSystem.js
import User from '../models/User.js';
import Counter from '../models/Counter.js';
import { getLevelFromEarned, today } from '../utils/helpers.js';

// ✅ حالة البوت
let BOT_PAUSED = false;

// ✅ ترتيب الحروف
const LETTERS = ['R', 'I', 'O', 'P', 'Q', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
                 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N'];

export default class UserSystem {
  constructor() {
    console.log('👤 UserSystem جاهز');
  }

  // ===================================
  // حالة البوت
  // ===================================
  isBotPaused() {
    return BOT_PAUSED;
  }

  setBotPaused(value) {
    BOT_PAUSED = value;
    console.log(`🤖 حالة البوت: ${value ? 'متوقف' : 'يعمل'}`);
  }

  // ===================================
  // توليد ID الجديد (R_000 → R_999 → I_000 ...)
  // ===================================
  async generateUserId() {
    let counter = await Counter.findOne({ _id: 'userId' });

    if (!counter) {
      counter = await Counter.create({ _id: 'userId', letter: 'R', seq: 0 });
      return 'R_000';
    }

    // ✅ زيادة الرقم
    counter.seq += 1;

    // ✅ إذا وصل 1000 → ننتقل للحرف التالي
    if (counter.seq > 999) {
      const currentIdx = LETTERS.indexOf(counter.letter);
      if (currentIdx === -1) {
        throw new Error('انتهت الحروف المتاحة');
      }

      const nextIdx = currentIdx + 1;
      if (nextIdx >= LETTERS.length) {
        throw new Error('تم الوصول للحد الأقصى من اللاعبين (26,000)');
      }

      counter.letter = LETTERS[nextIdx];
      counter.seq = 0;
    }

    await counter.save();

    const padded = String(counter.seq).padStart(3, '0');
    return `${counter.letter}_${padded}`;
  }

  // ===================================
  // إنشاء / جلب لاعب
  // ===================================
  async getOrCreate(platformId, platform) {
    let user = await User.findOne({ platformId, platform });
    if (user) {
      user.lastActive = new Date();
      await user.save();
      return user;
    }

    let userId;
    const rootAdminPlatformId = (process.env.ADMIN_PLATFORM_ID || '').trim();

    // ✅ هل هذا هو الأدمن الرئيسي؟
    const isRootAdmin = rootAdminPlatformId && rootAdminPlatformId === platformId;

    if (isRootAdmin) {
      // البحث عن R_000
      const rootExists = await User.findOne({ userId: 'R_000' });
      userId = rootExists ? await this.generateUserId() : 'R_000';
    } else {
      // ✅ هل R_000 موجود؟
      const rootExists = await User.findOne({ userId: 'R_000' });
      if (!rootExists && !rootAdminPlatformId) {
        // أول لاعب = الأدمن الرئيسي
        const userCount = await User.countDocuments();
        userId = userCount === 0 ? 'R_000' : await this.generateUserId();
      } else {
        userId = await this.generateUserId();
      }
    }

    const isNewRootAdmin = userId === 'R_000';

    user = new User({
      userId,
      platformId,
      platform,
      isRootAdmin: isNewRootAdmin,
      isMainAdmin: false,
      isAdmin: false,
      referralCode: userId,
      registeredAt: new Date(),
      lastActive: new Date()
    });

    await user.save();

    if (isNewRootAdmin) {
      console.log(`✅ تم إنشاء الأدمن الرئيسي: ${userId} (${platform}:${platformId})`);
    } else {
      console.log(`✅ لاعب جديد: ${userId} (${platform}:${platformId})`);
    }

    return user;
  }

  // ===================================
  // البحث
  // ===================================
  async findByUserId(userId) {
    if (!userId) return null;
    const clean = userId.trim().toUpperCase().replace(/-/g, '_');

    // ✅ إذا كان بالصيغة R_001
    if (/^[A-Z]_\d+$/.test(clean)) {
      return await User.findOne({ userId: clean });
    }

    // ✅ إذا كان بالصيغة R001
    const compactMatch = clean.match(/^([A-Z])(\d+)$/);
    if (compactMatch) {
      const letter = compactMatch[1];
      const num = String(compactMatch[2]).padStart(3, '0');
      return await User.findOne({ userId: `${letter}_${num}` });
    }

    return null;
  }

  // ✅ بحث ذكي
  async findByIdentifier(input) {
    if (!input) return null;
    const clean = input.trim().toUpperCase().replace(/-/g, '_');

    // R_001
    if (/^[A-Z]_\d+$/.test(clean)) {
      let user = await User.findOne({ userId: clean });
      if (user) return user;

      // جرّب padding
      const [letter, num] = clean.split('_');
      const padded = num.padStart(3, '0');
      user = await User.findOne({ userId: `${letter}_${padded}` });
      if (user) return user;
      return null;
    }

    // R001
    const compactMatch = clean.match(/^([A-Z])(\d+)$/);
    if (compactMatch) {
      const letter = compactMatch[1];
      const num = String(compactMatch[2]).padStart(3, '0');
      return await User.findOne({ userId: `${letter}_${num}` });
    }

    // أرقام فقط → نحتاج الحرف
    if (/^\d+$/.test(clean)) {
      return { needsLetter: true, number: clean };
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
  // الصلاحيات
  // ===================================
  isRootAdmin(user) {
    return user?.isRootAdmin === true || user?.userId === 'R_000';
  }

  isMainAdmin(user) {
    return this.isRootAdmin(user) || user?.isMainAdmin === true;
  }

  isAnyAdmin(user) {
    return this.isMainAdmin(user) || user?.isAdmin === true;
  }

  // ===================================
  // تجميد / فك تجميد
  // ===================================
  async freeze(userId, reason = 'تجميد إداري') {
    const user = await this.findByUserId(userId);
    if (!user) return { error: '❌ اللاعب غير موجود' };
    if (user.userId === 'R_000') return { error: '❌ لا يمكن تجميد الأدمن الرئيسي' };
    if (user.isRootAdmin) return { error: '❌ لا يمكن تجميد الأدمن الرئيسي' };

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
    if (user.userId === 'R_000') return { error: '❌ لا يمكن حذف الأدمن الرئيسي' };
    if (user.isRootAdmin) return { error: '❌ لا يمكن حذف الأدمن الرئيسي' };

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

  // ===================================
  // إحصائيات
  // ===================================
  async getStats() {
    const totalUsers = await User.countDocuments();
    const frozen = await User.countDocuments({ isFrozen: true });
    const admins = await User.countDocuments({ isAdmin: true });
    const mainAdmins = await User.countDocuments({ isMainAdmin: true });

    const totalRio = await User.aggregate([
      { $group: { _id: null, sum: { $sum: '$rio' } } }
    ]);
    const totalEarned = await User.aggregate([
      { $group: { _id: null, sum: { $sum: '$totalEarned' } } }
    ]);

    return {
      totalUsers,
      frozen,
      admins,
      mainAdmins,
      totalRio: totalRio[0]?.sum || 0,
      totalEarned: totalEarned[0]?.sum || 0
    };
  }

  // ===================================
  // وضع الاختبار
  // ===================================
  async setTestMode(userId, enabled) {
    const user = await this.findByUserId(userId);
    if (!user) return { error: '❌ اللاعب غير موجود' };

    user.isTestMode = enabled;
    await user.save();

    return {
      success: true,
      message: enabled
        ? `🧪 تم تفعيل وضع الاختبار لـ ${user.userId}`
        : `✅ تم إلغاء وضع الاختبار لـ ${user.userId}`
    };
  }

  // ===================================
  // منح / إزالة صلاحيات
  // ===================================
  async promoteToAdmin(userId) {
    const user = await this.findByUserId(userId);
    if (!user) return { error: '❌ اللاعب غير موجود' };
    if (user.isRootAdmin || user.isMainAdmin) {
      return { error: '❌ هو أدمن بالفعل' };
    }
    if (user.isAdmin) return { error: '❌ هو أدمن مساعد بالفعل' };

    user.isAdmin = true;
    await user.save();
    return {
      success: true,
      message: `👑 تم منح ${user.userId} صلاحيات أدمن مساعد\n\n💡 أوامره: كل شيء ما عدا سجل، خصم، تجميد، حذف`
    };
  }

  async promoteToMainAdmin(userId) {
    const user = await this.findByUserId(userId);
    if (!user) return { error: '❌ اللاعب غير موجود' };
    if (user.isRootAdmin) return { error: '❌ لا يمكن ترقية الأدمن الرئيسي' };
    if (user.isMainAdmin) return { error: '❌ هو أدمن رئيسي بالفعل' };

    user.isMainAdmin = true;
    user.isAdmin = false;  // رفع المستوى
    await user.save();
    return {
      success: true,
      message: `🔴 تم منح ${user.userId} صلاحيات أدمن رئيسي\n\n💡 كل الصلاحيات (ما عدا حذف R_000)`
    };
  }

  async demoteAdmin(userId) {
    const user = await this.findByUserId(userId);
    if (!user) return { error: '❌ اللاعب غير موجود' };
    if (user.isRootAdmin) return { error: '❌ لا يمكن إزالة الأدمن الرئيسي' };

    user.isAdmin = false;
    user.isMainAdmin = false;
    await user.save();
    return {
      success: true,
      message: `✅ تم إزالة صلاحيات ${user.userId}`
    };
  }
  }
