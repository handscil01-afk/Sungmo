'use strict';
/* ===================== 맞대결 전적 =====================
   이번 시즌 정규 시즌 일정(L.sched)에서 이미 치른 경기(ra·rh가 있는 경기)만 세어, 한 팀이 다른 팀마다 몇 승 몇 패인지 셈.
   저장에 새 칸을 만들지 않음. 육성 모드에서는 내 선수의 팀별 기록(c.vs, daily.js의 dailyVs가 쌓음)도 함께 보여 줌 */
function h2hOf(L, key){
  const out = {};
  (L.sched || []).forEach(day => (day || []).forEach(g => {
    if(g.a !== key && g.h !== key) return;
    const opp = g.a === key ? g.h : g.a, r = out[opp] ||= { w:0, l:0, d:0, rs:0, ra:0, g:0, left:0 };
    if(g.ra == null){ r.left++; return; }
    const my = g.a === key ? g.ra : g.rh, ot = g.a === key ? g.rh : g.ra;
    r.g++; r.rs += my; r.ra += ot; r[my > ot ? 'w' : my < ot ? 'l' : 'd']++;
  }));
  return out;
}
const h2hText = r => r && r.g ? `${r.w}승 ${r.l}패${r.d ? ` ${r.d}무` : ''}` : '첫 만남';
// 오늘 우리 경기 상대와의 전적 (정규 시즌만): { opp, r, text }
function h2hToday(L){
  if(!L || L.phase !== 'season') return null;
  const g = myGameToday(L); if(!g) return null;
  const opp = g.a === L.my ? g.h : g.a, r = h2hOf(L, L.my)[opp];
  return { opp, r, text: r && r.g ? `상대 전적 ${h2hText(r)}` : '이번 시즌 첫 맞대결' };
}
// 내 선수의 한 팀 상대 기록 한 줄 (육성)
function h2hVsLine(L, key){
  const c = L.career; if(!c || !c.vs || c.vs.season !== L.season) return '';
  const v = c.vs.t[key]; if(!v || !v.g) return '';
  const p = myP(L);
  return p && isPit(p) ? `${v.g}경기 ${ipText(v.out || 0)}, ${v.r || 0}실점, 탈삼진 ${v.k || 0}` : `${v.g}경기 ${v.ab || 0}타수 ${v.h || 0}안타${v.hr ? ` ${v.hr}홈런` : ''}${v.rbi ? ` ${v.rbi}타점` : ''}`;
}
// 맞대결 전적 화면: 순위표·일정 화면에서 들어옴 (back: 돌아갈 화면)
function h2hScreen(back){
  const L = LG(), me = L.my, all = h2hOf(L, me), bk = v => go(back || standScreen, v);
  const order = standings(L).map(x => x.T.key).filter(k => k !== me);
  const say = [`${teamInfo(me).name}의 이번 시즌 팀별 맞대결 전적입니다.`];
  order.forEach(k => { const r = all[k] || { w:0, l:0, d:0, rs:0, ra:0, g:0, left:0 }; say.push(`${teamName(k)}: ${r.g ? `${h2hText(r)}, 득점 ${r.rs} 실점 ${r.ra}` : '아직 맞대결 없음'}${r.left ? `, 남은 경기 ${r.left}` : ''}.`); });
  if(L.phase !== 'season') say.push('포스트시즌 경기는 넣지 않았습니다.');
  const table = [{ title:'팀별 맞대결', cols:['', '상대', '승', '패', '무', '득', '실', '남음'], hiTeam: null,
    rows: order.map(k => { const r = all[k] || { w:0, l:0, d:0, rs:0, ra:0, g:0, left:0 }; return { team:k, cells:[r.w > r.l ? '▲' : r.w < r.l ? '▼' : '-', teamName(k), r.w, r.l, r.d, r.rs, r.ra, r.left] }; }) }];
  // 육성: 내 선수의 팀별 기록과 라이벌 팀
  const c = L.career;
  if(c && !c.retired){
    const p = myP(L), pit = p && isPit(p), rv = typeof rival === 'function' ? rival(L) : null, rk = rv ? rv.T.key : null;
    const rows = order.map(k => { const v = (c.vs && c.vs.season === L.season && c.vs.t[k]) || null; return v && v.g ? { team:k, cells: pit ? [k === rk ? '라이벌' : '', teamName(k), v.g, ipText(v.out || 0).replace('이닝', ''), v.r || 0, v.k || 0] : [k === rk ? '라이벌' : '', teamName(k), v.g, v.ab || 0, v.h || 0, v.hr || 0, v.rbi || 0] } : null; }).filter(Boolean);
    if(rv){ const t = h2hVsLine(L, rk); say.push(`라이벌 ${rv.p.name}의 팀 ${teamName(rk)} 상대 내 기록: ${t || '아직 1군에서 만나지 않았습니다'}.`); }
    rows.forEach(r => { if(r.team !== rk) say.push(`내 선수 ${teamName(r.team)} 상대: ${h2hVsLine(L, r.team)}.`); });
    if(rows.length) table.push({ title:`${p.name} 팀별 기록`, cols: pit ? ['', '상대', '경기', '이닝', '실점', '삼진'] : ['', '상대', '경기', '타수', '안타', '홈런', '타점'], hiTeam: rk, rows });
  }
  return { q:'맞대결 전적입니다.', skTitle:'맞대결 전적', say, table, back: bk, opts:[{ n:1, t:'돌아가기', act: bk }] };
}
