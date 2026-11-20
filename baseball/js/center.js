'use strict';
/* ===================== 우리 센터 팀 만들기 =====================
   이용자 이름·별명으로 팀과 선수를 만들고 능력치를 직접 정함. 이 기기(localStorage 'bb_center')에 저장.
   만든 팀(key 'center')은 혼자·둘이 하기·관전의 팀 고르기에 나오고, 리그·선수 육성에서는 손잡다 핸즈 자리에 들어감.
   온라인 대전에서는 상대 기기에 이 팀 자료가 없어서 쓰지 않음.
   모든 화면은 "질문 + 번호 선택지"라 두 화면 방식에서 똑같이 고침. 글자는 명령 칸(화면 보며 하기는 입력 칸)에 적음 */
const CENTER_KEY = 'bb_center';
const CENTER_COLORS = [['분홍', '#ec4899'], ['빨강', '#ef4444'], ['주황', '#f97316'], ['노랑', '#facc15'], ['초록', '#22c55e'], ['청록', '#14b8a6'], ['하늘', '#38bdf8'], ['파랑', '#3b82f6'], ['보라', '#8b5cf6'], ['회색', '#94a3b8']];
const BAT_STATS = [['con', '컨택'], ['pow', '파워'], ['eye', '선구안'], ['spd', '스피드'], ['def', '수비']];
const PIT_STATS = [['vel', '구속'], ['ctl', '제구'], ['stf', '구위'], ['sta', '체력']];
const STAT_RANGE = k => k === 'vel' ? [125, 160] : [20, 99];
function centerLoad(){ const c = ls.get(CENTER_KEY, null); CENTER = c && c.bat && c.bat.length === 9 ? c : null; }
function centerSave(c){ CENTER = c; ls.set(CENTER_KEY, c); }
centerLoad();
// 새 팀 틀: 타순 9명(기본 수비 위치), 투수 5명(선발 1 · 마무리 1 · 불펜 3). 능력치는 모두 보통
function centerBlank(){
  return { name:'우리 센터 팀', short:'센터', color: CENTER_COLORS[0][1], emblem:null, style:'balance', park:'star',
    bat: LINEUP_POS.map((pos, i) => ({ name:`선수 ${i + 1}`, nick:'', pos, hand:'R', con:55, pow:55, eye:55, spd:55, def:55 })),
    pit: ['선발', '마무리', '불펜', '불펜', '불펜'].map((role, i) => ({ name:`투수 ${i + 1}`, nick:'', role, hand:'R', vel:142, ctl:55, stf:55, sta:55 })) };
}
// 고치는 동안 쓰는 사본 (저장을 눌러야 반영)
const CE = { c:null, back:null };
function centerEdit(back){ CE.c = JSON.parse(JSON.stringify(CENTER || centerBlank())); CE.back = back; return centerHomeScreen(); }
const ceSave = (v, msg) => { centerSave(CE.c); go(centerHomeScreen, v, [msg || '저장했습니다.']); };
const colorName = hex => (CENTER_COLORS.find(c => c[1] === hex) || ['색'])[0];
const nm = p => `${p.name}${p.nick ? `(${p.nick})` : ''}`;

function centerHomeScreen(){
  const c = CE.c;
  return { kind:'ct-home', q:'우리 센터 팀을 만듭니다. 고를 때마다 바뀌고, 다 되면 저장하기를 누르세요.', back: v => CE.back(v), opts:[
    { n:1, t:`팀 이름: ${c.name}`, s:'명령 칸에 새 이름을 적습니다. 예: 손잡다 센터 팀', act: v => go(() => textScreen('팀 이름', c.name, 14, t => { c.name = t; }, centerHomeScreen), v) },
    { n:2, t:`줄인 이름: ${c.short}`, s:'점수판과 중계에서 부르는 짧은 이름입니다. 예: 센터', act: v => go(() => textScreen('줄인 이름', c.short, 6, t => { c.short = t; }, centerHomeScreen), v) },
    { n:3, t:`팀 색: ${colorName(c.color)}`, s:'유니폼과 점수판 색입니다.', act: () => { const i = CENTER_COLORS.findIndex(x => x[1] === c.color); c.color = CENTER_COLORS[(i + 1) % CENTER_COLORS.length][1]; stay(`팀 색 ${colorName(c.color)}`); } },
    { n:4, t:`엠블럼: ${c.emblem == null ? '이름 첫 글자' : `${TEAMS[c.emblem].short} 그림`}`, hide: !VIEW.gfx, s:'화면 보며 하기에서 팀 표시로 쓰는 그림입니다.', act: () => { c.emblem = c.emblem == null ? 0 : c.emblem >= 9 ? null : c.emblem + 1; stay(`엠블럼 ${c.emblem == null ? '이름 첫 글자' : TEAMS[c.emblem].short + ' 그림'}`); } },
    { n:5, t:`팀 스타일: ${STYLES[c.style].name}`, s: STYLES[c.style].desc, act: () => { const k = Object.keys(STYLES); c.style = k[(k.indexOf(c.style) + 1) % k.length]; stay(`팀 스타일 ${STYLES[c.style].name}`); } },
    { n:6, t:`홈구장: ${parkInfo(c.park).name}`, s: parkInfo(c.park).desc, act: () => { const k = TEAMS.map(t => t.key); c.park = k[(k.indexOf(c.park) + 1) % k.length]; stay(`홈구장 ${parkInfo(c.park).name}`); } },
    { n:7, t:'타자 9명', s: c.bat.map(nm).join(', '), act: v => go(batListScreen, v) },
    { n:8, t:'투수 5명', s: c.pit.map(p => `${p.role} ${nm(p)}`).join(', '), act: v => go(pitListScreen, v) },
    { n:9, t:'저장하기', s: CENTER ? '바꾼 내용을 저장합니다.' : '저장하면 팀 고르기에 우리 팀이 나옵니다.', act: v => ceSave(v, `${c.name}을 저장했습니다. 팀 고르기에서 고를 수 있습니다.`) },
    { n:10, t:'우리 팀 지우기', hide: !CENTER, act: () => openDlg('우리 팀 지우기', ['만든 팀을 지울까요? 우리 팀으로 하던 리그와 선수 육성 기록은 남지만 팀 이름은 "우리 팀"으로 바뀝니다.'], [
      { label:'지우기', act: () => { ls.del(CENTER_KEY); CENTER = null; CE.c = centerBlank(); go(centerHomeScreen, 'click', ['우리 팀을 지웠습니다.']); } }, { label:'그만두기' }]) },
  ] };
}
// 글자 입력 (팀 이름, 선수 이름·별명)
function textScreen(what, cur, max, set, back){
  return { kind:'ct-text', q:`${what}을 명령 칸에 적고 입력을 누르세요. 지금: ${cur || '없음'}.`, focusCmd:true, back: v => go(back, v),
    onText: t => { t = t.trim().slice(0, max); set(t); go(back, 'click', [`${what}: ${t || '없음'}.`]); },
    opts:[{ n:1, t:'지우기 (비워 두기)', hide: what !== '별명', act: v => { set(''); go(back, v, [`${what}을 지웠습니다.`]); } }, { n:9, t:'그대로 두기', act: v => go(back, v) }] };
}
// 숫자 정하기: 단추로 더하고 빼거나, 숫자를 적음
function numScreen(label, k, obj, back){
  const [lo, hi] = STAT_RANGE(k), set = (x, v) => { obj[k] = clamp(Math.round(x), lo, hi); stay(`${label} ${obj[k]}`); };
  return { kind:'ct-num', stat:k, val: obj[k], lo, hi, q:`${label}을 정하세요. 지금 ${obj[k]}. ${lo}부터 ${hi}까지입니다. 숫자를 적어도 됩니다.`, back: v => go(back, v),
    onText: t => { const x = parseInt(t.replace(/\D/g, ''), 10); if(Number.isFinite(x)) set(x, 'key'); else speak('숫자를 적어 주세요.'); },
    opts:[
      { n:1, t:'10 올리기', act: v => set(obj[k] + 10, v) }, { n:2, t:'5 올리기', act: v => set(obj[k] + 5, v) }, { n:3, t:'1 올리기', act: v => set(obj[k] + 1, v) },
      { n:4, t:'1 내리기', act: v => set(obj[k] - 1, v) }, { n:5, t:'5 내리기', act: v => set(obj[k] - 5, v) }, { n:6, t:'10 내리기', act: v => set(obj[k] - 10, v) },
      { n:9, t:'다 됐어요', act: v => go(back, v) },
    ] };
}
const ctStatLine = (p, list) => list.map(([k, n]) => `${n} ${p[k]}`).join(', ');
function batListScreen(){
  const c = CE.c;
  return { kind:'ct-list', q:'어느 타자를 고칠까요? 번호가 타순입니다.', back: v => go(centerHomeScreen, v),
    opts: c.bat.map((p, i) => ({ n: i + 1, t:`${i + 1}번 ${POS[p.pos]} ${nm(p)}`, s: ctStatLine(p, BAT_STATS), act: v => go(() => batEditScreen(i), v) })) };
}
function pitListScreen(){
  const c = CE.c;
  return { kind:'ct-list', q:'어느 투수를 고칠까요?', back: v => go(centerHomeScreen, v),
    opts: c.pit.map((p, i) => ({ n: i + 1, t:`${p.role} ${nm(p)}`, s: ctStatLine(p, PIT_STATS), act: v => go(() => pitEditScreen(i), v) })) };
}
const BAT_POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
// 능력치를 한꺼번에: 상(70) · 중(55) · 하(40)
const LEVELS = [['아주 잘함', 78], ['잘함', 66], ['보통', 55], ['조금 약함', 45], ['약함', 35]];
function batEditScreen(i){
  const p = CE.c.bat[i], back = () => batEditScreen(i);
  return { kind:'ct-player', who:'bat', idx:i, q:`${i + 1}번 타자 ${nm(p)}. 무엇을 바꿀까요?`, back: v => go(batListScreen, v), opts:[
    { n:1, t:`이름: ${p.name}`, act: v => go(() => textScreen('이름', p.name, 8, t => { if(t) p.name = t; }, back), v) },
    { n:2, t:`별명: ${p.nick || '없음'}`, act: v => go(() => textScreen('별명', p.nick, 8, t => { p.nick = t; }, back), v) },
    { n:3, t:`수비 위치: ${POS[p.pos]}`, act: () => { p.pos = BAT_POS[(BAT_POS.indexOf(p.pos) + 1) % BAT_POS.length]; stay(`수비 위치 ${POS[p.pos]}`); } },
    { n:4, t:`치는 손: ${p.hand === 'L' ? '왼손' : '오른손'}`, act: () => { p.hand = p.hand === 'L' ? 'R' : 'L'; stay(`${p.hand === 'L' ? '왼손' : '오른손'} 타자`); } },
    ...BAT_STATS.map(([k, n], j) => ({ n: j + 5, key:k, t:`${n}: ${p[k]}`, act: v => go(() => numScreen(n, k, p, back), v) })),
    { n:10, t:`능력치 한꺼번에: ${(LEVELS.find(l => BAT_STATS.every(([k]) => p[k] === l[1])) || ['직접 정함'])[0]}`, s:'아주 잘함 · 잘함 · 보통 · 조금 약함 · 약함 순서로 바뀝니다.', act: () => { const cur = LEVELS.findIndex(l => BAT_STATS.every(([k]) => p[k] === l[1])), L = LEVELS[(cur + 1) % LEVELS.length]; BAT_STATS.forEach(([k]) => { p[k] = L[1]; }); stay(`능력치 모두 ${L[0]}(${L[1]})`); } },
  ] };
}
function pitEditScreen(i){
  const p = CE.c.pit[i], back = () => pitEditScreen(i), roles = ['선발', '마무리', '불펜'];
  return { kind:'ct-player', who:'pit', idx:i, q:`투수 ${nm(p)}. 무엇을 바꿀까요?`, back: v => go(pitListScreen, v), opts:[
    { n:1, t:`이름: ${p.name}`, act: v => go(() => textScreen('이름', p.name, 8, t => { if(t) p.name = t; }, back), v) },
    { n:2, t:`별명: ${p.nick || '없음'}`, act: v => go(() => textScreen('별명', p.nick, 8, t => { p.nick = t; }, back), v) },
    { n:3, t:`보직: ${p.role}`, s:'선발은 길게, 마무리는 경기 끝에 던집니다.', act: () => { p.role = roles[(roles.indexOf(p.role) + 1) % roles.length]; stay(`보직 ${p.role}`); } },
    { n:4, t:`던지는 손: ${p.hand === 'L' ? '왼손' : '오른손'}`, act: () => { p.hand = p.hand === 'L' ? 'R' : 'L'; stay(`${p.hand === 'L' ? '왼손' : '오른손'} 투수`); } },
    ...PIT_STATS.map(([k, n], j) => ({ n: j + 5, key:k, t:`${n}: ${p[k]}${k === 'vel' ? '킬로' : ''}`, act: v => go(() => numScreen(n, k, p, back), v) })),
  ] };
}
