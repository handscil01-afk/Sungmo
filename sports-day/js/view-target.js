'use strict';
/* ===================== 과녁판 중계 (콩주머니처럼 1:1 대결에서 던진 자리를 과녁 위에 표시) =====================
   - 과녁 사진: main/assets/target_{종목} = { data(JPEG data URL), at, by }  (마스터가 종목 탭에서 올림)
   - 던진 자리: main/calls/{종목}.marks = { list:[{ t:'blue'|'red', x:0~1, y:0~1, n:던진 순서 }], first, at, by, addN, addAt }
   - 심판 화면에서 누르면 표시가 생기고, 안내판은 같은 자료를 읽어 실시간으로 보여 줌
   - 결과를 저장하면 표시를 대결 기록(matches.marks)으로 옮기고 과녁판은 비움 */
const TG = { edit:{}, sel:{}, pend:null, drag:false, suppress:0, upEv:'' };
const MAX_MARKS = 40;
const r3 = v => Math.round(v*1000)/1000;
const clamp01 = v => Math.max(0, Math.min(1, v));

/* ---------- 과녁 사진 (data URL → 가벼운 blob 주소로 바꿔 두고 씀: 화면을 다시 그릴 때마다 큰 글자를 넣지 않으려고) ---------- */
const TGU = {};
function dataToBlobUrl(d){
  const i = d.indexOf(','), head = d.slice(0, i), bin = atob(d.slice(i+1)), u = new Uint8Array(bin.length);
  for(let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
  return URL.createObjectURL(new Blob([u], { type:(head.match(/:(.*?);/)||[])[1] || 'image/jpeg' }));
}
function tgtUrl(ev){
  const a = D.assets['target_'+ev]; if(!a || !a.data) return '';
  const key = a.at + ':' + a.data.length, c = TGU[ev];
  if(c && c.key===key) return c.url;
  if(c){ try{ URL.revokeObjectURL(c.url); }catch(e){} delete TGU[ev]; }
  try{ const url = dataToBlobUrl(a.data); TGU[ev] = { key, url }; return url; }catch(e){ return ''; }
}

/* ---------- 과녁판 그림 ---------- */
// o: { list(표시들), interactive(눌러서 찍기), edit, sel, thumb, board, pulseN, pulseAt }
function tgtBox(ev, o={}){
  const list = o.list || [], url = tgtUrl(ev);
  const marks = list.map(k => {
    const pulse = o.pulseN && k.n===o.pulseN && o.pulseAt;
    const st = `left:${(clamp01(+k.x)*100).toFixed(2)}%;top:${(clamp01(+k.y)*100).toFixed(2)}%${pulse ? `;animation-delay:-${Math.max(0, now()-o.pulseAt)}ms` : ''}`;
    return `<span class="mk ${k.t==='red'?'red':'blue'} ${o.sel===k.n?'sel':''} ${pulse?'pulse':''}" data-n="${k.n}" style="${st}">${k.n}</span>`;
  }).join('');
  const cls = `tgtbox ${url?'':'noimg'} ${o.edit?'edit':''} ${o.thumb?'thumb':''} ${o.board?'bdt':''}`;
  return `<div class="${cls}" ${o.interactive ? `data-a="tgTap" data-ev="${ev}"` : ''} ${url ? `style="background-image:url('${url}')"` : ''} role="img" aria-label="과녁판 ${list.length}개 표시">${marks}</div>`;
}
// 다음에 던질 팀: 맨 처음은 '먼저 던질 팀', 그 뒤는 마지막에 던진 팀의 반대
function nextTeamOf(mk){ const last = mk.list[mk.list.length-1]; return last ? (last.t==='blue' ? 'red' : 'blue') : mk.first; }
const markCount = (mk, t) => mk.list.filter(k => k.t===t).length;

// 심판 화면: 먼저 던질 팀 · 다음 던질 팀 · 과녁판 · 되돌리기 / 수정 / 모두 지우기
function targetPanel(ev, editable){
  const mk = marksOf(ev), nxt = nextTeamOf(mk), edit = editable && !!TG.edit[ev];
  const sel = TG.sel[ev] && mk.list.some(k => k.n===TG.sel[ev]) ? TG.sel[ev] : 0;
  const head = `<div class="tghead"><div class="tgfirst"><span class="sub">먼저 던질 팀</span><div class="seg sm">${TEAM_KEYS.map(t =>
      `<button class="${mk.first===t?'on '+t:''}" data-a="tgFirst" data-v="${t}" ${(mk.list.length || !editable)?'disabled':''}>${esc(teamName(t))}</button>`).join('')}</div></div>
    <b class="tgnext ${nxt}">다음: ${esc(teamName(nxt))} ${markCount(mk, nxt)+1}번째</b></div>`;
  const acts = editable ? `<div class="tgacts"><button class="btn small" data-a="tgUndo" ${mk.list.length?'':'disabled'}>되돌리기</button>
      <button class="btn small ${edit?'ok':''}" data-a="tgEdit" aria-pressed="${edit}">수정</button>
      ${edit && sel ? '<button class="btn small danger" data-a="tgDelSel">이 표시 지우기</button>' : ''}
      <button class="btn small danger" data-a="tgClear" ${mk.list.length?'':'disabled'}>모두 지우기</button>
      <span class="tgcount"><span class="blue">${esc(teamShort('blue'))} ${markCount(mk,'blue')}</span> <span class="red">${esc(teamShort('red'))} ${markCount(mk,'red')}</span></span></div>` : '';
  const hint = edit ? '<div class="sub tghint">표시를 끌어서 옮기거나, 눌러서 고른 뒤 지울 수 있습니다.</div>' : '';
  return `<div class="tgtpanel gtgt">${head}<div class="tgtwrap">${tgtBox(ev, { list:mk.list, interactive:editable, edit, sel })}</div>${acts}${hint}</div>`;
}
// 안내판: 과녁판 + 팀별 개수. 방금 찍힌 표시는 잠깐 커졌다 작아짐
function tgtBoardHtml(ev, o = {}){
  const mk = marksOf(ev), fresh = mk.addAt && now() - mk.addAt < 5000;
  return `<div class="bdtg${o.legend===false ? ' nolg' : ''}">${tgtBox(ev, { list:mk.list, board:true, pulseN: fresh ? mk.addN : 0, pulseAt: mk.addAt })}
    ${o.legend===false ? '' : `<div class="tglegend"><span class="blue">${teamBadge('blue')} ${esc(teamName('blue'))} ${markCount(mk,'blue')}개</span><span class="red">${teamBadge('red')} ${esc(teamName('red'))} ${markCount(mk,'red')}개</span></div>`}</div>`;
}

/* ---------- 표시 저장 ---------- */
function putMarks(ev, mk, list, extra={}){
  if(!can.record(ev)){ denied(); return Promise.resolve(false); }
  return put(['main','calls',ev], { marks:{ list, first:mk.first, at:now(), by:UI.me, addN:mk.addN, addAt:mk.addAt, ...extra } });
}
function moveMark(ev, n, x, y){
  const mk = marksOf(ev);
  return putMarks(ev, mk, mk.list.map(k => k.n===n ? { ...k, x:r3(x), y:r3(y) } : k));
}

Object.assign(ACT, {
  // 과녁판을 누르면: 보통 때는 그 자리에 새 표시, 수정 중에는 누른 표시를 고름
  tgTap: (el, v, e) => {
    const ev = el.dataset.ev; if(!can.record(ev)) return denied();
    if(TG.edit[ev]){
      if(now() - TG.suppress < 400) return false;
      const m = e.target.closest && e.target.closest('.mk'); TG.sel[ev] = m ? +m.dataset.n : 0; return;
    }
    const mk = marksOf(ev); if(mk.list.length >= MAX_MARKS){ toast('표시는 40개까지 찍을 수 있습니다.'); return false; }
    const r = el.getBoundingClientRect(), n = mk.list.length + 1;
    const mark = { t:nextTeamOf(mk), x:r3(clamp01((e.clientX - r.left) / r.width)), y:r3(clamp01((e.clientY - r.top) / r.height)), n };
    putMarks(ev, mk, [...mk.list, mark], { addN:n, addAt:now() });
    if(navigator.vibrate) navigator.vibrate(20);
    return false;
  },
  tgFirst: (el, v) => { const ev = UI.ev, mk = marksOf(ev); if(mk.list.length) return false; putMarks(ev, mk, [], { first:v }); },
  tgUndo: () => { const ev = UI.ev, mk = marksOf(ev); if(!mk.list.length) return false; putMarks(ev, mk, mk.list.slice(0, -1)); },
  tgEdit: () => { const ev = UI.ev; TG.edit[ev] = !TG.edit[ev]; TG.sel[ev] = 0; },
  tgDelSel: () => { const ev = UI.ev, mk = marksOf(ev), n = TG.sel[ev]; if(!n) return false;
    // 지운 표시 뒤의 번호는 한 칸씩 당김 (색은 그대로)
    putMarks(ev, mk, mk.list.filter(k => k.n!==n).map((k, i) => ({ ...k, n:i+1 }))); TG.sel[ev] = 0; },
  tgClear: async () => { const ev = UI.ev; if(!can.record(ev)) return denied();
    if(!(await ask('과녁판의 표시를 모두 지울까요?', '모두 지우기', true))) return false;
    putMarks(ev, marksOf(ev), []); TG.sel[ev] = 0; },
});

/* ---------- 수정 중 표시 끌어 옮기기 ---------- */
document.addEventListener('pointerdown', e => {
  const m = e.target.closest && e.target.closest('.tgtbox.edit .mk'); if(!m || e.button>0) return;
  const box = m.closest('.tgtbox'), ev = box.dataset.ev; if(!ev || !can.record(ev)) return;
  TG.pend = { m, box, ev, n:+m.dataset.n, x0:e.clientX, y0:e.clientY, id:e.pointerId, moved:false, x:0, y:0 };
  try{ m.setPointerCapture(e.pointerId); }catch(err){}
});
document.addEventListener('pointermove', e => {
  const P = TG.pend; if(!P) return;
  if(!P.moved){ if(Math.hypot(e.clientX-P.x0, e.clientY-P.y0) < 6) return; P.moved = true; TG.drag = true; P.m.classList.add('drag'); }
  e.preventDefault();
  const r = P.box.getBoundingClientRect();
  P.x = clamp01((e.clientX - r.left) / r.width); P.y = clamp01((e.clientY - r.top) / r.height);
  P.m.style.left = (P.x*100).toFixed(2) + '%'; P.m.style.top = (P.y*100).toFixed(2) + '%';
}, { passive:false });
function tgEnd(drop){
  const P = TG.pend; TG.pend = null; if(!P) return;
  if(!P.moved) return;
  TG.drag = false; TG.suppress = now(); P.m.classList.remove('drag');
  if(drop) moveMark(P.ev, P.n, P.x, P.y); else render();
  flushDeferred();
}
document.addEventListener('pointerup', () => tgEnd(true));
document.addEventListener('pointercancel', () => tgEnd(false));

/* ---------- 과녁 사진 올리기 (마스터): 가운데를 정사각형으로 잘라 720x720 이하 JPEG 로 줄여 data URL 로 저장 ---------- */
const TGT_MAX_CHARS = 340000;     // data URL 글자 수 (약 250KB)
function loadImage(file){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('사진을 열 수 없습니다.')); };
    img.src = url;
  });
}
async function tgtEncode(file){
  const img = await loadImage(file), w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const side = Math.min(w, h); if(!side) throw new Error('사진 크기를 알 수 없습니다.');
  let size = Math.min(720, side), q = 0.8, data = '';
  for(let tries = 0; tries < 12; tries++){
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    cv.getContext('2d').drawImage(img, (w-side)/2, (h-side)/2, side, side, 0, 0, size, size);
    data = cv.toDataURL('image/jpeg', q);
    if(data.length <= TGT_MAX_CHARS) break;
    if(q > 0.45) q = Math.round((q - 0.1)*100)/100; else size = Math.max(240, Math.round(size*0.85));
  }
  return data;
}
async function tgtSave(ev, file){
  if(!can.master()) return denied();
  try{
    const data = await tgtEncode(file);
    if(await put(['main','assets','target_'+ev], { data, at:now(), by:UI.me }, false)) toast('과녁 사진을 올렸습니다.');
  }catch(err){ console.error(err); toast('사진을 올리지 못했습니다. 다른 사진으로 다시 해 주세요.'); }
}
function tgtFileInput(){
  let el = document.getElementById('tgtFile');
  if(!el){
    el = document.createElement('input'); el.type = 'file'; el.accept = 'image/*'; el.id = 'tgtFile'; el.hidden = true;
    el.addEventListener('change', async () => { const f = el.files && el.files[0], ev = TG.upEv; el.value = ''; if(f && ev) await tgtSave(ev, f); });
    document.body.appendChild(el);
  }
  return el;
}
tgtFileInput();
Object.assign(ACT, {
  tgtUpload: (el, v) => { if(!can.master()) return denied(); TG.upEv = v; tgtFileInput().click(); return false; },
  tgtDel: async (el, v) => { if(!can.master()) return denied();
    if(!(await ask('과녁 사진을 지우고 기본 과녁으로 돌아갈까요?', '지우기', true))) return false;
    await guard(store.del(['main','assets','target_'+v])); return false; },
});
