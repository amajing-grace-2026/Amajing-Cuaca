// Amajing Cuaca service worker — ganti CACHE_NAME setiap rilis
const CACHE_NAME = 'amajing-cuaca-v3';
const SHELL = [
  './', './index.html', './style.css', './app.js', './compat.js', './panduan.html', './manifest.json',
  './brand/ikon.svg', './brand/ikon-192.png', './brand/ikon-512.png',
  './brand/ikon-maskable-192.png', './brand/ikon-maskable-512.png', './brand/apple-touch-icon.png', './brand/logo-kecil-gelap.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// File aplikasi: langsung dari cache (buka instan), sambil mengambil versi terbaru di latar
// untuk pembukaan berikutnya. Data cuaca (domain lain) tidak lewat sini — disimpan oleh aplikasi.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request)
      .then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; })
      .catch(() => hit || cache.match('./index.html'));
    if (hit) { e.waitUntil(net.catch(() => null)); return hit; }
    return net;
  }));
});
