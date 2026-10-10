/* 브라우저 점검: 화면 캡처 + 봇이 실제 버튼을 눌러 여정을 끝까지 진행한다.
 * 실행 (저장소 루트에서 정적 서버를 띄운 뒤):
 *   python3 -m http.server 8765 &
 *   NODE_PATH=$(npm root -g) node dicebound/tests/e2e.js [출력 폴더] [여정 수]
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/dicebound/';
const OUT = process.argv[2] || 'e2e-out';
const RUNS = +process.argv[3] || 3;
fs.mkdirSync(OUT, { recursive: true });

const VIEWS = [
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'phone-land', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'tablet', viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'tablet-land', viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'pc', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
];

async function idle(page) {
  await page.waitForFunction(() => !window.DB.ui.busy && !document.querySelector('.modal-back:not(.dice-picker-back)') || document.querySelector('.modal.dice-picker'), null, { timeout: 15000 });
}

// 봇 결정을 실제 DOM 클릭으로 실행한다
async function act(page, a) {
  const click = async sel => { const el = await page.$(sel); if (!el) throw new Error('버튼 없음: ' + sel + ' ' + JSON.stringify(a)); await el.click(); };
  switch (a.kind) {
    case 'replaceDie': return click(`.modal.dice-picker [data-slot="${a.slot}"]`);
    case 'node': await click(`[data-node="${a.id}"]`); return click('[data-act="go"]');
    case 'potion': await click(`.hud [data-pot="${a.idx}"]`); return click('.modal-actions .btn:last-child');
    case 'reroll': for (const i of a.sel) await click(`[data-die="${i}"]`); return click('[data-act="reroll"]');
    case 'attack': return click('[data-act="attack"]');
    case 'openChest': return click('[data-act="openChest"]');
    case 'takePotion': return click('[data-act="takePotion"]');
    case 'relic': return click(`[data-rrelic="${a.id}"]`);
    case 'rewardDie': return click(`[data-rdie="${a.id}"]`);
    case 'buy': return click(`[data-buy="${a.idx}"]`);
    case 'restHeal': return click('[data-act="restHeal"]');
    case 'restMeditate': return click('[data-act="restMeditate"]');
    case 'restTrain': return click(`[data-train="${a.id}"]`);
    case 'event': return click(`[data-ev="${a.idx}"]`);
    case 'eventDie': return click(`[data-edie="${a.id}"]`);
    case 'leave': return click('[data-act="leave"]');
    default: throw new Error('알 수 없는 행동 ' + a.kind);
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errors = [];
  const shots = {};
  // 1) 화면 크기별 캡처
  for (const v of VIEWS) {
    const { name, ...opt } = v;
    const ctx = await browser.newContext(Object.assign({ locale: 'ko-KR' }, opt));
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`[${v.name}] ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`[${v.name}] console: ${m.text()}`); });
    page.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) errors.push(`[${v.name}] 요청 실패 ${r.url()}`); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`[${v.name}] ${r.status()} ${r.url()}`); });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => { DB.game.settings.reduceMotion = true; DB.game.settings.autoFS = false; });
    await page.screenshot({ path: path.join(OUT, `${v.name}-1-menu.png`) });
    await page.addScriptTag({ path: path.join(__dirname, 'bot.js') });
    await page.evaluate(() => DB.RNG.seed(7));
    await page.click('[data-act="newRun"]');
    await page.screenshot({ path: path.join(OUT, `${v.name}-2-map.png`) });
    // 전투까지 진행하고, 재굴림할 주사위를 골라 둔 상태를 캡처
    const first = await page.evaluate(() => DB.game.available()[0]);
    await page.click(`[data-node="${first}"]`);
    await page.screenshot({ path: path.join(OUT, `${v.name}-3-map-select.png`) });
    await page.click('[data-act="go"]');
    await idle(page);
    await page.click('[data-die="0"]'); await page.click('[data-die="2"]');
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, `${v.name}-4-battle.png`) });
    // 각 화면을 강제로 열어 캡처 (게임 함수로 상태를 만든다)
    await page.evaluate(() => { const G = DB.game; G.run.battle = null; G.run.gold = 140; G.run.floor = 4; G.run.screen = 'map'; });
    for (const [name, type] of [['5-shop', 'shop'], ['6-treasure', 'treasure'], ['7-rest', 'rest'], ['8-event', 'event'], ['9-elite', 'elite'], ['10-boss', 'boss']]) {
      await page.evaluate(t => {
        const G = DB.game, r = G.run;
        r.screen = 'map'; r.battle = null; r.reward = null; r.shop = null; r.rest = null; r.event = null; r.pendingDice = null;
        const id = Object.keys(r.map.nodes).find(k => r.map.nodes[k].type === t) || Object.keys(r.map.nodes)[0];
        const n = r.map.nodes[id]; const old = n.type; n.type = t;
        r.pos = null; r.map.nodes[id].f = r.map.nodes[id].f;
        // 연결 여부와 상관없이 해당 노드로 들어간다 (화면 확인용)
        G.available = () => [id];
        G.chooseNode(id);
        n.type = old;
      }, type);
      await idle(page);
      if (type === 'treasure') await page.click('[data-act="openChest"]');
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(OUT, `${v.name}-${name}.png`) });
    }
    await page.evaluate(() => { delete DB.game.available; });
    await page.close(); await ctx.close();
  }

  // 2) 봇이 버튼을 눌러 여정을 끝까지 진행 (휴대폰 화면)
  const results = [];
  for (let k = 0; k < RUNS; k++) {
    const v = VIEWS[k % VIEWS.length];
    const { name, ...opt } = v;
    const ctx = await browser.newContext(Object.assign({ locale: 'ko-KR' }, opt));
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`[run${k}] ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`[run${k}] console: ${m.text()}`); });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.addScriptTag({ path: path.join(__dirname, 'bot.js') });
    await page.evaluate(s => { DB.game.settings.reduceMotion = true; DB.game.settings.autoFS = false; DB.RNG.seed(s); }, 100 + k);
    await page.click('[data-act="newRun"]');
    let steps = 0, shotEnd = false, reloaded = false;
    while (steps < 1500) {
      await idle(page);
      const st = await page.evaluate(() => ({ screen: DB.game.run && DB.game.run.screen, a: DB.bot.step(), hp: DB.game.run && DB.game.run.hp, gold: DB.game.run && DB.game.run.gold, floor: DB.game.run && DB.game.run.floor }));
      if (st.gold < 0 || st.hp < 0) errors.push(`[run${k}] 음수 값 ${JSON.stringify(st)}`);
      if (st.screen === 'end') { shotEnd = true; break; }
      // 중간에 한 번 새로고침해서 이어하기가 되는지 확인
      if (!reloaded && st.screen === 'map' && st.floor >= 4) {
        reloaded = true;
        await page.reload({ waitUntil: 'networkidle' });
        await page.addScriptTag({ path: path.join(__dirname, 'bot.js') });
        await page.evaluate(() => { DB.game.settings.reduceMotion = true; DB.game.settings.autoFS = false; });
        await page.click('[data-act="cont"]');
        continue;
      }
      try { await act(page, st.a); } catch (e) { errors.push(`[run${k}] ${e.message}`); break; }
      steps++;
    }
    const res = await page.evaluate(() => ({ result: DB.game.run && DB.game.run.result, floor: DB.game.run && DB.game.run.floor, boss: DB.game.run && DB.game.run.bossKey }));
    results.push(Object.assign({ view: v.name, steps }, res));
    if (shotEnd) await page.screenshot({ path: path.join(OUT, `run${k}-end-${v.name}.png`) });
    if (k === 0 && shotEnd) {
      await page.click('[data-act="toMenu"]');
      for (const t of ['codex', 'ach', 'settings']) {
        await page.click(`[data-act="sheet"][data-tab="${t}"]`);
        await page.screenshot({ path: path.join(OUT, `sheet-${t}.png`) });
        await page.click('.modal-actions .btn');
      }
    }
    await page.close(); await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 1));
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  process.exit(errors.length ? 1 : 0);
})();
