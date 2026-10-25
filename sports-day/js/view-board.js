'use strict';
/* ===================== 현황판 (요약) ===================== */

function boardView(){
  const tot = totalPoints();
  const rows = Object.entries(TEAM).map(([k,E]) => { const t = tally(k);
    return `<tr><td><span class="row nowrap" style="gap:8px"><span style="font-size:22px">${E.icon}</span><b>${esc(E.name)}</b></span></td><td class="num score" style="color:var(--blue)">${t.blue}</td><td class="num score" style="color:var(--red)">${t.red}</td><td class="num sub">${matchesOf(k).length}판</td></tr>`; }).join('');
  const indiv = Object.entries(INDIV).map(([k,E]) => {
    const { list, ties } = standings(k), top = list.filter(x => x.rank<=3);
    return `<div class="card"><div class="row"><h2 class="grow h2" style="margin:0">${E.icon} ${esc(E.name)}</h2><span class="sub">${list.length}명 기록</span></div>
      ${ties.filter(t => !t.resolved).map(t => `<div class="note" style="margin-top:10px">⚠ ${t.total}점 동점: ${t.names.map(esc).join(', ')} → 결승 필요</div>`).join('')}
      ${top.length ? `<table><tbody>${top.map(x => `<tr><td class="rank">${x.rank}</td><td><span class="row nowrap" style="gap:8px">${teamBadge(x.p.team)}<b>${esc(x.p.name)}</b></span></td><td class="num"><span class="score">${x.total}점</span>${x.ftotal!=null?` <span class="sub">(결승 ${x.ftotal})</span>`:''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">아직 기록이 없습니다.</div>'}</div>`;
  }).join('');
  return `<div class="cols half">
    <div class="card"><h2>단체전 승점</h2>
      <div class="totals"><div class="tbox blue"><div class="t">${esc(teamName('blue'))}</div><div class="v">${tot.blue}</div></div><div class="tbox red"><div class="t">${esc(teamName('red'))}</div><div class="v">${tot.red}</div></div></div>
      <table style="margin-top:12px"><thead><tr><th>종목</th><th class="num">${esc(teamShort('blue'))}</th><th class="num">${esc(teamShort('red'))}</th><th class="num">진행</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="sub">한 판 이길 때마다 승점 1점입니다. 다른 기기에서 입력한 결과가 바로 반영됩니다.</p></div>
    <div><h2 style="margin:4px 2px 12px;font-size:20px">개인전 순위 (1~3등)</h2>${indiv}</div></div>`;
}

/* ===================== 소리 (띵동·차임벨·음성) ===================== */
const SND = {
  ctx:null, unlocked:false,
  ensure(){
    try{
      if(!this.ctx){ const C = window.AudioContext || window.webkitAudioContext; if(!C) return null; this.ctx = new C(); }
      if(this.ctx.state==='suspended') this.ctx.resume().catch(()=>{});
    }catch(e){ return null; }
    return this.ctx;
  },
  ready(){ return !!this.ctx && this.ctx.state==='running'; },
  // 화면을 처음 누를 때 소리와 음성을 켜 둠 (태블릿은 사람이 한 번 눌러야 소리를 낼 수 있음)
  unlock(){
    this.ensure();
    if(!this.unlocked && 'speechSynthesis' in window){ try{ const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }catch(e){} }
    this.unlocked = true;
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
  dingdong(){ return this.play([[659.25, 0, 1.1], [523.25, 0.55, 1.5]]); },                       // 띵-동 (선수 호출)
  chime(){ return this.play([[523.25, 0, 0.9], [659.25, 0.42, 0.9], [783.99, 0.84, 0.9], [1046.5, 1.26, 1.5]]); }, // 딩동댕동 (안내방송)
  fanfare(){ return this.play([[523.25, 0, 0.25], [659.25, 0.18, 0.25], [783.99, 0.36, 0.25], [1046.5, 0.54, 1.0]]); },
  speak(text){
    if(!('speechSynthesis' in window) || !text) return;
    try{
      const u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; u.rate = 0.92; u.volume = 1;
      const v = speechSynthesis.getVoices().find(x => /ko/i.test(x.lang)); if(v) u.voice = v;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    }catch(e){}
  },
};
document.addEventListener('pointerdown', () => { if(myRole().role==='board'){ const was = SND.ready(); SND.unlock(); if(!was) setTimeout(() => { queueRender(); touchDevice(); }, 400); } }, true);

/* ===================== 안내판 ===================== */
const RESULT_MS = 7000, CALL_MS = 30000, ANN_MS = 15000, FLASH_MS = 8000, PERSON_MS = 120000;
const BOARD = { init:false, seen:new Set(), lastCall:{}, annId:null, testAt:0, overlay:null, queue:[], busy:false, timer:0, callFx:null, person:null, personAt:0 };
// 지금 안내판에 띄울 화면: 마스터가 정한 것, 자동이면 가장 최근에 기록이 들어온 종목
function boardTarget(){
  const m = boardCfg().mode || 'auto';
  if(m==='indiv' || m==='summary' || m==='awards') return { kind:m };
  if(m.startsWith('team:') && TEAM[m.slice(5)]) return { kind:'team', ev:m.slice(5) };
  let best = { t:0, kind:'indiv' };
  D.matches.forEach(x => { const t = Math.max(x.at||0, x.editedAt||0); if(!x.deleted && TEAM[x.event] && t>best.t) best = { t, kind:'team', ev:x.event }; });
  Object.entries(D.calls).forEach(([ev, c]) => { const t = (c.call||{}).at||0; if(TEAM[ev] && t>best.t) best = { t, kind:'team', ev }; });
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
  const cfg = boardCfg(), sound = cfg.sound && SND.ready();
  const voiceMs = cfg.callVoice && sound ? 5000 : 2200;
  BOARD.busy = true;
  let dur = 1800;
  if(fx.kind==='test'){ if(sound) SND.dingdong(); toast('안내판 소리 시험'); }
  else if(fx.kind==='call' || fx.kind==='autocall'){
    let c = fx.call;
    if(fx.kind==='autocall'){ const b = upNext(fx.ev,'blue'), r = upNext(fx.ev,'red'); c = b.next && r.next ? { kind:'next', blue:b.next, red:r.next } : null; }
    if(c){
      BOARD.callFx = { ev:fx.ev, kind:c.kind, blue:c.blue, red:c.red, start:now() };
      if(sound){ const d = SND.dingdong(); if(cfg.callVoice) setTimeout(() => SND.speak(callText(c.blue, c.red, c.kind)), d*1000+200); }
      dur = voiceMs;
    } else dur = 0;
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
  if(done && done.kind==='result' && TEAM[done.m.event].mode!=='round' && !BOARD.queue.some(f => f.kind==='result' && f.m.event===done.m.event))
    BOARD.queue.unshift({ kind:'autocall', ev:done.m.event });
  queueRender(); runFx();
}
function callText(blue, red, kind){
  return `${teamName('blue')} ${pname(blue)}, ${teamName('red')} ${pname(red)} 선수, ${kind==='now' ? '지금 경기장으로 나와 주세요.' : '준비해 주세요.'}`;
}
// 깜빡임: 다시 그려도 애니메이션이 처음부터 다시 시작되지 않게 시작 시각만큼 앞당김
function flashAttr(start, dur=FLASH_MS){
  if(!boardCfg().flash || !start || now()-start > dur) return '';
  return ` data-flash="1" style="animation-delay:-${now()-start}ms"`;
}

function boardScreen(){
  boardTick();
  const T = boardTarget(), ann = D.config.announce || {};
  const C = RADIO.lock.cast;
  const annStrip = (C ? `<div class="caststrip"${flashAttr(C.at || now(), 60000)}>📢 안내방송 중 · ${esc(C.name||'')}</div>` : '')
    + (ann.text && !ann.cleared && (now()-(ann.at||0)) < 6*3600*1000 ? `<div class="annstrip"${flashAttr(ann.at)}>📢 ${esc(ann.text)}</div>` : '')
    + (T.kind==='awards' ? '' : boardScheduleStrip());
  let body;
  if(T.kind!=='indiv') BOARD.person = null;
  if(T.kind==='team') body = boardTeam(T.ev);
  else if(T.kind==='summary') body = `<div class="bdhead"><h1>📊 종합 현황</h1></div>${boardView()}`;
  else if(T.kind==='awards') body = boardAwards();
  else body = boardIndiv();
  const cfg = boardCfg();
  const soundHint = boardOn() && cfg.sound && !SND.ready() ? `<button class="soundhint" data-a="bdSound">🔈 화면을 한 번 눌러 소리를 켜 주세요</button>` : '';
  return `<div class="bd">${annStrip}${body}</div>${boardOverlay()}${soundHint}`;
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
  const cb = fx ? fx.blue : b.next, cr = fx ? fx.red : r.next, kind = fx ? fx.kind : 'next';
  const call = cb && cr ? `<div class="callbar ${kind==='now'?'now':''}"${fx ? flashAttr(fx.start) : ''}>
      <div class="cl">${kind==='now' ? '📣 지금 나와 주세요' : '📣 준비해 주세요'}</div>
      <div class="cp">${teamBadge('blue',true)}<b>${esc(pname(cb))}</b></div><div class="cp">${teamBadge('red',true)}<b>${esc(pname(cr))}</b></div></div>` : '';
  const ord = tm => orderFor(ev, tm);
  const bp = (tm, id) => `<div class="bp ${tm}"><div class="lbl">${esc(teamName(tm))}${id?` ${ord(tm).indexOf(id)+1}번`:''}</div><div class="nm">${id?esc(pname(id)):'-'}</div></div>`;
  return call + head + `<div class="bdlabel">지금 경기</div><div class="bdvs">${bp('blue', b.cur)}<div class="vsm">VS</div>${bp('red', r.cur)}</div>` + foot;
}
function boardIndiv(){
  const ps = people();
  if(BOARD.person && now()-BOARD.personAt < PERSON_MS && person(BOARD.person)) return boardPerson(BOARD.person);
  BOARD.person = null;
  const evs = Object.keys(INDIV);
  const cell = (ev, p) => { const r = rec(ev,'main',p.id); return r ? `<td class="num"><b>${totalOf(ev, r.throws)}</b></td>` : '<td class="num dash">–</td>'; };
  const ncol = ps.length > 36 ? 3 : ps.length > 14 ? 2 : 1, per = Math.ceil(ps.length / ncol) || 1;
  const tables = Array.from({ length:ncol }, (_,c) => ps.slice(c*per, (c+1)*per)).map(chunk => `<table class="itab"><thead><tr><th>이름</th>${evs.map(ev => `<th class="num">${INDIV[ev].icon} ${esc(INDIV[ev].name)}</th>`).join('')}</tr></thead>
    <tbody>${chunk.map(p => `<tr class="tap" data-a="bdPerson" data-v="${p.id}"><td><span class="row nowrap" style="gap:8px">${teamBadge(p.team)}<b>${esc(p.name)}</b>${isAbsent(p.id)?' <span class="tag red">불참</span>':''}</span></td>${evs.map(ev => cell(ev, p)).join('')}</tr>`).join('')}</tbody></table>`).join('');
  return `<div class="bdhead"><span class="bic">🎯</span><h1>개인전 기록</h1><span class="bsub">이름을 누르면 크게 볼 수 있습니다</span></div>
    ${ps.length ? `<div class="ilist" style="grid-template-columns:repeat(${ncol},1fr)">${tables}</div>` : '<div class="card empty">명단이 아직 없습니다.</div>'}`;
}
function boardPerson(pid){
  const p = person(pid);
  const cards = Object.entries(INDIV).map(([ev,E]) => {
    const r = rec(ev,'main',pid), m = optMap(ev), st = standings(ev).list.find(x => x.p.id===pid), f = rec(ev,'final',pid);
    return `<div class="pcard" style="--ev:${E.color}"><div class="pe">${E.icon} ${esc(E.name)}</div>
      ${r ? `<div class="pv">${totalOf(ev, r.throws)}<small>점</small></div><div class="pt">${(r.throws||[]).map(k => m[k]?.v ?? 0).join(' · ')}</div>
        <div class="pr">${st ? `${st.rank}위` : ''}${f ? ` · 결승 ${totalOf(ev, f.throws)}점` : ''}</div>` : '<div class="pv none">아직 안 함</div>'}</div>`;
  }).join('');
  return `<div class="pview tap" data-a="bdPerson" data-v="">
    <div class="pname">${teamBadge(p.team, true)}<b>${esc(p.name)}</b><span class="bsub">${esc(teamName(p.team)||'')}</span></div>
    <div class="pcards">${cards}</div>
    <div class="pback">화면을 한 번 더 누르면 목록으로 돌아갑니다</div></div>`;
}
function boardOverlay(){
  const o = BOARD.overlay; if(!o) return '';
  if(o.kind==='ann') return `<div class="ovl ann" data-a="bdDismiss"${flashAttr(o.start)}><div class="lbl">📢 안내</div><div class="txt">${esc(o.ann.text)}</div></div>`;
  const m = o.m, E = TEAM[m.event];
  const nm = tm => E.mode==='round' ? '' : esc(pname(tm==='blue' ? m.blueId : m.redId));
  const tm = tmk => E.mode==='time' ? `<div class="tm">${fmtSec(tmk==='blue' ? m.blueTime : m.redTime)}초</div>` : '';
  const head = `<div class="ovev">${E.icon} ${esc(E.name)}</div>`;
  if(m.winner==='draw') return `<div class="ovl result" data-a="bdDismiss">${head}<div class="half draw"${flashAttr(o.start)}><div class="big">무승부</div></div>
    <div class="half draw2"><div class="pair">${teamBadge('blue',true)} ${nm('blue')} ${tm('blue')}<span class="vsm">·</span>${teamBadge('red',true)} ${nm('red')} ${tm('red')}</div></div></div>`;
  const w = m.winner, l = w==='blue' ? 'red' : 'blue';
  return `<div class="ovl result" data-a="bdDismiss">${head}
    <div class="half win ${w}"${flashAttr(o.start)}><div class="big">🏆 ${esc(teamName(w))} 승리</div>${nm(w)?`<div class="nm">${nm(w)}</div>`:''}${tm(w)}</div>
    <div class="half lose"><div class="big">${esc(teamName(l))} 패</div>${nm(l)?`<div class="nm">${nm(l)}</div>`:''}${tm(l)}</div></div>`;
}

/* ===================== 마스터: 안내판 제어 · 문자 안내방송 ===================== */
let annDraft = '';
function boardControl(){
  const cfg = boardCfg(), ann = D.config.announce || {};
  const modes = [['auto','🔄 자동'], ['indiv','🎯 개인전 명단'], ['summary','📊 종합 현황'], ['awards','🏆 시상식'], ...ORDER_EVENTS.concat(['tug']).map(k => ['team:'+k, TEAM[k].icon+' '+TEAM[k].name])];
  const sw = (k, label, sub) => `<div class="item"><span class="name">${label}<span class="sub">${sub}</span></span><label class="switch"><input type="checkbox" data-ch="bcfg" data-k="${k}" ${cfg[k]?'checked':''}><span></span></label></div>`;
  const live = ann.text && !ann.cleared;
  return `<div class="cols half"><div class="card"><h2>📺 안내판 제어</h2>
      <h3 style="margin-top:0">보여 줄 화면</h3>
      <div class="chips">${modes.map(([k,l]) => `<button class="chip ${cfg.mode===k?'on':''}" data-a="bmode" data-v="${k}">${esc(l)}</button>`).join('')}</div>
      <p class="sub">자동으로 두면 가장 최근에 기록이 들어온 종목을 띄웁니다. 단체전 결과가 나오면 위아래로 승패를 보여 준 뒤 다음 선수를 부릅니다.</p>
      <div class="list">${sw('sound','🔔 띵동 소리','선수 호출·결과·안내방송 때 안내판에서 소리를 냅니다.')}
        ${sw('callVoice','🗣 호출할 때 이름 읽기','띵동 뒤에 "청팀 ○○○, 홍팀 ○○○ 선수 준비해 주세요"라고 읽어 줍니다.')}
        ${sw('chime','🎵 안내방송 차임벨','문자 안내방송 앞에 딩동댕동 소리를 냅니다.')}
        ${sw('flash','⚡ 깜빡임','호출·결과·안내 때 화면 테두리와 글씨를 깜빡여 눈에 띄게 합니다.')}</div>
      <div style="height:10px"></div><button class="btn wide" data-a="btest">🔔 안내판 소리 시험</button>
      <p class="sub">안내판 태블릿은 처음 켤 때 화면을 한 번 눌러야 소리가 납니다.</p></div>
    <div class="card"><h2>📢 문자 안내방송</h2>
      ${live ? `<div class="okline">지금 띄운 안내: ${esc(ann.text)}</div><button class="btn danger wide" data-a="annClear">안내 내리기</button><div style="height:12px"></div>` : ''}
      <textarea id="annText" data-in="ann" placeholder="안내판에 크게 띄우고 읽어 줄 내용" style="min-height:110px">${esc(annDraft)}</textarea>
      <div class="chips" style="margin:10px 0">${phrases().map((t,i) => `<span class="phr"><button class="chip" data-a="annPick" data-v="${i}">${esc(t)}</button><button class="phx" data-a="annDelPhrase" data-v="${i}" aria-label="문구 지우기">✕</button></span>`).join('')}</div>
      <div class="row"><button class="btn primary grow" data-a="annSend" data-v="voice">📢 띄우고 읽어 주기</button><button class="btn grow" data-a="annSend" data-v="text">글자만 띄우기</button></div>
      <div style="height:8px"></div><button class="btn small wide" data-a="annSavePhrase">입력한 내용을 자주 쓰는 문구로 저장</button>
      <p class="sub">안내판에 15초 동안 화면 가득 띄운 뒤, 내릴 때까지 위쪽 띠로 계속 보여 줍니다.</p></div></div>${awardsControl()}`;
}
function awardsControl(){
  const steps = awardSteps(), i = awardsStep(), on = boardCfg().mode==='awards';
  return `<div class="card"><h2>🏆 시상식</h2>
    <p class="sub">안내판을 시상식 화면으로 바꾸고, 개인전 종목별 3등 → 2등 → 1등, 마지막에 종합 우승 순서로 한 단계씩 발표합니다. 발표할 때마다 팡파르와 함께 이름을 읽어 줍니다.</p>
    <div class="row">${on ? '' : '<button class="btn primary grow" data-a="awStart">🏆 시상식 화면으로 바꾸기</button>'}
      ${on ? `<button class="btn grow" data-a="awStep" data-v="-1" ${i<0?'disabled':''}>◀ 이전</button><button class="btn primary grow" data-a="awStep" data-v="1" ${i>=steps.length-1?'disabled':''}>다음 발표 ▶</button><button class="btn" data-a="awEnd">끝내기</button>` : ''}</div>
    <div class="list" style="margin-top:10px">${steps.map((s,k) => `<div class="item ${k===i?'cur':''} ${k<i?'done':''}"><span class="no tag">${k+1}</span><span class="name">${esc(awardLabel(s))}<span class="sub">${s.kind==='team' ? `${esc(teamName('blue'))} ${s.tot.blue} : ${s.tot.red} ${esc(teamName('red'))}` : s.winners.map(x => esc(x.p.name)+' '+x.total+'점').join(', ')}</span></span>${k===i?'<span class="tag dark">지금 발표</span>':''}</div>`).join('')}</div></div>`;
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
  return `${INDIV[s.ev].name} ${s.rank}등, ${s.winners.map(x => `${teamName(x.p.team)} ${x.p.name}`).join(', ')}. 축하합니다.`;
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
    ${s.winners.map(x => `<div class="aname">${teamBadge(x.p.team,true)} ${esc(x.p.name)} <span class="apt">${x.total}점</span></div>`).join('')}</div>`;
}

Object.assign(ACT, {
  bdPerson: (el, v) => { BOARD.person = v || null; BOARD.personAt = now(); },
  bdDismiss: () => { if(BOARD.overlay) finishFx(); return false; },
  bdSound: () => { SND.unlock(); SND.dingdong(); },
  bmode: (el, v) => { setConfig({ board:{ mode:v } }); return false; },
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
});
document.addEventListener('change', e => { const el = e.target; if(el.dataset.ch==='bcfg') setConfig({ board:{ [el.dataset.k]: el.checked } }); });
document.addEventListener('input', e => { if(e.target.dataset.in==='ann') annDraft = e.target.value; });
// 호출 띠·깜빡임이 끝나는 시각에 맞춰 화면을 다시 그림
setInterval(() => { if(boardOn() && (BOARD.callFx || (D.config.announce||{}).text || schedule().length || boardCfg().mode==='awards')) queueRender(); }, 5000);
