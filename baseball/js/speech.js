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
  end:   (c, t) => { [392, 523, 659, 784].forEach((f, i) => tone(c, t + i * 0.18, 0.3, f, 0.18, 'triangle')); },
};
const VIB = { hit:[80], xbh:[80, 60, 80], hr:[100, 60, 100, 60, 400], score:[60, 40, 60], k:[250], out:[120], ball:[30], end:[300, 100, 300], safe:[40, 40, 40] };
// 한 번의 선택으로 여러 효과가 나오면 가장 중요한 것 하나(소리는 순서대로 최대 3개)
const FX_RANK = ['end', 'hr', 'score', 'xbh', 'hit', 'k', 'out', 'safe', 'ball', 'change', 'bunt', 'bat', 'foul', 'whiff', 'mitt'];
function playFx(list){
  if(!list || !list.length) return;
  const uniq = [...new Set(list)];
  if(SET.snd){
    const c = audio();
    if(c){ let t = c.currentTime + 0.02; uniq.slice(0, 3).forEach(n => { if(SOUNDS[n]){ try{ SOUNDS[n](c, t); }catch(e){} t += 0.35; } }); }
  }
  if(SET.vib && navigator.vibrate){
    const top = FX_RANK.find(n => uniq.includes(n) && VIB[n]);
    if(top) try{ navigator.vibrate(VIB[top]); }catch(e){}
  }
}
