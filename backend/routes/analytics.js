'use strict';

const express = require('express');
const { db }  = require('../db/schema');
const { verifyToken }  = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleGuard');

const router = express.Router();

// All analytics routes require an authenticated admin
router.use(verifyToken, requireAdmin);

/** Return today's date as YYYY-MM-DD (local server time). */
function todayStr() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/** Validate a YYYY-MM-DD string; returns it or null. */
function cleanDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

// GET /api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD&group=day|week|month
router.get('/', (req, res) => {
  try {
    // ─── Resolve range (default: last 30 days) ──────────────────────────────
    const to   = cleanDate(req.query.to)   || todayStr();
    let   from = cleanDate(req.query.from);
    if (!from) {
      const d = new Date(`${to}T00:00:00`);
      d.setDate(d.getDate() - 29);
      from = d.toISOString().slice(0, 10);
    }
    // Guard against reversed range
    const lo = from <= to ? from : to;
    const hi = from <= to ? to : from;

    const group = ['day', 'week', 'month'].includes(req.query.group)
      ? req.query.group
      : 'day';
    // strftime format per bucket (values are whitelisted, safe to inline)
    const fmt = group === 'month' ? '%Y-%m'
              : group === 'week'  ? '%Y-W%W'
              : '%Y-%m-%d';

    const range = [lo, hi];

    // ─── Summary KPIs ───────────────────────────────────────────────────────
    const summaryRow = db.prepare(`
      SELECT
        COUNT(*)                                                          AS totalOrders,
        SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END)                AS approvedOrders,
        SUM(CASE WHEN status='pending'  THEN 1 ELSE 0 END)                AS pendingOrders,
        SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END)                AS rejectedOrders,
        COALESCE(SUM(CASE WHEN status='approved' THEN total_amount END),0) AS totalRevenue,
        COUNT(DISTINCT CASE WHEN status='approved' THEN customer_id END)  AS uniqueCustomers
      FROM orders
      WHERE date(created_at) BETWEEN ? AND ?
    `).get(...range);

    const itemsRow = db.prepare(`
      SELECT COALESCE(SUM(oi.qty), 0) AS totalItemsSold
      FROM order_items oi
      JOIN orders o ON o.order_id = oi.order_id
      WHERE o.status = 'approved' AND date(o.created_at) BETWEEN ? AND ?
    `).get(...range);

    const approvedOrders = summaryRow.approvedOrders || 0;
    const totalRevenue   = summaryRow.totalRevenue   || 0;

    const summary = {
      totalRevenue,
      approvedOrders,
      pendingOrders:   summaryRow.pendingOrders  || 0,
      rejectedOrders:  summaryRow.rejectedOrders || 0,
      totalOrders:     summaryRow.totalOrders    || 0,
      uniqueCustomers: summaryRow.uniqueCustomers || 0,
      totalItemsSold:  itemsRow.totalItemsSold   || 0,
      avgOrderValue:   approvedOrders > 0 ? Math.round(totalRevenue / approvedOrders) : 0,
    };

    // ─── Time series (approved revenue + order count per bucket) ────────────
    const timeSeries = db.prepare(`
      SELECT strftime('${fmt}', created_at) AS bucket,
             COALESCE(SUM(total_amount), 0) AS revenue,
             COUNT(*)                       AS orders
      FROM orders
      WHERE status = 'approved' AND date(created_at) BETWEEN ? AND ?
      GROUP BY bucket
      ORDER BY bucket
    `).all(...range);

    // ─── Top products (by qty sold, approved orders) ────────────────────────
    const topProducts = db.prepare(`
      SELECT oi.product_name        AS name,
             SUM(oi.qty)            AS qty,
             COALESCE(SUM(oi.subtotal), 0) AS revenue
      FROM order_items oi
      JOIN orders o ON o.order_id = oi.order_id
      WHERE o.status = 'approved' AND date(o.created_at) BETWEEN ? AND ?
      GROUP BY oi.product_name
      ORDER BY qty DESC
      LIMIT 10
    `).all(...range);

    // ─── Revenue by sales rep ───────────────────────────────────────────────
    const bySales = db.prepare(`
      SELECT COALESCE(u.name, o.sales_id)   AS name,
             COUNT(o.id)                    AS orders,
             COALESCE(SUM(o.total_amount),0) AS revenue
      FROM orders o
      LEFT JOIN users u ON u.user_id = o.sales_id
      WHERE o.status = 'approved' AND date(o.created_at) BETWEEN ? AND ?
      GROUP BY o.sales_id
      ORDER BY revenue DESC
    `).all(...range);

    // ─── Top customers by revenue ───────────────────────────────────────────
    const topCustomers = db.prepare(`
      SELECT COALESCE(c.name, o.customer_id) AS name,
             COUNT(o.id)                     AS orders,
             COALESCE(SUM(o.total_amount),0)  AS revenue
      FROM orders o
      LEFT JOIN customers c ON c.customer_id = o.customer_id
      WHERE o.status = 'approved' AND date(o.created_at) BETWEEN ? AND ?
      GROUP BY o.customer_id
      ORDER BY revenue DESC
      LIMIT 10
    `).all(...range);

    return res.json({
      range: { from: lo, to: hi, group },
      summary,
      timeSeries,
      topProducts,
      bySales,
      topCustomers,
    });
  } catch (err) {
    console.error('[Analytics] GET / error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
