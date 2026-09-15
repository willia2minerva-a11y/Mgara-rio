// systems/ShopSystem.js
import ShopItem from '../models/ShopItem.js';
import { getLevelBonus } from '../utils/helpers.js';

// ✅ تم حذف فئة cosmetic (ديكورات)
const DEFAULT_ITEMS = [
  { name: '50:50', price: 1, description: 'يحذف إجابتين خاطئتين', category: 'help', effect: 'fifty_fifty', value: 1 },
  { name: 'تخطي_سؤال', price: 2, description: 'ينتقل لسؤال جديد', category: 'help', effect: 'skip', value: 1 },
  { name: 'سؤال_إضافي', price: 5, description: 'سؤال 6 في اللعبة', category: 'help', effect: 'extra_question', value: 1 },
  { name: 'إعادة_محاولة', price: 3, description: 'جولة ثانية لو خسرت', category: 'help', effect: 'retry', value: 1 },
  { name: '+2_ثواني_دائم', price: 100, description: 'زيادة دائمة للوقت (مرة واحدة)', category: 'permanent', effect: 'extra_time', value: 2 },
  { name: 'خصم_5%', price: 150, description: 'خصم إضافي دائم (مرة واحدة)', category: 'permanent', effect: 'extra_discount', value: 5 },
  { name: 'هدية_+1', price: 200, description: 'هدية يومية إضافية (مرة واحدة)', category: 'permanent', effect: 'extra_gift', value: 1 },
  { name: 'تخطي_مجاني', price: 300, description: 'تخطي مجاني يوميًا (مرة واحدة)', category: 'permanent', effect: 'free_skip', value: 1 }
];

export default class ShopSystem {
  constructor(pointsSystem, achievementSystem) {
    this.points = pointsSystem;
    this.achievements = achievementSystem;
    this.contactLink = process.env.ADMIN_CONTACT_LINK || '';
    console.log('🛒 ShopSystem جاهز');
  }

  async initialize() {
    const count = await ShopItem.countDocuments();
    if (count === 0) {
      await ShopItem.insertMany(DEFAULT_ITEMS);
      console.log('✅ تم تحميل المنتجات الافتراضية');
    }
  }

  // ===================================
  // عرض السوق (بدون ديكورات)
  // ===================================
  async showShop(user) {
    let items = await ShopItem.find({
      active: true,
      category: { $ne: 'cosmetic' }, // ✅ استبعاد الديكورات
      $or: [{ quantity: -1 }, { quantity: { $gt: 0 } }]
    });

    const ownedPermanent = user?.permanentItems || [];
    items = items.filter(i => {
      if (i.category === 'permanent' && ownedPermanent.includes(i.name)) return false;
      return true;
    });

    if (items.length === 0) return '🛒 السوق فارغ حاليًا.';

    const categories = {
      external: '🔀 منتجات خارجية',
      wheel: '🎡 دولاب الحظ',
      help: '🎫 مساعدات',
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
    const normalized = itemName.trim().replace(/\s+/g, '_');
    let item = await ShopItem.findOne({ name: normalized, active: true });
    if (!item) item = await ShopItem.findOne({ name: itemName.trim(), active: true });
    if (!item) return { error: `❌ المنتج غير موجود` };

    if (item.category === 'permanent' && user.permanentItems?.includes(item.name)) {
      return { error: '❌ تملك هذا المنتج بالفعل!' };
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
      return await this._spinWheel(user, item, finalPrice, totalDiscount);
    }

    await this._applyEffect(user, item);

    if (item.category === 'permanent') {
      user.permanentItems = user.permanentItems || [];
      user.permanentItems.push(item.name);
    }

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

    if (this.contactLink && item.category === 'external') {
      msg += `\n\n📞 للتواصل مع الإدارة:\n${this.contactLink}`;
    }

    return { success: true, message: msg };
  }

  async _spinWheel(user, item, paidPrice, discount) {
    if (!item.wheelPrizes || item.wheelPrizes.length === 0) {
      return { error: '❌ الدولاب غير مكتمل' };
    }

    const prizes = item.wheelPrizes;
    const prize = prizes[Math.floor(Math.random() * prizes.length)];

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
        if (found.category === 'permanent') {
          if (!user.permanentItems?.includes(found.name)) {
            user.permanentItems = user.permanentItems || [];
            user.permanentItems.push(found.name);
            await this._applyEffect(user, found);
            resultText = found.name.replace(/_/g, ' ');
          } else {
            resultText = 'لا شيء';
          }
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

    const displayName = item.name.replace(/_/g, ' ');

    let msg = `🎡 ${displayName}\n\n`;
    msg += `💰 السعر: ${paidPrice} ريو\n`;
    msg += `💳 رصيدك: ${user.rio} ريو\n\n`;
    msg += `🎁 لقد فزت بـ : ${resultText} 🎉🎊`;

    return { success: true, message: msg };
  }

  async _applyEffect(user, item) {
    switch (item.effect) {
      case 'fifty_fifty': user.inventory.fifty_fifty += (item.value || 1); break;
      case 'skip': user.inventory.skip += (item.value || 1); break;
      case 'retry': user.inventory.retry += (item.value || 1); break;
      case 'extra_question': user.inventory.extra_question += (item.value || 1); break;
      case 'extra_time': user.permanentPerks.extraTime += (item.value || 2); break;
      case 'extra_discount': user.permanentPerks.extraDiscount += (item.value || 5); break;
      case 'extra_gift': user.permanentPerks.extraGift += (item.value || 1); break;
      case 'free_skip': user.permanentPerks.freeSkip = true; break;
    }
  }

  // ===================================
  // أوامر الأدمن
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
      wheelPrizes
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
      msg += `• ${displayName} — ${i.price} ريو (${stock})\n`;
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
}
