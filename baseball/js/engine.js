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
// 능력치가 아주 높거나 낮을 때 효과를 조금 누그러뜨림 (50에서 멀수록 k배): 한 시즌 내내 뛰는 리그에서 기록이 터무니없이 튀지 않게
const soft = (v, k) => 50 + (v - 50) * k;
// 정밀 계산(능력치·바람·컨디션)을 쓰는 모드: 정밀 모드와 감독 모드
const detailed = G => G.mode !== 'simple';
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
  if(k === 'r' && G.teams && !G.over) e.b = curBatter(G).name;   // 타석 결과 문장의 타자 (감독 모드 요약에 씀)
  G.log.push(e);
  if(G.log.length > 1500) G.log.splice(0, G.log.length - 1500);
  G.out.push(e);
}
/* 사건 목록: 결과를 글(emit)·효과 이름(fx)과 별도로, 읽는 쪽이 글을 해석하지 않아도 되게 구조로 남김.
   종류(k): game(e: start·end) pitch call(c: strike·ball·whiff·foul) contact(big·foul·bunt) pa(r: k·bb·hbp·b1·b2·b3·hr·out·safe)
            play(타구 하나의 결과: kind·pos·who·hitBases·err …) score(n·walkoff) inning pchange sub batter review reviewEnd steal pick wp
   fx 이름은 호환을 위해 그대로 두고, 같은 이름이 나올 때 대응하는 사건도 함께 쌓음. 데이터가 더 필요한 곳은 ev()로 직접 넣음. */
const FX_EV = { pitch:{ k:'pitch' }, strike:{ k:'call', c:'strike' }, ballc:{ k:'call', c:'ball' },
  foul:{ k:'call', c:'foul' }, k:{ k:'pa', r:'k' }, ball:{ k:'pa', r:'bb' }, batter:{ k:'batter' }, pchange:{ k:'pchange' }, sub:{ k:'sub' },
  bat:{ k:'contact', big:false }, batBig:{ k:'contact', big:true }, batF:{ k:'contact', foul:true }, bunt:{ k:'contact', bunt:true },
  hit:{ k:'pa', r:'b1' }, b2:{ k:'pa', r:'b2' }, b3:{ k:'pa', r:'b3' }, hr:{ k:'pa', r:'hr' }, out:{ k:'pa', r:'out' }, safe:{ k:'pa', r:'safe' } };
function ev(G, o){ (G.evs ||= []).push(o); }
function fx(G, ...names){
  G.fx.push(...names);
  names.forEach(n => { const e = FX_EV[n] || (/^whiff-/.test(n) ? { k:'call', c:'whiff', kind:n[6] } : null); if(e) ev(G, { ...e }); });
}
// 이번 선택으로 생긴 문장·효과음·사건을 꺼냄
// 공마다 자취(구종·구속·위치·결과)를 최근 3개만 남김: 화면 보며 하기의 상황 줄이 보여 줌. 결과 이름은 사건에서 정함
function pitchLabel(evs){
  const pa = r => evs.some(e => e.k === 'pa' && e.r === r), call = c => evs.some(e => e.k === 'call' && e.c === c);
  return pa('k') ? '삼진' : pa('bb') ? '볼넷' : call('whiff') ? '헛스윙' : call('strike') ? '스트라이크' : call('ball') ? '볼' : call('foul') ? '파울' : evs.some(e => e.k === 'contact' && !e.foul) ? '인플레이' : '';
}
function flush(G){
  const evs = G.evs || [];
  if(G.anim && G.anim.n !== G.histN && evs.some(e => e.k === 'pitch')){
    G.histN = G.anim.n;
    (G.hist ||= []).push({ n: G.anim.n, t: G.anim.t, vel: G.anim.vel || 0, x: Math.round(G.anim.x * 100) / 100, y: Math.round(G.anim.y * 100) / 100, l: pitchLabel(evs) });
    if(G.hist.length > 3) G.hist.shift();
  }
  const r = { lines: G.out, fx: G.fx, events: G.evs || [] }; G.out = []; G.fx = []; G.evs = []; return r; }

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
// 벤치 선수 4명: 장타 대타 · 교타 대타 · 대주자 · 수비 요원
const BENCH_ROLES = [
  { pos:'1B', role:'장타 대타', t:{ pow:16, con:-2, spd:-8 } },
  { pos:'LF', role:'교타 대타', t:{ con:12, eye:8, pow:-6 } },
  { pos:'CF', role:'대주자', t:{ spd:24, pow:-12 } },
  { pos:'SS', role:'수비 요원', t:{ def:14, con:-6, pow:-8 } },
];
function makeBench(G, S, b, bias){
  const m = S.bat, v = k => stat(G, 46 + (b.t[k] || 0) + (m[k] || 0) + bias);
  return { id: 'b' + G.names.length, name: newName(G), pos: b.pos, role: b.role, hand: rnd(G) < 0.36 ? 'L' : 'R',
    con: v('con'), pow: v('pow'), eye: v('eye'), spd: v('spd'), def: v('def'),
    aggr: clamp(Math.round(50 + gauss(G) * 14 + S.aggr), 5, 95), cond: condRoll(G), seen: false,
    st: { pa:0, ab:0, h:0, hr:0, rbi:0, bb:0, k:0, r:0, sb:0 } };
}
function makeTeam(G, key, bias){
  const info = teamInfo(key), S = STYLES[info.style];
  const T = { key, name: info.name, short: info.short, style: info.style, color: info.color,
    bat: [], pit: [], pi: 0, bi: 0, align: { inf:1, of:1 }, R: [], H: 0, E: 0, BB: 0, guess: null, lastSel: null };
  for(let i = 0; i < 9; i++) T.bat.push(makeBatter(G, S, i, bias));
  T.pit.push(makePitcher(G, S, true, bias));
  for(let i = 0; i < 4; i++) T.pit.push(makePitcher(G, S, false, bias));
  T.pit[1].role = '마무리';
  T.bench = BENCH_ROLES.map(b => makeBench(G, S, b, bias));
  T.gone = [];   // 경기 중에 교체되어 나간 선수 (기록은 남김)
  T.rev = 2;     // 비디오 판독 신청 기회 (판정이 뒤집히면 줄지 않음)
  T.def = teamDef(T);
  return T;
}

// 리그 명단으로 경기용 팀 만들기: R = { key, bat:[9], bench:[], pit:[오늘 선발, 쉬는 날이 아닌 불펜…] }
const freshBat = () => ({ pa:0, ab:0, h:0, hr:0, rbi:0, bb:0, k:0, r:0, sb:0 });
function rosterTeam(G, R){
  const info = teamInfo(R.key), copy = p => JSON.parse(JSON.stringify(p));
  const bat = R.bat.map(p => ({ ...copy(p), seen:false, st: freshBat() }));
  const bench = R.bench.map(p => ({ ...copy(p), seen:false, st: freshBat() }));
  const pit = R.pit.map((p, i) => ({ ...copy(p), starter: i === 0 ? true : p.starter, n:0, load:0, used: i === 0, warned:0, st:{ out:0, h:0, r:0, bb:0, k:0, hr:0 } }));
  pit.forEach(p => { delete p.ss; delete p.cs; }); bat.concat(bench).forEach(p => { delete p.ss; delete p.cs; });
  const T = { key: R.key, name: info.name, short: info.short, style: info.style, color: info.color,
    bat, bench, pit, pi:0, bi:0, align:{ inf:1, of:1 }, R:[], H:0, E:0, BB:0, guess:null, lastSel:null, gone:[], rev:2 };
  T.def = teamDef(T);
  return T;
}
const teamDef = T => Math.round(T.bat.reduce((s, b) => s + b.def, 0) / 9 + STYLES[T.style].def);

/* ---------- 경기 시작 ----------
   o: { mode:'simple'|'detail'|'manager', unit:'pa'|'pitch'(간단 모드), innings, teams:[원정 팀 키, 홈 팀 키], ctrl:['human'|'cpu', ...], who:[이름, 이름], diff:0~2, seed } */
const EXTRA_INN = 3;
function newGame(o){
  const G = { v:1, rng: (o.seed >>> 0) || (Date.now() >>> 0), seq:0, log:[], out:[], fx:[], names:[],
    mode: ['simple', 'manager'].includes(o.mode) ? o.mode : 'detail',
    // 간단 모드: pa 한 번에 한 타석 · pitch 한 번에 공 하나
    unit: o.mode === 'simple' && o.unit === 'pitch' ? 'pitch' : 'pa',
    innings: o.innings || 3, ctrl: o.ctrl || ['human', 'cpu'],
    who: o.who || ['', ''], diff: o.diff == null ? 1 : o.diff,
    // 타격 난이도(재미): 0 현실 · 1 보통 · 2 쉬움. 높을수록 잘 맞히고 안타·진루가 많음 (리그 컴퓨터 경기는 0)
    easy: o.easy == null ? 0 : o.easy,
    inning:1, top:true, outs:0, balls:0, strikes:0, bases:[null, null, null], pitchNo:0, pa:0, half:0,
    over:false, winner:null, prev:null, lastLoc:null, at: Date.now() };
  // 컴퓨터 난이도: 쉬움이면 컴퓨터 팀 능력치를 조금 낮추고, 어려움이면 조금 높임
  const cpuBias = [-6, 0, 5][G.diff] || 0;
  // 리그 경기는 리그의 선수 명단(rosters)을 그대로 씀
  G.teams = [0, 1].map(i => o.rosters ? rosterTeam(G, o.rosters[i]) : makeTeam(G, o.teams[i], G.ctrl[i] === 'cpu' && G.ctrl[1 - i] !== 'cpu' ? cpuBias : 0));
  G.leader = -1;
  if(o.rev != null) G.teams.forEach(T => { T.rev = o.rev; });   // 비디오 판독 기회 (설정)
  // 홈 팀 구장: 담장·잔디·바람이 결과를 바꿈
  G.park = parkInfo(o.teams[1]);
  const pk = G.park;
  if(detailed(G) && !pk.dome){
    const dir = wpick(G, Object.entries(pk.wind));
    G.wind = { dir, spd: dir === 'none' ? 0 : rint(G, pk.spd[0], pk.spd[1]) };
  } else G.wind = { dir:'none', spd:0 };
  // 감독 모드에서 사람이 맡은 팀이 있으면 경기 전에 타순·선발 투수를 정함 (beginGame으로 시작)
  G.pre = G.mode === 'manager' && G.ctrl.includes('human') ? { ready: G.ctrl.map(c => c !== 'human') } : null;
  if(!G.pre) beginGame(G);
  return G;
}
function beginGame(G){
  G.pre = null;
  // 선발 투수와 시작 타순을 기록 (승리 투수 자격, 리그의 타순 저장에 씀)
  G.teams.forEach(T => { const P = T.pit[T.pi]; P.gs = true; P.entryLead = 0; T.startIds = T.bat.map(b => b.id); });
  const [A, H] = G.teams;
  emit(G, `오늘 경기는 원정 ${A.name}, 홈 ${H.name}의 대결입니다. ${G.innings}이닝 경기입니다.`, 'i');
  const pk = parkOf(G);
  emit(G, `경기장은 ${pk.name}입니다. ${pk.desc}`, 'i');
  if(detailed(G)){
    emit(G, `날씨: ${windText(G)}.`, 'i');
    G.teams.forEach(T => { const P = T.pit[T.pi]; emit(G, `${T.short} 선발 투수 ${P.name}${P.cond >= 1 ? ', 몸이 가벼워 보입니다' : P.cond <= -1 ? ', 몸이 조금 무거워 보입니다' : ''}.`, 'n'); });
  }
  emit(G, `1회초, ${A.short}의 공격입니다.`, 'i');
  fx(G, 'start'); ev(G, { k:'game', e:'start' });
  G.inningLog = []; halfBegin(G);
  startPA(G);
}
const parkOf = G => G.park || parkInfo('star');
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
const expVel = (P, t, w) => Math.round(P.vel * PITCH[t].spd + POWER[w || 5].dv + P.cond * 0.8 - fatigue(P) * 4);
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
  return `${halfName(G)} ${batTeam(G).short} 공격. ${scoreText(G)}. ${G.outs}아웃 ${basesText(G.bases)}. ${countText(G)}. 타자 ${B.name}, 투수 ${P.name}${detailed(G) ? ` 투구 수 ${P.n}개` : ''}.`;
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
  G.balls = 0; G.strikes = 0; G.pitchNo = 0; G.prev = null; G.held = {};
  if(G.ctrl[1 - batIdx(G)] === 'cpu' && typeof aiManage === 'function') aiManage(G);
  const T = batTeam(G), B = curBatter(G);
  B.st.pa++;
  let s = `${T.bi + 1}번 타자 ${POS[B.pos]} ${B.name}`;
  if(detailed(G)) s += `, ${handText(B.hand)}`;
  s += B.st.pa > 1 ? `. 오늘 ${batterLine(B)}.` : '.';
  if(detailed(G) && !B.seen){
    B.seen = true;
    if(B.cond >= 2) s += ' 오늘 타격감이 아주 좋아 보입니다.';
    else if(B.cond === 1) s += ' 컨디션이 좋아 보입니다.';
    else if(B.cond === -1) s += ' 컨디션이 썩 좋아 보이지 않습니다.';
    else if(B.cond <= -2) s += ' 오늘 몸이 무거워 보입니다.';
  }
  emit(G, s, 'n'); fx(G, 'batter');
  if(G.mode === 'manager' && G.ctrl[batIdx(G)] === 'cpu' && typeof aiManageOff === 'function') aiManageOff(G);
  // 지친 투수 알림 (사람이 수비할 때 판단하도록)
  const P = curPitcher(G), f = fatigue(P);
  if(detailed(G) && f > 0.05 && P.warned < 1){ P.warned = 1; emit(G, `투수 ${P.name}, 투구 수 ${P.n}개. 공에 힘이 떨어지기 시작합니다.`, 'c'); }
  else if(detailed(G) && f > 0.6 && P.warned < 2){ P.warned = 2; emit(G, `투수 ${P.name}, 많이 지쳤습니다. 구속과 제구가 떨어집니다.`, 'c'); }
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
// 이닝 기록(inningLog): 초·말마다 득점·안타·볼넷·실책·삼진·병살·잔루를 쌓아, 이닝 끝 중계가 맥락(삼자범퇴인지, 실점했는지)을 보고 말하게 함
const teamKs = T => T.pit.reduce((s, p) => s + p.st.k, 0);
function halfBegin(G){ const T = batTeam(G), F = fieldTeam(G); G.hs = { H:T.H, BB:T.BB, E:F.E, K:teamKs(F), dp:0 }; }
function halfEnd(G){
  const T = batTeam(G), F = fieldTeam(G), hs = G.hs || { H:0, BB:0, E:0, K:0, dp:0 };
  const e = { inning:G.inning, top:G.top, runs:T.R[G.inning - 1] || 0, hits:T.H - hs.H, walks:T.BB - hs.BB, errors:F.E - hs.E, ks:teamKs(F) - hs.K, dp:hs.dp, lob:G.bases.filter(x => x != null).length };
  (G.inningLog ||= []).push(e); ev(G, { k:'inning', ...e }); if(G.hs) G.hs.done = true;
  return e;
}
function endHalf(G){
  const T = batTeam(G);
  if(T.R[G.inning - 1] == null) T.R[G.inning - 1] = 0;
  emit(G, `3아웃. ${halfName(G)} 끝. ${scoreText(G)}.`, 'i');
  halfEnd(G); fx(G, 'change');
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
  G.outs = 0; G.bases = [null, null, null]; G.half++; halfBegin(G);
  const pk = parkOf(G);
  if(detailed(G) && !pk.dome && rnd(G) < pk.change){
    const before = windText(G);
    G.wind.spd = clamp(G.wind.spd + pickOne(G, [-2, -1, 1, 2]), 0, pk.spd[1]);
    if(G.wind.spd && (G.wind.dir === 'none' || rnd(G) < pk.change / 2)) G.wind.dir = wpick(G, Object.entries(pk.wind).filter(x => x[0] !== 'none'));
    if(!G.wind.spd) G.wind.dir = 'none';
    if(windText(G) !== before) emit(G, `바람이 바뀌었습니다: ${windText(G)}.`, 'i');
  }
  emit(G, `${halfName(G)}, ${batTeam(G).short}의 공격입니다.`, 'i');
  startPA(G);
}
function gameOver(G){
  G.over = true;
  if(G.hs && !G.hs.done) halfEnd(G);   // 끝내기처럼 3아웃 없이 끝난 마지막 초·말도 이닝 기록에 넣음
  const [A, H] = G.teams, a = runsOf(A), h = runsOf(H);
  if(!G.top && H.R[G.inning - 1] == null) H.R[G.inning - 1] = 0;
  G.winner = a > h ? 0 : h > a ? 1 : -1;
  const win = G.winner >= 0 ? G.teams[G.winner] : null;
  emit(G, `경기 끝! ${A.short} ${a} 대 ${h} ${H.short}. ${win ? (G.walkoff ? `${win.short}의 끝내기 승리입니다!` : `${win.short} 승리!`) : '무승부입니다.'}`, 'i');
  // 오늘의 선수: 안타·홈런·타점이 가장 좋은 타자
  let best = null, bv = -1;
  G.teams.forEach(T => [...T.bat, ...(T.gone || [])].forEach(B => { const v = B.st.h + B.st.hr * 2 + B.st.rbi + B.st.bb * 0.3 + (T === win ? 0.5 : 0); if(v > bv){ bv = v; best = { T, B }; } }));
  if(best && bv > 0) emit(G, `오늘의 선수: ${best.T.short} ${best.B.name}, ${batterLine(best.B)}.`, 'i');
  decide(G);
  // 노히트 노런 · 퍼펙트게임: 상대에게 안타를 하나도 맞지 않음 (볼넷·몸에 맞는 공·실책까지 없으면 퍼펙트)
  if(G.inning >= G.innings) G.teams.forEach((T, ti) => {
    const O = G.teams[1 - ti]; if(O.H > 0) return;
    const used = T.pit.filter(p => p.used), perfect = O.BB === 0 && T.E === 0;
    if(used.length === 1) feat(G, perfect ? 'perfect' : 'nohit', `대기록! ${T.short} ${used[0].name}, ${perfect ? '퍼펙트게임' : '노히트 노런'}을 달성했습니다!`, used[0], T);
    else feat(G, 'teamnohit', `대기록! ${T.short} 투수진이 이어 던져 ${perfect ? '팀 퍼펙트게임' : '팀 노히트 노런'}을 합작했습니다!`, null, T);
  });
  fx(G, 'end'); ev(G, { k:'game', e:'end', walkoff:!!G.walkoff, winner:G.winner });
}

// 승리·패전·세이브·홀드 투수 (간단히 한 KBO 규칙)
// 승리: 결승점이 났을 때 우리 팀 투수. 선발이 5이닝(짧은 경기는 그만큼 줄여서)을 못 채웠으면 가장 많이 던진 불펜
// 패전: 결승점을 내줄 때 마운드에 있던 투수 · 세이브: 마지막 투수가 3점 차 이내에 나와 1이닝 이상(또는 3이닝 이상) 지킴
// 홀드: 3점 차 이내에 나와 앞선 채로 물러난 불펜
function decide(G){
  G.decision = null;
  if(G.winner < 0 || !G.dec || G.dec.side !== G.winner) return;
  const W = G.teams[G.winner], Lt = G.teams[1 - G.winner], by = (T, id) => T.pit.find(p => p.id === id);
  let wp = by(W, G.dec.w);
  const req = Math.min(15, Math.ceil(G.innings * 3 * 5 / 9));
  if(wp && wp.gs && wp.st.out < req){ const rel = W.pit.filter(p => p.used && !p.gs).sort((a, b) => b.st.out - a.st.out); if(rel.length) wp = rel[0]; }
  if(!wp) return;
  const lp = by(Lt, G.dec.l), last = W.pit[W.pi];
  const sv = last !== wp && !last.gs && (last.entryLead || 0) >= 1 && (((last.entryLead || 0) <= 3 && last.st.out >= 3) || last.st.out >= 9) ? last : null;
  const holds = W.pit.filter(p => p.used && !p.gs && p !== wp && p !== sv && p !== last && (p.entryLead || 0) >= 1 && (p.entryLead || 0) <= 3 && (p.exitLead || 0) >= 1 && p.st.out >= 1);
  G.decision = { w: wp.id, l: lp ? lp.id : null, s: sv ? sv.id : null, h: holds.map(p => p.id) };
  emit(G, `승리 투수 ${wp.name}${lp ? `, 패전 투수 ${lp.name}` : ''}${sv ? `, 세이브 ${sv.name}` : ''}${holds.length ? `, 홀드 ${holds.map(p => p.name).join(', ')}` : ''}.`, 'i');
}

function feat(G, kind, text, P, T){
  (G.feats ||= []).push({ kind, text, id: P ? P.id : null, name: P ? P.name : '', team: T.key });
  emit(G, text, 'i'); fx(G, 'hr');
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
  // lc: 이 득점으로 앞서는 팀이 바뀜(역전·처음 앞섬), tie: 동점이 됨 (함성의 크기와 해설이 씀)
  { const ld = runsOf(G.teams[0]) - runsOf(G.teams[1]), nl = ld > 0 ? 0 : ld < 0 ? 1 : -1; ev(G, { k:'score', n:list.length, rbi:!!rbi, walkoff:!!G.walkoff, lc: nl >= 0 && nl !== G.leader, tie: nl < 0 }); }
  // 앞서는 팀이 바뀌면 승리·패전 투수 후보를 기록 (그때 마운드에 있던 두 팀 투수)
  const lead = runsOf(G.teams[0]) - runsOf(G.teams[1]), leader = lead > 0 ? 0 : lead < 0 ? 1 : -1;
  if(leader !== G.leader){
    if(leader >= 0){ const W = G.teams[leader], Lt = G.teams[1 - leader]; G.dec = { side: leader, w: W.pit[W.pi].id, l: Lt.pit[Lt.pi].id }; }
    else G.dec = null;
    G.leader = leader;
  }
}
const leadFor = (G, ti) => runsOf(G.teams[ti]) - runsOf(G.teams[1 - ti]);
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
  if(G.anim && G.anim.bb) G.anim.bb.hit = n;
  // 안타 종류를 세어 사이클링 히트(단타·2루타·3루타·홈런)를 알림
  const B = T.bat[T.bi], key = 'b' + Math.min(4, n);
  B.st[key] = (B.st[key] || 0) + 1;
  if(!B.cycle && B.st.b1 && B.st.b2 && B.st.b3 && B.st.b4){
    B.cycle = true;
    feat(G, 'cycle', `대기록! ${T.short} ${B.name}, 사이클링 히트를 달성합니다!`, B, T);
  }
  const spd = i => simple ? 55 : T.bat[i].spd;
  if(n >= 4){ for(let k = 2; k >= 0; k--) if(b[k] != null){ sc.push(b[k]); b[k] = null; } sc.push(T.bi); scoreRuns(G, sc, true); return; }
  const nb = [null, null, null], ofAdj = [-0.18, 0, 0.1][F.align.of] + EZ(G, [0, 0.08, 0.16]);
  for(let k = 2; k >= 0; k--){
    const r = b[k]; if(r == null) continue;
    let to = k + n;
    if(n === 1 && k === 1 && rnd(G) < clamp(0.55 + (spd(r) - 50) / 120 + (ev - 0.5) * 0.4 + ofAdj, 0.1, 0.95)) to = 3;
    else if(n === 1 && k === 0 && nb[2] == null && rnd(G) < clamp(0.22 + (spd(r) - 50) / 150 + (G.hrun ? 0.4 : 0), 0.05, 0.9)) to = 2;
    else if(n === 2 && k === 0 && rnd(G) < clamp(0.42 + (spd(r) - 50) / 120 + ofAdj + (G.hrun ? 0.3 : 0), 0.1, 0.95)) to = 3;
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

/* ---------- 도루 ---------- */
function canSteal(G){ const b = G.bases; return (b[0] != null && b[1] == null) || (b[1] != null && b[2] == null); }
// 도루할 수 있는 경우: 0 1루→2루 · 1 2루→3루 · 'double' 1·2루 주자가 함께 · 2 3루→홈(홈스틸)
function stealCands(G){
  const b = G.bases, out = [];
  if(b[0] != null && b[1] == null) out.push(0);
  if(b[1] != null && b[2] == null) out.push(1);
  if(b[0] != null && b[1] != null && b[2] == null) out.push('double');
  if(b[2] != null) out.push(2);
  return out;
}
function stealLabel(G, f){
  const T = batTeam(G), b = G.bases, R = k => T.bat[b[k]];
  if(f === 'double') return `더블 스틸: 2루 주자 ${josa(R(1).name, '과', '와')} 1루 주자 ${josa(R(0).name, '이', '가')} 함께 뜁니다`;
  if(f === 2) return `홈스틸: 3루 주자 ${R(2).name}, 스피드 ${R(2).spd}. 성공하기 어렵습니다`;
  return `${f + 1}루 주자 ${R(f).name}, ${f + 2}루 도루. 스피드 ${R(f).spd}`;
}
// allowRev: 아슬아슬하면 비디오 판독으로 넘김 (도루 뒤에 타석이 이어지는 경우만)
// pick: 고른 주자 (0·1·2·'double'). 없으면 앞 주자 가운데 갈 수 있는 사람
function doSteal(G, simple, breaking, allowRev, pick){
  const b = G.bases, T = batTeam(G), F = fieldTeam(G);
  const cands = stealCands(G);
  let from = cands.includes(pick) ? pick : (b[1] != null && b[2] == null) ? 1 : (b[0] != null && b[1] == null) ? 0 : -1;
  if(from === -1) return;
  const dbl = from === 'double';
  if(dbl) from = 1;   // 포수는 앞 주자(3루)로 던짐. 뒤 주자는 그사이 2루로 감
  const r = b[from], R = T.bat[r];
  // 리드·출발·투수 동작·포수 송구 시간으로 판정 (playsim.js의 stealSim)
  const S = stealSim(G, from, { simple, breaking, dbl, vel: G.prev && G.prev.vel, loc: G.lastLoc });
  const to = from === 2 ? '홈' : from === 1 ? '3루' : '2루', ok = S.safe;
  const timeW = `판정 도루: 주자 ${S.tR.toFixed(2)}초, 송구와 태그 ${S.tB.toFixed(2)}초${S.err ? ', 송구가 빠짐' : ''}, ${ok ? '세이프' : '아웃'}.`;
  G.stealT = S;
  if(dbl){
    emit(G, `더블 스틸! 1루 주자와 2루 주자가 함께 뜁니다. ${timeW}`, 'd');
    const r0 = b[0]; b[0] = null;
    stealResult(G, 1, r, '3루', ok, simple);
    if(G.bases[1] == null){ G.bases[1] = r0; T.bat[r0].st.sb++; emit(G, `1루 주자 ${josa(T.bat[r0].name, '은', '는')} 2루까지 갑니다.`, 'r'); }
    return;
  }
  if(from === 2){
    emit(G, timeW.replace('도루', '홈스틸'), 'd');
    b[2] = null;
    markPlay(G, { k:'steal', to:3, safe:ok, tR: S.tR, tB: S.tB });
    if(ok){ R.st.sb++; emit(G, `${R.name}, 홈으로 파고듭니다! 홈스틸 성공!`, 'r'); fx(G, 'safe'); scoreRuns(G, [r], false); }
    else { addOut(G); emit(G, `${R.name}, 홈으로 뛰었지만 포수 ${fielder(F, 'C').replace(/^포수 /, '')}에게 태그 아웃! ${G.outs}아웃.`, 'r'); fx(G, 'out'); }
    return;
  }
  emit(G, timeW, 'd');
  if(S.err && G.outs < 3){
    // 송구가 외야로 빠짐: 한 베이스 더
    b[from] = null; R.st.sb++; F.E++;
    emit(G, `${R.name}, ${to} 도루! 아, 포수의 송구가 뒤로 빠집니다! 그사이 ${from === 0 ? '3루' : '홈'}까지 갑니다.`, 'r'); fx(G, 'safe');
    markPlay(G, { k:'steal', to: from + 1, safe:true, tR: S.tR, tB: S.tB });
    if(from === 0) b[2] = r; else scoreRuns(G, [r], false);
    return;
  }
  if(allowRev && Math.abs(S.m) <= 0.07){
    const truth = ok ? 'safe' : 'out', pW = clamp(0.45 * (1 - Math.abs(S.m) / 0.07), 0, 0.45), call = rnd(G) < pW ? flipCall(truth) : truth;
    openReview(G, { kind:'steal', call, truth, m: S.m, side: call === 'safe' ? 1 - batIdx(G) : batIdx(G), p: Math.max(0.05, pW), data:{ from, r, to, simple },
      say: `${R.name}, ${to}로 뜁니다. 아슬아슬한 타이밍! 원심은 ${callWord(call)}. ${call === 'safe' ? '수비 쪽에서 태그가 먼저였다며 아웃이라고 강하게 어필합니다.' : `${R.name}, 세이프라고 강하게 어필합니다.`}` });
    return;
  }
  stealResult(G, from, r, to, ok, simple);
}
function stealResult(G, from, r, to, ok, simple, viaReview){
  const b = G.bases, R = batTeam(G).bat[r], F = fieldTeam(G);
  if(!viaReview) markPlay(G, { k:'steal', to: from + 1, safe: ok, tR: G.stealT && G.stealT.tR, tB: G.stealT && G.stealT.tB });
  if(ok){
    b[from + 1] = r; b[from] = null; R.st.sb++;
    emit(G, `${R.name}, ${to} 도루 성공!`, 'r'); fx(G, 'safe');
  } else {
    b[from] = null; addOut(G);
    emit(G, `${R.name}, ${to} 도루 실패. ${simple ? '포수' : fielder(F, 'C')}의 송구에 아웃됩니다. ${G.outs}아웃.`, 'r'); fx(G, 'out');
  }
}

/* ---------- 견제 ----------
   수비 팀이 주자를 견제: 대부분 세이프지만 가끔 잡거나(아웃), 악송구로 주자가 나아감.
   견제를 받은 주자는 리드가 작아져서 이번 타석의 도루 성공 확률이 줄어듦 */
function pickoff(G, base){ doPickoff(G, base); if(!G.review && G.outs >= 3) endPA(G, true); return flush(G); }
function doPickoff(G, base){
  const T = batTeam(G), F = fieldTeam(G), P = curPitcher(G), r = G.bases[base];
  if(r == null) return;
  const R = T.bat[r], fld = fielder(F, ['1B', '2B', '3B'][base]);
  P.load += 0.3;
  // 리드 거리, 주자의 반응, 투수가 돌아서 던지는 시간으로 판정 (playsim.js의 pickoffSim). 견제를 받은 뒤 리드를 줄임
  const S = pickoffSim(G, base);
  (G.held ||= {})[base] = ((G.held || {})[base] || 0) + 1;
  emit(G, `판정 견제: 리드 ${S.lead.toFixed(1)}미터, 주자 귀루 ${S.tR.toFixed(2)}초, 견제구와 태그 ${S.tB.toFixed(2)}초.`, 'd');
  const intro = pickOne(G, [`${P.name}, ${base + 1}루로 견제구!`, `빠른 동작으로 ${base + 1}루 견제!`, `투수가 돌아서며 ${base + 1}루로 던집니다!`]);
  if(S.err){   // 악송구: 주자들이 한 베이스씩
    emit(G, `${intro} 아, 공이 뒤로 빠집니다! 견제 악송구, 주자들이 한 베이스씩 나아갑니다.`, 'r'); F.E++; fx(G, 'safe');
    const b = G.bases, sc = []; if(b[2] != null) sc.push(b[2]);
    G.bases = [null, b[0], b[1]]; scoreRuns(G, sc, false); return;
  }
  const ok = S.out;
  if(Math.abs(S.m) <= 0.06){
    const truth = ok ? 'out' : 'safe', pW = clamp(0.45 * (1 - Math.abs(S.m) / 0.06), 0, 0.45), call = rnd(G) < pW ? flipCall(truth) : truth;
    openReview(G, { kind:'pick', call, truth, m: S.m, side: call === 'out' ? batIdx(G) : 1 - batIdx(G), p: Math.max(0.05, pW), data:{ base, r },
      say: `${intro} ${R.name}, 몸을 날려 돌아갑니다… 아슬아슬! 원심은 ${callWord(call)}. ${call === 'out' ? `${R.name}, 손이 먼저 들어갔다며 강하게 어필합니다.` : `${josa(fld, '이', '가')} 태그가 먼저였다며 강하게 어필합니다.`}` });
    return;
  }
  markPlay(G, { k:'pick', base, safe: !ok, tR: S.tR, tB: S.tB });
  if(ok){ G.bases[base] = null; addOut(G); emit(G, `${intro} ${R.name}, 귀루가 늦었습니다! 견제사, 아웃! ${G.outs}아웃.`, 'r'); fx(G, 'out'); return; }
  emit(G, pickOne(G, [`${intro} ${R.name}, 슬라이딩으로 돌아갑니다. 세이프.`, `${intro} 주자는 여유 있게 귀루합니다.`, `${intro} ${R.name}, 손이 먼저 들어갑니다. 세이프.`, `${intro} 주자를 묶어 둡니다. 세이프.`]), 'r');
}

/* ---------- 비디오 판독 ----------
   아슬아슬한 플레이(도루, 1루 승부, 담장 끝 타구)에서 원심을 정하고, 원심에 손해를 본 팀(side)이 판독을 신청할지 고를 때까지 결과 적용을 미룸.
   KBO처럼 팀마다 2번. 판정이 뒤집히면 기회가 줄지 않고, 원심 유지면 1번 줄어듦. 뒤집힐지는 확률(p)과 주사위로 정함 */
const flipCall = c => ({ out:'safe', safe:'out', hr:'2b', '2b':'hr' })[c];
const callWord = c => ({ out:'아웃', safe:'세이프', hr:'홈런', '2b':'2루타' })[c];
const reviewLeft = (G, side) => G.teams[side].rev ?? 2;
// 화면 모드 그림용 플레이 기록 (도루·견제·비디오 판독). n이 늘어날 때마다 그림이 그 장면을 보여 줌
function markPlay(G, o){ G.playN = (G.playN || 0) + 1; G.play = { n: G.playN, an: G.anim ? G.anim.n : 0, ...o }; ev(G, { ...o }); }   // an: 그때의 공 번호 (중계가 언제 말할지 정함)
function openReview(G, R){ G.review = R; emit(G, R.say, 'r'); fx(G, 'review'); markPlay(G, { k:'review', rk: R.kind, call: R.call, base: R.data && (R.data.base ?? R.data.from) }); }
function resolveReview(G, challenge){
  const R = G.review; if(!R) return flush(G);
  G.review = null;
  const T = G.teams[R.side];
  let fin = R.call;
  if(challenge && reviewLeft(G, R.side) > 0){
    emit(G, `${T.short} 감독, 비디오 판독을 신청합니다. 판독 중입니다…`, 'c');
    // 판독은 실제(위치·시간으로 계산한) 결과를 밝혀냄. 원심이 그것과 다르면 뒤집힘
    const truth = R.truth || R.call, flip = truth !== R.call, m = R.m;
    const how = m == null ? '' : R.kind === 'hr' ? `느린 화면으로 보니 공이 ${truth === 'hr' ? '담장 위를 넘어갔습니다' : '담장 꼭대기를 맞고 나왔습니다'}. ` : `느린 화면으로 보니 ${m > 0 ? '공이' : '주자가'} ${Math.max(0.01, Math.abs(m)).toFixed(2)}초 먼저 닿았습니다. `;
    markPlay(G, { k:'reviewEnd', rk: R.kind, flip, call: truth, base: R.data && (R.data.base ?? R.data.from) });
    fin = truth;
    if(flip){
      T.rev = reviewLeft(G, R.side);
      emit(G, `${how}판독 결과 원심이 뒤집힙니다! ${callWord(fin)}! ${T.short}의 판독 기회는 그대로 ${T.rev}번입니다.`, 'r'); fx(G, 'safe');
    } else {
      T.rev = reviewLeft(G, R.side) - 1;
      emit(G, `${how}원심 유지, ${callWord(fin)}. ${T.short}의 판독 기회가 ${T.rev}번 남았습니다.`, 'r');
    }
  } else emit(G, `판독 신청 없이 원심대로 ${callWord(fin)}입니다.`, 'c');
  applyReview(G, R, fin);
  return flush(G);
}
function applyReview(G, R, c){
  const T = batTeam(G), B = curBatter(G), P = curPitcher(G), d = R.data || {};
  if(R.kind === 'steal'){ stealResult(G, d.from, d.r, d.to, c === 'safe', d.simple, true); if(G.outs >= 3) endPA(G, true); return; }
  if(R.kind === 'pick'){
    if(c === 'out' && G.bases[d.base] === d.r){ G.bases[d.base] = null; addOut(G); emit(G, `견제사로 인정됩니다. ${G.outs}아웃.`, 'r'); fx(G, 'out'); if(G.outs >= 3) endPA(G, true); }
    else emit(G, '세이프로 인정됩니다.', 'r');
    return;
  }
  if(R.kind === 'play'){ applyPlay(G, c === R.truth ? d.r : flipPlay(d.r, d.close), '', d.info); endPA(G); return; }
  if(R.kind === 'hr'){
    const bb = d.bb, r = c === 'hr' ? simPlay(G, bb, { hr:true }) : simPlay(G, { ...bb, d: d.fence - 1 }, { wall:true });
    applyPlay(G, r, '', { ...d.info, d: c === 'hr' ? d.info.d : d.fence - 1 }); endPA(G); return;
  }
  if(R.kind === 'first'){
    B.st.ab++;
    if(c === 'safe'){ B.st.h++; T.H++; P.st.h++; emit(G, `${B.name}, 1루에서 세이프. 내야 안타!`, 'r'); fx(G, 'hit'); onHit(G, 1, 0.2, d.simple); }
    else { addOut(G); emit(G, `${B.name}, 1루에서 아웃. ${G.outs}아웃.`, 'r'); fx(G, 'out'); if(G.outs < 3) advanceOnOut(G, {}); }
    endPA(G); return;
  }
  if(R.kind === 'hr'){
    B.st.ab++; B.st.h++; T.H++; P.st.h++;
    if(c === 'hr'){ B.st.hr++; P.st.hr++; emit(G, `${B.name}의 홈런으로 인정됩니다!`, 'r'); fx(G, 'hr'); onHit(G, 4, d.ev, false); }
    else { emit(G, `담장을 맞고 나온 2루타로 인정됩니다.`, 'r'); fx(G, 'b2'); onHit(G, 2, d.ev, false); }
    endPA(G);
  }
}

/* ---------- 코스 ---------- */
// 겨냥한 곳: x(-몸쪽 ~ +바깥쪽), y(+높게 ~ -낮게). 스트라이크 존은 -1~1
// 스윙 세기별 보정: 앵커 3(맞히기)·5(치기)·8(강하게)를 이어 계산하고 그 바깥(1~2, 9)은 이어서 늘림
// eye 선구안 · bq 타격 정확도 · ev 타구 힘 · gb 땅볼 비율 · c2 2스트라이크 뒤 파울 벌점(맞히기 쪽만)
const SW_ANCHOR = [[3, { eye:8, bq:4, ev:-0.07, gb:0.04, c2:0.06 }], [5, { eye:0, bq:0, ev:0, gb:0, c2:0 }], [8, { eye:-10, bq:-12, ev:0.07, gb:-0.07, c2:0 }]];
function swingP(s){
  const [a, b] = s <= 5 ? [SW_ANCHOR[0], SW_ANCHOR[1]] : [SW_ANCHOR[1], SW_ANCHOR[2]], t = (s - a[0]) / (b[0] - a[0]), o = {};
  Object.keys(a[1]).forEach(k => { o[k] = a[1][k] + (b[1][k] - a[1][k]) * t; });
  o.c2 = Math.max(0, o.c2);
  return o;
}
// 노려 치기: 고른 칸(r행 c열, 0~2)과 실제 공 위치의 거리로 타격 정확도를 보정. 가운데 칸이거나 고르지 않으면 보정 없음. 선구안이 높으면 빗나갔을 때 벌점이 작음
function aimAdj(a, x, y, eye){
  if(!a || !Number.isInteger(a.r) || !Number.isInteger(a.c) || (a.r === 1 && a.c === 1)) return 0;
  const d = Math.hypot(x - [-1, 0, 1][a.c] * 0.55, y - [1, 0, -1][a.r] * 0.55), f = clamp(1 - d / 0.9, -1, 1);
  return f > 0 ? f * 7 : f * 10 * (1 - clamp(eye, 0, 100) / 150);
}
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
  `${PITCH[s.t].name}, ${ZONE_NAME[s.r][s.c]}${s.r === 1 && s.c === 1 ? '' : ', ' + EDGE[s.e || 'in'].name}, ${POWER[s.w || 5].name}`;

/* ---------- 해설 문장 ----------
   문장 앞부분(투구 동작·구종·구속·움직임)만 들어서는 결과를 알 수 없게 하고, 결과는 타격 방법에 따라 여러 문장 가운데 하나를 고름.
   코스(어디로 들어갔는지)는 결과 뒤에 덧붙임 */
const SAY = {
  windup: ['와인드업,', '세트 포지션에서', '사인을 주고받고', '숨을 고른 뒤', '포수 미트를 바라보고', '힘차게 왼발을 들어'],
  move: {
    FB: ['쭉 뻗어 들어갑니다', '힘 있게 꽂아 넣습니다', '정면으로 붙습니다', '묵직하게 들어갑니다'],
    SI: ['살짝 가라앉으며 들어갑니다', '꿈틀거리며 파고듭니다', '아래로 휘며 들어갑니다'],
    CT: ['끝에서 짧게 꺾입니다', '날카롭게 파고듭니다', '타자 앞에서 살짝 휩니다'],
    SL: ['옆으로 휘어 나갑니다', '미끄러지듯 꺾입니다', '날카롭게 휘어 들어갑니다'],
    CU: ['크게 떨어집니다', '높이 떠올랐다가 뚝 떨어집니다', '느린 포물선을 그립니다'],
    CH: ['느리게 가라앉습니다', '타자 앞에서 힘이 빠지며 떨어집니다', '직구처럼 오다가 가라앉습니다'],
    FK: ['뚝 떨어집니다', '홈플레이트 앞에서 아래로 떨어집니다', '갑자기 밑으로 사라집니다'],
  },
  look:  ['그대로 지켜봅니다.', '꼼짝 않고 봅니다.', '방망이가 나오지 않습니다.', '서서 공을 흘려보냅니다.'],
  ball:  ['볼.', '볼입니다.', '심판의 손은 올라가지 않습니다. 볼.'],
  held:  ['나오던 방망이를 멈춥니다.', '끝까지 참아 냅니다.', '속지 않습니다.', '반쯤 나온 방망이를 거둡니다.'],
  cstrike: ['스트라이크!', '스트라이크입니다.', '심판의 손이 올라갑니다. 스트라이크!'],
  whiff: {
    power:   ['힘껏 휘둘렀지만 공이 방망이 밑으로 지나갑니다. 헛스윙!', '풀스윙! 그러나 허공을 가릅니다. 헛스윙.', '크게 휘두른 방망이에 공이 닿지 않습니다. 헛스윙.', '온 힘을 실었지만 헛돕니다. 헛스윙!'],
    contact: ['짧게 갖다 댔지만 빗나갑니다. 헛스윙.', '맞히려고 했지만 공이 더 움직입니다. 헛스윙.', '방망이를 짧게 냈지만 스칩니다. 헛스윙.'],
    swing:   ['방망이가 나왔지만 헛스윙.', '타이밍이 맞지 않습니다. 헛스윙!', '방망이가 돌아갑니다. 헛스윙.', '따라 나갔지만 헛스윙.'],
  },
  foul: {
    power:   ['힘껏 잡아당겼지만 3루 쪽 관중석으로 넘어가는 파울.', '크게 휘둘러 맞혔지만 뒤로 날아갑니다. 파울.', '쩡! 소리는 컸지만 1루 쪽 담장 밖으로 휘어 나가는 파울.'],
    contact: ['끈질기게 걷어 냅니다. 파울.', '짧게 커트합니다. 파울.', '살짝 갖다 대어 뒤로 흘립니다. 파울.'],
    swing:   ['3루 쪽으로 빗나가는 파울.', '1루 쪽 관중석으로 들어가는 파울.', '뒤로 튀는 파울.', '방망이 끝에 맞고 옆으로 빠지는 파울.'],
  },
  hit: {
    power:   { good:['딱! 힘껏 잡아당깁니다.', '쩡! 제대로 걸렸습니다.', '풀스윙에 정확히 맞았습니다!'], bad:['힘껏 휘두릅니다!', '크게 휘두른 방망이에 맞습니다.', '풀스윙!'] },
    contact: { good:['짧게 끊어 정확히 맞힙니다.', '부드럽게 받아칩니다.', '가볍게 밀어 칩니다.'], bad:['짧게 맞힙니다.', '툭 갖다 댑니다.', '방망이를 짧게 잡고 맞힙니다.'] },
    swing:   { good:['딱!', '제대로 맞습니다!', '경쾌한 소리!'], bad:['맞았습니다.', '쳤습니다!', '방망이에 맞습니다.'] },
  },
};
const pickSay = (G, arr) => arr[Math.floor(rnd(G) * arr.length)];

/* ---------- 투구 한 개 (정밀 모드) ----------
   P(수비): { k:'pitch', t:구종, r:행, c:열, e:'in'|'edge'|'out', w:1~9 (5가 보통) } 또는 { k:'ibb' }
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
  G.pitchNo++; P.n++; P.load += POWER[Psel.w || 5].cost; fx(G, 'pitch');
  const pt = PITCH[Psel.t], vel = expVel(P, Psel.t, Psel.w) + Math.round(gauss(G) * 0.8);
  const pq = 0.45 * P.stf + 0.35 * gradeOf(P, Psel.t) + (pt.fast ? (vel - 147) * 0.7 : 4) + POWER[Psel.w || 5].q + P.cond * 4 - fatigue(P) * 14;
  // 제구: 겨냥한 곳에서 얼마나 벗어나는지
  const aim = aimXY(Psel);
  const sig = 0.25 * (1.45 - P.ctl / 100) * POWER[Psel.w || 5].err * pt.err * (1 + fatigue(P) * 0.8) * (1 - P.cond * 0.06);
  const x = aim.x + gauss(G) * sig, y = aim.y + gauss(G) * sig;
  const zd = Math.max(Math.abs(x), Math.abs(y)), inZone = zd <= 1;
  G.lastLoc = { x, y };
  // 그래픽 화면용: 방금 던진 공 (구종·코스·결과·타구)
  G.anim = { n: ((G.anim && G.anim.n) || 0) + 1, t: Psel.t, x, y, res:'take', hand: B.hand, swing:false, bb:null, vel };
  emit(G, `판정 제구: 오차 ${Math.round(Math.hypot(x - aim.x, y - aim.y) * 100)}, ${inZone ? '스트라이크 존 안' : '존 밖'}.`, 'd');
  // 앞부분: 투구 동작·구종·구속·움직임 (결과를 알 수 없게) / 뒷부분: 어디로 들어간 공이었는지
  const head = `제${G.pitchNo}구, ${pickSay(G, SAY.windup)} ${pt.name} ${vel}킬로, ${pickSay(G, SAY.move[Psel.t])}…`;
  const miss = Psel.e !== 'in' && zd < 0.42 ? ' 가운데로 몰린 실투였습니다.' : zd > 1.45 && Psel.e !== 'out' ? ' 제구가 크게 흔들렸습니다.' : '';
  const tail = ` ${locText(x, y)} 공이었습니다.${miss}`;
  // 타이밍: 직전 공과 구속 차이가 크면 타자가 속음
  let timing = 0;
  if(G.prev){
    if(G.prev.fast && !pt.fast && G.prev.vel - vel >= 12) timing = -6;
    else if(G.prev.t === Psel.t) timing = 4;
  }
  G.prev = { t: Psel.t, vel, fast: pt.fast };
  // 히트 앤드 런: 1루 주자가 미리 뛰고, 타자는 웬만하면 방망이를 내서 맞히기에 집중함
  // 히트 앤드 런: 감독 모드의 작전(hitrun)이거나, 정밀 모드에서 스윙에 함께 건 표시(Bsel.hr). 둘 다 1루 주자가 있어야 함
  const hr = G.bases[0] != null && (Bsel.k === 'hitrun' || (Bsel.hr && G.bases[1] == null && ['swing', 'power', 'contact'].includes(Bsel.k)));
  const k = Bsel.k === 'hitrun' ? 'contact' : Bsel.k, swingIntent = k === 'swing' || k === 'power' || k === 'contact';
  // 스윙 세기 1(맞히기)~9(풀스윙): 3·5·8이 옛 맞히기·치기·강하게와 같은 값 (swingP). 정하지 않으면 k에 맞는 옛 값
  const sw = swingIntent ? (Bsel.s != null ? clamp(Math.round(Bsel.s), 1, 9) : ({ contact:3, swing:5, power:8 })[k]) : 5, SP = swingP(sw);
  const breaking = !pt.fast;
  const end = () => { endPA(G); return flush(G); };
  const strikeCall = () => { const border = zd > 0.95 && zd < 1.05; if(!border) return inZone; return rnd(G) < clamp(0.5 - (zd - 1) * 8, 0.1, 0.9); };
  // 공을 치지 않았을 때: 볼·스트라이크 판정
  const taken = (why) => {
    // 몸쪽으로 크게 빠지면 몸에 맞을 수 있음
    if(x < -1.6 && rnd(G) < clamp(0.15 + (-1.6 - x) * 1.2, 0, 0.7)){
      emit(G, `${head} 아, 몸에 맞습니다! 몸에 맞는 공으로 1루에 나갑니다.`, 'r'); G.anim.res = 'hbp';
      B.st.bb++; T.BB++; P.st.bb++; forceWalk(G); fx(G, 'ball'); return 'end';
    }
    const strike = strikeCall(), border = zd > 0.95 && zd < 1.05, close = border ? '아슬아슬하게 ' : '';
    if(strike){
      G.strikes++; fx(G, 'strike');
      if(G.strikes >= 3){
        emit(G, `${head} ${why} ${close}${pickSay(G, ['스트라이크! 루킹 삼진.', '스트라이크 아웃! 루킹 삼진입니다.', '심판의 손이 올라갑니다. 루킹 삼진!'])}${tail}`, 'r');
        B.st.ab++; B.st.k++; P.st.k++; addOut(G); fx(G, 'k'); return 'end';
      }
      emit(G, `${head} ${why} ${close}${pickSay(G, SAY.cstrike)} ${countText(G)}.${tail}`, 'p');
    } else {
      G.balls++; fx(G, 'ballc');
      if(G.balls >= 4){
        emit(G, `${head} ${why} ${close}볼넷! 1루로 걸어 나갑니다.${tail}`, 'r');
        B.st.bb++; T.BB++; P.st.bb++; forceWalk(G); fx(G, 'ball'); return 'end';
      }
      emit(G, `${head} ${why} ${close}${pickSay(G, SAY.ball)} ${countText(G)}.${tail}`, 'p');
      const lb = looseBall(G, x, y, breaking, false);
      if(lb){ emit(G, lb.text, 'r'); fx(G, lb.outs ? 'out' : 'safe'); scoreRuns(G, lb.sc, false); if(G.outs >= 3) return 'end3'; }
    }
    return 'go';
  };

  /* 번트 */
  if(k === 'bunt') return bunt(G, { head, x, y, zd, inZone, vel, B, P, taken, end });

  /* 치지 않기 (지켜보기 · 도루) */
  let swing = false;
  if(hr){ swing = zd < 1.6; emit(G, '히트 앤드 런 작전, 1루 주자가 먼저 뜁니다.', 'c'); }
  else if(swingIntent){
    if(inZone) swing = true;
    else {
      const eye = B.eye + B.cond * 4 + SP.eye;
      const lure = pt.chase * ((y < 0 || x > 0) ? 1 : 0.5);
      swing = !check(G, '선구안', (eye / 100) * (0.6 + (zd - 1) * 2.0) - lure, '참음', '방망이가 나감');
    }
  }
  if(!swing){
    const why = pickSay(G, swingIntent ? SAY.held : SAY.look);
    const r = taken(why);
    const run = k === 'steal' || hr;
    if(run && r !== 'end' && G.outs < 3) doSteal(G, false, breaking, true, Bsel.from);
    else if(run && r === 'end' && G.outs < 3 && G.strikes >= 3) doSteal(G, false, breaking);
    if(G.review) return flush(G);
    if(r === 'end') return end();
    if(G.outs >= 3){ endPA(G, true); return flush(G); }
    return flush(G);
  }

  /* 휘두름 */
  const guess = Bsel.g ? (Bsel.g === 'fast') === pt.fast ? 9 : -7 : 0;
  const aimBonus = aimAdj(Bsel.aim, x, y, B.eye);
  if(aimBonus) emit(G, `판정 노려 치기: 노린 칸과 공의 거리에 따른 보정 ${aimBonus > 0 ? '+' : ''}${Math.round(aimBonus * 10) / 10}.`, 'd');
  const bq = soft(B.con, 0.7) + B.cond * 4 + SP.bq + guess + timing + aimBonus;
  const cen = clamp(1 - zd, 0, 1);
  const pCon = 0.84 + EZ(G, [0, 0.02, 0.05]) + (bq - pq) / 110 - (inZone ? 0.12 * (1 - cen) : 0.14 + (zd - 1) * 1.0);
  const kk = sw <= 4 ? 'contact' : sw >= 7 ? 'power' : 'swing';
  if(guess > 0) emit(G, '노리던 공이 들어옵니다.', 'd');
  if(timing < 0) emit(G, '느린 공에 타이밍을 빼앗깁니다.', 'd');
  if(!check(G, '맞히기', pCon, '맞힘', '헛스윙')){
    G.strikes++; fx(G, 'whiff-' + kk[0]); G.anim.res = 'whiff';
    if(G.strikes >= 3){
      const lb = looseBall(G, x, y, breaking, true);
      if(lb && lb.batSafe != null){
        B.st.ab++; B.st.k++; P.st.k++;
        emit(G, `${head} ${pickSay(G, SAY.whiff[kk])} 삼진! ${lb.text} 타자도 1루로 뜁니다, 낫아웃… ${lb.batSafe ? '세이프!' : `1루에서 아웃. ${G.outs + 1}아웃.`}${tail}`, 'r');
        if(!lb.batSafe) addOut(G);
        fx(G, 'k', lb.batSafe ? 'safe' : 'out'); scoreRuns(G, lb.sc, false);
        return end();
      }
      if(lb){ emit(G, lb.text, 'r'); scoreRuns(G, lb.sc, false); }
      emit(G, `${head} ${pickSay(G, SAY.whiff[kk])} 삼진 아웃!${tail}`, 'r');
      B.st.ab++; B.st.k++; P.st.k++; addOut(G); fx(G, 'k');
      if(hr && G.outs < 3) doSteal(G, false, breaking);
      return end();
    }
    emit(G, `${head} ${pickSay(G, SAY.whiff[kk])} ${countText(G)}.${tail}`, 'p');
    if(!hr){ const lb = looseBall(G, x, y, breaking, false); if(lb){ emit(G, lb.text, 'r'); fx(G, lb.outs ? 'out' : 'safe'); scoreRuns(G, lb.sc, false); if(G.outs >= 3){ endPA(G, true); return flush(G); } } }
    if(hr){ doSteal(G, false, breaking, true); if(G.review) return flush(G); if(G.outs >= 3){ endPA(G, true); return flush(G); } }
    return flush(G);
  }
  // 맞힘: 파울인지 안으로 들어갔는지
  const pFair = clamp(0.46 + (bq - pq) / 300 + (inZone ? 0.10 * cen : -0.12) - (G.strikes === 2 ? SP.c2 : 0), 0.25, 0.75);
  if(rnd(G) >= pFair){
    fx(G, 'batF', 'foul'); G.anim.res = 'foul';
    // 파울 플라이: 떨어질 곳과 시간을 계산해 야수가 닿으면 아웃 (playsim.js foulFly)
    let ff = null;
    if(rnd(G) < FOUL_FLY_P * Math.sqrt(parkOf(G).foul || 1)){
      ff = foulFly(G);
      (G.evs ||= []).push({ k:'foulfly', pos: ff.pos, caught: ff.caught, hang: ff.hang });   // (이 함수 안에서 ev는 타구 힘이라 ev()를 못 씀)
      if(ff.caught){
        emit(G, `${head} 높이 뜬 파울! ${ga(fielder(F, ff.pos))} 끝까지 따라가 잡습니다. 파울 플라이 아웃.`, 'r');
        B.st.ab++; addOut(G); fx(G, 'out'); return end();
      }
    }
    if(G.strikes < 2) G.strikes++;
    if(ff) emit(G, `${head} 높이 뜬 파울! ${ga(fielder(F, ff.pos))} 따라가 보지만 닿지 않고 파울 지역에 떨어집니다. ${countText(G)}.${tail}`, 'p');
    else emit(G, `${head} ${pickSay(G, SAY.foul[kk])} ${countText(G)}.${tail}`, 'p');
    return flush(G);
  }
  // 방향 노리기: 바깥쪽 공을 밀어치거나 몸쪽 공을 당겨치면 잘 맞고, 반대면 빗맞기 쉬움
  const dirFit = !Bsel.d ? 0 : (Bsel.d === 'oppo' ? x : -x) > 0.25 ? 0.08 : (Bsel.d === 'oppo' ? x : -x) < -0.25 ? -0.08 : 0;
  if(dirFit) emit(G, dirFit > 0 ? '노린 방향으로 칠 수 있는 공입니다.' : '노린 방향과 반대쪽 공입니다.', 'd');
  const q = clamp(rnd(G) * 0.75 + 0.08 + dirFit + EZ(G, [0, 0.03, 0.06]) + (bq - pq) / 220 + (inZone ? 0.18 * cen : -0.12), 0, 1);
  const ev = clamp(0.45 * q + 0.45 * soft(B.pow + B.cond * 4, 0.5) / 100 + SP.ev + (pt.fast && vel >= 153 ? 0.02 : 0) + gauss(G) * 0.035, 0, 1.08);
  emit(G, `판정 타구: 정확도 ${Math.round(q * 100)}, 힘 ${Math.round(ev * 100)}.`, 'd');
  fx(G, q > 0.75 ? 'batBig' : 'bat'); G.anim.res = 'inplay';
  G.hrun = hr;
  const hitWord = Psel.e !== 'in' && zd < 0.42 && q > 0.5 ? '가운데로 몰린 실투를 놓치지 않습니다!' : pickSay(G, SAY.hit[kk][q > 0.75 ? 'good' : 'bad']);
  inPlay(G, { head: `${head} ${hitWord}`, x, y, q, ev, k, SP, pt, d: Bsel.d });
  G.hrun = false;
  if(G.review || G.pendingThrow) return flush(G);
  return end();
}

/* ---------- 폭투·포일·낫아웃 ----------
   원바운드나 크게 빠진 공을 포수가 놓치면 공이 뒤로 굴러감. 주자는 포수가 공을 주워 던지는 시간과 비교해 다음 베이스로 뜀.
   3스트라이크 공을 놓쳤고 1루가 비었거나 2아웃이면 타자도 1루로 뛸 수 있음 (낫아웃) */
function looseBall(G, x, y, breaking, k3){
  const sev = Math.max(0, -y - 1.3) + Math.max(0, Math.abs(x) - 1.75) * 0.8;
  if(sev <= 0) return null;
  const b = G.bases, T = batTeam(G), F = fieldTeam(G), C = F.bat.find(q => q.pos === 'C') || { def:50 };
  const batRun = k3 && (b[0] == null || G.outs >= 2);
  if(!b.some(q => q != null) && !batRun) return null;
  const pAway = clamp(sev * 0.3 * (1.3 - C.def / 100) * (breaking ? 1.3 : 1), 0, 0.6);
  if(rnd(G) >= pAway) return null;
  const pb = C.def < 48 && sev < 0.45, word = pb ? '포일' : '폭투';
  const dd = 4 + rnd(G) * 14, side = x < 0 ? -1 : 1, ballP = [side * dd * 0.5, -1.5 - dd * 0.85];
  const tC = 0.45 + dd / 6.2 + 0.3;   // 포수가 공을 쫓아가 주움
  const thr = base => tC + 0.25 + dist2(ballP, BASE_XY[base]) / 26 + 0.1;
  const moves = [], sc = [];
  let thrown = false, outs = 0;
  for(let i = 2; i >= 0; i--){
    const r = b[i]; if(r == null) continue;
    const to = i + 1, R = T.bat[r], v = runV2(R.spd), arrive = 0.35 + (27.4 - 4.5) / v;
    const forced = i === 0 ? batRun : i === 1 ? b[0] != null && batRun : b[0] != null && b[1] != null && batRun;
    const room = to < 3 && moves.some(m => m.to === to) ? false : true;
    const blocked = to < 3 && b[to] != null && !moves.some(m => m.from === to);
    if(blocked && !forced) continue;
    const go = forced || (room && thr(to) - arrive + gauss(G) * 0.25 > 0.2);
    if(!go) continue;
    let out = false;
    if(!thrown && !forced){ thrown = true; out = thr(to) < arrive; }
    moves.push({ from:i, to, r, out, name: R.name });
  }
  if(!moves.length && !batRun) return null;   // 주자가 뛰지 않았으면 기록되지 않음
  let batSafe = null;
  if(batRun){ const v = runV(curBatter(G).spd), tb = 0.9 + 27.4 / v; batSafe = thrown || thr(0) > tb; }
  // 적용
  const nb = [...b];
  moves.forEach(m => { nb[m.from] = null; });
  moves.forEach(m => { if(m.out){ outs++; return; } if(m.to >= 3) sc.push(m.r); else nb[m.to] = m.r; });
  if(batSafe) nb[0] = T.bi;
  G.bases = nb; if(outs) addOut(G, outs);
  const bn = ['1루', '2루', '3루', '홈'];
  const parts = moves.map(m => m.out ? `${m.name}, ${bn[m.to]}로 뛰었지만 포수의 송구에 아웃!` : m.to >= 3 ? `${m.name}, 홈으로 들어옵니다!` : `${m.name} ${bn[m.to]}로.`);
  const text = `공이 뒤로 빠집니다! ${word}! ${parts.join(' ')}`;
  markPlay(G, { k:'wp', word, safe: !outs, tR:0, tB:0 });
  return { word, text, sc, batSafe, outs };
}

/* ---------- 번트 ---------- */
function bunt(G, o){
  const { head, zd, inZone, vel, B, taken, end } = o;
  const F = fieldTeam(G), inf = F.align.inf;
  if(zd > 1.35){   // 너무 빠지면 방망이를 거둠
    const r = taken('번트 자세에서 방망이를 거둡니다.');
    if(r === 'end3'){ endPA(G, true); return flush(G); }
    return r === 'end' ? end() : flush(G);
  }
  const pC = 0.74 + (B.con - 50) / 250 - (inZone ? 0 : (zd - 1) * 0.8) - (vel >= 151 ? 0.05 : 0);
  if(!check(G, '번트', pC, '공을 굴림', '파울')){
    G.strikes++; fx(G, 'foul');
    if(G.strikes >= 3){ emit(G, `${head} 번트 파울! 쓰리번트 실패로 삼진 아웃.`, 'r'); B.st.ab++; B.st.k++; curPitcher(G).st.k++; addOut(G); fx(G, 'k'); return end(); }
    emit(G, `${head} 번트를 댔지만 파울. ${countText(G)}.`, 'p');
    return flush(G);
  }
  fx(G, 'bunt'); G.anim.res = 'bunt';
  buntResult(G, head + ' 번트!', false);
  if(G.review) return flush(G);
  return end();
}
// 번트 타구 결과 (정밀·간단 공통): 굴러가는 공과 달려 나오는 수비수의 시간으로 계산 (playsim.js). 수비는 앞 주자를 잡을 수 있으면 앞으로, 아니면 1루로
function buntResult(G, head, simple){
  const B = curBatter(G), side = wpick(G, [['3b', 0.45], ['p', 0.2], ['1b', 0.35]]);
  const fi = side === '3b' ? 0 : side === 'p' ? 1 : 2, ang = [-0.5, 0, 0.45][fi] + gauss(G) * 0.12;
  const skill = simple ? 0 : (B.con - 50) / 100;
  const bb = rnd(G) < 0.07 - skill * 0.04
    ? { type:'pu', ang, d: 7 + rnd(G) * 9, hang: 1.4 + rnd(G) * 0.8, bunt:true, ev:0.1, q:0.2, fi }
    : { type:'gb', ang, v: 6.5 + rnd(G) * 5 - skill, dec: 3.0, bunt:true, ev:0.15, q:0.5, fi };
  const r = simPlay(G, bb, {});
  if(G.anim) G.anim.res = 'inplay';
  playOrReview(G, bb, r, fi, head, { fi, d:0 });
}
/* ---------- 인플레이 타구 (정밀 모드) ---------- */
function inPlay(G, o){
  const { x, y, q, ev, k, SP, pt, d: dir } = o;
  const F = fieldTeam(G), T = batTeam(G), B = curBatter(G), P = curPitcher(G);
  const inf = F.align.inf, of = F.align.of, defMod = (60 - F.def) / 300, pk = parkOf(G);
  // 방향: 몸쪽 공은 당겨 치기 쉬움
  let pull = 0.42; if(x < -0.3) pull += 0.15; if(x > 0.3) pull -= 0.15;
  if(dir) pull = clamp(pull + (dir === 'pull' ? 0.3 : -0.3), 0.08, 0.62);
  const side = wpick(G, [['pull', pull], ['cen', 0.33], ['oppo', 1 - pull - 0.33]]);
  const fi = side === 'cen' ? 1 : (side === 'pull') === (B.hand === 'R') ? 0 : 2;   // 0 왼쪽 · 1 가운데 · 2 오른쪽
  const pGB = 0.42 - y * 0.10 + pt.gb - (B.pow - 50) / 500 + SP.gb;
  const pPU = 0.05 + (q < 0.25 ? 0.10 : 0), pLD = 0.16 + q * 0.12;
  const type = wpick(G, [['gb', pGB], ['pu', pPU], ['ld', pLD], ['fb', 1 - pGB - pPU - pLD]]);
  if(G.anim) G.anim.bb = { type, fi, d: type === 'gb' ? 30 + ev * 30 : type === 'pu' ? 25 : type === 'ld' ? 50 + ev * 40 : 0 };
  const head = o.head.trim();
  // 뜬공 비거리와 바람으로 홈런·담장 맞는 타구를 먼저 정함 (나머지는 위치와 속도로 계산: playsim.js)
  const opt = {};
  // 타구 방향(각도)을 먼저 정하고, 그 방향의 담장 거리로 홈런을 판정 (그림의 담장과 같게)
  const bb = battedBall(G, { type, fi, ev, q, d:60 });
  let d = 0, raw = 0, wind = 0, fence = Math.round(fenceAng(G, bb.ang));
  if(type === 'fb'){
    wind = (WIND[G.wind.dir] || WIND.none).f[fi] * G.wind.spd * 1.6;
    raw = 43 + ev * 104 + gauss(G) * 5; d = Math.round(raw + wind);   // 담장은 타구 방향마다 다름(가운데 쪽이 멂)
    const wallX = Math.max(0, (pk.wall[fi] - 2.5) * 1.6), hrLine = fence + wallX, field = ['왼쪽', '가운데', '오른쪽'][fi];
    emit(G, `판정 비거리: ${Math.round(raw)}미터${wind ? `, 바람 ${wind > 0 ? '더하기' : '빼기'} ${Math.abs(Math.round(wind))}미터` : ''}, 담장 ${fence}미터.`, 'd');
    if(Math.abs(d - hrLine) <= 1){
      // 담장 꼭대기 근처: 심판은 가끔 잘못 봄. 판독하면 실제(계산한 비거리)대로
      const truth = d >= hrLine ? 'hr' : '2b', pW = 0.35, call = rnd(G) < pW ? flipCall(truth) : truth;
      if(G.anim) G.anim.bb = { type, fi, d };
      const bb0 = { ...bb, d, hang: 2.1 + d / 46 };
      openReview(G, { kind:'hr', call, truth, m: d - hrLine, side: call === 'hr' ? 1 - batIdx(G) : batIdx(G), p: pW, data:{ ev, bb: bb0, fence, info:{ d, raw, wind, fence, fi } },
        say: `${head} ${field} 담장 끝으로 날아갑니다… 넘어갔나요? 원심은 ${call === 'hr' ? '홈런' : '담장을 맞고 나온 2루타'}입니다. ${call === 'hr' ? '수비 쪽에서 담장을 맞았다고 강하게 어필합니다.' : '공격 쪽에서 넘어갔다고 강하게 어필합니다.'}` });
      return;
    }
    if(d >= hrLine) opt.hr = true; else if(d >= fence) opt.wall = true;
  }
  if(type === 'fb'){ bb.d = opt.wall ? fence - 1 : d; bb.hang = 2.1 + bb.d / 46; }
  const rng0 = G.rng, r = simPlay(G, bb, opt), info = { d, raw, wind, fence, fi };
  // 송구 선택: 사람이 수비하고 던질 곳이 둘 이상이면 잡은 순간에 멈추고 묻음. 같은 난수로 고른 곳을 다시 계산함(resolveThrow)
  if(type === 'gb' && !opt.hr && r.throwOpts && r.throwOpts.length >= 2 && askThrow(G)){
    G.rng = rng0;
    const who = fielder(F, r.pos);
    G.pendingThrow = { opts: r.throwOpts, pos: r.pos, who, auto: r.tgt, bb, opt, fi, info, hrun: !!G.hrun, fx: G.fx.splice(0), evs: (G.evs || []).splice(0), n: G.anim ? G.anim.n : 0 };
    if(G.anim) G.anim.n--;   // 이 공의 그림·소리·중계는 고른 뒤에 한꺼번에 (그림이 먼저 끝까지 가 버리지 않게)
    (G.evs ||= []).push({ k:'throwq', pos: r.pos, who, opts: r.throwOpts.map(o => o.base) });   // (이 함수 안에서 ev는 타구 힘이라 ev()를 못 씀)
    emit(G, `${head} 땅볼 타구가 ${who}에게 갑니다! 잡았습니다. 어디로 던질까요?`, 'r');
    return;
  }
  playOrReview(G, bb, r, fi, head, info);
}
// 사람이 수비하는 정밀 모드 경기에서, 설정이 켜져 있으면 송구할 곳을 물음 (컴퓨터·감독 모드·맡긴 쪽은 묻지 않고 컴퓨터가 고름)
const askThrow = G => G.mode === 'detail' && G.ctrl[1 - batIdx(G)] === 'human' && (typeof SET === 'undefined' || SET.pickThrow !== false);
function resolveThrow(G, base){
  const p = G.pendingThrow; if(!p) return flush(G);
  G.pendingThrow = null;
  if(G.anim) G.anim.n = p.n;
  G.fx.push(...p.fx); (G.evs ||= []).push(...p.evs);
  const valid = p.opts.some(o => o.base === base);
  G.hrun = p.hrun;
  const r = simPlay(G, p.bb, valid ? { ...p.opt, throwTo: base } : p.opt);
  G.hrun = false;
  ev(G, { k:'throw', base: valid ? base : p.auto, chosen: valid, auto: !valid || base === p.auto });
  if(valid) emit(G, `${josa(p.who, '은', '는')} ${BASE_TO[base]} 던지기로 합니다.`, 'c');
  playOrReview(G, p.bb, r, p.fi, '', p.info);
  if(!G.review) endPA(G);
  return flush(G);
}
// 아슬아슬한 베이스 승부가 있으면 심판이 판정(아주 아슬아슬하면 가끔 틀림)하고 비디오 판독을 고를 수 있게 함. 그림은 심판의 판정대로
function playOrReview(G, bb, r, fi, head, info){
  const c = r.close;
  if(!c || G.outs + 0 >= 3){ setAnimPlay(G, bb, r, fi); applyPlay(G, r, head, info); return; }
  const truth = c.m > 0 ? 'out' : 'safe', pW = clamp(0.45 * (1 - Math.abs(c.m) / 0.07), 0, 0.45);
  const call = rnd(G) < pW ? flipCall(truth) : truth, shown = call === truth ? r : flipPlay(r, c);
  setAnimPlay(G, bb, shown, fi);
  const F = fieldTeam(G), T = batTeam(G), runner = c.who < 0 ? curBatter(G).name : T.bat[G.bases[c.who]].name;
  const bn = ['1루', '2루', '3루', '홈'][c.base];
  openReview(G, { kind:'play', call, truth, m: c.m, side: call === 'out' ? batIdx(G) : 1 - batIdx(G), p: Math.max(0.05, pW), data:{ r, close: c, info, base: c.base },
    say: `${head} ${ga(fielder(F, r.pos))} ${BASE_TO[c.base]} 던집니다… ${runner}, ${bn}에서 아슬아슬! 원심은 ${callWord(call)}. ${call === 'safe' ? '수비 쪽에서 아웃이라고 강하게 어필합니다.' : `${runner}, 세이프라고 강하게 어필합니다.`}` });
}
// 판정이 반대였다면의 플레이 (아슬아슬했던 주자 한 명의 아웃·세이프만 바꿈)
function flipPlay(r0, c){
  const r = { ...r0, runners: r0.runners.map(x => ({ ...x })), call: r0.call.map(x => ({ ...x })) };
  const cl = r.call.filter(x => x.base === c.base).sort((a, b) => Math.abs(a.t - r.result) - Math.abs(b.t - r.result))[0];
  if(cl) cl.out = !cl.out;
  if(c.who < 0){
    if(r.bat === 0){ r.bat = c.base + 1; r.outs--; r.batOut = null; } else { r.bat = 0; r.outs++; r.batOut = { base: c.base, t: cl ? cl.t : r.result }; }
  } else {
    const x = r.runners.find(y => y.from === c.who);
    if(x){ if(x.to == null){ x.to = c.base; r.outs--; } else { x.to = null; x.at = c.base; x.tOut = cl ? cl.t : x.t; r.outs++; } }
  }
  if(['go', 'dp', 'fc', 'ifh'].includes(r.kind)) r.kind = r.bat === 0 ? (r.outs >= 2 ? 'dp' : 'go') : r.outs ? 'fc' : r.tgt === 0 ? 'ifh' : 'fc';
  return r;
}
// 그림·중계·소리가 쓸 플레이 기록 (숫자는 소수 둘째 자리까지)
function setAnimPlay(G, bb, r, fi){
  if(!G.anim) return;
  const T = batTeam(G);
  const rm = r.runners.map(x => ({ from: x.from, to: x.to, t0: x.t0 || 0, t: x.t || 0, at: x.at, back: !!x.back }));
  const ps = { ev: r.ev, fm: r.fmove, call: r.call, result: r.result, runT: r.runT || 0, kind: r.kind, bat: r.bat, batTried: r.batTried || r.bat, batOut: r.batOut || null, rm, cover: r.cover || null, bunt: !!bb.bunt };
  G.anim.bb = { type: bb.type, fi, d: bb.d || Math.round((bb.v || 20) * (bb.v || 20) / (2 * (bb.dec || 7))), hit: r.kind === 'hr' ? 4 : r.kind === 'hit' ? (r.hitBases || r.batTried || r.bat) : 0,
    ps: JSON.parse(JSON.stringify(ps, (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v)) };
}
// 계산한 플레이를 경기에 반영하고 중계 문장을 만듦
const BASE_TO = ['1루로', '2루로', '3루로', '홈으로'];
// 타구 결과 사건(play)을 문장으로. 글·중계·소리가 같은 사건에서 나오게 하려고 applyPlay의 문장 만들기를 옮겨 온 것
function describePlay(e){
  const who = e.who, dirW = e.dirW, outW = () => `${e.o}아웃.`;
  switch(e.kind){
    case 'go': if(e.bunt) return `번트, ${ga(who)} 잡아 1루로. 타자 아웃.${e.adv && e.o < 3 ? ' 희생 번트 성공!' : ''} ${outW()}`;
      return e.pos === '1B' && e.cover !== 'P' ? `땅볼, ${ga(who)} 잡아 직접 1루 베이스를 밟습니다. 아웃. ${outW()}` : e.cover === 'P' ? `땅볼, ${ga(who)} 잡아 베이스 커버를 들어온 투수에게 토스! 아웃. ${outW()}` : `땅볼, ${ga(who)} 잡아 1루로 송구. 아웃. ${outW()}`;
    case 'ifh': return e.bunt ? `번트가 절묘하게 굴러갑니다. ${ga(who)} 잡아 1루로 던지지만 세이프! 번트 안타.` : `땅볼, ${ga(who)} 잡아 1루로 던지지만 타자가 먼저 들어갑니다. 세이프! 내야 안타.`;
    case 'dp': return `${e.bunt ? '번트' : '땅볼'}, ${ga(who)} 잡아 ${BASE_TO[e.tgt]}, 다시 1루로. 병살! ${outW()}`;
    case 'fc': return e.outs ? `${e.bunt ? '번트' : '땅볼'}, ${ga(who)} 잡아 ${BASE_TO[e.tgt]} 던집니다. 앞 주자를 잡고, 타자는 1루에 삽니다. ${outW()}`
      : `${e.bunt ? '번트' : '땅볼'}, ${ga(who)} 잡아 ${BASE_TO[e.tgt]} 던졌지만 세이프! 야수 선택으로 모두 삽니다.`;
    case 'pu': return e.bunt ? `번트가 떠 버립니다. ${ga(who)} 잡아 아웃. ${outW()}` : `높이 떴습니다. 내야 뜬공, ${ga(who)} 잡습니다. ${outW()}`;
    case 'lo': return e.dive ? `날카로운 직선 타구! ${who}, 몸을 날려 잡아냅니다! ${outW()}` : `잘 맞은 직선 타구, 그러나 ${who} 정면. 직선타 아웃. ${outW()}`;
    case 'ldp': return `직선 타구, ${ga(who)} 잡고 1루로! 1루 주자가 돌아가지 못해 더블 플레이! ${outW()}`;
    case 'fo': return e.dive ? `${josa(dirW, '으로', '로')} 높이 뜬 타구, ${who}, 몸을 날려 잡아냅니다! 호수비! ${outW()}` : e.d >= e.fence - 12 ? `${dirW} 깊숙한 타구, ${ga(who)} 뒤로, 뒤로… 담장 앞에서 잡아냅니다! ${outW()}` : `${josa(dirW, '으로', '로')} 뜬 공, ${ga(who)} 잡습니다. ${outW()}`;
    case 'hr': {
      const fl = dirW, dd = e.d;
      return e.raw < e.fence && e.wind > 0 ? `높이 뜬 타구, ${josa(fl, '으로', '로')} 날아갑니다. 바람을 타고, 타고… 담장을 간신히 넘어갑니다! 홈런! 비거리 ${dd}미터.`
        : dd >= e.fence + 20 ? `큰 타구! ${fl} 담장을 훌쩍 넘어가는 대형 홈런! 비거리 ${dd}미터.` : dd < e.fence + 4 ? `${fl} 깊숙한 타구, 뒤로, 뒤로… 담장을 살짝 넘어갑니다! 홈런! 비거리 ${dd}미터.` : `큰 타구! ${fl} 담장을 넘어갑니다. 홈런! 비거리 ${dd}미터.`;
    }
    case 'err': return e.err === 'drop' ? `${josa(dirW, '으로', '로')} 뜬 공, ${who}, 잡는 듯했지만 공을 떨어뜨립니다! 포구 실책.` : e.err === 'throw' ? `땅볼, ${ga(who)} 잡아 1루로 던졌는데 송구가 빠집니다! 송구 실책으로 타자는 2루까지 갑니다.` : `${who}, 공을 놓칩니다! 포구 실책으로 타자는 1루에 나갑니다.`;
    default: {   // 안타
      const wallW = e.wall ? '담장을 맞고 나오는 ' : '';
      const hb = e.hb || e.tried;
      const base = hb >= 3 ? `${wallW}타구가 ${dirW} 깊숙이 굴러갑니다. 3루까지! 3루타!` : hb === 2 ? `${wallW}타구가 ${dirW}를 가릅니다. 2루까지! 2루타!` : e.type === 'gb' ? `땅볼이 ${dirW === '가운데' ? '투수 옆을' : dirW === '왼쪽' ? '3루수와 유격수 사이를' : '1루수와 2루수 사이를'} 빠져나갑니다. 안타!` : `${ga(who)} 쫓아가지만 앞에 떨어집니다. 안타!`;
      const extraN = !e.err && e.bat > hb ? e.bat : 0;
      return base + (extraN ? ` 다른 베이스로 송구가 가는 사이 타자 주자는 ${extraN}루까지 갑니다.` : '') + (e.bat === 0 ? ` 타자 주자는 한 베이스 더 노리다 아웃! ${outW()}` : '') + (e.err ? ' 송구가 빠지는 사이 한 베이스 더 갑니다!' : '');
    }
  }
}
function applyPlay(G, r, head, info = {}){
  const F = fieldTeam(G), T = batTeam(G), B = curBatter(G), P = curPitcher(G);
  const who = r.pos ? fielder(F, r.pos) : '', dirW = ['왼쪽', '가운데', '오른쪽'][info.fi ?? 1];
  const outsBefore = G.outs;
  const scored = [], nb = [null, null, null];
  const names = { 0:'1루', 1:'2루', 2:'3루' };
  const extra = [];
  r.runners.slice().sort((a, b) => b.from - a.from).forEach(x => {
    const id = G.bases[x.from]; if(id == null) return;
    if(x.to == null){ const bn = ['1루', '2루', '3루', '홈'][x.at ?? x.from + 1]; extra.push(`${names[x.from]} 주자 ${T.bat[id].name}, ${x.back ? '귀루하지 못해 아웃' : x.force ? `${bn}에서 포스 아웃` : `${bn}에서 태그 아웃`}.`); return; }
    if(x.to >= 3) scored.push(id);
    else { let b = x.to; while(b < 3 && nb[b] != null) b++; if(b >= 3) scored.push(id); else nb[b] = id; if(x.to - x.from >= 2) extra.push(`${names[x.from]} 주자 ${T.bat[id].name}, ${names[b]}까지 갑니다.`); }
  });
  if(r.bat >= 1 && r.bat <= 3){ let b = r.bat - 1; while(b < 3 && nb[b] != null) b++; if(b < 3) nb[b] = T.bi; else scored.push(T.bi); }
  if(r.bat === 4) scored.push(T.bi);
  // 기록
  const hitN = r.kind === 'hr' ? 4 : r.kind === 'hit' ? (r.hitBases || (r.batTried || r.bat || 1) - (r.bat === 0 ? 1 : 0)) : r.kind === 'ifh' ? 1 : 0;
  const sacBunt = r.bb && r.bb.bunt && r.kind === 'go' && r.runners.some(x => x.to > x.from);
  if(!(r.sac && r.outs === 1 && r.kind === 'fo') && !sacBunt) B.st.ab++;
  if(hitN > 0){
    B.st.h++; T.H++; P.st.h++;
    if(hitN === 4){ B.st.hr++; P.st.hr++; }
    const key = 'b' + Math.min(4, hitN); B.st[key] = (B.st[key] || 0) + 1;
    if(!B.cycle && B.st.b1 && B.st.b2 && B.st.b3 && B.st.b4){ B.cycle = true; feat(G, 'cycle', `대기록! ${T.short} ${B.name}, 사이클링 히트를 달성합니다!`, B, T); }
  }
  if(r.err) F.E++;
  if(r.outs) addOut(G, r.outs);
  // 사건: 타구 하나의 결과를 구조로 남기고, 문장은 이 사건에서 만듦(describePlay). 중계·효과음·그림은 문장이 아니라 이 사건을 읽음
  const pe = { k:'play', kind:r.kind, pos:r.pos || null, who, dir:info.fi ?? 1, dirW, hitBases:hitN, outs:r.outs || 0, o:G.outs, bunt:!!(r.bb && r.bb.bunt), type: r.bb ? r.bb.type : null,
    cover:r.cover || null, tgt:r.tgt, dive:!!r.dive, err: r.err ? (r.err.kind || 'misc') : null, tried:r.batTried || r.bat, hb:r.hitBases || 0, bat:r.bat, wall:!!r.wall, sac:!!r.sac,
    adv:r.runners.some(x => x.to > x.from), d:info.d, raw:info.raw, fence:info.fence, wind:info.wind, rm:scored.length };
  ev(G, pe);
  if(r.kind === 'dp' || r.kind === 'ldp') (G.hs || {}).dp++;
  const text = describePlay(pe);
  emit(G, [head, text].filter(Boolean).join(' '), 'r');
  extra.forEach(t => emit(G, t, 'r'));
  if(hitN === 4) fx(G, 'hr'); else if(hitN === 3) fx(G, 'b3'); else if(hitN === 2) fx(G, 'b2'); else if(hitN === 1) fx(G, 'hit');
  else if(r.err) fx(G, 'safe'); else fx(G, 'out');
  if(r.sac && r.kind === 'fo') emit(G, '3루 주자가 태그업해서 홈으로! 희생 플라이.', 'r');
  G.bases = nb;
  // 3아웃이 된 플레이(포스 아웃·뜬공)에서는 득점이 인정되지 않음 (안타 뒤 주루사는 먼저 들어온 득점 인정)
  if(G.outs >= 3 && r.kind !== 'hit') scored.length = 0;
  scoreRuns(G, scored, !(r.kind === 'dp' || r.kind === 'err'));
}
/* ---------- 타석 한 번 (간단 모드) ----------
   D(수비): 'attack' 정면 승부 · 'nibble' 유인구 승부 · 'ibb' 고의 볼넷
   O(공격): 'power' 강하게 · 'normal' 보통 · 'contact' 맞히기 · 'bunt' 번트 · 'steal' 도루 */
const SIMPLE_BASE = { K:20, BB:8, S1:15, S2:4.5, S3:0.5, HR:3, GO:25, FO:24 };
const EZ = (G, a) => a[(G && G.easy) || 0];   // 타격 난이도에 따른 값 [현실, 보통, 쉬움]
const SIMPLE_NAME = { K:'삼진', BB:'볼넷', S1:'안타', S2:'2루타', S3:'3루타', HR:'홈런', GO:'땅볼', FO:'뜬공' };
function simpleTable(D, O, hrMul = 1, easy = 0){
  const w = { ...SIMPLE_BASE };
  if(easy){ const m = [1, 1.3, 1.6][easy]; w.S1 *= m; w.S2 *= m; w.S3 *= m; w.HR *= [1, 1.2, 1.45][easy]; w.BB *= [1, 1.2, 1.35][easy]; w.K *= [1, 0.82, 0.68][easy]; }
  w.HR *= hrMul;
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
function playSimple(G, D, O, from){
  if(G.over) return flush(G);
  const T = batTeam(G), F = fieldTeam(G), B = curBatter(G), P = curPitcher(G);
  if(D === 'ibb'){
    emit(G, `고의 볼넷. ${josa(B.name, '을', '를')} 1루로 내보냅니다.`, 'r');
    B.st.bb++; T.BB++; P.st.bb++; forceWalk(G); fx(G, 'ball'); endPA(G); return flush(G);
  }
  if(O === 'steal'){
    if(stealCands(G).length){ doSteal(G, true, false, true, from); if(!G.review && G.outs >= 3) endPA(G, true); }
    return flush(G);
  }
  if(O === 'bunt'){ P.n++; buntResult(G, `${B.name}, 번트!`, true); if(!G.review) endPA(G); return flush(G); }
  P.n += rint(G, 3, 6);
  const rows = simpleTable(D, O, parkOf(G).hr, G.easy || 0), d = rint(G, 1, 100), row = rows.find(r => d >= r.from && d <= r.to);
  emit(G, '주사위 표: ' + rows.map(r => `${SIMPLE_NAME[r.k]} ${r.from}~${r.to}`).join(', ') + '.', 'd');
  // 화면 모드 그림용: 타석 한 번에 방식도 마지막 공 하나를 보여 줌 (경기 결과와는 상관없는 꾸밈이라 Math.random)
  G.anim = { n: ((G.anim && G.anim.n) || 0) + 1, t:'FB', x: row.k === 'BB' ? 1.4 : (Math.random() - 0.5) * 1.4, y: row.k === 'BB' ? -0.6 : (Math.random() - 0.5) * 1.4,
    res: row.k === 'K' ? 'whiff' : row.k === 'BB' ? 'take' : 'inplay', hand: B.hand, bb:null };
  simpleOutcome(G, row.k, `주사위 ${d}.`);
  if(!G.review) endPA(G);
  return flush(G);
}
// 간단 모드 결과 하나를 적용 (K 삼진 · BB 볼넷 · S1~S3 · HR · GO 땅볼 · FO 뜬공)
// 간단 모드의 주사위 결과(k)와 맞는 타구를 위치·속도 계산(playsim.js)으로 찾아 그 플레이로 보여 주고 기록함
function simpleSim(G, k, head){
  if(!['S1', 'S2', 'S3', 'HR', 'GO', 'FO'].includes(k) || typeof simPlay !== 'function') return false;
  const ok = r => ({ S1: (r.kind === 'hit' && (r.hitBases || r.batTried || r.bat) === 1) || r.kind === 'ifh', S2: r.kind === 'hit' && (r.hitBases || r.batTried || r.bat) === 2,
    S3: r.kind === 'hit' && (r.hitBases || r.batTried || r.bat) === 3, HR: r.kind === 'hr', GO: ['go', 'dp', 'fc'].includes(r.kind), FO: ['fo', 'pu', 'lo', 'ldp'].includes(r.kind) })[k];
  for(let i = 0; i < 40; i++){
    const fi = rint(G, 0, 2), u = rnd(G), probe = battedBall(G, { type:'fb', fi, ev:0.5, q:0.5, d:60 }), fence = Math.round(fenceAng(G, probe.ang));
    let type, ev, q = 0.3 + rnd(G) * 0.6, d = 0;
    const opt = {};
    if(k === 'HR'){ type = 'fb'; ev = 0.9 + u * 0.15; d = fence + 3 + Math.round(u * 22); opt.hr = true; }
    else if(k === 'S3'){ type = u < 0.5 ? 'ld' : 'fb'; ev = 0.85 + rnd(G) * 0.2; d = fence - 4 - Math.round(rnd(G) * 12); }
    else if(k === 'S2'){ type = u < 0.6 ? 'ld' : 'fb'; ev = 0.7 + rnd(G) * 0.3; d = fence - 8 - Math.round(rnd(G) * 25); }
    else if(k === 'S1'){ type = u < 0.5 ? 'gb' : 'ld'; ev = 0.35 + rnd(G) * 0.6; }
    else if(k === 'GO'){ type = 'gb'; ev = 0.1 + rnd(G) * 0.7; }
    else { type = u < 0.15 ? 'pu' : u < 0.35 ? 'ld' : 'fb'; ev = 0.2 + rnd(G) * 0.6; d = 50 + Math.round(rnd(G) * 45); }
    const bb = battedBall(G, { type, fi, ev, q, d });
    if(type !== 'gb'){ bb.ang = probe.ang; if(type === 'fb'){ bb.d = d; bb.hang = 2.1 + d / 46; } }   // 거리를 정한 그 방향으로
    const r = simPlay(G, bb, opt);
    if(!ok(r)) continue;
    if(G.anim){ G.anim.res = 'inplay'; setAnimPlay(G, bb, r, fi); }
    applyPlay(G, r, head, { d: bb.d || 0, raw: bb.d || 0, wind: 0, fence, fi });
    return true;
  }
  return false;
}
function simpleOutcome(G, k, head){
  if(simpleSim(G, k, head)) return;
  const T = batTeam(G), B = curBatter(G), P = curPitcher(G);
  const fi = rint(G, 0, 2), fieldWord = ['왼쪽', '가운데', '오른쪽'][fi];
  // 화면 모드 그림용 타구 (종류·방향·거리). 꾸밈이라 경기 난수를 쓰지 않음
  const fz = parkOf(G).fence[fi], rr = Math.random();
  const bb = { HR:{ type:'fb', d: fz + 15, hit:4 }, S3:{ type:'ld', d: fz - 6, hit:3 }, S2:{ type: rr < 0.5 ? 'ld' : 'fb', d: fz - 14, hit:2 }, S1:{ type: rr < 0.5 ? 'gb' : 'ld', d: 40 + rr * 25, hit:1 },
    GO:{ type:'gb', d: 25 + rr * 12 }, FO:{ type: rr < 0.25 ? 'pu' : 'fb', d: rr < 0.25 ? 25 : 55 + rr * 40 } }[k];
  if(bb && G.anim && G.anim.res === 'inplay') G.anim.bb = { ...bb, fi };
  const hit = (n, text) => { B.st.ab++; B.st.h++; T.H++; P.st.h++; if(n === 4){ B.st.hr++; P.st.hr++; fx(G, 'hr'); } else fx(G, n === 3 ? 'b3' : n === 2 ? 'b2' : 'hit'); emit(G, `${head} ${text}`, 'r'); onHit(G, n, 0.5, true); };
  switch(k){
    case 'K': B.st.ab++; B.st.k++; P.st.k++; addOut(G); emit(G, `${head} 헛스윙 삼진! ${G.outs}아웃.`, 'r'); fx(G, 'k'); break;
    case 'BB': B.st.bb++; T.BB++; P.st.bb++; emit(G, `${head} 볼넷으로 1루에 걸어 나갑니다.`, 'r'); forceWalk(G); fx(G, 'ball'); break;
    case 'S1':
      if(rnd(G) < 0.05){ simpleClose(G, head, 'safe'); break; }
      hit(1, `${josa(fieldWord, '으로', '로')} 가는 안타!`); break;
    case 'S2': hit(2, `${fieldWord} 깊숙한 타구, 2루타!`); break;
    case 'S3': hit(3, `${fieldWord} 끝까지 굴러가는 3루타!`); break;
    case 'HR': hit(4, `큰 타구! ${fieldWord} 담장을 넘어갑니다. 홈런!`); break;
    case 'GO': {
      const pos = pickOne(G, ['3B', 'SS', '2B', '1B']);
      if(G.bases[0] != null && G.outs < 2 && rnd(G) < 0.4){
        B.st.ab++; addOut(G, 2); G.bases[0] = null;
        emit(G, `${head} ${POS[pos]} 땅볼, 병살타! ${G.outs}아웃.`, 'r'); fx(G, 'out');
        if(G.outs < 3){ const b = G.bases, sc = []; if(b[2] != null){ sc.push(b[2]); b[2] = null; } if(b[1] != null){ b[2] = b[1]; b[1] = null; } scoreRuns(G, sc, false); }
      } else if(rnd(G) < 0.08){ simpleClose(G, head, 'out');
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
}

// 간단 모드의 아슬아슬한 1루 승부
function simpleClose(G, head, call){
  const B = curBatter(G), ok = call === 'safe';
  openReview(G, { kind:'first', call, side: ok ? 1 - batIdx(G) : batIdx(G), p: 0.35, data:{ simple:true },
    say: `${head} 땅볼, 1루에서 아슬아슬! 원심은 ${callWord(call)}. ${ok ? '수비 쪽에서 아웃이라고 강하게 어필합니다.' : `${B.name}, 세이프라고 강하게 어필합니다.`}` });
}

/* ---------- 공 하나씩 (간단 모드의 '공 하나씩' 방식) ----------
   한 번 고르면 공 하나: 주사위 하나로 공이 스트라이크 존에 들어오는지, 휘두르면 또 하나로 헛스윙·파울·인플레이를 정함.
   인플레이면 타석 주사위 표(안타·홈런·땅볼·뜬공)를 한 번 더 굴림. 볼카운트가 쌓이고 3스트라이크·4볼이면 타석이 끝남.
   D: 'attack' 정면 승부 · 'nibble' 유인구 · 'ibb' 고의 볼넷 / O: 'power' · 'normal' · 'contact' · 'take' 지켜보기 · 'bunt' */
const SP_ZONE = { attack:64, nibble:36 };
// 휘둘렀을 때 [헛스윙, 파울] 확률(%) (나머지는 인플레이)
const SP_SWING = {
  in:  { power:[25, 37], normal:[15, 42], contact:[8, 47] },
  out: { power:[55, 27], normal:[42, 32], contact:[30, 38] },
};
function playSimplePitch(G, D, O){
  if(G.over) return flush(G);
  if(D === 'ibb' || O === 'steal') return playSimple(G, D, O);
  const T = batTeam(G), B = curBatter(G), P = curPitcher(G);
  G.pitchNo++; P.n++; fx(G, 'pitch');
  const zoneN = SP_ZONE[D] || 55, d1 = rint(G, 1, 100), inZone = d1 <= zoneN;
  { const a = rnd(G) * 6.28, m = inZone ? rnd(G) * 0.9 : 1.15 + rnd(G) * 0.4; G.anim = { n: ((G.anim && G.anim.n) || 0) + 1, t:'FB', x: Math.cos(a) * m, y: Math.sin(a) * m, res:'take', hand: B.hand, bb:null }; }
  emit(G, `판정 공 위치: 1~${zoneN} 스트라이크, 주사위 ${d1}.`, 'd');
  // 앞부분만 들어서는 결과를 모르게: 공이 어디로 갔는지와 주사위 숫자는 결과 뒤에 붙임
  const where = inZone ? pickOne(G, ['스트라이크 존으로 들어온 공', '존 구석을 찌른 공', '가운데로 몰린 공']) : pickOne(G, ['존을 벗어난 공', '낮게 떨어진 공', '바깥쪽으로 빠진 공']);
  const head = `제${G.pitchNo}구, ${pickSay(G, SAY.windup)} ${pickSay(G, ['힘껏 던집니다…', '빠른 공을 뿌립니다…', '변화구를 던집니다…', '공을 던집니다…'])}`;
  const tail = ` ${where}이었습니다. (공 위치 주사위 ${d1})`;
  const kk = ({ power:'power', contact:'contact' })[O] || 'swing';
  const strike = text => {
    G.strikes++; fx(G, 'strike');
    if(G.strikes >= 3){ emit(G, `${head} ${text} 삼진 아웃! ${G.outs + 1}아웃.${tail}`, 'r'); B.st.ab++; B.st.k++; P.st.k++; addOut(G); fx(G, 'k'); endPA(G); return flush(G); }
    emit(G, `${head} ${text} ${countText(G)}.${tail}`, 'p'); return flush(G);
  };
  const ball = text => {
    G.balls++; fx(G, 'ballc');
    if(G.balls >= 4){ emit(G, `${head} ${text} 볼넷으로 1루에 걸어 나갑니다.${tail}`, 'r'); B.st.bb++; T.BB++; P.st.bb++; forceWalk(G); fx(G, 'ball'); endPA(G); return flush(G); }
    emit(G, `${head} ${text} ${countText(G)}.${tail}`, 'p'); return flush(G);
  };
  if(O === 'take') return inZone ? strike(`${pickSay(G, SAY.look)} ${pickSay(G, SAY.cstrike)}`) : ball(`${pickSay(G, SAY.look)} ${pickSay(G, SAY.ball)}`);
  if(O === 'bunt'){
    if(!inZone && rnd(G) < 0.6) return ball('번트 자세에서 방망이를 거둡니다. 볼.');
    if(!check(G, '번트', inZone ? 0.75 : 0.5, '공을 굴림', '파울')){
      if(G.strikes >= 2) return strike('번트 파울! 쓰리번트 실패로');
      G.strikes++; fx(G, 'foul'); emit(G, `${head} 번트를 댔지만 파울. ${countText(G)}.`, 'p'); return flush(G);
    }
    fx(G, 'bunt'); G.anim.res = 'bunt'; buntResult(G, `${head} 번트!`, true); if(!G.review) endPA(G); return flush(G);
  }
  // 존 밖 공은 휘두르려다가도 참아 낼 수 있음 (맞히기일수록 잘 참음)
  if(!inZone){
    const hold = { power:32, normal:50, contact:62 }[O] || 50, dh = rint(G, 1, 100);
    emit(G, `판정 참기: 1~${hold} 참음, 주사위 ${dh}.`, 'd');
    if(dh <= hold) return ball(`${pickSay(G, SAY.held)} ${pickSay(G, SAY.ball)}`);
  }
  let [wh, fo] = SP_SWING[inZone ? 'in' : 'out'][O] || SP_SWING.in.normal;
  wh = Math.round(wh * EZ(G, [1, 0.8, 0.62]));
  const d2 = rint(G, 1, 100);
  emit(G, `판정 스윙: 1~${wh} 헛스윙, ${wh + 1}~${wh + fo} 파울, ${wh + fo + 1}~100 인플레이, 주사위 ${d2}.`, 'd');
  if(d2 <= wh){ fx(G, 'whiff-' + kk[0]); G.anim.res = 'whiff'; return strike(pickSay(G, SAY.whiff[kk])); }
  if(d2 <= wh + fo){
    fx(G, 'batF', 'foul'); G.anim.res = 'foul';
    if(G.strikes < 2) G.strikes++;
    emit(G, `${head} ${pickSay(G, SAY.foul[kk])} ${countText(G)}.${tail}`, 'p'); return flush(G);
  }
  // 인플레이: 안타·홈런·땅볼·뜬공 표를 한 번 더 굴림 (존 밖 공을 치면 약한 타구가 많음)
  fx(G, 'bat'); G.anim.res = 'inplay';
  const w = { ...SP_PLAY[O] };
  { const m = EZ(G, [1, 1.35, 1.7]); w.S1 *= m; w.S2 *= m; w.S3 *= m; w.HR *= EZ(G, [1, 1.2, 1.45]); }
  w.HR *= parkOf(G).hr;
  if(!inZone){ w.HR *= 0.4; w.S2 *= 0.6; w.S1 *= 0.85; w.GO *= 1.3; w.FO *= 1.15; }
  const tot = Object.values(w).reduce((a, b) => a + b, 0), d3 = rint(G, 1, 100);
  let acc = 0, k = 'GO';
  for(const key of Object.keys(w)){ acc += w[key] / tot * 100; if(d3 <= Math.round(acc)){ k = key; break; } }
  emit(G, `판정 타구: 주사위 ${d3}, ${SIMPLE_NAME[k]}.`, 'd');
  simpleOutcome(G, k, `${head} ${pickSay(G, SAY.hit[kk][['HR', 'S2', 'S3', 'S1'].includes(k) ? 'good' : 'bad'])}`);
  if(!G.review) endPA(G);
  return flush(G);
}
// 인플레이 타구 표 (무게)
const SP_PLAY = {
  power:   { S1:17, S2:7.5, S3:0.6, HR:8.5, GO:30, FO:37 },
  normal:  { S1:22, S2:6.5, S3:0.7, HR:4.5, GO:35, FO:31 },
  contact: { S1:27, S2:4.5, S3:0.7, HR:1.4, GO:40, FO:27 },
};

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
  old.exitLead = leadFor(G, ti); nw.entryLead = leadFor(G, ti);
  emit(G, `${T.short} 투수 교체: ${old.name}에서 ${josa(nw.name, '으로', '로')} 바뀝니다. ${nw.name}, 최고 구속 ${nw.vel}킬로.`, 'c');
  fx(G, 'pchange');
}

/* ---------- 감독 모드 ----------
   감독은 타석마다 작전만 지시하고, 공 하나하나는 선수(컴퓨터)가 던지고 침.
   D(수비): { k:'normal' 맡기기 | 'attack' 정면 승부 | 'nibble' 어렵게 승부 | 'ibb' 고의 볼넷 }
   O(공격): { k:'normal' 맡기기 | 'aggr' 적극적으로 | 'patient' 신중하게 | 'bunt' 번트 | 'steal' 도루 | 'hitrun' 히트 앤드 런 } */
const ORDER_DEF = { normal:'투수에게 맡기기', attack:'정면 승부', nibble:'어렵게 승부', ibb:'고의 볼넷' };
const ORDER_OFF = { normal:'타자에게 맡기기', aggr:'적극적으로 쳐라', patient:'신중하게 골라라', bunt:'번트', steal:'도루', hitrun:'히트 앤드 런' };
function playManager(G, D, O){
  if(G.over) return flush(G);
  if(D.k === 'ibb') return playPitch(G, { k:'ibb' }, { k:'take' });
  const acc = { lines:[], fx:[], events:[] }, pa = G.pa, half = G.half;
  let first = true, guard = 0;
  while(!G.over && !G.review && G.pa === pa && G.half === half && guard++ < 40){
    const P = aiPitch(G, D.k);
    let B = aiBat(G, O.k);
    if(first && O.k === 'steal' && stealCands(G).length) B = { k:'steal', g:null, from:O.from };
    if(first && O.k === 'hitrun' && G.bases[0] != null && canSteal(G)) B = { k:'hitrun', g:null };
    if(O.k === 'bunt' && G.strikes < 2) B = { k:'bunt', g:null };
    first = false;
    const r = playPitch(G, P, B);
    acc.lines.push(...r.lines); acc.fx.push(...r.fx); acc.events.push(...r.events);
  }
  return acc;
}
// 타순 추천: 4번(장타) → 3번 → 1번(발·출루) → 5번 → 2번 → 나머지는 잘 치는 순서
function recommendLineup(G, ti){
  const T = G.teams[ti];
  T.bat = bestOrder(T.bat);
  emit(G, `${T.short} 타순을 추천 타순으로 바꿨습니다.`, 'c');
  return flush(G);
}
function bestOrder(bat){
  const left = bat.slice(), out = new Array(9);
  const score = [
    b => b.spd + b.con * 0.8 + b.eye * 0.8, b => b.con + b.eye * 0.7 + b.spd * 0.4, b => b.con + b.pow * 0.8,
    b => b.pow * 1.3 + b.con * 0.4, b => b.pow + b.con * 0.6,
  ];
  const take = (slot, f) => { left.sort((a, b) => f(b) - f(a)); out[slot] = left.shift(); };
  [3, 2, 0, 4, 1].forEach(s => take(s, score[s]));
  left.sort((a, b) => (b.con + b.pow) - (a.con + a.pow)).forEach((b, i) => { out[5 + i] = b; });
  return out;
}
function swapOrder(G, ti, i, j){
  const T = G.teams[ti], a = T.bat[i], b = T.bat[j];
  T.bat[i] = b; T.bat[j] = a;
  emit(G, `${T.short} 타순 변경: ${i + 1}번 ${b.name}, ${j + 1}번 ${a.name}.`, 'c');
  return flush(G);
}
function setStarter(G, ti, idx){
  const T = G.teams[ti], P = T.pit[idx];
  if(!P || idx === T.pi) return flush(G);
  T.pit[T.pi].used = false; T.pi = idx; P.used = true;
  emit(G, `${T.short} 선발 투수: ${P.name}${P.starter ? '' : '. 불펜 투수라 오래 던지지 못합니다'}.`, 'c');
  return flush(G);
}
// 벤치 선수 넣기. kind: pre(경기 전, 빠진 선수는 벤치로) · ph(대타) · pr(대주자, slot은 그 주자의 타순)
// benchIn: 문장만 남김 (타석 시작 중에 컴퓨터가 바꿀 때) / useBench: 사람이 바꿀 때
function useBench(G, ti, slot, b, kind){ benchIn(G, ti, slot, b, kind); return flush(G); }
function benchIn(G, ti, slot, b, kind){
  const T = G.teams[ti], old = T.bat[slot], nw = T.bench[b];
  if(!old || !nw) return;
  nw.pos = old.pos;
  T.bat[slot] = nw;
  if(kind === 'pre'){ T.bench[b] = old; emit(G, `${T.short} 선발 명단 변경: ${slot + 1}번 ${POS[nw.pos]} ${nw.name}, ${josa(old.name, '은', '는')} 벤치로.`, 'c'); }
  else {
    T.bench.splice(b, 1); T.gone.push(old);
    if(kind === 'ph'){
      old.st.pa--; nw.st.pa++;
      emit(G, `${T.short} 대타: ${old.name} 대신 ${nw.name}, ${handText(nw.hand)}. ${nw.role}입니다.`, 'c');
    } else {
      const base = G.bases.indexOf(slot);
      emit(G, `${T.short} 대주자: ${base + 1}루 주자 ${old.name} 대신 ${nw.name}.`, 'c');
    }
  }
  T.def = teamDef(T);
  fx(G, 'sub');
}
// 중요한 순간: 감독에게 작전을 물을 때 (ti 팀 기준)
function mgrImportant(G, ti){
  if(G.over) return false;
  const b = G.bases, on = b.some(x => x != null), risp = b[1] != null || b[2] != null;
  const late = G.inning >= Math.max(2, G.innings - 2), close = Math.abs(runsOf(G.teams[0]) - runsOf(G.teams[1])) <= 2;
  if(batIdx(G) === ti) return risp || (b[0] != null && G.outs === 0) || (late && close && on);
  const P = curPitcher(G);
  return risp || fatigue(P) > 0.2 || P.st.r >= 4 || (late && close && on);
}
