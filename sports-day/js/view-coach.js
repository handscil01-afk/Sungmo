'use strict';
/* ===================== 감독 화면 · 출전 순서 ===================== */

function coachView(team){
  const ev = UI.ev, other = team==='blue' ? 'red' : 'blue';
  const b = upNext(ev,'blue'), r = upNext(ev,'red');
  return evHead(ev, scoreline(tally(ev))) + `
    <div class="card"><div class="row"><h2 class="grow h2" style="margin:0">지금 경기 <span class="sub">${matchesOf(ev).length+1}번째 대결</span></h2></div>
      <div class="nextline" style="margin-top:10px"><span class="who">${teamBadge('blue')}${b.cur?esc(pname(b.cur)):'-'}</span><span class="sub">vs</span><span class="who">${teamBadge('red')}${r.cur?esc(pname(r.cur)):'-'}</span></div>
      <div class="sub" style="margin-top:6px">다음: ${b.next?esc(pname(b.next)):'-'} vs ${r.next?esc(pname(r.next)):'-'}</div></div>
    <div class="cols half">${orderCard(ev, team, can.order(team))}${orderCard(ev, other, false)}</div>`;
}
function orderBoth(ev){
  return evHead(ev, scoreline(tally(ev))) + `<div class="cols half">${TEAM_KEYS.map(t => orderCard(ev, t, can.order(t))).join('')}</div>`;
}
function orderCard(ev, team, editable){
  const ord = orderFor(ev, team), pl = plays(ev, team), u = upNext(ev, team);
  const rows = ord.map((id,i) => {
    const locked = !!pl[id], prevLocked = i>0 && !!pl[ord[i-1]];
    const move = editable && !locked ? `<button class="btn small" data-a="omove" data-t="${team}" data-v="${i}" data-d="-1" ${i===0||prevLocked?'disabled':''} aria-label="위로">▲</button><button class="btn small" data-a="omove" data-t="${team}" data-v="${i}" data-d="1" ${i===ord.length-1?'disabled':''} aria-label="아래로">▼</button>` : '';
    return `<div class="item ${id===u.cur?'cur':''} ${locked?'done':''}"><span class="no">${i+1}</span><span class="name">${esc(pname(id))}</span>
      ${id===u.cur?'<span class="tag dark">지금</span>':id===u.next?'<span class="tag warn">다음</span>':''}${locked?`<span class="tag ok">✓ ${pl[id]}회</span>`:''}${move}</div>`;
  }).join('');
  return `<div class="card"><div class="row"><h2 class="grow row h2" style="margin:0">${teamBadge(team)} ${esc(teamName(team))} 순서</h2>${editable?'':'<span class="tag">보기만</span>'}</div>
    <div class="list olist" style="margin-top:8px">${rows || '<div class="empty">이 팀에 배정된 사람이 없습니다.</div>'}</div>
    ${editable && ord.length ? `<div style="height:10px"></div><button class="btn wide" data-a="ocopy" data-t="${team}">이 순서를 다른 단체전 종목에도 똑같이 적용</button>
      <p class="sub">이미 경기를 마친 선수(✓)는 순서가 고정됩니다.</p>` : ''}</div>`;
}
function saveOrder(ev, team, list){
  if(!can.order(team)) return denied();
  return put(['main','orders',`${ev}_${team}`], { event:ev, team, list, by:UI.me, at:now() }, false);
}
Object.assign(ACT, {
  omove: (el, v) => {
    const ev = UI.ev, team = el.dataset.t, ord = orderFor(ev, team), k = +v, d = +el.dataset.d;
    if(!ord[k+d]) return false;
    [ord[k], ord[k+d]] = [ord[k+d], ord[k]];
    saveOrder(ev, team, ord); return false;
  },
  ocopy: async (el) => {
    const ev = UI.ev, team = el.dataset.t;
    if(!(await ask(`${teamName(team)}의 지금 순서를 다른 단체전 종목에도 똑같이 적용할까요?`, '적용'))) return false;
    const ord = orderFor(ev, team);
    ORDER_EVENTS.filter(k => k!==ev).forEach(k => saveOrder(k, team, ord));
    toast('다른 종목에도 같은 순서를 적용했습니다.'); return false;
  },
});
