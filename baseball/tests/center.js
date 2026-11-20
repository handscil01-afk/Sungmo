// 우리 센터 팀 시험: 사용자가 만든 팀으로 한 경기와 리그 한 시즌을 끝까지 진행하고, 이름·별명·보직이 그대로 쓰이는지 확인함. 사용법: node baseball/tests/center.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'js');
['data.js', 'engine.js', 'playsim.js', 'ai.js', 'league.js'].forEach(f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }));
vm.runInThisContext(`CENTER = { name:'손잡다 센터', short:'센터', color:'#ec4899', emblem:null, style:'power', park:'thunder',
  bat: LINEUP_POS.map((pos, i) => ({ name:'타자' + i, nick:'별명' + i, pos, hand: i % 2 ? 'L' : 'R', con:70, pow:75, eye:60, spd:55, def:60 })),
  pit: ['선발', '마무리', '불펜', '불펜', '선발'].map((role, i) => ({ name:'투수' + i, nick:'', role, hand:'R', vel:150, ctl:70, stf:70, sta: 80 })) };`);
const G = newGame({ mode:'detail', innings:9, teams:['center', 'whale'], ctrl:['cpu', 'cpu'], seed:3 });
let g = 0; while(!G.over && g++ < 5000){ if(G.pendingThrow) resolveThrow(G, null); else if(G.review) resolveReview(G, false); else playStep(G, aiDefChoice(G), aiOffChoice(G)); }
console.log('경기:', G.teams.map(T => `${T.name} ${runsOf(T)}`).join(' 대 '), '타자', G.teams[0].bat.map(b => b.name + '/' + b.nick).slice(0, 3).join(','), '선발', G.teams[0].pit[0].name, G.teams[0].pit[0].sta, '구장', G.park.name);
const L = leagueNew({ my:'center', len:18, mode:'manager', inn:9, seed:7 });
let d = 0; while(L.phase !== 'done' && d++ < 1000) leagueAdvance(L, null);
const T = L.teams.center;
console.log('리그 팀:', Object.keys(L.teams).join(','), '| 센터', T.w + '승', T.l + '패', '| 선발', T.sp.map(p => p.name).join(','), '| 마무리', T.rp.find(p => p.role === '마무리').name, '| 끝:', L.phase, L.champ);
const err = [];
if(G.teams[0].bat[0].name !== '타자0' || G.teams[0].bat[0].nick !== '별명0') err.push('경기에 사용자가 정한 이름·별명이 안 들어감');
if(G.teams[0].pit[0].name !== '투수0') err.push('선발로 정한 투수가 선발이 아님');
if(G.teams[0].pit[1].name !== '투수1') err.push('마무리로 정한 투수가 마무리 자리가 아님');
if(!G.over) err.push('경기가 끝나지 않음');
if(!L.teams.center || L.teams.star) err.push('리그에서 우리 팀이 손잡다 핸즈 자리에 들어가지 않음');
if(L.phase !== 'done') err.push('리그 시즌이 끝나지 않음');
if(T.w + T.l + T.d !== 18) err.push('우리 팀 경기 수가 18이 아님');
if(T.rp.find(p => p.role === '마무리').name !== '투수1') err.push('리그 마무리가 정한 투수가 아님');
if(err.length){ console.log('오류:\n' + err.join('\n')); process.exit(1); }
console.log('우리 센터 팀 시험 통과');
