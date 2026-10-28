'use strict';
/* ===================== 선수 육성 모드 =====================
   내 선수 한 명을 만들어 리그의 한 팀에 신인으로 들어감. 리그(league.js)를 그대로 쓰고, 저장은 'bb_career'.
   - 2군: 날마다 훈련하고 퓨처스리그(2군) 경기를 함. 실력이 1군 주전보다 좋아지면 1군으로 올라감
   - 1군: 경기에서 내 선수의 타석(또는 내 선수가 던지는 동안)만 직접 하고, 나머지는 빠르게 진행 (G.focus)
   - 훈련·경기 결과로 성장 점수가 쌓이고 10점마다 능력치가 1씩 오름. 나이가 많을수록 천천히 오름
   - 슬럼프·부상·인터뷰 같은 일이 가끔 생기고, 첫 안타·첫 승 같은 업적을 남김. 은퇴하면 명예의 전당 심사 */
const BAT_TYPES = [
  { key:'contact', name:'교타자', s:'정확하게 맞히고 공을 잘 봅니다.', mod:{ con:8, eye:6, pow:-6 } },
  { key:'power',   name:'거포', s:'멀리 칩니다. 삼진도 많습니다.', mod:{ pow:10, con:-4, spd:-4 } },
  { key:'speed',   name:'호타준족', s:'발이 빠르고 잘 맞힙니다.', mod:{ spd:12, con:4, pow:-6 } },
  { key:'glove',   name:'수비형', s:'수비가 뛰어납니다.', mod:{ def:12, con:-2 } },
];
const PIT_TYPES = [
  { key:'heat',  name:'강속구', s:'빠른 공으로 윽박지릅니다.', mod:{ vel:6, ctl:-6, stf:4 } },
  { key:'ctl',   name:'제구형', s:'원하는 곳에 정확하게 던집니다.', mod:{ ctl:10, vel:-2 } },
  { key:'break', name:'변화구형', s:'날카로운 변화구가 무기입니다.', mod:{ stf:8, ctl:2, vel:-3 } },
];
const BAT_TRAIN = [['con', '타격 훈련', '컨택'], ['pow', '힘 훈련', '파워'], ['eye', '선구안 훈련', '선구안'], ['spd', '주루 훈련', '스피드'], ['def', '수비 훈련', '수비']];
const PIT_TRAIN = [['vel', '구속 훈련', '구속'], ['ctl', '제구 훈련', '제구'], ['stf', '변화구 훈련', '구위'], ['sta', '체력 훈련', '체력']];
const CR = () => { LSRC = 'career'; return LG(); };
const C = L => L.career;
// 내 선수: 2군이면 career.p, 1군이면 팀 명단 안에 있음
const myP = L => C(L).where === 'minor' ? C(L).p : (findPlayer(L, C(L).id) || {}).p;
const isPit = p => !!p.vel;
const ratingBat = p => (p.con * 1.2 + p.pow + p.eye * 0.8 + p.spd * 0.4 + p.def * 0.6) / 4;
const ratingPit = p => (p.ctl + p.stf + (p.vel - 120) * 1.5) / 3;
const growMul = age => age <= 23 ? 1.3 : age <= 27 ? 1 : age <= 31 ? 0.7 : 0.4;
function crLog(L, text){ (C(L).ach ||= []).push({ season:L.season, day:L.day + 1, text }); }

/* ---------- 새 선수 ---------- */
const NEWC = { name:'', pit:false, pos:'SS', type:null, role:'sp', team:null };
function careerNew(){
  const L = leagueNew({ my: NEWC.team, len: NEW.len || 36, mode: NEW.mode === 'simple' ? 'simple' : 'detail', unit:'pitch', inn: 9, seed:(Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0 });
  const S = STYLES[teamInfo(NEWC.team).style];
  let p;
  if(NEWC.pit){
    p = leaguePlayer(makePitcher(L, S, NEWC.role === 'sp', -8), NEWC.role === 'sp' ? '선발' : '불펜');
    const m = PIT_TYPES.find(t => t.key === NEWC.type).mod;
    for(const k in m) p[k] = clamp(p[k] + m[k], k === 'vel' ? 130 : 25, k === 'vel' ? 162 : 90);
  } else {
    const slot = LINEUP_POS.indexOf(NEWC.pos);
    p = leaguePlayer(makeBatter(L, S, slot < 0 ? 4 : slot, -8)); p.pos = NEWC.pos;
    const m = BAT_TYPES.find(t => t.key === NEWC.type).mod;
    for(const k in m) p[k] = clamp(p[k] + m[k], 25, 90);
  }
  p.name = NEWC.name; p.age = 20; p.rookie = true; p.cond = 0;
  L.career = { id:p.id, p, where:'minor', pit:NEWC.pit, type:NEWC.type, pts:{}, fame:0, trained:-1, minor:{}, ach:[], hurt:0, slump:0 };
  crLog(L, `${p.name}, ${teamInfo(NEWC.team).name}에 입단했습니다! 퓨처스리그(2군)에서 시작합니다.`);
  return L;
}
function careerNameScreen(){
  return { q:'선수 이름을 명령 칸에 적고 입력을 누르세요.', focusCmd:true, back: v => go(careerHome, v),
    onText: t => { t = t.trim().slice(0, 10); if(!t) return; NEWC.name = t; go(careerKindScreen, 'click'); }, opts:[] };
}
function careerKindScreen(){
  return { q:`${NEWC.name} 선수는 타자인가요, 투수인가요?`, back: v => go(careerNameScreen, v), opts:[
    { n:1, t:'타자', act: v => { NEWC.pit = false; go(careerPosScreen, v); } },
    { n:2, t:'투수', act: v => { NEWC.pit = true; go(careerRoleScreen, v); } },
  ] };
}
function careerPosScreen(){
  return { q:'수비 위치를 고르세요.', back: v => go(careerKindScreen, v),
    opts: ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'].map((k, i) => ({ n: i + 1, t: POS[k], act: v => { NEWC.pos = k; go(careerTypeScreen, v); } })) };
}
function careerRoleScreen(){
  return { q:'선발 투수가 될까요, 불펜 투수가 될까요?', back: v => go(careerKindScreen, v), opts:[
    { n:1, t:'선발 투수', s:'로테이션에 들어가 닷새마다 길게 던집니다. 승리를 쌓습니다.', act: v => { NEWC.role = 'sp'; go(careerTypeScreen, v); } },
    { n:2, t:'불펜 투수', s:'경기 후반에 짧게 던집니다. 마무리가 되면 세이브를 쌓습니다.', act: v => { NEWC.role = 'rp'; go(careerTypeScreen, v); } },
  ] };
}
function careerTypeScreen(){
  const list = NEWC.pit ? PIT_TYPES : BAT_TYPES;
  return { q:'어떤 선수가 될까요?', back: v => go(NEWC.pit ? careerRoleScreen : careerPosScreen, v),
    opts: list.map((t, i) => ({ n: i + 1, t: t.name, s: t.s, act: v => { NEWC.type = t.key; NEW.kind = 'career'; go(() => teamScreen(0), v); } })) };
}
function careerLenScreen(){
  const set = (n, v) => { NEW.len = n; go(careerModeScreen, v); };
  return { q:'한 시즌에 팀마다 몇 경기를 할까요?', back: v => go(() => teamScreen(0), v), opts:[
    { n:1, t:'36경기', s:'시즌이 빨리 지나 여러 해의 경력을 쌓기 좋습니다.', act: v => set(36, v) },
    { n:2, t:'72경기', act: v => set(72, v) },
    { n:3, t:'144경기', s:'KBO와 같은 길이입니다.', act: v => set(144, v) },
    { n:4, t:'18경기', s:'아주 짧은 시즌.', act: v => set(18, v) },
  ] };
}
function careerModeScreen(){
  const set = (m, v) => { NEW.mode = m; NEWC.team = NEW.a; setLG(careerNew()); leagueNews(LG()); go(careerHome, v, C(LG()).ach.map(x => x.text)); };
  return { q:'내 선수 차례는 어떻게 할까요?', back: v => go(careerLenScreen, v), opts:[
    { n:1, t:'정밀 모드', s: NEWC.pit ? '공마다 구종, 코스, 세기를 고릅니다.' : '공마다 치기, 강하게, 맞히기, 지켜보기를 고릅니다.', act: v => set('detail', v) },
    { n:2, t:'간단 모드 (공 하나씩)', s:'주사위로 공 하나씩 진행합니다.', act: v => set('simple', v) },
  ] };
}

/* ---------- 육성 첫 화면 ---------- */
function careerStatus(L){
  const c = C(L), p = myP(L), T = L.teams[L.my], out = [];
  const where = c.hurt > 0 ? `부상 중, ${c.hurt}일 뒤 돌아옴` : c.where === 'minor' ? '퓨처스리그(2군)' : isPit(p) ? `1군 ${p.role}` : `1군 주전 ${T.bat.indexOf(p) + 1}번 타자`;
  out.push(`${p.name}, ${p.age}세, ${teamInfo(L.my).name} ${isPit(p) ? '투수' : POS[p.pos]}. ${where}. 인기 ${c.fame}.`);
  out.push(isPit(p) ? `능력치: 구속 ${p.vel}, 제구 ${p.ctl}, 구위 ${p.stf}, 체력 ${p.sta}. 컨디션 ${COND[p.cond]}.` : `능력치: 컨택 ${p.con}, 파워 ${p.pow}, 선구안 ${p.eye}, 스피드 ${p.spd}, 수비 ${p.def}. 컨디션 ${COND[p.cond]}.`);
  const s = p.ss || {}, m = c.minor || {};
  if(c.where !== 'minor') out.push(isPit(p) ? `이번 시즌 1군: ${pitLine(p).replace(/^[^:]+: /, '')}` : `이번 시즌 1군: ${batLine(p).replace(/^[^:]+: /, '')}`);
  if(m.g) out.push(isPit(p) ? `퓨처스리그: ${m.g}경기 ${m.w || 0}승, ${ipText(m.out || 0)}, 평균자책점 ${m.out ? (m.r * 27 / m.out).toFixed(2) : '-'}.` : `퓨처스리그: ${m.g}경기 타율 ${avgText(m.ab ? m.h / m.ab : 0)}, 홈런 ${m.hr || 0}.`);
  if(L.phase === 'season') out.push(`${L.season}시즌 ${L.day + 1}일째. 팀은 ${myRank(L).rank}위, ${T.w}승 ${T.l}패.`);
  else if(L.phase === 'post') out.push(seriesText(L));
  else out.push(...awardLines(L));
  return out;
}
function careerHome(){
  LSRC = 'career';
  const L = LG();
  if(!L || !L.career) return { q:'선수 육성 모드입니다. 새 선수를 만들까요?', back: v => go(homeScreen, v),
    note:['내 선수 한 명을 만들어 신인으로 입단합니다. 2군에서 훈련하며 실력을 키워 1군 주전이 되고, 타이틀과 우승, 명예의 전당을 노립니다.', '1군 경기에서는 내 선수의 타석(투수라면 내 선수가 던지는 동안)만 직접 하고, 나머지는 빠르게 진행합니다.'],
    opts:[{ n:1, t:'새 선수 만들기', act: v => go(careerNameScreen, v) }] };
  const c = C(L), p = myP(L), done = L.phase === 'done', g = myGameToday(L);
  if(c.retired) return { q:'은퇴한 선수입니다. 새 선수를 만들까요?', back: v => go(homeScreen, v), note: c.final || [], opts:[
    { n:1, t:'새 선수 만들기', act: v => go(careerNameScreen, v) }, { n:7, t:'업적과 경력', act: v => go(careerLogScreen, v) }, { n:8, t:'기록실과 명예의 전당', act: v => go(archiveScreen, v) }] };
  const saved = (() => { const s = loadSaved(); return s && s.G.career && s.G.career.day === L.day && s.G.career.phase === L.phase && s.G.career.season === L.season ? s : null; })();
  const first = c.where !== 'minor' && c.hurt <= 0;
  const trained = c.trained === `${L.season}-${L.phase}-${L.day}`;
  // 선발 투수는 로테이션 차례가 아닌 날엔 경기를 지켜봄
  const offDay = first && g && isPit(p) && p.role === '선발' && T0().sp[T0().rot % T0().sp.length].id !== c.id;
  function T0(){ return L.teams[L.my]; }
  return { q: done ? '시즌이 끝났습니다. 다음 시즌을 시작할까요?' : '오늘은 무엇을 할까요?', back: v => go(homeScreen, v), note: careerStatus(L), opts:[
    done ? { n:1, t:'다음 시즌 시작', s:'한 살 더 먹고, 나이에 따라 능력치가 바뀝니다.', act: v => careerNextSeason(v) }
      : { n:1, t: saved ? '진행 중인 경기 이어하기' : c.hurt > 0 ? '쉬면서 회복하기' : offDay ? '오늘 경기 보기 (등판 차례 아님)' : first ? (g ? '오늘 1군 경기 하기' : '포스트시즌 결과 보기') : '퓨처스리그(2군) 경기 하기',
          s: saved ? situation(saved.G) : offDay ? '선발 로테이션 차례가 아니라 결과만 봅니다.' : first && g ? '내 선수 차례만 직접 합니다.' : '', act: v => saved ? resumeGame(v) : c.hurt > 0 ? careerRest(v) : offDay ? careerSimDay(v) : first && g ? careerPlay(v) : careerMinorDay(v) },
    { n:2, t: trained ? '오늘 훈련은 마쳤습니다' : '훈련하기', hide: done || c.hurt > 0, s:'경기 전에 하루 한 번 훈련합니다.', act: v => trained ? speak('오늘 훈련은 이미 했습니다.') : go(trainScreen, v) },
    { n:3, t:'오늘 경기 결과만 보기', hide: done || !first || !g, s:'내 선수 경기도 컴퓨터가 진행하고 내 기록만 알려 줍니다.', act: v => careerSimDay(v) },
    { n:4, t:'내 선수 정보', act: v => go(careerInfoScreen, v) },
    { n:5, t:'팀 순위', act: v => go(standScreen, v) },
    { n:6, t:'기록 순위', act: v => go(() => leadersScreen(null), v) },
    { n:7, t:'업적과 경력', act: v => go(careerLogScreen, v) },
    { n:8, t:'기록실과 명예의 전당', act: v => go(archiveScreen, v) },
    { n:9, t:'은퇴하기와 설정', act: v => go(careerSet, v) },
  ] };
}

/* ---------- 훈련 ---------- */
function trainScreen(){
  const L = CR(), p = myP(L), list = isPit(p) ? PIT_TRAIN : BAT_TRAIN, c = C(L);
  const opts = list.map(([k, t, nm], i) => ({ n: i + 1, t, s:`${nm} ${p[k]}, 성장 점수 ${Math.round(c.pts[k] || 0)}/10`, act: v => doTrain(k, nm, v) }));
  opts.push({ n:9, t:'푹 쉬기', s:'컨디션이 좋아집니다.', act: v => doTrain(null, null, v) });
  return { q:'어떤 훈련을 할까요?', back: v => go(careerHome, v), opts };
}
function grow(L, k, amt){
  const c = C(L), p = myP(L), out = [];
  c.pts[k] = (c.pts[k] || 0) + amt * growMul(p.age);
  while(c.pts[k] >= 10){
    c.pts[k] -= 10;
    const max = k === 'vel' ? 162 : k === 'sta' ? 120 : 99;
    if(p[k] < max){ p[k]++; out.push(`${({ con:'컨택', pow:'파워', eye:'선구안', spd:'스피드', def:'수비', vel:'구속', ctl:'제구', stf:'구위', sta:'체력' })[k]}이 ${p[k]}로 올랐습니다!`); if(k === 'stf') (p.pitches || []).forEach(x => { x.g = Math.min(99, x.g + 1); }); }
  }
  return out;
}
function doTrain(k, nm, via){
  const L = CR(), c = C(L), p = myP(L);
  c.trained = `${L.season}-${L.phase}-${L.day}`;
  let say;
  if(!k){ p.cond = Math.min(2, p.cond + 1); say = [`푹 쉬었습니다. 컨디션 ${COND[p.cond]}.`]; }
  else {
    const up = grow(L, k, 4 + rnd(L) * 3);
    if(rnd(L) < 0.2){ p.cond = Math.max(-2, p.cond - 1); up.push('훈련이 힘들어 몸이 조금 무겁습니다.'); }
    say = [`${nm} 훈련을 했습니다. 성장 점수 ${Math.round(c.pts[k])}/10.`, ...up];
  }
  saveLeague(); go(careerHome, via, say);
}

/* ---------- 경기 ---------- */
// 1군 경기: 내 선수 차례만 직접 함
function careerPlay(via){
  const L = CR(), g = myGameToday(L), c = C(L), p = myP(L); if(!g) return;
  const opts = leagueGameOpts(L, g.a, g.h, ['cpu', 'cpu'], L.mode === 'simple' ? 'simple' : 'detail', 'pitch');
  // 선발 투수인데 오늘이 내 차례가 아니면 불펜에 대기 / 불펜 투수는 늘 대기
  G = newGame(opts);
  G.focus = c.id; G.focusTeam = g.a === L.my ? 0 : 1;
  G.career = { season:L.season, day:L.day, phase:L.phase, label: g.label || `${L.season}시즌 ${L.day + 1}일째` };
  saveLeague();
  GS.opts = null; GS.pend = { def:null, off:null }; GS.auto = null; GS.holder = -1; GS.sel = null; UI.logG = null;
  const r = flush(G);
  const pre = isPit(p) ? (G.teams[G.focusTeam].pit[0].id === c.id ? '오늘은 내가 선발 투수입니다.' : '불펜에서 대기합니다. 감독이 부르면 마운드에 오릅니다.') : `${G.teams[G.focusTeam].bat.findIndex(b => b.id === c.id) + 1}번 타자로 나갑니다.`;
  gameNext(via, { lines:[{ s:`${G.career.label} 1군 경기. ${pre}`, k:'i' }, ...r.lines], fx: r.fx });
}
// 경기 뒤: 내 기록으로 성장 점수, 업적, 인터뷰, 리그 하루 진행
function careerAfterGame(G){
  const L = CR(), m = G.career;
  if(!L || L.season !== m.season || L.day !== m.day || L.phase !== m.phase) return [{ s:'이미 지난 경기라 기록에 넣지 않았습니다.', k:'c' }];
  const lines = careerGrowFromGame(L, G, false);
  leagueAdvance(L, G);
  lines.push(...careerAfterDay(L));
  saveLeague();
  return lines.map(s => ({ s, k:'i' }));
}
function myLine(G, id){
  for(const T of G.teams){
    const b = [...T.bat, ...T.gone].find(x => x.id === id); if(b) return { bat:b, st:b.st };
    const p = T.pit.find(x => x.id === id); if(p) return { pit:p, st:p.st, used:p.used };
  }
  return null;
}
function careerGrowFromGame(L, G, minor){
  const c = C(L), p = myP(L), ln = myLine(G, c.id), out = [];
  if(!ln) return out;
  const s = ln.st;
  if(ln.bat){
    if(!s.pa) return out;
    out.push(`${minor ? '퓨처스리그 ' : ''}내 기록: ${s.ab}타수 ${s.h}안타${s.hr ? ` ${s.hr}홈런` : ''}${s.rbi ? ` ${s.rbi}타점` : ''}${s.bb ? ` 볼넷 ${s.bb}` : ''}${s.sb ? ` 도루 ${s.sb}` : ''}.`);
    out.push(...grow(L, 'con', s.h * 2 + s.pa * 0.5), ...grow(L, 'pow', s.hr * 4 + (s.h - s.hr) * 0.5), ...grow(L, 'eye', s.bb * 2), ...grow(L, 'spd', s.sb * 3));
    if(!minor){
      const first = (k, txt) => { if(s[k] && !((p.cs || {})[k] || (p.ss || {})[k] || c['first_' + k])){ c['first_' + k] = 1; crLog(L, `${p.name}, 1군 첫 ${txt}!`); out.push(`1군 첫 ${txt}을 기록했습니다!`); } };
      first('h', '안타'); first('hr', '홈런'); first('rbi', '타점'); first('sb', '도루');
    }
    if(!minor && (s.hr || s.h >= 3)) out.push(...interview(L, p, s.hr ? `${s.hr}홈런` : `${s.h}안타`));
  } else {
    if(!ln.used) { out.push(minor ? '퓨처스리그 경기에 나가지 않았습니다.' : '오늘은 등판하지 않았습니다.'); return out; }
    const dec = G.decision || {};
    out.push(`${minor ? '퓨처스리그 ' : ''}내 기록: ${ipText(s.out)}, ${s.h}피안타, ${s.r}실점, 볼넷 ${s.bb}, 탈삼진 ${s.k}${dec.w === c.id ? ', 승리' : dec.l === c.id ? ', 패전' : dec.s === c.id ? ', 세이브' : ''}.`);
    out.push(...grow(L, 'stf', s.k * 1.5 + s.out * 0.3), ...grow(L, 'ctl', Math.max(0, s.out * 0.5 - s.bb * 1.5)), ...grow(L, 'sta', s.out * 0.3));
    if(!minor){
      const first = (cond, key, txt) => { if(cond && !c['first_' + key]){ c['first_' + key] = 1; crLog(L, `${p.name}, 1군 첫 ${txt}!`); out.push(`1군 첫 ${txt}을 기록했습니다!`); } };
      first(true, 'app', '등판'); first(dec.w === c.id, 'w', '승리'); first(dec.s === c.id, 'sv', '세이브'); first(s.k > 0, 'k', '탈삼진');
    }
    if(!minor && (dec.w === c.id || dec.s === c.id) && s.r === 0) out.push(...interview(L, p, dec.w === c.id ? '무실점 승리' : '세이브'));
  }
  if(minor){ const mm = c.minor; mm.g = (mm.g || 0) + 1; ['ab', 'h', 'hr', 'out', 'r'].forEach(k => { mm[k] = (mm[k] || 0) + (s[k] || 0); }); if((G.decision || {}).w === c.id) mm.w = (mm.w || 0) + 1; }
  return out;
}
// 인터뷰: 잘한 날 가끔 (인기가 오름)
function interview(L, p, what){
  if(rnd(L) > 0.4) return [];
  const c = C(L), up = 1 + Math.floor(rnd(L) * 3);
  c.fame += up;
  const q = pickOne(L, ['오늘 활약의 비결이 무엇인가요?', '팬들에게 한마디 해 주세요.', '다음 목표는 무엇인가요?']);
  return [`수훈 선수 인터뷰! 기자: "${what}, 축하합니다. ${q}" ${p.name}: "${pickOne(L, ['동료들 덕분입니다. 내일도 열심히 하겠습니다.', '응원해 주신 팬들께 감사드립니다!', '더 좋은 모습 보여 드리겠습니다.', '오늘은 공이 잘 보였습니다.'])}" 인기가 ${up} 올랐습니다.`];
}
// 날이 지날 때: 슬럼프·부상, 1군 승격
function careerAfterDay(L){
  const c = C(L), p = myP(L), out = [];
  if(c.hurt > 0){ c.hurt--; if(!c.hurt) out.push('부상에서 돌아왔습니다!'); }
  else if(rnd(L) < 0.006){ c.hurt = 3 + Math.floor(rnd(L) * 8); out.push(`아, 경기 중에 몸을 다쳤습니다. ${c.hurt}일 동안 쉬어야 합니다.`); crLog(L, `${p.name}, 부상으로 ${c.hurt}일 쉼.`); }
  else if(rnd(L) < 0.02){ p.cond = -2; out.push('요즘 슬럼프입니다. 몸이 무겁습니다. 훈련하거나 푹 쉬어 보세요.'); }
  if(c.where === 'minor' && L.phase === 'season') out.push(...promote(L));
  out.push(...leagueNews(L));
  return out;
}
// 승격: 같은 자리 1군 주전(투수는 가장 약한 선발·불펜)보다 비슷하거나 좋으면 1군으로
function promote(L){
  const c = C(L), p = c.p, T = L.teams[L.my];
  if(isPit(p)){
    const list = p.role === '선발' ? T.sp : T.rp, worst = list.slice().sort((a, b) => ratingPit(a) - ratingPit(b))[0];
    if(ratingPit(p) < ratingPit(worst) - 3) return [];
    list[list.indexOf(worst)] = p;
    if(p.role === '선발'){ const rw = T.rp.slice().sort((a, b) => ratingPit(a) - ratingPit(b))[0]; worst.role = '불펜'; T.rp[T.rp.indexOf(rw)] = worst; }
    if(worst.role === '마무리') p.role = '마무리';
  } else {
    const i = T.bat.findIndex(b => b.pos === p.pos), old = i >= 0 ? T.bat[i] : T.bat[4];
    if(ratingBat(p) < ratingBat(old) - 3) return [];
    const at = T.bat.indexOf(old);
    T.bat[at] = p;
    const bw = T.bench.slice().sort((a, b) => ratingBat(a) - ratingBat(b))[0];
    T.bench[T.bench.indexOf(bw)] = old;
  }
  c.where = 'team'; delete c.p;
  crLog(L, `${p.name}, 1군에 올라왔습니다!`);
  return ['축하합니다! 실력을 인정받아 1군에 올라갑니다. 이제 1군 경기에 나갑니다.'];
}
// 2군 날: 퓨처스리그 경기(컴퓨터가 진행, 리그 기록에는 넣지 않음) 뒤 1군 리그 하루 진행
function careerMinorDay(via){
  const L = CR(), c = C(L), p = myP(L), out = [];
  if(L.phase === 'season'){
    const opp = TEAMS.map(t => t.key).filter(k => k !== L.my)[Math.floor(rnd(L) * 9)];
    const R = gameRoster(L, L.my), O = gameRoster(L, opp);
    if(isPit(p)){ if(p.role === '선발' && rnd(L) < 0.25) R.pit = [p, ...R.pit.slice(1)]; else if(p.role !== '선발') R.pit = [R.pit[0], p, ...R.pit.slice(1)]; }
    else { const bat = R.bat.slice(), i = bat.findIndex(b => b.pos === p.pos); bat[i >= 0 ? i : 4] = p; R.bat = bat; }
    const G2 = newGame({ mode:'detail', innings:9, teams:[L.my, opp], ctrl:['cpu', 'cpu'], rosters:[R, O], seed:(rnd(L) * 4294967296) >>> 0 });
    let guard = 0;
    while(!G2.over && guard++ < 2000){ if(G2.review) resolveReview(G2, aiChallenge(G2)); else playStep(G2, aiDefChoice(G2), aiOffChoice(G2)); }
    out.push(`퓨처스리그 경기: ${teamName(L.my)} ${runsOf(G2.teams[0])} 대 ${runsOf(G2.teams[1])} ${teamName(opp)}.`, ...careerGrowFromGame(L, G2, true));
    const all = leagueAdvance(L, null);
    const mine = all.find(x => x.includes(teamName(L.my)));
    if(mine) out.push(`오늘 1군 경기: ${mine}.`);
  } else {
    out.push(...leagueAdvance(L, null).map(x => `포스트시즌: ${x}.`));
  }
  out.push(...careerAfterDay(L));
  saveLeague(); go(careerHome, via, out);
}
function careerRest(via){
  const L = CR(), out = ['몸을 추스르며 쉬었습니다.'];
  const all = leagueAdvance(L, null), mine = all.find(x => x.includes(teamName(L.my)));
  if(mine) out.push(`오늘 팀 경기: ${mine}.`);
  out.push(...careerAfterDay(L));
  saveLeague(); go(careerHome, via, out);
}
// 1군 경기를 컴퓨터가 진행하고 내 기록만 알려 줌
function careerSimDay(via){
  const L = CR(), g = myGameToday(L), c = C(L); if(!g) return;
  const G2 = newGame(leagueGameOpts(L, g.a, g.h, ['cpu', 'cpu'], 'manager'));
  let guard = 0;
  while(!G2.over && guard++ < 2000){ if(G2.review) resolveReview(G2, aiChallenge(G2)); else playStep(G2, aiDefChoice(G2), aiOffChoice(G2)); }
  flush(G2);
  const out = [`${g.label || `${L.day + 1}일째`}: ${teamName(g.a)} ${runsOf(G2.teams[0])} 대 ${runsOf(G2.teams[1])} ${teamName(g.h)}.`, ...careerGrowFromGame(L, G2, false)];
  leagueAdvance(L, G2);
  out.push(...careerAfterDay(L));
  saveLeague(); go(careerHome, via, out);
}
function careerNextSeason(via){
  const L = CR(), c = C(L);
  if(c.where === 'minor'){ const p = c.p; p.cs = sumStats(p.cs, p.ss); p.ss = {}; p.seasons = (p.seasons || 0) + 1; p.age++; p.rookie = false; develop(L, p); }
  leagueNextSeason(L);
  c.minor = {};
  const p = myP(L), out = leagueNews(L);
  out.unshift(`${L.season}시즌이 시작됩니다. ${p.name}, ${p.age}세가 되었습니다.`);
  if(p.age >= 40){ saveLeague(); careerRetire(via, '마흔 살이 되어 은퇴합니다.'); return; }
  saveLeague(); go(careerHome, via, out);
}
function careerRetire(via, why){
  const L = CR(), c = C(L), p = myP(L);
  p.cs = sumStats(p.cs, p.ss); p.ss = {}; p.seasons = (p.seasons || 0) + (L.phase === 'season' && L.day === 0 ? 0 : 1);
  const hof = hofCheck(L, p);
  const r = { name:p.name, pit:isPit(p), cs:p.cs, awards:p.awards || [] };
  c.retired = true;
  c.final = [why || `${p.name}, 은퇴를 발표했습니다.`, `${p.seasons}시즌, ${careerText(r)}.`, (p.awards || []).length ? `수상: ${p.awards.join(', ')}.` : '수상 기록은 없습니다.', hof ? '명예의 전당에 헌액되었습니다! 축하합니다!' : '명예의 전당 기준에는 조금 모자랐습니다.'];
  (L.retired ||= []).push({ id:p.id, name:p.name, team:L.my, pit:isPit(p), pos: isPit(p) ? p.role : POS[p.pos], age:p.age, seasons:p.seasons, cs:p.cs, awards:p.awards || [], hof, season:L.season });
  if(hof) (L.hof ||= []).push({ id:p.id, name:p.name, team:L.my, pit:isPit(p), cs:p.cs, awards:p.awards || [], season:L.season });
  crLog(L, `${p.name} 은퇴.${hof ? ' 명예의 전당 헌액!' : ''}`);
  saveLeague(); go(careerHome, via, c.final);
}

/* ---------- 정보 · 설정 ---------- */
function careerInfoScreen(){
  const L = CR(), p = myP(L), c = C(L);
  const say = careerStatus(L).slice(0, 2);
  const list = isPit(p) ? PIT_TRAIN : BAT_TRAIN;
  say.push('성장 점수: ' + list.map(([k, , nm]) => `${nm} ${Math.round(c.pts[k] || 0)}/10`).join(', ') + '.');
  if(isPit(p)) say.push('구종: ' + (p.pitches || []).map(x => `${PITCH[x.t].name} ${x.g}`).join(', ') + '.');
  say.push(`통산(지난 시즌까지): ${careerText({ pit:isPit(p), cs:p.cs || {} })}.`);
  if((p.awards || []).length) say.push(`수상: ${p.awards.join(', ')}.`);
  return { q:'내 선수 정보입니다.', say, back: v => go(careerHome, v), opts:[{ n:1, t:'돌아가기', act: v => go(careerHome, v) }] };
}
function careerLogScreen(){
  const L = CR(), c = C(L);
  const say = (c.ach || []).slice(-40).map(a => `${a.season}시즌 ${a.day}일째: ${a.text}`);
  return { q:'업적과 경력입니다.', say: say.length ? say : ['아직 기록이 없습니다.'], back: v => go(careerHome, v), opts:[{ n:1, t:'돌아가기', act: v => go(careerHome, v) }] };
}
function careerSet(){
  const L = CR();
  return { q:'은퇴와 설정입니다.', back: v => go(careerHome, v), opts:[
    { n:1, t:'은퇴하기', act: () => openDlg('은퇴하기', ['정말 은퇴할까요? 되돌릴 수 없습니다.'], [{ label:'은퇴하기', act: () => careerRetire('click') }, { label:'그만두기' }]) },
    { n:2, t:`내 차례 방식: ${L.mode === 'simple' ? '간단 모드 (공 하나씩)' : '정밀 모드'}`, act: () => { L.mode = L.mode === 'simple' ? 'detail' : 'simple'; L.unit = 'pitch'; saveLeague(); stay(`내 차례 방식: ${L.mode === 'simple' ? '간단 모드' : '정밀 모드'}`); } },
    { n:3, t:'백업 파일 내려받기', act: v => leagueExport(v) },
    { n:4, t:'백업 파일 불러오기', act: () => leagueImport() },
    { n:5, t:'새 선수 만들기', act: () => openDlg('새 선수 만들기', ['지금 선수 기록을 지우고 새 선수를 만들까요?'], [{ label:'새로 만들기', act: () => go(careerNameScreen, 'click') }, { label:'그만두기' }]) },
  ] };
}
