// 선수 육성 시험(화면 없이): 새 선수로 여러 시즌을 자동 진행하고(훈련·경기·부상·계약·장비), 옛 저장 형식을 불러와 한 시즌 진행함.
// 확인: 능력치가 잠재력(+장비 상한)을 넘지 않음 · 연봉·돈이 폭주하지 않음 · NaN 없음 · 피로 0~100 · 부상이 나으면 능력치가 돌아옴
// 사용법: node baseball/tests/career.js [시즌 수=10] [씨앗]
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'js');
globalThis.document = { documentElement:{ classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } }, dataset:{} }, querySelector(){ return null; }, addEventListener(){}, baseURI:'http://x/' };
globalThis.location = { search:'', hostname:'localhost' };
['util.js', 'data.js', 'engine.js', 'playsim.js', 'timeline.js', 'ai.js', 'league.js'].forEach(f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }));
// 화면 쪽 함수는 가짜로 (league-ui.js의 저장 틀과 같은 모양)
vm.runInThisContext(`
var LSRC = 'career', STORE = { L:null }, NEW = { len:18, mode:'simple', kind:'career' };
function LG(){ return STORE.L; } function setLG(L){ STORE.L = L; } function saveLeague(){}
function leagueNews(L){ const n = L.newsRead || 0; L.newsRead = L.news.length; return L.news.slice(n); }
function go(){} function stay(){} function playFx(){} function speak(){} function openDlg(){} function note(){}
`);
['career-grow.js', 'career.js', 'career-life.js'].forEach(f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }));

const SEASONS = +process.argv[2] || 10, SEED = +process.argv[3] || 5;
const errs = [], log = [];
const fail = m => { if(errs.length < 25) errs.push(m); };
const keysOf = p => isPit(p) ? ['vel', 'ctl', 'stf', 'sta'] : ['con', 'pow', 'eye', 'spd', 'def'];

function newCareer(pit, seed){
  const L0 = (Object.assign(NEWC, { name:'시험선수', pit, pos:'SS', type: pit ? 'heat' : 'power', role:'sp', team:'star' }), careerNew());
  L0.rng = seed >>> 0 || 1; L0.mv = 2; setLG(L0); return L0;
}
function check(L, where){
  const c = C(L), p = myP(L);
  keysOf(p).forEach(k => {
    if(!Number.isFinite(p[k])) fail(`${where}: ${k}이 숫자가 아님`);
    const extra = Object.values(c.applied || {}).reduce((s, d) => s + Math.max(0, d[k] || 0), 0);
    if(p.pot && p[k] > Math.max(p.pot[k], 0) + extra + 0.0001 && p[k] > potCap(k) - 0) fail(`${where}: ${k} ${p[k]}가 한계 ${p.pot[k]}(+장비 ${extra})를 넘음`);
  });
  if(!(c.fatigue >= 0 && c.fatigue <= 100)) fail(`${where}: 피로 ${c.fatigue}`);
  if(!(c.money >= 0 && c.money < 200000)) fail(`${where}: 돈 ${c.money}`);
  if(!(c.salary >= 3000 && c.salary <= 15000)) fail(`${where}: 연봉 ${c.salary}`);
  const gearPos = Object.values(c.applied || {}).reduce((s, d) => s + Object.values(d).filter(v => v > 0).reduce((a, b) => a + b, 0), 0);
  if(gearPos > GEAR_CAP + 4) fail(`${where}: 장비 효과 합 ${gearPos}가 상한 ${GEAR_CAP}을 넘음`);
}
// 하루: 정책은 "피곤하면 쉬고, 아니면 훈련, 돈이 모이면 장비 사고 강화, 이벤트·계약은 첫 선택"
function playDay(L, rndk){
  const c = life(L), p = myP(L);
  if(c.event){ const e = EVENTS.find(x => x.id === c.event); delete c.event; if(e) e.opts[0][1](L, c, p); }
  if(c.offer){ const can = faEligible(L, p); if(can && rndk() < 0.5){ const fa = faOffers(L); signContract(L, fa[Math.floor(rndk() * fa.length)]); c.offer && delete c.offer; } else signContract(L, c.offer); }
  if(L.phase === 'done'){ const r = nextSeasonCore(L); return r.retire ? 'retire' : 'season'; }
  if(!c.hurt){ if((c.fatigue || 0) > 55) trainDay(L, null); else { const list = isPit(p) ? PIT_TRAIN : BAT_TRAIN, t = list[Math.floor(rndk() * list.length)]; trainDay(L, t[0], t[2]); } }
  // 돈이 넉넉하면 개인 코치를 고용하고 기부함 (돈 쓸 곳)
  if(L.phase === 'season' && c.coach !== L.season && c.money > c.salary * 0.5 && c.where !== 'minor') c.coach = L.season;
  if(c.donated !== L.season && c.money > c.salary * 0.4 && c.where !== 'minor'){ c.money -= Math.round(c.salary * 0.1); c.donated = L.season; c.fame += 4; }
  // 돈이 있으면 장비 구입·강화·수리
  if(c.money > 400 && rndk() < 0.3){
    const it = ITEMS.filter(x => fits(x, p) && !c.owned.includes(x.id) && x.price <= c.money)[0];
    if(it){ c.money -= it.price; c.owned.push(it.id); equip(L, it); }
    else for(const id of c.owned){ const itm = itemOf(id), st = gearState(c, id); if(st.dur < 60 && c.money >= repairCost(itm)){ c.money -= repairCost(itm); st.dur = 100; refreshGear(L); } else if(st.lv < 3 && c.money >= enhanceCost(itm, st)){ c.money -= enhanceCost(itm, st); st.lv++; refreshGear(L); } }
  }
  if(c.where === 'minor' && L.phase === 'season'){
    const { opp, o } = minorGameOpts(L, 'detail'); const G2 = newGame(o); simMine(G2, c.id); careerGrowFromGame(L, G2, true);
    leagueAdvance(L, null);
  } else if(c.hurt > 0 || L.phase !== 'season'){ leagueAdvance(L, null); }
  else { const g = myGameToday(L); if(g){ const G2 = newGame(leagueGameOpts(L, g.a, g.h, ['cpu', 'cpu'], 'manager', 'pitch')); simMine(G2, c.id); careerGrowFromGame(L, G2, false); leagueAdvance(L, G2); } else leagueAdvance(L, null); }
  careerAfterDay(L);
  return null;
}
function run(pit, seed, seasons){
  const L = newCareer(pit, seed); let season = 1, days = 0, hurtDays = 0, injuries = 0, moved = 0, first = myP(L), startOvr = pit ? ratingPit(first) : ratingBat(first), rs = seed >>> 0 || 1;
  const rndk = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
  let team0 = L.my;
  while(season <= seasons && days < 40000){
    days++;
    const wasHurt = C(L).hurt, r = playDay(L, rndk);
    if(C(L).injury && !wasHurt) injuries++;
    if(C(L).hurt > 0) hurtDays++;
    if(L.my !== team0){ moved++; team0 = L.my; }
    check(L, `${pit ? '투수' : '타자'} ${season}시즌 ${days}일`);
    if(r === 'retire') break;
    if(r === 'season'){ const p = myP(L); log.push(`  ${pit ? '투수' : '타자'} ${season}시즌 끝: ${p.age}세 ${CURVES[p.curve].name} 능력 ${(pit ? ratingPit(p) : ratingBat(p)).toFixed(1)}(처음 ${startOvr.toFixed(1)}) 연봉 ${won(C(L).salary)} 돈 ${won(C(L).money)} ${teamInfo(L.my).name}`); season++; }
  }
  // 부상 중인 능력 저하가 낫고 나면 돌아오는지: 다 나은 상태에서 injury 기록이 없어야 함
  if(!C(L).hurt && C(L).injury) fail('다 나았는데 부상 기록이 남음');
  log.push(`  ${pit ? '투수' : '타자'}: ${days}일, 부상 ${injuries}번(쉰 날 ${hurtDays}), 이적 ${moved}번`);
  return L;
}
run(false, SEED, SEASONS); run(true, SEED + 1, SEASONS);

// ---- 옛 저장 불러오기: 새 칸이 없는 육성 저장 ----
{
  const L = newCareer(false, SEED + 2), c = L.career, p = myP(L);
  const base = { con:p.con, pow:p.pow };
  // 옛 방식: 장비 효과를 능력치에 직접 더해 둠, 새 칸 없음
  c.equip.bat = 'bat3'; c.owned = ['bat3']; p.con += 2; p.pow += 2;
  ['v', 'fatigue', 'gs', 'applied', 'contract'].forEach(k => delete c[k]); delete p.pot; delete p.curve; delete L.mv;
  migrate('league', L);
  if(L.mv !== 2 || c.v !== 2) fail('옛 저장: 새 형식으로 바뀌지 않음');
  if(!p.pot || !p.curve || !c.contract || c.fatigue !== 0) fail('옛 저장: 새 칸이 채워지지 않음');
  if(p.con !== base.con + 2 || p.pow !== base.pow + 2) fail(`옛 저장: 장비 효과가 달라짐 (${p.con} ${p.pow})`);
  unequip(L, 'bat'); if(p.con !== base.con || p.pow !== base.pow) fail(`옛 저장: 장비를 벗어도 원래 능력치로 돌아오지 않음 (${p.con} ${p.pow})`);
  let rs = 9; const rndk = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; }, s0 = L.season;
  for(let d = 0; d < 3000 && L.season === s0; d++){ if(playDay(L, rndk) === 'season') break; check(L, `옛 저장 ${d}일`); }
  log.push('  옛 저장: 불러온 뒤 한 시즌 진행 통과');
}
console.log(`[육성] ${SEASONS}시즌 자동 진행 (타자·투수)\n` + log.join('\n'));
if(errs.length){ console.log('육성 시험 오류:\n  ' + errs.join('\n  ')); process.exit(1); }
console.log('육성 시험 통과');
