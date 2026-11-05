'use strict';
/* ===================== 프로젝터 무대 =====================
   1600x900 고정 무대를 그린 뒤 화면 크기에 맞춰 확대·축소함 (프로젝터 창·진행자 미리보기 모두 같은 그림)
   맨 위: 현수막 띠(설정) · 가운데: 화면(현수막/문제/정답/좌석판/점수 순위/끄기) · 위에 겹쳐: 방송 문구(크게 → 아래 띠) */
const BELL = '<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M60 12c-4 0-7 3-7 7v3C37 26 28 40 28 57v22l-9 11v5h82v-5l-9-11V57c0-17-9-31-25-35v-3c0-4-3-7-7-7z" fill="currentColor"/><circle cx="60" cy="104" r="9" fill="currentColor"/></svg>';
const SVG_O = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" stroke-width="13"/></svg>';
const SVG_X = '<svg viewBox="0 0 100 100"><path d="M20 20L80 80M80 20L20 80" stroke="currentColor" stroke-width="14" stroke-linecap="round"/></svg>';
const TYPE_LABEL = { ox:'O / X', choice:'객관식', short:'주관식' };
const MODE_LABEL = { banner:'현수막', question:'문제', answer:'정답 공개', seats:'좌석판', score:'점수 순위', blank:'화면 꺼짐' };
const STRIP_H = { off:0, s:110, m:150, l:200 };
const BAND_H = 100;
const srvNow = () => DB ? DB.srvNow() : Date.now();

function remain(){ const t = S.live.timer; return t.running ? Math.max(0, (t.endAt - srvNow()) / 1000) : Math.max(0, t.remain); }
// 방송 문구가 지금 어떻게 보이는가: 'full'(크게) · 'band'(아래 띠) · ''(없음)
function annPhase(){
  const a = S.live.ann; if(!a || !a.text) return '';
  if(a.style === 'full' && (!a.secs || srvNow() - (a.at || 0) < a.secs * 1000)) return 'full';
  return 'band';
}

function cellsHTML(spec){
  return String(spec || '').split(/[\s\/,+]+/).filter(t => /^[1-6]+$/.test(t)).map(t =>
    `<span class="bcell" role="img" aria-label="${t.split('').join(', ')}점">${[1,4,2,5,3,6].map(d => `<i class="${t.includes(String(d)) ? 'on' : ''}">${d}</i>`).join('')}</span>`).join('');
}
function timerHTML(){
  return `<div class="tm"><svg viewBox="0 0 270 270"><circle class="tm-bg" cx="135" cy="135" r="118"/><circle class="tm-fg" cx="135" cy="135" r="118" pathLength="1000" stroke-dasharray="1000" stroke-dashoffset="0" transform="rotate(-90 135 135)"/></svg><div class="tm-num">${Math.ceil(remain())}</div><div class="tm-lbl">초</div></div>`;
}
const title = () => S.banner.l1 + ' ' + S.banner.l2;
function bannerHTML(){
  const b = S.banner;
  if(S.bimg.img) return `<div class="st st-bimg"><div class="bg" style="background-image:url('${S.bimg.img}')"></div><img src="${S.bimg.img}" alt="${esc(title())}"></div>`;
  return `<div class="st st-banner"><div class="bn-band t"></div><div class="bn-band b"></div>
    <div class="bn-bell">${BELL}</div><div class="bn-l1">${esc(b.l1)}</div><div class="bn-l2">${esc(b.l2)}</div>
    ${b.sub ? `<div class="bn-sub">${esc(b.sub)}</div>` : ''}${b.info ? `<div class="bn-info">${esc(b.info)}</div>` : ''}</div>`;
}
function stripHTML(h){
  if(S.bimg.img) return `<div class="strip" style="height:${h}px"><div class="bg" style="background-image:url('${S.bimg.img}')"></div><img src="${S.bimg.img}" alt=""></div>`;
  const fs = Math.round(h * 0.42);
  return `<div class="strip txt" style="height:${h}px"><span class="sb-bell" style="width:${Math.round(h * .5)}px;height:${Math.round(h * .5)}px">${BELL}</span><span class="sb-t" style="font-size:${fs}px">${esc(S.banner.l1)} <em>${esc(S.banner.l2)}</em></span><span class="sb-bell" style="width:${Math.round(h * .5)}px;height:${Math.round(h * .5)}px">${BELL}</span></div>`;
}
function questionHTML(reveal){
  const q = curQ();
  if(!q) return `<div class="st st-empty">${QS_DENIED ? '이 기기는 진행자로 들어와야 문제를 볼 수 있습니다' : '등록된 문제가 없습니다'}</div>`;
  const L = S.live, n = Math.min(L.qi, S.qs.list.length - 1) + 1, total = S.qs.list.length;
  const author = L.showAuthor && q.author ? `<div class="st-author">출제 <b>${esc(q.author)}</b></div>` : '';
  let ans = '';
  if(q.type === 'ox') ans = `<div class="st-ox">${['O','X'].map(k => `<div class="ox ox-${k} ${reveal ? (q.answer === k ? 'is-right' : 'is-dim') : ''}">${k === 'O' ? SVG_O : SVG_X}${reveal && q.answer === k ? '<span class="tag">정답</span>' : ''}</div>`).join('')}</div>`;
  else if(q.type === 'choice'){ const ch = q.choices || []; ans = `<div class="st-ch n${ch.length}" style="--n:${ch.length}">${ch.map((c, i) => `<div class="ch ${reveal ? (String(i + 1) === String(q.answer) ? 'is-right' : 'is-dim') : ''}"><span class="ch-n">${i + 1}</span><span class="ch-t">${esc(c)}</span></div>`).join('')}</div>`; }
  else if(reveal) ans = `<div class="st-short"><span>정답</span><b>${esc(q.answer || '—')}</b></div>`;
  const expl = reveal && q.expl ? `<div class="st-expl"><i>해설</i><span>${esc(q.expl)}</span></div>` : '';
  const dots = q.dots && cellsHTML(q.dots) ? `<div class="st-dots">${cellsHTML(q.dots)}</div>` : '';
  const side = L.showTimer ? `<div class="st-side">${timerHTML()}</div>` : '';
  const pad = q.type === 'ox' && reveal ? 'style="padding-bottom:40px"' : '';
  const foot = stripOn() ? '' : `<div class="st-foot">${esc(title())}</div>`;
  return `<div class="st st-q">
    <div class="st-top"><div class="st-num">문제 <b>${n}</b><span>/ ${total}</span></div><div class="st-type">${TYPE_LABEL[q.type] || ''}</div>${reveal ? '<div class="st-flag">정답 공개</div>' : ''}<div class="sp"></div>${author}</div>
    <div class="st-body"><div class="st-main" ${pad}><div class="fit" data-max="92" data-min="30"><span>${esc(q.text)}</span></div>${dots}${ans}${expl}</div>${side}</div>
    ${foot}</div>`;
}
function scoreHTML(availH){
  const rows = rankRows();
  if(!rows.length) return `<div class="st st-empty">명단을 넣으면 점수 순위가 나옵니다</div>`;
  const n = rows.length, cols = n <= 8 ? 1 : n <= 20 ? 2 : 3, per = Math.ceil(n / cols);
  const rowH = Math.min(90, (availH - 200) / per), fs = Math.max(18, Math.min(44, rowH * .5));
  const max = Math.max(1, ...rows.map(r => r.s));
  const done = S.qs.list.length ? Math.min(S.live.qi + 1, S.qs.list.length) : 0;
  return `<div class="st"><div class="st-h">점수 순위 <small>${done ? done + '번 문제까지' : ''}</small></div>
    <div class="rk-list" style="grid-template-rows:repeat(${per},${rowH}px);font-size:${fs}px">${rows.map(r => `<div class="rk ${r.rank <= 3 && r.s > 0 ? 'top' : ''}"><span class="rk-n">${r.rank}</span><span class="rk-name">${esc(r.p.name)}</span><span class="rk-seat">${r.seat ? esc(seatLabel(r.seat)) : ''}</span><span class="rk-bar"><i style="width:${r.s / max * 100}%"></i></span><span class="rk-s">${r.s}</span></div>`).join('')}</div></div>`;
}
function seatBoardHTML(){
  const { rows, cols, map } = S.seats, pm = peopleMap(), sc = scores(), q = curQ();
  if(!S.seats.people.length) return `<div class="st st-empty">명단을 넣고 좌석을 배치하면 좌석판이 나옵니다</div>`;
  const nameFs = cols > 8 ? 30 : cols > 6 ? 36 : 46, scFs = cols > 8 ? 26 : 34;
  let cells = '';
  for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++){
    const p = pm[map[r + '-' + c]];
    if(!p){ cells += `<div class="sb-cell empty"></div>`; continue; }
    cells += `<div class="sb-cell ${isMarked(markFor(q, p.id)) ? 'is-right' : ''}"><b style="font-size:${nameFs}px">${esc(p.name)}</b><span style="font-size:${scFs}px">${sc[p.id] || 0}점</span></div>`;
  }
  return `<div class="st"><div class="st-h">좌석판 <small>${q ? `금색 = ${Math.min(S.live.qi + 1, S.qs.list.length)}번 문제 정답` : ''}</small></div><div class="sb-front">무 대</div>
    <div class="sb-grid" style="--cols:${cols}">${cells}</div></div>`;
}
const stripOn = () => STRIP_H[S.live.strip] > 0;
function stageHTML(mode, opt){
  opt = opt || {};
  mode = mode || S.live.mode;
  if(mode === 'blank') return '<div class="st st-blank"></div>';
  const full = mode === 'banner';
  const sh = full || opt.noStrip ? 0 : (STRIP_H[opt.strip || S.live.strip] || 0);
  const ph = opt.noAnn ? '' : annPhase();
  const bh = ph === 'band' ? BAND_H : 0;
  let body;
  if(full) body = bannerHTML();
  else if(mode === 'score') body = scoreHTML(900 - sh - bh);
  else if(mode === 'seats') body = seatBoardHTML();
  else body = questionHTML(mode === 'answer');
  let h = sh ? stripHTML(sh) : '';
  h += `<div class="stmain" style="top:${sh}px;bottom:${bh}px">${body}</div>`;
  if(ph === 'band') h += `<div class="ann-band"><span class="ab-tag">안내</span><div class="ab-t"><span>${esc(S.live.ann.text)}</span></div></div>`;
  if(ph === 'full') h += `<div class="ann-full" style="top:${sh}px"><div class="af-box"><div class="af-tag">안내 말씀</div><div class="fit" data-max="120" data-min="40"><span>${esc(S.live.ann.text)}</span></div></div></div>`;
  return h;
}
const stageCache = new WeakMap();
function paintStage(wrap, mode, opt){
  if(!wrap) return;
  const html = `<div class="stage">${stageHTML(mode, opt)}</div>`;
  if(stageCache.get(wrap) === html){ fitStage(wrap); return; }
  stageCache.set(wrap, html); wrap.innerHTML = html; fitStage(wrap);
}
function fitStage(wrap){
  const st = wrap.firstElementChild; if(!st) return; const w = wrap.clientWidth, h = wrap.clientHeight; if(!w || !h) return;
  const s = Math.min(w / 1600, h / 900); st.style.transform = `translate(${(w - 1600 * s) / 2}px,${(h - 900 * s) / 2}px) scale(${s})`;
  const sc = Number(S.live.scale) || 1;
  $$('.fit', st).forEach(el => {
    const inner = el.firstElementChild; if(!inner || !el.clientHeight) return;
    let hi = +el.dataset.max * sc, lo = +el.dataset.min, best = lo;
    for(let i = 0; i < 10; i++){ const mid = (hi + lo) / 2; inner.style.fontSize = mid + 'px'; if(inner.scrollHeight <= el.clientHeight + 1 && inner.scrollWidth <= el.clientWidth + 1){ best = mid; lo = mid; } else hi = mid; }
    inner.style.fontSize = Math.floor(best) + 'px';
  });
  // 아래 띠 글이 길면 옆으로 흐르게 함
  $$('.ab-t', st).forEach(el => { const sp = el.firstElementChild; el.classList.toggle('run', sp.scrollWidth > el.clientWidth + 2); if(sp.scrollWidth > el.clientWidth + 2) sp.style.setProperty('--d', Math.max(8, sp.scrollWidth / 120) + 's'); });
  tickTimers();
}
const RO = ('ResizeObserver' in window) ? new ResizeObserver(es => es.forEach(e => fitStage(e.target))) : null;
function observeStages(){ $$('.stage-wrap').forEach(w => RO && RO.observe(w)); }
window.addEventListener('resize', () => $$('.stage-wrap').forEach(fitStage));
document.addEventListener('fullscreenchange', () => $$('.stage-wrap').forEach(fitStage));

/* 타이머 표시 · '땡' · 방송 문구 시간 */
let lastCeil = null, lastAnn = '', lastAnnId = '';
function tickTimers(){
  const t = S.live.timer, r = remain(), c = Math.ceil(r), dur = Math.max(1, t.dur || 30);
  $$('.tm').forEach(el => {
    const num = el.querySelector('.tm-num'), fg = el.querySelector('.tm-fg'), lbl = el.querySelector('.tm-lbl');
    num.textContent = c <= 0 ? '땡!' : c;
    fg.setAttribute('stroke-dashoffset', String(Math.round(1000 * (1 - Math.min(1, r / dur)))));
    el.classList.toggle('warn', c <= 5 && c > 0); el.classList.toggle('done', c <= 0); el.classList.toggle('paused', !t.running && c > 0 && r < dur);
    lbl.textContent = c <= 0 ? '시간 종료' : (!t.running && r < dur ? '멈춤' : '초');
  });
  const ht = $('#hTimer'); if(ht){ ht.textContent = c <= 0 ? '끝' : c; ht.classList.toggle('warn', c <= 5); }
  const tb = $('#tToggleBtn'); if(tb) tb.textContent = t.running ? '멈춤' : (r < dur && r > 0 ? '계속' : '시작');
  const st = $('#sqTimer'); if(st){ st.textContent = S.live.showTimer || t.running ? (c <= 0 ? '시간 끝' : c + '초') : ''; st.classList.toggle('warn', c <= 5); }
  // 시간이 다 된 순간에만 '땡!' (가는 동안에는 소리 없음) — 프로젝터 화면에서만
  if(ROLE === 'screen' && S.live.sound && t.running && lastCeil !== null && lastCeil > 0 && c <= 0) SND.bell();
  lastCeil = t.running ? c : null;
  // 방송 문구: 크게 → 띠로 바뀌는 순간 다시 그림
  const ph = annPhase();
  if(ph !== lastAnn){ lastAnn = ph; schedule(); }
}
setInterval(tickTimers, 200);
