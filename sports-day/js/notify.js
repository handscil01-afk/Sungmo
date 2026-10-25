'use strict';
/* ===================== 일정·시간 안내 · 문자 무전 · 긴급 호출 ===================== */
const WHO = [['staff','모든 진행요원'],['coach','감독'],['ref','심판·도우미·계시원'],['indiv','개인전 담당'],['team','단체전 담당'],['master','마스터만']];
const whoLabel = k => (WHO.find(w => w[0]===k) || WHO[0])[1];
const MSG_PHRASES = ['선수 준비 완료했습니다.', '다음 경기 시작해도 됩니다.', '잠시 대기해 주세요.', '기록 확인 부탁드립니다.', '물·의자가 필요합니다.', '도움이 필요합니다. 와 주세요.'];
const schedule = () => Array.isArray(D.config.schedule) ? D.config.schedule : [];
// 받을 사람에 이 기기가 들어가는지 (마스터는 모두 받음, 안내판은 기기 안내 창을 받지 않음)
function whoMatch(who){
  const r = myRole();
  if(r.role==='master') return true;
  if(r.role==='board' || !hasDuty(r)) return false;
  const ev = refEvents(r);
  switch(who){
    case 'coach': return !!r.coach;
    case 'ref': return ev.length>0 || r.timers.length>0;
    case 'indiv': return ev.some(e => INDIV[e]);
    case 'team': return !!r.coach || ev.some(e => TEAM[e]) || r.timers.length>0;
    case 'master': return false;
    default: return true;
  }
}
const leftText = ms => ms <= 0 ? '시간 지남' : ms < 60000 ? '1분 안 남음' : `${Math.ceil(ms/60000)}분 남음`;

/* ---------- 안내 창 (새 창처럼 화면 가운데에 크게) ---------- */
const NQ = []; let ncur = null, nalarm = 0;
function notice(n){ NQ.push(n); if(!ncur) showNotice(); }
function showNotice(){
  clearInterval(nalarm);
  ncur = NQ.shift();
  const box = $('#notice');
  if(!ncur){ box.className = ''; box.innerHTML = ''; return; }
  const ic = { time:'⏰', msg:'💬', sos:'🚨' }[ncur.kind] || '📢';
  box.className = 'open ' + ncur.kind;
  box.innerHTML = `<div class="nbox"><div class="nic">${ic}</div><div class="nt">${esc(ncur.title)}</div>${ncur.msg?`<div class="nm">${esc(ncur.msg)}</div>`:''}
    <div class="nfrom">${esc(ncur.from||'')}${ncur.from?' · ':''}${hm(ncur.at||now())}${NQ.length?` · 남은 안내 ${NQ.length}개`:''}</div>
    <button class="btn huge ${ncur.kind==='sos'?'danger':'primary'}" data-a="ntcOk">확인</button></div>`;
  const beep = () => {
    SND.unlock();
    if(ncur.kind==='sos'){ SND.play([[880,0,0.25],[660,0.3,0.25],[880,0.6,0.25],[660,0.9,0.25]]); if(navigator.vibrate) navigator.vibrate([400,150,400,150,400]); }
    else { SND.play([[988,0,0.18],[988,0.25,0.18],[1319,0.5,0.4]]); if(navigator.vibrate) navigator.vibrate([200,100,200]); }
  };
  beep();
  // 긴급 호출은 확인을 누를 때까지 계속 울림
  if(ncur.kind==='sos') nalarm = setInterval(beep, 2500);
}

/* ---------- 일정 확인 (5초마다) ---------- */
const SHOWN = ls.get('udh5_shown', {});
function checkSchedule(){
  if(!store || !UI.me) return;
  const t = now(); let changed = false;
  schedule().forEach(it => {
    [...new Set([...(it.warns||[]), 0])].forEach(w => {
      const at = it.ts - w*60000, key = `${it.id}:${it.ts}:${w}`;
      if(t < at || t - at > 120000 || SHOWN[key]) return;
      SHOWN[key] = 1; changed = true;
      const title = w ? `${it.title}까지 ${w}분 남았습니다` : `지금 ${it.title}입니다`;
      if(boardOn()){ if(it.board){ BOARD.queue.push({ kind:'ann', ann:{ text: title + (it.msg ? ' ' + it.msg : ''), voice:true } }); runFx(); } }
      else if(whoMatch(it.who)) notice({ kind:'time', title, msg:it.msg||'', at:t });
    });
  });
  if(changed) ls.set('udh5_shown', SHOWN);
}
// 안내판 위쪽에 띄울 다음 일정 (1시간 안, 지난 지 3분 안)
function boardScheduleStrip(){
  const t = now();
  const it = schedule().filter(x => x.board && x.ts > t - 180000 && x.ts - t < 3600000).sort((a,b) => a.ts-b.ts)[0];
  if(!it) return '';
  const left = it.ts - t;
  return `<div class="schedstrip">⏰ ${left > 0 ? `${esc(it.title)}까지 <b>${Math.ceil(left/60000)}분</b> 남았습니다 <span>(${hm(it.ts)})</span>` : `지금 ${esc(it.title)}입니다`}</div>`;
}

/* ---------- 문자 무전·긴급 호출 ---------- */
const SEEN = new Set(ls.get('udh5_seenmsg', []));
let msgBoot = true;
function processMsgs(){
  const t = now(); let changed = false;
  D.msgs.slice().sort((a,b) => (a.at||0)-(b.at||0)).forEach(m => {
    if(SEEN.has(m.id)) return;
    SEEN.add(m.id); changed = true;
    if(m.uid===store.uid || t - (m.at||0) > 180000 || (msgBoot && t - (m.at||0) > 60000)) return;
    const to = m.kind==='sos' ? 'staff' : (m.to||'staff');
    if(!whoMatch(to)) return;
    notice(m.kind==='sos'
      ? { kind:'sos', title:'긴급 호출', msg:`${m.where ? `[${m.where}] ` : ''}${m.text||'도움이 필요합니다.'}`, from:m.name, at:m.at }
      : { kind:'msg', title:m.text, msg: to==='staff' ? '' : `받는 사람: ${whoLabel(to)}`, from:m.name, at:m.at });
  });
  msgBoot = false;
  if(changed) ls.set('udh5_seenmsg', [...SEEN].slice(-300));
  drawSheet();
}
function sendMsg(text, to, kind='msg'){
  if(!can.staff()) return denied();
  const t = String(text||'').trim().slice(0, 280); if(!t && kind!=='sos'){ toast('보낼 내용을 적어 주세요.'); return Promise.resolve(false); }
  const id = now().toString(36) + uid();
  SEEN.add(id);
  return put(['main','msgs',id], { uid:store.uid, name:UI.me, text:t, to, kind, where: roleLabel(myRole()), at:now() }, false)
    .then(ok => { if(ok) toast(kind==='sos' ? '긴급 호출을 보냈습니다.' : `${whoLabel(to)}에게 보냈습니다.`); return ok; });
}
let msgTo = 'staff', msgDraft = '';
function msgSheet(){
  const recent = D.msgs.slice().sort((a,b) => (b.at||0)-(a.at||0)).slice(0, 8);
  return `<h2>💬 문자 무전</h2>
    <p class="sub">누르면 바로 보냅니다. 받는 사람 기기에는 소리·진동과 함께 안내 창이 뜹니다.</p>
    <div class="chips" style="margin-bottom:10px">${WHO.map(([k,l]) => `<button class="chip ${msgTo===k?'on':''}" data-a="msgTo" data-v="${k}">${esc(l)}</button>`).join('')}</div>
    <div class="pgrid">${MSG_PHRASES.map((p,i) => `<button class="pbtn" data-a="msgPhrase" data-v="${i}"><b>${esc(p)}</b></button>`).join('')}</div>
    <div class="row nowrap" style="margin-top:12px"><input id="msgText" data-in="msg" placeholder="직접 적어서 보내기" value="${esc(msgDraft)}" autocomplete="off"><button class="btn primary" data-a="msgSend">보내기</button></div>
    <button class="btn danger huge wide" data-a="sosSend" style="margin-top:14px;width:100%">🚨 긴급 호출</button>
    <h3>최근 15분</h3>
    <div class="list">${recent.map(m => `<div class="item"><span class="tag ${m.kind==='sos'?'red':''}">${m.kind==='sos'?'🚨':'💬'} ${hm(m.at)}</span><span class="name">${esc(m.text||'긴급 호출')}<span class="sub">${esc(m.name||'')} → ${esc(m.kind==='sos'?'모든 진행요원':whoLabel(m.to))}</span></span></div>`).join('') || '<div class="empty">아직 주고받은 문자가 없습니다.</div>'}</div>
    <button class="btn wide" data-a="closeSheet" style="margin-top:12px">닫기</button>`;
}
function scheduleSheet(){
  const t = now(), items = schedule().slice().sort((a,b) => a.ts-b.ts);
  return `<h2>📅 진행 일정</h2>
    <div class="list">${items.map(it => `<div class="item ${it.ts < t ? 'done' : ''}"><span class="tag ${it.ts < t ? '' : 'dark'}">${hm(it.ts)}</span><span class="name">${esc(it.title)}<span class="sub">${esc(whoLabel(it.who))}${it.msg?` · ${esc(it.msg)}`:''}</span></span><span class="tag ${it.ts-t>0 && it.ts-t<600000?'warn':''}">${leftText(it.ts-t)}</span></div>`).join('') || '<div class="empty">등록된 일정이 없습니다.</div>'}</div>
    <button class="btn primary wide" data-a="closeSheet" style="margin-top:12px">닫기</button>`;
}

/* ---------- 마스터: 일정·알림 화면 ---------- */
const QT = { title:'', min:10, who:'staff', board:true };
let SD = null, instTo = 'staff', instDraft = '';
function schedView(){
  const t = now(), items = schedule().slice().sort((a,b) => a.ts-b.ts);
  const whoChips = (cur, act) => `<div class="chips">${WHO.map(([k,l]) => `<button class="chip ${cur===k?'on':''}" data-a="${act}" data-v="${k}">${esc(l)}</button>`).join('')}</div>`;
  return `<div class="cols half"><div>
    <div class="card"><h2>⏱ 바로 타이머</h2>
      <input id="qtTitle" data-in="qtTitle" value="${esc(QT.title)}" placeholder="무엇이 끝나나요? (예: 개인전 연습 마감)" autocomplete="off">
      <h3>몇 분 뒤</h3><div class="chips">${[1,3,5,10,15,20,30,60].map(m => `<button class="chip ${QT.min===m?'on':''}" data-a="qtMin" data-v="${m}">${m}분</button>`).join('')}</div>
      <h3>받는 사람</h3>${whoChips(QT.who, 'qtWho')}
      <div class="item"><span class="name">📺 안내판에도 띄우기<span class="sub">안내판 위쪽에 남은 시간을 보여 주고, 알림 때 읽어 줍니다.</span></span><button class="btn small ${QT.board?'ok':''}" data-a="qtBoard">${QT.board?'켬':'끔'}</button></div>
      <button class="btn primary wide" data-a="qtStart" style="margin-top:10px">타이머 시작</button>
      <p class="sub">10분·5분·3분·1분 전 가운데 남은 시간보다 짧은 때마다, 그리고 끝나는 순간에 안내 창이 뜹니다.</p></div>
    <div class="card"><h2>📨 지금 바로 알림 보내기</h2>
      ${whoChips(instTo, 'instTo')}
      <div class="row nowrap" style="margin-top:10px"><input id="instText" data-in="inst" value="${esc(instDraft)}" placeholder="예: 오후 경기는 10분 늦게 시작합니다." autocomplete="off"><button class="btn primary" data-a="instSend">보내기</button></div></div>
    </div><div>
    <div class="card"><div class="row"><h2 class="grow h2" style="margin:0">📅 진행 일정</h2><button class="btn small primary" data-a="schedNew">＋ 일정 추가</button></div>
      <p class="sub">정한 시각 전에 알림 시점마다 받을 사람의 기기에 "○○까지 5분 남았습니다" 안내 창이 뜹니다. 제목은 '점심시간 끝', '개인전 연습 마감'처럼 적어 주세요.</p>
      <div class="list">${items.map(it => `<div class="item tap ${it.ts < t ? 'done' : ''}" data-a="schedEdit" data-v="${it.id}"><span class="tag ${it.ts < t ? '' : 'dark'}">${hm(it.ts)}</span>
        <span class="name">${esc(it.title)}<span class="sub">${esc(whoLabel(it.who))} · ${(it.warns||[]).length ? (it.warns||[]).slice().sort((a,b)=>b-a).join('·')+'분 전' : '정각만'}${it.board?' · 📺':''}</span></span><span class="tag">${leftText(it.ts-t)}</span></div>`).join('') || '<div class="empty">아직 일정이 없습니다.</div>'}</div></div>
  </div></div>`;
}
function schedSheet(){
  return `<h2>${SD.id && schedule().some(x => x.id===SD.id) ? '일정 고치기' : '일정 추가'}</h2>
    <div class="card"><div class="row nowrap"><input id="sdTime" type="time" data-in="sdTime" value="${esc(SD.time)}" style="max-width:150px"><input id="sdTitle" data-in="sdTitle" value="${esc(SD.title)}" placeholder="제목 (예: 점심시간 끝)" autocomplete="off"></div>
      <div style="height:10px"></div><input id="sdMsg" data-in="sdMsg" value="${esc(SD.msg)}" placeholder="덧붙일 말 (예: 선수들은 본부석 앞으로 모여 주세요)" autocomplete="off"></div>
    <div class="card"><h2>알림 시점</h2><div class="chips">${[30,15,10,5,3,1].map(m => `<button class="chip ${SD.warns.includes(m)?'on':''}" data-a="sdWarn" data-v="${m}">${m}분 전</button>`).join('')}</div><p class="sub">정한 시각(정각)에도 한 번 더 알립니다.</p></div>
    <div class="card"><h2>받는 사람</h2><div class="chips">${WHO.map(([k,l]) => `<button class="chip ${SD.who===k?'on':''}" data-a="sdWho" data-v="${k}">${esc(l)}</button>`).join('')}</div>
      <div class="item"><span class="name">📺 안내판에도 띄우기<span class="sub">참가자도 볼 수 있게 안내판 위쪽에 남은 시간을 보여 줍니다.</span></span><button class="btn small ${SD.board?'ok':''}" data-a="sdBoard">${SD.board?'켬':'끔'}</button></div></div>
    <div class="row"><button class="btn primary grow" data-a="schedSave">저장</button>${schedule().some(x => x.id===SD.id)?'<button class="btn danger" data-a="schedDel">지우기</button>':''}<button class="btn" data-a="closeSheet">닫기</button></div>`;
}
const pad2 = n => String(n).padStart(2,'0');
function tsFromTime(hhmm){ const [h,m] = String(hhmm).split(':').map(Number); if(isNaN(h)||isNaN(m)) return NaN; const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime(); }

Object.assign(ACT, {
  ntcOk: () => { clearInterval(nalarm); showNotice(); return false; },
  msgSheet: () => { if(!can.staff()) return false; openSheet(msgSheet); return false; },
  msgTo: (el, v) => { msgTo = v; drawSheet(); return false; },
  msgPhrase: (el, v) => { sendMsg(MSG_PHRASES[+v], msgTo); return false; },
  msgSend: async () => { if(await sendMsg(msgDraft, msgTo)){ msgDraft = ''; drawSheet(); } return false; },
  sosSend: async () => {
    if(!(await ask('긴급 호출을 보낼까요?\n모든 진행요원 화면에 경고 창이 뜨고 소리가 울립니다.', '긴급 호출', true))) return false;
    const note = await askText('무슨 일인지 짧게 적어 주세요. (비워 두어도 됩니다)', '', '보내기');
    if(note===null) return false;
    await sendMsg(note || '도움이 필요합니다.', 'staff', 'sos'); closeSheet(); return false;
  },
  schedSheet: () => { openSheet(scheduleSheet); return false; },
  qtMin: (el, v) => { QT.min = +v; }, qtWho: (el, v) => { QT.who = v; }, qtBoard: () => { QT.board = !QT.board; },
  qtStart: () => {
    const title = QT.title.trim(); if(!title){ toast('무엇이 끝나는지 적어 주세요.'); return false; }
    const it = { id:'s'+uid(), ts: now() + QT.min*60000, title, msg:'', warns:[10,5,3,1].filter(w => w < QT.min), who:QT.who, board:QT.board };
    setConfig({ schedule:[...schedule().filter(x => x.ts > now()-6*3600000), it] }); QT.title = '';
    toast(`${hm(it.ts)}에 끝나는 타이머를 시작했습니다.`);
  },
  instTo: (el, v) => { instTo = v; },
  instSend: async () => { if(await sendMsg(instDraft, instTo)) instDraft = ''; },
  schedNew: () => { const d = new Date(now()+30*60000); SD = { id:'s'+uid(), time:`${pad2(d.getHours())}:${pad2(d.getMinutes())}`, title:'', msg:'', warns:[10,5,1], who:'staff', board:true }; openSheet(schedSheet); return false; },
  schedEdit: (el, v) => { const it = schedule().find(x => x.id===v); if(!it) return false; const d = new Date(it.ts);
    SD = { ...it, time:`${pad2(d.getHours())}:${pad2(d.getMinutes())}`, warns:[...(it.warns||[])], msg:it.msg||'' }; openSheet(schedSheet); return false; },
  sdWarn: (el, v) => { const m = +v; SD.warns.includes(m) ? SD.warns.splice(SD.warns.indexOf(m),1) : SD.warns.push(m); drawSheet(); return false; },
  sdWho: (el, v) => { SD.who = v; drawSheet(); return false; },
  sdBoard: () => { SD.board = !SD.board; drawSheet(); return false; },
  schedSave: () => {
    const title = SD.title.trim(), ts = tsFromTime(SD.time);
    if(!title){ toast('제목을 적어 주세요.'); return false; }
    if(isNaN(ts)){ toast('시각을 정해 주세요.'); return false; }
    const it = { id:SD.id, ts, title, msg:SD.msg.trim(), warns:SD.warns.slice().sort((a,b) => b-a), who:SD.who, board:!!SD.board };
    setConfig({ schedule:[...schedule().filter(x => x.id!==SD.id), it] }); closeSheet();
  },
  schedDel: async () => { if(!(await ask(`'${SD.title}' 일정을 지울까요?`, '지우기', true))) return false; setConfig({ schedule: schedule().filter(x => x.id!==SD.id) }); closeSheet(); },
});
document.addEventListener('input', e => {
  const k = e.target.dataset.in, v = e.target.value;
  if(k==='msg') msgDraft = v; else if(k==='inst') instDraft = v; else if(k==='qtTitle') QT.title = v;
  else if(SD && k==='sdTime') SD.time = v; else if(SD && k==='sdTitle') SD.title = v; else if(SD && k==='sdMsg') SD.msg = v;
});
setInterval(checkSchedule, 5000);
