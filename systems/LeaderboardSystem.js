// systems/LeaderboardSystem.js
import User from '../models/User.js';

export default class LeaderboardSystem {
  constructor() {
    console.log('🏆 LeaderboardSystem جاهز');
  }

  async top10() {
    const users = await User.find({ isFrozen: false })
      .sort({ totalEarned: -1 })
      .limit(10)
      .select('userId level totalEarned rio');

    if (users.length === 0) return '🏆 لا يوجد لاعبون بعد';

    let msg = '🏆 أفضل 10 لاعبين\n\n';
    users.forEach((u, i) => {
      const medal = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▪️';
      const title = u.userId === 'M000R' ? ' (ملك)' : '';
      msg += `${medal} ${i + 1}. ${u.userId}${title}\n`;
      msg += `   💰 ${u.totalEarned} ريو | ⭐ Lv.${u.level}\n\n`;
    });

    return msg;
  }
}
