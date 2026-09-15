// systems/GameSystem.js
import { today } from '../utils/helpers.js';
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
  // ✅ قائمة الألعاب المبسطة
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
    if (available.length === 0) {
      msg += '(لا توجد)\n';
    } else {
      msg += available.join('\n') + '\n';
    }

    msg += '\n🔒 غير متاحة:\n';
    if (locked.length === 0) {
      msg += '(لا توجد)\n';
    } else {
      msg += locked.join('\n') + '\n';
    }

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
    const played = user.gamesPlayedToday?.get?.(gameKey) || user.gamesPlayedToday?.[gameKey];
    if (played === todayStr) {
      return { error: `🎮 لعبت "${game.name}" اليوم\n\nعد غدًا!` };
    }

    return { success: true, game };
  }

  // ===================================
  // بدء لعبة
  // ===================================
  async startGame(user, gameKey) {
    const check = await this.canPlay(user, gameKey);
    if (check.error) return check.error;

    const game = check.game;

    if (!user.gamesPlayedToday) user.gamesPlayedToday = new Map();
    user.gamesPlayedToday.set(gameKey, today());

    if (!user.gameStats) user.gameStats = new Map();
    const stats = user.gameStats.get(gameKey) || { played: 0, won: 0 };
    stats.played += 1;
    user.gameStats.set(gameKey, stats);

    await user.save();

    if (gameKey === 'اسئلة') {
      return await this.millionaire.startQuiz(user, 'easy');
    }

    const GameClass = game.GameClass;
    const gameInstance = new GameClass(this.points, this.achievements);
    const session = await gameInstance.start(user);

    if (session.error) return session.error;
    if (session.save) {
      user.gameSessions.set(gameKey, session.data);
      await user.save();
    }

    return session.message;
  }

  // ===================================
  // معالجة رد اللاعب
  // ===================================
  async handleAnswer(user, gameKey, answer) {
    const game = GAMES[gameKey];
    if (!game) return { silent: true };

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

    if (result.sessionData) {
      user.gameSessions.set(gameKey, result.sessionData);
    } else {
      user.gameSessions.delete(gameKey);
    }

    if (result.reward && result.reward > 0) {
      await this.points.addRio(user, result.reward);
    }

    if (result.won) {
      const stats = user.gameStats.get(gameKey) || { played: 0, won: 0 };
      stats.won += 1;
      user.gameStats.set(gameKey, stats);
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

  async hasActiveGame(user) {
    const sessions = user.gameSessions;
    if (!sessions || sessions.size === 0) return false;

    const now = Date.now();
    for (const [key, session] of sessions.entries()) {
      if (session?.startedAt && (now - session.startedAt) > 5 * 60 * 1000) {
        sessions.delete(key);
      }
    }
    await user.save();
    return sessions.size > 0;
  }

  async getActiveGameKey(user) {
    if (!user.gameSessions || user.gameSessions.size === 0) return null;
    return Array.from(user.gameSessions.keys())[0];
  }
  }
