// systems/games/MathGame.js
const TOTAL = 5;
const TIME_PER_QUESTION = 10;
const REWARD_PER_CORRECT = 1;
const BONUS = 0; // لا بونص (اقتصاد)
const MAX_NUMBER = 20;

export default class MathGame {
  constructor(pointsSystem, achievementSystem) {
    this.points = pointsSystem;
    this.achievements = achievementSystem;
  }

  _generateQuestion() {
    const type = Math.floor(Math.random() * 3);
    let a = Math.floor(Math.random() * MAX_NUMBER) + 1;
    let b = Math.floor(Math.random() * MAX_NUMBER) + 1;
    let text, answer;

    if (type === 0) {
      text = `${a} + ${b}`;
      answer = a + b;
    } else if (type === 1) {
      if (a < b) [a, b] = [b, a];
      text = `${a} - ${b}`;
      answer = a - b;
    } else {
      a = Math.floor(Math.random() * 9) + 2;
      b = Math.floor(Math.random() * 9) + 2;
      text = `${a} × ${b}`;
      answer = a * b;
    }

    return { text, answer };
  }

  async start(user) {
    const q = this._generateQuestion();

    const data = {
      index: 1,
      correct: 0,
      current: q,
      startedAt: Date.now(),
      lastPromptAt: Date.now()
    };

    return {
      message: `⚡ سرعة البديهة\n\nسؤال 1/${TOTAL}\n\nاحسب:\n${q.text} = ؟\n\n⏱️ 10 ثواني\n💰 1 ريو/سؤال`,
      save: true,
      data
    };
  }

  async handleAnswer(user, session, answer) {
    const clean = String(answer).trim();
    const num = parseInt(clean);

    if (isNaN(num)) return { silent: true };

    const elapsed = (Date.now() - session.lastPromptAt) / 1000;

    // تجاوز الوقت
    if (elapsed > TIME_PER_QUESTION) {
      session.index += 1;
      if (session.index > TOTAL) return this._end(session);
      session.current = this._generateQuestion();
      session.lastPromptAt = Date.now();
      return {
        message: `⏰ انتهى الوقت\n\n${this._format(session)}`,
        sessionData: session
      };
    }

    const correct = num === session.current.answer;
    if (correct) session.correct += 1;

    session.index += 1;

    if (session.index > TOTAL) return this._end(session);

    session.current = this._generateQuestion();
    session.lastPromptAt = Date.now();

    return {
      message: `${correct ? '✅ صحيح' : '❌ خطأ'}\n\n${this._format(session)}`,
      sessionData: session
    };
  }

  _format(session) {
    return `سؤال ${session.index}/${TOTAL}\n\n${session.current.text} = ؟\n\n⏱️ 10 ثواني`;
  }

  _end(session) {
    const reward = session.correct * REWARD_PER_CORRECT;
    return {
      message: `📊 النتيجة\n\nصحيح: ${session.correct}/${TOTAL}\n💰 +${reward} ريو`,
      reward,
      won: session.correct >= 3
    };
  }
}
