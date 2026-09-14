// core/CommandHandler.js
import { ACHIEVEMENTS } from '../systems/AchievementSystem.js';

export default class CommandHandler {
  constructor(systems) {
    this.userSystem = systems.userSystem;
    this.points = systems.pointsSystem;
    this.dailyGift = systems.dailyGift;
    this.game = systems.game;
    this.shop = systems.shop;
    this.codes = systems.codes;
    this.referral = systems.referral;
    this.achievements = systems.achievements;
    this.missions = systems.missions;
    this.leaderboard = systems.leaderboard;
    this.admin = systems.adminSystem;
    console.log('🎯 CommandHandler جاهز');
  }

  async process(sender, message) {
    const text = (message || '').trim();
    if (!text) return null;

    // ✅ الحصول/إنشاء المستخدم
    const user = await this.userSystem.getOrCreate(sender.id, sender.platform);

    // ✅ التجميد
    if (user.isFrozen) {
      const allowed = ['نقاطي', 'ملفي', 'مساعدة', 'توب', 'معرفي'];
      const cmd = text.split(/\s+/)[0];
      if (!allowed.includes(cmd)) {
        if (this.userSystem.shouldNotifyFrozen(user)) {
          await this.userSystem.markFrozenNotified(user);
          return '❄️ حسابك مجمد. تواصل مع الإدارة.';
        }
        return null;
      }
    }

    // ✅ تحليل الأمر
    const parts = text.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    // ✅ الأوامر
    switch (cmd) {
      case 'بدء':
      case 'start':
        return this._welcome(user);
      case 'مساعدة':
        return this._help(user);
      case 'معرفي':
        return `🆔 معرفك: ${user.userId}`;
      case 'نقاطي':
        return this._balance(user);
      case 'ملفي':
        return this._profile(user);
      case 'توب':
        return await this.leaderboard.top10();

      case 'هدية':
        return await this._handleGift(user);

      case 'العب':
        return await this._handlePlay(user);

      case 'تحدي':
        return await this._handleChallenge(user);

      case 'كود':
        return await this._handleCode(user, args);

      case 'احالتي':
        return await this.referral.showCode(user);

      case 'صديق':
        return await this._handleReferral(user, args);

      case 'سوق':
        return await this.shop.showShop();

      case 'اشتر':
        return await this._handleBuy(user, args);

      case 'مشترياتي':
        return this._purchases(user);

      case 'مهام':
        return await this.missions.show(user);

      case '50':
      case '50:50':
        return await this._handleFifty(user);

      case 'تخطي':
        return await this._handleSkip(user);

      // ✅ إجابات اللعبة (أ ب ج د)
      case 'أ': case 'ا': case 'a': case '1':
      case 'ب': case 'b': case '2':
      case 'ج': case 'c': case '3':
      case 'د': case 'd': case '4':
        return await this._handleGameAnswer(user, cmd);

      // ===================================
      // ✅ أوامر الأدمن
      // ===================================
      case 'اضف_نقاط':
      case 'اضف_ريو':
        if (!this._guardAdmin(user)) return this._notAdmin();
        return await this.admin.addPoints(user, args[0], parseInt(args[1]));
      case 'خصم_نقاط':
      case 'خصم_ريو':
        if (!this._guardAdmin(user)) return this._notAdmin();
        return await this.admin.removePoints(user, args[0], parseInt(args[1]));
      case 'عدل_نقاط':
        if (!this._guardAdmin(user)) return this._notAdmin();
        return await this.admin.setPoints(user, args[0], parseInt(args[1]));

      case 'تجميد':
        if (!this._guardAdmin(user)) return this._notAdmin();
        return await this.admin.freeze(user, args[0]);
      case 'فك_تجميد':
        if (!this._guardAdmin(user)) return this._notAdmin();
        return await this.admin.unfreeze(user, args[0]);
      case 'حذف':
        if (!this._guardAdmin(user)) return this._notAdmin();
        return await this.admin.deleteUser(user, args[0]);
      case 'عرض_لاعب':
        if (!this._guardAdmin(user)) return this._notAdmin();
        return await this.admin.showPlayer(args[0]);

      case 'عرض_اللاعبين':
        if (!this._guardAdmin(user)) return this._notAdmin();
        return await this.admin.listPlayers(parseInt(args[0]) || 1);
      case 'عرض_المجمدين':
        if (!this._guardAdmin(user)) return this._notAdmin();
        return await this.admin.listFrozen();
      case 'عرض_الاكواد':
        if (!this._guardAdmin(user)) return this._notAdmin();
        return await this.codes.listAll();
      case 'عرض_المنتجات':
        if (!this._guardAdmin(user)) return this._notAdmin();
        return await this.shop.listAll();
      case 'احصائيات':
        if (!this._guardAdmin(user)) return this._notAdmin();
        return await this.admin.stats();

      case 'اضف_منتج':
        if (!this._guardAdmin(user)) return this._notAdmin();
        return await this._handleAddProduct(user, args);
      case 'حذف_منتج':
        if (!this._guardAdmin(user)) return this._notAdmin();
        return (await this.shop.removeItem(args.join(' '))).message || '❌ فشل';
      case 'عدل_منتج':
        if (!this._guardAdmin(user)) return this._notAdmin();
        return (await this.shop.editItem(args[0], args[1], args.slice(2).join(' '))).message || '❌ فشل';

      case 'اضف_كود':
        if (!this._guardAdmin(user)) return this._notAdmin();
        return (await this.codes.create(args[0], parseInt(args[1]), parseInt(args[2]), user.userId)).message || '❌ فشل';
      case 'حذف_كود':
        if (!this._guardAdmin(user)) return this._notAdmin();
        return (await this.codes.remove(args[0])).message || '❌ فشل';

      case 'اعطي_ادمن':
        if (!this._guardAdmin(user)) return this._notAdmin();
        return await this.admin.promote(user, args[0]);
      case 'ازل_ادمن':
        if (!this._guardAdmin(user)) return this._notAdmin();
        return await this.admin.demote(user, args[0]);

      case 'رسالة': {
        if (!this._guardAdmin(user)) return this._notAdmin();
        const res = await this.admin.sendMessage(user, args[0], args.slice(1).join(' '));
        if (res.error) return res.error;
        return { sendTo: res.sendTo };
      }

      default:
        return null; // صمت لأي أمر غير معروف
    }
  }

  _guardAdmin(user) {
    return this.admin.isAdmin(user);
  }

  _notAdmin() {
    return null; // صمت
  }

  _welcome(user) {
    if (user.userId === 'M000R') {
      return `👑 مرحباً بك يا ملك\n\n🆔 ${user.userId}\n\n💡 "مساعدة" لعرض الأوامر`;
    }
    return `🏔️ مرحباً بك في مغارة ريو\n\n🆔 معرفك: ${user.userId}\n💰 رصيدك: ${user.rio} ريو\n\n💡 اكتب "مساعدة" للأوامر`;
  }

  _help(user) {
    let msg = '📋 الأوامر المتاحة\n\n';
    msg += '👤 أساسية:\n';
    msg += '• معرفي — معرفك\n';
    msg += '• نقاطي — رصيدك\n';
    msg += '• ملفي — كل التفاصيل\n';
    msg += '• توب — أفضل 10\n\n';

    msg += '🎮 الألعاب:\n';
    msg += '• العب — لعبة جديدة\n';
    msg += '• تحدي — تحدي اليوم\n';
    msg += '• أ/ب/ج/د — إجابتك\n\n';

    msg += '🎁 الفعاليات:\n';
    msg += '• هدية — الهدية اليومية\n';
    msg += '• كود [X] — استرداد\n';
    msg += '• احالتي — كود الإحالة\n';
    msg += '• صديق [X] — إحالة صديق\n\n';

    msg += '🛒 السوق:\n';
    msg += '• سوق — عرض المنتجات\n';
    msg += '• اشتر [الاسم] — شراء\n';
    msg += '• مشترياتي — سجل مشترياتك\n\n';

    msg += '📋 إضافية:\n';
    msg += '• مهام — المهام الأسبوعية\n';

    if (user.isAdmin) {
      msg += '\n👑 اكتب "مدير" لأوامر الأدمن';
    }
    return msg;
  }

  _balance(user) {
    return `💰 رصيدك\n\n🆔 ${user.userId}\n💎 ${user.rio} ريو\n⭐ المستوى: ${user.level}\n📊 إجمالي: ${user.totalEarned}\n🔥 Streak: ${user.streak}`;
  }

  _profile(user) {
    const bonus = this.points.getBonus(user);
    let msg = `👤 ملفك\n\n`;
    msg += `🆔 ${user.userId}\n`;
    msg += `💰 الرصيد: ${user.rio} ريو\n`;
    msg += `📊 الإجمالي: ${user.totalEarned}\n`;
    msg += `⭐ المستوى: ${user.level}`;
    if (bonus.title) msg += ` (${bonus.title})`;
    msg += '\n';
    msg += `🔥 Streak: ${user.streak}\n`;
    msg += `🎮 ألعاب: ${user.gamesPlayed}\n`;
    msg += `🏆 انتصارات: ${user.gamesWon}\n`;
    msg += `👥 إحالات: ${user.referralCount}\n\n`;

    msg += `🎖️ الشارات:\n`;
    msg += this.achievements.listForUser(user);

    if (bonus.time > 0 || bonus.discount > 0) {
      msg += '\n\n💎 ميزات المستوى:\n';
      if (bonus.time > 0) msg += `• +${bonus.time} ثانية\n`;
      if (bonus.discount > 0) msg += `• خصم ${bonus.discount}%\n`;
    }

    return msg;
  }

  async _handleGift(user) {
    const result = await this.dailyGift.claim(user);
    if (result.error) return result.error;
    await this.missions.track(user, 'gifts');
    const completed = await this.missions.check(user);
    let msg = result.message;
    if (completed.length > 0) msg += `\n\n🎉 مهمة مكتملة: ${completed[0].name} (+${completed[0].reward} ريو)`;
    return msg;
  }

  async _handlePlay(user) {
    // إذا كان في لعبة نشطة
    const active = await this.game.getActiveGame(user.userId);
    if (active) return '🎮 لديك لعبة نشطة. أجب على السؤال الحالي.';

    const msg = await this.game.start(user, 'easy');
    return msg;
  }

  async _handleGameAnswer(user, answer) {
    const result = await this.game.handleAnswer(user, answer);
    if (result.error === null) return null; // صمت
    if (result.error) return result.error;

    // فحص الإحالة بعد أول لعبة مكتملة
    if (user.gamesPlayed === 1) {
      await this.referral.completeReferral(user);
    }

    // تتبع المهام
    if (user.gamesPlayed > 0) {
      await this.missions.track(user, 'gamesPlayed');
      if (result.message.includes('5/5')) {
        await this.missions.track(user, 'gamesWon');
      }
      await this.missions.check(user);
    }

    // شارات الرصيد
    await this.achievements.checkRioAchievements(user);

    return result.message;
  }

  async _handleChallenge(user) {
    const { today } = await import('../utils/helpers.js');
    if (user.lastDailyChallenge === today()) {
      return '⏰ حللت تحدي اليوم. عد غدًا!';
    }

    const active = await this.game.getActiveGame(user.userId);
    if (active) return '🎮 أنهِ لعبتك الحالية أولًا.';

    user.lastDailyChallenge = today();
    await user.save();

    return await this.game.start(user, 'medium');
  }

  async _handleCode(user, args) {
    if (!args[0]) return null;
    const result = await this.codes.redeem(user, args[0]);
    if (result.error === null) return null;
    return result.message;
  }

  async _handleReferral(user, args) {
    if (!args[0]) return null;
    const result = await this.referral.useReferral(user, args[0]);
    if (result.error === null) return null;
    return result.message || result.error;
  }

  async _handleBuy(user, args) {
    if (!args[0]) return null;
    const result = await this.shop.purchase(user, args.join(' '));
    if (result.error) return result.error;

    await this.missions.track(user, 'purchases');
    await this.missions.check(user);
    await this.achievements.checkRioAchievements(user);

    return result.message;
  }

  _purchases(user) {
    if (!user.purchases || user.purchases.length === 0) return '📦 لا توجد مشتريات';

    let msg = '📦 مشترياتك:\n\n';
    user.purchases.slice(-10).forEach(p => {
      msg += `• ${p.item} — ${p.price} ريو\n`;
    });
    return msg;
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
