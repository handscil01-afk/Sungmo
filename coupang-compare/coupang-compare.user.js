// ==UserScript==
// @name         쿠팡 비교견적 도우미
// @namespace    https://handscil01-afk.github.io/Sungmo/
// @version      2.0.2
// @description  쿠팡 장바구니 물품을 11번가·G마켓에서 개당 가격으로 비교해, 쿠팡보다 비싼 비교견적용 상품을 장바구니에 담습니다
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
// @grant        unsafeWindow
// @run-at       document-idle
// @updateURL    https://handscil01-afk.github.io/Sungmo/coupang-compare/coupang-compare.user.js
// @downloadURL  https://handscil01-afk.github.io/Sungmo/coupang-compare/coupang-compare.user.js
// ==/UserScript==

/*
 * [사용법 - 2.0]
 * 1) 쿠팡 장바구니(cart.coupang.com)에서 오른쪽 아래 "비교견적 시작"을 누릅니다.
 *    물품마다 "묶음 개수(예: 24개, 10쌍)", "수량(묶음 수)", "쿠팡 금액", "검색어"가 자동으로 채워집니다. 필요하면 고치세요.
 *    - 필요 개수 = 묶음 개수 × 수량, 개당 가격 = 쿠팡 금액 ÷ 필요 개수 (1쌍 = 2개로 환산합니다).
 *    - 검색어는 "상품명 핵심어 + 옵션 + 묶음 개수"입니다. 결과가 너무 적으면 15초 뒤 옵션을 뺀 검색어로 한 번 자동 재검색합니다.
 * 2) "11번가부터 시작"을 누르면 11번가 검색 결과가 열립니다. 오른쪽 패널에 사진·개당 가격이 붙은 후보가 나옵니다.
 *    - 기본은 "쿠팡보다 비싼 것만 보기"(개당 가격이 쿠팡보다 높은 것, 낮은 가격 순)입니다. 체크를 끄면 전부 보입니다.
 *    - 묶음 개수를 알 수 없는 상품은 "개수 확인 필요" 목록에 따로 모입니다.
 * 3) 후보를 누르면 상품 페이지가 열리고, 쿠팡 옵션(색상·크기·묶음 개수)과 가장 비슷한 옵션을 자동으로 고른 뒤
 *    필요한 개수에 맞게 수량을 자동으로 넣습니다. "옵션 다시 자동 선택", "수량 다시 맞추기"로 다시 할 수 있습니다.
 *    패널에서 선택 옵션·넣은 수량·총액·개당 가격과 "쿠팡보다 N% 비쌈" 여부를 확인하세요.
 * 4) "장바구니 담고 다음 →"을 누르면 기록 후 장바구니에 담고 1.5초 뒤 다음 상품으로 넘어갑니다.
 *    개당 가격이 쿠팡 이하이면 경고가 먼저 나오며, 한 번 더 눌러야 진행합니다. 11번가가 끝나면 같은 방식으로 G마켓을 진행합니다.
 * 5) 마지막에 쿠팡·11번가·G마켓 비교표(품명·수량·단가·금액)가 나옵니다. "표 복사"로 엑셀·한글에 붙여 넣고,
 *    각 장바구니 화면은 캡처해 견적서로 씁니다.
 * ※ 이 스크립트는 구매·주문·결제·선물 버튼을 절대 누르지 않으며, 오직 옵션 "선택하기"와 "장바구니" 버튼만 누릅니다.
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
  const UNIT_CHOICES = ['개', '쌍', '켤레', '매', '세트', '팩'];
  const PW = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window; // 사이트의 jQuery 접근용

  // ==== PURE-BEGIN (화면(DOM)을 쓰지 않는 순수 함수: 개수 해석, 단위 환산, 검색어, 옵션 점수, 후보 계산) ====

  const UNIT_ALT = '개입|개|쌍|켤레|매|장|pcs|pc|pack|pair|ea|p|입|구|세트|set|팩|봉|박스|box';
  const NUM_PAT = '(\\d{1,3}(?:,\\d{3})+|\\d+)';
  // 단위 바로 뒤에 영문·한글이 이어지면(예: 개월, 5px) 개수가 아니다. 세트·짜리·씩 등은 허용
  const AFTER_PAT = '(?=$|[^a-zA-Z가-힣]|세트|짜리|씩|이상|이하|입|으로|[xX×](?=\\s*\\d))';
  // 크기·무게·용량 표기(곱셈 뒤에 오면 개수가 아님)
  const SIZE_AFTER = /^\s*(?:cm|mm|ml|kg|mah|인치|inch|m\b|l\b|g\b|w\b|v\b|%|원|호|단)/i;

  function reMult() {
    return new RegExp(NUM_PAT + '\\s*(' + UNIT_ALT + ')\\s*(?:입)?\\s*[xX×*]\\s*' + NUM_PAT + '\\s*(?:(' + UNIT_ALT + ')' + AFTER_PAT + ')?', 'gi');
  }
  function reCount() {
    return new RegExp(NUM_PAT + '\\s*(' + UNIT_ALT + ')' + AFTER_PAT, 'gi');
  }
  function toInt(s) { return parseInt(String(s).replace(/,/g, ''), 10) || 0; }
  function isDecimalCtx(t, idx) { return t.charAt(idx - 1) === '.' && /\d/.test(t.charAt(idx - 2)); }

  // 단위 이름을 개 / 쌍 / 켤레 / 매 / 세트 / 팩 으로 통일
  function normUnit(u) {
    u = String(u == null ? '' : u).toLowerCase();
    if (/^(개|개입|p|pc|pcs|ea|입|구)$/.test(u)) return '개';
    if (/^(쌍|pair|pairs)$/.test(u)) return '쌍';
    if (u === '켤레') return '켤레';
    if (/^(매|장)$/.test(u)) return '매';
    if (/^(세트|set|sets)$/.test(u)) return '세트';
    if (/^(팩|pack|봉|box|박스)$/.test(u)) return '팩';
    return '';
  }

  // 상품명·옵션에서 묶음 개수를 읽는다. 못 읽으면 null
  // preferUnit: 쿠팡 상품의 단위. 같은 단위(쌍↔켤레 포함) 표기가 있으면 그것을 우선한다(예: '10쌍 … 180개' → 10쌍)
  function perLabel(unit) { return (unit && unit !== '개' ? unit : '개') + '당'; }
  function parsePack(text, preferUnit) {
    const t = String(text == null ? '' : text);
    if (!t.trim()) return null;
    let m;
    // 1) 곱셈 표기: "10개x2", "24개입 x 2개" -> 곱한 값
    const rm = reMult();
    while ((m = rm.exec(t))) {
      if (isDecimalCtx(t, m.index)) continue;
      const rest = t.slice(m.index + m[0].length);
      if (!m[4] && SIZE_AFTER.test(rest)) continue; // "10개 x 2m" 같은 크기 표기
      const n = toInt(m[1]) * toInt(m[3]);
      const u1 = normUnit(m[2]);
      const u2 = m[4] ? normUnit(m[4]) : '';
      let unit = u1;
      if (u2 && u2 !== u1 && (u1 === '세트' || u1 === '팩')) unit = u2;
      if (n > 0 && n <= 100000 && unit) return { n, unit };
    }
    // 2) 일반 표기: 세트는 다른 개수가 없을 때만 쓰고, 여러 개면 가장 큰 값
    const toks = [];
    const rc = reCount();
    while ((m = rc.exec(t))) {
      if (isDecimalCtx(t, m.index)) continue;
      const n = toInt(m[1]);
      const unit = normUnit(m[2]);
      if (n > 0 && n <= 100000 && unit) toks.push({ n, unit });
    }
    if (!toks.length) return null;
    const nonSet = toks.filter((x) => x.unit !== '세트');
    const pairLike = (u) => u === '쌍' || u === '켤레';
    const same = preferUnit ? nonSet.filter((x) => x.unit === preferUnit || (pairLike(x.unit) && pairLike(preferUnit))) : [];
    const pool = same.length ? same : (nonSet.length ? nonSet : toks);
    let best = pool[0];
    pool.forEach((x) => { if (x.n > best.n) best = x; });
    return { n: best.n, unit: best.unit };
  }

  // 묶음을 목표 단위로 환산한다. 1쌍 = 2개(켤레도 같음). 환산 불가면 null
  function convertPack(pack, targetUnit) {
    if (!pack || !targetUnit || !(pack.n > 0)) return null;
    const a = pack.unit;
    const b = targetUnit;
    const pairLike = (u) => u === '쌍' || u === '켤레';
    if (a === b) return { n: pack.n, conv: false };
    if (pairLike(a) && pairLike(b)) return { n: pack.n, conv: false };
    if (a === '개' && pairLike(b)) return { n: pack.n / 2, conv: true };
    if (pairLike(a) && b === '개') return { n: pack.n * 2, conv: true };
    return null;
  }

  // ---- 검색어 ----
  function stripBrackets(s) {
    return String(s == null ? '' : s).replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|【[^】]*】/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function cleanWord(w) { return String(w).replace(/^[^0-9A-Za-z가-힣]+|[^0-9A-Za-z가-힣]+$/g, ''); }
  function isNumberOrSizeWord(w) {
    if (/^[\d.,]+(?:cm|mm|m|ml|l|g|kg|㎝|㎜|인치|inch|%|원|w|v|mah|호|단)?$/i.test(w)) return true;
    return new RegExp('^' + NUM_PAT + '(?:' + UNIT_ALT + ')$', 'i').test(w);
  }
  // 상품명 앞쪽의 의미 있는 낱말 최대 3개 ([..] (..) 제거, 숫자·크기만 있는 말 제외)
  function coreWords(name, max) {
    max = max || 3;
    let ws = stripBrackets(name).split(' ').map(cleanWord).filter(Boolean);
    let good = ws.filter((w) => !isNumberOrSizeWord(w) && !(w.length === 1 && /[A-Za-z]/.test(w)));
    if (!good.length) {
      ws = String(name == null ? '' : name).split(/\s+/).map(cleanWord).filter(Boolean);
      good = ws.filter((w) => !isNumberOrSizeWord(w));
    }
    return good.slice(0, max);
  }
  function stripCounts(s) {
    return String(s == null ? '' : s).replace(reMult(), ' ').replace(reCount(), ' ');
  }
  // 옵션에서 묶음 개수를 뺀 낱말 (예: "빨강, 24개" -> ["빨강"])
  function optionWords(option) {
    return stripCounts(option).replace(/[()\[\]{}]/g, ' ').split(/[\s,\/]+/).map(cleanWord)
      .filter((w) => w && !/^\d+$/.test(w) && w !== '옵션').slice(0, 3);
  }
  // pack: 상품명·옵션에서 실제로 읽은 묶음(없으면 null). 2개 이상일 때만 검색어에 넣는다
  function buildKeywords(name, option, pack) {
    const core = coreWords(name, 3);
    const opt = optionWords(option);
    const parts = [];
    const seen = {};
    const push = (w) => {
      const k = String(w).toLowerCase();
      if (!w || seen[k]) return;
      seen[k] = true;
      parts.push(w);
    };
    core.forEach(push);
    opt.forEach(push);
    if (pack && pack.n > 1) push(pack.n + pack.unit);
    const broad = core.join(' ') || String(name == null ? '' : name).trim().split(/\s+/).slice(0, 3).join(' ');
    return { full: parts.join(' ') || broad, broad, core };
  }

  // ---- 관련 상품 판별: 쿠팡 상품명의 한글 낱말(2자 이상) 중 하나라도 후보 제목에 있어야 한다 ----
  function hangulWords(name) {
    const out = [];
    (stripBrackets(name).match(/[가-힣]{2,}/g) || []).forEach((w) => { if (out.indexOf(w) < 0) out.push(w); });
    return out.slice(0, 8);
  }
  function isRelevant(title, words) {
    if (!words || !words.length) return true;
    const a = String(title == null ? '' : title);
    const b = a.replace(/\s+/g, '');
    return words.some((w) => a.indexOf(w) >= 0 || b.indexOf(w) >= 0);
  }

  // ---- 옵션 점수 ----
  const COLOR_GROUPS = [
    ['빨강', '빨간', '적색', '레드', 'red'],
    ['파랑', '파란', '청색', '청', '블루', 'blue'],
    ['흰', '흰색', '백색', '화이트', 'white', '백'],
    ['검정', '검은', '블랙', 'black', '흑'],
    ['노랑', '노란', '옐로우', 'yellow', '황색'],
    ['초록', '녹색', '그린', 'green'],
    ['회색', '그레이', 'gray', 'grey'],
    ['분홍', '핑크', 'pink'],
    ['주황', '오렌지', 'orange'],
    ['보라', '퍼플', 'purple'],
  ];
  function hasSyn(text, syn) {
    const t = String(text == null ? '' : text).toLowerCase();
    if (/^[a-z]+$/.test(syn)) return new RegExp('(^|[^a-z])' + syn + '([^a-z]|$)').test(t);
    if (syn === '청' || syn === '백' || syn === '흑') return new RegExp('(^|[^가-힣])' + syn + '(색)?($|[^가-힣])').test(t); // 청소·백화점 등 오인 방지
    return t.indexOf(syn) >= 0;
  }
  function colorGroupsOf(text) {
    const s = new Set();
    COLOR_GROUPS.forEach((g, i) => { if (g.some((x) => hasSyn(text, x))) s.add(i); });
    return s;
  }
  function sizesOf(text) {
    const out = new Set();
    const t = String(text == null ? '' : text);
    const re = /(^|[^A-Za-z0-9])(\d?[Xx]{1,3}[Ll]|XS|L|M|S|FREE|[Ff]ree|프리(?=사이즈|[^가-힣]|$))(?![A-Za-z0-9])/g;
    let m;
    while ((m = re.exec(t))) {
      let s = m[2].toUpperCase();
      if (s === '프리') s = 'FREE';
      out.add(s);
    }
    const rc = /(\d+(?:\.\d+)?)\s*cm/gi;
    while ((m = rc.exec(t))) out.add(parseFloat(m[1]) + 'CM');
    return out;
  }
  // pack: 쿠팡 쪽에서 실제로 읽은 묶음({n,unit}) 또는 null
  function buildTarget(optionText, nameText, pack) {
    let colors = colorGroupsOf(optionText);
    if (!colors.size) colors = colorGroupsOf(nameText);
    const sizes = sizesOf(optionText);
    const p = pack && pack.n > 0 ? { n: pack.n, unit: pack.unit } : null;
    return { colors, sizes, pack: p, empty: !colors.size && !sizes.size && !p };
  }
  function scoreOption(optionText, target) {
    const t = String(optionText == null ? '' : optionText);
    let score = 0;
    const cg = colorGroupsOf(t);
    target.colors.forEach((g) => { if (cg.has(g)) score += 10; });
    const sg = sizesOf(t);
    target.sizes.forEach((s) => { if (sg.has(s)) score += 8; });
    const pk = parsePack(t, target.pack ? target.pack.unit : '');
    if (pk && target.pack) {
      const c = convertPack(pk, target.pack.unit);
      if (c) {
        if (Math.abs(c.n - target.pack.n) < 1e-9) score += 6;
        if (c.n >= target.pack.n - 1e-9) score += 3;
      }
    }
    if (/품절/.test(t)) score -= 20;
    return score;
  }
  // entries: [{text, price, soldout}] -> {index, score, warn}. 품절은 고르지 않는다
  function pickBestOption(entries, target) {
    const ok = [];
    entries.forEach((e, i) => { if (!(e.soldout || /품절/.test(e.text || ''))) ok.push(i); });
    if (!ok.length) return { index: -1, score: 0, warn: false };
    let best = -1;
    let bestScore = -Infinity;
    ok.forEach((i) => {
      const e = entries[i];
      const sc = scoreOption(e.text, target);
      if (best < 0 || sc > bestScore || (sc === bestScore && e.price > 0 && entries[best].price > 0 && e.price < entries[best].price)) {
        best = i;
        bestScore = sc;
      }
    });
    if (bestScore <= 0) return { index: ok[0], score: bestScore, warn: ok.length > 1 && !target.empty };
    return { index: best, score: bestScore, warn: false };
  }

  // ---- 후보 계산 ----
  // item: {packUnit, needUnits, cpUnitPrice}. rel: higher(쿠팡보다 비쌈) / same / lower(쌈) / unknown
  function evalCandidate(c, item) {
    const pack = parsePack(c.title, item.packUnit);
    const conv = pack ? convertPack(pack, item.packUnit) : null;
    const cpu = item.cpUnitPrice || 0;
    const o = Object.assign({}, c, { pack, conv, unitPrice: null, bundles: null, estTotal: null, diffPct: null, rel: 'unknown' });
    if (conv && c.price > 0) {
      o.unitPrice = c.price / conv.n;
      o.bundles = Math.max(1, Math.ceil(item.needUnits / conv.n - 1e-9));
      o.estTotal = o.bundles * c.price;
      if (cpu > 0) {
        o.diffPct = (o.unitPrice / cpu - 1) * 100;
        const d = o.unitPrice - cpu;
        o.rel = Math.abs(d) < 1e-9 ? 'same' : d > 0 ? 'higher' : 'lower';
      }
    }
    return o;
  }
  // onlyHigher가 켜져 있으면 쿠팡보다 비싼 것만 낮은 개당 가격 순으로, 개수 모르는 것은 check 목록으로
  function splitCandidates(cands, cpu, onlyHigher) {
    const byUnit = (a, b) => {
      if (a.unitPrice == null && b.unitPrice == null) return (a.price || 0) - (b.price || 0);
      if (a.unitPrice == null) return 1;
      if (b.unitPrice == null) return -1;
      return a.unitPrice - b.unitPrice;
    };
    if (!onlyHigher || !(cpu > 0)) return { main: cands.slice().sort(byUnit).slice(0, 20), check: [] };
    const main = cands.filter((c) => c.rel === 'higher').sort((a, b) => a.unitPrice - b.unitPrice).slice(0, 20);
    const check = cands.filter((c) => c.unitPrice == null && c.price > cpu).sort((a, b) => a.price - b.price).slice(0, 20);
    return { main, check };
  }

  // ==== PURE-END ====

  // ------------------------------------------------------------------
  // 공용 도우미
  // ------------------------------------------------------------------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const txt = (e) => (e && e.textContent ? e.textContent.replace(/\s+/g, ' ').trim() : '');
  const fmt = (n) => (Number(n) || 0).toLocaleString('ko-KR');
  // 개당 가격: 소수 첫째 자리까지
  const fmtP = (n) => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString('ko-KR', { maximumFractionDigits: 1 });
  const packText = (n, unit) => fmt(n) + unit;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

  function errMsg(e) { return e && e.message ? e.message : String(e); }

  // ------------------------------------------------------------------
  // 상태 저장 (GM 저장소: 쿠팡/11번가/G마켓 도메인 공유)
  // ------------------------------------------------------------------
  // 1.x 상태(묶음 개수 없음)는 묶음 1개 단위로 보정한다
  function normItem(it) {
    if (!it) return it;
    it.qty = Math.max(1, parseInt(it.qty, 10) || 1);
    if (!(it.packN > 0)) it.packN = 1;
    if (!it.packUnit) it.packUnit = '개';
    if (!(it.needUnits > 0)) it.needUnits = it.packN * it.qty;
    if (typeof it.cpUnitPrice !== 'number') it.cpUnitPrice = it.needUnits ? (it.cpTotal || 0) / it.needUnits : 0;
    if (!it.broadKeyword) it.broadKeyword = coreWords(it.name, 3).join(' ') || String(it.name || '').split(/\s+/).slice(0, 3).join(' ');
    if (!it.fullKeyword) it.fullKeyword = it.keyword || it.broadKeyword;
    if (!it.keyword) it.keyword = it.fullKeyword;
    if (!Array.isArray(it.relWords)) it.relWords = hangulWords(it.name);
    return it;
  }
  function loadState() {
    try {
      const v = GM_getValue(KEY, '');
      if (!v) return null;
      const s = typeof v === 'string' ? JSON.parse(v) : v;
      if (!(s && Array.isArray(s.items))) return null;
      s.items.forEach(normItem);
      return s;
    } catch (e) {
      return null;
    }
  }
  function saveState(s) { GM_setValue(KEY, JSON.stringify(s)); }
  function clearState() { GM_setValue(KEY, ''); }

  // side: 검색 화면은 오른쪽 위, 상품 화면은 사이트의 옵션 영역을 가리지 않게 왼쪽 아래가 기본
  const uiPref = { collapsed: false, side: { search: 'right', product: 'left' }, onlyHigher: true };
  function loadUi() {
    try {
      const v = GM_getValue(UIKEY, '');
      if (v) {
        const o = typeof v === 'string' ? JSON.parse(v) : v;
        if (o && typeof o.collapsed === 'boolean') uiPref.collapsed = o.collapsed;
        if (o && o.side) Object.assign(uiPref.side, o.side);
        if (o && typeof o.onlyHigher === 'boolean') uiPref.onlyHigher = o.onlyHigher;
      }
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

  function currentUrlKeyword() {
    try {
      const sp = new URL(location.href).searchParams;
      return (location.hostname === 'search.11st.co.kr' ? sp.get('kwd') : sp.get('keyword')) || '';
    } catch (e) { return ''; }
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
    return coreWords(name, 3).join(' ') || String(name || '').split(/\s+/).slice(0, 3).join(' ');
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
  // 이미지 주소를 https 절대 주소로 (// 로 시작하는 주소 포함)
  function absImg(src) {
    try {
      let s = String(src || '').trim();
      if (!s || /^data:/i.test(s)) return '';
      if (s.indexOf('//') === 0) s = 'https:' + s;
      const u = new URL(s, location.href);
      return u.protocol === 'https:' ? u.href : '';
    } catch (e) { return ''; }
  }
  function imgOf(img) {
    if (!img) return '';
    return absImg(img.getAttribute('src')) || absImg(img.getAttribute('data-src')) || absImg(img.getAttribute('data-original')) || '';
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

        // 링크 글자 안에 '옵션: …'이 함께 들어 있으므로 잘라 낸다
        const name = links.map((a) => txt(a).replace(/\s*옵션\s*:.*$/, '').trim()).find(Boolean) || '';
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
        out.push({ name, option, qty, cpTotal: price });
      } catch (e) { /* 한 줄 실패는 건너뜀 */ }
    });
    return out;
  }

  // ------------------------------------------------------------------
  // 검색 결과 읽기
  // ------------------------------------------------------------------
  function shipFromText(t) {
    t = String(t || '');
    const m = t.match(/배송비\s*(무료|[\d,]+원)/);
    if (m) return m[1] === '무료' ? '무료' : m[1];
    if (/무료\s*배송/.test(t)) return '무료';
    return '';
  }

  function st11Id(card) {
    const anchors = $$('a[href]', card);
    for (let i = 0; i < anchors.length; i++) {
      let href = anchors[i].getAttribute('href') || '';
      let m = href.match(/\/products\/(\d+)/) || href.match(/pdpPrdNo=(\d+)/);
      if (m) return m[1];
      try {
        href = decodeURIComponent(href);
        m = href.match(/\/products\/(\d+)/) || href.match(/pdpPrdNo=(\d+)/);
        if (m) return m[1];
      } catch (e) { /* 무시 */ }
    }
    return '';
  }

  function parseStCards() {
    const out = [];
    const seen = new Set();
    $$('.c-card-item').forEach((card) => {
      try {
        const id = st11Id(card);
        if (!id || seen.has(id)) return;
        const title = txt($('.c-card-item__name dd', card)) || txt($('.c-card-item__name', card));
        if (!title) return;
        const price = num(txt($('.c-card-item__price .value', card)));
        const ship = shipFromText(card.innerText || card.textContent);
        seen.add(id);
        out.push({ id, title, price, shipping: ship, image: imgOf($('img', card)), url: 'https://www.11st.co.kr/products/' + id });
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
        out.push({ id: code, title, price, shipping: ship, image: imgOf($('img.image__item', card) || $('img', card)), url: 'https://item.gmarket.co.kr/Item?goodscode=' + code });
      } catch (e) { /* 건너뜀 */ }
    });
    return out;
  }

  function parseRawCandidates(site) {
    return (site === 'st' ? parseStCards() : parseGmCards()).slice(0, 80);
  }

  // 관련 있는 후보만 골라 개당 가격 등을 계산한다
  function evaluateCandidates(raw, item) {
    const words = item.relWords && item.relWords.length ? item.relWords : hangulWords(item.name);
    const out = [];
    raw.forEach((c) => {
      try {
        if (isRelevant(c.title, words)) out.push(evalCandidate(c, item));
      } catch (e) { /* 건너뜀 */ }
    });
    return out;
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
    if (withKey) {
      // G마켓: 사이트가 jQuery로 수량 변경을 처리하므로 같은 방식으로도 알린다
      try {
        const jq = PW.jQuery || window.jQuery;
        if (jq) jq(inp).val(n).trigger('keyup').trigger('change').trigger('blur');
      } catch (e) { /* 무시 */ }
    }
  }

  // 옵션 선택기가 있어 보이는지 (수량 입력칸이 없을 때만 사용하는 추정)
  function genericHasOptionSelectors() {
    const outside = (e) => !e.closest('#cmp-root') && !e.closest('li.option_item') && !e.closest('#coreSelectedList');
    if ($$('select').some((e) => outside(e) && visible(e))) return true;
    return $$('[class*="option" i], [id*="option" i]').some((e) => outside(e) && visible(e) && e.offsetHeight > 20);
  }

  // ---- 11번가 옵션 구조 ----
  // 옵션 후보 줄: 수량 칸이 없고 "선택하기" 버튼이 있는 li/div (스토어 묶음 상품 목록 [data-optprdno]은 제외)
  function stEntriesIn(root) {
    return $$('li.option_item:not([data-optprdno]), div.option_item[data-dtloptnm]', root)
      .filter((e) => !e.closest('#cmp-root') && !$('input[name="prdcAmount"]', e) && $('button.c_product_btn_select', e));
  }
  function stSections() {
    return $$('.accordion_section').filter((s) => !s.closest('#cmp-root') && $('input[name="botOptTitle"]', s));
  }
  function stOptionGroups() {
    const groups = [];
    const map = new Map();
    stEntriesIn(document).forEach((e) => {
      const sec = e.closest('.accordion_section');
      const host = sec || e.closest('ul.option_item_list') || e.parentElement;
      let g = map.get(host);
      if (!g) {
        const t = sec ? $('input[name="botOptTitle"]', sec) : null;
        g = { host, multi: !!sec, entries: [], title: t ? t.value || '' : '' };
        map.set(host, g);
        groups.push(g);
      }
      g.entries.push(e);
    });
    groups.sort((a, b) => (a.host.compareDocumentPosition(b.host) & 4 ? -1 : 1));
    return groups;
  }
  function stEntryInfo(e) {
    const btn = $('button.c_product_btn_select', e);
    let text = txt($('.option_name', e)) || e.getAttribute('data-dtloptnm') || '';
    if (!text) {
      const c = e.cloneNode(true);
      $$('button', c).forEach((x) => x.remove());
      text = txt(c);
    }
    const all = txt(e);
    return {
      text,
      price: num(e.getAttribute('data-price')),
      soldout: /품절/.test(all) || /sold[-_]?out/i.test(e.className || '') || !!(btn && btn.disabled),
    };
  }
  // 접힌 옵션 목록을 여는 버튼
  function stFindOpener(entry) {
    const bad = (b) => b.closest('#cmp-root') || FORBIDDEN.test(txt(b)) || /buying|InsOrder|GiftBtn/i.test(b.className + ' ' + (b.id || ''));
    const sec = entry.closest('.accordion_section');
    if (sec) {
      const b = $$('.accordion_head button.btn, .dropdown_selected button.btn', sec).find((x) => !bad(x));
      if (b) return b;
    }
    let n = entry;
    for (let i = 0; i < 6 && n && n !== document.body; i++, n = n.parentElement) {
      const b = $$('.dropdown_selected button.btn, .accordion_head button.btn', n).find((x) => !bad(x));
      if (b) return b;
    }
    return null;
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
      // 상품 화면의 옵션 목록(선택하기 버튼)도 li.option_item이므로, 수량 칸이 있는 '선택한 옵션' 줄만 센다
      rows() { return $$('li.option_item').filter((r) => visible(r) && r.querySelector('input[name="prdcAmount"]')); },
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
            n += num(r.getAttribute('data-price')) * q;
          });
        }
        return n;
      },
      addBtn() {
        return $$('button.btn_cart').find(visible) || $$('button').find((b) => visible(b) && txt(b) === '장바구니') || null;
      },
      optionUiExists() {
        return stEntriesIn(document).length > 0 || stSections().length > 0 || this.rows().length > 0;
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
          const o = $$('.txt_option', r).map(txt).filter(Boolean).join(' ');
          if (o) return o;
          const c = r.cloneNode(true);
          $$('button, input, select', c).forEach((x) => x.remove());
          return txt(c);
        }).filter(Boolean).join(', ');
      },
      total() { return num(txt($('#coreTotalPrice'))); },
      addBtn() { return $('#coreAddCartBtn'); },
      optionUiExists() { return !!$('#optOrderSel_0') || this.rows().length > 0; },
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
  // 11번가 옵션 "선택하기" 버튼도 구매 관련 글자가 없는지, 옵션 선택 버튼이 맞는지 확인한 뒤에만 누른다
  function assertSafeSelectButton(btn) {
    const label = txt(btn) + ' ' + (btn.id || '');
    if (FORBIDDEN.test(label) || /buying|InsOrder|GiftBtn/i.test(label) || (btn.classList && btn.classList.contains('btn_buying'))) throw new Error('구매 관련 버튼은 누르지 않습니다');
    if (!(btn.classList && btn.classList.contains('c_product_btn_select'))) throw new Error('옵션 선택 버튼이 아닌 것 같아 누르지 않았습니다');
  }

  // ---- 옵션 자동 선택 ----
  async function stAutoSelect(target, warns) {
    if (API.st.rows().length) return 'already';
    const sections = stSections();
    const multi = sections.length > 0;
    const first = stOptionGroups();
    if (!multi && !first.length) return 'none';
    const levels = multi ? sections.length : 1;
    for (let lvl = 0; lvl < levels; lvl++) {
      if (lvl > 0 && API.st.rows().length) break;
      let entries = [];
      if (multi) {
        const sec = await waitFor(() => {
          const s = stSections()[lvl];
          return s && stEntriesIn(s).length ? s : null;
        }, 4000, 300);
        if (!sec) { warns.push((lvl + 1) + '번째 옵션 목록을 찾지 못했습니다. 직접 골라 주세요'); break; }
        entries = stEntriesIn(sec);
      } else {
        const g = stOptionGroups()[0];
        entries = g ? g.entries : [];
      }
      const infos = entries.map(stEntryInfo);
      const pick = pickBestOption(infos, target);
      if (pick.index < 0) { warns.push('고를 수 있는 옵션이 없습니다(모두 품절로 보입니다)'); break; }
      if (pick.warn) warns.push('쿠팡 옵션과 맞는 항목을 찾지 못해 첫 옵션을 골랐습니다. 확인해 주세요');
      const entry = entries[pick.index];
      const btn = $('button.c_product_btn_select', entry);
      if (!btn) { warns.push('선택 버튼을 찾지 못했습니다'); break; }
      if (!visible(btn)) {
        const op = stFindOpener(entry);
        if (op) { op.click(); await sleep(450); }
      }
      assertSafeSelectButton(btn);
      btn.click();
      await sleep(700);
    }
    await waitFor(() => API.st.rows().length > 0, 4000, 300);
    return 'done';
  }

  function gmEntries(sel, i) {
    let list = $$('ul.select-itemoption-list li.list-item', sel).filter((li) => $('a.link', li));
    if (!list.length) {
      const ul = $$('ul.select-itemoption-list')[i];
      if (ul) list = $$('li.list-item', ul).filter((li) => $('a.link', li));
    }
    return list;
  }
  function gmEntryInfo(li) {
    const a = $('a.link', li);
    const v1 = a.getAttribute('data-optionvalue1') || '';
    const name = txt($('.text__name', a)) || txt(a);
    const text = name && name.indexOf(v1) < 0 ? (v1 + ' ' + name).trim() : (name || v1);
    return {
      text,
      price: num(a.getAttribute('data-optionprice')),
      soldout: li.classList.contains('soldout') || /품절/.test(txt(li)),
    };
  }
  async function gmAutoSelect(target, warns) {
    if (API.gm.rows().length) return 'already';
    if (!$('#optOrderSel_0')) {
      const s0 = await waitFor(() => $('#optOrderSel_0'), 2000, 300);
      if (!s0) return 'none';
    }
    for (let i = 0; i < 8; i++) {
      const sel = await waitFor(() => $('#optOrderSel_' + i), i === 0 ? 1500 : 1500, 250);
      if (!sel) break;
      if (i > 0 && API.gm.rows().length) break;
      const opener = (sel.matches && sel.matches('button.uxeselect_btn')) ? sel : $('button.uxeselect_btn', sel);
      if (opener) { opener.click(); await sleep(300); }
      const entries = await waitFor(() => { const a = gmEntries(sel, i); return a.length ? a : null; }, 4000, 300);
      if (!entries) { warns.push((i + 1) + '번째 옵션 목록을 읽지 못했습니다. 직접 골라 주세요'); break; }
      const infos = entries.map(gmEntryInfo);
      const pick = pickBestOption(infos, target);
      if (pick.index < 0) { warns.push('고를 수 있는 옵션이 없습니다(모두 품절로 보입니다)'); break; }
      if (pick.warn) warns.push('쿠팡 옵션과 맞는 항목을 찾지 못해 첫 옵션을 골랐습니다. 확인해 주세요');
      const link = $('a.link', entries[pick.index]);
      link.click();
      await sleep(700);
    }
    await waitFor(() => API.gm.rows().length > 0, 4000, 300);
    return 'done';
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
    s.items[i].broadened = false;
    s.items[i].keyword = s.items[i].fullKeyword || s.items[i].keyword;
    s.pendingCandidate = null;
    saveState(s);
    gotoSearch(s);
  }

  // ------------------------------------------------------------------
  // 스타일
  // ------------------------------------------------------------------
  addStyle(`
#cmp-root, #cmp-root * { box-sizing: border-box; font-family: "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif; letter-spacing: normal; }
#cmp-root button, #cmp-root input, #cmp-root select, #cmp-root a { font-size: 13px; line-height: 1.3; }
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
#cmp-root input[type="text"], #cmp-root input[type="number"], #cmp-root select { min-height: 32px; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #111827; width: 100%; }
#cmp-root input[type="checkbox"] { width: 18px; height: 18px; margin: 2px; }
#cmp-root .cmp-clamp2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-all; }

#cmp-root .cmp-fab { position: fixed; right: 16px; bottom: 16px; z-index: 2147483600; min-height: 44px; padding: 8px 18px; border-radius: 22px; border: none; background: #2563eb; color: #fff; font-size: 15px; font-weight: 700; box-shadow: 0 4px 14px rgba(0,0,0,.3); cursor: pointer; }
#cmp-root .cmp-fab:hover { background: #1d4ed8; }
#cmp-root .cmp-pill { position: fixed; right: 12px; bottom: 16px; z-index: 2147483600; min-height: 36px; padding: 6px 14px; border-radius: 18px; border: none; background: #2563eb; color: #fff; font-weight: 700; box-shadow: 0 4px 14px rgba(0,0,0,.3); cursor: pointer; }

#cmp-root #cmp-panel { position: fixed; top: 12px; right: 12px; width: 360px; max-width: calc(100vw - 24px); max-height: 85vh; display: flex; flex-direction: column; gap: 8px; padding: 12px; background: #fff; color: #111827; border: 1px solid #d1d5db; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,.28); z-index: 2147483600; font-size: 14px; line-height: 1.4; overflow: hidden; }
#cmp-root #cmp-panel.cmp-left { right: auto; left: 12px; top: auto; bottom: 12px; }
#cmp-root .cmp-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
#cmp-root .cmp-title { font-size: 15px; color: #1e3a8a; }
#cmp-root .cmp-name { font-weight: 700; font-size: 14px; }
#cmp-root .cmp-meta { font-size: 12.5px; color: #475569; }
#cmp-root .cmp-msg { display: none; padding: 6px 8px; border-radius: 8px; font-size: 12.5px; background: #f1f5f9; color: #334155; }
#cmp-root .cmp-msg.cmp-err { background: #fee2e2; color: #991b1b; }
#cmp-root .cmp-msg.cmp-warn { background: #fef3c7; color: #92400e; }
#cmp-root .cmp-msg.cmp-ok { background: #dcfce7; color: #166534; }
#cmp-root .cmp-row2 { display: flex; gap: 6px; align-items: center; }
#cmp-root .cmp-list { flex: 1 1 auto; min-height: 90px; max-height: 50vh; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 2px; }
#cmp-root .cmp-cand { display: flex; gap: 8px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px; cursor: pointer; background: #fff; }
#cmp-root .cmp-cand:hover { border-color: #2563eb; background: #eff6ff; }
#cmp-root .cmp-cand.cmp-lower { border-color: #fca5a5; background: #fff7f7; }
#cmp-root .cmp-thumb { flex: 0 0 56px; width: 56px; height: 56px; object-fit: cover; border-radius: 6px; background: #f1f5f9; border: 1px solid #e2e8f0; }
#cmp-root .cmp-cand-b { flex: 1 1 auto; min-width: 0; }
#cmp-root .cmp-cand-t { font-size: 13px; }
#cmp-root .cmp-cand-m { font-size: 13px; margin-top: 2px; color: #111827; }
#cmp-root .cmp-cand-s { font-size: 12px; margin-top: 1px; color: #334155; }
#cmp-root .cmp-ship { color: #64748b; font-size: 12px; }
#cmp-root .cmp-badge { display: inline-block; padding: 0 6px; border-radius: 8px; font-size: 11.5px; font-weight: 700; background: #fee2e2; color: #b91c1c; }
#cmp-root .cmp-up { color: #15803d; font-weight: 700; }
#cmp-root .cmp-empty { padding: 12px 6px; color: #64748b; font-size: 13px; }
#cmp-root details.cmp-check { border: 1px dashed #cbd5e1; border-radius: 8px; padding: 4px 6px; }
#cmp-root details.cmp-check > summary { cursor: pointer; font-size: 12.5px; color: #475569; font-weight: 700; }
#cmp-root details.cmp-check > div { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
#cmp-root .cmp-steps { font-size: 12.5px; color: #334155; background: #eff6ff; border-radius: 8px; padding: 6px 8px; }
#cmp-root .cmp-live { font-size: 13px; padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; flex-direction: column; gap: 4px; }
#cmp-root .cmp-live .cmp-lr { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
#cmp-root .cmp-live .cmp-lk { color: #64748b; min-width: 62px; }
#cmp-root .cmp-live input[type="number"] { width: 70px; min-height: 28px; padding: 2px 6px; }
#cmp-root .cmp-live select { width: 70px; min-height: 28px; padding: 2px 4px; }
#cmp-root .cmp-status { font-weight: 700; padding: 4px 8px; border-radius: 8px; background: #f1f5f9; color: #334155; }
#cmp-root .cmp-status.cmp-good { background: #dcfce7; color: #166534; }
#cmp-root .cmp-status.cmp-badst { background: #fee2e2; color: #991b1b; }
#cmp-root .cmp-status.cmp-warnst { background: #fef3c7; color: #92400e; }
#cmp-root .cmp-okt { color: #16a34a; }
#cmp-root .cmp-btns { display: flex; flex-wrap: wrap; gap: 6px; }
#cmp-root .cmp-btns .cmp-btn { flex: 1 1 auto; }
#cmp-root .cmp-donebox { display: none; flex-direction: column; gap: 6px; }

#cmp-root .cmp-bg { position: fixed; inset: 0; background: rgba(15,23,42,.55); z-index: 2147483640; display: flex; align-items: center; justify-content: center; padding: 12px; }
#cmp-root .cmp-modal { background: #fff; color: #111827; border-radius: 12px; width: min(1000px, 100%); max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 12px 40px rgba(0,0,0,.4); font-size: 14px; }
#cmp-root .cmp-mhead { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
#cmp-root .cmp-mhead b { font-size: 16px; }
#cmp-root .cmp-mbody { padding: 12px 16px; overflow: auto; flex: 1 1 auto; }
#cmp-root .cmp-mfoot { padding: 10px 16px; border-top: 1px solid #e5e7eb; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
#cmp-root .cmp-hint { font-size: 12.5px; color: #475569; margin: 4px 0 8px; }

#cmp-root .cmp-crow { display: grid; grid-template-columns: 24px minmax(0,1fr); gap: 4px 8px; align-items: start; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
#cmp-root .cmp-crow .cmp-fields { grid-column: 2; display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: flex-end; }
#cmp-root .cmp-field { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #64748b; }
#cmp-root .cmp-field input[type="number"] { width: 78px; }
#cmp-root .cmp-field input.cmp-wide { width: 110px; }
#cmp-root .cmp-field select { width: 74px; }
#cmp-root .cmp-field b { font-size: 14px; color: #111827; min-height: 32px; display: inline-flex; align-items: center; }
#cmp-root .cmp-crow .cmp-kw { grid-column: 2; display: flex; gap: 6px; align-items: center; font-size: 12px; color: #475569; }
#cmp-root .cmp-crow .cmp-kw span { white-space: nowrap; }
#cmp-root .cmp-opt { font-size: 12px; color: #64748b; }

#cmp-root table.cmp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
#cmp-root .cmp-table th, #cmp-root .cmp-table td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; text-align: left; color: #111827; background: #fff; }
#cmp-root .cmp-table th { background: #f1f5f9; text-align: center; }
#cmp-root .cmp-table td.cmp-r { text-align: right; }
#cmp-root .cmp-table td.cmp-nw { white-space: nowrap; }
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
  const ui = { cleanups: [], lastHref: '', autoKey: '' };

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
      openModal('비교견적', h('div', { class: 'cmp-bad', text: '오류가 발생했습니다: ' + errMsg(e) }), null);
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
      body.appendChild(h('div', { class: 'cmp-hint', text: '비교할 물품을 확인하세요. 묶음 개수(상품명·옵션에서 읽은 값)와 수량(묶음 수)을 맞게 고치면 필요 개수와 쿠팡 개당 가격이 계산됩니다. 쿠팡 금액은 수량을 바꿔도 자동으로 바뀌지 않으니 이 물품의 합계 금액으로 입력하세요.' }));
      lines.forEach((ln) => {
        const pk = parsePack(ln.option) || parsePack(ln.name); // 옵션에서 읽은 값을 상품명보다 우선
        const pack0 = pk || { n: 1, unit: '개' };
        const kws = buildKeywords(ln.name, ln.option, pk);
        const chk = h('input', { type: 'checkbox', checked: true });
        const packN = h('input', { type: 'number', min: '1', value: String(pack0.n), 'aria-label': '묶음 개수' });
        const unit = h('select', { 'aria-label': '단위' }, UNIT_CHOICES.map((u) => h('option', { value: u, text: u })));
        unit.value = pack0.unit;
        const qty = h('input', { type: 'number', min: '1', value: String(ln.qty), 'aria-label': '수량(묶음 수)' });
        const price = h('input', { type: 'text', class: 'cmp-wide', value: fmt(ln.cpTotal), 'aria-label': '쿠팡 금액' });
        const kw = h('input', { type: 'text', value: kws.full, 'aria-label': '검색어' });
        const needEl = h('b', { text: '' });
        const unitEl = h('b', { text: '' });
        const r = { ln, pk, chk, packN, unit, qty, price, kw, needEl, unitEl, kwTouched: false, packTouched: !!pk };
        rows.push(r);

        const recalc = () => {
          const pn = Math.max(1, parseInt(packN.value, 10) || 1);
          const q = Math.max(1, parseInt(qty.value, 10) || 1);
          const need = pn * q;
          const pr = num(price.value);
          needEl.textContent = fmt(need) + unit.value;
          unitEl.textContent = pr ? fmtP(pr / need) + '원' : '-';
        };
        const rekey = () => {
          if (r.kwTouched) return;
          const explicit = r.packTouched ? { n: Math.max(1, parseInt(packN.value, 10) || 1), unit: unit.value } : null;
          kw.value = buildKeywords(ln.name, ln.option, explicit).full;
        };
        packN.addEventListener('input', () => { r.packTouched = true; recalc(); rekey(); });
        unit.addEventListener('change', () => { r.packTouched = true; recalc(); rekey(); });
        qty.addEventListener('input', recalc);
        price.addEventListener('input', recalc);
        kw.addEventListener('input', () => { r.kwTouched = true; });
        recalc();

        const field = (label, node) => h('label', { class: 'cmp-field' }, h('span', { text: label }), node);
        body.appendChild(h('div', { class: 'cmp-crow' },
          chk,
          h('div', null,
            h('div', { class: 'cmp-clamp2', text: ln.name }),
            ln.option ? h('div', { class: 'cmp-opt', text: '옵션: ' + ln.option }) : null,
            h('div', { class: 'cmp-opt', text: pk ? '묶음 개수를 ' + pk.n + pk.unit + '으로 읽었습니다' : '묶음 개수를 읽지 못해 1개로 두었습니다. 맞게 고쳐 주세요' })),
          h('div', { class: 'cmp-fields' },
            field('묶음 개수', packN),
            field('단위', unit),
            field('수량(묶음 수)', qty),
            field('필요 개수', needEl),
            field('쿠팡 금액(원)', price),
            field('개당 가격', unitEl)),
          h('label', { class: 'cmp-kw' }, h('span', { text: '검색어' }), kw)));
      });
    }

    const start = () => {
      const items = [];
      rows.forEach((r) => {
        if (!r.chk.checked) return;
        const q = Math.max(1, parseInt(r.qty.value, 10) || 1);
        const pn = Math.max(1, parseInt(r.packN.value, 10) || 1);
        const need = pn * q;
        const total = num(r.price.value);
        const keyword = r.kw.value.trim() || buildKeywords(r.ln.name, r.ln.option, r.pk).full;
        const kws = buildKeywords(r.ln.name, r.ln.option, r.pk);
        items.push({
          name: r.ln.name,
          option: r.ln.option,
          qty: q,
          packN: pn,
          packUnit: r.unit.value,
          packExplicit: !!r.packTouched,
          needUnits: need,
          cpTotal: total,
          cpUnitPrice: total ? total / need : 0,
          keyword,
          fullKeyword: keyword,
          broadKeyword: kws.broad,
          relWords: hangulWords(r.ln.name),
          broadened: false,
          st: null,
          gm: null,
        });
      });
      if (!items.length) { showMsg('비교할 물품을 하나 이상 선택하세요'); return; }
      const state = { version: 2, items, site: 'st', idx: 0, startedAt: Date.now(), sortLow: false, pendingCandidate: null, redo: false, resume: null, notice: '' };
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
  // 요약 모달 (산출기초조사서 형태)
  // ------------------------------------------------------------------
  const pickAmt = (p) => (p && !p.skipped ? p.total || 0 : 0);
  const pickUnit = (p) => (p && !p.skipped && typeof p.unitPrice === 'number' ? p.unitPrice : null);

  function buildTsv(s) {
    const clean = (t) => String(t == null ? '' : t).replace(/[\t\r\n]+/g, ' ').trim();
    const unitCell = (p) => { const u = pickUnit(p); return u == null ? '' : Math.round(u); };
    const amtCell = (p) => (p && !p.skipped && p.total ? p.total : '');
    const lines = [['품명', '수량', '쿠팡 단가', '쿠팡 금액', '11번가 단가', '11번가 금액', 'G마켓 단가', 'G마켓 금액'].join('\t')];
    let a = 0, b = 0, c = 0;
    s.items.forEach((it) => {
      a += it.cpTotal || 0; b += pickAmt(it.st); c += pickAmt(it.gm);
      lines.push([
        clean(it.name + (it.option ? ' (' + it.option + ')' : '')),
        it.needUnits,
        it.cpUnitPrice ? Math.round(it.cpUnitPrice) : '',
        it.cpTotal || '',
        unitCell(it.st), amtCell(it.st),
        unitCell(it.gm), amtCell(it.gm),
      ].join('\t'));
    });
    lines.push(['합계', '', '', a, '', b, '', c].join('\t'));
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

    // 한 사이트의 단가·금액 칸을 tr에 붙인다
    const addSiteCells = (tr, it, i, site) => {
      const p = it[site];
      const redo = h('button', { class: 'cmp-btn cmp-small', style: 'margin-top:4px', text: SITE_NAME[site] + ' 다시', onclick: () => startRedo(i, site) });
      if (p === null || p === undefined) {
        tr.appendChild(h('td', { class: 'cmp-r cmp-gray', colspan: '2' }, '미진행', h('br'), redo));
        return false;
      }
      if (p.skipped) {
        tr.appendChild(h('td', { class: 'cmp-r cmp-gray', colspan: '2' }, '-', h('br'), redo));
        return false;
      }
      const cpu = it.cpUnitPrice || 0;
      const up = pickUnit(p);
      const bad = up != null && cpu > 0 && up <= cpu + 1e-9;
      const unitTd = h('td', { class: 'cmp-r cmp-nw' + (bad ? ' cmp-bad' : '') });
      if (up != null) {
        unitTd.appendChild(h('b', { text: fmtP(up) + '원' }));
        if (cpu > 0) {
          const d = Math.round((up / cpu - 1) * 1000) / 10;
          unitTd.appendChild(h('span', { class: 'cmp-sub' + (bad ? ' cmp-bad' : ''), text: bad ? '▼ 쿠팡 이하 (' + (d > 0 ? '+' : '') + d + '%)' : '쿠팡보다 +' + d + '%' }));
        }
      } else if (p.unitPrice === null) {
        unitTd.appendChild(h('span', { class: 'cmp-gray', text: '단위 다름' }));
      } else {
        unitTd.appendChild(h('span', { class: 'cmp-gray', text: '-' }));
      }
      const sub = h('span', { class: 'cmp-sub' });
      if (p.url && /^https:\/\//.test(p.url)) sub.appendChild(h('a', { href: p.url, target: '_blank', rel: 'noopener', text: shortName(p.title, 40) }));
      else sub.appendChild(document.createTextNode(shortName(p.title, 40)));
      if (p.option) sub.appendChild(h('span', { text: '옵션: ' + p.option }));
      if (p.packN) sub.appendChild(h('span', { text: '묶음 ' + packText(p.packN, p.packUnit || '개') + ' × ' + (p.qty || 0) + '개 담음' }));
      else if (p.qty && p.qty !== it.qty) sub.appendChild(h('span', { class: 'cmp-bad', text: '담은 수량 ' + p.qty + '개 (필요 ' + it.qty + '개)' }));
      if (typeof p.units === 'number' && p.units !== it.needUnits) sub.appendChild(h('span', { class: 'cmp-bad', text: '담은 총 ' + fmt(p.units) + (it.packUnit || '개') + ' (필요 ' + fmt(it.needUnits) + ')' }));
      if (p.shipping) sub.appendChild(h('span', { text: '배송비 ' + p.shipping }));
      tr.appendChild(unitTd);
      tr.appendChild(h('td', { class: 'cmp-r' }, h('b', { text: p.total ? fmt(p.total) + '원' : '0원' }), sub, redo));
      return bad;
    };

    const body = h('div', null);
    const head1 = h('tr', null,
      h('th', { rowspan: '2', text: '품명' }), h('th', { rowspan: '2', text: '수량' }),
      h('th', { colspan: '2', text: '쿠팡' }), h('th', { colspan: '2', text: '11번가' }), h('th', { colspan: '2', text: 'G마켓' }));
    const head2 = h('tr', null);
    [0, 1, 2].forEach(() => { head2.appendChild(h('th', { text: '단가(개당)' })); head2.appendChild(h('th', { text: '금액' })); });
    const tbody = h('tbody', null);
    let a = 0, b = 0, c = 0;
    s.items.forEach((it, i) => {
      a += it.cpTotal || 0; b += pickAmt(it.st); c += pickAmt(it.gm);
      const tr = h('tr', null);
      const nameTd = h('td', null,
        h('div', { class: 'cmp-clamp2', text: shortName(it.name, 60) }),
        it.option ? h('span', { class: 'cmp-sub', text: '옵션: ' + it.option }) : null);
      const qtySub = (it.packN > 1 || it.qty > 1) ? h('span', { class: 'cmp-sub', text: '(' + packText(it.packN, it.packUnit) + ' × ' + it.qty + ')' }) : null;
      tr.appendChild(nameTd);
      tr.appendChild(h('td', { class: 'cmp-r cmp-nw' }, h('b', { text: fmt(it.needUnits) + it.packUnit }), qtySub));
      tr.appendChild(h('td', { class: 'cmp-r cmp-nw', text: it.cpUnitPrice ? fmtP(it.cpUnitPrice) + '원' : '-' }));
      tr.appendChild(h('td', { class: 'cmp-r', text: it.cpTotal ? fmt(it.cpTotal) + '원' : '-' }));
      const badSites = [];
      if (addSiteCells(tr, it, i, 'st')) badSites.push(SITE_NAME.st);
      if (addSiteCells(tr, it, i, 'gm')) badSites.push(SITE_NAME.gm);
      if (badSites.length) nameTd.appendChild(h('span', { class: 'cmp-sub cmp-bad', text: '▼ ' + badSites.join('·') + ' 개당 가격이 쿠팡 이하 - 다시 고르세요' }));
      tbody.appendChild(tr);
    });
    tbody.appendChild(h('tr', { class: 'cmp-sum' },
      h('td', { text: '합계' }), h('td', { text: '' }),
      h('td', { text: '' }), h('td', { class: 'cmp-r', text: fmt(a) + '원' }),
      h('td', { text: '' }), h('td', { class: 'cmp-r', text: fmt(b) + '원' }),
      h('td', { text: '' }), h('td', { class: 'cmp-r', text: fmt(c) + '원' })));

    if (s.site !== 'done') {
      body.appendChild(h('div', { class: 'cmp-msg cmp-warn', style: 'display:block;margin-bottom:8px', text: '아직 진행 중입니다: ' + SITE_NAME[s.site] + ' ' + (s.idx + 1) + '/' + s.items.length + '번째 품목.' }));
    }
    body.appendChild(h('div', { style: 'overflow-x:auto' }, h('table', { class: 'cmp-table' }, h('thead', null, head1, head2), tbody)));
    body.appendChild(h('div', { class: 'cmp-hint', text: '합계는 기록된 품목만 더한 값입니다. 건너뛰었거나 미진행인 품목이 있으면 쿠팡 합계와 단순 비교하지 마세요. 단가는 1쌍 = 2개로 환산한 개당 가격입니다.' }));
    body.appendChild(h('div', { class: 'cmp-hint', text: '빨간 표시는 개당 가격이 쿠팡과 같거나 쿠팡보다 싼 경우입니다(비교견적은 쿠팡보다 비싸야 합니다). 장바구니 화면을 캡처해 견적서로 쓰세요.' }));
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
  // 패널 / 알약 버튼
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
        dock.appendChild(h('div', { class: 'cmp-msg cmp-err', style: 'display:block;position:fixed;right:12px;bottom:12px;z-index:2147483600', text: '비교견적 도우미 오류: ' + errMsg(e) }));
      } catch (e2) { /* 포기 */ }
    }
  }

  function renderPanel(dock, state, pg, isSearch) {
    const item = state.items[state.idx];
    const kindKey = isSearch ? 'search' : 'product';
    const side = uiPref.side[kindKey] === 'left' ? 'left' : 'right';
    const panel = h('div', { id: 'cmp-panel', class: side === 'left' ? 'cmp-left' : '' });
    const msg = h('div', { class: 'cmp-msg', id: 'cmp-msg' });
    const setMsg = (t, kind) => {
      msg.textContent = t || '';
      msg.className = 'cmp-msg' + (kind ? ' cmp-' + kind : '');
      msg.style.display = t ? 'block' : 'none';
    };
    const guard = (fn) => function () {
      try { return fn.apply(this, arguments); } catch (e) { setMsg('오류: ' + errMsg(e), 'err'); }
    };

    panel.appendChild(h('div', { class: 'cmp-head' },
      h('b', { class: 'cmp-title', text: SITE_NAME[state.site] + ' 비교견적 ' + (state.idx + 1) + '/' + state.items.length + (state.redo ? ' (다시 고르기)' : '') }),
      h('span', { class: 'cmp-row2' },
        h('button', { class: 'cmp-btn cmp-small', text: side === 'left' ? '오른쪽으로 ▶' : '◀ 왼쪽으로', title: '패널이 사이트 화면을 가리면 반대쪽으로 옮기세요', onclick: () => { uiPref.side[kindKey] = side === 'left' ? 'right' : 'left'; saveUi(); renderAll(); } }),
        h('button', { class: 'cmp-btn cmp-small', text: '접기', onclick: () => { uiPref.collapsed = true; saveUi(); renderAll(); } }))));
    panel.appendChild(h('div', { class: 'cmp-name cmp-clamp2', text: item.name + (item.option ? ' (' + item.option + ')' : '') }));
    panel.appendChild(h('div', { class: 'cmp-meta', text:
      '필요 ' + packText(item.needUnits, item.packUnit) + ' (' + packText(item.packN, item.packUnit) + ' × ' + item.qty + ') · 쿠팡 ' + fmt(item.cpTotal) + '원 · ' + perLabel(item.packUnit) + ' ' + (item.cpUnitPrice ? fmtP(item.cpUnitPrice) + '원' : '-') }));
    panel.appendChild(msg);

    try {
      if (isSearch) buildSearchBody(panel, state, item, setMsg, guard);
      else buildProductBody(panel, state, item, setMsg, guard);
    } catch (e) {
      setMsg('화면을 만드는 중 오류: ' + errMsg(e), 'err');
    }

    dock.appendChild(panel);
  }

  // ---- 검색 페이지 패널 ----
  function buildSearchBody(panel, state, item, setMsg, guard) {
    const site = state.site;
    const cpu = item.cpUnitPrice || 0;

    if (state.notice) {
      setMsg(state.notice, 'warn');
      const s0 = loadState();
      if (s0) { s0.notice = ''; saveState(s0); }
    }

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

    // 쿠팡보다 비싼 것만 보기 (선택이 기억된다)
    const statEl = h('div', { class: 'cmp-meta' });
    const onlyChk = h('input', { type: 'checkbox', checked: !!uiPref.onlyHigher });
    panel.appendChild(h('label', { class: 'cmp-row2', style: 'cursor:pointer' }, onlyChk, h('span', { style: 'font-weight:700', text: '쿠팡보다 비싼 것만 보기' })));
    panel.appendChild(statEl);

    const list = h('div', { class: 'cmp-list' }, h('div', { class: 'cmp-empty', text: '상품을 불러오는 중입니다…' }));
    panel.appendChild(list);

    panel.appendChild(h('div', { class: 'cmp-btns' },
      h('button', { class: 'cmp-btn', text: '이 상품 건너뛰기', onclick: guard(skipCurrent) }),
      h('button', { class: 'cmp-btn', text: '요약 보기', onclick: guard(showSummary) })));

    const pick = guard((c) => {
      const s = loadState();
      s.pendingCandidate = {
        url: c.url, shipping: c.shipping, title: c.title, price: c.price, image: c.image || '',
        packN: c.pack ? c.pack.n : null, packUnit: c.pack ? c.pack.unit : null, site: s.site, idx: s.idx,
      };
      saveState(s);
      location.href = c.url;
    });

    const candNode = (c) => {
      const lines = [];
      const priceLine = h('div', { class: 'cmp-cand-m' }, h('b', { text: c.price ? fmt(c.price) + '원' : '가격 미확인' }), c.shipping ? h('span', { class: 'cmp-ship', text: ' · 배송비 ' + c.shipping }) : null);
      lines.push(priceLine);
      // 묶음 표시
      let packLine;
      if (c.conv) packLine = '묶음 ' + (c.conv.conv ? packText(c.conv.n, item.packUnit) + '(환산)' : packText(c.pack.n, c.pack.unit));
      else if (c.pack) packLine = '묶음 ' + packText(c.pack.n, c.pack.unit) + ' · 단위 다름';
      else packLine = '묶음 개수 확인 필요';
      const s1 = h('div', { class: 'cmp-cand-s' }, packLine);
      lines.push(s1);
      if (c.unitPrice != null) {
        const s2 = h('div', { class: 'cmp-cand-s' }, h('b', { text: perLabel(item.packUnit) + ' ' + fmtP(c.unitPrice) + '원' }));
        if (c.diffPct != null) {
          const d = Math.round(c.diffPct * 10) / 10;
          s2.appendChild(document.createTextNode(' (쿠팡 대비 '));
          s2.appendChild(h('span', { class: c.rel === 'higher' ? 'cmp-up' : 'cmp-bad', text: (d > 0 ? '+' : '') + d + '%' }));
          s2.appendChild(document.createTextNode(') '));
          if (c.rel === 'lower') s2.appendChild(h('span', { class: 'cmp-badge', text: '쿠팡보다 쌈' }));
          else if (c.rel === 'same') s2.appendChild(h('span', { class: 'cmp-badge', text: '쿠팡과 같음' }));
        }
        lines.push(s2);
        lines.push(h('div', { class: 'cmp-cand-s' }, '필요 ' + c.bundles + '묶음 → 약 ' + fmt(c.estTotal) + '원'));
      }
      const thumb = c.image
        ? h('img', { class: 'cmp-thumb', src: c.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' })
        : h('div', { class: 'cmp-thumb' });
      return h('div', {
        class: 'cmp-cand' + (c.rel === 'lower' ? ' cmp-lower' : ''), role: 'button', tabindex: '0', onclick: () => pick(c),
        onkeydown: (ev) => { if (ev.key === 'Enter') pick(c); },
      }, thumb, h('div', { class: 'cmp-cand-b' }, h('div', { class: 'cmp-cand-t cmp-clamp2', text: c.title }), lines));
    };

    const t0 = Date.now();
    let lastSig = null;
    let lastCands = [];
    let checkOpen = false;
    const draw = () => {
      list.textContent = '';
      if (!lastCands.length) {
        const late = Date.now() - t0 > 15000;
        list.appendChild(h('div', { class: 'cmp-empty', text: late
          ? '관련 상품을 찾지 못했습니다. 다른 검색어로 다시 검색해 보세요. (보안 확인 화면이 보이면 직접 완료해 주세요)'
          : '상품을 불러오는 중입니다…' }));
        statEl.textContent = '';
        return;
      }
      const sp = splitCandidates(lastCands, cpu, !!uiPref.onlyHigher);
      const higher = lastCands.filter((c) => c.rel === 'higher').length;
      statEl.textContent = '관련 후보 ' + lastCands.length + '개 중 쿠팡보다 비싼 것 ' + higher + '개' + (cpu ? '' : ' (쿠팡 금액을 몰라 비교하지 않음)');
      sp.main.forEach((c) => list.appendChild(candNode(c)));
      if (!sp.main.length) {
        list.appendChild(h('div', { class: 'cmp-empty', text: uiPref.onlyHigher ? '쿠팡보다 비싼 후보가 없습니다. 체크를 끄거나 다른 검색어로 찾아 보세요.' : '후보가 없습니다.' }));
      }
      if (sp.check.length) {
        const det = h('details', { class: 'cmp-check' }, h('summary', { text: '개수 확인 필요 (' + sp.check.length + ')' }), h('div', null, sp.check.map(candNode)));
        if (checkOpen) det.open = true;
        det.addEventListener('toggle', () => { checkOpen = det.open; });
        list.appendChild(det);
      }
    };
    onlyChk.addEventListener('change', () => { uiPref.onlyHigher = onlyChk.checked; saveUi(); draw(); });

    const refresh = () => {
      try {
        const cands = evaluateCandidates(parseRawCandidates(site), item);
        const sig = cands.map((x) => x.id + '|' + x.price + '|' + x.shipping + '|' + (x.image ? 1 : 0)).join(',');
        if (sig === lastSig) {
          if (!cands.length) draw(); // 대기 문구 갱신
          return;
        }
        lastSig = sig;
        lastCands = cands;
        draw();
      } catch (e) {
        setMsg('후보를 읽는 중 오류: ' + errMsg(e), 'err');
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
    waitFor(() => parseRawCandidates(site).length > 0, 15000, 500).then(() => refresh());

    // 15초 뒤에도 관련 후보가 3개 미만이고 처음 만든(옵션 포함) 검색어 그대로면, 옵션을 뺀 검색어로 한 번만 다시 검색
    const checkBroaden = () => {
      try {
        const s = loadState();
        const it = s && s.items[s.idx];
        if (!it || s.site !== site) return;
        if (it.broadened || !it.broadKeyword || it.broadKeyword === it.fullKeyword) return;
        if (currentUrlKeyword().trim() !== String(it.fullKeyword || '').trim()) return;
        const rel = evaluateCandidates(parseRawCandidates(site), it).length;
        if (rel >= 3) return;
        it.broadened = true;
        it.keyword = it.broadKeyword;
        s.notice = '검색 결과가 적어 옵션을 빼고 다시 검색했습니다';
        saveState(s);
        location.href = searchUrl(site, it.broadKeyword, currentSortLow());
      } catch (e) {
        setMsg('다시 검색하는 중 오류: ' + errMsg(e), 'err');
      }
    };
    const bt = setTimeout(checkBroaden, 15000);
    addCleanup(() => clearTimeout(bt));
  }

  // ---- 상품 페이지 패널 ----
  function buildProductBody(panel, state, item, setMsg, guard) {
    const site = state.site;
    const api = API[site];
    const cpu = item.cpUnitPrice || 0;
    const canon = api.canon();
    const pc0 = state.pendingCandidate && state.pendingCandidate.url === canon ? state.pendingCandidate : null;
    const ps = { packN: null, packUnit: item.packUnit, from: '', manual: false };
    let ackSig = '';
    let busy = false;
    let adding = false;
    const aguard = (fn) => async function () {
      try { return await fn.apply(this, arguments); } catch (e) { busy = false; setMsg('오류: ' + errMsg(e), 'err'); }
    };

    panel.appendChild(h('div', { class: 'cmp-steps', text: '① 옵션 자동 선택  ② 묶음 개수·수량 확인  ③ 장바구니 담고 다음 →' }));

    // ---- 확인 표시 ----
    const optEl = h('span', { text: '-' });
    const packInput = h('input', { type: 'number', min: '1', 'aria-label': '묶음 개수' });
    const unitSel = h('select', { 'aria-label': '묶음 단위' }, UNIT_CHOICES.map((u) => h('option', { value: u, text: u })));
    unitSel.value = item.packUnit;
    const qtyEl = h('b', { text: '0' });
    const needEl = h('b', { text: '0' });
    const totEl = h('b', { text: '0원' });
    const unitPriceEl = h('b', { text: '-' });
    const cpUnitEl = h('b', { text: cpu ? fmtP(cpu) + '원' : '-' });
    const statusEl = h('div', { class: 'cmp-status', text: '옵션을 확인하는 중…' });

    const detectPack = () => {
      let p = parsePack(api.options(), item.packUnit);
      let from = '선택 옵션';
      if (!p) { p = parsePack(api.title(), item.packUnit); from = '상품명'; }
      if (!p && pc0 && pc0.packN) { p = { n: pc0.packN, unit: pc0.packUnit || '개' }; from = '검색 결과'; }
      // 옵션 글자와 상품명의 묶음 개수가 다르면 알려 준다(예: 상품명 10쌍, 옵션 2개1세트)
      let alt = null;
      if (p && from === '선택 옵션') {
        const tp = parsePack(api.title(), item.packUnit);
        const a = convertPack(p, item.packUnit);
        const b = tp ? convertPack(tp, item.packUnit) : null;
        if (tp && a && b && Math.abs(a.n - b.n) > 1e-9) alt = { packN: tp.n, packUnit: tp.unit };
      }
      return p ? { packN: p.n, packUnit: p.unit, from, alt } : null;
    };
    const applyPack = (d) => {
      if (ps.manual) return;
      if (d) {
        ps.packN = d.packN; ps.packUnit = d.packUnit; ps.from = d.from; ps.alt = d.alt || null;
        if (document.activeElement !== packInput) packInput.value = String(d.packN);
        unitSel.value = d.packUnit;
      } else {
        ps.packN = null; ps.packUnit = item.packUnit; ps.from = ''; ps.alt = null;
        if (document.activeElement !== packInput) packInput.value = '';
        unitSel.value = item.packUnit;
      }
    };
    packInput.addEventListener('input', () => {
      ps.manual = true;
      const n = parseInt(packInput.value, 10);
      ps.packN = n > 0 ? n : null;
      ps.from = '직접 입력';
      live();
    });
    unitSel.addEventListener('change', () => { ps.manual = true; ps.packUnit = unitSel.value; ps.from = '직접 입력'; if (!ps.packN) ps.packN = parseInt(packInput.value, 10) || null; live(); });

    // 현재 화면 값으로 계산
    const calc = () => {
      const conv = ps.packN ? convertPack({ n: ps.packN, unit: ps.packUnit }, item.packUnit) : null;
      const need = conv ? Math.max(1, Math.ceil(item.needUnits / conv.n - 1e-9)) : item.qty;
      const inputs = api.qtyInputs();
      const qty = inputs.length ? sumQty(api) : 1; // 수량 칸이 없는 단일 상품은 1개로 간주
      const total = api.total();
      const units = conv ? qty * conv.n : null;
      const unitPrice = units && total ? total / units : null;
      return { conv, need, inputs, qty, total, units, unitPrice };
    };

    const live = () => {
      try {
        const L = calc();
        const opt = api.options();
        optEl.textContent = opt || '(선택된 옵션 없음)';
        qtyEl.textContent = String(L.qty);
        qtyEl.className = L.qty === L.need ? 'cmp-okt' : 'cmp-bad';
        needEl.textContent = String(L.need);
        totEl.textContent = fmt(L.total) + '원';
        let ut = '-';
        if (L.unitPrice != null) ut = fmtP(L.unitPrice) + '원' + (L.conv && L.conv.conv ? ' (환산)' : '');
        unitPriceEl.textContent = ut;
        let cls = 'cmp-status';
        let t;
        if (!ps.packN) { t = '묶음 개수를 확인하세요 (위 칸에 직접 입력)'; cls += ' cmp-warnst'; }
        else if (!L.conv) { t = '단위 다름 (' + ps.packUnit + ' ≠ ' + item.packUnit + ') - 개당 가격을 비교할 수 없습니다'; cls += ' cmp-warnst'; }
        else if (L.unitPrice == null) { t = '금액을 읽지 못했습니다'; cls += ' cmp-warnst'; }
        else if (!cpu) { t = '쿠팡 금액을 몰라 비교할 수 없습니다'; cls += ' cmp-warnst'; }
        else {
          const d = Math.round((L.unitPrice / cpu - 1) * 1000) / 10;
          if (L.unitPrice > cpu + 1e-9) { t = '쿠팡보다 ' + d + '% 비쌈'; cls += ' cmp-good'; }
          else if (Math.abs(L.unitPrice - cpu) <= 1e-9) { t = '쿠팡과 같은 가격 - 더 비싼 상품을 고르세요'; cls += ' cmp-badst'; }
          else { t = '쿠팡보다 쌈 (' + d + '%) - 다른 상품을 고르세요'; cls += ' cmp-badst'; }
        }
        statusEl.textContent = t;
        statusEl.className = cls;
        if (ps.alt && !ps.manual) {
          altEl.style.display = 'block';
          altTxt.textContent = '상품명에는 ' + packText(ps.alt.packN, ps.alt.packUnit) + ', 옵션에는 ' + packText(ps.packN, ps.packUnit) + '로 적혀 있습니다. 실제 묶음 개수를 확인하세요. ';
        } else {
          altEl.style.display = 'none';
        }
      } catch (e) { /* 무시 */ }
    };

    const altTxt = h('span');
    const altEl = h('div', { class: 'cmp-msg cmp-warn', style: 'display:none' }, altTxt,
      h('button', { class: 'cmp-btn cmp-small', text: '상품명 개수로 바꾸기', onclick: guard(() => {
        if (!ps.alt) return;
        ps.manual = true; ps.packN = ps.alt.packN; ps.packUnit = ps.alt.packUnit; ps.from = '상품명';
        packInput.value = String(ps.packN); unitSel.value = ps.packUnit; ps.alt = null;
        fit(); live();
      }) }));
    const row = (k, ...nodes) => h('div', { class: 'cmp-lr' }, h('span', { class: 'cmp-lk', text: k }), nodes);
    panel.appendChild(h('div', { class: 'cmp-live' },
      row('선택 옵션', optEl),
      row('묶음 개수', packInput, unitSel, h('button', { class: 'cmp-btn cmp-small', text: '수량 다시 맞추기', onclick: guard(() => fit()) })),
      row('넣은 수량', qtyEl, ' / 필요 ', needEl, '묶음'),
      row('총액', totEl),
      row(perLabel(item.packUnit) + ' 가격', unitPriceEl, ' / 쿠팡 ', cpUnitEl),
      statusEl, altEl));

    const doneBox = h('div', { class: 'cmp-donebox' });
    const doneMsg = h('div', { class: 'cmp-msg cmp-ok', style: 'display:block', text: '기록했습니다' });
    const nextBtn = h('button', { class: 'cmp-btn cmp-success', text: '다음 상품 →', onclick: guard(advance) });
    doneBox.appendChild(doneMsg);
    doneBox.appendChild(nextBtn);

    // 수량을 필요 묶음 수로 맞춘다 (선택된 옵션 줄이 하나일 때)
    const fit = () => {
      const L = calc();
      if (!L.inputs.length) { setMsg('옵션을 먼저 고르세요', 'warn'); return false; }
      if (L.inputs.length > 1) { setMsg('옵션이 여러 개면 수량을 직접 나눠 입력하세요(합계 ' + L.need + '묶음)', 'warn'); return false; }
      setQty(L.inputs[0], L.need, api.qtyKey);
      setTimeout(live, 400);
      setTimeout(() => {
        try {
          const cur = sumQty(api);
          if (cur !== L.need) setMsg('수량이 ' + cur + '개로 보입니다(필요 ' + L.need + '). 직접 확인해 주세요', 'warn');
        } catch (e) { /* 무시 */ }
      }, 900);
      return true;
    };

    // 옵션 자동 선택 -> 묶음 개수 읽기 -> 수량 맞추기
    const runAuto = aguard(async () => {
      if (busy) return;
      busy = true;
      setMsg('옵션을 자동으로 고르는 중입니다…', '');
      const warns = [];
      const t0 = Date.now();
      await waitFor(() => api.optionUiExists() || (api.addBtn() && api.qtyInputs().length && Date.now() - t0 > 3000), 15000, 400);
      const target = buildTarget(item.option, item.name, item.packExplicit ? { n: item.packN, unit: item.packUnit } : null);
      const res = site === 'st' ? await stAutoSelect(target, warns) : await gmAutoSelect(target, warns);
      await sleep(400);
      ps.manual = false;
      applyPack(detectPack());
      live();
      const notes = [];
      if (res === 'already') notes.push('이미 선택된 옵션이 있어 옵션은 그대로 두었습니다.');
      else if (res === 'none') notes.push('고를 옵션이 없는 상품으로 보입니다.');
      else if (api.rows().length === 0 && api.optionUiExists()) warns.push('옵션이 선택되지 않았습니다. 직접 골라 주세요');
      if (!ps.packN) warns.push('묶음 개수를 확인하세요');
      const ok = api.qtyInputs().length ? fit() : false;
      if (ok) notes.push('수량을 ' + calc().need + '묶음으로 맞췄습니다.');
      busy = false;
      if (warns.length) setMsg(Array.from(new Set(warns)).join(' / ') + (notes.length ? ' · ' + notes.join(' ') : ''), 'warn');
      else if (notes.length) setMsg(notes.join(' '), 'ok');
      else setMsg('', '');
    });

    // 기록(+장바구니 담기)
    const record = guard((click) => {
      if (adding) return;
      const s = loadState();
      if (!s || !s.items[s.idx]) { setMsg('진행 정보를 읽지 못했습니다', 'err'); return; }
      const it = s.items[s.idx];
      const L = calc();
      if (!L.inputs.length && api.hasOptionSelectors()) { setMsg('옵션을 먼저 고르세요', 'warn'); return; }
      const warns = [];
      if (L.qty !== L.need) warns.push('수량이 ' + L.qty + '개입니다(필요 ' + L.need + '묶음)');
      if (L.unitPrice != null && cpu && L.unitPrice <= cpu + 1e-9) warns.push(perLabel(item.packUnit) + ' 가격이 쿠팡 이하입니다(비교견적은 쿠팡보다 비싸야 합니다)');
      const sig = L.qty + '|' + L.total + '|' + ps.packN + ps.packUnit;
      if (warns.length && ackSig !== sig) {
        ackSig = sig;
        setMsg(warns.join(' / ') + ' - 그대로 진행하려면 한 번 더 누르세요', 'warn');
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
      let image = pc && pc.url === url ? pc.image || '' : '';
      if (!image) { const og = $('meta[property="og:image"]'); image = og ? absImg(og.getAttribute('content')) : ''; }
      it[s.site] = {
        title: api.title(),
        url,
        option: api.options(),
        packN: ps.packN || null,
        packUnit: ps.packUnit || item.packUnit,
        qty: L.qty,
        units: L.units,
        total: L.total,
        unitPrice: L.unitPrice,
        shipping: pc && pc.url === url ? pc.shipping || '' : '',
        image,
        skipped: false,
      };
      saveState(s);
      const notes = [];
      if (click) {
        adding = true;
        btn.click();
        notes.push('기록하고 장바구니 버튼을 눌렀습니다. 담겼는지 사이트 화면에서 확인하세요. 잠시 뒤 다음 상품으로 넘어갑니다.');
        setTimeout(() => { try { advance(); } catch (e) { adding = false; } }, 1500);
      } else {
        notes.push('기록했습니다.');
      }
      if (!L.total) notes.push('금액을 읽지 못해 0원으로 기록됨 - 요약에서 확인하세요.');
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
        if (!busy) applyPack(detectPack());
        live();
        sync();
      } catch (e) { /* 무시 */ }
    };
    applyPack(detectPack());
    live();
    sync();
    const iv = setInterval(tick, 1000);
    addCleanup(() => clearInterval(iv));

    panel.appendChild(h('div', { class: 'cmp-btns' },
      h('button', { class: 'cmp-btn', text: '옵션 다시 자동 선택', onclick: () => runAuto() }),
      h('button', { class: 'cmp-btn cmp-primary', text: '장바구니 담고 다음 →', onclick: () => record(true) }),
      h('button', { class: 'cmp-btn', text: '기록만 하기', onclick: () => record(false) })));
    panel.appendChild(doneBox);
    panel.appendChild(h('div', { class: 'cmp-btns' },
      h('button', { class: 'cmp-btn', text: '검색으로 돌아가기', onclick: guard(() => gotoSearch(loadState())) }),
      h('button', { class: 'cmp-btn', text: '이 상품 건너뛰기', onclick: guard(skipCurrent) }),
      h('button', { class: 'cmp-btn', text: '요약 보기', onclick: guard(showSummary) })));

    // 이 상품 페이지에서 처음 한 번만 자동 실행 (패널을 다시 그려도 반복하지 않는다)
    const autoKey = site + '|' + state.idx + '|' + canon;
    if (ui.autoKey !== autoKey) {
      ui.autoKey = autoKey;
      setTimeout(() => runAuto(), 600);
    }
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
