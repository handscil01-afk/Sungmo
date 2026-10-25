'use strict';
/* ===================== 결과 보고서 (인쇄·PDF 저장용) ===================== */
function reportView(){
  const tot = totalPoints(), w = tot.blue===tot.red ? '' : (tot.blue>tot.red ? 'blue' : 'red');
  const d = new Date(), date = `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
  const teamRows = Object.entries(TEAM).map(([k,E]) => { const t = tally(k);
    return `<tr><td>${E.icon} ${esc(E.name)}</td><td class="num">${t.blue}</td><td class="num">${t.red}</td><td class="num">${t.draw}</td><td class="num">${matchesOf(k).length}</td></tr>`; }).join('');
  const matchTables = Object.entries(TEAM).map(([k,E]) => {
    const ms = matchesOf(k); if(!ms.length) return '';
    return `<h3>${E.icon} ${esc(E.name)}</h3><table class="rt"><thead><tr><th>순번</th>${E.mode==='round'?'':`<th>${esc(teamName('blue'))}</th><th>${esc(teamName('red'))}</th>`}<th>결과</th>${E.mode==='time'?'<th>기록(초)</th>':''}</tr></thead><tbody>
      ${ms.map((m,i) => `<tr><td class="num">${i+1}</td>${E.mode==='round'?'':`<td>${esc(m.blueId?pname(m.blueId):'-')}</td><td>${esc(m.redId?pname(m.redId):'-')}</td>`}
        <td>${m.winner==='draw' ? '무승부' : esc(teamName(m.winner))+' 승'}</td>${E.mode==='time'?`<td>${fmtSec(m.blueTime)} / ${fmtSec(m.redTime)}</td>`:''}</tr>`).join('')}</tbody></table>`;
  }).join('');
  const indivTables = Object.entries(INDIV).map(([k,E]) => {
    const { list, ties } = standings(k), m = optMap(k);
    return `<h3>${E.icon} ${esc(E.name)} <small>${list.length}명 기록</small></h3>
      ${ties.filter(t => !t.resolved).map(t => `<p class="warnp">※ ${t.total}점 동점(${t.names.map(esc).join(', ')})은 결승 기록이 없어 순위를 가리지 못했습니다.</p>`).join('')}
      ${list.length ? `<table class="rt"><thead><tr><th>순위</th><th>이름</th><th>팀</th><th>1~5회</th><th>합계</th><th>결승</th></tr></thead><tbody>
        ${list.map(x => `<tr class="${x.rank<=3?'podium':''}"><td class="num">${x.rank}</td><td>${esc(x.p.name)}</td><td>${esc(teamName(x.p.team))}</td>
          <td>${(x.r.throws||[]).map(t => m[t]?.v ?? 0).join(' · ')}${x.r.dist?` (${x.r.dist}m)`:''}</td><td class="num"><b>${x.total}</b></td><td class="num">${x.ftotal??''}</td></tr>`).join('')}</tbody></table>` : '<p>기록이 없습니다.</p>'}`;
  }).join('');
  const absent = people().filter(p => isAbsent(p.id));
  return `<div class="reportbar noprint"><button class="btn" data-a="reportClose">← 돌아가기</button><span class="grow"></span><button class="btn primary" data-a="print">🖨 인쇄 · PDF 저장</button></div>
  <div class="report">
    <h1>가을운동회 결과 보고서</h1>
    <p class="rmeta">${date} · 참가자 ${people().length}명(${esc(teamName('blue'))} ${members('blue').length}명, ${esc(teamName('red'))} ${members('red').length}명)${absent.length?` · 불참 ${absent.length}명`:''}</p>
    <h2>1. 종합 결과</h2>
    <p class="rbig">${w ? `종합 우승: <b>${esc(teamName(w))}</b>` : '종합 결과: <b>무승부</b>'} (단체전 승점 ${esc(teamName('blue'))} ${tot.blue} : ${tot.red} ${esc(teamName('red'))})</p>
    <table class="rt"><thead><tr><th>종목</th><th>${esc(teamName('blue'))}</th><th>${esc(teamName('red'))}</th><th>무승부</th><th>대결 수</th></tr></thead>
      <tbody>${teamRows}<tr class="sum"><td>합계</td><td class="num">${tot.blue}</td><td class="num">${tot.red}</td><td></td><td></td></tr></tbody></table>
    <h2>2. 개인전 순위</h2>${indivTables}
    <h2>3. 단체전 대결 기록</h2>${matchTables || '<p>기록이 없습니다.</p>'}
    ${absent.length ? `<h2>4. 불참자</h2><p>${absent.map(p => `${esc(p.name)}(${esc(teamShort(p.team))})`).join(', ')}</p>` : ''}
    <p class="rfoot">가을운동회 점수판에서 ${d.toLocaleString('ko-KR')}에 만든 보고서입니다.</p>
  </div>`;
}
