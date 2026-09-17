// systems/PointsSystem.js
import User from '../models/User.js';
import TransactionLog from '../models/TransactionLog.js';
import { getLevelFromEarned, getLevelBonus, today } from '../utils/helpers.js';

export default class PointsSystem {
  constructor() {
    console.log('💰 PointsSystem جاهز');
  }

  // ===================================
  // إضافة ريو (مع تسجيل إذا كان من أدمن)
  // ===================================
  async addRio(user, amount) {
    if (amount <= 0) return user;
    user.rio += amount;
    user.totalEarned += amount;
    user.level = getLevelFromEarned(user.totalEarned);
    await user.save();
    return user;
  }

  // ✅ إضافة من أدمن (مع سبب)
  async adminAddRio(admin, targetUser, amount, reason) {
    if (amount <= 0) {
      return { error: '❌ الكمية يجب أن تكون أكبر من 0' };
    }

    const reasonKey = this.extractReasonKey(reason);
    const todayStr = today();

    // ✅ فحص التكرار
    const existing = await TransactionLog.findOne({
      targetId: targetUser.userId,
      reasonKey,
      date: todayStr,
      action: 'add'
    });

    if (existing) {
      const todayLogs = await TransactionLog.find({
        targetId: targetUser.userId,
        date: todayStr,
        action: 'add'
      }).sort({ timestamp: 1 });

      let msg = `⚠️ تمت إضافة رصيد لـ ${targetUser.userId} اليوم\n`;
      msg += `بنفس السبب: "${reason}"\n\n`;
      msg += `📅 الأسباب المسجلة اليوم:\n`;
      todayLogs.forEach(log => {
        const time = new Date(log.timestamp).toLocaleTimeString('ar-EG', {
          hour: '2-digit', minute: '2-digit'
        });
        msg += `• ${log.reason} (${time})\n`;
      });
      return { error: msg };
    }

    // ✅ إضافة الرصيد
    await this.addRio(targetUser, amount);

    // ✅ تسجيل في السجل
    await TransactionLog.create({
      adminId: admin.userId,
      targetId: targetUser.userId,
      action: 'add',
      amount,
      reason,
      reasonKey,
      date: todayStr,
      timestamp: new Date()
    });

    return {
      success: true,
      message: `✅ تمت إضافة ${amount} ريو\n\n👤 ${targetUser.userId}\n💰 رصيده: ${targetUser.rio}\n📝 السبب: ${reason}`
    };
  }

  // ===================================
  // خصم ريو (من أدمن)
  // ===================================
  async adminRemoveRio(admin, targetUser, amount, reason) {
    if (amount <= 0) {
      return { error: '❌ الكمية يجب أن تكون أكبر من 0' };
    }

    if (targetUser.rio < amount) {
      return {
        error: `❌ رصيد اللاعب غير كافٍ\n\n💰 رصيده: ${targetUser.rio}\n💵 المطلوب: ${amount}`
      };
    }

    // ✅ خصم
    targetUser.rio -= amount;
    // ⚠️ totalEarned لا ينقص (المستوى ثابت)
    await targetUser.save();

    // ✅ تسجيل
    const todayStr = today();
    await TransactionLog.create({
      adminId: admin.userId,
      targetId: targetUser.userId,
      action: 'remove',
      amount,
      reason,
      reasonKey: this.extractReasonKey(reason),
      date: todayStr,
      timestamp: new Date()
    });

    return {
      success: true,
      message: `✅ تم خصم ${amount} ريو\n\n👤 ${targetUser.userId}\n💰 رصيده: ${targetUser.rio}\n📝 السبب: ${reason}`
    };
  }

  // ===================================
  // خصم ريو (عادي — للشراء من السوق)
  // ===================================
  async spendRio(user, amount) {
    if (amount <= 0 || user.rio < amount) return { success: false };
    user.rio -= amount;
    await user.save();
    return { success: true, user };
  }

  async setRio(user, amount) {
    user.rio = Math.max(0, amount);
    await user.save();
    return user;
  }

  // ===================================
  // استخراج المفتاح من السبب
  // ===================================
  extractReasonKey(reason) {
    if (!reason) return 'غير محدد';
    const clean = reason.trim().toLowerCase();

    // ✅ أسباب معروفة
    if (clean.includes('حجر') || clean.includes('ورقة') || clean.includes('مقص')) {
      return 'لعب_حجر_ورقة_مقص';
    }
    if (clean.includes('ترتيب')) return 'لعب_ترتيب_الحروف';
    if (clean.includes('اسئلة') || clean.includes('أسئلة')) return 'لعب_اسئلة';
    if (clean.includes('سرعة') || clean.includes('رياضيات')) return 'لعب_سرعة_البديهة';
    if (clean.includes('صح') || clean.includes('خطأ')) return 'لعب_صح_أم_خطأ';
    if (clean.includes('تخمين')) return 'لعب_تخمين_الرقم';
    if (clean.includes('كلمة') || clean.includes('مخفية')) return 'لعب_الكلمة_المخفية';
    if (clean.includes('مثل')) return 'لعب_أكمل_المثل';
    if (clean.includes('معلومات')) return 'لعب_معلومات_عامة';
    if (clean.includes('هدية')) return 'هدية_يومية';
    if (clean.includes('فاز') || clean.includes('فعالية')) return 'فاز_بفعالية';
    if (clean.includes('مكافأة')) return 'مكافأة';
    if (clean.includes('اشتر') || clean.includes('شراء')) {
      // استخراج اسم المنتج
      const match = clean.match(/(?:اشتر[ىي]?|شراء)\s+(.+)/);
      return match ? `اشترى_${match[1].trim().replace(/\s+/g, '_')}` : 'اشترى_منتج';
    }

    // ✅ المفتاح = السبب كما هو (مختصر)
    return clean.replace(/\s+/g, '_').substring(0, 50);
  }

  // ===================================
  // البونص والمستوى
  // ===================================
  getBonus(user) {
    return getLevelBonus(user.level);
  }

  async getProfile(user) {
    const bonus = this.getBonus(user);
    return {
      userId: user.userId,
      rio: user.rio,
      level: user.level,
      totalEarned: user.totalEarned,
      streak: user.streak,
      gamesPlayed: user.totalGamesPlayed || 0,
      gamesWon: user.totalGamesWon || 0,
      achievements: user.achievements.length,
      referralCount: user.referralCount,
      bonusTime: bonus.time,
      bonusDiscount: bonus.discount + (user.permanentPerks?.extraDiscount || 0),
      title: bonus.title
    };
  }

  // ===================================
  // سجل العمليات
  // ===================================
  async getTransactionLog(page = 1, filter = {}) {
    const perPage = 20;
    const query = { ...filter };

    const total = await TransactionLog.countDocuments(query);
    const totalPages = Math.ceil(total / perPage);

    const logs = await TransactionLog.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage);

    return {
      logs,
      page,
      totalPages,
      total,
      perPage
    };
  }
}
