// 컴퓨터끼리 여러 경기를 돌려 수치와 규칙 위반을 확인함. 사용법: node baseball/tests/sim.js [경기 수] [--save-baseline]
// 끝에 '상황별 균형 표'(주자 5가지 × 스윙 3가지 × 난이도 2가지)를 만들어 기준 범위와 baseline.json(저장해 둔 수치)에 견줌.
// 균형을 일부러 바꾼 단계에서는 --save-baseline으로 새 수치를 저장함.
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'js');
['data.js', 'engine.js', 'playsim.js', 'ai.js'].forEach(f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }));

const N = +process.argv.slice(2).find(a => /^\d+$/.test(a)) || 300;
const SAVE = process.argv.includes('--save-baseline');
const crypto = require('crypto'), TXT = crypto.createHash('sha1');   // 모든 경기 문장의 해시: 글이 한 글자라도 달라지면 baseline.json과 달라짐
function run(mode, unit, easy){
  const parks = {};
  const tot = { g:0, runs:0, pa:0, ab:0, h:0, hr:0, k:0, bb:0, sb:0, e:0, pitches:0, xbh:0, extra:0, draws:0, lines:0, walkoff:0 };
  for(let n = 0; n < N; n++){
    const keys = TEAMS.map(t => t.key), K = keys.length, a = n % K, h = (a + 1 + (n >> 4) % (K - 1)) % K;
    const G = newGame({ mode, innings:9, teams:[keys[a], keys[h]], ctrl:['cpu', 'cpu'], unit, easy, seed: 1000 + n });
    flush(G);
    let guard = 0, evRuns = 0, evHalves = 0;
    while(!G.over){
      if(++guard > 5000) throw new Error('끝나지 않는 경기 ' + n);
      const res = G.review ? resolveReview(G, aiChallenge(G)) : playStep(G, aiDefChoice(G), aiOffChoice(G));
      // 사건 목록 확인: 모든 사건에 종류가 있고, 득점 사건·이닝 기록이 실제 점수와 맞아야 함
      (res.events || []).forEach(e => { if(!e || !e.k) throw new Error('종류 없는 사건 ' + JSON.stringify(e)); if(e.k === 'score') evRuns += e.n; if(e.k === 'inning') evHalves++; });
      // 규칙 확인
      const on = G.bases.filter(x => x != null);
      if(new Set(on).size !== on.length) throw new Error('같은 주자가 두 베이스에: ' + JSON.stringify(G.bases) + ' 경기 ' + n);
      if(on.includes(batTeam(G).bi) && !G.over && G.balls + G.strikes === 0 && G.pitchNo === 0) throw new Error('타자가 이미 베이스에 있음 ' + n);
      if(G.outs > 3 || G.balls > 3 || G.strikes > 2) { if(!G.over) throw new Error('카운트 이상 ' + JSON.stringify([G.outs, G.balls, G.strikes])); }
      G.log.forEach(l => { if(/undefined|NaN|null/.test(l.s)) throw new Error('문장 이상: ' + l.s); });
    }
    G.log.forEach(l => TXT.update(l.k + l.s + '\n'));
    const totRuns = G.teams.reduce((n, T) => n + runsOf(T), 0), logRuns = (G.inningLog || []).reduce((n, h) => n + h.runs, 0);
    if(evRuns !== totRuns) throw new Error(`득점 사건 ${evRuns}점 ≠ 실제 ${totRuns}점 (경기 ${n})`);
    if(logRuns !== totRuns) throw new Error(`이닝 기록 득점 ${logRuns}점 ≠ 실제 ${totRuns}점 (경기 ${n})`);
    if(evHalves !== G.inningLog.length) throw new Error(`이닝 사건 ${evHalves}개 ≠ 이닝 기록 ${G.inningLog.length}개 (경기 ${n})`);
    const logHits = G.inningLog.reduce((x, h) => x + h.hits, 0), teamHits = G.teams.reduce((x, T) => x + T.H, 0);
    if(logHits !== teamHits) throw new Error(`이닝 기록 안타 ${logHits}개 ≠ 팀 안타 ${teamHits}개 (경기 ${n})`);
    tot.g++;
    const pk = parks[G.park.key] ||= { g:0, runs:0, hr:0 };
    pk.g++; G.teams.forEach(T => { pk.runs += runsOf(T); pk.hr += T.bat.concat(T.gone).reduce((s, b) => s + b.st.hr, 0); });
    tot.rev = (tot.rev || 0) + G.log.filter(l => /비디오 판독을 신청/.test(l.s)).length;
    tot.over = (tot.over || 0) + G.log.filter(l => /원심이 뒤집힙니다/.test(l.s)).length;
    tot.close = (tot.close || 0) + G.log.filter(l => /원심은/.test(l.s)).length;
    tot.lines += G.log.length;
    if(G.winner === -1) tot.draws++;
    if(G.walkoff) tot.walkoff++;
    if(G.inning > 9) tot.extra++;
    G.teams.forEach(T => {
      tot.runs += runsOf(T); tot.e += T.E;
      T.bat.forEach(B => { tot.pa += B.st.pa; tot.ab += B.st.ab; tot.h += B.st.h; tot.hr += B.st.hr; tot.k += B.st.k; tot.bb += B.st.bb; tot.sb += B.st.sb; });
      T.pit.forEach(P => { tot.pitches += P.n; });
    });
  }
  const per = v => (v / tot.g / 2).toFixed(2);
  console.log(`[${mode}${unit ? ' ' + unit : ''}${easy ? ' 난이도' + easy : ''}] ${tot.g}경기 · 팀당 경기당 득점 ${per(tot.runs)} · 안타 ${per(tot.h)} · 홈런 ${per(tot.hr)} · 삼진 ${per(tot.k)} · 볼넷 ${per(tot.bb)} · 도루 ${per(tot.sb)} · 실책 ${per(tot.e)}`);
  console.log(`   판독: 아슬아슬 ${(tot.close / tot.g).toFixed(2)} · 신청 ${(tot.rev / tot.g).toFixed(2)} · 번복 ${(tot.over / tot.g).toFixed(2)} (경기당)
   구장별 경기당 득점·홈런: ${Object.entries(parks).map(([k, v]) => `${PARKS[k].name} ${(v.runs / v.g).toFixed(1)}·${(v.hr / v.g).toFixed(1)}`).join(', ')}
   타율 ${(tot.h / tot.ab).toFixed(3)} · 삼진율 ${(tot.k / tot.pa * 100).toFixed(1)}% · 볼넷률 ${(tot.bb / tot.pa * 100).toFixed(1)}% · 타석당 투구 ${(tot.pitches / tot.pa).toFixed(2)} · 연장 ${tot.extra} · 무승부 ${tot.draws} · 끝내기 ${tot.walkoff} · 경기당 문장 ${(tot.lines / tot.g).toFixed(0)}`);
}
run('detail');
run('simple');
run('simple', 'pitch');
run('manager');
// 타격 난이도 보통(1)·쉬움(2)
run('detail', null, 1); run('detail', null, 2); run('simple', 'pitch', 1); run('simple', null, 1);


/* ---------- 상황별 균형 표 ----------
   정밀 모드에서 1아웃에 주자 상황과 스윙(강하게·보통·맞히기)을 고정하고, 타석마다 같은 상황으로 되돌려 타석 수를 모음.
   (투수 체력은 타석마다 되돌림. 휘두를지 말지는 컴퓨터 타자가, 휘두를 때의 세기만 고정) */
const SITS = [['주자 없음', [null, null, null]], ['1루', [0, null, null]], ['2루', [null, 0, null]], ['3루', [null, null, 0]], ['만루', [0, 1, 2]]];
const SWINGS = [['강하게', 'power'], ['보통', 'swing'], ['맞히기', 'contact']];
const CELL_PA = N * 15;
function cell(sit, swing, easy, ci){
  const c = { pa:0, ab:0, h:0, xbh:0, hr:0, k:0, bb:0, runs:0, sit: sit[0], swing: swing[0], easy };
  let G = null, left = 0;
  while(c.pa < CELL_PA){
    if(left-- <= 0 || G.over){
      const keys = TEAMS.map(t => t.key), K = keys.length, n = ci * 1000 + (c.pa >> 5);
      if(G){ G.teams.forEach(T => T.bat.concat(T.gone).forEach(B => { c.ab += B.st.ab; c.h += B.st.h; c.hr += B.st.hr; c.k += B.st.k; c.bb += B.st.bb; c.xbh += (B.st.b2 || 0) + (B.st.b3 || 0) + B.st.hr; })); }
      const a = n % K, h = (a + 1 + (n >> 3) % (K - 1)) % K;
      G = newGame({ mode:'detail', innings:99, teams:[keys[a], keys[h]], ctrl:['cpu', 'cpu'], easy, seed: 77000 + n }); flush(G); left = 32;
    }
    // 이번 타석의 상황으로 되돌림
    G.outs = 1; G.bases = sit[1].map(x => x == null ? null : (batTeam(G).bi + 1 + x) % 9); G.balls = 0; G.strikes = 0;
    G.teams.forEach(T => T.pit.forEach(P => { P.n = 0; P.load = 0; }));
    const pa = G.pa, half = G.half, r0 = runsOf(G.teams[0]) + runsOf(G.teams[1]);
    let guard = 0;
    while(G.pa === pa && G.half === half && !G.over){
      if(++guard > 60) throw new Error('타석이 끝나지 않음 ' + sit[0] + ' ' + swing[0]);
      if(G.review){ resolveReview(G, false); continue; }
      let o = aiOffChoice(G);
      if(o.k === 'steal' || o.k === 'bunt' || o.k === 'hitrun') o = { k:'swing', g:null };
      else if(o.k !== 'take') o = { ...o, k: swing[1] };
      playStep(G, aiDefChoice(G), o);
    }
    c.pa++;
    c.runs += runsOf(G.teams[0]) + runsOf(G.teams[1]) - r0;
  }
  G.teams.forEach(T => T.bat.concat(T.gone).forEach(B => { c.ab += B.st.ab; c.h += B.st.h; c.hr += B.st.hr; c.k += B.st.k; c.bb += B.st.bb; c.xbh += (B.st.b2 || 0) + (B.st.b3 || 0) + B.st.hr; }));
  const r = v => Math.round(v * 1000) / 1000;
  return { pa:c.pa, avg: r(c.h / c.ab), xbhRate: r(c.xbh / c.h), kRate: r(c.k / c.pa), bbRate: r(c.bb / c.pa), hrRate: r(c.hr / c.pa), runsPerPA: r(c.runs / c.pa) };
}
const table = {};
let ci = 0;
[1, 0].forEach(easy => SITS.forEach(sit => SWINGS.forEach(sw => { table[`난이도${easy}|${sit[0]}|${sw[0]}`] = cell(sit, sw, easy, ci++); })));
console.log(`\n[상황별 균형 표] 칸마다 ${CELL_PA}타석 (정밀 모드, 1아웃)`);
[1, 0].forEach(easy => {
  console.log(`  난이도 ${easy === 1 ? '보통(1)' : '현실(0)'}        타율 / 장타 비율 / 삼진율 / 타석당 득점`);
  SITS.forEach(sit => console.log('   ' + sit[0].padEnd(6) + SWINGS.map(sw => { const t = table[`난이도${easy}|${sit[0]}|${sw[0]}`]; return `${sw[0]} ${t.avg.toFixed(3)} ${(t.xbhRate * 100).toFixed(0)}% ${(t.kRate * 100).toFixed(0)}% ${t.runsPerPA.toFixed(2)}`; }).join(' · ')));
});
// 기준 범위: 지금 구조가 크게 어긋나지 않았는지 보는 넓은 범위 (균형을 맞추는 단계에서 좁혀 감)
const errs = [];
Object.entries(table).forEach(([k, t]) => {
  if(!(t.avg >= 0.18 && t.avg <= 0.5)) errs.push(`${k} 타율 ${t.avg} 범위 밖(0.18~0.50)`);
  if(!(t.xbhRate >= 0.08 && t.xbhRate <= 0.6)) errs.push(`${k} 장타 비율 ${t.xbhRate} 범위 밖(0.08~0.60)`);
  if(!(t.kRate >= 0.03 && t.kRate <= 0.5)) errs.push(`${k} 삼진율 ${t.kRate} 범위 밖(0.03~0.50)`);
  if(!(t.bbRate >= 0.02 && t.bbRate <= 0.25)) errs.push(`${k} 볼넷률 ${t.bbRate} 범위 밖(0.02~0.25)`);
});
const BASE = path.join(__dirname, 'baseline.json');
const textHash = TXT.digest('hex');
const out = { cellPA: CELL_PA, textHash, table };
if(SAVE){ fs.writeFileSync(BASE, JSON.stringify(out, null, 1) + '\n'); console.log('baseline.json 저장'); }
else if(fs.existsSync(BASE)){
  const old = JSON.parse(fs.readFileSync(BASE, 'utf8'));
  if(old.textHash && old.cellPA === CELL_PA && old.textHash !== textHash) errs.push(`경기 문장 해시 ${old.textHash.slice(0, 8)} → ${textHash.slice(0, 8)}: 어딘가 글이 달라짐`);
  if(old.cellPA !== CELL_PA) console.log(`baseline.json은 칸당 ${old.cellPA}타석 기준이라 같은 경기 수(${old.cellPA / 15})로 돌릴 때만 견줌`);
  else Object.entries(old.table).forEach(([k, o]) => ['avg', 'xbhRate', 'kRate', 'bbRate', 'hrRate', 'runsPerPA'].forEach(f => {
    if(Math.abs(table[k][f] - o[f]) > 0.0005) errs.push(`${k} ${f}: 저장한 값 ${o[f]} → 지금 ${table[k][f]}`);
  }));
} else console.log('baseline.json이 없음: --save-baseline으로 저장');
if(errs.length){ console.log('균형 표 오류:\n  ' + errs.join('\n  ')); process.exit(1); }
console.log('균형 표 통과' + (fs.existsSync(BASE) && !SAVE ? ' (baseline.json과 같음)' : ''));
