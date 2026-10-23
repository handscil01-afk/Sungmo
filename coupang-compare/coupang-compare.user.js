// ==UserScript==
// @name         쿠팡 비교견적 도우미
// @namespace    https://handscil01-afk.github.io/Sungmo/
// @version      3.2.0
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
// @require      https://handscil01-afk.github.io/Sungmo/coupang-compare/hwpx-builder.js
// @run-at       document-idle
// @updateURL    https://handscil01-afk.github.io/Sungmo/coupang-compare/coupang-compare.user.js
// @downloadURL  https://handscil01-afk.github.io/Sungmo/coupang-compare/coupang-compare.user.js
// ==/UserScript==

/*
 * [사용법 - 3.1]
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
 * 4) 견적서 캡처: 요약의 "쿠팡 장바구니 열고 캡처" 등을 누르면 장바구니가 새 탭으로 열리고, 저장할 영역이 자동으로 잡혀 어둡게 강조됩니다.
 *    자동 영역 = "장바구니" 제목부터 마지막 상품 줄까지 + 오른쪽 합계 상자("주문 예상 금액" 등). 아래의 "같이 보면 좋은 상품" 같은 추천은 넣지 않습니다.
 *    캡처 프로그램처럼 마우스로 고칠 수 있습니다: 어두운 곳을 끌면 새 영역, 안쪽을 끌면 이동, 테두리·모서리를 끌면 크기 변경.
 *    끌면서 화면 위·아래 끝(60px)으로 가면 자동으로 스크롤되어 화면보다 긴 영역도 잡을 수 있습니다. 크기는 px로 표시됩니다.
 *    아래 막대: "이 영역 저장"(Enter) / "자동 영역 다시 잡기" / "전체 페이지" / "취소"(Esc).
 *    저장하면 PNG 그림 파일로 내려받고, 서류 만들기에 쓰도록 사이트별(쿠팡·11번가·G마켓)로 한 장씩 보관합니다(요약의 "견적서 캡처"에서 확인·지우기).
 *    장바구니 화면 오른쪽 아래 "견적서 캡처" 버튼으로도 언제든 시작할 수 있습니다.
 * 5) 물품구입비 서류 만들기: 요약의 "물품구입비 서류 만들기(hwpx)"를 누르면 기안 · 산출기초조사서 · 견적서(캡처) · 물품검수조서를 담은 hwpx 한 개를 만듭니다.
 *    문서번호·제목·일시·장소·대상·지출처·지출일·예산과목·결재란·조사자·검수자 등을 입력하면(다음에도 미리 채워짐) "만들기"로 내려받습니다.
 *    품목 표(품명·규격·단위·수량·단가·금액)는 비교견적 결과에서 채워지며 고칠 수 있습니다. 서류 파일 제작은 hwpx-builder.js가 맡습니다.
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

  // ---- 견적서 캡처 영역 / 물품구입비 서류 도우미 (화면(DOM)을 쓰지 않는 순수 함수) ----
  const pad2 = (n) => (n < 10 ? '0' : '') + n;
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
  function fmtDocDate(d) { return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.'; }
  function fmtKorDate(d) { return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일(' + WEEKDAYS[d.getDay()] + ')'; }
  function addDaysDate(d, n) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
  }
  // '2026. 10. 21.' / '2026년 10월 21일(수)' / '2026-10-21' -> Date (아니면 null)
  function parseAnyDate(s) {
    const m = String(s == null ? '' : s).match(/(\d{4})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/);
    if (!m) return null;
    const y = +m[1], mo = +m[2], da = +m[3];
    const d = new Date(y, mo - 1, da);
    return d.getFullYear() === y && d.getMonth() === mo - 1 && d.getDate() === da ? d : null;
  }
  function mmddOf(s, fallbackDate) {
    const d = parseAnyDate(s) || fallbackDate || new Date();
    return pad2(d.getMonth() + 1) + pad2(d.getDate());
  }
  function defaultDocNo(d) { return '손잡다' + pad2((d || new Date()).getFullYear() % 100) + '-0000'; }
  // 기안 첫 문장: "…의 물품구입비를" (제목 끝의 '물품구입비'는 뺀다)
  function introText(biz, title) {
    const core = String(title == null ? '' : title).replace(/\s*물품구입비\s*$/, '').trim();
    const b = String(biz == null ? '' : biz).trim();
    return b + ' 수행에 있어, ' + (core ? core + '의 ' : '') + '물품구입비를 다음과 같이 지출하고자 하오니 결재 바랍니다.';
  }
  // 쿠팡 옵션 -> 규격: free/Free/FREE/프리 낱말을 빼고 쉼표를 정리한다
  function specFromOption(option) {
    const s = String(option == null ? '' : option).replace(/(^|[\s,\/(])(free|프리)(?=$|[\s,\/)])/gi, '$1');
    return s.split(',').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean).join(', ');
  }
  // 배송비 글자("3,000원", "무료", "50,000원 이상 무료") -> 숫자
  function shipNumOf(text) {
    const t = String(text == null ? '' : text);
    if (/무료|조건|이상/.test(t)) return 0;
    const m = t.match(/([\d,]+)\s*원/);
    return m ? parseInt(m[1].replace(/,/g, ''), 10) || 0 : 0;
  }
  function unitPriceOf(total, qty) { return qty > 0 ? Math.round((Number(total) || 0) / qty) : 0; }
  // 아주 긴 캡처를 읽기 좋게 나누는 조각(세로 비율이 1.45를 넘으면 너비 × 1.41 높이씩)
  function sliceSpecs(w, h) {
    if (!(w > 0) || !(h > 0) || h / w <= 1.45) return [{ y: 0, h }];
    const sh = Math.round(w * 1.41);
    const out = [];
    for (let y = 0; y < h; y += sh) out.push({ y, h: Math.min(sh, h - y) });
    return out;
  }
  function attachmentLines(o) {
    const a = [];
    if (o && o.survey) a.push('산출기초조사서 1부');
    if (o && o.quotes > 0) a.push('견적서 ' + o.quotes + '부');
    if (o && o.inspection) a.push('물품검수조서 1부');
    return a;
  }
  function safeFileName(s) { return String(s == null ? '' : s).replace(/[\\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim(); }

  // ---- 사각형 {x, y, w, h} (페이지 좌표) ----
  const rectOk = (r) => !!r && isFinite(r.x) && isFinite(r.y) && r.w > 0 && r.h > 0;
  function rectUnion(list) {
    const rs = (list || []).filter(rectOk);
    if (!rs.length) return null;
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    rs.forEach((q) => { l = Math.min(l, q.x); t = Math.min(t, q.y); r = Math.max(r, q.x + q.w); b = Math.max(b, q.y + q.h); });
    return { x: l, y: t, w: r - l, h: b - t };
  }
  function rectPad(r, p) { return { x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p }; }
  // 바깥은 내림, 안쪽 끝은 올림해서 정수 사각형으로
  function rectRound(r) {
    const x0 = Math.floor(r.x), y0 = Math.floor(r.y), x1 = Math.ceil(r.x + r.w), y1 = Math.ceil(r.y + r.h);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  // 문서 범위 [0, W] x [0, H]와 겹치는 부분
  function rectClamp(r, W, H) {
    const x0 = Math.max(0, Math.min(W, r.x)), y0 = Math.max(0, Math.min(H, r.y));
    const x1 = Math.max(0, Math.min(W, r.x + r.w)), y1 = Math.max(0, Math.min(H, r.y + r.h));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  // 크기는 그대로 두고 문서 안으로 옮긴다
  function rectShiftInto(r, W, H) {
    const w = Math.min(r.w, W), h = Math.min(r.h, H);
    return { x: Math.max(0, Math.min(W - w, r.x)), y: Math.max(0, Math.min(H - h, r.y)), w, h };
  }
  function rectFromPoints(x1, y1, x2, y2) {
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
  }
  // dir: n s e w ne nw se sw. 최소 크기 min 아래로는 줄지 않는다
  function rectResize(r, dir, dx, dy, min) {
    let l = r.x, t = r.y, rt = r.x + r.w, b = r.y + r.h;
    if (dir.indexOf('w') >= 0) l += dx;
    if (dir.indexOf('e') >= 0) rt += dx;
    if (dir.indexOf('n') >= 0) t += dy;
    if (dir.indexOf('s') >= 0) b += dy;
    if (rt - l < min) { if (dir.indexOf('w') >= 0) l = rt - min; else rt = l + min; }
    if (b - t < min) { if (dir.indexOf('n') >= 0) t = b - min; else b = t + min; }
    return { x: l, y: t, w: rt - l, h: b - t };
  }
  function rectContains(outer, inner, tol) {
    tol = tol || 0;
    return outer.x <= inner.x + tol && outer.y <= inner.y + tol && outer.x + outer.w >= inner.x + inner.w - tol && outer.y + outer.h >= inner.y + inner.h - tol;
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
    if (s && s.restock) { gotoRestock(s); return; }
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
    if (s.restock) {
      s.restock.pos += 1;
      saveState(s);
      gotoRestock(s);
      return;
    }
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

  // ------------------------------------------------------------------
  // 다시 담기 (3.2): 기록해 둔 11번가·G마켓 상품 주소·옵션으로 장바구니를 다시 채운다
  // (로그인 전에 담아서 장바구니가 사라졌거나, 쿠팡 수량을 바꾼 뒤 새 수량으로 담을 때)
  // ------------------------------------------------------------------
  // 쿠팡 수량이 바뀐 뒤 이 상품에서 담아야 할 묶음 수
  function packsNeeded(it, p) {
    const conv = p && p.packN ? convertPack({ n: p.packN, unit: p.packUnit || it.packUnit }, it.packUnit) : null;
    return conv ? Math.max(1, Math.ceil(it.needUnits / conv.n - 1e-9)) : it.qty;
  }
  // 담아 둔 수량(p.qty)과 필요한 수량이 다르면 stale 표시
  function refreshStale(it) {
    ['st', 'gm'].forEach((site) => {
      const p = it[site];
      if (!p || p.skipped || !p.url) return;
      const need = packsNeeded(it, p);
      if (p.qty !== need) { p.stale = true; p.needQty = need; } else { p.stale = false; delete p.needQty; }
    });
  }
  function restockTargets(s, onlyStale) {
    const targets = [];
    ['st', 'gm'].forEach((site) => {
      s.items.forEach((it, i) => {
        const p = it[site];
        if (p && !p.skipped && p.url && /^https:\/\//.test(p.url) && (!onlyStale || p.stale)) targets.push({ site, idx: i });
      });
    });
    return targets;
  }
  function startRestock(onlyStale) {
    const s = loadState();
    if (!s) return false;
    const targets = restockTargets(s, onlyStale);
    if (!targets.length) return false;
    s.restock = { targets, pos: 0, failed: [], resume: s.site === 'done' ? null : { site: s.site, idx: s.idx } };
    s.restockReport = null;
    s.auto = true;
    s.redo = false;
    s.resume = null;
    s.pendingCandidate = null;
    s.adding = null;
    saveState(s);
    gotoRestock(s);
    return true;
  }
  function gotoRestock(s) {
    const r = s && s.restock;
    if (!r) { gotoSearch(s); return; }
    for (;;) {
      const t = r.targets[r.pos];
      if (!t) { finishRestock(s); return; }
      const it = s.items[t.idx];
      const p = it && it[t.site];
      if (p && !p.skipped && p.url && /^https:\/\//.test(p.url)) {
        s.site = t.site;
        s.idx = t.idx;
        s.adding = null;
        s.pendingCandidate = { url: p.url, shipping: p.shipping || '', title: p.title || '', price: 0, image: p.image || '',
          packN: p.packN || null, packUnit: p.packUnit || null, site: t.site, idx: t.idx, kw: '' };
        saveState(s);
        location.href = p.url;
        return;
      }
      r.pos += 1;
    }
  }
  function finishRestock(s) {
    const r = s.restock || { failed: [] };
    s.restock = null;
    s.auto = false;
    s.pendingCandidate = null;
    s.adding = null;
    s.restockReport = { failed: r.failed || [], t: Date.now() };
    if (r.resume) { s.site = r.resume.site; s.idx = r.resume.idx; } else { s.site = 'done'; }
    saveState(s);
    renderAll();
    showSummary();
  }
  function restockFail(s, reason) {
    const r = s.restock;
    if (!r) return;
    const t = r.targets[r.pos] || {};
    r.failed = r.failed || [];
    r.failed.push({ site: t.site, idx: t.idx, reason: reason || '' });
    saveState(s);
    advance();
  }
  // 쿠팡 장바구니를 다시 읽어 수량·금액이 바뀐 품목을 기록에 반영한다
  function syncFromCoupang() {
    try {
      const s = loadState();
      if (!s || !s.items.length) { capToast('저장된 비교견적 기록이 없습니다. 먼저 "비교견적 시작"을 누르세요', 'err'); return; }
      const lines = parseCoupangCart();
      if (!lines.length) { capToast('쿠팡 장바구니 물품을 읽지 못했습니다', 'err'); return; }
      const used = new Set();
      let changed = 0;
      const missing = [];
      s.items.forEach((it) => {
        let j = lines.findIndex((ln, k) => !used.has(k) && ln.name === it.name && (ln.option || '') === (it.option || ''));
        if (j < 0) j = lines.findIndex((ln, k) => !used.has(k) && ln.name === it.name);
        if (j < 0) { missing.push(it.pname || shortName(it.name, 20)); return; }
        used.add(j);
        const ln = lines[j];
        const priceDiff = ln.cpTotal > 0 && ln.cpTotal !== it.cpTotal;
        if (ln.qty === it.qty && !priceDiff) return;
        it.qty = ln.qty;
        it.needUnits = (it.packN || 1) * ln.qty;
        if (ln.cpTotal > 0) it.cpTotal = ln.cpTotal;
        it.cpUnitPrice = it.cpTotal && it.needUnits ? it.cpTotal / it.needUnits : 0;
        changed += 1;
      });
      s.items.forEach(refreshStale);
      saveState(s);
      const staleN = s.items.reduce((n, it) => n + ['st', 'gm'].filter((k) => it[k] && it[k].stale).length, 0);
      let t = changed ? '쿠팡 장바구니의 바뀐 ' + changed + '개 품목을 기록에 반영했습니다.' : '바뀐 수량이 없습니다.';
      if (staleN) t += ' 11번가·G마켓 ' + staleN + '건은 담긴 수량을 다시 맞춰야 합니다.';
      if (missing.length) t += ' (쿠팡 장바구니에서 찾지 못한 품목: ' + missing.join(', ') + ')';
      capToast(t, staleN || missing.length ? 'warn' : '', false);
      if (changed || staleN) showSummary();
    } catch (e) {
      capToast('수량 변경을 반영하는 중 오류: ' + errMsg(e), 'err');
    }
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
#cmp-root .cmp-capbar { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 2147483620; width: min(640px, calc(100vw - 24px)); display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; background: #fff; color: #111827; border: 1px solid #d1d5db; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,.35); font-size: 13px; }
#cmp-root .cmp-toast { position: fixed; left: 50%; top: 16px; transform: translateX(-50%); z-index: 2147483640; max-width: calc(100vw - 32px); padding: 8px 14px; border-radius: 10px; background: #1e293b; color: #fff; font-size: 13px; box-shadow: 0 6px 20px rgba(0,0,0,.35); display: none; }
#cmp-root .cmp-toast.cmp-t-err { background: #b91c1c; }
#cmp-root .cmp-toast.cmp-t-ok { background: #15803d; }
#cmp-root .cmp-caps { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; margin-top: 10px; }
#cmp-root .cmp-caphead { font-weight: 700; color: #1e3a8a; }
#cmp-root .cmp-caprow { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; padding: 4px 0; border-top: 1px dashed #e2e8f0; }
#cmp-root .cmp-caprow b { min-width: 52px; }
#cmp-root .cmp-capst { flex: 1 1 150px; font-size: 12.5px; color: #64748b; }
#cmp-root .cmp-capst.cmp-has { color: #166534; font-weight: 700; }
#cmp-root .cmp-fgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; }
#cmp-root .cmp-fgrid .cmp-w2 { grid-column: 1 / -1; }
#cmp-root .cmp-fsec { margin: 12px 0 4px; padding-bottom: 3px; border-bottom: 2px solid #dbeafe; color: #1e3a8a; font-weight: 700; }
#cmp-root label.cmp-f { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #64748b; }
#cmp-root textarea { padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #111827; width: 100%; font-size: 13px; line-height: 1.4; resize: vertical; }
#cmp-root .cmp-checks { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center; }
#cmp-root label.cmp-chk { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; font-size: 13px; }
#cmp-root .cmp-itbl input { min-height: 28px; padding: 2px 4px; font-size: 12.5px; }
@media (max-width: 600px) { #cmp-root .cmp-fgrid { grid-template-columns: 1fr; } }
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
  // keepOpen: 바깥을 눌러도 닫지 않는다(길게 입력하는 창)
  function openModal(title, bodyNode, footerNode, keepOpen) {
    const { modalHost } = ensureRoot();
    modalHost.textContent = '';
    const bg = h('div', { class: 'cmp-bg' },
      h('div', { class: 'cmp-modal', role: 'dialog' },
        h('div', { class: 'cmp-mhead' }, h('b', { text: title }), h('button', { class: 'cmp-btn cmp-small', text: '닫기', onclick: closeModal })),
        h('div', { class: 'cmp-mbody' }, bodyNode),
        footerNode ? h('div', { class: 'cmp-mfoot' }, footerNode) : null));
    if (!keepOpen) bg.addEventListener('mousedown', (ev) => { if (ev.target === bg) closeModal(); });
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
      if (p.stale && p.needQty) {
        const est = p.qty > 0 && p.total ? Math.round(p.total / p.qty * p.needQty) : 0;
        sub.appendChild(h('span', { class: 'cmp-bad', text: '쿠팡 수량이 바뀜: 담은 ' + p.qty + '묶음 → 필요 ' + p.needQty + '묶음' + (est ? ' (새 금액 약 ' + fmt(est) + '원)' : '') }));
      }
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

    const staleCount = s.items.reduce((n, it) => n + ['st', 'gm'].filter((k) => it[k] && it[k].stale).length, 0);
    const pickCount = restockTargets(s, false).length;
    if (s.restockReport && s.restockReport.failed && s.restockReport.failed.length) {
      const names = s.restockReport.failed.map((f) => {
        const it = s.items[f.idx];
        return SITE_NAME[f.site] + ' ' + ((it && (it.pname || shortName(it.name, 16))) || '?') + (f.reason ? ' (' + f.reason + ')' : '');
      });
      body.appendChild(h('div', { class: 'cmp-msg cmp-warn', style: 'display:block;margin-bottom:8px', text: '다시 담지 못한 상품이 있습니다: ' + names.join(' / ') + '. 표의 "다시" 버튼으로 직접 고르세요.' }));
    } else if (s.restockReport) {
      body.appendChild(h('div', { class: 'cmp-msg cmp-ok', style: 'display:block;margin-bottom:8px', text: '기록해 둔 상품을 모두 다시 담았습니다. 11번가·G마켓 장바구니에서 수량과 금액을 확인하세요.' }));
    }
    if (staleCount) {
      body.appendChild(h('div', { class: 'cmp-msg cmp-warn', style: 'display:block;margin-bottom:8px', text: '쿠팡 수량이 바뀌어 11번가·G마켓 ' + staleCount + '건의 수량이 맞지 않습니다. 장바구니가 비어 있으면 아래 "다시 담기"를 누르세요. 이미 담긴 상품이 남아 있으면 중복되므로 그 장바구니에서 해당 상품을 먼저 지운 뒤 누르세요.' }));
    }
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
    body.appendChild(buildCapSection());

    const drawFoot = () => {
      foot.textContent = '';
      if (!confirming) {
        foot.appendChild(h('button', {
          class: 'cmp-btn cmp-primary', text: '표 복사', onclick: () => {
            const ok = copyText(buildTsv(loadState() || s));
            copyMsg.textContent = ok ? '복사했습니다. 엑셀이나 한글 표에 붙여 넣으세요' : '복사에 실패했습니다. 브라우저 권한을 확인하세요';
          },
        }));
        foot.appendChild(h('button', { class: 'cmp-btn cmp-primary', text: '물품구입비 서류 만들기(hwpx)', onclick: () => showDocForm() }));
        if (s.site !== 'done' || s.restock) {
          foot.appendChild(h('button', { class: 'cmp-btn cmp-success', text: '이어서 진행', onclick: () => {
            closeModal();
            const s2 = loadState();
            if (s2 && s2.restock) { s2.auto = true; saveState(s2); }
            gotoSearch(loadState());
          } }));
        }
        if (pickCount && !s.restock) {
          foot.appendChild(h('button', { class: 'cmp-btn cmp-success', text: '11번가·G마켓 다시 담기(' + pickCount + '건)', title: '기록해 둔 상품 주소와 옵션으로 장바구니를 다시 채웁니다. 구매·결제는 하지 않습니다', onclick: () => { closeModal(); startRestock(false); } }));
          if (staleCount && staleCount < pickCount) {
            foot.appendChild(h('button', { class: 'cmp-btn cmp-success', text: '수량 바뀐 것만 다시 담기(' + staleCount + '건)', onclick: () => { closeModal(); startRestock(true); } }));
          }
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
          state && state.items.length ? h('button', { class: 'cmp-capfab', text: '수량 변경 반영', title: '쿠팡 장바구니에서 바꾼 수량을 비교견적 기록에 반영합니다', onclick: syncFromCoupang }) : null,
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
      h('b', { class: 'cmp-title', text: SITE_NAME[state.site] + ' 비교견적 ' + (state.idx + 1) + '/' + state.items.length + (state.redo ? ' (다시 고르기)' : '') + (state.restock ? ' (다시 담기 ' + (state.restock.pos + 1) + '/' + state.restock.targets.length + ')' : '') }),
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

    if (state.restock && state.auto) {
      setMsg('다시 담기 중입니다. 기록해 둔 상품 화면으로 이동합니다…', 'warn');
      setTimeout(() => { try { const s2 = loadState(); if (s2 && s2.restock && s2.auto) gotoRestock(s2); } catch (e) { /* 무시 */ } }, 1000);
      return;
    }
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
      const rsP = (loadState() || {}).restock ? item[site] : null; // 다시 담기: 전에 담은 옵션과 같은 것을 고른다
      const target = rsP && rsP.option
        ? buildTarget(rsP.option, rsP.title, rsP.packN ? { n: rsP.packN, unit: rsP.packUnit || item.packUnit } : null)
        : buildTarget(item.option, item.name, item.packExplicit ? { n: item.packN, unit: item.packUnit } : null);
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
      if (!s.restock && L.unitPrice != null && cpu && L.unitPrice <= cpu + 1e-9) warns.push(perLabel(item.packUnit) + ' 가격이 쿠팡 이하입니다(비교견적은 쿠팡보다 비싸야 합니다)');
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
      if (s.restock) { autoDetail('이 상품은 다시 담지 못했습니다 (' + reason + ')', true); restockFail(s, reason); return; }
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
      const rs = !!(loadState() || {}).restock; // 다시 담기: 이미 고른 상품이므로 쿠팡과의 가격 비교는 하지 않음
      if (r.warns && r.warns.length) fails.push('옵션 확인 필요');
      if (L.unitPrice == null) fails.push('개당 가격을 알 수 없음');
      else if (!rs && cpu > 0 && L.unitPrice <= cpu + 1e-9) fails.push('개당 가격이 쿠팡 이하');
      if (!rs && !(cpu > 0)) fails.push('쿠팡 금액 없음');
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
  // 견적서 캡처 (3.1): 장바구니의 "장바구니" 제목부터 마지막 상품까지와 오른쪽 합계 상자(주문 예상 금액)를 한 장의 그림으로 저장
  // 처음 영역은 자동으로 잡고, 캡처 프로그램처럼 마우스로 새로 그리거나 옮기고 크기를 바꿀 수 있다
  // (사이트마다 화면 구조가 달라 글자·링크로 추정하므로, 저장 전에 영역을 확인한다)
  // ------------------------------------------------------------------
  const CAP_LINK_RE = { cp: /\/vp\/products\//, st: /products\/\d+|prdNo=\d+/i, gm: /goodscode=\d+/i };
  const CAP_TOTAL_RE = /(총\s*(상품|주문|결제)\s*(금액|가격)|결제\s*예정\s*금액|주문\s*예상\s*금액|최종\s*결제\s*금액)/;
  const CAP_SUM_RE = /(주문\s*예상\s*금액|결제\s*예정\s*금액|결제예정금액|총\s*결제\s*금액|최종\s*결제\s*금액|총\s*주문\s*금액)/;
  const CAP_SUM2_RE = /(총\s*상품\s*(금액|가격)|결제\s*예상\s*금액|결제예상금액)/;
  const CAP_HEAD_RE = /^\s*<?\s*장바구니(?![가-힣])/;
  const CAP_AMT_RE = /\d[\d,]*\s*원/;
  const CAP_NOISE_HEAD_RE = /추천|함께|최근\s*본|광고/;
  const CAP_NOISE_ATTR_RE = /recommend|(^|[\s_-])reco([\s_-]|$)|(^|[\s_-])ad[-_]|banner/i;
  const CAP_PAD = 8; // 자동 영역의 바깥 여백(px)
  const CAP_JPEG_OVER = 6 * 1024 * 1024; // PNG 주소가 이보다 길면 서류용으로는 JPEG을 저장
  const cap = { site: '', rect: null, doc: { w: 0, h: 0 }, ov: null, sel: null, sizeEl: null, infoEl: null, noteEl: null, bar: null, keyH: null, resizeH: null,
    timer: 0, toastTimer: 0, busy: false, drag: null, raf: 0 };

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
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function capAbsUrl(raw) {
    try {
      const t = String(raw == null ? '' : raw).trim();
      if (!t || /^(data|blob|javascript|about):/i.test(t)) return '';
      const u = new URL(t, location.href);
      return /^https?:$/.test(u.protocol) ? u.href : '';
    } catch (e) { return ''; }
  }
  // 스크롤 애니메이션(scroll-behavior: smooth)을 쓰는 사이트에서도 바로 이동
  function scrollNow(x, y) {
    try { window.scrollTo({ left: x, top: y, behavior: 'instant' }); } catch (e) { window.scrollTo(x, y); }
  }
  // 요소의 페이지 좌표 사각형 (지금 스크롤 위치를 더한 값)
  function pageRectOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
  }
  // 문서 전체 크기 (캡처 화면의 덮개는 빼고 잰다)
  function capDocSize() {
    const ov = cap.ov;
    let prev = '';
    if (ov) { prev = ov.style.display; ov.style.display = 'none'; }
    const de = document.documentElement;
    const b = document.body;
    const w = Math.max(de.scrollWidth, b ? b.scrollWidth : 0, de.clientWidth);
    const hh = Math.max(de.scrollHeight, b ? b.scrollHeight : 0, de.clientHeight);
    if (ov) ov.style.display = prev;
    return { w, h: hh };
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
  // 글자가 re와 맞는 보이는 요소(글자 바로 위 요소)들
  function capTextEls(re, maxLen, limit) {
    const out = [];
    try {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let n;
      while ((n = w.nextNode())) {
        const v = n.nodeValue;
        if (!v || v.length > maxLen || !re.test(v)) continue;
        const el = n.parentElement;
        if (!el || /^(SCRIPT|STYLE|NOSCRIPT|TITLE)$/.test(el.tagName)) continue;
        if (el.closest('#cmp-root') || !visible(el)) continue;
        out.push(el);
        if (out.length >= (limit || 60)) break;
      }
    } catch (e) { /* 무시 */ }
    return out;
  }
  // "총 상품금액", "결제예정금액" 같은 글자를 가진 가장 작은 보이는 요소 (영역을 좁히지 못할 때의 대체 방법에 쓴다)
  function capTotalEl() {
    const found = capTextEls(CAP_TOTAL_RE, 60, 40).filter((el) => !capIsNoise(el));
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
  // 대체 방법: 상품 링크와 합계 글자의 가장 가까운 공통 조상 (body이거나 9000px보다 길면 상품 링크만으로)
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

  // ---- 자동 영역: "장바구니" 제목 + 모든 상품 줄 + 오른쪽 합계 상자 ----
  // 테두리·배경(흰색 제외)·그림자가 있어서 상자처럼 보이는 요소인가
  function capLooksBox(el) {
    try {
      const cs = getComputedStyle(el);
      const clear = (c) => !c || c === 'transparent' || /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c);
      const sides = ['Top', 'Right', 'Bottom', 'Left'];
      for (let i = 0; i < sides.length; i++) {
        const sd = sides[i];
        if (parseFloat(cs['border' + sd + 'Width']) > 0 && cs['border' + sd + 'Style'] !== 'none' && !clear(cs['border' + sd + 'Color'])) return true;
      }
      if (cs.boxShadow && cs.boxShadow !== 'none') return true;
      const bg = cs.backgroundColor;
      if (!clear(bg) && !/^rgba?\(\s*255,\s*255,\s*255(,\s*1)?\s*\)$/.test(bg)) return true;
    } catch (e) { /* 무시 */ }
    return false;
  }
  // 합계 글자가 든 요소를 가장 가까운 상자(최대 3단계 바깥)로 넓힌다
  function capBoxOf(base) {
    const big = (e) => { const r = e.getBoundingClientRect(); return r.height >= 90 && r.width >= 180; };
    let n = base;
    for (let i = 0; i <= 3 && n && n !== document.body && n !== document.documentElement; i++, n = n.parentElement) {
      if (big(n) && capLooksBox(n) && n.getBoundingClientRect().height <= 1500) return n;
    }
    n = base;
    for (let i = 0; i < 3 && n.parentElement && n.parentElement !== document.body && n.parentElement !== document.documentElement && !big(n); i++) n = n.parentElement;
    return n;
  }
  // 오른쪽 합계 상자("주문 예상 금액" 등 글자와 "원" 금액이 함께 든 가장 작은 보이는 요소 -> 상자)
  function capSummaryBox() {
    const res = [CAP_SUM_RE, CAP_SUM2_RE];
    for (let k = 0; k < res.length; k++) {
      const labels = capTextEls(res[k], 40, 40).filter((el) => !capIsNoise(el));
      const cands = [];
      labels.forEach((el) => {
        let n = el;
        for (let i = 0; i < 6 && n && n !== document.body && n !== document.documentElement; i++, n = n.parentElement) {
          if (CAP_AMT_RE.test(n.textContent || '')) { if (visible(n)) cands.push(n); break; }
        }
      });
      if (!cands.length) continue;
      const area = (e) => { const r = e.getBoundingClientRect(); return r.width * r.height; };
      cands.sort((a, b) => area(a) - area(b));
      const base = cands.find((e) => area(e) > 0) || cands[0];
      return { box: capBoxOf(base), base };
    }
    return null;
  }
  // "장바구니" 제목 후보들 (메뉴의 장바구니 링크는 뺀다)
  function capHeadCands() {
    return capTextEls(CAP_HEAD_RE, 24, 40).filter((el) => {
      try {
        if (el.closest('nav, [role="navigation"]')) return false;
        if (el.closest('header') && el.closest('a')) return false;
        return true;
      } catch (e) { return true; }
    });
  }
  // 상품 줄들: 쿠팡은 div[id^="item_"], 11번가·G마켓은 상품 링크를 감싼 줄(다른 상품 링크를 만나기 직전까지 바깥으로)
  function capItemRows(site, stops) {
    if (site === 'cp') {
      const seen = new Set();
      const divs = $$('div[id^="item_"]').filter((d) => {
        if (seen.has(d.id) || d.closest('#cmp-root') || !visible(d)) return false;
        if (!$('a[href*="/vp/products/"]', d)) return false;
        if ($('div[id^="item_"]', d)) return false; // 여러 줄을 감싼 바깥 컨테이너
        seen.add(d.id);
        return true;
      });
      const clean = divs.filter((d) => !capIsNoise(d));
      return clean.length ? clean : divs;
    }
    const links = capCartLinks(site);
    const idOf = (a) => {
      const m = (a.getAttribute('href') || '').match(/products\/(\d+)|prdNo=(\d+)|goodscode=(\d+)/i);
      return m ? (m[1] || m[2] || m[3]) : '';
    };
    const rows = new Set();
    links.forEach((a) => {
      const id = idOf(a);
      let n = a;
      for (let i = 0; i < 30; i++) {
        if (n.tagName === 'LI' || n.tagName === 'TR') break;
        const p = n.parentElement;
        if (!p || p === document.body || p === document.documentElement) break;
        if (links.some((o) => o !== a && idOf(o) !== id && p.contains(o))) break;
        if (p.getBoundingClientRect().height > 600) break;
        if (stops.some((s) => p.contains(s))) break;
        n = p;
      }
      rows.add(n);
    });
    return Array.from(rows).filter(visible);
  }
  // 자동 영역(페이지 좌표). { rect, note }
  function capAutoRect(site) {
    scrollNow(0, 0);
    const D = capDocSize();
    const full = { x: 0, y: 0, w: D.w, h: D.h };
    const finish = (r) => rectRound(rectClamp(rectPad(r, CAP_PAD), D.w, D.h));
    const heads = capHeadCands();
    const sumInfo = capSummaryBox();
    let sum = sumInfo ? sumInfo.box : null;
    const rows = capItemRows(site, heads.concat(sum ? [sum] : []));
    // 넓힌 상자가 상품 줄을 품으면(상자를 못 찾아 바깥으로 너무 넓어진 경우) 합계 글자가 든 원래 요소만 쓴다
    const overlaps = (e) => rows.some((r) => r.contains(e) || e.contains(r));
    if (sum && overlaps(sum)) sum = sumInfo.base && !overlaps(sumInfo.base) ? sumInfo.base : null;
    if (!rows.length) {
      const d = capDetect(site);
      if (d.found) {
        const parts = [pageRectOf(d.el)];
        if (sum) parts.push(pageRectOf(sum));
        return { rect: finish(rectUnion(parts)), note: '상품 줄을 정확히 찾지 못해 상품·합계 근처를 대략 골랐습니다. 영역을 확인하고 필요하면 고쳐 주세요.' };
      }
      return { rect: full, note: '영역을 좁히지 못해 전체 화면을 골랐습니다. 마우스로 저장할 영역을 새로 그려 주세요.' };
    }
    const rects = rows.map(pageRectOf);
    const firstTop = Math.min.apply(null, rects.map((r) => r.y));
    let head = null;
    let hy = -1;
    heads.forEach((el) => {
      const r = pageRectOf(el);
      if (r.w > 0 && r.h > 0 && r.y + r.h <= firstTop + 4 && firstTop - r.y <= 700 && r.y > hy) { head = el; hy = r.y; }
    });
    if (head) rects.push(pageRectOf(head));
    if (sum) rects.push(pageRectOf(sum));
    return {
      rect: finish(rectUnion(rects)),
      note: sum ? '' : '오른쪽 합계(주문 예상 금액) 상자를 찾지 못했습니다. 필요하면 영역을 직접 늘려 주세요.',
    };
  }

  // ---- 영역 편집 화면: 문서 전체를 덮는 반투명 덮개 + 선택 사각형 ----
  const CAP_CURSOR = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };
  const CAP_HIT = 10; // 테두리·모서리로 보는 거리(px)
  const CAP_EDGE = 60; // 화면 위·아래 끝에서 자동 스크롤이 시작되는 거리(px)
  const CAP_MIN = 12;
  function capHit(px, py) {
    const r = cap.rect;
    if (!r) return { mode: 'new', dir: '' };
    const T = CAP_HIT;
    if (px < r.x - T || px > r.x + r.w + T || py < r.y - T || py > r.y + r.h + T) return { mode: 'new', dir: '' };
    let dir = '';
    const dT = Math.abs(py - r.y), dB = Math.abs(py - (r.y + r.h));
    if (dT <= T && dT <= dB) dir += 'n'; else if (dB <= T) dir += 's';
    const dL = Math.abs(px - r.x), dR = Math.abs(px - (r.x + r.w));
    if (dL <= T && dL <= dR) dir += 'w'; else if (dR <= T) dir += 'e';
    return dir ? { mode: 'resize', dir } : { mode: 'move', dir: '' };
  }
  function capRender() {
    const r = cap.rect;
    const sel = cap.sel;
    if (!r || !sel) return;
    sel.style.left = r.x + 'px';
    sel.style.top = r.y + 'px';
    sel.style.width = r.w + 'px';
    sel.style.height = r.h + 'px';
    const t = Math.round(r.w) + ' × ' + Math.round(r.h) + ' px';
    if (cap.sizeEl) {
      cap.sizeEl.textContent = t;
      cap.sizeEl.style.top = r.y > 30 ? '-28px' : '4px';
      cap.sizeEl.style.left = r.y > 30 ? '-2px' : '4px';
    }
    if (cap.infoEl) cap.infoEl.textContent = '선택 영역 ' + t;
  }
  function capApplyDrag() {
    const d = cap.drag;
    if (!d) return;
    const px = d.cx + window.scrollX;
    const py = d.cy + window.scrollY;
    const dx = px - d.sx;
    const dy = py - d.sy;
    const W = cap.doc.w;
    const Hh = cap.doc.h;
    let r;
    if (d.mode === 'new') r = rectClamp(rectFromPoints(d.sx, d.sy, px, py), W, Hh);
    else if (d.mode === 'move') r = rectShiftInto({ x: d.r0.x + dx, y: d.r0.y + dy, w: d.r0.w, h: d.r0.h }, W, Hh);
    else r = rectClamp(rectResize(d.r0, d.dir, dx, dy, CAP_MIN), W, Hh);
    cap.rect = r;
    capRender();
  }
  // 끌고 있는 동안 화면 위·아래 끝에 가까우면 창을 자동으로 스크롤한다(끝에 가까울수록 빠르게)
  function capTick() {
    cap.raf = 0;
    const d = cap.drag;
    if (!d) return;
    try {
      const vh = window.innerHeight;
      const y = Math.max(-CAP_EDGE, Math.min(vh + CAP_EDGE, d.cy));
      let dy = 0;
      if (y < CAP_EDGE) dy = -Math.max(2, Math.ceil(((CAP_EDGE - y) / CAP_EDGE) * 32));
      else if (y > vh - CAP_EDGE) dy = Math.max(2, Math.ceil(((y - (vh - CAP_EDGE)) / CAP_EDGE) * 32));
      if (dy) {
        const before = window.scrollY;
        scrollNow(window.scrollX, before + dy);
        if (window.scrollY !== before) capApplyDrag();
      }
    } catch (e) { /* 무시 */ }
    cap.raf = requestAnimationFrame(capTick);
  }
  function capEndDrag(ev) {
    const d = cap.drag;
    if (!d) return;
    if (ev && typeof ev.clientX === 'number') { d.cx = ev.clientX; d.cy = ev.clientY; }
    capApplyDrag();
    if (d.mode === 'new' && (cap.rect.w < 10 || cap.rect.h < 10)) cap.rect = d.r0; // 그냥 클릭만 한 경우는 원래 영역 유지
    cap.drag = null;
    if (cap.raf) { cancelAnimationFrame(cap.raf); cap.raf = 0; }
    try { if (cap.ov && ev && ev.pointerId != null) cap.ov.releasePointerCapture(ev.pointerId); } catch (e) { /* 무시 */ }
    capRender();
  }
  function capSetNote(t) {
    if (!cap.noteEl) return;
    cap.noteEl.textContent = t || '';
    cap.noteEl.style.display = t ? 'block' : 'none';
  }
  function capRevealRect() {
    try { if (cap.rect) scrollNow(0, Math.max(0, cap.rect.y - 80)); } catch (e) { /* 무시 */ }
  }
  function capEditorShow(on) {
    if (cap.ov) cap.ov.style.display = on ? '' : 'none';
    if (cap.bar) cap.bar.style.display = on ? '' : 'none';
  }
  function capClose() {
    if (cap.raf) { cancelAnimationFrame(cap.raf); cap.raf = 0; }
    cap.drag = null;
    if (cap.keyH) { document.removeEventListener('keydown', cap.keyH, true); cap.keyH = null; }
    if (cap.resizeH) { window.removeEventListener('resize', cap.resizeH); cap.resizeH = null; }
    if (cap.timer) { clearInterval(cap.timer); cap.timer = 0; }
    if (cap.ov) { cap.ov.remove(); cap.ov = null; }
    if (cap.bar) { cap.bar.remove(); cap.bar = null; }
    cap.sel = null; cap.sizeEl = null; cap.infoEl = null; cap.noteEl = null;
  }
  function capSync() {
    if (!cap.ov || cap.busy) return;
    const D = capDocSize();
    if (D.w !== cap.doc.w || D.h !== cap.doc.h) {
      cap.doc = D;
      cap.ov.style.width = D.w + 'px';
      cap.ov.style.height = D.h + 'px';
    }
  }
  function capOpenEditor(note) {
    capClose();
    cap.doc = capDocSize();
    const ov = document.createElement('div');
    ov.id = 'cmp-cap-overlay';
    ov.style.cssText = 'position:absolute;left:0;top:0;margin:0;padding:0;border:0;overflow:hidden;z-index:2147483000;cursor:crosshair;touch-action:none;'
      + '-webkit-user-select:none;user-select:none;background:transparent;width:' + cap.doc.w + 'px;height:' + cap.doc.h + 'px;';
    const sel = document.createElement('div');
    sel.id = 'cmp-cap-sel';
    sel.style.cssText = 'position:absolute;box-sizing:border-box;border:2px solid #2563eb;box-shadow:0 0 0 200000px rgba(15,23,42,.55);cursor:move;';
    const sizeEl = document.createElement('div');
    sizeEl.style.cssText = 'position:absolute;padding:2px 8px;border-radius:10px;background:#1e3a8a;color:#fff;font:700 12px/1.5 "Malgun Gothic","Apple SD Gothic Neo",sans-serif;white-space:nowrap;pointer-events:none;';
    sel.appendChild(sizeEl);
    const pos = { nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], sw: [0, 100], w: [0, 50] };
    Object.keys(pos).forEach((k) => {
      const hd = document.createElement('div');
      hd.style.cssText = 'position:absolute;width:12px;height:12px;box-sizing:border-box;background:#fff;border:2px solid #2563eb;border-radius:2px;pointer-events:none;'
        + 'left:' + pos[k][0] + '%;top:' + pos[k][1] + '%;transform:translate(-50%,-50%);';
      hd.setAttribute('data-h', k);
      sel.appendChild(hd);
    });
    ov.appendChild(sel);
    cap.ov = ov; cap.sel = sel; cap.sizeEl = sizeEl;

    ov.addEventListener('pointerdown', (ev) => {
      if (cap.busy || (ev.button != null && ev.button !== 0)) return;
      ev.preventDefault();
      const px = ev.clientX + window.scrollX;
      const py = ev.clientY + window.scrollY;
      const hit = capHit(px, py);
      cap.drag = { mode: hit.mode, dir: hit.dir, sx: px, sy: py, r0: Object.assign({}, cap.rect), cx: ev.clientX, cy: ev.clientY };
      try { ov.setPointerCapture(ev.pointerId); } catch (e) { /* 무시 */ }
      if (!cap.raf) cap.raf = requestAnimationFrame(capTick);
    });
    ov.addEventListener('pointermove', (ev) => {
      const d = cap.drag;
      if (!d) {
        const hit = capHit(ev.clientX + window.scrollX, ev.clientY + window.scrollY);
        ov.style.cursor = hit.mode === 'new' ? 'crosshair' : hit.mode === 'move' ? 'move' : CAP_CURSOR[hit.dir];
        return;
      }
      d.cx = ev.clientX; d.cy = ev.clientY;
      capApplyDrag();
    });
    ov.addEventListener('pointerup', capEndDrag);
    ov.addEventListener('pointercancel', capEndDrag);

    const noteEl = h('div', { class: 'cmp-msg cmp-warn' });
    cap.noteEl = noteEl;
    cap.infoEl = h('b', { text: '' });
    const saveNow = () => capSave(cap.rect, cap.site);
    const bar = h('div', { class: 'cmp-capbar' },
      h('div', { class: 'cmp-row2', style: 'justify-content:space-between;flex-wrap:wrap' }, h('b', { text: '견적서 캡처 - ' + (SITE_NAME[cap.site] || '') }), cap.infoEl),
      h('div', { class: 'cmp-meta', text: '마우스로 끌어 새로 그리거나, 테두리·모서리를 끌어 크기를 바꾸세요. 화면 위·아래 끝으로 끌면 자동으로 스크롤됩니다.' }),
      noteEl,
      h('div', { class: 'cmp-btns' },
        h('button', { class: 'cmp-btn cmp-primary', text: '이 영역 저장', onclick: saveNow }),
        h('button', { class: 'cmp-btn', text: '자동 영역 다시 잡기', onclick: () => {
          try { const d = capAutoRect(cap.site); cap.rect = d.rect; capSetNote(d.note); capRender(); capRevealRect(); } catch (e) { capToast('자동 영역을 잡지 못했습니다: ' + errMsg(e), 'err'); }
        } }),
        h('button', { class: 'cmp-btn', text: '전체 페이지', onclick: () => {
          cap.doc = capDocSize();
          cap.rect = { x: 0, y: 0, w: cap.doc.w, h: cap.doc.h };
          capSetNote('');
          capRender();
          capRevealRect();
        } }),
        h('button', { class: 'cmp-btn', text: '취소', onclick: capClose })),
      h('div', { class: 'cmp-meta', text: 'Enter: 저장 · Esc: 취소' }));
    cap.bar = bar;
    capHost().appendChild(bar);
    (document.documentElement || document.body).appendChild(ov);

    cap.keyH = (ev) => {
      if (cap.busy) return;
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); capClose(); return; }
      if (ev.key === 'Enter') {
        const t = ev.target;
        if (t && t.closest && t.closest('.cmp-capbar, .cmp-bg') && /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return; // 막대·창의 버튼은 Enter로 눌리게 둔다
        ev.preventDefault(); ev.stopPropagation();
        saveNow();
      }
    };
    document.addEventListener('keydown', cap.keyH, true);
    cap.resizeH = () => capSync();
    window.addEventListener('resize', cap.resizeH);
    cap.timer = setInterval(capSync, 1000);
    capSetNote(note);
    capRender();
    capRevealRect();
    try { if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur(); } catch (e) { /* 무시 */ } // 방금 누른 버튼에 Enter가 또 먹지 않게
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
    const r = pageRectOf(target);
    const step = Math.max(300, Math.floor(window.innerHeight * 0.8));
    let n = 0;
    for (let y = r.y; y < r.y + r.h && n < 40; y += step, n++) {
      scrollNow(0, y);
      await sleep(220);
    }
    scrollNow(0, 0);
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

  // 그림으로 그릴 때 sticky(붙어 다니는)·fixed(고정) 요소가 엉뚱한 자리에 찍히지 않도록, 그리는 동안만 제자리(relative)에 둔다. restores로 원래 style을 그대로 되돌린다
  function capFlattenSticky(root, restores) {
    let n = 0;
    [root].concat($$('*', root)).forEach((el) => {
      try {
        if (el.closest('#cmp-root')) return;
        const pos = getComputedStyle(el).position;
        if (pos !== 'sticky' && pos !== 'fixed') return;
        const prev = el.getAttribute('style');
        restores.push(() => { if (prev == null) el.removeAttribute('style'); else el.setAttribute('style', prev); });
        el.style.setProperty('position', 'relative', 'important');
        ['top', 'bottom', 'left', 'right'].forEach((p) => el.style.setProperty(p, 'auto', 'important'));
        el.style.setProperty('transform', 'none', 'important');
        n++;
      } catch (e) { /* 무시 */ }
    });
    return n;
  }
  // 선택 영역을 모두 담는 가장 작은 요소(그리는 기준). 영역 왼쪽 위·오른쪽 아래 점에서 위로 올라가며 찾고, 없으면 body
  async function capFindRoot(sel) {
    const rootEl = ensureRoot().root;
    const prevVis = rootEl.style.visibility;
    rootEl.style.visibility = 'hidden'; // 우리 버튼이 점 찾기를 가로막지 않게
    try {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const probe = (px, py, top) => {
        scrollNow(px > vw - 40 ? Math.max(0, px - Math.round(vw / 2)) : 0, top ? Math.max(0, py - 40) : Math.max(0, py - vh + 40));
        const cx = Math.min(Math.max(px - window.scrollX, 1), vw - 2);
        const cy = Math.min(Math.max(py - window.scrollY, 1), vh - 2);
        return document.elementFromPoint(cx, cy);
      };
      const a = probe(sel.x + 2, sel.y + 2, true);
      const b = probe(sel.x + sel.w - 2, sel.y + sel.h - 2, false);
      let n = null;
      if (a && b) n = capCommonAncestor([a, b]);
      if (!n || n === document.documentElement) n = document.body;
      scrollNow(0, 0);
      while (n && n !== document.body) {
        if (rectContains(pageRectOf(n), sel, 1)) return n;
        n = n.parentElement;
      }
      return document.body;
    } finally {
      rootEl.style.visibility = prevVis;
    }
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
  const canvasToBlob = (c, type, q) => new Promise((res) => { try { c.toBlob(res, type, q); } catch (e) { res(null); } });

  // 저장: 선택 영역(페이지 좌표)을 담는 요소를 그린 뒤 영역만 잘라 PNG로 내려받고, 서류 만들기용으로도 보관한다
  async function capSave(rect, site) {
    if (cap.busy) { capToast('이미 저장하는 중입니다', 'info'); return; }
    cap.busy = true;
    const restores = [];
    const rootEl = ensureRoot().root;
    const prevVis = rootEl.style.visibility;
    const y0 = window.scrollY;
    let closeAfter = false;
    try {
      const H2I = getH2I();
      if (!H2I || typeof H2I.toCanvas !== 'function') throw new Error('이미지 저장 도구(html-to-image)를 불러오지 못했습니다. 스크립트를 다시 설치(업데이트)해 주세요');
      if (!rect || !rectOk(rect)) throw new Error('저장할 영역이 없습니다. 마우스로 영역을 그려 주세요');
      const sel = rectRound(rect);
      if (sel.w < 10 || sel.h < 10) throw new Error('저장할 영역이 너무 작습니다');
      capEditorShow(false);
      capToast('화면을 불러오는 중…', 'info', true);
      const root = await capFindRoot(sel);
      await capLoadLazy(root);
      const failed = await capInlineImages(root, restores);
      scrollNow(0, 0);
      capFlattenSticky(root, restores);
      await sleep(250);
      const rr = pageRectOf(root);
      let ratio = Math.min(rr.h > 6000 ? 1 : 1.5, 16000 / Math.max(rr.h, rr.w, 1));
      const rootStyle = { margin: '0' };
      try { if (getComputedStyle(root).position === 'absolute') { rootStyle.left = '0px'; rootStyle.top = '0px'; } } catch (e) { /* 무시 */ }
      const opts = (pr) => ({
        pixelRatio: pr, backgroundColor: '#ffffff', skipFonts: true, cacheBust: false, style: rootStyle,
        filter: (node) => !(node.id === 'cmp-root' || node.id === 'cmp-cap-overlay' || (node.closest && (node.closest('#cmp-root') || node.closest('#cmp-cap-overlay')))),
      });
      capToast('그리는 중…', 'info', true);
      await sleep(60);
      rootEl.style.visibility = 'hidden'; // 그리는 동안 우리 화면은 숨긴다
      let canvas = null;
      try {
        canvas = await H2I.toCanvas(root, opts(ratio));
      } catch (e1) {
        if (ratio > 1) { ratio = 1; canvas = await H2I.toCanvas(root, opts(1)); } else throw e1;
      } finally {
        rootEl.style.visibility = prevVis;
      }
      if (!canvas || !canvas.width || !canvas.height) throw new Error('그림을 만들지 못했습니다(영역이 너무 크거나 비어 있을 수 있습니다)');
      // 영역만 잘라 낸다 (영역이 그린 요소 밖으로 조금 나가면 흰색)
      const ox = Math.round((sel.x - rr.x) * ratio);
      const oy = Math.round((sel.y - rr.y) * ratio);
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(sel.w * ratio));
      out.height = Math.max(1, Math.round(sel.h * ratio));
      const ctx = out.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(canvas, -ox, -oy);
      canvas.width = 1; canvas.height = 1; // 큰 그림 메모리 반환
      const blob = await canvasToBlob(out, 'image/png');
      if (!blob) throw new Error('그림 파일을 만들지 못했습니다(영역이 너무 큽니다. 영역을 줄여 보세요)');
      const fname = (SITE_NAME[site] || '장바구니') + '_비교견적_' + ymd() + '.png';
      capDownload(blob, fname);
      // 서류 만들기용으로 보관 (PNG 주소가 6MB를 넘으면 JPEG)
      let stored = true;
      try {
        let dataUrl = out.toDataURL('image/png');
        let mime = 'image/png';
        if (dataUrl.length > CAP_JPEG_OVER) { dataUrl = out.toDataURL('image/jpeg', 0.85); mime = 'image/jpeg'; }
        GM_setValue('cmpCap_' + site, JSON.stringify({ dataUrl, width: out.width, height: out.height, date: ymd(), mime }));
      } catch (e2) { stored = false; }
      closeAfter = true;
      capToast(stored
        ? '저장했습니다(서류 만들기에 사용됩니다): ' + fname + (failed ? ' (이미지 ' + failed + '개는 불러오지 못해 빠졌을 수 있습니다)' : '')
        : '그림 파일은 저장했지만 서류 만들기용 보관에는 실패했습니다: ' + fname, stored ? 'ok' : 'err');
    } catch (e) {
      capEditorShow(true);
      capToast('견적서 저장 중 오류: ' + errMsg(e), 'err');
    } finally {
      restores.reverse().forEach((fn) => { try { fn(); } catch (e2) { /* 무시 */ } });
      rootEl.style.visibility = prevVis;
      try { scrollNow(0, y0); } catch (e3) { /* 무시 */ }
      cap.busy = false;
      if (closeAfter) capClose();
    }
  }

  // "견적서 캡처" 버튼 / 요약의 "…장바구니 열고 캡처"(주소에 #cmp-capture)
  function capStart(site) {
    try {
      if (cap.busy) { capToast('이미 저장하는 중입니다', 'info'); return; }
      capClose();
      cap.site = site;
      const d = capAutoRect(site);
      cap.rect = d.rect;
      capOpenEditor(d.note);
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
  // 물품구입비 서류 만들기 (3.1): 기안 · 산출기초조사서 · 견적서(캡처) · 물품검수조서를 한 개의 hwpx로
  // hwpx 파일 자체는 hwpx-builder.js(CmpHwpx)가 만든다
  // ------------------------------------------------------------------
  const DOCKEY = 'cmpDocPrefs';
  const CAP_SITES = ['cp', 'st', 'gm'];
  const CAP_LABEL = { cp: '쿠팡 장바구니', st: '11번가 장바구니', gm: 'G마켓 장바구니' };
  const HWPX_MISSING = '서류 만들기 기능을 불러오지 못했습니다. 스크립트를 다시 설치해 주세요';
  const DEFAULT_VENDOR = '쿠팡(주) / 120-88-00767 / 로저스 해롤드 린 / 서울시 광진구 아차산로 412, 2층';
  // 다음에 미리 채울 글자 칸들 (이름 칸은 처음엔 비어 있다)
  const DOC_PREF_KEYS = ['docNo', 'title', 'biz', 'when', 'place', 'target', 'vendor', 'payMethod', 'gwan', 'hang', 'mok', 'semok', 'source',
    'ap1', 'ap2', 'ap3', 'surveyor', 'checker', 'v1', 'v2', 'v3', 'decision', 'supplier', 'invPlace', 'inspector', 'witness'];

  function getHwpx() {
    try { if (typeof CmpHwpx !== 'undefined' && CmpHwpx) return CmpHwpx; } catch (e) { /* 아래 대체 */ }
    try { return PW.CmpHwpx || window.CmpHwpx || null; } catch (e) { return null; }
  }
  function loadDocPrefs() {
    try {
      const v = GM_getValue(DOCKEY, '');
      if (!v) return {};
      const o = typeof v === 'string' ? JSON.parse(v) : v;
      return o && typeof o === 'object' ? o : {};
    } catch (e) { return {}; }
  }
  function saveDocPrefs(F) {
    try {
      const o = {};
      DOC_PREF_KEYS.forEach((k) => { if (typeof F[k] === 'string') o[k] = F[k]; });
      GM_setValue(DOCKEY, JSON.stringify(o));
    } catch (e) { /* 무시 */ }
  }
  // 저장해 둔 견적서 캡처 ({dataUrl, width, height, date, mime} 또는 null)
  function capLoad(site) {
    try {
      const v = GM_getValue('cmpCap_' + site, '');
      if (!v) return null;
      const o = typeof v === 'string' ? JSON.parse(v) : v;
      return o && o.dataUrl ? o : null;
    } catch (e) { return null; }
  }
  function capClear(site) { try { GM_setValue('cmpCap_' + site, ''); } catch (e) { /* 무시 */ } }

  function dataUrlToBytes(d) {
    const i = String(d).indexOf(',');
    const bin = atob(String(d).slice(i + 1));
    const u = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
    return u;
  }
  function loadImageEl(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('저장된 견적서 그림을 읽지 못했습니다. 다시 캡처해 주세요'));
      img.src = src;
    });
  }
  // 저장된 캡처들을 쿠팡, 11번가, G마켓 순서로 quotes 배열로. 세로가 너무 길면 조각으로 나눈다
  async function buildQuotes(sites) {
    const out = [];
    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      const c = capLoad(site);
      if (!c) continue;
      const mime = c.mime === 'image/jpeg' ? 'image/jpeg' : 'image/png';
      const img = await loadImageEl(c.dataUrl);
      const w = img.naturalWidth || c.width;
      const hh = img.naturalHeight || c.height;
      const sl = sliceSpecs(w, hh);
      if (sl.length === 1) {
        out.push({ label: CAP_LABEL[site], mime, bytes: dataUrlToBytes(c.dataUrl), width: w, height: hh });
        continue;
      }
      for (let k = 0; k < sl.length; k++) {
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = sl[k].h;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, sl[k].h);
        ctx.drawImage(img, 0, sl[k].y, w, sl[k].h, 0, 0, w, sl[k].h);
        const blob = await canvasToBlob(cv, mime, 0.92);
        if (!blob) throw new Error('긴 견적서 그림을 나누지 못했습니다');
        out.push({ label: CAP_LABEL[site] + ' (' + (k + 1) + '/' + sl.length + ')', mime, bytes: new Uint8Array(await blob.arrayBuffer()), width: w, height: sl[k].h });
      }
    }
    return out;
  }

  // 요약 모달의 "견적서 캡처" 구역: 사이트별 저장 상태, 캡처 열기, 지우기
  function buildCapSection(onChange) {
    const box = h('div', { class: 'cmp-caps' });
    const draw = () => {
      box.textContent = '';
      box.appendChild(h('div', { class: 'cmp-caphead', text: '견적서 캡처' }));
      box.appendChild(h('div', { class: 'cmp-hint', text: '장바구니를 새 탭으로 열고 저장할 영역(장바구니 제목 ~ 마지막 상품 + 오른쪽 합계)을 자동으로 잡아 보여 줍니다. 마우스로 고쳐 그린 뒤 "이 영역 저장"을 누르면 그림 파일(PNG)로 내려받고, 서류 만들기에도 쓰입니다.' }));
      CAP_SITES.forEach((site) => {
        const c = capLoad(site);
        box.appendChild(h('div', { class: 'cmp-caprow' },
          h('b', { text: SITE_NAME[site] }),
          h('span', { class: 'cmp-capst' + (c ? ' cmp-has' : ''), text: c ? '저장됨 ' + (c.date || '') + ' ' + (c.width || '?') + '×' + (c.height || '?') : '없음' }),
          h('a', { class: 'cmp-btn cmp-primary cmp-small', href: CART_URL[site] + '#cmp-capture', target: '_blank', rel: 'noopener', text: SITE_NAME[site] + ' 장바구니 열고 캡처' }),
          h('button', { class: 'cmp-btn cmp-small cmp-danger', text: '지우기', disabled: !c, onclick: () => { capClear(site); draw(); if (onChange) onChange(); } })));
      });
    };
    draw();
    // 다른 탭에서 캡처하고 돌아오면 상태를 새로 보여 준다
    const onFocus = () => { if (!box.isConnected) { window.removeEventListener('focus', onFocus); return; } draw(); if (onChange) onChange(); };
    window.addEventListener('focus', onFocus);
    return box;
  }

  function showDocForm() {
    try {
      buildDocForm();
    } catch (e) {
      openModal('물품구입비 서류 만들기', h('div', { class: 'cmp-bad', text: '서류 화면을 만드는 중 오류가 발생했습니다: ' + errMsg(e) }), [h('button', { class: 'cmp-btn', text: '닫기', onclick: closeModal })]);
    }
  }

  function buildDocForm() {
    const s = loadState();
    if (!s || !s.items.length) throw new Error('비교견적 기록이 없습니다. 먼저 비교견적을 진행해 주세요');
    const capSites = CAP_SITES.filter((k) => !!capLoad(k));
    const prefs = loadDocPrefs();
    const now = new Date();
    const pv = (k, d) => (typeof prefs[k] === 'string' ? prefs[k] : d);

    // ---- 값 (F) ----
    const F = {
      incDraft: true, incSurvey: true, incQuote: capSites.length > 0, incInsp: true,
      docNo: pv('docNo', defaultDocNo(now)), docDate: fmtDocDate(now),
      title: pv('title', '물품구입비'), biz: pv('biz', '장애인자립생활지원사업'), intro: '', content: '',
      when: pv('when', ''), place: pv('place', ''), target: pv('target', ''),
      vendor: pv('vendor', DEFAULT_VENDOR), payDate: fmtKorDate(addDaysDate(now, 1)), payMethod: pv('payMethod', '카드결제'),
      gwan: pv('gwan', ''), hang: pv('hang', ''), mok: pv('mok', ''), semok: pv('semok', ''), source: pv('source', '보조금'),
      ap1: pv('ap1', ''), ap2: pv('ap2', ''), ap3: pv('ap3', ''), attach: '',
      survDate: '', surveyor: pv('surveyor', ''), checker: pv('checker', ''),
      v1: pv('v1', '㈜쿠팡'), v2: pv('v2', '십일번가㈜'), v3: pv('v3', '주식회사 지마켓'), decision: pv('decision', '가격이 가장 저렴한 곳으로 선택함'),
      contractName: '', supplier: pv('supplier', '㈜쿠팡'), amount: '0', contractDate: '', dueDate: '', inspectDate: '',
      invPlace: pv('invPlace', '사무실'), inspector: pv('inspector', ''), witness: pv('witness', ''),
    };
    // 다른 칸을 따라가는 칸: 직접 고치기 전까지 자동으로 채운다
    const auto = { intro: true, content: true, survDate: true, contractName: true, amount: true, contractDate: true, dueDate: true, inspectDate: true, attach: true };
    const E = {};
    const setF = (k, v) => {
      F[k] = v;
      const el = E[k];
      if (el && el.value !== String(v)) el.value = v;
    };

    // ---- 품목 / 배송비 ----
    const rows = s.items.map((it) => {
      const cp = it.cpTotal || 0;
      const qty = Math.max(1, it.qty || 1);
      return { pname: it.pname || it.name, spec: specFromOption(it.option), unit: '개', qty, unitPrice: unitPriceOf(cp, qty), unitTouched: false, cp, st: pickAmt(it.st) || '', gm: pickAmt(it.gm) || '' };
    });
    const shipInit = (site) => s.items.reduce((a, it) => a + (it[site] && !it[site].skipped ? shipNumOf(it[site].shipping) : 0), 0);
    const ship = { cp: 0, st: shipInit('st'), gm: shipInit('gm') };
    const shipIn = {};
    const sumOf = (key) => rows.reduce((a, r) => a + (num(r[key]) || 0), 0);
    const totEls = {};
    const msg = h('div', { class: 'cmp-msg', style: 'flex:1 1 100%' });
    const say = (t, kind) => { msg.textContent = ''; msg.className = 'cmp-msg' + (kind ? ' cmp-' + kind : ''); msg.style.display = t ? 'block' : 'none'; if (t) msg.appendChild(document.createTextNode(t)); return msg; };
    say('');

    const sections = {};
    const derive = () => {
      if (auto.intro) setF('intro', introText(F.biz, F.title));
      if (auto.content) setF('content', F.title + ' 지출');
      if (auto.contractName) setF('contractName', F.title);
      if (auto.survDate) setF('survDate', F.docDate);
      const pd = parseAnyDate(F.payDate);
      if (auto.contractDate) setF('contractDate', pd ? fmtDocDate(pd) : '');
      if (auto.dueDate) setF('dueDate', pd ? fmtDocDate(addDaysDate(pd, 3)) : '');
      if (auto.inspectDate) setF('inspectDate', F.dueDate);
      if (auto.amount) setF('amount', String(sumOf('cp') + (num(ship.cp) || 0)));
      if (auto.attach) {
        setF('attach', attachmentLines({ survey: F.incSurvey, quotes: F.incQuote ? capSites.length : 0, inspection: F.incInsp }).join('\n'));
      }
      Object.keys(sections).forEach((k) => { sections[k].style.opacity = F[k] ? '' : '.45'; });
      ['cp', 'st', 'gm'].forEach((k) => { if (totEls[k]) totEls[k].textContent = fmt(sumOf(k)) + '원'; });
    };
    let prefTimer = 0;
    const onEdit = () => {
      derive();
      clearTimeout(prefTimer);
      prefTimer = setTimeout(() => saveDocPrefs(F), 500);
    };

    // ---- 칸 만들기 도우미 ----
    const field = (key, label, opts) => {
      opts = opts || {};
      const inp = opts.area ? h('textarea', { rows: String(opts.rows || 2) }) : h('input', { type: opts.type || 'text' });
      if (opts.placeholder) inp.setAttribute('placeholder', opts.placeholder);
      inp.setAttribute('aria-label', label);
      inp.value = F[key];
      inp.addEventListener('input', () => {
        F[key] = inp.value;
        if (Object.prototype.hasOwnProperty.call(auto, key)) auto[key] = false;
        onEdit();
      });
      E[key] = inp;
      return h('label', { class: 'cmp-f' + (opts.wide ? ' cmp-w2' : '') }, h('span', { text: label }), inp);
    };
    const selectField = (key, label, values) => {
      const sel = h('select', { 'aria-label': label }, values.map((v) => h('option', { value: v, text: v })));
      sel.value = values.indexOf(F[key]) >= 0 ? F[key] : values[0];
      F[key] = sel.value;
      sel.addEventListener('change', () => { F[key] = sel.value; onEdit(); });
      E[key] = sel;
      return h('label', { class: 'cmp-f' }, h('span', { text: label }), sel);
    };
    const check = (key, label, disabled, note) => {
      const c = h('input', { type: 'checkbox', checked: !!F[key], disabled: !!disabled });
      c.setAttribute('aria-label', label);
      c.addEventListener('change', () => { F[key] = c.checked; onEdit(); });
      E[key] = c;
      return h('label', { class: 'cmp-chk' }, c, h('span', { text: label }), note ? h('span', { class: 'cmp-gray', text: note }) : null);
    };
    const section = (flagKey, title, kids) => {
      const box = h('div', null, h('div', { class: 'cmp-fsec', text: title }), h('div', { class: 'cmp-fgrid' }, kids));
      if (flagKey) sections[flagKey] = box;
      return box;
    };

    const body = h('div', null);
    body.appendChild(h('div', { class: 'cmp-hint', text: '비교견적 결과와 저장해 둔 견적서 캡처로 hwpx 서류 한 개를 만듭니다. 칸을 고치면 다음에도 같은 내용이 미리 채워집니다(날짜·금액은 제외). 이름 칸은 직접 입력하세요.' }));
    body.appendChild(h('div', { class: 'cmp-fsec', text: '포함할 쪽' }));
    body.appendChild(h('div', { class: 'cmp-checks' },
      check('incDraft', '기안'), check('incSurvey', '산출기초조사서'),
      check('incQuote', '견적서(캡처)', capSites.length === 0, capSites.length === 0 ? '(저장된 캡처 없음)' : '(' + capSites.map((k) => SITE_NAME[k]).join('·') + ')'),
      check('incInsp', '물품검수조서')));

    body.appendChild(section('incDraft', '기안', [
      field('docNo', '문서번호'), field('docDate', '기안일'),
      field('title', '제목', { wide: true }), field('biz', '사업 문구', { wide: true }),
      field('intro', '첫 문장(제목·사업 문구에 맞춰 자동으로 만들어지며, 고치면 더는 바뀌지 않습니다)', { wide: true, area: true, rows: 2 }),
      field('content', '내용', { wide: true }),
      field('when', '일시'), field('place', '장소'), field('target', '대상', { wide: true }),
      field('vendor', '지출처', { wide: true }),
      field('payDate', '지출일'), field('payMethod', '지출방법'),
      field('gwan', '예산과목 관'), field('hang', '예산과목 항'), field('mok', '예산과목 목'), field('semok', '예산과목 세목'),
      selectField('source', '재원', ['보조금', '자부담']),
      field('ap1', '결재란 1', { placeholder: '예: 팀장 홍길동' }), field('ap2', '결재란 2'), field('ap3', '결재란 3'),
      field('attach', '붙임(한 줄에 하나. 포함할 쪽에 맞춰 자동으로 만들어지며, 고치면 더는 바뀌지 않습니다)', { wide: true, area: true, rows: 3 }),
    ]));
    body.appendChild(section('incSurvey', '산출기초조사서', [
      field('survDate', '조사일(기안일을 따라갑니다)'), field('decision', '결정 사유'),
      field('surveyor', '조사자'), field('checker', '확인자'),
      field('v1', '업체명 1 (쿠팡)'), field('v2', '업체명 2 (11번가)'), field('v3', '업체명 3 (G마켓)', { wide: true }),
    ]));

    body.appendChild(section('incInsp', '물품검수조서', [
      field('contractName', '계약건명(제목을 따라갑니다)', { wide: true }),
      field('supplier', '납품자'), field('amount', '계약금액(쿠팡 합계 + 쿠팡 배송비)', { type: 'number' }),
      field('contractDate', '계약체결일(지출일)'), field('dueDate', '납품기한(+3일)'),
      field('inspectDate', '검수일(납품기한)'), field('invPlace', '검수장소'),
      field('inspector', '검수자'), field('witness', '입회자'),
    ]));

    // ---- 품목 표 ----
    const tbody = h('tbody', null);
    const cellIn = (r, key, opts) => {
      opts = opts || {};
      const inp = h('input', { type: opts.num ? 'number' : 'text', value: String(r[key] == null ? '' : r[key]) });
      if (opts.num) inp.setAttribute('min', '0');
      inp.setAttribute('aria-label', opts.label);
      if (opts.w) inp.style.width = opts.w;
      return inp;
    };
    rows.forEach((r, i) => {
      const tr = h('tr', null);
      const note = h('span', { class: 'cmp-sub cmp-bad', text: '' });
      const ins = {};
      const upd = (init) => {
        const calc = unitPriceOf(num(r.cp), Math.max(0, parseInt(r.qty, 10) || 0));
        if (!r.unitTouched) { r.unitPrice = calc; ins.unitPrice.value = String(calc); }
        const prod = (num(r.unitPrice) || 0) * (parseInt(r.qty, 10) || 0);
        note.textContent = prod !== (num(r.cp) || 0) ? '단가×수량(' + fmt(prod) + ')이 금액과 달라 서류에는 금액 ' + fmt(num(r.cp)) + '원을 씁니다' : '';
        if (init) derive(); else onEdit();
      };
      const mkc = (key, label, opts) => {
        const inp = cellIn(r, key, Object.assign({ label: '품목 ' + (i + 1) + ' ' + label }, opts));
        inp.addEventListener('input', () => {
          r[key] = inp.value;
          if (key === 'unitPrice') r.unitTouched = true;
          upd();
        });
        ins[key] = inp;
        return inp;
      };
      tr.appendChild(h('td', null, mkc('pname', '품명', { w: '150px' })));
      tr.appendChild(h('td', null, mkc('spec', '규격', { w: '120px' })));
      tr.appendChild(h('td', null, mkc('unit', '단위', { w: '48px' })));
      tr.appendChild(h('td', null, mkc('qty', '수량', { num: true, w: '60px' })));
      tr.appendChild(h('td', null, mkc('unitPrice', '단가', { num: true, w: '84px' }), note));
      tr.appendChild(h('td', null, mkc('cp', '쿠팡 금액', { num: true, w: '92px' })));
      tr.appendChild(h('td', null, mkc('st', '11번가 금액', { num: true, w: '92px' })));
      tr.appendChild(h('td', null, mkc('gm', 'G마켓 금액', { num: true, w: '92px' })));
      tbody.appendChild(tr);
      upd(true);
    });
    const sumRow = h('tr', { class: 'cmp-sum' }, h('td', { text: '합계', colspan: '5' }));
    ['cp', 'st', 'gm'].forEach((k) => { totEls[k] = h('b', { text: '' }); sumRow.appendChild(h('td', { class: 'cmp-r' }, totEls[k])); });
    tbody.appendChild(sumRow);
    body.appendChild(h('div', { class: 'cmp-fsec', text: '품목 (서류에 들어갈 값을 고칠 수 있습니다)' }));
    body.appendChild(h('div', { style: 'overflow-x:auto' }, h('table', { class: 'cmp-table cmp-itbl' },
      h('thead', null, h('tr', null, ['품명', '규격', '단위', '수량', '단가', '쿠팡 금액', '11번가 금액', 'G마켓 금액'].map((t) => h('th', { text: t })))), tbody)));
    body.appendChild(h('div', { class: 'cmp-hint', text: '규격은 쿠팡 옵션에서 가져옵니다(free·프리 표시는 뺌). 수량은 쿠팡 주문 수량, 단가는 쿠팡 금액 ÷ 수량입니다. 서류의 금액은 단가가 아니라 쿠팡 금액을 씁니다. 11번가·G마켓 금액이 비어 있으면 서류에도 빈칸으로 둡니다.' }));

    // ---- 배송비 ----
    body.appendChild(h('div', { class: 'cmp-fsec', text: '배송비 (원, 없으면 0)' }));
    const shipGrid = h('div', { class: 'cmp-fgrid', style: 'grid-template-columns:repeat(3,1fr)' });
    [['cp', '쿠팡'], ['st', '11번가'], ['gm', 'G마켓']].forEach(([k, label]) => {
      const inp = h('input', { type: 'number', value: String(ship[k]) });
      inp.setAttribute('min', '0');
      inp.setAttribute('aria-label', label + ' 배송비');
      inp.addEventListener('input', () => { ship[k] = inp.value; onEdit(); });
      shipIn[k] = inp;
      shipGrid.appendChild(h('label', { class: 'cmp-f' }, h('span', { text: label }), inp));
    });
    body.appendChild(shipGrid);
    body.appendChild(h('div', { class: 'cmp-hint', text: '11번가·G마켓은 담은 상품에 기록된 배송비("3,000원")를 더한 값이고 "무료"는 0입니다. 같은 판매자 배송비가 겹쳤다면 고쳐 주세요.' }));

    derive();

    // ---- 만들기 ----
    const collect = () => {
      const need = (v, name) => { if (!String(v == null ? '' : v).trim()) throw new Error(name + '을(를) 입력하세요'); };
      if (!(F.incDraft || F.incSurvey || F.incQuote || F.incInsp)) throw new Error('만들 쪽을 하나 이상 고르세요');
      need(F.docNo, '문서번호'); need(F.docDate, '기안일'); need(F.title, '제목');
      const items = rows.map((r, i) => {
        if (!String(r.pname).trim()) throw new Error('품목 ' + (i + 1) + '의 품명을 입력하세요');
        const qty = parseInt(r.qty, 10);
        if (!(qty > 0)) throw new Error('품목 ' + (i + 1) + '의 수량을 확인하세요');
        const orNull = (v) => (String(v == null ? '' : v).trim() === '' ? null : num(v));
        return { pname: String(r.pname).trim(), spec: String(r.spec).trim(), unit: String(r.unit).trim() || '개', qty, unitPrice: num(r.unitPrice) || 0, cpTotal: num(r.cp) || 0, stTotal: orNull(r.st), gmTotal: orNull(r.gm) };
      });
      const lines = [{ label: '내용', text: F.content }, { label: '일시', text: F.when }, { label: '장소', text: F.place }, { label: '대상', text: F.target },
        { label: '지출처', text: F.vendor }, { label: '지출일', text: F.payDate }, { label: '지출방법', text: F.payMethod }]
        .map((x) => ({ label: x.label, text: String(x.text || '').trim() })).filter((x) => x.text);
      return {
        draft: {
          include: !!F.incDraft, title: F.title.trim(), intro: F.intro.trim(), lines,
          budget: { gwan: F.gwan.trim(), hang: F.hang.trim(), mok: F.mok.trim(), semok: F.semok.trim(), source: F.source },
          attachments: F.attach.split('\n').map((x) => x.trim()).filter(Boolean),
          docNo: F.docNo.trim(), docDate: F.docDate.trim(), approvers: [F.ap1, F.ap2, F.ap3].map((x) => String(x || '').trim()),
        },
        items,
        shipping: { cp: num(ship.cp) || 0, st: num(ship.st) || 0, gm: num(ship.gm) || 0 },
        survey: { include: !!F.incSurvey, vendors: [F.v1, F.v2, F.v3].map((x) => String(x || '').trim()), date: F.survDate.trim(), surveyor: F.surveyor.trim(), checker: F.checker.trim(), decision: F.decision.trim() },
        quotes: [],
        inspection: {
          include: !!F.incInsp, contractName: F.contractName.trim(), supplier: F.supplier.trim(), dueDate: F.dueDate.trim(), amount: num(F.amount) || 0,
          inspectDate: F.inspectDate.trim(), contractDate: F.contractDate.trim(), place: F.invPlace.trim(), inspector: F.inspector.trim(), witness: F.witness.trim(),
        },
      };
    };
    // 만든 결과에서 파일 바이트와 경고 목록을 꺼낸다 (build는 바이트만, buildWithReport는 {바이트, 경고}를 돌려준다)
    const unpack = (res) => {
      if (res instanceof Uint8Array) return { bytes: res, warnings: [] };
      if (res && typeof res === 'object') {
        const bytes = res.bytes || res.data || res.hwpx || res.file || res.output || null;
        let w = res.warnings || (res.report && (res.report.warnings || res.report)) || [];
        if (!Array.isArray(w)) w = typeof w === 'string' ? [w] : [];
        return { bytes, warnings: w.map((x) => (x && typeof x === 'object' ? (x.message || x.msg || JSON.stringify(x)) : String(x))).filter(Boolean) };
      }
      return { bytes: null, warnings: [] };
    };
    let building = false;
    const buildBtn = h('button', { class: 'cmp-btn cmp-primary', text: '만들기', onclick: async () => {
      if (building) return;
      building = true;
      buildBtn.disabled = true;
      try {
        say('');
        const B = getHwpx();
        if (!B || (typeof B.build !== 'function' && typeof B.buildWithReport !== 'function')) { say(HWPX_MISSING, 'err'); return; }
        const data = collect();
        saveDocPrefs(F);
        if (F.incQuote) data.quotes = await buildQuotes(capSites);
        if (F.incQuote && !data.quotes.length) throw new Error('저장된 견적서 그림이 없습니다. "견적서(캡처)" 체크를 끄거나 다시 캡처해 주세요');
        say('서류를 만드는 중…', 'ok');
        const res = typeof B.buildWithReport === 'function' ? await B.buildWithReport(data) : await B.build(data);
        const out = unpack(res);
        if (!out.bytes || !out.bytes.length) throw new Error('서류 파일을 만들지 못했습니다');
        const fname = safeFileName(data.draft.docNo + ' ' + mmddOf(data.draft.docDate, now) + ' ' + data.draft.title) + '.hwpx';
        capDownload(new Blob([out.bytes], { type: 'application/hwp+zip' }), fname);
        say('만들었습니다: ' + fname + ' (내려받기 폴더를 확인하세요)', 'ok');
        if (out.warnings.length) {
          msg.className = 'cmp-msg cmp-warn';
          msg.appendChild(h('div', { style: 'margin-top:4px;font-weight:700', text: '확인할 점' }));
          out.warnings.forEach((w) => msg.appendChild(h('div', { text: '· ' + w })));
        }
      } catch (e) {
        say('서류를 만들지 못했습니다: ' + errMsg(e), 'err');
      } finally {
        building = false;
        buildBtn.disabled = false;
      }
    } });
    const foot = [buildBtn,
      h('button', { class: 'cmp-btn', text: '요약으로 돌아가기', onclick: () => showSummary() }),
      h('button', { class: 'cmp-btn', text: '닫기', onclick: closeModal }),
      msg];
    openModal('물품구입비 서류 만들기 (hwpx)', body, foot, true);
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
