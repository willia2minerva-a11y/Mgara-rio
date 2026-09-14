// systems/AchievementSystem.js

export const ACHIEVEMENTS = {
  first_gift: { icon: '🥇', name: 'أول هدية' },
  week_streak: { icon: '🔥', name: '7 أيام متتالية' },
  month_streak: { icon: '🌟', name: '30 يوم' },
  year_streak: { icon: '💫', name: '365 يوم' },
  first_win: { icon: '🎯', name: 'أول فوز' },
  perfect_5: { icon: '🧠', name: '5/5 في جولة' },
  fast_answer: { icon: '⚡', name: 'إجابة سريعة' },
  first_purchase: { icon: '💰', name: 'أول شراء' },
  big_buyer: { icon: '🛍️', name: '10 مشتريات' },
  rich_1000: { icon: '💎', name: '1000 ريو' },
  rich_10000: { icon: '👑', name: '10000 ريو' },
  level_10: { icon: '⭐', name: 'المستوى 10' },
  level_50: { icon: '🏆', name: 'المستوى 50' },
  daily_50: { icon: '📚', name: '50 تحدي' },
  referral_5: { icon: '👥', name: '5 إحالات' }
};

export default class AchievementSystem {
  constructor(pointsSystem) {
    this.points = pointsSystem;
    console.log('🎖️ AchievementSystem جاهز');
  }

  async unlock(user, key, checkValue = null) {
    if (user.achievements.includes(key)) return false;

    // فحوصات خاصة
    if (key === 'referral_5' && checkValue !== null && checkValue < 5) return false;

    user.achievements.push(key);
    await user.save();
    return true;
  }

  async checkRioAchievements(user) {
    if (user.totalEarned >= 1000) await this.unlock(user, 'rich_1000');
    if (user.totalEarned >= 10000) await this.unlock(user, 'rich_10000');
    if (user.level >= 10) await this.unlock(user, 'level_10');
    if (user.level >= 50) await this.unlock(user, 'level_50');
  }

  listForUser(user) {
    const unlocked = user.achievements || [];
    if (unlocked.length === 0) return 'لا توجد شارات بعد';

    return unlocked.map(key => {
      const a = ACHIEVEMENTS[key];
      return a ? `${a.icon} ${a.name}` : `❓ ${key}`;
    }).join('\n');
  }
}
