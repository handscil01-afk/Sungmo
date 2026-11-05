'use strict';
/* ===================== 점자 골든벨: 상태 · 화면 · 동작 ===================== */
const DEF_LIVE = { mode:'banner', qi:0, showTimer:true, showAuthor:true, autoTimer:false, sound:true, scale:1, strip:'m',
  timer:{ dur:30, endAt:0, remain:30, running:false }, ann:null, rev:0 };
const S = {
  live:clone(DEF_LIVE),
  qs:{ list:[], rev:0 },
  seats:{ rows:4, cols:5, people:[], map:{}, adjust:{}, rev:0 },
  banner:{ l1:'제1회 시청각장애인', l2:'점자 골든벨', sub:'손잡다장애인자립생활센터', info:'', rev:0 },
  bimg:{ img:'', rev:0 },
  marks:{}, favs:[], devices:{}, staffs:{},
};
let ROLE = '', QS_DENIED = false;
const ME = { master:false, staff:false, known:false, name:ls.get('name', ''), zone:ls.get('zone', []) };
const myName = () => ROLE === 'host' ? '진행자' : (ME.name || '직원');
const zoneText = () => ROLE === 'staff' && ME.zone.length ? ME.zone.slice().sort((a, b) => a - b).join('·') + '줄' : '';

const curQ = () => S.qs.list[Math.max(0, Math.min(S.qs.list.length - 1, S.live.qi))] || null;
const peopleMap = () => { const m = {}; S.seats.people.forEach(p => m[p.id] = p); return m; };
function seatOf(){ const o = {}; for(const [k, pid] of Object.entries(S.seats.map || {})){ const [r, c] = k.split('-').map(Number); if(r < S.seats.rows && c < S.seats.cols) o[pid] = { k, r, c }; } return o; }
const seatLabel = s => s ? `${s.r + 1}줄 ${s.c + 1}번` : '자리 없음';
const markId = (q, p) => q + '~' + p;
const markFor = (q, pid) => q ? S.marks[markId(q.id, pid)] || null : null;
const isMarked = m => !!(m && m.by && Object.keys(m.by).length);
function scores(){
  const sc = {}; S.seats.people.forEach(p => sc[p.id] = Number(S.seats.adjust?.[p.id] || 0));
  const qids = new Set(S.qs.list.map(q => q.id));
  for(const m of Object.values(S.marks)) if(isMarked(m) && m.p in sc && qids.has(m.q)) sc[m.p]++;
  return sc;
}
function rankRows(){
  const sc = scores(), so = seatOf();
  const rows = S.seats.people.map(p => ({ p, s:sc[p.id] || 0, seat:so[p.id] }));
  rows.sort((a, b) => b.s - a.s || ((a.seat ? a.seat.r * 100 + a.seat.c : 9999) - (b.seat ? b.seat.r * 100 + b.seat.c : 9999)));
  rows.forEach(r => r.rank = 1 + rows.filter(x => x.s > r.s).length);
  return rows;
}

/* ===================== 저장 ===================== */
const W = {};
function save(path, get){
  const w = W[path] || (W[path] = { busy:false, dirty:false }); w.get = get; if(!DB) return;
  if(w.busy){ w.dirty = true; return; } w.busy = true;
  (async () => { do{ w.dirty = false; const d = w.get(); try{ await (d == null ? DB.remove(path) : DB.set(path, d)); }catch(e){ writeErr(e); } }while(w.dirty); w.busy = false; })();
}
const deb = {};
function saveSoon(path, get, ms){ clearTimeout(deb[path]); deb[path] = setTimeout(() => save(path, get), ms || 450); }
let lastErr = 0;
function writeErr(e){
  console.warn(e); const t = now(); if(t - lastErr < 2500) return; lastErr = t;
  toast(isDenied(e) ? '이 기기는 바꿀 권한이 없습니다. 진행자 비밀번호로 들어오거나 직원 승인을 받아 주세요.' : '저장하지 못했습니다. 인터넷 연결을 확인해 주세요.');
}
function setLive(patch){
  if(!ME.master){ toast('진행자 기기에서만 화면을 넘길 수 있습니다.'); return; }
  S.live = { ...S.live, ...patch, rev:now() }; schedule(); save('live', () => S.live);
}
function applyLive(d){
  if(!d) return;
  if((d.rev || 0) < (S.live.rev || 0)) return;
  const a = d.ann && d.ann.text ? d.ann : null;
  if(ROLE === 'screen' && a && a.id !== lastAnnId){ if(lastAnnId !== '' && a.chime && srvNow() - (a.at || 0) < 15000) SND.chime(); }
  lastAnnId = a ? a.id : (lastAnnId === '' ? '-' : lastAnnId);
  S.live = { ...clone(DEF_LIVE), ...d, ann:a, timer:{ ...DEF_LIVE.timer, ...(d.timer || {}) } };
  schedule();
}
function saveQs(){ S.qs.rev = now(); saveSoon('questions', () => ({ list:S.qs.list, rev:S.qs.rev }), 400); schedule('noEditor'); }
function saveSeats(){ S.seats.rev = now(); saveSoon('seats', () => ({ rows:S.seats.rows, cols:S.seats.cols, people:S.seats.people, map:S.seats.map, adjust:S.seats.adjust, rev:S.seats.rev }), 300); schedule('noTable'); }
function saveBanner(){ S.banner.rev = now(); saveSoon('banner', () => ({ ...S.banner }), 500); schedule('noBannerForm'); }

/* ===================== 받아 오기 ===================== */
const SUBS = { qs:null, host:[] };
let RULES_MISSING = false, RULES_OLD = false;
function subscribeBase(){
  // 규칙 버전 확인: rv2 는 2판 규칙에만 읽기가 열려 있음 (못 읽으면 예전 규칙이 게시돼 있음)
  DB.on('rv2', () => { RULES_OLD = false; }, e => { if(isDenied(e)){ RULES_OLD = true; if(!$('#sheet').hidden && $('#mForm')) openSheet(rulesMissingHTML()); } });
  // live 는 로그인한 모든 기기가 읽을 수 있어야 함: 못 읽으면 서버 규칙을 아직 게시하지 않은 것
  DB.on('live', d => { RULES_MISSING = false; applyLive(d); }, e => { if(isDenied(e)){ RULES_MISSING = true; rulesNotice(); } });
  DB.on('seats', d => { if(d && (d.rev || 0) >= S.seats.rev){ S.seats = { rows:d.rows || 4, cols:d.cols || 5, people:asList(d.people).map(p => ({ id:String(p.id), name:String(p.name || '') })), map:clone(d.map || {}), adjust:clone(d.adjust || {}), rev:d.rev || 0 }; schedule(); } });
  DB.on('banner', d => { if(d && (d.rev || 0) >= S.banner.rev){ S.banner = { ...S.banner, ...d }; schedule(); } });
  DB.on('bannerimg', d => { if(!d){ if(!S.bimg.img) return; S.bimg = { img:'', rev:0 }; schedule(); return; } if((d.rev || 0) >= S.bimg.rev){ S.bimg = { img:d.img || '', rev:d.rev || 0 }; schedule(); } });
  DB.on('marks', d => { S.marks = d || {}; schedule(); });
  DB.on('favs', d => { S.favs = asList(d && d.list).map(String); schedule(); });
}
function onRoleChange(){
  // 문제(정답 포함)는 진행자·직원 기기만 받음
  if(SUBS.qs){ SUBS.qs(); SUBS.qs = null; }
  QS_DENIED = false;
  if(ME.master || ME.staff){
    SUBS.qs = DB.on('questions', d => { QS_DENIED = false; if(d && (d.rev || 0) >= S.qs.rev){ S.qs = { list:asList(d.list).map(normQ), rev:d.rev || 0 }; schedule(); } else if(!d){ S.qs = { list:[], rev:0 }; schedule(); } }, e => { if(isDenied(e)){ QS_DENIED = true; schedule(); } });
  }else{ S.qs = { list:[], rev:0 }; QS_DENIED = true; }
  SUBS.host.forEach(f => f()); SUBS.host = [];
  if(ME.master){
    SUBS.host.push(DB.on('devices', d => { S.devices = d || {}; schedule(); }));
    SUBS.host.push(DB.on('staffs', d => { S.staffs = d || {}; schedule(); }, () => {}));
  }
  radioSubscribe();
  pushPresence();
  if(ROLE) ensureAccess(ROLE);
  schedule();
}
function pushPresence(){ if(DB) DB.presence({ name:(ROLE === 'host' ? '진행자' : ME.name || '이름 없음').slice(0, 20), role:ROLE || 'pick', zone:zoneText(), at:srvNow(), master:ME.master, staff:ME.staff }).catch(() => {}); }
function onNetChange(){
  if(RULES_MISSING && !DEMO) return rulesNotice();
  const ok = DB && DB.st.connected;
  $$('.pill.net').forEach(el => { el.className = 'pill net ' + (DEMO ? 'warn' : ok ? 'ok' : 'bad'); el.textContent = DEMO ? '연습 모드' : ok ? '연결됨' : '연결 끊김 · 다시 연결 중'; });
  if(typeof radioRender === 'function') radioRender();
}

/* ===================== 들어오기 (진행자·직원) ===================== */
// 서버 규칙(database.rules.json)을 아직 Firebase에 게시하지 않았으면 무엇도 읽고 쓸 수 없음 → 비밀번호 대신 게시 방법을 보여 줌
function rulesMissingHTML(){
  return `<h3>${RULES_OLD && !RULES_MISSING ? '서버 규칙을 새 것으로 한 번 더 게시해 주세요' : '서버 준비가 아직 안 됐습니다'}</h3>
    <p>${RULES_OLD && !RULES_MISSING ? '지금 게시된 골든벨 규칙은 예전 것이라, 앱에서 진행자 비밀번호를 처음 정할 수 없습니다. 아래처럼 새 규칙 파일을 다시 붙여 넣고 게시해 주세요.' : '골든벨용 서버 규칙을 Firebase에 한 번 게시해야 진행자 비밀번호를 정하고 쓸 수 있습니다. 가을운동회 때와 같은 곳입니다.'}</p>
    <ol>
      <li>PC에서 <b>console.firebase.google.com</b>에 들어가 <b>handscil-sports</b> 프로젝트를 엽니다.</li>
      <li>왼쪽 <b>빌드 → Realtime Database → 규칙</b> 탭을 엽니다.</li>
      <li>안의 내용을 모두 지우고, 깃허브 저장소의 <b>sports-day/database.rules.json</b> 내용을 그대로 붙여 넣은 뒤 <b>게시</b>를 누릅니다. (운동회·야구 규칙도 함께 들어 있어 그대로 유지됩니다)</li>
      <li>이 화면을 새로 고침하면 진행자 비밀번호를 정하는 창이 나옵니다.</li>
    </ol>
    <p class="muted small">규칙 파일 주소: github.com/handscil01-afk/Sungmo/blob/main/sports-day/database.rules.json</p>
    <div class="row"><button class="btn" data-act="reload">새로 고침</button><div class="sp"></div><button class="btn primary" data-close>닫기</button></div>`;
}
function loginMasterSheet(next){
  if((RULES_MISSING || RULES_OLD) && !DEMO){ openSheet(rulesMissingHTML()); return; }
  openSheet(`<h3>진행자 비밀번호</h3><p class="muted small">진행자 도구와 프로젝터 화면은 진행자 비밀번호로 한 번 들어온 기기에서만 열립니다. 같은 브라우저의 다른 창은 다시 묻지 않습니다.</p>
    <form id="mForm"><input type="password" id="mPw" autocomplete="current-password" placeholder="비밀번호" style="width:100%"><div class="row" style="margin-top:12px"><div class="sp"></div><button type="button" class="btn" data-close>취소</button><button class="btn primary">들어가기</button></div></form>
    ${DEMO ? '<p class="muted small">연습 모드 비밀번호는 0000입니다.</p>' : '<div class="first-run"><b>처음 쓰시나요?</b> 아직 진행자 비밀번호를 정한 적이 없으면 여기서 정하세요. 한 번 정하면 다른 사람은 새로 정할 수 없습니다.<div class="row" style="margin-top:8px"><button type="button" class="btn" data-first>진행자 비밀번호 처음 정하기</button></div></div>'}`, e => {
    if(e.target.closest('[data-first]')) firstPwSheet(next);
  });
  $('#mForm').addEventListener('submit', async e => {
    e.preventDefault(); const pw = $('#mPw').value;
    if(!pw){ toast('비밀번호를 넣어 주세요'); return; }
    try{ await DB.set('masters/' + DB.uid, pw); ME.master = true; closeSheet(); toast('진행자로 들어왔습니다'); onRoleChange(); next && next(); }
    catch(err){ toast(isDenied(err) ? '비밀번호가 맞지 않습니다. 아직 정한 적이 없으면 아래 "처음 정하기"를 누르세요.' : '서버에 연결하지 못했습니다.'); }
  });
}
function rulesNotice(){
  $$('.pill.net').forEach(el => { el.className = 'pill net bad'; el.textContent = '서버 규칙 게시 필요'; });
  if(!$('#sheet').hidden && $('#mForm')) openSheet(rulesMissingHTML());
}
function firstPwSheet(next){
  openSheet(`<h3>진행자 비밀번호 정하기</h3><p class="muted small">진행자 도구와 프로젝터 화면을 열 때 쓰는 비밀번호입니다(4~30자). 진행을 맡을 직원끼리만 알고 계세요. 나중에 바꾸려면 Firebase 콘솔의 데이터 탭에서 goldenbell1 → secret → masterPw를 고칩니다.</p>
    <form id="fForm"><label class="field"><span>새 비밀번호</span><input type="password" id="fPw1" autocomplete="new-password" maxlength="30"></label>
    <label class="field" style="margin-top:8px"><span>한 번 더</span><input type="password" id="fPw2" autocomplete="new-password" maxlength="30"></label>
    <div class="row" style="margin-top:12px"><div class="sp"></div><button type="button" class="btn" data-close>취소</button><button class="btn primary">정하고 들어가기</button></div></form>`);
  $('#fForm').addEventListener('submit', async e => {
    e.preventDefault(); const a = $('#fPw1').value, b = $('#fPw2').value;
    if(a.length < 4){ toast('4자 이상으로 정해 주세요'); return; }
    if(a !== b){ toast('두 번 넣은 비밀번호가 다릅니다'); return; }
    try{ await DB.set('secret/masterPw', a); }
    catch(err){ toast(isDenied(err) ? '진행자 비밀번호가 이미 정해져 있습니다. 정한 사람에게 물어봐 주세요.' : '서버에 연결하지 못했습니다.'); return; }
    try{ await DB.set('masters/' + DB.uid, a); ME.master = true; closeSheet(); toast('진행자 비밀번호를 정하고 들어왔습니다'); onRoleChange(); next && next(); }
    catch(err){ toast('비밀번호는 정했지만 들어가지 못했습니다. 새로 고침한 뒤 그 비밀번호로 들어가 주세요.'); }
  });
}
function loginStaffSheet(){
  openSheet(`<h3>현장 직원으로 들어가기</h3><p class="muted small">이름은 무전과 정답 체크에 함께 나옵니다. 직원 비밀번호를 모르면 이름만 넣고 '승인 기다리기'를 누르세요. 진행자가 진행자 도구 → 직원·기기에서 승인하면 바로 쓸 수 있습니다.</p>
    <form id="sForm"><label class="field"><span>이름</span><input type="text" id="sName" maxlength="20" value="${esc(ME.name)}" placeholder="예: 정성모"></label>
    <label class="field" style="margin-top:8px"><span>직원 비밀번호</span><input type="password" id="sPw" autocomplete="off"></label>
    <div class="row" style="margin-top:12px"><button type="button" class="btn" data-wait>승인 기다리기</button><div class="sp"></div><button type="button" class="btn" data-close>취소</button><button class="btn primary">들어가기</button></div></form>`, e => {
    if(e.target.closest('[data-wait]')){ const n = $('#sName').value.trim(); if(!n){ toast('이름을 넣어 주세요'); return; } ME.name = n.slice(0, 20); ls.set('name', ME.name); closeSheet(); pushPresence(); toast('진행자 승인을 기다립니다'); schedule(); }
  });
  $('#sForm').addEventListener('submit', async e => {
    e.preventDefault(); const n = $('#sName').value.trim().slice(0, 20), pw = $('#sPw').value;
    if(!n){ toast('이름을 넣어 주세요'); return; }
    ME.name = n; ls.set('name', n);
    try{ await DB.set('staffs/' + DB.uid, { pw, name:n, at:srvNow() }); ME.staff = true; closeSheet(); toast('직원으로 들어왔습니다'); onRoleChange(); }
    catch(err){ toast(RULES_MISSING && !DEMO ? '진행자가 아직 서버 준비(규칙 게시)를 하지 않았습니다. 진행자에게 알려 주세요.' : isDenied(err) ? '직원 비밀번호가 맞지 않거나 아직 정해지지 않았습니다. 진행자에게 확인해 주세요.' : '서버에 연결하지 못했습니다.'); pushPresence(); }
  });
}
function ensureAccess(r){
  if(!ME.known || !$('#sheet').hidden) return;
  if((r === 'host' || r === 'screen') && !ME.master) loginMasterSheet();
  if(r === 'staff' && !ME.staff && !ME.master && !ME.name) loginStaffSheet();
}

/* ===================== 진행 동작 ===================== */
function freshTimer(){ const d = S.live.timer.dur || 30; return { dur:d, remain:d, endAt:0, running:false }; }
function startTimer(t){ t = t || S.live.timer; const r = t.running ? remain() : (t.remain > 0 ? t.remain : t.dur); return { ...t, remain:r, endAt:srvNow() + r * 1000, running:true }; }
function goQ(qi, mode){
  const n = S.qs.list.length; if(!n){ toast('문제 편집에서 문제를 먼저 넣어 주세요'); return; }
  qi = Math.max(0, Math.min(n - 1, qi)); mode = mode || 'question';
  let timer = S.live.timer; const changed = qi !== S.live.qi;
  if(changed) timer = freshTimer();
  if(mode === 'question' && S.live.autoTimer && !timer.running && (changed || timer.remain >= timer.dur)) timer = startTimer(timer);
  if(mode === 'answer' && timer.running) timer = { ...timer, remain:remain(), running:false };
  setLive({ qi, mode, timer });
}
function setMode(m){ if(m === 'question' || m === 'answer') goQ(S.live.qi, m); else setLive({ mode:m }); }
function stepNext(){
  const L = S.live, n = S.qs.list.length;
  if(L.mode === 'question') return setMode('answer');
  if(L.mode === 'answer'){ if(L.qi < n - 1) return goQ(L.qi + 1, 'question'); return setLive({ mode:'score' }); }
  if(!n) return toast('문제 편집에서 문제를 먼저 넣어 주세요');
  setMode('question');
}
function stepPrev(){
  const L = S.live;
  if(L.mode === 'answer') return setMode('question');
  if(L.mode === 'question'){ if(L.qi > 0) return goQ(L.qi - 1, 'answer'); return setLive({ mode:'banner' }); }
  setMode('question');
}
function tToggle(){ const t = S.live.timer; if(t.running) setLive({ timer:{ ...t, remain:remain(), running:false } }); else setLive({ timer:startTimer(remain() <= 0 ? { ...t, remain:t.dur } : t) }); }
function tReset(){ setLive({ timer:freshTimer() }); }
function tPlus(){ const t = S.live.timer; if(t.running) setLive({ timer:{ ...t, endAt:t.endAt + 10000 } }); else setLive({ timer:{ ...t, remain:remain() + 10 } }); }

document.addEventListener('keydown', e => {
  if(ROLE !== 'host' && ROLE !== 'screen') return;
  const tg = e.target; if(tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName))) return;
  if(!$('#sheet').hidden) return;
  if(ROLE === 'host' && $('#tab-run').hidden) return;
  if(e.ctrlKey || e.metaKey || e.altKey) return;
  // 프로젝터 창: 처음 누르는 리모컨 버튼은 고른 모니터에 전체 화면 켜기
  if(ROLE === 'screen' && !$('#screenStart').hidden){ e.preventDefault(); screenGo(-2); return; }
  const k = e.key; let done = true;
  if(k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'ArrowDown') stepNext();
  else if(k === 'ArrowLeft' || k === 'PageUp' || k === 'ArrowUp' || k === 'Backspace') stepPrev();
  else if(k === 'b' || k === 'B' || k === '.') setLive({ mode:S.live.mode === 'blank' ? 'question' : 'blank' });
  else if(k === 'a' || k === 'A') setMode('answer');
  else if(k === 'q' || k === 'Q') setMode('question');
  else if(k === 't' || k === 'T') tToggle();
  else if(k === 'h' || k === 'H' || k === 'Home') setLive({ mode:'banner' });
  else if(k === 'g' || k === 'G') setLive({ mode:'seats' });
  else if(k === 's' || k === 'S') setLive({ mode:'score' });
  else if(k === 'F5') setLive({ mode:'banner' });
  else done = false;
  if(done) e.preventDefault();
});

/* ===================== 정답 체크 ===================== */
function toggleMark(pid){
  const q = curQ(); if(!q){ toast('문제를 먼저 넣어 주세요'); return; }
  if(!radioOK()){ toast('직원 승인을 받은 뒤에 체크할 수 있습니다'); return; }
  const id = markId(q.id, pid), cur = S.marks[id], by = { ...(cur && cur.by || {}) }, me = DB.uid;
  let p;
  if(ROLE === 'host'){
    if(cur && by[me]){ delete S.marks[id]; p = DB.remove('marks/' + id); }
    else { by[me] = { n:'진행자', t:srvNow(), r:'host' }; S.marks[id] = { q:q.id, p:pid, by }; p = DB.update('marks/' + id, { q:q.id, p:pid, ['by/' + me]:by[me] }); }
  }else{
    if(by[me]){ delete by[me]; S.marks[id] = { ...cur, by }; p = DB.remove('marks/' + id + '/by/' + me); }
    else { by[me] = { n:myName().slice(0, 20), t:srvNow(), r:'staff' }; S.marks[id] = { q:q.id, p:pid, by }; p = DB.update('marks/' + id, { q:q.id, p:pid, ['by/' + me]:by[me] }); }
  }
  p.catch(writeErr); schedule();
  vib(isMarked(S.marks[id]) ? 25 : [10, 40, 10]);
}
function adjust(pid, d){ S.seats.adjust = { ...(S.seats.adjust || {}) }; S.seats.adjust[pid] = (Number(S.seats.adjust[pid]) || 0) + d; if(!S.seats.adjust[pid]) delete S.seats.adjust[pid]; saveSeats(); }

/* ===================== 좌석 격자 ===================== */
let selPid = null;
function seatGridHTML(kind){
  const { rows, cols, map } = S.seats, pm = peopleMap(), sc = scores(), q = curQ(), me = DB ? DB.uid : '';
  const onlyMine = kind === 'staff' && $('#onlyMine').checked && ME.zone.length;
  const minW = kind === 'staff' ? 76 : kind === 'layout' ? 84 : 72;
  let h = `<div class="seat-grid" style="--cols:${cols};--min:${minW}px">`;
  for(let r = 0; r < rows; r++){
    if(onlyMine && !ME.zone.includes(r + 1)) continue;
    if(kind === 'staff' && rows > 1) h += `<div class="seat-row-lbl">${r + 1}줄${ME.zone.includes(r + 1) ? ' · 내 줄' : ''}</div>`;
    for(let c = 0; c < cols; c++){
      const key = r + '-' + c, p = pm[map[key]], code = `${r + 1}-${c + 1}`;
      if(kind === 'layout'){
        h += p ? `<div class="seat ${selPid === p.id ? 'sel' : ''}" data-seat="${key}" data-pid="${p.id}" draggable="true"><span class="s-code">${code}</span><span class="s-name">${esc(p.name)}</span><button class="s-x" data-act="unseat" data-pid="${p.id}" aria-label="${esc(p.name)} 자리에서 빼기">×</button></div>`
               : `<div class="seat empty" data-seat="${key}"><span class="s-code">${code}</span><span class="s-name" style="font-weight:400;font-size:13px">빈자리</span></div>`;
        continue;
      }
      if(!p){ h += `<div class="seat empty"><span class="s-code">${code}</span></div>`; continue; }
      const m = markFor(q, p.id), by = m && m.by || {}, ks = Object.keys(by);
      const hostN = ks.filter(k => by[k] && by[k].r === 'host').length, staffN = ks.length - hostN, mine = !!by[me] && kind === 'staff';
      let tags = ''; if(hostN) tags += '<i>진행</i>'; if(staffN) tags += `<i>직원${staffN > 1 ? ' ' + staffN : ''}</i>`;
      h += `<button class="seat ${isMarked(m) ? 'is-right' : ''} ${mine ? 'mine' : ''}" data-act="mark" data-pid="${p.id}" aria-pressed="${isMarked(m)}"><span class="s-code">${code}</span><span class="s-name">${esc(p.name)}</span><span class="s-score">${sc[p.id] || 0}점</span><span class="s-by">${tags}</span></button>`;
    }
  }
  return h + '</div>';
}

/* ===================== 그리기 ===================== */
let rq = false, rqFlags = new Set();
function schedule(flag){
  rqFlags.add(flag || 'all'); if(rq) return; rq = true;
  const run = () => { if(!rq) return; rq = false; const f = rqFlags; rqFlags = new Set(); render(f); };
  requestAnimationFrame(run); setTimeout(run, 120);
}
function render(flags){
  $('#pickTitle').innerHTML = `${esc(S.banner.l1)} <em>${esc(S.banner.l2)}</em>`;
  if(ROLE === 'screen') paintStage($('#fullStage'));
  if(ROLE === 'host') renderHost(flags);
  if(ROLE === 'staff') renderStaff();
  radioRender();
}
function answerText(q){ if(!q) return ''; if(q.type === 'ox') return q.answer || ''; if(q.type === 'choice'){ const c = (q.choices || [])[Number(q.answer) - 1]; return q.answer ? `${q.answer}번${c ? ' · ' + c : ''}` : ''; } return q.answer || ''; }
function notesHTML(q, ttl){
  if(!q) return `<div class="card-h">${ttl}</div><div class="empty-state">문제 편집 탭에서 문제를 붙여넣으세요.</div>`;
  const a = answerText(q);
  return `<div class="card-h">${ttl} <span class="hint">${TYPE_LABEL[q.type] || ''}${q.author ? ' · 출제 ' + esc(q.author) : ''}</span></div>
    <div class="q-t">${esc(q.text)}</div>
    ${q.type === 'choice' ? `<div class="memo">${(q.choices || []).map((c, i) => `${i + 1}. ${esc(c)}`).join('&nbsp;&nbsp; ')}</div>` : ''}
    <div class="ans-line">${a ? `<span class="ans-badge">정답 ${esc(a)}</span>` : '<span class="ans-badge none">정답 미입력</span>'}${q.dots ? cellsHTML(q.dots) : ''}</div>
    ${q.expl ? `<div class="memo">해설: <b>${esc(q.expl)}</b></div>` : ''}${q.memo ? `<div class="memo">메모: <b>${esc(q.memo)}</b></div>` : ''}`;
}
function annQuickHTML(){
  const a = S.live.ann;
  const favs = S.favs.slice(0, 8).map((t, i) => `<button class="btn sm" data-act="favSend" data-i="${i}">${esc(t.length > 18 ? t.slice(0, 18) + '…' : t)}</button>`).join('');
  return `<span class="lbl muted">방송 문구</span>${favs || '<span class="muted small">방송 문구 탭에서 자주 쓰는 문구를 저장하면 여기 나옵니다</span>'}<button class="btn sm" data-act="tab" data-t="ann">새 문구…</button>${a ? `<span class="ann-on">지금: ${esc(a.text.slice(0, 24))}</span><button class="btn sm danger" data-act="annClear">내리기</button>` : ''}`;
}
function renderHost(flags){
  const L = S.live, q = curQ(), n = S.qs.list.length, all = flags.has('all');
  if(!$('#tab-run').hidden){
    paintStage($('#miniStage'));
    $('#modeName').textContent = '· ' + MODE_LABEL[L.mode] + (annPhase() ? ' · 방송 문구 표시 중' : '');
    $$('#modeSeg [data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === L.mode));
    $('#annQuick').innerHTML = annQuickHTML();
    $('#hostNotes').innerHTML = notesHTML(q, n ? `지금 문제 · ${Math.min(L.qi + 1, n)} / ${n}` : '지금 문제');
    const nq = S.qs.list[L.qi + 1];
    $('#hostNext').innerHTML = nq ? notesHTML(nq, `다음 문제 · ${L.qi + 2}`) : `<div class="card-h">다음 문제</div><div class="muted">${n ? '마지막 문제입니다. 다음을 누르면 점수 순위가 나옵니다.' : ''}</div>`;
    $('#nextBtn').textContent = L.mode === 'question' ? '정답 공개 ▶' : L.mode === 'answer' ? (L.qi < n - 1 ? '다음 문제 ▶' : '점수 순위 ▶') : '문제 띄우기 ▶';
    $('#qStrip').innerHTML = n ? S.qs.list.map((x, i) => `<button data-act="jump" data-i="${i}" class="${i === L.qi ? 'cur' : i < L.qi ? 'done' : ''}" title="${esc(x.text.slice(0, 40))}">${i + 1}</button>`).join('') : '<span class="muted">문제가 없습니다</span>';
    $('#hostSeats').innerHTML = S.seats.people.length ? seatGridHTML('host') : '<div class="empty-state">좌석·명단 탭에서 참가자 명단을 넣고 좌석에 배치하세요.<br>배치하면 여기서 이름을 눌러 정답자를 체크합니다.</div>';
    $('#markCount').textContent = q ? `${S.seats.people.filter(p => isMarked(markFor(q, p.id))).length}명` : '';
    $('#optTimer').checked = !!L.showTimer; $('#optAuthor').checked = !!L.showAuthor; $('#optAuto').checked = !!L.autoTimer;
    if(document.activeElement !== $('#tDur')) $('#tDur').value = String(L.timer.dur || 30);
    const rk = ME.master ? 'm' : 's';
    if($('#radioHost').dataset.ok !== rk){ $('#radioHost').innerHTML = radioPanelHTML('h'); $('#radioHost').dataset.ok = rk; }
  }
  if(!$('#tab-ann').hidden) renderAnn();
  if(!$('#tab-qs').hidden && (all || !flags.has('noEditor'))) renderEditor();
  if(!$('#tab-seat').hidden) renderSeatTab(flags);
  if(!$('#tab-staff').hidden) renderStaffTab();
  if(!$('#tab-set').hidden) renderSettings();
  tickTimers();
}
function renderStaff(){
  const L = S.live, q = curQ(), n = S.qs.list.length;
  const setup = $('#staffSetup');
  if(!setup.hidden){ $('#zoneBtns').innerHTML = Array.from({ length:S.seats.rows }, (_, i) => `<button class="btn sm ${zoneDraft.includes(i + 1) ? 'on' : ''}" data-act="zone" data-z="${i + 1}">${i + 1}줄</button>`).join(''); }
  if(!radioOK()){
    $('#staffQ').innerHTML = `<div class="card-h">진행자 승인을 기다리는 중</div><p class="muted small" style="margin:0 0 10px">${ME.name ? esc(ME.name) + ' 님, ' : ''}진행자가 승인하면 문제·정답과 체크·무전이 바로 열립니다. 직원 비밀번호를 알면 지금 들어갈 수 있어요.</p><button class="btn primary" data-act="staffLogin">직원 비밀번호로 들어가기</button>`;
  }else if(!q){ $('#staffQ').innerHTML = '<div class="muted">진행자가 아직 문제를 넣지 않았습니다.</div>'; }
  else{
    const a = answerText(q), off = L.mode !== 'question' && L.mode !== 'answer';
    $('#staffQ').innerHTML = `<div class="sq-top"><b>${Math.min(L.qi + 1, n)}번</b><span>/ ${n} · ${TYPE_LABEL[q.type] || ''}${q.author ? ' · 출제 ' + esc(q.author) : ''}</span>${off ? `<span class="pill warn">화면: ${MODE_LABEL[L.mode]}</span>` : L.mode === 'answer' ? '<span class="pill ok">정답 공개 중</span>' : ''}<span class="sq-timer" id="sqTimer"></span></div>
      <div class="sq-text">${esc(q.text)}</div>
      ${q.type === 'choice' ? `<div class="memo">${(q.choices || []).map((c, i) => `${i + 1}. ${esc(c)}`).join('&nbsp;&nbsp; ')}</div>` : ''}
      <div class="sq-ans">${a ? `<span class="ans-badge">정답 ${esc(a)}</span>` : '<span class="ans-badge none">정답 미입력</span>'}${q.expl ? `<span class="muted">${esc(q.expl)}</span>` : ''}</div>`;
  }
  $('#staffSeats').innerHTML = S.seats.people.length ? seatGridHTML('staff') : '<div class="empty-state">진행자가 좌석을 배치하면 여기에 이름이 나옵니다.</div>';
  $('#staffCount').textContent = q ? `${S.seats.people.filter(p => isMarked(markFor(q, p.id))).length}명 정답` : '';
  if(!$('#radioStaff').dataset.ok){ $('#radioStaff').innerHTML = radioPanelHTML('s'); $('#radioStaff').dataset.ok = 1; $('#pttDock').innerHTML = '<button class="ptt dock" data-ptt aria-label="누르고 있는 동안 말하기"><span class="ptt-ic">🎙</span><span class="ptt-t">누르고 말하기</span></button>'; }
  tickTimers();
}

/* ---------- 방송 문구 ---------- */
function renderAnn(){
  const a = S.live.ann, ph = annPhase();
  $('#annNow').innerHTML = a ? `<div class="ann-cur"><b>지금 띄운 문구</b> (${ph === 'full' ? '크게 보이는 중' : '아래 띠'}) <span>${esc(a.text)}</span></div>` : '<p class="muted small">지금 띄운 문구가 없습니다.</p>';
  $('#favList').innerHTML = S.favs.length ? S.favs.map((t, i) => `<div class="fav"><button class="btn fav-t" data-act="favSend" data-i="${i}">${esc(t)}</button><button class="btn sm" data-act="favEdit" data-i="${i}">고치기</button><button class="btn sm danger" data-act="favDel" data-i="${i}">지우기</button></div>`).join('')
    : '<div class="empty-state">저장한 문구가 없습니다.<br>예: "잠시 후 다음 문제가 시작됩니다", "정답을 판에 적어 주세요", "쉬는 시간 10분"</div>';
}
function annSend(text){
  text = String(text || '').trim().slice(0, 120); if(!text){ toast('문구를 적어 주세요'); return; }
  const style = ($('input[name="annStyle"]:checked') || {}).value || 'full';
  setLive({ ann:{ id:uid(), text, style, secs:Number($('#annSecs').value), chime:$('#annChime').checked, at:srvNow() } });
  toast('프로젝터에 문구를 띄웠습니다');
}
function saveFavs(){ save('favs', () => ({ list:S.favs })); schedule(); }

/* ---------- 문제 편집 ---------- */
function qCardHTML(q, i){
  const cur = i === S.live.qi, missing = !q.answer;
  const ansField = q.type === 'ox' ? `<select data-f="answer"><option value="">정답 선택</option><option value="O" ${q.answer === 'O' ? 'selected' : ''}>O</option><option value="X" ${q.answer === 'X' ? 'selected' : ''}>X</option></select>`
    : q.type === 'choice' ? `<select data-f="answer"><option value="">정답 선택</option>${(q.choices || []).map((c, j) => `<option value="${j + 1}" ${String(q.answer) === String(j + 1) ? 'selected' : ''}>${j + 1}번 ${esc(c.slice(0, 16))}</option>`).join('')}</select>`
    : `<input type="text" data-f="answer" value="${esc(q.answer)}" placeholder="정답">`;
  return `<div class="qe ${cur ? 'cur' : ''}" data-qid="${q.id}">
    <div class="qe-h"><b class="qe-n">${i + 1}</b>
      <select data-f="type" aria-label="문제 형식"><option value="ox" ${q.type === 'ox' ? 'selected' : ''}>O / X</option><option value="choice" ${q.type === 'choice' ? 'selected' : ''}>객관식</option><option value="short" ${q.type === 'short' ? 'selected' : ''}>주관식</option></select>
      <input type="text" data-f="author" value="${esc(q.author)}" placeholder="출제자" aria-label="출제자">
      ${missing ? '<span class="warn-chip">정답 미입력</span>' : ''}
      <div class="sp"></div>
      <button class="btn sm" data-act="qShow">이 문제 띄우기</button>
      <button class="btn sm" data-act="qUp" aria-label="위로">▲</button><button class="btn sm" data-act="qDown" aria-label="아래로">▼</button>
      <button class="btn sm danger" data-act="qDel">삭제</button></div>
    <textarea data-f="text" rows="2" aria-label="문제">${esc(q.text)}</textarea>
    ${q.type === 'choice' ? `<label class="field"><span>보기 (한 줄에 하나씩)</span><textarea data-f="choices" rows="${Math.max(2, (q.choices || []).length)}">${esc((q.choices || []).join('\n'))}</textarea></label>` : ''}
    <div class="qe-grid">
      <label class="field"><span>정답</span>${ansField}</label>
      <label class="field"><span>해설 (정답 공개 때 화면에 나옴)</span><input type="text" data-f="expl" value="${esc(q.expl)}"></label>
      <label class="field"><span>점자 그림 (예: 156 / 145 126 34)</span><input type="text" data-f="dots" value="${esc(q.dots)}" placeholder="비우면 안 나옴"></label>
      <label class="field"><span>진행자 메모 (진행자·직원만 봄)</span><input type="text" data-f="memo" value="${esc(q.memo)}"></label>
    </div></div>`;
}
let editorDirty = false;
function renderEditor(force){
  const box = $('#qList');
  if(!force && box.contains(document.activeElement) && document.activeElement.matches('input,textarea,select')){ editorDirty = true; return; }
  editorDirty = false;
  const n = S.qs.list.length; $('#qCount').textContent = n ? `${n}문제 · 정답 미입력 ${S.qs.list.filter(q => !q.answer).length}` : '';
  box.innerHTML = n ? S.qs.list.map(qCardHTML).join('') : '<div class="empty-state">아직 문제가 없습니다.<br>왼쪽에 문제를 붙여넣고 <b>읽어오기</b>를 누르거나, <b>새 문제 추가</b>를 누르세요.</div>';
}
$('#qList').addEventListener('focusout', () => setTimeout(() => { if(editorDirty && !$('#qList').contains(document.activeElement)) renderEditor(); }, 0));
$('#qList').addEventListener('input', e => {
  const el = e.target, f = el.dataset.f, card = el.closest('.qe'); if(!f || !card) return;
  const q = S.qs.list.find(x => x.id === card.dataset.qid); if(!q) return;
  if(f === 'choices') q.choices = el.value.split('\n').map(s => s.trim()).filter(Boolean);
  else if(f === 'type'){ q.type = el.value; if(q.type === 'ox' && !/^[OX]$/.test(q.answer)) q.answer = ''; saveQs(); renderEditor(true); return; }
  else q[f] = el.value;
  if(f === 'answer') card.querySelector('.warn-chip')?.remove();
  saveQs();
});
$('#qList').addEventListener('change', e => { const el = e.target; if(el.dataset.f === 'choices'){ const card = el.closest('.qe'); const q = S.qs.list.find(x => x.id === card.dataset.qid); if(q && q.type === 'choice' && +q.answer > q.choices.length) q.answer = ''; renderEditor(true); } });
let parsed = [];
function doParse(){
  parsed = parseQuestions($('#pasteBox').value);
  const miss = parsed.filter(q => !q.answer).length;
  $('#parseInfo').textContent = parsed.length ? `${parsed.length}문제를 찾았습니다${miss ? ` · 정답 없는 문제 ${miss}개` : ''}` : '문제를 찾지 못했습니다';
  $('#parsePrev').innerHTML = parsed.map((q, i) => `<div class="pp"><b>${i + 1}</b> [${TYPE_LABEL[q.type]}${q.author ? ' · ' + esc(q.author) : ''}] ${esc(q.text.slice(0, 70))}${q.text.length > 70 ? '…' : ''}${q.type === 'choice' ? ` <span class="muted">(보기 ${q.choices.length})</span>` : ''} → ${q.answer ? '정답 ' + esc(answerText(q)) : '<span class="w">정답 없음</span>'}${q.expl ? ` <span class="muted">해설: ${esc(q.expl)}</span>` : ''}${q.memo ? ` <span class="w">${esc(q.memo)}</span>` : ''}</div>`).join('');
  $('#parseBtns').hidden = !parsed.length;
}
function parseDone(msg){ parsed = []; $('#parseBtns').hidden = true; $('#parsePrev').innerHTML = ''; $('#parseInfo').textContent = msg; $('#pasteBox').value = ''; saveQs(); renderEditor(true); }

/* ---------- 좌석·명단 ---------- */
function renderSeatTab(flags){
  const { rows, cols } = S.seats;
  if(document.activeElement !== $('#rowsIn')) $('#rowsIn').value = rows;
  if(document.activeElement !== $('#colsIn')) $('#colsIn').value = cols;
  const so = seatOf(), pm = S.seats.people, free = pm.filter(p => !so[p.id]);
  $('#peopleCount').textContent = `전체 ${pm.length}명 · 좌석 ${rows * cols}자리 · 자리 없음 ${free.length}명`;
  $('#pool').innerHTML = free.length ? free.map(p => `<span class="chip ${selPid === p.id ? 'sel' : ''}" draggable="true" data-pid="${p.id}" data-act="selChip" tabindex="0">${esc(p.name)}</span>`).join('') : `<span class="muted small">${pm.length ? '모두 자리에 앉았습니다' : '명단을 붙여넣고 추가하세요'}</span>`;
  $('#layoutSeats').innerHTML = seatGridHTML('layout');
  const tb = $('#pTable');
  if(tb.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  const sc = scores();
  tb.innerHTML = pm.length ? `<thead><tr><th>이름</th><th>좌석</th><th class="num">점수</th><th>보정</th><th></th></tr></thead><tbody>${pm.map(p => `<tr><td><input type="text" value="${esc(p.name)}" data-pname="${p.id}" aria-label="이름"></td><td>${esc(seatLabel(so[p.id]))}</td><td class="num">${sc[p.id] || 0}</td><td><div class="row nowrap"><button class="btn sm" data-act="adj" data-pid="${p.id}" data-d="-1">−1</button><span class="num" style="min-width:2em">${S.seats.adjust?.[p.id] || 0}</span><button class="btn sm" data-act="adj" data-pid="${p.id}" data-d="1">+1</button></div></td><td><button class="btn sm danger" data-act="pDel" data-pid="${p.id}">빼기</button></td></tr>`).join('')}</tbody>` : '<tbody><tr><td class="muted">명단이 비어 있습니다</td></tr></tbody>';
}
function place(pid, key){
  const map = { ...S.seats.map }; let oldKey = null;
  for(const [k, v] of Object.entries(map)) if(v === pid){ oldKey = k; delete map[k]; }
  const other = map[key];
  if(other && other !== pid){ if(oldKey) map[oldKey] = other; else delete map[key]; }
  map[key] = pid; S.seats.map = map; selPid = null; saveSeats();
}
function unseat(pid){ const map = { ...S.seats.map }; for(const [k, v] of Object.entries(map)) if(v === pid) delete map[k]; S.seats.map = map; saveSeats(); }
function addPeople(){
  const raw = $('#peopleIn').value.trim(); if(!raw) return;
  let names = raw.split(/\n/); if(names.length === 1) names = raw.split(/[,，\t]/);
  names = names.map(s => s.replace(/^\s*\d+\s*[.)]\s*/, '').split('\t')[0].trim()).filter(Boolean);
  S.seats.people = [...S.seats.people, ...names.map(name => ({ id:'p' + uid(), name:name.slice(0, 20) }))];
  $('#peopleIn').value = ''; saveSeats(); toast(`${names.length}명을 명단에 추가했습니다`);
}
function autoSeat(){
  const so = seatOf(), free = S.seats.people.filter(p => !so[p.id]); const map = { ...S.seats.map }; let i = 0;
  for(let r = 0; r < S.seats.rows; r++) for(let c = 0; c < S.seats.cols; c++){ const k = r + '-' + c; if(!map[k] && i < free.length) map[k] = free[i++].id; }
  S.seats.map = map; saveSeats(); if(i < free.length) toast(`자리가 모자라 ${free.length - i}명은 그대로 남았습니다`);
}
function setGrid(r, c){
  r = Math.max(1, Math.min(12, r | 0)); c = Math.max(1, Math.min(15, c | 0)); const map = {};
  for(const [k, v] of Object.entries(S.seats.map)){ const [a, b] = k.split('-').map(Number); if(a < r && b < c) map[k] = v; }
  const lost = Object.keys(S.seats.map).length - Object.keys(map).length; S.seats.rows = r; S.seats.cols = c; S.seats.map = map; saveSeats();
  if(lost) toast(`좌석이 줄어 ${lost}명이 자리 없음으로 옮겨졌습니다`);
}
document.addEventListener('dragstart', e => { const el = e.target.closest && e.target.closest('[draggable][data-pid]'); if(!el) return; e.dataTransfer.setData('text/plain', el.dataset.pid); e.dataTransfer.effectAllowed = 'move'; });
document.addEventListener('dragover', e => { const t = e.target.closest && e.target.closest('#layoutSeats [data-seat],#pool'); if(!t) return; e.preventDefault(); $$('.drop').forEach(x => x !== t && x.classList.remove('drop')); t.classList.add('drop'); });
document.addEventListener('dragleave', e => { const t = e.target.closest && e.target.closest('.drop'); if(t && !t.contains(e.relatedTarget)) t.classList.remove('drop'); });
document.addEventListener('drop', e => { const t = e.target.closest && e.target.closest('#layoutSeats [data-seat],#pool'); if(!t) return; e.preventDefault(); $$('.drop').forEach(x => x.classList.remove('drop')); const pid = e.dataTransfer.getData('text/plain'); if(!pid) return; if(t.id === 'pool') unseat(pid); else place(pid, t.dataset.seat); });
document.addEventListener('dragend', () => $$('.drop').forEach(x => x.classList.remove('drop')));

/* ---------- 직원·기기 ---------- */
const ROLE_NAME = { host:'진행자 도구', screen:'프로젝터 화면', staff:'현장 직원', pick:'고르는 중' };
function renderStaffTab(){
  const at = ls.get('staffPwAt', 0);
  $('#staffPwInfo').textContent = at ? `이 기기에서 ${new Date(at).toLocaleString('ko-KR')}에 정했습니다. 직원들에게 알려 주세요.` : '아직 이 기기에서 정한 적이 없습니다. 먼저 정해 두세요. (보안상 정해 둔 비밀번호는 다시 볼 수 없습니다)';
  const devs = Object.entries(S.devices).filter(([, d]) => d && typeof d === 'object');
  const cnt = { screen:0, host:0, staff:0 }; devs.forEach(([, d]) => { if(d.role in cnt) cnt[d.role]++; });
  $('#devHint').textContent = `프로젝터 ${cnt.screen} · 진행자 ${cnt.host} · 직원 ${cnt.staff}`;
  devs.sort((a, b) => (a[1].role === 'staff' ? 0 : 1) - (b[1].role === 'staff' ? 0 : 1) || String(a[1].name).localeCompare(String(b[1].name), 'ko'));
  $('#devList').innerHTML = devs.length ? devs.map(([u, d]) => {
    const isStaff = !!S.staffs[u], me = u === DB.uid;
    const btn = me || d.master ? '' : isStaff ? `<button class="btn sm danger" data-act="unstaff" data-u="${esc(u)}">승인 빼기</button>` : `<button class="btn sm primary" data-act="grant" data-u="${esc(u)}" data-n="${esc(d.name || '')}">직원으로 승인</button>`;
    return `<div class="dev"><div class="dev-t"><b>${esc(d.name || '이름 없음')}</b>${me ? ' <small>(이 기기)</small>' : ''}<span class="muted small">${ROLE_NAME[d.role] || ''}${d.zone ? ' · ' + esc(d.zone) : ''}${d.master ? ' · 진행자' : isStaff ? ' · 직원 승인됨' : d.role === 'staff' ? ' · 승인 기다림' : ''}</span></div>${btn}</div>`;
  }).join('') : '<div class="muted small">접속한 기기가 없습니다</div>';
}

/* ---------- 현수막·설정 ---------- */
function renderSettings(){
  paintStage($('#bannerPrev'), 'banner', { noAnn:true });
  paintStage($('#stripPrev'), 'question', { noAnn:true });
  const b = S.banner;
  [['#bnL1', 'l1'], ['#bnL2', 'l2'], ['#bnSub', 'sub'], ['#bnInfo', 'info']].forEach(([s, k]) => { const el = $(s); if(document.activeElement !== el) el.value = b[k] || ''; });
  $('#bnImgInfo').textContent = S.bimg.img ? `이미지 사용 중 (${Math.round(S.bimg.img.length * 0.75 / 1024)}KB)` : '이미지 없음 · 글 현수막 사용 중';
  $('#bnClearBtn').disabled = !S.bimg.img;
  $$('#scaleSeg [data-v]').forEach(x => x.classList.toggle('on', Number(x.dataset.v) === Number(S.live.scale || 1)));
  $$('#stripSeg [data-v]').forEach(x => x.classList.toggle('on', x.dataset.v === S.live.strip));
  $('#optSound').checked = !!S.live.sound;
}
async function compressImage(file){
  const url = URL.createObjectURL(file); const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const s = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight)); let cw = Math.round(img.naturalWidth * s), ch = Math.round(img.naturalHeight * s);
  const c = document.createElement('canvas');
  for(let a = 0; a < 8; a++){
    c.width = cw; c.height = ch; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, cw, ch); x.drawImage(img, 0, 0, cw, ch);
    for(const qy of [0.88, 0.78, 0.68, 0.58]){ const d = c.toDataURL('image/jpeg', qy); if(d.length < 700000){ URL.revokeObjectURL(url); return d; } }
    cw = Math.round(cw * .8); ch = Math.round(ch * .8);
  }
  URL.revokeObjectURL(url); throw new Error('too big');
}
function saveCSV(){
  const rows = rankRows(), qs = S.qs.list;
  const head = ['순위', '이름', '좌석', '점수', '보정', ...qs.map((q, i) => `${i + 1}번`)];
  const lines = [head, ...rows.map(r => [r.rank, r.p.name, seatLabel(r.seat), r.s, S.seats.adjust?.[r.p.id] || 0, ...qs.map(q => isMarked(markFor(q, r.p.id)) ? 'O' : '')])];
  const csv = '﻿' + lines.map(l => l.map(v => { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' })); a.download = '점자골든벨_결과.csv';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('결과 표를 저장했습니다 (다운로드 폴더)');
}
async function resetScores(){ S.marks = {}; S.seats.adjust = {}; saveSeats(); schedule(); try{ await DB.remove('marks'); toast('정답 체크와 점수를 모두 지웠습니다'); }catch(e){ writeErr(e); } }

/* ===================== 화면 전환 ===================== */
function showRole(r){
  ROLE = ['screen', 'host', 'staff'].includes(r) ? r : '';
  $('#vPick').hidden = !!ROLE; $('#vScreen').hidden = ROLE !== 'screen'; $('#vHost').hidden = ROLE !== 'host'; $('#vStaff').hidden = ROLE !== 'staff';
  document.body.classList.toggle('screen-mode', ROLE === 'screen');
  if(ROLE) ss.set('role', ROLE);
  if(ROLE === 'screen'){ $('#screenStart').hidden = fsActive(); screenStartDraw(); }
  ensureAccess(ROLE);
  pushPresence(); schedule(); paintInstall();
}
function setRole(r){ try{ if(location.hash !== '#' + r) history.replaceState(null, '', '#' + r); }catch(e){} showRole(r); }
function route(){ const h = (location.hash || '').replace('#', ''); if(['screen', 'host', 'staff'].includes(h)) showRole(h); else if(h === 'pick' || !ss.get('role')) showRole(''); else showRole(ss.get('role')); }
addEventListener('hashchange', route);
function setTab(t){ $$('#hostTabs [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t)); ['run', 'ann', 'qs', 'seat', 'staff', 'set'].forEach(x => $('#tab-' + x).hidden = x !== t); if(t === 'qs') renderEditor(true); schedule(); }
let zoneDraft = [];
function openSetup(){ zoneDraft = ME.zone.slice(); $('#staffSetup').hidden = false; $('#meName').value = ME.name; schedule(); }

/* 진행자 좌석: 길게 누르기 → 점수 조정 */
let lpTimer = null, lpFired = false, popPid = null;
document.addEventListener('pointerdown', e => { const s = e.target.closest('#hostSeats [data-pid]'); if(!s) return; lpFired = false; clearTimeout(lpTimer); lpTimer = setTimeout(() => { lpFired = true; openPop(s.dataset.pid, e.clientX, e.clientY); }, 600); });
['pointerup', 'pointercancel'].forEach(ev => document.addEventListener(ev, () => clearTimeout(lpTimer), true));
document.addEventListener('contextmenu', e => { const s = e.target.closest('#hostSeats [data-pid]'); if(!s) return; e.preventDefault(); openPop(s.dataset.pid, e.clientX, e.clientY); });
function openPop(pid, x, y){
  popPid = pid; const p = peopleMap()[pid]; if(!p) return; const pop = $('#pop');
  pop._draw = () => { pop.innerHTML = `<div class="pn">${esc(p.name)} <span class="muted small">${esc(seatLabel(seatOf()[pid]))}</span></div><div class="ps">${scores()[pid] || 0}점</div><div class="muted small">문제와 상관없이 점수를 더하거나 뺍니다 (보정 ${S.seats.adjust?.[pid] || 0})</div><div class="row"><button class="btn" data-act="popAdj" data-d="-1">−1점</button><button class="btn" data-act="popAdj" data-d="1">+1점</button><div class="sp"></div><button class="btn sm" data-act="popClose">닫기</button></div>`; };
  pop._draw(); pop.hidden = false; const r = pop.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(innerWidth - r.width - 8, x - r.width / 2)) + 'px'; pop.style.top = Math.max(8, Math.min(innerHeight - r.height - 8, y + 12)) + 'px';
}
const closePop = () => { $('#pop').hidden = true; popPid = null; };

/* ===================== 누르기 ===================== */
document.addEventListener('click', e => {
  const pop = $('#pop'); if(!pop.hidden && !pop.contains(e.target) && !e.target.closest('#hostSeats')) closePop();
  // 좌석 배치: 누르기로 앉히기
  const ls_ = e.target.closest('#layoutSeats [data-seat]');
  if(ls_ && !e.target.closest('[data-act="unseat"]')){ if(selPid){ place(selPid, ls_.dataset.seat); return; } if(ls_.dataset.pid){ selPid = ls_.dataset.pid; schedule(); return; } }
  const el = e.target.closest('[data-act]'); if(!el) return;
  const a = el.dataset.act;
  if(e.detail > 0 && el.tagName === 'BUTTON' && (ROLE === 'host' || ROLE === 'screen')) el.blur();
  switch(a){
    case 'role': setRole(el.dataset.r); break;
    case 'reload': location.reload(); break;
    case 'pick': setRole('pick'); break;
    case 'tab': setTab(el.dataset.t); break;
    case 'fsToggle': FS.toggle(); break;
    case 'install': installSheet(); break;
    case 'installLater': UIP.installDismissed = true; saveUIP(); paintInstall(); toast('아래 "홈 화면에 설치하기"로 언제든 설치할 수 있어요'); break;
    case 'settings': settingsSheet(); break;
    case 'openScreen': openScreenFlow(); break;
    case 'ssGo': screenGo(+el.dataset.i); break;
    case 'ssLoad': loadScreens().then(screenStartDraw); break;
    case 'screenPick': $('#screenStart').hidden = false; screenStartDraw(); break;
    case 'stepNext': stepNext(); break;
    case 'stepPrev': stepPrev(); break;
    case 'mode': setMode(el.dataset.m); break;
    case 'jump': goQ(+el.dataset.i, 'question'); break;
    case 'tToggle': tToggle(); break;
    case 'tReset': tReset(); break;
    case 'tPlus': tPlus(); break;
    case 'mark': if(lpFired){ lpFired = false; return; } toggleMark(el.dataset.pid); break;
    case 'popAdj': if(popPid){ adjust(popPid, +el.dataset.d); setTimeout(() => { const p = $('#pop'); p._draw && p._draw(); }, 0); } break;
    case 'popClose': closePop(); break;
    case 'annSend': annSend($('#annText').value); break;
    case 'annSave': { const t = $('#annText').value.trim().slice(0, 120); if(!t){ toast('문구를 적어 주세요'); break; } if(!S.favs.includes(t)){ S.favs = [...S.favs, t]; saveFavs(); } toast('자주 쓰는 문구에 저장했습니다'); break; }
    case 'annClear': setLive({ ann:null }); toast('문구를 내렸습니다'); break;
    case 'favSend': { const t = S.favs[+el.dataset.i]; if(t) annSend(t); break; }
    case 'favEdit': { const t = S.favs[+el.dataset.i]; if(t != null){ $('#annText').value = t; S.favs = S.favs.filter((_, i) => i !== +el.dataset.i); saveFavs(); $('#annText').focus(); toast('위 칸에서 고친 뒤 다시 저장하세요'); } break; }
    case 'favDel': if(arm(el, 'fav' + el.dataset.i, '정말 지우기')){ S.favs = S.favs.filter((_, i) => i !== +el.dataset.i); saveFavs(); } break;
    case 'parse': doParse(); break;
    case 'parseAppend': if(parsed.length){ S.qs.list = [...S.qs.list, ...parsed]; parseDone('목록 뒤에 추가했습니다'); } break;
    case 'parseReplace': if(parsed.length && arm(el, 'replace', '한 번 더 누르면 기존 문제를 모두 바꿉니다')){ S.qs.list = parsed; if(S.live.qi >= S.qs.list.length) setLive({ qi:0 }); parseDone('전체를 바꿨습니다'); } break;
    case 'qAdd': S.qs.list = [...S.qs.list, { id:'q' + uid(), type:'ox', author:S.qs.list.at(-1)?.author || '', text:'', choices:[], answer:'', expl:'', dots:'', memo:'' }]; saveQs(); renderEditor(true); setTimeout(() => { const t = $$('#qList .qe textarea[data-f="text"]').pop(); t && t.focus(); }, 30); break;
    case 'qShow': case 'qUp': case 'qDown': case 'qDel': {
      const card = el.closest('.qe'); const i = S.qs.list.findIndex(x => x.id === card.dataset.qid); if(i < 0) break;
      if(a === 'qShow'){ goQ(i, 'question'); toast(`${i + 1}번 문제를 띄웠습니다`); renderEditor(true); break; }
      if(a === 'qDel'){ if(!arm(el, 'del' + card.dataset.qid, '정말 삭제')) break; S.qs.list = S.qs.list.filter((_, j) => j !== i); if(S.live.qi >= S.qs.list.length && S.qs.list.length) setLive({ qi:S.qs.list.length - 1 }); }
      else { const j = a === 'qUp' ? i - 1 : i + 1; if(j < 0 || j >= S.qs.list.length) break; const L = S.qs.list.slice(); [L[i], L[j]] = [L[j], L[i]]; S.qs.list = L; }
      saveQs(); renderEditor(true); break; }
    case 'preset': setGrid(+el.dataset.r, +el.dataset.c); break;
    case 'autoSeat': autoSeat(); break;
    case 'clearSeats': if(arm(el, 'clearSeats', '한 번 더 누르면 모두 비웁니다')){ S.seats.map = {}; saveSeats(); } break;
    case 'addPeople': addPeople(); break;
    case 'selChip': selPid = selPid === el.dataset.pid ? null : el.dataset.pid; schedule(); break;
    case 'unseat': e.stopPropagation(); unseat(el.dataset.pid); break;
    case 'adj': adjust(el.dataset.pid, +el.dataset.d); break;
    case 'pDel': if(arm(el, 'pdel' + el.dataset.pid, '정말 빼기')){ const pid = el.dataset.pid; S.seats.people = S.seats.people.filter(p => p.id !== pid); unseat(pid); } break;
    case 'bnClear': if(arm(el, 'bnClear', '한 번 더 누르면 지웁니다')){ S.bimg = { img:'', rev:now() }; save('bannerimg', () => null); schedule(); } break;
    case 'strip': setLive({ strip:el.dataset.v }); break;
    case 'scale': setLive({ scale:Number(el.dataset.v) }); break;
    case 'testBell': SND.unlock(); SND.bell(); break;
    case 'csv': saveCSV(); break;
    case 'resetScores': if(arm(el, 'reset', '한 번 더 누르면 모두 지웁니다')) resetScores(); break;
    case 'setStaffPw': { const pw = $('#staffPwIn').value.trim(); if(pw.length < 4){ toast('4자 이상으로 정해 주세요'); break; } DB.set('secret/staffPw', pw).then(() => { ls.set('staffPwAt', now()); $('#staffPwIn').value = ''; toast('직원 비밀번호를 정했습니다'); schedule(); }).catch(writeErr); break; }
    case 'grant': DB.set('staffs/' + el.dataset.u, { name:(el.dataset.n || '직원').slice(0, 20), by:'host', at:srvNow() }).then(() => toast('직원으로 승인했습니다')).catch(writeErr); break;
    case 'unstaff': if(arm(el, 'un' + el.dataset.u, '정말 빼기')) DB.remove('staffs/' + el.dataset.u).then(() => toast('승인을 뺐습니다')).catch(writeErr); break;
    case 'radioCut': DB.forceRelease().then(() => toast('무전을 끊었습니다')).catch(writeErr); break;
    case 'rq': sendMsg(el.dataset.t); break;
    case 'staffLogin': loginStaffSheet(); break;
    case 'staffSetup': $('#staffSetup').hidden ? openSetup() : ($('#staffSetup').hidden = true); break;
    case 'zone': { const z = +el.dataset.z; zoneDraft = zoneDraft.includes(z) ? zoneDraft.filter(x => x !== z) : [...zoneDraft, z]; schedule(); break; }
    case 'staffSave': { const n = $('#meName').value.trim().slice(0, 20); if(n){ ME.name = n; ls.set('name', n); } ME.zone = zoneDraft.slice(); ls.set('zone', ME.zone); $('#staffSetup').hidden = true; pushPresence(); schedule(); toast('저장했습니다'); break; }
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if(t.id === 'optTimer') setLive({ showTimer:t.checked });
  else if(t.id === 'optAuthor') setLive({ showAuthor:t.checked });
  else if(t.id === 'optAuto') setLive({ autoTimer:t.checked });
  else if(t.id === 'optSound') setLive({ sound:t.checked });
  else if(t.id === 'tDur'){ const d = +t.value; const tm = S.live.timer; setLive({ timer:tm.running ? { ...tm, dur:d } : { dur:d, remain:d, endAt:0, running:false } }); }
  else if(t.id === 'rowsIn' || t.id === 'colsIn') setGrid(+$('#rowsIn').value, +$('#colsIn').value);
  else if(t.id === 'onlyMine') schedule();
  else if(t.id === 'bnFile' && t.files && t.files[0]){
    compressImage(t.files[0]).then(d => { S.bimg = { img:d, rev:now() }; save('bannerimg', () => ({ img:S.bimg.img, rev:S.bimg.rev })); schedule(); toast('현수막 이미지를 올렸습니다'); })
      .catch(() => toast('이미지를 읽지 못했습니다. JPG나 PNG로 다시 올려 주세요.'));
    t.value = '';
  }
});
document.addEventListener('input', e => {
  const t = e.target, bn = { bnL1:'l1', bnL2:'l2', bnSub:'sub', bnInfo:'info' }[t.id];
  if(bn){ S.banner[bn] = t.value; saveBanner(); return; }
  if(t.dataset.pname){ const p = S.seats.people.find(x => x.id === t.dataset.pname); if(p){ p.name = t.value.slice(0, 20); saveSeats(); } }
});
document.addEventListener('keydown', e => { const c = e.target.closest && e.target.closest('.chip[data-pid]'); if(c && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); c.click(); } });
$('#peopleIn').addEventListener('keydown', e => { if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addPeople(); });
let idleT = null; document.addEventListener('mousemove', () => { document.body.classList.remove('idle'); clearTimeout(idleT); if(ROLE === 'screen') idleT = setTimeout(() => document.body.classList.add('idle'), 3000); });

/* ===================== 시작 ===================== */
async function boot(){
  observeStages(); route(); paintInstall();
  if(DEMO) $$('.demo-note').forEach(x => x.hidden = false);
  try{ DB = DEMO ? demoDB() : await firebaseDB(); }
  catch(e){ console.error(e); $$('.pill.net').forEach(el => { el.className = 'pill net bad'; el.textContent = '서버에 연결하지 못했습니다'; }); toast('서버에 연결하지 못했습니다. 인터넷을 확인한 뒤 새로 고침해 주세요.'); return; }
  onNetChange();
  subscribeBase();
  let gotM = false, gotS = false;
  const settle = () => { if(gotM && gotS && !ME.known){ ME.known = true; onRoleChange(); } else if(ME.known) onRoleChange(); };
  DB.on('masters/' + DB.uid, v => { ME.master = v != null; gotM = true; settle(); }, () => { ME.master = false; gotM = true; settle(); });
  DB.on('staffs/' + DB.uid, v => { ME.staff = v != null; gotS = true; if(v && v.name && !ME.name){ ME.name = String(v.name); ls.set('name', ME.name); } settle(); }, () => { ME.staff = false; gotS = true; settle(); });
  setTimeout(() => { if(!ME.known){ gotM = gotS = true; settle(); } }, 6000);
}
boot();
