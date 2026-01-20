self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const url = (event.request && event.request.url) || '';
  // If the page attempts to POST directly to Wompi transactions, proxy to our backend instead
  if (/https?:\/\/(?:api|sandbox)\.wompi\.co\/v1\/transactions/.test(url) && event.request.method === 'POST') {
    event.respondWith((async () => {
        try {
          // try to read JSON body
          let reqBody = null;
          try {
            const clone = event.request.clone();
            reqBody = await clone.json();
          } catch (e) {
            // not JSON or failed; try text
            try { reqBody = await event.request.clone().text(); } catch (e2) { reqBody = null; }
          }
          // Debug: log intercepted request for easier diagnosis
          try {
            console.log('[wompi-sw] Intercepted Wompi POST to:', event.request.url, 'body:', reqBody);
          } catch (e) { /* ignore logging errors */ }

        // Prefer our local payment server proxy (avoid deriving from SW scope which may be the LiveServer origin)
        const preferredBackend = 'http://localhost:3000/api/proxy-create-transaction';
        const target = preferredBackend;

        let proxyResp;
        try {
          proxyResp = await fetch(target, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqBody)
          });
        } catch (proxyErr) {
          // Proxy to local backend failed (network error). Attempt fallback to direct network request
          try {
            console.warn('[wompi-sw] proxy to local backend failed, trying direct network request', proxyErr);
            const directResp = await fetch(event.request);
            return directResp;
          } catch (directErr) {
            console.warn('[wompi-sw] direct network attempt also failed', directErr);
            throw proxyErr; // let outer catch handle returning 502
          }
        }

        // Return backend response to the original caller
        const text = await proxyResp.text();
        const headers = new Headers(proxyResp.headers);
        // ensure CORS-friendly headers for responses forwarded from the backend
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        headers.set('Access-Control-Allow-Headers', '*');
        return new Response(text, { status: proxyResp.status, statusText: proxyResp.statusText, headers });
      } catch (err) {
        const body = JSON.stringify({ error: { type: 'SW_PROXY_ERROR', message: String(err) } });
        return new Response(body, { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
    })());
    return;
  }

  // Default: let the request go to network but handle network errors to avoid unhandled rejections
  event.respondWith((async () => {
    try {
      return await fetch(event.request);
    } catch (err) {
      // Return a safe JSON error response instead of letting the fetch fail silently in the SW
      try { console.warn('[wompi-sw] network fetch failed for', event.request.url, err); } catch (e) {}
      return new Response(JSON.stringify({ error: 'NETWORK_ERROR', message: String(err), url: event.request && event.request.url }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  })());
});
