/* 공용 도구: 네임스페이스, 난수, 저장소, DOM 도우미 */
(function (root) {
  'use strict';
  const DB = root.DB = root.DB || {};

  // 난수: 테스트에서 시드를 넣을 수 있도록 한 곳에서만 만든다
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const RNG = {
    fn: Math.random,
    seed(s) { this.fn = s == null ? Math.random : mulberry32(s); },
    next() { return this.fn(); },
    int(n) { return Math.floor(this.fn() * n); },
    range(a, b) { return a + Math.floor(this.fn() * (b - a + 1)); },
    pick(arr) { return arr[Math.floor(this.fn() * arr.length)]; },
    die() { return 1 + Math.floor(this.fn() * 6); },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.fn() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    },
    weighted(table) { // [[값, 가중치], ...]
      const total = table.reduce((s, t) => s + t[1], 0);
      let r = this.fn() * total;
      for (const [v, w] of table) { if ((r -= w) < 0) return v; }
      return table[table.length - 1][0];
    }
  };
  DB.RNG = RNG;
  DB.mulberry32 = mulberry32;

  // localStorage: 사생활 보호 모드 등에서 실패해도 게임은 계속 돌아가야 한다
  DB.store = {
    get(key, fallback) {
      try { const v = root.localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(key, value) { try { root.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } },
    del(key) { try { root.localStorage.removeItem(key); } catch (e) { /* 무시 */ } }
  };

  DB.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  DB.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  if (root.document) {
    DB.$ = (sel, el) => (el || document).querySelector(sel);
    DB.$$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  }
})(typeof window !== 'undefined' ? window : globalThis);
