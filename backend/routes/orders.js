'use strict';

const express    = require('express');
const { db }     = require('../db/schema');
const { verifyToken }      = require('../middleware/auth');
const { requireAdmin }     = require('../middleware/roleGuard');
const { generateOrderId, generateInvoiceId } = require('../services/idGenerator');
const { logAction }        = require('../services/auditLog');
const telegramBot          = require('../services/telegramBot');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

/**
 * Calculate order totals from items and discount/tax settings.
 */
function calcTotals(items, discountGlobal, taxRate) {
  // item subtotal = qty * unit_price * (1 - discount_pct/100)
  const itemsSubtotal = items.reduce((sum, item) => {
    const discountedPrice = item.unit_price * (1 - (item.discount_pct || 0) / 100);
    return sum + discountedPrice * item.qty;
  }, 0);

  const discountAmount = itemsSubtotal * ((discountGlobal || 0) / 100);
  const afterDiscount  = itemsSubtotal - discountAmount;
  const taxAmount      = afterDiscount * ((taxRate || 0) / 100);
  const totalAmount    = afterDiscount + taxAmount;

  return {
    subtotal:        Math.round(itemsSubtotal * 100) / 100,
    discount_amount: Math.round(discountAmount * 100) / 100,
    tax_amount:      Math.round(taxAmount * 100) / 100,
    total_amount:    Math.round(totalAmount * 100) / 100,
  };
}

// GET /api/orders?status=
router.get('/', (req, res) => {
  try {
    const { status } = req.query;
    const isAdmin    = req.user.role === 'admin';

    let sql    = `SELECT o.*, c.name as customer_name, u.name as sales_name, inv.invoice_id
                  FROM orders o
                  LEFT JOIN customers c ON c.customer_id = o.customer_id
                  LEFT JOIN users u     ON u.user_id     = o.sales_id
                  LEFT JOIN invoices inv ON inv.order_id  = o.order_id`;
    const params = [];

    const conditions = [];
    if (!isAdmin) {
      conditions.push(`o.sales_id = ?`);
      params.push(req.user.user_id);
    }
    if (status) {
      conditions.push(`o.status = ?`);
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY o.created_at DESC';

    const orders = db.prepare(sql).all(...params);
    return res.json(orders);
  } catch (err) {
    console.error('[Orders] GET / error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/orders/:id
router.get('/:id', (req, res) => {
  try {
    const order = db.prepare(
      `SELECT o.*, c.name as customer_name, u.name as sales_name
       FROM orders o
       LEFT JOIN customers c ON c.customer_id = o.customer_id
       LEFT JOIN users u     ON u.user_id     = o.sales_id
       WHERE o.order_id = ?`
    ).get(req.params.id);

    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Sales can only see their own orders
    if (req.user.role === 'sales' && order.sales_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const items = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).all(req.params.id);
    const invoice = db.prepare(`SELECT invoice_id FROM invoices WHERE order_id = ?`).get(req.params.id);
    return res.json({ ...order, invoice_id: invoice?.invoice_id || null, items });
  } catch (err) {
    console.error('[Orders] GET /:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/orders — sales only
router.post('/', (req, res) => {
  try {
    if (req.user.role !== 'sales' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      customer_id,
      items,
      discount_global = 0,
      tax_rate,
      note            = '',
    } = req.body;

    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' });
    }

    const customer = db.prepare(`SELECT * FROM customers WHERE customer_id = ?`).get(customer_id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Get default tax rate from settings if not provided
    const effectiveTaxRate = tax_rate != null
      ? Number(tax_rate)
      : Number(db.prepare(`SELECT value FROM settings WHERE key='default_tax_rate'`).get()?.value || 11);

    // Resolve and validate items
    const resolvedItems = [];
    for (const item of items) {
      const product = db.prepare(`SELECT * FROM products WHERE product_id = ?`).get(item.product_id);
      if (!product) return res.status(404).json({ error: `Product ${item.product_id} not found` });
      if (!product.is_active) return res.status(400).json({ error: `Product ${item.product_id} is inactive` });

      const qty          = Number(item.qty) || 1;
      const unit_price   = item.unit_price != null ? Number(item.unit_price) : product.price;
      const discount_pct = Number(item.discount_pct) || 0;
      const lineSubtotal = unit_price * (1 - discount_pct / 100) * qty;

      resolvedItems.push({
        product_id:   product.product_id,
        product_name: product.name,
        qty,
        unit_price,
        discount_pct,
        subtotal: Math.round(lineSubtotal * 100) / 100,
      });
    }

    const totals  = calcTotals(resolvedItems, discount_global, effectiveTaxRate);
    const orderId = generateOrderId(db);

    const createOrder = db.transaction(() => {
      db.prepare(
        `INSERT INTO orders
         (order_id, customer_id, sales_id, discount_global, tax_rate, subtotal, discount_amount, tax_amount, total_amount, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        orderId, customer_id, req.user.user_id,
        discount_global, effectiveTaxRate,
        totals.subtotal, totals.discount_amount, totals.tax_amount, totals.total_amount,
        note
      );

      for (const item of resolvedItems) {
        db.prepare(
          `INSERT INTO order_items (order_id, product_id, product_name, qty, unit_price, discount_pct, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(orderId, item.product_id, item.product_name, item.qty, item.unit_price, item.discount_pct, item.subtotal);
      }
    });

    createOrder();

    const order = db.prepare(`SELECT * FROM orders WHERE order_id = ?`).get(orderId);
    logAction(db, req.user.user_id, 'CREATE_ORDER', 'orders', orderId, '', order);

    // Send Telegram notification to admin
    const salesUser = db.prepare(`SELECT name FROM users WHERE user_id = ?`).get(req.user.user_id);
    telegramBot.sendOrderNotification(order, customer, salesUser ? salesUser.name : req.user.name)
      .catch(err => console.error('[Orders] Telegram notify error:', err.message));

    return res.status(201).json({ order, items: resolvedItems });
  } catch (err) {
    console.error('[Orders] POST / error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/orders/:id/approve — admin only
router.put('/:id/approve', requireAdmin, (req, res) => {
  try {
    const order = db.prepare(`SELECT * FROM orders WHERE order_id = ?`).get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'pending') {
      return res.status(400).json({ error: `Order is already ${order.status}` });
    }

    const now       = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const invoiceId = generateInvoiceId(db);

    const approveTransaction = db.transaction(() => {
      // Update order status
      db.prepare(
        `UPDATE orders SET status='approved', approved_at=?, approved_by=? WHERE order_id=?`
      ).run(now, req.user.user_id, req.params.id);

      // Deduct stock for each item
      const items = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).all(req.params.id);
      for (const item of items) {
        db.prepare(
          `UPDATE products SET stock_qty = MAX(0, stock_qty - ?), updated_at=datetime('now') WHERE product_id=?`
        ).run(item.qty, item.product_id);
      }

      // Generate invoice
      db.prepare(
        `INSERT INTO invoices (invoice_id, order_id) VALUES (?, ?)`
      ).run(invoiceId, req.params.id);
    });

    approveTransaction();

    logAction(
      db, req.user.user_id, 'APPROVE_ORDER', 'orders', req.params.id,
      { status: 'pending' },
      { status: 'approved', invoice_id: invoiceId }
    );

    // Notify sales via Telegram
    const salesUser = db.prepare(`SELECT * FROM users WHERE user_id = ?`).get(order.sales_id);
    if (salesUser && salesUser.telegram_chat_id) {
      telegramBot.notifySales(
        salesUser.telegram_chat_id,
        `✅ Your order *${req.params.id}* has been approved!\nInvoice: \`${invoiceId}\``
      ).catch(err => console.error('[Orders] Notify sales error:', err.message));
    }

    const updatedOrder = db.prepare(`SELECT * FROM orders WHERE order_id = ?`).get(req.params.id);
    const invoice      = db.prepare(`SELECT * FROM invoices WHERE order_id = ?`).get(req.params.id);

    return res.json({ order: updatedOrder, invoice });
  } catch (err) {
    console.error('[Orders] Approve error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/orders/:id/reject — admin only
router.put('/:id/reject', requireAdmin, (req, res) => {
  try {
    const { rejection_reason = '' } = req.body;

    const order = db.prepare(`SELECT * FROM orders WHERE order_id = ?`).get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'pending') {
      return res.status(400).json({ error: `Order is already ${order.status}` });
    }

    db.prepare(
      `UPDATE orders SET status='rejected', rejection_reason=? WHERE order_id=?`
    ).run(rejection_reason, req.params.id);

    logAction(
      db, req.user.user_id, 'REJECT_ORDER', 'orders', req.params.id,
      { status: 'pending' },
      { status: 'rejected', rejection_reason }
    );

    // Notify sales via Telegram
    const salesUser = db.prepare(`SELECT * FROM users WHERE user_id = ?`).get(order.sales_id);
    if (salesUser && salesUser.telegram_chat_id) {
      telegramBot.notifySales(
        salesUser.telegram_chat_id,
        `❌ Your order *${req.params.id}* has been rejected.\nReason: ${rejection_reason || '-'}`
      ).catch(err => console.error('[Orders] Notify sales error:', err.message));
    }

    const updatedOrder = db.prepare(`SELECT * FROM orders WHERE order_id = ?`).get(req.params.id);
    return res.json({ order: updatedOrder });
  } catch (err) {
    console.error('[Orders] Reject error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
