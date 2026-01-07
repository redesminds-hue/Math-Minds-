How to collect `pago.html` submissions into Google Sheets

Recommended approach: deploy a small Google Apps Script web app that accepts POST JSON and appends rows to a Google Sheet. Steps:

1. Create a new Google Spreadsheet in your Drive. Note its ID from the URL (`https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`).
2. In the spreadsheet, open `Extensions -> Apps Script`.
3. Replace the contents of the default `Code.gs` with the contents of `append_to_sheet.gs` in this repo. Update `SPREADSHEET_ID` constant with your spreadsheet ID.
4. Save the script and click `Deploy -> New deployment`.
   - Deployment type: Web app
   - Execute as: Me (your account)
   - Who has access: Anyone (if you want anonymous submissions) or Anyone within <your-domain>
5. Copy the Web App URL and paste it into `pago.html` in the `SHEET_WEBHOOK_URL` constant.

Notes and security:
- If you choose `Anyone, even anonymous`, anyone with the web app URL can write to your sheet. Consider restricting access to only Google accounts if you need protection.
- The Apps Script in this repo appends a single row per submission. You can extend it to add column headers, validation, and deduplication.
- The client code in `pago.html` will queue failed submissions in `localStorage` under `mm_pending_submissions` and attempt to flush them later.

Troubleshooting:
- If CORS or 403 errors occur, ensure the Apps Script deployment is set to allow access and that you're using the correct URL.
- For debugging, view the script's execution log in Apps Script's Executions dashboard.

If you want, puedo:
- Desplegar el Apps Script por ti si me proporcionas acceso (no recomendado por seguridad).
- Modificar la hoja para crear encabezados automáticos.
- Añadir una ruta en tu backend (si tienes) en lugar de Apps Script.
