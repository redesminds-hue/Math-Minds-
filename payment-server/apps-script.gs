/**
 * Google Apps Script
 * Recibe POSTs (Node / Pasarela), registra o actualiza pagos en Google Sheets
 * Deploy as Web App → Anyone, even anonymous
 * Guardar en Script Properties:
 *   SPREADSHEET_ID = TU_ID_REAL_DEL_SHEET
 */

/* -------------------- UTILIDADES -------------------- */

function ensureHeaders(sheet) {
  const headers = [
    'reference',
    'status',
    'amount_in_cents',
    'student_first',
    'student_last',
    'parent_name',
    'parent_email',
    'colegio',
    'curso',
    'ciudad',
    'direccion',
    'telefono',
    'carrito_json',
    'recorded_at',
    'paid',
    'updated_at'
  ];

  const lastCol = sheet.getLastColumn();
  const firstRow = lastCol
    ? sheet.getRange(1, 1, 1, headers.length).getValues()[0]
    : [];

  let reset = false;
  for (let i = 0; i < headers.length; i++) {
    if (String(firstRow[i] || '').toLowerCase() !== headers[i].toLowerCase()) {
      reset = true;
      break;
    }
  }

  if (reset) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return headers;
}

function findRowByReference(sheet, reference) {
  if (!reference) return -1;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(reference)) {
      return i + 2; // filas empiezan en 1
    }
  }
  return -1;
}

/* -------------------- ENDPOINT PRINCIPAL -------------------- */

function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: 'Empty POST body' });
    }

    const content = JSON.parse(e.postData.contents);
    if (!content || Object.keys(content).length === 0) {
      return jsonResponse({ ok: false, error: 'Empty payload' });
    }

    const payload =
      content.payload && typeof content.payload === 'object'
        ? content.payload
        : content;

    const SPREADSHEET_ID = PropertiesService
      .getScriptProperties()
      .getProperty('SPREADSHEET_ID');

    if (!SPREADSHEET_ID) {
      return jsonResponse({ ok: false, error: 'Missing SPREADSHEET_ID property' });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Registrations') || ss.insertSheet('Registrations');
    ensureHeaders(sheet);

    const now = new Date().toISOString();

    const reference =
      payload.reference ||
      payload.id ||
      'REG-' + Date.now();

    const status = payload.status || 'pending';
    const amount = payload.amount_in_cents || payload.amount || '';

    const student = payload.student || payload.studentInfo || {};
    const parent = payload.parent || payload;

    const row = [
      reference,
      status,
      amount,
      student.first || student.nombre || '',
      student.last || student.apellido || '',
      parent.parent_name || parent.acudiente || parent.name || '',
      parent.parent_email || parent.email || payload.email || '',
      payload.colegio || parent.colegio || '',
      payload.curso || payload.grade || parent.curso || '',
      payload.ciudad || parent.ciudad || '',
      payload.direccion || parent.direccion || '',
      payload.telefono || parent.telefono || '',
      JSON.stringify(payload.carrito || payload.cart || {}),
      payload.recorded_at || now,
      payload.paid ? 'TRUE' : 'FALSE',
      payload.updated_at || now
    ];

    const existingRow = findRowByReference(sheet, reference);

    if (existingRow > 0) {
      sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
      return jsonResponse({ ok: true, action: 'update', reference });
    }

    sheet.appendRow(row);
    return jsonResponse({ ok: true, action: 'create', reference });

  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

/* -------------------- RESPUESTA JSON -------------------- */

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
