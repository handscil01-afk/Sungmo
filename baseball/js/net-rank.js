'use strict';
/* ===================== 온라인 전적: 기록 남기기와 서버 맞추기 =====================
   온라인 경기가 끝나면 이 기기에 먼저 남기고(최근 경기·상대별 전적), 서버(baseball/ 아래)에도 올림.
   서버 (규칙은 sports-day/database.rules.json의 baseball 부분):
   - results/{방 코드}/{경기 번호 G.at}: 방장 기기가 한 번만 씀 { h·g: 방장·손님 uid, hn·gn: 이름, ht·gt: 팀, hs·gs: 점수, hr·gr: 경기 전 점수, at }
       손님 기기는 자기가 본 경기 결과와 같을 때만 ok:true(확인). 두 기기는 각자 자기 기록에 반영하면서 ah(방장)·ag(손님):true를 남김
   - players/{uid}: 순위표 한 줄 { name, w, l, d, g, r(점수, 처음 1000), last(마지막으로 반영한 결과), at, pid } — 자기 줄만 씀
   - h2h/{uid_uid}/{uid}: 두 사람 사이 전적 가운데 내 쪽 { n: 상대 이름, w, l, d, last, at } — 자기 쪽만 씀
   서버 규칙이 확인하는 것: 자기 uid 자리만, 손님이 확인한 결과만, 결과 하나는 한 번만(ah·ag), 승·패·무 가운데 하나만 1 오름, 점수 변화는 ±32 안에서 이긴 쪽은 오르고 진 쪽은 내림.
   이 기기(localStorage): bb_pid 기기 번호 · bb_rkh 최근 경기(50개) · bb_rkvs 상대별 전적 · bb_rkq 서버에 아직 못 올린 결과 */
const RK_K = 32, RK_BASE = 1000, RK_HIST = 50, RK_VS_MAX = 100;
const RK = { uid:null, seen:{}, me:null, meAt:0, rank:0, vs:{}, vsAt:{}, top:null, topAt:0, err:'', chain:null, pollT:0, polls:0, done:{}, said:{}, loading:{} };
const rkName = s => String(s || '이름 없음').trim().slice(0, 20) || '이름 없음';
const rkPair = (a, b) => [a, b].sort().join('_');
// 기기 번호: 처음 한 번 무작위로 만들어 계속 씀 (서버 기록의 주인은 Firebase 익명 로그인 uid이고, 이 번호는 함께 적어 둠)
function rkPid(){
  let p = ls.get('bb_pid', '');
  if(typeof p === 'string' && /^[a-z0-9]{12,24}$/.test(p)) return p;
  try{ const a = new Uint8Array(12); crypto.getRandomValues(a); p = [...a].map(x => (x % 36).toString(36)).join(''); }
  catch(e){ p = (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 16); }
  p = p.padEnd(12, '0').slice(0, 24); ls.set('bb_pid', p); return p;
}
// 엘로 점수: 기대 승률과 실제 결과의 차이 × 32 (반올림)
const rkElo = (me, op, s) => Math.round(RK_K * (s - 1 / (1 + Math.pow(10, (op - me) / 400))));
const rkWLD = x => x ? `${x.w || 0}승 ${x.l || 0}패${x.d ? ` ${x.d}무` : ''}` : '';
const rkGames = x => x ? (x.w || 0) + (x.l || 0) + (x.d || 0) : 0;

/* ---------- 이 기기의 기록 ---------- */
const rkHist = () => { const h = ls.get('bb_rkh', []); return Array.isArray(h) ? h : []; };
const rkVsLocal = () => { const v = ls.get('bb_rkvs', {}); return v && typeof v === 'object' ? v : {}; };
const rkQ = () => { const q = ls.get('bb_rkq', []); return Array.isArray(q) ? q : []; };
const rkQSave = q => ls.set('bb_rkq', q);
// 경기 하나를 이 기기에 남김 (같은 경기는 한 번만)
function rkLocalAdd(m){
  const h = rkHist();
  if(h.some(x => x.id === m.id)) return false;
  h.unshift({ id:m.id, opp:m.opp, on:m.on, mt:m.mt, ot:m.ot, ms:m.ms, os:m.os, role:m.role, at:m.at });
  ls.set('bb_rkh', h.slice(0, RK_HIST));
  const vs = rkVsLocal(), o = vs[m.opp] || { n:m.on, w:0, l:0, d:0, at:0 };
  o.n = m.on; o.at = m.at; o[m.ms > m.os ? 'w' : m.ms < m.os ? 'l' : 'd']++;
  vs[m.opp] = o;
  const keys = Object.keys(vs);
  if(keys.length > RK_VS_MAX) keys.sort((a, b) => (vs[a].at || 0) - (vs[b].at || 0)).slice(0, keys.length - RK_VS_MAX).forEach(k => delete vs[k]);
  ls.set('bb_rkvs', vs);
  return true;
}
// 상대 한 사람과의 전적: 서버 기록과 이 기기 기록 가운데 경기 수가 많은 쪽 (서버에 올리기 전에도 바로 보이게)
function rkVsOf(uid){
  if(!uid) return null;
  const a = RK.vs[uid], b = rkVsLocal()[uid];
  if(!a && !b) return null;
  return rkGames(a) >= rkGames(b) ? a : b;
}
// 상대별 전적 목록 (최근에 만난 순서)
function rkVsList(){
  const loc = rkVsLocal(), ids = new Set([...Object.keys(loc), ...Object.keys(RK.vs)]);
  return [...ids].map(id => ({ id, ...rkVsOf(id), n: (rkVsOf(id) || {}).n || (loc[id] || {}).n || '상대', at: (loc[id] || {}).at || 0 })).filter(x => rkGames(x)).sort((a, b) => b.at - a.at);
}
// 통산: 서버 기록이 있으면 그것, 없으면 이 기기 기록을 더한 것
function rkTotals(){
  if(RK.me) return { w:RK.me.w, l:RK.me.l, d:RK.me.d, r:RK.me.r, rank:RK.rank, server:true };
  const t = { w:0, l:0, d:0, r:null, rank:0, server:false };
  Object.values(rkVsLocal()).forEach(o => { t.w += o.w || 0; t.l += o.l || 0; t.d += o.d || 0; });
  return t;
}

/* ---------- 서버 읽고 쓰기 (시험에서는 이 객체를 가짜로 바꿔 끼움) ---------- */
const RKDB = {
  async uid(){ return (await fbInit()).uid; },
  ts(){ return FB ? FB.TS : Date.now(); },
  async get(p){ const F = await fbInit(); return (await F.R.get(F.R.ref(F.db, 'baseball/' + p))).val(); },
  async set(p, v){ const F = await fbInit(); await F.R.set(F.R.ref(F.db, 'baseball/' + p), v); },
  async update(o){ const F = await fbInit(); await F.R.update(F.R.ref(F.db, 'baseball'), o); },
  // 점수 높은 n명 (높은 순서)
  async top(n){
    const F = await fbInit(), { R } = F, out = [];
    const s = await R.get(R.query(R.ref(F.db, 'baseball/players'), R.orderByChild('r'), R.limitToLast(n)));
    s.forEach(c => { out.push({ uid:c.key, ...c.val() }); });
    return out.reverse();
  },
  // 점수가 r보다 높은 사람 수 (500명까지)
  async above(r){
    const F = await fbInit(), { R } = F;
    const s = await R.get(R.query(R.ref(F.db, 'baseball/players'), R.orderByChild('r'), R.startAfter(r), R.limitToFirst(500)));
    return s.size;
  },
};

/* ---------- 경기가 끝났을 때 (online.js netNext가 부름) ---------- */
function rankOnOver(){
  if(!NET.on || !G || !G.over || !NET.peer || !NET.peer.uid || !NET.code || G.at == null) return;
  const id = `${NET.code}/${G.at}`;
  if(RK.seen[id]) return;
  RK.seen[id] = 1;
  const my = NET.side, op = 1 - my;
  if(my !== 0 && my !== 1) return;
  const m = { id, role:NET.role, me: FB ? FB.uid : '', opp:NET.peer.uid, on:rkName(NET.peer.name), mt:G.teams[my].key, ot:G.teams[op].key, ms:runsOf(G.teams[my]), os:runsOf(G.teams[op]), at:Date.now() };
  const fresh = rkLocalAdd(m);
  const q = rkQ();
  if(fresh && !q.some(x => x.id === id)){ q.push({ ...m, tries:0 }); rkQSave(q); }
  RK.polls = 0;
  rankSync();
}
// 서버에 못 올린 결과를 차례로 올림 (여러 번 불러도 한 줄로 이어서 함)
function rankSync(){
  RK.chain = (RK.chain || Promise.resolve()).then(rkSyncNow).catch(e => { RK.err = netErr(e); });
  return RK.chain;
}
async function rkSyncNow(){
  const q0 = rkQ(); if(!q0.length) return;
  let uid;
  try{ uid = await RKDB.uid(); }catch(e){ RK.err = netErr(e); rkPoll(); return; }
  let wait = false, changed = false;
  const keep = [];
  for(const it of q0){
    if(it.me && it.me !== uid) continue;   // 이 기기의 로그인이 바뀌어 올릴 수 없는 기록
    if(Date.now() - (it.at || 0) > 3 * 864e5) continue;   // 사흘 넘게 못 올린 기록은 그만둠
    let r;
    try{ r = it.role === 'host' ? await rkHostStep(it, uid) : await rkGuestStep(it, uid); RK.err = ''; }
    catch(e){ r = 'err'; it.tries = (it.tries || 0) + 1; RK.err = netErr(e); }
    if(r === 'wait' || (r === 'err' && it.tries < 8)){ keep.push(it); wait = true; }
    if(r === 'done') changed = true;
  }
  // 그사이 새로 들어온 결과는 그대로 둠
  const ids = new Set(q0.map(x => x.id));
  rkQSave([...keep, ...rkQ().filter(x => !ids.has(x.id))]);
  if(wait) rkPoll(); else { RK.polls = 0; }
  if(changed) rkRefresh();
}
// 상대 기기가 결과를 쓰거나 확인하기를 잠깐 기다렸다가 다시 (최대 1분 남짓, 그 뒤에는 온라인 화면을 열 때마다)
function rkPoll(){
  clearTimeout(RK.pollT);
  if(RK.polls >= 25) return;
  RK.polls++;
  RK.pollT = setTimeout(() => rankSync(), 2500);
}
// 방장: 결과를 한 번 쓰고, 손님이 확인하면 내 기록에 반영
async function rkHostStep(it, uid){
  let res = await RKDB.get(`results/${it.id}`);
  if(!res){
    const [me, op] = await Promise.all([RKDB.get('players/' + uid), RKDB.get('players/' + it.opp)]);
    res = { h:uid, g:it.opp, hn:rkName(SET.name || '방장'), gn:it.on, ht:String(it.mt).slice(0, 20), gt:String(it.ot).slice(0, 20), hs:it.ms, gs:it.os,
      hr: me && typeof me.r === 'number' ? me.r : RK_BASE, gr: op && typeof op.r === 'number' ? op.r : RK_BASE, at:RKDB.ts() };
    await RKDB.set(`results/${it.id}`, res);
  }
  if(res.h !== uid) return 'drop';
  if(res.ah) return 'done';
  if(!res.ok) return 'wait';
  await rkApply(it, uid, res, 'h');
  return 'done';
}
// 손님: 방장이 쓴 결과가 내가 본 경기와 같으면 확인하면서 내 기록에 반영
async function rkGuestStep(it, uid){
  const res = await RKDB.get(`results/${it.id}`);
  if(!res) return 'wait';
  if(res.g !== uid || res.h !== it.opp || res.hs !== it.os || res.gs !== it.ms) return 'drop';
  if(res.ag) return 'done';
  await rkApply(it, uid, res, 'g');
  return 'done';
}
async function rkApply(it, uid, res, s){
  const host = s === 'h', ms = host ? res.hs : res.gs, os = host ? res.gs : res.hs, opp = host ? res.g : res.h;
  const sc = ms > os ? 1 : ms < os ? 0 : 0.5, pair = rkPair(uid, opp);
  const [me, vs2] = await Promise.all([RKDB.get('players/' + uid), RKDB.get('h2h/' + pair)]);
  const vs = vs2 && vs2[uid];
  const add = k => (k === 'w' ? sc === 1 : k === 'l' ? sc === 0 : sc === 0.5) ? 1 : 0;
  const n0 = (o, k) => (o && typeof o[k] === 'number' ? o[k] : 0);
  const dr = rkElo(host ? res.hr : res.gr, host ? res.gr : res.hr, sc);
  const r0 = me && typeof me.r === 'number' ? me.r : RK_BASE;
  const P = { name:rkName(SET.name), w:n0(me, 'w') + add('w'), l:n0(me, 'l') + add('l'), d:n0(me, 'd') + add('d'), g:0, r:Math.max(0, Math.min(5000, r0 + dr)), last:it.id, at:RKDB.ts(), pid:rkPid() };
  P.g = P.w + P.l + P.d;
  const V = { n:rkName(host ? res.gn : res.hn), w:n0(vs, 'w') + add('w'), l:n0(vs, 'l') + add('l'), d:n0(vs, 'd') + add('d'), last:it.id, at:RKDB.ts() };
  const up = { [`players/${uid}`]:P, [`h2h/${pair}/${uid}`]:V, [`results/${it.id}/a${s}`]:true };
  if(!host && !res.ok) up[`results/${it.id}/ok`] = true;
  await RKDB.update(up);
  RK.me = { ...P, at:Date.now() }; RK.meAt = Date.now(); RK.rank = 0;
  RK.vs[opp] = { n:V.n, w:V.w, l:V.l, d:V.d }; RK.vsAt[opp] = Date.now();
  RK.done[it.id] = { dr: P.r - r0, r:P.r, opp };
}

/* ---------- 불러오기 ---------- */
// 내 순위표 줄과 순위 (30초 안에 불러온 것은 다시 부르지 않음)
async function rkLoadMe(force){
  if(RK.loading.me || (!force && Date.now() - RK.meAt < 30000)) return;
  RK.loading.me = true;
  try{
    const uid = RK.uid = await RKDB.uid();
    const me = await RKDB.get('players/' + uid);
    RK.me = me || null; RK.meAt = Date.now();
    RK.rank = me && typeof me.r === 'number' ? (await RKDB.above(me.r)) + 1 : 0;
    RK.err = '';
  }catch(e){ RK.err = netErr(e); RK.meAt = Date.now(); }
  RK.loading.me = false;
  rkRefresh();
}
async function rkLoadTop(force){
  if(RK.loading.top || (!force && RK.top && Date.now() - RK.topAt < 30000)) return;
  RK.loading.top = true;
  await null;   // 화면을 그리는 중에 불려도 그 뒤에 다시 그림
  if(force){ RK.top = null; rkRefresh(); }
  try{
    RK.uid = await RKDB.uid();
    const list = await RKDB.top(20);
    RK.top = { list, err:'' };
  }catch(e){ RK.top = { list:[], err:netErr(e) }; }
  RK.topAt = Date.now(); RK.loading.top = false;
  await rkLoadMe(force);
  rkRefresh(true);
}
// 지금 상대와의 전적 (로비·경기 끝 화면)
async function rkLoadVs(opp){
  if(!opp || RK.loading['vs' + opp] || Date.now() - (RK.vsAt[opp] || 0) < 30000) return;
  RK.loading['vs' + opp] = true;
  try{
    const uid = await RKDB.uid();
    const v = await RKDB.get('h2h/' + rkPair(uid, opp));
    const mine = v && v[uid];
    if(mine) RK.vs[opp] = { n:mine.n, w:mine.w || 0, l:mine.l || 0, d:mine.d || 0 };
  }catch(e){}
  RK.vsAt[opp] = Date.now(); RK.loading['vs' + opp] = false;
  rkRefresh();
}
// 기록이 바뀌면 보고 있는 화면을 다시 그림 (경기 끝 화면이면 반영 결과를 한 번 읽어 줌)
function rkRefresh(loaded){
  if(typeof UI === 'undefined' || !UI.make) return;
  const mk = UI.make;
  if(typeof endScreen === 'function' && mk === endScreen && G && G.over && NET.on){
    const d = RK.done[`${NET.code}/${G.at}`];
    rerender();
    if(d && !RK.said[`${NET.code}/${G.at}`]){ RK.said[`${NET.code}/${G.at}`] = 1; speak(rkDoneText(d)); }
    return;
  }
  if((typeof lobbyScreen === 'function' && mk === lobbyScreen) || (typeof rankMeScreen === 'function' && mk === rankMeScreen)) { rerender(); return; }
  if(typeof rankTopScreen === 'function' && mk === rankTopScreen){ rerender(); if(loaded && RK.top) speak(RK.top.err || (RK.top.list.length ? `순위표를 불러왔습니다. ${RK.top.list.length}명입니다.` : '아직 순위표에 아무도 없습니다.')); }
}
const rkDoneText = d => `전적에 반영했습니다. 점수 ${d.r}점(${d.dr >= 0 ? '+' : ''}${d.dr}).`;
// 처음 켤 때 못 올린 결과가 남아 있으면 잠시 뒤 올림
setTimeout(() => { if(rkQ().length) rankSync(); }, 4000);
