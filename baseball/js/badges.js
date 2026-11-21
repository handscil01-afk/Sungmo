'use strict';
/* ===================== 업적 배지 · 골든글러브 · 트로피 모으기 (계산만, 화면 없음) =====================
   배지 24개(img/badges.png 64×64 칸, 6칸 × 4줄, BADGES 차례). 받은 배지는 저장 안에 { id:{ season, day } }로 남김
   - 선수 육성: L.career.badges (내 선수의 업적)
   - 리그(감독): L.badges (우리 팀의 업적, BADGES의 lg가 참인 것만)
   badgeGive(L, id): 처음 받으면 true. 새 배지는 BADGE_Q에 쌓았다가 화면이 바뀔 때 알림(awards-show.js badgeFlush)
   badgeCheck(L): 저장 상태(기록·수상·업적 글·인기·돈·출석)를 보고 받을 만한 배지를 모두 줌. 옛 저장도 처음 볼 때 한꺼번에 받음
   Node 시험에서도 쓰도록 화면(DOM)은 건드리지 않음 */
const BADGES = [
  { id:'h1', name:'첫 안타', desc:'1군 경기에서 첫 안타를 칩니다.' },
  { id:'hr1', name:'첫 홈런', desc:'1군 경기에서 첫 홈런을 칩니다.' },
  { id:'w1', name:'첫 승리', desc:'1군 경기에서 첫 승리 투수가 됩니다.' },
  { id:'sv1', name:'첫 세이브', desc:'1군 경기에서 첫 세이브를 올립니다.' },
  { id:'win10', name:'10연승', desc:'1군에 있는 동안 팀이 10연승을 합니다.', lg:true, lgDesc:'우리 팀이 정규 시즌 10연승을 합니다.' },
  { id:'cycle', name:'사이클링 히트', desc:'한 경기에서 단타·2루타·3루타·홈런을 모두 칩니다.', lg:true, lgDesc:'우리 팀 선수가 사이클링 히트를 칩니다.' },
  { id:'nohit', name:'노히트 노런', desc:'혼자 끝까지 던져 안타를 하나도 맞지 않습니다.', lg:true, lgDesc:'우리 팀 투수가 노히트 노런을 합니다.' },
  { id:'perfect', name:'퍼펙트게임', desc:'혼자 끝까지 던져 한 명도 출루시키지 않습니다.', lg:true, lgDesc:'우리 팀 투수가 퍼펙트게임을 합니다.' },
  { id:'k10', name:'한 경기 삼진 10개', desc:'1군 경기 하나에서 삼진 10개를 잡습니다.' },
  { id:'sbking', name:'도루왕', desc:'시즌 도루 1위로 도루왕이 됩니다.', lg:true, lgDesc:'우리 팀 선수가 도루왕이 됩니다.' },
  { id:'h100', name:'시즌 100안타', desc:'한 시즌 1군에서 안타 100개를 칩니다.', lg:true, lgDesc:'우리 팀 선수가 한 시즌 안타 100개를 칩니다.' },
  { id:'hr30', name:'시즌 30홈런', desc:'한 시즌 1군에서 홈런 30개를 칩니다.', lg:true, lgDesc:'우리 팀 선수가 한 시즌 홈런 30개를 칩니다.' },
  { id:'up', name:'1군 승격', desc:'퓨처스리그(2군)에서 1군으로 올라갑니다.' },
  { id:'allstar', name:'올스타', desc:'올스타전에 뽑힙니다.' },
  { id:'champ', name:'우승', desc:'1군 선수로 한국시리즈 우승을 합니다.', lg:true, lgDesc:'우리 팀이 한국시리즈 우승을 합니다.' },
  { id:'mvp', name:'MVP', desc:'정규 시즌 MVP를 받습니다.', lg:true, lgDesc:'우리 팀 선수가 정규 시즌 MVP를 받습니다.' },
  { id:'roy', name:'신인왕', desc:'신인왕을 받습니다.', lg:true, lgDesc:'우리 팀 선수가 신인왕을 받습니다.' },
  { id:'gg', name:'골든글러브', desc:'시즌이 끝나고 자기 자리의 골든글러브를 받습니다.', lg:true, lgDesc:'우리 팀 선수가 골든글러브를 받습니다.' },
  { id:'hof', name:'명예의 전당', desc:'은퇴한 뒤 명예의 전당에 들어갑니다.', lg:true, lgDesc:'우리 팀에서 은퇴한 선수가 명예의 전당에 들어갑니다.' },
  { id:'att7', name:'출석 7일', desc:'출석 도장을 7일 찍습니다.' },
  { id:'att30', name:'출석 30일', desc:'출석 도장을 30일 찍습니다.' },
  { id:'train100', name:'훈련왕', desc:'훈련을 100번 합니다(스프링캠프 집중 훈련 포함).' },
  { id:'fame1000', name:'인기 1000', desc:'인기가 1000이 됩니다.' },
  { id:'rich', name:'백만장자', desc:'가진 돈 5억 원을 모읍니다.' },
];
const RICH_MONEY = 50000;   // 돈 단위는 만 원 (career-life.js won)
const badgeOf = id => BADGES.find(b => b.id === id) || null;
// 지금 저장에서 쓰는 배지 목록 (리그는 우리 팀 업적만)
const badgeList = L => L && L.career ? BADGES : BADGES.filter(b => b.lg);
const badgeDesc = (L, b) => L && !L.career && b.lgDesc ? b.lgDesc : b.desc;
function badgeStore(L){ return L.career ? (L.career.badges ||= {}) : (L.badges ||= {}); }
// 새로 받은 배지(알림을 기다림). 너무 많이 쌓이지 않게 마지막 몇 개만
const BADGE_Q = [];
function badgeGive(L, id, when){
  const b = badgeOf(id);
  if(!L || !b || (!L.career && !b.lg)) return false;
  const S = badgeStore(L);
  if(S[id]) return false;
  S[id] = { season: (when && when.season) || L.season, day: when ? (when.day || null) : (L.day || 0) + 1 };
  BADGE_Q.push({ id, name: b.name, desc: badgeDesc(L, b) });
  if(BADGE_Q.length > 8) BADGE_Q.shift();
  return true;
}
// 내 선수 (2군이면 career.p, 1군이면 팀 명단 안)
function badgeMe(L){
  const c = L.career; if(!c) return null;
  if(c.where === 'minor' && c.p) return c.p;
  const f = typeof findPlayer === 'function' ? findPlayer(L, c.id) : null;
  return f ? f.p : c.p || null;
}
// 상태를 보고 받을 만한 배지를 모두 줌. 돌려주는 값: 새로 받은 수
function badgeCheck(L){
  if(!L || !L.teams || !L.my) return 0;
  let n = 0;
  const give = (id, when) => { if(badgeGive(L, id, when)) n++; };
  const T = L.teams[L.my], done = L.phase === 'done', A = L.awards || {};
  const streak10 = T && (T.last || []).length >= 10 && T.last.slice(-10).every(x => x === 'W');
  const feats = L.feats || [];
  const c = L.career;
  if(c){
    const p = badgeMe(L); if(!p) return n;
    const cs = p.cs || {}, ss = p.ss || {}, tot = k => (cs[k] || 0) + (ss[k] || 0);
    const first = c.where !== 'minor';
    if(tot('h') > 0) give('h1'); if(tot('hr') > 0) give('hr1'); if(tot('w') > 0) give('w1'); if(tot('sv') > 0) give('sv1');
    if((ss.h || 0) >= 100) give('h100'); if((ss.hr || 0) >= 30) give('hr30');
    if(first && !c.retired && streak10) give('win10');
    feats.forEach(f => { if(f.id !== c.id) return; const w = { season: f.season, day: f.day };
      if(f.kind === 'cycle') give('cycle', w); if(f.kind === 'nohit' || f.kind === 'perfect') give('nohit', w); if(f.kind === 'perfect') give('perfect', w); });
    if(first) give('up');
    (c.ach || []).forEach(a => {
      const w = { season: a.season, day: a.day };
      if(/1군에 올라왔습니다/.test(a.text)) give('up', w);
      if(/올스타에 뽑혔습니다/.test(a.text)) give('allstar', w);
      if(/명예의 전당 헌액/.test(a.text)) give('hof', w);
    });
    (p.awards || []).forEach(s => {
      const m = /^(\d+)시즌 (.+)$/.exec(s); if(!m) return;
      const w = { season: +m[1], day: null }, what = m[2];
      if(what === 'MVP') give('mvp', w); else if(what === '신인왕') give('roy', w); else if(what === '골든글러브') give('gg', w); else if(what === '도루왕') give('sbking', w);
    });
    if(done && L.champ === L.my && first && !c.retired){
      give('champ');
      if(!(c.ksWins ||= []).includes(L.season)) c.ksWins.push(L.season);   // 트로피 진열장의 한국시리즈 우승 트로피
    }
    if((c.trainN || 0) >= 100) give('train100');
    if((c.fame || 0) >= 1000) give('fame1000');
    if((c.money || 0) >= RICH_MONEY) give('rich');
    if(c.att && c.att.total >= 7) give('att7');
    if(c.att && c.att.total >= 30) give('att30');
    return n;
  }
  // 리그(감독): 우리 팀의 업적
  (L.history || []).forEach(h => { if(h.champ === L.my) give('champ', { season: h.season, day: null }); });
  if(done && L.champ === L.my) give('champ');
  if(L.phase === 'season' && streak10) give('win10');
  feats.forEach(f => { if(f.team !== L.my) return; const w = { season: f.season, day: f.day };
    if(f.kind === 'cycle') give('cycle', w); if(f.kind === 'nohit' || f.kind === 'perfect') give('nohit', w); if(f.kind === 'perfect') give('perfect', w); });
  const mineAw = (aw, season) => {
    if(!aw) return; const w = { season, day: null };
    if(aw.mvp && aw.mvp.team === L.my) give('mvp', w);
    if(aw.roy && aw.roy.team === L.my) give('roy', w);
    if((aw.gg || []).some(g => g.team === L.my)) give('gg', w);
    if((aw.titles || []).some(t => t.st === 'sb' && t.team === L.my)) give('sbking', w);
  };
  (L.history || []).forEach(h => mineAw(h.awards, h.season));
  if(done) mineAw(A, L.season);
  if(T) [...T.bat, ...T.bench].forEach(p => { const s = p.ss || {}; if((s.h || 0) >= 100) give('h100'); if((s.hr || 0) >= 30) give('hr30'); });
  (L.hof || []).forEach(h => { if(h.team === L.my) give('hof', { season: h.season, day: null }); });
  return n;
}
// 1군 경기 하나가 끝났을 때 (career.js careerGrowFromGame): 첫 안타·첫 승처럼 그 경기에서 바로 알 수 있는 것과 한 경기 삼진 10개
function badgeGame(L, ln, G, minor){
  if(!L || !L.career || minor || !ln || !ln.st) return;
  const c = L.career, s = ln.st, dec = (G && G.decision) || {};
  if(ln.bat){ if(s.h) badgeGive(L, 'h1'); if(s.hr) badgeGive(L, 'hr1'); }
  else if(ln.used){
    if(dec.w === c.id) badgeGive(L, 'w1');
    if(dec.s === c.id) badgeGive(L, 'sv1');
    if((s.k || 0) >= 10) badgeGive(L, 'k10');
  }
}
// 훈련 한 번 (career.js trainDay, career-story.js 캠프 집중 훈련)
function badgeTrain(L){
  const c = L && L.career; if(!c) return;
  c.trainN = (c.trainN || 0) + 1;
  if(c.trainN >= 100) badgeGive(L, 'train100');
}

/* ---------- 골든글러브 ----------
   정규 시즌이 끝나면(league.js endSeason) 자리마다 한 명: 투수 1, 포수·1루수·2루수·3루수·유격수 1, 외야수 3, 지명타자 1.
   타자는 규정 타석의 2/3 이상, 점수는 MVP 점수에 수비 능력을 조금 더함 */
const GG_POS = [['C', '포수'], ['1B', '1루수'], ['2B', '2루수'], ['3B', '3루수'], ['SS', '유격수'], ['OF', '외야수', 3], ['DH', '지명타자']];
function awardsGG(L){
  if(!L || !L.awards || typeof mvpScore !== 'function') return [];
  const games = Math.max(1, ...Object.values(L.teams).map(T => T.w + T.l + T.d));
  const bats = [], pits = [];
  for(const k in L.teams){
    const T = L.teams[k];
    [...T.bat, ...T.bench].forEach(p => { const s = p.ss || {}; if((s.pa || 0) >= games * 2) bats.push({ p, k, v: mvpScore(p) + (p.def || 0) * 0.15 * (s.pa || 0) / games }); });
    [...T.sp, ...T.rp].forEach(p => { const s = p.ss || {}; if((s.out || 0) >= games * 1.5) pits.push({ p, k, v: mvpScore(p) }); });
  }
  const out = [], used = new Set();
  const pick = (list, pos, n = 1) => list.filter(x => !used.has(x.p.id)).sort((a, b) => b.v - a.v).slice(0, n).forEach(x => { used.add(x.p.id); out.push({ pos, id: x.p.id, name: x.p.name, team: x.k }); });
  pick(pits, '투수');
  GG_POS.forEach(([key, pos, n]) => pick(bats.filter(x => key === 'OF' ? ['LF', 'CF', 'RF'].includes(x.p.pos) : x.p.pos === key), pos, n || 1));
  L.awards.gg = out;
  out.forEach(g => { const f = findPlayer(L, g.id); if(f) (f.p.awards ||= []).push(`${L.season}시즌 골든글러브`); });
  return out;
}

/* ---------- 트로피 진열장에 놓을 것 ----------
   트로피 그림(img/trophies.png 128×128 칸, 4칸 × 2줄): 0 한국시리즈 우승 · 1 MVP · 2 신인왕 · 3 홈런왕 / 4 타격왕 · 5 골든글러브 · 6 다승왕(투수 타이틀) · 7 명예의 전당 명판 */
const TRO_ORDER = [['한국시리즈 우승', 0], ['MVP', 1, '정규 시즌 MVP'], ['한국시리즈 MVP', 1], ['신인왕', 2], ['골든글러브', 5], ['홈런왕', 3], ['타격왕', 4], ['타점왕', 4], ['최다 안타', 4], ['도루왕', 4],
  ['다승왕', 6], ['평균자책점 1위', 6], ['세이브왕', 6], ['홀드왕', 6], ['탈삼진왕', 6], ['올스타전 MVP', 1], ['홈런 더비 우승', 3], ['명예의 전당', 7]];
// 돌려주는 값: [{ key, name, cell, n, who:['3시즌', …] 또는 ['3시즌 홍길동', …] }] (받은 것만, TRO_ORDER 차례)
function trophyList(L){
  const got = {};
  const add = (key, label) => { if(!TRO_ORDER.some(t => t[0] === key)) return; (got[key] ||= []).push(label); };
  const c = L.career;
  if(c){
    const p = badgeMe(L) || {};
    (c.ksWins || []).forEach(s => add('한국시리즈 우승', `${s}시즌`));
    (p.awards || []).forEach(a => { const m = /^(\d+)시즌 (.+)$/.exec(a); if(m) add(m[2], `${m[1]}시즌`); });
    const h = (L.hof || []).find(x => x.id === c.id); if(h) add('명예의 전당', `${h.season}시즌 헌액`);
  } else {
    const team = (aw, season) => {
      if(!aw) return;
      const one = (x, key) => { if(x && x.team === L.my) add(key, `${season}시즌 ${x.name}`); };
      one(aw.mvp, 'MVP'); one(aw.ksMvp, '한국시리즈 MVP'); one(aw.roy, '신인왕');
      (aw.titles || []).forEach(t => one(t, TITLE_NAME[t.st]));
      (aw.gg || []).forEach(g => one(g, '골든글러브'));
    };
    (L.history || []).forEach(h => { if(h.champ === L.my) add('한국시리즈 우승', `${h.season}시즌`); team(h.awards, h.season); });
    if(L.phase === 'done'){ if(L.champ === L.my) add('한국시리즈 우승', `${L.season}시즌`); team(L.awards, L.season); }
    (L.hof || []).forEach(h => { if(h.team === L.my) add('명예의 전당', `${h.season}시즌 ${h.name}`); });
  }
  return TRO_ORDER.filter(t => got[t[0]]).map(([key, cell, name]) => ({ key, name: name || key, cell, n: got[key].length, who: got[key] }));
}
const badgeWhen = g => g ? `${g.season}시즌${g.day ? ` ${g.day}일째` : ''}` : '';
