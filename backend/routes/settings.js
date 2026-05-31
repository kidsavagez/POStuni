'use strict';

const express = require('express');
const { db }  = require('../db/schema');
const { verifyToken }  = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleGuard');
const { logAction }    = require('../services/auditLog');
const telegramBot      = require('../services/telegramBot');

const router = express.Router();

// All routes require authentication + admin role
router.use(verifyToken, requireAdmin);

// GET /api/settings
router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`SELECT key, value FROM settings`).all();
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return res.json(settings);
  } catch (err) {
    console.error('[Settings] GET / error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/settings
router.put('/', (req, res) => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Body must be a key-value object' });
    }

    // Get current telegram token before update (to detect change)
    const currentTokenRow = db.prepare(`SELECT value FROM settings WHERE key='telegram_bot_token'`).get();
    const currentToken    = currentTokenRow ? currentTokenRow.value : '';

    const upsert = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);

    const updateAll = db.transaction((kvs) => {
      for (const [key, value] of Object.entries(kvs)) {
        upsert.run(key, String(value));
      }
    });

    updateAll(updates);

    logAction(db, req.user.user_id, 'UPDATE_SETTINGS', 'settings', '', '', JSON.stringify(updates));

    // Re-initialize Telegram bot if token changed
    const newTokenRow    = db.prepare(`SELECT value FROM settings WHERE key='telegram_bot_token'`).get();
    const newToken       = newTokenRow ? newTokenRow.value : '';
    const newAdminChatId = db.prepare(`SELECT value FROM settings WHERE key='telegram_admin_chat_id'`).get()?.value || '';

    if (
      (updates.telegram_bot_token !== undefined || updates.telegram_admin_chat_id !== undefined) &&
      newToken !== currentToken
    ) {
      telegramBot.restartBot(newToken, newAdminChatId, db);
    }

    // Return updated settings
    const rows = db.prepare(`SELECT key, value FROM settings`).all();
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    return res.json(settings);
  } catch (err) {
    console.error('[Settings] PUT / error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
