'use strict';
/* ===================== 음성인식 (입력 화면) =====================
   크롬·엣지에 들어 있는 Web Speech API(구글 음성인식, 무료, 인터넷 필요)로 한국어를 계속 듣고,
   말 한 마디가 끝날 때마다(최종 결과)
   - 한 줄씩: 한 줄로 바로 보냄 (설정에서 '입력 칸에 넣기'로 바꾸면 통역하는 분이 확인하고 Enter)
   - 메모장·회의록: 메모장 맨 끝에 새 줄로 붙임 (앞부분을 고치는 중이면 그 자리를 방해하지 않음)
   인식 중인 말(중간 결과)은 입력 화면 위쪽 띠에만 보이고 보내지 않음.
   크롬은 1분쯤 지나거나 조용하면 인식을 끝내므로, 켜져 있는 동안은 저절로 다시 시작함 */
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
const STT = { prov:'', speechSince:0, lastFinal:'', lastFinalAt:0, on:false, rec:null, interim:'', restartT:0, errs:0, note:'', queue:[], stream:null, ac:null, raf:0, dev:'',
  diag:'', lastErr:'', results:0, restarts:0, gotAudio:false, gotSound:false, loudMs:0, lastTick:0, hint:'', meterT:0, checkT:0 };
// 휴대폰·태블릿: 마이크를 한 번에 한 앱만 쓸 수 있어서, 소리 막대를 열면 구글 음성인식이 소리를 못 받음 → 막대를 열지 않음
const STT_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const STT_ERR = { 'no-speech':'말소리 없음', 'aborted':'중단됨', 'audio-capture':'소리 입력 장치 없음', 'network':'구글 음성 서버 연결 안 됨', 'not-allowed':'마이크 허용 안 됨', 'service-not-allowed':'음성인식 서비스 막힘', 'language-not-supported':'한국어 지원 안 됨', 'bad-grammar':'설정 오류' };
// 음성인식 기능이 있는 것처럼 보이지만 구글 서버에 연결하지 못하는 브라우저
const STT_BAD_BROWSER = (() => { const u = navigator.userAgent; return navigator.brave ? '브레이브' : /Whale\//.test(u) ? '네이버 웨일' : /OPR\//.test(u) ? '오페라' : /SamsungBrowser/.test(u) ? '삼성 인터넷' : /YaBrowser/.test(u) ? '얀덱스' : ''; })();

function sttToggle(){ if(STT.on) sttStop(); else sttStart(); }
function sttStart(){
  if(!SpeechRec){ sttGuide(true); return; }
  if(!TP.code) return;
  STT.on = true; STT.errs = 0; STT.note = ''; STT.interim = '';
  Object.assign(STT, { diag:'켜는 중', lastErr:'', results:0, restarts:0, gotAudio:false, gotSound:false, loudMs:0, hint:'' });
  if(STT_BAD_BROWSER) STT.hint = STT_BAD_BROWSER + ' 브라우저는 음성인식이 되지 않을 수 있어요. 안 되면 크롬이나 엣지에서 열어 주세요.';
  paintStt(); sttRun();
  // 소리 막대는 음성인식이 먼저 마이크를 잡은 뒤에 엶 (마이크를 동시에 열 때 부딪히지 않게). 3초 안에 못 잡으면 그래도 엶
  clearTimeout(STT.meterT); if(!STT_MOBILE) STT.meterT = setTimeout(() => { if(STT.on && !STT.stream) sttMeterStart(); }, 3000);
  clearInterval(STT.checkT); STT.checkT = setInterval(sttCheckStuck, 2000);
}
function sttRun(){
  if(!STT.on) return;
  let rec;
  try{ rec = new SpeechRec(); }catch(e){ sttFail('음성인식을 시작하지 못했어요'); return; }
  rec.lang = 'ko-KR'; rec.continuous = !STT_MOBILE; rec.interimResults = true; rec.maxAlternatives = 1;
  const step = d => { STT.diag = d; paintStt(); };
  rec.onstart = () => step('인식기 켜짐');
  rec.onaudiostart = () => { STT.gotAudio = true; step('마이크 연결됨'); if(!STT_MOBILE && !STT.stream) setTimeout(() => { if(STT.on && !STT.stream) sttMeterStart(); }, 300); };
  rec.onsoundstart = () => { STT.gotSound = true; step('소리 감지'); };
  rec.onspeechstart = () => { STT.gotSound = true; if(!STT.speechSince) STT.speechSince = Date.now(); step('말소리 감지'); };
  rec.onresult = e => {
    STT.results++; STT.loudMs = 0; STT.speechSince = 0; STT.diag = '받아 적는 중';
    if(STT.hint && !STT_BAD_BROWSER) STT.hint = '';
    let interim = '';
    for(let i = e.resultIndex; i < e.results.length; i++){
      const r = e.results[i], t = r[0] ? r[0].transcript : '';
      if(r.isFinal) sttFinal(t); else interim += t;
    }
    STT.interim = interim.trim(); STT.errs = 0; STT.note = '';
    sttProvisional(STT.interim);
    paintStt();
  };
  rec.onerror = e => {
    const er = e && e.error;
    if(er && er !== 'no-speech' && er !== 'aborted'){ STT.lastErr = er; }
    if(er === 'not-allowed' || er === 'service-not-allowed'){ sttFail('마이크를 쓸 수 없어요. 주소창 왼쪽 아이콘 → 마이크 → 허용으로 바꾼 뒤 다시 눌러 주세요'); return; }
    if(er === 'audio-capture'){ sttFail('소리 입력 장치를 찾지 못했어요. "소리 연결 방법"을 확인해 주세요'); return; }
    if(er === 'network'){ STT.errs++; STT.note = '인터넷 연결이 불안정해 다시 시도하는 중'; paintStt(); }
    if(er === 'language-not-supported'){ sttFail('이 브라우저는 한국어 음성인식을 지원하지 않아요'); return; }
    // no-speech(조용함), aborted 는 그냥 다시 시작
  };
  rec.onend = () => {
    if(STT.rec === rec) STT.rec = null;
    if(!STT.on) return;
    STT.restarts++;
    STT.restartT = setTimeout(sttRun, STT.errs ? Math.min(5000, 600 * STT.errs) : 80);
  };
  STT.rec = rec;
  try{ rec.start(); }catch(e){ STT.rec = null; STT.restartT = setTimeout(sttRun, 600); }
}
function sttStop(){
  STT.prov = '';
  STT.on = false; clearTimeout(STT.restartT); clearTimeout(STT.meterT); clearInterval(STT.checkT);
  // stop()은 하던 말을 마저 최종 결과로 넘겨 줌
  if(STT.rec){ try{ STT.rec.stop(); }catch(e){} }
  STT.interim = ''; STT.note = '';
  sttMeterStop(); paintStt();
}
function sttFail(msg){
  STT.on = false; clearTimeout(STT.restartT); clearTimeout(STT.meterT); clearInterval(STT.checkT);
  if(STT.rec){ try{ STT.rec.abort(); }catch(e){} STT.rec = null; }
  STT.interim = ''; sttMeterStop(); paintStt();
  toast(msg);
}

/* 최종 결과 처리 */
function sttFinal(t){
  t = cleanLine(t).replace(/\s{2,}/g, ' ').trim();
  if(!t || !TP.code) return;
  // 같은 말이 3초 안에 또 오면(휴대폰 크롬에서 생기는 되풀이) 한 번만
  if(t === STT.lastFinal && Date.now() - STT.lastFinalAt < 3000) return;
  STT.lastFinal = t; STT.lastFinalAt = Date.now();
  if(TP.mode === 'live') sttToPad(t);
  else if(TS.sttTo === 'input'){
    const inp = $('#tIn');
    inp.value = (inp.value.trim() ? inp.value.replace(/\s*$/, ' ') : '') + t;
  } else appendLine(t);
}
// 메모장 맨 끝을 바꿔 씀: 먼저 써 둔 '인식 중인 말'(STT.prov)이 그대로 끝에 있으면 그 자리를, 없으면 새 줄로
function sttPadTail(text, provisional){
  const pad = $('#tPad'), v = pad.value;
  const atEnd = pad.selectionStart === v.length && pad.selectionEnd === v.length;
  let base = v.length;
  if(STT.prov && v.endsWith(STT.prov)) base = v.length - STT.prov.length;
  const head = v.slice(0, base);
  const add = text ? (head && !/\n$/.test(head) ? '\n' : '') + text : '';
  if(add === v.slice(base)){ STT.prov = provisional ? add : ''; return; }
  pad.setRangeText(add, base, v.length, atEnd ? 'end' : 'preserve');
  if(atEnd) pad.scrollTop = pad.scrollHeight;
  STT.prov = provisional ? add : '';
  TP.dirty = true; kickFlush();
}
function sttToPad(t){
  if(TP.composing){ STT.queue.push(t); return; }   // 한글을 치는 중이면 조합이 끝난 뒤에 붙임
  sttPadTail(t, false);
}
// 메모장·회의록: 인식 중인 말도 바로 메모장 끝에 써 두고(읽는 분이 말하는 도중부터 봄), 확정되면 바꿔 씀
function sttProvisional(t){
  if(TP.mode !== 'live' || TS.sttLive === false || TP.composing) return;
  if(!t && !STT.prov) return;
  sttPadTail(t, true);
}
function sttFlushQueue(){ while(STT.queue.length && !TP.composing) sttToPad(STT.queue.shift()); }

/* 소리 크기 막대 (소리가 들어오는지 확인용. 기본 소리 입력 장치) */
async function sttMeterStart(){
  sttMeterStop();
  if(TS.sttMeter === false || STT_MOBILE) return;
  try{
    const s = await navigator.mediaDevices.getUserMedia({ audio:true });
    if(!STT.on){ s.getTracks().forEach(t => t.stop()); return; }
    STT.stream = s;
    const tr = s.getAudioTracks()[0]; STT.dev = tr && tr.label ? tr.label : '';
    const AC = window.AudioContext || window.webkitAudioContext;
    STT.ac = new AC();
    const src = STT.ac.createMediaStreamSource(s), an = STT.ac.createAnalyser();
    an.fftSize = 512; src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    const tick = () => {
      if(!STT.ac) return;
      an.getByteTimeDomainData(buf);
      let peak = 0; for(let i = 0; i < buf.length; i++){ const d = Math.abs(buf[i] - 128); if(d > peak) peak = d; }
      const now = performance.now(); if(STT.lastTick && peak > 8) STT.loudMs += Math.min(200, now - STT.lastTick); STT.lastTick = now;
      const bar = $('#sttLevel'); if(bar) bar.style.width = Math.min(100, Math.round(peak / 128 * 140)) + '%';
      STT.raf = requestAnimationFrame(tick);
    };
    tick(); paintStt();
  }catch(e){ STT.dev = ''; }
}
function sttMeterStop(){
  cancelAnimationFrame(STT.raf); STT.raf = 0;
  if(STT.stream){ STT.stream.getTracks().forEach(t => t.stop()); STT.stream = null; }
  if(STT.ac){ try{ STT.ac.close(); }catch(e){} STT.ac = null; }
  const bar = $('#sttLevel'); if(bar) bar.style.width = '0';
}

// 소리는 들어오는데 10초 넘게 받아 적은 것이 없으면 원인별 확인 방법을 띄움
function sttCheckStuck(){
  if(!STT.on || STT.results > 0) return;   // 한 번이라도 받아 적었으면 잘 되고 있는 것
  const stuck = STT_MOBILE ? (STT.speechSince && Date.now() - STT.speechSince > 20000) : STT.loudMs >= 10000;
  if(!stuck) return;
  let h;
  if(STT_BAD_BROWSER) h = STT_BAD_BROWSER + ' 브라우저는 음성인식이 되지 않아요. 크롬이나 엣지에서 이 주소를 열어 주세요.';
  else if(STT.lastErr === 'network') h = '구글 음성 서버에 연결되지 않아요. 기관 인터넷에서 막혀 있을 수 있으니 휴대폰 핫스팟으로 바꿔 시험해 보세요.';
  else if(!STT.gotSound) h = '소리 막대는 움직이는데 음성인식이 소리를 받지 못하고 있어요. 설정에서 "소리 막대 보기"를 끄고 음성인식을 껐다 켜 보세요. 그래도 안 되면 chrome://settings/content/microphone 에서 막대와 같은 장치를 골라 주세요.';
  else h = '말소리는 감지되는데 받아 적은 글이 오지 않아요. 인터넷 연결을 확인하거나, ' + (STT_MOBILE ? '다른 앱(통화·녹음·음성 비서)이 마이크를 쓰고 있지 않은지 확인하고 크롬을 다시 열어 주세요.' : '크롬·엣지를 다시 열어 주세요.');
  if(h !== STT.hint){ STT.hint = h; paintStt(); }
}
function paintStt(){
  const b = $('#sttBtn');
  if(b){ b.classList.toggle('rec', STT.on); b.textContent = STT.on ? '■ 인식 끄기' : '🎤 음성인식'; b.setAttribute('aria-pressed', STT.on ? 'true' : 'false'); }
  const bar = $('#tStt'); if(!bar) return;
  bar.hidden = !STT.on;
  if(!STT.on) return;
  const where = TP.mode === 'live' ? '메모장 끝에 붙임' : TS.sttTo === 'input' ? '입력 칸에 넣음' : '한 줄씩 바로 보냄';
  $('#sttState').innerHTML = '● 듣는 중<span class="wide"> · ' + esc(where) + (STT_MOBILE ? '' : STT.dev ? ' · 소리 입력: ' + esc(STT.dev) : '') + '</span>' + (STT.note ? ' · ' + esc(STT.note) : '');
  const mt = bar.querySelector('.meter'); if(mt) mt.hidden = STT_MOBILE || TS.sttMeter === false;
  $('#sttInterim').textContent = STT.interim || '(말을 기다리는 중)';
  $('#sttDiag').textContent = '음성인식 상태: ' + (STT.diag || '-') + ' · 받아 적은 말 ' + STT.results + '번 · 다시 시작 ' + STT.restarts + '번' + (STT.lastErr ? ' · 마지막 오류: ' + (STT_ERR[STT.lastErr] || STT.lastErr) : '');
  const hn = $('#sttHint'); hn.hidden = !STT.hint; hn.textContent = STT.hint;
}

function sttGuide(unsupported){
  openSheet(`<h2 tabindex="-1">음성인식 · 소리 연결 방법</h2>
    ${unsupported ? '<p class="msg">이 브라우저에서는 음성인식이 되지 않아요. PC의 <b>크롬</b>이나 <b>엣지</b>에서 열어 주세요.</p>' : ''}
    <p>크롬·엣지에 들어 있는 구글 음성인식을 씁니다(무료, 인터넷 필요). 처음 켤 때 마이크 허용을 물으면 <b>허용</b>을 누르세요. 위쪽 띠의 <b>소리 막대</b>가 움직이면 소리가 들어오고 있는 것입니다.</p>
    <h3>사람 말을 마이크로 들을 때</h3>
    <p>노트북 마이크나 무선 마이크 수신기를 그대로 쓰면 됩니다. 말하는 사람과 가까울수록, 주변이 조용할수록 정확합니다.</p>
    <h3>영화 소리를 바로 넣을 때 (스피커 앞에 마이크를 두는 것보다 훨씬 정확)</h3>
    <ol>
      <li><b>영화를 이 노트북에서 틀 때</b>: 윈도우 <b>설정 → 시스템 → 소리 → 입력</b>에서 <b>스테레오 믹스</b>를 고릅니다. 목록에 없으면 <b>소리 설정 더 보기 → 녹음</b> 탭에서 빈 곳을 오른쪽 클릭 → <b>사용할 수 없는 장치 표시</b> → 스테레오 믹스를 <b>사용</b>으로 바꿉니다. 그래도 없으면 무료 가상 오디오 케이블 <b>VB-CABLE</b>(vb-audio.com)을 설치하고, 출력은 CABLE Input, 입력은 CABLE Output으로 정합니다.</li>
      <li><b>영화를 다른 PC에서 틀 때</b>: 그 PC의 이어폰 단자와 이 노트북의 마이크 단자를 3.5mm 오디오 케이블로 잇거나, USB 오디오 입력 장치를 씁니다.</li>
      <li>크롬 주소창에 <b>chrome://settings/content/microphone</b> 을 열어 같은 장치를 고릅니다(엣지는 edge://settings/content/microphone).</li>
    </ol>
    <h3>알아 두기</h3>
    <ul>
      <li>배경음악·효과음이 크거나 여러 사람이 겹쳐 말하면 틀리게 받아 적습니다. 인식된 줄은 누르거나(한 줄씩) 메모장에서 바로 고칠 수 있습니다.</li>
      <li>넷플릭스처럼 자막이 있는 작품은 음성인식보다 '넷플릭스 자막 보내기'가 훨씬 정확합니다.</li>
      <li>한 줄씩 방식에서 인식된 말을 바로 보내지 않고 확인한 뒤 보내려면 설정에서 '입력 칸에 넣기'를 고르세요.</li>
      <li>단축키: <b>F2</b>로 음성인식을 켜고 끕니다.</li>
    </ul>
    <div class="row"><div class="sp"></div><button class="btn primary" data-close>알겠어요</button></div>`);
}
