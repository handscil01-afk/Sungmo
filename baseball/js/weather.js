'use strict';
/* ===================== 날씨 · 우천 취소 · 우천 중단 · 콜드게임 =====================
   경기 계산의 난수(G.rng, L.rng)는 쓰지 않음: 날씨는 경기·리그마다 따로 정한 씨앗(해시)으로 정해서, 같은 경기 결과가 날씨 때문에 달라지지 않음.
   - 리그·육성 정규 시즌 경기는 가끔 우천 취소(돔구장 빼고, 다시 하는 경기는 시즌 끝에 덧붙임). league.js leagueAdvance가 wxRainout을 부름
   - 내가 직접 하는 리그·육성 경기는 가끔 경기 중 비로 중단: 다시 하거나, 5회(짧은 경기는 그만큼)를 마쳤으면 강우 콜드게임
   - 콜드게임 설정(SET.mercy, 기본 끔): 9이닝 경기에서 7회 이후 10점 차 이상이면 끝 (engine.js endHalf, G.mercy)
   - 화면 보며 하기: 점수판 옆 날씨 아이콘(img/weather.png), 비가 오면 그림판에 빗줄기, 글자 띠(img/wbands.png)
   자동 시험(Playwright)에서는 window.__show를 켠 때만 비가 옴 (window.__wx로 정해 줄 수 있음) */
const WX_NAME = { sun:'맑음', cloud:'흐림', rain:'비', night:'맑은 밤', dome:'돔구장' };
const WX_ICO = { sun:0, cloud:1, rain:2, night:3 };
const WX_BAND = { cancel:0, stop:1, cold:2, resume:3 };
const WX_RAINOUT = 0.035, WX_DELAY = 0.1;
function wxHash(s){ let h = 2166136261; for(const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); return (h ^ (h >>> 15)) >>> 0; }
const wxRand = s => wxHash(s) / 4294967296;
// 비가 오는 기능을 쓰는지 (설정, 자동 시험)
const wxRainOn = () => typeof SET !== 'undefined' && SET.weather !== false && !(typeof navigator !== 'undefined' && navigator.webdriver && !window.__show);

/* ---------- 우천 취소 (리그 날짜에 정함) ---------- */
// 같은 리그·날짜·경기면 언제 물어도 같은 답 (리그 씨앗 L.wxs는 처음 쓸 때 한 번 정함)
function wxRainout(L, g){
  if(!L || L.phase !== 'season' || !g || g.mk || g.rain || !wxRainOn()) return false;
  if(typeof parkInfo === 'function' && parkInfo(g.h).dome) return false;
  if(L.wxs == null) L.wxs = (L.rng ^ 0x2f6b1d3) >>> 0;
  const force = typeof window !== 'undefined' && window.__wx && window.__wx.rainout;
  if(force) return g.a === L.my || g.h === L.my;
  return wxRand(`${L.wxs}|${L.season}|${L.day}|${g.a}|${g.h}`) < WX_RAINOUT;
}
// 취소된 경기를 시즌 끝에 덧붙임: 마지막 날이 다시 하는 경기만 있고 두 팀 모두 비어 있으면 그날에, 아니면 새 날
function wxPostpone(L, g){
  g.rain = 1;
  const last = L.sched[L.sched.length - 1], mk = { a: g.a, h: g.h, mk:1 };
  if(last && last !== L.sched[L.day] && last.every(x => x.mk) && !last.some(x => [x.a, x.h].some(k => k === g.a || k === g.h))) last.push(mk);
  else L.sched.push([mk]);
}
const wxCancelText = g => `${teamName(g.a)} 대 ${teamName(g.h)}, 우천 취소`;
// 내 경기를 하려고 할 때 비로 취소되면 하루를 넘기고 첫 화면으로 (리그·육성 함께). 돌려주는 값: 취소했는지
function wxRainDay(L, g, via){
  if(!wxRainout(L, g)) return false;
  const out = [`오늘 ${parkInfo(g.h).name}에 비가 많이 내려 ${teamName(g.a)} 대 ${teamName(g.h)} 경기가 우천 취소되었습니다. 이 경기는 정규 시즌 끝에 다시 합니다.`];
  const all = leagueAdvance(L, null), others = all.filter(x => !x.includes(teamName(L.my)));
  if(others.length) out.push(`오늘의 다른 경기: ${others.join(', ')}.`);
  if(typeof LSRC !== 'undefined' && LSRC === 'career' && typeof careerAfterDay === 'function') out.push(...careerAfterDay(L));
  else out.push(...leagueNews(L));
  saveLeague();
  wxBandShow('cancel');
  go(lhome(), via, out);
  return true;
}

/* ---------- 경기 날씨 ---------- */
// 이번 경기에 비가 올 수 있는지: 내가 하는 리그·육성 경기 (올스타·온라인 빼고)
const wxRainGame = G => !!(G.league || G.career) && !G.allstar && !(typeof NET !== 'undefined' && NET.on) && wxRainOn();
function wxInit(G){
  const pk = parkOf(G), s = wxHash(`${G.at}|${G.teams[0].key}|${G.teams[1].key}|${G.innings}`);
  const r = k => wxRand(`${s}|${k}`);
  const W = { s, k: pk.dome ? 'dome' : G.night ? 'night' : r('k') < 0.3 ? 'cloud' : 'sun' };
  const force = typeof window !== 'undefined' && window.__wx;
  if(!pk.dome && wxRainGame(G) && (force ? force.at != null : r('rain') < WX_DELAY)){
    W.at = force && force.at != null ? G.half + force.at : G.half + 4 + Math.floor(r('at') * Math.max(1, G.innings * 2 - 6));
    W.call = force && force.call != null ? !!force.call : r('call') < 0.5;
    if(!G.night) W.k = 'cloud';
  }
  // 콜드게임(설정): 9이닝 경기에서만. 온라인은 방장 기기의 설정
  if(typeof SET !== 'undefined' && SET.mercy && G.innings === 9 && !(typeof NET !== 'undefined' && NET.on && NET.role === 'guest')) G.mercy = 1;
  G.wx = W;
  const fresh = !G.pa && !G.pitchNo && !G.half;
  const say = pk.dome ? '돔구장이라 날씨와 상관없이 경기합니다.' : `오늘 날씨는 ${WX_NAME[W.k]}입니다.${W.at != null ? ' 비 예보가 있습니다.' : ''}`;
  if(fresh) wxToast(G);
  return [say + (G.mercy ? ' 7회 이후 10점 차가 나면 콜드게임으로 끝납니다.' : '')];
}
const wxKind = X => { const W = X && X.wx; return !W || W.k === 'dome' ? null : W.on ? 'rain' : W.k; };
const wxRaining = X => !!(X && X.wx && X.wx.on);
// gameNext가 결과를 보여 주기 전에 부름: 처음이면 날씨를 정하고, 비 올 때가 되면 경기를 멈췄다가 다시 하거나 끝냄. 돌려주는 값: 덧붙인 결과
function wxTick(G, res){
  if(!G || !G.teams) return res;
  const add = (lines, r) => {
    const base = res || { lines:[], fx:[], events:[] };
    return { ...base, lines:[...(base.lines || []), ...lines, ...(r ? r.lines : [])], fx:[...(base.fx || []), ...(r ? r.fx : [])], events:[...(base.events || []), ...(r ? r.events : [])] };
  };
  if(typeof NET !== 'undefined' && NET.on && NET.role === 'guest') return res;
  if(!G.wx){
    const say = wxInit(G);
    res = add(say.map(s => { G.log.push({ s, k:'i', n: ++G.seq }); return { s, k:'i' }; }));
  }
  const W = G.wx;
  if(G.over && G.called && !W.cs){ W.cs = 1; if(G.called === 'mercy') wxBandShow('cold'); }
  if(W.on && W.off != null && G.half >= W.off){ W.on = 0; W.k = 'cloud'; }
  if(W.at == null || W.done || G.over || G.pre || G.review || G.pendingThrow || G.pitchNo || G.half < W.at) return res;
  // 비로 경기 중단
  W.done = 1; W.on = 1;
  emit(G, `${halfName(G)}, 갑자기 비가 쏟아집니다. 심판이 경기를 잠시 멈춥니다. 우천 중단입니다.`, 'i');
  const need = Math.ceil(G.innings * 5 / 9), done = G.inning - 1;
  if(W.call && done >= need){
    G.called = 'rain'; W.cs = 1;
    emit(G, `한참을 기다려도 비가 그치지 않습니다. ${done}회까지 마쳐서 지금 점수로 경기를 끝냅니다. 강우 콜드게임입니다.`, 'i');
    gameOver(G);
    wxBandShow('stop'); wxBandShow('cold');
  } else {
    emit(G, `30분쯤 기다리자 빗줄기가 약해졌습니다. 그라운드를 정리하고 경기를 다시 시작합니다. ${halfName(G)}, ${batTeam(G).short}의 공격입니다.`, 'i');
    W.off = G.half + 2;
    wxBandShow('stop'); wxBandShow('resume');
  }
  return add([], flush(G));
}

/* ---------- 화면 보며 하기 ---------- */
function wxBandShow(key){
  if(typeof showPush !== 'function') return;
  const i = WX_BAND[key];
  showPush({ kind:'band', idle:true, ms: key === 'cancel' ? 2200 : 1700, html:`<div class="wb" style="background-position:${i * 100 / 3}% 0"><span class="sr-only">${['우천 취소', '우천 중단', '콜드게임', '경기 재개'][i]}</span></div>` });
}
function wxIcoHTML(k, cls = ''){ return k in WX_ICO ? `<span class="wx-ico ${cls}" style="background-position:${WX_ICO[k] * 100 / 3}% 0" aria-hidden="true"></span>` : ''; }
// 경기 시작: 날씨 아이콘과 이름, 구장
function wxToast(G){
  const k = wxKind(G); if(!k || typeof showPush !== 'function') return;
  showPush({ kind:'wx', idle:true, ms:1800, html: () => `<div class="wt">${wxIcoHTML(k, 'big')}<span><b>${esc(WX_NAME[k])}${G.wx.at != null ? ' · 비 예보' : ''}</b><small>${esc(parkOf(G).name)}</small></span></div>` });
}
// 점수판 아래 오른쪽 작은 아이콘 (skin.js skOvHTML)
function wxHudHTML(X){ const k = wxKind(X); return k ? `<span class="wx-hud${k === 'rain' ? ' on' : ''}" title="${esc(WX_NAME[k])}">${wxIcoHTML(k)}</span>` : ''; }
// 그림판 위 빗줄기 (gfx.js gfxDraw 끝에서). 256×224 좌표
function wxDraw(X){
  if(!wxRaining(X) || typeof GX === 'undefined' || !GX.ctx) return;
  const ctx = GX.ctx, t = performance.now() / 1000;
  ctx.save();
  ctx.fillStyle = 'rgba(20,30,60,0.18)'; ctx.fillRect(0, 0, 256, 224);
  ctx.strokeStyle = 'rgba(200,220,255,0.75)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for(let i = 0; i < 70; i++){
    const sp = 180 + (i * 37) % 90, x0 = (i * 53.3) % 276, y = ((i * 97) % 240 + t * sp) % 240 - 12, x = (x0 - (y + 12) * 0.18 + 276) % 276 - 10;
    ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 7);
  }
  ctx.stroke();
  ctx.restore();
}
