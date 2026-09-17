// utils/helpers.js

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function isSameDay(date1, date2) {
  return today() === new Date(date1).toISOString().split('T')[0];
}

export function daysBetween(date1, date2) {
  const d1 = new Date(date1).setHours(0, 0, 0, 0);
  const d2 = new Date(date2).setHours(0, 0, 0, 0);
  return Math.floor((d2 - d1) / (24 * 60 * 60 * 1000));
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pickRandom(array) {
  return array[randomInt(0, array.length - 1)];
}

export function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ===================================
// ✅ تطبيع النص العربي (الهمزات + "ال")
// ===================================
export function normalizeArabic(text) {
  if (!text) return '';
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/^ال/, '')                       // إزالة "ال" من البداية
    .replace(/[أإآا]/g, 'ا')                  // توحيد الهمزات
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '')    // إزالة التشكيل
    .replace(/[^\u0600-\u06FFa-z0-9\s_]/g, '') // إزالة الرموز
    .replace(/[\s_]+/g, ' ')                  // توحيد المسافات و _
    .trim();
}

// ✅ هل النصان متطابقان؟
export function arabicMatch(text1, text2) {
  return normalizeArabic(text1) === normalizeArabic(text2);
}

// ✅ البحث عن تطابق
export function findArabicMatch(input, options) {
  const normalized = normalizeArabic(input);
  for (const opt of options) {
    if (normalizeArabic(opt) === normalized) return opt;
  }
  return null;
}

// ===================================
// ✅ المستويات
// ===================================
const LEVEL_TABLE = [
  { level: 1, needed: 0 },
  { level: 2, needed: 10 },
  { level: 3, needed: 25 },
  { level: 4, needed: 50 },
  { level: 5, needed: 100 },
  { level: 6, needed: 175 },
  { level: 7, needed: 275 },
  { level: 8, needed: 400 },
  { level: 9, needed: 550 },
  { level: 10, needed: 750 },
  { level: 12, needed: 1100 },
  { level: 15, needed: 1800 },
  { level: 20, needed: 3200 },
  { level: 25, needed: 5000 },
  { level: 30, needed: 7500 },
  { level: 35, needed: 10500 },
  { level: 40, needed: 14000 },
  { level: 45, needed: 18000 },
  { level: 50, needed: 23000 },
  { level: 60, needed: 35000 },
  { level: 70, needed: 50000 },
  { level: 80, needed: 70000 },
  { level: 90, needed: 95000 },
  { level: 100, needed: 130000 }
];

export function getLevelFromEarned(totalEarned) {
  let lvl = 1;
  for (const entry of LEVEL_TABLE) {
    if (totalEarned >= entry.needed) lvl = entry.level;
    else break;
  }
  return lvl;
}

export function getLevelBonus(level) {
  if (level >= 100) return { time: 30, discount: 30, title: 'ملك' };
  if (level >= 90) return { time: 20, discount: 25, title: 'أسطورة' };
  if (level >= 85) return { time: 15, discount: 25, title: 'أسطورة' };
  if (level >= 75) return { time: 15, discount: 20, title: 'أسطورة' };
  if (level >= 65) return { time: 10, discount: 20, title: 'خبير' };
  if (level >= 50) return { time: 10, discount: 15, title: 'خبير' };
  if (level >= 45) return { time: 7, discount: 15, title: 'محترف' };
  if (level >= 30) return { time: 7, discount: 10, title: 'محترف' };
  if (level >= 25) return { time: 5, discount: 10, title: null };
  if (level >= 15) return { time: 5, discount: 5, title: null };
  if (level >= 10) return { time: 3, discount: 5, title: null };
  if (level >= 5) return { time: 3, discount: 0, title: null };
  return { time: 0, discount: 0, title: null };
}

export function getStreakBonus(streakDay) {
  const rewards = {
    7: 3,
    14: 5,
    30: 10,
    50: 20,
    100: 50,
    365: 100
  };
  return rewards[streakDay] || 1;
}
