'use strict';
/* ===================== 홈 화면 설치 · 전체화면 · 화면 켜 두기 · 안내 창 ===================== */
// Artifact로 게시하면 head 태그가 body로 들어가므로 다시 head로 옮김
(function(){
  document.querySelectorAll('body > meta, body > link[rel="manifest"], body > link[rel="icon"], body > link[rel="apple-touch-icon"]').forEach(el => document.head.appendChild(el));
})();
let inFrame = false; try{ inFrame = window.self !== window.top; }catch(e){ inFrame = true; }
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (matchMedia('(display-mode: fullscreen)').matches && !(document.fullscreenElement || document.webkitFullscreenElement)) || navigator.standalone === true;
const FS = {
  userExit:false,
  supported(){ const d = document.documentElement; return !!(d.requestFullscreen || d.webkitRequestFullscreen) && !isStandalone() && !inFrame; },
  on(){ return !!(document.fullscreenElement || document.webkitFullscreenElement); },
  enter(){ const d = document.documentElement; try{ const r = d.requestFullscreen ? d.requestFullscreen({ navigationUI:'hide' }) : (d.webkitRequestFullscreen && d.webkitRequestFullscreen()); if(r && r.catch) r.catch(() => {}); }catch(e){} },
  exit(){ try{ const r = document.exitFullscreen ? document.exitFullscreen() : (document.webkitExitFullscreen && document.webkitExitFullscreen()); if(r && r.catch) r.catch(() => {}); }catch(e){} },
  toggle(){ if(!FS.supported()){ installGuide(); return; } if(FS.on()){ FS.userExit = true; FS.exit(); } else { FS.userExit = false; FS.enter(); } },
};
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if(typeof rerender === 'function') rerender(); });
window.addEventListener('appinstalled', () => { installEvt = null; SET.installDismissed = true; saveSet(); speak('홈 화면에 설치했습니다.'); if(typeof rerender === 'function') rerender(); });
const canInstall = () => !isStandalone() && !inFrame;
function installBanner(){
  if(!canInstall() || SET.installDismissed) return '';
  return `<div class="banner" role="region" aria-label="홈 화면에 설치 안내"><b>홈 화면에 설치하기</b>
    <span>설치하면 아이콘으로 바로 열리고, 주소창 없이 넓게 쓸 수 있습니다.</span>
    <div class="row"><button class="btn primary" data-sh="install">설치하기</button>${FS.supported() ? '<button class="btn" data-sh="fs">전체화면</button>' : ''}<button class="btn ghost" data-sh="later">다음에</button></div></div>`;
}
function doInstall(){
  if(installEvt){
    const ev = installEvt; installEvt = null;
    try{ ev.prompt(); ev.userChoice.then(r => { if(r && r.outcome === 'accepted'){ SET.installDismissed = true; saveSet(); } if(typeof rerender === 'function') rerender(); }).catch(() => {}); }
    catch(e){ installGuide(); }
    return;
  }
  installGuide();
}
function installGuide(){
  if(isStandalone()){ openDlg('홈 화면 앱', ['이미 홈 화면 앱으로 실행 중입니다.']); return; }
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const samsung = /SamsungBrowser/i.test(ua), inapp = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(ua);
  const mobile = /Android|Mobi/i.test(ua) || ios;
  let how;
  if(inFrame) how = ['지금은 다른 화면 안에 들어 있어서 설치하거나 전체화면으로 바꿀 수 없습니다.', '휴대폰 크롬이나 사파리에서 handscil01-afk.github.io/Sungmo/baseball/ 주소로 열어 주세요.'];
  else if(inapp) how = ['1. 오른쪽 아래나 위의 점 세 개 메뉴를 누릅니다.', '2. 다른 브라우저로 열기(크롬·사파리)를 누릅니다.', '3. 열린 화면에서 다시 홈 화면에 설치하기를 누릅니다.'];
  else if(ios) how = ['1. 사파리 아래쪽(아이패드는 위쪽)의 공유 단추를 누릅니다.', '2. 메뉴를 올려 홈 화면에 추가를 누릅니다.', '3. 오른쪽 위 추가를 누릅니다.', '아이폰은 전체화면 단추가 없고, 홈 화면에 추가하면 넓은 화면으로 열립니다.'];
  else if(samsung) how = ['1. 아래쪽 줄 세 개(≡) 메뉴를 누릅니다.', '2. 현재 페이지 추가를 누르고 홈 화면을 고릅니다.'];
  else if(mobile) how = ['1. 오른쪽 위 점 세 개(⋮) 메뉴를 누릅니다.', '2. 앱 설치 또는 홈 화면에 추가를 누릅니다.', '3. 뜨는 창에서 설치를 누릅니다.'];
  else how = ['1. 크롬·엣지 주소창 오른쪽의 설치 아이콘을 누릅니다.', '2. 없으면 점 세 개(⋮) 메뉴에서 앱 설치를 누릅니다.'];
  openDlg('홈 화면에 설치하기', how);
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-sh]');
  if(b){
    const a = b.dataset.sh;
    if(a === 'install') doInstall();
    if(a === 'fs') FS.toggle();
    if(a === 'later'){ SET.installDismissed = true; saveSet(); speak('설치 안내를 닫았습니다. 설정에서 언제든 설치할 수 있습니다.'); if(typeof rerender === 'function') rerender(); }
    return;
  }
  // 자동 전체화면: 화면을 처음 누를 때 (직접 끈 뒤에는 다시 켜지 않음)
  if(!SET.autoFS || FS.userExit || FS.on() || !FS.supported()) return;
  if(e.target.closest && e.target.closest('.banner, #dlg')) return;
  FS.enter();
}, true);
['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => { if(typeof rerender === 'function') rerender(); }));
let wakeLock = null;
async function keepAwake(){ try{ if('wakeLock' in navigator && document.visibilityState === 'visible' && !wakeLock){ wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } }catch(e){ wakeLock = null; } }
document.addEventListener('visibilitychange', keepAwake);
document.addEventListener('click', keepAwake, { once:true });
document.addEventListener('keydown', keepAwake, { once:true });
if('serviceWorker' in navigator && location.protocol === 'https:'){ window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {})); }

/* ---------- 안내 창 (alert·confirm 대신) ----------
   lines: 문단 배열 · btns: [{ label, act }] (없으면 '닫기') */
let dlgOpener = null;
function openDlg(title, lines, btns){
  const d = $('#dlg'), box = $('#dlgBox');
  if(!d.classList.contains('open')) dlgOpener = document.activeElement;
  btns = btns && btns.length ? btns : [{ label:'닫기' }];
  box.innerHTML = `<h2 id="dlgT" tabindex="-1">${esc(title)}</h2>${lines.map(l => `<p>${esc(l)}</p>`).join('')}
    <div class="row">${btns.map((b, i) => `<button class="btn ${i === 0 ? 'primary' : ''}" data-dlg="${i}">${esc(b.label)}</button>`).join('')}</div>`;
  box.setAttribute('aria-labelledby', 'dlgT');
  d.classList.add('open');
  d.__btns = btns;
  setTimeout(() => { const h = $('#dlgT'); if(h) h.focus(); }, 30);
}
function closeDlg(){
  const d = $('#dlg'); if(!d.classList.contains('open')) return;
  d.classList.remove('open'); $('#dlgBox').innerHTML = '';
  const o = dlgOpener; dlgOpener = null;
  if(o && document.contains(o)) try{ o.focus(); }catch(e){}
}
const dlgOpen = () => $('#dlg').classList.contains('open');
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-dlg]');
  if(!b) return;
  const btn = ($('#dlg').__btns || [])[+b.dataset.dlg];
  closeDlg();
  if(btn && btn.act) btn.act();
});
document.addEventListener('keydown', e => {
  if(!dlgOpen()) return;
  if(e.key === 'Escape'){ e.preventDefault(); closeDlg(); return; }
  // 창 안에서만 초점이 돌게 함
  if(e.key === 'Tab'){
    const f = [...$('#dlgBox').querySelectorAll('button, [tabindex="-1"]')];
    if(!f.length) return;
    const i = f.indexOf(document.activeElement);
    if(e.shiftKey && i <= 0){ e.preventDefault(); f[f.length - 1].focus(); }
    else if(!e.shiftKey && i === f.length - 1){ e.preventDefault(); f[0].focus(); }
  }
});
