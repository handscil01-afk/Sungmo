'use strict';
/* ===================== 홈 화면 설치 · 전체화면 · 화면 켜 두기 ===================== */
const UIX = { autoFS:true, installDismissed:false, ...ls.get('udh5_uix', {}) };
const saveUIX = () => ls.set('udh5_uix', UIX);
let inFrame = false; try{ inFrame = window.self !== window.top; }catch(e){ inFrame = true; }
// 전체화면 API로 화면을 키운 경우에도 display-mode가 fullscreen이 되므로, 그때는 홈 화면 앱으로 보지 않음
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (matchMedia('(display-mode: fullscreen)').matches && !(document.fullscreenElement || document.webkitFullscreenElement)) || navigator.standalone === true;
const SVG = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const ICON = {
  fsOn: SVG('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'),
  fsOff: SVG('M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5'),
  menu: SVG('M4 6h16M4 12h16M4 18h16'),
};
const FS = {
  userExit:false,
  supported(){ const d=document.documentElement; return !!(d.requestFullscreen || d.webkitRequestFullscreen) && !isStandalone() && !inFrame; },
  on(){ return !!(document.fullscreenElement || document.webkitFullscreenElement); },
  enter(){ const d=document.documentElement; try{ const r = d.requestFullscreen ? d.requestFullscreen({navigationUI:'hide'}) : (d.webkitRequestFullscreen && d.webkitRequestFullscreen()); if(r && r.catch) r.catch(()=>{}); }catch(e){} },
  exit(){ try{ const r = document.exitFullscreen ? document.exitFullscreen() : (document.webkitExitFullscreen && document.webkitExitFullscreen()); if(r && r.catch) r.catch(()=>{}); }catch(e){} },
  toggle(){ if(!FS.supported()){ installSheet(); return; } if(FS.on()){ FS.userExit=true; FS.exit(); } else { FS.userExit=false; FS.enter(); } }
};
function fsButton(){ if(isStandalone()) return ''; return `<button class="hbtn" data-a="fs" aria-label="${FS.on()?'전체화면 끝내기':'전체화면'}">${FS.on()?ICON.fsOff:ICON.fsOn}</button>`; }
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; render(); });
window.addEventListener('appinstalled', () => { installEvt=null; UIX.installDismissed=true; saveUIX(); render(); toast('홈 화면에 설치했습니다.'); });
function installBanner(){
  if(isStandalone() || inFrame || UIX.installDismissed) return '';
  return `<div class="banner"><b>홈 화면에 설치하기</b><span class="sub">설치하면 아이콘으로 바로 열리고, 인터넷이 약한 곳에서도 열립니다.</span>
    <div class="row"><button class="btn small primary" data-a="install">설치하기</button>${FS.supported()?'<button class="btn small" data-a="fs">전체화면</button>':''}<button class="btn small ghost" data-a="later">다음에</button></div></div>`;
}
function doInstall(){
  const ev = installEvt; installEvt = null;
  try{ ev.prompt(); ev.userChoice.then(r => { if(r && r.outcome==='accepted'){ UIX.installDismissed=true; saveUIX(); } render(); }).catch(()=>{}); }
  catch(e){ installSheet(); }
}
function installSheet(){
  if(isStandalone()){ toast('이미 홈 화면 앱으로 실행 중입니다.'); return; }
  if(installEvt){ doInstall(); return; }
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  const samsung = /SamsungBrowser/i.test(ua), inapp = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(ua);
  const mobile = /Android|Mobi/i.test(ua) || ios;
  const k = t => `<span class="kbd">${t}</span>`;
  let how;
  if(location.protocol==='file:') how = '<p>지금은 파일로 열려 있어서 설치할 수 없습니다. 휴대폰 크롬이나 사파리에서 아래 주소로 열어 주세요.</p><p><b>handscil01-afk.github.io/Sungmo/sports-day/</b></p>';
  else if(inapp) how = `<ol><li>오른쪽 아래(또는 위) ${k('⋮')} 메뉴를 누릅니다.</li><li><b>다른 브라우저로 열기</b>(크롬·사파리)를 누릅니다.</li><li>열린 화면에서 다시 <b>설치하기</b>를 누릅니다.</li></ol>`;
  else if(ios) how = `<ol><li>사파리 아래(또는 위) ${k('공유 ⬆')} 단추를 누릅니다.</li><li>메뉴를 올려 <b>홈 화면에 추가</b>를 누릅니다.</li><li>오른쪽 위 <b>추가</b>를 누릅니다.</li></ol>`;
  else if(samsung) how = `<ol><li>아래 ${k('≡')} 메뉴를 누릅니다.</li><li><b>현재 페이지 추가</b> → <b>홈 화면</b>을 누릅니다.</li></ol>`;
  else if(mobile) how = `<ol><li>오른쪽 위 ${k('⋮')} 메뉴를 누릅니다.</li><li><b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 누릅니다.</li><li>뜨는 창에서 <b>설치</b>를 누릅니다.</li></ol>`;
  else how = `<ol><li>크롬·엣지 주소창 오른쪽의 ${k('설치 ⊕')} 아이콘을 누릅니다.</li><li>없으면 ${k('⋮')} 메뉴 → <b>앱 설치</b>를 누릅니다.</li></ol>`;
  openSheet(() => `<h2>홈 화면에 설치하기</h2><p>설치하면 아이콘으로 바로 열리고, 주소창 없이 화면을 넓게 쓸 수 있습니다.</p>${how}<button class="btn primary wide" data-a="closeSheet">알겠습니다</button>`);
}
document.addEventListener('click', e => {
  if(!UI.me || !UIX.autoFS || FS.userExit || FS.on() || !FS.supported()) return;
  if(e.target.closest && e.target.closest('[data-a="fs"], .banner, #sheet, #dlg, .switch, #radio')) return;
  FS.enter();
}, true);
document.addEventListener('fullscreenchange', () => render());
document.addEventListener('webkitfullscreenchange', () => render());
let wakeLock = null;
async function keepAwake(){ try{ if('wakeLock' in navigator && document.visibilityState==='visible' && !wakeLock){ wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock=null; }); } }catch(e){ wakeLock=null; } }
document.addEventListener('visibilitychange', keepAwake);
document.addEventListener('click', keepAwake, { once:true });
if('serviceWorker' in navigator && location.protocol==='https:'){ window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{})); }
