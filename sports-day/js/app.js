'use strict';
/* ===================== 화면 그리기 ===================== */
function syncPill(){
  const p = Object.values(D.pending).reduce((s,v) => s+(v||0), 0);
  if(store?.mode==='demo') return `<span class="pill demo">연습</span>`;
  if(!online()) return `<span class="pill off">오프라인${p?` · 대기 ${p}`:''}</span>`;
  if(p) return `<span class="pill wait">올리는 중 ${p}</span>`;
  return `<span class="pill ok" title="저장됨">●</span>`;
}
// 머리줄: 이름 · (지금 화면 고르기 버튼) · 저장 상태 · 메뉴. 종목 탭 줄을 따로 두지 않아 화면을 넓게 씀
function header(r, picker=''){
  return `<header class="top"><button class="rolechip ${r.role}" data-a="menu" title="${esc(UI.me)}">${esc(roleIcon(r))}<span class="rcn"> ${esc(UI.me)}</span></button>${picker}
    <span class="grow"></span>${syncPill()}${fsButton()}${radioHeadBtn()}<button class="hbtn" data-a="menu" aria-label="메뉴">${ICON.menu}</button></header>`;
}
function pickerBtn(icon, label, color, open=true){
  return `<button class="evpick ${open?'':'still'}" style="--ev:${color}" ${open?'data-a="evSheet"':''}><span>${icon}</span><b>${esc(label)}</b>${open?'<i>▾</i>':''}</button>`;
}
function fixEv(list){ if(!list.includes(UI.ev)) UI.ev = list[0]; }
// 여러 역할을 가진 기기: 역할마다 하나씩 (감독 / 맡은 종목 / 계시)
function staffTabs(r){
  const t = [];
  if(r.monitor) t.push({ k:'mon', icon:'🧭', label:'진행 현황', color:'#0f172a' });
  if(r.coach) t.push({ k:'coach', icon:'📋', label:`${teamName(r.coach)} 감독`, color: r.coach==='blue' ? '#0044d1' : '#cf0a2c' });
  refEvents(r).forEach(ev => t.push({ k:'ev:'+ev, icon:EVENTS[ev].icon, label:EVENTS[ev].name + (r.events.includes(ev) ? '' : ' 기록'), color:EVENTS[ev].color, ev }));
  r.timers.forEach(ev => t.push({ k:'timer:'+ev, icon:'⏱', label:`${EVENTS[ev].name} 계시`, color:'#111827', ev }));
  return t;
}
function staffBody(r){
  if(UI.stab==='mon') return progressView();
  if(UI.stab==='coach'){
    if(!ORDER_EVENTS.length) return '<div class="card empty">순서를 정할 단체전 종목이 없습니다. 마스터가 종목을 켜면 여기에 나옵니다.</div>';
    if(!ORDER_EVENTS.includes(UI.coachEv)) UI.coachEv = ORDER_EVENTS[0];
    UI.ev = UI.coachEv;
    return coachView(r.coach);
  }
  const ev = UI.stab.split(':')[1]; UI.ev = ev;
  if(!EVENTS[ev]) return '<div class="card empty">이 종목은 지금 꺼져 있습니다.</div>';
  return UI.stab.startsWith('timer:') ? timerView(ev) : eventView(ev);
}
// 화면 고르기 창: 마스터는 모든 종목, 진행요원은 맡은 일
function evSheet(){
  const r = myRole();
  const btn = (k, icon, label, badge, color, on) => `<button class="evbtn ${on?'on':''}" style="--ev:${color}" data-a="evPick" data-v="${k}"><span class="ic">${icon}</span><b>${esc(label)}</b>${badge?`<small>${esc(badge)}</small>`:''}</button>`;
  let body;
  if(r.role==='master'){
    const grp = kind => Object.keys(EVENTS).filter(k => EVENTS[k].kind===kind).map(k => btn(k, EVENTS[k].icon, EVENTS[k].name, evBadge(k), EVENTS[k].color, k===UI.ev)).join('');
    const gi = grp('indiv'), gt = grp('team');
    body = `${gi ? `<h3 style="margin-top:0">개인전</h3><div class="evgrid">${gi}</div>` : ''}${gt ? `<h3${gi ? '' : ' style="margin-top:0"'}>단체전</h3><div class="evgrid">${gt}</div>` : ''}`;
  } else body = `<div class="evgrid">${staffTabs(r).map(t => btn(t.k, t.icon, t.label, t.ev ? evBadge(t.ev) : '', t.color, t.k===UI.stab)).join('')}</div>`;
  return `<h2>화면 고르기</h2>${body}<button class="btn wide" data-a="closeSheet" style="margin-top:14px">닫기</button>`;
}

function render(){
  const app = $('#app');
  if(D.fatal){ app.innerHTML = fatalView(); return; }
  if(!store){ app.innerHTML = '<div class="gate"><h1>불러오는 중…</h1></div>'; return; }
  if(!UI.me){ app.innerHTML = gateView(); setBodyMode(false); return; }
  if(UI.report && D.amMaster){ app.innerHTML = reportView(); setBodyMode(false); radioRender(); return; }
  const ae = document.activeElement, keep = ae && ae.id ? { id:ae.id, s:ae.selectionStart, e:ae.selectionEnd } : null;
  const r = myRole();
  // 중계 모드(보이스오버용 간단 화면): 센터장님 기기. 다른 화면과 달리 데이터가 바뀌어도 화면을 다시 그리지 않아 보이스오버 초점이 풀리지 않음
  const vOn = typeof voiceShellOn==='function' && voiceShellOn(r);
  document.body.classList.toggle('vmode', vOn);
  if(vOn){
    voiceTick(); voiceRender(); setBodyMode(false); drawSheet(); radioInit(); radioRender();
    return;
  }
  let body = '', nav = '', shell = 'shell', picker = '', corner = '', fit = false, head;
  if(r.role==='master'){
    if(UI.mtab==='game'){
      fixEv(Object.keys(EVENTS)); const E = EVENTS[UI.ev];
      if(E){ picker = pickerBtn(E.icon, E.name, E.color); body = masterGame(); fit = true; }
      else body = '<div class="card empty">켜져 있는 종목이 없습니다. 명단·설정의 종목 탭에서 종목을 켜 주세요.</div>';
    }
    else if(UI.mtab==='board') body = boardControl();
    else if(UI.mtab==='people') body = peopleView();
    else if(UI.mtab==='sched') body = schedView();
    else body = settingsView();
    nav = `<nav class="bottom">${[['game','🏁','경기'],['board','📊','안내판'],['sched','⏰','일정·알림'],['people','👥','역할'],['settings','⚙️','명단·설정']]
      .map(([k,i,l]) => `<button class="${UI.mtab===k?'on':''}" data-a="mtab" data-v="${k}"><b>${i}</b>${l}</button>`).join('')}</nav>`;
  } else if(r.role==='staff'){
    const st = staffTabs(r);
    if(!st.some(t => t.k===UI.stab)) UI.stab = st[0].k;
    const cur = st.find(t => t.k===UI.stab);
    picker = pickerBtn(cur.icon, cur.label, cur.color, st.length>1);
    body = staffBody(r); fit = UI.stab!=='mon';          // 진행 현황은 길어서 페이지 스크롤
  } else if(r.role==='board'){
    shell = 'shell boardshell' + (bdPC() ? ' pcshell' : ''); body = boardScreen();
    corner = `<button class="cornerbtn" data-a="menu" aria-label="메뉴">${ICON.menu}</button>`;
  } else body = r.offDuty ? waitView('종목이 꺼져 있습니다', '맡은 종목이 지금 꺼져 있습니다. 마스터에게 역할을 확인해 주세요.') : waitView();
  head = r.role==='board' ? '' : header(r, picker);
  if(UI.preview && r.role==='master'){
    shell = 'shell boardshell' + (bdPC() ? ' pcshell' : ''); head = ''; nav = ''; fit = false; body = boardScreen();
    // 미리 보기에서는 태블릿 / PC 화면을 바꿔 가며 볼 수 있음
    corner = `<div class="previewexit"><div class="seg sm" role="group" aria-label="안내판 화면 종류">${[['tablet','태블릿'],['pc','PC']].map(([k,l]) => `<button class="${BDKIND===k?'on':''}" data-a="bdKind" data-v="${k}" aria-pressed="${BDKIND===k}">${l}</button>`).join('')}</div><button class="btn primary small" data-a="boardPreview">미리 보기 끝내기</button></div>`;
  }
  const err = D.error ? `<div class="note">${esc(D.error)}</div>` : '';
  const rulesWarn = D.amMaster && D.rulesOld && !UI.preview ? `<div class="note rulesold" role="alert"><b>서버 규칙이 예전 것입니다.</b> 파이어베이스 콘솔 Firestore 규칙에 새 firestore.rules를 붙여 넣고 게시해 주세요. 게시하기 전에는 담당자 명단의 운영 현황·감독 호출 등이 막힙니다.
    <div class="row" style="margin-top:8px"><button class="btn small" data-a="rulesRecheck">게시했어요, 다시 확인</button></div></div>` : '';
  app.innerHTML = `<div class="${shell}">${head}<main class="${fit?'fitmain':''}">${r.role==='wait'?installBanner():''}${rulesWarn}${err}${body}</main>${nav}${corner}</div>`;
  setBodyMode(!!nav);
  if(UI.numFocus!=null){ const ne = document.getElementById('numIn'+UI.numFocus); UI.numFocus = null; if(ne && !ne.disabled) ne.focus(); }
  else if(keep){ const el = document.getElementById(keep.id); if(el){ el.focus(); try{ el.setSelectionRange(keep.s, keep.e); }catch(e){} } }
  drawSheet();
  paintWatch();
  radioInit(); radioRender();
  innerTabsFix();
  bdAfterRender();
  if(D.amMaster){ rtSyncSoon(); dedupeSoon(); rulesCheck(); }
}
/* 서버 규칙이 최신인지 확인 (마스터 기기, 접속할 때 한 번): main/meta/rules 문서를 쓸 수 있으면 최신 규칙
   예전 규칙이면 이 문서가 막혀 permission-denied가 나므로, 마스터 화면 위쪽에 경고 카드를 띄움 */
let rulesChecked = false;
function rulesCheck(force){
  if(!force && (rulesChecked || DEMO)) return;
  if(!store || !D.amMaster || !online()) return;
  rulesChecked = true;
  Promise.resolve(store.put(['main','meta','rules'], { ver:RULES_VER, at:now(), by:UI.me })).then(
    () => { if(D.rulesOld){ D.rulesOld = false; queueRender(); if(force) toast('서버 규칙이 최신입니다.'); } },
    e => { if(e && e.code==='permission-denied'){ D.rulesOld = true; queueRender(); if(force) toast('아직 예전 규칙입니다. 게시한 뒤 1분쯤 지나 다시 확인해 주세요.'); } else rulesChecked = false; });
}
// 아래 메뉴(마스터)와 무전기 줄 높이만큼 화면을 비움
function setBodyMode(hasNav){ document.body.classList.toggle('has-nav', hasNav); }
function masterGame(){
  const ev = UI.ev;
  if(ORDER_EVENTS.includes(ev) && UI.sub[ev]==='order') return orderBoth(ev);
  return eventView(ev);
}

function gateView(){
  return `<div class="gate">
    ${installBanner()}
    <div class="logo">🏅</div>
    <h1>가을운동회 점수판</h1>
    ${DEMO?`<div class="note">연습 모드입니다. 이 브라우저에만 저장됩니다. 마스터 비밀번호는 ${DEMO_MASTER_PW}입니다.</div>`:''}
    ${presetPicker()}
    <div class="card"><h2>${presetList().length ? '✍️ 그 밖에: 이름 적고 들어오기' : '이름 적고 들어오기'}</h2>
      <p class="sub">이름을 적고 들어오면 마스터가 역할을 정해 줍니다. 기록마다 이 이름이 함께 남습니다.</p>
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
    ${presetPicker()}
    ${boardView()}`;
}
function fatalView(){
  return `<div class="fatal"><div class="card"><h2>⚠ ${esc(D.fatal.title)}</h2><p>${esc(D.fatal.msg)}</p>${D.fatal.steps||''}
    <div class="row" style="margin-top:14px"><button class="btn primary" data-a="reload">다시 시도</button><a class="btn" href="?demo=1">연습 모드로 열기</a></div></div></div>`;
}
function menuSheet(){
  if(voiceMode()) return voiceMenu();
  const r = myRole();
  return `<h2>메뉴</h2>
    <p>이 기기: <b>${esc(UI.me)}</b> · ${esc(roleIcon(r))} ${esc(roleLabel(r))}</p>
    <div class="list menu">
      <div class="item tap" data-a="rename"><span class="name">✏️ 이름 바꾸기</span></div>
      ${r.role==='board' ? `<div class="item col"><span class="name">🖥 안내판 화면 종류<span class="sub">태블릿은 지금 모양 그대로, PC·프로젝터는 모든 화면을 스크롤 없이 한 화면에 꼭 맞게 키워 보여 줍니다. 이 기기에만 적용됩니다.</span></span>
        <div class="seg sm" role="group" aria-label="안내판 화면 종류">${[['tablet','태블릿'],['pc','PC·프로젝터']].map(([k,l]) => `<button class="${BDKIND===k?'on':''}" data-a="bdKind" data-v="${k}" aria-pressed="${BDKIND===k}">${l}</button>`).join('')}</div></div>` : ''}
      ${r.role!=='board' ? '<div class="item tap" data-a="schedSheet"><span class="name">📅 진행 일정<span class="sub">오늘 일정과 남은 시간을 봅니다.</span></span></div>' : ''}
      ${can.staff() ? '<div class="item tap" data-a="msgSheet"><span class="name">💬 문자 무전 · 🚨 긴급 호출</span></div>' : ''}
      ${can.abs() ? '<div class="item tap" data-a="attSheet"><span class="name">👥 출석 체크<span class="sub">오지 않은 선수를 불참으로 표시합니다.</span></span></div>' : ''}
      ${r.role!=='master' && r.role!=='wait' ? '<div class="item tap" data-a="leaveRole"><span class="name">🔄 담당 다시 고르기<span class="sub">지금 역할에서 나가고 담당자를 다시 고릅니다.</span></span></div>' : ''}
      ${r.role==='master' ? '<div class="item tap" data-a="masterLogout"><span class="name">👑 마스터에서 나가기<span class="sub">이 기기의 마스터 권한을 뺍니다.</span></span></div>'
        : '<div class="item tap" data-a="masterLogin"><span class="name">👑 마스터로 들어가기<span class="sub">마스터 비밀번호가 필요합니다.</span></span></div>'}
      ${DEMO ? '<div class="item tap" data-a="demoRole"><span class="name">🧪 연습: 역할 직접 고르기</span></div><div class="item tap" data-a="demoReset"><span class="name">🗑 연습 기록 모두 지우기</span></div>' : ''}
      ${FS.supported() ? `<div class="item"><span class="name">자동 전체화면<span class="sub">화면을 처음 누르면 주소창 없이 전체화면으로 바꿉니다.</span></span><label class="switch"><input type="checkbox" data-ch="autofs" ${UIX.autoFS?'checked':''}><span></span></label></div>
        <div class="item tap" data-a="fs"><span class="name">${FS.on()?'↙ 전체화면 끝내기':'↗ 전체화면 켜기'}</span></div>` : ''}
      ${isStandalone() ? '' : '<div class="item tap" data-a="install"><span class="name">📲 홈 화면에 설치하기</span></div>'}
      ${r.role!=='board' ? psMenu() : ''}
      ${radioRoleOK() ? `<div class="item"><span class="name">🎙 무전 소리 듣기<span class="sub">끄면 다른 사람의 무전이 이 기기에서 나오지 않습니다. 말하기는 그대로 됩니다.</span></span><label class="switch"><input type="checkbox" data-a="rxToggle" ${RADIO.on?'checked':''}><span></span></label></div>` : ''}
      ${radioRoleOK() || castOK() ? `<div class="item tap" data-a="micTest"><span class="name">🎤 마이크 미리 허용하기<span class="sub">처음 한 번 마이크 권한을 허용해 두면 당일에 바로 말할 수 있습니다.</span></span></div>
        <div class="item"><span class="name">📡 무전기 연결<span class="sub">${!RT ? '불러오는 중' : RT.st.connected ? '연결됨' : '끊김'} · ${radioReady() ? '권한 확인됨' : '권한 확인 전'}${DEMO ? '' : ` · ${esc(RTDB_URL.replace('https://',''))}`}</span></span></div>` : ''}
      ${D.amMaster && RT && RADIO.rtMaster===false ? '<div class="item tap" data-a="rxMaster"><span class="name">🔒 무전기 마스터 권한 확인<span class="sub">마스터 비밀번호를 한 번 더 입력합니다.</span></span></div>' : ''}
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
    closeSheet();
    // 무전기·방송용 Realtime Database에도 같은 비밀번호로 마스터 권한을 확인
    toast((await rtMasterLogin(pw)) ? '마스터로 들어왔습니다.' : '마스터로 들어왔습니다. 무전기 권한은 확인하지 못했습니다(Realtime Database 설정 확인).');
  }catch(e){
    console.error(e);
    toast(e && e.code==='permission-denied' ? '비밀번호가 맞지 않습니다.' : '들어가지 못했습니다: '+(e.message||e));
  }
}
Object.assign(ACT, {
  setMe: () => { const n = $('#meInput').value.trim(); if(!n){ toast('이름을 적어 주세요.'); return false; }
    UI.me = n; idStore.set('udh5_me', n); touchDevice(true);
    // 담당자 명단에 있는 이름이면 그 역할로 바로 들어감
    const ps = presetList().find(p => !p.volunteer && String(p.label).trim()===n);
    if(ps && !D.amMaster) put(['main','roles',store.uid], { preset:ps.id, name:n, ...pickRoleFields(ps), at:now() }, false, RULES_OLD_MSG).then(ok => ok && toast(`${n} 님, 들어왔습니다.`)); },
  rename: async () => { const n = await askText('이 기기를 쓰는 사람 이름', UI.me); if(n && n.trim()){ UI.me = n.trim(); idStore.set('udh5_me', UI.me); touchDevice(true); } },
  ev: (el, v) => { UI.ev = v; UI.q = ''; ls.set('udh5_ev', v); window.scrollTo(0,0); },
  mtab: (el, v) => { UI.mtab = v; ls.set('udh5_mtab', v); window.scrollTo(0,0); },
  stab: (el, v) => { UI.stab = v; UI.q = ''; ls.set('udh5_stab', v); window.scrollTo(0,0); },
  evSheet: () => { openSheet(evSheet); return false; },
  evPick: (el, v) => { closeSheet(); if(D.amMaster){ UI.ev = v; ls.set('udh5_ev', v); } else { UI.stab = v; ls.set('udh5_stab', v); } },
  cev: (el, v) => { UI.coachEv = v; ls.set('udh5_cev', v); },
  menu: () => { openSheet(menuSheet); return false; },
  closeSheet: () => { closeSheet(); return false; },
  masterLogin: async () => { await masterLogin(); },
  masterLogout: async () => { if(!(await ask('이 기기의 마스터 권한을 뺄까요?\n다시 들어오려면 비밀번호가 필요합니다.', '빼기', true))) return false;
    await rtMasterLogout(); await guard(store.del(['main','masters',store.uid])); closeSheet(); },
  demoRole: () => { if(!DEMO) return false; closeSheet(); ACT.roleSheet(null, store.uid); return false; },
  demoReset: async () => { if(DEMO && await ask('연습 기록을 모두 지울까요?', '지우기', true)){ store.reset(); closeSheet(); } },
  install: () => { installSheet(); return false; },
  fs: () => { FS.toggle(); return false; },
  later: () => { UIX.installDismissed = true; saveUIX(); toast('오른쪽 위 메뉴에서 언제든 설치할 수 있습니다.'); },
  reload: () => { location.reload(); return false; },
  rulesRecheck: () => { rulesCheck(true); return false; },
});

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]'); if(!el || el.disabled || el.closest('#dlg')) return;
  const fn = ACT[el.dataset.a]; if(!fn) return;
  const res = await fn(el, el.dataset.v, e);
  if(res !== false) render();
});
document.addEventListener('input', e => {
  const el = e.target, k = el.dataset.in; if(!k) return;
  if(k==='pkq'){ PK.q = el.value; const box = $('#pkRows'); if(box) box.innerHTML = indivPickRows(); }
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
  requestAnimationFrame(() => { renderQueued = false; if(typing() || DRAG.active || TG.drag || $('#dlg').classList.contains('open')){ renderDeferred = true; return; } render(); });
}
function flushDeferred(){ if(renderDeferred && !typing() && !DRAG.active && !TG.drag){ renderDeferred = false; render(); } }
document.addEventListener('focusout', () => setTimeout(flushDeferred, 50));

function onErr(e){
  console.error(e);
  D.error = e && e.code==='permission-denied' ? '서버 규칙 때문에 데이터를 읽을 수 없습니다. 마스터가 Firestore 규칙을 확인해 주세요.' : '연결 오류: '+((e && e.message)||e);
  queueRender();
}
let masterUnsubs = [];
function masterSubs(){
  masterUnsubs.forEach(f => { try{ f && f(); }catch(e){} }); masterUnsubs = [];
  if(!D.amMaster){ D.devices = []; D.masters = {}; D.loaded.masters = false; return; }
  masterUnsubs.push(store.onCol(['main','devices'], l => { D.devices = l; queueRender(); }, onErr));
  masterUnsubs.push(store.onCol(['main','masters'], l => { D.masters = Object.fromEntries(l.map(x => [x.id, x])); D.loaded.masters = true; queueRender(); }, onErr));
}
function subscribe(){
  const col = k => (l, p) => { D[k] = l; D.pending[k] = p; D.loaded[k] = true; queueRender(); };
  const map = k => (l, p) => { D[k] = Object.fromEntries(l.map(x => [x.id, x])); D.pending[k] = p; D.loaded[k] = true; queueRender(); };
  store.onDoc(['config'], (d, p) => { D.config = d || {}; rebuildEvents(); D.pending.config = p ? 1 : 0; D.loaded.config = true; queueRender(); }, onErr);
  store.onCol(['main','calls'], map('calls'), onErr);
  // 감독 호출은 없어도 점수판이 돌아가야 하므로, 읽지 못해도 오류 띠는 띄우지 않음 (Firestore 규칙에 ccalls가 없을 때)
  store.onCol(['main','ccalls'], map('ccalls'), e => console.error(e));
  // 대기 줄·과녁 사진은 없어도 점수판이 돌아가야 하므로, 읽지 못해도 오류 띠는 띄우지 않음 (Firestore 규칙이 예전 것일 때)
  store.onCol(['main','queues'], map('queues'), e => console.error(e));
  store.onCol(['main','assets'], map('assets'), e => console.error(e));
  store.onCol(['main','indiv'], col('indiv'), onErr);
  store.onCol(['main','matches'], col('matches'), onErr);
  store.onCol(['main','orders'], map('orders'), onErr);
  store.onCol(['main','roles'], map('roles'), onErr);
  store.onCol(['main','presets'], map('presets'), onErr);
  store.onCol(['main','absent'], map('absent'), onErr);
  store.onQuery(['main','msgs'], 'at', '>', now() - 15*60000, (l) => { D.msgs = l; processMsgs(); queueRender(); if((document.activeElement||{}).id!=='msgText') wkMsgDraw(); }, onErr);
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
  // 진행 현황 화면은 남은 시간이 흘러가므로 30초마다 다시 그림
  setInterval(() => { if(typeof progressVisible==='function' && progressVisible()) queueRender(); }, 30000);
  document.addEventListener('visibilitychange', () => { if(document.visibilityState==='visible') touchDevice(); });
  render();
})();
window.addEventListener('beforeunload', e => {
  const p = Object.values(D.pending).reduce((s,v) => s+(v||0), 0);
  if(p && !online()){ e.preventDefault(); e.returnValue = ''; }
});
