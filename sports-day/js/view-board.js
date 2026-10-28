'use strict';
/* ===================== 현황판 (요약) ===================== */

// 단체전 승점 카드 (compact: 휴대폰의 현황 탭처럼 좁은 화면에서 촘촘하게)
function teamCard(compact){
  const tot = totalPoints();
  // 이긴 판 수에 종목의 승점(기본 1)을 곱해서 보여 줌
  const rows = Object.entries(TEAM).map(([k,E]) => { const t = tally(k), p = E.pts||1;
    return `<tr><td><span class="row nowrap" style="gap:8px"><span style="font-size:22px">${E.icon}</span><b>${esc(E.name)}</b>${p>1 ? `<span class="sub">(이기면 ${p}점)</span>` : ''}</span></td><td class="num score" style="color:var(--blue)">${t.blue*p}</td><td class="num score" style="color:var(--red)">${t.red*p}</td><td class="num sub">${matchesOf(k).length}판</td></tr>`; }).join('');
  return `<div class="card${compact?' stcard stteam':''}"><h2>단체전 승점</h2>
      <div class="totals"><div class="tbox blue"><div class="t">${esc(teamName('blue'))}</div><div class="v">${tot.blue}</div></div><div class="tbox red"><div class="t">${esc(teamName('red'))}</div><div class="v">${tot.red}</div></div></div>
      <table style="margin-top:12px"><thead><tr><th>종목</th><th class="num">${esc(teamShort('blue'))}</th><th class="num">${esc(teamShort('red'))}</th><th class="num">진행</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="sub">${Object.values(TEAM).some(E => (E.pts||1)>1) ? '한 판 이길 때마다 종목별 승점이 올라갑니다.' : '한 판 이길 때마다 승점 1점입니다.'} 다른 기기에서 입력한 결과가 바로 반영됩니다.</p></div>`;
}
// 개인전 종목 하나의 1~3등 카드 (compact: 한 줄씩 촘촘하게)
function indivCard(k, compact){
  const E = INDIV[k], { list, ties } = standings(k), top = list.filter(x => x.rank<=3), wn = qList(k).length;
  // 안내판에 연습 순위도 보이기 (마스터 설정): 연습 1·2의 1~3등을 작게 (마스터 메뉴의 촘촘한 현황에서는 뺌)
  const prac = !compact && settings().showPracRank && hasPrac(k) ? ['p1','p2'].map(rd => { const rs = roundStandings(k, rd).list.filter(x => x.rank<=3).slice(0,5);
    return rs.length ? `<div class="prline"><b>${ROUNDS[rd]}</b>${rs.map(x => `<span><em>${x.rank}위</em> ${esc(x.p.name)} <i>${sc(k, x.total)}</i></span>`).join('')}</div>` : ''; }).join('') : '';
  const tieNotes = ties.filter(t => !t.resolved).map(t => `<div class="note"${compact ? '' : ' style="margin-top:10px"'}>⚠ ${sc(k, t.total)} 동점: ${t.names.map(esc).join(', ')} → 결승 필요</div>`).join('');
  if(compact) return `<div class="card stcard" style="--ev:${E.color}"><div class="sthead"><b>${E.icon} ${esc(E.name)}</b><span class="tag ${wn?'dark':''}">대기 ${wn}명</span><span class="sub">${list.length}명 기록</span></div>
      ${tieNotes}${top.length ? top.map(x => `<div class="strow"><span class="rk">${x.rank}</span><b class="nm">${esc(x.p.name)}</b><span class="v">${sc(k, x.total)}${x.ftotal!=null?` <span class="sub">(결승 ${fmtNum(x.ftotal)})</span>`:''}</span></div>`).join('') : '<div class="empty">아직 본선 기록이 없습니다.</div>'}${prac ? `<div class="pracrank">${prac}</div>` : ''}</div>`;
  return `<div class="card"><div class="row"><h2 class="grow h2" style="margin:0">${E.icon} ${esc(E.name)}</h2><span class="tag ${wn?'dark':''}">대기 ${wn}명</span><span class="sub">${list.length}명 기록</span></div>
      ${tieNotes}
      ${top.length ? `<table><tbody>${top.map(x => `<tr><td class="rank">${x.rank}</td><td><b>${esc(x.p.name)}</b></td><td class="num"><span class="score">${sc(k, x.total)}</span>${x.ftotal!=null?` <span class="sub">(결승 ${fmtNum(x.ftotal)})</span>`:''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">아직 본선 기록이 없습니다.</div>'}${prac ? `<div class="pracrank">${prac}</div>` : ''}</div>`;
}
function boardView(){
  return `<div class="cols half">
    ${teamCard(false)}
    <div><h2 style="margin:4px 2px 12px;font-size:20px">개인전 순위 (1~3등)</h2><div class="sumcards">${Object.keys(INDIV).map(k => indivCard(k, false)).join('')}</div></div></div>`;
}
// 마스터 안내판 메뉴의 현황 탭: 개인전 / 단체전
function statIndiv(){
  const evs = Object.keys(INDIV);
  if(!evs.length) return '<div class="card empty">켜져 있는 개인전 종목이 없습니다.</div>';
  return `<div class="stgrid">${evs.map(k => indivCard(k, true)).join('')}</div>`;
}
function statTeam(){ return teamCard(true); }

/* ===================== 소리 (띵동·차임벨·음성) ===================== */
const SND = {
  ctx:null, unlocked:false, wasRunning:false,
  ensure(){
    try{
      if(!this.ctx){
        const C = window.AudioContext || window.webkitAudioContext; if(!C) return null; this.ctx = new C();
        // 전화 등으로 소리가 끊기면(interrupted·suspended) 말하던 중이었다면 송신을 끝냄
        this.ctx.addEventListener('statechange', () => {
          const st = this.ctx.state;
          if(st==='running') this.wasRunning = true;
          else { const was = this.wasRunning; this.wasRunning = false; if(was && typeof talkAbort==='function') talkAbort(); }
        });
      }
      if(this.ctx.state==='suspended') this.ctx.resume().catch(()=>{});
    }catch(e){ return null; }
    return this.ctx;
  },
  ready(){ return !!this.ctx && this.ctx.state==='running'; },
  // 화면을 처음 누를 때 소리와 음성을 켜 둠 (태블릿은 사람이 한 번 눌러야 소리를 낼 수 있음)
  unlock(){
    this.ensure();
    this.unlocked = true;
    this.loadRoger();
  },
  // 무전 시작 효과음(로저 비프음, 약 0.16초): 미리 불러 두고, 아직 못 불러왔으면 비슷한 '삑'으로 대신함
  rogerBuf:null, rogerLoading:false,
  loadRoger(){
    const c = this.ctx; if(!c || this.rogerBuf || this.rogerLoading) return;
    this.rogerLoading = true;
    fetch('roger.wav').then(r => r.arrayBuffer()).then(a => new Promise((res, rej) => c.decodeAudioData(a, res, rej)))
      .then(b => { this.rogerBuf = b; }).catch(() => { this.rogerLoading = false; });
  },
  // 재생하고, 지금부터 소리가 끝날 때까지 걸리는 시간(초)을 돌려줌
  roger(){
    const c = this.ensure(); if(!c) return 0;
    this.loadRoger();
    if(!this.rogerBuf){ const t = c.currentTime + 0.02; this.tone(1950, t, 0.12, 0.5); return 0.16; }
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = this.rogerBuf; g.gain.value = 0.9;
    s.connect(g).connect(c.destination); s.start(c.currentTime + 0.01);
    return this.rogerBuf.duration + 0.01;
  },
  tone(freq, t0, dur, vol=0.45){
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), o2 = c.createOscillator(), g2 = c.createGain();
    o.type = 'sine'; o.frequency.value = freq; o2.type = 'sine'; o2.frequency.value = freq*2;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0+0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    g2.gain.setValueAtTime(0.0001, t0); g2.gain.exponentialRampToValueAtTime(vol*0.25, t0+0.02); g2.gain.exponentialRampToValueAtTime(0.0001, t0+dur*0.6);
    o.connect(g).connect(c.destination); o2.connect(g2).connect(c.destination);
    o.start(t0); o2.start(t0); o.stop(t0+dur+0.05); o2.stop(t0+dur+0.05);
  },
  play(notes){ const c = this.ensure(); if(!c) return 0; const t = c.currentTime+0.08; notes.forEach(([f, dt, d]) => this.tone(f, t+dt, d)); return Math.max(...notes.map(n => n[1]+n[2])); },
  // ----- 무전 효과음 (모두 sine 두 겹 톤). at: 소리를 낼 AudioContext 시각(없으면 지금)
  tones(notes, vol=0.4, at){
    const c = this.ensure(); if(!c) return 0;
    const t = at != null ? at : c.currentTime + 0.03;
    notes.forEach(([f, dt, d]) => this.tone(f, t+dt, d, vol));
    return Math.max(...notes.map(n => n[1]+n[2])) + (at != null ? 0 : 0.03);
  },
  chirp(){ return this.tones([[1800, 0, 0.06], [2400, 0.075, 0.06]], 0.35); },                       // 말해도 좋다는 짧은 '삑삑'
  endTone(at){ return this.tones([[900, 0, 0.12], [600, 0.15, 0.12]], 0.4, at); },                   // 말이 끝남: 낮아지는 '뚜-뚜'
  busy(){ return this.tones([[480, 0, 0.1], [480, 0.17, 0.1], [480, 0.34, 0.1]], 0.4); },           // 누군가 말하는 중: '뚜뚜뚜'
  warn(){ return this.tones([[1200, 0, 0.25]], 0.4); },                                              // 50초 경고
  dingdong(){ return this.play([[659.25, 0, 1.1], [523.25, 0.55, 1.5]]); },                       // 띵-동 (선수 호출)
  chime(){ return this.play([[523.25, 0, 0.9], [659.25, 0.42, 0.9], [783.99, 0.84, 0.9], [1046.5, 1.26, 1.5]]); }, // 딩동댕동 (안내방송)
  fanfare(){ return this.play([[523.25, 0, 0.25], [659.25, 0.18, 0.25], [783.99, 0.36, 0.25], [1046.5, 0.54, 1.0]]); },
  // 읽어 주기: 기기 설정(자동·기기 음성·보이스오버·끄기)에 맞춰 읽음 → js/speech.js
  speak(text){ if(typeof say === 'function') say(text); },
};
document.addEventListener('pointerdown', () => { if(myRole().role==='board'){ const was = SND.ready(); SND.unlock(); if(!was) setTimeout(() => { queueRender(); touchDevice(); }, 400); } }, true);

/* ===================== 안내판 ===================== */
// 이 안내판 기기에서만 소리 끄기(읽기가 안 되는 기기 대신 다른 기기를 스피커 쪽 안내판으로 쓸 때)
const bdMute = () => !!ls.get('udh5_bdmute', false);
ACT.bdMute = () => { ls.set('udh5_bdmute', !bdMute()); touchDevice(); toast(bdMute() ? '이 기기에서는 안내판 소리를 내지 않습니다.' : '이 기기에서 안내판 소리를 냅니다.'); drawSheet(); return false; };
const RESULT_MS = 7000, CALL_MS = 30000, ANN_MS = 15000, FLASH_MS = 8000, PERSON_MS = 120000;
const BOARD = { init:false, seen:new Set(), lastCall:{}, lastCc:{}, ccInit:false, ccFx:null, annId:null, testAt:0, overlay:null, queue:[], busy:false, timer:0, callFx:null, person:null, personAt:0 };
// 지금 안내판에 띄울 화면: 마스터가 정한 것, 자동이면 가장 최근에 기록이 들어온 종목
function boardTarget(){
  const m = boardCfg().mode || 'auto';
  if(m==='indiv' || m==='summary' || m==='awards') return { kind:m };
  if(m.startsWith('team:') && TEAM[m.slice(5)]) return { kind:'team', ev:m.slice(5) };
  let best = { t:0, kind:'indiv' };
  D.matches.forEach(x => { const t = Math.max(x.at||0, x.editedAt||0); if(!x.deleted && TEAM[x.event] && t>best.t) best = { t, kind:'team', ev:x.event }; });
  Object.entries(D.calls).forEach(([ev, c]) => { const t = (c.call||{}).at||0; if(TEAM[ev] && t>best.t) best = { t, kind:'team', ev }; });
  // 감독이 자기 팀 선수를 부른 것도 가장 최근 활동으로 침
  Object.values(D.ccalls).forEach(c => { const t = c.at||0; if(TEAM[c.event] && ORDER_EVENTS.includes(c.event) && t>best.t) best = { t, kind:'team', ev:c.event }; });
  D.indiv.forEach(x => { const t = Math.max(x.at||0, x.editedAt||0); if(t>best.t) best = { t, kind:'indiv' }; });
  return best;
}
const boardOn = () => myRole().role==='board';
// 데이터가 바뀔 때마다 새 결과·호출·안내가 있는지 살펴 소리를 내고 화면 효과를 띄움
function boardTick(){
  if(!boardOn()) return;
  const cfg = boardCfg(), ann = D.config.announce || {};
  if(!BOARD.init){
    if(!D.loaded.matches || !D.loaded.calls || !D.loaded.config) return;
    D.matches.forEach(m => BOARD.seen.add(m.id));
    Object.entries(D.calls).forEach(([ev, c]) => BOARD.lastCall[ev] = (c.call||{}).at||0);
    BOARD.annId = ann.id || null; BOARD.testAt = cfg.testAt || 0; BOARD.awardStep = awardsStep();
    BOARD.init = true; return;
  }
  D.matches.slice().sort((a,b) => (a.at||0)-(b.at||0)).forEach(m => {
    if(BOARD.seen.has(m.id)) return;
    BOARD.seen.add(m.id);
    if(!m.deleted && TEAM[m.event] && (m.at||0) > now()-120000) BOARD.queue.push({ kind:'result', m });
  });
  Object.entries(D.calls).forEach(([ev, c]) => {
    const call = c.call || {};
    if((call.at||0) > (BOARD.lastCall[ev]||0)){ BOARD.lastCall[ev] = call.at; if(TEAM[ev] && call.at > now()-120000) BOARD.queue.push({ kind:'call', ev, call }); }
  });
  // 감독이 부른 선수: 처음 불러온 것은 이미 본 것으로 치고, 그 뒤에 새로 생긴 것만 알림
  if(D.loaded.ccalls){
    if(!BOARD.ccInit){ Object.values(D.ccalls).forEach(c => { BOARD.lastCc[c.id] = c.at||0; }); BOARD.ccInit = true; }
    else Object.values(D.ccalls).forEach(c => {
      if((c.at||0) > (BOARD.lastCc[c.id]||0)){ BOARD.lastCc[c.id] = c.at; if(TEAM[c.event] && c.at > now()-120000) BOARD.queue.push({ kind:'ccall', c }); }
    });
  }
  if(ann.id && ann.id!==BOARD.annId){ BOARD.annId = ann.id; if(ann.text && !ann.cleared) BOARD.queue.push({ kind:'ann', ann }); }
  if((cfg.testAt||0) > BOARD.testAt){ BOARD.testAt = cfg.testAt; BOARD.queue.push({ kind:'test' }); }
  const st = awardsStep();
  if(st!==BOARD.awardStep){ BOARD.awardStep = st; BOARD.awardAt = now(); if(st>=0 && cfg.mode==='awards') BOARD.queue.push({ kind:'award', step:st }); }
  runFx();
}
// 효과(소리·화면)는 하나씩 차례로: 결과 → 다음 선수 호출 → 안내방송 순서가 섞이지 않게 함
function runFx(){
  // 음성 안내방송 중에는 호출·결과 소리를 방송이 끝난 뒤로 미룸
  if(BOARD.busy || RADIO.lock.cast) return;
  const fx = BOARD.queue.shift(); if(!fx) return;
  const cfg = boardCfg(), sound = cfg.sound && SND.ready() && !bdMute();
  const voiceMs = cfg.callVoice && sound ? 5000 : 2200;
  BOARD.busy = true;
  let dur = 1800;
  if(fx.kind==='test'){ if(sound){ const d = SND.dingdong(); if(cfg.callVoice) setTimeout(() => SND.speak('안내판 소리 시험입니다.'), d*1000+200); dur = voiceMs; } toast('안내판 소리 시험'); }
  else if(fx.kind==='call' || fx.kind==='autocall'){
    let c = fx.call;
    if(fx.kind==='autocall'){ const pa = prepAhead(), b = upcoming(fx.ev,'blue',pa), r = upcoming(fx.ev,'red',pa); c = b && r ? { kind:'next', blue:b, red:r, ahead:pa } : null; }
    if(c){
      const ahead = c.ahead != null ? c.ahead : (c.kind==='now' ? 0 : 1);
      BOARD.callFx = { ev:fx.ev, kind:c.kind, blue:c.blue, red:c.red, ahead, start:now() };
      if(sound){ const d = SND.dingdong(); if(cfg.callVoice) setTimeout(() => SND.speak(callText(c.blue, c.red, c.kind, ahead)), d*1000+200); }
      dur = voiceMs;
    } else dur = 0;
  } else if(fx.kind==='ccall'){
    const c = fx.c, T = boardTarget();
    // 그 종목 화면을 보고 있으면 위쪽 호출 띠로, 다른 화면이면 잠깐 화면 가득 띄움
    if(T.kind==='team' && T.ev===c.event){ BOARD.ccFx = { ev:c.event, team:c.team, pid:c.pid, kind:c.kind, ahead:c.ahead, start:now() }; dur = voiceMs; }
    else { BOARD.overlay = { kind:'ccall', c, start:now() }; dur = 7000; }
    if(sound){ const d = SND.dingdong(); if(cfg.callVoice) setTimeout(() => SND.speak(ccallText(c)), d*1000+200); }
  } else if(fx.kind==='ann'){
    BOARD.overlay = { kind:'ann', ann:fx.ann, start:now() }; dur = ANN_MS;
    if(sound){ const d = cfg.chime ? SND.chime() : 0; if(fx.ann.voice!==false) setTimeout(() => SND.speak(fx.ann.text), d*1000+300); }
  } else if(fx.kind==='award'){
    const s = awardSteps()[fx.step];
    BOARD.awardAt = now(); dur = 4000;
    if(sound && s){ const d = SND.fanfare(); if(cfg.callVoice) setTimeout(() => SND.speak(awardSpeech(s)), d*1000+300); dur = 7000; }
  } else if(fx.kind==='result'){
    BOARD.overlay = { kind:'result', m:fx.m, start:now() }; dur = RESULT_MS;
    if(sound) SND.fanfare();
  }
  queueRender();
  BOARD.timer = setTimeout(finishFx, dur);
}
function finishFx(){
  clearTimeout(BOARD.timer);
  const done = BOARD.overlay;
  BOARD.overlay = null; BOARD.busy = false;
  // 결과를 보여 준 뒤에는 다음 선수를 부름 (뒤에 결과가 더 밀려 있으면 마지막 결과 뒤에만)
  if(done && done.kind==='result' && TEAM[done.m.event] && TEAM[done.m.event].mode!=='round' && !BOARD.queue.some(f => f.kind==='result' && f.m.event===done.m.event))
    BOARD.queue.unshift({ kind:'autocall', ev:done.m.event });
  queueRender(); runFx();
}
// 호출 문구: 몇 번째 뒤 선수인지 함께 말함 (ahead 1 다음, 2 다다음, 3 세 번째 뒤). 이름을 골라 부른 경우처럼 모르면 '준비해 주세요'만
const aheadWord = a => (a > 0 && AHEAD_LABEL[a]) ? AHEAD_LABEL[a] + ' 선수' : '';
function callLabel(kind, ahead){ if(kind==='now') return '📣 지금 나와 주세요'; const w = aheadWord(ahead); return `📣 ${w ? w + ', ' : ''}준비해 주세요`; }
function ccallText(c){
  const w = c.kind==='now' ? '' : aheadWord(c.ahead);
  return `${w ? w + ', ' : ''}${teamName(c.team)} ${pname(c.pid)} 선수, ${c.kind==='now' ? '지금 경기장으로 나와 주세요.' : '준비해 주세요.'}`;
}
function callText(blue, red, kind, ahead){
  const w = kind==='now' ? '' : aheadWord(ahead == null ? 1 : ahead);
  return `${w ? w + ', ' : ''}${teamName('blue')} ${pname(blue)}, ${teamName('red')} ${pname(red)} 선수, ${kind==='now' ? '지금 경기장으로 나와 주세요.' : '준비해 주세요.'}`;
}
// 깜빡임: 다시 그려도 애니메이션이 처음부터 다시 시작되지 않게 시작 시각만큼 앞당김
function flashAttr(start, dur=FLASH_MS){
  if(!boardCfg().flash || !start || now()-start > dur) return '';
  return ` data-flash="1" style="animation-delay:-${now()-start}ms"`;
}

function boardScreen(){
  boardTick();
  const T = boardTarget(), ann = D.config.announce || {}, pc = bdPC();
  const C = RADIO.lock.cast;
  const annStrip = (C ? `<div class="caststrip"${flashAttr(C.at || now(), 60000)}>📢 안내방송 중 · ${esc(C.name||'')}</div>` : '')
    + (ann.text && !ann.cleared && (now()-(ann.at||0)) < 6*3600*1000 ? `<div class="annstrip"${flashAttr(ann.at)}>📢 ${esc(ann.text)}</div>` : '')
    + (T.kind==='awards' ? '' : boardScheduleStrip());
  let body;
  if(T.kind!=='indiv') BOARD.person = null;
  if(T.kind==='team') body = boardTeam(T.ev);
  else if(T.kind==='summary') body = `<div class="bdhead"><h1>📊 종합 현황</h1></div><div class="bdsum">${boardView()}</div>`;
  else if(T.kind==='awards') body = boardAwards();
  else body = boardIndiv();
  const cfg = boardCfg();
  const soundHint = boardOn() && cfg.sound && !bdMute() && (!SND.ready() || (typeof TTS==='object' && TTS.needTap)) ? `<button class="soundhint" data-a="bdSound">🔈 화면을 한 번 눌러 소리를 켜 주세요</button>` : '';
  const fixed = T.kind==='team' && TEAM[T.ev] && TEAM[T.ev].mode==='duel' && teamOpt(T.ev).board;     // 과녁판 중계 화면은 한 화면에 고정
  // PC·프로젝터 화면: 안내판 전체를 한 화면에 꼭 맞게 (글자 크기는 board-pc.js 가 화면 크기에 맞춰 정함)
  const key = T.kind + (T.ev || '') + (BOARD.person ? 'P' : '');
  return `<div class="bd ${fixed?'bdfix':''}${pc?' bdpc':''}"${pc ? ` data-fit="1" data-fskey="${key}"${T.kind==='indiv' && !BOARD.person ? ' data-fsmax="44"' : ''}` : ''}>${pc ? body + annStrip : annStrip + body}</div>${boardOverlay()}${soundHint}`;
}
function boardTeam(ev){
  const E = TEAM[ev], t = tally(ev), tot = totalPoints(), n = matchesOf(ev).length + 1;
  const head = `<div class="bdhead"><span class="bic">${E.icon}</span><h1>${esc(E.name)}</h1><span class="bsub">${E.mode==='round'?`${n}판째`:`${n}번째 대결`}</span><span class="grow"></span>
    <div class="bscore">${teamBadge('blue',true)}<span class="n blue">${t.blue}</span><span class="c">:</span><span class="n red">${t.red}</span>${teamBadge('red',true)}</div></div>`;
  const foot = `<div class="bdfoot"><b>전체 승점</b><span class="tot blue">${esc(teamName('blue'))} ${tot.blue}</span><span class="tot red">${esc(teamName('red'))} ${tot.red}</span>
    <span class="grow"></span>${Object.entries(TEAM).filter(([k]) => k!==ev).map(([k,X]) => { const x = tally(k); return `<span class="mini">${X.icon} ${x.blue}:${x.red}</span>`; }).join('')}</div>`;
  if(E.mode==='round') return head + `<div class="bdvs round"><div class="bp blue"><div class="lbl">${esc(teamName('blue'))}</div><div class="nm">${t.blue}승</div></div><div class="vsm">VS</div><div class="bp red"><div class="lbl">${esc(teamName('red'))}</div><div class="nm">${t.red}승</div></div></div>` + foot;
  const b = upNext(ev,'blue'), r = upNext(ev,'red');
  // 위쪽 호출 띠: 심판이 부른 선수(30초) 또는 다음 선수
  const fx = BOARD.callFx && BOARD.callFx.ev===ev && now()-BOARD.callFx.start < CALL_MS ? BOARD.callFx : null;
  const pa = prepAhead(), pb = upcoming(ev,'blue',pa), pr = upcoming(ev,'red',pa);
  const cb = fx ? fx.blue : pb, cr = fx ? fx.red : pr, kind = fx ? fx.kind : 'next';
  const cc = BOARD.ccFx && BOARD.ccFx.ev===ev && now()-BOARD.ccFx.start < CALL_MS ? BOARD.ccFx : null;
  const ccbar = cc ? `<div class="callbar one ${cc.kind==='now'?'now':''}"${flashAttr(cc.start)}><div class="cl">${callLabel(cc.kind, cc.ahead)}</div>
      <div class="cp">${teamBadge(cc.team,true)}<b>${esc(teamName(cc.team))} ${esc(pname(cc.pid))}</b></div></div>` : '';
  const call = cb && cr ? `<div class="callbar ${kind==='now'?'now':''}"${fx ? flashAttr(fx.start) : ''}>
      <div class="cl">${callLabel(kind, fx ? fx.ahead : pa)}</div>
      <div class="cp">${teamBadge('blue',true)}<b>${esc(pname(cb))}</b></div><div class="cp">${teamBadge('red',true)}<b>${esc(pname(cr))}</b></div></div>` : '';
  const ord = tm => orderFor(ev, tm);
  const tg = teamOpt(ev).board, mk = tg ? marksOf(ev) : null;
  const bp = (tm, id) => `<div class="bp ${tm}"><div class="lbl">${esc(teamName(tm))}${id?` ${ord(tm).indexOf(id)+1}번`:''}</div><div class="nm">${id?esc(pname(id)):'-'}</div>${mk ? `<div class="bcnt">던진 개수 <b>${markCount(mk, tm)}</b></div>` : ''}</div>`;
  // 다다음 선수를 부르는 경우, 그 사이의 다음 경기도 작게 보여 줌
  const nextLine = pa > 1 && b.next && r.next ? `<span class="bdnext">다음 경기 ${teamBadge('blue')} ${esc(pname(b.next))} · ${teamBadge('red')} ${esc(pname(r.next))}</span>` : '';
  // 과녁판 중계 종목: 지금 선수 옆(가로 화면) 또는 아래(세로 화면)에 과녁판을 크게 띄움
  const duelHtml = `<div class="bdvs">${bp('blue', b.cur)}<div class="vsm">VS</div>${bp('red', r.cur)}</div>`;
  const mid = tg ? `<div class="bdsplit">${duelHtml}${tgtBoardHtml(ev, { legend:false })}</div>` : duelHtml;
  // PC·프로젝터(무대 위 높은 화면)는 호출 띠를 아래쪽에 둠
  if(bdPC()) return head + `<div class="bdlabel">지금 경기${nextLine}</div>` + mid + foot + ccbar + call;
  return ccbar + call + head + `<div class="bdlabel">지금 경기${nextLine}</div>` + mid + foot;
}
function boardIndiv(){
  const ps = people(), pc = bdPC();
  if(BOARD.person && now()-BOARD.personAt < PERSON_MS && person(BOARD.person)) return boardPerson(BOARD.person);
  BOARD.person = null;
  const evs = Object.keys(INDIV);
  if(!evs.length) return `<div class="bdhead"><span class="bic">🎯</span><h1>개인전 기록</h1></div><div class="card empty">켜져 있는 개인전 종목이 없습니다.</div>`;
  // 종목마다 연1 · 연2 · 본선 (연습이 없는 종목은 본선만, 결승 기록이 있는 종목만 결승 칸을 더함)
  const cols = evs.map(ev => ({ ev, rounds: (hasPrac(ev) ? ['p1','p2'] : []).concat(['main'], D.indiv.some(r => r.event===ev && r.round==='final' && !r.deleted && (r.throws||[]).length) ? ['final'] : []) }));
  const ncols = cols.reduce((n, c) => n + c.rounds.length, 0);
  // 대기 줄이 있는 종목은 표 위에 '대기 n명'과 앞 세 명의 이름을 띄움
  const waits = evs.filter(ev => qList(ev).length);
  const wstrip = waits.length ? `<div class="bdwait">${waits.map(ev => { const q = qList(ev);
    return `<span class="bw" style="--ev:${INDIV[ev].color}"><b>${INDIV[ev].icon} ${esc(INDIV[ev].name)} 대기 ${q.length}명</b><em>${q.slice(0,3).map(id => esc(pname(id))).join(' · ')}${q.length>3 ? ' …' : ''}</em></span>`; }).join('')}</div>` : '';
  const cell = (ev, rd, p) => { const r = rec(ev, rd, p.id); return r ? `<td class="num ${rd}${rd==='p1'?' g':''}">${rd==='main'||rd==='final' ? `<b>${fmtNum(totalOf(ev, r.throws))}</b>` : fmtNum(totalOf(ev, r.throws))}</td>` : `<td class="num dash ${rd}${rd==='p1'?' g':''}">–</td>`; };
  // PC 화면에서는 표마다 줄 수를 같게 맞추려고 모자란 줄을 빈 줄로 채움
  const blank = () => `<tr class="blank"><td class="nmc">&nbsp;</td>${cols.map(c => c.rounds.map(rd => `<td class="num ${rd}${rd==='p1'?' g':''}"></td>`).join('')).join('')}</tr>`;
  const table = (chunk, per) => `<table class="itab"><thead>
      <tr><th rowspan="2" class="nmh">이름</th>${cols.map(c => { const E = INDIV[c.ev], wn = qList(c.ev).length;
        return `<th colspan="${c.rounds.length}" class="evh g" style="--ev:${E.color}">${E.icon} ${esc(E.name)}${E.vunit && E.vunit!=='점' ? ` <small>(${esc(E.vunit)})</small>` : ''}${wn ? `<span class="bwn">대기 ${wn}명</span>` : ''}</th>`; }).join('')}</tr>
      <tr>${cols.map((c, ci) => c.rounds.map((rd,k) => `<th class="num rdh${k===0?' g':''}">${ROUND_SHORT[rd]}</th>`).join('')).join('')}</tr></thead>
    <tbody>${chunk.map(p => `<tr class="tap" data-a="bdPerson" data-v="${p.id}"><td class="nmc"><b>${esc(p.name)}</b>${isAbsent(p.id)?' <span class="tag red">불참</span>':''}</td>${cols.map(c => c.rounds.map(rd => cell(c.ev, rd, p)).join('')).join('')}</tr>`).join('')}${pc ? Array.from({ length:Math.max(0, per - chunk.length) }, blank).join('') : ''}</tbody></table>`;
  const build = ncol => { const per = Math.ceil(ps.length / ncol) || 1; return Array.from({ length:ncol }, (_,c) => ps.slice(c*per, (c+1)*per)).map(chunk => table(chunk, per)).join(''); };
  const head = `<div class="bdhead"><span class="bic">🎯</span><h1>개인전 기록</h1><span class="bsub">이름을 누르면 크게 볼 수 있습니다</span></div>${wstrip}`;
  if(pc){
    // 표를 몇 칸으로 나눌지는 board-pc.js 가 1~4칸을 모두 맞춰 보고 글자가 가장 커지는 쪽으로 정함
    BDPC.build = build; BDPC.count = ps.length;
    BDPC.sig = `${ps.length}|${ncols}|${Math.max(0, ...ps.map(p => p.name.length))}|${waits.length}`;
    const n = BDPC.ncol[`indiv|${innerWidth}x${innerHeight}|${BDPC.sig}`] || (ps.length > 8 ? 2 : 1);
    return head + (ps.length ? `<div class="ilist" data-plan="1" data-cols="${n}" style="grid-template-columns:repeat(${n},1fr)">${build(n)}</div>` : '<div class="card empty">명단이 아직 없습니다.</div>');
  }
  // 16명까지는 표 하나, 그 위는 둘로 나눔 (폭이 좁은 화면은 표 하나로 길게)
  const ncol = ps.length <= 16 || window.innerWidth < 760 ? 1 : 2, per = Math.ceil(ps.length / ncol) || 1;
  // 가로 폭과 줄 수에 맞춰 글자 크기를 정함 (가로로 밀리거나 잘리지 않게)
  const W = Math.max(320, window.innerWidth - 32 - 14*(ncol-1)) / ncol, nf = Math.max(10, Math.min(26, Math.floor(W * 0.74 / ncols / 1.85)));
  return `${head}
    ${ps.length ? `<div class="ilist" style="grid-template-columns:repeat(${ncol},1fr);--nf:${nf}px;--rowh:calc((100dvh - ${190 + (waits.length ? 70 : 0)}px - var(--sat) - var(--sab)) / ${per + 2.4})">${build(ncol)}</div>` : '<div class="card empty">명단이 아직 없습니다.</div>'}`;
}
function boardPerson(pid){
  const p = person(pid);
  const cards = Object.entries(INDIV).map(([ev,E]) => {
    const R = recsOf(ev, pid), r = R.main, st = standings(ev).list.find(x => x.p.id===pid), tot = x => totalOf(ev, x.throws);
    const sub = ['p1','p2','final'].filter(k => R[k]).map(k => `<div class="pl">${ROUNDS[k]} <b>${sc(ev, tot(R[k]))}</b></div>`).join('');
    return `<div class="pcard" style="--ev:${E.color}"><div class="pe">${E.icon} ${esc(E.name)}</div>
      ${r ? `<div class="pv">${fmtNum(tot(r))}<small>${esc(E.vunit)}</small></div><div class="pt">${(r.throws||[]).map(k => fmtNum(throwVal(ev, k))).join(' · ')}</div>
        <div class="pr">본선 ${st ? `${st.rank}위` : ''}</div>` : '<div class="pv none">본선 아직</div>'}${sub ? `<div class="psub">${sub}</div>` : ''}</div>`;
  }).join('');
  return `<div class="pview tap" data-a="bdPerson" data-v="">
    <div class="pname"><b>${esc(p.name)}</b></div>
    <div class="pcards" style="--pc:${Math.min(3, Object.keys(INDIV).length || 1)}">${cards}</div>
    <div class="pback">화면을 한 번 더 누르면 목록으로 돌아갑니다</div></div>`;
}
function boardOverlay(){
  const o = BOARD.overlay; if(!o) return '';
  // PC·프로젝터 화면: 겹쳐 뜨는 화면도 글자 크기를 화면에 꼭 맞춤
  const pc = bdPC(), ca = k => pc ? ` bdpc" data-fit="1" data-fskey="ovl-${k}` : '';
  if(o.kind==='ccall') return `<div class="ovl ccall ${o.c.team}${ca('ccall')}" data-a="bdDismiss"${flashAttr(o.start)}><div class="lbl">${callLabel(o.c.kind, o.c.ahead)}</div>
    <div class="who"><span class="tn">${esc(teamName(o.c.team))}</span></div><div class="nm">${esc(pname(o.c.pid))}</div><div class="ovev2">${EVENTS[o.c.event] ? `${EVENTS[o.c.event].icon} ${esc(EVENTS[o.c.event].name)}` : ''}</div></div>`;
  if(o.kind==='ann') return `<div class="ovl ann${ca('ann')}" data-a="bdDismiss"${flashAttr(o.start)}><div class="lbl">📢 안내</div><div class="txt">${esc(o.ann.text)}</div></div>`;
  const m = o.m, E = TEAM[m.event]; if(!E) return '';
  // 대결 점수를 기록한 경우 '3 : 2' (왼쪽 청팀 · 오른쪽 홍팀)
  const osc = scoreTxt(m) ? `<div class="osc">${teamBadge('blue',true)} ${scoreTxt(m)} ${teamBadge('red',true)}</div>` : '';
  const nm = tm => E.mode==='round' ? '' : esc(pname(tm==='blue' ? m.blueId : m.redId));
  const tm = tmk => E.mode==='time' ? `<div class="tm">${fmtSec(tmk==='blue' ? m.blueTime : m.redTime)}초</div>` : '';
  const head = `<div class="ovev">${E.icon} ${esc(E.name)}</div>`;
  if(m.winner==='draw') return `<div class="ovl result${ca('result')}" data-a="bdDismiss">${head}<div class="half draw"${flashAttr(o.start)}><div class="big">무승부</div>${osc}</div>
    <div class="half draw2"><div class="dpair">${TEAM_KEYS.map(k => `<div class="dp ${k}"><div class="dl">${esc(teamName(k))}</div>${nm(k) ? `<div class="nm">${nm(k)}</div>` : ''}${tm(k)}</div>`).join('')}</div></div></div>`;
  const w = m.winner, l = w==='blue' ? 'red' : 'blue';
  return `<div class="ovl result${ca('result')}" data-a="bdDismiss">${head}
    <div class="half win ${w}"${flashAttr(o.start)}><div class="big">🏆 ${esc(teamName(w))} 승리</div>${nm(w)?`<div class="nm">${nm(w)}</div>`:''}${tm(w)}${osc}</div>
    <div class="half lose"><div class="big">${esc(teamName(l))} 패</div>${nm(l)?`<div class="nm">${nm(l)}</div>`:''}${tm(l)}</div></div>`;
}

/* ===================== 마스터: 안내판 제어 · 문자 안내방송 ===================== */
let annDraft = '';
// 안내판 메뉴: 위쪽 탭 네 개 (화면·소리 / 안내방송 / 시상식 / 현황). 현황 안에는 개인전·단체전·진행 작은 탭이 있음
const BTABS = [['screen','📺','화면·소리'], ['ann','📢','안내방송'], ['awards','🏆','시상식'], ['status','📊','현황']];
const BSTAT = [['indiv','🎯','개인전'], ['team','🏁','단체전'], ['prog','🧭','진행']];
function boardControl(){
  const tabs = innerTabs('board', BTABS);
  return `<div class="bctl">${tabs}${{ screen: bcScreen, ann: bcAnn, awards: awardsControl, status: bcStatus }[ITAB.board]()}</div>`;
}
function bcStatus(){
  return innerTabs('boardStat', BSTAT, { sub:true }) + { indiv: statIndiv, team: statTeam, prog: progressView }[ITAB.boardStat]();
}
// 화면 고르기 · 준비 호출 · 소리를 한 화면에 촘촘하게
function bcScreen(){
  const cfg = boardCfg();
  const modes = [['auto','🔄 자동'], ['indiv','🎯 개인전'], ['summary','📊 종합'], ['awards','🏆 시상식'], ...Object.keys(TEAM).map(k => ['team:'+k, TEAM[k].icon+' '+TEAM[k].name])];
  const sw = (k, label, sub) => `<label class="swtile"><span class="name">${label}<span class="sub">${sub}</span></span><span class="switch"><input type="checkbox" data-ch="bcfg" data-k="${k}" ${cfg[k]?'checked':''}><span></span></span></label>`;
  return `<div class="card"><h2>보여 줄 화면 <span class="sub">자동은 가장 최근 기록 종목</span></h2>
      <div class="chips modes">${modes.map(([k,l]) => `<button class="chip ${cfg.mode===k?'on':''}" data-a="bmode" data-v="${k}">${esc(l)}</button>`).join('')}</div></div>
    <div class="card"><h2>📣 "준비해 주세요"로 부를 선수</h2>
      <div class="chips prep">${[1,2,3].map(k => `<button class="chip ${prepAhead()===k?'on':''}" data-a="bprep" data-v="${k}">${AHEAD_LABEL[k]}</button>`).join('')}</div>
      <p class="sub">'다다음'은 그다음 경기 선수를 미리 부릅니다.</p></div>
    <div class="card"><h2>🔔 소리와 깜빡임</h2>
      <div class="swgrid">${sw('sound','🔔 띵동 소리','호출·결과·방송 때')}${sw('callVoice','🗣 이름 읽기','호출할 때 읽어 줌')}${sw('chime','🎵 차임벨','방송 앞 딩동댕동')}${sw('flash','⚡ 깜빡임','농인 참가자도 알아봄')}</div>
      <p class="sub">안내판 태블릿은 처음 켤 때 화면을 한 번 눌러야 소리가 납니다.</p></div>
    <div class="row twobtn"><button class="btn grow" data-a="btest">🔔 소리 시험</button><button class="btn primary grow" data-a="boardPreview">📺 미리 보기</button></div>`;
}
function bcAnn(){
  const ann = D.config.announce || {}, live = ann.text && !ann.cleared;
  return `<div class="card">
      ${live ? `<div class="okline livenote"><span class="grow">지금 띄운 안내: ${esc(ann.text)}</span><button class="btn small danger" data-a="annClear">내리기</button></div>` : ''}
      <textarea id="annText" data-in="ann" placeholder="안내판에 크게 띄우고 읽어 줄 내용" style="min-height:76px">${esc(annDraft)}</textarea>
      <div class="row twobtn" style="margin-top:8px"><button class="btn primary grow" data-a="annSend" data-v="voice">📢 띄우고 읽어 주기</button><button class="btn grow" data-a="annSend" data-v="text">글자만 띄우기</button></div>
      <h3>자주 쓰는 문구</h3>
      <div class="phrbox"><div class="phrgrid">${phrases().map((t,i) => `<span class="phr"><button class="chip" data-a="annPick" data-v="${i}" title="${esc(t)}"><span class="pt">${esc(t)}</span></button><button class="phx" data-a="annDelPhrase" data-v="${i}" aria-label="문구 지우기">✕</button></span>`).join('')}</div></div>
      <button class="btn small wide" data-a="annSavePhrase" style="margin-top:8px">입력한 내용을 자주 쓰는 문구로 저장</button>
      <p class="sub">안내판에 15초 동안 화면 가득 띄운 뒤, 내릴 때까지 위쪽 띠로 계속 보여 줍니다. 목소리로 방송하려면 📢 방송 버튼을 누른 채 말하면 됩니다.</p></div>`;
}
function awardsControl(){
  const steps = awardSteps(), i = awardsStep(), on = boardCfg().mode==='awards';
  return `<div class="card"><h2>🏆 시상식</h2>
    <p class="sub">안내판을 시상식 화면으로 바꾸고, 종목별 3등 → 2등 → 1등, 마지막에 종합 우승 순서로 한 단계씩 발표합니다. 발표할 때마다 팡파르와 함께 이름을 읽어 줍니다.</p>
    <div class="row twobtn">${on ? '' : '<button class="btn primary grow" data-a="awStart">🏆 시상식 화면으로 바꾸기</button>'}
      ${on ? `<button class="btn grow" data-a="awStep" data-v="-1" ${i<0?'disabled':''}>◀ 이전</button><button class="btn primary grow" data-a="awStep" data-v="1" ${i>=steps.length-1?'disabled':''}>다음 발표 ▶</button><button class="btn" data-a="awEnd">끝내기</button>` : ''}</div>
    <div class="list awlist">${steps.map((s,k) => `<div class="item ${k===i?'cur':''} ${k<i?'done':''}"><span class="no tag">${k+1}</span><span class="name">${esc(awardLabel(s))}<span class="sub">${s.kind==='team' ? `${esc(teamName('blue'))} ${s.tot.blue} : ${s.tot.red} ${esc(teamName('red'))}` : s.winners.map(x => esc(x.p.name)+' '+sc(s.ev, x.total)).join(', ')}</span></span>${k===i?'<span class="tag dark">지금 발표</span>':''}</div>`).join('')}</div></div>${lastPlaceCard()}`;
}

/* ---------- 시상식 ---------- */
function awardSteps(){
  const st = [];
  Object.entries(INDIV).forEach(([ev]) => { const { list } = standings(ev); [3,2,1].forEach(rk => { const w = list.filter(x => x.rank===rk); if(w.length) st.push({ kind:'indiv', ev, rank:rk, winners:w }); }); });
  st.push({ kind:'team', tot: totalPoints() });
  return st;
}
const awardsStep = () => { const a = D.config.awards; return a && typeof a.step==='number' ? a.step : -1; };
const awardLabel = s => s.kind==='team' ? '종합 우승 발표' : `${INDIV[s.ev].name} ${s.rank}등`;
function awardSpeech(s){
  if(s.kind==='team'){ const t = s.tot; return t.blue===t.red ? `종합 결과, ${t.blue} 대 ${t.red} 무승부입니다.` : `종합 우승, ${teamName(t.blue>t.red?'blue':'red')}입니다. 축하합니다.`; }
  return `${INDIV[s.ev].name} ${s.rank}등, ${s.winners.map(x => x.p.name).join(', ')}. 축하합니다.`;
}
function boardAwards(){
  const steps = awardSteps(), i = awardsStep();
  if(i < 0 || i >= steps.length) return `<div class="award idle"><div class="aic">🏆</div><div class="at">시상식</div><div class="asub">잠시 후 시상을 시작합니다</div></div>`;
  const s = steps[i], fx = flashAttr(BOARD.awardAt, 6000);
  if(s.kind==='team'){
    const t = s.tot, w = t.blue===t.red ? '' : (t.blue>t.red ? 'blue' : 'red');
    return `<div class="award team ${w}"${fx}><div class="aic">🏆</div><div class="at">${w ? `종합 우승 ${esc(teamName(w))}` : '종합 결과 무승부'}</div>
      <div class="ascore">${teamBadge('blue',true)} ${t.blue} : ${t.red} ${teamBadge('red',true)}</div></div>`;
  }
  const E = INDIV[s.ev], medal = { 1:'🥇', 2:'🥈', 3:'🥉' }[s.rank];
  return `<div class="award r${s.rank}"${fx}><div class="aev">${E.icon} ${esc(E.name)}</div><div class="aic">${medal}</div><div class="at">${s.rank}등</div>
    ${s.winners.map(x => `<div class="aname">${esc(x.p.name)} <span class="apt">${sc(s.ev, x.total)}</span></div>`).join('')}</div>`;
}

Object.assign(ACT, {
  bdPerson: (el, v) => { BOARD.person = v || null; BOARD.personAt = now(); },
  bdDismiss: () => { if(BOARD.overlay) finishFx(); return false; },
  bdSound: () => { SND.unlock(); SND.dingdong(); },
  bmode: (el, v) => { setConfig({ board:{ mode:v } }); return false; },
  bprep: (el, v) => { setConfig({ board:{ prepAhead:+v } }); toast(`안내판이 ${AHEAD_LABEL[+v]} 선수를 준비 호출합니다.`); return false; },
  awStart: () => { setConfig({ board:{ mode:'awards' }, awards:{ step:-1 } }); },
  awStep: (el, v) => { const n = Math.max(-1, Math.min(awardSteps().length-1, awardsStep() + (+v))); setConfig({ board:{ mode:'awards' }, awards:{ step:n } }); },
  awEnd: () => { setConfig({ board:{ mode:'auto' }, awards:{ step:-1 } }); },
  btest: () => { setConfig({ board:{ testAt:now() } }); toast('안내판에서 띵동 소리가 나는지 확인해 주세요.'); return false; },
  annPick: (el, v) => { annDraft = phrases()[+v] || ''; },
  annSend: (el, v) => {
    const text = annDraft.trim(); if(!text){ toast('띄울 내용을 적어 주세요.'); return false; }
    setConfig({ announce:{ id:uid(), text, at:now(), by:UI.me, voice: v==='voice', cleared:false } });
    annDraft = ''; toast('안내판에 띄웠습니다.');
  },
  annClear: () => { setConfig({ announce:{ cleared:true } }); toast('안내를 내렸습니다.'); },
  annSavePhrase: () => { const t = annDraft.trim(); if(!t){ toast('저장할 내용을 먼저 적어 주세요.'); return false; }
    if(phrases().includes(t)){ toast('이미 저장된 문구입니다.'); return false; }
    setConfig({ phrases:[...phrases(), t] }); toast('자주 쓰는 문구로 저장했습니다.'); },
  annDelPhrase: async (el, v) => { const t = phrases()[+v]; if(!(await ask(`"${t}" 문구를 지울까요?`, '지우기', true))) return false;
    setConfig({ phrases: phrases().filter((_,i) => i!==+v) }); return false; },
  boardPreview: () => { UI.preview = !UI.preview; window.scrollTo(0,0); },
  // 안내판 화면 종류(이 기기에만 저장): 태블릿 / PC·프로젝터
  bdKind: (el, v) => { BDKIND = v==='pc' ? 'pc' : 'tablet'; ls.set('udh5_bdkind', BDKIND); window.scrollTo(0,0); },
});
document.addEventListener('change', e => { const el = e.target; if(el.dataset.ch==='bcfg') setConfig({ board:{ [el.dataset.k]: el.checked } }); });
document.addEventListener('input', e => { if(e.target.dataset.in==='ann') annDraft = e.target.value; });
// 호출 띠·깜빡임이 끝나는 시각에 맞춰 화면을 다시 그림
setInterval(() => { if(boardOn() && (BOARD.callFx || BOARD.ccFx || (D.config.announce||{}).text || schedule().length || boardCfg().mode==='awards')) queueRender(); }, 5000);

// 안내판 표는 화면 크기에 맞춰 글자 크기를 정하므로, 화면을 돌리거나 크기가 바뀌면 다시 그림
let resizeTimer = 0;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if(typeof boardOn==='function' && (boardOn() || UI.preview)) queueRender(); }, 200); });
