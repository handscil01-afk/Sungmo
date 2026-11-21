'use strict';
/* ===================== 선수 육성: 오늘의 목표 · 출석 도장 =====================
   - 오늘의 목표: 정규 시즌의 날마다 작은 목표 1~3개(훈련·마을 방문·소모품 쓰기·경기에서 안타·타점·삼진·무실점 이닝).
     목표는 그날(dayKey)과 선수 id로 정해지는 값이라 다시 열어도 같고, 리그 난수(rnd)는 쓰지 않음(경기 결과가 바뀌지 않게).
     이루는 순간 보상(돈·성장 점수·인기·소모품)을 받음. 진행은 훈련(trainDay)·방문·소모품·경기(careerGrowFromGame)에서 dailyHook으로 알림.
     저장: c.daily = { key, goals:[{ id, t, need, have, done, rw }], all }, 모두 이룬 날 수 c.dailyAll
   - 출석 도장: 실제 달력의 날마다 한 번. 도장 7칸을 채우면 한 바퀴(7번째 칸은 큰 보상), 누적 7일·30일에 배지.
     저장: c.att = { last:'2026-11-21', streak 연속, best 가장 긴 연속, total 누적, m7, m30 }
   - 두 기능 모두 육성 저장(L.career) 안에 칸을 더하기만 해서, 옛 저장은 처음 열 때 빈 값으로 시작함 */

// 그날·선수로 정해지는 작은 난수 (리그 난수를 건드리지 않음)
function dailyHash(s){ let h = 2166136261; for(const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
// 목표 종류. ok: 오늘 할 수 있는지 · ev: 진행을 알리는 사건 · bat/pit: 타자·투수만
const DAILY_POOL = [
  { id:'train', t:'훈련 1번 하기', ev:'train', ok:(L, c) => !(c.hurt > 0) },
  { id:'visit', t:'마을 한 곳 다녀오기', s:'팬 사인회·특별 코치·병원·휴가 가운데', ev:'visit', ok:() => true },
  { id:'goods', t:'소모품 1개 쓰기', s:'에너지 음료·테이핑·보약', ev:'goods', ok:(L, c) => Object.values(c.goods || {}).some(n => n > 0) || (c.money || 0) >= 30 },
  { id:'hit', t:'경기에서 안타 1개', ev:'game', bat:true, game:true },
  { id:'hit2', t:'경기에서 안타 2개', need:2, ev:'game', bat:true, game:true, hard:true },
  { id:'rbi', t:'경기에서 타점 올리기', ev:'game', bat:true, game:true },
  { id:'onbase', t:'경기에서 볼넷 1개 고르기', ev:'game', bat:true, game:true, hard:true },
  { id:'k', t:'경기에서 삼진 1개 잡기', ev:'game', pit:true, game:true },
  { id:'zero', t:'무실점으로 1이닝 이상 던지기', ev:'game', pit:true, game:true },
];
const DAILY_RW = [
  { k:'money', v:50 }, { k:'money', v:80 }, { k:'pts', v:5 }, { k:'fame', v:1 }, { k:'goods', id:'drink', v:1 }, { k:'money', v:120 }, { k:'pts', v:7 }, { k:'fame', v:2 }, { k:'goods', id:'tape', v:1 },
];
const dailyRwText = (rw, L) => rw.k === 'money' ? won(rw.v) : rw.k === 'pts' ? `성장 점수 ${rw.v}${rw.stat ? `(${ABIL_NAME[rw.stat]})` : ''}` : rw.k === 'fame' ? `인기 ${rw.v}` : `${(goodsOf(rw.id) || { name:'소모품' }).name} ${rw.v}개`;
// 오늘 내 선수가 경기에 나갈 것 같은지 (나가지 않는 날에는 경기 목표를 내지 않음)
function dailyPlays(L, c, p){
  if(L.phase !== 'season' || c.hurt > 0) return false;
  if(!isPit(p)) return true;
  if(c.where === 'minor') return p.role !== '선발';
  const T = L.teams[L.my];
  return p.role !== '선발' || (T.sp[T.rot % T.sp.length] || {}).id === c.id;
}
// 오늘의 목표 (없으면 만듦). 정규 시즌이 아니거나 캠프·은퇴 중이면 null
function dailyEnsure(L){
  const c = L && L.career; if(!c || c.retired || c.camp > 0 || L.phase !== 'season') return null;
  const key = dayKey(L);
  if(c.daily && c.daily.key === key) return c.daily;
  const p = myP(L); if(!p) return null;
  let h = dailyHash(`${key}#${c.id}`);
  const pick = n => { const v = h % n; h = dailyHash(String(h) + n); return v; };
  const fit = g => (!g.bat || !isPit(p)) && (!g.pit || isPit(p)) && (!g.ok || g.ok(L, c, p));
  const acts = DAILY_POOL.filter(g => !g.game && fit(g)), games = dailyPlays(L, c, p) ? DAILY_POOL.filter(g => g.game && fit(g)) : [];
  const list = [];
  const take = arr => { const a = arr.filter(g => !list.includes(g)); if(a.length) list.push(a[pick(a.length)]); };
  take(acts);
  if(games.length) take(pick(3) ? games.filter(g => !g.hard) : games);
  if(list.length < 3 && pick(2)) take(acts);
  const goals = list.map(g => {
    const rw = { ...DAILY_RW[pick(DAILY_RW.length)] };
    if(g.hard && rw.k === 'money') rw.v += 50;
    if(rw.k === 'pts'){ const ks = statKeys(p); rw.stat = ks[pick(ks.length)]; }
    return { id:g.id, t:g.t, need:g.need || 1, have:0, done:false, rw };
  });
  c.daily = { key, day: L.day + 1, season: L.season, goals, all:false };
  return c.daily;
}
function dailyGive(L, rw){
  const c = life(L);
  if(rw.k === 'money') c.money = (c.money || 0) + rw.v;
  else if(rw.k === 'fame') c.fame = (c.fame || 0) + rw.v;
  else if(rw.k === 'goods') c.goods[rw.id] = (c.goods[rw.id] || 0) + rw.v;
  else if(rw.k === 'pts') return grow(L, rw.stat || statKeys(myP(L))[0], rw.v);
  return [];
}
// 진행 알림: ev 'train'(d: 훈련 능력, 쉬기는 null) · 'visit' · 'goods' · 'game'(d: { ln, minor }). 돌려주는 값: 말할 글
function dailyHook(L, ev, d){
  try{
    const D = dailyEnsure(L); if(!D) return [];
    if(ev === 'game' && d && d.ln) dailyVs(L, d);
    const out = [];
    D.goals.forEach(g => {
      if(g.done) return;
      const def = DAILY_POOL.find(x => x.id === g.id); if(!def || def.ev !== ev) return;
      let have = g.have;
      if(ev === 'train'){ if(d) have++; }
      else if(ev === 'visit' || ev === 'goods') have++;
      else if(ev === 'game'){
        const s = (d && d.ln && d.ln.st) || {};
        if(g.id === 'hit' || g.id === 'hit2') have = s.h || 0;
        else if(g.id === 'rbi') have = s.rbi || 0;
        else if(g.id === 'onbase') have = s.bb || 0;
        else if(g.id === 'k') have = d.ln.used ? s.k || 0 : 0;
        else if(g.id === 'zero') have = d.ln.used && (s.out || 0) >= 3 && !(s.r > 0) ? 1 : 0;
      }
      g.have = Math.min(g.need, have);
      if(g.have >= g.need){
        g.done = true;
        out.push(`오늘의 목표 달성: ${g.t}! 보상 ${dailyRwText(g.rw)}.`, ...dailyGive(L, g.rw));
      }
    });
    if(!D.all && D.goals.length && D.goals.every(g => g.done)){
      D.all = true; const c = C(L); c.dailyAll = (c.dailyAll || 0) + 1; c.fame = (c.fame || 0) + 1;
      out.push(`오늘의 목표를 모두 이뤘습니다! 덤으로 인기 1. 지금까지 ${c.dailyAll}일 모두 이룸.`);
    }
    return out;
  }catch(e){ return []; }
}
const dailyGoalText = g => `${g.t}${g.need > 1 ? ` (${g.have}/${g.need})` : ''}, ${g.done ? '이룸' : `보상 ${dailyRwText(g.rw)}`}`;

/* ---------- 출석 도장 (실제 달력) ---------- */
// 오늘 날짜(이 기기 시각). 시험에서는 globalThis.BB_TODAY로 바꿀 수 있음
function attToday(){
  if(typeof globalThis !== 'undefined' && globalThis.BB_TODAY) return globalThis.BB_TODAY;
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const attDays = (a, b) => Math.round((Date.UTC(...b.split('-').map((x, i) => i === 1 ? x - 1 : +x)) - Date.UTC(...a.split('-').map((x, i) => i === 1 ? x - 1 : +x))) / 86400000);
// 도장 칸마다 보상 (7번째는 큰 보상)
const ATT_RW = [
  [{ k:'money', v:50 }], [{ k:'goods', id:'drink', v:1 }], [{ k:'money', v:80 }], [{ k:'fame', v:1 }], [{ k:'goods', id:'tape', v:1 }], [{ k:'money', v:120 }],
  [{ k:'money', v:300 }, { k:'goods', id:'tonic', v:1 }, { k:'fame', v:2 }],
];
const ATT_MS = [[7, 'att7', { k:'money', v:200 }], [30, 'att30', { k:'money', v:1000 }]];
function attOf(c){ return c.att ||= { last:null, streak:0, best:0, total:0 }; }
const attCan = c => !!c && !c.retired && attOf(c).last !== attToday();
// 지금 한 바퀴에서 찍은 도장 수 (0~7)
const attStamps = a => a.total ? ((a.total - 1) % 7) + 1 : 0;
function attClaim(L){
  const c = C(L); if(!attCan(c)) return null;
  const a = attOf(c), today = attToday();
  a.streak = a.last && attDays(a.last, today) === 1 ? a.streak + 1 : 1;
  a.best = Math.max(a.best || 0, a.streak); a.total++; a.last = today;
  const i = (a.total - 1) % 7, rws = ATT_RW[i], out = [];
  out.push(`출석 도장 ${i + 1}번째 칸! ${a.streak > 1 ? `${a.streak}일 연속 출석. ` : ''}보상 ${rws.map(r => dailyRwText(r)).join(', ')}.`);
  rws.forEach(r => out.push(...dailyGive(L, r)));
  if(i === 6) out.push('도장 7칸을 다 채웠습니다! 내일부터 새 카드가 시작됩니다.');
  ATT_MS.forEach(([n, badge, rw]) => {
    if(a.total >= n && !a['m' + n]){
      a['m' + n] = 1; out.push(`누적 출석 ${n}일 달성! 덤으로 ${dailyRwText(rw)}.`); dailyGive(L, rw);
      if(typeof crLog === 'function') crLog(L, `누적 출석 ${n}일을 달성했습니다.`);
      if(typeof badgeGive === 'function'){ try{ const m = badgeGive(L, badge); if(typeof m === 'string') out.push(m); else if(Array.isArray(m)) out.push(...m); }catch(e){} }
    }
  });
  return out;
}

/* ---------- 육성 첫 화면에 붙는 것 ---------- */
// 소리와 글로 하기의 상태 줄
function dailyLines(L){
  const c = L.career; if(!c || c.retired) return [];
  const out = [], D = dailyEnsure(L);
  if(D && D.goals.length) out.push(`오늘의 목표 ${D.goals.filter(g => g.done).length}/${D.goals.length}: ${D.goals.map(dailyGoalText).join('; ')}.`);
  if(attCan(c)) out.push('오늘 출석 도장을 아직 찍지 않았습니다. 10번에서 찍을 수 있습니다.');
  if(typeof paperLine === 'function'){ const s = paperLine(L); if(s) out.push(s); }
  return out;
}
// 육성 첫 화면 선택지 (10번: 오늘의 목표와 출석, 11번: 주간 리그 신문)
function dailyOpts(L){
  const c = L.career, D = dailyEnsure(L), can = attCan(c);
  const o = [{ n:10, key:'daily', t: can ? '출석 도장 찍기와 오늘의 목표' : '오늘의 목표와 출석 도장',
    s: `${D ? `목표 ${D.goals.filter(g => g.done).length}/${D.goals.length} 이룸. ` : ''}출석 ${attOf(c).total}일${can ? ', 오늘 도장 아직' : ''}.`, act: v => go(() => dailyScreen(null), v) }];
  if(typeof paperOpt === 'function'){ const p = paperOpt(L, 11); if(p) o.push(p); }
  return o;
}
// 오늘의 목표와 출석 도장 화면
// msg: 방금 한 일의 결과(도장 보상 등). 소리와 글로 하기는 결과 다음에 목표·도장 상태를 읽고, 화면 보며 하기는 알림 띠로 보여 줌
function dailyScreen(msg){
  const L = CR(), c = C(L), a = attOf(c), D = dailyEnsure(L), can = attCan(c);
  const say = [...(msg || [])];
  if(D && D.goals.length) D.goals.forEach((g, i) => say.push(`목표 ${i + 1}: ${dailyGoalText(g)}.`));
  else say.push(L.phase === 'season' ? '오늘은 목표가 없습니다.' : '오늘의 목표는 정규 시즌에만 있습니다.');
  say.push(`출석 도장 ${attStamps(a)}/7칸. 누적 ${a.total}일, ${a.streak}일 연속${a.best > a.streak ? `, 가장 길게 ${a.best}일` : ''}. ${can ? '오늘 도장을 아직 찍지 않았습니다.' : '오늘은 도장을 찍었습니다.'}`);
  const next = can ? (a.total % 7) : attStamps(a) % 7;
  say.push(`${can ? '오늘' : '다음'} 칸 보상: ${ATT_RW[next].map(r => dailyRwText(r)).join(', ')}. 7번째 칸은 큰 보상입니다.`);
  const ms = ATT_MS.find(([n]) => a.total < n);
  if(ms) say.push(`누적 ${ms[0]}일까지 ${ms[0] - a.total}일 남았습니다.`);
  if(c.dailyAll) say.push(`오늘의 목표를 모두 이룬 날: ${c.dailyAll}일.`);
  return { kind:'dl-home', msg, skTitle:'오늘의 목표', q: can ? '출석 도장을 찍을까요?' : '오늘의 목표와 출석 도장입니다.', say, back: v => go(careerHome, v), opts:[
    { n:1, key:'stamp', t:'출석 도장 찍기', hide: !can, s:`오늘 보상: ${ATT_RW[a.total % 7].map(r => dailyRwText(r)).join(', ')}`, act: v => { const out = attClaim(L) || []; saveLeague(); go(() => dailyScreen(out), v); } },
    { n:9, key:'back', t:'라커룸으로 돌아가기', act: v => go(careerHome, v) },
  ] };
}

/* ---------- 내 선수의 팀별 기록 (맞대결 전적 화면에서 씀) ----------
   1군 경기만 셈. c.vs = { season, t:{ 팀:{ g, ab, h, hr, rbi, bb, out, r, k } } } (시즌이 바뀌면 새로) */
function dailyVs(L, d){
  if(d.minor) return;
  const c = C(L), G = d.G; if(!G || !G.teams) return;
  const opp = G.teams.map(T => T.key).find(k => k !== L.my); if(!opp) return;
  if(!c.vs || c.vs.season !== L.season) c.vs = { season: L.season, t:{} };
  const v = c.vs.t[opp] ||= {}, s = d.ln.st || {};
  if(d.ln.bat){ if(!s.pa) return; ['ab', 'h', 'hr', 'rbi', 'bb'].forEach(k => { v[k] = (v[k] || 0) + (s[k] || 0); }); }
  else { if(!d.ln.used) return; ['out', 'r', 'k'].forEach(k => { v[k] = (v[k] || 0) + (s[k] || 0); }); }
  v.g = (v.g || 0) + 1;
}
