How to collect `pago.html` submissions into Google Sheets

Recommended approach: deploy a small Google Apps Script web app that accepts POST JSON and appends rows to a Google Sheet. Steps:

1. Create a new Google Spreadsheet in your Drive. Note its ID from the URL (`https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`).
2. In the spreadsheet, open `Extensions -> Apps Script`.
3. Replace the contents of the default `Code.gs` with the contents of `append_to_sheet.gs` in this repo. Update `SPREADSHEET_ID` constant with your spreadsheet ID.
4. Save the script and click `Deploy -> New deployment`.
   - Deployment type: Web app
   - Execute as: Me (your account)
   - Who has access: Anyone (if you want anonymous submissions) or Anyone within <your-domain>
5. Copy the Web App URL and paste it into `finalizar_pago.html` as `WOMPI_SERVER_URL` and into `pago_exitoso.html` as `APPS_SCRIPT_URL`.

Notes and security:
- If you choose `Anyone, even anonymous`, anyone with the web app URL can write to your sheet. Consider restricting access to only Google accounts if you need protection.
- The Apps Script in this repo appends a single row per submission. You can extend it to add column headers, validation, and deduplication.
- The client code in `pago.html` will queue failed submissions in `localStorage` under `mm_pending_submissions` and attempt to flush them later.

Scopes & permissions:
- This integration uses `MailApp` and `DriveApp` to send emails and generate PDF receipts. When you deploy and first run the functions, you will be prompted to grant the following permissions:
  - Send email as you (MailApp)
  - Manage files in your Google Drive (DriveApp)
  - Access spreadsheets in your Google Drive (SpreadsheetApp)
  Make sure to review and accept these scopes when prompted.

Troubleshooting:
- If CORS or 403 errors occur, ensure the Apps Script deployment is set to allow access and that you're using the correct URL.
- For debugging, view the script's execution log in Apps Script's Executions dashboard.
- If emails are not delivered, check the account used to deploy the Apps Script (it is the sender) and check the spam folder.

Wompi integration (Payments):

1. Set up script properties in Apps Script (open *Project Settings* -> *Script properties* or run `setScriptProperties`):
   - `WOMPI_PRIVATE_KEY` = Your Wompi private key (use sandbox key for testing)
   - `WOMPI_SANDBOX` = `true` (or `false` for production)
2. Deploy the Apps Script as *Web app* (Execute as: Me; Who has access: Anyone).
3. Copy the Web App URL and paste it into `finalizar_pago.html` as `WOMPI_SERVER_URL` and set `WOMPI_REDIRECT_URL` to the URL where you want users redirected after payment (e.g. `https://yourdomain.com/pago_exitoso.html`).
4. In Wompi console, if required, register the redirect URL and the webhook URL (use the same Web App URL to receive webhooks).
5. Test in sandbox: create a payment from the site and confirm the payment appears in the `Pagos` sheet and the `payment_status` in `Registros` is updated.

If you want help with the above steps, I can provide the exact commands and test payloads. The webhook handler in `append_to_sheet.gs` will log incoming events to the `Pagos` sheet and attempt to update `Registros` by matching `reference`.

If you want, puedo:
- Desplegar el Apps Script por ti si me proporcionas acceso (no recomendado por seguridad).
- Modificar la hoja para crear encabezados automáticos.
- Añadir una ruta en tu backend (si tienes) en lugar de Apps Script.

Recibos por correo (nueva funcionalidad):
- El webhook ahora intentará verificar la transacción con Wompi y, si el pago está aprobado, enviará automáticamente un recibo al correo del comprador (usa `MailApp.sendEmail`).
- Para personalizar el contenido del recibo, edita la función `sendReceiptEmail(txn)` en `append_to_sheet.gs`.
- El remitente del correo será la cuenta propietaria del proyecto de Apps Script (la cuenta con la que despliegues).
