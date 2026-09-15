// systems/games/GuessNumberGame.js
const MIN = 1;
const MAX = 50;
const MAX_ATTEMPTS = 5;
const TIME_LIMIT = 60; // إجمالي للعبة كاملة
const REWARD = 2;

export default class GuessNumberGame {
  constructor(pointsSystem, achievementSystem) {
    this.points = pointsSystem;
    this.achievements = achievementSystem;
  }

  async start(user) {
    const target = Math.floor(Math.random() * (MAX - MIN + 1)) + MIN;

    const data = {
      target,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      startedAt: Date.now()
    };

    return {
      message: `🎲 تخمين الرقم

خمّن رقمًا بين ${MIN} و ${MAX}

لديك ${MAX_ATTEMPTS} محاولات
⏱️ 60 ثانية
💰 الجائزة: ${REWARD} ريو

💡 اكتب رقمك`,
      save: true,
      data
    };
  }

  async handleAnswer(user, session, answer) {
    const clean = String(answer).trim();
    const guess = parseInt(clean);

    if (isNaN(guess) || guess < MIN || guess > MAX) return { silent: true };

    const elapsed = (Date.now() - session.startedAt) / 1000;
    if (elapsed > TIME_LIMIT) {
      return {
        message: `⏰ انتهى الوقت\n\n💡 الرقم: ${session.target}`,
        won: false
      };
    }

    session.attempts += 1;

    // صحيح
    if (guess === session.target) {
      return {
        message: `🎯 صحيح!\n\nالرقم: ${guess}\nالمحاولات: ${session.attempts}/${session.maxAttempts}\n💰 +${REWARD} ريو`,
        reward: REWARD,
        won: true
      };
    }

    // نفدت المحاولات
    if (session.attempts >= session.maxAttempts) {
      return {
        message: `💔 انتهت محاولاتك\n\nالرقم كان: ${session.target}`,
        won: false
      };
    }

    // تلميح
    const hint = guess < session.target ? '📈 أعلى' : '📉 أقل';
    const remaining = session.maxAttempts - session.attempts;

    return {
      message: `${hint}

المحاولات: ${session.attempts}/${session.maxAttempts}
💡 تبقى ${remaining}

اكتب رقمك`,
      sessionData: session
    };
  }
}
