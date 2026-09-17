// core/CommandHandler.js
import { today, normalizeArabic } from '../utils/helpers.js';

const COMPOUND_COMMANDS = [
  'اضف_نقاط', 'اضف_ريو',
  'خصم_نقاط', 'خصم_ريو',
  'عدل_نقاط',
  'فك_تجميد',
  'عرض_لاعب', 'عرض_اللاعبين', 'عرض_المجمدين',
  'عرض_الاكواد', 'عرض_المنتجات',
  'اضف_منتج', 'حذف_منتج', 'عدل_منتج',
  'اضف_كود', 'حذف_كود',
  'اضف_دولاب', 'حذف_دولاب',
  'منح_ادمن', 'منح_ادمن_رئيسي', 'ازل_ادمن',
  'ايقاف_البوت', 'تشغيل_البوت',
  'حذف_الكل',
  'وضع_الي', 'وضع_يدوي', 'وضع_ايقاف'
];

const ALIASES = {
  // بدء
  'مرحبا': 'بدء', 'اهلا': 'بدء', 'هلا': 'بدء', 'هاي': 'بدء',
  'السلام عليكم': 'بدء', 'hi': 'بدء', 'hello': 'بدء', 'start': 'بدء',
  'تفعيل': 'بدء', 'بداية': 'بدء',

  // مساعدة
  'اوامر': 'مساعدة', 'الاوامر': 'مساعدة', 'help': 'مساعدة',

  // أقسام
  'حساب': 'قسم_الحساب', 'الحساب': 'قسم_الحساب',

  // الحساب
  'رصيدي': 'نقاطي', 'رصيد': 'نقاطي',
  'بروفايلي': 'ملفي', 'حسابي': 'ملفي',
  'id': 'معرفي',
  'افضل': 'توب', 'الافضل': 'توب',

  // الفعاليات
  'هديتي': 'هدية', 'gift': 'هدية', 'daily': 'هدية',
  'redeem': 'كود', 'code': 'كود',
  'كودي': 'احالتي', 'referral': 'احالتي',
  'احالة': 'صديق',

  // السوق
  'متجر': 'سوق', 'المتجر': 'سوق', 'shop': 'سوق',
  'اشتري': 'اشتر', 'شراء': 'اشتر', 'شرا': 'اشتر', 'buy': 'اشتر',
  'مشتريات': 'مشترياتي', 'سجلي': 'مشترياتي',

  // المهام
  'المهام': 'مهام', 'missions': 'مهام',

  // الإدارة
  'الادمن': 'مدير', 'admin': 'مدير',

  // أوامر إيقاف
  'ايقاف': 'ايقاف_البوت', 'وقف': 'ايقاف_البوت',
  'استئناف': 'تشغيل_البوت', 'استمرار': 'تشغيل_البوت',

  // أوامر النقاط
  'اضف': 'اضف_نقاط', 'اضافة': 'اضف_نقاط', 'اضافه': 'اضف_نقاط',
  'اعطي': 'اضف_نقاط', 'منح_نقاط': 'اضف_نقاط',
  'خصم': 'خصم_نقاط', 'اطرح': 'خصم_نقاط', 'ازالة_نقاط': 'خصم_نقاط',

  // حالة
  'معلومات': 'حالة', 'تفاصيل': 'حالة', 'info': 'حالة',

  // صلاحيات
  'منح': 'منح_ادمن', 'ترقية': 'منح_ادمن',
  'منح_رئيسي': 'منح_ادمن_رئيسي', 'ترقية_رئيسية': 'منح_ادمن_رئيسي',
  'ازالة_ادمن': 'ازل_ادمن', 'تنزيل': 'ازل_ادمن',

  // حذف الكل
  'تصفير': 'حذف_الكل', 'reset': 'حذف_الكل',

  // أوضاع البوت
  'وضع_آلي': 'وضع_الي',
  'وضع_الي': 'وضع_الي',
  'آلي': 'وضع_الي',
  'تلقائي': 'وضع_الي',
  'وضع_يدوي': 'وضع_يدوي',
  'يدوي': 'وضع_يدوي',
  'وضع_ايقاف': 'وضع_ايقاف',
  'ايقاف_كامل': 'وضع_ايقاف',
  'صيانة': 'وضع_ايقاف'
};

const LINKS = {
  page: process.env.PAGE_LINK || 'https://facebook.com/MgaraRio',
  group: process.env.GROUP_LINK || 'https://facebook.com/groups/MgaraRio'
};

const GAME_ANSWERS = [
  'أ', 'ا', 'ب', 'ج', 'د',
  '1', '2', '3', '4',
  'a', 'b', 'c', 'd',
  'حجر', 'ورقة', 'مقص',
  'صح', 'خطأ', 'خطا', 'نعم', 'لا'
];

export default class CommandHandler {
  constructor(systems) {
    this.userSystem = systems.userSystem;
    this.points = systems.pointsSystem;
    this.dailyGift = systems.dailyGift;
    this.game = systems.game;
    this.gameSystem = systems.gameSystem;
    this.shop = systems.shop;
    this.codes = systems.codes;
    this.referral = systems.referral;
    this.achievements = systems.achievementSystem;
    this.missions = systems.missions;
    this.leaderboard = systems.leaderboard;
    this.admin = systems.adminSystem;
    this.archive = systems.archiveSystem;
    console.log('🎯 CommandHandler جاهز');
  }

  async process(sender, message) {
    const text = (message || '').trim();
    if (!text) return null;

    const parts = text.split(/\s+/);
    let cmd = parts[0];
    let args = parts.slice(1);

    // ✅ الأوامر المركبة
    if (parts.length >= 2) {
      const twoWord = parts.slice(0, 2).join('_');
      if (COMPOUND_COMMANDS.includes(twoWord)) {
        cmd = twoWord;
        args = parts.slice(2);
      }
    }

    // ✅ Aliases
    if (ALIASES[cmd]) cmd = ALIASES[cmd];

    // ===================================
    // ✅ أوامر البوت الحساسة (قبل أي شيء)
    // ===================================
    if (['ايقاف_البوت', 'تشغيل_البوت', 'حذف_الكل',
         'وضع_الي', 'وضع_يدوي', 'وضع_ايقاف', 'وضعي'].includes(cmd)) {
      const admin = await this.userSystem.getOrCreate(sender.id, sender.platform);
      if (!this.admin.isMainAdmin(admin)) return null;

      if (cmd === 'ايقاف_البوت') {
        this.userSystem.setBotMode('off');
        return '🔴 تم التحويل لوضع الإيقاف\n\n💡 اللاعبون: تسجيل فقط\n💡 أنت: كل الأوامر تعمل';
      }

      if (cmd === 'تشغيل_البوت') {
        this.userSystem.setBotMode('auto');
        return '🟢 تم التحويل للوضع الآلي\n\n💡 كل الأوامر تعمل';
      }

      if (cmd === 'وضع_الي') {
        this.userSystem.setBotMode('auto');
        return '🟢 تم التحويل للوضع الآلي';
      }

      if (cmd === 'وضع_يدوي') {
        this.userSystem.setBotMode('manual');
        return '🟡 تم التحويل للوضع اليدوي\n\n💡 اللاعبون: عرض فقط (بدون لعب/شراء)';
      }

      if (cmd === 'وضع_ايقاف') {
        this.userSystem.setBotMode('off');
        return '🔴 تم التحويل لوضع الإيقاف\n\n💡 اللاعبون: تسجيل فقط';
      }

      if (cmd === 'وضعي') {
        const mode = this.userSystem.isBotMode();
        const labels = {
          auto: '🟢 آلي',
          manual: '🟡 يدوي',
          off: '🔴 إيقاف'
        };
        return `🤖 وضع البوت الحالي: ${labels[mode]}`;
      }

      if (cmd === 'حذف_الكل') {
        if (args[0] !== 'تأكيد') {
          return `⚠️ تأكيد الحذف

سيتم حذف جميع اللاعبين نهائيًا!

💡 للتأكيد: حذف_الكل تأكيد

⚠️ لا يمكن التراجع!`;
        }

        const User = (await import('../models/User.js')).default;
        const count = await User.countDocuments();
        await User.deleteMany({});

        try {
          const Archive = (await import('../models/Archive.js')).default;
          await Archive.deleteMany({});
        } catch (e) {}

        return `🗑️ تم حذف ${count} لاعب\n\n💡 ابدأ من جديد — أول لاعب = R_000`;
      }
    }

    // ===================================
    // ✅ فحص الوضع
    // ===================================
    const botMode = this.userSystem.isBotMode();
    const user = await this.userSystem.getOrCreate(sender.id, sender.platform);
    const userIsAdmin = this.admin.isAnyAdmin(user);

    // ✅ غير الأدمن: قيود حسب الوضع
    if (!userIsAdmin) {
      // 🔴 إيقاف: بدء فقط
      if (botMode === 'off') {
        const allowed = ['بدء'];
        if (!allowed.includes(cmd)) return null;
      }

      // 🟡 يدوي: منع اللعب والشراء والهدية
      if (botMode === 'manual') {
        const blocked = ['العب', 'اشتر', 'هدية'];
        if (blocked.includes(cmd)) return null;

        // منع الإجابات أيضًا
        if (GAME_ANSWERS.includes(cmd) || ['حجر', 'ورقة', 'مقص'].includes(parts[0])) {
          return null;
        }
      }
    }

    // ===================================
    // ✅ التجميد
    // ===================================
    if (user.isFrozen && !userIsAdmin) {
      const allowed = ['نقاطي', 'ملفي', 'مساعدة', 'توب', 'معرفي'];
      const firstWord = parts[0];
      if (!allowed.includes(firstWord)) {
        if (this.userSystem.shouldNotifyFrozen(user)) {
          await this.userSystem.markFrozenNotified(user);
          return '❄️ حسابك مجمد. تواصل مع الإدارة.';
        }
        return null;
      }
    }

    try {
      // ✅ فحص إجابة لعبة نشطة
      if (GAME_ANSWERS.includes(cmd) || (parts[0] && ['حجر', 'ورقة', 'مقص'].includes(parts[0]))) {
        const handled = await this._handleGameAnswer(user, text);
        if (handled !== null) return handled;
      }

      switch (cmd) {
        // ===== أساسية =====
        case 'بدء': return this._welcome(user);
        case 'مساعدة': return this._help(user);
        case 'قسم_الحساب': return this._sectionAccount();

        case 'مدير':
          if (!this.admin.isAnyAdmin(user)) return null;
          return this._adminHelp(user);

        case 'معرفي': return this._myId(user);
        case 'نقاطي': return this._balance(user);
        case 'ملفي': return this._profile(user);
        case 'توب': return await this.leaderboard.top10();

        // ===== الألعاب =====
        case 'العاب':
          return this.gameSystem.listGames(user);

        case 'العب': {
          if (!args[0]) return this.gameSystem.listGames(user);
          return await this.gameSystem.startGame(user, args[0]);
        }

        // ===== المساعدات =====
        case '50': case '50:50':
          return await this._handleFifty(user);
        case 'تخطي':
          return await this._handleSkip(user);

        // ===== الفعاليات =====
        case 'هدية': return await this._handleGift(user);
        case 'كود': return await this._handleCode(user, args);
        case 'احالتي': return await this.referral.showCode(user);
        case 'صديق': return await this._handleReferral(user, args);

        // ===== السوق =====
        case 'سوق': return await this.shop.showShop(user);
        case 'اشتر': return await this._handleBuy(user, args);
        case 'مشترياتي': return this._purchases(user);

        // ===== المهام =====
        case 'مهام': return await this.missions.show(user);

        // ===== الاسم والديكور =====
        case 'اسمي':
          return await this._handleSetName(user, args);
        case 'ديكوري':
          return await this._handleSetBadge(user, args);

        // ===================================
        // 👑 أوامر الأدمن
        // ===================================

        case 'اضف_نقاط': case 'اضف_ريو':
          if (!this.admin.isAnyAdmin(user)) return null;
          return await this.admin.addPoints(user, args);

        case 'خصم_نقاط': case 'خصم_ريو':
          if (!this.admin.isMainAdmin(user)) return null;
          return await this.admin.removePoints(user, args);

        case 'حالة':
          if (!this.admin.isAnyAdmin(user)) return null;
          return await this.admin.showPlayer(args[0]);

        case 'تجميد':
          if (!this.admin.isMainAdmin(user)) return null;
          return await this.admin.freeze(user, args);

        case 'فك_تجميد':
          if (!this.admin.isMainAdmin(user)) return null;
          return await this.admin.unfreeze(user, args);

        case 'حذف':
          if (!this.admin.isMainAdmin(user)) return null;
          return await this.admin.deleteUser(user, args);

        case 'عرض_لاعب':
          if (!this.admin.isAnyAdmin(user)) return null;
          return await this.admin.showPlayer(args[0]);

        case 'عرض_اللاعبين':
          if (!this.admin.isAnyAdmin(user)) return null;
          return await this.admin.listPlayers(user, args);

        case 'عرض_المجمدين':
          if (!this.admin.isAnyAdmin(user)) return null;
          return await this.admin.listFrozen(user);

        case 'عرض_الاكواد':
          if (!this.admin.isAnyAdmin(user)) return null;
          return await this.codes.listAll();

        case 'عرض_المنتجات':
          if (!this.admin.isAnyAdmin(user)) return null;
          return await this.shop.listAll();

        case 'احصائيات':
          if (!this.admin.isAnyAdmin(user)) return null;
          return await this.admin.stats(user);

        case 'اضف_منتج':
          if (!this.admin.isAnyAdmin(user)) return null;
          return await this._handleAddProduct(user, args);

        case 'حذف_منتج':
          if (!this.admin.isAnyAdmin(user)) return null;
          return (await this.shop.removeItem(args.join(' '))).message || null;

        case 'عدل_منتج':
          if (!this.admin.isAnyAdmin(user)) return null;
          return (await this.shop.editItem(args[0], args[1], args.slice(2).join(' '))).message || null;

        case 'اضف_دولاب':
          if (!this.admin.isAnyAdmin(user)) return null;
          return await this._handleAddWheel(user, args);

        case 'اضف_كود':
          if (!this.admin.isAnyAdmin(user)) return null;
          return (await this.codes.create(args[0], parseInt(args[1]), parseInt(args[2]), user.userId)).message || null;

        case 'حذف_كود':
          if (!this.admin.isAnyAdmin(user)) return null;
          return (await this.codes.remove(args[0])).message || null;

        case 'منح_ادمن':
          if (!this.admin.isMainAdmin(user)) return null;
          return await this.admin.promoteToAdmin(user, args);

        case 'منح_ادمن_رئيسي':
          if (!this.admin.isRootAdmin(user)) return null;
          return await this.admin.promoteToMainAdmin(user, args);

        case 'ازل_ادمن':
          if (!this.admin.isRootAdmin(user)) return null;
          return await this.admin.demoteAdmin(user, args);

        case 'سجل':
          if (!this.admin.isRootAdmin(user)) return null;
          return await this._handleLog(args);

        case 'ارشيف':
          if (!this.admin.isRootAdmin(user)) return null;
          return await this._handleArchive(args);

        case 'رسالة': {
          if (!this.admin.isMainAdmin(user)) return null;
          const res = await this.admin.sendMessage(user, args);
          if (res && res.error) return res.error;
          if (res && res.sendTo) return { sendTo: res.sendTo };
          return res;
        }

        case 'تجربة':
          if (!this.admin.isMainAdmin(user)) return null;
          return await this._handleToggleTest(user, args);

        default:
          return null;
      }
    } catch (error) {
      console.error('❌ خطأ في معالجة الأمر:', error.message);
      return null;
    }
  }

  // ===================================
  // معالجة إجابة لعبة
  // ===================================
  async _handleGameAnswer(user, text) {
    const active = await this.gameSystem.hasActiveGame(user);
    if (!active) return null;

    const result = await this.gameSystem.handleAnswer(user, active.key, text);
    if (result.silent) return null;
    if (result.error) return result.error;

    try {
      if (user.gamesPlayed === 1 && user.referredBy) {
        await this.referral.completeReferral(user);
      }
      await this.missions.track(user, 'gamesPlayed');
      await this.missions.check(user);
      await this.achievements.checkRioAchievements(user);
    } catch (e) {}

    return result.message;
  }

  // ===================================
  // ✅ سجل [حرف] [رقم] [صفحة]
  // ===================================
  async _handleLog(args) {
    if (args.length === 0) {
      return `📋 السجل

الطريقة:
• سجل [حرف] [رقم] [صفحة]
• سجل اليوم
• سجل [ID لاعب]

أمثلة:
• سجل R 1        → سجل R1
• سجل R 1 2      → صفحة 2 من R1
• سجل اليوم      → عمليات اليوم
• سجل R_001      → سجل اللاعب

💡 لمعرفة الصفحات: سجل R 1`;
    }

    const first = args[0];

    if (normalizeArabic(first) === normalizeArabic('اليوم')) {
      return await this._showTodayLog();
    }

    if (/^[A-Z]_\d+$/i.test(first) || /^[A-Z]\d+$/i.test(first)) {
      const target = await this.userSystem.findByIdentifier(first);
      if (!target || target.needsLetter) return `❌ اللاعب غير موجود: ${first}`;
      return await this._showPlayerLog(target);
    }

    const letter = first.toUpperCase();
    if (!/^[A-Z]$/.test(letter)) {
      return `❌ حرف غير صالح: ${first}

💡 استخدم حرفاً واحداً:
• سجل R 1
• سجل I 1`;
    }

    const archiveIndex = args[1] ? parseInt(args[1]) : null;
    const page = args[2] ? parseInt(args[2]) : 1;

    if (archiveIndex === null) {
      return await this._showLetterArchives(letter);
    }

    const archiveId = `${letter}${archiveIndex}`;
    return await this._showArchiveLog(archiveId, page);
  }

  async _showTodayLog() {
    const todayStr = today();
    const TransactionLog = (await import('../models/TransactionLog.js')).default;

    const logs = await TransactionLog.find({ date: todayStr })
      .sort({ timestamp: -1 })
      .limit(20);

    if (logs.length === 0) {
      return `📋 سجل اليوم\n\n(لا توجد عمليات اليوم)`;
    }

    let msg = `📋 سجل اليوم (${todayStr})\n\n`;
    logs.forEach(log => {
      const time = new Date(log.timestamp).toLocaleTimeString('ar-EG', {
        hour: '2-digit', minute: '2-digit'
      });
      const icon = log.action === 'add' ? '➕' : log.action === 'remove' ? '➖' : '📌';
      msg += `${icon} [${time}] ${log.targetId}`;
      if (log.amount > 0) msg += ` ${log.action === 'add' ? '+' : '-'}${log.amount}`;
      msg += `\n   ${log.reason}\n   بواسطة: ${log.adminId}\n\n`;
    });

    return msg.trim();
  }

  async _showPlayerLog(target) {
    const TransactionLog = (await import('../models/TransactionLog.js')).default;

    const logs = await TransactionLog.find({ targetId: target.userId })
      .sort({ timestamp: -1 })
      .limit(20);

    if (logs.length === 0) {
      return `📋 سجل ${target.userId}\n\n(لا توجد عمليات)`;
    }

    let msg = `📋 سجل ${target.userId}\n\n`;
    logs.forEach(log => {
      const date = new Date(log.timestamp).toLocaleDateString('ar-EG');
      const time = new Date(log.timestamp).toLocaleTimeString('ar-EG', {
        hour: '2-digit', minute: '2-digit'
      });
      const icon = log.action === 'add' ? '➕' : log.action === 'remove' ? '➖' : '📌';
      msg += `${icon} ${date} ${time}\n`;
      if (log.amount > 0) msg += `   ${log.action === 'add' ? '+' : '-'}${log.amount} — ${log.reason}\n`;
      else msg += `   ${log.reason}\n`;
      msg += `   بواسطة: ${log.adminId}\n\n`;
    });

    return msg.trim();
  }

  async _showLetterArchives(letter) {
    const Archive = (await import('../models/Archive.js')).default;
    const archives = await Archive.find({ letter }).sort({ index: 1 });

    if (archives.length === 0) {
      return `📋 لا توجد أرشيفات لحرف ${letter}\n\n💡 تُنشأ كل 100 لاعب`;
    }

    let msg = `📋 أرشيفات ${letter}\n\n`;
    archives.forEach(a => {
      msg += `• ${a.archiveId} (${a.fromId} - ${a.toId})\n`;
      msg += `  👥 ${a.playerCount} لاعب | 💰 ${a.totalRio} ريو\n\n`;
    });

    msg += `💡 للعرض: سجل ${letter} 1`;
    return msg;
  }

  async _showArchiveLog(archiveId, page) {
    const Archive = (await import('../models/Archive.js')).default;
    const TransactionLog = (await import('../models/TransactionLog.js')).default;
    const User = (await import('../models/User.js')).default;

    const archive = await Archive.findOne({ archiveId });
    if (!archive) {
      return `❌ الأرشيف غير موجود: ${archiveId}

💡 اعرض القائمة: سجل ${archiveId[0]}`;
    }

    const users = await User.find({
      userId: { $regex: new RegExp(`^${archive.letter}_`) }
    }).where('userId').gte(archive.fromId).lte(archive.toId);

    const userIds = users.map(u => u.userId);

    const perPage = 20;
    const total = await TransactionLog.countDocuments({ targetId: { $in: userIds } });
    const totalPages = Math.ceil(total / perPage);
    const actualPage = Math.max(1, Math.min(page, totalPages));

    const logs = await TransactionLog.find({ targetId: { $in: userIds } })
      .sort({ timestamp: -1 })
      .skip((actualPage - 1) * perPage)
      .limit(perPage);

    let msg = `📋 ${archiveId} — صفحة ${actualPage}/${totalPages}\n`;
    msg += `📊 ${archive.playerCount} لاعب | 💰 ${archive.totalRio} ريو\n\n`;

    if (logs.length === 0) {
      msg += '(لا توجد عمليات)';
    } else {
      logs.forEach(log => {
        const date = new Date(log.timestamp).toLocaleDateString('ar-EG');
        const icon = log.action === 'add' ? '➕' : log.action === 'remove' ? '➖' : '📌';
        msg += `${icon} ${log.targetId}`;
        if (log.amount > 0) msg += ` ${log.action === 'add' ? '+' : '-'}${log.amount}`;
        msg += ` — ${log.reason}\n`;
        msg += `   ${date} | بواسطة: ${log.adminId}\n\n`;
      });
    }

    if (totalPages > 1) {
      msg += `\n💡 للتنقل: سجل ${archive.letter} ${archive.index} [صفحة]`;
    }

    return msg.trim();
  }

  async _handleArchive(args) {
    if (args.length === 0) {
      return await this.archive.listArchives();
    }

    const archiveId = args[0].toUpperCase();
    return await this.archive.showArchive(archiveId);
  }

  async _handleToggleTest(admin, args) {
    if (!args[0]) {
      const current = admin.isTestMode || false;
      admin.isTestMode = !current;
      await admin.save();
      return current
        ? '✅ تم إلغاء وضع الاختبار'
        : '🧪 تم تفعيل وضع الاختبار\n\n💡 يمكنك اللعب بلا حدود';
    }

    const target = await this.userSystem.findByIdentifier(args[0]);
    if (!target || target.needsLetter) return '❌ اللاعب غير موجود';

    const enabled = args[1] === 'تفعيل' || args[1] === 'on' || !args[1];
    const result = await this.userSystem.setTestMode(target.userId, enabled);
    return result.message || result.error;
  }

  // ===================================
  // الرسائل الأساسية
  // ===================================
  _welcome(user) {
    const badges = [];
    if (user.isRootAdmin) badges.push('🔴 رئيسي');
    else if (user.isMainAdmin) badges.push('🟠 رئيسي');
    else if (user.isAdmin) badges.push('🟡 مساعد');

    let msg = '🏔️ مغارة ريو\n\n';
    msg += `🎮 معرفك: ${user.userId}\n`;
    if (badges.length > 0) msg += `👑 ${badges[0]}\n`;
    msg += `💰 رصيدك: ${user.rio} ريو\n\n`;
    msg += '💡 مساعدة — كل الأوامر';

    return msg;
  }

  _help(user) {
    const botMode = this.userSystem.isBotMode();
    const isAdmin = this.admin.isAnyAdmin(user);

    let msg = '📋 الأوامر\n\n';
    msg += '👤 الحساب\n';
    msg += 'معرفي • نقاطي • ملفي • توب\n\n';

    if (botMode === 'auto' || isAdmin) {
      msg += '🎮 اللعب\n';
      msg += 'العاب • العب\n\n';

      msg += '🎁 الفعاليات\n';
      msg += 'هدية • كود • احالتي • صديق\n\n';

      msg += '🛒 السوق\n';
      msg += 'سوق • اشتر • مشترياتي\n\n';
    } else {
      msg += '🎮 اللعب\n';
      msg += 'العاب (للعرض فقط)\n\n';

      msg += '🎁 الفعاليات\n';
      msg += 'كود • احالتي • صديق\n\n';

      msg += '🛒 السوق\n';
      msg += 'سوق (للعرض فقط)\n\n';
    }

    msg += '📋 المهام\n';
    msg += 'مهام\n';

    if (isAdmin) {
      msg += '\n👑 الإدارة\n';
      msg += 'مدير';
    }

    if (!isAdmin && botMode !== 'auto') {
      msg += '\n\n💡 للعب أو الشراء:\nراسل الإدارة';
    }

    return msg;
  }

  _sectionAccount() {
    return `👤 الحساب

• معرفي — معرّفك
• نقاطي — رصيدك
• ملفي — كل التفاصيل
• توب — أفضل 10`;
  }

  _adminHelp(user) {
    const isRoot = this.admin.isRootAdmin(user);
    const isMain = this.admin.isMainAdmin(user);

    let msg = '👑 أوامر الأدمن\n\n';

    msg += '💰 النقاط\n';
    msg += 'اضف_نقاط [ID] [الكمية] [السبب]\n';
    msg += 'حالة [ID]\n';
    if (isMain) {
      msg += 'خصم_نقاط [ID] [الكمية] [السبب]\n';
    }
    msg += '\n';

    msg += '👥 اللاعبون\n';
    msg += 'عرض_اللاعبين [ص]\n';
    msg += 'عرض_المجمدين\n';
    if (isMain) {
      msg += 'تجميد [ID] [السبب]\n';
      msg += 'فك_تجميد [ID]\n';
      msg += 'حذف [ID]\n';
    }
    msg += '\n';

    msg += '🛒 المنتجات\n';
    msg += 'عرض_المنتجات\n';
    msg += 'اضف_منتج [الاسم] [السعر] [الكمية] [الوصف]\n';
    msg += 'حذف_منتج [الاسم]\n';
    msg += 'عدل_منتج [الاسم] [الحقل] [القيمة]\n\n';

    msg += '🎫 الأكواد\n';
    msg += 'عرض_الاكواد\n';
    msg += 'اضف_كود [الكود] [الريو] [العدد]\n';
    msg += 'حذف_كود [الكود]\n\n';

    msg += '🎡 دولاب الحظ\n';
    msg += 'اضف_دولاب [الاسم] [السعر] [الجوائز]\n\n';

    msg += '📊 إحصائيات\n';
    msg += 'احصائيات\n\n';

    if (isMain) {
      msg += '👑 الصلاحيات\n';
      msg += 'منح_ادمن [ID]\n';
      if (isRoot) {
        msg += 'منح_ادمن_رئيسي [ID]\n';
        msg += 'ازل_ادمن [ID]\n';
      }
      msg += '\n';
    }

    if (isRoot) {
      msg += '📋 السجل\n';
      msg += 'سجل [حرف] [رقم] [صفحة]\n';
      msg += 'سجل اليوم\n';
      msg += 'سجل [ID]\n\n';
      msg += '📚 الأرشيف\n';
      msg += 'ارشيف\n';
      msg += 'ارشيف [رمز]\n\n';
    }

    if (isMain) {
      msg += '📩 التواصل\n';
      msg += 'رسالة [ID] [النص]\n\n';

      msg += '🤖 أوضاع البوت\n';
      msg += 'وضع_الي — آلي كامل\n';
      msg += 'وضع_يدوي — عرض فقط\n';
      msg += 'وضع_ايقاف — تسجيل فقط\n';
      msg += 'وضعي — الوضع الحالي\n\n';
    }

    if (isRoot) {
      msg += '🗑️ خطر\n';
      msg += 'حذف_الكل تأكيد\n\n';
    }

    msg += '💡 الأوامر تقبل _ أو مسافة';
    return msg;
  }

  _myId(user) {
    const badges = [];
    if (user.isRootAdmin) badges.push('🔴 أدمن رئيسي');
    else if (user.isMainAdmin) badges.push('🟠 أدمن رئيسي');
    else if (user.isAdmin) badges.push('🟡 أدمن مساعد');
    if (user.isTestMode) badges.push('🧪 اختبار');

    let msg = `🆔 معلوماتك\n\n`;
    msg += `🎮 معرف اللعبة: ${user.userId}\n`;
    msg += `📱 معرف المنصة: ${user.platformId}\n`;
    msg += `🌐 المنصة: ${user.platform}`;
    if (badges.length > 0) msg += `\n${badges.join('\n')}`;
    return msg;
  }

  _balance(user) {
    return `💰 رصيدك

◀️ معرفك: ${user.userId}
💎 رصيدك: ${user.rio} ريو
⭐ مستواك: ${user.level}
🔥 أيام متتالية: ${user.streak}`;
  }

  _profile(user) {
    const bonus = this.points.getBonus(user);
    let msg = `👤 ملفي\n\n`;
    msg += `🎮 المعرف: ${user.userId}\n`;
    if (user.customName) msg += `🏷️ الاسم: "${user.customName}"\n`;
    msg += `💰 الرصيد: ${user.rio} ريو\n`;
    msg += `📊 الإجمالي: ${user.totalEarned}\n`;
    msg += `⭐ المستوى: ${user.level}`;
    if (bonus.title) msg += ` (${bonus.title})`;
    msg += '\n';
    msg += `🔥 Streak: ${user.streak}\n`;
    msg += `🎮 ألعاب: ${user.totalGamesPlayed || 0}\n`;
    msg += `🏆 انتصارات: ${user.totalGamesWon || 0}\n`;
    msg += `👥 إحالات: ${user.referralCount}\n\n`;
    msg += `🎖️ الشارات\n`;
    msg += this.achievements.listForUser(user);
    if (bonus.time > 0 || bonus.discount > 0) {
      msg += '\n\n💎 مزايا المستوى\n';
      if (bonus.time > 0) msg += `⏱️ +${bonus.time} ثانية\n`;
      if (bonus.discount > 0) msg += `💸 خصم ${bonus.discount}%`;
    }
    return msg;
  }

  async _handleGift(user) {
    const result = await this.dailyGift.claim(user);
    if (result.error) return result.error;
    await this.missions.track(user, 'gifts');
    const completed = await this.missions.check(user);
    let msg = result.message;
    if (completed.length > 0) {
      msg += `\n\n🎉 مهمة مكتملة: ${completed[0].name} (+${completed[0].reward} ريو)`;
    }
    return msg;
  }

  async _handleFifty(user) {
    return '🌟 50:50\n\nهذه المساعدة متاحة فقط في لعبة "اسئلة"';
  }

  async _handleSkip(user) {
    return '⏭️ تخطي\n\nهذه المساعدة متاحة فقط في لعبة "اسئلة"';
  }

  async _handleCode(user, args) {
    if (!args[0]) {
      return `🎫 استرداد كود

الطريقة:
اكتب: كود [الكود]

مثال:
كود BA66A

📍 من أين أجلب الأكواد؟
تُنشر يوميًا في:
📄 الصفحة: ${LINKS.page}
👥 المجموعة: ${LINKS.group}`;
    }

    const result = await this.codes.redeem(user, args[0]);
    if (result && result.success) return result.message;
    return null;
  }

  async _handleReferral(user, args) {
    if (!args[0]) {
      return `👥 تفعيل إحالة

الطريقة:
اكتب: صديق [كود صديقك]

مثال:
صديق R_001

🎁 المكافأة:
+1 ريو لك
+1 ريو لصديقك (بعد أول لعبة)`;
    }

    const result = await this.referral.useReferral(user, args[0]);
    if (result && result.success) return result.message;
    if (result && result.error && typeof result.error === 'string') return result.error;
    return null;
  }

  async _handleBuy(user, args) {
    if (!args[0]) {
      return `🛒 الشراء

الطريقة:
اكتب: اشتر [اسم المنتج]

مثال:
اشتر تخطي سؤال
اشتر 50:50
اشتر دولاب ذهبي

💡 لرؤية المنتجات: سوق`;
    }

    const productName = args.join(' ');
    const result = await this.shop.purchase(user, productName);
    if (result.error) return result.error;

    await this.missions.track(user, 'purchases');
    await this.missions.check(user);
    await this.achievements.checkRioAchievements(user);

    return result.message;
  }

  _purchases(user) {
    if (!user.purchases || user.purchases.length === 0) return '📦 لا توجد مشتريات';
    let msg = '📦 مشترياتك\n\n';
    user.purchases.slice(-10).forEach(p => {
      msg += `• ${p.item.replace(/_/g, ' ')} — ${p.price} ريو\n`;
    });
    return msg;
  }

  async _handleSetName(user, args) {
    if (!user.ownedBadges?.includes('اسم_مخصص')) {
      return `🏷️ الاسم المخصص

لم تشترِ هذه الميزة بعد.

💰 السعر: 80 ريو
💡 اكتب: اشتر اسم مخصص`;
    }

    if (!args[0]) {
      return `🏷️ تعيين اسمك

الطريقة:
اكتب: اسمي [الاسم]

مثال:
اسمي أسطورة

القواعد:
• 3-10 أحرف
• عربية أو إنجليزية أو أرقام`;
    }

    const newName = args.join(' ').trim();

    if (newName.length < 3 || newName.length > 10) {
      return '❌ الاسم يجب أن يكون بين 3 و 10 أحرف';
    }

    if (!/^[\u0600-\u06FFa-zA-Z0-9]+$/.test(newName)) {
      return '❌ الاسم يحتوي على رموز غير مسموحة';
    }

    const BAD_WORDS = ['ادمن', 'admin', 'owner', 'mgara', 'ريو', 'R_000'];
    if (BAD_WORDS.some(w => newName.toLowerCase().includes(w.toLowerCase()))) {
      return '❌ هذا الاسم غير مسموح';
    }

    const prev = user.customName;
    user.customName = newName;
    await user.save();

    if (prev) {
      return `✅ تم تعديل اسمك\n\n"${prev}" → "${newName}"`;
    }
    return `✅ تم تعيين اسمك: "${newName}"`;
  }

  async _handleSetBadge(user, args) {
    const badges = user.ownedBadges || [];
    if (badges.length === 0) {
      return `🏅 الديكورات

لم تشترِ أي ديكور بعد.

💡 اكتب: سوق`;
    }

    if (!args[0]) {
      let msg = '🏅 ديكوراتك\n\n';
      badges.forEach(b => {
        msg += `• ${b.replace(/_/g, ' ')}\n`;
      });
      msg += '\n💡 اكتب: ديكوري [الاسم]\n';
      msg += '💡 لتعطيل الديكور: ديكوري بدون';
      return msg;
    }

    const choice = args.join(' ').replace(/\s+/g, '_');

    if (choice === 'بدون') {
      user.displayedBadge = null;
      await user.save();
      return '✅ تم إخفاء الديكور';
    }

    const match = badges.find(b => b === choice || b.replace(/_/g, ' ') === args.join(' '));
    if (!match) return '❌ لم تجد هذا الديكور';

    user.displayedBadge = match;
    await user.save();
    return `✅ تم تفعيل: ${match.replace(/_/g, ' ')}`;
  }

  async _handleAddProduct(admin, args) {
    if (args.length < 4) {
      return `❌ الاستخدام: اضف_منتج [الاسم] [السعر] [الكمية] [الوصف]

مثال:
اضف منتج بطاقة_البرج 200 1 بطاقة برج مميزة`;
    }
    const name = args[0];
    const price = parseInt(args[1]);
    const quantity = parseInt(args[2]);
    const description = args.slice(3).join(' ');
    if (isNaN(price) || isNaN(quantity)) return '❌ أرقام خاطئة';
    const result = await this.shop.addItem(name, price, quantity, description, 'external');
    return result.message || result.error;
  }

  async _handleAddWheel(admin, args) {
    if (args.length < 3) {
      return `❌ الاستخدام: اضف_دولاب [الاسم] [السعر] [الجوائز]

مثال:
اضف دولاب دولاب_ذهبي 500 600,300,تخطي_سؤال,0`;
    }

    const name = args[0];
    const price = parseInt(args[1]);
    if (isNaN(price) || price <= 0) return '❌ سعر غير صالح';

    const prizesText = args.slice(2).join(' ');
    const prizes = this.shop.parsePrizes(prizesText);

    if (prizes.length < 2) return '❌ يجب توفير جوائزين على الأقل';

    for (const p of prizes) {
      if (p.type === 'item') {
        const ShopItem = (await import('../models/ShopItem.js')).default;
        const found = await ShopItem.findOne({ name: p.value });
        if (!found) return `❌ المنتج "${p.value.replace(/_/g, ' ')}" غير موجود`;
      }
    }

    const result = await this.shop.addItem(name, price, -1, 'دولاب حظ', 'wheel', prizes);
    if (result.error) return result.error;

    let msg = `✅ تم إنشاء الدولاب: ${name.replace(/_/g, ' ')}\n\n`;
    msg += `💰 السعر: ${price} ريو\n`;
    msg += `🎁 الجوائز (${prizes.length}):\n`;
    prizes.forEach(p => {
      if (p.type === 'rio') {
        msg += `• ${p.value > 0 ? '+' + p.value : '0'} ريو\n`;
      } else {
        msg += `• ${p.value.replace(/_/g, ' ')}\n`;
      }
    });
    return msg;
  }
            }
