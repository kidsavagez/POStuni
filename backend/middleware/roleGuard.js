'use strict';

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function requireSales(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.user.role !== 'sales') {
    return res.status(403).json({ error: 'Sales access required' });
  }
  next();
}

function requireAny(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.user.role !== 'admin' && req.user.role !== 'sales') {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}

module.exports = { requireAdmin, requireSales, requireAny };
