const CACHE = 'sports-day-v18';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './roger.wav',
  './css/app.css',
  './js/config.js', './js/util.js', './js/store.js', './js/data.js', './js/shell.js',
  './js/view-referee.js', './js/view-coach.js', './js/view-board.js', './js/speech.js', './js/board-pc.js', './js/rt.js', './js/radio.js', './js/notify.js', './js/view-staff.js', './js/view-report.js', './js/view-master.js', './js/view-events.js', './js/view-queue.js', './js/view-target.js', './js/view-progress.js', './js/view-voice.js', './js/powersave.js', './js/app.js',
  './vendor/firebase-app.js', './vendor/firebase-firestore.js', './vendor/firebase-auth.js', './vendor/firebase-database.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 앱 화면은 인터넷이 되면 항상 새 버전을, 안 되면 저장해 둔 버전을 씀
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return r; })
      .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  // 앱 파일(css·js)은 인터넷이 되면 새 파일을 먼저 받고, 안 되면 저장해 둔 파일을 씀 (화면과 버전이 어긋나지 않게)
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(r => { if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true })));
  }
});
