// 시상식·업적 배지·트로피 진열장 시험
// 1) 화면 없이(Node): 골든글러브, 배지 주기(처음만 참), 상태로 배지 살피기(육성·리그), 훈련 100번, 트로피 목록
// 2) Playwright: 화면 보며 하기(휴대폰·작은 휴대폰·가로·태블릿)와 소리와 글로 하기에서
//    시즌이 끝나면 시상식이 한 번 나오고(다음 상·건너뛰기), 진열장(트로피·배지 탭, 눌러서 설명)과 새 배지 알림이 나오는지, 한 화면을 넘지 않는지
// 사용법: node baseball/tests/awards.js [그림 저장 폴더]
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'js');
const errors = [];

/* ---------- 1) 화면 없이 ---------- */
{
  globalThis.document = { documentElement:{ classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } }, dataset:{} }, querySelector(){ return null; }, addEventListener(){}, baseURI:'http://x/' };
  globalThis.location = { search:'', hostname:'localhost' };
  ['util.js', 'data.js', 'engine.js', 'playsim.js', 'timeline.js', 'ai.js', 'league.js'].forEach(f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }));
  vm.runInThisContext(`
  var LSRC = 'career', STORE = { L:null }, NEW = { len:18, mode:'simple', kind:'career' };
  function LG(){ return STORE.L; } function setLG(L){ STORE.L = L; } function saveLeague(){}
  function leagueNews(L){ const n = L.newsRead || 0; L.newsRead = L.news.length; return L.news.slice(n); }
  function go(){} function stay(){} function playFx(){} function speak(){} function openDlg(){} function note(){}
  const myRank = L => standings(L).find(x => x.T.key === L.my); function loadSaved(){ return null; } function batLine(p){ return p.name; } function pitLine(p){ return p.name; }
  `);
  ['career-grow.js', 'career.js', 'career-life.js', 'career-story.js', 'career-trust.js', 'badges.js'].forEach(f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }));
  const E = m => errors.push('[계산] ' + m);
  // 리그: 시즌 끝 → 골든글러브 10명, 우리 팀 배지
  const L = leagueNew({ my:'star', len:18, mode:'manager', inn:9, seed:11 });
  let d = 0; while(L.phase !== 'done' && d++ < 1000) leagueAdvance(L, null);
  const gg = (L.awards && L.awards.gg) || [];
  if(gg.length !== 10) E(`골든글러브가 10명이 아님: ${gg.length}`);
  if(new Set(gg.map(g => g.id)).size !== gg.length) E('골든글러브에 같은 선수가 두 번');
  if(gg.length && !(findPlayer(L, gg[0].id).p.awards || []).some(a => /골든글러브$/.test(a))) E('골든글러브 수상이 선수 수상 목록에 없음');
  L.my = L.champ; badgeCheck(L);
  if(!(L.badges || {}).champ) E('리그 우승 팀이 우승 배지를 받지 못함');
  if(badgeGive(L, 'champ')) E('같은 배지를 두 번 줌');
  if(badgeGive(L, 'h1')) E('리그에서 육성 전용 배지(첫 안타)를 줌');
  if(badgeGive(L, 'nothing')) E('없는 배지를 줌');
  const tl = trophyList(L);
  if(!tl.some(t => t.key === '한국시리즈 우승' && t.n === 1)) E('리그 진열장에 우승 트로피가 없음');
  const before = Object.keys(L.badges).length;
  leagueNextSeason(L); badgeCheck(L);
  if(Object.keys(L.badges).length < before) E('다음 시즌에 배지가 사라짐');
  if(!trophyList(L).some(t => t.key === '한국시리즈 우승')) E('지난 시즌 우승 트로피가 역대 기록에서 빠짐');
  // 육성: 새 선수 → 배지 상태 살피기
  Object.assign(NEWC, { name:'배지선수', pit:false, pos:'SS', type:'power', role:'sp', team:'whale' });
  const K = careerNew(); K.rng = 9; setLG(K);
  const c = K.career, p = myP(K);
  BADGE_Q.length = 0;
  if(badgeCheck(K) !== 0) E('새 선수가 시작부터 배지를 받음 ' + JSON.stringify(c.badges));
  p.ss = { h:1, hr:1 }; c.fame = 1000; c.money = RICH_MONEY; c.att = { total:7 };
  badgeCheck(K);
  ['h1', 'hr1', 'fame1000', 'rich', 'att7'].forEach(id => { if(!c.badges[id]) E(`육성 배지 ${id}를 받지 못함`); });
  if(c.badges.att30) E('출석 7일인데 30일 배지를 받음');
  if(BADGE_Q.length !== 5) E(`알림을 기다리는 배지 수가 다름: ${BADGE_Q.length}`);
  for(let i = 0; i < 100; i++){ c.trained = -1; trainDay(K, 'con', '컨택'); c.fatigue = 0; }
  if(c.trainN !== 100 || !c.badges.train100) E(`훈련 100번에 훈련왕을 받지 못함 (${c.trainN})`);
  badgeGame(K, { bat:null, used:true, st:{ k:11 } }, { decision:{} }, false);
  if(!c.badges.k10) E('한 경기 삼진 10개 배지를 받지 못함');
  c.ach.push({ season: K.season, day: 3, text:'배지선수, 1군에 올라왔습니다!' }); badgeCheck(K);
  if(!c.badges.up || c.badges.up.day !== 3) E('1군 승격 배지의 날짜가 업적 날짜가 아님');
  (p.awards ||= []).push(`${K.season}시즌 MVP`, `${K.season}시즌 골든글러브`); badgeCheck(K);
  if(!c.badges.mvp || !c.badges.gg) E('수상 목록으로 MVP·골든글러브 배지를 받지 못함');
  if(!trophyList(K).some(t => t.key === 'MVP')) E('육성 진열장에 MVP 트로피가 없음');
  if(BADGES.length !== 24 || new Set(BADGES.map(b => b.id)).size !== 24) E('배지가 24개가 아님');
  console.log(`[계산] 골든글러브 ${gg.map(g => `${g.pos} ${g.name}`).join(', ')}`);
  console.log(`[계산] 리그 배지 ${Object.keys(L.badges).join(', ')} / 육성 배지 ${Object.keys(c.badges).length}개`);
}

/* ---------- 2) 화면 ---------- */
(async () => {
  const { chromium } = require('playwright');
  const { spawn } = require('child_process');
  const root = path.join(__dirname, '..', '..'), PORT = 8840 + process.pid % 150, shots = process.argv[2] || null;
  if(shots) fs.mkdirSync(shots, { recursive:true });
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', root], { stdio:'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch();
  const open = async (view, w, h, tag) => {
    const ctx = await browser.newContext({ viewport:{ width:w, height:h }, hasTouch: view === 'gfx' });
    await ctx.addInitScript(v => { try{ if(!localStorage.getItem('bb_set')) localStorage.setItem('bb_set', JSON.stringify({ view: v })); }catch(e){} }, view);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${tag}: ${e.message}`));
    page.on('console', m => { if(m.type() === 'error' || m.type() === 'warning') errors.push(`${tag} console: ${m.text()}`); });
    await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForFunction(() => typeof UI !== 'undefined' && UI.S && typeof cabinetOpen === 'function');
    return { ctx, page };
  };
  const shot = async (page, name) => { if(shots) await page.screenshot({ path: path.join(shots, name + '.png') }); };
  // 시즌을 끝까지 진행한 리그 (우리 팀이 우승하도록 내 팀을 우승 팀으로)
  const doneLeague = page => page.evaluate(() => { LSRC = 'league'; const L = leagueNew({ my:'star', len:18, mode:'manager', inn:9, seed:21 }); while(L.phase !== 'done') leagueAdvance(L, null); L.my = L.champ; setLG(L); saveLeague(); });
  const doneCareer = page => page.evaluate(() => {
    LSRC = 'career'; NEWC.name = '시상식'; NEWC.pit = false; NEWC.pos = 'SS'; NEWC.type = BAT_TYPES[1].key; NEWC.face = 3; NEW.a = TEAMS[1].key; NEW.len = 18; NEW.mode = 'detail'; NEWC.team = NEW.a;
    const L = careerNew(); leagueNews(L); setLG(L); L.career.event = null; L.career.camp = 0;
    while(L.phase !== 'done') leagueAdvance(L, null);
    // 내 선수를 MVP로 (얼굴·'내 선수!' 표시 확인)
    const me = L.career.p; L.awards.mvp = { id: me.id, name: me.name, team: L.my }; (me.awards ||= []).push(`${L.season}시즌 MVP`);
    saveLeague();
  });
  const fit = async (page, tag, where) => {
    await page.waitForTimeout(200);
    const o = await page.evaluate(() => { const b = document.querySelector('#skBody'); return [b.className, b.scrollHeight > b.clientHeight + 1, document.documentElement.scrollWidth > innerWidth + 1, document.documentElement.scrollHeight > innerHeight + 1]; });
    if(o[1] || o[2] || o[3] || /scroll/.test(o[0])) errors.push(`${tag} ${where}: 한 화면을 넘침 ${o.join(' ')}`);
  };
  const kind = page => page.evaluate(() => UI.S.kind || '');

  /* 화면 보며 하기 */
  for(const [name, w, h] of [['휴대폰', 390, 844], ['작은 휴대폰', 375, 667], ['가로', 844, 390], ['태블릿', 820, 1180]]){
    const tag = `화면(${name})`, { ctx, page } = await open('gfx', w, h, tag);
    // 리그 시상식
    await doneLeague(page); await page.evaluate(() => go(leagueHome, 'click'));
    if(await kind(page) !== 'cr-award') errors.push(`${tag}: 시즌이 끝났는데 시상식이 나오지 않음 (${await kind(page)})`);
    await page.waitForSelector('.aws .aw-hero .emb'); await fit(page, tag, '시상식 우승 팀'); await shot(page, `${name}-시상식-우승`);
    const n = await page.evaluate(() => UI.S.n);
    await page.click('#sk [data-sk="opt"][data-n="1"]');
    await page.waitForFunction(() => { const f = document.querySelector('.aw-hero .crf'); return f && /url\("?data:/.test(f.style.backgroundImage); }, null, { timeout:5000 }).catch(() => errors.push(`${tag}: MVP 얼굴 그림이 없음`));
    await page.waitForTimeout(600); await shot(page, `${name}-시상식-MVP`); await fit(page, tag, '시상식 MVP');
    let steps = 1;
    for(; steps < 40 && await kind(page) === 'cr-award'; steps++){
      if(await page.evaluate(() => UI.S.step.key === 'gg')){ await page.waitForTimeout(400); await fit(page, tag, '골든글러브'); await shot(page, `${name}-시상식-골든글러브`); if((await page.$$('.aw-gg > span')).length !== 10) errors.push(`${tag}: 골든글러브 칸이 10개가 아님`); }
      await page.click('#sk [data-sk="opt"][data-n="1"]');
    }
    if(steps !== n) errors.push(`${tag}: 시상 단계 수가 다름 ${steps} / ${n}`);
    if(await kind(page) !== 'lg-home') errors.push(`${tag}: 시상식 뒤 리그 첫 화면이 아님 (${await kind(page)})`);
    if(!(await page.evaluate(() => LG().awShow === LG().season))) errors.push(`${tag}: 시상식을 본 것을 기억하지 않음`);
    await page.evaluate(() => go(leagueHome, 'click'));
    if(await kind(page) === 'cr-award') errors.push(`${tag}: 시상식이 두 번 나옴`);
    // 우리 팀 우승 배지 알림 띠 (시즌을 넘겨 처음 들어왔을 때)
    // 기록실 → 트로피 진열장
    await page.evaluate(() => go(archiveScreen, 'click')); await fit(page, tag, '기록실');
    await page.click('#sk [data-sk="opt"][data-n="8"]');
    if(await kind(page) !== 'cr-cabinet') errors.push(`${tag}: 기록실에서 진열장으로 가지 않음 (${await kind(page)})`);
    if(!(await page.$('.cab .shf .cab-i .tro'))) errors.push(`${tag}: 진열장에 우승 트로피가 없음`);
    await fit(page, tag, '진열장 트로피'); await shot(page, `${name}-진열장-리그`);
    await page.click('.cab-tabs [data-v="bdg"]');
    const bd = await page.evaluate(() => [document.querySelectorAll('.cab .cab-i').length, document.querySelectorAll('.cab .cab-i:not(.off)').length, Object.keys(LG().badges || {}).length]);
    if(bd[0] !== 12) errors.push(`${tag}: 리그 배지 칸이 12개가 아님 (${bd[0]})`);
    if(bd[1] !== bd[2] || !bd[1]) errors.push(`${tag}: 받은 배지 수가 다름 ${bd.join('/')}`);
    await page.click('.cab .cab-i:not(.off)');
    if(!/받음/.test(await page.$eval('.cab-dt', e => e.textContent))) errors.push(`${tag}: 배지를 눌러도 받은 날이 나오지 않음`);
    await fit(page, tag, '진열장 배지'); await shot(page, `${name}-진열장-배지`);
    // 시상식 다시 보기 → 진열장으로 돌아옴
    await page.click('#sk [data-sk="opt"][data-n="2"]');
    if(await kind(page) !== 'cr-award') errors.push(`${tag}: 시상식 다시 보기가 안 됨`);
    await page.click('#sk [data-sk="opt"][data-n="2"]');
    if(await kind(page) !== 'cr-cabinet') errors.push(`${tag}: 다시 본 시상식을 건너뛰면 진열장으로 돌아오지 않음 (${await kind(page)})`);
    await page.click('#sk [data-sk="opt"][data-n="1"]');
    if(await kind(page) !== 'ar-home') errors.push(`${tag}: 진열장에서 기록실로 돌아가지 않음`);
    // 육성: 시상식(내 선수 MVP) → 건너뛰기 → 라커룸 진열장 단추 → 진열장
    await doneCareer(page); await page.evaluate(() => go(careerHome, 'click'));
    if(await kind(page) !== 'cr-award') errors.push(`${tag}: 육성 시즌 끝에 시상식이 나오지 않음 (${await kind(page)})`);
    await page.click('#sk [data-sk="opt"][data-n="1"]');
    if(!(await page.$('.aw-mine'))) errors.push(`${tag}: 내 선수 MVP에 '내 선수!' 표시가 없음`);
    await page.click('#sk [data-sk="opt"][data-n="2"]');
    if(await kind(page) !== 'cr-home') errors.push(`${tag}: 시상식을 건너뛰면 라커룸이 아님 (${await kind(page)})`);
    if(!(await page.isVisible('#bdgToast'))) errors.push(`${tag}: 새 배지(MVP) 알림 띠가 보이지 않음`);
    else if(!/MVP/.test(await page.$eval('#bdgToast', e => e.textContent))) errors.push(`${tag}: 알림 띠에 MVP 배지가 없음`);
    await shot(page, `${name}-배지-알림`);
    await fit(page, tag, '라커룸');
    const cab = await page.$('.hb.sm [data-sk="opt"][data-n="12"]');
    if(!cab) errors.push(`${tag}: 라커룸에 진열장 단추가 없음`); else await cab.click();
    if(await kind(page) !== 'cr-cabinet') errors.push(`${tag}: 라커룸에서 진열장으로 가지 않음`);
    await page.waitForTimeout(300); await fit(page, tag, '육성 진열장'); await shot(page, `${name}-진열장-육성`);
    await page.click('.cab .cab-i');
    if(!/MVP/.test(await page.$eval('.cab-dt', e => e.textContent))) errors.push(`${tag}: 트로피를 눌러도 MVP 설명이 없음`);
    await page.click('.cab-tabs [data-v="bdg"]');
    const cb = await page.evaluate(() => [document.querySelectorAll('.cab .cab-i').length, document.querySelectorAll('.cab .cab-i.off').length, Object.keys(CR().career.badges || {}).length]);
    if(cb[0] !== 24 || cb[0] - cb[1] !== cb[2]) errors.push(`${tag}: 육성 배지 칸 수가 다름 ${cb.join('/')}`);
    await page.click('.cab .cab-i.off'); if(!/아직 못 받음/.test(await page.$eval('.cab-dt', e => e.textContent))) errors.push(`${tag}: 못 받은 배지 설명이 없음`);
    await shot(page, `${name}-진열장-육성-배지`);
    console.log(`${tag}: 시상식 ${n}단계, 리그 진열장 배지 ${bd[1]}/12, 육성 배지 ${cb[2]}/24`);
    await ctx.close();
  }

  /* 소리와 글로 하기: 번호 키로 시상식·진열장, 새 배지는 결과 글 한 줄 */
  {
    const tag = '소리와 글', { ctx, page } = await open('a11y', 390, 844, tag);
    const q = () => page.$eval('#q', e => e.textContent);
    await doneLeague(page); await page.evaluate(() => go(leagueHome, 'click'));
    if(!/시상식입니다/.test(await q())) errors.push(`${tag}: 시상식 첫 질문이 아님: ${await q()}`);
    if(!/한국시리즈 우승/.test(await q())) errors.push(`${tag}: 우승 팀을 읽지 않음`);
    const said = [];
    for(let i = 0; i < 40 && await kind(page) === 'cr-award'; i++){ said.push(await q()); await page.keyboard.press('1'); }
    if(!said.some(s => /정규 시즌 MVP/.test(s)) || !said.some(s => /골든글러브/.test(s))) errors.push(`${tag}: 시상 글에 MVP·골든글러브가 없음`);
    if(await kind(page) !== 'lg-home') errors.push(`${tag}: 시상식 뒤 리그 첫 화면이 아님`);
    const say = await page.$eval('#say', e => e.innerText);
    if(!/시상식을 마쳤습니다/.test(say)) errors.push(`${tag}: 마친 글이 없음`);
    // 건너뛰기
    await page.evaluate(() => { LG().awShow = 0; go(leagueHome, 'click'); }); await page.keyboard.press('2');
    if(await kind(page) !== 'lg-home' || !/건너뛰었습니다/.test(await page.$eval('#say', e => e.innerText))) errors.push(`${tag}: 건너뛰기가 안 됨`);
    // 기록실 8번 → 진열장 글
    await page.evaluate(() => go(archiveScreen, 'click')); await page.keyboard.press('8');
    const cabSay = await page.$eval('#say', e => e.innerText);
    if(!/트로피\./.test(cabSay) || !/받은 배지 \d+개, 모두 12개/.test(cabSay)) errors.push(`${tag}: 진열장 글이 다름: ${cabSay.slice(0, 80)}`);
    // 새 배지는 결과 글 한 줄
    await doneCareer(page); await page.evaluate(() => { LG().awShow = LG().season; saveLeague(); go(careerHome, 'click'); });
    const cs = await page.$eval('#say', e => e.innerText);
    if(!/배지를 받았습니다! MVP/.test(cs)) errors.push(`${tag}: 새 배지 글이 없음: ${cs.slice(0, 80)}`);
    if(await page.$('#bdgToast')) errors.push(`${tag}: 소리와 글로 하기에 알림 띠가 나옴`);
    // 육성 첫 화면 10·11번은 오늘의 목표·신문(daily.js), 12번이 진열장
    const ten = await page.evaluate(() => (UI.S.opts.find(o => o.n === 12) || {}).t);
    if(ten !== '트로피 진열장') errors.push(`${tag}: 육성 첫 화면 12번이 진열장이 아님`);
    await page.fill('#cmd', '12'); await page.press('#cmd', 'Enter');
    if(!/트로피 진열장입니다/.test(await q())) errors.push(`${tag}: 명령 칸 12로 진열장에 가지 않음: ${await q()}`);
    console.log(`${tag}: 시상 ${said.length}단계를 번호 키로, 건너뛰기, 진열장 글, 배지 글 확인`);
    await ctx.close();
  }
  await browser.close(); srv.kill();
  if(errors.length){ console.log('오류:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
  console.log('오류 없음');
})().catch(e => { console.error(e); process.exit(1); });
