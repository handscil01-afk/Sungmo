'use strict';
/* ===================== 설정 ===================== */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDihHD0cldHyY0MWViA_R0yb-nkIoJ_-4I",
  authDomain: "handscil-sports.firebaseapp.com",
  projectId: "handscil-sports",
  storageBucket: "handscil-sports.firebasestorage.app",
  messagingSenderId: "431367162993",
  appId: "1:431367162993:web:fa488b8e5d0acc98ffdfd0"
};
const ROOT = 'undonghoe5';
// 무전기·음성 안내방송 중계용 Realtime Database (싱가포르)
const RTDB_URL = 'https://handscil-sports-default-rtdb.asia-southeast1.firebasedatabase.app';
// 주소 뒤에 ?demo=1 을 붙이면 이 기기에만 저장하는 연습 모드
const DEMO = new URLSearchParams(location.search).has('demo');
const DEMO_MASTER_PW = '0000';
// firestore.rules 를 고칠 때마다 올림: 마스터 기기가 서버에 올라간 규칙이 최신인지 확인하는 데 씀
const RULES_VER = 12;
// 담당자 명단에서 역할을 고르다가 권한 오류가 나면: 서버 규칙을 아직 새 것으로 바꾸지 않은 경우가 많음
const RULES_OLD_MSG = '서버 규칙이 아직 바뀌지 않아 이 역할로 들어갈 수 없습니다. 마스터에게 알려 주세요.';

/* ===================== 종목 정의 =====================
   INDIV_BASE·TEAM_BASE는 기본으로 들어 있는 종목. 화면에서 쓰는 INDIV·TEAM·EVENTS와 ORDER_EVENTS·TIME_EVENTS는
   rebuildEvents()가 마스터 설정(D.config.events: 끄기 off, 새 종목 custom)에 맞춰 같은 객체·배열을 그대로 고쳐서 다시 채움 */
// showPracRank: 안내판에 연습 순위도 보일지 / tugRounds: 줄다리기 계획 판 수(진행 현황의 남은 시간 계산용)
// beanbagMode: 콩주머니 승부 방식 (A 5판 3선승 / B 컬링식 총점)
const DEFAULT_SETTINGS = { showPracRank: true, tugRounds: 3, beanbagMode: 'A' };
// 콩주머니: 한 사람이 던지는 개수, 최대 판 수, 3선승
const BEANBAG_THROWS = 3, BEANBAG_ROUNDS = 5, BEANBAG_WINS = 3;
// 개인전 회차: 연습 1·2, 본선(순위 기준), 결승(동점 가리기)
const ROUNDS = { p1:'연습 1', p2:'연습 2', main:'본선', final:'결승' };
const ROUND_SHORT = { p1:'연1', p2:'연2', main:'본선', final:'결승' };
const ROUND_KEYS = ['p1','p2','main','final'];
// unit: 한 차례를 세는 말 / vunit: 점수(값) 뒤에 붙는 말 / prac: 연습 회차 / mode: buttons(점수 단추 합계)·number(숫자 직접 입력) / dir: high(높을수록)·low(낮을수록)
// legacy: 예전 기록에 남아 있는 단추 이름(읽을 때만 씀) / grid: 단추를 격자로 늘어놓는 종목(숫자 = 'n숫자' 단추, 나머지 단추는 아래에 넓게) / gridNote: 격자 아래 넓은 단추에 붙는 작은 글씨
// 탭·안내판·시상식·보고서는 이 순서(양궁 → 투호 → 후리볼)를 따름
const INDIV_BASE = {
  archery: { name:'양궁', icon:'🏹', color:'#6d28d9', lanes:2, count:5, unit:'발',
    hint:'과녁 5 · 배너 3 · 바깥 0',
    opts: s => [['t','과녁',5],['b','배너',3],['o','바깥',0]] },
  // 투호: 출발선에서 창 머리끝이 놓인 거리 구간이 점수 (가운데 구간이 가장 높음)
  tuho:    { name:'투호', icon:'🏺', color:'#a16207', lanes:2, count:5, unit:'개',
    hint:'구간별 10 · 20 · 30 · 20 · 10점, 2m 미만·선 밖 0점',
    opts: s => [['z1','2~3.5m',10],['z2','3.5~5m',20],['z3','5~6.5m',30],['z4','6.5~8m',20],['z5','8m 이상',10],['z0','2m 미만·선 밖',0]],
    // 예전(점수 단추) 기록을 읽을 때만 씀
    legacy: s => [['s30','30점',30],['s20','20점',20],['s10','10점',10],['s0','0점',0],['out','선 밖',0]] },
  // 후리볼: 공이 붙은 칸의 숫자가 점수. 네트 배치 그대로 3x3 단추 + 아래 넓은 0점 단추
  freeball:{ name:'후리볼', icon:'⛳', color:'#0f766e', lanes:1, count:5, unit:'번',
    hint:'공이 붙은 칸의 숫자(1~9점), 안 붙으면 0점',
    grid: [[6,3,7],[4,1,5],[8,2,9]], gridNote:'네트에 안 붙음 · 헛스윙 · 타격대',
    opts: s => [['n1','1점',1],['n2','2점',2],['n3','3점',3],['n4','4점',4],['n5','5점',5],['n6','6점',6],['n7','7점',7],['n8','8점',8],['n9','9점',9],['zero','0점',0]],
    // 예전(네트 안·닿음 등) 기록을 읽을 때만 씀: 파울은 1점 고정
    legacy: s => [['in','네트 안',5],['net','네트 닿음',3],['line','라인 안',2],['foul','파울',1],['miss','헛스윙·0점',0]] },
};
// 단체전은 종목마다 이긴 팀에 승점 pts(기본 1)점. 종목 결과는 심판이 '결과 확정'을 눌러야 승점에 들어감 (main/calls/{종목}.result)
// name: 화면용 짧은 이름 / full: 풀네임 / mode: duel(1:1 대결)·round(판 단위)·time(기록 비교, 직접 만든 종목만) / agg:'sum' 이면 점수(핀) 합계로 비교
// group: 한 조 인원(콩주머니) / max: 대결 점수 최댓값 / unit: 합계 단위 / scoreFixed: 대결 점수 기록이 정해져 있음 / bag: 콩주머니 승부 방식 설정을 따름
// board: 과녁판 중계(1:1 대결만) / score: 대결 점수도 기록 (기본 종목은 D.config.events.opt 에서 읽음) / rounds: 계획 판 수
const TEAM_BASE = {
  overball:{ name:'짐볼 넘기기', full:'머리 위로 짐볼 넘기기', icon:'🏐', color:'#0369a1', mode:'round', rounds:1,
    hint:'한 줄로 서서 짐볼을 머리 위와 다리 사이로 번갈아 뒤로 넘겨, 맨 끝까지 먼저 보낸 팀이 이깁니다' },
  bowling: { name:'짐볼 볼링', icon:'🎳', color:'#be185d', mode:'duel', agg:'sum', scoreFixed:true, max:10, unit:'핀',
    hint:'한 사람씩 짐볼을 한 번 굴려 쓰러뜨린 핀(10개)을 팀별로 더하고, 합계가 많은 팀이 이깁니다' },
  beanbag: { name:'콩주머니', icon:'🎯', color:'#4d7c0f', mode:'duel', group:2, bag:true, scoreFixed:true, unit:'점',
    hint:'두 명씩 한 조로, 1인 3개씩 한 개씩 번갈아 던져 정중앙에 가까운 쪽이 이깁니다' },
  threeleg:{ name:'2인3각', icon:'👣', color:'#854d0e', mode:'duel',
    hint:'참여자와 짝이 한 쌍으로 달려 먼저 들어온 쪽이 이기고, 많이 이긴 팀이 종목을 가져갑니다' },
  tug:     { name:'줄다리기', icon:'🪢', color:'#c2410c', mode:'round',
    hint:'판마다 이긴 팀을 기록하고, 많이 이긴 팀이 종목을 가져갑니다' },
};
// 양궁: 담당자가 가운데 서고 양옆 두 명이 동시에 쏘므로 화살 색으로 구분함
const LANE_LABELS_BASE = { tuho:['초록 투호','빨강 투호'], archery:['파랑 화살','빨강 화살'], freeball:['타석'] };
// 화면에서 쓰는 살아 있는 종목표 (rebuildEvents가 채움)
const INDIV = {}, TEAM = {}, EVENTS = {};
const ORDER_EVENTS = [];      // 감독이 출전 순서를 정하는 종목 (줄다리기처럼 판마다 여럿이 나오는 종목은 제외)
const TIME_EVENTS = [];       // 계시원이 시간을 재는 종목
const LANE_LABELS = {};

// 화면에는 파랑(blue)을 왼쪽(먼저), 빨강(red)을 오른쪽에 둠. 기본 이름: 파랑 = 이가네, 빨강 = 함씨네 (마스터가 바꿀 수 있음)
const TEAM_KEYS = ['blue','red'];
const DEFAULT_TEAM_NAMES = { blue:'이가네', red:'함씨네' };

const clampInt = (v, lo, hi, d) => { v = parseInt(v, 10); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
const fillIndiv = v => ({ vunit:'점', prac:true, mode:'buttons', dir:'high', ...v });
const fillTeam = v => ({ pts:1, ...v });
// 마스터가 만든 개인전: opts 는 저장할 때 [{k,l,v}] (파이어스토어는 배열 안의 배열을 못 저장함)
function buildCustomIndiv(d){
  const num = d.mode==='number', low = d.dir==='low';
  const opts = (Array.isArray(d.opts) ? d.opts : []).map(o => [String(o.k), String(o.l), Number(o.v)||0]);
  return { name:String(d.name), icon:d.icon||'🎲', color:d.color||'#334155', lanes: d.lanes===2 ? 2 : 1, count:clampInt(d.count, 1, 10, num ? 1 : 5),
    unit:'번', vunit: num ? String(d.unit||'') : '점',
    hint: num ? `숫자를 직접 넣습니다. ${low ? '낮을수록' : '높을수록'} 좋은 기록입니다.` : (opts.map(o => `${o[1]} ${o[2]}`).join(' · ')),
    opts: num ? (() => []) : (() => opts), prac:!!d.prac, mode: num ? 'number' : 'buttons', dir: low ? 'low' : 'high', custom:true };
}
function buildCustomTeam(d){
  const mode = ['duel','time','round'].includes(d.tmode) ? d.tmode : 'duel', pts = clampInt(d.pts, 1, 5, 1);
  const hint = { duel:'1:1로 겨뤄 많이 이긴 팀이 종목 승점을 얻습니다.', time:'기록(초)이 빠른 쪽이 이깁니다. 많이 이긴 팀이 종목 승점을 얻습니다.', round:'판마다 이긴 팀을 기록하고, 많이 이긴 팀이 종목 승점을 얻습니다.' }[mode] + (pts>1 ? ` 종목을 이기면 ${pts}점입니다.` : '');
  return { name:String(d.name), icon:d.icon||'🎲', color:d.color||'#334155', mode, hint, pts, custom:true, board: mode==='duel' && !!d.board, score: mode!=='time' && !!d.score };
}
// 켜짐·꺼짐과 관계없이 모든 종목 (기본 + 마스터가 만든 것, 지운 것은 빼고): [{ key, kind, E, custom, off, def }]
function allEventList(){
  const cfg = (typeof D!=='undefined' && D.config && D.config.events) || {}, off = cfg.off || {}, out = [];
  Object.entries(INDIV_BASE).forEach(([k,v]) => out.push({ key:k, kind:'indiv', E:fillIndiv(v), custom:false, off:!!off[k] }));
  Object.entries(TEAM_BASE).forEach(([k,v]) => out.push({ key:k, kind:'team', E:fillTeam(v), custom:false, off:!!off[k] }));
  Object.entries(cfg.custom || {}).filter(([,d]) => d && !d.deleted && d.name && (d.kind==='indiv' || d.kind==='team'))
    .sort((a,b) => (a[1].at||0) - (b[1].at||0)).forEach(([k,d]) =>
      out.push({ key:k, kind:d.kind, E: d.kind==='team' ? buildCustomTeam(d) : buildCustomIndiv(d), custom:true, off:!!off[k], def:d }));
  return out;
}
// 같은 객체·배열을 그대로 고쳐서 채움: 다른 파일에서 INDIV·TEAM·EVENTS를 순회하면 꺼진 종목은 자동으로 빠짐
function rebuildEvents(){
  [INDIV, TEAM, EVENTS, LANE_LABELS].forEach(o => Object.keys(o).forEach(k => delete o[k]));
  ORDER_EVENTS.length = 0; TIME_EVENTS.length = 0;
  Object.entries(LANE_LABELS_BASE).forEach(([k,v]) => { LANE_LABELS[k] = v; });
  allEventList().filter(x => !x.off).forEach(x => {
    if(x.kind==='indiv'){
      INDIV[x.key] = x.E; EVENTS[x.key] = { ...x.E, kind:'indiv' };
      if(x.custom) LANE_LABELS[x.key] = x.E.lanes===2 ? ['왼쪽','오른쪽'] : ['타석'];
    } else {
      TEAM[x.key] = x.E; EVENTS[x.key] = { ...x.E, kind:'team' };
      if(x.E.mode!=='round') ORDER_EVENTS.push(x.key);
      if(x.E.mode==='time') TIME_EVENTS.push(x.key);
    }
  });
  Object.keys(LANE_LABELS).forEach(k => { if(!INDIV[k]) delete LANE_LABELS[k]; });
  // 예전에 저장된 감독 화면 종목(없어진 종목 포함)이 지금 없으면 첫 종목으로
  if(typeof UI !== 'undefined' && !ORDER_EVENTS.includes(UI.coachEv)) UI.coachEv = ORDER_EVENTS[0] || '';
}

const ROLE_INFO = {
  master:  { label:'마스터', icon:'👑' },
  referee: { label:'심판',   icon:'🚩' },
  coach:   { label:'감독',   icon:'📋' },
  board:   { label:'안내판', icon:'📺' },
  wait:    { label:'역할 대기', icon:'⏳' },
};
