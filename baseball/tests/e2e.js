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
    // 혼자 하기, 정밀 모드(2단계: 구종만), 1이닝
    for(const k of ['1', '2', '2', '1', '1', '1', '1', '1', '2']) await page.keyboard.press(k);
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
      for(const k of ['2', '2', '3', '1', '3', '4', '1', '1', '1']) await page.keyboard.press(k);   // 3단계: 구종과 코스
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
      for(const k of ['2', '3', '1', '2', '4', '1', '3', '1', '5', '2', '1']) await page.keyboard.press(k);   // 벤치·선발 교체는 '교체하기'로 확인
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
      const skipEvent = async () => { for(let i = 0; i < 3 && (await q(page)).includes('이벤트'); i++) await page.keyboard.press('1'); };
      // 훈련 → 훈련 장면 → 확인
      await page.keyboard.press('2'); await page.keyboard.press('1');
      if(!(await q(page)).includes('훈련')) errors.push('훈련 장면이 아님: ' + await q(page));
      await shot(page, `${name}-train`);
      await page.keyboard.press('1'); await skipEvent();
      // 어디 가기 → 팬 사인회 → 확인, 용품점에서 배트 사기
      await page.keyboard.press('3'); await page.keyboard.press('3'); await page.keyboard.press('1'); await skipEvent();
      await page.evaluate(() => { const L = CR(); life(L).money = 5000; saveLeague(); });
      await page.keyboard.press('3'); await page.keyboard.press('1'); await page.keyboard.press('2');
      await page.waitForSelector('#dlg.open'); await page.click('#dlg [data-dlg="0"]');
      const eq = await page.evaluate(() => { const L = CR(); return [life(L).equip.bat, myP(L).pow]; });
      if(eq[0] !== 'bat2') errors.push('배트 장착이 안 됨 ' + JSON.stringify(eq));
      await page.keyboard.press('.'); await page.keyboard.press('.'); await skipEvent();
      await page.evaluate(() => { const L = CR(); const p = myP(L); p.con = 95; p.pow = 90; p.eye = 85; p.def = 85; saveLeague(); });
      // 2군 경기: 맡기고 내 결과 듣기
      await page.keyboard.press('1'); await page.keyboard.press('2');
      const up = await page.$eval('#say', e => e.innerText);
      await skipEvent();
      if(!/퓨처스리그/.test(up)) errors.push('퓨처스리그 경기 결과가 없음');
      console.log(`${name}: 육성 2군 / ${up.split('\n').filter(Boolean).slice(0, 2).join(' / ').slice(0, 150)}`);
      if(!/1군에 올라갑니다/.test(up)) errors.push('1군 승격이 안 됨: ' + up.slice(0, 120));
      await page.keyboard.press('1'); await page.keyboard.press('1');   // 1군 경기, 내 차례만 직접
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
      await page.keyboard.press('1'); await skipEvent();
      await page.keyboard.press('9'); await page.keyboard.press('1');
      await page.waitForSelector('#dlg.open'); await page.click('#dlg [data-dlg="0"]');
      const fin = await page.$eval('#say', e => e.innerText);
      if(!/은퇴/.test(fin)) errors.push('은퇴 글이 없음');
      console.log(`${name}: 은퇴 / ${fin.split('\n').filter(Boolean).slice(0, 2).join(' / ')}`);
      await page.keyboard.press('.');
      await page.keyboard.press('9'); await page.keyboard.press('.'); await page.keyboard.press('.');
    }
    // 설정 화면(탭): 처음 화면의 설정 → 탭을 9번·화살표로 돌며 항목 바꾸기
    for(let i = 0; i < 4 && !(await opts(page)).some(o => /설정과 게임 방법/.test(o.t)); i++) await page.keyboard.press('.');   // 처음 화면까지
    if(await page.evaluate(() => dlgOpen())) await page.click('#dlg [data-dlg="0"]');   // 앞에서 연 설치 안내 창을 닫음
    { const home = (await opts(page)).find(o => /^처음 화면으로/.test(o.t)); if(home) await page.keyboard.press(home.n); }   // 경기가 끝난 화면이면 처음 화면으로
    if(await page.evaluate(() => dlgOpen())) await page.click('#dlg [data-dlg="0"]');
    const setOpt = (await opts(page)).find(o => /설정과 게임 방법/.test(o.t)) || (await opts(page)).find(o => /^설정/.test(o.t));
    if(!setOpt){ errors.push(`${name}: 처음 화면에서 설정을 찾지 못함: ${(await q(page)).slice(0, 40)} / ${(await opts(page)).map(o => o.t).join(', ')}`); await ctx.close(); continue; }
    await page.keyboard.press(setOpt.n);
    if(!(await q(page)).includes('설정, 게임 탭')) errors.push(`${name}: 설정 첫 탭이 게임이 아님: ${(await q(page)).slice(0, 40)}`);
    const tabsSeen = [];
    for(let i = 0; i < 6; i++){ tabsSeen.push(((await q(page)).match(/설정, (\S+) 탭/) || [])[1]); await shot(page, `${name}-settings-${i}`); await noOverflow(page, `${name} 설정 ${i}`); await page.keyboard.press('9'); }
    if(tabsSeen.join() !== '게임,규칙,조작·접근성,화면,소리,저장') errors.push(`${name}: 설정 탭 순서가 이상함 ${tabsSeen.join()}`);
    if(!(await q(page)).includes('설정, 게임 탭')) errors.push(`${name}: 탭을 한 바퀴 돌아도 처음으로 오지 않음`);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());   // 명령 칸에 초점이 있으면 화살표는 글자 칸이 씀
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');   // 조작·접근성
    if(!(await q(page)).includes('조작·접근성 탭')) errors.push(`${name}: 화살표로 탭이 옮겨지지 않음`);
    await page.keyboard.press('ArrowLeft');
    if(!(await q(page)).includes('규칙 탭')) errors.push(`${name}: 왼쪽 화살표가 동작하지 않음`);
    await page.keyboard.press('ArrowRight');
    // 화면 보며 하기에서는 이름과 값이 따로 그려지므로 단추 전체 글을 읽음
    const deliver = async () => { const n = (await opts(page)).find(o => /경기 결과 전달/.test(o.t)).n; return page.$eval(`#opts .opt[data-n="${n}"]`, e => e.innerText.replace(/\s+/g, ' ')); };
    if(!(await deliver()).includes('소리와 글')) errors.push(`${name}: 결과 전달 기본값이 소리와 글이 아님: ${await deliver()}`);
    const dn = (await opts(page)).find(o => /경기 결과 전달/.test(o.t)).n;
    await page.keyboard.press(dn); if(!(await deliver()).includes('소리만')) errors.push(`${name}: 결과 전달이 소리만으로 바뀌지 않음`);
    await page.keyboard.press(dn); if(!(await deliver()).includes('글만')) errors.push(`${name}: 결과 전달이 글만으로 바뀌지 않음`);
    await page.keyboard.press(dn);
    // 진동 뜻 익히기
    const vn = (await opts(page)).find(o => /진동 뜻 익히기/.test(o.t)).n;
    await page.keyboard.press(vn);
    if(!(await q(page)).includes('진동 뜻 익히기') || (await opts(page)).length < 8) errors.push(`${name}: 진동 뜻 화면이 이상함`);
    await page.keyboard.press('.');
    // 화면 탭: 글자 크기·화면 색 바꾸기
    await page.keyboard.press('9'); await page.keyboard.press('1'); await page.keyboard.press('2');
    await shot(page, `${name}-settings`); await noOverflow(page, name + ' 설정');
    await page.keyboard.press('.'); await page.keyboard.press('.');
    await ctx.close();
  }
  // 송구 선택: 사람이 수비할 때 땅볼을 잡으면 던질 곳을 묻고, 고르면(또는 시간이 지나면) 이어서 진행해야 함
  for(const [view, key] of [['그림', '1'], ['소리와 글', '2']]){
    const ctx = await browser.newContext({ viewport:{ width:1024, height:768 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`송구 선택(${view}): ${e.message}`));
    page.on('console', m => { if(m.type() === 'error') errors.push(`송구 선택(${view}) console: ${m.text()}`); });
    await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForSelector('#opts .opt');
    await page.keyboard.press(key);
    await page.evaluate(() => { startGame({ mode:'detail', unit:'pa', innings:3, teams:[TEAMS[0].key, TEAMS[1].key], ctrl:['human', 'cpu'], who:['', ''], diff:1, easy:1, seed:31005 }, 'click'); });
    const toPending = () => page.evaluate(() => { let g = 0; while(!G.pendingThrow && !G.over && g++ < 3000){ if(G.review) resolveReview(G, false); else playStep(G, aiDefChoice(G), aiOffChoice(G)); } if(!G.pendingThrow) return false; gameNext('click', flush(G)); return true; });
    if(!(await toPending())){ errors.push(`송구 선택(${view}): 3000걸음 안에 송구 선택이 나오지 않음`); await ctx.close(); continue; }
    await page.waitForFunction(() => /어디로 던질까요/.test(document.querySelector('#q').textContent));
    const os = await opts(page);
    if(os.length < 3 || !os.some(o => /컴퓨터가 고르게/.test(o.t))) errors.push(`송구 선택(${view}): 선택지가 이상함 ${JSON.stringify(os)}`);
    await noOverflow(page, `송구 선택(${view})`); await shot(page, `throw-${view}`);
    await page.keyboard.press(os[0].n);
    await page.waitForFunction(() => !G.pendingThrow);
    if(/어디로 던질까요/.test(await q(page)) && await page.evaluate(() => !G.pendingThrow)) errors.push(`송구 선택(${view}): 고른 뒤에도 같은 화면`);
    // 시간 제한: 1초 안에 고르지 않으면 컴퓨터가 정함
    await page.evaluate(() => { SET.throwSec = 1; });
    if(await toPending()){ await page.waitForFunction(() => !G.pendingThrow, null, { timeout: 4000 }).catch(() => errors.push(`송구 선택(${view}): 시간이 지나도 자동으로 진행되지 않음`)); }
    console.log(`송구 선택(${view}): 선택지 ${os.map(o => o.t).join(' / ')}`);
    await ctx.close();
  }
  // 세밀하게 고르기(구속·스윙 9단계, 노려 치기)와 히트 앤드 런: 해당 화면이 나오고, 끝까지 진행되어야 함
  {
    const ctx = await browser.newContext({ viewport:{ width:1024, height:768 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`세밀하게 고르기: ${e.message}`));
    page.on('console', m => { if(m.type() === 'error') errors.push(`세밀하게 고르기 console: ${m.text()}`); });
    await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForSelector('#opts .opt');
    await page.keyboard.press('1');
    await page.evaluate(() => { SET.picks = { ...picks(), pow9:true, swing9:true, aim:true }; SET.throwSec = 0;
      startGame({ mode:'detail', unit:'pa', innings:3, teams:[TEAMS[2].key, TEAMS[5].key], ctrl:['human', 'cpu'], who:['', ''], diff:1, easy:1, seed:777 }, 'click'); });
    const seen = {};
    // 히트 앤드 런은 1루 주자만 있을 때 나옴: 처음 공격 화면에서 주자를 만들어 놓고 확인 (무작위로는 안 나올 수 있어서)
    await page.evaluate(() => { G.bases = [(batTeam(G).bi + 1) % 9, null, null]; rerender(); });
    if((await opts(page)).some(o => /^히트 앤드 런/.test(o.t))) seen.hitrun = 1;
    await page.evaluate(() => { G.bases = [null, null, null]; rerender(); });
    for(let i = 0; i < 3000; i++){
      const qq = await q(page);
      if(qq.includes('경기가 끝났습니다')) break;
      const os = await opts(page), nOpt = os.filter(o => o.n !== '0').length;   // 0번은 '지금 상황 확인'
      if(/얼마나 세게 던질까요/.test(qq)) seen.pow = nOpt;
      if(/스윙을 얼마나 세게/.test(qq)) seen.swing = nOpt;
      if(/어느 칸으로 올 공/.test(qq)) seen.aim = nOpt;
      if(os.some(o => /^히트 앤드 런/.test(o.t))) seen.hitrun = (seen.hitrun || 0) + 1;
      let pool = os.filter(o => !/더 보기|설정|그만하기|처음 화면|자동 재생|경기 기록|지금 상황/.test(o.t));
      // 새 화면을 자주 거치도록 우선 고름
      const pref = pool.filter(o => /스윙 세기 고르기|노림수|히트 앤드 런/.test(o.t));
      if(pref.length && Math.random() < 0.6) pool = pref;
      if(qq.includes('명단입니다') || !pool.length){ await page.keyboard.press('.'); continue; }
      await page.keyboard.press(pool[Math.floor(Math.random() * pool.length)].n);
    }
    if(!(await q(page)).includes('경기가 끝났습니다')) errors.push('세밀하게 고르기: 경기가 끝나지 않음');
    if(seen.pow !== 9) errors.push(`세밀하게 고르기: 구속 9단계 선택지가 ${seen.pow}개`);
    if(seen.swing !== 9) errors.push(`세밀하게 고르기: 스윙 9단계 선택지가 ${seen.swing}개`);
    if(seen.aim !== 9) errors.push(`세밀하게 고르기: 노려 치기 칸이 ${seen.aim}개`);
    if(!seen.hitrun) errors.push('세밀하게 고르기: 히트 앤드 런 선택지가 한 번도 나오지 않음');
    console.log('세밀하게 고르기:', JSON.stringify(seen));
    await ctx.close();
  }
  // 두 자리 입력(선택지 10개 넘는 화면)과 경기 결과 전달 방식
  {
    const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`접근성: ${e.message}`));
    await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForSelector('#opts .opt');
    await page.keyboard.press('2');
    await page.evaluate(() => { window.__digits = true; window.__picked = []; go(() => ({ q:'열두 개 시험', opts: Array.from({ length: 12 }, (_, i) => ({ n: i + 1, t:`항목 ${i + 1}`, act: () => { window.__picked.push(i + 1); } })) }), 'init'); });
    const picked = () => page.evaluate(() => window.__picked.join());
    await page.keyboard.press('1'); await page.keyboard.press('2'); if(await picked() !== '12') errors.push('두 자리 입력: 1, 2가 12번이 되지 않음 ' + await picked());
    await page.keyboard.press('1'); await page.keyboard.press('0'); if(await picked() !== '12,10') errors.push('두 자리 입력: 1, 0이 10번이 되지 않음 ' + await picked());
    await page.keyboard.press('5'); if(await picked() !== '12,10,5') errors.push('두 자리 입력: 5가 바로 골라지지 않음 ' + await picked());
    await page.keyboard.press('1'); await page.waitForTimeout(1100); if(await picked() !== '12,10,5,1') errors.push('두 자리 입력: 1만 누르고 기다리면 1번이 골라져야 함 ' + await picked());
    await page.fill('#cmd', '11'); await page.press('#cmd', 'Enter'); if((await picked()).split(',').pop() !== '11') errors.push('명령 칸에 11을 적어도 11번이 골라지지 않음 ' + await picked());
    // 결과 전달: 소리와 글(기본)은 결과 글이 남고, 소리만은 숨김, 글만은 중계 음성을 쓰지 않음
    const state = async mode => {
      await page.evaluate(m => { SET.deliver = m; SET.cast = true; SET.snd = true; SET.voice = 'sr'; startGame({ mode:'simple', unit:'pa', innings:1, teams:[TEAMS[0].key, TEAMS[1].key], ctrl:['human', 'cpu'], who:['', ''], diff:1, easy:1, seed:5 }, 'click'); }, mode);
      await page.waitForSelector('#opts .opt');
      const os = await opts(page); const o = os.find(x => !/더 보기|설정|그만|맡기기|지금 상황/.test(x.t)); await page.keyboard.press(o.n);
      await page.waitForTimeout(300);
      return page.evaluate(() => ({ sayHidden: $('#say').hidden, sayLen: $('#say').innerText.length, logHidden: $('#logSec').hidden, castOn: castOn() }));
    };
    const both = await state('both'), sound = await state('sound'), text = await state('text');
    if(both.sayHidden || both.logHidden) errors.push('결과 전달 소리와 글: 결과 글이 숨겨짐 ' + JSON.stringify(both));
    if(!sound.sayHidden || !sound.logHidden) errors.push('결과 전달 소리만: 결과 글이 숨겨지지 않음 ' + JSON.stringify(sound));
    if(text.castOn || text.sayHidden) errors.push('결과 전달 글만: 중계 음성이 켜져 있거나 글이 숨겨짐 ' + JSON.stringify(text));
    console.log('결과 전달:', JSON.stringify({ both, sound, text }));
    await ctx.close();
  }
  // 육성: 계약·FA·장비 수리·강화·휴가·훈련 화면이 열리고 고를 수 있어야 함
  {
    const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`육성 화면: ${e.message}`));
    page.on('console', m => { if(m.type() === 'error') errors.push(`육성 화면 console: ${m.text()}`); });
    await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForSelector('#opts .opt');
    await page.keyboard.press('2');
    await page.evaluate(() => {
      Object.assign(NEWC, { name:'시험', pit:false, pos:'SS', type:'power', team:'star' }); NEW.len = 18; NEW.mode = 'simple';
      LSRC = 'career'; const L = careerNew(); L.mv = 2; setLG(L);
      const c = L.career, p = c.p; p.seasons = 4; c.money = 5000;   // 1군 4시즌째, 돈 넉넉
      ITEMS.filter(x => fits(x, p)).slice(0, 2).forEach(it => { c.owned.push(it.id); equip(L, it); });
      c.offer = contractOffer(L, L.my); saveLeague(); go(careerHome, 'click');
    });
    const wanted = [['계약을 정할 시간', 3], ['FA 시장', 2], ['장비 수리·강화', 4], ['어디에 갈까요', 6], ['어떤 훈련을 할까요', 5]];
    const show = async fn => { await page.evaluate(f => { window.__susp = true; eval(f); }, fn); await page.waitForTimeout(120); };
    await show("go(careerHome, 'click')");
    if(!/계약을 정할 시간/.test(await q(page))) errors.push('육성: 계약 제시 화면이 첫 화면에 나오지 않음: ' + (await q(page)).slice(0, 30));
    const dumps = {};
    for(const [name, fn] of [['계약', "go(contractScreen, 'click')"], ['FA', "(() => { const L = CR(), c = life(L); c.fa = faOffers(L); go(faScreen, 'click'); })()"], ['장비', "go(gearScreen, 'click')"], ['어디', "go(visitScreen, 'click')"], ['훈련', "go(trainScreen, 'click')"]]){
      await show(fn); dumps[name] = (await opts(page)).filter(o => o.n !== '0').length; await noOverflow(page, `육성 ${name}`);
    }
    // 계약 받아들이기 → 첫 화면으로
    await show("go(contractScreen, 'click')"); await page.keyboard.press('1');
    await page.waitForFunction(() => !CR().career.offer);
    if(/계약을 정할 시간/.test(await q(page))) errors.push('육성: 계약한 뒤에도 계약 화면');
    // 휴가·훈련 실제 실행
    await show("go(visitScreen, 'click')"); await page.keyboard.press('6');
    const fat = await page.evaluate(() => CR().career.fatigue); if(!(fat <= 0)) errors.push('육성: 휴가를 갔는데 피로가 안 풀림 ' + fat);
    await show("go(trainScreen, 'click')"); await page.keyboard.press('1');
    const fat2 = await page.evaluate(() => CR().career.fatigue); if(!(fat2 >= 10)) errors.push('육성: 훈련을 했는데 피로가 안 쌓임 ' + fat2);
    console.log('육성 화면 선택지 수:', JSON.stringify(dumps));
    await ctx.close();
  }
  // 효과음 타이밍: 함성은 안타가 정해지는 때(플레이가 다 끝나기 전)에 터지고 크기가 사건에 맞으며, 미트 소리는 스트라이크·볼·헛스윙마다 공이 닿을 때 남
  {
    const ctx = await browser.newContext({ viewport:{ width:1024, height:768 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`효과음 시험: ${e.message}`));
    await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForSelector('#opts .opt');
    await page.keyboard.press('1');
    const r = await page.evaluate(() => {
      const fake = { currentTime:0, state:'running' }; audio = () => fake; SET.snd = true; SET.sndKind = 'rec'; SET.cast = false;
      const rec = { swell:[], glove:0, pitches:0 }; crowdSwell = (c, t0, t1, kind, sc) => rec.swell.push({ t0, t1, kind, sc }); SOUNDS.glove = () => { rec.glove++; };
      const out = [], kinds = {}; let guard = 0, seed = 41;
      for(; seed < 53 && !(kinds.hit && kinds.xbh && kinds.big); seed++){
      G = newGame({ mode:'detail', innings:3, teams:[TEAMS[0].key, TEAMS[1].key], ctrl:['cpu', 'cpu'], easy:1, seed }); flush(G); guard = 0;
      while(!G.over && guard++ < 2500){
        const res = G.review ? resolveReview(G, false) : playStep(G, aiDefChoice(G), aiOffChoice(G));
        const pitched = res.events.some(e => e.k === 'pitch'), n0 = rec.swell.length, g0 = rec.glove, top0 = res.events.some(e => e.k === 'inning') ? !G.top : G.top;
        SFX.ev = res.events; SFX.hitAt = null; playFx(res.fx);
        if(!pitched) continue; rec.pitches++;
        const A = G.anim, tl = playTL(A, res.fx), hm = hitMoment(A), pa = k => res.events.find(e => e.k === 'pa' && e.r === k);
        if(rec.swell.length > n0 && hm != null && (pa('hr') || pa('b1') || pa('b2') || pa('b3'))){
          const w = rec.swell[rec.swell.length - 1], want = Math.max(tl.contact + 0.2, Math.min(tl.result, tl.contact + hm));
          const kind = pa('hr') ? 'hr' : pa('b2') || pa('b3') ? 'xbh' : pa('b1') ? 'hit' : '';
          if(Math.abs(w.t1 - want) > 1e-6) out.push(`함성 시각 ${w.t1} ≠ 안타 시각 ${want}`);
          if(w.t1 > tl.result + 1e-6) out.push('함성이 플레이가 끝난 뒤에 터짐');
          if(w.t1 < tl.result - 0.05) kinds.early = (kinds.early || 0) + 1;
          if(kind === 'hr' && w.kind !== 'big') out.push('홈런인데 큰 함성이 아님');
          if(kind === 'xbh' && !['xbh', 'big'].includes(w.kind)) out.push('장타인데 장타 함성이 아님 ' + w.kind);
          if(kind === 'hit' && !['hit', 'big'].includes(w.kind)) out.push('안타인데 안타 함성이 아님 ' + w.kind);
          kinds[w.kind] = (kinds[w.kind] || 0) + 1;
          if(top0 && w.sc >= 1) out.push('원정 팀 안타인데 함성이 작아지지 않음');
          if(!top0 && w.sc < 1) out.push('홈 팀 안타인데 함성이 작음');
        }
        const taken = A.res === 'take' || A.res === 'whiff';
        if(taken && rec.glove === g0) out.push('스트라이크·볼·헛스윙인데 미트 소리가 없음');
        if(!taken && rec.glove > g0) out.push('치거나 파울인데 미트 소리가 남');
      }
      }   // 씨앗을 바꿔 가며 안타·장타·홈런 함성을 모두 볼 때까지
      return { out: [...new Set(out)], kinds, pitches: rec.pitches, glove: rec.glove };
    });
    if(r.out.length) errors.push('효과음 시험: ' + r.out.join(' / '));
    if(!r.kinds.early) errors.push('효과음 시험: 함성이 플레이 끝보다 일찍 터진 경우가 한 번도 없음(안타 시각을 못 씀)');
    if(!r.kinds.hit || !r.kinds.xbh) errors.push('효과음 시험: 안타·장타 함성이 모두 나오지 않음 ' + JSON.stringify(r.kinds));
    console.log('효과음 시험:', JSON.stringify(r));
    await ctx.close();
  }
  // 옛 경기 저장(새 칸이 없는 이어 하기 파일)을 불러와 끝까지 진행할 수 있어야 함
  {
    const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`옛 경기 저장: ${e.message}`));
    page.on('console', m => { if(m.type() === 'error') errors.push(`옛 경기 저장 console: ${m.text()}`); });
    await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForSelector('#opts .opt');
    await page.keyboard.press('2');
    const made = await page.evaluate(() => {
      startGame({ mode:'detail', unit:'pa', innings:2, teams:[TEAMS[1].key, TEAMS[4].key], ctrl:['human', 'cpu'], who:['', ''], diff:1, easy:1, seed:2024 }, 'click');
      for(let i = 0; i < 25 && !G.over; i++){ if(G.review) resolveReview(G, false); else playStep(G, aiDefChoice(G), aiOffChoice(G)); }
      saveGame();
      // 새 형식에서 더한 칸을 모두 지워 옛 저장처럼 만듦
      const s = JSON.parse(localStorage.getItem('bb_game'));
      ['hist', 'histN', 'inningLog', 'hs', 'evs', 'pendingThrow', 'mv'].forEach(k => delete s.G[k]);
      localStorage.setItem('bb_game', JSON.stringify(s));
      return { over: G.over, inning: G.inning };
    });
    if(made.over) errors.push('옛 경기 저장: 시험용 경기가 벌써 끝남');
    await page.reload(); await page.waitForSelector('#opts .opt');
    if(!(await page.evaluate(() => !!loadSaved()))){ errors.push('옛 경기 저장: 저장한 경기를 불러올 수 없음'); }
    else {
      await page.evaluate(() => resumeGame('click'));
      await page.waitForFunction(() => document.querySelector('#boardSec') && !document.querySelector('#boardSec').hidden);
      const n = await playToEnd(page, '옛 경기 저장', false);
      const sum = await page.evaluate(() => ({ log: (G.inningLog || []).length, runs: G.teams.map(runsOf).join('-') }));
      if(!sum.log) errors.push('옛 경기 저장: 이어 한 경기에 이닝 기록이 쌓이지 않음');
      console.log(`옛 경기 저장: 불러와서 ${n}번 만에 끝, 이닝 기록 ${sum.log}개, 점수 ${sum.runs}`);
    }
    await ctx.close();
  }
  // 덕킹: 중계가 나오는 중에 안내 음성(speak)이 시작되면 중계 음량이 줄어들었다가 돌아와야 함
  {
    const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`덕킹 시험: ${e.message}`));
    await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForSelector('#opts .opt');
    const r = await page.evaluate(() => {
      const calls = []; const gain = { value:1, cancelScheduledValues(){}, setTargetAtTime(v, t, k){ calls.push(v); } };
      const fake = { currentTime:10, state:'running', destination:{}, createGain(){ return { gain, connect(){} }; } };
      audio = () => fake; SET.voice = 'sr'; CAST.master = null; CAST.until = 0;
      speak('조용할 때는 줄이지 않습니다.'); const quiet = calls.length;
      CAST.until = 15; speak('중계가 나오는 중에 읽는 안내입니다.');
      return { quiet, calls };
    });
    if(r.quiet !== 0) errors.push('덕킹: 중계가 없을 때도 음량을 줄임');
    if(r.calls[0] !== 0.35 || r.calls[1] !== 1) errors.push('덕킹: 중계 중 안내가 나왔는데 줄였다가 되돌리지 않음 ' + JSON.stringify(r.calls));
    console.log('덕킹 시험:', JSON.stringify(r));
    await ctx.close();
  }
  // 접근성 점검: 여러 화면에서 모든 선택지가 "N번. 이름"으로 시작하는 이름을 갖고, 번호가 겹치지 않고, 읽는 순서가 질문 → 선택지 → 뒤로인지
  {
    const audit = async view => {
      const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(`접근성 점검: ${e.message}`));
      await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForSelector('#opts .opt');
      await page.keyboard.press(view);
      const screens = ["go(homeScreen, 'click')", ...[0, 1, 2, 3, 4, 5].map(i => `go(() => settingsScreen(() => go(homeScreen, 'click'), ${i}), 'click')`), "NEW.kind = '1p'; go(() => teamScreen(0), 'click')",
        "startGame({ mode:'detail', unit:'pa', innings:3, teams:[TEAMS[0].key, TEAMS[1].key], ctrl:['human', 'cpu'], who:['', ''], diff:1, easy:1, seed:11 }, 'click')",
        "startGame({ mode:'detail', unit:'pa', innings:3, teams:[TEAMS[0].key, TEAMS[1].key], ctrl:['cpu', 'human'], who:['', ''], diff:1, easy:1, seed:12 }, 'click')",
        "startGame({ mode:'simple', unit:'pa', innings:3, teams:[TEAMS[0].key, TEAMS[1].key], ctrl:['human', 'cpu'], who:['', ''], diff:1, easy:1, seed:13 }, 'click')",
        "go(moreScreen, 'click')", "go(swingScreen, 'click')", "go(aimScreen, 'click')", "go(() => vibScreen(() => {}), 'click')"];
      let n = 0;
      for(const sc of screens){
        try{ await page.evaluate(f => { window.__susp = true; SET.picks = { ...picks(), swing9:true, aim:true }; eval(f); }, sc); }catch(e){ continue; }
        await page.waitForTimeout(80);
        const bad = await page.evaluate(() => {
          const out = [], opts = [...document.querySelectorAll('#opts .opt')], seen = new Set();
          opts.forEach(o => { const t = o.textContent.replace(/\s+/g, ' ').trim(), num = o.dataset.n;
            if(!new RegExp('^' + num + '번\\. ').test(t)) out.push(`선택지 이름이 "${num}번. "으로 시작하지 않음: ${t.slice(0, 30)}`);
            if(seen.has(num)) out.push('번호 겹침 ' + num); seen.add(num);
            if(o.tagName !== 'BUTTON') out.push('단추가 아님'); });
          const q = document.getElementById('q'), box = document.getElementById('opts'), back = document.getElementById('backBtn');
          if(q && box && !(q.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING)) out.push('질문이 선택지보다 뒤에 있음');
          if(back && box && !(box.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING)) out.push('뒤로 단추가 선택지보다 앞에 있음');
          if(!document.getElementById('live')) out.push('알림 칸(live)이 없음');
          return out;
        });
        bad.forEach(b => errors.push(`접근성 점검(${view === '1' ? '그림' : '소리와 글'}) ${sc.slice(0, 40)}: ${b}`)); n++;
      }
      await ctx.close(); return n;
    };
    const a = await audit('2'), g = await audit('1');
    console.log(`접근성 점검: 소리와 글 ${a}개 화면, 그림 ${g}개 화면`);
  }
  // 경기가 끝났다는 표시는 그 결과에서 경기가 끝났을 때만: 육성·건너뛰기에서 내 타석 뒤에 경기가 끝까지 진행되어도 내 타석에 "끝내기!"를 붙이지 않음
  {
    const ctx = await browser.newContext({ viewport:{ width:1024, height:768 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`끝내기 표시 시험: ${e.message}`));
    await page.goto(`http://localhost:${PORT}/baseball/`); await page.waitForSelector('#opts .opt'); await page.keyboard.press('1');
    const r = await page.evaluate(() => {
      let found = null;
      for(let n = 0; n < 300 && !found; n++){
        G = newGame({ mode:'detail', innings:3, teams:[TEAMS[n % 10].key, TEAMS[(n + 3) % 10].key], ctrl:['cpu', 'cpu'], easy:1, seed:9100 + n }); flush(G);
        let g = 0, last; while(!G.over && g++ < 3000) last = G.review ? resolveReview(G, false) : playStep(G, aiDefChoice(G), aiOffChoice(G));
        if(G.walkoff && !last.events.some(e => e.k === 'pa' && e.r === 'hr')) found = last;
      }
      const mine = [{ k:'pitch' }, { k:'contact', big:false }, { k:'pa', r:'b1' }];   // 건너뛰기 전에 내가 한 타석의 사건 (경기 끝 사건 없음)
      return { over: G.over, walkoff: G.walkoff, mine: bannerOf(mine), end: bannerOf(found.events), none: bannerOf([{ k:'pa', r:'out' }]) };
    });
    if(!r.over || !r.walkoff) errors.push('끝내기 표시 시험: 시험용 끝내기 경기를 만들지 못함');
    if(!r.mine || r.mine[0] !== '안타!') errors.push('끝내기 표시 시험: 경기가 이미 끝난 상태에서 내 타석 결과가 안타가 아닌 글씨로 나옴 ' + JSON.stringify(r.mine));
    if(!r.end || r.end[0] !== '끝내기!') errors.push('끝내기 표시 시험: 끝내기 결과에 끝내기 글씨가 없음 ' + JSON.stringify(r.end));
    console.log('끝내기 표시 시험:', JSON.stringify({ 내타석: r.mine && r.mine[0], 마지막타석: r.end && r.end[0] }));
    await ctx.close();
  }
  await browser.close(); srv.kill();
  if(errors.length){ console.log('오류:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
  console.log('오류 없음');
})().catch(e => { console.error(e); process.exit(1); });
