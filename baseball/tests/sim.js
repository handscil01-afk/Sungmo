// 컴퓨터끼리 여러 경기를 돌려 수치와 규칙 위반을 확인함. 사용법: node baseball/tests/sim.js [경기 수]
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'js');
['data.js', 'engine.js', 'ai.js'].forEach(f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }));

const N = +process.argv[2] || 300;
function run(mode){
  const tot = { g:0, runs:0, pa:0, ab:0, h:0, hr:0, k:0, bb:0, sb:0, e:0, pitches:0, xbh:0, extra:0, draws:0, lines:0, walkoff:0 };
  for(let n = 0; n < N; n++){
    const keys = TEAMS.map(t => t.key);
    const G = newGame({ mode, innings:9, teams:[keys[n % 6], keys[(n + 1 + (n >> 3)) % 6 === n % 6 ? (n + 2) % 6 : (n + 1 + (n >> 3)) % 6]], ctrl:['cpu', 'cpu'], seed: 1000 + n });
    flush(G);
    let guard = 0;
    while(!G.over){
      if(++guard > 5000) throw new Error('끝나지 않는 경기 ' + n);
      if(mode === 'detail') playPitch(G, aiPitch(G), aiBat(G));
      else playSimple(G, aiSimpleDef(G), aiSimpleOff(G));
      // 규칙 확인
      const on = G.bases.filter(x => x != null);
      if(new Set(on).size !== on.length) throw new Error('같은 주자가 두 베이스에: ' + JSON.stringify(G.bases) + ' 경기 ' + n);
      if(on.includes(batTeam(G).bi) && !G.over && G.balls + G.strikes === 0 && G.pitchNo === 0) throw new Error('타자가 이미 베이스에 있음 ' + n);
      if(G.outs > 3 || G.balls > 3 || G.strikes > 2) { if(!G.over) throw new Error('카운트 이상 ' + JSON.stringify([G.outs, G.balls, G.strikes])); }
      G.log.forEach(l => { if(/undefined|NaN|null/.test(l.s)) throw new Error('문장 이상: ' + l.s); });
    }
    tot.g++;
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
  console.log(`[${mode}] ${tot.g}경기 · 팀당 경기당 득점 ${per(tot.runs)} · 안타 ${per(tot.h)} · 홈런 ${per(tot.hr)} · 삼진 ${per(tot.k)} · 볼넷 ${per(tot.bb)} · 도루 ${per(tot.sb)} · 실책 ${per(tot.e)}`);
  console.log(`   타율 ${(tot.h / tot.ab).toFixed(3)} · 삼진율 ${(tot.k / tot.pa * 100).toFixed(1)}% · 볼넷률 ${(tot.bb / tot.pa * 100).toFixed(1)}% · 타석당 투구 ${(tot.pitches / tot.pa).toFixed(2)} · 연장 ${tot.extra} · 무승부 ${tot.draws} · 끝내기 ${tot.walkoff} · 경기당 문장 ${(tot.lines / tot.g).toFixed(0)}`);
}
run('detail');
run('simple');
