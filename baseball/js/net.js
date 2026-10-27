'use strict';
/* ===================== 온라인 대전: 연결과 방 =====================
   Firebase Realtime Database(운동회 앱과 같은 handscil-sports 프로젝트)의 baseball/rooms/{방 코드 4자리} 아래에 둠.
   - host·guest: 방장·손님 { uid, name, at }        - cfg: 경기 설정 (방장이 씀)
   - state: 경기 상태 (방장 기기가 계산해서 씀. 난수 씨앗과 긴 기록은 빼고, 최근 기록 40줄만 붙임)
   - act: 손님의 선택·작전 (손님만 쓰고 방장만 읽음 → 손님이 고른 공은 방장 기기 말고는 아무도 못 봄)
   - chat: 문자 채팅 · sig/{host|guest}: 음성 통화 연결 신호 · hb: 접속 표시
   방장이 고른 공은 서버에 올리지 않고 방장 기기 안에서만 계산에 씀.
   서버 규칙은 sports-day/database.rules.json 안의 "baseball" 부분 */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDihHD0cldHyY0MWViA_R0yb-nkIoJ_-4I",
  authDomain: "handscil-sports.firebaseapp.com",
  projectId: "handscil-sports",
  storageBucket: "handscil-sports.firebasestorage.app",
  messagingSenderId: "431367162993",
  appId: "1:431367162993:web:fa488b8e5d0acc98ffdfd0"
};
const RTDB_URL = 'https://handscil-sports-default-rtdb.asia-southeast1.firebasedatabase.app';
const NET_ROOT = 'baseball/rooms/';
// 직접 연결이 안 되는 통신망(일부 LTE)을 위한 중계 서버(TURN)를 쓰려면 여기에 넣음. 예: { urls:'turn:…', username:'…', credential:'…' }
const TURN_SERVERS = [];
// 개발용: 주소에 ?emu=1 이 있으면 이 컴퓨터의 Firebase 에뮬레이터에 연결
const EMU = new URLSearchParams(location.search).has('emu') && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

let FB = null, fbLoading = null;
function fbInit(){
  if(FB) return Promise.resolve(FB);
  if(fbLoading) return fbLoading;
  fbLoading = (async () => {
    const base = new URL('vendor/', document.baseURI).href;
    const A = await import(base + 'firebase-app.js');
    const [AU, R] = await Promise.all([import(base + 'firebase-auth.js'), import(base + 'firebase-database.js')]);
    const app = A.initializeApp(FIREBASE_CONFIG, 'baseball');
    const auth = AU.getAuth(app);
    if(EMU) AU.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings:true });
    // 익명 로그인: 기기마다 고유 번호(uid)가 생기고, 서버 규칙이 이 번호로 방장·손님을 확인함
    const user = await new Promise((res, rej) => {
      const off = AU.onAuthStateChanged(auth, u => { if(u){ off(); res(u); } else AU.signInAnonymously(auth).catch(e => { off(); rej(e); }); }, rej);
    });
    const db = R.getDatabase(app, RTDB_URL);
    if(EMU) R.connectDatabaseEmulator(db, '127.0.0.1', 9000);
    const st = { offset:0, connected:false };
    R.onValue(R.ref(db, '.info/serverTimeOffset'), s => { st.offset = s.val() || 0; });
    FB = { R, db, uid: user.uid, st, ref: p => R.ref(db, NET_ROOT + p), now: () => Date.now() + st.offset, TS: R.serverTimestamp() };
    return FB;
  })().catch(e => { fbLoading = null; throw e; });
  return fbLoading;
}
const netErr = e => {
  const m = String((e && (e.code || e.message)) || e || '');
  if(/PERMISSION_DENIED|permission/i.test(m)) return '서버가 허락하지 않았습니다. 서버 규칙이 아직 설정되지 않았거나, 이 방에 들어갈 수 없습니다.';
  if(/network|offline|unavailable/i.test(m)) return '인터넷에 연결되지 않았습니다.';
  return '연결하지 못했습니다. (' + m.slice(0, 80) + ')';
};

/* ---------- 방 상태 ---------- */
// role: host·guest / side: 이 기기가 맡은 팀(0 원정 · 1 홈) / stN: 받은 상태 번호 / sent: 선택을 보내고 결과를 기다리는 중
const NET = { on:false, role:null, side:-1, code:null, peer:null, cfg:null, subs:[], stN:0, gid:0, log:[], chats:[], sent:false, pend:{}, peerOn:false, quietUntil:0 };
const peerRole = () => NET.role === 'host' ? 'guest' : 'host';
const spaced = c => String(c).split('').join(' ');
function netSave(){ if(NET.on) ls.set('bb_net', { code: NET.code, role: NET.role, side: NET.side }); }
function netUnsub(){ NET.subs.forEach(f => { try{ f(); }catch(e){} }); NET.subs = []; }

async function netCreate(cfg){
  const F = await fbInit(), { R } = F;
  for(let i = 0; i < 12; i++){
    const code = String(1000 + Math.floor(Math.random() * 9000));
    const room = { host:{ uid:F.uid, name:SET.name, at:F.TS }, cfg };
    try{ await R.set(F.ref(code), room); }
    catch(e){ if(/PERMISSION/i.test(String(e.code || e.message))) { if(i < 11) continue; } throw e; }
    Object.assign(NET, { on:true, role:'host', code, cfg, side: cfg.hostSide, peer:null, stN:0, log:[], chats:[], sent:false, pend:{}, peerOn:false });
    netSave(); netListen();
    return code;
  }
  throw new Error('방 코드를 만들지 못했습니다');
}
// 손님으로 들어가기. 이미 내가 손님인 방이면 그대로 다시 들어감
async function netJoin(code){
  const F = await fbInit(), { R } = F;
  const [h, c, g] = await Promise.all(['host', 'cfg', 'guest'].map(k => R.get(F.ref(code + '/' + k)).then(s => s.val())));
  if(!h || !c) return '그런 방이 없습니다. 방 코드를 다시 확인해 주세요.';
  if(h.uid === F.uid) return '내가 만든 방입니다. 온라인 대전 화면의 방 다시 열기를 써 주세요.';
  if(g && g.uid !== F.uid) return '이미 두 사람이 들어가 있는 방입니다.';
  await R.set(F.ref(code + '/guest'), { uid:F.uid, name:SET.name, at:F.TS });
  Object.assign(NET, { on:true, role:'guest', code, cfg:c, side: 1 - c.hostSide, peer:h, stN:0, log:[], chats:[], sent:false, pend:{}, peerOn:true });
  netSave(); netListen();
  return '';
}
// 방장이 기기를 다시 켰을 때
async function netReopen(code){
  const F = await fbInit(), { R } = F;
  const [h, c, g] = await Promise.all(['host', 'cfg', 'guest'].map(k => R.get(F.ref(code + '/' + k)).then(s => s.val())));
  if(!h || h.uid !== F.uid || !c) return '방이 이미 닫혔습니다.';
  const old = (await R.get(F.ref(code + '/state/n')).catch(() => null));   // 손님이 받은 상태 번호보다 크게 이어 감
  Object.assign(NET, { on:true, role:'host', code, cfg:c, side:c.hostSide, peer:g || null, stN:(old && old.val()) || 0, log:[], chats:[], sent:false, pend:{}, peerOn:!!g });
  netSave(); netListen();
  return '';
}
function netListen(){
  const F = FB, { R } = F, me = NET.role, other = peerRole();
  netUnsub();
  NET.quietUntil = Date.now() + 2500;   // 처음 받는 지난 채팅은 읽지 않음
  // 접속 표시: 연결이 끊기면 서버가 on:false로 바꿔 둠
  const hb = F.ref(NET.code + '/hb/' + me);
  NET.subs.push(R.onValue(R.ref(F.db, '.info/connected'), s => {
    F.st.connected = !!s.val();
    if(s.val()){ R.onDisconnect(hb).set({ on:false, at:F.TS }).then(() => R.set(hb, { on:true, at:F.TS })).catch(() => {}); }
  }));
  NET.subs.push(R.onValue(F.ref(NET.code + '/hb/' + other), s => {
    const v = s.val(), was = NET.peerOn;
    NET.peerOn = !!(v && v.on);
    clearTimeout(NET.offT);
    // 잠깐 끊겼다 바로 붙는 경우와 방에서 나가는 경우는 알리지 않음
    if(was && !NET.peerOn) NET.offT = setTimeout(() => { if(NET.on && NET.peer && !NET.peerOn){ NET.peerWasOff = true; netNotice(`${NET.peer.name}님의 연결이 끊겼습니다. 다시 들어오기를 기다립니다.`); } }, 4000);
    if(!was && NET.peerOn && NET.peerWasOff && NET.peer){ NET.peerWasOff = false; netNotice(`${NET.peer.name}님이 다시 연결되었습니다.`); }
  }, () => {}));
  NET.subs.push(R.onChildAdded(R.query(F.ref(NET.code + '/chat'), R.limitToLast(30)), s => onChat(s.val() || {}), () => {}));
  NET.subs.push(R.onChildAdded(F.ref(NET.code + '/sig/' + me), s => { const v = s.val(); R.remove(s.ref).catch(() => {}); if(v && typeof onSig === 'function') onSig(v); }, () => {}));
  if(me === 'host'){
    NET.subs.push(R.onValue(F.ref(NET.code + '/guest'), s => onGuest(s.val()), e => netNotice(netErr(e))));
    NET.subs.push(R.onChildAdded(F.ref(NET.code + '/act'), s => { const v = s.val(); R.remove(s.ref).catch(() => {}); if(v) onAct(v); }, () => {}));
  } else {
    NET.subs.push(R.onValue(F.ref(NET.code + '/state'), s => { const v = s.val(); if(v) onState(v); }, () => {}));
    NET.subs.push(R.onValue(F.ref(NET.code + '/host'), s => { const v = s.val(); if(!v) onRoomClosed(); else NET.peer = v; }, () => {}));
    NET.subs.push(R.onValue(F.ref(NET.code + '/guest'), s => { const v = s.val(); if(NET.on && (!v || v.uid !== F.uid)) onKicked(); }, () => {}));
    NET.subs.push(R.onValue(F.ref(NET.code + '/cfg'), s => { const v = s.val(); if(v){ NET.cfg = v; NET.side = 1 - v.hostSide; if(typeof onCfg === 'function') onCfg(); } }, () => {}));
  }
}
async function netLeave(){
  if(!NET.on) return;
  const F = FB, { R } = F, code = NET.code, role = NET.role;
  if(typeof voiceOff === 'function') voiceOff();
  netUnsub(); clearTimeout(NET.offT);
  try{
    await R.onDisconnect(F.ref(code + '/hb/' + role)).cancel();
    if(role === 'host') await R.remove(F.ref(code));
    else { await R.set(F.ref(code + '/hb/guest'), { on:false, at:F.TS }); await R.remove(F.ref(code + '/guest')); }
  }catch(e){}
  Object.assign(NET, { on:false, role:null, code:null, peer:null, side:-1 });
  ls.del('bb_net'); ls.del('bb_netg');
}

/* ---------- 보내기 ---------- */
// 방장: 경기 상태를 보냄. pend: 팀마다 이미 고른 선택이 방장 기기에 있는지(무엇을 골랐는지는 보내지 않음)
function netPushState(res){
  if(!NET.on || NET.role !== 'host' || !G) return;
  if(NET.gidPushed !== G.at){ NET.gidPushed = G.at; NET.pushedN = 0; }
  const F = FB, { R } = F;
  const c = JSON.parse(JSON.stringify(G, (k, v) => (k === 'log' || k === 'rng' || k === 'out' || k === 'fx' || k === 'names' || k === 'prevTypes') ? undefined : v));
  c.teams[NET.side].lastSel = null;   // 방장이 겨냥했던 곳은 보내지 않음
  const g = JSON.stringify(c);
  const pend = {};
  const off = batIdx(G), def = 1 - off;
  pend[def] = !!GS.pend.def; pend[off] = !!GS.pend.off;
  NET.stN++;
  // 지난번에 보낸 뒤로 생긴 문장을 모두 보냄 (감독 모드는 여러 타석이 한꺼번에 진행됨). 다시 들어온 손님을 위해 최근 40줄은 늘 붙임
  const recent = G.log.length > 40 ? G.log[G.log.length - 41].n : 0;
  const from = Math.min(NET.pushedN || 0, recent);
  const tail = G.log.filter(l => l.n > from).slice(-300);
  NET.pushedN = G.log.length ? G.log[G.log.length - 1].n : 0;
  const st = { n: NET.stN, gid: G.at, g, tail: JSON.stringify(tail), fx: JSON.stringify(res ? res.fx : []), pend, at: F.TS };
  R.set(F.ref(NET.code + '/state'), st).catch(e => netNotice(netErr(e)));
  ls.set('bb_netg', { code: NET.code, G, opts: GS.opts });
}
// 손님: 선택·작전을 방장에게 보냄
function netSendAct(a){
  const F = FB, { R } = F;
  return R.push(F.ref(NET.code + '/act'), { c: JSON.stringify({ ...a, n: NET.stN }), at: F.TS }).catch(e => netNotice(netErr(e)));
}
function netChat(t){
  t = String(t || '').trim().slice(0, 300); if(!t || !NET.on) return;
  const F = FB, { R } = F;
  R.push(F.ref(NET.code + '/chat'), { uid:F.uid, name:SET.name, t, at:F.TS }).catch(e => netNotice(netErr(e)));
}
function netSig(t, d){
  if(!NET.on) return;
  const F = FB, { R } = F;
  R.push(F.ref(NET.code + '/sig/' + peerRole()), d === undefined ? { t, at:F.TS } : { t, d: JSON.stringify(d), at:F.TS }).catch(() => {});
}
async function netSetCfg(cfg){ const F = FB; NET.cfg = cfg; await F.R.set(F.ref(NET.code + '/cfg'), cfg); }
async function netKick(){ const F = FB; await F.R.remove(F.ref(NET.code + '/guest')).catch(() => {}); }

/* ---------- 받기 ---------- */
function onChat(m){
  if(!m.t) return;
  const mine = FB && m.uid === FB.uid;
  NET.chats.push({ name: m.name, t: m.t, mine });
  if(NET.chats.length > 50) NET.chats.shift();
  if(typeof renderChat === 'function') renderChat();
  if(!mine && Date.now() > NET.quietUntil){
    playFx(['chat']);
    if(SET.chatRead) speak(`채팅, ${m.name}: ${m.t}`);
  }
}
function netNotice(text){ speak(text); if(typeof showNotice === 'function') showNotice(text); }
