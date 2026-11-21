// 올스타 시험: 시즌 절반에 휴식기가 오고, 팬 투표 명단(드림·나눔 각각 타자 9명·투수 5명)·홈런 더비(예선 4명 → 결승 2명 → 우승)·올스타전 결과가 나오며,
// 올스타전 기록이 정규 시즌 기록에 섞이지 않는지. 사용법: node baseball/tests/allstar.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'js');
['data.js', 'engine.js', 'playsim.js', 'ai.js', 'league.js', 'allstar.js'].forEach(f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }));
const err = [], log = [];
const L = leagueNew({ my:'star', len:36, mode:'manager', inn:9, seed:21 });
let d = 0; while(!allstarDue(L) && L.phase === 'season' && d++ < 500) leagueAdvance(L, null);
if(!allstarDue(L)) err.push('시즌 절반에 올스타 휴식기가 오지 않음');
log.push(`휴식기: ${L.day}일째 / ${L.sched.length}일`);
const R = allstarRosters(L);
['dream', 'nanum'].forEach(side => {
  if(R[side].bat.length !== 9 || R[side].pit.length !== 5) err.push(`${side} 명단 수가 맞지 않음`);
  if(new Set(R[side].bat.map(e => e.id)).size !== 9) err.push(`${side} 타자가 겹침`);
  const sides = asSides(L)[side]; if(R[side].bat.concat(R[side].pit).some(e => !sides.includes(e.team))) err.push(`${side}에 다른 쪽 팀 선수가 있음`);
});
log.push('드림 1번: ' + asPlayer(L, R.dream.bat[0]).name + ', 나눔 1번: ' + asPlayer(L, R.nanum.bat[0]).name);
const D = derbyNew(L); let g = 0;
while(!D.champ && g++ < 50) derbyAuto(L, D);
if(!D.champ) err.push('홈런 더비가 끝나지 않음');
if(!D.final || D.final.length !== 2) err.push('홈런 더비 결승이 두 명이 아님');
log.push(`홈런 더비: 예선 ${D.field.map(e => `${e.name} ${D.semi[e.id] || 0}`).join(', ')} → 우승 ${D.champ && D.champ.name}`);
const ss0 = JSON.stringify(Object.values(L.teams).map(T => [...T.bat, ...T.sp].map(p => p.ss)));
const res = allstarSim(L);
if(!res || !res.mvp) err.push('올스타전 결과·MVP가 없음');
if(JSON.stringify(Object.values(L.teams).map(T => [...T.bat, ...T.sp].map(p => p.ss))) !== ss0) err.push('올스타전 기록이 정규 시즌 기록에 섞임');
log.push(`올스타전: 나눔 ${res.score[0]} 대 ${res.score[1]} 드림, MVP ${res.mvp}(${res.mvpLine})`);
L.allstar.closed = true;
if(allstarDue(L)) err.push('휴식기를 끝냈는데 또 나옴');
while(L.phase !== 'done' && d++ < 2000) leagueAdvance(L, null);
if(L.phase !== 'done') err.push('휴식기 뒤 시즌이 끝나지 않음');
leagueNextSeason(L); while(!allstarDue(L) && L.phase === 'season' && d++ < 3000) leagueAdvance(L, null);
if(!allstarDue(L)) err.push('다음 시즌에 올스타 휴식기가 다시 오지 않음');
console.log(log.join('\n'));
if(err.length){ console.log('오류:\n' + err.join('\n')); process.exit(1); }
console.log('올스타 시험 통과');
