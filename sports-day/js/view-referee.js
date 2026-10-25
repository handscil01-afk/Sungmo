'use strict';
/* ===================== 종목 화면 (심판·마스터) ===================== */

function evHead(ev, right=''){
  const E = EVENTS[ev];
  return `<div class="evhead" style="--ev:${E.color}"><span class="ic">${E.icon}</span>
    <div class="grow"><h2>${esc(E.name)}</h2><p>${esc(E.hint)}</p></div>${right}</div>`;
}
function scoreline(t){
  return `<div class="scoreline">${teamBadge('blue')}<span class="n blue">${t.blue}</span><span class="c">:</span><span class="n red">${t.red}</span>${teamBadge('red')}</div>`;
}
// 종목 탭: 역할마다 볼 수 있는 종목만
function eventTabs(list){
  if(list.length<2) return '';
  let html = '', grp = '';
  list.forEach(ev => {
    const E = EVENTS[ev];
    if(list.some(k => EVENTS[k].kind!==E.kind) && grp!==E.kind){ grp = E.kind; html += `<span class="grp">${E.kind==='indiv'?'개인전':'단체전'}</span>`; }
    let badge;
    if(E.kind==='indiv'){ const ps = people(); badge = `${ps.filter(p => rec(ev,'main',p.id)).length}/${ps.length}`; }
    else { const t = tally(ev); badge = `${t.blue}:${t.red}`; }
    html += `<button class="evtab ${ev===UI.ev?'on':''}" style="--ev:${E.color}" data-a="ev" data-v="${ev}"><span class="ic">${E.icon}</span>${esc(E.name)}<small>${badge}</small></button>`;
  });
  return `<div class="tabs">${html}</div>`;
}
function eventView(ev){ return EVENTS[ev].kind==='indiv' ? indivView(ev) : teamView(ev); }

/* ---------- 개인전 ---------- */
function indivView(ev){
  const E = INDIV[ev], sub = UI.sub[ev]||'enter', round = UI.round[ev]||'main';
  const editable = can.record(ev);
  let h = evHead(ev, `<div class="seg"><button class="${sub==='enter'?'on':''}" data-a="sub" data-v="enter">${editable?'기록 입력':'명단'}</button><button class="${sub==='rank'?'on':''}" data-a="sub" data-v="rank">순위</button></div>`);
  if(sub==='rank') return h + indivRank(ev);
  const ps = people(), done = ps.filter(p => rec(ev,'main',p.id)).length;
  h += `<div class="card"><div class="row"><b class="grow" style="font-size:20px">본경기 ${done} / ${ps.length}명 완료</b>
      ${editable?`<div class="seg"><button class="${round==='main'?'on':''}" data-a="round" data-v="main">본경기</button><button class="${round==='final'?'on':''}" data-a="round" data-v="final">결승</button></div>`:''}</div>
    <div class="progress" style="margin-top:10px"><i style="width:${ps.length?Math.round(done/ps.length*100):0}%"></i></div>
    ${round==='final'?'<div class="note" style="margin:12px 0 0">결승 기록은 동점자 순위를 가리는 데만 씁니다.</div>':''}</div>`;
  const lanes = editable ? (UI.lanes[ev]||[]) : [];
  const lanesHtml = lanes.map((L,i) => laneView(ev, E, L, i)).join('')
    || (editable ? `<div class="card empty">명단에서 이름을 누르면 기록 입력 칸이 열립니다.${E.lanes>1?`<br>${E.lanes}명까지 동시에 입력할 수 있습니다.`:''}</div>` : '');
  return h + `<div class="cols half"><div>${lanesHtml}</div><div>${pickList(ev, round, editable)}</div></div>`;
}
function laneView(ev, E, L, i){
  const t = totalOf(ev, L.throws), m = optMap(ev), opts = E.opts(settings());
  const full = L.throws.length >= E.count;
  const slots = Array.from({length:E.count}, (_,k) => {
    const key = L.throws[k];
    return key!=null
      ? `<button class="slot filled" data-a="unslot" data-i="${i}" data-k="${k}"><span class="p">${m[key]?.v ?? 0}</span><span class="l">${esc(m[key]?.l||'')}</span></button>`
      : `<div class="slot"><span class="n">${k+1}</span></div>`;
  }).join('');
  return `<div class="lane">
    <div class="head">${teamBadge(teamOf(L.pid), true)}<span class="nm">${esc(pname(L.pid))}</span><span class="total">${t}점</span></div>
    <div class="row" style="margin:-4px 0 10px"><span class="tag">${esc((LANE_LABELS[ev]||[])[i]||'')}</span><span class="tag ${L.round==='final'?'warn':''}">${L.round==='final'?'결승':'본경기'}</span>
      ${ev==='archery' ? `<span class="grow"></span><span class="sub">거리</span><div class="seg"><button class="${L.dist==='2.5'?'on':''}" data-a="dist" data-i="${i}" data-v="2.5">2.5m</button><button class="${L.dist==='3'?'on':''}" data-a="dist" data-i="${i}" data-v="3">3m</button></div>`:''}</div>
    <div class="slots">${slots}</div>
    <div class="opts">${opts.map(([k,l,v]) => `<button class="opt" data-a="throw" data-i="${i}" data-k="${k}" ${full?'disabled style="opacity:.35"':''}><b>${v}</b><span>${esc(l)}</span></button>`).join('')}</div>
    <div class="row" style="margin-top:12px">
      <button class="btn small" data-a="undoThrow" data-i="${i}">한 칸 지우기</button>
      <button class="btn small" data-a="dropLane" data-i="${i}">빼기</button>
      <span class="grow"></span>
      <button class="btn ${full?'ok':'primary'}" data-a="saveLane" data-i="${i}">${L.existing?'수정 저장':'저장'} (${L.throws.length}/${E.count})</button>
    </div>
    <div class="sub" style="margin-top:8px">점수 버튼을 누르면 앞 칸부터 채워집니다. 채워진 칸을 누르면 그 칸이 지워집니다.</div>
  </div>`;
}
function pickRows(ev, round, editable){
  const ps = people(), q = UI.q.trim();
  const inLane = new Set((UI.lanes[ev]||[]).map(L => L.pid));
  let list = ps.filter(p => !q || p.name.includes(q));
  if(UI.filter==='blue' || UI.filter==='red') list = list.filter(p => p.team===UI.filter);
  if(UI.filter==='todo') list = list.filter(p => !rec(ev,round,p.id));
  if(UI.filter==='done') list = list.filter(p => rec(ev,round,p.id));
  const rows = list.map(p => {
    const r = rec(ev, round, p.id);
    const st = editable && inLane.has(p.id) ? '<span class="tag warn">입력 중</span>'
      : r ? `<span class="tag ok">✓ ${totalOf(ev,r.throws)}점</span>` : '<span class="tag">미입력</span>';
    return `<div class="item tap" data-a="pick" data-v="${p.id}">${teamBadge(p.team)}<span class="name">${esc(p.name)}</span>${st}</div>`;
  }).join('');
  return rows || `<div class="empty">${ps.length ? '해당하는 사람이 없습니다.' : '명단이 비어 있습니다. 마스터가 명단을 먼저 넣어 주세요.'}</div>`;
}
function pickList(ev, round, editable){
  const f = [['all','전체'],['todo','미입력'],['done','완료'],['blue',teamName('blue')],['red',teamName('red')]];
  return `<div class="card">
    <div class="row"><h2 class="grow h2" style="margin:0">명단 <span class="sub">가나다순</span></h2></div>
    <div style="height:10px"></div>
    <input id="q" placeholder="이름 검색" value="${esc(UI.q)}" autocomplete="off" data-in="q">
    <div class="chips" style="margin:10px 0 4px">${f.map(([k,l]) => `<button class="chip ${UI.filter===k?'on':''}" data-a="filter" data-v="${k}">${esc(l)}</button>`).join('')}</div>
    <div class="list" id="pickRows">${pickRows(ev, round, editable)}</div>
  </div>`;
}
function indivRank(ev){
  const { list, ties } = standings(ev), m = optMap(ev), E = INDIV[ev];
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
  return html + `<div class="card"><h2>${esc(E.name)} 순위</h2>
    ${list.length ? `<table><thead><tr><th>순위</th><th>이름</th><th class="num">점수</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="sub">줄을 누르면 그 기록을 ${can.record(ev)?'고치거나 지울':'자세히 볼'} 수 있습니다.</p>` : '<div class="empty">아직 기록이 없습니다.</div>'}</div>`;
}
function recSheet(ev, pid){
  const E = INDIV[ev], m = optMap(ev), editable = can.record(ev);
  const part = round => {
    const r = rec(ev, round, pid);
    if(!r) return `<div class="card"><b>${round==='main'?'본경기':'결승'}</b> <span class="sub">기록 없음</span></div>`;
    const hist = (r.history||[]).slice(-5).reverse().map(h => `<div class="sub">· ${hm(h.at)} ${esc(h.by)}: ${(h.throws||[]).map(k => m[k]?.v ?? 0).join(' · ')}</div>`).join('');
    return `<div class="card"><div class="row"><b class="grow" style="font-size:20px">${round==='main'?'본경기':'결승'} ${totalOf(ev,r.throws)}점</b>
      ${editable?`<button class="btn small" data-a="reopen" data-v="${round}" data-p="${pid}">고치기</button><button class="btn small danger" data-a="delRec" data-v="${round}" data-p="${pid}">지우기</button>`:''}</div>
      <div class="sub" style="margin-top:6px">${(r.throws||[]).map(k => `${m[k]?.v ?? 0}(${esc(m[k]?.l||'')})`).join(' · ')}</div>
      <div class="sub">입력 ${esc(r.by)} ${hm(r.at)}${r.editedBy?` · 수정 ${esc(r.editedBy)} ${hm(r.editedAt)}`:''}</div>
      ${hist?`<div style="margin-top:8px"><b class="sub">이전 기록</b>${hist}</div>`:''}</div>`;
  };
  return `<h2 class="row">${teamBadge(teamOf(pid))} ${esc(pname(pid))} · ${esc(E.name)}</h2>${part('main')}${part('final')}<button class="btn wide" data-a="closeSheet">닫기</button>`;
}

/* ---------- 단체전 ---------- */
function teamView(ev){
  const E = TEAM[ev], t = tally(ev), editable = can.record(ev);
  const n = matchesOf(ev).length + 1;
  let h = evHead(ev, scoreline(t));
  const winBtns = `<div class="row nowrap" style="margin-top:14px"><button class="btn blue huge" data-a="win" data-v="blue">${esc(teamName('blue'))} 승</button><button class="btn red huge" data-a="win" data-v="red">${esc(teamName('red'))} 승</button></div>
    <div class="row" style="margin-top:10px"><button class="btn wide" data-a="win" data-v="draw">무승부</button></div>`;
  const recent = recentCard(ev);
  if(E.mode==='round'){
    return h + `<div class="cols two"><div class="card"><h2>${n}판째 결과</h2>${editable?winBtns:''}
      <p class="sub">회차마다 나오는 인원을 정해 두고, 여자끼리와 남자끼리 나눠서 진행합니다.${t.draw?` 무승부 ${t.draw}판.`:''}</p></div><div>${recent}</div></div>`;
  }
  const b = upNext(ev,'blue'), r = upNext(ev,'red');
  let cur = `<div class="card"><div class="row"><h2 class="grow h2" style="margin:0">지금 경기 <span class="sub">${n}번째 대결</span></h2></div>
    <div style="height:12px"></div>
    <div class="vs">${playerBox(ev,'blue',b.cur,b.picked,editable)}<div class="vsmark">VS</div>${playerBox(ev,'red',r.cur,r.picked,editable)}</div>`;
  if(!editable) cur += '';
  else if(E.mode==='time'){
    const rt = UI.runTimes[ev] || {};
    cur += `<div class="watch" id="watch">0.00</div>
      <div class="row nowrap"><button class="btn primary huge" data-a="watchToggle" id="watchBtn">시작</button><button class="btn" data-a="watchReset">초기화</button></div>
      <div class="row nowrap" style="margin-top:10px"><button class="btn blue grow" data-a="watchTo" data-v="blue">→ ${esc(teamShort('blue'))} 기록에 넣기</button><button class="btn red grow" data-a="watchTo" data-v="red">→ ${esc(teamShort('red'))} 기록에 넣기</button></div>
      <div class="row" style="margin-top:12px;justify-content:center">
        <label class="row">${teamBadge('blue')}<input class="timein" id="rtBlue" inputmode="decimal" data-in="rt" data-t="blue" value="${esc(rt.blue??'')}" placeholder="초"></label>
        <label class="row">${teamBadge('red')}<input class="timein" id="rtRed" inputmode="decimal" data-in="rt" data-t="red" value="${esc(rt.red??'')}" placeholder="초"></label>
      </div>
      <div class="row" style="margin-top:12px"><button class="btn ok huge" data-a="saveRun">기록 비교해서 저장</button></div>
      <p class="sub">편도로 뛰며 두 팀이 반대편 끝에서 번갈아 출발합니다. 초시계 대신 기록을 직접 적어도 됩니다.</p>`;
  } else cur += winBtns;
  cur += `</div>`;
  const nx = `<div class="card"><h2>다음 경기</h2>
    <div class="nextline"><span class="who">${teamBadge('blue')}${b.next?esc(pname(b.next)):'-'}</span><span class="sub">vs</span><span class="who">${teamBadge('red')}${r.next?esc(pname(r.next)):'-'}</span></div>
    <div class="row" style="margin-top:14px"><button class="btn wide" data-a="listSheet">📋 전체 명단 · 기록 보기</button></div></div>`;
  return h + `<div class="cols two"><div>${cur}</div><div>${nx}${recent}</div></div>`;
}
function playerBox(ev, team, id, picked, editable){
  const ord = orderFor(ev, team), pl = plays(ev, team);
  return `<div class="player ${team}"><div class="lbl">${esc(teamName(team))} ${id ? (ord.indexOf(id)+1)+'번' : ''}</div>
    <div class="nm">${id ? esc(pname(id)) : '팀원 없음'}</div>
    ${id && pl[id] ? `<span class="tag warn">${pl[id]+1}번째 출전</span>` : ''}${picked ? '<span class="tag dark">직접 고름</span>' : ''}
    ${id && editable ? `<button class="btn small" data-a="pickSheet" data-v="${team}">선수 바꾸기</button>` : ''}</div>`;
}
function recentCard(ev){
  const ms = matchesOf(ev).slice().reverse();
  const top = ms.slice(0, 4);
  return `<div class="card"><div class="row"><h2 class="grow h2" style="margin:0">지난 대결 <span class="sub">${ms.length}판</span></h2>${ms.length>4?'<button class="btn small" data-a="listSheet" data-v="rec">전체</button>':''}</div>
    ${top.length ? `<div class="list">${top.map((m,i) => matchRow(ev, m, ms.length-i)).join('')}</div>` : '<div class="empty">아직 기록이 없습니다.</div>'}</div>`;
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
          ${id===u.cur?'<span class="tag dark">지금</span>':id===u.next?'<span class="tag warn">다음</span>':''}${pl[id]?`<span class="tag ok">✓ ${pl[id]}회</span>`:''}</div>`).join('') || '<div class="empty">팀원이 없습니다.</div>'}</div></div>`;
    }).join('')}</div>`;
  } else {
    const ms = matchesOf(ev).slice().reverse();
    body = `<div class="card">${ms.length ? `<div class="list">${ms.map((m,i) => matchRow(ev, m, ms.length-i)).join('')}</div>${can.record(ev)?'<p class="sub">줄을 누르면 결과를 고치거나 지울 수 있습니다.</p>':''}` : '<div class="empty">아직 기록이 없습니다.</div>'}</div>`;
  }
  return `<h2>${E.icon} ${esc(E.name)} 명단 · 기록</h2>
    ${E.mode!=='round'?`<div class="seg" style="margin-bottom:14px"><button class="${listTab==='order'?'on':''}" data-a="listTab" data-v="order">출전 명단</button><button class="${listTab==='rec'?'on':''}" data-a="listTab" data-v="rec">경기 기록</button></div>`:''}
    ${body}<button class="btn primary wide" data-a="closeSheet">닫기</button>`;
}
let pickTeam = 'blue';
function pickSheet(){
  const ev = UI.ev, ord = orderFor(ev, pickTeam), pl = plays(ev, pickTeam), u = upNext(ev, pickTeam);
  return `<h2 class="row">${teamBadge(pickTeam)} ${esc(teamName(pickTeam))} 선수 바꾸기</h2>
    <p class="sub">빠진 사람이 있을 때 이번 대결에 나올 사람을 직접 고릅니다. 저장하면 다시 순서대로 돌아갑니다.</p>
    <div class="list olist">${ord.map((id,i) => `<div class="item tap ${id===u.cur?'cur':''}" data-a="setPick" data-v="${id}"><span class="no">${i+1}</span><span class="name">${esc(pname(id))}</span>${pl[id]?`<span class="tag ok">${pl[id]}회 출전</span>`:''}${id===u.cur?'<span class="tag dark">지금</span>':''}</div>`).join('')}</div>
    <div class="row" style="margin-top:12px"><button class="btn grow" data-a="setPick" data-v="">순서대로 (자동)</button><button class="btn primary grow" data-a="closeSheet">닫기</button></div>`;
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
function addLane(ev, pid){
  const E = INDIV[ev], lanes = UI.lanes[ev] ||= [];
  if(lanes.some(L => L.pid===pid)) return;
  if(lanes.length >= E.lanes){ toast(E.lanes===1 ? '지금 입력 중인 사람을 먼저 저장하거나 빼 주세요.' : `${E.lanes}명까지 동시에 입력할 수 있습니다. 한 명을 먼저 저장해 주세요.`); return; }
  const round = UI.round[ev]||'main', r = rec(ev, round, pid);
  lanes.push({ pid, round, throws: r ? [...r.throws] : [], dist: r?.dist || '2.5', existing: !!r });
  saveLanes();
}
async function saveLane(ev, i){
  if(!can.record(ev)) return denied();
  const E = INDIV[ev], L = UI.lanes[ev][i]; if(!L) return;
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
  UI.lanes[ev].splice(i,1); saveLanes();
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
  delete UI.pick[ev];
  const label = winner==='draw' ? '무승부' : `${teamName(winner)} 승`;
  toast(`${label} 저장했습니다.`, '되돌리기', () => put(['main','matches',id], { event:ev, deleted:true, editedBy:UI.me, editedAt:now() }));
}

/* ---------- 동작 ---------- */
Object.assign(ACT, {
  sub: (el, v) => { UI.sub[UI.ev] = v; },
  round: (el, v) => { const ev=UI.ev; if((UI.lanes[ev]||[]).length){ toast('입력 중인 사람을 먼저 저장하거나 빼 주세요.'); return false; } UI.round[ev]=v; },
  filter: (el, v) => { UI.filter = v; },
  pick: (el, v) => {
    const ev = UI.ev;
    if(!can.record(ev)){ openSheet(() => recSheet(ev, v)); return false; }
    addLane(ev, v); UI.q=''; if(document.activeElement) document.activeElement.blur(); window.scrollTo({top:0,behavior:'smooth'});
  },
  throw: (el) => { const ev=UI.ev, L=UI.lanes[ev][+el.dataset.i]; if(L && L.throws.length<INDIV[ev].count){ L.throws.push(el.dataset.k); saveLanes(); if(navigator.vibrate) navigator.vibrate(25); } },
  unslot: (el) => { const L=UI.lanes[UI.ev][+el.dataset.i]; L.throws.splice(+el.dataset.k,1); saveLanes(); },
  undoThrow: (el) => { const L=UI.lanes[UI.ev][+el.dataset.i]; L.throws.pop(); saveLanes(); },
  dropLane: async (el) => { const ev=UI.ev, i=+el.dataset.i, L=UI.lanes[ev][i]; if(L.throws.length && !(await ask('입력한 점수를 저장하지 않고 뺄까요?','빼기',true))) return false; UI.lanes[ev].splice(i,1); saveLanes(); },
  dist: (el, v) => { UI.lanes[UI.ev][+el.dataset.i].dist = v; saveLanes(); },
  saveLane: async (el) => { await saveLane(UI.ev, +el.dataset.i); },
  editRec: (el, v) => { const ev=UI.ev; openSheet(() => recSheet(ev, v)); return false; },
  reopen: (el, v) => { const ev=UI.ev; if(!can.record(ev)) return denied();
    if((UI.lanes[ev]||[]).length>=INDIV[ev].lanes){ toast('입력 칸이 차 있습니다. 먼저 저장하거나 빼 주세요.'); return false; }
    UI.round[ev]=v; addLane(ev, el.dataset.p); UI.sub[ev]='enter'; closeSheet(); window.scrollTo(0,0); },
  delRec: async (el, v) => { const ev=UI.ev; if(!can.record(ev)) return denied();
    if(!(await ask('이 기록을 지울까요?','지우기',true))) return false;
    const id=recId(ev,v,el.dataset.p), prev=D.indiv.find(r => r.id===id);
    put(['main','indiv',id], { event:ev, deleted:true, editedBy:UI.me, editedAt:now(), history:[...(prev?.history||[]), {throws:prev?.throws||[], by:prev?.editedBy||prev?.by, at:prev?.editedAt||prev?.at}].slice(-10) });
    toast('기록을 지웠습니다.', '되돌리기', () => put(['main','indiv',id], { event:ev, deleted:false })); closeSheet(); },
  win: (el, v) => { saveMatch(UI.ev, v); },
  pickSheet: (el, v) => { pickTeam = v; openSheet(pickSheet); return false; },
  setPick: (el, v) => { const ev=UI.ev; (UI.pick[ev] ||= {})[pickTeam] = v || undefined; closeSheet(); },
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
  saveRun: () => { const ev=UI.ev, rt=UI.runTimes[ev]||{}, r=parseFloat(rt.red), b=parseFloat(rt.blue);
    if(isNaN(r)||isNaN(b)){ toast('두 팀 기록을 모두 넣어 주세요.'); return false; }
    saveMatch(ev, r<b?'red': b<r?'blue':'draw', { redTime:r, blueTime:b }); UI.runTimes[ev]={}; },
});
