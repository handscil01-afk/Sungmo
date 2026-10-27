'use strict';
/* ===================== 경기 계산 =====================
   화면과 따로 동작함. 경기 상태(G)는 JSON으로 저장할 수 있는 값만 담고, 난수 씨앗도 G 안에 둠
   (온라인 대전에서 방장 기기가 계산하고 상태를 보낼 때도 그대로 씀).
   결과 문장은 G.log에 쌓이고, 한 번의 선택으로 생긴 문장은 flush()로 꺼내 화면에 보여 줌.
   문장 종류(k): p 투구 · r 타석 결과 · i 이닝·점수 · n 타자 소개 · c 교체·작전 · d 판정 과정(주사위) */

/* ---------- 난수 (mulberry32) ---------- */
function rnd(G){
  let t = (G.rng = (G.rng + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rint = (G, a, b) => a + Math.floor(rnd(G) * (b - a + 1));
const pickOne = (G, arr) => arr[Math.floor(rnd(G) * arr.length)];
function gauss(G){ let u = 0; while(!u) u = rnd(G); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd(G)); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// [[값, 무게], ...] 중에서 하나
function wpick(G, items){
  const tot = items.reduce((s, x) => s + Math.max(0, x[1]), 0);
  let r = rnd(G) * tot;
  for(const x of items){ r -= Math.max(0, x[1]); if(r < 0) return x[0]; }
  return items[items.length - 1][0];
}
// 확률 p로 성공하는지 주사위(1~100)로 판정하고, 판정 과정을 남김
function check(G, label, p, okWord, failWord){
  p = clamp(p, 0, 1);
  const d = rint(G, 1, 100), ok = d <= Math.round(p * 100);
  emit(G, `판정 ${label}: 확률 ${Math.round(p * 100)}퍼센트, 주사위 ${d}, ${ok ? okWord : failWord}.`, 'd');
  return ok;
}

/* ---------- 한국어 조사 ---------- */
const ga = w => josa(w, '이', '가');
function josa(w, a, b){
  const c = String(w).charCodeAt(String(w).length - 1);
  if(c < 0xAC00 || c > 0xD7A3) return w + b;
  const jong = (c - 0xAC00) % 28;
  if(a === '으로') return w + (jong === 0 || jong === 8 ? '로' : '으로');
  return w + (jong ? a : b);
}

/* ---------- 문장 남기기 ---------- */
function emit(G, s, k = 'p'){
  const e = { s, k, n: ++G.seq };
  G.log.push(e);
  if(G.log.length > 1500) G.log.splice(0, G.log.length - 1500);
  G.out.push(e);
}
function fx(G, name){ G.fx.push(name); }
// 이번 선택으로 생긴 문장과 효과음을 꺼냄
function flush(G){ const r = { lines: G.out, fx: G.fx }; G.out = []; G.fx = []; return r; }

/* ---------- 선수 만들기 ---------- */
function newName(G){
  for(let i = 0; i < 200; i++){
    const n = pickOne(G, SURNAMES) + pickOne(G, GIVEN1) + pickOne(G, GIVEN2);
    if(!G.names.includes(n)){ G.names.push(n); return n; }
  }
  return '선수' + G.names.length;
}
const stat = (G, m) => clamp(Math.round(m + gauss(G) * 11), 20, 99);
const condRoll = G => wpick(G, [[-2, 7], [-1, 20], [0, 46], [1, 20], [2, 7]]);
// 타순별 성향: 1·2번은 빠르고 정확하게, 3~5번은 힘 있게, 하위 타순은 조금 약하게
const SLOT_TILT = [
  { spd:14, con:6, pow:-10, eye:6 }, { con:8, spd:6, pow:-6, eye:4 }, { con:8, pow:8 }, { pow:16, con:2 }, { pow:10 },
  { pow:2 }, {}, { con:-6, pow:-4, spd:-10 }, { con:-6, pow:-6, spd:6 },
];
function makeBatter(G, S, slot, bias){
  const t = SLOT_TILT[slot], pos = LINEUP_POS[slot], m = S.bat;
  const v = k => stat(G, 50 + (t[k] || 0) + (m[k] || 0) + bias);
  const defBonus = ['C', 'SS', '2B', 'CF'].includes(pos) ? 10 : ['1B', 'DH'].includes(pos) ? -8 : 0;
  return { id: 'b' + G.names.length, name: newName(G), pos, hand: rnd(G) < 0.36 ? 'L' : 'R',
    con: v('con'), pow: v('pow'), eye: v('eye'), spd: v('spd'), def: stat(G, 50 + defBonus + bias),
    aggr: clamp(Math.round(50 + gauss(G) * 14 + S.aggr), 5, 95), cond: condRoll(G), seen: false,
    st: { pa:0, ab:0, h:0, hr:0, rbi:0, bb:0, k:0, r:0, sb:0 } };
}
function makePitcher(G, S, starter, bias){
  const m = S.pit;
  const extras = [];
  const pool = [['SL', 25], ['CU', 15], ['CH', 20], ['FK', 15], ['SI', 12], ['CT', 13]];
  const want = starter ? 3 : 2;
  while(extras.length < want){ const t = wpick(G, pool.filter(x => !extras.includes(x[0]))); extras.push(t); }
  const pitches = [{ t:'FB', g: stat(G, 55 + bias) }, ...extras.map(t => ({ t, g: stat(G, 52 + bias) }))];
  return { id: 'p' + G.names.length, name: newName(G), pos:'P', hand: rnd(G) < 0.3 ? 'L' : 'R', starter,
    vel: clamp(Math.round(146 + gauss(G) * 3.5 + (m.vel || 0) + (starter ? 0 : 1) + bias / 4), 133, 162),
    ctl: stat(G, 52 + (m.ctl || 0) + bias), stf: stat(G, 52 + (m.stf || 0) + bias),
    sta: starter ? Math.round(clamp(88 + gauss(G) * 8 + (m.sta || 0), 65, 115)) : Math.round(clamp(32 + gauss(G) * 5, 20, 45)),
    pitches, cond: condRoll(G), n: 0, load: 0, used: starter, warned: 0,
    st: { out:0, h:0, r:0, bb:0, k:0, hr:0 } };
}
function makeTeam(G, key, bias){
  const info = teamInfo(key), S = STYLES[info.style];
  const T = { key, name: info.name, short: info.short, style: info.style, color: info.color,
    bat: [], pit: [], pi: 0, bi: 0, align: { inf:1, of:1 }, R: [], H: 0, E: 0, BB: 0, guess: null, lastSel: null };
  for(let i = 0; i < 9; i++) T.bat.push(makeBatter(G, S, i, bias));
  T.pit.push(makePitcher(G, S, true, bias));
  for(let i = 0; i < 4; i++) T.pit.push(makePitcher(G, S, false, bias));
  T.def = Math.round(T.bat.reduce((s, b) => s + b.def, 0) / 9 + S.def);
  return T;
}

/* ---------- 경기 시작 ----------
   o: { mode:'simple'|'detail', innings, teams:[원정 팀 키, 홈 팀 키], ctrl:['human'|'cpu', ...], who:[이름, 이름], diff:0~2, seed } */
const EXTRA_INN = 3;
function newGame(o){
  const G = { v:1, rng: (o.seed >>> 0) || (Date.now() >>> 0), seq:0, log:[], out:[], fx:[], names:[],
    mode: o.mode === 'simple' ? 'simple' : 'detail', innings: o.innings || 3, ctrl: o.ctrl || ['human', 'cpu'],
    who: o.who || ['', ''], diff: o.diff == null ? 1 : o.diff,
    inning:1, top:true, outs:0, balls:0, strikes:0, bases:[null, null, null], pitchNo:0, pa:0, half:0,
    over:false, winner:null, prev:null, lastLoc:null, at: Date.now() };
  // 컴퓨터 난이도: 쉬움이면 컴퓨터 팀 능력치를 조금 낮추고, 어려움이면 조금 높임
  const cpuBias = [-6, 0, 5][G.diff] || 0;
  G.teams = [0, 1].map(i => makeTeam(G, o.teams[i], G.ctrl[i] === 'cpu' && G.ctrl[1 - i] !== 'cpu' ? cpuBias : 0));
  if(G.mode === 'detail'){
    const dir = wpick(G, [['none', 15], ['out', 28], ['in', 25], ['lr', 16], ['rl', 16]]);
    G.wind = { dir, spd: dir === 'none' ? 0 : rint(G, 1, 8) };
  } else G.wind = { dir:'none', spd:0 };
  const [A, H] = G.teams;
  emit(G, `오늘 경기는 원정 ${A.name}, 홈 ${H.name}의 대결입니다. ${G.innings}이닝 경기입니다.`, 'i');
  if(G.mode === 'detail'){
    emit(G, `날씨: ${windText(G)}.`, 'i');
    G.teams.forEach(T => { const P = T.pit[0]; emit(G, `${T.short} 선발 투수 ${P.name}${P.cond >= 1 ? ', 몸이 가벼워 보입니다' : P.cond <= -1 ? ', 몸이 조금 무거워 보입니다' : ''}.`, 'n'); });
  }
  emit(G, `1회초, ${A.short}의 공격입니다.`, 'i');
  startPA(G);
  return G;
}
const windText = G => G.wind.dir === 'none' || !G.wind.spd ? '바람 없음' : `${WIND[G.wind.dir].name}, 초속 ${G.wind.spd}미터`;

/* ---------- 상태 읽기 ---------- */
const batTeam = G => G.teams[G.top ? 0 : 1];
const fieldTeam = G => G.teams[G.top ? 1 : 0];
const batIdx = G => G.top ? 0 : 1;
const curBatter = G => { const T = batTeam(G); return T.bat[T.bi]; };
const curPitcher = G => { const T = fieldTeam(G); return T.pit[T.pi]; };
const runsOf = T => T.R.reduce((a, b) => a + (b || 0), 0);
const fatigue = P => Math.max(0, (P.load - P.sta) / 25);
const gradeOf = (P, t) => (P.pitches.find(x => x.t === t) || { g:40 }).g;
const expVel = (P, t, w) => Math.round(P.vel * PITCH[t].spd + POWER[w].dv + P.cond * 0.8 - fatigue(P) * 4);
const halfName = G => `${G.inning}회${G.top ? '초' : '말'}`;
function basesText(b){
  const on = [0, 1, 2].filter(i => b[i] != null);
  if(!on.length) return '주자 없음';
  if(on.length === 3) return '만루';
  return '주자 ' + on.map(i => (i + 1) + '루').join(' ');
}
const countText = G => `${G.balls}볼 ${G.strikes}스트라이크`;
const scoreText = G => `${G.teams[0].short} ${runsOf(G.teams[0])}, ${G.teams[1].short} ${runsOf(G.teams[1])}`;
// 지금 상황 한 줄 (0번 키, 화면 낭독기용 상황 줄)
function situation(G){
  if(G.over) return `경기 끝. ${scoreText(G)}.`;
  const P = curPitcher(G), B = curBatter(G);
  return `${halfName(G)} ${batTeam(G).short} 공격. ${scoreText(G)}. ${G.outs}아웃 ${basesText(G.bases)}. ${countText(G)}. 타자 ${B.name}, 투수 ${P.name}${G.mode === 'detail' ? ` 투구 수 ${P.n}개` : ''}.`;
}
function scoreboard(G){
  return G.teams.map((T, ti) => {
    // 지금까지 공격한 이닝만 읽음 (진행 중인 이닝은 지금까지 점수)
    const played = ti === 0 ? G.inning : (G.top ? G.inning - 1 : G.inning);
    const inn = []; for(let i = 0; i < played; i++) inn.push(`${i + 1}회 ${T.R[i] || 0}`);
    return `${T.short}: ${inn.length ? inn.join(', ') + '. ' : '아직 공격 전. '}합계 ${runsOf(T)}점, 안타 ${T.H}, 볼넷 ${T.BB}, 실책 ${T.E}.`;
  });
}
const gradeWord = v => v >= 80 ? '아주 좋음' : v >= 65 ? '좋음' : v >= 45 ? '보통' : v >= 32 ? '약함' : '아주 약함';
const handText = (h, p) => (h === 'L' ? '왼손' : '오른손') + (p ? ' 투수' : ' 타자');
function batterLine(B){ const s = B.st; return `${s.ab}타수 ${s.h}안타${s.hr ? ` 홈런 ${s.hr}` : ''}${s.rbi ? ` 타점 ${s.rbi}` : ''}${s.bb ? ` 볼넷 ${s.bb}` : ''}`; }
// own: 우리 팀이면 숫자, 상대 팀이면 등급으로 (상대 컨디션은 첫 타석 뒤에만 보임)
function batterInfo(G, T, i, own){
  const B = T.bat[i], v = x => own ? x : gradeWord(x);
  return `${i + 1}번 ${POS[B.pos]} ${B.name}, ${handText(B.hand)}. 컨택 ${v(B.con)}, 파워 ${v(B.pow)}, 선구안 ${v(B.eye)}, 스피드 ${v(B.spd)}, 수비 ${v(B.def)}. ${B.aggr >= 62 ? '적극적으로 치는 편' : B.aggr <= 38 ? '신중하게 보는 편' : '보통 성향'}. ${own || B.seen ? `컨디션 ${COND[B.cond]}. ` : ''}오늘 ${batterLine(B)}.`;
}
function pitcherInfo(G, T, i, own){
  const P = T.pit[i], v = x => own ? x : gradeWord(x);
  const left = Math.round(clamp(1 - P.load / P.sta, 0, 1) * 100);
  const ps = P.pitches.map(x => `${PITCH[x.t].name} ${v(x.g)}`).join(', ');
  return `${P.starter ? '선발' : '불펜'} ${P.name}, ${handText(P.hand, true)}. 최고 구속 ${P.vel}킬로, 제구 ${v(P.ctl)}, 구위 ${v(P.stf)}. 구종: ${ps}. ${own ? `컨디션 ${COND[P.cond]}. ` : ''}투구 수 ${P.n}개, 체력 ${left}퍼센트.`;
}

/* ---------- 타석 시작 · 끝 ---------- */
function startPA(G){
  G.balls = 0; G.strikes = 0; G.pitchNo = 0; G.prev = null;
  if(G.ctrl[1 - batIdx(G)] === 'cpu' && typeof aiManage === 'function') aiManage(G);
  const T = batTeam(G), B = curBatter(G);
  B.st.pa++;
  let s = `${T.bi + 1}번 타자 ${POS[B.pos]} ${B.name}`;
  if(G.mode === 'detail') s += `, ${handText(B.hand)}`;
  s += B.st.pa > 1 ? `. 오늘 ${batterLine(B)}.` : '.';
  if(G.mode === 'detail' && !B.seen){
    B.seen = true;
    if(B.cond >= 2) s += ' 오늘 타격감이 아주 좋아 보입니다.';
    else if(B.cond === 1) s += ' 컨디션이 좋아 보입니다.';
    else if(B.cond === -1) s += ' 컨디션이 썩 좋아 보이지 않습니다.';
    else if(B.cond <= -2) s += ' 오늘 몸이 무거워 보입니다.';
  }
  emit(G, s, 'n');
  // 지친 투수 알림 (사람이 수비할 때 판단하도록)
  const P = curPitcher(G), f = fatigue(P);
  if(G.mode === 'detail' && f > 0.05 && P.warned < 1){ P.warned = 1; emit(G, `투수 ${P.name}, 투구 수 ${P.n}개. 공에 힘이 떨어지기 시작합니다.`, 'c'); }
  else if(G.mode === 'detail' && f > 0.6 && P.warned < 2){ P.warned = 2; emit(G, `투수 ${P.name}, 많이 지쳤습니다. 구속과 제구가 떨어집니다.`, 'c'); }
}
// keep: 타석이 끝나지 않았는데 3아웃(도루 실패 등)이면 같은 타자가 다음 이닝에 다시 나옴
function endPA(G, keep){
  G.pa++;
  const T = batTeam(G);
  if(keep) T.bat[T.bi].st.pa--; else T.bi = (T.bi + 1) % 9;
  G.balls = 0; G.strikes = 0; G.pitchNo = 0; G.prev = null;
  if(G.over) return;
  if(G.walkoff){ gameOver(G); return; }
  if(G.outs >= 3){ endHalf(G); return; }
  startPA(G);
}
function endHalf(G){
  const T = batTeam(G);
  if(T.R[G.inning - 1] == null) T.R[G.inning - 1] = 0;
  emit(G, `3아웃. ${halfName(G)} 끝. ${scoreText(G)}.`, 'i');
  fx(G, 'change');
  const a = runsOf(G.teams[0]), h = runsOf(G.teams[1]);
  if(G.top){
    if(G.inning >= G.innings && h > a){ gameOver(G); return; }
    G.top = false;
  } else {
    if(G.inning >= G.innings && a !== h){ gameOver(G); return; }
    if(G.inning >= G.innings + EXTRA_INN){ gameOver(G); return; }
    G.top = true; G.inning++;
    if(G.inning > G.innings) emit(G, '동점이라 연장전에 들어갑니다.', 'i');
  }
  G.outs = 0; G.bases = [null, null, null]; G.half++;
  if(G.mode === 'detail' && rnd(G) < 0.2){
    const before = windText(G);
    G.wind.spd = clamp(G.wind.spd + pickOne(G, [-2, -1, 1, 2]), 0, 9);
    if(G.wind.spd && G.wind.dir === 'none') G.wind.dir = pickOne(G, ['out', 'in', 'lr', 'rl']);
    if(!G.wind.spd) G.wind.dir = 'none';
    if(windText(G) !== before) emit(G, `바람이 바뀌었습니다: ${windText(G)}.`, 'i');
  }
  emit(G, `${halfName(G)}, ${batTeam(G).short}의 공격입니다.`, 'i');
  startPA(G);
}
function gameOver(G){
  G.over = true;
  const [A, H] = G.teams, a = runsOf(A), h = runsOf(H);
  if(!G.top && H.R[G.inning - 1] == null) H.R[G.inning - 1] = 0;
  G.winner = a > h ? 0 : h > a ? 1 : -1;
  const win = G.winner >= 0 ? G.teams[G.winner] : null;
  emit(G, `경기 끝! ${A.short} ${a} 대 ${h} ${H.short}. ${win ? (G.walkoff ? `${win.short}의 끝내기 승리입니다!` : `${win.short} 승리!`) : '무승부입니다.'}`, 'i');
  // 오늘의 선수: 안타·홈런·타점이 가장 좋은 타자
  let best = null, bv = -1;
  G.teams.forEach(T => T.bat.forEach(B => { const v = B.st.h + B.st.hr * 2 + B.st.rbi + B.st.bb * 0.3 + (T === win ? 0.5 : 0); if(v > bv){ bv = v; best = { T, B }; } }));
  if(best && bv > 0) emit(G, `오늘의 선수: ${best.T.short} ${best.B.name}, ${batterLine(best.B)}.`, 'i');
  fx(G, 'end');
}

/* ---------- 득점 · 주자 ---------- */
function scoreRuns(G, list, rbi){
  if(!list.length) return;
  const T = batTeam(G), B = curBatter(G), P = curPitcher(G);
  list.forEach(i => { T.R[G.inning - 1] = (T.R[G.inning - 1] || 0) + 1; T.bat[i].st.r++; P.st.r++; if(rbi) B.st.rbi++; });
  const names = list.map(i => T.bat[i].name).join(', ');
  emit(G, `${names} 홈인! ${list.length > 1 ? list.length + '점' : '1점'}. ${scoreText(G)}.`, 'r');
  fx(G, 'score');
  if(!G.top && G.inning >= G.innings && runsOf(G.teams[1]) > runsOf(G.teams[0])) G.walkoff = true;
}
function addOut(G, n = 1){ G.outs += n; curPitcher(G).st.out += n; }
// 볼넷·몸에 맞는 공·고의 볼넷: 밀려서 가는 주자만 감
function forceWalk(G){
  const b = G.bases, T = batTeam(G), sc = [];
  if(b[0] != null){
    if(b[1] != null){ if(b[2] != null) sc.push(b[2]); b[2] = b[1]; }
    b[1] = b[0];
  }
  b[0] = T.bi;
  scoreRuns(G, sc, true);
}
// n루타 (4는 홈런). ev: 타구 힘(0~1). simple: 간단 모드(주자 발 빠르기 무시)
function onHit(G, n, ev, simple){
  const T = batTeam(G), F = fieldTeam(G), b = G.bases, sc = [];
  const spd = i => simple ? 55 : T.bat[i].spd;
  if(n >= 4){ for(let k = 2; k >= 0; k--) if(b[k] != null){ sc.push(b[k]); b[k] = null; } sc.push(T.bi); scoreRuns(G, sc, true); return; }
  const nb = [null, null, null], ofAdj = [-0.18, 0, 0.1][F.align.of];
  for(let k = 2; k >= 0; k--){
    const r = b[k]; if(r == null) continue;
    let to = k + n;
    if(n === 1 && k === 1 && rnd(G) < clamp(0.55 + (spd(r) - 50) / 120 + (ev - 0.5) * 0.4 + ofAdj, 0.1, 0.95)) to = 3;
    else if(n === 1 && k === 0 && nb[2] == null && rnd(G) < clamp(0.22 + (spd(r) - 50) / 150, 0.05, 0.6)) to = 2;
    else if(n === 2 && k === 0 && rnd(G) < clamp(0.42 + (spd(r) - 50) / 120 + ofAdj, 0.1, 0.9)) to = 3;
    if(to >= 3) sc.push(r); else nb[to] = r;
  }
  nb[n - 1] = T.bi;
  G.bases = nb;
  scoreRuns(G, sc, true);
}
// 아웃이 된 플레이에서 다른 주자가 한 베이스씩 갈 때 (희생 번트·땅볼). hold3: 3루 주자는 멈춤
function advanceOnOut(G, opts = {}){
  const b = G.bases, sc = [];
  if(G.outs >= 3) return;
  const f2 = b[0] != null && b[1] != null, f3 = f2 && b[2] != null;   // 밀려서 꼭 가야 하는 주자
  if(b[2] != null && (f3 || !opts.hold3)){ sc.push(b[2]); b[2] = null; }
  if(b[1] != null && b[2] == null && (f2 || opts.all || rnd(G) < 0.75)){ b[2] = b[1]; b[1] = null; }
  if(b[0] != null && b[1] == null){ b[1] = b[0]; b[0] = null; }
  scoreRuns(G, sc, opts.rbi !== false);
}
const fielder = (T, pos) => { const p = T.bat.find(x => x.pos === pos); return `${POS[pos]} ${p ? p.name : ''}`.trim(); };
// 실책: 타자는 1루로, 주자는 한 베이스씩
function onError(G, pos){
  const F = fieldTeam(G), b = G.bases, sc = [];
  F.E++;
  emit(G, `아, ${fielder(F, pos)}의 실책! 타자는 1루에 나갑니다.`, 'r');
  fx(G, 'ball');
  if(b[2] != null) sc.push(b[2]);
  G.bases = [batTeam(G).bi, b[0], b[1]];
  scoreRuns(G, sc, false);
}
const errorChance = F => clamp(0.018 + (60 - F.def) / 2000, 0.004, 0.05);

/* ---------- 도루 ---------- */
function canSteal(G){ const b = G.bases; return (b[0] != null && b[1] == null) || (b[1] != null && b[2] == null); }
function doSteal(G, simple, breaking){
  const b = G.bases, T = batTeam(G), F = fieldTeam(G);
  const from = (b[1] != null && b[2] == null) ? 1 : (b[0] != null && b[1] == null) ? 0 : -1;
  if(from < 0) return;
  const r = b[from], R = T.bat[r], C = F.bat.find(x => x.pos === 'C');
  const sp = simple ? 55 : R.spd, arm = simple ? 50 : (C ? C.def : 50);
  const p = 0.64 + (sp - 55) / 90 - (arm - 50) / 250 - (from === 1 ? 0.1 : 0) + (breaking ? 0.06 : 0);
  const to = from === 1 ? '3루' : '2루';
  if(check(G, '도루', simple ? 0.6 : p, '세이프', '아웃')){
    b[from + 1] = r; b[from] = null; R.st.sb++;
    emit(G, `${R.name}, ${to} 도루 성공!`, 'r'); fx(G, 'safe');
  } else {
    b[from] = null; addOut(G);
    emit(G, `${R.name}, ${to} 도루 실패. ${simple ? '포수' : fielder(F, 'C')}의 송구에 아웃됩니다. ${G.outs}아웃.`, 'r'); fx(G, 'out');
  }
}

/* ---------- 코스 ---------- */
// 겨냥한 곳: x(-몸쪽 ~ +바깥쪽), y(+높게 ~ -낮게). 스트라이크 존은 -1~1
function aimXY(sel){
  const cx = [-1, 0, 1][sel.c], cy = [1, 0, -1][sel.r];
  const m = { in:0.55, edge:0.90, out:1.28 }[sel.e || 'in'];
  return { x: cx * m, y: cy * m };
}
function locText(x, y){
  const inZ = Math.abs(x) <= 1 && Math.abs(y) <= 1;
  if(inZ){
    const hh = y > 0.34 ? '높은 ' : y < -0.34 ? '낮은 ' : '';
    const ss = x < -0.34 ? '몸쪽' : x > 0.34 ? '바깥쪽' : (hh ? '가운데' : '한가운데');
    return hh + ss;
  }
  const far = Math.max(Math.abs(x), Math.abs(y)) > 1.55;
  const hz = x < -1 ? '몸쪽' : x > 1 ? '바깥쪽' : '', vt = y > 1 ? '높게' : y < -1 ? '낮게' : '';
  const where = hz && vt ? `${hz} ${vt}` : hz ? `${hz}으로` : vt;
  return `${where} ${far ? '크게 ' : ''}빠지는`;
}
const selText = s => s.k === 'ibb' ? '고의 볼넷' :
  `${PITCH[s.t].name}, ${ZONE_NAME[s.r][s.c]}${s.r === 1 && s.c === 1 ? '' : ', ' + EDGE[s.e || 'in'].name}, ${POWER[s.w || 2].name}`;

/* ---------- 투구 한 개 (정밀 모드) ----------
   P(수비): { k:'pitch', t:구종, r:행, c:열, e:'in'|'edge'|'out', w:1~3 } 또는 { k:'ibb' }
   B(공격): { k:'swing'|'power'|'contact'|'take'|'bunt'|'steal', g:null|'fast'|'break' } */
function playPitch(G, Psel, Bsel){
  if(G.over) return flush(G);
  const F = fieldTeam(G), T = batTeam(G), P = curPitcher(G), B = curBatter(G);
  if(Psel.k === 'ibb'){
    emit(G, `고의 볼넷. ${josa(B.name, '을', '를')} 1루로 내보냅니다.`, 'r');
    B.st.bb++; T.BB++; P.st.bb++;
    forceWalk(G); fx(G, 'ball'); endPA(G); return flush(G);
  }
  F.lastSel = { ...Psel };
  G.pitchNo++; P.n++; P.load += POWER[Psel.w].cost;
  const pt = PITCH[Psel.t], vel = expVel(P, Psel.t, Psel.w) + Math.round(gauss(G) * 0.8);
  const pq = 0.45 * P.stf + 0.35 * gradeOf(P, Psel.t) + (pt.fast ? (vel - 147) * 0.7 : 4) + POWER[Psel.w].q + P.cond * 4 - fatigue(P) * 14;
  // 제구: 겨냥한 곳에서 얼마나 벗어나는지
  const aim = aimXY(Psel);
  const sig = 0.25 * (1.45 - P.ctl / 100) * POWER[Psel.w].err * pt.err * (1 + fatigue(P) * 0.8) * (1 - P.cond * 0.06);
  const x = aim.x + gauss(G) * sig, y = aim.y + gauss(G) * sig;
  const zd = Math.max(Math.abs(x), Math.abs(y)), inZone = zd <= 1;
  G.lastLoc = { x, y };
  emit(G, `판정 제구: 오차 ${Math.round(Math.hypot(x - aim.x, y - aim.y) * 100)}, ${inZone ? '스트라이크 존 안' : '존 밖'}.`, 'd');
  let head = `제${G.pitchNo}구, ${pt.name} ${vel}킬로, ${locText(x, y)} 공.`;
  if(Psel.e !== 'in' && zd < 0.42) head += ' 실투, 가운데로 몰렸습니다!';
  else if(zd > 1.45 && Psel.e !== 'out') head += ' 제구가 크게 흔들립니다.';
  // 타이밍: 직전 공과 구속 차이가 크면 타자가 속음
  let timing = 0;
  if(G.prev){
    if(G.prev.fast && !pt.fast && G.prev.vel - vel >= 12) timing = -6;
    else if(G.prev.t === Psel.t) timing = 4;
  }
  G.prev = { t: Psel.t, vel, fast: pt.fast };
  const k = Bsel.k, swingIntent = k === 'swing' || k === 'power' || k === 'contact';
  const breaking = !pt.fast;
  const end = () => { endPA(G); return flush(G); };
  const strikeCall = () => { const border = zd > 0.95 && zd < 1.05; if(!border) return inZone; return rnd(G) < clamp(0.5 - (zd - 1) * 8, 0.1, 0.9); };
  // 공을 치지 않았을 때: 볼·스트라이크 판정
  const taken = (why) => {
    // 몸쪽으로 크게 빠지면 몸에 맞을 수 있음
    if(x < -1.6 && rnd(G) < clamp(0.15 + (-1.6 - x) * 1.2, 0, 0.7)){
      emit(G, `${head} 아, 몸에 맞습니다. 몸에 맞는 공으로 1루에 나갑니다.`, 'r');
      B.st.bb++; T.BB++; P.st.bb++; forceWalk(G); fx(G, 'ball'); return 'end';
    }
    const strike = strikeCall(), border = zd > 0.95 && zd < 1.05;
    if(strike){
      G.strikes++; fx(G, 'mitt');
      if(G.strikes >= 3){
        emit(G, `${head} ${why}${border ? '아슬아슬하게 ' : ''}스트라이크! 루킹 삼진.`, 'r');
        B.st.ab++; B.st.k++; P.st.k++; addOut(G); fx(G, 'k'); return 'end';
      }
      emit(G, `${head} ${why}${border ? '아슬아슬하게 ' : ''}스트라이크. ${countText(G)}.`, 'p');
    } else {
      G.balls++; fx(G, 'mitt');
      if(G.balls >= 4){
        emit(G, `${head} ${why}${border ? '아슬아슬하게 ' : ''}볼. 볼넷으로 1루에 나갑니다.`, 'r');
        B.st.bb++; T.BB++; P.st.bb++; forceWalk(G); fx(G, 'ball'); return 'end';
      }
      emit(G, `${head} ${why}${border ? '아슬아슬하게 ' : ''}볼. ${countText(G)}.`, 'p');
    }
    return 'go';
  };

  /* 번트 */
  if(k === 'bunt') return bunt(G, { head, x, y, zd, inZone, vel, B, P, taken, end });

  /* 치지 않기 (지켜보기 · 도루) */
  let swing = false;
  if(swingIntent){
    if(inZone) swing = true;
    else {
      const eye = B.eye + B.cond * 4 + (k === 'contact' ? 8 : k === 'power' ? -10 : 0);
      const lure = pt.chase * ((y < 0 || x > 0) ? 1 : 0.5);
      swing = !check(G, '선구안', (eye / 100) * (0.6 + (zd - 1) * 2.0) - lure, '참음', '방망이가 나감');
    }
  }
  if(!swing){
    const why = !swingIntent ? (inZone && zd < 0.5 ? '그대로 지켜봅니다. ' : '지켜봅니다. ') : '끝까지 참아 냅니다. ';
    const r = taken(why);
    if(k === 'steal' && r !== 'end' && G.outs < 3) doSteal(G, false, breaking);
    else if(k === 'steal' && r === 'end' && G.outs < 3 && G.strikes >= 3) doSteal(G, false, breaking);
    if(r === 'end') return end();
    if(G.outs >= 3){ endPA(G, true); return flush(G); }
    return flush(G);
  }

  /* 휘두름 */
  const guess = Bsel.g ? (Bsel.g === 'fast') === pt.fast ? 9 : -7 : 0;
  const bq = B.con + B.cond * 4 + ({ swing:0, power:-12, contact:10 })[k] + guess + timing;
  const cen = clamp(1 - zd, 0, 1);
  const pCon = 0.84 + (bq - pq) / 110 - (inZone ? 0.12 * (1 - cen) : 0.14 + (zd - 1) * 1.0);
  const chaseWord = inZone ? '' : '볼에 방망이가 나갑니다. ';
  if(guess > 0) emit(G, '노리던 공이 들어옵니다.', 'd');
  if(timing < 0) emit(G, '느린 공에 타이밍을 빼앗깁니다.', 'd');
  if(!check(G, '맞히기', pCon, '맞힘', '헛스윙')){
    G.strikes++; fx(G, 'whiff');
    if(G.strikes >= 3){
      emit(G, `${head} ${chaseWord}헛스윙! 삼진 아웃.`, 'r');
      B.st.ab++; B.st.k++; P.st.k++; addOut(G); fx(G, 'k'); return end();
    }
    emit(G, `${head} ${chaseWord}헛스윙. ${countText(G)}.`, 'p');
    return flush(G);
  }
  // 맞힘: 파울인지 안으로 들어갔는지
  const pFair = clamp(0.46 + (bq - pq) / 300 + (inZone ? 0.10 * cen : -0.12) - (k === 'contact' && G.strikes === 2 ? 0.06 : 0), 0.25, 0.75);
  if(rnd(G) >= pFair){
    fx(G, 'foul');
    if(rnd(G) < 0.03){
      const pos = pickOne(G, ['C', '1B', '3B']);
      emit(G, `${head} ${chaseWord}높이 뜬 파울, ${ga(fielder(F, pos))} 잡습니다. 파울 플라이 아웃.`, 'r');
      B.st.ab++; addOut(G); fx(G, 'out'); return end();
    }
    if(G.strikes < 2) G.strikes++;
    emit(G, `${head} ${chaseWord}파울. ${countText(G)}.`, 'p');
    return flush(G);
  }
  fx(G, 'bat');
  const q = clamp(rnd(G) * 0.75 + 0.08 + (bq - pq) / 220 + (inZone ? 0.18 * cen : -0.12), 0, 1);
  const ev = clamp(0.45 * q + 0.45 * (B.pow + B.cond * 4) / 100 + ({ swing:0, power:0.07, contact:-0.07 })[k] + (pt.fast && vel >= 153 ? 0.02 : 0) + gauss(G) * 0.035, 0, 1.08);
  emit(G, `판정 타구: 정확도 ${Math.round(q * 100)}, 힘 ${Math.round(ev * 100)}.`, 'd');
  inPlay(G, { head: head + ' ' + chaseWord, x, y, q, ev, k, pt });
  return end();
}

/* ---------- 번트 ---------- */
function bunt(G, o){
  const { head, zd, inZone, vel, B, taken, end } = o;
  const F = fieldTeam(G), inf = F.align.inf;
  if(zd > 1.35){   // 너무 빠지면 방망이를 거둠
    const r = taken('번트 자세에서 방망이를 거둡니다. ');
    return r === 'end' ? end() : flush(G);
  }
  const pC = 0.74 + (B.con - 50) / 250 - (inZone ? 0 : (zd - 1) * 0.8) - (vel >= 151 ? 0.05 : 0);
  if(!check(G, '번트', pC, '공을 굴림', '파울')){
    G.strikes++; fx(G, 'foul');
    if(G.strikes >= 3){ emit(G, `${head} 번트 파울! 쓰리번트 실패로 삼진 아웃.`, 'r'); B.st.ab++; B.st.k++; curPitcher(G).st.k++; addOut(G); fx(G, 'k'); return end(); }
    emit(G, `${head} 번트를 댔지만 파울. ${countText(G)}.`, 'p');
    return flush(G);
  }
  fx(G, 'bunt');
  buntResult(G, head + ' 번트!', false);
  return end();
}
// 번트 타구 결과 (정밀·간단 공통)
function buntResult(G, head, simple){
  const F = fieldTeam(G), T = batTeam(G), B = curBatter(G), b = G.bases, inf = F.align.inf;
  const spd = simple ? 55 : B.spd, runners = b.some(x => x != null);
  const pos = pickOne(G, ['P', '1B', '3B']), who = pos === 'P' ? '투수' : fielder(F, pos);
  const pHit = 0.06 + (spd - 50) / 300 + [-0.04, 0, 0.1][inf] + (runners ? 0 : 0.08);
  const r = rnd(G);
  if(r < pHit){
    emit(G, `${head} ${who} 쪽으로 절묘하게 굴러갑니다. 번트 안타!`, 'r');
    B.st.ab++; B.st.h++; T.H++; curPitcher(G).st.h++; fx(G, 'safe'); onHit(G, 1, 0.2, simple); return;
  }
  if(r < pHit + 0.06){
    emit(G, `${head} 공이 떠 버립니다. ${ga(who)} 잡아 아웃.`, 'r');
    B.st.ab++; addOut(G); fx(G, 'out'); return;
  }
  if(!runners){
    emit(G, `${head} ${ga(who)} 잡아 1루로. 아웃.`, 'r'); B.st.ab++; addOut(G); fx(G, 'out'); return;
  }
  // 앞 주자가 잡히는 경우 (전진 수비면 더 자주)
  const lead = b[2] != null ? 2 : b[1] != null ? 1 : 0;
  if(r < pHit + 0.06 + 0.13 + (inf === 0 ? 0.15 : 0) && (lead < 2 || inf === 0)){
    const R = T.bat[b[lead]];
    emit(G, `${head} ${ga(who)} 잡아 ${lead === 2 ? '홈으로' : (lead + 2) + '루로'} 던집니다. 앞 주자 ${R.name} 아웃, 타자는 1루에.`, 'r');
    B.st.ab++; addOut(G); fx(G, 'out');
    const nb = [T.bi, null, null];
    for(let k = 0; k < 3; k++) if(b[k] != null && k !== lead){ const to = k + 1; if(to < 3) nb[to] = b[k]; }
    G.bases = nb; return;
  }
  emit(G, `${head} ${ga(who)} 잡아 1루에서 아웃. 희생 번트 성공, 주자는 한 베이스씩 나아갑니다.`, 'r');
  addOut(G); fx(G, 'out');
  advanceOnOut(G, { all:true, hold3: inf === 0 && rnd(G) < 0.4 });
}

/* ---------- 인플레이 타구 (정밀 모드) ---------- */
function inPlay(G, o){
  const { x, y, q, ev, k, pt } = o;
  const F = fieldTeam(G), T = batTeam(G), B = curBatter(G), P = curPitcher(G);
  const inf = F.align.inf, of = F.align.of, defMod = (60 - F.def) / 300;
  // 방향: 몸쪽 공은 당겨 치기 쉬움
  let pull = 0.42; if(x < -0.3) pull += 0.15; if(x > 0.3) pull -= 0.15;
  const side = wpick(G, [['pull', pull], ['cen', 0.33], ['oppo', 1 - pull - 0.33]]);
  const fi = side === 'cen' ? 1 : (side === 'pull') === (B.hand === 'R') ? 0 : 2;   // 0 왼쪽 · 1 가운데 · 2 오른쪽
  const pGB = 0.42 - y * 0.10 + pt.gb - (B.pow - 50) / 500 - (k === 'power' ? 0.07 : 0) + (k === 'contact' ? 0.04 : 0);
  const pPU = 0.05 + (q < 0.25 ? 0.10 : 0), pLD = 0.16 + q * 0.12;
  const type = wpick(G, [['gb', pGB], ['pu', pPU], ['ld', pLD], ['fb', 1 - pGB - pPU - pLD]]);
  const head = o.head.trim();
  const hit = (n, text) => {
    B.st.ab++; B.st.h++; T.H++; P.st.h++;
    if(n === 4){ B.st.hr++; P.st.hr++; fx(G, 'hr'); } else fx(G, n >= 2 ? 'xbh' : 'hit');
    emit(G, `${head} ${text}`, 'r');
    onHit(G, n, ev, false);
  };
  const out = (text, extra) => { B.st.ab++; addOut(G); emit(G, `${head} ${text} ${G.outs}아웃.`, 'r'); fx(G, 'out'); if(extra) extra(); };
  const gapName = fi === 0 ? '좌중간' : fi === 2 ? '우중간' : '중견수 쪽';
  const lineName = fi === 0 ? '3루선을 따라 좌익선상' : fi === 2 ? '1루선을 따라 우익선상' : '가운데';

  if(type === 'pu'){
    const pos = pickOne(G, ['SS', '2B', '3B', '1B', 'C']);
    out(`높이 떴습니다. 내야 뜬공, ${ga(fielder(F, pos))} 잡습니다.`);
    return;
  }
  if(type === 'gb'){
    const pos = fi === 0 ? pickOne(G, ['3B', 'SS']) : fi === 2 ? pickOne(G, ['2B', '1B']) : pickOne(G, ['SS', '2B']);
    const slow = ev < 0.35;
    let pHit = slow ? 0.13 + (B.spd - 50) / 220 + [-0.08, 0, 0.08][inf]
                    : 0.27 + (ev - 0.5) * 0.35 + [0.07, 0, -0.04][inf] + (B.spd - 50) / 500;
    pHit += defMod;
    if(check(G, '땅볼 안타', pHit, '빠져나감', '잡힘')){
      if(slow){ hit(1, `느린 땅볼, ${ga(fielder(F, pos))} 달려 나와 던지지만 세이프! 내야 안타.`); return; }
      if(ev > 0.65 && fi !== 1 && rnd(G) < 0.3){ hit(2, `빠른 땅볼이 ${josa(lineName, '으로', '로')} 빠져나갑니다. 2루타!`); return; }
      hit(1, `땅볼이 ${fi === 0 ? '3루수와 유격수 사이' : fi === 2 ? '1루수와 2루수 사이' : '투수 옆'}를 빠져나갑니다. 안타!`); return;
    }
    if(rnd(G) < errorChance(F)){ B.st.ab++; onError(G, pos); return; }
    groundOut(G, head, pos, inf);
    return;
  }
  if(type === 'ld'){
    let pHit = 0.67 + (ev - 0.5) * 0.4 + [0.04, 0, -0.02][inf] + defMod;
    const pos = pickOne(G, fi === 0 ? ['3B', 'SS', 'LF'] : fi === 2 ? ['2B', '1B', 'RF'] : ['SS', '2B', 'CF']);
    if(check(G, '직선 타구 안타', pHit, '떨어짐', '잡힘')){
      const p2 = clamp(0.16 + (ev - 0.5) * 1.0 + [0.12, 0, -0.08][of], 0.05, 0.65);
      if(rnd(G) < p2){
        if(B.spd >= 62 && rnd(G) < 0.10 + (B.spd - 62) / 150){ hit(3, `날카로운 타구가 ${gapName}을 완전히 가릅니다. 3루타!`); return; }
        hit(2, `날카로운 타구가 ${gapName}을 가릅니다. 2루타!`); return;
      }
      hit(1, `날카로운 직선 타구, ${fi === 0 ? '좌익수' : fi === 2 ? '우익수' : '중견수'} 앞 안타!`); return;
    }
    out(`잘 맞은 직선 타구, 그러나 ${fielder(F, pos)} 정면. 직선타 아웃.`, () => {
      // 뛰어나갔던 주자가 돌아오지 못하면 함께 아웃
      const b = G.bases, on = [0, 1, 2].filter(i => b[i] != null);
      if(on.length && G.outs < 3 && rnd(G) < 0.08){ const i = on[on.length - 1]; const R = T.bat[b[i]]; b[i] = null; addOut(G); emit(G, `${R.name}, 돌아가지 못해 함께 아웃! 더블 플레이. ${G.outs}아웃.`, 'r'); }
    });
    return;
  }
  // 뜬공: 비거리와 바람
  const wind = (WIND[G.wind.dir] || WIND.none).f[fi] * G.wind.spd * 1.6;
  const raw = 36 + ev * 104 + gauss(G) * 5, d = Math.round(raw + wind), fence = FENCE[fi];
  const posOF = ['LF', 'CF', 'RF'][fi], ofName = fielder(F, posOF);
  emit(G, `판정 비거리: ${Math.round(raw)}미터${wind ? `, 바람 ${wind > 0 ? '더하기' : '빼기'} ${Math.abs(Math.round(wind))}미터` : ''}, 담장 ${fence}미터.`, 'd');
  const field = ['왼쪽', '가운데', '오른쪽'][fi];
  if(d >= fence){
    let text;
    if(raw < fence && wind > 0) text = `높이 뜬 타구, ${josa(field, '으로', '로')} 날아갑니다. 바람을 타고, 타고… 담장을 간신히 넘어갑니다! 홈런! 비거리 ${d}미터.`;
    else if(d >= fence + 20) text = `큰 타구! ${field} 담장을 훌쩍 넘어가는 대형 홈런! 비거리 ${d}미터.`;
    else if(d < fence + 4) text = `${field} 깊숙한 타구, ${ga(ofName)} 뒤로, 뒤로… 담장을 살짝 넘어갑니다! 홈런! 비거리 ${d}미터.`;
    else text = `큰 타구! ${field} 담장을 넘어갑니다. 홈런! 비거리 ${d}미터.`;
    hit(4, text);
    return;
  }
  const sacFly = () => {
    const b = G.bases;
    if(G.outs < 3 && b[2] != null && d >= 62){
      const R = T.bat[b[2]];
      const pS = clamp(0.6 + (d - 62) / 60 + (R.spd - 50) / 200, 0.3, 0.97);
      if(rnd(G) < pS){ const r = b[2]; b[2] = null; emit(G, `3루 주자 ${R.name}, 태그업해서 홈으로! 희생 플라이.`, 'r'); B.st.ab--; scoreRuns(G, [r], true); }
    }
    if(G.outs < 3 && b[1] != null && b[2] == null && d >= 85 && rnd(G) < 0.5){ b[2] = b[1]; b[1] = null; emit(G, '2루 주자는 3루까지 갑니다.', 'r'); }
  };
  if(d < 40){ out(`높이 떴지만 멀리 가지 못합니다. ${ga(fielder(F, pickOne(G, ['SS', '2B'])))} 잡습니다.`); return; }
  if(d < 58){
    if(check(G, '짧은 뜬공 안타', [0.10, 0.28, 0.48][of] + defMod, '앞에 떨어짐', '잡힘')){ hit(1, `빗맞은 타구가 ${ofName} 앞에 뚝 떨어집니다. 안타!`); return; }
    out(`짧은 뜬공, ${ga(ofName)} 달려 나와 잡습니다.`, sacFly); return;
  }
  if(d < fence - 14){
    if(check(G, '뜬공 안타', [0.07, 0.04, 0.07][of] + defMod, '떨어짐', '잡힘')){ hit(1, `${ofName} 쪽 타구, 글러브에 맞고 떨어집니다. 안타!`); return; }
    if(rnd(G) < errorChance(F) * 0.6){ B.st.ab++; onError(G, posOF); return; }
    out(`${josa(field, '으로', '로')} 뜬 공, ${ga(ofName)} 잡습니다.`, sacFly); return;
  }
  if(d < fence - 5){
    if(check(G, '깊은 뜬공 안타', [0.55, 0.28, 0.10][of] + defMod, '머리 위로 넘어감', '잡힘')){
      if(B.spd >= 65 && rnd(G) < 0.2){ hit(3, `깊은 타구가 ${ofName}의 머리 위로 넘어갑니다. 3루까지! 3루타!`); return; }
      hit(2, `깊은 타구가 ${ofName}의 머리 위로 넘어갑니다. 2루타!`); return;
    }
    out(`잘 맞은 타구, ${ga(ofName)} 뒤로 달려가 잡아 냅니다.`, sacFly); return;
  }
  // 담장 바로 앞
  const why = raw >= fence && wind < 0 ? '맞바람에 막혔습니다' : '힘이 조금 모자랐습니다';
  if(check(G, '담장 앞 잡기', [0.35, 0.72, 0.90][of] - defMod, '잡힘', '못 잡음')){
    out(`큰 타구! ${ga(ofName)} 뒤로, 뒤로… 담장 바로 앞에서 잡습니다. ${why}.`, sacFly); return;
  }
  hit(2, `큰 타구! 담장을 맞고 떨어집니다. ${why}. 2루타!`);
}
function groundOut(G, head, pos, inf){
  const T = batTeam(G), B = curBatter(G), b = G.bases, F = fieldTeam(G);
  const who = fielder(F, pos);
  // 병살: 1루 주자가 있고 아웃이 2개 미만일 때
  if(b[0] != null && G.outs < 2){
    const pDP = clamp(0.32 + [-0.1, 0, 0.1][inf] - (B.spd - 50) / 200, 0.1, 0.75);
    if(rnd(G) < pDP){
      B.st.ab++; addOut(G, 2);
      emit(G, `${head} 땅볼, ${ga(who)} 잡아 2루, 다시 1루로. 병살타! ${G.outs}아웃.`, 'r'); fx(G, 'out');
      b[0] = null;
      if(G.outs < 3){ const sc = []; if(b[2] != null){ sc.push(b[2]); b[2] = null; } if(b[1] != null){ b[2] = b[1]; b[1] = null; } scoreRuns(G, sc, false); }
      return;
    }
    if(rnd(G) < 0.35){   // 앞 주자만 잡음 (야수 선택)
      const R = T.bat[b[0]];
      B.st.ab++; addOut(G);
      emit(G, `${head} 땅볼, ${ga(who)} 잡아 2루로. 1루 주자 ${R.name} 아웃, 타자는 1루에 삽니다. ${G.outs}아웃.`, 'r'); fx(G, 'out');
      const nb = [T.bi, null, null], sc = [];
      if(b[1] != null){ if(b[2] != null && G.outs < 3) sc.push(b[2]); nb[2] = b[1]; }   // 2루 주자는 밀려서 3루로, 만루면 3루 주자 득점
      else if(b[2] != null) nb[2] = b[2];
      G.bases = nb; scoreRuns(G, sc, true);
      return;
    }
  }
  B.st.ab++; addOut(G);
  emit(G, `${head} 땅볼, ${ga(who)} 잡아 1루로. 아웃. ${G.outs}아웃.`, 'r'); fx(G, 'out');
  if(G.outs < 3) advanceOnOut(G, { hold3: b[2] != null && (inf === 0 ? rnd(G) < 0.85 : rnd(G) < 0.15) && !(b[0] != null && b[1] != null) });
}

/* ---------- 타석 한 번 (간단 모드) ----------
   D(수비): 'attack' 정면 승부 · 'nibble' 유인구 승부 · 'ibb' 고의 볼넷
   O(공격): 'power' 강하게 · 'normal' 보통 · 'contact' 맞히기 · 'bunt' 번트 · 'steal' 도루 */
const SIMPLE_BASE = { K:20, BB:8, S1:15, S2:4.5, S3:0.5, HR:3, GO:25, FO:24 };
const SIMPLE_NAME = { K:'삼진', BB:'볼넷', S1:'안타', S2:'2루타', S3:'3루타', HR:'홈런', GO:'땅볼', FO:'뜬공' };
function simpleTable(D, O){
  const w = { ...SIMPLE_BASE };
  const mul = (k, m) => { w[k] *= m; };
  if(O === 'power'){ mul('HR', 2.1); mul('S2', 1.3); mul('K', 1.4); mul('S1', 0.85); mul('FO', 1.1); }
  if(O === 'contact'){ mul('HR', 0.4); mul('K', 0.6); mul('S1', 1.25); mul('S2', 0.8); mul('GO', 1.1); }
  if(D === 'nibble'){ mul('BB', 1.8); mul('K', 1.25); mul('S1', 0.85); mul('HR', 0.7); mul('GO', 0.95); }
  if(D === 'attack'){ mul('BB', 0.7); mul('S1', 1.05); mul('HR', 1.1); }
  const tot = Object.values(w).reduce((a, b) => a + b, 0);
  let acc = 0; const rows = [];
  Object.keys(w).forEach(k => { const from = Math.round(acc / tot * 100) + 1; acc += w[k]; const to = Math.round(acc / tot * 100); if(to >= from) rows.push({ k, from, to }); });
  rows[rows.length - 1].to = 100;
  return rows;
}
function playSimple(G, D, O){
  if(G.over) return flush(G);
  const T = batTeam(G), F = fieldTeam(G), B = curBatter(G), P = curPitcher(G);
  if(D === 'ibb'){
    emit(G, `고의 볼넷. ${josa(B.name, '을', '를')} 1루로 내보냅니다.`, 'r');
    B.st.bb++; T.BB++; P.st.bb++; forceWalk(G); fx(G, 'ball'); endPA(G); return flush(G);
  }
  if(O === 'steal'){
    if(canSteal(G)){ doSteal(G, true, false); if(G.outs >= 3) endPA(G, true); }
    return flush(G);
  }
  if(O === 'bunt'){ P.n++; buntResult(G, `${B.name}, 번트!`, true); endPA(G); return flush(G); }
  P.n += rint(G, 3, 6);
  const rows = simpleTable(D, O), d = rint(G, 1, 100), row = rows.find(r => d >= r.from && d <= r.to);
  emit(G, '주사위 표: ' + rows.map(r => `${SIMPLE_NAME[r.k]} ${r.from}~${r.to}`).join(', ') + '.', 'd');
  const head = `주사위 ${d}.`;
  const fi = rint(G, 0, 2), fieldWord = ['왼쪽', '가운데', '오른쪽'][fi];
  const hit = (n, text) => { B.st.ab++; B.st.h++; T.H++; P.st.h++; if(n === 4){ B.st.hr++; P.st.hr++; fx(G, 'hr'); } else fx(G, n >= 2 ? 'xbh' : 'hit'); emit(G, `${head} ${text}`, 'r'); onHit(G, n, 0.5, true); };
  switch(row.k){
    case 'K': B.st.ab++; B.st.k++; P.st.k++; addOut(G); emit(G, `${head} 헛스윙 삼진! ${G.outs}아웃.`, 'r'); fx(G, 'k'); break;
    case 'BB': B.st.bb++; T.BB++; P.st.bb++; emit(G, `${head} 볼넷으로 1루에 걸어 나갑니다.`, 'r'); forceWalk(G); fx(G, 'ball'); break;
    case 'S1': hit(1, `${josa(fieldWord, '으로', '로')} 가는 안타!`); break;
    case 'S2': hit(2, `${fieldWord} 깊숙한 타구, 2루타!`); break;
    case 'S3': hit(3, `${fieldWord} 끝까지 굴러가는 3루타!`); break;
    case 'HR': hit(4, `큰 타구! ${fieldWord} 담장을 넘어갑니다. 홈런!`); break;
    case 'GO': {
      const pos = pickOne(G, ['3B', 'SS', '2B', '1B']);
      if(G.bases[0] != null && G.outs < 2 && rnd(G) < 0.4){
        B.st.ab++; addOut(G, 2); G.bases[0] = null;
        emit(G, `${head} ${POS[pos]} 땅볼, 병살타! ${G.outs}아웃.`, 'r'); fx(G, 'out');
        if(G.outs < 3){ const b = G.bases, sc = []; if(b[2] != null){ sc.push(b[2]); b[2] = null; } if(b[1] != null){ b[2] = b[1]; b[1] = null; } scoreRuns(G, sc, false); }
      } else {
        B.st.ab++; addOut(G); emit(G, `${head} ${POS[pos]} 땅볼 아웃. ${G.outs}아웃.`, 'r'); fx(G, 'out');
        if(G.outs < 3) advanceOnOut(G, {});
      }
      break;
    }
    case 'FO': {
      const pos = pickOne(G, ['LF', 'CF', 'RF', 'SS']);
      B.st.ab++; addOut(G); emit(G, `${head} ${POS[pos]} 뜬공 아웃. ${G.outs}아웃.`, 'r'); fx(G, 'out');
      const b = G.bases;
      if(G.outs < 3 && b[2] != null && pos !== 'SS' && rnd(G) < 0.7){ const r = b[2]; b[2] = null; B.st.ab--; emit(G, `3루 주자 ${T.bat[r].name}, 태그업해서 홈으로! 희생 플라이.`, 'r'); scoreRuns(G, [r], true); }
      break;
    }
  }
  endPA(G);
  return flush(G);
}

/* ---------- 작전 (공 하나를 쓰지 않음) ---------- */
function setAlign(G, ti, inf, of){
  const T = G.teams[ti]; T.align = { inf, of };
  emit(G, `${T.short} 수비 위치: 내야 ${ALIGN_IN[inf]}, 외야 ${ALIGN_OUT[of]}.`, 'c');
  return flush(G);
}
const benchPitchers = (G, ti) => G.teams[ti].pit.map((p, i) => ({ p, i })).filter(x => !x.p.used);
// swapPitcher: 문장만 남기고 꺼내지 않음 (타석 시작 중에 컴퓨터가 바꿀 때) / changePitcher: 사람이 바꿀 때
function changePitcher(G, ti, idx){ swapPitcher(G, ti, idx); return flush(G); }
function swapPitcher(G, ti, idx){
  const T = G.teams[ti], old = T.pit[T.pi], nw = T.pit[idx];
  if(!nw || nw.used) return;
  T.pi = idx; nw.used = true;
  emit(G, `${T.short} 투수 교체: ${old.name}에서 ${josa(nw.name, '으로', '로')} 바뀝니다. ${nw.name}, 최고 구속 ${nw.vel}킬로.`, 'c');
  fx(G, 'change');
}
