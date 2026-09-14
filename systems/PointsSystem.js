// systems/PointsSystem.js
import User from '../models/User.js';
import { getLevelFromEarned, getLevelBonus } from '../utils/helpers.js';

export default class PointsSystem {
  constructor() {
    console.log('💰 PointsSystem جاهز');
  }

  // ✅ إضافة ريو (يؤثر على totalEarned → المستوى)
  async addRio(user, amount) {
    if (amount <= 0) return user;
    user.rio += amount;
    user.totalEarned += amount;
    user.level = getLevelFromEarned(user.totalEarned);
    await user.save();
    return user;
  }

  // ✅ خصم ريو (لا يؤثر على totalEarned → المستوى محفوظ)
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
      gamesPlayed: user.gamesPlayed,
      gamesWon: user.gamesWon,
      achievements: user.achievements.length,
      referralCount: user.referralCount,
      bonusTime: bonus.time,
      bonusDiscount: bonus.discount + (user.permanentPerks?.extraDiscount || 0),
      title: bonus.title
    };
  }
}
