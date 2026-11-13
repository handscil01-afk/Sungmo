'use strict';
/* ===================== 읽어 주기 · 효과음 · 진동 =====================
   읽어 주기 방식(SET.voice)
   - sr: 화면 낭독기(보이스오버·톡백·한소네)가 읽도록 숨은 알림 칸(#live)에 글을 넣음. 점자 단말기에도 잠깐 표시됨
   - tts: 휴대폰·PC의 기기 음성으로 직접 읽음 (화면 낭독기를 쓰지 않는 사람용)
   - off: 읽지 않음 (기록 목록은 그대로 남음) */
let liveT = 0;
function liveSay(text){
  const el = $('#live'); if(!el || !text) return;
  el.textContent = '';
  clearTimeout(liveT);
  liveT = setTimeout(() => { el.textContent = text; }, 80);
}
const ttsOK = () => 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
function koVoice(){
  try{ const vs = speechSynthesis.getVoices() || []; const ks = vs.filter(v => /^ko([-_]|$)/i.test(v.lang || '')); return ks.find(v => v.localService) || ks[0] || null; }catch(e){ return null; }
}
function ttsSay(text){
  if(!ttsOK() || !text) return;
  try{
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text), v = koVoice();
    u.lang = v ? v.lang : 'ko-KR'; if(v) u.voice = v;
    u.rate = SET.rate || 1;
    window.__utt = u;   // 읽는 도중에 지워져 끊기지 않게 붙잡아 둠
    speechSynthesis.speak(u);
  }catch(e){}
}
// 모든 안내는 여기로
function speak(text){
  if(!text) return;
  if(typeof castDuck === 'function') castDuck(Math.min(6, 0.8 + text.length * 0.09));   // 안내를 읽는 동안 중계는 작게
  if(SET.voice === 'tts') ttsSay(text);
  else if(SET.voice === 'sr' || SET.voice === 'cast') liveSay(text);
}
// 아이폰은 처음 한 번 터치 안에서 읽어야 그 뒤로도 읽어 줌
let ttsWarm = false;
document.addEventListener('pointerdown', () => {
  if(ttsWarm || SET.voice !== 'tts' || !ttsOK()) return;
  ttsWarm = true; try{ const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }catch(e){}
}, true);

/* ---------- 효과음 (Web Audio로 직접 만듦: 파일 없음) ---------- */
const SFX = { ctx:null };
function audio(){
  if(SFX.ctx) return SFX.ctx;
  try{ const C = window.AudioContext || window.webkitAudioContext; if(C) SFX.ctx = new C(); }catch(e){}
  // 전체 소리를 크게: 모든 소리를 압축기(큰 소리는 눌러 찢어지지 않게) → 키우기(1.8배)를 거쳐 내보냄.
  // 소리마다 c.destination에 잇는 코드가 많아서, 이 기기의 destination 자리를 그 입구로 바꿔 끼움
  if(SFX.ctx && !SFX.master){
    try{
      const c = SFX.ctx, out = c.destination, comp = c.createDynamicsCompressor(), boost = c.createGain();
      comp.threshold.value = -20; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
      boost.gain.value = 1.8; comp.connect(boost); boost.connect(out);
      Object.defineProperty(c, 'destination', { value: comp, configurable: true });
      SFX.master = boost;
    }catch(e){}
  }
  // 휴대폰에서 음성 대화(마이크)를 켜거나 다른 앱 소리가 끼어들면 소리 장치가 멈출(interrupted·suspended) 수 있음 → 다시 켬
  if(SFX.ctx) SFX.ctx.onstatechange = () => { const c = SFX.ctx; if(c.state !== 'running' && c.state !== 'closed' && !document.hidden) c.resume().catch(() => {}); };
  return SFX.ctx;
}
document.addEventListener('pointerdown', () => { const c = audio(); if(c && c.state === 'suspended') c.resume().catch(() => {}); }, true);
document.addEventListener('keydown', () => { const c = audio(); if(c && c.state === 'suspended') c.resume().catch(() => {}); }, true);
document.addEventListener('visibilitychange', () => { const c = SFX.ctx; if(c && !document.hidden && c.state !== 'running' && c.state !== 'closed') c.resume().catch(() => {}); });
function noise(c, t0, dur, type, freq, gain, q = 1){
  const n = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for(let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(); s.buffer = buf;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(c.destination); s.start(t0); s.stop(t0 + dur + 0.02);
}
function tone(c, t0, dur, freq, gain, type = 'sine', to){
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0); if(to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
const SOUNDS = {
  // 포수 미트에 공이 꽂히는 소리(합성): 짧은 저음 '퍽' + 가죽 잡음. 녹음을 받으면 이 자리를 바꿈
  glove: (c, t) => { tone(c, t, 0.11, 110, 0.4, 'sine', 55); noise(c, t, 0.07, 'lowpass', 700, 0.5); noise(c, t + 0.005, 0.03, 'highpass', 3200, 0.14); },
  mitt:  (c, t) => { noise(c, t, 0.09, 'lowpass', 900, 0.5); tone(c, t, 0.08, 140, 0.25, 'sine', 70); },
  whiff: (c, t) => { noise(c, t, 0.25, 'bandpass', 1800, 0.18, 0.7); },
  foul:  (c, t) => { noise(c, t, 0.05, 'highpass', 2500, 0.35); },
  bat:   (c, t) => { noise(c, t, 0.06, 'highpass', 1800, 0.6); tone(c, t, 0.05, 1200, 0.25, 'triangle', 600); },
  bunt:  (c, t) => { noise(c, t, 0.04, 'bandpass', 900, 0.4); },
  hit:   (c, t) => { tone(c, t + 0.1, 0.12, 660, 0.18); tone(c, t + 0.22, 0.16, 880, 0.18); },
  xbh:   (c, t) => { [523, 659, 784].forEach((f, i) => tone(c, t + 0.1 + i * 0.1, 0.16, f, 0.18)); },
  hr:    (c, t) => { [523, 659, 784, 1047].forEach((f, i) => tone(c, t + 0.15 + i * 0.12, 0.25, f, 0.2, 'triangle')); noise(c, t + 0.2, 1.6, 'bandpass', 1200, 0.25, 0.4); },
  score: (c, t) => { tone(c, t + 0.05, 0.18, 784, 0.16); tone(c, t + 0.2, 0.25, 1047, 0.16); },
  out:   (c, t) => { tone(c, t, 0.18, 330, 0.16, 'sine', 220); },
  k:     (c, t) => { tone(c, t, 0.12, 440, 0.16); tone(c, t + 0.13, 0.2, 330, 0.16); },
  ball:  (c, t) => { tone(c, t, 0.1, 520, 0.1); },
  safe:  (c, t) => { tone(c, t, 0.1, 600, 0.14); tone(c, t + 0.1, 0.1, 800, 0.14); },
  change:(c, t) => { tone(c, t, 0.15, 392, 0.12); tone(c, t + 0.16, 0.2, 523, 0.12); },
  roger: (c, t) => { tone(c, t, 0.07, 1250, 0.15, 'square'); tone(c, t + 0.08, 0.08, 950, 0.15, 'square'); },
  review:(c, t) => { tone(c, t, 0.12, 700, 0.14, 'triangle'); tone(c, t + 0.14, 0.12, 700, 0.14, 'triangle'); tone(c, t + 0.28, 0.2, 900, 0.14, 'triangle'); },
  chat:  (c, t) => { tone(c, t, 0.08, 988, 0.14); tone(c, t + 0.1, 0.12, 1319, 0.14); },
  end:   (c, t) => { [392, 523, 659, 784].forEach((f, i) => tone(c, t + i * 0.18, 0.3, f, 0.18, 'triangle')); },
};
// 진동 문법: 짧게(약 50ms)와 길게(약 200ms)의 조합으로 뜻을 구분함. 설정의 '진동 뜻 익히기'에서 하나씩 느껴 볼 수 있음
const VIB_INFO = [
  ['strike', '스트라이크', '짧게 한 번', [40]],
  ['ballc', '볼', '길게 한 번', [220]],
  ['hit', '안타', '짧게 두 번', [50, 60, 50]],
  ['b2', '장타(2루타·3루타)', '짧게 세 번', [50, 60, 50, 60, 50]],
  ['hr', '홈런', '길게, 짧게, 길게', [250, 80, 50, 80, 250]],
  ['out', '아웃', '길게 두 번', [200, 100, 200]],
  ['k', '삼진', '길게 세 번', [200, 100, 200, 100, 200]],
  ['score', '득점', '짧게 세 번 뒤 길게 한 번', [50, 60, 50, 60, 50, 100, 250]],
];
const VIB = { review:[60, 60, 60, 60, 200], chat:[40, 60, 40], end:[300, 100, 300], safe:[40, 40, 40], ball:[220, 80, 40], xbh:[50, 60, 50, 60, 50], b3:[50, 60, 50, 60, 50] };
VIB_INFO.forEach(([k,, , p]) => { VIB[k] = p; });
// 한 번의 선택으로 여러 효과가 나오면 가장 중요한 것 하나(간단한 소리는 순서대로 최대 3개)
const FX_RANK = ['chat', 'roger', 'end', 'review', 'hr', 'score', 'b3', 'b2', 'xbh', 'hit', 'k', 'out', 'safe', 'ball', 'change', 'bunt', 'bat', 'foul', 'whiff', 'mitt', 'strike', 'ballc'];
// 간단한 소리로 바꿀 때: 새 사건 이름을 예전 소리에 맞춤
const SYN = { strike:'mitt', ballc:'mitt', b2:'xbh', b3:'xbh', pchange:'change', sub:'change', 'whiff-p':'whiff', 'whiff-s':'whiff', 'whiff-c':'whiff', batBig:'bat', batF:'bat' };

/* ---------- 녹음 효과음 (sfx/*.mp3) ----------
   사건마다 소리 하나: 공을 던지면 '피칭'이 먼저 나고, 이어서 결과(스트라이크·볼·헛스윙·파울·안타·2루타·3루타·홈런·아웃·삼진) 소리가 남.
   3아웃이면 결과 뒤에 '공수교대'. 새 타자는 '타석'(관중 소리), 투수 교체는 '투수', 대타·대주자는 '타자', 경기 시작은 '마운드'.
   긴 소리는 다음 사건이 오면 부드럽게 줄이고 새 소리로 바꿈 */
const REC = { pitch:['pitch'], strike:['strike'], ballc:['ball'], foul:['foul'], hit:['hit'], b2:['double'], b3:['triple'], hr:['homer'],
  out:['out'], k:['strikeout'], change:['change'], batter:['atbat'], pchange:['pitcher'], sub:['batter'], start:['organ'],
  // 헛스윙은 타격 방법마다(강하게·보통·맞히기), 타격음은 잘 맞은 정도마다 다른 소리 (여럿이면 그때그때 하나)
  'whiff-p':['whiff-p', 'whiff-p2'], 'whiff-s':['whiff-n', 'whiff-n2'], 'whiff-c':['whiff-c', 'whiff-c2'],
  bat:['bat1', 'bat2', 'bat3'], batF:['bat1', 'bat2', 'bat3'], batBig:['bat-big'] };
/* 효과음 대응표: 사건마다 어떤 소리를 언제 내는지를 한곳에 적음 (시각은 공 하나의 시간표 timeline.js의 이름)
   release 공을 놓음 · contact 공이 포수 미트나 방망이에 닿음 · hit 안타가 정해짐(공이 떨어지거나 내야를 빠져나감) · result 모든 플레이가 끝남
   crowd: 함성의 종류와 크기. 안타 < 장타 < 홈런 ≤ 역전·끝내기. 원정팀 득점은 작게 */
const SFX_MAP = {
  pitch: { rec:'pitch', at:'release', lead:-0.15, vol:0.6 },
  glove: { synth:'glove', at:'contact', when: A => A.res === 'take' || A.res === 'whiff' },   // 스트라이크·볼·헛스윙 모두 미트에 꽂히는 순간
  swing: { rec:'contact', at:'contact', vol:0.95 },
  crowd: { at:'hit', hit:{ peak:0.75, hold:1.6 }, xbh:{ peak:0.85, hold:2.2 }, big:{ peak:1.0, hold:3.5 }, away:0.6 },
};
const sfxTime = (tl, hitAt, key) => key === 'hit' ? (hitAt != null ? hitAt : tl.result) : tl[key];
const REC_CONTACT = ['batBig', 'bat', 'batF', 'whiff-p', 'whiff-s', 'whiff-c'];
const REC_MAIN = ['hr', 'b3', 'b2', 'hit', 'k', 'out', 'strike', 'ballc', 'foul', 'pchange', 'sub', 'start'];
const RECBUF = {}, RECLOAD = {}, RECNOW = [];
const recPick = ev => { const a = REC[ev]; return a[Math.floor(Math.random() * a.length)]; };
function recLoad(name){
  const c = audio(); if(!c || RECBUF[name] || RECLOAD[name]) return;
  RECLOAD[name] = fetch(new URL(`sfx/${name}.mp3`, document.baseURI).href).then(r => r.arrayBuffer())
    .then(ab => new Promise((ok, no) => { const p = c.decodeAudioData(ab, ok, no); if(p && p.then) p.then(ok, no); }))
    .then(buf => { RECBUF[name] = buf; }).catch(() => { delete RECLOAD[name]; });
}
// 화면 보며 하기용: 앞부분의 방망이 소리를 잘라 낸 결과 소리 (타격음은 그림에 맞춰 따로 냄)
const REC_NB = new Set(['hit', 'double', 'triple', 'foul', 'out']);
function recPreload(){ [...new Set(Object.values(REC).flat()), ...[...REC_NB].map(n => n + '-nb')].forEach(recLoad); }
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if(SET.snd && SET.sndKind !== 'synth') recPreload(); }, { capture:true, once:true }));
function recStopAll(c){
  RECNOW.splice(0).forEach(x => { try{ x.g.gain.setTargetAtTime(0, c.currentTime, 0.08); x.s.stop(c.currentTime + 0.4); }catch(e){} });
}
// at: 몇 초 뒤에 · max: 이 길이가 넘으면 줄이며 끝냄
function recPlay(c, name, at, vol, max){
  const buf = RECBUF[name]; if(!buf){ recLoad(name); return 0; }
  const s = c.createBufferSource(), g = c.createGain();
  s.buffer = buf; g.gain.value = vol; s.connect(g); g.connect(c.destination);
  const t = c.currentTime + at; s.start(t);
  if(max && buf.duration > max){ g.gain.setValueAtTime(vol, t + max - 0.6); g.gain.linearRampToValueAtTime(0, t + max); s.stop(t + max + 0.05); }
  RECNOW.push({ s, g });
  s.onended = () => { const i = RECNOW.findIndex(x => x.s === s); if(i >= 0) RECNOW.splice(i, 1); };
  return Math.min(buf.duration, max || buf.duration);
}
function playRec(c, uniq){
  // 중계 음성일 때는 목소리가 들어 있는 녹음(스트라이크·볼·파울·아웃·안타·공수 교대 등)은 빼고 방망이·관중 소리만
  const cast = typeof castOn === 'function' && castOn();
  const main = cast ? null : REC_MAIN.find(n => uniq.includes(n)), contact = REC_CONTACT.find(n => uniq.includes(n));
  const pitch = uniq.includes('pitch'), change = uniq.includes('change');
  if(!main && !contact && !pitch && !change && !uniq.includes('batter')) return false;
  recStopAll(c);
  // 투구(짧은 바람 소리) → 방망이(헛스윙·타격음) → 결과 → 공수교대 순서로, 겹치지 않게 조금씩 띄움
  let t = 0.02;
  // 화면 보며 하기: 그림 움직임에 맞춤 (공이 손을 떠날 때 피칭, 공이 올 때 타격, 잡거나 떨어질 때 결과)
  // 공 하나의 시간표(timeline.js)를 따름: 공을 놓을 때 피칭, 공이 올 때 방망이, 결과가 정해질 때 결과 소리. 친 뒤에는 관중이 술렁임
  const anim = pitch && typeof G !== 'undefined' && G && G.anim && G.mode !== 'manager' ? G.anim : null;
  const tl = anim ? playTL(anim, uniq) : null, gx = !!tl;
  if(gx){
    const inplay = anim.res === 'inplay' && /^bat(Big)?$/.test(contact || ''), foul = contact === 'batF';
    recPlay(c, 'pitch', sfxTime(tl, null, SFX_MAP.pitch.at) + SFX_MAP.pitch.lead, SFX_MAP.pitch.vol);
    if(contact) recPlay(c, recPick(contact), tl.contact, SFX_MAP.swing.vol);
    if(SFX_MAP.glove.when(anim)){ try{ SOUNDS.glove(c, c.currentTime + tl.contact); }catch(e){} }   // 미트 소리(합성)
    t = tl.result;
    if(SFX.castAt){ t = Math.max(t, SFX.castAt); SFX.castAt = 0; }   // 중계 음성이 결과를 말하는 순간에 맞춤
    const won = ['hr', 'b3', 'b2', 'hit'].find(n => uniq.includes(n));
    // 함성은 플레이가 다 끝나는 때가 아니라 안타가 정해지는 때(중계가 "안타!"를 말하는 때)에 터짐
    const hm = typeof hitMoment === 'function' ? hitMoment(anim) : null, hitAt = SFX.hitAt != null ? SFX.hitAt : hm != null ? tl.contact + hm : null; SFX.hitAt = null;
    const evs = SFX.ev || [], clutch = evs.some(e => e.k === 'score' && (e.walkoff || e.lc));
    const kind = !won ? 'fade' : won === 'hr' || clutch ? 'big' : won === 'hit' ? 'hit' : 'xbh';
    const top = typeof G !== 'undefined' && G ? (evs.some(e => e.k === 'inning') ? !G.top : G.top) : false;   // 이 공을 칠 때가 초인지 (3아웃으로 넘어갔으면 이미 뒤집힘)
    const low = top ? SFX_MAP.crowd.away : 1;   // 원정팀(초) 안타·득점이면 함성을 작게
    if(inplay || foul) crowdSwell(c, tl.contact + 0.05, won && hitAt != null ? Math.max(tl.contact + 0.2, Math.min(t, hitAt)) : t, kind, kind === 'fade' ? 1 : low);
  } else {
    if(pitch){ recPlay(c, 'pitch', t, 0.6); t += 0.35; }
    if(contact){ recPlay(c, recPick(contact), t, 0.9); t += contact === 'batBig' ? 0.45 : 0.3; }
  }
  // 화면 보며 하기: 아웃은 녹음 파일(방망이 소리가 섞여 있음) 대신 글러브에 공이 꽂히는 소리
  // 화면 보며 하기: 결과 소리는 방망이 소리를 잘라 낸 것으로 (아웃은 글러브 소리 뒤에 관중 반응)
  if(main && gx){
    if(main === 'out'){ try{ SOUNDS.mitt(c, c.currentTime + t); }catch(e){} }
    let nm = recPick(main); if(REC_NB.has(nm)) nm += '-nb';
    const d = recPlay(c, nm, t + (main === 'out' ? 0.15 : 0), 0.85, main === 'hr' ? 10 : 4); t += Math.min(d || 1, 2.5);
  }
  else if(main){ const d = recPlay(c, recPick(main), t, 0.85, main === 'hr' ? 10 : 4); t += Math.min(d || 1, 2.5); }
  if(change && !cast) recPlay(c, 'change', t, 0.7, 4);
  else if(!cast && !pitch && !main && !contact && uniq.includes('batter')) recPlay(c, 'atbat', t, 0.6, 3);
  return true;
}
// 관중 함성 (녹음): 안타·득점은 cheer1의 한 부분을 짧게, 홈런은 cheer2를 길게. 중계가 들리게 조금 작게
function cheer(c, at, big, sc = 1){
  const name = big ? 'cheer2' : 'cheer1', buf = RECBUF[name]; if(!buf){ recLoad(name); return; }
  const s = c.createBufferSource(), g = c.createGain(); s.buffer = buf; s.connect(g); g.connect(c.destination);
  const t = c.currentTime + at, dur = big ? 7 : 3.8, off = big ? 0 : Math.random() * Math.max(0, buf.duration - dur - 0.5), v = (big ? 0.7 : 0.45) * sc;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.25); g.gain.setValueAtTime(v, t + dur - 1.2); g.gain.linearRampToValueAtTime(0, t + dur);
  s.start(t, off); s.stop(t + dur + 0.05); RECNOW.push({ s, g });
}
// 타구가 날아가는 동안 관중이 술렁이며 커지고, 결과에 따라 길게 환호(hit·big)하거나 금세 사그라듦(fade)
function crowdSwell(c, t0, t1, kind, sc = 1){
  const buf = RECBUF.crowd; if(!buf){ recLoad('crowd'); return; }
  const s = c.createBufferSource(), g = c.createGain(), now = c.currentTime;
  s.buffer = buf; s.connect(g); g.connect(c.destination);
  const cfg = SFX_MAP.crowd[kind] || SFX_MAP.crowd.hit, a = now + t0, b = now + t1, peak = cfg.peak * sc;
  g.gain.setValueAtTime(0.05, a); g.gain.linearRampToValueAtTime(0.45 * sc, b);
  if(kind === 'fade'){ g.gain.linearRampToValueAtTime(0.5, b + 0.15); g.gain.linearRampToValueAtTime(0, b + 0.9); s.start(a, Math.random() * 40); s.stop(b + 1); }
  else { cheer(c, t1 + 0.05, kind === 'big', sc); const hold = cfg.hold; g.gain.linearRampToValueAtTime(peak, b + 0.3); g.gain.setValueAtTime(peak, b + hold); g.gain.linearRampToValueAtTime(0, b + hold + 1.5); s.start(a, Math.random() * 40); s.stop(b + hold + 1.6); }
  RECNOW.push({ s, g });
}
// 함성은 처음 누를 때 미리 불러 둠 (첫 홈런에도 바로 나오게)
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if(SET.snd !== false){ recLoad('cheer1'); recLoad('cheer2'); } }, { capture:true, once:true }));
// 화면 모드의 배경 관중 소리 (설정에서 켜고 끔)
const CROWD = { src:null };
function crowdSync(){
  const want = SET.snd && SET.sndKind !== 'synth' && VIEW.crowd() && !!(UI.S && UI.S.board) && !document.hidden;
  if(!want){ if(CROWD.src){ try{ CROWD.src.stop(); }catch(e){} CROWD.src = null; } return; }
  if(CROWD.src) return;
  const c = SFX.ctx; if(!c) return;   // 첫 터치 전에는 소리를 만들지 않음
  if(c.state !== 'running'){ c.resume().then(() => crowdSync()).catch(() => {}); return; }
  if(!RECBUF.crowd){ recLoad('crowd'); if(RECLOAD.crowd) RECLOAD.crowd.then(() => crowdSync()); return; }
  const s = c.createBufferSource(), g = c.createGain();
  s.buffer = RECBUF.crowd; s.loop = true; g.gain.value = 0.22;   // 전체를 키웠으므로 배경 관중은 조금 낮춤 s.connect(g); g.connect(c.destination); s.start();
  CROWD.src = s;
}
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => setTimeout(crowdSync, 50), { capture:true }));
document.addEventListener('visibilitychange', () => crowdSync());
// vibMs: 진동을 미룰 시간(ms). 결과가 정해지는 순간(공이 닿거나 타자가 베이스에 닿는 때)에 울리게 하려고 결과를 기다리는 시간만큼 미룸
function playFx(list, vibMs = 0){
  if(!list || !list.length) return;
  const uniq = [...new Set(list)];
  if(SET.snd){
    const c = audio();
    if(c){
      // 녹음 효과음이 맡지 않는 소리(득점·판독·채팅 등)는 간단한 소리로
      const rec = SET.sndKind !== 'synth' && playRec(c, uniq);
      const rest = rec ? uniq.filter(n => !REC[n] && !['mitt', 'xbh'].includes(n)) : uniq.map(n => SYN[n] || n);
      let t = c.currentTime + 0.02;
      [...new Set(rest)].slice(0, 3).forEach(n => { if(SOUNDS[n]){ try{ SOUNDS[n](c, t + (rec ? 1.2 : 0)); }catch(e){} t += 0.35; } });
    }
  }
  if(SET.vib && navigator.vibrate){
    const vn = uniq.map(n => /^whiff-/.test(n) ? 'strike' : n);   // 헛스윙도 스트라이크
    const top = FX_RANK.find(n => vn.includes(n) && VIB[n]);
    if(top){ const buzz = () => { try{ navigator.vibrate(VIB[top]); }catch(e){} }; if(vibMs > 0) setTimeout(buzz, vibMs); else buzz(); }
  }
}
