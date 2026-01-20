Setup: Google Apps Script webhook -> Google Sheets

1) Crear una hoja de cálculo nueva (por ejemplo: "Registrations").
2) Abrir el editor de Apps Script (Extensiones → Apps Script).
3) Crear un nuevo proyecto y pegar el contenido de `apps-script.gs` (en este repo).
4) Guardar y abrir `Propiedades del proyecto` → `Script properties` y añadir la propiedad:
   - `TARGET_SHEET_ID` = (el ID de tu hoja, p.ej. la parte entre `/d/` y `/edit` en la URL)
5) En el editor de Apps Script: `Deploy` → `New deployment` → seleccionar "Web app".
   - "Execute as": Me (tu cuenta)
   - "Who has access": Anyone (even anonymous)
   - Desplegar y copiar la URL del Web App (termina en `/exec`).
6) En el servidor local `payment-server` copia `.env.example` → `.env` y pega la URL:
   SHEET_WEBHOOK_URL=https://script.google.com/macros/s/XXXXXXXX/exec
7) Reinicia el servidor: `node server.js` (o `npm start`).

Cómo funciona
- Cuando `pago.html` llama al proxy `/api/send-to-sheet`, el servidor reenvía la petición al Apps Script.
- El Apps Script escribe una fila en la hoja "Registrations" con los campos relevantes.
- Si más tarde el webhook de Wompi llega al servidor y marca la referencia como pagada, puedes modificar el Apps Script o el servidor para actualizar la hoja (ya hay `used_references.json` en el servidor para referencias pagadas).

Pruebas locales
- Puedes probar con curl o PowerShell enviando JSON con `{ "action":"create","payload":{...} }` al endpoint `http://localhost:3000/api/send-to-sheet`.

Nota de seguridad
- Permitir "Anyone, even anonymous" es práctico para pruebas; para producción considera restringir acceso (ver soluciones con Cloud Functions o app script con autorización) y validar la procedencia de las peticiones en el servidor.
