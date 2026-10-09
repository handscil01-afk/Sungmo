'use strict';
/* ================= 앱: 화면 전환 · 머리줄 · 설치 · 전체화면 · 시작 ================= */
const App={
  home(){abortFlow();
    /* 게임 중인 방장이 나가면 방을 잠시 닫습니다: 자리 주인과 열쇠는 그대로 두고 이어하기로 같은 방 코드를 다시 엽니다 */
    if(Net.role==='host'&&G&&!G.over){persistNow();Net.leave(false,true)}else if(Net.role)Net.leave();
    G=null;closeLayer('prompt');closeLayer('info');closeLayer('edit');
    document.body.classList.remove('ingame','tab','port','dash','display','remote');$('#game').hidden=true;$('#home').hidden=false;document.body.appendChild($('#toast'));$('#dash')?.remove();
    UI.updateHeader();Home.show();UI.fit();scrollTo(0,0)},
  /* 게임 중 "처음 화면으로": 한 번 더 묻습니다 */
  leaveGame(){const cl=Net.role==='client',host=Net.role==='host';
    const L=openLayer('edit',`<div class="bigpic">${cl?'🚪':'🏠'}</div><h3>${cl?'방에서 나갈까요?':'처음 화면으로 갈까요?'}</h3><div class="mbody"><p>${cl?'같은 방 코드로 다시 들어오면 내 자리로 돌아가요.':host?`게임은 저장되고, 방 <b>${esc(Net.code)}</b>은 잠시 닫혀요. 참가자 기기는 기다리다가 "이어하기"로 방이 다시 열리면 자동으로 들어와요.`:'게임은 저장되고 "이어하기"로 다시 할 수 있어요.'}</p></div>
      <div class="mbtns row"><button class="btn wide" data-c>취소</button><button class="btn main wide" data-ok>${cl?'나가기':'처음 화면으로'}</button></div>`,{close:true,tone:'var(--accent)'});
    $('[data-c]',L.box).onclick=L.close;$('[data-ok]',L.box).onclick=()=>{L.close();if(cl){Net.leave();App.home()}else App.home()}},
  /* 이어하기: 여럿이 하던 게임이면 같은 방 코드로 방을 다시 열고, 방장은 원래 자리로 돌아갑니다 */
  async resume(save){if(!save)return;
    if(!save.G.room)return resumeGame(save);
    const r=save.G.room,restore=save.net&&save.net.code===r.code?save.net:null;
    try{UI.toast(`방 ${r.code}을 다시 여는 중… (최대 30초)`,4000);await Net.host(r.mode,r.code,restore);resumeGame(save);UI.toast(`📶 방 ${r.code}을 다시 열었어요. 참가자 기기가 자동으로 들어와요`,4000)}
    catch(e){netError(e)}},
  prefChanged(){UI.fit();drawSoundBtn();BGM.sync();if(VG()){UI.render();UI.renderTokens&&UI.renderTokens()}}
};
UI.enterGame=function(){
  closeLayer('info');document.body.classList.add('ingame');$('#home').hidden=true;$('#game').hidden=false;
  UI.buildBoard();UI.fit();UI.render();UI.refit();if(Net.kind!=='display')Wake.on();scrollTo(0,0);
  if(Net.kind==='display')displayStart()};
UI.afterEnd=function(v){if(v==='again'&&G&&G.setup)startGame(clone(G.setup));else App.home()};
UI.updateHeader=function(){const ing=document.body.classList.contains('ingame');
  const u=$('#gUndo');if(u)u.hidden=!(ing&&Net.role!=='client'&&canUndo());
  const h=$('#gHost');if(h)h.hidden=!(ing&&Net.role==='host'&&Net.mode==='relay');
  const s=$('#gSet');if(s)s.hidden=Net.kind==='display'};
/* 게임 설정을 G에 함께 저장해서 "같은 설정으로 다시 하기"에 씁니다 */
const _makeGame=makeGame;makeGame=function(setup){const g=_makeGame(setup);g.setup=clone(setup);return g};
function persistNow(){if(!G)return;try{store.set('save',{G,J:{turns:J.turns.slice(-6),reserve:J.reserve},net:Net.saveInfo()})}catch(e){}}
/* 게임 화면(TV) 창: 처음 한 번 누르면 전체화면이 됩니다 */
function displayStart(){if($('#dispGo')||FS.is())return;const d=document.createElement('button');d.id='dispGo';d.className='dispgo';
  d.innerHTML='<b>📺 게임 화면</b><span>이 창을 TV(확장 모니터)로 옮긴 뒤 한 번 누르면 전체화면이 돼요</span>';
  d.onclick=()=>{FS.userExit=false;FS.enter(true);d.remove()};document.body.appendChild(d)}

/* ---------- 머리줄 버튼 (처음 화면) ---------- */
function drawSoundBtn(){const b=$('#bSound');b.innerHTML=(PREF.sound?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>')+`<span class="lb">${PREF.sound?'소리 켬':'소리 끔'}</span>`;b.setAttribute('aria-label',PREF.sound?'효과음 끄기':'효과음 켜기')}
$('#bRules').onclick=showRules;
$('#bSound').onclick=()=>{PREF.sound=!PREF.sound;savePref();drawSoundBtn();if(PREF.sound){SND.init();SND.play('coin')}BGM.sync()};
$('#bFS').onclick=()=>FS.toggle();
/* 게임 중 키보드: Esc로 열린 창이 없으면 설정을 엽니다 */
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('ingame')&&!topLayer()&&Net.kind!=='display'){e.preventDefault();Net.role==='client'?Setup.openClient():Setup.openInGame()}});

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
  $('#bFS .ic-on').style.display=FS.is()?'none':'';$('#bFS .ic-off').style.display=FS.is()?'':'none';UI.refit()}
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
(function boot(){
  /* 게임 화면(TV) 창: ?display=방코드 로 열리면 공개 화면 전용으로 들어갑니다 */
  const q=new URLSearchParams(location.search),disp=q.get('display');
  if(disp&&/^[A-Z0-9]{4,8}$/i.test(disp)){document.body.classList.add('display');App.home();
    Net.join(disp.toUpperCase(),{name:'게임 화면',emoji:'📺',color:PALETTE[9]},'display',{local:q.get('local')==='1'}).then(()=>NetUI.waiting()).catch(e=>netError(e));return}
  const m=location.hash.match(/room=([A-Z0-9]{4,8})/i),pw=location.hash.match(/[&#]pw=([^&]+)/);
  if(m){history.replaceState(null,'',location.pathname+location.search);App.home();NetUI.open(m[1].toUpperCase(),pw?decodeURIComponent(pw[1]):'');return}
  App.home();
  /* 새로고침했거나 앱이 잠깐 꺼졌다 켜지면 들어가 있던 방으로 자동으로 돌아갑니다 */
  const ns=Net.savedSession();if(ns&&(ns.role==='client'||(hasSave()&&!ns.paused)))Net.rejoin()})();
