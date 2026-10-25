'use strict';
/* ===================== 종목 화면 (심판·마스터) =====================
   한 화면에 다 넣지 않고, 스크롤 없이 쓰는 '지금 할 일' 화면 + 아래에서 올라오는 목록 창으로 나눔 */

function scoreline(t){
  return `<div class="scoreline">${teamBadge('blue')}<span class="n blue">${t.blue}</span><span class="c">:</span><span class="n red">${t.red}</span>${teamBadge('red')}</div>`;
}
const evProgress = ev => { const ps = people(); return `${ps.filter(p => rec(ev,'main',p.id)).length}/${ps.length}`; };
const evBadge = ev => EVENTS[ev].kind==='indiv' ? evProgress(ev) : (t => `${t.blue}:${t.red}`)(tally(ev));
// 감독 화면 위쪽의 작은 종목 줄 (단체전 종목 고르기)
function eventTabs(list, act='ev', cur=UI.ev, inline=false){
  if(list.length<2) return '';
  return `<div class="tabs${inline?' inline':''}">${list.map(ev => { const E = EVENTS[ev];
    return `<button class="evtab ${ev===cur?'on':''}" style="--ev:${E.color}" data-a="${act}" data-v="${ev}"><span class="ic">${E.icon}</span>${esc(E.name)}<small>${evBadge(ev)}</small></button>`; }).join('')}</div>`;
}
function eventView(ev){ return EVENTS[ev].kind==='indiv' ? indivView(ev) : teamView(ev); }

/* ---------- 개인전: 왼쪽·오른쪽 사대(칸)마다 선수를 골라 점수 입력 ---------- */
function lanesOf(ev){
  const n = INDIV[ev].lanes, a = UI.lanes[ev] || [];
  UI.lanes[ev] = Array.from({ length:n }, (_,i) => a[i] || null);
  return UI.lanes[ev];
}
function indivView(ev){
  const E = INDIV[ev], round = UI.round[ev]||'main', ps = people();
  const done = ps.filter(p => rec(ev, round, p.id)).length, pct = ps.length ? Math.round(done/ps.length*100) : 0;
  const lanes = lanesOf(ev), sel = Math.min(UI.laneSel[ev]||0, E.lanes-1);
  const info = `<div class="infobar"><div class="grow"><b>${round==='final'?'결승':'본경기'} ${done}/${ps.length}명</b><div class="progress"><i style="width:${pct}%"></i></div></div>
    <div class="seg sm"><button class="${round==='main'?'on':''}" data-a="round" data-v="main">본경기</button><button class="${round==='final'?'on':''}" data-a="round" data-v="final">결승</button></div>
    <button class="btn small" data-a="indivList">📋<span class="bl"> 명단·순위</span></button></div>`;
  const tabs = E.lanes>1 ? `<div class="lanetabs">${lanes.map((L,i) => `<button class="lanetab ${i===sel?'on':''}" data-a="laneSel" data-v="${i}">
      <small>${esc(LANE_LABELS[ev][i])}</small><b>${L ? esc(pname(L.pid)) : '선수 고르기'}</b><span>${L ? `${totalOf(ev,L.throws)}점 · ${L.throws.length}/${E.count}` : '비어 있음'}</span></button>`).join('')}</div>` : '';
  return `<div class="fit">${info}${tabs}<div class="lanes">${lanes.map((L,i) => laneBox(ev, E, L, i, i===sel)).join('')}</div></div>`;
}
function laneBox(ev, E, L, i, sel){
  const label = (LANE_LABELS[ev]||[])[i] || '';
  if(!L) return `<div class="lanebox empty ${sel?'sel':''}"><button class="bigpick" data-a="pickFor" data-v="${i}"><span class="plus">＋</span><b>${esc(label)} 선수 고르기</b><span>안 한 사람부터 보여 줍니다</span></button></div>`;
  const t = totalOf(ev, L.throws), m = optMap(ev), opts = E.opts(settings()), full = L.throws.length >= E.count;
  const slots = Array.from({ length:E.count }, (_,k) => { const key = L.throws[k];
    return key!=null ? `<button class="slot filled" data-a="unslot" data-i="${i}" data-k="${k}"><span class="p">${m[key]?.v ?? 0}</span><span class="l">${esc(m[key]?.l||'')}</span></button>`
      : `<div class="slot"><span class="n">${k+1}</span></div>`; }).join('');
  return `<div class="lanebox ${sel?'sel':''}">
    <div class="lhead">${teamBadge(teamOf(L.pid), true)}<button class="nm" data-a="pickFor" data-v="${i}">${esc(pname(L.pid))} <small>▾</small></button>
      ${L.round==='final'?'<span class="tag warn">결승</span>':''}${L.existing?'<span class="tag warn">수정</span>':''}<span class="total">${t}점</span>
      <button class="xbtn" data-a="dropLane" data-i="${i}" aria-label="빼기">✕</button></div>
    ${ev==='archery' ? `<div class="row nowrap"><span class="sub">거리</span><div class="seg sm"><button class="${L.dist==='2.5'?'on':''}" data-a="dist" data-i="${i}" data-v="2.5">2.5m</button><button class="${L.dist==='3'?'on':''}" data-a="dist" data-i="${i}" data-v="3">3m</button></div></div>` : ''}
    <div class="slots">${slots}</div>
    <div class="opts n${opts.length}">${opts.map(([k,l,v]) => `<button class="opt" data-a="throw" data-i="${i}" data-k="${k}" ${full?'disabled':''}><b>${v}</b><span>${esc(l)}</span></button>`).join('')}</div>
    <div class="lacts"><button class="btn" data-a="undoThrow" data-i="${i}" ${L.throws.length?'':'disabled'}>↩ 한 칸 지우기</button><button class="btn ${full?'ok':'primary'} grow" data-a="saveLane" data-i="${i}">${L.existing?'수정 저장':'저장'} (${L.throws.length}/${E.count})</button></div>
  </div>`;
}
// 선수 고르기 창: 안 한 사람 먼저 / 가나다 / 팀별
const PK = { ev:null, lane:0, sort:'todo', q:'' };
function indivPickRows(){
  const ev = PK.ev, round = UI.round[ev]||'main', q = PK.q.trim();
  const inLane = new Map(lanesOf(ev).map((L,i) => [L && L.pid, i]).filter(x => x[0]));
  let list = people().filter(p => !q || p.name.includes(q));
  const tOrd = p => p.team==='blue' ? 0 : p.team==='red' ? 1 : 2;
  if(PK.sort==='todo') list.sort((a,b) => (!!rec(ev,round,a.id) - !!rec(ev,round,b.id)) || (isAbsent(a.id) - isAbsent(b.id)) || byName(a,b));
  else if(PK.sort==='team') list.sort((a,b) => tOrd(a)-tOrd(b) || byName(a,b));
  return list.map(p => {
    const r = rec(ev, round, p.id), li = inLane.get(p.id);
    const st = li!=null ? `<span class="tag warn">${esc(LANE_LABELS[ev][li])} 입력 중</span>` : r ? `<span class="tag ok">✓ ${totalOf(ev,r.throws)}점</span>` : isAbsent(p.id) ? '<span class="tag red">불참</span>' : '<span class="tag">아직</span>';
    return `<div class="item tap ${r?'done':''}" data-a="pickPerson" data-v="${p.id}">${teamBadge(p.team)}<span class="name">${esc(p.name)}</span>${st}</div>`;
  }).join('') || `<div class="empty">${people().length ? '해당하는 사람이 없습니다.' : '명단이 비어 있습니다. 마스터가 명단을 먼저 넣어 주세요.'}</div>`;
}
function indivPickSheet(){
  const ev = PK.ev, E = INDIV[ev];
  return `<h2>${E.icon} ${esc((LANE_LABELS[ev]||[])[PK.lane]||'')} 선수 고르기</h2>
    <div class="row nowrap" style="margin-bottom:10px"><input id="pkq" data-in="pkq" placeholder="이름 검색" value="${esc(PK.q)}" autocomplete="off">
      <div class="seg sm">${[['todo','안 한 사람 먼저'],['name','가나다'],['team','팀별']].map(([k,l]) => `<button class="${PK.sort===k?'on':''}" data-a="pkSort" data-v="${k}">${l}</button>`).join('')}</div></div>
    <div class="list sheetlist" id="pkRows">${indivPickRows()}</div>
    <p class="sub">이미 기록이 있는 사람을 고르면 그 기록을 고칠 수 있습니다.</p>
    <button class="btn wide" data-a="closeSheet">닫기</button>`;
}
// 명단·순위 창
let ilTab = 'list';
function indivListSheet(){
  const ev = UI.ev, E = INDIV[ev], round = UI.round[ev]||'main';
  const body = ilTab==='rank' ? indivRank(ev) : `<div class="list sheetlist">${people().map(p => { const r = rec(ev, round, p.id);
      return `<div class="item tap" data-a="editRec" data-v="${p.id}">${teamBadge(p.team)}<span class="name">${esc(p.name)}</span>${r ? `<span class="tag ok">✓ ${totalOf(ev,r.throws)}점</span>` : isAbsent(p.id) ? '<span class="tag red">불참</span>' : '<span class="tag">아직</span>'}</div>`; }).join('') || '<div class="empty">명단이 비어 있습니다.</div>'}</div>`;
  return `<h2>${E.icon} ${esc(E.name)}</h2>
    <div class="seg" style="margin-bottom:12px"><button class="${ilTab==='list'?'on':''}" data-a="ilTab" data-v="list">명단 (가나다)</button><button class="${ilTab==='rank'?'on':''}" data-a="ilTab" data-v="rank">순위</button></div>
    ${body}<button class="btn primary wide" data-a="closeSheet" style="margin-top:12px">닫기</button>`;
}
function indivRank(ev){
  const { list, ties } = standings(ev), m = optMap(ev);
  let html = '';
  ties.forEach(t => {
    html += t.resolved
      ? `<div class="okline">${t.total}점 동점(${t.names.map(esc).join(', ')})은 결승으로 순위가 정해졌습니다.</div>`
      : `<div class="note">⚠ ${t.total}점 동점: ${t.names.map(esc).join(', ')} → 결승 필요</div>`;
  });
  const rows = list.map(x => `<tr class="tap" data-a="editRec" data-v="${x.p.id}">
    <td class="rank">${x.rank}</td>
    <td><span class="row nowrap" style="gap:8px">${teamBadge(x.p.team)}<b>${esc(x.p.name)}</b>${x.r.dist?` <span class="sub">${x.r.dist}m</span>`:''}</span>
      <div class="sub">${(x.r.throws||[]).map(k => m[k]?.v ?? 0).join(' · ')} · ${esc(x.r.editedBy||x.r.by||'')} ${hm(x.r.editedAt||x.r.at)}</div></td>
    <td class="num"><span class="score">${x.total}</span>${x.ftotal!=null?`<div class="sub">결승 ${x.ftotal}</div>`:''}</td></tr>`).join('');
  return html + (list.length ? `<table><thead><tr><th>순위</th><th>이름</th><th class="num">점수</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="sub">줄을 누르면 그 기록을 ${can.record(ev)?'고치거나 지울':'자세히 볼'} 수 있습니다.</p>` : '<div class="empty">아직 기록이 없습니다.</div>');
}
function recSheet(ev, pid){
  const E = INDIV[ev], m = optMap(ev), editable = can.record(ev);
  const part = round => {
    const r = rec(ev, round, pid);
    if(!r) return `<div class="card"><b>${round==='main'?'본경기':'결승'}</b> <span class="sub">기록 없음</span>${editable?` <button class="btn small" data-a="reopen" data-v="${round}" data-p="${pid}">입력하기</button>`:''}</div>`;
    const hist = (r.history||[]).slice(-5).reverse().map(h => `<div class="sub">· ${hm(h.at)} ${esc(h.by)}: ${(h.throws||[]).map(k => m[k]?.v ?? 0).join(' · ')}</div>`).join('');
    return `<div class="card"><div class="row"><b class="grow" style="font-size:20px">${round==='main'?'본경기':'결승'} ${totalOf(ev,r.throws)}점</b>
      ${editable?`<button class="btn small" data-a="reopen" data-v="${round}" data-p="${pid}">고치기</button><button class="btn small danger" data-a="delRec" data-v="${round}" data-p="${pid}">지우기</button>`:''}</div>
      <div class="sub" style="margin-top:6px">${(r.throws||[]).map(k => `${m[k]?.v ?? 0}(${esc(m[k]?.l||'')})`).join(' · ')}</div>
      <div class="sub">입력 ${esc(r.by)} ${hm(r.at)}${r.editedBy?` · 수정 ${esc(r.editedBy)} ${hm(r.editedAt)}`:''}</div>
      ${hist?`<div style="margin-top:8px"><b class="sub">이전 기록</b>${hist}</div>`:''}</div>`;
  };
  return `<h2 class="row">${teamBadge(teamOf(pid))} ${esc(pname(pid))} · ${esc(E.name)}</h2>${part('main')}${part('final')}<button class="btn wide" data-a="closeSheet">닫기</button>`;
}

/* ---------- 단체전: 지금 경기 한 화면 (선수 카드를 누르면 선수 고르기) ---------- */
function teamView(ev){
  const E = TEAM[ev], t = tally(ev), editable = can.record(ev), n = matchesOf(ev).length + 1;
  const info = `<div class="infobar"><b>${E.mode==='round' ? `${n}판째` : `${n}번째 대결`}</b>${scoreline(t)}<span class="grow"></span>
    ${D.amMaster && ORDER_EVENTS.includes(ev) ? '<button class="btn small" data-a="sub" data-v="order">✏️<span class="bl"> 순서</span></button>' : ''}
    <button class="btn small" data-a="listSheet">📋<span class="bl"> 기록</span></button></div>`;
  const winBtns = editable ? `<div class="winrow"><button class="btn blue huge" data-a="win" data-v="blue">${esc(teamName('blue'))} 승</button><button class="btn red huge" data-a="win" data-v="red">${esc(teamName('red'))} 승</button></div>
    <button class="btn small wide" data-a="win" data-v="draw">무승부</button>` : '';
  if(E.mode==='round') return `<div class="fit">${info}<div class="roundbig"><b>${n}판째</b><span class="sub">${esc(E.hint)}${t.draw?` · 무승부 ${t.draw}판`:''}</span></div>${winBtns}</div>`;
  const b = upNext(ev,'blue'), r = upNext(ev,'red'), small = E.mode==='time';
  const duel = `<div class="duel ${small?'small':''}">${pcard(ev,'blue',b,editable)}<div class="vsm">VS</div>${pcard(ev,'red',r,editable)}</div>`;
  const next = `<div class="nextbar"><span class="sub">다음</span><span class="who">${teamBadge('blue')}<b>${b.next?esc(pname(b.next)):'-'}</b></span><span class="sub">vs</span><span class="who">${teamBadge('red')}<b>${r.next?esc(pname(r.next)):'-'}</b></span>
    <span class="grow"></span>${editable?'<button class="btn small" data-a="callSheet">📣<span class="bl"> 부르기</span></button>':''}</div>`;
  if(!editable) return `<div class="fit">${info}${duel}${next}</div>`;
  if(E.mode==='time'){
    const rt = runTimesOf(ev), tm = (D.calls[ev]||{}).times || {};
    const tin = (team, id) => `<div class="tcell">${teamBadge(team)}<input class="timein" id="${id}" inputmode="decimal" data-in="rt" data-t="${team}" value="${esc(rt[team])}" placeholder="초"><button class="btn small ${team}" data-a="watchTo" data-v="${team}">⏱ 넣기</button></div>`;
    return `<div class="fit">${info}${duel}
      <div class="watchrow"><div class="watch" id="watch">0.00</div><button class="btn primary huge" data-a="watchToggle" id="watchBtn">시작</button><button class="btn" data-a="watchReset" aria-label="초기화">↺</button></div>
      <div class="timesrow">${tin('blue','rtBlue')}${tin('red','rtRed')}</div>
      ${tm.blue!=null || tm.red!=null ? `<div class="sub">⏱ 계시원 ${esc(tm.by||'')}이(가) 보낸 기록이 채워졌습니다. 확인 뒤 저장하세요.</div>` : ''}
      <button class="btn ok huge" data-a="saveRun">기록 비교해서 저장</button>${next}</div>`;
  }
  return `<div class="fit">${info}${duel}${next}${winBtns}</div>`;
}
function pcard(ev, team, u, editable){
  const id = u.cur, ord = orderFor(ev, team), pl = plays(ev, team);
  const inner = `<span class="lbl">${esc(teamName(team))} ${id ? (ord.indexOf(id)+1)+'번' : ''}</span>
    <span class="nm">${id ? esc(pname(id)) : '팀원 없음'}</span>
    <span class="hint">${id && pl[id] ? `${pl[id]+1}번째 출전 · ` : ''}${u.picked ? '직접 고름 · ' : ''}${editable && id ? '눌러서 바꾸기' : ''}</span>`;
  return editable && id ? `<button class="pcard ${team}" data-a="pickSheet" data-v="${team}">${inner}</button>` : `<div class="pcard ${team}">${inner}</div>`;
}
function callSheet(){
  const ev = UI.ev, b = upNext(ev,'blue'), r = upNext(ev,'red');
  return `<h2>📣 안내판으로 부르기</h2>
    <button class="btn huge wide" data-a="callPlayers" data-v="now" style="width:100%;margin-bottom:10px">지금 선수 다시 부르기<br><small>${esc(b.cur?pname(b.cur):'-')} · ${esc(r.cur?pname(r.cur):'-')}</small></button>
    <button class="btn huge wide" data-a="callPlayers" data-v="next" style="width:100%;margin-bottom:10px">다음 선수 부르기<br><small>${esc(b.next?pname(b.next):'-')} · ${esc(r.next?pname(r.next):'-')}</small></button>
    <button class="btn wide" data-a="closeSheet">닫기</button>`;
}
function winTag(w){
  return w==='blue' ? `<span class="tag blue">${esc(teamShort('blue'))} 승</span>` : w==='red' ? `<span class="tag red">${esc(teamShort('red'))} 승</span>` : '<span class="tag">무승부</span>';
}
function matchRow(ev, m, no){
  const E = TEAM[ev];
  const who = E.mode==='round' ? `${no}판째` : `${esc(m.blueId?pname(m.blueId):'-')} <span class="sub" style="display:inline">vs</span> ${esc(m.redId?pname(m.redId):'-')}`;
  const tm = E.mode==='time' ? ` <span class="sub" style="display:inline">${fmtSec(m.blueTime)}초 / ${fmtSec(m.redTime)}초</span>` : '';
  return `<div class="item ${can.record(ev)?'tap':''}" ${can.record(ev)?`data-a="editMatch" data-v="${m.id}"`:''}><span class="no tag">${no}</span>
    <span class="name">${who}${tm}<span class="sub">${esc(m.editedBy||m.by||'')} ${hm(m.editedAt||m.at)}</span></span>${winTag(m.winner)}</div>`;
}
let listTab = 'order';
function listSheet(){
  const ev = UI.ev, E = TEAM[ev];
  let body;
  if(listTab==='order' && E.mode!=='round'){
    body = `<div class="cols half">${TEAM_KEYS.map(team => {
      const u = upNext(ev, team), pl = plays(ev, team), ord = orderFor(ev, team);
      const done = ord.filter(id => pl[id]).length;
      return `<div class="card"><div class="row"><h2 class="grow row h2" style="margin:0">${teamBadge(team)} ${esc(teamName(team))}</h2><span class="sub">${done}/${ord.length}명 출전</span></div>
        <div class="list olist">${ord.map((id,i) => `<div class="item ${id===u.cur?'cur':''} ${pl[id]?'done':''}"><span class="no">${i+1}</span><span class="name">${esc(pname(id))}</span>
          ${id===u.cur?'<span class="tag dark">지금</span>':id===u.next?'<span class="tag warn">다음</span>':''}${pl[id]?`<span class="tag ok">✓ ${pl[id]}회</span>`:''}${isAbsent(id)?'<span class="tag red">불참</span>':''}</div>`).join('') || '<div class="empty">팀원이 없습니다.</div>'}</div></div>`;
    }).join('')}</div>`;
  } else {
    const ms = matchesOf(ev).slice().reverse();
    body = `<div class="card">${ms.length ? `<div class="list">${ms.map((m,i) => matchRow(ev, m, ms.length-i)).join('')}</div>${can.record(ev)?'<p class="sub">줄을 누르면 결과를 고치거나 지울 수 있습니다.</p>':''}` : '<div class="empty">아직 기록이 없습니다.</div>'}</div>`;
  }
  return `<h2>${E.icon} ${esc(E.name)} 명단 · 기록</h2>
    ${E.mode!=='round'?`<div class="seg" style="margin-bottom:14px"><button class="${listTab==='rec'?'on':''}" data-a="listTab" data-v="rec">경기 기록</button><button class="${listTab==='order'?'on':''}" data-a="listTab" data-v="order">출전 명단</button></div>`:''}
    ${body}<button class="btn primary wide" data-a="closeSheet">닫기</button>`;
}
// 단체전 선수 고르기 창: 순서대로 / 안 한 사람 먼저 / 가나다
let pickTeam = 'blue', pickSort = 'order';
function pickSheet(){
  const ev = UI.ev, ord = orderFor(ev, pickTeam), pl = plays(ev, pickTeam), u = upNext(ev, pickTeam);
  let list = ord.map((id,i) => ({ id, i, n:pl[id]||0, name:pname(id) }));
  if(pickSort==='todo') list.sort((a,b) => a.n-b.n || (isAbsent(a.id)-isAbsent(b.id)) || a.i-b.i);
  if(pickSort==='name') list.sort(byName);
  return `<h2 class="row">${teamBadge(pickTeam)} ${esc(teamName(pickTeam))} 선수 고르기</h2>
    <div class="seg sm" style="margin-bottom:10px">${[['order','순서대로'],['todo','안 한 사람 먼저'],['name','가나다']].map(([k,l]) => `<button class="${pickSort===k?'on':''}" data-a="pickSort" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="list olist sheetlist">${list.map(x => `<div class="item tap ${x.id===u.cur?'cur':''} ${x.n?'done':''}" data-a="setPick" data-v="${x.id}"><span class="no">${x.i+1}</span><span class="name">${esc(x.name)}</span>${x.n?`<span class="tag ok">${x.n}회 출전</span>`:''}${isAbsent(x.id)?'<span class="tag red">불참</span>':''}${x.id===u.cur?'<span class="tag dark">지금</span>':''}</div>`).join('') || '<div class="empty">팀원이 없습니다.</div>'}</div>
    <p class="sub">고른 선수는 다른 심판 기기와 안내판에도 바로 반영되고, 결과를 저장하면 다시 순서대로 돌아갑니다.</p>
    <div class="row nowrap"><button class="btn grow" data-a="setPick" data-v="">순서대로 (자동)</button><button class="btn primary grow" data-a="closeSheet">닫기</button></div>`;
}

function matchSheet(id){
  const m = D.matches.find(x => x.id===id); if(!m) return '<p>기록이 없습니다.</p><button class="btn wide" data-a="closeSheet">닫기</button>';
  const E = TEAM[m.event];
  return `<h2>${esc(E.name)} 결과 고치기</h2>
    ${E.mode!=='round'?`<p class="row" style="font-size:20px;font-weight:800">${teamBadge('blue')} ${esc(pname(m.blueId))} <span class="sub">vs</span> ${teamBadge('red')} ${esc(pname(m.redId))}</p>`:''}
    ${E.mode==='time'?`<div class="row" style="margin-bottom:12px"><label class="row">${teamBadge('blue')}<input class="timein" id="emB" inputmode="decimal" value="${m.blueTime??''}"></label><label class="row">${teamBadge('red')}<input class="timein" id="emR" inputmode="decimal" value="${m.redTime??''}"></label>
      <button class="btn small" data-a="emTimes" data-v="${id}">기록 고치기</button></div>`:''}
    <div class="row nowrap"><button class="btn blue grow" data-a="emWin" data-v="${id}" data-w="blue">${esc(teamShort('blue'))} 승</button><button class="btn red grow" data-a="emWin" data-v="${id}" data-w="red">${esc(teamShort('red'))} 승</button><button class="btn grow" data-a="emWin" data-v="${id}" data-w="draw">무승부</button></div>
    <p class="sub">입력 ${esc(m.by)} ${hm(m.at)}${m.editedBy?` · 수정 ${esc(m.editedBy)} ${hm(m.editedAt)}`:''}</p>
    <div class="row nowrap"><button class="btn danger grow" data-a="emDel" data-v="${id}">이 기록 지우기</button><button class="btn primary grow" data-a="closeSheet">닫기</button></div>`;
}

/* ---------- 초시계 ---------- */
let rafId = 0;
function watchVal(){ const w=UI.watch; return (w.acc + (w.running? performance.now()-w.start : 0))/1000; }
function paintWatch(){
  const el = document.getElementById('watch'); if(!el) return;
  el.textContent = watchVal().toFixed(2);
  const b = document.getElementById('watchBtn');
  if(b){ b.textContent = UI.watch.running?'정지':'시작'; b.classList.toggle('red', UI.watch.running); b.classList.toggle('primary', !UI.watch.running); }
}
function tick(){ paintWatch(); if(UI.watch.running) rafId = requestAnimationFrame(tick); }
function stopWatch(){ const w=UI.watch; if(w.running){ w.acc += performance.now()-w.start; w.running=false; cancelAnimationFrame(rafId); } }

/* ---------- 저장 ---------- */
const saveLanes = () => ls.set('udh5_lanes2', UI.lanes);
// i번째 칸(왼쪽·오른쪽 사대)에 선수를 넣음. 이미 다른 칸에 있으면 그 칸을 보여 줌
function addLane(ev, pid, i){
  const lanes = lanesOf(ev), at = lanes.findIndex(L => L && L.pid===pid);
  if(at>=0){ UI.laneSel[ev] = at; return; }
  const round = UI.round[ev]||'main', r = rec(ev, round, pid);
  lanes[i] = { pid, round, throws: r ? [...r.throws] : [], dist: r?.dist || '2.5', existing: !!r };
  UI.laneSel[ev] = i; saveLanes();
}
async function saveLane(ev, i){
  if(!can.record(ev)) return denied();
  const E = INDIV[ev], L = lanesOf(ev)[i]; if(!L) return;
  if(!L.throws.length){ toast('점수가 하나도 입력되지 않았습니다.'); return; }
  if(L.throws.length < E.count && !(await ask(`${E.count}${E.unit} 중 ${L.throws.length}${E.unit}만 입력했습니다.\n이대로 저장할까요?`, '저장'))) return;
  const id = recId(ev, L.round, L.pid), prev = D.indiv.find(r => r.id===id), p = person(L.pid);
  const data = { event:ev, round:L.round, personId:L.pid, personName:p?.name||'', team:p?.team||'', throws:L.throws, deleted:false };
  if(ev==='archery') data.dist = L.dist;
  if(prev && !prev.deleted && (prev.throws||[]).length){
    data.editedBy = UI.me; data.editedAt = now();
    data.history = [...(prev.history||[]), { throws: prev.throws, by: prev.editedBy||prev.by, at: prev.editedAt||prev.at }].slice(-10);
  } else { data.by = UI.me; data.at = now(); data.editedBy = null; data.editedAt = null; }
  put(['main','indiv',id], data);
  lanesOf(ev)[i] = null; saveLanes();
  toast(`${p?.name||''} ${totalOf(ev,data.throws)}점 저장했습니다.`);
}
function saveMatch(ev, winner, extra={}){
  if(!can.record(ev)) return denied();
  const E = TEAM[ev], id = `${ev}_${now()}_${uid()}`;
  let blueId = null, redId = null;
  if(E.mode!=='round'){
    blueId = upNext(ev,'blue').cur; redId = upNext(ev,'red').cur;
    if(!blueId || !redId){ toast('두 팀 모두 팀원이 있어야 합니다. 마스터가 명단에서 팀을 정해 주세요.'); return; }
  }
  put(['main','matches',id], { event:ev, winner, blueId, redId, blueName: blueId?pname(blueId):null, redName: redId?pname(redId):null,
    by:UI.me, at:now(), deleted:false, ...extra });
  const pk = (D.calls[ev]||{}).pick;
  if(pk && (pk.blue || pk.red)) put(['main','calls',ev], { pick:{ blue:null, red:null } });
  const label = winner==='draw' ? '무승부' : `${teamName(winner)} 승`;
  toast(`${label} 저장했습니다.`, '되돌리기', () => put(['main','matches',id], { event:ev, deleted:true, editedBy:UI.me, editedAt:now() }));
}

/* ---------- 동작 ---------- */
Object.assign(ACT, {
  sub: (el, v) => { UI.sub[UI.ev] = v; },
  round: (el, v) => { const ev=UI.ev; if(lanesOf(ev).some(Boolean)){ toast('입력 중인 사람을 먼저 저장하거나 빼 주세요.'); return false; } UI.round[ev]=v; },
  laneSel: (el, v) => { UI.laneSel[UI.ev] = +v; },
  pickFor: (el, v) => { if(!can.record(UI.ev)) return denied(); PK.ev = UI.ev; PK.lane = +v; PK.q = ''; UI.laneSel[UI.ev] = +v; openSheet(indivPickSheet); render(); return false; },
  pkSort: (el, v) => { PK.sort = v; drawSheet(); return false; },
  pickPerson: async (el, v) => {
    const ev = PK.ev, i = PK.lane, L = lanesOf(ev)[i];
    if(!can.record(ev)) return denied();
    if(L && L.pid!==v && L.throws.length && !(await ask(`${pname(L.pid)}의 입력 중인 점수는 저장되지 않습니다.\n다른 선수로 바꿀까요?`, '바꾸기', true))) return false;
    addLane(ev, v, i); closeSheet();
  },
  indivList: () => { ilTab = 'list'; openSheet(indivListSheet); return false; },
  ilTab: (el, v) => { ilTab = v; drawSheet(); return false; },
  callSheet: () => { openSheet(callSheet); return false; },
  pickSort: (el, v) => { pickSort = v; drawSheet(); return false; },
  throw: (el) => { const ev=UI.ev, L=lanesOf(ev)[+el.dataset.i]; if(L && L.throws.length<INDIV[ev].count){ L.throws.push(el.dataset.k); saveLanes(); if(navigator.vibrate) navigator.vibrate(25); } },
  unslot: (el) => { const L=lanesOf(UI.ev)[+el.dataset.i]; L.throws.splice(+el.dataset.k,1); saveLanes(); },
  undoThrow: (el) => { const L=lanesOf(UI.ev)[+el.dataset.i]; L.throws.pop(); saveLanes(); },
  dropLane: async (el) => { const ev=UI.ev, i=+el.dataset.i, L=lanesOf(ev)[i]; if(L.throws.length && !(await ask('입력한 점수를 저장하지 않고 뺄까요?','빼기',true))) return false; lanesOf(ev)[i] = null; saveLanes(); },
  dist: (el, v) => { lanesOf(UI.ev)[+el.dataset.i].dist = v; saveLanes(); },
  saveLane: async (el) => { await saveLane(UI.ev, +el.dataset.i); },
  editRec: (el, v) => { const ev=UI.ev; openSheet(() => recSheet(ev, v)); return false; },
  reopen: (el, v) => { const ev=UI.ev; if(!can.record(ev)) return denied();
    const lanes = lanesOf(ev), free = lanes.findIndex(L => !L), at = lanes.findIndex(L => L && L.pid===el.dataset.p);
    if(at<0 && free<0){ toast('입력 칸이 차 있습니다. 먼저 저장하거나 빼 주세요.'); return false; }
    if(at<0 && (UI.round[ev]||'main')!==v && lanes.some(Boolean)){ toast('입력 중인 사람을 먼저 저장하거나 빼 주세요.'); return false; }
    UI.round[ev]=v; addLane(ev, el.dataset.p, at>=0 ? at : free); closeSheet(); },
  delRec: async (el, v) => { const ev=UI.ev; if(!can.record(ev)) return denied();
    if(!(await ask('이 기록을 지울까요?','지우기',true))) return false;
    const id=recId(ev,v,el.dataset.p), prev=D.indiv.find(r => r.id===id);
    put(['main','indiv',id], { event:ev, deleted:true, editedBy:UI.me, editedAt:now(), history:[...(prev?.history||[]), {throws:prev?.throws||[], by:prev?.editedBy||prev?.by, at:prev?.editedAt||prev?.at}].slice(-10) });
    toast('기록을 지웠습니다.', '되돌리기', () => put(['main','indiv',id], { event:ev, deleted:false })); closeSheet(); },
  win: (el, v) => { saveMatch(UI.ev, v); },
  pickSheet: (el, v) => { pickTeam = v; pickSort = 'order'; openSheet(pickSheet); return false; },
  setPick: (el, v) => { const ev=UI.ev; if(!can.record(ev)) return denied();
    put(['main','calls',ev], { pick:{ [pickTeam]: v || null } }); closeSheet(); },
  callPlayers: (el, v) => { const ev=UI.ev; if(!can.record(ev)) return denied();
    const b = upNext(ev,'blue'), r = upNext(ev,'red'), k = v==='next' ? 'next' : 'cur';
    if(!b[k] || !r[k]){ toast('부를 선수가 없습니다.'); return false; }
    put(['main','calls',ev], { call:{ at:now(), kind:v, blue:b[k], red:r[k], by:UI.me } }); closeSheet();
    toast(`안내판에 ${pname(b[k])} · ${pname(r[k])} 선수를 불렀습니다.`); return false; },
  listSheet: (el, v) => { listTab = v || (TEAM[UI.ev].mode==='round' ? 'rec' : 'order'); openSheet(listSheet); return false; },
  listTab: (el, v) => { listTab = v; drawSheet(); return false; },
  editMatch: (el, v) => { openSheet(() => matchSheet(v)); return false; },
  emWin: (el, v) => { const m=D.matches.find(x => x.id===v); if(!m || !can.record(m.event)) return denied();
    put(['main','matches',v], { event:m.event, winner: el.dataset.w, editedBy:UI.me, editedAt:now() }); toast('결과를 고쳤습니다.'); closeSheet(); },
  emTimes: (el, v) => { const m=D.matches.find(x => x.id===v); if(!m || !can.record(m.event)) return denied();
    const r=parseFloat($('#emR').value), b=parseFloat($('#emB').value);
    if(isNaN(r)||isNaN(b)){ toast('두 기록을 숫자로 적어 주세요.'); return false; }
    put(['main','matches',v], { event:m.event, redTime:r, blueTime:b, winner: r<b?'red': b<r?'blue':'draw', editedBy:UI.me, editedAt:now() }); toast('기록을 고쳤습니다.'); closeSheet(); },
  emDel: async (el, v) => { const m=D.matches.find(x => x.id===v); if(!m || !can.record(m.event)) return denied();
    if(!(await ask('이 대결 기록을 지울까요?','지우기',true))) return false;
    put(['main','matches',v], { event:m.event, deleted:true, editedBy:UI.me, editedAt:now() });
    toast('기록을 지웠습니다.', '되돌리기', () => put(['main','matches',v], { event:m.event, deleted:false })); closeSheet(); },
  watchToggle: () => { const w=UI.watch; if(w.running){ stopWatch(); paintWatch(); } else { w.start=performance.now(); w.running=true; tick(); } if(navigator.vibrate) navigator.vibrate(40); return false; },
  watchReset: () => { stopWatch(); UI.watch.acc=0; paintWatch(); return false; },
  watchTo: (el, v) => { stopWatch(); const val = Math.round(watchVal()*100)/100; if(!val){ toast('초시계 기록이 없습니다.'); return false; }
    (UI.runTimes[UI.ev] ||= {})[v] = val; UI.watch.acc=0; },
  saveRun: () => { const ev=UI.ev, rt=runTimesOf(ev), r=parseFloat(rt.red), b=parseFloat(rt.blue);
    if(isNaN(r)||isNaN(b)){ toast('두 팀 기록을 모두 넣어 주세요.'); return false; }
    saveMatch(ev, r<b?'red': b<r?'blue':'draw', { redTime:r, blueTime:b }); UI.runTimes[ev]={};
    if((D.calls[ev]||{}).times) put(['main','calls',ev], { times:null }); },
  sendTime: (el, v) => { const ev=UI.ev; if(!can.time(ev)) return denied();
    stopWatch(); const val = Math.round(watchVal()*100)/100; if(!val){ toast('초시계 기록이 없습니다.'); return false; }
    put(['main','calls',ev], { times:{ [v]:val, by:UI.me, at:now() } }); UI.watch.acc = 0;
    toast(`${teamName(v)} ${val.toFixed(2)}초를 심판 화면으로 보냈습니다.`); },
  clearTimes: () => { const ev=UI.ev; if(!can.time(ev)) return denied(); put(['main','calls',ev], { times:null }); },
});
// 심판이 직접 적은 기록이 없으면 계시원이 보낸 기록을 씀
function runTimesOf(ev){ const tm = (D.calls[ev]||{}).times || {}, rt = UI.runTimes[ev] || {}; return { blue: rt.blue ?? tm.blue ?? '', red: rt.red ?? tm.red ?? '' }; }

/* ---------- 계시원 화면 ---------- */
function timerView(ev){
  const b = upNext(ev,'blue'), r = upNext(ev,'red'), tm = (D.calls[ev]||{}).times || {};
  return `<div class="fit">
    <div class="infobar"><b>⏱ 계시 · ${matchesOf(ev).length+1}번째 대결</b>${scoreline(tally(ev))}</div>
    <div class="duel small">${pcard(ev,'blue',b,false)}<div class="vsm">VS</div>${pcard(ev,'red',r,false)}</div>
    <div class="watch huge" id="watch">0.00</div>
    <div class="row nowrap"><button class="btn primary huge" data-a="watchToggle" id="watchBtn">시작</button><button class="btn" data-a="watchReset" aria-label="초기화" style="min-width:80px">↺</button></div>
    <div class="winrow"><button class="btn blue huge" data-a="sendTime" data-v="blue">→ ${esc(teamShort('blue'))} 보내기</button><button class="btn red huge" data-a="sendTime" data-v="red">→ ${esc(teamShort('red'))} 보내기</button></div>
    <div class="nextbar"><span class="sub">보낸 기록</span><span class="who">${teamBadge('blue')}<b>${tm.blue!=null ? fmtSec(tm.blue)+'초' : '-'}</b></span><span class="who">${teamBadge('red')}<b>${tm.red!=null ? fmtSec(tm.red)+'초' : '-'}</b></span>
      <span class="grow"></span>${tm.blue!=null || tm.red!=null ? '<button class="btn small" data-a="clearTimes">지우기</button>' : ''}</div>
  </div>`;
}
