// 감독 모드 시험: 대수비(경기 후반에만, 지명타자 제외, 경기마다 2번, 나간 선수는 gone, 팀 수비 다시 계산)와
// 상대 타자·투수 분석 글, 컴퓨터 감독의 대수비가 리그 경기에서 쓰이는지. 사용법: node baseball/tests/manager.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'js');
['data.js', 'engine.js', 'playsim.js', 'ai.js', 'league.js'].forEach(f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }));
// 화면 쪽은 가짜로 (분석 함수만 씀)
vm.runInThisContext(`var G = null, NET = { on:false }; const ownTeam = ti => ti === 0; function go(){} function note(){} function submit(){} function saveGame(){} const visible = l => l;`);
vm.runInThisContext(fs.readFileSync(path.join(dir, 'manager.js'), 'utf8'), { filename: 'manager.js' });
const err = [], log = [];
const step = () => { if(G.pendingThrow) resolveThrow(G, null); else if(G.review) resolveReview(G, false); else playStep(G, aiDefChoice(G), aiOffChoice(G)); };

// 1) 사람(0팀)이 수비하는 경기 후반까지 진행
vm.runInThisContext(`G = newGame({ mode:'manager', innings:9, teams:['star', 'whale'], ctrl:['human', 'cpu'], seed:5 });`);
if(G.pre) beginGame(G);
if(defSubOK(G, 0) || defSubOK(G, 1)) err.push('경기 초반에 대수비가 됨');
let g = 0;
while(!G.over && g++ < 6000 && !(G.inning >= 7 && !G.top && G.pitchNo === 0 && G.outs === 0)) step();
if(G.over) err.push('후반 전에 경기가 끝남');
const ti = 1 - batIdx(G), T = G.teams[ti];
if(ti !== 0) err.push('시험 설정 오류: 0팀이 수비가 아님');
// 수비가 더 좋은 벤치 선수가 반드시 있게 (시험용)
T.bench[0].def = 99;
if(!defSubOK(G, 0)) err.push('7회 수비 타석 시작에 대수비가 안 됨');
const pairs = defSubPairs(G, 0);
if(!pairs.length) err.push('대수비 후보가 없음');
if(pairs.some(x => T.bat[x.slot].pos === 'DH')) err.push('지명타자를 대수비 후보에 넣음');
const pr = pairs[0], out = T.bat[pr.slot], inn = T.bench[pr.b], def0 = T.def, pos = out.pos, nb = T.bench.length;
defSub(G, 0, pr.slot, pr.b);
if(T.bat[pr.slot] !== inn || inn.pos !== pos) err.push('대수비 선수가 자리·수비 위치를 받지 않음');
if(!T.gone.includes(out) || T.bench.includes(out) || T.bench.length !== nb - 1) err.push('나간 선수가 gone에 없거나 벤치로 돌아옴');
if(!(T.def >= def0)) err.push(`팀 수비가 나빠짐 ${def0} → ${T.def}`);
if(!G.log.some(l => /대수비/.test(l.s))) err.push('대수비 중계 글이 없음');
log.push(`대수비: ${pos} ${out.name} → ${inn.name}, 팀 수비 ${def0} → ${T.def}`);
// 세 번째는 안 됨
T.dsub = DSUB_MAX; if(defSubOK(G, 0)) err.push(`경기마다 ${DSUB_MAX}번을 넘어도 됨`); T.dsub = 1;
// 투구가 시작되면 안 됨
G.pitchNo = 1; if(defSubOK(G, 0)) err.push('타석 도중에 대수비가 됨'); G.pitchNo = 0;
// 2) 분석 글
const sb = scoutBatter(G), sp = scoutPitcher(G);
if(sb.lines.length < 4 || !/약점/.test(sb.lines.join(' ')) || !/성향/.test(sb.lines.join(' '))) err.push('타자 분석 글이 모자람');
if(!(sb.weak.r >= 0 && sb.weak.r <= 2 && sb.weak.c >= 0 && sb.weak.c <= 2)) err.push('약점 칸이 이상함');
if(/컨택 \d/.test(sb.lines[0])) err.push('상대 타자 능력치가 숫자로 보임 (등급이어야 함)');
if(!/오늘 투구 수 \d+개/.test(sp.lines[0]) || !/많이 던진 공/.test(sp.lines[2])) err.push('투수 분석 글이 모자람: ' + sp.lines.join(' | '));
log.push('타자 분석: ' + sb.lines.slice(1, 3).join(' '));
log.push('투수 분석: ' + sp.lines[2]);
while(!G.over && g++ < 12000) step();
if(!G.over) err.push('대수비 뒤 경기가 끝나지 않음');
// 3) 컴퓨터 감독: 리그 시즌에서 대수비를 가끔 씀
const L = leagueNew({ my:'star', len:36, mode:'manager', inn:9, seed:3 });
let subs = 0, games = 0, d = 0;
while(L.phase === 'season' && d++ < 200){ leagueAdvance(L, null); }
for(let i = 0; i < 60; i++){ const k = Object.keys(L.teams); const Gx = leagueSim(L, k[i % 10], k[(i + 3) % 10]); games++; subs += Gx.teams.reduce((s, t) => s + (t.dsub || 0), 0); }
log.push(`컴퓨터 감독 대수비: ${games}경기에 ${subs}번`);
if(!subs) err.push('컴퓨터 감독이 대수비를 한 번도 안 씀');
if(subs > games * 1.2) err.push('컴퓨터 감독이 대수비를 너무 자주 씀');
console.log(log.join('\n'));
if(err.length){ console.log('오류:\n' + err.join('\n')); process.exit(1); }
console.log('감독 모드 시험 통과');
