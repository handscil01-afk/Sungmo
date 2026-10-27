'use strict';
/* ===================== 처음 화면 · 경기 준비 · 설정 · 도움말 ===================== */

/* ---------- 처음 화면 ---------- */
function homeScreen(){
  const sv = loadSaved();
  return { top: installBanner(), q:'무엇을 할까요?',
    note:['공 하나하나를 고르며 진행하는 확률 야구입니다.', '번호 키, 화면 단추, 명령 칸 가운데 편한 방법으로 고릅니다.', '0은 지금 상황, 점(.)은 뒤로, 곱하기(*)는 키 안내입니다.'],
    opts:[
      { n:1, t:'혼자 하기', s:'컴퓨터 팀과 대결합니다.', act: v => { NEW.kind = '1p'; go(modeScreen, v); } },
      { n:2, t:'둘이 하기', s:'한 기기를 번갈아 쓰며 대결합니다.', act: v => { NEW.kind = '2p'; go(modeScreen, v); } },
      { n:3, t:'온라인 대전', s:'각자 휴대폰으로 만나 대결하고, 채팅과 음성 대화를 합니다.', act: v => go(onlineHome, v) },
      { n:4, t:'컴퓨터끼리 관전', s:'컴퓨터 두 팀의 경기를 듣습니다.', act: v => { NEW.kind = 'watch'; go(modeScreen, v); } },
      { n:5, t:'이어하기', hide: !sv, s: sv ? `${sv.G.mode === 'simple' ? '간단' : '정밀'} 모드, ${situation(sv.G)}` : '', act: v => resumeGame(v) },
      { n:6, t:'게임 방법과 키 안내', act: v => go(() => helpScreen(() => go(homeScreen, 'click')), v) },
      { n:7, t:'설정', s:'글자 크기, 화면 색, 읽어 주기, 효과음, 진동', act: v => go(() => settingsScreen(() => go(homeScreen, 'click')), v) },
      { n:8, t:'홈 화면에 설치하기', hide: !canInstall(), s:'아이콘으로 바로 열고 화면을 넓게 씁니다.', act: () => doInstall() },
    ] };
}

/* ---------- 경기 준비 ---------- */
const NEW = { kind:'1p', mode:'simple', a:null, b:null, first:1, innings:3, diff:1 };
const teamLabel = k => { const t = teamInfo(k); return `${t.name} (${STYLES[t.style].name})`; };
function modeScreen(){
  return { q:'어떤 방식으로 할까요?', back: v => go(NEW.kind === 'online' ? onlineHome : homeScreen, v), opts:[
    { n:1, t:'간단 모드', s:'타석마다 한 번 고르고, 주사위로 결과를 정합니다. 처음 해 보는 분께 알맞습니다.', act: v => { NEW.mode = 'simple'; go(() => teamScreen(0), v); } },
    { n:2, t:'정밀 모드', s:'공 하나마다 구종, 코스, 세기를 고릅니다. 선수 능력치, 컨디션, 바람, 수비 위치가 결과를 바꿉니다.', act: v => { NEW.mode = 'detail'; go(() => teamScreen(0), v); } },
  ] };
}
function teamScreen(which){
  const q = NEW.kind === '1p' || NEW.kind === 'online' ? (which ? '상대 팀을 고르세요.' : '내 팀을 고르세요.')
          : NEW.kind === '2p' ? (which ? '둘째 사람의 팀을 고르세요.' : '첫째 사람의 팀을 고르세요.')
          : (which ? '홈 팀을 고르세요.' : '원정 팀을 고르세요.');
  const taken = which ? NEW.a : null;
  const list = TEAMS.filter(t => t.key !== taken);
  const set = (k, v) => {
    if(which){ NEW.b = k; go(NEW.kind === 'watch' ? inningsScreen : sideScreen, v); }
    else { NEW.a = k; go(() => teamScreen(1), v); }
  };
  const opts = list.map((t, i) => ({ n: i + 1, t: t.name, s: `${STYLES[t.style].name}. ${STYLES[t.style].desc}`, act: v => set(t.key, v) }));
  opts.push({ n: list.length + 1, t:'아무 팀이나', s:'무작위로 고릅니다.', act: v => set(list[Math.floor(Math.random() * list.length)].key, v) });
  return { q, opts, back: v => go(which ? () => teamScreen(0) : modeScreen, v) };
}
function sideScreen(){
  const me = NEW.kind === '2p' ? '첫째 사람 팀' : '내 팀';
  const set = (f, v) => { NEW.first = f; go(inningsScreen, v); };
  return { q:`${me}(${teamInfo(NEW.a).short})이 먼저 공격할까요?`, back: v => go(() => teamScreen(1), v), opts:[
    { n:1, t:'먼저 공격', s:'원정 팀이 되어 매회 초에 공격합니다.', act: v => set(1, v) },
    { n:2, t:'나중에 공격', s:'홈 팀이 되어 매회 말에 공격합니다. 끝내기 승리를 노릴 수 있습니다.', act: v => set(2, v) },
    { n:3, t:'무작위', act: v => set(Math.random() < 0.5 ? 1 : 2, v) },
  ] };
}
function inningsScreen(){
  const set = (n, v) => { NEW.innings = n; if(NEW.kind === 'online') createRoomFlow(v); else go(NEW.kind === '1p' ? diffScreen : readyScreen, v); };
  return { q:'몇 이닝 경기를 할까요?', back: v => go(NEW.kind === 'watch' ? () => teamScreen(1) : sideScreen, v), opts:[
    { n:1, t:'1이닝', s:'맛보기. 몇 분이면 끝납니다.', act: v => set(1, v) },
    { n:2, t:'3이닝', s:'짧은 경기.', act: v => set(3, v) },
    { n:3, t:'5이닝', act: v => set(5, v) },
    { n:4, t:'7이닝', act: v => set(7, v) },
    { n:5, t:'9이닝', s:'정식 경기. 정밀 모드는 꽤 오래 걸립니다.', act: v => set(9, v) },
  ] };
}
function diffScreen(){
  const set = (d, v) => { NEW.diff = d; go(readyScreen, v); };
  return { q:'컴퓨터 팀의 수준을 고르세요.', back: v => go(inningsScreen, v), opts:[
    { n:1, t:'쉬움', s:'컴퓨터 팀 능력치가 조금 낮고, 치기 좋은 공을 자주 던집니다.', act: v => set(0, v) },
    { n:2, t:'보통', act: v => set(1, v) },
    { n:3, t:'어려움', s:'컴퓨터 팀 능력치가 조금 높습니다.', act: v => set(2, v) },
  ] };
}
function newOpts(){
  const meFirst = NEW.first === 1;
  const teams = NEW.kind === 'watch' ? [NEW.a, NEW.b] : meFirst ? [NEW.a, NEW.b] : [NEW.b, NEW.a];
  let ctrl = ['cpu', 'cpu'], who = ['', ''];
  if(NEW.kind === '1p') ctrl = meFirst ? ['human', 'cpu'] : ['cpu', 'human'];
  if(NEW.kind === '2p'){ ctrl = ['human', 'human']; who = meFirst ? ['첫째 사람', '둘째 사람'] : ['둘째 사람', '첫째 사람']; }
  return { mode: NEW.mode, innings: NEW.innings, teams, ctrl, who, diff: NEW.diff, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0 };
}
function readyScreen(){
  const o = newOpts();
  const role = ti => NEW.kind === '1p' ? (o.ctrl[ti] === 'human' ? '내 팀' : '컴퓨터') : NEW.kind === '2p' ? o.who[ti] : '컴퓨터';
  const say = [
    `${NEW.mode === 'simple' ? '간단' : '정밀'} 모드, ${NEW.innings}이닝 경기입니다.`,
    `원정(먼저 공격): ${teamLabel(o.teams[0])}, ${role(0)}.`,
    `홈(나중에 공격): ${teamLabel(o.teams[1])}, ${role(1)}.`,
  ];
  if(NEW.kind === '1p') say.push(`컴퓨터 수준: ${['쉬움', '보통', '어려움'][NEW.diff]}.`);
  if(NEW.kind === '2p') say.push('수비하는 사람이 먼저 공을 고르고, 기기를 넘겨 공격하는 사람이 고릅니다.');
  return { q:'이대로 시작할까요?', say, back: v => go(NEW.kind === '1p' ? diffScreen : inningsScreen, v), opts:[
    { n:1, t:'경기 시작', act: v => startGame(newOpts(), v) },
    { n:2, t:'처음부터 다시 고르기', act: v => go(modeScreen, v) },
  ] };
}

/* ---------- 설정 ---------- */
const FS_NAMES = ['보통', '크게', '아주 크게', '가장 크게'];
const THEMES = { dark:'어두운 화면 (고대비)', light:'밝은 화면', yellow:'노랑 바탕에 검정 글씨' };
const VOICES = { sr:'화면 낭독기 (보이스오버·톡백·점자)', tts:'기기 음성으로 읽기', off:'읽지 않기' };
const onOff = b => b ? '켬' : '끔';
function cycle(list, cur){ const i = list.indexOf(cur); return list[(i + 1) % list.length]; }
function settingsScreen(backTo){
  const ch = (fn, label) => () => { fn(); saveSet(); stay(label()); };
  return { q:'설정입니다. 고를 때마다 값이 바뀝니다.', back: v => backTo(v), opts:[
    { n:1, t:`글자 크기: ${FS_NAMES[SET.fs]}`, act: ch(() => { SET.fs = (SET.fs + 1) % FS_NAMES.length; }, () => `글자 크기 ${FS_NAMES[SET.fs]}`) },
    { n:2, t:`화면 색: ${THEMES[SET.theme]}`, act: ch(() => { SET.theme = cycle(Object.keys(THEMES), SET.theme); }, () => `화면 색 ${THEMES[SET.theme]}`) },
    { n:3, t:`읽어 주기: ${VOICES[SET.voice]}`, s:'화면 낭독기를 쓰지 않는다면 기기 음성으로 바꾸세요. 화면 낭독기와 기기 음성을 함께 켜면 두 번 읽습니다.',
      act: ch(() => { SET.voice = cycle(Object.keys(VOICES), SET.voice); }, () => `읽어 주기 ${VOICES[SET.voice]}`) },
    { n:4, t:`판정 과정 보기: ${onOff(SET.dice)}`, s:'주사위와 확률을 기록에 함께 보여 줍니다. 테이블 게임처럼 판정을 확인할 수 있습니다.',
      act: ch(() => { SET.dice = !SET.dice; }, () => `판정 과정 보기 ${onOff(SET.dice)}`) },
    { n:5, t:`코스 번호 배열: ${SET.pad === 'pc' ? '컴퓨터 숫자판식 (7 8 9가 위)' : '전화기식 (1 2 3이 위)'}`, s:'코스를 고를 때 숫자와 스트라이크 존 칸을 맞추는 방법입니다. 쓰는 키보드의 숫자 배열에 맞추세요.',
      act: ch(() => { SET.pad = SET.pad === 'pc' ? 'phone' : 'pc'; }, () => `코스 번호 ${SET.pad === 'pc' ? '7 8 9가 높은 공' : '1 2 3이 높은 공'}`) },
    { n:6, t:`효과음: ${onOff(SET.snd)}`, act: ch(() => { SET.snd = !SET.snd; }, () => `효과음 ${onOff(SET.snd)}`) },
    { n:7, t:`진동: ${onOff(SET.vib)}`, s:'안드로이드 휴대폰에서 안타, 홈런, 삼진, 득점 때 진동합니다.', act: ch(() => { SET.vib = !SET.vib; }, () => `진동 ${onOff(SET.vib)}`) },
    { n:8, t:'더 보기', s:'명령 칸, 자동 재생, 음성 빠르기, 전체화면, 설치, 시험, 저장 지우기', act: v => go(() => settings2(backTo), v) },
  ] };
}
function settings2(backTo){
  const ch = (fn, label) => () => { fn(); saveSet(); stay(label()); };
  return { q:'설정 더 보기', back: v => go(() => settingsScreen(backTo), v), opts:[
    { n:1, t:`명령 칸 숫자 바로 고르기: ${onOff(SET.quick)}`, s:'켜면 명령 칸에 숫자 하나만 적어도 바로 고릅니다. 끄면 입력 키를 눌러야 고릅니다.',
      act: ch(() => { SET.quick = !SET.quick; }, () => `숫자 바로 고르기 ${onOff(SET.quick)}`) },
    { n:2, t:`관전 자동 재생 간격: ${SET.watch}초`, act: ch(() => { SET.watch = cycle([2, 4, 6, 8, 12], SET.watch); }, () => `자동 재생 ${SET.watch}초`) },
    { n:3, t:`기기 음성 빠르기: ${SET.rate}배`, s:'읽어 주기가 기기 음성일 때만 씁니다.', act: ch(() => { SET.rate = cycle([0.8, 1, 1.2, 1.5, 2], SET.rate); }, () => `음성 빠르기 ${SET.rate}배`) },
    { n:4, t: FS.on() ? '전체화면 끄기' : '전체화면 켜기', hide: isStandalone(), s: FS.supported() ? '' : '이 기기에서는 홈 화면에 설치하면 넓게 쓸 수 있습니다.', act: () => FS.toggle() },
    { n:5, t:`자동 전체화면: ${onOff(SET.autoFS)}`, hide: isStandalone(), s:'켜면 화면을 처음 누를 때 전체화면으로 바뀝니다.', act: ch(() => { SET.autoFS = !SET.autoFS; FS.userExit = false; }, () => `자동 전체화면 ${onOff(SET.autoFS)}`) },
    { n:6, t:'홈 화면에 설치하기', hide: !canInstall(), act: () => doInstall() },
    { n:7, t:'소리 시험', s:'읽어 주기, 효과음, 진동을 시험합니다.', act: v => { playFx(['bat', 'hit']); speak('소리 시험입니다. 딱! 잘 맞은 타구, 안타!'); if(v === 'click' && SET.voice === 'sr') note(['소리 시험입니다. 딱! 잘 맞은 타구, 안타!'], v); } },
    { n:9, t:`받은 채팅 읽어 주기: ${onOff(SET.chatRead)}`, s:'온라인 대전에서 상대가 보낸 채팅을 바로 읽어 줍니다. 채팅 목록은 늘 화면에 남습니다.',
      act: ch(() => { SET.chatRead = !SET.chatRead; }, () => `채팅 읽어 주기 ${onOff(SET.chatRead)}`) },
    { n:8, t:'저장된 경기 지우기', hide: !loadSaved(), act: () => openDlg('저장된 경기 지우기', ['이어 하던 경기를 지울까요? 되돌릴 수 없습니다.'], [
      { label:'지우기', act: () => { ls.del('bb_game'); stay('저장된 경기를 지웠습니다.'); } }, { label:'그만두기' }]) },
  ] };
}

/* ---------- 도움말 ---------- */
const HELP = {
  '게임 방법': [
    '손잡다 야구는 말과 글로 진행하는 확률 야구입니다. 화면을 보지 않고 듣거나 점자로 읽으며 할 수 있습니다.',
    '혼자 하기는 컴퓨터 팀과, 둘이 하기는 한 기기를 번갈아 쓰며 대결합니다. 컴퓨터끼리 관전도 할 수 있습니다.',
    '수비할 때는 투수가 되어 공을 고르고, 공격할 때는 타자가 되어 어떻게 칠지 고릅니다. 상대가 무엇을 골랐는지는 결과가 나와야 압니다.',
    '간단 모드는 타석마다 한 번만 고르고, 1부터 100까지의 주사위로 결과를 정합니다. 선택지마다 안타, 홈런, 삼진 확률이 함께 나옵니다.',
    '정밀 모드는 공 하나마다 구종, 코스, 붙이는 정도, 세기를 고릅니다. 선수 능력치와 컨디션, 바람, 수비 위치가 결과에 영향을 줍니다.',
    '1, 3, 5, 7, 9이닝 가운데 고르고, 동점이면 연장전을 최대 3이닝 더 합니다.',
    '경기는 공 하나마다 이 기기에 저장됩니다. 그만두었다가 처음 화면의 이어하기로 다시 할 수 있습니다.',
    '고르기 귀찮을 때는 맡기기를 쓰세요. 이번 공, 이번 타석, 이번 이닝을 컴퓨터가 대신 고릅니다.',
  ],
  '키 안내': [
    ...KEY_HELP,
    '코스를 고를 때는 숫자 1부터 9가 스트라이크 존 아홉 칸입니다.',
    '전화기식 배열(처음 설정)에서는 1, 2, 3이 높은 공, 4, 5, 6이 가운데 높이, 7, 8, 9가 낮은 공입니다. 각 줄은 몸쪽, 가운데, 바깥쪽 순서입니다. 5번은 한가운데입니다.',
    '설정에서 컴퓨터 숫자판식(7, 8, 9가 높은 공)으로 바꿀 수 있습니다.',
  ],
  '투수가 되었을 때': [
    '정밀 모드에서는 네 번 고르면 공 하나를 던집니다. 지난 공 그대로(5번)나 포수 사인대로(6번)를 고르면 한 번에 던집니다.',
    '첫째, 구종. 투수마다 던질 수 있는 공이 3가지에서 4가지입니다. 직구는 빠르고, 슬라이더와 포크는 헛스윙을 잘 이끌고, 투심과 포크는 땅볼을 잘 이끌어 냅니다. 커브와 체인지업은 느려서, 빠른 공 다음에 던지면 타이밍을 빼앗습니다.',
    '둘째, 코스. 스트라이크 존 아홉 칸 가운데 고릅니다. 몸쪽은 타자 쪽, 바깥쪽은 타자에게서 먼 쪽입니다.',
    '셋째, 붙이는 정도. 존 안쪽으로 던지면 스트라이크가 되기 쉽지만 맞기도 쉽습니다. 구석에 걸치면 치기 어렵지만 볼이 될 수 있습니다. 존 밖으로 빼면 유인구가 되어, 타자가 속으면 헛스윙이고 참으면 볼입니다.',
    '넷째, 세기. 전력 투구는 구속과 구위가 오르지만 제구가 흔들리고 체력이 빨리 떨어집니다. 힘 빼고 던지면 제구가 좋아지지만 공이 가벼워집니다.',
    '제구 능력이 낮거나 지친 투수는 겨냥한 곳에서 벗어나기 쉽습니다. 가운데로 몰리면 실투가 됩니다.',
    '수비 위치(7번). 내야 전진 수비는 3루 주자의 득점을 막지만 땅볼이 잘 빠져나가고, 후진 수비는 병살에 강합니다. 외야 전진 수비는 짧은 안타를 막지만 큰 타구에 약하고, 후진 수비는 그 반대입니다.',
    '작전(8번). 고의 볼넷과 투수 교체를 할 수 있습니다. 투구 수가 늘면 투수가 지칩니다.',
  ],
  '타자가 되었을 때': [
    '치기: 스트라이크는 치고, 볼은 선구안으로 골라냅니다. 볼에 속아 방망이가 나갈 수도 있습니다.',
    '강하게 치기: 맞으면 멀리 가지만 헛스윙이 늘고 볼에 잘 속습니다.',
    '맞히기: 공을 더 잘 보고 잘 맞히지만 타구 힘은 약합니다. 2스트라이크에서 쓰기 좋습니다.',
    '지켜보기: 치지 않습니다. 한가운데로 와도 그냥 보내면 스트라이크입니다. 투수가 볼을 던질 것 같을 때 씁니다.',
    '번트: 주자가 있으면 희생 번트, 없으면 기습 번트입니다.',
    '도루: 주자가 다음 베이스로 뜁니다. 주자의 스피드와 포수의 어깨에 따라 성공 확률이 달라집니다.',
    '노림수: 직구 계열이나 변화구를 노립니다. 맞으면 더 잘 맞히고, 틀리면 맞히기 어렵습니다.',
  ],
  '결과를 바꾸는 것들': [
    '타자 능력치: 컨택(맞히는 힘), 파워(멀리 보내는 힘), 선구안(볼을 골라내는 눈), 스피드(달리기), 수비.',
    '투수 능력치: 최고 구속, 제구, 구위, 체력, 그리고 구종마다의 완성도.',
    '능력치는 경기를 시작할 때마다 새로 정해집니다. 내 팀은 숫자로, 상대 팀은 아주 좋음, 좋음, 보통, 약함 같은 등급으로 보입니다.',
    '컨디션: 경기마다 선수마다 아주 나쁨부터 아주 좋음까지 정해집니다. 상대 선수의 컨디션은 첫 타석의 해설로 짐작할 수 있습니다.',
    '팀 스타일: 장타형, 교타형, 기동력형, 투수력형, 수비형, 균형형. 능력치와 컴퓨터의 작전이 달라집니다.',
    '바람: 외야 쪽으로 부는 바람은 타구를 멀리 보내고, 홈 쪽으로 부는 바람은 막습니다. 바람 덕에 간신히 넘어가는 홈런도, 맞바람에 막혀 담장 앞에서 잡히는 타구도 나옵니다. 담장은 좌우 98미터, 가운데 120미터입니다.',
    '타이밍: 같은 공을 계속 던지면 타자가 익숙해지고, 빠른 공 다음의 느린 공은 타이밍을 빼앗습니다.',
    '판정 과정 보기를 설정에서 켜면 주사위와 확률이 기록에 함께 나옵니다.',
  ],
  '화면 낭독기, 점자, 키보드': [
    '보이스오버, 톡백: 선택지를 두 번 탭하면 결과 글로 초점이 옮겨 가서 바로 읽습니다. 오른쪽으로 쓸어 넘기면 질문과 선택지가 이어집니다.',
    '한소네 같은 점자 단말기: 명령 칸에 숫자를 적으면 바로 고릅니다. 결과는 알림으로 잠깐 나오고, 아래 중계 기록에 한 줄씩 남습니다. 설정에서 입력 키를 눌러야 고르게 바꿀 수 있습니다.',
    '리보 키보드 같은 블루투스 키보드: 숫자판으로 바로 고릅니다. 보이스오버를 쓴다면 빠른 탐색을 끄면 숫자 키가 게임으로 바로 갑니다. 켜져 있으면 명령 칸에 적어 주세요.',
    '키: 0 지금 상황, 더하기 점수판, 빼기 타자와 투수 정보, 나누기 최근 기록, 점 뒤로, 곱하기 키 안내.',
    '화면이 보이는 분은 설정에서 글자 크기와 화면 색(어두운 화면, 밝은 화면, 노랑 바탕)을 바꿀 수 있습니다. 화면 낭독기를 쓰지 않는다면 읽어 주기를 기기 음성으로 바꾸세요.',
    '안드로이드 휴대폰은 안타, 홈런, 삼진, 득점 때 진동으로도 알려 줍니다.',
  ],
  '온라인 대전, 채팅, 음성': [
    '한 사람이 방을 만들고 방 코드 네 자리나 초대 링크를 상대에게 알려 줍니다. 상대는 방 코드로 들어가기에서 숫자 네 자리를 누릅니다. 초대 링크를 받았다면 링크를 열고 이름만 적으면 됩니다.',
    '두 사람이 각자 자기 팀만 고릅니다. 상대가 무엇을 골랐는지는 결과가 나와야 압니다. 내가 먼저 고르면 상대를 기다리는 화면이 나옵니다.',
    '채팅: 명령 칸에 글을 적고 입력하면 상대에게 보냅니다(선택지 이름과 똑같은 글은 그 선택지를 고릅니다). 받은 채팅은 바로 읽어 주고, 화면 아래 채팅 목록에 남습니다. 빠른 문구도 있습니다.',
    '음성 대화: 채팅과 음성 대화 화면에서 켭니다. 두 사람이 모두 켜면 연결됩니다. 목소리는 기기끼리 직접 오가서 서버 한도를 쓰지 않습니다.',
    '통화 방식은 마이크가 계속 켜져 있고, 위쪽의 마이크 끄기 단추로 잠시 끌 수 있습니다. 무전기 방식은 위쪽 말하기 단추를 누르고 있는 동안 말합니다. 화면 낭독기에서는 두 번 탭으로 말하기를 켜고, 다시 두 번 탭해서 끕니다. 말을 시작하면 삑 소리가 납니다.',
    '음성이 연결되지 않으면(일부 휴대폰 데이터망) 와이파이로 바꾸거나 채팅을 써 주세요.',
    '연결이 끊기면 같은 기기에서 다시 열고 온라인 대전의 방 다시 들어가기를 누르면 이어 합니다. 경기는 방장 기기가 계산하므로, 방장이 나가면 경기가 멈춥니다.',
  ],
  '앞으로 만들 것': [
    '3단계, 감독 모드: 공 하나하나는 선수가 알아서 하고, 감독은 타순, 선발 투수, 대타, 투수 교체, 작전만 지시합니다.',
    '그다음: 우리 센터 이름으로 팀과 선수 만들기, 시즌 기록, 히트 앤드 런과 견제구 같은 작전, 관중 소리.',
  ],
};
function helpScreen(backTo){
  const keys = Object.keys(HELP);
  return { q:'무엇이 궁금하세요? 고르면 위에 설명이 나옵니다.', back: v => backTo(v),
    opts: keys.map((k, i) => ({ n: i + 1, t: k, act: v => go(() => helpScreen(backTo), v, HELP[k]) })) };
}

/* ---------- 시작 ---------- */
applySet();
bindCmd();
voiceUI();
// 초대 링크(?room=1234)로 열면 바로 그 방에 들어감
(function(){
  const room = new URLSearchParams(location.search).get('room');
  if(room && /^[0-9]{4}$/.test(room)) go(() => nameScreen(() => startJoin(room, 'click')), 'init', [`방 ${spaced(room)}에 초대받았습니다.`]);
  else go(homeScreen, 'init');
})();
