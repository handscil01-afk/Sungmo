'use strict';
/* ===================== 리그 화면 =====================
   리그 상태는 이 기기(localStorage 'bb_league')에 저장. 내 팀 경기는 고른 방식(간단·정밀·감독)으로 직접 하고,
   다른 경기와 넘긴 경기는 컴퓨터끼리 결과만 냄. 경기가 끝나면 그날의 다른 경기도 모두 진행함 */
let LG_ = null;
function LG(){ if(!LG_) LG_ = ls.get('bb_league', null); return LG_ && LG_.v === 1 ? LG_ : null; }
function saveLeague(){ if(LG_) ls.set('bb_league', LG_); }
const LMODE = [['manager', null, '감독 모드'], ['detail', null, '정밀 모드'], ['simple', 'pitch', '간단 모드 (공 하나씩)'], ['simple', 'pa', '간단 모드 (타석 한 번에)']];
const lmodeName = L => (LMODE.find(m => m[0] === L.mode && (m[0] !== 'simple' || m[1] === L.unit)) || LMODE[0])[2];
const myRank = L => standings(L).find(x => x.T.key === L.my);
const isMineSaved = L => { const s = loadSaved(); return s && s.G.league && s.G.league.season === L.season && s.G.league.day === L.day && s.G.league.phase === L.phase && s.G.league.n === postN(L) ? s : null; };
const postN = L => L.phase === 'post' && L.post && L.post.cur ? `${L.post.cur.round}${L.post.cur.n}` : '';
// 새로 생긴 소식(정규 시즌 끝, 시리즈 결과, 우승)을 한 번만 읽어 줌
function leagueNews(L){ const n = L.newsRead || 0; L.newsRead = L.news.length; return L.news.slice(n); }

function leagueStatus(L){
  const r = myRank(L), T = r.T, info = teamInfo(L.my), out = [];
  out.push(`${L.season}시즌 리그, 내 팀 ${info.name}. 정규 시즌 ${r.rank}위, ${T.w}승 ${T.l}패${T.d ? ` ${T.d}무` : ''}, ${gbText(r.gb)}${T.last.length ? `, ${recentText(T)}, ${streakText(T)}` : ''}.`);
  if(L.phase === 'season'){
    const g = myGameToday(L);
    out.push(`정규 시즌 ${L.day + 1}일째, 남은 경기 ${L.sched.length - L.day}경기.`);
    if(g) out.push(`오늘 경기: ${teamName(g.a)} 대 ${teamName(g.h)}, ${g.h === L.my ? '홈' : '원정'} 경기, ${parkInfo(g.h).name}. 우리 선발 ${L.teams[L.my].sp[L.teams[L.my].rot % 5].name}, 상대 선발 ${(() => { const o = g.a === L.my ? g.h : g.a; return L.teams[o].sp[L.teams[o].rot % 5].name; })()}.`);
  } else if(L.phase === 'post'){
    out.push(seriesText(L));
    const g = todayGames(L)[0];
    if(g) out.push(`다음 경기: ${g.label}, ${teamName(g.a)} 대 ${teamName(g.h)}${g.a === L.my || g.h === L.my ? ', 우리 팀 경기입니다' : ''}.`);
    if(!L.post.seeds.includes(L.my)) out.push('우리 팀은 포스트시즌에 나가지 못했습니다.');
  } else if(L.phase === 'done'){
    out.push(...awardLines(L));
  }
  return out;
}
function awardLines(L){
  const A = L.awards || {}, out = [`${L.season}시즌 한국시리즈 우승: ${teamInfo(L.champ).name}!`];
  if(A.mvp) out.push(`정규 시즌 MVP: ${teamName(A.mvp.team)} ${A.mvp.name}.`);
  if(A.ksMvp) out.push(`한국시리즈 MVP: ${teamName(A.ksMvp.team)} ${A.ksMvp.name}.`);
  (A.titles || []).forEach(t => out.push(`${STAT_NAME[t.st]} 1위: ${teamName(t.team)} ${t.name}, ${statVal(t.st, t.v)}.`));
  return out;
}

/* ---------- 리그 첫 화면 ---------- */
function leagueHome(){
  const L = LG();
  if(!L) return { q:'아직 리그가 없습니다. 새 리그를 만들까요?', back: v => go(homeScreen, v),
    note:['10개 팀이 정규 시즌을 치르고, 상위 5팀이 와일드카드 결정전, 준플레이오프, 플레이오프, 한국시리즈를 치릅니다.', '내 팀 경기는 직접 하고, 다른 경기는 결과만 나옵니다. 선수 기록이 쌓이고 시즌이 끝나면 시상식을 합니다.'],
    opts:[{ n:1, t:'새 리그 만들기', act: v => { NEW.kind = 'league'; go(modeScreen, v); } }, { n:2, t:'백업 파일 불러오기', act: () => leagueImport() }] };
  const g = myGameToday(L), saved = isMineSaved(L), done = L.phase === 'done';
  return { q: done ? '시즌이 끝났습니다. 무엇을 할까요?' : '무엇을 할까요?', back: v => go(homeScreen, v), note: leagueStatus(L), opts:[
    { n:1, t: saved ? '진행 중인 경기 이어하기' : '오늘 경기 하기', hide: !g, s: saved ? situation(saved.G) : `${lmodeName(L)}로 합니다.`, act: v => saved ? resumeGame(v) : leaguePlay(v) },
    { n:2, t: g ? '오늘 경기 결과만 보고 넘기기' : '다음 경기 결과 보기', hide: done, s: g ? '우리 팀 경기도 컴퓨터가 진행합니다.' : '', act: v => leagueRun(1, v) },
    { n:3, t:'여러 날 넘기기', hide: done, act: v => go(skipScreen, v) },
    { n:4, t:'순위표', act: v => go(standScreen, v) },
    { n:5, t:'기록 순위', act: v => go(() => leadersScreen(null), v) },
    { n:6, t:'내 팀 선수', act: v => go(myTeamScreen, v) },
    { n:7, t: L.phase === 'post' || done ? '포스트시즌 결과' : '일정과 지난 결과', act: v => go(schedScreen, v) },
    { n:8, t:'리그 설정', s:`경기 방식: ${lmodeName(L)}. 백업, 리그 지우기`, act: v => go(leagueSet, v) },
    { n:9, t: done ? '새 리그 만들기' : '처음 화면으로', act: v => done ? openDlg('새 리그 만들기', ['지금 리그를 지우고 새 리그를 만들까요? 먼저 리그 설정에서 백업해 둘 수 있습니다.'], [{ label:'새로 만들기', act: () => { NEW.kind = 'league'; go(modeScreen, 'click'); } }, { label:'그만두기' }]) : go(homeScreen, v) },
  ] };
}

/* ---------- 새 리그 ---------- */
function leagueLenScreen(){
  const set = (n, v) => { NEW.len = n; go(leagueInnScreen, v); };
  return { q:'팀마다 정규 시즌을 몇 경기 할까요?', back: v => go(() => teamScreen(0), v), opts:[
    { n:1, t:'18경기', s:'짧은 시즌. 모든 팀과 두 번씩 만납니다.', act: v => set(18, v) },
    { n:2, t:'36경기', act: v => set(36, v) },
    { n:3, t:'72경기', act: v => set(72, v) },
    { n:4, t:'144경기', s:'KBO와 같은 길이입니다. 넘기기를 섞어 쓰면 좋습니다.', act: v => set(144, v) },
  ] };
}
function leagueInnScreen(){
  const set = (n, v) => {
    LG_ = leagueNew({ my: NEW.a, len: NEW.len, mode: NEW.mode, unit: NEW.unit, inn: n, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0 });
    saveLeague();
    go(leagueHome, v, [`새 리그를 만들었습니다. ${teamInfo(NEW.a).name}의 감독이 되었습니다. 정규 시즌 ${NEW.len}경기, ${n}이닝 경기입니다.`]);
  };
  return { q:'경기마다 몇 이닝을 할까요?', back: v => go(leagueLenScreen, v), opts:[
    { n:1, t:'9이닝', s:'정식 경기.', act: v => set(9, v) },
    { n:2, t:'5이닝', s:'짧게 합니다. 기록도 그만큼 적게 쌓입니다.', act: v => set(5, v) },
    { n:3, t:'3이닝', s:'아주 짧게 합니다.', act: v => set(3, v) },
  ] };
}

/* ---------- 경기 하기 · 넘기기 ---------- */
function leaguePlay(via){
  const L = LG(), g = myGameToday(L); if(!g) return;
  const ctrl = g.a === L.my ? ['human', 'cpu'] : ['cpu', 'human'];
  G = newGame(leagueGameOpts(L, g.a, g.h, ctrl, L.mode, L.unit));
  G.league = { season: L.season, day: L.day, phase: L.phase, n: postN(L), label: g.label || `정규 시즌 ${L.day + 1}일째` };
  saveLeague();
  GS.opts = null; GS.pend = { def:null, off:null }; GS.auto = null; GS.holder = -1; GS.sel = null; UI.logG = null;
  const r = flush(G);
  gameNext(via, { lines:[{ s:`${G.league.label} 경기입니다.`, k:'i' }, ...r.lines], fx: r.fx });
}
// 내 경기가 끝나면: 그날의 다른 경기도 모두 진행하고 결과 문장을 돌려줌
function leagueAfterMine(G){
  const L = LG(), m = G.league;
  if(!L || L.season !== m.season || L.day !== m.day || L.phase !== m.phase || postN(L) !== m.n) return [{ s:'이미 지난 경기라 리그 기록에는 넣지 않았습니다.', k:'c' }];
  const all = leagueAdvance(L, G), r = myRank(L);
  saveLeague();
  const lines = [{ s:`리그에 반영했습니다. 우리 팀 ${r.rank}위, ${r.T.w}승 ${r.T.l}패${r.T.d ? ` ${r.T.d}무` : ''}.`, k:'i' }];
  const others = all.filter(x => !x.includes(teamName(L.my)));
  if(others.length) lines.push({ s:`오늘의 다른 경기: ${others.join(', ')}.`, k:'c' });
  leagueNews(L).forEach(s => lines.push({ s, k:'i' }));
  saveLeague();
  return lines;
}
// 여러 날 넘기기: 하루씩 나눠 진행해 화면이 멈추지 않게 함. days: 넘길 날 수(Infinity면 조건까지)
function leagueRun(days, via, until){
  const L = LG(); if(!L) return;
  const before = { w: L.teams[L.my].w, l: L.teams[L.my].l, d: L.teams[L.my].d };
  let n = 0, mine = [];
  const stop = () => L.phase === 'done' || n >= days || (until && until(L));
  go(() => ({ q:'경기를 진행하는 중입니다…', opts:[] }), via);
  const tick = () => {
    for(let i = 0; i < 2 && !stop(); i++){
      const g = myGameToday(L), res = leagueAdvance(L, null); n++;
      if(g) mine.push(res.find(x => x.includes(teamName(L.my))) || '');
    }
    if(!stop()){ if(n % 10 === 0) speak(`${n}일째 진행 중`); setTimeout(tick, 0); return; }
    const T = L.teams[L.my], r = myRank(L);
    const say = [];
    if(n === 1 && mine.length) say.push(`경기 결과: ${mine[0]}.`);
    else say.push(`${n}일을 진행했습니다. 그동안 우리 팀 ${T.w - before.w}승 ${T.l - before.l}패${T.d - before.d ? ` ${T.d - before.d}무` : ''}. 지금 정규 시즌 ${r.rank}위입니다.`);
    leagueNews(L).forEach(s => say.push(s));
    saveLeague();
    go(leagueHome, 'auto', say);
    if(via === 'click') setTimeout(() => { const el = $('#say'); if(el) el.focus(); }, 60);
  };
  setTimeout(tick, 30);
}
function skipScreen(){
  const L = LG();
  return { q:'얼마나 넘길까요? 우리 팀 경기도 컴퓨터가 진행합니다.', back: v => go(leagueHome, v), opts:[
    { n:1, t:'7일', hide: L.phase !== 'season', act: v => leagueRun(7, v) },
    { n:2, t:'정규 시즌 끝까지', hide: L.phase !== 'season', act: v => leagueRun(Infinity, v, L => L.phase !== 'season') },
    { n:3, t:'지금 시리즈 끝까지', hide: L.phase !== 'post', act: v => { const r = L.post.cur.round; leagueRun(Infinity, v, L => L.phase !== 'post' || L.post.cur.round !== r); } },
    { n:4, t:'시즌 끝까지 (한국시리즈까지)', act: v => leagueRun(Infinity, v) },
  ] };
}

/* ---------- 순위 · 기록 ---------- */
function standScreen(){
  const L = LG();
  const say = standings(L).map(x => `${x.rank}위 ${teamName(x.T.key)}${x.T.key === L.my ? '(우리 팀)' : ''}: ${x.T.w}승 ${x.T.l}패${x.T.d ? ` ${x.T.d}무` : ''}, 승률 ${pctText(x.T)}, ${gbText(x.gb)}${x.T.last.length ? `, ${recentText(x.T)}, ${streakText(x.T)}` : ''}.`);
  if(L.phase === 'season') say.push('5위까지 포스트시즌에 나갑니다.');
  return { q:'순위표입니다. 위 글을 한 줄씩 읽어 보세요.', say, back: v => go(leagueHome, v), opts:[{ n:1, t:'돌아가기', act: v => go(leagueHome, v) }] };
}
const LEAD_MENU = [['avg', '타율'], ['hr', '홈런'], ['rbi', '타점'], ['h', '안타'], ['sb', '도루'], ['era', '평균자책점'], ['w', '승리'], ['svhd', '세이브와 홀드'], ['k', '탈삼진']];
function leadersScreen(stat){
  const L = LG();
  const list = st => leaders(L, st, 10).map((x, i) => `${i + 1}위 ${x.p.name}(${teamName(x.T.key)}${x.T.key === L.my ? ', 우리 팀' : ''}) ${statVal(st, x.v)}`);
  let say = [];
  if(stat === 'svhd') say = ['세이브 순위.', ...list('sv'), '홀드 순위.', ...list('hd')];
  else if(stat) say = list(stat);
  if(stat && !say.length) say = ['아직 기록이 없습니다. 타율은 규정 타석, 평균자책점은 규정 이닝을 채운 선수만 나옵니다.'];
  return { q: stat ? `${(LEAD_MENU.find(x => x[0] === stat) || [, ''])[1]} 순위입니다. 다른 기록을 고르세요.` : '어떤 기록 순위를 볼까요?', say, back: v => go(leagueHome, v),
    opts: LEAD_MENU.map(([k, t], i) => ({ n: i + 1, t, act: v => go(() => leadersScreen(k), v) })) };
}
function batLine(p){ const s = p.ss || {}; return `${p.name}(${POS[p.pos] || p.role}): 타율 ${avgText(avgOf(s))}, 홈런 ${s.hr || 0}, 타점 ${s.rbi || 0}, 안타 ${s.h || 0}, 도루 ${s.sb || 0}, ${s.pa || 0}타석.`; }
function pitLine(p){ const s = p.ss || {}; return `${p.role} ${p.name}: ${s.w || 0}승 ${s.l || 0}패${s.sv ? ` ${s.sv}세이브` : ''}${s.hd ? ` ${s.hd}홀드` : ''}, 평균자책점 ${s.out ? eraOf(s).toFixed(2) : '-'}, ${ipText(s.out || 0)}, 탈삼진 ${s.k || 0}.`; }
function myTeamScreen(){
  const L = LG(), T = L.teams[L.my];
  const say = ['타순.', ...T.bat.map((p, i) => `${i + 1}번 ${batLine(p)}`), '벤치.', ...T.bench.map(batLine), '투수.', ...T.sp.map(pitLine), ...T.rp.map(pitLine)];
  return { q:`${teamInfo(L.my).name} 선수 기록입니다.`, say, back: v => go(leagueHome, v), opts:[
    { n:1, t:'돌아가기', act: v => go(leagueHome, v) },
    { n:2, t:'추천 타순으로 바꾸기', s:'감독 모드에서는 경기 전 준비에서 직접 바꿀 수 있고, 바꾼 타순이 다음 경기에도 이어집니다.', act: v => { T.bat = bestOrder(T.bat); saveLeague(); go(myTeamScreen, v, ['추천 타순으로 바꿨습니다.']); } },
  ] };
}
function schedScreen(){
  const L = LG(), say = [];
  if(L.post){ say.push(...L.post.log); if(L.phase === 'post') say.push(seriesText(L)); }
  if(L.phase === 'season' || !L.post){
    for(let d = Math.max(0, L.day - 3); d < L.day; d++) say.push(`${d + 1}일째: ${L.sched[d].map(g => `${teamName(g.a)} ${g.ra} 대 ${g.rh} ${teamName(g.h)}`).join(', ')}.`);
    const next = [];
    for(let d = L.day; d < L.sched.length && next.length < 5; d++){ const g = L.sched[d].find(x => x.a === L.my || x.h === L.my); if(g) next.push(`${d + 1}일째 ${g.h === L.my ? `${teamName(g.a)}와 홈 경기` : `${teamName(g.h)} 원정`}`); }
    if(next.length) say.push(`우리 팀 다음 일정: ${next.join(', ')}.`);
  }
  if(!say.length) say.push('아직 경기 결과가 없습니다.');
  return { q:'일정과 결과입니다.', say, back: v => go(leagueHome, v), opts:[{ n:1, t:'돌아가기', act: v => go(leagueHome, v) }] };
}

/* ---------- 리그 설정 · 백업 ---------- */
function leagueSet(){
  const L = LG();
  return { q:'리그 설정입니다.', back: v => go(leagueHome, v), opts:[
    { n:1, t:`경기 방식: ${lmodeName(L)}`, s:'고를 때마다 바뀝니다. 내 팀 경기를 어떻게 할지 정합니다.', act: () => {
      const i = LMODE.findIndex(m => m[2] === lmodeName(L)), m = LMODE[(i + 1) % LMODE.length];
      L.mode = m[0]; if(m[1]) L.unit = m[1]; saveLeague(); stay(`경기 방식: ${m[2]}`); } },
    { n:2, t:'백업 파일 내려받기', s:'리그를 파일로 저장해 두면 다른 기기에서 불러오거나 되돌릴 수 있습니다.', act: v => leagueExport(v) },
    { n:3, t:'백업 파일 불러오기', act: () => leagueImport() },
    { n:4, t:'리그 지우기', act: () => openDlg('리그 지우기', ['지금 리그를 지울까요? 되돌릴 수 없습니다. 먼저 백업해 둘 수 있습니다.'], [
      { label:'지우기', act: () => { LG_ = null; ls.del('bb_league'); go(leagueHome, 'click', ['리그를 지웠습니다.']); } }, { label:'그만두기' }]) },
  ] };
}
function leagueExport(via){
  try{
    const blob = new Blob([JSON.stringify(LG())], { type:'application/json' }), a = document.createElement('a'), d = new Date();
    a.href = URL.createObjectURL(blob); a.download = `손잡다야구-리그-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    note(['백업 파일을 내려받았습니다.'], via);
  }catch(e){ note(['백업 파일을 만들지 못했습니다.'], via); }
}
function leagueImport(){
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => {
    const f = inp.files && inp.files[0]; if(!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      let L = null; try{ L = JSON.parse(rd.result); }catch(e){}
      if(!L || L.v !== 1 || !L.teams || !L.sched){ openDlg('불러오기', ['손잡다 야구 리그 백업 파일이 아닙니다.']); return; }
      openDlg('백업 불러오기', [`${teamInfo(L.my).name}, ${L.season}시즌 리그를 불러올까요? 지금 리그는 지워집니다.`], [
        { label:'불러오기', act: () => { LG_ = L; saveLeague(); go(leagueHome, 'click', ['백업을 불러왔습니다.']); } }, { label:'그만두기' }]);
    };
    rd.readAsText(f);
  };
  inp.click();
}
