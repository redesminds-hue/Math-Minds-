const http = require('http');
const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function post(url, json) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const u = new URL(url);
    const body = JSON.stringify(json);
    const opts = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = lib.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  try {
    console.log('Testing GET /api/reference-status');
    const g = await get('http://localhost:3000/api/reference-status?reference=TEST-REQ');
    console.log('GET status:', g.status);
    console.log('GET body:', g.body);
  } catch (e) { console.error('GET error', e); }

  try {
    console.log('\nTesting POST /api/generate-signature');
    const p = await post('http://localhost:3000/api/generate-signature', { amount_in_cents: 100, reference: 'TEST-REQ' });
    console.log('POST status:', p.status);
    console.log('POST body:', p.body);
  } catch (e) { console.error('POST error', e); }
})();