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
    for(const k of ['2', '1', '2', '3', '2', '2', '1']){ await page.fill('#cmd', ''); await page.type('#cmd', k); }
    const s2 = await playToEnd(page, name + ' 간단 둘이', false);
    console.log(`${name}: 간단 둘이 3이닝 ${s2}번 만에 끝`);
    // 관전: 정밀 3이닝, 경기 끝까지
    await page.keyboard.press('4');
    for(const k of ['4', '2', '3', '4', '2', '1']) await page.keyboard.press(k);
    await page.keyboard.press('4');
    await page.waitForFunction(() => document.querySelector('#q').textContent.includes('경기가 끝났습니다'));
    console.log(`${name}: 관전 끝`);
    if(name === 'phone'){
      // 혼자 하기 간단 모드 → 이번 이닝 맡기기 → 그만하기 → 이어하기 → 끝까지
      await page.keyboard.press('4');
      for(const k of ['1', '1', '1', '1', '1', '2', '2', '1']) await page.keyboard.press(k);
      await page.keyboard.press('9'); await page.keyboard.press('7');
      await page.keyboard.press('9'); await page.keyboard.press('9');
      if(!(await q(page)).includes('무엇을 할까요')) errors.push('그만하기 뒤 처음 화면이 아님');
      await page.keyboard.press('5');
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
      for(const k of ['4', '3', '3', '4', '2', '1']) await page.keyboard.press(k);
      await page.keyboard.press('4');
      await page.waitForFunction(() => document.querySelector('#q').textContent.includes('경기가 끝났습니다'));
      console.log(`${name}: 감독 모드 관전 끝`);
    }
    // 설정 화면: 글자 크기·화면 색 바꾸기
    await page.keyboard.press('4');
    await page.keyboard.press('7');
    for(const k of ['1', '2', '2', '1', '1', '1']) await page.keyboard.press(k);
    await shot(page, `${name}-settings`); await noOverflow(page, name + ' 설정');
    await page.keyboard.press('2'); await page.keyboard.press('1'); await page.keyboard.press('1');
    await ctx.close();
  }
  await browser.close(); srv.kill();
  if(errors.length){ console.log('오류:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
  console.log('오류 없음');
})().catch(e => { console.error(e); process.exit(1); });
