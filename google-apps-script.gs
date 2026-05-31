/**
 * TuniOrder → Google Sheets sync (Apps Script web app).
 *
 * SETUP (once):
 *   1. Create/open a Google Sheet.
 *   2. Extensions → Apps Script. Delete any sample code and paste THIS file.
 *   3. Set SECRET below to a private password.
 *   4. Deploy → New deployment → type "Web app":
 *        - Execute as: Me
 *        - Who has access: Anyone
 *      Click Deploy, authorize, and copy the "Web app URL" (ends in /exec).
 *   5. In TuniOrder: Pengaturan → Google Sheets:
 *        - paste the Web app URL into "Webhook URL"
 *        - paste the SAME secret into "Secret Token"
 *        - tick "Aktifkan sinkronisasi" and Simpan.
 *
 * The app sends one POST per created/updated record. Each `type` (Orders,
 * Customers, Products, Invoices) becomes its own tab. Rows with a key (e.g.
 * order_id) are upserted: created once, then updated in place on approve/reject.
 *
 * To change the secret later, edit SECRET here AND in the app, then redeploy
 * (Deploy → Manage deployments → edit → New version).
 */

var SECRET = 'CHANGE_ME_TO_A_PRIVATE_PASSWORD';

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // serialize concurrent writes
  } catch (err) {
    return _json({ ok: false, error: 'busy' });
  }

  try {
    var body = JSON.parse(e.postData.contents);

    if (SECRET && body.token !== SECRET) {
      return _json({ ok: false, error: 'unauthorized' });
    }

    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var type = String(body.type || 'Data');
    var row  = body.row || {};
    var key  = body.key || '';
    var incomingKeys = Object.keys(row);

    var sheet = ss.getSheetByName(type) || ss.insertSheet(type);

    // Ensure a header row exists and contains all incoming columns.
    var header;
    if (sheet.getLastRow() === 0) {
      header = incomingKeys.slice();
      sheet.appendRow(header);
    } else {
      header = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn()))
                    .getValues()[0].map(String);
      var newCols = incomingKeys.filter(function (k) { return header.indexOf(k) === -1; });
      if (newCols.length) {
        header = header.concat(newCols);
        sheet.getRange(1, 1, 1, header.length).setValues([header]);
      }
    }

    // Find an existing row to update (upsert by key), else append.
    var targetRow = 0;
    if (key && row[key] != null && sheet.getLastRow() > 1) {
      var keyCol = header.indexOf(key);
      if (keyCol >= 0) {
        var col = sheet.getRange(2, keyCol + 1, sheet.getLastRow() - 1, 1).getValues();
        for (var i = 0; i < col.length; i++) {
          if (String(col[i][0]) === String(row[key])) { targetRow = i + 2; break; }
        }
      }
    }

    if (targetRow === 0) {
      var values = header.map(function (h) { return row[h] != null ? row[h] : ''; });
      sheet.appendRow(values);
    } else {
      // Update only the columns that were sent (partial updates on approve/reject).
      incomingKeys.forEach(function (k) {
        var c = header.indexOf(k);
        if (c >= 0) sheet.getRange(targetRow, c + 1).setValue(row[k]);
      });
    }

    return _json({ ok: true });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}
