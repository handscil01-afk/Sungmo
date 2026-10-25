'use strict';
/* ===================== 현황판 ===================== */

function boardView(){
  const tot = totalPoints();
  const rows = Object.entries(TEAM).map(([k,E]) => { const t = tally(k);
    return `<tr><td><span class="row nowrap" style="gap:8px"><span style="font-size:22px">${E.icon}</span><b>${esc(E.name)}</b></span></td><td class="num score" style="color:var(--blue)">${t.blue}</td><td class="num score" style="color:var(--red)">${t.red}</td><td class="num sub">${matchesOf(k).length}판</td></tr>`; }).join('');
  const indiv = Object.entries(INDIV).map(([k,E]) => {
    const { list, ties } = standings(k), top = list.filter(x => x.rank<=3);
    return `<div class="card"><div class="row"><h2 class="grow h2" style="margin:0">${E.icon} ${esc(E.name)}</h2><span class="sub">${list.length}명 기록</span></div>
      ${ties.filter(t => !t.resolved).map(t => `<div class="note" style="margin-top:10px">⚠ ${t.total}점 동점: ${t.names.map(esc).join(', ')} → 결승 필요</div>`).join('')}
      ${top.length ? `<table><tbody>${top.map(x => `<tr><td class="rank">${x.rank}</td><td><span class="row nowrap" style="gap:8px">${teamBadge(x.p.team)}<b>${esc(x.p.name)}</b></span></td><td class="num"><span class="score">${x.total}점</span>${x.ftotal!=null?` <span class="sub">(결승 ${x.ftotal})</span>`:''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">아직 기록이 없습니다.</div>'}</div>`;
  }).join('');
  return `<div class="cols half">
    <div class="card"><h2>단체전 승점</h2>
      <div class="totals"><div class="tbox blue"><div class="t">${esc(teamName('blue'))}</div><div class="v">${tot.blue}</div></div><div class="tbox red"><div class="t">${esc(teamName('red'))}</div><div class="v">${tot.red}</div></div></div>
      <table style="margin-top:12px"><thead><tr><th>종목</th><th class="num">${esc(teamShort('blue'))}</th><th class="num">${esc(teamShort('red'))}</th><th class="num">진행</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="sub">한 판 이길 때마다 승점 1점입니다. 다른 기기에서 입력한 결과가 바로 반영됩니다.</p></div>
    <div><h2 style="margin:4px 2px 12px;font-size:20px">개인전 순위 (1~3등)</h2>${indiv}</div></div>`;
}
