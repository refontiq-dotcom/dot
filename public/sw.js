/* Service worker du site Dot : garde le programme et les informations disponibles sans réseau.
 *
 * Règles de sécurité :
 *  - seules les requêtes GET sont mémorisées ;
 *  - jamais /api/ (réponses des invités) ni /admin ;
 *  - côté Supabase, seul le contenu public du site est mémorisé (site_content, program_items, faq_items),
 *    et jamais lorsqu'il est demandé depuis l'espace organisateurs.
 * Pour forcer une mise à jour du cache chez tous les invités, changer VERSION.
 */
const VERSION = 'dot-v1';
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
const DATA = `${VERSION}-data`;
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
const PUBLIC_DATA = /\/rest\/v1\/(site_content|program_items|faq_items)(\?|$)/;
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => !key.startsWith(VERSION)).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

/** Réseau d'abord ; si le réseau est absent ou lent, on sert la dernière copie connue. */
async function networkFirst(request, cacheName, fallbackKey) {
  const cache = await caches.open(cacheName);
  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    if (response && response.ok) cache.put(fallbackKey || request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(fallbackKey || request, { ignoreSearch: false });
    if (cached) return cached;
    // Dernier recours : laisser la requête aller au bout du réseau (sans limite de temps).
    try { return await fetch(request); } catch (finalError) { return Response.error(); }
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(response => {
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || refresh;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Contenu public lu dans Supabase (programme, textes, FAQ).
  if (url.hostname.endsWith('.supabase.co')) {
    if (!PUBLIC_DATA.test(url.pathname + url.search)) return;
    try {
      if (request.referrer && new URL(request.referrer).pathname.startsWith('/admin')) return;
    } catch (error) { /* référent illisible : on continue */ }
    event.respondWith(networkFirst(request, DATA));
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request, STATIC));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL, '/'));
    return;
  }

  if (/\.(?:jpe?g|png|webp|svg|ico|woff2?)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, STATIC));
  }
});
