// Google Apps Script: Append incoming JSON POST to a Google Sheet
// Deploy as Web App (Execute the app as: Me; Who has access: Anyone, even anonymous)
// Then paste the deployment URL into SHEET_WEBHOOK_URL in pago.html

function doPost(e) {
  try {
    var data = {};
    if (e.postData && e.postData.type === 'application/json') {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      // fallback for form-encoded
      data = e.parameter;
    }

    // Open sheet by ID or name
    var SPREADSHEET_ID = 'REPLACE_WITH_YOUR_SPREADSHEET_ID';
    var SHEET_NAME = 'Registros';
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    // Prepare a row: timestamp, parent, document, email, colegio, curso, ciudad, direccion, telefono, carrito(json)
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
      JSON.stringify(data.carrito || [])
    ];

    sheet.appendRow(row);

    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
