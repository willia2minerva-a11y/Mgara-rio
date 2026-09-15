// systems/games/OddOneOutGame.js
const PUZZLES = [
  { words: ['تفاح', 'موز', 'جزر', 'برتقال'], odd: 2, hint: 'خضار وليس فاكهة' },
  { words: ['أسد', 'نمر', 'بقرة', 'فهد'], odd: 2, hint: 'حيوان أليف' },
  { words: ['باريس', 'لندن', 'القاهرة', 'طوكيو'], odd: 2, hint: 'مدينة عربية' },
  { words: ['أحمر', 'أزرق', 'خشب', 'أخضر'], odd: 2, hint: 'ليس لونًا' },
  { words: ['قمح', 'شعير', 'تفاح', 'أرز'], odd: 2, hint: 'فاكهة' },
  { words: ['مصر', 'السعودية', 'تونس', 'فرنسا'], odd: 3, hint: 'ليست دولة عربية' },
  { words: ['قلم', 'دفتر', 'كتاب', 'تفاحة'], odd: 3, hint: 'فاكهة' },
  { words: ['شمس', 'قمر', 'نجم', 'طاولة'], odd: 3, hint: 'ليس جرمًا سماويًا' },
  { words: ['دجاجة', 'حمامة', 'عصفور', 'قطة'], odd: 3, hint: 'ليست طائرًا' },
  { words: ['سيارة', 'طائرة', 'سفينة', 'بيت'], odd: 3, hint: 'وسيلة نقل؟' },
  { words: ['الفرات', 'النيل', 'الأمازون', 'الصحراء'], odd: 3, hint: 'ليست نهرًا' },
  { words: ['ذهب', 'فضة', 'حديد', 'خشب'], odd: 3, hint: 'ليس معدنًا' },
  { words: ['ماء', 'حليب', 'عصير', 'خبز'], odd: 3, hint: 'طعام صلب' },
  { words: ['صيف', 'شتاء', 'ربيع', 'الاثنين'], odd: 3, hint: 'ليس فصلًا' },
  { words: ['معلم', 'طبيب', 'مهندس', 'مريض'], odd: 3, hint: 'ليس مهنة' },
  { words: ['أسبوع', 'شهر', 'سنة', 'متر'], odd: 3, hint: 'وحدة قياس' },
  { words: ['فرنسا', 'إيطاليا', 'مصر', 'إسبانيا'], odd: 2, hint: 'دولة إفريقية' },
  { words: ['عين', 'أنف', 'فم', 'قدم'], odd: 3, hint: 'ليس في الوجه' },
  { words: ['قميص', 'بنطال', 'حذاء', 'تفاحة'], odd: 3, hint: 'طعام' },
  { words: ['لبن', 'جبن', 'زبدة', 'خيار'], odd: 3, hint: 'خضار وليس مشتقًا' }
];

const TIME_LIMIT = 15;
const REWARD = 1;

export default class OddOneOutGame {
  constructor(pointsSystem, achievementSystem) {
    this.points = pointsSystem;
    this.achievements = achievementSystem;
  }

  async start(user) {
    const puzzle = PUZZLES[Math.floor(Math.random() * PUZZLES.length)];

    const data = {
      puzzle,
      startedAt: Date.now()
    };

    return {
      message: this._format(puzzle),
      save: true,
      data
    };
  }

  _format(puzzle) {
    const labels = ['أ', 'ب', 'ج', 'د'];
    let msg = `🎯 الاختيار الصعب\n\n`;
    msg += `أي كلمة مختلفة؟\n\n`;
    puzzle.words.forEach((w, i) => {
      msg += `${labels[i]}) ${w}\n`;
    });
    msg += `\n⏱️ 15 ثانية\n`;
    msg += `💰 الجائزة: ${REWARD} ريو`;
    return msg;
  }

  async handleAnswer(user, session, answer) {
    const elapsed = (Date.now() - session.startedAt) / 1000;
    if (elapsed > TIME_LIMIT) {
      return {
        message: `⏰ انتهى الوقت\n\n💡 ${session.puzzle.hint}`,
        won: false
      };
    }

    const clean = String(answer).trim().toLowerCase();
    const map = {
      'أ': 0, 'ا': 0, 'a': 0, '1': 0,
      'ب': 1, 'b': 1, '2': 1,
      'ج': 2, 'c': 2, '3': 2,
      'د': 3, 'd': 3, '4': 3
    };
    const idx = map[clean];
    if (idx === undefined) return { silent: true };

    if (idx !== session.puzzle.odd) {
      return {
        message: `❌ خطأ\n\n💡 ${session.puzzle.hint}`,
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
