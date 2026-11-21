'use strict';
/* ===================== 명장면 다시 보기 =====================
   지금 하는 경기(game.js의 G)에서 공 하나·플레이 하나가 끝날 때마다(engine.js flush가 hlFlush를 부름) 큰 장면을 골라 8개까지 모음:
   홈런, 점수가 난 장타(2루타·3루타), 주자를 두고 이닝을 끝낸 삼진, 끝내기.
   장면마다 그 공의 움직임(G.anim 사본: 타구·수비·주자 기록)과, 그림에 필요한 만큼만 줄인 경기 상태(던지기 전·뒤)를 둠.
   이 기기 메모리에만 두고 저장하지 않음(이어 하기·리그 저장에 들어가지 않음).
   경기가 끝나면 '명장면 다시 보기': 화면 보며 하기는 그림으로 하나씩 다시 보여 주고(gfx.js의 투구 움직임 그대로), 소리와 글로 하기는 글로 읽어 줌 */
const HL = { at:null, list:[], last:null, pre:null, i:0, cur:null, tm:0, A:null, endAt:0, seq:0 };
const HL_MAX = 8;
// 그림에 쓰는 만큼만 줄인 경기 상태 (gfx.js drawPitchScene·drawFieldScene·fieldersOf와 점수판이 읽는 값)
function hlMini(X){
  const slimB = b => ({ id:b.id, name:b.name, hand:b.hand, pos:b.pos, spd:b.spd, def:b.def, trait:b.trait, look:b.look, st:{ ...(b.st || {}) } });
  const slimT = T => { const P = T.pit[T.pi] || T.pit[0]; return { key:T.key, name:T.name, short:T.short, color:T.color, R:[...T.R], H:T.H, E:T.E, bi:T.bi, pi:0, align:T.align ? { ...T.align } : { inf:1, of:1 }, rev:T.rev,
    bat:T.bat.map(slimB), gone:[], pit:[P ? { id:P.id, name:P.name, hand:P.hand, form:P.form, n:P.n, load:P.load, sta:P.sta, vel:P.vel, st:{ ...(P.st || {}) } } : { id:0, name:'', hand:'R', n:0, load:0, sta:1, st:{} }] }; };
  return { at:X.at, teams:X.teams.map(slimT), bases:[...X.bases], inning:X.inning, top:X.top, outs:X.outs, balls:X.balls, strikes:X.strikes, over:X.over, winner:X.winner,
    innings:X.innings, park:X.park, night:X.night, easy:X.easy, wind:X.wind, mode:X.mode, wx: X.wx ? { ...X.wx } : null, pitchNo:X.pitchNo, pa:X.pa, half:X.half, seq:X.seq, pre:null };
}
const hlOn = () => typeof VIEW !== 'undefined';   // 브라우저에서만 (Node 시험에는 이 파일을 넣지 않음)
// engine.js flush가 부름: r = { lines, fx, events }
function hlFlush(X, r){
  if(!hlOn() || typeof G === 'undefined' || X !== G || !X.teams) return;
  if(HL.at !== X.at){ HL.at = X.at; HL.list = []; HL.last = null; HL.pre = null; HL.cur = null; }
  const evs = r.events || [], an = X.anim ? X.anim.n : 0, pitched = evs.some(e => e.k === 'pitch');
  if(pitched && an && (!HL.pre || HL.pre.n !== an)) HL.pre = { n: an, snap: HL.last };   // 이 공을 던지기 전 상태
  try{ hlCheck(X, r, pitched); } catch(e){ /* 명장면은 꾸밈: 무엇이 잘못되어도 경기를 멈추지 않음 */ }
  HL.last = hlMini(X);
}
function hlCheck(X, r, pitched){
  const evs = r.events || [], pa = k => evs.some(e => e.k === 'pa' && e.r === k);
  const runs = evs.filter(e => e.k === 'score').reduce((s, e) => s + (e.n || 0), 0);
  const end = evs.find(e => e.k === 'game' && e.e === 'end'), wo = !!(end && end.walkoff);
  const pre = HL.pre && X.anim && HL.pre.n === X.anim.n ? HL.pre.snap : null;
  const hr = runs > 0 && pa('hr'), xbh = runs > 0 && (pa('b2') || pa('b3'));
  const kEnd = pa('k') && evs.some(e => e.k === 'inning') && pre && pre.bases.some(b => b != null);
  if(!hr && !xbh && !kEnd && !wo) return;
  const P = pre || X, inn = `${P.inning}회${P.top ? '초' : '말'}`;
  const name = ((r.lines || []).filter(l => l.k === 'r' && l.b).pop() || {}).b;
  let bt = P.top ? 0 : 1, B = null;
  if(name) X.teams.forEach((T, i) => { const f = [...T.bat, ...(T.gone || [])].find(b => b.name === name); if(f && !B){ B = f; bt = i; } });
  const T = X.teams[bt], F = X.teams[1 - bt];
  const Pp = pre ? pre.teams[1 - bt].pit[0] : F.pit[F.pi];
  const what = pa('hr') ? '홈런' : pa('b3') ? '3루타' : pa('b2') ? '2루타' : pa('b1') ? '안타' : pa('bb') ? '밀어내기 볼넷' : pa('hbp') ? '몸에 맞는 공' : '';
  let kind, cap, sc, who;
  if(wo){ kind = 'wo'; sc = 100 + runs; cap = `${T.short} ${B ? B.name : ''}, 끝내기${what ? ' ' + (hr && runs >= 4 ? '만루 홈런' : what) : ''}`.replace(/ ,/, ','); who = B; }
  else if(hr){ kind = 'hr'; sc = 60 + runs * 8; cap = `${T.short} ${B ? B.name : ''}, ${runs >= 4 ? '만루 홈런' : runs === 1 ? '솔로 홈런' : `${runs}점 홈런`}`; who = B; }
  else if(xbh){ kind = 'xbh'; sc = 30 + runs * 6; cap = `${T.short} ${B ? B.name : ''}, ${runs}타점 ${what}`; who = B; }
  else { const on = pre.bases.filter(b => b != null).length; kind = 'k'; sc = 20 + on * 5 + (on === 3 ? 10 : 0); cap = `${F.short} 투수 ${Pp ? Pp.name : ''}, ${on === 3 ? '만루' : `주자 ${on}명`} 위기에서 삼진으로 이닝 끝`; who = null; }
  const bn = typeof bannerOf === 'function' ? bannerOf(evs) : null;
  const item = { seq: ++HL.seq, kind, sc, inn, cap: `${inn} · ${cap}`, txt: (r.lines || []).filter(l => l.k === 'r' || (l.k === 'i' && /홈런|끝내기|경기 끝/.test(l.s))).map(l => l.s).slice(0, 6),
    anim: pitched && X.anim ? JSON.parse(JSON.stringify(X.anim)) : null, pre, post: hlMini(X), bn,
    cut: (kind === 'hr' || kind === 'wo') && typeof cutinInfo === 'function' ? cutinInfo(X, evs, r.lines) : null,
    face: who ? { name: who.name, id: who.id, look: who.look } : Pp ? { name: Pp.name, id: Pp.id } : null, team: (who ? T : F).key, color: (who ? T : F).color };
  if(HL.list.length >= HL_MAX){
    const min = HL.list.reduce((m, h) => h.sc < m.sc ? h : m, HL.list[0]);
    if(min.sc >= sc) return;
    HL.list.splice(HL.list.indexOf(min), 1);
  }
  HL.list.push(item);
}
const hlHas = () => typeof G !== 'undefined' && !!G && HL.at === G.at && HL.list.length > 0;
const hlLines = () => HL.list.flatMap((h, i) => [`명장면 ${i + 1}. ${h.cap}.`, ...h.txt]);

/* ---------- 다시 보기 화면 ---------- */
function hlStart(v){ HL.i = 0; hlGo(v); }
function hlGo(v){
  clearInterval(HL.tm); HL.tm = 0;
  HL.cur = HL.list[clamp(HL.i, 0, HL.list.length - 1)] || null; HL.A = null;   // 처음 그릴 때부터 그 장면의 점수판 (경기 끝 카드 없이)
  go(hlScreen, v);
  if(VIEW.gfx) setTimeout(hlPlay, 30);
}
function hlScreen(){
  const n = HL.list.length, back = v => { hlStop(); go(endScreen, v); };
  if(!VIEW.gfx || !n) return { board:true, sub:true, kind:'log', q: n ? `명장면 ${n}개입니다. 위 글을 한 줄씩 읽어 보세요.` : '명장면이 없습니다.', say: n ? hlLines() : ['기록해 둔 명장면이 없습니다.'], back,
    opts:[{ n:1, t:'돌아가기', act: back }] };
  const i = clamp(HL.i, 0, n - 1), h = HL.list[i], last = i === n - 1;
  return { board:true, kind:'hl', hl: h, hlN: n, hlI: i, q:`명장면 ${i + 1} / ${n}. ${h.cap}.`, say: h.txt.slice(-2).map(s => ({ s, k:'r' })), back, opts:[
    { n:1, t: last ? '처음부터 다시 보기' : '다음 장면', act: v => { HL.i = last ? 0 : i + 1; hlGo(v); } },
    { n:2, t:'이 장면 다시 보기', act: v => hlGo(v) },
    { n:3, t:'그만 보기', act: back },
  ] };
}
function hlStop(){ clearInterval(HL.tm); HL.tm = 0; HL.cur = null; HL.A = null; if(typeof GX !== 'undefined' && GX.anim && GX.anim.hl){ GX.anim = null; GX.queue = []; } }
// 그 장면의 공 하나를 처음부터 다시 그림 (gfx.js gfxStart가 만드는 투구 움직임과 같은 모양)
function hlPlay(){
  if(typeof GX === 'undefined' || UI.make !== hlScreen) return;
  const h = HL.list[HL.i]; if(!h) return;
  HL.cur = h; HL.endAt = 0;
  const now = performance.now(), bn = h.bn || [h.kind === 'wo' ? '끝내기!' : '홈런!', PAL.ink, h.kind === 'hr'];
  let A;
  if(h.anim){
    A = { ...JSON.parse(JSON.stringify(h.anim)), kind:'pitch', ph:'windup', t0:0, jit:0, banner: bn[0], bannerColor: bn[1], hr: bn[2], view: h.post, pre: h.pre || h.post, start: now, hl:1 };
    A.tl = playTL(A, []);
  } else A = { kind:'banner', ph:'result', t0:1, banner: bn[0], bannerColor: bn[1], hr: bn[2], view: h.post, pre: h.post, start: now, hl:1 };
  GX.anim = A; GX.queue = []; HL.A = A;
  if(typeof skinHudRefresh === 'function') skinHudRefresh();
  if(!GX.raf && GX.cv) GX.raf = requestAnimationFrame(gfxTick);
  clearInterval(HL.tm);
  HL.tm = setInterval(() => {
    if(UI.make !== hlScreen || HL.cur !== h){ clearInterval(HL.tm); HL.tm = 0; return; }
    if(GX.anim === A) return;
    if(!HL.endAt){
      HL.endAt = performance.now();
      if(typeof skinHudRefresh === 'function') skinHudRefresh();
      if(h.cut && typeof cutinShow === 'function') cutinShow(h.cut, null);
      return;
    }
    // 끝난 뒤 잠깐 두었다가 다음 장면으로 (마지막 장면이면 멈춤)
    if(performance.now() - HL.endAt > (h.cut ? 2100 : 1200)){
      clearInterval(HL.tm); HL.tm = 0;
      if(HL.i < HL.list.length - 1){ HL.i++; hlGo('auto'); }
    }
  }, 150);
}
// skin.js가 부름: 다시 보는 동안 점수판은 그 장면의 상태로 (움직이는 동안은 던지기 전, 끝나면 뒤)
function hlView(S){
  if(!S || S.kind !== 'hl' || !HL.cur) return null;
  return typeof GX !== 'undefined' && HL.A && GX.anim === HL.A ? (HL.cur.pre || HL.cur.post) : HL.cur.post;
}
// 화면 보며 하기 아래쪽: 장면 설명 + 단추 (skin-hub.js endDeckHTML이 부름)
function hlDeckHTML(S){
  const h = S.hl, face = h && h.face && typeof playerFace === 'function' ? playerFace(h.face, h.team, 'mid') : '';
  const ico = t => /다음/.test(t) ? 'go' : /다시/.test(t) ? 'again' : 'back';
  const dots = Array.from({ length: S.hlN }, (_, i) => `<i class="${i === S.hlI ? 'on' : ''}"></i>`).join('');
  return `<div class="hl-cap" style="--tc:${esc(h.color || '#3b82f6')}">${face}<span class="hl-tx"><small>명장면 ${S.hlI + 1} / ${S.hlN}</small><b>${esc(h.cap)}</b><span class="hl-dots">${dots}</span></span></div>
    <div class="hb c3 end">${(S.opts || []).filter(o => !o.hide && o.key !== 'status').map(o => `<button type="button" class="hb-b${o.n === 1 ? ' pri' : ''}" data-sk="opt" data-n="${o.n}">${hubIco(ico(o.t))}<b>${esc(o.t)}</b></button>`).join('')}</div>`;
}
