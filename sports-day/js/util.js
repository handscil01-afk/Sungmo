'use strict';
/* ===================== 유틸 ===================== */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now = () => Date.now();
const hm = t => { if(!t) return ''; const d=new Date(t); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); };
const ago = t => { if(!t) return '기록 없음'; const m = Math.floor((now()-t)/60000); return m<1 ? '방금' : m<60 ? `${m}분 전` : `${Math.floor(m/60)}시간 전`; };
const uid = () => Math.random().toString(36).slice(2,8) + now().toString(36).slice(-4);
const fmtSec = v => (v==null||v===''||isNaN(v)) ? '-' : Number(v).toFixed(2);
const byName = (a,b) => a.name.localeCompare(b.name, 'ko');
function mkStorage(kind){
  return {
    get(k,d){ try{ const v=window[kind].getItem(k); return v==null?d:JSON.parse(v);}catch(e){return d;} },
    set(k,v){ try{ window[kind].setItem(k,JSON.stringify(v)); }catch(e){} },
    del(k){ try{ window[kind].removeItem(k); }catch(e){} },
  };
}
const ls = mkStorage('localStorage');
// 이름처럼 "이 기기"를 나타내는 값. 연습 모드에서는 탭마다 다른 기기처럼 쓰려고 탭 저장소에 둠
const idStore = DEMO ? mkStorage('sessionStorage') : ls;

/* ===================== 알림(토스트) ===================== */
let toastTimer;
function toast(msg, actLabel, act){
  $('#toastMsg').textContent = msg;
  const b = $('#toastAct');
  b.textContent = actLabel||''; b.style.display = actLabel?'':'none';
  b.onclick = () => { $('#toast').classList.remove('show'); act && act(); };
  $('#toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>$('#toast').classList.remove('show'), actLabel?6000:2800);
}

/* ===================== 아래에서 올라오는 창(시트) ===================== */
let sheetRender = null;
function openSheet(fn){ sheetRender = fn; $('#sheet').classList.add('open'); drawSheet(); $('#sheetBox').scrollTop = 0; }
function closeSheet(){ sheetRender=null; $('#sheet').classList.remove('open'); $('#sheetBox').innerHTML=''; }
function drawSheet(){
  if(!sheetRender) return;
  const box = $('#sheetBox'), top = box.scrollTop;
  box.innerHTML = sheetRender(); box.scrollTop = top;
}
$('#sheet').addEventListener('click', e => { if(e.target.id==='sheet') closeSheet(); });

/* ===================== 대화창 (alert·confirm·prompt 대신) ===================== */
function dialog({ msg, input=null, type='text', ok='확인', cancel='취소', danger=false }){
  return new Promise(res => {
    const box = $('#dlgBox');
    box.innerHTML = `<p class="msg">${esc(msg)}</p>${input!=null?`<input id="dlgIn" type="${type}" value="${esc(input)}" autocomplete="off"><div style="height:14px"></div>`:''}
      <div class="row end">${cancel?`<button class="btn" id="dlgNo">${esc(cancel)}</button>`:''}<button class="btn ${danger?'danger':'primary'}" id="dlgOk">${esc(ok)}</button></div>`;
    $('#dlg').classList.add('open');
    const inp = $('#dlgIn'); if(inp){ inp.focus(); inp.select(); }
    const done = v => { $('#dlg').classList.remove('open'); box.innerHTML=''; res(v); setTimeout(flushDeferred, 0); };
    $('#dlgOk').onclick = () => done(inp ? inp.value : true);
    if($('#dlgNo')) $('#dlgNo').onclick = () => done(inp ? null : false);
    if(inp) inp.onkeydown = e => { if(e.key==='Enter') done(inp.value); };
  });
}
const ask = (msg, ok='확인', danger=false) => dialog({ msg, ok, danger });
const askText = (msg, v, ok='저장') => dialog({ msg, input: v||'', ok });

/* 버튼 동작 모음: data-a="이름" 을 누르면 ACT.이름(el, v) 실행. false를 돌려주면 화면을 다시 그리지 않음 */
const ACT = {};

/* 메뉴 화면 안의 위쪽 탭: 한 번에 한 가지만 보여 줘서 안에 무엇이 있는지 바로 알 수 있게 함
   tabs: [[키, 아이콘, 이름, 작은 글씨(선택)], …] */
const ITAB = ls.get('udh5_itab', {});
function innerTabs(key, tabs){
  if(!tabs.some(t => t[0]===ITAB[key])) ITAB[key] = tabs[0][0];
  return `<div class="seg btabs">${tabs.map(([k,i,l,b]) => `<button class="${ITAB[key]===k?'on':''}" data-a="itab" data-k="${key}" data-v="${k}"><b>${i}</b><span>${l}${b!=null&&b!==''?` <small>${b}</small>`:''}</span></button>`).join('')}</div>`;
}
ACT.itab = (el, v) => { ITAB[el.dataset.k] = v; ls.set('udh5_itab', ITAB); const m = document.querySelector('main'); if(m) m.scrollTop = 0; };
