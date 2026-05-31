'use strict';

const express = require('express');
const XLSX    = require('xlsx');
const { db }  = require('../db/schema');
const { verifyToken }      = require('../middleware/auth');
const { requireAdmin }     = require('../middleware/roleGuard');
const { generateCustomerId } = require('../services/idGenerator');
const { logAction }        = require('../services/auditLog');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// GET /api/customers?search=
router.get('/', (req, res) => {
  try {
    const search = req.query.search ? `%${req.query.search}%` : '%';
    const customers = db.prepare(
      `SELECT * FROM customers
       WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? OR customer_id LIKE ?
       ORDER BY created_at DESC`
    ).all(search, search, search, search);
    return res.json(customers);
  } catch (err) {
    console.error('[Customers] GET / error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/customers/export/xlsx — must be before /:id
router.get('/export/xlsx', (req, res) => {
  try {
    const customers = db.prepare(`SELECT * FROM customers ORDER BY created_at DESC`).all();
    const wsData = [
      ['Customer ID', 'Name', 'Email', 'Phone', 'Address', 'Created At'],
      ...customers.map(c => [c.customer_id, c.name, c.email, c.phone, c.address, c.created_at]),
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="customers.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (err) {
    console.error('[Customers] Export error:', err.message);
    return res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/customers/:id
router.get('/:id', (req, res) => {
  try {
    const customer = db.prepare(`SELECT * FROM customers WHERE customer_id = ?`).get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    return res.json({ customer });
  } catch (err) {
    console.error('[Customers] GET /:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/customers — admin only
router.post('/', requireAdmin, (req, res) => {
  try {
    const { name, email = '', phone = '', address = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const customer_id = generateCustomerId(db);
    db.prepare(
      `INSERT INTO customers (customer_id, name, email, phone, address)
       VALUES (?, ?, ?, ?, ?)`
    ).run(customer_id, name, email, phone, address);

    const customer = db.prepare(`SELECT * FROM customers WHERE customer_id = ?`).get(customer_id);
    logAction(db, req.user.user_id, 'CREATE_CUSTOMER', 'customers', customer_id, '', customer);

    return res.status(201).json({ customer });
  } catch (err) {
    console.error('[Customers] POST / error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/customers/:id — admin only
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    const existing = db.prepare(`SELECT * FROM customers WHERE customer_id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    db.prepare(
      `UPDATE customers
       SET name=?, email=?, phone=?, address=?, updated_at=datetime('now')
       WHERE customer_id=?`
    ).run(
      name ?? existing.name,
      email ?? existing.email,
      phone ?? existing.phone,
      address ?? existing.address,
      req.params.id
    );

    const updated = db.prepare(`SELECT * FROM customers WHERE customer_id = ?`).get(req.params.id);
    logAction(db, req.user.user_id, 'UPDATE_CUSTOMER', 'customers', req.params.id, existing, updated);

    return res.json({ customer: updated });
  } catch (err) {
    console.error('[Customers] PUT /:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/customers/:id — admin only
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const existing = db.prepare(`SELECT * FROM customers WHERE customer_id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    db.prepare(`DELETE FROM customers WHERE customer_id = ?`).run(req.params.id);
    logAction(db, req.user.user_id, 'DELETE_CUSTOMER', 'customers', req.params.id, existing, '');

    return res.json({ message: 'Customer deleted' });
  } catch (err) {
    console.error('[Customers] DELETE /:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/customers/import — admin only
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
        const customer_id = generateCustomerId(db);
        db.prepare(
          `INSERT INTO customers (customer_id, name, email, phone, address)
           VALUES (?, ?, ?, ?, ?)`
        ).run(customer_id, row.name, row.email || '', row.phone || '', row.address || '');
        results.push(customer_id);
      }
      return results;
    });

    const ids = insertMany(rows);
    logAction(db, req.user.user_id, 'IMPORT_CUSTOMERS', 'customers', '', '', `Imported ${ids.length} customers`);

    return res.json({ imported: ids.length, customer_ids: ids });
  } catch (err) {
    console.error('[Customers] Import error:', err.message);
    return res.status(500).json({ error: 'Import failed' });
  }
});

module.exports = router;
