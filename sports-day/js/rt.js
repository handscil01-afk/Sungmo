'use strict';
/* ===================== 실시간 중계 (무전기·음성 안내방송) =====================
   채널: 'radio'(진행요원 무전) · 'cast'(안내판 스피커 방송)
   lock: 지금 말하는 사람 한 명 (먼저 누른 사람)
   s/{시간순 키}: 잘게 자른 음성 { t:말하기 번호, u:보낸 기기, d:음성 }. 듣는 기기는 처음부터 이 줄을 계속 열어 두어,
   말을 시작할 때 새로 연결하느라 늦어지지 않게 함 */
const RT_ROOT = 'undonghoe5';
const LOCK_STALE_MS = 10000;
let RT = null, rtLoading = null;
function getRT(){
  if(RT) return Promise.resolve(RT);
  if(!rtLoading) rtLoading = (DEMO ? Promise.resolve(demoRT()) : firebaseRT()).then(x => (RT = x), e => { rtLoading = null; throw e; });
  return rtLoading;
}

async function firebaseRT(){
  const base = new URL('vendor/', document.baseURI).href;
  const R = await import(base+'firebase-database.js');
  const db = R.getDatabase(store.app, RTDB_URL);
  if(store.emu) R.connectDatabaseEmulator(db, '127.0.0.1', 9000);
  const r = p => R.ref(db, RT_ROOT+'/'+p);
  const st = { connected:false, offset:0 };
  R.onValue(R.ref(db, '.info/connected'), s => { st.connected = !!s.val(); radioRender(); });
  R.onValue(R.ref(db, '.info/serverTimeOffset'), s => { st.offset = s.val() || 0; });
  const lockData = d => ({ uid:d.uid, name:d.name, tid:d.tid, at:R.serverTimestamp() });
  const sent = {};   // 말하기 번호별로 보낸 조각의 키 (끝난 뒤 지우려고)
  return {
    mode:'firebase', st,
    async acquire(kind, d){
      const ref = r(kind+'/lock');
      try{
        const res = await R.runTransaction(ref, cur => {
          if(cur && cur.uid!==d.uid && (Date.now()+st.offset - (cur.at||0)) < LOCK_STALE_MS) return;   // 다른 사람이 말하는 중
          return lockData(d);
        }, { applyLocally:false });
        if(!res.committed) return { ok:false, lock:res.snapshot.val() };
        R.onDisconnect(ref).remove().catch(()=>{});
        return { ok:true };
      }catch(e){ return { ok:false, error:e }; }
    },
    refresh(kind, d){ return R.set(r(kind+'/lock'), lockData(d)).catch(()=>{}); },
    async release(kind){ const ref = r(kind+'/lock'); try{ await R.onDisconnect(ref).cancel(); await R.remove(ref); }catch(e){} },
    onLock(kind, cb, err){ return R.onValue(r(kind+'/lock'), s => cb(s.val()), err); },
    send(kind, tid, seq, d){
      const k = R.push(r(kind+'/s')).key;
      (sent[tid] ||= []).push(k);
      return R.set(r(`${kind}/s/${k}`), { t:tid, u:store.uid, d }).catch(()=>{});
    },
    // 가장 마지막 조각부터 계속 받음 (지난 조각은 받지 않음)
    onStream(kind, cb, err){ return R.onChildAdded(R.query(r(kind+'/s'), R.limitToLast(1)), s => cb(s.val() || {}), err); },
    dropTalk(kind, tid){
      const ks = sent[tid] || []; delete sent[tid]; if(!ks.length) return;
      const upd = {}; ks.forEach(k => { upd[k] = null; });
      return R.update(r(kind+'/s'), upd).catch(()=>{});
    },
    // 서버 규칙이 역할을 확인할 수 있도록 Firestore의 마스터·역할을 여기에도 옮겨 둠
    setMaster(uid, v){ return R.set(r('masters/'+uid), v); },
    onMaster(uid, cb){ return R.onValue(r('masters/'+uid), s => cb(s.exists()), () => cb(false)); },
    onMasters(cb){ return R.onValue(r('masters'), s => cb(s.val()||{}), () => {}); },
    setRole(uid, v){ return R.set(r('roles/'+uid), v); },
    onRoles(cb){ return R.onValue(r('roles'), s => cb(s.val()||{}), () => {}); },
  };
}

// 연습 모드: 같은 브라우저의 탭끼리 BroadcastChannel로 주고받음
function demoRT(){
  const KEY = 'udh5demo_rt', bc = ('BroadcastChannel' in window) ? new BroadcastChannel('udh5radio') : null;
  const state = () => ls.get(KEY, { locks:{} });
  const subs = { radio:new Set(), cast:new Set() }, streamSubs = new Set();
  const emit = kind => { const l = state().locks[kind] || null; subs[kind].forEach(cb => cb(l)); };
  const post = m => { try{ bc && bc.postMessage(m); }catch(e){} };
  if(bc) bc.onmessage = e => { const m = e.data;
    if(m.t==='lock') emit(m.kind);
    if(m.t==='chunk') streamSubs.forEach(s => { if(s.kind===m.kind) s.cb({ t:m.tid, u:m.u, d:m.d }); }); };
  const setLock = (kind, v) => { const s = state(); if(v) s.locks[kind] = v; else delete s.locks[kind]; ls.set(KEY, s); post({ t:'lock', kind }); emit(kind); };
  return {
    mode:'demo', st:{ connected:true, offset:0 },
    async acquire(kind, d){ const cur = state().locks[kind];
      if(cur && cur.uid!==d.uid && now()-cur.at < LOCK_STALE_MS) return { ok:false, lock:cur };
      setLock(kind, { uid:d.uid, name:d.name, tid:d.tid, at:now() }); return { ok:true }; },
    async refresh(kind, d){ setLock(kind, { uid:d.uid, name:d.name, tid:d.tid, at:now() }); },
    async release(kind){ setLock(kind, null); },
    onLock(kind, cb){ subs[kind].add(cb); setTimeout(() => cb(state().locks[kind] || null), 0); return () => subs[kind].delete(cb); },
    async send(kind, tid, seq, d){ post({ t:'chunk', kind, tid, u:store.uid, d }); },
    onStream(kind, cb){ const s = { kind, cb }; streamSubs.add(s); return () => streamSubs.delete(s); },
    async dropTalk(){},
    async setMaster(){}, onMaster(uid, cb){ setTimeout(() => cb(true), 0); return () => {}; }, onMasters(){ return () => {}; },
    async setRole(){}, onRoles(){ return () => {}; },
  };
}
