const CACHE = 'baseball-v71';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './css/app.css', './img/index.json', ...['bg-pitch', 'bg-field', 'pitcher', 'batter', 'catcher', 'fielder', 'banners', 'banners2', 'umpire', 'umpire-s', 'runner', 'tv', 'fielder2', 'runner-s', 'fielder-set', 'run-g', 'run-b', 'slide', 'run-f', 'run-k', 'cr-cage', 'cr-gym', 'cr-bullpen', 'cr-track', 'cr-room', 'cr-shop', 'cr-fansign', 'cr-rehab', 'cr-train', 'cr-life', 'cr-people', 'cr-props', 'icons', 'icons2'].map(n => './img/' + n + '.png'),
  './js/util.js', './js/data.js', './js/engine.js', './js/playsim.js', './js/timeline.js', './js/ai.js', './js/league.js', './js/speech.js', './js/caster.js', './js/shell.js', './js/ui.js', './js/gfx.js', './js/net.js', './js/voice.js', './js/game.js', './js/manager.js', './js/league-ui.js', './js/career-grow.js', './js/career.js', './js/career-life.js', './js/online.js', './js/app.js',
  './vendor/firebase-app.js', './vendor/firebase-auth.js', './vendor/firebase-database.js',
  ...['pitch', 'ball', 'strike', 'whiff-p', 'whiff-p2', 'whiff-n', 'whiff-n2', 'whiff-c', 'whiff-c2', 'bat1', 'bat2', 'bat3', 'bat-big', 'foul', 'hit', 'double', 'triple', 'homer', 'out', 'strikeout', 'change', 'batter', 'atbat', 'pitcher', 'mound', 'organ', 'crowd', 'cheer1', 'cheer2', 'hit-nb', 'double-nb', 'triple-nb', 'foul-nb', 'out-nb'].map(n => './sfx/' + n + '.mp3')];
// 중계 음성 조각은 voice/index.json에 적힌 것을 함께 저장 (없거나 실패해도 설치는 계속)
const VOICE = c => fetch('./voice/index.json').then(r => r.json()).then(j => {
  const names = (j.made || []).map(n => './voice/' + n + '.mp3');
  // 해설 스타일 녹음(voice/<스타일>/아이디[-번호].mp3)도 함께 저장
  Object.entries(j.styles || {}).forEach(([s, m]) => Object.entries(m).forEach(([id, n]) => { for(let k = 1; k <= n; k++) names.push(`./voice/${s}/${k === 1 ? id : id + '-' + k}.mp3`); }));
  return c.addAll(names.concat('./voice/index.json'));
}).catch(() => {});
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).then(() => VOICE(c))).then(() => self.skipWaiting())); });
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
