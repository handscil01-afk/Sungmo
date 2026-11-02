/* 옛 엑셀(.xls, BIFF8) 읽기와 예산서(세입·세출) 해석. 회계 프로그램에서 내려받은 예산·결산 파일용. */
(function () {
  'use strict';
  function readBiff(u8) {
    const cfb = new GCFB.CFB(u8);
    const e = cfb.find('Workbook') || cfb.find('Book');
    if (!e) throw new Error('엑셀 통합 문서가 아닙니다');
    const d = cfb.read(e), v = new DataView(d.buffer, d.byteOffset, d.byteLength);
    const recs = [];
    for (let p = 0; p + 4 <= d.length;) {
      const t = v.getUint16(p, true), n = v.getUint16(p + 2, true);
      recs.push({ t, pos: p, data: d.subarray(p + 4, p + 4 + n) });
      p += 4 + n;
    }
    let sst = [];
    const bound = [];
    const sheets = [];
    let cur = null, pendingFormula = null;
    for (let i = 0; i < recs.length; i++) {
      const r = recs[i], dv = new DataView(r.data.buffer, r.data.byteOffset, r.data.byteLength);
      switch (r.t) {
        case 0x0085: { // BOUNDSHEET
          const off = dv.getUint32(0, true), kind = r.data[5];
          const nm = readShortStr(r.data, 6);
          bound.push({ off, kind, name: nm });
          break;
        }
        case 0x00FC: { // SST (+CONTINUE)
          const chunks = [r.data];
          while (i + 1 < recs.length && recs[i + 1].t === 0x003C) { chunks.push(recs[i + 1].data); i++; }
          sst = readSST(chunks);
          break;
        }
        case 0x0809: { // BOF
          const b = bound.find(x => x.off === r.pos);
          if (b) { cur = { name: b.name, cells: new Map(), nrows: 0, ncols: 0 }; sheets.push(cur); } else if (dv.getUint16(2, true) !== 0x0005) cur = null;
          break;
        }
        case 0x000A: cur = null; break; // EOF
        case 0x00FD: if (cur) put(cur, dv.getUint16(0, true), dv.getUint16(2, true), sst[dv.getUint32(6, true)] || ''); break;
        case 0x0203: if (cur) put(cur, dv.getUint16(0, true), dv.getUint16(2, true), dv.getFloat64(6, true)); break;
        case 0x027E: if (cur) put(cur, dv.getUint16(0, true), dv.getUint16(2, true), rk(dv.getUint32(6, true))); break;
        case 0x00BD: if (cur) { // MULRK
          const row = dv.getUint16(0, true), c0 = dv.getUint16(2, true), c1 = dv.getUint16(r.data.length - 2, true);
          for (let c = c0, o = 4; c <= c1; c++, o += 6) put(cur, row, c, rk(dv.getUint32(o + 2, true)));
          break;
        }
        case 0x0204: if (cur) put(cur, dv.getUint16(0, true), dv.getUint16(2, true), readLongStr(r.data, 6).s); break;
        case 0x0006: if (cur) { // FORMULA
          const row = dv.getUint16(0, true), col = dv.getUint16(2, true);
          if (dv.getUint16(12, true) === 0xFFFF) { if (r.data[6] === 0) pendingFormula = { row, col }; else if (r.data[6] === 1) put(cur, row, col, !!r.data[8]); }
          else put(cur, row, col, dv.getFloat64(6, true));
          break;
        }
        case 0x0207: if (cur && pendingFormula) { put(cur, pendingFormula.row, pendingFormula.col, readLongStr(r.data, 0).s); pendingFormula = null; } break;
        default: break;
      }
    }
    return sheets.map(s => ({ name: s.name, rows: toRows(s) }));
  }
  function put(s, r, c, val) { s.cells.set(r * 1024 + c, val); if (r + 1 > s.nrows) s.nrows = r + 1; if (c + 1 > s.ncols) s.ncols = c + 1; }
  function toRows(s) {
    const rows = [];
    for (let r = 0; r < s.nrows; r++) { const row = []; for (let c = 0; c < s.ncols; c++) { const v = s.cells.get(r * 1024 + c); row.push(v === undefined ? null : v); } rows.push(row); }
    return rows;
  }
  function rk(x) {
    let n;
    if (x & 2) n = (x >> 2);
    else { const b = new DataView(new ArrayBuffer(8)); b.setUint32(4, x & 0xFFFFFFFC, true); b.setUint32(0, 0, true); n = b.getFloat64(0, true); }
    return (x & 1) ? n / 100 : n;
  }
  function readShortStr(u8, o) {
    const cch = u8[o], f = u8[o + 1]; let s = '';
    if (f & 1) for (let i = 0; i < cch; i++) s += String.fromCharCode(u8[o + 2 + i * 2] | (u8[o + 3 + i * 2] << 8));
    else for (let i = 0; i < cch; i++) s += String.fromCharCode(u8[o + 2 + i]);
    return s;
  }
  function readLongStr(u8, o) {
    const cch = u8[o] | (u8[o + 1] << 8), f = u8[o + 2]; let p = o + 3, s = '';
    if (f & 8) p += 2; if (f & 4) p += 4;
    if (f & 1) { for (let i = 0; i < cch; i++) s += String.fromCharCode(u8[p + i * 2] | (u8[p + 1 + i * 2] << 8)); }
    else for (let i = 0; i < cch; i++) s += String.fromCharCode(u8[p + i]);
    return { s };
  }
  /* SST: 문자열이 CONTINUE 경계에서 끊기면 새 조각 첫 바이트가 다시 압축 여부를 알려 줌 */
  function readSST(chunks) {
    let ci = 0, p = 0;
    const byte = () => { while (p >= chunks[ci].length) { ci++; p = 0; if (ci >= chunks.length) throw new Error('SST 끝'); } return chunks[ci][p++]; };
    const u16 = () => byte() | (byte() << 8);
    const u32 = () => (u16() | (u16() << 16)) >>> 0;
    u32(); const uniq = u32();
    const out = [];
    for (let k = 0; k < uniq; k++) {
      const cch = u16(); let f = byte();
      let rt = 0, sz = 0;
      if (f & 8) rt = u16();
      if (f & 4) sz = u32();
      let s = '', wide = f & 1;
      for (let i = 0; i < cch; i++) {
        if (p >= chunks[ci].length) { ci++; p = 0; wide = chunks[ci][p++] & 1; }
        s += wide ? String.fromCharCode(u16()) : String.fromCharCode(byte());
      }
      for (let i = 0; i < rt * 4 + sz; i++) byte();
      out.push(s);
    }
    return out;
  }

  /* ---------- 예산서 해석 ---------- */
  const LV = [
    [1, /^(\d+)\.\s*(.+)$/], [2, /^\[(\d+)\]\s*(.+)$/], [3, /^\((\d+)\)\s*(.+)$/], [4, /^-\s*(.+)$/]
  ];
  function parseLabel(raw) {
    const t = String(raw == null ? '' : raw).replace(/ /g, ' ').trim();
    if (!t) return null;
    const tot = /^\[(세입합계|세출합계|세입-세출)\]$/.exec(t);
    if (tot) return { total: tot[1] };
    for (const [lv, re] of LV) { const m = re.exec(t); if (m) return { level: lv, name: (lv === 4 ? m[1] : m[2]).trim(), raw: t }; }
    return null;
  }
  const num = x => (typeof x === 'number' ? x : (x == null || x === '' ? null : (isNaN(+String(x).replace(/,/g, '')) ? null : +String(x).replace(/,/g, ''))));
  /* 한 열(계정과목)과 금액 열들로 나무 만들기 */
  function buildTree(rows, labelCol, cols) {
    const income = [], expense = []; let section = null, sawIncome = false;
    const stack = [];
    for (const row of rows) {
      const L = parseLabel(row[labelCol]);
      if (!L) continue;
      if (L.total) { if (L.total === '세입합계') { section = 'expense'; sawIncome = true; } continue; }
      if (section == null) section = 'income';
      const vals = {}; for (const k in cols) vals[k] = num(row[cols[k]]);
      stack.length = L.level - 1;
      const path = stack.map(x => x.name).concat(L.name);
      const node = Object.assign({ level: L.level, name: L.name, path }, vals);
      stack[L.level - 1] = node;
      (section === 'income' ? income : expense).push(node);
    }
    // 세입합계 줄 없이 세출만 있는 결산서: 처음 줄부터 세출로 봄
    if (!sawIncome && income.length && !expense.length) return { income: [], expense: income };
    return { income, expense };
  }
  function parseBudget(sheets) {
    const out = [];
    for (const sh of sheets) {
      const rows = sh.rows;
      let hr = -1;
      for (let r = 0; r < Math.min(rows.length, 15); r++) if (rows[r].some(c => /계정과목/.test(String(c || '')))) { hr = r; break; }
      if (hr < 0) continue;
      const head = rows[hr].map(c => String(c || '').replace(/\s+/g, ''));
      const labelCols = head.map((h, i) => (h === '계정과목' ? i : -1)).filter(i => i >= 0);
      const body = rows.slice(hr + 1);
      const hasTotal = body.some(r => r.some(c => /^\[세출합계\]$/.test(String(c || '').trim())));
      if (!hasTotal) continue;
      if (labelCols.length >= 2) {
        // 변경 전 / 변경 후 나란히
        const trees = labelCols.map((lc, k) => {
          const next = labelCols[k + 1] == null ? head.length : labelCols[k + 1];
          let bc = -1; for (let i = lc + 1; i < next; i++) if (/예산/.test(head[i])) { bc = i; break; }
          return buildTree(body, lc, { budget: bc < 0 ? lc + 1 : bc });
        });
        const top = rows.slice(0, hr).map(r => r.map(c => String(c || '').replace(/\s+/g, '')));
        const lab = labelCols.map(lc => { for (const r of top) if (r[lc]) return r[lc]; return ''; });
        out.push({ sheet: sh.name, format: 'change', trees, labels: lab });
      } else {
        const lc = labelCols[0];
        const find = re => head.findIndex(h => re.test(h));
        const cols = { budget: find(/^예산액/), settle: find(/^결산액/), cum: find(/^연누계/) };
        for (const k in cols) if (cols[k] < 0) delete cols[k];
        const tree = buildTree(body, lc, cols);
        const hasSettle = tree.expense.some(n => (n.cum || n.settle || 0) !== 0);
        out.push({ sheet: sh.name, format: hasSettle ? 'settle' : 'single', trees: [tree], labels: [''] });
      }
    }
    return out;
  }
  /* 재원 짐작: 세입에 시보조금·보조금수입이 있으면 보조금, 회비·후원금·전입금이 있으면 자부담 */
  function guessFund(tree) {
    const names = tree.income.map(n => n.name).join(' ');
    if (/보조금/.test(names)) return '보조금';
    if (/회비|후원금|전입금|이월금/.test(names)) return '자부담';
    const ex = tree.expense.map(n => n.path.join('/')).join(' ');
    if (/사업비\/사업진행비/.test(ex)) return '보조금';
    if (/사업비\/자립지원사업/.test(ex)) return '자부담';
    return '';
  }
  window.GXLS = { readBiff, parseBudget, guessFund, parseLabel };
})();
