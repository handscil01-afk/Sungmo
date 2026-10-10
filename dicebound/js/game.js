/* 게임 진행: 여정 상태, 맵 이동, 전투, 보상, 상점, 휴식, 이벤트, 저장, 도감·업적
 * 모든 상태 변경은 이 파일의 함수 안에서만 일어난다. 화면(ui.js)은 결과를 그리기만 한다.
 * 전투 행동(attack 등)은 상태를 즉시 끝까지 계산하고, 연출용 이벤트 목록(G.events)을 남긴다. */
(function (root) {
  'use strict';
  const DB = root.DB;
  const R = DB.rules, RNG = DB.RNG, C = DB.CONST;
  const KEY_RUN = 'dicebound.run.v1', KEY_META = 'dicebound.meta.v1', KEY_SET = 'dicebound.settings.v1';

  const G = DB.game = {
    run: null,
    meta: null,
    settings: null,
    events: [],   // 직전 행동의 연출 목록
    toasts: [],   // 업적 등 알림
    onChange: null
  };

  /* ---------- 저장 ---------- */
  function defaultMeta() {
    return { runs: 0, wins: 0, bestFloor: 0, codex: { enemies: {}, relics: {}, dice: {}, potions: {} }, ach: {}, bosses: {}, eliteKills: 0, heroes: {} };
  }
  G.load = function () {
    const m = DB.store.get(KEY_META, null);
    G.meta = Object.assign(defaultMeta(), m || {});
    G.meta.codex = Object.assign(defaultMeta().codex, G.meta.codex || {});
    G.settings = Object.assign({ autoFS: true, wakeLock: true, reduceMotion: false, installDismissed: false }, DB.store.get(KEY_SET, {}) || {});
    const r = DB.store.get(KEY_RUN, null);
    // v2: 주인공 선택과 출발 지점이 생겼으므로 이전 형식의 저장은 이어하지 않는다
    G.savedRun = r && r.v === 2 && r.screen !== 'end' && DB.HEROES[r.hero] ? r : null;
  };
  G.saveMeta = () => DB.store.set(KEY_META, G.meta);
  G.saveSettings = () => DB.store.set(KEY_SET, G.settings);
  function saveRun() {
    if (!G.run) return;
    if (G.run.screen === 'end') { DB.store.del(KEY_RUN); G.savedRun = null; return; }
    DB.store.set(KEY_RUN, G.run);
    G.savedRun = G.run;
  }
  function commit() { saveRun(); G.saveMeta(); if (G.onChange) G.onChange(); }
  G.commit = commit;

  /* ---------- 도감·업적 ---------- */
  function seen(cat, id) {
    const c = G.meta.codex[cat];
    if (cat === 'enemies') { c[id] = c[id] || { seen: 0, kills: 0 }; c[id].seen++; }
    else c[id] = true;
  }
  G.unlock = function (id) {
    if (G.meta.ach[id] || !DB.ACHIEVEMENTS[id]) return;
    G.meta.ach[id] = Date.now();
    G.toasts.push({ kind: 'ach', id });
  };
  function checkPassiveAch() {
    const r = G.run;
    if (r.gold >= 150) G.unlock('rich');
    if (r.relics.length >= 6) G.unlock('collector');
    if (r.dice.every(d => d.kind)) G.unlock('diceMaster');
  }

  /* ---------- 여정 시작·이어하기 ---------- */
  G.newRun = function (heroId, seed) {
    if (seed != null) RNG.seed(seed);
    const hero = DB.HEROES[heroId] ? heroId : 'knight';
    const H = DB.HEROES[hero];
    const bossKeys = Object.keys(DB.ENEMIES).filter(k => DB.ENEMIES[k].type === 'boss');
    G.run = {
      v: 2, hero, hp: H.hp, maxHp: H.hp, gold: C.startGold, floor: 0, pos: 'start', visited: ['start'],
      map: R.genMap(RNG, { floors: C.floors, lanes: C.lanes, paths: 5 }),
      bossKey: RNG.pick(bossKeys),
      // 주인공마다 특수 주사위 하나를 들고 시작한다
      dice: Array.from({ length: C.diceCount }, (_, i) => ({ kind: i === 0 ? H.die : null })),
      relics: [], potions: [], seenEvents: [],
      screen: 'map', node: null, battle: null, reward: null, shop: null, rest: null, event: null, pendingDice: null,
      stats: { kills: 0, elites: 0, turns: 0, dealt: 0, taken: 0, gold: 0, maxHit: 0, start: Date.now() },
      result: null
    };
    G.meta.runs++;
    G.meta.heroes = G.meta.heroes || {};
    G.meta.heroes[hero] = G.meta.heroes[hero] || { runs: 0, wins: 0 };
    G.meta.heroes[hero].runs++;
    seen('dice', H.die);
    if (G.meta.runs >= 10) G.unlock('runs10');
    G.events = [];
    commit();
  };
  G.continueRun = function () {
    if (!G.savedRun) return false;
    G.run = JSON.parse(JSON.stringify(G.savedRun));
    G.events = [];
    if (G.onChange) G.onChange();
    return true;
  };
  G.abandonRun = function () { DB.store.del(KEY_RUN); G.savedRun = null; G.run = null; };

  G.region = function (floor) {
    const f = Math.max(0, floor || 0);
    return DB.REGIONS.find(r => f >= r.from && f <= r.to) || DB.REGIONS[0];
  };
  // 지역 배경 중 하나를 노드마다 고정해서 고른다
  G.regionBg = function (floor, nodeId) {
    const list = G.region(floor).bg;
    let h = 0; String(nodeId || floor).split('').forEach(ch => { h = (h * 31 + ch.charCodeAt(0)) >>> 0; });
    return DB.IMG.bg2(list[h % list.length]);
  };
  G.hero = () => G.run && DB.HEROES[G.run.hero];
  // 전사는 체력이 40% 이하이면 부상 모습으로 바뀐다
  G.heroImg = function (side) {
    const r = G.run, H = G.hero();
    if (!H) return '';
    const hurt = r.hp > 0 && r.hp <= r.maxHp * 0.4;
    if (side === 'back') return hurt && H.hurtBack ? H.hurtBack : H.back;
    return hurt && H.hurtFront ? H.hurtFront : H.front;
  };

  /* ---------- 맵 ---------- */
  G.available = function () {
    const r = G.run;
    if (!r || r.screen !== 'map') return [];
    if (!r.pos) return Object.values(r.map.nodes).filter(n => n.f === 1).map(n => n.id);
    return r.map.nodes[r.pos].next.slice();
  };
  G.chooseNode = function (id) {
    const r = G.run;
    if (!r || r.screen !== 'map' || r.pendingDice) return false;
    if (G.available().indexOf(id) < 0) return false;
    const n = r.map.nodes[id];
    r.pos = id; r.visited.push(id); r.floor = n.f;
    G.meta.bestFloor = Math.max(G.meta.bestFloor, n.f);
    r.node = { id, type: n.type };
    G.events = [];
    enterNode(n.type === 'mystery' ? resolveMystery(n) : n.type);
    commit();
    return true;
  };
  function resolveMystery(n) {
    const t = RNG.weighted([['battle', 30], ['event', 40], ['shop', 15], ['treasure', 15]]);
    G.run.node.revealed = t;
    G.toasts.push({ kind: 'info', text: `미지의 노드: ${DB.NODE_TYPES[t].name}` });
    return t;
  }
  function enterNode(type) {
    if (type === 'battle') startBattle('normal');
    else if (type === 'elite') startBattle('elite');
    else if (type === 'boss') startBattle('boss');
    else if (type === 'shop') openShop();
    else if (type === 'treasure') openTreasure();
    else if (type === 'rest') openRest();
    else openEvent();
  }
  function finishNode() {
    const r = G.run;
    r.screen = 'map'; r.node = null; r.battle = null; r.reward = null; r.shop = null; r.rest = null; r.event = null; r.pendingDice = null;
    checkPassiveAch();
  }
  G.leave = function () {
    const r = G.run;
    if (!r || r.pendingDice) return false;
    if (['reward', 'shop', 'rest', 'event'].indexOf(r.screen) < 0) return false;
    if (r.screen === 'event' && r.event && !r.event.done) r.event.done = true;
    finishNode();
    G.events = [];
    commit();
    return true;
  };

  /* ---------- 전투 ---------- */
  // 지역별 몬스터 목록에서 고른다 (data.js 의 DB.POOLS)
  function startBattle(kind, opts) {
    const r = G.run;
    const pool = DB.POOLS[G.region(r.floor).key] || DB.POOLS.forest;
    const normals = r.floor <= 1 ? ['goblin', 'skeleton', 'elfArcher'] : pool.normal;
    const key = kind === 'boss' ? r.bossKey : kind === 'elite' ? RNG.pick(pool.elite) : RNG.pick(normals);
    const e = R.scaleEnemy(key, DB.ENEMIES[key], Math.max(1, r.floor), RNG);
    R.nextIntent(e, RNG);
    seen('enemies', key);
    r.battle = {
      enemy: e, kind, bounty: (opts && opts.bounty) || 0,
      status: { block: 0, bleed: 0, burn: 0, freeze: 0, str: 0 },
      values: [], selected: [], rerollsLeft: 0, rerollsMax: 0, turn: 0,
      transmuteUsed: false, phase: 'player', taken: 0, log: [], rollId: 0
    };
    r.screen = 'battle';
    const b = r.battle;
    if (r.relics.indexOf('guard') >= 0) b.status.block += 6;
    if (r.hero === 'knight') b.status.block += 8;
    b.bg = kind === 'boss' ? DB.IMG.bg2('hell') : G.regionBg(r.floor, r.pos);
    if (r.relics.indexOf('lucky') >= 0) r.hp = Math.min(r.maxHp, r.hp + 4);
    log(`${e.name}이(가) 나타났다!`);
    G.events = [{ type: 'battleStart', snap: snap() }];
    startPlayerTurn(true);
  }
  G.startBattle = function (kind, opts) { startBattle(kind, opts); commit(); };
  function log(t) { const b = G.run.battle; if (b) { b.log.push(t); if (b.log.length > 30) b.log.shift(); } }
  function snap() {
    const r = G.run, b = r.battle;
    return b ? { pHp: r.hp, pMax: r.maxHp, eHp: b.enemy.hp, eMax: b.enemy.maxHp, pSt: Object.assign({}, b.status), eSt: Object.assign({}, b.enemy.status) } : null;
  }
  function playerTarget() { const r = G.run; return { hp: r.hp, status: r.battle.status }; }

  // 상태 효과 피해 (출혈·화상): 방어 무시. 대상 체력을 바꾸고 연출 이벤트를 남긴다.
  function tickStatus(who) {
    const r = G.run, b = r.battle;
    const st = who === 'player' ? b.status : b.enemy.status;
    let total = 0;
    if (st.bleed > 0) { total += st.bleed; G.events.push({ type: 'tick', who, status: 'bleed', amount: st.bleed }); st.bleed--; }
    if (st.burn > 0) { total += 3; G.events.push({ type: 'tick', who, status: 'burn', amount: 3 }); st.burn--; }
    if (!total) return;
    if (who === 'player') { const lost = Math.min(r.hp, total); r.hp -= lost; b.taken += lost; r.stats.taken += lost; log(`상태 이상으로 체력 ${lost}을(를) 잃었다.`); }
    else { const lost = Math.min(b.enemy.hp, total); b.enemy.hp -= lost; r.stats.dealt += lost; log(`${b.enemy.name}이(가) 상태 이상으로 ${lost} 피해를 받았다.`); }
    G.events[G.events.length - 1].snap = snap();
  }

  function startPlayerTurn(first) {
    const r = G.run, b = r.battle;
    b.turn++; r.stats.turns++;
    if (!first) b.status.block = 0;
    if (r.relics.indexOf('amulet') >= 0) b.status.block += 2;
    tickStatus('player');
    if (r.hp <= 0) { lose(); return; }
    b.rerollsMax = C.rerolls + (r.relics.indexOf('scepter') >= 0 ? 1 : 0) + (r.hero === 'archer' ? 1 : 0);
    b.rerollsLeft = b.rerollsMax;
    b.selected = [];
    b.values = r.dice.map(() => RNG.die());
    if (r.relics.indexOf('fate') >= 0) {
      let lo = 0; b.values.forEach((v, i) => { if (v < b.values[lo]) lo = i; });
      b.values[lo] = Math.min(6, b.values[lo] + 2);
    }
    b.rollId++;
    b.phase = 'player';
    G.events.push({ type: 'roll', all: true, snap: snap() });
  }

  G.preview = function () {
    const r = G.run, b = r && r.battle;
    if (!b || !b.values.length) return null;
    return R.computeAttack({
      dice: r.dice.map((d, i) => ({ kind: d.kind, value: b.values[i] })),
      relics: r.relics, gold: r.gold, hp: r.hp, maxHp: r.maxHp,
      rerollsLeft: b.rerollsLeft, enemyType: b.enemy.type, status: b.status, hero: r.hero
    });
  };
  function canAct() { const b = G.run && G.run.battle; return !!(b && G.run.screen === 'battle' && b.phase === 'player' && !G.run.pendingDice); }

  G.toggleDie = function (i) {
    if (!canAct()) return false;
    const b = G.run.battle;
    if (b.rerollsLeft <= 0 || i < 0 || i >= b.values.length) return false;
    const k = b.selected.indexOf(i);
    if (k >= 0) b.selected.splice(k, 1); else b.selected.push(i);
    G.events = [];
    if (G.onChange) G.onChange();
    return true;
  };
  G.reroll = function () {
    if (!canAct()) return false;
    const b = G.run.battle;
    if (b.rerollsLeft <= 0 || !b.selected.length) return false;
    const idx = b.selected.slice();
    idx.forEach(i => { b.values[i] = RNG.die(); });
    b.rerollsLeft--;
    b.selected = [];
    b.rollId++;
    log(`주사위 ${idx.length}개를 다시 굴렸다. (남은 재굴림 ${b.rerollsLeft})`);
    G.events = [{ type: 'roll', idx }];
    commit();
    return true;
  };
  // 변환 주사위 능력: 전투마다 한 번
  G.canTransmute = function () {
    const r = G.run, b = r && r.battle;
    return canAct() && !b.transmuteUsed && r.dice.some(d => d.kind === 'transmute');
  };
  G.transmute = function (value) {
    if (!G.canTransmute() || !(value >= 1 && value <= 6)) return false;
    const r = G.run, b = r.battle;
    const i = r.dice.findIndex(d => d.kind === 'transmute');
    b.values[i] = value; b.transmuteUsed = true;
    b.selected = b.selected.filter(x => x !== i);
    log(`변환 주사위의 눈을 ${value}(으)로 바꿨다.`);
    G.events = [{ type: 'roll', idx: [i] }];
    commit();
    return true;
  };

  G.attack = function () {
    if (!canAct()) return false;
    const r = G.run, b = r.battle, e = b.enemy;
    const res = G.preview();
    G.events = [];
    b.phase = 'resolving';
    // 1) 내 공격
    if (res.selfDmg) { const lost = Math.min(r.hp - 1, res.selfDmg); if (lost > 0) { r.hp -= lost; r.stats.taken += lost; } }
    if (res.heal) r.hp = Math.min(r.maxHp, r.hp + res.heal);
    if (res.block) b.status.block += res.block;
    if (res.gold) { r.gold += res.gold; r.stats.gold += res.gold; }
    if (b.status.freeze > 0) b.status.freeze--;
    const hit = R.applyDamage(e, res.atk);
    r.stats.dealt += hit.lost; r.stats.maxHit = Math.max(r.stats.maxHit, res.atk);
    ['bleed', 'burn', 'freeze'].forEach(s => { if (res.apply[s]) e.status[s] += res.apply[s]; });
    if (res.hand.id === 'straight') G.unlock('straight');
    if (res.hand.id === 'five') G.unlock('five');
    if (res.atk >= 40) G.unlock('bigHit');
    log(`${res.hand.name}! ${res.atk} 피해${hit.absorbed ? ` (방어 ${hit.absorbed} 막힘)` : ''}${res.block ? `, 방어 +${res.block}` : ''}${res.heal ? `, 회복 +${res.heal}` : ''}.`);
    G.events.push({ type: 'playerAttack', hand: res.hand, atk: res.atk, absorbed: hit.absorbed, block: res.block, heal: res.heal, gold: res.gold, apply: res.apply, snap: snap() });
    if (e.hp <= 0) { win(); commit(); return true; }
    // 2) 적의 차례
    enemyTurn();
    commit();
    return true;
  };

  function enemyTurn() {
    const r = G.run, b = r.battle, e = b.enemy;
    b.phase = 'enemy';
    e.status.block = 0;
    tickStatus('enemy');
    if (e.hp <= 0) { win(); return; }
    const mv = e.intent;
    if (mv.block) e.status.block += mv.block;
    if (mv.heal) e.hp = Math.min(e.maxHp, e.hp + mv.heal);
    if (mv.buff) e.status.str += mv.buff;
    let dealt = 0, absorbed = 0;
    if (mv.atk) {
      const per = R.enemyHit(mv, e.status);
      const hits = mv.hits || 1;
      const P = playerTarget();
      for (let k = 0; k < hits; k++) { const h = R.applyDamage(P, per); dealt += h.lost; absorbed += h.absorbed; }
      r.hp = P.hp;
      if (e.status.freeze > 0) e.status.freeze--;
      b.taken += dealt; r.stats.taken += dealt;
    }
    if (mv.apply) Object.keys(mv.apply).forEach(s => { b.status[s] += mv.apply[s]; });
    log(`${e.name}의 ${mv.name}!${mv.atk ? ` ${dealt} 피해${absorbed ? ` (방어 ${absorbed} 막음)` : ''}.` : ''}`);
    G.events.push({ type: 'enemyMove', move: mv, dealt, absorbed, snap: snap() });
    if (r.hp <= 0) { lose(); return; }
    R.nextIntent(e, RNG);
    startPlayerTurn(false);
  }

  function win() {
    const r = G.run, b = r.battle, e = b.enemy;
    b.phase = 'won';
    r.stats.kills++;
    G.meta.codex.enemies[e.key].kills++;
    G.unlock('firstWin');
    G.events.push({ type: 'victory', snap: snap() });
    if (e.type === 'elite') {
      r.stats.elites++; G.meta.eliteKills++;
      if (G.meta.eliteKills >= 3) G.unlock('elite3');
      if (b.taken === 0) G.unlock('flawless');
    }
    if (e.type === 'boss') {
      G.meta.bosses[e.key] = true;
      G.unlock('clear');
      if (Object.keys(DB.ENEMIES).filter(k => DB.ENEMIES[k].type === 'boss').every(k => G.meta.bosses[k])) G.unlock('allBosses');
      endRun(true);
      return;
    }
    const elite = e.type === 'elite';
    let gold = (elite ? RNG.range(22, 28) : RNG.range(10, 15)) + (r.relics.indexOf('pack') >= 0 ? 6 : 0) + b.bounty;
    r.gold += gold; r.stats.gold += gold;
    const potion = RNG.next() < (elite ? 0.65 : 0.4) ? RNG.pick(Object.keys(DB.POTIONS)) : null;
    r.reward = {
      kind: 'battle', title: `${e.name} 격파!`, enemy: e.key, gold, bounty: b.bounty,
      potion, potionTaken: false,
      dice: pickDice(3 + (r.relics.indexOf('wisdom') >= 0 ? 1 : 0)), diceTaken: false,
      relics: elite ? pickRelics(3) : [], relicTaken: false
    };
    r.battle = null;
    r.screen = 'reward';
    checkPassiveAch();
  }
  function lose() {
    const b = G.run.battle;
    b.phase = 'lost';
    G.events.push({ type: 'defeat', snap: snap() });
    endRun(false);
  }
  function endRun(won) {
    const r = G.run;
    const b = r.battle;
    r.result = { won, floor: r.floor, enemy: b ? b.enemy.key : null, time: Date.now() - r.stats.start };
    if (won) { G.meta.wins++; if (G.meta.heroes && G.meta.heroes[r.hero]) G.meta.heroes[r.hero].wins++; }
    r.screen = 'end';
  }

  /* ---------- 소모품 ---------- */
  G.addPotion = function (id) {
    const r = G.run;
    if (r.potions.length >= C.potionSlots) return false;
    r.potions.push(id); seen('potions', id);
    return true;
  };
  G.canUsePotion = function (idx) {
    const r = G.run; const id = r && r.potions[idx];
    if (!id) return false;
    const def = DB.POTIONS[id];
    const inBattle = r.screen === 'battle' && canAct();
    if (def.battle) return inBattle;
    if (r.screen === 'battle') return inBattle;
    return !r.pendingDice && r.screen !== 'end';
  };
  // fateValue/fateDie 는 변환의 두루마리에서만 쓴다
  G.usePotion = function (idx, fateDie, fateValue) {
    if (!G.canUsePotion(idx)) return false;
    const r = G.run, id = r.potions[idx], b = r.battle;
    if (id === 'fate' && !(fateDie >= 0 && fateDie < r.dice.length && fateValue >= 1 && fateValue <= 6)) return false;
    r.potions.splice(idx, 1);
    G.events = [];
    const msg = { heal: '체력 15 회복', ward: '방어 12 획득', cure: '상태 이상 제거, 체력 5 회복', reroll: '재굴림 +2', fate: '주사위 눈 변경', might: '힘 +3', bomb: '적에게 피해 14', frost: '적에게 빙결 3' }[id];
    if (id === 'heal') r.hp = Math.min(r.maxHp, r.hp + 15);
    if (id === 'cure') { r.hp = Math.min(r.maxHp, r.hp + 5); if (b) { b.status.bleed = 0; b.status.burn = 0; b.status.freeze = 0; } }
    if (id === 'ward') b.status.block += 12;
    if (id === 'reroll') { b.rerollsLeft += 2; b.rerollsMax += 2; }
    if (id === 'fate') { b.values[fateDie] = fateValue; b.selected = b.selected.filter(x => x !== fateDie); b.rollId++; G.events.push({ type: 'roll', idx: [fateDie] }); }
    if (id === 'might') b.status.str += 3;
    if (id === 'frost') b.enemy.status.freeze += 3;
    if (id === 'bomb') { const lost = Math.min(b.enemy.hp, 14); b.enemy.hp -= lost; r.stats.dealt += lost; }
    if (b) { log(`${DB.POTIONS[id].name} 사용: ${msg}.`); G.events.push({ type: 'potion', id, snap: snap() }); }
    else G.toasts.push({ kind: 'info', text: `${DB.POTIONS[id].name}: ${msg}` });
    if (b && b.enemy.hp <= 0) win();
    commit();
    return true;
  };
  G.discardPotion = function (idx) {
    const r = G.run;
    if (!r || !r.potions[idx]) return false;
    r.potions.splice(idx, 1); commit(); return true;
  };

  /* ---------- 유물·주사위 획득 ---------- */
  function relicPool(tier) { return Object.keys(DB.RELICS).filter(id => G.run.relics.indexOf(id) < 0 && (!tier || DB.RELICS[id].tier === tier)); }
  function pickRelics(n, tier) { return RNG.shuffle(relicPool(tier)).slice(0, n); }
  function pickDice(n) {
    const table = Object.keys(DB.DICE).map(k => [k, DB.DICE[k].rarity === 'rare' ? 1 : 2.2]);
    const out = [];
    let guard = 0;
    while (out.length < n && guard++ < 100) { const k = RNG.weighted(table); if (out.indexOf(k) < 0) out.push(k); }
    return out;
  }
  G.addRelic = function (id) {
    const r = G.run;
    if (!DB.RELICS[id] || r.relics.indexOf(id) >= 0) return false;
    r.relics.push(id); seen('relics', id);
    if (id === 'cursed') { r.maxHp = Math.max(10, r.maxHp - 6); r.hp = Math.min(r.hp, r.maxHp); }
    checkPassiveAch();
    return true;
  };
  // 특수 주사위는 어느 칸과 바꿀지 고른 뒤(replaceDie) 확정된다
  function offerDie(kind, source) { G.run.pendingDice = { kind, source }; }
  G.replaceDie = function (slot) {
    const r = G.run, p = r && r.pendingDice;
    if (!p || !(slot >= 0 && slot < r.dice.length)) return false;
    const src = p.source;
    if (src.type === 'shop') {
      const item = r.shop.items[src.idx];
      if (!item || item.sold || r.gold < item.price) { r.pendingDice = null; commit(); return false; }
      r.gold -= item.price; item.sold = true;
    }
    if (src.type === 'reward') { if (r.reward.diceTaken) { r.pendingDice = null; commit(); return false; } r.reward.diceTaken = true; }
    if (src.type === 'rest') { if (r.rest.done) { r.pendingDice = null; commit(); return false; } r.rest.done = true; r.rest.result = `${DB.DICE[p.kind].name}을(를) 단련해 장착했다.`; }
    if (src.type === 'event') { if (r.event.done) { r.pendingDice = null; commit(); return false; } r.event.done = true; r.event.result = { text: `${DB.DICE[p.kind].name}을(를) 얻어 장착했다.` }; }
    r.dice[slot] = { kind: p.kind };
    seen('dice', p.kind);
    r.pendingDice = null;
    checkPassiveAch();
    G.toasts.push({ kind: 'info', text: `${slot + 1}번 주사위를 ${DB.DICE[p.kind].name}(으)로 교체했다.` });
    commit();
    return true;
  };
  G.cancelDice = function () { if (G.run && G.run.pendingDice) { G.run.pendingDice = null; commit(); } };

  /* ---------- 보상 화면 ---------- */
  G.takeRewardPotion = function () {
    const rw = G.run.reward;
    if (!rw || !rw.potion || rw.potionTaken) return false;
    if (!G.addPotion(rw.potion)) { G.toasts.push({ kind: 'warn', text: '가방이 가득 찼다. 소모품을 쓰거나 버린 뒤 다시 받으세요.' }); if (G.onChange) G.onChange(); return false; }
    rw.potionTaken = true; commit(); return true;
  };
  G.chooseRewardDie = function (kind) {
    const rw = G.run.reward;
    if (!rw || rw.diceTaken || rw.dice.indexOf(kind) < 0) return false;
    offerDie(kind, { type: 'reward' }); commit(); return true;
  };
  G.chooseRewardRelic = function (id) {
    const rw = G.run.reward;
    if (!rw || rw.relicTaken || rw.relics.indexOf(id) < 0) return false;
    if (!G.addRelic(id)) return false;
    rw.relicTaken = true; commit(); return true;
  };

  /* ---------- 보물 ---------- */
  function openTreasure() {
    const r = G.run;
    const gold = RNG.range(22, 34);
    const rel = pickRelics(1, 'common').concat(pickRelics(1, 'rare'));
    r.reward = { kind: 'treasure', title: '보물 상자', opened: false, gold, relics: rel.length ? rel : [], relicTaken: false, potion: null, dice: [], diceTaken: true };
    r.screen = 'reward';
  }
  G.openChest = function () {
    const r = G.run, rw = r.reward;
    if (!rw || rw.kind !== 'treasure' || rw.opened) return false;
    rw.opened = true; r.gold += rw.gold; r.stats.gold += rw.gold;
    checkPassiveAch(); commit(); return true;
  };

  /* ---------- 상점 ---------- */
  function price(base) { return G.run.relics.indexOf('coffer') >= 0 ? Math.round(base * 0.8) : base; }
  function openShop() {
    const r = G.run;
    const items = [];
    pickDice(3).forEach(k => items.push({ cat: 'dice', id: k, price: price(DB.DICE[k].rarity === 'rare' ? 46 : 30), sold: false }));
    pickRelics(1, 'common').forEach(id => items.push({ cat: 'relic', id, price: price(58), sold: false }));
    pickRelics(1, 'rare').forEach(id => items.push({ cat: 'relic', id, price: price(85), sold: false }));
    RNG.shuffle(Object.keys(DB.POTIONS)).slice(0, 3).forEach(id => items.push({ cat: 'potion', id, price: price(DB.POTIONS[id].price), sold: false }));
    items.push({ cat: 'service', id: 'heal', price: price(30), sold: false });
    r.shop = { npc: RNG.pick(['merchant', 'shopkeeper']), items };
    r.screen = 'shop';
  }
  G.buy = function (idx) {
    const r = G.run, s = r && r.shop;
    if (!s || r.screen !== 'shop' || r.pendingDice) return false;
    const it = s.items[idx];
    if (!it || it.sold) return false;
    if (r.gold < it.price) { G.toasts.push({ kind: 'warn', text: '골드가 부족하다.' }); if (G.onChange) G.onChange(); return false; }
    if (it.cat === 'dice') { offerDie(it.id, { type: 'shop', idx }); commit(); return true; } // 칸을 고른 뒤 결제
    if (it.cat === 'potion') {
      if (!G.addPotion(it.id)) { G.toasts.push({ kind: 'warn', text: '가방이 가득 찼다.' }); if (G.onChange) G.onChange(); return false; }
    }
    if (it.cat === 'relic' && !G.addRelic(it.id)) return false;
    if (it.cat === 'service') {
      if (r.hp >= r.maxHp) { G.toasts.push({ kind: 'warn', text: '이미 체력이 가득하다.' }); if (G.onChange) G.onChange(); return false; }
      r.hp = Math.min(r.maxHp, r.hp + 20);
    }
    r.gold -= it.price; it.sold = true;
    commit();
    return true;
  };

  /* ---------- 휴식 ---------- */
  function openRest() {
    G.run.rest = { done: false, result: '', train: pickDice(2) };
    G.run.screen = 'rest';
  }
  G.restHeal = function () {
    const r = G.run, s = r.rest;
    if (!s || s.done) return false;
    const amt = Math.round(r.maxHp * 0.3) + (r.relics.indexOf('lantern') >= 0 ? 10 : 0);
    const before = r.hp; r.hp = Math.min(r.maxHp, r.hp + amt);
    s.done = true; s.result = `모닥불 곁에서 쉬며 체력 ${r.hp - before}을(를) 회복했다.`;
    commit(); return true;
  };
  G.restMeditate = function () {
    const r = G.run, s = r.rest;
    if (!s || s.done) return false;
    r.maxHp += 5; r.hp += 5;
    s.done = true; s.result = '치유사의 기도로 최대 체력이 5 늘었다.';
    commit(); return true;
  };
  G.restTrain = function (kind) {
    const s = G.run.rest;
    if (!s || s.done || s.train.indexOf(kind) < 0) return false;
    offerDie(kind, { type: 'rest' }); commit(); return true;
  };

  /* ---------- 이벤트 ---------- */
  const EVENTS = {
    altar: {
      npc: null, title: '수상한 제단', minFloor: 1,
      text: '이끼 낀 제단에서 보랏빛 기운이 새어 나온다. 제단 위에는 피로 쓴 글귀가 남아 있다. "대가를 치르는 자에게 힘을 주리라."',
      choices: [
        { label: '피를 바친다', desc: '체력 7을 잃고 무작위 유물을 얻는다.', can: r => r.hp > 7 || '체력이 부족하다.', run: r => { r.hp -= 7; r.stats.taken += 7; const id = pickRelics(1)[0]; if (id) { G.addRelic(id); return { text: `제단이 피를 받아들였다. ${DB.RELICS[id].name}을(를) 얻었다.`, relic: id }; } r.gold += 30; return { text: '제단이 피를 받아들였다. 골드 30을 얻었다.' }; } },
        { label: '기도한다', desc: '체력 8을 회복한다.', run: r => { const b = r.hp; r.hp = Math.min(r.maxHp, r.hp + 8); return { text: `조용히 기도하자 상처가 아물었다. 체력 ${r.hp - b} 회복.` }; } },
        { label: '지나친다', desc: '아무 일도 일어나지 않는다.', run: () => ({ text: '불길한 기운을 뒤로하고 길을 재촉했다.' }) }
      ]
    },
    gamble: {
      npc: 'mystic', title: '운명의 점술사', minFloor: 1,
      text: '"운명을 시험해 보겠나, 여행자여? 주사위 하나에 모든 것이 걸려 있지."',
      choices: [
        { label: '10골드를 건다', desc: '4 이상이 나오면 25골드를 받는다.', can: r => r.gold >= 10 || '골드가 부족하다.', run: r => { const v = RNG.die(); r.gold -= 10; if (v >= 4) { r.gold += 25; r.stats.gold += 15; return { text: `주사위는 ${v}! 25골드를 받았다.`, dice: [v] }; } return { text: `주사위는 ${v}. 10골드를 잃었다.`, dice: [v] }; } },
        { label: '25골드를 건다', desc: '5 이상이 나오면 70골드를 받는다.', can: r => r.gold >= 25 || '골드가 부족하다.', run: r => { const v = RNG.die(); r.gold -= 25; if (v >= 5) { r.gold += 70; r.stats.gold += 45; return { text: `주사위는 ${v}! 70골드를 받았다.`, dice: [v] }; } return { text: `주사위는 ${v}. 25골드를 잃었다.`, dice: [v] }; } },
        { label: '거절한다', desc: '점술사가 아쉬운 듯 웃는다.', run: () => ({ text: '"운명은 언제든 기다리고 있지."' }) }
      ]
    },
    library: {
      npc: 'librarian', title: '잊힌 서고', minFloor: 2,
      text: '"이 서고에는 금지된 지식이 잠들어 있어요. 무엇을 찾으시나요?"',
      choices: [
        { label: '금서를 읽는다', desc: '최대 체력 5를 잃고 희귀 유물을 얻는다.', can: r => (r.maxHp > 20 && relicPool('rare').length > 0) || '지금은 읽을 수 없다.', run: r => { r.maxHp -= 5; r.hp = Math.min(r.hp, r.maxHp); const id = pickRelics(1, 'rare')[0]; G.addRelic(id); return { text: `금서의 지식이 몸을 파고든다. ${DB.RELICS[id].name}을(를) 얻었다.`, relic: id }; } },
        { label: '주사위의 비밀', desc: '특수 주사위 3개 중 하나를 골라 장착한다.', pick: true, run: () => ({ pickDice: pickDice(3) }) },
        { label: '조용히 떠난다', desc: '책장 사이로 걸음을 옮긴다.', run: () => ({ text: '"언제든 다시 오세요."' }) }
      ]
    },
    inn: {
      npc: 'innkeeper', title: '길가의 여관', minFloor: 2,
      text: '"지친 얼굴이네, 여행자. 따뜻한 방과 식사가 준비되어 있어."',
      choices: [
        { label: '하룻밤 묵는다 (20골드)', desc: '체력을 모두 회복한다.', can: r => r.gold >= 20 || '골드가 부족하다.', run: r => { r.gold -= 20; r.hp = r.maxHp; return { text: '푹 자고 일어나니 몸이 가볍다. 체력을 모두 회복했다.' }; } },
        { label: '따뜻한 식사 (10골드)', desc: '체력 10 회복, 최대 체력 +3', can: r => r.gold >= 10 || '골드가 부족하다.', run: r => { r.gold -= 10; r.maxHp += 3; r.hp = Math.min(r.maxHp, r.hp + 13); return { text: '든든한 식사를 했다. 최대 체력 +3, 체력 회복.' }; } },
        { label: '사양한다', desc: '길을 서두른다.', run: () => ({ text: '"조심해서 가게."' }) }
      ]
    },
    villager: {
      npc: 'villager', title: '길 잃은 마을 주민', minFloor: 1,
      text: '"여행자님, 길을 잃었어요. 마을까지 데려다 주실 수 있나요? 길에 몬스터가 있어서 무서워요."',
      choices: [
        { label: '마을까지 데려다준다', desc: '체력 5를 잃고 감사의 선물을 받는다.', can: r => r.hp > 5 || '체력이 부족하다.', run: r => { r.hp -= 5; r.stats.taken += 5; const got = []; for (let i = 0; i < 2; i++) { const p = RNG.pick(Object.keys(DB.POTIONS)); if (G.addPotion(p)) got.push(DB.POTIONS[p].name); } if (!got.length) { r.gold += 20; return { text: '무사히 마을에 도착했다. 가방이 가득 차서 대신 골드 20을 받았다.' }; } return { text: `무사히 마을에 도착했다. 선물로 ${got.join(', ')}을(를) 받았다.` }; } },
        { label: '가진 것을 나눠 준다 (15골드)', desc: '최대 체력 +5, 체력 5 회복', can: r => r.gold >= 15 || '골드가 부족하다.', run: r => { r.gold -= 15; r.maxHp += 5; r.hp = Math.min(r.maxHp, r.hp + 10); return { text: '주민이 고마워하며 축복을 빌어 주었다. 최대 체력 +5.' }; } },
        { label: '지나친다', desc: '마음이 무겁지만 갈 길이 멀다.', run: () => ({ text: '주민의 뒷모습이 안개 속으로 사라졌다.' }) }
      ]
    },
    bounty: {
      npc: 'questgiver', title: '현상금 의뢰', minFloor: 3,
      text: '"근처에 정예 괴물이 숨어 있다. 처치해 준다면 넉넉히 보상하지."',
      choices: [
        { label: '의뢰를 받는다', desc: '정예 전투를 시작한다. 이기면 골드 30을 더 받는다.', battle: true, run: () => ({ battle: 'elite', bounty: 30 }) },
        { label: '거절한다', desc: '위험한 일은 피한다.', run: () => ({ text: '"겁쟁이로군. 뭐, 살아남는 것도 재주지."' }) }
      ]
    }
  };
  G.EVENTS = EVENTS;
  function openEvent() {
    const r = G.run;
    let pool = Object.keys(EVENTS).filter(k => EVENTS[k].minFloor <= r.floor && r.seenEvents.indexOf(k) < 0);
    if (!pool.length) pool = Object.keys(EVENTS).filter(k => EVENTS[k].minFloor <= r.floor);
    const id = RNG.pick(pool);
    r.seenEvents.push(id);
    r.event = { id, done: false, result: null, pickDice: null };
    r.screen = 'event';
  }
  G.eventCan = function (i) {
    const r = G.run, ev = r.event && EVENTS[r.event.id];
    if (!ev || r.event.done || r.event.pickDice) return false;
    const c = ev.choices[i];
    if (!c) return false;
    return c.can ? c.can(r) : true;
  };
  G.eventChoose = function (i) {
    const r = G.run;
    if (G.eventCan(i) !== true) return false;
    const out = EVENTS[r.event.id].choices[i].run(r);
    if (out.battle) { r.event.done = true; startBattle(out.battle, { bounty: out.bounty }); commit(); return true; }
    if (out.pickDice) { r.event.pickDice = out.pickDice; commit(); return true; }
    r.event.done = true; r.event.result = out;
    checkPassiveAch();
    commit();
    return true;
  };
  G.eventPickDie = function (kind) {
    const e = G.run.event;
    if (!e || e.done || !e.pickDice || e.pickDice.indexOf(kind) < 0) return false;
    offerDie(kind, { type: 'event' }); commit(); return true;
  };
})(typeof window !== 'undefined' ? window : globalThis);
