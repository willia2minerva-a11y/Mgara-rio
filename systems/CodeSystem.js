// systems/CodeSystem.js
import Code from '../models/Code.js';

export default class CodeSystem {
  constructor(pointsSystem) {
    this.points = pointsSystem;
    console.log('🎫 CodeSystem جاهز');
  }

  async create(code, rio, maxUses, createdBy) {
    const clean = code.trim().toUpperCase();
    const exists = await Code.findOne({ code: clean });
    if (exists) return { error: '❌ الكود موجود بالفعل' };

    await Code.create({
      code: clean,
      rio,
      maxUses,
      createdBy
    });
    return { success: true, message: `✅ تم إنشاء الكود: ${clean}\n💰 ${rio} ريو × ${maxUses} شخص` };
  }

  async redeem(user, code) {
    const clean = code.trim().toUpperCase();
    const found = await Code.findOne({ code: clean, active: true });
    if (!found) return { error: null }; // صمت — كود غير موجود

    if (found.usedBy.includes(user.userId)) {
      return { error: null }; // صمت — مستخدم سابقًا
    }

    if (found.usedCount >= found.maxUses) {
      return { error: null }; // صمت — انتهت
    }

    // استخدام
    found.usedBy.push(user.userId);
    found.usedCount += 1;
    await found.save();

    await this.points.addRio(user, found.rio);

    return {
      success: true,
      message: `🎉 تم استرداد الكود!\n\n💰 +${found.rio} ريو\n💎 رصيدك: ${user.rio} ريو`
    };
  }

  async remove(code) {
    const clean = code.trim().toUpperCase();
    const result = await Code.deleteOne({ code: clean });
    if (result.deletedCount === 0) return { error: '❌ الكود غير موجود' };
    return { success: true, message: `✅ تم حذف: ${clean}` };
  }

  async listAll() {
    const codes = await Code.find().sort({ createdAt: -1 });
    if (codes.length === 0) return '📋 لا توجد أكواد';

    let msg = '🎫 الأكواد:\n\n';
    codes.forEach(c => {
      const status = c.active ? '🟢' : '🔴';
      msg += `${status} ${c.code} — ${c.rio} ريو (${c.usedCount}/${c.maxUses})\n`;
    });
    return msg;
  }
}
