'use strict';

const express = require('express');
const { db }  = require('../db/schema');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// GET /api/invoices/:invoiceId
router.get('/:invoiceId', (req, res) => {
  try {
    const invoice = db.prepare(
      `SELECT * FROM invoices WHERE invoice_id = ?`
    ).get(req.params.invoiceId);

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Get order with details
    const order = db.prepare(
      `SELECT o.*, c.name as customer_name, c.email as customer_email,
              c.phone as customer_phone, c.address as customer_address,
              u.name as sales_name, u.email as sales_email
       FROM orders o
       LEFT JOIN customers c ON c.customer_id = o.customer_id
       LEFT JOIN users u     ON u.user_id     = o.sales_id
       WHERE o.order_id = ?`
    ).get(invoice.order_id);

    if (!order) return res.status(404).json({ error: 'Order not found for this invoice' });

    // Sales can only view their own invoices
    if (req.user.role === 'sales' && order.sales_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get order items
    const items = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).all(invoice.order_id);

    // Get company settings
    const settingsRows = db.prepare(`SELECT key, value FROM settings`).all();
    const settings = {};
    for (const row of settingsRows) {
      settings[row.key] = row.value;
    }

    // The frontend expects a dedicated `customer` object (Invoice.jsx renders
    // customer.name / .address / .phone / .email). The order query joins these
    // in as customer_* columns, so reshape them here.
    const customer = {
      name:    order.customer_name,
      email:   order.customer_email,
      phone:   order.customer_phone,
      address: order.customer_address,
    };

    return res.json({ invoice, order, customer, items, settings });
  } catch (err) {
    console.error('[Invoices] GET /:invoiceId error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
