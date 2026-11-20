'use strict';
/* ===================== 읽기 화면 (한소네·센스리더 노트북·태블릿) =====================
   읽는 모양 두 가지 (설정에서 고름)
   - 줄마다 따로(list, 기본): 줄 하나하나가 따로 된 항목. 위아래로 한 줄씩 옮기고, 목록을 벗어났다 돌아와도
     읽던 줄로 돌아옴. 맨 끝 줄(지금 치는 줄)에 있을 때만 새 줄로 따라가고, 앞줄을 읽는 동안에는 움직이지 않음
   - 한 칸에 모두(box): 편집 칸 하나에 줄이 쌓임. 두 가지 상태:
   - 따라가기: 새 글이 오면 바로 넣고 커서를 지금 치는 곳(한 줄씩: 맨 끝, 바로바로: 통역하는 분의 커서)으로 옮김
   - 멈춤: 읽는 분이 커서를 직접 움직이거나 Space를 누르면 멈춤. 새 글이 와도 칸을 전혀 건드리지 않음
     (점자 줄이 튕기지 않게). Enter를 누르면 모아 둔 새 글을 넣고 다시 따라가기 */
const RS = { size:3, theme:'dark', ro:false, view:'list', gran:'word', move:false, ann:false, ...ls.get('rd', {}) };
const GRAN = { word:'낱말마다 (띄어쓰기하거나 잠깐 멈추면)', sent:'문장이 끝나면 (점자 줄이 가장 덜 바뀜)', char:'글자마다 (치는 대로 바로)' };
const WORD_IDLE = 800, SENT_IDLE = 2500;
const saveRS = () => ls.set('rd', RS);
const SIZES = [18, 22, 26, 32, 40, 50, 62, 76];
const THEMES = { dark:'흰 글씨 · 검은 바탕', yellow:'노란 글씨 · 검은 바탕', light:'검은 글씨 · 흰 바탕' };
const MODE_NAME = { line:'한 줄씩 보내기', live:'바로바로 보내기' };
const RD = { tabEl:null, annDone:new Set(), annInit:false, lastEdit:0, holdT:0, liveEl:null, lastLine:null, code:null, meta:null, mode:'line', lines:{}, cursors:{}, text:'', follow:0, live:true, unsub:[], stopPres:null, renderT:0, wasConnected:true, gotLines:false, waiting:false, setting:false };

// 메모장 방식에서 지금 치고 있는 줄의 끝부분은 낱말·문장이 끝날 때까지 잠깐 기다렸다가 보여 줌 (점자 줄이 덜 깜빡이게)
function holdTail(t, c){
  if(RS.gran === 'char') return t;
  const idle = Date.now() - RD.lastEdit;
  let m;
  if(RS.gran === 'sent'){
    if(idle >= SENT_IDLE || /[.?!…。]["'”’)\]]*\s*$/.test(t)) return t;
    m = t.match(/^[\s\S]*[.?!…。]["'”’)\]]*\s*/);
  } else {
    if(idle >= WORD_IDLE || /[\s.,?!…。]$/.test(t)) return t;
    m = t.match(/^[\s\S]*[\s.,?!…。]/);
  }
  const v = m ? m[0] : '';
  // 통역하는 분 커서가 마지막 낱말(문장) 안에 있을 때만 기다림. 앞부분을 고치는 중이면 다 보여 줌
  // (글과 커서 위치가 따로 도착해도 깜빡이지 않게 커서가 조금 뒤처져 있어도 같은 낱말이면 기다림)
  return c >= v.length ? v : t;
}
// 긴 줄은 문장마다(너무 긴 문장은 40자 안쪽에서 띄어쓰기마다) 따로 된 항목으로
function sentences(t){
  if(!t.trim()) return [''];
  const out = [], re = /[^.?!…。]*(?:[.?!…。]+["'”’)\]]*|$)\s*/g; let m;
  while((m = re.exec(t)) && m[0]){
    let x = m[0];
    // 한소네 6 점자 칸(32칸)에서 한 항목을 짧게 읽고 넘어가도록 40자 안쪽에서 띄어쓰기마다 나눔
    while(x.length > 40){ let cut = x.lastIndexOf(' ', 40); if(cut < 12) cut = 40; out.push(x.slice(0, cut).trim()); x = x.slice(cut).replace(/^\s+/, ''); }
    if(x.trim()) out.push(x.trim());
  }
  return out.length ? out : [t];
}
// 지금 서버에 있는 내용과 따라갈 위치
function readerModel(){
  const keys = Object.keys(RD.lines).sort();
  const raw = keys.map(k => lineText(RD.lines[k]));
  let curIdx = keys.length - 1, curCol = curIdx >= 0 ? raw[curIdx].length : 0;
  if(RD.mode === 'live'){
    let best = null;
    Object.values(RD.cursors || {}).forEach(c => { if(c && typeof c.k === 'string' && RD.lines[c.k] != null && (!best || (c.at || 0) > (best.at || 0))) best = c; });
    if(best){ const i = keys.indexOf(best.k); if(i >= 0){ curIdx = i; curCol = Math.min(Number(best.c) || 0, raw[i].length); } }
  }
  const texts = raw.slice();
  if(RD.mode === 'live' && curIdx >= 0){
    const v = holdTail(raw[curIdx], curCol);
    if(v !== raw[curIdx]){
      texts[curIdx] = v; curCol = v.length;
      // 마지막으로 글이 바뀐 때부터 기다린 시간을 재서, 다 기다리면 다시 그림
      clearTimeout(RD.holdT);
      RD.holdT = setTimeout(() => { RD.holdT = 0; scheduleRender(); }, Math.max(30, (RS.gran === 'sent' ? SENT_IDLE : WORD_IDLE) - (Date.now() - RD.lastEdit) + 30));
    }
  }
  let pos = 0;
  for(let i = 0; i < curIdx; i++) pos += texts[i].length + 1;
  pos = curIdx >= 0 ? pos + curCol : 0;
  const items = []; let curItem = -1;
  texts.forEach((t, i) => {
    let off = 0;
    sentences(t).forEach((ch, j) => {
      const at = ch ? t.indexOf(ch, off) : off; const st = at < 0 ? off : at; off = st + ch.length;
      items.push({ k:keys[i] + '.' + j, t:ch });
      if(i === curIdx && curItem < 0 && curCol <= off) curItem = items.length - 1;
    });
    if(i === curIdx && curItem < 0) curItem = items.length - 1;
  });
  return { keys, texts, text:texts.join('\n'), full:raw.join('\n'), pos, curIdx, items, curItem };
}
function setCaret(ta, pos){
  RD.setting = true;
  ta.setSelectionRange(pos, pos);
  if(pos >= ta.value.length) ta.scrollTop = ta.scrollHeight;
  setTimeout(() => { RD.setting = false; }, 0);
}
/* 줄마다 따로 보기 */
const RL = new Map();   // 줄 열쇠 → 줄 항목
// 줄 하나에만 tabindex 를 둠 (가상 커서에는 평범한 문단으로 보이고, Tab으로 들어오면 읽던 줄로)
function focusLine(el){
  if(!el) return;
  if(RD.tabEl && RD.tabEl !== el) RD.tabEl.removeAttribute('tabindex');
  el.tabIndex = 0; RD.tabEl = el;
  el.focus({ preventScroll:true }); el.scrollIntoView({ block:'nearest' });
}
// 새로 다 친 줄을 알림으로 읽어 줌 (설정에서 켰을 때만. 읽던 자리는 그대로)
function announceNew(shown, liveK){
  if(!RD.gotLines) return;
  const done = x => RD.mode === 'line' || x.k !== liveK;
  if(!RD.annInit){ RD.annInit = true; shown.forEach(x => { if(done(x)) RD.annDone.add(x.k); }); return; }
  const fresh = shown.filter(x => done(x) && !RD.annDone.has(x.k));
  fresh.forEach(x => RD.annDone.add(x.k));
  if(RS.ann && fresh.length){ const a = $('#rAnn'); a.textContent = ''; setTimeout(() => { a.textContent = fresh.map(x => x.t).join(' '); }, 60); }
}
function renderList(md){
  const box = $('#rList'), act = document.activeElement;
  const onBox = act === box, onLive = !!RD.liveEl && act === RD.liveEl;
  const near = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  // 빈 줄은 목록에 넣지 않음 (가상 커서가 빈 줄에서 멈추지 않게)
  const shown = []; let liveK = null;
  md.items.forEach((it, i) => { if(it.t){ shown.push(it); if(i <= md.curItem) liveK = it.k; } });
  if(liveK == null && shown.length) liveK = shown[shown.length - 1].k;
  const keep = new Set(shown.map(x => x.k));
  let lostFocus = false;
  for(const [k, el] of RL) if(!keep.has(k)){ if(el === act) lostFocus = true; if(el === RD.tabEl) RD.tabEl = null; el.remove(); RL.delete(k); }
  let prev = null;
  shown.forEach(({ k, t }) => {
    let el = RL.get(k);
    if(!el){ el = document.createElement('p'); el.className = 'rl'; el.dataset.k = k; RL.set(k, el); }
    if(el.textContent !== t) el.textContent = t;
    const ref = prev ? prev.nextSibling : box.firstChild;
    if(ref !== el) box.insertBefore(el, ref);
    prev = el;
  });
  RD.text = md.text;
  const liveEl = liveK ? RL.get(liveK) || null : null;
  if(RD.liveEl && RD.liveEl !== liveEl) RD.liveEl.classList.remove('now');
  if(liveEl) liveEl.classList.add('now');
  announceNew(shown, liveK);
  // 초점을 옮기는 때: 처음 들어와 아직 아무 줄도 없을 때, 읽던 줄이 지워졌을 때,
  // "새 줄로 옮기기"를 켠 분이 맨 끝 줄에 있을 때만. 그 밖에는 읽던 자리를 절대 옮기지 않음 (가상 커서가 끌려가지 않게)
  if(liveEl && liveEl !== act && (onBox || lostFocus || (RS.move && RD.live && onLive))) focusLine(liveEl);
  else if(lostFocus) box.focus({ preventScroll:true });
  RD.liveEl = liveEl;
  if(RD.live && (onBox || onLive || near)){ if(liveEl) liveEl.scrollIntoView({ block:'nearest' }); else box.scrollTop = box.scrollHeight; }
}
function render(){
  const ta = $('#rText');
  const md = readerModel();
  if(RS.view === 'list') renderList(md);
  else if(RD.live){
    RD.setting = true;
    spliceText(ta, md.text);
    RD.text = md.text; RD.follow = md.pos;
    setCaret(ta, md.pos);
  }
  paintFollow(md); paintEmpty();
}
function scheduleRender(){
  if(RD.renderT) return;
  RD.renderT = setTimeout(() => { RD.renderT = 0; if(RD.code) render(); }, 20);   // 글과 커서 위치를 모아서 한 번에 그림
}
function paintFollow(md){
  const f = $('#rFollow'); if(!f) return;
  const pb = $('[data-r="pause"]'); if(pb) pb.textContent = RD.live ? '멈춤' : '다시 따라가기';
  if(RS.view === 'list' && !RS.move){
    f.textContent = '새 줄은 맨 아래에 붙고, 읽던 자리는 움직이지 않아요 · "지금 치는 곳으로": 맨 끝 줄로';
    f.classList.remove('back'); return;
  }
  if(RS.view === 'list'){
    const act = document.activeElement, onLine = act && act.classList && act.classList.contains('rl');
    let t, back = false;
    if(!RD.live){ t = '멈춤 · 새 줄이 와도 옮기지 않아요 · Enter: 지금 치는 곳으로'; back = true; }
    else if(act === RD.liveEl || act === $('#rList')) t = '● 맨 끝 줄 · 새 줄이 오면 따라갑니다';
    else if(onLine){ t = '앞줄을 읽는 중 · Enter: 지금 치는 곳으로'; back = true; }
    else t = '● 따라가기 켬 · 맨 끝 줄에 있으면 새 줄로 따라갑니다';
    f.textContent = t; f.classList.toggle('back', back); return;
  }
  if(RD.live){ f.textContent = '● 실시간으로 따라가는 중 · Space: 멈춤'; f.classList.remove('back'); return; }
  md = md || readerModel();
  f.textContent = '멈춤' + (md.text !== RD.text ? ' · 새 글이 있어요' : '') + ' · Enter: 지금 치는 곳으로';
  f.classList.add('back');
}
function paintEmpty(){ const e = $('#rEmpty'); if(e) e.hidden = !!RD.text || !RD.gotLines; }
function rSay(msg){ const s = $('#rState'); if(s) s.textContent = msg; }
function goLive(){
  if(UPDATE.ready){ location.reload(); return; }   // 새 판이 나와 있으면 Enter를 누를 때 바꿈
  RD.live = true;
  if(RS.view === 'list'){
    render();
    if(RD.liveEl) focusLine(RD.liveEl); else $('#rList').focus();
    paintFollow();
    return;
  }
  $('#rText').focus();
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
  const list = RS.view === 'list';
  ta.hidden = list; $('#rList').hidden = !list;
  const pb = $('[data-r="pause"]'); if(pb) pb.hidden = list && !RS.move;
  $('#rHelp').textContent = list
    ? (RS.move ? '위아래 방향키로 한 줄씩 읽습니다. 맨 끝 줄에 있으면 새 줄로 따라가고, 앞줄을 읽는 동안에는 움직이지 않습니다. Enter를 누르면 지금 치는 곳으로 갑니다.'
               : '통역 내용은 이 페이지의 맨 끝에 있습니다. 위아래 방향키로 한 줄씩 읽고, 마지막 줄에서 더 내려가지지 않으면 거기가 끝입니다. 새 줄이 오면 아래 방향키로 이어 읽으세요. 지금 치는 곳으로 버튼은 이 안내 바로 위에 있습니다.')
    : '통역 내용 칸에서 Enter를 누르면 지금 치는 곳으로 갑니다. 커서를 움직이거나 Space를 누르면 멈추고, 멈춘 동안에는 새 글이 와도 화면이 그대로 있습니다.';
}

async function readerJoin(code){
  code = String(code || '').replace(/\D/g, '');
  if(code.length !== 4){ startMsg('방 번호 네 자리를 넣어 주세요.'); return; }
  let meta = null;
  try{ meta = await DB.get('rooms/' + code + '/meta'); }
  catch(e){ startMsg(isDenied(e) ? '서버 규칙이 아직 게시되지 않았어요. 통역하는 분께 알려 주세요.' : '방을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'); return; }
  if(!meta){ startMsg('방 번호 ' + code + '인 방이 없어요. 번호를 다시 확인해 주세요.'); ls.del('lastRead'); return; }
  readerLeave(true);
  RL.forEach(el => el.remove()); RL.clear(); RD.tabEl = null; RD.annDone = new Set(); RD.annInit = false; $('#rAnn').textContent = '';
  Object.assign(RD, { liveEl:null, lastLine:null, code, meta, mode:'line', lines:{}, cursors:{}, text:'', follow:0, live:true, gotLines:false, waiting:false });
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
    RD.lastEdit = Date.now();
    if(!v && !RD.meta && RD.text) return;   // 방이 지워져도 읽던 내용은 남겨 둠
    const first = !RD.gotLines, had = Object.keys(RD.lines).length;
    RD.lines = v || {}; RD.gotLines = true; scheduleRender();
    const n = Object.keys(RD.lines).length;
    if(first){
      rSay(RD.meta && RD.meta.open === false ? '통역이 끝난 방이에요. 지금까지 ' + n + '줄을 읽을 수 있어요.' : n ? '지금까지 ' + n + '줄. ' + (RS.view === 'list' ? '맨 끝 줄에서 시작해요.' : '커서가 지금 치는 곳에 있어요.') : '통역 시작을 기다리는 중이에요.');
      RD.waiting = !n;
    } else if(!had && n && RD.waiting){ RD.waiting = false; rSay('통역이 시작됐어요.'); }
  }, e => { if(isDenied(e)) rSay('서버 규칙이 아직 게시되지 않았어요. 통역하는 분께 알려 주세요.'); }));
  RD.unsub.push(DB.on(base + 'cursors', v => { RD.lastEdit = Date.now(); RD.cursors = v || {}; if(RD.mode === 'live') scheduleRender(); }));
  RD.stopPres = DB.presence(base + 'readers/' + DB.uid, () => ({ at:DB.ts() }));
  WAKE.on();
  setTimeout(() => { if(RS.view === 'list'){ if(RD.liveEl) focusLine(RD.liveEl); else $('#rList').focus(); } else { ta.focus(); setCaret(ta, RD.follow); } }, 50);
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
  const t = readerModel().full;
  if(!t){ toast('아직 저장할 내용이 없어요'); return; }
  downloadText('문자통역_' + fileStamp() + '.txt', t + '\n');
  rSay('내용을 파일로 저장했어요.');
}
function readerSettings(){
  const sizeName = i => ['아주 작게', '작게', '조금 작게', '보통', '조금 크게', '크게', '아주 크게', '가장 크게'][i] || '';
  const box = openSheet(`<h2 tabindex="-1">읽기 설정</h2>
    <p class="muted small">지금 통역 방식: ${MODE_NAME[RD.mode]} (통역하는 분이 정합니다)</p>
    <fieldset class="fs"><legend>읽는 모양</legend>
      <label class="chk srow"><input type="radio" name="rView" value="list" ${RS.view === 'list' ? 'checked' : ''}> 줄마다 따로 <small class="muted">위아래로 한 줄씩 옮기고, 벗어났다 돌아와도 읽던 줄로 돌아옵니다</small></label>
      <label class="chk srow"><input type="radio" name="rView" value="box" ${RS.view !== 'list' ? 'checked' : ''}> 한 칸에 모두 <small class="muted">편집 칸 하나에서 커서로 읽습니다</small></label>
      <label class="chk srow"><input type="checkbox" id="rMove" ${RS.move ? 'checked' : ''}> 줄마다 따로: 맨 끝 줄에 있으면 새 줄로 초점 옮기기 <small class="muted">센스리더 가상 커서로 읽을 때는 끄세요 (읽던 자리가 끌려갈 수 있음)</small></label>
      <label class="chk srow"><input type="checkbox" id="rAnnChk" ${RS.ann ? 'checked' : ''}> 줄마다 따로: 새로 다 친 줄을 알림으로 읽어 주기 <small class="muted">읽던 자리는 그대로 두고 음성·점자 알림으로만</small></label>
    </fieldset>
    <fieldset class="fs"><legend>메모장·회의록 방식에서 치는 중인 글 보이기</legend>
      ${Object.entries(GRAN).map(([k, v]) => `<label class="chk srow"><input type="radio" name="rGran" value="${k}" ${RS.gran === k ? 'checked' : ''}> ${v}</label>`).join('')}
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
  $$('input[name=rGran]', box).forEach(r => r.addEventListener('change', () => { RS.gran = r.value; saveRS(); scheduleRender(); }));
  $('#rMove', box).addEventListener('change', e => { RS.move = e.target.checked; saveRS(); applyReaderLook(); paintFollow(); });
  $('#rAnnChk', box).addEventListener('change', e => { RS.ann = e.target.checked; saveRS(); });
  $$('input[name=rView]', box).forEach(r => r.addEventListener('change', () => { RS.view = r.value; saveRS(); applyReaderLook(); RD.live = true; render(); paintFollow(); }));
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
  const check = () => { if(RS.view === 'box' && RD.live && !RD.setting && document.activeElement === ta && (ta.selectionStart !== RD.follow || ta.selectionEnd !== RD.follow)) pause(false); };
  document.addEventListener('selectionchange', check);
  ['keyup', 'mouseup', 'touchend'].forEach(t => ta.addEventListener(t, () => setTimeout(check, 0)));
  // 줄마다 따로: 방향키로 줄 옮기기(목록 끝에서 벗어나지 않음), 목록에 다시 들어오면 읽던 줄로
  const list = $('#rList');
  list.addEventListener('keydown', e => {
    if(e.ctrlKey && e.key === 'End'){ e.preventDefault(); goLive(); return; }
    if(e.altKey || e.ctrlKey || e.metaKey) return;
    if(e.key === 'Enter'){ e.preventDefault(); goLive(); return; }
    if(e.key === ' ' || e.code === 'Space'){ e.preventDefault(); if(RD.live) pause(true); else goLive(); return; }
    const cur = e.target.closest('.rl');
    if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      e.preventDefault();
      const to = cur ? (e.key === 'ArrowDown' ? cur.nextElementSibling : cur.previousElementSibling) : (RD.liveEl || list.lastElementChild);
      if(to) focusLine(to);
    }
    if(e.key === 'Home' || e.key === 'End'){ e.preventDefault(); focusLine(e.key === 'Home' ? list.firstElementChild : list.lastElementChild); }
  });
  list.addEventListener('focusin', e => {
    const ln = e.target.closest('.rl');
    if(ln){ RD.lastLine = ln.dataset.k; if(RD.tabEl !== ln){ if(RD.tabEl) RD.tabEl.removeAttribute('tabindex'); ln.tabIndex = 0; RD.tabEl = ln; } paintFollow(); return; }
    paintFollow();
  });
  list.addEventListener('click', e => { const ln = e.target.closest('.rl'); if(ln) focusLine(ln); });
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
