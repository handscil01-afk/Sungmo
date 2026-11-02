/* 저장: 브라우저(IndexedDB)에 늘 저장하고, 연결한 '기안도우미' 폴더가 있으면 그 폴더의 파일 하나와 날짜별 백업에도 씀.
   기안·스캔 폴더에는 쓰지 않음 */
(function () {
  'use strict';
  const FILE = '기안도우미.json';
  const IDB = {
    db: null,
    open() { return this.db ? Promise.resolve(this.db) : new Promise((ok, no) => { try { const r = indexedDB.open('gian', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { this.db = r.result; ok(this.db); }; r.onerror = () => no(r.error); } catch (e) { no(e); } }); },
    async get(k) { try { const db = await this.open(); return await new Promise(ok => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => ok(q.result); q.onerror = () => ok(undefined); }); } catch (e) { return undefined; } },
    async put(k, v) { try { const db = await this.open(); await new Promise(ok => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = ok; t.onerror = ok; }); } catch (e) { /* 무시 */ } }
  };
  const empty = () => ({ v: 1, savedAt: 0, budgets: [], projects: {}, guide: {} });
  const S = {
    data: empty(), dir: null, perm: 'none', lastSync: 0, status: '', onConflict: null, timer: null,
    async load() {
      const d = await IDB.get('data');
      if (d && d.v) S.data = Object.assign(empty(), d);
      S.dir = (await IDB.get('dir')) || null;
      if (S.dir) {
        S.perm = await S.query();
        if (S.perm === 'granted') await S.pull();
      }
      return S.data;
    },
    async query() { try { return await S.dir.queryPermission({ mode: 'readwrite' }); } catch (e) { return 'denied'; } },
    async readFile() {
      try { const fh = await S.dir.getFileHandle(FILE); const f = await fh.getFile(); const j = JSON.parse(await f.text()); return j && j.v ? j : null; }
      catch (e) { return null; }
    },
    /* 폴더 파일이 더 새것이면 불러옴 */
    async pull() {
      const j = await S.readFile();
      if (j && (j.savedAt || 0) > (S.data.savedAt || 0)) { S.data = Object.assign(empty(), j); await IDB.put('data', S.data); S.status = '폴더에서 불러옴'; }
      S.lastSync = Math.max(S.data.savedAt || 0, j ? j.savedAt || 0 : 0);
    },
    async reconnect() {
      try { S.perm = await S.dir.requestPermission({ mode: 'readwrite' }); } catch (e) { S.perm = 'denied'; }
      if (S.perm === 'granted') { await S.pull(); await S.write(); }
      return S.perm;
    },
    async link(handle) {
      S.dir = handle; S.perm = 'granted'; await IDB.put('dir', handle);
      const j = await S.readFile();
      return j; // 호출한 쪽에서 합칠지 고름
    },
    async unlink() { S.dir = null; S.perm = 'none'; await IDB.put('dir', null); },
    save() {
      S.data.savedAt = Date.now();
      clearTimeout(S.timer);
      S.timer = setTimeout(() => S.flush(), 500);
    },
    async flush() {
      await IDB.put('data', S.data);
      if (S.dir && S.perm === 'granted') await S.write();
    },
    async write() {
      try {
        const j = await S.readFile();
        if (j && (j.savedAt || 0) > S.lastSync && (j.savedAt || 0) !== S.data.savedAt && S.onConflict) { S.onConflict(j); return; }
        const fh = await S.dir.getFileHandle(FILE, { create: true });
        const w = await fh.createWritable(); await w.write(JSON.stringify(S.data)); await w.close();
        const bk = await S.dir.getDirectoryHandle('백업', { create: true });
        const d = new Date(), name = '기안도우미-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.json';
        const bh = await bk.getFileHandle(name, { create: true });
        const bw = await bh.createWritable(); await bw.write(JSON.stringify(S.data)); await bw.close();
        S.lastSync = S.data.savedAt; S.status = '폴더에 저장함';
      } catch (e) { S.status = '폴더에 저장하지 못함: ' + (e && e.message || e); }
    },
    async replace(j) { S.data = Object.assign(empty(), j); S.lastSync = j.savedAt || 0; await IDB.put('data', S.data); },
    empty
  };
  window.GSTORE = S;
})();
