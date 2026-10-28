'use strict';
/* ===================== 리그 =====================
   10개 팀이 일정대로 시즌을 치르고, 상위 5팀이 KBO 방식 포스트시즌을 치름.
   선수는 시즌 내내 같은 사람이고 기록이 쌓임 (ss: 시즌 기록). 화면과 따로 동작하며 Node 시험에서도 씀.
   L(리그 상태)은 JSON으로 이 기기에 저장함. 난수 씨앗도 L 안에 있어서 rnd(L)로 씀 */
const LEAGUE_LEN = [18, 36, 72, 144];
const ROLE_BAT = ['장타 대타', '교타 대타', '대주자', '수비 요원'];

// 경기용으로만 쓰는 값은 빼고 리그에 둘 선수 정보만 남김
function leaguePlayer(p, role){
  const q = { ...p };
  ['st', 'n', 'load', 'used', 'warned', 'seen', 'gs', 'entryLead', 'exitLead'].forEach(k => delete q[k]);
  if(role) q.role = role;
  q.ss = {};
  return q;
}
function leagueTeam(L, key){
  const S = STYLES[teamInfo(key).style];
  const bat = bestOrder([...Array(9)].map((_, i) => leaguePlayer(makeBatter(L, S, i, 0))));
  const bench = BENCH_ROLES.map(b => leaguePlayer(makeBench(L, S, b, 0)));
  const sp = [...Array(5)].map(() => leaguePlayer(makePitcher(L, S, true, 0), '선발'));
  const rp = [...Array(6)].map((_, i) => leaguePlayer(makePitcher(L, S, false, 0), i === 0 ? '마무리' : '불펜'));
  return { key, bat, bench, sp, rp, rot:0, w:0, l:0, d:0, rs:0, ra:0, last:[] };
}
// o: { my:내 팀, len:팀당 경기 수, mode, unit, inn:이닝, seed }
function leagueNew(o){
  const L = { v:1, rng: (o.seed >>> 0) || 1, names:[], season:1, my:o.my, len:o.len, mode:o.mode, unit:o.unit || 'pitch', inn:o.inn || 9,
    day:0, phase:'season', teams:{}, sched:[], post:null, awards:null, champ:null, news:[] };
  TEAMS.forEach(t => { L.teams[t.key] = leagueTeam(L, t.key); });
  L.sched = makeSchedule(L);
  return L;
}
// 원형 일정: 9일이면 모든 팀이 서로 한 번씩. 한 바퀴마다 홈·원정을 바꿈
function makeSchedule(L){
  const keys = TEAMS.map(t => t.key), n = keys.length, rounds = [];
  let arr = keys.slice();
  for(let r = 0; r < n - 1; r++){
    const day = [];
    for(let i = 0; i < n / 2; i++){ const a = arr[i], b = arr[n - 1 - i]; day.push(r % 2 ? [a, b] : [b, a]); }
    rounds.push(day);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  const out = [];
  for(let c = 0; c < L.len / (n - 1); c++) rounds.forEach(day => out.push(day.map(([a, h]) => c % 2 ? { a:h, h:a } : { a, h })));
  return out;
}
const allPlayers = T => [...T.bat, ...T.bench, ...T.sp, ...T.rp];
const findPlayer = (L, id) => { for(const k in L.teams){ const p = allPlayers(L.teams[k]).find(x => x.id === id); if(p) return { p, T: L.teams[k] }; } return null; };
const teamName = key => teamInfo(key).short;

/* ---------- 순위 ---------- */
const pctOf = T => (T.w + T.l) ? T.w / (T.w + T.l) : 0;
function standings(L){
  const list = Object.values(L.teams).slice().sort((a, b) => pctOf(b) - pctOf(a) || b.w - a.w || (b.rs - b.ra) - (a.rs - a.ra));
  const top = list[0];
  return list.map((T, i) => ({ T, rank: i + 1, gb: ((top.w - T.w) + (T.l - top.l)) / 2 }));
}
const pctText = T => pctOf(T).toFixed(3).replace(/^0/, '');
function streakText(T){
  const l = T.last; if(!l.length) return '';
  const x = l[l.length - 1]; let n = 0;
  for(let i = l.length - 1; i >= 0 && l[i] === x; i--) n++;
  return x === 'W' ? `${n}연승` : x === 'L' ? `${n}연패` : `${n}무`;
}
function recentText(T){ const r = T.last.slice(-10); return `최근 ${r.length}경기 ${r.filter(x => x === 'W').length}승 ${r.filter(x => x === 'L').length}패${r.includes('D') ? ` ${r.filter(x => x === 'D').length}무` : ''}`; }
const gbText = gb => gb === 0 ? '선두' : `${gb}경기 차`;

/* ---------- 경기 만들기 ---------- */
// 오늘 선발(로테이션)과 쉬지 않아도 되는 불펜으로 경기 명단을 만듦
function gameRoster(L, key){
  const T = L.teams[key], st = T.sp[T.rot % T.sp.length];
  let rp = T.rp.filter(p => !p.rest);
  if(rp.length < 3) rp = T.rp.slice();   // 불펜이 너무 모자라면 쉬어야 할 투수도 대기
  return { key, bat: T.bat, bench: T.bench, pit: [st, ...rp] };
}
function leagueGameOpts(L, a, h, ctrl, mode, unit){
  return { mode, unit, innings: L.inn, teams:[a, h], ctrl, rosters:[gameRoster(L, a), gameRoster(L, h)], seed: (rnd(L) * 4294967296) >>> 0 };
}
// 컴퓨터끼리 한 경기 (감독 모드 계산: 대타·투수 교체·판독까지 컴퓨터가 함)
function leagueSim(L, a, h){
  const G = newGame(leagueGameOpts(L, a, h, ['cpu', 'cpu'], 'manager'));
  let guard = 0;
  while(!G.over && guard++ < 2000){
    if(G.review) resolveReview(G, aiChallenge(G));
    else playStep(G, aiDefChoice(G), aiOffChoice(G));
  }
  flush(G);
  return G;
}

/* ---------- 경기 결과 반영 ---------- */
const addTo = (o, k, v) => { o[k] = (o[k] || 0) + (v || 0); };
function leagueApply(L, G, post){
  const dec = G.decision || {};
  G.teams.forEach((GT, i) => {
    const T = L.teams[GT.key], O = G.teams[1 - i], rs = runsOf(GT), ra = runsOf(O);
    if(!post){
      T.rs += rs; T.ra += ra;
      const r = rs > ra ? 'W' : rs < ra ? 'L' : 'D';
      T[r === 'W' ? 'w' : r === 'L' ? 'l' : 'd']++;
      T.last.push(r); if(T.last.length > 20) T.last.shift();
    }
    T.rot++;
    const key = post ? 'ps' : 'ss';
    // 타자: 이 경기에 나온 모든 선수 (교체되어 나간 선수 포함)
    [...GT.bat, ...GT.gone].forEach(b => {
      if(!b.st.pa) return;
      const f = findPlayer(L, b.id); if(!f) return;
      const s = f.p[key] ||= {};
      addTo(s, 'g', 1); ['pa', 'ab', 'h', 'hr', 'rbi', 'bb', 'k', 'r', 'sb'].forEach(k => addTo(s, k, b.st[k]));
    });
    // 투수: 던진 사람만. 불펜은 30구 이상 던졌거나 이틀 연속이면 다음 경기를 쉼
    const used = new Set(GT.pit.filter(p => p.used).map(p => p.id));
    GT.pit.forEach(p => {
      const f = findPlayer(L, p.id); if(!f) return;
      const P = f.p;
      if(!used.has(p.id)){ if(P.role !== '선발'){ P.streak = 0; P.rest = 0; } return; }
      const s = P[key] ||= {};
      addTo(s, 'g', 1); if(p.gs) addTo(s, 'gs', 1);
      ['out', 'h', 'r', 'bb', 'k', 'hr'].forEach(k => addTo(s, k, p.st[k]));
      if(dec.w === p.id) addTo(s, 'w', 1);
      if(dec.l === p.id) addTo(s, 'l', 1);
      if(dec.s === p.id) addTo(s, 'sv', 1);
      if((dec.h || []).includes(p.id)) addTo(s, 'hd', 1);
      if(P.role !== '선발'){ P.streak = (P.streak || 0) + 1; P.rest = p.n >= 30 || P.streak >= 2 ? 1 : 0; if(P.rest) P.streak = 0; }
    });
    // 오늘 명단에 없던(쉰) 불펜은 회복
    const inGame = new Set(GT.pit.map(p => p.id));
    T.rp.forEach(P => { if(!inGame.has(P.id)){ P.rest = 0; P.streak = 0; } });
    // 내 팀은 경기를 시작할 때의 타순을 다음 경기에도 씀 (감독 모드의 경기 전 준비)
    if(GT.key === L.my && GT.startIds && GT.startIds.length === 9){
      const pool = [...T.bat, ...T.bench], byId = id => pool.find(p => p.id === id);
      const nb = GT.startIds.map(byId);
      if(nb.every(Boolean)){ T.bat = nb; T.bench = pool.filter(p => !GT.startIds.includes(p.id)); }
    }
  });
}
// 날마다 컨디션이 조금씩 바뀜 (절반은 어제와 같음)
function leagueNewDay(L){ Object.values(L.teams).forEach(T => allPlayers(T).forEach(p => { if(rnd(L) < 0.5) p.cond = condRoll(L); })); }

/* ---------- 오늘의 경기 ---------- */
// 정규 시즌이면 그날 5경기, 포스트시즌이면 지금 시리즈의 다음 경기 하나
function todayGames(L){
  if(L.phase === 'season') return L.sched[L.day] || [];
  if(L.phase === 'post' && L.post && !L.post.done){ const S = L.post.cur; return [seriesGame(S)]; }
  return [];
}
const myGameToday = L => todayGames(L).find(g => g.a === L.my || g.h === L.my) || null;
// 하루 진행: 내 경기 결과(G)가 있으면 그것을 쓰고, 나머지는 컴퓨터끼리. 결과 문장을 돌려줌
function leagueAdvance(L, myG){
  const games = todayGames(L), out = [];
  if(!games.length) return out;
  leagueNewDay(L);
  const post = L.phase === 'post';
  games.forEach(g => {
    const mine = myG && (g.a === L.my || g.h === L.my);
    const G = mine ? myG : leagueSim(L, g.a, g.h);
    g.ra = runsOf(G.teams[0]); g.rh = runsOf(G.teams[1]);
    leagueApply(L, G, post);
    out.push(`${teamName(g.a)} ${g.ra} 대 ${g.rh} ${teamName(g.h)}`);
    if(post) seriesResult(L, g, G);
  });
  if(!post){ L.day++; if(L.day >= L.sched.length) startPost(L); }
  return out;
}

/* ---------- 포스트시즌 (KBO 방식) ----------
   와일드카드 결정전: 4위·5위, 4위가 1승을 안고 시작해 먼저 2승 (비기면 4위 쪽 1승)
   준플레이오프: 3위 대 와일드카드 승자, 5전 3선승 · 플레이오프: 2위 대 준플레이오프 승자, 5전 3선승
   한국시리즈: 1위 대 플레이오프 승자, 7전 4선승. 높은 순위 팀이 1·2(·5)차전(한국시리즈는 1·2·6·7차전)을 홈에서 함 */
const ROUND = {
  wc:   { name:'와일드카드 결정전', need:2, home:'HHH', next:'semi' },
  semi: { name:'준플레이오프', need:3, home:'HHLLH', next:'po' },
  po:   { name:'플레이오프', need:3, home:'HHLLH', next:'ks' },
  ks:   { name:'한국시리즈', need:4, home:'HHLLLHH', next:null },
};
function startPost(L){
  const st = standings(L);
  L.phase = 'post';
  L.final = st.map(x => x.T.key);
  L.post = { seeds: L.final.slice(0, 5), done:false, log:[] };
  L.post.cur = newSeries('wc', L.final[3], L.final[4], 1);
  L.news.push(`정규 시즌 끝! 1위 ${teamName(L.final[0])}. 포스트시즌에는 ${L.post.seeds.map((k, i) => `${i + 1}위 ${teamName(k)}`).join(', ')}, 다섯 팀이 나갑니다.`);
}
const newSeries = (round, hi, lo, hiStart) => ({ round, hi, lo, w:{ [hi]: hiStart || 0, [lo]: 0 }, n:0, mvp:{} });
function seriesGame(S){
  const R = ROUND[S.round], homeHi = (R.home[S.n] || 'H') === 'H';
  return { a: homeHi ? S.lo : S.hi, h: homeHi ? S.hi : S.lo, label: `${R.name} ${S.n + 1}차전` };
}
function seriesText(L){
  const S = L.post && L.post.cur; if(!S) return '';
  const R = ROUND[S.round];
  return `${R.name}: ${teamName(S.hi)} ${S.w[S.hi]}승, ${teamName(S.lo)} ${S.w[S.lo]}승 (먼저 ${R.need}승).`;
}
function seriesResult(L, g, G){
  const S = L.post.cur, R = ROUND[S.round];
  S.n++;
  const win = g.ra > g.rh ? g.a : g.rh > g.ra ? g.h : null;
  if(win) S.w[win]++;
  else if(S.round === 'wc') S.w[S.hi]++;   // 와일드카드 결정전은 비기면 4위 쪽
  // 시리즈 MVP 후보: 안타·홈런·타점
  G.teams.forEach(T => [...T.bat, ...T.gone].forEach(b => { S.mvp[b.id] = (S.mvp[b.id] || 0) + b.st.h + b.st.hr * 2 + b.st.rbi; }));
  const done = [S.hi, S.lo].find(k => S.w[k] >= R.need);
  if(!done) return;
  const lose = done === S.hi ? S.lo : S.hi;
  L.post.log.push(`${R.name}: ${josa(teamName(done), '이', '가')} ${S.w[done]}승 ${S.w[lose]}패로 이겼습니다.`);
  L.news.push(`${R.name} 끝! ${teamName(done)} 승리, ${S.w[done]}승 ${S.w[lose]}패.`);
  if(!R.next){ endSeason(L, done, S); return; }
  const seedOf = k => L.final.indexOf(k);
  const opp = { semi: L.final[2], po: L.final[1], ks: L.final[0] }[R.next];
  const [hi, lo] = seedOf(opp) < seedOf(done) ? [opp, done] : [done, opp];
  L.post.cur = newSeries(R.next, hi, lo, 0);
}

/* ---------- 시상 ---------- */
const ipText = out => `${Math.floor(out / 3)}${out % 3 ? ` ${out % 3}/3` : ''}이닝`;
const avgOf = s => s && s.ab ? s.h / s.ab : 0;
const eraOf = s => s && s.out ? s.r * 27 / s.out : 99;
// 타율 0.312를 "3할 1푼 2리"로
function avgText(v){
  const m = Math.round(v * 1000); if(m >= 1000) return '10할';
  const a = Math.floor(m / 100), b = Math.floor(m / 10) % 10, c = m % 10;
  return `${a ? a + '할' : ''}${b ? ` ${b}푼` : ''}${c ? ` ${c}리` : ''}`.trim() || '0';
}
function leaders(L, stat, n = 10){
  const games = Math.max(1, ...Object.values(L.teams).map(T => T.w + T.l + T.d));
  const rows = [];
  for(const k in L.teams){
    const T = L.teams[k];
    if(['avg', 'hr', 'rbi', 'h', 'sb'].includes(stat)) [...T.bat, ...T.bench].forEach(p => {
      const s = p.ss || {}; if(stat === 'avg' && (s.pa || 0) < games * 3.1) return;
      const v = stat === 'avg' ? avgOf(s) : (s[stat] || 0); if(v > 0) rows.push({ p, T, v });
    });
    else [...T.sp, ...T.rp].forEach(p => {
      const s = p.ss || {}; if(stat === 'era' && (s.out || 0) < games * 3) return;
      const v = stat === 'era' ? eraOf(s) : (s[stat] || 0); if(stat === 'era' || v > 0) rows.push({ p, T, v });
    });
  }
  rows.sort((a, b) => stat === 'era' ? a.v - b.v : b.v - a.v);
  return rows.slice(0, n);
}
const STAT_NAME = { avg:'타율', hr:'홈런', rbi:'타점', h:'안타', sb:'도루', era:'평균자책점', w:'승리', sv:'세이브', hd:'홀드', k:'탈삼진' };
const statVal = (stat, v) => stat === 'avg' ? avgText(v) : stat === 'era' ? v.toFixed(2) : `${v}${{ hr:'개', rbi:'점', h:'개', sb:'개', w:'승', sv:'세이브', hd:'홀드', k:'개' }[stat] || ''}`;
function endSeason(L, champ, S){
  L.post.done = true; L.phase = 'done'; L.champ = champ;
  const titles = ['avg', 'hr', 'rbi', 'h', 'sb', 'era', 'w', 'sv', 'hd', 'k'].map(st => { const t = leaders(L, st, 1)[0]; return t ? { st, id: t.p.id, name: t.p.name, team: t.T.key, v: t.v } : null; }).filter(Boolean);
  // 정규 시즌 MVP: 타자는 안타·홈런·타점·도루, 투수는 승·세이브·평균자책점으로 점수를 매김
  let mvp = null, mv = -1;
  for(const k in L.teams){
    const T = L.teams[k], bonus = L.final.indexOf(k) < 3 ? 1.05 : 1;
    [...T.bat, ...T.bench].forEach(p => { const s = p.ss || {}; const v = ((s.h || 0) + (s.hr || 0) * 3 + (s.rbi || 0) + (s.sb || 0) * 0.5 + (s.bb || 0) * 0.5) * bonus; if(v > mv){ mv = v; mvp = { id:p.id, name:p.name, team:k }; } });
    [...T.sp, ...T.rp].forEach(p => { const s = p.ss || {}; if(!s.out) return; const v = ((s.w || 0) * 6 + (s.sv || 0) * 3 + (s.k || 0) * 0.3 + Math.max(0, 5 - eraOf(s)) * (s.out / 27) * 2) * bonus; if(v > mv){ mv = v; mvp = { id:p.id, name:p.name, team:k }; } });
  }
  let ks = null, kv = -1;
  Object.entries(S.mvp).forEach(([id, v]) => { const f = findPlayer(L, id); if(f && f.T.key === champ && v > kv){ kv = v; ks = { id, name: f.p.name, team: champ }; } });
  L.awards = { mvp, ksMvp: ks, titles };
  L.news.push(`한국시리즈 우승: ${teamInfo(champ).name}!`);
}
