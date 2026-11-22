// 미니게임(js/mini.js, js/skin-mini.js) 시험: 타격 연습장·번트 챌린지·도루 챌린지를 두 화면 방식으로 결과 화면까지 함.
// - 화면 보며 하기: 휴대폰·작은 휴대폰·가로·태블릿에서 단추를 눌러(타이밍은 누르는 순간 pointerdown) 끝까지. #skBody가 한 번도 scroll이 되지 않고 화면을 넘치지 않는지
// - 소리와 글로 하기: 숫자 키·스페이스만으로 (타이밍은 MG.run의 칠 때·투구 때에 맞춰 누름), 고르기로 하기, 재는 도중 점(.)으로 멈추기
// - 처음 화면 10번(명령 칸에 10)과 육성 마을(미니게임 연습장)에서 들어가기, 기록 저장(bb_mini)과 신기록
// 사용법: node baseball/tests/mini.js
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const PORT = 8772;

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', root], { stdio:'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch();
  const errors = [];
  const open = async (view, w, h, tag) => {
    const ctx = await browser.newContext({ viewport:{ width:w, height:h }, hasTouch: view === 'gfx' });
    await ctx.addInitScript(v => {
      try{ if(!sessionStorage.getItem('mgInit')){ sessionStorage.setItem('mgInit', '1'); localStorage.clear(); localStorage.setItem('bb_set', JSON.stringify({ view:v, installDismissed:true })); } }catch(e){}
      // #skBody가 한 번이라도 scroll(넘쳐서 스크롤)이 되면 기록
      new MutationObserver(() => { const b = document.getElementById('skBody'); if(b && b.classList.contains('scroll') && /k-mg-/.test(b.className)) window.__mgScroll = (window.__mgScroll || 0) + 1; })
        .observe(document, { subtree:true, attributes:true, attributeFilter:['class'] });
    }, view);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${tag}: ${e.message}`));
    page.on('console', m => { if(m.type() === 'error' || /그리기 실패/.test(m.text())) errors.push(`${tag} console: ${m.text()}`); });
    await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForSelector('#opts .opt', { state:'attached' });
    return { ctx, page };
  };
  const st = page => page.evaluate(() => ({ kind: UI.S.kind || '', phase: MG.st && MG.st.phase, g: MG.st && MG.st.g, i: MG.st && MG.st.i, score: MG.st && MG.st.score, run: !!MG.run, q: UI.S.q }));
  const fits = async (page, where) => {
    const v = await page.evaluate(() => [document.documentElement.scrollHeight, innerHeight, document.documentElement.scrollWidth, innerWidth, ($('#skBody') || {}).className || '', window.__mgScroll || 0]);
    if(v[0] > v[1] + 1 || v[2] > v[3] + 1) errors.push(`${where}: 한 화면을 넘침 ${v.slice(0, 4).join('/')}`);
    if(/\bscroll\b/.test(v[4]) || v[5]) errors.push(`${where}: #skBody가 scroll이 됨 (${v[4]})`);
  };
  // 타이밍: 칠 때(타격·번트) 또는 투구 동작(도루)까지 기다렸다가 누름. how: 'key' 스페이스 · 'tap' 큰 단추 누르기 · 'none' 누르지 않음
  const timing = async (page, how) => {
    await page.waitForFunction(() => !!MG.run, null, { timeout:4000 });
    const g = await page.evaluate(() => MG.run.g);
    if(how !== 'none'){
      if(g === 'steal') await page.waitForFunction(() => !MG.run || MG.run.moves.some(m => m.type === 'pitch' && m.at <= performance.now()), null, { timeout:8000, polling:'raf' });
      else await page.waitForFunction(() => !MG.run || performance.now() >= MG.run.ideal - 12, null, { timeout:8000, polling:'raf' });
      if(await page.evaluate(() => !!MG.run)){
        if(how === 'tap'){ const b = await page.$('.mg-go.tap'); if(!b){ if(await page.evaluate(() => !!MG.run)) errors.push('타이밍 중에 큰 단추가 없음'); } else { const bx = await b.boundingBox(); await page.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2); } }
        else await page.keyboard.press('Space');
      }
    }
    await page.waitForFunction(() => !MG.run, null, { timeout:8000 });
    await page.waitForTimeout(170);   // 친 직후 다시 누른 것을 막는 시간(시험에서는 0.15초)
  };
  // 한 판: mode tm·pick, input key·click
  const play = async (page, g, mode, input, tag, check) => {
    const press = async n => {
      if(input === 'key') return page.keyboard.press(String(n));
      const sel = `#sk [data-sk="opt"][data-n="${n}"]`;
      await page.waitForSelector(sel, { timeout:4000 }); return page.click(sel);
    };
    await page.evaluate(([g, mode]) => { MG.g = g; mgBegin(mode, 'click'); }, [g, mode]);
    let steps = 0, presses = 0, nones = 0;
    for(; steps < 80; steps++){
      const s = await st(page);
      if(s.kind !== 'mg-play'){ errors.push(`${tag}: 놀이 화면이 아님 ${s.kind}`); break; }
      if(check && steps % 3 === 0) await check(`${tag} ${s.phase} ${s.i}`);
      if(s.phase === 'end'){ await page.waitForTimeout(170); await press(1); break; }
      if(mode === 'tm'){
        await press(g === 'bat' ? 1 : 1 + Math.floor(Math.random() * 3));
        const how = steps === 2 ? 'none' : input === 'key' ? 'key' : 'tap';
        if(how === 'none') nones++; else presses++;
        await timing(page, how);
      } else {
        if(g === 'bat' && Math.random() < 0.3){ await press(4); }
        if(g === 'steal'){
          await press(1 + Math.floor(Math.random() * 3)); await page.waitForTimeout(170);
          for(let k = 0; k < 5 && (await st(page)).phase === 'read'; k++){ await press(Math.random() < 0.5 ? 1 : 2); await page.waitForTimeout(170); }
        } else { await press(1 + Math.floor(Math.random() * 3)); await page.waitForTimeout(170); }
      }
    }
    await page.waitForFunction(() => UI.S.kind === 'mg-res', null, { timeout:4000 }).catch(() => errors.push(`${tag}: 결과 화면이 나오지 않음`));
    const r = await page.evaluate(() => MG.res && { score: MG.res.score, n: MG.res.log.length, need: MG.res.n, saved: (JSON.parse(localStorage.getItem('bb_mini') || '{}')[MG.res.g + (MG.res.mode === 'pick' ? '-c' : '')] || {}).best });
    if(!r || r.n !== r.need) errors.push(`${tag}: 결과 수가 맞지 않음 ${JSON.stringify(r)}`);
    else if(r.saved == null || r.saved < r.score) errors.push(`${tag}: 최고 기록이 저장되지 않음 ${JSON.stringify(r)}`);
    if(check) await check(`${tag} 결과`);
    console.log(`${tag}: ${r && r.score}점 (${r && r.n}${g === 'bat' ? '구' : '번'})`);
    return r;
  };

  // 1. 화면 보며 하기: 네 가지 화면 크기에서 처음 화면 → 미니게임 → 세 게임(타이밍, 단추 누르기)
  for(const [name, w, h] of [['휴대폰', 390, 844], ['작은 휴대폰', 375, 667], ['가로', 844, 390], ['태블릿', 820, 1180]]){
    const tag = `화면(${name})`, { ctx, page } = await open('gfx', w, h, tag);
    await fits(page, `${tag} 처음 화면`);
    const card = await page.$('#sk .card[data-n="10"]');
    if(!card) errors.push(`${tag}: 처음 화면에 미니게임 카드가 없음`);
    else { await card.click(); await page.waitForSelector('.mg-card'); }
    if(await page.evaluate(() => UI.S.kind) !== 'mg-home') errors.push(`${tag}: 미니게임 목록으로 가지 않음`);
    await fits(page, `${tag} 미니게임 목록`);
    await page.click('.mg-card[data-n="1"]'); await page.waitForSelector('.mg-intro');
    await fits(page, `${tag} 설명`);
    for(const g of ['bat', 'bunt', 'steal']) await play(page, g, 'tm', 'click', `${tag} ${g} 타이밍`, where => fits(page, where));
    if(name === '휴대폰' || name === '가로') for(const g of ['bat', 'bunt', 'steal']) await play(page, g, 'pick', 'click', `${tag} ${g} 고르기`, where => fits(page, where));
    // 결과 화면 → 다시 하기 단추, 목록 → 처음 화면으로
    if(!(await page.$('.mg-res'))) errors.push(`${tag}: 결과 그림이 없음`);
    await page.click('#sk .mg-row [data-n="2"]'); await page.waitForSelector('.mg-card');
    await page.click('#sk .mback [data-sk="opt"]');
    if(await page.evaluate(() => UI.make !== homeScreen)) errors.push(`${tag}: 목록에서 처음 화면으로 돌아가지 않음`);
    await ctx.close();
  }

  // 2. 소리와 글로 하기: 키보드만으로
  {
    const tag = '소리와 글', { ctx, page } = await open('a11y', 390, 844, tag);
    await page.fill('#cmd', '10'); await page.press('#cmd', 'Enter');
    if(await page.evaluate(() => UI.S.kind) !== 'mg-home') errors.push(`${tag}: 명령 칸 10으로 미니게임에 들어가지 않음`);
    const optsTxt = await page.$$eval('#opts .opt', els => els.map(e => e.textContent).join(' | '));
    if(!/타격 연습장/.test(optsTxt) || !/번트 챌린지/.test(optsTxt) || !/도루 챌린지/.test(optsTxt)) errors.push(`${tag}: 미니게임 목록 글이 이상함 ${optsTxt}`);
    await page.keyboard.press('1');
    const say = await page.$eval('#say', e => e.textContent);
    if(!/삐/.test(say) || !/점수/.test(say)) errors.push(`${tag}: 타격 연습장 규칙 글에 소리 신호·점수 설명이 없음`);
    await page.keyboard.press('3');   // 신호 소리 들어 보기
    if(!/들려줍니다/.test(await page.$eval('#say', e => e.textContent))) errors.push(`${tag}: 소리 들어 보기 안내가 없음`);
    // 재는 도중 점(.)으로 멈추기: 이번 공은 세지 않음
    await page.evaluate(() => { MG.g = 'bat'; mgBegin('tm', 'key'); }); await page.keyboard.press('1');
    await page.waitForFunction(() => !!MG.run); await page.keyboard.press('.');
    const ab = await st(page);
    if(ab.run || ab.i !== 0 || ab.phase !== 'ready') errors.push(`${tag}: 점(.)으로 멈추지 않음 ${JSON.stringify(ab)}`);
    // 한 번 친 결과는 알림 칸(#live)으로 읽음
    await page.keyboard.press('1'); await timing(page, 'key');
    await page.waitForTimeout(150);
    const live = await page.$eval('#live', e => e.textContent);
    if(!/1구:/.test(live) || !/합계/.test(live)) errors.push(`${tag}: 친 결과를 읽어 주지 않음: ${live.slice(0, 80)}`);
    // 초점이 같은 단추(1번)에 남는지: 단추로 공 던지기 → 스윙 → 다음 공
    await page.focus('#opts .opt[data-n="1"]'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => !!MG.run);
    const lab = await page.evaluate(() => [document.activeElement && document.activeElement.dataset.k, document.activeElement && document.activeElement.textContent]);
    if(lab[0] !== 'k1' || !/스윙/.test(lab[1])) errors.push(`${tag}: 재는 동안 초점이 스윙 단추에 있지 않음 ${JSON.stringify(lab)}`);
    await timing(page, 'key');
    for(const g of ['bat', 'bunt', 'steal']) await play(page, g, 'tm', 'key', `${tag} ${g} 타이밍`);
    for(const g of ['bat', 'bunt', 'steal']) await play(page, g, 'pick', 'key', `${tag} ${g} 고르기`);
    const qq = await page.$eval('#q', e => e.textContent);
    if(!/결과입니다/.test(qq)) errors.push(`${tag}: 결과 질문이 아님 ${qq}`);
    // 신기록: 최고 기록을 낮춰 두고 한 판
    await page.evaluate(() => { const r = JSON.parse(localStorage.getItem('bb_mini')); r.bunt.best = -1; localStorage.setItem('bb_mini', JSON.stringify(r)); });
    await play(page, 'bunt', 'tm', 'key', `${tag} 번트 신기록`);
    if(!/신기록/.test(await page.$eval('#say', e => e.textContent))) errors.push(`${tag}: 신기록 알림이 없음`);
    await page.keyboard.press('3');
    if(await page.evaluate(() => UI.make !== homeScreen)) errors.push(`${tag}: 결과에서 처음 화면으로 가지 않음`);
    await ctx.close();
  }

  // 3. 선수 육성 마을에서 들어가고 돌아오기 (두 방식)
  for(const view of ['gfx', 'a11y']){
    const tag = `육성 마을(${view})`, { ctx, page } = await open(view, 390, 844, tag);
    await page.evaluate(() => {
      Object.assign(NEWC, { name:'시험', pit:false, pos:'SS', type:'power', team:'star' }); NEW.len = 18; NEW.mode = 'simple';
      LSRC = 'career'; const L = careerNew(); setLG(L); saveLeague(); go(visitScreen, 'click');
    });
    if(view === 'gfx'){ await page.click('[data-spot="mini"]'); await page.waitForSelector('#skSheet .card'); await page.click('#skSheet .card'); }
    else { const o = await page.$('#opts .opt[data-n="10"]'); if(!o) errors.push(`${tag}: 어디 가기에 10번 미니게임 연습장이 없음`); else await o.click(); }
    if(await page.evaluate(() => UI.S.kind) !== 'mg-home') errors.push(`${tag}: 미니게임으로 가지 않음`);
    if(view === 'gfx') await fits(page, `${tag} 목록`);
    await page.keyboard.press('9');
    if(await page.evaluate(() => UI.S.kind) !== 'cr-visit') errors.push(`${tag}: 마을로 돌아오지 않음 ${await page.evaluate(() => UI.S.kind)}`);
    await ctx.close();
  }

  await browser.close(); srv.kill();
  if(errors.length){ console.log('오류:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
  console.log('오류 없음');
})().catch(e => { console.error(e); process.exit(1); });
