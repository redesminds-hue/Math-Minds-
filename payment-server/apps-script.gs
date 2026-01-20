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
    'student_document',
    'parent_name',
    'parent_document',
    'parent_email',
    'colegio',
    'curso',
    'producto',
    'precio',
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

    // derive product and price from carrito if present
    let producto = '';
    let precio = '';
    try {
      const cart = payload.carrito || payload.cart || [];
      if (Array.isArray(cart) && cart.length > 0) {
        producto = cart.map(i => i && (i.title || i.producto || i.name)).filter(Boolean).join(' | ');
        // Prefer numeric price: sum of item.price if present, else first item's price
        const prices = cart.map(i => Number(i && (i.price || i.precio) || 0)).filter(n => Number.isFinite(n));
        if (prices.length) {
          const total = prices.reduce((s, v) => s + v, 0);
          precio = total;
        } else {
          precio = '';
        }
      }
    } catch (e) { producto = producto || ''; precio = precio || ''; }

    // try multiple names for document fields
    const studentDoc = student.doc || student.documento || student.document || student.student_document || '';
    const parentDoc = payload.documento || parent.documento || parent.document || parent.parent_document || '';

    const row = [
      reference,
      status,
      amount,
      student.first || student.nombre || '',
      student.last || student.apellido || '',
      studentDoc || '',
      parent.parent_name || parent.acudiente || parent.name || '',
      parentDoc || '',
      parent.parent_email || parent.email || payload.email || '',
      payload.colegio || parent.colegio || '',
      payload.curso || payload.grade || parent.curso || '',
      producto || '',
      precio || '',
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
      return jsonResponse({ ok: true, action: 'update', reference, spreadsheetId: SPREADSHEET_ID, sheetName: sheet.getName() });
    }

    sheet.appendRow(row);
    return jsonResponse({ ok: true, action: 'create', reference, spreadsheetId: SPREADSHEET_ID, sheetName: sheet.getName() });

  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

/**
 * Diagnostic GET: returns which SPREADSHEET_ID and basic sheet info.
 * Deploy and call this URL (GET) to confirm the script is pointing to the expected spreadsheet.
 */
function doGet(e) {
  try {
    const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!SPREADSHEET_ID) return jsonResponse({ ok: false, error: 'Missing SPREADSHEET_ID property' });
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Registrations');
    const info = { spreadsheetId: SPREADSHEET_ID, url: ss.getUrl(), sheetExists: !!sheet };
    if (sheet) info.lastRow = sheet.getLastRow();
    return jsonResponse(Object.assign({ ok: true }, info));
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
