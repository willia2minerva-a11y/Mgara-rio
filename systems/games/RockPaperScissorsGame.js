// systems/games/RockPaperScissorsGame.js
const CHOICES = ['حجر', 'ورقة', 'مقص'];
const TIME_LIMIT = 15; // ثواني لكل جولة
const TOTAL_ROUNDS = 3;
const REWARD = 1;

export default class RockPaperScissorsGame {
  constructor(pointsSystem, achievementSystem) {
    this.points = pointsSystem;
    this.achievements = achievementSystem;
  }

  async start(user) {
    const data = {
      round: 1,
      playerWins: 0,
      botWins: 0,
      startedAt: Date.now(),
      lastPromptAt: Date.now()
    };

    return {
      message: `🎲 حجر ورقة مقص

الجولة 1 من 3

اكتب:
• حجر
• ورقة
• مقص

⏱️ 15 ثانية`,
      save: true,
      data
    };
  }

  async handleAnswer(user, session, answer) {
    const clean = String(answer).trim();
    if (!CHOICES.includes(clean)) return { silent: true };

    const elapsed = (Date.now() - (session.lastPromptAt || session.startedAt)) / 1000;
    if (elapsed > TIME_LIMIT) {
      return {
        message: `⏰ انتهى الوقت\n\n💔 خسرت الجولة`,
        won: false
      };
    }

    const botChoice = CHOICES[Math.floor(Math.random() * 3)];

    let result = '';
    let playerWin = false;
    let botWin = false;

    if (clean === botChoice) {
      result = '🤝 تعادل';
    } else if (
      (clean === 'حجر' && botChoice === 'مقص') ||
      (clean === 'ورقة' && botChoice === 'حجر') ||
      (clean === 'مقص' && botChoice === 'ورقة')
    ) {
      result = '✅ فزت الجولة';
      playerWin = true;
    } else {
      result = '❌ خسرت الجولة';
      botWin = true;
    }

    if (playerWin) session.playerWins += 1;
    if (botWin) session.botWins += 1;

    // نهاية اللعبة؟
    if (session.round >= TOTAL_ROUNDS || session.playerWins >= 2 || session.botWins >= 2) {
      const won = session.playerWins > session.botWins;
      const msg = `🎲 ${result}
أنت: ${clean} | البوت: ${botChoice}

📊 النتيجة النهائية:
أنت: ${session.playerWins}
البوت: ${session.botWins}

${won ? `🎉 فزت!\n💰 +${REWARD} ريو` : `💔 خسرت\nحظ أوفر المرة القادمة`}`;

      return {
        message: msg,
        sessionData: null,
        reward: won ? REWARD : 0,
        won
      };
    }

    session.round += 1;
    session.lastPromptAt = Date.now();

    return {
      message: `🎲 ${result}
أنت: ${clean} | البوت: ${botChoice}

الجولة ${session.round} من 3
📊 أنت: ${session.playerWins} | البوت: ${session.botWins}

اكتب: حجر / ورقة / مقص`,
      sessionData: session,
      silent: false
    };
  }
}
