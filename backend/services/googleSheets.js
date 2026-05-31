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

/** True when a webhook URL has been configured (regardless of the enable toggle). */
function isConfigured() {
  return !!getConfig().sheets_webhook_url;
}

/** Low-level POST to the Apps Script web app. Returns true on success. */
async function _send(c, type, row, key) {
  if (!c.sheets_webhook_url) return false;
  if (typeof fetch !== 'function') {
    console.error('[Sheets] global fetch unavailable (needs Node 18+).');
    return false;
  }
  try {
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
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Sheets] sync ${type} error:`, err.message);
    return false;
  }
}

/**
 * Push one row to the Sheet for automatic, event-driven sync.
 * No-ops unless sync is enabled AND a webhook URL is set.
 * Fire-and-forget: never throws.
 *
 * @param {string} type  - sheet/tab name (e.g. 'Orders', 'Customers')
 * @param {object} row   - { columnName: value, ... }
 * @param {string} [key] - field in `row` used as the unique id for upsert
 */
async function syncRow(type, row, key) {
  const c = getConfig();
  if (c.sheets_sync_enabled !== '1' || !c.sheets_webhook_url) return;
  await _send(c, type, row, key);
}

/**
 * Push one row regardless of the enable toggle (used by "sync everything now").
 * Requires only that a webhook URL is configured. Returns true on success.
 */
async function pushRow(type, row, key) {
  return _send(getConfig(), type, row, key);
}

module.exports = { syncRow, pushRow, isConfigured };
