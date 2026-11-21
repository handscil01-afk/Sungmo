'use strict';
/* ===================== 선수 육성: 감독 신뢰도 · 동료 관계 · 1군 부진 때 2군 강등 =====================
   c.trust 감독 신뢰도, c.mates 동료 관계 (0~100, 처음 50. 옛 저장은 trustInit에서 50으로 채움)
   - 오르는 일: 1군 경기 활약, 사흘 넘게 이어 훈련(성실), 이벤트 선택, 스프링캠프 연습 경기
   - 내리는 일: 1군 경기 부진, 피곤하지 않은데 이어 쉬기(휴식 남용), 이벤트 선택
   - 감독 신뢰도: 높으면 타순이 올라가고(타자) 마무리를 맡기 쉬움(불펜 투수), 낮으면 타순이 내려가고 부진할 때 강등 위험이 커짐
   - 동료 관계: 높으면 가끔 컨디션이 오르고, 동료와의 좋은 이벤트(회식·선배 비법)가 생김
   - 강등: 1군에서 최근 10경기(최소 6경기)가 부진하고(타자 타율 .180 아래, 투수 평균자책점 7 이상) 감독 신뢰도가 45 아래면
     먼저 감독의 경고를 한 번 받고, 그 뒤에도 나아지지 않으면 확률로 2군으로 내려감. 원래 자리는 2군에서 올라온 선수가 맡고,
     내려간 뒤 7일이 지나야 기존 승격 규칙(promote)으로 다시 올라올 수 있음 */
const TRUST_WORD = v => v >= 80 ? '아주 두터움' : v >= 65 ? '두터움' : v >= 45 ? '보통' : v >= 30 ? '낮음' : '아주 낮음';
const MATES_WORD = v => v >= 80 ? '아주 좋음' : v >= 65 ? '좋음' : v >= 45 ? '보통' : v >= 30 ? '서먹함' : '나쁨';
const dayNo = L => L.season * 1000 + L.day;
function trustInit(c){
  if(c.trust == null) c.trust = 50;
  if(c.mates == null) c.mates = 50;
  c.recent ||= [];
  return c;
}
const trustAdd = (L, n) => { const c = trustInit(C(L)); c.trust = clamp(Math.round((c.trust + n) * 10) / 10, 0, 100); };
const matesAdd = (L, n) => { const c = trustInit(C(L)); c.mates = clamp(Math.round((c.mates + n) * 10) / 10, 0, 100); };
function trustLine(L){
  const c = trustInit(C(L));
  return `감독 신뢰도 ${Math.round(c.trust)}(${TRUST_WORD(c.trust)}), 동료 관계 ${Math.round(c.mates)}(${MATES_WORD(c.mates)}).${c.warned ? ' 감독에게 경고를 받은 상태입니다. 부진이 이어지면 2군으로 내려갈 수 있습니다.' : ''}`;
}

/* ---------- 1군 경기 뒤 ---------- */
// ln: myLine 결과. 최근 10경기 기록을 남기고 신뢰도를 바꿈
function trustGame(L, ln, G){
  const c = trustInit(C(L)), s = ln.st, out = [];
  if(ln.bat){
    if(!s.pa) return out;
    c.recent.push({ ab: s.ab, h: s.h, hr: s.hr || 0 });
    if(s.hr || s.h >= 2 || (s.rbi || 0) >= 2) trustAdd(L, 2);
    else if(s.ab >= 3 && !s.h) trustAdd(L, -1.5);
  } else {
    if(!ln.used) return out;
    const dec = G.decision || {};
    c.recent.push({ out: s.out, r: s.r });
    if((s.out >= 3 && s.r === 0) || dec.w === c.id || dec.s === c.id) trustAdd(L, 2);
    else if(s.r >= 4 || (s.out <= 3 && s.r >= 3)) trustAdd(L, -2);
  }
  if(c.recent.length > 10) c.recent.splice(0, c.recent.length - 10);
  return out;
}
// 최근 기록이 부진한지 (경기가 6경기 이상 쌓였을 때만)
function slumping(L){
  const c = trustInit(C(L)), p = myP(L), r = c.recent;
  if(r.length < 6) return false;
  if(isPit(p)){ const out = r.reduce((a, x) => a + (x.out || 0), 0), run = r.reduce((a, x) => a + (x.r || 0), 0); return out >= 9 && run * 27 / out >= 7; }
  const ab = r.reduce((a, x) => a + (x.ab || 0), 0), h = r.reduce((a, x) => a + (x.h || 0), 0);
  return ab >= 15 && h / ab < 0.18;
}

/* ---------- 훈련 · 쉬기 ---------- */
function trustTrain(L, k){
  const c = trustInit(C(L)), out = [];
  if(k){ c.trainRun = (c.trainRun || 0) + 1; c.restRun = 0; if(c.trainRun % 3 === 0){ trustAdd(L, 1.5); out.push('날마다 성실하게 훈련하는 모습에 감독의 신뢰가 쌓입니다.'); } }
  else {
    c.trainRun = 0; c.restRun = (c.restRun || 0) + ((c.fatigue || 0) < 30 ? 1 : 0);
    if(c.restRun >= 2){ trustAdd(L, -2); out.push('피곤하지도 않은데 자꾸 쉬자 감독이 못마땅해합니다.'); }
  }
  return out;
}

/* ---------- 하루가 지날 때: 동료 효과 · 타순과 보직 · 경고와 강등 ---------- */
function trustDay(L){
  const c = trustInit(C(L)), p = myP(L), out = [];
  if(c.retired || L.phase !== 'season') return out;
  if(c.mates >= 70 && rnd(L) < 0.08 && (p.cond || 0) < 2){ p.cond++; out.push(`동료들과 웃고 떠들며 기분이 좋아졌습니다. 컨디션 ${COND[p.cond]}.`); }
  if(c.mates < 30 && rnd(L) < 0.05 && (p.cond || 0) > -2){ p.cond--; out.push('라커룸 분위기가 서먹해서 마음이 무겁습니다.'); }
  if(c.where === 'minor' || c.hurt > 0) return out;
  const T = L.teams[L.my];
  // 타순·보직 (닷새마다)
  if(L.day % 5 === 0){
    if(!isPit(p)){
      const i = T.bat.indexOf(p);
      if(i > 0 && c.trust >= 70 && !slumping(L)){ [T.bat[i - 1], T.bat[i]] = [T.bat[i], T.bat[i - 1]]; out.push(`감독의 신뢰가 두터워 타순이 ${i}번으로 올라갔습니다!`); }
      else if(i >= 0 && i < 8 && c.trust < 30){ [T.bat[i + 1], T.bat[i]] = [T.bat[i], T.bat[i + 1]]; out.push(`감독의 신뢰가 낮아 타순이 ${i + 2}번으로 내려갔습니다.`); }
    } else if(p.role === '불펜' && c.trust >= 80 && !slumping(L)){
      const cl = T.rp.find(x => x.role === '마무리');
      if(cl && cl !== p && ratingPit(p) >= ratingPit(cl) - 6){ cl.role = '불펜'; p.role = '마무리'; crLog(L, `${p.name}, 팀의 마무리 투수가 되었습니다!`); out.push('감독이 마무리 투수를 맡겼습니다! 이제 경기 끝을 책임집니다.'); }
    }
  }
  // 부진하면 경고 → 강등
  const bad = slumping(L);
  if(!bad){ if(c.warned && c.recent.length >= 3 && !slumpingShort(L)) { delete c.warned; out.push('부진에서 벗어나자 감독의 표정이 풀렸습니다.'); } return out; }
  if(c.trust >= 45) return out;
  if(!c.warned){ c.warned = dayNo(L); trustAdd(L, -3); out.push(`감독이 불렀습니다. "${p.name}, 요즘 많이 안 풀리지? 이대로면 2군에서 다시 다듬고 와야 할 거야."`); crLog(L, `${p.name}, 감독에게 부진 경고를 받았습니다.`); return out; }
  if(dayNo(L) - c.warned >= 3 && rnd(L) < 0.35 + (45 - c.trust) / 100) out.push(...demote(L));
  return out;
}
// 최근 3경기만 보고 살아났는지 (경고를 거둘 때)
function slumpingShort(L){
  const c = C(L), p = myP(L), r = c.recent.slice(-3);
  if(isPit(p)){ const out = r.reduce((a, x) => a + (x.out || 0), 0), run = r.reduce((a, x) => a + (x.r || 0), 0); return !(out >= 3 && run * 27 / out < 4.5); }
  const ab = r.reduce((a, x) => a + (x.ab || 0), 0), h = r.reduce((a, x) => a + (x.h || 0), 0);
  return !(ab >= 6 && h / ab >= 0.3);
}
// 2군으로 내려감: 원래 자리는 2군에서 올라온 선수가 맡음 (명단 크기·타순 그대로)
function demote(L){
  const c = C(L), p = myP(L), T = L.teams[L.my], S = STYLES[teamInfo(L.my).style];
  let up;
  if(isPit(p)){
    const list = p.role === '선발' ? T.sp : T.rp, i = list.indexOf(p); if(i < 0) return [];
    up = leaguePlayer(makePitcher(L, S, p.role === '선발', -2), p.role === '마무리' ? '불펜' : p.role);
    if(p.role === '마무리'){ const best = T.rp.filter(x => x !== p).sort((a, b) => ratingPit(b) - ratingPit(a))[0]; if(best) best.role = '마무리'; p.role = '불펜'; }
    list[i] = up;
  } else {
    const i = T.bat.indexOf(p); if(i < 0) return [];
    up = leaguePlayer(makeBatter(L, S, i, -2)); up.pos = p.pos; T.bat[i] = up;
  }
  up.age = 21 + Math.floor(rnd(L) * 6); up.rookie = true;
  c.p = p; c.where = 'minor'; c.downUntil = dayNo(L) + 7; c.recent = []; delete c.warned; c.trust = Math.max(c.trust, 40);
  crLog(L, `${p.name}, 부진으로 2군에 내려갔습니다.`);
  return [`2군으로 내려가게 되었습니다. 대신 2군의 ${up.name} 선수가 올라갑니다. 퓨처스리그에서 다시 다듬고 돌아옵시다!`];
}
// 강등된 뒤 7일은 승격하지 않음 (promote에서 부름)
const promoteBlocked = L => { const c = C(L); return !!(c.downUntil && dayNo(L) < c.downUntil); };

/* ---------- 이벤트에 신뢰도·동료 효과 붙이기 ---------- */
// EV_TRUST[이벤트][선택지 번호] = [감독 신뢰도, 동료 관계]
const EV_TRUST = {
  senior: [[1, 3], [0, -1]], fan: [[0, 1], [0, 0]], sponsor: [[-1, 0], [1, 0]], press: [[-1, -1], [1, 1]],
  cold: [[0, 0], [2, 0]], rival: [[1, -2], [0, 2]], coach: [[1, 0], [0, 0]], birthday: [[0, 4], [0, -1]], family: [[0, 0], [0, 1]],
};
// 동료 관계가 좋을 때만 생기는 이벤트
if(typeof EVENTS !== 'undefined'){
  EVENTS.push(
    { id:'dinner', ok: (L, c) => (trustInit(c).mates >= 65), q: () => '동료들이 경기 뒤에 함께 저녁을 먹자고 합니다.', opts:[
      ['함께 가서 이야기 나누기', (L, c, p) => { p.cond = Math.min(2, p.cond + 1); return [`즐거운 저녁이었습니다. 컨디션 ${COND[p.cond]}.`]; }],
      ['일찍 들어가 쉬기', (L, c) => { addFatigue(c, -15); return ['푹 쉬었습니다.']; }]] },
    { id:'secret', ok: (L, c) => (trustInit(c).mates >= 75), q: (L, p) => `친한 선배가 "너한테만 알려 주는 ${isPit(p) ? '투구' : '타격'} 비법이야" 하고 다가옵니다.`, opts:[
      ['비법 배우기', (L, c, p) => { const k = pickOne(L, statKeys(p)); return [`선배의 비법으로 ${ABIL_NAME[k]}이 좋아질 것 같습니다!`, ...grow(L, k, 9)]; }],
      ['고맙지만 내 방식대로', (L, c) => ['정중히 사양했습니다.']]] });
  EV_TRUST.dinner = [[0, 3], [0, -1]]; EV_TRUST.secret = [[0, 2], [0, -1]];
  EVENTS.forEach(e => e.opts.forEach((o, i) => {
    if(o.__t) return;
    const fn = o[1], d = (EV_TRUST[e.id] || [])[i];
    o[1] = (L, c, p) => {
      const out = fn(L, c, p) || [];
      if(d){ if(d[0]) trustAdd(L, d[0]); if(d[1]) matesAdd(L, d[1]);
        const w = [d[0] ? `감독 신뢰도 ${d[0] > 0 ? '+' : ''}${d[0]}` : '', d[1] ? `동료 관계 ${d[1] > 0 ? '+' : ''}${d[1]}` : ''].filter(Boolean).join(', ');
        if(w) out.push(`(${w})`); }
      return out;
    };
    o.__t = true;
  }));
}
