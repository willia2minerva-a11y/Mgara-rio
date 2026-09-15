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

const MONGODB_URI = process.env.MONGODB_URI;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
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

  // حذف الفهارس القديمة
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
  const userSystem = new UserSystem();
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
    adminSystem
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

    // رسالة خاصة من الأدمن
    if (response.sendTo) {
      await gateway.enqueue({
        recipientId: response.sendTo.platformId,
        platform: response.sendTo.platform,
        text: response.sendTo.text
      });
      return;
    }

    // رسالة عادية
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
// Endpoints
// ===================================
app.get('/', (req, res) => {
  res.json({ status: '✅', name: '🏔️ مغارة ريو', version: '2.0.0' });
});

app.get('/gateway', (req, res) => {
  res.json(gateway.getStats());
});

app.get('/admin/reset/:secret', async (req, res) => {
  const secret = process.env.RESET_SECRET || 'mgara-reset-2026';
  if (req.params.secret !== secret) return res.status(403).json({ error: 'ممنوع' });

  try {
    const result = await User.deleteMany({});
    res.json({ success: true, deleted: result.deletedCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
    });
  } catch (error) {
    console.error('❌ فشل البدء:', error);
    process.exit(1);
  }
}

// Shutdown
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
