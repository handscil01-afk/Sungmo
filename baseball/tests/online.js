// 온라인 대전 시험: Firebase 에뮬레이터(데이터베이스 9000, 인증 9099)를 켜 둔 채로 실행함.
//   firebase emulators:start --only database,auth --project handscil-sports  (firebase.json의 database.rules는 sports-day/database.rules.json)
// 사용법: node baseball/tests/online.js [simple|detail] [스크린샷 폴더]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const mode = process.argv[2] || 'detail';
const shots = process.argv[3] || null;
const PORT = 8769, URL0 = `http://localhost:${PORT}/baseball/?emu=1`;

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', root], { stdio:'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch({ args:['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const errors = [];
  const mk = async (name, url) => {
    const ctx = await browser.newContext({ viewport:{ width:390, height:844 }, permissions:['microphone'] });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    p.on('console', m => { if(m.type() === 'error' && !/favicon/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
    await p.goto(url); await p.waitForSelector('#q');
    // 처음 실행이면 화면 방식 고르기가 먼저 나옴 (방장은 도트 그림 모드, 손님은 시각장애인 모드로 시험)
    if((await p.$eval('#q', e => e.textContent)).includes('어떤 방식으로')) await p.keyboard.press(name === '방장' ? '1' : '2');
    return p;
  };
  const q = p => p.$eval('#q', e => e.textContent);
  const waitQ = (p, re, ms = 15000) => p.waitForFunction(r => new RegExp(r).test(document.querySelector('#q').textContent), re.source, { timeout:ms });
  const say = async (p, t) => { await p.fill('#cmd', t); await p.press('#cmd', 'Enter'); };
  const shot = async (p, n) => { if(shots) await p.screenshot({ path: path.join(shots, n + '.png') }); };

  // 방장: 온라인 대전 → 방 만들기 → 이름 → 모드 → 팀 → 공격 순서 → 1이닝
  const host = await mk('방장', URL0);
  await host.keyboard.press('3'); await host.keyboard.press('1');
  await waitQ(host, /이름을/); await say(host, '센터장');
  await waitQ(host, /어떤 방식/);
  for(const k of [...({ simple:['1', '1'], detail:['2', '3'], manager:['3'] }[mode]), '1', '1', '1', process.argv[4] || '1']) await host.keyboard.press(k);
  await waitQ(host, /방 코드는/);
  const code = await host.evaluate(() => NET.code);
  console.log('방 코드', code);
  await shot(host, 'on-host-lobby');

  // 손님: 초대 링크로 열기 → 이름 → 들어가기
  const guest = await mk('손님', `${URL0}&room=${code}`);
  await waitQ(guest, /이름을/); await say(guest, '선생님');
  await waitQ(guest, /시작하기를 기다립니다/);
  await waitQ(host, /들어왔습니다/);
  await shot(guest, 'on-guest-lobby');

  // 다른 사람(세 번째 기기)은 들어갈 수도, 경기 상태를 읽을 수도 없어야 함
  const third = await mk('구경꾼', URL0);
  const tr = await third.evaluate(async c => {
    const F = await fbInit(); const out = {};
    try{ await F.R.get(F.ref(c + '/state')); out.state = '읽힘'; }catch(e){ out.state = '막힘'; }
    try{ await F.R.set(F.ref(c + '/guest'), { uid:F.uid, name:'끼어들기', at:1 }); out.guest = '들어감'; }catch(e){ out.guest = '막힘'; }
    try{ await F.R.set(F.ref(c + '/state'), { n:999 }); out.write = '써짐'; }catch(e){ out.write = '막힘'; }
    return out;
  }, code);
  console.log('구경꾼:', JSON.stringify(tr));
  if(tr.state !== '막힘' || tr.guest !== '막힘' || tr.write !== '막힘') errors.push('구경꾼 권한이 막히지 않음 ' + JSON.stringify(tr));
  // 손님은 방장에게 보내는 선택(act)을 읽을 수 없어야 함
  const ga = await guest.evaluate(async c => { const F = await fbInit(); try{ await F.R.get(F.ref(c + '/act')); return '읽힘'; }catch(e){ return '막힘'; } }, code);
  console.log('손님이 act 읽기:', ga); if(ga !== '막힘') errors.push('손님이 act를 읽음');

  // 채팅 (명령 칸에 적기)
  await say(guest, '안녕하세요 반가워요');
  await host.waitForFunction(() => NET.chats.some(c => c.t === '안녕하세요 반가워요'), null, { timeout:8000 });
  console.log('채팅 전달됨');

  // 음성 대화: 두 기기 모두 켜기 (채팅과 음성 대화 화면 8번)
  await host.keyboard.press('4'); await waitQ(host, /채팅과 음성/); await host.keyboard.press('8');
  await guest.keyboard.press('4'); await waitQ(guest, /채팅과 음성/); await guest.keyboard.press('8');
  try{
    await host.waitForFunction(() => VC.connected, null, { timeout:15000 });
    await guest.waitForFunction(() => VC.connected, null, { timeout:15000 });
    console.log('음성 직접 연결됨');
  }catch(e){ errors.push('음성이 연결되지 않음'); }
  await host.keyboard.press('.'); await guest.keyboard.press('.');

  // 경기 시작 → 양쪽이 무작위로 골라 끝까지
  await waitQ(host, /경기를 시작할까요/); await host.keyboard.press('1');
  await waitQ(guest, /어떻게|어떤 공|고르는 중|타순과/);
  await shot(host, 'on-host-game'); await shot(guest, 'on-guest-game');
  const skip = mode === 'manager' ? /더 보기|채팅|설정|나가기|닫기|상대 팀 보기/ : /더 보기|채팅|설정|나가기|닫기|작전|노림수|맡기기|수비 위치/;
  let steps = 0;
  for(; steps < 3000; steps++){
    const [qh, qg] = [await q(host), await q(guest)];
    if(/경기가 끝났습니다/.test(qh) && /경기가 끝났습니다/.test(qg)) break;
    let moved = false;
    for(const p of [host, guest]){
      const qq = p === host ? qh : qg;
      if(/고르는 중|끝났습니다|시작하기를|준비하기를/.test(qq)) continue;
      const os = (await p.$$eval('#opts .opt', els => els.map(e => ({ n:e.dataset.n, t:e.querySelector('b').textContent })))).filter(o => !skip.test(o.t));
      if(!os.length){ await p.keyboard.press('.'); continue; }
      await p.keyboard.press(os[Math.floor(Math.random() * os.length)].n); moved = true;
    }
    if(!moved) await host.waitForTimeout(120);
  }
  const sb = await Promise.all([host, guest].map(p => p.evaluate(() => scoreboard(G).join(' '))));
  console.log(`경기 끝 (${steps}번). 방장: ${sb[0]}`);
  if(sb[0] !== sb[1]) errors.push('두 기기의 점수판이 다름: ' + sb.join(' / '));
  if(steps >= 3000) errors.push('경기가 끝나지 않음');
  await shot(host, 'on-host-end'); await shot(guest, 'on-guest-end');

  // 한 판 더 → 새 경기가 손님에게도 시작됨
  await host.keyboard.press('1');
  await waitQ(guest, /어떻게|어떤 공|고르는 중|타순과/);
  console.log('한 판 더 시작됨');

  // 손님이 방에서 나감 → 방장에게 알림
  await guest.click('#menuBtn'); await waitQ(guest, /더 보기/);
  await guest.keyboard.press('9');
  await guest.waitForSelector('#dlg.open'); await guest.click('#dlg [data-dlg="0"]');
  await waitQ(guest, /무엇을 할까요/);
  await host.waitForFunction(() => !NET.peer, null, { timeout:8000 });
  console.log('손님 나감 처리됨');

  await browser.close(); srv.kill();
  if(errors.length){ console.log('오류:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
  console.log('오류 없음');
})().catch(e => { console.error(e); process.exit(1); });
