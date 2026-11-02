/* 한글 문서(.hwp, .hwpx) 본문 읽기. 문단과 표(행·칸)를 꺼냄. 파일은 읽기만 함. */
(function () {
  'use strict';
  /* 결과: { blocks: [{type:'p', text} | {type:'table', rows:[[칸 글자]]}], lines: [문단 또는 '칸 | 칸'] } */
  async function readHwp(buf) {
    const cfb = new GCFB.CFB(new Uint8Array(buf));
    const fh = cfb.find('FileHeader');
    if (!fh) throw new Error('한글 문서가 아닙니다');
    const h = cfb.read(fh);
    const prop = h[36] | (h[37] << 8);
    if (prop & 2) throw new Error('암호가 걸린 문서는 읽을 수 없습니다');
    if (prop & 4) throw new Error('배포용 문서는 읽을 수 없습니다');
    const comp = prop & 1;
    const bt = cfb.find('BodyText');
    if (!bt) throw new Error('본문이 없습니다');
    const secs = cfb.kids(cfb.index(bt)).filter(e => /^Section\d+$/.test(e.name)).sort((a, b) => +a.name.slice(7) - +b.name.slice(7));
    const blocks = [];
    for (const se of secs) {
      let d = cfb.read(se);
      if (comp) d = await GCFB.inflateRaw(d);
      parseRecords(d, blocks);
    }
    return finish(blocks);
  }
  function paraText(b) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength); let s = '';
    for (let j = 0; j + 1 < b.length;) {
      const ch = v.getUint16(j, true);
      if (ch < 32) {
        if (ch === 10 || ch === 13) { s += '\n'; j += 2; continue; }
        if (ch === 0) { j += 2; continue; }
        if (ch >= 24) { s += (ch === 24 ? '-' : ' '); j += 2; continue; }
        if (ch === 9) s += '\t';
        j += 16; continue;
      }
      s += String.fromCharCode(ch); j += 2;
    }
    return s.replace(/\n+$/, '');
  }
  function parseRecords(d, blocks) {
    const v = new DataView(d.buffer, d.byteOffset, d.byteLength);
    const recs = [];
    for (let i = 0; i + 4 <= d.length;) {
      const hd = v.getUint32(i, true); let sz = hd >>> 20; const tag = hd & 0x3ff, lv = (hd >>> 10) & 0x3ff; i += 4;
      if (sz === 0xfff) { sz = v.getUint32(i, true); i += 4; }
      recs.push({ tag, lv, data: d.subarray(i, i + sz) }); i += sz;
    }
    const stack = []; // 열린 표들 {lv, cells:[], cur}
    const emitText = t => {
      const top = stack[stack.length - 1];
      if (top && top.cur) top.cur.text.push(t);
      else blocks.push({ type: 'p', text: t });
    };
    for (const r of recs) {
      while (stack.length && r.lv <= stack[stack.length - 1].lv) closeTable(stack, blocks);
      if (r.tag === 71 && r.data.length >= 4) { // CTRL_HEADER
        const id = String.fromCharCode(r.data[3], r.data[2], r.data[1], r.data[0]);
        if (id === 'tbl ') stack.push({ lv: r.lv, cells: [], cur: null, seq: 0 });
      } else if (r.tag === 72 && stack.length && r.lv === stack[stack.length - 1].lv + 1) { // 칸 시작
        const t = stack[stack.length - 1], dv = new DataView(r.data.buffer, r.data.byteOffset, r.data.byteLength);
        let col = null, row = null;
        if (r.data.length >= 12) { col = dv.getUint16(8, true); row = dv.getUint16(10, true); }
        if (col == null || col > 300 || row > 3000) { col = t.seq; row = 0; }
        t.cur = { col, row, text: [] }; t.cells.push(t.cur); t.seq++;
      } else if (r.tag === 67) { // PARA_TEXT
        const s = paraText(r.data);
        if (s.trim()) emitText(s);
      }
    }
    while (stack.length) closeTable(stack, blocks);
  }
  function closeTable(stack, blocks) {
    const t = stack.pop();
    const rows = [];
    for (const c of t.cells) { (rows[c.row] = rows[c.row] || [])[c.col] = c.text.join('\n').trim(); }
    const clean = rows.filter(Boolean).map(r => Array.from(r, x => x || ''));
    const block = { type: 'table', rows: clean };
    const parent = stack[stack.length - 1];
    if (parent && parent.cur) { // 표 안의 표: 바깥 칸에 글자로 넣고, 따로도 남김
      parent.cur.text.push(clean.map(r => r.join(' | ')).join('\n'));
    }
    blocks.push(block);
  }
  /* .hwpx: Contents/section*.xml 을 태그 단위로 훑음 */
  async function readHwpx(buf) {
    const files = await GCFB.unzip(buf, n => /^Contents\/section\d+\.xml$/i.test(n));
    const names = Object.keys(files).sort((a, b) => +a.match(/(\d+)\.xml$/i)[1] - +b.match(/(\d+)\.xml$/i)[1]);
    if (!names.length) throw new Error('한글(hwpx) 본문이 없습니다');
    const blocks = [], dec = new TextDecoder('utf-8');
    for (const n of names) scanXml(dec.decode(files[n]), blocks);
    return finish(blocks);
  }
  const ent = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).replace(/&amp;/g, '&');
  function scanXml(x, blocks) {
    const re = /<(\/?)([A-Za-z0-9_]+:)?([A-Za-z0-9_]+)([^>]*?)(\/?)>|([^<]+)/g;
    const stack = []; // 표 {cells, cur}
    let para = null, inT = 0, m;
    const paraOpen = []; // 문단 겹침(표 안 문단)
    while ((m = re.exec(x))) {
      if (m[6] != null) { if (inT && para) para.s += ent(m[6]); continue; }
      const close = m[1] === '/', tag = m[3], self = m[5] === '/', attrs = m[4] || '';
      if (tag === 'p') {
        if (!close) { para = { s: '' }; paraOpen.push(para); if (self) end(); }
        else end();
      } else if (tag === 't') { if (!close && !self) inT++; else if (close) inT = Math.max(0, inT - 1); }
      else if (tag === 'lineBreak' && para) para.s += '\n';
      else if (tag === 'tab' && para && inT) para.s += '\t';
      else if (tag === 'tbl') {
        if (!close) stack.push({ cells: [], cur: null, seq: 0, pend: paraOpen.length });
        else if (stack.length) {
          const t = stack.pop();
          const rows = [];
          for (const c of t.cells) (rows[c.row] = rows[c.row] || [])[c.col] = c.text.join('\n').trim();
          const clean = rows.filter(Boolean).map(r => Array.from(r, v => v || ''));
          const parent = stack[stack.length - 1];
          if (parent && parent.cur) parent.cur.text.push(clean.map(r => r.join(' | ')).join('\n'));
          blocks.push({ type: 'table', rows: clean });
        }
      } else if (tag === 'tc' && stack.length) {
        const t = stack[stack.length - 1];
        if (!close) { t.cur = { col: t.seq, row: t.row || 0, text: [] }; t.cells.push(t.cur); t.seq++; }
        else t.cur = null;
      } else if (tag === 'tr' && stack.length && !close) { const t = stack[stack.length - 1]; t.row = (t.row == null ? 0 : t.row + 1); t.seq = 0; }
      else if (tag === 'cellAddr' && stack.length) {
        const t = stack[stack.length - 1];
        const c = /colAddr="(\d+)"/.exec(attrs), r = /rowAddr="(\d+)"/.exec(attrs);
        if (t.cur) { if (c) t.cur.col = +c[1]; t.cur.row = r ? +r[1] : (t.row || 0); }
      }
    }
    function end() {
      const p = paraOpen.pop(); para = paraOpen[paraOpen.length - 1] || null;
      if (!p) return;
      const s = p.s.replace(/\n+$/, '');
      if (!s.trim()) return;
      const t = stack[stack.length - 1];
      if (t && t.cur) t.cur.text.push(s); else blocks.push({ type: 'p', text: s });
    }
  }
  function finish(blocks) {
    // 표 안의 표가 바깥 표보다 먼저 닫히므로 순서는 대략적임. 줄 목록은 문단과 표 행을 합친 것
    const lines = [];
    for (const b of blocks) {
      if (b.type === 'p') b.text.split('\n').forEach(t => { if (t.trim()) lines.push(t.trim()); });
      else b.rows.forEach(r => { const t = r.map(c => c.replace(/\s*\n\s*/g, ' ').trim()).join(' | '); if (t.replace(/[|\s]/g, '')) lines.push(t); });
    }
    return { blocks, lines };
  }
  async function readDoc(file) {
    const buf = await file.arrayBuffer();
    const u = new Uint8Array(buf, 0, 8);
    if (u[0] === 0xD0 && u[1] === 0xCF) return readHwp(buf);
    if (u[0] === 0x50 && u[1] === 0x4B) return readHwpx(buf);
    throw new Error('한글(.hwp, .hwpx) 파일이 아닙니다');
  }
  window.GHWP = { readDoc, readHwp, readHwpx };
})();
