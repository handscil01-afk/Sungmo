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
