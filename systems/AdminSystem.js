// systems/AdminSystem.js
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';

export default class AdminSystem {
  constructor({ userSystem, pointsSystem, shopSystem, codeSystem }) {
    this.userSystem = userSystem;
    this.points = pointsSystem;
    this.shop = shopSystem;
    this.codes = codeSystem;
    console.log('👑 AdminSystem جاهز');
  }

  isAdmin(user) {
    return user.isAdmin === true;
  }

  async log(adminId, action, targetId, details = {}) {
    try {
      await AuditLog.create({ adminId, action, targetId, details });
    } catch (e) {
      console.error('⚠️ فشل تسجيل الحدث:', e.message);
    }
  }

  // ===================================
  // إدارة النقاط
  // ===================================
  async addPoints(admin, targetId, amount) {
    const target = await this.userSystem.findByIdentifier(targetId);
    if (!target) return '❌ اللاعب غير موجود';
    if (!amount || amount <= 0) return '❌ كمية غير صالحة';

    await this.points.addRio(target, amount);
    await this.log(admin.userId, 'add_points', target.userId, { amount });

    return `✅ تم إضافة ${amount} ريو\n\n👤 ${target.userId}\n💎 رصيده: ${target.rio}`;
  }

  async removePoints(admin, targetId, amount) {
    const target = await this.userSystem.findByIdentifier(targetId);
    if (!target) return '❌ اللاعب غير موجود';
    if (!amount || amount <= 0) return '❌ كمية غير صالحة';
    if (target.rio < amount) return '❌ رصيد اللاعب أقل من المطلوب';

    await this.points.spendRio(target, amount);
    await this.log(admin.userId, 'remove_points', target.userId, { amount });

    return `✅ تم خصم ${amount} ريو\n\n👤 ${target.userId}\n💎 رصيده: ${target.rio}`;
  }

  async setPoints(admin, targetId, amount) {
    const target = await this.userSystem.findByIdentifier(targetId);
    if (!target) return '❌ اللاعب غير موجود';
    if (amount < 0) return '❌ كمية غير صالحة';

    await this.points.setRio(target, amount);
    await this.log(admin.userId, 'set_points', target.userId, { amount });

    return `✅ تم تعيين الرصيد\n\n👤 ${target.userId}\n💎 رصيده: ${target.rio}`;
  }

  // ===================================
  // إدارة اللاعبين
  // ===================================
  async freeze(admin, targetId) {
    const result = await this.userSystem.freeze(targetId);
    if (result.error) return result.error;
    await this.log(admin.userId, 'freeze', result.user.userId, {});
    return `❄️ تم تجميد: ${result.user.userId}`;
  }

  async unfreeze(admin, targetId) {
    const result = await this.userSystem.unfreeze(targetId);
    if (result.error) return result.error;
    await this.log(admin.userId, 'unfreeze', result.user.userId, {});
    return `✅ تم فك التجميد: ${result.user.userId}`;
  }

  async deleteUser(admin, targetId) {
    const result = await this.userSystem.deleteUser(targetId);
    if (result.error) return result.error;
    await this.log(admin.userId, 'delete_user', result.deletedId, {});
    return `🗑️ تم حذف: ${result.deletedId}`;
  }

  async showPlayer(targetId) {
    const target = await this.userSystem.findByIdentifier(targetId);
    if (!target) return '❌ اللاعب غير موجود';

    let msg = `👤 ${target.userId}\n\n`;
    msg += `💰 الرصيد: ${target.rio}\n`;
    msg += `⭐ المستوى: ${target.level}\n`;
    msg += `📊 إجمالي مكتسب: ${target.totalEarned}\n`;
    msg += `🔥 Streak: ${target.streak}\n`;
    msg += `🎮 ألعاب: ${target.gamesPlayed}\n`;
    msg += `🏆 انتصارات: ${target.gamesWon}\n`;
    msg += `🎖️ شارات: ${target.achievements.length}\n`;
    msg += `👥 إحالات: ${target.referralCount}\n`;
    msg += `📱 المنصة: ${target.platform} (${target.platformId})\n`;
    msg += `❄️ الحالة: ${target.isFrozen ? 'مجمّد' : 'نشط'}\n`;
    msg += `👑 أدمن: ${target.isAdmin ? 'نعم' : 'لا'}\n`;
    msg += `📅 مسجل: ${new Date(target.registeredAt).toLocaleDateString('ar-EG')}`;

    return msg;
  }

  // ===================================
  // القوائم
  // ===================================
  async listPlayers(page = 1) {
    const perPage = 10;
    const total = await User.countDocuments();
    const totalPages = Math.ceil(total / perPage);
    if (page < 1 || page > totalPages) return `❌ الصفحة ${page} غير موجودة. الإجمالي: ${totalPages}`;

    const users = await User.find()
      .sort({ registeredAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .select('userId rio level isFrozen isAdmin');

    let msg = `📋 اللاعبون — صفحة ${page}/${totalPages}\n\n`;
    users.forEach(u => {
      const frozen = u.isFrozen ? '❄️' : '';
      const admin = u.isAdmin ? '👑' : '';
      msg += `• ${u.userId} ${admin}${frozen}\n   💰 ${u.rio} | ⭐ Lv.${u.level}\n`;
    });
    msg += `\n📊 الإجمالي: ${total}`;
    return msg;
  }

  async listFrozen() {
    const users = await User.find({ isFrozen: true }).select('userId frozenReason frozenAt');
    if (users.length === 0) return '❄️ لا يوجد مجمدون';

    let msg = `❄️ المجمدون (${users.length})\n\n`;
    users.forEach(u => {
      msg += `• ${u.userId}\n   السبب: ${u.frozenReason || 'غير محدد'}\n`;
    });
    return msg;
  }

  async stats() {
    const stats = await this.userSystem.getStats();
    let msg = `📊 إحصائيات\n\n`;
    msg += `👥 اللاعبون: ${stats.totalUsers}\n`;
    msg += `❄️ المجمدون: ${stats.frozen}\n`;
    msg += `💰 إجمالي الريو الحالي: ${stats.totalRio}\n`;
    msg += `📈 إجمالي المكتسب: ${stats.totalEarned}\n`;
    return msg;
  }

  // ===================================
  // إدارة الأدمن
  // ===================================
  async promote(admin, targetId) {
    const target = await this.userSystem.findByIdentifier(targetId);
    if (!target) return '❌ اللاعب غير موجود';
    if (target.userId === 'M000R') return '❌ لا يمكن ترقية الأدمن الرئيسي';
    if (target.isAdmin) return '❌ هو أدمن بالفعل';

    target.isAdmin = true;
    await target.save();
    await this.log(admin.userId, 'promote', target.userId, {});
    return `👑 تم ترقية: ${target.userId}`;
  }

  async demote(admin, targetId) {
    const target = await this.userSystem.findByIdentifier(targetId);
    if (!target) return '❌ اللاعب غير موجود';
    if (target.userId === 'M000R') return '❌ لا يمكن إنزال الأدمن الرئيسي';
    if (!target.isAdmin) return '❌ ليس أدمن';

    target.isAdmin = false;
    await target.save();
    await this.log(admin.userId, 'demote', target.userId, {});
    return `✅ تم إنزال: ${target.userId}`;
  }

  // ===================================
  // رسالة خاصة
  // ===================================
  async sendMessage(admin, targetId, text) {
    const target = await this.userSystem.findByIdentifier(targetId);
    if (!target) return { error: '❌ اللاعب غير موجود' };
    await this.log(admin.userId, 'message', target.userId, { text });
    return {
      success: true,
      sendTo: {
        platform: target.platform,
        platformId: target.platformId,
        text: `📩 رسالة من الإدارة\n\n${text}`
      }
    };
  }
}
