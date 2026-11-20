'use strict';
/* ===================== 입력 화면 (통역하는 분의 노트북) =====================
   보내는 방식 두 가지 (방마다 rooms/<방>/mode, 통역 중에도 바꿀 수 있음)
   - 한 줄씩(line, 영화 자막): 아래 칸에 치고 Enter를 누르면 한 줄이 통째로 감. 치는 중인 글은 안 보냄
   - 바로바로(live, 대화): 메모장 칸 하나. 바뀐 줄만 DRAFT_MS 간격으로 보내고, 내 커서 위치도 보냄
   두 방식 모두 같은 lines(줄 열쇠 → 글)를 쓰므로 방식을 바꿔도 내용이 이어짐 */
const DEFAULT_SPK = ['화자1', '화자2', '화자3'];
const TS = { size:2, name:'', sttTo:'send', minutes:false, speakers:DEFAULT_SPK.slice(), ...ls.get('tp', {}) };
const saveTS = () => ls.set('tp', TS);
const TSIZES = [15, 17, 20, 24, 28, 34];
const PREFIX = { '1':'[해설] ', '2':'[소리] ', '3':'[음악] ' };
const MAX_LINE = 5000;
const TP = { code:null, host:false, pin:null, meta:null, mode:'line', doc:{}, keys:[], readers:{}, unsub:[], hb:0, pendingEnter:false, rows:new Map(), warned:false,
  sent:[], dirty:false, again:false, flushT:0, composing:false, lastCur:'', longWarned:false };
const tbase = () => 'rooms/' + TP.code + '/';
const cleanLine = t => String(t || '').replace(/\s*[\r\n]+\s*/g, ' ');

function rulesSheet(){
  openSheet(`<h2 tabindex="-1">서버 규칙을 먼저 게시해 주세요</h2>
    <p>문자통역 자료를 저장할 자리가 서버에 아직 열려 있지 않거나, 예전 규칙이 게시되어 있어요. 한 번만 하면 됩니다.</p>
    <ol><li><b>console.firebase.google.com</b> → <b>handscil-sports</b> 프로젝트를 엽니다.</li>
    <li><b>Realtime Database → 규칙</b> 탭을 엽니다.</li>
    <li>저장소의 <b>sports-day/database.rules.json</b> 내용을 그대로 붙여 넣고 <b>게시</b>를 누릅니다.</li></ol>
    <p class="muted">운동회·야구·골든벨 규칙은 그대로이고 문자통역(caption1) 부분만 더해진 파일입니다.</p>
    <div class="row"><div class="sp"></div><button class="btn primary" data-close>알겠어요</button></div>`);
}
function writeErr(e){
  if(isDenied(e)){ if(!TP.warned){ TP.warned = true; rulesSheet(); } }
  else toast('보내지 못했어요. 인터넷 연결을 확인해 주세요');
}

function typistStartSheet(){
  const h = ls.get('host');
  const box = openSheet(`<h2 tabindex="-1">통역 입력하기</h2>
    ${h ? `<div class="card"><p>전에 만든 방: <b>${esc(h.title)}</b> (방 ${esc(h.code)})</p><div class="row"><button class="btn primary" data-resume>이 방에서 이어서 입력하기</button></div></div>` : ''}
    <div class="card"><h3>새 방 만들기</h3>
      <label class="field"><span>방 이름 (읽는 분 화면에 보입니다)</span><input type="text" id="nTitle" maxlength="40" value="${esc((h && h.title) || '영화 문자통역')}"></label>
      <label class="field"><span>내 이름 (교대할 때 구분용)</span><input type="text" id="nName" maxlength="20" value="${esc(TS.name || '')}" placeholder="예: 김통역"></label>
      <fieldset class="fs"><legend>보내는 방식 (통역 중에도 바꿀 수 있어요)</legend>
        <label class="chk srow"><input type="radio" name="nMode" value="line" checked> <b>한 줄씩 (영화)</b> <small class="muted">영화 자막처럼 한 줄을 다 치고 Enter를 누르면 보냅니다</small></label>
        <label class="chk srow"><input type="radio" name="nMode" value="memo"> <b>메모장 (행사·대화)</b> <small class="muted">메모장에 치는 글자가 그대로 보입니다</small></label>
        <label class="chk srow"><input type="radio" name="nMode" value="minutes"> <b>회의록</b> <small class="muted">메모장 + 화자 이름 단축키(Alt+숫자, Tab), 저장하면 화자별로 줄을 나눈 회의록 파일</small></label>
      </fieldset>
      <div class="row"><button class="btn ${h ? '' : 'primary'}" data-new>새 방 만들기</button></div></div>
    <div class="card"><h3>교대 입력자로 들어가기</h3>
      <p class="muted small">방을 만든 노트북의 '방 정보'에 나오는 방 번호와 교대 비밀번호를 넣으세요.</p>
      <div class="row">
        <label class="field"><span>방 번호</span><input type="text" id="sCode" inputmode="numeric" maxlength="4" autocomplete="off"></label>
        <label class="field"><span>교대 비밀번호</span><input type="text" id="sPin" inputmode="numeric" maxlength="4" autocomplete="off"></label>
        <label class="field"><span>내 이름</span><input type="text" id="sName" maxlength="20" value="${esc(TS.name || '')}"></label>
      </div>
      <div class="row"><button class="btn" data-shift>교대 입력자로 들어가기</button></div></div>
    <div class="row"><div class="sp"></div><button class="btn ghost" data-close>닫기</button></div>`, async e => {
      const b = e.target.closest('button'); if(!b || b.disabled) return;
      if(b.hasAttribute('data-resume')){ b.disabled = true; const ok = await typistResume({ code:h.code, host:true }); if(ok) closeSheet(); else { b.disabled = false; toast('그 방이 없어졌어요. 새 방을 만들어 주세요'); ls.del('host'); } }
      if(b.hasAttribute('data-new')){
        TS.name = $('#nName', box).value.trim().slice(0, 20); saveTS();
        const pick = ($('input[name=nMode]:checked', box) || {}).value || 'line';
        TS.minutes = pick === 'minutes'; saveTS();
        b.disabled = true; const ok = await typistCreate($('#nTitle', box).value, pick === 'line' ? 'line' : 'live'); b.disabled = false;
        if(ok){ closeSheet(); if(pick === 'minutes' && isDefaultSpk()) setTimeout(speakerSheet, 300); }
      }
      if(b.hasAttribute('data-shift')){
        const name = $('#sName', box).value.trim().slice(0, 20) || '교대 입력자';
        TS.name = name; saveTS();
        b.disabled = true; const ok = await typistShift($('#sCode', box).value, $('#sPin', box).value, name); b.disabled = false;
        if(ok) closeSheet();
      }
    }, h ? 'button[data-resume]' : '#nTitle');
}

async function typistCreate(title, mode){
  title = String(title || '').trim().slice(0, 40) || '영화 문자통역';
  const name = TS.name || '입력자 1';
  for(let i = 0; i < 15; i++){
    const code = String(1000 + Math.floor(Math.random() * 9000));
    let meta;
    try{ meta = await DB.get('rooms/' + code + '/meta'); }
    catch(e){ writeErr(e); return false; }
    if(meta && DB.now() - (meta.at || 0) < ROOM_STALE_MS) continue;
    const pin = String(1000 + Math.floor(Math.random() * 9000));
    try{ await DB.set('rooms/' + code, { meta:{ host:DB.uid, title, at:DB.ts(), open:true }, mode:mode || 'line', secret:{ pin }, typers:{ [DB.uid]:{ name, pin } } }); }
    catch(e){ if(isDenied(e) && i === 0){ TP.warned = false; writeErr(e); return false; } continue; }
    await DB.set('lobby/' + code, { title, at:DB.ts() }).catch(() => {});
    ls.set('host', { code, pin, title });
    typistEnter(code, true, pin);
    return true;
  }
  toast('방 번호를 만들지 못했어요. 다시 눌러 주세요');
  return false;
}
async function typistShift(code, pin, name){
  code = String(code || '').replace(/\D/g, ''); pin = String(pin || '').replace(/\D/g, '');
  if(code.length !== 4 || pin.length !== 4){ toast('방 번호와 교대 비밀번호 네 자리를 넣어 주세요'); return false; }
  try{
    const meta = await DB.get('rooms/' + code + '/meta');
    if(!meta){ toast('방 번호 ' + code + '인 방이 없어요'); return false; }
    if(DB.mode === 'demo'){ const s = await DB.get('rooms/' + code + '/secret'); if(!s || s.pin !== pin){ toast('교대 비밀번호가 맞지 않아요'); return false; } }
    await DB.set('rooms/' + code + '/typers/' + DB.uid, { name, pin });
  }catch(e){ toast(isDenied(e) ? '교대 비밀번호가 맞지 않아요' : '들어가지 못했어요. 인터넷 연결을 확인해 주세요'); return false; }
  typistEnter(code, false, null);
  return true;
}
// 새로고침·노트북 재시작 뒤 같은 방으로 돌아감
async function typistResume(t){
  try{
    const meta = await DB.get('rooms/' + t.code + '/meta');
    if(!meta){ ls.del('typing'); return false; }
    if(t.host){
      if(meta.host !== DB.uid){ ls.del('typing'); return false; }
      await DB.update('rooms/' + t.code + '/meta', { open:true, at:DB.ts() });
      await DB.set('lobby/' + t.code, { title:meta.title, at:DB.ts() }).catch(() => {});
      const h = ls.get('host');
      typistEnter(t.code, true, h && h.code === t.code ? h.pin : null);
    } else {
      const me = await DB.get('rooms/' + t.code + '/typers/' + DB.uid);
      if(!me){ ls.del('typing'); return false; }
      typistEnter(t.code, false, null);
    }
    return true;
  }catch(e){ return false; }
}

function typistEnter(code, host, pin){
  typistStop();
  Object.assign(TP, { lastKey:null, code, host, pin, meta:null, mode:null, doc:{}, keys:[], readers:{}, pendingEnter:false, warned:false, sent:[], dirty:false, again:false, composing:false, lastCur:'', longWarned:false });
  TP.rows.forEach(el => el.remove()); TP.rows.clear();
  ls.set('typing', { code, host });
  showView('vType');
  $('#tCode').textContent = code;
  $('#tIn').value = ''; $('#tPad').value = '';
  applyTypistLook();
  const b = tbase();
  let gotLines = false;
  TP.unsub.push(DB.on(b + 'meta', v => {
    TP.meta = v;
    if(TP.host && v && v.host !== DB.uid){ toast('다른 노트북이 이 방 번호를 가져갔어요'); typistLeave(false); return; }
    if(!v){ toast('방이 없어졌어요'); typistLeave(false); return; }
    $('#tTitle').textContent = v.title || '';
    if(TP.host && !TP.pin) DB.get(b + 'secret').then(s => { if(s && s.pin){ TP.pin = s.pin; const h = ls.get('host'); if(h && h.code === code){ h.pin = s.pin; ls.set('host', h); } } }).catch(() => {});
  }));
  TP.unsub.push(DB.on(b + 'lines', v => {
    TP.doc = v || {}; TP.keys = Object.keys(TP.doc).sort();
    renderLog();
    if(TP.mode === 'live') syncPad(!gotLines);
    gotLines = true;
  }, writeErr));
  TP.unsub.push(DB.on(b + 'mode', v => setMode(v === 'live' ? 'live' : 'line')));
  TP.unsub.push(DB.on(b + 'readers', v => { TP.readers = v || {}; $('#tReaders').innerHTML = '<span class="wide">접속 중인 </span>읽기 화면 ' + Object.keys(TP.readers).length + '대'; }));
  DB.discRemove(b + 'cursors/' + DB.uid);
  const beat = () => {
    if(!TP.code || !TP.meta) return;
    DB.set('lobby/' + TP.code, { title:TP.meta.title || '문자통역', at:DB.ts() }).catch(() => {});
    if(TP.host) DB.update(tbase() + 'meta', { at:DB.ts() }).catch(() => {});
  };
  TP.hb = setInterval(beat, 60000);
  setTimeout(beat, 1500);
  WAKE.on();
}
function typistStop(){
  if(typeof sttStop === 'function' && STT.on) sttStop();
  TP.unsub.forEach(f => { try{ f(); }catch(e){} }); TP.unsub = [];
  if(TP.hb){ clearInterval(TP.hb); TP.hb = 0; }
  if(TP.flushT){ clearTimeout(TP.flushT); TP.flushT = 0; }
}
async function typistLeave(close){
  const code = TP.code, b = tbase(), host = TP.host;
  if(code && TP.mode === 'live' && TP.dirty) liveFlush();
  typistStop();
  if(code){
    DB.remove(b + 'cursors/' + DB.uid).catch(() => {});
    if(close && host){
      await DB.update(b + 'meta', { open:false, at:DB.ts() }).catch(() => {});
      await DB.remove('lobby/' + code).catch(() => {});
    }
  }
  TP.code = null;
  ls.del('typing'); WAKE.off();
  showStart();
}

/* ---------- 보내는 방식 ---------- */
function setMode(m){
  if(m === TP.mode) return;
  const first = TP.mode == null;
  if(TP.mode === 'live' && TP.dirty) liveFlush();
  TP.mode = m;
  $('#tLinePanel').hidden = m !== 'line';
  $('#tLivePanel').hidden = m !== 'live';
  paintModeBtns();
  if(m === 'live'){
    // 한 줄씩 칸에 치던 글이 있으면 메모장 끝에 이어 붙임
    const left = cleanLine($('#tIn').value).trim(); $('#tIn').value = '';
    syncPad(true);
    if(left){ const pad = $('#tPad'); pad.value += (pad.value ? '\n' : '') + left; TP.dirty = true; kickFlush(); }
    const pad = $('#tPad'); setTimeout(() => { pad.focus(); pad.setSelectionRange(pad.value.length, pad.value.length); pad.scrollTop = pad.scrollHeight; kickFlush(); }, 30);
  } else {
    TP.lastCur = '';
    DB.remove(tbase() + 'cursors/' + DB.uid).catch(() => {});
    renderLog(true);
    setTimeout(() => $('#tIn').focus(), 30);
  }
  if(!first) toast(m === 'line' ? '한 줄씩: Enter를 누르면 한 줄이 보내집니다' : modeToast());
}

const modeKey = () => TP.mode === 'line' ? 'line' : TS.minutes ? 'minutes' : 'memo';
const modeToast = () => TS.minutes ? '회의록: Alt+숫자로 화자 이름, Tab으로 직전 사람을 넣습니다' : '메모장: 치는 글자가 그대로 보입니다';
function paintModeBtns(){
  const k = modeKey();
  $$('[data-mode]').forEach(b => { const on = b.dataset.mode === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  const mins = k === 'minutes';
  $('#tLivePanel').classList.toggle('minutes', mins);
  $('#tSpk').hidden = !mins;
  $('#tPadHint').textContent = mins
    ? 'Alt+1~9: 화자 이름 · Tab: 직전 사람 · Shift+Tab: 지금 사람 한 번 더 · 저장하면 화자별로 줄을 나눈 회의록 파일'
    : '메모장처럼 치면 치는 글자가 그대로 보입니다 · Enter: 줄 바꾸기 · 앞부분을 고쳐도 바로 반영 · 읽는 분은 내 커서를 따라옵니다';
  if(mins) renderSpeakers();
}
function chooseMode(k){
  if(!TP.code) return;
  if(k === 'line'){ if(TP.mode !== 'line') DB.set(tbase() + 'mode', 'line').catch(writeErr); return; }
  const was = TS.minutes;
  TS.minutes = k === 'minutes'; saveTS();
  if(TP.mode === 'live'){ paintModeBtns(); if(was !== TS.minutes) toast(modeToast()); $('#tPad').focus(); }
  else DB.set(tbase() + 'mode', 'live').catch(writeErr);
  if(k === 'minutes' && isDefaultSpk()) setTimeout(speakerSheet, 200);
}

/* ---------- 회의록: 화자 이름 ---------- */
const SPK_RE = /^([^\s:\[][^:\n]{0,14}):\s/;
const reEsc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const spkNames = () => (TS.speakers || []).map(x => String(x || '').trim()).filter(Boolean);
const isDefaultSpk = () => spkNames().join(',') === DEFAULT_SPK.join(',');
function renderSpeakers(){
  const box = $('#tSpk');
  box.innerHTML = (TS.speakers || []).map((n, i) => String(n || '').trim() ? `<button class="btn sm spk" data-spk="${i}"><small>Alt+${i + 1}</small> ${esc(String(n).trim())}</button>` : '').join('')
    + '<button class="btn sm" data-spk-tab>직전 사람 <small>Tab</small></button><button class="btn sm ghost" data-spk-edit>이름 넣기·고치기</button>';
}
function speakerSheet(){
  const rows = Array.from({ length:9 }, (_, i) => `<label class="field"><span>Alt+${i + 1}</span><input type="text" data-sp="${i}" maxlength="15" value="${esc((TS.speakers || [])[i] || '')}"></label>`).join('');
  const box = openSheet(`<h2 tabindex="-1">화자 이름</h2>
    <p class="muted small">회의에 나오는 사람 이름을 넣어 두면 Alt+숫자로 "이름: "이 들어갑니다. 지금 줄에 글이 있으면 다음 줄로 넘어가서 넣습니다.<br>Tab은 지금 말하던 사람 직전의 사람을 넣어서, 두 사람이 주고받을 때 Tab만 누르면 번갈아 들어갑니다. Shift+Tab은 지금 사람을 한 번 더 넣습니다.</p>
    <div class="spkgrid">${rows}</div>
    <div class="row"><div class="sp"></div><button class="btn ghost" data-close>취소</button><button class="btn primary" data-ok>저장</button></div>`, e => {
      if(!e.target.closest('[data-ok]')) return;
      const v = $$('input[data-sp]', box).map(x => x.value.replace(/[:\n\r]/g, '').trim().slice(0, 15));
      while(v.length && !v[v.length - 1]) v.pop();
      TS.speakers = v; saveTS(); renderSpeakers(); closeSheet();
      setTimeout(() => $('#tPad').focus(), 30);
    }, 'input[data-sp]');
}
// 커서 위쪽에서 최근에 말한 두 사람 [지금 사람, 직전 사람]
function labelsIn(line, known){
  const found = [];
  const m = line.match(SPK_RE); if(m) found.push({ i:0, n:m[1].trim() });
  if(known.length){
    const re = new RegExp('\\s(' + known.map(reEsc).join('|') + '):\\s', 'g'); let x;
    while((x = re.exec(line))) found.push({ i:x.index + 1, n:x[1] });
  }
  return found.sort((a, b) => a.i - b.i).map(f => f.n);
}
function recentSpeakers(){
  const pad = $('#tPad'), v = pad.value, pos = pad.selectionStart;
  let end = v.indexOf('\n', pos); if(end < 0) end = v.length;
  const lines = v.slice(0, end).split('\n'), known = spkNames(), out = [];
  for(let i = lines.length - 1; i >= 0 && i >= lines.length - 400 && out.length < 2; i--){
    const ls2 = labelsIn(lines[i], known);
    for(let j = ls2.length - 1; j >= 0 && out.length < 2; j--) if(!out.includes(ls2[j])) out.push(ls2[j]);
  }
  return out;
}
function insertSpeaker(name){
  if(!name){ toast('먼저 화자 이름을 넣어 주세요'); speakerSheet(); return; }
  const pad = $('#tPad'); pad.focus();
  const v = pad.value, s = pad.selectionStart, e = pad.selectionEnd;
  const ls2 = v.lastIndexOf('\n', s - 1) + 1; let le = v.indexOf('\n', s); if(le < 0) le = v.length;
  const line = v.slice(ls2, le), label = name + ': ';
  const m = line.match(SPK_RE);
  // 빈 줄이나 이름만 있는 줄이면 그 줄을 이 이름으로, 글이 있으면 다음 줄에 새로 넣음
  if(!line.trim() || (m && !line.slice(m[0].length).trim())) pad.setRangeText(label, ls2, le, 'end');
  else pad.setRangeText((v.slice(ls2, s).trim() ? '\n' : '') + label, s, e, 'end');
  TP.dirty = true; kickFlush();
}
function speakerSwap(){ const [cur, prev] = recentSpeakers(); insertSpeaker(prev || spkNames().find(n => n !== cur) || cur); }
function speakerAgain(){ const [cur] = recentSpeakers(); insertSpeaker(cur || spkNames()[0]); }
// 저장용: 한 줄에 여러 사람이 섞여 있으면 사람마다 줄을 나누고, 말하는 사람이 바뀌면 빈 줄을 넣음
function minutesText(lines){
  const known = new Set(spkNames());
  lines.forEach(l => { const m = l.match(SPK_RE); if(m) known.add(m[1].trim()); });
  const names = [...known].filter(Boolean).sort((a, b) => b.length - a.length);
  const re = names.length ? new RegExp('\\s+(?=(?:' + names.map(reEsc).join('|') + '):\\s)', 'g') : null;
  const out = [];
  lines.forEach(l => (re ? l.replace(re, '\n') : l).split('\n').forEach(x => {
    const m = x.match(SPK_RE);
    if(m && known.has(m[1].trim()) && out.length && out[out.length - 1] !== '') out.push('');
    out.push(x.replace(/\s+$/, ''));
  }));
  return out.join('\n');
}

/* ---------- 한 줄씩 ---------- */
// 맨 끝에 한 줄 붙이기 (Enter·음성인식이 연달아 보내도 열쇠가 겹치지 않게 마지막으로 만든 열쇠도 봄)
function appendLine(t){
  t = cleanLine(t).trim().slice(0, MAX_LINE);
  if(!t || !TP.code) return;
  let last = TP.keys[TP.keys.length - 1] || null;
  if(TP.lastKey && (!last || TP.lastKey > last)) last = TP.lastKey;
  const k = lineKeyBetween(last, null);
  TP.lastKey = k;
  DB.set(tbase() + 'lines/' + k, t).catch(writeErr);
}
function commitLine(){
  const inp = $('#tIn');
  const t = inp.value;
  if(!cleanLine(t).trim() || !TP.code) return;
  inp.value = '';
  appendLine(t);
}
function insertPrefix(p){
  if(TP.mode === 'live'){
    const pad = $('#tPad');
    pad.focus();
    pad.setRangeText(p, pad.selectionStart, pad.selectionEnd, 'end');
    TP.dirty = true; kickFlush();
    return;
  }
  const inp = $('#tIn');
  const body = inp.value.replace(/^\s*\[[^\]]{1,8}\]\s*/, '');
  inp.value = p + body;
  inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
}

/* ---------- 바로바로 (메모장) ---------- */
// 서버 내용을 메모장에 반영 (치는 중이 아닐 때만. 교대 입력자가 고친 내용을 받아옴)
function syncPad(force){
  if(TP.mode !== 'live') return;
  if(!force && (TP.dirty || TP.flushT || TP.composing)) return;
  TP.sent = TP.keys.map(k => ({ id:k, t:lineText(TP.doc[k]) }));
  const nv = TP.sent.map(x => x.t).join('\n');
  const pad = $('#tPad');
  if(force){ pad.value = nv; pad.setSelectionRange(nv.length, nv.length); pad.scrollTop = pad.scrollHeight; }
  else spliceText(pad, nv);
}
function kickFlush(){
  if(TP.flushT){ TP.again = true; return; }
  liveFlush();
  TP.flushT = setTimeout(() => {
    TP.flushT = 0;
    if(TP.again){ TP.again = false; kickFlush(); }
    else if(!TP.dirty) syncPad(false);
  }, DRAFT_MS);
}
// 메모장과 마지막으로 보낸 줄을 비교해서 바뀐 줄만 보냄
function liveFlush(){
  if(!TP.code || TP.mode !== 'live') return;
  const pad = $('#tPad');
  const nl = pad.value.split('\n');
  const old = TP.sent;
  const m = Math.min(old.length, nl.length);
  let p = 0; while(p < m && old[p].t === nl[p]) p++;
  let s = 0; while(s < m - p && old[old.length - 1 - s].t === nl[nl.length - 1 - s]) s++;
  const oMid = old.slice(p, old.length - s), nMid = nl.slice(p, nl.length - s);
  const keep = Math.min(oMid.length, nMid.length);
  const upd = {}, mid = [];
  const clip = t => { if(t.length > MAX_LINE){ if(!TP.longWarned){ TP.longWarned = true; toast('한 줄이 너무 길어요. Enter로 줄을 바꿔 주세요'); } return t.slice(0, MAX_LINE); } return t; };
  for(let i = 0; i < keep; i++){ upd['lines/' + oMid[i].id] = clip(nMid[i]); mid.push({ id:oMid[i].id, t:nMid[i] }); }
  for(let i = keep; i < oMid.length; i++) upd['lines/' + oMid[i].id] = null;
  let prev = mid.length ? mid[mid.length - 1].id : p > 0 ? old[p - 1].id : null;
  const next = s > 0 ? old[old.length - s].id : null;
  for(let i = keep; i < nMid.length; i++){ const id = lineKeyBetween(prev, next); upd['lines/' + id] = clip(nMid[i]); mid.push({ id, t:nMid[i] }); prev = id; }
  TP.sent = old.slice(0, p).concat(mid, old.slice(old.length - s));
  TP.dirty = false;
  // 내 커서 위치 (읽는 분이 따라오는 곳)
  const pos = pad.selectionEnd, before = pad.value.slice(0, pos);
  const li = (before.match(/\n/g) || []).length, c = pos - (before.lastIndexOf('\n') + 1);
  const cur = TP.sent[li];
  if(cur){ const sig = cur.id + ':' + c; if(sig !== TP.lastCur){ TP.lastCur = sig; upd['cursors/' + DB.uid] = { k:cur.id, c, at:DB.ts() }; } }
  if(Object.keys(upd).length) DB.update(tbase(), upd).catch(writeErr);
  $('#tCount').textContent = TP.sent.length + '줄';
}

/* ---------- 보낸 줄 목록 (한 줄씩) ---------- */
function renderLog(force){
  $('#tCount').textContent = TP.keys.length + '줄';
  if(TP.mode !== 'line' && !force) return;
  const rowsBox = $('#tRows'), log = $('#tLog');
  const near = force || log.scrollHeight - log.scrollTop - log.clientHeight < 120;
  for(const [id, el] of TP.rows) if(TP.doc[id] == null){ el.remove(); TP.rows.delete(id); }
  let prev = null;
  TP.keys.forEach((id, i) => {
    let el = TP.rows.get(id);
    if(!el){ el = document.createElement('button'); el.type = 'button'; el.className = 'ln'; el.dataset.id = id; el.innerHTML = '<span class="tm"></span><span class="tx"></span>'; TP.rows.set(id, el); }
    const no = String(i + 1), t = lineText(TP.doc[id]);
    if(el.firstChild.textContent !== no) el.firstChild.textContent = no;
    if(el.lastChild.textContent !== t) el.lastChild.textContent = t;
    const ref = prev ? prev.nextSibling : rowsBox.firstChild;
    if(ref !== el) rowsBox.insertBefore(el, ref);
    prev = el;
  });
  $('#tEmpty').hidden = TP.keys.length > 0;
  if(near) log.scrollTop = log.scrollHeight;
}
function editLine(id){
  if(TP.doc[id] == null) return;
  const old = lineText(TP.doc[id]);
  const box = openSheet(`<h2 tabindex="-1">보낸 줄 고치기</h2>
    <p class="muted small">고친 내용은 읽는 화면의 같은 줄에 바로 바뀝니다.</p>
    <textarea id="eTx" rows="3">${esc(old)}</textarea>
    <div class="row"><button class="btn danger" data-del>이 줄 지우기</button><div class="sp"></div><button class="btn ghost" data-close>취소</button><button class="btn primary" data-ok>고치기</button></div>`, e => {
      if(e.target.closest('[data-ok]')) save();
      const d = e.target.closest('[data-del]');
      if(d && arm(d, 'del' + id, '한 번 더 누르면 지웁니다')){ DB.remove(tbase() + 'lines/' + id).catch(writeErr); closeSheet(); $('#tIn').focus(); }
    }, '#eTx');
  const ta = $('#eTx', box);
  const save = () => {
    const t = cleanLine(ta.value).trim().slice(0, MAX_LINE);
    if(!t){ toast('지우려면 \'이 줄 지우기\'를 누르세요'); return; }
    if(t !== old) DB.set(tbase() + 'lines/' + id, t).catch(writeErr);
    closeSheet(); $('#tIn').focus();
  };
  ta.addEventListener('keydown', e => { if(e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229){ e.preventDefault(); save(); } });
  setTimeout(() => { ta.setSelectionRange(ta.value.length, ta.value.length); }, 40);
}

/* ---------- 방 정보 · 설정 ---------- */
function readerLink(){ return 'https://' + APP_ADDR + '?r=' + TP.code; }
function typistInfo(){
  const link = readerLink();
  openSheet(`<h2 tabindex="-1">방 정보</h2>
    <p>방 이름: <b>${esc((TP.meta && TP.meta.title) || '')}</b></p>
    <p class="bigcode">방 번호 <b>${esc(TP.code)}</b></p>
    <p>읽는 분은 <b>${esc(APP_ADDR)}</b>에 들어가서 방을 고르거나 방 번호를 넣으면 됩니다. 아래 주소로 열면 방 번호 없이 바로 들어갑니다.</p>
    <p class="addr">${esc(link)}</p>
    <div class="row"><button class="btn" data-copy>주소 복사</button><button class="btn" data-open>읽는 화면 열어 보기</button></div>
    <details class="card"><summary><b>넷플릭스 자막을 이 방으로 보내기</b></summary>
      <p class="small">넷플릭스를 트는 PC 크롬에 템퍼몽키를 설치한 뒤 아래 주소를 열어 스크립트를 설치합니다. 넷플릭스에서 자막을 <b>한국어(CC)</b>로 켜고, 오른쪽 위 '문자통역 자막' 패널에 이 방 번호와 교대 비밀번호를 넣으면 자막이 바뀔 때마다 한 줄씩 들어옵니다. '화면에서 자막 숨기기'로 프로젝터에서는 자막을 감출 수 있습니다.</p>
      <p class="addr">https://${esc(APP_ADDR)}netflix-caption.user.js</p>
      <div class="row"><a class="btn" href="netflix-caption.user.js" target="_blank" rel="noopener">스크립트 설치하기</a></div>
    </details>
    ${TP.host ? `<p>교대 입력 비밀번호: <b class="pin">${esc(TP.pin || '불러오는 중')}</b> <small class="muted">다른 노트북에서 '교대 입력자로 들어가기'에 넣습니다.</small></p>` : '<p class="muted">교대 입력자로 들어와 있어요.</p>'}
    <div class="row"><div class="sp"></div><button class="btn primary" data-close>닫기</button></div>`, async e => {
      if(e.target.closest('[data-copy]')){ try{ await navigator.clipboard.writeText(link); toast('주소를 복사했어요'); }catch(err){ toast('복사하지 못했어요. 주소를 직접 적어 주세요'); } }
      if(e.target.closest('[data-open]')) window.open('./?r=' + TP.code + (DEMO ? '&demo=1' : ''), '_blank');
    });
}
function typistSave(){
  if(!TP.keys.length){ toast('아직 저장할 내용이 없어요'); return; }
  const lines = TP.keys.map(k => lineText(TP.doc[k]));
  const title = (TP.meta && TP.meta.title) || '문자통역';
  if(modeKey() === 'minutes'){
    downloadText('회의록_' + fileStamp() + '.txt', title + ' 회의록\n' + longDate() + '\n\n' + minutesText(lines) + '\n');
    toast('회의록을 저장했어요 (화자별로 줄을 나눔)');
  } else {
    downloadText('문자통역_' + fileStamp() + '.txt', lines.join('\n') + '\n');
    toast('내용을 저장했어요');
  }
}
function applyTypistLook(){ document.documentElement.style.setProperty('--tsize', TSIZES[Math.max(0, Math.min(TSIZES.length - 1, TS.size))] + 'px'); }
function typistSettings(){
  const box = openSheet(`<h2 tabindex="-1">설정</h2>
    <label class="field"><span>내 이름 (교대할 때 구분용)</span><input type="text" id="stName" maxlength="20" value="${esc(TS.name || '')}"></label>
    <div class="row"><span>글자 크기</span><button class="btn" data-sz="-1">작게</button><button class="btn" data-sz="1">크게</button></div>
    <fieldset class="fs"><legend>음성인식 결과 (한 줄씩 방식)</legend>
      <label class="chk srow"><input type="radio" name="sttTo" value="send" ${TS.sttTo !== 'input' ? 'checked' : ''}> 바로 보내기 <small class="muted">말 한 마디가 끝나면 한 줄로 바로</small></label>
      <label class="chk srow"><input type="radio" name="sttTo" value="input" ${TS.sttTo === 'input' ? 'checked' : ''}> 입력 칸에 넣기 <small class="muted">확인하고 고친 뒤 Enter로 보냄</small></label>
      <p class="muted small">메모장·회의록 방식에서는 메모장 맨 끝에 새 줄로 붙입니다.</p>
      <label class="chk srow"><input type="checkbox" id="stLive" ${TS.sttLive !== false ? 'checked' : ''}> 메모장·회의록: 인식 중인 말도 바로 써 넣기 <small class="muted">말하는 도중부터 읽는 분께 보이고, 확정되면 바로잡힘</small></label>
      ${STT_MOBILE ? '<p class="muted small">휴대폰·태블릿에서는 마이크를 음성인식만 쓰도록 소리 막대를 보여 주지 않습니다.</p>' : `<label class="chk srow"><input type="checkbox" id="stMeter" ${TS.sttMeter !== false ? 'checked' : ''}> 소리 막대 보기 <small class="muted">음성인식이 글을 받아 적지 못하면 꺼 보세요</small></label>`}
    </fieldset>
    ${pwaSettingsHtml()}
    <div class="row"><div class="sp"></div><button class="btn primary" data-close>닫기</button></div>`, e => {
      if(pwaSettingsBind(box, e)) return;
      const sz = e.target.closest('[data-sz]');
      if(sz){ TS.size = Math.max(0, Math.min(TSIZES.length - 1, TS.size + Number(sz.dataset.sz))); saveTS(); applyTypistLook(); }
    });
  pwaSettingsBind(box);
  $('#stLive', box).addEventListener('change', e => { TS.sttLive = e.target.checked; saveTS(); });
  if($('#stMeter', box)) $('#stMeter', box).addEventListener('change', e => { TS.sttMeter = e.target.checked; saveTS(); if(STT.on){ if(TS.sttMeter) sttMeterStart(); else sttMeterStop(); } });
  $$('input[name=sttTo]', box).forEach(r => r.addEventListener('change', () => { TS.sttTo = r.value; saveTS(); paintStt(); }));
  $('#stName', box).addEventListener('input', e => { TS.name = e.target.value.trim().slice(0, 20); saveTS(); });
}

function typistInit(){
  const inp = $('#tIn'), pad = $('#tPad');
  const altPrefix = e => {
    if(!e.altKey) return false;
    const n = PREFIX[e.key] ? e.key : /^Digit[123]$/.test(e.code) ? e.code.slice(5) : null;
    if(!n) return false;
    e.preventDefault(); insertPrefix(PREFIX[n]); return true;
  };
  inp.addEventListener('keydown', e => {
    if(e.key === 'Enter' || e.keyCode === 13){
      e.preventDefault();
      if(e.shiftKey) return;
      // 한글 조합 중에 누른 Enter: 조합이 끝난 뒤에 줄을 보냄 (크롬은 Enter가 두 번 오므로 두 번째에서 보내고, 남은 한 번은 빈 칸이라 무시됨)
      if(e.isComposing || e.keyCode === 229){ TP.pendingEnter = true; return; }
      commitLine(); return;
    }
    if(e.key === 'Escape' && $('#sheet').hidden){ e.preventDefault(); inp.value = ''; return; }
    if(altPrefix(e)) return;
    if(e.key === 'ArrowUp' && !inp.value && TP.keys.length){ e.preventDefault(); editLine(TP.keys[TP.keys.length - 1]); }
  });
  inp.addEventListener('compositionend', () => { if(TP.pendingEnter){ TP.pendingEnter = false; setTimeout(commitLine, 0); } });
  // 메모장: 고칠 때마다 바뀐 줄을 보내고, 커서만 움직여도 위치를 보냄
  pad.addEventListener('input', () => { TP.dirty = true; kickFlush(); });
  pad.addEventListener('keydown', e => {
    if(TP.mode === 'live' && TS.minutes){
      // 한글 조합 중에 누른 단축키는 조합이 끝난 뒤에 실행
      const run = f => { if(e.isComposing || e.keyCode === 229) TP.pendingIns = f; else f(); };
      if(e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey){ e.preventDefault(); run(e.shiftKey ? speakerAgain : speakerSwap); return; }
      const d = e.altKey && !e.ctrlKey && /^(Digit|Numpad)[1-9]$/.test(e.code) ? Number(e.code.slice(-1)) : 0;
      if(d){ e.preventDefault(); const n = String((TS.speakers || [])[d - 1] || '').trim(); if(n) run(() => insertSpeaker(n)); else toast('Alt+' + d + '에 넣은 이름이 없어요'); return; }
    }
    altPrefix(e);
  });
  pad.addEventListener('compositionstart', () => { TP.composing = true; });
  pad.addEventListener('compositionend', () => { TP.composing = false; TP.dirty = true; kickFlush(); if(TP.pendingIns){ const f = TP.pendingIns; TP.pendingIns = null; setTimeout(f, 0); } setTimeout(sttFlushQueue, 0); });
  ['keyup', 'mouseup'].forEach(t => pad.addEventListener(t, () => { if(TP.mode === 'live') kickFlush(); }));
  document.addEventListener('keydown', e => {
    if(e.key === 'F2' && TP.code && !$('#vType').hidden && $('#sheet').hidden){ e.preventDefault(); sttToggle(); }
  });
  $('#vType').addEventListener('click', e => {
    const ln = e.target.closest('.ln[data-id]'); if(ln){ editLine(ln.dataset.id); return; }
    const pre = e.target.closest('[data-pre]'); if(pre){ insertPrefix(PREFIX[pre.dataset.pre]); return; }
    const md = e.target.closest('[data-mode]'); if(md){ chooseMode(md.dataset.mode); return; }
    const sp = e.target.closest('[data-spk]'); if(sp){ insertSpeaker(String(TS.speakers[Number(sp.dataset.spk)] || '').trim()); return; }
    if(e.target.closest('[data-spk-tab]')){ speakerSwap(); return; }
    if(e.target.closest('[data-spk-edit]')){ speakerSheet(); return; }
    const b = e.target.closest('[data-t]'); if(!b) return;
    const a = b.dataset.t;
    if(a === 'info') typistInfo();
    else if(a === 'save') typistSave();
    else if(a === 'settings') typistSettings();
    else if(a === 'stt') sttToggle();
    else if(a === 'sttGuide') sttGuide(false);
    else if(a === 'close'){ if(arm(b, 'close', TP.host ? '한 번 더 누르면 방을 닫습니다' : '한 번 더 누르면 나갑니다')) typistLeave(true); }
  });
}
