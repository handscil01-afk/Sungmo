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

/* ===================== 종목 정의 ===================== */
// showPracRank: 안내판에 연습 순위도 보일지 / tugRounds: 줄다리기 계획 판 수(진행 현황의 남은 시간 계산용)
const DEFAULT_SETTINGS = { tuhoShort: 0, foul: 1, showPracRank: true, tugRounds: 3 };
// 개인전 회차: 연습 1·2, 본선(순위 기준), 결승(동점 가리기)
const ROUNDS = { p1:'연습 1', p2:'연습 2', main:'본선', final:'결승' };
const ROUND_SHORT = { p1:'연1', p2:'연2', main:'본선', final:'결승' };
const ROUND_KEYS = ['p1','p2','main','final'];
const INDIV = {
  archery: { name:'양궁', icon:'🏹', color:'#6d28d9', lanes:2, count:5, unit:'발',
    hint:'과녁 5 · 배너 3 · 밖 0',
    opts: s => [['t','과녁',5],['b','배너',3],['o','배너 밖',0]] },
  freeball:{ name:'후리볼', icon:'⛳', color:'#0f766e', lanes:1, count:5, unit:'번',
    hint:'네트 안 5 · 닿음 3 · 라인 안 2',
    opts: s => [['in','네트 안',5],['net','네트 닿음',3],['line','라인 안',2],['foul','파울',s.foul],['miss','헛스윙·0점',0]] },
  tuho:    { name:'투호', icon:'🏺', color:'#a16207', lanes:2, count:5, unit:'개',
    hint:'30 · 20 · 10 · 0점',
    opts: s => [['s30','30점',30],['s20','20점',20],['s10','10점',10],['s0','0점',0]],
    // 예전(거리 칸) 기록을 읽을 때만 씀
    legacy: s => [['z0','2m 미만',s.tuhoShort],['z1','2~3.5m',10],['z2','3.5~5m',20],['z3','5~6.5m',30],['z4','6.5~8m',20],['z5','8~9.5m',10],['out','선 밖',0]] },
};
const TEAM = {
  gymball: { name:'짐볼 차기', icon:'⚽', color:'#15803d', mode:'duel', hint:'더 멀리 찬 사람이 이깁니다' },
  threeleg:{ name:'2인3각', icon:'👣', color:'#854d0e', mode:'duel', hint:'반환점을 돌아 먼저 들어온 조가 이깁니다' },
  beanbag: { name:'콩주머니', icon:'🎯', color:'#4d7c0f', mode:'duel', hint:'1인 5개씩 번갈아 던져 가운데에 가장 가까운 쪽이 이깁니다' },
  run:     { name:'줄 잡고 달리기', icon:'🏃', color:'#334155', mode:'time', hint:'기록(초)이 빠른 사람이 이깁니다' },
  tug:     { name:'줄다리기', icon:'🪢', color:'#c2410c', mode:'round', hint:'판마다 이긴 팀에 승점 1점' },
};
const EVENTS = {};
Object.entries(INDIV).forEach(([k,v]) => EVENTS[k] = { ...v, kind:'indiv' });
Object.entries(TEAM).forEach(([k,v]) => EVENTS[k] = { ...v, kind:'team' });
// 감독이 출전 순서를 정하는 종목 (줄다리기는 판마다 여럿이 나와서 제외)
const ORDER_EVENTS = Object.keys(TEAM).filter(k => TEAM[k].mode !== 'round');

// 화면에는 청팀을 왼쪽(먼저), 홍팀을 오른쪽에 둠
const TEAM_KEYS = ['blue','red'];
const DEFAULT_TEAM_NAMES = { blue:'청팀', red:'홍팀' };
const LANE_LABELS = { tuho:['초록 투호','빨강 투호'], archery:['왼쪽 사대','오른쪽 사대'], freeball:['타석'] };

const ROLE_INFO = {
  master:  { label:'마스터', icon:'👑' },
  referee: { label:'심판',   icon:'🚩' },
  coach:   { label:'감독',   icon:'📋' },
  board:   { label:'안내판', icon:'📺' },
  wait:    { label:'역할 대기', icon:'⏳' },
};
