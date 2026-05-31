'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const { db }  = require('../db/schema');
const { verifyToken }  = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleGuard');
const { generateUserId } = require('../services/idGenerator');
const { logAction }    = require('../services/auditLog');

const router = express.Router();

// All routes require authentication + admin role
router.use(verifyToken, requireAdmin);

// GET /api/users
router.get('/', (req, res) => {
  try {
    const users = db.prepare(
      `SELECT id, user_id, name, email, role, telegram_chat_id, is_active, created_at
       FROM users ORDER BY created_at DESC`
    ).all();
    return res.json(users);
  } catch (err) {
    console.error('[Users] GET / error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users — create sales account
router.post('/', (req, res) => {
  try {
    const { name, email, password, telegram_chat_id = '' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const user_id       = generateUserId(db);
    const password_hash = bcrypt.hashSync(password, 10);

    db.prepare(
      `INSERT INTO users (user_id, name, email, password_hash, role, telegram_chat_id)
       VALUES (?, ?, ?, ?, 'sales', ?)`
    ).run(user_id, name, email.toLowerCase().trim(), password_hash, telegram_chat_id);

    const user = db.prepare(
      `SELECT id, user_id, name, email, role, telegram_chat_id, is_active, created_at FROM users WHERE user_id=?`
    ).get(user_id);

    logAction(db, req.user.user_id, 'CREATE_USER', 'users', user_id, '', { name, email, role: 'sales' });

    return res.status(201).json({ user });
  } catch (err) {
    console.error('[Users] POST / error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id — update name, telegram_chat_id, is_active
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare(`SELECT * FROM users WHERE user_id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const {
      name             = existing.name,
      telegram_chat_id = existing.telegram_chat_id,
      is_active        = existing.is_active,
    } = req.body;

    db.prepare(
      `UPDATE users SET name=?, telegram_chat_id=?, is_active=? WHERE user_id=?`
    ).run(name, telegram_chat_id, is_active ? 1 : 0, req.params.id);

    const updated = db.prepare(
      `SELECT id, user_id, name, email, role, telegram_chat_id, is_active, created_at FROM users WHERE user_id=?`
    ).get(req.params.id);

    logAction(db, req.user.user_id, 'UPDATE_USER', 'users', req.params.id, existing, updated);

    return res.json({ user: updated });
  } catch (err) {
    console.error('[Users] PUT /:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id/password — reset password
router.put('/:id/password', (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password) return res.status(400).json({ error: 'new_password is required' });

    const existing = db.prepare(`SELECT * FROM users WHERE user_id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const password_hash = bcrypt.hashSync(new_password, 10);
    db.prepare(`UPDATE users SET password_hash=? WHERE user_id=?`).run(password_hash, req.params.id);

    logAction(db, req.user.user_id, 'RESET_PASSWORD', 'users', req.params.id, '', 'Password reset');

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('[Users] PUT /:id/password error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
