'use strict';
/* ===================== 소리 =====================
   땡(타이머 끝) · 딩동댕동(방송 문구) · 무전 효과음(로저 비프음 roger.wav, 끝 신호, 통화 중)
   브라우저는 사람이 한 번 눌러야 소리를 낼 수 있어서, 화면을 처음 누를 때 소리를 켜 둠 */
const SND = {
  ctx:null,
  ensure(){
    try{
      if(!this.ctx){
        const C = window.AudioContext || window.webkitAudioContext; if(!C) return null; this.ctx = new C();
        this.ctx.addEventListener('statechange', () => { if(this.ctx.state !== 'running' && typeof talkAbort === 'function') talkAbort(); });
      }
      if(this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    }catch(e){ return null; }
    return this.ctx;
  },
  ready(){ return !!this.ctx && this.ctx.state === 'running'; },
  unlock(){ this.ensure(); this.loadRoger(); },
  rogerBuf:null, rogerLoading:false,
  loadRoger(){
    const c = this.ctx; if(!c || this.rogerBuf || this.rogerLoading) return;
    this.rogerLoading = true;
    fetch('roger.wav').then(r => r.arrayBuffer()).then(a => new Promise((res, rej) => c.decodeAudioData(a, res, rej)))
      .then(b => { this.rogerBuf = b; }).catch(() => { this.rogerLoading = false; });
  },
  // 무전 시작 효과음: 재생하고, 소리가 끝날 때까지 걸리는 시간(초)을 돌려줌. at: AudioContext 시각
  roger(at){
    const c = this.ensure(); if(!c) return 0;
    this.loadRoger();
    const t = at != null ? at : c.currentTime + 0.01;
    if(!this.rogerBuf){ this.tone(1950, t + 0.01, 0.12, 0.5); return 0.16; }
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = this.rogerBuf; g.gain.value = 0.9;
    s.connect(g).connect(c.destination); s.start(t);
    return this.rogerBuf.duration + 0.01;
  },
  tone(freq, t0, dur, vol = 0.45){
    const c = this.ctx; if(!c) return;
    const o = c.createOscillator(), g = c.createGain(), o2 = c.createOscillator(), g2 = c.createGain();
    o.type = 'sine'; o.frequency.value = freq; o2.type = 'sine'; o2.frequency.value = freq * 2;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g2.gain.setValueAtTime(0.0001, t0); g2.gain.exponentialRampToValueAtTime(vol * 0.25, t0 + 0.02); g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.6);
    o.connect(g).connect(c.destination); o2.connect(g2).connect(c.destination);
    o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.05); o2.stop(t0 + dur + 0.05);
  },
  tones(notes, vol = 0.4, at){
    const c = this.ensure(); if(!c) return 0;
    const t = at != null ? at : c.currentTime + 0.03;
    notes.forEach(([f, dt, d]) => this.tone(f, t + dt, d, vol));
    return Math.max(...notes.map(n => n[1] + n[2]));
  },
  endTone(at){ return this.tones([[900, 0, 0.12], [600, 0.15, 0.12]], 0.4, at); },          // 무전 끝: '뚜-뚜'
  busy(){ return this.tones([[480, 0, 0.1], [480, 0.17, 0.1], [480, 0.34, 0.1]], 0.4); },   // 누가 말하는 중: '뚜뚜뚜'
  ping(){ return this.tones([[1250, 0, 0.09]], 0.25); },                                     // 문자 무전 도착
  chime(){ return this.tones([[523.25, 0, 0.9], [659.25, 0.42, 0.9], [783.99, 0.84, 0.9], [1046.5, 1.26, 1.5]], 0.45); }, // 딩동댕동
  fanfare(){ return this.tones([[523.25, 0, 0.25], [659.25, 0.18, 0.25], [783.99, 0.36, 0.25], [1046.5, 0.54, 1.1]], 0.5); },
  // 정답 발표 직전 '두구두구' 북소리 (소리 파일이 없을 때): 걸리는 시간(초)을 돌려줌
  drumroll(sec = 1.6){
    const c = this.ensure(); if(!c) return 0;
    const t0 = c.currentTime + 0.03, n = Math.floor(sec / 0.055);
    const nb = c.createBuffer(1, Math.floor(c.sampleRate * 0.08), c.sampleRate), d = nb.getChannelData(0);
    for(let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.02));
    for(let i = 0; i < n; i++){
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = nb; f.type = 'bandpass'; f.frequency.value = 180 + Math.random() * 40; f.Q.value = 0.9;
      g.gain.value = 0.35 + 0.45 * (i / n);
      s.connect(f).connect(g).connect(c.destination); s.start(t0 + i * 0.055 + Math.random() * 0.008);
    }
    // 마지막에 '쾅'
    this.tone(98, t0 + sec, 0.6, 0.6); this.tone(147, t0 + sec, 0.5, 0.35);
    return sec + 0.15;
  },
  // 골든벨 '땡!': 금속 종처럼 배음이 어긋난 소리를 세게 한 번 치고 길게 울림
  bell(vol = 0.9){
    const c = this.ensure(); if(!c) return 0;
    const t = c.currentTime + 0.02, out = c.createGain();
    out.gain.value = vol; out.connect(c.destination);
    const base = 784;
    [[1, 1.0, 3.2], [2.0, 0.55, 2.2], [2.76, 0.45, 1.6], [4.07, 0.28, 1.0], [5.4, 0.18, 0.7], [8.93, 0.1, 0.35]].forEach(([r, a, d]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = base * r;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a * 0.5, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05);
    });
    // 치는 순간의 '딱' 소리
    const n = c.createBuffer(1, Math.floor(c.sampleRate * 0.03), c.sampleRate), ch = n.getChannelData(0);
    for(let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    const s = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
    s.buffer = n; hp.type = 'highpass'; hp.frequency.value = 2500; g.gain.value = 0.35;
    s.connect(hp).connect(g).connect(out); s.start(t);
    return 3.2;
  },
};
document.addEventListener('pointerdown', () => SND.unlock(), true);
document.addEventListener('keydown', () => SND.unlock(), true);
