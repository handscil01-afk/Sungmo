'use strict';
/* ===================== 시즌 끝 시상식 · 트로피 진열장 · 배지 알림 (화면 정의) =====================
   - 시상식: 시즌이 끝나면(phase 'done') 리그·육성 첫 화면 앞에 한 번(L.awShow = 시즌) 보여 줌.
     우승 팀 → 정규 시즌 MVP → 신인왕 → 한국시리즈 MVP → 기록 타이틀 → 골든글러브를 한 단계씩, "다음 상"과 "건너뛰기"
   - 트로피 진열장: 받은 트로피(개수)와 배지(받은 것은 색, 못 받은 것은 그림자). 육성 라커룸과 리그 기록실에서 들어감
   - 배지 알림: 새 배지는 화면이 바뀔 때(ui.js go·rerender → badgeFlush) 화면 보며 하기는 알림 띠, 소리와 글로 하기는 결과 글 한 줄
   화면 보며 하기 그림은 skin-awards.js (kind 'cr-award' · 'cr-cabinet') */

/* ---------- 시상식 ---------- */
const TITLE_TRO = { avg:4, hr:3, rbi:4, h:4, sb:4, era:6, w:6, sv:6, hd:6, k:6 };
function awardShowDue(L){ return !!(L && L.phase === 'done' && L.champ && L.awards && L.awShow !== L.season && !(L.career && L.career.retired)); }
// 시상 단계: { key, label, tro(트로피 칸), team(우승 팀) | who({ id, name, team }) | list(골든글러브), val, ban }
function awardSteps(L){
  const A = L.awards || {}, steps = [{ key:'champ', label:'한국시리즈 우승', tro:0, team: L.champ, ban:'champ' }];
  if(A.mvp) steps.push({ key:'mvp', label:'정규 시즌 MVP', tro:1, who: A.mvp, ban:'mvp' });
  if(A.roy) steps.push({ key:'roy', label:'신인왕', tro:2, who: A.roy });
  if(A.ksMvp) steps.push({ key:'ksmvp', label:'한국시리즈 MVP', tro:1, who: A.ksMvp, ban:'mvp' });
  (A.titles || []).forEach(t => steps.push({ key:'t-' + t.st, label: TITLE_NAME[t.st], tro: TITLE_TRO[t.st] ?? 4, who: t, val: statVal(t.st, t.v) }));
  if((A.gg || []).length) steps.push({ key:'gg', label:'골든글러브', tro:5, list: A.gg });
  return steps;
}
// 상 받은 사람이 내 선수(육성)인지, 우리 팀 선수(리그)인지
const awMine = (L, who) => !!who && (L.career ? who.id === L.career.id : who.team === L.my);
// 이번 시즌 기록 한 줄
function awStat(L, who){
  const f = who && typeof findPlayer === 'function' ? findPlayer(L, who.id) : null; if(!f) return '';
  const p = f.p, s = p.ss || {};
  if(p.vel) return `${s.w || 0}승 ${s.l || 0}패${s.sv ? ` ${s.sv}세이브` : ''}${s.hd ? ` ${s.hd}홀드` : ''}, 평균자책점 ${s.out ? eraOf(s).toFixed(2) : '-'}, 탈삼진 ${s.k || 0}`;
  return `타율 ${avgOf(s).toFixed(3).replace(/^0/, '')}, ${s.h || 0}안타, ${s.hr || 0}홈런, ${s.rbi || 0}타점${s.sb ? `, ${s.sb}도루` : ''}`;
}
// 시상식 한 단계 화면. back: 다 보거나 건너뛴 뒤 갈 화면(없으면 리그·육성 첫 화면)
function awardShowScreen(i = 0, back){
  const L = LG(); if(!L) return lhome()();
  const steps = awardSteps(L), N = steps.length, st = steps[Math.min(i, N - 1)], last = i >= N - 1;
  const end = (v, skip) => { if(!back){ L.awShow = L.season; saveLeague(); } go(back || lhome(), v, [skip ? '시상식을 건너뛰었습니다.' : '시상식을 마쳤습니다.']); };
  let q, note = [];
  if(st.team){
    const rank = (L.final || []).indexOf(st.team) + 1;
    q = `${L.season}시즌 시상식입니다. ${st.label}: ${teamInfo(st.team).name}!`;
    if(rank) note.push(`정규 시즌 ${rank}위 팀이 한국시리즈 정상에 올랐습니다.`);
    if(st.team === L.my) note.push(L.career ? `${(badgeMe(L) || {}).name || '내 선수'}의 팀이 우승했습니다! 축하합니다!` : '우리 팀이 우승했습니다! 축하합니다!');
  } else if(st.who){
    const w = st.who, mine = awMine(L, w), line = awStat(L, w);
    q = `${st.label}: ${teamName(w.team)} ${w.name}!`;
    note.push(`${josa(w.name, '이', '가')} ${st.label} 트로피를 들어 올립니다.`);
    if(st.val) note.push(`기록: ${st.val}.`);
    if(line) note.push(`이번 시즌 ${line}.`);
    if(mine) note.push(L.career ? '내 선수가 받았습니다! 축하합니다!' : '우리 팀 선수입니다! 축하합니다!');
  } else {
    q = `${st.label}: 자리마다 가장 뛰어난 선수 ${st.list.length}명입니다.`;
    note = st.list.map(g => `${g.pos}: ${teamName(g.team)} ${g.name}${awMine(L, g) ? (L.career ? ' (내 선수)' : ' (우리 팀)') : ''}.`);
  }
  note.push(`시상 ${i + 1} / ${N}`);
  return { kind:'cr-award', skTitle:'시상식', step: st, i, n: N, q, note, back: v => end(v, true), opts:[
    { n:1, key:'next', t: last ? '시상식 마치기' : '다음 상', act: v => last ? end(v, false) : go(() => awardShowScreen(i + 1, back), v) },
    { n:2, key:'skip', t:'건너뛰기', hide: last, s:'남은 시상을 넘깁니다.', act: v => end(v, true) },
  ] };
}

/* ---------- 트로피 진열장 ---------- */
// 화면 보며 하기에서 고른 칸(탭·고른 것·쪽)
const CAB = { tab:'tro', sel:null, pg:0 };
function cabinetOpen(back, via){ CAB.tab = 'tro'; CAB.sel = null; CAB.pg = 0; go(() => cabinetScreen(back), via); }
function cabinetScreen(back){
  const L = LG(); if(!L) return back();
  if(badgeCheck(L)) saveLeague();
  const tro = trophyList(L), bl = badgeList(L), st = badgeStore(L), got = bl.filter(b => st[b.id]);
  const nT = tro.reduce((a, t) => a + t.n, 0);
  const say = ['트로피.', ...(tro.length ? tro.map(t => `${t.name} ${t.n}개: ${t.who.join(', ')}.`) : ['아직 받은 트로피가 없습니다.']),
    `받은 배지 ${got.length}개, 모두 ${bl.length}개.`, ...got.map(b => `${b.name}: ${badgeWhen(st[b.id])}에 받음. ${badgeDesc(L, b)}`)];
  if(got.length < bl.length) say.push('아직 받지 못한 배지.', ...bl.filter(b => !st[b.id]).map(b => `${b.name}: ${badgeDesc(L, b)}`));
  const owner = L.career ? `${(badgeMe(L) || {}).name || '내 선수'}의 진열장` : `${teamInfo(L.my).short} 진열장`;
  const replay = L.phase === 'done' && L.champ && L.awards;
  return { kind:'cr-cabinet', skTitle:'트로피 진열장', owner, tro, badges: bl, got: st, nT,
    q:`트로피 진열장입니다. 트로피 ${nT}개, 배지 ${got.length}개를 모았습니다.`, say, back: v => go(back, v),
    set: (k, v) => {
      if(k === 'tab'){ CAB.tab = v === 'bdg' ? 'bdg' : 'tro'; CAB.sel = null; CAB.pg = 0; }
      else if(k === 'sel') CAB.sel = CAB.sel === v ? null : v;
      else if(k === 'pg') CAB.pg = Math.max(0, CAB.pg + Number(v));
    },
    opts:[
      { n:1, key:'back', t:'돌아가기', act: v => go(back, v) },
      { n:2, key:'show', t:'이번 시즌 시상식 다시 보기', hide: !replay, act: v => go(() => awardShowScreen(0, () => cabinetScreen(back)), v) },
    ] };
}

/* ---------- 배지 알림 ----------
   ui.js go()·rerender()에서 화면을 만든 뒤 부름. 리그·육성 화면이면 먼저 배지를 살피고(인기·돈처럼 화면에서 바뀐 것),
   새 배지가 있으면 화면 보며 하기는 알림 띠(skin-awards.js badgeToast), 소리와 글로 하기는 결과 글 끝에 한 줄씩 */
function badgeFlush(S, re){
  if(!S) return;
  if(!S.board && /^(cr-|lg-|ar-)/.test(S.kind || '') && typeof LG === 'function'){
    try{ const L = LG(); if(L && badgeCheck(L)) saveLeague(); }catch(e){}
  }
  if(!BADGE_Q.length) return;
  const got = BADGE_Q.splice(0);
  if(typeof VIEW !== 'undefined' && VIEW.gfx && typeof badgeToast === 'function'){ badgeToast(got); return; }
  const lines = got.map(b => ({ s:`배지를 받았습니다! ${b.name}. ${b.desc}`, k:'i' }));
  const same = S.say === UI.say;
  S.say = [...(S.say || []), ...lines];
  if(same) UI.say = S.say;
  if(re && typeof speak === 'function') speak(lines.map(l => l.s).join(' '));
}
