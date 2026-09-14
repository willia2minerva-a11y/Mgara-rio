// core/CommandHandler.js
import { today } from '../utils/helpers.js';

// ✅ الأوامر المركبة (تقبل _ ومسافة)
const COMPOUND_COMMANDS = [
  'اضف_نقاط', 'خصم_نقاط', 'عدل_نقاط',
  'فك_تجميد',
  'عرض_لاعب', 'عرض_اللاعبين', 'عرض_المجمدين',
  'عرض_الاكواد', 'عرض_المنتجات',
  'اضف_منتج', 'حذف_منتج', 'عدل_منتج',
  'اضف_كود', 'حذف_كود',
  'اعطي_ادمن', 'ازل_ادمن',
  'اضف_ريو', 'خصم_ريو'
];

export default class CommandHandler {
  constructor(systems) {
    this.userSystem = systems.userSystem;
    this.points = systems.pointsSystem;
    this.dailyGift = systems.dailyGift;
    this.game = systems.game;
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

    // ✅ تحليل الأمر (دعم الأوامر المركبة)
    const parts = text.split(/\s+/);
    let cmd = parts[0];
    let args = parts.slice(1);

    // إذا أول كلمتين تشكلان أمراً مركباً
    if (parts.length >= 2) {
      const twoWord = parts.slice(0, 2).join('_');
      if (COMPOUND_COMMANDS.includes(twoWord)) {
        cmd = twoWord;
        args = parts.slice(2);
      }
    }

    try {
      switch (cmd) {
        // ===== أساسية =====
        case 'بدء':
        case 'start':
          return this._welcome(user);

        case 'مساعدة':
        case 'help':
          return this._help(user);

        case 'مدير':
        case 'admin':
          if (!this.admin.isAdmin(user)) return null;
          return this._adminHelp();

        case 'معرفي':
        case 'id':
          return this._myId(user);

        case 'نقاطي':
        case 'رصيدي':
          return this._balance(user);

        case 'ملفي':
        case 'بروفايلي':
        case 'profile':
          return this._profile(user);

        case 'توب':
        case 'top':
          return await this.leaderboard.top10();

        // ===== الألعاب =====
        case 'العب':
        case 'play':
          return await this._handlePlay(user);

        case 'تحدي':
        case 'challenge':
          return await this._handleChallenge(user);

        case 'أ': case 'ا': case 'a': case '1':
        case 'ب': case 'b': case '2':
        case 'ج': case 'c': case '3':
        case 'د': case 'd': case '4':
          return await this._handleGameAnswer(user, cmd);

        case '50':
        case '50:50':
          return await this._handleFifty(user);

        case 'تخطي':
          return await this._handleSkip(user);

        // ===== الفعاليات =====
        case 'هدية':
        case 'gift':
          return await this._handleGift(user);

        case 'كود':
          return await this._handleCode(user, args);

        case 'احالتي':
        case 'كودي':
          return await this.referral.showCode(user);

        case 'صديق':
          return await this._handleReferral(user, args);

        // ===== السوق =====
        case 'سوق':
        case 'shop':
          return await this.shop.showShop();

        case 'اشتر':
        case 'buy':
          return await this._handleBuy(user, args);

        case 'مشترياتي':
          return this._purchases(user);

        case 'مهام':
          return await this.missions.show(user);

        // ===== أوامر الأدمن =====
        case 'اضف_نقاط':
        case 'اضف_ريو':
          if (!this.admin.isAdmin(user)) return null;
          return await this.admin.addPoints(user, args[0], parseInt(args[1]));

        case 'خصم_نقاط':
        case 'خصم_ريو':
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
    msg += 'العب • تحدي\n\n';

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
    msg += `💰 الرصيد: ${user.rio} ريو\n`;
    msg += `📊 الإجمالي: ${user.totalEarned}\n`;
    msg += `⭐ المستوى: ${user.level}`;
    if (bonus.title) msg += ` (${bonus.title})`;
    msg += '\n';
    msg += `🔥 Streak: ${user.streak}\n`;
    msg += `🎮 ألعاب: ${user.gamesPlayed}\n`;
    msg += `🏆 انتصارات: ${user.gamesWon}\n`;
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

  // ===================================
  // الألعاب
  // ===================================
  async _handlePlay(user) {
    const active = await this.game.getActiveGame(user.userId);
    if (active) return '🎮 لديك لعبة نشطة. أجب على السؤال الحالي.';

    const todayStr = today();
    if (user.lastGameDate === todayStr) {
      return '🎮 لعبت اليوم. عد غدًا!\n\n💡 جرب "تحدي" للسؤال اليومي';
    }

    user.lastGameDate = todayStr;
    await user.save();

    return await this.game.start(user, 'easy');
  }

  async _handleChallenge(user) {
    const todayStr = today();
    if (user.lastDailyChallenge === todayStr) {
      return '⏰ حللت تحدي اليوم. عد غدًا!';
    }

    const active = await this.game.getActiveGame(user.userId);
    if (active) return '🎮 أنهِ لعبتك الحالية أولًا.';

    user.lastDailyChallenge = todayStr;
    await user.save();

    return await this.game.start(user, 'medium');
  }

  async _handleGameAnswer(user, answer) {
    const result = await this.game.handleAnswer(user, answer);

    if (result.silent) return null;
    if (result.error) return result.error;

    try {
      if (user.gamesPlayed === 1 && user.referredBy) {
        await this.referral.completeReferral(user);
      }

      await this.missions.track(user, 'gamesPlayed');
      if (result.message && result.message.includes('5/5')) {
        await this.missions.track(user, 'gamesWon');
      }
      await this.missions.check(user);
      await this.achievements.checkRioAchievements(user);
    } catch (e) {
      console.error('⚠️ خطأ في المعالجة الإضافية:', e.message);
    }

    return result.message;
  }

  async _handleFifty(user) {
    const active = await this.game.getActiveGame(user.userId);
    if (!active) return null;
    const result = await this.game.useFiftyFifty(user);
    if (result.error) return result.error;
    return result.message;
  }

  async _handleSkip(user) {
    const active = await this.game.getActiveGame(user.userId);
    if (!active) return null;
    const result = await this.game.useSkip(user);
    if (result.error) return result.error;
    return result.message;
  }

  // ===================================
  // الأكواد والإحالة
  // ===================================
  async _handleCode(user, args) {
    if (!args[0]) return null;
    const result = await this.codes.redeem(user, args[0]);
    if (result.error === null || result.error === undefined) return null;
    return result.message || result.error;
  }

  async _handleReferral(user, args) {
    if (!args[0]) return null;
    const result = await this.referral.useReferral(user, args[0]);
    if (result.error === null || result.error === undefined) return null;
    return result.message || result.error;
  }

  // ===================================
  // السوق
  // ===================================
  async _handleBuy(user, args) {
    if (!args[0]) return null;
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
      msg += `• ${p.item} — ${p.price} ريو\n`;
    });
    return msg;
  }

  async _handleAddProduct(admin, args) {
    if (args.length < 4) return '❌ الاستخدام: اضف_منتج [الاسم] [السعر] [الكمية] [الوصف]';
    const name = args[0];
    const price = parseInt(args[1]);
    const quantity = parseInt(args[2]);
    const description = args.slice(3).join(' ');
    if (isNaN(price) || isNaN(quantity)) return '❌ أرقام خاطئة';
    const result = await this.shop.addItem(name, price, quantity, description);
    return result.message || result.error;
  }
  }
