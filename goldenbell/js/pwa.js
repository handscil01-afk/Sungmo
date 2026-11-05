'use strict';
/* ===================== 홈 화면 설치 · 전체화면 ===================== */
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
let inFrame = false; try{ inFrame = window.self !== window.top; }catch(e){ inFrame = true; }
const UIP = { autoFS:true, installDismissed:false, ...ls.get('ui', {}) };
const saveUIP = () => ls.set('ui', UIP);
const FS_ICON = {
  on:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  off:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
};
const FS = {
  userExit:false,
  supported(){ const d = document.documentElement; return !!(d.requestFullscreen || d.webkitRequestFullscreen) && !isStandalone() && !inFrame; },
  on(){ return !!(document.fullscreenElement || document.webkitFullscreenElement); },
  enter(){ const d = document.documentElement; try{ const r = d.requestFullscreen ? d.requestFullscreen({ navigationUI:'hide' }) : (d.webkitRequestFullscreen && d.webkitRequestFullscreen()); if(r && r.catch) r.catch(() => {}); }catch(e){} },
  exit(){ try{ const r = document.exitFullscreen ? document.exitFullscreen() : (document.webkitExitFullscreen && document.webkitExitFullscreen()); if(r && r.catch) r.catch(() => {}); }catch(e){} },
  toggle(){
    if(!FS.supported()){ installSheet(); return; }
    if(FS.on()){ FS.userExit = true; FS.exit(); } else { FS.userExit = false; FS.enter(); }
  },
};
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; paintInstall(); });
window.addEventListener('appinstalled', () => { installEvt = null; UIP.installDismissed = true; saveUIP(); paintInstall(); toast('홈 화면에 설치했어요'); });
function paintInstall(){
  const sa = isStandalone();
  const b = $('#installBanner'); if(b) b.hidden = sa || inFrame || UIP.installDismissed;
  $$('.fsonly').forEach(x => x.hidden = !FS.supported());
  const i2 = $('#installBtn2'); if(i2) i2.hidden = sa;
  $$('.fsbtn').forEach(h => { h.hidden = sa; h.innerHTML = FS.on() ? FS_ICON.off : FS_ICON.on; h.setAttribute('aria-label', FS.on() ? '전체화면 끝내기' : '전체화면'); });
}
function installSheet(){
  if(isStandalone()){ toast('이미 홈 화면 앱으로 열려 있어요'); return; }
  if(installEvt){ const ev = installEvt; installEvt = null; try{ ev.prompt(); ev.userChoice.then(r => { if(r && r.outcome === 'accepted'){ UIP.installDismissed = true; saveUIP(); } paintInstall(); }).catch(() => {}); }catch(e){} return; }
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const samsung = /SamsungBrowser/i.test(ua), inapp = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(ua);
  const mobile = /Android|Mobi/i.test(ua) || ios;
  const kbd = t => `<span class="kbd">${t}</span>`;
  let how;
  if(location.protocol === 'file:') how = `<p>파일로 열려 있어서 설치할 수 없어요. 아래 주소로 열어 주세요.</p><p><b>${APP_ADDR}</b></p>`;
  else if(inapp) how = `<ol><li>${kbd('⋮')} 메뉴를 누르세요</li><li><b>다른 브라우저로 열기</b>(크롬·사파리)를 누르세요</li><li>열린 화면에서 다시 <b>설치하기</b>를 누르세요</li></ol>`;
  else if(ios) how = `<ol><li>사파리 아래(또는 위) ${kbd('공유 ⬆')} 단추를 누르세요</li><li>메뉴를 올려 <b>홈 화면에 추가</b>를 누르세요</li><li>오른쪽 위 <b>추가</b>를 누르세요</li></ol>`;
  else if(samsung) how = `<ol><li>아래 ${kbd('≡')} 메뉴를 누르세요</li><li><b>현재 페이지 추가</b> → <b>홈 화면</b>을 누르세요</li></ol>`;
  else if(mobile) how = `<ol><li>오른쪽 위 ${kbd('⋮')} 메뉴를 누르세요</li><li><b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 누르세요</li><li>뜨는 창에서 <b>설치</b>를 누르세요</li></ol>`;
  else how = `<ol><li>크롬·엣지 주소창 오른쪽의 ${kbd('설치 ⊕')} 아이콘을 누르세요</li><li>없으면 ${kbd('⋮')} 메뉴 → <b>앱 설치</b>(또는 <b>이 사이트를 앱으로 설치</b>)를 누르세요</li></ol>`;
  openSheet(`<h3>홈 화면에 설치하기</h3><p>설치하면 아이콘으로 바로 열리고, 주소창 없이 화면을 넓게 쓸 수 있어요.</p>${how}<div class="row"><div class="sp"></div><button class="btn primary" data-close>알겠어요</button></div>`);
}
function settingsSheet(){
  let h = '<h3>설정</h3>';
  if(FS.supported()) h += `<label class="chk srow"><input type="checkbox" id="stAutoFs" ${UIP.autoFS ? 'checked' : ''}> 자동 전체화면 <small class="muted">직원 화면을 처음 누르면 주소창 없이 전체화면으로 바꿔요</small></label>
    <div class="row"><button class="btn" data-fs>${FS.on() ? '전체화면 끝내기' : '전체화면 켜기'}</button></div>`;
  if(!isStandalone()) h += '<div class="row"><button class="btn" data-inst>홈 화면에 설치하기</button></div>';
  h += '<div class="row"><div class="sp"></div><button class="btn primary" data-close>닫기</button></div>';
  const box = openSheet(h, e => {
    if(e.target.closest('[data-fs]')){ closeSheet(); FS.toggle(); }
    if(e.target.closest('[data-inst]')){ closeSheet(); installSheet(); }
  });
  const sw = box.querySelector('#stAutoFs'); if(sw) sw.addEventListener('change', () => { UIP.autoFS = sw.checked; saveUIP(); });
}
// 자동 전체화면: 처음 화면·직원 화면을 처음 누를 때 (진행자 PC·프로젝터 창은 따로 정함). 버튼으로 끈 뒤에는 다시 켜지 않음
document.addEventListener('click', e => {
  if(!UIP.autoFS || FS.userExit || FS.on() || !FS.supported()) return;
  if(ROLE !== 'staff' && ROLE !== '') return;
  if(e.target.closest && e.target.closest('.fsbtn, #installBanner, #sheet, [data-act="role"]')) return;
  FS.enter();
}, true);
document.addEventListener('fullscreenchange', paintInstall);
document.addEventListener('webkitfullscreenchange', paintInstall);
if('serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
