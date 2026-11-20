const CACHE = 'voice-studio-v3';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './css/app.css', './js/cut.js', './js/wavzip.js', './js/app.js', './lines.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if(req.method !== 'GET') return;
  const url = new URL(req.url); if(url.origin !== location.origin) return;   // 구글 API 요청은 건드리지 않음
  // 인터넷이 되면 새 파일을, 안 되면 저장해 둔 파일을 씀
  e.respondWith(fetch(req).then(r => { if(r && r.ok){ const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; })
    .catch(() => caches.match(req).then(h => h || caches.match('./index.html'))));
});
