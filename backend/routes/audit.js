'use strict';

const express = require('express');
const { db }  = require('../db/schema');
const { verifyToken }  = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleGuard');

const router = express.Router();

// All routes require authentication + admin role
router.use(verifyToken, requireAdmin);

// GET /api/audit?page=1&limit=50
router.get('/', (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit = Math.max(1, parseInt(req.query.limit || '50', 10));
    const offset = (page - 1) * limit;

    const total = db.prepare(`SELECT COUNT(*) as count FROM audit_log`).get().count;

    const logs = db.prepare(
      `SELECT al.*, u.name as actor_name
       FROM audit_log al
       LEFT JOIN users u ON u.user_id = al.user_id
       ORDER BY al.timestamp DESC
       LIMIT ? OFFSET ?`
    ).all(limit, offset);

    return res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[Audit] GET / error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
