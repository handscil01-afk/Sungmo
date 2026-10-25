'use strict';
/* ===================== 상태 ===================== */
const D = {
  config:{}, indiv:[], matches:[], orders:{}, roles:{}, devices:[], masters:{},
  amMaster:false, pending:{}, loaded:{}, error:'', fatal:'',
};
const UI = {
  me: idStore.get('udh5_me', ''),
  mtab: ls.get('udh5_mtab', 'game'),          // 마스터 아래 메뉴
  ev: ls.get('udh5_ev', 'tuho'),              // 고른 종목 탭
  sub: {},                                    // 종목별 보조 화면 (단체전: play/order, 개인전: enter/rank)
  round: { archery:'main', freeball:'main', tuho:'main' },
  lanes: ls.get('udh5_lanes2', { archery:[], freeball:[], tuho:[] }),
  q:'', filter:'all',
  pick:{}, rosterText:'', runTimes:{},
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
const teamBadge = (t, big) => t ? `<span class="tb ${t}${big?' big':''}" title="${esc(teamName(t))}">${esc(teamShort(t))}</span>` : `<span class="tb none${big?' big':''}">?</span>`;

/* ===================== 개인전 ===================== */
function optMap(ev){ const m={}; INDIV[ev].opts(settings()).forEach(([k,l,v]) => m[k]={l,v}); return m; }
function totalOf(ev, throws){ const m=optMap(ev); return (throws||[]).reduce((s,k)=> s + (m[k]?.v ?? 0), 0); }
const recId = (ev, round, pid) => `${ev}_${round}_${pid}`;
function rec(ev, round, pid){ return D.indiv.find(r => r.id===recId(ev,round,pid) && !r.deleted && (r.throws||[]).length); }

function standings(ev){
  const main = people().map(p => ({ p, r: rec(ev,'main',p.id) })).filter(x => x.r)
    .map(x => ({ ...x, total: totalOf(ev, x.r.throws), fin: rec(ev,'final',x.p.id) }))
    .map(x => ({ ...x, ftotal: x.fin ? totalOf(ev, x.fin.throws) : null }));
  main.sort((a,b) => b.total-a.total || ((b.ftotal??-1)-(a.ftotal??-1)) || byName(a.p,b.p));
  // 본경기 기준 순위(동점 공동), 결승 기록이 있으면 그 안에서 다시 나눔
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

/* ===================== 단체전 ===================== */
function matchesOf(ev){ return D.matches.filter(m => m.event===ev && !m.deleted).sort((a,b)=>(a.at||0)-(b.at||0)); }
function tally(ev){ const t={red:0,blue:0,draw:0}; matchesOf(ev).forEach(m => { if(t[m.winner]!=null) t[m.winner]++; }); return t; }
function totalPoints(){ const t={red:0,blue:0}; Object.keys(TEAM).forEach(ev => { const x=tally(ev); t.red+=x.red; t.blue+=x.blue; }); return t; }
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
  const q = orderFor(ev, team).map((id,i) => ({ id, i, n:c[id]||0 })).sort((a,b) => a.n-b.n || a.i-b.i);
  if(!q.length) return { cur:null, next:null };
  const pick = (UI.pick[ev]||{})[team];
  const cur = (pick && q.some(x => x.id===pick)) ? pick : q[0].id;
  const rest = q.filter(x => x.id!==cur);
  return { cur, next: rest.length ? rest[0].id : cur, picked: cur!==q[0].id };
}

/* ===================== 역할·권한 ===================== */
function myRole(){
  if(D.amMaster) return { role:'master' };
  const r = store && D.roles[store.uid];
  return r && ROLE_INFO[r.role] && r.role!=='master' ? r : { role:'wait' };
}
function refEvents(r = myRole()){ return r.role==='referee' ? (r.events||[]).filter(e => EVENTS[e]) : []; }
function roleLabel(r){
  if(!r) return ROLE_INFO.wait.label;
  if(r.role==='referee'){ const es = refEvents(r); return es.length ? es.map(e=>EVENTS[e].name).join('·')+' 심판' : '심판(종목 없음)'; }
  if(r.role==='coach') return teamName(r.team)+' 감독';
  return ROLE_INFO[r.role]?.label || ROLE_INFO.wait.label;
}
// 화면에서도 서버 규칙(firestore.rules)과 같은 기준으로 한 번 더 확인함
const can = {
  master: () => D.amMaster,
  record: ev => D.amMaster || refEvents().includes(ev),
  order: team => D.amMaster || (myRole().role==='coach' && myRole().team===team),
};

/* ===================== 쓰기 ===================== */
function guard(p){
  return Promise.resolve(p).then(() => true, e => {
    console.error(e);
    toast(e && e.code==='permission-denied' ? '이 작업을 할 권한이 없습니다. 마스터에게 역할을 확인해 주세요.' : '저장하지 못했습니다: '+(e.message||e));
    return false;
  });
}
function denied(){ toast('이 작업을 할 권한이 없습니다.'); return Promise.resolve(false); }
const put = (p, obj, merge=true) => guard(store.put(p, obj, merge));
const setConfig = obj => can.master() ? put(['config'], obj) : denied();

function shortUA(){
  const ua = navigator.userAgent;
  if(/iPad|Macintosh/.test(ua) && navigator.maxTouchPoints>1) return '아이패드';
  if(/iPhone/.test(ua)) return '아이폰';
  if(/Android/.test(ua)) return /Mobile/.test(ua) ? '안드로이드 폰' : '안드로이드 태블릿';
  return 'PC';
}
// 마스터의 접속자 목록에 보이도록 이 기기의 이름과 마지막 접속 시각을 남김
function touchDevice(){
  if(!store || !UI.me) return;
  store.put(['main','devices',store.uid], { name:UI.me, seenAt:now(), ua:shortUA() }).catch(()=>{});
}
