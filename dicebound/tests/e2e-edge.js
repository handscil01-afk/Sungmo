/* 봇이 쓰지 않는 기능 점검: 뒤로 가기로 창 닫기, 변환 주사위·두루마리, 미리보기=실제 피해, 상점 결제
 * 실행: NODE_PATH=$(npm root -g) node dicebound/tests/e2e-edge.js (저장소 루트에서 http.server 8765 실행 중) */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (name, v) => console.log((v ? '통과 ' : '실패 ') + name);
  await p.goto(process.env.BASE || 'http://127.0.0.1:8765/dicebound/', { waitUntil: 'networkidle' });
  await p.evaluate(() => { DB.game.settings.reduceMotion = true; DB.game.settings.autoFS = false; DB.RNG.seed(3); });
  // 뒤로 가기로 정보창 닫기
  await p.click('[data-act="sheet"][data-tab="codex"]');
  ok('정보창 열림', await p.$('.modal.sheet') !== null);
  await p.goBack(); await p.waitForTimeout(300);
  ok('뒤로 가기로 정보창 닫힘', await p.$('.modal') === null && p.url().includes('/dicebound/'));
  // 창 안에서 다른 창으로 이어지는 흐름 (닫기 직후 새 창)
  await p.click('[data-act="newRun"]'); await p.click('[data-act="pickHero"]');
  await p.click('.hud .round[data-act="sheet"]'); await p.click('.tab[data-tab="settings"]');
  await p.click('#sAbandon'); await p.waitForTimeout(200);
  ok('포기 확인 창이 바로 닫히지 않음', (await p.$$('.modal')).length === 1);
  await p.click('.modal-actions .btn:first-child'); await p.waitForTimeout(200);
  ok('취소 후 창 없음', await p.$('.modal') === null);
  // 전투: 변환 주사위와 변환의 두루마리
  await p.evaluate(() => { const G = DB.game; G.run.dice[0] = { kind: 'transmute' }; G.run.potions = ['fate', 'heal']; });
  const first = await p.evaluate(() => DB.game.available()[0]);
  await p.click(`[data-node="${first}"]`); await p.click('[data-act="go"]');
  await p.click('[data-act="transmute"]'); await p.click('.modal [data-v="6"]'); await p.waitForTimeout(200);
  ok('변환 주사위 적용', await p.evaluate(() => DB.game.run.battle.values[0] === 6 && DB.game.run.battle.transmuteUsed));
  ok('변환 버튼 사라짐', await p.$('[data-act="transmute"]') === null);
  await p.click('.hud [data-pot="0"]'); await p.click('.modal-actions .btn:last-child'); await p.waitForTimeout(200);
  await p.click('#fpDice [data-i="3"]'); await p.click('#fpVals [data-v="2"]'); await p.waitForTimeout(200);
  ok('변환의 두루마리 적용', await p.evaluate(() => DB.game.run.battle.values[3] === 2 && DB.game.run.potions.length === 1));
  // 미리보기 피해 = 실제 피해
  // 적의 차례가 시작될 때 출혈(중첩만큼)·화상(3) 피해가 더 들어가므로 그것까지 계산한다. 적이 회복하는 행동이면 비교를 건너뛴다.
  const pv = await p.evaluate(() => { const b = DB.game.run.battle, pr = DB.game.preview(), e = b.enemy;
    return { atk: pr.atk, hp: e.hp, blk: e.status.block, bleed: e.status.bleed + pr.apply.bleed, burn: e.status.burn + pr.apply.burn, heals: !!e.intent.heal }; });
  await p.click('[data-act="attack"]'); await p.waitForFunction(() => !DB.ui.busy);
  const after = await p.evaluate(() => DB.game.run.battle ? DB.game.run.battle.enemy.hp : 0);
  const hit = Math.max(0, pv.hp - Math.max(0, pv.atk - pv.blk));
  const expect = hit === 0 ? 0 : Math.max(0, hit - pv.bleed - (pv.burn > 0 ? 3 : 0));
  ok(`미리보기 피해(${pv.atk})와 실제 피해 일치`, pv.heals || after === expect);
  // 상점: 골드 부족, 주사위 구매 취소
  await p.evaluate(() => { const G = DB.game, r = G.run; r.battle = null; r.screen = 'map'; r.gold = 35; const id = Object.keys(r.map.nodes)[0]; r.map.nodes[id].type = 'shop'; G.available = () => [id]; G.chooseNode(id); delete G.available; });
  const idx = await p.evaluate(() => DB.game.run.shop.items.findIndex(i => i.cat === 'relic'));
  await p.click(`[data-buy="${idx}"]`); await p.waitForTimeout(150);
  ok('골드 부족 시 그대로', await p.evaluate(i => DB.game.run.gold === 35 && !DB.game.run.shop.items[i].sold, idx) && await p.$(`[data-buy="${idx}"]:not([disabled])`) !== null);
  const di = await p.evaluate(() => DB.game.run.shop.items.findIndex(i => i.cat === 'dice' && i.price <= 35));
  if (di >= 0) {
    await p.click(`[data-buy="${di}"]`); await p.waitForTimeout(150);
    ok('주사위 교체 창 열림', await p.$('.modal.dice-picker') !== null);
    await p.goBack(); await p.waitForTimeout(300);
    ok('뒤로 가기로 취소, 결제 없음', await p.evaluate(i => DB.game.run.gold === 35 && !DB.game.run.shop.items[i].sold && !DB.game.run.pendingDice, di) && await p.$('.modal') === null);
    await p.click(`[data-buy="${di}"]`); await p.click('.modal.dice-picker [data-slot="4"]'); await p.waitForTimeout(150);
    ok('교체 후 한 번만 결제', await p.evaluate(i => { const r = DB.game.run, it = r.shop.items[i]; return it.sold && r.gold === 35 - it.price && r.dice[4].kind === it.id; }, di));
    await p.click(`[data-buy="${di}"]`).catch(() => {});
    ok('판매 완료 상품 재구매 불가', await p.evaluate(i => DB.game.run.gold === 35 - DB.game.run.shop.items[i].price, di));
  }
  console.log(errs.length ? '오류: ' + errs.join(' | ') : '페이지 오류 없음');
  await b.close();
})();
