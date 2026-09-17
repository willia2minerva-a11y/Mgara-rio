// systems/PointsSystem.js
import User from '../models/User.js';
import TransactionLog from '../models/TransactionLog.js';
import { getLevelFromEarned, getLevelBonus, today } from '../utils/helpers.js';

export default class PointsSystem {
  constructor() {
    console.log('💰 PointsSystem جاهز');
  }

  // ===================================
  // إضافة ريو (عادي — بدون سبب)
  // ===================================
  async addRio(user, amount) {
    if (amount <= 0) return user;
    user.rio += amount;
    user.totalEarned += amount;
    user.level = getLevelFromEarned(user.totalEarned);
    await user.save();
    return user;
  }

  // ===================================
  // ✅ إضافة من أدمن (مع سبب + ربط بالمهام)
  // ===================================
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

    // ===================================
    // ✅ ربط السبب بالمهام
    // ===================================
    let completedMissions = [];
    try {
      completedMissions = await this._updateMissions(targetUser, reasonKey);
    } catch (e) {
      console.error('⚠️ فشل تحديث المهام:', e.message);
    }

    // ✅ بناء الرسالة
    let msg = `✅ تمت إضافة ${amount} ريو\n\n`;
    msg += `👤 ${targetUser.userId}\n`;
    msg += `💰 رصيده: ${targetUser.rio}\n`;
    msg += `📝 السبب: ${reason}`;

    if (completedMissions.length > 0) {
      msg += `\n\n🎉 مهمة مكتملة: ${completedMissions[0].name} (+${completedMissions[0].reward} ريو)`;
    }

    return { success: true, message: msg };
  }

  // ===================================
  // ✅ خصم من أدمن (مع سبب + ربط بالمهام)
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

    targetUser.rio -= amount;
    await targetUser.save();

    const todayStr = today();
    const reasonKey = this.extractReasonKey(reason);

    await TransactionLog.create({
      adminId: admin.userId,
      targetId: targetUser.userId,
      action: 'remove',
      amount,
      reason,
      reasonKey,
      date: todayStr,
      timestamp: new Date()
    });

    // ===================================
    // ✅ ربط الشراء بالمهام
    // ===================================
    let completedMissions = [];
    try {
      completedMissions = await this._updateMissions(targetUser, reasonKey);
    } catch (e) {
      console.error('⚠️ فشل تحديث المهام:', e.message);
    }

    let msg = `✅ تم خصم ${amount} ريو\n\n`;
    msg += `👤 ${targetUser.userId}\n`;
    msg += `💰 رصيده: ${targetUser.rio}\n`;
    msg += `📝 السبب: ${reason}`;

    if (completedMissions.length > 0) {
      msg += `\n\n🎉 مهمة مكتملة: ${completedMissions[0].name} (+${completedMissions[0].reward} ريو)`;
    }

    return { success: true, message: msg };
  }

  // ===================================
  // ✅ تحديث المهام حسب السبب
  // ===================================
  async _updateMissions(user, reasonKey) {
    const WeeklyMissions = (await import('./WeeklyMissions.js')).default;
    const missions = new WeeklyMissions(this);
    await missions.ensureWeek(user);

    const key = reasonKey.toLowerCase();
    let missionField = null;

    // ✅ ألعاب (لعب)
    const gameKeys = ['لعب_حجر', 'لعب_ترتيب', 'لعب_اسئلة', 'لعب_سرعة',
                      'لعب_صح', 'لعب_تخمين', 'لعب_الكلمة', 'لعب_أكمل', 'لعب_معلومات'];
    if (gameKeys.some(g => key.startsWith(g) || key.includes(g))) {
      missionField = 'gamesPlayed';
    }

    // ✅ فاز بفعالية → يزيد العب
    else if (key.includes('فاز') || key.includes('فعالية')) {
      missionField = 'gamesWon';
    }

    // ✅ إحالة
    else if (key.includes('صديق') || key.includes('احالة') || key.includes('إحالة')) {
      missionField = 'referrals';
    }

    // ✅ شراء
    else if (key.startsWith('اشتر') || key.includes('اشترى')) {
      missionField = 'purchases';
    }

    // ✅ هدية
    else if (key.includes('هدية')) {
      missionField = 'gifts';
    }

    if (!missionField) return [];

    await missions.track(user, missionField);
    const completed = await missions.check(user);
    return completed || [];
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

    // ✅ أسباب الألعاب (فحص دقيق)
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

    // ✅ هدية
    if (clean.includes('هدية')) return 'هدية_يومية';

    // ✅ فعالية
    if (clean.includes('فاز') || clean.includes('فعالية')) return 'فاز_بفعالية';

    // ✅ مكافأة
    if (clean.includes('مكافأة')) return 'مكافأة';

    // ✅ إحالة
    if (clean.includes('صديق') || clean.includes('احالة') || clean.includes('إحالة')) {
      return 'إحالة_صديق';
    }

    // ✅ شراء
    if (clean.includes('اشتر') || clean.includes('شراء')) {
      const match = clean.match(/(?:اشتر[ىي]?|شراء)\s+(.+)/);
      return match ? `اشترى_${match[1].trim().replace(/\s+/g, '_')}` : 'اشترى_منتج';
    }

    // ✅ المفتاح = السبب كما هو
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
