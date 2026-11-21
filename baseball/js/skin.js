'use strict';
/* ===================== 화면 보며 하기(비장애인 모드) 화면 =====================
   경기 계산과 화면 정의(UI.S = 질문 + 번호 선택지)는 소리와 글로 하기와 똑같이 쓰고, 그리는 방법만 다름.
   - 선택지를 누르면 choose(번호)를 불러서 두 방식이 같은 길로 진행함 (숫자 키도 그대로 됨)
   - 정밀 모드 수비는 구종·코스·붙이는 정도·세기를 한 화면에서 고르고 '던지기'로 같은 선택(GS.sel → fillPitch → submit)을 만듦
   - 정밀 모드 공격은 큰 단추로 치는 방법을 고름. 설정의 '타이밍 맞춰 치기'를 켜면 공이 들어오는 순간에 한 번 더 누름(혼자·둘이 하기만)
   - 모든 화면은 스크롤 없이 한 화면에 들어감(skFit): 넘치면 설명을 줄이고, 칸을 좁히고, 열을 늘림. 긴 표·글 목록은 쪽 넘기기(◀ ▶)
   - 경기 화면: 도트 그림판 위에 점수판·투수·타자 상자(게임 중계처럼), 아래 결과 한 줄과 조작판. 가로 화면은 그림 왼쪽, 조작판 오른쪽 */
const SK = { el:null, pc:null, tm:null, sheet:null, sheetMake:null, pgKey:'', pgi:0 };

const SK_ICON = {
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',
  next1:'<path d="M9 5l7 7-7 7"/>',
  fs:'<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  fsx:'<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/>',
  swing:'<path d="M4 20 15.5 8.5a2.4 2.4 0 0 1 3.4 3.4L7.5 23"/><circle cx="18" cy="5" r="2"/>',
  power:'<path d="M13 2 5 13h6l-1 9 8-11h-6z"/>',
  contact:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>',
  take:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  bunt:'<path d="M3 15h18M8 15v4M16 15v4"/><circle cx="12" cy="9" r="3"/>',
  run:'<circle cx="14" cy="4.5" r="2"/><path d="M9 21l3-6 3 2v5M6 12l3-4 4 1 3 4 3 1M12 15l-1-6"/>',
  target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  ball:'<circle cx="12" cy="12" r="8.5"/><path d="M7 5.5c2 2 2.8 4 2.8 6.5S9 16.5 7 18.5M17 5.5c-2 2-2.8 4-2.8 6.5s.8 4.5 2.8 6.5"/>',
  sign:'<path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 9.5a1.5 1.5 0 0 1 3 0V15c0 4-2.5 6-6 6s-5-1.5-6.5-4L4 13a1.5 1.5 0 0 1 2.5-1.5L7 12"/>',
  field:'<path d="M12 21 3 12l9-9 9 9z"/><circle cx="12" cy="12" r="1.5"/>',
  flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v6M12 7.5v.01"/>',
  repeat:'<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>',
  chat:'<path d="M4 5h16v11H9l-5 4z"/>',
  play:'<path d="M7 4.5v15l12-7.5z"/>',
  pause:'<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>',
  next:'<path d="M5 5v14l9-7zM16 5h3v14h-3z"/>',
  check:'<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
  swap:'<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
  list:'<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  home:'<path d="M4 11 12 4l8 7M6 9.5V20h12V9.5"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
};
const skIco = (k, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SK_ICON[k] || ''}</svg>`;
const grade = v => v >= 80 ? 'A' : v >= 65 ? 'B' : v >= 45 ? 'C' : v >= 32 ? 'D' : 'E';
// 팀 엠블럼: img/emblems.png(5칸 × 2줄, TEAMS 순서). 없는 팀이면 팀 색 동그라미에 첫 글자
function emb(T, cls = ''){
  const ctr = T.key === 'center' || (typeof CENTER !== 'undefined' && CENTER && T.short === CENTER.short);
  if(ctr && CENTER && CENTER.embImg) return `<span class="emb pic ${cls}" style="--tc:${T.color};background-image:url(${CENTER.embImg})" aria-hidden="true"></span>`;   // 사용자가 넣은 엠블럼 사진
  const i = ctr ? (CENTER && CENTER.emblem != null ? CENTER.emblem : -1) : typeof TEAMS !== 'undefined' ? TEAMS.findIndex(x => x.key === T.key || x.short === T.short) : -1;
  if(i >= 0 && i < 10) return `<span class="emb img ${cls}" style="--tc:${T.color};background-position:${(i % 5) * 25}% ${Math.floor(i / 5) * 100}%" aria-hidden="true"></span>`;
  return `<span class="emb ${cls}" style="--tc:${T.color}" aria-hidden="true">${esc(T.short[0])}</span>`;
}
// 화면 보며 하기에서는 키보드·명령 칸 안내 문장을 빼고 보여 줌 (소리와 글로 하기 화면 정의는 그대로)
const KEY_HINT = /점\(\.\)|\d번은 다음|번 키|숫자 키|\d+번째 탭|탭 \d+개 중|위 글을 한 줄씩|\d번을 누르세요/;
const skClean = q => String(q || '').replace(/명령 칸에 적고 입력을/g, '아래 칸에 적고 확인을').split(/(?<=[.?!])\s+/).filter(x => x && !KEY_HINT.test(x)).join(' ');
// 질문을 '공격·수비 띠 + 가장 중요한 질문 + 나머지 설명'으로 나눔
function skQ(q){
  const qs = skClean(q).split(/(?<=[.?!])\s+/).filter(Boolean);
  if(qs.length < 2) return { chip:'', main: qs[0] || '', sub:'' };
  const f = qs[0].replace(/\.$/, ''), side = /수비/.test(f) ? 'def' : /공격/.test(f) ? 'off' : '';
  if(side || f.length <= 14) return { chip: f, side, main: qs[qs.length - 1], sub: qs.slice(1, -1).join(' ') };
  return { chip:'', main: qs[qs.length - 1], sub: qs.slice(0, -1).join(' ') };
}
const isGame = S => !!(S && S.board && typeof G !== 'undefined' && G);

/* ---------- 틀 ---------- */
function skinInit(){
  if(SK.el) return;
  const el = document.createElement('div'); el.id = 'sk';
  el.innerHTML = '<div class="sk-top" id="skTop"></div><div class="sk-stage" id="skStage" hidden></div><div class="sk-tick" id="skTick" hidden></div><main class="sk-body" id="skBody"></main>';
  document.body.insertBefore(el, $('#dlg'));
  const sh = document.createElement('div'); sh.id = 'skSheet'; sh.hidden = true; document.body.insertBefore(sh, $('#dlg'));
  SK.el = el;
  document.addEventListener('click', skinClick);
  document.addEventListener('input', e => { if(e.target && e.target.id === 'skPow' && SK.pc){ SK.pc.w = Number(e.target.value); skinBody(); } });
  document.addEventListener('submit', e => {
    if(!e.target || e.target.id !== 'skForm') return;
    e.preventDefault(); const inp = $('#skIn'), v = inp ? inp.value : ''; if(inp) inp.value = ''; textCmd(v);
  });
  document.addEventListener('keydown', e => {
    // 창(메모·점수표)이 열려 있으면 Esc·점·백스페이스는 창만 닫음
    if(SK.sheet && !SK.tm && ['Escape', '.', 'Backspace', 'Decimal'].includes(e.key) && !(e.target && e.target.closest && e.target.closest('input, textarea'))){ e.preventDefault(); e.stopPropagation(); skinSheetClose(); return; }
    if(!SK.tm) return;
    if(e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); e.stopPropagation(); timingTap(); }
    else if(/^[0-9.]$/.test(e.key) || e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); }   // 타이밍을 재는 동안 다른 키는 받지 않음
  }, true);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if(VIEW.gfx) skFit(); });
  // 화면 크기가 바뀌면 다시 맞춤
  let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if(VIEW.gfx) skFit(); }, 80); });
}
function skinRender(S){
  skinInit();
  const root = document.documentElement, game = isGame(S);
  root.classList.toggle('sk-game', game);
  root.classList.toggle('sk-menu', !game);
  root.classList.toggle('sk-scene', !game && !!S.scene);
  root.classList.toggle('sk-hero', !game && !!S.hero);
  const st = $('#skStage');
  if(typeof GX !== 'undefined'){
    GX.hud = true;
    if(game){ SK.pre = GX.lastSnap; st.hidden = false; GX.host = st; gfxRender(G, UI.lastFx || [], UI.lastLines || [], UI.lastEv || []); UI.lastFx = []; UI.lastLines = []; UI.lastEv = []; }
    else if(S.scene){ st.hidden = false; GX.host = st; gfxScene(st, S.scene); }
    else { st.hidden = true; GX.scene = null; }
  }
  let ov = $('#skOv'); if(!ov){ ov = document.createElement('div'); ov.id = 'skOv'; ov.className = 'sk-ov'; } if(ov.parentNode !== st) st.appendChild(ov);
  // 결과를 보여 주기 전(뜸 들이는 동안)에는 점수판을 공을 던지기 전 상태로 (아웃·점수가 미리 바뀌지 않게)
  const hold = game && root.classList.contains('hold') && SK.pre && SK.pre.at === G.at;
  ov.innerHTML = game ? skOvHTML(S, hold) : '';
  if(game) playBallFlash();
  $('#skTop').innerHTML = game ? '' : topHTML(S);
  $('#skTop').hidden = game;
  const tk = $('#skTick'); tk.hidden = !game; tk.innerHTML = game ? tickHTML(S) : '';
  skinBody();
  // 다른 화면으로 가면 열어 둔 창(메모·점수표)은 닫음
  if(SK.sheet && (SK.sheetMake !== UI.make || (SK.sheet === 'note' && !UI.note))) skinSheetClose(true);
}
function skinBody(){
  const S = UI.S; if(!S || !SK.el) return;
  const game = isGame(S);
  const key = String(UI.make && UI.make.name) + '|' + skClean(S.q) + '|' + (S.ti ?? '');
  if(key !== SK.pgKey){ SK.pgKey = key; SK.pgi = S.kind === 'log' ? 1e9 : 0; }
  const body = $('#skBody');
  body.className = 'sk-body ' + (game ? 'deck' + (S.kind ? ' k-' + S.kind : '') + (S.sub ? ' sub' : '') : 'menu' + (S.kind ? ' k-' + S.kind : ''));
  body.innerHTML = game ? deckHTML(S) : menuHTML(S);
  if(SK.tm && SK.tm.pad && !SK.tm.done) body.appendChild(SK.tm.pad);   // 타이밍을 재는 중에 다시 그려도 스윙 단추는 그대로
  skFit(); requestAnimationFrame(() => skFit());   // 그림판·글꼴 크기가 자리 잡은 뒤 한 번 더 맞춤
  if(!game && (S.focusCmd || (S.onText && !S.input)) && !('ontouchstart' in window)) setTimeout(() => { const i = $('#skIn'); if(i) i.focus(); }, 30);
}

/* ---------- 한 화면에 맞추기 ----------
   조작판·메뉴가 넘치면 단계(f1 설명 줄이기 → f2 칸 좁히기 → f3 열 늘리기·더 작게)를 차례로 붙이고,
   쪽 넘기기 상자(.pg)는 남은 높이에 들어가는 줄만 보여 줌 */
function skFit(){
  const body = $('#skBody'); if(!body || !VIEW.gfx) return;
  // 넘침: 본문이 넘치거나, 칸 안의 글이 잘림
  const over = () => body.scrollHeight > body.clientHeight + 1 || [...body.querySelectorAll('.tile, .bt, .card, .gc')].some(e => e.scrollHeight > e.clientHeight + 8);   // 안쪽 여백만큼 겹치는 것은 괜찮음
  ['f1', 'f2', 'f3'].forEach(c => body.classList.remove(c));
  body.classList.add('fitting');   // 쪽 넘기기 상자는 잠깐 가장 작게 (다른 것들이 들어가는지 먼저 봄)
  for(const c of ['f1', 'f2', 'f3']){ if(!over()) break; body.classList.add(c); }
  body.classList.remove('fitting');
  body.querySelectorAll('.pg').forEach(paginate);
  body.classList.toggle('scroll', over());   // 그래도 넘치면(아주 작은 화면) 마지막 수단으로 스크롤
}
function paginate(pg){
  const rows = [...pg.querySelectorAll('.pg-r')], nav = pg.querySelector('.pg-nav');
  rows.forEach(r => { r.hidden = false; }); if(nav) nav.hidden = true;
  if(!rows.length) return;
  const top = pg.getBoundingClientRect().top, H = pg.clientHeight;
  const last = rows[rows.length - 1].getBoundingClientRect();
  if(last.bottom - top <= H + 1){ SK.pgn = 1; return; }
  if(nav) nav.hidden = false;
  const avail = H - (nav ? nav.offsetHeight + 6 : 0), head = rows[0].getBoundingClientRect().top - top;
  const pages = []; let start = 0, base = rows[0].getBoundingClientRect().top;
  rows.forEach((r, i) => { const b = r.getBoundingClientRect(); if(i > start && b.bottom - base + head > avail){ pages.push([start, i]); start = i; base = b.top; } });
  pages.push([start, rows.length]);
  const p = clamp(SK.pgi, 0, pages.length - 1); SK.pgi = p; SK.pgn = pages.length;
  rows.forEach((r, i) => { r.hidden = i < pages[p][0] || i >= pages[p][1]; });
  if(nav) nav.querySelector('.pg-no').textContent = `${p + 1} / ${pages.length}`;
  if(nav){ nav.querySelector('[data-d="-1"]').disabled = p === 0; nav.querySelector('[data-d="1"]').disabled = p === pages.length - 1; }
}
const pgNav = () => `<div class="pg-nav" hidden><button type="button" class="pg-b" data-sk="pg" data-d="-1" aria-label="앞 쪽">${skIco('back')}</button><span class="pg-no"></span><button type="button" class="pg-b" data-sk="pg" data-d="1" aria-label="다음 쪽">${skIco('next1')}</button></div>`;
// 표: [{ title, cols, rows:[{ cells, team }], hiTeam, foot }]
function tableHTML(tabs){
  const out = [];
  tabs.forEach(t => {
    if(t.title && tabs.length > 1) out.push(`<tr class="pg-r sec"><th colspan="${t.cols.length}">${esc(t.title)}</th></tr>`);
    out.push(`<tr class="pg-r hd">${t.cols.map((c, i) => `<th class="c${i}">${esc(c)}</th>`).join('')}</tr>`);
    t.rows.forEach(r => {
      const T = r.team && typeof teamInfo === 'function' ? teamInfo(r.team) : null;
      out.push(`<tr class="pg-r${T && r.team === t.hiTeam ? ' mine' : ''}">${r.cells.map((c, i) => `<td class="c${i}">${i === 1 && T ? emb(T, 'sm') : ''}${esc(c)}</td>`).join('')}</tr>`);
    });
    if(t.foot) out.push(`<tr class="pg-r ft"><td colspan="${t.cols.length}">${esc(t.foot)}</td></tr>`);
  });
  return `<div class="pg panel tbl"><table class="st">${out.join('')}</table>${pgNav()}</div>`;
}
// 글 목록(쪽 넘기기)
function listHTML(lines, cls = ''){
  return `<div class="pg panel lst ${cls}"><div class="lst-in">${lines.map(l => { const s = l.s || l; return `<p class="pg-r${l.k ? ' k-' + l.k : ''}${/^\S+\.$/.test(s) && s.length < 10 ? ' sec' : ''}">${esc(s)}</p>`; }).join('')}</div>${pgNav()}</div>`;
}

/* ---------- 경기 화면: 그림 위 점수판·선수 상자 ---------- */
// 결과가 나오면(뜸 들이기 끝) 점수판만 지금 상태로 다시 그림
function skinHudRefresh(){
  const ov = $('#skOv'); if(!ov || !VIEW.gfx || !G || !isGame(UI.S)) return;
  ov.innerHTML = skOvHTML(UI.S, false);
}
// 그림 위 점수판·선수 상자·경기 끝 카드·날씨 아이콘. 명장면 다시 보기(highlights.js)는 그 장면의 점수판만
function skOvHTML(S, hold){
  const hl = typeof hlView === 'function' ? hlView(S) : null, X = hl || (hold ? SK.pre : G);
  return hudHTML(X) + (hl ? '' : plateHTML() + (G.over && !hold ? finalCardHTML() : '')) + (typeof wxHudHTML === 'function' ? wxHudHTML(X) : '');
}
function hudHTML(X = G){
  const [A, H] = X.teams, b = X.bases;
  const lamp = (n, max, c) => Array.from({ length:max }, (_, i) => `<i class="${i < n ? 'on ' + c : ''}"></i>`).join('');
  const tm = (T, i) => `<span class="sb-t${!X.over && (i === 0) === X.top ? ' bat' : ''}">${emb(T)}<b>${runsOf(T)}</b></span>`;
  const base = (x, y, on) => `<rect x="${x - 5.5}" y="${y - 5.5}" width="11" height="11" transform="rotate(45 ${x} ${y})" class="${on ? 'on' : ''}"/>`;
  return `<div class="sb"><button type="button" class="sb-main" data-sk="box" aria-label="점수표 보기">
      ${tm(A, 0)}<span class="sb-inn">${X.over ? '끝' : `${X.inning}<small>${X.top ? '▲' : '▼'}</small>`}</span>${tm(H, 1)}
      <svg class="sb-dia" viewBox="0 0 44 34" aria-hidden="true">${base(32, 18, b[0] != null)}${base(22, 8, b[1] != null)}${base(12, 18, b[2] != null)}</svg>
      <span class="sb-cnt"><span><em>B</em>${lamp(X.balls, 3, 'g')}</span><span><em>S</em>${lamp(X.strikes, 2, 'y')}</span><span><em>O</em>${lamp(X.outs, 2, 'r')}</span></span>
    </button>${typeof NET !== 'undefined' && NET.on ? `<button type="button" class="sb-btn" data-sk="talk" aria-label="채팅과 음성 대화">${skIco('chat')}</button>` : ''}<button type="button" class="sb-btn" data-sk="menu" aria-label="메뉴">${skIco('menu')}</button></div>`;
}
// 투수 상자(왼쪽 위)·타자 상자(오른쪽 아래). 누르면 능력치와 공 자취
function plateHTML(){
  if(!G || G.over || G.pre) return '';
  const B = curBatter(G), P = curPitcher(G), bi = batIdx(G), fi = 1 - bi, s = B.st;
  const left = Math.round(clamp(1 - P.load / P.sta, 0, 1) * 100), col = left > 60 ? 'g' : left > 30 ? 'y' : 'r';
  const ownB = ownTeam(bi);
  return `<button type="button" class="np np-p" data-sk="stats" aria-label="투수 ${esc(P.name)} 능력치 보기">${emb(G.teams[fi], 'sm')}<span class="np-tx"><small>투수 · ${P.hand === 'L' ? '좌' : '우'} · ${P.n}구</small><b>${esc(P.name)}${P.nick ? ` <i class="nick">${esc(P.nick)}</i>` : ''}</b><span class="sta ${col}"><i style="width:${Math.max(4, left)}%"></i></span></span></button>
    <button type="button" class="np np-b" data-sk="stats" aria-label="타자 ${esc(B.name)} 능력치 보기">${emb(G.teams[bi], 'sm')}<span class="np-tx"><small>${batTeam(G).bi + 1}번 · ${B.hand === 'L' ? '좌타' : '우타'}${B.cond && (ownB || B.seen) ? ` <em class="${B.cond > 0 ? 'up' : 'dn'}">${B.cond > 0 ? '▲' : '▼'}</em>` : ''}</small><b>${esc(B.name)}${B.nick ? ` <i class="nick">${esc(B.nick)}</i>` : ''}</b><span class="np-st">${s.ab}타수 ${s.h}안타${s.hr ? ` · ${s.hr}홈런` : ''}</span></span></button>`;
}
// 결과 한 줄: 뜸 들이는 동안은 앞부분(투구 설명)만
function tickHTML(S){
  const L = (S.kind === 'roster' || S.kind === 'log' ? [] : (S.say || [])).filter(l => l.k !== 'd' || SET.dice).slice(-2);
  if(!L.length) return `<p class="dim">${esc(G.over ? situation(G) : `${halfName(G)} · ${batTeam(G).short} 공격`)}</p>`;
  return L.map(l => `<p class="${l.k ? 'k-' + l.k : ''}${l.after ? ' after' : ''}${l.tail ? ' cur' : ''}">${esc(l.s || l)}${l.tail ? `<span class="tail"> ${esc(l.tail)}</span>` : ''}</p>`).join('');
}
// 점수표 (이닝별 점수 · 안타 · 실책)
function lineScoreHTML(){
  const n = Math.max(G.innings, G.inning, ...G.teams.map(T => T.R.length));
  const cols = Array.from({ length:n }, (_, i) => i);
  const played = ti => ti === 0 ? G.inning : (G.top && !G.over ? G.inning - 1 : G.inning);
  const row = (T, ti) => `<tr><th>${emb(T, 'sm')}${esc(T.short)}</th>${cols.map(i => `<td>${i < played(ti) ? (T.R[i] || 0) : ''}</td>`).join('')}<td class="r">${runsOf(T)}</td><td>${T.H}</td><td>${T.E}</td></tr>`;
  return `<div class="ls-wrap"><table class="ls"><thead><tr><th></th>${cols.map(i => `<th>${i + 1}</th>`).join('')}<th class="r">R</th><th>H</th><th>E</th></tr></thead><tbody>${G.teams.map(row).join('')}</tbody></table></div>`;
}
// 지금 상황: 다이아몬드 위 주자 이름, 볼카운트, 아웃, 타자·투수
function situationHTML(){
  const T = batTeam(G), b = G.bases, B = curBatter(G), P = curPitcher(G);
  const rn = k => b[k] != null ? `<span class="rn on">${esc(T.bat[b[k]].name)}</span>` : '<span class="rn">비어 있음</span>';
  const lamp = (n, max, c) => Array.from({ length:max }, (_, i) => `<i class="${i < n ? 'on ' + c : ''}"></i>`).join('');
  return `<div class="situ"><div class="situ-dia"><div class="b2">2루 ${rn(1)}</div><div class="b3">3루 ${rn(2)}</div><div class="b1">1루 ${rn(0)}</div>
      <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 88 88 50 50 12 12 50Z" fill="#2e9b3e" stroke="#fff" stroke-width="2"/>${[[88, 50, 0], [50, 12, 1], [12, 50, 2]].map(([x, y, k]) => `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" transform="rotate(45 ${x} ${y})" fill="${b[k] != null ? '#ffcf33' : '#fff'}" stroke="#0d3f8f" stroke-width="2"/>`).join('')}<path d="M44 84h12v6l-6 6-6-6z" fill="#fff"/></svg></div>
    <div class="situ-cnt"><span><em>B</em>${lamp(G.balls, 3, 'g')}</span><span><em>S</em>${lamp(G.strikes, 2, 'y')}</span><span><em>O</em>${lamp(G.outs, 2, 'r')}</span></div>
    <div class="situ-vs"><span>${emb(T, 'sm')}<small>타자</small><b>${esc(B.name)}</b><em>${esc(batterLine(B))}</em></span><span>${emb(fieldTeam(G), 'sm')}<small>투수</small><b>${esc(P.name)}</b><em>${P.n}구</em></span></div></div>`;
}

/* ---------- 조작판 (경기 화면 아래) ---------- */
const MINOR = /더 보기|지금 상황|맡기기|노림수|사인대로|수비 위치|투수 상태|작전:|지난 공 그대로|돌아가기/;
function deckHead(S, noSub = false){
  const q = skQ(S.q); if(noSub) q.sub = '';
  return `<div class="dk-head">${S.back ? `<button type="button" class="rb" data-sk="back" aria-label="뒤로">${skIco('back')}</button>` : ''}
    ${q.chip ? `<span class="chip ${q.side || ''}">${esc(q.chip)}</span>` : ''}<div class="dk-q"><b>${esc(q.main)}</b>${q.sub ? `<small>${esc(q.sub)}</small>` : ''}</div></div>`;
}
// 경기 기록 (조작판 가운데 남는 자리): 지난 결과를 최근 것부터 아래로. 지금 결과(위 한 줄·뜸 들이는 중)는 빼서 미리 보이지 않게
function playLogHTML(S){
  if(!G || G.pre) return '';
  const now = (S.say || []).map(l => String(l.s || l).slice(0, 18));
  const lines = G.log.filter(l => 'ric'.includes(l.k) && !now.some(h => h && l.s.startsWith(h))).slice(-14);
  if(!lines.length) return '<div class="dk-log"></div>';
  return `<div class="dk-log" aria-hidden="true">${lines.map(l => `<p class="k-${l.k}">${esc(l.s)}</p>`).join('')}</div>`;
}
function deckHTML(S){
  const notes = S.note ? `<div class="dk-note">${S.note.map(l => `<p>${esc(l)}</p>`).join('')}</div>` : '';
  if(S.kind === 'pitch' && !G.over) return deckHead(S, true) + pitchDeck(S);
  if(S.kind === 'bat' && !G.over) return deckHead(S, true) + playLogHTML(S) + batDeck(S);
  if(S.kind === 'roster') return deckHead(S) + rosterHTML(S.ti) + optsHTML(S, true);
  if(S.kind === 'log') return deckHead(S) + listHTML(S.say || [], 'log') + optsHTML(S, true);
  // 그 밖의 경기 화면: 위에 질문, 가운데 지난 기록(남는 자리), 아래쪽 엄지 닿는 곳에 단추
  if(G.over && typeof endDeckHTML === 'function') return endDeckHTML(S) + notes;   // 경기 끝: 점수 카드는 그림 위, 아래는 줄 점수표와 같은 크기 단추
  const mid = G.over ? resultBanner() + lineScoreHTML() : S.grid || S.sub ? '' : playLogHTML(S);
  return deckHead(S, !G.over && !G.pre && !S.sub) + mid + notes + (S.grid ? gridHTML(S) : optsHTML(S, true));
}
// 명단: 타자(오늘 기록)와 투수
function rosterHTML(ti){
  const T = G.teams[ti], own = ownTeam(ti), d = detailed(G);
  const g = v => own ? v : grade(v);
  const rows = T.bat.map((b, i) => ({ cells: d ? [i + 1, b.name, POS[b.pos], `${b.st.ab}-${b.st.h}`, g(b.con), g(b.pow), g(b.spd)] : [i + 1, b.name, POS[b.pos], `${b.st.ab}-${b.st.h}`, b.st.hr || 0, b.st.rbi || 0, b.st.bb || 0] }));
  const prow = T.pit.map((p, i) => ({ cells:[i === T.pi ? '지금' : p.used ? '던짐' : '', p.name, p.hand === 'L' ? '좌' : '우', `${p.n || 0}구`, g(p.ctl), g(p.stf), g(p.sta)] }));
  const tabs = [{ title:'타자', cols: d ? ['', '타자', '자리', '타수-안타', '컨택', '파워', '주력'] : ['', '타자', '자리', '타수-안타', '홈런', '타점', '볼넷'], rows }];
  if(d) tabs.push({ title:'투수', cols:['', '투수', '손', '투구', '제구', '구위', '체력'], rows: prow });
  return tableHTML(tabs);
}
// 선택지 아이콘
function optIcon(o){
  const t = o.t;
  const k = /^강하게|풀스윙/.test(t) ? 'power' : /^맞히기/.test(t) ? 'contact' : /^지켜보기|^지켜/.test(t) ? 'take' : /번트/.test(t) ? 'bunt' : /도루|대주자|히트 앤드 런/.test(t) ? 'run'
    : /^치기|보통 치기|스윙|타자에게|적극|대타/.test(t) ? 'swing' : /노림수|노려/.test(t) ? 'target' : /사인대로|포수/.test(t) ? 'sign' : /수비 위치/.test(t) ? 'field' : /작전|고의|견제|교체/.test(t) ? 'flag'
    : /지난 공/.test(t) ? 'repeat' : /더 보기/.test(t) ? 'more' : /상황/.test(t) ? 'info' : /승부|유인구|던지|공을/.test(t) ? 'ball' : /자동 재생 멈/.test(t) ? 'pause' : /자동 재생/.test(t) ? 'play' : /^다음|끝까지/.test(t) ? 'next'
    : /채팅|음성/.test(t) ? 'chat' : /점수판|기록/.test(t) ? 'list' : /처음 화면|그만하기|나가기/.test(t) ? 'home' : /명단|타자와 투수/.test(t) ? 'list' : '';
  // 도트 조작 아이콘(img/icons-play.png 4칸 × 3줄): 치기·강하게·맞히기·지켜보기 / 번트·도루·노림수·포수 사인 / 수비 위치·작전·투수 교체·비디오 판독
  const pi = /투수 교체|불펜/.test(t) ? 10 : /판독/.test(t) ? 11 : ({ swing:0, power:1, contact:2, take:3, bunt:4, run:5, target:6, sign:7, field:8, flag:9 })[k];
  if(pi != null) return `<span class="pico" style="background-position:${(pi % 4) * 100 / 3}% ${Math.floor(pi / 4) * 50}%" aria-hidden="true"></span>`;
  return k ? skIco(k) : '';
}
// 확률(헛스윙 20% 파울 37% …)을 막대로
function pctChips(s){
  const out = []; const re = /([가-힣A-Za-z ]{1,10}?)\s?(\d{1,3})%/g; let m;
  while((m = re.exec(s || '')) && out.length < 4) out.push([m[1].replace(/^(의|은|는|이|가)\s/, '').trim().replace(/^.*\s(\S+)$/, '$1'), Number(m[2])]);
  if(out.length < 2) return '';
  const COL = ['#ff5d6c', '#ffb800', '#22b35a', '#2f8cf0'];
  return `<span class="pct">${out.map(([n, v], i) => `<span class="pr"><span class="pn">${esc(n)}</span><span class="pb"><i style="width:${Math.min(100, v)}%;background:${COL[i]}"></i></span><b>${v}%</b></span>`).join('')}</span>`;
}
const TONE = t => /^강하게|풀스윙|정면 승부|스트라이크로/.test(t) ? 'r' : /^맞히기|유인구/.test(t) ? 'b' : /^지켜|고의|신청하지|받아들이/.test(t) ? 's' : /번트|도루|히트/.test(t) ? 'g' : 'o';
function optsHTML(S, game){
  const want = (S.opts || []).filter(o => !o.hide);
  const minor = game ? want.filter(o => o.key === 'status' || MINOR.test(o.t)) : [];
  const major = want.filter(o => !minor.includes(o));
  const n = major.length, cols = n <= 1 ? 1 : n <= 8 ? 2 : 3;
  const tile = o => {
    const pc = game ? pctChips(o.s) : '';
    return `<button type="button" class="tile t-${TONE(o.t)}" data-sk="opt" data-n="${o.n}">${optIcon(o)}<span class="tx"><b>${esc(o.t)}</b>${pc || (o.s ? `<small>${esc(o.s)}</small>` : '')}</span></button>`;
  };
  return (n ? `<div class="tiles c${cols}" style="--rows:${Math.ceil(n / cols)}">${major.map(tile).join('')}</div>` : '')
    + (minor.length ? `<div class="minors${minor.length >= 4 ? ' stk' : ''}">${minor.map(o => `<button type="button" class="mn" data-sk="opt" data-n="${o.n}">${optIcon(o)}<span>${esc(o.t.replace(/^작전: /, '작전 · '))}</span></button>`).join('')}</div>` : '');
}
// 정해진 자리에 놓는 선택지(코스·높이·붙이기)
function gridHTML(S){
  const want = (S.opts || []).filter(o => !o.hide), placed = want.filter(o => o.pos), rest = want.filter(o => !o.pos);
  const rows = placed.length ? Math.max(...placed.map(o => o.pos[0])) + 1 : 0;
  const cells = placed.map(o => `<button type="button" class="gc" style="grid-row:${o.pos[0] + 1};grid-column:${o.pos[1] + 1}" data-sk="opt" data-n="${o.n}"><b>${esc(o.t)}</b>${o.s ? `<small>${esc(o.s)}</small>` : ''}</button>`).join('');
  return `<div class="gridz" style="${rows ? `grid-template-rows:repeat(${rows}, minmax(0, 1fr))` : ''}">${cells}</div>${rest.length ? optsHTML({ opts: rest }, true) : ''}`;
}

/* ---------- 정밀 모드 수비: 한 화면에서 고르고 던지기 ---------- */
function pitchDeck(S){
  const P = curPitcher(G), B = curBatter(G), p = picks(), F = fieldTeam(G);
  const key = `${G.at}:${G.seq}:${G.pa}:${G.pitchNo}`;
  if(!SK.pc || SK.pc.key !== key){
    const last = F.lastSel && F.lastSel.k === 'pitch' && P.pitches.some(x => x.t === F.lastSel.t) ? F.lastSel.t : null;
    SK.pc = { key, t: p.pt ? (SK.pc && SK.pc.keepT && P.pitches.some(x => x.t === SK.pc.keepT) ? SK.pc.keepT : last || P.pitches[0].t) : null, r:null, c:null, e:'edge', w:5 };
  }
  const s = SK.pc;
  // 구종 카드
  const pts = p.pt ? `<div class="pt-row">${P.pitches.map(x => `<button type="button" class="pt${s.t === x.t ? ' on' : ''}" data-sk="pt" data-t="${x.t}"><b>${esc(PITCH[x.t].name)}</b><small><i class="g g-${grade(x.g)}">${grade(x.g)}</i>${expVel(P, x.t, s.w)}km</small></button>`).join('')}</div>` : '';
  // 스트라이크 존 (가운데 3×3 칸 = 존, 바깥 한 줄 = 빼는 공)
  let zone = '';
  if(p.loc !== 'none'){
    const U = 40, flip = B.hand === 'L' ? -1 : 1;
    let cells = '';
    if(p.loc === 'full'){
      for(let R = 0; R < 5; R++) for(let C = 0; C < 5; C++){
        const inner = R >= 1 && R <= 3 && C >= 1 && C <= 3;
        if(!inner && !p.edge) continue;
        const r = clamp(R - 1, 0, 2), dc = clamp(C - 1, 0, 2), c = dispCol(dc);
        const e = inner ? (r === 1 && c === 1 ? 'in' : 'edgeK') : 'out';
        const sel = s.r === r && s.c === c && (inner ? s.e !== 'out' : s.e === 'out');
        cells += `<rect x="${C * U}" y="${R * U}" width="${U}" height="${U}" class="zc${inner ? ' in' : ' out'}${sel ? ' on' : ''}" data-sk="z" data-r="${r}" data-c="${c}" data-e="${e}"/>`;
      }
    } else {
      for(let r = 0; r < 3; r++) cells += `<rect x="${U}" y="${(r + 1) * U}" width="${3 * U}" height="${U}" class="zc in${s.r === r ? ' on' : ''}" data-sk="z" data-r="${r}" data-e="h"/>`;
    }
    // 이번 타석에 던진 공 자취 (번호)
    const col = l => /스트라이크|헛스윙|삼진/.test(l) ? '#ffcf33' : /볼/.test(l) ? '#3ddc84' : l === '파울' ? '#fff' : /아웃/.test(l) ? '#3fa9ff' : '#ff7a3d';
    const dots = (G.hist || []).map((h, i) => `<g class="zd"><circle cx="${100 + h.x * flip * 60}" cy="${100 - h.y * 60}" r="8" fill="${col(h.l)}"/><text x="${100 + h.x * flip * 60}" y="${104 - h.y * 60}">${i + 1}</text></g>`).join('');
    const selBall = s.r != null ? (() => {
      const cx = p.loc === 'full' ? (dispCol(s.c) + 1.5) * U + (s.e === 'out' ? (dispCol(s.c) - 1) * 0.6 * U : 0) : 100;
      const cy = (s.r + 1.5) * U + (s.e === 'out' && p.loc === 'full' ? (s.r - 1) * 0.6 * U : 0);
      return `<g class="zb"><circle cx="${cx}" cy="${cy}" r="11"/><path d="M${cx - 5} ${cy - 8}q4 8 0 16M${cx + 5} ${cy - 8}q-4 8 0 16"/></g>`;
    })() : '';
    const inside = B.hand === 'L' ? 'right' : 'left';
    zone = `<div class="zone-box"><span class="zl ${inside}">몸쪽</span><span class="zl ${inside === 'left' ? 'right' : 'left'}">바깥쪽</span>
      <svg class="zone" viewBox="0 0 200 200" role="group" aria-label="코스 고르기">${p.edge && p.loc === 'full' ? '<rect x="1" y="1" width="198" height="198" rx="10" class="zring"/>' : ''}
      ${cells}<rect x="40" y="40" width="120" height="120" class="zframe"/><path d="M80 40v120M120 40v120M40 80h120M40 120h120" class="zgrid"/>${dots}${selBall}</svg>
      <span class="zbat ${inside}" aria-hidden="true">${B.hand === 'L' ? '좌' : '우'}타</span></div>`;
  }
  // 붙이는 정도 · 세기
  const center = s.r === 1 && s.c === 1;
  const edgeSeg = p.edge && p.loc === 'full' && s.r != null && !center
    ? `<span class="seg-l">붙이기</span><div class="seg" role="group" aria-label="붙이는 정도">${[['in', '안쪽'], ['edge', '구석'], ['out', '빼기']].map(([e, nm]) => `<button type="button" class="${s.e === e ? 'on' : ''}" data-sk="edge" data-e="${e}" title="${esc(EDGE[e].name)}">${nm}</button>`).join('')}</div>` : '';
  const ws = [3, 5, 8];
  const powUI = !p.pow ? '' : p.pow9
    ? `<label class="pow9"><span>세기 <b>${s.w}</b> · ${esc(POWER[s.w].name)}${s.t ? ` · 약 ${expVel(P, s.t, s.w)}km` : ''}</span><input id="skPow" type="range" min="1" max="9" step="1" value="${s.w}"></label>`
    : `<span class="seg-l">세기</span><div class="seg pw" role="group" aria-label="세기">${ws.map(w => `<button type="button" class="${s.w === w ? 'on' : ''}" data-sk="pw" data-w="${w}" title="${esc(POWER[w].name)}"><b>${({ 3:'살살', 5:'보통', 8:'전력' })[w]}</b>${s.t ? `<small>${expVel(P, s.t, w)}</small>` : ''}</button>`).join('')}</div>`;
  const ready = (!p.pt || s.t) && (p.loc === 'none' || s.r != null);
  const sum = [s.t ? PITCH[s.t].name : '', s.r != null ? (p.loc === 'full' ? ZONE_NAME[s.r][s.c] + (center ? '' : ' · ' + EDGE[s.e].name) : ['높게', '가운데 높이', '낮게'][s.r]) : (p.loc === 'none' ? '' : '코스를 고르세요'), p.pow ? POWER[s.w].name : ''].filter(Boolean).join(' · ');
  const opt = n => (S.opts || []).find(o => !o.hide && String(o.n) === String(n));
  const util = [5, 6, 7, 8, 9, 0].map(opt).filter(Boolean);
  return `<div class="pc">${pts}${zone}<div class="pc-side">${edgeSeg}${powUI}</div></div>
    <button type="button" class="sk-go" data-sk="throw"${ready ? '' : ' disabled'}>${skIco('ball')}<span><b>던지기</b><small>${esc(sum)}</small></span></button>
    <div class="minors${util.length >= 4 ? ' stk' : ''}">${util.map(o => `<button type="button" class="mn" data-sk="opt" data-n="${o.n}">${optIcon(o)}<span>${esc(o.t.replace(/^작전: .*/, '작전').replace('포수 사인대로 던지기', '포수 사인').replace('수비 위치 바꾸기', '수비 위치').replace('지금 상황 확인', '상황').replace('지난 공 그대로', '지난 공'))}</span></button>`).join('')}</div>`;
}
function pitchThrow(){
  const s = SK.pc, p = picks(); if(!s) return;
  const sel = { k:'pitch' };
  if(p.pt && s.t) sel.t = s.t;
  if(p.loc === 'full' && s.r != null){ sel.r = s.r; sel.c = s.c; if(p.edge) sel.e = s.r === 1 && s.c === 1 ? 'in' : s.e; else if(s.r === 1 && s.c === 1) sel.e = 'in'; }
  if(p.loc === 'height' && s.r != null) sel.r = s.r;
  if(p.pow) sel.w = s.w;
  SK.pc.keepT = s.t;
  GS.sel = sel; stopAutoPlay(); submit('def', fillPitch(sel), 'click');
}

/* ---------- 정밀 모드 공격 ---------- */
const timingOn = () => !!SET.timing && !(typeof NET !== 'undefined' && NET.on) && G && G.mode === 'detail';
function batDeck(S){
  const want = (S.opts || []).filter(o => !o.hide);
  const main = want.filter(o => [1, 2, 3, 4].includes(Number(o.n)));
  const mid = want.filter(o => [5, 6, 7, 8].includes(Number(o.n)));
  const util = want.filter(o => [9, 0].includes(Number(o.n)));
  const tmg = timingOn();
  const big = o => {
    const swing = /^(치기|강하게 치기|맞히기)$/.test(o.t);
    const cls = o.t === '치기' ? 'swing' : /강하게|스윙 세기/.test(o.t) ? 'power' : /맞히기/.test(o.t) ? 'contact' : /지켜/.test(o.t) ? 'take' : 'swing';
    return `<button type="button" class="bt bt-${cls}" data-sk="${tmg && swing ? 'bat' : 'opt'}" data-n="${o.n}">${optIcon(o)}<b>${esc(o.t)}</b>${tmg && swing ? '<em class="tmb">타이밍</em>' : ''}<small>${esc(o.s || '')}</small></button>`;
  };
  return `<div class="bt-grid n${main.length}">${main.map(big).join('')}</div>
    ${mid.length ? `<div class="bt-mid">${mid.map(o => `<button type="button" class="mid${/걸었음/.test(o.t) ? ' on' : ''}" data-sk="opt" data-n="${o.n}">${optIcon(o)}<span>${esc(o.t.replace('노림수: ', '노림수 · ').replace('히트 앤드 런: 걸었음', '히트 앤드 런 ✓'))}</span></button>`).join('')}</div>` : ''}
    ${util.length ? `<div class="minors">${util.map(o => `<button type="button" class="mn" data-sk="opt" data-n="${o.n}">${optIcon(o)}<span>${esc(o.t)}</span></button>`).join('')}</div>` : ''}`;
}
/* 타이밍 맞춰 치기: 수비 쪽 공(컴퓨터가 고르거나 둘이 하기에서 먼저 고른 공)의 구속으로 공이 날아오는 시간을 정함.
   공이 홈플레이트에 닿는 순간과 누른 순간의 차이를 -1(빠름)~1(늦음)로 재서 선택에 붙임(tm). 끝까지 누르지 않으면 지켜보기 */
function timingStart(n){
  const o = (UI.S.opts || []).find(x => !x.hide && String(x.n) === String(n)); if(!o) return;
  const def = 1 - batIdx(G);
  if(!GS.pend.def && !needs(def) && !remote(def)) GS.pend.def = aiDefChoice(G);
  const D = GS.pend.def;
  if(!D || D.k !== 'pitch'){ GS.tm = null; choose(n, 'click'); return; }
  const vel = expVel(curPitcher(G), D.t, D.w || 5), fast = PITCH[D.t].fast;
  const T = clamp(0.5 + (158 - vel) * 0.022, 0.45, 1.25) * (fast ? 1 : 1.08), wind = 0.95;
  const st = $('#skStage');
  const ov = document.createElement('div'); ov.className = 'tmg'; ov.id = 'skTmg';
  ov.innerHTML = `<div class="tmg-lane"><span class="tmg-ring"></span><span class="tmg-ball"></span></div><div class="tmg-msg">투수 와인드업…</div>`;
  st.appendChild(ov);
  const btn = document.createElement('div'); btn.className = 'tmg-pad'; btn.innerHTML = `<button type="button" class="tmg-btn" data-sk="tswing">${skIco('swing')}<b>스윙!</b><small>공이 동그라미에 들어올 때 누르세요 · 누르지 않으면 지켜봅니다</small></button>`;
  $('#skBody').appendChild(btn);
  document.documentElement.classList.add('sk-timing');
  SK.tm = { n, o, pad: btn, t0: performance.now(), T, wind, brk: !fast ? (D.t === 'curve' ? 1 : D.t === 'fork' || D.t === 'change' ? 0.6 : 0.8) : 0, side: (D.c ?? 1) - 1, done:false, raf:0 };
  const ball = ov.querySelector('.tmg-ball'), ring = ov.querySelector('.tmg-ring'), msg = ov.querySelector('.tmg-msg');
  const tick = () => {
    const S2 = SK.tm; if(!S2 || S2.done) return;
    const t = (performance.now() - S2.t0) / 1000;
    if(t < S2.wind){ ball.style.opacity = '0'; msg.textContent = t < S2.wind * 0.55 ? '투수 와인드업…' : '던집니다!'; }
    else {
      const k = (t - S2.wind) / S2.T;   // 0: 손을 떠남 · 1: 홈플레이트
      msg.textContent = '';
      const kk = Math.min(k, 1.4), drop = S2.brk ? S2.brk * Math.pow(Math.max(0, kk - 0.55), 2) * 40 : 0;
      ball.style.opacity = '1';
      ball.style.top = `${36 + kk * 46 + drop}%`;
      ball.style.left = `${50 + S2.side * kk * 6 + (S2.brk ? S2.side * drop * 0.2 : 0)}%`;
      ball.style.transform = `translate(-50%, -50%) scale(${0.35 + kk * 1.1})`;
      ring.classList.toggle('hot', Math.abs(k - 1) < 0.12);
      if(k > 1.45){ timingEnd(null); return; }
    }
    S2.raf = requestAnimationFrame(tick);
  };
  SK.tm.raf = requestAnimationFrame(tick);
}
function timingTap(){
  const S2 = SK.tm; if(!S2 || S2.done) return;
  const t = (performance.now() - S2.t0) / 1000;
  const e = t < S2.wind ? -1 : ((t - S2.wind) / S2.T - 1);   // 손을 떠나기 전에 누르면 아주 빠름
  timingEnd(clamp(e * 2.2, -1, 1));
}
function timingEnd(tm){
  const S2 = SK.tm; if(!S2 || S2.done) return;
  S2.done = true; cancelAnimationFrame(S2.raf);
  const ov = $('#skTmg'), msg = ov && ov.querySelector('.tmg-msg');
  const word = tm == null ? '지켜봅니다' : Math.abs(tm) < 0.15 ? '딱 맞았다!' : tm < -0.6 ? '너무 빨랐다' : tm < 0 ? '조금 빨랐다' : tm > 0.6 ? '너무 늦었다' : '조금 늦었다';
  if(msg){ msg.textContent = word; msg.className = 'tmg-msg big ' + (tm == null ? '' : Math.abs(tm) < 0.15 ? 'good' : Math.abs(tm) < 0.4 ? 'ok' : 'bad'); }
  setTimeout(() => {
    SK.tm = null; document.documentElement.classList.remove('sk-timing');
    if(ov) ov.remove(); const pad = $('.tmg-pad'); if(pad) pad.remove();
    if(!G || UI.make !== offMain) return;
    if(tm == null){ const take = (UI.S.opts || []).find(o => !o.hide && /^지켜보기/.test(o.t)); GS.tm = null; if(take) choose(take.n, 'click'); return; }
    GS.tm = tm; choose(S2.n, 'click');
  }, 520);
}

/* ---------- 메뉴 화면 ---------- */
function topHTML(S){
  const fsOn = typeof FS !== 'undefined' && FS.on(), canFs = typeof isStandalone === 'function' && !isStandalone();
  const CRT = { 'setup':'경기 설정', 'lg-home':'리그', 'ar-home':'기록실', 'ar-show': S.title || '기록실', 'cr-shop2':'스포츠 용품점', 'cr-coach':'특별 코치 레슨', 'sc-show':'일정과 결과', 'cr-bag2':'내 가방', 'lg-setup':'새 리그', 'wz-1':'선수 만들기', 'wz-2':'선수 만들기', 'wz-3':'선수 만들기', 'team-pick':'팀 고르기', 'cr-look':'얼굴 꾸미기', 'as-home':'올스타 휴식기', 'as-derby':'홈런 더비', 'fo-home':'구단 사무실', 'fo-list':'구단 사무실', 'cr-camp':'스프링캠프', 'ct-home':'우리 센터 팀', 'ct-list':'선수 고르기', 'ct-player':'선수 고치기', 'ct-num':'능력치', 'cr-home':'라커룸', 'cr-visit':'마을', 'cr-train':'훈련', 'cr-bag':'내 가방', 'cr-info':'내 선수', 'cr-face':'얼굴 고르기', 'cr-log':'업적과 경력', 'cr-game':'오늘 경기' };
  if(S.kind === 'cr-talk') CRT['cr-talk'] = S.who === 'gm' ? '연봉 계약' : S.who === 'agent' ? 'FA 시장' : '이벤트!';
  const title = S.hero ? '' : S.onTab ? '설정' : CRT[S.kind] || S.skTitle || menuTitle(S).title;   // 새 화면은 S.skTitle로 제목을 정할 수 있음
  return `<div class="bar">${S.back ? `<button type="button" class="rb" data-sk="back" aria-label="뒤로">${skIco('back')}</button>` : ''}
    <b class="ttl">${esc(title)}</b>
    ${canFs ? `<button type="button" class="rb b" data-sk="fs" aria-label="${fsOn ? '전체화면 끄기' : '전체화면 켜기'}">${skIco(fsOn ? 'fsx' : 'fs')}</button>` : ''}
    ${S.hero ? `<button type="button" class="rb b" data-sk="menu" aria-label="설정">${uiGlyph('설정')[1]}</button>` : ''}</div>`;
}
// 메뉴 화면 제목: '…입니다.'로 끝나는 첫 문장이 있으면 그것(예: 순위표, 홈런 순위), 없으면 마지막 질문. 나머지 문장은 제목 아래 작은 글
function menuTitle(S){
  const qs = skClean(S.q).replace(/\s*\([^)]*\)/g, '').split(/(?<=[.?!])\s+/).filter(x => x && !/^[(.]/.test(x));   // 괄호 설명은 제목으로 쓰지 않음
  const i = qs.findIndex(x => /입니다\.$/.test(x) && x.length <= 24);
  if(i >= 0) return { title: qs[i].replace(/(이)?입니다\.$/, ''), sub: qs.filter((_, j) => j !== i && !/고르세요|읽어 보세요/.test(qs[j])).join(' ') };
  return { title: qs[qs.length - 1] || '손잡다 야구', sub: qs.slice(0, -1).join(' ') };
}
function menuHTML(S){
  const cs = typeof careerSkin === 'function' ? careerSkin(S) : null;   // 선수 육성 화면(skin-career.js)
  if(cs != null) return cs;
  const out = [], q = { sub: menuTitle(S).sub };
  if(S.hero) out.push(`<div class="hero"><div class="hero-art" aria-hidden="true"></div><div class="hero-tx"><div class="logo" aria-hidden="true"><span>손잡다 야구</span></div><h1 class="sr-only">손잡다 야구</h1><span class="kick">듣고 보고 고르는 확률 야구</span></div></div>`);
  if(S.top) out.push(`<div class="mtop">${S.top}</div>`);
  // 질문의 설명 부분(제목 아래 작은 글)
  if(!S.hero && !S.onTab && q.sub) out.push(`<p class="msub">${esc(q.sub)}</p>`);
  if(S.tabs){   // 기록 고르기 탭 + 순위표 (탭을 누르면 바로 그 기록)
    out.push(`<div class="ld-tabs">${(S.opts || []).filter(o => !o.hide && o.key).map(o => `<button type="button" class="${o.key === S.tabs ? 'on' : ''}" data-sk="opt" data-n="${o.n}" aria-pressed="${o.key === S.tabs}">${esc(o.t.replace('세이브와 홀드', '세이브·홀드').replace('평균자책점', '평균자책'))}</button>`).join('')}</div>`);
    out.push(S.table && S.table.length && S.table.some(t => t.rows.length) ? tableHTML(S.table) : `<div class="ar-empty panel">${typeof awardIco === 'function' ? awardIco(1) : ''}<p>${esc((S.say || [])[0] || '아직 기록이 없습니다.')}</p></div>`);
    return out.join('');
  }
  if(S.table && S.table.length) out.push(tableHTML(S.table));
  else if(S.say && S.say.length) out.push(S.say.length > 3 || S.say.join('').length > 160 ? listHTML(S.say) : `<div class="say panel">${S.say.map(l => `<p class="${l.k ? 'k-' + l.k : ''}">${esc(l.s || l)}</p>`).join('')}</div>`);
  if(S.note && !S.hero) out.push(`<div class="mnote">${S.note.map(l => `<p>${esc(l)}</p>`).join('')}</div>`);
  if(S.input){
    const buf = UI.codeBuf || '';
    out.push(`<div class="code">${[0, 1, 2, 3].map(i => `<span class="${buf[i] ? 'on' : ''}">${esc(buf[i] || '')}</span>`).join('')}</div>`);
    const keys = (S.opts || []).filter(o => !o.hide);
    out.push(`<div class="keypad">${keys.map(o => `<button type="button" class="key" data-sk="opt" data-n="${o.n}">${esc(o.t)}</button>`).join('')}<button type="button" class="key del" data-sk="back">지우기</button></div>`);
    return out.join('');
  }
  if(S.focusCmd || S.onText) out.push(`<form id="skForm" class="sk-form" autocomplete="off"><input id="skIn" type="text" maxlength="40" placeholder="여기에 적으세요" enterkeyhint="done" autocapitalize="off" spellcheck="false"><button type="submit" class="gb y">확인</button></form>`);
  if(S.grid) out.push(gridHTML(S));
  else out.push(menuOpts(S));
  return out.join('');
}
function menuOpts(S){
  const want = (S.opts || []).filter(o => !o.hide && !(S.onTab && /^다음 탭:/.test(o.t)));   // 설정 탭은 위 탭 줄로 옮김
  if(!want.length) return '';
  const sets = want.filter(o => /^([^:]{2,24}):\s*(.+)$/.test(o.t)).length;
  const setList = (sets * 2 >= want.length && sets > 0) || !!S.onTab || !!S.list;
  const team = o => typeof TEAMS !== 'undefined' && [...(CENTER ? [centerInfo()] : []), ...TEAMS].find(T => o.t === T.name || o.t.startsWith(T.name + ' ') || o.t.startsWith(T.name + ',') || o.t === T.short);
  const teams = want.filter(team).length >= 4;
  // 돌아가기만 있는 화면(기록 보기 등)은 작은 단추로
  if(want.length === 1 && /돌아가기/.test(want[0].t)) return `<div class="mback"><button type="button" class="gb b" data-sk="opt" data-n="${want[0].n}">${skIco('back')}${esc(want[0].t)}</button></div>`;
  const cards = want.map(o => {
    const T = team(o);
    if(teams && T) return `<button type="button" class="card team" style="--tc:${T.color}" data-sk="opt" data-n="${o.n}">${emb(T, 'big')}<span class="tx"><b>${esc(T.name)}</b><small>${esc(o.s || '')}</small></span></button>`;
    const m = /^([^:]{2,24}):\s*(.+)$/.exec(o.t);
    // 설정 목록: 값이 있는 줄은 오른쪽에 값(켬·끔은 스위치), 값이 없는 줄(소리 시험 등)은 오른쪽에 화살표. 모두 같은 줄 모양
    if(setList){
      if(!m) return `<button type="button" class="card row act" data-sk="opt" data-n="${o.n}"><span class="tx"><b>${esc(o.t)}</b>${o.s ? `<small>${esc(o.s)}</small>` : ''}</span><span class="chev">${skIco('next1')}</span></button>`;
      const v = m[2], on = /^(켬|켜짐)$/.test(v), off = /^(끔|꺼짐|읽지 않음)$/.test(v);
      return `<button type="button" class="card row" data-sk="opt" data-n="${o.n}"><span class="tx"><b>${esc(m[1])}</b>${o.s ? `<small>${esc(o.s)}</small>` : ''}</span><span class="val${on ? ' on' : off ? ' off' : ''}">${on || off ? `<i class="sw${on ? ' on' : ''}"></i>` : esc(v)}</span></button>`;
    }
    const g = uiGlyph(o.t), mi = menuIcon(o.t), it = itemIcon(o.t);
    const ico = mi >= 0 ? `<span class="mico" style="background-position:${(mi % 3) * 50}% ${Math.floor(mi / 3) * 50}%" aria-hidden="true"></span>`
      : it >= 0 ? `<span class="iico" style="background-position:${(it % 5) * 25}% ${Math.floor(it / 5) * 100 / 3}%" aria-hidden="true"></span>`
      : g ? `<span class="gico g-${g[0]}" aria-hidden="true">${g[1]}</span>` : typeof hubIco === 'function' ? hubIco(menuKey(o.t)) : '';   // 맞는 그림이 없어도 모든 단추에 아이콘
    return `<button type="button" class="card${S.hero ? ' hero-c' : ''}${S.hero && /이어하기/.test(o.t) ? ' wide pri' : ''}" data-sk="opt" data-n="${o.n}">${ico}<span class="tx"><b>${esc(o.t)}</b>${o.s ? `<small>${esc(o.s)}</small>` : ''}</span></button>`;
  }).join('');
  const many = want.length > 6 ? ' many' : '';
  return `<div class="cards${S.hero ? ' home' : ''}${teams ? ' teams' : ''}${setList ? ' sets' : ''}${many}">${cards}</div>`;
}

/* ---------- 창 (메모·점수표·능력치·지금 상황) ---------- */
function skinNote(lines, html, title, kind){
  skinInit();
  if(!html && kind && typeof G !== 'undefined' && G){
    if(kind === 'score'){ html = lineScoreHTML() + `<p class="sh-sit">${esc(situation(G))}</p>`; title = '점수표'; }
    else if(kind === 'who'){ const h = document.createElement('div'); gstatRender(G, h); html = h.innerHTML; title = '타자와 투수'; }
    else if(kind === 'status'){ html = situationHTML(); title = `${halfName(G)} · ${scoreText(G)}`; }
    else if(kind === 'recent'){ html = `<div class="rec">${(lines || []).map(l => `<p>${esc(l)}</p>`).join('')}</div>`; title = '최근 기록'; }
    else if(kind === 'scout' && typeof scoutBatter === 'function'){   // 상대 분석 (감독 모드): 타자 쪽에서 본 존에 약점 칸(빨강)·잘 치는 높이(초록)
      const sc = scoutBatter(G), U = 30, cells = [];
      for(let r = 0; r < 3; r++) for(let c = 0; c < 3; c++){ const weak = r === sc.weak.r && c === sc.weak.c, good = r === sc.strongR; cells.push(`<rect x="${20 + c * U}" y="${10 + r * U}" width="${U}" height="${U}" fill="${weak ? '#ff4d5e' : good ? '#7be39a' : '#1d3f7a'}" stroke="#fff" stroke-width="2"/>`); }
      html = `<div class="scout"><svg viewBox="0 0 130 110" class="sc-z" aria-hidden="true">${cells.join('')}<text x="35" y="108" font-size="9" fill="#47608f" text-anchor="middle">몸쪽</text><text x="95" y="108" font-size="9" fill="#47608f" text-anchor="middle">바깥쪽</text></svg>`
        + `<div class="rec">${(lines || []).map(l => `<p>${esc(l)}</p>`).join('')}</div></div>`;
      title = `상대 분석 · ${sc.name}`;
    }
  }
  const sh = $('#skSheet');
  SK.sheet = html ? 'custom' : 'note'; SK.sheetMake = UI.make;
  if(kind) SK.sheet = 'note';
  sh.innerHTML = `<div class="sh-back" data-sk="shx"></div><div class="sh-box" role="dialog" aria-modal="true" aria-label="${esc(title || '알림')}">
    <div class="sh-h"><h3>${esc(title || '알림')}</h3><button type="button" class="rb" data-sk="shx" aria-label="닫기">${skIco('x')}</button></div><div class="sh-body">${html || (lines || []).map(l => `<p>${esc(l)}</p>`).join('')}</div>
    <button type="button" class="gb y" data-sk="shx">닫기</button></div>`;
  sh.hidden = false;
  setTimeout(() => { const b = sh.querySelector('.gb'); if(b) b.focus({ preventScroll:true }); }, 30);
}
function skinSheetClose(silent){
  const sh = $('#skSheet'); if(!sh) return;
  sh.hidden = true; sh.innerHTML = ''; SK.sheet = null;
  if(!silent) UI.note = null;
}

/* ---------- 누르기 ---------- */
function skinClick(e){
  const b = e.target.closest && e.target.closest('[data-sk]');
  if(!b || !(b.closest('#sk') || b.closest('#skSheet'))) return;
  if(document.documentElement.classList.contains('hold') && b.closest('#skBody')) return;   // 결과를 기다리는 동안은 고르지 않음
  const a = b.dataset.sk;
  if(a === 'tswing'){ timingTap(); return; }
  if(SK.tm) return;
  if(a === 'opt'){ GS.tm = null; if(b.closest('#skSheet')) skinSheetClose(true); choose(b.dataset.n, 'click'); }
  else if(a === 'spot' && typeof crSpot === 'function') crSpot(b.dataset.spot);
  else if(a === 'set' && UI.S && UI.S.set){ UI.S.set(b.dataset.k, b.dataset.v); rerender(); }   // 고르기만 하고, "다음"·"시작"을 눌러야 정해지는 화면
  else if(a === 'set' && typeof setupSet === 'function') setupSet(b.dataset.k, b.dataset.v);
  else if(a === 'back') back('click');
  else if(a === 'menu'){ stopAutoPlay(); openMenu('click'); }
  else if(a === 'talk' && typeof talkScreen === 'function') go(talkScreen, 'click');
  else if(a === 'fs') FS.toggle();
  else if(a === 'box' && G) skinNote(null, null, null, 'score');
  else if(a === 'stats' && G) skinNote(null, null, null, 'who');
  else if(a === 'shx') skinSheetClose();
  else if(a === 'pg'){ SK.pgi = clamp(SK.pgi + Number(b.dataset.d), 0, (SK.pgn || 1) - 1); $('#skBody').querySelectorAll('.pg').forEach(paginate); }
  else if(a === 'pt' && SK.pc){ SK.pc.t = b.dataset.t; skinBody(); }
  else if(a === 'z' && SK.pc){
    const r = Number(b.dataset.r), c = b.dataset.c != null ? Number(b.dataset.c) : null, e2 = b.dataset.e;
    SK.pc.r = r; SK.pc.c = c;
    if(e2 === 'out') SK.pc.e = 'out'; else if(e2 === 'in') SK.pc.e = 'in'; else if(e2 === 'edgeK' && (SK.pc.e === 'out' || SK.pc.e === 'in')) SK.pc.e = 'edge';
    skinBody();
  }
  else if(a === 'edge' && SK.pc){ SK.pc.e = b.dataset.e; skinBody(); }
  else if(a === 'pw' && SK.pc){ SK.pc.w = Number(b.dataset.w); skinBody(); }
  else if(a === 'throw') pitchThrow();
  else if(a === 'bat') timingStart(b.dataset.n);
}
// 타이밍을 재는 동안에는 그림판을 눌러도 스윙
document.addEventListener('pointerdown', e => { if(SK.tm && e.target.closest && e.target.closest('#skStage')){ e.preventDefault(); timingTap(); } });

/* ---------- 도트 그림 아이콘 ---------- */
// 처음 화면 메뉴 아이콘(img/icons-menu.png 3칸 × 3줄): 혼자·둘이·온라인 / 리그·육성·관전 / 이어하기·설정·설치
// 일반 메뉴 단추의 선 아이콘(skin-hub.js HUB_ICO) 고르기
function menuKey(t){
  const L = [[/순위표|팀 순위/, 'stand'], [/기록 순위|통산/, 'lead'], [/일정|지난 결과|포스트시즌/, 'sched'], [/사무실|트레이드|드래프트|FA/, 'office'], [/명예|기록실|우승|시상/, 'arch'],
    [/돌아가기|그만두기|취소/, 'back'], [/처음 화면/, 'home'], [/넘기기|건너뛰/, 'sim'], [/채팅|음성/, 'chat'], [/나가기|지우기|은퇴/, 'exit'], [/경기 하기|시작|이어/, 'play'],
    [/기록|목록|명단|선수/, 'list'], [/만들기|새 /, 'rec'], [/백업|불러오기|저장/, 'bag'], [/다시/, 'again']];
  const m = L.find(([re]) => re.test(t)); return m ? m[1] : 'go';
}
function menuIcon(t){
  const L = [/^혼자 하기/, /^둘이 하기/, /^온라인/, /^리그$|^리그 /, /^선수 육성/, /관전/, /^이어하기|^이어 하기|^지금 경기 이어/, /^설정/, /설치/];
  return L.findIndex(re => re.test(t));
}
// 용품점·가방 아이콘(img/items.png 5칸 × 4줄, 마지막은 돈 주머니)
const ITEM_NAMES = ['연습용 나무 배트', '단풍나무 배트', '프로 모델 배트', '황금 배트', '가죽 글러브', '명품 수제 글러브', '투수용 글러브', '명품 투수 글러브', '가벼운 스파이크', '탄소 스파이크', '투수용 스파이크', '손목 아대', '손목 보호대', '타격 장갑', '어깨 보호 슬리브', '행운의 목걸이', '에너지 음료', '테이핑과 찜질 세트', '보약'];
function itemIcon(t){
  // 긴 이름부터 맞춰 봄('명품 투수 글러브'가 '투수용 글러브'로 잡히지 않게)
  let best = -1, len = 0;
  ITEM_NAMES.forEach((n, i) => { if(t.includes(n) && n.length > len){ best = i; len = n.length; } });
  return best;
}
// 큰 글씨 배너(img/banners3.png 한 줄에 하나): 경기 시작!·승리!·패배·무승부·MVP·신기록!·우승!·플레이 볼!
const BAN3 = { start:0, win:1, lose:2, draw:3, mvp:4, record:5, champ:6, playball:7 };
const ban3 = (k, cls = '') => `<span class="ban3 ${cls}" style="background-position:0 ${BAN3[k] * 100 / 7}%" role="img" aria-label="${esc(['경기 시작', '승리', '패배', '무승부', 'MVP', '신기록', '우승', '플레이 볼'][BAN3[k]])}"></span>`;
// 경기 끝: 내 팀(혼자 하기·온라인·리그·육성)이 이겼으면 승리!, 졌으면 패배. 내 팀이 없으면(둘이·관전) 이긴 팀 엠블럼과 승리!
function resultBanner(){
  const r = G.teams.map(runsOf), mine = typeof NET !== 'undefined' && NET.on ? NET.side : G.focusTeam != null ? G.focusTeam : myTeam();
  if(r[0] === r[1]) return `<div class="res">${ban3('draw')}</div>`;
  const win = r[0] > r[1] ? 0 : 1;
  if(mine >= 0) return `<div class="res">${emb(G.teams[mine], 'big')}${ban3(mine === win ? 'win' : 'lose')}</div>`;
  return `<div class="res">${emb(G.teams[win], 'big')}${ban3('win')}<b>${esc(G.teams[win].short)}</b></div>`;
}
// 경기 시작: 그림 위에 '플레이 볼!'을 잠깐 띄움 (경기마다 한 번)
function playBallFlash(){
  if(!G || G.over || G.pa > 0 || G.pitchNo > 0 || SK.pbAt === G.at) return;
  SK.pbAt = G.at;
  const st = $('#skStage'); if(!st) return;
  const el = document.createElement('div'); el.className = 'pb-flash'; el.innerHTML = ban3('playball');
  st.appendChild(el); setTimeout(() => el.remove(), 1700);
}
