'use strict';
/* ===================== 컴퓨터 판단 =====================
   컴퓨터 팀의 투구·타격·작전, 그리고 사람이 '맡기기'를 골랐을 때의 선택을 정함.
   팀 스타일(STYLES)과 볼카운트, 선수 성향에 따라 달라짐 */

const closeGame = G => Math.abs(runsOf(G.teams[0]) - runsOf(G.teams[1])) <= 2;
const lateGame = G => G.inning >= G.innings - 1;

/* ---------- 정밀 모드: 투구 ---------- */
function aiPitch(G){
  const P = curPitcher(G), B = curBatter(G), F = fieldTeam(G), S = STYLES[F.style];
  const b = G.balls, s = G.strikes, cpuSide = G.ctrl[1 - batIdx(G)] === 'cpu';
  // 고의 볼넷: 1루가 비고 득점권에 주자, 경기 후반 접전, 강타자
  if(b === 0 && s === 0 && G.bases[0] == null && (G.bases[1] != null || G.bases[2] != null) && G.outs < 2 && lateGame(G) && closeGame(G) && B.pow >= 75 && rnd(G) < 0.5) return { k:'ibb' };
  // 접근: 존 안쪽 · 구석 · 빼기
  let wIn = 0.22, wEdge = 0.58, wOut = 0.20;
  if(b === 3 || b - s >= 2){ wIn = 0.5; wEdge = 0.45; wOut = 0.05; }
  else if(s === 2 && b <= 1){ wIn = 0.08; wEdge = 0.42; wOut = 0.50; }
  else if(s === 2){ wIn = 0.15; wEdge = 0.55; wOut = 0.30; }
  wEdge += S.nibble; wIn = Math.max(0.03, wIn - S.nibble / 2);
  if(cpuSide && G.diff === 0){ wIn += 0.15; wOut = Math.max(0.02, wOut - 0.08); }
  const e = wpick(G, [['in', wIn], ['edge', wEdge], ['out', wOut]]);
  // 구종: 직구가 기본, 2스트라이크면 변화구를 더 씀. 같은 공을 세 번 잇달아 던지지 않음
  const fbW = b >= 2 && s < 2 ? 0.65 : s === 2 ? 0.35 : 0.5;
  const last2 = G.prevTypes || [];
  const items = P.pitches.map(x => {
    let w = x.t === 'FB' ? fbW : (1 - fbW) * (x.g / P.pitches.filter(y => y.t !== 'FB').reduce((a, y) => a + y.g, 0));
    if(last2.length >= 2 && last2[0] === x.t && last2[1] === x.t) w *= 0.3;
    return [x.t, w];
  });
  const t = wpick(G, items);
  // 코스: 낮게·바깥쪽을 많이. 떨어지는 공으로 빼면 낮게
  let r = wpick(G, [[0, 0.2], [1, 0.3], [2, 0.5]]), c = wpick(G, [[0, 0.35], [1, 0.2], [2, 0.45]]);
  if(e === 'out' && ['FK', 'CU', 'CH', 'SI'].includes(t)) r = 2;
  if(r === 1 && c === 1 && e !== 'in') c = rnd(G) < 0.5 ? 0 : 2;
  // 세기
  const f = fatigue(P);
  const w = s === 2 && rnd(G) < 0.35 ? 1 : f > 0.5 && rnd(G) < 0.3 ? 3 : wpick(G, [[2, 0.75], [1, 0.15], [3, 0.10]]);
  G.prevTypes = [t, ...(G.prevTypes || [])].slice(0, 2);
  return { k:'pitch', t, r, c, e, w };
}

/* ---------- 정밀 모드: 타격 ---------- */
function aiBat(G){
  const B = curBatter(G), T = batTeam(G), S = STYLES[T.style], b = G.balls, s = G.strikes, bs = G.bases;
  // 도루
  if(canSteal(G) && b < 3 && s < 2){
    const r = bs[1] != null && bs[2] == null ? bs[1] : bs[0];
    const R = T.bat[r];
    if(R && R.spd >= 66 && rnd(G) < 0.09 * S.steal * (R.spd - 58) / 20) return { k:'steal', g:null };
  }
  // 희생 번트: 무사, 1·2루 주자, 3루 빔, 힘이 약한 타자, 접전
  if(s < 2 && G.outs === 0 && (bs[0] != null || bs[1] != null) && bs[2] == null && B.pow < 55 && closeGame(G) && rnd(G) < 0.10 * S.bunt) return { k:'bunt', g:null };
  // 기습 번트: 아주 빠른 타자
  if(s < 2 && !bs.some(x => x != null) && B.spd >= 80 && rnd(G) < 0.04 * S.bunt) return { k:'bunt', g:null };
  if(b === 3 && s === 0) return rnd(G) < 0.85 ? { k:'take', g:null } : { k:'swing', g:'fast' };
  let pSwing = 0.66 + (B.aggr - 50) / 150;
  if(s === 2) pSwing = 0.96;
  if(b === 0 && s === 0) pSwing -= 0.12;
  if(rnd(G) >= pSwing) return { k:'take', g:null };
  let k = 'swing';
  if(s === 2) k = rnd(G) < 0.55 ? 'contact' : 'swing';
  else if(b >= 2 && s <= 1) k = rnd(G) < 0.3 + (T.style === 'power' ? 0.15 : 0) ? 'power' : 'swing';
  else if(B.pow >= 70 && rnd(G) < 0.25) k = 'power';
  const g = b > s ? (rnd(G) < 0.5 ? 'fast' : null) : (rnd(G) < 0.15 ? 'break' : null);
  return { k, g };
}

/* ---------- 간단 모드 ---------- */
function aiSimpleOff(G){
  const bs = G.bases;
  if(bs[0] != null && bs[1] == null && rnd(G) < 0.08) return 'steal';
  if(G.outs === 0 && (bs[0] != null || bs[1] != null) && bs[2] == null && lateGame(G) && closeGame(G) && rnd(G) < 0.2) return 'bunt';
  return wpick(G, [['power', 0.3], ['normal', 0.45], ['contact', 0.25]]);
}
function aiSimpleDef(G){
  const bs = G.bases;
  if(bs[0] == null && (bs[1] != null || bs[2] != null) && G.outs < 2 && lateGame(G) && closeGame(G) && rnd(G) < 0.12) return 'ibb';
  return rnd(G) < 0.4 ? 'nibble' : 'attack';
}

/* ---------- 감독 판단 (컴퓨터 수비 팀, 타석이 시작될 때) ---------- */
function aiManage(G){
  if(G.mode !== 'detail') return;
  const ti = 1 - batIdx(G), T = G.teams[ti], P = curPitcher(G), B = curBatter(G);
  const f = fatigue(P), bench = benchPitchers(G, ti);
  const shelled = P.st.r >= (P.starter ? 5 : 3);
  if(bench.length && (f > 0.55 || shelled)){
    // 남은 투수 가운데 가장 좋은 투수
    const best = bench.sort((a, b) => (b.p.ctl + b.p.stf) - (a.p.ctl + a.p.stf))[0];
    swapPitcher(G, ti, best.i);
  }
  let inf = 1, of = 1;
  if(G.bases[2] != null && G.outs < 2 && lateGame(G) && closeGame(G)) inf = 0;
  else if(G.bases[0] != null && G.outs < 2 && rnd(G) < 0.5) inf = 2;
  if(B.pow >= 72) of = 2; else if(B.pow <= 38) of = 0;
  if(inf !== T.align.inf || of !== T.align.of){ T.align = { inf, of }; emit(G, `${T.short} 수비 위치 변경: 내야 ${ALIGN_IN[inf]}, 외야 ${ALIGN_OUT[of]}.`, 'c'); }
}
