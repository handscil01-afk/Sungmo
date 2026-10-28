// 리그 시험: 시즌 전체와 포스트시즌을 컴퓨터끼리 진행하고 기록이 맞는지 확인함. 사용법: node baseball/tests/league.js [팀당 경기 수]
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'js');
['data.js', 'engine.js', 'ai.js', 'league.js'].forEach(f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }));
const len = +process.argv[2] || 18, t0 = Date.now();
const L = leagueNew({ my:'star', len, mode:'manager', inn:9, seed:7 });
let days = 0;
while(L.phase !== 'done' && days < 1000){ leagueAdvance(L, null); days++; }
const T = Object.values(L.teams), err = [];
T.forEach(t => { if(t.w + t.l + t.d !== len) err.push(`${t.key} 경기 수 ${t.w + t.l + t.d}`); });
const W = T.reduce((s, t) => s + t.w, 0), Lo = T.reduce((s, t) => s + t.l, 0);
if(W !== Lo) err.push(`승 ${W} ≠ 패 ${Lo}`);
const pw = T.reduce((s, t) => s + [...t.sp, ...t.rp].reduce((a, p) => a + ((p.ss || {}).w || 0), 0), 0);
const pl = T.reduce((s, t) => s + [...t.sp, ...t.rp].reduce((a, p) => a + ((p.ss || {}).l || 0), 0), 0);
console.log(`${len}경기 시즌 + 포스트시즌: ${days}일, ${((Date.now() - t0) / 1000).toFixed(1)}초`);
console.log('순위:', standings(L).map(x => `${x.rank}위 ${teamName(x.T.key)} ${x.T.w}승 ${x.T.l}패 ${x.T.d}무 ${pctText(x.T)} ${gbText(x.gb)}`).join(' / '));
console.log('투수 승', pw, '패', pl, '(팀 승', W, '패', Lo, ')');
console.log('포스트시즌:', L.post.log.join(' '));
console.log('우승', teamName(L.champ), '· MVP', L.awards.mvp && L.awards.mvp.name, '· 한국시리즈 MVP', L.awards.ksMvp && L.awards.ksMvp.name);
console.log('타이틀:', L.awards.titles.map(t => `${STAT_NAME[t.st]} ${t.name}(${teamName(t.team)}) ${statVal(t.st, t.v)}`).join(', '));
if(pw > W || pl > Lo) err.push('투수 승패가 팀 승패보다 많음');
if(!L.champ) err.push('우승 팀 없음');
console.log('저장 크기', (JSON.stringify(L).length / 1024).toFixed(0), 'KB');
if(err.length){ console.log('오류:', err.join(', ')); process.exit(1); }
console.log('오류 없음');
// 여러 시즌: 은퇴·신인·명예의 전당·시즌 기록
if(process.argv[3]){
  const seasons = +process.argv[3], t1 = Date.now();
  for(let s = 1; s < seasons; s++){ leagueNextSeason(L); let d = 0; while(L.phase !== 'done' && d++ < 1000) leagueAdvance(L, null); }
  console.log(`${seasons}시즌까지 ${((Date.now() - t1) / 1000).toFixed(1)}초. 은퇴 ${L.retired.length}명, 명예의 전당 ${L.hof.length}명, 대기록 ${(L.feats || []).length}개, 저장 크기 ${(JSON.stringify(L).length / 1024).toFixed(0)}KB`);
  console.log('역대 우승:', L.history.map(h => `${h.season}시즌 ${teamName(h.champ)}`).join(', '));
  console.log('통산 홈런:', careerLeaders(L, 'hr', 3).map(x => `${x.name} ${x.v}${x.active ? '' : '(은퇴)'}`).join(', '));
  console.log('통산 승리:', careerLeaders(L, 'w', 3).map(x => `${x.name} ${x.v}${x.active ? '' : '(은퇴)'}`).join(', '));
  console.log('시즌 기록:', Object.entries(L.rec).map(([k, r]) => `${STAT_NAME[k]} ${r.name} ${statVal(k, r.v)}(${r.season}시즌)`).join(', '));
  console.log('명예의 전당:', L.hof.slice(0, 5).map(h => `${h.name}(${teamName(h.team)})`).join(', '));
  console.log('신인왕:', L.history.map(h => h.awards && h.awards.roy ? h.awards.roy.name : '-').join(', '));
  console.log('대기록 예:', (L.feats || []).slice(0, 4).map(f => f.text).join(' / '));
  const ages = Object.values(L.teams).flatMap(t => allPlayers(t).map(p => p.age)); console.log('평균 나이', (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1));
}
