'use strict';
/* ===================== 온라인 대전 화면 =====================
   방장: 방을 만들고 경기를 계산함. 손님이 보낸 선택은 확인한 뒤에만 씀(자기 팀 차례인지, 값이 맞는지).
   손님: 방 코드로 들어와 자기 팀만 고름. 화면은 방장이 보낸 상태로 그림.
   채팅은 명령 칸에 적거나 빠른 문구로 보내고, 음성은 js/voice.js */

/* ---------- 온라인 첫 화면 ---------- */
function onlineHome(){
  const sv = ls.get('bb_net', null);
  return { q:'온라인 대전입니다. 무엇을 할까요?', back: v => go(homeScreen, v),
    note:[`내 이름: ${SET.name || '아직 없음'}. 음성 대화 방식: ${SET.vmode === 'ptt' ? '무전기' : '통화'}.`],
    opts:[
      { n:1, t:'방 만들기', s:'방을 만들고 방 코드를 상대에게 알려 줍니다.', act: v => needName(v, () => { NEW.kind = 'online'; go(modeScreen, 'click'); }) },
      { n:2, t:'방 코드로 들어가기', s:'상대에게 받은 숫자 네 자리를 누릅니다.', act: v => needName(v, () => { UI.codeBuf = ''; go(codeScreen, 'click'); }) },
      { n:3, t:`내 이름: ${SET.name || '없음'}`, s:'상대에게 보이는 이름입니다.', act: v => go(() => nameScreen(() => go(onlineHome, 'click')), v) },
      { n:4, t:`음성 대화 방식: ${SET.vmode === 'ptt' ? '무전기 (누르는 동안 말하기)' : '통화 (계속 켜 두기)'}`, s:'목소리는 기기끼리 직접 오가서 서버 한도를 쓰지 않습니다.',
        act: () => { SET.vmode = SET.vmode === 'ptt' ? 'call' : 'ptt'; saveSet(); applyMic(); voiceUI(); stay(`음성 대화 방식 ${SET.vmode === 'ptt' ? '무전기' : '통화'}`); } },
      { n:5, t:'방 다시 들어가기', hide: !sv, s: sv ? `방 코드 ${spaced(sv.code)}, ${sv.role === 'host' ? '내가 만든 방' : '손님으로 들어갔던 방'}` : '', act: v => resumeOnline(v) },
    ] };
}
function needName(via, next){ if(SET.name) next(); else go(() => nameScreen(next), via); }
function nameScreen(next){
  return { q:`이름을 명령 칸에 적고 입력을 누르세요.${SET.name ? ` 지금 이름은 ${SET.name}입니다.` : ''}`, focusCmd:true, back: v => go(onlineHome, v),
    onText: t => { t = t.trim().slice(0, 12); if(!t) return; SET.name = t; saveSet(); speak(`이름을 ${josa(t, '으로', '로')} 정했습니다.`); next(); },
    opts:[{ n:1, t:'지금 이름 그대로 쓰기', hide: !SET.name, act: () => next() }] };
}
function codeScreen(){
  const buf = UI.codeBuf || '';
  const add = (d, v) => {
    UI.codeBuf = (UI.codeBuf || '') + d;
    if(UI.codeBuf.length >= 4){ const c = UI.codeBuf.slice(0, 4); UI.codeBuf = ''; startJoin(c, v); return; }
    rerender(); speak(`${d}. 지금까지 ${spaced(UI.codeBuf)}`);
  };
  const opts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => ({ n:d, key:'d' + d, t:String(d), cls:'z', act: v => add(d, v) }));
  return { grid:true, input:true, q:`방 코드 네 자리를 누르세요. 지금까지 ${buf ? spaced(buf) : '없음'}. 점(.)은 한 자리 지우기입니다.`, opts,
    onDigit: (d, v) => add(d, v),
    onText: (t, v) => { const c = t.replace(/\D/g, ''); if(c.length === 4) startJoin(c, v); else speak('숫자 네 자리를 적어 주세요.'); },
    back: v => { if(UI.codeBuf){ UI.codeBuf = UI.codeBuf.slice(0, -1); rerender(); speak(`지웠습니다. 지금까지 ${UI.codeBuf ? spaced(UI.codeBuf) : '없음'}`); } else go(onlineHome, v); } };
}

/* ---------- 방 만들기 · 들어가기 ---------- */
function roomCfgFromNew(){
  return { mode: NEW.mode, unit: NEW.unit, innings: NEW.innings, hostTeam: NEW.a, guestTeam: NEW.b, hostSide: NEW.first === 1 ? 0 : 1 };
}
async function createRoomFlow(via){
  go(() => ({ q:'방을 만드는 중입니다…', opts:[] }), via);
  try{
    await netCreate(roomCfgFromNew());
    G = null;
    go(lobbyScreen, 'click', [`방을 만들었습니다. 방 코드는 ${spaced(NET.code)}입니다.`]);
  }catch(e){ go(onlineHome, 'click', [netErr(e)]); }
}
async function startJoin(code, via){
  go(() => ({ q:`방 ${spaced(code)}에 들어가는 중입니다…`, opts:[] }), via);
  try{
    const err = await netJoin(code);
    if(err){ UI.codeBuf = ''; go(codeScreen, 'click', [err]); return; }
    G = null;
    go(lobbyScreen, 'click', [`${NET.peer.name}님의 방에 들어왔습니다.`]);
  }catch(e){ UI.codeBuf = ''; go(codeScreen, 'click', [netErr(e)]); }
}
async function resumeOnline(via){
  const sv = ls.get('bb_net', null); if(!sv) return;
  go(() => ({ q:'방에 다시 연결하는 중입니다…', opts:[] }), via);
  try{
    const err = sv.role === 'host' ? await netReopen(sv.code) : await netJoin(sv.code);
    if(err){ ls.del('bb_net'); go(onlineHome, 'click', [err]); return; }
    const g = ls.get('bb_netg', null);
    if(sv.role === 'host' && g && g.code === sv.code && g.G && !g.G.over){
      G = g.G; G.out = []; G.fx = []; GS.opts = g.opts; GS.pend = { def:null, off:null }; GS.auto = null;
      UI.logG = null;
      gameNext('click', { lines:[{ s:'방을 다시 열고 경기를 이어 합니다. ' + situation(G), k:'i' }], fx:[] });
      return;
    }
    G = null;
    go(lobbyScreen, 'click', ['방에 다시 들어왔습니다.']);
  }catch(e){ go(onlineHome, 'click', [netErr(e)]); }
}
function cfgSummary(){
  const c = NET.cfg; if(!c) return [];
  const me = SET.name || '나', peer = NET.peer ? NET.peer.name : '상대';
  const hostName = NET.role === 'host' ? me : peer, guestName = NET.role === 'host' ? (NET.peer ? peer : '손님') : me;
  const order = s => s === 0 ? '먼저 공격' : '나중에 공격';
  return [`${MODE_NAME[c.mode] || '정밀 모드'}${c.mode === 'simple' ? (c.unit === 'pitch' ? '(공 하나씩)' : '(타석 한 번에)') : ''}, ${c.innings}이닝 경기입니다.`,
    `${hostName}: ${teamLabel(c.hostTeam)}, ${order(c.hostSide)}.`,
    `${guestName}: ${teamLabel(c.guestTeam)}, ${order(1 - c.hostSide)}.`,
    `경기장: ${parkInfo(c.hostSide === 1 ? c.hostTeam : c.guestTeam).name}.`];
}
function lobbyScreen(){
  const host = NET.role === 'host', peer = NET.peer;
  const q = host ? (peer ? `${peer.name}님이 들어왔습니다. 경기를 시작할까요?` : `방 코드는 ${spaced(NET.code)}입니다. 상대에게 알려 주고, 들어오기를 기다립니다.`)
                 : `${peer ? peer.name + '님' : '방장'}이 경기를 시작하기를 기다립니다.`;
  return { q, note: cfgSummary(), opts:[
    { n:1, t:'경기 시작', hide: !host || !peer, act: v => netStartGame(v) },
    { n:2, t:'방 코드 다시 듣기', act: v => note([`방 코드는 ${spaced(NET.code)}입니다.`], v) },
    { n:3, t:'초대 링크 보내기', hide: !host, s:'카카오톡이나 문자로 링크를 보내면, 받은 사람은 이름만 적고 바로 들어옵니다.', act: v => shareRoom(v) },
    { n:4, t:'채팅과 음성 대화', s: voiceLabel(), act: v => go(talkScreen, v) },
    { n:5, t:'상대 내보내기', hide: !host || !peer, act: () => openDlg('상대 내보내기', [`${peer.name}님을 방에서 내보낼까요?`], [{ label:'내보내기', act: () => netKick() }, { label:'그만두기' }]) },
    { n:9, t: host ? '방 닫기' : '방에서 나가기', act: () => leaveRoomAsk() },
  ] };
}
async function shareRoom(via){
  const url = `${location.origin}${location.pathname}?room=${NET.code}`;
  const text = `손잡다 야구 같이 해요! 방 코드 ${NET.code}`;
  try{ if(navigator.share){ await navigator.share({ title:'손잡다 야구', text, url }); return; } }catch(e){ if(e && e.name === 'AbortError') return; }
  try{ await navigator.clipboard.writeText(`${text} ${url}`); note(['초대 링크를 복사했습니다. 카카오톡이나 문자에 붙여 넣어 보내세요.'], via); }
  catch(e){ note([`이 주소를 보내 주세요: ${url}`], via); }
}
function leaveRoomAsk(){
  const host = NET.role === 'host';
  openDlg(host ? '방 닫기' : '방에서 나가기', [host ? '방을 닫으면 상대도 나가게 됩니다. 닫을까요?' : '방에서 나갈까요? 경기 중이면 경기가 멈춥니다.'], [
    { label: host ? '닫기' : '나가기', act: async () => { await netLeave(); G = null; go(homeScreen, 'click', [host ? '방을 닫았습니다.' : '방에서 나왔습니다.']); } },
    { label:'그만두기' }]);
}
// 방장: 경기 시작 (한 판 더도 같음)
function netStartGame(via){
  const c = NET.cfg, teams = [], who = [];
  teams[c.hostSide] = c.hostTeam; teams[1 - c.hostSide] = c.guestTeam;
  who[c.hostSide] = SET.name || '방장'; who[1 - c.hostSide] = NET.peer ? NET.peer.name : '손님';
  const opts = { mode:c.mode, unit:c.unit, innings:c.innings, teams, ctrl:['human', 'human'], who, diff:1, seed:(Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0 };
  startGame(opts, via);
}

/* ---------- 경기 중 ---------- */
// gameNext의 온라인 판: 방장은 상태를 보내고, 둘 다 "내 차례면 메뉴, 아니면 기다림"
function netNext(via, res, lines){
  if(NET.role === 'host' && res) netPushState(res);
  const key = G ? `${G.at}|${G.half}|${G.pa}|${G.over}|${G.pre ? G.pre.ready.join() : ''}` : '';
  // 채팅·명단 같은 화면을 보는 중에 결과가 오면, 같은 타석 안에서는 화면을 바꾸지 않고 읽어만 줌
  if(via === 'auto' && UI.S && (UI.S.sub || !UI.S.board) && NET.key === key && UI.make !== lobbyScreen){
    rerender(); if(lines.length) speak(lines.map(l => l.s || l).join(' ')); return;
  }
  NET.key = key;
  if(G.over){ GS.auto = null; go(endScreen, via, lines); return; }
  if(G.review){
    const sd = G.review.side;
    if(sd === NET.side && reviewLeft(G, sd) > 0 && !NET.sent){ go(reviewScreen, via, lines); return; }
    if(NET.role === 'host' && reviewLeft(G, sd) <= 0){ const r = resolveReview(G, false); gameNext(via, { lines:[...(res ? res.lines : []), ...r.lines], fx: r.fx }); return; }
    go(waitScreen, via, lines); return;
  }
  if(G.pre){
    if(!G.pre.ready[NET.side]){ go(() => pregameScreen(NET.side), via, lines); return; }
    go(() => ({ board:true, q:`준비를 마쳤습니다. ${NET.peer ? NET.peer.name + '님' : '상대'}이 준비하기를 기다립니다.`, opts:[
      { n:1, t:'채팅과 음성 대화', act: v => go(talkScreen, v) }, { n:6, t:'상대 팀 보기', act: v => go(() => rosterScreen(1 - NET.side), v) }] }), via, lines);
    return;
  }
  if(GS.auto && autoDone()) GS.auto = null;
  const my = NET.side, def = 1 - batIdx(G), role = my === def ? 'def' : 'off';
  const chosen = NET.role === 'host' ? !!GS.pend[role] : (NET.sent || !!(NET.pend && NET.pend[my]));
  if(chosen){ go(waitScreen, via, lines); return; }
  if(GS.auto && GS.auto.side === my){
    go(waitScreen, via, lines);
    const c = role === 'def' ? aiDefChoice(G) : aiOffChoice(G);
    setTimeout(() => { if(G && !G.over && NET.on) submit(role, c, 'auto'); }, 300);
    return;
  }
  go(role === 'def' ? defMain : offMain, via, lines);
}
function waitScreen(){
  const who = NET.peer ? NET.peer.name + '님' : '상대';
  return { board:true, q: G.review ? `${who}이 비디오 판독 신청 여부를 고르는 중입니다.` : GS.auto ? '맡겨 둔 동안 컴퓨터가 고르고 있습니다.' : `${who}이 고르는 중입니다. 결과가 나오면 읽어 드립니다.`,
    note: NET.peerOn ? [] : [`${who}의 연결이 끊겼습니다. 다시 들어오기를 기다립니다.`],
    opts:[
      { n:1, t:'채팅과 음성 대화', s: voiceLabel(), act: v => go(talkScreen, v) },
      { n:2, t:'점수판', act: v => note(scoreboard(G), v) },
      { n:3, t:'맡기기 그만', hide: !GS.auto, act: v => { GS.auto = null; gameNext(v, null); } },
      { n:9, t:'더 보기', act: v => go(moreScreen, v) },
    ] };
}
const QUICK = ['좋은 공이네요!', '잘 쳤어요!', '잠깐만요.', '천천히 하세요.', '한 판 더 할까요?', '고마워요!'];
function talkScreen(){
  const say = NET.chats.slice(-8).map(c => `${c.mine ? '나' : c.name}: ${c.t}`);
  const backTo = v => G ? gameNext(v, null) : go(lobbyScreen, v);
  return { board: !!G, sub:true, focusCmd:false, q:'채팅과 음성 대화입니다. 명령 칸에 글을 적어 입력하면 채팅을 보냅니다.', say: say.length ? say : ['아직 채팅이 없습니다.'], back: backTo,
    onText: t => { netChat(t); speak('보냈습니다.'); },
    opts:[
      ...QUICK.map((t, i) => ({ n: i + 1, t, act: () => { netChat(t); speak('보냈습니다.'); } })),
      { n:7, t:'직접 쓰기', s:'명령 칸으로 갑니다. 글을 적고 입력을 누르세요.', act: () => { const c = $('#cmd'); c.focus(); speak('명령 칸입니다. 보낼 글을 적고 입력을 누르세요.'); } },
      { n:8, t: VC.on ? '음성 대화 끄기' : '음성 대화 켜기', s: `${voiceLabel()}. ${SET.vmode === 'ptt' ? '무전기 방식' : '통화 방식'}`, act: async () => {
        if(VC.on){ voiceOff(); stay('음성 대화를 껐습니다.'); }
        else { const ok = await voiceOn(); if(ok) stay(VC.peerOn ? '음성 대화를 켰습니다. 연결 중입니다.' : '음성 대화를 켰습니다. 상대가 켜면 연결됩니다.'); }
      } },
      { n:9, t:`방식 바꾸기: 지금 ${SET.vmode === 'ptt' ? '무전기' : '통화'}`, s:'통화는 계속 켜 두고, 무전기는 말하기 단추를 누르는 동안만 보냅니다. 위쪽 단추로 말하거나 마이크를 끕니다.',
        act: () => { SET.vmode = SET.vmode === 'ptt' ? 'call' : 'ptt'; saveSet(); VC.talking = false; applyMic(); voiceUI(); stay(`${SET.vmode === 'ptt' ? '무전기' : '통화'} 방식으로 바꿨습니다.`); } },
    ] };
}

/* ---------- 받기 (net.js가 부름) ---------- */
// 방장: 손님이 들어오거나 나감
function onGuest(v){
  if(v && (!NET.peer || NET.peer.uid !== v.uid)){
    NET.peer = v; NET.peerOn = true;
    netNotice(`${v.name}님이 들어왔습니다.`);
    if(G && !G.over) netPushState(null);
    if(UI.make === lobbyScreen) rerender();
  } else if(!v && NET.peer){
    const n = NET.peer.name; NET.peer = null; NET.peerOn = false;
    if(VC.pc || VC.peerOn){ VC.peerOn = false; closePC(); voiceUI(); }
    netNotice(`${n}님이 방에서 나갔습니다.`);
    if(UI.make === lobbyScreen) rerender();
  }
}
// 방장: 손님의 선택·작전 확인
const VALID_PITCH = c => c && (c.k === 'ibb' || (c.k === 'pitch' && PITCH[c.t] && curPitcher(G).pitches.some(x => x.t === c.t)
  && [0, 1, 2].includes(c.r) && [0, 1, 2].includes(c.c) && ['in', 'edge', 'out'].includes(c.e) && [1, 2, 3].includes(c.w)));
const VALID_BAT = c => c && ['swing', 'power', 'contact', 'take', 'bunt', 'steal'].includes(c.k) && [null, 'fast', 'break'].includes(c.g ?? null) && (c.k !== 'steal' || canSteal(G));
function onAct(v){
  if(NET.role !== 'host' || !G || G.over) return;
  let a; try{ a = JSON.parse(v.c); }catch(e){ return; }
  const side = 1 - NET.side, def = 1 - batIdx(G), role = side === def ? 'def' : 'off';
  if(G.review){   // 판독이 걸려 있으면 그 판독 여부만 받음
    if(a.k === 'review' && G.review.side === side){ const r = resolveReview(G, !!a.yes); gameNext('auto', r); }
    return;
  }
  if(a.k === 'choice'){
    if(a.role !== role || GS.pend[role]) return;   // 차례가 아니거나 이미 받음
    let c = a.c;
    if(G.mode === 'manager'){
      if(!c || !(role === 'def' ? ORDER_DEF : ORDER_OFF)[c.k]) return;
      if((c.k === 'steal' || c.k === 'hitrun') && !canSteal(G)) return;
      c = { k:c.k };
    }
    else if(G.mode === 'detail'){ if(role === 'def' ? !VALID_PITCH(c) : !VALID_BAT(c)) return; c = role === 'def' ? (c.k === 'ibb' ? { k:'ibb' } : { k:'pitch', t:c.t, r:c.r, c:c.c, e:c.e, w:c.w }) : { k:c.k, g:c.g ?? null }; }
    else if(!(role === 'def' ? ['attack', 'nibble', 'ibb'] : ['power', 'normal', 'contact', 'bunt', ...(G.unit === 'pitch' ? ['take'] : [])]).includes(c)) return;
    GS.pend[role] = c;
    if(!tryResolve('auto')) netPushState(null);
    return;
  }
  // 감독 모드 경기 전 준비: 손님은 자기 팀만
  if(G.pre){
    if(G.pre.ready[side]) return;
    let r = null;
    if(a.k === 'ready'){ G.pre.ready[side] = true; if(G.pre.ready.every(Boolean)) beginGame(G); r = flush(G); }
    else if(a.k === 'lineup'){
      const T = G.teams[side], ok9 = i => Number.isInteger(i) && i >= 0 && i < 9;
      if(a.a === 'rec') r = recommendLineup(G, side);
      else if(a.a === 'swap' && ok9(a.i) && ok9(a.j) && a.i !== a.j) r = swapOrder(G, side, a.i, a.j);
      else if(a.a === 'bench' && ok9(a.slot) && T.bench[a.b]) r = useBench(G, side, a.slot, a.b, 'pre');
      else if(a.a === 'starter' && T.pit[a.idx]) r = setStarter(G, side, a.idx);
    }
    if(r) gameNext('auto', r);
    return;
  }
  if(a.k === 'ph' && role === 'off' && G.mode === 'manager' && G.pitchNo === 0 && G.teams[side].bench[a.b]){
    const r = useBench(G, side, G.teams[side].bi, a.b, 'ph'); gameNext('auto', r); return;
  }
  if(a.k === 'pr' && role === 'off' && G.mode === 'manager' && G.bases.includes(a.slot) && G.teams[side].bench[a.b]){
    const r = useBench(G, side, a.slot, a.b, 'pr'); gameNext('auto', r); return;
  }
  if(a.k === 'align' && role === 'def' && detailed(G) && [0, 1, 2].includes(a.inf) && [0, 1, 2].includes(a.of)){
    const r = setAlign(G, side, a.inf, a.of); gameNext('auto', r); return;
  }
  if(a.k === 'pitcher' && role === 'def' && detailed(G) && G.teams[side].pit[a.idx] && !G.teams[side].pit[a.idx].used){
    const r = changePitcher(G, side, a.idx); gameNext('auto', r); return;
  }
  if(a.k === 'steal' && role === 'off' && G.mode === 'simple' && canSteal(G)){
    const r = playSimple(G, null, 'steal'); gameNext('auto', r);
  }
}
// 손님: 방장이 보낸 경기 상태
function onState(st){
  if(!NET.on || NET.role !== 'guest' || !st || !st.g) return;
  if(st.gid !== NET.gid){ NET.gid = st.gid; NET.log = []; NET.stN = 0; UI.logG = null; GS.auto = null; GS.guess = null; NET.key = ''; }
  if(st.n <= NET.stN) return;
  let g, tail = [], fxs = [];
  try{ g = JSON.parse(st.g); tail = JSON.parse(st.tail || '[]'); fxs = JSON.parse(st.fx || '[]'); }catch(e){ return; }
  NET.stN = st.n; NET.sent = false; NET.pend = st.pend || {};
  const lastN = NET.log.length ? NET.log[NET.log.length - 1].n : 0;
  const fresh = tail.filter(l => l.n > lastN);
  NET.log.push(...fresh); if(NET.log.length > 1500) NET.log.splice(0, NET.log.length - 1500);
  g.log = NET.log; g.out = []; g.fx = []; g.names = [];
  g.rng = (Math.random() * 4294967296) >>> 0;   // 이 기기의 '맡기기'용 (실제 결과는 방장 기기가 계산)
  G = g;
  gameNext('auto', { lines: fresh, fx: fxs });
}
function onRoomClosed(){ if(!NET.on) return; netLeave(); G = null; go(homeScreen, 'auto', ['방장이 방을 닫았습니다.']); }
function onKicked(){ if(!NET.on) return; netLeave(); G = null; go(homeScreen, 'auto', ['방에서 나오게 되었습니다.']); }
function onCfg(){ if(UI.make === lobbyScreen) rerender(); }
function showNotice(text){ const nt = $('#note'); if(!nt) return; nt.innerHTML = `<p>${esc(text)}</p>`; nt.hidden = false; }
// inRender: 화면을 그리는 중에 부름 (채팅 화면을 다시 그리지 않음)
function renderChat(inRender){
  const sec = $('#chatSec'); if(!sec) return;
  sec.hidden = !NET.on;
  if(!NET.on) return;
  $('#chatList').innerHTML = NET.chats.slice(-8).map(c => `<li class="${c.mine ? 'me' : ''}">${esc(c.mine ? '나' : c.name)}: ${esc(c.t)}</li>`).join('') || '<li>아직 채팅이 없습니다.</li>';
  if(!inRender && UI.make === talkScreen) rerender();
}
