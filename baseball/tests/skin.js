// 화면 보며 하기(비장애인 모드) 새 화면(js/skin.js) 시험: 휴대폰·작은 휴대폰·가로·태블릿에서
// 정밀 수비는 한 화면에서 코스·세기를 누르고 던지기, 공격은 타이밍 맞춰 치기로 경기를 끝까지 하고, 화면 넘침·스크립트 오류·점수표 창을 확인함.
// 사용법: node baseball/tests/skin.js
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const PORT = 8767;

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', root], { stdio:'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch();
  const errors = [];
  const shots = null;
  const q = page => page.$eval('#q', e => e.textContent);
  const opts = page => page.$$eval('#opts .opt', els => els.map(e => ({ n: e.dataset.n, t: e.querySelector('b').textContent })));
  // 선택지 누르기: 화면 보며 하기(새 화면)는 새 단추를, 정밀 수비 한 화면은 코스 칸을 누르고 던지기
  const clickOpt = async (page, n) => {
    const skin = await page.evaluate(() => document.documentElement.classList.contains('skin'));
    if(!skin) return page.click(`#opts .opt[data-n="${n}"]`);
    if(await page.isVisible('#skSheet .gb')) await page.click('#skSheet .gb');
    const sel = `#sk [data-sk="opt"][data-n="${n}"]`;
    if(await page.$(sel) && await page.isVisible(sel)) return page.click(sel);
    if(await page.$('#sk [data-sk="throw"]') && Math.random() < 0.7){
      const zs = await page.$$('#sk [data-sk="z"]');
      if(zs.length) await zs[Math.floor(Math.random() * zs.length)].click();
      const pts = await page.$$('#sk [data-sk="pt"]'); if(pts.length) await pts[Math.floor(Math.random() * pts.length)].click();
      return page.click('#sk [data-sk="throw"]');
    }
    return page.keyboard.press(String(n));
  };
  const noOverflow = async (page, where) => {
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    if(w[0] > w[1] + 1) errors.push(`${where}: 가로로 넘침 ${w[0]} > ${w[1]}`);
    // 화면 보며 하기의 경기 화면은 세로로도 넘치면 안 됨 (한 화면에서 다 고름)
    const v = await page.evaluate(() => [document.documentElement.classList.contains('gfxgame'), document.documentElement.scrollHeight, innerHeight, (() => { const o = [...document.querySelectorAll('#opts .opt')].pop(); return o ? Math.round(o.getBoundingClientRect().bottom) : 0; })()]);
    if(v[0] && (v[1] > v[2] + 1 || v[3] > v[2] + 1)) errors.push(`${where}: 그림 모드 경기 화면이 한 화면을 넘침 ${v[1]}/${v[3]} > ${v[2]}`);
    const sk = await page.evaluate(() => document.documentElement.classList.contains('skin') ? [document.documentElement.scrollHeight, innerHeight, document.documentElement.scrollWidth, innerWidth] : null);
    if(sk && (sk[0] > sk[1] + 1 || sk[2] > sk[3] + 1)) errors.push(`${where}: 화면 보며 하기 화면이 한 화면을 넘침 ${sk.join('/')}`);
  };
  // 화면 보며 하기 새 화면: 정밀 수비는 한 화면에서 구종·코스·세기를 누르고 던지기, 공격은 타이밍 맞춰 치기로 끝까지
  for(const [name, w, h] of [['휴대폰', 390, 844], ['작은 휴대폰', 375, 667], ['가로', 844, 390], ['태블릿', 820, 1180]]){
    const ctx = await browser.newContext({ viewport:{ width:w, height:h }, hasTouch:true });
    const page = await ctx.newPage(), tag = `새 화면(${name})`;
    page.on('pageerror', e => errors.push(`${tag}: ${e.message}`));
    page.on('console', m => { if(m.type() === 'error') errors.push(`${tag} console: ${m.text()}`); });
    await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForSelector('#opts .opt'); await page.keyboard.press('1');
    await page.waitForSelector('#sk .card'); await noOverflow(page, tag + ' 처음');
    await page.evaluate(() => { SET.timing = true; SET.picks = { pt:true, loc:'full', edge:true, pow:true, bat:'full', guess:true }; startGame({ mode:'detail', unit:'pa', innings:1, teams:[TEAMS[2].key, TEAMS[5].key], ctrl:['human', 'cpu'], who:['', ''], diff:1, easy:1, seed:77 }, 'click'); });
    let throws = 0, swings = 0, perfect = 0, steps = 0;
    for(; steps < 600; steps++){
      const st = await page.evaluate(() => ({ over: G.over, kind: UI.S.kind || '', q: UI.S.q, tm: !!SK.tm }));
      if(st.over) break;
      if(st.kind === 'pitch'){
        const zs = await page.$$('#sk [data-sk="z"]'); await zs[Math.floor(Math.random() * zs.length)].click();
        const pw = await page.$$('#sk [data-sk="pw"]'); if(pw.length) await pw[Math.floor(Math.random() * pw.length)].click();
        if(!(await page.isVisible('#sk [data-sk="throw"]'))) errors.push(`${tag}: 던지기 단추가 화면에 보이지 않음`);
        await page.click('#sk [data-sk="throw"]'); throws++;
      } else if(st.kind === 'bat'){
        const bats = await page.$$('#sk [data-sk="bat"]');
        if(bats.length && Math.random() < 0.8){
          const seq0 = await page.evaluate(() => G.seq);
          await bats[Math.floor(Math.random() * bats.length)].click();
          // 컴퓨터가 고의 볼넷을 고르면 타이밍 없이 바로 진행됨
          await page.waitForFunction(s0 => !!SK.tm || G.seq !== s0 || G.over, seq0, { timeout:8000 });
          if(!(await page.evaluate(() => !!SK.tm))) continue;
          // 공이 동그라미에 들어올 때 누르기 (가끔은 누르지 않고 지켜봄)
          const wait = await page.evaluate(() => Math.round((SK.tm.wind + SK.tm.T) * 1000 - (performance.now() - SK.tm.t0)));
          if(Math.random() < 0.85){ const bx = await (await page.$('.tmg-btn')).boundingBox(); await page.waitForTimeout(Math.max(0, wait - 40 + (Math.random() - 0.5) * 120)); await page.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2); swings++; }
          await page.waitForFunction(() => !SK.tm, null, { timeout:8000 });
          const t = await page.evaluate(() => G.log.slice(-6).some(l => /판정 타이밍: 딱 맞음/.test(l.s)));
          if(t) perfect++;
        } else await clickOpt(page, '4');
      } else {
        const os = (await opts(page)).filter(o => !/더 보기|설정|그만하기|처음 화면|자동 재생|경기 기록/.test(o.t));
        if(!os.length){ await page.keyboard.press('.'); continue; }
        await clickOpt(page, os[Math.floor(Math.random() * os.length)].n);
      }
      if(steps === 3){ await noOverflow(page, tag + ' 경기'); }
      // 스크롤 없이 한 화면: 조작판이 스크롤 상태가 되면 안 됨
      if(await page.evaluate(() => { const b = document.querySelector('#skBody'); return b && b.classList.contains('scroll'); })) errors.push(`${tag}: 조작판이 한 화면을 넘침 (${await page.evaluate(() => UI.S.q)})`);
    }
    if(!(await page.evaluate(() => G.over))) errors.push(`${tag}: 600번 안에 끝나지 않음`);
    if(!throws) errors.push(`${tag}: 한 화면 던지기를 한 번도 하지 않음`);
    // 점수표·능력치 창
    await page.click('#sk [data-sk="box"]'); if(!(await page.isVisible('#skSheet .ls'))) errors.push(`${tag}: 점수표 창이 열리지 않음`);
    await page.click('#skSheet .gb');
    console.log(`${tag}: ${steps}번 만에 끝, 던지기 ${throws}번, 타이밍 스윙 ${swings}번(딱 맞음 기록 ${perfect})`);
    await ctx.close();
  }
  // 만들기 화면(화면 보며 하기): 누르면 고르기만 하고 "다음"·"시작"으로 정함. 리그 만들기 한 화면, 선수 만들기 세 단계, 팀 고르기, 온라인 방 설정
  for(const [name, w, h] of [['휴대폰', 390, 844], ['작은 휴대폰', 375, 667], ['가로', 844, 390], ['태블릿', 820, 1180]]){
    const ctx = await browser.newContext({ viewport:{ width:w, height:h }, hasTouch:true });
    const page = await ctx.newPage(), tag = `만들기 화면(${name})`;
    page.on('pageerror', e => errors.push(`${tag}: ${e.message}`));
    page.on('console', m => { if(m.type() === 'error' || m.type() === 'warning') errors.push(`${tag} console: ${m.text()}`); });
    await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForSelector('#opts .opt'); await page.keyboard.press('1');
    const fit = async where => { await page.waitForTimeout(250); const o = await page.evaluate(() => { const b = document.querySelector('#skBody'); return [b.className, b.scrollHeight > b.clientHeight + 1, document.documentElement.scrollWidth > innerWidth + 1]; }); if(o[1] || o[2] || /scroll/.test(o[0])) errors.push(`${tag} ${where}: 한 화면을 넘침 ${o[0]}`); };
    const kind = () => page.evaluate(() => UI.S.kind);
    // 리그 만들기
    await page.evaluate(() => { LSRC = 'league'; setLG(null); go(leagueHome, 'click'); }); await page.click('#sk [data-sk="opt"][data-n="1"]');
    if(await kind() !== 'lg-setup') errors.push(`${tag}: 새 리그 만들기가 한 화면이 아님 ${await kind()}`);
    const t3 = await page.evaluate(() => TEAMS[3].key);
    await page.click(`[data-sk="set"][data-k="a"][data-v="${t3}"]`); await page.click('[data-sk="set"][data-k="len"][data-v="36"]'); await page.click('[data-sk="set"][data-k="inn"][data-v="3"]');
    if(await kind() !== 'lg-setup' || await page.evaluate(() => !!LG())) errors.push(`${tag}: 고르기만 했는데 리그가 만들어짐`);
    await fit('리그 만들기'); await page.click('.su-go');
    const lg = await page.evaluate(() => LG() && [LG().my, LG().inn, LG().teams[LG().my].sched || LG().len]);
    if(!lg || lg[0] !== t3 || lg[1] !== 3) errors.push(`${tag}: 리그 만들기 값이 다름 ${JSON.stringify(lg)}`);
    // 선수 만들기: 이름이 없으면 다음으로 가지 않음
    await page.evaluate(() => { LSRC = 'career'; setLG(null); NEWC.name = ''; NEWC.num = null; go(careerHome, 'click'); }); await page.click('#sk [data-sk="opt"][data-n="1"]');
    if(await kind() !== 'wz-1') errors.push(`${tag}: 선수 만들기 첫 단계가 아님 ${await kind()}`);
    await page.click('.su-go'); if(await kind() !== 'wz-1') errors.push(`${tag}: 이름 없이 다음 단계로 넘어감`);
    await page.click('#skSheet .gb').catch(() => {});
    await page.fill('#wzName', '시험선수'); await page.press('#wzName', 'Enter');
    await page.click('[data-k="pit"][data-v="1"]'); await page.click('[data-k="num"][data-v="10"]'); await page.click('[data-k="num"][data-v="1"]');
    await page.click('[data-k="hand"][data-v="L"]'); await page.click('[data-k="form"][data-v="2"]');
    // 얼굴 꾸미기: 머리 탭 → 곱슬머리, 장식 탭 → 동그란 안경
    await page.click('[data-k="lt"][data-v="hair"]'); await page.click('[data-k="lk"][data-v="6"]'); await page.click('[data-k="lt"][data-v="acc"]'); await page.click('[data-k="lk"][data-v="2"]');
    await page.waitForFunction(() => LK.ok);
    if(!(await page.evaluate(() => /^url\("?data:image/.test(document.querySelector('.wz-card .crf').style.backgroundImage)))) errors.push(`${tag}: 꾸민 얼굴 그림이 없음`);
    await fit('선수 꾸미기');
    await page.click('.su-go'); if(await kind() !== 'wz-2') errors.push(`${tag}: 둘째 단계로 가지 않음`);
    await page.click('[data-k="role"][data-v="rp"]'); await page.click('[data-k="type"][data-v="break"]'); await fit('보직과 유형');
    await page.click('.su-go'); if(await kind() !== 'wz-3') errors.push(`${tag}: 셋째 단계로 가지 않음`);
    const t5 = await page.evaluate(() => TEAMS[5].key);
    await page.click(`[data-sk="set"][data-k="a"][data-v="${t5}"]`); await page.click('[data-sk="set"][data-k="len"][data-v="18"]'); await fit('팀과 시즌');
    if(await page.evaluate(() => !!LG())) errors.push(`${tag}: 입단하기 전에 선수가 만들어짐`);
    await page.click('.su-go');
    const made = await page.evaluate(() => { const L = LG(), c = L && L.career; return c && [c.p.name, c.look && c.look.hair, c.look && c.look.acc, c.num, c.p.hand, c.p.form, c.p.role, c.type, L.my]; });
    if(!made || made.join() !== `시험선수,6,2,18,L,2,불펜,break,${t5}`) errors.push(`${tag}: 선수 만들기 결과가 다름 ${JSON.stringify(made)}`);
    if(await page.evaluate(() => armSlot(CR().career.p)) !== 2) errors.push(`${tag}: 투구 폼이 경기 그림에 쓰이지 않음`);
    // 내 선수 화면에서 얼굴 꾸미기: 고르기만 하면 그대로, "바꾸기"를 눌러야 저장
    await page.evaluate(() => go(careerInfoScreen, 'click')); await page.click('#sk [data-sk="opt"][data-n="3"]');
    if(await kind() !== 'cr-look') errors.push(`${tag}: 얼굴 꾸미기 화면이 아님 ${await kind()}`);
    await page.click('[data-k="lt"][data-v="hat"]'); await page.click('[data-k="lk"][data-v="2"]'); await fit('얼굴 꾸미기');
    if(await page.evaluate(() => CR().career.look.hat) === 2) errors.push(`${tag}: 바꾸기 전에 얼굴이 저장됨`);
    await page.click('.su-go');
    if(await page.evaluate(() => CR().career.look.hat) !== 2 || await kind() !== 'cr-info') errors.push(`${tag}: 얼굴 꾸미기가 저장되지 않음`);
    // 팀 고르기: 눌러서 고른 뒤 "이 팀으로"
    await page.evaluate(() => { NEW.kind = '1p'; go(matchSetupScreen, 'click'); }); await page.click('.su-t >> nth=1');
    if(await kind() !== 'team-pick') errors.push(`${tag}: 팀 고르기 화면이 아님`);
    const t7 = await page.evaluate(() => TEAMS[7].key);
    await page.click(`[data-sk="set"][data-k="pick"][data-v="${t7}"]`); await fit('팀 고르기');
    if(await kind() !== 'team-pick') errors.push(`${tag}: 팀을 누르자마자 넘어감`);
    await page.click('.su-go');
    if(await kind() !== 'setup' || await page.evaluate(() => NEW.b) !== t7) errors.push(`${tag}: 고른 팀이 상대 팀이 되지 않음`);
    // 온라인 방 설정: 한 화면 경기 설정을 쓰고 우리 센터 팀은 빠짐
    await page.evaluate(() => { NEW.kind = 'online'; go(matchSetupScreen, 'click'); });
    const on = await page.evaluate(() => [UI.S.kind, UI.S.opts.find(o => o.key === 'start').t, !!UI.S.opts.find(o => o.key === 'diff' && !o.hide)]);
    if(on.join() !== 'setup,방 만들기,false') errors.push(`${tag}: 온라인 방 설정이 다름 ${on.join()}`); await fit('온라인 방 설정');
    console.log(`${tag}: 리그 만들기·선수 만들기 세 단계·얼굴 꾸미기·팀 고르기·온라인 방 설정 확인`);
    await ctx.close();
  }
  // 선수 육성 화면: 라커룸 → 마을 지도(장소 누르기) → 용품점에서 사기 → 가방에서 장착 → 훈련 → 선수 카드, 화면마다 한 화면에 들어가는지
  for(const [name, w, h] of [['휴대폰', 390, 844], ['작은 휴대폰', 375, 667], ['가로', 844, 390], ['태블릿', 820, 1180]]){
    const ctx = await browser.newContext({ viewport:{ width:w, height:h }, hasTouch:true });
    const page = await ctx.newPage(), tag = `육성 화면(${name})`;
    page.on('pageerror', e => errors.push(`${tag}: ${e.message}`));
    page.on('console', m => { if(m.type() === 'error' || m.type() === 'warning') errors.push(`${tag} console: ${m.text()}`); });
    await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForSelector('#opts .opt'); await page.keyboard.press('1');
    await page.evaluate(() => { LSRC = 'career'; NEWC.name = '시험'; NEWC.pit = false; NEWC.pos = 'SS'; NEWC.type = BAT_TYPES[0].key; NEWC.face = 3; NEW.a = TEAMS[1].key; NEW.len = 36; NEW.mode = 'detail'; NEWC.team = NEW.a; setLG(careerNew()); leagueNews(LG()); const L = LG(); L.career.money = 5000; L.career.event = null; saveLeague(); go(careerHome, 'click'); });
    const fit = async where => { await page.waitForTimeout(250); const o = await page.evaluate(() => { const b = document.querySelector('#skBody'); return [b.className, b.scrollHeight > b.clientHeight + 1, document.documentElement.scrollWidth > innerWidth + 1]; }); if(o[1] || o[2] || /scroll/.test(o[0])) errors.push(`${tag} ${where}: 한 화면을 넘침 ${o[0]}`); };
    const need = async (sel, where) => { if(!(await page.$(sel))) errors.push(`${tag} ${where}: ${sel} 없음 (${await page.evaluate(() => UI.S.q)})`); };
    await need('.lock .pcard', '라커룸'); await need('.crplay', '라커룸'); await fit('라커룸');
    await page.click('.crtiles .ct:nth-child(2)'); await need('.town .spot', '마을'); await fit('마을');
    // 한 화면 용품점: 물건을 누르면 고르기만, 사기 단추로 삼. 소모품도 같은 화면
    await page.click('[data-spot="shop"]'); await need('.ig .ic', '용품점'); await fit('용품점');
    await page.click('.ig .ic:nth-child(2)'); if(await page.evaluate(() => CR().career.owned.length)) errors.push(`${tag}: 물건을 누르자마자 샀음`);
    await page.click('.hb.act .hb-b:nth-child(1)');
    const owned = await page.evaluate(() => CR().career.owned.slice());
    if(!owned.length) errors.push(`${tag}: 용품점에서 산 물건이 없음`);
    const drink0 = await page.evaluate(() => CR().career.goods.drink || 0);
    await page.click('.ig [data-v="drink"]'); await page.click('.hb.act .hb-b:nth-child(1)');
    if(await page.evaluate(() => CR().career.goods.drink || 0) !== drink0 + 1) errors.push(`${tag}: 소모품을 사지 못함`);
    // 인벤토리 가방: 장비와 소모품이 한 칸에, 고른 뒤 장착·쓰기
    await page.evaluate(() => go(careerHome, 'click')); await page.click('.crtiles .ct:nth-child(3)'); await need('.ig.bagi', '가방'); await fit('가방');
    await page.click('.ig.bagi .ic:nth-child(1)'); await page.click('.hb.act .hb-b:nth-child(1)'); const eq = await page.evaluate(() => Object.values(CR().career.equip));
    if(!eq.length) errors.push(`${tag}: 가방에서 장착이 안 됨`);
    await page.evaluate(() => { const L = CR(); myP(L).cond = 0; saveLeague(); go(bagScreen, 'click'); }); await page.click('.ig.bagi [data-v="drink"]'); await page.click('.hb.act .hb-b:nth-child(1)');
    if(await page.evaluate(() => myP(CR()).cond) !== 1) errors.push(`${tag}: 가방에서 소모품을 쓰지 못함`);
    await page.evaluate(() => go(careerHome, 'click')); await page.click('.crtiles .ct:nth-child(1)'); await need('.trt', '훈련'); await fit('훈련');
    await page.click('.trt'); if(!(await page.evaluate(() => /훈련/.test(UI.S.q)))) errors.push(`${tag}: 훈련 장면으로 가지 않음`);
    await page.evaluate(() => go(visitScreen, 'click')); await page.click('[data-spot="house"]'); await page.waitForSelector('#skSheet .card'); await page.click('#skSheet .card');
    if(!(await page.evaluate(() => UI.S.kind === 'cr-bag2'))) errors.push(`${tag}: 내 집에서 가방으로 가지 않음`);
    await page.evaluate(() => go(careerInfoScreen, 'click')); await need('.lock.info', '선수 카드'); await fit('선수 카드');
    await page.evaluate(() => go(() => careerFaceScreen(careerInfoScreen), 'click')); await page.click('.facec:nth-child(5)');
    if(await page.evaluate(() => CR().career.face) !== 4) errors.push(`${tag}: 얼굴 바꾸기가 안 됨`);
    // 이벤트 대화 창 → 고르면 첫 화면으로, 경기 대진 카드, 업적 연표
    await page.evaluate(() => { const L = CR(); L.career.event = 'fan'; saveLeague(); go(careerHome, 'click'); });
    await need('.talk .tk-bub', '이벤트 대화 창'); await fit('이벤트 대화 창');
    const fame0 = await page.evaluate(() => CR().career.fame); await page.click('.tk-o');
    if(await page.evaluate(() => CR().career.fame) <= fame0) errors.push(`${tag}: 이벤트 고르기 결과가 반영되지 않음`);
    await page.evaluate(() => go(() => careerGameChoice(true), 'click')); await need('.vs .vs-row', '대진 카드'); await fit('대진 카드');
    await page.evaluate(() => go(careerLogScreen, 'click')); await need('.tl .tl-h', '업적 연표'); await fit('업적 연표');
    // 스프링캠프: 타일을 누르면 하루가 지나고, 사흘 뒤 라커룸으로
    await page.evaluate(() => { const L = CR(); L.career.camp = 3; L.career.event = null; saveLeague(); go(careerHome, 'click'); });
    await need('.camp', '스프링캠프'); await fit('스프링캠프');
    for(let i = 0; i < 3; i++) await page.click('.trg .trt');
    if(!(await page.evaluate(() => UI.S.kind === 'cr-home' && !CR().career.camp))) errors.push(`${tag}: 캠프 사흘 뒤 라커룸으로 돌아오지 않음`);
    await need('.story', '라커룸 승격 경쟁·라이벌');
    // 은퇴 뒤 감독: 리그 모드로 옮겨 감
    await page.evaluate(() => { const L = CR(); L.career.retired = true; saveLeague(); localStorage.removeItem('bb_league'); LSTORE.league.L = null; becomeManager('click'); });
    if(!(await page.evaluate(() => LSRC === 'league' && LG() && !LG().career && LG().mode === 'manager'))) errors.push(`${tag}: 감독으로 새 출발이 리그 모드로 옮겨지지 않음`);
    console.log(`${tag}: 라커룸·마을·용품점·가방·훈련·선수 카드·얼굴·이벤트·대진·업적·캠프·감독 확인`);
    await ctx.close();
  }
  // 구단 사무실: 화면 보며 하기에서 트레이드를 눌러서 하고, 시즌 끝에 드래프트
  {
    const ctx = await browser.newContext({ viewport:{ width:390, height:844 }, hasTouch:true });
    const page = await ctx.newPage(), tag = '구단 사무실';
    page.on('pageerror', e => errors.push(`${tag}: ${e.message}`));
    await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForSelector('#opts .opt'); await page.keyboard.press('1');
    await page.evaluate(() => { LSRC = 'league'; const L = leagueNew({ my:'star', len:18, mode:'manager', inn:9, seed:7 }); setLG(L); saveLeague(); go(leagueHome, 'click'); });
    await page.click('#sk [data-sk="opt"][data-n="6"]'); await page.waitForSelector('.fo-card');
    await page.click('.fo-b.pri');                                     // 트레이드
    await page.click('#sk [data-sk="opt"][data-n="3"]');               // 내보낼 타자
    await page.click('#sk [data-sk="opt"][data-n="1"]');               // 상대 구단
    const ok = await page.evaluate(() => { const i = (UI.S.opts || []).findIndex(o => /받아들일|해 볼 만/.test(o.s || '')); return i < 0 ? null : UI.S.opts[i].n; });
    if(ok == null) errors.push(`${tag}: 받아들일 만한 트레이드 후보가 없음`);
    else { await page.click(`#sk [data-sk="opt"][data-n="${ok}"]`); await page.waitForSelector('#dlg.open'); await page.click('#dlg [data-dlg="0"]');
      if(!(await page.evaluate(() => LG().office.trades === 1 && UI.S.kind === 'fo-home'))) errors.push(`${tag}: 트레이드가 성사되지 않음 (${await page.evaluate(() => (UI.say || []).map(l => l.s || l).join(' '))})`); }
    await page.evaluate(() => { const L = LG(); while(L.phase !== 'done') leagueAdvance(L, null); saveLeague(); go(officeScreen, 'click'); });
    await page.click('#sk [data-sk="opt"][data-n="4"]'); await page.click('#sk [data-sk="opt"][data-n="1"]'); await page.click('#sk [data-sk="opt"][data-n="10"]');
    if(!(await page.evaluate(() => LG().office.drafted))) errors.push(`${tag}: 드래프트가 되지 않음`);
    const bad = await page.evaluate(() => { const b = document.querySelector('#skBody'); return b.classList.contains('scroll'); }); if(bad) errors.push(`${tag}: 한 화면을 넘침`);
    console.log(`${tag}: 트레이드·드래프트 누르기 확인`);
    await ctx.close();
  }
  // 올스타 휴식기: 시즌 절반에 나오고, 홈런 더비를 끝까지 보고, 올스타전 결과를 보고, 휴식기를 끝냄 (소리와 글로 하기는 번호 키로)
  for(const view of ['1', '2']){
    const ctx = await browser.newContext({ viewport:{ width:390, height:844 }, hasTouch: view === '1' });
    const page = await ctx.newPage(), tag = `올스타(${view === '1' ? '화면' : '소리와 글'})`;
    page.on('pageerror', e => errors.push(`${tag}: ${e.message}`));
    await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForSelector('#opts .opt'); await page.keyboard.press(view);
    await page.evaluate(() => { LSRC = 'league'; const L = leagueNew({ my:'star', len:18, mode:'manager', inn:9, seed:7 }); setLG(L); while(!allstarDue(L)) leagueAdvance(L, null); saveLeague(); go(leagueHome, 'click'); });
    if(!(await page.evaluate(() => UI.S.kind === 'as-home'))) errors.push(`${tag}: 시즌 절반에 올스타 휴식기가 나오지 않음`);
    await page.keyboard.press('1');
    for(let i = 0; i < 80 && !(await page.evaluate(() => !!LG().allstar.derby.champ)); i++) await page.keyboard.press('1');
    if(!(await page.evaluate(() => !!LG().allstar.derby.champ))) errors.push(`${tag}: 홈런 더비가 끝나지 않음`);
    await page.keyboard.press('1'); await page.keyboard.press('3');
    if(!(await page.evaluate(() => !!LG().allstar.game))) errors.push(`${tag}: 올스타전 결과가 없음`);
    await page.keyboard.press('9');
    if(!(await page.evaluate(() => LG().allstar.closed && UI.S.kind !== 'as-home'))) errors.push(`${tag}: 휴식기를 끝내지 못함`);
    if(view === '1' && await page.evaluate(() => document.querySelector('#skBody').classList.contains('scroll'))) errors.push(`${tag}: 한 화면을 넘침`);
    console.log(`${tag}: 휴식기·홈런 더비·올스타전·후반기 확인`);
    await ctx.close();
  }
  // 우리 센터 팀: 소리와 글로 하기에서 번호 키와 명령 칸만으로 팀 이름·선수 이름을 정해 저장하고, 팀 고르기에서 골라 경기를 끝까지
  {
    const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
    const page = await ctx.newPage(), tag = '우리 센터 팀(소리와 글)';
    page.on('pageerror', e => errors.push(`${tag}: ${e.message}`));
    await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForSelector('#opts .opt'); await page.keyboard.press('2');
    const q = () => page.$eval('#q', e => e.textContent), type = async t => { await page.fill('#cmd', t); await page.press('#cmd', 'Enter'); };
    await page.evaluate(() => go(() => centerEdit(v => go(homeScreen, v)), 'click'));
    await page.keyboard.press('1'); await type('손잡다 센터');
    await page.keyboard.press('7'); await page.keyboard.press('1'); await page.keyboard.press('1'); await type('김민수');
    await page.keyboard.press('2'); await type('번개');
    await page.keyboard.press('5'); await type('80'); await page.keyboard.press('9');
    await page.keyboard.press('.'); await page.keyboard.press('.');
    if(!/우리 센터 팀을 만듭니다/.test(await q())) errors.push(`${tag}: 팀 첫 화면으로 돌아오지 않음: ${await q()}`);
    await page.keyboard.press('9');
    const saved = await page.evaluate(() => CENTER && [CENTER.name, CENTER.bat[0].name, CENTER.bat[0].nick, CENTER.bat[0].con]);
    if(!saved || saved.join() !== '손잡다 센터,김민수,번개,80') errors.push(`${tag}: 저장된 값이 다름 ${JSON.stringify(saved)}`);
    await page.evaluate(() => { NEW.kind = '1p'; NEW.mode = 'simple'; NEW.unit = 'pa'; go(() => teamScreen(0), 'click'); });
    const first = await page.$eval('#opts .opt', e => e.textContent);
    if(!/손잡다 센터/.test(first)) errors.push(`${tag}: 팀 고르기 첫째에 우리 팀이 없음: ${first.slice(0, 30)}`);
    await page.keyboard.press('1'); await page.keyboard.press('1');
    for(const k of ['1', '1', '2', '1']) await page.keyboard.press(k);
    for(let i = 0; i < 400 && !(await page.evaluate(() => G && G.over)); i++) await page.keyboard.press(String(1 + Math.floor(Math.random() * 3)));
    const fin = await page.evaluate(() => G && [G.over, G.teams.find(T => T.key === 'center')?.bat[0].name]);
    if(!fin || !fin[0] || fin[1] !== '김민수') errors.push(`${tag}: 우리 팀 경기를 끝내지 못함 ${JSON.stringify(fin)}`);
    console.log(`${tag}: 만들기·저장·팀 고르기·경기 끝까지`);
    await ctx.close();
  }
  await browser.close(); srv.kill();
  if(errors.length){ console.log('오류:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
  console.log('오류 없음');
})().catch(e => { console.error(e); process.exit(1); });
