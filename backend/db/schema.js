'use strict';

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'tuni.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Create Tables ───────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          TEXT    UNIQUE NOT NULL,
    name             TEXT    NOT NULL,
    email            TEXT    UNIQUE NOT NULL,
    password_hash    TEXT    NOT NULL,
    role             TEXT    NOT NULL CHECK(role IN ('admin','sales')),
    telegram_chat_id TEXT    DEFAULT '',
    is_active        INTEGER DEFAULT 1,
    created_at       TEXT    DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT    UNIQUE NOT NULL,
    name        TEXT    NOT NULL,
    email       TEXT    DEFAULT '',
    phone       TEXT    DEFAULT '',
    address     TEXT    DEFAULT '',
    created_at  TEXT    DEFAULT (datetime('now')),
    updated_at  TEXT    DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id       TEXT    UNIQUE NOT NULL,
    name             TEXT    NOT NULL,
    price            REAL    NOT NULL DEFAULT 0,
    unit             TEXT    DEFAULT 'pcs',
    stock_qty        INTEGER DEFAULT 0,
    low_stock_alert  INTEGER DEFAULT 10,
    description      TEXT    DEFAULT '',
    is_active        INTEGER DEFAULT 1,
    created_at       TEXT    DEFAULT (datetime('now')),
    updated_at       TEXT    DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id         TEXT    UNIQUE NOT NULL,
    customer_id      TEXT    NOT NULL,
    sales_id         TEXT    NOT NULL,
    status           TEXT    DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    discount_global  REAL    DEFAULT 0,
    tax_rate         REAL    DEFAULT 11,
    subtotal         REAL    DEFAULT 0,
    discount_amount  REAL    DEFAULT 0,
    tax_amount       REAL    DEFAULT 0,
    total_amount     REAL    DEFAULT 0,
    note             TEXT    DEFAULT '',
    rejection_reason TEXT    DEFAULT '',
    created_at       TEXT    DEFAULT (datetime('now')),
    approved_at      TEXT    DEFAULT '',
    approved_by      TEXT    DEFAULT ''
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS order_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id     TEXT    NOT NULL,
    product_id   TEXT    NOT NULL,
    product_name TEXT    NOT NULL,
    qty          INTEGER NOT NULL,
    unit_price   REAL    NOT NULL,
    discount_pct REAL    DEFAULT 0,
    subtotal     REAL    NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS invoices (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id TEXT    UNIQUE NOT NULL,
    order_id   TEXT    UNIQUE NOT NULL,
    issued_at  TEXT    DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT    NOT NULL,
    action     TEXT    NOT NULL,
    table_name TEXT    DEFAULT '',
    record_id  TEXT    DEFAULT '',
    old_value  TEXT    DEFAULT '',
    new_value  TEXT    DEFAULT '',
    timestamp  TEXT    DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sequences (
    name        TEXT    PRIMARY KEY,
    current_val INTEGER DEFAULT 0
  );
`);

// ─── Seed Default Settings ────────────────────────────────────────────────────

const defaultSettings = [
  ['company_name',         'PT. Nama Perusahaan Anda'],
  ['company_address',      'Jl. Alamat Perusahaan No. 1, Kota, Provinsi'],
  ['company_phone',        '+62 812-3456-7890'],
  ['company_email',        'email@perusahaan.com'],
  ['company_logo_url',     ''],
  ['bank_name',            'Bank BCA'],
  ['bank_account',         '1234567890'],
  ['bank_holder',          'PT. Nama Perusahaan Anda'],
  ['default_tax_rate',     '11'],
  ['customer_id_prefix',   'CUST'],
  ['customer_id_padding',  '4'],
  ['product_id_prefix',    'PRD'],
  ['product_id_padding',   '4'],
  ['user_id_prefix',       'USR'],
  ['user_id_padding',      '4'],
  ['order_id_format',      'ORD-{DATE}-{SEQ}'],
  ['order_seq_padding',    '3'],
  ['invoice_id_format',    'INV-{DATE}-{SEQ}'],
  ['invoice_seq_padding',  '3'],
  ['telegram_bot_token',   ''],
  ['telegram_admin_chat_id', ''],
];

const insertSetting = db.prepare(
  `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`
);

const seedSettingsTransaction = db.transaction(() => {
  for (const [key, value] of defaultSettings) {
    insertSetting.run(key, value);
  }
});

seedSettingsTransaction();

// ─── Seed Default Admin User ──────────────────────────────────────────────────

const adminExists = db.prepare(`SELECT id FROM users WHERE email = ?`).get('admin@tuni.com');
if (!adminExists) {
  const passwordHash = bcrypt.hashSync('Admin@123', 10);
  db.prepare(
    `INSERT INTO users (user_id, name, email, password_hash, role)
     VALUES ('USR-0001', 'Administrator', 'admin@tuni.com', ?, 'admin')`
  ).run(passwordHash);
}

// ─── Seed Sequences ───────────────────────────────────────────────────────────

const insertSeq = db.prepare(`INSERT OR IGNORE INTO sequences (name, current_val) VALUES (?, ?)`);

const seedSequences = db.transaction(() => {
  insertSeq.run('customer_seq', 0);
  insertSeq.run('product_seq', 0);
  insertSeq.run('user_seq', 1); // admin already created
  insertSeq.run('order_seq', 0);
  insertSeq.run('invoice_seq', 0);
});

seedSequences();

console.log('[DB] Database initialized at:', DB_PATH);

module.exports = { db };
