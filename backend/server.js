'use strict';

require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const path        = require('path');

// Initialize DB first (creates tables + seeds)
const { db } = require('./db/schema');

// Initialize Telegram Bot from DB settings
const telegramBot = require('./services/telegramBot');

function initTelegramFromDB() {
  try {
    const tokenRow   = db.prepare(`SELECT value FROM settings WHERE key='telegram_bot_token'`).get();
    const adminRow   = db.prepare(`SELECT value FROM settings WHERE key='telegram_admin_chat_id'`).get();
    const token      = tokenRow ? tokenRow.value : '';
    const adminChatId = adminRow ? adminRow.value : '';
    telegramBot.initBot(token, adminChatId, db);
  } catch (err) {
    console.error('[Server] Failed to initialize Telegram bot:', err.message);
  }
}

initTelegramFromDB();

// Routes
const authRoutes      = require('./routes/auth');
const customerRoutes  = require('./routes/customers');
const productRoutes   = require('./routes/products');
const orderRoutes     = require('./routes/orders');
const invoiceRoutes   = require('./routes/invoices');
const userRoutes      = require('./routes/users');
const settingsRoutes  = require('./routes/settings');
const auditRoutes     = require('./routes/audit');
const analyticsRoutes = require('./routes/analytics');

const app  = express();
const PORT = process.env.PORT || 4009;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  // In production, lock to FRONTEND_URL. In dev, accept any localhost origin
  // so a shifted Vite port (e.g. 5174 when 5173 is taken) still works.
  origin: process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL
    : (origin, cb) => cb(null, !origin || /^http:\/\/localhost:\d+$/.test(origin)),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  return res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    uptime:    process.uptime(),
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products',  productRoutes);
app.use('/api/orders',    orderRoutes);
app.use('/api/invoices',  invoiceRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/settings',  settingsRoutes);
app.use('/api/audit',     auditRoutes);
app.use('/api/analytics', analyticsRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║       Sales Order & Invoice Management System        ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Server running on  http://localhost:${PORT}            ║`);
  console.log(`║  Health check:      http://localhost:${PORT}/api/health ║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  Default Admin Credentials:                          ║');
  console.log('║    Email:    admin@tuni.com                          ║');
  console.log('║    Password: Admin@123                               ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
