require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.json());

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
        // Try to notify Google Sheets via the configured Apps Script webhook
        try {
          const sheetUrl = process.env.SHEET_WEBHOOK_URL;
          if (sheetUrl) {
            await fetch(sheetUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'update', payload: { reference, status: 'paid', paid: true, webhook: req.body } })
            });
            console.log('Sheet updated for reference:', reference);
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
    const { amount_in_cents, reference, currency = 'COP', format, expiration_time, expirationTime } = req.body;
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
    return res.json({ signature: buf.toString('hex'), signature_base64: buf.toString('base64'), payload });
  } catch (err) {
    console.error('Error generando firma:', err);
    return res.status(500).json({ message: 'Error generando firma', error: String(err) });
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
const fs = require('fs');
const path = require('path');
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

app.listen(PORT, () => console.log(`Payment demo server corriendo en http://localhost:${PORT}`));
