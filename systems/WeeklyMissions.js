// systems/WeeklyMissions.js
import { today } from '../utils/helpers.js';

const MISSIONS = {
  play_5: { name: 'العب 5 ألعاب', target: 5, reward: 5, field: 'gamesPlayed' },
  win_3: { name: 'اربح 3 ألعاب كاملة', target: 3, reward: 5, field: 'gamesWon' },
  buy_1: { name: 'اشترِ منتجًا', target: 1, reward: 3, field: 'purchases' },
  gift_5: { name: 'استلم 5 هدايا', target: 5, reward: 5, field: 'gifts' },
  refer_1: { name: 'ادعُ صديقًا', target: 1, reward: 5, field: 'referrals' }
};

export default class WeeklyMissions {
  constructor(pointsSystem) {
    this.points = pointsSystem;
    console.log('📋 WeeklyMissions جاهز');
  }

  getWeekStart() {
    const now = new Date();
    const day = now.getDay(); // 0=أحد
    const diff = day; // نعود للأحد
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - diff);
    return sunday.toISOString().split('T')[0];
  }

  async ensureWeek(user) {
    const weekStart = this.getWeekStart();
    if (user.weeklyMissions.weekStart !== weekStart) {
      user.weeklyMissions = {
        weekStart,
        gamesPlayed: 0,
        gamesWon: 0,
        purchases: 0,
        gifts: 0,
        referrals: 0,
        completed: []
      };
      await user.save();
    }
  }

  async track(user, field, amount = 1) {
    await this.ensureWeek(user);
    if (user.weeklyMissions[field] !== undefined) {
      user.weeklyMissions[field] += amount;
      await user.save();
    }
  }

  async check(user) {
    await this.ensureWeek(user);
    const completed = [];

    for (const [key, mission] of Object.entries(MISSIONS)) {
      if (user.weeklyMissions.completed.includes(key)) continue;
      if (user.weeklyMissions[mission.field] >= mission.target) {
        user.weeklyMissions.completed.push(key);
        await this.points.addRio(user, mission.reward);
        completed.push({ key, name: mission.name, reward: mission.reward });
      }
    }

    if (completed.length > 0) {
      await user.save();
    }

    return completed;
  }

  async show(user) {
    await this.ensureWeek(user);
    let msg = '📋 المهام الأسبوعية\n\n';

    for (const [key, mission] of Object.entries(MISSIONS)) {
      const progress = Math.min(user.weeklyMissions[mission.field] || 0, mission.target);
      const done = user.weeklyMissions.completed.includes(key);
      const icon = done ? '✅' : '⏳';
      msg += `${icon} ${mission.name}\n`;
      msg += `   ${progress}/${mission.target} — ${mission.reward} ريو\n\n`;
    }

    msg += '💡 تُجدد المهام كل أحد';
    return msg;
  }
}
