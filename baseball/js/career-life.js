'use strict';
/* ===================== 선수 육성: 돈·장비·가게·방문·이벤트·경기 방식 =====================
   - 돈(만 원 단위): 연봉은 경기가 있는 날마다 나눠 받고, 잘한 경기에는 보너스. 시즌이 바뀌면 연봉 협상
   - 장비(배트·글러브·신발·손목·액세서리): 끼면 능력치가 바로 오르고, 빼면 내려감 (능력치에 직접 더해 둠)
   - 소모품(에너지 음료·테이핑·보약), 방문(용품점·가방·팬 사인회·특별 코치·재활 센터)
   - 이벤트: 날이 지나면 가끔 생기고, 고른 답에 따라 결과가 달라짐
   - 경기 방식: 내 차례만 직접 / 맡기고 내 결과 듣기 / 건너뛰기 (2군 경기도 직접 할 수 있음) */

const SLOT_NAME = { bat:'배트', glove:'글러브', shoes:'신발', wrist:'손목', acc:'액세서리' };
const ABIL_NAME = { con:'컨택', pow:'파워', eye:'선구안', spd:'스피드', def:'수비', vel:'구속', ctl:'제구', stf:'구위', sta:'체력' };
// for: bat 타자만 · pit 투수만 · all 모두 (fx.all은 그 선수의 모든 능력치)
const ITEMS = [
  { id:'bat1', slot:'bat', for:'bat', name:'연습용 나무 배트', price:60, fx:{ con:1 } },
  { id:'bat2', slot:'bat', for:'bat', name:'단풍나무 배트', price:250, fx:{ pow:2 } },
  { id:'bat3', slot:'bat', for:'bat', name:'프로 모델 배트', price:700, fx:{ con:2, pow:2 } },
  { id:'bat4', slot:'bat', for:'bat', name:'황금 배트', price:1800, fx:{ con:3, pow:4 } },
  { id:'glv1', slot:'glove', for:'bat', name:'가죽 글러브', price:150, fx:{ def:2 } },
  { id:'glv2', slot:'glove', for:'bat', name:'명품 수제 글러브', price:600, fx:{ def:4 } },
  { id:'pglv1', slot:'glove', for:'pit', name:'투수용 글러브', price:150, fx:{ ctl:1 } },
  { id:'pglv2', slot:'glove', for:'pit', name:'명품 투수 글러브', price:700, fx:{ ctl:3 } },
  { id:'shoe1', slot:'shoes', for:'bat', name:'가벼운 스파이크', price:200, fx:{ spd:2 } },
  { id:'shoe2', slot:'shoes', for:'bat', name:'탄소 스파이크', price:650, fx:{ spd:4 } },
  { id:'pshoe1', slot:'shoes', for:'pit', name:'투수용 스파이크', price:200, fx:{ sta:3 } },
  { id:'wr1', slot:'wrist', for:'bat', name:'손목 아대', price:250, fx:{ eye:2 } },
  { id:'pwr1', slot:'wrist', for:'pit', name:'손목 보호대', price:250, fx:{ stf:2 } },
  { id:'acc1', slot:'acc', for:'bat', name:'타격 장갑', price:400, fx:{ con:1, eye:1 } },
  { id:'acc2', slot:'acc', for:'pit', name:'어깨 보호 슬리브', price:500, fx:{ vel:1, sta:3 } },
  { id:'acc3', slot:'acc', for:'all', name:'행운의 목걸이', price:1200, fx:{ all:1 } },
];
const GOODS = [
  { id:'drink', name:'에너지 음료', price:30, desc:'컨디션이 한 단계 좋아집니다.' },
  { id:'tape', name:'테이핑과 찜질 세트', price:80, desc:'부상이 2일 빨리 낫습니다.' },
  { id:'tonic', name:'보약', price:150, desc:'다음 훈련의 성장 효과가 두 배가 됩니다.' },
];
const itemOf = id => ITEMS.find(x => x.id === id);
const fits = (it, p) => it.for === 'all' || (it.for === 'pit') === isPit(p);
const statKeys = p => isPit(p) ? ['vel', 'ctl', 'stf', 'sta'] : ['con', 'pow', 'eye', 'spd', 'def'];
const fxText = (it, p) => Object.entries(it.fx).map(([k, v]) => k === 'all' ? `모든 능력 +${v}` : `${ABIL_NAME[k]} +${v}`).join(', ');
const won = n => n >= 10000 ? `${Math.floor(n / 10000)}억${n % 10000 ? ` ${n % 10000}만` : ''} 원` : `${n}만 원`;

// 예전 저장에도 돈·장비 자리를 만들어 둠
function life(L){
  const c = C(L);
  if(c.money == null){ c.money = 200; c.equip = {}; c.goods = {}; c.salary = c.where === 'minor' ? 3000 : salaryOf(L); }
  c.equip ||= {}; c.goods ||= {}; c.owned ||= [];
  return c;
}
function salaryOf(L){
  const c = C(L), p = myP(L), r = isPit(p) ? ratingPit(p) : ratingBat(p);
  if(c.where === 'minor') return 3000;
  return Math.round((4000 + Math.max(0, r - 45) * 400 + (c.fame || 0) * 30) / 100) * 100;
}
// 장비 효과를 능력치에 더하거나(sign 1) 뺌(-1)
function applyItem(p, it, sign){
  const keys = it.fx.all ? statKeys(p).map(k => [k, it.fx.all]) : Object.entries(it.fx);
  keys.forEach(([k, v]) => { if(p[k] == null) return; const max = k === 'vel' ? 165 : k === 'sta' ? 125 : 99; p[k] = clamp(p[k] + v * sign, 1, max); });
}
function equipText(L){
  const c = life(L), list = Object.entries(c.equip).map(([s, id]) => itemOf(id)).filter(Boolean);
  return list.length ? list.map(x => x.name).join(', ') : '없음';
}

/* ---------- 돈 ---------- */
// 하루가 지날 때: 연봉을 경기 수만큼 나눠 받음
function payDay(L){
  const c = life(L);
  if(L.phase !== 'season') return [];
  const pay = Math.max(1, Math.round(c.salary / Math.max(18, L.len)));
  c.money += pay;
  return [];
}
// 경기 보너스 (2군은 절반)
function gameBonus(L, ln, G, minor){
  const c = life(L), s = ln.st || {}, dec = G.decision || {};
  let b = 0;
  if(ln.bat) b = (s.h || 0) * 10 + (s.hr || 0) * 50 + (s.rbi || 0) * 10 + (s.sb || 0) * 10 + (s.bb || 0) * 3;
  else if(ln.used) b = (dec.w === c.id ? 100 : 0) + (dec.s === c.id ? 60 : 0) + (dec.h === c.id ? 30 : 0) + (s.k || 0) * 5 + (s.out >= 18 ? 50 : 0);
  if(minor) b = Math.round(b / 2);
  if(b <= 0) return [];
  c.money += b;
  return [`활약 보너스 ${won(b)}을 받았습니다. 가진 돈 ${won(c.money)}.`];
}
// 새 시즌: 연봉 협상
function negotiate(L){
  const c = life(L), old = c.salary, nw = salaryOf(L);
  c.salary = Math.max(c.where === 'minor' ? 3000 : 3500, nw);
  return [`연봉 협상: ${won(old)}에서 ${won(c.salary)}으로 ${c.salary > old ? '올랐습니다!' : c.salary < old ? '깎였습니다.' : '그대로입니다.'}`];
}

/* ---------- 용품점 ---------- */
function shopScreen(msg){
  const L = CR(), c = life(L), p = myP(L);
  const list = ITEMS.filter(it => fits(it, p));
  const pageItems = list.slice(0, 6);
  return { q:`스포츠 용품점입니다. 가진 돈 ${won(c.money)}. 무엇을 살까요?`, say: msg, scene:{ kind:'shop', title:'스포츠 용품점', color: teamInfo(L.my).color }, back: v => go(visitScreen, v), opts:[
    ...pageItems.map((it, i) => ({ n: i + 1, icon:['icons', ITEMS.indexOf(it)], t:`${it.name} ${won(it.price)}${c.owned.includes(it.id) ? ' (가지고 있음)' : ''}`, s:`${SLOT_NAME[it.slot]} · ${fxText(it, p)}`, act: v => buyItem(it, v) })),
    { n:7, t:'장비 더 보기', hide: list.length <= 6, s:`${list.slice(6).map(x => x.name).join(', ')}`, act: v => go(() => shopMore(), v) },
    { n:8, t:'소모품 (음료·테이핑·보약)', act: v => go(goodsShop, v) },
    { n:9, t:'내 가방 (장착·사용)', act: v => go(bagScreen, v) },
  ] };
}
function shopMore(){
  const L = CR(), c = life(L), p = myP(L), list = ITEMS.filter(it => fits(it, p)).slice(6);
  return { q:`장비 더 보기. 가진 돈 ${won(c.money)}.`, back: v => go(shopScreen, v), opts: list.slice(0, 8).map((it, i) => ({ n: i + 1, icon:['icons', ITEMS.indexOf(it)], t:`${it.name} ${won(it.price)}${c.owned.includes(it.id) ? ' (가지고 있음)' : ''}`, s:`${SLOT_NAME[it.slot]} · ${fxText(it, p)}`, act: v => buyItem(it, v) })) };
}
function buyItem(it, via){
  const L = CR(), c = life(L), p = myP(L);
  if(c.owned.includes(it.id)){ stay('이미 가지고 있습니다. 가방에서 장착하세요.'); return; }
  if(c.money < it.price){ stay(`돈이 모자랍니다. ${won(it.price - c.money)}이 더 있어야 합니다.`); return; }
  openDlg('사기', [`${it.name}을 ${won(it.price)}에 살까요? (${fxText(it, p)})`], [
    { label:'사고 바로 장착', act: () => { c.money -= it.price; c.owned.push(it.id); const say = equip(L, it); saveLeague(); go(shopScreen, 'click', [`${it.name}을 샀습니다.`, ...say]); } },
    { label:'사기만', act: () => { c.money -= it.price; c.owned.push(it.id); saveLeague(); go(shopScreen, 'click', [`${it.name}을 샀습니다. 가방에 넣었습니다.`]); } },
    { label:'그만두기' },
  ]);
}
function equip(L, it){
  const c = life(L), p = myP(L), old = itemOf(c.equip[it.slot]);
  if(old) applyItem(p, old, -1);
  applyItem(p, it, 1); c.equip[it.slot] = it.id;
  return [`${SLOT_NAME[it.slot]}: ${it.name} 장착. ${fxText(it, p)}.${old ? ` (${old.name}은 가방으로)` : ''}`];
}
function unequip(L, slot){
  const c = life(L), p = myP(L), it = itemOf(c.equip[slot]);
  if(!it) return [];
  applyItem(p, it, -1); delete c.equip[slot];
  return [`${it.name}을 벗었습니다.`];
}
function goodsShop(){
  const L = CR(), c = life(L);
  return { q:`소모품입니다. 가진 돈 ${won(c.money)}.`, back: v => go(shopScreen, v), opts: GOODS.map((g, i) => ({ n: i + 1, icon:['icons2', i], t:`${g.name} ${won(g.price)} (가진 것 ${c.goods[g.id] || 0}개)`, s: g.desc, act: () => {
    if(c.money < g.price){ stay('돈이 모자랍니다.'); return; }
    c.money -= g.price; c.goods[g.id] = (c.goods[g.id] || 0) + 1; saveLeague(); stay(`${g.name}을 샀습니다. 가진 돈 ${won(c.money)}.`);
  } })) };
}
function bagScreen(msg){
  const L = CR(), c = life(L), p = myP(L), opts = [];
  const owned = c.owned.map(itemOf).filter(Boolean);
  owned.slice(0, 7).forEach((it, i) => {
    const on = c.equip[it.slot] === it.id;
    opts.push({ n: i + 1, icon:['icons', ITEMS.indexOf(it)], t:`${on ? '장착 중: ' : ''}${it.name}`, s:`${SLOT_NAME[it.slot]} · ${fxText(it, p)}. 고르면 ${on ? '벗습니다' : '장착합니다'}.`,
      act: v => { const say = on ? unequip(L, it.slot) : equip(L, it); saveLeague(); go(bagScreen, v, say); } });
  });
  opts.push({ n:8, t:'소모품 쓰기', s: GOODS.map(g => `${g.name} ${c.goods[g.id] || 0}개`).join(', '), act: v => go(useGoods, v) });
  return { q:`내 가방입니다. 장비: ${equipText(L)}.`, say: msg || (owned.length ? null : ['아직 산 장비가 없습니다. 용품점에서 사세요.']), back: v => go(careerHome, v), opts };
}
function useGoods(){
  const L = CR(), c = life(L), p = myP(L);
  const use = (id, fn) => () => { if(!(c.goods[id] > 0)){ stay('가진 것이 없습니다.'); return; } const msg = fn(); if(!msg) return; c.goods[id]--; saveLeague(); stay(msg); };
  return { q:'무엇을 쓸까요?', back: v => go(bagScreen, v), opts:[
    { n:1, t:`에너지 음료 (${c.goods.drink || 0}개)`, s: GOODS[0].desc, act: use('drink', () => { if(p.cond >= 2){ stay('이미 컨디션이 아주 좋습니다.'); return null; } p.cond++; return `에너지 음료를 마셨습니다. 컨디션 ${COND[p.cond]}.`; }) },
    { n:2, t:`테이핑과 찜질 세트 (${c.goods.tape || 0}개)`, s: GOODS[1].desc, act: use('tape', () => { if(!(c.hurt > 0)){ stay('지금은 다친 곳이 없습니다.'); return null; } c.hurt = Math.max(0, c.hurt - 2); return c.hurt ? `치료했습니다. ${c.hurt}일 뒤 돌아옵니다.` : '치료했습니다. 다 나았습니다!'; }) },
    { n:3, t:`보약 (${c.goods.tonic || 0}개)`, s: GOODS[2].desc, act: use('tonic', () => { if(c.tonic){ stay('이미 보약을 먹었습니다. 다음 훈련에 효과가 납니다.'); return null; } c.tonic = true; return '보약을 먹었습니다. 다음 훈련의 성장 효과가 두 배가 됩니다.'; }) },
  ] };
}

/* ---------- 어디 가기 (하루에 한 곳: 사인회·특별 코치·재활 센터. 용품점과 가방은 언제나) ---------- */
const dayKey = L => `${L.season}-${L.phase}-${L.day}`;
function visitScreen(msg){
  const L = CR(), c = life(L), p = myP(L), done = c.visited === dayKey(L), list = statKeys(p);
  const lock = done ? '오늘은 이미 다녀왔습니다.' : '';
  return { q:`어디에 갈까요? 가진 돈 ${won(c.money)}.`, say: msg, back: v => go(careerHome, v), opts:[
    { n:1, t:'스포츠 용품점', s:'배트·글러브·신발 같은 장비와 소모품을 삽니다.', act: v => go(shopScreen, v) },
    { n:2, t:'내 가방', s:`장비: ${equipText(L)}`, act: v => go(bagScreen, v) },
    { n:3, t:'팬 사인회', s: lock || '인기와 용돈이 오릅니다. 가끔 피곤해집니다.', act: v => done ? stay(lock) : fanMeet(v) },
    { n:4, t:'특별 코치 레슨 (300만 원)', s: lock || '유명 코치에게 하루 집중 지도를 받아 성장 점수가 크게 오릅니다.', act: v => done ? stay(lock) : go(coachScreen, v) },
    { n:5, t: c.hurt > 0 ? '재활 센터 (100만 원)' : '마사지 숍 (50만 원)', s: lock || (c.hurt > 0 ? '부상이 2일 빨리 낫습니다.' : '컨디션이 한 단계 좋아집니다.'), act: v => done ? stay(lock) : clinic(v) },
  ] };
}
function fanMeet(via){
  const L = CR(), c = life(L), p = myP(L);
  c.visited = dayKey(L);
  const up = 1 + Math.floor(rnd(L) * 3), cash = 20 + (c.fame || 0) * 2;
  c.fame += up; c.money += cash;
  const say = [`팬 사인회에 다녀왔습니다. 팬들이 줄을 섰습니다! 인기 ${up} 올라 ${c.fame}, 용돈 ${won(cash)}.`];
  if(rnd(L) < 0.25){ p.cond = Math.max(-2, p.cond - 1); say.push('사인을 너무 많이 해서 조금 피곤합니다.'); }
  saveLeague(); go(() => sceneScreen('fans', '팬 사인회'), via, say);
}
function coachScreen(){
  const L = CR(), c = life(L), p = myP(L);
  return { q:'특별 코치에게 무엇을 배울까요? (300만 원)', back: v => go(visitScreen, v), opts: statKeys(p).map((k, i) => ({ n: i + 1, t: ABIL_NAME[k], s:`지금 ${p[k]}, 성장 점수 ${Math.round(c.pts[k] || 0)}/10`, act: v => {
    if(c.money < 300){ stay('돈이 모자랍니다.'); return; }
    c.money -= 300; c.visited = dayKey(L);
    const up = grow(L, k, 12 + rnd(L) * 4);
    saveLeague(); go(() => sceneScreen(k, `특별 코치 레슨: ${ABIL_NAME[k]}`), v, [`특별 코치에게 ${ABIL_NAME[k]}을 배웠습니다. 성장 점수 ${Math.round(c.pts[k])}/10.`, ...up]);
  } })) };
}
function clinic(via){
  const L = CR(), c = life(L), p = myP(L), cost = c.hurt > 0 ? 100 : 50;
  if(c.money < cost){ stay('돈이 모자랍니다.'); return; }
  c.money -= cost; c.visited = dayKey(L);
  let say;
  if(c.hurt > 0){ c.hurt = Math.max(0, c.hurt - 2); say = [c.hurt ? `재활 치료를 받았습니다. ${c.hurt}일 뒤 돌아옵니다.` : '재활 치료로 다 나았습니다!']; }
  else { p.cond = Math.min(2, p.cond + 1); say = [`마사지를 받았습니다. 컨디션 ${COND[p.cond]}.`]; }
  saveLeague(); go(() => sceneScreen(cost === 100 ? 'clinic' : 'massage', cost === 100 ? '재활 센터' : '마사지 숍'), via, say);
}

/* ---------- 훈련·방문 장면 (화면 보며 하기에서는 그림, 소리와 글 방식에서는 글과 효과음) ---------- */
function sceneScreen(kind, title){
  const L = CR();
  playFx(kind === 'fans' ? ['hit'] : kind === 'rest' ? ['change'] : ['bat']);
  return { q:`${title}. 확인을 누르면 돌아갑니다.`, scene:{ kind, title, color: teamInfo(L.my).color }, back: v => go(careerHome, v), opts:[{ n:1, t:'확인', act: v => go(careerHome, v) }] };
}

/* ---------- 이벤트 ---------- */
// 날이 지날 때 가끔 생김 (c.event에 두었다가 첫 화면에서 물음)
const EVENTS = [
  { id:'senior', ok: () => true, q: (L, p) => `선배가 다가와 "${isPit(p) ? '공 던지는 모습' : '타격 자세'}를 봐 줄까?" 하고 묻습니다.`, opts:[
    ['귀담아듣기', (L, c, p) => { const k = pickOne(L, statKeys(p)); return [`선배의 조언으로 ${ABIL_NAME[k]}에 눈을 떴습니다.`, ...grow(L, k, 6)]; }],
    ['정중히 사양하고 쉬기', (L, c, p) => { p.cond = Math.min(2, p.cond + 1); return [`푹 쉬었습니다. 컨디션 ${COND[p.cond]}.`]; }]] },
  { id:'fan', ok: () => true, q: () => '경기장 앞에서 어린이 팬이 사인을 해 달라고 합니다.', opts:[
    ['사인해 주고 사진도 찍기', (L, c) => { c.fame += 2; return [`어린이 팬이 무척 좋아합니다. 인기 2 올라 ${c.fame}.`]; }],
    ['바빠서 손만 흔들기', (L, c) => { c.fame = Math.max(0, c.fame - 1); return ['아쉬워하는 표정입니다. 인기가 1 내렸습니다.']; }]] },
  { id:'sponsor', ok: (L, c) => (c.fame || 0) >= 8, q: () => '스포츠 용품 회사에서 광고 모델 제안이 왔습니다.', opts:[
    ['광고 찍기', (L, c, p) => { c.money += 400; const it = ITEMS.filter(x => fits(x, p) && !c.owned.includes(x.id) && x.price <= 700)[0]; if(it) c.owned.push(it.id); c.fame += 2; return [`광고료 ${won(400)}을 받았습니다.${it ? ` 선물로 ${it.name}도 받았습니다. 가방에서 장착하세요.` : ''} 인기도 2 올랐습니다.`]; }],
    ['야구에만 집중하겠다며 거절', (L, c, p) => { p.cond = Math.min(2, p.cond + 1); return [`마음이 편합니다. 컨디션 ${COND[p.cond]}.`]; }]] },
  { id:'press', ok: () => true, q: () => '기자가 "이번 시즌 목표는 무엇인가요?" 하고 묻습니다.', opts:[
    ['자신 있게 "타이틀을 따겠습니다!"', (L, c, p) => { c.fame += 3; if(rnd(L) < 0.4){ p.cond = Math.max(-2, p.cond - 1); return ['기사가 크게 났습니다. 인기 3 올랐지만 부담이 되어 몸이 조금 무겁습니다.']; } return ['기사가 크게 났습니다. 인기가 3 올랐습니다!']; }],
    ['겸손하게 "팀에 보탬이 되겠습니다"', (L, c, p) => { c.fame += 1; p.cond = Math.min(2, p.cond + 1); return [`호감 가는 인터뷰였습니다. 인기 1, 컨디션 ${COND[p.cond]}.`]; }]] },
  { id:'cold', ok: () => true, q: () => '아침부터 감기 기운이 있습니다.', opts:[
    ['약을 사 먹고 쉬기 (20만 원)', (L, c, p) => { c.money = Math.max(0, c.money - 20); return ['약을 먹고 푹 잤습니다. 몸이 괜찮아졌습니다.']; }],
    ['참고 훈련하기', (L, c, p) => { const k = pickOne(L, statKeys(p)); p.cond = Math.max(-2, p.cond - 2); return [`이를 악물고 훈련했습니다. 컨디션이 ${COND[p.cond]}로 떨어졌습니다.`, ...grow(L, k, 5)]; }]] },
  { id:'rival', ok: () => true, q: (L, p) => `같은 ${isPit(p) ? '투수진' : '포지션'}의 신인이 "곧 제가 자리를 차지할 거예요" 하고 도발합니다.`, opts:[
    ['"한번 해 보자!" 맞받아치기', (L, c, p) => { p.cond = 2; return ['투지가 불타오릅니다! 컨디션 아주 좋음.']; }],
    ['웃어넘기기', (L, c) => { c.fame += 1; return ['여유 있는 모습에 팀 분위기가 좋아졌습니다. 인기 1.']; }]] },
  { id:'coach', ok: (L, c) => (c.money || 0) >= 150, q: () => '은퇴한 레전드 선수가 훈련장에 들렀습니다. 150만 원에 하루 지도해 주겠다고 합니다.', opts:[
    ['지도받기 (150만 원)', (L, c, p) => { c.money -= 150; const k = pickOne(L, statKeys(p)); return [`레전드에게 ${ABIL_NAME[k]} 비법을 배웠습니다!`, ...grow(L, k, 10)]; }],
    ['다음에 하기', () => ['다음 기회를 노려 봅니다.']]] },
  { id:'birthday', ok: () => true, q: (L, p) => `오늘은 ${p.name}의 생일입니다! 동료들이 깜짝 파티를 준비했습니다.`, opts:[
    ['신나게 즐기기', (L, c, p) => { p.cond = Math.min(2, p.cond + 2); c.money += 50; return [`최고의 생일입니다. 컨디션 ${COND[p.cond]}, 선물로 용돈 ${won(50)}.`]; }],
    ['일찍 들어가 쉬기', (L, c, p) => { p.cond = Math.min(2, p.cond + 1); return [`고마운 마음만 받고 쉬었습니다. 컨디션 ${COND[p.cond]}.`]; }]] },
  { id:'family', ok: () => true, q: () => '고향의 부모님께서 전화를 하셨습니다. "밥은 잘 먹고 다니니?"', opts:[
    ['"걱정 마세요, 잘 지내요!"', (L, c, p) => { p.cond = Math.min(2, p.cond + 1); return [`목소리를 들으니 힘이 납니다. 컨디션 ${COND[p.cond]}.`]; }],
    ['용돈을 보내 드리기 (100만 원)', (L, c, p) => { c.money = Math.max(0, c.money - 100); c.fame += 2; p.cond = Math.min(2, p.cond + 1); return ['효자라는 소문이 났습니다. 인기 2 오르고 마음도 뿌듯합니다.']; }]] },
];
function rollEvent(L){
  const c = life(L);
  if(c.event || c.retired || rnd(L) > 0.22) return;
  const list = EVENTS.filter(e => e.ok(L, c));
  c.event = pickOne(L, list).id;
}
function eventScreen(){
  const L = CR(), c = life(L), p = myP(L), e = EVENTS.find(x => x.id === c.event);
  if(!e){ delete c.event; return careerHome(); }
  return { q:`이벤트! ${e.q(L, p)} 어떻게 할까요?`, scene:{ kind:'ev-' + e.id, title:'이벤트!', color: teamInfo(L.my).color }, opts: e.opts.map(([t, fn], i) => ({ n: i + 1, t, act: v => { delete c.event; const say = fn(L, c, p); saveLeague(); go(careerHome, v, say); } })) };
}

/* ---------- 경기 방식 고르기 ---------- */
function careerGameChoice(minor){
  const where = minor ? '퓨처스리그(2군)' : '1군';
  return { q:`오늘 ${where} 경기를 어떻게 할까요?`, back: v => go(careerHome, v), opts:[
    { n:1, t:'내 차례만 직접 하기', s:'내 타석(투수라면 내가 던질 때)만 직접 고르고, 나머지는 빠르게 진행합니다.', act: v => minor ? careerMinorPlay(v) : careerPlay(v) },
    { n:2, t:'내 차례도 맡기고 내 결과 듣기', s:'컴퓨터가 내 선수도 대신 하고, 내 타석(투구) 결과를 하나씩 알려 줍니다.', act: v => minor ? careerMinorDay(v, true) : careerSimDay(v, true) },
    { n:3, t:'경기 건너뛰기', s:'최종 점수와 오늘 내 기록만 봅니다.', act: v => minor ? careerMinorDay(v) : careerSimDay(v) },
  ] };
}
// 컴퓨터끼리 끝낸 경기에서 내 선수가 나온 장면만 골라냄
function myPlays(G2, name){
  return (G2.log || []).filter(l => l.k === 'r' && l.s.includes(name)).map(l => l.s).slice(0, 8);
}

// 첫 화면 위쪽 상태 칸: 돈·인기·컨디션 (아이콘)
function careerTop(L){
  const c = life(L), p = myP(L), face = [15, 14, 14, 13, 12][(p.cond ?? 0) + 2];
  const ic = (sheet, i) => `<span class="oicon" aria-hidden="true" style="--ix:${i % 4};--iy:${Math.floor(i / 4)};background-image:url(img/${sheet}.png)"></span>`;
  return `<div class="crtop">${ic('icons2', 3)}<b>${won(c.money)}</b>${ic('icons2', 9)}<b>인기 ${c.fame || 0}</b>${ic('icons2', face)}<b>${COND[p.cond ?? 0]}</b></div>`;
}
