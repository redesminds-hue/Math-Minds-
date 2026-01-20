/**
 * payment-server/server.js (Render-ready, sin perder la lógica original)
 *
 * ✅ Compatible con Render (Node 18+):
 * - NO lee .env desde archivo (Render usa Environment Variables)
 * - NO sirve frontend estático (tu frontend vive en cPanel)
 * - NO persiste en disco (Render es efímero). En su lugar:
 *    - persiste en memoria (útil para debug en caliente)
 *    - y/o reenvía a Google Sheets (persistencia real) vía Apps Script
 *
 * Mantiene:
 * - /api/create-transaction (con fallback checkout_url)
 * - /api/webhook (verificación firma + forward a Sheets + mark used)
 * - /api/generate-signature (format/all + opcional persist registrationPayload)
 * - /api/send-to-sheet, /api/save-registration, /api/registrations, /api/pending-registrations, /api/resend-pending,
 *   /api/reference-status, /api/trigger-send, /api/send-test-to-sheet, /api/last-sheet-try
 */

"use strict";

const express = require("express");
const crypto = require("crypto");

// -----------------------------
// ENV (Render -> Environment Variables)
// -----------------------------
const PRIVATE_KEY = process.env.PRIVATE_KEY; // prv_test_... / prv_prod_...
const PUBLIC_KEY = process.env.PUBLIC_KEY || ""; // opcional (para fallback checkout_url)
const REDIRECT_URL =
  process.env.REDIRECT_URL || "https://tu-dominio.com/transaction-result.html";

// Standard name + fallback legacy
const INTEGRITY_SECRET = process.env.INTEGRITY_SECRET;
const WOMPI_INTEGRITY_SECRET =
  process.env.WOMPI_INTEGRITY_SECRET || INTEGRITY_SECRET || "";

const SHEET_WEBHOOK_URL = process.env.SHEET_WEBHOOK_URL || "";
const EXPIRATION_TIME = process.env.EXPIRATION_TIME || ""; // opcional

// CORS (recomendado configurar en Render):
// ALLOWED_ORIGINS="https://tudominio.com,https://www.tudominio.com"
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const PORT = process.env.PORT || 3000;

// Render suele estar detrás de proxy
const app = express();
app.set("trust proxy", 1);

// -----------------------------
// In-memory stores (Render no persiste disco)
// -----------------------------
const mem = {
  registrations: new Map(), // reference -> recordEntry
  usedRefs: new Map(), // reference -> {ts, meta}
  lastSheetTry: null, // {ts, sheetUrl, forwardBody, response|error}
};

// Util: generar referencias
function makeReference(prefix = "MM") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Util: JSON seguro
function safeJson(x) {
  try {
    return JSON.stringify(x);
  } catch {
    return '"[unserializable]"';
  }
}

// -----------------------------
// Body parsing con RAW BODY (para firmas webhooks)
// -----------------------------
app.use(
  express.json({
    limit: "1mb",
    verify: (req, res, buf) => {
      // Guardamos el raw body para verificación de firmas (más correcto)
      req.rawBody = buf ? buf.toString("utf8") : "";
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// -----------------------------
// CORS (sin wildcard si hay credenciales)
// -----------------------------
app.use((req, res, next) => {
  const origin = req.get("origin") || req.get("Origin");
  const wantsCredentials = true; // tu lógica original permitía credentials

  if (origin) {
    const allowed =
      ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin);

    // Mantiene tu estrategia "reflect origin", pero permite endurecer con ALLOWED_ORIGINS
    if (allowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      if (wantsCredentials) {
        res.setHeader("Access-Control-Allow-Credentials", "true");
      }
    }
  }

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept, Origin"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");

  if (req.method === "OPTIONS") return res.sendStatus(204);
  return next();
});

// JSON parse error handler
app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") {
    return res
      .status(400)
      .json({ ok: false, error: "invalid_json", message: "Could not parse JSON body" });
  }
  return next(err);
});

// -----------------------------
// Health / Root
// -----------------------------
app.get("/", (req, res) => {
  res.status(200).send("payment-server: ok");
});

// -----------------------------
// Wompi helpers
// -----------------------------
function wompiTransactionsEndpoint() {
  const key = String(PRIVATE_KEY || "");
  const isTestKey = key.startsWith("prv_test_");
  return isTestKey
    ? "https://sandbox.wompi.co/v1/transactions"
    : "https://api.wompi.co/v1/transactions";
}

function buildFallbackCheckoutUrl({
  usedPublicKey,
  currency,
  amount_in_cents,
  reference,
  redirectUrl,
}) {
  // Tu lógica original: si redirect es localhost, usar checker
  const safeRedirect = String(redirectUrl || "").startsWith("http://localhost")
    ? "https://transaction-redirect.wompi.co/check"
    : redirectUrl;

  return `https://checkout.wompi.co/p/?public-key=${encodeURIComponent(
    usedPublicKey
  )}&currency=${encodeURIComponent(currency)}&amount-in-cents=${encodeURIComponent(
    amount_in_cents
  )}&reference=${encodeURIComponent(reference)}&redirect-url=${encodeURIComponent(
    safeRedirect
  )}`;
}

// -----------------------------
// Sheets forwarding (persistencia real)
// -----------------------------
async function forwardToSheet(sheetUrl, forwardBody) {
  const record = {
    ts: new Date().toISOString(),
    sheetUrl,
    forwardBody,
  };

  try {
    // Guardar "intento" en memoria (equivalente a last_sheet_try.json)
    mem.lastSheetTry = record;

    // Forward a Apps Script
    const r = await fetch(sheetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(forwardBody),
    });

    const text = await r.text().catch(() => "");
    record.response = { status: r.status, body: text };
    mem.lastSheetTry = record;

    return { status: r.status, body: text };
  } catch (err) {
    record.error = String(err);
    record.details = err && err.stack ? err.stack : null;
    mem.lastSheetTry = record;
    return { error: String(err), details: record.details || null };
  }
}

// -----------------------------
// Used refs (en memoria)
// -----------------------------
function markRefUsed(reference, meta) {
  mem.usedRefs.set(String(reference), { ts: Date.now(), meta: meta || null });
  return true;
}

function isRefUsed(reference) {
  return mem.usedRefs.has(String(reference));
}

// -----------------------------
// /api/create-transaction
// Mantiene tu normalización de montos, logs, demo-mode, endpoints y fallback checkout_url
// -----------------------------
app.post("/api/create-transaction", async (req, res) => {
  try {
    let {
      amount_in_cents,
      amountInCents,
      amount,
      currency = "COP",
      email,
      full_name, // se mantiene aunque no se use
      public_key,
    } = req.body || {};

    console.log("[payment-server] request body:", safeJson(req.body));

    // Aceptar varios nombres comunes para el monto
    if (amountInCents && !amount_in_cents) amount_in_cents = amountInCents;
    if (amount && !amount_in_cents) amount_in_cents = amount;

    const parsedAmount = Number(amount_in_cents);
    if (!Number.isFinite(parsedAmount) || Number.isNaN(parsedAmount)) {
      return res.status(400).json({
        message: "amount_in_cents inválido o ausente",
        received: amount_in_cents,
      });
    }

    const amountCentsInt = Math.round(parsedAmount);
    if (amountCentsInt < 0) {
      return res.status(400).json({
        message: "amount_in_cents debe ser >= 0",
        received: amountCentsInt,
      });
    }

    const reference = makeReference("MM");

    const payload = {
      amount_in_cents: amountCentsInt,
      currency,
      reference,
      customer_email: email || "",
      redirect_url: REDIRECT_URL,
    };

    console.log("[payment-server] payload:", safeJson(payload));

    if (!PRIVATE_KEY) {
      console.warn(
        "Warning: PRIVATE_KEY no está definida. Modo demo: devolviendo checkout_url falso."
      );
      return res.json({
        checkout_url: `https://checkout.wompi.co/p/?public-key=DEMO&reference=${encodeURIComponent(
          reference
        )}`,
        reference,
        demo: true,
      });
    }

    const endpoint = wompiTransactionsEndpoint();
    console.log("[payment-server] endpoint Wompi:", endpoint);

    // Nota: tu implementación anterior enviaba { transaction: payload }.
    // Para máxima compatibilidad, intentamos primero con wrapper y si falla,
    // reintentamos sin wrapper (sin perder tu lógica).
    const attempts = [
      { name: "wrapped", body: { transaction: payload } },
      { name: "plain", body: payload },
    ];

    let lastData = null;
    let lastStatus = 0;

    for (const a of attempts) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PRIVATE_KEY}`,
        },
        body: JSON.stringify(a.body),
      });

      lastStatus = response.status;

      let data;
      try {
        data = await response.json();
      } catch (err) {
        const text = await response.text().catch(() => "");
        return res.status(500).json({
          message: "Error parseando respuesta de Wompi",
          details: text,
        });
      }

      lastData = data;

      if (response.ok) {
        // Wompi: data.data.checkout_url (como tu lógica original)
        const checkout = data && data.data && data.data.checkout_url;
        if (!checkout) {
          // Si no viene checkout_url, devolvemos payload de debug + fallback si se puede
          const usedPublicKey = public_key || PUBLIC_KEY;
          if (usedPublicKey) {
            const fallback = buildFallbackCheckoutUrl({
              usedPublicKey,
              currency: payload.currency,
              amount_in_cents: payload.amount_in_cents,
              reference: payload.reference,
              redirectUrl: payload.redirect_url,
            });
            return res.status(200).json({
              checkout_url: fallback,
              reference,
              warning:
                "Wompi ok pero no retornó checkout_url; usando fallback de checkout",
              details: data,
            });
          }
          return res.status(200).json({
            reference,
            message: "Wompi ok pero no retornó checkout_url",
            details: data,
          });
        }

        return res.json({ checkout_url: checkout, reference, wompi: { mode: a.name } });
      }

      console.warn(
        `[payment-server] Wompi error (attempt=${a.name}) status=${response.status}:`,
        safeJson(data)
      );
      // sigue al siguiente intento
    }

    // Si todos fallaron, usamos fallback checkout si hay public key
    const usedPublicKey = public_key || PUBLIC_KEY;
    if (usedPublicKey) {
      const fallback = buildFallbackCheckoutUrl({
        usedPublicKey,
        currency: payload.currency,
        amount_in_cents: payload.amount_in_cents,
        reference: payload.reference,
        redirectUrl: payload.redirect_url,
      });
      return res.status(200).json({
        checkout_url: fallback,
        reference,
        warning: "Wompi validation failed, using fallback checkout URL",
        details: lastData,
        status: lastStatus,
      });
    }

    return res.status(500).json({
      message: "Error desde Wompi",
      details: lastData,
      status: lastStatus,
    });
  } catch (err) {
    console.error("[payment-server] create-transaction error:", err);
    return res.status(500).json({
      message: "Error interno en server",
      error: String(err),
    });
  }
});

// -----------------------------
// /api/webhook
// Mantiene verificación (HMAC o SHA256 body+secret) y forward a Sheets.
// Mejorado: usa rawBody si existe, y no depende de FS.
// -----------------------------
app.post("/api/webhook", async (req, res) => {
  try {
    const sigHeader =
      req.get("x-wompi-signature") ||
      req.get("x-hook-signature") ||
      req.get("x-wompi-webhook-signature") ||
      req.get("x-signature") ||
      req.get("x-wompi-signature".toLowerCase());

    // Preferir raw body para firma; fallback a JSON stringify
    const bodyStr = typeof req.rawBody === "string" && req.rawBody.length
      ? req.rawBody
      : JSON.stringify(req.body || {});

    let verified = false;

    if (WOMPI_INTEGRITY_SECRET && sigHeader) {
      try {
        const hmac = crypto
          .createHmac("sha256", String(WOMPI_INTEGRITY_SECRET))
          .update(bodyStr, "utf8")
          .digest("hex");

        const alt = crypto
          .createHash("sha256")
          .update(bodyStr + String(WOMPI_INTEGRITY_SECRET), "utf8")
          .digest("hex");

        if (sigHeader === hmac || sigHeader === alt) verified = true;
      } catch (e) {
        console.warn("Error computing webhook signature:", e);
      }
    }

    console.log("Webhook recibido:", safeJson(req.body));
    console.log("Webhook signature header:", sigHeader, "verified:", verified);

    if (!verified && WOMPI_INTEGRITY_SECRET) {
      return res.status(401).json({ message: "Firma inválida", verified: false });
    }

    // Extraer referencia como hacías (varios esquemas)
    const root = req.body && (req.body.data || req.body);
    const transaction = root && (root.transaction || root);
    const reference =
      (transaction && transaction.reference) ||
      (root && root.reference) ||
      (req.body && req.body.reference) ||
      null;

    if (reference) {
      markRefUsed(reference, { source: "webhook", payload: req.body });

      // Construir payload para Sheets:
      // - si tenemos registration guardada en memoria, usarla
      // - si no, construir mínimo desde webhook
      let payloadToSend = null;

      if (mem.registrations.has(String(reference))) {
        payloadToSend = Object.assign({}, mem.registrations.get(String(reference)));
        payloadToSend.status = payloadToSend.status || "paid";
        payloadToSend.paid = true;
      } else {
        payloadToSend = {
          reference,
          status: "paid",
          paid: true,
          amount_in_cents:
            (transaction && transaction.amount_in_cents) ||
            (transaction && transaction.amount) ||
            (transaction && transaction.value) ||
            null,
          currency: (transaction && transaction.currency) || "COP",
          customer_email:
            (transaction && transaction.customer_email) ||
            (transaction && transaction.email) ||
            (transaction && transaction.customer && transaction.customer.email) ||
            "",
          webhook: req.body,
        };
      }

      // Forward a Sheets como tu lógica original (action=create -> upsert)
      if (SHEET_WEBHOOK_URL) {
        try {
          const forwardBody = { action: "create", payload: payloadToSend };
          const fresult = await forwardToSheet(SHEET_WEBHOOK_URL, forwardBody);
          console.log(
            "Sheet create/update forwarded for reference:",
            reference,
            "result:",
            safeJson(fresult)
          );
        } catch (e) {
          console.warn("Failed to update sheet from webhook", e);
        }
      }
    }

    return res.status(200).json({ ok: true, verified, reference });
  } catch (err) {
    console.error("Error en webhook handler:", err);
    return res.status(500).json({ message: "Error interno", error: String(err) });
  }
});

// -----------------------------
// /api/generate-signature
// Mantiene: formatos + all + expiration + persist registrationPayload (en memoria)
// y forward a Sheets si está configurado.
// -----------------------------
app.post("/api/generate-signature", async (req, res) => {
  try {
    const {
      amount_in_cents,
      reference,
      currency = "COP",
      format,
      expiration_time,
      expirationTime,
      payload: registrationPayload,
    } = req.body || {};

    const expiration =
      expiration_time || expirationTime || EXPIRATION_TIME || "";

    if (!WOMPI_INTEGRITY_SECRET) {
      return res
        .status(400)
        .json({ message: "WOMPI_INTEGRITY_SECRET no configurado en el servidor" });
    }
    if (!amount_in_cents || !reference) {
      return res
        .status(400)
        .json({ message: "Faltan amount_in_cents o reference" });
    }

    const candidates = {
      // Standard: <reference><amount><currency><secret>
      "1": () =>
        `${String(reference)}${String(amount_in_cents)}${String(currency)}${String(
          WOMPI_INTEGRITY_SECRET
        )}`,
      // With expiration: <reference><amount><currency><expiration><secret>
      "2": () =>
        `${String(reference)}${String(amount_in_cents)}${String(currency)}${String(
          expiration
        )}${String(WOMPI_INTEGRITY_SECRET)}`,
      // legacy/debug
      "3": () => `${String(amount_in_cents)}|${String(currency)}|${String(reference)}`,
      "4": () =>
        `${String(amount_in_cents)}${String(currency)}${String(reference)}${String(
          WOMPI_INTEGRITY_SECRET
        )}`,
      "5": () =>
        JSON.stringify({
          amount_in_cents: String(amount_in_cents),
          currency: String(currency),
          reference: String(reference),
        }),
    };

    const computeAll = () => {
      const out = {};
      Object.keys(candidates).forEach((k) => {
        const payload = candidates[k]();
        const h = crypto.createHash("sha256").update(String(payload), "utf8").digest();
        out[k] = { hex: h.toString("hex"), b64: h.toString("base64"), payload };
      });
      return out;
    };

    if (format === "all") {
      return res.json({ signatures: computeAll() });
    }

    const fmtKey = String(format || "1");
    const payload = (candidates[fmtKey] || candidates["1"])();

    const buf = crypto.createHash("sha256").update(String(payload), "utf8").digest();

    // Persist registration payload en memoria + opcional forward a Sheets
    if (registrationPayload && reference) {
      const recordEntry = Object.assign(
        {
          reference: String(reference),
          recorded_at: new Date().toISOString(),
          status: "pending",
          paid: false,
        },
        registrationPayload || {}
      );

      mem.registrations.set(String(reference), recordEntry);

      if (SHEET_WEBHOOK_URL) {
        // fire-and-forget, no bloquea firma
        forwardToSheet(SHEET_WEBHOOK_URL, { action: "create", payload: recordEntry })
          .then((r) =>
            console.log(
              "[payment-server] forwarded registration (generate-signature) to sheet:",
              safeJson(r)
            )
          )
          .catch((e) =>
            console.warn("forwardToSheet error (generate-signature)", e)
          );
      }
    }

    return res.json({
      signature: buf.toString("hex"),
      signature_base64: buf.toString("base64"),
      payload,
    });
  } catch (err) {
    console.error("Error generando firma:", err);
    return res
      .status(500)
      .json({ message: "Error generando firma", error: String(err) });
  }
});

// Explicit OPTIONS for generate-signature
app.options("/api/generate-signature", (req, res) => {
  const origin = req.get("origin") || req.get("Origin");
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept, Origin"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  return res.sendStatus(204);
});

// Friendly GET for generate-signature
app.get("/api/generate-signature", (req, res) => {
  try {
    const amount = req.query.amount_in_cents || req.query.amount || req.query.amountInCents;
    const reference = req.query.reference || req.query.ref;
    const currency = req.query.currency || "COP";
    const format = req.query.format || "1";

    if (!amount || !reference) {
      return res.json({
        ok: false,
        message:
          "Use POST /api/generate-signature con JSON { amount_in_cents, reference } o pase amount_in_cents & reference por query",
      });
    }
    if (!WOMPI_INTEGRITY_SECRET) {
      return res
        .status(400)
        .json({ message: "WOMPI_INTEGRITY_SECRET no configurado en el servidor" });
    }

    const candidates = {
      "1": () => `${String(reference)}${String(amount)}${String(currency)}${String(WOMPI_INTEGRITY_SECRET)}`,
      "2": () => `${String(reference)}${String(amount)}${String(currency)}${String(EXPIRATION_TIME || "")}${String(WOMPI_INTEGRITY_SECRET)}`,
      "3": () => `${String(amount)}|${String(currency)}|${String(reference)}`,
      "4": () => `${String(amount)}${String(currency)}${String(reference)}${String(WOMPI_INTEGRITY_SECRET)}`,
      "5": () => JSON.stringify({ amount_in_cents: String(amount), currency: String(currency), reference: String(reference) }),
    };

    if (format === "all") {
      const out = {};
      Object.keys(candidates).forEach((k) => {
        const payload = candidates[k]();
        const h = crypto.createHash("sha256").update(String(payload), "utf8").digest();
        out[k] = { hex: h.toString("hex"), b64: h.toString("base64"), payload };
      });
      return res.json({ signatures: out });
    }

    const payload = (candidates[String(format)] || candidates["1"])();
    const buf = crypto.createHash("sha256").update(String(payload), "utf8").digest();
    return res.json({
      signature: buf.toString("hex"),
      signature_base64: buf.toString("base64"),
      payload,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// -----------------------------
// /api/send-to-sheet (proxy CORS)
// -----------------------------
app.post("/api/send-to-sheet", async (req, res) => {
  try {
    const sheetUrl = SHEET_WEBHOOK_URL || (req.body && req.body.sheet_url);
    if (!sheetUrl) return res.status(400).json({ message: "SHEET_WEBHOOK_URL not configured" });

    const forwardBody = req.body;
    console.log("[payment-server] forwarding to sheet webhook:", safeJson(forwardBody));

    const result = await forwardToSheet(sheetUrl, forwardBody);
    if (result && result.error) {
      return res.status(502).json({ ok: false, error: result.error, details: result.details || null });
    }
    return res.status(result && result.status ? result.status : 200).send(result && result.body ? result.body : JSON.stringify({ ok: true }));
  } catch (err) {
    console.error("Error proxying to sheet webhook:", err);
    return res.status(500).json({ message: "Error proxying to sheet", error: String(err) });
  }
});

// -----------------------------
// /api/save-registration
// Antes escribía a disco. Ahora guarda en memoria + opcional forward a Sheets.
// -----------------------------
app.post("/api/save-registration", async (req, res) => {
  try {
    const body = req.body || {};
    const payload = body.payload || body;

    const reference =
      payload.reference ||
      body.reference ||
      makeReference("REG");

    const recordEntry = Object.assign(
      { reference, recorded_at: new Date().toISOString(), status: "pending", paid: false },
      payload || {}
    );

    mem.registrations.set(String(reference), recordEntry);
    console.log("[payment-server] saved registration (mem) for reference:", reference);

    let forwardResult = null;
    const sheetUrl = SHEET_WEBHOOK_URL || body.sheet_url;
    if (sheetUrl) {
      const forwardBody = { action: "create", payload: recordEntry };
      forwardResult = await forwardToSheet(sheetUrl, forwardBody);
      console.log("[payment-server] forwarded registration to sheet:", safeJson(forwardResult));
    }

    return res.json({ ok: true, reference, forwarded: forwardResult });
  } catch (err) {
    console.error("save-registration error", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// -----------------------------
// Used reference status
// -----------------------------
app.get("/api/reference-status", (req, res) => {
  const reference = req.query.reference || req.query.ref;
  if (!reference) return res.status(400).json({ message: "Falta referencia" });
  const used = isRefUsed(reference);
  return res.json({ reference, used });
});

// -----------------------------
// /transaction-result (solo debug; en producción lo ideal es tu página en cPanel)
// -----------------------------
app.get("/transaction-result", (req, res) => {
  res.send(
    "<h3>Resultado de la transacción (debug)</h3><pre>" +
      safeJson(req.query) +
      "</pre>"
  );
});

// -----------------------------
// Debug helpers (equivalentes a tus endpoints)
// -----------------------------
app.get("/api/send-test-to-sheet", async (req, res) => {
  try {
    const sheetUrl = SHEET_WEBHOOK_URL;
    if (!sheetUrl) return res.status(400).json({ ok: false, error: "SHEET_WEBHOOK_URL not configured" });

    const testPayload = {
      action: "create",
      payload: {
        reference: `TEST-${Date.now()}`,
        acudiente: "Prueba Server",
        documento: "000",
        email: "test@local",
        colegio: "Test",
        curso: "NA",
        ciudad: "Bogotá",
        direccion: "Calle Test",
        telefono: "3000000000",
        carrito: [{ title: "Test Item", price: 1000 }],
      },
    };

    const r = await forwardToSheet(sheetUrl, testPayload);
    return res.json({ ok: true, result: r });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

app.get("/api/last-sheet-try", (req, res) => {
  if (!mem.lastSheetTry) return res.json({ ok: false, error: "no_log" });
  return res.json({ ok: true, log: mem.lastSheetTry });
});

// List persisted registrations (mem) + paid status from usedRefs (mem)
app.get("/api/registrations", (req, res) => {
  try {
    const out = Array.from(mem.registrations.values()).map((r) => {
      const ref = r.reference;
      return Object.assign({ paid: isRefUsed(ref) }, r);
    });
    return res.json({ ok: true, count: out.length, registrations: out });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post("/api/trigger-send", async (req, res) => {
  try {
    const reference =
      (req.body && (req.body.reference || req.body.ref)) ||
      req.query.reference ||
      req.query.ref;

    if (!reference) return res.status(400).json({ ok: false, error: "missing_reference" });

    const record = mem.registrations.get(String(reference));
    if (!record) return res.status(404).json({ ok: false, error: "not_found", reference });

    const sheetUrl = SHEET_WEBHOOK_URL;
    if (!sheetUrl) return res.status(400).json({ ok: false, error: "SHEET_WEBHOOK_URL not configured" });

    const forwardBody = { action: "create", payload: record };
    console.log("[payment-server] trigger-send for reference:", reference, "forwarding to sheet");
    const result = await forwardToSheet(sheetUrl, forwardBody);

    return res.json({ ok: true, result });
  } catch (err) {
    console.error("trigger-send error", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

app.get("/api/pending-registrations", (req, res) => {
  try {
    const pending = Array.from(mem.registrations.values()).filter((r) => !isRefUsed(r.reference));
    return res.json({ ok: true, count: pending.length, pending });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post("/api/resend-pending", async (req, res) => {
  try {
    const sheetUrl = SHEET_WEBHOOK_URL || (req.body && req.body.sheet_url);
    if (!sheetUrl) return res.status(400).json({ ok: false, error: "SHEET_WEBHOOK_URL not configured" });

    const toSend = Array.from(mem.registrations.values()).filter((r) => !isRefUsed(r.reference));
    const results = {};

    for (const rec of toSend) {
      try {
        const forwardBody = { action: "create", payload: rec };
        const r = await forwardToSheet(sheetUrl, forwardBody);
        results[rec.reference] = r;
      } catch (e) {
        results[rec.reference] = { error: String(e) };
      }
    }

    return res.json({ ok: true, attempted: toSend.length, results });
  } catch (err) {
    console.error("resend-pending error", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// -----------------------------
// Start
// -----------------------------
app.listen(PORT, () => {
  console.log(`payment-server corriendo en puerto ${PORT}`);
  console.log("REDIRECT_URL =", REDIRECT_URL);
  console.log("SHEET_WEBHOOK_URL =", SHEET_WEBHOOK_URL ? "(set)" : "(not set)");
  console.log("WOMPI_INTEGRITY_SECRET =", WOMPI_INTEGRITY_SECRET ? "(set)" : "(not set)");
  console.log("ALLOWED_ORIGINS =", ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(", ") : "(not set; reflecting origin)");
  console.log("PRIVATE_KEY =", PRIVATE_KEY ? "(set)" : "(not set; demo mode)");
});
