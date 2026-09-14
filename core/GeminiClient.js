// core/GeminiClient.js
import { GoogleGenerativeAI } from '@google/generative-ai';

// ✅ قائمة الموديلات المتاحة (بالترتيب)
const MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-1.5-flash'
];

export default class GeminiClient {
  constructor() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn('⚠️ GEMINI_API_KEY غير محدد — لن يعمل AI');
      this.enabled = false;
      return;
    }

    this.genAI = new GoogleGenerativeAI(key);
    this.model = null;
    this.enabled = true;
    this.lastFailure = 0;
    this.cooldownMs = 5 * 60 * 1000;
    this.currentModelIndex = 0;

    // استخدام أول موديل افتراضيًا
    this._useModel(0);

    // ✅ فحص الموديلات المتاحة (async)
    this._detectModel().catch(() => {});
  }

  _useModel(index) {
    try {
      this.model = this.genAI.getGenerativeModel({ model: MODELS[index] });
      this.currentModelIndex = index;
      console.log(`✅ Gemini: ${MODELS[index]}`);
    } catch (e) {
      console.error('❌ Gemini model error:', e.message);
    }
  }

  async _detectModel() {
    // نجرب الموديلات بالترتيب
    for (let i = 0; i < MODELS.length; i++) {
      try {
        const testModel = this.genAI.getGenerativeModel({ model: MODELS[i] });
        await testModel.generateContent('قل: نعم');
        this._useModel(i);
        return;
      } catch (e) {
        // ننتقل للموديل التالي
      }
    }
    console.warn('⚠️ لم ينجح أي موديل Gemini — سيتم استخدام البنك فقط');
    this.enabled = false;
  }

  async generateQuestion(level = 'easy') {
    if (!this.enabled || !this.model) return null;
    if (Date.now() - this.lastFailure < this.cooldownMs) return null;

    const prompt = `أنشئ سؤال اختيار من متعدد باللغة العربية الفصحى.
المستوى: ${level}
الموضوع: عام ومفيد (تاريخ، جغرافيا، علوم، رياضة، ثقافة)

الصيغة المطلوبة بالضبط:
Q: [السؤال]
A: [الخيار 1]
B: [الخيار 2]
C: [الخيار 3]
D: [الخيار 4]
Answer: [A/B/C/D]

القواعد:
- الإجابة الصحيحة واحدة فقط
- الأسئلة واقعية ومثبتة
- لا تكرار`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      return this._parse(text);
    } catch (error) {
      console.error('❌ Gemini فشل:', error.message);
      this.lastFailure = Date.now();

      // ✅ نجرب موديل آخر
      const nextIndex = (this.currentModelIndex + 1) % MODELS.length;
      if (nextIndex !== this.currentModelIndex) {
        this._useModel(nextIndex);
      }
      return null;
    }
  }

  _parse(text) {
    try {
      const qMatch = text.match(/Q:\s*(.+)/);
      const aMatch = text.match(/A:\s*(.+)/);
      const bMatch = text.match(/B:\s*(.+)/);
      const cMatch = text.match(/C:\s*(.+)/);
      const dMatch = text.match(/D:\s*(.+)/);
      const ansMatch = text.match(/Answer:\s*([ABCD])/);

      if (!qMatch || !aMatch || !bMatch || !cMatch || !dMatch || !ansMatch) return null;

      const question = qMatch[1].trim();
      const options = [aMatch[1].trim(), bMatch[1].trim(), cMatch[1].trim(), dMatch[1].trim()];
      const correctIndex = ['A', 'B', 'C', 'D'].indexOf(ansMatch[1].trim());

      if (options.length !== 4 || correctIndex < 0) return null;
      if (question.length < 5 || question.length > 300) return null;

      return { question, options, correctIndex };
    } catch (e) {
      return null;
    }
  }
}
