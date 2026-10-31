const CACHE = 'baseball-v10';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './css/app.css', './img/index.json',
  './js/util.js', './js/data.js', './js/engine.js', './js/ai.js', './js/league.js', './js/speech.js', './js/shell.js', './js/ui.js', './js/gfx.js', './js/net.js', './js/voice.js', './js/game.js', './js/manager.js', './js/league-ui.js', './js/career.js', './js/online.js', './js/app.js',
  './vendor/firebase-app.js', './vendor/firebase-auth.js', './vendor/firebase-database.js',
  ...['pitch', 'ball', 'strike', 'whiff-p', 'whiff-p2', 'whiff-n', 'whiff-n2', 'whiff-c', 'whiff-c2', 'bat1', 'bat2', 'bat3', 'bat-big', 'foul', 'hit', 'double', 'triple', 'homer', 'out', 'strikeout', 'change', 'batter', 'atbat', 'pitcher', 'mound', 'organ', 'crowd'].map(n => './sfx/' + n + '.mp3')];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if(req.method !== 'GET') return;
  const url = new URL(req.url);
  // 앱 화면은 인터넷이 되면 항상 새 버전을, 안 되면 저장해 둔 버전을 씀
  if(req.mode === 'navigate'){
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return r; })
      .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  // 앱 파일(css·js)도 새 파일을 먼저 받고, 안 되면 저장해 둔 파일을 씀 (화면과 버전이 어긋나지 않게)
  if(url.origin === location.origin){
    e.respondWith(fetch(req).then(r => { if(r && r.ok){ const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch:true })));
  }
});
