/* 기안 폴더 자동 읽기: ‘손잡다’ 폴더를 한 번 연결하면 연도 폴더(2026~)의 ‘02. 내부기안’과
   ‘40. 결산, 사업별 계정과목’을 읽어 사업 계획 버전·회차 기안·예산서를 채움.
   폴더는 읽기만 함. 파일별로 읽은 결과를 기억해 두고 새로 생기거나 바뀐 파일만 다시 읽음.
   사람이 고친 계획·기안은 덮어쓰지 않음(자동으로 넣은 그대로일 때만 새 내용으로 바꿈). */
(function () {
  'use strict';
  const D = () => window.GDICT, RV = () => window.GREVIEW;
  const START_YEAR = 2026; // 이 앱을 쓰기 시작한 해. 그 앞 연도 폴더는 서식이 달라 읽지 않음
  const nospace = s => String(s == null ? '' : s).replace(/\s+/g, '');
  const toNum = s => +String(s).replace(/[,\s]/g, '');
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const iso = (y, m, d) => y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  const dayOf = ms => { const d = new Date(ms); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
  const PERSON = ['개별자립지원', '개별동료상담', '자립생활프로그램']; // 회차 표 대신 사람별(자립생활프로그램은 교육별)로 관리

  /* ---------- 폴더 훑기 ---------- */
  async function* walk(dir, path, depth) {
    for await (const [name, h] of dir.entries()) {
      const p = path ? path + '/' + name : name;
      if (h.kind === 'directory') { if (depth < 4) yield* walk(h, p, depth + 1); }
      else yield { name, path: p, handle: h };
    }
  }
  async function kids(dir) { const out = []; for await (const [name, h] of dir.entries()) if (h.kind === 'directory') out.push({ name, h }); return out; }
  const isGianDir = n => /내부기안$/.test(n.trim()) && !/스캔/.test(n);
  const isBudgetDir = n => /^40\b|계정과목/.test(n.trim());
  const isScanDir = n => /내부기안\s*스캔/.test(n);
  /* 고른 폴더가 ‘손잡다’(연도 폴더 위)인지, 연도 폴더인지, 내부기안 폴더인지 보고 읽을 곳을 정함 */
  async function places(root) {
    const out = [], ym = /^(20\d{2})$/.exec(root.name);
    const yearDir = async (y, h, base) => {
      const p = { year: y, gian: null, budget: null, scan: null, base };
      for (const k of await kids(h)) {
        const v = { h: k.h, path: base + '/' + k.name };
        if (isGianDir(k.name)) p.gian = v; else if (isScanDir(k.name)) p.scan = v; else if (isBudgetDir(k.name)) p.budget = v;
      }
      if (p.gian || p.budget) out.push(p);
    };
    if (ym) await yearDir(+ym[1], root, root.name);
    else if (isGianDir(root.name)) out.push({ year: new Date().getFullYear(), gian: { h: root, path: root.name }, budget: null, base: '' });
    else for (const k of await kids(root)) { const m = /^(20\d{2})$/.exec(k.name); if (m && +m[1] >= START_YEAR) await yearDir(+m[1], k.h, k.name); }
    return out.sort((a, b) => a.year - b.year);
  }
  async function hasYears(root) { try { return (await places(root)).length > 0; } catch (e) { return false; } }

  /* ---------- 기안 한 건에서 뽑기 ---------- */
  const field = (L, name) => { for (const l of L) { const m = new RegExp('^\\d+\\.\\s*' + name + '\\s*[:：]\\s*(.*)$').exec(l); if (m) return m[1].trim(); } return null; };
  const moneyOf = s => { if (s == null) return null; if (/없음/.test(s)) return 0; const m = /금\s*([\d,]+)\s*원/.exec(s) || /([\d,]+)\s*원/.exec(s); return m ? toNum(m[1]) : null; };
  const cellNum = c => { const m = /^\s*([\d,]+)\s*원?\s*$/.exec(c || ''); return m ? toNum(m[1]) : null; };
  /* ‘12,0000원’처럼 쉼표 자리가 틀린 숫자 */
  const badComma = t => /\d,\d/.test(t) && String(t).replace(/원.*$/, '').trim().split(',').slice(1).some(g => g.length !== 3);
  const won = n => (+n || 0).toLocaleString('ko-KR') + '원';
  function lcsRatio(a, b) {
    if (!a.length || !b.length) return 0;
    let prev = new Uint16Array(b.length + 1);
    for (let i = 1; i <= a.length; i++) { const cur = new Uint16Array(b.length + 1); for (let j = 1; j <= b.length; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]); prev = cur; }
    return 2 * prev[b.length] / (a.length + b.length);
  }
  /* 예산서에 없는 계정 문구 → 예산서에서 가장 비슷한 계정(세목은 두 배로 봄). all: [{fund, path}] */
  function suggestAcct(segs, all) {
    const w = segs.map(nospace); let best = null, bs = 0;
    for (const c of all) {
      const cs = c.path.split('/').map(nospace); if (cs.length !== w.length) continue;
      let sc = 0;
      cs.forEach((x, i) => { const y = w[i], wt = i === cs.length - 1 ? 2 : 1; sc += wt * (x === y ? 1 : x && y && (x.includes(y) || y.includes(x)) ? 0.7 : lcsRatio(x, y) >= 0.6 ? 0.5 : 0); });
      if (sc > bs) { bs = sc; best = c; }
    }
    return bs >= 3.5 ? best : null;
  }
  /* 산출근거 한 칸: ‘식비 1,000원×2명×3회=6,000원 다과비 …’ → 품목별 단가·수량·금액 */
  const IT = /(?<![가-힣A-Za-z0-9,])([가-힣A-Za-z][가-힣A-Za-z0-9()·\/\s]*?)\s*(\([^)]*\))?\s*([\d,]+)\s*원\s*(\([^)]*\))?((?:\s*[×xX*]\s*[\d.,]+\s*[가-힣A-Za-z]*)+)\s*=\s*([\d,]+)\s*원(?:\s*중\s*([\d,]+)\s*원)?/g;
  function parseBasis(text) {
    const out = [];
    for (const m of String(text || '').replace(/\s+/g, ' ').matchAll(IT)) {
      let item = (m[1] + (m[2] || '')).replace(/\((평균|약)\)/g, '').replace(/\s+/g, ' ').trim();
      item = item.replace(/^(계|합계|소계)\s*/, '');
      const qty = m[5].split(/[×xX*]/).map(s => s.trim()).filter(Boolean).join(' × ');
      const price = toNum(m[3]), amount = toNum(m[6]), part = m[7] ? toNum(m[7]) : null;
      if (part != null) { out.push({ item: item + ' (일부)', price: part, qty: '1식', amount: part, basis: m[0].trim() }); continue; }
      const it = { item, price, qty, amount };
      if (badComma(m[6])) { // 금액 쉼표 오타: 단가 × 수량으로 맞는 금액을 봄
        const prod = Math.round(price * (qty.match(/\d+(?:\.\d+)?/g) || []).reduce((a, b) => a * +b, 1));
        it.typo = m[6] + '원'; if (prod) it.amount = prod;
      }
      out.push(it);
    }
    // ×·= 없이 금액만 적은 줄: 배송비·할인·쿠폰 등(할인·쿠폰은 빼기)
    const rest = String(text || '').replace(/\s+/g, ' ').replace(IT, ' ');
    for (const m of rest.matchAll(/(배송비|택배비|운송비|할인|쿠폰\s*할인|쿠폰|적립금\s*사용|포인트\s*사용)\s*[:：]?\s*([-△▲−]?)\s*([\d,]+)\s*원/g)) {
      const neg = !!m[2] || /할인|쿠폰|적립|포인트/.test(m[1]), v = (neg ? -1 : 1) * toNum(m[3]);
      out.push({ item: m[1].replace(/\s+/g, ' '), price: v, qty: '1식', amount: v });
    }
    return out;
  }
  /* 예산과목 표(관·항·목·세목): 줄마다 계정 경로·재원·금액·품목 */
  function acctRows(doc) {
    for (const t of doc.blocks.filter(b => b.type === 'table')) {
      const hi = t.rows.findIndex(r => { const n = r.map(nospace); return n.includes('관') && n.includes('항') && n.includes('목') && n.includes('세목'); });
      if (hi < 0) continue;
      const head = t.rows.slice(Math.max(0, hi - 1), hi + 1);
      const col = re => { for (const r of head.slice().reverse()) { const i = r.findIndex(c => re.test(nospace(c))); if (i >= 0) return i; } return -1; };
      const fundCols = { '보조금': col(/^보조금$/), '자부담': col(/^자부담$/) };
      const basisCol = col(/산출근거/), totalCol = col(/^총액$|^금액$|^예산$/), srcCol = col(/^재원$/);
      const rows = [], last = ['', '', '', ''];
      for (const r of t.rows.slice(hi + 1)) {
        const first = nospace(r.find(c => c.trim()) || '');
        if (/^(총계|합계|계)$/.test(first)) break;
        const acct = [0, 1, 2, 3].map(i => { const v = (r[i] || '').replace(/\s+/g, ' ').trim(); if (v) last[i] = v; return last[i]; });
        if (!acct[3]) continue;
        let fund = null, amount = null;
        for (const f of ['보조금', '자부담']) { const i = fundCols[f]; if (i >= 0) { const v = cellNum(r[i]); if (v) { fund = f; amount = v; break; } } }
        if (!fund && srcCol >= 0) { const s = nospace(r[srcCol]); fund = /자부담/.test(s) ? '자부담' : /보조금/.test(s) ? '보조금' : null; amount = cellNum(r[totalCol]); }
        if (!fund) { fund = fundCols['자부담'] >= 0 && fundCols['보조금'] < 0 ? '자부담' : '보조금'; amount = totalCol >= 0 ? cellNum(r[totalCol]) : null; }
        const basis = r[basisCol >= 0 ? basisCol : 4] || '';
        const row = { acct, fund, amount, items: parseBasis(basis) };
        const raw = [fundCols['보조금'], fundCols['자부담'], totalCol].map(i => i >= 0 ? (r[i] || '').trim() : '').find(t => cellNum(t) === amount && t);
        if (raw && badComma(raw)) { // 표 금액 쉼표 오타: 산출근거 합이 금액의 1/10이면 그것으로 봄
          const sumIt = row.items.reduce((a, x) => a + x.amount, 0);
          row.typo = { raw, fixed: sumIt && (sumIt * 10 === amount || Math.abs(sumIt - amount / 10) < 1) ? sumIt : amount };
          row.amount = row.typo.fixed;
        }
        rows.push(row);
      }
      if (rows.length) return rows;
    }
    return [];
  }
  /* 계정 경로를 예산서 문구로 맞춤(띄어쓰기만 다르면 예산서 문구로) */
  function canonAcct(segs, fund, leaf) {
    const key = segs.map(nospace).join('/');
    const hit = (leaf(fund) || []).find(p => p.split('/').map(nospace).join('/') === key);
    return hit || segs.map(s => s.replace(/\s+/g, '')).join('/');
  }
  function extract(doc, path, mt) {
    const L = doc.lines, meta = RV().docMeta(doc);
    const sum = { path, name: doc.name, mt, kind: meta.kind, sub: meta.sub, unit: meta.unit, year: meta.year, no: meta.fileOk ? '손잡다' + String(meta.year).slice(2) + '-' + meta.no : '', title: meta.fileTitle || meta.bodyTitle };
    if (!meta.isGian || !meta.fileOk) { sum.skip = '기안문이 아님'; return sum; }
    if (!meta.sub) { sum.skip = '세부사업을 알 수 없음'; return sum; }
    sum.status = /(^|\/)결재요청/.test(path.split('/').slice(2).join('/')) ? '결재 요청' : '결재 완료';
    if (/^0+$/.test(meta.no)) sum.status = '작성 중';
    sum.date = meta.mmdd && meta.mmdd !== '0000' ? iso(meta.year, +meta.mmdd.slice(0, 2), +meta.mmdd.slice(2)) : dayOf(mt);
    const q = /([1-4])\s*분기/.exec(meta.title);
    sum.n = meta.round || meta.session || (q ? +q[1] : null);
    sum.rows = acctRows(doc);
    sum.per = meta.round ? '차' : meta.session ? '회기' : q ? '분기' : null;
    const st = RV().settleOf(doc);
    if (st) sum.settle = { budget: st.budget, spent: st.spent, reason: st.reason, items: parseBasis(st.spentBasis) };
    sum.inspect = L.some(l => /검\s*수\s*조\s*서|검수하였음/.test(l));
    const pm = /(?:개별자립지원|개별동료상담)\s*\(([^)]+)\)\s*(.*)$/.exec(meta.title);
    if (pm) { sum.persons = pm[1].split(/[,，、]/).map(x => x.trim()).filter(Boolean); if (meta.kind === '연계') sum.link = pm[2].replace(/\s*연계\s*$/, '').trim(); }
    if (meta.sub === '자립생활프로그램') { // 교육(강좌)별: ‘한소네 교육(이름)’, 월별 강사비는 공통
      const rest = meta.title.replace(/^.*?자립생활\s*프로그램\s*/, '').replace(/\s*(수정\s*)?(운영\s*)?(계획(\s*변경)?|변경\s*계획|결과\s*보고|진행비|강사비|통역비|교육비|재료비|다과비|물품\s*구입비?|홍보비|참여자\s*모집(\s*홍보)?)\s*$/, '').trim();
      sum.persons = rest && !/^\d+\s*월$/.test(rest) ? [rest] : [];
    }
    const planKinds = ['사업계획', '변경계획'];
    if (planKinds.includes(meta.kind) && !sum.n && /사업\s*(변경\s*)?계획/.test(meta.title)) {
      sum.plan = true;
      const g = L.map(l => /(\d+)\s*명\s*\/\s*(\d+)\s*명\s*\/\s*(\d+)\s*회/.exec(l)).find(Boolean);
      sum.goals = g ? { real: +g[1], total: +g[2], count: +g[3] } : null;
      if (meta.kind === '변경계획') { // 기안문의 변경내역 표(변경 후 실인원·연인원·횟수)
        for (const t of doc.blocks.filter(b => b.type === 'table')) {
          if (!t.rows.some(r => r.some(c => /변경\s*후/.test(c)))) continue;
          const row = t.rows.find(r => D().subOf(r[0] || '') === meta.sub || nospace(r[0]) === nospace(meta.sub));
          if (row) { const v = row.slice(1).map(c => cellNum(c)); if (v.length >= 8 && v[4] != null) sum.goalsTable = { real: v[4], total: v[5], count: v[6] }; }
          break;
        }
        sum.reason = field(L, '변경\\s*사유');
      }
      sum.budget = moneyOf(field(L, '예산'));
    } else {
      const content = field(L, '내용') || '';
      const act = /\d+\s*차\s*[\[(]([^\])]+)[\])]/.exec(content);
      sum.activity = act ? act[1].trim() : '';
      const dt = field(L, '일시') || '';
      const d1 = /(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(dt) || /(20\d{2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})/.exec(dt);
      sum.eventDate = d1 ? iso(+d1[1], +d1[2], +d1[3]) : '';
      const tg = field(L, '대상') || '';
      const tot = /총\s*(\d+)\s*명/.exec(tg) || /(\d+)\s*명/.exec(tg);
      sum.people = tot ? +tot[1] : null;
      if (/총\s*\d+\s*명/.test(tg) && /,/.test(tg)) sum.names = tg.replace(/\(?\s*총\s*\d+\s*명\s*\)?/, '').split(/[,，、]/).map(s => s.trim()).filter(s => /^[가-힣A-Za-z]{2,10}$/.test(s));
      sum.money = moneyOf(field(L, '결산') != null ? field(L, '결산') : field(L, '예산'));
    }
    return sum;
  }

  /* ---------- 예산서 파일 ---------- */
  function budgetEntries(name, path, mt, folderYear) {
    const fund = /자립지원사업/.test(name) ? '보조금' : /자체/.test(name) ? '자부담' : null;
    if (!fund) return { skip: '보조금(자립지원사업)·자부담(자체사업) 예산서가 아님' };
    const ym = /(20\d{2})/.exec(name) || /(?:^|\D)(\d{2})\.\s*\d{1,2}\s*월/.exec(name);
    const year = ym ? (ym[1].length === 2 ? 2000 + +ym[1] : +ym[1]) : folderYear;
    let date = null;
    const qm = /([1-4])\s*분기/.exec(name), hm = /1\s*월\s*~\s*(\d{1,2})\s*월/.exec(name), dm = /\((20\d{2})(\d{2})(\d{2})\)/.exec(name), mm = /\d{2}\.\s*(\d{1,2})\s*월/.exec(name);
    const end = m => iso(year, m, new Date(year, m, 0).getDate());
    if (qm) date = end(+qm[1] * 3); else if (hm) date = end(+hm[1]); else if (dm) date = iso(+dm[1], +dm[2], +dm[3]); else if (mm) date = end(+mm[1]);
    return { fund, year, date: date || dayOf(mt) };
  }

  /* ---------- 문서대장(.xlsx) ---------- */
  async function xlsxRows(buf) {
    const files = await GCFB.unzip(buf, n => /^xl\/(sharedStrings|workbook)\.xml$|^xl\/worksheets\/sheet\d+\.xml$|^xl\/_rels\/workbook\.xml\.rels$/.test(n));
    const dec = new TextDecoder('utf-8'), txt = n => files[n] ? dec.decode(files[n]) : '';
    const ent = x => x.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
    const tOf = x => ent([...x.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]).join(''));
    const ss = [...txt('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => tOf(m[1]));
    const wb = txt('xl/workbook.xml'), rels = txt('xl/_rels/workbook.xml.rels');
    const sheets = [...wb.matchAll(/<sheet\b([^>]*)\/?>/g)].map(m => ({ hidden: /state="(hidden|veryHidden)"/.test(m[1]), rid: (/r:id="([^"]+)"/.exec(m[1]) || [])[1] }));
    const pick = sheets.find(x => !x.hidden) || sheets[0];
    let target = 'xl/worksheets/sheet1.xml';
    if (pick && pick.rid) for (const r of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) if (new RegExp('Id="' + pick.rid + '"').test(r[1])) { const t = (/Target="([^"]+)"/.exec(r[1]) || [])[1]; if (t) target = 'xl/' + t.replace(/^\/?(xl\/)?/, ''); }
    const rows = [];
    for (const rm of (txt(target) || txt('xl/worksheets/sheet1.xml')).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const row = [];
      for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = (/r="([A-Z]+)\d+"/.exec(cm[1]) || [])[1], t = (/t="([^"]+)"/.exec(cm[1]) || [])[1], body = cm[2] || '';
        let v = (/<v>([\s\S]*?)<\/v>/.exec(body) || [])[1];
        if (t === 's') v = ss[+v]; else if (t === 'inlineStr') v = tOf(body); else if (v != null) v = ent(v);
        if (ref) { let ci = 0; for (const ch of ref) ci = ci * 26 + ch.charCodeAt(0) - 64; row[ci - 1] = v == null ? '' : String(v); }
      }
      rows.push(Array.from(row, x => x == null ? '' : x));
    }
    return rows;
  }
  /* 대장 줄: { no: '손잡다26-0000', date, title, who } (번호만 있고 날짜·제목이 비면 빈 번호) */
  function ledgerOf(rows) {
    const hi = rows.findIndex(r => r.some(c => /^기안번호$/.test(nospace(c))));
    if (hi < 0) return [];
    const head = rows[hi].map(nospace), col = re => head.findIndex(c => re.test(c));
    const cd = col(/^날짜$|^일자$|기안일/), cn = col(/^기안번호$/), ct = col(/제목/), cw = col(/담당/);
    const out = [];
    for (const r of rows.slice(hi + 1)) {
      const m = /(\d{2})\s*-\s*(\d+)/.exec(r[cn] || ''); if (!m) continue;
      let d = String(r[cd] || '').trim();
      if (/^\d+(\.\d+)?$/.test(d)) d = dayOf(Date.UTC(1899, 11, 30) + Math.floor(+d) * 864e5 + new Date().getTimezoneOffset() * 6e4);
      else { const x = /(20\d{2})\D+(\d{1,2})\D+(\d{1,2})/.exec(d); d = x ? iso(+x[1], +x[2], +x[3]) : ''; }
      out.push({ no: '손잡다' + m[1] + '-' + m[2].padStart(4, '0'), date: d, title: String(r[ct] || '').trim(), who: cw >= 0 ? String(r[cw] || '').trim() : '' });
    }
    return out;
  }

  /* ---------- 읽기 ---------- */
  async function scan(root, cache, onProgress) {
    const list = [], ledgers = [], out = { docs: [], budgets: [], errors: [], read: 0, reused: 0, scans: [], ledger: [] };
    for (const p of await places(root)) {
      // 스캔본은 이름만 봄(대부분 사진이라 글자를 읽을 수 없음): 문서번호별로 스캔본이 있는지
      if (p.scan) try { for await (const f of walk(p.scan.h, p.scan.path, 0)) { const m = /손잡다(\d{2})-(\d+)/.exec(f.name); if (m) out.scans.push('손잡다' + m[1] + '-' + m[2]); } } catch (e) { out.errors.push(p.scan.path + ': ' + (e && e.message || e)); }
      if (p.gian) for await (const f of walk(p.gian.h, p.gian.path, 0)) {
        if (/\.hwpx?$/i.test(f.name)) list.push(Object.assign(f, { area: 'gian', year: p.year }));
        else if (/문서\s*대장.*\.xlsx$/i.test(f.name) && f.path.split('/').length === 3) ledgers.push(Object.assign(f, { year: p.year })); // 내부기안 폴더 바로 아래 것만
      }
      if (p.budget) for await (const f of walk(p.budget.h, p.budget.path, 0)) if (/\.xls$/i.test(f.name)) list.push(Object.assign(f, { area: 'budget', year: p.year }));
    }
    let i = 0;
    for (const f of list) {
      i++; if (onProgress && (i % 5 === 0 || i === list.length)) onProgress(i, list.length);
      try {
        const file = await f.handle.getFile();
        const c = cache[f.path];
        if (c && c.mt === file.lastModified && c.size === file.size) { out.reused++; (f.area === 'gian' ? out.docs : out.budgets).push(c.sum); continue; }
        let sum;
        if (f.area === 'gian') { const doc = await GHWP.readDoc(file); doc.name = f.name; sum = extract(doc, f.path, file.lastModified); }
        else {
          const be = budgetEntries(f.name, f.path, file.lastModified, f.year);
          sum = { path: f.path, name: f.name, mt: file.lastModified, ...be };
          if (!be.skip) {
            const parsed = GXLS.parseBudget(GXLS.readBiff(new Uint8Array(await file.arrayBuffer())));
            if (!parsed.length) sum.skip = '예산서 형식이 아님';
            else {
              const pb = parsed[0], trees = pb.format === 'change' ? pb.trees.slice(-1) : pb.trees.slice(0, 1);
              sum.kind = pb.format === 'settle' ? '결산' : pb.format === 'change' ? '변경 예산' : /수정/.test(f.name) ? '변경 예산' : '당초 예산';
              if (sum.kind === '당초 예산') sum.date = sum.year + '-01-01';
              sum.label = pb.format === 'change' ? (pb.labels[pb.labels.length - 1] || '') : '';
              const t = trees[0];
              sum.income = t.income.map(x => ({ level: x.level, name: x.name, path: x.path, budget: x.budget }));
              sum.expense = t.expense.map(x => ({ level: x.level, name: x.name, path: x.path, budget: x.budget, cum: x.cum != null ? x.cum : null }));
            }
          }
        }
        cache[f.path] = { mt: file.lastModified, size: file.size, sum };
        out.read++; (f.area === 'gian' ? out.docs : out.budgets).push(sum);
      } catch (e) { out.errors.push(f.path + ': ' + (e && e.message || e)); }
    }
    for (const f of ledgers) {
      try {
        const file = await f.handle.getFile(), c = cache[f.path];
        let rows;
        if (c && c.mt === file.lastModified && c.size === file.size) rows = c.ledger;
        else { rows = ledgerOf(await xlsxRows(await file.arrayBuffer())); cache[f.path] = { mt: file.lastModified, size: file.size, ledger: rows }; }
        out.ledger.push(...rows);
      } catch (e) { out.errors.push(f.path + ': ' + (e && e.message || e)); }
    }
    for (const k of Object.keys(cache)) if (!list.some(f => f.path === k) && !ledgers.some(f => f.path === k)) delete cache[k]; // 없어진 파일
    out.total = list.length;
    return out;
  }

  /* ---------- 앱 자료에 합치기 ---------- */
  const vHash = v => JSON.stringify([v.kind, v.no, v.date, v.status, v.goals, v.reason || '', v.lines.map(l => [l.item, l.fund, l.acct, l.price, l.qty])]);
  const dHash = d => JSON.stringify([d.kind, d.no, d.date, d.title, d.status, d.spends, d.extra || [], d.when || '', d.attend || '', d.settle == null ? '' : d.settle, d.planned == null ? '' : d.planned, d.settled == null ? '' : d.settled, !!d.hasSettle, !!d.hasInspect, !!d.scan, d.budget == null ? '' : d.budget, (d.persons || []).join(','), d.link || '']);
  // 앞 버전들이 저장한 확인값도 받음(사람이 고쳤는지 볼 때)
  const dHash1 = d => JSON.stringify([d.kind, d.no, d.date, d.title, d.status, d.spends, d.attend || '', d.settle == null ? '' : d.settle]);
  const dHash2 = d => JSON.stringify([d.kind, d.no, d.date, d.title, d.status, d.spends, d.attend || '', d.settle == null ? '' : d.settle, d.planned == null ? '' : d.planned, d.settled == null ? '' : d.settled, !!d.hasSettle, !!d.hasInspect, !!d.scan, d.budget == null ? '' : d.budget, (d.persons || []).join(','), d.link || '']);
  const isAuto = d => !!d.auto && (d.auto === dHash(d) || d.auto === dHash2(d) || d.auto === dHash1(d));
  /* 번호를 새로 받을 기안 o({title, date})에 대장 기준 번호 추천: 대장에 이미 올라 있으면 그 번호, 아니면 그 날짜 앞뒤 빈 번호 */
  function numberTip(o, ledger, used, skipNo) {
    const L = ledger || [], md = d => (d || '').slice(5).replace('-', '/'), sim = (a, b) => lcsRatio(normT(a), normT(b));
    if (!L.length) return '문서대장을 아직 읽지 않아 번호를 추천하지 못함';
    // 같은 기안: 제목이 거의 같고, 제목 속 숫자(차수·월·회 등)가 모두 같을 때만
    const nums = t => (String(t).match(/\d+/g) || []).join(',');
    const reg = L.find(e => e.no !== skipNo && e.title && nums(e.title) === nums(o.title) && sim(e.title, o.title) >= 0.85);
    if (reg && used && used.has(reg.no)) return '‘' + o.title + '’은(는) 대장과 내부기안 폴더에 이미 ' + reg.no.slice(-4) + '로 있음 → 이 파일이 미리 작성한 사본인지 확인';
    if (reg) return '‘' + o.title + '’은(는) 대장에 ' + reg.no.slice(-4) + '로 올라 있음 → 파일 이름과 시행 칸을 ' + reg.no.slice(-4) + '로 고치면 됨';
    const d = o.date || '', cand = [];
    let prevDate = '';
    L.forEach((e, i) => {
      if (e.date) { prevDate = e.date; return; }
      if (e.title || (used && used.has(e.no))) return;
      const next = (L.slice(i + 1).find(x => x.date) || {}).date || '9999';
      if (prevDate <= d && d <= next) cand.push({ e, prevDate, next });
    });
    if (cand.length) return '‘' + o.title + '’(' + md(d) + ')은(는) 대장의 빈 번호 ' + cand.slice(0, 3).map(c => c.e.no.slice(-4)).join(', ') + ' 중 하나를 추천(앞뒤 기안 ' + md(cand[0].prevDate) + ' ~ ' + (cand[0].next === '9999' ? '끝' : md(cand[0].next)) + ' 사이)';
    const last = L.filter(e => e.title || e.date).slice(-1)[0];
    return '‘' + o.title + '’은(는) 그 날짜 근처에 대장의 빈 번호가 없음 → 대장 다음 번호(' + (last ? String(+last.no.slice(-4) + 1).padStart(4, '0') : '?') + ')를 받으세요';
  }
  /* 같은 번호를 쓴 기안: 대장에 그 번호로 올라 있는 것은 그대로 두고, 나머지에 대장의 빈 번호를 추천 */
  function dupText(no, docs, ledger, used) {
    const md = s => (s.date || '').slice(5).replace('-', '/');
    let text = no + ': 같은 문서번호를 쓴 기안이 ' + docs.length + '건(' + docs.map(s => s.title + ' ' + md(s)).join(' / ') + ')';
    if (!ledger.length) return text + ' → 하나는 번호를 새로 받아야 함(문서대장을 찾지 못해 추천은 못 함)';
    const L = ledger.filter(e => e.no.slice(0, 6) === no.slice(0, 6)), led = L.find(e => e.no === no);
    const sim = (a, b) => lcsRatio(normT(a), normT(b));
    const keep = led && led.title ? docs.slice().sort((a, b) => sim(b.title, led.title) - sim(a.title, led.title))[0] : null;
    if (led && led.title) text += '. 문서대장에는 ‘' + led.title + '’(' + (led.date || '').slice(5).replace('-', '/') + ')로 올라 있음';
    const others = docs.filter(d => d !== keep);
    const tips = others.map(o => numberTip(o, L, used, no));
    return text + ' → ' + (keep ? '‘' + keep.title + '’은(는) 그대로, ' : '') + tips.join('; ');
  }
  /* 빈 회차 정리: 기안이 없고, 계획 회차 일정에 없고, 사람이 만든 것도 아닌 회차는 뺌. 분기 → 차 → 회기 순 */
  function tidyRounds(P) {
    const inSched = n => P.versions.some(v => (v.schedule || []).some(x => x.n === n));
    P.rounds = P.rounds.filter(r => r.docs.length || r.manual || ((r.unit || '차') === '차' && inSched(r.n)));
    const ord = { '분기': 0, '차': 1, '회기': 2 };
    P.rounds.sort((a, b) => (ord[a.unit || '차'] - ord[b.unit || '차']) || a.n - b.n);
  }
  /* 품목 금액 합을 target에 맞춤(정산서 품목을 못 나눴을 때 큰 품목부터 덜어 냄) */
  function fitTo(items, target) {
    const out = items.map(x => Object.assign({}, x)); let diff = out.reduce((a, x) => a + x.amount, 0) - target;
    for (const x of out.slice().sort((a, b) => b.amount - a.amount)) { if (diff <= 0) break; const t = Math.min(diff, x.amount); x.amount -= t; diff -= t; }
    return out;
  }
  const ROUND_KIND = k => k === '변경계획' ? '계획' : k;
  const normT = t => nospace(t).replace(/[()（）‘’'"“”]/g, '');
  const docKey = s => /-0+$/.test(s.no) || !s.no ? s.path : s.no + '|' + normT(s.title);
  const sameDoc = (d, s) => d.src === s.path || (s.no && !/-0+$/.test(s.no) && d.no === s.no && normT(d.title) === normT(s.title));
  function apply(data, res, ctx) {
    const rep = { budgets: 0, versions: 0, docs: 0, updated: 0, notes: [], skipped: {}, skippedList: {}, pending: {} };
    const scans = new Set(res.scans || []);
    const leafAll = y => ['보조금', '자부담'].flatMap(f => (ctx.leafPaths(y, f) || []).map(path => ({ fund: f, path })));
    const note = (sub, text, lv) => rep.notes.push({ sub, text, lv: lv || 'mid' });
    const skip = (why, n, s) => {
      rep.skipped[why] = (rep.skipped[why] || 0) + (n || 1);
      const L = rep.skippedList[why] = rep.skippedList[why] || [];
      if (s && L.length < 600) L.push({ no: s.no || '', title: s.title || s.name || '', kind: s.kind || '' });
    };
    // 예산서
    for (const b of res.budgets) {
      if (b.skip) { skip(b.skip, 1, b); continue; }
      if (!b.expense) continue;
      const old = data.budgets.find(x => x.src === b.path);
      if (old && old.srcMt === b.mt) continue;
      if (!old && data.budgets.some(x => !x.src && x.source === b.name)) { skip('이미 손으로 불러온 예산서'); continue; }
      const e = { id: old ? old.id : uid(), at: old ? old.at : Date.now() + rep.budgets, year: b.year, fund: b.fund, kind: b.kind, date: b.date, label: b.label || '', source: b.name, src: b.path, srcMt: b.mt, income: b.income, expense: b.expense };
      if (old) data.budgets[data.budgets.indexOf(old)] = e; else data.budgets.push(e);
      rep.budgets++;
    }
    // 같은 문서번호가 결재요청·내부기안 두 곳에 있으면 내부기안(결재 완료) 것을 씀
    const docs = res.docs.filter(s => !s.skip).sort((a, b) => (a.status === '결재 완료' ? 0 : 1) - (b.status === '결재 완료' ? 0 : 1));
    // 같은 기안인지는 문서번호와 제목으로 봄(번호를 잘못 같이 쓴 서로 다른 기안도 있어서)
    const seen = new Set(), use = [], byNo = {};
    for (const s of docs) {
      const k = docKey(s); if (seen.has(k)) continue; seen.add(k); use.push(s);
      if (!/-0+$/.test(s.no)) (byNo[s.no] = byNo[s.no] || []).push(s);
    }
    const used = new Set(res.docs.map(s => s.no).filter(Boolean));
    for (const no in byNo) if (byNo[no].length > 1) note(byNo[no][0].sub || '기타', dupText(no, byNo[no], res.ledger || [], used));
    res.docs.filter(s => s.skip).forEach(s => skip(s.skip, 1, s));
    // 결재 요청 중인 기안: 결재요청 폴더(사람별 폴더 포함)별로
    for (const s of use) if (s.status === '결재 요청') {
      const parts = s.path.split('/'), i = parts.findIndex(x => /^결재요청/.test(x)), folder = i >= 0 && i + 2 < parts.length ? parts[i + 1] : '결재요청';
      (rep.pending[folder] = rep.pending[folder] || []).push({ no: s.no, title: s.title, kind: s.kind });
    }
    const groups = {};
    for (const s of use) (groups[s.year + '|' + s.sub] = groups[s.year + '|' + s.sub] || []).push(s);
    for (const key in groups) {
      const [y, sub] = key.split('|'), year = +y, list = groups[key].sort((a, b) => a.date.localeCompare(b.date) || a.no.localeCompare(b.no));
      const plans = list.filter(s => s.plan), rounds = list.filter(s => !s.plan);
      if (!plans.length && !rounds.some(s => s.n)) continue;
      const P = ctx.proj(year, sub);
      // 계획 버전 (확인할 것은 매번 다시 만들고, 자료는 처음이거나 파일이 바뀌었을 때만 씀)
      const leaf = f => ctx.leafPaths(year, f) || [];
      const fundOf = (segs, f) => { // 표의 재원 칸보다 예산서에 그 계정이 어느 재원으로 있는지를 먼저 봄
        if (leaf(f).includes(canonAcct(segs, f, leaf))) return f;
        const o = f === '보조금' ? '자부담' : '보조금';
        return leaf(o).includes(canonAcct(segs, o, leaf)) ? o : f;
      };
      for (const s of plans) {
        const ex = P.versions.find(v => v.src === s.path || (s.no && !/-0+$/.test(s.no) && v.no === s.no));
        const prev = P.versions.filter(v => v !== ex && (v.date || '') <= s.date).slice(-1)[0] || null;
        const lines = [];
        for (const r of s.rows) {
          const fund = fundOf(r.acct, r.fund), acct = canonAcct(r.acct, fund, leaf);
          let sumIt = 0;
          for (const it of r.items) {
            const k = fund + '|' + nospace(it.item) + '|' + acct, same = l => (l.fund + '|' + nospace(l.item) + '|' + l.acct) === k && !lines.some(x => x.id === l.id);
            const o = (ex && ex.lines.find(same)) || (prev && prev.lines.find(same));
            lines.push({ id: o ? o.id : uid(), item: it.item, fund, acct, price: it.price, qty: it.qty });
            sumIt += it.amount;
          }
          if (r.amount != null && sumIt !== r.amount) note(sub, s.no + ': ' + r.acct.join(' / ') + ' 줄 금액(' + r.amount.toLocaleString('ko-KR') + '원)과 산출근거 합(' + sumIt.toLocaleString('ko-KR') + '원)이 다름');
          if (!leaf(fund).includes(acct)) {
            const sg = suggestAcct(r.acct, leafAll(year));
            note(sub, s.no + ': 계정과목 ‘' + r.acct.join(' / ') + '’은(는) 예산서에 없음. ' + (sg ? '예산서의 ‘' + sg.path.split('/').join(' / ') + '’(' + sg.fund + ')을(를) 이렇게 쓴 것 같음 → 계획 화면에서 확인하고 예산서 문구로 바꿀 수 있음' : '예산서에 비슷한 계정도 없음(예산서 문구가 기준)'));
          }
        }
        if (!lines.length && s.budget) note(sub, s.no + ': 예산 줄을 읽지 못함(산출근거 칸 확인)');
        const goals = s.goals || (prev ? Object.assign({}, prev.goals) : { real: '', total: '', count: '' });
        if (s.goalsTable && s.goals && JSON.stringify(s.goalsTable) !== JSON.stringify(s.goals))
          note(sub, s.no + ': 변경내역 표의 변경 후 목표(' + [s.goalsTable.real, s.goalsTable.total, s.goalsTable.count].join('/') + ')와 붙임 계획서 목표(' + [s.goals.real, s.goals.total, s.goals.count].join('/') + ')가 다름 → 붙임 계획서 값을 넣음');
        if (s.status !== '결재 완료') note(sub, s.no + ' ' + s.kind + '은(는) 결재 전이라 ‘작성 중’으로 넣음(결재 후 내부기안 폴더로 옮기면 확정). 예산·잔액 화면에서 이 변경계획 기준으로도 맞춰 볼 수 있음', 'low');
        const v = { id: ex ? ex.id : uid(), kind: s.kind, no: s.no, date: s.date, status: s.status === '결재 완료' ? '확정' : '작성 중', goals, lines,
          schedule: ex ? ex.schedule : JSON.parse(JSON.stringify(prev ? prev.schedule || [] : [])), reason: s.reason || '', src: s.path };
        v.auto = vHash(v);
        if (ex && (!ex.auto || ex.auto !== vHash(ex))) continue; // 사람이 고친 버전은 그대로
        if (ex && ex.auto === v.auto) continue; // 바뀐 것 없음
        if (ex) { P.versions[P.versions.indexOf(ex)] = v; rep.updated++; } else { P.versions.push(v); rep.versions++; }
        P.versions.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        for (const f of ['보조금', '자부담']) if (!P.accts[f]) { const a = lines.find(l => l.fund === f && leaf(f).includes(l.acct)); if (a) P.accts[f] = a.acct; }
      }
      const KIND_ITEM = { 물품구입비: /물품/, 대관료: /대관|임차/, 다과비: /다과/, 식비: /식비/, 재료비: /재료/, 숙박비: /숙박/, 강사비: /강사|ILP/i, 통역비: /통역/, 홍보비: /홍보/, 교육비: /교육/, '보험·공제': /공제|보험/, 활동비: /활동비/ };
      const fillSpend = (d, s, ver, tag) => {
        d.planned = s.money; d.hasSettle = !!s.settle; d.hasInspect = !!s.inspect; d.scan = scans.has(s.no); d.when = s.eventDate || s.date;
        d.settled = s.settle && s.settle.spent != null ? s.settle.spent : null;
        d.extra = [];
        if (!(D().SPEND_KINDS.includes(d.kind) && ver)) return;
        // 결재 전 변경계획: 확정 계획에 없는 품목은 여기서 찾아 봄
        const pend = P.versions.filter(v => v.status !== '확정' && (v.date || '') >= (ver.date || '') && v !== ver).slice(-1)[0] || null;
        let rows = s.rows;
        // 정산서가 있으면 집행액으로(적게 쓴 만큼 덜 뺌). 정산서 품목 합이 집행액과 같으면 그 품목을, 아니면 예산 품목을 집행액에 맞춰 줄임
        if (d.settled != null && rows.length) {
          const its = s.settle.items, sumIts = its.reduce((a, x) => a + x.amount, 0), planned = rows.reduce((a, r) => a + (r.amount || 0), 0);
          if (rows.length === 1) rows = [Object.assign({}, rows[0], { amount: d.settled, items: its.length && sumIts === d.settled ? its : fitTo(rows[0].items, d.settled) })];
          else if (d.settled !== planned) { let left = planned - d.settled; rows = rows.map(r => { const t = Math.min(left, r.amount || 0); left -= t; return Object.assign({}, r, { amount: (r.amount || 0) - t, items: fitTo(r.items, (r.amount || 0) - t) }); }); }
        }
        // 품목 이름 → 종류(강사비 등) → 줄이 하나뿐이면 그 줄. 같은 종류 줄이 여럿이면 ‘N시간’이 같은 줄
        const byName = (pool, nm, kre, single, raw) => {
          const hr = /(\d+(?:\.\d+)?)\s*시간/.exec(raw || ''), hour = xs => (hr && xs.find(x => new RegExp('(^|[^\\d.])' + hr[1] + '\\s*시간').test(x.item))) || xs[0];
          const named = nm ? pool.filter(x => { const xi = nospace(x.item).replace(/\(.*$/, ''); return xi === nm || nm.includes(xi) || xi.includes(nm); }) : [];
          if (named.length) return hour(named);
          const kinds = kre ? pool.filter(x => kre.test(x.item)) : [];
          if (kinds.length) return hour(kinds);
          return single && pool.length === 1 ? pool[0] : null;
        };
        for (const row of rows) {
          if (nospace(row.acct[0]) === '가지출') { note(sub, tag + ': 가지출은 남은 예산에 넣지 않음(나중에 본 계정으로 지출하는 기안이 따로 있음)', 'low'); continue; }
          const fund = fundOf(row.acct, row.fund), acct = canonAcct(row.acct, fund, leaf);
          if (row.typo) note(sub, tag + ': 표 금액 ‘' + row.typo.raw + '’은 쉼표 자리가 틀림 → ' + won(row.typo.fixed) + '으로 봄');
          row.items.filter(it => it.typo).forEach(it => note(sub, tag + ': 산출근거 ‘' + it.item + ' …=' + it.typo + '’은 쉼표 자리가 틀림 → ' + won(it.amount) + '으로 봄'));
          const own = ver.lines.filter(x => x.fund === fund && x.acct === acct);
          let pool = own.length ? own : ver.lines.filter(x => x.acct === acct), loose = false;
          // 계획서나 지출 기안의 계정 문구가 조금 틀린 경우: 사업비 계정이면 이 사업의 예산 줄에서 품목으로 맞춤
          if (!pool.length && nospace(row.acct[0]) === '사업비') { pool = ver.lines.filter(x => /^사업비\//.test(x.acct)); loose = true; }
          if (!pool.length && nospace(row.acct[0]) !== '사업비') { skip('사업비가 아닌 계정(홍보비 = 운영비 ‘수용비 및 수수료’ 등)에서 나간 지출: 남은 예산은 예산 화면에서 봄', 1, s); continue; }
          let its = row.items.length ? row.items.map(x => Object.assign({}, x)) : [{ item: '', amount: row.amount || 0 }];
          // 할인(빼기)은 가장 큰 품목에서 덜어 냄
          const negs = its.filter(x => x.amount < 0);
          if (negs.length && its.some(x => x.amount > 0)) { its = its.filter(x => x.amount >= 0); const big = its.reduce((m, x) => x.amount > m.amount ? x : m, its[0]); negs.forEach(x => { big.amount += x.amount; }); }
          // 표 금액(할인·배송비 포함 총액)이 기준
          const sumIt = its.reduce((a, x) => a + x.amount, 0);
          if (row.amount != null && row.items.length && sumIt !== row.amount) {
            note(sub, tag + ': 산출근거 합 ' + won(sumIt) + '과 표 금액 ' + won(row.amount) + '이 ' + won(Math.abs(sumIt - row.amount)) + ' 다름(할인·배송비 등이 산출근거에 빠졌는지 확인) → 표 금액 ' + won(row.amount) + '으로 넣음');
            if (sumIt > row.amount) its = fitTo(its, row.amount);
            else { const big = its.reduce((m, x) => x.amount > m.amount ? x : m, its[0]); big.amount += row.amount - sumIt; }
          }
          const kre = KIND_ITEM[d.kind];
          for (const it of its) {
            if (!it.amount) continue;
            const nm = nospace(it.item).replace(/\(.*$/, '');
            let l = pool.length ? byName(pool, nm, kre, !loose, it.item) : null;
            if (!l && pend) {
              const pp = pend.lines.filter(x => x.acct === acct || (loose && /^사업비\//.test(x.acct)));
              l = byName(pp, nm, kre, false, it.item);
              if (l) note(sub, tag + ': ‘' + (it.item || d.kind) + '’ ' + won(it.amount) + '은 확정 계획에 없어 결재 전 변경계획(' + pend.no + ')의 ‘' + l.item + '’ 줄로 셈', 'low');
            }
            if (!l) {
              d.extra.push({ item: it.item || d.kind, fund, acct, amount: it.amount });
              note(sub, tag + ': 계획에 ‘' + (it.item || d.kind) + '’ 품목은 없지만 같은 세목(' + acct.split('/').pop() + ') 안이라 세목 합계로만 셈(산출근거 안 품목은 센터장 재량, 틀린 것 아님) · ' + won(it.amount), 'low');
              continue;
            }
            d.spends[l.id] = (d.spends[l.id] || 0) + it.amount;
          }
        }
      };
      if (PERSON.includes(sub)) {
        P.pdocs = P.pdocs || [];
        for (const s of rounds) {
          if (['실적보고', '사업계획', '내역변경', '모집'].includes(s.kind)) { skip('사람별 화면에 넣지 않는 기안(모집·실적보고·내역변경 등)', 1, s); continue; }
          for (const rr of P.rounds) { const i = rr.docs.findIndex(d => sameDoc(d, s) && isAuto(d)); if (i >= 0) rr.docs.splice(i, 1); }
          const ex = P.pdocs.find(d => sameDoc(d, s));
          const ver = P.versions.filter(v => v.status === '확정' && (v.date || '') <= s.date).slice(-1)[0] || P.versions[P.versions.length - 1];
          const d = { id: ex ? ex.id : uid(), kind: s.kind, no: s.no, date: s.date, title: s.title, status: s.status, spends: {}, attend: '', memo: ex ? ex.memo || '' : '', src: s.path, persons: s.persons || [], link: s.link || '' };
          fillSpend(d, s, ver, (d.persons.join(', ') || '공통') + ' ' + d.kind + '(' + s.no + ')');
          d.auto = dHash(d);
          if (ex && !isAuto(ex)) continue;
          if (ex && ex.auto === d.auto) continue;
          if (ex) { P.pdocs[P.pdocs.indexOf(ex)] = d; rep.updated++; } else { P.pdocs.push(d); rep.docs++; }
        }
        P.pdocs.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        tidyRounds(P);
        continue;
      }
      // 회차 기안
      for (const s of rounds) {
        if (['실적보고', '사업계획', '내역변경'].includes(s.kind) || (s.kind === '변경계획' && !s.n)) { skip('회차가 없는 기안(실적보고·내역변경 등)', 1, s); continue; }
        const hasQ = rounds.some(x => x.per === '분기'), t = s.eventDate || s.date || '';
        const n = s.n || (hasQ && t ? Math.ceil(+t.slice(5, 7) / 3) : 1), per = s.per || (hasQ && t ? '분기' : '차');
        let r = P.rounds.find(x => x.n === n && (x.unit || '차') === per);
        let ex = null, exR = null;
        for (const rr of P.rounds) { const f = rr.docs.find(d => sameDoc(d, s)); if (f) { ex = f; exR = rr; break; } }
        const ver = P.versions.filter(v => v.status === '확정' && (v.date || '') <= s.date).slice(-1)[0] || P.versions[P.versions.length - 1];
        const d = { id: ex ? ex.id : uid(), kind: ROUND_KIND(s.kind), no: s.no, date: s.date, title: s.title, status: s.status, spends: {}, attend: '', memo: ex ? ex.memo || '' : '', src: s.path };
        const tag = n + per + ' ' + d.kind + '(' + s.no + ')';
        fillSpend(d, s, ver, tag);
        if (d.kind === '결과보고') { d.settle = s.money == null ? '' : s.money; d.attend = (s.names || []).join('\n'); }
        if (d.kind === '계획') d.budget = s.money;
        d.auto = dHash(d);
        if (ex && !isAuto(ex)) continue; // 사람이 고친 기안은 그대로
        if (ex && ex.auto === d.auto && exR === r) continue;
        if (!r) { r = { id: uid(), n, unit: per, docs: [], auto: true }; P.rounds.push(r); }
        if (ex) { exR.docs.splice(exR.docs.indexOf(ex), 1); rep.updated++; } else rep.docs++;
        r.docs.push(d);
        // 운영계획에서 회차 이름·날짜·인원을 계획의 회차 일정에 채움(빈 칸만)
        if (d.kind === '계획' && per === '차' && (s.activity || s.eventDate)) {
          let any = false;
          for (const v of P.versions) {
            v.schedule = v.schedule || [];
            const e = v.schedule.find(x => x.n === n);
            if (e) { if (!e.name && s.activity) e.name = s.activity; if (!e.date && s.eventDate) e.date = s.eventDate; if ((e.people === '' || e.people == null) && s.people) e.people = s.people; any = true; }
          }
          if (!any) for (const v of P.versions) { v.schedule.push({ n, name: s.activity, date: s.eventDate, people: s.people == null ? '' : s.people }); v.schedule.sort((a, b) => a.n - b.n); }
        }
      }
      tidyRounds(P);
    }
    return rep;
  }
  window.GSCAN = { places, hasYears, scan, apply, extract, parseBasis, budgetEntries, suggestAcct, numberTip, START_YEAR };
})();
