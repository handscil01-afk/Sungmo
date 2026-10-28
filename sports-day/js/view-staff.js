'use strict';
/* ===================== 접속자·역할 · 담당자 명단 · 출석 체크 ===================== */

const ONLINE_MS = 5*60*1000;
function deviceRole(id){
  if(D.masters[id]) return { ...normRole(null), role:'master' };
  const r = normRole(D.roles[id]); r.role = r.board ? 'board' : hasDuty(r) ? 'staff' : 'wait'; return r;
}
const asRole = p => { const r = normRole(p); r.role = r.board ? 'board' : hasDuty(r) ? 'staff' : 'wait'; return r; };
const roleTagCls = r => r.role==='wait' ? 'warn' : r.role==='master' ? 'dark' : r.coach ? (r.coach==='red' ? 'red' : 'blue') : '';
// monitor는 켜져 있을 때만 넣음: 규칙을 아직 올리지 않은 서버에서도 예전 담당자 선택이 막히지 않게 (없으면 꺼짐으로 읽음)
// 중계 모드(보이스오버용 간단 화면)는 monitor 값을 true 대신 'voice'로 저장함
// 꺼진 종목이 들어 있는 역할도 목록을 그대로 옮김 (담당자 명단과 달라지면 서버 규칙이 막으므로, 다시 켜면 돌아오게 데이터는 지키고 화면에서만 숨김)
const pickRoleFields = r => { const n = normRole(r), raw = r || {}, keep = k => Array.isArray(raw[k]) ? [...raw[k]] : n[k];
  return { coach:n.coach, events:keep('events'), helpers:keep('helpers'), timers:keep('timers'), board:n.board, cast:n.cast, ...(n.monitor ? { monitor: n.voice ? 'voice' : true } : {}) }; };
function presetList(){
  return Object.entries(D.presets).map(([id,p]) => ({ id, ...p }))
    .sort((a,b) => (!!a.volunteer - !!b.volunteer) || String(a.label||'').localeCompare(String(b.label||''), 'ko'));
}
const presetUse = pid => Object.values(D.roles).filter(r => r && r.preset===pid).length;

/* ---------- 마스터: 접속자·역할 화면 ---------- */
function peopleView(){
  const list = D.devices.slice().sort((a,b) => {
    const wa = deviceRole(a.id).role==='wait', wb = deviceRole(b.id).role==='wait';
    return (wb-wa) || String(a.name||'').localeCompare(String(b.name||''),'ko');
  });
  const waiting = list.filter(d => deviceRole(d.id).role==='wait').length;
  const rows = list.map(d => {
    const r = deviceRole(d.id), on = d.seenAt && now()-d.seenAt < ONLINE_MS, me = store && d.id===store.uid;
    const ps = D.roles[d.id] && D.roles[d.id].preset && D.presets[D.roles[d.id].preset];
    return `<div class="item tap devrow" data-a="roleSheet" data-v="${d.id}">
      <span class="tag ${on?'ok':''}">${on?'● 접속':'○ '+ago(d.seenAt)}</span>
      <span class="name">${esc(d.name||'(이름 없음)')}${me?' <span class="tag dark">이 기기</span>':''}
        <span class="roleline ${roleTagCls(r)}">${esc(roleIcon(r))} ${esc(roleLabel(r))}</span>
        <span class="sub">${esc(d.ua||'')}${ps?` · 📇 ${esc(ps.label)}`:''}${r.board && d.audio!=null ? (d.audio ? ' · 🔊 소리 켜짐' : ' · 🔇 소리 꺼짐') : ''}${on?'':' · 마지막 '+hm(d.seenAt)}</span></span></div>`;
  }).join('');
  const pl = presetList();
  const prow = p => { const use = presetUse(p.id);
    return `<div class="item tap" data-a="presetEdit" data-v="${p.id}"><span class="tag">${p.volunteer?'🙋 봉사자':'👤 담당자'}</span>
      <span class="name">${esc(p.label||'')}<span class="sub">${esc(roleLabel(asRole(p)))}${p.cast?' · 📢 방송':''}</span></span><span class="tag ${use?'ok':''}">${use}대 사용</span></div>`; };
  const tabs = innerTabs('people', [['dev','📱','접속 기기', list.length], ['preset','📇','담당자 명단', pl.length], ['help','❓','역할 안내']]);
  const body = {
    dev: () => `<div class="card"><div class="row"><h2 class="grow h2" style="margin:0">접속한 기기 ${list.length}대</h2>${waiting?`<span class="tag warn">역할 대기 ${waiting}</span>`:''}</div>
      <p class="sub">줄을 누르면 역할을 정할 수 있습니다. 한 기기에 감독·심판·기록 도우미·계시원을 함께 줄 수 있고, 정하는 즉시 그 기기의 화면이 바뀝니다.</p>
      <div class="list">${rows || '<div class="empty">아직 접속한 기기가 없습니다.</div>'}</div></div>`,
    preset: () => `<div class="card"><h2>📇 담당자 명단 <span class="sub">미리 정한 역할</span></h2>
      <p class="sub">이름과 맡을 역할을 미리 등록해 두면, 각 기기 첫 화면에서 이름만 골라 바로 들어옵니다. <b>봉사자 자리</b>는 여러 명이 같은 자리를 고르고 각자 이름을 적고 들어옵니다.</p>
      <div class="row" style="margin-bottom:12px"><button class="btn primary grow" data-a="presetNew" data-v="">＋ 담당자 추가</button><button class="btn grow" data-a="presetNew" data-v="vol">＋ 봉사자 자리 추가</button></div>
      <div class="list">${pl.map(prow).join('') || '<div class="empty">아직 등록한 담당자가 없습니다.</div>'}</div></div>`,
    help: () => `<div class="card"><h2>역할마다 보이는 화면</h2>
      <div class="list">
        <div class="item"><span class="tag">📋 감독</span><span class="name"><span class="sub">자기 팀 단체전 출전 순서를 정하고, 상대 팀 순서와 지금 경기를 봅니다.</span></span></div>
        <div class="item"><span class="tag">🚩 심판</span><span class="name"><span class="sub">맡은 종목만 보입니다. 단체전은 지금 대결과 대기 순서, 승패 입력이고, 개인전은 두 사대 점수 입력입니다.</span></span></div>
        <div class="item"><span class="tag">✏️ 기록 도우미</span><span class="name"><span class="sub">맡은 종목의 점수를 심판과 똑같이 입력합니다.</span></span></div>
        <div class="item"><span class="tag">⏱ 계시원</span><span class="name"><span class="sub">큰 초시계로 시간을 재서 심판 화면으로 보냅니다. 심판이 확인한 뒤 저장합니다.</span></span></div>
        <div class="item"><span class="tag">🧭 운영 현황</span><span class="name"><span class="sub">센터장·사무국장 대행: 종목별 진행 현황과 남은 시간을 보고, 무전·문자를 쓰고, 전체 인원 출석을 체크합니다. 점수나 선수 불참 표시는 건드리지 않습니다. '중계 모드'를 켜면 보이스오버용 간단 글자 화면이 됩니다.</span></span></div>
        <div class="item"><span class="tag">📺 안내판</span><span class="name"><span class="sub">가로로 세워 둔 태블릿에 호출·결과·현황을 크게 띄웁니다.</span></span></div>
      </div></div>`,
  }[ITAB.people]();
  return `<div class="bctl">${tabs}${body}</div>`;
}

/* ---------- 같은 이름은 한 기기로 (이름으로 로그인하듯) ----------
   같은 이름으로 다른 브라우저·앱에서 다시 들어오면, 가장 최근에 들어온 기기만 남기고 예전 기기는 지움.
   새 기기에 역할이 없으면 예전 기기의 역할을 그대로 넘겨줌. 마스터 기기가 켜져 있을 때 자동으로 정리함 */
let dedupeTimer = 0, dedupeBusy = false;
function dedupeSoon(){ clearTimeout(dedupeTimer); dedupeTimer = setTimeout(dedupeDevices, 1500); }
async function dedupeDevices(){
  if(!D.amMaster || dedupeBusy || !D.loaded.masters) return;
  const groups = {};
  D.devices.forEach(d => { const n = String(d.name||'').trim(); if(n) (groups[n] ||= []).push(d); });
  const jobs = [];
  Object.values(groups).filter(g => g.length > 1).forEach(g => {
    g.sort((a,b) => (b.joinAt||0) - (a.joinAt||0) || (b.seenAt||0) - (a.seenAt||0));
    const keep = g[0];
    g.slice(1).forEach(old => {
      if(old.id===store.uid) return;                              // 지금 이 마스터 기기는 지우지 않음
      if(D.masters[old.id] && !D.masters[keep.id]) return;        // 남은 마스터 권한을 없애지 않게
      const oldRole = D.roles[old.id];
      if(oldRole && !D.roles[keep.id] && !D.masters[keep.id])
        jobs.push(store.put(['main','roles',keep.id], { preset:oldRole.preset||'', name:keep.name||'', ...pickRoleFields(oldRole), by:UI.me, at:now() }, false));
      jobs.push(store.del(['main','roles',old.id]), store.del(['main','devices',old.id]));
      if(D.masters[old.id]) jobs.push(store.del(['main','masters',old.id]));
    });
  });
  if(!jobs.length) return;
  dedupeBusy = true;
  await Promise.all(jobs.map(p => p.catch(e => console.error(e))));
  dedupeBusy = false;
}

/* ---------- 역할 고르기 (담당자 명단과 기기에 함께 씀) ---------- */
let RD = null;
function newDraft(src){
  const n = normRole(src), raw = src || {}, hide = (k, ok) => (Array.isArray(raw[k]) ? raw[k] : []).filter(e => !ok(e));
  // hid: 지금 꺼져 있어 화면에 안 보이는 종목 (저장할 때 그대로 되돌려 넣음)
  return { ...pickRoleFields(src), monitor:!!n.monitor, voice:!!n.voice, events:[...n.events], helpers:[...n.helpers], timers:[...n.timers],
    hid:{ events:hide('events', e => EVENTS[e]), helpers:hide('helpers', e => EVENTS[e]), timers:hide('timers', e => TIME_EVENTS.includes(e)) } };
}
function roleEditor(){
  const chips = (k, list) => `<div class="chips">${list.map(ev => `<button class="chip ${RD[k].includes(ev)?'on':''}" data-a="rdTog" data-k="${k}" data-v="${ev}">${EVENTS[ev].icon} ${esc(EVENTS[ev].name)}</button>`).join('')}</div>`;
  const flag = (k, title, sub) => `<div class="item"><span class="name">${title}<span class="sub">${sub}</span></span><button class="btn small ${RD[k]?'ok':''}" data-a="rdFlag" data-k="${k}">${RD[k]?'켬':'끔'}</button></div>`;
  return `<div class="card"><h2>📋 감독</h2><div class="seg"><button class="${!RD.coach?'on':''}" data-a="rdCoach" data-v="">없음</button><button class="${RD.coach==='blue'?'on blue':''}" data-a="rdCoach" data-v="blue">${esc(teamName('blue'))}</button><button class="${RD.coach==='red'?'on red':''}" data-a="rdCoach" data-v="red">${esc(teamName('red'))}</button></div></div>
    <div class="card"><h2>🚩 심판 <span class="sub">점수·승패를 입력합니다</span></h2>${chips('events', Object.keys(EVENTS))}</div>
    <div class="card"><h2>✏️ 기록 도우미 <span class="sub">심판과 똑같이 점수를 입력합니다</span></h2>${chips('helpers', Object.keys(EVENTS))}</div>
    <div class="card"><h2>⏱ 계시원 <span class="sub">시간을 재서 심판 화면으로 보냅니다</span></h2>${chips('timers', TIME_EVENTS)}</div>
    <div class="card"><div class="list">${flag('monitor','🧭 운영 현황','센터장·사무국장 대행: 진행 현황을 보고 무전·문자를 쓰고 전체 인원 출석을 체크합니다.')}${RD.monitor ? flag('voice','중계 모드(보이스오버용 간단 화면)','그림 없이 큰 글자 단추만 있는 화면으로 바뀌고, 지금 상황을 글로 읽어 줍니다. 단체전 결과가 저장되면 보이스오버가 바로 읽어 줍니다.') : ''}${flag('board','📺 안내판','이 기기를 안내판 화면으로만 씁니다(다른 역할 화면은 숨겨집니다).')}${flag('cast','📢 음성 방송 권한','안내판 스피커로 말하는 방송 버튼이 생깁니다.')}</div></div>`;
}
const draftEmpty = () => !RD.coach && !RD.events.length && !RD.helpers.length && !RD.timers.length && !RD.board && !RD.monitor;
const draftFields = () => { const h = RD.hid || {}, add = (a, b) => [...a, ...(b||[]).filter(e => !a.includes(e))];
  return { coach:RD.coach, events:add(RD.events.filter(e => EVENTS[e]), h.events), helpers:add(RD.helpers.filter(e => EVENTS[e]), h.helpers), timers:add(RD.timers.filter(e => TIME_EVENTS.includes(e)), h.timers), board:!!RD.board, cast:!!RD.cast, monitor: RD.monitor ? (RD.voice ? 'voice' : true) : false }; };

function presetSheet(){
  return `<h2>${RD.id ? '담당자 고치기' : RD.volunteer ? '봉사자 자리 추가' : '담당자 추가'}</h2>
    <div class="card"><input id="rdLabel" data-in="rdLabel" value="${esc(RD.label)}" placeholder="${RD.volunteer ? '자리 이름 (예: 투호 기록 도우미)' : '이름 (예: 이소흔)'}" autocomplete="off">
      <div class="item" style="margin-top:8px"><span class="name">🙋 봉사자 자리<span class="sub">여러 명이 이 자리를 고르고, 들어올 때 각자 이름을 적습니다.</span></span><button class="btn small ${RD.volunteer?'ok':''}" data-a="rdFlag" data-k="volunteer">${RD.volunteer?'켬':'끔'}</button></div></div>
    ${roleEditor()}
    ${RD.id && presetUse(RD.id) ? `<p class="sub">이 담당자로 들어온 기기 ${presetUse(RD.id)}대의 역할도 저장할 때 함께 바뀝니다.</p>` : ''}
    <div class="row"><button class="btn primary grow" data-a="presetSave">저장</button>${RD.id?'<button class="btn danger" data-a="presetDel">지우기</button>':''}<button class="btn" data-a="closeSheet">닫기</button></div>`;
}
function roleSheet(){
  const id = RD.id, d = D.devices.find(x => x.id===id) || { id, name: id===store.uid ? UI.me : '' };
  const r = deviceRole(id), me = id===store.uid, isM = r.role==='master';
  const pl = presetList();
  return `<h2>${esc(d.name||'(이름 없음)')} <span class="sub">${esc(d.ua||'')}</span></h2>
    <p>지금 역할: <b>${esc(roleIcon(r))} ${esc(roleLabel(r))}</b></p>
    ${isM && !DEMO ? '<div class="note">마스터 권한이 있는 기기입니다. 다른 역할을 주려면 먼저 마스터 권한을 빼 주세요.</div>' : ''}
    ${pl.length ? `<div class="card"><h2>📇 담당자 명단에서 고르기</h2><div class="chips">${pl.map(p => `<button class="chip ${RD.preset===p.id?'on':''}" data-a="rdPreset" data-v="${p.id}">${p.volunteer?'🙋':'👤'} ${esc(p.label)}</button>`).join('')}</div>
      <p class="sub">고르면 아래 역할이 그 담당자와 똑같이 채워집니다.</p></div>` : ''}
    ${roleEditor()}
    <div class="row"><button class="btn primary grow" data-a="devSave">이 역할로 저장</button><button class="btn" data-a="devClear">역할 모두 없애기</button></div>
    ${DEMO && me ? '' : `<div class="card" style="margin-top:14px"><h2>그 밖의 일</h2><div class="row">
      ${isM ? (me ? '' : `<button class="btn danger grow" data-a="revokeMaster">👑 마스터 권한 빼기</button>`) : `<button class="btn grow" data-a="grantMaster">👑 마스터 권한 주기</button>`}
      ${me ? '' : '<button class="btn danger grow" data-a="removeDevice">목록에서 지우기</button>'}</div></div>`}
    <button class="btn wide" data-a="closeSheet">닫기</button>`;
}

/* ---------- 첫 화면·대기 화면: 담당자 이름 골라 들어오기 ---------- */
function presetPicker(){
  const ps = presetList(); if(!ps.length) return '';
  const named = ps.filter(p => !p.volunteer), vol = ps.filter(p => p.volunteer);
  const btn = p => `<button class="pbtn" data-a="joinPreset" data-v="${p.id}"><b>${p.volunteer?'🙋':'👤'} ${esc(p.label)}</b><span>${esc(roleLabel(asRole(p)))}</span></button>`;
  return (named.length ? `<div class="card"><h2>👤 담당자로 들어오기</h2><p class="sub">자기 이름을 누르면 미리 정해 둔 역할로 바로 들어갑니다.</p><div class="pgrid">${named.map(btn).join('')}</div></div>` : '')
    + (vol.length ? `<div class="card"><h2>🙋 봉사자로 들어오기</h2><p class="sub">맡은 자리를 누르고 이름을 적으면 됩니다.</p><div class="pgrid">${vol.map(btn).join('')}</div></div>` : '');
}

/* ---------- 선수 불참 표시 (전체 인원 출석 체크는 view-attend.js) ---------- */
let attFilter = 'all';
function attendanceSheet(){
  const ps = people().filter(p => attFilter==='all' || (attFilter==='absent' ? isAbsent(p.id) : p.team===attFilter));
  const n = people().filter(p => isAbsent(p.id)).length;
  return `<h2>🚫 선수 불참 표시 <span class="sub">불참 ${n}명</span></h2>
    <p class="sub">오지 않은 선수를 '불참'으로 바꾸면 단체전 출전 순서에서 자동으로 건너뛰고, 명단과 안내판에도 표시됩니다.</p>
    <div class="chips" style="margin-bottom:8px">${[['all','전체'],['blue',teamName('blue')],['red',teamName('red')],['absent','불참만']].map(([k,l]) => `<button class="chip ${attFilter===k?'on':''}" data-a="attFilter" data-v="${k}">${esc(l)}</button>`).join('')}</div>
    <div class="list">${ps.map(p => `<div class="item">${teamBadge(p.team)}<span class="name">${esc(p.name)}</span>
      <button class="btn small ${isAbsent(p.id)?'danger':'ok'}" data-a="absToggle" data-v="${p.id}">${isAbsent(p.id)?'불참':'참가'}</button></div>`).join('') || '<div class="empty">해당하는 사람이 없습니다.</div>'}</div>
    <button class="btn primary wide" data-a="closeSheet" style="margin-top:12px">닫기</button>`;
}

/* ---------- 동작 ---------- */
// 연습 모드에서는 혼자 시험해 볼 수 있도록 자기 역할을 직접 정할 수 있음
const canAssign = () => can.master() || DEMO;
async function applyPresetToDevices(pid, fields){
  await Promise.all(Object.entries(D.roles).filter(([,r]) => r && r.preset===pid)
    .map(([id, r]) => put(['main','roles',id], { preset:pid, name:r.name||'', ...fields, by:UI.me, at:now() }, false)));
}
Object.assign(ACT, {
  roleSheet: (el, v) => { RD = { id:v, preset:(D.roles[v]||{}).preset||'', ...newDraft(D.roles[v]) }; openSheet(roleSheet); return false; },
  presetNew: (el, v) => { RD = { id:'', label:'', volunteer: v==='vol', ...newDraft(null) }; openSheet(presetSheet); return false; },
  presetEdit: (el, v) => { const p = D.presets[v]; RD = { id:v, label:p.label||'', volunteer:!!p.volunteer, ...newDraft(p) }; openSheet(presetSheet); return false; },
  rdTog: (el, v) => { const a = RD[el.dataset.k]; a.includes(v) ? a.splice(a.indexOf(v),1) : a.push(v); RD.preset = ''; drawSheet(); return false; },
  rdCoach: (el, v) => { RD.coach = v; RD.preset = ''; drawSheet(); return false; },
  rdFlag: (el) => { const k = el.dataset.k; RD[k] = !RD[k]; if(k==='monitor' && !RD.monitor) RD.voice = false; if(k!=='volunteer') RD.preset = ''; drawSheet(); return false; },
  rdPreset: (el, v) => { const p = D.presets[v]; if(!p) return false; Object.assign(RD, newDraft(p), { preset:v }); drawSheet(); return false; },
  presetSave: async () => {
    if(!can.master()) return denied();
    const label = String(RD.label||'').trim();
    if(!label){ toast(RD.volunteer ? '자리 이름을 적어 주세요.' : '이름을 적어 주세요.'); return false; }
    if(draftEmpty()){ toast('맡을 역할을 하나 이상 골라 주세요.'); return false; }
    if(presetList().some(p => p.id!==RD.id && String(p.label).trim()===label)){ toast(`'${label}'은(는) 이미 담당자 명단에 있습니다.`); return false; }
    const id = RD.id || 'ps'+uid(), fields = draftFields();
    if(!(await put(['main','presets',id], { label, volunteer:!!RD.volunteer, ...fields, by:UI.me, at:now() }, false))) return false;
    await applyPresetToDevices(id, fields);
    closeSheet(); toast(`${label}: ${roleLabel(asRole(fields))}(으)로 저장했습니다.`);
  },
  presetDel: async () => {
    if(!can.master()) return denied();
    const id = RD.id, use = presetUse(id);
    if(!(await ask(`${RD.label}을(를) 담당자 명단에서 지울까요?${use?`\n이 담당자로 들어온 기기 ${use}대는 역할 대기로 바뀝니다.`:''}`, '지우기', true))) return false;
    await Promise.all(Object.entries(D.roles).filter(([,r]) => r && r.preset===id).map(([rid]) => guard(store.del(['main','roles',rid]))));
    await guard(store.del(['main','presets',id])); closeSheet();
  },
  devSave: async () => {
    if(!canAssign()) return denied();
    const id = RD.id, d = D.devices.find(x => x.id===id), name = d?.name || (id===store.uid ? UI.me : '');
    if(D.masters[id] && !DEMO){ toast('먼저 마스터 권한을 빼 주세요.'); return false; }
    if(DEMO && D.masters[id] && !(await guard(store.del(['main','masters',id])))) return false;
    if(draftEmpty()){ await guard(store.del(['main','roles',id])); closeSheet(); toast(`${name}: 역할을 없앴습니다.`); return; }
    const fields = draftFields();
    if(await put(['main','roles',id], { preset:RD.preset||'', name, ...fields, by:UI.me, at:now() }, false)){ closeSheet(); toast(`${name}: ${roleLabel(asRole(fields))}(으)로 정했습니다.`); }
  },
  devClear: async () => { if(!canAssign()) return denied(); if(await guard(store.del(['main','roles',RD.id]))){ closeSheet(); toast('역할을 없앴습니다.'); } },
  grantMaster: async () => {
    if(!can.master()) return denied();
    const id = RD.id, d = D.devices.find(x => x.id===id);
    if(!(await ask(`${d?.name||''} 기기에 마스터 권한을 줄까요?\n모든 기록과 역할을 바꿀 수 있게 됩니다.`, '권한 주기'))) return false;
    if(await put(['main','masters',id], { name:d?.name||'', by:UI.me, at:now() }, false)){ await guard(store.del(['main','roles',id])); closeSheet(); toast('마스터 권한을 줬습니다.'); }
  },
  revokeMaster: async () => {
    if(!can.master()) return denied();
    if(await guard(store.del(['main','masters',RD.id]))){ closeSheet(); toast('마스터 권한을 뺐습니다.'); }
  },
  removeDevice: async () => {
    if(!can.master()) return denied();
    const id = RD.id, d = D.devices.find(x => x.id===id);
    if(!(await ask(`${d?.name||''} 기기를 목록에서 지울까요?\n그 기기는 다시 이름을 고르고 들어와야 합니다.`, '지우기', true))) return false;
    await guard(Promise.all([store.del(['main','roles',id]), store.del(['main','masters',id]), store.del(['main','devices',id])]));
    closeSheet();
  },
  joinPreset: async (el, v) => {
    const p = D.presets[v]; if(!p) return false;
    let name = p.label;
    if(p.volunteer){
      name = await askText(`'${p.label}' 자리로 들어갑니다.\n이름을 적어 주세요.`, UI.me||'', '들어가기');
      if(!name || !name.trim()) return false; name = name.trim();
    } else if(!(await ask(`${p.label}\n(${roleLabel(asRole(p))})\n이 이름으로 들어갈까요?`, '들어가기'))) return false;
    UI.me = name; idStore.set('udh5_me', name); touchDevice(true);
    if(await put(['main','roles',store.uid], { preset:v, name, ...pickRoleFields(p), at:now() }, false, D.amMaster ? undefined : RULES_OLD_MSG)) toast(`${name} 님, 들어왔습니다.`);
  },
  leaveRole: async () => {
    if(!(await ask('지금 역할에서 나가고 담당자를 다시 고를까요?', '다시 고르기'))) return false;
    await guard(store.del(['main','roles',store.uid])); closeSheet();
  },
  attSheet: () => { if(!can.abs()) return denied(); attFilter = 'all'; openSheet(attendanceSheet); return false; },
  attFilter: (el, v) => { attFilter = v; drawSheet(); return false; },
  absToggle: (el, v) => {
    if(!can.abs()) return denied();
    if(isAbsent(v)) guard(store.del(['main','absent',v]));
    else put(['main','absent',v], { absent:true, team:teamOf(v), by:UI.me, at:now() }, false);
    return false;
  },
});
document.addEventListener('input', e => { if(e.target.dataset.in==='rdLabel' && RD) RD.label = e.target.value; });
