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
function eventView(ev){
  if(!EVENTS[ev]) return '<div class="card empty">보여 줄 종목이 없습니다. 마스터가 명단·설정의 종목 탭에서 종목을 켜 주세요.</div>';
  return EVENTS[ev].kind==='indiv' ? indivView(ev) : teamView(ev);
}

/* ---------- 개인전: 왼쪽·오른쪽 사대(칸)마다 선수를 골라 점수 입력 ---------- */
function lanesOf(ev){
  const n = INDIV[ev].lanes, a = UI.lanes[ev] || [];
  UI.lanes[ev] = Array.from({ length:n }, (_,i) => (a[i] && Array.isArray(a[i].throws)) ? a[i] : null);
  return UI.lanes[ev];
}
// 이 기기가 고른 입력 방식: 연습('prac', 연습 1·2는 선수마다 자동) / 본선 / 결승. 예전 값(p1·p2)도 받아 줌. 연습이 없는 종목은 본선으로
const roundMode = ev => { const v = UI.round[ev]; return ((v==='prac' || v==='p1' || v==='p2') && hasPrac(ev)) ? 'prac' : v==='final' ? 'final' : 'main'; };
const MODE_LABEL = { prac:'연습', main:'본선', final:'결승' };
function indivView(ev){
  const E = INDIV[ev], mode = roundMode(ev), ps = people(), n = ps.length;
  const c1 = ps.filter(p => rec(ev,'p1',p.id)).length, c2 = ps.filter(p => rec(ev,'p2',p.id)).length;
  const cm = ps.filter(p => rec(ev,'main',p.id)).length, cf = ps.filter(p => rec(ev,'final',p.id)).length;
  const nw = (t, n) => `<span class="nw">${t}<span class="cnt">${n}명</span></span>`;
  let label, done, total;
  if(mode==='prac'){ label = `${nw('연습 1', c1)} · ${nw('연습 2', c2)} <span class="nw">/ ${n}명</span>`; done = c1 + c2; total = n*2; }
  else if(mode==='main'){ label = `<span class="nw">본선<span class="cnt">${cm}/${n}명</span></span>`; done = cm; total = n; }
  else { label = `<span class="nw">결승<span class="cnt">${cf}/${n}명</span></span>`; done = cf; total = n; }
  const pct = total ? Math.round(done/total*100) : 0;
  const modes = (hasPrac(ev) ? ['prac'] : []).concat(['main','final']), qn = qList(ev).length;
  const info = `<div class="infobar wrapx"><div class="grow ibprog"><b class="pgtxt">${label}</b><div class="progress"><i style="width:${pct}%"></i></div></div>
    <div class="seg sm">${modes.map(k => `<button class="${mode===k?'on':''}" data-a="round" data-v="${k}">${MODE_LABEL[k]}</button>`).join('')}</div>
    <button class="btn small qbtn ${qn?'has':''}" data-a="qSheet">대기 ${qn}명</button>
    <button class="btn small" data-a="indivList">📋<span class="bl"> 명단·순위</span></button></div>${qOtherLine(ev)}`;
  // 사대(칸)가 둘이면 세로 화면에서는 위아래, 가로 화면에서는 왼쪽·오른쪽에 함께 둠
  return `<div class="fit">${info}<div class="lanes n${E.lanes}">${lanesOf(ev).map((L,i) => laneBox(ev, E, L, i)).join('')}</div></div>`;
}
function laneBox(ev, E, L, i){
  const label = (LANE_LABELS[ev]||[])[i] || '';
  if(!L){
    // 대기 줄이 있으면 맨 앞 사람을 바로 넣는 큰 버튼
    const lanes = lanesOf(ev), q = qList(ev), first = q.find(id => !lanes.some(x => x && x.pid===id));
    const nextBtn = first ? `<button class="btn primary qnext" data-a="qFill" data-v="${i}">대기 ${q.indexOf(first)+1}번 ${esc(pname(first))} 넣기</button>` : '';
    return `<div class="lanebox empty ${first?'hasq':''}" style="--ev:${E.color}">${nextBtn}<button class="bigpick" data-a="pickFor" data-v="${i}"><span class="plus">＋</span><b>${esc(label)}</b><span>${first ? '다른 선수 고르기' : '눌러서 선수 고르기 (안 한 사람부터)'}</span></button></div>`;
  }
  const t = totalOf(ev, L.throws), opts = E.opts(settings()), full = L.throws.length >= E.count, num = E.mode==='number';
  // 채운 칸은 종목 색 바탕에 흰 점수, 빈 칸은 ①②③ 순서를 흐리고 작게
  const slots = Array.from({ length:E.count }, (_,k) => { const key = L.throws[k], txt = key!=null ? fmtNum(throwVal(ev, key)) : '';
    return key!=null ? `<button class="slot filled ${txt.length>4?'long':''}" data-a="unslot" data-i="${i}" data-k="${k}" aria-label="${k+1}번째 지우기">${txt}</button>`
      : `<div class="slot ${k===L.throws.length?'next':''}"><span class="ord">${circ(k+1)}</span></div>`; }).join('');
  const cols = E.count <= 5 ? E.count : Math.ceil(E.count/2);
  const rl = ROUNDS[L.round] || L.round;
  // 연습 방식이면 이 태그를 눌러 연습 1 ↔ 연습 2를 바꿈
  const rtag = (roundMode(ev)==='prac' && (L.round==='p1' || L.round==='p2'))
    ? `<button class="rtag r-${L.round} sw" data-a="laneRound" data-i="${i}" aria-label="${rl} (누르면 연습 회차 바꾸기)">${esc(rl)}<small> ⇄</small></button>`
    : `<span class="rtag r-${L.round}">${esc(rl)}</span>`;
  const input = num
    ? (full ? '<div class="numdone sub">모두 입력했습니다. 저장을 눌러 주세요. 칸을 누르면 그 숫자를 지웁니다.</div>' : `<div class="numrow"><label class="numlab"><span>${Math.min(L.throws.length+1, E.count)}번째${E.vunit ? ` (${esc(E.vunit)})` : ''}</span><input id="numIn${i}" class="numin" inputmode="decimal" autocomplete="off" placeholder="숫자"></label>
        <button class="btn primary numgo" data-a="throwNum" data-i="${i}">넣기</button></div>`)
    : `<div class="opts n${opts.length}">${opts.map(([k,l,v]) => `<button class="opt" data-a="throw" data-i="${i}" data-k="${k}" ${full?'disabled':''}><b>${v}</b>${l!==v+'점'?`<span>${esc(l)}</span>`:''}</button>`).join('')}</div>`;
  return `<div class="lanebox" style="--ev:${E.color}">
    <div class="lhead"><div class="lh1"><button class="nm" data-a="pickFor" data-v="${i}">${esc(pname(L.pid))}<small> ▾</small></button>
        <span class="total">${fmtNum(t)}<small>${esc(E.vunit)}</small></span><button class="xbtn" data-a="dropLane" data-i="${i}" aria-label="빼기">✕</button></div>
      <div class="lh2"><span class="ll">${esc(label.split(' ')[0])}</span>${rtag}${L.existing?'<span class="tag warn">수정</span>':''}
        ${ev==='archery' ? `<button class="distbtn" data-a="dist" data-i="${i}" data-v="${L.dist==='3'?'2.5':'3'}" aria-label="거리 바꾸기"><small>거리</small>${L.dist==='3'?'3':'2.5'}m</button>` : ''}</div></div>
    <div class="slotrow"><div class="slots" style="grid-template-columns:repeat(${cols},1fr)">${slots}</div><button class="btn undo" data-a="undoThrow" data-i="${i}" ${L.throws.length?'':'disabled'} aria-label="한 칸 지우기">↩</button></div>
    ${input}
    <button class="btn ${full?'ok':'primary'} savebtn" data-a="saveLane" data-i="${i}">${L.existing?'수정 저장':'저장'} (${L.throws.length}/${E.count})</button>
  </div>`;
}

/* ---------- 회차 배지: 끝낸 회차는 진한 색 알약 + 흰 글씨, 아직이면 흰 알약 + 빨간 테두리·글씨 ---------- */
// o.focus: 지금 입력 방식의 회차(더 크게) / o.score: 연습도 점수를 보임 (본선·결승은 항상 점수)
function rbadge(ev, rd, r, o={}){
  const nm = ROUND_SHORT[rd], f = o.focus ? ' focus' : '';
  if(!r) return `<span class="rb todo${f}">${nm} –</span>`;
  const main = rd==='main' || rd==='final', v = totalOf(ev, r.throws);
  const unit = INDIV[ev].vunit==='점' ? '' : INDIV[ev].vunit;
  return `<span class="rb done r-${rd}${f}">${nm} ${(main || o.score) ? fmtNum(v) + unit : '✓'}</span>`;
}
// 지금 입력 방식에서 크게 보일 회차
const rbFocus = (ev, rd) => { const m = roundMode(ev); return m==='prac' ? (rd==='p1' || rd==='p2') : m===rd; };

// 선수 고르기 창: 안 한 사람 먼저 / 가나다. PK.queue 가 켜져 있으면 '대기에 넣기' 창(여러 명을 차례로 누름)
const PK = { ev:null, lane:0, sort:'todo', q:'', queue:false };
const pracCount = (ev, id) => (rec(ev,'p1',id) ? 1 : 0) + (rec(ev,'p2',id) ? 1 : 0);
function indivPickRows(){
  const ev = PK.ev, mode = roundMode(ev), q = PK.q.trim(), qm = PK.queue, queue = qList(ev);
  const inLane = new Map(lanesOf(ev).map((L,i) => [L && L.pid, i]).filter(x => x[0]));
  let list = people().filter(p => !q || p.name.includes(q));
  // 이 입력 방식에서 이미 끝낸 사람: 연습이면 연습 1·2를 모두 마친 사람, 본선·결승이면 그 회차 기록이 있는 사람
  const doneOf = id => mode==='prac' ? pracCount(ev,id)>=2 : !!rec(ev, mode, id);
  // 안 한 사람 먼저: 다른 칸에서 입력 중인 사람과 불참자는 뒤로. 연습은 연습을 덜 한 사람부터
  if(PK.sort==='todo') list.sort((a,b) => (inLane.has(a.id) - inLane.has(b.id)) || (mode==='prac' ? pracCount(ev,a.id) - pracCount(ev,b.id) : (!!rec(ev,mode,a.id) - !!rec(ev,mode,b.id))) || (isAbsent(a.id) - isAbsent(b.id)) || byName(a,b));
  return list.map(p => {
    const R = recsOf(ev, p.id), li = inLane.get(p.id), qi = queue.indexOf(p.id);
    const bd = mode==='prac' ? rbadge(ev,'p1',R.p1,{focus:true}) + rbadge(ev,'p2',R.p2,{focus:true}) + (R.main ? rbadge(ev,'main',R.main) : '')
      : mode==='main' ? rbadge(ev,'main',R.main,{focus:true})
      : rbadge(ev,'final',R.final,{focus:true}) + (R.main ? rbadge(ev,'main',R.main) : '');
    const any = mode==='prac' ? (R.p1 || R.p2 || R.main) : (mode==='main' ? R.main : (R.final || R.main));
    const abs = !any && isAbsent(p.id) ? '<span class="tag red">불참</span>' : '';
    const inl = li!=null ? `<span class="tag warn">${esc(LANE_LABELS[ev][li])} 입력 중</span>` : '';
    if(qm){
      if(li!=null) return `<div class="item pk dn"><span class="qno"></span><span class="name">${esc(p.name)}</span>${inl}</div>`;
      return `<div class="item tap pk ${qi>=0?'inq':''}" data-a="qToggle" data-v="${p.id}"><span class="qno ${qi>=0?'on':''}">${qi>=0 ? qi+1 : ''}</span><span class="name">${esc(p.name)}</span><span class="badges">${bd}</span>${abs}</div>`;
    }
    return `<div class="item tap pk ${doneOf(p.id)?'dn':''}" data-a="pickPerson" data-v="${p.id}"><span class="name">${esc(p.name)}</span>${inl || `<span class="badges">${bd}</span>`}${abs}${qi>=0?`<span class="tag dark">대기 ${qi+1}번</span>`:''}</div>`;
  }).join('') || `<div class="empty">${people().length ? '해당하는 사람이 없습니다.' : '명단이 비어 있습니다. 마스터가 명단을 먼저 넣어 주세요.'}</div>`;
}
function indivPickSheet(){
  const ev = PK.ev, E = INDIV[ev]; if(!E) return '<p>종목을 찾을 수 없습니다.</p><button class="btn wide" data-a="closeSheet">닫기</button>';
  const mode = roundMode(ev), qm = PK.queue;
  const head = qm ? `${E.icon} 대기에 넣기 <small class="sub">${MODE_LABEL[mode]}</small>` : `${E.icon} ${esc((LANE_LABELS[ev]||[])[PK.lane]||'')} 선수 고르기 <small class="sub">${MODE_LABEL[mode]}</small>`;
  const foot = qm
    ? `<p class="sub">이름을 누르면 대기 맨 뒤에 들어가 번호가 붙고, 다시 누르면 빠집니다.</p><button class="btn primary wide" data-a="qBack">완료 (대기 ${qList(ev).length}명)</button>`
    : `<p class="sub">${mode==='prac' ? '연습 1이 없으면 연습 1, 있으면 연습 2로 자동으로 들어갑니다. 둘 다 있으면 연습 2를 고칩니다.' : '이미 기록이 있는 사람을 고르면 그 기록을 고칠 수 있습니다.'}</p><button class="btn wide" data-a="closeSheet">닫기</button>`;
  return `<h2>${head}</h2>
    <div class="row nowrap" style="margin-bottom:10px"><input id="pkq" data-in="pkq" placeholder="이름 검색" value="${esc(PK.q)}" autocomplete="off">
      <div class="seg sm">${[['todo','안 한 사람 먼저'],['name','가나다']].map(([k,l]) => `<button class="${PK.sort===k?'on':''}" data-a="pkSort" data-v="${k}">${l}</button>`).join('')}</div></div>
    <div class="list sheetlist pklist" id="pkRows" style="--ev:${E.color}">${indivPickRows()}</div>${foot}`;
}
// 명단·순위 창
let ilTab = 'list', ilRank = 'main';
function indivListSheet(){
  const ev = UI.ev, E = INDIV[ev]; if(!E) return '<p>종목을 찾을 수 없습니다.</p><button class="btn wide" data-a="closeSheet">닫기</button>';
  const body = ilTab==='rank' ? indivRank(ev) : `<div class="list sheetlist" style="--ev:${E.color}">${people().map(p => { const R = recsOf(ev, p.id);
      const any = R.p1 || R.p2 || R.main || R.final;
      const bd = roundKeys(ev).filter(k => k!=='final' || R.final).map(k => rbadge(ev, k, R[k], { score:true, focus:rbFocus(ev, k) })).join('');
      return `<div class="item tap" data-a="editRec" data-v="${p.id}"><span class="name">${esc(p.name)}<span class="badges">${bd}</span></span>${!any && isAbsent(p.id) ? '<span class="tag red">불참</span>' : ''}</div>`; }).join('') || '<div class="empty">명단이 비어 있습니다.</div>'}</div>`;
  return `<h2>${E.icon} ${esc(E.name)}</h2>
    <div class="seg" style="margin-bottom:12px"><button class="${ilTab==='list'?'on':''}" data-a="ilTab" data-v="list">명단 (가나다)</button><button class="${ilTab==='rank'?'on':''}" data-a="ilTab" data-v="rank">순위</button></div>
    ${body}<button class="btn primary wide" data-a="closeSheet" style="margin-top:12px">닫기</button>`;
}
function indivRank(ev){
  const hasFinal = people().some(p => rec(ev,'final',p.id));
  const kinds = ['main'].concat(hasPrac(ev) ? ['p1','p2'] : [], hasFinal ? ['final'] : []);
  if(!kinds.includes(ilRank)) ilRank = 'main';
  const sel = `<div class="seg sm" style="margin-bottom:10px">${kinds.map(k => `<button class="${ilRank===k?'on':''}" data-a="ilRank" data-v="${k}">${ROUNDS[k]}</button>`).join('')}</div>`;
  const vals = r => (r.throws||[]).map(k => fmtNum(throwVal(ev, k))).join(' · ');
  const unit = INDIV[ev].vunit;
  if(ilRank!=='main'){
    const { list } = roundStandings(ev, ilRank);
    const rows = list.map(x => `<tr class="tap" data-a="editRec" data-v="${x.p.id}"><td class="rank">${x.rank}</td>
      <td><b>${esc(x.p.name)}</b>${x.r.dist?` <span class="sub" style="display:inline">${x.r.dist}m</span>`:''}
        <div class="sub">${vals(x.r)} · ${esc(x.r.editedBy||x.r.by||'')} ${hm(x.r.editedAt||x.r.at)}</div></td>
      <td class="num"><span class="score">${fmtNum(x.total)}</span></td></tr>`).join('');
    return sel + (list.length ? `<table><thead><tr><th>순위</th><th>이름</th><th class="num">${ROUNDS[ilRank]} ${unit ? (unit==='점' ? '점수' : `(${esc(unit)})`) : '기록'}</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="sub">줄을 누르면 그 기록을 ${can.record(ev)?'고치거나 지울':'자세히 볼'} 수 있습니다.</p>` : `<div class="empty">${ROUNDS[ilRank]} 기록이 아직 없습니다.</div>`);
  }
  const { list, ties } = standings(ev);
  let html = '';
  ties.forEach(t => {
    html += t.resolved
      ? `<div class="okline">${sc(ev, t.total)} 동점(${t.names.map(esc).join(', ')})은 결승으로 순위가 정해졌습니다.</div>`
      : `<div class="note">⚠ ${sc(ev, t.total)} 동점: ${t.names.map(esc).join(', ')} → 결승 필요</div>`;
  });
  const rows = list.map(x => `<tr class="tap" data-a="editRec" data-v="${x.p.id}">
    <td class="rank">${x.rank}</td>
    <td><b>${esc(x.p.name)}</b>${x.r.dist?` <span class="sub" style="display:inline">${x.r.dist}m</span>`:''}
      <div class="sub">${vals(x.r)} · ${esc(x.r.editedBy||x.r.by||'')} ${hm(x.r.editedAt||x.r.at)}</div></td>
    <td class="num"><span class="score">${fmtNum(x.total)}</span>${x.ftotal!=null?`<div class="sub">결승 ${fmtNum(x.ftotal)}</div>`:''}</td></tr>`).join('');
  return sel + html + (list.length ? `<table><thead><tr><th>순위</th><th>이름</th><th class="num">본선 ${unit ? (unit==='점' ? '점수' : `(${esc(unit)})`) : '기록'}</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="sub">줄을 누르면 그 기록을 ${can.record(ev)?'고치거나 지울':'자세히 볼'} 수 있습니다.</p>` : '<div class="empty">아직 본선 기록이 없습니다.</div>');
}
function recSheet(ev, pid){
  const E = INDIV[ev]; if(!E) return '<p>종목을 찾을 수 없습니다.</p><button class="btn wide" data-a="closeSheet">닫기</button>';
  const m = optMap(ev), editable = can.record(ev);
  const part = round => {
    const r = rec(ev, round, pid), nm = ROUNDS[round];
    if(!r) return `<div class="card"><b>${nm}</b> <span class="sub">기록 없음</span>${editable?` <button class="btn small" data-a="reopen" data-v="${round}" data-p="${pid}">입력하기</button>`:''}</div>`;
    const hist = (r.history||[]).slice(-5).reverse().map(h => `<div class="sub">· ${hm(h.at)} ${esc(h.by)}: ${(h.throws||[]).map(k => fmtNum(throwVal(ev, k))).join(' · ')}</div>`).join('');
    const detail = isNum(ev) ? (r.throws||[]).map(k => fmtNum(throwVal(ev, k))).join(' · ') : (r.throws||[]).map(k => `${m[k]?.v ?? 0}(${esc(m[k]?.l||'')})`).join(' · ');
    return `<div class="card"><div class="row"><b class="grow" style="font-size:20px">${nm}<span class="rsc">${sc(ev, totalOf(ev,r.throws))}</span></b>
      ${editable?`<button class="btn small" data-a="reopen" data-v="${round}" data-p="${pid}">고치기</button><button class="btn small danger" data-a="delRec" data-v="${round}" data-p="${pid}">지우기</button>`:''}</div>
      <div class="sub" style="margin-top:6px">${detail}</div>
      <div class="sub">입력 ${esc(r.by)} ${hm(r.at)}${r.editedBy?` · 수정 ${esc(r.editedBy)} ${hm(r.editedAt)}`:''}</div>
      ${hist?`<div style="margin-top:8px"><b class="sub">이전 기록</b>${hist}</div>`:''}</div>`;
  };
  return `<h2 class="row">${esc(pname(pid))} · ${esc(E.name)}</h2>${roundKeys(ev).map(part).join('')}<button class="btn wide" data-a="closeSheet">닫기</button>`;
}

/* ---------- 단체전: 위쪽에 지금 대결, 아래쪽에 대기 순서 ---------- */
// 대결 점수를 적는 종목이면 승패 단추 대신 점수 입력 (이긴 쪽은 점수로 정함)
const scIn = ev => ((UI.scoreIn ||= {})[ev] ||= { blue:0, red:0, win:null });
function scWinner(ev){ const S = scIn(ev); if(S.win) return S.win; const b = parseFloat(S.blue) || 0, r = parseFloat(S.red) || 0; return b>r ? 'blue' : r>b ? 'red' : 'draw'; }
function scResText(ev){ const S = scIn(ev), w = scWinner(ev); return `결과: ${w==='draw' ? '무승부' : teamName(w) + ' 승'} (${fmtNum(parseFloat(S.blue)||0)} : ${fmtNum(parseFloat(S.red)||0)})`; }
function scoreBox(ev){
  const S = scIn(ev);
  const col = tm => `<div class="scol ${tm}"><div class="sct">${teamBadge(tm)} ${esc(teamName(tm))} 점수</div>
      <div class="stp"><button class="stpb" data-a="scStep" data-t="${tm}" data-d="-1" aria-label="${esc(teamName(tm))} 점수 줄이기">−</button>
        <input class="scin" id="sc_${tm}" inputmode="decimal" data-in="sc" data-t="${tm}" value="${esc(S[tm])}" aria-label="${esc(teamName(tm))} 점수">
        <button class="stpb" data-a="scStep" data-t="${tm}" data-d="1" aria-label="${esc(teamName(tm))} 점수 늘리기">＋</button></div></div>`;
  const ov = [[null,'점수대로'],['blue',teamShort('blue')+' 승'],['draw','무승부'],['red',teamShort('red')+' 승']];
  return `<div class="scorebox"><div class="scrow">${col('blue')}${col('red')}</div>
    <div class="scres" id="scRes">${esc(scResText(ev))}</div>
    <div class="scovr"><span class="sub">직접 정하기</span><div class="seg xs">${ov.map(([k,l]) => `<button class="${(S.win||null)===k?'on':''}" data-a="scWin" data-v="${k||''}">${esc(l)}</button>`).join('')}</div></div>
    <button class="btn ok huge" data-a="saveScore">결과 저장</button></div>`;
}
function winControls(ev){
  if(teamOpt(ev).score) return scoreBox(ev);
  return `<div class="winrow"><button class="btn blue huge" data-a="win" data-v="blue">${esc(teamName('blue'))} 승</button><button class="btn huge drawbtn" data-a="win" data-v="draw">무승부</button><button class="btn red huge" data-a="win" data-v="red">${esc(teamName('red'))} 승</button></div>`;
}
function teamView(ev){
  const E = TEAM[ev], t = tally(ev), editable = can.record(ev), n = matchesOf(ev).length + 1, o = teamOpt(ev);
  const info = `<div class="infobar"><b>${E.mode==='round' ? `${n}판째` : `${n}번째 대결`}</b>${scoreline(t)}<span class="grow"></span>
    ${D.amMaster && ORDER_EVENTS.includes(ev) ? '<button class="btn small" data-a="sub" data-v="order">✏️<span class="bl"> 순서</span></button>' : ''}
    <button class="btn small" data-a="listSheet">📋<span class="bl"> 기록</span></button></div>`;
  if(E.mode==='round'){
    return `<div class="fit">${info}<div class="roundbig"><b>${n}판째</b><span class="sub">${esc(E.hint)}${t.draw?` · 무승부 ${t.draw}판`:''}</span></div>${editable ? winControls(ev) : ''}</div>`;
  }
  const b = upNext(ev,'blue'), r = upNext(ev,'red');
  const duelHtml = cls => `<div class="duel ${cls}">${pcard(ev,'blue',b,editable)}<div class="vsm">VS</div>${pcard(ev,'red',r,editable)}</div>`;
  if(E.mode==='time' && editable){
    const rt = runTimesOf(ev), tm = (D.calls[ev]||{}).times || {};
    const tin = (team, id) => `<div class="tcell">${teamBadge(team)}<input class="timein" id="${id}" inputmode="decimal" data-in="rt" data-t="${team}" value="${esc(rt[team])}" placeholder="초"><button class="btn small ${team}" data-a="watchTo" data-v="${team}">⏱ 넣기</button></div>`;
    return `<div class="fit">${info}<div class="tsplit"><div class="tmain">${duelHtml('')}
      <div class="watchrow"><div class="watch" id="watch">0.00</div><button class="btn primary huge" data-a="watchToggle" id="watchBtn">시작</button><button class="btn" data-a="watchReset" aria-label="초기화">↺</button></div>
      <div class="timesrow">${tin('blue','rtBlue')}${tin('red','rtRed')}</div>
      ${tm.blue!=null || tm.red!=null ? `<div class="sub">⏱ 계시원 ${esc(tm.by||'')}이(가) 보낸 기록이 채워졌습니다. 확인 뒤 저장하세요.</div>` : ''}
      <button class="btn ok huge" data-a="saveRun">기록 비교해서 저장</button></div>${queueBox(ev, editable)}</div></div>`;
  }
  const winBtns = editable && E.mode==='duel' ? winControls(ev) : '';
  // 과녁판 중계 종목: 지금 대결 아래에 과녁판. 가로 화면에서는 오른쪽에 큼직하게
  if(o.board && E.mode==='duel') return `<div class="fit">${info}<div class="tsplit tgt">${duelHtml('gduel')}${targetPanel(ev, editable)}<div class="gwin">${winBtns}</div>${queueBox(ev, editable, 'gqueue')}</div></div>`;
  // 휴대폰을 가로로 들면 왼쪽에 지금 대결, 오른쪽에 대기 순서
  return `<div class="fit">${info}<div class="tsplit"><div class="tmain">${duelHtml('')}${winBtns}</div>${queueBox(ev, editable)}</div></div>`;
}
// 지금 선수 카드: 이름은 보통 세 글자라 왼쪽(청)·오른쪽(홍)에 나란히 둠
function pcard(ev, team, u, editable){
  const id = u.cur, ord = orderFor(ev, team), pl = plays(ev, team);
  const inner = `<span class="lbl">${esc(teamName(team))} ${id ? (ord.indexOf(id)+1)+'번' : ''}${id && pl[id] ? ` · ${pl[id]+1}회째` : ''}</span>
    <span class="nm">${id ? esc(pname(id)) : '팀원 없음'}${editable && id ? '<small> ▾</small>' : ''}</span>
    ${u.picked ? '<span class="hint">직접 고름</span>' : ''}`;
  return editable && id ? `<button class="pcard ${team}" data-a="pickSheet" data-v="${team}">${inner}</button>` : `<div class="pcard ${team}">${inner}</div>`;
}
// 대기 순서: 다음 대결부터 청·홍을 한 줄에 나란히. 모두 한 번씩 나온 뒤의 순서는 흐리게
function queueBox(ev, editable, cls=''){
  const left = remainingMatches(ev), pa = prepAhead(), n0 = matchesOf(ev).length + 1;
  const rows = Math.min(40, Math.max(left - 1, pa, 3));
  const B = lineup(ev, 'blue', rows+1), R = lineup(ev, 'red', rows+1);
  let html = '';
  for(let k = 1; k <= rows; k++){
    if(k===left && left>0) html += '<div class="qsep">여기부터는 모두 한 번씩 나온 뒤 다시 나오는 순서입니다</div>';
    html += `<div class="qrow ${k>=left?'extra':''} ${k===pa?'prep':''}"><span class="qn">${k===1?'다음':n0+k}</span>
      <span class="qb">${esc(B[k]?pname(B[k]):'-')}</span><span class="qr">${esc(R[k]?pname(R[k]):'-')}</span>${k===pa?'<span class="qt">📣 준비</span>':''}</div>`;
  }
  return `<div class="queue ${cls}"><div class="qhead"><b>대기 순서</b><span class="tag ${left>1?'dark':''}">${left>0 ? `남은 대결 ${left}팀 (지금 포함)` : '모두 한 번씩 나왔습니다'}</span><span class="grow"></span>
      ${editable?'<button class="btn small" data-a="callSheet">📣<span class="bl"> 부르기</span></button>':''}</div>
    <div class="qcols"><span></span><span class="qb">${teamBadge('blue')} ${esc(teamName('blue'))}</span><span class="qr">${teamBadge('red')} ${esc(teamName('red'))}</span></div>
    <div class="qlist">${html}</div></div>`;
}
function callSheet(){
  const ev = UI.ev, pa = prepAhead();
  const row = k => { const b = upcoming(ev,'blue',k), r = upcoming(ev,'red',k);
    return `<button class="btn huge wide ${k===pa?'primary':''}" data-a="callPlayers" data-v="${k}" style="width:100%;margin-bottom:10px">${k ? `${AHEAD_LABEL[k]} 선수 부르기${k===pa?' (준비 호출)':''}` : '지금 선수 다시 부르기'}<br><small>${esc(b?pname(b):'-')} · ${esc(r?pname(r):'-')}</small></button>`; };
  return `<h2>📣 안내판으로 부르기</h2>${[0,1,2].map(row).join('')}
    <p class="sub">결과를 저장하면 안내판이 ${AHEAD_LABEL[pa]} 선수에게 "준비해 주세요"를 자동으로 띄웁니다. 몇 번째 뒤를 부를지는 마스터가 안내판 메뉴에서 바꿉니다.</p>
    <button class="btn wide" data-a="closeSheet">닫기</button>`;
}
function winTag(w){
  return w==='blue' ? `<span class="tag blue">${esc(teamShort('blue'))} 승</span>` : w==='red' ? `<span class="tag red">${esc(teamShort('red'))} 승</span>` : '<span class="tag">무승부</span>';
}
const scoreTxt = m => m.blueScore!=null && m.redScore!=null ? `${fmtNum(m.blueScore)} : ${fmtNum(m.redScore)}` : '';
function matchRow(ev, m, no){
  const E = TEAM[ev];
  const who = E.mode==='round' ? `${no}판째` : `${esc(m.blueId?pname(m.blueId):'-')} <span class="sub" style="display:inline">vs</span> ${esc(m.redId?pname(m.redId):'-')}`;
  const tm = E.mode==='time' ? ` <span class="sub" style="display:inline">${fmtSec(m.blueTime)}초 / ${fmtSec(m.redTime)}초</span>` : '';
  const ms = scoreTxt(m) ? `<span class="mscore">${scoreTxt(m)}</span>` : '';
  return `<div class="item ${can.record(ev)?'tap':''}" ${can.record(ev)?`data-a="editMatch" data-v="${m.id}"`:''}><span class="no tag">${no}</span>
    <span class="name">${who}${tm}<span class="sub">${esc(m.editedBy||m.by||'')} ${hm(m.editedAt||m.at)}</span></span>${ms}${winTag(m.winner)}</div>`;
}
let listTab = 'order';
function listSheet(){
  const ev = UI.ev, E = TEAM[ev]; if(!E) return '<p>종목을 찾을 수 없습니다.</p><button class="btn wide" data-a="closeSheet">닫기</button>';
  let body;
  if(listTab==='order' && E.mode!=='round'){
    // 이름이 짧아서 휴대폰에서도 청팀·홍팀을 왼쪽·오른쪽에 나란히 보여 줌
    body = `<div class="pair">${TEAM_KEYS.map(team => {
      const u = upNext(ev, team), pl = plays(ev, team), ord = orderFor(ev, team);
      const done = ord.filter(id => pl[id]).length;
      return `<div class="pcol ${team}"><div class="phead">${teamBadge(team)}<b>${esc(teamName(team))}</b><span class="sub">${done}/${ord.length}명 출전</span></div>
        <div class="list olist">${ord.map((id,i) => `<div class="item ${id===u.cur?'cur':''} ${pl[id]?'done':''}"><span class="no">${i+1}</span><span class="name">${esc(pname(id))}</span>
          ${id===u.cur?'<span class="tag dark">지금</span>':id===u.next?'<span class="tag warn">다음</span>':''}${pl[id]?`<span class="tag ok">✓${pl[id]>1?pl[id]:''}</span>`:''}${isAbsent(id)?'<span class="tag red">불참</span>':''}</div>`).join('') || '<div class="empty">팀원이 없습니다.</div>'}</div></div>`;
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
  const m = D.matches.find(x => x.id===id); if(!m || !TEAM[m.event]) return '<p>기록이 없습니다.</p><button class="btn wide" data-a="closeSheet">닫기</button>';
  const E = TEAM[m.event], o = teamOpt(m.event);
  const scoreEdit = (o.score || m.blueScore!=null) && E.mode!=='time' ? `<div class="row" style="margin-bottom:12px"><label class="row">${teamBadge('blue')}<input class="timein" id="emSB" inputmode="decimal" value="${m.blueScore??''}" placeholder="점수"></label><label class="row">${teamBadge('red')}<input class="timein" id="emSR" inputmode="decimal" value="${m.redScore??''}" placeholder="점수"></label>
      <button class="btn small" data-a="emScores" data-v="${id}">점수 고치기</button></div>` : '';
  const marks = Array.isArray(m.marks) && m.marks.length ? `<div class="mthumb"><div class="sub">과녁판 기록 (청팀 ${m.marks.filter(k => k.t==='blue').length}개 · 홍팀 ${m.marks.filter(k => k.t==='red').length}개)</div>${tgtBox(m.event, { list:m.marks, thumb:true })}</div>` : '';
  return `<h2>${esc(E.name)} 결과 고치기</h2>
    ${E.mode!=='round'?`<p class="row" style="font-size:20px;font-weight:800">${teamBadge('blue')} ${esc(pname(m.blueId))} <span class="sub">vs</span> ${teamBadge('red')} ${esc(pname(m.redId))}</p>`:''}
    ${E.mode==='time'?`<div class="row" style="margin-bottom:12px"><label class="row">${teamBadge('blue')}<input class="timein" id="emB" inputmode="decimal" value="${m.blueTime??''}"></label><label class="row">${teamBadge('red')}<input class="timein" id="emR" inputmode="decimal" value="${m.redTime??''}"></label>
      <button class="btn small" data-a="emTimes" data-v="${id}">기록 고치기</button></div>`:''}
    ${scoreEdit}${marks}
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
// i번째 칸(왼쪽·오른쪽 사대)에 선수를 넣음. 이미 다른 칸에 있으면 알려 주기만 함.
// 연습 방식이면 연습 1이 없을 때 연습 1, 있으면 연습 2로 들어가고, 둘 다 있으면 연습 2를 고침. force: 회차를 직접 정함
// 대기 줄에 있던 사람이면 칸에 넣는 순간 대기에서 빠짐
function addLane(ev, pid, i, force){
  const lanes = lanesOf(ev), at = lanes.findIndex(L => L && L.pid===pid);
  if(at>=0 && !force){ if(at!==i) toast(`${pname(pid)}은(는) ${LANE_LABELS[ev][at]}에서 입력 중입니다.`); return; }
  const mode = roundMode(ev);
  let round = force || mode;
  if(!force && mode==='prac'){
    if(!rec(ev,'p1',pid)) round = 'p1';
    else if(!rec(ev,'p2',pid)) round = 'p2';
    else { round = 'p2'; toast(`${pname(pid)}은(는) 연습 1·2를 모두 마쳤습니다. 연습 2 기록을 고칩니다.`); }
  }
  const r = rec(ev, round, pid);
  lanes[at>=0 ? at : i] = { pid, round, throws: r ? [...r.throws] : [], dist: r?.dist || '2.5', existing: !!r };
  saveLanes();
  qDrop(ev, pid);
}
async function saveLane(ev, i){
  if(!can.record(ev)) return denied();
  const E = INDIV[ev], L = lanesOf(ev)[i]; if(!L) return;
  if(!L.throws.length){ toast('점수가 하나도 입력되지 않았습니다.'); return; }
  if(L.throws.length < E.count && !(await ask(`${E.count}${E.unit} 중 ${L.throws.length}${E.unit}만 입력했습니다.\n이대로 저장할까요?`, '저장'))) return;
  const id = recId(ev, L.round, L.pid), prev = D.indiv.find(r => r.id===id), p = person(L.pid);
  const data = { event:ev, round:L.round, personId:L.pid, personName:p?.name||'', throws:L.throws, deleted:false };
  if(ev==='archery') data.dist = L.dist;
  if(prev && !prev.deleted && (prev.throws||[]).length){
    data.editedBy = UI.me; data.editedAt = now();
    data.history = [...(prev.history||[]), { throws: prev.throws, by: prev.editedBy||prev.by, at: prev.editedAt||prev.at }].slice(-10);
  } else { data.by = UI.me; data.at = now(); data.editedBy = null; data.editedAt = null; }
  put(['main','indiv',id], data);
  lanesOf(ev)[i] = null; saveLanes();
  qDrop(ev, L.pid);          // 저장한 사람이 대기 줄에 남아 있으면 뺌
  toast(`${p?.name||''} ${sc(ev, totalOf(ev,data.throws))} 저장했습니다.`);
}
function saveMatch(ev, winner, extra={}){
  if(!can.record(ev)){ denied(); return false; }
  const E = TEAM[ev], id = `${ev}_${now()}_${uid()}`;
  let blueId = null, redId = null;
  if(E.mode!=='round'){
    blueId = upNext(ev,'blue').cur; redId = upNext(ev,'red').cur;
    if(!blueId || !redId){ toast('두 팀 모두 팀원이 있어야 합니다. 마스터가 명단에서 팀을 정해 주세요.'); return false; }
  }
  // 과녁판 중계 종목: 지금 찍힌 표시를 이 대결 기록에 옮기고, 과녁판은 비움 (먼저 던질 팀은 그대로)
  const mk = teamOpt(ev).board ? marksOf(ev) : null;
  const data = { event:ev, winner, blueId, redId, blueName: blueId?pname(blueId):null, redName: redId?pname(redId):null,
    by:UI.me, at:now(), deleted:false, ...extra };
  if(mk && mk.list.length){ data.marks = mk.list; data.markFirst = mk.first; }
  put(['main','matches',id], data);
  const patch = {}, pk = (D.calls[ev]||{}).pick;
  if(pk && (pk.blue || pk.red)) patch.pick = { blue:null, red:null };
  if(mk && mk.list.length) patch.marks = { list:[], first:mk.first, addN:0, addAt:0, at:now(), by:UI.me };
  if(Object.keys(patch).length) put(['main','calls',ev], patch);
  const label = winner==='draw' ? '무승부' : `${teamName(winner)} 승`;
  toast(`${label} 저장했습니다.`, '되돌리기', () => put(['main','matches',id], { event:ev, deleted:true, editedBy:UI.me, editedAt:now() }));
  return true;
}

/* ---------- 동작 ---------- */
Object.assign(ACT, {
  sub: (el, v) => { UI.sub[UI.ev] = v; },
  round: (el, v) => { const ev=UI.ev; if(roundMode(ev)===v) return false; if(lanesOf(ev).some(Boolean)){ toast('입력 중인 사람을 먼저 저장하거나 빼 주세요.'); return false; } UI.round[ev]=v; },
  // 연습 방식에서 칸의 회차 태그를 누르면 연습 1 ↔ 연습 2 (그 회차에 기록이 있으면 불러옴)
  laneRound: async (el) => {
    const ev=UI.ev, i=+el.dataset.i, L=lanesOf(ev)[i]; if(!L || (L.round!=='p1' && L.round!=='p2')) return false;
    const to = L.round==='p1' ? 'p2' : 'p1', cur = rec(ev, L.round, L.pid), r = rec(ev, to, L.pid);
    const dirty = L.throws.length && JSON.stringify(L.throws) !== JSON.stringify(cur ? cur.throws : []);
    if(dirty && !(await ask(`입력 중인 점수는 저장되지 않습니다.\n${ROUNDS[to]}(으)로 바꿀까요?`, '바꾸기', true))) return false;
    L.round = to; L.throws = r ? [...r.throws] : []; L.existing = !!r; if(r && r.dist) L.dist = r.dist;
    saveLanes();
  },
  ilRank: (el, v) => { ilRank = v; drawSheet(); return false; },
  pickFor: (el, v) => { if(!can.record(UI.ev)) return denied(); PK.ev = UI.ev; PK.lane = +v; PK.q = ''; PK.queue = false; openSheet(indivPickSheet); render(); return false; },
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
  // 숫자 직접 입력 종목: 입력 칸의 숫자를 한 차례 기록으로 넣음
  throwNum: (el) => {
    const ev=UI.ev, i=+el.dataset.i, L=lanesOf(ev)[i], inp=document.getElementById('numIn'+i); if(!L || !inp) return false;
    if(L.throws.length >= INDIV[ev].count) return false;
    const v = parseFloat(String(inp.value).replace(',', '.').trim());
    if(!isFinite(v) || v < 0 || v > 100000){ toast('0 이상의 숫자로 적어 주세요.'); inp.focus(); return false; }
    L.throws.push(Math.round(v*1000)/1000); saveLanes(); UI.numFocus = i;
    if(navigator.vibrate) navigator.vibrate(25);
  },
  unslot: (el) => { const L=lanesOf(UI.ev)[+el.dataset.i]; L.throws.splice(+el.dataset.k,1); saveLanes(); },
  undoThrow: (el) => { const L=lanesOf(UI.ev)[+el.dataset.i]; L.throws.pop(); saveLanes(); },
  dropLane: async (el) => { const ev=UI.ev, i=+el.dataset.i, L=lanesOf(ev)[i]; if(L.throws.length && !(await ask('입력한 점수를 저장하지 않고 뺄까요?','빼기',true))) return false; lanesOf(ev)[i] = null; saveLanes(); },
  dist: (el, v) => { lanesOf(UI.ev)[+el.dataset.i].dist = v; saveLanes(); },
  saveLane: async (el) => { await saveLane(UI.ev, +el.dataset.i); },
  editRec: (el, v) => { const ev=UI.ev; openSheet(() => recSheet(ev, v)); return false; },
  reopen: (el, v) => { const ev=UI.ev; if(!can.record(ev)) return denied();
    const pid = el.dataset.p, lanes = lanesOf(ev), free = lanes.findIndex(L => !L), at = lanes.findIndex(L => L && L.pid===pid);
    const mode = (v==='p1' || v==='p2') ? 'prac' : v;
    if(at<0 && free<0){ toast('입력 칸이 차 있습니다. 먼저 저장하거나 빼 주세요.'); return false; }
    if(at<0 && roundMode(ev)!==mode && lanes.some(Boolean)){ toast('입력 중인 사람을 먼저 저장하거나 빼 주세요.'); return false; }
    if(at>=0 && lanes[at].round!==v){
      const L = lanes[at], cur = rec(ev, L.round, pid);
      if(L.throws.length && JSON.stringify(L.throws)!==JSON.stringify(cur ? cur.throws : [])){ toast('입력 중인 점수를 먼저 저장하거나 빼 주세요.'); return false; }
    }
    UI.round[ev] = mode; addLane(ev, pid, at>=0 ? at : free, v); closeSheet(); },
  delRec: async (el, v) => { const ev=UI.ev; if(!can.record(ev)) return denied();
    if(!(await ask('이 기록을 지울까요?','지우기',true))) return false;
    const id=recId(ev,v,el.dataset.p), prev=D.indiv.find(r => r.id===id);
    put(['main','indiv',id], { event:ev, deleted:true, editedBy:UI.me, editedAt:now(), history:[...(prev?.history||[]), {throws:prev?.throws||[], by:prev?.editedBy||prev?.by, at:prev?.editedAt||prev?.at}].slice(-10) });
    toast('기록을 지웠습니다.', '되돌리기', () => put(['main','indiv',id], { event:ev, deleted:false })); closeSheet(); },
  win: (el, v) => { saveMatch(UI.ev, v); },
  // 대결 점수 기록: 점수 단추 · 직접 정하기 · 저장
  scStep: (el) => { const ev=UI.ev, S=scIn(ev), t=el.dataset.t; S[t] = Math.max(0, Math.round(((parseFloat(S[t])||0) + (+el.dataset.d))*1000)/1000); },
  scWin: (el, v) => { scIn(UI.ev).win = v || null; },
  saveScore: () => { const ev=UI.ev; if(!can.record(ev)) return denied();
    const S = scIn(ev), b = parseFloat(S.blue), r = parseFloat(S.red);
    if(isNaN(b) || isNaN(r) || b<0 || r<0){ toast('두 팀 점수를 0 이상의 숫자로 적어 주세요.'); return false; }
    if(saveMatch(ev, scWinner(ev), { blueScore:b, redScore:r })) UI.scoreIn[ev] = null; },
  pickSheet: (el, v) => { pickTeam = v; pickSort = 'order'; openSheet(pickSheet); return false; },
  setPick: (el, v) => { const ev=UI.ev; if(!can.record(ev)) return denied();
    put(['main','calls',ev], { pick:{ [pickTeam]: v || null } }); closeSheet(); },
  callPlayers: (el, v) => { const ev=UI.ev; if(!can.record(ev)) return denied();
    const k = v==='now' ? 0 : v==='next' ? 1 : (+v || 0), b = upcoming(ev,'blue',k), r = upcoming(ev,'red',k);
    if(!b || !r){ toast('부를 선수가 없습니다.'); return false; }
    put(['main','calls',ev], { call:{ at:now(), kind: k ? 'next' : 'now', blue:b, red:r, by:UI.me } }); closeSheet();
    toast(`안내판에 ${pname(b)} · ${pname(r)} 선수를 불렀습니다.`); return false; },
  listSheet: (el, v) => { listTab = v || (TEAM[UI.ev].mode==='round' ? 'rec' : 'order'); openSheet(listSheet); return false; },
  listTab: (el, v) => { listTab = v; drawSheet(); return false; },
  editMatch: (el, v) => { openSheet(() => matchSheet(v)); return false; },
  emWin: (el, v) => { const m=D.matches.find(x => x.id===v); if(!m || !can.record(m.event)) return denied();
    put(['main','matches',v], { event:m.event, winner: el.dataset.w, editedBy:UI.me, editedAt:now() }); toast('결과를 고쳤습니다.'); closeSheet(); },
  emTimes: (el, v) => { const m=D.matches.find(x => x.id===v); if(!m || !can.record(m.event)) return denied();
    const r=parseFloat($('#emR').value), b=parseFloat($('#emB').value);
    if(isNaN(r)||isNaN(b)){ toast('두 기록을 숫자로 적어 주세요.'); return false; }
    put(['main','matches',v], { event:m.event, redTime:r, blueTime:b, winner: r<b?'red': b<r?'blue':'draw', editedBy:UI.me, editedAt:now() }); toast('기록을 고쳤습니다.'); closeSheet(); },
  emScores: (el, v) => { const m=D.matches.find(x => x.id===v); if(!m || !can.record(m.event)) return denied();
    const b=parseFloat($('#emSB').value), r=parseFloat($('#emSR').value);
    if(isNaN(b)||isNaN(r)||b<0||r<0){ toast('두 점수를 0 이상의 숫자로 적어 주세요.'); return false; }
    put(['main','matches',v], { event:m.event, blueScore:b, redScore:r, winner: b>r?'blue': r>b?'red':'draw', editedBy:UI.me, editedAt:now() }); toast('점수를 고쳤습니다.'); closeSheet(); },
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
// 점수 입력 칸에 직접 적을 때: 화면을 다시 그리지 않고 결과 문구만 바꿈
document.addEventListener('input', e => {
  const el = e.target; if(el.dataset.in!=='sc') return;
  scIn(UI.ev)[el.dataset.t] = el.value;
  const r = document.getElementById('scRes'); if(r) r.textContent = scResText(UI.ev);
});
// 숫자 입력 칸에서 엔터를 누르면 '넣기'
document.addEventListener('keydown', e => {
  if(e.key!=='Enter' || !e.target.classList || !e.target.classList.contains('numin')) return;
  const b = e.target.closest('.lanebox').querySelector('.numgo'); if(b) b.click();
});
// 심판이 직접 적은 기록이 없으면 계시원이 보낸 기록을 씀
function runTimesOf(ev){ const tm = (D.calls[ev]||{}).times || {}, rt = UI.runTimes[ev] || {}; return { blue: rt.blue ?? tm.blue ?? '', red: rt.red ?? tm.red ?? '' }; }

/* ---------- 계시원 화면 ---------- */
function timerView(ev){
  const b = upNext(ev,'blue'), r = upNext(ev,'red'), tm = (D.calls[ev]||{}).times || {};
  return `<div class="fit timerfit">
    <div class="infobar"><b>⏱ 계시 · ${matchesOf(ev).length+1}번째 대결</b>${scoreline(tally(ev))}</div>
    <div class="duel small">${pcard(ev,'blue',b,false)}<div class="vsm">VS</div>${pcard(ev,'red',r,false)}</div>
    <div class="watch huge" id="watch">0.00</div>
    <div class="row nowrap timerstart"><button class="btn primary huge" data-a="watchToggle" id="watchBtn">시작</button><button class="btn" data-a="watchReset" aria-label="초기화" style="min-width:80px">↺</button></div>
    <div class="winrow"><button class="btn blue huge" data-a="sendTime" data-v="blue">→ ${esc(teamShort('blue'))} 보내기</button><button class="btn red huge" data-a="sendTime" data-v="red">→ ${esc(teamShort('red'))} 보내기</button></div>
    <div class="nextbar"><span class="sub">보낸 기록</span><span class="who">${teamBadge('blue')}<b>${tm.blue!=null ? fmtSec(tm.blue)+'초' : '-'}</b></span><span class="who">${teamBadge('red')}<b>${tm.red!=null ? fmtSec(tm.red)+'초' : '-'}</b></span>
      <span class="grow"></span>${tm.blue!=null || tm.red!=null ? '<button class="btn small" data-a="clearTimes">지우기</button>' : ''}</div>
  </div>`;
}
