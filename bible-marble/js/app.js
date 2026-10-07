'use strict';
/* ================= 앱: 화면 전환 · 머리줄 · 설치 · 전체화면 · 시작 ================= */
const App={
  home(){abortFlow();if(Net.role)Net.leave();G=null;closeLayer('prompt');closeLayer('info');
    document.body.classList.remove('ingame','tab','port');$('#game').hidden=true;$('#home').hidden=false;document.body.appendChild($('#toast'));
    UI.updateHeader();Home.show();UI.fit();scrollTo(0,0)},
  prefChanged(){UI.fit();drawSoundBtn();if(VG())UI.render()}
};
UI.enterGame=function(){
  closeLayer('info');document.body.classList.add('ingame');$('#home').hidden=true;$('#game').hidden=false;
  UI.buildBoard();UI.fit();UI.render();Wake.on();scrollTo(0,0)};
UI.afterEnd=function(v){if(v==='again'&&G&&G.setup)startGame(clone(G.setup));else App.home()};
UI.updateHeader=function(){const ing=document.body.classList.contains('ingame');
  $('#bUndo').hidden=!(ing&&Net.role!=='client'&&canUndo());$('#bLog').hidden=!ing;$('#bMenu').hidden=!ing;
  const r=$('#hRoom');if(Net.role&&Net.code){r.hidden=false;r.textContent=`${Net.role==='host'?'👑 방장':'📱 참가'} · ${Net.code}`}else r.hidden=true};
/* 게임 설정을 G에 함께 저장해서 "같은 설정으로 다시 하기"에 씁니다 */
const _makeGame=makeGame;makeGame=function(setup){const g=_makeGame(setup);g.setup=clone(setup);return g};

/* ---------- 머리줄 버튼 ---------- */
function drawSoundBtn(){const b=$('#bSound');b.innerHTML=(PREF.sound?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>')+`<span class="lb">${PREF.sound?'소리 켬':'소리 끔'}</span>`;b.setAttribute('aria-label',PREF.sound?'효과음 끄기':'효과음 켜기')}
$('#bUndo').onclick=()=>{if(!undo())UI.toast('되돌릴 선택이 없어요')};
$('#bLog').onclick=openLog;$('#bRules').onclick=showRules;
$('#bSound').onclick=()=>{PREF.sound=!PREF.sound;savePref();drawSoundBtn();if(PREF.sound){SND.init();SND.play('coin')}};
$('#bMenu').onclick=()=>{if(Net.role==='client')return NetUI.clientMenu();Setup.openInGame()};
$('#bFS').onclick=()=>FS.toggle();

/* ---------- 홈 화면 설치 · 전체화면 ---------- */
(function moveHeadTags(){try{document.head.append(...document.querySelectorAll('link[rel=manifest],link[rel=icon],link[rel=apple-touch-icon],meta[name=theme-color],meta[name=mobile-web-app-capable],meta[name^=apple-mobile-web-app]'))}catch(e){}})();
const EMB=(()=>{try{return window.self!==window.top}catch(e){return true}})();
const IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const ANDROID=/Android/i.test(navigator.userAgent),SAMSUNG=/SamsungBrowser/i.test(navigator.userAgent);
const STANDALONE=()=>{try{return matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true}catch(e){return false}};
let installEvt=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e});
addEventListener('appinstalled',()=>{installEvt=null;PREF.installHide=true;savePref();UI.toast('📲 홈 화면에 설치했어요!');if(!document.body.classList.contains('ingame'))Home.show()});
const FS={userExit:false,
  can(){const d=document.documentElement;return !!(d.requestFullscreen||d.webkitRequestFullscreen)&&document.fullscreenEnabled!==false&&document.webkitFullscreenEnabled!==false},
  is(){return !!(document.fullscreenElement||document.webkitFullscreenElement)},
  enter(quiet){const d=document.documentElement;if(!this.can()){if(!quiet)openInstall('fs');return}
    let pr;try{pr=d.requestFullscreen?d.requestFullscreen({navigationUI:'hide'}):(d.webkitRequestFullscreen(),null)}catch(e){pr=Promise.reject(e)}
    Promise.resolve(pr).catch(()=>{if(!quiet)openInstall('fs')})},
  exit(){try{(document.exitFullscreen||document.webkitExitFullscreen).call(document)}catch(e){}},
  toggle(){if(this.is()){this.userExit=true;this.exit()}else{this.userExit=false;this.enter(false)}}};
function onFSChange(){document.body.classList.toggle('fs',FS.is());$('#bFS').setAttribute('aria-label',FS.is()?'전체화면 끝내기':'전체화면');$('#bFS .lb').textContent=FS.is()?'창 모드':'전체화면';
  $('#bFS .ic-on').style.display=FS.is()?'none':'';$('#bFS .ic-off').style.display=FS.is()?'':'none';setTimeout(()=>UI.fit(),80)}
document.addEventListener('fullscreenchange',onFSChange);document.addEventListener('webkitfullscreenchange',onFSChange);
/* 자동 전체화면: 화면을 누를 때 전체화면이 아니면 켭니다. 버튼으로 직접 끈 뒤에는 켜지 않습니다 */
document.addEventListener('click',e=>{if(!PREF.autoFS||FS.userExit||FS.is()||STANDALONE()||!FS.can())return;if(e.target.closest&&e.target.closest('#bFS,input,textarea,select'))return;FS.enter(true)},true);
function installSteps(){
  if(IOS)return `<ol class="steps"><li><b>Safari</b>로 이 페이지를 열어 주세요.</li><li>공유 버튼 <span class="kbd">⬆︎</span>을 누르세요. 아이패드는 주소창 오른쪽, 아이폰은 화면 아래에 있어요.</li><li><span class="kbd">홈 화면에 추가</span>를 누르고 <span class="kbd">추가</span>를 누르면 끝이에요.</li></ol>`;
  if(SAMSUNG)return `<ol class="steps"><li>화면 아래의 메뉴 <span class="kbd">≡</span>를 누르세요.</li><li><span class="kbd">현재 페이지 추가</span> → <span class="kbd">홈 화면</span>을 누르세요.</li><li>홈 화면에 생긴 아이콘으로 열면 주소창 없이 열려요.</li></ol>`;
  if(ANDROID)return `<ol class="steps"><li>크롬 오른쪽 위의 메뉴 <span class="kbd">⋮</span>를 누르세요.</li><li><span class="kbd">홈 화면에 추가</span> 또는 <span class="kbd">앱 설치</span>를 누르세요.</li><li><span class="kbd">설치</span>를 누르면 홈 화면에 아이콘이 생겨요.</li></ol>`;
  return `<ol class="steps"><li>크롬이나 엣지 주소창 오른쪽의 설치 아이콘 <span class="kbd">⊕</span>을 누르세요.</li><li>아이콘이 없으면 메뉴 <span class="kbd">⋮</span>에서 <span class="kbd">앱 설치</span> 또는 <span class="kbd">바로가기 만들기</span>를 누르세요.</li></ol>`}
async function openInstall(why){
  if(STANDALONE())return UI.toast('이미 홈 화면 앱으로 열려 있어요');
  if(installEvt&&why!=='fs'){const e=installEvt;installEvt=null;try{e.prompt();const r=await e.userChoice;if(r&&r.outcome==='accepted'){PREF.installHide=true;savePref()}}catch(err){}return}
  openInfo(why==='fs'?'전체화면':'홈 화면에 설치',why==='fs'?'📺 이 화면에서는 전체화면이 안 돼요':'📲 홈 화면에 설치하기',
    `${why==='fs'?'<p>지금 쓰는 브라우저나 화면에서는 전체화면을 막아 두었어요. <b>홈 화면에 설치</b>해서 아이콘으로 열면 주소창 없이 넓게 쓸 수 있어요.</p>':'<p>홈 화면에 설치하면 앱처럼 아이콘으로 바로 열리고, 주소창 없이 화면을 넓게 쓸 수 있어요.</p>'}
    ${installSteps()}${EMB?'<p class="ref">지금은 다른 페이지 안에 들어 있는 화면이라 설치가 잘 안 될 수 있어요. 링크를 브라우저에서 직접 연 뒤 위 순서대로 해 주세요.</p>':''}`,'var(--mint)',true)}
function installBanner(){if(STANDALONE()||PREF.installHide)return '';
  return `<div class="inst" id="instBan"><img src="icon-192.png" alt=""><div class="tx"><b>홈 화면에 설치하고 전체화면으로 즐겨요</b><small>설치하면 아이콘으로 바로 열리고 주소창 없이 넓게 보여요.</small></div>
    <div class="bt"><button class="btn mint" data-inst>📲 설치하기</button>${FS.can()?'<button class="btn" data-fs>📺 전체화면</button>':''}<button class="btn" data-later>다음에</button></div></div>`}
function bindInstall(root){$$('[data-inst]',root).forEach(b=>b.onclick=()=>openInstall());
  const f=$('[data-fs]',root);if(f)f.onclick=()=>{FS.userExit=false;FS.enter(false)};
  const l=$('[data-later]',root);if(l)l.onclick=()=>{PREF.installHide=true;savePref();$('#instBan')?.remove();UI.toast('설치는 화면·소리 메뉴에서 언제든 할 수 있어요')}}
/* 게임 중에는 화면이 꺼지지 않게 합니다 (지원하는 기기만) */
const Wake={l:null,async on(){try{if(navigator.wakeLock&&!this.l){this.l=await navigator.wakeLock.request('screen');this.l.addEventListener('release',()=>{this.l=null})}}catch(e){}}};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&VG()&&!VG().over)Wake.on()});
/* 오프라인 실행 */
if('serviceWorker' in navigator&&location.protocol==='https:')addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));

/* ---------- 시작 ---------- */
drawSoundBtn();document.body.classList.toggle('standalone',STANDALONE());if(STANDALONE())$('#bFS').hidden=true;
UI.fit();
(function boot(){const m=location.hash.match(/room=([A-Z0-9]{4,8})/i);
  if(m){history.replaceState(null,'',location.pathname+location.search);App.home();NetUI.open(m[1].toUpperCase());return}
  App.home();
  /* 새로고침했거나 앱이 잠깐 꺼졌다 켜지면 들어가 있던 방으로 자동으로 돌아갑니다 */
  const ns=Net.savedSession();if(ns&&(ns.role==='client'||hasSave()))Net.rejoin()})();
