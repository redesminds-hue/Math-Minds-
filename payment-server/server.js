// Ensure we load the .env file from this package directory even if the process
// is started from a different working directory. This guarantees sensitive
// vars like WOMPI_INTEGRITY_SECRET are available to the server.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
// Ensure .env SHEET_WEBHOOK_URL is applied even if previously set in environment
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    const match = raw.match(/^SHEET_WEBHOOK_URL=(.*)$/m);
    if (match && match[1]) {
      const v = match[1].trim();
      if (v && process.env.SHEET_WEBHOOK_URL !== v) {
        process.env.SHEET_WEBHOOK_URL = v;
      }
    }
  }
} catch (e) { /* ignore */ }
const express = require('express');
const fetch = require('node-fetch');

const app = express();
const path = require('path');
const fs = require('fs');
// Serve frontend static files from project root so pages and API share origin (avoids CORS)
const STATIC_ROOT = path.join(__dirname, '..');
app.use(express.static(STATIC_ROOT));
app.use(express.urlencoded({ extended: true }));
// Ensure CORS responses reflect the requesting Origin and allow credentials.
// We handle preflight responses explicitly here so the Access-Control-Allow-Origin
// header is never the wildcard '*' when credentials are used by the client.
app.use(express.json());
app.use((req, res, next) => {
  try {
    const origin = req.get('origin') || req.get('Origin');
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  } catch (e) { /* ignore */ }
  return next();
});

// JSON parse error handler: return JSON instead of HTML when body-parser fails
app.use((err, req, res, next) => {
  try {
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ ok: false, error: 'invalid_json', message: 'Could not parse JSON body' });
    }
  } catch (e) { /* ignore */ }
  return next(err);
});

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const REDIRECT_URL = process.env.REDIRECT_URL || 'http://localhost:3000/transaction-result';
const PORT = process.env.PORT || 3000;
const INTEGRITY_SECRET = process.env.INTEGRITY_SECRET;
// Prefer the standard name `WOMPI_INTEGRITY_SECRET`, fallback to previous `INTEGRITY_SECRET` env var
const WOMPI_INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET || INTEGRITY_SECRET;

if (!PRIVATE_KEY) {
  console.warn('Warning: PRIVATE_KEY no está definida en .env. Agrega PRIVATE_KEY para llamadas reales a Wompi.');
}

function makeReference() {
  return `MM-${Date.now()}-${Math.random().toString(36).substr(2,8)}`;
}

app.post('/api/create-transaction', async (req, res) => {
  try {
    let { amount_in_cents, amountInCents, amount, currency = 'COP', email, full_name, public_key } = req.body;
    console.log('[payment-server] request body:', JSON.stringify(req.body));

    // Aceptar varios nombres comunes para el monto
    if (amountInCents && !amount_in_cents) amount_in_cents = amountInCents;
    if (amount && !amount_in_cents) amount_in_cents = amount;
    // Normalizar a número entero (centavos)
    const parsedAmount = Number(amount_in_cents);
    if (!Number.isFinite(parsedAmount) || Number.isNaN(parsedAmount)) {
      return res.status(400).json({ message: 'amount_in_cents inválido o ausente', received: amount_in_cents });
    }
    const amountCentsInt = Math.round(parsedAmount);
    if (amountCentsInt < 0) {
      return res.status(400).json({ message: 'amount_in_cents debe ser >= 0', received: amountCentsInt });
    }
    if (!amount_in_cents) return res.status(400).json({ message: 'Falta amount_in_cents' });

    const reference = makeReference();

    const payload = {
      amount_in_cents: amountCentsInt,
      currency,
      reference,
      customer_email: email || '',
      redirect_url: REDIRECT_URL
    };
    console.log('[payment-server] payload to Wompi:', JSON.stringify(payload));

    if (!PRIVATE_KEY) {
      // Modo demo: retornamos un URL falso para permitir pruebas locales sin la API
      return res.json({ checkout_url: `https://checkout.wompi.co/p/?public-key=DEMO&reference=${reference}`, reference });
    }

    // Selecciona endpoint según el tipo de llave (sandbox vs producción)
    const isTestKey = String(PRIVATE_KEY).startsWith('prv_test_');
    const wompiEndpoint = isTestKey ? 'https://sandbox.wompi.co/v1/transactions' : 'https://api.wompi.co/v1/transactions';

    console.log('[payment-server] Usando endpoint Wompi:', wompiEndpoint);
    console.log('[payment-server] PRIVATE_KEY prefix:', String(PRIVATE_KEY).slice(0, 10) + '...');

    const response = await fetch(wompiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PRIVATE_KEY}`
      },
      body: JSON.stringify({
        transaction: payload
      })
    });

    // Intentamos parsear la respuesta y devolverla al frontend para depuración
    let data = null;
    try {
      data = await response.json();
    } catch (err) {
      const text = await response.text().catch(() => '');
      return res.status(500).json({ message: 'Error parseando respuesta de Wompi', details: text });
    }

    if (!response.ok) {
      console.warn('[payment-server] Wompi returned error:', JSON.stringify(data));
      // Si Wompi rechaza por validación, construimos un checkout_url de respaldo
      const usedPublicKey = public_key || (process.env.PUBLIC_KEY || '');
      if (usedPublicKey) {
        // If REDIRECT_URL is localhost, use Wompi's public redirect checker to avoid CloudFront 403
        const safeRedirect = String(REDIRECT_URL).startsWith('http://localhost') ? 'https://transaction-redirect.wompi.co/check' : REDIRECT_URL;
        const fallback = `https://checkout.wompi.co/p/?public-key=${encodeURIComponent(usedPublicKey)}&currency=${encodeURIComponent(payload.currency)}&amount-in-cents=${encodeURIComponent(payload.amount_in_cents)}&reference=${encodeURIComponent(payload.reference)}&redirect-url=${encodeURIComponent(safeRedirect)}`;
        return res.status(200).json({ checkout_url: fallback, reference, warning: 'Wompi validation failed, using fallback checkout URL', details: data });
      }
      return res.status(500).json({ message: 'Error desde Wompi', details: data });
    }

    // data.data.checkout_url es donde redirigir al usuario
    return res.json({ checkout_url: data.data.checkout_url, reference });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error interno en server', error: String(err) });
  }
});

// Webhook listener (para recibir notificaciones de Wompi)
app.post('/api/webhook', async (req, res) => {
  try {
    const sigHeader = req.get('x-wompi-signature') || req.get('x-hook-signature') || req.get('x-wompi-webhook-signature') || req.get('x-signature') || req.get('x-wompi-signature'.toLowerCase());
    const bodyStr = JSON.stringify(req.body || {});
    let verified = false;

    if (WOMPI_INTEGRITY_SECRET && sigHeader) {
      // Common webhook verification approaches: HMAC-SHA256 of raw body, or SHA256 of body+secret
      try {
        const hmac = crypto.createHmac('sha256', String(WOMPI_INTEGRITY_SECRET)).update(bodyStr, 'utf8').digest('hex');
        const alt = crypto.createHash('sha256').update(bodyStr + String(WOMPI_INTEGRITY_SECRET), 'utf8').digest('hex');
        if (sigHeader === hmac || sigHeader === alt) verified = true;
      } catch (e) { console.warn('Error computing webhook signature:', e); }
    }

    console.log('Webhook recibido:', JSON.stringify(req.body, null, 2));
    console.log('Webhook signature header:', sigHeader, 'verified:', verified);

    if (!verified && WOMPI_INTEGRITY_SECRET) {
      return res.status(401).json({ message: 'Firma inválida', verified: false });
    }

    // Intentar extraer la referencia de la transacción del payload según esquema Wompi
    try {
      const data = req.body && (req.body.data || req.body);
      let reference = null;
      if (data && data.transaction && data.transaction.reference) reference = data.transaction.reference;
      if (!reference && data && data.reference) reference = data.reference;
      if (!reference && req.body && req.body.reference) reference = req.body.reference;
      if (reference) {
        markRefUsed(reference, { source: 'webhook', payload: req.body });
        console.log('Marked reference used:', reference);
        // Try to notify Google Sheets via the configured Apps Script webhook.
        // Prefer using an existing locally persisted registration (registrations.json) so the sheet row
        // contains the full data the user submitted. If no local record exists, build a minimal payload
        // from the webhook body and send a create action so the Apps Script inserts a row.
        try {
          const sheetUrl = process.env.SHEET_WEBHOOK_URL;
          if (sheetUrl) {
            // attempt to read local registration for this reference
            let regs = {};
            try {
              const regsFile = path.join(__dirname, 'registrations.json');
              if (fs.existsSync(regsFile)) regs = JSON.parse(fs.readFileSync(regsFile, 'utf8') || '{}');
            } catch (e) { regs = {}; }

            let payloadToSend = null;
            if (regs && regs[reference]) {
              payloadToSend = regs[reference];
              // ensure status updated
              payloadToSend.status = payloadToSend.status || 'pending';
              payloadToSend.paid = true;
            } else {
              // Build a minimal payload using common webhook fields
              const data = req.body && (req.body.data || req.body) || {};
              const transaction = data.transaction || data || {};
              payloadToSend = {
                reference,
                status: 'paid',
                paid: true,
                amount_in_cents: transaction.amount_in_cents || transaction.amount || transaction.value || null,
                currency: transaction.currency || 'COP',
                customer_email: transaction.customer_email || transaction.email || (transaction.customer && transaction.customer.email) || '',
                webhook: req.body
              };
            }

            // Forward as 'create' so Apps Script can upsert the row based on reference
            const forwardBody = { action: 'create', payload: payloadToSend };
            const fresult = await forwardToSheet(sheetUrl, forwardBody);
            console.log('Sheet create/update forwarded for reference:', reference, 'result:', JSON.stringify(fresult));
          }
        } catch (e) { console.warn('Failed to update sheet from webhook', e); }
      }
    } catch (e) { console.warn('Could not extract reference from webhook payload', e); }

    // Aquí procesa el evento (guardar en BD, actualizar estado, etc.)
    return res.status(200).json({ ok: true, verified });
  } catch (err) {
    console.error('Error en webhook handler:', err);
    return res.status(500).json({ message: 'Error interno', error: String(err) });
  }
});

// Mount proxy route used by ServiceWorker
try {
  const proxyRoute = require('./proxy-route');
  app.use('/', proxyRoute);
} catch (e) { console.warn('proxy-route not available:', e.message); }

// Endpoint para generar firma de integridad para el widget
const crypto = require('crypto');
app.post('/api/generate-signature', (req, res) => {
  try {
    const { amount_in_cents, reference, currency = 'COP', format, expiration_time, expirationTime, payload: registrationPayload } = req.body;
    const expiration = expiration_time || expirationTime || process.env.EXPIRATION_TIME || '';
    if (!WOMPI_INTEGRITY_SECRET) return res.status(400).json({ message: 'WOMPI_INTEGRITY_SECRET no configurado en el servidor' });
    if (!amount_in_cents || !reference) return res.status(400).json({ message: 'Faltan amount_in_cents o reference' });

    const candidates = {
      // Standard: <reference><amount><currency><secret>
      '1': () => `${String(reference)}${String(amount_in_cents)}${String(currency)}${String(WOMPI_INTEGRITY_SECRET)}`,
      // With expiration: <reference><amount><currency><expiration><secret>
      '2': () => `${String(reference)}${String(amount_in_cents)}${String(currency)}${String(expiration)}${String(WOMPI_INTEGRITY_SECRET)}`,
      // legacy variants for debugging (without secret, or different order) kept for testing
      '3': () => `${String(amount_in_cents)}|${String(currency)}|${String(reference)}`,
      '4': () => `${String(amount_in_cents)}${String(currency)}${String(reference)}${String(WOMPI_INTEGRITY_SECRET)}`,
      '5': () => JSON.stringify({ amount_in_cents: String(amount_in_cents), currency: String(currency), reference: String(reference) })
    };

    const computeAll = () => {
      const out = {};
      Object.keys(candidates).forEach(k => {
        const payload = candidates[k]();
        // Use plain SHA256 of the payload (matches widget expectation: SHA256 of concatenated string)
        const h = crypto.createHash('sha256').update(String(payload), 'utf8').digest();
        out[k] = { hex: h.toString('hex'), b64: h.toString('base64'), payload };
      });
      return out;
    };

    if (format === 'all') {
      return res.json({ signatures: computeAll() });
    }

    const fmtKey = String(format || '1');
    const payload = (candidates[fmtKey] || candidates['1'])();
    // Signature must be SHA256 of concatenation (not HMAC) using the integrity secret
    const buf = crypto.createHash('sha256').update(String(payload), 'utf8').digest();
    // If the client included a registration payload, persist it locally under the
    // provided reference so the webhook can later find the full registration.
    try {
      if (registrationPayload && reference) {
        const regsFile = path.join(__dirname, 'registrations.json');
        let regs = {};
        try { if (fs.existsSync(regsFile)) regs = JSON.parse(fs.readFileSync(regsFile, 'utf8') || '{}'); } catch(e){ regs = {}; }
        const recordEntry = Object.assign({ reference: String(reference), recorded_at: new Date().toISOString(), status: 'pending', paid: false }, registrationPayload || {});
        regs[String(reference)] = recordEntry;
        try { fs.writeFileSync(regsFile, JSON.stringify(regs, null, 2), 'utf8'); } catch(e){ console.warn('Failed writing registrations.json in generate-signature', e); }
        // If a sheet webhook is configured, attempt to forward the saved registration so the sheet
        // immediately receives the row without waiting for the payment webhook.
        try {
          const sheetUrl = process.env.SHEET_WEBHOOK_URL;
          if (sheetUrl) {
            const forwardBody = { action: 'create', payload: recordEntry };
            // fire-and-forget: don't block signature generation on sheet forwarding
            forwardToSheet(sheetUrl, forwardBody).then(r => console.log('[payment-server] forwarded registration (generate-signature) to sheet:', r)).catch(e => console.warn('forwardToSheet error (generate-signature)', e));
          }
        } catch(e) { console.warn('Failed forwarding registration from generate-signature', e); }
      }
    } catch(e) { console.warn('Error persisting registration in generate-signature', e); }
    return res.json({ signature: buf.toString('hex'), signature_base64: buf.toString('base64'), payload });
  } catch (err) {
    console.error('Error generando firma:', err);
    return res.status(500).json({ message: 'Error generando firma', error: String(err) });
  }
});

// Ensure OPTIONS preflight for generate-signature is handled explicitly
app.options('/api/generate-signature', (req, res) => {
  try {
    const origin = req.get('origin') || req.get('Origin') || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } catch (e) {}
  return res.sendStatus(204);
});

// Friendly GET handler so accidental GET requests do not surface a 405 in the console
app.get('/api/generate-signature', (req, res) => {
  try {
    const amount_in_cents = req.query.amount_in_cents || req.query.amount || req.query.amountInCents;
    const reference = req.query.reference || req.query.ref;
    const currency = req.query.currency || 'COP';
    const format = req.query.format || '1';
    if (!amount_in_cents || !reference) {
      return res.json({ ok: false, message: 'Use POST /api/generate-signature with JSON { amount_in_cents, reference } or provide amount_in_cents & reference as query params' });
    }
    if (!WOMPI_INTEGRITY_SECRET) return res.status(400).json({ message: 'WOMPI_INTEGRITY_SECRET no configurado en el servidor' });

    const candidates = {
      '1': () => `${String(reference)}${String(amount_in_cents)}${String(currency)}${String(WOMPI_INTEGRITY_SECRET)}`,
      '2': () => `${String(reference)}${String(amount_in_cents)}${String(currency)}${String(process.env.EXPIRATION_TIME||'')}${String(WOMPI_INTEGRITY_SECRET)}`,
      '3': () => `${String(amount_in_cents)}|${String(currency)}|${String(reference)}`,
      '4': () => `${String(amount_in_cents)}${String(currency)}${String(reference)}${String(WOMPI_INTEGRITY_SECRET)}`,
      '5': () => JSON.stringify({ amount_in_cents: String(amount_in_cents), currency: String(currency), reference: String(reference) })
    };

    if (format === 'all') {
      const out = {};
      Object.keys(candidates).forEach(k => {
        const payload = candidates[k]();
        const h = crypto.createHash('sha256').update(String(payload), 'utf8').digest();
        out[k] = { hex: h.toString('hex'), b64: h.toString('base64'), payload };
      });
      return res.json({ signatures: out });
    }

    const payload = (candidates[String(format) || '1'])();
    const buf = crypto.createHash('sha256').update(String(payload), 'utf8').digest();
    return res.json({ signature: buf.toString('hex'), signature_base64: buf.toString('base64'), payload });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// Proxy endpoint to send data to a Google Apps Script webhook (avoids client-side CORS)
app.post('/api/send-to-sheet', async (req, res) => {
  try {
    const sheetUrl = process.env.SHEET_WEBHOOK_URL || req.body.sheet_url;
    if (!sheetUrl) return res.status(400).json({ message: 'SHEET_WEBHOOK_URL not configured' });
    const forwardBody = req.body;
    console.log('[payment-server] forwarding to sheet webhook:', JSON.stringify(forwardBody));

    // Use helper to persist locally and forward
    const result = await forwardToSheet(sheetUrl, forwardBody);
    if (result && result.error) return res.status(502).json({ ok: false, error: result.error, details: result.details || null });
    return res.status(result && result.status ? result.status : 200).send(result && result.body ? result.body : JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('Error proxying to sheet webhook:', err);
    return res.status(500).json({ message: 'Error proxying to sheet', error: String(err) });
  }
});

// Persist a registration locally (registrations.json) without forwarding to Apps Script.
// This allows the webhook to find the full registration when payment is confirmed.
app.post('/api/save-registration', async (req, res) => {
  try {
    const body = req.body || {};
    const payload = body.payload || body;
    const reference = payload.reference || body.reference || `REG-${Date.now()}-${Math.random().toString(36).substr(2,6)}`;
    const regsFile = path.join(__dirname, 'registrations.json');
    let regs = {};
    try { if (fs.existsSync(regsFile)) regs = JSON.parse(fs.readFileSync(regsFile, 'utf8') || '{}'); } catch (e) { regs = {}; }
    const recordEntry = Object.assign({ reference: reference, recorded_at: new Date().toISOString() }, payload || {});
    regs[String(reference)] = recordEntry;
    fs.writeFileSync(regsFile, JSON.stringify(regs, null, 2), 'utf8');
    console.log('[payment-server] saved registration for reference:', reference);
    // If configured, forward the registration to the Apps Script webhook so Sheets is updated
    // immediately rather than waiting for the payment webhook.
    let forwardResult = null;
    try {
      const sheetUrl = process.env.SHEET_WEBHOOK_URL || body.sheet_url;
      if (sheetUrl) {
        const forwardBody = { action: 'create', payload: recordEntry };
        forwardResult = await forwardToSheet(sheetUrl, forwardBody);
        console.log('[payment-server] forwarded registration to sheet:', forwardResult);
      }
    } catch (e) { console.warn('save-registration: forwarding to sheet failed', e); }

    return res.json({ ok: true, reference, forwarded: forwardResult });
  } catch (err) {
    console.error('save-registration error', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// Helper to forward to Apps Script and persist locally + log last attempt
async function forwardToSheet(sheetUrl, forwardBody){
  const logFile = path.join(__dirname, 'last_sheet_try.json');
  const record = { ts: new Date().toISOString(), sheetUrl, forwardBody };
  try {
    // Persist registration locally (JSON + CSV) without affecting forwarding
    try {
      const action = (forwardBody && forwardBody.action) || '';
      const payload = (forwardBody && forwardBody.payload) ? forwardBody.payload : forwardBody;
      if (action === 'create' || (payload && (payload.acudiente || payload.parent || payload.email || payload.telefono))) {
        const regId = payload.reference || `REG-${Date.now()}-${Math.random().toString(36).substr(2,6)}`;
        const recordEntry = Object.assign({ reference: regId, recorded_at: new Date().toISOString() }, payload || {});
        const regsFile = path.join(__dirname, 'registrations.json');
        let regs = {};
        try { if (fs.existsSync(regsFile)) regs = JSON.parse(fs.readFileSync(regsFile, 'utf8') || '{}'); } catch (e) { regs = {}; }
        regs[recordEntry.reference] = recordEntry;
        try { fs.writeFileSync(regsFile, JSON.stringify(regs, null, 2), 'utf8'); } catch (e) { console.warn('Failed writing registrations.json', e); }
        // CSV
        try {
          const csvFile = path.join(__dirname, 'registrations.csv');
          const header = 'reference,status,amount_in_cents,student_first,student_last,parent_name,parent_email,colegio,curso,ciudad,direccion,telefono,carrito_json,recorded_at\n';
          if (!fs.existsSync(csvFile)) fs.writeFileSync(csvFile, header, 'utf8');
          const esc = (v) => { if (v === null || typeof v === 'undefined') return ''; const s = (typeof v === 'string') ? v : JSON.stringify(v); return '"' + String(s).replace(/"/g, '""') + '"'; };
          const line = [
            esc(recordEntry.reference),
            esc(recordEntry.status || ''),
            esc(recordEntry.amount_in_cents || ''),
            esc((recordEntry.student && recordEntry.student.first) || ''),
            esc((recordEntry.student && recordEntry.student.last) || ''),
            esc(recordEntry.acudiente || (recordEntry.parent && recordEntry.parent.acudiente) || ''),
            esc(recordEntry.email || (recordEntry.parent && recordEntry.parent.email) || ''),
            esc(recordEntry.colegio || ''),
            esc(recordEntry.curso || recordEntry.grade || ''),
            esc(recordEntry.ciudad || ''),
            esc(recordEntry.direccion || ''),
            esc(recordEntry.telefono || ''),
            esc(recordEntry.carrito || recordEntry.cart || ''),
            esc(recordEntry.recorded_at || '')
          ].join(',') + '\n';
          fs.appendFileSync(csvFile, line, 'utf8');
        } catch (e) { console.warn('Failed appending to registrations.csv', e); }
      }
    } catch (e) { console.warn('Failed to persist registration locally', e); }

    // Forward to Apps Script
    const r = await fetch(sheetUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(forwardBody) });
    const text = await r.text().catch(()=>'');
    record.response = { status: r.status, body: text };
    try { fs.writeFileSync(logFile, JSON.stringify(record, null, 2), 'utf8'); } catch (e) { console.warn('Failed writing last_sheet_try.json', e); }
    return { status: r.status, body: text };
  } catch (err) {
    record.error = String(err);
    try { fs.writeFileSync(logFile, JSON.stringify(record, null, 2), 'utf8'); } catch (e) { console.warn('Failed writing last_sheet_try.json', e); }
    return { error: String(err), details: err && err.stack ? err.stack : null };
  }
}

// Simple persistence for used references (file-backed)
// `fs` and `path` are required at top-level to allow serving static files
const USED_REFS_FILE = path.join(__dirname, 'used_references.json');

function readUsedRefs() {
  try {
    if (!fs.existsSync(USED_REFS_FILE)) return {};
    const txt = fs.readFileSync(USED_REFS_FILE, 'utf8') || '{}';
    return JSON.parse(txt || '{}');
  } catch (e) { console.warn('readUsedRefs error', e); return {}; }
}

function markRefUsed(reference, meta) {
  try {
    const all = readUsedRefs();
    all[String(reference)] = { ts: Date.now(), meta: meta || null };
    fs.writeFileSync(USED_REFS_FILE, JSON.stringify(all, null, 2), 'utf8');
    return true;
  } catch (e) { console.error('markRefUsed error', e); return false; }
}

function isRefUsed(reference) {
  const all = readUsedRefs();
  return Boolean(all && all[String(reference)]);
}

// Endpoint to check whether a reference has already been used
app.get('/api/reference-status', (req, res) => {
  const reference = req.query.reference || req.query.ref;
  if (!reference) return res.status(400).json({ message: 'Falta referencia' });
  const used = isRefUsed(reference);
  return res.json({ reference, used });
});

app.get('/transaction-result', (req, res) => {
  res.send('<h3>Resultado de la transacción (aquí procesa la respuesta o muéstrala al usuario)</h3><pre>' + JSON.stringify(req.query, null, 2) + '</pre>');
});

// Trigger a test send to the configured Apps Script webhook and return logged result
app.get('/api/send-test-to-sheet', async (req, res) => {
  try {
    const sheetUrl = process.env.SHEET_WEBHOOK_URL;
    if (!sheetUrl) return res.status(400).json({ ok: false, error: 'SHEET_WEBHOOK_URL not configured in .env' });
    const testPayload = { action: 'create', payload: { reference: `TEST-${Date.now()}`, acudiente: 'Prueba Server', documento: '000', email: 'test@local', colegio: 'Test', curso: 'NA', ciudad: 'Bogotá', direccion: 'Calle Test', telefono: '3000000000', carrito: [{ title: 'Test Item', price: 1000 }] } };
    const r = await forwardToSheet(sheetUrl, testPayload);
    return res.json({ ok: true, result: r });
  } catch (err) { return res.status(500).json({ ok: false, error: String(err) }); }
});

// View last attempt log
app.get('/api/last-sheet-try', (req, res) => {
  try {
    const f = path.join(__dirname, 'last_sheet_try.json');
    if (!fs.existsSync(f)) return res.json({ ok: false, error: 'no_log' });
    const txt = fs.readFileSync(f, 'utf8') || '{}';
    return res.send(txt);
  } catch (e) { return res.status(500).json({ ok: false, error: String(e) }); }
});

// Endpoint to list persisted registrations with `paid` status
app.get('/api/registrations', (req, res) => {
  try {
    const regsFile = path.join(__dirname, 'registrations.json');
    let regs = {};
    try { if (fs.existsSync(regsFile)) regs = JSON.parse(fs.readFileSync(regsFile, 'utf8') || '{}'); } catch (e) { regs = {}; }
    const used = readUsedRefs();
    const out = Object.keys(regs).map(k => {
      const r = regs[k] || {};
      const ref = r.reference || k;
      return Object.assign({ paid: Boolean(used && used[ref]) }, r);
    });
    return res.json({ ok: true, count: out.length, registrations: out });
  } catch (err) { return res.status(500).json({ ok: false, error: String(err) }); }
});

// Force send a specific registration to the configured Apps Script webhook
app.post('/api/trigger-send', async (req, res) => {
  try {
    const reference = (req.body && (req.body.reference || req.body.ref)) || req.query.reference || req.query.ref;
    if (!reference) return res.status(400).json({ ok: false, error: 'missing_reference' });
    const regsFile = path.join(__dirname, 'registrations.json');
    let regs = {};
    try { if (fs.existsSync(regsFile)) regs = JSON.parse(fs.readFileSync(regsFile, 'utf8') || '{}'); } catch (e) { regs = {}; }
    const record = regs[String(reference)];
    if (!record) return res.status(404).json({ ok: false, error: 'not_found', reference });
    const sheetUrl = process.env.SHEET_WEBHOOK_URL;
    if (!sheetUrl) return res.status(400).json({ ok: false, error: 'SHEET_WEBHOOK_URL not configured' });
    const forwardBody = { action: 'create', payload: record };
    console.log('[payment-server] trigger-send for reference:', reference, 'forwarding to', sheetUrl);
    const result = await forwardToSheet(sheetUrl, forwardBody);
    return res.json({ ok: true, result });
  } catch (err) {
    console.error('trigger-send error', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// List pending registrations (not yet marked as used by webhook)
app.get('/api/pending-registrations', (req, res) => {
  try {
    const regsFile = path.join(__dirname, 'registrations.json');
    let regs = {};
    try { if (fs.existsSync(regsFile)) regs = JSON.parse(fs.readFileSync(regsFile, 'utf8') || '{}'); } catch (e) { regs = {}; }
    const used = readUsedRefs();
    const pending = Object.keys(regs).filter(k => !used[k]).map(k => regs[k]);
    return res.json({ ok: true, count: pending.length, pending });
  } catch (err) { return res.status(500).json({ ok: false, error: String(err) }); }
});

// Resend pending registrations to the configured Apps Script webhook.
// Useful when automatic forwarding failed and you want to retry delivery.
app.post('/api/resend-pending', async (req, res) => {
  try {
    const regsFile = path.join(__dirname, 'registrations.json');
    let regs = {};
    try { if (fs.existsSync(regsFile)) regs = JSON.parse(fs.readFileSync(regsFile, 'utf8') || '{}'); } catch (e) { regs = {}; }
    const used = readUsedRefs();
    const sheetUrl = process.env.SHEET_WEBHOOK_URL || req.body.sheet_url;
    if (!sheetUrl) return res.status(400).json({ ok: false, error: 'SHEET_WEBHOOK_URL not configured' });

    const toSend = Object.keys(regs).filter(k => !used[k]).map(k => regs[k]);
    const results = {};
    for (const rec of toSend) {
      try {
        const forwardBody = { action: 'create', payload: rec };
        const r = await forwardToSheet(sheetUrl, forwardBody);
        results[rec.reference || ('ref_' + Math.random().toString(36).slice(2,8))] = r;
      } catch (e) {
        results[rec.reference || ('ref_' + Math.random().toString(36).slice(2,8))] = { error: String(e) };
      }
    }
    return res.json({ ok: true, attempted: toSend.length, results });
  } catch (err) {
    console.error('resend-pending error', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Payment demo server corriendo en http://localhost:${PORT}`);
  console.log('SHEET_WEBHOOK_URL =', process.env.SHEET_WEBHOOK_URL || '(not set)');
});
