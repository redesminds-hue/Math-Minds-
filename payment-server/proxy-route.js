const express = require('express');
const router = express.Router();

// This route accepts the original Wompi transaction payload from the frontend
// and forwards it to /api/create-transaction on the same server. It's used
// by the ServiceWorker proxy to avoid the frontend calling Wompi directly.
router.post('/api/proxy-create-transaction', async (req, res, next) => {
	try {
		// Expect the frontend to send either { transaction: { ... } } or flat fields.
		const body = req.body || {};
		// Normalize: if body.transaction exists, use it; otherwise forward body
		let forward = body.transaction ? body.transaction : body;
		// If forward contains a `transaction` wrapper (double-wrapped), unwrap one level
		if (forward && forward.transaction) forward = forward.transaction;
		// Ensure common fields are present with expected names for /api/create-transaction
		// Map known Wompi keys to our server keys if necessary
		const normalized = {};
		if ('amount_in_cents' in forward) normalized.amount_in_cents = forward.amount_in_cents;
		if ('amountInCents' in forward) normalized.amount_in_cents = forward.amountInCents;
		if ('amount' in forward && !normalized.amount_in_cents) normalized.amount_in_cents = forward.amount;
		if ('currency' in forward) normalized.currency = forward.currency;
		if ('reference' in forward) normalized.reference = forward.reference;
		if ('customer_email' in forward) normalized.email = forward.customer_email;
		if ('email' in forward) normalized.email = forward.email;
		if ('full_name' in forward) normalized.full_name = forward.full_name;
		if ('public_key' in forward) normalized.public_key = forward.public_key;
		// If we found any normalized keys, merge them into forward (preserve originals)
		if (Object.keys(normalized).length) forward = Object.assign({}, forward, normalized);
		// Call the internal create-transaction logic by delegating to the existing endpoint
		// Forward as JSON with the fields our /api/create-transaction expects
		const fetch = require('node-fetch');
		const serverUrl = `http://127.0.0.1:${process.env.PORT || 3000}/api/create-transaction`;
		const r = await fetch(serverUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(forward)
		});
		const text = await r.text().catch(() => '');
		try { const json = JSON.parse(text); return res.status(r.status).json(json); } catch (e) { return res.status(r.status).send(text); }
	} catch (err) { next(err); }
});

module.exports = router;