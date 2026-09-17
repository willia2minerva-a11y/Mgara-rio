// systems/ShopSystem.js
import ShopItem from '../models/ShopItem.js';
import { getLevelBonus, normalizeArabic } from '../utils/helpers.js';

const DEFAULT_ITEMS = [
  // 🎫 مساعدات
  { name: '50:50', price: 1, quantity: -1, description: 'يحذف إجابتين خاطئتين', category: 'help', effect: 'fifty_fifty', value: 1 },
  { name: 'تخطي_سؤال', price: 2, quantity: -1, description: 'ينتقل لسؤال جديد', category: 'help', effect: 'skip', value: 1 },
  { name: 'إعادة_محاولة', price: 3, quantity: -1, description: 'جولة ثانية', category: 'help', effect: 'retry', value: 1 },

  // 🎮 مفاتيح الألعاب
  { name: 'مفتاح_الكلمة', price: 150, quantity: -1, description: 'يفتح لعبة الكلمة المخفية', category: 'game_unlock', effect: 'unlock_كلمة', value: 1 },
  { name: 'مفتاح_المثل', price: 200, quantity: -1, description: 'يفتح لعبة أكمل المثل', category: 'game_unlock', effect: 'unlock_مثل', value: 1 },
  { name: 'مفتاح_المعلومات', price: 250, quantity: -1, description: 'يفتح لعبة معلومات عامة', category: 'game_unlock', effect: 'unlock_معلومات', value: 1 },

  // 🏅 الهوية
  { name: 'اسم_مخصص', price: 80, quantity: -1, description: 'اسمك في التوب', category: 'identity', effect: 'custom_name', value: 1 },
  { name: 'إطار_ملف', price: 100, quantity: -1, description: 'إطار 🌟 بجانب اسمك', category: 'identity', effect: 'badge_frame', value: 1 },
  { name: 'شارة_ذهبية', price: 150, quantity: -1, description: 'شارة 🎖️ بجانب اسمك', category: 'identity', effect: 'badge_gold', value: 1 },
  { name: 'شعلة_streak', price: 250, quantity: -1, description: 'شعلة 🔥 بجانب اسمك', category: 'identity', effect: 'badge_flame', value: 1 },
  { name: 'لقب_ملكي', price: 400, quantity: -1, description: 'لقب 👑 بجانب اسمك', category: 'identity', effect: 'badge_royal', value: 1 },

  // 💎 ميزات دائمة
  { name: 'سؤال_إضافي', price: 20, quantity: -1, description: 'سؤال 6 في لعبة اسئلة', category: 'permanent', effect: 'extra_question', value: 1 },
  { name: '+2_ثواني_دائم', price: 80, quantity: -1, description: 'زيادة دائمة للوقت', category: 'permanent', effect: 'extra_time', value: 2 },
  { name: 'خصم_5%', price: 120, quantity: -1, description: 'خصم إضافي دائم', category: 'permanent', effect: 'extra_discount', value: 5 },
  { name: 'هدية_+1', price: 200, quantity: -1, description: 'هدية يومية إضافية', category: 'permanent', effect: 'extra_gift', value: 1 },
  { name: 'تخطي_مجاني', price: 300, quantity: -1, description: 'تخطي مجاني يوميًا', category: 'permanent', effect: 'free_skip', value: 1 }
];

const BADGE_ICONS = {
  badge_frame: '🌟',
  badge_gold: '🎖️',
  badge_flame: '🔥',
  badge_royal: '👑'
};

export default class ShopSystem {
  constructor(pointsSystem, achievementSystem) {
    this.points = pointsSystem;
    this.achievements = achievementSystem;
    this.contactLink = process.env.ADMIN_CONTACT_LINK || '';
    console.log('🛒 ShopSystem جاهز');
  }

  async initialize() {
    let added = 0;
    let updated = 0;

    for (const item of DEFAULT_ITEMS) {
      const exists = await ShopItem.findOne({ name: item.name });

      if (!exists) {
        await ShopItem.create(item);
        added++;
      } else if (exists.category !== item.category || exists.effect !== item.effect) {
        exists.category = item.category;
        exists.description = item.description;
        exists.price = item.price;
        exists.effect = item.effect;
        await exists.save();
        updated++;
      }
    }

    if (added > 0) console.log(`✅ أُضيف ${added} منتج جديد`);
    if (updated > 0) console.log(`🔄 حُدّث ${updated} منتج`);
    if (added === 0 && updated === 0) console.log('ℹ️ كل المنتجات موجودة');
  }

  // ===================================
  // عرض السوق
  // ===================================
  async showShop(user) {
    let items = await ShopItem.find({
      active: true,
      $or: [{ quantity: -1 }, { quantity: { $gt: 0 } }]
    });

    const ownedPermanent = user?.permanentItems || [];
    const ownedBadges = user?.ownedBadges || [];
    const unlockedGames = user?.unlockedGames || [];

    items = items.filter(i => {
      if (i.category === 'permanent' && ownedPermanent.includes(i.name)) return false;
      if (i.category === 'identity' && ownedBadges.includes(i.name)) return false;
      if (i.category === 'game_unlock') {
        let gameKey = i.name.replace('مفتاح_', '').replace(/^ال/, '');
        if (unlockedGames.includes(gameKey)) return false;
      }
      return true;
    });

    if (items.length === 0) return '🛒 السوق فارغ حاليًا.';

    const categories = {
      external: '🔀 منتجات خارجية',
      wheel: '🎡 دولاب الحظ',
      help: '🎫 مساعدات',
      game_unlock: '🎮 مفاتيح الألعاب',
      identity: '🏅 الهوية',
      permanent: '💎 ميزات دائمة'
    };

    let msg = '🛒 السوق\n\n';
    let firstSection = true;

    for (const [cat, label] of Object.entries(categories)) {
      const catItems = items.filter(i => i.category === cat);
      if (catItems.length === 0) continue;

      if (!firstSection) msg += '\n';
      firstSection = false;

      msg += `${label}\n`;
      catItems.forEach(item => {
        const stock = item.quantity === -1 ? '' : ` (${item.quantity})`;
        const displayName = item.name.replace(/_/g, ' ');
        msg += `• ${displayName} — ${item.price} ريو${stock}\n`;
      });
    }

    msg += '\n💡 اشتر [الاسم]';
    return msg;
  }

  // ===================================
  // شراء
  // ===================================
  async purchase(user, itemName) {
    // ✅ بحث ذكي بالهمزات وال "ال"
    const cleanInput = itemName.trim();
    let item = null;

    // 1. البحث المباشر
    const normalized = cleanInput.replace(/\s+/g, '_');
    item = await ShopItem.findOne({ name: normalized, active: true });
    if (!item) item = await ShopItem.findOne({ name: cleanInput, active: true });

    // 2. البحث الذكي
    if (!item) {
      const allItems = await ShopItem.find({ active: true });
      const normalizedInput = normalizeArabic(cleanInput);
      for (const i of allItems) {
        const normalizedName = normalizeArabic(i.name.replace(/_/g, ' '));
        if (normalizedName === normalizedInput) {
          item = i;
          break;
        }
      }
    }

    if (!item) return { error: `❌ المنتج غير موجود` };

    // فحص التكرار
    if (item.category === 'permanent' && user.permanentItems?.includes(item.name)) {
      return { error: '❌ تملك هذا المنتج بالفعل!' };
    }
    if (item.category === 'identity' && user.ownedBadges?.includes(item.name)) {
      return { error: '❌ تملك هذا المنتج بالفعل!' };
    }
    if (item.category === 'game_unlock') {
      let gameKey = item.name.replace('مفتاح_', '').replace(/^ال/, '');
      if (user.unlockedGames?.includes(gameKey)) {
        return { error: '❌ تملك هذا المفتاح بالفعل!' };
      }
    }

    if (item.quantity !== -1 && item.quantity <= 0) {
      return { error: '❌ المنتج نفد!' };
    }

    const levelBonus = getLevelBonus(user.level);
    const shopDiscount = user.permanentPerks?.extraDiscount || 0;
    const totalDiscount = Math.min(50, levelBonus.discount + shopDiscount);
    const finalPrice = Math.max(1, Math.floor(item.price * (1 - totalDiscount / 100)));

    if (user.rio < finalPrice) {
      return { error: `❌ رصيدك غير كافٍ.\n\n💰 رصيدك: ${user.rio}\n💵 السعر: ${finalPrice}` };
    }

    const spend = await this.points.spendRio(user, finalPrice);
    if (!spend.success) return { error: '❌ فشل الخصم' };

    if (item.quantity !== -1) {
      item.quantity -= 1;
      await item.save();
    }

    if (item.category === 'wheel') {
      return await this._spinWheel(user, item, finalPrice);
    }

    await this._applyEffect(user, item);

    user.purchases.push({ item: item.name, price: finalPrice });
    await user.save();

    if (user.purchases.length === 1) await this.achievements.unlock(user, 'first_purchase');
    if (user.purchases.length === 10) await this.achievements.unlock(user, 'big_buyer');

    const displayName = item.name.replace(/_/g, ' ');

    let msg = `✅ تم الشراء\n\n`;
    msg += `📦 المنتج: ${displayName}\n`;
    msg += `💰 السعر: ${finalPrice} ريو`;
    if (totalDiscount > 0) msg += ` (خصم ${totalDiscount}%)`;
    msg += `\n💳 رصيدك: ${user.rio} ريو`;

    if (item.category === 'external' && this.contactLink) {
      msg += `\n\n📞 للتواصل مع الإدارة:\n${this.contactLink}`;
    }

    if (item.category === 'identity' && item.effect === 'custom_name') {
      msg += `\n\n💡 لتعيين اسمك: اسمي [الاسم]`;
    }

    if (item.category === 'identity' && item.effect && item.effect.startsWith('badge_')) {
      msg += `\n\n💡 لتفعيل الديكور: ديكوري ${displayName}`;
    }

    if (item.category === 'game_unlock') {
      msg += `\n\n🎮 اللعبة متاحة الآن!\n💡 اكتب: العاب`;
    }

    return { success: true, message: msg };
  }

  // ===================================
  // دولاب الحظ
  // ===================================
  async _spinWheel(user, item, paidPrice) {
    if (!item.wheelPrizes || item.wheelPrizes.length === 0) {
      return { error: '❌ الدولاب غير مكتمل' };
    }

    const prize = item.wheelPrizes[Math.floor(Math.random() * item.wheelPrizes.length)];
    let resultText = '';

    if (prize.type === 'rio') {
      if (prize.value > 0) {
        await this.points.addRio(user, prize.value);
        resultText = `+${prize.value} ريو`;
      } else {
        resultText = 'لا شيء';
      }
    } else if (prize.type === 'item') {
      const found = await ShopItem.findOne({ name: prize.value, active: true });
      if (found) {
        if (found.category === 'permanent' && user.permanentItems?.includes(found.name)) {
          resultText = 'لا شيء';
        } else {
          await this._applyEffect(user, found);
          resultText = found.name.replace(/_/g, ' ');
        }
      } else {
        resultText = 'لا شيء';
      }
    } else {
      resultText = 'لا شيء';
    }

    user.purchases.push({ item: item.name, price: paidPrice });
    await user.save();

    if (user.purchases.length === 1) await this.achievements.unlock(user, 'first_purchase');

    return {
      success: true,
      message: `🎡 ${item.name.replace(/_/g, ' ')}\n\n💰 السعر: ${paidPrice} ريو\n💳 رصيدك: ${user.rio} ريو\n\n🎁 لقد فزت بـ : ${resultText} 🎉🎊`
    };
  }

  // ===================================
  // تطبيق التأثير
  // ===================================
  async _applyEffect(user, item) {
    user.markModified('inventory');
    user.markModified('permanentPerks');
    user.markModified('ownedBadges');
    user.markModified('unlockedGames');

    switch (item.effect) {
      case 'fifty_fifty': user.inventory.fifty_fifty += (item.value || 1); break;
      case 'skip': user.inventory.skip += (item.value || 1); break;
      case 'retry': user.inventory.retry += (item.value || 1); break;

      case 'extra_time': user.permanentPerks.extraTime += (item.value || 2); break;
      case 'extra_discount': user.permanentPerks.extraDiscount += (item.value || 5); break;
      case 'extra_gift': user.permanentPerks.extraGift += (item.value || 1); break;
      case 'free_skip': user.permanentPerks.freeSkip = true; break;
      case 'extra_question': user.permanentPerks.extraQuestion += (item.value || 1); break;

      case 'custom_name':
        user.ownedBadges = user.ownedBadges || [];
        if (!user.ownedBadges.includes('اسم_مخصص')) {
          user.ownedBadges.push('اسم_مخصص');
        }
        break;

      case 'badge_frame':
      case 'badge_gold':
      case 'badge_flame':
      case 'badge_royal':
        user.ownedBadges = user.ownedBadges || [];
        if (!user.ownedBadges.includes(item.name)) {
          user.ownedBadges.push(item.name);
        }
        if (!user.displayedBadge) {
          user.displayedBadge = item.name;
        }
        break;

      case 'unlock_كلمة':
      case 'unlock_الكلمة':
        user.unlockedGames = user.unlockedGames || [];
        if (!user.unlockedGames.includes('كلمة')) user.unlockedGames.push('كلمة');
        break;
      case 'unlock_مثل':
      case 'unlock_المثل':
        user.unlockedGames = user.unlockedGames || [];
        if (!user.unlockedGames.includes('مثل')) user.unlockedGames.push('مثل');
        break;
      case 'unlock_معلومات':
      case 'unlock_المعلومات':
        user.unlockedGames = user.unlockedGames || [];
        if (!user.unlockedGames.includes('معلومات')) user.unlockedGames.push('معلومات');
        break;
    }
  }

  // ===================================
  // إدارة المنتجات
  // ===================================
  async addItem(name, price, quantity, description, category = 'external', wheelPrizes = null) {
    const normalized = name.trim().replace(/\s+/g, '_');
    const exists = await ShopItem.findOne({ name: normalized });
    if (exists) return { error: '❌ الاسم موجود بالفعل' };

    await ShopItem.create({
      name: normalized,
      price,
      quantity: quantity === -1 ? -1 : quantity,
      description: description || '',
      category,
      wheelPrizes,
      active: true
    });

    let msg = `✅ تم إضافة: ${name.replace(/_/g, ' ')}`;
    if (category === 'wheel') msg += `\n🎡 جوائز: ${wheelPrizes.length}`;
    return { success: true, message: msg };
  }

  async removeItem(name) {
    const normalized = name.trim().replace(/\s+/g, '_');
    let result = await ShopItem.deleteOne({ name: normalized });
    if (result.deletedCount === 0) result = await ShopItem.deleteOne({ name: name.trim() });
    if (result.deletedCount === 0) return { error: '❌ المنتج غير موجود' };
    return { success: true, message: `✅ تم حذف: ${name.replace(/_/g, ' ')}` };
  }

  async editItem(name, field, value) {
    const normalized = name.trim().replace(/\s+/g, '_');
    let item = await ShopItem.findOne({ name: normalized });
    if (!item) item = await ShopItem.findOne({ name: name.trim() });
    if (!item) return { error: '❌ المنتج غير موجود' };

    const allowed = ['price', 'quantity', 'description', 'category', 'active'];
    if (!allowed.includes(field)) return { error: '❌ الحقل غير مسموح' };

    item[field] = (field === 'quantity' || field === 'price') ? Number(value) : value;
    await item.save();
    return { success: true, message: `✅ تم تعديل ${field}` };
  }

  async listAll() {
    const items = await ShopItem.find();
    if (items.length === 0) return '📋 لا توجد منتجات';

    let msg = '📋 المنتجات\n\n';
    items.forEach(i => {
      const stock = i.quantity === -1 ? '∞' : i.quantity;
      const displayName = i.name.replace(/_/g, ' ');
      msg += `• ${displayName} — ${i.price} ريو (${stock}) [${i.category}]\n`;
    });
    return msg;
  }

  parsePrizes(text) {
    const cleaned = text.replace(/[\[\]]/g, '').trim();
    const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);

    return parts.map(p => {
      if (/^\d+$/.test(p)) {
        return { type: 'rio', value: parseInt(p) };
      }
      return { type: 'item', value: p.replace(/\s+/g, '_') };
    });
  }

  getBadgeIcon(effect) {
    return BADGE_ICONS[effect] || '';
  }
  }
