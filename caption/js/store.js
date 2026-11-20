'use strict';
/* ===================== 저장소 (Firebase Realtime Database) =====================
   경로는 ROOT(caption1) 아래 기준
   lobby/<방>            처음 화면 방 목록 { title, at }
   rooms/<방>/meta       { host, title, at, open }   방장 기기만 씀
   rooms/<방>/secret     { pin }                     교대 입력 비밀번호 (방장만 읽음)
   rooms/<방>/typers/<기기>  입력할 수 있는 기기 { name, pin }
   rooms/<방>/lines/<줄>     다 친 줄 { t, at, by }   입력 기기만 씀, 누구나 읽음
   rooms/<방>/drafts/<기기>  지금 치는 줄 { t, at }
   rooms/<방>/readers/<기기> 읽는 기기 { at }
   누가 쓰고 읽는지는 서버 규칙(sports-day/database.rules.json 의 caption1)이 기기마다 확인함 */
let DB = null;

async function firebaseDB(){
  const base = new URL('vendor/', document.baseURI).href;
  const A = await import(base + 'firebase-app.js');
  const [AU, R] = await Promise.all([import(base + 'firebase-auth.js'), import(base + 'firebase-database.js')]);
  const app = A.initializeApp(FIREBASE_CONFIG);
  const auth = AU.getAuth(app);
  if(EMU) AU.connectAuthEmulator(auth, 'http://' + location.hostname + ':9099', { disableWarnings:true });
  // 익명 로그인: 기기(브라우저)마다 고유한 번호가 생기고, 서버 규칙이 이 번호로 입력 권한을 확인함
  const user = await new Promise((res, rej) => {
    const off = AU.onAuthStateChanged(auth, u => {
      if(u){ off(); res(u); }
      else AU.signInAnonymously(auth).catch(e => { off(); rej(e); });
    }, rej);
  });
  const db = R.getDatabase(app, RTDB_URL);
  if(EMU) R.connectDatabaseEmulator(db, location.hostname, 9000);
  const r = p => R.ref(db, ROOT + (p ? '/' + p : ''));
  const st = { connected:false, offset:0 };
  const pres = new Map();   // 연결이 끊겼다 다시 붙으면 다시 등록할 "접속 중" 표시
  const putPresence = (p, v) => { R.onDisconnect(r(p)).remove().catch(() => {}); R.set(r(p), v()).catch(() => {}); };
  R.onValue(R.ref(db, '.info/connected'), s => {
    st.connected = !!s.val();
    if(st.connected) pres.forEach((v, p) => putPresence(p, v));
    onNetChange();
  });
  R.onValue(R.ref(db, '.info/serverTimeOffset'), s => { st.offset = s.val() || 0; });
  return {
    mode:'firebase', uid:user.uid, st,
    now: () => Date.now() + st.offset,
    ts: () => R.serverTimestamp(),
    on(p, cb, err){ return R.onValue(r(p), s => cb(s.val()), e => { if(err) err(e); }); },
    get: p => R.get(r(p)).then(s => s.val()),
    set: (p, v) => R.set(r(p), v),
    update: (p, o) => R.update(r(p), o),
    remove: p => R.remove(r(p)),
    key: p => R.push(r(p)).key,
    discRemove(p){ return R.onDisconnect(r(p)).remove().catch(() => {}); },
    presence(p, v){ pres.set(p, v); putPresence(p, v); return () => { pres.delete(p); R.onDisconnect(r(p)).cancel().catch(() => {}); R.remove(r(p)).catch(() => {}); }; },
  };
}

/* 연습 모드: 이 브라우저(localStorage)에만 저장. 탭마다 다른 기기처럼 동작하고, 탭끼리는 바로 반영됨 */
function demoDB(){
  const KEY = 'cap1demo_tree';
  const read = () => { try{ return JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){ return {}; } };
  let tree = read();
  let myUid = ss.get('demo_uid'); if(!myUid){ myUid = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); ss.set('demo_uid', myUid); }
  const parts = p => String(p || '').split('/').filter(Boolean);
  const get = p => { let o = tree; for(const k of parts(p)){ if(o == null || typeof o !== 'object') return null; o = o[k]; } return o === undefined ? null : clone(o); };
  const put = (p, v) => {
    const ks = parts(p); if(!ks.length){ tree = v ? clone(v) : {}; return; }
    let o = tree;
    for(let i = 0; i < ks.length - 1; i++){ if(o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; }
    if(v == null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = clone(v);
  };
  const subs = new Set();
  const fire = () => setTimeout(() => subs.forEach(s => s.run()), 0);
  const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(tree)); }catch(e){} fire(); };
  addEventListener('storage', e => { if(e.key === KEY){ tree = read(); fire(); } });
  const sub = (p, cb) => { const s = { last:undefined, run(){ const v = JSON.stringify(get(p)); if(v !== s.last){ s.last = v; cb(JSON.parse(v)); } } }; subs.add(s); setTimeout(() => s.run(), 0); return () => subs.delete(s); };
  let seq = 0;
  const gone = [];
  addEventListener('pagehide', () => { gone.forEach(p => put(p, null)); try{ localStorage.setItem(KEY, JSON.stringify(tree)); }catch(e){} });
  setTimeout(onNetChange, 0);
  return {
    mode:'demo', uid:myUid, st:{ connected:true, offset:0 },
    now: () => Date.now(),
    ts: () => Date.now(),
    on: (p, cb) => sub(p, cb),
    get: async p => get(p),
    async set(p, v){ put(p, v); save(); },
    async update(p, o){ for(const [k, v] of Object.entries(o)) put(parts(p).concat(parts(k)).join('/'), v); save(); },
    async remove(p){ put(p, null); save(); },
    key: () => Date.now().toString(36).padStart(9, '0') + String(seq++).padStart(4, '0') + myUid.slice(-3),
    discRemove(p){ gone.push(p); },
    presence(p, v){ put(p, v()); save(); gone.push(p); return () => { put(p, null); save(); }; },
  };
}
const isDenied = e => !!e && /permission.denied/i.test(String(e.code || '') + ' ' + String(e.message || ''));
function onNetChange(){
  const c = DB && DB.st.connected;
  $$('.net').forEach(p => { p.textContent = !DB ? '연결하는 중' : DB.mode === 'demo' ? '연습 모드' : c ? '연결됨' : '연결 끊김'; p.className = 'pill net ' + (!DB ? 'warn' : c ? 'ok' : 'bad'); });
  if(typeof readerNet === 'function') readerNet(c);
}
