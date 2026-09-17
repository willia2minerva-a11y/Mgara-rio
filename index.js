// index.js
// 🏔️ مغارة ريو V2
import mongoose from 'mongoose';
import 'dotenv/config';
import express from 'express';
import axios from 'axios';

import MessageGateway from './core/MessageGateway.js';
import GeminiClient from './core/GeminiClient.js';
import CommandHandler from './core/CommandHandler.js';

import User from './models/User.js';
import UserSystem from './systems/UserSystem.js';
import PointsSystem from './systems/PointsSystem.js';
import DailyGiftSystem from './systems/DailyGiftSystem.js';
import MillionaireGame from './systems/MillionaireGame.js';
import GameSystem from './systems/GameSystem.js';
import ShopSystem from './systems/ShopSystem.js';
import CodeSystem from './systems/CodeSystem.js';
import ReferralSystem from './systems/ReferralSystem.js';
import AchievementSystem from './systems/AchievementSystem.js';
import WeeklyMissions from './systems/WeeklyMissions.js';
import LeaderboardSystem from './systems/LeaderboardSystem.js';
import AdminSystem from './systems/AdminSystem.js';
import ArchiveSystem from './systems/ArchiveSystem.js';

const MONGODB_URI = process.env.MONGODB_URI;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const RESET_SECRET = process.env.RESET_SECRET || 'mgara-reset-2026';
const PORT = process.env.PORT || 3000;

if (!MONGODB_URI || !PAGE_ACCESS_TOKEN) {
  console.error('❌ متغيرات البيئة مطلوبة: MONGODB_URI, PAGE_ACCESS_TOKEN');
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let commandHandler = null;
let telegramBot = null;
let userSystem = null;

// ===================================
// Gateway
// ===================================
const gateway = new MessageGateway({
  name: 'FB-Gateway',
  send: async (msg) => {
    if (msg.platform === 'facebook') {
      await axios.post(
        `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
        { recipient: { id: msg.recipientId }, message: { text: msg.text } },
        { timeout: 20000 }
      );
    } else if (msg.platform === 'telegram' && telegramBot) {
      await telegramBot.sendMessage(msg.recipientId, msg.text);
    }
  }
});

// ===================================
// Database
// ===================================
async function connectDB() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ متصل بقاعدة البيانات');

  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    if (collections.find(c => c.name === 'users')) {
      const indexes = await mongoose.connection.db.collection('users').indexes();
      for (const idx of indexes) {
        if (idx.name === 'userId_1' || idx.name === 'username_1') {
          try {
            await mongoose.connection.db.collection('users').dropIndex(idx.name);
            console.log(`✅ تم حذف الفهرس القديم: ${idx.name}`);
          } catch (e) {}
        }
      }
    }
  } catch (e) {}
}

// ===================================
// Systems
// ===================================
function initSystems() {
  userSystem = new UserSystem();
  const pointsSystem = new PointsSystem();
  const achievementSystem = new AchievementSystem(pointsSystem);
  const dailyGift = new DailyGiftSystem(pointsSystem, achievementSystem);
  const gemini = new GeminiClient();
  const millionaireGame = new MillionaireGame(pointsSystem, achievementSystem, gemini);
  const shop = new ShopSystem(pointsSystem, achievementSystem);
  const codes = new CodeSystem(pointsSystem);
  const referral = new ReferralSystem(pointsSystem, achievementSystem);
  const missions = new WeeklyMissions(pointsSystem);
  const leaderboard = new LeaderboardSystem();
  const adminSystem = new AdminSystem({ userSystem, pointsSystem, shopSystem: shop, codeSystem: codes });
  const gameSystem = new GameSystem(pointsSystem, achievementSystem, missions, millionaireGame);
  const archiveSystem = new ArchiveSystem();

  const systems = {
    userSystem,
    pointsSystem,
    achievementSystem,
    dailyGift,
    gemini,
    game: millionaireGame,
    gameSystem,
    shop,
    codes,
    referral,
    missions,
    leaderboard,
    adminSystem,
    archiveSystem
  };

  commandHandler = new CommandHandler(systems);

  shop.initialize().catch(e => console.error('Shop init error:', e.message));

  console.log('✅ كل الأنظمة جاهزة');
}

// ===================================
// Handle Message
// ===================================
async function handleMessage(platformId, platform, text) {
  try {
    const sender = { id: platformId, platform };
    const response = await commandHandler.process(sender, text);

    if (response === null || response === undefined) return;

    if (response.sendTo) {
      await gateway.enqueue({
        recipientId: response.sendTo.platformId,
        platform: response.sendTo.platform,
        text: response.sendTo.text
      });
      return;
    }

    if (typeof response === 'string') {
      await gateway.enqueue({
        recipientId: platformId,
        platform,
        text: response
      });
    }
  } catch (error) {
    console.error('❌ خطأ في معالجة الرسالة:', error.message);
  }
}

// ===================================
// Webhook Facebook
// ===================================
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  try {
    const { body } = req;
    if (body.object === 'page') {
      for (const entry of body.entry) {
        for (const event of entry.messaging) {
          if (event.message && event.message.text) {
            handleMessage(event.sender.id, 'facebook', event.message.text).catch(console.error);
          }
          if (event.postback && event.postback.payload === 'GET_STARTED') {
            handleMessage(event.sender.id, 'facebook', 'بدء').catch(console.error);
          }
        }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    res.sendStatus(500);
  }
});

// ===================================
// Public Endpoints
// ===================================
app.get('/', (req, res) => {
  res.json({ status: '✅', name: '🏔️ مغارة ريو', version: '2.0.0' });
});

app.get('/gateway', (req, res) => {
  res.json(gateway.getStats());
});

app.get('/public/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isFrozen: false });
    res.json({
      success: true,
      players: totalUsers,
      active: activeUsers,
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===================================
// ✅ Admin Endpoints
// ===================================

app.get('/admin/reset/:secret', async (req, res) => {
  if (req.params.secret !== RESET_SECRET) {
    return res.status(403).json({ error: '❌ ممنوع' });
  }

  try {
    const result = await resetAll();
    console.log(`🗑️ [ENDPOINT] تم حذف كل شيء — ${result.users} لاعب`);
    res.json({
      success: true,
      message: '✅ تم حذف كل شيء',
      deleted: result
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/admin/shadow/:secret', async (req, res) => {
  if (req.params.secret !== RESET_SECRET) {
    return res.status(403).json({ error: '❌ ممنوع' });
  }

  try {
    const result = await resetShadow();
    console.log(`🗑️ [ENDPOINT] shadow — ${result.users} لاعب، أبقى ${result.kept}`);
    res.json({
      success: true,
      message: '✅ تم الحذف مع الإبقاء على الأدمن',
      deleted: result
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/admin/pause/:secret', (req, res) => {
  if (req.params.secret !== RESET_SECRET) {
    return res.status(403).json({ error: '❌ ممنوع' });
  }

  if (userSystem) {
    userSystem.setBotMode('off');
    console.log('🔴 [ENDPOINT] تم التحويل لوضع الإيقاف');
    res.json({ success: true, message: '🔴 تم التحويل لوضع الإيقاف' });
  } else {
    res.status(500).json({ error: 'الأنظمة غير جاهزة' });
  }
});

app.get('/admin/resume/:secret', (req, res) => {
  if (req.params.secret !== RESET_SECRET) {
    return res.status(403).json({ error: '❌ ممنوع' });
  }

  if (userSystem) {
    userSystem.setBotMode('auto');
    console.log('🟢 [ENDPOINT] تم التحويل للوضع الآلي');
    res.json({ success: true, message: '🟢 تم التحويل للوضع الآلي' });
  } else {
    res.status(500).json({ error: 'الأنظمة غير جاهزة' });
  }
});

// ✅ الوضع الآلي
app.get('/admin/mode/auto/:secret', (req, res) => {
  if (req.params.secret !== RESET_SECRET) {
    return res.status(403).json({ error: '❌ ممنوع' });
  }
  if (userSystem) {
    userSystem.setBotMode('auto');
    console.log('🟢 [ENDPOINT] وضع آلي');
    res.json({ success: true, mode: 'auto', message: '🟢 الوضع الآلي' });
  } else {
    res.status(500).json({ error: 'الأنظمة غير جاهزة' });
  }
});

// ✅ الوضع اليدوي
app.get('/admin/mode/manual/:secret', (req, res) => {
  if (req.params.secret !== RESET_SECRET) {
    return res.status(403).json({ error: '❌ ممنوع' });
  }
  if (userSystem) {
    userSystem.setBotMode('manual');
    console.log('🟡 [ENDPOINT] وضع يدوي');
    res.json({ success: true, mode: 'manual', message: '🟡 الوضع اليدوي' });
  } else {
    res.status(500).json({ error: 'الأنظمة غير جاهزة' });
  }
});

// ✅ وضع الإيقاف
app.get('/admin/mode/off/:secret', (req, res) => {
  if (req.params.secret !== RESET_SECRET) {
    return res.status(403).json({ error: '❌ ممنوع' });
  }
  if (userSystem) {
    userSystem.setBotMode('off');
    console.log('🔴 [ENDPOINT] وضع إيقاف');
    res.json({ success: true, mode: 'off', message: '🔴 وضع الإيقاف' });
  } else {
    res.status(500).json({ error: 'الأنظمة غير جاهزة' });
  }
});

// ✅ عرض الوضع الحالي
app.get('/admin/mode/:secret', (req, res) => {
  if (req.params.secret !== RESET_SECRET) {
    return res.status(403).json({ error: '❌ ممنوع' });
  }
  if (userSystem) {
    res.json({ success: true, mode: userSystem.isBotMode() });
  } else {
    res.status(500).json({ error: 'الأنظمة غير جاهزة' });
  }
});

app.get('/admin/stats/:secret', async (req, res) => {
  if (req.params.secret !== RESET_SECRET) {
    return res.status(403).json({ error: '❌ ممنوع' });
  }

  try {
    const stats = await userSystem.getStats();
    const topPlayers = await User.find()
      .sort({ totalEarned: -1 })
      .limit(5)
      .select('userId rio totalEarned level');

    res.json({
      success: true,
      botMode: userSystem.isBotMode(),
      stats,
      topPlayers
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===================================
// Reset Functions
// ===================================
async function resetAll() {
  const counts = {};

  counts.users = (await User.deleteMany({})).deletedCount;

  try {
    const Counter = (await import('./models/Counter.js')).default;
    counts.counters = (await Counter.deleteMany({})).deletedCount;
  } catch (e) { counts.counters = 0; }

  try {
    const Archive = (await import('./models/Archive.js')).default;
    counts.archives = (await Archive.deleteMany({})).deletedCount;
  } catch (e) { counts.archives = 0; }

  try {
    const TransactionLog = (await import('./models/TransactionLog.js')).default;
    counts.logs = (await TransactionLog.deleteMany({})).deletedCount;
  } catch (e) { counts.logs = 0; }

  try {
    const ActiveGame = (await import('./models/ActiveGame.js')).default;
    counts.activeGames = (await ActiveGame.deleteMany({})).deletedCount;
  } catch (e) { counts.activeGames = 0; }

  return counts;
}

async function resetShadow() {
  const counts = { users: 0, kept: 0 };

  const result = await User.deleteMany({
    userId: { $ne: 'R_000' }
  });
  counts.users = result.deletedCount;
  counts.kept = await User.countDocuments();

  return counts;
}

// ===================================
// Telegram Bot
// ===================================
async function setupTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('ℹ️ لا يوجد TELEGRAM_BOT_TOKEN — تخطي');
    return;
  }

  try {
    const TelegramBot = (await import('node-telegram-bot-api')).default;
    telegramBot = new TelegramBot(token, { polling: true });

    telegramBot.on('message', async (msg) => {
      if (!msg.text) return;
      await handleMessage(String(msg.chat.id), 'telegram', msg.text);
    });

    console.log('✅ Telegram Bot يعمل');
  } catch (e) {
    console.error('❌ Telegram error:', e.message);
  }
}

// ===================================
// Main
// ===================================
async function main() {
  console.log('🚀 بدء تشغيل مغارة ريو V2...');

  try {
    await connectDB();
    initSystems();
    await setupTelegram();

    app.listen(PORT, () => {
      console.log(`✅ يعمل على المنفذ ${PORT}`);
      console.log('📱 جاهز');
      console.log('');
      console.log('🔗 Endpoints:');
      console.log(`   GET /public/stats`);
      console.log(`   GET /admin/mode/auto/${RESET_SECRET}`);
      console.log(`   GET /admin/mode/manual/${RESET_SECRET}`);
      console.log(`   GET /admin/mode/off/${RESET_SECRET}`);
      console.log(`   GET /admin/reset/${RESET_SECRET}`);
      console.log(`   GET /admin/stats/${RESET_SECRET}`);
    });
  } catch (error) {
    console.error('❌ فشل البدء:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM');
  await gateway.shutdown();
  process.exit(0);
});
process.on('SIGINT', async () => {
  console.log('🛑 SIGINT');
  await gateway.shutdown();
  process.exit(0);
});

process.on('unhandledRejection', (r) => console.error('❌ Unhandled:', r));
process.on('uncaughtException', (e) => console.error('❌ Uncaught:', e));

main().catch(console.error);
