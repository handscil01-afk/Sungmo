'use strict';
/* ===================== 마스터: 접속자·역할, 명단·설정 ===================== */

const ONLINE_MS = 5*60*1000;
function deviceRole(id){ return D.masters[id] ? { role:'master' } : (D.roles[id] && ROLE_INFO[D.roles[id].role] ? D.roles[id] : { role:'wait' }); }
function peopleView(){
  const list = D.devices.slice().sort((a,b) => {
    const wa = deviceRole(a.id).role==='wait', wb = deviceRole(b.id).role==='wait';
    return (wb-wa) || String(a.name||'').localeCompare(String(b.name||''),'ko');
  });
  const waiting = list.filter(d => deviceRole(d.id).role==='wait').length;
  const rows = list.map(d => {
    const r = deviceRole(d.id), on = d.seenAt && now()-d.seenAt < ONLINE_MS, me = store && d.id===store.uid;
    return `<div class="item tap" data-a="roleSheet" data-v="${d.id}">
      <span class="tag ${on?'ok':''}" title="${on?'접속 중':'연결 끊김'}">${on?'● 접속':'○ '+ago(d.seenAt)}</span>
      <span class="name">${esc(d.name||'(이름 없음)')}${me?' <span class="tag dark">이 기기</span>':''}<span class="sub">${esc(d.ua||'')}${on?'':' · 마지막 '+hm(d.seenAt)}</span></span>
      <span class="tag ${r.role==='wait'?'warn':r.role==='master'?'dark':r.role==='coach'?(r.team==='red'?'red':'blue'):''}">${ROLE_INFO[r.role].icon} ${esc(roleLabel(r))}</span></div>`;
  }).join('');
  return `<div class="card"><div class="row"><h2 class="grow h2" style="margin:0">접속한 기기 ${list.length}대</h2>${waiting?`<span class="tag warn">역할 대기 ${waiting}</span>`:''}</div>
      <p class="sub">각 기기에서 이름을 적고 들어오면 여기에 나타납니다. 줄을 누르면 역할을 정할 수 있고, 정하는 즉시 그 기기의 화면이 바뀝니다.</p>
      <div class="list">${rows || '<div class="empty">아직 접속한 기기가 없습니다.</div>'}</div></div>
    <div class="card"><h2>역할마다 보이는 화면</h2>
      <div class="list">
        <div class="item"><span class="tag">📋 감독</span><span class="name"><span class="sub">자기 팀의 단체전 출전 순서를 정하고, 상대 팀 순서와 지금 경기를 봅니다.</span></span></div>
        <div class="item"><span class="tag">🚩 심판</span><span class="name"><span class="sub">맡은 종목만 보입니다. 단체전은 지금·다음 선수와 승패 입력, 개인전은 가나다순 명단과 점수 입력입니다.</span></span></div>
        <div class="item"><span class="tag">📺 안내판</span><span class="name"><span class="sub">가로로 세워 둔 태블릿에 현황판을 크게 띄웁니다.</span></span></div>
      </div></div>`;
}
let roleDraft = { id:null, events:[] };
function roleSheet(){
  const id = roleDraft.id, d = D.devices.find(x => x.id===id) || { id, name: id===store.uid ? UI.me : '' };
  const r = deviceRole(id), me = id===store.uid;
  const evChips = Object.keys(EVENTS).map(ev => `<button class="chip ${roleDraft.events.includes(ev)?'on':''}" data-a="rdEv" data-v="${ev}">${EVENTS[ev].icon} ${esc(EVENTS[ev].name)}</button>`).join('');
  const isM = r.role==='master';
  return `<h2>${esc(d.name||'(이름 없음)')} <span class="sub">${esc(d.ua||'')}</span></h2>
    <p>지금 역할: <b>${ROLE_INFO[r.role].icon} ${esc(roleLabel(r))}</b></p>
    ${isM && !DEMO ? '<div class="note">마스터 권한이 있는 기기입니다. 다른 역할을 주려면 먼저 마스터 권한을 빼 주세요.</div>' : ''}
    <div class="card"><h2>감독</h2><div class="row nowrap">
      <button class="btn blue grow" data-a="setRole" data-v="coach" data-t="blue">${esc(teamName('blue'))} 감독</button>
      <button class="btn red grow" data-a="setRole" data-v="coach" data-t="red">${esc(teamName('red'))} 감독</button></div></div>
    <div class="card"><h2>심판 <span class="sub">맡을 종목을 고르세요 (여러 개 가능)</span></h2>
      <div class="chips">${evChips}</div>
      <div style="height:10px"></div><button class="btn primary wide" data-a="setRole" data-v="referee" ${roleDraft.events.length?'':'disabled'}>고른 종목의 심판으로 정하기</button></div>
    <div class="card"><div class="row"><button class="btn grow" data-a="setRole" data-v="board">📺 안내판으로 정하기</button><button class="btn grow" data-a="setRole" data-v="wait">⏳ 역할 없애기</button></div></div>
    ${DEMO && me ? '' : `<div class="card"><h2>그 밖의 일</h2><div class="row">
      ${isM ? (me ? '' : `<button class="btn danger grow" data-a="revokeMaster">👑 마스터 권한 빼기</button>`) : `<button class="btn grow" data-a="grantMaster">👑 마스터 권한 주기</button>`}
      ${me ? '' : '<button class="btn danger grow" data-a="removeDevice">목록에서 지우기</button>'}</div></div>`}
    <button class="btn wide" data-a="closeSheet">닫기</button>`;
}

/* ---------- 명단·설정 ---------- */
function settingsView(){
  const ps = people(), s = settings();
  const cnt = { red:ps.filter(p => p.team==='red').length, blue:ps.filter(p => p.team==='blue').length };
  const rows = ps.map(p => `<div class="item" style="flex-wrap:wrap">${teamBadge(p.team)}<span class="name">${esc(p.name)}</span>
      <div class="seg"><button class="${p.team==='blue'?'on blue':''}" data-a="setTeam" data-v="${p.id}" data-t="blue">${esc(teamShort('blue'))}</button><button class="${p.team==='red'?'on red':''}" data-a="setTeam" data-v="${p.id}" data-t="red">${esc(teamShort('red'))}</button><button class="${!p.team?'on':''}" data-a="setTeam" data-v="${p.id}" data-t="">미정</button></div>
      <button class="btn small" data-a="renameP" data-v="${p.id}">이름</button><button class="btn small danger" data-a="delP" data-v="${p.id}">삭제</button></div>`).join('');
  return `<div class="cols half"><div>
  <div class="card"><h2>팀 이름</h2>
    <div class="row nowrap">${teamBadge('blue')}<input id="tnBlue" value="${esc(teamName('blue'))}" autocomplete="off">${teamBadge('red')}<input id="tnRed" value="${esc(teamName('red'))}" autocomplete="off"></div>
    <div style="height:10px"></div><button class="btn wide" data-a="saveTeamNames">팀 이름 저장</button>
    <p class="sub">화면에는 팀 이름의 첫 글자(${esc(teamShort('blue'))}·${esc(teamShort('red'))})가 팀 표시로 쓰입니다. ${esc(teamShort('blue'))}은 동그라미, ${esc(teamShort('red'))}은 네모 모양입니다.</p></div>
  <div class="card"><h2>명단 붙여넣기</h2>
    <p class="sub">한 줄에 한 명씩 적습니다. 이름 뒤에 띄어 쓰고 <b>청</b>이나 <b>홍</b>(또는 청팀·홍팀·파랑·빨강)을 적으면 팀도 함께 정해집니다.</p>
    <textarea id="rosterText" data-in="roster" placeholder="홍길동 청&#10;김영희 홍&#10;이철수">${esc(UI.rosterText)}</textarea>
    <div style="height:10px"></div><button class="btn primary wide" data-a="addRoster">명단에 넣기</button></div>
  <div class="card"><h2>아직 정하지 못한 점수</h2>
    <div class="row" style="margin-bottom:12px"><span class="grow">투호 2m 미만</span><div class="seg"><button class="${s.tuhoShort===0?'on':''}" data-a="setS" data-k="tuhoShort" data-v="0">0점</button><button class="${s.tuhoShort===5?'on':''}" data-a="setS" data-k="tuhoShort" data-v="5">5점</button></div></div>
    <div class="row"><span class="grow">후리볼 파울</span><div class="seg"><button class="${s.foul===1?'on':''}" data-a="setS" data-k="foul" data-v="1">1점</button><button class="${s.foul===1.5?'on':''}" data-a="setS" data-k="foul" data-v="1.5">1.5점</button></div></div>
    <p class="sub">바꾸면 이미 입력한 기록의 점수도 자동으로 다시 계산됩니다.</p></div>
  <div class="card"><h2>결과 내려받기</h2>
    <div class="row"><button class="btn grow" data-a="csv" data-v="indiv">개인전 기록 (엑셀용 CSV)</button><button class="btn grow" data-a="csv" data-v="team">단체전 기록 (엑셀용 CSV)</button></div></div>
  </div><div>
  <div class="card"><div class="row"><h2 class="grow h2" style="margin:0">참여자 ${ps.length}명</h2><span class="tag blue">${esc(teamShort('blue'))} ${cnt.blue}</span><span class="tag red">${esc(teamShort('red'))} ${cnt.red}</span>${ps.length-cnt.red-cnt.blue?`<span class="tag warn">미정 ${ps.length-cnt.red-cnt.blue}</span>`:''}</div>
    <div class="list">${rows || '<div class="empty">아직 명단이 없습니다.</div>'}</div></div>
  </div></div>`;
}

function parseRoster(text){
  const words = {
    blue: [teamName('blue'), '청팀', '청', '파랑', '파랑팀', '블루', 'blue'].map(w => w.toLowerCase()),
    red:  [teamName('red'), '홍팀', '홍', '빨강', '빨강팀', '레드', 'red'].map(w => w.toLowerCase()),
  };
  const out = [];
  text.split(/\r?\n|,|\t/).forEach(line => {
    const s = line.trim().replace(/^\d+[.)]\s*/, ''); if(!s) return;
    // 팀 이름은 떨어진 낱말일 때만 인정 (이름 안의 '홍'은 그대로 둠)
    let team = ''; const keep = [];
    s.replace(/[()\[\]\-:/]/g, ' ').split(/\s+/).filter(Boolean).forEach(tk => {
      const low = tk.toLowerCase();
      if(keep.length && words.blue.includes(low)) team = 'blue';
      else if(keep.length && words.red.includes(low)) team = 'red';
      else keep.push(tk);
    });
    const name = keep.join(' ');
    if(name) out.push({ name, team });
  });
  return out;
}
function csv(kind){
  const rows = [];
  const q = v => { const s=String(v??''); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
  const t = v => v ? new Date(v).toLocaleString('ko-KR') : '';
  if(kind==='indiv'){
    rows.push(['종목','구분','이름','팀','1회','2회','3회','4회','5회','합계','거리','입력자','입력 시각','수정자','수정 시각']);
    Object.entries(INDIV).forEach(([ev,E]) => { const m = optMap(ev);
      D.indiv.filter(r => r.event===ev && !r.deleted && (r.throws||[]).length).forEach(r => {
        const pts = Array.from({length:5}, (_,k) => r.throws[k]!=null ? (m[r.throws[k]]?.v ?? 0) : '');
        rows.push([E.name, r.round==='final'?'결승':'본경기', pname(r.personId), teamName(teamOf(r.personId)), ...pts, totalOf(ev,r.throws), r.dist?r.dist+'m':'', r.by||'', t(r.at), r.editedBy||'', t(r.editedAt)]);
      }); });
  } else {
    rows.push(['종목','순번',teamName('blue')+' 선수',teamName('red')+' 선수','결과',teamName('blue')+' 기록(초)',teamName('red')+' 기록(초)','입력자','입력 시각','수정자','수정 시각']);
    Object.entries(TEAM).forEach(([ev,E]) => matchesOf(ev).forEach((m,i) => rows.push([E.name, i+1, m.blueId?pname(m.blueId):'', m.redId?pname(m.redId):'',
      m.winner==='draw' ? '무승부' : teamName(m.winner)+' 승', m.blueTime??'', m.redTime??'', m.by||'', t(m.at), m.editedBy||'', t(m.editedAt)])));
  }
  const blob = new Blob(['﻿'+rows.map(r => r.map(q).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `가을운동회_${kind==='indiv'?'개인전':'단체전'}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// 연습 모드에서는 혼자 시험해 볼 수 있도록 자기 역할을 직접 정할 수 있음
const canAssign = () => can.master() || DEMO;
Object.assign(ACT, {
  roleSheet: (el, v) => { const r = deviceRole(v); roleDraft = { id:v, events: r.role==='referee' ? [...(r.events||[])] : [] }; openSheet(roleSheet); return false; },
  rdEv: (el, v) => { const a = roleDraft.events; a.includes(v) ? a.splice(a.indexOf(v),1) : a.push(v); drawSheet(); return false; },
  setRole: async (el, v) => {
    if(!canAssign()) return denied();
    const id = roleDraft.id, d = D.devices.find(x => x.id===id), name = d?.name || (id===store.uid ? UI.me : '');
    if(D.masters[id] && !DEMO){ toast('먼저 마스터 권한을 빼 주세요.'); return false; }
    if(DEMO && D.masters[id] && !(await guard(store.del(['main','masters',id])))) return false;
    let ok;
    if(v==='wait') ok = await guard(store.del(['main','roles',id]));
    else {
      const role = { role:v, name, by:UI.me, at:now() };
      if(v==='coach') role.team = el.dataset.t;
      if(v==='referee') role.events = roleDraft.events.slice();
      ok = await put(['main','roles',id], role, false);
    }
    if(ok){ closeSheet(); toast(`${name}: ${v==='wait' ? '역할을 없앴습니다.' : roleLabel(D.roles[id] || { role:v, team:el.dataset.t, events:roleDraft.events })+'(으)로 정했습니다.'}`); }
  },
  grantMaster: async () => {
    if(!can.master()) return denied();
    const id = roleDraft.id, d = D.devices.find(x => x.id===id);
    if(!(await ask(`${d?.name||''} 기기에 마스터 권한을 줄까요?\n모든 기록과 역할을 바꿀 수 있게 됩니다.`, '권한 주기'))) return false;
    if(await put(['main','masters',id], { name:d?.name||'', by:UI.me, at:now() }, false)){ await guard(store.del(['main','roles',id])); closeSheet(); toast('마스터 권한을 줬습니다.'); }
  },
  revokeMaster: async () => {
    if(!can.master()) return denied();
    if(await guard(store.del(['main','masters',roleDraft.id]))){ closeSheet(); toast('마스터 권한을 뺐습니다.'); }
  },
  removeDevice: async () => {
    if(!can.master()) return denied();
    const id = roleDraft.id, d = D.devices.find(x => x.id===id);
    if(!(await ask(`${d?.name||''} 기기를 목록에서 지울까요?\n그 기기는 다시 이름을 적고 들어와야 합니다.`, '지우기', true))) return false;
    await guard(Promise.all([store.del(['main','roles',id]), store.del(['main','masters',id]), store.del(['main','devices',id])]));
    closeSheet();
  },
  saveTeamNames: () => {
    const b = $('#tnBlue').value.trim(), r = $('#tnRed').value.trim();
    if(!b || !r){ toast('두 팀 이름을 모두 적어 주세요.'); return false; }
    setConfig({ teamNames:{ blue:b, red:r } }); toast('팀 이름을 저장했습니다.');
  },
  addRoster: () => {
    if(!can.master()) return denied();
    const list = parseRoster(UI.rosterText); if(!list.length){ toast('붙여넣은 이름이 없습니다.'); return false; }
    const cur = people(), add = {}, t0 = now(); let n=0, u=0;
    list.forEach((x,k) => { const ex = cur.find(p => p.name===x.name);
      if(ex){ if(x.team && ex.team!==x.team){ add[ex.id] = { team:x.team }; u++; } }
      else { add['p'+uid()] = { name:x.name, team:x.team, createdAt:t0+k, deleted:false }; n++; } });
    setConfig({ people:add }); UI.rosterText=''; toast(`${n}명을 넣었습니다.${u?` (${u}명은 팀만 바꿈)`:''}`);
  },
  setTeam: (el, v) => { setConfig({ people:{ [v]:{ team: el.dataset.t } } }); return false; },
  renameP: async (el, v) => { const p = person(v), n = await askText('이름 고치기', p?.name||''); if(n && n.trim()) setConfig({ people:{ [v]:{ name:n.trim() } } }); return false; },
  delP: async (el, v) => { const p = person(v); if(!(await ask(`${p?.name}을(를) 명단에서 지울까요?\n이미 입력한 기록은 그대로 남습니다.`,'지우기',true))) return false; setConfig({ people:{ [v]:{ deleted:true } } }); return false; },
  setS: (el, v) => { setConfig({ settings:{ [el.dataset.k]: parseFloat(v) } }); return false; },
  csv: (el, v) => { csv(v); return false; },
});
