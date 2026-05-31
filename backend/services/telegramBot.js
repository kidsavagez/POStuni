'use strict';

const TelegramBot = require('node-telegram-bot-api');
const sheets      = require('./googleSheets');

let bot = null;
let _adminChatId = null;
let _db = null;

/**
 * Initialize the Telegram bot.
 * @param {string} token
 * @param {string} adminChatId
 * @param {import('better-sqlite3').Database} db
 */
function initBot(token, adminChatId, db) {
  if (!token) {
    console.log('[Telegram] No token provided – bot disabled.');
    return;
  }

  // Stop existing bot polling if running
  if (bot) {
    try {
      bot.stopPolling();
    } catch (e) {
      // ignore
    }
    bot = null;
  }

  _adminChatId = adminChatId;
  _db = db;

  try {
    bot = new TelegramBot(token, { polling: true });
    console.log('[Telegram] Bot initialized with polling mode.');

    // Register callback query handler
    bot.on('callback_query', (callbackQuery) => {
      handleCallback(callbackQuery, _db).catch((err) => {
        console.error('[Telegram] Callback handler error:', err.message);
      });
    });

    bot.on('polling_error', (err) => {
      console.error('[Telegram] Polling error:', err.message);
    });
  } catch (err) {
    console.error('[Telegram] Failed to initialize bot:', err.message);
  }
}

/**
 * Get the current bot instance.
 * @returns {TelegramBot|null}
 */
function getBot() {
  return bot;
}

/**
 * Restart bot with a new token / adminChatId.
 * @param {string} token
 * @param {string} adminChatId
 * @param {import('better-sqlite3').Database} db
 */
function restartBot(token, adminChatId, db) {
  initBot(token, adminChatId, db);
}

/**
 * Send an order notification to the admin with approve/reject inline keyboard.
 * @param {object} order  - the order row
 * @param {object} customer - the customer row
 * @param {string} salesName - name of the sales person
 */
async function sendOrderNotification(order, customer, salesName) {
  if (!bot || !_adminChatId) return;

  const message =
    `📦 *New Order Request*\n\n` +
    `Order ID: \`${order.order_id}\`\n` +
    `Sales: ${salesName}\n` +
    `Customer: ${customer ? customer.name : order.customer_id}\n` +
    `Total: Rp ${Number(order.total_amount).toLocaleString('id-ID')}\n` +
    `Note: ${order.note || '-'}\n` +
    `Created: ${order.created_at}`;

  const opts = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Approve', callback_data: `approve_${order.order_id}` },
          { text: '❌ Reject',  callback_data: `reject_${order.order_id}`  },
        ],
      ],
    },
  };

  try {
    await bot.sendMessage(_adminChatId, message, opts);
  } catch (err) {
    console.error('[Telegram] Failed to send order notification:', err.message);
  }
}

/**
 * Handle approve/reject callback from Telegram inline keyboard.
 * @param {object} callbackQuery
 * @param {import('better-sqlite3').Database} db
 */
async function handleCallback(callbackQuery, db) {
  if (!bot) return;

  const data     = callbackQuery.data || '';
  const chatId   = callbackQuery.message.chat.id;
  const msgId    = callbackQuery.message.message_id;
  const fromUser = callbackQuery.from;

  if (data.startsWith('approve_')) {
    const orderId = data.slice('approve_'.length);
    const result  = await approveOrderFromBot(db, orderId, fromUser);
    await bot.answerCallbackQuery(callbackQuery.id, { text: result.text });
    await bot.editMessageText(
      `${callbackQuery.message.text}\n\n✅ *Approved* by ${fromUser.first_name}`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' }
    ).catch(() => {});
  } else if (data.startsWith('reject_')) {
    const orderId = data.slice('reject_'.length);
    const result  = await rejectOrderFromBot(db, orderId, fromUser);
    await bot.answerCallbackQuery(callbackQuery.id, { text: result.text });
    await bot.editMessageText(
      `${callbackQuery.message.text}\n\n❌ *Rejected* by ${fromUser.first_name}`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' }
    ).catch(() => {});
  }
}

/**
 * Approve an order directly from the Telegram callback.
 */
async function approveOrderFromBot(db, orderId, fromUser) {
  const order = db.prepare(`SELECT * FROM orders WHERE order_id = ?`).get(orderId);
  if (!order) return { text: `Order ${orderId} not found.` };
  if (order.status !== 'pending') return { text: `Order ${orderId} is already ${order.status}.` };

  const { generateInvoiceId } = require('./idGenerator');
  const { logAction }          = require('./auditLog');

  const now        = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const actorLabel = `telegram:${fromUser.id}`;

  // Update order status
  db.prepare(
    `UPDATE orders SET status='approved', approved_at=?, approved_by=? WHERE order_id=?`
  ).run(now, actorLabel, orderId);

  // Deduct stock for each item
  const items = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).all(orderId);
  for (const item of items) {
    db.prepare(
      `UPDATE products SET stock_qty = MAX(0, stock_qty - ?) WHERE product_id = ?`
    ).run(item.qty, item.product_id);
  }

  // Generate invoice
  const invoiceId = generateInvoiceId(db);
  db.prepare(
    `INSERT OR IGNORE INTO invoices (invoice_id, order_id) VALUES (?, ?)`
  ).run(invoiceId, orderId);

  logAction(db, actorLabel, 'APPROVE_ORDER', 'orders', orderId, { status: 'pending' }, { status: 'approved', invoice_id: invoiceId });

  // Sync to Google Sheets
  const approvedCustomer = db.prepare(`SELECT name FROM customers WHERE customer_id = ?`).get(order.customer_id);
  sheets.syncRow('Orders', {
    order_id: orderId, status: 'approved', approved_at: now, approved_by: actorLabel, invoice_id: invoiceId,
  }, 'order_id');
  sheets.syncRow('Invoices', {
    invoice_id: invoiceId, order_id: orderId,
    customer: approvedCustomer ? approvedCustomer.name : order.customer_id,
    total_amount: order.total_amount, issued_at: now,
  }, 'invoice_id');

  // Notify sales person
  const salesUser = db.prepare(`SELECT * FROM users WHERE user_id = ?`).get(order.sales_id);
  if (salesUser && salesUser.telegram_chat_id) {
    await notifySales(
      salesUser.telegram_chat_id,
      `✅ Your order *${orderId}* has been approved!\nInvoice: \`${invoiceId}\``
    );
  }

  return { text: `Order ${orderId} approved. Invoice: ${invoiceId}` };
}

/**
 * Reject an order directly from the Telegram callback.
 */
async function rejectOrderFromBot(db, orderId, fromUser) {
  const order = db.prepare(`SELECT * FROM orders WHERE order_id = ?`).get(orderId);
  if (!order) return { text: `Order ${orderId} not found.` };
  if (order.status !== 'pending') return { text: `Order ${orderId} is already ${order.status}.` };

  const { logAction } = require('./auditLog');

  const actorLabel = `telegram:${fromUser.id}`;
  const reason     = 'Rejected via Telegram';

  db.prepare(
    `UPDATE orders SET status='rejected', rejection_reason=? WHERE order_id=?`
  ).run(reason, orderId);

  logAction(db, actorLabel, 'REJECT_ORDER', 'orders', orderId, { status: 'pending' }, { status: 'rejected', reason });

  // Sync to Google Sheets
  sheets.syncRow('Orders', { order_id: orderId, status: 'rejected', rejection_reason: reason }, 'order_id');

  // Notify sales person
  const salesUser = db.prepare(`SELECT * FROM users WHERE user_id = ?`).get(order.sales_id);
  if (salesUser && salesUser.telegram_chat_id) {
    await notifySales(
      salesUser.telegram_chat_id,
      `❌ Your order *${orderId}* has been rejected.\nReason: ${reason}`
    );
  }

  return { text: `Order ${orderId} rejected.` };
}

/**
 * Send a message to a sales person via their Telegram chat ID.
 * @param {string|number} salesTelegramId
 * @param {string} message
 */
async function notifySales(salesTelegramId, message) {
  if (!bot || !salesTelegramId) return;
  try {
    await bot.sendMessage(String(salesTelegramId), message, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error(`[Telegram] Failed to notify sales (${salesTelegramId}):`, err.message);
  }
}

module.exports = {
  initBot,
  getBot,
  restartBot,
  sendOrderNotification,
  handleCallback,
  notifySales,
};
