// systems/games/WordScrambleGame.js
import { shuffle } from '../../utils/helpers.js';

const WORDS = [
  'كتاب', 'قلم', 'باب', 'ماء', 'نار', 'شمس', 'قمر', 'نجم', 'بيت', 'طريق',
  'مدرسة', 'مدينة', 'قرية', 'حديقة', 'شجرة', 'زهرة', 'طائر', 'سمكة', 'أسد', 'فيل',
  'حصان', 'جمل', 'خروف', 'دجاجة', 'تفاح', 'موز', 'برتقال', 'عنب', 'بطيخ', 'ليمون',
  'خبز', 'لبن', 'عسل', 'تمر', 'زيت', 'ملح', 'سكر', 'أرز', 'شاي', 'قهوة',
  'أحمر', 'أزرق', 'أخضر', 'أصفر', 'أبيض', 'أسود', 'رمادي', 'بنفسجي', 'برتقالي', 'وردي',
  'سماء', 'أرض', 'بحر', 'نهر', 'جبل', 'سهل', 'صحراء', 'غابة', 'مطر', 'ثلج',
  'سعيد', 'حزين', 'كبير', 'صغير', 'طويل', 'قصير', 'سريع', 'بطيء', 'قوي', 'ضعيف',
  'صباح', 'مساء', 'ليل', 'نهار', 'يوم', 'شهر', 'سنة', 'ساعة', 'دقيقة', 'ثانية'
];

const TIME_LIMIT = 20;
const REWARD = 1;

export default class WordScrambleGame {
  constructor(pointsSystem, achievementSystem) {
    this.points = pointsSystem;
    this.achievements = achievementSystem;
  }

  async start(user) {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    const scrambled = this._scramble(word);

    const data = {
      word,
      scrambled,
      startedAt: Date.now()
    };

    return {
      message: `🔤 ترتيب الحروف

رتّب الحروف لتكوين كلمة:

${scrambled}

⏱️ 20 ثانية
💰 الجائزة: ${REWARD} ريو`,
      save: true,
      data
    };
  }

  _scramble(word) {
    const letters = word.split('');
    let scrambled = shuffle(letters).join('');
    // تأكد أن الترتيب مختلف
    let attempts = 0;
    while (scrambled === word && attempts < 5) {
      scrambled = shuffle(letters).join('');
      attempts++;
    }
    return scrambled.split('').join(' - ');
  }

  async handleAnswer(user, session, answer) {
    const elapsed = (Date.now() - session.startedAt) / 1000;
    if (elapsed > TIME_LIMIT) {
      return {
        message: `⏰ انتهى الوقت\n\n💡 الإجابة: ${session.word}`,
        won: false
      };
    }

    const clean = String(answer).trim();
    if (!clean) return { silent: true };

    const correct = clean === session.word;

    if (!correct) {
      return {
        message: `❌ خطأ\n\n💡 الإجابة: ${session.word}`,
        won: false
      };
    }

    return {
      message: `✅ صحيح!\n\n💰 +${REWARD} ريو`,
      reward: REWARD,
      won: true
    };
  }
}
