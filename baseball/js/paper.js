'use strict';
/* ===================== 주간 리그 신문 (손잡다 스포츠) =====================
   정규 시즌 7일마다(그리고 정규 시즌 마지막 날) 한 호를 엮음. 리그 모드와 선수 육성 모드가 같은 리그 계산(leagueAdvance)에서 부름.
   - 주 시작에 찍어 둔 기록(L.paperSnap: 선수별 시즌 기록 몇 칸, 팀 순위·승패)과 지금 기록의 차이로 이주의 타자·투수를 뽑음
   - 머리기사: 대기록 → 5연승·5연패 넘는 흐름 → 8점 차 넘는 대승 → 선두 바뀜 → 이번 주 가장 잘한 팀 차례로
   - 순위 변동(화살표), 눈에 띈 경기, 우리 팀 한 주 요약. 마지막 5호만 L.paper에 둠(읽었는지 read)
   - 화면 정의는 paperScreen 하나: 소리와 글로 하기는 줄글(say)을 읽고, 화면 보며 하기는 신문 모양(skin-daily.js의 pp-show) */
const PP_BAT = ['pa', 'ab', 'h', 'hr', 'rbi', 'bb', 'sb', 'r'];
const PP_PIT = ['out', 'r', 'ur', 'k', 'w', 'sv', 'hd', 'h', 'bb'];
function paperSnapTake(L){
  const p = {}, rank = {}, rec = {}, st = standings(L);
  for(const k in L.teams){ const T = L.teams[k]; rec[k] = [T.w, T.l, T.d]; allPlayers(T).forEach(x => { const s = x.ss || {}; p[x.id] = (x.vel ? PP_PIT : PP_BAT).map(f => s[f] || 0); }); }
  st.forEach(x => { rank[x.T.key] = x.rank; });
  return { season: L.season, day: L.day, p, rank, rec, first: st[0].T.key };
}
// leagueAdvance에서 정규 시즌 하루가 끝날 때마다 부름 (L.day는 이미 하루 늘어난 뒤)
function paperDay(L){
  try{
    let S = L.paperSnap;
    if(!S || S.season !== L.season){
      if(L.day !== 1){ L.paperSnap = paperSnapTake(L); return; }   // 시즌 중간에 처음 쓰는 옛 저장: 지금부터 한 주
      S = L.paperSnap = { season: L.season, day:0, p:{}, rank:null, rec:{}, first:null };   // 시즌 첫날: 모두 0에서 시작
    }
    const end = L.day >= L.sched.length;
    if(L.day - S.day < 7 && !(end && L.day > S.day)) return;
    (L.paper ||= []).push(paperMake(L, S, end));
    while(L.paper.length > 5) L.paper.shift();
    L.paperSnap = paperSnapTake(L);
  }catch(e){ if(typeof console !== 'undefined') console.warn('주간 신문 만들기 실패', e); }
}
const ppAvg = d => d.ab ? (d.h / d.ab).toFixed(3).replace(/^0/, '') : '-';
const ppBatLine = d => `${d.ab}타수 ${d.h}안타${d.hr ? ` ${d.hr}홈런` : ''}${d.rbi ? ` ${d.rbi}타점` : ''}${d.sb ? ` ${d.sb}도루` : ''}`;
const ppPitLine = d => `${[d.w ? `${d.w}승` : '', d.sv ? `${d.sv}세이브` : '', d.hd ? `${d.hd}홀드` : ''].filter(Boolean).join(' ')}${d.w || d.sv || d.hd ? ', ' : ''}${ipText(d.out)} ${d.er}자책, 탈삼진 ${d.k}`;
function paperMake(L, S, end){
  const no = L.paperNo = (L.paperNo || 0) + 1, st = standings(L);
  const bats = [], pits = [];
  for(const k in L.teams) allPlayers(L.teams[k]).forEach(x => {
    const s = x.ss || {}, o = S.p[x.id], keys = x.vel ? PP_PIT : PP_BAT, d = {};
    keys.forEach((f, i) => { d[f] = (s[f] || 0) - (o ? o[i] || 0 : 0); });
    if(x.vel){
      if(d.out < 3) return;
      d.er = Math.max(0, d.r - d.ur);
      d.sc = d.w * 6 + d.sv * 3 + d.hd * 1.5 + d.k * 0.3 + Math.max(0, 5 - d.er * 27 / d.out) * (d.out / 27) * 2;
      pits.push({ x, team:k, d });
    } else {
      if(!d.pa) return;
      d.sc = d.h + d.hr * 3 + d.rbi + d.sb * 0.5 + d.bb * 0.5;
      bats.push({ x, team:k, d });
    }
  });
  const top = arr => arr.slice().sort((a, b) => b.d.sc - a.d.sc)[0] || null;
  const pB = top(bats), pP = top(pits);
  const who = (r, pit) => r ? { id: r.x.id, name: r.x.name, team: r.team, pos: pit ? r.x.role : POS[r.x.pos] || '', line: pit ? ppPitLine(r.d) : `타율 ${ppAvg(r.d)}, ${ppBatLine(r.d)}`, big: pit ? (r.d.w ? `${r.d.w}승` : r.d.sv ? `${r.d.sv}S` : `${r.d.k}K`) : (r.d.hr ? `${r.d.hr}홈런` : `${r.d.h}안타`) } : null;
  // 팀: 순위·변동·이번 주 승패·흐름
  const teams = st.map(x => {
    const T = x.T, r0 = S.rec[T.key] || [0, 0, 0], l = T.last || [];
    let n = 0; const lt = l[l.length - 1]; for(let i = l.length - 1; i >= 0 && l[i] === lt; i--) n++;
    return { key: T.key, rank: x.rank, prev: S.rank ? S.rank[T.key] || null : null, w: T.w - r0[0], l: T.l - r0[1], d: T.d - r0[2], tw: T.w, tl: T.l, td: T.d, gb: x.gb, sk: lt ? `${lt}${n}` : '', skn: n, skw: lt };
  });
  // 이번 주 경기
  const games = [];
  for(let d = S.day; d < Math.min(L.day, L.sched.length); d++) (L.sched[d] || []).forEach(g => { if(g.ra != null) games.push({ day: d + 1, a: g.a, h: g.h, ra: g.ra, rh: g.rh }); });
  const margin = g => Math.abs(g.ra - g.rh);
  const notable = games.slice().sort((x, y) => margin(y) - margin(x) || (y.ra + y.rh) - (x.ra + x.rh)).slice(0, 2);
  const hiSc = games.slice().sort((x, y) => (y.ra + y.rh) - (x.ra + x.rh))[0];
  if(hiSc && !notable.includes(hiSc)) notable.push(hiSc);
  const close = games.find(g => margin(g) === 1 && (g.a === L.my || g.h === L.my) && !notable.includes(g));
  if(close) notable.push(close);
  const tag = g => g === hiSc && !(margin(g) >= 6) ? '난타전' : margin(g) >= 6 ? '대승' : margin(g) === 1 ? '한 점 차' : '';
  const feats = (L.feats || []).filter(f => f.season === L.season && f.day > S.day && f.day <= L.day);
  // 머리기사
  const big = feats.find(f => f.kind !== 'ms'), hotW = teams.filter(t => t.skw === 'W' && t.skn >= 5).sort((a, b) => b.skn - a.skn)[0],
    hotL = teams.filter(t => t.skw === 'L' && t.skn >= 5).sort((a, b) => b.skn - a.skn)[0], blow = notable[0] && margin(notable[0]) >= 8 ? notable[0] : null;
  const short = k => teamInfo(k).short;
  let head;
  if(big) head = { t: big.text.replace(/^대기록!\s*/, ''), s:`${big.day}일째, 리그에 대기록이 나왔습니다.`, team: big.team, kind:'feat' };
  else if(hotW) head = { t:`${short(hotW.key)}, ${hotW.skn}연승 질주!`, s:`이번 주 ${hotW.w}승 ${hotW.l}패, 지금 ${hotW.rank}위.`, team: hotW.key, kind:'up' };
  else if(blow){ const wk = blow.ra > blow.rh ? blow.a : blow.h, lk = wk === blow.a ? blow.h : blow.a; head = { t:`${short(wk)}, ${Math.max(blow.ra, blow.rh)} 대 ${Math.min(blow.ra, blow.rh)} 대승`, s:`${blow.day}일째 ${josa(short(lk), '을', '를')} 크게 이겼습니다.`, team: wk, kind:'blow' }; }
  else if(hotL) head = { t:`${short(hotL.key)}, ${hotL.skn}연패 수렁`, s:`이번 주 ${hotL.w}승 ${hotL.l}패, 지금 ${hotL.rank}위.`, team: hotL.key, kind:'down' };
  else if(S.first && st[0].T.key !== S.first) head = { t:`${short(st[0].T.key)}, 선두 탈환!`, s:`${josa(short(S.first), '을', '를')} 끌어내리고 1위에 올랐습니다.`, team: st[0].T.key, kind:'up' };
  else { const b = teams.slice().sort((a, b2) => (b2.w - b2.l) - (a.w - a.l) || a.rank - b2.rank)[0]; head = { t:`${short(b.key)}, 이번 주 ${b.w}승 ${b.l}패`, s:`한 주 동안 가장 잘 나간 팀입니다. 지금 ${b.rank}위.`, team: b.key, kind:'up' }; }
  if(end) head.s = `정규 시즌 마지막 호. ${head.s}`;
  const notes = feats.filter(f => f !== big).slice(0, 3).map(f => f.text.replace(/^대기록!\s*/, ''));
  // 우리 팀
  const me = teams.find(t => t.key === L.my), mine = games.filter(g => g.a === L.my || g.h === L.my);
  const myStar = top([...bats.filter(r => r.team === L.my), ...pits.filter(r => r.team === L.my)].map(r => ({ ...r, d:{ ...r.d, sc: r.x.vel ? r.d.sc * 0.8 : r.d.sc } })));
  const my = me ? { w: me.w, l: me.l, d: me.d, rank: me.rank, prev: me.prev, res: mine.map(g => { const my2 = g.a === L.my ? g.ra : g.rh, ot = g.a === L.my ? g.rh : g.ra; return my2 > ot ? 'W' : my2 < ot ? 'L' : 'D'; }).join(''),
    star: myStar ? who(myStar, !!myStar.x.vel) : null } : null;
  return { no, season: L.season, from: S.day + 1, to: L.day, end: !!end, head, mvpB: who(pB, false), mvpP: who(pP, true),
    teams: teams.map(({ key, rank, prev, w, l, d, sk }) => ({ key, rank, prev, w, l, d, sk })), games: notable.map(g => ({ ...g, tag: tag(g) })), notes, my, read:false };
}

/* ---------- 읽기 ---------- */
const ppMove = t => t.prev == null ? '' : t.prev > t.rank ? `${t.prev - t.rank}계단 올라감` : t.prev < t.rank ? `${t.rank - t.prev}계단 내려감` : '그대로';
const ppSk = s => !s ? '' : s[0] === 'W' ? `${s.slice(1)}연승` : s[0] === 'L' ? `${s.slice(1)}연패` : `${s.slice(1)}무`;
function paperLines(L, P){
  const out = [`손잡다 스포츠 제${P.no}호. ${P.season}시즌 ${P.from}일째부터 ${P.to}일째까지${P.end ? ', 정규 시즌 마지막 호' : ''}.`];
  out.push(`머리기사: ${P.head.t} ${P.head.s}`);
  if(P.mvpB) out.push(`이주의 타자: ${teamName(P.mvpB.team)} ${P.mvpB.name}, ${P.mvpB.line}.`);
  if(P.mvpP) out.push(`이주의 투수: ${teamName(P.mvpP.team)} ${P.mvpP.name}, ${P.mvpP.line}.`);
  out.push(`순위와 이번 주 성적: ${P.teams.map(t => `${t.rank}위 ${teamName(t.key)}${t.key === L.my ? '(우리 팀)' : ''} ${t.w}승 ${t.l}패${ppMove(t) ? `, ${ppMove(t)}` : ''}`).join('; ')}.`);
  if(P.games.length) out.push(`눈에 띈 경기: ${P.games.map(g => `${g.day}일째 ${teamName(g.a)} ${g.ra} 대 ${g.rh} ${teamName(g.h)}${g.tag ? `(${g.tag})` : ''}`).join('; ')}.`);
  P.notes.forEach(s => out.push(`소식: ${s}`));
  if(P.my){ const m = P.my; out.push(`우리 팀 ${teamInfo(L.my).name}: 이번 주 ${m.w}승 ${m.l}패${m.d ? ` ${m.d}무` : ''}, 지금 ${m.rank}위${m.prev ? `(${ppMove({ rank: m.rank, prev: m.prev })})` : ''}.${m.star ? ` 이주의 우리 선수 ${m.star.name}, ${m.star.line}.` : ''}`); }
  return out;
}
const paperUnread = L => (L.paper || []).filter(p => !p.read).length;
// 첫 화면 상태 줄
function paperLine(L){ const n = paperUnread(L); return n ? `신문이 왔습니다! 주간 리그 신문 제${L.paper[L.paper.length - 1].no}호${n > 1 ? `, 읽지 않은 신문 ${n}부` : ''}.` : null; }
// 첫 화면 선택지 (리그 10번, 육성 11번)
function paperOpt(L, n){
  if(!(L.paper || []).length) return null;
  const P = L.paper[L.paper.length - 1], un = paperUnread(L);
  return { n, key:'paper', t: un ? '신문이 왔습니다' : '주간 리그 신문', s:`제${P.no}호, ${P.season}시즌 ${P.from}~${P.to}일째. 이주의 타자·투수, 순위 변동, 우리 팀 소식`, unread: un, act: v => go(() => paperScreen(null), v) };
}
// 신문 화면: i는 L.paper 안의 자리 (null이면 가장 오래된 읽지 않은 호, 없으면 최신 호)
function paperScreen(i){
  const L = LG(), list = (L && L.paper) || [];
  if(!list.length) return { q:'아직 신문이 없습니다. 정규 시즌 7일마다 나옵니다.', back: v => go(lhome(), v), opts:[{ n:9, t:'돌아가기', act: v => go(lhome(), v) }] };
  if(i == null){ const u = list.findIndex(p => !p.read); i = u >= 0 ? u : list.length - 1; }
  i = clamp(i, 0, list.length - 1);
  const P = list[i];
  if(!P.read){ P.read = true; saveLeague(); }
  return { kind:'pp-show', pi: i, skTitle:'주간 리그 신문', q:`주간 리그 신문 제${P.no}호입니다.`, say: paperLines(L, P), back: v => go(lhome(), v), opts:[
    { n:1, key:'prev', t:'지난 호 보기', hide: i === 0, act: v => go(() => paperScreen(i - 1), v) },
    { n:2, key:'next', t:'다음 호 보기', hide: i === list.length - 1, act: v => go(() => paperScreen(i + 1), v) },
    { n:9, key:'back', t:'돌아가기', act: v => go(lhome(), v) },
  ] };
}
