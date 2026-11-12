'use strict';
/* ===================== 프로젝터 무대 =====================
   1600x900 고정 무대를 그린 뒤 화면 크기에 맞춰 확대·축소함 (프로젝터 창·진행자 미리보기 모두 같은 그림)
   맨 위: 현수막 띠(설정) · 가운데: 화면 · 위에 겹쳐: 방송 문구(크게 → 아래 띠)
   화면: banner 현수막 · intro 참여자 소개 · title 안내 화면 · question 문제 · answer 정답 · seats 좌석판 · score 순위 · award 시상식 · blank 끄기 */
const BELL = '<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M60 12c-4 0-7 3-7 7v3C37 26 28 40 28 57v22l-9 11v5h82v-5l-9-11V57c0-17-9-31-25-35v-3c0-4-3-7-7-7z" fill="currentColor"/><circle cx="60" cy="104" r="9" fill="currentColor"/></svg>';
const SVG_O = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" stroke-width="13"/></svg>';
const SVG_X = '<svg viewBox="0 0 100 100"><path d="M20 20L80 80M80 20L20 80" stroke="currentColor" stroke-width="14" stroke-linecap="round"/></svg>';
const TYPE_LABEL = { ox:'O / X', choice:'4지선다', short:'주관식' };
const MODE_LABEL = { banner:'현수막', intro:'참여자 소개', title:'안내 화면', question:'문제', answer:'정답 공개', seats:'좌석판', score:'점수 순위', award:'시상식', blank:'화면 꺼짐' };
const STRIP_H = { off:0, s:110, m:150, l:200 };
const BAND_H = 100;
const BI_COLORS = { white:'#ffffff', gold:'#f2c14e', navy:'#16244a', black:'#111111' };
const srvNow = () => DB ? DB.srvNow() : Date.now();
// 프로젝터 창에서 '정답은~' 소리가 나는 동안 정답을 숨겨 둠
const HOLD = { until:0, qi:-1 };
const holding = () => ROLE === 'screen' && Date.now() < HOLD.until;

const mmss = c => c >= 60 ? `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}` : String(c);
function remain(){ const t = S.live.timer; return t.running ? Math.max(0, (t.endAt - srvNow()) / 1000) : Math.max(0, t.remain); }
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

/* ---------- 현수막 (+ 후원사 로고·글) ---------- */
function bannerItemsHTML(edit){
  return (S.banner.items || []).map(it => {
    const sel = edit && BI.sel === it.id ? ' sel' : '';
    const pos = `left:${it.x}%;top:${it.y}%;`;
    if(it.type === 'img'){
      const src = S.logos[it.id]; if(!src) return edit ? `<div class="bi bi-img ed${sel}" data-bid="${it.id}" style="${pos}width:${it.w}%"><span class="bi-wait">로고 불러오는 중</span></div>` : '';
      return `<div class="bi bi-img${edit ? ' ed' : ''}${sel}" data-bid="${it.id}" style="${pos}width:${it.w}%"><img src="${src}" alt="" draggable="false"></div>`;
    }
    const col = BI_COLORS[it.color] || '#fff';
    return `<div class="bi bi-txt${edit ? ' ed' : ''}${sel}${it.font === 'disp' ? ' disp' : ''}${it.box ? ' box' : ''}" data-bid="${it.id}" style="${pos}font-size:${it.fs}px;color:${col};font-weight:${it.bold ? 700 : 500}">${esc(it.text || '글')}</div>`;
  }).join('');
}
function bannerHTML(edit){
  const b = S.banner, items = bannerItemsHTML(edit);
  if(S.bimg.img) return `<div class="st st-bimg"><div class="bg" style="background-image:url('${S.bimg.img}')"></div><img class="bimg" src="${S.bimg.img}" alt="${esc(title())}">${items}</div>`;
  return `<div class="st st-banner"><div class="bn-band t"></div><div class="bn-band b"></div>
    <div class="bn-bell">${BELL}</div><div class="bn-l1">${esc(b.l1)}</div><div class="bn-l2">${esc(b.l2)}</div>
    ${b.sub ? `<div class="bn-sub">${esc(b.sub)}</div>` : ''}${b.info ? `<div class="bn-info">${esc(b.info)}</div>` : ''}${items}</div>`;
}
function stripHTML(h){
  const logos = S.live.stripLogos ? (S.banner.items || []).filter(it => it.type === 'img' && S.logos[it.id]).slice(0, 6) : [];
  const half = Math.ceil(logos.length / 2), L = logos.slice(0, half), R = logos.slice(half);
  const lg = arr => arr.length ? `<span class="sl">${arr.map(it => `<img src="${S.logos[it.id]}" alt="" style="max-height:${Math.round(h * .62)}px">`).join('')}</span>` : '';
  if(S.bimg.img) return `<div class="strip" style="height:${h}px"><div class="bg" style="background-image:url('${S.bimg.img}')"></div><img class="bimg" src="${S.bimg.img}" alt="">${logos.length ? `<div class="strip-logos">${lg(L)}<span class="sp"></span>${lg(R)}</div>` : ''}</div>`;
  const fs = Math.round(h * 0.42), bs = `width:${Math.round(h * .5)}px;height:${Math.round(h * .5)}px`;
  return `<div class="strip txt" style="height:${h}px">${lg(L)}<span class="sb-bell" style="${bs}">${BELL}</span><span class="sb-t" style="font-size:${fs}px">${esc(S.banner.l1)} <em>${esc(S.banner.l2)}</em></span><span class="sb-bell" style="${bs}">${BELL}</span>${lg(R)}</div>`;
}

/* ---------- 문제 ---------- */
function qHeadHTML(q, i){
  const m = qMeta(i), parts = hasParts();
  const part = parts && q.kind === 'main' ? `<div class="st-part">${q.part}부</div>` : '';
  let num;
  if(q.kind === 'practice') num = `<div class="st-num kind">연습 문제</div>`;
  else if(q.kind === 'event') num = `<div class="st-num kind">이벤트 퀴즈</div>`;
  else if(q.kind === 'final') num = `<div class="st-num kind">결승 문제 <b>${m.n}</b></div>`;
  else num = `<div class="st-num">문제 <b>${m.n}</b><span>/ ${m.total}</span></div>`;
  return part + num;
}
function questionHTML(reveal){
  const q = curQ();
  if(!q) return `<div class="st st-empty">${QS_DENIED ? '이 기기는 진행자로 들어와야 문제를 볼 수 있습니다' : '등록된 문제가 없습니다'}</div>`;
  const L = S.live;
  const hold = reveal && holding();
  if(hold) reveal = false;
  const author = L.showAuthor && q.author ? `<div class="st-author">출제 <b>${esc(q.author)}</b></div>` : '';
  let ans = '';
  if(q.type === 'ox') ans = `<div class="st-ox">${['O','X'].map(k => `<div class="ox ox-${k} ${reveal ? (q.answer === k ? 'is-right' : 'is-dim') : ''}">${k === 'O' ? SVG_O : SVG_X}${reveal && q.answer === k ? '<span class="tag">정답</span>' : ''}</div>`).join('')}</div>`;
  else if(q.type === 'choice'){ const ch = q.choices || []; ans = `<div class="st-ch n${ch.length}" style="--n:${ch.length}">${ch.map((c, i) => `<div class="ch ${reveal ? (String(i + 1) === String(q.answer) ? 'is-right' : 'is-dim') : ''}"><span class="ch-n">${i + 1}</span><span class="ch-t">${esc(c)}</span></div>`).join('')}</div>`; }
  else if(reveal) ans = `<div class="st-short"><span>정답</span><b>${esc(q.answer || '—')}</b></div>`;
  const expl = reveal && q.expl ? `<div class="st-expl"><i>해설</i><span>${esc(q.expl)}</span></div>` : '';
  const dots = q.dots && cellsHTML(q.dots) ? `<div class="st-dots">${cellsHTML(q.dots)}</div>` : '';
  const side = L.showTimer && !reveal && !hold ? `<div class="st-side">${timerHTML()}</div>` : '';
  const pad = q.type === 'ox' && reveal ? 'style="padding-bottom:40px"' : '';
  const foot = stripOn() ? '' : `<div class="st-foot">${esc(title())}</div>`;
  const flag = hold ? '<div class="st-flag hold">정답은…</div>' : reveal ? '<div class="st-flag">정답 공개</div>' : '';
  return `<div class="st st-q ${q.kind !== 'main' ? 'k-' + q.kind : ''}">
    <div class="st-top">${qHeadHTML(q, Math.min(L.qi, S.qs.list.length - 1))}<div class="st-type">${TYPE_LABEL[q.type] || ''}</div>${flag}<div class="sp"></div>${author}</div>
    <div class="st-body"><div class="st-main" ${pad}><div class="fit" data-max="92" data-min="30"><span>${esc(q.text)}</span></div>${dots}${ans}${expl}</div>${side}</div>
    ${foot}</div>`;
}

/* ---------- 점수 순위 · 좌석판 ---------- */
function scoreHTML(availH){
  const rows = rankRows();
  if(!rows.length) return `<div class="st st-empty">명단을 넣으면 점수 순위가 나옵니다</div>`;
  const n = rows.length, cols = n <= 8 ? 1 : n <= 20 ? 2 : 3, per = Math.ceil(n / cols);
  const rowH = Math.min(90, (availH - 200) / per), fs = Math.max(18, Math.min(44, rowH * .5));
  const max = Math.max(1, ...rows.map(r => r.s));
  const done = mainDone();
  return `<div class="st"><div class="st-h">점수 순위 <small>${done ? `본문제 ${done}개까지` : ''}</small></div>
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
    const right = isMarked(markFor(q, p.id)) && !(S.live.mode === 'answer' && holding());
    cells += `<div class="sb-cell ${right ? 'is-right' : ''}"><b style="font-size:${nameFs}px">${esc(p.name)}</b><span style="font-size:${scFs}px">${sc[p.id] || 0}점</span></div>`;
  }
  const lbl = q ? (q.kind === 'main' ? `${qMeta(S.live.qi).n}번 문제` : q.kind === 'final' ? '결승 문제' : '이번 문제') : '';
  return `<div class="st"><div class="st-h">좌석판 <small>${q ? `금색 = ${lbl} 정답` : ''}</small></div><div class="sb-front">무 대</div>
    <div class="sb-grid" style="--cols:${cols}">${cells}</div></div>`;
}

/* ---------- 참여자 소개 · 안내 화면 · 시상식 ---------- */
function introHTML(){
  const list = introList();
  if(!list.length) return `<div class="st st-empty">명단을 넣으면 참여자를 한 분씩 소개할 수 있습니다</div>`;
  const i = Math.max(0, Math.min(list.length - 1, S.live.intro || 0)), it = list[i];
  return `<div class="st st-intro"><div class="in-top"><span>참여자 소개</span><b>${i + 1} / ${list.length}</b></div>
    <div class="fit in-name" data-max="240" data-min="80"><span>${esc(it.p.name)}</span></div>
    <div class="in-seat">${it.seat ? esc(seatLabel(it.seat)) : ''}</div></div>`;
}
function titleHTML(){
  const t = S.live.title || {};
  return `<div class="st st-title"><div class="bn-band t"></div><div class="bn-band b"></div><div class="tt-bell">${BELL}</div>
    <div class="fit tt" data-max="170" data-min="60"><span>${esc(t.text || '')}</span></div>${t.sub ? `<div class="tt-sub">${esc(t.sub)}</div>` : ''}</div>`;
}
function awardHTML(){
  const steps = awardSteps(), st = S.live.award || { i:0, show:false };
  const a = steps[st.i];
  if(!a) return `<div class="st st-title"><div class="tt-bell">${BELL}</div><div class="fit tt" data-max="150" data-min="60"><span>축하합니다</span></div></div>`;
  const head = `<div class="aw-rank">${esc(a.rankLabel)}</div><div class="aw-title">${esc(a.title)}</div>${a.prize ? `<div class="aw-prize">${esc(a.prize)}</div>` : ''}`;
  if(!st.show) return `<div class="st st-award"><div class="aw-glow"></div>${head}<div class="aw-q">?</div></div>`;
  const ppl = a.people;
  let body;
  if(!ppl.length) body = '<div class="aw-none">해당하는 사람이 없습니다</div>';
  else if(ppl.length <= 2) body = `<div class="aw-names">${ppl.map(r => `<div class="aw-name"><b>${esc(r.p.name)}</b><span>${r.s}점${r.seat ? ' · ' + esc(seatLabel(r.seat)) : ''}</span></div>`).join('')}</div>`;
  else {
    // 여러 명(5~10등 등): 사람 수에 맞춰 칸 수와 글자 크기를 줄여 한 화면에 들어가게
    const n = ppl.length, cols = n <= 6 ? 3 : n <= 12 ? 4 : 5, rows = Math.ceil(n / cols);
    const cellH = Math.min(96, Math.floor((900 - 330 - (rows - 1) * 14) / rows)), fs = Math.max(22, Math.min(54, Math.floor(cellH * .5)));
    body = `<div class="aw-grid" style="grid-template-columns:repeat(${cols},1fr);grid-auto-rows:${cellH}px;--fs:${fs}px">${ppl.map(r => `<div class="aw-cell"><i>${r.rank}등</i><b>${esc(r.p.name)}</b><span>${r.s}점</span></div>`).join('')}</div>`;
    return `<div class="st st-award show many"><div class="aw-glow"></div>${head}${body}</div>`;
  }
  return `<div class="st st-award show"><div class="aw-glow"></div>${head}${body}</div>`;
}

const stripOn = () => STRIP_H[S.live.strip] > 0;
function stageHTML(mode, opt){
  opt = opt || {};
  mode = mode || S.live.mode;
  if(mode === 'blank') return '<div class="st st-blank"></div>';
  const full = mode === 'banner' || mode === 'title' || mode === 'award' || mode === 'intro';
  const sh = full || opt.noStrip ? 0 : (STRIP_H[opt.strip || S.live.strip] || 0);
  const ph = opt.noAnn ? '' : annPhase();
  const bh = ph === 'band' ? BAND_H : 0;
  let body;
  if(mode === 'banner') body = bannerHTML(opt.edit);
  else if(mode === 'intro') body = introHTML();
  else if(mode === 'title') body = titleHTML();
  else if(mode === 'award') body = awardHTML();
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
function stageScale(wrap){ const w = wrap.clientWidth, h = wrap.clientHeight; return w && h ? Math.min(w / 1600, h / 900) : 0; }
function fitStage(wrap){
  const st = wrap.firstElementChild; if(!st) return; const w = wrap.clientWidth, h = wrap.clientHeight; if(!w || !h) return;
  const s = Math.min(w / 1600, h / 900); st.style.transform = `translate(${(w - 1600 * s) / 2}px,${(h - 900 * s) / 2}px) scale(${s})`;
  const sc = Number(S.live.scale) || 1;
  $$('.fit', st).forEach(el => {
    const inner = el.firstElementChild; if(!inner || !el.clientHeight) return;
    let hi = +el.dataset.max * (el.closest('.st-q') ? sc : 1), lo = +el.dataset.min, best = lo;
    for(let i = 0; i < 10; i++){ const mid = (hi + lo) / 2; inner.style.fontSize = mid + 'px'; if(inner.scrollHeight <= el.clientHeight + 1 && inner.scrollWidth <= el.clientWidth + 1){ best = mid; lo = mid; } else hi = mid; }
    inner.style.fontSize = Math.floor(best) + 'px';
  });
  $$('.ab-t', st).forEach(el => { const sp = el.firstElementChild; const run = sp.scrollWidth > el.clientWidth + 2; el.classList.toggle('run', run); if(run) sp.style.setProperty('--d', Math.max(8, sp.scrollWidth / 120) + 's'); });
  tickTimers();
}
const RO = ('ResizeObserver' in window) ? new ResizeObserver(es => es.forEach(e => fitStage(e.target))) : null;
function observeStages(){ $$('.stage-wrap').forEach(w => RO && RO.observe(w)); }
window.addEventListener('resize', () => $$('.stage-wrap').forEach(fitStage));
document.addEventListener('fullscreenchange', () => $$('.stage-wrap').forEach(fitStage));

/* ---------- 타이머 · 시간 끝 소리 · 방송 문구 시간 ---------- */
let lastCeil = null, lastAnn = '', lastAnnId = '';
function tickTimers(){
  const t = S.live.timer, r = remain(), c = Math.ceil(r), dur = Math.max(1, t.dur || 30);
  $$('.tm').forEach(el => {
    const num = el.querySelector('.tm-num'), fg = el.querySelector('.tm-fg'), lbl = el.querySelector('.tm-lbl');
    num.textContent = c <= 0 ? '땡!' : mmss(c);
    fg.setAttribute('stroke-dashoffset', String(Math.round(1000 * (1 - Math.min(1, r / dur)))));
    el.classList.toggle('warn', c <= 5 && c > 0); el.classList.toggle('done', c <= 0); el.classList.toggle('paused', !t.running && c > 0 && r < dur);
    el.classList.toggle('long', c >= 60);
    lbl.textContent = c <= 0 ? '정답을 들어 주세요' : (!t.running && r < dur ? '멈춤' : c >= 60 ? '남은 시간' : '초');
  });
  const ht = $('#hTimer'); if(ht){ ht.textContent = c <= 0 ? '끝' : mmss(c); ht.classList.toggle('warn', c <= 5); }
  const tb = $('#tToggleBtn'); if(tb) tb.textContent = t.running ? '멈춤' : (r < dur && r > 0 ? '계속' : '시작');
  const st = $('#sqTimer'); if(st){ st.textContent = S.live.showTimer || t.running ? (c <= 0 ? '시간 끝' : c + '초') : ''; st.classList.toggle('warn', c <= 5); }
  // 시간이 다 된 순간에만 소리 (가는 동안에는 소리 없음) — 프로젝터 화면에서만
  if(ROLE === 'screen' && t.running && lastCeil !== null && lastCeil > 0 && c <= 0) timeUpSound();
  lastCeil = t.running ? c : null;
  const ph = annPhase();
  if(ph !== lastAnn){ lastAnn = ph; schedule(); }
}
function timeUpSound(){
  const how = S.live.cfg.timeup || 'both';
  if(how === 'off') return;
  const hasFile = sfxHas('timeup');
  if(how === 'bell' || how === 'both' || !hasFile) SND.bell();
  if(hasFile && (how === 'file' || how === 'both')) setTimeout(() => sfxPlay('timeup'), how === 'both' ? 900 : 0);
}
setInterval(tickTimers, 200);
