'use strict';
/* ===================== 모니터 고르기 · 프로젝터 창 =====================
   PC 크롬·엣지의 '창 관리'(Window Management) 기능으로 연결된 모니터 목록을 읽어,
   고른 모니터에 프로젝터 창을 열고 그 모니터에 전체 화면으로 띄움 (PPT 슬라이드 쇼처럼).
   처음 한 번 브라우저가 '창 관리' 권한을 물어봄. 기능이 없으면 지금 창을 전체 화면으로만 바꿈 */
const SCR = { list:[], details:null, err:'' };
const scrSupported = () => 'getScreenDetails' in window;
async function scrPermGranted(){
  try{ const p = await navigator.permissions.query({ name:'window-management' }); return p.state === 'granted'; }catch(e){ return false; }
}
async function loadScreens(){
  if(!scrSupported()) return [];
  try{
    const d = await window.getScreenDetails();
    if(!SCR.details){ d.addEventListener('screenschange', () => { SCR.list = Array.from(d.screens); schedule(); }); }
    SCR.details = d; SCR.list = Array.from(d.screens); SCR.err = '';
  }catch(e){ SCR.err = e && e.name || 'error'; SCR.list = []; }
  return SCR.list;
}
const scrKey = s => [s.label || '', s.left, s.top, s.width, s.height].join('|');
function scrName(s, i){
  const tags = [];
  if(s.isPrimary) tags.push('주 모니터');
  if(SCR.details && SCR.details.currentScreen === s) tags.push('지금 이 창');
  return `${s.label || '모니터 ' + (i + 1)} · ${s.width}×${s.height}${tags.length ? ' (' + tags.join(', ') + ')' : ''}`;
}
// 프로젝터로 보이는 모니터: 주 모니터가 아니고 지금 창이 있는 모니터도 아닌 것
function guessProjector(){
  const L = SCR.list; if(!L.length) return null;
  const want = ls.get('scrTarget', '');
  return L.find(s => scrKey(s) === want) || L.find(s => !s.isPrimary && SCR.details && SCR.details.currentScreen !== s) || L.find(s => !s.isPrimary) || null;
}
function fsActive(){ return !!(document.fullscreenElement || document.webkitFullscreenElement); }
// 고른 모니터에 이 창을 전체 화면으로 (클릭·키 누름 안에서 불러야 함)
function fullOn(s){
  const d = document.documentElement;
  try{
    const p = d.requestFullscreen ? d.requestFullscreen(s ? { screen:s, navigationUI:'hide' } : { navigationUI:'hide' }) : (d.webkitRequestFullscreen && d.webkitRequestFullscreen());
    if(p && p.catch) p.catch(() => toast('전체 화면으로 바꾸지 못했습니다. 화면을 한 번 더 눌러 주세요.'));
  }catch(e){}
  if(s) ls.set('scrTarget', scrKey(s));
}

/* 진행자 도구: '프로젝터 창 열기' → 모니터 고르기 → 그 모니터에 창을 열기 */
async function openScreenFlow(){
  const url = location.href.split('#')[0] + '#screen';
  if(!scrSupported()){ openScreenWin(url, null); return; }
  const list = await loadScreens();
  if(!list.length){ toast(SCR.err === 'NotAllowedError' ? '창 관리 권한이 꺼져 있어 지금 창 옆에 엽니다. 주소창 왼쪽 자물쇠에서 창 관리를 허용하면 모니터를 고를 수 있어요.' : '모니터 목록을 읽지 못해 새 창으로 엽니다.'); openScreenWin(url, null); return; }
  const guess = guessProjector();
  openSheet(`<h3>어느 모니터에 띄울까요?</h3><p class="muted small">고른 모니터에 프로젝터 창이 열립니다. 열린 창을 한 번 누르거나 리모컨 버튼을 한 번 누르면 그 모니터에 전체 화면이 됩니다.</p>
    <div class="scr-list">${list.map((s, i) => `<button class="btn scr ${s === guess ? 'primary' : ''}" data-i="${i}">${esc(scrName(s, i))}</button>`).join('')}</div>
    <div class="row" style="margin-top:12px"><button class="btn" data-plain>그냥 새 창으로 열기</button><div class="sp"></div><button class="btn" data-close>닫기</button></div>`, e => {
    const b = e.target.closest('[data-i]');
    if(b){ const s = list[+b.dataset.i]; ls.set('scrTarget', scrKey(s)); closeSheet(); openScreenWin(url, s); }
    else if(e.target.closest('[data-plain]')){ closeSheet(); openScreenWin(url, null); }
  });
}
function openScreenWin(url, s){
  const f = s ? `popup,left=${s.availLeft},top=${s.availTop},width=${s.availWidth},height=${s.availHeight}` : 'popup,width=1280,height=720';
  let w = null; try{ w = window.open(url, 'gb1screen', f); }catch(e){}
  if(!w){ toast('새 창이 막혔습니다. 주소창 오른쪽의 팝업 차단을 풀고 다시 눌러 주세요.'); return; }
  try{ w.focus(); }catch(e){}
  toast(s ? '프로젝터 창을 열었습니다. 그 창을 한 번 누르면 전체 화면이 됩니다.' : '새 창을 프로젝터 화면으로 옮긴 뒤 한 번 누르면 전체 화면이 됩니다.');
}

/* 프로젝터 창: 처음 화면에 모니터 목록을 보여 주고, 누르면 그 모니터에 전체 화면 */
async function screenStartDraw(){
  const box = $('#ssList'); if(!box) return;
  const granted = scrSupported() && await scrPermGranted();
  if(granted && !SCR.list.length) await loadScreens();
  const guess = guessProjector();
  let h = '';
  if(SCR.list.length > 0){
    h += SCR.list.map((s, i) => `<button class="btn scr ${s === guess ? 'primary' : ''}" data-act="ssGo" data-i="${i}">${esc(scrName(s, i))}</button>`).join('');
    h += `<button class="btn scr" data-act="ssGo" data-i="-1">지금 이 창 그대로 전체 화면</button>`;
  }else{
    h += `<button class="btn scr primary" data-act="ssGo" data-i="-1">이 창을 전체 화면으로</button>`;
    if(scrSupported()) h += `<button class="btn scr" data-act="ssLoad">모니터 목록 불러오기 (다른 모니터 고르기)</button>`;
  }
  box.innerHTML = h;
}
function screenGo(i){
  SND.unlock();
  const s = i >= 0 ? SCR.list[i] : null;
  $('#screenStart').hidden = true;
  fullOn(s || (i === -1 ? null : guessProjector()));
  keepAwake();
  // 브라우저는 화면을 한 번 눌러야 소리를 낼 수 있어서, 이때 켜져 있던 음악을 다시 맞춤
  if(typeof musicFollow === 'function'){ if(SFX.music) musicStop(true); musicFollow(); }
}
async function keepAwake(){ try{ if(navigator.wakeLock) await navigator.wakeLock.request('screen'); }catch(e){} }
document.addEventListener('visibilitychange', () => { if(ROLE === 'screen' && document.visibilityState === 'visible') keepAwake(); });
