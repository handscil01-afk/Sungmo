// 실행: node dicebound/tests/rules.test.js
'use strict';
require('../js/util.js');
require('../js/data.js');
const R = require('../js/rules.js');
const DB = globalThis.DB;
let fail = 0, pass = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`실패: ${name}\n  기대: ${JSON.stringify(want)}\n  실제: ${JSON.stringify(got)}`); }
}

// 족보 판정
eq('하이 카드', R.evalHand([1, 3, 4, 5, 6]).id, 'high');
eq('하이 카드 피해', R.evalHand([1, 3, 4, 5, 6]).atk, 8);
eq('원 페어', R.evalHand([2, 2, 4, 5, 6]).id, 'pair');
eq('원 페어 피해', R.evalHand([2, 2, 4, 5, 6]).atk, 8);
eq('투 페어', R.evalHand([2, 2, 5, 5, 6]).id, 'twopair');
eq('투 페어 피해·방어', [R.evalHand([2, 2, 5, 5, 6]).atk, R.evalHand([2, 2, 5, 5, 6]).block], [16, 5]);
eq('트리플', R.evalHand([4, 4, 4, 1, 6]).id, 'triple');
eq('트리플 출혈', R.evalHand([4, 4, 4, 1, 6]).apply, { bleed: 2 });
eq('스트레이트 1-5', R.evalHand([3, 1, 2, 5, 4]).id, 'straight');
eq('스트레이트 2-6', R.evalHand([6, 2, 3, 5, 4]).atk, 18);
eq('1-2-3-4-6 은 스트레이트 아님', R.evalHand([1, 2, 3, 4, 6]).id, 'high');
eq('풀하우스', R.evalHand([3, 3, 3, 6, 6]).id, 'fullhouse');
eq('풀하우스 피해·회복', [R.evalHand([3, 3, 3, 6, 6]).atk, R.evalHand([3, 3, 3, 6, 6]).heal], [25, 6]);
eq('포카드', R.evalHand([5, 5, 5, 5, 2]).id, 'quad');
eq('포카드 피해', R.evalHand([5, 5, 5, 5, 2]).atk, 36);
eq('파이브', R.evalHand([6, 6, 6, 6, 6]).id, 'five');
eq('파이브 효과', (h => [h.atk, h.block, h.heal])(R.evalHand([6, 6, 6, 6, 6])), [70, 10, 10]);
eq('트리플 사용 주사위', R.evalHand([4, 1, 4, 6, 4]).used, [0, 2, 4]);

// 공격 파이프라인
const base = { relics: [], gold: 0, hp: 50, maxHp: 50, rerollsLeft: 1, enemyType: 'normal', status: {} };
const dice = v => v.map(x => ({ kind: null, value: x }));
eq('기본 공격 = 족보 피해', R.computeAttack(Object.assign({}, base, { dice: dice([2, 2, 4, 5, 6]) })).atk, 8);
eq('날 선 화살촉 +2', R.computeAttack(Object.assign({}, base, { relics: ['edge'], dice: dice([2, 2, 4, 5, 6]) })).atk, 10);
eq('왕관은 고정 보너스 뒤에 곱한다', R.computeAttack(Object.assign({}, base, { relics: ['edge', 'crown'], dice: dice([4, 4, 4, 1, 6]) })).atk, Math.floor((20 + 2) * 1.25));
eq('빙결 상태 ×0.7', R.computeAttack(Object.assign({}, base, { status: { freeze: 1 }, dice: dice([2, 2, 4, 5, 6]) })).atk, 5);
const steelIn = [{ kind: 'steel', value: 4 }].concat(dice([4, 4, 1, 6]));
eq('강철 주사위가 트리플에 포함', R.computeAttack(Object.assign({}, base, { dice: steelIn })).atk, 24);
const steelOut = [{ kind: 'steel', value: 1 }].concat(dice([4, 4, 4, 6]));
eq('강철 주사위가 트리플에 빠짐', R.computeAttack(Object.assign({}, base, { dice: steelOut })).atk, 20);
const cur = R.computeAttack(Object.assign({}, base, { dice: [{ kind: 'curse', value: 1 }].concat(dice([2, 3, 4, 5])) }));
eq('저주 주사위', [cur.hand.id, cur.atk, cur.selfDmg], ['straight', 25, 2]);
eq('서리 병은 빙결을 줄 때만', R.computeAttack(Object.assign({}, base, { relics: ['frost'], dice: dice([2, 2, 4, 5, 6]) })).apply.freeze, 0);
eq('서리 병 + 빙결 주사위', R.computeAttack(Object.assign({}, base, { relics: ['frost'], dice: [{ kind: 'ice', value: 5 }].concat(dice([2, 2, 3, 6])) })).apply.freeze, 2);
const ctx = Object.assign({}, base, { dice: dice([6, 6, 6, 2, 2]), relics: ['life', 'echo'] });
const before = JSON.stringify(ctx);
R.computeAttack(ctx); R.computeAttack(ctx);
eq('미리보기 계산은 상태를 바꾸지 않는다', JSON.stringify(ctx), before);

// 방어 처리
const t = { hp: 20, status: { block: 5 } };
eq('방어 먼저 차감', R.applyDamage(t, 8), { absorbed: 5, lost: 3 });
eq('방어 차감 후 상태', [t.hp, t.status.block], [17, 0]);
const t2 = { hp: 4, status: { block: 0 } };
eq('체력은 0 아래로 내려가지 않음', [R.applyDamage(t2, 10).lost, t2.hp], [4, 0]);

// 맵 생성: 여러 시드에서 모든 노드가 보스로 이어지는지
let bad = 0, noShop = 0;
for (let s = 1; s <= 300; s++) {
  DB.RNG.seed(s);
  const m = R.genMap(DB.RNG, { floors: 10, lanes: 5, paths: 5 });
  if (!R.validateMap(m)) bad++;
  const ns = Object.values(m.nodes);
  if (!ns.some(n => n.type === 'shop')) noShop++;
  if (ns.some(n => n.f === 1 && n.type !== 'battle')) bad++;
  if (ns.some(n => n.type === 'elite' && n.f < 4)) bad++;
  if (ns.some(n => n.id !== 'boss' && !n.type)) bad++;
  for (let f = 1; f <= 10; f++) if (!ns.some(n => n.f === f)) bad++;
}
eq('맵 300개 모두 유효', bad, 0);
eq('맵 300개 모두 상점 포함', noShop, 0);
DB.RNG.seed(null);

console.log(`통과 ${pass}, 실패 ${fail}`);
process.exit(fail ? 1 : 0);
