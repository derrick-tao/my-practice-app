// Service worker template. content-build/pwa-plugin.ts fills in PRECACHE at build time and writes the
// result to <site>/sw.js. Nothing here is hand-maintained per release:
//  - PRECACHE.urls is derived from the build output (app shell + content manifest + font subset + every list + every
//    audio file the lists reference), as paths relative to the worker's scope.
//  - PRECACHE.buildId is a hash of those files' contents, so any change to the app or the content gives
//    the worker (and its cache) a new identity. That is the cache busting.
//
// Behaviour:
//  - install: precache everything into a cache named for the build id. If any file fails, the install
//    fails and the previous worker keeps serving (no half-cached version). It does NOT skipWaiting: a new
//    worker waits until the page asks (the home screen's "New words are ready!" button) or until every
//    tab is closed, so a practice session is never swapped out from under the child.
//  - activate: drop caches of other builds and take control of open pages.
//  - fetch (same-origin GET only; nothing is ever fetched from another origin):
//      navigations      -> the cached app shell
//      content manifest -> network first (short timeout), cached copy when offline
//      anything else precached (assets, lists, audio, icons) -> cache first; files have hashed or
//                         build-scoped names, so a cached copy is always the right one for this build
//    Audio range requests (Safari always sends them) are answered with a 206 cut from the cached file.

/* eslint-disable no-undef */
const PRECACHE = /*PRECACHE*/ { buildId: 'dev', urls: [] };

const CACHE_PREFIX = 'practice-';
const CACHE = CACHE_PREFIX + PRECACHE.buildId;
const SHELL = 'index.html';
const MANIFEST = 'content/manifest.json';
const MANIFEST_TIMEOUT_MS = 4000;

const scopeUrl = (path) => new URL(path, self.registration.scope).href;
const relativeToScope = (url) => (url.startsWith(self.registration.scope) ? url.slice(self.registration.scope.length) : null);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(PRECACHE.urls.map((path) => new Request(scopeUrl(path), { cache: 'reload' }))),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith(CACHE_PREFIX) && name !== CACHE) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    if (relativeToScope(request.url) !== null) event.respondWith(fromCache(scopeUrl(SHELL), request));
    return;
  }
  const path = relativeToScope(url.origin + url.pathname);
  if (path === null) return;
  if (path === MANIFEST) {
    event.respondWith(networkFirst(request, scopeUrl(MANIFEST)));
  } else if (PRECACHE.urls.includes(path)) {
    event.respondWith(fromCache(scopeUrl(path), request));
  }
});

async function fromCache(key, request) {
  const cached = await caches.match(key, { cacheName: CACHE });
  if (!cached) return fetch(request);
  return request.headers.has('range') ? rangeOf(cached, request.headers.get('range')) : cached;
}

async function networkFirst(request, key) {
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), MANIFEST_TIMEOUT_MS)),
    ]);
    if (response.ok) return response;
  } catch {
    // Offline or too slow: fall back to the copy cached with this build.
  }
  return (await caches.match(key, { cacheName: CACHE })) || fetch(request);
}

/** Answer a `Range: bytes=a-b` request from a complete cached response. */
async function rangeOf(response, header) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!match || (match[1] === '' && match[2] === '')) return response;
  const bytes = await response.clone().arrayBuffer();
  const size = bytes.byteLength;
  let start;
  let end;
  if (match[1] === '') {
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(bytes.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
    },
  });
}
