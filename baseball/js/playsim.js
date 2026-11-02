'use strict';
/* ===================== 친 공의 플레이 계산 (위치와 속도로 판정) =====================
   좌표는 미터: 홈 (0,0), y는 중견수 쪽, x는 1루 쪽(+). 시간은 친 순간이 0인 실제 초.
   타구(땅볼·직선타·뜬공·내야 뜬공)의 길을 계산하고, 수비수마다 반응 시간·발 빠르기로 공까지 가는 시간을 재서
   - 뜬공: 떨어지기 전에 닿으면 잡음(아슬아슬하면 다이빙), 아니면 안타
   - 땅볼: 길목에서 잡으면 1루(또는 2루→1루 병살)로 송구, 송구 도착과 타자 도착을 비교 (1루수가 나가면 투수가 커버)
   - 안타: 공을 주운 야수가 베이스로 던지고, 주자는 송구와 비교해 더 갈지 정함(가끔 잘못 판단해 횡사), 송구 실책이면 한 베이스 더
   결과(아웃·주자 이동·득점)와 함께 그림·중계에 쓸 움직임 기록(ev)을 돌려줌. 그림은 이 기록을 ANIM_SCALE배 빠르게 재생 */
const ANIM_SCALE = 1;   // 그림은 실제 시간 그대로
const BASE_XY = [[19.4, 19.4], [0, 38.8], [-19.4, 19.4], [0, 0]];   // 1루 · 2루 · 3루 · 홈
const MOUND = [0, 18.4];
const FIELD_POS = { P:[0, 18.4], C:[0, -1.5], '1B':[20, 26], '2B':[11, 41], SS:[-11, 41], '3B':[-21, 26], LF:[-29, 82], CF:[0, 94], RF:[29, 82] };
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lerp2 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const POS_INF = ['P', '1B', '2B', 'SS', '3B'], POS_OF = ['LF', 'CF', 'RF'];

// 수비수: 위치(수비 위치 앞뒤 반영), 발 빠르기(m/s), 반응 시간, 송구 속도(m/s)
function fieldersOf(G){
  const F = fieldTeam(G), P = curPitcher(G), e = (G.easy || 0);
  const inf = F.align.inf, of = F.align.of, out = {};
  Object.keys(FIELD_POS).forEach(pos => {
    const pl = pos === 'P' ? P : F.bat.find(b => b.pos === pos) || { spd:48, def:48, name:'' };
    const spd = pos === 'P' ? 45 : (pl.spd ?? 50), def = pos === 'P' ? 50 : (pl.def ?? 50);
    let [x, y] = FIELD_POS[pos];
    if(POS_INF.includes(pos) && pos !== 'P'){ y += [-4, 0, 3.5][inf]; }
    if(POS_OF.includes(pos)){ const k = [-11, 0, 8][of]; const r = Math.hypot(x, y); x *= (r + k) / r; y *= (r + k) / r; }
    out[pos] = { pos, at:[x, y], v: 6.6 + (spd - 50) / 50 * 0.9 - [0, 0.55, 0.9][e], react: 0.38 - (def - 50) / 320, arm: 29 + (def - 50) / 9, def, name: pl.name || '' };
  });
  return out;
}
// 공까지 가는 시간: 땅볼은 옆으로 몸을 날리는 범위라 느리게, 뜬공은 외야수가 전력으로 달림
const reachT = (f, p, mode) => f.react + dist2(f.at, p) / (mode === 'gb' ? f.v * 0.83 : mode === 'air' && POS_OF.includes(f.pos) ? f.v + 1.7 : f.v);
const runV = spd => 7.2 + ((spd ?? 50) - 50) / 50 * 1.0;          // 타석에서 1루까지
const runV2 = spd => 7.7 + ((spd ?? 50) - 50) / 50 * 1.0;         // 가속이 붙은 베이스 사이 (리드·2차 리드 포함)

/* 타구 만들기: o = { type, fi, ev, q, d(뜬공 비거리, 이미 계산), dir }. 각도(라디안, +는 1루 쪽) */
function battedBall(G, o){
  const base = [-0.5, 0, 0.5][o.fi ?? 1], ang = clamp(base + gauss(G) * 0.17, -0.74, 0.74);
  const b = { type: o.type, ang, ev: o.ev, q: o.q };
  if(o.type === 'gb'){ b.v = 21 + o.ev * 21 + o.q * 5; b.dec = parkOf(G).turf ? 5.6 : 7; }
  else if(o.type === 'pu'){ b.d = 14 + rnd(G) * 28; b.hang = 4.3 + rnd(G) * 1.2; }
  else if(o.type === 'ld'){ b.d = 30 + o.ev * 52 + o.q * 8; b.hang = 0.25 + b.d / 36; }
  else { b.d = o.d; b.hang = 2.1 + b.d / 46; }
  return b;
}
const polar = (ang, m) => [Math.sin(ang) * m, Math.cos(ang) * m];

/* 플레이 계산. 돌려주는 것: { kind, outs, bat(타자 결과 베이스 0=아웃 1~4), runners:[{from, to}], scored:[주자 순번], err, ev:[…], result, text… } */
function simPlay0(G, bb, opt = {}){
  const F = fieldersOf(G), T = batTeam(G), Bt = curBatter(G), bases = G.bases;
  const ev = [], fmove = {}, call = [];
  const mv = (pos, path) => { fmove[pos] = path; };
  const res = { bb, ev, fmove, call, outs:0, bat:0, runners:[], err:null, pos:null };
  const vB = runV(Bt.spd) + [0, 0.25, 0.45][G.easy || 0], tB1 = 0.62 + 27.4 / vB - (Bt.hand === 'L' ? 0.08 : 0) - (bb.bunt ? 0.25 : 0);   // 번트는 대면서 바로 뛰어 나감
  const hr = G.hrun ? 1.0 : 0;
  // 주자들: 베이스별 출발 (리드 3미터, 히트 앤드 런이면 먼저 뜀)
  const runners = [0, 1, 2].filter(i => bases[i] != null).map(i => ({ i, id: bases[i], v: runV2(T.bat[bases[i]].spd) + [0, 0.25, 0.45][G.easy || 0], lead: 0.1 - (i === 0 ? hr : 0) }));

  // ---------- 땅볼 ----------
  // 번트: 투수·포수·1루수·3루수가 달려 나와 잡음. 번트가 예상되면(주자 있고 2아웃 전, 전진 수비) 1·3루수가 미리 앞으로
  if(bb.bunt){
    const expect = (bases.some(x => x != null) && G.outs < 2) || fieldTeam(G).align.inf === 0;
    F.C.react += 0.45;   // 포수는 앉은 자세에서 일어나 마스크를 벗고 나옴
    ['1B', '3B'].forEach(pos => { if(expect){ F[pos].at = [F[pos].at[0] * 0.92, F[pos].at[1] - 6]; F[pos].react -= 0.12; } });
  }
  const gbPool = bb.bunt ? ['P', 'C', '1B', '3B', '2B'] : POS_INF, gbMode = bb.bunt ? 'run' : 'gb';
  if(bb.type === 'gb'){
    const tStop = bb.v / bb.dec, ballAt = t => { const tt = Math.min(t, tStop); return polar(bb.ang, bb.v * tt - bb.dec * tt * tt / 2); };
    let best = null;
    for(let t = 0.15; t <= tStop + 0.01; t += 0.04){
      const p = ballAt(t); if(Math.hypot(...p) > 47) break;
      for(const pos of gbPool){ const f = F[pos]; if(reachT(f, p, gbMode) <= t){ if(!best || t < best.t) best = { pos, t, p, slack: t - reachT(f, p, gbMode) }; } }
      if(best) break;
    }
    ev.push({ k:'ball', t0:0, t1: best ? best.t : Math.min(tStop, 3.2), from:[0, 0], to: best ? best.p : ballAt(Math.min(tStop, 3.2)), h:0 });
    if(!best){
      // 내야를 빠져나감: 외야수가 길목에서 주움 → 안타 처리
      const pick = retrieve(G, F, ballAt, tStop, bb);
      return hitPlay(G, F, res, pick, 1, runners, vB, tB1);
    }
    const f = F[best.pos]; res.pos = best.pos;
    mv(best.pos, [[0, f.at], [best.t, best.p]]);
    ev.push({ k:'field', t: best.t, pos: best.pos });
    // 포구 실책 (아슬아슬하게 닿으면 더 어려움)
    const pErr = (0.006 + (60 - f.def) / 4000) * (best.slack < 0.12 ? 2 : 1);
    if(rnd(G) < pErr){ res.err = { pos: best.pos, kind:'field' }; ev.push({ k:'bobble', t: best.t }); return errorAdvance(res, runners, tB1, best.t + 1.2); }
    const tf = best.t, P0 = best.p;
    return gbThrows(G, F, res, best, runners, tB1);
  }

  // ---------- 뜬공·직선타·내야 뜬공 ----------
  const L = polar(bb.ang, bb.d), hang = bb.hang;
  // 직선타는 내야수 앞을 지나갈 때 잡을 수도 있음
  let catcher = null;
  if(bb.type === 'ld'){
    // 직선타는 내야수 키를 넘기 전(가까운 거리)에서만 잡을 수 있음
    const reachR = Math.min(bb.d, 24 + (1 - bb.q) * 14);
    for(let r = 8; r < reachR; r += 1.5){
      const t = hang * r / bb.d, p = polar(bb.ang, r);
      for(const pos of POS_INF){ if(reachT(F[pos], p, 'air') <= t){ catcher = { pos, t, p, margin: t - reachT(F[pos], p, 'air') + 0.2 }; break; } }
      if(catcher) break;
    }
  }
  if(!catcher){
    const pool = bb.type === 'pu' ? [...POS_INF, 'C'] : bb.d > 50 ? POS_OF : [...POS_OF, ...POS_INF];
    let m = null;
    pool.forEach(pos => { const t = reachT(F[pos], L, 'air'); if(!m || t < m.t) m = { pos, t }; });
    catcher = { pos: m.pos, t: hang, p: L, margin: hang - m.t };
  }
  const fence = parkOf(G).fence[bb.fi ?? 1] || 110;
  // 담장을 넘으면 홈런 (비거리 판정은 엔진이 이미 함: opt.hr)
  if(opt.hr){
    const f = F[catcher.pos];
    ev.push({ k:'ball', t0:0, t1: hang, from:[0, 0], to: L, h: 20 + bb.d / 5 });
    mv(catcher.pos, [[0, f.at], [Math.min(hang, reachT(f, polar(bb.ang, fence - 3))), polar(bb.ang, fence - 3)]]);
    res.kind = 'hr'; res.bat = 4; res.result = hang * 0.8;
    runners.forEach(r => res.runners.push({ from: r.i, to: 3 }));
    return res;
  }
  const f = F[catcher.pos]; res.pos = catcher.pos;
  const apex = bb.type === 'pu' ? 30 : bb.type === 'ld' ? 4 : 18 + bb.d / 6;
  const glove = 0.72 + f.def / 400 - [0, 0.1, 0.16][G.easy || 0];
  const pCatch = catcher.margin >= 0.25 ? 0.995 : clamp((catcher.margin + 0.38) / 0.63, 0, 1) * glove;
  const caught = !opt.wall && rnd(G) < pCatch;
  const dive = catcher.margin < 0.12;
  if(caught){
    ev.push({ k:'ball', t0:0, t1: catcher.t, from:[0, 0], to: catcher.p, h: bb.type === 'ld' ? apex * catcher.t / hang : apex });
    mv(catcher.pos, [[0, f.at], [Math.max(f.react, catcher.t - 0.05), catcher.p]]);
    if(dive) ev.push({ k:'dive', t: catcher.t - 0.25, pos: catcher.pos });
    ev.push({ k:'catch', t: catcher.t, pos: catcher.pos, dive, far: bb.d >= fence - 12 });
    call.push({ t: catcher.t, out:true, catch:true });
    res.outs = 1; res.bat = 0; res.kind = bb.type === 'pu' ? 'pu' : bb.type === 'ld' ? 'lo' : 'fo'; res.dive = dive;
    res.result = catcher.t;
    tagUps(G, F, res, runners, catcher, bb);
    return res;
  }
  // 떨어짐(또는 다이빙했지만 놓침): 굴러간 뒤 주움
  ev.push({ k:'ball', t0:0, t1: hang, from:[0, 0], to: L, h: apex });
  if(dive) ev.push({ k:'dive', t: hang - 0.25, pos: catcher.pos, miss:true });
  ev.push({ k:'land', t: hang });
  // 직선타·뜬공은 땅에 떨어진 뒤 굴러감 (담장 앞에서 멈춤)
  // 떨어진 공은 굴러가고(외야 사이를 가르면 더 멀리), 야수가 따라가 주움. 담장까지 가면 튕겨 나오는 공을 잡느라 더 걸림
  const gapRoll = catcher.margin < -0.8 ? 1.3 : 1;
  const roll = (bb.type === 'pu' ? 2 : bb.type === 'ld' ? 6 + bb.ev * 12 : 5 + bb.ev * 10) * gapRoll, end = Math.min(bb.d + roll, fence - 1.5);
  const P1 = polar(bb.ang, end), tRoll = hang + (end - bb.d) / 7, wall = end >= fence - 2;
  const tPick = Math.max(reachT(f, P1, 'air'), tRoll) + 0.45 + (wall ? 0.7 : 0);
  ev.push({ k:'ball', t0: hang, t1: tRoll, from: L, to: P1, h: 0 });
  mv(catcher.pos, [[0, f.at], [tPick - 0.35, P1]]);
  const out = hitPlay(G, F, res, { pos: catcher.pos, t: tPick, p: P1, wall, air: hang }, 1, runners, vB, tB1);
  // 넉넉히 잡을 수 있던 공을 놓치면 실책 (안타가 아님)
  if(!opt.wall && catcher.margin >= 0.25 && !out.err){ out.err = { pos: catcher.pos, kind:'drop' }; out.kind = 'err'; }
  return out;
}

/* 플레이 계산 + 그림용 움직임 정리: 수비수는 반응한 뒤 전력으로 달려가 기다리고, 공을 안 쫓는 수비수도 베이스 커버·뒤 받치기로 움직임.
   주자마다 출발·도착 시각을 채움 (그림이 이 시각대로 그림) */
function simPlay(G, bb, opt = {}){
  const res = simPlay0(G, bb, opt), F = fieldersOf(G);
  const sprint = (f, mode) => mode === 'gb' ? f.v * 0.83 : POS_OF.includes(f.pos) ? f.v + 1.7 : f.v;
  const mode = bb.type === 'gb' ? 'gb' : 'air';
  const fm = res.fmove;
  // 1) 공을 쫓는 수비수: 반응 시간 뒤 바로 전력으로, 일찍 닿으면 그 자리에서 기다림
  Object.keys(fm).forEach(pos => {
    const f = F[pos], path = fm[pos], out = [[0, path[0][1]]];
    let t = 0, at = path[0][1];
    for(let i = 1; i < path.length; i++){
      const [t1, p1] = path[i], d = dist2(at, p1);
      if(d < 0.3){ out.push([t1, p1]); t = t1; continue; }
      const start = i === 1 ? Math.min(f.react, t1) : t, arrive = Math.min(t1, start + d / sprint(f, i === 1 ? mode : 'run'));
      if(start > t + 0.01) out.push([start, at]);
      out.push([arrive, p1]); if(t1 > arrive + 0.01) out.push([t1, p1]);
      t = t1; at = p1;
    }
    fm[pos] = out;
  });
  // 2) 송구를 받는 베이스에 아무도 없으면 커버하는 수비수를 보냄
  const busyAt = (pos, tt) => fm[pos] && fm[pos][fm[pos].length - 1][0] > tt - 0.3;
  const coverFor = b => ({ 0:['1B', 'P', '2B'], 1:['SS', '2B'], 2:['3B', 'SS'], 3:['C', 'P'] })[b];
  const reachAt = (pos, b, tt) => { const pth = fm[pos]; return pth && dist2(pth[pth.length - 1][1], BASE_XY[b]) < 2.5; };
  res.ev.filter(e => e.k === 'ball' && e.t0 > 0.05).forEach(e => {
    const b = BASE_XY.findIndex(q => dist2(q, e.to) < 0.5); if(b < 0) return;
    if(Object.keys(fm).some(pos => reachAt(pos, b))) return;
    const thrower = Object.keys(fm).find(q => { const pth = fm[q], last = pth[pth.length - 1]; return dist2(last[1], e.from) < 2.5 && last[0] <= e.t0 + 0.6; });
    const pos = coverFor(b).find(q => q !== thrower && (!fm[q] || !busyAt(q, e.t1))) || coverFor(b).find(q => q !== thrower), f = F[pos];
    if(!f) return;
    const from = fm[pos] ? fm[pos][fm[pos].length - 1] : [0, f.at];
    const d = dist2(from[1], BASE_XY[b]), start = Math.max(from[0], f.react), arrive = Math.min(e.t1, start + d / f.v);
    fm[pos] = (fm[pos] || [[0, f.at]]).concat([[start, from[1]], [Math.max(arrive, start + 0.05), BASE_XY[b]]]);
  });
  // 3) 나머지 수비수: 내야수는 자기 베이스로, 외야수는 공 쪽으로 뒤 받치기, 투수는 1루 쪽이면 커버
  const land = (res.ev.find(e => e.k === 'ball') || {}).to || [0, 30];
  const duty = { '1B':BASE_XY[0], '2B': land[0] < 0 ? BASE_XY[1] : null, SS: land[0] >= 0 ? BASE_XY[1] : null, '3B':BASE_XY[2], C:null, P: land[0] > 8 && Math.hypot(...land) < 40 ? BASE_XY[0] : null };
  Object.keys(F).forEach(pos => {
    if(fm[pos]) return;
    const f = F[pos];
    let goal = duty[pos];
    if(POS_OF.includes(pos)){ const k = 0.45; goal = [f.at[0] + (land[0] - f.at[0]) * k, f.at[1] + (land[1] - f.at[1]) * k]; }
    if(pos === 'SS' || pos === '2B'){ if(!goal && Math.hypot(...land) > 45) goal = lerp2(f.at, land, 0.25); }
    if(!goal || dist2(goal, f.at) < 1) return;
    const d = dist2(goal, f.at), start = f.react + 0.1;
    fm[pos] = [[0, f.at], [start, f.at], [start + d / (f.v * 0.9), goal]];
  });
  // 4) 주자 출발·도착 시각
  const T = batTeam(G);
  res.runners.forEach(x => {
    const id = G.bases[x.from]; if(id == null) return;
    const v = runV2(T.bat[id].spd) + [0, 0.25, 0.45][G.easy || 0];
    if(x.to == null){ x.t = x.tOut; if(x.t0 == null) x.t0 = Math.max(0, x.tOut - (x.back ? 0.6 : (x.at - x.from) * 27.4 / v)); }
    else if(x.to > x.from){ if(!x.t) x.t = (x.to - x.from) * 27.4 / v; if(x.t0 == null) x.t0 = Math.max(0, x.t - (x.to - x.from) * 27.4 / v); }
    else { x.t0 = 0; x.t = 0; }
    x.v = v;
  });
  return res;
}

// 땅볼을 잡은 뒤: 주자마다 갈지 정하고, 야수는 잡을 수 있는 가장 앞 주자(2아웃이면 가장 확실한 아웃)로 던짐.
// 앞 주자를 잡으면 1루로 이어 던져 병살을 노림. 1루수가 잡으면 직접 밟거나 베이스 커버를 들어온 투수에게 토스
function gbThrows(G, F, res, best, runners, tB1){
  const ev = res.ev, call = res.call, f = F[best.pos], tf = best.t, P0 = best.p, outs0 = G.outs;
  const occ = new Set(runners.map(r => r.i));
  const forced = r => r.i === 0 || (r.i === 1 && occ.has(0)) || (r.i === 2 && occ.has(0) && occ.has(1));
  const arr = (r, b) => r.lead + (b - r.i) * 27.4 / r.v - 4 / r.v;
  // 잡고 던지기까지(깊은 타구일수록 김). 포스 아웃은 조금 서두름
  const tr = 0.62 + Math.min(0.5, Math.hypot(...P0) / 90) + (60 - f.def) / 500 + rnd(G) * 0.35;
  const coverOf = b => b === 0 ? (best.pos === '1B' ? 'P' : '1B') : b === 1 ? (['SS', '3B', 'P'].includes(best.pos) ? '2B' : 'SS') : b === 2 ? (best.pos === '3B' ? 'SS' : '3B') : 'C';
  // 베이스 b에 공이 닿는 시각 (가까우면 직접 들고 감)
  const ballTo = b => {
    const bp = BASE_XY[b], d = dist2(P0, bp);
    if(b === 0 && best.pos === '1B'){
      const self = tf + d / f.v, pc = reachT(F.P, bp) + 0.15, toss = Math.max(tf + 0.3 + d / 16, pc);
      return self <= toss ? { t: self, self: true, cover: '1B' } : { t: toss, t0: tf + 0.3, cover: 'P', h: 1.5 };
    }
    if(d < 6 || coverOf(b) === best.pos) return { t: tf + d / f.v, self: true, cover: best.pos };
    const cv = coverOf(b), prep = b === 0 ? tr : Math.max(0.42, tr - 0.2);
    return { t: Math.max(tf + prep + d / f.arm, reachT(F[cv], bp) + 0.05), t0: tf + prep, cover: cv, h: 2 };
  };
  // 주자 판단: 밀려 가는 주자는 무조건, 아니면 2아웃이거나 송구보다 넉넉히 먼저 닿을 것 같을 때 (판단에는 오차)
  const plan = runners.slice().sort((a, b) => b.i - a.i).map(r => ({ r, goal: r.i, force: forced(r) }));
  let blocked = 4;
  plan.forEach(x => {
    const r = x.r, nb = r.i + 1;
    if(x.force) x.goal = nb;
    else if(nb < blocked){
      const go = outs0 === 2 || (ballTo(nb).t - arr(r, nb) + gauss(G) * 0.25 > 0.15) || (nb === 2 && P0[0] > 4);
      if(go) x.goal = nb;
    }
    if(x.goal === r.i) blocked = r.i;
  });
  // 던질 곳: 후보(주자들이 가는 베이스 + 1루)
  const cands = plan.filter(x => x.goal > x.r.i).map(x => ({ base: x.goal, who: x.r.i, arrive: arr(x.r, x.goal), force: x.force }));
  cands.push({ base:0, who:-1, arrive: tB1, force:true });
  cands.forEach(c => { c.ball = ballTo(c.base); c.m = c.arrive - c.ball.t; c.read = c.m + gauss(G) * 0.12; });
  let tgt;
  if(outs0 === 2) tgt = cands.reduce((a, b) => b.read > a.read ? b : a);
  else tgt = cands.filter(c => c.base > 0).sort((a, b) => b.base - a.base).find(c => c.read > (c.force ? 0.12 : 0.25)) || cands.find(c => c.base === 0);
  // 송구 실책 (직접 들고 가면 없음)
  if(!tgt.ball.self && rnd(G) < 0.009 + (60 - f.def) / 3500){ res.err = { pos: best.pos, kind:'throw' }; return errorAdvance(res, runners, tB1, tgt.ball.t + 0.8); }
  const outOf = new Map();   // 주자 순번(-1 타자) → 아웃된 베이스·시각
  const close = [];
  const throwEv = (from, to, b, t0, h) => ev.push({ k:'ball', t0, t1: b, from, to, h });
  // 송구를 받는 사람은 그 베이스로 달려감(투수의 1루 커버 포함), 직접 들고 가면 그 야수가 베이스로
  const goCover = (pos, b, tb) => { const cf = F[pos]; if(!cf || res.fmove[pos] && pos !== best.pos) return; if(pos === best.pos) return; res.fmove[pos] = [[0, cf.at], [Math.min(tb, reachT(cf, BASE_XY[b])), BASE_XY[b]]]; };
  const doThrow = c => {
    if(c.ball.self && c.ball.cover === best.pos) res.fmove[best.pos] = [[0, f.at], [tf, P0], [c.ball.t, BASE_XY[c.base]]];
    else if(c.ball.cover) goCover(c.ball.cover, c.base, c.ball.t);
    if(c.ball.self){ if(c.ball.cover === best.pos) ev.push({ k:'carry', t0: tf, t1: c.ball.t, from: P0, to: BASE_XY[c.base] }); else throwEv(P0, BASE_XY[c.base], c.ball.t, c.ball.t0 ?? tf, 1); }
    else throwEv(P0, BASE_XY[c.base], c.ball.t, c.ball.t0, c.ball.h || 2);
    const out = c.ball.t < c.arrive;
    close.push({ base: c.base, who: c.who, m: c.arrive - c.ball.t, force: c.force });
    call.push({ t: out ? c.ball.t : c.arrive, base: c.base, out });
    if(out) outOf.set(c.who, { base: c.base, t: c.ball.t });
    return out;
  };
  const firstOut = doThrow(tgt);
  // 병살: 앞 주자를 포스 아웃으로 잡았으면 1루로 이어 던짐 (홈·3루·2루에서)
  let relay = false;
  if(firstOut && tgt.base > 0 && tgt.force && outs0 + 1 < 3){
    const coverer = tgt.ball.cover, cf = F[coverer] || f, c1 = best.pos === '1B' ? F.P : F['1B'];
    const t0 = tgt.ball.t + (tgt.base === 1 ? 0.55 : 0.7), d = dist2(BASE_XY[tgt.base], BASE_XY[0]);
    const tb = Math.max(t0 + d / cf.arm, reachT(c1, BASE_XY[0]) + 0.1);
    relay = true;
    goCover(best.pos === '1B' ? 'P' : '1B', 0, tb);
    throwEv(BASE_XY[tgt.base], BASE_XY[0], tb, t0, 2);
    const out = tb < tB1;
    close.push({ base:0, who:-1, m: tB1 - tb, force:true });
    call.push({ t: out ? tb : tB1, base:0, out });
    if(out) outOf.set(-1, { base:0, t: tb });
  }
  // 결과
  res.outs = outOf.size;
  res.bat = outOf.has(-1) ? 0 : 1;
  plan.forEach(x => {
    const o = outOf.get(x.r.i);
    if(o) res.runners.push({ from: x.r.i, to:null, at: o.base, tOut: o.t, force: x.force });
    else res.runners.push({ from: x.r.i, to: x.goal, t: x.goal > x.r.i ? arr(x.r, x.goal) : 0 });
  });
  res.tgt = tgt.base; res.cover = tgt.ball.cover;
  res.kind = res.bat === 0 ? (res.outs >= 2 ? 'dp' : 'go') : res.outs ? 'fc' : tgt.base === 0 ? 'ifh' : 'fc';
  res.result = Math.max(...call.map(c => c.t), tf + 0.3);
  res.runT = tB1;
  const cl = close.filter(c => Math.abs(c.m) <= 0.07).sort((a, b) => Math.abs(a.m) - Math.abs(b.m))[0];
  if(cl) res.close = cl;
  return res;
}
// 땅볼이 빠져나갔을 때 외야수가 줍는 곳과 시간
function retrieve(G, F, ballAt, tStop, bb){
  let best = null;
  for(let t = 0.3; t < tStop + 3; t += 0.05){
    const p = ballAt(t);
    for(const pos of POS_OF){ if(reachT(F[pos], p) <= t){ best = { pos, t: t + 0.35, p }; break; } }
    if(best) break;
  }
  if(!best){ const p = ballAt(tStop); const pos = POS_OF.reduce((a, b) => reachT(F[a], p) < reachT(F[b], p) ? a : b); best = { pos, t: Math.max(tStop, reachT(F[pos], p)) + 0.35, p }; }
  return best;
}
/* 안타: 주운 야수가 송구하고, 주자들은 송구와 비교해 몇 베이스 갈지 정함 */
function hitPlay(G, F, res, pick, minBase, runners, vB, tB1){
  const f = F[pick.pos], Pp = pick.p, tp = pick.t, ev = res.ev;
  res.pos = pick.pos; res.kind = 'hit'; res.wall = pick.wall;
  ev.push({ k:'pickup', t: tp, pos: pick.pos });
  // 송구: 멀리서는 원바운드·중계 플레이로 늦어짐
  const throwT = base => { const dd = dist2(Pp, BASE_XY[base]); return tp + 0.55 + dd / f.arm * (dd > 55 ? 1.22 : 1); };
  // 주자별 베이스 도착 시각 (b는 0=1루 … 3=홈)
  const all = [...runners.map(r => ({ ...r })).sort((a, b) => b.i - a.i), { i:-1, bat:true, v: vB, lead:0 }];
  const vB2 = runV2(curBatter(G).spd) + [0, 0.25, 0.45][G.easy || 0];
  // 뜬공·직선타가 떨어진 안타: 2아웃 전이면 주자는 잡힐지 몰라 중간쯤(약 11미터)에서 기다렸다가 떨어지는 순간 뜀
  const wait = pick.air != null && G.outs < 2;
  const arr = (r, b) => r.bat ? (b === 0 ? tB1 : tB1 + b * 27.4 / vB2) : Math.max(r.lead + (b - r.i) * 27.4 / r.v - 4 / r.v, wait ? pick.air + 0.2 + ((b - r.i) * 27.4 - 11) / r.v : 0);
  let target = null, ahead = 4, last = 0;
  all.forEach((r, idx) => {
    const from = r.bat ? -1 : r.i;
    let to = Math.max(from + 1, r.bat ? minBase - 1 : from + 1);
    // 더 갈지: 이 베이스까지의 도착과 송구 도착을 비교 (주루 판단에는 오차가 있음)
    // 앞 주자를 앞지를 수 없음 (홈은 여럿이 들어올 수 있음)
    while(to < 3){
      const nb = to + 1;
      if(nb !== 3 && nb >= ahead) break;
      const mine = arr(r, nb), thr = target == null ? throwT(nb) : throwT(nb) + 0.9;
      const guess = thr - mine + gauss(G) * 0.32 - (r.bat ? 0.02 : 0.38);
      if(guess > 0) to = nb; else break;
    }
    if(to >= ahead && to < 3) to = ahead - 1;
    const t = arr(r, to);
    // 송구는 앞 주자가 노리는 베이스로 (첫 번째로 한 베이스 넘게 가려는 주자)
    let out = false;
    if(target == null && to > from + 1 && to < 4){
      target = to;
      const tt = throwT(to);
      ev.push({ k:'ball', t0: tp + 0.5, t1: tt, from: Pp, to: BASE_XY[to], h: 3 });
      if(rnd(G) < 0.012 + (60 - f.def) / 4000){ res.err = { pos: pick.pos, kind:'throw' }; ev.push({ k:'error', t: tt }); to = Math.min(3, to + 1); }
      else if(tt < t){ out = true; res.call.push({ t: tt, base: to, out:true }); res.outs++; }
      else res.call.push({ t, base: to, out:false });
      if(!res.err && Math.abs(t - tt) <= 0.07) res.close = { base: to, who: r.bat ? -1 : r.i, m: t - tt, force:false };
    }
    if(r.bat){ res.bat = out ? 0 : to + 1; res.batTried = to + 1; res.runT = t; if(out) res.batOut = { base: to, t: throwT(to) }; }
    else res.runners.push(out ? { from: r.i, to:null, at: to, tOut: throwT(to) } : { from: r.i, to, t, t0: wait ? pick.air - 11 / r.v + 0.2 : 0 });
    if(!out) ahead = to;
    last = Math.max(last, t);
  });
  if(target == null){ const tt = throwT(Math.min(3, Math.max(1, res.bat))); ev.push({ k:'ball', t0: tp + 0.5, t1: tt, from: Pp, to: BASE_XY[Math.min(3, Math.max(1, res.bat))], h: 3 }); }
  res.result = Math.max(tp, last, ...res.call.map(c => c.t));
  return res;
}
// 실책: 타자는 1루(송구 실책이면 2루까지), 주자는 한 베이스씩
function errorAdvance(res, runners, tB1, tEnd){
  res.kind = 'err';
  const extra = res.err.kind === 'throw' ? 1 : 0;
  res.bat = 1 + extra;
  runners.forEach(r => { const to = Math.min(3, r.i + 1 + extra); res.runners.push({ from: r.i, to, t: r.lead + (to - r.i) * 27.4 / r.v }); });
  res.call.push({ t: tB1, base:0, out:false });
  res.result = Math.max(tB1, tEnd); res.runT = tB1;
  return res;
}
// 뜬공 아웃 뒤 태그업 (3루 주자 홈, 깊으면 2루 주자 3루). 히트 앤드 런 직선타면 돌아가지 못해 아웃
function tagUps(G, F, res, runners, c, bb){
  const f = F[c.pos];
  runners.slice().sort((a, b) => b.i - a.i).forEach(r => {
    let to = r.i;
    if(bb.type === 'ld' && G.hrun && r.i === 0 && G.outs + res.outs < 3){
      const back = c.t + 0.4 + dist2(c.p, BASE_XY[0]) / f.arm;
      if(back < c.t + 1.5){ res.outs++; res.runners.push({ from: r.i, to:null, at: r.i, tOut: back, back:true }); res.call.push({ t: back, base:0, out:true }); res.ev.push({ k:'ball', t0: c.t + 0.4, t1: back, from: c.p, to: BASE_XY[0], h: 2 }); res.result = Math.max(res.result, back); res.kind = 'ldp'; return; }
    }
    if(G.outs + res.outs < 3 && bb.type === 'fb' && (r.i === 2 || (r.i === 1 && bb.d >= 85))){
      const nb = r.i + 1, mine = c.t + 0.15 + 27.4 / (r.v + 0.3), dd = dist2(c.p, BASE_XY[nb]), thr = c.t + 0.6 + dd / f.arm * (dd > 55 ? 1.22 : 1);
      if(thr - mine + gauss(G) * 0.3 > 0.1){
        to = nb;
        res.ev.push({ k:'ball', t0: c.t + 0.45, t1: thr, from: c.p, to: BASE_XY[nb], h: 3 });
        if(thr < mine){ res.outs++; res.runners.push({ from: r.i, to:null, at: nb, tOut: thr, t0: c.t + 0.15 }); res.call.push({ t: thr, base: nb, out:true }); res.result = Math.max(res.result, thr); return; }
        res.call.push({ t: mine, base: nb, out:false }); res.result = Math.max(res.result, mine); r.tagT = mine;
        if(Math.abs(mine - thr) <= 0.07) res.close = { base: nb, who: r.i, m: mine - thr, force:false };
        if(nb === 3) res.sac = true;
      }
    }
    res.runners.push({ from: r.i, to, t: r.tagT || 0, t0: to > r.i ? c.t + 0.15 : 0, tag:true });
  });
}

/* ---------- 도루·견제 (리드 거리와 시간) ----------
   주자의 리드는 발이 빠를수록 크고, 견제를 받을수록 작아짐. 도루: 투수가 움직이기 시작해 공이 포수 미트에 닿는 시간 + 포수 송구 시간 + 태그
   ↔ 주자의 출발 반응 + 남은 거리 ÷ 속도. 견제: 투수가 돌아서 던지는 시간 ↔ 주자가 몸을 날려 돌아가는 시간 */
function runnerLead(G, i, spd){
  const held = (G.held || {})[i] || 0;
  return [3.4, 5.0, 4.0][i] + ((spd ?? 50) - 50) / 50 * 0.7 - Math.min(1.2, held * 0.45);
}
function stealSim(G, from, o = {}){
  const T = batTeam(G), F = fieldTeam(G), P = curPitcher(G), R = T.bat[G.bases[from]];
  const spd = o.simple ? 55 : R.spd, C = F.bat.find(x => x.pos === 'C') || { def:50 }, cdef = o.simple ? 50 : C.def;
  const lead = runnerLead(G, from, spd) - (o.dbl ? 0.3 : 0);
  const v = runV2(spd) - 0.5 + [0, 0.2, 0.35][G.easy || 0];
  const jump = 0.26 + gauss(G) * 0.1 - (o.breaking ? 0.04 : 0);
  const tR = jump + (27.4 - lead) / v;
  const vel = o.vel || 145, loc = o.loc || { x:0, y:0 };
  const toPlate = (from === 2 ? 1.0 : 0.88) + (P.hand === 'L' && from === 0 ? -0.05 : 0) + 18.4 * 0.93 / (vel / 3.6);   // 투수 동작 + 공이 날아가는 시간
  const hard = Math.abs(loc.x) > 1.2 || loc.y < -1.1 ? 0.12 : 0;   // 받기 어려운 공(원바운드·크게 빠짐)
  let tB, catcherThrow = 0;
  if(from === 2){ tB = toPlate + 0.15 + Math.abs(gauss(G)) * 0.05; }   // 홈스틸: 공을 받아 바로 태그
  else {
    catcherThrow = (from === 0 ? 1.98 : 1.68) - (cdef - 50) / 250 + gauss(G) * 0.07 + hard;
    tB = toPlate + catcherThrow + 0.08 + Math.abs(gauss(G)) * 0.06;
  }
  // 홈스틸은 투수가 주자를 못 보고 와인드업을 크게 할 때만 가능성이 있음
  if(from === 2 && rnd(G) < 0.25 + (spd - 55) / 200) tB += 1.1 + rnd(G) * 0.9;
  const err = from !== 2 && rnd(G) < 0.012 + (60 - cdef) / 3000;   // 송구가 빠짐
  return { tR, tB, m: tR - tB, safe: err || tR <= tB, err, lead, spd };
}
function pickoffSim(G, base){
  const T = batTeam(G), P = curPitcher(G), R = T.bat[G.bases[base]];
  const lead = runnerLead(G, base, R.spd);
  const lean = 0.2 * (lead / 3.4);   // 리드가 클수록 2루 쪽으로 기울어 있다가 늦게 반응하기 쉬움
  const react = 0.22 + Math.abs(gauss(G)) * 0.05 - Math.log(1 - rnd(G) * 0.999) * lean;
  const tR = react + Math.max(0, lead - 1.2) / (6.2 + (R.spd - 50) / 100);
  const move = (base === 0 ? 0.62 : 0.85) - (P.ctl - 50) / 600 - (P.hand === 'L' && base === 0 ? 0.08 : 0) + gauss(G) * 0.05;
  const tB = move + 19.6 / 30 + 0.08 + Math.abs(gauss(G)) * 0.06;
  return { tR, tB, m: tR - tB, out: tR > tB, err: rnd(G) < 0.02, lead };
}
