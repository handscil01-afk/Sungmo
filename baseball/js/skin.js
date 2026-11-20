'use strict';
/* ===================== 화면 보며 하기(비장애인 모드) 화면 =====================
   경기 계산과 화면 정의(UI.S = 질문 + 번호 선택지)는 소리와 글로 하기와 똑같이 쓰고, 그리는 방법만 다름.
   - 선택지를 누르면 choose(번호)를 불러서 두 방식이 같은 길로 진행함 (숫자 키도 그대로 됨)
   - 정밀 모드 수비는 구종·코스·붙이는 정도·세기를 한 화면에서 고르고 '던지기'로 같은 선택(GS.sel → fillPitch → submit)을 만듦
   - 정밀 모드 공격은 큰 단추로 치는 방법을 고름. 설정의 '타이밍 맞춰 치기'를 켜면 공이 들어오는 순간에 한 번 더 누름(혼자·둘이 하기만)
   - 화면: 위 점수판(HTML) · 도트 그림판(gfx.js) · 결과 한 줄 · 아래 조작판. 가로 화면은 그림 왼쪽, 조작판 오른쪽 */
const SK = { el:null, pc:null, tm:null, sheet:null, sheetMake:null };

const SK_ICON = {
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',
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
};
const skIco = (k, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SK_ICON[k] || ''}</svg>`;
const grade = v => v >= 80 ? 'A' : v >= 65 ? 'B' : v >= 45 ? 'C' : v >= 32 ? 'D' : 'E';
// 질문을 '공격·수비 띠 + 가장 중요한 질문 + 나머지 설명'으로 나눔
// 화면 보며 하기에서는 키보드·명령 칸 안내 문장을 빼고 보여 줌 (소리와 글로 하기 화면 정의는 그대로)
const KEY_HINT = /점\(\.\)|\d번은 다음|번 키|숫자 키|\d+번째 탭|탭 \d+개 중/;
const skClean = q => String(q || '').replace(/명령 칸에 적고 입력을/g, '아래 칸에 적고 확인을').split(/(?<=[.?!])\s+/).filter(x => x && !KEY_HINT.test(x)).join(' ');
function skQ(q){
  const qs = skClean(q).split(/(?<=[.?!])\s+/).filter(Boolean);
  if(qs.length < 2) return { chip:'', main: qs[0] || '', sub:'' };
  const f = qs[0].replace(/\.$/, ''), side = /수비/.test(f) ? 'def' : /공격/.test(f) ? 'off' : '';
  if(side || f.length <= 14) return { chip: f, side, main: qs[qs.length - 1], sub: qs.slice(1, -1).join(' ') };
  return { chip:'', main: qs[qs.length - 1], sub: qs.slice(0, -1).join(' ') };
}

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
}
function skinRender(S){
  skinInit();
  const root = document.documentElement, game = !!(S.board && typeof G !== 'undefined' && G);
  root.classList.toggle('sk-game', game);
  root.classList.toggle('sk-menu', !game);
  root.classList.toggle('sk-scene', !game && !!S.scene);
  root.classList.toggle('sk-hero', !game && !!S.hero);
  const st = $('#skStage');
  if(typeof GX !== 'undefined'){
    GX.hud = true;
    if(game){ st.hidden = false; GX.host = st; gfxRender(G, UI.lastFx || [], UI.lastLines || [], UI.lastEv || []); UI.lastFx = []; UI.lastLines = []; UI.lastEv = []; }
    else if(S.scene){ st.hidden = false; GX.host = st; gfxScene(st, S.scene); }
    else { st.hidden = true; GX.scene = null; }
  }
  let ov = $('#skOv'); if(!ov){ ov = document.createElement('div'); ov.id = 'skOv'; ov.className = 'sk-ov'; } if(ov.parentNode !== st) st.appendChild(ov);
  ov.innerHTML = game ? plateHTML() : '';
  $('#skTop').innerHTML = game ? hudHTML() : topHTML(S);
  const tk = $('#skTick'); tk.hidden = !game; tk.innerHTML = game ? tickHTML(S) : '';
  if(game) tk.scrollTop = tk.scrollHeight;
  skinBody();
  // 다른 화면으로 가면 열어 둔 창(메모·점수표)은 닫음
  if(SK.sheet && (SK.sheetMake !== UI.make || (SK.sheet === 'note' && !UI.note))) skinSheetClose(true);
}
function skinBody(){
  const S = UI.S; if(!S || !SK.el) return;
  const game = !!(S.board && typeof G !== 'undefined' && G);
  const body = $('#skBody');
  body.className = 'sk-body ' + (game ? 'deck' + (S.kind ? ' k-' + S.kind : '') : 'menu');
  body.innerHTML = game ? deckHTML(S) : menuHTML(S);
  if(SK.tm && SK.tm.pad && !SK.tm.done) body.appendChild(SK.tm.pad);   // 타이밍을 재는 중에 다시 그려도 스윙 단추는 그대로
  if(!game && (S.focusCmd || (S.onText && !S.input)) && !('ontouchstart' in window)) setTimeout(() => { const i = $('#skIn'); if(i) i.focus(); }, 30);
}

/* ---------- 점수판 (경기 화면 위) ---------- */
function hudHTML(){
  const [A, H] = G.teams, b = G.bases;
  const lamp = (n, max, c) => Array.from({ length:max }, (_, i) => `<i class="${i < n ? 'on ' + c : ''}"></i>`).join('');
  const tm = (T, i) => `<div class="hud-tm${!G.over && (i === 0) === G.top ? ' bat' : ''}" style="--tc:${T.color}"><span class="emb">${esc(T.short[0])}</span><span class="nm">${esc(T.short)}</span><b>${runsOf(T)}</b></div>`;
  const base = (x, y, on) => `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" transform="rotate(45 ${x} ${y})" class="${on ? 'on' : ''}"/>`;
  return `<button type="button" class="hud" data-sk="box" aria-label="점수표 보기">
      <div class="hud-score">${tm(A, 0)}${tm(H, 1)}</div>
      <div class="hud-inn">${G.over ? '<b class="end">경기<br>끝</b>' : `<b>${G.inning}</b><span class="${G.top ? 'up' : 'dn'}">${G.top ? '초' : '말'}</span>`}</div>
      <svg class="hud-dia" viewBox="0 0 48 40" aria-hidden="true">${base(36, 22, b[0] != null)}${base(24, 10, b[1] != null)}${base(12, 22, b[2] != null)}<path d="M21 32h6v3l-3 3-3-3z" class="hp"/></svg>
      <div class="hud-cnt"><div><span>B</span>${lamp(G.balls, 3, 'g')}</div><div><span>S</span>${lamp(G.strikes, 2, 'y')}</div><div><span>O</span>${lamp(G.outs, 2, 'r')}</div></div>
    </button>
    <div class="hud-btns">${typeof NET !== 'undefined' && NET.on ? `<button type="button" class="sk-ib" data-sk="talk" aria-label="채팅과 음성 대화">${skIco('chat')}</button>` : ''}<button type="button" class="sk-ib" data-sk="menu" aria-label="메뉴">${skIco('menu')}</button></div>`;
}
// 결과 한 줄: 뜸 들이는 동안은 앞부분(투구 설명)만
function tickHTML(S){
  const L = (S.say || []).filter(l => l.k !== 'd' || SET.dice).slice(-2);
  if(!L.length) return `<p class="dim">${esc(G.over ? situation(G) : `${halfName(G)} · ${batTeam(G).short} 공격`)}</p>`;
  return L.map(l => `<p class="${l.k ? 'k-' + l.k : ''}${l.after ? ' after' : ''}${l.tail ? ' cur' : ''}">${esc(l.s || l)}${l.tail ? `<span class="tail"> ${esc(l.tail)}</span>` : ''}</p>`).join('');
}
// 점수표 (이닝별 점수 · 안타 · 실책)
function lineScoreHTML(){
  const n = Math.max(G.innings, G.inning, ...G.teams.map(T => T.R.length));
  const cols = Array.from({ length:n }, (_, i) => i);
  const played = ti => ti === 0 ? G.inning : (G.top && !G.over ? G.inning - 1 : G.inning);
  const row = (T, ti) => `<tr><th style="--tc:${T.color}"><span class="emb">${esc(T.short[0])}</span>${esc(T.short)}</th>${cols.map(i => `<td>${i < played(ti) ? (T.R[i] || 0) : ''}</td>`).join('')}<td class="r">${runsOf(T)}</td><td>${T.H}</td><td>${T.E}</td></tr>`;
  return `<div class="ls-wrap"><table class="ls"><thead><tr><th></th>${cols.map(i => `<th>${i + 1}</th>`).join('')}<th class="r">R</th><th>H</th><th>E</th></tr></thead><tbody>${G.teams.map(row).join('')}</tbody></table></div>`;
}

/* ---------- 조작판 (경기 화면 아래) ---------- */
const MINOR = /더 보기|지금 상황|맡기기|노림수|사인대로|수비 위치|투수 상태|작전:|지난 공 그대로|돌아가기/;
function deckHead(S, extra = '', noSub = false){
  const q = skQ(S.q); if(noSub) q.sub = '';
  return `<div class="dk-head">${S.back ? `<button type="button" class="sk-ib sm" data-sk="back" aria-label="뒤로">${skIco('back')}</button>` : ''}
    ${q.chip ? `<span class="chip ${q.side || ''}">${esc(q.chip)}</span>` : ''}<div class="dk-q"><b>${esc(q.main)}</b>${q.sub ? `<small>${esc(q.sub)}</small>` : ''}</div>${extra}</div>`;
}
function deckHTML(S){
  const notes = S.note ? `<div class="dk-note">${S.note.map(l => `<p>${esc(l)}</p>`).join('')}</div>` : '';
  if(S.kind === 'pitch' && !G.over) return deckHead(S, '', true) + pitchDeck(S);
  if(S.kind === 'bat' && !G.over) return deckHead(S, '', true) + batDeck(S);
  return deckHead(S, '', !G.over && !G.pre && !S.sub) + (G.over ? lineScoreHTML() : '') + notes + (S.grid ? gridHTML(S) : optsHTML(S, true));
}
// 지금 타자 대 투수 (누르면 능력치와 공 자취)
// 그림 위 이름표 (TV 중계처럼): 타자는 왼쪽 아래, 투수는 오른쪽 위. 누르면 능력치와 공 자취
function plateHTML(){
  if(!G || G.over || G.pre) return '';
  const B = curBatter(G), P = curPitcher(G), bi = batIdx(G), fi = 1 - bi;
  const left = Math.round(clamp(1 - P.load / P.sta, 0, 1) * 100), col = left > 60 ? 'g' : left > 30 ? 'y' : 'r';
  const ownB = ownTeam(bi);
  return `<button type="button" class="np np-b" data-sk="stats" style="--tc:${G.teams[bi].color}" aria-label="타자 ${esc(B.name)} 능력치 보기"><small>${batTeam(G).bi + 1}번 · ${B.hand === 'L' ? '좌타' : '우타'}${B.cond && (ownB || B.seen) ? ` <em class="${B.cond > 0 ? 'up' : 'dn'}">${B.cond > 0 ? '▲' : '▼'}</em>` : ''}</small><b>${esc(B.name)}</b><em>${esc(batterLine(B))}</em></button>
    <button type="button" class="np np-p" data-sk="stats" style="--tc:${G.teams[fi].color}" aria-label="투수 ${esc(P.name)} 능력치 보기"><small>${P.hand === 'L' ? '좌투' : '우투'} · ${P.n}구</small><b>${esc(P.name)}</b><span class="sta ${col}"><i style="width:${Math.max(4, left)}%"></i></span></button>`;
}
// 선택지 단추 (경기 화면): 중요한 것은 큰 칸, 메뉴 성격은 아래 작은 단추
function optIcon(o){
  const t = o.t;
  const k = /^강하게|풀스윙/.test(t) ? 'power' : /^맞히기/.test(t) ? 'contact' : /^지켜보기|^지켜/.test(t) ? 'take' : /번트/.test(t) ? 'bunt' : /도루|대주자|히트 앤드 런/.test(t) ? 'run'
    : /^치기|보통 치기|스윙|타자에게|적극|대타/.test(t) ? 'swing' : /노림수|노려/.test(t) ? 'target' : /사인대로|포수/.test(t) ? 'sign' : /수비 위치/.test(t) ? 'field' : /작전|고의|견제|교체/.test(t) ? 'flag'
    : /지난 공/.test(t) ? 'repeat' : /더 보기/.test(t) ? 'more' : /상황/.test(t) ? 'info' : /승부|유인구|던지|공을/.test(t) ? 'ball' : /자동 재생 멈/.test(t) ? 'pause' : /자동 재생/.test(t) ? 'play' : /^다음|끝까지/.test(t) ? 'next' : /채팅|음성/.test(t) ? 'chat' : '';
  return k ? skIco(k) : '';
}
function pctChips(s){
  const out = []; const re = /([가-힣A-Za-z ]{1,10}?)\s?(\d{1,3})%/g; let m;
  while((m = re.exec(s || '')) && out.length < 4) out.push([m[1].replace(/^(의|은|는|이|가)\s/, '').trim().replace(/^.*\s(\S+)$/, '$1'), Number(m[2])]);
  if(out.length < 2) return '';
  const sum = out.reduce((a, x) => a + x[1], 0), COL = ['#ff5d6c', '#ffcf33', '#3ddc84', '#3fa9ff'];
  return `<span class="pct">${out.map(([n, v]) => `${esc(n)} <b>${v}%</b>`).join(' · ')}${sum >= 95 && sum <= 105 ? `<span class="pbar">${out.map(([, v], i) => `<i style="width:${v}%;background:${COL[i]}"></i>`).join('')}</span>` : ''}</span>`;
}
function optsHTML(S, game){
  const want = (S.opts || []).filter(o => !o.hide);
  const minor = game ? want.filter(o => o.key === 'status' || MINOR.test(o.t)) : [];
  const major = want.filter(o => !minor.includes(o));
  const list = major.length > 6 || major.some(o => (o.s || '').length > 60 || /\d+%.*\d+%/.test(o.s || '')) || !game;
  const tile = o => {
    const pc = game ? pctChips(o.s) : '';
    return `<button type="button" class="tile${o.cls === 'z' ? ' z' : ''}" data-sk="opt" data-n="${o.n}"><span class="num">${o.n}</span>${optIcon(o)}<span class="tx"><b>${esc(o.t)}</b>${pc || (o.s ? `<small>${esc(o.s)}</small>` : '')}</span></button>`;
  };
  return `<div class="tiles${list ? ' list' : ''}${major.length === 1 ? ' one' : ''}">${major.map(tile).join('')}</div>`
    + (minor.length ? `<div class="minors">${minor.map(o => `<button type="button" class="mn" data-sk="opt" data-n="${o.n}">${optIcon(o)}<span>${esc(o.t.replace(/^작전: /, '작전 · '))}</span></button>`).join('')}</div>` : '');
}
// 정해진 자리에 놓는 선택지(코스·높이·붙이기·방 코드 숫자판)
function gridHTML(S){
  const want = (S.opts || []).filter(o => !o.hide), placed = want.filter(o => o.pos), rest = want.filter(o => !o.pos);
  const rows = placed.length ? Math.max(...placed.map(o => o.pos[0])) + 1 : 0;
  const cells = placed.map(o => `<button type="button" class="gc" style="grid-row:${o.pos[0] + 1};grid-column:${o.pos[1] + 1}" data-sk="opt" data-n="${o.n}"><b>${esc(o.t)}</b>${o.s ? `<small>${esc(o.s)}</small>` : ''}</button>`).join('');
  const noPos = !placed.length ? want.filter(o => o.cls === 'z') : [];
  const pad = noPos.map(o => `<button type="button" class="gc key" data-sk="opt" data-n="${o.n}"><b>${esc(o.t)}</b></button>`).join('');
  const others = (placed.length ? rest : want.filter(o => o.cls !== 'z'));
  return `<div class="gridz${placed.length ? '' : ' pad'}" style="${rows ? `grid-template-rows:repeat(${rows}, minmax(0, 1fr))` : ''}">${cells}${pad}</div>${others.length ? optsHTML({ opts: others }, true) : ''}`;
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
    <button type="button" class="sk-go def" data-sk="throw"${ready ? '' : ' disabled'}>${skIco('ball')}<span><b>던지기</b><small>${esc(sum)}</small></span></button>
    <div class="minors">${util.map(o => `<button type="button" class="mn" data-sk="opt" data-n="${o.n}">${optIcon(o)}<span>${esc(o.t.replace(/^작전: /, '작전 · ').replace('포수 사인대로 던지기', '포수 사인대로'))}</span></button>`).join('')}</div>`;
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
    return `<button type="button" class="bt bt-${optIcon(o) ? (o.t === '치기' ? 'swing' : /강하게/.test(o.t) ? 'power' : /맞히기/.test(o.t) ? 'contact' : /지켜/.test(o.t) ? 'take' : 'swing') : 'swing'}" data-sk="${tmg && swing ? 'bat' : 'opt'}" data-n="${o.n}">${optIcon(o)}<b>${esc(o.t)}</b>${tmg && swing ? '<em class="tmb">타이밍</em>' : ''}<small>${esc(o.s || '')}</small></button>`;
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
      ball.style.top = `${30 + kk * 52 + drop}%`;
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
  return `<div class="bar">${S.back ? `<button type="button" class="sk-ib" data-sk="back" aria-label="뒤로">${skIco('back')}</button>` : '<span class="logo-s" aria-hidden="true">⚾</span>'}
    <b class="ttl">손잡다 야구</b>
    ${canFs ? `<button type="button" class="sk-ib" data-sk="fs" aria-label="${fsOn ? '전체화면 끄기' : '전체화면 켜기'}">${skIco(fsOn ? 'fsx' : 'fs')}</button>` : ''}
    ${S.hero ? `<button type="button" class="sk-ib" data-sk="menu" aria-label="설정">${uiGlyph('설정')[1]}</button>` : ''}</div>`;
}
function menuHTML(S){
  const out = [];
  if(S.hero) out.push(`<div class="hero"><div class="hero-art" aria-hidden="true"></div><div class="hero-tx"><span class="kick">듣고 보고 고르는 확률 야구</span><h1>손잡다<br>야구</h1></div></div>`);
  if(S.top) out.push(`<div class="mtop">${S.top}</div>`);
  if(S.say && S.say.length) out.push(`<div class="say">${S.say.map(l => `<p class="${l.k ? 'k-' + l.k : ''}">${esc(l.s || l)}</p>`).join('')}</div>`);
  if(S.note && !S.hero) out.push(`<div class="mnote">${S.note.map(l => `<p>${esc(l)}</p>`).join('')}</div>`);
  const q = skQ(S.q);
  if(!S.hero) out.push(`<h2 class="mq">${S.onTab ? '설정' : `${q.sub ? `<small>${esc(q.sub)}</small>` : ''}${esc(q.main || q.chip)}`}</h2>`);
  if(S.input){
    const buf = UI.codeBuf || '';
    out.push(`<div class="code">${[0, 1, 2, 3].map(i => `<span class="${buf[i] ? 'on' : ''}">${esc(buf[i] || '')}</span>`).join('')}</div>`);
    const keys = (S.opts || []).filter(o => !o.hide);
    out.push(`<div class="keypad">${keys.map(o => `<button type="button" class="key" data-sk="opt" data-n="${o.n}">${esc(o.t)}</button>`).join('')}<button type="button" class="key del" data-sk="back">지우기</button></div>`);
    return out.join('');
  }
  if(S.focusCmd || S.onText) out.push(`<form id="skForm" class="sk-form" autocomplete="off"><input id="skIn" type="text" maxlength="40" placeholder="여기에 적으세요" enterkeyhint="done" autocapitalize="off" spellcheck="false"><button type="submit" class="sk-btn pri">확인</button></form>`);
  if(S.grid) out.push(gridHTML(S));
  else out.push(menuOpts(S));
  return out.join('');
}
function menuOpts(S){
  const want = (S.opts || []).filter(o => !o.hide && !(S.onTab && /^다음 탭:/.test(o.t)));   // 설정 탭은 위 탭 줄로 옮김
  if(!want.length) return '';
  const sets = want.filter(o => /^([^:]{2,24}):\s*(.+)$/.test(o.t)).length;
  const setList = sets * 2 >= want.length && sets > 0;
  const team = o => typeof TEAMS !== 'undefined' && TEAMS.find(T => o.t === T.name || o.t.startsWith(T.name + ' ') || o.t.startsWith(T.name + ',') || o.t === T.short);
  const teams = want.filter(team).length >= 4;
  const cards = want.map(o => {
    const T = team(o);
    if(teams && T) return `<button type="button" class="card team" style="--tc:${T.color}" data-sk="opt" data-n="${o.n}"><span class="emb big">${esc(T.short[0])}</span><span class="tx"><b>${esc(T.name)}</b><small>${esc(o.s || '')}</small></span><span class="num">${o.n}</span></button>`;
    const m = /^([^:]{2,24}):\s*(.+)$/.exec(o.t);
    if(setList && m){
      const v = m[2], on = /^(켬|켜짐)$/.test(v), off = /^(끔|꺼짐|읽지 않음)$/.test(v);
      return `<button type="button" class="card row" data-sk="opt" data-n="${o.n}"><span class="tx"><b>${esc(m[1])}</b>${o.s ? `<small>${esc(o.s)}</small>` : ''}</span><span class="val${on ? ' on' : off ? ' off' : ''}">${on || off ? `<i class="sw${on ? ' on' : ''}"></i>` : ''}${esc(v)}</span></button>`;
    }
    const g = uiGlyph(o.t);
    return `<button type="button" class="card${S.hero ? ' hero-c' : ''}${S.hero && /이어하기/.test(o.t) ? ' wide pri' : ''}" data-sk="opt" data-n="${o.n}">${g ? `<span class="gico g-${g[0]}" aria-hidden="true">${g[1]}</span>` : ''}<span class="tx"><b>${esc(o.t)}</b>${o.s ? `<small>${esc(o.s)}</small>` : ''}</span><span class="num">${o.n}</span></button>`;
  }).join('');
  return `<div class="cards${S.hero ? ' home' : ''}${teams ? ' teams' : ''}${setList ? ' sets' : ''}">${cards}</div>`;
}

/* ---------- 창 (메모·점수표·능력치) ---------- */
function skinNote(lines, html, title){
  skinInit();
  const sh = $('#skSheet');
  SK.sheet = html ? 'custom' : 'note'; SK.sheetMake = UI.make;
  sh.innerHTML = `<div class="sh-back" data-sk="shx"></div><div class="sh-box" role="dialog" aria-modal="true" aria-label="${esc(title || '알림')}">
    ${title ? `<h3>${esc(title)}</h3>` : ''}<div class="sh-body">${html || (lines || []).map(l => `<p>${esc(l)}</p>`).join('')}</div>
    <button type="button" class="sk-btn pri" data-sk="shx">닫기</button></div>`;
  sh.hidden = false;
  setTimeout(() => { const b = sh.querySelector('.sk-btn'); if(b) b.focus({ preventScroll:true }); }, 30);
}
function skinSheetClose(silent){
  const sh = $('#skSheet'); if(!sh) return;
  sh.hidden = true; sh.innerHTML = ''; SK.sheet = null;
  if(!silent) UI.note = null;
}
function statsSheet(){
  const host = document.createElement('div'); host.className = 'sk-stats';
  gstatRender(G, host); host.hidden = false;
  skinNote(null, host.innerHTML, '타자와 투수');
}

/* ---------- 누르기 ---------- */
function skinClick(e){
  const b = e.target.closest && e.target.closest('[data-sk]');
  if(!b || !(b.closest('#sk') || b.closest('#skSheet'))) return;
  if(document.documentElement.classList.contains('hold') && b.closest('#skBody')) return;   // 결과를 기다리는 동안은 고르지 않음
  const a = b.dataset.sk;
  if(a === 'tswing'){ timingTap(); return; }
  if(SK.tm) return;
  if(a === 'opt'){ GS.tm = null; choose(b.dataset.n, 'click'); }
  else if(a === 'back') back('click');
  else if(a === 'menu'){ stopAutoPlay(); openMenu('click'); }
  else if(a === 'talk' && typeof talkScreen === 'function') go(talkScreen, 'click');
  else if(a === 'fs') FS.toggle();
  else if(a === 'box' && G) skinNote(null, lineScoreHTML() + `<p class="sh-sit">${esc(situation(G))}</p>`, '점수표');
  else if(a === 'stats' && G) statsSheet();
  else if(a === 'shx') skinSheetClose();
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
