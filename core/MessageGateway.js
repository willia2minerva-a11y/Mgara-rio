// core/MessageGateway.js
// Queue + Pacing + Delivery Protection (ليس Anti-Spam)
export default class MessageGateway {
  constructor({ send, logger = console, name = 'Gateway' } = {}) {
    if (typeof send !== 'function') throw new Error('MessageGateway: send required');

    this.sendTransport = send;
    this.logger = logger;
    this.name = name;

    this.minIntervalMs = 5000;
    this.maxIntervalMs = 15000;
    this.spamIntervalMs = 16000;
    this.spamQueueThreshold = 20;
    this.spamDurationMs = 5 * 60 * 1000;
    this.spamUntil = 0;

    this.perUserMinIntervalMs = 3000;
    this.perUserSpamWindowMs = 60000;
    this.perUserSpamThreshold = 5;
    this.perUserSpamIntervalMs = 20000;
    this.userLastSent = new Map();
    this.userRecentSends = new Map();

    this.maxQueueSize = 500;
    this.maxQueueAgeMs = 24 * 60 * 60 * 1000;
    this.maxPerHour = 300;
    this.maxPerDay = 6000;

    this.hourStart = Date.now();
    this.dayStart = Date.now();
    this.hourlySent = 0;
    this.dailySent = 0;

    this.maxRetries = 2;
    this.retryDelayMs = 60000;

    this.queue = [];
    this.processing = false;
    this.lastSentAt = 0;
    this.shuttingDown = false;

    this.restrictionUntil = 0;
    this.restrictionLevel = 0;
    this.restrictionDurations = [
      30 * 60 * 1000,
      2 * 60 * 60 * 1000,
      6 * 60 * 60 * 1000,
      12 * 60 * 60 * 1000,
      24 * 60 * 60 * 1000
    ];

    this.stats = {
      sent: 0,
      failed: 0,
      dropped: 0,
      retried: 0,
      restrictions: 0,
      outOfWindow: 0,
      spamModeEntries: 0
    };

    this._monitorInterval = setInterval(() => this._monitor(), 5 * 60 * 1000);
  }

  enqueue({ recipientId, platform, text }) {
    if (!recipientId || !text) {
      return Promise.reject(new Error('recipientId and text required'));
    }

    if (this.shuttingDown) return Promise.reject(new Error('Shutting down'));

    if (this._isRestricted()) {
      this.stats.dropped++;
      return Promise.reject(new Error('Restricted'));
    }

    if (this.queue.length >= this.maxQueueSize) {
      this.stats.dropped++;
      return Promise.reject(new Error('Queue full'));
    }

    this._resetCountersIfNeeded();
    if (this.hourlySent >= this.maxPerHour) {
      this.stats.dropped++;
      return Promise.reject(new Error('Hourly limit'));
    }
    if (this.dailySent >= this.maxPerDay) {
      this.stats.dropped++;
      return Promise.reject(new Error('Daily limit'));
    }

    let resolveP, rejectP;
    const msg = {
      recipientId,
      platform,
      text,
      createdAt: Date.now(),
      attempts: 0,
      promise: new Promise((res, rej) => { resolveP = res; rejectP = rej; }),
      resolve: resolveP,
      reject: rejectP
    };

    this.queue.push(msg);
    this._processQueue();
    return msg.promise;
  }

  async _processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.queue.length > 0 && !this.shuttingDown) {
        if (this._isRestricted()) {
          const wait = Math.min(60000, this.restrictionUntil - Date.now());
          if (wait > 0) await this._sleep(wait);
          continue;
        }

        const msg = this.queue.shift();

        await this._waitForGlobalSlot();
        await this._waitForUserSlot(msg.recipientId);

        try {
          await this._sendWithRetry(msg);
          this.stats.sent++;
          this.hourlySent++;
          this.dailySent++;
          this.lastSentAt = Date.now();
          this.userLastSent.set(msg.recipientId, Date.now());
          this._trackUserSend(msg.recipientId);
          msg.resolve(true);
        } catch (err) {
          this.stats.failed++;
          msg.reject(err);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  async _waitForGlobalSlot() {
    const interval = this._getCurrentInterval();
    const elapsed = Date.now() - this.lastSentAt;
    const wait = Math.max(0, interval - elapsed);
    if (wait > 0) await this._sleep(wait);
  }

  _getCurrentInterval() {
    if (Date.now() < this.spamUntil) return this.spamIntervalMs;

    if (this.queue.length >= this.spamQueueThreshold) {
      this.spamUntil = Date.now() + this.spamDurationMs;
      this.stats.spamModeEntries++;
      this.logger.warn?.(`🚨 [${this.name}] وضع السبام (${this.queue.length}) — 16s`);
      return this.spamIntervalMs;
    }

    const range = this.maxIntervalMs - this.minIntervalMs;
    return this.minIntervalMs + Math.floor(Math.random() * (range + 1));
  }

  async _waitForUserSlot(recipientId) {
    const last = this.userLastSent.get(recipientId) || 0;
    const cutoff = Date.now() - this.perUserSpamWindowMs;
    const recent = (this.userRecentSends.get(recipientId) || []).filter(t => t > cutoff);
    const isSpam = recent.length >= this.perUserSpamThreshold;
    const interval = isSpam ? this.perUserSpamIntervalMs : this.perUserMinIntervalMs;
    const wait = Math.max(0, interval - (Date.now() - last));
    if (wait > 0) await this._sleep(wait);
  }

  _trackUserSend(recipientId) {
    const now = Date.now();
    const cutoff = now - this.perUserSpamWindowMs;
    let arr = (this.userRecentSends.get(recipientId) || []).filter(t => t > cutoff);
    arr.push(now);
    this.userRecentSends.set(recipientId, arr);
  }

  async _sendWithRetry(msg) {
    while (true) {
      try {
        return await this.sendTransport(msg);
      } catch (error) {
        const kind = this._classifyError(error);

        if (kind === 'restriction') {
          this.stats.restrictions++;
          this._activateRestriction();
          throw error;
        }
        if (kind === 'out_of_window') {
          this.stats.outOfWindow++;
          throw error;
        }

        const canRetry = (kind === 'rate_limit' || kind === 'temporary') && msg.attempts < this.maxRetries;
        if (canRetry) {
          msg.attempts++;
          this.stats.retried++;
          await this._sleep(this.retryDelayMs);
          continue;
        }
        throw error;
      }
    }
  }

  _classifyError(error) {
    const data = error?.response?.data?.error || {};
    const code = Number(data.code);
    const subcode = Number(data.error_subcode);

    if (subcode === 1893063) return 'restriction';
    if (code === 613) return 'rate_limit';
    if (code === 10 && subcode === 2018278) return 'out_of_window';
    if (code === 190 || code === 200) return 'permission';

    const status = Number(error?.response?.status);
    if (status === 429 || status >= 500) return 'temporary';
    return 'permanent';
  }

  _activateRestriction() {
    const duration = this.restrictionDurations[Math.min(this.restrictionLevel, this.restrictionDurations.length - 1)];
    this.restrictionUntil = Date.now() + duration;
    this.restrictionLevel = Math.min(this.restrictionLevel + 1, this.restrictionDurations.length - 1);
    const min = Math.round(duration / 60000);
    this.logger.warn?.(`🛑 [${this.name}] 1893063 — إيقاف ${min}د`);
  }

  _isRestricted() {
    return Date.now() < this.restrictionUntil;
  }

  _resetCountersIfNeeded() {
    const now = Date.now();
    if (now - this.hourStart >= 3600000) {
      this.hourStart = now;
      this.hourlySent = 0;
    }
    if (now - this.dayStart >= 86400000) {
      this.dayStart = now;
      this.dailySent = 0;
    }
  }

  _monitor() {
    if (this.stats.sent > 0 || this.queue.length > 0 || this._isRestricted()) {
      this.logger.log?.(
        `📊 [${this.name}] ✅ ${this.stats.sent} | ❌ ${this.stats.failed} | ` +
        `🗑️ ${this.stats.dropped} | ⏳ ${this.queue.length} | ` +
        `${this._isRestricted() ? '🛑' : '▶️'}`
      );
    }
  }

  getStats() {
    return {
      sent: this.stats.sent,
      failed: this.stats.failed,
      dropped: this.stats.dropped,
      retried: this.stats.retried,
      restrictions: this.stats.restrictions,
      queue: this.queue.length,
      processing: this.processing,
      restricted: this._isRestricted(),
      restrictionUntil: this.restrictionUntil || null,
      hourly: `${this.hourlySent}/${this.maxPerHour}`,
      daily: `${this.dailySent}/${this.maxPerDay}`
    };
  }

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  async shutdown() {
    this.shuttingDown = true;
    clearInterval(this._monitorInterval);
    for (const msg of this.queue.splice(0)) {
      this.stats.dropped++;
      msg.reject(new Error('Shutdown'));
    }
  }
}
