'use strict';
/* ===================== 화면 보며 하기: 시상식 · 트로피 진열장 · 배지 알림 띠 =====================
   화면 정의는 awards-show.js(cr-award·cr-cabinet), 배지·트로피 계산은 badges.js. 여기서는 그림만 그림.
   그림: img/cr-award.png(시상식 무대) · img/cr-cabinet.png(진열장)는 자홍색을 팀 색으로(skTint),
   img/trophies.png(128칸, 4칸 × 2줄) · img/badges.png(64칸, 6칸 × 4줄, BADGES 차례) */

// 트로피·배지 그림 한 칸
const troIco = (i, cls = '') => `<span class="tro ${cls}" style="background-position:${(i % 4) * 100 / 3}% ${Math.floor(i / 4) * 100}%" aria-hidden="true"></span>`;
const badgeIco = (i, cls = '') => `<span class="bdg ${cls}" style="background-position:${(i % 6) * 20}% ${Math.floor(i / 6) * 100 / 3}%" aria-hidden="true"></span>`;
// 기록실·라커룸 단추 아이콘: 진열장
if(typeof HUB_ICO !== 'undefined') HUB_ICO.cab = ['y', '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M4 9h16M4 15h16M8.5 7h2M13.5 7h2M10.5 13h3M8 19h2.5M13.5 19h2.5"/>'];

// 상 받은 선수 얼굴: 내 선수(육성)는 꾸민 얼굴, 다른 선수는 이름으로 정해지는 얼굴. 모자에 팀 글자
function awFace(L, who, cls){
  const col = teamInfo(who.team).color;
  if(L.career && who.id === L.career.id && typeof crFaceOf === 'function'){ const p = badgeMe(L) || {}; return crFace(crFaceOf(L, L.career, p), col, cls, who.team); }
  const f = typeof findPlayer === 'function' ? findPlayer(L, who.id) : null;
  return typeof playerFace === 'function' ? playerFace(f ? f.p : { name: who.name, id: who.id }, who.team, cls) : '';
}
// 아래 단추 (선택지 그대로, 같은 모양 아이콘 단추)
function awBtns(S, ico){
  const os = (S.opts || []).filter(o => !o.hide);
  return `<div class="hb c${Math.min(os.length, 3)} aw-act">${os.map((o, i) => `<button type="button" class="hb-b${i === 0 ? ' pri' : ''}" data-sk="opt" data-n="${o.n}">${hubIco(ico[o.key] || 'go')}<b>${esc(o.t)}</b></button>`).join('')}</div>`;
}

/* ---------- 시상식 ---------- */
function crAwardSkin(S){
  const L = typeof LG === 'function' ? LG() : null, st = S.step; if(!L || !st) return null;
  const tk = st.team || (st.who && st.who.team) || L.champ, T = teamInfo(tk);
  const mine = st.team ? st.team === L.my : st.who ? awMine(L, st.who) : st.list.some(g => awMine(L, g));
  const scr = `<div class="aw-scr">${troIco(st.tro, 'big')}<span class="aw-lab">${st.ban ? ban3(st.ban, 'aw-ban') : ''}<b>${esc(st.label)}</b>${st.val ? `<em>${esc(st.val)}</em>` : ''}</span></div>`;
  let hero = '', plate = '';
  if(st.team){
    const rank = (L.final || []).indexOf(st.team) + 1;
    hero = `<div class="aw-hero team">${emb(T, 'big')}</div>`;
    plate = `<div class="aw-plate" style="--tc:${T.color}"><span><b>${esc(T.name)}</b><small>${rank ? `정규 시즌 ${rank}위 · ` : ''}한국시리즈 우승</small></span></div>`;
  } else if(st.who){
    hero = `<div class="aw-hero">${awFace(L, st.who, 'big')}</div>`;
    plate = `<div class="aw-plate" style="--tc:${T.color}">${emb(T, 'sm')}<span><b>${esc(st.who.name)}</b><small>${esc(T.short)} · ${esc(awStat(L, st.who))}</small></span></div>`;
  } else {
    plate = `<div class="aw-gg">${st.list.map(g => `<span class="${awMine(L, g) ? 'me' : ''}" style="--tc:${teamInfo(g.team).color}">${awFace(L, g, 'sm')}<small>${esc(g.pos)}</small><b>${esc(g.name)}</b></span>`).join('')}</div>`;
  }
  const dots = `<div class="aw-dots" aria-hidden="true">${Array.from({ length: S.n }, (_, j) => `<i class="${j < S.i ? 'done' : j === S.i ? 'now' : ''}"></i>`).join('')}</div>`;
  return `<div class="awsw"><div class="aws${st.list ? ' list' : ''}" style="background-image:url(${skTint('cr-award', T.color)})">
      <b class="aw-ttl">${L.season}시즌 시상식</b>${scr}${hero}${plate}${mine ? `<em class="aw-mine">${L.career ? '내 선수!' : '우리 팀!'}</em>` : ''}</div></div>
    <div class="aw-side">${dots}${awBtns(S, { next:'go', skip:'sim' })}</div>`;
}

/* ---------- 트로피 진열장 ---------- */
function crCabinetSkin(S){
  const L = typeof LG === 'function' ? LG() : null; if(!L || !S.badges) return null;
  const tab = CAB.tab, nB = S.badges.filter(b => S.got[b.id]).length;
  const tabs = `<div class="cab-tabs" role="tablist">${[['tro', `트로피 ${S.nT}`, troIco(0)], ['bdg', `배지 ${nB}/${S.badges.length}`, badgeIco(14)]].map(([k, t, ico]) => `<button type="button" role="tab" class="${k === tab ? 'on' : ''}" aria-selected="${k === tab}" data-sk="set" data-k="tab" data-v="${k}">${ico}<b>${esc(t)}</b></button>`).join('')}</div>`;
  const per = tab === 'tro' ? 4 : 6;
  const items = tab === 'tro' ? S.tro.map(t => ({ id: t.key, ico: troIco(t.cell), n: t.n, on: true, label:`${t.name} ${t.n}개` }))
    : S.badges.map(b => ({ id: b.id, ico: badgeIco(BADGES.indexOf(b)), on: !!S.got[b.id], label: b.name }));
  const pages = Math.max(1, Math.ceil(items.length / (per * 4)));
  CAB.pg = clamp(CAB.pg, 0, pages - 1);
  const shown = items.slice(CAB.pg * per * 4, (CAB.pg + 1) * per * 4);
  const shelves = [0, 1, 2, 3].map(r => `<div class="shf r${r} ${tab}">${shown.slice(r * per, (r + 1) * per).map(it => `<button type="button" class="cab-i${it.on ? '' : ' off'}${CAB.sel === it.id ? ' on' : ''}" data-sk="set" data-k="sel" data-v="${it.id}" aria-pressed="${CAB.sel === it.id}" aria-label="${esc(it.label + (it.on ? '' : ', 아직 받지 못함'))}">${it.ico}${it.n > 1 ? `<em>×${it.n}</em>` : ''}</button>`).join('')}</div>`).join('');
  const none = !items.length ? `<p class="cab-none">아직 트로피가 없습니다.<br>시즌이 끝나면 시상식에서 받습니다.</p>` : '';
  const pager = pages > 1 ? `<div class="cab-pg"><button type="button" data-sk="set" data-k="pg" data-v="-1" aria-label="앞 칸"${CAB.pg === 0 ? ' disabled' : ''}>${skIco('back')}</button><span>${CAB.pg + 1} / ${pages}</span><button type="button" data-sk="set" data-k="pg" data-v="1" aria-label="다음 칸"${CAB.pg >= pages - 1 ? ' disabled' : ''}>${skIco('next1')}</button></div>` : '';
  // 고른 것 설명 (높이 고정)
  let dt = `<p class="cab-hint">${tab === 'tro' ? `트로피 ${S.nT}개를 모았습니다.` : `배지 ${nB}개를 모았습니다. 못 받은 배지는 그림자로 보입니다.`} 눌러서 자세히 보세요.</p>`;
  if(CAB.sel && tab === 'tro'){ const t = S.tro.find(x => x.key === CAB.sel); if(t) dt = `${troIco(t.cell)}<span class="cab-tx"><b>${esc(t.name)} <i>×${t.n}</i></b><small>${esc(t.who.join(' · '))}</small></span>`; }
  if(CAB.sel && tab === 'bdg'){ const b = badgeOf(CAB.sel), g = b && S.got[b.id]; if(b) dt = `${badgeIco(BADGES.indexOf(b), g ? '' : 'off')}<span class="cab-tx"><b>${esc(b.name)} <i class="${g ? 'ok' : ''}">${g ? `${esc(badgeWhen(g))} 받음` : '아직 못 받음'}</i></b><small>${esc(badgeDesc(L, b))}</small></span>`; }
  return `<div class="cabw"><div class="cab" style="background-image:url(${skTint('cr-cabinet', teamInfo(L.my).color)})"><b class="cab-ttl">${esc(S.owner)}</b>${shelves}${none}${pager}</div></div>
    <div class="cab-side">${tabs}<div class="cab-dt">${dt}</div>${awBtns(S, { back:'back', show:'again' })}</div>`;
}
Object.assign(CAREER_SK, { 'cr-award':crAwardSkin, 'cr-cabinet':crCabinetSkin });

/* ---------- 배지 알림 띠 (화면 위쪽, 잠깐 보였다 사라짐) ---------- */
function badgeToast(list){
  if(!list || !list.length || typeof document === 'undefined') return;
  let el = document.getElementById('bdgToast');
  if(!el){ el = document.createElement('div'); el.id = 'bdgToast'; el.className = 'bdg-toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); el.addEventListener('click', () => { el.hidden = true; }); document.body.appendChild(el); }
  const more = list.length > 3 ? `<p class="bt-more">그 밖에 ${list.length - 3}개</p>` : '';
  el.innerHTML = list.slice(0, 3).map(b => `<div class="bt-i">${badgeIco(BADGES.findIndex(x => x.id === b.id))}<span><small>배지 획득!</small><b>${esc(b.name)}</b></span></div>`).join('') + more;
  el.hidden = false; el.classList.remove('out', 'in'); void el.offsetWidth; el.classList.add('in');
  clearTimeout(el._t); el._t = setTimeout(() => { el.classList.add('out'); el._t = setTimeout(() => { el.hidden = true; }, 450); }, 3400);
}
