'use strict';
/* ===================== 경기 화면 =====================
   한 공(간단 모드는 한 타석)마다 수비와 공격이 각자 몰래 고르고, 둘 다 고르면 계산함.
   - 혼자 하기: 사람이 고르면 컴퓨터가 그 자리에서 고르고 바로 결과
   - 둘이 하기(한 기기): 수비가 먼저 고르고 "기기 넘기기" 화면 뒤에 공격이 고름
   - 관전·맡기기: 컴퓨터가 양쪽을 고름
   - 온라인 대전: 각 기기는 자기 팀만 고름. 방장 기기가 계산하고 상태를 보냄 (js/online.js) */
let G = null;
const GS = { pend:{ def:null, off:null }, sel:null, auto:null, holder:-1, guess:null, guessPA:-1, play:0, opts:null };

const isHuman = ti => G.ctrl[ti] === 'human';
// local: 이 기기에서 고르는 팀 (온라인에서는 내 팀만)
const local = ti => !NET.on || ti === NET.side;
const twoP = () => isHuman(0) && isHuman(1) && !NET.on;
// 선수 육성: 내 선수(G.focus)가 타석에 있거나 마운드에 있을 때만 직접 고름
const focusTurn = ti => !!G.focus && (batIdx(G) === ti ? curBatter(G).id === G.focus : curPitcher(G).id === G.focus);
const needs = ti => (isHuman(ti) || focusTurn(ti)) && local(ti) && !(GS.auto && GS.auto.side === ti);
// 상대 기기에서 선택이 와야 하는 팀
const remote = ti => NET.on && !local(ti);
// 능력치를 숫자로 보여 줄 팀 (내 팀, 관전이면 모두)
const ownTeam = ti => NET.on ? ti === NET.side : G.focusTeam != null ? ti === G.focusTeam : (isHuman(ti) || G.ctrl.every(c => c === 'cpu'));
const whoLabel = ti => twoP() ? `${G.who[ti] || G.teams[ti].short}, ` : '';
// 사람이 응원하는 팀 (혼자 하기) · 둘 다 사람이면 지금 공격 팀
const myTeam = () => isHuman(0) && !isHuman(1) ? 0 : isHuman(1) && !isHuman(0) ? 1 : -1;

function saveGame(){ if(G && !NET.on) ls.set('bb_game', { G, opts: GS.opts, holder: GS.holder }); }
function loadSaved(){ const s = ls.get('bb_game', null); return s && s.G && !s.G.over && s.G.v === 1 ? s : null; }

function startGame(opts, via){
  G = newGame(opts);
  GS.opts = opts; GS.pend = { def:null, off:null }; GS.auto = null; GS.holder = -1; GS.sel = null;
  UI.logG = null;
  const r = flush(G);
  gameNext(via, r);
}
function resumeGame(via){
  const s = loadSaved(); if(!s) return;
  G = s.G; G.out = []; G.fx = [];
  GS.opts = s.opts; GS.pend = { def:null, off:null }; GS.auto = null; GS.holder = -1; GS.sel = null;
  UI.logG = null;
  gameNext(via, { lines:[{ s:'저장한 경기를 이어 합니다. ' + situation(G), k:'i' }], fx:[] });
}

/* ---------- 상황판 (눈으로 보는 그림; 화면 낭독기는 #sit 글을 읽음) ---------- */
function boardHTML(){
  const [A, H] = G.teams, P = curPitcher(G), B = curBatter(G), T = batTeam(G);
  const dots = (n, max, cls) => Array.from({ length:max }, (_, i) => `<i class="${i < n ? 'on ' + cls : ''}"></i>`).join('');
  const base = i => G.bases[i] != null ? 'on' : '';
  let zone = '';
  if(detailed(G)){
    const L = G.lastLoc, dot = L && G.pitchNo ? `<circle cx="${50 + clamp(L.x, -1.9, 1.9) * 25}" cy="${50 - clamp(L.y, -1.9, 1.9) * 25}" r="6" class="ball"/>` : '';
    zone = `<svg class="zone" viewBox="0 0 100 100"><rect x="25" y="25" width="50" height="50" class="zr"/>
      <path d="M41.7 25V75M58.3 25V75M25 41.7H75M25 58.3H75" class="zl"/>${dot}</svg>`;
  }
  return `<div class="board" aria-hidden="true">
    <div class="score"><span class="tm" style="--c:${A.color}">${esc(A.short)}</span><b>${runsOf(A)}</b>
      <span class="inn">${G.over ? '경기 끝' : `${G.inning}회${G.top ? '초' : '말'}`}</span><b>${runsOf(H)}</b><span class="tm" style="--c:${H.color}">${esc(H.short)}</span></div>
    <div class="field">
      <svg class="dia" viewBox="0 0 100 100"><path d="M50 88 L88 50 L50 12 L12 50 Z" class="ln"/>
        <rect x="80" y="42" width="16" height="16" transform="rotate(45 88 50)" class="b ${base(0)}"/>
        <rect x="42" y="4" width="16" height="16" transform="rotate(45 50 12)" class="b ${base(1)}"/>
        <rect x="4" y="42" width="16" height="16" transform="rotate(45 12 50)" class="b ${base(2)}"/>
        <path d="M44 84 h12 v6 l-6 6 l-6 -6z" class="hp"/></svg>
      <div class="cnt"><div><span>B</span>${dots(G.balls, 3, 'g')}</div><div><span>S</span>${dots(G.strikes, 2, 'y')}</div><div><span>O</span>${dots(G.outs, 2, 'r')}</div></div>
      ${zone}
    </div>
    ${G.over ? '' : `<div class="who"><span>타자 ${esc(B.name)} <small>${T.bi + 1}번${detailed(G) ? ' · ' + (B.hand === 'L' ? '좌' : '우') : ''}</small></span><span>투수 ${esc(P.name)} <small>${P.n}구</small></span></div>`}
  </div><p id="sit" class="sr-only">${esc(situation(G))}</p>`;
}
function gameStatus(){
  if(G.over) return [situation(G)];
  const T = batTeam(G), P = curPitcher(G), B = curBatter(G), b = G.bases;
  const runners = [0, 1, 2].filter(k => b[k] != null).map(k => `${k + 1}루 ${T.bat[b[k]].name}`);
  const out = [
    `${halfName(G)}, ${T.short} 공격. 점수 ${scoreText(G)}.`,
    `${G.outs}아웃, 볼카운트 ${countText(G)}.`,
    runners.length ? `주자: ${runners.join(', ')}.` : '주자 없음.',
    `타자: ${T.bi + 1}번 ${B.name}, 오늘 ${batterLine(B)}. 투수: ${P.name}${detailed(G) ? `, 투구 수 ${P.n}개` : ''}.`,
  ];
  if(G.mode === 'manager' || detailed(G)) out.push(`비디오 판독 남은 기회: ${G.teams[0].short} ${reviewLeft(G, 0)}번, ${G.teams[1].short} ${reviewLeft(G, 1)}번.`);
  if(detailed(G)){
    const F = fieldTeam(G);
    out.push(`수비 위치: 내야 ${ALIGN_IN[F.align.inf]}, 외야 ${ALIGN_OUT[F.align.of]}. 날씨: ${windText(G)}.`);
  }
  out.push(`지금 질문: ${UI.S.q}`);
  return out;
}
function whoInfo(){
  const bi = batIdx(G), fi = 1 - bi, own = ownTeam;
  if(G.mode === 'simple') return [`타자 ${batTeam(G).bi + 1}번 ${curBatter(G).name}, 오늘 ${batterLine(curBatter(G))}.`, `투수 ${curPitcher(G).name}.`];
  return ['타자: ' + batterInfo(G, G.teams[bi], G.teams[bi].bi, own(bi)), '투수: ' + pitcherInfo(G, G.teams[fi], G.teams[fi].pi, own(fi))];
}
function recentLines(n){ return G.log.filter(l => l.k !== 'd' || SET.dice).slice(-n).map(l => l.s); }

/* ---------- 진행 ---------- */
// 결과(res)를 보여 주고, 다음에 누가 무엇을 골라야 하는지 정함
function gameNext(via, res){
  // 감독 모드: 묻지 않는 타석은 바로 진행하고 결과를 모음 (온라인 손님은 방장이 계산)
  if(G.mode === 'manager' && !(NET.on && NET.role === 'guest')) res = mgrAuto(res);
  if(res){ playFx(res.fx); }
  const lines = visible(res ? res.lines : []);
  if(NET.on){ netNext(via, res, lines); return; }
  saveGame();
  if(G.over){
    // 리그 경기: 결과를 리그에 넣고 그날의 다른 경기도 진행
    if(G.league && !G.league.done){ G.league.done = true; lines.push(...visible(leagueAfterMine(G))); }
    if(G.career && !G.career.done){ G.career.done = true; lines.push(...visible(careerAfterGame(G))); }
    ls.del('bb_game'); go(endScreen, via, lines); return;
  }
  if(G.pre){ const ti = [0, 1].find(t => !G.pre.ready[t] && needs(t)); go(() => pregameScreen(ti), via, lines); return; }
  // 비디오 판독: 원심에 손해를 본 팀이 사람이면 묻고, 컴퓨터(또는 맡긴 쪽·기회 없음)면 바로 정함
  if(G.review){
    const side = G.review.side;
    if(!needs(side) || reviewLeft(G, side) <= 0){
      const r = resolveReview(G, needs(side) ? false : aiChallenge(G));
      gameNext(via, { lines:[...(res ? res.lines : []), ...r.lines], fx: r.fx }); return;
    }
    if(twoP() && GS.holder !== side){ go(() => handoffScreen(side), via, lines); return; }
    GS.holder = side; go(reviewScreen, via, lines); return;
  }
  if(GS.auto && autoDone()) GS.auto = null;
  const off = batIdx(G), def = 1 - off;
  if(GS.auto && !needs(off) && !needs(def)){ // 혼자 하기에서 맡겨 둔 동안은 바로 끝까지 진행
    const more = runSteps(() => autoDone());
    GS.auto = null;
    const keep = more.lines.filter(l => GS.autoScope === 'pa' ? l.k !== 'd' || SET.dice : 'ric'.includes(l.k));
    gameNext(via, { lines: [...(res ? res.lines : []), ...keep], fx: more.fx });
    return;
  }
  // 선수 육성: 내 선수 차례가 올 때까지 빠르게 진행하고, 점수가 난 장면과 이닝 소식만 읽어 줌
  if(G.focus && !needs(off) && !needs(def)){
    const more = runSteps(() => needs(batIdx(G)) || needs(1 - batIdx(G)));
    const me = (() => { const f = myLine(G, G.focus); return f ? (f.bat || f.pit).name : ''; })();
    const lastN = more.lines.map(l => l.k).lastIndexOf('n');
    const keep = more.lines.filter((l, i) => l.k === 'i' || (l.k === 'r' && /홈인|대기록/.test(l.s)) || (l.k === 'c' && me && l.s.includes(me)) || (i === lastN && !G.over));
    gameNext(via, { lines:[...(res ? res.lines : []), ...keep], fx: more.fx.slice(-2) }); return;
  }
  if(!needs(off) && !needs(def)){ go(watchScreen, via, lines); return; }
  const turn = (needs(def) && !GS.pend.def) ? def : off;
  if(twoP() && GS.holder !== turn){ go(() => handoffScreen(turn), via, lines); return; }
  GS.holder = turn;
  go(turn === def ? defMain : offMain, via, lines);
}
function autoDone(){
  const a = GS.auto; if(!a) return true;
  if(G.over) return true;
  if(a.scope === 'pitch') return G.seq > a.seq && (G.pitchNo !== a.pitchNo || G.pa !== a.pa);
  if(a.scope === 'pa') return G.pa !== a.pa;
  if(a.scope === 'half') return G.half !== a.half;
  return false;
}
function stepAI(){
  const pb = aiPickoff(G);
  if(pb >= 0){ doPickoff(G, pb); if(!G.review && G.outs >= 3) endPA(G, true); return flush(G); }
  return playStep(G, aiDefChoice(G), aiOffChoice(G));
}
function runSteps(stop){
  const acc = { lines:[], fx:[] }; let guard = 0;
  while(!G.over && !stop() && guard++ < 4000){ const r = G.review ? resolveReview(G, aiChallenge(G)) : stepAI(); acc.lines.push(...r.lines); acc.fx.push(...r.fx); }
  return acc;
}
// side: 'def' | 'off'
function submit(side, choice, via){
  GS.sel = null;
  // 온라인 손님: 방장에게 보내고 결과를 기다림
  if(NET.on && NET.role === 'guest'){ NET.sent = true; netSendAct({ k:'choice', role:side, c:choice }); gameNext(via, null); return; }
  GS.pend[side] = choice;
  if(!tryResolve(via)) gameNext(via, null);
}
// 양쪽 선택이 모두 있으면 계산함 (컴퓨터·맡긴 쪽은 그 자리에서 고름)
function tryResolve(via){
  const off = batIdx(G), def = 1 - off;
  if(!GS.pend.def && (needs(def) || remote(def))) return false;
  if(!GS.pend.off && (needs(off) || remote(off))) return false;
  // 컴퓨터가 수비하면 공을 던지기 전에 가끔 견제 (견제로 이닝이 끝나면 고른 것은 쓰지 않음)
  let pre = null;
  if(!needs(def) && !remote(def)){
    const pb = aiPickoff(G);
    if(pb >= 0){
      const pa = G.pa, half = G.half;
      doPickoff(G, pb); if(!G.review && G.outs >= 3) endPA(G, true);
      if(G.review || G.pa !== pa || G.half !== half || G.over){ GS.pend = { def:null, off:null }; gameNext(via, flush(G)); return true; }
      pre = flush(G);
    }
  }
  const D = GS.pend.def || aiDefChoice(G);
  const O = GS.pend.off || aiOffChoice(G);
  GS.pend = { def:null, off:null };
  const res = playStep(G, D, O);
  if(pre){ res.lines = [...pre.lines, ...res.lines]; res.fx = [...pre.fx, ...res.fx]; }
  gameNext(via, res);
  return true;
}
// 맡기기: 이번 공 · 이번 타석 · 이번 이닝
function delegate(scope, via){
  const ti = NET.on ? NET.side : GS.holder >= 0 ? GS.holder : myTeam();
  if(!NET.on) GS.pend = { def:null, off:null };
  GS.auto = { side: ti, scope, seq: G.seq, pitchNo: G.pitchNo, pa: G.pa, half: G.half };
  GS.autoScope = scope;
  if(NET.on){ gameNext(via, { lines:[{ s: scope === 'pa' ? '이번 타석을 맡깁니다.' : '이번 이닝을 맡깁니다.', k:'c' }], fx:[] }); return; }
  if(twoP()){
    // 둘이 하기: 맡긴 쪽만 컴퓨터가 고르고, 상대는 계속 직접 고름
    const off = batIdx(G), def = 1 - off;
    if(ti === def) submit('def', aiDefChoice(G), via);
    else submit('off', aiOffChoice(G), via);
    return;
  }
  gameNext(via, { lines:[{ s: scope === 'pa' ? '이번 타석을 맡깁니다.' : scope === 'half' ? '이번 이닝을 맡깁니다.' : '이번 공을 맡깁니다.', k:'c' }], fx:[] });
}

/* ---------- 비디오 판독 ---------- */
function reviewWord(p){ return p >= 0.45 ? '뒤집힐 가능성이 꽤 있어 보입니다' : p >= 0.35 ? '반반 정도로 보입니다' : '뒤집기는 어려워 보입니다'; }
function reviewScreen(){
  const R = G.review, left = reviewLeft(G, R.side);
  const odds = SET.revOdds === 'word' ? reviewWord(R.p) : `뒤집힐 확률 약 ${Math.round(R.p * 100)}퍼센트`;
  return { board:true, q:`비디오 판독을 신청할까요? 남은 기회 ${left}번. 코치 판단: ${odds}.`, opts:[
    { n:1, t:'판독 신청', s:'판정이 뒤집히면 기회는 그대로이고, 원심이 유지되면 기회가 1번 줄어듭니다.', act: v => doReview(true, v) },
    { n:2, t:'신청하지 않기', s:'원심대로 진행합니다.', act: v => doReview(false, v) },
    { n:3, t:`확률을 ${SET.revOdds === 'word' ? '숫자로' : '말로'} 듣기`, act: () => { SET.revOdds = SET.revOdds === 'word' ? 'num' : 'word'; saveSet(); stay(`코치 판단: ${SET.revOdds === 'word' ? reviewWord(R.p) : `뒤집힐 확률 약 ${Math.round(R.p * 100)}퍼센트`}.`); } },
  ] };
}
function doReview(yes, v){
  if(NET.on && NET.role === 'guest'){ NET.sent = true; netSendAct({ k:'review', yes }); go(waitScreen, v, [yes ? '판독을 신청했습니다.' : '판독을 신청하지 않습니다.']); return; }
  const r = resolveReview(G, yes); saveGame(); gameNext(v, r);
}

/* ---------- 둘이 하기: 기기 넘기기 ---------- */
function handoffScreen(ti){
  const def = 1 - batIdx(G), role = ti === def ? '수비' : '공격';
  return { board:true, q:`${G.who[ti] || G.teams[ti].short}(${G.teams[ti].short}, ${role}) 차례입니다. 기기를 넘겨받았으면 1번을 누르세요.`,
    note: role === '수비' ? ['상대가 고른 것은 보이지 않습니다. 이어폰을 쓰면 고르는 소리를 상대가 듣지 못합니다.'] : ['수비 쪽은 이미 공을 골랐습니다. 무엇을 골랐는지는 결과에서 알 수 있습니다.'],
    opts:[{ n:1, t:'준비됐어요', act: v => { GS.holder = ti; gameNext(v, null); } }, { n:9, t:'더 보기', act: v => go(moreScreen, v) }] };
}

/* ---------- 수비 (정밀 모드) ---------- */
function defMain(){
  if(G.mode === 'simple') return simpleDef();
  if(G.mode === 'manager') return mgrDef();
  const ti = 1 - batIdx(G), T = G.teams[ti], P = curPitcher(G), B = curBatter(G);
  const last = T.lastSel && T.lastSel.k === 'pitch' && P.pitches.some(x => x.t === T.lastSel.t) ? T.lastSel : null;
  const opts = P.pitches.map((x, i) => ({ n: i + 1, t: PITCH[x.t].name, s: `${gradeWord(x.g)} · 보통 세기로 약 ${expVel(P, x.t, 2)}킬로`, act: v => { GS.sel = { k:'pitch', t:x.t }; go(locScreen, v); } }));
  opts.push({ n:5, t:'지난 공 그대로', s: last ? selText(last) : '아직 던진 공이 없습니다.', hide: !last, act: v => submit('def', { ...last }, v) });
  opts.push({ n:6, t:'포수 사인대로 던지기', s:'이번 공은 컴퓨터 포수가 골라 줍니다.', act: v => submit('def', aiPitch(G), v) });
  opts.push({ n:7, t:'수비 위치 바꾸기', s:`지금 내야 ${ALIGN_IN[T.align.inf]}, 외야 ${ALIGN_OUT[T.align.of]}`, act: v => go(alignScreen, v) });
  opts.push({ n:8, t: G.bases.some(x => x != null) ? '작전: 견제 · 고의 볼넷 · 투수 교체' : '작전: 고의 볼넷 · 투수 교체', s:`투수 ${P.name} 투구 수 ${P.n}개, 체력 ${Math.round(clamp(1 - P.load / P.sta, 0, 1) * 100)}퍼센트`, act: v => go(tacticScreen, v) });
  opts.push({ n:9, t:'더 보기', s:'점수판, 선수 정보, 맡기기, 설정', act: v => go(moreScreen, v) });
  return { board:true, q:`${whoLabel(ti)}수비. 타자 ${B.name}, 제${G.pitchNo + 1}구 ${countText(G)}. 어떤 공을 던질까요?`, opts };
}
// 코스 번호: 전화기식(1 2 3이 위) · 컴퓨터 숫자판식(7 8 9가 위)
const zoneNum = (r, c) => SET.pad === 'pc' ? (2 - r) * 3 + c + 1 : r * 3 + c + 1;
function locScreen(){
  const opts = [];
  for(let r = 0; r < 3; r++) for(let c = 0; c < 3; c++)
    opts.push({ n: zoneNum(r, c), t: ZONE_NAME[r][c], cls:'z', act: v => {
      GS.sel = { ...GS.sel, r, c };
      if(r === 1 && c === 1){ GS.sel.e = 'in'; go(powScreen, v); } else go(edgeScreen, v);
    } });
  return { board:true, sub:true, grid:true, q:`${PITCH[GS.sel.t].name}, 어디로 던질까요? 몸쪽은 타자 쪽입니다.`, opts, back: v => go(defMain, v) };
}
function edgeScreen(){
  const s = GS.sel, name = ZONE_NAME[s.r][s.c];
  const opts = ['in', 'edge', 'out'].map((e, i) => ({ n: i + 1, t: EDGE[e].name, s: EDGE[e].sub, act: v => { GS.sel = { ...GS.sel, e }; go(powScreen, v); } }));
  return { board:true, sub:true, q:`${PITCH[s.t].name}, ${name}. 얼마나 붙일까요?`, opts, back: v => go(locScreen, v) };
}
function powScreen(){
  const s = GS.sel, P = curPitcher(G);
  const sub = { 1:'구위가 좋아지지만 제구가 흔들리고 힘이 빨리 빠집니다.', 2:'평소대로 던집니다.', 3:'제구가 좋아지지만 공이 가벼워집니다.' };
  const opts = [1, 2, 3].map(w => ({ n:w, t:`${POWER[w].name}, 약 ${expVel(P, s.t, w)}킬로`, s: sub[w], act: v => submit('def', { ...GS.sel, w }, v) }));
  return { board:true, sub:true, q:`${PITCH[s.t].name}, ${ZONE_NAME[s.r][s.c]}${s.r === 1 && s.c === 1 ? '' : ', ' + EDGE[s.e].name}. 얼마나 세게 던질까요?`, opts,
    back: v => go(s.r === 1 && s.c === 1 ? locScreen : edgeScreen, v) };
}
function alignScreen(){
  const ti = 1 - batIdx(G), T = G.teams[ti], a = T.align;
  const set = (inf, of, v) => {
    if(NET.on && NET.role === 'guest'){ netSendAct({ k:'align', inf, of }); T.align = { inf, of }; rerender(); speak(`수비 위치: 내야 ${ALIGN_IN[inf]}, 외야 ${ALIGN_OUT[of]}.`); return; }
    const r = setAlign(G, ti, inf, of); saveGame(); if(NET.on) netPushState(r); rerender(); speak(r.lines.map(l => l.s).join(' '));
  };
  const mark = on => on ? ' (지금)' : '';
  return { board:true, sub:true, q:`수비 위치를 고르세요. 지금 내야 ${ALIGN_IN[a.inf]}, 외야 ${ALIGN_OUT[a.of]}.`, back: v => go(defMain, v), opts:[
    { n:1, t:'내야 전진 수비' + mark(a.inf === 0), s:'3루 주자의 득점을 막습니다. 대신 땅볼이 빠져나가기 쉽습니다.', act: v => set(0, a.of, v) },
    { n:2, t:'내야 보통 수비' + mark(a.inf === 1), act: v => set(1, a.of, v) },
    { n:3, t:'내야 후진 수비' + mark(a.inf === 2), s:'강한 땅볼과 병살에 강합니다. 느린 땅볼은 내야 안타가 되기 쉽습니다.', act: v => set(2, a.of, v) },
    { n:4, t:'외야 전진 수비' + mark(a.of === 0), s:'앞에 떨어지는 안타를 막습니다. 큰 타구는 머리 위로 넘어갑니다.', act: v => set(a.inf, 0, v) },
    { n:5, t:'외야 보통 수비' + mark(a.of === 1), act: v => set(a.inf, 1, v) },
    { n:6, t:'외야 후진 수비' + mark(a.of === 2), s:'장타를 막습니다. 짧은 안타는 늘어납니다.', act: v => set(a.inf, 2, v) },
    { n:9, t:'다 됐어요, 공 고르러 가기', act: v => go(defMain, v) },
  ] };
}
function tacticScreen(){
  const ti = 1 - batIdx(G), P = curPitcher(G);
  const bench = benchPitchers(G, ti);
  return { board:true, sub:true, q:'작전을 고르세요.', back: v => go(defMain, v), opts:[
    { n:1, t:'고의 볼넷', s:'이번 타자를 그냥 1루로 내보냅니다.', act: v => submit('def', G.mode === 'detail' ? { k:'ibb' } : 'ibb', v) },
    { n:2, t:'투수 교체', s: bench.length ? `불펜에 ${bench.length}명이 남았습니다.` : '바꿀 투수가 없습니다.', hide: G.mode !== 'detail', act: v => bench.length ? go(bullpenScreen, v) : speak('바꿀 투수가 없습니다.') },
    { n:3, t:'지금 투수 상태 듣기', hide: G.mode !== 'detail', act: v => note([pitcherInfo(G, G.teams[ti], G.teams[ti].pi, true)], v) },
    pickOpt(4),
  ] };
}
/* ---------- 견제 · 도루할 주자 고르기 ---------- */
// 견제 선택지: 주자가 한 명이면 바로, 여러 명이면 누구를 견제할지 고름. 공 하나를 쓰지 않음
function pickOpt(n){
  const on = [0, 1, 2].filter(k => G.bases[k] != null), T = batTeam(G);
  return { n, t:'견제', hide: !on.length, s: on.length === 1 ? `${on[0] + 1}루 주자 ${T.bat[G.bases[on[0]]].name}에게 견제구를 던집니다. 공 하나를 쓰지 않습니다.` : `주자 ${on.length}명 가운데 누구를 견제할지 고릅니다.`,
    act: v => on.length === 1 ? doPick(on[0], v) : go(pickScreen, v) };
}
function pickScreen(){
  const T = batTeam(G), on = [0, 1, 2].filter(k => G.bases[k] != null);
  return { board:true, sub:true, q:'누구를 견제할까요?', back: v => go(defMain, v),
    opts: on.map(k => { const R = T.bat[G.bases[k]]; return { n: k + 1, t:`${k + 1}루 주자 ${R.name}`, s: detailed(G) ? `스피드 ${ownTeam(batIdx(G)) ? R.spd : gradeWord(R.spd)}. 견제를 받은 주자는 리드가 작아져 도루하기 어려워집니다.` : '견제를 받은 주자는 도루하기 어려워집니다.', act: v => doPick(k, v) }; }) };
}
function doPick(base, v){
  if(NET.on && NET.role === 'guest'){ netSendAct({ k:'pick', base }); go(defMain, v, ['견제를 요청했습니다.']); return; }
  const r = pickoff(G, base); saveGame();
  gameNext(v, r);
}
// 도루: 갈 수 있는 주자가 여럿이면(더블 스틸·홈스틸 포함) 고름. go(fn)으로 고른 값을 넘김
function stealOpt(n, sub, fn){
  const c = stealCands(G);
  return { n, t:'도루', hide: !c.length, s: c.length === 1 ? `${stealLabel(G, c[0])}. ${sub}` : `주자 가운데 누구를 뛰게 할지 고릅니다. ${sub}`,
    act: v => c.length === 1 ? fn(c[0], v) : go(() => stealScreen(fn), v) };
}
function stealScreen(fn){
  return { board:true, sub:true, q:'누구를 뛰게 할까요?', back: v => gameNext(v, null),
    opts: stealCands(G).map((f, i) => ({ n: i + 1, t: stealLabel(G, f), act: v => fn(f, v) })) };
}
function bullpenScreen(){
  const ti = 1 - batIdx(G), T = G.teams[ti];
  const opts = benchPitchers(G, ti).slice(0, 8).map((x, i) => ({ n: i + 1, t: x.p.name, s: pitcherInfo(G, T, x.i, true), act: v => {
    if(NET.on && NET.role === 'guest'){ netSendAct({ k:'pitcher', idx:x.i }); go(defMain, v, [`투수를 ${josa(x.p.name, '으로', '로')} 바꿉니다.`]); return; }
    const r = changePitcher(G, ti, x.i); saveGame(); if(NET.on) netPushState(r); go(defMain, v, visible(r.lines)); } }));
  return { board:true, sub:true, q:'누구로 바꿀까요?', opts, back: v => go(G.mode === 'manager' ? defMain : tacticScreen, v) };
}

/* ---------- 공격 (정밀 모드) ---------- */
const GUESS = { fast:'직구 계열 노리기', break:'변화구 노리기' };
function offMain(){
  if(G.mode === 'simple') return simpleOff();
  if(G.mode === 'manager') return mgrOff();
  const ti = batIdx(G), T = G.teams[ti], B = curBatter(G), bs = G.bases;
  if(GS.guessPA !== G.pa){ GS.guess = null; GS.guessPA = G.pa; }
  const g = GS.guess;
  const runner = bs[1] != null && bs[2] == null ? T.bat[bs[1]] : bs[0] != null && bs[1] == null ? T.bat[bs[0]] : null;
  const runners = bs.some(x => x != null);
  const bat = k => v => submit('off', { k, g }, v);
  return { board:true, q:`${whoLabel(ti)}공격. 타자 ${B.name}, 제${G.pitchNo + 1}구 ${countText(G)}. 어떻게 할까요?`, opts:[
    { n:1, t:'치기', s:'스트라이크면 치고, 볼은 골라냅니다.', act: bat('swing') },
    { n:2, t:'강하게 치기', s:'장타를 노립니다. 헛스윙이 늘고 볼에 잘 속습니다.', act: bat('power') },
    { n:3, t:'맞히기', s:'짧게 맞힙니다. 공을 더 잘 보지만 타구 힘은 약합니다.', act: bat('contact') },
    { n:4, t:'지켜보기', s:'이번 공은 치지 않습니다.', act: bat('take') },
    { n:5, t: runners ? '번트' : '기습 번트', s: runners ? '타자는 아웃되더라도 주자를 한 베이스 보냅니다.' : '발로 1루를 노립니다.', act: bat('bunt') },
    stealOpt(6, '타자는 이번 공을 지켜봅니다.', (from, v) => submit('off', { k:'steal', g, from }, v)),
    { n:7, t:`노림수: ${g ? GUESS[g] : '없음'}`, s:'맞으면 잘 맞고, 틀리면 맞히기 어렵습니다. 이번 타석 동안 유지됩니다.', act: v => go(guessScreen, v) },
    { n:8, t:'코치에게 맡기기', s:'이번 공은 컴퓨터가 골라 줍니다.', act: v => submit('off', aiBat(G), v) },
    { n:9, t:'더 보기', s:'점수판, 선수 정보, 맡기기, 설정', act: v => go(moreScreen, v) },
  ] };
}
function guessScreen(){
  const set = (g, v) => { GS.guess = g; GS.guessPA = G.pa; go(offMain, v, [{ s:`노림수: ${g ? GUESS[g] : '없음'}.`, k:'c' }]); };
  return { board:true, sub:true, q:'무엇을 노릴까요?', back: v => go(offMain, v), opts:[
    { n:1, t:GUESS.fast, s:'직구·투심·커터', act: v => set('fast', v) },
    { n:2, t:GUESS.break, s:'슬라이더·커브·체인지업·포크', act: v => set('break', v) },
    { n:3, t:'노림수 없음', act: v => set(null, v) },
  ] };
}

/* ---------- 간단 모드 ---------- */
const pct = (rows, ks) => rows.filter(r => ks.includes(r.k)).reduce((a, r) => a + r.to - r.from + 1, 0);
const simpleOdds = (D, O) => { const t = simpleTable(D, O); return `안타 이상 ${pct(t, ['S1', 'S2', 'S3', 'HR'])}%, 홈런 ${pct(t, ['HR'])}%, 삼진 ${pct(t, ['K'])}%`; };
// '공 하나씩'일 때 선택지 설명: 공이 존에 들어갈 확률, 휘둘렀을 때 헛스윙·파울·인플레이 확률
const spZone = D => `스트라이크 존에 들어갈 확률 ${SP_ZONE[D]}%`;
const spSwing = O => { const a = SP_SWING.in[O]; return `존에 들어온 공을 치면 헛스윙 ${a[0]}%, 파울 ${a[1]}%, 인플레이 ${100 - a[0] - a[1]}%`; };
function simpleDef(){
  const ti = 1 - batIdx(G), B = curBatter(G);
  if(G.unit === 'pitch') return { board:true, q:`${whoLabel(ti)}수비. 타자 ${batTeam(G).bi + 1}번 ${B.name}, 제${G.pitchNo + 1}구 ${countText(G)}. 어떤 공을 던질까요?`, opts:[
    { n:1, t:'스트라이크로 승부', s: spZone('attack') + '. 볼넷은 줄지만 맞기 쉽습니다.', act: v => submit('def', 'attack', v) },
    { n:2, t:'유인구', s: spZone('nibble') + '. 속으면 헛스윙, 참으면 볼입니다.', act: v => submit('def', 'nibble', v) },
    { n:3, t:'고의 볼넷', s:'타자를 그냥 1루로 내보냅니다.', act: v => submit('def', 'ibb', v) },
    pickOpt(4),
    { n:8, t:'맡기기', s:'이번 공은 컴퓨터가 골라 줍니다.', act: v => submit('def', aiSPDef(G), v) },
    { n:9, t:'더 보기', s:'점수판, 맡기기, 설정', act: v => go(moreScreen, v) },
  ] };
  return { board:true, q:`${whoLabel(ti)}수비. 타자 ${batTeam(G).bi + 1}번 ${B.name}. 어떻게 승부할까요?`, opts:[
    { n:1, t:'정면 승부', s:'볼넷이 줄고 안타가 조금 늘어납니다. ' + simpleOdds('attack', 'normal'), act: v => submit('def', 'attack', v) },
    { n:2, t:'유인구 승부', s:'삼진이 늘지만 볼넷도 늘어납니다. ' + simpleOdds('nibble', 'normal'), act: v => submit('def', 'nibble', v) },
    { n:3, t:'고의 볼넷', s:'타자를 그냥 1루로 내보냅니다.', act: v => submit('def', 'ibb', v) },
    pickOpt(4),
    { n:8, t:'맡기기', s:'이번 타석은 컴퓨터가 골라 줍니다.', act: v => submit('def', aiSimpleDef(G), v) },
    { n:9, t:'더 보기', s:'점수판, 맡기기, 설정', act: v => go(moreScreen, v) },
  ] };
}
function simpleOff(){
  const ti = batIdx(G), B = curBatter(G), runners = G.bases.some(x => x != null);
  const steal = stealOpt(6, '도루 성공 확률 60%(홈스틸 20%). 타석은 그대로 이어집니다.', (from, v) => {
    if(NET.on && NET.role === 'guest'){ netSendAct({ k:'steal', from }); go(offMain, v, ['도루를 보냈습니다.']); return; }
    const r = playSimple(G, null, 'steal', from); gameNext(v, r); });
  if(G.unit === 'pitch') return { board:true, q:`${whoLabel(ti)}공격. 타자 ${batTeam(G).bi + 1}번 ${B.name}, 제${G.pitchNo + 1}구 ${countText(G)}. 어떻게 할까요?`, opts:[
    { n:1, t:'강하게 치기', s: spSwing('power') + '. 맞으면 장타가 잘 나옵니다.', act: v => submit('off', 'power', v) },
    { n:2, t:'보통 치기', s: spSwing('normal'), act: v => submit('off', 'normal', v) },
    { n:3, t:'맞히기', s: spSwing('contact') + '. 볼을 잘 참습니다.', act: v => submit('off', 'contact', v) },
    { n:4, t:'지켜보기', s:'치지 않습니다. 존에 들어오면 스트라이크, 벗어나면 볼입니다.', act: v => submit('off', 'take', v) },
    { n:5, t: runners ? '번트' : '기습 번트', s: runners ? '주자를 한 베이스 보냅니다. 타자는 대개 아웃됩니다.' : '빠른 발로 1루를 노립니다.', act: v => submit('off', 'bunt', v) },
    steal,
    { n:8, t:'맡기기', s:'이번 공은 컴퓨터가 골라 줍니다.', act: v => submit('off', aiSPOff(G), v) },
    { n:9, t:'더 보기', s:'점수판, 맡기기, 설정', act: v => go(moreScreen, v) },
  ] };
  return { board:true, q:`${whoLabel(ti)}공격. 타자 ${batTeam(G).bi + 1}번 ${B.name}. 어떻게 칠까요?`, opts:[
    { n:1, t:'강하게 치기', s: simpleOdds(null, 'power'), act: v => submit('off', 'power', v) },
    { n:2, t:'보통 치기', s: simpleOdds(null, 'normal'), act: v => submit('off', 'normal', v) },
    { n:3, t:'맞히기', s: simpleOdds(null, 'contact'), act: v => submit('off', 'contact', v) },
    { n:4, t: runners ? '번트' : '기습 번트', s: runners ? '주자를 한 베이스 보냅니다. 타자는 대개 아웃됩니다.' : '빠른 발로 1루를 노립니다.', act: v => submit('off', 'bunt', v) },
    { ...steal, n:5 },
    { n:8, t:'맡기기', s:'이번 타석은 컴퓨터가 골라 줍니다.', act: v => submit('off', aiSimpleOff(G), v) },
    { n:9, t:'더 보기', s:'점수판, 맡기기, 설정', act: v => go(moreScreen, v) },
  ] };
}

/* ---------- 더 보기 · 명단 ---------- */
function moreScreen(){
  const playing = needs(0) || needs(1);
  const [A, H] = G.teams;
  return { board:true, sub:true, q:'더 보기', back: v => gameNext(v, null), opts:[
    { n:1, t:'점수판', act: v => note(scoreboard(G), v) },
    { n:2, t:'지금 타자와 투수', act: v => note(whoInfo(), v) },
    { n:3, t:`${A.short} 명단`, act: v => go(() => rosterScreen(0), v) },
    { n:4, t:`${H.short} 명단`, act: v => go(() => rosterScreen(1), v) },
    { n:5, t: NET.on ? '채팅과 음성 대화' : '최근 기록', s: NET.on ? voiceLabel() : '최근 12줄', act: v => NET.on ? go(talkScreen, v) : note(recentLines(12), v) },
    { n:6, t:`작전을 묻는 때: ${SET.mgrAsk === 'every' ? '매 타석' : '중요한 순간만'}`, hide: G.mode !== 'manager' || (NET.on && NET.role === 'guest'),
      s:'중요한 순간: 득점권에 주자가 있을 때, 무사 1루, 경기 후반 접전, 투수가 지쳤을 때.' + (NET.on ? ' 온라인에서는 두 사람 모두에게 적용됩니다.' : ''),
      act: () => { SET.mgrAsk = SET.mgrAsk === 'every' ? 'key' : 'every'; saveSet(); stay(`작전을 묻는 때: ${SET.mgrAsk === 'every' ? '매 타석' : '중요한 순간만'}`); } },
    { n:7, t:`중계: ${SET.mgrPitch ? '공 하나하나' : '타석 결과만'}`, hide: G.mode !== 'manager',
      act: () => { SET.mgrPitch = !SET.mgrPitch; saveSet(); stay(`중계: ${SET.mgrPitch ? '공 하나하나 읽기' : '타석 결과만 읽기'}`); } },
    { n:6, key:'pa', t:'이번 타석 맡기기', hide: !playing || G.over || G.mode === 'manager', s:'이번 타석이 끝날 때까지 컴퓨터가 대신 고릅니다.', act: v => delegate('pa', v) },
    { n:7, key:'half', t:'이번 이닝 맡기기', hide: !playing || twoP() || G.over || G.mode === 'manager', s: NET.on ? '이번 이닝이 끝날 때까지 컴퓨터가 내 팀을 대신 고릅니다.' : '이번 이닝이 끝날 때까지 컴퓨터가 대신 고르고, 결과만 알려 줍니다.', act: v => delegate('half', v) },
    { n:8, t:'설정', act: v => go(() => settingsScreen(() => go(moreScreen, 'click')), v) },
    NET.on ? { n:9, t:'방에서 나가기', s:'경기를 그만두고 방에서 나갑니다.', act: () => leaveRoomAsk() }
      : { n:9, t:'경기 그만하기', s:'경기는 저장되어 처음 화면에서 이어 할 수 있습니다.', act: v => { saveGame(); G = null; go(homeScreen, v, ['경기를 저장했습니다. 이어하기로 다시 시작할 수 있습니다.']); } },
  ] };
}
function rosterScreen(ti){
  const T = G.teams[ti], own = ownTeam(ti);
  const say = [`${T.name}, ${STYLES[T.style].name}. ${STYLES[T.style].desc}${own ? '' : ' 상대 팀 능력치는 등급으로만 보입니다.'}`];
  if(detailed(G)){
    T.bat.forEach((b, i) => say.push(batterInfo(G, T, i, own)));
    T.pit.forEach((p, i) => say.push((i === T.pi ? '지금 투수. ' : p.used ? '이미 던짐. ' : '') + pitcherInfo(G, T, i, own)));
    (T.bench || []).forEach(b => say.push(`벤치 ${b.name}, ${b.role}, ${handText(b.hand)}. ${own ? `컨택 ${b.con}, 파워 ${b.pow}, 선구안 ${b.eye}, 스피드 ${b.spd}` : `컨택 ${gradeWord(b.con)}, 파워 ${gradeWord(b.pow)}, 스피드 ${gradeWord(b.spd)}`}.`));
    (T.gone || []).forEach(b => say.push(`교체되어 나감: ${b.name}, 오늘 ${batterLine(b)}.`));
  } else {
    T.bat.forEach((b, i) => say.push(`${i + 1}번 ${POS[b.pos]} ${b.name}, 오늘 ${batterLine(b)}.`));
    say.push(`투수 ${T.pit[T.pi].name}.`);
  }
  return { board:true, sub:true, q:`${T.short} 명단입니다. 위 글을 한 줄씩 읽어 보세요.`, back: v => go(moreScreen, v), say,
    opts:[{ n:1, t:'돌아가기', act: v => go(moreScreen, v) }] };
}
// 위쪽 메뉴 단추
function openMenu(via){
  if(G && UI.S && UI.S.board) go(moreScreen, via);
  else go(() => settingsScreen(() => go(homeScreen, 'click')), via);
}

/* ---------- 관전 (컴퓨터끼리) ---------- */
function watchScreen(){
  const unit = G.mode === 'detail' || G.unit === 'pitch' ? '공' : '타석';
  const step = stop => v => { const r = runSteps(stop); gameNext(v, { lines: r.lines.filter(l => !GS.short || 'ric'.includes(l.k)), fx: r.fx }); };
  const pa = G.pa, half = G.half;
  return { board:true, q:`관전 중. ${halfName(G)}. 무엇을 볼까요?`, opts:[
    { n:1, t:`다음 ${unit}`, act: v => { GS.short = false; let k = 0; step(() => k++ >= 1)(v); } },
    { n:2, t:'이번 타석 끝까지', act: v => { GS.short = false; step(() => G.pa !== pa)(v); } },
    { n:3, t:'이번 이닝 끝까지', s:'타석 결과만 읽어 줍니다.', act: v => { GS.short = true; step(() => G.half !== half)(v); } },
    { n:4, t:'경기 끝까지', s:'점수가 난 장면과 결과만 읽어 줍니다.', act: v => { GS.short = true; const r = runSteps(() => false); gameNext(v, { lines: r.lines.filter(l => 'i'.includes(l.k) || /홈인|홈런/.test(l.s)), fx: r.fx.slice(-1) }); } },
    { n:5, t: GS.play ? '자동 재생 멈추기' : `자동 재생 (${SET.watch}초마다 한 타석)`, act: v => GS.play ? stopAutoPlay(true) : startAutoPlay() },
    { n:9, t:'더 보기', act: v => go(moreScreen, v) },
  ] };
}
function startAutoPlay(){
  GS.play = 1;
  rerender(); speak('자동 재생을 시작합니다. 아무 키나 누르면 멈춥니다.');
  const tick = () => {
    if(!GS.play || !G || G.over) { GS.play = 0; return; }
    const pa = G.pa;
    const r = runSteps(() => G.pa !== pa);
    gameNext('auto', { lines: r.lines, fx: r.fx });
    if(G && !G.over && GS.play) GS.play = setTimeout(tick, SET.watch * 1000);
    else GS.play = 0;
  };
  GS.play = setTimeout(tick, 600);
}
function stopAutoPlay(say){
  if(!GS.play) return;
  clearTimeout(GS.play); GS.play = 0;
  if(say){ rerender(); speak('자동 재생을 멈췄습니다.'); }
}

/* ---------- 경기 끝 ---------- */
function endScreen(){
  const o = GS.opts;
  if(G.career) return { board:true, q:'경기가 끝났습니다. 무엇을 할까요?', opts:[
    { n:1, t:'육성 화면으로', act: v => { G = null; go(careerHome, v); } },
    { n:2, t:'점수판', act: v => note(scoreboard(G), v) },
    { n:3, t:'경기 기록 전체', act: v => go(() => logScreen(), v) },
  ] };
  if(G.league) return { board:true, q:'경기가 끝났습니다. 무엇을 할까요?', opts:[
    { n:1, t:'리그 화면으로', act: v => { G = null; go(leagueHome, v); } },
    { n:2, t:'점수판', act: v => note(scoreboard(G), v) },
    { n:3, t:'경기 기록 전체', act: v => go(() => logScreen(), v) },
  ] };
  if(NET.on) return { board:true, q: NET.role === 'host' ? '경기가 끝났습니다. 한 판 더 할까요?' : '경기가 끝났습니다. 방장이 한 판 더를 고르면 새 경기가 시작됩니다.', opts:[
    { n:1, t:'한 판 더', hide: NET.role !== 'host', s:'같은 팀으로 새 경기를 시작합니다. 선수 능력치와 날씨는 새로 정해집니다.', act: v => netStartGame(v) },
    { n:2, t:'점수판', act: v => note(scoreboard(G), v) },
    { n:3, t:'경기 기록 전체', act: v => go(() => logScreen(), v) },
    { n:4, t:'채팅과 음성 대화', act: v => go(talkScreen, v) },
    { n:9, t:'방에서 나가기', act: () => leaveRoomAsk() },
  ] };
  return { board:true, q:'경기가 끝났습니다. 무엇을 할까요?', opts:[
    { n:1, t:'같은 설정으로 다시 하기', s:'선수 능력치와 날씨는 새로 정해집니다.', act: v => startGame({ ...o, seed: (Date.now() >>> 0) }, v) },
    { n:2, t:'점수판', act: v => note(scoreboard(G), v) },
    { n:3, t:'경기 기록 전체', s:'처음부터 끝까지 한 줄씩 읽을 수 있습니다.', act: v => go(() => logScreen(), v) },
    { n:4, t:'처음 화면으로', act: v => { G = null; go(homeScreen, v); } },
  ] };
}
function logScreen(){
  const say = G.log.filter(l => l.k !== 'd' || SET.dice).slice(-300);
  return { board:true, sub:true, q:'경기 기록입니다. 위 글을 한 줄씩 읽어 보세요.', say, back: v => go(G.over ? endScreen : moreScreen, v),
    opts:[{ n:1, t:'돌아가기', act: v => go(G.over ? endScreen : moreScreen, v) }] };
}
