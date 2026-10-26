'use strict';
/* ===================== 안내판: PC·프로젝터 화면 =====================
   안내판 기기마다 '태블릿'(기본) 또는 'PC·프로젝터'를 고름 (이 기기에만 저장).
   PC·프로젝터 화면은 모든 안내판 화면(개인전 표, 사람 크게 보기, 단체전·과녁판, 종합 현황, 시상식, 겹쳐 뜨는 화면)이
   스크롤 없이 한 화면에 꼭 맞게 들어가야 함. 그래서 안내판 글자는 모두 기준 글자 크기(--fs)의 배수로 정하고,
   그려진 뒤에 내용이 넘치지 않는 가장 큰 --fs 를 이분 탐색으로 찾아 맞춤 (8px ~ 64px).
   개인전 표는 표를 1~4칸으로 나눠 보고 글자가 가장 커지는 칸 수를 고름.
   다시 맞추는 때: 화면을 그릴 때마다(자료가 바뀔 때) · 창 크기가 바뀔 때 · 전체화면을 켜고 끌 때
   마우스 커서는 3초 동안 움직임이 없으면 숨김 (프로젝터용) */
let BDKIND = ls.get('udh5_bdkind', 'tablet'); if(BDKIND !== 'pc') BDKIND = 'tablet';
const bdPC = () => BDKIND === 'pc';
const BDPC = { fs:{}, ncol:{}, build:null, sig:'', count:0, raf:0 };
const BD_FS_MIN = 8, BD_FS_MAX = 64;

// 지금 크기에서 내용이 넘치지 않는가: 안내판 칸 전체, 그 안의 잘리거나 밀려난 칸이 없는지 봄
// (세로는 글자 모양 때문에 생기는 1~2px 차이를 넘어가지 않도록, 자식 칸의 실제 위치로 잼)
const BD_BOX = '.award,.bp,.pcard';             // 안쪽 여백이 있는 테두리 칸: 내용이 여백 쪽으로 삐져나와도 스크롤은 안 생기므로 따로 잼
const BD_TBL = /^(TR|TD|TH|THEAD|TBODY)$/;     // 표 줄·칸은 칸을 합친 셀 때문에 위치로 재면 틀림
function bdFits(root){
  if(root.scrollHeight > root.clientHeight + 1 || root.scrollWidth > root.clientWidth + 1) return false;
  const els = root.getElementsByTagName('*');
  for(let i = 0; i < els.length; i++){
    const e = els[i];
    if(e.clientWidth && e.scrollWidth > e.clientWidth + 2){ if(!e.closest('.tgtbox')) return false; }
    if(e.clientHeight && (e.scrollHeight > e.clientHeight + 2 || e.matches(BD_BOX)) && e.firstElementChild && !BD_TBL.test(e.tagName) && !e.closest('.tgtbox') && bdVOver(e)) return false;
  }
  return true;
}
function bdVOver(e){
  const r = e.getBoundingClientRect(), es = getComputedStyle(e);
  // 안쪽 여백까지 포함해 재면 내용이 테두리 쪽으로 삐져나온 것을 놓치므로, 여백을 뺀 안쪽 칸으로 잼
  const top = r.top + (parseFloat(es.borderTopWidth) || 0) + (parseFloat(es.paddingTop) || 0) * .5;
  const bot = r.bottom - (parseFloat(es.borderBottomWidth) || 0) - (parseFloat(es.paddingBottom) || 0) * .5;
  for(const c of e.children){
    const cs = getComputedStyle(c);
    if(cs.position === 'absolute' || cs.position === 'fixed' || cs.display === 'inline' || cs.display === 'none') continue;
    const cr = c.getBoundingClientRect();
    if(cr.height && (cr.bottom > bot + 1.5 || cr.top < top - 1.5)) return true;
  }
  return false;
}
// 넘치지 않는 가장 큰 글자 크기 (hint: 지난번에 맞춘 값이 아직 맞으면 두 번만 재고 끝냄)
function bdSearch(root, hint){
  const lo = BD_FS_MIN, hi = +root.dataset.fsmax || BD_FS_MAX;
  const set = v => root.style.setProperty('--fs', v.toFixed(2) + 'px');
  const ok = v => { set(v); return bdFits(root); };
  if(hint >= lo && hint < hi && ok(hint) && !ok(Math.min(hi, hint + 0.6))){ set(hint); return hint; }
  if(!ok(lo)){ set(lo); return lo; }
  if(ok(hi)) return hi;
  let a = lo, b = hi;
  for(let i = 0; i < 11; i++){ const mid = (a + b) / 2; if(ok(mid)) a = mid; else b = mid; }
  set(a); return a;
}
function bdSetCols(il, n){
  if(+il.dataset.cols === n) return;
  il.dataset.cols = n; il.innerHTML = BDPC.build(n); il.style.gridTemplateColumns = `repeat(${n},1fr)`;
}
// 개인전 표: 1~4칸을 모두 맞춰 보고 글자가 가장 커지는 칸 수를 고름 (비슷하면 칸이 적은 쪽)
function bdPlanCols(root, il, key){
  const ck = `${key}|${innerWidth}x${innerHeight}|${BDPC.sig}`;
  let n = BDPC.ncol[ck];
  if(!n){
    let best = { fs:-1, n:1 };
    for(let k = 1; k <= Math.max(1, Math.min(4, BDPC.count)); k++){
      bdSetCols(il, k);
      const fs = bdSearch(root, 0);
      if(fs > best.fs + 0.5) best = { fs, n:k };
    }
    n = best.n; BDPC.ncol[ck] = n;
  }
  bdSetCols(il, n);
}
function bdFit(){
  if(!bdPC()) return;
  document.querySelectorAll('.bdpc[data-fit]').forEach(root => {
    try{
      const key = root.dataset.fskey || 'x', il = root.querySelector('.ilist[data-plan]');
      if(il && BDPC.build) bdPlanCols(root, il, key);
      BDPC.fs[key] = bdSearch(root, BDPC.fs[key] || 0);
    }catch(e){ console.error(e); }
  });
}
function bdFitSoon(){
  if(BDPC.raf || !bdPC()) return;
  BDPC.raf = requestAnimationFrame(() => { BDPC.raf = 0; bdFit(); });
}
window.addEventListener('resize', bdFitSoon);
document.addEventListener('fullscreenchange', bdFitSoon);
document.addEventListener('webkitfullscreenchange', bdFitSoon);
if(document.fonts && document.fonts.ready) document.fonts.ready.then(bdFitSoon).catch(() => {});

/* ---------- 마우스 커서 숨기기 (PC 화면의 안내판 기기만) ---------- */
const CUR = { t:0, x:-1, y:-1 };
function bdCursorShow(e){
  if(e && e.clientX === CUR.x && e.clientY === CUR.y) return;       // 화면이 바뀔 때 생기는 가짜 움직임은 무시
  if(e){ CUR.x = e.clientX; CUR.y = e.clientY; }
  document.body.classList.remove('nocursor'); clearTimeout(CUR.t); CUR.t = 0;
  if(document.body.classList.contains('pcboard')) CUR.t = setTimeout(() => { CUR.t = 0; document.body.classList.add('nocursor'); }, 3000);
}
document.addEventListener('mousemove', bdCursorShow, { passive:true });

// 화면을 그린 직후에 부름: 커서 상태를 맞추고 글자 크기를 맞춤 (그리기 전에 끝내므로 깜빡이지 않음)
function bdAfterRender(){
  const on = bdPC() && boardOn() && !UI.preview;
  const was = document.body.classList.contains('pcboard');
  document.body.classList.toggle('pcboard', on);
  if(on && !was) bdCursorShow();
  if(!on && was){ document.body.classList.remove('nocursor'); clearTimeout(CUR.t); CUR.t = 0; }
  bdFit();
}
