/* 묶음 녹음 하나를 문장마다 자름.
   쉬는 길이만으로 자르면 한 줄 안의 두 문장 사이에서도 잘려서 조각 수가 맞지 않음.
   그래서 (1) 소리가 작은 곳을 모두 자를 후보로 찾고 (2) 줄마다 글자 수로 예상 길이를 정한 뒤
   (3) "조각 길이가 예상과 비슷하고, 자르는 곳이 길게 쉰 곳일수록 좋다"는 점수가 가장 좋은 조합을 고름(동적 계획법).
   브라우저와 node 시험에서 함께 씀 */
const Cut = (() => {
  const HOP = 0.01;
  function energy(x, sr){
    const h = Math.round(sr * HOP), n = Math.floor(x.length / h), e = new Float32Array(n);
    for(let k = 0; k < n; k++){ let s = 0; for(let i = k * h; i < (k + 1) * h; i++) s += x[i] * x[i]; e[k] = Math.sqrt(s / h); }
    return e;
  }
  const chars = t => Math.max(1, t.replace(/[\s.,!?…·~'"()\-]/g, '').length);
  function split(x, sr, texts){
    const e = energy(x, sr), n = e.length;
    const sorted = Array.from(e).sort((a, b) => a - b);
    const th = Math.max(0.004, sorted[Math.floor(n * 0.2)] * 4);
    let first = 0, last = n - 1;
    while(first < n && e[first] <= th) first++;
    while(last > 0 && e[last] <= th) last--;
    if(first >= last) return { ok:false, why:'소리가 없습니다', segs:[] };
    // 자를 후보: 0.08초 넘게 소리가 작은 곳
    const gaps = [];
    for(let k = first; k <= last; k++){
      if(e[k] > th) continue;
      let j = k; while(j <= last && e[j] <= th) j++;
      if(j - k >= 8) gaps.push({ s:k * HOP, e:j * HOP, len:(j - k) * HOP });
      k = j;
    }
    const N = texts.length, T0 = first * HOP, T1 = (last + 1) * HOP;
    if(N === 1) return finish([[T0, T1]], [], texts, T0, T1, x.length / sr, gaps, []);
    if(gaps.length < N - 1) return { ok:false, why:`쉬는 곳이 ${gaps.length}개뿐이라 ${N}줄로 나눌 수 없습니다`, segs:[] };
    // 예상 길이: 글자 수 + 줄마다 조금 더(짧은 말도 시간이 걸림)
    const w = texts.map(t => chars(t) + 2), W = w.reduce((a, b) => a + b, 0);
    const M = gaps.length, span = T1 - T0;
    const expect = k => span * w[k] / W;
    const segCost = (k, d) => { if(d <= 0.05) return 1e9; const r = Math.log(d / expect(k)); return 6 * r * r; };
    const gapGain = g => 1.2 * Math.log(g.len / 0.08);
    // dp[j][i]: j번째 줄 뒤를 i번째 후보에서 자를 때까지의 가장 작은 비용
    const INF = 1e18, dp = [], from = [];
    for(let j = 0; j < N - 1; j++){
      dp.push(new Float64Array(M).fill(INF)); from.push(new Int32Array(M).fill(-1));
      for(let i = 0; i < M; i++){
        if(j === 0){ dp[0][i] = segCost(0, gaps[i].s - T0) - gapGain(gaps[i]); continue; }
        for(let p = 0; p < i; p++){
          if(dp[j - 1][p] >= INF) continue;
          const c = dp[j - 1][p] + segCost(j, gaps[i].s - gaps[p].e) - gapGain(gaps[i]);
          if(c < dp[j][i]){ dp[j][i] = c; from[j][i] = p; }
        }
      }
    }
    let best = -1, bc = INF;
    for(let i = 0; i < M; i++){ if(dp[N - 2][i] >= INF) continue; const c = dp[N - 2][i] + segCost(N - 1, T1 - gaps[i].e); if(c < bc){ bc = c; best = i; } }
    if(best < 0) return { ok:false, why:'나눌 방법을 찾지 못했습니다', segs:[] };
    const pick = []; for(let j = N - 2, i = best; j >= 0; i = from[j][i], j--) pick.unshift(i);
    const cut = pick.map(i => gaps[i]), bounds = [];
    for(let k = 0; k < N; k++) bounds.push([k ? cut[k - 1].e : T0, k < N - 1 ? cut[k].s : T1]);
    return finish(bounds, cut, texts, T0, T1, x.length / sr, gaps, pick);
  }
  // 앞뒤 여유를 붙이고, 예상과 많이 다른 조각을 표시함
  function finish(bounds, cut, texts, T0, T1, dur, gaps, pick){
    const w = texts.map(t => chars(t) + 2), W = w.reduce((a, b) => a + b, 0), span = T1 - T0;
    const segs = bounds.map(([s, e], k) => {
      const before = k ? cut[k - 1] : { s:0, e:T0, len:T0 }, after = k < cut.length ? cut[k] : { s:T1, e:dur, len:dur - T1 };
      const ss = Math.max(before.s + Math.min(0.03, before.len / 2), s - 0.06);
      const ee = Math.min(after.e - Math.min(0.04, after.len / 2), e + Math.min(0.3, after.len / 2));
      const r = (e - s) / (span * w[k] / W);
      return { s:ss, e:ee, ratio:r, warn: r > 2 || r < 0.45 };
    });
    // 전체 길이가 글에 비해 너무 길면(대본에 없는 말을 덧붙였을 수 있음) 알림
    const total = texts.reduce((a, t) => a + chars(t), 0), perChar = span / total;
    const why = perChar > 0.45 ? `글에 비해 녹음이 깁니다(글자당 ${perChar.toFixed(2)}초). 대본에 없는 말을 덧붙였는지 들어 보세요.` : '';
    return { ok:true, segs, why, gaps, cut: pick, T0, T1, dur, warnCount: segs.filter(x => x.warn).length };
  }
  // 경계를 사람이 옮길 때: k번째와 k+1번째 줄 사이 경계를 다음(+1)/이전(-1) 쉬는 곳으로. 양옆 줄이 비지 않는 범위에서만
  function moveBoundary(res, k, dir){
    const g = res.gaps, c = res.cut; if(!c || c[k] == null) return false;
    const to = c[k] + dir, lo = k ? c[k - 1] : -1, hi = k + 1 < c.length ? c[k + 1] : g.length;
    if(to <= lo || to >= hi) return false;
    c[k] = to;
    const seg = (j) => {
      const before = j ? g[c[j - 1]] : { s:0, e:res.T0, len:res.T0 }, after = j < c.length ? g[c[j]] : { s:res.T1, e:res.dur, len:res.dur - res.T1 };
      return { s: Math.max(before.s + Math.min(0.03, before.len / 2), before.e - 0.06), e: Math.min(after.e - Math.min(0.04, after.len / 2), after.s + Math.min(0.3, after.len / 2)) };
    };
    for(const j of [k, k + 1]){ const x = seg(j); res.segs[j].s = x.s; res.segs[j].e = x.e; res.segs[j].warn = false; }
    return true;
  }
  return { split, moveBoundary, energy };
})();
if(typeof module !== 'undefined') module.exports = Cut;
