'use strict';
/* ===================== 처음 화면 · 경기 준비 · 설정 · 도움말 ===================== */

/* ---------- 처음 화면 ---------- */
function homeScreen(){
  const sv = loadSaved();
  return { top: installBanner(), q:'무엇을 할까요?',
    note:['공 하나하나를 고르며 진행하는 확률 야구입니다.', '번호 키, 화면 단추, 명령 칸 가운데 편한 방법으로 고릅니다.', '0은 지금 상황, 점(.)은 뒤로, 곱하기(*)는 키 안내입니다. 게임 방법은 8번 설정에 있습니다.'],
    opts:[
      { n:1, t:'혼자 하기', s:'컴퓨터 팀과 대결합니다.', act: v => { NEW.kind = '1p'; go(modeScreen, v); } },
      { n:2, t:'둘이 하기', s:'한 기기를 번갈아 쓰며 대결합니다.', act: v => { NEW.kind = '2p'; go(modeScreen, v); } },
      { n:3, t:'온라인 대전', s:'각자 휴대폰으로 만나 대결하고, 채팅과 음성 대화를 합니다.', act: v => go(onlineHome, v) },
      { n:4, t:'리그', s: peekL('league') ? `${teamInfo(peekL('league').my).name}, ${peekL('league').season}시즌` : '10개 팀 정규 시즌과 포스트시즌, 기록과 시상식', act: v => go(leagueHome, v) },
      { n:5, t:'선수 육성', s: (() => { const L = peekL('career'); return L && L.career && !L.career.retired ? `${(L.career.p || findPlayer(L, L.career.id)?.p || {}).name}, ${L.season}시즌` : '내 선수 한 명을 키워 명예의 전당까지'; })(), act: v => go(careerHome, v) },
      { n:6, t:'컴퓨터끼리 관전', s:'컴퓨터 두 팀의 경기를 듣습니다.', act: v => { NEW.kind = 'watch'; go(modeScreen, v); } },
      { n:7, t:'이어하기', hide: !sv, s: sv ? `${MODE_NAME[sv.G.mode]}, ${sv.G.pre ? '경기 전 준비 중' : situation(sv.G)}` : '', act: v => resumeGame(v) },
      { n:8, t:'설정과 게임 방법', s:'화면 방식, 글자 크기, 화면 색, 읽어 주기, 효과음, 관중 소리, 게임 방법과 키 안내', act: v => go(() => settingsScreen(() => go(homeScreen, 'click')), v) },
      { n:9, t:'홈 화면에 설치하기', hide: !canInstall(), s:'아이콘으로 바로 열고 화면을 넓게 씁니다.', act: () => doInstall() },
    ] };
}

/* ---------- 경기 준비 ---------- */
const MODE_NAME = { simple:'간단 모드', detail:'정밀 모드', manager:'감독 모드' };
const NEW = { kind:'1p', mode:'simple', unit:'pitch', a:null, b:null, first:1, innings:3, diff:1 };
const teamLabel = k => { const t = teamInfo(k); return `${t.name} (${STYLES[t.style].name})`; };
function modeScreen(){
  return { q: NEW.kind === 'league' ? '내 팀 경기를 어떤 방식으로 할까요? 나중에 리그 설정에서 바꿀 수 있습니다.' : '어떤 방식으로 할까요?', back: v => go(NEW.kind === 'online' ? onlineHome : NEW.kind === 'league' ? leagueHome : homeScreen, v), opts:[
    { n:1, t:'간단 모드', s:'주사위로 결과를 정하는 쉬운 야구입니다. 처음 해 보는 분께 알맞습니다.', act: v => { NEW.mode = 'simple'; go(unitScreen, v); } },
    { n:2, t:'정밀 모드', s:'공 하나마다 구종, 코스, 세기를 고릅니다. 선수 능력치, 컨디션, 바람, 수비 위치가 결과를 바꿉니다.', act: v => { NEW.mode = 'detail'; go(() => teamScreen(0), v); } },
    { n:3, t:'감독 모드', s:'선수들이 알아서 던지고 치고, 감독은 타순, 선발 투수, 작전, 대타, 투수 교체만 지시합니다. 중요한 순간에만 묻습니다.', act: v => { NEW.mode = 'manager'; go(() => teamScreen(0), v); } },
  ] };
}
function unitScreen(){
  const set = (u, v) => { NEW.unit = u; go(() => teamScreen(0), v); };
  return { q:'간단 모드를 어떻게 진행할까요?', back: v => go(modeScreen, v), opts:[
    { n:1, t:'공 하나씩', s:'한 번 고를 때마다 공 하나를 던지고 칩니다. 볼카운트가 쌓이고, 볼넷과 삼진도 공 하나하나로 정해집니다.', act: v => set('pitch', v) },
    { n:2, t:'타석 한 번에', s:'타석마다 한 번만 고르면 결과가 바로 나옵니다. 빠르게 진행됩니다.', act: v => set('pa', v) },
  ] };
}
function teamScreen(which, page = 0){
  const q = NEW.kind === '1p' || NEW.kind === 'online' || NEW.kind === 'league' || NEW.kind === 'career' ? (which ? '상대 팀을 고르세요.' : '내 팀을 고르세요.')
          : NEW.kind === '2p' ? (which ? '둘째 사람의 팀을 고르세요.' : '첫째 사람의 팀을 고르세요.')
          : (which ? '홈 팀을 고르세요.' : '원정 팀을 고르세요.');
  const taken = which ? NEW.a : null;
  const list = TEAMS.filter(t => t.key !== taken);
  const set = (k, v) => {
    if(which){ NEW.b = k; go(NEW.kind === 'watch' ? inningsScreen : sideScreen, v); }
    else { NEW.a = k; go(NEW.kind === 'league' ? leagueLenScreen : NEW.kind === 'career' ? careerLenScreen : () => teamScreen(1), v); }
  };
  // 10팀이라 한 쪽에 8팀씩: 9번은 다음 쪽 / 앞 쪽
  const desc = t => `${STYLES[t.style].name}. 홈구장 ${parkInfo(t.key).name}: ${parkInfo(t.key).desc}`;
  const shown = page ? list.slice(8) : list.slice(0, 8);
  const opts = shown.map((t, i) => ({ n: i + 1, t: t.name, s: desc(t), act: v => set(t.key, v) }));
  if(page) opts.push({ n: shown.length + 1, t:'아무 팀이나', s:'무작위로 고릅니다.', act: v => set(list[Math.floor(Math.random() * list.length)].key, v) });
  opts.push(page ? { n:9, t:'앞 쪽 팀 보기', act: v => go(() => teamScreen(which, 0), v) }
                 : { n:9, t:'다른 팀 더 보기', s: list.slice(8).map(t => t.name).join(', ') + ', 아무 팀이나', act: v => go(() => teamScreen(which, 1), v) });
  return { q: q + (page ? ' (두 번째 쪽)' : ''), opts, back: v => go(page ? () => teamScreen(which, 0) : which ? () => teamScreen(0) : NEW.kind === 'career' ? careerTypeScreen : NEW.mode === 'simple' ? unitScreen : modeScreen, v) };
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
  return { mode: NEW.mode, unit: NEW.unit, innings: NEW.innings, teams, ctrl, who, diff: NEW.diff, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0 };
}
function readyScreen(){
  const o = newOpts();
  const role = ti => NEW.kind === '1p' ? (o.ctrl[ti] === 'human' ? '내 팀' : '컴퓨터') : NEW.kind === '2p' ? o.who[ti] : '컴퓨터';
  const say = [
    `${MODE_NAME[NEW.mode]}${NEW.mode === 'simple' ? (NEW.unit === 'pitch' ? '(공 하나씩)' : '(타석 한 번에)') : ''}, ${NEW.innings}이닝 경기입니다.`,
    `원정(먼저 공격): ${teamLabel(o.teams[0])}, ${role(0)}.`,
    `홈(나중에 공격): ${teamLabel(o.teams[1])}, ${role(1)}.`,
    `경기장: ${parkInfo(o.teams[1]).name}. ${parkInfo(o.teams[1]).desc}`,
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
const sndName = () => !SET.snd ? '끔' : SET.sndKind === 'synth' ? '간단한 소리' : '야구장 소리';
function cycle(list, cur){ const i = list.indexOf(cur); return list[(i + 1) % list.length]; }
const VIEWS = { gfx:'화면 보며 하기 (비장애인 모드)', a11y:'소리와 글로 하기 (시각장애인 모드)' };
// 화면 방식을 정하면 그에 맞는 기본값도 함께 바꿈 (나중에 설정에서 하나씩 다시 바꿀 수 있음)
function setView(v){
  SET.view = v;
  if(v === 'gfx'){ SET.voice = 'off'; SET.crowd = true; }
  else { SET.voice = 'sr'; SET.crowd = false; }
  saveSet(); if(typeof crowdSync === 'function') crowdSync();
  if(v === 'gfx' && typeof gfxLoad === 'function') gfxLoad();
}
function viewScreen(after){
  return { top: SET.view ? '' : installBanner(), q:'어떤 방식으로 하실지 골라 주세요. 나중에 설정에서 바꿀 수 있습니다.', back: SET.view ? v => after(v) : null, opts:[
    { n:1, t: VIEWS.gfx, s:'귀여운 도트 그림으로 투구와 타구를 보여 주고, 효과음과 관중 소리를 냅니다. 글을 읽어 주지는 않습니다.', act: v => { setView('gfx'); after(v); } },
    { n:2, t: VIEWS.a11y, s:'보이스오버·톡백, 점자 단말기, 숫자판 키보드로 합니다. 모든 상황을 말과 글로 알려 줍니다.', act: v => { setView('a11y'); after(v); } },
  ] };
}
function settingsScreen(backTo){
  const ch = (fn, label) => () => { fn(); saveSet(); stay(label()); };
  return { q:'설정입니다. 고를 때마다 값이 바뀝니다.', back: v => backTo(v), opts:[
    { n:1, t:`화면 방식: ${VIEWS[SET.view] || VIEWS.a11y}`, s:'고르면 화면 방식 고르기로 갑니다. 읽어 주기와 관중 소리도 그 방식에 맞게 바뀝니다.', act: v => go(() => viewScreen(w => go(() => settingsScreen(backTo), w)), v) },
    { n:2, t:`글자 크기: ${FS_NAMES[SET.fs]}`, act: ch(() => { SET.fs = (SET.fs + 1) % FS_NAMES.length; }, () => `글자 크기 ${FS_NAMES[SET.fs]}`) },
    { n:3, t:`화면 색: ${THEMES[SET.theme]}`, act: ch(() => { SET.theme = cycle(Object.keys(THEMES), SET.theme); }, () => `화면 색 ${THEMES[SET.theme]}`) },
    { n:4, t:`읽어 주기: ${VOICES[SET.voice]}`, s:'화면 낭독기를 쓰지 않는다면 기기 음성으로 바꾸세요. 화면 낭독기와 기기 음성을 함께 켜면 두 번 읽습니다.',
      act: ch(() => { SET.voice = cycle(Object.keys(VOICES), SET.voice); }, () => `읽어 주기 ${VOICES[SET.voice]}`) },
    { n:5, t:`판정 과정 보기: ${onOff(SET.dice)}`, s:'주사위와 확률을 기록에 함께 보여 줍니다. 테이블 게임처럼 판정을 확인할 수 있습니다.',
      act: ch(() => { SET.dice = !SET.dice; }, () => `판정 과정 보기 ${onOff(SET.dice)}`) },
    { n:6, t:`코스 번호 배열: ${SET.pad === 'pc' ? '컴퓨터 숫자판식 (7 8 9가 위)' : '전화기식 (1 2 3이 위)'}`, s:'코스를 고를 때 숫자와 스트라이크 존 칸을 맞추는 방법입니다. 쓰는 키보드의 숫자 배열에 맞추세요.',
      act: ch(() => { SET.pad = SET.pad === 'pc' ? 'phone' : 'pc'; }, () => `코스 번호 ${SET.pad === 'pc' ? '7 8 9가 높은 공' : '1 2 3이 높은 공'}`) },
    { n:7, t:`효과음: ${sndName()}`, s:'야구장 소리(피칭, 타격, 스트라이크, 안타, 홈런, 공수교대 등) · 간단한 소리 · 끄기 순서로 바뀝니다.',
      act: ch(() => { if(!SET.snd){ SET.snd = true; SET.sndKind = 'rec'; } else if(SET.sndKind !== 'synth') SET.sndKind = 'synth'; else SET.snd = false; crowdSync(); }, () => `효과음 ${sndName()}`) },
    { n:8, t:'더 보기', s:'진동, 관중 소리, 명령 칸, 자동 재생, 음성 빠르기, 전체화면, 설치, 시험, 저장 지우기', act: v => go(() => settings2(backTo), v) },
    { n:9, t:'게임 방법과 키 안내', act: v => go(() => helpScreen(() => go(() => settingsScreen(backTo), 'click')), v) },
  ] };
}
function settings2(backTo){
  const ch = (fn, label) => () => { fn(); saveSet(); stay(label()); };
  return { q:'설정 더 보기', back: v => go(() => settingsScreen(backTo), v), opts:[
    { n:1, t:`진동: ${onOff(SET.vib)}`, s:'안드로이드 휴대폰에서 안타, 홈런, 삼진, 득점 때 진동합니다.', act: ch(() => { SET.vib = !SET.vib; }, () => `진동 ${onOff(SET.vib)}`) },
    { n:2, t:`관중 소리: ${onOff(SET.crowd)}`, s:'화면 보며 하기에서 경기 내내 야구장 관중 소리를 작게 깔아 줍니다. 효과음이 꺼져 있으면 나지 않습니다.',
      act: ch(() => { SET.crowd = !SET.crowd; crowdSync(); }, () => `관중 소리 ${onOff(SET.crowd)}`) },
    { n:3, t:`명령 칸 숫자 바로 고르기: ${onOff(SET.quick)}`, s:'켜면 명령 칸에 숫자 하나만 적어도 바로 고릅니다. 끄면 입력 키를 눌러야 고릅니다.',
      act: ch(() => { SET.quick = !SET.quick; }, () => `숫자 바로 고르기 ${onOff(SET.quick)}`) },
    { n:4, t:`관전 자동 재생 간격: ${SET.watch}초`, act: ch(() => { SET.watch = cycle([2, 4, 6, 8, 12], SET.watch); }, () => `자동 재생 ${SET.watch}초`) },
    { n:5, t:`기기 음성 빠르기: ${SET.rate}배`, s:'읽어 주기가 기기 음성일 때만 씁니다.', act: ch(() => { SET.rate = cycle([0.8, 1, 1.2, 1.5, 2], SET.rate); }, () => `음성 빠르기 ${SET.rate}배`) },
    { n:6, t: FS.on() ? '전체화면 끄기' : '전체화면 켜기', hide: isStandalone(), s: FS.supported() ? '' : '이 기기에서는 홈 화면에 설치하면 넓게 쓸 수 있습니다.', act: () => FS.toggle() },
    { n:7, t:`자동 전체화면: ${onOff(SET.autoFS)}`, hide: isStandalone(), s:'켜면 화면을 처음 누를 때 전체화면으로 바뀝니다.', act: ch(() => { SET.autoFS = !SET.autoFS; FS.userExit = false; }, () => `자동 전체화면 ${onOff(SET.autoFS)}`) },
    { n:8, t:'더 보기', s:'소리 시험, 채팅 읽어 주기, 저장된 경기 지우기', act: v => go(() => settings3(backTo), v) },
    { n:9, t:'홈 화면에 설치하기', hide: !canInstall(), act: () => doInstall() },
  ] };
}
function settings3(backTo){
  const ch = (fn, label) => () => { fn(); saveSet(); stay(label()); };
  return { q:'설정 더 보기 (마지막)', back: v => go(() => settings2(backTo), v), opts:[
    { n:1, t:'소리 시험', s:'읽어 주기, 효과음, 진동을 시험합니다.', act: v => { playFx(['pitch', 'bat', 'hit']); speak('소리 시험입니다. 딱! 잘 맞은 타구, 안타!'); if(v === 'click' && SET.voice === 'sr') note(['소리 시험입니다. 딱! 잘 맞은 타구, 안타!'], v); } },
    { n:2, t:`받은 채팅 읽어 주기: ${onOff(SET.chatRead)}`, s:'온라인 대전에서 상대가 보낸 채팅을 바로 읽어 줍니다. 채팅 목록은 늘 화면에 남습니다.',
      act: ch(() => { SET.chatRead = !SET.chatRead; }, () => `채팅 읽어 주기 ${onOff(SET.chatRead)}`) },
    { n:3, t:'저장된 경기 지우기', hide: !loadSaved(), act: () => openDlg('저장된 경기 지우기', ['이어 하던 경기를 지울까요? 되돌릴 수 없습니다.'], [
      { label:'지우기', act: () => { ls.del('bb_game'); stay('저장된 경기를 지웠습니다.'); } }, { label:'그만두기' }]) },
  ] };
}

/* ---------- 도움말 ---------- */
const HELP = {
  '게임 방법': [
    '손잡다 야구는 말과 글로 진행하는 확률 야구입니다. 화면을 보지 않고 듣거나 점자로 읽으며 할 수 있습니다.',
    '혼자 하기는 컴퓨터 팀과, 둘이 하기는 한 기기를 번갈아 쓰며 대결합니다. 컴퓨터끼리 관전도 할 수 있습니다.',
    '수비할 때는 투수가 되어 공을 고르고, 공격할 때는 타자가 되어 어떻게 칠지 고릅니다. 상대가 무엇을 골랐는지는 결과가 나와야 압니다.',
    '간단 모드는 1부터 100까지의 주사위로 결과를 정합니다. 공 하나씩 방식은 한 번 고를 때마다 공 하나를 던지고 치며(스트라이크로 승부·유인구 / 강하게·보통·맞히기·지켜보기), 볼카운트가 쌓입니다. 타석 한 번에 방식은 타석마다 한 번만 고르면 결과가 바로 나옵니다. 선택지마다 확률이 함께 나옵니다.',
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
    '작전(8번). 견제, 고의 볼넷, 투수 교체를 할 수 있습니다. 견제는 공 하나를 쓰지 않고, 주자가 여럿이면 누구를 견제할지 고릅니다. 가끔 주자를 잡거나, 드물게 악송구로 주자가 나아갑니다. 견제를 받은 주자는 도루하기 어려워집니다. 투구 수가 늘면 투수가 지칩니다.',
  ],
  '타자가 되었을 때': [
    '치기: 스트라이크는 치고, 볼은 선구안으로 골라냅니다. 볼에 속아 방망이가 나갈 수도 있습니다.',
    '강하게 치기: 맞으면 멀리 가지만 헛스윙이 늘고 볼에 잘 속습니다.',
    '맞히기: 공을 더 잘 보고 잘 맞히지만 타구 힘은 약합니다. 2스트라이크에서 쓰기 좋습니다.',
    '지켜보기: 치지 않습니다. 한가운데로 와도 그냥 보내면 스트라이크입니다. 투수가 볼을 던질 것 같을 때 씁니다.',
    '번트: 주자가 있으면 희생 번트, 없으면 기습 번트입니다.',
    '도루: 주자가 다음 베이스로 뜁니다. 주자의 스피드와 포수의 어깨에 따라 성공 확률이 달라집니다. 뛸 수 있는 주자가 여럿이면 누구를 뛰게 할지 고릅니다(1루 주자, 2루 주자, 더블 스틸, 3루 주자의 홈스틸). 견제를 받은 주자는 리드가 작아져 도루하기 어려워집니다.',
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
    '구장: 홈 팀 구장마다 담장 거리와 높이, 잔디, 파울 지역, 지붕, 바람이 다릅니다. 썬더볼츠 파크는 홈런이 잘 나오고, 블루웨일즈 스타디움은 넓어서 홈런이 적고 3루타가 많습니다. 메테오스 볼파크는 왼쪽 담장이 높고, 나이츠 돔은 바람이 없고, 윈디스 오름구장은 바람이 세고 자주 바뀝니다.',
    '비디오 판독: 도루, 1루 승부, 담장 끝 타구처럼 아슬아슬한 플레이가 나오면 원심에 손해를 본 팀이 판독을 신청할지 고릅니다. 팀마다 경기당 2번이고, 판정이 뒤집히면 기회가 줄지 않고 원심이 유지되면 1번 줄어듭니다. 코치가 알려 주는 확률로 주사위를 굴려 뒤집힐지 정합니다. 확률은 숫자로 듣거나 말로 들을 수 있습니다.',
  ],
  '화면 낭독기, 점자, 키보드': [
    '보이스오버, 톡백: 선택지를 두 번 탭하면 결과 글로 초점이 옮겨 가서 바로 읽습니다. 오른쪽으로 쓸어 넘기면 질문과 선택지가 이어집니다.',
    '한소네 같은 점자 단말기: 명령 칸에 숫자를 적으면 바로 고릅니다. 결과는 알림으로 잠깐 나오고, 아래 중계 기록에 한 줄씩 남습니다. 설정에서 입력 키를 눌러야 고르게 바꿀 수 있습니다.',
    '리보 키보드 같은 블루투스 키보드: 숫자판으로 바로 고릅니다. 보이스오버를 쓴다면 빠른 탐색을 끄면 숫자 키가 게임으로 바로 갑니다. 켜져 있으면 명령 칸에 적어 주세요.',
    '키: 0 지금 상황, 더하기 점수판, 빼기 타자와 투수 정보, 나누기 최근 기록, 점 뒤로, 곱하기 키 안내.',
    '화면이 보이는 분은 설정에서 글자 크기와 화면 색(어두운 화면, 밝은 화면, 노랑 바탕)을 바꿀 수 있습니다. 화면 낭독기를 쓰지 않는다면 읽어 주기를 기기 음성으로 바꾸세요.',
    '안드로이드 휴대폰은 안타, 홈런, 삼진, 득점 때 진동으로도 알려 줍니다.',
    '효과음은 야구장 소리(피칭, 스트라이크, 볼, 헛스윙, 파울, 안타, 2루타, 3루타, 홈런, 아웃, 삼진, 공수교대, 타석, 투수 교체)가 처음 설정입니다. 설정에서 간단한 소리나 끄기로 바꿀 수 있습니다.',
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
  '감독 모드': [
    '감독 모드에서는 선수들이 공 하나하나를 알아서 던지고 칩니다. 감독은 경기 전 준비와 작전만 맡습니다.',
    '경기 전: 타순을 바꾸거나 추천 타순을 쓰고, 벤치 선수를 넣고, 선발 투수를 고른 뒤 준비 완료를 누릅니다. 내 팀 선수는 능력치가 숫자로 보입니다.',
    '작전은 중요한 순간에만 묻습니다. 득점권에 주자가 있을 때, 무사 1루일 때, 경기 후반 접전일 때, 우리 투수가 지쳤거나 점수를 많이 줬을 때입니다. 그 사이의 타석은 선수들이 알아서 하고 결과만 모아서 읽어 줍니다. 더 보기에서 매 타석 묻기로 바꿀 수 있습니다.',
    '공격 작전: 타자에게 맡기기, 적극적으로 쳐라, 신중하게 골라라, 번트(희생 번트, 스퀴즈, 기습 번트), 도루, 히트 앤드 런, 대타, 대주자.',
    '히트 앤드 런은 1루 주자가 먼저 뛰고 타자가 꼭 맞히는 작전입니다. 땅볼이어도 병살이 되지 않고, 안타면 1루 주자가 3루까지 가기 쉽습니다. 대신 헛스윙하면 주자가 잡힐 수 있고, 직선타면 주자까지 함께 잡히기 쉽습니다.',
    '수비 작전: 투수에게 맡기기, 정면 승부(볼넷이 줄고 맞기 쉬움), 어렵게 승부(유인구로 장타를 피하고 볼넷이 늘어남), 고의 볼넷, 투수 교체, 수비 위치.',
    '대타와 대주자로 나간 선수 대신 들어간 선수는 그 자리의 수비도 맡습니다. 바뀌어 나간 선수는 이번 경기에 다시 나오지 못합니다.',
    '중계는 처음에 타석 결과만 읽습니다. 더 보기에서 공 하나하나 읽기로 바꿀 수 있습니다.',
    '컴퓨터 감독도 경기 후반 접전에서는 대타, 대주자, 투수 교체를 씁니다. 온라인 대전에서도 감독 모드로 대결할 수 있습니다.',
  ],
  '리그': [
    '처음 화면의 리그에서 새 리그를 만듭니다. 내 팀 경기 방식(감독, 정밀, 간단), 내 팀, 팀당 경기 수(18, 36, 72, 144), 이닝 수를 고릅니다.',
    '10개 팀이 일정대로 경기합니다. 내 팀 경기는 직접 하거나 결과만 보고 넘길 수 있고, 여러 날을 한꺼번에 넘길 수도 있습니다. 다른 팀 경기는 결과만 나옵니다.',
    '선수는 시즌 내내 같은 사람이고, 컨디션은 날마다 바뀝니다. 선발 투수 5명이 돌아가며 던지고, 불펜은 많이 던지거나 이틀 연속 던지면 하루 쉽니다.',
    '순위표에는 승, 패, 무, 승률, 게임 차, 최근 10경기, 연승과 연패가 나옵니다. 기록 순위는 타율, 홈런, 타점, 안타, 도루, 평균자책점, 승리, 세이브, 홀드, 탈삼진입니다. 타율은 3할 1푼 2리처럼 읽어 줍니다.',
    '정규 시즌이 끝나면 KBO처럼 5위까지 포스트시즌을 합니다. 와일드카드 결정전(4위가 1승을 안고 시작), 준플레이오프와 플레이오프(5전 3선승), 한국시리즈(7전 4선승).',
    '한국시리즈가 끝나면 우승 팀, 정규 시즌 MVP, 한국시리즈 MVP, 기록별 1위를 발표합니다.',
    '감독 모드로 경기 전 준비에서 바꾼 타순은 다음 경기에도 이어집니다. 리그는 이 기기에 저장되고, 리그 설정에서 백업 파일로 내려받거나 불러올 수 있습니다.',
    '시즌이 끝나면 다음 시즌을 시작합니다. 선수들은 한 살씩 나이를 먹고, 젊은 선수는 성장하고 서른이 넘으면 조금씩 떨어지며, 나이가 많으면 은퇴하고 신인이 들어옵니다. 신인왕도 뽑습니다.',
    '기록실: 역대 우승 팀, 통산 기록 순위(은퇴 선수 포함), 한 시즌 최고 기록, 명예의 전당, 최근 은퇴 선수, 대기록, 내 감독 기록을 봅니다.',
    '대기록: 사이클링 히트, 노히트 노런, 퍼펙트게임, 통산 100호 홈런이나 1000안타 같은 이정표, 시즌 신기록이 나오면 바로 알려 줍니다.',
    '명예의 전당: 5시즌 이상 뛰고 은퇴한 선수 가운데 통산 기록이 아주 좋거나 MVP를 두 번 이상 받은 선수가 헌액됩니다. 기준은 리그 길이에 맞춰 줄어듭니다.',
  ],
  '선수 육성': [
    '처음 화면의 선수 육성에서 내 선수를 만듭니다. 이름, 타자와 투수, 수비 위치(투수는 선발과 불펜), 선수 유형(교타자, 거포, 호타준족, 수비형 / 강속구, 제구형, 변화구형), 팀, 시즌 길이, 내 차례 방식(정밀, 간단)을 고릅니다.',
    '20살 신인으로 퓨처스리그(2군)에서 시작합니다. 날마다 경기 전에 한 번 훈련하거나 쉬고, 2군 경기를 합니다. 실력이 같은 자리 1군 선수만큼 되면 1군으로 올라갑니다.',
    '1군 경기에서는 내 선수의 타석(투수라면 내 선수가 던지는 동안)만 직접 고르고, 나머지는 빠르게 진행하며 점수가 난 장면과 이닝 소식만 읽어 줍니다. 선발 투수는 로테이션 차례인 날에 던지고, 불펜 투수는 감독이 부를 때 나갑니다.',
    '훈련과 경기 결과로 성장 점수가 쌓이고, 10점이 되면 능력치가 1 오릅니다. 젊을수록 빨리 오르고, 나이가 들면 천천히 오르다가 떨어집니다.',
    '첫 안타, 첫 홈런, 첫 승 같은 업적이 남고, 잘한 날에는 수훈 선수 인터뷰를 해서 인기가 오릅니다. 가끔 슬럼프나 부상도 생깁니다.',
    '시즌이 끝나면 다음 시즌을 이어 가고, 원할 때 은퇴합니다(마흔 살이면 은퇴). 은퇴하면 통산 기록으로 명예의 전당 심사를 합니다.',
  ],
  '화면 방식': [
    '처음 실행할 때 화면 방식을 고릅니다. 설정 1번에서 언제든 바꿀 수 있습니다.',
    '화면 보며 하기(비장애인 모드): 옛날 오락기처럼 도트 그림으로 투수가 던지고, 공이 구종에 따라 휘어 들어오고, 타자가 휘두르는 모습을 보여 줍니다. 공을 치면 위에서 본 야구장으로 바뀌어 타구와 야수가 움직입니다. 관중 소리가 깔리고, 글은 읽어 주지 않습니다.',
    '소리와 글로 하기(시각장애인 모드): 보이스오버·톡백, 점자 단말기, 숫자판 키보드로 합니다. 모든 상황을 말과 글로 알려 줍니다.',
    '효과음은 두 방식 모두 같습니다. 타격음과 헛스윙 소리는 세게 쳤는지, 맞히려 했는지, 잘 맞았는지에 따라 달라집니다.',
  ],
  '앞으로 만들 것': [
    '그다음: 우리 센터 이름으로 팀과 선수 만들기, 장내 아나운서, 올스타전과 홈런 더비.',
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
  else if(!SET.view) go(() => viewScreen(v => go(homeScreen, v)), 'init');
  else go(homeScreen, 'init');
})();
