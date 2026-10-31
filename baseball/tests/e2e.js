// 화면에서 끝까지 경기해 보며 스크립트 오류와 화면 넘침을 확인함.
// 사용법: node baseball/tests/e2e.js [스크린샷 폴더]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const shots = process.argv[2] || null;
const PORT = 8766;

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', root], { stdio:'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch();
  const errors = [];
  const sizes = [['phone', 390, 844], ['phone-land', 844, 390], ['tablet', 1024, 768]];
  const shot = async (page, name) => { if(shots) await page.screenshot({ path: path.join(shots, name + '.png'), fullPage:false }); };
  const q = page => page.$eval('#q', e => e.textContent);
  const opts = page => page.$$eval('#opts .opt', els => els.map(e => ({ n: e.dataset.n, t: e.querySelector('b').textContent })));
  const noOverflow = async (page, where) => {
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    if(w[0] > w[1] + 1) errors.push(`${where}: 가로로 넘침 ${w[0]} > ${w[1]}`);
    // 화면 보며 하기의 경기 화면은 세로로도 넘치면 안 됨 (한 화면에서 다 고름)
    const v = await page.evaluate(() => [document.documentElement.classList.contains('gfxgame'), document.documentElement.scrollHeight, innerHeight, (() => { const o = [...document.querySelectorAll('#opts .opt')].pop(); return o ? Math.round(o.getBoundingClientRect().bottom) : 0; })()]);
    if(v[0] && (v[1] > v[2] + 1 || v[3] > v[2] + 1)) errors.push(`${where}: 그림 모드 경기 화면이 한 화면을 넘침 ${v[1]}/${v[3]} > ${v[2]}`);
  };
  // 경기 화면에서 무작위로 골라 끝까지 진행 (메뉴 빠져나가기·그만하기는 피함)
  async function playToEnd(page, tag, useClick){
    for(let i = 0; i < 4000; i++){
      const qq = await q(page);
      if(qq.includes('경기가 끝났습니다')) return i;
      if(qq === '더 보기' || qq.includes('명단입니다') || qq.includes('설정')){ await page.keyboard.press('.'); continue; }
      let os = (await opts(page)).filter(o => !/더 보기|설정|그만하기|처음 화면|자동 재생|경기 기록/.test(o.t));
      if(qq.includes('관전 중')) os = os.filter(o => o.n === '2');
      if(!os.length){ await page.keyboard.press('.'); continue; }
      const o = os[Math.floor(Math.random() * os.length)];
      if(useClick && Math.random() < 0.5) await page.click(`#opts .opt[data-n="${o.n}"]`);
      else await page.keyboard.press(o.n);
    }
    errors.push(`${tag}: 4000번 안에 끝나지 않음`);
  }
  for(const [name, w, h] of sizes){
    const ctx = await browser.newContext({ viewport:{ width:w, height:h }, hasTouch: name !== 'tablet' });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    page.on('console', m => { if(m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
    await page.goto(`http://localhost:${PORT}/baseball/`);
    await page.waitForSelector('#opts .opt');
    // 처음 실행: 화면 방식 고르기 (휴대폰 세로는 시각장애인 모드, 나머지는 도트 그림 모드)
    if(!(await q(page)).includes('어떤 방식으로')) errors.push(`${name}: 처음에 화면 방식 고르기가 나오지 않음`);
    await shot(page, `${name}-view`);
    await page.keyboard.press(name === 'phone' ? '2' : '1');
    await shot(page, `${name}-home`); await noOverflow(page, name + ' 처음');
    // 혼자 하기, 정밀 모드, 1이닝
    for(const k of ['1', '2', '1', '1', '1', '1', '2']) await page.keyboard.press(k);
    await shot(page, `${name}-ready`);
    await page.keyboard.press('1');
    await page.waitForFunction(() => document.querySelector('#boardSec') && !document.querySelector('#boardSec').hidden);
    await shot(page, `${name}-game`); await noOverflow(page, name + ' 경기');
    // 수비라면 코스 판까지 가서 찍어 둠
    const qq = await q(page);
    if(qq.includes('어떤 공을')){ await page.keyboard.press('1'); await shot(page, `${name}-zone`); await noOverflow(page, name + ' 코스'); await page.keyboard.press('.'); }
    // 키 확인: 0 상황, + 점수판, - 정보, / 기록
    for(const k of ['0', '+', '-', '/', '*']) await page.keyboard.press(k);
    const steps = await playToEnd(page, name + ' 정밀', true);
    await shot(page, `${name}-end`); await noOverflow(page, name + ' 끝');
    console.log(`${name}: 정밀 1이닝 ${steps}번 만에 끝`);
    // 처음 화면 → 둘이 하기, 간단 모드, 3이닝 (명령 칸으로 입력)
    await page.keyboard.press('4');
    for(const k of ['2', '1', '1', '2', '3', '2', '2', '1']){ await page.fill('#cmd', ''); await page.type('#cmd', k); }
    const s2 = await playToEnd(page, name + ' 간단 둘이', false);
    console.log(`${name}: 간단 둘이 3이닝 ${s2}번 만에 끝`);
    // 관전: 정밀 3이닝, 경기 끝까지
    await page.keyboard.press('4');
    for(const k of ['6', '2', '1', '2', '2', '1']) await page.keyboard.press(k);
    await page.keyboard.press('4');
    await page.waitForFunction(() => document.querySelector('#q').textContent.includes('경기가 끝났습니다'));
    console.log(`${name}: 관전 끝`);
    if(name === 'phone'){
      // 혼자 하기 간단 모드 → 이번 이닝 맡기기 → 그만하기 → 이어하기 → 끝까지
      await page.keyboard.press('4');
      for(const k of ['1', '1', '2', '1', '1', '1', '2', '2', '1']) await page.keyboard.press(k);
      await page.keyboard.press('9'); await page.keyboard.press('7');
      await page.keyboard.press('9'); await page.keyboard.press('9');
      if(!(await q(page)).includes('무엇을 할까요')) errors.push('그만하기 뒤 처음 화면이 아님');
      await page.keyboard.press('7');
      const s3 = await playToEnd(page, name + ' 이어하기', true);
      console.log(`${name}: 맡기기·이어하기 ${s3}번 만에 끝`);
      // 둘이 하기 정밀 모드 1이닝 (기기 넘기기 화면 포함)
      await page.keyboard.press('4');
      for(const k of ['2', '2', '3', '4', '1', '1', '1']) await page.keyboard.press(k);
      let hand = 0;
      for(let i = 0; i < 3000; i++){
        const qq = await q(page);
        if(qq.includes('경기가 끝났습니다')) break;
        if(qq.includes('기기를 넘겨받았으면')) hand++;
        const os = (await opts(page)).filter(o => !/더 보기|설정|그만하기|맡기기|작전|수비 위치/.test(o.t));
        if(!os.length){ await page.keyboard.press('.'); continue; }
        await page.keyboard.press(os[Math.floor(Math.random() * os.length)].n);
      }
      if(!(await q(page)).includes('경기가 끝났습니다')) errors.push('둘이 하기 정밀이 끝나지 않음');
      console.log(`${name}: 둘이 하기 정밀 끝, 기기 넘기기 ${hand}번`);
      // 감독 모드 혼자 하기 3이닝: 경기 전 준비(추천 타순, 순서 바꾸기, 벤치, 선발) 뒤 무작위 작전
      await page.keyboard.press('4');
      for(const k of ['1', '3', '1', '1', '1', '2', '2', '1']) await page.keyboard.press(k);
      if(!(await q(page)).includes('타순과 선발 투수')) errors.push('감독 모드 경기 전 준비 화면이 아님: ' + await q(page));
      await shot(page, `${name}-pregame`);
      for(const k of ['2', '3', '1', '2', '4', '1', '3', '5', '2']) await page.keyboard.press(k);
      const lineupLog = await page.evaluate(() => G.log.filter(l => l.k === 'c').map(l => l.s).join(' / '));
      console.log('경기 전 변경:', lineupLog);
      await page.keyboard.press('1');
      await shot(page, `${name}-manager`);
      const asked = [];
      for(let i = 0; i < 3000; i++){
        const qq = await q(page);
        if(qq.includes('경기가 끝났습니다')) break;
        if(/작전/.test(qq)) asked.push(qq.slice(0, 12));
        const os = (await opts(page)).filter(o => !/더 보기|설정|그만하기|처음 화면/.test(o.t));
        if(!os.length){ await page.keyboard.press('.'); continue; }
        const o = os[Math.floor(Math.random() * os.length)];
        await page.keyboard.press(o.n);
      }
      if(!(await q(page)).includes('경기가 끝났습니다')) errors.push('감독 모드가 끝나지 않음');
      console.log(`${name}: 감독 모드 끝, 작전을 물은 횟수 ${asked.length}`);
      await shot(page, `${name}-manager-end`);
      // 감독 모드 관전
      await page.keyboard.press('4');
      for(const k of ['6', '3', '1', '2', '2', '1']) await page.keyboard.press(k);
      await page.keyboard.press('4');
      await page.waitForFunction(() => document.querySelector('#q').textContent.includes('경기가 끝났습니다'));
      console.log(`${name}: 감독 모드 관전 끝`);
      // 리그: 새 리그(간단 공 하나씩, 18경기, 3이닝) → 오늘 경기 → 순위표·기록 → 시즌 끝까지 넘기기 → 시상식
      await page.keyboard.press('4'); await page.keyboard.press('4');
      for(const k of ['1', '1', '1', '1', '1', '3']) await page.keyboard.press(k);
      if(!(await q(page)).includes('무엇을 할까요')) errors.push('리그 첫 화면이 아님: ' + await q(page));
      await shot(page, `${name}-league`);
      await page.keyboard.press('1');
      const ls1 = await playToEnd(page, name + ' 리그 경기', false);
      const after = await page.$eval('#say', e => e.innerText);
      if(!/리그에 반영했습니다/.test(after)) errors.push('리그 경기 결과가 반영되지 않음');
      console.log(`${name}: 리그 경기 ${ls1}번 만에 끝 / ${after.split('\n').filter(l => /리그에 반영|다른 경기/.test(l)).join(' / ').slice(0, 160)}`);
      await page.keyboard.press('1');
      for(const k of ['4', '.', '5', '2', '.', '6', '.', '7', '.']) await page.keyboard.press(k);
      await page.keyboard.press('3'); await page.keyboard.press('4');
      await page.waitForFunction(() => document.querySelector('#q').textContent.includes('시즌이 끝났습니다'), null, { timeout:120000 });
      const aw = await page.$eval('#note', e => e.innerText);
      if(!/한국시리즈 우승/.test(aw)) errors.push('시상식 글이 없음');
      console.log(`${name}: 리그 시즌 끝 / ${aw.split('\n').slice(1, 4).join(' / ')}`);
      await shot(page, `${name}-league-done`);
      // 다음 시즌 시작 → 기록실 둘러보기
      await page.keyboard.press('1');
      const ns = await page.$eval('#say', e => e.innerText);
      if(!/2시즌이 시작됩니다/.test(ns)) errors.push('다음 시즌이 시작되지 않음: ' + ns.slice(0, 80));
      await page.keyboard.press('8');
      for(const k of ['1', '1', '2', '1', '5', '.', '3', '1', '4', '1', '5', '1', '6', '1', '7']) await page.keyboard.press(k);
      const rec = await page.$eval('#say', e => e.innerText);
      if(!/감독/.test(rec)) errors.push('내 감독 기록이 없음');
      console.log(`${name}: 다음 시즌·기록실 / ${rec.split('\n').slice(0, 3).join(' / ')}`);
      await page.keyboard.press('1'); await page.keyboard.press('.');
      // 선수 육성: 타자(유격수, 교타자) 만들기 → 훈련 → 퓨처스리그 → (능력치를 올려) 1군 승격 → 1군 경기(내 타석만) → 은퇴
      await page.keyboard.press('.');
      await page.keyboard.press('5'); await page.keyboard.press('1');
      await page.waitForFunction(() => document.querySelector('#q').textContent.includes('선수 이름'));
      await page.fill('#cmd', '홍길동'); await page.press('#cmd', 'Enter');
      for(const k of ['1', '5', '1', '1', '4', '1']) await page.keyboard.press(k);
      if(!(await q(page)).includes('오늘은 무엇을')) errors.push('육성 첫 화면이 아님: ' + await q(page));
      await shot(page, `${name}-career`);
      await page.keyboard.press('2'); await page.keyboard.press('1');
      await page.evaluate(() => { const L = CR(); const p = myP(L); p.con = 95; p.pow = 90; p.eye = 85; p.def = 85; saveLeague(); });
      await page.keyboard.press('1');
      const up = await page.$eval('#say', e => e.innerText);
      if(!/퓨처스리그/.test(up)) errors.push('퓨처스리그 경기 결과가 없음');
      console.log(`${name}: 육성 2군 / ${up.split('\n').filter(Boolean).slice(0, 2).join(' / ').slice(0, 150)}`);
      if(!/1군에 올라갑니다/.test(up)) errors.push('1군 승격이 안 됨: ' + up.slice(0, 120));
      await page.keyboard.press('1');
      let myTurns = 0;
      for(let i = 0; i < 600; i++){
        const qq = await q(page);
        if(qq.includes('경기가 끝났습니다')) break;
        if(/공격/.test(qq)) myTurns++;
        const os = (await opts(page)).filter(o => !/더 보기|설정|그만하기|노림수|맡기기/.test(o.t));
        if(!os.length){ await page.keyboard.press('.'); continue; }
        await page.keyboard.press(os[Math.floor(Math.random() * os.length)].n);
      }
      const endS = await page.$eval('#say', e => e.innerText);
      if(!(await q(page)).includes('경기가 끝났습니다')) errors.push('육성 1군 경기가 끝나지 않음');
      console.log(`${name}: 육성 1군 경기 끝, 내가 고른 공 ${myTurns}번 / ${endS.split('\n').filter(l => /내 기록/.test(l)).join('')}`);
      await page.keyboard.press('1');
      await page.keyboard.press('9'); await page.keyboard.press('1');
      await page.waitForSelector('#dlg.open'); await page.click('#dlg [data-dlg="0"]');
      const fin = await page.$eval('#say', e => e.innerText);
      if(!/은퇴/.test(fin)) errors.push('은퇴 글이 없음');
      console.log(`${name}: 은퇴 / ${fin.split('\n').filter(Boolean).slice(0, 2).join(' / ')}`);
      await page.keyboard.press('.');
      await page.keyboard.press('9'); await page.keyboard.press('.'); await page.keyboard.press('.');
    }
    // 설정 화면: 글자 크기·화면 색 바꾸기
    await page.keyboard.press('4');
    await page.keyboard.press('8');
    for(const k of ['1', '2', '2', '1', '1', '1']) await page.keyboard.press(k);
    await shot(page, `${name}-settings`); await noOverflow(page, name + ' 설정');
    await page.keyboard.press('2'); await page.keyboard.press('1'); await page.keyboard.press('1');
    await ctx.close();
  }
  await browser.close(); srv.kill();
  if(errors.length){ console.log('오류:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
  console.log('오류 없음');
})().catch(e => { console.error(e); process.exit(1); });
