/* 규칙 계산 (순수 함수): 족보 판정, 공격 효과 파이프라인, 적 행동 피해, 맵 생성
 * 화면 렌더링은 이 함수들의 결과를 읽기만 하고 상태를 바꾸지 않는다.
 *
 * 공격 효과 처리 순서 (computeAttack):
 *  1. 족보 기본 효과 (공격·방어·회복·상태)
 *  2. 특수 주사위 효과 (주사위 순서대로)
 *  3. 유물의 고정 피해 보너스 → 힘
 *  4. 배율: 왕의 왕관(×1.25) → 플레이어 빙결(×0.7), 소수점 버림
 *  5. 상태 부여 보너스 (서리 병, 피의 제단): 해당 상태를 이미 줄 때만 +1
 */
(function (root) {
  'use strict';
  const DB = root.DB = root.DB || {};

  const RANK = { high: 1, pair: 2, twopair: 3, triple: 4, straight: 5, fullhouse: 6, quad: 7, five: 8 };
  const NAMES = { high: '하이 카드', pair: '원 페어', twopair: '투 페어', triple: '트리플', straight: '스트레이트', fullhouse: '풀하우스', quad: '포카드', five: '파이브 오브 어 카인드' };

  // 주사위 5개의 눈으로 족보와 기본 효과를 정한다
  function evalHand(vals) {
    const cnt = {};
    vals.forEach(v => { cnt[v] = (cnt[v] || 0) + 1; });
    const faces = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || b - a);
    const top = cnt[faces[0]], second = faces.length > 1 ? cnt[faces[1]] : 0;
    const sum = vals.reduce((a, b) => a + b, 0);
    const idx = f => vals.map((v, i) => (v === f ? i : -1)).filter(i => i >= 0);
    const all = vals.map((_, i) => i);
    const uniq = faces.slice().sort((a, b) => a - b);
    const isStraight = vals.length === 5 && uniq.length === 5 && uniq[4] - uniq[0] === 4;
    let id, atk, block = 0, heal = 0, apply = {}, used;
    if (top === 5) { id = 'five'; atk = sum * 2 + 10; block = 10; heal = 10; used = all; }
    else if (top === 4) { id = 'quad'; atk = Math.floor(faces[0] * 4 * 1.5) + 6; apply = { freeze: 2 }; used = idx(faces[0]); }
    else if (top === 3 && second === 2) { id = 'fullhouse'; atk = sum + 4; heal = 6; used = all; }
    else if (isStraight) { id = 'straight'; atk = uniq[0] === 2 ? 18 : 16; block = 8; used = all; }
    else if (top === 3) { id = 'triple'; atk = faces[0] * 3 + 8; apply = { bleed: 2 }; used = idx(faces[0]); }
    else if (top === 2 && second === 2) { id = 'twopair'; atk = (faces[0] + faces[1]) * 2 + 2; block = 5; used = idx(faces[0]).concat(idx(faces[1])); }
    else if (top === 2) { id = 'pair'; atk = faces[0] * 2 + 4; used = idx(faces[0]); }
    else { const m = Math.max(...vals); id = 'high'; atk = m + 2; block = 3; used = [vals.indexOf(m)]; }
    return { id, name: NAMES[id], rank: RANK[id], atk, block, heal, apply, used: used.sort((a, b) => a - b) };
  }

  /* ctx = { dice:[{kind,value}], relics:[id], gold, hp, maxHp, rerollsLeft, enemyType, status:{str,freeze}, hero }
   * 반환값은 미리보기와 실제 공격에서 똑같이 쓴다. */
  function computeAttack(ctx) {
    const vals = ctx.dice.map(d => d.value);
    const h = evalHand(vals);
    const has = id => ctx.relics.indexOf(id) >= 0;
    const st = ctx.status || {};
    let atk = h.atk, block = h.block, heal = h.heal, gold = 0, selfDmg = 0;
    const apply = { bleed: h.apply.bleed || 0, burn: h.apply.burn || 0, freeze: h.apply.freeze || 0 };
    const notes = [];
    const add = (n, why) => { atk += n; notes.push(`${why} +${n}`); };

    ctx.dice.forEach((d, i) => {
      const v = d.value;
      switch (d.kind) {
        case 'gold': if (v === 6) { gold += 3; notes.push('황금 주사위 골드 +3'); } break;
        case 'curse': if (v === 1) { add(9, '저주 주사위'); selfDmg += 2; } break;
        case 'ice': if (v >= 4) { apply.freeze += 1; notes.push('빙결 주사위 빙결 +1'); } break;
        case 'alchemy': if (v === 2 || v === 3) { block += 3; notes.push('연금 주사위 방어 +3'); } break;
        case 'steel': if (h.rank >= RANK.triple && h.used.indexOf(i) >= 0) add(4, '강철 주사위'); break;
        case 'blood': if (v >= 5) { apply.bleed += 2; notes.push('피의 주사위 출혈 +2'); } break;
        case 'flame': if (v === 6) { apply.burn += 2; notes.push('불꽃 주사위 화상 +2'); } break;
        case 'life': if (v <= 2) { heal += 2; notes.push('생명 주사위 회복 +2'); } break;
        default: break;
      }
    });

    if (has('edge')) add(2, '날 선 화살촉');
    if (has('twins') && (h.id === 'pair' || h.id === 'twopair')) add(3, '쌍둥이 반지');
    if (has('leather') && h.id === 'twopair') { block += 5; notes.push('가죽 갑옷 방어 +5'); }
    if (has('torch') && h.id === 'straight') { apply.burn += 2; notes.push('불씨 횃불 화상 +2'); }
    if (has('ruby') && ctx.rerollsLeft === 0) add(5, '루비 반지');
    if (has('greed')) { const g = Math.min(5, Math.floor((ctx.gold || 0) / 10)); if (g) add(g, '탐욕의 금서'); }
    if (has('echo') && h.rank >= RANK.triple) add(5, '메아리 마도서');
    if (has('hammer') && (ctx.enemyType === 'elite' || ctx.enemyType === 'boss')) add(4, '사냥꾼의 망치');
    if (has('cursed')) add(4, '저주받은 상자');
    if (has('heart') && ctx.hp * 2 <= ctx.maxHp) add(5, '깨진 심장');
    if (has('life') && (h.id === 'fullhouse' || h.id === 'five')) { heal += 5; notes.push('생명의 서 회복 +5'); }
    if (ctx.hero === 'druid') {
      if (h.rank >= RANK.pair) { apply.bleed += 1; notes.push('드루이드 출혈 +1'); }
      if (heal > 0) { heal += 2; notes.push('드루이드 회복 +2'); }
    }
    if (ctx.hero === 'archer' && apply.bleed > 0) { apply.bleed += 2; notes.push('궁수 출혈 +2'); }
    if (ctx.hero === 'warrior' && ctx.hp * 2 <= ctx.maxHp) add(5, '전사의 분노');
    if (st.str) add(st.str, '힘');

    if (has('crown') && h.rank >= RANK.triple) { const before = atk; atk = Math.floor(atk * 1.25); notes.push(`왕의 왕관 ×1.25 (+${atk - before})`); }
    if (st.freeze > 0) { const before = atk; atk = Math.floor(atk * 0.7); notes.push(`빙결 상태 ×0.7 (-${before - atk})`); }

    if (has('frost') && apply.freeze > 0) { apply.freeze += 1; notes.push('서리 병 빙결 +1'); }
    if (has('altar') && apply.bleed > 0) { apply.bleed += 1; notes.push('피의 제단 출혈 +1'); }

    return { hand: h, atk: Math.max(0, atk), block, heal, gold, selfDmg, apply, notes };
  }

  // 적 행동의 한 번 피해량 (힘·빙결 반영). 실제 적용과 예고 표시에 같이 쓴다.
  function enemyHit(move, status) {
    if (!move.atk) return 0;
    let dmg = move.atk + (status.str || 0);
    if (status.freeze > 0) dmg = Math.floor(dmg * 0.7);
    return Math.max(0, dmg);
  }

  // 방어를 먼저 깎고 남은 피해를 체력에 준다. 실제로 잃은 체력을 돌려준다.
  function applyDamage(target, dmg) {
    const absorbed = Math.min(target.status.block || 0, dmg);
    target.status.block = (target.status.block || 0) - absorbed;
    const lost = Math.min(target.hp, dmg - absorbed);
    target.hp -= lost;
    return { absorbed, lost };
  }

  // 층에 맞춰 적 능력치를 정한다. 보스는 고정.
  function scaleEnemy(key, def, floor, rng) {
    const m = def.type === 'boss' ? 1 : 1 + 0.12 * (floor - 1);
    const am = def.type === 'boss' ? 1 : 1 + 0.09 * (floor - 1);
    const jitter = def.type === 'boss' ? 1 : 0.95 + rng.next() * 0.1;
    const hp = Math.round(def.hp * m * jitter);
    return {
      key, name: def.name, img: def.img, sprite: !!def.sprite, type: def.type, hp, maxHp: hp,
      moves: def.moves.map(mv => Object.assign({}, mv, mv.atk ? { atk: Math.round(mv.atk * am) } : {}, mv.block ? { block: Math.round(mv.block * am) } : {})),
      status: { block: 0, bleed: 0, burn: 0, freeze: 0, str: 0 },
      moveIdx: -1, intent: null
    };
  }

  // 다음 행동 고르기: 보스는 순서대로, 나머지는 직전과 다른 행동을 무작위로
  function nextIntent(enemy, rng) {
    const n = enemy.moves.length;
    let i;
    if (enemy.type === 'boss') i = (enemy.moveIdx + 1) % n;
    else { do { i = rng.int(n); } while (n > 1 && i === enemy.moveIdx); }
    enemy.moveIdx = i;
    enemy.intent = enemy.moves[i];
    return enemy.intent;
  }

  /* 분기형 맵 생성. 모든 경로는 출발 지점(0층, 가운데) 하나에서 시작해 위층으로 갈라지고,
   * 경로가 서로 엇갈리지 않게 한다. 모든 노드는 어떤 경로 위에 있으므로 출발 지점에서 도달할 수 있고 보스까지 이어진다. */
  function genMap(rng, opts) {
    const F = (opts && opts.floors) || 10, L = (opts && opts.lanes) || 5, P = (opts && opts.paths) || 5;
    const nodes = {};
    const edges = [];
    const key = (f, c) => `${f}-${c}`;
    const S = Math.floor((L - 1) / 2);
    const mark = (f, c) => {
      const k = f === 0 ? 'start' : key(f, c);
      if (!nodes[k]) nodes[k] = { id: k, f, c, type: f === 0 ? 'start' : null, next: [], prev: [] };
      return nodes[k];
    };
    for (let p = 0; p < P; p++) {
      let c = S;
      mark(0, c);
      for (let f = 0; f < F; f++) {
        const cand = rng.shuffle([c - 1, c, c + 1].filter(x => x >= 0 && x < L));
        const crosses = nc => edges.some(e => e.f === f && ((e.a < c && e.b > nc) || (e.a > c && e.b < nc)));
        let nc = cand.find(x => !crosses(x));
        if (nc == null) { const ex = edges.find(e => e.f === f && e.a === c); nc = ex ? ex.b : c; }
        if (!edges.some(e => e.f === f && e.a === c && e.b === nc)) edges.push({ f, a: c, b: nc });
        const from = mark(f, c), to = mark(f + 1, nc);
        if (from.next.indexOf(to.id) < 0) from.next.push(to.id);
        if (to.prev.indexOf(from.id) < 0) to.prev.push(from.id);
        c = nc;
      }
    }
    const boss = { id: 'boss', f: F + 1, c: (L - 1) / 2, type: 'boss', next: [], prev: [] };
    Object.values(nodes).forEach(n => { if (n.f === F) { n.next.push('boss'); boss.prev.push(n.id); } });
    nodes.boss = boss;

    // 노드 종류 정하기
    const early = [['battle', 50], ['event', 26], ['shop', 10], ['mystery', 14]];
    const late = [['battle', 38], ['elite', 16], ['event', 18], ['shop', 10], ['rest', 10], ['mystery', 8]];
    const fixedFloor = { 1: 'battle', 6: 'treasure' };
    fixedFloor[F] = 'rest';
    const list = Object.values(nodes).filter(n => n.id !== 'boss' && n.id !== 'start').sort((a, b) => a.f - b.f || a.c - b.c);
    list.forEach(n => {
      if (fixedFloor[n.f]) { n.type = fixedFloor[n.f]; return; }
      const table = (n.f <= 3 ? early : late).filter(t => !(t[0] === 'rest' && n.f === F - 1));
      let t, tries = 0;
      do {
        t = rng.weighted(table);
        tries++;
      } while (tries < 12 && ['shop', 'rest', 'elite'].indexOf(t) >= 0 && n.prev.some(pid => nodes[pid].type === t));
      n.type = t;
    });
    if (!list.some(n => n.type === 'shop')) {
      const cand = list.filter(n => n.f >= 4 && n.f <= F - 2 && !fixedFloor[n.f]);
      if (cand.length) rng.pick(cand).type = 'shop';
    }
    // 화면 배치용 좌표 (퍼센트)
    Object.values(nodes).forEach(n => {
      n.x = n.id === 'boss' || n.id === 'start' ? 50 : ((n.c + 0.5) / L) * 100 + (rng.next() * 8 - 4);
    });
    return { floors: F, lanes: L, nodes };
  }

  // 지도 검증: 시작층의 모든 노드에서 보스까지 갈 수 있는지 (테스트·자동 점검용)
  function validateMap(map) {
    const memo = {};
    const reach = id => {
      if (id === 'boss') return true;
      if (id in memo) return memo[id];
      memo[id] = false;
      const n = map.nodes[id];
      memo[id] = n.next.length > 0 && n.next.every(reach);
      return memo[id];
    };
    const start = map.nodes.start;
    // 출발 지점 하나, 모든 노드가 출발 지점에서 이어지고 보스로 이어진다
    const fromStart = {}; const walk = id => { if (fromStart[id]) return; fromStart[id] = true; map.nodes[id].next.forEach(walk); };
    if (start) walk('start');
    return !!start && Object.values(map.nodes).filter(n => n.f === 0).length === 1 &&
      Object.values(map.nodes).every(n => n.id === 'boss' || reach(n.id)) && Object.keys(map.nodes).every(id => fromStart[id]);
  }

  const api = { RANK, evalHand, computeAttack, enemyHit, applyDamage, scaleEnemy, nextIntent, genMap, validateMap };
  DB.rules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
