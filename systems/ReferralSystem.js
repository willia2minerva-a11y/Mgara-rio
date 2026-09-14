// systems/ReferralSystem.js
import User from '../models/User.js';
import { today } from '../utils/helpers.js';

export default class ReferralSystem {
  constructor(pointsSystem, achievementSystem) {
    this.points = pointsSystem;
    this.achievements = achievementSystem;
    console.log('👥 ReferralSystem جاهز');
  }

  async showCode(user) {
    return `👥 كود الإحالة الخاص بك\n\n🆔 ${user.referralCode}\n\n📤 شاركه مع أصدقائك!\n💰 كل صديق يلعب أول لعبة → +1 ريو لك\n\n💡 لإرسال كود صديقك: صديق [كوده]`;
  }

  async useReferral(newUser, code) {
    const clean = code.trim().toUpperCase();

    // لا يمكن استخدام كودك الخاص
    if (clean === newUser.userId) {
      return { error: null }; // صمت
    }

    // هل استخدم كودًا سابقًا؟
    if (newUser.referredBy) {
      return { error: null }; // صمت
    }

    // البحث عن صاحب الكود
    const referrer = await User.findOne({ userId: clean });
    if (!referrer) return { error: null }; // صمت

    // حد يومي
    const todayStr = today();
    if (referrer.lastReferralDate !== todayStr) {
      referrer.referralRewardsToday = 0;
      referrer.lastReferralDate = todayStr;
    }

    if (referrer.referralRewardsToday >= 3) {
      return { error: '⏰ صاحب الكود وصل الحد اليومي. حاول غدًا.' };
    }

    // تسجيل الإحالة (معلقة — تُحتسب بعد أول لعبة)
    newUser.referredBy = referrer.userId;
    await newUser.save();

    return {
      success: true,
      message: `✅ تم تفعيل كود الإحالة!\n\n🎮 العب أول لعبة كاملة لتحصل على +1 ريو\n💡 المُحيل سيحصل على +1 ريو أيضًا`,
      pendingReferrer: referrer.userId
    };
  }

  // ✅ يُستدعى بعد إكمال أول لعبة
  async completeReferral(user) {
    if (!user.referredBy) return;
    if (user.referralCount > 0) return; // سبق أن أكمل

    const referrer = await User.findOne({ userId: user.referredBy });
    if (!referrer) {
      user.referredBy = null;
      await user.save();
      return;
    }

    // إعادة فحص الحد اليومي
    const todayStr = today();
    if (referrer.lastReferralDate !== todayStr) {
      referrer.referralRewardsToday = 0;
      referrer.lastReferralDate = todayStr;
    }

    if (referrer.referralRewardsToday >= 3) {
      return; // تجاوز الحد
    }

    // منح المكافآت
    await this.points.addRio(referrer, 1);
    await this.points.addRio(user, 1);

    referrer.referralCount += 1;
    referrer.referralRewardsToday += 1;
    await referrer.save();

    user.referralCount = 1;
    user.referredBy = null; // منع التكرار
    await user.save();

    await this.achievements.unlock(referrer, 'referral_5', referrer.referralCount);
  }
}
