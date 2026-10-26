'use strict';
/* ===================== 개인전 부스별 대기 줄 =====================
   main/queues/{종목} = { event, list:[사람 번호…], by, at } 문서 하나에 그 부스의 대기 순서를 통째로 저장함.
   심판·기록 도우미가 고치고(can.record), 안내판·진행 현황·중계 모드는 대기 인원만 읽음 */
const QU = { ev:'' };

// 대기 줄을 저장. 저장이 서버에 닿기 전에도 바로 보이도록 화면용 자료를 먼저 고침 (연달아 눌러도 앞의 것이 사라지지 않게)
function saveQueue(ev, list){
  if(!can.record(ev)){ denied(); return Promise.resolve(false); }
  const d = { event:ev, list, by:UI.me, at:now() };
  D.queues = { ...D.queues, [ev]: { id:ev, ...d } };
  return put(['main','queues',ev], d, false);
}
// 칸에 넣었거나 기록을 저장한 사람은 대기 줄에서 뺌 (권한이 없는 기기는 조용히 넘어감)
function qDrop(ev, pid){
  const q = qList(ev);
  if(q.includes(pid) && can.record(ev)) saveQueue(ev, q.filter(id => id!==pid));
}
// 다른 부스의 대기 인원: '다른 부스 대기: 후리볼 1 · 투호 0'
function qOtherLine(ev){
  const others = Object.keys(INDIV).filter(k => k!==ev);
  if(!others.length) return '';
  return `<div class="qother">다른 부스 대기: ${others.map(k => `<span>${esc(INDIV[k].name)} <b>${qList(k).length}</b></span>`).join(' · ')}</div>`;
}
// 대기 줄의 한 줄: 번호 · 이름 · 지금 입력 방식의 회차 배지 · 위·아래·빼기
function queueSheet(){
  const ev = QU.ev, E = INDIV[ev]; if(!E) return '<p>종목을 찾을 수 없습니다.</p><button class="btn wide" data-a="closeSheet">닫기</button>';
  const q = qList(ev), edit = can.record(ev), mode = roundMode(ev);
  const rows = q.map((id, i) => {
    const R = recsOf(ev, id);
    const bd = mode==='prac' ? rbadge(ev,'p1',R.p1,{focus:true}) + rbadge(ev,'p2',R.p2,{focus:true}) : mode==='main' ? rbadge(ev,'main',R.main,{focus:true}) : rbadge(ev,'final',R.final,{focus:true});
    return `<div class="item qrow2" data-pid="${id}"><span class="qno on">${i+1}</span><span class="name">${esc(pname(id))}<span class="badges">${bd}</span></span>
      ${edit ? `<span class="qbtns"><button class="ibtn" data-a="qMove" data-v="${id}" data-d="-1" ${i===0?'disabled':''} aria-label="${esc(pname(id))} 위로">▲</button><button class="ibtn" data-a="qMove" data-v="${id}" data-d="1" ${i===q.length-1?'disabled':''} aria-label="${esc(pname(id))} 아래로">▼</button><button class="ibtn danger" data-a="qDel" data-v="${id}" aria-label="${esc(pname(id))} 대기에서 빼기">✕</button></span>` : ''}</div>`;
  }).join('');
  return `<h2>${E.icon} ${esc(E.name)} 대기 <small class="sub">${q.length}명</small></h2>
    ${edit ? '<button class="btn primary wide" data-a="qAddOpen" style="margin-bottom:10px">＋ 대기 추가</button>' : ''}
    <div class="list sheetlist" style="--ev:${E.color}">${rows || '<div class="empty">대기 중인 사람이 없습니다.</div>'}</div>
    <p class="sub">빈 칸에 있는 \'대기 1번 넣기\' 단추를 누르면 맨 앞 사람이 칸으로 들어가고 대기에서 빠집니다.</p>
    ${edit && q.length ? '<button class="btn danger wide" data-a="qClear" style="margin-bottom:8px">모두 비우기</button>' : ''}
    <button class="btn primary wide" data-a="closeSheet">닫기</button>`;
}

Object.assign(ACT, {
  qSheet: () => { QU.ev = UI.ev; openSheet(queueSheet); return false; },
  qAddOpen: () => { if(!can.record(QU.ev)) return denied(); PK.ev = QU.ev; PK.q = ''; PK.queue = true; openSheet(indivPickSheet); return false; },
  qBack: () => { PK.queue = false; openSheet(queueSheet); return false; },
  // 대기 추가 창에서 이름을 누를 때마다 바로 맨 뒤에 붙이고, 이미 있으면 뺌
  qToggle: (el, v) => { const ev = PK.ev; if(!can.record(ev)) return denied();
    const q = qList(ev); saveQueue(ev, q.includes(v) ? q.filter(id => id!==v) : [...q, v]); },
  qMove: (el, v) => { const ev = QU.ev; if(!can.record(ev)) return denied();
    const q = qList(ev), i = q.indexOf(v), j = i + (+el.dataset.d);
    if(i<0 || j<0 || j>=q.length) return false;
    [q[i], q[j]] = [q[j], q[i]]; saveQueue(ev, q); },
  qDel: (el, v) => { const ev = QU.ev; if(!can.record(ev)) return denied(); saveQueue(ev, qList(ev).filter(id => id!==v)); },
  qClear: async () => { const ev = QU.ev; if(!can.record(ev)) return denied();
    if(!(await ask(`${INDIV[ev].name} 대기 ${qList(ev).length}명을 모두 비울까요?`, '비우기', true))) return false;
    saveQueue(ev, []); },
  // 빈 칸의 '대기 1번 ○○○ 넣기': 대기 맨 앞 사람을 이 칸에 넣음 (칸에 넣으면 대기에서 자동으로 빠짐)
  qFill: (el, v) => { const ev = UI.ev; if(!can.record(ev)) return denied();
    const i = +v, lanes = lanesOf(ev); if(lanes[i]) return false;
    const pid = qList(ev).find(id => !lanes.some(x => x && x.pid===id));
    if(!pid){ toast('대기 중인 사람이 없습니다.'); return false; }
    addLane(ev, pid, i); },
});
