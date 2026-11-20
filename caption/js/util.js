'use strict';
/* ===================== 작은 도구 ===================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
// 이 기기에 저장 (모든 읽기·쓰기를 try/catch로)
const ls = {
  get(k, d){ try{ const v = localStorage.getItem('cap1_' + k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem('cap1_' + k, JSON.stringify(v)); }catch(e){} },
  del(k){ try{ localStorage.removeItem('cap1_' + k); }catch(e){} },
};
const ss = {
  get(k){ try{ return sessionStorage.getItem('cap1_' + k); }catch(e){ return null; } },
  set(k, v){ try{ sessionStorage.setItem('cap1_' + k, v); }catch(e){} },
};
function toast(msg){
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  $('#toast').appendChild(t);
  setTimeout(() => t.remove(), 3600);
}

/* 페이지 안의 창 (alert/confirm 대신). 닫으면 창을 열기 전에 있던 곳으로 초점을 돌려줌 */
let sheetReturn = null;
function openSheet(html, onClick, focusSel){
  if($('#sheet').hidden) sheetReturn = document.activeElement;
  const box = $('#sheetBox'); box.innerHTML = html; $('#sheet').hidden = false;
  box.onclick = e => {
    if(e.target.closest('[data-close]')){ closeSheet(); return; }
    if(onClick) onClick(e);
  };
  setTimeout(() => { const f = box.querySelector(focusSel || 'input:not([type=checkbox]):not([type=radio]),textarea,h2[tabindex],button.primary'); if(f) f.focus(); }, 30);
  return box;
}
function closeSheet(){
  $('#sheet').hidden = true; $('#sheetBox').innerHTML = '';
  const r = sheetReturn; sheetReturn = null;
  if(r && document.contains(r) && r.focus) setTimeout(() => r.focus(), 0);
}
document.addEventListener('click', e => { if(e.target.id === 'sheet') closeSheet(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape' && !$('#sheet').hidden){ e.preventDefault(); closeSheet(); } });

/* 두 번 눌러야 실행되는 버튼 (confirm 대신) */
const armed = {};
function arm(btn, key, label){
  if(armed[key]){ clearTimeout(armed[key]); delete armed[key]; btn.classList.remove('armed'); btn.textContent = btn.dataset.orig; return true; }
  btn.dataset.orig = btn.textContent; btn.textContent = label || '한 번 더 누르면 실행'; btn.classList.add('armed');
  armed[key] = setTimeout(() => { delete armed[key]; btn.classList.remove('armed'); btn.textContent = btn.dataset.orig; }, 3500);
  return false;
}

/* 글 칸의 내용을 바뀐 부분만 바꿔 넣음. 커서는 같은 글자 옆에 그대로 둠
   (바뀐 부분 안에 있던 커서는 그 안에서 같은 칸 수만큼 떨어진 곳에 둠) */
function spliceText(ta, nv){
  const ov = ta.value; if(ov === nv) return;
  const m = Math.min(ov.length, nv.length);
  let p = 0; while(p < m && ov.charCodeAt(p) === nv.charCodeAt(p)) p++;
  let q = 0; while(q < m - p && ov.charCodeAt(ov.length - 1 - q) === nv.charCodeAt(nv.length - 1 - q)) q++;
  const oe = ov.length - q, ne = nv.length - q;
  const move = c => c <= p ? c : c >= oe ? c + nv.length - ov.length : p + Math.min(c - p, ne - p);
  const s = move(ta.selectionStart), e = move(ta.selectionEnd);
  try{ ta.setRangeText(nv.slice(p, ne), p, oe, 'preserve'); }catch(err){ ta.value = nv; }
  ta.setSelectionRange(s, e);
}

/* 줄 순서 열쇠: 글자 순서로 정렬되고, 어떤 두 열쇠 사이에도 새 열쇠를 만들 수 있음
   (메모장 방식에서 줄 사이에 줄을 넣어도 다른 줄의 열쇠는 그대로) */
const FD = '0123456789abcdefghijklmnopqrstuvwxyz';
const FSTEP = 36 ** 4, FMAX = 36 ** 8;
function fracMid(a, b){   // a < 결과 < b (a는 '' 가능, b는 null 가능)
  let res = '';
  for(let i = 0; i < 60; i++){
    const ca = i < a.length ? FD.indexOf(a[i]) : 0;
    const cb = b == null ? 36 : i < b.length ? FD.indexOf(b[i]) : 0;
    if(ca === cb){ res += FD[ca]; continue; }
    const mid = Math.floor((ca + cb) / 2);
    if(mid > ca) return res + FD[mid];
    res += FD[ca]; b = null;
  }
  return res + 'i';
}
function lineKeyBetween(prev, next){   // 'k'로 시작하는 줄 열쇠
  const a = prev ? prev.slice(1) : '', b = next ? next.slice(1) : null;
  if(b == null){
    if(!a) return 'k' + (36 ** 7).toString(36);
    const n = parseInt((a + '00000000').slice(0, 8), 36) + FSTEP;
    if(n < FMAX) return 'k' + n.toString(36).padStart(8, '0');
  }
  return 'k' + fracMid(a, b);
}
const lineText = v => v == null ? '' : typeof v === 'object' ? String(v.t || '') : String(v);

/* 화면 꺼짐 막기 (실패해도 조용히 넘어감) */
const WAKE = {
  want:false, lock:null,
  async on(){ WAKE.want = true; try{ if('wakeLock' in navigator && !WAKE.lock && document.visibilityState === 'visible'){ WAKE.lock = await navigator.wakeLock.request('screen'); WAKE.lock.addEventListener('release', () => { WAKE.lock = null; }); } }catch(e){ WAKE.lock = null; } },
  off(){ WAKE.want = false; try{ if(WAKE.lock) WAKE.lock.release(); }catch(e){} WAKE.lock = null; },
};
document.addEventListener('visibilitychange', () => { if(WAKE.want && document.visibilityState === 'visible') WAKE.on(); });

/* 글을 .txt 파일로 내려받기 (윈도우 메모장·한소네에서 한글이 깨지지 않게 BOM을 붙임) */
function downloadText(name, text){
  try{
    const blob = new Blob(['﻿' + text.replace(/\r?\n/g, '\r\n')], { type:'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }catch(e){ toast('파일을 저장하지 못했어요'); }
}
const ymd = (d = new Date()) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
const hm = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
