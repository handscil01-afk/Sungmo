// 온라인 전적·순위표 시험 (진짜 Firebase에 연결하지 않음): 두 브라우저(방장 화면 보며 하기 · 손님 소리와 글로 하기)의 RKDB를
// 이 시험 안의 가짜 서버로 바꿔 끼우고, 온라인 경기 끝을 흉내 내어 기록이 양쪽에 맞게 쌓이는지, 서버 규칙을 흉내 낸 검사가 잘못된 쓰기를 막는지,
// 내 전적·순위표 화면이 휴대폰·작은 휴대폰·가로·태블릿에서 한 화면에 들어가는지, 연결 오류를 한국어로 알리는지 확인함.
// 가짜 서버의 검사는 sports-day/database.rules.json의 baseball 부분(results·players·h2h)을 그대로 옮긴 것.
// 사용법: node baseball/tests/rank.js [스크린샷 폴더]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const shots = process.argv[2] || null;
const PORT = 8793, URL0 = `http://localhost:${PORT}/baseball/`;

/* ---------- 가짜 서버 ---------- */
const DB = { results:{}, players:{}, h2h:{} };
const MOCK = { fail:null, calls:0 };
const clone = v => v == null ? null : JSON.parse(JSON.stringify(v));
const parts = p => String(p).split('/').filter(Boolean);
const getAt = (o, p) => parts(p).reduce((x, k) => x == null ? null : x[k], o) ?? null;
function setAt(o, p, v){ const ks = parts(p); let x = o; ks.slice(0, -1).forEach(k => { if(x[k] == null || typeof x[k] !== 'object') x[k] = {}; x = x[k]; }); if(v == null) delete x[ks[ks.length - 1]]; else x[ks[ks.length - 1]] = clone(v); }
const deny = why => { const e = new Error('PERMISSION_DENIED: ' + why); e.code = 'PERMISSION_DENIED'; throw e; };
const isStr = (v, min, max) => typeof v === 'string' && v.length >= min && v.length <= max;
const isNum = (v, lo, hi) => typeof v === 'number' && v >= lo && v <= hi;
// players/$uid · h2h/$pair/$uid 한 자리 확인 (규칙의 side(): 손님 확인 · 처음 반영 표시 · 승패무 하나만 1 · 점수 변화 범위)
function checkSide(uid, owner, oldV, newV, oldRoot, newRoot, rating){
  if(uid !== owner) deny('남의 자리');
  if(newV == null) deny('지우기');
  const L = newV.last;
  if(!/^[0-9]{4}\/[0-9]{10,15}$/.test(L || '')) deny('last');
  const R = getAt(oldRoot, 'results/' + L), N = getAt(newRoot, 'results/' + L);
  if(!R || !N || N.ok !== true) deny('확인 안 된 결과');
  const d = (k, def = 0) => newV[k] - (oldV ? oldV[k] : def);
  const out = (ms, os) => {
    const [w, l, dd, r] = [d('w'), d('l'), d('d'), d('r', 1000)];
    if(ms > os) return w === 1 && l === 0 && dd === 0 && (!rating || (r >= 0 && r <= 32));
    if(ms < os) return w === 0 && l === 1 && dd === 0 && (!rating || (r <= 0 && r >= -32));
    return w === 0 && l === 0 && dd === 1 && (!rating || (r >= -16 && r <= 16));
  };
  const okH = R.h === owner && !R.ah && N.ah === true && out(R.hs, R.gs);
  const okG = R.g === owner && !R.ag && N.ag === true && out(R.gs, R.hs);
  if(!okH && !okG) deny('결과와 맞지 않는 기록');
  ['w', 'l', 'd'].forEach(k => { if(!isNum(newV[k], 0, 1e6)) deny(k); });
  if(typeof newV.at !== 'number') deny('at');
  return R;
}
function checkPlayer(uid, owner, oldV, newV, oldRoot, newRoot){
  checkSide(uid, owner, oldV, newV, oldRoot, newRoot, true);
  const extra = Object.keys(newV).filter(k => !['name', 'w', 'l', 'd', 'g', 'r', 'last', 'at', 'pid'].includes(k));
  if(extra.length) deny('남는 칸 ' + extra);
  if(!isStr(newV.name, 1, 20) || !isNum(newV.r, 0, 5000) || newV.g !== newV.w + newV.l + newV.d) deny('칸 값');
}
function checkH2h(uid, pair, owner, oldV, newV, oldRoot, newRoot){
  const R = checkSide(uid, owner, oldV, newV, oldRoot, newRoot, false);
  if(pair !== R.h + '_' + R.g && pair !== R.g + '_' + R.h) deny('짝 번호');
  if(!isStr(newV.n, 1, 20)) deny('n');
  const extra = Object.keys(newV).filter(k => !['n', 'w', 'l', 'd', 'last', 'at'].includes(k));
  if(extra.length) deny('남는 칸 ' + extra);
}
function checkResult(uid, oldR, newR){
  if(oldR) deny('결과는 한 번만');
  if(!newR || newR.h !== uid || !isStr(newR.g, 1, 128) || newR.g === uid) deny('방장만');
  for(const k of ['hn', 'gn', 'ht', 'gt']) if(!isStr(newR[k], 1, 20)) deny(k);
  for(const k of ['hs', 'gs']) if(!isNum(newR[k], 0, 999)) deny(k);
  for(const k of ['hr', 'gr']) if(!isNum(newR[k], 0, 5000)) deny(k);
  if(newR.ok || newR.ah || newR.ag) deny('처음부터 확인 표시');
}
function checkFlag(uid, path, oldRoot, newRoot){
  const [, code, gid, f] = parts(path), R = getAt(oldRoot, `results/${code}/${gid}`), N = getAt(newRoot, `results/${code}/${gid}`);
  if(!R || R[f] != null) deny(f + ' 한 번만');
  if(N[f] !== true) deny(f);
  if(f === 'ok' && R.g !== uid) deny('ok는 손님만');
  if(f === 'ah' && (R.h !== uid || N.ok !== true)) deny('ah');
  if(f === 'ag' && (R.g !== uid || N.ok !== true)) deny('ag');
}
function write(uid, changes){
  const oldRoot = DB, newRoot = clone(DB);
  Object.entries(changes).forEach(([p, v]) => setAt(newRoot, p, v));
  for(const p of Object.keys(changes)){
    const k = parts(p);
    if(k[0] === 'players' && k.length === 2) checkPlayer(uid, k[1], getAt(oldRoot, p), getAt(newRoot, p), oldRoot, newRoot);
    else if(k[0] === 'h2h' && k.length === 3) checkH2h(uid, k[1], k[2], getAt(oldRoot, p), getAt(newRoot, p), oldRoot, newRoot);
    else if(k[0] === 'results' && k.length === 3) checkResult(uid, getAt(oldRoot, p), getAt(newRoot, p));
    else if(k[0] === 'results' && k.length === 4 && ['ok', 'ah', 'ag'].includes(k[3])) checkFlag(uid, p, oldRoot, newRoot);
    else deny('쓸 수 없는 곳 ' + p);
  }
  Object.assign(DB, newRoot);
}
async function mock(uid, op, a, b){
  MOCK.calls++;
  if(MOCK.fail){ const e = new Error(MOCK.fail); e.code = MOCK.fail; throw e; }
  if(op === 'get'){
    const k = parts(a);
    if(k[0] === 'h2h' && !k[1].split('_').includes(uid)) deny('남의 전적 읽기');
    return clone(getAt(DB, a));
  }
  if(op === 'set'){ write(uid, { [a]:b }); return null; }
  if(op === 'update'){ write(uid, a); return null; }
  const list = Object.entries(DB.players).map(([u, p]) => ({ uid:u, ...p }));
  if(op === 'top') return list.sort((x, y) => y.r - x.r).slice(0, a);
  if(op === 'above') return Math.min(500, list.filter(p => p.r > a).length);
  throw new Error('모르는 요청 ' + op);
}

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', root], { stdio:'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch();
  const errors = [];
  const check = (ok, msg) => { if(!ok) errors.push(msg); };
  const open = async (tag, uid, view, name, w = 390, h = 844) => {
    const ctx = await browser.newContext({ viewport:{ width:w, height:h }, hasTouch: view === 'gfx' });
    await ctx.addInitScript(([v, n]) => { try{ if(!localStorage.getItem('bb_set')) localStorage.setItem('bb_set', JSON.stringify({ view:v, name:n, installDismissed:true })); }catch(e){} }, [view, name]);
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`${tag}: ${e.message}`));
    p.on('console', m => { if(m.type() === 'error' && !/favicon/.test(m.text())) errors.push(`${tag} console: ${m.text()}`); });
    await p.exposeFunction('__rk', (u, op, a, b) => mock(u, op, a, b));
    await p.goto(URL0); await p.waitForFunction(() => typeof UI !== 'undefined' && !!UI.S);
    if((await p.$eval('#q', e => e.textContent)).includes('어떤 방식으로')) await p.keyboard.press(view === 'gfx' ? '1' : '2');
    await p.evaluate(u => { Object.assign(RKDB, { uid: async () => u, ts: () => Date.now(), get: x => window.__rk(u, 'get', x), set: (x, v) => window.__rk(u, 'set', x, v), update: o => window.__rk(u, 'update', o), top: n => window.__rk(u, 'top', n), above: r => window.__rk(u, 'above', r) }); }, uid);
    p.tag = tag;
    return p;
  };
  const shot = async (p, n) => { if(shots) await p.screenshot({ path: path.join(shots, n + '.png') }); };
  const fits = async (p, where) => {
    await p.waitForTimeout(250);
    const o = await p.evaluate(() => { const b = document.querySelector('#skBody'); return b ? [b.className, b.scrollHeight > b.clientHeight + 1, document.documentElement.scrollWidth > innerWidth + 1] : ['', false, document.documentElement.scrollWidth > innerWidth + 1]; });
    if(o[1] || o[2] || /\bscroll\b/.test(o[0])) errors.push(`${where}: 한 화면을 넘침 ${o[0]}`);
  };
  // 온라인 경기 끝 흉내: 두 기기가 같은 씨앗으로 같은 경기를 끝까지 돌리고(G.at도 같게), netNext → rankOnOver → 경기 끝 화면
  const finish = (p, role, seed, at) => p.evaluate(([role, seed, at]) => {
    const g = newGame({ mode:'simple', innings:1, teams:[TEAMS[0].key, TEAMS[1].key], ctrl:['cpu', 'cpu'], unit:'pa', easy:1, seed });
    flush(g); let k = 0;
    while(!g.over && k++ < 5000){ if(g.review) resolveReview(g, false); else playStep(g, aiDefChoice(g), aiOffChoice(g)); }
    g.at = at; g.out = []; g.fx = [];
    Object.assign(NET, { on:true, role, code:'1234', side: role === 'host' ? 0 : 1, peer: role === 'host' ? { uid:'uidGuest', name:'선생님' } : { uid:'uidHost', name:'센터장' }, peerOn:true });
    G = g; GS.opts = {}; GS.pend = { def:null, off:null };
    gameNext('auto', null);
    return [runsOf(g.teams[0]), runsOf(g.teams[1])];
  }, [role, seed, at]);
  const done = (p, id) => p.waitForFunction(i => !!RK.done[i] && !rkQ().length, id, { timeout:20000 }).then(() => true, () => false);

  const host = await open('방장', 'uidHost', 'gfx', '센터장');
  const guest = await open('손님', 'uidGuest', 'a11y', '선생님');

  // 1. 경기 두 번 → 두 기기 기록이 서로 맞아야 함
  const games = [[11, 1700000000001], [12, 1700000000002], [13, 1700000000003]];
  const tot = { w:0, l:0, d:0 };
  for(const [seed, at] of games){
    const id = '1234/' + at;
    const sh = await finish(host, 'host', seed, at), sg = await finish(guest, 'guest', seed, at);
    check(sh.join() === sg.join(), `두 기기 경기 결과가 다름 ${sh} / ${sg}`);
    const [okH, okG] = await Promise.all([done(host, id), done(guest, id)]);
    check(okH && okG, `기록이 반영되지 않음 (${id}) 방장 ${okH} 손님 ${okG}`);
    const r = DB.results['1234'][String(at)];
    check(r && r.ok && r.ah && r.ag, '결과 확인·반영 표시가 없음 ' + JSON.stringify(r));
    tot[sh[0] > sh[1] ? 'w' : sh[0] < sh[1] ? 'l' : 'd']++;
    // 같은 경기를 다시 불러도 두 번 쌓이지 않음
    await host.evaluate(() => { RK.seen = {}; rankOnOver(); });
    console.log(`경기 ${id}: 방장 ${sh[0]} : ${sh[1]} 손님 · 방장 ${DB.players.uidHost.r}점 · 손님 ${DB.players.uidGuest.r}점`);
  }
  await shot(host, 'rk-host-end'); await shot(guest, 'rk-guest-end');
  const PH = DB.players.uidHost, PG = DB.players.uidGuest;
  check(PH.g === games.length && PG.g === games.length, `경기 수가 틀림 ${PH.g} ${PG.g}`);
  check(PH.w === tot.w && PH.l === tot.l && PH.d === tot.d && PG.w === tot.l && PG.l === tot.w && PG.d === tot.d, '승패무가 결과와 다름 ' + JSON.stringify([PH, PG, tot]));
  check(PH.r + PG.r === 2000, `두 사람 점수 합이 2000이 아님 ${PH.r} + ${PG.r}`);
  const pair = DB.h2h['uidGuest_uidHost'];
  check(pair && pair.uidHost.w === PH.w && pair.uidGuest.w === PG.w && pair.uidHost.n === '선생님' && pair.uidGuest.n === '센터장', '상대 전적이 맞지 않음 ' + JSON.stringify(pair));
  const hist = await host.evaluate(() => rkHist().length);
  check(hist === games.length, `이 기기 최근 경기 수 ${hist}`);
  // 경기 끝 화면: 손님(소리와 글)은 알림 칸, 방장(화면 보며 하기)은 점수 카드 아래 한 줄
  const gNote = await guest.$eval('#note', e => e.textContent);
  check(/센터장님과의 상대 전적: \d+승 \d+패/.test(gNote) && /전적에 반영했습니다/.test(gNote), '손님 경기 끝 화면에 상대 전적이 없음: ' + gNote);
  const hTag = await host.evaluate(() => { const e = document.querySelector('.fin-rk'); return e ? e.textContent : ''; });
  check(/상대 전적 \d+승 \d+패/.test(hTag) && /점/.test(hTag), '방장 경기 끝 점수 카드에 상대 전적이 없음: ' + hTag);
  console.log('경기 끝 손님:', gNote.replace(/\s+/g, ' '), '/ 방장:', hTag);
  await fits(host, '방장 경기 끝');

  // 2. 서버 규칙을 흉내 낸 검사: 잘못된 쓰기는 막혀야 함
  const tries = await guest.evaluate(async () => {
    const t = async f => { try{ await f(); return '써짐'; }catch(e){ return /PERMISSION/.test(String(e.message)) ? '막힘' : '오류 ' + e.message; } };
    const me = await RKDB.get('players/uidGuest');
    return {
      남의줄: await t(() => RKDB.update({ 'players/uidHost': { name:'x', w:99, l:0, d:0, g:99, r:3000, last:'1234/1700000000001', at:1 } })),
      다시반영: await t(() => RKDB.update({ 'players/uidGuest': { ...me, w:me.w + 1, g:me.g + 1, last:'1234/1700000000001', at:Date.now() } })),
      결과덮어쓰기: await t(() => RKDB.set('results/1234/1700000000001', { h:'uidGuest', g:'uidHost', hn:'a', gn:'b', ht:'a', gt:'b', hs:9, gs:0, hr:1000, gr:1000, at:1 })),
      확인없는결과: await t(async () => { await RKDB.set('results/5678/1700000000009', { h:'uidGuest', g:'uidHost', hn:'a', gn:'b', ht:'a', gt:'b', hs:9, gs:0, hr:1000, gr:1000, at:1 }); await RKDB.update({ 'players/uidGuest': { ...me, w:me.w + 1, g:me.g + 1, last:'5678/1700000000009', at:Date.now() }, 'results/5678/1700000000009/ah':true }); }),
      남의전적읽기: await t(() => RKDB.get('h2h/aaa_bbb')),
    };
  });
  console.log('잘못된 쓰기:', JSON.stringify(tries));
  ['남의줄', '다시반영', '결과덮어쓰기', '확인없는결과', '남의전적읽기'].forEach(k => check(tries[k] === '막힘', `${k}: ${tries[k]}`));
  // 방장이 점수를 바꿔 쓴 결과는 손님 기기가 확인하지 않음
  {
    const at = 1700000000050;
    await finish(guest, 'guest', 21, at);
    DB.results['1234'] = DB.results['1234'] || {};
    DB.results['1234'][String(at)] = { h:'uidHost', g:'uidGuest', hn:'센터장', gn:'선생님', ht:'a', gt:'b', hs:30, gs:0, hr:1000, gr:1000, at:1 };
    const g0 = DB.players.uidGuest.g;
    await guest.waitForFunction(() => !rkQ().length, null, { timeout:20000 }).catch(() => {});
    check(!DB.results['1234'][String(at)].ok && DB.players.uidGuest.g === g0, '점수를 바꿔 쓴 결과를 손님이 확인함');
  }

  // 3. 화면: 온라인 첫 화면·내 전적·순위표·로비가 여러 화면 크기에서 한 화면에 들어가야 함
  for(let i = 0; i < 24; i++) DB.players['uidX' + i] = { name:`선수${i + 1}`, w:i, l:3, d:i % 2, g:i + 3 + (i % 2), r:900 + i * 9, last:'1234/1700000000001', at:1 };
  const tabs = await guest.evaluate(() => { go(rankMeScreen, 'key'); return [UI.S.say.join(' | '), UI.S.opts.map(o => o.t).join(',')]; });
  check(/통산 \d+경기/.test(tabs[0]) && /센터장님과: /.test(tabs[0]) && /점수 \d+점, 순위 \d+위/.test(await guest.evaluate(async () => { await rkLoadMe(true); return rkSumLine(); })), '손님 내 전적 글이 이상함: ' + tabs[0]);
  await guest.evaluate(() => go(rankTopScreen, 'key'));
  await guest.waitForFunction(() => RK.top && RK.top.list.length === 20, null, { timeout:8000 });
  const gTop = await guest.$eval('#say', e => e.textContent);
  check(/1위 /.test(gTop) && /20위 /.test(gTop), '손님 순위표 글에 20명이 없음');
  console.log('순위표(소리와 글):', gTop.replace(/\s+/g, ' ').slice(0, 120));
  for(const [name, w, h] of [['휴대폰', 390, 844], ['작은 휴대폰', 360, 640], ['가로', 844, 390], ['태블릿', 820, 1180]]){
    const p = await open(`화면 보며 하기(${name})`, name === '휴대폰' ? 'uidHost' : 'uidX3', 'gfx', '센터장', w, h);
    await p.evaluate(() => { localStorage.setItem('bb_rkh', JSON.stringify(Array.from({ length:50 }, (_, i) => ({ id:'1234/' + (1700000000100 + i), opp:'o' + (i % 7), on:'상대' + (i % 7), mt:TEAMS[i % 10].key, ot:TEAMS[(i + 3) % 10].key, ms:i % 5, os:(i * 3) % 4, role:'host', at:Date.now() - i * 864e5 })))); localStorage.setItem('bb_rkvs', JSON.stringify(Object.fromEntries(Array.from({ length:7 }, (_, i) => ['o' + i, { n:'상대' + i, w:i, l:2, d:0, at:Date.now() - i * 1e6 }])))); });
    await p.evaluate(() => go(onlineHome, 'click')); await fits(p, `${p.tag} 온라인 첫 화면`);
    const ho = await p.$$eval('#sk [data-sk="opt"]', els => els.map(e => e.textContent).join(','));
    check(/내 전적/.test(ho) && /순위표/.test(ho), `${p.tag}: 온라인 첫 화면에 내 전적·순위표 단추가 없음`);
    await p.click('#sk [data-sk="opt"][data-n="6"]');
    await p.waitForFunction(() => UI.make === rankMeScreen && RK.meAt > 0, null, { timeout:8000 });
    await fits(p, `${p.tag} 내 전적`); await shot(p, `rk-me-${w}x${h}`);
    const nav = await p.evaluate(() => { const n = document.querySelector('.rk-list .pg-nav'); return n && !n.hidden ? n.textContent : ''; });
    check(/1 \/ \d/.test(nav), `${p.tag}: 최근 경기 50개에 쪽 넘기기가 없음`);
    await p.click('#sk .rk-tabs button:not(.on)'); await fits(p, `${p.tag} 상대별 전적`);
    check(await p.evaluate(() => document.querySelectorAll('.rk-v').length === 7), `${p.tag}: 상대별 전적 7명이 아님`);
    await shot(p, `rk-vs-${w}x${h}`);
    await p.click('#sk .rk-act [data-n="3"]');
    await p.waitForFunction(() => RK.top && !RK.loading.top && document.querySelector('.rk-row'), null, { timeout:8000 });
    await fits(p, `${p.tag} 순위표`); await shot(p, `rk-top-${w}x${h}`);
    const me = await p.evaluate(() => { const e = document.querySelector('.rk-row.me'); return e ? e.textContent : ''; });
    check(!!me, `${p.tag}: 순위표에 내 줄이 빛나지 않음`);
    // 로비: 지금 상대와의 전적
    await p.evaluate(() => { Object.assign(NET, { on:true, role:'host', code:'1234', side:0, peer:{ uid:'o2', name:'상대2' }, cfg:{ mode:'simple', unit:'pa', innings:3, hostTeam:TEAMS[0].key, guestTeam:TEAMS[1].key, hostSide:0 } }); G = null; go(lobbyScreen, 'click'); });
    const ln = await p.evaluate(() => UI.S.note.join(' '));
    check(/상대2님과의 상대 전적: 2승 2패/.test(ln), `${p.tag}: 로비에 상대 전적이 없음 ${ln}`);
    await fits(p, `${p.tag} 로비`);
    await p.evaluate(() => { NET.on = false; });
    await p.context().close();
  }

  // 4. 연결 오류: 서버가 막거나 인터넷이 끊기면 한국어로 알림
  for(const [code, re] of [['PERMISSION_DENIED', /서버가 허락하지 않았습니다/], ['network-request-failed', /인터넷에 연결되지 않았습니다/]]){
    MOCK.fail = code;
    await guest.evaluate(() => { go(onlineHome, 'key'); rkLoadTop(true); go(rankTopScreen, 'key'); });
    await guest.waitForFunction(() => RK.top && !RK.loading.top, null, { timeout:8000 });
    const t = await guest.$eval('#say', e => e.textContent);
    check(re.test(t), `${code}: 순위표 오류 안내가 없음 (${t})`);
    console.log(`${code}:`, t.trim());
  }
  // 연결이 끊긴 동안 끝난 경기는 이 기기에 남고, 다시 연결되면 올라감
  {
    const at = 1700000000077, id = '1234/' + at;
    await finish(host, 'host', 31, at); await finish(guest, 'guest', 31, at);
    await host.waitForTimeout(800);
    const q = await Promise.all([host, guest].map(p => p.evaluate(() => rkQ().length)));
    check(q[0] === 1 && q[1] === 1, '끊긴 동안 결과가 대기열에 없음 ' + q);
    const loc = await guest.evaluate(i => rkHist().some(m => m.id === i), id);
    check(loc, '끊긴 동안 끝난 경기가 이 기기 기록에 없음');
    MOCK.fail = null;
    await Promise.all([host, guest].map(p => p.evaluate(() => { RK.polls = 0; rankSync(); })));
    const [a, b] = await Promise.all([done(host, id), done(guest, id)]);
    check(a && b, '다시 연결된 뒤 올라가지 않음');
    check(DB.players.uidHost.g === games.length + 1, '다시 연결된 뒤 경기 수가 틀림 ' + DB.players.uidHost.g);
  }

  await browser.close(); srv.kill();
  if(errors.length){ console.log('오류:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
  console.log('오류 없음');
})().catch(e => { console.error(e); process.exit(1); });
