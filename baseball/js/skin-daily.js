'use strict';
/* ===================== 화면 보며 하기: 오늘의 목표·출석 도장·주간 리그 신문 =====================
   화면 정의는 daily.js(dailyScreen)·paper.js(paperScreen)에 있고, 여기서는 그림만 그림. 맞대결 전적은 공통 표(S.table)로 그려짐 */
// 배지 그림(img/badges.png, 64칸 6×4): 19 출석 7일 · 20 출석 30일
const dlBadge = (i, cls = '') => `<span class="dl-bd ${cls}" style="background-position:${(i % 6) * 20}% ${Math.floor(i / 6) * 100 / 3}%" aria-hidden="true"></span>`;
const DL_SHORT = { train:'훈련', visit:'마을', goods:'소모품', hit:'안타', hit2:'안타 2', rbi:'타점', onbase:'볼넷', k:'삼진', zero:'무실점' };
const DL_ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/></svg>';
const PP_ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5h13v13a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v9.5a2 2 0 0 1-4 0M7 9h7M7 12.5h7M7 16h4"/></svg>';
const dlRw = rw => rw.k === 'money' ? `${rw.v}만` : rw.k === 'pts' ? `성장 +${rw.v}` : rw.k === 'fame' ? `인기 +${rw.v}` : `${({ drink:'음료', tape:'테이핑', tonic:'보약' })[rw.id] || '소모품'} ${rw.v}`;
const dlRwIco = rw => rw.k === 'money' ? '<i class="dl-ri m"></i>' : rw.k === 'fame' ? '<i class="dl-ri f">♥</i>' : rw.k === 'pts' ? '<i class="dl-ri p">▲</i>' : '<i class="dl-ri g">✚</i>';

/* ---------- 라커룸에 붙는 띠 (skin-career.js crHome에서 부름) ---------- */
function dailyStrip(L, S){
  const c = L.career; if(!c || c.retired) return '';
  const o = (S.opts || []).find(x => x.key === 'daily' && !x.hide), pp = (S.opts || []).find(x => x.key === 'paper' && !x.hide);
  if(!o && !pp) return '';
  const D = typeof dailyEnsure === 'function' ? dailyEnsure(L) : null, a = attOf(c), can = attCan(c);
  const chips = D && D.goals.length ? D.goals.map(g => `<i class="${g.done ? 'ok' : ''}">${g.done ? '✓ ' : ''}${esc(DL_SHORT[g.id] || g.t)}${!g.done && g.need > 1 ? ` ${g.have}/${g.need}` : ''}</i>`).join('') : '<i class="none">오늘은 목표 없음</i>';
  const goal = o ? `<button type="button" class="dly-g${can ? ' new' : ''}" data-sk="opt" data-n="${o.n}" aria-label="${esc(o.t)}">
      <span class="dly-at">${DL_ICO}<em>${attStamps(a)}/7</em>${can ? '<b class="dot">도장!</b>' : ''}</span>
      <span class="dly-l"><small>오늘의 목표${D && D.goals.length ? ` ${D.goals.filter(g => g.done).length}/${D.goals.length}` : ''}</small><span class="dly-c">${chips}</span></span></button>` : '';
  const paper = pp ? `<button type="button" class="dly-p${pp.unread ? ' new' : ''}" data-sk="opt" data-n="${pp.n}" aria-label="${esc(pp.t)}">${PP_ICO}<b>${pp.unread ? '신문 왔어요' : '신문'}</b></button>` : '';
  return `<div class="dly">${goal}${paper}</div>`;
}
// 리그 첫 화면의 신문 띠 (skin-hub.js lgHomeSkin에서 부름)
function paperBanner(o){
  if(!o) return '';
  return `<button type="button" class="pp-ban${o.unread ? ' new' : ''}" data-sk="opt" data-n="${o.n}">${PP_ICO}<span><b>${esc(o.unread ? '신문이 왔습니다!' : '주간 리그 신문')}</b><small>${esc(o.s.split('.')[0])}</small></span><em>${o.unread ? '새 호' : '보기'}</em></button>`;
}

/* ---------- 오늘의 목표와 출석 도장 (dl-home) ---------- */
function dlHomeSkin(S){
  const L = typeof crL === 'function' ? crL() : null; if(!L || !L.career) return null;
  const c = L.career, a = attOf(c), can = attCan(c), D = dailyEnsure(L);
  const msg = (S.msg || []).length ? `<div class="toast">${S.msg.map(l => esc(l.s || l)).join(' ')}</div>` : '';
  const goals = D && D.goals.length ? D.goals.map(g => `<div class="dl-r${g.done ? ' ok' : ''}"><span class="dl-ck">${g.done ? '✓' : ''}</span><span class="dl-t"><b>${esc(g.t)}</b><span class="fb"><i style="width:${Math.round(g.have / g.need * 100)}%"></i></span></span><span class="dl-rw">${dlRwIco(g.rw)}${esc(dlRw(g.rw))}</span></div>`).join('')
    : `<p class="dl-none">${esc(L.phase === 'season' ? '오늘은 목표가 없습니다.' : '오늘의 목표는 정규 시즌에만 나옵니다.')}</p>`;
  const head = D ? `${D.season}시즌 ${D.day}일째` : '';
  const filled = can ? a.total % 7 : attStamps(a), todayCell = can ? a.total % 7 : -1;   // 도장을 찍기 전에는 이번 카드에 찍은 칸까지(7칸을 다 채웠으면 새 카드)
  const cells = ATT_RW.map((rws, i) => {
    const on = i < filled, big = i === 6;
    return `<span class="dl-s${on ? ' on' : ''}${big ? ' big' : ''}${i === todayCell ? ' now' : ''}"><small>${i + 1}일</small><span class="dl-sr">${rws.map(r => `<em>${dlRwIco(r)}${esc(dlRw(r))}</em>`).join('')}</span>${on ? '<b class="dl-st">출석</b>' : ''}</span>`;
  }).join('');
  const ms = ATT_MS.map(([n, , rw], j) => `<span class="dl-m${a.total >= n ? ' ok' : ''}">${dlBadge(19 + j)}<small>누적 ${n}일</small><span class="fb"><i style="width:${Math.min(100, Math.round(a.total / n * 100))}%"></i></span><b>${Math.min(a.total, n)}/${n}</b></span>`).join('');
  const stamp = (S.opts || []).find(o => o.key === 'stamp' && !o.hide), back = (S.opts || []).find(o => o.key === 'back');
  return `${crRes(L)}${msg}
    <div class="dl-goals panel"><div class="dl-h"><b>오늘의 목표</b><small>${esc(head)}${c.dailyAll ? ` · 모두 이룬 날 ${c.dailyAll}일` : ''}</small></div>${goals}</div>
    <div class="dl-card panel"><div class="dl-h"><b>출석 도장</b><small>누적 ${a.total}일 · ${a.streak}일 연속${a.best > 1 ? ` · 최고 ${a.best}일` : ''}</small></div>
      <div class="dl-ss">${cells}</div><div class="dl-ms">${ms}</div></div>
    <div class="hb c${stamp ? 2 : 1} act">${stamp ? `<button type="button" class="hb-b pri" data-sk="opt" data-n="${stamp.n}">${DL_ICO.replace('<svg', '<svg class="dl-bi"')}<b>출석 도장 찍기</b></button>` : ''}${back ? `<button type="button" class="hb-b" data-sk="opt" data-n="${back.n}">${hubIco('back')}<b>라커룸</b></button>` : ''}</div>`;
}

/* ---------- 주간 리그 신문 (pp-show) ---------- */
function ppShowSkin(S){
  const L = typeof LG === 'function' ? LG() : null; if(!L || !(L.paper || []).length) return null;
  const P = L.paper[S.pi] || L.paper[L.paper.length - 1];
  const face = (m, pit) => {
    if(!m) return `<div class="pp-mv none"><small>${pit ? '이주의 투수' : '이주의 타자'}</small><p>해당 선수 없음</p></div>`;
    const f = findPlayer(L, m.id), p = f ? f.p : { name: m.name, id: m.id };
    return `<div class="pp-mv"><small>${pit ? '이주의 투수' : '이주의 타자'}</small><div class="pp-mf">${typeof playerFace === 'function' ? playerFace(p, m.team, 'mid') : ''}<strong>${esc(m.big)}</strong></div>
      <b>${esc(m.name)}</b><span class="pp-tm">${emb(teamInfo(m.team), 'sm')}${esc(teamInfo(m.team).short)}${m.pos ? ` · ${esc(m.pos)}` : ''}</span><p>${esc(m.line)}</p></div>`;
  };
  const arrow = t => t.prev == null ? '<i class="pp-ar n">·</i>' : t.prev > t.rank ? `<i class="pp-ar up">▲${t.prev - t.rank}</i>` : t.prev < t.rank ? `<i class="pp-ar dn">▼${t.rank - t.prev}</i>` : '<i class="pp-ar">−</i>';
  const half = (list) => `<div class="pp-sc">${list.map(t => `<span class="${t.key === L.my ? 'me' : ''}"><i>${t.rank}</i>${emb(teamInfo(t.key), 'sm')}<b>${esc(teamInfo(t.key).short)}</b>${arrow(t)}<em>${t.w}-${t.l}${t.d ? `-${t.d}` : ''}</em></span>`).join('')}</div>`;
  const ht = P.head.team ? teamInfo(P.head.team) : null;
  const games = P.games.map(g => { const A = teamInfo(g.a), H = teamInfo(g.h); return `<span class="pp-g${g.a === L.my || g.h === L.my ? ' me' : ''}"><small>${g.day}일</small>${emb(A, 'sm')}<b class="${g.ra > g.rh ? 'w' : ''}">${esc(A.short)}</b><strong>${g.ra}:${g.rh}</strong><b class="${g.rh > g.ra ? 'w' : ''}">${esc(H.short)}</b>${emb(H, 'sm')}${g.tag ? `<em>${esc(g.tag)}</em>` : ''}</span>`; }).join('');
  const m = P.my, my = m ? `<div class="pg-r pp-my">${emb(teamInfo(L.my), 'big')}<span class="pp-myt"><small>우리 팀 이번 주</small><b>${m.w}승 ${m.l}패${m.d ? ` ${m.d}무` : ''} · ${m.rank}위 ${arrow(m)}</b><span class="dots">${(m.res || '').split('').map(x => `<i class="${x === 'W' ? 'w' : x === 'L' ? 'l' : 'd'}"></i>`).join('')}</span></span>${m.star ? `<span class="pp-ms">${typeof playerFace === 'function' ? playerFace((findPlayer(L, m.star.id) || {}).p || { name: m.star.name, id: m.star.id }, L.my, 'sm') : ''}<span><b>${esc(m.star.name)}</b><small>${esc(m.star.line)}</small></span></span>` : ''}</div>` : '';
  const prev = (S.opts || []).find(o => o.key === 'prev' && !o.hide), next = (S.opts || []).find(o => o.key === 'next' && !o.hide), back = (S.opts || []).find(o => o.key === 'back');
  const btn = (o, ico, lab) => o ? `<button type="button" class="hb-b" data-sk="opt" data-n="${o.n}">${hubIco(ico)}<b>${esc(lab)}</b></button>` : '';
  const btns = [btn(prev, 'back', '지난 호'), btn(next, 'go', '다음 호'), btn(back, 'home', '돌아가기')].filter(Boolean);
  return `<div class="pp-paper">
    <div class="pp-mast"><b>손잡다 스포츠</b><small><span>제${P.no}호</span><span>${P.season}시즌 ${P.from}~${P.to}일째</span><span>${P.end ? '정규 시즌 마지막 호' : '주간 리그 신문'}</span></small></div>
    <div class="pg pp-pg">
      <div class="pg-r pp-head${P.head.kind === 'down' ? ' dn' : ''}">${ht ? emb(ht, 'big') : ''}<span><h3>${esc(P.head.t)}</h3><p>${esc(P.head.s)}</p></span></div>
      <div class="pg-r pp-mvps">${face(P.mvpB, false)}${face(P.mvpP, true)}</div>
      <div class="pg-r pp-st"><h4>순위와 이번 주 성적</h4><div class="pp-sts">${half(P.teams.slice(0, 5))}${half(P.teams.slice(5))}</div></div>
      ${games ? `<div class="pg-r pp-gm"><h4>눈에 띈 경기</h4><div class="pp-gl">${games}</div></div>` : ''}
      ${(P.notes || []).length ? `<div class="pg-r pp-nt"><h4>소식</h4>${P.notes.map(s => `<p>${esc(s)}</p>`).join('')}</div>` : ''}
      ${my}
      ${pgNav()}
    </div></div>
    <div class="hb c${btns.length} act sm">${btns.join('')}</div>`;
}
Object.assign(CAREER_SK, { 'dl-home':dlHomeSkin, 'pp-show':ppShowSkin });
