'use strict';
/* ===================== 저장소 (Firebase Realtime Database) =====================
   경로는 ROOT(goldenbell1) 아래 기준: 'live' · 'questions' · 'seats' · 'banner' · 'bannerimg' · 'favs'
   'marks/<문제~사람>' · 'devices/<기기>' · 'msgs' · 'radio' · 'masters/<기기>' · 'staffs/<기기>' · 'secret/staffPw'
   누가 무엇을 쓰고 읽는지는 서버 규칙(sports-day/database.rules.json 의 goldenbell1)이 기기마다 확인함:
   진행자(masters)만 진행·문제·명단을 바꾸고, 직원(staffs)은 자기 이름으로 정답 체크·무전만 함.
   문제(정답 포함)와 무전은 진행자·직원 기기만 읽음 */
const LOCK_STALE_MS = 10000;
let DB = null;

async function firebaseDB(){
  const base = new URL('vendor/', document.baseURI).href;
  const A = await import(base + 'firebase-app.js');
  const [AU, R] = await Promise.all([import(base + 'firebase-auth.js'), import(base + 'firebase-database.js')]);
  const app = A.initializeApp(FIREBASE_CONFIG);
  const auth = AU.getAuth(app);
  // 익명 로그인: 기기(브라우저)마다 고유한 번호가 생기고, 서버 규칙이 이 번호로 역할을 확인함
  const user = await new Promise((res, rej) => {
    const off = AU.onAuthStateChanged(auth, u => {
      if(u){ off(); res(u); }
      else AU.signInAnonymously(auth).catch(e => { off(); rej(e); });
    }, rej);
  });
  const db = R.getDatabase(app, RTDB_URL);
  const r = p => R.ref(db, ROOT + (p ? '/' + p : ''));
  const st = { connected:false, offset:0 };
  R.onValue(R.ref(db, '.info/connected'), s => { st.connected = !!s.val(); onNetChange(); });
  R.onValue(R.ref(db, '.info/serverTimeOffset'), s => { st.offset = s.val() || 0; });
  const lockData = d => ({ uid:d.uid, name:d.name, tid:d.tid, at:R.serverTimestamp() });
  const sent = {};
  return {
    mode:'firebase', uid:user.uid, st,
    srvNow: () => Date.now() + st.offset,
    on(p, cb, err){ return R.onValue(r(p), s => cb(s.val()), e => { if(err) err(e); }); },
    onLast(p, n, cb, err){ return R.onValue(R.query(r(p), R.limitToLast(n)), s => { const l = []; s.forEach(c => { l.push({ id:c.key, ...c.val() }); }); cb(l); }, e => { if(err) err(e); }); },
    set: (p, v) => R.set(r(p), v),
    update: (p, o) => R.update(r(p), o),
    remove: p => R.remove(r(p)),
    push: (p, v) => R.set(R.push(r(p)), v),
    async presence(v){ const ref = r('devices/' + user.uid); try{ await R.onDisconnect(ref).remove(); }catch(e){} return R.set(ref, v); },
    // ----- 무전 (가을운동회 점수판 js/rt.js 와 같은 방식) -----
    async acquire(d){
      const ref = r('radio/lock');
      try{
        const res = await R.runTransaction(ref, cur => {
          if(cur && cur.uid !== d.uid && (Date.now() + st.offset - (cur.at || 0)) < LOCK_STALE_MS) return;
          return lockData(d);
        }, { applyLocally:false });
        if(!res.committed) return { ok:false, lock:res.snapshot.val() };
        R.onDisconnect(ref).remove().catch(() => {});
        return { ok:true };
      }catch(e){ return { ok:false, error:e }; }
    },
    refresh(d){ return R.runTransaction(r('radio/lock'), cur => (cur && cur.uid === d.uid) ? lockData(d) : undefined, { applyLocally:false }).catch(() => {}); },
    async release(){ const ref = r('radio/lock'); try{ await R.onDisconnect(ref).cancel(); await R.remove(ref); }catch(e){} },
    forceRelease(){ return R.remove(r('radio/lock')); },
    onLock(cb, err){ return R.onValue(r('radio/lock'), s => cb(s.val()), e => { if(err) err(e); }); },
    send(tid, d){
      const k = R.push(r('radio/s')).key;
      (sent[tid] ||= []).push(k);
      return R.set(r('radio/s/' + k), { t:tid, u:user.uid, d }).catch(() => {});
    },
    onStream(cb, err){ return R.onChildAdded(R.query(r('radio/s'), R.limitToLast(1)), s => cb(s.val() || {}), e => { if(err) err(e); }); },
    dropTalk(tid){
      const ks = sent[tid] || []; delete sent[tid]; if(!ks.length) return;
      const upd = {}; ks.forEach(k => { upd[k] = null; });
      return R.update(r('radio/s'), upd).catch(() => {});
    },
  };
}

/* 연습 모드: 이 브라우저(localStorage)에만 저장. 탭마다 다른 기기처럼 동작하고, 탭끼리는 바로 반영됨 */
function demoDB(){
  const KEY = 'gb1demo_tree';
  const read = () => { try{ return JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){ return {}; } };
  let tree = read();
  let myUid = ss.get('demo_uid'); if(!myUid){ myUid = 'd' + uid(); ss.set('demo_uid', myUid); }
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
  const sub = (fn) => { const s = { last:undefined, run(){ const v = JSON.stringify(fn.get()); if(v !== s.last){ s.last = v; fn.cb(JSON.parse(v)); } } }; subs.add(s); setTimeout(() => s.run(), 0); return () => subs.delete(s); };
  // 무전: 같은 브라우저의 탭끼리 BroadcastChannel로 주고받음
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('gb1radio') : null;
  const streamSubs = new Set();
  if(bc) bc.onmessage = e => { const m = e.data; if(m && m.t === 'chunk') streamSubs.forEach(cb => cb({ t:m.tid, u:m.u, d:m.d })); };
  const st = { connected:true, offset:0 };
  return {
    mode:'demo', uid:myUid, st,
    srvNow: () => Date.now(),
    on(p, cb){ return sub({ get:() => get(p), cb }); },
    onLast(p, n, cb){ return sub({ get:() => { const o = get(p) || {}; return Object.keys(o).sort().slice(-n).map(k => ({ id:k, ...o[k] })); }, cb }); },
    async set(p, v){
      if(DEMO_GATE(p, v)) throw { code:'PERMISSION_DENIED' };
      put(p, v); save();
    },
    async update(p, o){ for(const [k, v] of Object.entries(o)) put(parts(p).concat(parts(k)).join('/'), v); save(); },
    async remove(p){ put(p, null); save(); },
    async push(p, v){ put(p + '/' + Date.now().toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 5), v); save(); },
    async presence(v){ put('devices/' + myUid, v); save(); addEventListener('pagehide', () => { put('devices/' + myUid, null); try{ localStorage.setItem(KEY, JSON.stringify(tree)); }catch(e){} }); },
    async acquire(d){ const cur = get('radio/lock'); if(cur && cur.uid !== d.uid && Date.now() - cur.at < LOCK_STALE_MS) return { ok:false, lock:cur }; put('radio/lock', { ...d, at:Date.now() }); save(); return { ok:true }; },
    async refresh(d){ const cur = get('radio/lock'); if(cur && cur.uid === d.uid){ put('radio/lock', { ...d, at:Date.now() }); save(); } },
    async release(){ put('radio/lock', null); save(); },
    async forceRelease(){ put('radio/lock', null); save(); },
    onLock(cb){ return sub({ get:() => get('radio/lock'), cb }); },
    async send(tid, d){ try{ bc && bc.postMessage({ t:'chunk', tid, u:myUid, d }); }catch(e){} },
    onStream(cb){ streamSubs.add(cb); return () => streamSubs.delete(cb); },
    async dropTalk(){},
  };
}
// 연습 모드에서도 비밀번호는 확인함 (0000)
function DEMO_GATE(p, v){
  if(/^masters\//.test(p)) return v != null && v !== DEMO_PW;
  if(/^staffs\//.test(p)) return v != null && v.pw != null && v.pw !== DEMO_PW;
  return false;
}
const isDenied = e => !!e && /permission.denied/i.test(String(e.code || '') + ' ' + String(e.message || ''));
