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

        // Build a request to our local backend endpoint
        const backendUrl = self.registration.scope.replace(/\/$/, '') + '/api/proxy-create-transaction';
        // If scope resolution doesn't yield a full origin, fallback to localhost:3000
        const fallbackBackend = 'http://localhost:3000/api/create-transaction';
        const target = backendUrl.startsWith('http') ? backendUrl : fallbackBackend;

        const proxyResp = await fetch(target, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody)
        });

        // Return backend response to the original caller
        const text = await proxyResp.text();
        const headers = new Headers(proxyResp.headers);
        // ensure CORS-friendly headers
        headers.set('Access-Control-Allow-Origin', '*');
        return new Response(text, { status: proxyResp.status, statusText: proxyResp.statusText, headers });
      } catch (err) {
        const body = JSON.stringify({ error: { type: 'SW_PROXY_ERROR', message: String(err) } });
        return new Response(body, { status: 502, headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // Default: let the request go to network
  event.respondWith(fetch(event.request));
});
