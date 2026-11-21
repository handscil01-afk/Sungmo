'use strict';
/* ===================== 온라인 전적 화면: 내 전적 · 순위표 =====================
   온라인 대전 첫 화면(onlineHome)에서 들어감. 로비와 온라인 경기 끝 화면에는 지금 상대와의 전적을 붙임.
   기록과 서버 맞추기는 js/net-rank.js, 화면 보며 하기 그림은 js/skin-rank.js */
const rkDate = t => { const d = new Date(t || 0); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };
const rkTeam = k => { try{ return teamInfo(k).short; }catch(e){ return String(k || ''); } };
const rkRes = m => m.ms > m.os ? '승' : m.ms < m.os ? '패' : '무';
const rkPct = t => { const n = t.w + t.l; return n ? (t.w / n).toFixed(3).replace(/^0/, '') : '-'; };
// 통산 한 줄
function rkSumLine(){
  const t = rkTotals(), g = t.w + t.l + t.d;
  if(!g && t.r == null) return '아직 온라인 대전 기록이 없습니다. 온라인 대전을 하면 여기에 쌓입니다.';
  const base = `통산 ${g}경기 ${rkWLD(t)}, 승률 ${rkPct(t)}.`;
  if(!t.server) return base + (RK.err ? ` 점수와 순위는 불러오지 못했습니다. ${RK.err}` : ' 점수와 순위는 서버에서 불러오는 중입니다.');
  return `${base} 점수 ${t.r}점${t.rank ? `, 순위 ${t.rank}위` : ''}.`;
}
const rkPendLine = () => { const n = rkQ().length; return n ? [`서버에 아직 올리지 못한 경기가 ${n}개 있습니다. 연결되면 올립니다.`] : []; };
const rkHistLine = m => `${rkDate(m.at)}, ${m.on}님과: ${rkTeam(m.mt)} ${m.ms} 대 ${m.os} ${rkTeam(m.ot)}, ${rkRes(m) === '무' ? '무승부' : rkRes(m) === '승' ? '승리' : '패배'}.`;
const rkVsLine = v => `${v.n}님: ${rkWLD(v)}.`;

/* ---------- 내 전적 ---------- */
function rankMeScreen(){
  rkLoadMe();
  const tab = RK.tab === 'vs' ? 'vs' : 'recent', h = rkHist(), vs = rkVsList();
  const list = tab === 'recent' ? (h.length ? h.map(rkHistLine) : ['아직 끝까지 마친 온라인 경기가 없습니다.'])
    : (vs.length ? vs.map(rkVsLine) : ['아직 겨뤄 본 상대가 없습니다.']);
  const back = v => go(onlineHome, v);
  return { kind:'rk-me', q:`내 전적입니다. ${josa(tab === 'recent' ? '최근 경기' : '상대별 전적', '을', '를')} 위 글에서 한 줄씩 읽어 보세요.`,
    say:[rkSumLine(), ...rkPendLine(), tab === 'recent' ? '최근 경기.' : '상대별 전적.', ...list], back, opts:[
      { n:1, key:'recent', t:'최근 경기', s:'끝까지 마친 온라인 경기 50개까지', act: v => { RK.tab = 'recent'; go(rankMeScreen, v); } },
      { n:2, key:'vs', t:'상대별 전적', s:'만난 사람마다 몇 승 몇 패인지', act: v => { RK.tab = 'vs'; go(rankMeScreen, v); } },
      { n:3, key:'top', t:'순위표', s:'점수가 높은 20명', act: v => go(rankTopScreen, v) },
      { n:4, key:'reload', t:'새로 고침', s:'서버에서 다시 불러오고, 못 올린 경기를 올립니다.', act: () => { RK.polls = 0; rankSync(); rkLoadMe(true); speak('다시 불러옵니다.'); } },
      { n:9, key:'back', t:'온라인 대전으로 돌아가기', act: back },
    ] };
}

/* ---------- 순위표 ---------- */
function rankTopScreen(){
  rkLoadTop();
  const T = RK.top, uid = RK.uid;
  let say;
  if(!T) say = ['순위표를 불러오는 중입니다…'];
  else if(T.err) say = [T.err];
  else if(!T.list.length) say = ['아직 순위표에 아무도 없습니다. 온라인 대전을 끝까지 하면 올라갑니다.'];
  else {
    say = T.list.map((p, i) => `${i + 1}위 ${p.name}${p.uid === uid ? '(나)' : ''}: ${p.r}점, ${rkWLD(p)}.`);
    if(!T.list.some(p => p.uid === uid)) say.push(RK.me ? `내 순위: ${RK.rank ? RK.rank + '위' : '20위 밖'}, ${RK.me.r}점, ${rkWLD(RK.me)}.` : '나는 아직 순위표에 없습니다.');
  }
  const back = v => go(onlineHome, v);
  return { kind:'rk-top', q:'순위표입니다. 온라인 대전 점수가 높은 20명입니다. 처음 점수는 1000점이고, 이기면 오르고 지면 내립니다.', say, back, opts:[
    { n:1, key:'reload', t:'새로 고침', act: () => { rkLoadTop(true); speak('순위표를 다시 불러옵니다.'); } },
    { n:2, key:'me', t:'내 전적', act: v => go(rankMeScreen, v) },
    { n:9, key:'back', t:'온라인 대전으로 돌아가기', act: back },
  ] };
}

/* ---------- 로비·경기 끝에 붙이는 글 ---------- */
// 로비: 지금 상대와의 전적 (online.js lobbyScreen)
function rankVsNote(){
  const p = NET.peer; if(!p || !p.uid) return [];
  rkLoadVs(p.uid);
  const v = rkVsOf(p.uid);
  return [rkGames(v) ? `${p.name}님과의 상대 전적: ${rkWLD(v)}.` : `${p.name}님과는 처음 겨룹니다.`];
}
// 경기 끝 (game.js endScreen, 소리와 글로 하기)
function rankEndNote(){
  const p = NET.peer; if(!NET.on || !G || !G.over || !p || !p.uid) return [];
  const v = rkVsOf(p.uid), d = RK.done[`${NET.code}/${G.at}`];
  return [`${p.name}님과의 상대 전적: ${rkGames(v) ? rkWLD(v) : '없음'}.`, d ? rkDoneText(d) : '전적을 서버에 올리는 중입니다.'];
}
// 경기 끝 점수 카드 아래 한 줄 (skin-hub.js finalCardHTML, 화면 보며 하기)
function rankFinTag(){
  const p = typeof NET !== 'undefined' && NET.on ? NET.peer : null;
  if(!p || !p.uid || !G || !G.over) return '';
  const v = rkVsOf(p.uid), d = RK.done[`${NET.code}/${G.at}`];
  return `<span class="fin-rk">상대 전적 <b>${esc(rkGames(v) ? rkWLD(v) : '없음')}</b>${d ? ` · <b>${d.r}</b>점 <em class="${d.dr >= 0 ? 'up' : 'dn'}">${d.dr >= 0 ? '+' : ''}${d.dr}</em>` : ''}</span>`;
}
// 온라인 대전 첫 화면에 붙이는 한 줄
function rankHomeNote(){
  const t = rkTotals(), g = t.w + t.l + t.d;
  return g ? [`내 전적: ${rkWLD(t)}${t.server ? `, ${t.r}점` : ''}.`] : [];
}
