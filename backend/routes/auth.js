'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { db }  = require('../db/schema');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is disabled. Contact administrator.' });
    }

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const payload = {
      id:               user.id,
      user_id:          user.user_id,
      name:             user.name,
      email:            user.email,
      role:             user.role,
      telegram_chat_id: user.telegram_chat_id,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

    return res.json({ token, user: payload });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, (req, res) => {
  try {
    const user = db.prepare(
      `SELECT id, user_id, name, email, role, telegram_chat_id, is_active, created_at
       FROM users WHERE user_id = ?`
    ).get(req.user.user_id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (err) {
    console.error('[Auth] Me error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
