// ==UserScript==
// @name         쿠팡 비교견적 도우미
// @namespace    https://handscil01-afk.github.io/Sungmo/
// @version      1.0.0
// @description  쿠팡 장바구니 물품을 11번가·G마켓에서 찾아 비교견적용 장바구니에 담습니다
// @match        https://cart.coupang.com/*
// @match        https://search.11st.co.kr/*
// @match        https://www.11st.co.kr/products/*
// @match        https://buy.11st.co.kr/*
// @match        https://www.gmarket.co.kr/n/search*
// @match        https://item.gmarket.co.kr/*
// @match        https://cart.gmarket.co.kr/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @run-at       document-idle
// @updateURL    https://handscil01-afk.github.io/Sungmo/coupang-compare/coupang-compare.user.js
// @downloadURL  https://handscil01-afk.github.io/Sungmo/coupang-compare/coupang-compare.user.js
// ==/UserScript==

/*
 * [사용법]
 * 1) 쿠팡 장바구니(cart.coupang.com)에서 오른쪽 아래 "비교견적 시작" 버튼을 누르고, 비교할 물품과 검색어를 확인합니다.
 * 2) "11번가부터 시작"을 누르면 11번가 검색 결과가 열립니다. 오른쪽 패널의 후보 중 상품을 직접 고르세요.
 * 3) 상품 페이지에서 옵션을 고르고 "수량 맞추기" 후 "장바구니 담고 기록"을 누르면 장바구니에 담고 가격이 기록됩니다.
 * 4) "다음 상품 →"으로 넘어가며, 11번가가 끝나면 같은 방식으로 G마켓을 진행합니다.
 * 5) 마지막에 쿠팡·11번가·G마켓 비교표가 나옵니다. "표 복사"로 엑셀·한글에 붙여 넣고, 각 장바구니 화면은 캡처해 견적서로 씁니다.
 * ※ 이 스크립트는 구매·주문·결제 버튼을 절대 누르지 않으며, 오직 "장바구니" 버튼만 누릅니다.
 */

(function () {
  'use strict';

  // ------------------------------------------------------------------
  // 상수
  // ------------------------------------------------------------------
  const KEY = 'cmpState';
  const UIKEY = 'cmpUi';
  const SITE_NAME = { cp: '쿠팡', st: '11번가', gm: 'G마켓' };
  const CART_URL = {
    cp: 'https://cart.coupang.com/cartView.pang',
    st: 'https://buy.11st.co.kr/cart/CartAction.tmall?method=getCartList',
    gm: 'https://cart.gmarket.co.kr/ko/cart',
  };

  // ------------------------------------------------------------------
  // 공용 도우미
  // ------------------------------------------------------------------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const txt = (e) => (e && e.textContent ? e.textContent.replace(/\s+/g, ' ').trim() : '');
  const fmt = (n) => (Number(n) || 0).toLocaleString('ko-KR');

  // "15,300원" -> 15300 (첫 번째 숫자 덩어리만)
  function num(s) {
    const m = String(s == null ? '' : s).match(/\d[\d,]*/);
    return m ? parseInt(m[0].replace(/,/g, ''), 10) || 0 : 0;
  }

  function visible(e) {
    try {
      if (!e || !e.isConnected) return false;
      if (!e.getClientRects().length) return false;
      const cs = getComputedStyle(e);
      return cs.visibility !== 'hidden' && cs.display !== 'none';
    } catch (err) {
      return false;
    }
  }

  function debounce(fn, ms) {
    let t = null;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  function waitFor(fn, timeout, interval) {
    timeout = timeout || 15000;
    interval = interval || 500;
    return new Promise((resolve) => {
      const t0 = Date.now();
      (function tick() {
        let v = null;
        try { v = fn(); } catch (e) { v = null; }
        if (v) return resolve(v);
        if (Date.now() - t0 >= timeout) return resolve(null);
        setTimeout(tick, interval);
      })();
    });
  }

  // DOM 생성 도우미: 모든 텍스트는 textContent/텍스트 노드로만 넣어 이스케이프 문제가 없다.
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'style') e.style.cssText = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else if (k === 'value' || k === 'checked' || k === 'disabled') e[k] = v;
        else e.setAttribute(k, v === true ? '' : v);
      });
    }
    const add = (c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) { c.forEach(add); return; }
      e.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    };
    kids.forEach(add);
    return e;
  }

  function addStyle(css) {
    if (typeof GM_addStyle === 'function') return GM_addStyle(css);
    const st = document.createElement('style');
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
    return st;
  }

  function copyText(text) {
    try {
      if (typeof GM_setClipboard === 'function') { GM_setClipboard(text, 'text'); return true; }
    } catch (e) { /* 아래 대체 방법 */ }
    try {
      if (navigator.clipboard) { navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* 실패 */ }
    return false;
  }

  // ------------------------------------------------------------------
  // 상태 저장 (GM 저장소: 쿠팡/11번가/G마켓 도메인 공유)
  // ------------------------------------------------------------------
  function loadState() {
    try {
      const v = GM_getValue(KEY, '');
      if (!v) return null;
      const s = typeof v === 'string' ? JSON.parse(v) : v;
      return s && Array.isArray(s.items) ? s : null;
    } catch (e) {
      return null;
    }
  }
  function saveState(s) { GM_setValue(KEY, JSON.stringify(s)); }
  function clearState() { GM_setValue(KEY, ''); }

  const uiPref = { collapsed: false };
  function loadUi() {
    try {
      const v = GM_getValue(UIKEY, '');
      if (v) Object.assign(uiPref, typeof v === 'string' ? JSON.parse(v) : v);
    } catch (e) { /* 무시 */ }
  }
  function saveUi() { try { GM_setValue(UIKEY, JSON.stringify(uiPref)); } catch (e) { /* 무시 */ } }

  // ------------------------------------------------------------------
  // 페이지 판별 / 주소
  // ------------------------------------------------------------------
  function detectPage() {
    const host = location.hostname;
    const path = location.pathname;
    if (host === 'cart.coupang.com') return { site: 'cp', kind: 'cp-cart' };
    if (host === 'search.11st.co.kr') return { site: 'st', kind: 'st-search' };
    if (host === 'www.11st.co.kr' && /^\/products\//.test(path)) return { site: 'st', kind: 'st-product' };
    if (/11st\.co\.kr$/.test(host)) return { site: 'st', kind: 'st-other' };
    if (host === 'www.gmarket.co.kr' && path.indexOf('/n/search') === 0) return { site: 'gm', kind: 'gm-search' };
    if (host === 'item.gmarket.co.kr') return { site: 'gm', kind: 'gm-product' };
    if (/gmarket\.co\.kr$/.test(host)) return { site: 'gm', kind: 'gm-other' };
    return { site: '', kind: 'other' };
  }

  function searchUrl(site, kw, low) {
    if (site === 'st') {
      return 'https://search.11st.co.kr/pc/total-search?kwd=' + encodeURIComponent(kw) + '&tabId=TOTAL_SEARCH' + (low ? '&sortCd=L' : '');
    }
    return 'https://www.gmarket.co.kr/n/search?keyword=' + encodeURIComponent(kw) + (low ? '&s=1' : '');
  }

  function currentSortLow() {
    try {
      const sp = new URL(location.href).searchParams;
      if (location.hostname === 'search.11st.co.kr') return sp.get('sortCd') === 'L';
      return sp.get('s') === '1';
    } catch (e) { return false; }
  }

  function gotoSearch(s) {
    if (!s || s.site === 'done') { showSummary(); return; }
    const it = s.items[s.idx];
    if (!it) { showSummary(); return; }
    location.href = searchUrl(s.site, it.keyword || makeKeyword(it.name), !!s.sortLow);
  }

  // ------------------------------------------------------------------
  // 키워드 / 문자열
  // ------------------------------------------------------------------
  function makeKeyword(name) {
    const s = String(name || '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    const w = s.split(' ').filter(Boolean).slice(0, 3).join(' ');
    return w || String(name || '').split(/\s+/).slice(0, 3).join(' ');
  }
  function shortName(name, max) {
    const s = String(name || '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim() || String(name || '');
    max = max || 30;
    return s.length > max ? s.slice(0, max) + '…' : s;
  }
  function normShip(t) {
    t = String(t || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    if (/조건|이상/.test(t)) return t.slice(0, 18);
    if (/무료/.test(t)) return '무료';
    let m = t.match(/배송비\s*:?\s*([\d,]+)\s*원/);
    if (m) return m[1] + '원';
    m = t.match(/([\d,]+)\s*원/);
    if (m && /배송/.test(t)) return m[1] + '원';
    return '';
  }

  // ------------------------------------------------------------------
  // 쿠팡 장바구니 읽기
  // ------------------------------------------------------------------
  function parseCoupangCart() {
    const out = [];
    const seenId = new Set();
    const seenKey = new Set();
    $$('div[id^="item_"]').forEach((div) => {
      try {
        if (seenId.has(div.id)) return;
        const links = $$('a[href*="/vp/products/"]', div);
        if (!links.length) return;
        const hrefs = new Set(links.map((a) => (a.getAttribute('href') || '').split('?')[0]));
        if (hrefs.size > 1) return; // 여러 줄을 감싼 바깥 컨테이너는 건너뜀
        seenId.add(div.id);

        const name = links.map((a) => txt(a)).find(Boolean) || '';
        if (!name) return;

        let option = '';
        const optSpan = $$('span', div).find((sp) => /^옵션\s*:/.test(txt(sp)));
        if (optSpan) {
          option = txt(optSpan).replace(/^옵션\s*:\s*/, '');
          if (!option && optSpan.parentElement) option = txt(optSpan.parentElement).replace(/^옵션\s*:\s*/, '');
        }

        const key = (links[0].getAttribute('href') || '').split('?')[0] + '||' + option;
        if (seenKey.has(key)) return;
        seenKey.add(key);

        const qi = $('input.cart-quantity-input', div);
        const qty = qi ? parseInt(qi.value, 10) || 1 : 1;

        // 가격: 굵은 숫자 span 우선, 없으면 텍스트에서 가장 큰 "N원"
        let price = 0;
        const bold = $$('span[class*="twc-font-bold"]', div).find((sp) => {
          if (!/^[\d,]+$/.test(txt(sp))) return false;
          return !sp.closest('[class*="line-through"]');
        });
        if (bold) price = num(txt(bold));
        if (!price) {
          const clone = div.cloneNode(true);
          $$('[class*="line-through"]', clone).forEach((x) => x.remove());
          const re = /([\d,]+)\s*원/g;
          const t = clone.textContent || '';
          let m;
          while ((m = re.exec(t))) { price = Math.max(price, num(m[1])); }
        }
        out.push({ name, option, qty, cpTotal: price, keyword: makeKeyword(name) });
      } catch (e) { /* 한 줄 실패는 건너뜀 */ }
    });
    return out;
  }

  // ------------------------------------------------------------------
  // 검색 결과 읽기
  // ------------------------------------------------------------------
  function parseStCards() {
    const out = [];
    const seen = new Set();
    $$('.c-card-item').forEach((card) => {
      try {
        const a = $$('a[href*="/products/"]', card)[0];
        if (!a) return;
        const m = (a.href || '').match(/\/products\/(\d+)/);
        if (!m || seen.has(m[1])) return;
        const title = txt($('.c-card-item__name dd', card)) || txt($('.c-card-item__name', card));
        if (!title) return;
        const price = num(txt($('.c-card-item__price .value', card)));
        const d = $('.c-card-item__delivery', card);
        let ship = '';
        if (d) {
          const t = txt(d);
          if (/배송비|무료/.test(t)) ship = normShip(t);
        }
        seen.add(m[1]);
        out.push({ id: m[1], title, price, shipping: ship, url: 'https://www.11st.co.kr/products/' + m[1] });
      } catch (e) { /* 건너뜀 */ }
    });
    return out;
  }

  function parseGmCards() {
    const out = [];
    const seen = new Set();
    $$('.box__item-container').forEach((card) => {
      try {
        const a = $('a.link__item', card);
        if (!a) return;
        let code = '';
        try { code = new URL(a.href, location.href).searchParams.get('goodscode') || ''; } catch (e) { code = ''; }
        if (!code) { const m = (a.href || '').match(/goodscode=(\d+)/i); code = m ? m[1] : ''; }
        if (!code || seen.has(code)) return;
        const title = txt($('.text__item', card)) || txt(a);
        if (!title) return;
        let pe = $('.box__price-seller .text__value', card);
        if (!pe) { const all = $$('.text__value', card); pe = all[all.length - 1]; }
        const price = num(txt(pe));
        let ship = '';
        const tag = $$('.text__tag', card).map(txt).find((t) => /배송비|무료배송/.test(t));
        if (tag) ship = normShip(tag);
        seen.add(code);
        out.push({ id: code, title, price, shipping: ship, url: 'https://item.gmarket.co.kr/Item?goodscode=' + code });
      } catch (e) { /* 건너뜀 */ }
    });
    return out;
  }

  function parseCandidates(site) {
    return (site === 'st' ? parseStCards() : parseGmCards()).slice(0, 12);
  }

  // ------------------------------------------------------------------
  // 상품 페이지 도우미 (사이트별)
  // ------------------------------------------------------------------
  function setQty(inp, n, withKey) {
    inp.focus();
    if (withKey) { try { inp.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: '0' })); } catch (e) { /* 무시 */ } }
    inp.value = String(n);
    ['input', 'keyup', 'change'].forEach((t) => inp.dispatchEvent(new Event(t, { bubbles: true })));
    inp.blur();
    inp.dispatchEvent(new Event('focusout', { bubbles: true }));
  }

  // 옵션 선택기가 있어 보이는지 (수량 입력칸이 없을 때만 사용하는 추정)
  function genericHasOptionSelectors() {
    const outside = (e) => !e.closest('#cmp-root') && !e.closest('li.option_item') && !e.closest('#coreSelectedList');
    if ($$('select').some((e) => outside(e) && visible(e))) return true;
    return $$('[class*="option" i], [id*="option" i]').some((e) => outside(e) && visible(e) && e.offsetHeight > 20);
  }

  const API = {
    st: {
      title() {
        const e = $('.c_product_info_title h1') || $('h1.title');
        return txt(e) || document.title.trim();
      },
      canon() {
        const m = location.pathname.match(/\/products\/(\d+)/);
        return m ? 'https://www.11st.co.kr/products/' + m[1] : location.origin + location.pathname;
      },
      rows() { return $$('li.option_item').filter(visible); },
      qtyInputs() { return $$('input[name="prdcAmount"], input[title="수량설정"]').filter(visible); },
      qtyKey: false,
      options() {
        return this.rows().map((r) => txt($('.option_name', r))).filter(Boolean).join(', ');
      },
      total() {
        const t = $$('.ui_total_price').find(visible);
        let n = t ? num(txt(t)) : 0;
        if (!n) {
          this.rows().forEach((r) => {
            const qi = $('input[name="prdcAmount"]', r);
            const q = qi ? parseInt(qi.value, 10) || 1 : 1;
            n += (parseInt(r.getAttribute('data-price'), 10) || 0) * q;
          });
        }
        return n;
      },
      addBtn() {
        return $$('button.btn_cart').find(visible) || $$('button').find((b) => visible(b) && txt(b) === '장바구니') || null;
      },
      hasOptionSelectors: genericHasOptionSelectors,
    },
    gm: {
      title() {
        const e = $('h1.itemtit') || $('h1.tit');
        return txt(e) || document.title.trim();
      },
      canon() {
        let code = '';
        try { code = new URL(location.href).searchParams.get('goodscode') || ''; } catch (e) { code = ''; }
        return code ? 'https://item.gmarket.co.kr/Item?goodscode=' + code : location.origin + location.pathname;
      },
      rows() {
        const l = $('#coreSelectedList');
        if (!l) return [];
        let r = $$('ul.selected-list > li', l);
        if (!r.length) r = $$('li', l);
        return r.filter(visible);
      },
      qtyInputs() {
        const l = $('#coreSelectedList');
        if (!l) return [];
        return $$('input', l).filter((i) => visible(i) && ['text', 'number', 'tel', ''].indexOf(i.type || '') >= 0 && /^\d+$/.test(String(i.value).trim()));
      },
      qtyKey: true,
      options() {
        return this.rows().map((r) => {
          const c = r.cloneNode(true);
          $$('button, input, select', c).forEach((x) => x.remove());
          return txt(c);
        }).filter(Boolean).join(', ');
      },
      total() { return num(txt($('#coreTotalPrice'))); },
      addBtn() { return $('#coreAddCartBtn'); },
      hasOptionSelectors: genericHasOptionSelectors,
    },
  };

  function sumQty(api) {
    return api.qtyInputs().reduce((a, i) => a + (parseInt(i.value, 10) || 0), 0);
  }

  // 구매 관련 버튼은 절대 누르지 않는다: 장바구니 버튼인지 확인한 뒤에만 클릭
  const FORBIDDEN = /구매|주문|결제|선물|바로/;
  function assertSafeCartButton(btn) {
    const label = txt(btn) + ' ' + (btn.id || '');
    if (FORBIDDEN.test(label) || /buying|InsOrder|GiftBtn/i.test(label)) throw new Error('구매 관련 버튼은 누르지 않습니다');
    if (btn.classList && btn.classList.contains('btn_buying')) throw new Error('구매 관련 버튼은 누르지 않습니다');
    if (!/장바구니|cart/i.test(label)) throw new Error('장바구니 버튼이 아닌 것 같아 누르지 않았습니다');
  }

  // ------------------------------------------------------------------
  // 흐름 제어
  // ------------------------------------------------------------------
  function advance() {
    const s = loadState();
    if (!s) return;
    s.pendingCandidate = null;
    if (s.redo) {
      s.redo = false;
      if (s.resume) { s.site = s.resume.site; s.idx = s.resume.idx; } else { s.site = 'done'; }
      s.resume = null;
      saveState(s);
      renderAll();
      showSummary();
      return;
    }
    if (s.idx + 1 < s.items.length) {
      s.idx += 1;
      saveState(s);
      gotoSearch(s);
      return;
    }
    if (s.site === 'st') {
      s.site = 'gm';
      s.idx = 0;
      saveState(s);
      gotoSearch(s);
      return;
    }
    s.site = 'done';
    saveState(s);
    renderAll();
    showSummary();
  }

  function skipCurrent() {
    const s = loadState();
    if (!s || !s.items[s.idx]) return;
    s.items[s.idx][s.site] = { title: '', url: '', option: '', qty: 0, total: 0, shipping: '', skipped: true };
    saveState(s);
    advance();
  }

  function startRedo(i, site) {
    const s = loadState();
    if (!s || !s.items[i]) return;
    if (!s.redo) {
      s.resume = s.site === 'done' ? null : { site: s.site, idx: s.idx };
      s.redo = true;
    }
    s.site = site;
    s.idx = i;
    s.items[i][site] = null;
    s.pendingCandidate = null;
    saveState(s);
    gotoSearch(s);
  }

  // ------------------------------------------------------------------
  // 스타일
  // ------------------------------------------------------------------
  addStyle(`
#cmp-root, #cmp-root * { box-sizing: border-box; font-family: "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif; letter-spacing: normal; }
#cmp-root button, #cmp-root input, #cmp-root a { font-size: 13px; line-height: 1.3; }
#cmp-root .cmp-btn { min-height: 32px; padding: 4px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; color: #111827; cursor: pointer; font-weight: 500; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
#cmp-root .cmp-btn:hover { background: #e2e8f0; }
#cmp-root .cmp-btn[disabled] { opacity: .5; cursor: default; }
#cmp-root .cmp-primary { background: #2563eb; border-color: #2563eb; color: #fff; }
#cmp-root .cmp-primary:hover { background: #1d4ed8; }
#cmp-root .cmp-success { background: #16a34a; border-color: #16a34a; color: #fff; }
#cmp-root .cmp-success:hover { background: #15803d; }
#cmp-root .cmp-danger { background: #fff; border-color: #dc2626; color: #dc2626; }
#cmp-root .cmp-danger:hover { background: #fee2e2; }
#cmp-root .cmp-small { min-height: 26px; padding: 2px 8px; font-size: 12px; }
#cmp-root .cmp-active { background: #2563eb; border-color: #2563eb; color: #fff; }
#cmp-root input[type="text"], #cmp-root input[type="number"] { min-height: 32px; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #111827; width: 100%; }
#cmp-root input[type="checkbox"] { width: 18px; height: 18px; margin: 2px; }
#cmp-root .cmp-clamp2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-all; }

#cmp-root .cmp-fab { position: fixed; right: 16px; bottom: 16px; z-index: 2147483600; min-height: 44px; padding: 8px 18px; border-radius: 22px; border: none; background: #2563eb; color: #fff; font-size: 15px; font-weight: 700; box-shadow: 0 4px 14px rgba(0,0,0,.3); cursor: pointer; }
#cmp-root .cmp-fab:hover { background: #1d4ed8; }
#cmp-root .cmp-pill { position: fixed; right: 12px; bottom: 16px; z-index: 2147483600; min-height: 36px; padding: 6px 14px; border-radius: 18px; border: none; background: #2563eb; color: #fff; font-weight: 700; box-shadow: 0 4px 14px rgba(0,0,0,.3); cursor: pointer; }

#cmp-root #cmp-panel { position: fixed; top: 12px; right: 12px; width: 340px; max-width: calc(100vw - 24px); max-height: 80vh; display: flex; flex-direction: column; gap: 8px; padding: 12px; background: #fff; color: #111827; border: 1px solid #d1d5db; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,.28); z-index: 2147483600; font-size: 14px; line-height: 1.4; overflow: hidden; }
#cmp-root .cmp-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
#cmp-root .cmp-title { font-size: 15px; color: #1e3a8a; }
#cmp-root .cmp-name { font-weight: 700; font-size: 14px; }
#cmp-root .cmp-meta { font-size: 12.5px; color: #475569; }
#cmp-root .cmp-msg { display: none; padding: 6px 8px; border-radius: 8px; font-size: 12.5px; background: #f1f5f9; color: #334155; }
#cmp-root .cmp-msg.cmp-err { background: #fee2e2; color: #991b1b; }
#cmp-root .cmp-msg.cmp-warn { background: #fef3c7; color: #92400e; }
#cmp-root .cmp-msg.cmp-ok { background: #dcfce7; color: #166534; }
#cmp-root .cmp-row2 { display: flex; gap: 6px; align-items: center; }
#cmp-root .cmp-list { flex: 1 1 auto; min-height: 90px; max-height: 42vh; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 2px; }
#cmp-root .cmp-cand { border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 8px; cursor: pointer; background: #fff; }
#cmp-root .cmp-cand:hover { border-color: #2563eb; background: #eff6ff; }
#cmp-root .cmp-cand-t { font-size: 13px; }
#cmp-root .cmp-cand-m { font-size: 13px; margin-top: 2px; color: #111827; }
#cmp-root .cmp-ship { color: #64748b; font-size: 12px; }
#cmp-root .cmp-empty { padding: 12px 6px; color: #64748b; font-size: 13px; }
#cmp-root .cmp-steps { font-size: 12.5px; color: #334155; background: #eff6ff; border-radius: 8px; padding: 6px 8px; }
#cmp-root .cmp-live { font-size: 13.5px; padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 8px; }
#cmp-root .cmp-okt { color: #16a34a; }
#cmp-root .cmp-btns { display: flex; flex-wrap: wrap; gap: 6px; }
#cmp-root .cmp-btns .cmp-btn { flex: 1 1 auto; }
#cmp-root .cmp-donebox { display: none; flex-direction: column; gap: 6px; }

#cmp-root .cmp-bg { position: fixed; inset: 0; background: rgba(15,23,42,.55); z-index: 2147483640; display: flex; align-items: center; justify-content: center; padding: 12px; }
#cmp-root .cmp-modal { background: #fff; color: #111827; border-radius: 12px; width: min(940px, 100%); max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 12px 40px rgba(0,0,0,.4); font-size: 14px; }
#cmp-root .cmp-mhead { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
#cmp-root .cmp-mhead b { font-size: 16px; }
#cmp-root .cmp-mbody { padding: 12px 16px; overflow: auto; flex: 1 1 auto; }
#cmp-root .cmp-mfoot { padding: 10px 16px; border-top: 1px solid #e5e7eb; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
#cmp-root .cmp-hint { font-size: 12.5px; color: #475569; margin: 4px 0 8px; }

#cmp-root .cmp-crow { display: grid; grid-template-columns: 24px minmax(0,1fr) 64px 100px; gap: 4px 8px; align-items: start; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
#cmp-root .cmp-crow .cmp-kw { grid-column: 2 / 5; display: flex; gap: 6px; align-items: center; font-size: 12px; color: #475569; }
#cmp-root .cmp-crow .cmp-kw span { white-space: nowrap; }
#cmp-root .cmp-opt { font-size: 12px; color: #64748b; }

#cmp-root table.cmp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
#cmp-root .cmp-table th, #cmp-root .cmp-table td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; text-align: left; color: #111827; background: #fff; }
#cmp-root .cmp-table th { background: #f1f5f9; }
#cmp-root .cmp-table td.cmp-r { text-align: right; white-space: nowrap; }
#cmp-root .cmp-table tr.cmp-sum td { background: #f8fafc; font-weight: 700; }
#cmp-root .cmp-sub { display: block; font-size: 11.5px; color: #64748b; font-weight: 400; white-space: normal; text-align: left; }
#cmp-root .cmp-sub a { color: #2563eb; }
#cmp-root .cmp-bad { color: #b91c1c; }
#cmp-root .cmp-gray { color: #94a3b8; }
@media (max-width: 600px) { #cmp-root .cmp-table { font-size: 12px; } #cmp-root #cmp-panel { width: calc(100vw - 24px); } }
`);

  // ------------------------------------------------------------------
  // 루트 / 모달
  // ------------------------------------------------------------------
  const ui = { cleanups: [], lastHref: '' };

  function ensureRoot() {
    let r = document.getElementById('cmp-root');
    if (!r) {
      r = document.createElement('div');
      r.id = 'cmp-root';
      (document.body || document.documentElement).appendChild(r);
    }
    let dock = $('#cmp-dock', r);
    if (!dock) { dock = h('div', { id: 'cmp-dock' }); r.appendChild(dock); }
    let mh = $('#cmp-modal-host', r);
    if (!mh) { mh = h('div', { id: 'cmp-modal-host' }); r.appendChild(mh); }
    return { root: r, dock, modalHost: mh };
  }

  function closeModal() {
    const { modalHost } = ensureRoot();
    modalHost.textContent = '';
  }

  // 모달 열기: bodyNode와 footerNodes(배열 또는 노드)를 받아 표시한다.
  function openModal(title, bodyNode, footerNode) {
    const { modalHost } = ensureRoot();
    modalHost.textContent = '';
    const bg = h('div', { class: 'cmp-bg' },
      h('div', { class: 'cmp-modal', role: 'dialog' },
        h('div', { class: 'cmp-mhead' }, h('b', { text: title }), h('button', { class: 'cmp-btn cmp-small', text: '닫기', onclick: closeModal })),
        h('div', { class: 'cmp-mbody' }, bodyNode),
        footerNode ? h('div', { class: 'cmp-mfoot' }, footerNode) : null));
    bg.addEventListener('mousedown', (ev) => { if (ev.target === bg) closeModal(); });
    modalHost.appendChild(bg);
  }

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      const mh = document.querySelector('#cmp-modal-host');
      if (mh && mh.firstChild) mh.textContent = '';
    }
  });

  // ------------------------------------------------------------------
  // 쿠팡: 시작 버튼 + 물품 선택 모달
  // ------------------------------------------------------------------
  function openStartModal() {
    try {
      const prev = loadState();
      if (prev && prev.items.length) showPrevChoice(prev);
      else showCartList();
    } catch (e) {
      openModal('비교견적', h('div', { class: 'cmp-bad', text: '오류가 발생했습니다: ' + (e && e.message ? e.message : e) }), null);
    }
  }

  function showPrevChoice(prev) {
    const where = prev.site === 'done' ? '모두 끝남(요약 확인 가능)' : SITE_NAME[prev.site] + ' ' + (prev.idx + 1) + '/' + prev.items.length + '번째 품목';
    const body = h('div', null,
      h('p', { text: '이전에 진행하던 비교견적 기록이 있습니다.' }),
      h('p', { class: 'cmp-hint', text: '품목 ' + prev.items.length + '개 · 진행 위치: ' + where }));
    const foot = [
      h('button', { class: 'cmp-btn cmp-primary', text: '이어서 하기', onclick: () => { closeModal(); const s = loadState(); if (s.site === 'done') showSummary(); else gotoSearch(s); } }),
      h('button', { class: 'cmp-btn', text: '요약 보기', onclick: () => showSummary() }),
      h('button', { class: 'cmp-btn', text: '처음부터 다시', onclick: () => showCartList() }),
      h('button', { class: 'cmp-btn', text: '닫기', onclick: closeModal }),
    ];
    openModal('비교견적', body, foot);
  }

  function showCartList() {
    const lines = parseCoupangCart();
    const body = h('div', null);
    const rows = [];
    const msg = h('div', { class: 'cmp-msg', style: 'display:none' });
    const showMsg = (t) => { msg.textContent = t; msg.className = 'cmp-msg cmp-warn'; msg.style.display = t ? 'block' : 'none'; };

    if (!lines.length) {
      body.appendChild(h('div', { class: 'cmp-empty', text: '장바구니 물품을 찾지 못했습니다. 페이지가 모두 불러와진 뒤 다시 눌러 주세요.' }));
    } else {
      body.appendChild(h('div', { class: 'cmp-hint', text: '비교할 물품을 확인하세요. 수량과 검색어는 고칠 수 있고, 수량을 바꿔도 쿠팡 금액은 자동으로 바뀌지 않습니다.' }));
      lines.forEach((ln) => {
        const chk = h('input', { type: 'checkbox', checked: true });
        const qty = h('input', { type: 'number', min: '1', value: String(ln.qty), 'aria-label': '수량' });
        const price = h('input', { type: 'text', value: fmt(ln.cpTotal), 'aria-label': '쿠팡 금액' });
        const kw = h('input', { type: 'text', value: ln.keyword, 'aria-label': '검색어' });
        rows.push({ ln, chk, qty, price, kw });
        body.appendChild(h('div', { class: 'cmp-crow' },
          chk,
          h('div', null, h('div', { class: 'cmp-clamp2', text: ln.name }), ln.option ? h('div', { class: 'cmp-opt', text: '옵션: ' + ln.option }) : null),
          h('div', null, qty, h('div', { class: 'cmp-opt', text: '수량' })),
          h('div', null, price, h('div', { class: 'cmp-opt', text: '쿠팡 금액(원)' })),
          h('label', { class: 'cmp-kw' }, h('span', { text: '검색어' }), kw)));
      });
    }

    const start = () => {
      const items = [];
      rows.forEach((r) => {
        if (!r.chk.checked) return;
        const q = Math.max(1, parseInt(r.qty.value, 10) || 1);
        const keyword = r.kw.value.trim() || makeKeyword(r.ln.name);
        items.push({ name: r.ln.name, option: r.ln.option, qty: q, cpTotal: num(r.price.value), keyword, st: null, gm: null });
      });
      if (!items.length) { showMsg('비교할 물품을 하나 이상 선택하세요'); return; }
      const state = { items, site: 'st', idx: 0, startedAt: Date.now(), sortLow: false, pendingCandidate: null, redo: false, resume: null };
      saveState(state);
      location.href = searchUrl('st', items[0].keyword, false);
    };

    const foot = [
      h('button', { class: 'cmp-btn cmp-primary', text: '11번가부터 시작', disabled: !lines.length, onclick: start }),
      h('button', { class: 'cmp-btn', text: '닫기', onclick: closeModal }),
      msg,
    ];
    openModal('비교견적 대상 물품 (' + lines.length + '개 발견)', body, foot);
  }

  // ------------------------------------------------------------------
  // 요약 모달
  // ------------------------------------------------------------------
  const pickAmt = (p) => (p && !p.skipped ? p.total || 0 : 0);

  function buildTsv(s) {
    const clean = (t) => String(t == null ? '' : t).replace(/[\t\r\n]+/g, ' ').trim();
    const lines = [['품명', '수량', '쿠팡', '11번가', 'G마켓'].join('\t')];
    let a = 0, b = 0, c = 0;
    s.items.forEach((it) => {
      const sv = pickAmt(it.st);
      const gv = pickAmt(it.gm);
      a += it.cpTotal || 0; b += sv; c += gv;
      lines.push([clean(it.name + (it.option ? ' (' + it.option + ')' : '')), it.qty, it.cpTotal || '', sv || '', gv || ''].join('\t'));
    });
    lines.push(['합계', '', a, b, c].join('\t'));
    return lines.join('\n');
  }

  function showSummary() {
    const s = loadState();
    if (!s || !s.items.length) {
      openModal('비교견적 요약',
        h('div', { class: 'cmp-empty', text: '아직 기록이 없습니다. 쿠팡 장바구니에서 "비교견적 시작"을 눌러 시작하세요.' }),
        [h('a', { class: 'cmp-btn cmp-primary', href: CART_URL.cp, target: '_blank', rel: 'noopener', text: '쿠팡 장바구니 열기' }),
          h('button', { class: 'cmp-btn', text: '닫기', onclick: closeModal })]);
      return;
    }

    let confirming = false;
    const copyMsg = h('span', { class: 'cmp-hint', style: 'margin:0' });
    const foot = h('div', { style: 'display:contents' });

    const cellFor = (it, i, site) => {
      const p = it[site];
      const redo = h('button', { class: 'cmp-btn cmp-small', style: 'margin-top:4px', text: SITE_NAME[site] + ' 다시', onclick: () => startRedo(i, site) });
      if (p === null || p === undefined) {
        return [h('td', { class: 'cmp-r cmp-gray', text: '미진행' }), redo];
      }
      if (p.skipped) {
        return [h('td', { class: 'cmp-r cmp-gray', text: '-' }), redo];
      }
      const sub = h('span', { class: 'cmp-sub' });
      if (p.url && /^https:\/\//.test(p.url)) sub.appendChild(h('a', { href: p.url, target: '_blank', rel: 'noopener', text: shortName(p.title, 40) }));
      else sub.appendChild(document.createTextNode(shortName(p.title, 40)));
      if (p.option) sub.appendChild(h('span', { text: '옵션: ' + p.option }));
      if (p.qty && p.qty !== it.qty) sub.appendChild(h('span', { class: 'cmp-bad', text: '담은 수량 ' + p.qty + '개 (필요 ' + it.qty + '개)' }));
      if (p.shipping) sub.appendChild(h('span', { text: '배송비 ' + p.shipping }));
      return [h('td', { class: 'cmp-r' }, h('b', { text: p.total ? fmt(p.total) + '원' : '0원' }), sub, redo), null];
    };

    const body = h('div', null);
    const thead = h('tr', null, h('th', { text: '품목' }), h('th', { text: '수량' }), h('th', { text: '쿠팡' }), h('th', { text: '11번가' }), h('th', { text: 'G마켓' }));
    const tbody = h('tbody', null);
    let a = 0, b = 0, c = 0;
    s.items.forEach((it, i) => {
      a += it.cpTotal || 0; b += pickAmt(it.st); c += pickAmt(it.gm);
      const tr = h('tr', null,
        h('td', null, h('div', { class: 'cmp-clamp2', text: shortName(it.name, 60) }), it.option ? h('span', { class: 'cmp-sub', text: '옵션: ' + it.option }) : null),
        h('td', { class: 'cmp-r', text: String(it.qty) }),
        h('td', { class: 'cmp-r', text: it.cpTotal ? fmt(it.cpTotal) + '원' : '-' }));
      [['st'], ['gm']].forEach((arr) => {
        const [td, extra] = cellFor(it, i, arr[0]);
        if (extra) {
          // 미진행/건너뜀 칸: 다시 고르기 버튼을 같은 칸 안에 넣는다
          td.appendChild(h('br'));
          td.appendChild(extra);
        } else {
          // 정상 기록 칸의 마지막 자식이 다시 고르기 버튼이므로 그대로 사용
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tbody.appendChild(h('tr', { class: 'cmp-sum' }, h('td', { text: '합계' }), h('td', { text: '' }), h('td', { class: 'cmp-r', text: fmt(a) + '원' }), h('td', { class: 'cmp-r', text: fmt(b) + '원' }), h('td', { class: 'cmp-r', text: fmt(c) + '원' })));

    if (s.site !== 'done') {
      body.appendChild(h('div', { class: 'cmp-msg cmp-warn', style: 'display:block;margin-bottom:8px', text: '아직 진행 중입니다: ' + SITE_NAME[s.site] + ' ' + (s.idx + 1) + '/' + s.items.length + '번째 품목.' }));
    }
    body.appendChild(h('div', { style: 'overflow-x:auto' }, h('table', { class: 'cmp-table' }, h('thead', null, thead), tbody)));
    body.appendChild(h('div', { class: 'cmp-hint', text: '합계는 기록된 품목만 더한 값입니다. 건너뛰었거나 미진행인 품목이 있으면 쿠팡 합계와 단순 비교하지 마세요.' }));
    body.appendChild(h('div', { class: 'cmp-hint', text: '장바구니 화면을 캡처해 견적서로 쓰세요.' }));
    body.appendChild(h('div', { class: 'cmp-btns', style: 'margin-top:6px' },
      h('a', { class: 'cmp-btn', href: CART_URL.cp, target: '_blank', rel: 'noopener', text: '쿠팡 장바구니' }),
      h('a', { class: 'cmp-btn', href: CART_URL.st, target: '_blank', rel: 'noopener', text: '11번가 장바구니' }),
      h('a', { class: 'cmp-btn', href: CART_URL.gm, target: '_blank', rel: 'noopener', text: 'G마켓 장바구니' })));

    const drawFoot = () => {
      foot.textContent = '';
      if (!confirming) {
        foot.appendChild(h('button', {
          class: 'cmp-btn cmp-primary', text: '표 복사', onclick: () => {
            const ok = copyText(buildTsv(loadState() || s));
            copyMsg.textContent = ok ? '복사했습니다. 엑셀이나 한글 표에 붙여 넣으세요' : '복사에 실패했습니다. 브라우저 권한을 확인하세요';
          },
        }));
        if (s.site !== 'done') {
          foot.appendChild(h('button', { class: 'cmp-btn cmp-success', text: '이어서 진행', onclick: () => { closeModal(); gotoSearch(loadState()); } }));
        }
        foot.appendChild(h('button', { class: 'cmp-btn cmp-danger', text: '기록 지우기(초기화)', onclick: () => { confirming = true; drawFoot(); } }));
        foot.appendChild(h('button', { class: 'cmp-btn', text: '닫기', onclick: closeModal }));
        foot.appendChild(copyMsg);
      } else {
        foot.appendChild(h('span', { class: 'cmp-bad', style: 'font-weight:700', text: '모든 비교견적 기록이 지워집니다. 정말 지울까요?' }));
        foot.appendChild(h('button', { class: 'cmp-btn cmp-danger', text: '예, 지웁니다', onclick: () => { clearState(); closeModal(); renderAll(); } }));
        foot.appendChild(h('button', { class: 'cmp-btn', text: '취소', onclick: () => { confirming = false; drawFoot(); } }));
      }
    };
    drawFoot();

    openModal('비교견적 요약 (쿠팡 · 11번가 · G마켓)', body, foot);
  }

  // ------------------------------------------------------------------
  // 오른쪽 패널 / 알약 버튼
  // ------------------------------------------------------------------
  function addCleanup(fn) { ui.cleanups.push(fn); }
  function runCleanups() {
    ui.cleanups.splice(0).forEach((fn) => { try { fn(); } catch (e) { /* 무시 */ } });
  }

  function renderAll() {
    try {
      runCleanups();
      const { dock } = ensureRoot();
      dock.textContent = '';
      ui.lastHref = location.href;
      const pg = detectPage();
      const state = loadState();

      if (pg.kind === 'cp-cart') {
        dock.appendChild(h('button', { class: 'cmp-fab', text: '비교견적 시작', onclick: openStartModal }));
        return;
      }
      const isSearch = /-search$/.test(pg.kind);
      const isProduct = /-product$/.test(pg.kind);
      const active = !!(state && pg.site && state.site === pg.site && (isSearch || isProduct) && state.items[state.idx]);

      if (active && !uiPref.collapsed) {
        renderPanel(dock, state, pg, isSearch);
      } else {
        const label = active ? '비교견적 ' + (state.idx + 1) + '/' + state.items.length : '비교견적';
        dock.appendChild(h('button', {
          class: 'cmp-pill', text: label, onclick: () => {
            if (active) { uiPref.collapsed = false; saveUi(); renderAll(); } else showSummary();
          },
        }));
      }
    } catch (e) {
      try {
        const { dock } = ensureRoot();
        dock.appendChild(h('div', { class: 'cmp-msg cmp-err', style: 'display:block;position:fixed;right:12px;bottom:12px;z-index:2147483600', text: '비교견적 도우미 오류: ' + (e && e.message ? e.message : e) }));
      } catch (e2) { /* 포기 */ }
    }
  }

  function renderPanel(dock, state, pg, isSearch) {
    const item = state.items[state.idx];
    const panel = h('div', { id: 'cmp-panel' });
    const msg = h('div', { class: 'cmp-msg', id: 'cmp-msg' });
    const setMsg = (t, kind) => {
      msg.textContent = t || '';
      msg.className = 'cmp-msg' + (kind ? ' cmp-' + kind : '');
      msg.style.display = t ? 'block' : 'none';
    };
    const guard = (fn) => function () {
      try { return fn.apply(this, arguments); } catch (e) { setMsg('오류: ' + (e && e.message ? e.message : e), 'err'); }
    };

    panel.appendChild(h('div', { class: 'cmp-head' },
      h('b', { class: 'cmp-title', text: SITE_NAME[state.site] + ' 비교견적 ' + (state.idx + 1) + '/' + state.items.length + (state.redo ? ' (다시 고르기)' : '') }),
      h('button', { class: 'cmp-btn cmp-small', text: '접기', onclick: () => { uiPref.collapsed = true; saveUi(); renderAll(); } })));
    panel.appendChild(h('div', { class: 'cmp-name cmp-clamp2', text: item.name + (item.option ? ' (' + item.option + ')' : '') }));
    panel.appendChild(h('div', { class: 'cmp-meta', text: '필요 수량 ' + fmt(item.qty) + '개 · 쿠팡 ' + fmt(item.cpTotal) + '원' }));
    panel.appendChild(msg);

    if (isSearch) buildSearchBody(panel, state, item, setMsg, guard);
    else buildProductBody(panel, state, item, setMsg, guard);

    dock.appendChild(panel);
  }

  // ---- 검색 페이지 패널 ----
  function buildSearchBody(panel, state, item, setMsg, guard) {
    const site = state.site;
    const kwInput = h('input', { type: 'text', value: item.keyword || '', 'aria-label': '검색어' });
    const doSearch = guard(() => {
      const kw = kwInput.value.trim();
      if (!kw) { setMsg('검색어를 입력하세요', 'warn'); return; }
      const s = loadState();
      s.items[s.idx].keyword = kw;
      saveState(s);
      location.href = searchUrl(site, kw, currentSortLow());
    });
    kwInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') doSearch(); });
    panel.appendChild(h('div', { class: 'cmp-row2' }, kwInput, h('button', { class: 'cmp-btn cmp-primary', style: 'white-space:nowrap', text: '다시 검색', onclick: doSearch })));

    const low = currentSortLow();
    const setSort = guard((wantLow) => {
      if (wantLow === currentSortLow()) return;
      const s = loadState();
      s.sortLow = wantLow;
      saveState(s);
      location.href = searchUrl(site, kwInput.value.trim() || item.keyword, wantLow);
    });
    panel.appendChild(h('div', { class: 'cmp-row2' },
      h('button', { class: 'cmp-btn cmp-small' + (!low ? ' cmp-active' : ''), text: '추천순', onclick: () => setSort(false) }),
      h('button', { class: 'cmp-btn cmp-small' + (low ? ' cmp-active' : ''), text: site === 'gm' ? '낮은가격순(시도)' : '낮은가격순', onclick: () => setSort(true) })));

    const list = h('div', { class: 'cmp-list' }, h('div', { class: 'cmp-empty', text: '상품을 불러오는 중입니다…' }));
    panel.appendChild(list);

    panel.appendChild(h('div', { class: 'cmp-btns' },
      h('button', { class: 'cmp-btn', text: '이 상품 건너뛰기', onclick: guard(skipCurrent) }),
      h('button', { class: 'cmp-btn', text: '요약 보기', onclick: guard(showSummary) })));

    const pick = guard((c) => {
      const s = loadState();
      s.pendingCandidate = { url: c.url, shipping: c.shipping, title: c.title, price: c.price, site: s.site, idx: s.idx };
      saveState(s);
      location.href = c.url;
    });

    const t0 = Date.now();
    let lastSig = null;
    const draw = (cands) => {
      list.textContent = '';
      if (!cands.length) {
        const late = Date.now() - t0 > 15000;
        list.appendChild(h('div', { class: 'cmp-empty', text: late
          ? '상품을 찾지 못했습니다. 다른 검색어로 다시 검색해 보세요. (보안 확인 화면이 보이면 직접 완료해 주세요)'
          : '상품을 불러오는 중입니다…' }));
        return;
      }
      cands.forEach((c) => {
        list.appendChild(h('div', {
          class: 'cmp-cand', role: 'button', tabindex: '0', onclick: () => pick(c),
          onkeydown: (ev) => { if (ev.key === 'Enter') pick(c); },
        },
        h('div', { class: 'cmp-cand-t cmp-clamp2', text: c.title }),
        h('div', { class: 'cmp-cand-m' }, h('b', { text: c.price ? fmt(c.price) + '원' : '가격 미확인' }), c.shipping ? h('span', { class: 'cmp-ship', text: ' · 배송비 ' + c.shipping }) : null)));
      });
    };
    const refresh = () => {
      try {
        const cands = parseCandidates(site);
        const sig = cands.map((x) => x.id + '|' + x.price + '|' + x.shipping).join(',');
        if (sig === lastSig) {
          if (!cands.length) draw(cands); // 대기 문구 갱신
          return;
        }
        lastSig = sig;
        draw(cands);
      } catch (e) {
        setMsg('후보를 읽는 중 오류: ' + (e && e.message ? e.message : e), 'err');
      }
    };
    const run = debounce(refresh, 400);
    const mo = new MutationObserver((muts) => {
      const outside = muts.some((m) => {
        const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        return !(t && t.closest && t.closest('#cmp-root'));
      });
      if (outside) run();
    });
    mo.observe(document.body, { childList: true, subtree: true });
    const iv = setInterval(run, 1500);
    addCleanup(() => { mo.disconnect(); clearInterval(iv); });
    waitFor(() => parseCandidates(site).length > 0, 15000, 500).then(() => refresh());
  }

  // ---- 상품 페이지 패널 ----
  function buildProductBody(panel, state, item, setMsg, guard) {
    const site = state.site;
    const api = API[site];
    let ackSig = '';

    panel.appendChild(h('div', { class: 'cmp-steps', text: '① 옵션을 고르세요  ② 수량 맞추기  ③ 장바구니 담고 기록' }));

    const qtyEl = h('b', { text: '0' });
    const totEl = h('b', { text: '0원' });
    panel.appendChild(h('div', { class: 'cmp-live' },
      '선택된 수량 합계 ', qtyEl, ' / 필요 수량 ', h('b', { text: fmt(item.qty) }), h('br'),
      '현재 총액 ', totEl));

    const doneBox = h('div', { class: 'cmp-donebox' });
    const doneMsg = h('div', { class: 'cmp-msg cmp-ok', style: 'display:block', text: '기록했습니다' });
    const nextBtn = h('button', { class: 'cmp-btn cmp-success', text: '다음 상품 →', onclick: guard(advance) });
    doneBox.appendChild(doneMsg);
    doneBox.appendChild(nextBtn);

    const fit = guard(() => {
      const inputs = api.qtyInputs();
      if (!inputs.length) { setMsg('옵션을 먼저 고르세요', 'warn'); return; }
      if (inputs.length > 1) { setMsg('옵션이 여러 개면 수량을 직접 나눠 입력하세요(합계 ' + item.qty + '개)', 'warn'); return; }
      setQty(inputs[0], item.qty, api.qtyKey);
      setMsg('수량을 ' + item.qty + '개로 맞췄습니다', 'ok');
    });

    const record = guard((click) => {
      const s = loadState();
      if (!s || !s.items[s.idx]) { setMsg('진행 정보를 읽지 못했습니다', 'err'); return; }
      const it = s.items[s.idx];
      const inputs = api.qtyInputs();
      if (!inputs.length && api.hasOptionSelectors()) { setMsg('옵션을 먼저 고르세요', 'warn'); return; }
      const qty = inputs.length ? sumQty(api) : 1; // 수량 칸이 없는 단일 상품은 1개로 간주
      const total = api.total();
      const sig = qty + '|' + total;
      if (qty !== it.qty && ackSig !== sig) {
        ackSig = sig;
        setMsg('수량이 ' + qty + '개입니다(필요 ' + it.qty + '개). 그대로 진행하려면 한 번 더 누르세요', 'warn');
        return;
      }
      let btn = null;
      if (click) {
        btn = api.addBtn();
        if (!btn) { setMsg('장바구니 버튼을 찾지 못했습니다. 직접 담은 뒤 "기록만 하기"를 누르세요', 'err'); return; }
        assertSafeCartButton(btn); // 구매 관련 버튼이면 예외 발생, 저장·클릭하지 않음
      }
      const url = api.canon();
      const pc = s.pendingCandidate;
      const pick = {
        title: api.title(),
        url,
        option: api.options(),
        qty,
        total,
        shipping: pc && pc.url === url ? pc.shipping || '' : '',
        skipped: false,
      };
      it[s.site] = pick;
      saveState(s);
      if (click) btn.click();
      const notes = [];
      notes.push(click ? '기록했습니다. 장바구니에 담겼는지 사이트 화면에서 확인하세요.' : '기록했습니다.');
      if (!total) notes.push('금액을 읽지 못해 0원으로 기록됨 - 요약에서 확인하세요.');
      doneMsg.textContent = notes.join(' ');
      setMsg('', '');
      sync();
    });

    const sync = () => {
      try {
        const cur = loadState();
        const p = cur && cur.items[cur.idx] ? cur.items[cur.idx][cur.site] : null;
        const recorded = !!(p && !p.skipped && p.url === api.canon());
        doneBox.style.display = recorded ? 'flex' : 'none';
      } catch (e) { /* 무시 */ }
    };

    const tick = () => {
      try {
        const q = sumQty(api);
        qtyEl.textContent = String(q);
        qtyEl.className = q === item.qty ? 'cmp-okt' : '';
        totEl.textContent = fmt(api.total()) + '원';
        sync();
      } catch (e) { /* 무시 */ }
    };
    tick();
    const iv = setInterval(tick, 1000);
    addCleanup(() => clearInterval(iv));

    panel.appendChild(h('div', { class: 'cmp-btns' },
      h('button', { class: 'cmp-btn', text: '수량 ' + item.qty + '개로 맞추기', onclick: fit }),
      h('button', { class: 'cmp-btn cmp-primary', text: '장바구니 담고 기록', onclick: () => record(true) }),
      h('button', { class: 'cmp-btn', text: '기록만 하기', onclick: () => record(false) })));
    panel.appendChild(doneBox);
    panel.appendChild(h('div', { class: 'cmp-btns' },
      h('button', { class: 'cmp-btn', text: '검색으로 돌아가기', onclick: guard(() => gotoSearch(loadState())) }),
      h('button', { class: 'cmp-btn', text: '이 상품 건너뛰기', onclick: guard(skipCurrent) }),
      h('button', { class: 'cmp-btn', text: '요약 보기', onclick: guard(showSummary) })));
  }

  // ------------------------------------------------------------------
  // 시작
  // ------------------------------------------------------------------
  function init() {
    loadUi();
    ensureRoot();
    renderAll();
    // 주소가 바뀌었거나(SPA) 사이트가 루트를 지웠으면 다시 그린다
    setInterval(() => {
      try {
        if (!document.getElementById('cmp-root') || location.href !== ui.lastHref) renderAll();
      } catch (e) { /* 무시 */ }
    }, 1000);
  }

  if (document.body) init();
  else window.addEventListener('DOMContentLoaded', init);
})();
