// systems/MillionaireGame.js
import ActiveGame from '../models/ActiveGame.js';
import { FALLBACK_QUESTIONS } from '../data/fallback-questions.js';
import { pickRandom } from '../utils/helpers.js';

const POINTS_PER_QUESTION = [1, 2, 3, 4, 5];
const TIME_LIMIT_SECONDS = 30;

// ✅ أسئلة التحدي (كتابة حرة) - مخزنة منفصلة
const CHALLENGE_QUESTIONS = [
  { q: 'ما هي عاصمة أستراليا؟', a: 'كانبرا' },
  { q: 'من اخترع المصباح الكهربائي؟', a: 'إديسون' },
  { q: 'ما هو أكبر كوكب في المجموعة الشمسية؟', a: 'المشتري' },
  { q: 'كم عدد عظام جسم الإنسان البالغ؟', a: '206' },
  { q: 'ما هو أطول نهر في العالم؟', a: 'النيل' },
  { q: 'من هو مؤلف رواية البؤساء؟', a: 'فيكتور هوغو' },
  { q: 'ما هي عملة اليابان؟', a: 'الين' },
  { q: 'في أي عام سقط برج التجارة العالمي؟', a: '2001' },
  { q: 'ما هو أكبر محيط في العالم؟', a: 'الهادئ' },
  { q: 'كم عدد قلوب الأخطبوط؟', a: '3' },
  { q: 'ما هي أصغر دولة في العالم؟', a: 'الفاتيكان' },
  { q: 'ما هو الرمز الكيميائي للذهب؟', a: 'Au' },
  { q: 'من رسم لوحة الموناليزا؟', a: 'دافنشي' },
  { q: 'ما هي أكبر جزيرة في العالم؟', a: 'جرينلاند' },
  { q: 'كم سنة ضوئية يبعد أقرب نجم؟', a: '4.2' },
  { q: 'ما هي أكبر دولة عربية مساحة؟', a: 'الجزائر' },
  { q: 'كم عدد فقرات العمود الفقري؟', a: '33' },
  { q: 'ما هو الغاز الأكثر وفرة في الجو؟', a: 'النيتروجين' },
  { q: 'من مؤسس علم الجبر؟', a: 'الخوارزمي' },
  { q: 'ما هو أكبر حيوان على الأرض؟', a: 'الحوت الأزرق' }
];

// ✅ دالة تطبيع النص للمقارنة
function normalizeArabic(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\u0600-\u06FFa-z0-9\s\.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default class MillionaireGame {
  constructor(pointsSystem, achievementSystem, gemini) {
    this.points = pointsSystem;
    this.achievements = achievementSystem;
    this.gemini = gemini;
    console.log('🎮 MillionaireGame جاهز');
  }

  // ===================================
  // 🎯 لعبة "اسئلة" (5 أسئلة)
  // ===================================
  async startQuiz(user, difficulty = 'easy') {
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

  // ===================================
  // 🎯 تحدي (سؤال واحد صعب - بدون خيارات)
  // ===================================
  async startChallenge(user) {
    await ActiveGame.deleteOne({ userId: user.userId });

    const question = await this._getChallengeQuestion();

    user.challengeActive = true;
    user.challengeQuestion = {
      text: question.q,
      answer: question.a,
      sentAt: new Date()
    };
    user.lastChallengeDate = new Date().toISOString().split('T')[0];
    await user.save();

    let msg = `🎯 تحدي اليوم\n\n`;
    msg += `❓ ${question.q}\n\n`;
    msg += `⏱️ 30 ثانية\n`;
    msg += `💎 الجائزة: 3 ريو\n`;
    msg += `\n💡 اكتب إجابتك`;

    return msg;
  }

  async _getChallengeQuestion() {
    // محاولة Gemini أولًا (50%)
    if (this.gemini && this.gemini.enabled && Math.random() < 0.5) {
      // Gemini للتحدي — نطلب سؤال مقالي
      // لكن بما أن Gemini مُهيأ للخيارات، نستخدم البنك
      // TODO: يمكن إضافة دالة generateEssayQuestion لاحقًا
    }
    return pickRandom(CHALLENGE_QUESTIONS);
  }

  // ===================================
  // معالجة إجابة التحدي (نص حر)
  // ===================================
  async handleChallengeAnswer(user, answerText) {
    if (!user.challengeActive || !user.challengeQuestion) {
      return { silent: true };
    }

    const { sentAt, answer } = user.challengeQuestion;
    const elapsed = (Date.now() - new Date(sentAt).getTime()) / 1000;

    if (elapsed > 30) {
      user.challengeActive = false;
      user.challengeQuestion = null;
      await user.save();
      return { silent: true };
    }

    const userAns = normalizeArabic(answerText);
    const correctAns = normalizeArabic(answer);

    // تحقق ذكي: تطابق تام أو احتواء
    const isCorrect = userAns === correctAns ||
                     userAns.includes(correctAns) ||
                     correctAns.includes(userAns) && userAns.length >= 3;

    user.challengeActive = false;
    user.challengeQuestion = null;

    if (!isCorrect) {
      await user.save();
      return {
        message: `❌ إجابة خاطئة\n\n💡 الإجابة الصحيحة: ${answer}\n\nحاول غدًا!`
      };
    }

    await this.points.addRio(user, 3);
    user.dailyChallengesDone = (user.dailyChallengesDone || 0) + 1;
    await this.achievements.unlock(user, 'first_win');
    if (user.dailyChallengesDone >= 50) await this.achievements.unlock(user, 'daily_50');
    await user.save();

    return {
      message: `🎉 إجابة صحيحة!\n\n+3 ريو\n💎 رصيدك: ${user.rio} ريو`
    };
  }

  async hasActiveChallenge(user) {
    return user.challengeActive === true;
  }

  // ===================================
  // جلب أسئلة اللعبة العادية
  // ===================================
  async _getQuestion(difficulty, useGemini = false) {
    const pool = FALLBACK_QUESTIONS.filter(q => q.d === difficulty);
    const fallbackPool = pool.length > 0 ? pool : FALLBACK_QUESTIONS;

    const geminiChance = useGemini ? 0.5 : 0.2;

    if (this.gemini && this.gemini.enabled && Math.random() < geminiChance) {
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
    msg += `\n⏱️ ${totalTime} ثانية\n`;
    msg += `💎 ${POINTS_PER_QUESTION[game.questionIndex - 1]} ريو\n`;
    msg += `\n💡 اكتب: أ / ب / ج / د`;

    return msg;
  }

  async handleAnswer(user, answer) {
    const game = await ActiveGame.findOne({ userId: user.userId });
    if (!game) {
      return { silent: true }; // ✅ صمت تام
    }

    const { sentAt } = game.currentQuestion;
    const bonusTime = user.permanentPerks?.extraTime || 0;
    const totalTime = TIME_LIMIT_SECONDS + bonusTime;
    const elapsed = (Date.now() - new Date(sentAt).getTime()) / 1000;

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
        message: `❌ إجابة خاطئة!\n\n🎮 انتهت اللعبة\n💰 النقاط المتراكمة: ${score} ريو\n\n💡 اكتب "العب اسئلة" غدًا`
      };
    }

    const earned = POINTS_PER_QUESTION[game.questionIndex - 1];
    game.score += earned;
    user.totalQuestions += 1;
    await this.achievements.unlock(user, 'first_win');

    if (game.questionIndex >= 5) {
      await this.points.addRio(user, game.score);
      user.gamesPlayed += 1;
      user.gamesWon += 1;
      await this.achievements.unlock(user, 'perfect_5');
      await ActiveGame.deleteOne({ userId: user.userId });
      await user.save();

      return {
        message: `🎉 مبروك! أكملت 5/5\n\n💰 المكسب: +${game.score} ريو\n💎 رصيدك: ${user.rio} ريو\n\n🔥 أداء رائع!`
      };
    }

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
