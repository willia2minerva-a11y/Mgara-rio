// systems/games/HangmanGame.js
const WORDS = [
  'كتاب', 'قلم', 'باب', 'ماء', 'نار', 'شمس', 'قمر', 'نجم', 'بيت', 'طريق',
  'مدرسة', 'مدينة', 'قرية', 'حديقة', 'شجرة', 'زهرة', 'طائر', 'سمكة',
  'أسد', 'فيل', 'حصان', 'جمل', 'خروف', 'تفاح', 'موز', 'عنب', 'خبز', 'لبن',
  'عسل', 'تمر', 'زيت', 'ملح', 'سكر', 'أرز', 'شاي', 'قهوة',
  'سماء', 'أرض', 'بحر', 'نهر', 'جبل', 'غابة', 'مطر',
  'صباح', 'مساء', 'ليل', 'نهار'
];

const MAX_WRONG = 4;
const TIME_LIMIT = 90;
const REWARD = 2;

export default class HangmanGame {
  constructor(pointsSystem, achievementSystem) {
    this.points = pointsSystem;
    this.achievements = achievementSystem;
  }

  async start(user) {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];

    const data = {
      word,
      revealed: new Array(word.length).fill(false),
      wrong: 0,
      triedLetters: [],
      startedAt: Date.now()
    };

    return {
      message: this._format(data),
      save: true,
      data
    };
  }

  _display(data) {
    return data.word.split('').map((ch, i) => data.revealed[i] ? ch : '⬜').join(' ');
  }

  _format(data) {
    let msg = `🧩 الكلمة المخفية\n\n`;
    msg += `${this._display(data)}\n\n`;
    msg += `❌ الأخطاء: ${data.wrong}/${MAX_WRONG}\n`;
    if (data.triedLetters.length > 0) {
      msg += `📝 حروف جربتها: ${data.triedLetters.join(' ')}\n`;
    }
    msg += `\n⏱️ الوقت: 90 ثانية\n`;
    msg += `💰 الجائزة: ${REWARD} ريو\n`;
    msg += `\n💡 اكتب حرفًا واحدًا`;
    return msg;
  }

  async handleAnswer(user, session, answer) {
    const elapsed = (Date.now() - session.startedAt) / 1000;
    if (elapsed > TIME_LIMIT) {
      return {
        message: `⏰ انتهى الوقت\n\n💡 الكلمة: ${session.word}`,
        won: false
      };
    }

    const clean = String(answer).trim();
    if (clean.length !== 1) return { silent: true };

    // محاولة كلمة كاملة؟
    if (clean === session.word) {
      return {
        message: `🎉 صحيح!\n\nالكلمة: ${session.word}\n💰 +${REWARD} ريو`,
        reward: REWARD,
        won: true
      };
    }

    const letter = clean[0];

    // حرف مُجرَّب؟
    if (session.triedLetters.includes(letter)) return { silent: true };

    session.triedLetters.push(letter);

    // فحص
    let found = false;
    for (let i = 0; i < session.word.length; i++) {
      if (session.word[i] === letter) {
        session.revealed[i] = true;
        found = true;
      }
    }

    if (!found) session.wrong += 1;

    // فوز
    if (session.revealed.every(r => r)) {
      return {
        message: `🎉 صحيح!\n\nالكلمة: ${session.word}\n💰 +${REWARD} ريو`,
        reward: REWARD,
        won: true
      };
    }

    // خسارة
    if (session.wrong >= MAX_WRONG) {
      return {
        message: `💔 خسرت\n\nالكلمة: ${session.word}`,
        won: false
      };
    }

    return {
      message: `${found ? '✅ حرف صحيح' : '❌ حرف خاطئ'}\n\n${this._format(session)}`,
      sessionData: session
    };
  }
}
