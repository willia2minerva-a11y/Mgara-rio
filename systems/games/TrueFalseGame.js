// systems/games/TrueFalseGame.js
import { shuffle } from '../../utils/helpers.js';

const STATEMENTS = [
  { text: 'الشمس تشرق من الشرق', answer: true },
  { text: 'الماء يتجمد عند 100 درجة مئوية', answer: false },
  { text: 'القطط من الثدييات', answer: true },
  { text: 'الأرض مسطحة', answer: false },
  { text: 'الجاذبية اكتشفها نيوتن', answer: true },
  { text: 'المشتري أصغر من الأرض', answer: false },
  { text: 'النيل أطول نهر في العالم', answer: true },
  { text: 'القرش من الثدييات', answer: false },
  { text: 'الذهب أغلى من الفضة', answer: true },
  { text: 'السعودية أكبر من مصر', answer: true },
  { text: 'الزئبق سائل في درجة حرارة الغرفة', answer: true },
  { text: 'الخفاش طائر من الثدييات', answer: true },
  { text: 'درجة غليان الماء 100° مئوية', answer: true },
  { text: 'القمر أكبر من الأرض', answer: false },
  { text: 'الجمل يخزن الماء في حدبته', answer: false },
  { text: 'النحلة تنتج العسل', answer: true },
  { text: 'الصين أكبر دولة مساحة', answer: false },
  { text: 'الأسد ملك الغابة', answer: true },
  { text: 'الديناصورات لا تزال حية', answer: false },
  { text: 'البطريق يعيش في القطب الشمالي', answer: false }
];

const TOTAL = 3;
const TIME_PER_QUESTION = 10;
const REWARD_PER_CORRECT = 1;

export default class TrueFalseGame {
  constructor(pointsSystem, achievementSystem) {
    this.points = pointsSystem;
    this.achievements = achievementSystem;
  }

  async start(user) {
    const selected = shuffle(STATEMENTS).slice(0, TOTAL);

    const data = {
      statements: selected,
      index: 0,
      correct: 0,
      startedAt: Date.now(),
      lastPromptAt: Date.now()
    };

    return {
      message: this._format(data),
      save: true,
      data
    };
  }

  _format(data) {
    const s = data.statements[data.index];
    let msg = `🧠 صح أم خطأ\n\n`;
    msg += `سؤال ${data.index + 1}/${TOTAL}\n\n`;
    msg += `"${s.text}"\n\n`;
    msg += `⏱️ 10 ثواني\n`;
    msg += `\nاكتب: صح / خطأ`;
    return msg;
  }

  async handleAnswer(user, session, answer) {
    const clean = String(answer).trim();
    const normalized = clean.replace(/[إأا]/g, 'ا');

    let userAnswer = null;
    if (['صح', 'صحيح', 'true', 'yes'].includes(normalized)) userAnswer = true;
    else if (['خطا', 'خطأ', 'غلط', 'false', 'no'].includes(normalized)) userAnswer = false;
    else return { silent: true };

    const elapsed = (Date.now() - session.lastPromptAt) / 1000;
    if (elapsed > TIME_PER_QUESTION) {
      // تجاوز الوقت
      session.index += 1;
      if (session.index >= TOTAL) {
        return this._end(session);
      }
      session.lastPromptAt = Date.now();
      return {
        message: `⏰ انتهى الوقت\n\n${this._format(session)}`,
        sessionData: session
      };
    }

    const current = session.statements[session.index];
    const correct = userAnswer === current.answer;

    if (correct) session.correct += 1;

    session.index += 1;

    // انتهت اللعبة؟
    if (session.index >= TOTAL) {
      return this._end(session);
    }

    session.lastPromptAt = Date.now();

    let msg = `${correct ? '✅' : '❌'} ${correct ? 'صحيح' : 'خطأ'}\n\n`;
    msg += this._format(session);

    return {
      message: msg,
      sessionData: session
    };
  }

  _end(session) {
    const reward = session.correct * REWARD_PER_CORRECT;
    return {
      message: `📊 النتيجة\n\nصحيح: ${session.correct}/${TOTAL}\n💰 +${reward} ريو`,
      reward,
      won: session.correct >= 2
    };
  }
}
