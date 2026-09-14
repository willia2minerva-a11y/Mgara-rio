// systems/MillionaireGame.js
import ActiveGame from '../models/ActiveGame.js';
import { FALLBACK_QUESTIONS } from '../data/fallback-questions.js';
import { pickRandom } from '../utils/helpers.js';

const POINTS_PER_QUESTION = [1, 2, 3, 4, 5];
const TIME_LIMIT_SECONDS = 30;

export default class MillionaireGame {
  constructor(pointsSystem, achievementSystem, gemini) {
    this.points = pointsSystem;
    this.achievements = achievementSystem;
    this.gemini = gemini;
    console.log('🎮 MillionaireGame جاهز');
  }

  async start(user, difficulty = 'easy') {
    await ActiveGame.deleteOne({ userId: user.userId });

    const question = await this._getQuestion(difficulty);

    const game = new ActiveGame({
      userId: user.userId,
      questionIndex: 1,
      score: 0,
      currentQuestion: {
        text: question.q,
        options: question.o,
        correctIndex: question.a,
        sentAt: new Date()
      }
    });

    await game.save();
    return this._formatQuestion(game, user);
  }

  async _getQuestion(difficulty) {
    const pool = FALLBACK_QUESTIONS.filter(q => q.d === difficulty);
    const fallbackPool = pool.length > 0 ? pool : FALLBACK_QUESTIONS;

    // ✅ Gemini فقط بـ 20% (Fallback)
    if (this.gemini && this.gemini.enabled && Math.random() < 0.2) {
      const aiQ = await this.gemini.generateQuestion(difficulty);
      if (aiQ) {
        return { q: aiQ.question, o: aiQ.options, a: aiQ.correctIndex };
      }
    }

    return pickRandom(fallbackPool);
  }

  _formatQuestion(game, user) {
    const { text, options } = game.currentQuestion;
    const labels = ['أ', 'ب', 'ج', 'د'];
    const bonusTime = user.permanentPerks?.extraTime || 0;
    const totalTime = TIME_LIMIT_SECONDS + bonusTime;

    let msg = `🎮 سؤال ${game.questionIndex}/5\n\n`;
    msg += `❓ ${text}\n\n`;
    options.forEach((opt, i) => {
      msg += `${labels[i]}) ${opt}\n`;
    });
    msg += `\n⏰ لديك ${totalTime} ثانية\n`;
    msg += `💰 النقاط: ${POINTS_PER_QUESTION[game.questionIndex - 1]}\n`;
    msg += `\n💡 اكتب: أ / ب / ج / د`;

    return msg;
  }

  async handleAnswer(user, answer) {
    const game = await ActiveGame.findOne({ userId: user.userId });
    if (!game) {
      return { error: '❌ لا توجد لعبة نشطة. اكتب "العب"' };
    }

    const { sentAt } = game.currentQuestion;
    const bonusTime = user.permanentPerks?.extraTime || 0;
    const totalTime = TIME_LIMIT_SECONDS + bonusTime;
    const elapsed = (Date.now() - new Date(sentAt).getTime()) / 1000;

    // ⏰ تجاوز الوقت → صمت
    if (elapsed > totalTime) {
      await ActiveGame.deleteOne({ userId: user.userId });
      return { silent: true };
    }

    const answerIndex = this._parseAnswer(answer);
    if (answerIndex === -1) return { silent: true };

    const correct = answerIndex === game.currentQuestion.correctIndex;

    if (!correct) {
      const score = game.score;
      await ActiveGame.deleteOne({ userId: user.userId });
      user.gamesPlayed += 1;
      await user.save();
      return {
        message: `❌ إجابة خاطئة!\n\n🎮 انتهت اللعبة\n💰 النقاط المتراكمة: ${score} ريو\n\n💡 اكتب "العب" غدًا لجولة جديدة`
      };
    }

    // ✅ صحيح
    const earned = POINTS_PER_QUESTION[game.questionIndex - 1];
    game.score += earned;
    user.totalQuestions += 1;
    await this.achievements.unlock(user, 'first_win');

    if (game.questionIndex >= 5) {
      // 🏆 إكمال 5/5
      await this.points.addRio(user, game.score);
      user.gamesPlayed += 1;
      user.gamesWon += 1;
      await this.achievements.unlock(user, 'perfect_5');
      await ActiveGame.deleteOne({ userId: user.userId });

      return {
        message: `🎉 مبروك! أكملت 5/5\n\n💰 المكسب: +${game.score} ريو\n💎 رصيدك: ${user.rio} ريو\n\n🔥 أداء رائع!`
      };
    }

    // سؤال تالٍ
    game.questionIndex += 1;
    const next = await this._getQuestion('easy');
    game.currentQuestion = {
      text: next.q,
      options: next.o,
      correctIndex: next.a,
      sentAt: new Date()
    };
    await game.save();

    let msg = `✅ صحيح! +${earned}\n\n`;
    msg += this._formatQuestion(game, user);
    return { message: msg };
  }

  _parseAnswer(input) {
    const clean = String(input).trim().toLowerCase();
    const map = {
      'أ': 0, 'ا': 0, 'a': 0, '1': 0,
      'ب': 1, 'b': 1, '2': 1,
      'ج': 2, 'c': 2, '3': 2,
      'د': 3, 'd': 3, '4': 3
    };
    return map[clean] ?? -1;
  }

  async getActiveGame(userId) {
    return await ActiveGame.findOne({ userId });
  }

  async useFiftyFifty(user) {
    const game = await ActiveGame.findOne({ userId: user.userId });
    if (!game) return { error: null };
    if (user.inventory.fifty_fifty <= 0) return { error: '❌ لا تملك 50:50' };

    user.inventory.fifty_fifty -= 1;
    await user.save();

    const correct = game.currentQuestion.correctIndex;
    const wrong = [0, 1, 2, 3].filter(i => i !== correct);
    const toRemove = wrong.sort(() => Math.random() - 0.5).slice(0, 2);

    const labels = ['أ', 'ب', 'ج', 'د'];
    let msg = `🌟 50:50\n\n`;
    game.currentQuestion.options.forEach((opt, i) => {
      if (toRemove.includes(i)) {
        msg += `❌ ${labels[i]}) [محذوف]\n`;
      } else {
        msg += `✅ ${labels[i]}) ${opt}\n`;
      }
    });
    return { message: msg };
  }

  async useSkip(user) {
    const game = await ActiveGame.findOne({ userId: user.userId });
    if (!game) return { error: null };
    if (user.inventory.skip <= 0 && !user.permanentPerks.freeSkip) {
      return { error: '❌ لا تملك تخطي' };
    }

    if (user.inventory.skip > 0) user.inventory.skip -= 1;
    else user.permanentPerks.freeSkip = false;

    const next = await this._getQuestion('easy');
    game.currentQuestion = {
      text: next.q,
      options: next.o,
      correctIndex: next.a,
      sentAt: new Date()
    };
    await game.save();

    return { message: this._formatQuestion(game, user) };
  }
}
