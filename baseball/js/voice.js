'use strict';
/* ===================== 음성 대화 (기기끼리 직접 연결) =====================
   목소리는 WebRTC로 두 기기가 직접 주고받고 서버를 거치지 않음 (서버에는 연결 신호만 잠깐 오감).
   방식은 기기마다 고름 (SET.vmode)
   - call(통화): 마이크가 계속 켜져 있음. 마이크 끄기·켜기로 조절
   - ptt(무전기): 말하기 단추를 누르는 동안(또는 한 번 눌러 켜고 다시 눌러 끄기)만 목소리를 보냄
   연결 순서: 음성을 켠 기기가 hello를 보내고, 두 기기가 모두 켜져 있으면 방장 기기가 offer를 만듦 */
const VC = { on:false, pc:null, stream:null, dc:null, peerOn:false, connected:false, talking:false, muted:false, peerTalking:false, ice:[], talkT:0, failT:0 };
const ICE = [{ urls:['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, ...TURN_SERVERS];

function voiceLabel(){
  if(!VC.on) return '음성 대화 꺼짐';
  if(!VC.connected) return VC.peerOn ? '음성 연결 중' : '상대가 음성을 켜기를 기다리는 중';
  return SET.vmode === 'ptt' ? (VC.talking ? '말하는 중' : '무전기 대기') : (VC.muted ? '마이크 꺼짐' : '통화 중');
}
async function voiceOn(){
  if(VC.on) return true;
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof RTCPeerConnection !== 'function'){ netNotice('이 브라우저에서는 음성 대화를 쓸 수 없습니다. 크롬이나 사파리로 열어 주세요.'); return false; }
  try{
    VC.stream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true } });
  }catch(e){
    netNotice('마이크를 쓸 수 없습니다. 브라우저 설정에서 마이크를 허용해 주세요.'); return false;
  }
  VC.on = true; VC.muted = false; VC.talking = false;
  // 아이폰: 터치 안에서 소리 칸을 한 번 재생해 두어야 나중에 상대 목소리가 나옴
  const a = $('#rvoice'); try{ a.muted = false; const p = a.play(); if(p && p.catch) p.catch(() => {}); }catch(e){}
  applyMic();
  netSig('hello');
  if(NET.role === 'host' && VC.peerOn) makeOffer();
  voiceUI();
  return true;
}
function voiceOff(silent){
  if(!VC.on && !VC.pc) return;
  if(!silent) netSig('bye');
  closePC();
  if(VC.stream) VC.stream.getTracks().forEach(t => { try{ t.stop(); }catch(e){} });
  VC.stream = null; VC.on = false; VC.talking = false;
  voiceUI();
}
function closePC(){
  clearTimeout(VC.failT);
  if(VC.pc){ try{ VC.pc.close(); }catch(e){} }
  VC.pc = null; VC.dc = null; VC.connected = false; VC.ice = []; VC.peerTalking = false;
}
function applyMic(){
  const on = VC.on && (SET.vmode === 'ptt' ? VC.talking : !VC.muted);
  if(VC.stream) VC.stream.getAudioTracks().forEach(t => { t.enabled = on; });
}
function newPC(){
  closePC();
  const pc = new RTCPeerConnection({ iceServers: ICE });
  VC.pc = pc;
  VC.stream.getTracks().forEach(t => pc.addTrack(t, VC.stream));
  pc.onicecandidate = e => { if(e.candidate) netSig('ice', e.candidate.toJSON ? e.candidate.toJSON() : e.candidate); };
  pc.ontrack = e => { const a = $('#rvoice'); a.srcObject = e.streams[0] || new MediaStream([e.track]); try{ const p = a.play(); if(p && p.catch) p.catch(() => {}); }catch(x){} };
  pc.ondatachannel = e => bindDC(e.channel);
  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    if(s === 'connected' && !VC.connected){
      VC.connected = true; clearTimeout(VC.failT);
      netNotice(SET.vmode === 'ptt' ? '음성이 연결되었습니다. 말하기 단추를 누르고 말하세요.' : '음성이 연결되었습니다. 이제 서로 말할 수 있습니다.');
      voiceUI();
    }
    if(s === 'failed' || (s === 'disconnected' && VC.connected)){
      const was = VC.connected; VC.connected = false; voiceUI();
      if(s === 'failed') netNotice(was ? '음성 연결이 끊겼습니다. 음성 대화를 껐다가 다시 켜 보세요.' : '음성이 직접 연결되지 않았습니다. 와이파이로 바꾸거나 문자 채팅을 써 주세요.');
    }
  };
  // 20초 안에 연결되지 않으면 알림
  VC.failT = setTimeout(() => { if(VC.pc === pc && !VC.connected) netNotice('음성 연결이 늦어지고 있습니다. 와이파이로 바꾸거나 문자 채팅을 써 주세요.'); }, 20000);
  return pc;
}
function bindDC(dc){
  VC.dc = dc;
  dc.onmessage = e => {
    const t = String(e.data);
    if(t === 'talk1'){ VC.peerTalking = true; playFx(['roger']); voiceUI(); }
    if(t === 'talk0'){ VC.peerTalking = false; voiceUI(); }
  };
}
async function makeOffer(){
  if(!VC.on || !VC.stream) return;
  const pc = newPC();
  bindDC(pc.createDataChannel('talk'));
  try{
    const o = await pc.createOffer();
    await pc.setLocalDescription(o);
    netSig('offer', { type:o.type, sdp:o.sdp });
  }catch(e){ netNotice('음성 연결을 준비하지 못했습니다.'); }
}
async function onSig(m){
  let d = null; try{ d = m.d ? JSON.parse(m.d) : null; }catch(e){}
  if(m.t === 'hello'){
    const was = VC.peerOn; VC.peerOn = true;
    if(VC.on && NET.role === 'host') makeOffer();
    else if(!VC.on && !was && NET.peer) netNotice(`${NET.peer.name}님이 음성 대화를 켰습니다. 메뉴의 음성 대화 켜기를 누르면 연결됩니다.`);
    voiceUI();
  } else if(m.t === 'bye'){
    VC.peerOn = false; closePC();
    if(VC.on && NET.peer) netNotice(`${NET.peer.name}님이 음성 대화를 껐습니다.`);
    voiceUI();
  } else if(m.t === 'offer' && d){
    VC.peerOn = true;
    if(!VC.on) return;
    const pc = newPC();
    try{
      await pc.setRemoteDescription(d);
      for(const c of VC.ice.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      const a = await pc.createAnswer();
      await pc.setLocalDescription(a);
      netSig('answer', { type:a.type, sdp:a.sdp });
    }catch(e){ netNotice('음성 연결을 받지 못했습니다.'); }
  } else if(m.t === 'answer' && d && VC.pc){
    try{ await VC.pc.setRemoteDescription(d); for(const c of VC.ice.splice(0)) await VC.pc.addIceCandidate(c).catch(() => {}); }catch(e){}
  } else if(m.t === 'ice' && d){
    if(VC.pc && VC.pc.remoteDescription) VC.pc.addIceCandidate(d).catch(() => {});
    else VC.ice.push(d);
  }
}

/* ---------- 말하기 (무전기) · 마이크 끄기 (통화) ---------- */
function talkStart(){
  if(!VC.on || VC.talking) return;
  VC.talking = true; playFx(['roger']);
  // 신호음이 끝난 뒤부터 목소리를 보냄
  setTimeout(() => { if(VC.talking){ applyMic(); try{ VC.dc && VC.dc.readyState === 'open' && VC.dc.send('talk1'); }catch(e){} } }, 180);
  clearTimeout(VC.talkT); VC.talkT = setTimeout(talkStop, 60000);   // 한 번에 60초까지
  voiceUI();
}
function talkStop(){
  if(!VC.talking) return;
  // 마지막 말이 잘리지 않게 0.2초 더 보낸 뒤 끔
  setTimeout(() => { VC.talking = false; applyMic(); try{ VC.dc && VC.dc.readyState === 'open' && VC.dc.send('talk0'); }catch(e){} voiceUI(); }, 200);
  clearTimeout(VC.talkT);
}
function micButton(){
  if(!VC.on) return voiceOn();
  if(SET.vmode === 'ptt'){ VC.talking ? talkStop() : talkStart(); }
  else { VC.muted = !VC.muted; applyMic(); speak(VC.muted ? '마이크를 껐습니다.' : '마이크를 켰습니다.'); voiceUI(); }
}
// 머리줄의 음성 단추: 무전기는 누르고 있는 동안 말하기(짧게 누르면 켜고 끄기), 화면 낭독기는 두 번 탭으로 켜고 끄기
const PTT = { down:0, active:false, skip:0 };
document.addEventListener('pointerdown', e => {
  if(!e.target.closest || !e.target.closest('#micBtn') || !VC.on || SET.vmode !== 'ptt') return;
  PTT.active = true;
  if(!VC.talking){ PTT.down = Date.now(); talkStart(); } else PTT.down = 0;
});
document.addEventListener('pointerup', () => {
  if(!PTT.active) return;
  PTT.active = false; PTT.skip = Date.now();
  if(!PTT.down || Date.now() - PTT.down > 500) talkStop();   // 누르고 있다가 뗐거나, 켜져 있던 것을 다시 누름
});
document.addEventListener('click', e => {
  if(!e.target.closest || !e.target.closest('#micBtn')) return;
  if(Date.now() - PTT.skip < 800) return;   // 포인터로 이미 처리함 (화면 낭독기·키보드는 클릭만 옴)
  micButton();
});
function voiceUI(){
  const b = $('#micBtn'); if(!b) return;
  b.hidden = !NET.on;
  const label = !VC.on ? '음성 켜기' : SET.vmode === 'ptt' ? (VC.talking ? '말하는 중 (누르면 끝)' : '말하기') : (VC.muted ? '마이크 켜기' : '마이크 끄기');
  b.textContent = label;
  b.classList.toggle('live', VC.on && (SET.vmode === 'ptt' ? VC.talking : !VC.muted));
  b.classList.toggle('peer', VC.peerTalking);
  const st = $('#voiceSt'); if(st) st.textContent = NET.on ? voiceLabel() + (VC.peerTalking && NET.peer ? `, ${NET.peer.name}님 말하는 중` : '') : '';
}
