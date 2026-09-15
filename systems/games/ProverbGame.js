// systems/games/ProverbGame.js
const PROVERBS = [
  { q: 'الطيور على أشكالها...', a: 'تقع' },
  { q: 'الجار قبل الدار...', a: 'والرفيق قبل الطريق' },
  { q: 'اليد الواحدة...', a: 'لا تصفق' },
  { q: 'من جد...', a: 'وجد' },
  { q: 'في التأني السلامة وفي العجلة...', a: 'الندامة' },
  { q: 'الصديق وقت...', a: 'الضيق' },
  { q: 'خير الكلام ما قل...', a: 'ودل' },
  { q: 'العلم نور والجهل...', a: 'ظلام' },
  { q: 'الوقت كالسيف إن لم تقطعه...', a: 'قطعك' },
  { q: 'رب اجعلني مقيم الصلاة ومن...', a: 'ذريتي' },
  { q: 'ادع إلى سبيل ربك بالحكمة والموعظة...', a: 'الحسنة' },
  { q: 'خير الناس أنفعهم...', a: 'للناس' },
  { q: 'من سار على الدرب...', a: 'وصل' },
  { q: 'لا تؤجل عمل اليوم إلى...', a: 'الغد' },
  { q: 'إن مع العسر...', a: 'يسرا' },
  { q: 'بعد الجهد يأتي...', a: 'الفرج' },
  { q: 'القناعة...', a: 'كنز' },
  { q: 'الصبر مفتاح...', a: 'الفرج' },
  { q: 'الكتاب خير...', a: 'جليس' },
  { q: 'العقل السليم في الجسم...', a: 'السليم' }
];

const TIME_LIMIT = 25;
const REWARD = 1;

function normalizeArabic(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default class ProverbGame {
  constructor(pointsSystem, achievementSystem) {
    this.points = pointsSystem;
    this.achievements = achievementSystem;
  }

  async start(user) {
    const p = PROVERBS[Math.floor(Math.random() * PROVERBS.length)];

    const data = {
      q: p.q,
      a: p.a,
      startedAt: Date.now()
    };

    return {
      message: `🔗 أكمل المثل\n\n"${p.q}"\n\n⏱️ 25 ثانية\n💰 الجائزة: ${REWARD} ريو\n\n💡 اكتب الإجابة`,
      save: true,
      data
    };
  }

  async handleAnswer(user, session, answer) {
    const elapsed = (Date.now() - session.startedAt) / 1000;
    if (elapsed > TIME_LIMIT) {
      return {
        message: `⏰ انتهى الوقت\n\n💡 الإجابة: ${session.a}`,
        won: false
      };
    }

    const userAns = normalizeArabic(answer);
    const correctAns = normalizeArabic(session.a);

    const correct = userAns === correctAns ||
                    userAns.includes(correctAns) ||
                    correctAns.includes(userAns) && userAns.length >= 2;

    if (!correct) {
      return {
        message: `❌ خطأ\n\n💡 الإجابة: ${session.a}`,
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
