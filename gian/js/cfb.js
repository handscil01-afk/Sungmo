/* 복합 문서(CFB) 읽기: 옛 엑셀(.xls)과 한글(.hwp) 파일이 이 형식을 씀. 읽기만 함. */
(function () {
  'use strict';
  const END = 0xFFFFFFFA;
  function CFB(buf) {
    const d = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const v = new DataView(d.buffer, d.byteOffset, d.byteLength);
    const sig = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
    for (let i = 0; i < 8; i++) if (d[i] !== sig[i]) throw new Error('복합 문서 형식이 아닙니다');
    const u16 = o => v.getUint16(o, true), u32 = o => v.getUint32(o, true);
    const ss = 1 << u16(30), mss = 1 << u16(32);
    const nfat = u32(44), dirst = u32(48), cut = u32(56), mfst = u32(60), difst = u32(68), ndif = u32(72);
    const sec = n => d.subarray((n + 1) * ss, (n + 2) * ss);
    const difat = [];
    for (let i = 0; i < 109; i++) difat.push(u32(76 + i * 4));
    let s = difst;
    for (let k = 0; k < ndif && s < END; k++) {
      const b = sec(s), bv = new DataView(b.buffer, b.byteOffset, b.byteLength), n = ss / 4;
      for (let i = 0; i < n - 1; i++) difat.push(bv.getUint32(i * 4, true));
      s = bv.getUint32((n - 1) * 4, true);
    }
    const fat = [];
    for (const x of difat.slice(0, nfat)) {
      const b = sec(x), bv = new DataView(b.buffer, b.byteOffset, b.byteLength);
      for (let i = 0; i < ss / 4; i++) fat.push(bv.getUint32(i * 4, true));
    }
    const chain = n => {
      const parts = []; let guard = 0;
      while (n < END && guard++ < 1e6) { parts.push(sec(n)); n = fat[n]; }
      return concat(parts);
    };
    const db = chain(dirst), dv = new DataView(db.buffer, db.byteOffset, db.byteLength);
    const ents = [];
    for (let i = 0; i + 128 <= db.length; i += 128) {
      const nl = dv.getUint16(i + 64, true);
      let name = '';
      for (let j = 0; j + 1 < Math.max(nl - 2, 0); j += 2) name += String.fromCharCode(dv.getUint16(i + j, true));
      ents.push({ name, type: db[i + 66], l: dv.getUint32(i + 68, true), r: dv.getUint32(i + 72, true), c: dv.getUint32(i + 76, true), st: dv.getUint32(i + 116, true), sz: dv.getUint32(i + 120, true) });
    }
    const mini = ents.length ? chain(ents[0].st) : new Uint8Array(0);
    let mfat = [];
    if (mfst < END) { const m = chain(mfst), mv = new DataView(m.buffer, m.byteOffset, m.byteLength); for (let i = 0; i + 4 <= m.length; i += 4) mfat.push(mv.getUint32(i, true)); }
    this.ents = ents;
    this.kids = idx => {
      const res = [], st = [ents[idx].c];
      while (st.length) { const j = st.pop(); if (j === 0xFFFFFFFF || j >= ents.length) continue; const e = ents[j]; res.push(e); st.push(e.l, e.r); }
      return res;
    };
    this.find = (name, parent) => this.kids(parent == null ? 0 : parent).find(e => e.name === name) || null;
    this.index = e => ents.indexOf(e);
    this.read = e => {
      if (e.sz < cut) {
        const parts = []; let n = e.st, guard = 0;
        while (n < END && guard++ < 1e6) { parts.push(mini.subarray(n * mss, (n + 1) * mss)); n = mfat[n]; }
        return concat(parts).subarray(0, e.sz);
      }
      return chain(e.st).subarray(0, e.sz);
    };
  }
  function concat(parts) {
    let n = 0; for (const p of parts) n += p.length;
    const out = new Uint8Array(n); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  /* 한글(.hwp) 본문은 압축 끝 뒤에 여분 바이트가 붙어 있는 경우가 많음.
     브라우저는 이때 끝에서 오류를 내므로, 그때까지 풀린 내용을 그대로 씀 */
  async function inflateRaw(u8) {
    const ds = new DecompressionStream('deflate-raw');
    const w = ds.writable.getWriter();
    w.write(u8).catch(() => {}); w.close().catch(() => {});
    const rd = ds.readable.getReader(), parts = [];
    try { for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); } }
    catch (e) { if (!parts.length) throw e; }
    return concat(parts);
  }
  /* zip(.hwpx, .xlsx) 안의 파일 읽기 */
  async function unzip(buf, want) {
    const d = new Uint8Array(buf), v = new DataView(d.buffer, d.byteOffset, d.byteLength);
    let e = -1;
    for (let i = d.length - 22; i >= Math.max(0, d.length - 70000); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('zip 형식이 아닙니다');
    const cnt = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true);
    const out = {}, dec = new TextDecoder('utf-8');
    for (let k = 0; k < cnt; k++) {
      if (v.getUint32(p, true) !== 0x02014b50) break;
      const method = v.getUint16(p + 10, true), csz = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), el = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
      const name = dec.decode(d.subarray(p + 46, p + 46 + nl));
      p += 46 + nl + el + cl;
      if (want && !want(name)) continue;
      const lnl = v.getUint16(lo + 26, true), lel = v.getUint16(lo + 28, true);
      const raw = d.subarray(lo + 30 + lnl + lel, lo + 30 + lnl + lel + csz);
      out[name] = method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null;
    }
    return out;
  }
  window.GCFB = { CFB, inflateRaw, unzip, concat };
})();
