'use strict';
/* ===================== 야구 기본 자료: 구종 · 팀 스타일 · 팀 · 이름 =====================
   화면과 경기 계산(engine.js)이 함께 씀. Node 시험(tests/sim.js)에서도 그대로 불러옴 */

// spd: 직구 대비 구속 비율 / err: 제구 오차 배율 / fast: 빠른 공 계열(노림수 구분) / gb: 땅볼 유도 / chase: 볼인데 따라 나오게 하는 힘
const PITCH = {
  FB: { name:'직구',     spd:1.00, err:1.00, fast:true,  gb:0.00, chase:0.00 },
  SI: { name:'투심',     spd:0.97, err:1.05, fast:true,  gb:0.10, chase:0.03 },
  CT: { name:'커터',     spd:0.95, err:1.02, fast:true,  gb:0.04, chase:0.05 },
  SL: { name:'슬라이더', spd:0.90, err:1.08, fast:false, gb:0.03, chase:0.10 },
  CU: { name:'커브',     spd:0.81, err:1.18, fast:false, gb:0.06, chase:0.07 },
  CH: { name:'체인지업', spd:0.87, err:1.08, fast:false, gb:0.07, chase:0.09 },
  FK: { name:'포크',     spd:0.89, err:1.15, fast:false, gb:0.10, chase:0.12 },
};
const PITCH_EXTRA = ['SL', 'CU', 'CH', 'FK', 'SI', 'CT'];

// 투구 세기: 구속 차이(km/h) · 제구 오차 배율 · 구위 보정 · 체력 소모(투구 수로 셈)
const POWER = {
  1: { name:'전력 투구', dv:+2, err:1.22, q:+6, cost:1.6 },
  2: { name:'보통',     dv:-2, err:1.00, q:0,  cost:1.0 },
  3: { name:'힘 빼고',  dv:-7, err:0.80, q:-7, cost:0.7 },
};

// 팀 스타일: 능력치 보정과 컴퓨터 작전 성향
// bat·pit: 능력치 더하기 / def: 수비 / aggr: 적극성 / steal·bunt: 작전 빈도 배율 / nibble: 투수가 구석·유인구를 쓰는 정도
const STYLES = {
  power:   { name:'장타형',   desc:'홈런 타자가 많지만 삼진도 많습니다. 적극적으로 휘두릅니다.',
             bat:{ con:-5, pow:+14, eye:-4, spd:-4 }, pit:{}, def:-3, aggr:+15, steal:0.5, bunt:0.3, nibble:0 },
  contact: { name:'교타형',   desc:'정확하게 맞히고 공을 잘 봅니다. 홈런은 적습니다.',
             bat:{ con:+12, pow:-8, eye:+10 }, pit:{}, def:0, aggr:-8, steal:1.0, bunt:1.0, nibble:0 },
  speed:   { name:'기동력형', desc:'발이 빨라 도루와 번트, 내야 안타가 많습니다.',
             bat:{ con:+3, pow:-8, spd:+18 }, pit:{}, def:+3, aggr:0, steal:2.0, bunt:1.8, nibble:0 },
  pitching:{ name:'투수력형', desc:'투수진이 강하고 제구가 좋습니다. 타선은 조금 약합니다.',
             bat:{ con:-4, pow:-4 }, pit:{ vel:+3, ctl:+10, stf:+10, sta:+10 }, def:0, aggr:0, steal:0.8, bunt:1.0, nibble:+0.15 },
  defense: { name:'수비형',   desc:'수비가 탄탄해 안타를 잘 막고 실책이 적습니다. 유인구 승부를 즐깁니다.',
             bat:{ pow:-4 }, pit:{ ctl:+5 }, def:+16, aggr:-4, steal:1.0, bunt:1.3, nibble:+0.1 },
  balance: { name:'균형형',   desc:'공격과 수비가 고르게 갖춰져 있습니다.',
             bat:{ con:+2, pow:+2 }, pit:{ ctl:+2, stf:+2 }, def:+2, aggr:0, steal:1.0, bunt:1.0, nibble:0 },
};

// 가상의 팀 (실제 구단과 관계없음). key는 저장된 경기와 온라인 방에서 쓰므로 바꾸지 않음
const TEAMS = [
  { key:'star',    name:'손잡다 핸즈',     short:'핸즈',     style:'balance',  color:'#facc15' },
  { key:'whale',   name:'서울 블루웨일즈', short:'웨일즈',   style:'contact',  color:'#38bdf8' },
  { key:'thunder', name:'대구 썬더볼츠',   short:'썬더볼츠', style:'power',    color:'#f97316' },
  { key:'hawk',    name:'부산 레드호크스', short:'레드호크스', style:'pitching', color:'#f87171' },
  { key:'swallow', name:'광주 스위프트',   short:'스위프트', style:'speed',    color:'#4ade80' },
  { key:'turtle',  name:'인천 스톤터틀즈', short:'터틀즈',   style:'defense',  color:'#a78bfa' },
  { key:'meteor',  name:'대전 메테오스',   short:'메테오스', style:'power',    color:'#fb923c' },
  { key:'knight',  name:'수원 나이츠',     short:'나이츠',   style:'balance',  color:'#94a3b8' },
  { key:'beacon',  name:'창원 비컨스',     short:'비컨스',   style:'pitching', color:'#22d3ee' },
  { key:'windy',   name:'제주 윈디스',     short:'윈디스',   style:'speed',    color:'#86efac' },
];
// 홈구장. fence: 좌·중·우 담장 거리(미터) · wall: 좌·중·우 담장 높이(미터, 높을수록 넘기기 어렵고 맞고 나오는 2루타)
// turf: 인조 잔디(땅볼이 빠름) · foul: 파울 지역 넓이 배율(넓으면 파울 플라이 아웃이 많음) · dome: 지붕(바람 없음)
// wind: 바람 방향 무게 · spd: 바람 세기 범위 · change: 이닝마다 바람이 바뀔 확률 · hr: 간단 모드 홈런 배율 · tri: 3루타 배율
const PARK_BASE = { fence:[98, 120, 98], wall:[2.5, 2.5, 2.5], turf:false, foul:1, dome:false,
  wind:{ none:15, out:28, in:25, lr:16, rl:16 }, spd:[1, 8], change:0.2, hr:1, tri:1 };
const PARKS = {
  star:    { name:'손잡다 필드', desc:'크기가 알맞은 표준 구장입니다.' },
  whale:   { name:'블루웨일즈 스타디움', desc:'아주 넓은 구장이라 홈런이 적고, 외야 깊숙한 2루타와 3루타가 많습니다.', fence:[101, 125, 101], wall:[2.8, 2.8, 2.8], hr:0.72, tri:1.8 },
  thunder: { name:'썬더볼츠 파크', desc:'담장이 가깝고 낮은 홈런 공장입니다.', fence:[95, 116, 95], wall:[2.2, 2.2, 2.2], hr:1.4 },
  hawk:    { name:'레드호크스 마린필드', desc:'바다에서 홈 쪽으로 부는 바람이 잦아 큰 타구가 자주 막힙니다.', wind:{ none:5, out:10, in:55, lr:15, rl:15 }, spd:[3, 8], hr:0.85 },
  swallow: { name:'스위프트 그라운드', desc:'인조 잔디라 땅볼이 빨라 내야를 빠져나가는 안타가 많습니다.', turf:true, hr:0.95 },
  turtle:  { name:'스톤터틀즈 파크', desc:'파울 지역이 넓어 파울 플라이 아웃이 많습니다.', foul:2.5, hr:0.95 },
  meteor:  { name:'메테오스 볼파크', desc:'왼쪽 담장이 아주 높아 넘기기 어렵고, 담장을 맞고 나오는 2루타가 많습니다.', fence:[96, 118, 99], wall:[6.5, 2.5, 2.5], hr:0.9 },
  knight:  { name:'나이츠 돔', desc:'지붕이 있는 돔 구장이라 바람이 불지 않습니다.', dome:true },
  beacon:  { name:'비컨스 필드', desc:'오른쪽 담장이 가까워 왼손 타자의 홈런이 잘 나옵니다.', fence:[100, 120, 92], hr:1.1 },
  windy:   { name:'윈디스 오름구장', desc:'바람이 세고 방향이 자주 바뀝니다.', wind:{ none:2, out:30, in:30, lr:19, rl:19 }, spd:[4, 10], change:0.55 },
};
const parkInfo = key => ({ key, ...PARK_BASE, ...(PARKS[key] || PARKS.star) });
const teamInfo = key => TEAMS.find(t => t.key === key) || TEAMS[0];

const POS = { P:'투수', C:'포수', '1B':'1루수', '2B':'2루수', '3B':'3루수', SS:'유격수', LF:'좌익수', CF:'중견수', RF:'우익수', DH:'지명타자' };
// 타순별 수비 위치 (1번 중견수 … 9번 유격수)
const LINEUP_POS = ['CF', '2B', 'RF', '1B', 'DH', '3B', 'LF', 'C', 'SS'];

// 컨디션: -2 ~ +2
const COND = { '-2':'아주 나쁨', '-1':'나쁨', '0':'보통', '1':'좋음', '2':'아주 좋음' };

// 가상의 선수 이름 재료
const SURNAMES = ['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송','류','홍','전','고','문','양','손','배','백','허','남','노'];
const GIVEN1 = ['민','서','지','현','도','하','준','성','태','우','시','재','승','유','건','은','동','영','상','진','수','예','주','윤','정','한','규','라','다','온'];
const GIVEN2 = ['준','우','호','민','현','진','훈','석','빈','혁','결','찬','원','율','한','오','후','규','범','람','솔','별','빛','결','온','겸','늘','들'];

// 바람: 방향별로 좌·중·우 타구에 주는 영향(1이면 초속 1미터마다 비거리 +1.6미터)
const WIND = {
  none: { name:'바람 없음',                         f:[0, 0, 0] },
  out:  { name:'외야 쪽으로 부는 바람',             f:[1, 1, 1] },
  in:   { name:'홈 쪽으로 부는 바람',               f:[-1, -1, -1] },
  lr:   { name:'좌익수 쪽에서 우익수 쪽으로 부는 바람', f:[-0.3, 0.3, 0.9] },
  rl:   { name:'우익수 쪽에서 좌익수 쪽으로 부는 바람', f:[0.9, 0.3, -0.3] },
};
const FENCE = [98, 120, 98];          // 좌 · 중 · 우 담장 거리(미터)
const FIELD_NAME = ['왼쪽', '가운데', '오른쪽'];

// 수비 위치: 내야·외야 각각 0 전진 · 1 보통 · 2 후진
const ALIGN_IN = ['전진 수비', '보통 수비', '후진 수비'];
const ALIGN_OUT = ['전진 수비', '보통 수비', '후진 수비'];

// 코스: 행(0 높게 · 1 가운데 · 2 낮게) × 열(0 몸쪽 · 1 가운데 · 2 바깥쪽)
const ZONE_NAME = [
  ['높은 몸쪽', '높은 가운데', '높은 바깥쪽'],
  ['몸쪽', '한가운데', '바깥쪽'],
  ['낮은 몸쪽', '낮은 가운데', '낮은 바깥쪽'],
];
const EDGE = {
  in:   { name:'존 안쪽으로', sub:'안전하게 스트라이크. 대신 맞기 쉽습니다.' },
  edge: { name:'구석에 걸치게', sub:'치기 어렵지만 제구가 흔들리면 볼이 됩니다.' },
  out:  { name:'존 밖으로 빼기', sub:'유인구. 볼이 되기 쉽지만 헛스윙을 노립니다.' },
};
