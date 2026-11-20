'use strict';
/* ===================== 입력 화면 (통역하는 분의 노트북) =====================
   치는 글은 DRAFT_MS 간격으로 drafts/<기기>에 보내고, Enter를 누르면 lines에 한 줄로 넣음.
   보낸 줄을 누르면 고치거나 지울 수 있고, 고친 내용은 읽는 화면의 같은 줄에 바로 반영됨 */
const TS = { size:2, name:'', ...ls.get('tp', {}) };
const saveTS = () => ls.set('tp', TS);
const TSIZES = [15, 17, 20, 24, 28, 34];
const PREFIX = { '1':'[해설] ', '2':'[소리] ', '3':'[음악] ' };
const TP = { code:null, host:false, pin:null, meta:null, lines:{}, drafts:{}, readers:{}, unsub:[], hb:0, sentDraft:'', draftT:0, dirty:false, pendingEnter:false, rows:new Map(), warned:false };
const tbase = () => 'rooms/' + TP.code + '/';
const cleanLine = t => String(t || '').replace(/\s*[\r\n]+\s*/g, ' ');

function rulesSheet(){
  openSheet(`<h2 tabindex="-1">서버 규칙을 먼저 게시해 주세요</h2>
    <p>문자통역 자료를 저장할 자리가 서버에 아직 열려 있지 않아요. 한 번만 하면 됩니다.</p>
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
        b.disabled = true; const ok = await typistCreate($('#nTitle', box).value); b.disabled = false;
        if(ok) closeSheet();
      }
      if(b.hasAttribute('data-shift')){
        const name = $('#sName', box).value.trim().slice(0, 20) || '교대 입력자';
        TS.name = name; saveTS();
        b.disabled = true; const ok = await typistShift($('#sCode', box).value, $('#sPin', box).value, name); b.disabled = false;
        if(ok) closeSheet();
      }
    }, h ? 'button[data-resume]' : '#nTitle');
}

async function typistCreate(title){
  title = String(title || '').trim().slice(0, 40) || '영화 문자통역';
  const name = TS.name || '입력자 1';
  for(let i = 0; i < 15; i++){
    const code = String(1000 + Math.floor(Math.random() * 9000));
    let meta;
    try{ meta = await DB.get('rooms/' + code + '/meta'); }
    catch(e){ writeErr(e); return false; }
    if(meta && DB.now() - (meta.at || 0) < ROOM_STALE_MS) continue;
    const pin = String(1000 + Math.floor(Math.random() * 9000));
    try{ await DB.set('rooms/' + code, { meta:{ host:DB.uid, title, at:DB.ts(), open:true }, secret:{ pin }, typers:{ [DB.uid]:{ name, pin } } }); }
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
  Object.assign(TP, { code, host, pin, meta:null, lines:{}, drafts:{}, readers:{}, sentDraft:'', pendingEnter:false, warned:false });
  TP.rows.forEach(el => el.remove()); TP.rows.clear();
  ls.set('typing', { code, host });
  showView('vType');
  $('#tCode').textContent = code;
  applyTypistLook();
  const b = tbase();
  TP.unsub.push(DB.on(b + 'meta', v => {
    TP.meta = v;
    if(TP.host && v && v.host !== DB.uid){ toast('다른 노트북이 이 방 번호를 가져갔어요'); typistLeave(false); return; }
    if(!v){ toast('방이 없어졌어요'); typistLeave(false); return; }
    $('#tTitle').textContent = v.title || '';
    if(TP.host && !TP.pin) DB.get(b + 'secret').then(s => { if(s && s.pin){ TP.pin = s.pin; const h = ls.get('host'); if(h && h.code === code){ h.pin = s.pin; ls.set('host', h); } } }).catch(() => {});
  }));
  TP.unsub.push(DB.on(b + 'lines', v => { TP.lines = v || {}; renderLog(); }, writeErr));
  TP.unsub.push(DB.on(b + 'drafts', v => { TP.drafts = v || {}; renderDrafts(); }));
  TP.unsub.push(DB.on(b + 'readers', v => { TP.readers = v || {}; const n = Object.keys(TP.readers).length; $('#tReaders').textContent = '읽는 기기 ' + n + '대'; }));
  DB.discRemove(b + 'drafts/' + DB.uid);
  const beat = () => {
    if(!TP.code || !TP.meta) return;
    DB.set('lobby/' + TP.code, { title:TP.meta.title || '문자통역', at:DB.ts() }).catch(() => {});
    if(TP.host) DB.update(tbase() + 'meta', { at:DB.ts() }).catch(() => {});
  };
  TP.hb = setInterval(beat, 60000);
  setTimeout(beat, 1500);
  WAKE.on();
  const inp = $('#tIn'); inp.value = ''; setTimeout(() => inp.focus(), 50);
}
function typistStop(){
  TP.unsub.forEach(f => { try{ f(); }catch(e){} }); TP.unsub = [];
  if(TP.hb){ clearInterval(TP.hb); TP.hb = 0; }
  if(TP.draftT){ clearTimeout(TP.draftT); TP.draftT = 0; }
}
async function typistLeave(close){
  const code = TP.code, b = tbase(), host = TP.host;
  typistStop();
  if(code){
    DB.remove(b + 'drafts/' + DB.uid).catch(() => {});
    if(close && host){
      await DB.update(b + 'meta', { open:false, at:DB.ts() }).catch(() => {});
      await DB.remove('lobby/' + code).catch(() => {});
    }
  }
  TP.code = null;
  ls.del('typing'); WAKE.off();
  showStart();
}

/* ---------- 치기 ---------- */
function draftNow(){
  if(!TP.code) return;
  const t = cleanLine($('#tIn').value);
  if(t === TP.sentDraft) return;
  TP.sentDraft = t;
  DB.set(tbase() + 'drafts/' + DB.uid, t.trim() ? { t, n:TS.name || '', at:DB.ts() } : null).catch(writeErr);
}
function draftKick(){
  if(TP.draftT){ TP.dirty = true; return; }
  draftNow();
  TP.draftT = setTimeout(() => { TP.draftT = 0; if(TP.dirty){ TP.dirty = false; draftKick(); } }, DRAFT_MS);
}
function commitLine(){
  const inp = $('#tIn');
  const t = cleanLine(inp.value).trim();
  if(!t || !TP.code) return;
  if(TP.draftT){ clearTimeout(TP.draftT); TP.draftT = 0; } TP.dirty = false;
  TP.sentDraft = '';
  inp.value = '';
  const k = DB.key(tbase() + 'lines');
  DB.update(tbase(), { ['lines/' + k]:{ t, at:DB.ts(), by:DB.uid }, ['drafts/' + DB.uid]:null }).catch(writeErr);
}
function setPrefix(p){
  const inp = $('#tIn');
  const body = inp.value.replace(/^\s*\[[^\]]{1,8}\]\s*/, '');
  inp.value = p + body;
  inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
  draftKick();
}

/* ---------- 보낸 줄 목록 ---------- */
function renderLog(){
  const rowsBox = $('#tRows'), log = $('#tLog');
  const near = log.scrollHeight - log.scrollTop - log.clientHeight < 120;
  const keys = Object.keys(TP.lines).sort();
  for(const [id, el] of TP.rows) if(!TP.lines[id]){ el.remove(); TP.rows.delete(id); }
  let prev = null;
  keys.forEach(id => {
    const l = TP.lines[id] || {};
    let el = TP.rows.get(id);
    if(!el){ el = document.createElement('button'); el.type = 'button'; el.className = 'ln'; el.dataset.id = id; el.innerHTML = '<span class="tm"></span><span class="tx"></span>'; TP.rows.set(id, el); }
    const tm = typeof l.at === 'number' ? hm(l.at) : '';
    if(el.firstChild.textContent !== tm) el.firstChild.textContent = tm;
    if(el.lastChild.textContent !== String(l.t || '')) el.lastChild.textContent = String(l.t || '');
    const ref = prev ? prev.nextSibling : rowsBox.firstChild;
    if(ref !== el) rowsBox.insertBefore(el, ref);
    prev = el;
  });
  $('#tEmpty').hidden = keys.length > 0;
  $('#tCount').textContent = keys.length + '줄';
  if(near) log.scrollTop = log.scrollHeight;
}
function renderDrafts(){
  const others = Object.entries(TP.drafts).filter(([u, d]) => u !== DB.uid && d && d.t);
  $('#tDrafts').innerHTML = others.map(([, d]) => `<div class="ln draft"><span class="tm">${esc(d.n || '다른 입력자')}</span><span class="tx">${esc(d.t)}</span></div>`).join('');
}
function editLine(id){
  const l = TP.lines[id]; if(!l) return;
  const box = openSheet(`<h2 tabindex="-1">보낸 줄 고치기</h2>
    <p class="muted small">고친 내용은 읽는 화면의 같은 줄에 바로 바뀝니다. 앞부분을 읽던 분의 커서는 그대로 있어요.</p>
    <textarea id="eTx" rows="3">${esc(l.t || '')}</textarea>
    <div class="row"><button class="btn danger" data-del>이 줄 지우기</button><div class="sp"></div><button class="btn ghost" data-close>취소</button><button class="btn primary" data-ok>고치기</button></div>`, e => {
      if(e.target.closest('[data-ok]')) save();
      const d = e.target.closest('[data-del]');
      if(d && arm(d, 'del' + id, '한 번 더 누르면 지웁니다')){ DB.remove(tbase() + 'lines/' + id).catch(writeErr); closeSheet(); $('#tIn').focus(); }
    }, '#eTx');
  const ta = $('#eTx', box);
  const save = () => {
    const t = cleanLine(ta.value).trim();
    if(!t){ toast('지우려면 \'이 줄 지우기\'를 누르세요'); return; }
    if(t !== l.t) DB.update(tbase() + 'lines/' + id, { t }).catch(writeErr);
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
    ${TP.host ? `<p>교대 입력 비밀번호: <b class="pin">${esc(TP.pin || '불러오는 중')}</b> <small class="muted">다른 노트북에서 '교대 입력자로 들어가기'에 넣습니다.</small></p>` : '<p class="muted">교대 입력자로 들어와 있어요.</p>'}
    <div class="row"><div class="sp"></div><button class="btn primary" data-close>닫기</button></div>`, async e => {
      if(e.target.closest('[data-copy]')){ try{ await navigator.clipboard.writeText(link); toast('주소를 복사했어요'); }catch(err){ toast('복사하지 못했어요. 주소를 직접 적어 주세요'); } }
      if(e.target.closest('[data-open]')) window.open('./?r=' + TP.code + (DEMO ? '&demo=1' : ''), '_blank');
    });
}
function typistSave(){
  const keys = Object.keys(TP.lines).sort();
  if(!keys.length){ toast('아직 저장할 내용이 없어요'); return; }
  downloadText('문자통역_' + TP.code + '_' + ymd() + '.txt', keys.map(k => String(TP.lines[k].t || '')).join('\n') + '\n');
}
function applyTypistLook(){ document.documentElement.style.setProperty('--tsize', TSIZES[Math.max(0, Math.min(TSIZES.length - 1, TS.size))] + 'px'); }
function typistSettings(){
  const box = openSheet(`<h2 tabindex="-1">설정</h2>
    <label class="field"><span>내 이름 (교대할 때 다른 입력자 화면에 보입니다)</span><input type="text" id="stName" maxlength="20" value="${esc(TS.name || '')}"></label>
    <div class="row"><span>글자 크기</span><button class="btn" data-sz="-1">작게</button><button class="btn" data-sz="1">크게</button></div>
    ${pwaSettingsHtml()}
    <div class="row"><div class="sp"></div><button class="btn primary" data-close>닫기</button></div>`, e => {
      if(pwaSettingsBind(box, e)) return;
      const sz = e.target.closest('[data-sz]');
      if(sz){ TS.size = Math.max(0, Math.min(TSIZES.length - 1, TS.size + Number(sz.dataset.sz))); saveTS(); applyTypistLook(); }
    });
  pwaSettingsBind(box);
  $('#stName', box).addEventListener('input', e => { TS.name = e.target.value.trim().slice(0, 20); saveTS(); });
}

function typistInit(){
  const inp = $('#tIn');
  inp.addEventListener('input', draftKick);
  inp.addEventListener('keydown', e => {
    if(e.key === 'Enter' || e.keyCode === 13){
      e.preventDefault();
      if(e.shiftKey) return;
      // 한글 조합 중에 누른 Enter: 조합이 끝난 뒤에 줄을 끝냄 (크롬은 Enter가 두 번 오므로 두 번째에서 끝나고, 남은 한 번은 빈 칸이라 무시됨)
      if(e.isComposing || e.keyCode === 229){ TP.pendingEnter = true; return; }
      commitLine(); return;
    }
    if(e.key === 'Escape' && $('#sheet').hidden){ e.preventDefault(); inp.value = ''; draftKick(); return; }
    if(e.altKey && PREFIX[e.key]){ e.preventDefault(); setPrefix(PREFIX[e.key]); return; }
    if(e.altKey && /^Digit[123]$/.test(e.code)){ e.preventDefault(); setPrefix(PREFIX[e.code.slice(5)]); return; }
    if(e.key === 'ArrowUp' && !inp.value){ const ks = Object.keys(TP.lines).sort(); if(ks.length){ e.preventDefault(); editLine(ks[ks.length - 1]); } }
  });
  inp.addEventListener('compositionend', () => { if(TP.pendingEnter){ TP.pendingEnter = false; setTimeout(commitLine, 0); } });
  $('#vType').addEventListener('click', e => {
    const ln = e.target.closest('.ln[data-id]'); if(ln){ editLine(ln.dataset.id); return; }
    const pre = e.target.closest('[data-pre]'); if(pre){ setPrefix(PREFIX[pre.dataset.pre]); return; }
    const b = e.target.closest('[data-t]'); if(!b) return;
    const a = b.dataset.t;
    if(a === 'info') typistInfo();
    else if(a === 'save') typistSave();
    else if(a === 'settings') typistSettings();
    else if(a === 'close'){ if(arm(b, 'close', TP.host ? '한 번 더 누르면 방을 닫습니다' : '한 번 더 누르면 나갑니다')) typistLeave(true); }
  });
}
