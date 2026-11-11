// 화면 스크린샷 모음과 비교. 화면 보며 하기 정리(Phase 4)처럼 "보이는 모습이 그대로여야 하는" 작업에서 씀.
//   node baseball/tests/shots.js save <폴더>             화면 열두 곳을 휴대폰 세로·가로·태블릿 × 두 화면 방식으로 찍어 저장
//   node baseball/tests/shots.js compare <폴더A> <폴더B>  같은 이름의 그림을 점 단위로 견줌 (캔버스 그림판은 가리고 찍음: 움직임이라 매번 다름)
const fs = require('fs'), path = require('path');
const mode = process.argv[2];
if(mode === 'compare'){
  // 같은 이름의 그림을 견줌. 글자 가장자리·캔버스 테두리의 한두 점 차이는 무시(30점 이하)
  const [A, B] = process.argv.slice(3), diff = [];
  const py = `
import sys
from PIL import Image, ImageChops
a = Image.open(sys.argv[1]).convert('RGB'); b = Image.open(sys.argv[2]).convert('RGB')
if a.size != b.size: print(-1)
else:
    d = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v > 24 else 0)
    print(sum(1 for v in d.getdata() if v))`;
  fs.readdirSync(A).filter(f => f.endsWith('.png')).forEach(f => {
    if(!fs.existsSync(path.join(B, f))){ diff.push(f + ' (없음)'); return; }
    const r = require('child_process').spawnSync('python3', ['-I', '-c', py, path.join(A, f), path.join(B, f)], { encoding:'utf8' });
    const n = parseInt(r.stdout, 10);
    if(!(n <= 30)) diff.push(`${f} (${n < 0 ? '크기가 다름' : n + '점'})`);
  });
  console.log(diff.length ? `달라진 그림 ${diff.length}장:\n  ${diff.join('\n  ')}` : '모든 그림이 같음');
  process.exit(diff.length ? 1 : 0);
}
const { chromium } = require('playwright'), { spawn } = require('child_process');
const out = process.argv[3]; fs.mkdirSync(out, { recursive:true });
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8776', '--directory', path.join(__dirname, '..', '..')], { stdio:'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  for(const [name, w, h] of [['phone', 390, 844], ['land', 844, 390], ['tablet', 1024, 768]]) for(const view of ['gfx', 'a11y']){
    const ctx = await b.newContext({ viewport:{ width:w, height:h }, deviceScaleFactor:1, hasTouch:name !== 'tablet' });
    const p = await ctx.newPage(); p.on('pageerror', e => console.log('오류', e.message));
    await p.goto('http://localhost:8776/baseball/'); await p.waitForSelector('#opts .opt');
    await p.keyboard.press(view === 'gfx' ? '1' : '2');
    await p.addStyleTag({ content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
    const snap = async tag => { await p.waitForLoadState('networkidle'); await p.waitForTimeout(500); await p.screenshot({ path: path.join(out, `${name}-${view}-${tag}.png`), mask: [p.locator('canvas'), p.locator('#hero')], maskColor:'#ff00ff' }); };
    const show = (fn, ...a) => p.evaluate(([f, args]) => { window.__susp = true; return eval(f)(...args); }, [fn, a]);
    await snap('home');
    await p.evaluate(() => go(() => settingsScreen(() => go(homeScreen, 'click'), 0), 'click')); await snap('set0');
    await p.evaluate(() => go(() => settingsScreen(() => go(homeScreen, 'click'), 2), 'click')); await snap('set2');
    await p.evaluate(() => { NEW.kind = '1p'; NEW.a = null; go(() => teamScreen(0), 'click'); }); await snap('team');
    await p.evaluate(() => { SET.picks = { ...picks() }; startGame({ mode:'detail', unit:'pa', innings:3, teams:[TEAMS[0].key, TEAMS[1].key], ctrl:['human', 'cpu'], who:['', ''], diff:1, easy:1, seed:11 }, 'click'); }); await snap('off');
    await p.evaluate(() => { startGame({ mode:'detail', unit:'pa', innings:3, teams:[TEAMS[0].key, TEAMS[1].key], ctrl:['cpu', 'human'], who:['', ''], diff:1, easy:1, seed:12 }, 'click'); }); await snap('def');
    await p.evaluate(() => { startGame({ mode:'simple', unit:'pa', innings:3, teams:[TEAMS[0].key, TEAMS[1].key], ctrl:['human', 'cpu'], who:['', ''], diff:1, easy:1, seed:13 }, 'click'); }); await snap('simple');
    await p.evaluate(() => go(() => moreScreen(), 'click')); await snap('more');
    await ctx.close();
  }
  await b.close(); srv.kill();
})();
