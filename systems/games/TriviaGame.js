// systems/games/TriviaGame.js
import { FALLBACK_QUESTIONS } from '../../data/fallback-questions.js';
import { pickRandom } from '../../utils/helpers.js';

const TOTAL = 3;
const TIME_LIMIT = 20;
const REWARD = 2;

export default class TriviaGame {
  constructor(pointsSystem, achievementSystem) {
    this.points = pointsSystem;
    this.achievements = achievementSystem;
  }

  async start(user) {
    const questions = [];
    const pool = [...FALLBACK_QUESTIONS];
    for (let i = 0; i < TOTAL; i++) {
      if (pool.length === 0) break;
      const idx = Math.floor(Math.random() * pool.length);
      questions.push(pool.splice(idx, 1)[0]);
    }

    const data = {
      questions,
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
    const q = data.questions[data.index];
    const labels = ['أ', 'ب', 'ج', 'د'];
    let msg = `📖 معلومات عامة\n\n`;
    msg += `سؤال ${data.index + 1}/${TOTAL}\n\n`;
    msg += `❓ ${q.q}\n\n`;
    q.o.forEach((opt, i) => {
      msg += `${labels[i]}) ${opt}\n`;
    });
    msg += `\n⏱️ 20 ثانية\n💰 2 ريو`;
    return msg;
  }

  async handleAnswer(user, session, answer) {
    const clean = String(answer).trim().toLowerCase();
    const map = {
      'أ': 0, 'ا': 0, 'a': 0, '1': 0,
      'ب': 1, 'b': 1, '2': 1,
      'ج': 2, 'c': 2, '3': 2,
      'د': 3, 'd': 3, '4': 3
    };
    const idx = map[clean];
    if (idx === undefined) return { silent: true };

    const elapsed = (Date.now() - session.lastPromptAt) / 1000;

    // انتهى الوقت
    if (elapsed > TIME_LIMIT) {
      session.index += 1;
      if (session.index >= TOTAL) return this._end(session);
      session.lastPromptAt = Date.now();
      return {
        message: `⏰ انتهى الوقت\n\n${this._format(session)}`,
        sessionData: session
      };
    }

    const q = session.questions[session.index];
    const correct = idx === q.a;
    if (correct) session.correct += 1;

    session.index += 1;

    if (session.index >= TOTAL) return this._end(session);

    session.lastPromptAt = Date.now();

    return {
      message: `${correct ? '✅ صحيح' : '❌ خطأ'}\n\n${this._format(session)}`,
      sessionData: session
    };
  }

  _end(session) {
    const reward = session.correct * REWARD;
    return {
      message: `📊 النتيجة\n\nصحيح: ${session.correct}/${TOTAL}\n💰 +${reward} ريو`,
      reward,
      won: session.correct >= 2
    };
  }
}
