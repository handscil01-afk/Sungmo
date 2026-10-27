'use strict';
/* ===================== 무전기 · 음성 안내방송 =====================
   누르고 있는 동안 마이크 소리를 0.15초씩 잘라 μ-law(전화 음질)로 줄여 보내고, 받는 쪽은 이어 붙여 재생함.
   무전(radio): 8kHz, 마스터·감독·심판끼리 · 방송(cast): 16kHz, 안내판 스피커로만 */
const RATE = { radio:8000, cast:16000 };
const MAX_TALK_MS = 60000, CHUNK_SEC = 0.15, MIC_WARM_MS = 20000;
const JITTER = 0.18, MAX_LAG = 0.7;   // 받는 쪽: 처음 0.18초 모아 재생, 0.7초 넘게 밀리면 밀린 조각을 버리고 따라잡음
const RADIO = { on: ls.get('udh5_radio_on', true), lock:{ radio:null, cast:null }, listen:{ radio:null, cast:null },
  rtMaster:null, rtMasters:null, rtRoles:null, err:'' };
// toggle: 한 번 눌러 켠 말하기(다시 누를 때까지 계속) · locked: 내 무전 잡기가 서버에 있음 · cut: 마스터가 끊음 · liveAt: 송신을 시작한 시각
const TALK = { kind:null, phase:null, tid:null, seq:0, pressed:false, timer:0, maxTimer:0, warnTimer:0, data:null, toggle:false, locked:false, cut:false, liveAt:0 };
const vib = p => { try{ if(navigator.vibrate) navigator.vibrate(p); }catch(e){} };
const radioRoleOK = () => D.amMaster || hasDuty(myRole());
const castOK = () => D.amMaster || !!myRole().cast;
// Realtime Database 규칙이 보는 역할 이름: 감독 > 심판(심판·기록 도우미·계시원) > 안내판
const rtRoleOf = r => r.coach ? 'coach' : (r.events.length || r.helpers.length || r.timers.length || r.monitor) ? 'referee' : r.board ? 'board' : '';

/* ---------- μ-law 변환 ---------- */
function muEnc(s){
  let x = Math.max(-1, Math.min(1, s)) * 32635;
  const sign = x < 0 ? 0x80 : 0; if(x < 0) x = -x;
  x += 132; let exp = 7;
  for(let m = 0x4000; (x & m) === 0 && exp > 0; m >>= 1) exp--;
  return ~(sign | (exp << 4) | ((x >> (exp + 3)) & 0x0F)) & 0xFF;
}
const MU = new Float32Array(256);
for(let i = 0; i < 256; i++){ const u = ~i & 0xFF, e = (u >> 4) & 7; let x = (((u & 0x0F) << 3) + 132) << e; x -= 132; MU[i] = ((u & 0x80) ? -x : x) / 32768; }
const b64 = bytes => { let s = ''; for(let i = 0; i < bytes.length; i += 4096) s += String.fromCharCode.apply(null, bytes.subarray(i, i+4096)); return btoa(s); };
const unb64 = str => { const s = atob(str), a = new Uint8Array(s.length); for(let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };

/* ---------- 마이크 ---------- */
/* ---------- 무전 설정 (이 기기에만 저장): 마이크 고르기 · 이어폰 버튼 ---------- */
// mode: 'hold'(누르고 있는 동안 말하기) · 'toggle'(한 번 눌러 켜고 다시 눌러 끄기). 정하지 않았으면 중계 모드 기기는 toggle, 나머지는 hold
const RCFG = { mic:'auto', btn:false, mode:null, ...ls.get('udh5_radio_cfg', {}) };
const saveRcfg = () => ls.set('udh5_radio_cfg', RCFG);
const radioMode = () => (RCFG.mode==='hold' || RCFG.mode==='toggle') ? RCFG.mode : (typeof voiceMode==='function' && voiceMode() ? 'toggle' : 'hold');
const MIC_BUILTIN_RE = /built-in|내장|iphone|internal|speakerphone|handset|bottom|microphone 1|기본/i;
const MIC_EXTERNAL_RE = /bluetooth|블루투스|airpods|buds|headset|hands-free|헤드셋/i;
const MIC_BASE = { echoCancellation:true, noiseSuppression:true, autoGainControl:true, channelCount:1 };
async function micDevices(){
  try{ return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind==='audioinput'); }catch(e){ return []; }
}
// 설정에 따라 쓸 마이크의 deviceId (null이면 브라우저 기본 마이크)
async function resolveMicId(){
  const c = RCFG.mic;
  if(!c || c==='auto') return null;
  if(c==='builtin'){
    const d = (await micDevices()).find(x => x.label && MIC_BUILTIN_RE.test(x.label) && !MIC_EXTERNAL_RE.test(x.label));
    return d ? d.deviceId : null;
  }
  return c;
}
// 고른 마이크로 열고, 못 찾으면 기본 마이크로 대신함
async function openMicStream(){
  const md = navigator.mediaDevices, id = await resolveMicId();
  if(!id) return md.getUserMedia({ audio: MIC_BASE });
  try{ return await md.getUserMedia({ audio:{ ...MIC_BASE, deviceId:{ exact:id } } }); }
  catch(err){
    if(err && (err.name==='OverconstrainedError' || err.name==='NotFoundError')){ toast('고른 마이크를 찾지 못해 기본 마이크를 씁니다.'); return md.getUserMedia({ audio: MIC_BASE }); }
    throw err;
  }
}

// 마이크는 말을 마친 뒤 20초 동안 켜 둠: 이어서 말할 때 마이크를 다시 여느라 늦어지지 않게
const MIC = { stream:null, idle:0, stop:null, gate:Infinity };
function getMic(){
  clearTimeout(MIC.idle);
  if(MIC.stream && MIC.stream.getAudioTracks().some(t => t.readyState==='live')) return Promise.resolve(MIC.stream);
  return openMicStream().then(st => (MIC.stream = st));
}
// 설정을 바꾸면 켜 둔 마이크를 닫아서 다음 말하기부터 새 마이크를 쓰게 함
function micDrop(){
  clearTimeout(MIC.idle);
  if(MIC.stream && !MIC.stop && !TALK.kind){ MIC.stream.getTracks().forEach(t => t.stop()); MIC.stream = null; }
}
function micRelease(){
  clearTimeout(MIC.idle);
  MIC.idle = setTimeout(() => { if(MIC.stream && !MIC.stop){ MIC.stream.getTracks().forEach(t => t.stop()); MIC.stream = null; } }, MIC_WARM_MS);
}
// MIC.gate(AudioContext 시각) 이전에 들어온 소리는 버림: 로저 비프음이 끝난 순간부터 보내려고
function micStart(stream, rate, onChunk, onFirst){
  const ctx = SND.ensure(); if(!ctx) throw new Error('no audio');
  const src = ctx.createMediaStreamSource(stream), node = ctx.createScriptProcessor(1024, 1, 1), sink = ctx.createGain();
  sink.gain.value = 0;
  const ratio = ctx.sampleRate / rate, size = Math.round(rate * CHUNK_SEC);
  let phase = 0, acc = 0, n = 0, buf = new Uint8Array(size), bi = 0;
  MIC.gate = Infinity;
  node.onaudioprocess = e => {
    const x = e.inputBuffer.getChannelData(0);
    if(onFirst){ const f = onFirst; onFirst = null; f(); }   // 마이크 소리가 실제로 들어오기 시작함
    const t0 = ctx.currentTime - x.length / ctx.sampleRate;
    const from = MIC.gate===Infinity ? x.length : Math.max(0, Math.min(x.length, Math.ceil((MIC.gate - t0) * ctx.sampleRate)));
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

/* ---------- 재생 ---------- */
function mkPlayer(rate){
  return { t:0, rate, startAt:0,
    push(bytes){
      const c = SND.ctx; if(!c || c.state!=='running' || !bytes.length) return;
      const out = c.sampleRate, n = bytes.length, m = Math.floor(n * out / rate);
      const buf = c.createBuffer(1, m, out), ch = buf.getChannelData(0);
      for(let i = 0; i < m; i++){ const p = i * rate / out, j = Math.floor(p), f = p - j; const a = MU[bytes[j]], b = MU[bytes[Math.min(j+1, n-1)]]; ch[i] = a + (b - a) * f; }
      const s = c.createBufferSource(); s.buffer = buf; s.connect(c.destination);
      const nowT = c.currentTime;
      // 끊겼다 다시 오면 잠깐 모았다가 재생, 너무 밀렸으면(차임벨 대기 중 제외) 이 조각을 버리고 따라잡음
      if(this.t > nowT + MAX_LAG && this.t > this.startAt + MAX_LAG) return;
      const t = this.t < nowT + 0.02 ? Math.max(nowT + JITTER, this.startAt) : this.t;
      s.start(t); this.t = t + buf.duration;
    } };
}
function stopListen(kind){ RADIO.listen[kind] = null; }
// 누가 말하는지(무전 잡기) 알기 전에 온 음성 조각은 버리지 않고 잠깐 모아 둠
const PEND = { radio:{ t:null, list:[] }, cast:{ t:null, list:[] } };
function onChunk(kind, c){
  if(!c || c.u===store.uid || !c.d) return;
  const L = RADIO.listen[kind];
  if(!L || c.t!==L.tid){
    const P = PEND[kind]; if(P.t!==c.t){ P.t = c.t; P.list = []; }
    if(P.list.length < 40) P.list.push(c.d);
    return;
  }
  if(kind==='radio' && !shouldPlay('radio')) return;
  try{ L.player.push(unb64(c.d)); }catch(e){}
}
function shouldPlay(kind){ return kind==='cast' ? boardOn() : (radioRoleOK() && RADIO.on && TALK.kind!=='radio'); }
function onLockChange(kind, lock){
  const prev = RADIO.lock[kind];
  RADIO.lock[kind] = lock;
  // 말하는 중인데 내 무전 잡기가 사라졌거나 남의 것이 됨: 마스터가 끊었거나, 연결이 오래 끊겨 자리를 뺏긴 것
  if(TALK.kind===kind && TALK.locked && !TALK.cut && (TALK.phase==='wait' || TALK.phase==='live') && (!lock || lock.uid!==store.uid)) talkCut(kind);
  const other = lock && lock.uid!==store.uid;
  if(other && shouldPlay(kind) && (!RADIO.listen[kind] || RADIO.listen[kind].tid!==lock.tid)){
    stopListen(kind);
    const player = mkPlayer(RATE[kind]);
    if(kind==='cast'){
      // 방송 앞에 차임벨: 울리는 동안 들어온 목소리는 모아 두었다가 차임벨이 끝나면 재생
      const cfg = boardCfg();
      if(cfg.sound && SND.ready()){ const d = cfg.chime ? SND.chime() : 0; player.startAt = SND.ctx.currentTime + d + 0.3; }
      try{ speechSynthesis.cancel(); }catch(e){}
    } else if(SND.ready()){
      // 무전: 다른 사람이 말을 시작하면 로저 비프음을 먼저 들려주고, 그 뒤에 목소리
      const d = SND.roger(); player.startAt = SND.ctx.currentTime + d + 0.05;
    }
    RADIO.listen[kind] = { tid:lock.tid, player };
    const P = PEND[kind];
    if(P.t===lock.tid){ P.list.forEach(d => { try{ player.push(unb64(d)); }catch(e){} }); }
    P.t = null; P.list = [];
  }
  if(!lock && RADIO.listen[kind]){
    const L = RADIO.listen[kind];
    // 남이 말을 마침: 받은 소리를 다 들려준 뒤(player.t) 끝 신호음 '뚜-뚜'
    if(kind==='radio' && prev && prev.uid!==store.uid && SND.ready() && shouldPlay('radio')){ const c = SND.ctx; SND.endTone(Math.max(c.currentTime + 0.05, L.player.t + 0.05)); }
    setTimeout(() => { if(RADIO.listen[kind]===L) stopListen(kind); }, 5000);
  }
  radioRender();
  if(kind==='cast'){ queueRender(); if(!lock && typeof runFx==='function') setTimeout(runFx, 1500); }
}

/* ---------- 구독 · 역할 옮겨 두기 ---------- */
const radioSubs = { radio:null, cast:null, sradio:null, scast:null, master:null, roles:null, masters:null };
let radioRetryAt = 0;
function radioInit(){
  if(!store || !UI.me || D.fatal) return;
  getRT().then(rt => {
    if(radioRoleOK()){
      if(!radioSubs.radio && now() > radioRetryAt){
        radioSubs.radio = rt.onLock('radio', l => onLockChange('radio', l), () => { radioSubs.radio = null; radioRetryAt = now()+8000; RADIO.lock.radio = null; radioRender(); });
      }
      if(!radioSubs.sradio && now() > radioRetryAt) radioSubs.sradio = rt.onStream('radio', c => onChunk('radio', c), () => { radioSubs.sradio = null; radioRetryAt = now()+8000; });
    } else {
      if(radioSubs.radio){ radioSubs.radio(); radioSubs.radio = null; RADIO.lock.radio = null; stopListen('radio'); }
      if(radioSubs.sradio){ radioSubs.sradio(); radioSubs.sradio = null; }
    }
    // 방송 음성은 안내판만 받음
    if(boardOn() && !radioSubs.scast) radioSubs.scast = rt.onStream('cast', c => onChunk('cast', c), () => { radioSubs.scast = null; });
    if(!boardOn() && radioSubs.scast){ radioSubs.scast(); radioSubs.scast = null; }
    if(!radioSubs.cast) radioSubs.cast = rt.onLock('cast', l => onLockChange('cast', l), () => { radioSubs.cast = null; });
    if(!radioSubs.roles) radioSubs.roles = rt.onRoles(v => { RADIO.rtRoles = v; radioRetryAt = 0; rtSyncSoon(); radioInit(); radioRender(); });
    if(!radioSubs.master) radioSubs.master = rt.onMaster(store.uid, v => { RADIO.rtMaster = v; radioRetryAt = 0; rtSyncSoon(); radioInit(); radioRender(); });
    if(D.amMaster && RADIO.rtMaster && !radioSubs.masters) radioSubs.masters = rt.onMasters(v => { RADIO.rtMasters = v; rtSyncSoon(); });
    if(!D.amMaster && radioSubs.masters){ radioSubs.masters(); radioSubs.masters = null; RADIO.rtMasters = null; }
    radioRender();
  }).catch(e => { console.error(e); RADIO.err = '무전기를 불러오지 못했습니다.'; radioRender(); });
}
let rtSyncTimer = 0;
function rtSyncSoon(){ clearTimeout(rtSyncTimer); rtSyncTimer = setTimeout(rtSync, 700); }
// 마스터 기기가 Firestore의 역할·마스터 목록을 Realtime Database에도 똑같이 맞춰 둠
function rtSync(){
  if(!RT || !D.amMaster || !RADIO.rtMaster || !D.loaded.roles || RADIO.rtRoles==null) return;
  const want = {};
  Object.entries(D.roles).forEach(([id, raw]) => { const r = normRole(raw), role = rtRoleOf(r); if(role) want[id] = { role, cast:r.cast }; });
  const have = RADIO.rtRoles || {};
  Object.keys(want).forEach(id => { const h = have[id]; if(!h || h.role!==want[id].role || !!h.cast!==want[id].cast) RT.setRole(id, want[id]).catch(()=>{}); });
  Object.keys(have).forEach(id => { if(!want[id]) RT.setRole(id, null).catch(()=>{}); });
  if(RADIO.rtMasters && D.loaded.masters){
    Object.keys(D.masters).forEach(id => { if(!RADIO.rtMasters[id]) RT.setMaster(id, true).catch(()=>{}); });
    Object.keys(RADIO.rtMasters).forEach(id => { if(!D.masters[id] && id!==store.uid) RT.setMaster(id, null).catch(()=>{}); });
  }
}
// 마스터 비밀번호로 Realtime Database의 마스터 권한도 확인 (확인 뒤 비밀번호는 지움)
async function rtMasterLogin(pw){
  const rt = await getRT().catch(() => null); if(!rt) return false;
  // 콘솔에서 숫자로만 된 비밀번호를 넣으면 숫자로 저장되므로 숫자로도 한 번 더 확인
  for(const v of /^\d+$/.test(pw) ? [pw, Number(pw)] : [pw]){
    try{ await rt.setMaster(store.uid, v); await rt.setMaster(store.uid, true); return true; }catch(e){}
  }
  return false;
}
async function rtMasterLogout(){ try{ const rt = await getRT(); await rt.setMaster(store.uid, null); }catch(e){} }
function radioReady(){
  if(!RT) return false;
  if(D.amMaster) return !!RADIO.rtMaster;
  const h = (RADIO.rtRoles||{})[store.uid], me = myRole();
  return !!h && h.role===rtRoleOf(me) && !!h.cast===!!me.cast;
}

// 소리를 켠 채 켜져 있는 안내판 수 (마스터 기기에서만 알 수 있음)
function boardListeners(){
  return D.devices.filter(d => d.seenAt && now()-d.seenAt < ONLINE_MS && d.audio===true && deviceRole(d.id).board).length;
}

/* ---------- 누르고 말하기 ---------- */
function talkTimersClear(){ clearInterval(TALK.timer); clearTimeout(TALK.maxTimer); clearTimeout(TALK.warnTimer); }
// 말하기가 끝날 때(어떤 이유로든) 이 기기에서 나는 소리와 진동: 낮아지는 '뚜-뚜'
function talkEndFx(){ SND.endTone(); vib([80,60,80]); }
async function pttDown(kind, opts){
  if(TALK.kind) return;
  if(kind==='radio' ? !radioRoleOK() : !castOK()) return;
  SND.unlock();
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ toast('이 브라우저에서는 마이크를 쓸 수 없습니다. 크롬이나 사파리로 열어 주세요.'); return; }
  const myTid = store.uid.slice(0,6) + now().toString(36);
  TALK.kind = kind; TALK.phase = 'wait'; TALK.pressed = true; TALK.toggle = !!(opts && opts.toggle); TALK.tid = myTid; TALK.seq = 0;
  TALK.locked = false; TALK.cut = false; TALK.liveAt = 0;
  TALK.data = { uid:store.uid, name:UI.me, tid:TALK.tid };
  radioRender();
  // 이 말하기가 아직 살아 있는지: 마스터가 끊었거나 다른 말하기로 넘어갔으면 더 하지 않음
  const alive = () => TALK.tid===myTid && TALK.kind===kind && !TALK.cut;
  const fail = (msg, busy) => {
    if(TALK.tid!==myTid || TALK.cut) return;
    if(msg) toast(msg);
    if(busy){ SND.busy(); vib([200,100,200,100,200]); } else vib([60,40,60]);
    TALK.kind = null; TALK.phase = null; TALK.toggle = false; TALK.locked = false; radioRender();
  };
  // 마이크 켜기와 무전 잡기를 동시에 시작해서 '삑'까지 걸리는 시간을 줄임
  const micP = getMic().then(st => ({ st }), err => ({ err }));
  if(kind==='cast' && D.amMaster && boardListeners()===0) toast('소리를 켠 안내판이 없습니다. 안내판 화면을 한 번 눌러 소리를 켜 주세요.');
  let rt; try{ rt = await getRT(); }catch(e){ micRelease(); return fail('무전기에 연결하지 못했습니다.'); }
  const res = await rt.acquire(kind, TALK.data);
  if(!res.ok){
    micRelease();
    if(res.error) return fail(radioReady() ? '무전기 서버에 연결하지 못했습니다.' : (D.amMaster ? '무전기 권한을 먼저 확인해 주세요(잠금 버튼).' : '무전기 권한을 준비하는 중입니다. 마스터 기기가 켜져 있는지 확인해 주세요.'));
    return fail(`${res.lock && res.lock.name || '다른 사람'} 님이 ${kind==='cast' ? '방송' : '말하는'} 중입니다.`, true);
  }
  if(TALK.tid!==myTid) { await rt.release(kind); return; }
  TALK.locked = true;
  const giveUp = async () => {
    if(TALK.tid!==myTid || TALK.cut) return;            // 마스터가 끊었으면 이미 정리됨 (남의 잠금을 지우지 않게 release 하지 않음)
    TALK.locked = false;
    if(MIC.stop) MIC.stop(); else micRelease();
    await rt.release(kind);
    if(TALK.tid===myTid){ TALK.kind = null; TALK.phase = null; TALK.toggle = false; radioRender(); }
  };
  if(!alive()) return;
  if(!TALK.pressed) return giveUp();
  try{
    const m = await micP; if(m.err) throw m.err;
    if(!alive()) return;
    if(!TALK.pressed) return giveUp();
    const tid = TALK.tid;
    // 마이크 소리가 실제로 들어오기 시작할 때까지 기다림 (최대 1.5초)
    await new Promise(res => { const to = setTimeout(res, 1500); micStart(m.st, RATE[kind], bytes => { rt.send(kind, tid, TALK.seq++, b64(bytes)); }, () => { clearTimeout(to); res(); }); });
  }catch(e){
    console.error(e); await giveUp();
    return fail(e && e.name==='NotAllowedError' ? '마이크 권한이 꺼져 있습니다. 브라우저(또는 휴대폰) 설정에서 마이크를 허용해 주세요.' : '마이크를 켜지 못했습니다.');
  }
  if(!alive()) return;
  if(!TALK.pressed) return giveUp();
  // 보낼 준비가 끝남: 로저 비프음(roger.wav)을 울리고, 그 소리가 끝나는 순간부터 목소리를 보냄
  TALK.phase = 'live'; TALK.liveAt = now();
  const d = SND.roger();
  MIC.gate = (SND.ctx ? SND.ctx.currentTime : 0) + d + 0.02;
  vib(40);
  TALK.timer = setInterval(() => rt.refresh(kind, TALK.data), 3000);
  TALK.warnTimer = setTimeout(() => SND.warn(), MAX_TALK_MS - 10000);       // 50초: 곧 끝난다는 신호
  TALK.maxTimer = setTimeout(() => { toast('한 번에 60초까지 말할 수 있습니다.'); pttUp(); }, MAX_TALK_MS);
  radioRender();
  if(typeof voiceToast==='function') voiceToast('송신을 시작합니다.');
}
// immediate: 앱을 떠나는 중이라 마지막 0.2초를 기다리지 않고 바로 끝냄
async function pttUp(immediate){
  TALK.pressed = false;
  if(!TALK.kind || TALK.phase!=='live') return;   // 연결 중이면 연결이 끝난 뒤 알아서 정리됨
  const kind = TALK.kind, tid = TALK.tid;
  talkTimersClear();
  TALK.locked = false;
  // 손을 뗀 순간까지 한 말이 마이크 처리 중에 잘리지 않도록 0.2초 더 받은 뒤 끝냄
  TALK.phase = 'end'; radioRender();
  if(!immediate) await new Promise(r => setTimeout(r, 200));
  MIC.stop && MIC.stop();
  TALK.kind = null; TALK.phase = null; TALK.toggle = false; radioRender();
  talkEndFx();
  if(typeof voiceToast==='function') voiceToast('송신을 끝냈습니다.');
  const rt = await getRT();
  await rt.release(kind);
  setTimeout(() => rt.dropTalk(kind, tid), 10000);
}
// 마스터가 내 송신을 끊음 (또는 내 무전 잡기를 남이 가져감): 마이크를 바로 닫고, 잠금은 건드리지 않음
function talkCut(kind){
  if(!TALK.kind) return;
  const tid = TALK.tid;
  talkTimersClear();            // 3초마다 잠금을 갱신하는 타이머를 먼저 멈춤 (끊긴 잠금을 다시 만들지 않게)
  TALK.cut = true; TALK.pressed = false; TALK.locked = false;
  if(MIC.stop) MIC.stop(); else micRelease();
  TALK.kind = null; TALK.phase = null; TALK.toggle = false;
  talkEndFx();
  toast('마스터가 송신을 끊었습니다.');
  radioRender();
  getRT().then(rt => setTimeout(() => rt.dropTalk(kind, tid), 3000)).catch(()=>{});
}
// 앱을 떠나거나(다른 앱·화면 끔) 소리가 끊기면 송신을 끝냄
function talkAbort(){
  if(!TALK.kind) return;
  TALK.pressed = false;
  if(TALK.phase==='live') pttUp(true);
}
document.addEventListener('visibilitychange', () => { if(document.visibilityState==='hidden' || document.hidden) talkAbort(); });
window.addEventListener('pagehide', talkAbort);
document.addEventListener('freeze', talkAbort);

/* ---------- 송신 중 띠 (어느 화면에서든 보임) ---------- */
const TX = { timer:0 };
function txbarRender(){
  const bar = document.getElementById('txbar'); if(!bar) return;
  const on = !!TALK.kind && (TALK.phase==='wait' || TALK.phase==='live');
  document.body.classList.toggle('transmitting', on);
  if(!on){ bar.hidden = true; clearInterval(TX.timer); TX.timer = 0; return; }
  const label = TALK.kind==='cast' ? '방송 중' : '송신 중';
  let txt;
  if(TALK.phase==='wait') txt = '연결 중';
  else { const sec = Math.max(0, Math.floor((now() - TALK.liveAt) / 1000)); txt = `${label} ${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`; }
  const hint = TALK.phase==='wait' ? '' : (TALK.toggle ? '다시 누르면 끝납니다' : '손을 떼면 끝납니다');
  const h = `<b>${txt}</b>${hint ? `<small>${hint}</small>` : ''}`;
  if(bar.innerHTML!==h) bar.innerHTML = h;
  bar.hidden = false;
  if(!TX.timer) TX.timer = setInterval(txbarRender, 500);
}

/* ---------- 화면: 머리줄의 작은 무전 버튼 → 가운데에 뜨는 무전 창 ----------
   창 안의 탭: 🎙 무전 · 📢 방송(권한이 있을 때) · 💬 문자. 설정은 창 위에 따로 뜨는 작은 창(rsbg)
   중계 모드(보이스오버)에서는 그림 문자를 모두 빼고 글자만 보임 */
const WK = { open:false, shown:false, opener:null, tab: ls.get('udh5_wktab', 'radio') };
const PTT = { pu:0 };                      // 마지막으로 큰 단추에서 손을 뗀 시각 (보이스오버는 포인터 이벤트 없이 클릭만 보냄)
const wkTabs = () => { const ok = !!store && !!UI.me && !D.fatal && !UI.preview && !UI.report;
  return [ok && radioRoleOK() && ['radio','🎙','무전'], ok && castOK() && ['cast','📢','방송'], ok && can.staff() && ['msg','💬','문자']].filter(Boolean); };
// 머리줄에 넣는 버튼 (상태는 radioRender가 바로바로 바꿈)
function radioHeadBtn(){ return wkTabs().length ? `<button class="hbtn wkbtn" id="wkbtn" data-a="wkOpen" aria-label="무전기·방송·문자"><span class="ic">🎙</span></button>` : ''; }
function radioSetup(){
  const box = $('#radio');
  box.innerHTML = `<div class="rxchips"></div>
    <div class="wkbg" id="wkbg"><div class="wk" role="dialog" aria-modal="true" aria-label="무전기">
      <div class="wktop"><div class="seg wktabs" id="wktabs"></div><button class="wkgear" id="wkgear" data-a="rsOpen">설정</button><button class="wkx" id="wkx" data-a="wkClose" aria-label="닫기">✕</button></div>
      <div class="wkptt" id="wkptt">
        <div class="wkstat" id="wkstat"></div>
        <button class="wkbig" id="wkbig" data-kind="radio"><span class="ic"></span><span class="lb">누르고 말하기</span><span class="hint"></span></button>
        <div class="wkfoot" id="wkfoot"></div>
      </div>
      <div class="wkmsg" id="wkmsg" tabindex="-1" aria-label="문자"></div>
    </div></div>
    <div class="rsbg" id="rsbg"><div class="rsm" role="dialog" aria-modal="true" aria-labelledby="rsTitle">
      <h2 id="rsTitle" tabindex="-1">무전 설정</h2>
      <div class="rsscroll" id="wkset"></div>
      <button class="btn wide rsclose" data-a="rsClose">닫기</button>
    </div></div>`;
  const b = $('#wkbig');
  // 누르고 있는 동안 말하기(hold): 누르면 시작, 손을 떼면 끝 / 한 번 눌러 켜고 끄기(toggle): 누를 때마다 시작·끝
  b.addEventListener('pointerdown', e => {
    e.preventDefault();
    if(TALK.kind){ if(TALK.toggle) pttUp(); return; }
    if(radioMode()==='toggle') pttDown(b.dataset.kind, { toggle:true });
    else { try{ b.setPointerCapture(e.pointerId); }catch(x){} pttDown(b.dataset.kind); }
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(t => b.addEventListener(t, () => {
    if(t!=='lostpointercapture') PTT.pu = now();
    if(TALK.toggle) return;                // 한 번 눌러 켠 말하기는 손을 뗄 때 끝내지 않음
    if(TALK.kind===b.dataset.kind || TALK.pressed) pttUp();
  }));
  // 보이스오버·키보드로 누르면 포인터 이벤트 없이 클릭만 옴: 방금 포인터로 눌렀다면 이미 처리했으므로 무시
  b.addEventListener('click', () => {
    if(now() - PTT.pu < 700 || radioMode()!=='toggle') return;
    if(TALK.kind){ if(TALK.toggle) pttUp(); } else pttDown(b.dataset.kind, { toggle:true });
  });
  b.addEventListener('contextmenu', e => e.preventDefault());
  $('#wkbg').addEventListener('click', e => { if(e.target.id==='wkbg' && !TALK.kind){ WK.open = false; radioRender(); } });
  $('#rsbg').addEventListener('click', e => { if(e.target.id==='rsbg') ACT.rsClose(); });
}
document.addEventListener('keydown', e => {
  if(e.key!=='Escape') return;
  if(RS.open){ ACT.rsClose(); radioRender(); } else if(WK.open && !TALK.kind){ WK.open = false; radioRender(); }
});
// 문자 탭은 누를 때만 다시 그림 (입력 중인 글자가 지워지지 않게)
function wkMsgDraw(){ const m = $('#wkmsg'); if(m && WK.open && WK.tab==='msg') m.innerHTML = msgBody(); }
function radioRender(){
  const box = $('#radio'); if(!box) return;
  if(!box.firstChild) radioSetup();
  const V = typeof voiceMode==='function' && voiceMode(), S = x => V ? vstrip(x) : x;
  const tabs = wkTabs();
  if(!tabs.length) WK.open = false;
  if(tabs.length && !tabs.some(t => t[0]===WK.tab)) WK.tab = tabs[0][0];
  const ok = tabs.length > 0, L = RADIO.lock.radio, C = RADIO.lock.cast;
  const rx = L && L.uid!==store.uid && RADIO.on, castRx = C && C.uid!==store.uid;
  // 머리줄 버튼
  const hb = $('#wkbtn');
  if(hb){
    const live = TALK.phase==='live' || TALK.phase==='end';
    hb.className = 'hbtn wkbtn' + (live ? ' live' : rx ? ' rx' : (ok && !radioReady() && radioRoleOK()) ? ' dim' : '');
    hb.querySelector('.ic').textContent = live ? '🔴' : rx ? '🔊' : '🎙';
  }
  // 말하는 중에는 설정 창을 닫음 (마이크 시험도 멈춤)
  if(RS.open && (TALK.kind || !WK.open)){ RS.open = false; }
  // 창
  const wkOpened = WK.open && !WK.shown, wkClosed = !WK.open && WK.shown;
  $('#wkbg').classList.toggle('open', WK.open);
  if(WK.open){
    const tb = $('#wktabs'), th = tabs.map(([k,i,l]) => `<button class="${WK.tab===k?'on':''}" data-a="wkTab" data-v="${k}" ${TALK.kind?'disabled':''}>${V?'':`<b>${i}</b> `}${l}</button>`).join('');
    if(tb.innerHTML!==th) tb.innerHTML = th;
    const isPtt = WK.tab!=='msg';
    $('#wkptt').style.display = isPtt ? '' : 'none'; $('#wkmsg').style.display = isPtt ? 'none' : '';
    const gear = $('#wkgear'); gear.style.visibility = isPtt ? '' : 'hidden'; gear.disabled = !!TALK.kind;
    const wx = $('#wkx'); const xt = V ? '닫기' : '✕'; if(wx.textContent!==xt) wx.textContent = xt; wx.disabled = !!TALK.kind;
    if(isPtt){
      const kind = WK.tab, b = $('#wkbig'), lock = RADIO.lock[kind];
      if(!TALK.kind) b.dataset.kind = kind;
      const mine = TALK.kind===kind, busy = lock && lock.uid!==store.uid, tg = radioMode()==='toggle', what = kind==='cast' ? '방송' : '무전';
      let cls = 'wkbig ' + kind, ic = kind==='cast' ? '📢' : '🎙', lb, hint, aria;
      if(tg){ lb = kind==='cast' ? '눌러서 방송하기' : '눌러서 말하기'; hint = '한 번 누르면 켜지고 다시 누르면 꺼집니다'; aria = `${what} 시작`; }
      else { lb = kind==='cast' ? '누르고 방송하기' : '누르고 말하기'; hint = '누르고 있는 동안만 보냅니다'; aria = `누르고 ${kind==='cast' ? '방송하기' : '말하기'}`; }
      if(mine && TALK.phase==='live'){ cls += ' live'; lb = kind==='cast' ? '방송 중' : '말하세요'; hint = TALK.toggle ? '다시 누르면 끝납니다' : '손을 떼면 끝납니다'; aria = TALK.toggle ? `${what} 끝내기` : `${what} 중, 손을 떼면 끝납니다`; }
      else if(mine && TALK.phase==='end'){ cls += ' live'; lb = '끝내는 중'; hint = ''; aria = '끝내는 중'; }
      else if(mine){ cls += ' wait'; ic = '⏳'; lb = '연결 중…'; hint = '삑삑 소리가 나면 말하세요'; aria = '연결 중'; }
      else if(busy){ cls += kind==='radio' ? ' rx' : ' busy'; ic = kind==='radio' ? '🔊' : '🔒'; lb = `${lock.name||''}`; hint = kind==='radio' ? '말하는 중 · 끝나면 누를 수 있습니다' : '방송 중'; aria = `${lock.name||'다른 사람'} 님이 ${kind==='cast' ? '방송' : '말하는'} 중`; }
      else if(TALK.kind || !radioReady()) cls += ' dim';
      b.className = cls; b.querySelector('.ic').textContent = V ? '' : ic; b.querySelector('.lb').textContent = lb; b.querySelector('.hint').textContent = hint;
      b.setAttribute('aria-label', aria);
      let st;
      if(RT && !RT.st.connected) st = '<span class="bad">● 무전기 연결 끊김</span>';
      else if(!radioReady()) st = D.amMaster ? '<span class="bad">🔒 무전기 권한 확인이 필요합니다</span>' : '<span class="bad">무전기 권한을 준비하는 중입니다</span>';
      else if(mine && TALK.phase==='live' && kind==='cast' && D.amMaster){ const nb = boardListeners(); st = nb ? `<span class="ok">● 안내판 ${nb}대에 방송 중</span>` : '<span class="bad">⚠ 소리를 켠 안내판이 없습니다</span>'; }
      else st = kind==='cast' ? '<span class="ok">● 안내판 스피커로만 나갑니다</span>' : '<span class="ok">● 진행요원 모두에게 들립니다</span>';
      // 마스터는 남이 말하는 중일 때 그 송신을 끊을 수 있음 (이름 옆 '송신 끊기')
      const stEl = $('#wkstat');
      stEl.classList.toggle('m', !!D.amMaster);
      if(busy && D.amMaster) st = `<span class="who">${esc(lock.name||'다른 사람')} 님이 ${kind==='cast' ? '방송' : '말하는'} 중</span> <button class="btn small danger cutbtn" data-a="forceCut" data-v="${kind}">송신 끊기</button>`;
      st = S(st);
      if(stEl.innerHTML!==st) stEl.innerHTML = st;
      const ft = S((D.amMaster && RT && RADIO.rtMaster===false ? '<button class="btn small" data-a="rxMaster">🔒 권한 확인</button>' : '')
        + (RADIO.on && SND.ctx && !SND.ready() ? '<button class="btn small" data-a="rxUnlock">🔈 소리 켜기</button>' : '')
        + (kind==='radio' && RCFG.btn && radioRoleOK() ? '<span class="wkopt">🎧 이어폰 버튼으로 켜고 끌 수 있습니다</span>' : ''));
      if($('#wkfoot').innerHTML!==ft) $('#wkfoot').innerHTML = ft;
    }
  }
  // 설정 창: 무전 창 위에 따로 뜸
  const showRs = WK.open && WK.tab!=='msg' && RS.open && !TALK.kind;
  const rsWas = $('#rsbg').classList.contains('open');
  $('#rsbg').classList.toggle('open', showRs);
  if(!showRs && RS.test) rsTestStop();
  if(showRs) rsDraw();
  if(RCFG.btn && !radioRoleOK() && EB.audio) ebStop();
  // 창을 닫아 두었을 때 다른 사람이 말하면 위쪽에 이름을 띄움 (듣는 중: 초록 띠)
  let chips = '';
  if(ok && !WK.open){
    if(rx && radioRoleOK()) chips += `<button class="rxchip live" data-a="wkOpen">🔊 <b>${esc(L.name||'')}</b> 말하는 중</button>`;
    if(castRx && !boardOn() && radioRoleOK()) chips += `<div class="rxchip cast">📢 <b>${esc(C.name||'')}</b> 방송 중</div>`;
    if(RCFG.btn && radioRoleOK() && !ebReady()) chips += `<button class="rxchip warn" data-a="ebStartNow">화면을 한 번 누르면 이어폰 버튼을 쓸 수 있습니다</button>`;
    if(radioRoleOK() && RADIO.on && SND.ctx && !SND.ready()) chips += `<button class="rxchip warn" data-a="rxUnlock">🔈 눌러서 무전 소리 켜기</button>`;
    if(radioRoleOK() && RT && !RT.st.connected) chips += `<div class="rxchip off">무전기 연결 끊김</div>`;
  }
  chips = S(chips);
  const cbox = box.querySelector('.rxchips'); if(cbox.innerHTML!==chips) cbox.innerHTML = chips;
  document.body.classList.remove('has-radio');
  txbarRender();
  if(typeof psRefresh==='function') psRefresh();
  // 보이스오버: 창이 열리면 초점을 창 안으로, 닫히면 연 단추로 돌려줌
  if(V){
    if(wkOpened) setTimeout(() => { const t = WK.tab==='msg' ? $('#wkmsg') : $('#wkbig'); if(t) t.focus(); }, 80);
    if(wkClosed && WK.opener && document.contains(WK.opener)){ try{ WK.opener.focus(); }catch(e){} }
    if(showRs && !rsWas) setTimeout(() => { const t = $('#rsTitle'); if(t) t.focus(); }, 80);
    if(!showRs && rsWas && WK.open) setTimeout(() => { const t = $('#wkgear'); if(t) t.focus(); }, 80);
  }
  WK.shown = WK.open;
}

/* ---------- 무전 설정 (무전 창 위에 따로 뜨는 창): 무전 방식 · 마이크 · 마이크 시험 · 이어폰 버튼 · 듣기 ---------- */
const RS = { open:false, devs:[], test:null, raf:0, sig:'' };
async function rsLoadDevs(){
  RS.devs = await micDevices(); rsDraw();
}
if(navigator.mediaDevices && navigator.mediaDevices.addEventListener){
  try{ navigator.mediaDevices.addEventListener('devicechange', () => {
    EB.devAt = now();                                   // 이어폰을 뽑거나 꽂으면 휴대폰이 '일시정지' 신호를 보내므로, 잠시 이어폰 버튼 신호를 무시함
    if(TALK.kind && TALK.toggle) talkAbort();           // 한 번 눌러 켠 말하기는 장치가 바뀌면 끝냄
    if(RS.open) rsLoadDevs();
  }); }catch(e){}
}
async function rsTestStart(){
  if(RS.test) return;
  if(TALK.kind){ toast('말하는 중에는 시험할 수 없습니다.'); return; }
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ toast('이 브라우저에서는 마이크를 쓸 수 없습니다. 크롬이나 사파리로 열어 주세요.'); return; }
  try{
    const st = await openMicStream(), ctx = SND.ensure();
    if(!ctx){ st.getTracks().forEach(t => t.stop()); toast('이 브라우저에서는 마이크 시험을 할 수 없습니다.'); return; }
    const src = ctx.createMediaStreamSource(st), an = ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
    RS.test = { st, src, an, buf:new Float32Array(an.fftSize) };
    rsMeter(); rsLoadDevs();
  }catch(e){ toast(e && e.name==='NotAllowedError' ? '마이크 권한이 꺼져 있습니다. 브라우저(또는 휴대폰) 설정에서 허용해 주세요.' : '마이크를 켜지 못했습니다.'); }
}
function rsMeter(){
  const T = RS.test; if(!T) return;
  T.an.getFloatTimeDomainData(T.buf);
  let sum = 0; for(let i = 0; i < T.buf.length; i++) sum += T.buf[i]*T.buf[i];
  const lv = Math.min(1, Math.sqrt(Math.sqrt(sum / T.buf.length)) * 1.5);
  const el = document.getElementById('rsLevel'); if(el) el.style.width = Math.round(lv*100)+'%';
  RS.raf = requestAnimationFrame(rsMeter);
}
function rsTestStop(){
  cancelAnimationFrame(RS.raf);
  const T = RS.test; RS.test = null;
  if(T){ try{ T.src.disconnect(); }catch(e){} T.st.getTracks().forEach(t => t.stop()); }
  const el = document.getElementById('rsLevel'); if(el) el.style.width = '0%';
  RS.sig = '';
}
// 상태가 바뀔 때만 다시 그림 (소리 크기 막대와 목록 선택이 깜빡이지 않게)
function rsDraw(){
  const box = document.getElementById('wkset'); if(!box) return;
  const V = typeof voiceMode==='function' && voiceMode();
  const labeled = RS.devs.filter(d => d.label);
  const sig = JSON.stringify([RS.open, !!RS.test, RCFG.mic, RCFG.btn, radioMode(), RADIO.on, radioRoleOK(), V, labeled.map(d => d.deviceId+d.label)]);
  if(sig === RS.sig) return;
  RS.sig = sig;
  const opts = [['auto','자동(기본)'], ['builtin','휴대폰 내장 마이크'], ...labeled.map(d => [d.deviceId, d.label])];
  if(!opts.some(o => o[0]===RCFG.mic)) opts.push([RCFG.mic, '고른 마이크(목록에 없음)']);
  const mode = radioMode();
  const html = `<div class="rsbody">
    <div class="rsrow"><span class="rslabel" id="rsModeLbl">무전 방식</span>
      <div class="rsmode" role="group" aria-labelledby="rsModeLbl">
        <button class="rsopt ${mode==='hold'?'on':''}" data-a="rsMode" data-v="hold" aria-pressed="${mode==='hold'}">누르고 있는 동안 말하기</button>
        <button class="rsopt ${mode==='toggle'?'on':''}" data-a="rsMode" data-v="toggle" aria-pressed="${mode==='toggle'}">한 번 눌러 켜고 끄기</button></div>
      <p class="rssub">이어폰 버튼은 어느 쪽이든 한 번 누르면 시작하고 다시 누르면 끝납니다.</p></div>
    <div class="rsrow"><label class="rslabel" for="rsMic">마이크</label>
      <select id="rsMic">${opts.map(([v,l]) => `<option value="${esc(v)}" ${RCFG.mic===v?'selected':''}>${esc(l)}</option>`).join('')}</select>
      ${labeled.length ? '' : '<button class="btn small" data-a="rsLoadMics">마이크 목록 불러오기</button>'}
      <div class="rstest"><button class="btn small ${RS.test?'ok':''}" data-a="rsTest">🎤 마이크 시험 ${RS.test?'켬':'끔'}</button><div class="rsmeter" aria-label="마이크 소리 크기"><i id="rsLevel"></i></div></div>
      <p class="rssub">블루투스 이어폰의 마이크 소리가 작으면 휴대폰 내장 마이크를 고르세요. 기기에 따라 고른 마이크가 적용되지 않을 수 있으니 미리 시험해 주세요.</p></div>
    ${radioRoleOK() ? `<div class="rsrow"><div class="rsline"><label class="rslabel" for="rsBtnSw">이어폰 버튼으로 무전 켜고 끄기</label><label class="switch"><input type="checkbox" id="rsBtnSw" data-a="rsBtn" ${RCFG.btn?'checked':''}><span></span></label></div>
      <p class="rssub">누르고 있는 동안만 말하기는 안 되고, 한 번 누르면 시작하고 다시 누르면 끝납니다. 화면이 켜져 있고 이 앱이 앞에 있어야 합니다. 켜 두면 휴대폰의 음악 재생 버튼을 이 앱이 씁니다.</p></div>
    <div class="rsrow"><div class="rsline"><label class="rslabel" for="rsRxSw">다른 사람 무전 듣기</label><label class="switch"><input type="checkbox" id="rsRxSw" data-a="rxToggle" ${RADIO.on?'checked':''}><span></span></label></div>
      <p class="rssub">끄면 다른 사람의 무전이 이 기기에서 나오지 않습니다. 말하기는 그대로 됩니다.</p></div>` : ''}
  </div>`;
  box.innerHTML = V ? vstrip(html) : html;
}
document.addEventListener('change', e => {
  if(e.target.id !== 'rsMic') return;
  RCFG.mic = e.target.value; saveRcfg(); micDrop();
  const again = !!RS.test; if(again) rsTestStop();
  rsDraw();
  if(again) rsTestStart().then(rsDraw);
});

/* ---------- 이어폰 버튼 (미디어 재생 단추)으로 무전 켜고 끄기 ----------
   소리 없는 짧은 음원을 계속 틀어 두면 휴대폰이 이 앱을 '음악 재생 중'으로 보고 이어폰의 재생/일시정지 단추를 이 앱에 보내 줌 */
// devAt: 마지막으로 마이크·이어폰 장치가 바뀐 시각 · pausedAt: 휴대폰이 무음 음원을 멈춘 시각 (둘 다 이어폰을 뽑을 때 생기는 가짜 신호를 걸러내는 데 씀)
const EB = { audio:null, url:null, last:0, stopping:false, devAt:0, pausedAt:0 };
const ebReady = () => !!EB.audio && !EB.audio.paused;
function silentWavUrl(){
  const rate = 8000, n = rate * 10, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const w = (o, str) => { for(let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
  w(0,'RIFF'); v.setUint32(4, 36 + n, true); w(8,'WAVE'); w(12,'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36,'data'); v.setUint32(40, n, true);
  new Uint8Array(buf, 44).fill(128);                                  // 8비트 무음 = 128
  return URL.createObjectURL(new Blob([buf], { type:'audio/wav' }));
}
const EB_ACTIONS = ['play','pause','stop','nexttrack','previoustrack'];
function ebKeep(){
  try{ if(EB.audio && EB.audio.paused) EB.audio.play().catch(() => {}); }catch(e){}
  try{ navigator.mediaSession.playbackState = 'playing'; }catch(e){}
}
function ebMeta(){
  if(!('mediaSession' in navigator)) return;
  try{ navigator.mediaSession.metadata = new MediaMetadata({ title:'운동회 무전', artist: UI.me || '' }); }catch(e){}
  EB_ACTIONS.forEach(act => { try{ navigator.mediaSession.setActionHandler(act, () => { ebToggle(); ebKeep(); }); }catch(e){} });
  try{ navigator.mediaSession.playbackState = 'playing'; }catch(e){}
}
function ebStart(){
  if(EB.audio){ ebMeta(); ebKeep(); return; }
  const a = document.createElement('audio');
  a.id = 'ebAudio'; a.src = EB.url || (EB.url = silentWavUrl()); a.loop = true; a.volume = 1; a.muted = false;
  a.setAttribute('playsinline', ''); a.style.display = 'none';
  document.body.appendChild(a); EB.audio = a;
  // 전화 등으로 멈추면 다시 틀어 둠. 우리가 멈춘 것이 아닌 '멈춤'은 휴대폰이 한 것이므로 시각을 적어 둠(곧 오는 일시정지 신호를 무시하려고)
  a.addEventListener('pause', () => { if(EB.audio===a && !EB.stopping) EB.pausedAt = now(); if(EB.audio===a && RCFG.btn && !EB.stopping) setTimeout(() => { if(EB.audio===a) ebKeep(); }, 80); });
  a.addEventListener('playing', () => { if(EB.audio===a) radioRender(); });
  const pr = a.play();
  if(pr && pr.catch) pr.catch(() => { toast('이어폰 버튼 기능을 시작하지 못했습니다. 화면을 한 번 누르면 다시 시도합니다.'); });
  ebMeta();
}
function ebStop(){
  EB.stopping = true;
  if(EB.audio){ try{ EB.audio.pause(); }catch(e){} EB.audio.remove(); EB.audio = null; }
  if(EB.url){ URL.revokeObjectURL(EB.url); EB.url = null; }
  if('mediaSession' in navigator){
    EB_ACTIONS.forEach(act => { try{ navigator.mediaSession.setActionHandler(act, null); }catch(e){} });
    try{ navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; }catch(e){}
  }
  EB.stopping = false;
}
// 말하는 중이 아니면 말하기 시작, 이어폰 버튼으로 시작한 말하기라면 끝냄 (600ms 안의 중복 신호는 무시)
function ebToggle(){
  if(!RCFG.btn || !radioRoleOK()) return;
  const t = now();
  // 이어폰을 뽑으면 휴대폰이 '일시정지'를 보내 말하기가 저절로 켜지던 문제: 장치가 바뀐 뒤 2초, 무음 음원이 멈춘 뒤 1.5초 안의 신호는 무시
  if(t - EB.devAt < 2000 || t - EB.pausedAt < 1500) return;
  if(t - EB.last < 600) return; EB.last = t;
  if(TALK.kind){ if(TALK.toggle) pttUp(); return; }
  pttDown('radio', { toggle:true });
}
document.addEventListener('keydown', e => {
  if(!RCFG.btn || !radioRoleOK()) return;
  if(['MediaPlayPause','HeadsetHook','MediaPlay','MediaPause'].includes(e.key)){ e.preventDefault(); ebToggle(); }
});
// 앱을 다시 열면 화면을 한 번 눌렀을 때 소리를 다시 틀어 둠 (처음 틀려면 사람이 눌러야 하므로)
// 처음 틀려면 사람이 눌러야 하므로 click·touchend·pointerdown 어느 쪽이든 시작함 (실패하면 다음 누름에서 다시 시도)
['click', 'touchend', 'pointerdown'].forEach(t => document.addEventListener(t, () => { if(RCFG.btn && !ebReady() && store && radioRoleOK()) ebStart(); }, true));

/* ---------- 동작 ---------- */
// 무전기를 쓰는 기기는 화면을 처음 누를 때 소리를 켜 둠 (받는 쪽 재생을 위해)
document.addEventListener('pointerdown', () => { if(store && radioRoleOK() && RADIO.on){ const was = SND.ready(); SND.unlock(); if(!was) setTimeout(radioRender, 300); } }, true);
Object.assign(ACT, {
  wkOpen: (el) => { if(!wkTabs().length) return false; SND.unlock(); if(!WK.open) WK.opener = (el && el.focus) ? el : document.activeElement; WK.open = true; radioRender(); wkMsgDraw(); return false; },
  wkClose: () => { if(TALK.kind) return false; RS.open = false; WK.open = false; radioRender(); return false; },
  wkTab: (el, v) => { if(TALK.kind) return false; WK.tab = v; ls.set('udh5_wktab', v); radioRender(); wkMsgDraw(); return false; },
  rxUnlock: () => { SND.unlock(); setTimeout(radioRender, 300); return false; },
  rxMaster: async () => {
    const pw = await dialog({ msg:'무전기·방송을 쓰려면 마스터 비밀번호를 한 번 더 입력해 주세요.', input:'', type:'password', ok:'확인' });
    if(!pw) return false;
    toast((await rtMasterLogin(pw)) ? '무전기 권한을 확인했습니다.' : '비밀번호가 맞지 않거나 Realtime Database 설정이 필요합니다.');
    return false;
  },
  rxToggle: () => { RADIO.on = !RADIO.on; ls.set('udh5_radio_on', RADIO.on); if(!RADIO.on) stopListen('radio'); radioRender(); drawSheet(); return false; },
  rsOpen: () => { if(TALK.kind) return false; RS.open = true; RS.sig = ''; rsLoadDevs(); radioRender(); return false; },
  rsClose: () => { RS.open = false; rsTestStop(); radioRender(); return false; },
  rsMode: (el, v) => { RCFG.mode = v === 'toggle' ? 'toggle' : 'hold'; saveRcfg(); rsDraw(); radioRender(); return false; },
  // 마스터가 남의 송신을 끊음: 서버의 잠금을 지우면 말하던 기기가 알아차리고 마이크를 닫음
  forceCut: async (el, v) => {
    if(!D.amMaster) return denied();
    const kind = v === 'cast' ? 'cast' : 'radio';
    try{ const rt = await getRT(); await rt.forceRelease(kind); toast('송신을 끊었습니다.'); }
    catch(e){ console.error(e); toast(e && e.code==='PERMISSION_DENIED' ? '무전기 마스터 권한을 먼저 확인해 주세요.' : '송신을 끊지 못했습니다.'); }
    return false;
  },
  ebStartNow: () => { if(RCFG.btn && store && radioRoleOK()) ebStart(); setTimeout(radioRender, 150); return false; },
  rsLoadMics: async () => {
    try{ const st = await navigator.mediaDevices.getUserMedia({ audio:true }); st.getTracks().forEach(t => t.stop()); }
    catch(e){ toast('마이크 권한이 꺼져 있습니다. 브라우저(또는 휴대폰) 설정에서 허용해 주세요.'); }
    await rsLoadDevs(); return false;
  },
  rsTest: async () => { if(RS.test) rsTestStop(); else await rsTestStart(); rsDraw(); return false; },
  // 화면을 누른 그 순간에 소리를 시작해야 하므로 await 전에 ebStart를 부름
  rsBtn: () => {
    RCFG.btn = !RCFG.btn; saveRcfg();
    if(RCFG.btn){ if(!radioRoleOK()){ RCFG.btn = false; saveRcfg(); toast('무전 권한이 있는 기기에서만 쓸 수 있습니다.'); } else { ebStart(); toast('이어폰 버튼으로 무전을 켜고 끌 수 있습니다.'); } }
    else { ebStop(); toast('이어폰 버튼 기능을 껐습니다.'); }
    RS.sig = ''; rsDraw(); radioRender(); return false;
  },
  micTest: async () => {
    try{ const s = await navigator.mediaDevices.getUserMedia({ audio:true }); s.getTracks().forEach(t => t.stop()); toast('마이크를 쓸 수 있습니다.'); }
    catch(e){ toast('마이크 권한이 꺼져 있습니다. 브라우저(또는 휴대폰) 설정에서 허용해 주세요.'); }
    return false;
  },
});
