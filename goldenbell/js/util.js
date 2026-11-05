'use strict';
/* ===================== 작은 도구 ===================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = o => JSON.parse(JSON.stringify(o));
const now = () => Date.now();
// 이 기기에 저장 (모든 읽기·쓰기를 try/catch로)
const ls = {
  get(k, d){ try{ const v = localStorage.getItem('gb1_' + k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem('gb1_' + k, JSON.stringify(v)); }catch(e){} },
};
const ss = {
  get(k){ try{ return sessionStorage.getItem('gb1_' + k); }catch(e){ return null; } },
  set(k, v){ try{ sessionStorage.setItem('gb1_' + k, v); }catch(e){} },
};
function toast(msg, kind){
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : ''); t.textContent = msg;
  $('#toast').appendChild(t);
  setTimeout(() => t.remove(), kind === 'radio' ? 6000 : 3400);
}
const vib = p => { try{ if(navigator.vibrate) navigator.vibrate(p); }catch(e){} };

/* 페이지 안의 창 (alert/confirm 대신) */
function openSheet(html, onClick){
  const box = $('#sheetBox'); box.innerHTML = html; $('#sheet').hidden = false;
  box.onclick = e => {
    if(e.target.closest('[data-close]')){ closeSheet(); return; }
    if(onClick) onClick(e);
  };
  setTimeout(() => { const f = box.querySelector('input,button.primary'); if(f) f.focus(); }, 30);
  return box;
}
function closeSheet(){ $('#sheet').hidden = true; $('#sheetBox').innerHTML = ''; }
document.addEventListener('click', e => { if(e.target.id === 'sheet') closeSheet(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

/* 두 번 눌러야 실행되는 버튼 (confirm 대신) */
const armed = {};
function arm(btn, key, label){
  if(armed[key]){ clearTimeout(armed[key]); delete armed[key]; btn.classList.remove('armed'); btn.textContent = btn.dataset.orig; return true; }
  btn.dataset.orig = btn.textContent; btn.textContent = label || '한 번 더 누르면 실행'; btn.classList.add('armed');
  armed[key] = setTimeout(() => { delete armed[key]; btn.classList.remove('armed'); btn.textContent = btn.dataset.orig; }, 3500);
  return false;
}
