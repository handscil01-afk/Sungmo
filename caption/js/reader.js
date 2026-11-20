'use strict';
/* ===================== 읽기 화면 (한소네·센스리더 노트북·태블릿) =====================
   통역 내용 칸 하나에 줄이 쌓임. 두 가지 상태:
   - 따라가기: 새 글이 오면 바로 넣고 커서를 지금 치는 곳(한 줄씩: 맨 끝, 바로바로: 통역하는 분의 커서)으로 옮김
   - 멈춤: 읽는 분이 커서를 직접 움직이거나 Space를 누르면 멈춤. 새 글이 와도 칸을 전혀 건드리지 않음
     (점자 줄이 튕기지 않게). Enter를 누르면 모아 둔 새 글을 넣고 다시 따라가기 */
const RS = { size:3, theme:'dark', ro:false, ...ls.get('rd', {}) };
const saveRS = () => ls.set('rd', RS);
const SIZES = [18, 22, 26, 32, 40, 50, 62, 76];
const THEMES = { dark:'흰 글씨 · 검은 바탕', yellow:'노란 글씨 · 검은 바탕', light:'검은 글씨 · 흰 바탕' };
const MODE_NAME = { line:'한 줄씩 보내기', live:'바로바로 보내기' };
const RD = { code:null, meta:null, mode:'line', lines:{}, cursors:{}, text:'', follow:0, live:true, unsub:[], stopPres:null, renderT:0, wasConnected:true, gotLines:false, waiting:false, setting:false };

// 지금 서버에 있는 내용과 따라갈 위치
function readerModel(){
  const keys = Object.keys(RD.lines).sort();
  const texts = keys.map(k => lineText(RD.lines[k]));
  const text = texts.join('\n');
  let pos = text.length;
  if(RD.mode === 'live'){
    let best = null;
    Object.values(RD.cursors || {}).forEach(c => { if(c && typeof c.k === 'string' && RD.lines[c.k] != null && (!best || (c.at || 0) > (best.at || 0))) best = c; });
    if(best){
      let off = 0;
      for(let i = 0; i < keys.length; i++){
        if(keys[i] === best.k){ pos = off + Math.min(Number(best.c) || 0, texts[i].length); break; }
        off += texts[i].length + 1;
      }
    }
  }
  return { text, pos };
}
function setCaret(ta, pos){
  RD.setting = true;
  ta.setSelectionRange(pos, pos);
  if(pos >= ta.value.length) ta.scrollTop = ta.scrollHeight;
  setTimeout(() => { RD.setting = false; }, 0);
}
function render(){
  const ta = $('#rText');
  const md = readerModel();
  if(RD.live){
    RD.setting = true;
    spliceText(ta, md.text);
    RD.text = md.text; RD.follow = md.pos;
    setCaret(ta, md.pos);
  }
  paintFollow(md); paintEmpty();
}
function scheduleRender(){
  if(RD.renderT) return;
  RD.renderT = setTimeout(() => { RD.renderT = 0; if(RD.code) render(); }, 0);
}
function paintFollow(md){
  const f = $('#rFollow'); if(!f) return;
  const pb = $('[data-r="pause"]'); if(pb) pb.textContent = RD.live ? '멈춤' : '다시 따라가기';
  if(RD.live){ f.textContent = '● 실시간으로 따라가는 중 · Space: 멈춤'; f.classList.remove('back'); return; }
  md = md || readerModel();
  f.textContent = '멈춤' + (md.text !== RD.text ? ' · 새 글이 있어요' : '') + ' · Enter: 지금 치는 곳으로';
  f.classList.add('back');
}
function paintEmpty(){ const e = $('#rEmpty'); if(e) e.hidden = !!RD.text || !RD.gotLines; }
function rSay(msg){ const s = $('#rState'); if(s) s.textContent = msg; }
function goLive(){
  const ta = $('#rText');
  RD.live = true;
  ta.focus();
  render();
}
function pause(say){
  if(!RD.live) return;
  RD.live = false; paintFollow();
  if(say) rSay('멈췄어요. 새 글이 와도 화면은 그대로 있어요. Enter를 누르면 지금 치는 곳으로 갑니다.');
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
  Object.assign(RD, { code, meta, mode:'line', lines:{}, cursors:{}, text:'', follow:0, live:true, gotLines:false, waiting:false });
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
  RD.unsub.push(DB.on(base + 'mode', v => {
    const m = v === 'live' ? 'live' : 'line';
    if(m !== RD.mode && RD.gotLines) rSay('통역 방식이 ' + MODE_NAME[m] + '로 바뀌었어요.');
    RD.mode = m; scheduleRender();
  }));
  RD.unsub.push(DB.on(base + 'lines', v => {
    if(!v && !RD.meta && RD.text) return;   // 방이 지워져도 읽던 내용은 남겨 둠
    const first = !RD.gotLines, had = Object.keys(RD.lines).length;
    RD.lines = v || {}; RD.gotLines = true; scheduleRender();
    const n = Object.keys(RD.lines).length;
    if(first){
      rSay(RD.meta && RD.meta.open === false ? '통역이 끝난 방이에요. 지금까지 ' + n + '줄을 읽을 수 있어요.' : n ? '지금까지 ' + n + '줄이 있어요. 커서가 지금 치는 곳에 있습니다.' : '통역 시작을 기다리는 중이에요.');
      RD.waiting = !n;
    } else if(!had && n && RD.waiting){ RD.waiting = false; rSay('통역이 시작됐어요.'); }
  }, e => { if(isDenied(e)) rSay('서버 규칙이 아직 게시되지 않았어요. 통역하는 분께 알려 주세요.'); }));
  RD.unsub.push(DB.on(base + 'cursors', v => { RD.cursors = v || {}; if(RD.mode === 'live') scheduleRender(); }));
  RD.stopPres = DB.presence(base + 'readers/' + DB.uid, () => ({ at:DB.ts() }));
  WAKE.on();
  setTimeout(() => { ta.focus(); setCaret(ta, RD.follow); }, 50);
}
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
  const t = readerModel().text;
  if(!t){ toast('아직 저장할 내용이 없어요'); return; }
  downloadText('문자통역_' + RD.code + '_' + ymd() + '.txt', t + '\n');
  rSay('내용을 파일로 저장했어요.');
}
function readerSettings(){
  const sizeName = i => ['아주 작게', '작게', '조금 작게', '보통', '조금 크게', '크게', '아주 크게', '가장 크게'][i] || '';
  const box = openSheet(`<h2 tabindex="-1">읽기 설정</h2>
    <p class="muted small">지금 통역 방식: ${MODE_NAME[RD.mode]} (통역하는 분이 정합니다)</p>
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
    if(e.ctrlKey && e.key === 'End'){ e.preventDefault(); goLive(); return; }
    if(e.altKey || e.ctrlKey || e.metaKey) return;
    if(e.key === 'Enter'){ e.preventDefault(); goLive(); }
    else if(e.key === ' ' || e.code === 'Space'){ e.preventDefault(); if(RD.live) pause(true); else goLive(); }
  });
  // 읽는 분이 커서를 직접 움직이면 멈춤 (이 앱이 옮긴 커서는 제외)
  const check = () => { if(RD.live && !RD.setting && document.activeElement === ta && (ta.selectionStart !== RD.follow || ta.selectionEnd !== RD.follow)) pause(false); };
  document.addEventListener('selectionchange', check);
  ['keyup', 'mouseup', 'touchend'].forEach(t => ta.addEventListener(t, () => setTimeout(check, 0)));
  $('#vRead').addEventListener('click', e => {
    const b = e.target.closest('[data-r]'); if(!b) return;
    const a = b.dataset.r;
    if(a === 'live') goLive();
    else if(a === 'pause'){ if(RD.live) pause(true); else goLive(); }
    else if(a === 'settings') readerSettings();
    else if(a === 'save') readerSave();
    else if(a === 'leave') readerLeave();
  });
  applyReaderLook();
}
