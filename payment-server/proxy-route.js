++ const express = require('express');
++ const router = express.Router();
++
++ // This route accepts the original Wompi transaction payload from the frontend
++ // and forwards it to /api/create-transaction on the same server. It's used
++ // by the ServiceWorker proxy to avoid the frontend calling Wompi directly.
++ router.post('/api/proxy-create-transaction', async (req, res, next) => {
++   try {
++     // Expect the frontend to send either { transaction: { ... } } or flat fields.
++     const body = req.body || {};
++     // Normalize: if body.transaction exists, use it; otherwise forward body
++     const forward = body.transaction ? body.transaction : body;
++     // Call the internal create-transaction logic by delegating to the existing endpoint
++     // Forward as JSON with the fields our /api/create-transaction expects
++     const fetch = require('node-fetch');
++     const serverUrl = `http://localhost:${process.env.PORT || 3000}/api/create-transaction`;
++     const r = await fetch(serverUrl, {
++       method: 'POST',
++       headers: { 'Content-Type': 'application/json' },
++       body: JSON.stringify(forward)
++     });
++     const text = await r.text().catch(() => '');
++     try { const json = JSON.parse(text); return res.status(r.status).json(json); } catch (e) { return res.status(r.status).send(text); }
++   } catch (err) { next(err); }
++});
++
++ module.exports = router;