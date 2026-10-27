'use strict';
/* ===================== 음성 안내 (기기 음성 · 화면 낭독기) =====================
   기기마다 읽는 방법을 고름: 자동 / 기기 음성(TTS, 안드로이드·PC·아이폰) / 화면 낭독기(보이스오버·톡백) / 끄기
   자동: 중계 모드 기기는 화면 낭독기, 나머지는 기기 음성
   기기 음성이 시작되지 않으면 목소리를 바꿔 한 번 더 읽고, 그래도 안 되면 다음 터치 때 읽음.
   '음성 확인' 창에서 그 기기의 한국어 음성과 최근 기록(시작·실패 이유)을 볼 수 있음 */
const TTS = { mode: ls.get('udh5_tts', 'auto'), log: [], pending: null, needTap: false, utts: [] };
const TTS_MODES = [['auto', '자동'], ['tts', '기기 음성'], ['sr', '보이스오버·톡백'], ['off', '끄기']];
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const ttsOK = () => 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
function ttsMode(){
  if(TTS.mode !== 'auto') return TTS.mode;
  return (typeof voiceMode === 'function' && voiceMode()) ? 'sr' : 'tts';
}
const ttsModeLabel = m => (TTS_MODES.find(x => x[0] === m) || TTS_MODES[0])[1];
function ttsLog(s){
  const d = new Date(), t = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  TTS.log.unshift(`${t} ${s}`); TTS.log.length = Math.min(TTS.log.length, 10);
  if(typeof drawSheet === 'function') drawSheet();
}
function ttsVoices(){ try{ return ttsOK() ? (speechSynthesis.getVoices() || []) : []; }catch(e){ return []; } }
function koVoices(){ return ttsVoices().filter(v => /^ko([-_]|$)/i.test(v.lang || '') || /korean|한국/i.test(v.name || '')); }
// 기기 안에 있는 한국어 목소리를 먼저 고름(인터넷이 약해도 읽도록)
function pickKoVoice(){ const ks = koVoices(); return ks.find(v => v.localService) || ks[0] || null; }
if(ttsOK()){ try{ speechSynthesis.addEventListener('voiceschanged', () => { if(typeof drawSheet === 'function') drawSheet(); }); }catch(e){} }

// 기기 음성으로 읽기. attempt 0: 한국어 목소리를 골라서, 1: 기기 기본 목소리로
function ttsSpeak(text, attempt = 0, inGesture = false){
  if(!text) return;
  if(!ttsOK()){ ttsLog('이 브라우저는 음성 읽기를 지원하지 않습니다.'); return; }
  const ss = window.speechSynthesis;
  const run = () => {
    let u; try{ u = new SpeechSynthesisUtterance(text); }catch(e){ ttsLog('읽기 준비 실패: ' + (e.message || e)); return; }
    u.lang = 'ko-KR'; u.rate = 0.95; u.pitch = 1; u.volume = 1;
    let v = attempt === 0 ? pickKoVoice() : null;
    if(v){ try{ u.voice = v; }catch(e){ v = null; } }   // 목소리를 못 고르면 기기 기본 목소리로 읽음
    let started = false, ended = false;
    u.onstart = () => { started = true; TTS.needTap = false; ttsLog('읽기 시작' + (v ? ` (${v.name})` : ' (기본 목소리)')); };
    u.onend = () => { ended = true; };
    u.onerror = e => {
      ended = true; const er = (e && e.error) || '알 수 없음';
      if(er === 'interrupted' || er === 'canceled') return;
      ttsLog('읽기 실패: ' + er);
      if(er === 'not-allowed'){ TTS.pending = text; TTS.needTap = true; if(typeof queueRender === 'function') queueRender(); return; }
      if(!started && attempt < 1) setTimeout(() => ttsSpeak(text, attempt + 1), 200);
    };
    TTS.utts.push(u); if(TTS.utts.length > 6) TTS.utts.shift();   // 읽는 도중에 지워져 소리가 끊기지 않게 붙잡아 둠
    try{ if(ss.paused) ss.resume(); }catch(e){}
    try{ ss.speak(u); }catch(e){ ttsLog('읽기 실패: ' + (e.message || e)); return; }
    // 3초 안에 시작하지 않으면 멈춘 것으로 보고 다른 목소리로 한 번 더, 그래도 안 되면 다음 터치 때 읽음
    setTimeout(() => {
      if(started || ended) return;
      try{ ss.cancel(); }catch(e){}
      if(attempt < 1){ ttsLog('읽기가 시작되지 않아 기본 목소리로 다시 읽습니다.'); setTimeout(() => ttsSpeak(text, attempt + 1), 200); }
      else { ttsLog('읽기가 시작되지 않았습니다. 화면을 한 번 누르면 다시 읽습니다.'); TTS.pending = text; TTS.needTap = true; if(typeof queueRender === 'function') queueRender(); }
    }, 3000);
  };
  // 읽던 것이 있을 때만 멈추고 잠깐 뒤에 읽음(멈추기 바로 뒤에 읽으면 새 문장까지 버려지는 기기가 있음). 터치 중이면 바로 읽음
  let busy = false; try{ busy = ss.speaking || ss.pending; }catch(e){}
  if(busy){ try{ ss.cancel(); }catch(e){} if(inGesture) run(); else setTimeout(run, 150); }
  else run();
}

// 화면 낭독기(보이스오버·톡백)가 읽도록 숨은 알림 칸에 넣음. 중계 모드 화면에는 #vlive가 있고, 없으면 따로 만듦
function srSay(text){
  if(!text) return;
  if($('#vlive') && typeof voiceSay === 'function'){ voiceSay(text); return; }
  let el = document.getElementById('srlive');
  if(!el){ el = document.createElement('div'); el.id = 'srlive'; el.className = 'vh'; el.setAttribute('aria-live', 'assertive'); el.setAttribute('aria-atomic', 'true');
    el.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap'; document.body.appendChild(el); }
  el.textContent = ''; setTimeout(() => { el.textContent = text; }, 100);
}

// 모든 음성 안내는 여기로: 기기 설정에 맞춰 읽음
function say(text, inGesture = false){
  if(!text) return;
  const m = ttsMode();
  if(m === 'off') return;
  if(m === 'sr') srSay(text); else ttsSpeak(text, 0, inGesture);
}

// 터치하면: 아이폰은 처음 한 번 소리 없는 읽기로 음성을 켜 두고(아이폰은 터치 안에서 한 번 읽어야 그 뒤 자동으로 읽음), 못 읽은 안내가 있으면 지금 읽음
let ttsWarmed = false;
document.addEventListener('pointerdown', () => {
  if(!ttsOK()) return;
  if(TTS.pending){ const t = TTS.pending; TTS.pending = null; TTS.needTap = false; ttsSpeak(t, 0, true); ttsWarmed = true; return; }
  if(!ttsWarmed && isIOS() && ttsMode() === 'tts'){ ttsWarmed = true; try{ const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }catch(e){} }
}, true);

/* ---------- 음성 확인 창 ---------- */
function ttsSheet(){
  const ks = koVoices(), all = ttsVoices(), m = ttsMode();
  const chips = TTS_MODES.map(([k, l]) => `<button class="chip ${TTS.mode===k?'on':''}" data-a="ttsSet" data-v="${k}" aria-pressed="${TTS.mode===k}">${l}${k==='auto' ? ` (지금: ${ttsModeLabel(m==='auto'?'tts':m)})` : ''}</button>`).join('');
  const help = '안드로이드에서 읽지 않으면 기기 설정에서 텍스트 음성 변환(TTS)을 찾아, 기본 엔진을 Google 음성 엔진으로 바꾸고 한국어 음성을 내려받아 주세요. 삼성 기기는 설정, 일반 또는 접근성 안에 있습니다.';
  return `<h2>음성 안내</h2>
    <p class="sub" style="margin-top:0">안내판의 호출·안내방송 읽기와 중계 모드의 결과 알림을 어떻게 읽을지 이 기기에서 정합니다.</p>
    <div class="chips" role="group" aria-label="읽기 방식">${chips}</div>
    <div class="list" style="margin-top:12px">
      <div class="item"><span class="name">기기 음성 지원<span class="sub">${ttsOK() ? '지원함' : '이 브라우저는 지원하지 않습니다. 크롬이나 사파리로 열어 주세요.'}</span></span></div>
      <div class="item"><span class="name">한국어 목소리 ${ks.length}개<span class="sub">${ks.length ? ks.map(v => esc(v.name) + (v.localService ? '' : '(인터넷)')).join(', ') : (all.length ? `한국어 목소리가 없습니다(전체 ${all.length}개). ${help}` : '목록을 아직 받지 못했습니다. 아래 시험을 눌러 보세요.')}</span></span></div>
      <div class="item"><span class="name">최근 기록<span class="sub">${TTS.log.length ? TTS.log.map(esc).join('<br>') : '아직 없습니다.'}</span></span></div>
    </div>
    <p class="sub">${help}</p>
    <div class="row nowrap" style="margin-top:10px"><button class="btn primary grow" data-a="ttsTest">음성 시험</button><button class="btn grow" data-a="closeSheet">닫기</button></div>`;
}
Object.assign(ACT, {
  ttsSheet: () => { openSheet(ttsSheet); return false; },
  ttsSet: (el, v) => { TTS.mode = TTS_MODES.some(x => x[0]===v) ? v : 'auto'; ls.set('udh5_tts', TTS.mode); drawSheet(); return false; },
  ttsTest: () => {
    const m = ttsMode();
    if(m === 'off'){ toast('음성 안내가 꺼져 있습니다.'); return false; }
    say('음성 시험입니다. 청팀 홍길동 선수, 준비해 주세요.', true);
    if(m === 'sr') toast('보이스오버·톡백이 켜져 있으면 읽어 줍니다.');
    return false;
  },
});
