// systems/AdminSystem.js
import User from '../models/User.js';
import TransactionLog from '../models/TransactionLog.js';
import { today, normalizeArabic } from '../utils/helpers.js';

export default class AdminSystem {
  constructor({ userSystem, pointsSystem, shopSystem, codeSystem }) {
    this.userSystem = userSystem;
    this.points = pointsSystem;
    this.shop = shopSystem;
    this.codes = codeSystem;
    console.log('👑 AdminSystem جاهز');
  }

  // ===================================
  // فحوصات الصلاحيات
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
  // تسجيل العمليات
  // ===================================
  async log(adminId, action, targetId, details = {}) {
    try {
      if (details.reason) {
        await TransactionLog.create({
          adminId,
          targetId,
          action,
          amount: details.amount || 0,
          reason: details.reason,
          reasonKey: this.points.extractReasonKey(details.reason),
          date: today(),
          timestamp: new Date()
        });
      }
    } catch (e) {
      console.error('⚠️ فشل تسجيل العملية:', e.message);
    }
  }

  // ===================================
  // ✅ إضافة نقاط (كل الأدمن)
  // ===================================
  async addPoints(admin, args) {
    if (args.length < 3) {
      return `⚠️ نسيان السبب

📝 الطريقة الصحيحة:
اضف_نقاط [ID] [الكمية] [السبب]

مثال:
اضف_نقاط R_001 3 لعب حجر ورقة مقص

💡 السبب مطلوب لمنع التكرار`;
    }

    const targetId = args[0];
    const amount = parseInt(args[1]);
    const reason = args.slice(2).join(' ');

    if (isNaN(amount) || amount <= 0) {
      return `❌ كمية غير صالحة: ${args[1]}

💡 اكتب رقماً موجباً
مثال: اضف_نقاط R_001 3 لعب حجر`;
    }

    const target = await this.userSystem.findByIdentifier(targetId);

    // ✅ إذا أراد البوت معرفة الحرف
    if (target && target.needsLetter) {
      return `⚠️ لم تحدد الحرف

الرقم: ${target.number}

الصيغ المتاحة:
• R_${target.number.padStart(3, '0')}
• I_${target.number.padStart(3, '0')}
• O_${target.number.padStart(3, '0')}

💡 اكتب: اضف_نقاط R_${target.number.padStart(3, '0')} ${amount} ${reason}`;
    }

    if (!target) {
      return `❌ اللاعب غير موجود: ${targetId}

📋 صيغ ID الصحيحة:
• R_001 / R001 / R-001
• I_001 / I001 / I-001

💡 لمعرفة ID:
• اكتب: عرض_اللاعبين`;
    }

    if (target.isFrozen) {
      return `⚠️ اللاعب مجمد

👤 ${target.userId}
❄️ السبب: ${target.frozenReason}

💡 لفك التجميد: فك_تجميد ${target.userId}`;
    }

    const result = await this.points.adminAddRio(admin, target, amount, reason);
    return result.error || result.message;
  }

  // ===================================
  // ✅ خصم نقاط (أدمن رئيسي فقط)
  // ===================================
  async removePoints(admin, args) {
    if (!this.isMainAdmin(admin)) {
      return null; // صمت
    }

    if (args.length < 3) {
      return `⚠️ نسيان السبب

📝 الطريقة الصحيحة:
خصم_نقاط [ID] [الكمية] [السبب]

مثال:
خصم_نقاط R_001 5 اشترى تصميم أنمي`;
    }

    const targetId = args[0];
    const amount = parseInt(args[1]);
    const reason = args.slice(2).join(' ');

    if (isNaN(amount) || amount <= 0) {
      return `❌ كمية غير صالحة: ${args[1]}`;
    }

    const target = await this.userSystem.findByIdentifier(targetId);

    if (target && target.needsLetter) {
      return `⚠️ لم تحدد الحرف

الصيغ:
• R_${target.number.padStart(3, '0')}
• I_${target.number.padStart(3, '0')}`;
    }

    if (!target) {
      return `❌ اللاعب غير موجود: ${targetId}`;
    }

    // ✅ التعرف على المنتج إذا السبب "اشترى..."
    let finalReason = reason;
    if (normalizeArabic(reason).includes('اشتر')) {
      const productMatch = await this._findProductInReason(reason);
      if (productMatch) {
        finalReason = `اشترى ${productMatch.name.replace(/_/g, ' ')}`;
      }
    }

    const result = await this.points.adminRemoveRio(admin, target, amount, finalReason);
    return result.error || result.message;
  }

  // ===================================
  // ✅ البحث عن منتج في السبب
  // ===================================
  async _findProductInReason(reason) {
    try {
      const ShopItem = (await import('../models/ShopItem.js')).default;
      const items = await ShopItem.find({ active: true });
      const normalized = normalizeArabic(reason);

      for (const item of items) {
        const itemName = normalizeArabic(item.name.replace(/_/g, ' '));
        if (normalized.includes(itemName)) {
          return item;
        }
      }

      // بحث جزئي
      for (const item of items) {
        const words = item.name.replace(/_/g, ' ').split(/\s+/);
        if (words.some(w => w.length >= 3 && normalized.includes(normalizeArabic(w)))) {
          return item;
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  // ===================================
  // ✅ تجميد
  // ===================================
  async freeze(admin, args) {
    if (!this.isMainAdmin(admin)) return null;

    if (args.length < 2) {
      return `⚠️ نسيان السبب

📝 الطريقة:
تجميد [ID] [السبب]

مثال:
تجميد R_001 محاولة غش`;
    }

    const targetId = args[0];
    const reason = args.slice(1).join(' ');

    const target = await this.userSystem.findByIdentifier(targetId);

    if (target && target.needsLetter) {
      return `⚠️ لم تحدد الحرف

الصيغ:
• R_${target.number.padStart(3, '0')}
• I_${target.number.padStart(3, '0')}`;
    }

    if (!target) return `❌ اللاعب غير موجود: ${targetId}`;

    const result = await this.userSystem.freeze(targetId, reason);
    if (result.error) return result.error;

    await this.log(admin.userId, 'freeze', target.userId, { reason });

    return `❄️ تم تجميد ${target.userId}\n📝 السبب: ${reason}`;
  }

  // ===================================
  // ✅ فك التجميد
  // ===================================
  async unfreeze(admin, args) {
    if (!this.isMainAdmin(admin)) return null;

    if (args.length < 1) {
      return `❌ الاستخدام: فك_تجميد [ID]

مثال:
فك_تجميد R_001`;
    }

    const targetId = args[0];
    const target = await this.userSystem.findByIdentifier(targetId);

    if (target && target.needsLetter) {
      return `⚠️ لم تحدد الحرف`;
    }

    if (!target) return `❌ اللاعب غير موجود: ${targetId}`;

    const result = await this.userSystem.unfreeze(targetId);
    if (result.error) return result.error;

    await this.log(admin.userId, 'unfreeze', target.userId, { reason: 'فك التجميد' });

    return `✅ تم فك تجميد ${target.userId}`;
  }

  // ===================================
  // ✅ حذف
  // ===================================
  async deleteUser(admin, args) {
    if (!this.isMainAdmin(admin)) return null;

    if (args.length < 1) {
      return `❌ الاستخدام: حذف [ID]

⚠️ تحذير: الحذف نهائي!
مثال:
حذف R_001`;
    }

    const targetId = args[0];
    const target = await this.userSystem.findByIdentifier(targetId);

    if (target && target.needsLetter) {
      return `⚠️ لم تحدد الحرف`;
    }

    if (!target) return `❌ اللاعب غير موجود: ${targetId}`;

    if (target.userId === 'R_000' || target.isRootAdmin) {
      return `❌ لا يمكن حذف الأدمن الرئيسي`;
    }

    const oldId = target.userId;
    const result = await this.userSystem.deleteUser(targetId);
    if (result.error) return result.error;

    await this.log(admin.userId, 'delete', oldId, { reason: 'حذف إداري' });

    return `🗑️ تم حذف ${oldId}`;
  }

  // ===================================
  // ✅ حالة اللاعب (كل الأدمن)
  // ===================================
  async showPlayer(targetId) {
    const target = await this.userSystem.findByIdentifier(targetId);

    if (target && target.needsLetter) {
      return `⚠️ لم تحدد الحرف

الصيغ:
• R_${target.number.padStart(3, '0')}
• I_${target.number.padStart(3, '0')}`;
    }

    if (!target) return `❌ اللاعب غير موجود: ${targetId}`;

    // ✅ الألعاب التي لعبها اليوم
    const todayStr = today();
    const todayLogs = await TransactionLog.find({
      targetId: target.userId,
      date: todayStr,
      action: 'add'
    }).sort({ timestamp: 1 });

    let msg = `📊 حالة ${target.userId}\n\n`;
    msg += `💰 الرصيد: ${target.rio} ريو\n`;
    msg += `📈 إجمالي: ${target.totalEarned}\n`;
    msg += `⭐ المستوى: ${target.level}\n`;
    msg += `🔥 Streak: ${target.streak}\n\n`;

    msg += `🎮 ألعاب اليوم:\n`;
    if (todayLogs.length === 0) {
      msg += `• لا يوجد\n`;
    } else {
      todayLogs.forEach(log => {
        const time = new Date(log.timestamp).toLocaleTimeString('ar-EG', {
          hour: '2-digit', minute: '2-digit'
        });
        msg += `• ${log.reason} (+${log.amount}) — ${time}\n`;
      });
    }

    msg += `\n🛒 مشتريات اليوم: ${target.purchases.filter(p => {
      return new Date(p.date).toISOString().split('T')[0] === todayStr;
    }).length}\n`;

    msg += `\n🚫 الحالة:\n`;
    msg += `• مجمد: ${target.isFrozen ? `نعم (${target.frozenReason})` : 'لا'}\n`;
    msg += `• أدمن: ${target.isRootAdmin ? 'رئيسي' : target.isMainAdmin ? 'رئيسي' : target.isAdmin ? 'مساعد' : 'لا'}\n`;
    msg += `• وضع اختبار: ${target.isTestMode ? 'نعم' : 'لا'}\n\n`;

    msg += `📊 إحصائيات:\n`;
    msg += `• ألعاب: ${target.totalGamesPlayed || 0}\n`;
    msg += `• انتصارات: ${target.totalGamesWon || 0}\n`;
    msg += `• إحالات: ${target.referralCount}\n`;
    msg += `• مسجل: ${new Date(target.registeredAt).toLocaleDateString('ar-EG')}`;

    return msg;
  }

  // ===================================
  // ✅ قائمة اللاعبين
  // ===================================
  async listPlayers(admin, args) {
    if (!this.isAnyAdmin(admin)) return null;

    const page = parseInt(args[0]) || 1;
    const perPage = 10;
    const total = await User.countDocuments();
    const totalPages = Math.ceil(total / perPage);

    if (total === 0) return '📋 لا يوجد لاعبون';

    if (page < 1 || page > totalPages) {
      return `❌ الصفحة ${page} غير موجودة. الإجمالي: ${totalPages}`;
    }

    const users = await User.find()
      .sort({ registeredAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .select('userId rio level isFrozen isAdmin isMainAdmin isRootAdmin');

    let msg = `📋 اللاعبون — صفحة ${page}/${totalPages}\n\n`;
    users.forEach(u => {
      const badges = [];
      if (u.isRootAdmin) badges.push('🔴');
      else if (u.isMainAdmin) badges.push('🟠');
      else if (u.isAdmin) badges.push('🟡');
      if (u.isFrozen) badges.push('❄️');

      msg += `• ${u.userId} ${badges.join('')}\n`;
      msg += `  💰 ${u.rio} | ⭐ Lv.${u.level}\n`;
    });

    msg += `\n📊 الإجمالي: ${total}`;
    return msg;
  }

  // ===================================
  // ✅ قائمة المجمدين
  // ===================================
  async listFrozen(admin) {
    if (!this.isAnyAdmin(admin)) return null;

    const users = await User.find({ isFrozen: true })
      .select('userId frozenReason frozenAt');

    if (users.length === 0) return '❄️ لا يوجد مجمدون';

    let msg = `❄️ المجمدون (${users.length})\n\n`;
    users.forEach(u => {
      msg += `• ${u.userId}\n`;
      msg += `  السبب: ${u.frozenReason || 'غير محدد'}\n`;
    });
    return msg;
  }

  // ===================================
  // ✅ إحصائيات
  // ===================================
  async stats(admin) {
    if (!this.isAnyAdmin(admin)) return null;

    const stats = await this.userSystem.getStats();

    let msg = `📊 إحصائيات\n\n`;
    msg += `👥 اللاعبون: ${stats.totalUsers}\n`;
    msg += `❄️ المجمدون: ${stats.frozen}\n`;
    msg += `🟡 أدمن مساعد: ${stats.admins}\n`;
    msg += `🟠 أدمن رئيسي: ${stats.mainAdmins}\n\n`;
    msg += `💰 إجمالي الريو: ${stats.totalRio}\n`;
    msg += `📈 إجمالي المكتسب: ${stats.totalEarned}`;
    return msg;
  }

  // ===================================
  // ✅ منح أدمن (كل الأدمن الرئيسي)
  // ===================================
  async promoteToAdmin(admin, args) {
    if (!this.isMainAdmin(admin)) return null;

    if (args.length < 1) {
      return `❌ الاستخدام: منح_ادمن [ID]

💡 يمنح كل الأوامر ما عدا:
• سجل، أرشيف
• خصم، تجميد، حذف
• منح أدمن رئيسي
• إيقاف البوت

مثال:
منح_ادمن R_001`;
    }

    const targetId = args[0];
    const target = await this.userSystem.findByIdentifier(targetId);

    if (target && target.needsLetter) {
      return `⚠️ لم تحدد الحرف`;
    }

    if (!target) return `❌ اللاعب غير موجود: ${targetId}`;

    const result = await this.userSystem.promoteToAdmin(target.userId);
    if (result.error) return result.error;

    await this.log(admin.userId, 'promote', target.userId, { reason: 'منح أدمن مساعد' });
    return result.message;
  }

  // ===================================
  // ✅ منح أدمن رئيسي (أدمن رئيسي فقط)
  // ===================================
  async promoteToMainAdmin(admin, args) {
    if (!this.isRootAdmin(admin)) return null;

    if (args.length < 1) {
      return `❌ الاستخدام: منح_ادمن_رئيسي [ID]

⚠️ يمنح كل الأوامر (ما عدا حذف R_000)

مثال:
منح_ادمن_رئيسي R_001`;
    }

    const targetId = args[0];
    const target = await this.userSystem.findByIdentifier(targetId);

    if (target && target.needsLetter) {
      return `⚠️ لم تحدد الحرف`;
    }

    if (!target) return `❌ اللاعب غير موجود: ${targetId}`;

    const result = await this.userSystem.promoteToMainAdmin(target.userId);
    if (result.error) return result.error;

    await this.log(admin.userId, 'promote', target.userId, { reason: 'منح أدمن رئيسي' });
    return result.message;
  }

  // ===================================
  // ✅ إزالة أدمن
  // ===================================
  async demoteAdmin(admin, args) {
    if (!this.isRootAdmin(admin)) return null;

    if (args.length < 1) {
      return `❌ الاستخدام: ازل_ادمن [ID]`;
    }

    const targetId = args[0];
    const target = await this.userSystem.findByIdentifier(targetId);

    if (target && target.needsLetter) {
      return `⚠️ لم تحدد الحرف`;
    }

    if (!target) return `❌ اللاعب غير موجود: ${targetId}`;

    const result = await this.userSystem.demoteAdmin(target.userId);
    if (result.error) return result.error;

    await this.log(admin.userId, 'demote', target.userId, { reason: 'إزالة أدمن' });
    return result.message;
  }

  // ===================================
  // ✅ رسالة خاصة
  // ===================================
  async sendMessage(admin, args) {
    if (!this.isMainAdmin(admin)) return null;

    if (args.length < 2) {
      return `❌ الاستخدام: رسالة [ID] [النص]

مثال:
رسالة R_001 مرحباً بك!`;
    }

    const targetId = args[0];
    const text = args.slice(1).join(' ');

    const target = await this.userSystem.findByIdentifier(targetId);
    if (!target) return `❌ اللاعب غير موجود: ${targetId}`;

    await this.log(admin.userId, 'message', target.userId, { reason: 'رسالة خاصة' });

    return {
      sendTo: {
        platform: target.platform,
        platformId: target.platformId,
        text: `📩 رسالة من الإدارة\n\n${text}`
      }
    };
  }
  }
