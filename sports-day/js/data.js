'use strict';
/* ===================== 상태 ===================== */
const D = {
  config:{}, indiv:[], matches:[], orders:{}, calls:{}, ccalls:{}, roles:{}, presets:{}, absent:{}, msgs:[], devices:[], masters:{}, queues:{}, assets:{},
  amMaster:false, pending:{}, loaded:{}, error:'', fatal:'',
};
const UI = {
  me: idStore.get('udh5_me', ''),
  mtab: ls.get('udh5_mtab', 'game'),          // 마스터 아래 메뉴
  ev: ls.get('udh5_ev', 'tuho'),              // 고른 종목 탭
  stab: ls.get('udh5_stab', ''),             // 여러 역할을 가진 기기의 역할 탭 (coach / ev:종목 / timer:종목)
  coachEv: ls.get('udh5_cev', 'gymball'),     // 감독 화면에서 고른 단체전 종목
  sub: {},                                    // 종목별 보조 화면 (단체전: play/order, 개인전: enter/rank)
  round: { archery:'main', freeball:'main', tuho:'main' },
  lanes: ls.get('udh5_lanes2', { archery:[], freeball:[], tuho:[] }),
  q:'', filter:'all', coachTab:'our', orderTab:'blue',
  rosterText:'', runTimes:{},
  watch:{ running:false, start:0, acc:0 },
};
let store = null;
const online = () => navigator.onLine;

/* ===================== 명단·팀 ===================== */
const settings = () => ({ ...DEFAULT_SETTINGS, ...(D.config.settings||{}) });
const teamName = t => (D.config.teamNames||{})[t] || DEFAULT_TEAM_NAMES[t] || '';
const teamShort = t => teamName(t).slice(0,1) || '?';
function people(){
  const p = D.config.people || {};
  return Object.entries(p).filter(([,v]) => v && !v.deleted && v.name)
    .map(([id,v]) => ({ id, ...v })).sort(byName);
}
const person = id => { const v=(D.config.people||{})[id]; return v ? { id, ...v } : null; };
const pname = id => person(id)?.name || '(삭제된 사람)';
const teamOf = id => person(id)?.team || '';
const isAbsent = id => !!(D.absent[id] && D.absent[id].absent);
const teamBadge = (t, big) => t ? `<span class="tb ${t}${big?' big':''}" title="${esc(teamName(t))}">${esc(teamShort(t))}</span>` : `<span class="tb none${big?' big':''}">?</span>`;

/* ===================== 개인전 ===================== */
function optMap(ev){ const m={}, E=INDIV[ev]; [...(E.legacy ? E.legacy(settings()) : []), ...E.opts(settings())].forEach(([k,l,v]) => m[k]={l,v}); return m; }
const isNum = ev => !!INDIV[ev] && INDIV[ev].mode==='number';          // 숫자 직접 입력 종목
const dirLow = ev => !!INDIV[ev] && INDIV[ev].dir==='low';             // 낮을수록 좋은 기록
const hasPrac = ev => !!INDIV[ev] && INDIV[ev].prac!==false;           // 연습 회차가 있는 종목
const roundKeys = ev => hasPrac(ev) ? ROUND_KEYS : ROUND_KEYS.filter(k => k!=='p1' && k!=='p2');
// 한 번 던진 값: 단추 종목은 단추의 점수, 숫자 종목은 입력한 숫자
function throwVal(ev, k){ if(isNum(ev)){ const v = Number(k); return isFinite(v) ? v : 0; } return optMap(ev)[k]?.v ?? 0; }
const fmtNum = v => v==null||v===''||isNaN(v) ? '-' : (Number.isInteger(+v) ? String(+v) : String(Math.round(+v*1000)/1000));
// 점수 뒤에 붙는 말(점·m 등)까지 붙인 글
const sc = (ev, v) => `${fmtNum(v)}${(INDIV[ev] && INDIV[ev].vunit) ?? '점'}`;
function totalOf(ev, throws){
  if(isNum(ev)) return Math.round((throws||[]).reduce((s,k)=> s + throwVal(ev,k), 0)*1000)/1000;
  const m=optMap(ev); return (throws||[]).reduce((s,k)=> s + (m[k]?.v ?? 0), 0);
}
// 순위 비교: 음수면 a가 더 좋은 기록. 값이 없으면(null) 가장 뒤
function cmpBest(ev, a, b){
  const an = a==null, bn = b==null;
  if(an || bn) return an===bn ? 0 : (an ? 1 : -1);
  return dirLow(ev) ? a-b : b-a;
}
const recId = (ev, round, pid) => `${ev}_${round}_${pid}`;
function rec(ev, round, pid){ return D.indiv.find(r => r.id===recId(ev,round,pid) && !r.deleted && (r.throws||[]).length); }

function standings(ev){
  const main = people().map(p => ({ p, r: rec(ev,'main',p.id) })).filter(x => x.r)
    .map(x => ({ ...x, total: totalOf(ev, x.r.throws), fin: rec(ev,'final',x.p.id) }))
    .map(x => ({ ...x, ftotal: x.fin ? totalOf(ev, x.fin.throws) : null }));
  main.sort((a,b) => cmpBest(ev,a.total,b.total) || cmpBest(ev,a.ftotal,b.ftotal) || byName(a.p,b.p));
  // 본선 기준 순위(동점 공동), 결승 기록이 있으면 그 안에서 다시 나눔
  let rank=0, prevKey=null;
  main.forEach((x,i) => { const key = x.total+'|'+(x.ftotal??''); if(key!==prevKey){ rank=i+1; prevKey=key; } x.rank=rank; });
  const ties = [], byTotal = {};
  main.forEach(x => (byTotal[x.total] ||= []).push(x));
  Object.values(byTotal).forEach(g => {
    if(g.length>1 && main.indexOf(g[0]) < 3){
      const finals = g.map(x=>x.ftotal);
      const resolved = finals.every(f=>f!=null) && new Set(finals).size===finals.length;
      ties.push({ total:g[0].total, names:g.map(x=>x.p.name), ids:g.map(x=>x.p.id), resolved });
    }
  });
  return { list: main, ties };
}

// 연습 1·2(또는 결승)만의 순위: 좋은 기록 순, 동점은 공동 순위
function roundStandings(ev, round){
  const list = people().map(p => ({ p, r: rec(ev, round, p.id) })).filter(x => x.r)
    .map(x => ({ ...x, total: totalOf(ev, x.r.throws) }));
  list.sort((a,b) => cmpBest(ev,a.total,b.total) || byName(a.p,b.p));
  let rank = 0, prev = null;
  list.forEach((x,i) => { if(x.total!==prev){ rank = i+1; prev = x.total; } x.rank = rank; });
  return { list };
}
// 사람 한 명의 회차별 기록 {p1, p2, main, final}
const recsOf = (ev, pid) => ({ p1: rec(ev,'p1',pid), p2: rec(ev,'p2',pid), main: rec(ev,'main',pid), final: rec(ev,'final',pid) });

/* ---------- 개인전 대기 줄 (main/queues/{종목}) ---------- */
// 지운 사람을 뺀 대기 순서
function qList(ev){ const q = D.queues[ev]; return ((q && Array.isArray(q.list)) ? q.list : []).filter(id => { const p = person(id); return !!p && !p.deleted; }); }

/* ===================== 단체전 ===================== */
function matchesOf(ev){ return D.matches.filter(m => m.event===ev && !m.deleted).sort((a,b)=>(a.at||0)-(b.at||0)); }
function tally(ev){ const t={red:0,blue:0,draw:0}; matchesOf(ev).forEach(m => { if(t[m.winner]!=null) t[m.winner]++; }); return t; }
// 승점: 이긴 판 수에 종목의 승점(pts, 기본 1)을 곱해서 더함
function totalPoints(){ const t={red:0,blue:0}; Object.keys(TEAM).forEach(ev => { const x=tally(ev), p=TEAM[ev].pts||1; t.red+=x.red*p; t.blue+=x.blue*p; }); return t; }
// 종목별 설정: 과녁판 중계(board)·대결 점수 기록(score). 기본 종목은 마스터 설정(events.opt), 만든 종목은 자기 설정을 따름. 콩주머니만 과녁판이 기본으로 켜짐
function teamOpt(ev){
  const E = TEAM[ev]; if(!E) return { board:false, score:false };
  if(E.custom) return { board: !!E.board && E.mode==='duel', score: !!E.score && E.mode!=='time' };
  const o = (((D.config.events||{}).opt)||{})[ev] || {};
  return { board: (o.board ?? (ev==='beanbag')) && E.mode==='duel', score: !!(o.score ?? false) && E.mode!=='time' };
}
// 과녁판 위에 찍은 표시 {list:[{t,x,y,n}], first}
function marksOf(ev){ const m = (D.calls[ev]||{}).marks || {}; return { list: Array.isArray(m.list) ? m.list : [], first: m.first==='red' ? 'red' : 'blue', addN:m.addN||0, addAt:m.addAt||0, at:m.at||0 }; }
const targetAsset = ev => (D.assets['target_'+ev] || {}).data || '';
const members = team => people().filter(p => p.team===team).map(p => p.id);
// 감독이 저장한 순서 (팀원만, 지운 사람 제외)
function orderSaved(ev, team){
  const ms = members(team);
  return ((D.orders[`${ev}_${team}`]||{}).list || []).filter(id => ms.includes(id));
}
// 실제 진행 순서: 저장한 순서 뒤에 아직 배치하지 않은 팀원을 가나다순으로 붙임
function orderFor(ev, team){
  const list = orderSaved(ev, team);
  members(team).forEach(id => { if(!list.includes(id)) list.push(id); });
  return list;
}
function plays(ev, team){
  const c={}; matchesOf(ev).forEach(m => { const id = team==='red'? m.redId : m.blueId; if(id) c[id]=(c[id]||0)+1; }); return c;
}
// 출전 횟수가 가장 적은 사람 중 순서가 빠른 사람이 지금 선수, 그다음이 다음 선수
function upNext(ev, team){
  const c = plays(ev, team);
  let q = orderFor(ev, team).map((id,i) => ({ id, i, n:c[id]||0 })).sort((a,b) => a.n-b.n || a.i-b.i);
  // 불참으로 표시한 사람은 건너뜀 (모두 불참이면 그대로)
  if(q.some(x => !isAbsent(x.id))) q = q.filter(x => !isAbsent(x.id));
  if(!q.length) return { cur:null, next:null };
  // 심판이 '선수 바꾸기'로 고른 사람 (모든 기기가 같이 봄)
  const pick = ((D.calls[ev]||{}).pick||{})[team];
  const cur = (pick && q.some(x => x.id===pick)) ? pick : q[0].id;
  const rest = q.filter(x => x.id!==cur);
  return { cur, next: rest.length ? rest[0].id : cur, picked: cur!==q[0].id };
}

// 앞으로 나올 순서 n명: [지금, 다음, 다다음…]. 경기를 차례로 치른다고 셈해서, 팀원이 적으면 처음으로 돌아감
const candOf = (ev, team) => { const ord = orderFor(ev, team), c = ord.filter(id => !isAbsent(id)); return c.length ? c : ord; };
function lineup(ev, team, n){
  const u = upNext(ev, team); if(!u.cur) return [];
  const ord = orderFor(ev, team), cand = candOf(ev, team), c = { ...plays(ev, team) };
  const out = [u.cur]; c[u.cur] = (c[u.cur]||0) + 1;
  while(out.length < n){
    const id = cand.slice().sort((a,b) => (c[a]||0) - (c[b]||0) || ord.indexOf(a) - ord.indexOf(b))[0];
    out.push(id); c[id] = (c[id]||0) + 1;
  }
  return out;
}
// 지금 선수에서 k번째 뒤에 나올 사람 (0 지금, 1 다음, 2 다다음…)
const upcoming = (ev, team, k) => lineup(ev, team, Math.max(0,k)+1)[Math.max(0,k)] || null;
// 두 팀 모두 한 번씩 나오려면 남은 대결 수 (지금 대결 포함)
function remainingMatches(ev){
  const left = team => { const pl = plays(ev, team); return candOf(ev, team).filter(id => !pl[id]).length; };
  return Math.max(left('blue'), left('red'));
}

/* ===================== 역할·권한 =====================
   한 기기에 여러 역할: coach(감독 팀), events(심판 종목), helpers(기록 도우미 종목), timers(계시원 종목), board(안내판), cast(방송 권한) */
function normRole(r){
  const o = { coach:'', events:[], helpers:[], timers:[], board:false, cast:false, monitor:false, voice:false, preset:'', name:'' };
  if(!r) return o;
  o.coach = r.coach || (r.role==='coach' ? (r.team||'') : '');
  o.events = (r.events||[]).filter(e => EVENTS[e]);
  o.helpers = (r.helpers||[]).filter(e => EVENTS[e]);
  o.timers = (r.timers||[]).filter(e => TIME_EVENTS.includes(e));
  o.board = !!r.board || r.role==='board';
  // monitor: true(진행 현황 화면) 또는 'voice'(중계 모드: 보이스오버용 간단 화면)
  o.cast = !!r.cast; o.monitor = !!r.monitor; o.voice = r.monitor==='voice'; o.preset = r.preset||''; o.name = r.name||'';
  return o;
}
const hasDuty = r => !!(r.coach || r.events.length || r.helpers.length || r.timers.length || r.monitor);
// 운영 현황만 보는 기기 (점수·불참 표시를 건드리지 않음. 전체 인원 출석 체크는 할 수 있음)
const monitorOnly = r => !!r.monitor && !(r.coach || r.events.length || r.helpers.length || r.timers.length);
function myRole(){
  if(D.amMaster) return { ...normRole(null), role:'master' };
  const raw = store && D.roles[store.uid], r = normRole(raw);
  r.role = r.board ? 'board' : hasDuty(r) ? 'staff' : 'wait';
  // 맡은 종목이 모두 꺼져 있어서 할 일이 없는 기기 (역할 대기와 다른 안내를 보여 주려고)
  r.offDuty = r.role==='wait' && !!raw && ['events','helpers','timers'].some(k => Array.isArray(raw[k]) && raw[k].length > 0);
  return r;
}
// 점수를 입력할 수 있는 종목 (심판 + 기록 도우미)
function refEvents(r = myRole()){ return [...new Set([...r.events, ...r.helpers])]; }
function roleParts(r){
  const n = es => es.map(e => EVENTS[e].name).join('·'), out = [];
  if(r.role==='master') return [{ icon:'👑', text:'마스터' }];
  if(r.coach) out.push({ icon:'📋', text:`${teamName(r.coach)} 감독` });
  if(r.events.length) out.push({ icon:'🚩', text:`${n(r.events)} 심판` });
  if(r.helpers.length) out.push({ icon:'✏️', text:`${n(r.helpers)} 기록 도우미` });
  if(r.timers.length) out.push({ icon:'⏱', text:`${n(r.timers)} 계시원` });
  if(r.monitor) out.push({ icon:'🧭', text: r.voice ? '운영 현황(중계 모드)' : '운영 현황' });
  if(r.board) out.push({ icon:'📺', text:'안내판' });
  return out;
}
function roleLabel(r){ const p = roleParts(r); return p.length ? p.map(x => x.text).join(' · ') : ROLE_INFO.wait.label; }
const roleIcon = r => (roleParts(r)[0] || { icon:'⏳' }).icon;
// 화면에서도 서버 규칙(firestore.rules)과 같은 기준으로 한 번 더 확인함
const can = {
  master: () => D.amMaster,
  record: ev => D.amMaster || refEvents().includes(ev),
  order: team => D.amMaster || myRole().coach===team,
  time: ev => D.amMaster || myRole().timers.includes(ev) || refEvents().includes(ev),
  staff: () => D.amMaster || hasDuty(myRole()),
  abs: () => D.amMaster || (hasDuty(myRole()) && !monitorOnly(myRole())),     // 선수 불참 표시
  att: () => D.amMaster || myRole().role==='staff',                         // 전체 인원 출석 체크 (운영 현황 전용 기기도 가능, 안내판·역할 대기는 불가)
  ccall: team => D.amMaster || myRole().coach===team,                      // 감독이 자기 팀 선수 부르기
};

/* ===================== 쓰기 ===================== */
// denyMsg: 권한이 없다는 오류일 때만 대신 보여 줄 문구 (예: 서버 규칙이 아직 예전 것일 때)
function guard(p, denyMsg){
  return Promise.resolve(p).then(() => true, e => {
    console.error(e);
    toast(e && e.code==='permission-denied' ? (denyMsg || '이 작업을 할 권한이 없습니다. 마스터에게 역할을 확인해 주세요.') : '저장하지 못했습니다: '+(e.message||e));
    return false;
  });
}
function denied(){ toast('이 작업을 할 권한이 없습니다.'); return Promise.resolve(false); }
const put = (p, obj, merge=true, denyMsg) => guard(store.put(p, obj, merge), denyMsg);
const boardCfg = () => ({ mode:'auto', sound:true, flash:true, chime:true, callVoice:true, prepAhead:2, ...(D.config.board||{}) });
// 안내판 '준비해 주세요'로 부를 선수: 지금 선수 뒤 몇 번째인지 (1 다음, 2 다다음, 3 세 번째 뒤)
const prepAhead = () => Math.max(1, Math.min(3, +boardCfg().prepAhead || 2));
const AHEAD_LABEL = ['지금', '다음', '다다음', '세 번째 뒤'];
const DEFAULT_PHRASES = ['잠시 후 다음 경기가 시작됩니다.', '선수들은 경기장으로 모여 주세요.', '점심시간입니다. 맛있게 드세요.', '시상식을 시작합니다. 모두 본부석 앞으로 모여 주세요.'];
const phrases = () => Array.isArray(D.config.phrases) ? D.config.phrases : DEFAULT_PHRASES;
const setConfig = obj => can.master() ? put(['config'], obj) : denied();

function shortUA(){
  const ua = navigator.userAgent;
  if(/iPad|Macintosh/.test(ua) && navigator.maxTouchPoints>1) return '아이패드';
  if(/iPhone/.test(ua)) return '아이폰';
  if(/Android/.test(ua)) return /Mobile/.test(ua) ? '안드로이드 폰' : '안드로이드 태블릿';
  return 'PC';
}
// 마스터의 접속자 목록에 보이도록 이 기기의 이름과 마지막 접속 시각을 남김
// joined: 이름을 새로 정한 순간 (같은 이름의 예전 기기를 정리할 때 가장 최근에 들어온 기기를 남기려고)
function touchDevice(joined){
  if(!store || !UI.me) return;
  const d = { name:UI.me, seenAt:now(), ua:shortUA() };
  if(joined) d.joinAt = now();
  // 안내판은 소리가 켜져 있는지도 알려 줌 (방송할 때 듣는 안내판 수를 보여 주려고)
  if(myRole().role==='board') d.audio = !!(SND.ready() && boardCfg().sound && !(typeof bdMute==='function' && bdMute()));
  store.put(['main','devices',store.uid], d).catch(()=>{});
}

rebuildEvents();   // 처음에는 기본 종목만 채움 (마스터 설정을 읽으면 app.js에서 다시 채움)
