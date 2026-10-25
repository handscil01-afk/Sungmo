'use strict';
/* ===================== 무전기 · 음성 안내방송 =====================
   누르고 있는 동안 마이크 소리를 0.2초씩 잘라 μ-law(전화 음질)로 줄여 보내고, 받는 쪽은 이어 붙여 재생함.
   무전(radio): 8kHz, 마스터·감독·심판끼리 · 방송(cast): 16kHz, 안내판 스피커로만 */
const RATE = { radio:8000, cast:16000 };
const MAX_TALK_MS = 60000;
const RADIO = { on: ls.get('udh5_radio_on', true), lock:{ radio:null, cast:null }, listen:{ radio:null, cast:null },
  rtMaster:null, rtMasters:null, rtRoles:null, err:'' };
const TALK = { kind:null, phase:null, tid:null, seq:0, pressed:false, timer:0, maxTimer:0, data:null };
const radioRoleOK = () => { const r = myRole().role; return r==='master' || r==='coach' || r==='referee'; };
const castOK = () => D.amMaster || !!myRole().cast;

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
const MIC = { stop:null };
async function micStart(rate, onChunk){
  const ctx = SND.ensure(); if(!ctx) throw new Error('no audio');
  const stream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true, channelCount:1 } });
  const src = ctx.createMediaStreamSource(stream), node = ctx.createScriptProcessor(2048, 1, 1), sink = ctx.createGain();
  sink.gain.value = 0;
  const ratio = ctx.sampleRate / rate, size = Math.round(rate * 0.2);
  let phase = 0, acc = 0, n = 0, buf = new Uint8Array(size), bi = 0;
  node.onaudioprocess = e => {
    const x = e.inputBuffer.getChannelData(0);
    for(let k = 0; k < x.length; k++){
      acc += x[k]; n++; phase += 1;
      if(phase >= ratio){ phase -= ratio; buf[bi++] = muEnc(acc / n * 1.5); acc = 0; n = 0;
        if(bi === size){ onChunk(buf); buf = new Uint8Array(size); bi = 0; } }
    }
  };
  src.connect(node); node.connect(sink); sink.connect(ctx.destination);
  MIC.stop = () => {
    if(bi) onChunk(buf.slice(0, bi));
    try{ node.disconnect(); src.disconnect(); sink.disconnect(); }catch(e){}
    stream.getTracks().forEach(t => t.stop());
    MIC.stop = null;
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
      // 늦게 도착한 조각이 있으면 0.25초 여유를 두고 다시 이어 재생
      const t = this.t < nowT + 0.02 ? Math.max(nowT + 0.25, this.startAt) : this.t;
      s.start(t); this.t = t + buf.duration;
    } };
}
function stopListen(kind){ const L = RADIO.listen[kind]; if(L){ try{ L.off && L.off(); }catch(e){} RADIO.listen[kind] = null; } }
function shouldPlay(kind){ return kind==='cast' ? boardOn() : (radioRoleOK() && RADIO.on && TALK.kind!=='radio'); }
function onLockChange(kind, lock){
  RADIO.lock[kind] = lock;
  const other = lock && lock.uid!==store.uid;
  if(other && shouldPlay(kind) && (!RADIO.listen[kind] || RADIO.listen[kind].tid!==lock.tid)){
    stopListen(kind);
    const player = mkPlayer(RATE[kind]);
    if(kind==='cast'){
      // 방송 앞에 차임벨: 울리는 동안 들어온 목소리는 모아 두었다가 차임벨이 끝나면 재생
      const cfg = boardCfg();
      if(cfg.sound && SND.ready()){ const d = cfg.chime ? SND.chime() : 0; player.startAt = SND.ctx.currentTime + d + 0.3; }
      try{ speechSynthesis.cancel(); }catch(e){}
    }
    RADIO.listen[kind] = { tid:lock.tid, player, off: RT.onChunks(kind, lock.tid, (seq, d) => { try{ player.push(unb64(d)); }catch(e){} }) };
  }
  if(!lock && RADIO.listen[kind]){ const L = RADIO.listen[kind]; setTimeout(() => { if(RADIO.listen[kind]===L) stopListen(kind); }, 5000); }
  radioRender();
  if(kind==='cast'){ queueRender(); if(!lock && typeof runFx==='function') setTimeout(runFx, 1500); }
}

/* ---------- 구독 · 역할 옮겨 두기 ---------- */
const radioSubs = { radio:null, cast:null, master:null, roles:null, masters:null };
let radioRetryAt = 0;
function radioInit(){
  if(!store || !UI.me || D.fatal) return;
  getRT().then(rt => {
    if(radioRoleOK()){
      if(!radioSubs.radio && now() > radioRetryAt){
        radioSubs.radio = rt.onLock('radio', l => onLockChange('radio', l), () => { radioSubs.radio = null; radioRetryAt = now()+8000; RADIO.lock.radio = null; radioRender(); });
      }
    } else if(radioSubs.radio){ radioSubs.radio(); radioSubs.radio = null; RADIO.lock.radio = null; stopListen('radio'); }
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
  Object.entries(D.roles).forEach(([id, r]) => { if(r && ['referee','coach','board'].includes(r.role)) want[id] = { role:r.role, cast:!!r.cast }; });
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
  const h = (RADIO.rtRoles||{})[store.uid];
  return !!h && h.role===myRole().role;
}

/* ---------- 누르고 말하기 ---------- */
async function pttDown(kind){
  if(TALK.kind) return;
  if(kind==='radio' ? !radioRoleOK() : !castOK()) return;
  SND.unlock();
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ toast('이 브라우저에서는 마이크를 쓸 수 없습니다. 크롬이나 사파리로 열어 주세요.'); return; }
  TALK.kind = kind; TALK.phase = 'wait'; TALK.pressed = true; TALK.tid = store.uid.slice(0,6) + now().toString(36); TALK.seq = 0;
  TALK.data = { uid:store.uid, name:UI.me, tid:TALK.tid };
  radioRender();
  const fail = msg => { if(msg) toast(msg); if(navigator.vibrate) navigator.vibrate([60,40,60]); TALK.kind = null; TALK.phase = null; radioRender(); };
  let rt; try{ rt = await getRT(); }catch(e){ return fail('무전기에 연결하지 못했습니다.'); }
  const res = await rt.acquire(kind, TALK.data);
  if(!res.ok){
    if(res.error) return fail(radioReady() ? '무전기 서버에 연결하지 못했습니다.' : (D.amMaster ? '무전기 권한을 먼저 확인해 주세요(🔒 버튼).' : '무전기 권한을 준비하는 중입니다. 마스터 기기가 켜져 있는지 확인해 주세요.'));
    return fail(`${res.lock && res.lock.name || '다른 사람'} 님이 ${kind==='cast' ? '방송' : '말하는'} 중입니다.`);
  }
  const giveUp = async () => { await rt.release(kind); TALK.kind = null; TALK.phase = null; radioRender(); };
  if(!TALK.pressed) return giveUp();
  try{
    await rt.begin(kind, TALK.tid);
    await micStart(RATE[kind], bytes => { rt.send(kind, TALK.tid, TALK.seq++, b64(bytes)); });
  }catch(e){
    console.error(e); await giveUp();
    return fail(e && e.name==='NotAllowedError' ? '마이크 권한이 꺼져 있습니다. 브라우저(또는 휴대폰) 설정에서 마이크를 허용해 주세요.' : '마이크를 켜지 못했습니다.');
  }
  TALK.phase = 'live';
  if(!TALK.pressed){ pttUp(); return; }
  SND.play([[1320, 0, 0.09]]);   // 말해도 된다는 '삑' 소리
  if(navigator.vibrate) navigator.vibrate(30);
  TALK.timer = setInterval(() => rt.refresh(kind, TALK.data), 3000);
  TALK.maxTimer = setTimeout(() => { toast('한 번에 60초까지 말할 수 있습니다.'); pttUp(); }, MAX_TALK_MS);
  radioRender();
}
async function pttUp(){
  TALK.pressed = false;
  if(!TALK.kind || TALK.phase!=='live') return;   // 연결 중이면 연결이 끝난 뒤 알아서 정리됨
  const kind = TALK.kind, tid = TALK.tid;
  clearInterval(TALK.timer); clearTimeout(TALK.maxTimer);
  MIC.stop && MIC.stop();
  TALK.kind = null; TALK.phase = null; radioRender();
  const rt = await getRT();
  await rt.release(kind);
  setTimeout(() => rt.dropTalk(kind, tid), 10000);
}

/* ---------- 화면 (오른쪽에 항상 떠 있는 버튼) ---------- */
function radioSetup(){
  const box = $('#radio');
  box.innerHTML = `<div class="rxchips"></div>
    <button class="ptt cast hidden" data-kind="cast" aria-label="안내방송: 누르고 있는 동안 안내판 스피커로 방송"><span class="ic">📢</span><span class="lb">방송</span></button>
    <button class="ptt hidden" data-kind="radio" aria-label="무전기: 누르고 있는 동안 말하기"><span class="ic">🎙</span><span class="lb">무전</span></button>`;
  box.querySelectorAll('.ptt').forEach(b => {
    b.addEventListener('pointerdown', e => { e.preventDefault(); try{ b.setPointerCapture(e.pointerId); }catch(x){} pttDown(b.dataset.kind); });
    ['pointerup','pointercancel','lostpointercapture'].forEach(t => b.addEventListener(t, () => { if(TALK.kind===b.dataset.kind || TALK.pressed) pttUp(); }));
    b.addEventListener('contextmenu', e => e.preventDefault());
  });
}
function radioRender(){
  const box = $('#radio'); if(!box) return;
  if(!box.firstChild) radioSetup();
  const ok = !!store && !!UI.me && !D.fatal && !UI.preview;
  const showRadio = ok && radioRoleOK(), showCast = ok && castOK();
  const set = (kind, show) => {
    const b = box.querySelector(`.ptt[data-kind="${kind}"]`), L = RADIO.lock[kind];
    b.classList.toggle('hidden', !show); if(!show) return;
    const mine = TALK.kind===kind, otherTalk = TALK.kind && !mine, busy = L && L.uid!==store.uid;
    let cls = 'ptt' + (kind==='cast' ? ' cast' : ''), ic = kind==='cast' ? '📢' : '🎙', lb = kind==='cast' ? '방송' : '무전';
    if(mine && TALK.phase==='live'){ cls += ' live'; lb = '말하는 중'; }
    else if(mine){ cls += ' wait'; lb = '연결 중'; }
    else if(busy){ cls += ' busy'; ic = '🔒'; lb = L.name || '사용 중'; }
    else if(otherTalk || !radioReady()){ cls += ' dim'; }
    b.className = cls; b.querySelector('.ic').textContent = ic; b.querySelector('.lb').textContent = lb;
  };
  set('radio', showRadio); set('cast', showCast);
  let chips = '';
  if(ok){
    const L = RADIO.lock.radio, C = RADIO.lock.cast;
    if(TALK.phase==='live') chips += `<div class="txbar">🔴 ${TALK.kind==='cast' ? '안내판으로 방송 중' : '무전 보내는 중'}<small>손을 떼면 끝납니다</small></div>`;
    if(showRadio && L && L.uid!==store.uid) chips += `<div class="rxchip live">🎙 <b>${esc(L.name||'')}</b></div>`;
    if(C && C.uid!==store.uid && !boardOn() && (showRadio || showCast)) chips += `<div class="rxchip cast">📢 <b>${esc(C.name||'')}</b> 방송 중</div>`;
    if(showRadio && RADIO.on && SND.ctx && !SND.ready()) chips += `<button class="rxchip warn" data-a="rxUnlock">🔈 눌러서 소리 켜기</button>`;
    if((showRadio || showCast) && RT && !RT.st.connected) chips += `<div class="rxchip off">무전기 연결 끊김</div>`;
    if(D.amMaster && RT && RADIO.rtMaster===false) chips += `<button class="rxchip warn" data-a="rxMaster">🔒 무전기 권한 확인</button>`;
    if(showRadio && !RADIO.on) chips += `<div class="rxchip off">무전 소리 꺼짐</div>`;
  }
  const cbox = box.querySelector('.rxchips'); if(cbox.innerHTML!==chips) cbox.innerHTML = chips;
}

/* ---------- 동작 ---------- */
// 무전기를 쓰는 기기는 화면을 처음 누를 때 소리를 켜 둠 (받는 쪽 재생을 위해)
document.addEventListener('pointerdown', () => { if(store && radioRoleOK() && RADIO.on){ const was = SND.ready(); SND.unlock(); if(!was) setTimeout(radioRender, 300); } }, true);
Object.assign(ACT, {
  rxUnlock: () => { SND.unlock(); setTimeout(radioRender, 300); return false; },
  rxMaster: async () => {
    const pw = await dialog({ msg:'무전기·방송을 쓰려면 마스터 비밀번호를 한 번 더 입력해 주세요.', input:'', type:'password', ok:'확인' });
    if(!pw) return false;
    toast((await rtMasterLogin(pw)) ? '무전기 권한을 확인했습니다.' : '비밀번호가 맞지 않거나 Realtime Database 설정이 필요합니다.');
    return false;
  },
  rxToggle: () => { RADIO.on = !RADIO.on; ls.set('udh5_radio_on', RADIO.on); if(!RADIO.on) stopListen('radio'); radioRender(); drawSheet(); return false; },
  micTest: async () => {
    try{ const s = await navigator.mediaDevices.getUserMedia({ audio:true }); s.getTracks().forEach(t => t.stop()); toast('마이크를 쓸 수 있습니다.'); }
    catch(e){ toast('마이크 권한이 꺼져 있습니다. 브라우저(또는 휴대폰) 설정에서 허용해 주세요.'); }
    return false;
  },
});
