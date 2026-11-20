'use strict';
/* ===================== 읽기 화면 (한소네·센스리더 노트북·태블릿) =====================
   통역 내용 칸 하나에 다 친 줄이 한 줄씩 쌓이고, 맨 끝 줄은 지금 치는 글.
   - 커서가 맨 끝 줄에 있으면(따라가기) 새 글이 올 때 커서도 끝으로 감
   - 앞부분을 읽는 중이면 커서를 그대로 둠 (앞 줄이 고쳐져도 커서 위치를 지킴)
   - Enter(또는 Ctrl+End): 지금 치는 곳으로 */
const RS = { mode:'live', size:3, theme:'dark', ro:false, ...ls.get('rd', {}) };
const saveRS = () => ls.set('rd', RS);
const SIZES = [18, 22, 26, 32, 40, 50, 62, 76];
const THEMES = { dark:'흰 글씨 · 검은 바탕', yellow:'노란 글씨 · 검은 바탕', light:'검은 글씨 · 흰 바탕' };
const RD = { code:null, meta:null, lines:{}, drafts:{}, text:'', unsub:[], stopPres:null, renderT:0, wasConnected:true, gotLines:false };

const lastLineStart = v => v.lastIndexOf('\n') + 1;
const sortedVals = o => Object.keys(o || {}).sort().map(k => o[k]).filter(Boolean);

function readerText(){
  const out = sortedVals(RD.lines).map(l => String(l.t || ''));
  if(RS.mode === 'live') sortedVals(RD.drafts).forEach(d => { if(d.t) out.push(String(d.t)); });
  return out.join('\n');
}

// 바뀐 부분만 바꿔 넣어서 커서 위치를 지킴
function applyText(ta, nv){
  const ov = ta.value;
  if(ov === nv){ RD.text = nv; return; }
  const follow = !ov || ta.selectionStart >= lastLineStart(ov);
  const m = Math.min(ov.length, nv.length);
  let p = 0; while(p < m && ov.charCodeAt(p) === nv.charCodeAt(p)) p++;
  let q = 0; while(q < m - p && ov.charCodeAt(ov.length - 1 - q) === nv.charCodeAt(nv.length - 1 - q)) q++;
  RD.text = nv;
  // 바뀐 부분 안에 있던 커서는 그 안에서 같은 칸 수만큼 떨어진 곳에 둠 (고친 줄을 읽던 분이 줄 맨 앞으로 밀리지 않게)
  const oe = ov.length - q, ne = nv.length - q;
  const move = c => c <= p ? c : c >= oe ? c + nv.length - ov.length : p + Math.min(c - p, ne - p);
  const s = move(ta.selectionStart), en = move(ta.selectionEnd);
  try{ ta.setRangeText(nv.slice(p, ne), p, oe, 'preserve'); }
  catch(e){ ta.value = nv; }
  if(follow){ const L = nv.length; ta.setSelectionRange(L, L); ta.scrollTop = ta.scrollHeight; }
  else ta.setSelectionRange(s, en);
  paintFollow();
}
function scheduleRender(){
  if(RD.renderT) return;
  RD.renderT = setTimeout(() => { RD.renderT = 0; if(RD.code) applyText($('#rText'), readerText()); paintEmpty(); }, 0);
}
function isFollowing(){ const ta = $('#rText'); return !ta.value || ta.selectionStart >= lastLineStart(ta.value); }
function paintFollow(){
  const f = $('#rFollow'); if(!f) return;
  const on = isFollowing();
  f.textContent = on ? '● 실시간으로 따라가는 중' : '앞부분을 읽는 중 · Enter를 누르면 지금 치는 곳으로';
  f.classList.toggle('back', !on);
}
function paintEmpty(){
  const e = $('#rEmpty'); if(e) e.hidden = !!RD.text || !RD.gotLines;
}
function rSay(msg){ const s = $('#rState'); if(s) s.textContent = msg; }

function goLive(){
  const ta = $('#rText');
  ta.focus();
  const L = ta.value.length; ta.setSelectionRange(L, L); ta.scrollTop = ta.scrollHeight;
  paintFollow();
}

function applyReaderLook(){
  const ta = $('#rText');
  document.documentElement.style.setProperty('--rsize', SIZES[Math.max(0, Math.min(SIZES.length - 1, RS.size))] + 'px');
  $('#vRead').dataset.theme = RS.theme;
  if(RS.ro) ta.setAttribute('readonly', ''); else ta.removeAttribute('readonly');
}

async function readerJoin(code){
  code = String(code || '').replace(/\D/g, '');
  if(code.length !== 4){ startMsg('방 번호 네 자리를 넣어 주세요.'); return; }
  let meta = null;
  try{ meta = await DB.get('rooms/' + code + '/meta'); }
  catch(e){ startMsg(isDenied(e) ? '서버 규칙이 아직 게시되지 않았어요. 통역하는 분께 알려 주세요.' : '방을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'); return; }
  if(!meta){ startMsg('방 번호 ' + code + '인 방이 없어요. 번호를 다시 확인해 주세요.'); ls.del('lastRead'); return; }
  readerLeave(true);
  Object.assign(RD, { code, meta, lines:{}, drafts:{}, text:'', gotLines:false, waiting:false });
  ls.set('lastRead', { code, at:Date.now() });
  const ta = $('#rText'); ta.value = '';
  applyReaderLook();
  showView('vRead');
  paintRoomTitle();
  rSay('방 ' + code + '에 들어왔어요. 내용을 불러오는 중입니다.');
  const base = 'rooms/' + code + '/';
  RD.unsub.push(DB.on(base + 'meta', v => {
    const was = RD.meta; RD.meta = v;
    paintRoomTitle();
    if(!v){ rSay('방이 없어졌어요. 지금까지 내용은 계속 읽을 수 있어요.'); return; }
    if(was && was.open !== false && v.open === false) rSay('통역이 끝났어요. 지금까지 내용은 계속 읽을 수 있어요.');
    else if(was && was.open === false && v.open !== false) rSay('통역이 다시 시작됐어요.');
  }));
  RD.unsub.push(DB.on(base + 'lines', v => {
    if(!v && !RD.meta && RD.text) return;   // 방이 지워져도 읽던 내용은 남겨 둠
    const first = !RD.gotLines, had = Object.keys(RD.lines).length;
    RD.lines = v || {}; RD.gotLines = true; scheduleRender();
    if(!first && !had && Object.keys(RD.lines).length) started();
    if(first){ const n = Object.keys(RD.lines).length; rSay(RD.meta && RD.meta.open === false ? '통역이 끝난 방이에요. 지금까지 ' + n + '줄을 읽을 수 있어요.' : n ? '지금까지 ' + n + '줄이 있어요. 커서가 맨 끝에 있습니다.' : '통역 시작을 기다리는 중이에요.'); RD.waiting = !n; }
  }, e => { if(isDenied(e)) rSay('서버 규칙이 아직 게시되지 않았어요. 통역하는 분께 알려 주세요.'); }));
  RD.unsub.push(DB.on(base + 'drafts', v => { RD.drafts = v || {}; if(RS.mode === 'live') scheduleRender(); if(RD.gotLines && sortedVals(RD.drafts).some(d => d.t)) started(); }));
  RD.stopPres = DB.presence(base + 'readers/' + DB.uid, () => ({ at:DB.ts() }));
  WAKE.on();
  setTimeout(() => ta.focus(), 50);
}
function started(){ if(RD.waiting){ RD.waiting = false; rSay('통역이 시작됐어요.'); } }
function paintRoomTitle(){
  const m = RD.meta;
  const t = (m && m.title) || '문자통역';
  $('#rTitle').textContent = t + ' (방 ' + RD.code + (m && m.open === false ? ', 끝남' : '') + ')';
  document.title = t + ' · 실시간 문자통역';
}
function readerLeave(quiet){
  RD.unsub.forEach(f => { try{ f(); }catch(e){} }); RD.unsub = [];
  if(RD.stopPres){ RD.stopPres(); RD.stopPres = null; }
  if(RD.renderT){ clearTimeout(RD.renderT); RD.renderT = 0; }
  RD.code = null;
  if(!quiet){ ls.del('lastRead'); WAKE.off(); document.title = '실시간 문자통역'; showStart(); }
}
function readerNet(c){
  if(!RD.code) return;
  if(!c && RD.wasConnected) rSay('인터넷 연결이 끊겼어요. 다시 연결하는 중입니다. 지금까지 내용은 읽을 수 있어요.');
  if(c && !RD.wasConnected) rSay('다시 연결됐어요.');
  RD.wasConnected = c;
}
function readerSave(){
  const t = sortedVals(RD.lines).map(l => String(l.t || '')).join('\n');
  if(!t){ toast('아직 저장할 내용이 없어요'); return; }
  downloadText('문자통역_' + RD.code + '_' + ymd() + '.txt', t + '\n');
  rSay('내용을 파일로 저장했어요.');
}
function readerSettings(){
  const sizeName = i => ['아주 작게', '작게', '조금 작게', '보통', '조금 크게', '크게', '아주 크게', '가장 크게'][i] || '';
  const box = openSheet(`<h2 tabindex="-1">읽기 설정</h2>
    <fieldset class="fs"><legend>보기 방식</legend>
      <label class="chk srow"><input type="radio" name="rmode" value="live" ${RS.mode === 'live' ? 'checked' : ''}> 치는 대로 바로 보기</label>
      <label class="chk srow"><input type="radio" name="rmode" value="line" ${RS.mode === 'line' ? 'checked' : ''}> 한 줄을 다 친 뒤에 보기 <small class="muted">점자 줄이 덜 바뀝니다</small></label>
    </fieldset>
    <div class="row"><span>글자 크기: <b id="szName">${sizeName(RS.size)}</b></span><button class="btn" data-sz="-1">작게</button><button class="btn" data-sz="1">크게</button></div>
    <label class="field"><span>색</span><select id="rTheme">${Object.entries(THEMES).map(([k, v]) => `<option value="${k}" ${RS.theme === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="chk srow"><input type="checkbox" id="rRo" ${RS.ro ? 'checked' : ''}> 통역 내용 칸을 읽기 전용으로 <small class="muted">점자 단말기에서 커서 이동이 잘 안 되면 켜 보세요</small></label>
    <div class="row"><button class="btn" data-save>내용을 파일로 저장</button></div>
    ${pwaSettingsHtml()}
    <div class="row"><div class="sp"></div><button class="btn primary" data-close>닫기</button></div>`, e => {
      if(pwaSettingsBind(box, e)) return;
      const sz = e.target.closest('[data-sz]');
      if(sz){ RS.size = Math.max(0, Math.min(SIZES.length - 1, RS.size + Number(sz.dataset.sz))); saveRS(); applyReaderLook(); $('#szName').textContent = sizeName(RS.size); }
      if(e.target.closest('[data-save]')) readerSave();
    });
  pwaSettingsBind(box);
  $$('input[name=rmode]', box).forEach(r => r.addEventListener('change', () => { RS.mode = r.value; saveRS(); scheduleRender(); }));
  $('#rTheme', box).addEventListener('change', e => { RS.theme = e.target.value; saveRS(); applyReaderLook(); });
  $('#rRo', box).addEventListener('change', e => { RS.ro = e.target.checked; saveRS(); applyReaderLook(); });
}

function readerInit(){
  const ta = $('#rText');
  // 고칠 수 있는 칸처럼 두되(점자 단말기에서 커서 이동이 가장 편함) 글을 바꾸지는 못하게 막음
  ta.addEventListener('beforeinput', e => { if(!e.isComposing) e.preventDefault(); });
  const restore = () => { if(ta.value !== RD.text){ const c = Math.min(ta.selectionStart, RD.text.length); ta.value = RD.text; ta.setSelectionRange(c, c); } };
  ta.addEventListener('input', restore);
  ta.addEventListener('compositionend', () => setTimeout(restore, 0));
  ['paste', 'cut', 'drop'].forEach(t => ta.addEventListener(t, e => e.preventDefault()));
  ta.addEventListener('keydown', e => {
    if(e.key === 'Enter' && !e.altKey && !e.ctrlKey && !e.metaKey){ e.preventDefault(); goLive(); }
  });
  ['keyup', 'click', 'focus', 'select'].forEach(t => ta.addEventListener(t, paintFollow));
  document.addEventListener('selectionchange', () => { if(document.activeElement === ta) paintFollow(); });
  $('#vRead').addEventListener('click', e => {
    const b = e.target.closest('[data-r]'); if(!b) return;
    const a = b.dataset.r;
    if(a === 'live') goLive();
    else if(a === 'settings') readerSettings();
    else if(a === 'save') readerSave();
    else if(a === 'leave') readerLeave();
  });
  applyReaderLook();
}
