/* wav 파일과 zip 파일(압축 없이 묶기만 함)을 만듦. 외부 라이브러리 없이 씀 */
const WavZip = (() => {
  function wav(int16, sr){
    const b = new ArrayBuffer(44 + int16.length * 2), v = new DataView(b);
    const s = (o, t) => { for(let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    s(0, 'RIFF'); v.setUint32(4, 36 + int16.length * 2, true); s(8, 'WAVE'); s(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true);
    v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, int16.length * 2, true);
    new Int16Array(b, 44).set(int16);
    return new Uint8Array(b);
  }
  const T = new Uint32Array(256);
  for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
  function crc(u8){ let c = 0xFFFFFFFF; for(let i = 0; i < u8.length; i++) c = T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  // files: [{ name, data:Uint8Array }] → Blob
  function zip(files){
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    for(const f of files){
      const name = enc.encode(f.name), c = crc(f.data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint32(14, c, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, name.length, true);
      parts.push(h.buffer, name, f.data);
      const d = new DataView(new ArrayBuffer(46));
      d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x0800, true);
      d.setUint32(16, c, true); d.setUint32(20, f.data.length, true); d.setUint32(24, f.data.length, true); d.setUint16(28, name.length, true); d.setUint32(42, off, true);
      central.push(d.buffer, name);
      off += 30 + name.length + f.data.length;
    }
    const csize = central.reduce((a, p) => a + (p.byteLength ?? p.length), 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...central, e.buffer], { type:'application/zip' });
  }
  return { wav, zip, crc };
})();
if(typeof module !== 'undefined') module.exports = WavZip;
