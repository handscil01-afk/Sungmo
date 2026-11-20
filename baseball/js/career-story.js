'use strict';
/* ===================== 선수 육성 이야기: 라이벌 · 주전 경쟁 · 스프링캠프 · 은퇴 뒤 감독 =====================
   - 라이벌: 다른 팀에서 나이와 실력이 비슷한 같은 종류(타자·투수) 선수. 시즌 기록을 견주고, 시즌이 끝나면 이겼는지 알려 줌(이기면 인기)
   - 주전 경쟁: 2군에 있을 때 1군 승격까지 얼마나 남았는지(같은 자리 1군 선수와의 실력 차이)를 보여 줌. 승격 규칙은 promote() 그대로
   - 스프링캠프: 새 시즌이 시작되면 개막 전에 사흘. 하루마다 집중 훈련 · 연습 경기 · 휴식 가운데 고름
   - 은퇴 뒤 감독: 은퇴한 리그를 그대로 리그 모드로 옮겨 감독으로 이어 감 */

/* ---------- 라이벌 ---------- */
function rivalPick(L){
  const c = C(L), me = myP(L); if(!me) return null;
  const pit = isPit(me), rate = pit ? ratingPit : ratingBat;
  let best = null, bs = 1e9;
  for(const k in L.teams){
    if(k === L.my) continue;
    allPlayers(L.teams[k]).forEach(p => {
      if(!!p.vel !== pit || p.id === me.id) return;
      const s = Math.abs((p.age || 25) - me.age) * 2 + Math.abs(rate(p) - rate(me) - 3) + (!pit && p.pos !== me.pos ? 4 : 0);
      if(s < bs){ bs = s; best = { id:p.id, team:k }; }
    });
  }
  c.rival = best;
  if(best){ const f = findPlayer(L, best.id); crLog(L, `${teamInfo(f.T.key).short}의 ${f.p.name}, 라이벌이 되었습니다.`); }
  return best;
}
// 지금 라이벌 (은퇴했거나 없으면 새로 고름)
function rival(L){
  const c = C(L); if(!c || c.retired) return null;
  let f = c.rival && findPlayer(L, c.rival.id);
  if(!f || f.T.key === L.my){ rivalPick(L); f = c.rival && findPlayer(L, c.rival.id); }
  return f;
}
// 시즌 점수: 타자 안타 + 홈런×2 + 타점÷2 + 도루÷2 · 투수 승×3 + 세이브×2 + 홀드 + 탈삼진÷5
const seasonScore = (p, s) => p.vel ? (s.w || 0) * 3 + (s.sv || 0) * 2 + (s.hd || 0) + (s.k || 0) / 5 : (s.h || 0) + (s.hr || 0) * 2 + (s.rbi || 0) / 2 + (s.sb || 0) / 2;
const statShort = (p, s) => p.vel ? `${s.w || 0}승 ${s.sv ? `${s.sv}세이브 ` : ''}평균자책점 ${s.out ? eraOf(s).toFixed(2) : '-'}` : `타율 ${avgText(avgOf(s))} ${s.hr || 0}홈런 ${s.rbi || 0}타점`;
function rivalLine(L){
  const f = rival(L); if(!f) return null;
  const me = myP(L), c = C(L), ms = c.where === 'minor' ? {} : me.ss || {}, rs = f.p.ss || {};
  const a = seasonScore(me, ms), b = seasonScore(f.p, rs);
  return { name: f.p.name, team: f.T.key, age: f.p.age, me: statShort(me, ms), them: statShort(f.p, rs), lead: a === b ? 0 : a > b ? 1 : -1,
    text:`라이벌 ${teamInfo(f.T.key).short} ${f.p.name}(${f.p.age}세): ${statShort(f.p, rs)}. 나: ${c.where === 'minor' ? '아직 1군 기록 없음' : statShort(me, ms)}. ${a === b ? '팽팽합니다' : a > b ? '내가 앞섭니다' : '라이벌이 앞섭니다'}.` };
}
// 시즌 끝: 라이벌과 견줌 (nextSeasonCore에서 리그를 넘기기 전에 부름)
function rivalSeasonEnd(L){
  const f = rival(L); if(!f) return [];
  const me = myP(L), c = C(L), a = seasonScore(me, c.where === 'minor' ? {} : me.ss || {}), b = seasonScore(f.p, f.p.ss || {});
  if(a > b){ c.fame = (c.fame || 0) + 3; (c.rivalWins ||= 0); c.rivalWins++; crLog(L, `${L.season}시즌 라이벌 ${f.p.name}에게 이겼습니다!`); return [`이번 시즌 라이벌 ${f.p.name}에게 이겼습니다! 인기 3 올랐습니다.`]; }
  crLog(L, `${L.season}시즌 라이벌 ${f.p.name}에게 졌습니다.`);
  return [`이번 시즌은 라이벌 ${josa(f.p.name, '이', '가')} 앞섰습니다. 다음 시즌에 갚아 줍시다.`];
}
// 오늘 상대 팀에 라이벌이 있으면 알림
function rivalToday(L){
  const f = rival(L), g = typeof myGameToday === 'function' ? myGameToday(L) : null;
  if(!f || !g || C(L).where === 'minor') return null;
  return (g.a === f.T.key || g.h === f.T.key) ? `오늘 상대 ${teamInfo(f.T.key).short}에 라이벌 ${josa(f.p.name, '이', '가')} 있습니다!` : null;
}

/* ---------- 주전 경쟁 (2군 → 1군 승격까지) ---------- */
function promoteGap(L){
  const c = C(L); if(!c || c.where !== 'minor' || !c.p) return null;
  const p = c.p, T = L.teams[L.my];
  let them;
  if(isPit(p)){ const list = p.role === '선발' ? T.sp : T.rp; them = list.slice().sort((a, b) => ratingPit(a) - ratingPit(b))[0]; }
  else { const i = T.bat.findIndex(b => b.pos === p.pos); them = i >= 0 ? T.bat[i] : T.bat[4]; }
  const rate = isPit(p) ? ratingPit : ratingBat, mine = Math.round(rate(p)), need = Math.round(rate(them) - 3);
  return { name: them.name, mine, need, gap: Math.max(0, need - mine), pct: clamp(Math.round(mine / Math.max(1, need) * 100), 0, 100),
    text:`1군 승격 경쟁: 내 실력 ${mine}, 1군 ${isPit(p) ? p.role : POS[p.pos]} ${josa(them.name, '을', '를')} 넘으려면 ${need}${need > mine ? `, ${need - mine} 모자랍니다` : ', 곧 올라갈 수 있습니다'}.` };
}

/* ---------- 스프링캠프 ---------- */
const CAMP_DAYS = 3;
function campScreen(){
  const L = CR(), c = C(L), p = myP(L), day = CAMP_DAYS - c.camp + 1;
  const done = (say, v) => { c.camp--; if(c.camp <= 0){ delete c.camp; say.push('스프링캠프를 마쳤습니다. 이제 정규 시즌 개막입니다!'); crLog(L, `${L.season}시즌 스프링캠프를 마쳤습니다.`); } saveLeague(); go(careerHome, v, say); };
  const focus = k => v => { const up = grow(L, k, 7 + rnd(L) * 4); addFatigue(c, 18); done([`${ABIL_NAME[k]} 집중 훈련! 성장 점수 ${Math.round(c.pts[k] || 0)}/10.`, ...up], v); };
  return { kind:'cr-camp', day, q:`스프링캠프 ${day}일째입니다. 개막까지 ${c.camp}일 남았습니다. 오늘은 무엇을 할까요?`, opts:[
    ...statKeys(p).map((k, i) => ({ n: i + 1, key:k, stat:k, t:`${ABIL_NAME[k]} 집중 훈련`, s:`지금 ${p[k]}. 평소 훈련보다 많이 오르지만 피로가 쌓입니다.`, act: focus(k) })),
    { n:7, key:'scrim', t:'연습 경기 뛰기', s:'감독에게 눈도장을 받아 인기가 오르고, 아무 능력이나 조금 오릅니다.', act: v => { const k = pickOne(L, statKeys(p)); c.fame = (c.fame || 0) + 2; addFatigue(c, 10); done([`연습 경기에서 좋은 모습을 보였습니다! 인기 2 올라 ${c.fame}.`, ...grow(L, k, 4)], v); } },
    { n:8, key:'rest', t:'쉬면서 몸 만들기', s:'피로가 풀리고 컨디션이 좋아집니다.', act: v => { addFatigue(c, -40); p.cond = Math.min(2, (p.cond || 0) + 1); done([`푹 쉬며 몸을 만들었습니다. 컨디션 ${COND[p.cond]}.`], v); } },
    { n:9, key:'skip', t:'캠프 남은 날 건너뛰기', s:'남은 날은 쉬면서 보냅니다.', act: v => { c.camp = 1; addFatigue(c, -30); done(['남은 캠프는 가볍게 보냈습니다.'], v); } },
  ] };
}

/* ---------- 은퇴 뒤 감독 ---------- */
function becomeManager(via){
  const L = CR(), c = C(L), name = (c.p || (myP(L) || {})).name || '내 선수';
  const start = () => {
    const M = JSON.parse(JSON.stringify(L));
    delete M.career; M.mode = 'manager'; M.unit = 'pitch';
    (M.news ||= []).push(`${name}, ${teamInfo(M.my).name}의 감독이 되었습니다!`); M.newsRead = M.news.length - 1;
    LSRC = 'league'; setLG(M);
    go(leagueHome, via, [`${name} 감독의 새 출발! 선수 시절 함께한 ${teamInfo(M.my).name}을 이끌고 리그를 이어 갑니다. 감독 모드로 경기합니다.`]);
  };
  if(peekL('league')) openDlg('감독으로 새 출발', ['지금 하던 리그가 있습니다. 그 리그를 지우고 선수 시절 리그를 감독으로 이어 갈까요?'], [{ label:'이어 가기', act: start }, { label:'그만두기' }]);
  else start();
}
