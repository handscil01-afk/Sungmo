'use strict';
/* ===================== 선수 육성: 성장 유형 · 피로와 부상 · 계약과 FA · 장비 등급 (계산만) =====================
   화면과 저장은 career.js·career-life.js가 맡고, 여기는 값을 계산하는 함수만 둠 (자동 시험이 그대로 불러 씀).
   저장 호환: L.career 에 칸만 더하고(c.v 2), 없으면 migrateCareer가 기본값을 채움 */
const CAREER_V = 2;

/* ---------- 피로와 부상 ----------
   fatigue 0~100: 훈련·경기로 쌓이고 쉬면 줄어듦. 40을 넘으면 훈련 효과가 줄고, 70을 넘으면 크게 줄며 부상 확률이 오름.
   부상은 부위와 일수가 있고, 다친 동안 그 부위와 관련된 능력이 잠깐 내려갔다가(c.injury.pen) 낫으면 돌아옴 */
const fatigueMul = c => (c.fatigue || 0) > 70 ? 0.5 : (c.fatigue || 0) > 40 ? 0.8 : 1;
const addFatigue = (c, n) => { c.fatigue = clamp((c.fatigue || 0) + n, 0, 100); };
const fatigueWord = c => { const f = c.fatigue || 0; return f > 70 ? '매우 피곤함' : f > 40 ? '피곤함' : f > 15 ? '보통' : '개운함'; };
const INJURY_PARTS = [
  { part:'어깨', pit:{ vel:-3, stf:-2 }, bat:{ pow:-3 } },
  { part:'팔꿈치', pit:{ ctl:-3, stf:-2 }, bat:{ con:-2 } },
  { part:'무릎', pit:{ sta:-4 }, bat:{ spd:-3, def:-2 } },
  { part:'햄스트링', pit:{ sta:-3 }, bat:{ spd:-4 } },
  { part:'손목', pit:{ ctl:-2 }, bat:{ con:-3, eye:-1 } },
];
const injuryChance = c => 0.005 + Math.max(0, (c.fatigue || 0) - 70) / 30 * 0.03;
function injure(L, p, c){
  const ip = pickOne(L, INJURY_PARTS), want = isPit(p) ? ip.pit : ip.bat, pen = {};
  Object.entries(want).forEach(([k, v]) => { if(p[k] == null) return; const nv = Math.max(1, p[k] + v); pen[k] = nv - p[k]; p[k] = nv; });
  const days = 3 + Math.floor(rnd(L) * 8) + ((c.fatigue || 0) > 70 ? 4 : 0);
  c.injury = { part: ip.part, days, pen }; c.hurt = days;
  return `${ip.part}을 다쳤습니다. ${days}일 동안 쉬어야 합니다.`;
}
function heal(p, c){
  if(c.injury){ Object.entries(c.injury.pen).forEach(([k, v]) => { if(p[k] != null) p[k] = clamp(p[k] - v, 1, potCap(k)); }); delete c.injury; }
}

/* ---------- 구단 예산과 계약 ----------
   예산은 팀의 시장 크기(고정)와 순위로 정해지고, 내 연봉 상한과 FA 영입 경쟁에만 씀 */
const teamMarket = key => { let h = 0; for(const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 97; return 55 + h % 30; };
function budgetOf(L, key){
  const r = standings(L).find(x => x.T.key === key);
  return Math.round(teamMarket(key) + (r ? (5 - r.rank) * 2 : 0));
}
const salaryCap = bud => 3500 + bud * 90;
function contractYears(p){ const a = p.age || 25; return a <= 30 ? 3 : a <= 34 ? 2 : 1; }
// 구단이 제시하는 계약 (선수 가치 × 예산)
function contractOffer(L, key){
  const c = life(L), p = myP(L), bud = budgetOf(L, key), value = salaryOf(L, true);
  const salary = clamp(Math.round(value * (0.85 + bud / 500) / 100) * 100, 3500, salaryCap(bud));
  return { team: key, salary, years: contractYears(p), bonus: Math.round(salary * 0.05 / 10) * 10, budget: bud };
}
// FA: 다른 구단 제시 둘~셋 (팀 전력·예산·주전 가능성이 다름)
function faOffers(L){
  const p = myP(L), keys = Object.keys(L.teams).filter(k => k !== L.my), out = [];
  while(out.length < 3 && keys.length){
    const k = keys.splice(Math.floor(rnd(L) * keys.length), 1)[0], o = contractOffer(L, k), T = L.teams[k];
    o.salary = clamp(Math.round(o.salary * (0.95 + rnd(L) * 0.2) / 100) * 100, 3500, salaryCap(o.budget));
    o.years = 1 + Math.floor(rnd(L) * 4);
    const rk = standings(L).find(x => x.T.key === k);
    o.rank = rk ? rk.rank : 5;
    // 주전 가능성: 내 능력이 그 팀 같은 자리 주전·선발 가운데 가장 약한 선수보다 얼마나 나은지
    const pool = isPit(p) ? (p.role === '선발' ? T.sp : T.rp) : T.bat.filter(b => b.pos === p.pos).concat(T.bat.length ? [] : []);
    const worst = (pool.length ? pool : T.bat).map(x => isPit(p) ? ratingPit(x) : ratingBat(x)).reduce((a, b) => Math.min(a, b), 99);
    o.starter = (isPit(p) ? ratingPit(p) : ratingBat(p)) - worst;
    out.push(o);
  }
  return out;
}
const faEligible = (L, p) => C(L).where === 'team' && (p.seasons || 0) >= 3;
function signContract(L, o){
  const c = life(L), p = myP(L);
  c.contract = { years: o.years, salary: o.salary, bonus: o.bonus || 0, until: L.season + o.years - 1, team: o.team };
  c.salary = o.salary; c.money += o.bonus || 0;
  delete c.offer;
  if(o.team !== L.my) transferTo(L, o.team);
}
// 이적: 새 팀의 같은 자리 선수와 맞바꿈 (두 팀의 명단 크기가 그대로)
function transferTo(L, key){
  const c = C(L), p = myP(L), A = L.teams[L.my], B = L.teams[key];
  const swap = (arrA, arrB, pickB) => { const i = arrA.indexOf(p); if(i < 0) return false; const j = arrB.indexOf(pickB); arrA[i] = pickB; arrB[j] = p; return true; };
  let done = false;
  if(isPit(p)){
    const list = p.role === '선발' ? 'sp' : 'rp', w = B[list].slice().sort((a, b) => ratingPit(a) - ratingPit(b))[0];
    done = swap(A[list], B[list], w);
    if(!done) for(const l of ['sp', 'rp']){ if(A[l].includes(p)){ const w2 = B[l].slice().sort((a, b) => ratingPit(a) - ratingPit(b))[0]; done = swap(A[l], B[l], w2); break; } }
  } else {
    for(const l of ['bat', 'bench']){
      if(!A[l].includes(p)) continue;
      const same = B[l].filter(b => b.pos === p.pos), pool = same.length ? same : B[l], w = pool.slice().sort((a, b) => ratingBat(a) - ratingBat(b))[0];
      done = swap(A[l], B[l], w); if(done && l === 'bat') w.pos = p.pos; break;
    }
  }
  if(!done) return false;
  L.my = key; c.team = key;
  crLog(L, `${p.name}, ${teamInfo(key).name}로 이적했습니다.`);
  return true;
}

/* ---------- 장비: 등급·성격·내구도·강화 ----------
   등급(일반·고급·명품)은 값으로 정하고, 성격은 '장타형'처럼 한 능력을 올리는 대신 다른 능력이 조금 내려감.
   내구도는 경기마다 줄어 50 아래면 효과 4분의 3, 20 아래면 절반. 수리하면 100. 강화(+1~+3)는 실패 없이 돈이 듦.
   장비로 오르는 능력의 합은 GEAR_CAP을 넘지 못함 ('장비로 이기는' 일이 없게) */
const GEAR_CAP = 10;
const GRADE_NAME = ['일반', '고급', '명품'];
const gearGrade = it => it.price >= 700 ? 2 : it.price >= 250 ? 1 : 0;
const GEAR_COST = { bat2:{ con:-1 }, bat4:{ eye:-1 }, glv2:{ spd:-1 }, shoe2:{ def:-1 }, acc2:{ ctl:0 } };   // 교환 관계(올리는 만큼 조금 내림)
const gearState = (c, id) => (c.gs ||= {})[id] ||= { dur:100, lv:0 };
const durMul = st => st.dur >= 50 ? 1 : st.dur >= 20 ? 0.75 : 0.5;
function gearDeltas(it, st, p){
  const d = {};
  (it.fx.all ? statKeys(p).map(k => [k, it.fx.all]) : Object.entries(it.fx)).forEach(([k, v]) => { d[k] = (d[k] || 0) + v; });
  const main = Object.keys(d)[0]; if(main) d[main] += st.lv || 0;
  Object.keys(d).forEach(k => { d[k] = Math.round(d[k] * durMul(st)); });
  Object.entries(GEAR_COST[it.id] || {}).forEach(([k, v]) => { d[k] = (d[k] || 0) + v; });
  return d;
}
const applyDeltas = (p, d, sign) => Object.entries(d).forEach(([k, v]) => { if(p[k] != null) p[k] = clamp(p[k] + v * sign, 1, k === 'vel' ? 165 : k === 'sta' ? 125 : 99); });
// 끼고 있는 장비의 효과를 처음부터 다시 계산해 능력치에 반영 (적용한 값은 c.applied에 적어 두어 정확히 되돌림)
function refreshGear(L){
  const c = life(L), p = myP(L);
  Object.values(c.applied || {}).forEach(d => applyDeltas(p, d, -1)); c.applied = {};
  const per = {};
  Object.entries(c.equip).forEach(([slot, id]) => { const it = itemOf(id); if(it && fits(it, p)) per[slot] = gearDeltas(it, gearState(c, id), p); });
  const pos = Object.values(per).reduce((s, d) => s + Object.values(d).filter(v => v > 0).reduce((a, b) => a + b, 0), 0), k = pos > GEAR_CAP ? GEAR_CAP / pos : 1;
  Object.entries(per).forEach(([slot, d]) => { const r = {}; Object.entries(d).forEach(([s, v]) => { r[s] = v > 0 ? Math.floor(v * k) : v; }); c.applied[slot] = r; applyDeltas(p, r, 1); });
}
const repairCost = it => Math.max(10, Math.round(it.price * 0.12));
const enhanceCost = (it, st) => Math.round(it.price * 0.5 * ((st.lv || 0) + 1));
// 경기 한 번에 장비가 닳음. 효과가 바뀌는 지점(50·20)을 넘으면 알림
function wearGear(L, n){
  const c = life(L), out = [];
  Object.entries(c.equip).forEach(([slot, id]) => { const it = itemOf(id); if(!it) return; const st = gearState(c, id), before = durMul(st); st.dur = Math.max(0, st.dur - n); if(durMul(st) !== before) out.push(`${it.name}이 많이 닳아 효과가 줄었습니다. 용품점 가방에서 수리하세요.`); });
  if(out.length) refreshGear(L);
  return out;
}

/* ---------- 옛 저장에 새 칸 채우기 ---------- */
function migrateCareer(L){
  const c = L.career; if(!c || c.v >= CAREER_V) return;
  c.fatigue ||= 0; c.gs ||= {}; c.applied ||= {};
  c.owned ||= []; c.equip ||= {};
  // 옛 장비는 능력치에 효과를 직접 더해 뒀음: 그 값을 적용한 값으로 적어 두면 refreshGear가 정확히 되돌림
  Object.entries(c.equip).forEach(([slot, id]) => { const it = itemOf(id); if(it){ const p = myP(L); c.applied[slot] = it.fx.all ? Object.fromEntries(statKeys(p).map(k => [k, it.fx.all])) : { ...it.fx }; } });
  if(!c.contract) c.contract = { years:1, salary: c.salary || 3000, bonus:0, until: L.season, team: L.my };
  c.v = CAREER_V;
  const p = myP(L); if(p) ensureGrowth(L, p);
  if(c.where === 'team' || c.where === 'minor') refreshGear(L);
}
if(typeof MIGRATIONS !== 'undefined') MIGRATIONS.league.push({ to:2, run: L => migrateCareer(L) });
