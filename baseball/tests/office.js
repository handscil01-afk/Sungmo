// 구단 운영 시험: 연봉 총액·트레이드(받아들임·거절·상한)·FA·드래프트가 규칙대로 되고, 바꾼 뒤에도 리그가 끝까지 진행되는지. 사용법: node baseball/tests/office.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'js');
['data.js', 'engine.js', 'playsim.js', 'ai.js', 'league.js', 'office.js'].forEach(f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }));
const err = [], log = [];
const L = leagueNew({ my:'star', len:18, mode:'manager', inn:9, seed:11 });
const T = L.teams.star, cap = capOf(L), pays = Object.values(L.teams).map(payroll);
log.push(`연봉 총액: 우리 ${eok(payroll(T))}, 팀들 ${Math.min(...pays)}~${Math.max(...pays)}억, 상한 ${eok(cap)}`);
if(!(cap > Math.max(...pays) * 0.95)) err.push('상한이 너무 낮음');
const size = t => [t.bat.length, t.bench.length, t.sp.length, t.rp.length].join('/');
const before = size(T);
// 받아들일 트레이드: 우리 좋은 타자 ↔ 상대 비슷한 타자
const mine = T.bat.slice().sort((a, b) => fov(b) - fov(a))[0];
const cand = tradeTargets(L, 'whale', mine).find(x => x.gain >= 0);
if(!cand) err.push('받아들일 트레이드 후보가 없음');
else {
  const pos = mine.pos, r = doTrade(L, 'whale', mine, cand.p);
  if(!r.ok) err.push('트레이드가 안 됨: ' + r.msg);
  if(T.bat.includes(mine) || !allPlayers(T).includes(cand.p) || !allPlayers(L.teams.whale).includes(mine)) err.push('트레이드 뒤 선수가 제자리에 없음');
  if(T.bat.includes(cand.p) && cand.p.pos !== pos) err.push('들어온 타자가 나간 선수의 수비 위치를 받지 않음');
  log.push('받아들임: ' + r.msg);
}
// 거절할 트레이드: 우리 가장 약한 투수 ↔ 상대 가장 좋은 투수
const weak = [...T.sp, ...T.rp].sort((a, b) => fov(a) - fov(b))[0], ace = [...L.teams.hawk.sp].sort((a, b) => fov(b) - fov(a))[0];
const no = doTrade(L, 'hawk', weak, ace); if(no.ok) err.push('손해 보는 트레이드를 상대가 받아들임'); log.push('거절: ' + no.msg);
const mix = doTrade(L, 'hawk', T.bat[0], L.teams.hawk.sp[0]); if(mix.ok) err.push('타자와 투수를 바꿈');
// 시즌 진행 → 시즌 끝 → FA·드래프트
let d = 0; while(L.phase !== 'done' && d++ < 1000) leagueAdvance(L, null);
const fa = faPool(L); if(fa.length !== 6) err.push('FA 명단이 6명이 아님');
const fb = fa.find(p => !p.vel), outB = T.bench.slice().sort((a, b) => fov(a) - fov(b))[0];
const s1 = signFA(L, fb, outB); if(!s1.ok) err.push('FA 영입이 안 됨: ' + s1.msg); else log.push('FA: ' + s1.msg);
if(!T.bench.includes(fb)) err.push('FA 선수가 벤치 자리에 들어가지 않음');
const big = { ...fb, fa: cap }; const s2 = signFA(L, big, T.bench[1]); if(s2.ok) err.push('연봉 상한을 넘는 FA를 영입함');
const dp = draftPool(L); if(!dp.length) err.push('드래프트 명단이 비었음');
const rk = dp.find(p => p.vel), outP = T.rp.slice().sort((a, b) => fov(a) - fov(b))[0];
const s3 = draftSign(L, rk, outP); if(!s3.ok) err.push('드래프트가 안 됨: ' + s3.msg); else log.push(`드래프트(${L.draftPool.pick}순위, 우리 팀 ${standings(L).find(x => x.T.key === 'star').rank}위): ` + s3.msg);
if(draftSign(L, dp[0], T.rp[2]).ok) err.push('드래프트를 두 번 함');
if(size(T) !== before) err.push(`명단 크기가 바뀜 ${before} → ${size(T)}`);
// 다음 시즌도 끝까지
leagueNextSeason(L); d = 0; while(L.phase !== 'done' && d++ < 1000) leagueAdvance(L, null);
if(L.phase !== 'done') err.push('운영 뒤 다음 시즌이 끝나지 않음');
if(officeFresh(L).trades !== 0) err.push('새 시즌에 트레이드 횟수가 초기화되지 않음');
if(!allPlayers(T).some(p => p === fb || p.id === fb.id)) log.push('(FA 선수는 은퇴했을 수 있음)');
console.log(log.join('\n'));
if(err.length){ console.log('오류:\n' + err.join('\n')); process.exit(1); }
console.log('구단 운영 시험 통과');
