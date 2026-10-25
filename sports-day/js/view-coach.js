'use strict';
/* ===================== 감독 화면 · 출전 순서 (끌어다 놓기) ===================== */

function coachView(team){
  const ev = UI.ev, other = team==='blue' ? 'red' : 'blue';
  const b = upNext(ev,'blue'), r = upNext(ev,'red');
  return evHead(ev, scoreline(tally(ev))) + `
    <div class="card"><div class="row"><h2 class="grow h2" style="margin:0">지금 경기 <span class="sub">${matchesOf(ev).length+1}번째 대결</span></h2></div>
      <div class="nextline" style="margin-top:10px"><span class="who">${teamBadge('blue')}${b.cur?esc(pname(b.cur)):'-'}</span><span class="sub">vs</span><span class="who">${teamBadge('red')}${r.cur?esc(pname(r.cur)):'-'}</span></div>
      <div class="sub" style="margin-top:6px">다음: ${b.next?esc(pname(b.next)):'-'} vs ${r.next?esc(pname(r.next)):'-'}</div></div>
    <div class="coachgrid">${poolCard(ev, team)}${orderListCard(ev, team)}${orderCard(ev, other)}</div>`;
}
function orderBoth(ev){
  return evHead(ev, scoreline(tally(ev))) + `<div class="cols half">${TEAM_KEYS.map(t => `<div>${poolCard(ev, t)}${orderListCard(ev, t)}</div>`).join('')}</div>`;
}
// 아직 순서에 넣지 않은 팀원: 누르면 맨 뒤에 추가, 끌어서 원하는 자리에 넣기
function poolCard(ev, team){
  const saved = orderSaved(ev, team), pl = plays(ev, team);
  const pool = members(team).filter(id => !saved.includes(id));
  return `<div class="card"><div class="row"><h2 class="grow row h2" style="margin:0">${teamBadge(team)} 아직 배치하지 않은 팀원</h2><span class="tag">${pool.length}명</span></div>
    <p class="sub">누르면 순서 맨 뒤에 들어가고, 끌어다 놓으면 놓은 자리에 들어갑니다.</p>
    <div class="dropzone pool" data-zone="pool" data-t="${team}">
      ${pool.map(id => `<button class="pchip" data-drag="pool" data-id="${id}" data-a="oadd" data-t="${team}" data-v="${id}">${esc(pname(id))}${pl[id]?` <span class="tag ok">✓${pl[id]}</span>`:''}</button>`).join('')
        || '<div class="empty" style="padding:10px">모두 배치했습니다.</div>'}
    </div>
    ${pool.length && saved.length ? '<p class="sub" style="margin:8px 0 0">배치하지 않은 팀원은 경기 때 순서 맨 뒤에 가나다순으로 자동으로 붙습니다.</p>' : ''}</div>`;
}
function orderListCard(ev, team){
  const saved = orderSaved(ev, team), pl = plays(ev, team), u = upNext(ev, team);
  const rows = saved.map((id,i) => {
    const locked = !!pl[id];
    return `<div class="orow ${id===u.cur?'cur':''} ${locked?'done':''}" data-oid="${id}">
      ${locked ? '<span class="handle off" title="경기를 마쳐 고정됨">✓</span>' : `<span class="handle" data-drag="order" data-id="${id}" aria-label="끌어서 옮기기">⠿</span>`}
      <span class="no">${i+1}</span><span class="name">${esc(pname(id))}</span>
      ${id===u.cur?'<span class="tag dark">지금</span>':id===u.next?'<span class="tag warn">다음</span>':''}${locked?`<span class="tag ok">${pl[id]}회</span>`:''}
      ${locked ? '' : `<button class="xbtn" data-a="oremove" data-t="${team}" data-v="${id}" aria-label="순서에서 빼기">✕</button>`}</div>`;
  }).join('');
  return `<div class="card"><div class="row"><h2 class="grow row h2" style="margin:0">${teamBadge(team)} ${esc(teamName(team))} 출전 순서</h2><span class="tag">${saved.length}명</span></div>
    <p class="sub">왼쪽 ⠿ 손잡이를 끌어 순서를 바꿉니다. 팀원 칸으로 끌어다 놓거나 ✕를 누르면 순서에서 빠집니다.</p>
    <div class="dropzone order" data-zone="order" data-t="${team}">${rows || '<div class="empty dz-empty">팀원을 눌러서 또는 끌어다 놓아서 순서를 정해 주세요.</div>'}</div>
    ${saved.length ? `<div class="row" style="margin-top:12px"><button class="btn grow" data-a="ocopy" data-t="${team}">다른 종목에도 같은 순서 적용</button><button class="btn danger" data-a="oclear" data-t="${team}">비우기</button></div>
      <p class="sub">이미 경기를 마친 선수(✓)는 순서가 고정됩니다.</p>` : ''}</div>`;
}
// 상대 팀 순서 (보기만)
function orderCard(ev, team){
  const ord = orderFor(ev, team), saved = orderSaved(ev, team), pl = plays(ev, team), u = upNext(ev, team);
  const rows = ord.map((id,i) => `<div class="item ${id===u.cur?'cur':''} ${pl[id]?'done':''}"><span class="no">${i+1}</span><span class="name">${esc(pname(id))}</span>
      ${id===u.cur?'<span class="tag dark">지금</span>':id===u.next?'<span class="tag warn">다음</span>':''}${pl[id]?`<span class="tag ok">✓ ${pl[id]}회</span>`:''}${saved.includes(id)?'':'<span class="tag">자동</span>'}</div>`).join('');
  return `<div class="card"><div class="row"><h2 class="grow row h2" style="margin:0">${teamBadge(team)} ${esc(teamName(team))} 순서</h2><span class="tag">상대 팀 · 보기만</span></div>
    <div class="list olist" style="margin-top:8px">${rows || '<div class="empty">이 팀에 배정된 사람이 없습니다.</div>'}</div></div>`;
}
function saveOrder(ev, team, list){
  if(!can.order(team)) return denied();
  return put(['main','orders',`${ev}_${team}`], { event:ev, team, list, by:UI.me, at:now() }, false);
}

/* ---------- 끌어다 놓기 ---------- */
const DRAG = { pending:null, active:false, suppress:0, ghost:null, line:null, target:null, scrollTimer:0 };
document.addEventListener('pointerdown', e => {
  const h = e.target.closest('[data-drag]'); if(!h || e.button>0) return;
  const zone = h.closest('[data-zone]'); if(!zone || !can.order(zone.dataset.t)) return;
  DRAG.pending = { x:e.clientX, y:e.clientY, id:h.dataset.id, from:h.dataset.drag, team:zone.dataset.t, ev:UI.ev, el:h.closest('.orow, .pchip') };
});
document.addEventListener('pointermove', e => {
  const P = DRAG.pending; if(!P) return;
  if(!DRAG.active){
    if(Math.hypot(e.clientX-P.x, e.clientY-P.y) < 8) return;
    DRAG.active = true;
    const r = P.el.getBoundingClientRect();
    const g = P.el.cloneNode(true); g.classList.add('ghost'); g.style.width = r.width+'px';
    P.dx = P.x - r.left; P.dy = P.y - r.top;
    document.body.appendChild(g); DRAG.ghost = g;
    P.el.classList.add('dragging');
    DRAG.line = document.createElement('div'); DRAG.line.className = 'dropline';
    if(navigator.vibrate) navigator.vibrate(20);
  }
  e.preventDefault();
  DRAG.ghost.style.transform = `translate(${e.clientX-P.dx}px, ${e.clientY-P.dy}px)`;
  findTarget(e.clientX, e.clientY);
  // 화면 끝으로 끌면 자동으로 스크롤
  clearInterval(DRAG.scrollTimer);
  const edge = 90, y = e.clientY;
  if(y < edge || y > innerHeight-edge){
    const dy = y < edge ? -14 : 14;
    DRAG.scrollTimer = setInterval(() => { window.scrollBy(0, dy); findTarget(e.clientX, e.clientY); }, 30);
  }
}, { passive:false });
function findTarget(x, y){
  const P = DRAG.pending;
  document.querySelectorAll('.dropzone.over').forEach(z => z.classList.remove('over'));
  const under = document.elementFromPoint(x, y);
  const zone = under && under.closest('[data-zone]');
  DRAG.target = null;
  if(!zone || zone.dataset.t!==P.team){ DRAG.line.remove(); return; }
  if(zone.dataset.zone==='pool'){
    DRAG.line.remove();
    if(P.from==='order'){ zone.classList.add('over'); DRAG.target = { zone:'pool' }; }
    return;
  }
  const rows = [...zone.querySelectorAll('.orow:not(.dragging)')];
  let idx = rows.findIndex(row => { const r = row.getBoundingClientRect(); return y < r.top + r.height/2; });
  if(idx < 0) idx = rows.length;
  // 이미 뛴 선수(고정)보다 앞에는 넣지 않음
  const lastLocked = rows.reduce((k, row, i) => row.classList.contains('done') ? i+1 : k, 0);
  idx = Math.max(idx, lastLocked);
  if(idx < rows.length) zone.insertBefore(DRAG.line, rows[idx]); else zone.appendChild(DRAG.line);
  zone.classList.add('over');
  DRAG.target = { zone:'order', idx };
}
function endDrag(drop){
  const P = DRAG.pending; DRAG.pending = null;
  clearInterval(DRAG.scrollTimer);
  if(!DRAG.active) return;
  DRAG.active = false; DRAG.suppress = now();
  DRAG.ghost && DRAG.ghost.remove(); DRAG.line && DRAG.line.remove();
  document.querySelectorAll('.dropzone.over').forEach(z => z.classList.remove('over'));
  const T = DRAG.target; DRAG.target = null;
  if(drop && T){
    const list = orderSaved(P.ev, P.team).filter(id => id!==P.id);
    if(T.zone==='order') list.splice(T.idx, 0, P.id);
    if(T.zone==='pool' && plays(P.ev, P.team)[P.id]){ toast('이미 경기를 마친 선수는 뺄 수 없습니다.'); }
    else saveOrder(P.ev, P.team, list);
  }
  render();
}
document.addEventListener('pointerup', () => endDrag(true));
document.addEventListener('pointercancel', () => endDrag(false));
// 끌어다 놓은 직후에 생기는 클릭(눌러서 추가)은 무시
document.addEventListener('click', e => { if(now()-DRAG.suppress < 400 && e.target.closest('[data-drag]')){ e.stopPropagation(); e.preventDefault(); } }, true);

Object.assign(ACT, {
  oadd: (el, v) => { const ev=UI.ev, t=el.dataset.t; saveOrder(ev, t, [...orderSaved(ev, t), v]); return false; },
  oremove: (el, v) => { const ev=UI.ev, t=el.dataset.t; if(plays(ev,t)[v]){ toast('이미 경기를 마친 선수는 뺄 수 없습니다.'); return false; }
    saveOrder(ev, t, orderSaved(ev, t).filter(id => id!==v)); return false; },
  oclear: async (el) => { const ev=UI.ev, t=el.dataset.t, pl=plays(ev,t);
    if(!(await ask(`${teamName(t)} ${EVENTS[ev].name} 순서를 비울까요?\n이미 경기를 마친 선수는 그대로 남습니다.`, '비우기', true))) return false;
    saveOrder(ev, t, orderSaved(ev, t).filter(id => pl[id])); return false; },
  ocopy: async (el) => {
    const ev = UI.ev, team = el.dataset.t;
    if(!(await ask(`${teamName(team)}의 지금 순서를 다른 단체전 종목에도 똑같이 적용할까요?`, '적용'))) return false;
    const ord = orderSaved(ev, team);
    ORDER_EVENTS.filter(k => k!==ev).forEach(k => saveOrder(k, team, ord));
    toast('다른 종목에도 같은 순서를 적용했습니다.'); return false;
  },
});
