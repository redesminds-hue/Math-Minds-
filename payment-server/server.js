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
app.post('/api/webhook', (req, res) => {
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

app.listen(PORT, () => console.log(`Payment demo server corriendo en http://localhost:${PORT}`));
