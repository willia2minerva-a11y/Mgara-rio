// systems/LeaderboardSystem.js
import User from '../models/User.js';

const BADGE_ICONS = {
  badge_frame: '🌟',
  badge_gold: '🎖️',
  badge_flame: '🔥',
  badge_royal: '👑'
};

export default class LeaderboardSystem {
  constructor() {
    console.log('🏆 LeaderboardSystem جاهز');
  }

  async top10() {
    const users = await User.find({ isFrozen: false })
      .sort({ totalEarned: -1 })
      .limit(10)
      .select('userId customName displayedBadge totalEarned');

    if (users.length === 0) return '🏆 لا يوجد لاعبون بعد';

    let msg = '🏆 أفضل 10\n\n';
    users.forEach((u, i) => {
      const medal = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      const displayName = u.customName ? `"${u.customName}"` : u.userId;
      const badge = u.displayedBadge ? ` ${BADGE_ICONS[u.displayedBadge] || ''}` : '';
      msg += `${medal} ${displayName}${badge} — ${u.totalEarned} ريو\n`;
    });

    return msg.trim();
  }
}
