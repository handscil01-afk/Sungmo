/* 오프라인 실행: 한 번 열어 둔 게임은 인터넷이 없어도 열립니다.
   화면 파일은 인터넷이 되면 새 버전을, 안 되면 저장해 둔 버전을 씁니다. */
const CACHE='biblemarble-v10';
const CORE=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./css/game.css','./vendor/peerjs.min.js',
  './js/util.js','./js/xlsx-lite.js','./js/data/boards.js','./js/data/quiz.js','./js/data/cards.js','./js/content.js','./js/bible.js',
  './js/engine.js','./js/ai.js','./js/ui/board.js','./js/ui/prompts.js','./js/ui/photo.js','./js/ui/home.js','./js/ui/manage.js','./js/firebase-config.js','./js/fb.js','./js/net.js','./vendor/firebase-app-compat.js','./vendor/firebase-auth-compat.js','./vendor/firebase-database-compat.js','./js/app.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('biblemarble-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET')return;const url=new URL(req.url);
  const same=url.origin===location.origin,font=/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);if(!same&&!font)return;
  /* 같은 사이트 파일: 네트워크 먼저(최신 버전), 실패하면 저장본 */
  if(same){e.respondWith(fetch(req).then(r=>{if(r&&r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return r})
    .catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||(req.mode==='navigate'?caches.match('./index.html'):undefined))));return}
  /* 글꼴: 저장본 먼저 */
  e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{if(r&&(r.ok||r.type==='opaque')){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return r})))});
