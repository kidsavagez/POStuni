'use strict';

/**
 * Get a setting value from the DB.
 * @param {import('better-sqlite3').Database} db
 * @param {string} key
 * @returns {string}
 */
function getSetting(db, key) {
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key);
  return row ? row.value : '';
}

/**
 * Atomically increment a sequence and return the new value.
 * @param {import('better-sqlite3').Database} db
 * @param {string} seqName
 * @returns {number}
 */
function nextSeq(db, seqName) {
  db.prepare(`UPDATE sequences SET current_val = current_val + 1 WHERE name = ?`).run(seqName);
  const row = db.prepare(`SELECT current_val FROM sequences WHERE name = ?`).get(seqName);
  return row.current_val;
}

/**
 * Get today's date as YYYYMMDD string.
 * @returns {string}
 */
function todayDate() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * Generate the next Customer ID (e.g. CUST-0001)
 * @param {import('better-sqlite3').Database} db
 * @returns {string}
 */
function generateCustomerId(db) {
  const prefix  = getSetting(db, 'customer_id_prefix') || 'CUST';
  const padding = parseInt(getSetting(db, 'customer_id_padding') || '4', 10);
  const seq     = nextSeq(db, 'customer_seq');
  return `${prefix}-${String(seq).padStart(padding, '0')}`;
}

/**
 * Generate the next Product ID (e.g. PRD-0001)
 * @param {import('better-sqlite3').Database} db
 * @returns {string}
 */
function generateProductId(db) {
  const prefix  = getSetting(db, 'product_id_prefix') || 'PRD';
  const padding = parseInt(getSetting(db, 'product_id_padding') || '4', 10);
  const seq     = nextSeq(db, 'product_seq');
  return `${prefix}-${String(seq).padStart(padding, '0')}`;
}

/**
 * Generate the next User ID (e.g. USR-0002)
 * @param {import('better-sqlite3').Database} db
 * @returns {string}
 */
function generateUserId(db) {
  const prefix  = getSetting(db, 'user_id_prefix') || 'USR';
  const padding = parseInt(getSetting(db, 'user_id_padding') || '4', 10);
  const seq     = nextSeq(db, 'user_seq');
  return `${prefix}-${String(seq).padStart(padding, '0')}`;
}

/**
 * Generate the next Order ID using format template (e.g. ORD-20240101-001)
 * @param {import('better-sqlite3').Database} db
 * @returns {string}
 */
function generateOrderId(db) {
  const format  = getSetting(db, 'order_id_format') || 'ORD-{DATE}-{SEQ}';
  const padding = parseInt(getSetting(db, 'order_seq_padding') || '3', 10);
  const seq     = nextSeq(db, 'order_seq');
  const date    = todayDate();
  return format
    .replace('{DATE}', date)
    .replace('{SEQ}',  String(seq).padStart(padding, '0'));
}

/**
 * Generate the next Invoice ID using format template (e.g. INV-20240101-001)
 * @param {import('better-sqlite3').Database} db
 * @returns {string}
 */
function generateInvoiceId(db) {
  const format  = getSetting(db, 'invoice_id_format') || 'INV-{DATE}-{SEQ}';
  const padding = parseInt(getSetting(db, 'invoice_seq_padding') || '3', 10);
  const seq     = nextSeq(db, 'invoice_seq');
  const date    = todayDate();
  return format
    .replace('{DATE}', date)
    .replace('{SEQ}',  String(seq).padStart(padding, '0'));
}

module.exports = {
  generateCustomerId,
  generateProductId,
  generateUserId,
  generateOrderId,
  generateInvoiceId,
};
