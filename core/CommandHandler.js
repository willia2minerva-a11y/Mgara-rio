// core/CommandHandler.js
import { today } from '../utils/helpers.js';

const COMPOUND_COMMANDS = [
  'اضف_نقاط', 'خصم_نقاط', 'عدل_نقاط',
  'فك_تجميد',
  'عرض_لاعب', 'عرض_اللاعبين', 'عرض_المجمدين',
  'عرض_الاكواد', 'عرض_المنتجات',
  'اضف_منتج', 'حذف_منتج', 'عدل_منتج',
  'اضف_كود', 'حذف_كود',
  'اضف_دولاب', 'حذف_دولاب',
  'اعطي_ادمن', 'ازل_ادمن',
  'اضف_ريو', 'خصم_ريو'
];

const ALIASES = {
  // بدء
  'مرحبا': 'بدء', 'اهلا': 'بدء', 'هلا': 'بدء', 'هاي': 'بدء',
  'السلام عليكم': 'بدء', 'hi': 'بدء', 'hello': 'بدء', 'start': 'بدء',
  'تفعيل': 'بدء', 'تشغيل': 'بدء', 'بداية': 'بدء',

  // مساعدة
  'اوامر': 'مساعدة', 'الاوامر': 'مساعدة', 'help': 'مساعدة',

  // أقسام
  'حساب': 'قسم_الحساب', 'الحساب': 'قسم_الحساب',

  // السوق
  'متجر': 'سوق', 'المتجر': 'سوق', 'shop': 'سوق',

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

  // المهام
  'المهام': 'مهام', 'missions': 'مهام',

  // الإدارة
  'الادمن': 'مدير', 'admin': 'مدير',

  // المشتريات
  'مشتريات': 'مشترياتي', 'سجلي': 'مشترياتي',

  // الألعاب
  'العاب': 'العاب', 'games': 'العاب'
};

const LINKS = {
  page: process.env.PAGE_LINK || 'https://facebook.com/MgaraRio',
  group: process.env.GROUP_LINK || 'https://facebook.com/groups/MgaraRio'
};

// ✅ أحرف/إجابات الألعاب
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
    console.log('🎯 CommandHandler جاهز');
  }

  async process(sender, message) {
    const text = (message || '').trim();
    if (!text) return null;

    const user = await this.userSystem.getOrCreate(sender.id, sender.platform);

    // ✅ التجميد
    if (user.isFrozen) {
      const allowed = ['نقاطي', 'ملفي', 'مساعدة', 'توب', 'معرفي'];
      const firstWord = text.split(/\s+/)[0];
      if (!allowed.includes(firstWord)) {
        if (this.userSystem.shouldNotifyFrozen(user)) {
          await this.userSystem.markFrozenNotified(user);
          return '❄️ حسابك مجمد. تواصل مع الإدارة.';
        }
        return null;
      }
    }

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

    try {
      // ✅ فحص إجابة لعبة نشطة (أولوية عالية)
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
          if (!this.admin.isAdmin(user)) return null;
          return this._adminHelp();

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

        // ===== أوامر الأدمن =====
        case 'اضف_نقاط': case 'اضف_ريو':
          if (!this.admin.isAdmin(user)) return null;
          return await this.admin.addPoints(user, args[0], parseInt(args[1]));

        case 'خصم_نقاط': case 'خصم_ريو':
          if (!this.admin.isAdmin(user)) return null;
          return await this.admin.removePoints(user, args[0], parseInt(args[1]));

        case 'عدل_نقاط':
          if (!this.admin.isAdmin(user)) return null;
          return await this.admin.setPoints(user, args[0], parseInt(args[1]));

        case 'تجميد':
          if (!this.admin.isAdmin(user)) return null;
          return await this.admin.freeze(user, args[0]);

        case 'فك_تجميد':
          if (!this.admin.isAdmin(user)) return null;
          return await this.admin.unfreeze(user, args[0]);

        case 'حذف':
          if (!this.admin.isAdmin(user)) return null;
          return await this.admin.deleteUser(user, args[0]);

        case 'عرض_لاعب':
          if (!this.admin.isAdmin(user)) return null;
          return await this.admin.showPlayer(args[0]);

        case 'عرض_اللاعبين':
          if (!this.admin.isAdmin(user)) return null;
          return await this.admin.listPlayers(parseInt(args[0]) || 1);

        case 'عرض_المجمدين':
          if (!this.admin.isAdmin(user)) return null;
          return await this.admin.listFrozen();

        case 'عرض_الاكواد':
          if (!this.admin.isAdmin(user)) return null;
          return await this.codes.listAll();

        case 'عرض_المنتجات':
          if (!this.admin.isAdmin(user)) return null;
          return await this.shop.listAll();

        case 'احصائيات':
          if (!this.admin.isAdmin(user)) return null;
          return await this.admin.stats();

        case 'اضف_منتج':
          if (!this.admin.isAdmin(user)) return null;
          return await this._handleAddProduct(user, args);

        case 'حذف_منتج':
          if (!this.admin.isAdmin(user)) return null;
          return (await this.shop.removeItem(args.join(' '))).message || null;

        case 'عدل_منتج':
          if (!this.admin.isAdmin(user)) return null;
          return (await this.shop.editItem(args[0], args[1], args.slice(2).join(' '))).message || null;

        case 'اضف_دولاب':
          if (!this.admin.isAdmin(user)) return null;
          return await this._handleAddWheel(user, args);

        case 'اضف_كود':
          if (!this.admin.isAdmin(user)) return null;
          return (await this.codes.create(args[0], parseInt(args[1]), parseInt(args[2]), user.userId)).message || null;

        case 'حذف_كود':
          if (!this.admin.isAdmin(user)) return null;
          return (await this.codes.remove(args[0])).message || null;

        case 'اعطي_ادمن':
          if (!this.admin.isAdmin(user)) return null;
          return await this.admin.promote(user, args[0]);

        case 'ازل_ادمن':
          if (!this.admin.isAdmin(user)) return null;
          return await this.admin.demote(user, args[0]);

        case 'رسالة': {
          if (!this.admin.isAdmin(user)) return null;
          const res = await this.admin.sendMessage(user, args[0], args.slice(1).join(' '));
          if (res.error) return res.error;
          return { sendTo: res.sendTo };
        }

        default:
          return null;
      }
    } catch (error) {
      console.error('❌ خطأ في معالجة الأمر:', error.message);
      return null;
    }
  }

  // ===================================
  // ✅ معالجة إجابة لعبة نشطة
  // ===================================
  async _handleGameAnswer(user, text) {
    // فحص اللعبة النشطة
    const active = await this.gameSystem.hasActiveGame(user);
    if (!active) return null;

    const result = await this.gameSystem.handleAnswer(user, active.key, text);
    if (result.silent) return null;
    if (result.error) return result.error;

    // معالجة إضافية
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
  // الرسائل الأساسية
  // ===================================
  _welcome(user) {
    if (user.isAdmin) {
      return `👑 مرحباً ملك

🎮 معرفك: ${user.userId}
💰 رصيدك: ${user.rio} ريو

💡 مساعدة — كل الأوامر
👑 مدير — أوامر الأدمن`;
    }
    return `🏔️ مغارة ريو

أهلاً بك!

🎮 معرفك: ${user.userId}
💰 رصيدك: ${user.rio} ريو

💡 مساعدة — كل الأوامر`;
  }

  _help(user) {
    let msg = '📋 الأوامر\n\n';
    msg += '👤 الحساب\n';
    msg += 'معرفي • نقاطي • ملفي • توب\n\n';
    msg += '🎮 اللعب\n';
    msg += 'العاب • العب\n\n';
    msg += '🎁 الفعاليات\n';
    msg += 'هدية • كود • احالتي • صديق\n\n';
    msg += '🛒 السوق\n';
    msg += 'سوق • اشتر • مشترياتي\n\n';
    msg += '📋 المهام\n';
    msg += 'مهام\n';
    if (user.isAdmin) {
      msg += '\n👑 الإدارة\n';
      msg += 'مدير';
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

  _adminHelp() {
    let msg = '👑 أوامر الأدمن\n\n';
    msg += '💰 النقاط\n';
    msg += 'اضف_نقاط [ID] [الكمية]\n';
    msg += 'خصم_نقاط [ID] [الكمية]\n';
    msg += 'عدل_نقاط [ID] [الكمية]\n\n';
    msg += '👥 اللاعبون\n';
    msg += 'تجميد [ID]\n';
    msg += 'فك_تجميد [ID]\n';
    msg += 'حذف [ID]\n';
    msg += 'عرض_لاعب [ID]\n\n';
    msg += '📋 القوائم\n';
    msg += 'عرض_اللاعبين [صفحة]\n';
    msg += 'عرض_المجمدين\n';
    msg += 'عرض_الاكواد\n';
    msg += 'عرض_المنتجات\n';
    msg += 'احصائيات\n\n';
    msg += '🛒 المنتجات\n';
    msg += 'اضف_منتج [الاسم] [السعر] [الكمية] [الوصف]\n';
    msg += 'حذف_منتج [الاسم]\n';
    msg += 'عدل_منتج [الاسم] [الحقل] [القيمة]\n\n';
    msg += '🎡 دولاب الحظ\n';
    msg += 'اضف_دولاب [الاسم] [السعر] [الجوائز]\n\n';
    msg += '🎫 الأكواد\n';
    msg += 'اضف_كود [الكود] [الريو] [العدد]\n';
    msg += 'حذف_كود [الكود]\n\n';
    msg += '👑 الأدمن\n';
    msg += 'اعطي_ادمن [ID]\n';
    msg += 'ازل_ادمن [ID]\n\n';
    msg += '📩 التواصل\n';
    msg += 'رسالة [ID] [النص]\n\n';
    msg += '💡 الأوامر تقبل _ أو مسافة';
    return msg;
  }

  _myId(user) {
    return `🆔 معلوماتك

🎮 معرف اللعبة: ${user.userId}
📱 معرف المنصة: ${user.platformId}
🌐 المنصة: ${user.platform}${user.isAdmin ? '\n👑 أدمن: نعم' : ''}`;
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

  // ===================================
  // الفعاليات
  // ===================================
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
صديق M001R

🎁 المكافأة:
+1 ريو لك
+1 ريو لصديقك (بعد أول لعبة)`;
    }

    const result = await this.referral.useReferral(user, args[0]);
    if (result && result.success) return result.message;
    if (result && result.error && typeof result.error === 'string') return result.error;
    return null;
  }

  // ===================================
  // السوق
  // ===================================
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

  // ===================================
  // الاسم المخصص
  // ===================================
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
• عربية أو إنجليزية أو أرقام
• بدون رموز`;
    }

    const newName = args.join(' ').trim();

    if (newName.length < 3 || newName.length > 10) {
      return '❌ الاسم يجب أن يكون بين 3 و 10 أحرف';
    }

    if (!/^[\u0600-\u06FFa-zA-Z0-9]+$/.test(newName)) {
      return '❌ الاسم يحتوي على رموز غير مسموحة';
    }

    const BAD_WORDS = ['ادمن', 'admin', 'owner', 'mgara', 'ريو', 'M000R'];
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

  // ===================================
  // اختيار الديكور
  // ===================================
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

  // ===================================
  // إضافة منتج (أدمن)
  // ===================================
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

  // ===================================
  // إضافة دولاب (أدمن)
  // ===================================
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
