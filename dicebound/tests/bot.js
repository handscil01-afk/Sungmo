/* 자동 플레이 봇: Node 시뮬레이션과 브라우저(Playwright) 점검에서 같이 쓴다.
 * DB.bot.step() 은 현재 화면에서 할 일 하나를 결정해 { kind, ... } 로 돌려준다. */
(function (root) {
  'use strict';
  const DB = root.DB;

  // 다시 굴릴 주사위 고르기: 같은 눈이 2개 이상인 묶음은 남기고, 스트레이트 직전이면 맞춰 본다
  function chooseReroll(values) {
    const cnt = {};
    values.forEach(v => { cnt[v] = (cnt[v] || 0) + 1; });
    const uniq = Object.keys(cnt).map(Number).sort((a, b) => a - b);
    const h = DB.rules.evalHand(values);
    if (['five', 'fullhouse', 'straight', 'quad'].indexOf(h.id) >= 0) return [];
    // 4개가 이어져 있으면 나머지 하나만 굴린다
    for (const run of [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]]) {
      if (run.every(v => cnt[v]) && h.rank < 4) {
        const keep = {}; const out = [];
        values.forEach((v, i) => { if (run.indexOf(v) >= 0 && !keep[v]) keep[v] = true; else out.push(i); });
        return out;
      }
    }
    const maxC = Math.max(...Object.values(cnt));
    if (maxC === 1) { // 높은 눈 두 개만 남긴다
      const order = values.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
      return order.slice(2).map(x => x[1]);
    }
    const keepFaces = uniq.filter(v => cnt[v] >= 2);
    return values.map((v, i) => (keepFaces.indexOf(v) >= 0 ? -1 : i)).filter(i => i >= 0);
  }

  function step() {
    const G = DB.game, r = G.run;
    if (!r) return { kind: 'none' };
    if (r.pendingDice) {
      let slot = r.dice.findIndex(d => !d.kind);
      if (slot < 0) slot = 0;
      return { kind: 'replaceDie', slot };
    }
    switch (r.screen) {
      case 'map': {
        const av = G.available();
        const nodes = av.map(id => r.map.nodes[id]);
        const low = r.hp < r.maxHp * 0.5;
        const pref = low ? ['rest', 'shop', 'event', 'treasure', 'mystery', 'battle', 'elite', 'boss'] : ['treasure', 'elite', 'battle', 'shop', 'mystery', 'event', 'rest', 'boss'];
        nodes.sort((a, b) => pref.indexOf(a.type) - pref.indexOf(b.type));
        return { kind: 'node', id: nodes[0].id };
      }
      case 'battle': {
        const b = r.battle;
        if (b.phase !== 'player') return { kind: 'wait' };
        const potIdx = r.potions.findIndex((p, i) => G.canUsePotion(i) && p !== 'fate' && (p !== 'heal' || r.hp < r.maxHp * 0.5) && (p !== 'cure' || b.status.bleed + b.status.burn > 2));
        if (potIdx >= 0) return { kind: 'potion', idx: potIdx };
        if (b.rerollsLeft > 0) {
          const sel = chooseReroll(b.values);
          if (sel.length) return { kind: 'reroll', sel };
        }
        return { kind: 'attack' };
      }
      case 'reward': {
        const rw = r.reward;
        if (rw.kind === 'treasure' && !rw.opened) return { kind: 'openChest' };
        if (rw.potion && !rw.potionTaken && r.potions.length < 3) return { kind: 'takePotion' };
        if (rw.relics.length && !rw.relicTaken) return { kind: 'relic', id: rw.relics[0] };
        if (!rw.diceTaken && rw.dice.length && r.dice.some(d => !d.kind)) return { kind: 'rewardDie', id: rw.dice[0] };
        return { kind: 'leave' };
      }
      case 'shop': {
        const it = r.shop.items.findIndex(x => !x.sold && x.price <= r.gold && (x.cat === 'relic' || (x.cat === 'potion' && r.potions.length < 3) || (x.cat === 'service' && r.hp < r.maxHp * 0.6) || (x.cat === 'dice' && r.dice.some(d => !d.kind))));
        if (it >= 0) return { kind: 'buy', idx: it };
        return { kind: 'leave' };
      }
      case 'rest': {
        const s = r.rest;
        if (s.done) return { kind: 'leave' };
        if (r.hp < r.maxHp * 0.75) return { kind: 'restHeal' };
        if (r.dice.some(d => !d.kind)) return { kind: 'restTrain', id: s.train[0] };
        return { kind: 'restMeditate' };
      }
      case 'event': {
        const e = r.event;
        if (e.done) return { kind: 'leave' };
        if (e.pickDice) return { kind: 'eventDie', id: e.pickDice[0] };
        const n = G.EVENTS[e.id].choices.length;
        for (let i = 0; i < n; i++) if (G.eventCan(i) === true) return { kind: 'event', idx: i };
        return { kind: 'leave' };
      }
      default: return { kind: 'none' };
    }
  }

  // 결정 하나를 게임 함수로 직접 실행한다 (Node 시뮬레이션용)
  function apply(a) {
    const G = DB.game;
    switch (a.kind) {
      case 'replaceDie': return G.replaceDie(a.slot);
      case 'node': return G.chooseNode(a.id);
      case 'potion': return G.usePotion(a.idx);
      case 'reroll': a.sel.forEach(i => G.toggleDie(i)); return G.reroll();
      case 'attack': return G.attack();
      case 'openChest': return G.openChest();
      case 'takePotion': return G.takeRewardPotion();
      case 'relic': return G.chooseRewardRelic(a.id);
      case 'rewardDie': return G.chooseRewardDie(a.id);
      case 'buy': return G.buy(a.idx);
      case 'restHeal': return G.restHeal();
      case 'restTrain': return G.restTrain(a.id);
      case 'restMeditate': return G.restMeditate();
      case 'event': return G.eventChoose(a.idx);
      case 'eventDie': return G.eventPickDie(a.id);
      case 'leave': return G.leave();
      default: return false;
    }
  }
  DB.bot = { step, apply, chooseReroll };
})(typeof window !== 'undefined' ? window : globalThis);
