'use strict';
/* ===================== 화면 보며 하기: 한 화면에 모은 만들기 화면 =====================
   소리와 글로 하기는 차례로 묻는 화면을 그대로 쓰고, 화면 보며 하기는 여기의 화면에서 여러 값을 고른 뒤 "다음"·"시작"으로 정함.
   - 리그 만들기(lg-setup): 내 팀 · 시즌 길이 · 경기 방식 · 이닝 → 리그 시작
   - 선수 만들기(wz-1·wz-2·wz-3): 1 선수 꾸미기(이름·얼굴·등번호·치는 손·투구 폼) → 2 포지션·유형 → 3 팀·시즌 → 입단
   화면 정의는 다른 화면과 같이 "질문 + 번호 선택지"(번호를 누르면 값이 다음 것으로 바뀜)이고, 그림(skin-career.js)은 S.set(키, 값)으로 바로 고름 */
const teamKeys = (withCenter = true) => [...(withCenter && CENTER ? ['center'] : []), ...TEAMS.map(t => t.key)];
let TSEL = null;   // 팀 고르기 화면(team-pick)에서 눌러 둔 팀 (정하기 전)
const cyc = (list, cur, d = 1) => list[(Math.max(0, list.indexOf(cur)) + d + list.length) % list.length];

/* ---------- 리그 만들기 ---------- */
const LG_MODES = [['manager', 'pitch', '감독'], ['detail', 'pitch', '정밀'], ['simple', 'pitch', '간단 · 공 하나씩'], ['simple', 'pa', '간단 · 타석 한 번에']];
const lgModeIdx = () => Math.max(0, LG_MODES.findIndex(m => m[0] === NEW.mode && (m[0] !== 'simple' || m[1] === NEW.unit)));
function leagueSetupScreen(){
  if(!teamKeys().includes(NEW.a)) NEW.a = teamKeys()[0];
  if(![18, 36, 72, 144].includes(NEW.len)) NEW.len = 18;
  if(![3, 5, 9].includes(NEW.inn)) NEW.inn = 9;
  const set = (k, v) => {
    if(k === 'a') NEW.a = v;
    else if(k === 'len') NEW.len = Number(v);
    else if(k === 'inn') NEW.inn = Number(v);
    else if(k === 'mode'){ const m = LG_MODES[Number(v)]; NEW.mode = m[0]; NEW.unit = m[1]; }
  };
  const m = LG_MODES[lgModeIdx()];
  return { kind:'lg-setup', set, q:'새 리그를 정하세요. 다 고르면 리그 시작을 누르세요.', back: v => go(leagueHome, v), opts:[
    { n:1, key:'a', t:`내 팀: ${teamInfo(NEW.a).name}`, act: () => { NEW.a = cyc(teamKeys(), NEW.a); stay(`내 팀 ${teamInfo(NEW.a).name}`); } },
    { n:2, key:'len', t:`시즌 길이: 팀당 ${NEW.len}경기`, act: () => { NEW.len = cyc([18, 36, 72, 144], NEW.len); stay(`팀당 ${NEW.len}경기`); } },
    { n:3, key:'mode', t:`우리 팀 경기 방식: ${m[2]}`, act: () => { const x = LG_MODES[(lgModeIdx() + 1) % LG_MODES.length]; NEW.mode = x[0]; NEW.unit = x[1]; stay(`경기 방식 ${x[2]}`); } },
    { n:4, key:'inn', t:`이닝: ${NEW.inn}이닝`, act: () => { NEW.inn = cyc([3, 5, 9], NEW.inn); stay(`${NEW.inn}이닝`); } },
    { n:9, key:'start', t:'리그 시작', act: v => {
      setLG(leagueNew({ my: NEW.a, len: NEW.len, mode: NEW.mode, unit: NEW.unit, inn: NEW.inn, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0 }));
      go(lhome(), v, [`새 리그를 만들었습니다. ${teamInfo(NEW.a).name}의 감독이 되었습니다. 정규 시즌 ${NEW.len}경기, ${NEW.inn}이닝 경기입니다.`]); } },
  ] };
}

/* ---------- 내 선수 얼굴 꾸미기 (화면 보며 하기, 내 선수 화면에서): 고른 뒤 "바꾸기"를 눌러야 저장 ---------- */
let LOOK_DRAFT = null;
function careerLookScreen(back){
  const L = CR(), c = C(L);
  if(!LOOK_DRAFT) LOOK_DRAFT = lookFix(c.look || LOOK_DEF);
  return { kind:'cr-look', q:'얼굴을 꾸미세요. 다 되면 바꾸기를 누르세요.', draft: () => LOOK_DRAFT,
    set: (k, v) => { LOOK_DRAFT = lookSet(LOOK_DRAFT, k, v); },
    back: v => { LOOK_DRAFT = null; go(back, v); }, opts:[
      { n:1, key:'rand', t:'무작위로 꾸미기', act: () => { LOOK_DRAFT = lookRandom(); stay('얼굴을 새로 꾸몄습니다.'); } },
      { n:9, key:'done', t:'바꾸기', act: v => { c.look = LOOK_DRAFT; LOOK_DRAFT = null; saveLeague(); go(back, v, ['얼굴을 바꿨습니다.']); } },
    ] };
}

/* ---------- 선수 만들기 (세 단계) ---------- */
const FORMS = ['오버핸드', '사이드암', '언더핸드'];
const BAT_POS9 = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
function wzFill(){
  if(!NEWC.name) NEWC.name = '';
  if(NEWC.face == null) NEWC.face = 0;
  if(!NEWC.look) NEWC.look = lookRandom();
  if(NEWC.num == null) NEWC.num = 7;
  if(!NEWC.hand) NEWC.hand = 'R';
  if(NEWC.form == null) NEWC.form = 0;
  if(!BAT_POS9.includes(NEWC.pos)) NEWC.pos = 'SS';
  const types = NEWC.pit ? PIT_TYPES : BAT_TYPES;
  if(!types.some(t => t.key === NEWC.type)) NEWC.type = types[0].key;
  if(!teamKeys().includes(NEW.a)) NEW.a = teamKeys()[0];
  if(![18, 36, 72, 144].includes(NEW.len)) NEW.len = 36;
  if(!['detail', 'simple'].includes(NEW.mode)) NEW.mode = 'detail';
}
function careerWizard(step){
  wzFill();
  const back = v => step === 1 ? go(careerHome, v) : go(() => careerWizard(step - 1), v);
  const next = (v, why) => why ? stay(why) : go(() => careerWizard(step + 1), v);
  if(step === 1){
    const set = (k, v) => {
      if(k === 'lt' || k === 'lk' || k === 'lr') NEWC.look = lookSet(NEWC.look, k, v);
      else if(k === 'num') NEWC.num = clamp(NEWC.num + Number(v), 0, 99);
      else if(k === 'hand') NEWC.hand = v;
      else if(k === 'form') NEWC.form = Number(v);
      else if(k === 'pit'){ NEWC.pit = v === '1'; NEWC.type = null; wzFill(); }
    };
    return { kind:'wz-1', set, step, q:'1단계: 선수를 꾸미세요. 이름은 칸에 적고, 다 되면 다음을 누르세요.', back,
      onText: t => { NEWC.name = t.trim().slice(0, 10); rerender(); },
      opts:[
        { n:1, key:'pit', t:`종류: ${NEWC.pit ? '투수' : '타자'}`, act: () => { set('pit', NEWC.pit ? '0' : '1'); stay(NEWC.pit ? '투수' : '타자'); } },
        { n:2, key:'look', t:'얼굴 무작위로 꾸미기', act: () => { NEWC.look = lookRandom(); stay('얼굴을 새로 꾸몄습니다.'); } },
        { n:3, key:'num', t:`등번호: ${NEWC.num}`, act: () => { NEWC.num = (NEWC.num + 1) % 100; stay(`등번호 ${NEWC.num}`); } },
        { n:4, key:'hand', t:`${NEWC.pit ? '던지는' : '치는'} 손: ${NEWC.hand === 'L' ? '왼손' : '오른손'}`, act: () => { NEWC.hand = NEWC.hand === 'L' ? 'R' : 'L'; stay(NEWC.hand === 'L' ? '왼손' : '오른손'); } },
        { n:5, key:'form', hide: !NEWC.pit, t:`투구 폼: ${FORMS[NEWC.form]}`, act: () => { NEWC.form = (NEWC.form + 1) % 3; stay(`투구 폼 ${FORMS[NEWC.form]}`); } },
        { n:9, key:'next', t:'다음: 포지션과 유형', act: v => next(v, NEWC.name ? null : '먼저 이름을 적어 주세요.') },
      ] };
  }
  if(step === 2){
    const types = NEWC.pit ? PIT_TYPES : BAT_TYPES;
    const set = (k, v) => { if(k === 'pos') NEWC.pos = v; else if(k === 'role') NEWC.role = v; else if(k === 'type') NEWC.type = v; };
    if(!['sp', 'rp'].includes(NEWC.role)) NEWC.role = 'sp';
    const ty = types.find(t => t.key === NEWC.type);
    return { kind:'wz-2', set, step, q:`2단계: ${NEWC.pit ? '보직' : '수비 위치'}과 선수 유형을 고르세요.`, back, opts:[
      NEWC.pit ? { n:1, key:'role', t:`보직: ${NEWC.role === 'sp' ? '선발 투수' : '불펜 투수'}`, act: () => { NEWC.role = NEWC.role === 'sp' ? 'rp' : 'sp'; stay(NEWC.role === 'sp' ? '선발 투수' : '불펜 투수'); } }
        : { n:1, key:'pos', t:`수비 위치: ${POS[NEWC.pos]}`, act: () => { NEWC.pos = cyc(BAT_POS9, NEWC.pos); stay(POS[NEWC.pos]); } },
      { n:2, key:'type', t:`선수 유형: ${ty.name}`, s: ty.s, act: () => { NEWC.type = cyc(types.map(t => t.key), NEWC.type); const t2 = types.find(t => t.key === NEWC.type); stay(`${t2.name}. ${t2.s}`); } },
      { n:9, key:'next', t:'다음: 팀과 시즌', act: v => next(v) },
    ] };
  }
  const set = (k, v) => { if(k === 'a') NEW.a = v; else if(k === 'len') NEW.len = Number(v); else if(k === 'mode') NEW.mode = v; };
  return { kind:'wz-3', set, step, q:'3단계: 입단할 팀과 시즌을 고르세요.', back, opts:[
    { n:1, key:'a', t:`팀: ${teamInfo(NEW.a).name}`, act: () => { NEW.a = cyc(teamKeys(), NEW.a); stay(teamInfo(NEW.a).name); } },
    { n:2, key:'len', t:`시즌 길이: 팀당 ${NEW.len}경기`, act: () => { NEW.len = cyc([18, 36, 72, 144], NEW.len); stay(`팀당 ${NEW.len}경기`); } },
    { n:3, key:'mode', t:`내 차례 방식: ${NEW.mode === 'simple' ? '간단 (공 하나씩)' : '정밀'}`, act: () => { NEW.mode = NEW.mode === 'simple' ? 'detail' : 'simple'; stay(NEW.mode === 'simple' ? '간단' : '정밀'); } },
    { n:9, key:'start', t:'입단하기', act: v => { NEW.kind = 'career'; NEWC.team = NEW.a; setLG(careerNew()); leagueNews(LG()); go(careerHome, v, C(LG()).ach.map(x => x.text)); } },
  ] };
}
