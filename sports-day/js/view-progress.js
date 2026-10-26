'use strict';
/* ===================== 운영 현황: 종목별 진행 상태와 남은 시간 =====================
   센터장·사무국장 대행(🧭 운영 현황 역할)이 보는 화면이고, 마스터는 안내판 메뉴의 '진행 현황' 탭에서 같은 화면을 봄.
   남은 시간 = 한 단위(개인전은 사람 한 명, 단체전은 대결 한 판, 줄다리기는 한 판)당 걸린 평균 시간 × 남은 단위 수
   한 단위당 시간은 그 종목 기록을 저장한 시각 순서에서 이웃한 두 기록 사이의 간격을 평균 낸 값.
   15분보다 긴 간격은 쉬는 시간으로 보고 평균에서 뺌. 기록이 2개 이상 있어야 계산할 수 있음 */
const BREAK_MS = 15*60000;

function unitMs(times){
  const ts = times.filter(t => t > 0).sort((a,b) => a-b);
  if(ts.length < 2) return null;
  const gaps = [];
  for(let i = 1; i < ts.length; i++){ const d = ts[i] - ts[i-1]; if(d <= BREAK_MS) gaps.push(d); }
  return gaps.length ? gaps.reduce((s,v) => s+v, 0) / gaps.length : null;
}

function progressData(){
  const ps = people(), ids = new Set(ps.map(p => p.id)), act = ps.filter(p => !isAbsent(p.id));
  const indiv = Object.keys(INDIV).map(ev => {
    const done = act.filter(p => rec(ev,'main',p.id)).length, total = act.length;
    // 본선 기록을 처음 저장한 시각 (고친 시각이 아니라 원래 시각)
    const times = D.indiv.filter(r => r.event===ev && r.round==='main' && !r.deleted && (r.throws||[]).length && ids.has(r.personId)).map(r => r.at || 0);
    return { ev, kind:'indiv', done, total, rem: Math.max(0, total - done), unit: unitMs(times), n: times.length,
      p1: ps.filter(p => rec(ev,'p1',p.id)).length, p2: ps.filter(p => rec(ev,'p2',p.id)).length };
  });
  const team = Object.keys(TEAM).map(ev => {
    const E = TEAM[ev], ms = matchesOf(ev), times = ms.map(m => m.at || 0);
    if(E.mode==='round'){
      const planned = settings().tugRounds || 3;
      return { ev, kind:'round', done: ms.length, total: planned, rem: Math.max(0, planned - ms.length), unit: unitMs(times), n: times.length };
    }
    const all = [...members('blue'), ...members('red')];
    const played = new Set([...Object.keys(plays(ev,'blue')), ...Object.keys(plays(ev,'red'))]);
    const total = all.filter(id => !isAbsent(id) || played.has(id)).length, done = all.filter(id => played.has(id)).length;
    return { ev, kind:'duel', done, total, rem: remainingMatches(ev), unit: unitMs(times), n: times.length };
  });
  // 아직 시작하지 않은 단체전(기록 0~1개)은 기록이 2개 이상인 다른 단체전의 평균 시간으로 추정
  const known = team.filter(e => e.unit != null).map(e => e.unit);
  const avg = known.length ? known.reduce((s,v) => s+v, 0) / known.length : null;
  team.forEach(e => { if(e.unit == null && avg != null){ e.unit = avg; e.est = true; } });
  return { indiv, team };
}

// 한 종목의 남은 시간 상태: done(끝남) / none(명단 없음) / calc(계산 중) / eta(남은 시간 있음)
function progressEta(e, t){
  if(e.kind !== 'round' && e.total === 0) return { st:'none' };
  if(e.rem <= 0) return { st:'done', ms:0 };
  if(e.unit == null) return { st:'calc' };
  const ms = e.unit * e.rem;
  return { st:'eta', ms, end: t + ms, est: !!e.est };
}
const minText = ms => `${Math.max(1, Math.round(ms / 60000))}분`;

function progressView(){
  const t = now(), { indiv, team } = progressData();
  const withEta = list => list.map(e => ({ e, a: progressEta(e, t) }));
  const I = withEta(indiv), T = withEta(team);
  // 개인전은 세 종목을 동시에 하므로 가장 오래 남은 종목, 단체전은 차례로 하므로 남은 시간의 합
  const sumOf = (arr, how) => { const ms = arr.filter(x => x.a.st==='eta').map(x => x.a.ms); return ms.length ? how(ms) : 0; };
  const iMs = sumOf(I, ms => Math.max(...ms)), tMs = sumOf(T, ms => ms.reduce((s,v) => s+v, 0));
  const iCalc = I.some(x => x.a.st==='calc'), tCalc = T.some(x => x.a.st==='calc');
  const fin = L => L.some(x => x.a.st==='done') && L.every(x => x.a.st==='done' || x.a.st==='none');
  const iDone = fin(I), tDone = fin(T);
  const doneN = [...I, ...T].filter(x => x.a.st==='done').length, allN = I.length + T.length;
  const grp = (label, sub, ms, calc, done) => `<div class="pgrp"><small>${label}</small>
      <b>${done ? '완료 ✓' : ms ? `약 ${minText(ms)}` : '계산 중'}</b>
      <span>${done ? '' : ms ? `${hm(t + ms)}쯤 끝${calc ? ' · 일부 계산 중' : ''}` : '기록 2개부터 계산'}</span><em>${sub}</em></div>`;
  const row = ({ e, a }) => {
    const E = EVENTS[e.ev], pct = e.total ? Math.min(100, Math.round(e.done / e.total * 100)) : 0;
    let main, sub = '';
    if(e.kind === 'indiv'){ main = `본선 ${e.done}/${e.total}명`; sub = `연습 1 ${e.p1}명 · 연습 2 ${e.p2}명`; }
    else if(e.kind === 'round'){ main = `${e.done}/${e.total}판`; sub = e.rem ? `남은 판 ${e.rem}` : ''; }
    else { main = `${e.done}/${e.total}명 · 남은 대결 ${e.rem}`; }
    let eta;
    if(a.st === 'done') eta = '<span class="tag ok">완료 ✓</span>';
    else if(a.st === 'none') eta = '<span class="tag">명단 없음</span>';
    else if(a.st === 'calc') eta = '<span class="tag">계산 중(기록 2개부터)</span>';
    else eta = `<span class="tag dark">약 ${minText(a.ms)} 남음 · ${hm(a.end)}쯤 끝</span>${a.est ? ' <span class="sub">(다른 단체전 기준 추정)</span>' : ''}`;
    return `<div class="progcard ${a.st==='done'?'fin':''}" style="--ev:${E.color}">
      <div class="pc-top"><span class="pc-ic">${E.icon}</span><b class="pc-nm">${esc(E.name)}</b><span class="pc-main">${esc(main)}</span></div>
      <div class="progress"><i style="width:${pct}%;background:${E.color}"></i></div>
      <div class="pc-sub">${sub ? `<span class="sub">${esc(sub)}</span>` : ''}<span class="pc-eta">${eta}</span></div></div>`;
  };
  return `<div class="prog">
    <div class="card progsum"><div class="row"><h2 class="grow h2" style="margin:0">🧭 진행 현황</h2><span class="sub">${hm(t)} 기준 · 완료 ${doneN}/${allN} 종목</span></div>
      <div class="pgrps">${grp('개인전', '세 종목 동시 진행', iMs, iCalc, iDone)}${grp('단체전', '종목을 차례로 진행', tMs, tCalc, tDone)}</div>
      <p class="sub">남은 시간은 기록을 저장한 간격의 평균(15분보다 긴 간격은 쉬는 시간으로 보고 뺌)에 남은 사람·대결 수를 곱해 계산합니다. 30초마다 새로 계산합니다.</p></div>
    <h3 class="progh">개인전</h3><div class="progrid">${I.map(row).join('')}</div>
    <h3 class="progh">단체전</h3><div class="progrid">${T.map(row).join('')}</div>
  </div>`;
}
// 지금 이 기기에서 진행 현황 화면이 보이는지 (보일 때만 30초마다 다시 그림)
function progressVisible(){
  if(document.visibilityState !== 'visible' || !store || !UI.me) return false;
  if(D.amMaster) return UI.mtab === 'board' && ITAB.board === 'prog' && !UI.preview && !UI.report;
  const r = myRole();
  return r.role === 'staff' && UI.stab === 'mon';
}
