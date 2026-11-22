'use strict';
/* ===================== 미니게임: 타격 연습장 · 번트 챌린지 · 도루 챌린지 =====================
   처음 화면(10번 미니게임)과 선수 육성의 마을(미니게임 연습장)에서 들어옴. 경기 계산(engine.js)과는 따로 놀고, 기록만 이 기기에 저장(bb_mini).
   화면은 다른 화면과 똑같이 "질문 + 번호 선택지"(go)라서 두 화면 방식이 같은 길로 진행하고, 화면 보며 하기 그림은 skin-mini.js가 kind(mg-*)를 보고 그림.
   - 타이밍으로 하기: 공이 오는 순간에 누름. 소리 신호만으로도 할 수 있음(공을 놓는 "퉁" → 박자 "똑" → 칠 때 높은 "삐").
     누르는 것: 숫자 키·스페이스·엔터 아무거나, 또는 단추(보이스오버 두 번 탭). 단추는 같은 자리(key k1~k3)를 계속 써서 초점이 그대로 남음.
   - 도루는 소리로 투수를 읽음: 낮은 "둥"은 홈으로 던짐(바로 누름), 높은 "딱딱"은 견제(참음).
   - 고르기로 하기: 타이밍 없이 노림수·방향·리드와 투수 동작 글을 보고 골라 확률로 정함.
   - 자동 시험(navigator.webdriver이고 window.__susp가 없을 때)은 기다리는 시간을 아주 짧게 함 */
const MG = { from:'home', g:'bat', mode:'tm', st:null, run:null, res:null, eat:0, seq:0, hear:null };
const MG_GAMES = {
  bat:{ name:'타격 연습장', n:10, unit:'구', ico:'bat', short:'피칭 머신이 던지는 공 10개를 쳐서 점수를 모읍니다.',
    rules:['피칭 머신이 공 10개를 던집니다. 공이 오는 순간에 맞춰 스윙하세요.',
      '소리 신호: 공을 놓는 "퉁", 날아오는 동안 박자 "똑", 칠 때를 알리는 높은 "삐". 삐 소리에 맞춰 누르세요. 빠른 공일수록 박자가 빠릅니다.',
      '숫자 키, 스페이스, 엔터 가운데 아무거나 누르거나 스윙 단추를 누릅니다. 누르지 않으면 지켜봅니다.',
      '점수: 파울 1점, 안타 3점, 2루타 5점, 3루타 6점, 홈런 10점. 홈런이 110미터를 넘으면 5미터마다 1점 더.'],
    pick:'타이밍 없이 공이 올 코스(몸쪽·가운데·바깥쪽)를 노리고 세기를 고릅니다. 노린 코스에 오면 잘 맞습니다. 코치 귀띔은 자주 맞지만 늘 맞지는 않습니다.' },
  bunt:{ name:'번트 챌린지', n:8, unit:'번', ico:'bunt', short:'방향을 고르고 공에 맞춰 번트를 댑니다. 멈춘 자리로 점수.',
    rules:['번트 8번. 먼저 공을 굴릴 방향(1루 쪽·3루 쪽·투수 앞)을 고르면 바로 공이 옵니다.',
      '소리 신호는 타격 연습장과 같습니다. 높은 "삐" 소리에 맞춰 누르면 공이 죽어서 선 가까이에 멈춥니다. 일찍 누르면 헛스윙, 늦으면 뜬공이 되기 쉽습니다.',
      '수비를 보세요. 앞으로 나온(전진한) 수비수 쪽은 잡히기 쉬워 점수가 적고, 반대쪽 선상이 가장 좋습니다. 투수 앞은 쉽지만 점수가 적습니다.',
      '점수: 완벽한 번트 최고 10점, 좋은 번트 최고 7점, 약한 번트 2점, 파울·헛스윙·뜬공 0점.'],
    pick:'타이밍 없이 방향만 고르고, 번트가 잘 될지는 확률로 정합니다. 투수 앞은 실패가 적습니다.' },
  steal:{ name:'도루 챌린지', n:6, unit:'번', ico:'steal', short:'1루 주자가 되어 투수를 읽고 2루를 훔칩니다.',
    rules:['1루 주자로 도루 6번. 먼저 리드를 고릅니다. 크게 할수록 빨리 가지만 견제에 잡히기 쉽습니다.',
      '투수가 세트 포지션에 들어가면(낮은 "톡톡") 잘 들으세요. 낮은 "둥" 소리는 홈으로 던지는 것: 바로 누르고 뛰세요. 높은 "딱딱" 소리는 견제: 누르면 아웃입니다.',
      '숫자 키, 스페이스, 엔터 가운데 아무거나 누르거나 뛰기 단추를 누릅니다. 너무 일찍 뛰면 투수에게 들킵니다.',
      '점수: 세이프 6점에 여유가 클수록 더(최고 15점), 견제를 잘 참으면 1점씩. 아웃은 0점.'],
    pick:'타이밍 없이 투수의 움직임을 글로 읽고 뛸지 기다릴지 고릅니다. 투수의 버릇은 자주 맞지만 늘 맞지는 않습니다.' },
};
const MG_POW = ['맞히기', '보통', '강하게'];
const MG_LOC = ['몸쪽', '가운데', '바깥쪽'];
const MG_DIR = ['1루 쪽', '3루 쪽', '투수 앞'];
const MG_LEAD = ['짧게', '보통', '크게'];
const mgFast = () => !!(navigator.webdriver && !window.__susp);
const mgRand = (a, b) => a + Math.random() * (b - a);
const mgPickW = ws => { let r = Math.random() * ws.reduce((a, b) => a + b, 0); for(let i = 0; i < ws.length; i++){ r -= ws[i]; if(r < 0) return i; } return ws.length - 1; };
const mgSec = ms => (Math.round(Math.abs(ms) / 10) / 100).toFixed(2);

/* ---------- 기록 (이 기기에만: bb_mini) ---------- */
const mgKey = (g, mode) => g + (mode === 'pick' ? '-c' : '');
function mgRecs(){ const r = ls.get('bb_mini', {}); return r && typeof r === 'object' ? r : {}; }
function mgBest(g, mode){ const r = mgRecs()[mgKey(g, mode)]; return r && r.best != null ? r : null; }
function mgSave(g, mode, score, extra){
  const all = mgRecs(), k = mgKey(g, mode), old = all[k] || { best:null, plays:0 };
  const isNew = old.best == null || score > old.best;
  all[k] = { ...old, plays:(old.plays || 0) + 1, last:score, ...(isNew ? { best:score, at:new Date().toISOString().slice(0, 10), ...extra } : {}) };
  ls.set('bb_mini', all);
  return { isNew, prev: old.best, best: all[k].best, first: old.best == null };
}
function mgBestText(g){
  const a = mgBest(g, 'tm'), b = mgBest(g, 'pick');
  if(!a && !b) return '아직 기록 없음';
  return [a ? `최고 ${a.best}점` : '', b ? `고르기 최고 ${b.best}점` : ''].filter(Boolean).join(', ');
}

/* ---------- 소리 신호 ----------
   신호 소리는 효과음을 꺼도 소리와 글로 하기에서는 남 (소리로 하는 게임이라서). 오디오 시계로 정확한 때에 맞춰 냄 */
const MG_SND = {
  motor:  (c, t) => { tone(c, t, 0.5, 80, 0.07, 'sawtooth', 170); noise(c, t, 0.5, 'bandpass', 420, 0.05, 2); },
  release:(c, t) => { tone(c, t, 0.08, 230, 0.4, 'square', 90); noise(c, t, 0.09, 'lowpass', 1300, 0.5); },
  tick:   (c, t) => { tone(c, t, 0.045, 1000, 0.22, 'triangle'); },
  beat:   (c, t) => { tone(c, t, 0.11, 1760, 0.3); },
  set:    (c, t) => { tone(c, t, 0.06, 392, 0.14); tone(c, t + 0.13, 0.06, 392, 0.14); },
  kick:   (c, t) => { tone(c, t, 0.26, 150, 0.55, 'sine', 65); noise(c, t, 0.14, 'lowpass', 480, 0.35); },
  pick:   (c, t) => { tone(c, t, 0.04, 2400, 0.22, 'square'); tone(c, t + 0.08, 0.04, 2400, 0.22, 'square'); },
  mitt:   (c, t) => SOUNDS.mitt(c, t),
  rec:    (c, t) => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, t + i * 0.12, 0.28, f, 0.18, 'triangle')); },
};
function mgSnd(name, atPerf){
  if(!SET.snd && !VIEW.a11y && name !== 'rec') return;
  const c = audio(); if(!c || !MG_SND[name]) return;
  if(c.state === 'suspended') c.resume().catch(() => {});
  const lat = c.outputLatency || c.baseLatency || 0, now = performance.now();
  const t = Math.max(c.currentTime + 0.003, c.currentTime + ((atPerf ?? now) - now) / 1000 - lat);
  try{ MG_SND[name](c, t); }catch(e){}
}
// 먼 뒤의 소리는 0.2초 전에 시계에 올림 (중간에 그만두면 타이머만 지우면 됨)
function mgCue(run, name, atPerf){
  const d = atPerf - performance.now();
  if(d < 250) mgSnd(name, atPerf);
  else run.timers.push(setTimeout(() => { if(MG.run === run || MG.hear === run) mgSnd(name, atPerf); }, d - 200));
}
// 결과 소리 (효과음 설정을 따름)
function mgFx(k){
  if(SET.vib && navigator.vibrate){ const v = { hr:VIB.hr, b3:VIB.b2, b2:VIB.b2, hit:VIB.hit, safe:VIB.safe, out:VIB.out, whiff:VIB.strike, perfect:VIB.hit }[k]; if(v) try{ navigator.vibrate(v); }catch(e){} }
  if(!SET.snd) return;
  const c = audio(); if(!c) return;
  const t = c.currentTime + 0.01, rec = SET.sndKind !== 'synth';
  const contact = k === 'hr' ? 'batBig' : k === 'whiff' ? 'whiff-s' : ['b3', 'b2', 'hit', 'foul'].includes(k) ? 'bat' : null;
  try{
    if(contact && !(rec && recPlay(c, recPick(contact), 0, 0.9))) SOUNDS[contact === 'whiff-s' ? 'whiff' : 'bat'](c, t);
    const after = { hr:'hr', b3:'xbh', b2:'xbh', hit:'hit', foul:'foul', safe:'safe', out:'out', perfect:'safe', bunt:'bunt', pop:'out' }[k];
    if(['perfect', 'bunt', 'pop', 'weak'].includes(k)) SOUNDS.bunt(c, t);
    if(after && SOUNDS[after]) SOUNDS[after](c, t + 0.25);
    if(k === 'hr' && rec && typeof cheer === 'function') cheer(c, 0.3, true, 0.8);
  }catch(e){}
}

/* ---------- 들어가기 · 나가기 ---------- */
function mgOpen(from, via){ MG.from = from; mgStop(); go(mgHome, via); }
function mgBack(via){
  mgStop();
  if(MG.from === 'career' && typeof visitScreen === 'function' && typeof CR === 'function'){ try{ if(CR()){ go(visitScreen, via); return; } }catch(e){} }
  go(homeScreen, via);
}
function mgStop(){
  [MG.run, MG.hear].forEach(r => { if(r) (r.timers || []).forEach(clearTimeout); });
  MG.run = null; MG.hear = null;
}
const mgBackName = () => MG.from === 'career' ? '마을로 돌아가기' : '처음 화면으로';
function mgHome(){
  const opts = Object.keys(MG_GAMES).map((k, i) => ({ n: i + 1, key:k, t: MG_GAMES[k].name, s:`${MG_GAMES[k].short} ${mgBestText(k)}.`, act: v => { MG.g = k; mgStop(); go(mgStart, v); } }));
  opts.push({ n:9, key:'out', t: mgBackName(), act: v => mgBack(v) });
  return { kind:'mg-home', q:'미니게임입니다. 어떤 게임을 할까요?', back: v => mgBack(v), opts };
}
function mgStart(){
  const g = MG_GAMES[MG.g], a = mgBest(MG.g, 'tm'), b = mgBest(MG.g, 'pick');
  const rec = [a ? `타이밍으로 하기 최고 기록 ${a.best}점 (${a.plays}번 함).` : '타이밍으로 하기 기록은 아직 없습니다.', b ? `고르기로 하기 최고 기록 ${b.best}점.` : ''].filter(Boolean);
  const snd = !SET.snd && VIEW.gfx ? ['효과음이 꺼져 있어 신호 소리가 나지 않습니다. 화면의 공을 보고 하세요.'] : [];
  return { kind:'mg-start', g: MG.g, q:`${g.name}입니다. 어떻게 할까요?`, say:[...g.rules, ...rec, ...snd], back: v => go(mgHome, v), opts:[
    { n:1, key:'tm', t:'타이밍으로 하기', s:'공이 오는 순간에 맞춰 누릅니다. 소리 신호만 듣고도 할 수 있습니다.', act: v => mgBegin('tm', v) },
    { n:2, key:'pick', t:'고르기로 하기', s: g.pick, act: v => mgBegin('pick', v) },
    { n:3, key:'hear', t:'신호 소리 들어 보기', s: MG.g === 'steal' ? '세트 "톡톡", 견제 "딱딱", 투구 "둥"을 차례로 들려줍니다.' : '"퉁"(공을 놓음), "똑"(박자), "삐"(칠 때)를 차례로 들려줍니다.', act: v => mgHear(v) },
    { n:4, key:'list', t:'다른 미니게임', act: v => { mgStop(); go(mgHome, v); } },
  ] };
}
function mgHear(via){
  mgStop();
  const run = MG.hear = { timers:[] }, now = performance.now() + 1600;
  let lines;
  if(MG.g === 'steal'){
    lines = ['잠시 뒤 차례로 들려줍니다: 세트 톡톡, 견제 딱딱과 1루 글러브 소리, 다시 세트 톡톡, 그리고 투구 둥.'];
    [['set', 0], ['pick', 1000], ['mitt', 1450], ['set', 2600], ['kick', 3700]].forEach(([n, t]) => mgCue(run, n, now + t));
  } else {
    lines = ['잠시 뒤 차례로 들려줍니다: 피칭 머신 소리, 공을 놓는 퉁, 박자 똑, 칠 때 삐. 두 번 들려줍니다.'];
    [0, 2600].forEach(o => { mgCue(run, 'motor', now + o); mgCue(run, 'release', now + o + 700); mgCue(run, 'tick', now + o + 1150); mgCue(run, 'beat', now + o + 1600); });
  }
  go(mgStart, via, lines);
}

/* ---------- 한 판 ---------- */
function mgBegin(mode, via){
  mgStop();
  MG.mode = mode;
  MG.st = { g: MG.g, mode, n: MG_GAMES[MG.g].n, i:0, score:0, log:[], cnt:{}, last:null, pow:1, phase: MG.g === 'bat' ? 'ready' : MG.g === 'bunt' ? 'dir' : 'lead', best0: mgBest(MG.g, mode) };
  mgPrep();
  go(mgPlay, via);
}
// 다음 공·도전 준비: 구종(빠르기), 코치 귀띔, 수비 위치
function mgPrep(){
  const st = MG.st;
  const PT = [['빠른 공', 740, 840], ['보통 공', 860, 960], ['느린 커브', 1000, 1120]];
  const p = PT[Math.floor(Math.random() * PT.length)];
  st.pitch = { name: p[0], T: Math.round(mgRand(p[1], p[2])) };
  // 공이 오는 코스: 다섯 군데 가운데 무작위 (동그라미도 그 자리로), 커브는 휘어 들어옴
  st.aim = [[44, 70], [52, 73], [60, 70], [46, 77], [58, 77]][Math.floor(Math.random() * 5)];
  st.bend = p[0] === '느린 커브' ? (Math.random() < 0.5 ? -7 : 7) : 0;
  if(st.g === 'bat'){
    st.loc = Math.floor(Math.random() * 3);
    const h = Math.random() < 0.65 ? st.loc : Math.floor(Math.random() * 3);
    st.hint = `${MG_LOC[h]} 공이 올 것 같아.`;
  }
  if(st.g === 'bunt') st.def = ['none', 'c1', 'c3'][mgPickW([1, 1.2, 1.2])];   // c1: 1루수 전진 · c3: 3루수 전진
  if(st.g === 'steal'){ st.moves = null; st.mi = 0; st.survived = 0; }
}
const mgDefText = d => d === 'c1' ? '1루수가 앞으로 나와 있습니다.' : d === 'c3' ? '3루수가 앞으로 나와 있습니다.' : '수비가 제자리에 있습니다.';
// 번트 방향마다 최고 점수: 전진한 수비수 쪽은 적고, 반대쪽 선상이 가장 많음
function mgBuntMax(dir, def){ if(dir === 2) return 4; const toward = (dir === 0 && def === 'c1') || (dir === 1 && def === 'c3'); return toward ? 5 : 10; }
const mgGuard = () => performance.now() - MG.eat < (mgFast() ? 150 : 600);   // 친 직후 한 번 더 누른 것은 다음 공으로 받지 않음

function mgPlay(){
  const st = MG.st; if(!st) return mgHome();
  const g = MG_GAMES[st.g];
  const quit = { n:9, key:'quit', t:'그만하기', s:'이번 판을 그만두고 설명 화면으로 돌아갑니다.', act: v => { mgStop(); go(mgStart, v); } };
  const base = { kind:'mg-play', g: st.g, mode: st.mode, back: v => { mgStop(); go(mgStart, v); } };
  const no = st.i + 1, head = `${no}${g.unit}째`;
  if(st.phase === 'end') return { ...base, q:`${g.n}${g.unit} 모두 끝났습니다. 합계 ${st.score}점. 1번을 누르면 결과를 봅니다.`, opts:[{ n:1, key:'k1', t:'결과 보기', act: v => mgFinish(v) }] };
  if(st.phase === 'live'){
    const lab = { bat:'스윙!', bunt:'번트!', steal:'뛰기!' }[st.g], k = st.g === 'bat' ? 1 : 3;
    const q = st.g === 'steal' ? `투수를 읽으세요. 둥 소리(투구)에 바로 누르면 2루로 뜁니다.${st.lead ? ' 딱딱 소리(견제)가 나면 바로 눌러 귀루하세요.' : ' 짧은 리드라 견제는 그냥 참으면 됩니다.'}` : '삐 소리에 맞춰 누르세요.';
    return { ...base, q, opts: Array.from({ length:k }, (_, i) => ({ n: i + 1, key:'k' + (i + 1), t: lab, act: () => mgTap() })) };
  }
  if(st.g === 'bat'){
    if(st.mode === 'tm'){
      const q = st.i === 0 ? `${head}, ${st.pitch.name}입니다. 1번을 누르면 피칭 머신이 던집니다. 퉁, 똑, 다음 높은 삐 소리에 맞춰 아무 키나 누르세요.` : `${head}, ${st.pitch.name}. 1번을 누르면 던집니다.`;
      return { ...base, q, opts:[{ n:1, key:'k1', t: st.i === 0 ? '공 던지기' : '다음 공', s: st.pitch.name, act: () => { if(!mgGuard()) mgPitchStart(); } }, quit] };
    }
    return { ...base, q:`${head}. 코치 귀띔: "${st.hint}" 어느 코스를 노릴까요? 세기는 ${MG_POW[st.pow]}입니다.`, opts:[
      ...MG_LOC.map((t, i) => ({ n: i + 1, key:'k' + (i + 1), loc:i, t:`${t} 노리기`, act: v => { if(!mgGuard()) mgBatPick(i, v); } })),
      { n:4, key:'pow', t:`세기: ${MG_POW[st.pow]}`, s:'맞히기 → 보통 → 강하게. 강하게는 멀리 가지만 헛스윙이 많고, 맞히기는 잘 맞지만 덜 날아갑니다.', act: () => { st.pow = (st.pow + 1) % 3; stay(`세기 ${MG_POW[st.pow]}.`); } },
      quit] };
  }
  if(st.g === 'bunt'){
    const q = `${head}. ${mgDefText(st.def)} 어느 쪽으로 번트를 댈까요?${st.mode === 'tm' ? (st.i === 0 ? ' 고르면 바로 공이 옵니다. 높은 삐 소리에 맞춰 아무 키나 누르세요.' : ' 고르면 바로 공이 옵니다.') : ''}`;
    return { ...base, q, opts:[
      ...MG_DIR.map((t, i) => ({ n: i + 1, key:'k' + (i + 1), dir:i, t, s:`완벽하면 ${mgBuntMax(i, st.def)}점.`, act: v => { if(mgGuard()) return; st.dir = i; if(st.mode === 'tm') mgPitchStart(); else mgBuntPick(v); } })),
      quit] };
  }
  // 도루
  if(st.phase === 'read'){
    const m = st.moves[st.mi];
    return { ...base, q:`투수의 움직임: ${m.tell} 뛸까요?`, opts:[
      { n:1, key:'run', t:'뛰기', s:'홈으로 던지는 동작이면 도루, 견제면 아웃.', act: v => mgStealRead(true, v) },
      { n:2, key:'wait', t:'기다리기', s:'견제면 귀루, 투구면 이번 도전은 출발하지 못합니다.', act: v => mgStealRead(false, v) },
      quit] };
  }
  const q = `${head}. 리드를 얼마나 할까요?${st.mode === 'tm' ? (st.i === 0 ? ' 고르면 투수가 세트 포지션에 들어갑니다. 낮은 둥 소리에 바로 아무 키나 누르고, 높은 딱딱 소리(견제)에는 참으세요.' : ' 고르면 투수가 세트에 들어갑니다.') : ''}`;
  return { ...base, q, opts:[
    { n:1, key:'k1', lead:0, t:'짧게 리드', s:'느리지만 견제에 잡히지 않습니다.', act: v => mgLead(0, v) },
    { n:2, key:'k2', lead:1, t:'보통 리드', s:'알맞은 빠르기. 견제에 아주 가끔 잡힙니다.', act: v => mgLead(1, v) },
    { n:3, key:'k3', lead:2, t:'크게 리드', s:'가장 빠르지만 견제가 오면 다섯 번에 한 번은 잡힙니다.', act: v => mgLead(2, v) },
    quit] };
}

/* ---------- 타이밍: 타격·번트 ---------- */
function mgPitchStart(){
  if(MG.run) return;
  const st = MG.st, fast = mgFast(), now = performance.now();
  const W = fast ? 120 : Math.round(mgRand(900, 1500)), T = fast ? 300 : st.pitch.T;
  const run = MG.run = { g: st.g, t0: now, rel: now + W, ideal: now + W + T, T, W, done:false, timers:[] };
  mgCue(run, 'motor', now + 20); mgCue(run, 'release', run.rel); mgCue(run, 'tick', run.rel + T / 2); mgCue(run, 'beat', run.ideal);
  run.timers.push(setTimeout(() => mgPitchEnd(null), W + T + (fast ? 220 : st.g === 'bunt' ? 450 : 420)));
  st.phase = 'live';
  rerender();
}
function mgTap(){
  const r = MG.run; if(!r || r.done) return;
  if(UI.make !== mgPlay){ mgStop(); return; }
  const now = performance.now();
  if(r.g === 'steal'){ mgStealTap(now); return; }
  if(now < r.rel) return;   // 공을 놓기 전에 누른 것은 무시 (헛스윙으로 치지 않음)
  mgPitchEnd(now);
}
function mgPitchEnd(tap){
  const r = MG.run, st = MG.st; if(!r || r.done || !st) return;
  r.done = true; r.timers.forEach(clearTimeout); MG.run = null;
  if(UI.make !== mgPlay) return;
  // e: 누른 때 - 칠 때(초). 공을 놓기 전에 누르면 아주 빠름. 누르지 않으면 null
  const e = tap == null ? null : tap < r.rel ? -1 : (tap - r.ideal) / 1000;
  const res = st.g === 'bat' ? mgBatRes(e, st.pow, true) : mgBuntRes(e, st.dir, st.def, true);
  mgAfter(res);
}
// 소리와 글로 하기는 소리를 듣고 누르므로 판정 폭을 조금 넓힘
const mgTol = () => VIEW.a11y ? 1.3 : 1;
function mgBatTier(e){
  if(e == null) return 'take';
  const a = Math.abs(e) / mgTol();
  return e === -1 ? 'whiff' : a <= 0.045 ? 'perfect' : a <= 0.09 ? 'great' : a <= 0.15 ? 'good' : a <= 0.24 ? 'foul' : 'whiff';
}
// 타격 결과: 등급 → 종류·방향·거리·점수. pow 0 맞히기 · 1 보통 · 2 강하게
function mgBatRes(e, pow = 1, timed = false, tier0){
  let tier = tier0 || mgBatTier(e);
  const dirs = ['좌측', '좌중간', '가운데', '우중간', '우측'], ee = e == null || e === -1 ? 0 : e;
  const di = ee < -0.07 ? 0 : ee < -0.025 ? 1 : ee <= 0.025 ? 2 : ee <= 0.07 ? 3 : 4, dir = dirs[di];
  const x = [-0.85, -0.45, 0, 0.45, 0.85][di] + mgRand(-0.08, 0.08);
  let k, dist = 0;
  if(tier === 'take') k = 'take';
  else if(tier === 'whiff') k = 'whiff';
  else if(tier === 'foul') k = 'foul';
  else if(tier === 'perfect') k = Math.random() < 0.85 ? 'hr' : 'b2';
  else if(tier === 'great') k = ['hr', 'b2', 'b3'][mgPickW([35, 45, 20])];
  else k = Math.random() < 0.9 ? 'hit' : 'b2';
  if(pow === 0 && k === 'hr' && tier !== 'perfect') k = 'b2';
  if(k === 'hr') dist = Math.round((tier === 'perfect' ? mgRand(118, 138) : mgRand(102, 116)) + (Math.abs(ee) < 0.02 ? 6 : 0));
  if(k === 'b3') dist = Math.round(mgRand(95, 112)); if(k === 'b2') dist = Math.round(mgRand(84, 104)); if(k === 'hit') dist = Math.round(mgRand(42, 78));
  if(dist) dist += pow === 2 ? 7 : pow === 0 ? -8 : 0;
  const pts = { hr: 10 + Math.max(0, Math.floor((dist - 110) / 5)), b3:6, b2:5, hit:3, foul:1, whiff:0, take:0 }[k];
  const early = e === -1 || ee < 0;
  const text = { hr:`딱! ${dir} 담장을 넘어가는 홈런! ${dist}미터.`, b3:`${dir} 깊숙이 3루타! ${dist}미터.`, b2:`${dir} 2루타! ${dist}미터.`, hit:`${dir} 안타! ${dist}미터.`,
    foul:`${early ? '3루' : '1루'} 쪽 파울.`, whiff: e === -1 ? '헛스윙! 공이 오기도 전에 휘둘렀습니다.' : `헛스윙! ${early ? '너무 빨랐습니다' : '너무 늦었습니다'}.`, take:'치지 않고 지켜봤습니다.' }[k];
  const tm = timed && e != null && e !== -1 && tier !== 'perfect' ? ` 타이밍 ${mgSec(e * 1000)}초 ${e < 0 ? '빠름' : '늦음'}.` : timed && tier === 'perfect' ? ' 타이밍 딱 맞음!' : '';
  return { g:'bat', k, tier, dist, dir, x, pts, e, text: text + tm };
}
function mgBatPick(aim, via){
  const st = MG.st, off = Math.abs(aim - st.loc), pow = st.pow;
  // 노린 코스와 온 코스가 같으면 타이밍 오차가 작음. 세기에 따라 판정 폭이 다름
  let e = (off === 0 ? mgRand(0, 0.1) : off === 1 ? mgRand(0.05, 0.2) : mgRand(0.14, 0.34)) * (pow === 2 ? 1.25 : pow === 0 ? 0.7 : 1) * mgTol();
  if(Math.random() < 0.5) e = -e;
  const res = mgBatRes(e, pow, false);
  res.text = `${MG_LOC[st.loc]} ${st.pitch.name}. ${res.text}`;
  mgAfter(res, via);
}

/* ---------- 번트 ---------- */
function mgBuntTier(e){
  if(e == null) return 'none';
  if(e === -1) return 'miss';
  const a = Math.abs(e) / mgTol();
  return a <= 0.09 ? 'perfect' : a <= 0.18 ? 'good' : a <= 0.3 ? 'weak' : e < 0 ? 'miss' : 'pop';   // 번트는 공을 갖다 대기만 하면 되므로 폭을 넓게
}
function mgBuntRes(e, dir, def, timed = false, tier0){
  const tier = tier0 || mgBuntTier(e), max = mgBuntMax(dir, def), zone = ['1루 선상', '3루 선상', '투수 앞'][dir];
  let k = tier, pts = 0, text;
  if(tier === 'perfect'){ pts = max; text = `${zone}에 절묘하게 멈췄습니다. 완벽한 번트!`; k = 'perfect'; }
  else if(tier === 'good'){ pts = dir === 2 ? 3 : max === 5 ? 3 : 7; text = `${zone}으로 잘 굴렀습니다. 조금 강했지만 좋은 번트.`; k = 'good'; }
  else if(tier === 'weak'){
    if(dir !== 2 && Math.random() < 0.5){ k = 'foul'; text = '선 밖으로 굴러 파울.'; }
    else { k = 'weak'; pts = 2; text = `${dir === 2 ? '투수' : MG_DIR[dir].replace(' 쪽', '수')} 정면으로 강하게 갔습니다. 아쉬운 번트.`; }
  }
  else if(tier === 'miss') text = e === -1 ? '공이 오기도 전에 방망이를 내밀어 헛스윙.' : '너무 빨라서 공을 맞히지 못했습니다.';
  else if(tier === 'pop') text = '늦어서 공이 떠올랐습니다. 번트 뜬공.';
  else text = '번트를 대지 못했습니다.';
  const tm = timed && e != null && e !== -1 && tier !== 'perfect' ? ` 타이밍 ${mgSec(e * 1000)}초 ${e < 0 ? '빠름' : '늦음'}.` : '';
  return { g:'bunt', k, tier, dir, zone, pts, e, text: `${MG_DIR[dir]}: ${text}${tm}` };
}
function mgBuntPick(via){
  const st = MG.st, ws = st.dir === 2 ? [40, 40, 20, 0, 0] : [30, 35, 25, 6, 4];
  const tier = ['perfect', 'good', 'weak', 'miss', 'pop'][mgPickW(ws)];
  mgAfter(mgBuntRes(null, st.dir, st.def, false, tier), via);
}

/* ---------- 도루 ---------- */
const MG_TELL = {
  pitch:['투수가 포수 사인에 고개를 끄덕이고 홈 쪽으로 어깨를 닫습니다.', '투수의 앞다리 무릎이 안쪽으로 모입니다.', '투수가 1루는 보지 않고 포수 미트만 봅니다.'],
  pick:['투수가 1루 쪽을 힐끗 봅니다.', '투수의 뒷발 뒤꿈치가 살짝 들립니다.', '투수가 공을 쥔 채 유난히 오래 멈춥니다.'],
};
const MG_LEAD_T = [3.15, 3.02, 2.90];   // 리드별 2루까지 걸리는 시간(초, 반응 시간 빼고)
const MG_LEAD_RISK = [0, 0.03, 0.1];   // 고르기로 하기: 견제가 오면 귀루하다 잡힐 확률
// 타이밍으로 하기: 견제가 오면 단추가 '귀루!'로 바뀌고 이 시간(초) 안에 누르면 세이프. 짧은 리드는 누르지 않아도 세이프
const MG_BACK_WIN = [null, 0.75, 0.5];
function mgMoves(){
  const n = mgPickW([45, 35, 20]), out = [];
  for(let i = 0; i < n; i++) out.push({ type:'pick' }); out.push({ type:'pitch' });
  // 고르기로 하기: 움직임을 글로 (다섯 번에 한 번은 반대 버릇)
  out.forEach(m => { const real = Math.random() < 0.8 ? m.type : m.type === 'pick' ? 'pitch' : 'pick'; const L = MG_TELL[real]; m.tell = L[Math.floor(Math.random() * L.length)]; });
  return out;
}
function mgLead(lead, via){
  const st = MG.st; if(mgGuard()) return;
  st.lead = lead; st.moves = mgMoves(); st.mi = 0; st.survived = 0;
  if(st.mode === 'pick'){ st.phase = 'read'; go(mgPlay, via, [`${MG_LEAD[lead]} 리드를 했습니다.`]); return; }
  const fast = mgFast(), sc = fast ? 0.12 : 1, now = performance.now();
  const run = MG.run = { g:'steal', t0: now, lead, done:false, timers:[], moves: st.moves, cue:null, cueAt:0, mi:-1 };
  let t = now + mgRand(1100, 2300) * sc;
  run.moves.forEach(m => { m.at = t; if(m.type === 'pick') t += mgRand(1500, 2400) * sc; });
  mgCue(run, 'set', now + 30);
  run.moves.forEach((m, i) => {
    if(m.type === 'pick'){
      mgCue(run, 'pick', m.at); mgCue(run, 'mitt', m.at + 450 * sc);
      if(i > 0) mgCue(run, 'set', m.at - 700 * sc);
    } else { mgCue(run, 'kick', m.at); if(i > 0) mgCue(run, 'set', m.at - 800 * sc); }
    run.timers.push(setTimeout(() => {
      if(MG.run !== run || run.done) return;
      run.cue = m.type; run.cueAt = m.at; run.mi = i;
      if(m.type === 'pick') run.timers.push(setTimeout(() => mgPickoffEnd(run, i), (MG_BACK_WIN[run.lead] ? MG_BACK_WIN[run.lead] * 1000 : 500) * sc));
      else run.timers.push(setTimeout(() => mgStealEnd(run, null), (fast ? 450 : 1100)));
    }, Math.max(0, m.at - performance.now())));
  });
  st.phase = 'live';
  rerender();
}
// 견제가 지나감: 귀루 단추를 제때 눌렀으면(짧은 리드는 저절로) 세이프 1점(큰 리드는 2점), 아니면 견제사
function mgPickoffEnd(run, i){
  if(MG.run !== run || run.done) return;
  const backed = (run.backed || {})[i];
  if(!backed && MG_BACK_WIN[run.lead]){ mgStealOut(run, `견제구! 귀루가 늦어 아웃. ${MG_LEAD[run.lead]} 리드에서는 견제가 오면 바로 눌러야 합니다.`); return; }
  MG.st.survived += run.lead === 2 ? 2 : 1;
  run.cue = 'reset';
}
function mgStealTap(t){
  const run = MG.run, sc = mgFast() ? 0.12 : 1;
  // 시각으로 따짐 (타이머가 조금 늦게 와도 같은 판정): cur 이미 나온 마지막 동작 · next 아직 안 나온 동작
  const idx = run.moves.findIndex(m => m.at > t);
  const ci = idx === -1 ? run.moves.length - 1 : idx - 1, cur = ci >= 0 ? run.moves[ci] : null, next = idx === -1 ? null : run.moves[idx];
  if(cur && cur.type === 'pitch'){ mgStealEnd(run, (t - cur.at) / 1000); return; }
  // 견제 중: 누르면 귀루 (제때면 세이프). 이미 귀루했으면 무시
  if(cur && cur.type === 'pick' && t < cur.at + 1400 * sc){ (run.backed ||= {})[ci] = true; run.backAt = t; return; }
  // 아직 다음 동작 전: 투구 직전이면 미리 스타트, 그보다 이르면 무시 (견제를 기다리는 중의 실수로 아웃되지 않게)
  if(!next){ mgStealEnd(run, null); return; }
  if(next.type === 'pick') return;
  const early = next.at - t;
  if(early > 350 * sc) return;
  mgStealEnd(run, -Math.min(0.15, early / 1000 / sc));
}
function mgStealOut(run, text){
  if(run.done) return;
  run.done = true; run.timers.forEach(clearTimeout); MG.run = null;
  if(UI.make !== mgPlay) return;
  mgAfter({ g:'steal', k:'out', pts:0, out:true, pickoff:true, lead: run.lead, text });
}
// rt: 투구 동작부터 뛴 때까지(초). null이면 출발하지 못함
function mgStealEnd(run, rt){
  if(run.done) return;
  run.done = true; run.timers.forEach(clearTimeout); MG.run = null;
  if(UI.make !== mgPlay) return;
  mgAfter(mgStealRes(run.lead, rt, true));
}
function mgStealRes(lead, rt, timed){
  const sv = MG.st.survived || 0, bonus = sv ? ` 견제를 ${sv}번 참아 ${sv}점.` : '';
  if(rt == null) return { g:'steal', k:'stay', pts: sv, lead, text:`투구였는데 출발하지 못했습니다.${bonus}` };
  const runner = MG_LEAD_T[lead] + Math.max(-0.15, rt) * 1.05, catcher = mgRand(3.3, 3.6), margin = catcher - runner;
  const start = !timed ? '' : rt < 0.02 ? '스타트가 아주 빨랐습니다! ' : `반응 ${mgSec(rt * 1000)}초. `;
  if(margin <= 0) return { g:'steal', k:'out', pts: 0, lead, rt, margin, text:`${start}포수의 송구가 빨랐습니다. 2루에서 아웃.` };
  const pts = 6 + Math.min(9, Math.round(margin * 40)) + sv + lead;
  return { g:'steal', k:'safe', pts, lead, rt, margin, text:`${start}2루 ${margin > 0.15 ? '여유 있게' : margin < 0.05 ? '간발의 차로' : ''} 세이프! ${pts}점.${bonus}`.replace('  ', ' ') };
}
function mgStealRead(run, via){
  const st = MG.st, m = st.moves[st.mi]; if(mgGuard()) return;
  if(run){
    if(m.type === 'pick'){ mgAfter({ g:'steal', k:'out', pts:0, lead: st.lead, pickoff:true, text:'견제구였습니다. 뛰다가 견제사.' }, via); return; }
    mgAfter(mgStealRes(st.lead, mgRand(0.08, 0.3), false), via); return;
  }
  if(m.type === 'pitch'){ mgAfter(mgStealRes(st.lead, null, false), via); return; }
  if(Math.random() < MG_LEAD_RISK[st.lead]){ mgAfter({ g:'steal', k:'out', pts:0, lead: st.lead, pickoff:true, text:`견제구! ${MG_LEAD[st.lead]} 리드라 귀루가 늦어 아웃.` }, via); return; }
  st.survived++; st.mi++;
  go(mgPlay, via, [`견제구였습니다. 귀루 세이프. 1점.`]);
}

/* ---------- 결과 하나 → 다음 ---------- */
function mgAfter(res, via = 'key'){
  const st = MG.st;
  st.i++; st.score += res.pts; st.log.push(res); st.cnt[res.k] = (st.cnt[res.k] || 0) + 1;
  st.last = { ...res, id: ++MG.seq };
  st.phase = st.i >= st.n ? 'end' : st.g === 'bat' ? 'ready' : st.g === 'bunt' ? 'dir' : 'lead';
  if(st.phase !== 'end') mgPrep();
  MG.eat = performance.now();
  mgFx(res.g === 'bunt' ? ({ perfect:'perfect', good:'bunt', weak:'weak', pop:'pop', foul:'foul', miss:'whiff' }[res.k] || '') : res.k);
  const g = MG_GAMES[st.g];
  const lines = [`${st.i}${g.unit}: ${res.text}${res.pts && res.g !== 'steal' ? ` ${res.pts}점.` : ''}`, `합계 ${st.score}점${st.i < st.n ? `, 남은 ${st.n - st.i}${g.unit}` : ''}.`];
  // 타이밍 결과는 누른 키로 진행했든 단추로 했든 초점을 옮기지 않고 알림으로 읽음 (같은 단추로 바로 다음 공)
  go(mgPlay, st.mode === 'tm' ? 'key' : via, lines);
}
function mgFinish(via){
  const st = MG.st; if(!st || mgGuard()) return;
  const extra = st.g === 'bat' ? { hr: st.cnt.hr || 0, far: Math.max(0, ...st.log.filter(r => r.k === 'hr').map(r => r.dist)) } : st.g === 'bunt' ? { perfect: st.cnt.perfect || 0 } : { safe: st.cnt.safe || 0 };
  MG.res = { g: st.g, mode: st.mode, score: st.score, log: st.log.slice(), cnt: { ...st.cnt }, n: st.n, ...mgSave(st.g, st.mode, st.score, extra), extra };
  if(MG.res.isNew && !MG.res.first) mgSnd('rec');
  else if(SET.snd){ const c = audio(); if(c) try{ SOUNDS.end(c, c.currentTime + 0.05); }catch(e){} }
  go(mgResult, via);
}
function mgSummary(r){
  const c = r.cnt;
  if(r.g === 'bat'){
    const far = Math.max(0, ...r.log.filter(x => x.dist).map(x => x.dist));
    return [`홈런 ${c.hr || 0}, 3루타 ${c.b3 || 0}, 2루타 ${c.b2 || 0}, 안타 ${c.hit || 0}, 파울 ${c.foul || 0}, 헛스윙 ${c.whiff || 0}${c.take ? `, 지켜봄 ${c.take}` : ''}.`, far ? `가장 멀리 친 공 ${far}미터.` : ''];
  }
  if(r.g === 'bunt') return [`완벽 ${c.perfect || 0}, 좋음 ${c.good || 0}, 약함 ${c.weak || 0}, 파울 ${c.foul || 0}, 실패 ${(c.miss || 0) + (c.pop || 0) + (c.none || 0)}.`];
  const rts = r.log.filter(x => x.rt != null && x.rt >= 0).map(x => x.rt);
  return [`세이프 ${c.safe || 0}, 아웃 ${c.out || 0}, 출발 못함 ${c.stay || 0}.`, rts.length ? `가장 빠른 반응 ${mgSec(Math.min(...rts) * 1000)}초.` : ''];
}
function mgResult(){
  const r = MG.res; if(!r) return mgHome();
  const g = MG_GAMES[r.g];
  const head = r.isNew && !r.first ? `신기록! ${r.score}점. 이전 최고 ${r.prev}점.` : r.first ? `${r.score}점. 첫 기록입니다.` : `${r.score}점. 최고 기록 ${r.best}점.`;
  return { kind:'mg-res', g: r.g, q:`${g.name}${r.mode === 'pick' ? '(고르기)' : ''} 결과입니다. 다시 할까요?`, say:[head, ...mgSummary(r)].filter(Boolean), back: v => go(mgHome, v), opts:[
    { n:1, key:'again', t:'다시 하기', act: v => { MG.g = r.g; mgBegin(r.mode, v); } },
    { n:2, key:'list', t:'다른 미니게임', act: v => go(mgHome, v) },
    { n:3, key:'out', t: mgBackName(), act: v => mgBack(v) },
  ] };
}

/* ---------- 키: 타이밍을 재는 동안은 아무 키나 누르면 스윙·번트·뛰기 (점·Esc·백스페이스는 멈춤) ---------- */
document.addEventListener('keydown', e => {
  const r = MG.run; if(!r || r.done || UI.make !== mgPlay) return;
  if(e.ctrlKey || e.metaKey || e.altKey || (typeof dlgOpen === 'function' && dlgOpen())) return;
  const stop = ['Escape', '.', 'Backspace'].includes(e.key) || e.code === 'NumpadDecimal';
  const tap = /^[0-9]$/.test(e.key) || e.key === ' ' || e.key === 'Enter' || /^Numpad/.test(e.code || '');
  if(!stop && !tap) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if(e.repeat) return;
  if(stop){ mgAbort('key'); return; }
  mgTap();
}, true);
// 재는 도중에 멈춤: 이번 공은 세지 않고 앞 단계로
function mgAbort(via){
  const st = MG.st; mgStop();
  if(!st) return;
  st.phase = st.g === 'bat' ? 'ready' : st.g === 'bunt' ? 'dir' : 'lead';
  go(mgPlay, via, ['멈췄습니다. 이번 공은 세지 않습니다.']);
}
