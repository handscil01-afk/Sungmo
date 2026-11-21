'use strict';
/* ===================== 화면 보며 하기: 미니게임 그림 (mini.js의 kind mg-*) =====================
   화면 정의(mini.js)는 그대로 두고 그림만 그림. 누르면 data-sk="opt"로 choose(번호)를 불러 소리와 글로 하기와 같은 길로 진행.
   - 타이밍을 재는 동안(MG.run)은 큰 단추(data-mg="tap")나 그림판을 누르는 순간(pointerdown)을 잼. 공·투수 움직임은 requestAnimationFrame으로 MG.run의 시각을 따라 그림
   - 타격 연습장: img/cr-cage.png 위에 피칭 머신 공 → 동그라미, 타자 그림(batter.png). 번트·도루: img/bg-field.png 내야를 잘라 위에서 본 모습
   - 결과는 CSS 애니메이션(공이 날아감, 주자가 달림)과 결과 글씨(banners.png) */
const SKM = { raf:0 };
const mgCol = () => { try{ if(MG.from === 'career' && typeof crL === 'function' && crL()) return crColor(crL()); }catch(e){} return '#2f74e0'; };
// 도트 그림 한 칸: n칸 × rows줄 그림에서 f번째 칸. w는 그림판 너비에 대한 %
function mgSpr(name, f, n, rows = 1, row = 0, cls = '', pos = '', id = ''){
  const url = skTint(name, mgCol());
  return `<i${id ? ` id="${id}"` : ''} class="mg-spr s-${name} ${cls}" style="background-image:url(${url});background-size:${n * 100}% ${rows * 100}%;background-position:${n > 1 ? f * 100 / (n - 1) : 0}% ${rows > 1 ? row * 100 / (rows - 1) : 0}%;${pos}" aria-hidden="true"></i>`;
}
// 내야 그림(bg-field.png를 홈~2루로 자른 것)에서 자리(%)
const MGF = { home:[50, 87], b1:[78.8, 48.1], b2:[50, 22.6], b3:[21, 48.1], mound:[50, 51.9] };
const mgAt = (p, extra = '') => `left:${p[0]}%;top:${p[1]}%;${extra}`;
const mgLerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
// 결과 글씨(img/banners.png 13줄): 헛스윙 2 · 파울 3 · 안타 4 · 2루타 5 · 3루타 6 · 홈런 7 · 아웃 8 · 세이프 11
const mgBan = (row, cls = '') => `<span class="mg-ban ${cls}" style="--r:${row}" aria-hidden="true"></span>`;
const MG_BAN_ROW = { hr:7, b3:6, b2:5, hit:4, foul:3, whiff:2, out:8, safe:11, pop:8, miss:2 };

/* ---------- 작은 그림(목록·설명·결과 카드) ---------- */
function mgThumb(g, cls = ''){
  if(g === 'bat') return `<span class="mg-thumb t-bat ${cls}" aria-hidden="true">${mgSpr('batter', 1, 4, 1, 0, 'th-bat')}</span>`;
  if(g === 'bunt') return `<span class="mg-thumb t-fld ${cls}" aria-hidden="true">${mgSpr('batter', 3, 4, 1, 0, 'th-bunt')}<i class="mg-dotb" style="left:38%;top:70%"></i></span>`;
  return `<span class="mg-thumb t-fld t-steal ${cls}" aria-hidden="true">${mgSpr('run-b', 1, 4, 1, 0, 'th-run flip')}</span>`;
}
const mgRecChip = g => { const a = mgBest(g, 'tm'), b = mgBest(g, 'pick'); return a || b ? `${a ? `<em>최고 ${a.best}점</em>` : ''}${b ? `<em class="c">고르기 ${b.best}점</em>` : ''}` : '<em class="no">기록 없음</em>'; };

/* ---------- 미니게임 목록 ---------- */
function mgHomeSkin(S){
  const cards = (S.opts || []).filter(o => !o.hide && MG_GAMES[o.key]).map(o => `<button type="button" class="mg-card" data-sk="opt" data-n="${o.n}">${mgThumb(o.key)}<span class="tx"><b>${esc(o.t)}</b><small>${esc(MG_GAMES[o.key].short)}</small><span class="mg-rc">${mgRecChip(o.key)}</span></span></button>`).join('');
  const out = (S.opts || []).find(o => o.key === 'out');
  return `<div class="mg-cards">${cards}</div>${out ? `<div class="mback"><button type="button" class="gb b" data-sk="opt" data-n="${out.n}">${skIco('back')}${esc(out.t)}</button></div>` : ''}`;
}
/* ---------- 설명 화면 ---------- */
function mgStartSkin(S){
  const g = MG_GAMES[S.g], op = k => (S.opts || []).find(o => o.key === k && !o.hide);
  const tm = op('tm'), pk = op('pick'), hr = op('hear'), ls2 = op('list');
  const heard = (S.say || []).length && (S.say[0].s || S.say[0]) !== g.rules[0] ? `<div class="crmsg">${S.say.map(l => `<p>${esc(l.s || l)}</p>`).join('')}</div>` : '';
  return `<div class="mg-intro">${mgThumb(S.g, 'big')}<div class="mg-it"><b>${esc(g.name)}</b><small>${esc(g.short)}</small><span class="mg-rc">${mgRecChip(S.g)}</span></div></div>
    ${heard}${listHTML(g.rules, 'mg-rules')}
    ${tm ? `<button type="button" class="crplay" data-sk="opt" data-n="${tm.n}"><span class="pp">▶</span><span><b>${esc(tm.t)}</b><small>${esc(tm.s)}</small></span></button>` : ''}
    <div class="minors">${[pk, hr, ls2].filter(Boolean).map(o => `<button type="button" class="mn" data-sk="opt" data-n="${o.n}"><span>${esc(o.t)}</span></button>`).join('')}</div>`;
}

/* ---------- 놀이 화면 ---------- */
function mgDotCls(r){ return { hr:'hr', b3:'xb', b2:'xb', hit:'h', foul:'f', perfect:'hr', good:'h', weak:'f', safe:'h', out:'x', whiff:'x', miss:'x', pop:'x' }[r.k] || 'n'; }
function mgPlaySkin(S){
  const st = MG.st; if(!st) return null;
  const g = MG_GAMES[st.g], best = st.best0 ? st.best0.best : null, live = st.phase === 'live';
  const dots = Array.from({ length: st.n }, (_, i) => `<i class="${i < st.i ? 'd-' + mgDotCls(st.log[i]) : i === st.i && st.phase !== 'end' ? 'now' : ''}"></i>`).join('');
  const hud = `<div class="mg-hud"><span class="mg-dots" aria-hidden="true">${dots}</span><span class="mg-n">${Math.min(st.i + (st.phase === 'end' ? 0 : 1), st.n)}/${st.n}</span>
    <span class="mg-sc"><small>점수</small><b>${st.score}</b></span><span class="mg-bs"><small>최고</small><b>${best ?? '-'}</b></span></div>`;
  const stage = st.g === 'bat' ? mgCage(st) : st.g === 'bunt' ? mgBuntField(st) : mgStealField(st);
  // 알림 줄: 지금 할 일 또는 방금 결과
  const last = st.last, fresh = last && !live;
  const msg = live ? (st.g === 'steal' ? '둥(투구)에 뛰고, 딱딱(견제)에는 참으세요!' : '삐 소리 · 노란 동그라미에 맞춰 누르세요!')
    : fresh ? last.text : st.g === 'bat' ? (st.mode === 'tm' ? '공 던지기를 누르면 피칭 머신이 던집니다.' : `코치: "${st.hint}"`) : st.g === 'bunt' ? mgDefText(st.def) + ' 방향을 고르세요.' : '리드를 고르면 투수가 세트에 들어갑니다.';
  const msgCls = fresh ? (last.pts >= 10 ? 'top' : last.pts > 0 ? 'ok' : 'bad') : live ? 'live' : '';
  if(live && !SKM.raf) SKM.raf = requestAnimationFrame(mgTick);
  return `${hud}<div class="mg-wrap" data-mg="${live ? 'tap' : ''}">${stage}</div><p class="mg-msg ${msgCls}" role="status">${esc(msg)}</p><div class="mg-ctl">${mgCtl(S, st)}</div>`;
}
function mgCtl(S, st){
  const os = (S.opts || []).filter(o => !o.hide && o.key !== 'quit');
  if(st.phase === 'live'){
    const lab = { bat:['swing', '스윙!', '삐 소리 · 동그라미에 맞춰'], bunt:['bunt', '번트!', '삐 소리 · 동그라미에 맞춰'], steal:['run', '뛰기!', '둥 소리(투구)에 바로'] }[st.g];
    return `<button type="button" class="mg-go tap" data-mg="tap">${skIco(lab[0])}<b>${lab[1]}</b><small>${lab[2]}</small></button>`;
  }
  if(st.phase === 'end' || (st.g === 'bat' && st.mode === 'tm')){
    const o = os[0]; if(!o) return '';
    return `<button type="button" class="mg-go" data-sk="opt" data-n="${o.n}">${skIco(st.phase === 'end' ? 'flag' : 'play')}<b>${esc(o.t)}</b>${st.phase === 'end' ? `<small>합계 ${st.score}점</small>` : `<small>다음 공: ${esc(st.pitch.name)}</small>`}</button>`;
  }
  if(st.g === 'bat'){
    const pw = os.find(o => o.key === 'pow');
    return `<div class="mg-row c3">${os.filter(o => o.loc != null).map(o => `<button type="button" class="mg-b" data-sk="opt" data-n="${o.n}">${skIco('target')}<b>${esc(MG_LOC[o.loc])}</b><small>노리기</small></button>`).join('')}</div>
      ${pw ? `<button type="button" class="mg-pow" data-sk="opt" data-n="${pw.n}"><small>세기</small>${MG_POW.map((p, i) => `<span class="${i === st.pow ? 'on' : ''}">${esc(p)}</span>`).join('')}</button>` : ''}`;
  }
  if(st.g === 'bunt') return `<div class="mg-row c3">${os.filter(o => o.dir != null).map(o => { const mx = mgBuntMax(o.dir, st.def); return `<button type="button" class="mg-b${mx >= 10 ? ' best' : ''}" data-sk="opt" data-n="${o.n}">${skIco('bunt')}<b>${esc(o.t)}</b><small>최고 ${mx}점</small></button>`; }).join('')}</div>`;
  if(st.phase === 'read'){
    const m = st.moves[st.mi];
    return `<div class="mg-tell">${skIco('take')}<span>${esc(m.tell)}</span></div><div class="mg-row c2">${os.map(o => `<button type="button" class="mg-b${o.key === 'run' ? ' best' : ''}" data-sk="opt" data-n="${o.n}">${skIco(o.key === 'run' ? 'run' : 'pause')}<b>${esc(o.t)}</b></button>`).join('')}</div>`;
  }
  return `<div class="mg-row c3">${os.filter(o => o.lead != null).map(o => `<button type="button" class="mg-b" data-sk="opt" data-n="${o.n}">${skIco('run')}<b>${esc(o.t)}</b><small>${['느림 · 안전', '알맞음', '빠름 · 위험'][o.lead]}</small></button>`).join('')}</div>`;
}

/* 타격 연습장: 공이 피칭 머신(가운데 위)에서 동그라미(타자 앞)로 */
const MGC = { mach:[50, 46], hit:[52, 73] };
function mgCage(st){
  const L = st.last, live = st.phase === 'live';
  let fx = '', f = 0;
  if(L && !live && L.g === 'bat'){
    f = L.k === 'take' ? 0 : 2;
    const x1 = 50 + (L.x || 0) * 42, end = { hr:[x1, -8, .25], b3:[x1, 6, .3], b2:[x1, 10, .32], hit:[50 + (L.x || 0) * 34, 26, .4], foul:[L.e != null && L.e < 0 ? -6 : 106, 58, .5], whiff:[50, 112, 1.7], take:[50, 112, 1.7] }[L.k];
    fx = `<span class="mg-fly k-${L.k}" style="--x0:${MGC.hit[0]}%;--y0:${MGC.hit[1]}%;--x1:${end[0]}%;--y1:${end[1]}%;--s1:${end[2]}"></span>`
      + (MG_BAN_ROW[L.k] != null ? mgBan(MG_BAN_ROW[L.k]) : `<span class="mg-tx">지켜봄</span>`) + (L.dist ? `<b class="mg-dist">${L.dist}m</b>` : '') + (L.tier === 'perfect' ? '<b class="mg-perf">딱 맞음!</b>' : '');
  }
  const tag = !live && st.phase !== 'end' ? `<span class="mg-tag">${esc(st.mode === 'tm' ? '다음 공 · ' + st.pitch.name : '노릴 코스를 고르세요')}</span>` : '';
  return `<div class="mg-st cage" id="mgSt"><span class="mg-ring${live ? ' on' : ''}" id="mgRing" style="${mgAt(MGC.hit)}"></span>
    ${mgSpr('batter', live ? 0 : f, 4, 1, 0, 'bat-me' + (L && !live && f ? ' swung' : ''), '', 'mgBat')}
    <span class="mg-ball" id="mgBall" style="${mgAt(MGC.mach)}"></span>${fx}${tag}</div>`;
}
// 내야 그림 위 수비수(서 있는 그림)
const mgFielder = (p, cls = '') => mgSpr('fielder-set', 0, 1, 1, 0, 'fld ' + cls, mgAt(p));
/* 번트: 전진한 수비수, 방향별 점수 구역, 공이 굴러가 멈추는 자리 */
function mgBuntField(st){
  const L = st.last, live = st.phase === 'live', def = live || !L ? st.def : st.def;
  const c1 = def === 'c1' ? [67, 62] : [76, 44], c3 = def === 'c3' ? [33, 62] : [24, 44];
  const zone = (d, pts) => { const at = [[59, 74], [41, 74], [50, 66]][d]; return `<span class="mg-zone z${pts >= 10 ? 'a' : pts >= 5 ? 'b' : 'c'}${live && st.dir === d ? ' on' : ''}" style="${mgAt(at)}"><b>${pts}</b></span>`; };
  let fx = '';
  if(L && !live && L.g === 'bunt'){
    const D = L.dir, end = { perfect:[[58, 76], [42, 76], [50, 70]][D], good:[[62, 67], [38, 67], [50, 64]][D], weak:[[68, 59], [32, 59], [50, 56]][D], foul:[[66, 86], [34, 86], [60, 90]][D], pop:[50, 74], miss:[50, 96], none:[50, 96] }[L.k] || [50, 90];
    fx = `<span class="mg-roll k-${L.k}" style="--x0:${MGF.home[0]}%;--y0:${MGF.home[1] - 3}%;--x1:${end[0]}%;--y1:${end[1]}%"></span>`
      + `<span class="mg-tx k-${L.k}">${{ perfect:'완벽한 번트!', good:'좋은 번트', weak:'아쉬운 번트', foul:'파울', pop:'번트 뜬공', miss:'헛스윙', none:'놓침' }[L.k] || ''}${L.pts ? ` +${L.pts}` : ''}</span>`;
  }
  return `<div class="mg-st fld" id="mgSt">${[0, 1, 2].map(d => zone(d, mgBuntMax(d, st.def))).join('')}
    ${mgFielder(c1, def === 'c1' ? 'chg' : '')}${mgFielder(c3, def === 'c3' ? 'chg' : '')}${mgFielder([50, 50], 'p')}
    ${def !== 'none' ? `<span class="mg-chg" style="${mgAt(def === 'c1' ? [67, 62] : [33, 62])}">전진!</span>` : ''}
    <span class="mg-ring sm${live ? ' on' : ''}" id="mgRing" style="${mgAt([50, 83])}"></span>
    ${mgSpr('batter', live ? 3 : L && L.g === 'bunt' && ['perfect', 'good', 'weak', 'foul', 'pop'].includes(L.k) ? 3 : 0, 4, 1, 0, 'bat-bunt', mgAt([45, 92]))}
    <span class="mg-ball sm" id="mgBall" style="${mgAt(MGF.mound)}"></span>${fx}</div>`;
}
/* 도루: 투수(세트 → 견제·투구), 1루 주자 리드, 결과는 2루까지 달림 */
const mgLeadAt = lead => mgLerp(MGF.b1, MGF.b2, [0.09, 0.15, 0.22][lead]);
function mgStealField(st){
  const L = st.last, live = st.phase === 'live';
  const lead = live || st.phase === 'read' ? st.lead : L && L.g === 'steal' ? L.lead : 1;
  const at = mgLeadAt(lead ?? 1);
  let runner = mgSpr('runner-s', 0, 4, 1, 0, 'run-me', mgAt(at), 'mgRun'), fx = '';
  if(L && !live && st.phase !== 'read' && L.g === 'steal'){
    if(L.k === 'safe' || (L.k === 'out' && !L.pickoff)){
      runner = mgSpr('run-b', 1, 4, 1, 0, 'run-me flip mg-dash', `--x0:${at[0]}%;--y0:${at[1]}%;--x1:${MGF.b2[0] + 3}%;--y1:${MGF.b2[1] + 1}%`)
        + mgSpr('slide', 2, 4, 1, 0, 'run-me flip mg-slide', mgAt([MGF.b2[0] + 2, MGF.b2[1] + 1]));
      fx = `<span class="mg-roll throw" style="--x0:${MGF.home[0]}%;--y0:${MGF.home[1] - 2}%;--x1:${MGF.b2[0]}%;--y1:${MGF.b2[1] - 1}%"></span>${mgBan(L.k === 'safe' ? 11 : 8, 'late')}`;
    } else if(L.k === 'out'){
      runner = mgSpr('slide', 2, 4, 1, 0, 'run-me', mgAt([MGF.b1[0] - 2, MGF.b1[1]]));
      fx = `<span class="mg-roll pick" style="--x0:${MGF.mound[0]}%;--y0:${MGF.mound[1] - 4}%;--x1:${MGF.b1[0]}%;--y1:${MGF.b1[1] - 2}%"></span>${mgBan(8)}`;
    } else fx = `<span class="mg-tx">출발 못함${L.pts ? ` +${L.pts}` : ''}</span>`;
  }
  return `<div class="mg-st fld steal" id="mgSt">${mgFielder([MGF.b1[0] + 3, MGF.b1[1] + 2])}${mgFielder([58, 30], 'ss')}${mgFielder([50, 95], 'c')}
    ${mgSpr('pitcher', 0, 4, 3, 0, 'pit', mgAt([MGF.mound[0], MGF.mound[1] + 1]), 'mgPit')}${runner}
    <span class="mg-ball sm" id="mgBall" style="${mgAt(MGF.mound)};opacity:0"></span>${fx}
    ${live ? '<span class="mg-cue" id="mgCue"></span>' : ''}</div>`;
}

/* ---------- 타이밍을 재는 동안 움직임 ---------- */
function mgTick(){
  SKM.raf = 0;
  const r = MG.run; if(!r || r.done || !VIEW.gfx || UI.make !== mgPlay) return;
  const now = performance.now();
  if(r.g === 'steal') mgTickSteal(r, now); else mgTickPitch(r, now);
  SKM.raf = requestAnimationFrame(mgTick);
}
function mgTickPitch(r, now){
  const ball = $('#mgBall'), ring = $('#mgRing'); if(!ball) return;
  const k = (now - r.rel) / r.T, bat = r.g === 'bat';
  if(k < 0){ ball.style.opacity = '0'; return; }
  const kk = Math.min(k, 1.5), a = bat ? MGC.mach : [50, 53], b = bat ? MGC.hit : [50, 83];
  const p = mgLerp(a, b, kk);
  ball.style.opacity = '1'; ball.style.left = p[0] + '%'; ball.style.top = p[1] + '%';
  ball.style.transform = `translate(-50%, -50%) scale(${bat ? 0.3 + kk * 1.1 : 0.7 + kk * 0.6})`;
  if(ring) ring.classList.toggle('hot', Math.abs(k - 1) < 0.1);
}
function mgTickSteal(r, now){
  const pit = $('#mgPit'), ball = $('#mgBall'), run = $('#mgRun'), cue = $('#mgCue'); if(!pit) return;
  const sc = mgFast() ? 0.12 : 1;
  // 지금 보여 줄 동작: 시각이 지난 마지막 동작
  let m = null; r.moves.forEach(x => { if(x.at <= now) m = x; });
  let f = 0, flip = false, bp = null, word = '';
  if(m){
    const t = (now - m.at) / sc;
    if(m.type === 'pick' && t < 900){ f = t < 450 ? 2 : 0; flip = t < 450; bp = t < 450 ? mgLerp(MGF.mound, [MGF.b1[0] + 2, MGF.b1[1] - 2], t / 450) : null; word = '견제!'; }
    else if(m.type === 'pitch'){ f = t < 220 ? 1 : 2; bp = t >= 220 ? mgLerp(MGF.mound, MGF.home, Math.min(1, (t - 220) / 450)) : null; word = '투구!'; }
  }
  pit.style.backgroundPosition = `${f * 100 / 3}% 0%`; pit.classList.toggle('flip', flip);
  if(ball){ ball.style.opacity = bp ? '1' : '0'; if(bp){ ball.style.left = bp[0] + '%'; ball.style.top = (bp[1] - 4) + '%'; } }
  if(run) run.style.backgroundPosition = `${Math.floor(now / 380) % 2 ? 100 / 3 : 0}% 0%`;
  if(cue){ cue.textContent = word; cue.className = 'mg-cue' + (word ? ' on ' + (m.type === 'pick' ? 'pk' : 'pt') : ''); }
}

/* ---------- 결과 화면 ---------- */
function mgResSkin(S){
  const r = MG.res; if(!r) return null;
  const g = MG_GAMES[r.g], op = k => (S.opts || []).find(o => o.key === k && !o.hide);
  const again = op('again'), list = op('list'), out = op('out');
  const newRec = r.isNew && !r.first;
  const conf = newRec ? `<span class="mg-conf" aria-hidden="true">${Array.from({ length:16 }, (_, i) => `<i style="--cx:${(i * 37) % 100}%;--cd:${(i % 5) * 0.18}s;--cc:${['#ffd84d', '#ff6b8a', '#5bd7ff', '#7be39a'][i % 4]}"></i>`).join('')}</span>` : '';
  const lines = mgSummary(r).filter(Boolean);
  return `<div class="mg-res panel${newRec ? ' new' : ''}">${conf}${newRec ? ban3('record', 'mg-rb') : ''}
      <div class="mg-rh">${mgThumb(r.g, 'sm')}<span><small>${esc(g.name)}${r.mode === 'pick' ? ' · 고르기' : ''}</small><b class="mg-big">${r.score}<i>점</i></b></span></div>
      <p class="mg-rp">${esc(newRec ? `이전 최고 ${r.prev}점` : r.first ? '첫 기록!' : `최고 기록 ${r.best}점`)}</p>
      <div class="mg-rl">${lines.map(l => `<p>${esc(l)}</p>`).join('')}</div>
      <div class="mg-dots big" aria-hidden="true">${r.log.map(x => `<i class="d-${mgDotCls(x)}"></i>`).join('')}</div></div>
    ${again ? `<button type="button" class="crplay" data-sk="opt" data-n="${again.n}"><span class="pp">▶</span><span><b>${esc(again.t)}</b><small>${esc(g.name)}</small></span></button>` : ''}
    <div class="mg-row c2">${[list, out].filter(Boolean).map(o => `<button type="button" class="gb b" data-sk="opt" data-n="${o.n}">${esc(o.t)}</button>`).join('')}</div>`;
}

/* ---------- 누르기: 타이밍은 누르는 순간(pointerdown)에 잼 ---------- */
document.addEventListener('pointerdown', e => {
  if(!MG.run || MG.run.done || !VIEW.gfx || UI.make !== mgPlay) return;
  const t = e.target.closest && e.target.closest('[data-mg="tap"], #mgSt');
  if(!t) return;
  e.preventDefault(); mgTap();
}, true);

// 처음 화면 메뉴 아이콘 (미니게임: 방망이와 공)
if(typeof UI_GLYPHS !== 'undefined') UI_GLYPHS.unshift([/^미니게임/, 'o', '<path d="M4 20 14.5 9.5a2.2 2.2 0 0 1 3.1 3.1L7 23"/><circle cx="18.5" cy="5" r="2.5"/><path d="M3 4.5h4M5 2.5v4"/>']);
if(typeof SK_ICON !== 'undefined') Object.assign(SK_ICON, { bunt: SK_ICON.bunt || '<path d="M3 15h18M8 15v4M16 15v4"/><circle cx="12" cy="9" r="3"/>' });
Object.assign(CAREER_SK, { 'mg-home':mgHomeSkin, 'mg-start':mgStartSkin, 'mg-play':mgPlaySkin, 'mg-res':mgResSkin });
