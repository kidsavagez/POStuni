'use strict';

const express = require('express');
const { db }  = require('../db/schema');
const { verifyToken }  = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleGuard');
const { logAction }    = require('../services/auditLog');
const telegramBot      = require('../services/telegramBot');
const sheets           = require('../services/googleSheets');

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

// POST /api/settings/sheets/sync-all — back-fill every record into the Sheet.
// Works whenever a webhook URL is configured (ignores the enable toggle), so it
// can be used to seed the sheet before turning auto-sync on.
router.post('/sheets/sync-all', async (req, res) => {
  try {
    if (!sheets.isConfigured()) {
      return res.status(400).json({ error: 'Webhook URL Google Sheets belum diatur.' });
    }

    const counts = { customers: 0, products: 0, orders: 0, invoices: 0 };

    // Customers
    for (const c of db.prepare(`SELECT * FROM customers ORDER BY created_at`).all()) {
      if (await sheets.pushRow('Customers', {
        customer_id: c.customer_id, name: c.name, email: c.email,
        phone: c.phone, address: c.address, created_at: c.created_at,
      }, 'customer_id')) counts.customers++;
    }

    // Products
    for (const p of db.prepare(`SELECT * FROM products ORDER BY created_at`).all()) {
      if (await sheets.pushRow('Products', {
        product_id: p.product_id, name: p.name, price: p.price, unit: p.unit,
        stock_qty: p.stock_qty, low_stock_alert: p.low_stock_alert,
        description: p.description, created_at: p.created_at,
      }, 'product_id')) counts.products++;
    }

    // Orders (with current status / invoice)
    const orders = db.prepare(`
      SELECT o.*, c.name AS customer_name, u.name AS sales_name, inv.invoice_id
      FROM orders o
      LEFT JOIN customers c ON c.customer_id = o.customer_id
      LEFT JOIN users u     ON u.user_id     = o.sales_id
      LEFT JOIN invoices inv ON inv.order_id = o.order_id
      ORDER BY o.created_at
    `).all();
    for (const o of orders) {
      if (await sheets.pushRow('Orders', {
        order_id: o.order_id, customer: o.customer_name || o.customer_id,
        sales: o.sales_name || o.sales_id, status: o.status,
        subtotal: o.subtotal, discount_amount: o.discount_amount,
        tax_amount: o.tax_amount, total_amount: o.total_amount,
        note: o.note, created_at: o.created_at,
        approved_at: o.approved_at || '', approved_by: o.approved_by || '',
        rejection_reason: o.rejection_reason || '', invoice_id: o.invoice_id || '',
      }, 'order_id')) counts.orders++;
    }

    // Invoices
    const invoices = db.prepare(`
      SELECT inv.invoice_id, inv.order_id, inv.issued_at,
             o.total_amount, c.name AS customer
      FROM invoices inv
      LEFT JOIN orders o     ON o.order_id     = inv.order_id
      LEFT JOIN customers c  ON c.customer_id  = o.customer_id
      ORDER BY inv.issued_at
    `).all();
    for (const inv of invoices) {
      if (await sheets.pushRow('Invoices', {
        invoice_id: inv.invoice_id, order_id: inv.order_id,
        customer: inv.customer || '', total_amount: inv.total_amount,
        issued_at: inv.issued_at,
      }, 'invoice_id')) counts.invoices++;
    }

    logAction(db, req.user.user_id, 'SYNC_SHEETS_ALL', 'settings', '', '', JSON.stringify(counts));
    return res.json({ ok: true, counts });
  } catch (err) {
    console.error('[Settings] sheets/sync-all error:', err.message);
    return res.status(500).json({ error: 'Sinkronisasi gagal.' });
  }
});

module.exports = router;
