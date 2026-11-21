'use strict';
/* ===================== 화면 보며 하기: 허브 화면 그림 =====================
   리그 첫 화면(lg-home), 기록실(ar-home·ar-show), 경기 끝 점수 카드, 같은 모양의 아이콘 단추.
   화면 정의(질문·번호 선택지·읽는 글)는 그대로 두고, 그림만 여기서 그림 */

// 단추 아이콘(선 그림): [바탕색, svg 안쪽]
const HUB_ICO = {
  play:['o', '<circle cx="12" cy="12" r="8.5"/><path d="M10 8.5v7l5.5-3.5z"/>'],
  sim:['b', '<path d="M4 6.5v11l7-5.5zM12 6.5v11l7-5.5z"/>'],
  skip:['p', '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4M9.5 14.5l2 2 3.5-4"/>'],
  stand:['g', '<path d="M5 20V11M10 20V6M15 20v-7M20 20V9"/>'],
  lead:['y', '<circle cx="12" cy="9" r="5"/><path d="M9 13.5 7.5 21l4.5-2.5 4.5 2.5-1.5-7.5"/>'],
  office:['s', '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M9 7.5h2M13 7.5h2M9 11h2M13 11h2M9 14.5h2M13 14.5h2M10.5 20.5v-3h3v3"/>'],
  sched:['b', '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4M8 13h2M12 13h2M16 13h.5M8 16.5h2M12 16.5h2"/>'],
  arch:['y', '<path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5A3 3 0 0 0 7 10.5M17 6h3v1.5a3 3 0 0 1-3 3M12 13v4M8.5 20.5h7M9.5 17h5"/>'],
  set:['s', '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/>'],
  back:['s', '<path d="M14.5 5.5 8 12l6.5 6.5"/>'],
  home:['b', '<path d="M4 11 12 4l8 7M6.5 9.5V20h11V9.5"/>'],
  list:['b', '<path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01"/>'],
  score:['g', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v14M3 10h18M3 14.5h18"/>'],
  chat:['g', '<path d="M4 5.5h16v10H9l-5 4z"/>'],
  again:['o', '<path d="M19 12a7 7 0 1 1-2.1-5M19 4.5V9h-4.5"/>'],
  exit:['r', '<path d="M10 4.5H5v15h5M14 8l4 4-4 4M18 12H9"/>'],
  career:['y', '<path d="M5 20V11M10 20V6M15 20v-7M20 20V9"/><path d="M4 4.5h16"/>'],
  rec:['o', '<path d="M12 3.5l2.4 5 5.4.6-4 3.7 1.1 5.4L12 15.5l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>'],
  hof:['y', '<path d="M4 20h16M6 20V10M10 20V10M14 20V10M18 20V10M3.5 10 12 4l8.5 6z"/>'],
  retired:['s', '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/>'],
  feats:['p', '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>'],
  me:['b', '<rect x="5.5" y="4.5" width="13" height="16" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 13.5h7M8.5 17h4"/>'],
  champ:['y', '<path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5A3 3 0 0 0 7 10.5M17 6h3v1.5a3 3 0 0 1-3 3M12 13v4M8.5 20.5h7M9.5 17h5"/>'],
  bag:['o', '<path d="M5 8.5h14l-1 11.5H6z"/><path d="M9 8.5V6.5a3 3 0 0 1 6 0v2"/>'],
  go:['s', '<path d="M9.5 5.5 16 12l-6.5 6.5"/>'],
};
const hubIco = k => { const g = HUB_ICO[k] || HUB_ICO.go; return `<span class="gico g-${g[0]}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${g[1]}</svg></span>`; };
// 같은 크기·같은 모양 아이콘 단추 묶음 (cols칸)
function hubBtns(list, cols = 4){
  return `<div class="hb c${cols}">${list.filter(Boolean).map(([o, ico, label]) => `<button type="button" class="hb-b" data-sk="opt" data-n="${o.n}">${hubIco(ico)}<b>${esc(label || o.t)}</b></button>`).join('')}</div>`;
}
const hubOpt = (S, key) => (S.opts || []).find(o => o.key === key && !o.hide);
const hubPlay = (o, sub) => o ? `<button type="button" class="crplay" data-sk="opt" data-n="${o.n}"><span class="pp">▶</span><span><b>${esc(o.t)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>` : '';
// 최근 경기 점(승 초록·패 빨강·무 회색)
const lastDots = T => `<span class="dots">${(T.last || []).slice(-10).map(x => `<i class="${x === 'W' ? 'w' : x === 'L' ? 'l' : 'd'}"></i>`).join('')}</span>`;

/* ---------- 리그 첫 화면 ---------- */
function lgHomeSkin(S){
  const L = typeof LG === 'function' ? LG() : null; if(!L) return null;
  const r = myRank(L), T = r.T, info = teamInfo(L.my);
  const st = `<div class="lh-st" style="--tc:${info.color}">${emb(info, 'big')}<span class="lh-tx"><small>${L.season}시즌 · 내 팀</small><b>${esc(info.name)}</b>
      <span class="lh-rec"><em>${T.w}승 ${T.l}패${T.d ? ` ${T.d}무` : ''}</em>${lastDots(T)}</span></span>
      <span class="lh-rank"><b>${r.rank}</b><small>위</small><i>${esc(gbText(r.gb))}</i></span></div>`;
  let mid = '';
  if(L.phase === 'season'){
    const g = myGameToday(L);
    const sp = k => { const X = L.teams[k]; return X.sp[X.rot % 5].name; };
    mid = g ? `<div class="lh-g"><span class="lh-gh">오늘 경기 · ${L.day + 1}일째 · 남은 ${L.sched.length - L.day}경기</span>
        <div class="vs3"><span class="vs3-t">${emb(teamInfo(g.a), 'big')}<b>${esc(teamInfo(g.a).short)}</b><small>원정 · 선발 ${esc(sp(g.a))}</small></span><span class="vs-x">VS</span><span class="vs3-t">${emb(teamInfo(g.h), 'big')}<b>${esc(teamInfo(g.h).short)}</b><small>홈 · 선발 ${esc(sp(g.h))}</small></span></div>
        <span class="lh-park">${esc(parkInfo(g.h).name)}</span></div>`
      : `<div class="lh-g"><span class="lh-gh">${L.day + 1}일째 · 남은 ${L.sched.length - L.day}경기</span><p class="lh-none">오늘은 우리 팀 경기가 없습니다.</p></div>`;
  } else if(L.phase === 'post'){
    const g = todayGames(L)[0];
    mid = `<div class="lh-g"><span class="lh-gh">포스트시즌</span>${g ? `<div class="vs3"><span class="vs3-t">${emb(teamInfo(g.a), 'big')}<b>${esc(teamInfo(g.a).short)}</b></span><span class="vs-x">VS</span><span class="vs3-t">${emb(teamInfo(g.h), 'big')}<b>${esc(teamInfo(g.h).short)}</b></span></div><span class="lh-park">${esc(g.label)}</span>` : ''}<p class="lh-none">${esc(seriesText(L))}</p></div>`;
  } else {
    const A = L.awards || {};
    mid = `<div class="lh-g champ">${ban3('champ')}<div class="lh-ch">${emb(teamInfo(L.champ), 'big')}<b>${esc(teamInfo(L.champ).name)}</b></div>
      <div class="lh-aw">${A.mvp ? `<span>${awardIco(1)}<small>MVP</small><b>${esc(A.mvp.name)}</b></span>` : ''}${A.roy ? `<span>${awardIco(2)}<small>신인왕</small><b>${esc(A.roy.name)}</b></span>` : ''}${A.ksMvp ? `<span>${awardIco(0)}<small>KS MVP</small><b>${esc(A.ksMvp.name)}</b></span>` : ''}</div></div>`;
  }
  const play = hubOpt(S, 'play');
  // 순위 미리보기: 위 다섯 팀 (내 팀이 밖이면 다섯째 줄에 내 팀)
  const sd = standings(L); let top = sd.slice(0, 5); if(!top.some(x => x.T.key === L.my)) top = [...sd.slice(0, 4), sd.find(x => x.T.key === L.my)];
  const mini = `<div class="lh-mini">${top.map(x => `<span class="${x.T.key === L.my ? 'me' : ''}"><i>${x.rank}</i>${emb(teamInfo(x.T.key), 'sm')}<b>${esc(teamInfo(x.T.key).short)}</b><em>${x.T.w}-${x.T.l}${x.T.d ? `-${x.T.d}` : ''}</em><small>${x.gb ? x.gb : '-'}</small></span>`).join('')}</div>`;
  return `${st}${mid}${mini}${hubPlay(play, play && play.s)}
    ${hubBtns([[hubOpt(S, 'sim'), 'sim', L.phase === 'done' ? '' : '결과만 보기'], [hubOpt(S, 'skip'), 'skip', '여러 날'], [hubOpt(S, 'stand'), 'stand', '순위표'], [hubOpt(S, 'lead'), 'lead', '기록 순위'],
      [hubOpt(S, 'office'), 'office', '구단 사무실'], [hubOpt(S, 'sched'), 'sched', L.phase === 'season' ? '일정' : '포스트시즌'], [hubOpt(S, 'arch'), 'arch', '기록실'], [hubOpt(S, 'set'), 'set', '리그 설정']].filter(x => x[0]))}`;
}

/* ---------- 기록실 ---------- */
function arHomeSkin(S){
  const L = LG(); if(!L) return null;
  const h = L.history || [], my = L.my;
  const champs = h.filter(x => x.my.champ).length + (L.champ === my ? 1 : 0);
  const sum = `<div class="ar-sum"><span>${awardIco(0)}<b>${champs}</b><small>우승</small></span><span>${awardIco(6)}<b>${(L.hof || []).length}</b><small>명예의 전당</small></span><span>${awardIco(1)}<b>${(L.feats || []).length}</b><small>대기록</small></span><span>${hubIco('me')}<b>${L.season}</b><small>시즌째</small></span></div>`;
  const list = [['champ', 'champ', '역대 우승'], ['career', 'career', '통산 순위'], ['rec', 'rec', '시즌 최고'], ['hof', 'hof', '명예의 전당'], ['retired', 'retired', '은퇴 선수'], ['feats', 'feats', '대기록'], ['me', 'me', '내 감독 기록'], ['cab', 'cab', '트로피 진열장']];
  return `${sum}${hubBtns(list.map(([k, ico, lab]) => [hubOpt(S, k), ico, lab]).filter(x => x[0]), 2)}`;
}
// 기록 카드 목록 (쪽 넘기기)
function arShowSkin(S){
  let cards = S.cards;
  const L = LG();
  if(!cards && L){   // 내 감독 기록
    const h = L.history || [], me = L.me || {}, T = L.teams[L.my];
    const w = h.reduce((a, x) => a + x.my.w, 0) + T.w, l = h.reduce((a, x) => a + x.my.l, 0) + T.l;
    const top = `<div class="ar-sum"><span><b>${w}<i>승</i> ${l}<i>패</i></b><small>통산 · 승률 ${(w + l ? w / (w + l) : 0).toFixed(3).replace(/^0/, '')}</small></span><span>${awardIco(0)}<b>${h.filter(x => x.my.champ).length + (L.champ === L.my ? 1 : 0)}</b><small>우승</small></span><span><b>${h.filter(x => x.my.post).length + (L.post && L.post.seeds.includes(L.my) ? 1 : 0)}</b><small>가을 야구</small></span><span><b>${me.w || 0}-${me.l || 0}</b><small>직접 한 경기</small></span></div>`;
    cards = h.slice().reverse().map(x => ({ team: L.my, aw: x.my.champ ? 0 : -1, head:`${x.season}시즌`, title:`${x.my.rank}위 · ${x.my.w}승 ${x.my.l}패`, tag: x.my.champ ? '우승' : x.my.post ? '가을 야구' : '', hi: x.my.champ ? 'gold' : x.my.post ? 'blue' : '' }));
    return `${top}${arCards(cards)}${arBack(S)}`;
  }
  return `${arCards(cards || [])}${arBack(S)}`;
}
function arCards(cards){
  if(!cards.length) return `<div class="ar-empty panel">${awardIco(0)}<p>아직 기록이 없습니다.<br>시즌을 치르면 여기에 쌓입니다.</p></div>`;
  const row = c => {
    const T = c.team ? teamInfo(c.team) : null;
    return `<div class="pg-r arc${c.hi ? ' ' + c.hi : ''}"${T ? ` style="--tc:${T.color}"` : ''}>${T ? emb(T, 'big') : ''}<span class="arc-tx"><small>${esc(c.head || '')}</small><b>${c.aw >= 0 && c.aw != null ? awardIco(c.aw) : ''}${esc(c.title)}</b>${c.sub ? `<em>${esc(c.sub)}</em>` : ''}${(c.awards || []).length ? `<span class="arc-aw">${c.awards.slice(0, 4).map(a => `<i>${awardIco(Math.max(0, awardIdx(a)))}${esc(a.replace(/^\d+시즌 /, ''))}</i>`).join('')}</span>` : ''}</span>${c.big ? `<strong class="arc-big">${esc(c.big)}</strong>` : c.tag ? `<span class="arc-tag">${esc(c.tag)}</span>` : ''}</div>`;
  };
  return `<div class="pg ar-list">${cards.map(row).join('')}${pgNav()}</div>`;
}
const arBack = S => { const o = (S.opts || []).find(x => !x.hide); return o ? `<div class="mback"><button type="button" class="gb b" data-sk="opt" data-n="${o.n}">${skIco('back')}${esc(o.t)}</button></div>` : ''; };

/* ---------- 경기 끝: 그림 위 점수 카드 + 같은 크기 단추 ---------- */
function finalCardHTML(){
  if(!G || !G.over) return '';
  const r = G.teams.map(runsOf), mine = typeof NET !== 'undefined' && NET.on ? NET.side : G.focusTeam != null ? G.focusTeam : myTeam();
  const win = r[0] === r[1] ? -1 : r[0] > r[1] ? 0 : 1;
  const ban = win < 0 ? 'draw' : mine >= 0 ? (mine === win ? 'win' : 'lose') : 'win';
  const wl = (G.log || []).map(l => l.s).reverse().find(s => /^승리 투수/.test(s || ''));
  const pit = wl ? wl.replace(/\.$/, '').split(', ').map(x => { const m = /^(승리 투수|패전 투수|세이브|홀드) (.+)$/.exec(x); return m ? `<span><em>${{ '승리 투수':'승', '패전 투수':'패', '세이브':'세', '홀드':'홀' }[m[1]]}</em>${esc(m[2])}</span>` : ''; }).join('') : '';
  const tm = (i) => `<span class="fin-t${win === i ? ' w' : ''}">${emb(G.teams[i], 'big')}<b>${esc(G.teams[i].short)}</b></span>`;
  return `<div class="fin" role="status"><span class="fin-h">경기 종료${G.called ? ` · ${G.called === 'rain' ? '강우 ' : ''}콜드게임` : G.inning > G.innings ? ` · 연장 ${G.inning}회` : ''}</span>
    <div class="fin-sc">${tm(0)}<strong class="${win === 0 ? 'w' : ''}">${r[0]}</strong><i>:</i><strong class="${win === 1 ? 'w' : ''}">${r[1]}</strong>${tm(1)}</div>
    ${ban3(ban, 'fin-ban')}${pit ? `<div class="fin-p">${pit}</div>` : ''}${typeof rankFinTag === 'function' ? rankFinTag() : ''}</div>`;
}
function endDeckHTML(S){
  if(S.kind === 'hl' && typeof hlDeckHTML === 'function') return hlDeckHTML(S);   // 명장면 다시 보기 (highlights.js)
  const want = (S.opts || []).filter(o => !o.hide);
  const ico = t => /명장면/.test(t) ? 'rec' : /다시|한 판 더/.test(t) ? 'again' : /점수판/.test(t) ? 'score' : /기록 전체/.test(t) ? 'list' : /채팅/.test(t) ? 'chat' : /나가기/.test(t) ? 'exit' : /상황/.test(t) ? 'list' : /처음/.test(t) ? 'home' : /육성|리그|올스타/.test(t) ? 'home' : 'go';
  const main = want.filter(o => o.key !== 'status');
  return `${lineScoreHTML()}<div class="hb c${main.length <= 3 ? main.length : main.length === 4 ? 2 : 3} end">${main.map(o => `<button type="button" class="hb-b${o.n === 1 ? ' pri' : ''}" data-sk="opt" data-n="${o.n}">${hubIco(ico(o.t))}<b>${esc(o.t.replace('같은 설정으로 다시 하기', '다시 하기').replace(' 돌아가기', '').replace('으로 돌아가기', ''))}</b></button>`).join('')}</div>`;
}

Object.assign(CAREER_SK, { 'lg-home':lgHomeSkin, 'ar-home':arHomeSkin, 'ar-show':arShowSkin });

/* ---------- 한 화면 용품점 · 인벤토리 가방 (career-life.js shopAll·bagAll) ---------- */
const lifeIdx = id => { const it = itemOf(id); return it ? ITEMS.indexOf(it) : ITEMS.length + GOODS.findIndex(g => g.id === id); };
const lifeMsg = S => (S.say || []).length ? `<div class="toast">${S.say.map(l => esc(l.s || l)).join(' ')}</div>` : '';
// 고른 물건 설명 칸 (높이 고정: 물건마다 줄 수가 달라도 화면이 흔들리지 않게)
function lifeDetail(id, c, p, extra){
  const it = itemOf(id), g = goodsOf(id);
  if(!it && !g) return `<div class="idt empty"><p>가방이 비어 있습니다.<br>마을의 스포츠 용품점에서 장비와 소모품을 사세요.</p></div>`;
  const st = it ? gearState(c, it.id) : null;
  const tags = it ? `<i>${esc(GRADE_NAME[gearGrade(it)])}</i><i>${esc(SLOT_NAME[it.slot])}</i>${c.owned.includes(it.id) ? `<i class="own">내구 ${st.dur}%${st.lv ? ` · +${st.lv}` : ''}</i>` : ''}${c.equip[it.slot] === it.id ? '<i class="on">장착 중</i>' : ''}` : `<i>소모품</i><i class="own">가진 것 ${c.goods[g.id] || 0}개</i>`;
  const fx = it ? fxText(it, p) + (GEAR_COST[it.id] ? ', ' + Object.entries(GEAR_COST[it.id]).filter(([, v]) => v).map(([k, v]) => `${ABIL_NAME[k]} ${v}`).join(', ') : '') : g.desc;
  return `<div class="idt">${itemIco(lifeIdx(id))}<span class="idt-tx"><b>${esc((it || g).name)}</b><span class="idt-tg">${tags}</span><small>${esc(fx)}</small></span>${extra || ''}</div>`;
}
function crShop2(S){
  const L = crL(); if(!L || !L.career) return null;
  const c = L.career, p = myP(L), id = SHOP_SEL;
  const cell = x => { const it = itemOf(x), g = goodsOf(x), own = it && c.owned.includes(x), pr = (it || g).price, poor = !own && c.money < pr;
    return `<button type="button" class="ic${x === id ? ' on' : ''}${own ? ' own' : ''}${poor ? ' poor' : ''}" data-sk="set" data-k="it" data-v="${x}" aria-pressed="${x === id}" aria-label="${esc((it || g).name)}">${itemIco(lifeIdx(x))}<small>${own ? '보유' : esc(won(pr).replace(' 원', ''))}</small>${g && c.goods[x] ? `<em>${c.goods[x]}</em>` : ''}</button>`; };
  const it = itemOf(id), price = (it || goodsOf(id)).price;
  const buy = hubOpt(S, 'buy'), eq = hubOpt(S, 'buyeq'), bag = hubOpt(S, 'bag');
  return `${crRes(L)}${lifeMsg(S)}<div class="ig">${S.ids.map(cell).join('')}</div>
    ${lifeDetail(id, c, p, `<strong class="idt-pr${c.money < price ? ' poor' : ''}">${esc(won(price))}</strong>`)}
    <div class="hb c${[buy, eq, bag].filter(Boolean).length} act">${[buy, eq, bag].filter(Boolean).map(o => `<button type="button" class="hb-b${o.key === 'buyeq' || (o.key === 'buy' && !eq) ? ' pri' : ''}${o.key === 'buy' && it && c.owned.includes(it.id) ? ' off' : ''}" data-sk="opt" data-n="${o.n}">${hubIco(o.key === 'bag' ? 'bag' : o.key === 'buyeq' ? 'play' : 'go')}<b>${esc(o.t)}</b></button>`).join('')}</div>`;
}
function crBag2(S){
  const L = crL(); if(!L || !L.career) return null;
  const c = L.career, p = myP(L), col = crColor(L), id = BAG_SEL;
  const slot = sl => { const x = c.equip && c.equip[sl], it = x && itemOf(x), st = it ? gearState(c, x) : null;
    return it ? `<button type="button" class="slot on${x === id ? ' sel' : ''}" data-sk="set" data-k="it" data-v="${x}"><small>${esc(SLOT_NAME[sl])}</small>${itemIco(ITEMS.indexOf(it))}<span class="dur"><i style="width:${st.dur}%"></i></span>${st.lv ? `<em>+${st.lv}</em>` : ''}</button>`
      : `<div class="slot"><small>${esc(SLOT_NAME[sl])}</small><span class="empty">비어 있음</span></div>`; };
  const cells = S.ids.map(x => { const it = itemOf(x), on = it && c.equip[it.slot] === x;
    return `<button type="button" class="ic${x === id ? ' on' : ''}${on ? ' eq' : ''}" data-sk="set" data-k="it" data-v="${x}" aria-pressed="${x === id}" aria-label="${esc((it || goodsOf(x)).name)}">${itemIco(lifeIdx(x))}${it ? (on ? '<small>장착</small>' : '') : `<em>${c.goods[x]}</em>`}</button>`; });
  const n = Math.max(15, Math.ceil(cells.length / 5) * 5);
  while(cells.length < n) cells.push('<span class="ic emp" aria-hidden="true"></span>');
  const acts = ['equip', 'repair', 'enh', 'use', 'shop'].map(k => hubOpt(S, k)).filter(Boolean);
  const ico = { equip:'play', repair:'set', enh:'rec', use:'play', shop:'bag' };
  return `${crRes(L)}${lifeMsg(S)}
    <div class="bag2"><div class="bag-me">${crFace(crFaceOf(L, c, p), col, 'mid')}<div class="slots">${['bat', 'glove', 'shoes', 'wrist', 'acc'].map(slot).join('')}</div></div></div>
    <div class="ig bagi">${cells.join('')}</div>
    ${lifeDetail(id, c, p)}
    <div class="hb c${Math.min(4, acts.length)} act">${acts.map(o => `<button type="button" class="hb-b${o.key === 'equip' || o.key === 'use' ? ' pri' : ''}" data-sk="opt" data-n="${o.n}">${hubIco(ico[o.key])}<span class="tx"><b>${esc(o.t)}</b>${o.s ? `<small>${esc(o.s)}</small>` : ''}</span></button>`).join('')}</div>`;
}
Object.assign(CAREER_SK, { 'cr-shop2':crShop2, 'cr-bag2':crBag2 });

/* ---------- 일정과 결과 (league-ui.js schedScreen) ---------- */
function scShowSkin(S){
  const L = LG(); if(!L) return null;
  const game = g => { const A = teamInfo(g.a), H = teamInfo(g.h), done = g.ra != null, aw = done && g.ra > g.rh, hw = done && g.rh > g.ra, mine = g.a === L.my || g.h === L.my;
    return `<span class="sg${mine ? ' me' : ''}">${emb(A, 'sm')}<b class="${aw ? 'w' : ''}">${esc(A.short)}</b><strong>${done ? `${g.ra} : ${g.rh}` : g.rain ? '우천' : 'vs'}</strong><b class="${hw ? 'w' : ''}">${esc(H.short)}</b>${emb(H, 'sm')}</span>`; };
  const days = (S.days || []).map(d => `<div class="pg-r sd"><span class="sd-h">${d.day}일째</span><div class="sd-g">${d.games.map(game).join('')}</div></div>`);
  const next = (S.next || []).length ? `<div class="sn"><span class="sd-h">우리 팀 다음 일정</span><div class="sn-l">${S.next.map(g => { const o = g.h === L.my ? g.a : g.h; return `<span><small>${g.day}일째</small>${emb(teamInfo(o), 'sm')}<b>${esc(teamInfo(o).short)}</b><i class="${g.h === L.my ? 'home' : ''}">${g.h === L.my ? '홈' : '원정'}</i></span>`; }).join('')}</div></div>` : '';
  return `${days.length ? `<div class="pg ar-list">${days.join('')}${pgNav()}</div>` : `<div class="ar-empty panel"><p>아직 경기 결과가 없습니다.</p></div>`}${next}`;
}
Object.assign(CAREER_SK, { 'sc-show':scShowSkin, 'cr-coach':crTrain });
