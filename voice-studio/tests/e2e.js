// 녹음실 앱 시험: 구글 API를 가짜 응답으로 바꿔 끝까지 만들고, 하루 한도·이어 만들기·경계 옮기기·zip 받기를 확인
// 사용법: node voice-studio/tests/e2e.js [실제녹음.wav 묶음코드] [스크린샷 폴더]
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..'), PORT = 8793;
const [realWav, realCode, shots] = process.argv.slice(2);
const errors = [], ok = (c, m) => { if(!c) errors.push(m); };
function tone(n){  // 줄마다 0.8초 소리 + 1.2초 무음
  const sr = 24000, seg = [];
  for(let k = 0; k < n; k++){ for(let i = 0; i < sr * 0.8; i++) seg.push(Math.round(Math.sin(i * 0.07) * 9000 * (1 + (k % 3) / 3))); for(let i = 0; i < sr * 1.2; i++) seg.push(0); }
  return Buffer.from(new Int16Array(seg).buffer);
}
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', root], { stdio:'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch();
  const real = realWav ? fs.readFileSync(realWav).subarray(44) : null;
  let calls = 0, dailyAfter = 4;
  for(const [name, w, h] of [['phone', 390, 844], ['tablet', 1024, 768]]){
    const ctx = await browser.newContext({ viewport:{ width:w, height:h }, hasTouch: name === 'phone', acceptDownloads:true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    page.on('console', m => { if(m.type() === 'error' && !/429|Failed to load resource/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
    await page.route('https://generativelanguage.googleapis.com/**', async route => {
      const req = route.request();
      if(req.method() === 'GET') return route.fulfill({ json:{ models:[{ name:'models/gemini-3.8-flash-tts' }] } });
      ok(req.headers()['x-goog-api-key'] === 'TESTKEY-1234', `${name}: API 키가 요청 머리에 없음`);
      calls++;
      if(name === 'phone' && calls === dailyAfter) return route.fulfill({ status:429, body: JSON.stringify({ error:{ code:429, message:'quota', details:[{ violations:[{ quotaId:'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } }) });
      const body = JSON.parse(req.postData()), text = body.contents[0].parts[0].text;
      ok(/exactly as written/.test(text), `${name}: 글자 그대로 읽으라는 지시가 없음`);
      const n = text.split('Lines:\n')[1].split('\n\n').length;
      const pcm = real && text.includes('실책은 흐름을 바꿀 수 있어요.') ? real : tone(n);
      route.fulfill({ json:{ candidates:[{ content:{ parts:[{ inlineData:{ mimeType:'audio/L16;codec=pcm;rate=24000', data: pcm.toString('base64') } }] } }] } });
    });
    await page.addInitScript(() => { try{ if(!localStorage.getItem('voice-studio-cfg')) localStorage.setItem('voice-studio-cfg', JSON.stringify({ wait:0 })); }catch(e){} });
    await page.goto(`http://localhost:${PORT}/voice-studio/`);
    await page.waitForFunction(() => window.__vs && window.__vs.BUNDLES().length > 0);
    ok(await page.isVisible('#banner'), `${name}: 첫 화면에 설치 안내가 없음`);
    if(shots) await page.screenshot({ path: path.join(shots, `vs-${name}-first.png`) });
    // 키 없이 누르면 키 창
    await page.click('#run'); ok(await page.isVisible('#kIn'), `${name}: 키 없이 만들기를 누르면 키 창이 떠야 함`);
    await page.fill('#kIn', 'TESTKEY-1234'); await page.click('[data-a="test"]');
    await page.waitForFunction(() => /쓸 수 있는 키/.test(document.getElementById('kMsg').textContent));
    await page.click('[data-a="save"]');
    ok((await page.textContent('#keyState')).includes('TESTK…1234'), `${name}: 저장된 키가 가려져 보이지 않음`);
    // 자동으로 만들기
    await page.click('#run');
    if(name === 'phone'){
      await page.waitForFunction(() => /한도를 다 썼습니다/.test(document.getElementById('status').textContent), null, { timeout:60000 });
      const made = await page.evaluate(() => Object.keys(window.__vs.REC).length);
      ok(made === dailyAfter - 1, `phone: 하루 한도 전까지 ${dailyAfter - 1}개를 만들어야 하는데 ${made}개`);
      // 키 바꾸기 (설정 → API 키 바꾸기)
      await page.click('#hSet'); await page.click('[data-a="key"]'); await page.fill('#kIn', 'TESTKEY-1234'); await page.click('[data-a="save"]');
      // 새로 고쳐도 남아 있는지, 이어서 만들기
      await page.reload(); await page.waitForFunction(() => window.__vs && Object.keys(window.__vs.REC).length > 0);
      ok((await page.textContent('#run')).includes('이어서'), 'phone: 새로 고친 뒤 이어서 만들기 버튼이 아님');
      await page.click('#run');
    }
    await page.waitForFunction(() => /모든 묶음을 다 만들었습니다/.test(document.getElementById('status').textContent), null, { timeout:120000 });
    const st = await page.evaluate(() => { const B = window.__vs.BUNDLES(), R = window.__vs.REC; return { n:B.length, made:B.filter(b => R[b.code]).length, ok:B.filter(b => R[b.code] && R[b.code].ok && R[b.code].segs.length === b.lines.length).length }; });
    ok(st.made === st.n && st.ok === st.n, `${name}: 묶음 ${st.n}개 중 만든 것 ${st.made}, 맞게 잘린 것 ${st.ok}`);
    if(real){
      const r = await page.evaluate(c => { const x = window.__vs.REC[c]; return { ok:x.ok, warn:x.segs.filter(s => s.warn).length, segs:x.segs.length }; }, realCode);
      ok(r.ok && r.warn === 0, `${name}: 실제 녹음 묶음 ${realCode}가 깔끔하게 잘리지 않음 ${JSON.stringify(r)}`);
    }
    // 묶음 열기, 경계 옮기기, 들어 봄 표시
    await page.click(`#list [data-code="${realCode || 'C1-01'}"]`);
    if(shots) await page.screenshot({ path: path.join(shots, `vs-${name}-detail.png`) });
    // 옮길 수 있는 경계(한 줄 안에 쉬는 곳이 있는 곳)를 찾아 옮겨 봄
    const code = realCode || 'C1-01';
    const moved = await page.evaluate(async c => {
      const n = document.querySelectorAll('.sheet [data-a="m"]').length;
      for(let i = 0; i < n; i++){ const b = document.querySelectorAll('.sheet [data-a="m"]')[i], k = +b.dataset.k, before = window.__vs.REC[c].segs[k].e;
        b.click(); await new Promise(z => setTimeout(z, 80)); if(window.__vs.REC[c].segs[k].e !== before) return true; }
      return false;
    }, code);
    ok(moved, `${name}: 옮길 수 있는 경계가 하나도 옮겨지지 않음`);
    await page.click('.sheet [data-a="ok"]');
    ok(await page.evaluate(c => window.__vs.REC[c].checked, realCode || 'C1-01'), `${name}: 다 들어 봄 표시가 안 됨`);
    await page.click('.sheet [data-close].wide');
    // 가로 넘침
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(ov <= 1, `${name}: 가로로 ${ov}px 넘침`);
    if(shots) await page.screenshot({ path: path.join(shots, `vs-${name}-done.png`) });
    // zip 받기
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#zip')]);
    const zp = path.join(__dirname, `out-${name}.zip`); await dl.saveAs(zp);
    const list = execFileSync('python3', ['-c', `import zipfile,json,sys;z=zipfile.ZipFile(sys.argv[1]);m=json.loads(z.read('manifest.json'));print(len(m['lines']),len(z.namelist()),z.testzip())`, zp]).toString().trim().split(' ');
    ok(list[0] === '522' && list[1] === '523' && list[2] === 'None', `${name}: zip 내용이 맞지 않음 ${list}`);
    console.log(`${name}: 묶음 ${st.n}개, zip 줄 ${list[0]}개`);
    if(name === 'phone') console.log(execFileSync('python3', [path.join(root, 'baseball/tools/voice_import.py'), zp, '--dry']).toString().trim());
    fs.unlinkSync(zp);
    await ctx.close();
  }
  await browser.close(); srv.kill();
  if(errors.length){ console.log('실패:\n' + errors.join('\n')); process.exit(1); }
  console.log('모두 통과');
})();
