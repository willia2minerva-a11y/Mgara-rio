// systems/DailyGiftSystem.js
import { today, daysBetween, getStreakBonus } from '../utils/helpers.js';

export default class DailyGiftSystem {
  constructor(pointsSystem, achievementSystem) {
    this.points = pointsSystem;
    this.achievements = achievementSystem;
    console.log('🎁 DailyGiftSystem جاهز');
  }

  async claim(user) {
    const now = today();

    if (user.lastGiftDate === now) {
      return { error: '⏰ استلمت هديتك اليوم. عد غدًا!' };
    }

    // حساب Streak
    let newStreak = 1;
    if (user.lastGiftDate) {
      const diff = daysBetween(user.lastGiftDate, now);
      if (diff === 1) newStreak = user.streak + 1;
      else newStreak = 1;
    }

    const baseReward = 1;
    const streakBonus = getStreakBonus(newStreak);
    const extraGift = user.permanentPerks?.extraGift || 0;
    const totalReward = baseReward + extraGift + (streakBonus > 1 ? streakBonus - 1 : 0);

    user.streak = newStreak;
    user.lastGiftDate = now;

    await this.points.addRio(user, totalReward);

    // الشارات
    if (newStreak === 7) await this.achievements.unlock(user, 'week_streak');
    if (newStreak === 30) await this.achievements.unlock(user, 'month_streak');
    if (newStreak === 365) await this.achievements.unlock(user, 'year_streak');
    await this.achievements.unlock(user, 'first_gift');

    await user.save();

    // ✅ تنسيق جديد
    let msg = `🎁 هدية اليوم\n\n`;
    msg += `+${totalReward} ريو\n\n`;

    if (streakBonus > 1) {
      msg += `🎉 مكافأة Streak: +${streakBonus - 1} إضافية\n\n`;
    }

    msg += `🔥 ${newStreak} يوم متتالي\n`;
    msg += `💰 المجموع: ${user.rio} ريو`;

    return { success: true, message: msg };
  }
}
