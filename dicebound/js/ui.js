/* 화면 그리기: 메인 메뉴, 맵, 전투, 보상·보물, 상점, 휴식, 이벤트, 엔딩, 정보창(상태·가방·도감·업적·족보·설정)
 * 상태는 DB.game 함수로만 바꾸고, 여기서는 결과를 읽어서 그린다. */
(function (root) {
  'use strict';
  const DB = root.DB, G = DB.game, R = DB.rules, I = DB.IMG, $ = DB.$, $$ = DB.$$, esc = DB.esc;

  const UI = DB.ui = { view: 'menu', busy: false, mapSel: null, layers: [] };

  /* ---------- 작은 조각 ---------- */
  const img = (src, cls, alt) => `<img src="${src}" class="${cls || ''}" alt="${esc(alt || '')}" draggable="false">`;
  function dieFace(value, kind, extra) {
    const k = kind && DB.DICE[kind];
    return `<span class="die-face${k ? ' special' : ''} ${extra || ''}"${k ? ` style="--dc:${k.color}"` : ''}>${img(I.dice(value || 6), 'die-img', `${value} 눈`)}${k ? img(k.badge, 'die-badge', k.name) : ''}</span>`;
  }
  function bar(val, max, cls) {
    const p = Math.max(0, Math.min(100, (val / max) * 100));
    return `<div class="bar ${cls || ''}"><i style="width:${p}%"></i><span>${val} / ${max}</span></div>`;
  }
  function statusRow(st, skipBlock) {
    return ['block', 'bleed', 'burn', 'freeze', 'str'].filter(k => st[k] > 0 && !(skipBlock && k === 'block'))
      .map(k => `<span class="st st-${k}" data-tip="${k}">${img(DB.STATUS[k].icon, '', DB.STATUS[k].name)}<b>${st[k]}</b></span>`).join('');
  }
  const coin = n => `<span class="coin">${img(I.icon('px-bag'), '', '골드')}<b>${n}</b></span>`;
  function relicChip(id) { const r = DB.RELICS[id]; return `<button class="relic-chip" data-relic="${id}" title="${esc(r.name)}">${img(r.icon, '', r.name)}</button>`; }
  function setBg(src, mode) {
    const bg = $('#bg');
    bg.style.backgroundImage = src ? `url("${src}")` : 'none';
    bg.className = 'bg ' + (mode || '');
  }

  /* ---------- 공통: 토스트·모달·정보창 ---------- */
  UI.toast = function (text, kind) {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.innerHTML = text;
    box.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3100);
  };
  function flushToasts() {
    while (G.toasts.length) {
      const t = G.toasts.shift();
      if (t.kind === 'ach') { const a = DB.ACHIEVEMENTS[t.id]; UI.toast(`${img(I.emblem(a.emblem), 'toast-ico')}<span><b>업적 달성</b> ${esc(a.name)}</span>`, 'ach'); }
      else UI.toast(esc(t.text), t.kind);
    }
  }

  // 뒤로 가기(안드로이드 뒤로 버튼 포함)로 닫을 수 있는 창 쌓기. 닫기는 항상 즉시(동기) 처리한다.
  let ignorePop = 0;
  UI.pushLayer = function (close) {
    let pushed = false;
    try { history.pushState({ dbLayer: UI.layers.length + 1 }, ''); pushed = true; } catch (e) { /* 무시 */ }
    UI.layers.push({ close, pushed });
  };
  UI.popLayer = function () {
    const l = UI.layers.pop();
    if (!l) return;
    l.close();
    if (l.pushed) { ignorePop++; try { history.back(); } catch (e) { ignorePop--; } }
  };
  root.addEventListener('popstate', () => {
    if (ignorePop > 0) { ignorePop--; return; }
    const l = UI.layers.pop();
    if (l) l.close();
  });

  UI.modal = function (opts) {
    const rootEl = $('#modalRoot');
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.innerHTML = `<div class="modal panel ${opts.cls || ''}" role="dialog" aria-modal="true">
      ${opts.title ? `<h2 class="modal-title">${opts.title}</h2>` : ''}
      <div class="modal-body">${opts.html || ''}</div>
      <div class="modal-actions">${(opts.buttons || [{ label: '닫기', value: null }]).map((b, i) => `<button class="btn ${b.cls || ''}" data-mb="${i}">${b.label}</button>`).join('')}</div>
    </div>`;
    rootEl.appendChild(wrap);
    let closed = false;
    const close = () => { if (closed) return; closed = true; wrap.remove(); if (opts.onClose) opts.onClose(); };
    UI.pushLayer(close);
    const done = v => { const fn = opts.buttons && opts.buttons[v] && opts.buttons[v].action; UI.popLayer(); if (fn) setTimeout(fn, 0); };
    $$('[data-mb]', wrap).forEach(b => { b.onclick = () => done(+b.dataset.mb); });
    if (!opts.sticky) wrap.addEventListener('click', e => { if (e.target === wrap) UI.popLayer(); });
    if (opts.mount) opts.mount(wrap, () => UI.popLayer());
    return wrap;
  };
  UI.closeAll = function () { while (UI.layers.length) UI.popLayer(); };

  function relicModal(id) {
    const r = DB.RELICS[id];
    UI.modal({ title: esc(r.name), html: `<div class="detail">${img(r.icon, 'detail-ico')}<p>${esc(r.desc)}</p><small class="tier ${r.tier}">${r.tier === 'rare' ? '희귀 유물' : '일반 유물'}</small></div>` });
  }
  function statusModal(k) {
    const s = DB.STATUS[k];
    UI.modal({ title: esc(s.name), html: `<div class="detail">${img(s.icon, 'detail-ico')}<p>${esc(s.desc)}</p></div>` });
  }
  function handsTable() {
    return `<div class="hands">${DB.HANDS.map(h => `<div class="hand-row"><b>${h.name}</b><span>${h.effect}</span></div>`).join('')}</div>
      <p class="muted small">주사위 5개 중 가장 강한 족보 하나로 공격합니다. 같은 눈이 많을수록, 눈이 높을수록 강합니다. 스트레이트는 1-2-3-4-5 또는 2-3-4-5-6입니다.</p>`;
  }

  /* ---------- HUD ---------- */
  function renderHud() {
    const r = G.run, hud = $('#hud');
    const show = UI.view === 'game' && r && r.screen !== 'end';
    hud.classList.toggle('hidden', !show);
    if (!show) return;
    const reg = G.region(r.floor || 1);
    hud.innerHTML = `
      <div class="hud-row">
        <button class="hud-ava" data-act="sheet" data-tab="status" aria-label="캐릭터 상태">${img(I.player, '', '여행자')}</button>
        <div class="hud-hp">${img(I.icon('heal'), 'hud-ico', '체력')}${bar(r.hp, r.maxHp, 'hp')}</div>
        ${coin(r.gold)}
        <button class="round fs-btn" data-act="fs" aria-label="전체화면">${fsIcon()}</button>
        <button class="round" data-act="sheet" data-tab="status" aria-label="메뉴">${img(I.ui('round-menu.webp'), '', '메뉴')}</button>
      </div>
      <div class="hud-sub"><div class="hud-pots">${[0, 1, 2].map(i => r.potions[i] ? `<button class="pot" data-pot="${i}" aria-label="${esc(DB.POTIONS[r.potions[i]].name)}">${img(DB.POTIONS[r.potions[i]].icon, '', DB.POTIONS[r.potions[i]].name)}</button>` : '<span class="pot empty"></span>').join('')}</div><span class="hud-floor">${r.floor ? `${r.floor > DB.CONST.floors ? '최종' : r.floor + '층'} · ${reg.name}` : '여정의 시작'}</span><span class="hud-relics">${r.relics.map(relicChip).join('')}</span></div>`;
    $$('[data-pot]', hud).forEach(b => { b.onclick = () => potionModal(+b.dataset.pot); });
    $$('[data-relic]', hud).forEach(b => { b.onclick = () => relicModal(b.dataset.relic); });
    bindActs(hud);
  }
  function fsIcon() {
    const on = DB.pwa && DB.pwa.fsOn();
    return on ? '<svg viewBox="0 0 24 24"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  }
  UI.paintFs = function () { $$('.fs-btn').forEach(b => { b.innerHTML = fsIcon(); }); $$('[data-fs-label]').forEach(b => { b.textContent = DB.pwa.fsOn() ? '전체화면 끄기' : '전체화면 켜기'; }); };

  function potionModal(i) {
    const r = G.run, id = r.potions[i];
    if (!id) return;
    const p = DB.POTIONS[id];
    const can = G.canUsePotion(i) && !UI.busy;
    UI.modal({
      title: esc(p.name),
      html: `<div class="detail">${img(p.icon, 'detail-ico')}<p>${esc(p.desc)}</p><small class="muted">${p.battle ? '전투 중 내 차례에만 사용할 수 있습니다.' : '언제든 사용할 수 있습니다.'}</small></div>`,
      buttons: [
        { label: '버리기', cls: 'dark', action: () => { G.discardPotion(i); } },
        { label: '닫기', cls: 'dark' },
        { label: '사용', cls: can ? 'teal' : 'gray', action: () => { if (!can) { UI.toast('지금은 사용할 수 없습니다.', 'warn'); return; } if (id === 'fate') fatePicker(i); else G.usePotion(i); } }
      ]
    });
  }
  // 변환의 두루마리: 주사위와 눈을 고른다
  function fatePicker(potIdx) {
    const r = G.run, b = r.battle;
    let die = -1;
    UI.modal({
      title: '변환의 두루마리', html: `<p class="muted">바꿀 주사위를 고른 다음, 원하는 눈을 고르세요.</p><div class="pick-row" id="fpDice">${b.values.map((v, i) => `<button class="pick-die" data-i="${i}">${dieFace(v, r.dice[i].kind)}</button>`).join('')}</div><div class="pick-row" id="fpVals">${[1, 2, 3, 4, 5, 6].map(v => `<button class="pick-die" data-v="${v}" disabled>${dieFace(v)}</button>`).join('')}</div>`,
      buttons: [{ label: '취소', cls: 'dark' }],
      mount(w, close) {
        $$('#fpDice [data-i]', w).forEach(btn => { btn.onclick = () => { die = +btn.dataset.i; $$('#fpDice .pick-die', w).forEach(x => x.classList.toggle('on', x === btn)); $$('#fpVals button', w).forEach(x => { x.disabled = false; }); }; });
        $$('#fpVals [data-v]', w).forEach(btn => { btn.onclick = () => { if (die < 0) return; const v = +btn.dataset.v; close(); setTimeout(() => G.usePotion(potIdx, die, v), 0); }; });
      }
    });
  }

  /* ---------- 렌더 진입점 ---------- */
  UI.render = function () {
    const r = G.run;
    document.body.dataset.view = UI.view;
    renderHud();
    const s = $('#screen');
    if (UI.view !== 'game' || !r) { renderMenu(s); }
    else {
      document.body.dataset.screen = r.screen;
      ({ map: renderMap, battle: renderBattle, reward: renderReward, shop: renderShop, rest: renderRest, event: renderEvent, end: renderEnd })[r.screen](s);
    }
    bindActs(s);
    if (r && r.pendingDice && !$('.modal.dice-picker')) diceReplaceModal();
    flushToasts();
  };

  // data-act 버튼 연결
  function bindActs(scope) {
    $$('[data-act]', scope).forEach(b => {
      b.onclick = e => {
        e.stopPropagation();
        if (UI.busy && b.dataset.act !== 'fs' && b.dataset.act !== 'sheet') return;
        const a = b.dataset.act;
        ACTS[a] && ACTS[a](b);
      };
    });
  }
  const ACTS = {
    newRun() {
      if (G.savedRun) {
        UI.modal({ title: '새 여정', html: '<p>진행 중인 여정이 있습니다. 새로 시작하면 지금 여정은 사라집니다.</p>', buttons: [{ label: '취소', cls: 'dark' }, { label: '새로 시작', cls: 'teal', action: startNew }] });
      } else startNew();
    },
    cont() { if (G.continueRun()) { UI.view = 'game'; UI.mapSel = null; UI.render(); } },
    sheet(b) { openSheet(b.dataset.tab || 'status'); },
    how() { howModal(); },
    fs() { DB.pwa.toggleFs(); },
    install() { DB.pwa.install(); },
    installLater() { G.settings.installDismissed = true; G.saveSettings(); UI.render(); },
    menu() { UI.view = 'menu'; UI.closeAll(); UI.render(); },
    retry() { startNew(); },
    toMenu() { G.run = null; UI.view = 'menu'; UI.render(); },
    leave() { G.leave(); },
    go() { if (UI.mapSel) G.chooseNode(UI.mapSel); },
    reroll() { G.reroll(); },
    attack() { G.attack(); },
    transmute() { transmuteModal(); },
    hands() { UI.modal({ title: '족보와 효과', html: handsTable() }); },
    openChest() { G.openChest(); },
    takePotion() { G.takeRewardPotion(); },
    restHeal() { G.restHeal(); },
    restMeditate() { G.restMeditate(); }
  };
  function startNew() { UI.closeAll(); G.newRun(); UI.view = 'game'; UI.mapSel = null; UI.render(); }

  function howModal() {
    UI.modal({
      title: '게임 방법', cls: 'wide',
      html: `<ol class="how">
        <li><b>맵</b>: 빛나는 노드만 선택할 수 있습니다. 길을 따라 위로 올라가 10층을 지나면 최종 보스가 기다립니다.</li>
        <li><b>전투</b>: 내 차례가 되면 주사위 5개가 자동으로 굴러갑니다. 다시 굴릴 주사위를 눌러 고른 뒤 <b>재굴림</b>을 누르세요. 고르지 않은 주사위는 그대로 남습니다. 재굴림은 한 턴에 2번입니다.</li>
        <li><b>공격</b>: 주사위 5개로 만든 가장 강한 족보가 공격·방어·회복 효과를 냅니다. 적은 다음 행동을 미리 보여 줍니다.</li>
        <li><b>성장</b>: 전투 보상으로 특수 주사위·유물·소모품을 얻고, 상점·휴식·이벤트에서 여정을 준비합니다.</li>
      </ol><h3 class="sub">족보</h3>${handsTable()}`
    });
  }

  /* ---------- 메인 메뉴 ---------- */
  function renderMenu(s) {
    setBg(I.bg.menu, 'menu');
    const standalone = DB.pwa && DB.pwa.standalone();
    const showBanner = !standalone && !G.settings.installDismissed;
    s.innerHTML = `<section class="menu">
      ${showBanner ? `<div class="install-banner panel"><div><b>홈 화면에 설치하기</b><span>설치하면 주소창 없이 전체 화면으로 즐길 수 있습니다.</span></div><div class="ib-btns"><button class="btn teal sm" data-act="install">설치하기</button><button class="btn dark sm" data-act="fs">전체화면</button><button class="btn dark sm" data-act="installLater">다음에</button></div></div>` : ''}
      <div class="menu-hero">
        <div class="menu-art">${img(I.bg.menuWide, '', '')}</div>
        ${img(I.logo, 'logo', 'DICEBOUND')}
        <p class="tagline">주사위가 향하는 곳에, 운명이 있다.</p>
      </div>
      <div class="menu-btns">
        ${G.savedRun ? `<button class="btn teal big" data-act="cont">이어하기 <small>${G.savedRun.floor ? G.savedRun.floor + '층' : '시작 지점'} · 체력 ${G.savedRun.hp}</small></button>` : ''}
        <button class="btn ${G.savedRun ? 'dark' : 'teal'} big" data-act="newRun">새 여정 시작</button>
        <div class="menu-grid">
          <button class="btn dark" data-act="sheet" data-tab="codex">도감</button>
          <button class="btn dark" data-act="sheet" data-tab="ach">업적</button>
          <button class="btn dark" data-act="how">게임 방법</button>
          <button class="btn dark" data-act="sheet" data-tab="settings">설정</button>
        </div>
      </div>
      <div class="menu-foot">
        <div class="boss-row">${Object.keys(DB.ENEMIES).filter(k => DB.ENEMIES[k].type === 'boss').map(k => img(DB.ENEMIES[k].marker, G.meta.bosses[k] ? 'beaten' : '', DB.ENEMIES[k].name)).join('')}</div>
        <small class="muted">여정 ${G.meta.runs}회 · 정복 ${G.meta.wins}회 · 최고 ${G.meta.bestFloor}층</small>
        ${standalone ? '' : '<button class="btn dark sm" data-act="install">홈 화면에 설치하기</button>'}
      </div>
    </section>`;
  }

  /* ---------- 맵 ---------- */
  const ROW = 86, TOP = 92, BOTTOM = 60;
  function renderMap(s) {
    const r = G.run, map = r.map, F = map.floors;
    const reg = G.region(r.floor + 1 > F ? F + 1 : r.floor + 1);
    setBg(I.bg[reg.bg], 'map');
    const av = G.available();
    const H = TOP + F * ROW + BOTTOM;
    const y = f => (f === F + 1 ? 48 : TOP + (F - f) * ROW + ROW / 2);
    const nodes = Object.values(map.nodes);
    const px = x => 10 + x * 0.82; // 노드가 화면 밖으로 잘리지 않게 좌우 여백을 둔다
    const visitedEdge = (a, b) => { const i = r.visited.indexOf(a); return i >= 0 && r.visited[i + 1] === b; };
    let lines = '';
    nodes.forEach(n => n.next.forEach(id => {
      const m = map.nodes[id];
      const cls = visitedEdge(n.id, id) ? 'done' : (r.pos === n.id && av.indexOf(id) >= 0) ? 'open' : '';
      lines += `<line x1="${px(n.x)}" y1="${y(n.f)}" x2="${px(m.x)}" y2="${y(m.f)}" class="${cls}" />`;
    }));
    const boss = DB.ENEMIES[r.bossKey];
    const btns = nodes.map(n => {
      const isAv = av.indexOf(n.id) >= 0, vis = r.visited.indexOf(n.id) >= 0, cur = r.pos === n.id;
      const cls = ['node', 'nt-' + n.type, isAv ? 'avail' : '', vis ? 'visited' : '', cur ? 'current' : '', UI.mapSel === n.id ? 'sel' : ''].join(' ');
      const inner = n.type === 'boss' ? `${img(I.node('boss'), 'node-img', '보스')}${img(boss.marker, 'boss-mark', boss.name)}<span class="boss-name">${esc(boss.name)}</span>` : img(I.node(n.type), 'node-img', DB.NODE_TYPES[n.type].name);
      return `<button class="${cls}" data-node="${n.id}" style="left:${px(n.x)}%;top:${y(n.f)}px" aria-label="${n.f}층 ${DB.NODE_TYPES[n.type].name}${isAv ? ' (이동 가능)' : ''}">${inner}${cur ? `<span class="you">${img(I.player, '', '현재 위치')}</span>` : ''}</button>`;
    }).join('');
    const floorsLbl = Array.from({ length: F }, (_, i) => `<span class="flabel" style="top:${y(i + 1)}px">${i + 1}</span>`).join('');
    const sel = UI.mapSel && map.nodes[UI.mapSel];
    const selAv = sel && av.indexOf(sel.id) >= 0;
    s.innerHTML = `<section class="mapscreen">
      <div class="map-head"><div><small class="eyebrow">${esc(reg.name)}</small><h2>어디로 향할까?</h2></div><button class="btn dark sm" data-act="menu">메인 메뉴</button></div>
      <div class="map-scroll" id="mapScroll"><div class="map" style="height:${H}px">
        <svg class="edges" viewBox="0 0 100 ${H}" preserveAspectRatio="none">${lines}</svg>${floorsLbl}${btns}
      </div></div>
      <div class="map-info panel">${sel ? `${img(I.node(sel.type === 'boss' ? 'boss' : sel.type), 'mi-ico')}<div class="mi-text"><b>${sel.type === 'boss' ? esc(boss.name) : DB.NODE_TYPES[sel.type].name}</b><span>${sel.type === 'boss' ? esc(boss.desc) : DB.NODE_TYPES[sel.type].desc}</span></div><button class="btn ${selAv ? 'teal' : 'gray'}" data-act="go" ${selAv ? '' : 'disabled'}>${selAv ? '이동하기' : (r.visited.indexOf(sel.id) >= 0 ? '지나온 곳' : '갈 수 없음')}</button>` : `<div class="mi-text"><b>${r.pos ? '다음 경로를 고르세요' : '여정을 시작합니다'}</b><span>빛나는 노드를 눌러 정보를 보고 이동하세요. 연결된 다음 노드로만 갈 수 있습니다.</span></div>`}</div>
    </section>`;
    $$('[data-node]', s).forEach(b => {
      b.onclick = () => {
        const id = b.dataset.node;
        if (UI.mapSel === id && av.indexOf(id) >= 0) { G.chooseNode(id); return; }
        UI.mapSel = id; UI.render();
      };
    });
    // 현재 위치가 보이도록 스크롤
    const sc = $('#mapScroll', s);
    const target = sel ? y(sel.f) : r.pos ? y(map.nodes[r.pos].f) : y(1);
    requestAnimationFrame(() => { sc.scrollTop = Math.max(0, target - sc.clientHeight * 0.55); });
  }

  /* ---------- 전투 ---------- */
  function intentHTML(e) {
    const mv = e.intent;
    if (!mv) return '';
    const parts = [];
    if (mv.atk) { const per = R.enemyHit(mv, e.status); parts.push(`<span class="it atk">${img(I.icon('px-sword'), '', '공격')}<b>${per}${mv.hits > 1 ? '×' + mv.hits : ''}</b></span>`); }
    if (mv.block) parts.push(`<span class="it">${img(DB.STATUS.block.icon, '', '방어')}<b>${mv.block}</b></span>`);
    if (mv.heal) parts.push(`<span class="it">${img(I.icon('heal'), '', '회복')}<b>${mv.heal}</b></span>`);
    if (mv.buff) parts.push(`<span class="it">${img(DB.STATUS.str.icon, '', '힘')}<b>+${mv.buff}</b></span>`);
    if (mv.apply) Object.keys(mv.apply).forEach(k => parts.push(`<span class="it">${img(DB.STATUS[k].icon, '', DB.STATUS[k].name)}<b>${mv.apply[k]}</b></span>`));
    if (mv.charge) parts.push(`<span class="it warn">${img(I.fx('void'), 'fxi', '')}<b>강력한 공격 준비</b></span>`);
    return `<div class="intent"><small>다음 행동</small><strong>${esc(mv.name)}</strong><div class="it-row">${parts.join('')}</div></div>`;
  }
  function previewHTML(p) {
    if (!p) return '';
    const chips = [`<span class="chip atk">${img(I.icon('px-sword'), '', '공격')}${p.atk}</span>`];
    if (p.block) chips.push(`<span class="chip">${img(DB.STATUS.block.icon, '', '방어')}${p.block}</span>`);
    if (p.heal) chips.push(`<span class="chip">${img(I.icon('heal'), '', '회복')}${p.heal}</span>`);
    if (p.gold) chips.push(`<span class="chip">${img(I.icon('px-bag'), '', '골드')}${p.gold}</span>`);
    ['bleed', 'burn', 'freeze'].forEach(k => { if (p.apply[k]) chips.push(`<span class="chip">${img(DB.STATUS[k].icon, '', DB.STATUS[k].name)}${p.apply[k]}</span>`); });
    if (p.selfDmg) chips.push(`<span class="chip bad">자신 -${p.selfDmg}</span>`);
    return `<div class="preview"><button class="hand-name" data-act="hands" aria-label="족보표 보기"><small>현재 족보</small><b>${p.hand.name}</b></button><div class="chips">${chips.join('')}</div></div>`;
  }
  function renderBattle(s) {
    const r = G.run, b = r.battle, e = b.enemy;
    const boss = e.type === 'boss', elite = e.type === 'elite';
    setBg(boss ? I.bg.hell : I.bg.battle, 'battle');
    const p = G.preview();
    const can = b.phase === 'player' && !UI.busy;
    const typeName = boss ? '보스' : elite ? '정예' : '일반';
    const rolled = (UI.lastRoll && UI.lastRoll.id === b.rollId && UI.lastRoll.key === r.stats.turns) ? null : (G.events.find(ev => ev.type === 'roll') || null);
    UI.lastRoll = { id: b.rollId, key: r.stats.turns };
    s.innerHTML = `<section class="battle ${boss ? 'is-boss' : ''} ${elite ? 'is-elite' : ''}">
      <div class="arena">
        <div class="foe">
          ${intentHTML(e)}
          <div class="foe-card" id="foeCard">${img(e.img, 'foe-img', e.name)}<div class="fx-anchor" id="fxFoe"></div></div>
          <div class="foe-info">
            <div class="foe-name"><span class="tag ${e.type}">${typeName}</span><b>${esc(e.name)}</b></div>
            <div class="hpline">${bar(e.hp, e.maxHp, 'enemy')}${e.status.block ? `<span class="blk" data-st="block">${img(DB.STATUS.block.icon, '', '방어')}<b>${e.status.block}</b></span>` : ''}</div>
            <div class="sts" id="eSts">${statusRow(e.status, true)}</div>
          </div>
        </div>
        <div class="me">
          <div class="me-ava" id="meCard">${img(I.player, '', '여행자')}<div class="fx-anchor" id="fxMe"></div></div>
          <div class="me-info">
            <div class="hpline">${bar(r.hp, r.maxHp, 'hp')}${b.status.block ? `<span class="blk">${img(DB.STATUS.block.icon, '', '방어')}<b>${b.status.block}</b></span>` : ''}</div>
            <div class="sts" id="pSts">${statusRow(b.status, true)}</div>
          </div>
        </div>
      </div>
      <div class="control panel">
        ${previewHTML(p)}
        <div class="tray" id="tray">${b.values.map((v, i) => {
          const sel = b.selected.indexOf(i) >= 0;
          const roll = rolled && (rolled.all || (rolled.idx || []).indexOf(i) >= 0);
          const kd = r.dice[i].kind;
          return `<button class="die ${sel ? 'sel' : ''} ${roll ? 'rolling' : ''}" data-die="${i}" ${can && b.rerollsLeft > 0 ? '' : 'disabled'} aria-pressed="${sel}" aria-label="${i + 1}번 주사위 ${v} 눈${kd ? ' ' + DB.DICE[kd].name : ''}${sel ? ', 다시 굴릴 주사위' : ''}">${dieFace(v, kd)}${sel ? '<span class="re-mark">↻</span>' : ''}</button>`;
        }).join('')}</div>
        <div class="tray-info"><span>재굴림 <b>${b.rerollsLeft}</b> / ${b.rerollsMax}</span><span>${b.rerollsLeft > 0 ? `다시 굴릴 주사위 <b>${b.selected.length}</b>개 선택` : '재굴림을 모두 사용했습니다'}</span><span>턴 ${b.turn}</span></div>
        <div class="acts">
          <button class="btn dark" data-act="reroll" ${can && b.rerollsLeft > 0 && b.selected.length ? '' : 'disabled'}>재굴림</button>
          <button class="btn red" data-act="attack" ${can ? '' : 'disabled'}>공격</button>
        </div>
        ${G.canTransmute() ? '<button class="btn dark sm wide" data-act="transmute">변환 주사위 사용 (전투당 1회)</button>' : ''}
        <div class="blog" id="blog">${b.log.slice(-2).map(t => `<p>${esc(t)}</p>`).join('')}</div>
      </div>
    </section>`;
    $$('[data-die]', s).forEach(d => { d.onclick = () => { if (!UI.busy) G.toggleDie(+d.dataset.die); }; });
    $$('.sts [data-tip], .blk', s).forEach(x => { x.onclick = () => statusModal(x.dataset.tip || 'block'); });
  }
  function transmuteModal() {
    UI.modal({
      title: '변환 주사위', html: `<p class="muted">변환 주사위의 눈을 원하는 숫자로 바꿉니다. 전투마다 한 번만 쓸 수 있습니다.</p><div class="pick-row">${[1, 2, 3, 4, 5, 6].map(v => `<button class="pick-die" data-v="${v}">${dieFace(v, 'transmute')}</button>`).join('')}</div>`,
      buttons: [{ label: '취소', cls: 'dark' }],
      mount(w, close) { $$('[data-v]', w).forEach(b => { b.onclick = () => { const v = +b.dataset.v; close(); setTimeout(() => G.transmute(v), 0); }; }); }
    });
  }

  /* ---------- 전투 연출 재생 ---------- */
  const wait = ms => new Promise(res => setTimeout(res, G.settings.reduceMotion ? Math.min(ms, 120) : ms));
  function fx(anchorId, name, cls) {
    const a = document.getElementById(anchorId);
    if (!a || G.settings.reduceMotion) return;
    const el = document.createElement('img');
    el.src = I.fx(name); el.className = 'fx ' + (cls || ''); el.alt = '';
    a.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }
  function floatText(anchorId, text, cls) {
    const a = document.getElementById(anchorId);
    if (!a) return;
    const el = document.createElement('span');
    el.className = 'float ' + (cls || '');
    el.textContent = text;
    a.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }
  function shake(id) { const el = document.getElementById(id); if (!el || G.settings.reduceMotion) return; el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
  function applySnap(sn) {
    if (!sn) return;
    const eb = $('.foe .bar'), pb = $('.me .bar');
    if (eb) { eb.querySelector('i').style.width = `${Math.max(0, sn.eHp / sn.eMax * 100)}%`; eb.querySelector('span').textContent = `${sn.eHp} / ${sn.eMax}`; }
    if (pb) { pb.querySelector('i').style.width = `${Math.max(0, sn.pHp / sn.pMax * 100)}%`; pb.querySelector('span').textContent = `${sn.pHp} / ${sn.pMax}`; }
    const es = $('#eSts'), ps = $('#pSts');
    if (es) es.innerHTML = statusRow(sn.eSt);
    if (ps) ps.innerHTML = statusRow(sn.pSt);
  }
  const ANIM = ['playerAttack', 'tick', 'enemyMove', 'victory', 'defeat', 'potion'];
  async function play(events) {
    UI.busy = true;
    document.body.classList.add('busy');
    $$('.control button, .hud button.pot').forEach(b => { b.disabled = true; });
    for (const ev of events) {
      if (ev.type === 'playerAttack') {
        fx('fxFoe', ev.hand.rank >= 4 ? 'slash-fire' : 'slash-ice');
        shake('foeCard');
        floatText('fxFoe', ev.absorbed && !(ev.atk - ev.absorbed) ? '막힘' : `-${ev.atk - ev.absorbed}`, 'dmg');
        if (ev.block) { fx('fxMe', 'rune'); floatText('fxMe', `방어 +${ev.block}`, 'blk'); }
        if (ev.heal) { fx('fxMe', 'heal'); floatText('fxMe', `+${ev.heal}`, 'heal'); }
        if (ev.apply.bleed) fx('fxFoe', 'burst-pink', 'small');
        if (ev.apply.freeze) fx('fxFoe', 'shards', 'small');
        if (ev.apply.burn) fx('fxFoe', 'burst-fire', 'small');
        applySnap(ev.snap);
        await wait(650);
      } else if (ev.type === 'tick') {
        const anchor = ev.who === 'player' ? 'fxMe' : 'fxFoe';
        fx(anchor, ev.status === 'bleed' ? 'burst-pink' : 'burst-fire', 'small');
        floatText(anchor, `-${ev.amount}`, 'dmg');
        applySnap(ev.snap);
        await wait(450);
      } else if (ev.type === 'enemyMove') {
        const mv = ev.move;
        if (mv.atk) { fx('fxMe', G.run.battle && G.run.battle.enemy.type === 'boss' ? 'void' : 'bolt'); shake('meCard'); floatText('fxMe', ev.dealt ? `-${ev.dealt}` : '막음', 'dmg'); }
        if (mv.block) fx('fxFoe', 'rune', 'small');
        if (mv.heal) { fx('fxFoe', 'heal', 'small'); floatText('fxFoe', `+${mv.heal}`, 'heal'); }
        if (mv.buff) fx('fxFoe', 'burst-fire', 'small');
        const it = $('.intent'); if (it) it.classList.add('acting');
        applySnap(ev.snap);
        await wait(700);
      } else if (ev.type === 'potion') {
        fx(ev.id === 'bomb' || ev.id === 'frost' ? 'fxFoe' : 'fxMe', { bomb: 'burst-fire', frost: 'shards', heal: 'heal', cure: 'heal', ward: 'rune', might: 'burst-fire', reroll: 'rune', fate: 'vortex' }[ev.id] || 'rune');
        applySnap(ev.snap);
        await wait(400);
      } else if (ev.type === 'victory') {
        const c = $('#foeCard'); if (c) c.classList.add('dying');
        applySnap(ev.snap);
        await wait(800);
      } else if (ev.type === 'defeat') {
        const c = $('#meCard'); if (c) c.classList.add('dying');
        applySnap(ev.snap);
        await wait(900);
      }
    }
    UI.busy = false;
    document.body.classList.remove('busy');
    UI.render();
  }
  UI.onGameChange = function () {
    const evs = G.events;
    const animated = evs.some(e => ANIM.indexOf(e.type) >= 0);
    if (animated && $('.battle') && UI.view === 'game') { G.events = evs.filter(e => ANIM.indexOf(e.type) < 0); play(evs); }
    else UI.render();
  };

  /* ---------- 특수 주사위 교체 창 ---------- */
  function diceReplaceModal() {
    const r = G.run, p = r.pendingDice, k = DB.DICE[p.kind];
    let chosen = -1;
    const priceNote = p.source.type === 'shop' ? `<p class="muted small">교체를 확정하면 ${r.shop.items[p.source.idx].price}골드를 지불합니다.</p>` : '';
    UI.modal({
      title: '주사위 교체', cls: 'dice-picker', sticky: true,
      html: `<div class="new-die">${dieFace(6, p.kind, 'big')}<div><b>${esc(k.name)}</b><span>${esc(k.desc)}</span></div></div>${priceNote}
        <p>어느 주사위와 바꿀까요?</p>
        <div class="pick-row">${r.dice.map((d, i) => `<button class="pick-die slot" data-slot="${i}">${dieFace(6, d.kind)}<small>${d.kind ? esc(DB.DICE[d.kind].name.replace(' 주사위', '')) : '기본'}</small></button>`).join('')}</div>`,
      buttons: [{ label: '취소', cls: 'dark' }],
      onClose: () => { if (chosen >= 0) G.replaceDie(chosen); else G.cancelDice(); },
      mount(w, close) {
        $$('[data-slot]', w).forEach(b => { b.onclick = () => { chosen = +b.dataset.slot; close(); }; });
      }
    });
  }

  /* ---------- 보상·보물 ---------- */
  function choiceCard(icon, title, desc, attrs, extra) {
    return `<button class="card" ${attrs}>${icon}<span class="card-text"><b>${title}</b><small>${desc}</small></span>${extra || ''}</button>`;
  }
  function renderReward(s) {
    const r = G.run, rw = r.reward;
    const tre = rw.kind === 'treasure';
    setBg(tre ? I.bg.event : I.bg.battle, 'dim');
    let body = '';
    if (tre) {
      body += `<div class="chest ${rw.opened ? 'open' : ''}">${img(I.treasure, 'chest-art', '보물 상자')}${rw.opened ? `<p class="gain">${coin('+' + rw.gold)} 골드를 발견했다!</p>` : '<button class="btn teal" data-act="openChest">상자 열기</button>'}</div>`;
    } else {
      body += `<p class="gain">${coin('+' + rw.gold)} 골드 획득${rw.bounty ? ` (현상금 ${rw.bounty} 포함)` : ''}</p>`;
    }
    if (!tre || rw.opened) {
      if (rw.potion) {
        const p = DB.POTIONS[rw.potion];
        body += `<h3 class="sub">소모품</h3>${choiceCard(img(p.icon, 'card-ico'), esc(p.name), esc(p.desc), `data-act="takePotion" ${rw.potionTaken ? 'disabled' : ''}`, `<em>${rw.potionTaken ? '받음' : '받기'}</em>`)}`;
      }
      if (rw.relics.length) {
        body += `<h3 class="sub">유물 <small>${rw.relicTaken ? '획득 완료' : '하나를 고르세요'}</small></h3><div class="cards">${rw.relics.map(id => { const x = DB.RELICS[id]; const mine = r.relics.indexOf(id) >= 0; return choiceCard(img(x.icon, 'card-ico'), esc(x.name), esc(x.desc), `data-rrelic="${id}" ${rw.relicTaken ? 'disabled' : ''} ${mine ? 'data-chosen' : ''}`, `<em class="tier ${x.tier}">${mine ? '획득' : x.tier === 'rare' ? '희귀' : '일반'}</em>`); }).join('')}</div>`;
      }
      if (rw.dice.length) {
        body += `<h3 class="sub">특수 주사위 <small>${rw.diceTaken ? '획득 완료' : '하나를 골라 기존 주사위와 교체'}</small></h3><div class="cards">${rw.dice.map(k => { const d = DB.DICE[k]; return choiceCard(dieFace(6, k, 'card-die'), esc(d.name), esc(d.desc), `data-rdie="${k}" ${rw.diceTaken ? 'disabled' : ''}`, `<em class="tier ${d.rarity}">${d.rarity === 'rare' ? '희귀' : '일반'}</em>`); }).join('')}</div>`;
      }
    }
    const pending = (tre && !rw.opened) || (rw.relics.length && !rw.relicTaken) || (rw.dice.length && !rw.diceTaken) || (rw.potion && !rw.potionTaken);
    s.innerHTML = `<section class="page reward">
      <div class="page-head"><small class="eyebrow">${tre ? 'TREASURE' : 'VICTORY'}</small><h2>${esc(rw.title)}</h2></div>
      <div class="panel page-body">${body}</div>
      <div class="page-foot"><button class="btn ${pending ? 'dark' : 'teal'} wide" data-act="leave" ${tre && !rw.opened ? 'disabled' : ''}>${pending ? '남은 보상을 두고 맵으로' : '맵으로 돌아가기'}</button></div>
    </section>`;
    $$('[data-rrelic]', s).forEach(b => { b.onclick = () => G.chooseRewardRelic(b.dataset.rrelic); });
    $$('[data-rdie]', s).forEach(b => { b.onclick = () => G.chooseRewardDie(b.dataset.rdie); });
  }

  /* ---------- 상점 ---------- */
  function renderShop(s) {
    const r = G.run, sh = r.shop, npc = DB.NPC[sh.npc];
    setBg(I.bg.shop, 'dim');
    const item = (it, i) => {
      let icon, name, desc, tag = '';
      if (it.cat === 'dice') { const d = DB.DICE[it.id]; icon = dieFace(6, it.id, 'card-die'); name = d.name; desc = d.desc; tag = d.rarity === 'rare' ? '희귀' : '일반'; }
      else if (it.cat === 'relic') { const x = DB.RELICS[it.id]; icon = img(x.icon, 'card-ico'); name = x.name; desc = x.desc; tag = x.tier === 'rare' ? '희귀' : '일반'; }
      else if (it.cat === 'potion') { const x = DB.POTIONS[it.id]; icon = img(x.icon, 'card-ico'); name = x.name; desc = x.desc; }
      else { icon = img(I.icon('heal'), 'card-ico'); name = '치유사의 손길'; desc = '체력 20 회복'; }
      const afford = r.gold >= it.price;
      return `<div class="shop-item ${it.sold ? 'sold' : ''}">${icon}<div class="si-text"><b>${esc(name)}${tag ? ` <em class="tier ${tag === '희귀' ? 'rare' : 'common'}">${tag}</em>` : ''}</b><small>${esc(desc)}</small></div>
        <div class="si-buy">${coin(it.price)}<button class="btn ${it.sold ? 'gray' : afford ? 'teal' : 'dark'} sm" data-buy="${i}" ${it.sold ? 'disabled' : ''}>${it.sold ? '판매 완료' : '구매'}</button></div></div>`;
    };
    const sec = (cat, title) => { const list = sh.items.map((it, i) => [it, i]).filter(x => x[0].cat === cat); return list.length ? `<h3 class="sub">${title}</h3><div class="shop-list">${list.map(x => item(x[0], x[1])).join('')}</div>` : ''; };
    s.innerHTML = `<section class="page shop">
      <div class="npc-banner">${img(npc.img, 'npc-img', npc.name)}<div class="npc-talk frame"><small>${esc(npc.name)}</small><p>"어서 오게, 여행자. 골드만 있다면 무엇이든 내주지."</p></div></div>
      <div class="panel page-body">${sec('dice', '특수 주사위')}${sec('relic', '유물')}${sec('potion', '소모품')}${sec('service', '서비스')}</div>
      <div class="page-foot"><button class="btn teal wide" data-act="leave">상점 떠나기</button></div>
    </section>`;
    $$('[data-buy]', s).forEach(b => { b.onclick = () => G.buy(+b.dataset.buy); });
  }

  /* ---------- 휴식 ---------- */
  function renderRest(s) {
    const r = G.run, st = r.rest, npc = DB.NPC.healer;
    setBg(I.bg.event, 'dim');
    const amt = Math.round(r.maxHp * 0.3) + (r.relics.indexOf('lantern') >= 0 ? 10 : 0);
    s.innerHTML = `<section class="page rest">
      <div class="npc-banner">${img(npc.img, 'npc-img', npc.name)}<div class="npc-talk frame"><small>${npc.name}</small><p>"모닥불 곁에서 잠시 쉬어 가세요. 하나만 고를 수 있어요."</p></div></div>
      <div class="panel page-body">
        ${st.done ? `<div class="result">${img(I.node('rest'), 'res-ico')}<p>${esc(st.result)}</p></div>` : `
        <div class="cards">
          ${choiceCard(img(I.icon('heal'), 'card-ico'), '휴식', `체력 ${amt} 회복 (현재 ${r.hp}/${r.maxHp})`, 'data-act="restHeal"')}
          ${choiceCard(img(I.emblem('blue'), 'card-ico'), '명상', '최대 체력 +5', 'data-act="restMeditate"')}
        </div>
        <h3 class="sub">단련 <small>특수 주사위 하나를 골라 장착</small></h3>
        <div class="cards">${st.train.map(k => choiceCard(dieFace(6, k, 'card-die'), esc(DB.DICE[k].name), esc(DB.DICE[k].desc), `data-train="${k}"`)).join('')}</div>`}
      </div>
      <div class="page-foot"><button class="btn ${st.done ? 'teal' : 'dark'} wide" data-act="leave">${st.done ? '여정 계속하기' : '쉬지 않고 떠나기'}</button></div>
    </section>`;
    $$('[data-train]', s).forEach(b => { b.onclick = () => G.restTrain(b.dataset.train); });
  }

  /* ---------- 이벤트 ---------- */
  function renderEvent(s) {
    const r = G.run, ev = r.event, def = G.EVENTS[ev.id], npc = def.npc && DB.NPC[def.npc];
    setBg(I.bg.event, 'dim');
    let body;
    if (ev.done && ev.result) {
      const x = ev.result;
      body = `<div class="result">${x.dice ? `<div class="res-dice">${x.dice.map(v => dieFace(v, null, 'big rolling')).join('')}</div>` : ''}${x.relic ? img(DB.RELICS[x.relic].icon, 'res-ico') : ''}<p>${esc(x.text)}</p></div>`;
    } else if (ev.pickDice) {
      body = `<p>하나를 골라 기존 주사위와 교체하세요.</p><div class="cards">${ev.pickDice.map(k => choiceCard(dieFace(6, k, 'card-die'), esc(DB.DICE[k].name), esc(DB.DICE[k].desc), `data-edie="${k}"`)).join('')}</div>`;
    } else {
      body = `<div class="choices">${def.choices.map((c, i) => { const ok = G.eventCan(i); return `<button class="choice" data-ev="${i}" ${ok === true ? '' : 'disabled'}><b>${esc(c.label)}</b><small>${esc(ok === true ? c.desc : ok || c.desc)}</small></button>`; }).join('')}</div>`;
    }
    s.innerHTML = `<section class="page event">
      <div class="event-art">${img(I.bg.event, 'ev-bg', '')}${npc ? img(npc.img, 'npc-img', npc.name) : ''}</div>
      <div class="frame ev-text"><small class="eyebrow">${npc ? esc(npc.name) : 'EVENT'}</small><h2>${esc(def.title)}</h2><p>${esc(def.text)}</p></div>
      <div class="panel page-body">${body}</div>
      <div class="page-foot"><button class="btn ${ev.done ? 'teal' : 'dark'} wide" data-act="leave">${ev.done ? '맵으로 돌아가기' : '그냥 떠나기'}</button></div>
    </section>`;
    $$('[data-ev]', s).forEach(b => { b.onclick = () => G.eventChoose(+b.dataset.ev); });
    $$('[data-edie]', s).forEach(b => { b.onclick = () => G.eventPickDie(b.dataset.edie); });
  }

  /* ---------- 엔딩 ---------- */
  function renderEnd(s) {
    const r = G.run, res = r.result, st = r.stats;
    const boss = DB.ENEMIES[r.bossKey];
    setBg(res.won ? I.bg.hell : I.bg.battle, 'dim');
    const killer = res.enemy && DB.ENEMIES[res.enemy];
    const mins = Math.max(1, Math.round(res.time / 60000));
    s.innerHTML = `<section class="page end ${res.won ? 'won' : 'lost'}">
      <div class="end-art">${res.won ? `${img(boss.img, 'end-foe', boss.name)}${img(I.emblem('gold'), 'end-emblem', '')}` : `${img(I.player, 'end-me', '여행자')}${killer ? img(killer.img, 'end-foe small', killer.name) : ''}`}</div>
      <div class="frame end-text"><small class="eyebrow">${res.won ? 'VICTORY' : 'GAME OVER'}</small><h1>${res.won ? '운명을 정복했다' : '여정이 끝났다'}</h1>
        <p>${res.won ? `${esc(boss.name)}을(를) 쓰러뜨리고 주사위의 운명을 손에 넣었습니다.` : `${res.floor}층에서 ${killer ? esc(killer.name) + '에게 ' : ''}쓰러졌습니다. 다른 길과 조합으로 다시 도전하세요.`}</p></div>
      <div class="panel stats">
        <div><small>도달 층</small><b>${res.floor > DB.CONST.floors ? '보스' : res.floor + '층'}</b></div>
        <div><small>처치</small><b>${st.kills}</b></div>
        <div><small>정예 처치</small><b>${st.elites}</b></div>
        <div><small>준 피해</small><b>${st.dealt}</b></div>
        <div><small>최대 일격</small><b>${st.maxHit}</b></div>
        <div><small>모은 골드</small><b>${st.gold}</b></div>
        <div><small>턴 수</small><b>${st.turns}</b></div>
        <div><small>플레이 시간</small><b>${mins}분</b></div>
      </div>
      <div class="panel end-build"><h3 class="sub">이번 여정의 빌드</h3><div class="pick-row">${r.dice.map(d => dieFace(6, d.kind)).join('')}</div><div class="relic-row">${r.relics.map(relicChip).join('') || '<small class="muted">유물 없음</small>'}</div></div>
      <div class="page-foot two"><button class="btn dark" data-act="toMenu">메인 메뉴</button><button class="btn teal" data-act="retry">다시 도전</button></div>
    </section>`;
    $$('[data-relic]', s).forEach(b => { b.onclick = () => relicModal(b.dataset.relic); });
  }

  /* ---------- 정보창: 상태·가방·족보·도감·업적·설정 ---------- */
  function openSheet(tab) {
    const inRun = UI.view === 'game' && G.run && G.run.screen !== 'end';
    const tabs = (inRun ? [['status', '상태'], ['bag', '가방']] : []).concat([['hands', '족보'], ['codex', '도감'], ['ach', '업적'], ['settings', '설정']]);
    if (!tabs.some(t => t[0] === tab)) tab = tabs[0][0];
    let codexTab = 'enemies';
    UI.modal({
      cls: 'sheet', title: '',
      html: `<div class="tabs">${tabs.map(t => `<button class="tab" data-tab="${t[0]}">${t[1]}</button>`).join('')}</div><div class="tab-body" id="tabBody"></div>`,
      buttons: [{ label: '닫기', cls: 'dark' }],
      mount(w, close) {
        const draw = () => {
          $$('.tab', w).forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
          const body = $('#tabBody', w);
          body.innerHTML = sheetTab(tab, codexTab);
          $$('[data-ctab]', body).forEach(b => { b.onclick = () => { codexTab = b.dataset.ctab; draw(); }; });
          $$('[data-relic]', body).forEach(b => { b.onclick = () => relicModal(b.dataset.relic); });
          $$('[data-spot]', body).forEach(b => { b.onclick = () => { close(); setTimeout(() => potionModal(+b.dataset.spot), 0); }; });
          $$('[data-set]', body).forEach(inp => { inp.onchange = () => { G.settings[inp.dataset.set] = inp.checked; G.saveSettings(); if (inp.dataset.set === 'wakeLock') DB.pwa.wake(); }; });
          const q = id => $('#' + id, body);
          if (q('sFs')) q('sFs').onclick = () => DB.pwa.toggleFs();
          if (q('sInst')) q('sInst').onclick = () => DB.pwa.install();
          if (q('sAbandon')) q('sAbandon').onclick = () => { close(); setTimeout(() => UI.modal({ title: '여정 포기', html: '<p>지금 여정을 포기하고 메인 메뉴로 돌아갈까요? 진행 상황은 사라집니다.</p>', buttons: [{ label: '취소', cls: 'dark' }, { label: '포기하기', cls: 'red', action: () => { G.abandonRun(); UI.view = 'menu'; UI.render(); } }] }), 0); };
          if (q('sReset')) q('sReset').onclick = () => { close(); setTimeout(() => UI.modal({ title: '기록 초기화', html: '<p>도감과 업적, 통계를 모두 지울까요? 되돌릴 수 없습니다.</p>', buttons: [{ label: '취소', cls: 'dark' }, { label: '초기화', cls: 'red', action: () => { DB.store.del('dicebound.meta.v1'); G.load(); UI.render(); UI.toast('기록을 초기화했습니다.'); } }] }), 0); };
          if (q('sMenu')) q('sMenu').onclick = () => { close(); setTimeout(() => { UI.view = 'menu'; UI.render(); }, 0); };
        };
        $$('.tab', w).forEach(b => { b.onclick = () => { tab = b.dataset.tab; draw(); }; });
        draw();
      }
    });
  }
  function sheetTab(tab, codexTab) {
    const r = G.run, m = G.meta;
    if (tab === 'status') {
      return `<div class="status-top">${img(I.player, 'st-ava', '여행자')}<div><b>여행자</b>${bar(r.hp, r.maxHp, 'hp')}<div class="st-line">${coin(r.gold)}<span>${r.floor ? r.floor + '층' : '출발 전'} · ${esc(G.region(r.floor || 1).name)}</span></div></div></div>
        <h3 class="sub">주사위</h3><div class="dice-list">${r.dice.map((d, i) => `<div class="dl">${dieFace(6, d.kind)}<div><b>${i + 1}. ${d.kind ? esc(DB.DICE[d.kind].name) : '기본 주사위'}</b><small>${d.kind ? esc(DB.DICE[d.kind].desc) : '특별한 효과가 없다.'}</small></div></div>`).join('')}</div>
        <h3 class="sub">이번 여정</h3><div class="mini-stats"><span>처치 ${r.stats.kills}</span><span>정예 ${r.stats.elites}</span><span>준 피해 ${r.stats.dealt}</span><span>받은 피해 ${r.stats.taken}</span><span>최대 일격 ${r.stats.maxHit}</span></div>
        <button class="btn dark sm wide" id="sMenu">메인 메뉴로 (자동 저장)</button>`;
    }
    if (tab === 'bag') {
      return `<h3 class="sub">소모품 <small>${r.potions.length} / ${DB.CONST.potionSlots}</small></h3><div class="bag">${[0, 1, 2].map(i => r.potions[i] ? `<button class="bag-slot" data-spot="${i}">${img(DB.POTIONS[r.potions[i]].icon, '', '')}<span><b>${esc(DB.POTIONS[r.potions[i]].name)}</b><small>${esc(DB.POTIONS[r.potions[i]].desc)}</small></span></button>` : '<div class="bag-slot empty">빈 칸</div>').join('')}</div>
        <h3 class="sub">유물 <small>${r.relics.length}개</small></h3><div class="relic-list">${r.relics.map(id => `<button class="rl" data-relic="${id}">${img(DB.RELICS[id].icon, '', '')}<span><b>${esc(DB.RELICS[id].name)}</b><small>${esc(DB.RELICS[id].desc)}</small></span></button>`).join('') || '<p class="muted">아직 유물이 없습니다.</p>'}</div>`;
    }
    if (tab === 'hands') return handsTable();
    if (tab === 'codex') {
      const cats = [['enemies', '몬스터'], ['relics', '유물'], ['dice', '주사위'], ['potions', '소모품']];
      let list = '';
      if (codexTab === 'enemies') list = Object.keys(DB.ENEMIES).map(k => { const e = DB.ENEMIES[k], c = m.codex.enemies[k]; return c ? `<div class="cx ${e.type}">${img(e.img, 'cx-img', e.name)}<b>${esc(e.name)}</b><small>${esc(e.desc)}</small><small class="muted">만남 ${c.seen} · 처치 ${c.kills}</small></div>` : '<div class="cx locked"><div class="cx-img q">?</div><b>???</b><small>아직 만나지 못했다.</small></div>'; }).join('');
      if (codexTab === 'relics') list = Object.keys(DB.RELICS).map(k => m.codex.relics[k] ? `<button class="cx small" data-relic="${k}">${img(DB.RELICS[k].icon, 'cx-ico', '')}<b>${esc(DB.RELICS[k].name)}</b></button>` : '<div class="cx small locked"><div class="cx-ico q">?</div><b>???</b></div>').join('');
      if (codexTab === 'dice') list = Object.keys(DB.DICE).map(k => m.codex.dice[k] ? `<div class="cx small">${dieFace(6, k)}<b>${esc(DB.DICE[k].name)}</b><small>${esc(DB.DICE[k].desc)}</small></div>` : '<div class="cx small locked"><div class="cx-ico q">?</div><b>???</b></div>').join('');
      if (codexTab === 'potions') list = Object.keys(DB.POTIONS).map(k => m.codex.potions[k] ? `<div class="cx small">${img(DB.POTIONS[k].icon, 'cx-ico', '')}<b>${esc(DB.POTIONS[k].name)}</b><small>${esc(DB.POTIONS[k].desc)}</small></div>` : '<div class="cx small locked"><div class="cx-ico q">?</div><b>???</b></div>').join('');
      const total = { enemies: Object.keys(DB.ENEMIES).length, relics: Object.keys(DB.RELICS).length, dice: Object.keys(DB.DICE).length, potions: Object.keys(DB.POTIONS).length };
      return `<div class="subtabs">${cats.map(c => `<button class="${c[0] === codexTab ? 'on' : ''}" data-ctab="${c[0]}">${c[1]} <small>${Object.keys(m.codex[c[0]]).length}/${total[c[0]]}</small></button>`).join('')}</div><div class="codex ${codexTab}">${list}</div>`;
    }
    if (tab === 'ach') {
      const ids = Object.keys(DB.ACHIEVEMENTS);
      return `<p class="muted small">달성 ${ids.filter(i => m.ach[i]).length} / ${ids.length}</p><div class="ach-list">${ids.map(id => { const a = DB.ACHIEVEMENTS[id], t = m.ach[id]; return `<div class="ach ${t ? 'on' : ''}">${img(I.emblem(a.emblem), '', '')}<div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>${t ? `<small class="date">${new Date(t).toLocaleDateString('ko-KR')}</small>` : ''}</div></div>`; }).join('')}</div>`;
    }
    if (tab === 'settings') {
      const s = G.settings, pw = DB.pwa;
      const inRun = UI.view === 'game' && r && r.screen !== 'end';
      return `<div class="set-list">
        <label class="set"><span><b>자동 전체화면</b><small>화면을 처음 누를 때 전체화면으로 바꿉니다.</small></span><input type="checkbox" data-set="autoFS" ${s.autoFS ? 'checked' : ''}></label>
        <label class="set"><span><b>화면 꺼짐 방지</b><small>게임 중에는 화면이 꺼지지 않게 합니다.</small></span><input type="checkbox" data-set="wakeLock" ${s.wakeLock ? 'checked' : ''}></label>
        <label class="set"><span><b>연출 줄이기</b><small>전투 이펙트와 흔들림을 줄이고 빠르게 진행합니다.</small></span><input type="checkbox" data-set="reduceMotion" ${s.reduceMotion ? 'checked' : ''}></label>
        ${pw.standalone() ? '<p class="muted small">지금 홈 화면 앱으로 실행 중입니다.</p>' : `<button class="btn dark wide" id="sFs" data-fs-label>${pw.fsOn() ? '전체화면 끄기' : '전체화면 켜기'}</button><button class="btn teal wide" id="sInst">홈 화면에 설치하기</button>`}
        ${inRun ? '<button class="btn dark wide" id="sAbandon">이번 여정 포기하기</button>' : ''}
        <button class="btn dark wide" id="sReset">도감·업적 기록 초기화</button>
      </div>`;
    }
    return '';
  }
  UI.openSheet = openSheet;
})(window);
