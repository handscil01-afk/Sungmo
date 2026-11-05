'use strict';
/* ===================== 무전 (음성 · 문자) =====================
   가을운동회 점수판의 무전기와 같은 방식: 큰 단추를 누르고 있는 동안 마이크 소리를 0.15초씩 잘라
   μ-law(전화 음질, 8kHz)로 줄여 Realtime Database 로 보내고, 듣는 기기는 이어 붙여 재생함.
   먼저 누른 한 사람만 말할 수 있음(radio/lock). 시작할 때 로저 비프음, 끝날 때 '뚜-뚜'.
   문자 무전(msgs)은 자주 쓰는 문구 단추와 입력칸으로 보내고, 받으면 안내 창·진동·(켜면) 읽어 주기 */
const MAX_TALK_MS = 60000, CHUNK_SEC = 0.15, MIC_WARM_MS = 20000, RATE = 8000;
const JITTER = 0.18, MAX_LAG = 0.7;
const RADIO = { lock:null, listen: ls.get('radioListen', true), tts: ls.get('tts', false), subs:[], msgs:[], msgInit:false, ready:false };
const TALK = { phase:null, tid:null, pressed:false, timer:0, maxTimer:0, data:null, cut:false };
const radioOK = () => ME.master || ME.staff;

function muEnc(s){
  let x = Math.max(-1, Math.min(1, s)) * 32635;
  const sign = x < 0 ? 0x80 : 0; if(x < 0) x = -x;
  x += 132; let exp = 7;
  for(let m = 0x4000; (x & m) === 0 && exp > 0; m >>= 1) exp--;
  return ~(sign | (exp << 4) | ((x >> (exp + 3)) & 0x0F)) & 0xFF;
}
const MU = new Float32Array(256);
for(let i = 0; i < 256; i++){ const u = ~i & 0xFF, e = (u >> 4) & 7; let x = (((u & 0x0F) << 3) + 132) << e; x -= 132; MU[i] = ((u & 0x80) ? -x : x) / 32768; }
const b64 = bytes => { let s = ''; for(let i = 0; i < bytes.length; i += 4096) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 4096)); return btoa(s); };
const unb64 = str => { const s = atob(str), a = new Uint8Array(s.length); for(let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };

/* ---------- 마이크 ---------- */
const MIC = { stream:null, idle:0, stop:null, gate:Infinity };
function getMic(){
  clearTimeout(MIC.idle);
  if(MIC.stream && MIC.stream.getAudioTracks().some(t => t.readyState === 'live')) return Promise.resolve(MIC.stream);
  return navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true, channelCount:1 } }).then(st => (MIC.stream = st));
}
function micRelease(){
  clearTimeout(MIC.idle);
  MIC.idle = setTimeout(() => { if(MIC.stream && !MIC.stop){ MIC.stream.getTracks().forEach(t => t.stop()); MIC.stream = null; } }, MIC_WARM_MS);
}
function micStart(stream, onChunk, onFirst){
  const ctx = SND.ensure(); if(!ctx) throw new Error('no audio');
  const src = ctx.createMediaStreamSource(stream), node = ctx.createScriptProcessor(1024, 1, 1), sink = ctx.createGain();
  sink.gain.value = 0;
  const ratio = ctx.sampleRate / RATE, size = Math.round(RATE * CHUNK_SEC);
  let phase = 0, acc = 0, n = 0, buf = new Uint8Array(size), bi = 0;
  MIC.gate = Infinity;
  node.onaudioprocess = e => {
    const x = e.inputBuffer.getChannelData(0);
    if(onFirst){ const f = onFirst; onFirst = null; f(); }
    const t0 = ctx.currentTime - x.length / ctx.sampleRate;
    const from = MIC.gate === Infinity ? x.length : Math.max(0, Math.min(x.length, Math.ceil((MIC.gate - t0) * ctx.sampleRate)));
    for(let k = from; k < x.length; k++){
      acc += x[k]; n++; phase += 1;
      if(phase >= ratio){ phase -= ratio; buf[bi++] = muEnc(acc / n * 1.5); acc = 0; n = 0;
        if(bi === size){ onChunk(buf); buf = new Uint8Array(size); bi = 0; } }
    }
  };
  src.connect(node); node.connect(sink); sink.connect(ctx.destination);
  MIC.stop = () => {
    if(bi) onChunk(buf.slice(0, bi));
    try{ node.disconnect(); src.disconnect(); sink.disconnect(); }catch(e){}
    MIC.stop = null; MIC.gate = Infinity;
    micRelease();
  };
}

/* ---------- 받는 쪽 ---------- */
function mkPlayer(){
  return { t:0, startAt:0,
    push(bytes){
      const c = SND.ctx; if(!c || c.state !== 'running' || !bytes.length) return;
      const out = c.sampleRate, n = bytes.length, m = Math.floor(n * out / RATE);
      const buf = c.createBuffer(1, m, out), ch = buf.getChannelData(0);
      for(let i = 0; i < m; i++){ const p = i * RATE / out, j = Math.floor(p), f = p - j; const a = MU[bytes[j]], b = MU[bytes[Math.min(j + 1, n - 1)]]; ch[i] = a + (b - a) * f; }
      const s = c.createBufferSource(); s.buffer = buf; s.connect(c.destination);
      const nowT = c.currentTime;
      if(this.t > nowT + MAX_LAG && this.t > this.startAt + MAX_LAG) return;     // 너무 밀리면 버리고 따라잡음
      const t = this.t < nowT + 0.02 ? Math.max(nowT + JITTER, this.startAt) : this.t;
      s.start(t); this.t = t + buf.duration;
    } };
}
const RX = { tid:null, player:null, pend:{} };
const shouldHear = () => radioOK() && RADIO.listen && (ROLE === 'host' || ROLE === 'staff');
function onLock(lock){
  const prev = RADIO.lock; RADIO.lock = lock || null;
  const other = lock && lock.uid !== DB.uid;
  if(other && RX.tid !== lock.tid){
    RX.tid = lock.tid; RX.player = null;
    if(shouldHear() && SND.ready()){
      const p = mkPlayer(); const c = SND.ctx; const d = SND.roger(c.currentTime + 0.02); p.startAt = c.currentTime + 0.02 + d + 0.03; RX.player = p;
      (RX.pend[lock.tid] || []).forEach(x => { try{ p.push(unb64(x)); }catch(e){} });
    }
    delete RX.pend[lock.tid];
    if(shouldHear()) vib(40);
  }
  if(!other && RX.tid){
    const p = RX.player; RX.tid = null; RX.player = null;
    if(p && SND.ctx) SND.endTone(Math.max(p.t, SND.ctx.currentTime) + 0.05);
  }
  // 말하는 중에 내 무전 잡기가 없어지거나 남에게 넘어감 = 진행자가 끊음
  if(TALK.phase === 'live' && TALK.locked && (!lock || lock.uid !== DB.uid)) talkCut();
  radioRender();
}
function onChunk(c){
  if(!c || !c.d || c.u === DB.uid) return;
  if(c.t === RX.tid){ if(RX.player){ try{ RX.player.push(unb64(c.d)); }catch(e){} } return; }
  const P = (RX.pend[c.t] ||= []); if(P.length < 40) P.push(c.d);
  const ks = Object.keys(RX.pend); if(ks.length > 6) delete RX.pend[ks[0]];
}

/* ---------- 말하기 ---------- */
async function pttDown(){
  if(TALK.phase || !radioOK()) return;
  SND.unlock();
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ toast('이 브라우저에서는 마이크를 쓸 수 없습니다. 크롬이나 사파리로 열어 주세요.'); return; }
  const myTid = DB.uid.slice(0, 6) + now().toString(36);
  Object.assign(TALK, { phase:'wait', pressed:true, tid:myTid, cut:false, locked:false, data:{ uid:DB.uid, name:myName(), tid:myTid } });
  radioRender();
  const alive = () => TALK.tid === myTid && !TALK.cut;
  const fail = (msg, busy) => {
    if(TALK.tid !== myTid) return;
    if(msg) toast(msg);
    if(busy){ SND.busy(); vib([200, 100, 200]); } else vib([60, 40, 60]);
    TALK.phase = null; TALK.locked = false; radioRender();
  };
  const micP = getMic().then(st => ({ st }), err => ({ err }));
  const res = await DB.acquire(TALK.data);
  if(!res.ok){
    micRelease();
    if(res.error) return fail(isDenied(res.error) ? '무전 권한이 없습니다. 진행자에게 직원 승인을 받아 주세요.' : '무전 서버에 연결하지 못했습니다.');
    return fail(`${res.lock && res.lock.name || '다른 사람'} 님이 말하는 중입니다.`, true);
  }
  if(!alive()){ await DB.release(); return; }
  TALK.locked = true;
  const giveUp = async () => {
    TALK.locked = false;
    if(MIC.stop) MIC.stop(); else micRelease();
    await DB.release();
    if(TALK.tid === myTid){ TALK.phase = null; radioRender(); }
  };
  if(!TALK.pressed) return giveUp();
  try{
    const m = await micP; if(m.err) throw m.err;
    if(!alive()) return;
    if(!TALK.pressed) return giveUp();
    await new Promise(r => { const to = setTimeout(r, 1500); micStart(m.st, bytes => { DB.send(myTid, b64(bytes)); }, () => { clearTimeout(to); r(); }); });
  }catch(e){
    console.error(e); await giveUp();
    return fail(e && e.name === 'NotAllowedError' ? '마이크 권한이 꺼져 있습니다. 브라우저(또는 휴대폰) 설정에서 마이크를 허용해 주세요.' : '마이크를 켜지 못했습니다.');
  }
  if(!alive()) return;
  if(!TALK.pressed) return giveUp();
  // 준비 끝: 로저 비프음을 울리고 그 소리가 끝난 순간부터 목소리를 보냄
  TALK.phase = 'live';
  const d = SND.roger();
  MIC.gate = (SND.ctx ? SND.ctx.currentTime : 0) + d + 0.02;
  vib(40);
  TALK.timer = setInterval(() => DB.refresh(TALK.data), 3000);
  TALK.maxTimer = setTimeout(() => { toast('한 번에 60초까지 말할 수 있습니다.'); pttUp(); }, MAX_TALK_MS);
  radioRender();
}
async function pttUp(immediate){
  TALK.pressed = false;
  if(TALK.phase !== 'live') return;
  const tid = TALK.tid;
  clearInterval(TALK.timer); clearTimeout(TALK.maxTimer);
  TALK.locked = false; TALK.phase = 'end'; radioRender();
  if(!immediate) await new Promise(r => setTimeout(r, 200));
  MIC.stop && MIC.stop();
  TALK.phase = null; radioRender();
  SND.endTone(); vib([80, 60, 80]);
  await DB.release();
  setTimeout(() => DB.dropTalk(tid), 10000);
}
function talkCut(){
  if(!TALK.phase) return;
  clearInterval(TALK.timer); clearTimeout(TALK.maxTimer);
  TALK.cut = true; TALK.pressed = false; TALK.locked = false;
  if(MIC.stop) MIC.stop(); else micRelease();
  TALK.phase = null; SND.endTone(); toast('진행자가 무전을 끊었습니다.'); radioRender();
}
function talkAbort(){ if(TALK.phase === 'live'){ TALK.pressed = false; pttUp(true); } else TALK.pressed = false; }
document.addEventListener('visibilitychange', () => { if(document.hidden) talkAbort(); });
window.addEventListener('pagehide', talkAbort);

/* ---------- 문자 무전 ---------- */
const QUICK = ['확인 부탁합니다', '정답 확인했습니다', '문제 다시 전달이 필요해요', '통역 지원 필요', '잠깐 멈춰 주세요', '진행해도 됩니다'];
async function sendMsg(t){
  t = String(t || '').trim().slice(0, 200); if(!t) return false;
  if(!radioOK()){ toast('직원 승인을 받은 뒤에 무전을 쓸 수 있습니다.'); return false; }
  try{ await DB.push('msgs', { uid:DB.uid, name:myName(), role:ME.master && ROLE === 'host' ? 'host' : 'staff', zone:zoneText(), text:t, at:srvNow() }); return true; }
  catch(e){ toast(isDenied(e) ? '무전을 보낼 권한이 없습니다.' : '무전을 보내지 못했습니다.'); return false; }
}
function onMsgs(list){
  const fresh = RADIO.msgInit ? list.filter(m => !RADIO.msgs.some(x => x.id === m.id)) : [];
  RADIO.msgs = list; RADIO.msgInit = true;
  fresh.forEach(m => {
    if(m.uid === DB.uid || !shouldHear()) return;
    toast(`${m.name || '직원'}: ${m.text}`, 'radio'); SND.ping(); vib([60, 60, 60]);
    if(RADIO.tts && 'speechSynthesis' in window){ try{ const u = new SpeechSynthesisUtterance(`${m.name || ''}. ${m.text}`); u.lang = 'ko-KR'; u.rate = 1.05; speechSynthesis.speak(u); }catch(e){} }
  });
  radioRender();
}

/* ---------- 연결 (진행자·직원이 된 뒤에) ---------- */
function radioSubscribe(){
  radioUnsub();
  if(!radioOK() || !DB) return;
  RADIO.subs.push(DB.onLock(onLock, () => {}));
  RADIO.subs.push(DB.onStream(onChunk, () => {}));
  RADIO.msgInit = false;
  RADIO.subs.push(DB.onLast('msgs', 50, onMsgs, () => {}));
  RADIO.ready = true;
}
function radioUnsub(){ RADIO.subs.forEach(f => { try{ f(); }catch(e){} }); RADIO.subs = []; RADIO.ready = false; }

/* ---------- 그리기 ---------- */
function radioPanelHTML(id){
  return `<div class="card-h">무전 <span class="hint" data-rstate></span><div class="sp"></div>
      <label class="chk"><input type="checkbox" data-rlisten> 음성 듣기</label>
      <label class="chk"><input type="checkbox" data-rtts> 문자 읽어 주기</label></div>
    <div class="ptt-row"><button class="ptt" data-ptt aria-label="누르고 있는 동안 말하기"><span class="ptt-ic">🎙</span><span class="ptt-t">누르고 말하기</span></button><div class="ptt-info" data-rinfo></div></div>
    <div class="radio-log" aria-live="polite" data-rlog></div>
    <div class="quick">${QUICK.map(t => `<button class="btn sm" data-act="rq" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <form class="radio-form"><input type="text" id="rin-${id}" maxlength="200" placeholder="메시지 (예: 2줄 3번 확인 부탁)" aria-label="문자 무전"><button class="btn primary">보내기</button></form>
    ${ME.master && ROLE === 'host' ? '<div class="row" style="margin-top:8px"><button class="btn sm danger" data-act="radioCut">지금 무전 끊기</button></div>' : ''}`;
}
function radioRender(){
  const lock = RADIO.lock, mine = TALK.phase;
  const other = lock && lock.uid !== (DB && DB.uid);
  $$('[data-rstate]').forEach(x => x.textContent = !radioOK() ? '· 직원 승인 뒤에 쓸 수 있습니다' : (DB && DB.st.connected ? '· 연결됨' : '· 연결 중'));
  $$('[data-rlisten]').forEach(x => x.checked = !!RADIO.listen);
  $$('[data-rtts]').forEach(x => x.checked = !!RADIO.tts);
  $$('[data-ptt]').forEach(b => {
    b.classList.toggle('live', mine === 'live'); b.classList.toggle('wait', mine === 'wait'); b.classList.toggle('busy', !!other && !mine);
    b.disabled = !radioOK();
    b.querySelector('.ptt-t').textContent = mine === 'live' ? '말하는 중… 손을 떼면 끝' : mine === 'wait' ? '연결 중…' : other ? `${lock.name || '다른 사람'} 말하는 중` : '누르고 말하기';
  });
  $$('[data-rinfo]').forEach(x => x.textContent = other ? `🔊 ${lock.name || '다른 사람'} 님 말하는 중` : mine === 'live' ? '다른 사람들에게 들리고 있습니다' : '버튼을 누르고 있는 동안 말이 전달됩니다. 한 번에 한 사람만 말할 수 있어요.');
  const html = RADIO.msgs.length ? RADIO.msgs.slice(-40).map(m => `<div class="rmsg ${m.uid === (DB && DB.uid) ? 'me' : ''}"><time>${new Date(m.at || 0).toTimeString().slice(0, 5)}</time><span class="who ${m.role === 'host' ? 'host' : ''}">${esc(m.name || '직원')}${m.zone ? ` <small>(${esc(m.zone)})</small>` : ''}</span>${esc(m.text)}</div>`).join('') : '<div class="rempty">아직 문자 무전이 없습니다.</div>';
  $$('[data-rlog]').forEach(x => { const stick = x.scrollTop + x.clientHeight >= x.scrollHeight - 20; if(x.dataset.h !== html){ x.dataset.h = html; x.innerHTML = html; } if(stick) x.scrollTop = x.scrollHeight; });
  const bar = $('#talkBar');
  if(bar){ const show = !!other && shouldHear(); bar.hidden = !show; if(show) bar.textContent = `🔊 ${lock.name || '다른 사람'} 님 무전 중`; }
}
// 누르고 있는 동안 말하기 (손가락·마우스·스페이스 없이 버튼만)
document.addEventListener('pointerdown', e => { const b = e.target.closest('[data-ptt]'); if(!b || b.disabled) return; e.preventDefault(); try{ b.setPointerCapture(e.pointerId); }catch(x){} pttDown(); });
['pointerup', 'pointercancel'].forEach(ev => document.addEventListener(ev, () => { if(TALK.pressed) pttUp(); }));
document.addEventListener('contextmenu', e => { if(e.target.closest('[data-ptt]')) e.preventDefault(); });
document.addEventListener('submit', async e => { const f = e.target.closest('.radio-form'); if(!f) return; e.preventDefault(); const inp = f.querySelector('input'); if(await sendMsg(inp.value)) inp.value = ''; });
document.addEventListener('change', e => {
  if(e.target.matches('[data-rlisten]')){ RADIO.listen = e.target.checked; ls.set('radioListen', RADIO.listen); radioRender(); }
  if(e.target.matches('[data-rtts]')){ RADIO.tts = e.target.checked; ls.set('tts', RADIO.tts); if(RADIO.tts && 'speechSynthesis' in window){ try{ const u = new SpeechSynthesisUtterance('문자 무전을 소리로 읽어 드립니다'); u.lang = 'ko-KR'; speechSynthesis.speak(u); }catch(x){} } radioRender(); }
});
