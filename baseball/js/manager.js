'use strict';
/* ===================== 감독 모드 화면 =====================
   경기 전: 타순·벤치·선발 투수를 정하고 "준비 완료"
   경기 중: 중요한 순간(득점권, 경기 후반 접전, 투수가 지쳤을 때)마다 작전을 물음 (설정에서 매 타석으로 바꿀 수 있음)
   묻지 않는 타석은 선수들이 알아서 하고, 결과만 모아서 읽어 줌.
   온라인 손님은 작전·교체를 방장에게 요청으로 보냄 (방장 기기가 확인한 뒤 적용) */

// 방장·혼자는 바로 적용, 온라인 손님은 요청으로 보냄. fn은 적용하고 문장(flush 결과)을 돌려줌
function mgrDo(act, fn, via, next){
  if(NET.on && NET.role === 'guest'){ netSendAct(act); next(via, ['요청을 보냈습니다. 방장 기기에서 바로 반영됩니다.']); return; }
  const r = fn(); saveGame(); if(NET.on) netPushState(r);
  next(via, visible(r.lines));
}
const statLine = b => `컨택 ${b.con}, 파워 ${b.pow}, 선구안 ${b.eye}, 스피드 ${b.spd}, 수비 ${b.def}`;
const statGrade = b => `컨택 ${gradeWord(b.con)}, 파워 ${gradeWord(b.pow)}, 선구안 ${gradeWord(b.eye)}, 스피드 ${gradeWord(b.spd)}`;

/* ---------- 경기 전 준비 ---------- */
function pregameScreen(ti){
  const T = G.teams[ti], P = T.pit[T.pi];
  const back = (v, lines) => go(() => pregameScreen(ti), v, lines);
  const say = [`${twoP() ? (G.who[ti] || T.short) + ', ' : ''}${T.name}(${STYLES[T.style].name}) 경기 전 준비입니다.`,
    ...T.bat.map((b, i) => `${i + 1}번 ${POS[b.pos]} ${b.name}, ${handText(b.hand)}. ${statLine(b)}.`),
    `선발 투수 ${P.name}, 최고 구속 ${P.vel}킬로, 제구 ${P.ctl}, 구위 ${P.stf}, 체력 약 ${P.sta}구.`,
    `벤치: ${T.bench.map(b => `${b.name}(${b.role})`).join(', ')}.`];
  return { board:true, sub:true, q:'타순과 선발 투수를 정하세요. 다 되면 1번을 누르세요.', say, opts:[
    { n:1, t:'준비 완료', s: NET.on ? '상대도 준비를 마치면 경기가 시작됩니다.' : '경기를 시작합니다.', act: v => mgrDo({ k:'ready' }, () => {
      G.pre.ready[ti] = true; if(G.pre.ready.every(Boolean)) beginGame(G); return flush(G); }, v, (vv, lines) => gameNext(vv, { lines, fx:[] })) },
    { n:2, t:'추천 타순으로 바꾸기', s:'발 빠른 타자를 1번에, 힘 있는 타자를 3번과 4번에 둡니다.', act: v => mgrDo({ k:'lineup', a:'rec' }, () => recommendLineup(G, ti), v, back) },
    { n:3, t:'두 타자 순서 바꾸기', act: v => go(() => swapScreen(ti, -1), v) },
    { n:4, t:'벤치 선수 넣기', s:'벤치 선수를 선발 명단에 넣고, 빠진 선수는 벤치로 갑니다.', act: v => go(() => benchPreScreen(ti, -1), v) },
    { n:5, t:'선발 투수 바꾸기', act: v => go(() => starterScreen(ti), v) },
    { n:6, t:'상대 팀 보기', act: v => go(() => rosterScreen(1 - ti), v) },
  ] };
}
function swapScreen(ti, first){
  const T = G.teams[ti], back = (v, lines) => go(() => pregameScreen(ti), v, lines);
  const opts = T.bat.map((b, i) => ({ n: i + 1, t: `${i + 1}번 ${b.name}`, s: `${POS[b.pos]}. ${statLine(b)}`, hide: i === first,
    act: v => first < 0 ? go(() => swapScreen(ti, i), v) : mgrDo({ k:'lineup', a:'swap', i:first, j:i }, () => swapOrder(G, ti, first, i), v, back) }));
  return { board:true, sub:true, q: first < 0 ? '먼저 옮길 타자를 고르세요.' : `${first + 1}번 ${josa(T.bat[first].name, '과', '와')} 자리를 바꿀 타자를 고르세요.`, opts, back: v => go(() => first < 0 ? pregameScreen(ti) : swapScreen(ti, -1), v) };
}
function benchPreScreen(ti, b){
  const T = G.teams[ti], back = (v, lines) => go(() => pregameScreen(ti), v, lines);
  if(b < 0) return { board:true, sub:true, q:'넣을 벤치 선수를 고르세요.', back: v => go(() => pregameScreen(ti), v),
    opts: T.bench.map((p, i) => ({ n: i + 1, t: `${p.name}, ${p.role}`, s: `${handText(p.hand)}. ${statLine(p)}`, act: v => go(() => benchPreScreen(ti, i), v) })) };
  const p = T.bench[b];
  return { board:true, sub:true, q:`${josa(p.name, '을', '를')} 누구 자리에 넣을까요? 수비 위치는 빠지는 선수의 자리를 이어받습니다.`, back: v => go(() => benchPreScreen(ti, -1), v),
    opts: T.bat.map((x, i) => ({ n: i + 1, t: `${i + 1}번 ${POS[x.pos]} ${x.name}`, s: statLine(x),
      act: v => go(() => confirmSub(`${x.name} 대신 ${josa(p.name, '을', '를')} 넣을까요?`, [`빠지는 선수: ${x.name}, ${statLine(x)}`, `들어갈 선수: ${p.name}, ${p.role}, ${handText(p.hand)}. ${statLine(p)}`], '교체하기',
        w => mgrDo({ k:'lineup', a:'bench', slot:i, b }, () => useBench(G, ti, i, b, 'pre'), w, back), w => go(() => benchPreScreen(ti, b), w)), v) })) };
}
function starterScreen(ti){
  const T = G.teams[ti], back = (v, lines) => go(() => pregameScreen(ti), v, lines);
  return { board:true, sub:true, q:'선발 투수를 고르세요. 불펜 투수는 체력이 적어 일찍 지칩니다.', back: v => go(() => pregameScreen(ti), v),
    opts: T.pit.map((p, i) => ({ n: i + 1, t: `${p.name}${i === T.pi ? ' (지금 선발)' : ''}`, s: pitcherInfo(G, T, i, true),
      act: v => i === T.pi ? back(v) : go(() => confirmSub(`선발을 ${josa(p.name, '으로', '로')} 바꿀까요?`, ['지금 선발: ' + pitcherInfo(G, T, T.pi, true), '바꿀 투수: ' + pitcherInfo(G, T, i, true)], '선발로 정하기',
        w => mgrDo({ k:'lineup', a:'starter', idx:i }, () => setStarter(G, ti, i), w, back), w => go(() => starterScreen(ti), w)), v) })) };
}

/* ---------- 경기 중 작전 ---------- */
function mgrOff(){
  const ti = batIdx(G), T = G.teams[ti], B = curBatter(G), bs = G.bases;
  const runners = bs.some(x => x != null), bench = T.bench.length > 0;
  const runner = bs[1] != null && bs[2] == null ? T.bat[bs[1]] : bs[0] != null && bs[1] == null ? T.bat[bs[0]] : null;
  const order = k => v => submit('off', { k }, v);
  return { board:true, q:`${whoLabel(ti)}공격 작전. ${G.outs}아웃 ${basesText(bs)}. 타자 ${T.bi + 1}번 ${B.name}, ${statLine(B)}. 어떻게 할까요?`, opts:[
    { n:1, t:'타자에게 맡기기', s:'타자가 알아서 칩니다.', act: order('normal') },
    { n:2, t:'적극적으로 쳐라', s:'초구부터 노리고 장타를 노립니다. 삼진이 늘 수 있습니다.', act: order('aggr') },
    { n:3, t:'신중하게 골라라', s:'공을 많이 보고 볼넷을 노립니다. 장타는 줄어듭니다.', act: order('patient') },
    { n:4, t: bs[2] != null ? '스퀴즈 번트' : runners ? '희생 번트' : '기습 번트', s: runners ? '타자는 아웃되더라도 주자를 한 베이스 보냅니다.' : '빠른 발로 1루를 노립니다.', act: order('bunt') },
    stealOpt(5, '첫 공에 뜁니다.', (from, v) => submit('off', { k:'steal', from }, v)),
    { n:6, t:'히트 앤드 런', hide: bs[0] == null || !canSteal(G), s:'1루 주자가 먼저 뛰고 타자는 꼭 맞힙니다. 병살을 피하고 한 베이스 더 갈 수 있지만, 헛스윙하면 주자가 잡힐 수 있습니다.', act: order('hitrun') },
    { n:7, t:'대타', hide: !bench || G.pitchNo > 0, s:`벤치 ${T.bench.length}명`, act: v => go(phScreen, v) },
    { n:8, t:'대주자', hide: !bench || !runners, act: v => go(() => prScreen(-1), v) },
    { n:9, t:'더 보기', s:'점수판, 선수 정보, 묻는 때, 설정', act: v => go(moreScreen, v) },
  ] };
}
function mgrDef(){
  const ti = 1 - batIdx(G), T = G.teams[ti], P = curPitcher(G), B = curBatter(G);
  const left = Math.round(clamp(1 - P.load / P.sta, 0, 1) * 100), bench = benchPitchers(G, ti);
  const order = k => v => submit('def', { k }, v);
  return { board:true, q:`${whoLabel(ti)}수비 작전. ${G.outs}아웃 ${basesText(G.bases)}. 타자 ${B.name}, ${statGrade(B)}. 투수 ${P.name}, 투구 수 ${P.n}개, 체력 ${left}퍼센트. 어떻게 할까요?`, opts:[
    { n:1, t:'투수에게 맡기기', s:'포수와 투수가 알아서 승부합니다.', act: order('normal') },
    { n:2, t:'정면 승부', s:'볼넷을 줄이고 빠르게 승부합니다. 치기 좋은 공이 늘어납니다.', act: order('attack') },
    { n:3, t:'어렵게 승부', s:'유인구로 장타를 피합니다. 볼넷이 늘어납니다.', act: order('nibble') },
    { n:4, t:'고의 볼넷', act: order('ibb') },
    { n:5, t:'투수 교체', s: bench.length ? `불펜 ${bench.length}명` : '바꿀 투수가 없습니다.', hide: !bench.length, act: v => go(bullpenScreen, v) },
    { n:6, t: defSubOK(G, ti) ? '수비 위치 · 대수비' : '수비 위치', s:`지금 내야 ${ALIGN_IN[T.align.inf]}, 외야 ${ALIGN_OUT[T.align.of]}${defSubOK(G, ti) ? `. 대수비 ${DSUB_MAX - (T.dsub || 0)}번 남음` : ''}`, act: v => go(alignScreen, v) },
    { n:7, t:'상대 타자 분석', s:'오늘 결과, 약점 코스, 성향과 우리 투수 상태', act: v => note([...scoutBatter(G).lines, '우리 투수: ' + pitcherInfo(G, T, T.pi, true)], v, 'scout') },
    pickOpt(8),
    { n:9, t:'더 보기', s:'점수판, 선수 정보, 묻는 때, 설정', act: v => go(moreScreen, v) },
  ] };
}
function phScreen(){
  const ti = batIdx(G), T = G.teams[ti], B = curBatter(G);
  return { board:true, sub:true, q:`${B.name}(${statLine(B)}) 대신 누구를 낼까요? 바뀐 선수는 이번 경기에 다시 나오지 못합니다.`, back: v => go(offMain, v),
    opts: T.bench.map((p, i) => ({ n: i + 1, t: `${p.name}, ${p.role}`, s: `${handText(p.hand)}. ${statLine(p)}`,
      act: v => go(() => confirmSub(`${B.name} 대신 ${josa(p.name, '을', '를')} 대타로 낼까요?`, [`지금 타자: ${B.name}, ${statLine(B)}`, `대타: ${p.name}, ${p.role}, ${handText(p.hand)}. ${statLine(p)}`], '대타 내기',
        w => mgrDo({ k:'ph', b:i }, () => useBench(G, ti, T.bi, i, 'ph'), w, (vv, lines) => go(offMain, vv, lines)), w => go(phScreen, w)), v) })) };
}
function prScreen(slot){
  const ti = batIdx(G), T = G.teams[ti], bs = G.bases;
  if(slot < 0) return { board:true, sub:true, q:'어느 주자를 바꿀까요?', back: v => go(offMain, v),
    opts: [0, 1, 2].filter(i => bs[i] != null).map(i => ({ n: i + 1, t: `${i + 1}루 주자 ${T.bat[bs[i]].name}`, s:`스피드 ${T.bat[bs[i]].spd}`, act: v => go(() => prScreen(bs[i]), v) })) };
  return { board:true, sub:true, q:`${T.bat[slot].name} 대신 누가 뛸까요?`, back: v => go(() => prScreen(-1), v),
    opts: T.bench.map((p, i) => ({ n: i + 1, t: `${p.name}, ${p.role}`, s:`스피드 ${p.spd}`,
      act: v => go(() => confirmSub(`${T.bat[slot].name} 대신 ${josa(p.name, '을', '를')} 대주자로 낼까요?`, [`지금 주자: ${T.bat[slot].name}, 스피드 ${T.bat[slot].spd}`, `대주자: ${p.name}, 스피드 ${p.spd}, ${statLine(p)}`], '대주자 내기',
        w => mgrDo({ k:'pr', slot, b:i }, () => useBench(G, ti, slot, i, 'pr'), w, (vv, lines) => go(offMain, vv, lines)), w => go(() => prScreen(slot), w)), v) })) };
}

/* ---------- 묻지 않는 타석은 선수들이 진행 ----------
   사람이 맡은 팀이라도 중요한 순간이 아니면 "맡기기"로 정하고 바로 진행함. 물어야 할 순간이 오면 멈추고 그때까지의 결과를 돌려줌.
   온라인에서는 방장 기기가 양쪽 팀 모두에 같은 규칙(방장의 '묻는 때' 설정)을 씀 */
function mgrAuto(res){
  const acc = { lines: res ? [...res.lines] : [], fx: res ? [...res.fx] : [], events: res && res.events ? [...res.events] : [] };
  const every = SET.mgrAsk === 'every';
  for(let guard = 0; guard < 300 && !G.over && !G.pre; guard++){
    const off = batIdx(G), def = 1 - off;
    const human = ti => needs(ti) || remote(ti);
    if(!human(0) && !human(1)) break;
    // 비디오 판독: 사람이 고를 차례면 멈추고, 아니면 컴퓨터가 정함
    if(G.review){
      const sd = G.review.side;
      if(human(sd) && reviewLeft(G, sd) > 0) break;
      const r = resolveReview(G, human(sd) ? false : aiChallenge(G));
      acc.lines.push(...r.lines); acc.fx.push(...r.fx); acc.events.push(...r.events); continue;
    }
    const ask = ti => human(ti) && (every || mgrImportant(G, ti));
    if(ask(def) || ask(off)){
      if(human(def) && !ask(def) && !GS.pend.def) GS.pend.def = { k:'normal' };
      if(human(off) && !ask(off) && !GS.pend.off) GS.pend.off = { k:'normal' };
      break;
    }
    const D = GS.pend.def || (human(def) ? { k:'normal' } : aiOrderDef(G));
    const O = GS.pend.off || (human(off) ? { k:'normal' } : aiOrderOff(G));
    GS.pend = { def:null, off:null };
    const r = playManager(G, D, O);
    acc.lines.push(...r.lines); acc.fx.push(...r.fx); acc.events.push(...r.events);
  }
  return acc;
}
/* ===================== 감독 모드: 대수비 · 상대 분석 =====================
   대수비: 경기 후반, 우리 수비 타석이 시작되기 전에 수비가 더 좋은 벤치 선수를 넣음 (engine.js defSubOK·defSubPairs·defSub)
   상대 분석: 타자(오늘 타석마다 결과, 약점 코스, 성향, 상대 팀 능력치는 등급으로만), 투수(오늘 투구 수·체력·구종 등급·많이 던진 공)
   소리와 글로 하기는 note()로 한 줄씩, 화면 보며 하기는 note kind 'scout'로 존 그림에 약점 칸을 표시 */

/* ---------- 대수비 ---------- */
function dsubScreen(){
  const ti = 1 - batIdx(G), T = G.teams[ti], pairs = defSubPairs(G, ti);
  const back = v => go(defMain, v);
  if(!defSubOK(G, ti)) return { board:true, sub:true, q:`지금은 대수비를 할 수 없습니다. 경기 후반, 우리 수비 타석이 시작되기 전에만 경기마다 ${DSUB_MAX}번까지 바꿉니다.`, back, opts:[{ n:1, t:'돌아가기', act: back }] };
  const seen = new Set(), list = pairs.filter(x => !seen.has(x.slot) && seen.add(x.slot)).slice(0, 8);
  return { board:true, sub:true, q:`누구 대신 수비를 넣을까요? 남은 대수비 ${DSUB_MAX - (T.dsub || 0)}번. 바뀐 선수는 이번 경기에 다시 나오지 못합니다.`, back,
    opts: list.length ? list.map((x, i) => {
      const o = T.bat[x.slot], p = T.bench[x.b];
      return { n: i + 1, t:`${POS[o.pos]} ${o.name} 대신 ${p.name}`, s:`수비 ${o.def} → ${p.def} (+${x.gain}). ${p.name}: ${p.role}, 컨택 ${p.con}, 파워 ${p.pow}.`,
        act: v => go(() => confirmSub(`${o.name} 대신 ${josa(p.name, '을', '를')} 대수비로 넣을까요?`, [`나가는 선수: ${o.name}, 수비 ${o.def}, 오늘 ${batterLine(o)}`, `들어갈 선수: ${p.name}, ${p.role}, 수비 ${p.def}. ${statLine(p)}`], '대수비 넣기',
          w => mgrDo({ k:'dsub', slot: x.slot, b: x.b }, () => defSub(G, ti, x.slot, x.b), w, (vv, lines) => go(defMain, vv, lines)), w => go(dsubScreen, w)), v) };
    }) : [{ n:1, t:'수비가 더 좋은 벤치 선수가 없습니다. 돌아가기', act: back }] };
}

/* ---------- 상대 분석 ---------- */
const PA_WORDS = [['홈런', '홈런'], ['3루타', '3루타'], ['2루타', '2루타'], ['병살', '병살타'], ['희생', '희생타'], ['볼넷', '볼넷'], ['몸에 맞', '몸에 맞는 공'], ['삼진', '삼진'], ['안타', '안타'], ['실책', '실책으로 출루'], ['땅볼', '땅볼 아웃'], ['뜬공', '뜬공 아웃'], ['직선타', '직선타 아웃'], ['플라이', '뜬공 아웃'], ['아웃', '아웃']];
const paWord = s => (PA_WORDS.find(([w]) => s.includes(w)) || [, ''])[1];
// 약점 칸(타자 쪽에서 본 존: r 0 높게·2 낮게, c 0 몸쪽·2 바깥쪽): 힘이 좋으면 낮은 공, 정확하면 높은 공 / 적극적이면 바깥쪽, 아니면 몸쪽
function scoutBatter(G){
  const bi = batIdx(G), B = curBatter(G), own = ownTeam(bi), v = x => own ? x : gradeWord(x);
  const pas = G.log.filter(l => l.k === 'r' && l.b === B.name).map(l => paWord(l.s)).filter(Boolean);
  const r = B.pow >= B.con + 4 ? 2 : B.con >= B.pow + 4 ? 0 : (B.eye < 50 ? 2 : 0);
  const c = (B.aggr || 50) >= 55 ? 2 : 0;
  const lines = [
    `타자 ${B.name}, ${handText(B.hand)}. 컨택 ${v(B.con)}, 파워 ${v(B.pow)}, 선구안 ${v(B.eye)}, 스피드 ${v(B.spd)}.`,
    `오늘 ${batterLine(B)}${pas.length ? `. 타석마다: ${pas.map((w, i) => `${i + 1}번째 ${w}`).join(', ')}` : '. 오늘 첫 타석입니다'}.`,
    `약점: ${ZONE_NAME[r][c]} 공에 약해 보입니다. ${r === 2 ? '높은 공' : '낮은 공'}은 잘 칩니다.`,
    `성향: ${(B.aggr || 50) >= 62 ? '적극적으로 초구부터 칩니다. 유인구가 잘 통합니다' : (B.aggr || 50) <= 38 ? '신중하게 공을 많이 봅니다. 정면 승부가 낫습니다' : '보통 성향입니다'}${B.eye < 45 ? '. 선구안이 약해 볼에 잘 속습니다' : B.eye >= 70 ? '. 선구안이 좋아 볼넷을 조심해야 합니다' : ''}.`,
  ];
  return { lines, weak:{ r, c }, strongR: r === 2 ? 0 : 2, hand: B.hand, name: B.name, pas };
}
function scoutPitcher(G){
  const fi = 1 - batIdx(G), P = curPitcher(G), own = ownTeam(fi), v = x => own ? x : gradeWord(x);
  const left = Math.round(clamp(1 - P.load / P.sta, 0, 1) * 100), ptc = P.ptc || {};
  const most = Object.entries(ptc).sort((a, b) => b[1] - a[1]);
  const best = P.pitches.slice().sort((a, b) => b.g - a.g)[0];
  const lines = [
    `투수 ${P.name}, ${handText(P.hand, true)}. 오늘 투구 수 ${P.n}개, 체력 약 ${left}퍼센트${fatigue(P) > 0.3 ? ', 많이 지쳤습니다' : ''}.`,
    `구종: ${P.pitches.map(x => `${PITCH[x.t].name} ${v(x.g)}`).join(', ')}. 가장 좋은 공은 ${PITCH[best.t].name}입니다.`,
    most.length ? `오늘 많이 던진 공: ${most.slice(0, 3).map(([t, n]) => `${PITCH[t].name} ${n}개`).join(', ')}.` : '아직 오늘 던진 공 기록이 없습니다.',
    `제구 ${v(P.ctl)}, 구위 ${v(P.stf)}. ${P.ctl < 45 ? '제구가 흔들리니 신중하게 공을 보세요.' : P.stf >= 70 ? '공이 묵직하니 짧게 맞히는 것이 낫습니다.' : '정면으로 승부해 볼 만합니다.'}`,
  ];
  return { lines, name: P.name, pitches: P.pitches.map(x => ({ t: x.t, g: x.g, n: ptc[x.t] || 0 })), left, own };
}
