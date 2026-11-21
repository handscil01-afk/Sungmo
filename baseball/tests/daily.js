// 오늘의 목표·출석 도장·주간 리그 신문·맞대결 전적 시험
// 1) 화면 없이(node): 리그 한 시즌의 신문(7일마다, 마지막 5호)·이주의 선수·순위 변동, 맞대결 전적 합 = 팀 승패, 출석 도장(연속·누적·7칸·배지),
//    육성 며칠 진행하며 오늘의 목표 달성과 보상, 옛 저장(칸이 없는 육성 저장)
// 2) 화면(Playwright): 휴대폰·작은 휴대폰·가로·태블릿에서 라커룸 띠 → 출석 도장 찍기 → 신문 → 리그 첫 화면 신문·상대 전적 → 맞대결 전적 표, 한 화면에 들어가는지, 소리와 글로 하기 글
// 사용법: node baseball/tests/daily.js [node만 하려면 --node]
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'js');
const errs = [];
const fail = m => { if(errs.length < 40) errs.push(m); };

/* ---------- 1) 화면 없이 ---------- */
globalThis.document = { documentElement:{ classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } }, dataset:{} }, querySelector(){ return null; }, addEventListener(){}, baseURI:'http://x/' };
globalThis.location = { search:'', hostname:'localhost' };
['util.js', 'data.js', 'engine.js', 'playsim.js', 'timeline.js', 'ai.js', 'league.js'].forEach(f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }));
vm.runInThisContext(`
var LSRC = 'career', STORE = { L:null }, NEW = { len:18, mode:'simple', kind:'career' }, BADGES = [];
function LG(){ return STORE.L; } function setLG(L){ STORE.L = L; } function saveLeague(){}
function leagueNews(L){ const n = L.newsRead || 0; L.newsRead = L.news.length; return L.news.slice(n); }
function go(){} function stay(){} function playFx(){} function speak(){} function openDlg(){} function note(){} function lhome(){ return null; }
const myRank = L => standings(L).find(x => x.T.key === L.my); function loadSaved(){ return null; } function batLine(p){ return p.name + ': 기록'; } function pitLine(p){ return p.name + ': 기록'; }
function badgeGive(L, k){ BADGES.push(k); return '배지 ' + k; }
`);
['career-grow.js', 'career.js', 'career-life.js', 'career-story.js', 'career-trust.js', 'daily.js', 'paper.js', 'h2h.js'].forEach(f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }));
const bad = s => /undefined|NaN|null|\[object/.test(s);

// 리그: 36경기 시즌 → 신문 6호(마지막 5호만), 이주의 타자·투수, 순위 변동, 맞대결 전적
{
  const L = leagueNew({ my:'star', len:36, mode:'manager', inn:9, seed:11 });
  let days = 0, made = 0, last = null;
  const weekW = [];
  while(L.phase === 'season' && days < 200){
    const before = (L.paper || []).length ? L.paper[L.paper.length - 1].no : 0;
    leagueAdvance(L, null); days++;
    const P = (L.paper || [])[(L.paper || []).length - 1];
    if(P && P.no !== before){
      made++; last = P;
      if(P.to !== L.day && !(L.phase !== 'season' && P.to === L.sched.length)) fail(`신문 ${P.no}호: 끝 날 ${P.to} ≠ ${L.day}`);
      if(!P.mvpB || !P.mvpP) fail(`신문 ${P.no}호: 이주의 타자·투수 없음`);
      if(P.teams.length !== 10 || new Set(P.teams.map(t => t.rank)).size < 2) fail(`신문 ${P.no}호: 순위 ${P.teams.length}팀`);
      const gw = P.teams.reduce((s, t) => s + t.w, 0), gl = P.teams.reduce((s, t) => s + t.l, 0), nd = (P.to - P.from + 1) * 5, gd = P.teams.reduce((s, t) => s + t.d, 0) / 2;
      if(gw !== gl || gw + gd !== nd) fail(`신문 ${P.no}호: 이번 주 승 ${gw} 패 ${gl} 무 ${gd}, 경기 ${nd}`);
      if(P.no > 1 && !P.teams.some(t => t.prev != null)) fail(`신문 ${P.no}호: 순위 변동 없음`);
      // 이주의 타자 기록은 시즌 기록을 넘을 수 없음
      const f = findPlayer(L, P.mvpB.id); if(!f) fail(`신문 ${P.no}호: 이주의 타자를 찾을 수 없음`);
      const lines = paperLines(L, P);
      if(lines.some(bad)) fail(`신문 ${P.no}호 글에 빈 값: ${lines.find(bad)}`);
      weekW.push(P.head.t);
    }
  }
  if(made !== 6) fail(`36일 시즌 신문 ${made}호 (6호여야 함)`);
  if(L.paper.length !== 5 || L.paper[0].no !== 2) fail(`남긴 신문 ${L.paper.length}부, 첫 호 ${L.paper[0] && L.paper[0].no}`);
  if(!last.end) fail('마지막 호 표시가 없음');
  if(paperUnread(L) !== 5 || !paperLine(L)) fail('읽지 않은 신문 수');
  // 맞대결 전적: 팀마다 상대별 합 = 팀 승패
  for(const k in L.teams){
    const T = L.teams[k], h = h2hOf(L, k), sum = x => Object.values(h).reduce((s, r) => s + r[x], 0);
    if(sum('w') !== T.w || sum('l') !== T.l || sum('d') !== T.d) fail(`맞대결 ${k}: ${sum('w')}-${sum('l')}-${sum('d')} ≠ ${T.w}-${T.l}-${T.d}`);
    if(sum('rs') !== T.rs || sum('ra') !== T.ra) fail(`맞대결 ${k}: 득실 ${sum('rs')}/${sum('ra')} ≠ ${T.rs}/${T.ra}`);
    Object.entries(h).forEach(([o, r]) => { const r2 = h2hOf(L, o)[k]; if(r.w !== r2.l || r.l !== r2.w) fail(`맞대결 ${k}-${o} 서로 맞지 않음`); });
  }
  // 새 시즌: 신문 1호는 다음 시즌 기록으로
  while(L.phase !== 'done') leagueAdvance(L, null);
  leagueNextSeason(L);
  for(let i = 0; i < 7; i++) leagueAdvance(L, null);
  const P = L.paper[L.paper.length - 1];
  if(P.season !== L.season || P.from !== 1 || P.to !== 7) fail(`새 시즌 첫 신문 ${P.season}시즌 ${P.from}~${P.to}`);
  const mb = findPlayer(L, P.mvpB.id).p.ss;
  if((mb.h || 0) < 0 || !/타율/.test(P.mvpB.line)) fail('새 시즌 이주의 타자');
  console.log(`리그 신문: ${made}호, 머리기사 예: ${weekW.slice(0, 3).join(' / ')}`);
  // 옛 저장: 시즌 중간에 처음 신문 기능을 만나면 그날부터 한 주
  delete L.paperSnap; L.paper = [];
  leagueAdvance(L, null); const d0 = L.day;
  for(let i = 0; i < 7; i++) leagueAdvance(L, null);
  if(!L.paper.length || L.paper[0].from !== d0 + 1) fail(`옛 저장 신문: ${L.paper.length}부, 시작 ${L.paper[0] && L.paper[0].from} (기대 ${d0 + 1})`);
  console.log('맞대결 전적 합·서로 맞음, 새 시즌 신문, 옛 저장 신문 통과');
}

// 출석 도장
{
  Object.assign(NEWC, { name:'출석선수', pit:false, pos:'SS', type:'power', role:'sp', team:'star' });
  const L = careerNew(); setLG(L);
  const day = n => { const d = new Date(Date.UTC(2026, 10, 1 + n)); return d.toISOString().slice(0, 10); };
  let money0 = L.career.money;
  globalThis.BB_TODAY = day(0);
  const r1 = attClaim(L);
  if(!r1 || !/1번째 칸/.test(r1[0])) fail(`첫 도장: ${r1}`);
  if(attClaim(L) !== null) fail('같은 날 두 번 찍힘');
  if(L.career.money !== money0 + 50) fail(`첫 칸 보상 돈 ${L.career.money - money0}`);
  globalThis.BB_TODAY = day(1); attClaim(L);
  if(L.career.att.streak !== 2) fail(`연속 출석 ${L.career.att.streak}`);
  globalThis.BB_TODAY = day(3); attClaim(L);
  if(L.career.att.streak !== 1 || L.career.att.total !== 3 || L.career.att.best !== 2) fail(`하루 빠진 뒤 연속 ${L.career.att.streak}, 누적 ${L.career.att.total}, 최고 ${L.career.att.best}`);
  const tonic0 = L.career.goods.tonic || 0;
  for(let i = 4; i <= 7; i++){ globalThis.BB_TODAY = day(i); attClaim(L); }
  if(L.career.att.total !== 7 || !L.career.att.m7 || !BADGES.includes('att7')) fail(`7일: 누적 ${L.career.att.total}, 배지 ${BADGES}`);
  if((L.career.goods.tonic || 0) !== tonic0 + 1) fail('7번째 칸 큰 보상(보약)이 없음');
  if(attStamps(L.career.att) !== 7) fail(`도장 ${attStamps(L.career.att)}칸`);
  for(let i = 8; i <= 30; i++){ globalThis.BB_TODAY = day(i); attClaim(L); }
  if(L.career.att.total !== 30 || !BADGES.includes('att30') || BADGES.length !== 2) fail(`30일: 누적 ${L.career.att.total}, 배지 ${BADGES}`);
  if(L.career.att.streak !== 28) fail(`연속 ${L.career.att.streak}`);
  // 화면 정의(소리와 글)
  const S = dailyScreen(null);
  if(S.say.some(bad) || !S.opts.find(o => o.key === 'stamp').hide) fail(`출석 화면 글: ${S.say.join(' / ')}`);
  globalThis.BB_TODAY = day(31);
  const S2 = dailyScreen(null); if(S2.opts.find(o => o.key === 'stamp').hide) fail('새 날에 도장 찍기가 없음');
  console.log(`출석 도장: 연속·누적·7칸 큰 보상·배지(${BADGES.join(', ')}) 통과`);
}

// 오늘의 목표: 육성 며칠 진행
{
  Object.assign(NEWC, { name:'목표선수', pit:false, pos:'CF', type:'speed', role:'sp', team: TEAMS[3].key });
  for(const pit of [false, true]){
    NEWC.pit = pit; NEWC.type = pit ? 'ctl' : 'speed'; NEWC.role = 'rp';
    const L = careerNew(); L.rng = 99 + (pit ? 1 : 0); setLG(L); delete L.career.camp;
    const c = L.career; let made = 0, done = 0, all = 0, reward = 0, games = 0;
    const kinds = new Set();
    for(let d = 0; d < 30 && L.phase === 'season'; d++){
      if(c.event) delete c.event;
      const D = dailyEnsure(L);
      if(!D || !D.goals.length || D.goals.length > 3) fail(`${d}일: 목표 ${D && D.goals.length}개`);
      // 같은 날 다시 만들어도 같은 목표
      const ids = D.goals.map(g => g.id).join(); const keep = c.daily; delete c.daily; if(dailyEnsure(L).goals.map(g => g.id).join() !== ids) fail('같은 날 목표가 바뀜'); c.daily = keep;
      made += D.goals.length; D.goals.forEach(g => kinds.add(g.id));
      const m0 = c.money;
      if(D.goals.some(g => g.id === 'goods')){ c.goods.drink = (c.goods.drink || 0) + 1; myP(L).cond = -1; const r = useGood(L, 'drink'); if(!/오늘의 목표 달성/.test(r[1])) fail(`소모품 목표: ${r[1]}`); }
      if(!c.hurt) trainDay(L, (pit ? PIT_TRAIN : BAT_TRAIN)[d % 4][0], '시험');
      if(D.goals.some(g => g.id === 'visit')){ c.money += 50; const p = myP(L); c.visited = dayKey(L); dailyHook(L, 'visit'); }
      if(c.where === 'minor'){ const { o } = minorGameOpts(L, 'detail'); const G2 = newGame(o); simMine(G2, c.id); careerGrowFromGame(L, G2, true); leagueAdvance(L, null); games++; }
      else { const g = myGameToday(L); if(g){ const G2 = newGame(leagueGameOpts(L, g.a, g.h, ['cpu', 'cpu'], 'manager', 'pitch')); simMine(G2, c.id); careerGrowFromGame(L, G2, false); leagueAdvance(L, G2); games++; } else leagueAdvance(L, null); }
      done += D.goals.filter(g => g.done).length; if(D.all) all++;
      if(D.goals.some(g => g.done && g.rw.k === 'money')) reward++;
      D.goals.forEach(g => { if(g.have > g.need || g.have < 0) fail(`목표 진행 ${g.have}/${g.need}`); });
      careerAfterDay(L);
      const lines = dailyLines(L); if(lines.some(bad)) fail(`상태 줄에 빈 값: ${lines.find(bad)}`);
    }
    if(done < made * 0.4) fail(`${pit ? '투수' : '타자'}: 목표 ${made}개 가운데 ${done}개만 이룸`);
    if(!kinds.has('train') || ![...kinds].some(k => ['hit', 'hit2', 'rbi', 'onbase', 'k', 'zero'].includes(k))) fail(`${pit ? '투수' : '타자'}: 목표 종류 ${[...kinds]}`);
    if(!(c.dailyAll > 0)) fail(`${pit ? '투수' : '타자'}: 모두 이룬 날이 없음`);
    // 맞대결 화면 (육성): 팀별 기록
    LSRC = 'career';
    const H = h2hScreen(null);
    if(H.say.some(bad) || !H.table.length) fail(`육성 맞대결 화면: ${H.say.find(bad)}`);
    if(!pit && c.where === 'team' && !(c.vs && Object.keys(c.vs.t).length)) fail(`${pit ? '투수' : '타자'}: 1군 팀별 기록이 쌓이지 않음`);
    console.log(`오늘의 목표(${pit ? '투수' : '타자'}): ${games}경기, 목표 ${made}개 중 ${done}개, 모두 이룬 날 ${c.dailyAll}, 종류 ${[...kinds].join(',')}${c.vs ? `, 팀별 기록 ${Object.keys(c.vs.t).length}팀` : ''}`);
  }
  // 옛 저장: 오늘의 목표·출석 칸이 없는 육성 저장
  Object.assign(NEWC, { name:'옛선수', pit:false, pos:'SS', type:'power', team:'star' });
  const L = careerNew(); delete L.career.daily; delete L.career.att; delete L.career.camp; setLG(L);
  const st = careerStatus(L), H = careerHome();
  if(!H.opts.some(o => o.n === 10) || st.some(bad)) fail('옛 저장: 10번 선택지나 상태 줄');
  console.log('옛 저장 통과');
}

if(errs.length){ console.log('오류:\n' + errs.join('\n')); process.exit(1); }
console.log('화면 없이 시험 통과');
if(process.argv.includes('--node')) process.exit(0);

/* ---------- 2) 화면 (Playwright) ---------- */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const root = path.join(__dirname, '..', '..'), PORT = 9100 + Math.floor(Math.random() * 800);
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', root], { stdio:'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch();
  const E = [];
  try{
    for(const [name, w, h] of [['휴대폰', 390, 844], ['작은 휴대폰', 375, 667], ['가로', 844, 390], ['태블릿', 820, 1180]]){
      const ctx = await browser.newContext({ viewport:{ width:w, height:h }, hasTouch:true });
      const page = await ctx.newPage(), tag = `화면(${name})`;
      page.on('pageerror', e => E.push(`${tag}: ${e.message}`));
      page.on('console', m => { if(m.type() === 'error' || m.type() === 'warning') E.push(`${tag} console: ${m.text()}`); });
      page.setDefaultTimeout(5000);
      await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForSelector('#opts .opt'); await page.keyboard.press('1');
      const fit = async where => { await page.waitForTimeout(250); const o = await page.evaluate(() => { const b = document.querySelector('#skBody'); return [b.className, b.scrollHeight > b.clientHeight + 1, document.documentElement.scrollWidth > innerWidth + 1]; }); if(o[1] || o[2] || /scroll/.test(o[0])) E.push(`${tag} ${where}: 한 화면을 넘침 ${o[0]}`); };
      const need = async (sel, where) => { if(!(await page.$(sel))) E.push(`${tag} ${where}: ${sel} 없음 (${await page.evaluate(() => UI.S && UI.S.q)})`); };
      const shot = async n => { if(process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, `${name}-${n}.png`) }); };
      // 육성: 1군 타자로 9일 진행해 신문이 오게 함
      await page.evaluate(() => { LSRC = 'career'; NEWC.name = '시험'; NEWC.pit = false; NEWC.pos = 'SS'; NEWC.type = BAT_TYPES[0].key; NEWC.face = 3; NEW.a = TEAMS[1].key; NEW.len = 36; NEW.mode = 'detail'; NEWC.team = NEW.a; setLG(careerNew()); leagueNews(LG());
        const L = LG(); delete L.career.camp; for(let i = 0; i < 8; i++) leagueAdvance(L, null); L.career.event = null; delete L.career.offer; saveLeague(); go(careerHome, 'click'); });
      await need('.dly .dly-g', '라커룸 목표 띠'); await need('.dly .dly-p.new', '라커룸 신문'); await fit('라커룸'); await shot('1-locker');
      await page.click('.dly-g'); await need('.dl-ss .dl-s', '출석 카드');
      if(!(await page.evaluate(() => UI.S.kind === 'dl-home'))) E.push(`${tag}: 출석 화면이 아님`);
      await fit('출석 화면'); await page.click('.k-dl-home .hb-b.pri');
      const at = await page.evaluate(() => [CR().career.att.total, document.querySelectorAll('.dl-s.on').length, !!document.querySelector('.toast')]);
      if(at[0] !== 1 || at[1] !== 1 || !at[2]) E.push(`${tag}: 도장 찍기 ${at}`);
      await fit('도장 찍은 뒤'); await shot('2-stamp');
      if(await page.$('.k-dl-home .hb-b.pri')) E.push(`${tag}: 찍은 뒤에도 도장 단추가 있음`);
      await page.click('.k-dl-home .hb-b');
      if(!(await page.evaluate(() => UI.S.kind === 'cr-home'))) E.push(`${tag}: 라커룸으로 돌아가지 않음`);
      // 훈련으로 목표 하나
      const trained = await page.evaluate(() => { const L = CR(); const D = dailyEnsure(L); const out = trainDay(L, 'con', '타격'); saveLeague(); go(careerHome, 'click', out); return [D.goals.some(g => g.id === 'train'), D.goals.find(g => g.id === 'train')?.done]; });
      if(trained[0] && !trained[1]) E.push(`${tag}: 훈련 목표가 이뤄지지 않음`);
      await need('.dly-c i', '목표 칩'); await fit('훈련 뒤 라커룸');
      // 신문
      await page.click('.dly-p'); await need('.pp-paper .pp-mast', '신문'); await need('.pp-mv .crf', '신문 얼굴');
      if(!(await page.evaluate(() => UI.S.kind === 'pp-show' && LG().paper[0].read))) E.push(`${tag}: 신문을 읽음으로 바꾸지 않음`);
      await fit('신문'); await shot('3-paper');
      let pages = 1;
      for(; pages < 8 && await page.evaluate(() => { const b = document.querySelector('.pp-paper .pg-nav:not([hidden]) .pg-b[data-d="1"]'); return !!b && !b.disabled; }); pages++){ await page.click('.pp-paper .pg-b[data-d="1"]'); await fit(`신문 ${pages + 1}쪽`); await shot(`3-paper${pages + 1}`); }
      await page.click('.k-pp-show .hb-b:last-child');
      if(!(await page.evaluate(() => UI.S.kind === 'cr-home'))) E.push(`${tag}: 신문에서 라커룸으로 돌아가지 않음`);
      // 경기 고르기: 상대 전적
      await page.evaluate(() => go(() => careerGameChoice(false), 'click')); await need('.vs-hh', '경기 고르기 상대 전적'); await fit('경기 고르기');
      // 맞대결 전적 표 (육성)
      await page.evaluate(() => go(() => h2hScreen(standScreen), 'click')); await need('.tbl table', '맞대결 표'); await fit('맞대결 표(육성)'); await shot('4-h2h');
      // 리그 첫 화면: 신문 띠와 상대 전적
      await page.evaluate(() => { LSRC = 'league'; const L = leagueNew({ my:'star', len:18, mode:'manager', inn:9, seed:7 }); setLG(L); for(let i = 0; i < 7; i++) leagueAdvance(L, null); saveLeague(); go(leagueHome, 'click'); });
      await need('.pp-ban.new', '리그 첫 화면 신문 띠'); await need('.lh-h2h', '리그 첫 화면 상대 전적'); await fit('리그 첫 화면'); await shot('5-league');
      const lhText = await page.evaluate(() => UI.S.note.join(' '));
      if(!/상대 전적|첫 맞대결/.test(lhText) || !/신문이 왔습니다/.test(lhText)) E.push(`${tag}: 리그 상태 글에 상대 전적·신문 없음`);
      await page.click('.pp-ban'); await need('.pp-paper', '리그 신문'); await fit('리그 신문');
      await page.evaluate(() => go(standScreen, 'click')); await page.click('#sk [data-sk="opt"][data-n="2"]');
      if(!(await page.evaluate(() => UI.S.skTitle === '맞대결 전적'))) E.push(`${tag}: 순위표에서 맞대결 전적으로 가지 않음`);
      await need('.tbl table', '리그 맞대결 표'); await fit('맞대결 표(리그)');
      const title = await page.$eval('#skTop .ttl', e => e.textContent); if(title !== '맞대결 전적') E.push(`${tag}: 제목 ${title}`);
      console.log(`${tag}: 라커룸 띠·출석 도장·신문(${pages}쪽)·상대 전적·맞대결 표 확인`);
      await ctx.close();
    }
    // 소리와 글로 하기: 번호 키로 출석 도장과 신문
    {
      const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
      const page = await ctx.newPage(), tag = '소리와 글';
      page.on('pageerror', e => E.push(`${tag}: ${e.message}`));
      await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForSelector('#opts .opt'); await page.keyboard.press('2');
      await page.evaluate(() => { LSRC = 'career'; NEWC.name = '시험'; NEWC.pit = true; NEWC.role = 'sp'; NEWC.type = PIT_TYPES[0].key; NEW.a = TEAMS[1].key; NEW.len = 36; NEW.mode = 'detail'; NEWC.team = NEW.a; setLG(careerNew()); leagueNews(LG());
        const L = LG(); delete L.career.camp; for(let i = 0; i < 7; i++) leagueAdvance(L, null); L.career.event = null; saveLeague(); go(careerHome, 'click'); });
      const note = await page.evaluate(() => UI.S.note.join(' '));
      if(!/오늘의 목표/.test(note) || !/출석 도장/.test(note) || !/신문이 왔습니다/.test(note)) E.push(`${tag}: 육성 상태 글 ${note.slice(-200)}`);
      const opt = await page.$$eval('#opts .opt', els => els.map(e => e.dataset.n));
      if(!opt.includes('10') || !opt.includes('11')) E.push(`${tag}: 10·11번 선택지 없음 (${opt})`);
      await page.fill('#cmd', '10'); await page.press('#cmd', 'Enter');
      if(!(await page.evaluate(() => UI.S.kind === 'dl-home'))) E.push(`${tag}: 10번으로 출석 화면에 가지 않음`);
      await page.keyboard.press('1');
      const said = await page.evaluate(() => [UI.S.say.map(l => l.s || l).join(' '), CR().career.att.total]);
      if(said[1] !== 1 || !/출석 도장 1번째 칸/.test(said[0]) || !/목표 1/.test(said[0])) E.push(`${tag}: 도장 글 ${said}`);
      await page.keyboard.press('9');
      await page.fill('#cmd', '11'); await page.press('#cmd', 'Enter');
      const paper = await page.evaluate(() => [UI.S.kind, (UI.S.say || []).map(l => l.s || l).join(' ')]);
      if(paper[0] !== 'pp-show' || !/이주의 타자/.test(paper[1]) || !/머리기사/.test(paper[1])) E.push(`${tag}: 신문 글 ${paper[1].slice(0, 120)}`);
      console.log(`${tag}: 상태 글·10번 출석·11번 신문 읽기 확인`);
      await ctx.close();
    }
  } catch(e){ E.push(`시험 중단: ${e.message.split('\n')[0]}`); } finally { await browser.close(); srv.kill(); }
  if(E.length){ console.log('화면 오류:\n' + E.join('\n')); process.exit(1); }
  console.log('화면 시험 통과');
})();
