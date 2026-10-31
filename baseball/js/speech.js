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
  if(SET.voice === 'tts') ttsSay(text);
  else if(SET.voice === 'sr') liveSay(text);
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
  return SFX.ctx;
}
document.addEventListener('pointerdown', () => { const c = audio(); if(c && c.state === 'suspended') c.resume().catch(() => {}); }, true);
document.addEventListener('keydown', () => { const c = audio(); if(c && c.state === 'suspended') c.resume().catch(() => {}); }, true);
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
const VIB = { review:[60, 60, 60, 60, 200], chat:[40, 60, 40], hit:[80], xbh:[80, 60, 80], b2:[80, 60, 80], b3:[80, 60, 80, 60, 80], hr:[100, 60, 100, 60, 400], score:[60, 40, 60], k:[250], out:[120], ball:[30], end:[300, 100, 300], safe:[40, 40, 40] };
// 한 번의 선택으로 여러 효과가 나오면 가장 중요한 것 하나(간단한 소리는 순서대로 최대 3개)
const FX_RANK = ['chat', 'roger', 'end', 'review', 'hr', 'score', 'b3', 'b2', 'xbh', 'hit', 'k', 'out', 'safe', 'ball', 'change', 'bunt', 'bat', 'foul', 'whiff', 'mitt'];
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
function recPreload(){ [...new Set(Object.values(REC).flat())].forEach(recLoad); }
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
  const main = REC_MAIN.find(n => uniq.includes(n)), contact = REC_CONTACT.find(n => uniq.includes(n));
  const pitch = uniq.includes('pitch'), change = uniq.includes('change');
  if(!main && !contact && !pitch && !change && !uniq.includes('batter')) return false;
  recStopAll(c);
  // 투구(짧은 바람 소리) → 방망이(헛스윙·타격음) → 결과 → 공수교대 순서로, 겹치지 않게 조금씩 띄움
  let t = 0.02;
  // 화면 보며 하기: 그림 움직임에 맞춤 (공이 손을 떠날 때 피칭, 공이 올 때 타격, 잡거나 떨어질 때 결과)
  const gx = SET.view === 'gfx' && pitch && typeof G !== 'undefined' && G && G.anim;
  if(gx){
    recPlay(c, 'pitch', 0.3, 0.6);
    if(contact) recPlay(c, recPick(contact), 0.7, 0.9);
    t = G.anim.res === 'inplay' && G.anim.bb ? 1.0 + (G.anim.bb.type === 'gb' ? 1.3 : 1.9) : 0.8;
  } else {
    if(pitch){ recPlay(c, 'pitch', t, 0.6); t += 0.35; }
    if(contact){ recPlay(c, recPick(contact), t, 0.9); t += contact === 'batBig' ? 0.45 : 0.3; }
  }
  if(main){ const d = recPlay(c, recPick(main), t, 0.85, main === 'hr' ? 10 : 4); t += Math.min(d || 1, 2.5); }
  if(change) recPlay(c, 'change', t, 0.7, 4);
  else if(!pitch && !main && !contact && uniq.includes('batter')) recPlay(c, 'atbat', t, 0.6, 3);
  return true;
}
// 화면 모드의 배경 관중 소리 (설정에서 켜고 끔)
const CROWD = { src:null };
function crowdSync(){
  const want = SET.snd && SET.sndKind !== 'synth' && SET.crowd && SET.view === 'gfx' && !!(UI.S && UI.S.board) && !document.hidden;
  if(!want){ if(CROWD.src){ try{ CROWD.src.stop(); }catch(e){} CROWD.src = null; } return; }
  if(CROWD.src) return;
  const c = SFX.ctx; if(!c) return;   // 첫 터치 전에는 소리를 만들지 않음
  if(c.state !== 'running'){ c.resume().then(() => crowdSync()).catch(() => {}); return; }
  if(!RECBUF.crowd){ recLoad('crowd'); if(RECLOAD.crowd) RECLOAD.crowd.then(() => crowdSync()); return; }
  const s = c.createBufferSource(), g = c.createGain();
  s.buffer = RECBUF.crowd; s.loop = true; g.gain.value = 0.35; s.connect(g); g.connect(c.destination); s.start();
  CROWD.src = s;
}
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => setTimeout(crowdSync, 50), { capture:true }));
document.addEventListener('visibilitychange', () => crowdSync());
function playFx(list){
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
    const top = FX_RANK.find(n => uniq.includes(n) && VIB[n]);
    if(top) try{ navigator.vibrate(VIB[top]); }catch(e){}
  }
}
