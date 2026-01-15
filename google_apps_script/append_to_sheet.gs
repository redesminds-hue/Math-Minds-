// Google Apps Script: Append incoming JSON POST to a Google Sheet
// Deploy as Web App (Execute the app as: Me; Who has access: Anyone, even anonymous)
// Then paste the deployment URL into SHEET_WEBHOOK_URL in pago.html

/*
  doPost dispatcher: handles three kinds of POSTs
  1) client form submissions (original behavior) -> append to 'Registros'
  2) action=create_wompi_txn -> create transaction at Wompi and return checkout URL
  3) Wompi webhook -> record payment event in 'Pagos' sheet and optionally update 'Registros'

  Configuration:
  - Set SPREADSHEET_ID at the top of the file
  - In Apps Script: set script properties 'WOMPI_PRIVATE_KEY' and 'WOMPI_SANDBOX' (true/false)
*/

function doPost(e) {
  try {
    var rawBody = (e.postData && e.postData.contents) ? e.postData.contents : null;
    var data = {};
    try { data = rawBody ? JSON.parse(rawBody) : (e.parameter || {}); } catch(err){ data = e.parameter || {}; }

    // Route by query param action
    if (e.parameter && e.parameter.action === 'get_payment_status') {
      return getPaymentStatus(data);
    }
    if (e.parameter && e.parameter.action === 'create_wompi_txn') {
      return createWompiTransaction(data);
    }

    // Detect Wompi webhook payloads (they contain 'event' and/or data.object.transaction)
    if (data && (data.event || (data.data && data.data.object && data.data.object.transaction) || data.type)) {
      handleWompiWebhook(data);
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Fallback: treat as form submission and append to 'Registros' (original behaviour)
    return appendSubmissionToSheet(data);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle CORS preflight requests
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// --- Configuration: set your spreadsheet ID here ---
var SPREADSHEET_ID = '1FXfFhhNzeLwNkAd-W1Q2WZ-ZAF4199WC_ES1yR2CJso';

function appendSubmissionToSheet(data) {
  var SHEET_NAME = 'Registros';
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  // Ensure header
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['timestamp','acudiente','documento','email','colegio','curso','ciudad','direccion','telefono','carrito','reference']);
  }

  var ts = new Date();
  var row = [
    ts,
    data.acudiente || '',
    data.documento || '',
    data.email || '',
    data.colegio || '',
    data.curso || '',
    data.ciudad || '',
    data.direccion || '',
    data.telefono || '',
    JSON.stringify(data.carrito || []),
    data.reference || ''
  ];
  sheet.appendRow(row);

  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Create transaction at Wompi
function createWompiTransaction(body) {
  var props = PropertiesService.getScriptProperties();
  var privateKey = props.getProperty('WOMPI_PRIVATE_KEY') || '';
  var sandbox = (props.getProperty('WOMPI_SANDBOX') || 'true') === 'true';
  var url = sandbox ? 'https://sandbox.wompi.co/v1/transactions' : 'https://production.wompi.co/v1/transactions';

  if (!privateKey) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'WOMPI_PRIVATE_KEY not set in Script Properties' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var amount = Number(body.amount) || 0; // amount in cents
  var payload = {
    amount_in_cents: amount,
    currency: body.currency || 'COP',
    customer_email: body.customer_email || '',
    reference: body.reference || ('MM-' + new Date().getTime()),
    redirect_url: body.redirect_url || '',
    payment_method: body.payment_method || 'CARD',
    customer_data: body.customer_data || {},
    metadata: body.metadata || {}
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: { 'Authorization': 'Bearer ' + privateKey },
    muteHttpExceptions: true
  };

  var res = UrlFetchApp.fetch(url, options);
  var code = res.getResponseCode();
  var resText = res.getContentText();
  var parsed = {};
  try { parsed = JSON.parse(resText); } catch(e) { parsed = { raw: resText }; }

  // Return Wompi response to client
  return ContentService.createTextOutput(JSON.stringify({ status: (code >= 200 && code < 300) ? 'ok' : 'error', code: code, data: parsed }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Handle Wompi webhooks: log to 'Pagos', update 'Registros' and send receipt email when approved
function handleWompiWebhook(payload) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Pagos') || ss.insertSheet('Pagos');

  // Ensure headers (add receipt_sent column)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['timestamp','event','transaction_id','reference','amount_in_cents','currency','status','buyer_email','raw','receipt_sent']);
  } else {
    var head = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    if (head.indexOf('receipt_sent') === -1) {
      sheet.getRange(1, head.length + 1).setValue('receipt_sent');
    }
  }

  var event = payload.event || payload.type || '';
  var txn = null;
  if (payload.data && payload.data.object && payload.data.object.transaction) txn = payload.data.object.transaction;
  else if (payload.transaction) txn = payload.transaction;
  else txn = payload;

  // If transaction id present, verify latest state directly from Wompi
  if (txn && txn.id) {
    try {
      var verified = verifyTransaction(txn.id);
      if (verified && verified.data && verified.data.object && verified.data.object.transaction) {
        txn = verified.data.object.transaction;
      }
    } catch(e) { Logger.log('verifyTransaction error: ' + e); }
  }

  var ts = new Date();
  var row = [
    ts,
    event,
    (txn && txn.id) || '',
    (txn && (txn.reference || (txn.metadata && txn.metadata.reference))) || '',
    (txn && (txn.amount_in_cents || '')) || '',
    (txn && txn.currency) || '',
    (txn && txn.status) || '',
    (txn && txn.customer_email) || '',
    JSON.stringify(payload),
    '' // receipt_sent placeholder
  ];
  sheet.appendRow(row);
  var appendedRow = sheet.getLastRow();

  // Try to update Registros sheet by matching reference and set payment_status
  var registros = ss.getSheetByName('Registros');
  var ref = (txn && (txn.reference || (txn.metadata && txn.metadata.reference))) || '';
  if (registros && ref) {
    var values = registros.getDataRange().getValues();
    var header = values[0] || [];
    var refCol = header.indexOf('reference');
    var statusCol = header.indexOf('payment_status');
    if (refCol === -1) {
      registros.getRange(1, header.length + 1).setValue('payment_status');
      statusCol = header.length;
      values = registros.getDataRange().getValues();
    }
    for (var i=1;i<values.length;i++){
      if (String(values[i][refCol] || '') === String(ref)) {
        registros.getRange(i+1, statusCol+1).setValue((txn && txn.status) || '');
      }
    }
  }

  // Send receipt if payment approved and not already sent
  var status = (txn && txn.status) ? String(txn.status).toUpperCase() : '';
  var approvedStatuses = ['APPROVED','PAID','AUTHORIZED'];
  if (approvedStatuses.indexOf(status) !== -1) {
    // find receipt_sent column and check
    var headerAll = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    var receiptCol = headerAll.indexOf('receipt_sent');
    var already = false;
    if (receiptCol !== -1) {
      var val = sheet.getRange(appendedRow, receiptCol+1).getValue();
      already = !!val;
    }
    if (!already) {
      var sent = sendReceiptEmail(txn);
      if (sent && receiptCol !== -1) {
        sheet.getRange(appendedRow, receiptCol+1).setValue(new Date());
      }
    }
  }
}

// Verify transaction with Wompi API (returns parsed JSON)
function verifyTransaction(transactionId) {
  var props = PropertiesService.getScriptProperties();
  var privateKey = props.getProperty('WOMPI_PRIVATE_KEY') || '';
  var sandbox = (props.getProperty('WOMPI_SANDBOX') || 'true') === 'true';
  var url = (sandbox ? 'https://sandbox.wompi.co/v1/transactions/' : 'https://production.wompi.co/v1/transactions/') + transactionId;
  var options = { method: 'get', headers: { 'Authorization': 'Bearer ' + privateKey }, muteHttpExceptions: true };
  var res = UrlFetchApp.fetch(url, options);
  var txt = res.getContentText();
  try { return JSON.parse(txt); } catch(e) { return { raw: txt }; }
}

// Generate a simple HTML receipt and convert to PDF (returns blob)
function generateReceiptPdf(htmlContent, filename) {
  try {
    var blob = Utilities.newBlob(htmlContent, 'text/html', filename + '.html');
    var file = DriveApp.createFile(blob);
    var pdfBlob = file.getAs('application/pdf');
    file.setTrashed(true);
    pdfBlob.setName(filename + '.pdf');
    return pdfBlob;
  } catch(e) { Logger.log('generateReceiptPdf error: ' + e); return null; }
}

// Send receipt email to the buyer (uses MailApp) with PDF attachment
function sendReceiptEmail(txn) {
  try {
    var ref = txn.reference || (txn.metadata && txn.metadata.reference) || '';
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var registros = ss.getSheetByName('Registros');
    var carrito = [];
    var acudiente = '';
    var direccion = '';
    var parentEmail = (txn && txn.customer_email) || '';

    if (registros && ref) {
      var vals = registros.getDataRange().getValues();
      var header = vals[0] || [];
      var refCol = header.indexOf('reference');
      var carritoCol = header.indexOf('carrito');
      var emailCol = header.indexOf('email');
      var acudienteCol = header.indexOf('acudiente');
      var direccionCol = header.indexOf('direccion');
      for (var i=1;i<vals.length;i++){
        if (String(vals[i][refCol]||'') === String(ref)){
          try{ carrito = JSON.parse(vals[i][carritoCol]||'[]'); }catch(e){ carrito = []; }
          acudiente = vals[i][acudienteCol] || '';
          direccion = vals[i][direccionCol] || '';
          if (!parentEmail) parentEmail = vals[i][emailCol] || parentEmail;
          break;
        }
      }
    }

    if (!parentEmail) return false;

    var total = ((txn.amount_in_cents || txn.amount_in_cents) ? (Number(txn.amount_in_cents || 0)/100).toFixed(2) : '');

    var itemsHtml = '';
    if (carrito && carrito.length) {
      itemsHtml += '<ul>';
      carrito.forEach(function(i){ itemsHtml += '<li>' + (i.title||i.nombre||'') + ' x' + (i.qty||1) + ' - $' + (Number(i.price||i.precio||0)).toLocaleString() + '</li>'; });
      itemsHtml += '</ul>';
    } else { itemsHtml = '<p>No hay items registrados.</p>'; }

    var html = '<div style="font-family: Arial, sans-serif; color: #222">'
      + '<h2 style="color:#111;">Recibo de compra - Math Minds</h2>'
      + '<p><strong>Referencia:</strong> ' + (txn.reference || '') + '</p>'
      + '<p><strong>Estado:</strong> ' + (txn.status || '') + '</p>'
      + '<p><strong>Acudiente:</strong> ' + (acudiente || '') + '</p>'
      + '<p><strong>Dirección:</strong> ' + (direccion || '') + '</p>'
      + '<p><strong>Monto:</strong> $' + total + ' ' + (txn.currency || '') + '</p>'
      + '<h4>Items:</h4>' + itemsHtml
      + '<p>Gracias por tu compra.</p>'
      + '</div>';

    // Try to generate PDF attachment
    var pdf = generateReceiptPdf(html, 'Recibo_' + (txn.reference || new Date().getTime()));

    var mailOptions = { to: parentEmail, subject: 'Recibo de compra Math Minds - ' + (txn.reference||''), htmlBody: html };
    if (pdf) mailOptions.attachments = [pdf];

    MailApp.sendEmail(mailOptions);

    // mark Pagos sheet as receipt sent
    var pagos = ss.getSheetByName('Pagos');
    if (pagos) {
      var rows = pagos.getDataRange().getValues();
      var header = rows[0] || [];
      var txnCol = header.indexOf('transaction_id');
      var refCol = header.indexOf('reference');
      var receiptCol = header.indexOf('receipt_sent');
      if (receiptCol === -1) {
        pagos.getRange(1, header.length + 1).setValue('receipt_sent');
        receiptCol = header.length;
        rows = pagos.getDataRange().getValues();
      }
      for (var r=1;r<rows.length;r++){
        if ((txn.id && String(rows[r][txnCol]) === String(txn.id)) || (ref && String(rows[r][refCol]) === String(ref))) {
          pagos.getRange(r+1, receiptCol+1).setValue(new Date());
        }
      }
    }

    return true;
  } catch(e) { Logger.log('sendReceiptEmail error: ' + e); return false; }
}

// Get payment status by reference or transaction id (searches 'Pagos' sheet)
function getPaymentStatus(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Pagos');
  if (!sheet) return ContentService.createTextOutput(JSON.stringify({ status: 'not_found' })).setMimeType(ContentService.MimeType.JSON);
  var values = sheet.getDataRange().getValues();
  var header = values[0] || [];
  var rows = [];
  var refCol = header.indexOf('reference');
  var txnCol = header.indexOf('transaction_id');
  for (var i=1;i<values.length;i++){
    var row = values[i];
    var rowRef = (refCol !== -1) ? row[refCol] : '';
    var rowTxn = (txnCol !== -1) ? row[txnCol] : '';
    if ((data.reference && String(data.reference) === String(rowRef)) || (data.transaction_id && String(data.transaction_id) === String(rowTxn))) {
      rows.push({ index: i+1, values: row });
    }
  }
  if (!rows.length) return ContentService.createTextOutput(JSON.stringify({ status: 'not_found' }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', results: rows }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Helper: set script properties (run from the Apps Script editor once to store your private key)
function setScriptProperties(privateKey, sandbox) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('WOMPI_PRIVATE_KEY', privateKey);
  props.setProperty('WOMPI_SANDBOX', sandbox ? 'true' : 'false');
  return { status: 'ok' };
}

// Helper: read current script properties (useful for debugging)
function getScriptProperties() {
  return PropertiesService.getScriptProperties().getProperties();
}
