// 실행: node dicebound/tests/sim.js [여정 수]
// 봇으로 여정을 끝까지 진행하며 규칙 위반(음수 골드, 체력 초과 등)과 승률을 확인한다.
'use strict';
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } };
require('../js/util.js'); require('../js/data.js'); require('../js/rules.js'); require('../js/game.js'); require('./bot.js');
const DB = globalThis.DB, G = DB.game;
const N = +process.argv[2] || 300;
G.load();
let wins = 0, errors = 0, floors = [], hpLeft = [], byBoss = {}, deaths = {}, byHero = {};
for (let s = 1; s <= N; s++) {
  const hero = ['druid', 'archer', 'knight', 'warrior'][s % 4];
  G.newRun(hero, 1000 + s);
  let steps = 0, lastKey = '';
  while (G.run.screen !== 'end' && steps < 3000) {
    const a = DB.bot.step();
    const ok = DB.bot.apply(a);
    const r = G.run;
    if (r.gold < 0 || r.hp > r.maxHp || r.hp < 0 || r.dice.length !== 5 || r.potions.length > 3) { errors++; console.log('규칙 위반', s, a, r.gold, r.hp, r.maxHp); break; }
    if (!ok) {
      const key = JSON.stringify(a) + r.screen;
      if (key === lastKey) { errors++; console.log('진행 막힘', s, a, r.screen); break; }
      lastKey = key;
    } else lastKey = '';
    steps++;
  }
  const r = G.run;
  if (r.screen !== 'end') { errors++; console.log('끝나지 않음', s, r.screen); continue; }
  floors.push(r.floor);
  byBoss[r.bossKey] = byBoss[r.bossKey] || [0, 0]; byBoss[r.bossKey][1]++;
  byHero[r.hero] = byHero[r.hero] || [0, 0]; byHero[r.hero][1]++; if (r.result.won) byHero[r.hero][0]++;
  if (r.result.won) { wins++; hpLeft.push(r.hp); byBoss[r.bossKey][0]++; }
  else { const k = r.result.enemy || '?'; deaths[k] = (deaths[k] || 0) + 1; }
}
const avg = a => (a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(1);
console.log(`여정 ${N}회, 승리 ${wins} (${(wins / N * 100).toFixed(0)}%), 오류 ${errors}, 평균 도달 층 ${avg(floors)}, 승리 시 남은 체력 ${avg(hpLeft)}`);
console.log('보스별 [승, 판]', JSON.stringify(byBoss));
console.log('주인공별 [승, 판]', JSON.stringify(byHero));
console.log('패배 원인', JSON.stringify(deaths));
process.exit(errors ? 1 : 0);
