const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
(async () => {
  try {
    const payload = fs.readFileSync(path.join(__dirname, 'test_payload.json'), 'utf8');
    console.log('Sending payload:', payload);
    const r = await fetch('http://localhost:3000/api/send-to-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    });
    const text = await r.text();
    console.log('Response status:', r.status);
    console.log('Response body:\n', text);
  } catch (e) {
    console.error('Error sending test:', e);
  }
})();
