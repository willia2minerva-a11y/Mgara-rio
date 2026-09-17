// systems/GameSystem.js
import { today } from '../utils/helpers.js';
import ActiveGame from '../models/ActiveGame.js';
import HangmanGame from './games/HangmanGame.js';
import MathGame from './games/MathGame.js';
import TrueFalseGame from './games/TrueFalseGame.js';
import WordScrambleGame from './games/WordScrambleGame.js';
import OddOneOutGame from './games/OddOneOutGame.js';
import RockPaperScissorsGame from './games/RockPaperScissorsGame.js';
import GuessNumberGame from './games/GuessNumberGame.js';
import ProverbGame from './games/ProverbGame.js';
import TriviaGame from './games/TriviaGame.js';

export const GAMES = {
  'حجر': {
    name: 'حجر ورقة مقص',
    icon: '🎲',
    type: 'free',
    description: '3 جولات سريعة',
    reward: 1,
    GameClass: RockPaperScissorsGame
  },
  'ترتيب': {
    name: 'ترتيب الحروف',
    icon: '🔤',
    type: 'free',
    description: 'رتّب الكلمة المبعثرة',
    reward: 1,
    GameClass: WordScrambleGame
  },
  'اختيار': {
    name: 'الاختيار الصعب',
    icon: '🎯',
    type: 'free',
    description: 'اختر الكلمة المختلفة',
    reward: 1,
    GameClass: OddOneOutGame
  },
  'اسئلة': {
    name: 'اسئلة',
    icon: '📚',
    type: 'free',
    description: '5 أسئلة متتالية',
    reward: 8,
    GameClass: null
  },
  'سرعة': {
    name: 'سرعة البديهة',
    icon: '⚡',
    type: 'level',
    levelReq: 6,
    description: 'حل الحساب بسرعة',
    reward: 3,
    GameClass: MathGame
  },
  'صح': {
    name: 'صح أم خطأ',
    icon: '🧠',
    type: 'level',
    levelReq: 12,
    description: 'معلومات سريعة',
    reward: 3,
    GameClass: TrueFalseGame
  },
  'تخمين': {
    name: 'تخمين الرقم',
    icon: '🎲',
    type: 'level',
    levelReq: 20,
    description: 'خمّن الرقم الصحيح',
    reward: 2,
    GameClass: GuessNumberGame
  },
  'كلمة': {
    name: 'الكلمة المخفية',
    icon: '🧩',
    type: 'purchase',
    price: 150,
    description: 'اكتشف الحروف المخفية',
    reward: 2,
    GameClass: HangmanGame
  },
  'مثل': {
    name: 'أكمل المثل',
    icon: '🔗',
    type: 'purchase',
    price: 200,
    description: 'أكمل المثل الشهير',
    reward: 1,
    GameClass: ProverbGame
  },
  'معلومات': {
    name: 'معلومات عامة',
    icon: '📖',
    type: 'purchase',
    price: 250,
    description: 'أسئلة ثقافية',
    reward: 2,
    GameClass: TriviaGame
  }
};

export default class GameSystem {
  constructor(pointsSystem, achievementSystem, missions, millionaireGame) {
    this.points = pointsSystem;
    this.achievements = achievementSystem;
    this.missions = missions;
    this.millionaire = millionaireGame;
    console.log('🎮 GameSystem جاهز');
  }

  // ===================================
  // ✅ حل الأسماء الكاملة → المفتاح
  // ===================================
  resolveGameKey(input) {
    if (!input) return null;
    const clean = input.trim();

    // مباشر
    if (GAMES[clean]) return clean;

    // بحث ذكي
    for (const [key, game] of Object.entries(GAMES)) {
      if (game.name === clean) return key;
      if (game.name.replace(/\s+/g, '_') === clean) return key;
      if (game.name.replace(/^ال/, '') === clean) return key;
      if (key === clean.replace(/^ال/, '')) return key;
    }

    return null;
  }

  // ===================================
  // قائمة الألعاب
  // ===================================
  listGames(user) {
    const available = [];
    const locked = [];

    for (const [key, game] of Object.entries(GAMES)) {
      let isAvailable = true;
      let lockReason = '';

      if (game.type === 'level' && user.level < game.levelReq) {
        isAvailable = false;
        lockReason = `تحتاج Lv.${game.levelReq}`;
      } else if (game.type === 'purchase' && !user.unlockedGames?.includes(key)) {
        isAvailable = false;
        lockReason = 'تُشترى من السوق';
      }

      const displayName = `${game.icon} ${game.name}`;

      if (isAvailable) {
        available.push(`• ${displayName}`);
      } else {
        locked.push(`• ${displayName} — ${lockReason}`);
      }
    }

    let msg = '🎮 الألعاب\n\n';
    msg += '✅ متاحة الآن:\n';
    msg += available.length > 0 ? available.join('\n') + '\n' : '(لا توجد)\n';
    msg += '\n🔒 غير متاحة:\n';
    msg += locked.length > 0 ? locked.join('\n') + '\n' : '(لا توجد)\n';
    msg += '\n💡 العب [اسم اللعبة]';
    return msg;
  }

  // ===================================
  // فحص إمكانية اللعب
  // ===================================
  async canPlay(user, gameKey) {
    const game = GAMES[gameKey];
    if (!game) return { error: '❌ لعبة غير معروفة' };

    if (user.isFrozen) return { error: '❄️ حسابك مجمد' };

    if (game.type === 'level' && user.level < game.levelReq) {
      return { error: `🔒 تحتاج المستوى ${game.levelReq}\n\nمستواك: ${user.level}` };
    }

    if (game.type === 'purchase' && !user.unlockedGames?.includes(gameKey)) {
      return { error: `🔑 تحتاج شراء هذه اللعبة\n\nالسعر: ${game.price} ريو\n\nاكتب: سوق` };
    }

    const todayStr = today();
    const played = user.gamesPlayedToday?.get?.(gameKey);
    if (played === todayStr) {
      return { error: `🎮 لعبت "${game.name}" اليوم\n\nعد غدًا!` };
    }

    return { success: true, game };
  }

  // ===================================
  // ✅ هل هناك لعبة نشطة؟
  // ===================================
  async hasActiveGame(user) {
    // فحص ActiveGame (اسئلة)
    const activeQuiz = await ActiveGame.findOne({ userId: user.userId });
    if (activeQuiz) return { type: 'quiz', key: 'اسئلة' };

    // فحص gameSessions
    if (user.gameSessions && user.gameSessions.size > 0) {
      const now = Date.now();
      let modified = false;
      for (const [key, session] of user.gameSessions.entries()) {
        if (session?.startedAt && (now - session.startedAt) > 5 * 60 * 1000) {
          user.gameSessions.delete(key);
          modified = true;
        }
      }
      if (modified) {
        user.markModified('gameSessions');
        await user.save();
      }

      if (user.gameSessions.size > 0) {
        const key = Array.from(user.gameSessions.keys())[0];
        return { type: 'session', key };
      }
    }

    return null;
  }

  async getActiveGameKey(user) {
    const active = await this.hasActiveGame(user);
    return active ? active.key : null;
  }

  // ===================================
  // ✅ بدء لعبة
  // ===================================
  async startGame(user, gameInput) {
    // 1. حل الاسم
    const gameKey = this.resolveGameKey(gameInput);
    if (!gameKey) {
      return `❌ لعبة غير معروفة: ${gameInput}\n\nاكتب "العاب" للألعاب المتاحة`;
    }

    // 2. فحص لعبة نشطة
    const active = await this.hasActiveGame(user);
    if (active) {
      const activeGame = GAMES[active.key];
      return `🎮 لديك لعبة نشطة: ${activeGame.icon} ${activeGame.name}\n\n💡 أنهها أولًا`;
    }

    // 3. فحص الإمكانية
    const check = await this.canPlay(user, gameKey);
    if (check.error) return check.error;

    const game = check.game;

    // 4. تسجيل اللعب اليومي
    if (!user.gamesPlayedToday) user.gamesPlayedToday = new Map();
    user.gamesPlayedToday.set(gameKey, today());
    user.markModified('gamesPlayedToday');

    if (!user.gameStats) user.gameStats = new Map();
    const stats = user.gameStats.get(gameKey) || { played: 0, won: 0 };
    stats.played += 1;
    user.gameStats.set(gameKey, stats);
    user.markModified('gameStats');

    await user.save();

    // 5. بدء اللعبة
    if (gameKey === 'اسئلة') {
      return await this.millionaire.startQuiz(user, 'easy');
    }

    const GameClass = game.GameClass;
    const gameInstance = new GameClass(this.points, this.achievements);
    const session = await gameInstance.start(user);

    if (session.error) return session.error;
    if (session.save) {
      user.gameSessions.set(gameKey, session.data);
      user.markModified('gameSessions');
      await user.save();
    }

    return session.message;
  }

  // ===================================
  // ✅ معالجة الإجابة
  // ===================================
  async handleAnswer(user, gameKey, answer) {
    const game = GAMES[gameKey];
    if (!game) return { silent: true };

    // اسئلة
    if (gameKey === 'اسئلة') {
      return await this.millionaire.handleAnswer(user, answer);
    }

    const session = user.gameSessions?.get?.(gameKey);
    if (!session) return { silent: true };

    const GameClass = game.GameClass;
    const gameInstance = new GameClass(this.points, this.achievements);
    const result = await gameInstance.handleAnswer(user, session, answer);

    if (result.silent) return { silent: true };
    if (result.error) return result.error;

    // تحديث/حذف الجلسة
    if (result.sessionData) {
      user.gameSessions.set(gameKey, result.sessionData);
    } else {
      user.gameSessions.delete(gameKey);
    }
    user.markModified('gameSessions');

    // مكافآت
    if (result.reward && result.reward > 0) {
      await this.points.addRio(user, result.reward);
    }

    // إحصائيات
    if (result.won) {
      const stats = user.gameStats.get(gameKey) || { played: 0, won: 0 };
      stats.won += 1;
      user.gameStats.set(gameKey, stats);
      user.markModified('gameStats');
      user.totalGamesWon = (user.totalGamesWon || 0) + 1;
    }

    user.totalGamesPlayed = (user.totalGamesPlayed || 0) + 1;
    await user.save();

    try {
      await this.missions.track(user, 'gamesPlayed');
      if (result.won) await this.missions.track(user, 'gamesWon');
      await this.missions.check(user);
      await this.achievements.checkRioAchievements(user);
    } catch (e) {}

    return { message: result.message };
  }
      }
