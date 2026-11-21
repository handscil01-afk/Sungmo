'use strict';
/* ===================== 화면 보며 하기: 만들기 화면 그림 =====================
   리그 만들기(lg-setup), 선수 만들기 세 단계(wz-1·wz-2·wz-3), 팀 고르기(team-pick).
   누르면 바로 넘어가지 않고 고른 것이 빛나며, 아래의 "다음"·"시작" 단추를 눌러야 정해짐.
   고르는 단추는 data-sk="set"(S.set(키, 값) 뒤 다시 그림), 정하는 단추는 data-sk="opt"(번호 선택지) */
const suOpt = (S, key) => (S.opts || []).find(o => o.key === key && !o.hide);
const suSeg = (label, key, list, cur) => `<div class="su-row"><span>${esc(label)}</span><div class="seg">${list.map(([v, t, s]) => `<button type="button" class="${String(v) === String(cur) ? 'on' : ''}" data-sk="set" data-k="${key}" data-v="${v}" aria-pressed="${String(v) === String(cur)}">${esc(t)}${s ? `<small>${esc(s)}</small>` : ''}</button>`).join('')}</div></div>`;
const suGo = (o, sub, cls = '') => o ? `<button type="button" class="crplay su-go ${cls}" data-sk="opt" data-n="${o.n}"><span class="pp">▶</span><span><b>${esc(o.t.replace(/:.*/, ''))}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>` : '';
const suKeys = withCenter => [...(withCenter && typeof CENTER !== 'undefined' && CENTER ? ['center'] : []), ...TEAMS.map(t => t.key)];
// 팀 엠블럼 격자: 누르면 고르기만 함
function suTeams(keys, cur, key = 'a'){
  return `<div class="su-tg">${keys.map(k => { const T = teamInfo(k); return `<button type="button" class="su-tc${k === cur ? ' on' : ''}" data-sk="set" data-k="${key}" data-v="${k}" style="--tc:${T.color}" aria-pressed="${k === cur}" aria-label="${esc(T.name)}">${emb(T)}<b>${esc(T.short)}</b></button>`; }).join('')}</div>`;
}
// 고른 팀 소개 한 줄 카드
function suTeamCard(k, lab){
  const T = teamInfo(k), P = parkInfo(k);
  return `<div class="su-tcard" style="--tc:${T.color}">${emb(T, 'big')}<span><small>${esc(lab)}</small><b>${esc(T.name)}</b><em>${esc(STYLES[T.style].name)} · ${esc(P.name)}</em></span></div>`;
}

/* ---------- 리그 만들기 ---------- */
function lgSetupSkin(S){
  const mi = lgModeIdx();
  return `<div class="su-l">${suTeamCard(NEW.a, '내 팀')}
    ${suTeams(suKeys(true), NEW.a)}
    ${suGo(suOpt(S, 'start'), `${teamInfo(NEW.a).short} · ${NEW.len}경기 · ${NEW.inn}이닝`)}</div>
    <div class="su-r"><div class="su panel">
      ${suSeg('시즌 길이 (팀당)', 'len', [18, 36, 72, 144].map(n => [n, n + '경기']), NEW.len)}
      ${suSeg('우리 팀 경기 방식', 'mode', LG_MODES.map((m, i) => [i, ...m[2].split(' · ')]), mi)}
      ${suSeg('이닝', 'inn', [3, 5, 9].map(n => [n, n + '회']), NEW.inn)}
    </div></div>`;
}

/* ---------- 선수 만들기 ---------- */
const WZ_STEPS = ['꾸미기', '포지션', '팀'];
const wzSteps = n => `<ol class="wz-st">${WZ_STEPS.map((t, i) => `<li class="${i + 1 === n ? 'on' : i + 1 < n ? 'ok' : ''}"><b>${i + 1}</b>${esc(t)}</li>`).join('')}</ol>`;
const wzColor = () => teamInfo(NEW.a || TEAMS[0].key).color;
// 선수 카드: 얼굴, 등번호(유니폼 등), 이름, 고른 것 요약
function wzCard(sub){
  const col = wzColor();
  return `<div class="wz-card" style="--tc:${col}">
    ${crFace(NEWC.look, col, 'big', NEW.a)}
    <div class="wz-jer" aria-hidden="true"><span class="wz-nm">${esc(NEWC.name || '이름')}</span><b>${NEWC.num}</b></div>
    <p class="wz-sub">${esc(sub)}</p></div>`;
}
function wzSum(){
  const hand = NEWC.hand === 'L' ? (NEWC.pit ? '좌투' : '좌타') : (NEWC.pit ? '우투' : '우타');
  return NEWC.pit ? `투수 · ${hand} · ${FORMS[NEWC.form]}` : `타자 · ${hand}`;
}
function wz1Skin(S){
  const num = `<div class="su-row"><span>등번호</span><div class="wz-num">${[-10, -1].map(d => `<button type="button" data-sk="set" data-k="num" data-v="${d}">${d}</button>`).join('')}<b>${NEWC.num}</b>${[1, 10].map(d => `<button type="button" data-sk="set" data-k="num" data-v="${d}">+${d}</button>`).join('')}</div></div>`;
  return `<div class="su-l">${wzSteps(1)}
    <div class="wz-top">${wzCard(wzSum())}
      <div class="wz-side">
        <label class="wz-in"><span>이름</span><input id="wzName" type="text" maxlength="10" value="${esc(NEWC.name)}" placeholder="이름 적기" enterkeyhint="done" autocomplete="off" spellcheck="false"></label>
        ${suSeg('종류', 'pit', [[0, '타자'], [1, '투수']], NEWC.pit ? 1 : 0)}
        ${num}
      </div></div>
    ${suGo(suOpt(S, 'next'), NEWC.name ? '포지션과 유형 고르기' : '먼저 이름을 적으세요', NEWC.name ? '' : 'dim')}</div>
    <div class="su-r"><div class="su panel">
      <div class="su-row"><span>얼굴 꾸미기</span>${lookEditor(NEWC.look, wzColor())}</div>
      ${suSeg(NEWC.pit ? '던지는 손' : '치는 손', 'hand', [['R', '오른손'], ['L', '왼손']], NEWC.hand)}
      ${NEWC.pit ? suSeg('투구 폼', 'form', FORMS.map((f, i) => [i, f]), NEWC.form) : ''}
    </div></div>`;
}
// 수비 위치: 야구장 그림 위의 자리 단추 (위치는 % 좌표)
const WZ_FIELD = { LF:[17, 26], CF:[50, 12], RF:[83, 26], SS:[34, 46], '2B':[63, 42], '3B':[20, 62], '1B':[80, 62], C:[50, 88], DH:[86, 88] };
const WZ_STAT = { con:'컨택', pow:'파워', eye:'선구안', spd:'스피드', def:'수비', vel:'구속', ctl:'제구', stf:'구위', sta:'체력' };
function wz2Skin(S){
  const types = NEWC.pit ? PIT_TYPES : BAT_TYPES;
  const where = NEWC.pit
    ? `<div class="wz-role">${[['sp', '선발 투수', '닷새마다 길게 던지고 승리를 쌓습니다.'], ['rp', '불펜 투수', '후반에 짧게 던지고 세이브를 노립니다.']].map(([k, t, s]) => `<button type="button" class="wz-rc${NEWC.role === k ? ' on' : ''}" data-sk="set" data-k="role" data-v="${k}" aria-pressed="${NEWC.role === k}"><b>${t}</b><small>${s}</small></button>`).join('')}</div>`
    : `<div class="wz-field" aria-label="수비 위치">${BAT_POS9.map(k => `<button type="button" class="wz-pos${NEWC.pos === k ? ' on' : ''}" data-sk="set" data-k="pos" data-v="${k}" style="left:${WZ_FIELD[k][0]}%;top:${WZ_FIELD[k][1]}%" aria-pressed="${NEWC.pos === k}">${k === 'DH' ? '지명' : esc(POS[k].replace(/수$/, ''))}</button>`).join('')}</div>`;
  const mods = m => Object.entries(m).map(([k, v]) => `<i class="${v > 0 ? 'up' : 'dn'}">${trainIco(TRAIN_IDX[k])}${esc(WZ_STAT[k])} ${v > 0 ? '+' : ''}${k === 'vel' ? v + 'km' : v}</i>`).join('');
  const cards = types.map(t => `<button type="button" class="wz-ty${NEWC.type === t.key ? ' on' : ''}" data-sk="set" data-k="type" data-v="${t.key}" aria-pressed="${NEWC.type === t.key}"><b>${esc(t.name)}</b><small>${esc(t.s)}</small><span class="wz-md">${mods(t.mod)}</span></button>`).join('');
  return `<div class="su-l">${wzSteps(2)}
    <div class="su-row wz-lab"><span>${NEWC.pit ? '보직' : `수비 위치 · ${esc(POS[NEWC.pos])}`}</span></div>${where}</div>
    <div class="su-r"><div class="su-row wz-lab"><span>선수 유형</span></div><div class="wz-tys n${types.length}">${cards}</div>
    ${suGo(suOpt(S, 'next'), `${NEWC.pit ? (NEWC.role === 'sp' ? '선발' : '불펜') : POS[NEWC.pos]} · ${types.find(t => t.key === NEWC.type).name}`)}</div>`;
}
function wz3Skin(S){
  const types = NEWC.pit ? PIT_TYPES : BAT_TYPES;
  return `<div class="su-l">${wzSteps(3)}
    ${suTeamCard(NEW.a, '입단할 팀')}
    ${suTeams(suKeys(true), NEW.a)}</div>
    <div class="su-r"><div class="su panel">
      ${suSeg('시즌 길이 (팀당)', 'len', [18, 36, 72, 144].map(n => [n, n + '경기']), NEW.len)}
      ${suSeg('내 차례 방식', 'mode', [['detail', '정밀', '공마다 고르기'], ['simple', '간단', '주사위로 빠르게']], NEW.mode)}
    </div>
    <div class="wz-mini" style="--tc:${teamInfo(NEW.a).color}">${crFace(NEWC.look, teamInfo(NEW.a).color, 'sm', NEW.a)}<span><b>${esc(NEWC.name)} · ${NEWC.num}번</b><small>${esc(NEWC.pit ? (NEWC.role === 'sp' ? '선발 투수' : '불펜 투수') : POS[NEWC.pos])} · ${esc(types.find(t => t.key === NEWC.type).name)} · ${esc(wzSum().replace(/^\S+ · /, ''))}</small></span></div>
    ${suGo(suOpt(S, 'start'), `${teamInfo(NEW.a).short} 2군에서 시작 · ${NEW.len}경기 시즌`)}</div>`;
}

/* ---------- 내 선수 얼굴 꾸미기 (내 선수 화면에서) ---------- */
function crLookSkin(S){
  const L = crL(), col = crColor(L), c = L.career, p = myP(L);
  return `<div class="su-l"><div class="wz-top one">${`<div class="wz-card" style="--tc:${col}">${crFace(S.draft(), col, 'big', L.my)}<div class="wz-jer" aria-hidden="true"><span class="wz-nm">${esc(p.name)}</span><b>${crNumOf(c, p)}</b></div></div>`}</div>
    ${suGo(suOpt(S, 'done'), '고른 얼굴로 바꾸기')}</div>
    <div class="su-r"><div class="su panel">${lookEditor(S.draft(), col)}</div></div>`;
}

/* ---------- 팀 고르기 (눌러 고르고 "이 팀으로") ---------- */
function teamPickSkin(S){
  const teams = (S.opts || []).filter(o => o.key && !o.hide), sel = teams.find(o => o.key === TSEL) || teams[0];
  const extra = (S.opts || []).filter(o => !o.key && !o.hide);
  const T = teamInfo(sel.key), P = parkInfo(sel.key), St = STYLES[T.style];
  return `<div class="su-tcard big" style="--tc:${T.color}">${emb(T, 'big')}<span><b>${esc(T.name)}</b><em>${esc(St.name)} · ${esc(St.desc)}</em><small>홈구장 ${esc(P.name)}: ${esc(P.desc)}</small></span></div>
    ${suTeams(teams.map(o => o.key), sel.key, 'pick')}
    ${extra.length ? `<div class="su-ex">${extra.map(o => `<button type="button" class="mn" data-sk="opt" data-n="${o.n}"><span>${esc(o.t)}</span></button>`).join('')}</div>` : ''}
    <button type="button" class="crplay su-go" data-sk="opt" data-n="${sel.n}"><span class="pp">▶</span><span><b>이 팀으로</b><small>${esc(T.name)}</small></span></button>`;
}

Object.assign(CAREER_SK, { 'lg-setup':lgSetupSkin, 'wz-1':wz1Skin, 'wz-2':wz2Skin, 'wz-3':wz3Skin, 'team-pick':teamPickSkin, 'cr-look':crLookSkin });

// 이름 칸: 적는 동안 다시 그리지 않고(글자판이 닫히지 않게) 카드의 이름과 "다음" 단추만 고침
if(typeof document !== 'undefined'){
  document.addEventListener('input', e => {
    if(!e.target || e.target.id !== 'wzName') return;
    NEWC.name = e.target.value.trim().slice(0, 10);
    const nm = document.querySelector('.wz-nm'); if(nm) nm.textContent = NEWC.name || '이름';
    const btn = document.querySelector('.k-wz-1 .su-go'); if(btn){ btn.classList.toggle('dim', !NEWC.name); const sm = btn.querySelector('small'); if(sm) sm.textContent = NEWC.name ? '포지션과 유형 고르기' : '먼저 이름을 적으세요'; }
  });
  document.addEventListener('keydown', e => { if(e.target && e.target.id === 'wzName' && e.key === 'Enter'){ e.preventDefault(); e.target.blur(); } });
}
