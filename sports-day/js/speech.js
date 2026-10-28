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

// 읽는 방법 후보: 안드로이드 크롬은 목소리마다 언어 표기가 달라('ko-KR' / 'ko_KR') 표기가 맞지 않으면 synthesis-failed를 내는 기기가 있음.
// 그래서 목소리의 표기 그대로 → 여러 표기 → 지정 안 함 순서로 바꿔 가며 읽고, 처음 성공한 방법은 이 기기에 기억해 다음부터 먼저 씀
function ttsVariants(){
  const kv = pickKoVoice(), vl = kv ? (kv.lang || '') : '';
  const list = [];
  if(kv){ list.push({ k:'v:' + vl + ':0.95', voice:kv, lang:vl, rate:0.95 }); list.push({ k:'v:' + vl + ':1', voice:kv, lang:vl, rate:1 }); }
  [...(vl ? [vl] : []), 'ko-KR', 'ko_KR', 'ko', ''].forEach(l => list.push({ k:'l:' + l, voice:null, lang:l, rate:1 }));
  const seen = new Set(), out = list.filter(x => !seen.has(x.k) && seen.add(x.k));
  const good = ls.get('udh5_ttsv', '');
  const gi = out.findIndex(x => x.k === good);
  if(gi > 0) out.unshift(out.splice(gi, 1)[0]);
  return out;
}
const variantLabel = x => `${x.voice ? '목소리 ' + x.voice.name + ', ' : '기본 목소리, '}언어 ${x.lang || '지정 안 함'}, 속도 ${x.rate}`;

// 기기 음성으로 읽기. idx: 몇 번째 방법으로 읽을지
function ttsSpeak(text, idx = 0, inGesture = false){
  if(!text) return;
  if(!ttsOK()){ ttsLog('이 브라우저는 음성 읽기를 지원하지 않습니다.'); return; }
  const ss = window.speechSynthesis, vars = ttsVariants();
  const giveUp = why => { ttsLog(why + ' 화면을 한 번 누르면 다시 읽습니다.'); TTS.pending = text; TTS.needTap = true; if(typeof queueRender === 'function') queueRender(); };
  const next = () => { if(idx + 1 < vars.length) setTimeout(() => ttsSpeak(text, idx + 1), 120); else giveUp('모든 방법으로 읽지 못했습니다.'); };
  const run = () => {
    const x = vars[idx]; if(!x){ giveUp('읽을 방법이 없습니다.'); return; }
    let u; try{ u = new SpeechSynthesisUtterance(text); }catch(e){ ttsLog('읽기 준비 실패: ' + (e.message || e)); return; }
    try{ if(x.lang) u.lang = x.lang; }catch(e){}
    u.rate = x.rate; u.pitch = 1; u.volume = 1;
    if(x.voice){ try{ u.voice = x.voice; }catch(e){ next(); return; } }
    let started = false, ended = false;
    u.onstart = () => { started = true; TTS.needTap = false; ls.set('udh5_ttsv', x.k); ttsLog('읽기 시작 (' + variantLabel(x) + ')'); };
    u.onend = () => { ended = true; };
    u.onerror = e => {
      ended = true; const er = (e && e.error) || '알 수 없음';
      if(er === 'interrupted' || er === 'canceled') return;
      ttsLog(`읽기 실패: ${er} (${variantLabel(x)})`);
      if(er === 'not-allowed'){ giveUp('터치가 필요합니다.'); return; }
      if(!started){ if(ls.get('udh5_ttsv', '') === x.k) ls.set('udh5_ttsv', ''); next(); }
    };
    TTS.utts.push(u); if(TTS.utts.length > 8) TTS.utts.shift();   // 읽는 도중에 지워져 소리가 끊기지 않게 붙잡아 둠
    try{ if(ss.paused) ss.resume(); }catch(e){}
    try{ ss.speak(u); }catch(e){ ttsLog('읽기 실패: ' + (e.message || e)); next(); return; }
    // 3초 안에 시작하지 않으면 멈춘 것으로 보고 다음 방법으로
    setTimeout(() => { if(started || ended) return; try{ ss.cancel(); }catch(e){} ttsLog('읽기가 시작되지 않았습니다 (' + variantLabel(x) + ')'); next(); }, 3000);
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
      <div class="item"><span class="name">한국어 목소리 ${ks.length}개<span class="sub">${ks.length ? ks.map(v => esc(v.name) + ' [' + esc(v.lang) + ']' + (v.localService ? '' : '(인터넷)')).join(', ') : (all.length ? `한국어 목소리가 없습니다(전체 ${all.length}개). ${help}` : '목록을 아직 받지 못했습니다. 아래 시험을 눌러 보세요.')}</span></span></div>
      <div class="item"><span class="name">이 기기에서 성공한 읽기 방법<span class="sub">${ls.get('udh5_ttsv','') ? esc(ls.get('udh5_ttsv','')) : '아직 없습니다. 음성 시험을 누르면 여러 방법으로 차례로 읽어 봅니다.'}</span></span></div>
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
    say(`음성 시험입니다. ${teamName('blue')} 홍길동 선수, 준비해 주세요.`, true);
    if(m === 'sr') toast('보이스오버·톡백이 켜져 있으면 읽어 줍니다.');
    return false;
  },
});
