'use strict';

const express = require('express');
const XLSX    = require('xlsx');
const { db }  = require('../db/schema');
const { verifyToken }     = require('../middleware/auth');
const { requireAdmin }    = require('../middleware/roleGuard');
const { generateProductId } = require('../services/idGenerator');
const { logAction }       = require('../services/auditLog');
const sheets              = require('../services/googleSheets');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// GET /api/products?search=
router.get('/', (req, res) => {
  try {
    const search    = req.query.search ? `%${req.query.search}%` : '%';
    const isAdmin   = req.user.role === 'admin';
    const activeSQL = isAdmin ? '' : 'AND is_active = 1';

    const products = db.prepare(
      `SELECT * FROM products
       WHERE (name LIKE ? OR product_id LIKE ?) ${activeSQL}
       ORDER BY created_at DESC`
    ).all(search, search);

    return res.json(products);
  } catch (err) {
    console.error('[Products] GET / error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/products/export/xlsx — must be before /:id
router.get('/export/xlsx', (req, res) => {
  try {
    const products = db.prepare(`SELECT * FROM products ORDER BY created_at DESC`).all();
    const wsData = [
      ['Product ID', 'Name', 'Price', 'Unit', 'Stock', 'Low Stock Alert', 'Description', 'Active'],
      ...products.map(p => [
        p.product_id, p.name, p.price, p.unit,
        p.stock_qty, p.low_stock_alert, p.description, p.is_active ? 'Yes' : 'No'
      ]),
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="products.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (err) {
    console.error('[Products] Export error:', err.message);
    return res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  try {
    const product = db.prepare(`SELECT * FROM products WHERE product_id = ?`).get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    return res.json({ product });
  } catch (err) {
    console.error('[Products] GET /:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/products — admin only
router.post('/', requireAdmin, (req, res) => {
  try {
    const {
      name,
      price        = 0,
      unit         = 'pcs',
      stock_qty    = 0,
      low_stock_alert = 10,
      description  = '',
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });

    const product_id = generateProductId(db);
    db.prepare(
      `INSERT INTO products (product_id, name, price, unit, stock_qty, low_stock_alert, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(product_id, name, price, unit, stock_qty, low_stock_alert, description);

    const product = db.prepare(`SELECT * FROM products WHERE product_id = ?`).get(product_id);
    logAction(db, req.user.user_id, 'CREATE_PRODUCT', 'products', product_id, '', product);

    sheets.syncRow('Products', {
      product_id:      product.product_id,
      name:            product.name,
      price:           product.price,
      unit:            product.unit,
      stock_qty:       product.stock_qty,
      low_stock_alert: product.low_stock_alert,
      description:     product.description,
      created_at:      product.created_at,
    }, 'product_id');

    return res.status(201).json({ product });
  } catch (err) {
    console.error('[Products] POST / error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/products/:id — admin only
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const existing = db.prepare(`SELECT * FROM products WHERE product_id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const {
      name            = existing.name,
      price           = existing.price,
      unit            = existing.unit,
      stock_qty       = existing.stock_qty,
      low_stock_alert = existing.low_stock_alert,
      description     = existing.description,
      is_active       = existing.is_active,
    } = req.body;

    db.prepare(
      `UPDATE products
       SET name=?, price=?, unit=?, stock_qty=?, low_stock_alert=?, description=?, is_active=?, updated_at=datetime('now')
       WHERE product_id=?`
    ).run(name, price, unit, stock_qty, low_stock_alert, description, is_active, req.params.id);

    const updated = db.prepare(`SELECT * FROM products WHERE product_id = ?`).get(req.params.id);
    logAction(db, req.user.user_id, 'UPDATE_PRODUCT', 'products', req.params.id, existing, updated);

    return res.json({ product: updated });
  } catch (err) {
    console.error('[Products] PUT /:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/products/:id/restock — admin only
router.put('/:id/restock', requireAdmin, (req, res) => {
  try {
    const { qty_add } = req.body;
    if (qty_add == null || isNaN(qty_add) || Number(qty_add) < 1) {
      return res.status(400).json({ error: 'qty_add must be a positive number' });
    }

    const existing = db.prepare(`SELECT * FROM products WHERE product_id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    db.prepare(
      `UPDATE products SET stock_qty = stock_qty + ?, updated_at=datetime('now') WHERE product_id=?`
    ).run(Number(qty_add), req.params.id);

    const updated = db.prepare(`SELECT * FROM products WHERE product_id = ?`).get(req.params.id);
    logAction(
      db, req.user.user_id, 'RESTOCK_PRODUCT', 'products', req.params.id,
      { stock_qty: existing.stock_qty },
      { stock_qty: updated.stock_qty, added: qty_add }
    );

    return res.json({ product: updated });
  } catch (err) {
    console.error('[Products] Restock error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/products/:id — admin only (soft delete)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const existing = db.prepare(`SELECT * FROM products WHERE product_id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    db.prepare(`UPDATE products SET is_active=0, updated_at=datetime('now') WHERE product_id=?`).run(req.params.id);
    logAction(db, req.user.user_id, 'DEACTIVATE_PRODUCT', 'products', req.params.id, { is_active: 1 }, { is_active: 0 });

    return res.json({ message: 'Product deactivated' });
  } catch (err) {
    console.error('[Products] DELETE /:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/products/import — admin only
router.post('/import', requireAdmin, (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'rows must be a non-empty array' });
    }

    const insertMany = db.transaction((records) => {
      const results = [];
      for (const row of records) {
        if (!row.name) continue;
        const product_id = generateProductId(db);
        db.prepare(
          `INSERT INTO products (product_id, name, price, unit, stock_qty, low_stock_alert, description)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          product_id,
          row.name,
          Number(row.price) || 0,
          row.unit || 'pcs',
          Number(row.stock_qty) || 0,
          Number(row.low_stock_alert) || 10,
          row.description || ''
        );
        results.push(product_id);
      }
      return results;
    });

    const ids = insertMany(rows);
    logAction(db, req.user.user_id, 'IMPORT_PRODUCTS', 'products', '', '', `Imported ${ids.length} products`);

    return res.json({ imported: ids.length, product_ids: ids });
  } catch (err) {
    console.error('[Products] Import error:', err.message);
    return res.status(500).json({ error: 'Import failed' });
  }
});

module.exports = router;
