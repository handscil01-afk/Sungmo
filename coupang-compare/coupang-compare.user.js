// ==UserScript==
// @name         쿠팡 비교견적 도우미
// @namespace    https://handscil01-afk.github.io/Sungmo/
// @version      3.0.0
// @description  쿠팡 장바구니 물품을 11번가·G마켓에서 개당 가격으로 비교해, 쿠팡보다 비싼 비교견적용 상품을 장바구니에 담습니다
// @match        https://cart.coupang.com/*
// @match        https://search.11st.co.kr/*
// @match        https://www.11st.co.kr/products/*
// @match        https://buy.11st.co.kr/*
// @match        https://cart.11st.co.kr/*
// @match        https://www.gmarket.co.kr/n/search*
// @match        https://item.gmarket.co.kr/*
// @match        https://cart.gmarket.co.kr/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      *
// @require      https://handscil01-afk.github.io/Sungmo/coupang-compare/vendor/html-to-image.js
// @run-at       document-idle
// @updateURL    https://handscil01-afk.github.io/Sungmo/coupang-compare/coupang-compare.user.js
// @downloadURL  https://handscil01-afk.github.io/Sungmo/coupang-compare/coupang-compare.user.js
// ==/UserScript==

/*
 * [사용법 - 3.0]
 * 1) 쿠팡 장바구니(cart.coupang.com)에서 오른쪽 아래 "비교견적 시작"을 누릅니다.
 *    물품마다 "품명(깔끔한 이름)", "묶음 개수(예: 24개, 10쌍)", "수량(묶음 수)", "쿠팡 금액", "검색어"가 자동으로 채워집니다. 필요하면 고치세요.
 *    - 품명은 쿠팡 상품명에서 상표·꾸밈말을 뺀 이름입니다(예: "베픽스 충격흡수 군인 무릎 팔꿈치 보호대 세트" -> "무릎 팔꿈치 보호대 세트").
 *      검색어와 관련 상품 판별, 요약표의 품명 칸에 쓰입니다.
 *    - 필요 개수 = 묶음 개수 × 수량, 개당 가격 = 쿠팡 금액 ÷ 필요 개수 (1쌍 = 2개로 환산합니다).
 *    - 검색어는 "품명 + 옵션 + 묶음 개수"입니다. 결과가 너무 적으면 15초 뒤 옵션을 뺀 검색어로 한 번 자동 재검색합니다.
 *    - 검색 화면에서 사이트 검색창으로 검색어를 직접 고쳐 검색하면, 그 검색어를 기억해 G마켓과 "다시"에서도 씁니다.
 * 2) "11번가부터 시작"(직접 고르기) 또는 "자동으로 전부 담기"(자동)를 누릅니다.
 *    [직접 고르기] 오른쪽 패널에 사진·개당 가격이 붙은 후보가 나옵니다.
 *    - 기본은 "쿠팡보다 비싼 것만 보기"(개당 가격이 쿠팡보다 높은 것, 낮은 가격 순)입니다. 체크를 끄면 전부 보입니다.
 *    - 상품명에 개수가 없는 후보는 1세트/1개로 보고 계산합니다("1세트로 봄"). "2인", "3종"은 개수가 아닙니다.
 *      그래도 알 수 없는 상품은 "개수 확인 필요" 목록에 따로 모입니다.
 *    - 후보를 누르면 상품 페이지가 열리고, 쿠팡 옵션(색상·크기·묶음 개수)과 가장 비슷한 옵션을 자동으로 고른 뒤
 *      필요한 개수에 맞게 수량을 자동으로 넣습니다. "옵션 다시 자동 선택", "수량 다시 맞추기"로 다시 할 수 있습니다.
 *    - "장바구니 담고 다음 →"을 누르면 기록 후 장바구니에 담고 1.5초 뒤 다음 상품으로 넘어갑니다.
 *      개당 가격이 쿠팡 이하이면 경고가 먼저 나오며, 한 번 더 눌러야 진행합니다. 11번가가 끝나면 같은 방식으로 G마켓을 진행합니다.
 *    [자동으로 전부 담기] 검색 결과가 안정되면(2초 변화 없음, 최대 15초) 검색어 관련도가 높은 후보 중
 *    쿠팡보다 비싼 것(차이가 가장 작은 것)을 골라 상품 페이지에서 옵션·수량을 맞춘 뒤 장바구니에 담고 다음 품목으로 넘어갑니다.
 *    - 옵션 경고, 개당 가격 불명, 쿠팡 이하, 수량 불일치, 장바구니 버튼 없음이면 그 상품은 버리고 같은 검색의 다음 후보를 고릅니다(품목·사이트당 최대 3번).
 *      3번 모두 실패하면 "자동 실패 - 직접 고르세요"로 기록하고 넘어갑니다. 요약에서 "다시"로 직접 고르세요.
 *    - 패널 위쪽 "자동 진행 중…" 줄의 빨간 "자동 멈춤" 버튼으로 언제든 멈추고 직접 이어갈 수 있습니다.
 *    - 보안 확인(Cloudflare 등) 화면이 나오면 20초 뒤 안내가 뜹니다. 직접 통과하면 자동으로 이어집니다.
 * 3) 끝나면 쿠팡·11번가·G마켓 비교표(품명·수량·단가·금액)가 나옵니다. "표 복사"로 엑셀·한글에 붙여 넣으세요.
 * 4) 견적서 캡처: 요약의 "쿠팡 장바구니 열고 캡처" 등을 누르면 장바구니가 새 탭으로 열리고, 저장할 영역(파란 테두리)이 표시됩니다.
 *    "이 영역 저장"을 누르면 PNG 그림 파일로 내려받습니다. 영역이 다르면 "다른 영역 고르기"(마우스로 고르기, ↑↓ 키로 바깥/안쪽, Esc 취소)나
 *    "전체 페이지 저장"을 쓰세요. 장바구니 화면 오른쪽 아래 "견적서 캡처" 버튼으로도 언제든 시작할 수 있습니다.
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
  const OPTION_DROP = new Set(['free', '프리', '프리사이즈', '단품', '기본', '선택안함']);
  function optionWords(option) {
    return stripCounts(option).replace(/선택\s*안\s*함/g, ' ').replace(/[()\[\]{}]/g, ' ').split(/[\s,\/]+/).map(cleanWord)
      .filter((w) => w && !/^\d+$/.test(w) && w !== '옵션' && !OPTION_DROP.has(w.toLowerCase())).slice(0, 3);
  }
  // pack: 상품명·옵션에서 실제로 읽은 묶음(없으면 null). 2개 이상일 때만 검색어에 넣는다
  // pname: 품명(cleanName 결과 또는 사용자가 고친 값). 있으면 상품명 대신 품명의 낱말을 핵심어로 쓴다
  function buildKeywords(name, option, pack, pname) {
    const pw = pname ? pnameWords(pname).slice(0, 5) : [];
    const core = pw.length ? pw : coreWords(name, 3);
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

  // ---- 품명(깔끔한 이름) ----
  // 꾸밈말: 품명에서 뺀다
  const NAME_MODIFIERS = new Set(['충격흡수', '다이어트', '입문용', '군인', '군용', '고급', '프리미엄', '국산', '국내산', '대용량', '초경량', '경량',
    '남녀공용', '남녀', '휴대용', '가정용', '업소용', '미끄럼방지', '논슬립', '두꺼운', '신형', '정품', '인기', '베스트', '특가', '고탄력', '고강도',
    '튼튼한', '저자극', '무료배송', '당일발송', '1+1', '신상', '최신형', '대형', '소형', '중형', '실내용', '야외용', '학교', '체육대회', '운동회',
    '행사용', '단체', '단체용']);
  // 낱말이 3개일 때 첫 낱말이 이런 일반 낱말이면 상표가 아니라고 보고 남긴다
  const GENERIC_FIRST = new Set(['스포츠', '운동', '야외', '실내', '일회용', '접이식', '투명', '종이', '플라스틱', '스테인리스', '실리콘', '미니', '일반',
    '기본', '나무', '철제', '고무', '유리', '전동', '무선', '자동', '수동', '안전', '방수', '컬러', '사무용', '청소', '주방', '욕실', '어린이', '성인',
    '아동', '유아', '초등', '남성', '여성', '어른', '야구', '축구', '농구', '배드민턴', '탁구', '줄넘기', '손목', '무릎', '팔꿈치', '발목']);
  // 쿠팡 상품명 -> 품명: 첫 쉼표 앞, [..] (..) {..} 【..】 제거, 꾸밈말·숫자/크기 제거, 상표(첫 낱말) 제거, 뒤쪽 최대 4낱말
  function cleanName(name) {
    const raw = String(name == null ? '' : name);
    let head = raw.split(',')[0];
    if (!stripBrackets(head)) head = raw;
    let ws = stripBrackets(head).split(' ').map(cleanWord).filter(Boolean);
    ws = ws.filter((w) => !NAME_MODIFIERS.has(w) && !isNumberOrSizeWord(w));
    const seen = {};
    ws = ws.filter((w) => { const k = w.toLowerCase(); if (seen[k]) return false; seen[k] = true; return true; });
    if (ws.length >= 4 || (ws.length === 3 && !GENERIC_FIRST.has(ws[0]))) ws = ws.slice(1);
    ws = ws.slice(-4);
    return ws.join(' ') || coreWords(raw, 3).join(' ') || stripBrackets(head);
  }
  function pnameWords(pname) {
    return String(pname == null ? '' : pname).split(/\s+/).map(cleanWord).filter(Boolean);
  }
  // 자동 고르기용 관련도 낱말: 품명 낱말 + 검색어 낱말 (2자 이상, 개수·크기 표기 제외)
  function relWordsOf(item) {
    const out = [];
    const add = (w) => {
      w = cleanWord(w);
      if (!w || w.length < 2 || isNumberOrSizeWord(w) || out.indexOf(w) >= 0) return;
      out.push(w);
    };
    pnameWords(item && item.pname ? item.pname : cleanName(item && item.name)).forEach(add);
    String(item && item.keyword ? item.keyword : '').split(/\s+/).forEach(add);
    return out;
  }
  // 제목에 낱말이 몇 개 들어 있는지 (띄어쓰기·대소문자 무시)
  function relScore(title, words) {
    const a = String(title == null ? '' : title).replace(/\s+/g, '').toLowerCase();
    let n = 0;
    (words || []).forEach((w) => { if (w && a.indexOf(String(w).replace(/\s+/g, '').toLowerCase()) >= 0) n++; });
    return n;
  }
  // 자동 고르기: 이미 해 본 주소(tried)를 빼고, 관련도가 가장 높은 층(없으면 한 단계 아래 층)에서
  // 쿠팡보다 비싼(rel === 'higher') 후보 중 차이(diffPct)가 가장 작은 것
  function autoPickCandidate(cands, words, tried) {
    const skip = {};
    (tried || []).forEach((u) => { skip[u] = true; });
    const pool = (cands || []).filter((c) => c && c.url && !skip[c.url]).map((c) => ({ c, score: relScore(c.title, words) }));
    if (!pool.length) return null;
    const max = Math.max.apply(null, pool.map((x) => x.score));
    for (const th of [max, max - 1]) {
      const hi = pool.filter((x) => x.score >= th && x.c.rel === 'higher' && x.c.diffPct > 0);
      if (hi.length) {
        hi.sort((a, b) => (a.c.diffPct - b.c.diffPct) || (b.score - a.score) || ((a.c.price || 0) - (b.c.price || 0)));
        return { cand: hi[0].c, score: hi[0].score };
      }
    }
    return null;
  }
  // 상품명에 개수가 없을 때 1묶음으로 볼지: 세트·팩 단위이거나 쿠팡 묶음이 2 이하, 또는 쿠팡에도 개수 표기가 없던 낱개 상품
  function assumeSingle(item) {
    if (!item) return false;
    const u = item.packUnit;
    return u === '세트' || u === '팩' || (item.packN > 0 && item.packN <= 2) || (!item.packExplicit && item.packN === 1);
  }
  // "1세트로 봄", "1개로 봄", "1묶음으로 봄" (받침에 맞춰 로/으로)
  function assumedLabel(unit) {
    const u = String(unit || '개');
    const code = u.charCodeAt(u.length - 1);
    let josa = '로';
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const jong = (code - 0xAC00) % 28;
      if (jong !== 0 && jong !== 8) josa = '으로';
    }
    return '1' + u + josa + ' 봄';
  }
  // 11번가 카드의 배송비 값("3,000원", "무료")
  function shipFromValue(t) {
    t = String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
    if (!t) return '';
    if (/조건|이상/.test(t)) return t.slice(0, 18);
    if (/무료/.test(t)) return '무료';
    const m = t.match(/([\d,]+)\s*원/);
    return m ? m[1] + '원' : '';
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
    let pack = parsePack(c.title, item.packUnit);
    // 상품명에 개수가 없으면 1묶음으로 본다(세트·팩 단위, 쿠팡 묶음 2 이하, 쿠팡도 개수 표기가 없던 낱개 상품). "2인", "3종"은 개수가 아니다
    if (!pack && assumeSingle(item)) pack = { n: 1, unit: item.packUnit, assumed: true };
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
    if (!it.pname) it.pname = cleanName(it.name); // 2.x 상태: 품명이 없으면 만든다
    if (!Array.isArray(it.relWords)) it.relWords = hangulWords(it.pname || it.name);
    if (!it.tried || typeof it.tried !== 'object') it.tried = { st: [], gm: [] };
    if (!Array.isArray(it.tried.st)) it.tried.st = [];
    if (!Array.isArray(it.tried.gm)) it.tried.gm = [];
    if (typeof it.kwManual !== 'boolean') it.kwManual = false; // 사용자가 사이트 검색창에서 직접 고친 검색어인가
    return it;
  }
  function loadState() {
    try {
      const v = GM_getValue(KEY, '');
      if (!v) return null;
      const s = typeof v === 'string' ? JSON.parse(v) : v;
      if (!(s && Array.isArray(s.items))) return null;
      s.items.forEach(normItem);
      s.auto = !!s.auto;
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
    if (host === 'buy.11st.co.kr' || host === 'cart.11st.co.kr') return { site: 'st', kind: 'st-cart' };
    if (/11st\.co\.kr$/.test(host)) return { site: 'st', kind: 'st-other' };
    if (host === 'www.gmarket.co.kr' && path.indexOf('/n/search') === 0) return { site: 'gm', kind: 'gm-search' };
    if (host === 'item.gmarket.co.kr') return { site: 'gm', kind: 'gm-product' };
    if (host === 'cart.gmarket.co.kr') return { site: 'gm', kind: 'gm-cart' };
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
        // 배송비: 카드의 배송비 칸(.c-card-item__price-delivery .value)을 먼저, 없으면 카드 글자에서 찾는다
        const ship = shipFromValue(txt($('.c-card-item__price-delivery .value', card))) || shipFromText(card.innerText || card.textContent);
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
    s.adding = null;
    if (s.redo) {
      s.redo = false;
      s.auto = false;
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
    s.auto = false; // 모두 끝나면 자동 진행도 끝
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
    s.items[i].tried[site] = []; // 검색어(keyword)는 되돌리지 않고 그대로 쓴다
    s.auto = false; // 다시 고르기는 직접 고른다
    s.pendingCandidate = null;
    saveState(s);
    gotoSearch(s);
  }

  // ------------------------------------------------------------------
  // 자동 진행 도우미 ("자동으로 전부 담기")
  // ------------------------------------------------------------------
  const SECURITY_MSG = '보안 확인 화면이면 직접 통과해 주세요. 통과하면 자동으로 이어집니다';
  const AUTO_MAX_TRIES = 3; // 품목·사이트마다 상품 페이지를 열어 보는 최대 횟수
  const normKw = (t) => String(t == null ? '' : t).replace(/\s+/g, ' ').trim();

  // 패널의 메시지 줄에 글을 띄운다(패널이 다시 그려져도 마지막 패널로 간다)
  function panelSay(t, kind) {
    try { if (ui.setMsg) ui.setMsg(t, kind); } catch (e) { /* 무시 */ }
  }
  // "자동 진행 중…" 줄의 작은 설명 글
  function autoDetail(text, warn) {
    ui.autoDetail = text || '';
    ui.autoWarn = !!warn;
    const e = document.getElementById('cmp-auto-detail');
    if (e) { e.textContent = ui.autoDetail; e.className = 'cmp-autodetail' + (warn ? ' cmp-autowarn' : ''); }
  }
  // 이 흐름(tok)이 아직 유효한가: 자동 멈춤을 눌렀거나 다른 흐름이 시작됐으면 false
  function autoAlive(tok) {
    if (tok !== ui.autoTok) return false;
    const s = loadState();
    return !!(s && s.auto);
  }
  // cond()가 참값을 줄 때까지 기다린다. 20초가 지나면 보안 확인 안내를 띄우고 계속 기다린다(실패로 보지 않음). 흐름이 끝나면 null
  async function autoWait(cond, tok, slowMs) {
    const t0 = Date.now();
    let slow = false;
    for (;;) {
      if (!autoAlive(tok)) return null;
      let v = null;
      try { v = cond(); } catch (e) { v = null; }
      if (v) { if (slow) autoDetail(''); return v; }
      if (!slow && Date.now() - t0 >= (slowMs || 20000)) { slow = true; autoDetail(SECURITY_MSG, true); }
      await sleep(500);
    }
  }
  // "검색 결과가 없습니다" 화면인가
  function noResultsText() {
    try {
      const t = ((document.body && document.body.innerText) || '').slice(0, 30000);
      return /검색\s*결과가?\s*(가\s*)?없|일치하는\s*(상품|결과)(이|가)?\s*없|검색\s*결과\s*0\s*건|검색된\s*상품이\s*없/.test(t);
    } catch (e) { return false; }
  }
  // 판매 종료·품절·없는 상품 화면인가 (장바구니 버튼도 옵션도 없을 때만 확인)
  function productGone() {
    try {
      const t = ((document.body && document.body.innerText) || '').slice(0, 30000);
      return /품절|판매\s*종료|판매\s*중지|판매가\s*종료|존재하지\s*않|삭제된\s*상품|페이지를\s*찾을\s*수\s*없|판매\s*기간이\s*종료/.test(t);
    } catch (e) { return false; }
  }

  // 후보를 눌렀을 때(직접·자동 공통) 상품 페이지에 넘겨 줄 정보. kw: 그때의 검색어(주소창 값)
  function makePending(s, c) {
    const it = s.items[s.idx];
    return {
      url: c.url, shipping: c.shipping, title: c.title, price: c.price, image: c.image || '',
      packN: c.pack ? c.pack.n : null, packUnit: c.pack ? c.pack.unit : null, site: s.site, idx: s.idx,
      kw: normKw(currentUrlKeyword()) || normKw(it && it.keyword),
    };
  }

  // 사이트 검색창에서 사용자가 직접 고친 검색어를 기억한다(자동 재검색으로 바뀐 것은 이미 item.keyword와 같아서 해당 없음)
  function adoptUrlKeyword(state) {
    try {
      const it = state && state.items[state.idx];
      const urlKw = normKw(currentUrlKeyword());
      if (!it || !urlKw || urlKw === normKw(it.keyword)) return false;
      it.keyword = urlKw;
      it.fullKeyword = urlKw;
      it.kwManual = true; // 사용자가 직접 정한 검색어: 자동으로 옵션을 빼고 다시 검색하지 않는다
      saveState(state);
      return true;
    } catch (e) { return false; }
  }

  // 관련 후보가 3개 미만이고 처음 만든(옵션 포함) 검색어 그대로면, 옵션을 뺀 검색어로 한 번만 다시 검색. 이동했으면 true
  function tryBroaden(site) {
    try {
      const s = loadState();
      const it = s && s.items[s.idx];
      if (!it || s.site !== site) return false;
      if (it.broadened || it.kwManual || !it.broadKeyword || it.broadKeyword === it.fullKeyword) return false;
      if (normKw(currentUrlKeyword()) !== normKw(it.fullKeyword)) return false;
      const rel = evaluateCandidates(parseRawCandidates(site), it).length;
      if (rel >= 3) return false;
      it.broadened = true;
      it.keyword = it.broadKeyword;
      s.notice = '검색 결과가 적어 옵션을 빼고 다시 검색했습니다';
      saveState(s);
      location.href = searchUrl(site, it.broadKeyword, currentSortLow());
      return true;
    } catch (e) {
      panelSay('다시 검색하는 중 오류: ' + errMsg(e), 'err');
      return false;
    }
  }

  // 자동 실패로 기록하고 다음으로 넘어간다
  function autoFailSkip(s, reason) {
    const it = s.items[s.idx];
    if (!it) return;
    it[s.site] = { title: '', url: '', option: '', qty: 0, total: 0, shipping: '', skipped: true, autoFail: true, reason: reason || '' };
    saveState(s);
    advance();
  }

  // 자동 멈춤: 이 화면에 그대로 머물며 직접 진행
  function stopAuto() {
    try {
      const s = loadState();
      if (s) { s.auto = false; saveState(s); }
      ui.autoTok++;
      autoDetail('');
    } catch (e) { /* 무시 */ }
    renderAll();
  }

  // 검색 화면의 자동 단계: 결과가 안정되기를 기다린 뒤 후보를 골라 상품 페이지로 간다
  async function runAutoSearch(site, tok) {
    autoDetail('검색 결과를 기다리는 중…');
    const got = await autoWait(() => (parseRawCandidates(site).length > 0 ? 'cards' : (noResultsText() ? 'none' : null)), tok);
    if (!got) return;
    // 2초 동안 후보에 변화가 없을 때까지(최대 15초) 기다린다
    const t0 = Date.now();
    let lastSig = null;
    let lastChange = Date.now();
    while (autoAlive(tok)) {
      const sig = parseRawCandidates(site).map((c) => c.id + '|' + c.price + '|' + c.shipping + '|' + (c.image ? 1 : 0)).join(',');
      if (sig !== lastSig) { lastSig = sig; lastChange = Date.now(); }
      if (Date.now() - lastChange >= 2000 || Date.now() - t0 >= 15000) break;
      await sleep(500);
    }
    if (!autoAlive(tok)) return;
    // 결과가 적으면 옵션을 뺀 검색어로 먼저 다시 검색(이동하면 새 화면에서 이어짐)
    if (tryBroaden(site)) { autoDetail('결과가 적어 옵션을 빼고 다시 검색합니다…'); return; }
    const s = loadState();
    if (!s || !s.auto || s.site !== site) return;
    const it = s.items[s.idx];
    if (!it) return;
    const tried = it.tried[site];
    if (tried.length >= AUTO_MAX_TRIES) { autoFailSkip(s, '맞는 상품을 ' + AUTO_MAX_TRIES + '번 확인했지만 찾지 못함'); return; }
    autoDetail('후보를 고르는 중…');
    const cands = evaluateCandidates(parseRawCandidates(site), it);
    const pk = autoPickCandidate(cands, relWordsOf(it), tried);
    if (!pk) { autoFailSkip(s, '후보 없음'); return; }
    tried.push(pk.cand.url);
    s.pendingCandidate = makePending(s, pk.cand);
    saveState(s);
    autoDetail('상품 페이지를 여는 중…');
    location.href = pk.cand.url;
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
#cmp-root .cmp-autobar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px; border-radius: 8px; background: #fef3c7; border: 1px solid #fcd34d; color: #92400e; }
#cmp-root .cmp-autotxt { display: flex; flex-direction: column; min-width: 0; font-size: 13px; }
#cmp-root .cmp-autodetail { font-size: 12px; color: #78350f; word-break: keep-all; }
#cmp-root .cmp-autodetail.cmp-autowarn { color: #b91c1c; font-weight: 700; }
#cmp-root .cmp-stop { background: #dc2626; border-color: #dc2626; color: #fff; white-space: nowrap; font-weight: 700; }
#cmp-root .cmp-stop:hover { background: #b91c1c; }
#cmp-root .cmp-pn { font-weight: 700; }
#cmp-root .cmp-fail { color: #b91c1c; font-weight: 700; }

#cmp-root .cmp-cartbar { position: fixed; right: 16px; bottom: 16px; z-index: 2147483600; display: flex; gap: 8px; align-items: center; }
#cmp-root .cmp-cartbar .cmp-fab { position: static; }
#cmp-root .cmp-capfab { min-height: 44px; padding: 8px 18px; border-radius: 22px; border: none; background: #0f766e; color: #fff; font-size: 15px; font-weight: 700; box-shadow: 0 4px 14px rgba(0,0,0,.3); cursor: pointer; }
#cmp-root .cmp-capfab:hover { background: #115e59; }
#cmp-root .cmp-capfab.cmp-above { position: fixed; right: 12px; bottom: 62px; z-index: 2147483600; }
#cmp-root .cmp-capbox { position: fixed; z-index: 2147483500; border: 3px solid #2563eb; background: rgba(37,99,235,.08); pointer-events: none; box-sizing: border-box; }
#cmp-root .cmp-capbar { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 2147483620; width: min(560px, calc(100vw - 24px)); display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; background: #fff; color: #111827; border: 1px solid #d1d5db; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,.35); font-size: 13px; }
#cmp-root .cmp-toast { position: fixed; left: 50%; top: 16px; transform: translateX(-50%); z-index: 2147483640; max-width: calc(100vw - 32px); padding: 8px 14px; border-radius: 10px; background: #1e293b; color: #fff; font-size: 13px; box-shadow: 0 6px 20px rgba(0,0,0,.35); display: none; }
#cmp-root .cmp-toast.cmp-t-err { background: #b91c1c; }
#cmp-root .cmp-toast.cmp-t-ok { background: #15803d; }
@media (max-width: 600px) { #cmp-root .cmp-table { font-size: 12px; } #cmp-root #cmp-panel { width: calc(100vw - 24px); } }
`);

  // ------------------------------------------------------------------
  // 루트 / 모달
  // ------------------------------------------------------------------
  const ui = { cleanups: [], lastHref: '', autoKey: '', autoTok: 0, autoRunKey: '', autoDetail: '', autoWarn: false, setMsg: null, capAuto: false, addRecover: false };

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
      body.appendChild(h('div', { class: 'cmp-hint', text: '비교할 물품을 확인하세요. 품명은 쿠팡 상품명에서 상표·꾸밈말을 뺀 이름이며 검색어와 관련 상품 판별에 쓰이니 고쳐도 됩니다. 묶음 개수(상품명·옵션에서 읽은 값)와 수량(묶음 수)을 맞게 고치면 필요 개수와 쿠팡 개당 가격이 계산됩니다. 쿠팡 금액은 수량을 바꿔도 자동으로 바뀌지 않으니 이 물품의 합계 금액으로 입력하세요.' }));
      body.appendChild(h('div', { class: 'cmp-hint', text: '"11번가부터 시작"은 후보를 직접 고르고, "자동으로 전부 담기"는 쿠팡보다 비싼 후보를 자동으로 골라 장바구니까지 담습니다(구매·결제는 하지 않으며, 패널의 "자동 멈춤"으로 언제든 멈출 수 있습니다).' }));
      lines.forEach((ln) => {
        const pk = parsePack(ln.option) || parsePack(ln.name); // 옵션에서 읽은 값을 상품명보다 우선
        const pack0 = pk || { n: 1, unit: '개' };
        const pname0 = cleanName(ln.name);
        const kws = buildKeywords(ln.name, ln.option, pk, pname0);
        const chk = h('input', { type: 'checkbox', checked: true });
        const packN = h('input', { type: 'number', min: '1', value: String(pack0.n), 'aria-label': '묶음 개수' });
        const unit = h('select', { 'aria-label': '단위' }, UNIT_CHOICES.map((u) => h('option', { value: u, text: u })));
        unit.value = pack0.unit;
        const qty = h('input', { type: 'number', min: '1', value: String(ln.qty), 'aria-label': '수량(묶음 수)' });
        const price = h('input', { type: 'text', class: 'cmp-wide', value: fmt(ln.cpTotal), 'aria-label': '쿠팡 금액' });
        const kw = h('input', { type: 'text', value: kws.full, 'aria-label': '검색어' });
        const pnameIn = h('input', { type: 'text', value: pname0, 'aria-label': '품명' });
        const needEl = h('b', { text: '' });
        const unitEl = h('b', { text: '' });
        const r = { ln, pk, chk, packN, unit, qty, price, kw, pnameIn, needEl, unitEl, kwTouched: false, packTouched: !!pk };
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
          kw.value = buildKeywords(ln.name, ln.option, explicit, pnameIn.value.trim() || pname0).full;
        };
        pnameIn.addEventListener('input', rekey);
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
          h('label', { class: 'cmp-kw' }, h('span', { text: '품명' }), pnameIn),
          h('label', { class: 'cmp-kw' }, h('span', { text: '검색어' }), kw)));
      });
    }

    const start = (auto) => {
      const items = [];
      rows.forEach((r) => {
        if (!r.chk.checked) return;
        const q = Math.max(1, parseInt(r.qty.value, 10) || 1);
        const pn = Math.max(1, parseInt(r.packN.value, 10) || 1);
        const need = pn * q;
        const total = num(r.price.value);
        const pname = r.pnameIn.value.trim() || cleanName(r.ln.name) || r.ln.name;
        const kws = buildKeywords(r.ln.name, r.ln.option, r.pk, pname);
        const keyword = r.kw.value.trim() || kws.full;
        items.push({
          name: r.ln.name,
          pname,
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
          relWords: hangulWords(pname).length ? hangulWords(pname) : hangulWords(r.ln.name),
          broadened: false,
          kwManual: false,
          tried: { st: [], gm: [] },
          st: null,
          gm: null,
        });
      });
      if (!items.length) { showMsg('비교할 물품을 하나 이상 선택하세요'); return; }
      const state = { version: 3, items, site: 'st', idx: 0, startedAt: Date.now(), sortLow: false, pendingCandidate: null, redo: false, resume: null, notice: '', auto: !!auto, adding: null };
      saveState(state);
      location.href = searchUrl('st', items[0].keyword, false);
    };

    const foot = [
      h('button', { class: 'cmp-btn cmp-primary', text: '11번가부터 시작', disabled: !lines.length, onclick: () => start(false) }),
      h('button', { class: 'cmp-btn cmp-primary', text: '자동으로 전부 담기', disabled: !lines.length, onclick: () => start(true) }),
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
        clean(it.pname || it.name),
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
      if (p.skipped && p.autoFail) {
        tr.appendChild(h('td', { class: 'cmp-r', colspan: '2' },
          h('span', { class: 'cmp-fail', text: '자동 실패 - 직접 고르세요' }),
          p.reason ? h('span', { class: 'cmp-sub cmp-bad', style: 'text-align:right', text: p.reason }) : null,
          redo));
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
        h('div', { class: 'cmp-clamp2 cmp-pn', text: it.pname || shortName(it.name, 60) }),
        h('span', { class: 'cmp-sub', text: shortName(it.name, 60) }), // 쿠팡 상품명 전체(작게)
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
    body.appendChild(h('div', { class: 'cmp-hint', style: 'margin-top:8px', text: '견적서 캡처: 장바구니를 새 탭으로 열고 저장할 영역을 보여 줍니다. 확인 후 "이 영역 저장"을 누르면 그림 파일(PNG)로 내려받습니다.' }));
    body.appendChild(h('div', { class: 'cmp-btns' },
      h('a', { class: 'cmp-btn cmp-primary', href: CART_URL.cp + '#cmp-capture', target: '_blank', rel: 'noopener', text: '쿠팡 장바구니 열고 캡처' }),
      h('a', { class: 'cmp-btn cmp-primary', href: CART_URL.st + '#cmp-capture', target: '_blank', rel: 'noopener', text: '11번가 장바구니 열고 캡처' }),
      h('a', { class: 'cmp-btn cmp-primary', href: CART_URL.gm + '#cmp-capture', target: '_blank', rel: 'noopener', text: 'G마켓 장바구니 열고 캡처' })));

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
        dock.appendChild(h('div', { class: 'cmp-cartbar' },
          h('button', { class: 'cmp-capfab', text: '견적서 캡처', onclick: () => capStart('cp') }),
          h('button', { class: 'cmp-fab', text: '비교견적 시작', onclick: openStartModal })));
        capMaybeAuto(pg);
        return;
      }
      const isSearch = /-search$/.test(pg.kind);
      const isProduct = /-product$/.test(pg.kind);
      if (/-cart$/.test(pg.kind)) {
        dock.appendChild(h('button', { class: 'cmp-capfab cmp-above', text: '견적서 캡처', onclick: () => capStart(pg.site) }));
        capMaybeAuto(pg);
      }
      // 자동 진행 중 장바구니 버튼을 누른 뒤 사이트가 다른 화면으로 이동해 버린 경우: 1.5초 뒤 다음 상품으로 넘어간다
      if (state && state.auto && state.adding && pg.site && state.adding.site === pg.site && state.site === pg.site && state.idx === state.adding.idx
        && /-(other|cart)$/.test(pg.kind) && Date.now() - state.adding.t < 120000 && !ui.addRecover) {
        ui.addRecover = true;
        setTimeout(() => { try { const s2 = loadState(); if (s2 && s2.auto && s2.adding) advance(); } catch (e) { /* 무시 */ } }, 1500);
      }
      const active = !!(state && pg.site && state.site === pg.site && (isSearch || isProduct) && state.items[state.idx]);
      if (active && isSearch) adoptUrlKeyword(state); // 사용자가 사이트 검색창에서 고친 검색어를 기억

      if (active && (!uiPref.collapsed || state.auto)) {
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
    ui.setMsg = setMsg;
    const guard = (fn) => function () {
      try { return fn.apply(this, arguments); } catch (e) { setMsg('오류: ' + errMsg(e), 'err'); }
    };

    panel.appendChild(h('div', { class: 'cmp-head' },
      h('b', { class: 'cmp-title', text: SITE_NAME[state.site] + ' 비교견적 ' + (state.idx + 1) + '/' + state.items.length + (state.redo ? ' (다시 고르기)' : '') }),
      h('span', { class: 'cmp-row2' },
        h('button', { class: 'cmp-btn cmp-small', text: side === 'left' ? '오른쪽으로 ▶' : '◀ 왼쪽으로', title: '패널이 사이트 화면을 가리면 반대쪽으로 옮기세요', onclick: () => { uiPref.side[kindKey] = side === 'left' ? 'right' : 'left'; saveUi(); renderAll(); } }),
        h('button', { class: 'cmp-btn cmp-small', text: '접기', onclick: () => { uiPref.collapsed = true; saveUi(); renderAll(); } }))));
    if (state.auto) {
      panel.appendChild(h('div', { class: 'cmp-autobar' },
        h('span', { class: 'cmp-autotxt' },
          h('b', { text: '자동 진행 중… (' + SITE_NAME[state.site] + ' ' + (state.idx + 1) + '/' + state.items.length + ')' }),
          h('span', { id: 'cmp-auto-detail', class: 'cmp-autodetail' + (ui.autoWarn ? ' cmp-autowarn' : ''), text: ui.autoDetail || '' })),
        h('button', { class: 'cmp-btn cmp-stop', text: '자동 멈춤', onclick: stopAuto })));
    }
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
      const it0 = s.items[s.idx];
      if (normKw(kw) !== normKw(it0.keyword)) {
        it0.fullKeyword = kw; // 사용자가 직접 정한 검색어: G마켓·다시 검색에서도 이 검색어를 쓴다
        it0.kwManual = true;
      }
      it0.keyword = kw;
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
      s.pendingCandidate = makePending(s, c); // 그때의 검색어(kw)도 함께 기억
      saveState(s);
      location.href = c.url;
    });

    const candNode = (c) => {
      const lines = [];
      const priceLine = h('div', { class: 'cmp-cand-m' }, h('b', { text: c.price ? fmt(c.price) + '원' : '가격 미확인' }), c.shipping ? h('span', { class: 'cmp-ship', text: ' · 배송비 ' + c.shipping }) : null);
      lines.push(priceLine);
      // 묶음 표시
      let packLine;
      if (c.conv && c.pack && c.pack.assumed) packLine = assumedLabel(c.pack.unit);
      else if (c.conv) packLine = '묶음 ' + (c.conv.conv ? packText(c.conv.n, item.packUnit) + '(환산)' : packText(c.pack.n, c.pack.unit));
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
    const bt = setTimeout(() => tryBroaden(site), 15000);
    addCleanup(() => clearTimeout(bt));

    // 자동 진행: 이 검색 화면에서 한 번만 시작한다(패널을 다시 그려도 반복하지 않음)
    if (state.auto) {
      const key = 'S|' + site + '|' + state.idx + '|' + normKw(currentUrlKeyword());
      if (ui.autoRunKey !== key) {
        ui.autoRunKey = key;
        const tok = ++ui.autoTok;
        runAutoSearch(site, tok).catch((e) => { autoDetail('자동 진행 중 오류: ' + errMsg(e), true); });
      }
    }
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
      if (!p && assumeSingle(item)) { p = { n: 1, unit: item.packUnit }; from = assumedLabel('묶음'); } // "1묶음으로 봄"
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
      if (busy) return { warns: [], busy: true };
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
      return { warns: Array.from(new Set(warns)), res };
    });

    // 기록(+장바구니 담기)
    // 기록했으면 true (자동 진행은 이 값으로 성공 여부를 안다)
    const record = guard((click) => {
      if (adding) return false;
      const s = loadState();
      if (!s || !s.items[s.idx]) { setMsg('진행 정보를 읽지 못했습니다', 'err'); return false; }
      const it = s.items[s.idx];
      const L = calc();
      if (!L.inputs.length && api.hasOptionSelectors()) { setMsg('옵션을 먼저 고르세요', 'warn'); return false; }
      const warns = [];
      if (L.qty !== L.need) warns.push('수량이 ' + L.qty + '개입니다(필요 ' + L.need + '묶음)');
      if (L.unitPrice != null && cpu && L.unitPrice <= cpu + 1e-9) warns.push(perLabel(item.packUnit) + ' 가격이 쿠팡 이하입니다(비교견적은 쿠팡보다 비싸야 합니다)');
      const sig = L.qty + '|' + L.total + '|' + ps.packN + ps.packUnit;
      if (warns.length && ackSig !== sig) {
        ackSig = sig;
        setMsg(warns.join(' / ') + ' - 그대로 진행하려면 한 번 더 누르세요', 'warn');
        return false;
      }
      let btn = null;
      if (click) {
        btn = api.addBtn();
        if (!btn) { setMsg('장바구니 버튼을 찾지 못했습니다. 직접 담은 뒤 "기록만 하기"를 누르세요', 'err'); return false; }
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
      // 이 상품을 고를 때의 검색어를 기억한다(G마켓·다시 검색에서 이 검색어를 씀)
      if (pc && pc.url === url && pc.kw) { it.keyword = pc.kw; it.fullKeyword = pc.kw; }
      if (click) s.adding = { site: s.site, idx: s.idx, t: Date.now() };
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
      return true;
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

    // ---- 자동 진행(자동으로 전부 담기): 옵션·수량을 맞춘 뒤 조건이 맞으면 담고, 아니면 이 상품을 버리고 같은 검색의 다음 후보로 ----
    const autoProdFail = (reason) => {
      const s = loadState();
      if (!s || !s.auto) return;
      const it = s.items[s.idx];
      if (!it) return;
      const tr = it.tried[s.site];
      if (tr.indexOf(canon) < 0) tr.push(canon);
      autoDetail('이 상품은 쓰지 않습니다 (' + reason + ')', true);
      if (tr.length < AUTO_MAX_TRIES) {
        saveState(s);
        setTimeout(() => { try { const s2 = loadState(); if (s2 && s2.auto) gotoSearch(s2); } catch (e) { /* 무시 */ } }, 900);
        return;
      }
      autoFailSkip(s, '자동으로 맞는 상품을 찾지 못함 (' + reason + ')');
    };
    const autoProductFlow = async (tok) => {
      autoDetail('상품 페이지를 기다리는 중…');
      const ready = await autoWait(() => ((api.addBtn() || api.optionUiExists()) ? 'ok' : (productGone() ? 'gone' : null)), tok);
      if (!ready) return;
      if (ready === 'gone') { autoProdFail('판매 중이 아니거나 장바구니 버튼이 없음'); return; }
      autoDetail('옵션을 고르는 중…');
      const r = (await runAuto()) || { warns: ['옵션을 고르는 중 오류'] };
      if (!autoAlive(tok)) return;
      autoDetail('총액을 확인하는 중…');
      await sleep(1500);
      if (!autoAlive(tok)) return;
      applyPack(detectPack());
      live();
      let L = calc();
      if (L.inputs.length && L.qty !== L.need) { fit(); await sleep(1200); if (!autoAlive(tok)) return; L = calc(); }
      const fails = [];
      if (r.warns && r.warns.length) fails.push('옵션 확인 필요');
      if (L.unitPrice == null) fails.push('개당 가격을 알 수 없음');
      else if (cpu > 0 && L.unitPrice <= cpu + 1e-9) fails.push('개당 가격이 쿠팡 이하');
      if (!(cpu > 0)) fails.push('쿠팡 금액 없음');
      if (L.qty !== L.need) fails.push('수량 불일치');
      if (!api.addBtn()) fails.push('장바구니 버튼 없음');
      if (fails.length) { autoProdFail(fails.join(', ')); return; }
      autoDetail('장바구니에 담는 중…');
      const ok = record(true); // 기록 + 장바구니 버튼(assertSafeCartButton 통과 시에만) 클릭, 1.5초 뒤 다음으로
      if (!ok) autoProdFail('기록·장바구니 담기 실패');
    };

    // 이 상품 페이지에서 처음 한 번만 자동 실행 (패널을 다시 그려도 반복하지 않는다)
    const autoKey = site + '|' + state.idx + '|' + canon;
    if (ui.autoKey !== autoKey) {
      ui.autoKey = autoKey;
      if (state.auto) {
        const tok = ++ui.autoTok;
        setTimeout(() => { autoProductFlow(tok).catch((e) => { autoDetail('자동 진행 중 오류: ' + errMsg(e), true); }); }, 600);
      } else {
        setTimeout(() => runAuto(), 600);
      }
    }
  }

  // ------------------------------------------------------------------
  // 견적서 캡처: 장바구니 화면의 상품 목록·합계 영역을 PNG 그림 파일로 저장
  // (사이트마다 화면 구조가 달라 상품 링크·합계 글자로 영역을 추정하고, 미리 보여 준 뒤 사용자가 확인한다)
  // ------------------------------------------------------------------
  const CAP_LINK_RE = { cp: /\/vp\/products\//, st: /products\/\d+|prdNo=\d+/i, gm: /goodscode=\d+/i };
  const CAP_TOTAL_RE = /(총\s*(상품|주문|결제)\s*(금액|가격)|결제\s*예정\s*금액|주문\s*예상\s*금액|최종\s*결제\s*금액)/;
  const CAP_NOISE_HEAD_RE = /추천|함께|최근\s*본|광고/;
  const CAP_NOISE_ATTR_RE = /recommend|(^|[\s_-])reco([\s_-]|$)|(^|[\s_-])ad[-_]|banner/i;
  const cap = { site: '', target: null, view: null, box: null, bar: null, timer: 0, toastTimer: 0, busy: false, stopPick: null };

  function capHost() {
    const { root } = ensureRoot();
    let host = $('#cmp-cap', root);
    if (!host) { host = h('div', { id: 'cmp-cap' }); root.appendChild(host); }
    return host;
  }
  // 작은 안내창: sticky가 아니면 몇 초 뒤 사라진다
  function capToast(text, kind, sticky) {
    try {
      const host = capHost();
      let t = $('#cmp-cap-toast', host);
      if (!t) { t = h('div', { id: 'cmp-cap-toast', class: 'cmp-toast' }); host.appendChild(t); }
      t.textContent = text;
      t.className = 'cmp-toast' + (kind ? ' cmp-t-' + kind : '');
      t.style.display = 'block';
      clearTimeout(cap.toastTimer);
      if (!sticky) cap.toastTimer = setTimeout(() => { t.style.display = 'none'; }, kind === 'err' ? 10000 : 6000);
    } catch (e) { /* 무시 */ }
  }
  function getH2I() {
    try { if (typeof htmlToImage !== 'undefined' && htmlToImage) return htmlToImage; } catch (e) { /* 아래 대체 */ }
    try { return PW.htmlToImage || window.htmlToImage || null; } catch (e) { return null; }
  }
  function ymd() {
    const d = new Date();
    const p = (n) => (n < 10 ? '0' : '') + n;
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function capAbsUrl(raw) {
    try {
      const t = String(raw == null ? '' : raw).trim();
      if (!t || /^(data|blob|javascript|about):/i.test(t)) return '';
      const u = new URL(t, location.href);
      return /^https?:$/.test(u.protocol) ? u.href : '';
    } catch (e) { return ''; }
  }

  // 머리말·메뉴·바닥글, 추천·광고 영역 안의 요소인가
  function capIsNoise(el) {
    try {
      if (el.closest('#cmp-root')) return true;
      if (el.closest('header, nav, footer, [role="banner"], [role="navigation"], [role="contentinfo"]')) return true;
      let n = el;
      for (let depth = 0; n && n !== document.body && depth < 12; depth++, n = n.parentElement) {
        const cls = typeof n.className === 'string' ? n.className : ((n.className && n.className.baseVal) || '');
        if (CAP_NOISE_ATTR_RE.test(cls + ' ' + (n.id || ''))) return true;
        if (depth < 8) {
          const hd = n.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > header h2, :scope > header h3, :scope > div > h2, :scope > div > h3');
          if (hd) {
            const t = txt(hd);
            if (t.length <= 40 && CAP_NOISE_HEAD_RE.test(t)) return true;
          }
        }
      }
    } catch (e) { /* 무시 */ }
    return false;
  }
  // 장바구니 상품 링크(보이는 것, 추천·광고·머리말 제외)
  function capCartLinks(site) {
    const re = CAP_LINK_RE[site];
    if (!re) return [];
    return $$('a[href]').filter((a) => {
      try {
        if (!re.test(a.getAttribute('href') || '')) return false;
        if (!visible(a) || (a.offsetWidth === 0 && a.offsetHeight === 0)) return false;
        return !capIsNoise(a);
      } catch (e) { return false; }
    });
  }
  // "총 상품금액", "결제예정금액" 같은 글자를 가진 가장 작은 보이는 요소
  function capTotalEl() {
    const found = [];
    try {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let n;
      while ((n = w.nextNode())) {
        const v = n.nodeValue;
        if (!v || v.length > 60 || !CAP_TOTAL_RE.test(v)) continue;
        const el = n.parentElement;
        if (!el || /^(SCRIPT|STYLE|NOSCRIPT|TITLE)$/.test(el.tagName)) continue;
        if (!visible(el) || capIsNoise(el)) continue;
        found.push(el);
        if (found.length > 40) break;
      }
    } catch (e) { /* 무시 */ }
    if (!found.length) return null;
    found.sort((a, b) => (a.offsetWidth * a.offsetHeight) - (b.offsetWidth * b.offsetHeight));
    return found[0];
  }
  function capCommonAncestor(els) {
    if (!els.length) return null;
    let a = els[0];
    while (a && !els.every((e) => a.contains(e))) a = a.parentElement;
    return a;
  }
  // 영역이 너무 작으면(한 줄짜리 등) 바깥 요소로 조금 넓힌다
  function capGrow(el) {
    let n = el;
    for (let i = 0; i < 6 && n.parentElement && n.parentElement !== document.body && n.parentElement !== document.documentElement; i++) {
      const r = n.getBoundingClientRect();
      if (r.height >= 160 && r.width >= 360) break;
      if (n.parentElement.getBoundingClientRect().height > 9000) break;
      n = n.parentElement;
    }
    return n;
  }
  // 저장할 영역 추정: 상품 링크와 합계 글자의 가장 가까운 공통 조상 (body이거나 9000px보다 길면 상품 링크만으로)
  function capDetect(site) {
    const links = capCartLinks(site);
    const tot = capTotalEl();
    if (!links.length && !tot) return { el: document.body, found: false };
    const huge = (el) => !el || el === document.body || el === document.documentElement || el.getBoundingClientRect().height > 9000;
    let t = capCommonAncestor(links.concat(tot ? [tot] : []));
    if (huge(t) && links.length) t = capCommonAncestor(links);
    if (!t || t === document.body || t === document.documentElement) return { el: document.body, found: false };
    if (!huge(t)) t = capGrow(t);
    return { el: t, found: true };
  }

  // ---- 미리 보기(파란 테두리)와 버튼 줄 ----
  function capBoxUpdate() {
    const b = cap.box;
    if (!b) return;
    const el = cap.view;
    if (!el || !el.isConnected) { b.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    b.style.display = 'block';
    b.style.left = r.left + 'px';
    b.style.top = r.top + 'px';
    b.style.width = Math.max(0, r.width) + 'px';
    b.style.height = Math.max(0, r.height) + 'px';
  }
  function capEnsureBox() {
    if (!cap.box) {
      cap.box = h('div', { class: 'cmp-capbox' });
      capHost().appendChild(cap.box);
      window.addEventListener('scroll', capBoxUpdate, true);
      window.addEventListener('resize', capBoxUpdate);
      cap.timer = setInterval(capBoxUpdate, 300);
    }
  }
  function capSetBar(node) {
    if (cap.bar) { cap.bar.remove(); cap.bar = null; }
    cap.bar = node;
    capHost().appendChild(node);
  }
  function capClose() {
    try { if (cap.stopPick) cap.stopPick(); } catch (e) { /* 무시 */ }
    cap.stopPick = null;
    if (cap.bar) { cap.bar.remove(); cap.bar = null; }
    if (cap.box) {
      cap.box.remove();
      cap.box = null;
      window.removeEventListener('scroll', capBoxUpdate, true);
      window.removeEventListener('resize', capBoxUpdate);
      clearInterval(cap.timer);
    }
    cap.view = null;
  }
  const capSizeText = (el) => {
    try { const r = el.getBoundingClientRect(); return Math.round(r.width) + '×' + Math.round(r.height) + 'px'; } catch (e) { return ''; }
  };
  const capDescribe = (el) => {
    if (!el) return '';
    return (el.tagName || '').toLowerCase() + (el.id ? '#' + el.id : '') + ' (' + capSizeText(el) + ')';
  };

  function capPreview(note) {
    capEnsureBox();
    cap.view = cap.target;
    try { if (cap.target && cap.target !== document.body) cap.target.scrollIntoView({ block: 'start' }); } catch (e) { /* 무시 */ }
    capBoxUpdate();
    const site = cap.site;
    const target = cap.target;
    const save = (el) => { capClose(); capSave(el, site); };
    capSetBar(h('div', { class: 'cmp-capbar' },
      h('b', { text: '견적서 캡처 - ' + (SITE_NAME[site] || '') }),
      h('div', { class: 'cmp-meta', text: '파란 테두리 안을 그림 파일(PNG)로 저장합니다. 영역: ' + capDescribe(target) }),
      note ? h('div', { class: 'cmp-msg cmp-warn', style: 'display:block', text: note }) : null,
      h('div', { class: 'cmp-btns' },
        h('button', { class: 'cmp-btn cmp-primary', text: '이 영역 저장', onclick: () => save(target) }),
        h('button', { class: 'cmp-btn', text: '다른 영역 고르기', onclick: () => capPick() }),
        h('button', { class: 'cmp-btn', text: '전체 페이지 저장', onclick: () => save(document.body) }),
        h('button', { class: 'cmp-btn', text: '취소', onclick: capClose }))));
  }

  // 마우스로 영역 고르기: 올리면 파란 테두리, 클릭하면 선택. ↑ 바깥 영역, ↓ 안쪽 영역, Esc 취소
  function capPick() {
    if (cap.stopPick) cap.stopPick();
    const inUi = (n) => !!(n && n.closest && n.closest('#cmp-root'));
    let hover = cap.target;
    let stack = [];
    const info = h('div', { class: 'cmp-meta', text: '' });
    const show = (el) => {
      hover = el;
      cap.view = el;
      capBoxUpdate();
      info.textContent = '지금 가리키는 영역: ' + capDescribe(el);
    };
    const onMove = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      if (!el || inUi(el) || el === hover) return;
      stack = [];
      show(el);
    };
    const block = (ev) => {
      if (inUi(ev.target)) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    };
    const finish = (el) => {
      stop();
      cap.target = el || cap.target;
      capPreview('');
    };
    const onClick = (ev) => {
      if (inUi(ev.target)) return;
      block(ev);
      finish(hover || ev.target);
    };
    const onKey = (ev) => {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish(cap.target); return; }
      if (ev.key === 'ArrowUp' && hover && hover.parentElement && hover.parentElement !== document.documentElement) {
        ev.preventDefault(); stack.push(hover); show(hover.parentElement);
      } else if (ev.key === 'ArrowDown' && stack.length) {
        ev.preventDefault(); show(stack.pop());
      }
    };
    const evs = ['mousedown', 'mouseup', 'pointerdown', 'pointerup'];
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    evs.forEach((n) => document.addEventListener(n, block, true));
    const stop = () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      evs.forEach((n) => document.removeEventListener(n, block, true));
      cap.stopPick = null;
    };
    cap.stopPick = stop;
    show(cap.target);
    capSetBar(h('div', { class: 'cmp-capbar' },
      h('b', { text: '저장할 영역을 고르세요' }),
      h('div', { class: 'cmp-meta', text: '마우스를 올려 파란 테두리를 확인하고 클릭하세요. ↑ 키: 바깥 영역, ↓ 키: 안쪽 영역, Esc: 취소(원래 영역으로)' }),
      info,
      h('div', { class: 'cmp-btns' }, h('button', { class: 'cmp-btn', text: '고르기 취소', onclick: () => finish(cap.target) }))));
  }

  // ---- 그림 만들기 ----
  // 사이트 이미지는 다른 주소라 그림에 바로 못 넣으므로, 확장 프로그램 기능으로 받아 data 주소로 바꿔 넣는다
  function gmBlobToDataUrl(url) {
    return new Promise((resolve) => {
      if (typeof GM_xmlhttpRequest !== 'function') { resolve(''); return; }
      let done = false;
      const fin = (v) => { if (!done) { done = true; resolve(v); } };
      try {
        GM_xmlhttpRequest({
          method: 'GET', url, responseType: 'blob', timeout: 20000,
          onload: (r) => {
            try {
              if ((r.status && r.status >= 400) || !r.response) { fin(''); return; }
              const fr = new FileReader();
              fr.onload = () => fin(String(fr.result || ''));
              fr.onerror = () => fin('');
              fr.readAsDataURL(r.response);
            } catch (e) { fin(''); }
          },
          onerror: () => fin(''),
          ontimeout: () => fin(''),
          onabort: () => fin(''),
        });
      } catch (e) { fin(''); }
    });
  }
  // 늦게 불러오는(lazy) 이미지가 로드되도록 영역을 위에서 아래로 훑어 내려간다
  async function capLoadLazy(target) {
    const r = target.getBoundingClientRect();
    const top = r.top + window.scrollY;
    const step = Math.max(300, Math.floor(window.innerHeight * 0.8));
    let n = 0;
    for (let y = top; y < top + r.height && n < 40; y += step, n++) {
      window.scrollTo(0, y);
      await sleep(220);
    }
    window.scrollTo(0, 0);
    await sleep(300);
  }
  const restoreAttr = (el, name, v) => { if (v == null) el.removeAttribute(name); else el.setAttribute(name, v); };
  // 영역 안의 이미지(img, 배경 그림)를 data 주소로 바꾼다. 원래대로 돌리는 함수들을 restores에 쌓는다. 못 받은 개수를 돌려준다
  async function capInlineImages(target, restores) {
    const imgRecs = [];
    $$('img', target).forEach((img) => {
      if (img.closest('#cmp-root')) return;
      const url = capAbsUrl(img.currentSrc || img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original') || '');
      if (url) imgRecs.push({ img, url });
    });
    const bgRecs = [];
    const re = /url\((['"]?)(.*?)\1\)/g;
    $$('*', target).slice(0, 4000).forEach((el) => {
      try {
        if (el.closest('#cmp-root')) return;
        const bg = getComputedStyle(el).backgroundImage;
        if (!bg || bg === 'none' || bg.indexOf('url(') < 0) return;
        const urls = [];
        bg.replace(re, (m, q, u) => { const a = capAbsUrl(u); if (a) urls.push(a); return m; });
        if (urls.length) bgRecs.push({ el, bg });
      } catch (e) { /* 무시 */ }
    });
    const all = [];
    imgRecs.forEach((r) => all.push(r.url));
    bgRecs.forEach((r) => r.bg.replace(re, (m, q, u) => { const a = capAbsUrl(u); if (a) all.push(a); return m; }));
    const uniq = Array.from(new Set(all));
    const map = new Map();
    let done = 0;
    let failed = 0;
    let next = 0;
    if (uniq.length) capToast('이미지 불러오는 중 0/' + uniq.length + '…', 'info', true);
    const worker = async () => {
      while (next < uniq.length) {
        const u = uniq[next++];
        const d = await gmBlobToDataUrl(u);
        if (d && d.indexOf('data:') === 0) map.set(u, d); else failed++;
        done++;
        capToast('이미지 불러오는 중 ' + done + '/' + uniq.length + '…', 'info', true);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);

    const replaced = [];
    imgRecs.forEach(({ img, url }) => {
      const d = map.get(url);
      if (!d) return;
      const o = { src: img.getAttribute('src'), srcset: img.getAttribute('srcset'), sizes: img.getAttribute('sizes'), loading: img.getAttribute('loading') };
      const pic = img.parentElement && img.parentElement.tagName === 'PICTURE' ? img.parentElement : null;
      const srcs = pic ? $$('source', pic).map((sc) => ({ sc, srcset: sc.getAttribute('srcset') })) : [];
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
      img.removeAttribute('loading');
      srcs.forEach((x) => x.sc.removeAttribute('srcset'));
      img.setAttribute('src', d);
      replaced.push(img);
      restores.push(() => {
        restoreAttr(img, 'src', o.src);
        restoreAttr(img, 'srcset', o.srcset);
        restoreAttr(img, 'sizes', o.sizes);
        restoreAttr(img, 'loading', o.loading);
        srcs.forEach((x) => restoreAttr(x.sc, 'srcset', x.srcset));
      });
    });
    bgRecs.forEach(({ el, bg }) => {
      let changed = false;
      const nb = bg.replace(re, (m, q, u) => {
        const d = map.get(capAbsUrl(u));
        if (d) { changed = true; return 'url("' + d + '")'; }
        return m;
      });
      if (!changed) return;
      const oVal = el.style.getPropertyValue('background-image');
      const oPri = el.style.getPropertyPriority('background-image');
      el.style.setProperty('background-image', nb, 'important');
      restores.push(() => { if (oVal) el.style.setProperty('background-image', oVal, oPri); else el.style.removeProperty('background-image'); });
    });
    await Promise.all(replaced.slice(0, 300).map((img) => Promise.race([img.decode ? img.decode().catch(() => {}) : Promise.resolve(), sleep(2500)])));
    return failed;
  }
  function capDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { a.remove(); URL.revokeObjectURL(url); } catch (e) { /* 무시 */ } }, 15000);
  }
  async function capSave(target, site) {
    if (cap.busy) { capToast('이미 저장하는 중입니다', 'info'); return; }
    cap.busy = true;
    const restores = [];
    try {
      const H2I = getH2I();
      if (!H2I || typeof H2I.toBlob !== 'function') throw new Error('이미지 저장 도구(html-to-image)를 불러오지 못했습니다. 스크립트를 다시 설치(업데이트)해 주세요');
      if (!target || !target.isConnected) throw new Error('저장할 영역이 화면에서 사라졌습니다. 다시 시도하세요');
      capToast('화면을 불러오는 중…', 'info', true);
      await capLoadLazy(target);
      const failed = await capInlineImages(target, restores);
      capToast('그리는 중…', 'info', true);
      window.scrollTo(0, 0);
      await sleep(200);
      const rect = target.getBoundingClientRect();
      const ratio = Math.min(rect.height > 6000 ? 1 : 1.5, 16000 / Math.max(rect.height, rect.width, 1));
      const opts = (pr) => ({
        pixelRatio: pr, backgroundColor: '#ffffff', skipFonts: true, cacheBust: false,
        filter: (node) => !(node.id === 'cmp-root' || (node.closest && node.closest('#cmp-root'))),
      });
      let blob = null;
      try {
        blob = await H2I.toBlob(target, opts(ratio));
      } catch (e1) {
        if (ratio > 1) blob = await H2I.toBlob(target, opts(1)); else throw e1;
      }
      if (!blob) throw new Error('그림을 만들지 못했습니다(영역이 너무 크거나 비어 있을 수 있습니다)');
      const fname = (SITE_NAME[site] || '장바구니') + '_비교견적_' + ymd() + '.png';
      capDownload(blob, fname);
      capToast('저장했습니다: ' + fname + (failed ? ' (이미지 ' + failed + '개는 불러오지 못해 빠졌을 수 있습니다)' : ''), 'ok');
    } catch (e) {
      capToast('견적서 저장 중 오류: ' + errMsg(e), 'err');
    } finally {
      restores.reverse().forEach((fn) => { try { fn(); } catch (e2) { /* 무시 */ } });
      cap.busy = false;
    }
  }

  // "견적서 캡처" 버튼 / 요약의 "…장바구니 열고 캡처"(주소에 #cmp-capture)
  function capStart(site) {
    try {
      if (cap.busy) { capToast('이미 저장하는 중입니다', 'info'); return; }
      capClose();
      cap.site = site;
      const d = capDetect(site);
      cap.target = d.el;
      capPreview(d.found ? '' : '영역을 좁히지 못해 전체 화면을 골랐습니다. 필요하면 "다른 영역 고르기"로 직접 고르세요.');
    } catch (e) {
      capToast('견적서 캡처를 시작하지 못했습니다: ' + errMsg(e), 'err');
    }
  }
  function capMaybeAuto(pg) {
    try {
      if (ui.capAuto || location.hash.indexOf('cmp-capture') < 0) return;
      ui.capAuto = true;
      (async () => {
        capToast('장바구니가 모두 보일 때까지 기다리는 중…', 'info', true);
        await waitFor(() => capCartLinks(pg.site).length > 0, 25000, 600);
        await sleep(1200);
        const t = $('#cmp-cap-toast', capHost());
        if (t) t.style.display = 'none';
        capStart(pg.site);
      })().catch((e) => { capToast('견적서 캡처를 시작하지 못했습니다: ' + errMsg(e), 'err'); });
    } catch (e) { /* 무시 */ }
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
