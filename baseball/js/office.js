'use strict';
/* ===================== 구단 운영 (리그 감독 모드) =====================
   트레이드 · FA 영입 · 신인 드래프트 · 연봉 총액. 계산만 여기 두고(Node 시험에서도 씀), 화면은 office-ui.js.
   - 선수 가치(fov): 실력(타자·투수 평가) + 나이(젊을수록 조금 높음). 연봉(fsal, 억 원)은 가치로 정함
   - 연봉 총액 상한(L.cap): 리그를 처음 열 때 팀 평균 연봉 총액의 1.15배. 트레이드·FA로 상한을 넘을 수 없음
   - 트레이드: 같은 종류(타자↔타자, 투수↔투수)끼리 한 명씩. 상대 팀은 받는 가치가 주는 가치보다 크거나 비슷하면 받아들임. 시즌마다 3번
   - FA·드래프트: 시즌이 끝난 뒤(다음 시즌 시작 전)에만. FA는 시즌마다 2명까지, 드래프트는 한 번(성적이 나쁠수록 앞 순번)
   새로 온 선수는 내보낸 선수의 자리(타순·수비 위치·보직)를 그대로 받음 */
const ofRateBat = p => (p.con * 1.2 + p.pow + p.eye * 0.8 + p.spd * 0.4 + p.def * 0.6) / 4;
const ofRatePit = p => (p.ctl + p.stf + (p.vel - 120) * 1.5) / 3;
const ofRate = p => p.vel ? ofRatePit(p) : ofRateBat(p);
const fov = p => Math.round(ofRate(p) + ((p.age || 27) <= 26 ? 3 : (p.age || 27) >= 33 ? -((p.age || 27) - 32) * 2 : 0));
const fsal = p => p.fa ? p.fa : Math.max(0.3, Math.round((ofRate(p) - 38) * 3.2) / 10);   // 억 원 (FA로 데려온 선수는 계약한 연봉)
const eok = x => `${Math.round(x * 10) / 10}억 원`;
const payroll = T => Math.round(allPlayers(T).reduce((s, p) => s + fsal(p), 0) * 10) / 10;
function capOf(L){
  if(!L.cap){ const ts = Object.values(L.teams); L.cap = Math.round(ts.reduce((s, T) => s + payroll(T), 0) / ts.length * 1.15); }
  return L.cap;
}
const OFF = L => (L.office ||= { season: L.season, trades:0, fa:0, drafted:false });
function officeFresh(L){ const o = OFF(L); if(o.season !== L.season){ o.season = L.season; o.trades = 0; o.fa = 0; o.drafted = false; } return o; }
const TRADE_MAX = 3, FA_MAX = 2;
// 선수가 들어 있는 자리: ['bat'|'bench'|'sp'|'rp', 번호]
function slotOf(T, p){ for(const k of ['bat', 'bench', 'sp', 'rp']){ const i = T[k].indexOf(p); if(i >= 0) return [k, i]; } return null; }
// 자리 바꾸기: 들어오는 선수가 나가는 선수의 자리·수비 위치·보직을 받음
// at: 미리 잰 자리 { k, i, pos, role } (트레이드처럼 두 선수를 맞바꿀 때 먼저 재 둠)
const spotOf = (T, p) => { const s = slotOf(T, p); return { k: s[0], i: s[1], pos: p.pos, role: p.role }; };
function putIn(T, out, inc, at){
  const { k, i, pos, role } = at || spotOf(T, out);
  if(k === 'bat') inc.pos = pos;
  if(k === 'sp') inc.role = '선발'; else if(k === 'rp') inc.role = role === '마무리' ? '마무리' : '불펜';
  if(k === 'bench') inc.role = role;
  T[k][i] = inc;
}
const sameKind = (a, b) => !!a.vel === !!b.vel;

/* ---------- 트레이드 ---------- */
// 상대 팀이 받아들일까: 받는 가치 - 주는 가치 (0 이상이면 받아들임, 감독 모드 '쉬움'처럼 우리에게 조금 유리하게 -1까지)
const tradeGain = (mine, theirs) => fov(mine) - fov(theirs);
function tradeCheck(L, mine, theirs){
  const o = officeFresh(L), T = L.teams[L.my];
  if(o.trades >= TRADE_MAX) return `이번 시즌 트레이드는 ${TRADE_MAX}번까지입니다.`;
  if(!sameKind(mine, theirs)) return '타자는 타자끼리, 투수는 투수끼리 바꿉니다.';
  if(payroll(T) - fsal(mine) + fsal(theirs) > capOf(L)) return `연봉 총액 상한(${eok(capOf(L))})을 넘습니다.`;
  if(tradeGain(mine, theirs) < -1) return '상대 구단이 거절했습니다. 더 좋은 선수를 원합니다.';
  return null;
}
function doTrade(L, key, mine, theirs){
  const why = tradeCheck(L, mine, theirs); if(why) return { ok:false, msg: why };
  const T = L.teams[L.my], O = L.teams[key];
  const a = spotOf(T, mine), b = spotOf(O, theirs);
  putIn(O, theirs, mine, b); putIn(T, mine, theirs, a);
  [mine, theirs].forEach(p => { delete p.fa; });
  officeFresh(L).trades++;
  const text = `트레이드: ${teamInfo(L.my).short} ${theirs.name} ↔ ${teamInfo(key).short} ${mine.name}`;
  L.news.push(text + '.'); (L.moves ||= []).push({ season:L.season, day:L.day + 1, text });
  return { ok:true, msg:`트레이드 성사! ${josa(theirs.name, '이', '가')} 우리 팀에 왔고, ${josa(mine.name, '은', '는')} ${josa(teamInfo(key).short, '으로', '로')} 갔습니다.` };
}
// 상대 팀 선수 가운데 바꿀 만한 후보 (같은 종류, 가치가 비슷하거나 낮은 선수 위주로 8명)
function tradeTargets(L, key, mine){
  return allPlayers(L.teams[key]).filter(p => sameKind(p, mine)).map(p => ({ p, gain: tradeGain(mine, p) }))
    .sort((a, b) => fov(b.p) - fov(a.p)).filter(x => x.gain >= -6).slice(0, 8);
}

/* ---------- FA · 드래프트 (시즌 끝난 뒤) ---------- */
const offseason = L => L.phase === 'done';
function faPool(L){
  if(L.faPool && L.faPool.season === L.season) return L.faPool.list;
  const list = [];
  for(let i = 0; i < 6; i++){
    const S = STYLES[pickOne(L, Object.keys(STYLES))], pit = i % 2 === 1;
    const p = leaguePlayer(pit ? makePitcher(L, S, rnd(L) < 0.5, 8) : makeBatter(L, S, Math.floor(rnd(L) * 9), 8), pit ? (rnd(L) < 0.5 ? '선발' : '불펜') : null);
    p.age = 28 + Math.floor(rnd(L) * 6); p.seasons = 6 + Math.floor(rnd(L) * 6);
    p.fa = Math.max(1, Math.round((ofRate(p) - 34) * 4) / 10);   // FA는 시장 값보다 조금 비쌈
    list.push(p);
  }
  L.faPool = { season: L.season, list };
  return list;
}
function signFA(L, fa, out){
  const o = officeFresh(L), T = L.teams[L.my];
  if(!offseason(L)) return { ok:false, msg:'FA 영입은 시즌이 끝난 뒤에 합니다.' };
  if(o.fa >= FA_MAX) return { ok:false, msg:`이번 겨울 FA 영입은 ${FA_MAX}명까지입니다.` };
  if(!sameKind(fa, out)) return { ok:false, msg:'타자 자리에는 타자, 투수 자리에는 투수를 데려옵니다.' };
  if(payroll(T) - fsal(out) + fsal(fa) > capOf(L)) return { ok:false, msg:`연봉 총액 상한(${eok(capOf(L))})을 넘습니다. 연봉이 높은 선수를 내보내 보세요.` };
  putIn(T, out, fa); o.fa++;
  L.faPool.list = L.faPool.list.filter(p => p !== fa);
  const text = `FA 영입: ${fa.name}(연봉 ${eok(fa.fa)}), ${out.name} 방출`;
  L.news.push(text + '.'); (L.moves ||= []).push({ season:L.season, day:L.day + 1, text });
  return { ok:true, msg:`${josa(fa.name, '과', '와')} 계약했습니다! 연봉 ${eok(fa.fa)}. ${josa(out.name, '은', '는')} 팀을 떠났습니다.` };
}
// 드래프트: 정규 시즌 순위가 낮을수록 앞 순번. 앞 순번 팀들이 가치가 높은 선수부터 데려감
function draftPick(L){ const st = standings(L); return st.length - st.findIndex(x => x.T.key === L.my); }
function draftPool(L){
  if(L.draftPool && L.draftPool.season === L.season) return L.draftPool.list;
  const list = [];
  for(let i = 0; i < 12; i++){
    const S = STYLES[pickOne(L, Object.keys(STYLES))], pit = i % 2 === 1;
    const p = leaguePlayer(pit ? makePitcher(L, S, rnd(L) < 0.5, -4 + Math.floor(rnd(L) * 8)) : makeBatter(L, S, Math.floor(rnd(L) * 9), -4 + Math.floor(rnd(L) * 8)), pit ? '불펜' : null);
    p.age = 19 + Math.floor(rnd(L) * 4); p.rookie = true; list.push(p);
  }
  list.sort((a, b) => fov(b) - fov(a));
  const gone = draftPick(L) - 1;   // 앞 순번 팀들이 먼저 데려감 (대개 가장 좋은 선수, 가끔 두 번째)
  for(let j = 0; j < gone && list.length > 6; j++) list.splice(rnd(L) < 0.75 ? 0 : 1, 1);
  L.draftPool = { season: L.season, pick: gone + 1, list: list.slice(0, 6) };
  return L.draftPool.list;
}
function draftSign(L, rk, out){
  const o = officeFresh(L), T = L.teams[L.my];
  if(!offseason(L)) return { ok:false, msg:'신인 드래프트는 시즌이 끝난 뒤에 합니다.' };
  if(o.drafted) return { ok:false, msg:'이번 드래프트에서는 이미 뽑았습니다.' };
  if(!sameKind(rk, out)) return { ok:false, msg:'타자 자리에는 타자, 투수 자리에는 투수를 뽑습니다.' };
  putIn(T, out, rk); o.drafted = true;
  L.draftPool.list = [];
  const text = `신인 드래프트 ${L.draftPool.pick}순위: ${rk.name}(${rk.age}세), ${out.name} 방출`;
  L.news.push(text + '.'); (L.moves ||= []).push({ season:L.season, day:L.day + 1, text });
  return { ok:true, msg:`${L.draftPool.pick}순위로 ${rk.name}(${rk.age}세) 선수를 뽑았습니다! 젊어서 해마다 크게 자랄 수 있습니다.` };
}
// 선수 한 줄 (화면·글 공통)
function foLine(p){
  const kind = p.vel ? `${p.role || '투수'} · 구속 ${p.vel} 제구 ${p.ctl} 구위 ${p.stf}` : `${POS[p.pos] || p.role || ''} · 컨택 ${p.con} 파워 ${p.pow} 선구안 ${p.eye} 스피드 ${p.spd} 수비 ${p.def}`;
  return `가치 ${fov(p)} · 연봉 ${eok(fsal(p))} · ${p.age || '?'}세 · ${kind}`;
}
