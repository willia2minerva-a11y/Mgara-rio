// systems/ArchiveSystem.js
import User from '../models/User.js';
import Archive from '../models/Archive.js';

export default class ArchiveSystem {
  constructor() {
    console.log('📚 ArchiveSystem جاهز');
  }

  // ===================================
  // توليد أرشيف جديد كل 100 لاعب
  // ===================================
  async generateArchives() {
    const users = await User.find().sort({ userId: 1 });
    const groups = {};

    // ✅ تجميع حسب الحرف + المئة
    for (const user of users) {
      const match = user.userId.match(/^([A-Z])_(\d+)$/);
      if (!match) continue;

      const letter = match[1];
      const num = parseInt(match[2]);
      const groupIndex = Math.floor(num / 100) + 1;

      const key = `${letter}${groupIndex}`;
      if (!groups[key]) {
        groups[key] = {
          archiveId: key,
          letter,
          index: groupIndex,
          fromId: `${letter}_${String(groupIndex * 100 - 100).padStart(3, '0')}`,
          toId: `${letter}_${String(groupIndex * 100 - 1).padStart(3, '0')}`,
          users: []
        };
      }
      groups[key].users.push(user);
    }

    // ✅ إنشاء/تحديث الأرشيفات
    for (const [archiveId, data] of Object.entries(groups)) {
      const users = data.users;
      const activeCount = users.filter(u => !u.isFrozen).length;
      const frozenCount = users.filter(u => u.isFrozen).length;
      const totalRio = users.reduce((sum, u) => sum + u.rio, 0);

      let topPlayer = users[0];
      for (const u of users) {
        if (u.rio > topPlayer.rio) topPlayer = u;
      }

      await Archive.findOneAndUpdate(
        { archiveId },
        {
          archiveId,
          letter: data.letter,
          index: data.index,
          fromId: data.fromId,
          toId: data.toId,
          playerCount: users.length,
          activeCount,
          frozenCount,
          totalRio,
          topPlayerId: topPlayer.userId,
          topRio: topPlayer.rio,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
    }

    console.log(`📚 تم تحديث ${Object.keys(groups).length} أرشيف`);
    return Object.keys(groups).length;
  }

  // ===================================
  // قائمة الأرشيفات
  // ===================================
  async listArchives(letter = null) {
    const query = letter ? { letter: letter.toUpperCase() } : {};
    const archives = await Archive.find(query).sort({ letter: 1, index: 1 });

    if (archives.length === 0) {
      return '📚 لا توجد أرشيفات بعد\n\n💡 تُنشأ تلقائيًا كل 100 لاعب';
    }

    let msg = '📚 الأرشيفات\n\n';

    // ✅ تجميع حسب الحرف
    const byLetter = {};
    archives.forEach(a => {
      if (!byLetter[a.letter]) byLetter[a.letter] = [];
      byLetter[a.letter].push(a);
    });

    for (const [ltr, list] of Object.entries(byLetter)) {
      msg += `🔤 حرف ${ltr}:\n`;
      list.forEach(a => {
        msg += `  • ${a.archiveId} — ${a.fromId} إلى ${a.toId} (${a.playerCount} لاعب)\n`;
      });
      msg += '\n';
    }

    msg += '💡 للعرض: ارشيف [الرمز]\n';
    msg += 'مثال: ارشيف R1';
    return msg;
  }

  // ===================================
  // عرض أرشيف محدد
  // ===================================
  async showArchive(archiveId) {
    if (!archiveId) return null;

    const clean = archiveId.trim().toUpperCase();
    const archive = await Archive.findOne({ archiveId: clean });

    if (!archive) {
      return `❌ الأرشيف غير موجود: ${clean}

💡 اعرض القائمة: ارشيف`;
    }

    let msg = `📚 ${archive.archiveId}\n\n`;
    msg += `📊 المدى: ${archive.fromId} إلى ${archive.toId}\n`;
    msg += `👥 العدد: ${archive.playerCount}\n`;
    msg += `✅ نشط: ${archive.activeCount}\n`;
    msg += `❄️ مجمد: ${archive.frozenCount}\n\n`;
    msg += `💰 إجمالي الريو: ${archive.totalRio}\n`;
    msg += `📊 متوسط: ${Math.floor(archive.totalRio / archive.playerCount)}\n\n`;

    if (archive.topPlayerId) {
      msg += `🏆 الأعلى: ${archive.topPlayerId} (${archive.topRio} ريو)\n\n`;
    }

    msg += `💡 لعرض لاعب: حالة [ID]`;
    return msg;
  }

  // ===================================
  // تحديث أرشيف واحد
  // ===================================
  async updateArchive(archiveId) {
    const archive = await Archive.findOne({ archiveId });
    if (!archive) return { error: '❌ الأرشيف غير موجود' };

    const users = await User.find({
      userId: { $regex: `^${archive.letter}_` }
    }).where('userId').gte(archive.fromId).lte(archive.toId);

    if (users.length === 0) {
      return { error: '❌ لا يوجد لاعبون في هذا النطاق' };
    }

    archive.playerCount = users.length;
    archive.activeCount = users.filter(u => !u.isFrozen).length;
    archive.frozenCount = users.filter(u => u.isFrozen).length;
    archive.totalRio = users.reduce((sum, u) => sum + u.rio, 0);

    let topPlayer = users[0];
    for (const u of users) {
      if (u.rio > topPlayer.rio) topPlayer = u;
    }
    archive.topPlayerId = topPlayer.userId;
    archive.topRio = topPlayer.rio;
    archive.updatedAt = new Date();

    await archive.save();
    return { success: true };
  }
}
