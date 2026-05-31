'use strict';

const { db } = require('../db/schema');

// Reads the Google Sheets webhook config from the settings table so it can be
// managed from the admin UI (Pengaturan → Google Sheets), like the Telegram bot.
function getConfig() {
  const rows = db.prepare(
    `SELECT key, value FROM settings
     WHERE key IN ('sheets_sync_enabled','sheets_webhook_url','sheets_webhook_secret')`
  ).all();
  const c = {};
  for (const r of rows) c[r.key] = r.value;
  return c;
}

/**
 * Push one row to the Google Sheet via the Apps Script web-app webhook.
 * Fire-and-forget: never throws, so a Sheets outage can't break the app.
 *
 * @param {string} type  - sheet/tab name (e.g. 'Orders', 'Customers')
 * @param {object} row   - { columnName: value, ... }
 * @param {string} [key] - field in `row` used as the unique id for upsert
 *                          (e.g. 'order_id'). Omit to always append.
 */
async function syncRow(type, row, key) {
  try {
    const c = getConfig();
    if (c.sheets_sync_enabled !== '1' || !c.sheets_webhook_url) return;

    if (typeof fetch !== 'function') {
      console.error('[Sheets] global fetch unavailable (needs Node 18+).');
      return;
    }

    const res = await fetch(c.sheets_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: c.sheets_webhook_secret || '',
        type,
        key: key || '',
        row,
      }),
      redirect: 'follow',
    });
    if (!res.ok) {
      console.error(`[Sheets] sync ${type} failed: HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(`[Sheets] sync ${type} error:`, err.message);
  }
}

module.exports = { syncRow };
