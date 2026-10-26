'use strict';
/* ===================== 절전 화면 =====================
   정한 시간 동안 아무것도 누르지 않으면 화면 전체를 까맣게 덮음(OLED 전기 절약). 화면 켜짐 유지(Wake Lock)는 그대로 둠.
   - 까만 화면을 누르면 바로 켜지고, 그 첫 번째 누름은 아래 단추로 전달되지 않음(눌림·뒤따르는 클릭 모두 막음)
   - 송신 중·남이 말하는 중이면 어두운 글씨로 알려 줌 / 안내 창(시간 알림·문자·긴급 호출)이 뜨면 자동으로 켜짐
   - 안내판·결과 보고서·미리 보기·초시계가 돌아가는 중·글자를 입력하는 중에는 꺼지지 않음
   - 중계 모드(보이스오버): 눈에만 보이는 덮개. 누름을 막지 않고 보이스오버에도 숨김(aria-hidden) */
const PS = { sec: +ls.get('udh5_ps', 60), last: now(), asleep:false, el:null, swallow:0, sig:'' };
if(![0, 30, 60, 180].includes(PS.sec)) PS.sec = 60;
const PS_CHOICES = [[30, '30초'], [60, '1분'], [180, '3분'], [0, '끄기']];

// 메뉴 창에 들어갈 설정 (이 기기에만 저장)
function psMenu(){
  return `<div class="item psitem"><span class="name">절전 화면<span class="sub">아무것도 누르지 않으면 정한 시간 뒤에 화면을 까맣게 해 전기를 아낍니다. 화면을 누르면 바로 켜집니다.</span></span></div>
    <div class="chips pschips" role="group" aria-label="절전 화면 시간">${PS_CHOICES.map(([s, l]) => `<button class="chip ${PS.sec===s?'on':''}" data-a="psSet" data-v="${s}" aria-pressed="${PS.sec===s}">${l}</button>`).join('')}</div>`;
}
function psSetup(){
  if(PS.el) return;
  const el = document.createElement('div');
  el.id = 'psave';
  el.innerHTML = '<div class="psmain">절전 모드</div><div class="pssub">화면을 누르면 켜집니다</div><div class="psstat" id="psstat"></div>';
  document.body.appendChild(el); PS.el = el;
}
// 지금 꺼져도 되는 상황인가
function psCanSleep(){
  if(!store || !UI.me || D.fatal) return false;
  if(myRole().role === 'board' || UI.report || UI.preview) return false;
  if(UI.watch && UI.watch.running) return false;                    // 초시계가 돌아가는 중에는 화면이 보여야 함
  if(typeof typing === 'function' && typing()) return false;        // 글자를 입력하는 중
  if(typeof DRAG !== 'undefined' && DRAG.active) return false;
  if(TALK.kind && !TALK.toggle) return false;                       // 누르고 말하는 중
  return true;
}
function psSleep(){
  psSetup();
  PS.asleep = true;
  const v = typeof voiceMode === 'function' && voiceMode();
  PS.el.classList.toggle('v', v);                                   // 중계 모드: 누름을 막지 않음
  if(v) PS.el.setAttribute('aria-hidden', 'true'); else PS.el.removeAttribute('aria-hidden');
  PS.el.classList.add('on'); PS.sig = '';
  psRefresh();
}
function psWake(){
  PS.last = now();
  if(!PS.asleep) return;
  PS.asleep = false;
  if(PS.el) PS.el.classList.remove('on');
}
// 까만 화면에 어두운 글씨로 보이는 상태: 송신 중 · 말하는 사람
function psRefresh(){
  if(!PS.asleep || !PS.el) return;
  let h = '';
  if(TALK.kind && (TALK.phase === 'wait' || TALK.phase === 'live')) h += `<div class="tx">${TALK.phase === 'wait' ? '연결 중' : (TALK.kind === 'cast' ? '방송 중' : '송신 중')}</div>`;
  const L = RADIO.lock.radio;
  if(L && store && L.uid !== store.uid && RADIO.on && radioRoleOK()) h += `<div class="rx">${esc(L.name || '')} 말하는 중</div>`;
  if(h !== PS.sig){ PS.sig = h; const st = document.getElementById('psstat'); if(st) st.innerHTML = h; }
}

// 활동 감지와 깨우기: window 캡처 단계에서 가장 먼저 받아, 깨우는 누름이 아래 단추에 닿지 않게 막음
const PS_MEDIA_KEYS = ['MediaPlayPause', 'HeadsetHook', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaTrackNext', 'MediaTrackPrevious'];
function psActive(e){
  // 이어폰 버튼(미디어 키)은 화면을 깨우지도, 막지도 않음: 까만 채로 무전을 켜고 끌 수 있어야 함
  if(e.type === 'keydown' && PS_MEDIA_KEYS.includes(e.key)) return;
  if(PS.asleep){
    const v = PS.el && PS.el.classList.contains('v');
    psWake();
    if(!v){
      PS.swallow = now() + 450;
      e.stopImmediatePropagation(); e.stopPropagation(); if(e.cancelable) e.preventDefault();
      return;
    }
  } else if(e.type === 'pointerdown') PS.swallow = 0;     // 깨운 뒤 곧바로 다시 누르면 그 누름은 정상으로 전달
  PS.last = now();
}
['pointerdown', 'keydown'].forEach(t => window.addEventListener(t, psActive, true));
['pointermove', 'touchstart', 'wheel', 'scroll'].forEach(t => window.addEventListener(t, () => { if(!PS.asleep) PS.last = now(); }, { capture:true, passive:true }));
// 깨운 뒤 따라오는 클릭·눌림 해제는 아래 단추로 보내지 않음
['click', 'dblclick', 'mouseup', 'touchend', 'pointerup'].forEach(t => window.addEventListener(t, e => {
  if(now() < PS.swallow){ e.stopImmediatePropagation(); e.stopPropagation(); if(e.cancelable) e.preventDefault(); }
}, true));

setInterval(() => {
  if(PS.asleep || !PS.sec) return;
  if(!psCanSleep()){ PS.last = now(); return; }
  if(now() - PS.last >= PS.sec * 1000) psSleep();
}, 1000);

Object.assign(ACT, {
  psSet: (el, v) => {
    PS.sec = [0, 30, 60, 180].includes(+v) ? +v : 60; ls.set('udh5_ps', PS.sec); PS.last = now();
    toast(PS.sec ? `${PS_CHOICES.find(c => c[0] === PS.sec)[1]} 동안 누르지 않으면 화면을 까맣게 합니다.` : '절전 화면을 껐습니다.');
    drawSheet(); return false;
  },
});
