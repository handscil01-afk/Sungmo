'use strict';
/* ===================== 구단 사무실 화면 (리그 감독 모드) =====================
   계산은 office.js. 모든 화면은 "질문 + 번호 선택지"라 두 화면 방식에서 똑같이 고름 (화면 보며 하기는 fo-home을 그림으로) */
const foBack = v => go(officeScreen, v);
function officeScreen(){
  const L = LG(), T = L.teams[L.my], o = officeFresh(L), off = offseason(L), pay = payroll(T), cap = capOf(L);
  const info = [`연봉 총액 ${eok(pay)}, 상한 ${eok(cap)}, 여유 ${eok(Math.max(0, cap - pay))}.`, `이번 시즌 트레이드 ${o.trades}/${TRADE_MAX}번.`,
    off ? `겨울 이적 시장: FA 영입 ${o.fa}/${FA_MAX}명, 신인 드래프트 ${o.drafted ? '마침' : `${draftPick(L)}순위`}.` : 'FA 영입과 신인 드래프트는 시즌이 끝난 뒤에 열립니다.'];
  return { kind:'fo-home', pay, cap, q:'구단 사무실입니다. 무엇을 할까요?', note: info, back: v => go(lhome(), v), opts:[
    { n:1, key:'roster', t:'내 팀 선수 기록', s:'타순, 벤치, 투수의 이번 시즌 기록', act: v => go(myTeamScreen, v) },
    { n:2, key:'trade', t:'트레이드', s: o.trades >= TRADE_MAX ? '이번 시즌 트레이드를 모두 했습니다.' : '같은 종류 선수끼리 한 명씩 바꿉니다. 상대 구단은 비슷하거나 더 좋은 선수를 원합니다.', act: v => o.trades >= TRADE_MAX ? stay('이번 시즌 트레이드를 모두 했습니다.') : go(() => tradeMineScreen('bat'), v) },
    { n:3, key:'fa', t:'FA 시장', hide: !off, s: o.fa >= FA_MAX ? '이번 겨울 FA 영입을 모두 했습니다.' : '자유 계약 선수를 데려오고, 대신 한 명을 내보냅니다. 연봉이 시장 값보다 조금 비쌉니다.', act: v => o.fa >= FA_MAX ? stay('이번 겨울 FA 영입을 모두 했습니다.') : go(foFaScreen, v) },
    { n:4, key:'draft', t:'신인 드래프트', hide: !off || o.drafted, s:`우리 순번 ${draftPick(L)}순위. 젊은 신인을 뽑고 대신 한 명을 내보냅니다.`, act: v => go(foDraftScreen, v) },
    { n:5, key:'moves', t:'최근 선수 이동', act: v => note((L.moves || []).slice(-8).reverse().map(m => `${m.season}시즌 ${m.day}일째: ${m.text}.`).concat((L.moves || []).length ? [] : ['아직 선수 이동이 없습니다.']), v) },
  ] };
}
// 내보낼 우리 선수 고르기 (타자: 타순 9 + 벤치 4, 투수: 선발 5 + 불펜 6)
function myList(L, kind){ const T = L.teams[L.my]; return kind === 'bat' ? [...T.bat, ...T.bench] : [...T.sp, ...T.rp]; }
const slotName = (T, p) => { const s = slotOf(T, p); return !s ? '' : s[0] === 'bat' ? `${s[1] + 1}번 ${POS[p.pos]}` : s[0] === 'bench' ? `벤치 ${p.role}` : p.role; };
function tradeMineScreen(kind){
  const L = LG(), T = L.teams[L.my], list = myList(L, kind);
  const opts = list.map((p, i) => ({ n: i + 1, t:`${slotName(T, p)} ${p.name}`, s: foLine(p), act: v => go(() => tradeTeamScreen(p), v) }));
  opts.push({ n: list.length + 1, t: kind === 'bat' ? '투수 목록 보기' : '타자 목록 보기', act: v => go(() => tradeMineScreen(kind === 'bat' ? 'pit' : 'bat'), v) });
  return { kind:'fo-list', q:`트레이드로 내보낼 ${kind === 'bat' ? '타자' : '투수'}를 고르세요.`, back: foBack, opts };
}
function tradeTeamScreen(mine){
  const L = LG(), keys = Object.keys(L.teams).filter(k => k !== L.my);
  return { kind:'fo-list', q:`${josa(mine.name, '을', '를')} 어느 구단에 제안할까요?`, back: v => go(() => tradeMineScreen(mine.vel ? 'pit' : 'bat'), v),
    opts: keys.map((k, i) => ({ n: i + 1, t: teamInfo(k).name, s:`${standings(L).find(x => x.T.key === k).rank}위 · 연봉 총액 ${eok(payroll(L.teams[k]))}`, act: v => go(() => tradeOfferScreen(mine, k), v) })) };
}
function tradeOfferScreen(mine, key){
  const L = LG(), list = tradeTargets(L, key, mine);
  const word = g => g >= 2 ? '받아들일 것 같습니다' : g >= -1 ? '해 볼 만합니다' : '거절할 것 같습니다';
  return { kind:'fo-list', q:`${teamInfo(key).short}의 어느 선수와 바꿀까요? 내보낼 선수: ${mine.name}, 가치 ${fov(mine)}.`, back: v => go(() => tradeTeamScreen(mine), v),
    opts: list.length ? list.map((x, i) => ({ n: i + 1, t:`${x.p.name} (${x.p.vel ? x.p.role : POS[x.p.pos]})`, s:`${word(x.gain)}. ${foLine(x.p)}.`, act: v => openDlg('트레이드 제안', [`${josa(mine.name, '을', '를')} 주고 ${teamInfo(key).short}의 ${josa(x.p.name, '을', '를')} 받을까요?`, foLine(x.p)], [
      { label:'제안하기', act: () => { const r = doTrade(L, key, mine, x.p); saveLeague(); go(r.ok ? officeScreen : () => tradeOfferScreen(mine, key), 'click', [r.msg]); } }, { label:'그만두기' }]) }))
      : [{ n:1, t:'바꿀 만한 선수가 없습니다. 돌아가기', act: v => go(() => tradeTeamScreen(mine), v) }] };
}
// FA · 드래프트: 데려올 선수를 고른 뒤 내보낼 선수를 고름
function foFaScreen(){
  const L = LG(), list = faPool(L);
  return { kind:'fo-list', q:`FA 시장입니다. 데려올 선수를 고르세요. 연봉 총액 여유 ${eok(Math.max(0, capOf(L) - payroll(L.teams[L.my])))}.`, back: foBack,
    opts: list.length ? list.map((p, i) => ({ n: i + 1, t:`${p.name} (${p.vel ? p.role : POS[p.pos]})`, s: foLine(p), act: v => go(() => releaseScreen(p, 'fa'), v) })) : [{ n:1, t:'남은 FA가 없습니다. 돌아가기', act: foBack }] };
}
function foDraftScreen(){
  const L = LG(), list = draftPool(L);
  return { kind:'fo-list', q:`신인 드래프트입니다. 우리 순번은 ${L.draftPool.pick}순위입니다. 앞 순번 구단이 먼저 뽑고 남은 선수들입니다.`, back: foBack,
    opts: list.map((p, i) => ({ n: i + 1, t:`${p.name} (${p.age}세, ${p.vel ? '투수' : POS[p.pos]})`, s: foLine(p), act: v => go(() => releaseScreen(p, 'draft'), v) })) };
}
function releaseScreen(inc, how){
  const L = LG(), T = L.teams[L.my], list = myList(L, inc.vel ? 'pit' : 'bat');
  const doIt = (out, v) => { const r = how === 'fa' ? signFA(L, inc, out) : draftSign(L, inc, out); saveLeague(); go(r.ok ? officeScreen : () => releaseScreen(inc, how), v, [r.msg]); };
  return { kind:'fo-list', q:`${josa(inc.name, '을', '를')} 데려오면 누구를 내보낼까요? 내보낸 선수의 자리를 그대로 맡습니다.`, back: v => go(how === 'fa' ? foFaScreen : foDraftScreen, v),
    opts: list.map((p, i) => ({ n: i + 1, t:`${slotName(T, p)} ${p.name}`, s: foLine(p), act: v => doIt(p, v) })) };
}
