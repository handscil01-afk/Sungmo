/* 기안 검수: 정해진 규칙으로 PC 안에서만 확인함(인터넷으로 보내지 않음).
   sev: 'high' 고칠 것, 'mid' 확인, 'low' 참고, 'ok' 통과 */
(function () {
  'use strict';
  const D = () => window.GDICT;
  const WD = '일월화수목금토';
  const NUM = '\\d[\\d,]*(?:\\.\\d+)?';
  const UNITCH = '[가-힣A-WYZa-wyz]{0,4}';
  const FACT = NUM + '\\s*' + UNITCH;
  const EXPR = new RegExp('(' + FACT + '(?:\\s*[×xX*✕]\\s*' + FACT + ')+)(?:\\s*=\\s*(' + NUM + ')\\s*원?)?', 'g');
  const toNum = s => +String(s).replace(/,/g, '');
  const fmt = n => (Math.round(n) || 0).toLocaleString('ko-KR');
  const nospace = s => String(s).replace(/\s+/g, '');
  const normTitle = s => nospace(s).replace(/[‘’'"“”`]/g, "'").replace(/[()（）]/g, '').replace(/\.hwpx?$/i, '');

  function korNum(s) {
    const dg = { 영: 0, 공: 0, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 륙: 6, 칠: 7, 팔: 8, 구: 9 };
    const sm = { 십: 10, 백: 100, 천: 1000 }, bg = { 만: 1e4, 억: 1e8, 조: 1e12 };
    let total = 0, sec = 0, cur = 0, ok = false;
    const t = String(s).replace(/[,\s]/g, '');
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (/\d/.test(c)) { let j = i; while (j < t.length && /\d/.test(t[j])) j++; cur = +t.slice(i, j); i = j - 1; ok = true; }
      else if (c in dg) { cur = dg[c]; ok = true; }
      else if (c in sm) { sec += (cur || 1) * sm[c]; cur = 0; ok = true; }
      else if (c in bg) { sec += cur; total += (sec || 1) * bg[c]; sec = 0; cur = 0; ok = true; }
      else if (c === '원' || c === '정' || c === '금') continue;
      else return null;
    }
    return ok ? total + sec + cur : null;
  }

  function docMeta(doc) {
    const base = String(doc.name || '').replace(/\.[^.]+$/, '').trim();
    const m = D().FILE_RE.exec(base);
    let fileTitle = '', yy = null, no = null, mmdd = null;
    if (m) {
      yy = +m[2]; no = m[3];
      let rest = m[4].trim();
      const d = /^(\d{2})(\d{2})\s+(.*)$/.exec(rest);
      if (d) { mmdd = d[1] + d[2]; rest = d[3]; }
      fileTitle = rest.trim();
    }
    let bodyTitle = '';
    for (const l of doc.lines.slice(0, 40)) { const t = /^제\s*목\s*[:：|]?\s*(.+)$/.exec(l); if (t) { bodyTitle = t[1].replace(/\s*\|\s*/g, ' ').trim(); break; } }
    const title = fileTitle || bodyTitle || base;
    let year = yy != null ? 2000 + yy : null;
    if (!year) {
      const c = {}; for (const l of doc.lines) for (const x of l.matchAll(/(20\d{2})\s*[년.]/g)) c[x[1]] = (c[x[1]] || 0) + 1;
      const best = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; year = best ? +best : new Date().getFullYear();
    }
    const kind = D().kindOf(title), sub = D().subOf(title), unit = sub ? D().unitOf(sub) : null;
    const rm = /(\d+)\s*차(?!\s*년)/.exec(title), gm = /(\d+)\s*회기/.exec(title);
    return { base, fileOk: !!m, fileTitle, bodyTitle, title, year, no, mmdd, kind, sub, unit, round: rm ? +rm[1] : null, session: gm ? +gm[1] : null };
  }

  function review(doc, opts) {
    opts = opts || {};
    const F = [];
    const add = (sev, code, title, detail, quotes) => F.push({ sev, code, title, detail: detail || '', quotes: (quotes || []).slice(0, 6) });
    const meta = docMeta(doc);
    const L = doc.lines;
    const tables = doc.blocks.filter(b => b.type === 'table');

    // 1. 파일 이름과 본문 제목
    if (!meta.fileOk) add('low', 'name', '파일 이름이 기안 형식이 아님', '‘손잡다26-번호 MMDD 제목’ 형식이면 번호·날짜·제목을 함께 확인할 수 있습니다.');
    if (meta.fileTitle && meta.bodyTitle && normTitle(meta.fileTitle) !== normTitle(meta.bodyTitle))
      add('mid', 'title', '파일 이름과 본문 제목이 다름', '파일: ‘' + meta.fileTitle + '’\n본문: ‘' + meta.bodyTitle + '’');
    if (!meta.bodyTitle) add('low', 'title', '본문에서 ‘제목’ 줄을 찾지 못함', '기안문 서식이 아니거나 제목 칸이 표 안에 있을 수 있습니다.');

    // 2. 연도
    const yBad = [];
    for (const l of L) for (const x of l.matchAll(/(?<!\d)(20\d{2})(?=\s*(?:년|\.\s*\d|-\d))/g)) {
      const y = +x[1];
      if (y === meta.year || y === meta.year + 1) continue;
      if (y === meta.year - 1 && /귀속|전년|작년|지난해|이월|결산|정산|반납|대비|비교|실적/.test(l)) continue;
      yBad.push(l);
    }
    if (yBad.length) add('mid', 'year', meta.year + '년이 아닌 연도가 있음', '앞 문서를 고쳐 쓰다 남은 연도인지 확인해 주세요.', [...new Set(yBad)]);

    // 3. 다른 사업 이름
    const skipMix = !meta.sub || ['개별자립지원', '개별동료상담'].includes(meta.sub) || ['사업계획', '실적보고', '변경계획', '내역변경', '연계', '기타'].includes(meta.kind);
    if (!skipMix) {
      const hits = {};
      for (const l of L) {
        if (/연계|비교|협조|참고/.test(l)) continue;
        const t = nospace(l);
        for (const [s, re] of D().SUB_KW) if (s !== meta.sub && re.test(t)) (hits[s] = hits[s] || []).push(l);
        for (const u of Object.keys(D().UNIT_SUBS)) if (u !== meta.unit && !/^\d/.test(u) && t.includes(u) && !(meta.unit || '').includes(u)) (hits[u] = hits[u] || []).push(l);
      }
      for (const k in hits) add('mid', 'mix', '다른 사업 이름이 들어 있음: ‘' + k + '’', '이 기안은 ‘' + meta.sub + '’ 기안입니다. 앞 기안을 복사하다 남은 이름인지 확인해 주세요.', [...new Set(hits[k])]);
    }

    // 4. 회차·회기
    if (meta.round) {
      const bad = [];
      for (const l of L) for (const x of l.matchAll(/(\d+)\s*차(?!\s*년|시)/g)) if (+x[1] !== meta.round && !/지난|이전|누적|전회|1\s*~|~\s*\d+\s*차/.test(l) && !/\d\s*차\s*(?:운영위원회|이사회)/.test(l)) bad.push(l);
      if (bad.length) add('mid', 'round', '제목은 ' + meta.round + '차인데 다른 차수가 있음', '앞 회차 문서에서 남은 차수인지 확인해 주세요.', [...new Set(bad)]);
    }
    if (meta.session) {
      const bad = [];
      for (const l of L) for (const x of l.matchAll(/(\d+)\s*회기/g)) if (+x[1] !== meta.session) bad.push(l);
      if (bad.length) add('mid', 'round', '제목은 ' + meta.session + '회기인데 다른 회기가 있음', '', [...new Set(bad)]);
    }

    // 5. 날짜와 요일
    const dateRe = /(?:(20\d{2})\s*[.\-/]\s*)?(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*\.?\s*\(\s*([월화수목금토일])\s*\)/g;
    const docDates = [];
    for (const l of L) for (const x of l.matchAll(dateRe)) {
      const y = x[1] ? +x[1] : meta.year, mo = +x[2], da = +x[3];
      const dt = new Date(y, mo - 1, da);
      docDates.push(mo + '.' + da);
      if (dt.getMonth() !== mo - 1 || dt.getDate() !== da) { add('high', 'date', '없는 날짜: ' + x[0].trim(), '', [l]); continue; }
      if (WD[dt.getDay()] !== x[4]) {
        const alt = !x[1] ? new Date(y + 1, mo - 1, da) : null;
        if (alt && WD[alt.getDay()] === x[4]) continue;
        add('high', 'weekday', '요일이 맞지 않음: ' + x[0].trim(), y + '년 ' + mo + '월 ' + da + '일은 ' + WD[dt.getDay()] + '요일입니다.', [l]);
      }
    }

    // 6. 산출식(단가 × 인원 × 횟수 = 금액)
    const calcRow = (cells, rowLine) => {
      cells.forEach((c, i) => {
        for (const x of c.matchAll(EXPR)) {
          const facs = x[1].split(/[×xX*✕]/).map(f => { const m = /\d[\d,]*(?:\.\d+)?/.exec(f); return m ? toNum(m[0]) : NaN; });
          if (facs.some(isNaN) || facs.length < 2) continue;
          const prod = facs.reduce((a, b) => a * b, 1);
          let shown = x[2] != null ? toNum(x[2]) : null, where = '';
          if (shown == null && cells) for (let j = i + 1; j < cells.length; j++) { const m = /^\s*(\d[\d,]*)\s*원?\s*$/.exec(cells[j]); if (m) { shown = toNum(m[1]); where = ' (옆 칸 금액)'; break; } }
          if (shown == null) continue;
          if (Math.abs(prod - shown) > 0.5) add('high', 'calc', '계산이 맞지 않음: ' + x[0].trim() + where, '계산하면 ' + fmt(prod) + '원인데 ' + fmt(shown) + '원으로 적혀 있습니다.', [rowLine]);
        }
      });
    };
    for (const b of doc.blocks) {
      if (b.type === 'p') b.text.split('\n').forEach(t => calcRow([t], t.trim()));
      else b.rows.forEach(r => calcRow(r, r.join(' | ')));
    }

    // 7. 표 합계
    const isTot = c => /^(합\s*계|총\s*계|계|총\s*액|합)$/.test(nospace(c));
    const isSub = c => /^소\s*계$/.test(nospace(c));
    const cellNum = c => { const m = /^\s*(-?\d[\d,]*)\s*원?\s*$/.exec(c || ''); return m ? toNum(m[1]) : null; };
    const tableTotals = [];
    for (const t of tables) {
      let acc = [], subs = [];
      for (const r of t.rows) {
        const first = r.find(c => c.trim()) || '';
        if (isTot(first) || isSub(first)) {
          const base = isTot(first) && subs.length ? subs : acc;
          r.forEach((c, ci) => {
            const v = cellNum(c); if (v == null || ci === 0) return;
            const vals = base.map(row => cellNum(row[ci])).filter(x => x != null);
            if (!vals.length) return;
            const sum = vals.reduce((a, b) => a + b, 0);
            if (sum !== v) add('high', 'sum', (isSub(first) ? '소계' : '합계') + '가 맞지 않음', '위 칸을 더하면 ' + fmt(sum) + '인데 ' + fmt(v) + '으로 적혀 있습니다.', [r.join(' | ')]);
            else if (isTot(first)) tableTotals.push(v);
          });
          if (isSub(first)) { subs.push(r); acc = []; } else { acc = []; subs = []; }
        } else if (r.some(c => cellNum(c) != null)) acc.push(r);
      }
    }

    // 8. 금액 한글 표기
    const moneyHits = [];
    for (const l of L) {
      for (const x of l.matchAll(/금\s*([\d,]+)\s*원\s*\(\s*(?:금\s*)?([일이삼사오육륙칠팔구십백천만억영공\d,\s]+)\s*원?\s*정?\s*\)/g)) moneyHits.push([toNum(x[1]), korNum(x[2]), x[0], l]);
      for (const x of l.matchAll(/금\s*([일이삼사오육륙칠팔구십백천만억영공]+)\s*원?\s*정?\s*\(\s*([\d,]+)\s*원\s*\)/g)) moneyHits.push([toNum(x[2]), korNum(x[1]), x[0], l]);
    }
    for (const [n, k, q, l] of moneyHits) if (k != null && n !== k) add('high', 'money', '숫자 금액과 한글 금액이 다름: ' + q, '숫자는 ' + fmt(n) + '원, 한글은 ' + fmt(k) + '원입니다.', [l]);
    const docTotal = moneyHits.length ? moneyHits[0][0] : (tableTotals.length ? Math.max(...tableTotals) : null);
    if (moneyHits.length && tableTotals.length && !tableTotals.includes(moneyHits[0][0]))
      add('high', 'total', '본문 금액과 표 합계가 다름', '본문 ' + fmt(moneyHits[0][0]) + '원, 표 합계 ' + tableTotals.map(fmt).join('·') + '원입니다.', [moneyHits[0][3]]);

    // 9. 계정과목
    const acc = opts.accounts || D().BUILTIN_ACCTS;
    const known = [];
    for (const f in acc) for (const p of acc[f]) known.push({ fund: f, path: p, segs: p.split('/') });
    const seen = new Set();
    const checkPath = (segs, line) => {
      segs = segs.map(s => s.trim()).filter(Boolean);
      if (segs.length < 3) return;
      const key = segs.join('/'); if (seen.has(key)) return; seen.add(key);
      const tail = k => k.segs.slice(k.segs.length - segs.length);
      const exact = known.filter(k => tail(k).join('/') === key);
      if (exact.length) { checkSubAcct(exact, line); return; }
      const ns = known.filter(k => nospace(tail(k).join('/')) === nospace(key));
      if (ns.length) { add('low', 'acct-space', '계정과목 띄어쓰기가 예산서와 다름', '적힌 문구: ‘' + segs.join(' / ') + '’\n예산서: ‘' + tail(ns[0]).join(' / ') + '’ (' + ns[0].fund + ')', [line]); checkSubAcct(ns, line); return; }
      const up = known.filter(k => tail(k).slice(0, -1).join('/') === segs.slice(0, -1).join('/'));
      if (up.length) { add('high', 'acct', '예산서에 없는 세목: ‘' + segs[segs.length - 1] + '’', '같은 목 아래 예산서 세목: ' + [...new Set(up.map(k => '‘' + k.segs[k.segs.length - 1] + '’(' + k.fund + ')'))].join(', ') + '\n계정과목 문구는 예산서와 똑같이 써야 합니다.', [line]); return; }
      const last = known.filter(k => k.segs[k.segs.length - 1] === segs[segs.length - 1]);
      if (last.length) { add('high', 'acct', '계정과목 경로가 예산서와 다름', '적힌 문구: ‘' + segs.join(' / ') + '’\n예산서: ' + last.map(k => '‘' + k.segs.join(' / ') + '’(' + k.fund + ')').join(', '), [line]); return; }
      if (/^(사업비|사무비|재산조성비|예비비|반환금)$/.test(segs[0])) add('high', 'acct', '예산서에 없는 계정과목', '‘' + segs.join(' / ') + '’', [line]);
    };
    const found = [];
    const checkSubAcct = (ks, line) => {
      found.push(...ks);
      if (!meta.sub) return;
      for (const k of ks) {
        if (k.segs[0] !== '사업비') continue;
        const want = (D().ACCT_MAP[k.fund] || {})[meta.sub];
        if (want && want !== k.path) add('mid', 'acct-sub', '이 사업의 계정과목이 아님', '‘' + meta.sub + '’의 ' + k.fund + ' 계정은 ‘' + want.split('/').join(' / ') + '’입니다.', [line]);
      }
    };
    const seg = '([가-힣A-Za-z][가-힣A-Za-z0-9 ]{0,14}?)';
    const pathRe = new RegExp(seg + '\\s*[/>]\\s*' + seg + '\\s*[/>]\\s*' + seg + '(?:\\s*[/>]\\s*' + seg + ')?(?=\\s*(?:$|[,)|(\\]:]|\\s{2}))', 'g');
    for (const l of L) for (const x of l.matchAll(pathRe)) checkPath(x.slice(1).filter(Boolean), l);
    for (const t of tables) for (const r of t.rows) for (let i = 0; i + 4 <= r.length; i++) {
      const w = r.slice(i, i + 4).map(c => c.trim());
      if (w.every(c => c && c.length <= 15 && /^[가-힣A-Za-z ]+$/.test(c)) && /^(사업비|사무비|재산조성비|예비비|반환금)$/.test(w[0])) checkPath(w, r.join(' | '));
    }
    let target = found.find(k => k.segs[0] === '사업비') || null;
    if (!target && meta.sub) for (const f of ['보조금', '자부담']) { const p = (D().ACCT_MAP[f] || {})[meta.sub]; if (p && (acc[f] || []).includes(p)) { target = { fund: f, path: p, segs: p.split('/') }; break; } }
    if (!target) target = found[0] || null;
    if (opts.budgetOf && target) {
      const k = target, b = opts.budgetOf(k.fund, k.path);
      if (b) {
        add('low', 'budget', '예산 현황 (' + k.fund + ': ' + k.segs.join(' / ') + ')', '현재 예산 ' + fmt(b.budget) + '원 · 집행 ' + fmt(b.spent) + '원' + (b.date ? '(' + b.date + ' 결산' + (b.after ? ' + 이후 기안 ' + fmt(b.after) + '원' : '') + ')' : '') + ' · 남은 예산 ' + fmt(b.remain) + '원');
        if (docTotal != null && docTotal > b.remain) add('high', 'over', '남은 예산보다 큰 금액', '이 기안 ' + fmt(docTotal) + '원, 남은 예산 ' + fmt(b.remain) + '원입니다.');
      }
    }

    // 10. 붙임 번호와 끝 표시
    const bi = L.findIndex(l => /^붙\s*임/.test(l));
    if (bi >= 0) {
      const nums = [];
      for (let i = bi; i < L.length && i < bi + 15; i++) {
        const t = L[i].replace(/^붙\s*임\s*/, '');
        const m = /^(\d+)\s*\./.exec(t); if (m) nums.push(+m[1]);
        if (/끝\s*\.?\s*$/.test(L[i])) break;
      }
      if (nums.length > 1 && nums.some((n, i) => n !== i + 1)) add('mid', 'attach', '붙임 번호가 차례대로가 아님', '붙임 번호: ' + nums.join(', '), L.slice(bi, bi + nums.length + 1));
    }
    if (['사업계획', '변경계획', '계획', '모집', '결과보고', '실적보고'].concat(D().SPEND_KINDS).includes(meta.kind) && !L.some(l => /끝\s*\.\s*$/.test(l) || /끝\.\s/.test(l)))
      add('low', 'end', '‘끝.’ 표시를 찾지 못함', '본문 마지막이나 붙임 끝에 ‘끝.’이 있는지 확인해 주세요.');

    // 11. 표기
    const ty = [];
    for (const l of L) {
      if (/(?<![\d,.])\d{5,}\s*원/.test(l)) ty.push(['천 단위 쉼표가 없는 금액', l]);
      if (/\d,\d{4}(?!\d)|\d,\d{1,2}(?![\d])/.test(l.replace(/\d{1,2}:\d{2}/g, ''))) ty.push(['쉼표 위치가 이상한 숫자', l]);
      if (/[^.]\.\.(?!\.)|,,/.test(l)) ty.push(['문장 부호가 겹침', l]);
    }
    const tyg = {}; ty.forEach(([k, l]) => (tyg[k] = tyg[k] || []).push(l));
    for (const k in tyg) add('low', 'typo', k, '', [...new Set(tyg[k])]);

    // 12. 개별자립지원 계획: 센터장 점검 항목은 사람이 확인
    if (meta.sub === '개별자립지원' && ['계획', '사전회의', '중간회의'].includes(meta.kind)) {
      const pick = re => L.filter(l => re.test(l));
      const att = L.join(' ').match(/세부\s*사업\s*계획서\s*(\d+)\s*부/);
      add('mid', 'ils', '개별자립지원 내용 점검(사람이 확인)', '① 회의록의 욕구 → 논의 → 결과가 이어지는지 ② 계획서의 확인된 욕구가 회의록 욕구와 같은지 ③ 합의된 목표가 같은 줄의 욕구와 이어지는지 ④ 단기목표를 합치면 장기목표가 되는지 ⑤ 세부사업계획서 수 = 회차·분기 단위 필요 수 = 붙임 문구 수' + (att ? '\n붙임 문구의 세부사업계획서: ' + att[1] + '부' : ''), pick(/욕구|목표|세부\s*사업\s*계획서/));
    }

    // 13. 앞 문서와 비교
    let diff = null;
    if (opts.prev) {
      const pm = docMeta(opts.prev);
      diff = lineDiff(opts.prev.lines, L);
      const prevDates = new Set();
      for (const l of opts.prev.lines) for (const x of l.matchAll(dateRe)) prevDates.add(+x[2] + '.' + +x[3]);
      const same = [];
      for (const l of L) for (const x of l.matchAll(dateRe)) { const k = +x[2] + '.' + +x[3]; if (prevDates.has(k)) same.push(l); }
      if (same.length && pm.mmdd !== meta.mmdd) add('mid', 'prev-date', '앞 문서의 날짜가 그대로 있음', '앞 문서(' + (pm.fileTitle || pm.base) + ')와 같은 날짜입니다. 이번 회차 날짜로 바꿨는지 확인해 주세요.', [...new Set(same)]);
      if (pm.round && meta.round && pm.round !== meta.round) {
        const left = L.filter(l => new RegExp('(?<!\\d)' + pm.round + '\\s*차').test(l));
        if (left.length) add('high', 'prev-round', '앞 문서의 차수(' + pm.round + '차)가 남아 있음', '', left);
      }
    }

    const order = { high: 0, mid: 1, low: 2, ok: 3 };
    F.sort((a, b) => order[a.sev] - order[b.sev]);
    const verdict = F.some(f => f.sev === 'high') ? '보완 필요' : F.some(f => f.sev === 'mid') ? '확인 후 결재' : '결재 가능';
    return { meta, findings: F, diff, verdict, docTotal, accounts: found.map(k => k.fund + ': ' + k.segs.join(' / ')) };
  }

  function lineDiff(a, b) {
    const A = a.map(x => x.replace(/\s+/g, ' ').trim()), B = b.map(x => x.replace(/\s+/g, ' ').trim());
    const n = A.length, m = B.length;
    if (n * m > 4e6) return null;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const out = []; let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { out.push(['=', B[j]]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push(['-', A[i]]); i++; }
      else { out.push(['+', B[j]]); j++; }
    }
    while (i < n) out.push(['-', A[i++]]);
    while (j < m) out.push(['+', B[j++]]);
    return out;
  }

  /* 담당자에게 보낼 보완 요청 문구 */
  function reportText(r) {
    const lines = ['[기안 검수] ' + (r.meta.fileTitle || r.meta.bodyTitle || r.meta.base), '판정: ' + r.verdict, ''];
    const label = { high: '고칠 것', mid: '확인할 것', low: '참고' };
    let n = 0;
    for (const f of r.findings) {
      if (f.code === 'budget') continue;
      n++;
      lines.push(n + '. [' + label[f.sev] + '] ' + f.title);
      if (f.detail) f.detail.split('\n').forEach(d => lines.push('   ' + d));
      f.quotes.slice(0, 3).forEach(q => lines.push('   · ' + (q.length > 90 ? q.slice(0, 90) + '…' : q)));
    }
    if (!n) lines.push('규칙으로 확인한 범위에서는 고칠 곳이 없습니다.');
    lines.push('', '※ 정해진 규칙으로 자동 확인한 결과입니다. 내용 판단(욕구·목표 연결 등)은 따로 봐 주세요.');
    return lines.join('\n');
  }
  window.GREVIEW = { review, docMeta, reportText, korNum, lineDiff };
})();
