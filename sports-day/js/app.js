'use strict';
/* ===================== 화면 그리기 ===================== */
function syncPill(){
  const p = Object.values(D.pending).reduce((s,v) => s+(v||0), 0);
  if(store?.mode==='demo') return `<span class="pill demo">연습 모드</span>`;
  if(!online()) return `<span class="pill off">오프라인${p?` · 대기 ${p}`:''}</span>`;
  if(p) return `<span class="pill wait">올리는 중 ${p}</span>`;
  return `<span class="pill">저장됨</span>`;
}
function header(r){
  return `<header class="top"><span class="rolechip ${r.role}">${ROLE_INFO[r.role].icon} ${esc(roleLabel(r))}</span>
    <span class="me grow">${esc(UI.me)}</span>${syncPill()}${fsButton()}<button class="hbtn" data-a="menu" aria-label="메뉴">${ICON.menu}</button></header>`;
}
function fixEv(list){ if(!list.includes(UI.ev)) UI.ev = list[0]; }

function render(){
  const app = $('#app');
  if(D.fatal){ app.innerHTML = fatalView(); return; }
  if(!store){ app.innerHTML = '<div class="gate"><h1>불러오는 중…</h1></div>'; return; }
  if(!UI.me){ app.innerHTML = gateView(); return; }
  const ae = document.activeElement, keep = ae && ae.id ? { id:ae.id, s:ae.selectionStart, e:ae.selectionEnd } : null;
  const r = myRole();
  let tabs = '', body = '', nav = '', shell = 'shell', head = header(r), corner = '';
  if(r.role==='master'){
    if(UI.mtab==='game'){ const list = Object.keys(EVENTS); fixEv(list); tabs = eventTabs(list); body = masterGame(); }
    else if(UI.mtab==='board') body = boardControl() + `<div class="row" style="margin-bottom:14px"><button class="btn primary wide" data-a="boardPreview">📺 안내판 화면 미리 보기 (소리 없이)</button></div>` + boardView();
    else if(UI.mtab==='people') body = peopleView();
    else body = settingsView();
    nav = `<nav class="bottom">${[['game','🏁','경기 진행'],['board','📊','현황판'],['people','👥','접속자·역할'],['settings','⚙️','명단·설정']]
      .map(([k,i,l]) => `<button class="${UI.mtab===k?'on':''}" data-a="mtab" data-v="${k}"><b>${i}</b>${l}</button>`).join('')}</nav>`;
  } else if(r.role==='referee'){
    const list = refEvents(r);
    if(!list.length) body = waitView('맡은 종목이 아직 없습니다', '마스터에게 맡을 종목을 정해 달라고 알려 주세요.');
    else { fixEv(list); tabs = eventTabs(list); body = eventView(UI.ev); }
  } else if(r.role==='coach'){
    fixEv(ORDER_EVENTS); tabs = eventTabs(ORDER_EVENTS); body = coachView(r.team);
  } else if(r.role==='board'){
    shell = 'shell boardshell'; head = ''; body = boardScreen();
    corner = `<button class="cornerbtn" data-a="menu" aria-label="메뉴">${ICON.menu}</button>`;
  } else body = waitView();
  if(UI.preview && r.role==='master'){
    shell = 'shell boardshell'; head = ''; tabs = ''; nav = ''; body = boardScreen();
    corner = `<button class="btn primary previewexit" data-a="boardPreview">미리 보기 끝내기</button>`;
  }
  const err = D.error ? `<div class="note">${esc(D.error)}</div>` : '';
  app.innerHTML = `<div class="${shell}"><div class="stick">${head}${tabs}</div><main>${r.role==='wait'?installBanner():''}${err}${body}</main>${nav}${corner}</div>`;
  if(keep){ const el = document.getElementById(keep.id); if(el){ el.focus(); try{ el.setSelectionRange(keep.s, keep.e); }catch(e){} } }
  drawSheet();
  paintWatch();
}
function masterGame(){
  const ev = UI.ev;
  if(!ORDER_EVENTS.includes(ev)) return eventView(ev);
  const s = UI.sub[ev] || 'play';
  return `<div class="row" style="margin-bottom:12px"><div class="seg"><button class="${s==='play'?'on':''}" data-a="sub" data-v="play">🚩 경기 진행</button><button class="${s==='order'?'on':''}" data-a="sub" data-v="order">📋 출전 순서</button></div></div>`
    + (s==='order' ? orderBoth(ev) : eventView(ev));
}

function gateView(){
  return `<div class="gate">
    ${installBanner()}
    <div class="logo">🏅</div>
    <h1>가을운동회 점수판</h1>
    <p class="sub">이름을 적고 들어오면 마스터가 역할(감독·심판·안내판)을 정해 줍니다. 기록마다 이 이름이 함께 남습니다.</p>
    ${DEMO?`<div class="note">연습 모드입니다. 이 브라우저에만 저장됩니다. 마스터 비밀번호는 ${DEMO_MASTER_PW}입니다.</div>`:''}
    <div class="card">
      <input id="meInput" placeholder="이름 (예: 박진해)" autocomplete="off">
      <div style="height:12px"></div>
      <button class="btn primary wide" data-a="setMe">들어가기</button>
    </div>
    ${isStandalone()?'':'<button class="btn wide" data-a="install">홈 화면에 설치하기</button>'}
  </div>`;
}
function waitView(title='역할을 기다리는 중입니다', msg='마스터에게 아래 이름을 알려 주세요. 역할을 정해 주면 화면이 자동으로 바뀝니다.'){
  return `<div class="card waitbox"><div class="big">⏳</div><h2>${esc(title)}</h2>
    <div class="nm">${esc(UI.me)}</div><p class="sub" style="font-size:18px">${esc(msg)}</p>
    <div class="row" style="justify-content:center;margin-top:16px">
      ${DEMO?'<button class="btn primary" data-a="demoRole">연습: 역할 직접 고르기</button>':''}
      <button class="btn" data-a="masterLogin">👑 마스터로 들어가기</button><button class="btn" data-a="rename">이름 바꾸기</button></div></div>
    ${boardView()}`;
}
function fatalView(){
  return `<div class="fatal"><div class="card"><h2>⚠ ${esc(D.fatal.title)}</h2><p>${esc(D.fatal.msg)}</p>${D.fatal.steps||''}
    <div class="row" style="margin-top:14px"><button class="btn primary" data-a="reload">다시 시도</button><a class="btn" href="?demo=1">연습 모드로 열기</a></div></div></div>`;
}
function menuSheet(){
  const r = myRole();
  return `<h2>메뉴</h2>
    <p>이 기기: <b>${esc(UI.me)}</b> · ${ROLE_INFO[r.role].icon} ${esc(roleLabel(r))}</p>
    <div class="list menu">
      <div class="item tap" data-a="rename"><span class="name">✏️ 이름 바꾸기</span></div>
      ${r.role==='master' ? '<div class="item tap" data-a="masterLogout"><span class="name">👑 마스터에서 나가기<span class="sub">이 기기의 마스터 권한을 뺍니다.</span></span></div>'
        : '<div class="item tap" data-a="masterLogin"><span class="name">👑 마스터로 들어가기<span class="sub">마스터 비밀번호가 필요합니다.</span></span></div>'}
      ${DEMO ? '<div class="item tap" data-a="demoRole"><span class="name">🧪 연습: 역할 직접 고르기</span></div><div class="item tap" data-a="demoReset"><span class="name">🗑 연습 기록 모두 지우기</span></div>' : ''}
      ${FS.supported() ? `<div class="item"><span class="name">자동 전체화면<span class="sub">화면을 처음 누르면 주소창 없이 전체화면으로 바꿉니다.</span></span><label class="switch"><input type="checkbox" data-ch="autofs" ${UIX.autoFS?'checked':''}><span></span></label></div>
        <div class="item tap" data-a="fs"><span class="name">${FS.on()?'↙ 전체화면 끝내기':'↗ 전체화면 켜기'}</span></div>` : ''}
      ${isStandalone() ? '' : '<div class="item tap" data-a="install"><span class="name">📲 홈 화면에 설치하기</span></div>'}
    </div>
    <p class="sub">저장 방식: ${store?.mode==='demo' ? '연습 모드(이 브라우저에만 저장)' : '파이어베이스(모든 기기 공유)'}. 인터넷이 끊겨도 입력은 계속할 수 있고, 다시 연결되면 자동으로 올라갑니다. 점수를 입력하는 동안에는 화면이 꺼지지 않게 해 둡니다.</p>
    <button class="btn primary wide" data-a="closeSheet">닫기</button>`;
}

/* ===================== 공통 동작 ===================== */
async function masterLogin(){
  const pw = await dialog({ msg:'마스터 비밀번호를 입력해 주세요.', input:'', type:'password', ok:'들어가기' });
  if(!pw) return;
  toast('비밀번호를 확인하는 중입니다…');
  try{
    await store.put(['main','masters',store.uid], { pw, name:UI.me, at:now() }, false);
    // 확인이 끝나면 저장된 비밀번호는 지움
    await store.put(['main','masters',store.uid], { name:UI.me, at:now() }, false);
    closeSheet(); toast('마스터로 들어왔습니다.');
  }catch(e){
    console.error(e);
    toast(e && e.code==='permission-denied' ? '비밀번호가 맞지 않습니다.' : '들어가지 못했습니다: '+(e.message||e));
  }
}
Object.assign(ACT, {
  setMe: () => { const n = $('#meInput').value.trim(); if(!n){ toast('이름을 적어 주세요.'); return false; } UI.me = n; idStore.set('udh5_me', n); touchDevice(); },
  rename: async () => { const n = await askText('이 기기를 쓰는 사람 이름', UI.me); if(n && n.trim()){ UI.me = n.trim(); idStore.set('udh5_me', UI.me); touchDevice(); } },
  ev: (el, v) => { UI.ev = v; UI.q = ''; ls.set('udh5_ev', v); window.scrollTo(0,0); },
  mtab: (el, v) => { UI.mtab = v; ls.set('udh5_mtab', v); window.scrollTo(0,0); },
  menu: () => { openSheet(menuSheet); return false; },
  closeSheet: () => { closeSheet(); return false; },
  masterLogin: async () => { await masterLogin(); },
  masterLogout: async () => { if(!(await ask('이 기기의 마스터 권한을 뺄까요?\n다시 들어오려면 비밀번호가 필요합니다.', '빼기', true))) return false;
    await guard(store.del(['main','masters',store.uid])); closeSheet(); },
  demoRole: () => { if(!DEMO) return false; closeSheet(); ACT.roleSheet(null, store.uid); return false; },
  demoReset: async () => { if(DEMO && await ask('연습 기록을 모두 지울까요?', '지우기', true)){ store.reset(); closeSheet(); } },
  install: () => { installSheet(); return false; },
  fs: () => { FS.toggle(); return false; },
  later: () => { UIX.installDismissed = true; saveUIX(); toast('오른쪽 위 메뉴에서 언제든 설치할 수 있습니다.'); },
  reload: () => { location.reload(); return false; },
});

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]'); if(!el || el.disabled || el.closest('#dlg')) return;
  const fn = ACT[el.dataset.a]; if(!fn) return;
  const res = await fn(el, el.dataset.v, e);
  if(res !== false) render();
});
document.addEventListener('input', e => {
  const el = e.target, k = el.dataset.in; if(!k) return;
  if(k==='q'){ UI.q = el.value; const box = $('#pickRows'); if(box) box.innerHTML = pickRows(UI.ev, UI.round[UI.ev]||'main', can.record(UI.ev)); }
  else if(k==='roster') UI.rosterText = el.value;
  else if(k==='rt') (UI.runTimes[UI.ev] ||= {})[el.dataset.t] = el.value;
});
document.addEventListener('change', e => {
  const el = e.target;
  if(el.dataset.ch==='autofs'){ UIX.autoFS = el.checked; saveUIX(); }
});
document.addEventListener('keydown', e => { if(e.key==='Enter' && e.target.id==='meInput') ACT.setMe() !== false && render(); });
window.addEventListener('online', () => render()); window.addEventListener('offline', () => render());

/* ===================== 시작 ===================== */
let renderQueued = false, renderDeferred = false;
const typing = () => { const ae = document.activeElement; return !!ae && (ae.tagName==='TEXTAREA' || ae.tagName==='INPUT') && ae.type!=='checkbox'; };
function queueRender(){
  if(renderQueued) return; renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; if(typing() || DRAG.active || $('#dlg').classList.contains('open')){ renderDeferred = true; return; } render(); });
}
function flushDeferred(){ if(renderDeferred && !typing() && !DRAG.active){ renderDeferred = false; render(); } }
document.addEventListener('focusout', () => setTimeout(flushDeferred, 50));

function onErr(e){
  console.error(e);
  D.error = e && e.code==='permission-denied' ? '서버 규칙 때문에 데이터를 읽을 수 없습니다. 마스터가 Firestore 규칙을 확인해 주세요.' : '연결 오류: '+((e && e.message)||e);
  queueRender();
}
let masterUnsubs = [];
function masterSubs(){
  masterUnsubs.forEach(f => { try{ f && f(); }catch(e){} }); masterUnsubs = [];
  if(!D.amMaster){ D.devices = []; D.masters = {}; return; }
  masterUnsubs.push(store.onCol(['main','devices'], l => { D.devices = l; queueRender(); }, onErr));
  masterUnsubs.push(store.onCol(['main','masters'], l => { D.masters = Object.fromEntries(l.map(x => [x.id, x])); queueRender(); }, onErr));
}
function subscribe(){
  const col = k => (l, p) => { D[k] = l; D.pending[k] = p; D.loaded[k] = true; queueRender(); };
  const map = k => (l, p) => { D[k] = Object.fromEntries(l.map(x => [x.id, x])); D.pending[k] = p; D.loaded[k] = true; queueRender(); };
  store.onDoc(['config'], (d, p) => { D.config = d || {}; D.pending.config = p ? 1 : 0; D.loaded.config = true; queueRender(); }, onErr);
  store.onCol(['main','calls'], map('calls'), onErr);
  store.onCol(['main','indiv'], col('indiv'), onErr);
  store.onCol(['main','matches'], col('matches'), onErr);
  store.onCol(['main','orders'], map('orders'), onErr);
  store.onCol(['main','roles'], map('roles'), onErr);
  store.onDoc(['main','masters',store.uid], (d, p) => {
    const was = D.amMaster;
    // 서버가 비밀번호를 확인하기 전(대기 중)에는 마스터로 보지 않음
    D.amMaster = !!d && (!p || was);
    if(D.amMaster !== was) masterSubs();
    queueRender();
  }, onErr);
}
function authError(e){
  const code = e && e.code || '';
  if(code==='auth/operation-not-allowed' || code==='auth/admin-restricted-operation' || code==='auth/configuration-not-found')
    return { title:'파이어베이스 설정이 필요합니다', msg:'기기 확인용 익명 로그인이 꺼져 있습니다. 마스터가 파이어베이스 콘솔에서 아래처럼 켜 주세요.',
      steps:'<ol><li>console.firebase.google.com → <b>handscil-sports</b> 프로젝트를 엽니다.</li><li>왼쪽 메뉴 <b>빌드 → Authentication</b> → <b>시작하기</b>를 누릅니다.</li><li><b>로그인 방법</b> 탭에서 <b>익명</b>을 눌러 사용 설정을 켜고 저장합니다.</li><li>이 화면에서 <b>다시 시도</b>를 누릅니다.</li></ol>' };
  if(code==='auth/network-request-failed' || !online())
    return { title:'인터넷에 연결되지 않았습니다', msg:'처음 한 번은 인터넷이 연결된 상태에서 열어야 합니다. 연결을 확인한 뒤 다시 시도해 주세요.' };
  return { title:'파이어베이스에 연결하지 못했습니다', msg:(e && (e.message||e.code)) || String(e) };
}
(async () => {
  try { store = DEMO ? demoStore() : await firebaseStore(); }
  catch(e){ console.error(e); D.fatal = authError(e); render(); window.addEventListener('online', () => location.reload(), { once:true }); return; }
  subscribe();
  touchDevice();
  setInterval(() => { if(document.visibilityState==='visible') touchDevice(); }, 120000);
  setInterval(() => { if(D.amMaster && UI.mtab==='people') queueRender(); }, 60000);
  document.addEventListener('visibilitychange', () => { if(document.visibilityState==='visible') touchDevice(); });
  render();
})();
window.addEventListener('beforeunload', e => {
  const p = Object.values(D.pending).reduce((s,v) => s+(v||0), 0);
  if(p && !online()){ e.preventDefault(); e.returnValue = ''; }
});
