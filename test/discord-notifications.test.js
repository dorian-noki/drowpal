const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = { window: {}, fetch: null };
vm.runInNewContext(fs.readFileSync('public/discord-notifications.js', 'utf8'), context);
const discord = context.window.DrowpalDiscordNotifications;

test('validates Discord webhook URLs and rejects unsafe URLs', () => {
  assert.equal(discord.validateWebhookUrl('https://discord.com/api/webhooks/123456/token_value'), true);
  assert.equal(discord.validateWebhookUrl('https://discordapp.com/api/webhooks/123456/token_value'), true);
  assert.equal(discord.validateWebhookUrl('http://discord.com/api/webhooks/123456/token_value'), false);
  assert.equal(discord.validateWebhookUrl('https://example.com/api/webhooks/123456/token_value'), false);
});

test('schedule sends only on a selected day and minute once per slot', () => {
  const monday = new Date(2026, 10, 23, 9, 30, 45);
  const config = discord.normalizeConfig({
    days: [1],
    time: '09:30',
    enabled: true,
    webhookUrl: 'https://discord.com/api/webhooks/123456/token'
  });
  assert.equal(discord.isDue(config, monday), true);
  assert.equal(discord.isDue(config, new Date(2026, 10, 24, 9, 30)), false);
  assert.equal(discord.isDue({
    ...config,
    lastSentSlot: discord.scheduleSlot(monday)
  }, monday), false);
  assert.equal(discord.isDue({ ...config, enabled: false }, monday), false);
});

test('random selection stays within candidates and handles empty lists', () => {
  const items = ['a', 'b', 'c'];
  assert.equal(discord.chooseRandom(items, () => 0), 'a');
  assert.equal(discord.chooseRandom(items, () => 0.5), 'b');
  assert.equal(discord.chooseRandom(items, () => 0.999), 'c');
  assert.equal(discord.chooseRandom([], () => 0), null);
});

test('sendWebhook posts Discord-compatible JSON and reports failures', async () => {
  const requests = [];
  context.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, text: async () => '' };
  };
  await discord.sendWebhook(
    'https://discord.com/api/webhooks/123456/token',
    '今日も少しだけ進めよう。',
    'パル'
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    content: '今日も少しだけ進めよう。',
    username: 'パル'
  });
  await assert.rejects(
    () => discord.sendWebhook('https://example.com/hook', '通知'),
    /Webhook URL/
  );
});
