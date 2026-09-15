// core/CommandHandler.js
import { today } from '../utils/helpers.js';

const COMPOUND_COMMANDS = [
  'اضف_نقاط', 'خصم_نقاط', 'عدل_نقاط',
  'فك_تجميد',
  'عرض_لاعب', 'عرض_اللاعبين', 'عرض_المجمدين',
  'عرض_الاكواد', 'عرض_المنتجات',
  'اضف_منتج', 'حذف_منتج', 'عدل_منتج',
  'اضف_كود', 'حذف_كود',
  'اضف_دولاب', 'حذف_دولاب',
  'اعطي_ادمن', 'ازل_ادمن',
  'اضف_ريو', 'خصم_ريو'
];

const ALIASES = {
  // بدء
  'مرحبا': 'بدء', 'اهلا': 'بدء', 'هلا': 'بدء', 'هاي': 'بدء',
  'السلام عليكم': 'بدء', 'hi': 'بدء', 'hello': 'بدء', 'start': 'بدء',
  'تفعيل': 'بدء', 'تشغيل': 'بدء', 'بداية': 'بدء',

  // مساعدة
  'اوامر': 'مساعدة', 'الاوامر': 'مساعدة', 'help': 'مساعدة',

  // قسم الحساب
  'حساب': 'قسم_الحساب', 'الحساب': 'قسم_الحساب',

  // قسم اللعب
  'لعب': 'قسم_اللعب', 'اللعب': 'قسم_اللعب',

  // قسم الفعاليات
  'فعاليات': 'قسم_الفعاليات', 'الفعاليات': 'قسم_الفعاليات',

  // قسم السوق
  'متجر': 'سوق', 'المتجر': 'سوق', 'shop': 'سوق',

  // باقي aliases
  'رصيدي': 'نقاطي', 'رصيد': 'نقاطي',
  'بروفايلي': 'ملفي', 'حسابي': 'ملفي',
  'id': 'معرفي',
  'افضل': 'توب', 'الافضل': 'توب',
  'هديتي': 'هدية', 'gift': 'هدية', 'daily': 'هدية',
  'اشتري': 'اشتر', 'شراء': 'اشتر', 'شرا': 'اشتر', 'buy': 'اشتر',
  'redeem': 'كود', 'code': 'كود',
  'كودي': 'احالتي', 'referral': 'احالتي',
  'احالة': 'صديق',
  'المهام': 'مهام', 'missions': 'مهام',
  'الادمن': 'مدير', 'admin': 'مدير',
  'مشتريات': 'مشترياتي', 'سجلي': 'مشترياتي',
  'العاب': 'العاب', 'games': 'العاب'
};

const LINKS = {
  page: process.env.PAGE_LINK || 'https://facebook.com/MgaraRio',
  group: process.env.GROUP_LINK || 'https://facebook.com/groups/MgaraRio'
};

export default class CommandHandler {
  constructor(systems) {
    this.userSystem = systems.userSystem;
    this.points = systems.pointsSystem;
    this.dailyGift = systems.dailyGift;
    this.game = systems.game;
    this.shop = systems.shop;
    this.codes = systems.codes;
    this.referral = systems.referral;
    this.achievements = systems.achievementSystem;
    this.missions = systems.missions;
    this.leaderboard = systems.leaderboard;
    this.admin = systems.adminSystem;
    console.log('🎯 CommandHandler جاهز');
  }

  async process
