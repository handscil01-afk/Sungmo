'use strict';
/* ===================== 화면 보며 하기: 선수 육성 화면 =====================
   육성 계산과 화면 정의(career.js·career-life.js)는 그대로 쓰고, 화면 정의의 kind(cr-home 등)와 선택지의 key·item·stat을 보고 그림 화면으로 그림.
   누르면 늘 choose(번호)로 진행해서 소리와 글로 하기와 결과가 같음.
   - cr-home 라커룸(선수 카드·능력치·오늘 경기·훈련·마을·가방) · cr-visit 마을 지도(장소를 눌러 들어감) · cr-shop 용품점
   - cr-bag 가방(장비 칸 5개와 가진 물건) · cr-train 훈련 타일 · cr-info 선수 카드 · cr-face 얼굴 고르기 */

/* ---------- 팀 색 칠하기: 그림의 자홍색(#FF00FF와 그 어두운 색)을 팀 색으로 (밝기는 그대로) ---------- */
const SKT = { cache:{}, wait:{} };
function skTint(name, color){
  const k = name + color;
  if(SKT.cache[k]) return SKT.cache[k];
  if(!SKT.wait[k]){
    SKT.wait[k] = true;
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
      const T = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
      for(let i = 0; i < p.length; i += 4){
        const r = p[i], g = p[i + 1], b = p[i + 2];
        if(p[i + 3] && r > 90 && b > 80 && g < 0.6 * Math.min(r, b) && Math.abs(r - b) < 80){
          const v = Math.max(r, b) / 255;
          p[i] = Math.round(T[0] * v); p[i + 1] = Math.round(T[1] * v); p[i + 2] = Math.round(T[2] * v);
        }
      }
      x.putImageData(d, 0, 0);
      SKT.cache[k] = c.toDataURL();
      if(UI.S && /^(cr-|wz-)/.test(UI.S.kind || '') && !(document.activeElement && document.activeElement.id === 'wzName')) skinBody();
    };
    im.src = `img/${name}.png`;
  }
  return `img/${name}.png`;
}
const crL = () => (typeof LG === 'function' && LSRC === 'career') ? LG() : null;
const crColor = L => L ? teamInfo(L.my).color : '#3b82f6';
// 얼굴 그림(faces.png 4칸 × 3줄)
// i가 꾸미기 값(look 객체)이면 부위를 겹친 그림(look.js)
function crFace(i, color, cls = '', teamKey = null){
  if(i && typeof i === 'object') return `<span class="crf lk-f ${cls}" style="background-image:url(${lookURL(i, color, typeof teamLetter === 'function' ? teamLetter(teamKey) : '')})" aria-hidden="true"></span>`;
  return `<span class="crf ${cls}" style="background-image:url(${skTint('faces', color)});background-position:${(i % 4) * 100 / 3}% ${Math.floor(i / 4) * 50}%" aria-hidden="true"></span>`;
}
const crFaceOf = (L, c, p) => c.look || (c.face ?? faceOf(p.name));
const crNumOf = (c, p) => c.num ?? numOf(p.name);
// 능력치 막대 한 줄: 값, 등급, 성장 점수(작은 막대)
function crStat(p, c, k){
  const v = p[k], pct = k === 'vel' ? clamp((v - 120) / 40, 0, 1) * 100 : clamp(v, 0, 100);
  const gr = k === 'vel' ? grade(clamp((v - 120) * 2.5, 0, 100)) : grade(v);
  const pts = clamp((c.pts && c.pts[k]) || 0, 0, 10) * 10, lim = p.pot && (p.pot[k] ?? 99) - v <= 0;
  return `<div class="cs"><span class="cs-n">${esc(ABIL_NAME[k])}</span><span class="cs-b"><i style="width:${pct}%"></i><em style="width:${pts}%"></em></span><b>${v}${k === 'vel' ? '' : ''}</b><span class="g g-${gr}">${gr}</span>${lim ? '<span class="cs-l">MAX</span>' : ''}</div>`;
}
// 위쪽 자원 줄: 돈·인기·컨디션·피로
function crRes(L){
  const c = L.career, p = myP(L), f = clamp(c.fatigue || 0, 0, 100);
  const face = ['😫', '😟', '🙂', '😀', '😆'][(p.cond ?? 0) + 2];
  return `<div class="crres"><span class="rs"><i class="ri money"></i><b>${esc(won(c.money || 0))}</b></span><span class="rs"><i class="ri fame">♥</i><b>${c.fame || 0}</b></span>
    <span class="rs"><i class="ri cond">${face}</i><b>${esc(COND[p.cond ?? 0])}</b></span><span class="rs fat"><small>피로</small><span class="fb"><i style="width:${f}%;background:${f > 70 ? '#ff4d5e' : f > 40 ? '#ffb800' : '#2ec463'}"></i></span></span></div>`;
}
const crOpt = (S, key) => (S.opts || []).find(o => !o.hide && o.key === key);
const crBtn = (o, cls, inner) => o ? `<button type="button" class="${cls}" data-sk="opt" data-n="${o.n}">${inner}</button>` : '';
const trainIco = i => `<span class="tico" style="background-position:${(i % 5) * 25}% ${Math.floor(i / 5) * 100}%" aria-hidden="true"></span>`;
const TRAIN_IDX = { con:0, pow:1, eye:2, spd:3, def:4, vel:5, ctl:6, stf:7, sta:8, rest:9 };
const itemIco = i => `<span class="iico" style="background-position:${(i % 5) * 25}% ${Math.floor(i / 5) * 100 / 3}%" aria-hidden="true"></span>`;

/* ---------- 라커룸 (육성 첫 화면) ---------- */
function crHome(S){
  const L = crL(); if(!L || !L.career || L.career.retired) return null;
  const c = L.career, p = myP(L), col = crColor(L), T = L.teams[L.my], r = myRank(L);
  const where = c.hurt > 0 ? `부상 · ${c.hurt}일 뒤 복귀` : c.where === 'minor' ? '퓨처스리그(2군)' : isPit(p) ? `1군 ${p.role}` : `1군 주전 ${T.bat.indexOf(p) + 1}번`;
  const play = crOpt(S, 'play'), train = crOpt(S, 'train'), visit = crOpt(S, 'visit'), bag = crOpt(S, 'bag'), info = crOpt(S, 'info');
  const day = L.phase === 'season' ? `${L.season}시즌 ${L.day + 1}일째 · 팀 ${r.rank}위 (${T.w}승 ${T.l}패)` : L.phase === 'post' ? `${L.season}시즌 포스트시즌` : `${L.season}시즌 끝`;
  const L2 = L.career.visited === dayKey(L);
  return `${crRes(L)}
  <div class="lock" style="background-image:url(${skTint('cr-locker', col)})">
    <div class="pcard">${crFace(crFaceOf(L, c, p), col, 'big', L.my)}<div class="pc-num" style="--tc:${col}">${crNumOf(c, p)}</div>
      <div class="pc-nm"><b>${esc(p.name)}</b><small>${p.age}세 · ${esc(isPit(p) ? '투수' : POS[p.pos])}</small></div>
      <div class="pc-tm">${emb(T, 'sm')}<span>${esc(where)}</span></div></div>
    <div class="pstats">${statKeys(p).map(k => crStat(p, c, k)).join('')}</div>
  </div>
  <p class="crday">${esc(day)}</p>${crStory(L)}
  ${play ? `<button type="button" class="crplay" data-sk="opt" data-n="${play.n}"><span class="pp">▶</span><span><b>${esc(play.t)}</b>${play.s ? `<small>${esc(play.s)}</small>` : ''}</span></button>` : ''}
  <div class="crtiles">
    ${train ? `<button type="button" class="ct${S.trained ? ' done' : ''}" data-sk="opt" data-n="${train.n}">${trainIco(isPit(p) ? 5 : 0)}<b>훈련</b>${S.trained ? '<em class="stamp">완료</em>' : ''}</button>` : ''}
    ${crBtn(visit, 'ct' + (L2 ? ' done' : ''), `<span class="mapico" aria-hidden="true"></span><b>마을</b>${L2 ? '<em class="stamp">다녀옴</em>' : ''}`)}
    ${crBtn(bag, 'ct', `${itemIco(c.equip && c.equip.bat ? ITEMS.indexOf(itemOf(c.equip.bat)) : 19)}<b>가방</b>`)}
    ${crBtn(info, 'ct', `${crFace(crFaceOf(L, c, p), col, 'sm', L.my)}<b>내 선수</b>`)}
  </div>
  ${hubBtns([[crOpt(S, 'stand'), 'stand', '팀 순위'], [crOpt(S, 'lead'), 'lead', '기록 순위'], [crOpt(S, 'arch'), 'arch', '명예의 전당'], [crOpt(S, 'set'), 'set', '설정']].filter(x => x[0]), 4).replace('class="hb ', 'class="hb sm ')}`;
}

// 승격 경쟁 막대(2군일 때)와 라이벌 카드
function crStory(L){
  const g = typeof promoteGap === 'function' ? promoteGap(L) : null, r = typeof rivalLine === 'function' ? rivalLine(L) : null;
  // 감독 신뢰도·동료 관계 (career-trust.js): 한 줄에 작은 막대 두 개
  const c = typeof trustInit === 'function' ? trustInit(L.career) : null;
  const tb = (lab, v, col) => `<span class="tr-i"><small>${lab}</small><span class="fb"><i style="width:${v}%;background:${col}"></i></span><b>${Math.round(v)}</b></span>`;
  const tr = c ? `<div class="trustb">${tb('감독 신뢰', c.trust, c.trust >= 65 ? '#2ec463' : c.trust >= 45 ? '#3fa9ff' : '#ff4d5e')}${tb('동료 관계', c.mates, c.mates >= 65 ? '#ff7ab6' : c.mates >= 45 ? '#3fa9ff' : '#9fb3d3')}${c.warned ? '<em class="tr-w">경고</em>' : ''}</div>` : '';
  if(!g && !r) return tr;
  const gp = g ? `<div class="st-g"><small>1군 승격 경쟁 <b>${g.mine}</b> / ${g.need}</small><span class="fb big"><i style="width:${g.pct}%;background:${g.pct >= 100 ? '#2ec463' : '#ffb800'}"></i></span><small>${esc(g.name)}${g.gap ? ` · ${g.gap} 모자람` : ' · 곧 승격!'}</small></div>` : '';
  const rv = r ? `<div class="st-r">${emb(teamInfo(r.team), 'sm')}<span><small>라이벌</small><b>${esc(r.name)}</b></span><em class="${r.lead > 0 ? 'up' : r.lead < 0 ? 'dn' : ''}">${r.lead > 0 ? '앞섬' : r.lead < 0 ? '뒤처짐' : '팽팽'}</em></div>` : '';
  return `${tr}<div class="story">${gp}${rv}</div>`;
}
/* ---------- 스프링캠프 ---------- */
function crCamp(S){
  const L = crL(); if(!L || !L.career) return null;
  const c = L.career, p = myP(L);
  const tiles = (S.opts || []).filter(o => !o.hide && o.stat).map(o => `<button type="button" class="trt" data-sk="opt" data-n="${o.n}">${trainIco(TRAIN_IDX[o.stat])}<b>${esc(ABIL_NAME[o.stat])} 집중</b><span class="tv">지금 <em>${p[o.stat]}</em></span><span class="tp"><i style="width:${clamp((c.pts && c.pts[o.stat]) || 0, 0, 10) * 10}%"></i></span></button>`).join('');
  const SHORT = { scrim:'연습 경기', rest:'쉬기', skip:'남은 날 건너뛰기' };
  const others = (S.opts || []).filter(o => !o.hide && !o.stat).map(o => `<button type="button" class="mn" data-sk="opt" data-n="${o.n}"><span>${esc(SHORT[o.key] || o.t)}</span></button>`).join('');
  return `${crRes(L)}${(S.say || []).length ? `<div class="crmsg">${S.say.map(l => `<p>${esc(l.s || l)}</p>`).join('')}</div>` : ''}
    <div class="camp"><b>스프링캠프 ${S.day}일째</b><small>개막까지 ${c.camp}일 · 하루에 하나를 고릅니다</small><span class="camp-d">${[1, 2, 3].map(d => `<i class="${d < S.day ? 'done' : d === S.day ? 'now' : ''}"></i>`).join('')}</span></div>
    <div class="trg">${tiles}</div><div class="minors">${others}</div>`;
}
/* ---------- 마을 지도 ---------- */
function crVisit(S){
  const L = crL(); if(!L || !L.career) return null;
  const c = L.career, done = !!S.done;
  const spots = TOWN.map(t => {
    const os = (t.keys || []).map(k => crOpt(S, k)).filter(Boolean);
    const dayOnly = os.length && os.every(o => o.day);
    const off = done && dayOnly, hurt = t.id === 'hospital' && c.hurt > 0;
    return `<button type="button" class="spot${off ? ' off' : ''}${hurt ? ' hurt' : ''}" data-sk="spot" data-spot="${t.id}" style="left:${t.at[0]}%;top:${t.at[1]}%;width:${t.at[2]}%;height:${t.at[3]}%">
      <span class="sign"><b>${esc(t.name)}</b><small>${esc(off ? '오늘은 끝' : t.desc)}</small></span>${off ? '<em class="stamp">오늘은 끝</em>' : ''}</button>`;
  }).join('');
  return `${crRes(L)}${(S.say || []).length ? `<div class="crmsg">${S.say.map(l => `<p>${esc(l.s || l)}</p>`).join('')}</div>` : ''}<div class="townw"><div class="town">${spots}</div></div>`;
}
function crSpot(id){
  const t = TOWN.find(x => x.id === id); if(!t) return;
  if(t.home){
    go(careerHome, 'click');
    const o = crOpt(UI.S, t.home); if(o) choose(o.n, 'click');
    return;
  }
  const os = t.keys.map(k => crOpt(UI.S, k)).filter(Boolean);
  if(os.length === 1){ choose(os[0].n, 'click'); return; }
  skinNote(null, `<div class="spotm">${os.map(o => `<button type="button" class="card" data-sk="opt" data-n="${o.n}"><span class="tx"><b>${esc(o.t)}</b>${o.s ? `<small>${esc(o.s)}</small>` : ''}</span></button>`).join('')}</div>`, t.name);
}

/* ---------- 용품점 ---------- */
function crShop(S){
  const L = crL(); if(!L || !L.career) return null;
  const c = L.career, money = c.money || 0;
  const goods = (S.opts || []).filter(o => !o.hide && (o.item || o.goods));
  const other = (S.opts || []).filter(o => !o.hide && !o.item && !o.goods);
  const card = o => {
    const it = o.item ? itemOf(o.item) : GOODS.find(g => g.id === o.goods), idx = o.item ? ITEMS.indexOf(it) : ITEMS.length + GOODS.indexOf(it);
    const poor = !o.owned && money < o.price;
    return `<button type="button" class="shopc${o.owned ? ' own' : ''}${poor ? ' poor' : ''}" data-sk="opt" data-n="${o.n}">${itemIco(idx)}<span class="tx"><b>${esc(it.name)}</b><span class="pr">${esc(won(o.price))}${o.owned ? ' <i class="own">보유</i>' : ''}</span><small>${esc(o.item ? (o.s || '').replace(/^[^·]*· /, '') : it.desc)}</small></span>${o.goods ? `<em class="cnt">${o.have}개</em>` : ''}</button>`;
  };
  return `${crRes(L)}${(S.say || []).length ? `<div class="crmsg">${S.say.map(l => `<p>${esc(l.s || l)}</p>`).join('')}</div>` : ''}
    <div class="shopg">${goods.map(card).join('')}</div>
    ${other.length ? `<div class="minors">${other.map(o => `<button type="button" class="mn" data-sk="opt" data-n="${o.n}"><span>${esc(o.t.replace(/ \(.*\)$/, ''))}</span></button>`).join('')}</div>` : ''}`;
}

/* ---------- 가방 ---------- */
function crBag(S){
  const L = crL(); if(!L || !L.career) return null;
  const c = L.career, p = myP(L), col = crColor(L);
  const items = (S.opts || []).filter(o => !o.hide && o.item), other = (S.opts || []).filter(o => !o.hide && !o.item);
  const slot = sl => {
    const id = c.equip && c.equip[sl], it = id && itemOf(id), o = it && items.find(x => x.item === id), st = it ? gearState(c, id) : null;
    return `<${o ? 'button type="button" data-sk="opt" data-n="' + o.n + '"' : 'div'} class="slot${it ? ' on' : ''}"><small>${esc(SLOT_NAME[sl])}</small>${it ? itemIco(ITEMS.indexOf(it)) + `<span class="dur"><i style="width:${st.dur}%"></i></span>${st.lv ? `<em>+${st.lv}</em>` : ''}` : '<span class="empty">비어 있음</span>'}</${o ? 'button' : 'div'}>`;
  };
  const sum = Object.values(c.equip || {}).length;
  return `${crRes(L)}${(S.say || []).length ? `<div class="crmsg">${S.say.map(l => `<p>${esc(l.s || l)}</p>`).join('')}</div>` : ''}
    <div class="bag">
      <div class="bag-me">${crFace(crFaceOf(L, c, p), col, 'mid', L.my)}<div class="slots">${['bat', 'glove', 'shoes', 'wrist', 'acc'].map(slot).join('')}</div><small class="bag-sum">장착 ${sum}개 · 누르면 벗기</small></div>
      <div class="bag-inv">${items.length ? items.map(o => { const it = itemOf(o.item); return `<button type="button" class="inv${o.on ? ' on' : ''}" data-sk="opt" data-n="${o.n}">${itemIco(ITEMS.indexOf(it))}<b>${esc(it.name)}</b><small>${o.on ? '장착 중' : '눌러서 장착'}</small></button>`; }).join('') : '<p class="bag-empty">아직 산 장비가 없습니다.<br>마을의 스포츠 용품점에서 사세요.</p>'}</div>
    </div>
    <div class="minors">${other.map(o => `<button type="button" class="mn" data-sk="opt" data-n="${o.n}"><span>${esc(o.t)}</span></button>`).join('')}</div>`;
}

/* ---------- 훈련 ---------- */
function crTrain(S){
  const L = crL(); if(!L || !L.career) return null;
  const c = L.career, p = myP(L), f = c.fatigue || 0;
  const tiles = (S.opts || []).filter(o => !o.hide).map(o => {
    const k = o.stat || o.key, pts = o.stat ? clamp((c.pts && c.pts[k]) || 0, 0, 10) * 10 : 0;
    const lim = o.stat && p.pot && (p.pot[k] ?? 99) - p[k] <= 0;
    return `<button type="button" class="trt${o.key === 'rest' ? ' rest' : ''}" data-sk="opt" data-n="${o.n}">${trainIco(TRAIN_IDX[k] ?? 9)}<b>${esc(o.t)}</b>${o.stat ? `<span class="tv">${esc(ABIL_NAME[k])} <em>${p[k]}</em>${lim ? ' <i class="cs-l">MAX</i>' : ''}</span><span class="tp"><i style="width:${pts}%"></i></span>` : `<span class="tv">피로 풀기</span>`}</button>`;
  }).join('');
  return `${crRes(L)}${f > 70 ? '<div class="warn">많이 피곤합니다. 쉬지 않으면 효과가 크게 줄고 다치기 쉽습니다.</div>' : ''}<div class="trg">${tiles}</div><p class="crday">성장 점수(아래 막대)가 10이 되면 능력치가 1 오릅니다.</p>`;
}

/* ---------- 선수 카드 ---------- */
function crInfo(S){
  const L = crL(); if(!L || !L.career) return null;
  const c = L.career, p = myP(L), col = crColor(L), T = L.teams[L.my], pit = isPit(p);
  // 기록 상자: 이번 시즌(1군) · 통산(지난 시즌까지)
  const ss = p.ss || {}, cs = p.cs || {};
  const box = (lab, v, hi) => `<span class="sbx${hi ? ' hi' : ''}"><b>${esc(String(v))}</b><small>${esc(lab)}</small></span>`;
  const bat = x => [box('타율', x.ab ? avgOf(x).toFixed(3).replace(/^0/, '') : '-', avgOf(x) >= .3), box('안타', x.h || 0), box('홈런', x.hr || 0, (x.hr || 0) >= 20), box('타점', x.rbi || 0), box('도루', x.sb || 0)];
  const pitx = x => [box('평균자책', x.out ? eraOf(x).toFixed(2) : '-', x.out && eraOf(x) < 3), box('승', x.w || 0), box('패', x.l || 0), box('세이브', x.sv || 0), box('탈삼진', x.k || 0)];
  const row = (title, x) => `<div class="sbr"><span class="sbr-h">${esc(title)}</span><div class="sbx-g">${(pit ? pitx(x) : bat(x)).join('')}</div></div>`;
  const pitches = pit ? `<div class="pch">${(p.pitches || []).map(x => `<span><b>${esc(PITCH[x.t].name)}</b><i class="g-${String(x.g).toLowerCase()}">${esc(String(x.g))}</i></span>`).join('')}</div>` : '';
  const aw = (p.awards || []).slice(-8).reverse();
  const awards = `<div class="awb">${aw.length ? aw.map(a => `<span class="awc">${awardIco(Math.max(0, awardIdx(a)))}<b>${esc(a.replace(/^(\d+)시즌 /, '$1시즌\n'))}</b></span>`).join('') : '<span class="awn">아직 받은 상이 없습니다. 시즌이 끝나면 시상식이 열립니다.</span>'}</div>`;
  return `<div class="lock info" style="background-image:url(${skTint('cr-locker', col)})">
      <div class="pcard">${crFace(crFaceOf(L, c, p), col, 'big', L.my)}<div class="pc-num" style="--tc:${col}">${crNumOf(c, p)}</div>
        <div class="pc-nm"><b>${esc(p.name)}</b><small>${p.age}세 · ${esc(pit ? p.role || '투수' : POS[p.pos])}</small></div><div class="pc-tm">${emb(T, 'sm')}<span>${esc(teamInfo(L.my).short)}</span></div></div>
      <div class="pstats">${statKeys(p).map(k => crStat(p, c, k)).join('')}</div></div>
    ${pitches}${row(`${L.season}시즌 1군`, ss)}${row('통산 (지난 시즌까지)', cs)}
    <div class="sbr"><span class="sbr-h">수상 ${aw.length ? `${(p.awards || []).length}개` : ''}</span>${awards}</div>
    ${hubBtns([[S.opts.find(o => o.n === 1), 'back', '돌아가기'], [S.opts.find(o => o.key === 'log'), 'list', '업적·경력'], [S.opts.find(o => o.key === 'face' && !o.hide), 'retired', '얼굴 꾸미기']].filter(x => x[0]), 3)}`;
}

/* ---------- 얼굴 고르기 ---------- */
function crFacePick(S){
  const L = crL(), col = L && L.career ? crColor(L) : '#2f7de0';
  return `<div class="faceg">${(S.opts || []).filter(o => !o.hide).map(o => `<button type="button" class="facec" data-sk="opt" data-n="${o.n}" aria-label="${esc(o.t)}">${crFace(o.face, col, 'mid')}</button>`).join('')}</div>`;
}

/* ---------- 대화 창 (이벤트·계약·FA) ---------- */
// 말하는 사람: cr-people2(4칸 × 2줄) 칸 번호와 이름. me는 내 선수 얼굴
const WHO = { gm:[0, '단장'], fan:[1, '팬'], agent:[2, '에이전트'], legend:[3, '레전드 선수'], coach:[4, '코치'], rival:[5, '라이벌 신인'], mate:[6, '동료 선수'], press:[7, '기자'] };
function crTalk(S){
  const L = crL(); if(!L || !L.career) return null;
  const c = L.career, p = myP(L), col = crColor(L), w = WHO[S.who];
  const who = w ? `<span class="tk-p" style="background-image:url(${skTint('cr-people2', col)});background-position:${(w[0] % 4) * 100 / 3}% ${Math.floor(w[0] / 4) * 100}%" aria-hidden="true"></span>` : crFace(crFaceOf(L, c, p), col, 'mid', L.my);
  const name = w ? w[1] : p.name;
  const notes = (S.note || []).map(l => `<p>${esc(l)}</p>`).join('');
  const opts = (S.opts || []).filter(o => !o.hide).map(o => o.team
    ? `<button type="button" class="tk-o team" data-sk="opt" data-n="${o.n}">${emb(teamInfo(o.team), 'big')}<span class="tx"><b>${esc(o.t)}</b>${o.s ? `<small>${esc(o.s)}</small>` : ''}</span></button>`
    : `<button type="button" class="tk-o" data-sk="opt" data-n="${o.n}"><span class="tx"><b>${esc(o.t)}</b>${o.s ? `<small>${esc(o.s)}</small>` : ''}</span><span class="chev">${skIco('next1')}</span></button>`).join('');
  return `${crRes(L)}${(S.say || []).length ? `<div class="crmsg">${S.say.map(l => `<p>${esc(l.s || l)}</p>`).join('')}</div>` : ''}
    <div class="talk"><div class="tk-who">${who}<span class="tk-nm">${esc(name)}</span></div>
      <div class="tk-bub"><p>${esc(S.text || skClean(S.q))}</p>${notes ? `<div class="tk-note">${notes}</div>` : ''}</div></div>
    <div class="tk-opts${(S.opts || []).some(o => o.team) ? ' teams' : ''}">${opts}</div>`;
}

/* ---------- 오늘 경기 대진 카드 ---------- */
function crGame(S){
  const L = crL(); if(!L || !L.career) return null;
  const c = L.career, p = myP(L), col = crColor(L), g = !S.minor && typeof myGameToday === 'function' ? myGameToday(L) : null;
  const me = teamInfo(L.my), opp = g ? teamInfo(g.a === L.my ? g.h : g.a) : null, home = g ? g.h === L.my : true;
  const park = g ? parkInfo(g.h) : null, T = L.teams[L.my];
  const role = c.where === 'minor' ? '퓨처스리그(2군)' : isPit(p) ? `${p.role}` : `${T.bat.indexOf(p) + 1}번 타자`;
  const side = (t, lab) => t ? `<div class="vs-t">${emb(t, 'big')}<b>${esc(t.short)}</b><small>${lab}</small></div>` : `<div class="vs-t"><span class="vs-q">?</span><b>2군 상대</b><small>퓨처스리그</small></div>`;
  const ICON = ['swing', 'take', 'next'];
  const opts = (S.opts || []).filter(o => !o.hide).map((o, i) => `<button type="button" class="gm-o${i === 0 ? ' pri' : ''}" data-sk="opt" data-n="${o.n}">${skIco(ICON[i] || 'next')}<span class="tx"><b>${esc(o.t)}</b>${o.s ? `<small>${esc(o.s)}</small>` : ''}</span></button>`).join('');
  return `${crRes(L)}<div class="vs">
      <div class="vs-h">${S.minor ? '퓨처스리그(2군)' : `${L.season}시즌 ${L.day + 1}일째`}${park ? ` · ${esc(park.name)}` : ''}</div>${(S.note || []).length ? `<div class="vs-rv">🔥 ${esc(S.note[0])}</div>` : ''}
      <div class="vs-row">${side(me, home ? '홈' : '원정')}<span class="vs-x">VS</span>${side(opp, home ? '원정' : '홈')}</div>
      <div class="vs-me">${crFace(crFaceOf(L, c, p), col, 'sm', L.my)}<span><b>${esc(p.name)}</b> · ${esc(role)}${p.cond ? ` · 컨디션 ${esc(COND[p.cond])}` : ''}</span></div>
    </div><div class="gm-opts">${opts}</div>`;
}

/* ---------- 업적 연표 ---------- */
// 시상 아이콘(awards.png 4칸 × 2줄): 우승·MVP·신인왕·홈런왕 / 타격왕·골든글러브·명예의 전당·올스타
const awardIco = i => `<span class="aw" style="background-position:${(i % 4) * 100 / 3}% ${Math.floor(i / 4) * 100}%" aria-hidden="true"></span>`;
const awardIdx = t => /한국시리즈 우승|우승/.test(t) ? 0 : /MVP/.test(t) ? 1 : /신인왕/.test(t) ? 2 : /홈런/.test(t) ? 3 : /타율|타격왕/.test(t) ? 4 : /골든/.test(t) ? 5 : /명예의 전당/.test(t) ? 6 : /올스타/.test(t) ? 7 : -1;
function crLogSkin(S){
  const L = crL(); if(!L || !L.career) return null;
  const c = L.career, p = myP(L) || c.p || {}, by = {};
  (c.ach || []).forEach(a => { (by[a.season] ||= { ach:[], aw:[] }).ach.push(a); });
  (p.awards || []).forEach(a => { const m = /^(\d+)시즌 (.+)$/.exec(a); if(m) (by[m[1]] ||= { ach:[], aw:[] }).aw.push(m[2]); });
  const seasons = Object.keys(by).map(Number).sort((a, b) => b - a);
  const rows = [];
  seasons.forEach(sn => {
    const b = by[sn];
    rows.push(`<div class="pg-r tl-h"><b>${sn}시즌</b>${b.aw.map(a => `<span class="tl-aw">${awardIco(awardIdx(a) < 0 ? 1 : awardIdx(a))}${esc(a)}</span>`).join('')}</div>`);
    b.ach.slice().reverse().forEach(a => { const i = /명예의 전당/.test(a.text) ? 6 : /우승/.test(a.text) ? 0 : -1; rows.push(`<div class="pg-r tl-i">${i >= 0 ? awardIco(i) : '<span class="tl-dot"></span>'}<span><small>${a.day}일째</small>${esc(a.text)}</span></div>`); });
  });
  if(!rows.length) rows.push('<div class="pg-r tl-i"><span class="tl-dot"></span><span>아직 기록이 없습니다.</span></div>');
  return `<div class="pg panel tl">${rows.join('')}${pgNav()}</div>
    <div class="minors">${(S.opts || []).filter(o => !o.hide).map(o => `<button type="button" class="mn" data-sk="opt" data-n="${o.n}"><span>${esc(o.t)}</span></button>`).join('')}</div>`;
}

/* ---------- 우리 센터 팀 만들기 (center.js) ---------- */
function ctHome(S){
  const c = CE.c; if(!c) return null;
  const T = { key:'center', short: c.short, color: c.color }, saved = CENTER;
  CENTER = { ...(CENTER || {}), emblem: c.emblem, embImg: c.embImg, short: c.short };   // 미리보기 엠블럼
  const e = emb(T, 'big'); CENTER = saved;
  return `<div class="ctp" style="--tc:${c.color}">${e}<div class="ctp-tx"><b>${esc(c.name)}</b><small>${esc(c.short)} · ${esc(STYLES[c.style].name)} · ${esc(parkInfo(c.park).name)}</small>
    <span class="ctp-pl">${c.bat.slice(0, 5).map(p => `<i>${esc(p.nick || p.name)}</i>`).join('')}…</span></div></div>` + menuOpts(S);
}
function ctNum(S){
  const pct = (S.val - S.lo) / (S.hi - S.lo) * 100, gr = grade(S.stat === 'vel' ? clamp((S.val - 120) * 2.5, 0, 100) : S.val);
  const b = n => (S.opts || []).find(o => o.n === n);
  const btn = (n, cls) => { const o = b(n); return o ? `<button type="button" class="ctn-b ${cls}" data-sk="opt" data-n="${o.n}">${esc(o.t.replace(' 올리기', '').replace(' 내리기', ''))}</button>` : ''; };
  return `<p class="msub">${esc(skClean(S.q).split('. ')[0])}</p>
    <div class="ctn panel"><b class="ctn-v">${S.val}<small>${S.stat === 'vel' ? 'km' : ''}</small></b><span class="g g-${gr}">${gr}</span>
      <span class="ctn-bar"><i style="width:${pct}%"></i></span><span class="ctn-r"><small>${S.lo}</small><small>${S.hi}</small></span></div>
    <div class="ctn-row"><span>내리기</span>${btn(6, 'dn')}${btn(5, 'dn')}${btn(4, 'dn')}</div>
    <div class="ctn-row"><span>올리기</span>${btn(3, 'up')}${btn(2, 'up')}${btn(1, 'up')}</div>
    <form id="skForm" class="sk-form" autocomplete="off"><input id="skIn" type="text" inputmode="numeric" maxlength="3" placeholder="숫자로 적기" enterkeyhint="done"><button type="submit" class="gb b">적용</button></form>
    ${(() => { const o = b(9); return o ? `<button type="button" class="crplay" data-sk="opt" data-n="${o.n}"><span class="pp">✓</span><span><b>${esc(o.t)}</b></span></button>` : ''; })()}`;
}

/* ---------- 구단 사무실 (리그 감독 모드, office-ui.js) ---------- */
function foHome(S){
  const L = typeof LG === 'function' ? LG() : null; if(!L) return null;
  const T = teamInfo(L.my), col = T.color, pct = clamp(S.pay / S.cap * 100, 0, 100);
  const o = officeFresh(L), off = offseason(L);
  const ICO = { roster:'list', trade:'swap', fa:'flag', draft:'check', moves:'next' };
  const opts = (S.opts || []).filter(x => !x.hide).map(x => `<button type="button" class="fo-b${x.key === 'trade' ? ' pri' : ''}" data-sk="opt" data-n="${x.n}">${skIco(ICO[x.key] || 'next')}<span class="tx"><b>${esc(x.t)}</b>${x.s ? `<small>${esc(x.s)}</small>` : ''}</span></button>`).join('');
  return `<div class="fo" style="background-image:url(img/cr-office.png)">
      <div class="fo-gm"><span class="tk-p" style="background-image:url(${skTint('cr-people2', col)});background-position:0 0" aria-hidden="true"></span><span class="tk-nm">단장</span></div>
      <div class="fo-card">${emb(T, 'big')}<b>${esc(T.name)}</b>
        <small>연봉 총액 <b>${eok(S.pay)}</b> / 상한 ${eok(S.cap)}</small><span class="fb big"><i style="width:${pct}%;background:${pct > 95 ? '#ff4d5e' : pct > 80 ? '#ffb800' : '#2ec463'}"></i></span>
        <small>트레이드 ${o.trades}/${TRADE_MAX}${off ? ` · FA ${o.fa}/${FA_MAX} · 드래프트 ${o.drafted ? '마침' : draftPick(L) + '순위'}` : ' · FA·드래프트는 시즌 뒤'}</small></div>
    </div><div class="fo-opts">${opts}</div>`;
}

/* ---------- 올스타 휴식기 (allstar.js) ---------- */
function asHome(S){
  const L = typeof LG === 'function' ? LG() : null; if(!L) return null;
  const A = asState(L), R = allstarRosters(L), me = allstarMe(L);
  const side = k => `<div class="as-t" style="--tc:${teamInfo(k).color}"><span class="emb big" style="--tc:${teamInfo(k).color}">${k === 'dream' ? 'D' : 'N'}</span><b>${esc(teamInfo(k).name)}</b>
    <small>${R[k].bat.slice(0, 4).map(e => esc((asPlayer(L, e) || {}).name)).join(' · ')}</small>${me === k ? '<em class="stamp">내 선수 선정!</em>' : ''}</div>`;
  const res = [A.derby && A.derby.champ ? `<span>🏆 홈런 더비 <b>${esc(A.derby.champ.name)}</b></span>` : '', A.game ? `<span>⚾ 나눔 ${A.game.score[0]} : ${A.game.score[1]} 드림 · MVP <b>${esc(A.game.mvp)}</b></span>` : ''].filter(Boolean).join('');
  const ICO = { derby:'power', watch:'play', sim:'next', list:'list', close:'check' };
  const opts = (S.opts || []).filter(o => !o.hide).map(o => `<button type="button" class="fo-b${o.key === 'close' ? ' pri' : ''}" data-sk="opt" data-n="${o.n}">${skIco(ICO[o.key] || 'next')}<span class="tx"><b>${esc(o.t)}</b>${o.s ? `<small>${esc(o.s)}</small>` : ''}</span></button>`).join('');
  return `<div class="as" style="background-image:url(img/cr-stage.png)"><span class="as-ban">${ban3('mvp').replace('MVP', '올스타')}</span><b class="as-ttl">${L.season}시즌 올스타 휴식기</b></div>
    <div class="as-vs">${side('dream')}<span class="vs-x">VS</span>${side('nanum')}</div>${res ? `<div class="as-res">${res}</div>` : ''}<div class="fo-opts">${opts}</div>`;
}
function asDerby(S){
  const L = typeof LG === 'function' ? LG() : null, D = S.D; if(!L || !D) return null;
  const list = D.round === 1 ? D.field : D.round === 2 ? D.final : D.final, cur = !D.champ && list[D.turn];
  const row = (e, sc) => `<div class="db-r${cur && e.id === cur.id ? ' now' : ''}${D.champ && D.champ.id === e.id ? ' win' : ''}">${emb(teamInfo(e.team), 'sm')}<b>${esc(e.name)}</b>${derbyMine(L, e) ? '<i>우리</i>' : ''}<em>${sc ?? '-'}</em></div>`;
  const rows = D.round === 1 ? D.field.map(e => row(e, D.score[e.id])) : D.final.map(e => row(e, D.score[e.id]));
  const lamps = Array.from({ length: AS_OUTS }, (_, i) => `<i class="${i < D.outs ? 'on' : ''}"></i>`).join('');
  const last = D.log[D.log.length - 1] || '홈런 더비 시작!';
  const hr = /홈런!/.test(last);
  const opts = (S.opts || []).filter(o => !o.hide).map((o, i) => `<button type="button" class="${S.mine && o.key !== 'auto' ? `bt bt-${o.key === 'big' ? 'power' : 'contact'}` : 'fo-b' + (i === 0 ? ' pri' : '')}" data-sk="opt" data-n="${o.n}">${skIco(o.key === 'big' ? 'power' : o.key === 'easy' ? 'contact' : 'next')}<b>${esc(o.t)}</b>${o.s ? `<small>${esc(o.s)}</small>` : ''}</button>`).join('');
  return `<div class="db" style="background-image:url(img/bg-pitch-n.png)"><div class="db-h">${D.champ ? '🏆 우승 ' + esc(D.champ.name) : D.round === 1 ? '홈런 더비 예선' : '홈런 더비 결승'}</div>
      <div class="db-tb">${rows.join('')}</div>${cur ? `<div class="db-out">아웃 ${lamps}</div>` : ''}
      <div class="db-say${hr ? ' hr' : ''}">${esc(last)}</div></div>
    <div class="${S.mine ? 'bt-grid n2' : 'fo-opts'}">${opts}</div>`;
}

/* ---------- 한 화면 경기 설정 (app.js matchSetupScreen) ---------- */
function setupSkin(S){
  const A = teamInfo(NEW.a), B = teamInfo(NEW.b), k = NEW.kind, o = key => (S.opts || []).find(x => x.key === key && !x.hide);
  const who = k === '2p' ? ['첫째 사람', '둘째 사람'] : k === 'watch' ? ['원정', '홈'] : ['내 팀', '상대'];
  const tm = (T, key, lab) => `<button type="button" class="su-t" data-sk="opt" data-n="${o(key).n}" style="--tc:${T.color}">${emb(T, 'big')}<b>${esc(T.short)}</b><small>${esc(lab)} · 바꾸기</small></button>`;
  const seg = (label, key, list, cur) => `<div class="su-row"><span>${esc(label)}</span><div class="seg">${list.map(([v, t]) => `<button type="button" class="${v === cur ? 'on' : ''}" data-sk="set" data-k="${key}" data-v="${v}">${esc(t)}</button>`).join('')}</div></div>`;
  const mi = setupModeIdx(), park = parkInfo(k === 'watch' || NEW.first !== 2 ? NEW.b : NEW.a);
  const picks = o('picks'), start = o('start');
  return `<div class="su-l"><div class="su-vs">${tm(A, 'a', who[0])}<span class="vs-x">VS</span>${tm(B, 'b', who[1])}</div>
    <p class="su-park">경기장: ${esc(park.name)}</p>
    <button type="button" class="crplay su-go" data-sk="opt" data-n="${start.n}"><span class="pp">▶</span><span><b>${esc(start.t)}</b><small>${esc(SETUP_MODES[mi][2])} · ${NEW.innings}이닝</small></span></button></div>
    <div class="su-r"><div class="su panel">
      ${seg('경기 방식', 'mode', SETUP_MODES.map((m, i) => [i, m[2]]), mi)}
      ${k !== 'watch' ? seg('공격 순서', 'first', [[1, '먼저 (원정)'], [2, '나중 (홈)']], NEW.first === 2 ? 2 : 1) : ''}
      ${seg('이닝', 'inn', [1, 3, 5, 7, 9].map(n => [n, n + '회']), NEW.innings)}
      ${k === '1p' ? seg('컴퓨터 수준', 'diff', [[0, '쉬움'], [1, '보통'], [2, '어려움']], NEW.diff) : ''}
      ${picks ? `<button type="button" class="su-pk" data-sk="opt" data-n="${picks.n}"><span>직접 고를 것</span><b>${esc(pickName())}</b>${skIco('next1')}</button>` : ''}
    </div></div>`;
}
// 한 화면 경기 설정의 바로 고르는 단추
function setupSet(key, v){
  v = Number(v);
  if(key === 'mode'){ const m = SETUP_MODES[v]; NEW.mode = m[0]; if(m[1]) NEW.unit = m[1]; }
  else if(key === 'first') NEW.first = v;
  else if(key === 'inn') NEW.innings = v;
  else if(key === 'diff') NEW.diff = v;
  rerender();
}

const CAREER_SK = { 'setup':setupSkin, 'as-home':asHome, 'as-derby':asDerby, 'fo-home':foHome, 'cr-camp':crCamp, 'ct-home':ctHome, 'ct-num':ctNum, 'cr-talk':crTalk, 'cr-game':crGame, 'cr-log':crLogSkin, 'cr-home':crHome, 'cr-visit':crVisit, 'cr-shop':crShop, 'cr-bag':crBag, 'cr-train':crTrain, 'cr-info':crInfo, 'cr-face':crFacePick };
function careerSkin(S){
  const f = S && S.kind && CAREER_SK[S.kind];
  if(!f) return null;
  try{ return f(S); }catch(e){ console.warn('육성 화면 그리기 실패', e); return null; }
}
