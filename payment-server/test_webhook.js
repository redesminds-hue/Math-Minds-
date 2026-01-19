const crypto = require('crypto');
const fetch = globalThis.fetch || require('node-fetch');

(async function(){
  try{
    const body = { test: 'ok' };
    const raw = JSON.stringify(body);
    const secret = 'test_integrity_mpvUPXfMjUOSUitvy9pHLPEvRWPnCtA2';
    const sig = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
    console.log('Computed signature:', sig);
    const r = await fetch('http://localhost:3000/api/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-wompi-signature': sig },
      body: raw
    });
    const t = await r.text();
    console.log('Status:', r.status);
    console.log('Response:', t);
  }catch(e){ console.error('Error in test_webhook:', e); process.exit(1); }
})();
