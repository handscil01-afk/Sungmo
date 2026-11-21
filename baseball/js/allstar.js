'use strict';
/* ===================== 올스타 휴식기: 올스타전 · 홈런 더비 =====================
   정규 시즌이 절반 지나면(시즌마다 한 번) 리그·선수 육성 첫 화면보다 먼저 올스타 휴식기 화면이 나옴.
   - 팬 투표: 리그 앞 다섯 팀은 드림, 뒤 다섯 팀은 나눔. 수비 위치마다 이번 시즌 성적(seasonPts)이 가장 좋은 타자 9명, 투수 5명
   - 올스타전: 두 올스타 팀이 3이닝 경기. 직접 관전하거나 결과만 봄. 기록은 정규 시즌에 넣지 않음. 가장 잘한 선수가 MVP
   - 홈런 더비: 이번 시즌 홈런이 많은 타자 4명(육성 중인 내 선수는 힘이 좋거나 인기가 많으면 초청). 아웃 5개가 될 때까지 치고,
     많이 넘긴 두 명이 결승. 내 선수(육성) 또는 우리 팀 선수(리그) 차례면 한 번씩 직접 고름(힘껏 치기 · 가볍게 치기)
   계산 함수(allstarDue·allstarRosters·derbyNew·derbySwing·allstarSim)는 Node 시험(tests/allstar.js)에서도 씀 */
const AS_OUTS = 5;
const allstarDue = L => !!L && L.phase === 'season' && L.day >= Math.floor(L.sched.length / 2) && !(L.allstar && L.allstar.season === L.season && L.allstar.closed);
const asState = L => (L.allstar && L.allstar.season === L.season) ? L.allstar : (L.allstar = { season: L.season });
const asSides = L => { const k = Object.keys(L.teams); return { dream: k.slice(0, 5), nanum: k.slice(5) }; };
// 이번 시즌 점수: 타자 안타 + 홈런×2 + 타점÷2 + 도루÷2 (+ 실력 조금) · 투수 승×3 + 세이브×2 + 홀드 + 탈삼진÷5 (+ 실력 조금)
const seasonPts = p => { const s = p.ss || {}; return p.vel ? (s.w || 0) * 3 + (s.sv || 0) * 2 + (s.hd || 0) + (s.k || 0) / 5 + (p.ctl + p.stf) / 40 : (s.h || 0) + (s.hr || 0) * 2 + (s.rbi || 0) / 2 + (s.sb || 0) / 2 + (p.con + p.pow) / 40; };
function allstarRosters(L){
  const A = asState(L); if(A.rosters) return A.rosters;
  const sides = asSides(L), out = {};
  for(const side of ['dream', 'nanum']){
    const bats = [], pits = [];
    sides[side].forEach(k => { const T = L.teams[k]; [...T.bat, ...T.bench].forEach(p => bats.push({ p, k })); [...T.sp, ...T.rp].forEach(p => pits.push({ p, k })); });
    const used = new Set(), bat = [];
    LINEUP_POS.forEach(pos => {
      const c = bats.filter(x => !used.has(x.p.id) && (x.p.pos === pos || (pos === 'DH' && !['C'].includes(x.p.pos)))).sort((a, b) => seasonPts(b.p) - seasonPts(a.p))[0]
        || bats.filter(x => !used.has(x.p.id)).sort((a, b) => seasonPts(b.p) - seasonPts(a.p))[0];
      used.add(c.p.id); bat.push({ id: c.p.id, team: c.k, pos });
    });
    const pit = pits.sort((a, b) => seasonPts(b.p) - seasonPts(a.p)).slice(0, 5).map(x => ({ id: x.p.id, team: x.k }));
    out[side] = { bat, pit };
  }
  A.rosters = out;
  return out;
}
const asPlayer = (L, e) => (findPlayer(L, e.id) || {}).p;
// 경기용 명단 (선수 사본: 정규 시즌 기록에 섞이지 않게)
function asGameRoster(L, side){
  const R = allstarRosters(L)[side], cp = p => JSON.parse(JSON.stringify(p));
  const bat = R.bat.map(e => { const p = cp(asPlayer(L, e)); p.pos = e.pos; return p; });
  const pit = R.pit.map(e => cp(asPlayer(L, e)));
  const bench = BENCH_ROLES.map(b => leaguePlayer(makeBench(L, STYLES.balance, b, 4)));
  return bestOrderKeep({ key: side, bat, bench, pit });
}
const bestOrderKeep = R => { const ord = bestOrder(R.bat.map(p => p)); return { ...R, bat: ord }; };
function allstarOpts(L, ctrl){ return { mode:'detail', unit:'pa', innings:3, teams:['nanum', 'dream'], ctrl, who:['', ''], rosters:[asGameRoster(L, 'nanum'), asGameRoster(L, 'dream')], seed:(rnd(L) * 4294967296) >>> 0 }; }
// 경기 결과와 MVP (안타·홈런·타점이 가장 많은 타자)
function allstarResult(L, G){
  const all = G.teams.flatMap((T, ti) => T.bat.map(b => ({ b, ti })));
  const sc = x => x.b.st.h * 2 + x.b.st.hr * 4 + x.b.st.rbi * 2;
  const m = all.sort((a, b) => sc(b) - sc(a))[0];
  const r = G.teams.map(runsOf), A = asState(L);
  A.game = { score: r, winner: r[0] === r[1] ? -1 : r[0] > r[1] ? 0 : 1, mvp: m.b.name, mvpLine: batterLine(m.b), mvpSide: G.teams[m.ti].short };
  const text = `${L.season}시즌 올스타전: 나눔 ${r[0]} 대 ${r[1]} 드림. MVP ${m.b.name}(${batterLine(m.b)}).`;
  L.news.push(text); (L.feats ||= []).push({ season:L.season, day:L.day + 1, text:'올스타전 ' + text.replace(/^\d+시즌 올스타전: /, '') });
  if(L.career){ const me = myP(L); if(me && m.b.id === me.id){ L.career.fame = (L.career.fame || 0) + 5; crLog(L, `${L.season}시즌 올스타전 MVP!`); (me.awards ||= []).push(`${L.season}시즌 올스타전 MVP`); } }
  return A.game;
}
function allstarSim(L){
  const G = newGame(allstarOpts(L, ['cpu', 'cpu']));
  let guard = 0;
  while(!G.over && guard++ < 3000){ if(G.pendingThrow) resolveThrow(G, null); else if(G.review) resolveReview(G, aiChallenge(G)); else playStep(G, aiDefChoice(G), aiOffChoice(G)); }
  flush(G);
  return allstarResult(L, G);
}
/* ---------- 홈런 더비 ---------- */
function derbyField(L){
  const list = [];
  for(const k in L.teams) [...L.teams[k].bat, ...L.teams[k].bench].forEach(p => list.push({ p, k }));
  list.sort((a, b) => ((b.p.ss || {}).hr || 0) - ((a.p.ss || {}).hr || 0) || b.p.pow - a.p.pow);
  let f = list.slice(0, 4);
  if(L.career && !L.career.retired){ const me = myP(L); if(me && !me.vel && !f.some(x => x.p.id === me.id) && (me.pow >= 65 || (L.career.fame || 0) >= 15)) f = [...f.slice(0, 3), { p: me, k: L.my, invited:true }]; }
  return f.map(x => ({ id: x.p.id, name: x.p.name, team: x.k, pow: x.p.pow, invited: !!x.invited }));
}
// 내가 고를 선수: 육성이면 내 선수, 리그면 우리 팀 선수
const derbyMine = (L, e) => L.career ? e.id === L.career.id : e.team === L.my;
function derbyNew(L){
  const A = asState(L);
  A.derby = { round:1, field: derbyField(L), turn:0, outs:0, score:{}, final:null, log:[], champ:null };
  return A.derby;
}
// 한 번 치기: mode 'big'(힘껏: 홈런이 잘 나오지만 넘기지 못하면 아웃) · 'easy'(가볍게: 덜 넘어가지만 못 넘겨도 절반은 파울이라 아웃이 아님)
function derbySwing(L, D, mode){
  const list = D.round === 1 ? D.field : D.final, e = list[D.turn];
  const p = clamp(0.16 + (e.pow - 50) * 0.011, 0.07, 0.62) * (mode === 'big' ? 1.25 : mode === 'easy' ? 0.85 : 1);
  const hr = rnd(L) < p;
  let say;
  if(hr){ D.score[e.id] = (D.score[e.id] || 0) + 1; const m = 108 + Math.floor(rnd(L) * 32); say = `${e.name}, 홈런! ${m}미터. ${D.score[e.id]}개째.`; }
  else if(mode === 'easy' && rnd(L) < 0.5) say = `${e.name}, 파울. 아웃은 아닙니다.`;
  else { D.outs++; say = `${e.name}, ${pickOne(L, ['담장 앞에서 잡히는 뜬공', '땅볼', '라인드라이브 안타성 타구', '높이 떴지만 짧습니다'])}. 아웃 ${D.outs}개.`; }
  D.log.push(say);
  if(D.outs >= AS_OUTS){ D.log.push(`${e.name}, 홈런 ${D.score[e.id] || 0}개로 마칩니다.`); D.turn++; D.outs = 0; derbyNext(L, D); }
  return say;
}
// 한 선수 차례를 끝까지 (컴퓨터)
function derbyAuto(L, D){ const list = D.round === 1 ? D.field : D.final, t = D.turn; let g = 0; while(D.turn === t && list === (D.round === 1 ? D.field : D.final) && !D.champ && g++ < 200) derbySwing(L, D, 'normal'); }
function derbyNext(L, D){
  if(D.round === 1 && D.turn >= D.field.length){
    const rank = D.field.slice().sort((a, b) => (D.score[b.id] || 0) - (D.score[a.id] || 0) || b.pow - a.pow);
    D.final = rank.slice(0, 2).map(e => ({ ...e })); D.round = 2; D.turn = 0; D.semi = { ...D.score }; D.score = {};
    D.log.push(`결승 진출: ${D.final.map(e => `${e.name}(${D.semi[e.id] || 0}개)`).join(', ')}.`);
  } else if(D.round === 2 && D.turn >= D.final.length){
    const [a, b] = D.final, sa = D.score[a.id] || 0, sb = D.score[b.id] || 0;
    const w = sa === sb ? (a.pow >= b.pow ? a : b) : sa > sb ? a : b;
    D.champ = w; D.round = 3;
    const text = `${L.season}시즌 홈런 더비 우승: ${w.name}(${teamInfo(w.team).short}), 결승 ${Math.max(sa, sb)}개.`;
    D.log.push(text); L.news.push(text); (L.feats ||= []).push({ season:L.season, day:L.day + 1, text:'홈런 더비 우승: ' + w.name });
    if(L.career && w.id === L.career.id){ L.career.fame = (L.career.fame || 0) + 5; L.career.money = (L.career.money || 0) + 300; crLog(L, `${L.season}시즌 홈런 더비 우승!`); const me = myP(L); if(me) (me.awards ||= []).push(`${L.season}시즌 홈런 더비 우승`); }
  }
}
// 육성: 내 선수가 올스타에 뽑혔는지
function allstarMe(L){
  if(!L.career) return null;
  const R = allstarRosters(L);
  for(const side of ['dream', 'nanum']){ if(R[side].bat.concat(R[side].pit).some(e => e.id === L.career.id)) return side; }
  return null;
}

/* ---------- 화면 (브라우저) ---------- */
const asBack = v => go(lhome(), v);
function allstarScreen(){
  const L = LG(), A = asState(L), R = allstarRosters(L), me = allstarMe(L);
  if(me && !A.picked){ A.picked = true; L.career.fame = (L.career.fame || 0) + 3; crLog(L, `${L.season}시즌 올스타에 뽑혔습니다! (${teamInfo(me).short})`); saveLeague(); }
  const top = side => R[side].bat.slice(0, 3).map(e => (asPlayer(L, e) || {}).name).join(', ');
  const D = A.derby, G0 = A.game;
  const info = [`드림 올스타: ${top('dream')} 등. 나눔 올스타: ${top('nanum')} 등.`];
  if(L.career) info.push(me ? `${myP(L).name} 선수가 ${teamInfo(me).short} 올스타로 뽑혔습니다! 인기가 올랐습니다.` : `${myP(L) ? myP(L).name : '내 선수'} 선수는 이번 올스타에 뽑히지 않았습니다.`);
  if(D && D.champ) info.push(`홈런 더비 우승: ${D.champ.name}.`);
  if(G0) info.push(`올스타전: 나눔 ${G0.score[0]} 대 ${G0.score[1]} 드림. MVP ${G0.mvp}.`);
  return { kind:'as-home', q:'올스타 휴식기입니다! 팬 투표로 뽑힌 선수들이 모였습니다. 무엇을 할까요?', note: info, back: asBack, opts:[
    { n:1, key:'derby', t: D && D.champ ? '홈런 더비 결과' : D ? '홈런 더비 이어 보기' : '홈런 더비', s: D && D.champ ? `우승 ${D.champ.name}` : `참가: ${(D ? D.field : derbyField(L)).map(e => e.name + (derbyMine(L, e) ? '(우리)' : '')).join(', ')}`, act: v => { if(!A.derby) derbyNew(L); saveLeague(); go(derbyScreen, v); } },
    { n:2, key:'watch', t:'올스타전 관전하기', hide: !!G0, s:'드림 대 나눔, 3이닝 경기를 밤 야구장에서 봅니다.', act: v => startAllstarGame(v) },
    { n:3, key:'sim', t:'올스타전 결과만 보기', hide: !!G0, act: v => { const g = allstarSim(L); saveLeague(); go(allstarScreen, v, [`올스타전 결과: 나눔 ${g.score[0]} 대 ${g.score[1]} 드림. MVP ${g.mvp}(${g.mvpLine}).`]); } },
    { n:4, key:'list', t:'올스타 명단', act: v => go(allstarListScreen, v) },
    { n:9, key:'close', t:'휴식기 끝내고 후반기 시작', act: v => { A.closed = true; L.news.push(`${L.season}시즌 후반기가 시작됩니다.`); saveLeague(); go(lhome(), v, ['올스타 휴식기가 끝나고 후반기가 시작됩니다.']); } },
  ] };
}
function allstarListScreen(){
  const L = LG(), R = allstarRosters(L);
  const tab = side => ({ title: teamInfo(side).name, cols:['', '선수', '팀', '자리', '성적'], hiTeam: L.my,
    rows: [...R[side].bat.map((e, i) => ({ e, i, pit:false })), ...R[side].pit.map((e, i) => ({ e, i, pit:true }))].map(({ e, i, pit }) => { const p = asPlayer(L, e) || {}, s = p.ss || {};
      return { team: e.team, cells:[pit ? '투' : i + 1, p.name, teamName(e.team), pit ? (p.role || '투수') : POS[e.pos], pit ? `${s.w || 0}승 ${s.k || 0}K` : `${avgText(avgOf(s))} ${s.hr || 0}홈런`] }; }) });
  const say = ['dream', 'nanum'].flatMap(side => [`${teamInfo(side).name}.`, ...R[side].bat.map((e, i) => `${i + 1}번 ${POS[e.pos]} ${(asPlayer(L, e) || {}).name}(${teamName(e.team)})`), `투수: ${R[side].pit.map(e => `${(asPlayer(L, e) || {}).name}(${teamName(e.team)})`).join(', ')}.`]);
  return { q:'올스타 명단입니다.', say, table:[tab('dream'), tab('nanum')], back: v => go(allstarScreen, v), opts:[{ n:1, t:'돌아가기', act: v => go(allstarScreen, v) }] };
}
function derbyScreen(){
  const L = LG(), A = asState(L), D = A.derby || derbyNew(L);
  const say = D.log.slice(-3);
  if(D.champ) return { kind:'as-derby', D, q:`홈런 더비가 끝났습니다. 우승은 ${D.champ.name}입니다!`, say: D.log.slice(-4), back: v => go(allstarScreen, v), opts:[{ n:1, t:'올스타 휴식기로 돌아가기', act: v => go(allstarScreen, v) }] };
  const list = D.round === 1 ? D.field : D.final, e = list[D.turn], mine = derbyMine(L, e);
  const step = fn => v => { fn(); saveLeague(); go(derbyScreen, v); };
  const head = `${D.round === 1 ? '예선' : '결승'}, ${e.name}(${teamInfo(e.team).short}) 차례. 홈런 ${D.score[e.id] || 0}개, 아웃 ${D.outs}/${AS_OUTS}.`;
  return { kind:'as-derby', D, mine, q: mine ? `${head} 어떻게 칠까요?` : `${head} 계속 볼까요?`, say, back: v => go(allstarScreen, v), opts: mine ? [
    { n:1, key:'big', t:'힘껏 치기', s:'홈런이 잘 나오지만, 못 넘기면 아웃입니다.', act: step(() => derbySwing(L, D, 'big')) },
    { n:2, key:'easy', t:'가볍게 치기', s:'덜 넘어가지만, 못 넘겨도 절반은 파울이라 아웃이 아닙니다.', act: step(() => derbySwing(L, D, 'easy')) },
    { n:3, key:'auto', t:'이번 차례 맡기기', act: step(() => derbyAuto(L, D)) },
  ] : [
    { n:1, key:'next', t:`${e.name} 차례 보기`, act: step(() => derbyAuto(L, D)) },
    { n:2, key:'all', t:'끝까지 빨리 보기', s:'우리 선수 차례가 오면 멈춥니다.', act: step(() => { let g = 0; while(!D.champ && g++ < 20){ const l = D.round === 1 ? D.field : D.final; if(derbyMine(L, l[D.turn])) break; derbyAuto(L, D); } }) },
  ] };
}
function startAllstarGame(via){
  const L = LG(), src = LSRC;
  startGame(allstarOpts(L, ['cpu', 'cpu']), via);
  G.allstar = { src }; G.night = true; saveGame();
}
// 올스타전이 끝나면 (game.js gameNext에서 부름)
function allstarAfterGame(G){
  LSRC = G.allstar.src || 'league';
  const L = LG(); if(!L) return [];
  const g = allstarResult(L, G); saveLeague();
  return [{ s:`올스타전 MVP는 ${g.mvpSide}의 ${g.mvp}(${g.mvpLine})입니다!`, k:'i' }];
}
