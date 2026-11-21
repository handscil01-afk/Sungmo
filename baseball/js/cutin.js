'use strict';
/* ===================== 그림 위 잠깐 띄우는 장면 (화면 보며 하기) =====================
   컷인(홈런·만루 홈런·끝내기: img/cutin.png 띠 + 타자 얼굴 크게), 날씨 글자 띠(img/wbands.png), 경기 시작 날씨 알림을
   차례(SHOW.q)대로 #skStage 위에 띄움. 경기 계산·진행은 기다리지 않음(눈으로 보는 꾸밈만). 누르면 바로 닫힘.
   자동 시험(Playwright)에서는 window.__show를 켠 때만 띄움 (ui.js의 __susp와 같은 방식) */
const SHOW = { q:[], cur:null, el:null, t:0, poll:0 };
const showOn = () => typeof VIEW !== 'undefined' && VIEW.gfx && !(navigator.webdriver && !window.__show);
// item: { kind, html() 또는 html 글, ms 보이는 시간, after 이 움직임(GX.anim)이 끝난 뒤, idle 그림 움직임이 쉴 때, cls }
function showPush(item){
  if(!showOn()) return;
  item.at = performance.now();
  SHOW.q.push(item);
  if(SHOW.q.length > 6) SHOW.q.splice(0, SHOW.q.length - 6);
  showPump();
}
function showClear(){ SHOW.q = []; showClose(); }
function showReady(it){
  if(performance.now() - it.at > 9000) return true;   // 너무 오래 기다리면 그냥 띄움
  const A = typeof GX !== 'undefined' ? GX.anim : null;
  if(it.after) return A !== it.after;
  if(it.idle) return !showHost() || !A || A.kind === 'card' || A.kind === 'review';   // 그림판이 없는 화면(리그 첫 화면)은 바로
  return true;
}
function showPump(){
  if(SHOW.cur || SHOW.poll) return;
  const it = SHOW.q[0]; if(!it) return;
  if(!showReady(it)){ SHOW.poll = setTimeout(() => { SHOW.poll = 0; showPump(); }, 120); return; }
  SHOW.q.shift(); showOpen(it);
}
function showHost(){
  const st = document.getElementById('skStage');
  return st && !st.hidden && st.offsetHeight > 20 ? st : null;
}
function showOpen(it){
  const host = showHost(), el = document.createElement('div');
  el.className = `sh-ov ${host ? 'in' : 'fix'} sh-${it.kind || 'x'}`;
  el.setAttribute('aria-hidden', 'true');
  el.style.setProperty('--sh-ms', `${it.ms}ms`);
  el.innerHTML = typeof it.html === 'function' ? it.html() : it.html;
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); showClose(); });
  (host || document.body).appendChild(el);
  SHOW.cur = it; SHOW.el = el;
  SHOW.t = setTimeout(showClose, it.ms);
}
function showClose(){
  clearTimeout(SHOW.t); SHOW.t = 0;
  if(SHOW.el && SHOW.el.parentNode) SHOW.el.parentNode.removeChild(SHOW.el);
  const it = SHOW.cur; SHOW.cur = null; SHOW.el = null;
  if(it && it.done) try{ it.done(); } catch(e){}
  if(SHOW.q.length) setTimeout(showPump, 60);
}

/* ---------- 컷인 ---------- */
// who: { p 선수(이름·번호·꾸민 얼굴), team 팀 key, short, color }, kind: 'hr' | 'wo', word 큰 글씨, sub 작은 글씨
function cutinHTML(c){
  const face = typeof playerFace === 'function' && c.p ? playerFace(c.p, c.team, 'big') : '';
  return `<div class="ci ci-${c.kind}" style="--tc:${esc(c.color || '#3b82f6')}"><div class="ci-band"></div>
    <div class="ci-in"><span class="ci-face">${face}</span><span class="ci-tx"><small>${esc(c.short || '')}${c.sub ? ` · ${esc(c.sub)}` : ''}</small><b>${esc(c.p ? c.p.name : '')}</b><strong>${esc(c.word)}</strong></span></div></div>`;
}
function cutinShow(c, after, done){ showPush({ kind:'cut', html: () => cutinHTML(c), ms: c.ms || 1600, after, done }); }
// 결과에서 홈런·끝내기를 찾아 컷인 정보로 (사건 목록 evs, 결과 글 lines의 타자 이름 b, 그 경기 상태 X)
function cutinInfo(X, evs, lines){
  if(!X || !X.teams) return null;
  const end = evs.find(e => e.k === 'game' && e.e === 'end'), wo = !!(end && end.walkoff);
  const runs = evs.filter(e => e.k === 'score').reduce((s, e) => s + (e.n || 0), 0);
  const hr = runs > 0 && evs.some(e => e.k === 'pa' && e.r === 'hr');   // 대기록 알림의 효과음(fx 'hr')과 헷갈리지 않게 득점이 있을 때만
  if(!hr && !wo) return null;
  const name = ((lines || []).filter(l => l && l.k === 'r' && l.b).pop() || {}).b;
  let p = null, ti = X.top ? 0 : 1;
  if(name) X.teams.forEach((T, i) => { const f = [...T.bat, ...(T.gone || [])].find(b => b.name === name); if(f && !p){ p = f; ti = i; } });
  if(!p){ const T = X.teams[ti]; p = T.bat[(T.bi + 8) % 9]; }
  const T = X.teams[ti];
  return { kind: wo ? 'wo' : 'hr', p: p ? { name: p.name, id: p.id, look: p.look } : null, team: T.key, short: T.short, color: T.color, runs,
    word: wo ? '끝내기!' : runs >= 4 ? '만루 홈런!' : '홈런!', sub: wo ? (hr ? (runs >= 4 ? '끝내기 만루 홈런' : '끝내기 홈런') : '끝내기 승리') : runs >= 4 ? '' : `${runs}점 홈런` };
}
// gfx.js gfxStart가 부름: 결과 글씨(배너)가 나온 뒤 컷인을 띄움
function cutinCheck(evs, pre, lines, A){
  if(!showOn() || typeof G === 'undefined' || !G) return;
  const c = cutinInfo(G, evs || [], lines);
  if(c) cutinShow(c, A);
}
