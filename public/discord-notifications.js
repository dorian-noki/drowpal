(function () {
  const WEBHOOK_PATTERN = /^https:\/\/(?:canary\.|ptb\.)?(?:discord(?:app)?\.com)\/api\/webhooks\/\d+\/[^/?#\s]+(?:\?[^\s#]*)?$/i;
  const DEFAULT_CONFIG = {
    enabled: true,
    webhookUrl: '',
    days: [1, 2, 3, 4, 5],
    time: '09:00',
    lastSentSlot: '',
    lastSentAt: '',
    lastError: ''
  };

  function normalizeConfig(config = {}) {
    const days = [...new Set((Array.isArray(config.days) ? config.days : DEFAULT_CONFIG.days)
      .map(Number)
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
    const time = typeof config.time === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(config.time)
      ? config.time
      : DEFAULT_CONFIG.time;
    return {
      ...DEFAULT_CONFIG,
      ...config,
      enabled: config.enabled !== false,
      webhookUrl: typeof config.webhookUrl === 'string' ? config.webhookUrl.trim() : '',
      days: days.sort((a, b) => a - b),
      time
    };
  }

  function validateWebhookUrl(url) {
    return WEBHOOK_PATTERN.test(String(url || '').trim());
  }

  function scheduleSlot(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function isDue(config, date = new Date()) {
    const normalized = normalizeConfig(config);
    const currentTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const slot = scheduleSlot(date);
    return normalized.enabled
      && validateWebhookUrl(normalized.webhookUrl)
      && normalized.days.includes(date.getDay())
      && normalized.time === currentTime
      && normalized.lastSentSlot !== slot;
  }

  function chooseRandom(items, random = Math.random) {
    if (!Array.isArray(items) || items.length === 0) return null;
    const value = Number(random());
    const index = Math.min(items.length - 1, Math.max(0, Math.floor((Number.isFinite(value) ? value : 0) * items.length)));
    return items[index];
  }

  function buildPayload(content, username) {
    return {
      content: String(content || '').trim(),
      username: String(username || '').trim().slice(0, 80) || 'Drowpal'
    };
  }

  async function sendWebhook(config, content, username = 'Drowpal') {
    const url = typeof config === 'string' ? config : config?.webhookUrl;
    if (!validateWebhookUrl(url)) throw new Error('Discord Webhook URLが正しくありません。');
    const payload = buildPayload(content, username);
    if (!payload.content) throw new Error('通知文が空です。');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Discordへの送信に失敗しました（HTTP ${response.status}）${detail ? `: ${detail.slice(0, 160)}` : ''}`);
    }
  }

  window.DrowpalDiscordNotifications = {
    DEFAULT_CONFIG,
    normalizeConfig,
    validateWebhookUrl,
    scheduleSlot,
    isDue,
    chooseRandom,
    buildPayload,
    sendWebhook
  };
}());
