'use strict';

/**
 * Log an auditable action to the audit_log table.
 * @param {import('better-sqlite3').Database} db
 * @param {string} userId
 * @param {string} action
 * @param {string} tableName
 * @param {string} recordId
 * @param {any} oldValue
 * @param {any} newValue
 */
function logAction(db, userId, action, tableName = '', recordId = '', oldValue = '', newValue = '') {
  try {
    const oldStr = typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue);
    const newStr = typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue);

    db.prepare(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, old_value, new_value)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(userId, action, tableName, recordId, oldStr, newStr);
  } catch (err) {
    console.error('[AuditLog] Failed to log action:', err.message);
  }
}

module.exports = { logAction };
