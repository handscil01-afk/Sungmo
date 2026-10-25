'use strict';
/* ===================== 저장소 =====================
   경로는 ROOT 아래 기준 배열: ['config'] 는 문서, ['main','indiv'] 는 모음, ['main','indiv',id] 는 문서 */

async function firebaseStore(){
  const base = new URL('vendor/', document.baseURI).href;
  const A = await import(base+'firebase-app.js');
  const [F, AU] = await Promise.all([import(base+'firebase-firestore.js'), import(base+'firebase-auth.js')]);
  const app = A.initializeApp(FIREBASE_CONFIG);
  const auth = AU.getAuth(app);
  // 개발용: 주소에 ?emu=1 이 있으면 이 컴퓨터의 파이어베이스 에뮬레이터에 연결
  const EMU = new URLSearchParams(location.search).has('emu') && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if(EMU) AU.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings:true });
  // 익명 로그인: 기기마다 고유한 번호(uid)가 생기고, 서버 규칙이 이 번호로 역할을 확인함
  const user = await new Promise((res, rej) => {
    const off = AU.onAuthStateChanged(auth, u => {
      if(u){ off(); res(u); }
      else AU.signInAnonymously(auth).catch(e => { off(); rej(e); });
    }, rej);
  });
  let db;
  try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
  catch(e){ db = F.getFirestore(app); }
  if(EMU) F.connectFirestoreEmulator(db, '127.0.0.1', 8181);
  return {
    mode:'firebase', uid:user.uid, app, emu:EMU,
    onDoc(p, cb, err){ return F.onSnapshot(F.doc(db, ROOT, ...p), {includeMetadataChanges:true},
      s => cb(s.exists() ? s.data() : null, s.metadata.hasPendingWrites), err); },
    onCol(p, cb, err){ return F.onSnapshot(F.collection(db, ROOT, ...p), {includeMetadataChanges:true}, s => {
      const list=[]; let n=0;
      s.forEach(d => { list.push({ id:d.id, ...d.data() }); if(d.metadata.hasPendingWrites) n++; });
      cb(list, n);
    }, err); },
    // 조건에 맞는 문서만 구독 (예: 최근 15분 동안의 문자 무전)
    onQuery(p, field, op, value, cb, err){ return F.onSnapshot(F.query(F.collection(db, ROOT, ...p), F.where(field, op, value)), s => {
      const list=[]; s.forEach(d => list.push({ id:d.id, ...d.data() })); cb(list, 0);
    }, err); },
    put(p, obj, merge=true){ return F.setDoc(F.doc(db, ROOT, ...p), obj, { merge }); },
    del(p){ return F.deleteDoc(F.doc(db, ROOT, ...p)); },
  };
}

function deepMerge(a, b){
  const out = (a && typeof a==='object' && !Array.isArray(a)) ? {...a} : {};
  for(const k in b){
    const v=b[k];
    out[k] = (v && typeof v==='object' && !Array.isArray(v)) ? deepMerge(out[k], v) : v;
  }
  return out;
}

// 연습 모드: 이 기기(브라우저)에만 저장. 같은 브라우저의 다른 탭끼리는 서로 반영됨
function demoStore(){
  const KEY = 'udh5demo2';
  let docs = ls.get(KEY, {});
  let myUid = idStore.get('udh5_demo_uid', null);
  if(!myUid){ myUid = 'd'+uid(); idStore.set('udh5_demo_uid', myUid); }
  const subs = new Set();
  const key = p => p.join('/');
  const clone = v => JSON.parse(JSON.stringify(v));
  const fire = s => {
    if(s.kind==='doc'){ s.cb(docs[s.key] ? clone(docs[s.key]) : null, false); return; }
    const pre = s.key+'/';
    s.cb(Object.keys(docs).filter(k => k.startsWith(pre) && !k.slice(pre.length).includes('/'))
      .map(k => ({ id:k.slice(pre.length), ...clone(docs[k]) })), 0);
  };
  const emitAll = () => setTimeout(() => subs.forEach(fire), 0);
  const save = () => { ls.set(KEY, docs); emitAll(); };
  window.addEventListener('storage', e => { if(e.key===KEY){ docs = ls.get(KEY, {}); emitAll(); } });
  const sub = (kind, p, cb) => { const s={ kind, key:key(p), cb }; subs.add(s); setTimeout(() => fire(s), 0); return () => subs.delete(s); };
  return {
    mode:'demo', uid:myUid,
    onDoc(p, cb){ return sub('doc', p, cb); },
    onCol(p, cb){ return sub('col', p, cb); },
    onQuery(p, field, op, value, cb){ return sub('col', p, (l, n) => cb(l.filter(x => op==='>' ? x[field] > value : x[field]===value), n)); },
    put(p, obj, merge=true){
      // 서버 규칙 흉내: 마스터가 아니면 비밀번호가 맞아야 마스터 문서를 만들 수 있음
      if(p[1]==='masters' && !docs['main/masters/'+myUid] && obj.pw!==DEMO_MASTER_PW)
        return Promise.reject({ code:'permission-denied' });
      const k = key(p);
      docs[k] = merge ? deepMerge(docs[k]||{}, obj) : clone(obj);
      save(); return Promise.resolve();
    },
    del(p){ delete docs[key(p)]; save(); return Promise.resolve(); },
    reset(){ docs = {}; save(); },
  };
}
