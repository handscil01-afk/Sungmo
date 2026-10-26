'use strict';
/* ===================== 중계 모드 (보이스오버용 간단 화면) =====================
   센터장님처럼 아이폰 보이스오버로 쓰는 기기를 위한 화면. 운영 현황 역할에 '중계 모드'를 켜면(monitor:'voice') 이 화면이 나옴.
   - 그림 문자(이모지)와 아이콘을 쓰지 않고, 글자가 있는 진짜 단추(<button>)와 제목(<h1>·<h2>)만 씀
   - 데이터가 바뀌어도 화면을 다시 그리지 않음: 보이스오버가 읽던 자리(초점)를 잃지 않게. 상황 글은 단추를 누른 순간의 내용
   - 새 단체전 결과가 저장되면 숨은 알림 칸(#vlive, aria-live)에 글을 넣어 보이스오버가 바로 읽게 함 (음성 합성은 쓰지 않음) */
const VOICE = { panel:null, secs:[], ver:0, html:'', focus:null, init:false, seen:new Set(), sayQ:[], sayT:0, toastT:0, ready:true };
// 중계 모드 화면에서 뺄 문자: 그림 문자, 변이 선택자, 동그라미 점
const VSTRIP = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{25CF}\u{2715}]/gu;
const vstrip = s => String(s ?? '').replace(VSTRIP, '');
// 중계 모드 기기인가: 마스터가 아니고, 운영 현황만 맡았고, 중계 모드를 켠 기기
const voiceShellOn = r => r.role==='staff' && !!r.voice && monitorOnly(r);
const voiceMode = () => !!store && !!UI.me && !D.fatal && !D.amMaster && voiceShellOn(myRole());
// 대기 중인 사람 수 (개인전 부스의 대기 줄 길이)
function waitCount(ev){ return qList(ev).length; }

/* ---------- 읽어 줄 글 ---------- */
const nameOf = (m, team) => { const id = team==='blue' ? m.blueId : m.redId; return id ? pname(id) : ((team==='blue' ? m.blueName : m.redName) || ''); };
// 1~3등 문장. 같은 순위가 여럿이면 '공동 2등 A, B 20점'
function rankText(st, ev){
  const groups = [];
  st.list.filter(x => x.rank <= 3).forEach(x => { const g = groups.find(g => g.rank===x.rank); if(g) g.xs.push(x); else groups.push({ rank:x.rank, xs:[x] }); });
  return groups.map(g => g.xs.length > 1
    ? `공동 ${g.rank}등 ${g.xs.map(x => x.p.name).join(', ')} ${sc(ev, g.xs[0].total)}`
    : `${g.rank}등 ${g.xs[0].p.name} ${sc(ev, g.xs[0].total)}`).join(', ');
}
const indivStarted = ev => D.indiv.some(r => r.event===ev && !r.deleted && (r.throws||[]).length);
// 개인전 한 종목: 본선이 안 끝났으면 남은 사람 수, 끝났으면 1~3등과 동점·결승 결과. detail이면 끝나기 전에도 '현재 순위'를 함께 읽어 줌
function voiceIndiv(ev, detail){
  const E = INDIV[ev], st = standings(ev), act = people().filter(p => !isAbsent(p.id));
  const left = act.filter(p => !rec(ev, 'main', p.id)).length;
  const done = st.list.length > 0 && left === 0;
  const out = [];
  if(!done){
    const w = waitCount(ev);
    out.push(`${E.name}, 본선 ${left}명 남음${w ? `, 대기 ${w}명` : ''}.`);
  }
  if(st.list.length && (done || detail)) out.push(`${E.name} ${done ? '' : '현재 순위 '}${rankText(st, ev)}.`);
  else if(detail && !done) out.push(`${E.name}, 아직 본선 기록이 없습니다.`);
  if(done){
    st.ties.forEach(t => {
      if(!t.resolved) out.push(`결승 필요: ${t.names.join(', ')}, ${sc(ev, t.total)} 동점.`);
      else {
        const fin = t.ids.map(id => st.list.find(x => x.p.id===id)).filter(Boolean).sort((a, b) => (b.ftotal ?? -1) - (a.ftotal ?? -1));
        out.push(`결승 결과: ${fin.map(x => `${x.p.name} ${sc(ev, x.ftotal)}`).join(', ')}.`);
      }
    });
  }
  return out;
}
// 지금 하고 있는(가장 최근에 움직인) 단체전 종목: 안내판 자동 화면과 같은 기준
function voiceTeamLead(){
  let best = { t:0, ev:null };
  D.matches.forEach(m => { if(m.deleted || !TEAM[m.event]) return; const t = Math.max(m.at||0, m.editedAt||0); if(t > best.t) best = { t, ev:m.event }; });
  Object.entries(D.calls).forEach(([ev, c]) => { const t = (c.call||{}).at||0; if(TEAM[ev] && t > best.t) best = { t, ev }; });
  Object.values(D.ccalls).forEach(c => { const t = c.at||0; if(TEAM[c.event] && ORDER_EVENTS.includes(c.event) && t > best.t) best = { t, ev:c.event }; });
  return best.ev;
}
const scoreText = ev => { const t = tally(ev); return `${teamName('blue')} ${t.blue}, ${teamName('red')} ${t.red}`; };
const totalText = () => { const t = totalPoints(); return `전체 승점 ${teamName('blue')} ${t.blue}, ${teamName('red')} ${t.red}.`; };
function lastResult(ev){
  const ms = matchesOf(ev), m = ms[ms.length - 1]; if(!m) return '';
  const round = TEAM[ev].mode === 'round', head = round ? '직전 판' : '직전 경기';
  const pt = scoreTxt(m) ? `, 점수 ${fmtNum(m.blueScore)} 대 ${fmtNum(m.redScore)}` : '';
  if(m.winner === 'draw') return `${head}: 무승부${pt}.`;
  const nm = round ? '' : nameOf(m, m.winner);
  return `${head}: ${teamName(m.winner)}${nm ? ' ' + nm : ''} 승리${pt}.`;
}
// 지금 경기 줄: 짝을 이루는 종목은 '청팀 ○○○ 대 홍팀 ○○○ 경기 중', 줄다리기는 'n판째'
function voiceNowLine(ev){
  const E = TEAM[ev];
  if(E.mode === 'round') return `${E.name} ${matchesOf(ev).length + 1}판째.`;
  const b = upNext(ev, 'blue').cur, r = upNext(ev, 'red').cur;
  return b && r ? `지금 ${E.name}, ${teamName('blue')} ${pname(b)} 대 ${teamName('red')} ${pname(r)} 경기 중.` : `지금 ${E.name} 경기 중.`;
}
// kind: now(지금 상황) · indiv(개인전) · team(단체전) → [{ title, lines }]
function voiceBuild(kind){
  if(!D.loaded.config || !D.loaded.indiv || !D.loaded.matches) return [{ title:'', lines:['아직 불러오는 중입니다. 잠시 뒤에 새로 고침을 눌러 주세요.'] }];
  const secs = [];
  if(kind === 'now'){
    const act = Object.keys(INDIV).filter(indivStarted);
    secs.push({ title:'개인전', lines: act.length ? act.flatMap(ev => voiceIndiv(ev, false)) : ['개인전은 아직 시작하지 않았습니다.'] });
    const lead = voiceTeamLead();
    secs.push({ title:'단체전', lines: lead ? [voiceNowLine(lead), lastResult(lead), `${TEAM[lead].name} 점수 ${scoreText(lead)}.`, totalText()].filter(Boolean) : ['단체전은 아직 시작하지 않았습니다.'] });
  } else if(kind === 'indiv'){
    secs.push({ title:'', lines: Object.keys(INDIV).flatMap(ev => voiceIndiv(ev, true)) });
  } else {
    const lead = voiceTeamLead(), lines = [];
    if(lead) lines.push(voiceNowLine(lead));
    // 종목마다 한 줄: 점수와 그 종목의 마지막 결과를 함께 읽어 어느 종목 결과인지 헷갈리지 않게 함
    Object.keys(TEAM).forEach(ev => { const l = lastResult(ev).replace(/^직전 (경기|판): /, '마지막 $1 ').replace(/: 무승부/, ' 무승부');
      lines.push(matchesOf(ev).length ? `${TEAM[ev].name}: ${scoreText(ev)}. ${l}` : `${TEAM[ev].name}: 아직 경기가 없습니다.`); });
    lines.push(totalText());
    secs.push({ title:'', lines });
  }
  const d = new Date();
  secs.push({ title:'', lines:[`${d.getHours() < 12 ? '오전' : '오후'} ${d.getHours() % 12 || 12}시 ${d.getMinutes()}분 기준.`], note:true });
  return secs;
}

/* ---------- 화면 ---------- */
const VPANELS = [['now', '지금 상황'], ['indiv', '개인전'], ['team', '단체전']];
function voiceRender(){
  const app = $('#app');
  const cur = VPANELS.find(p => p[0] === VOICE.panel);
  const err = D.error ? `<p class="vnote" role="alert">${esc(vstrip(D.error))}</p>` : '';
  const panel = cur ? `<section class="vpanel" aria-labelledby="vh" data-ver="${VOICE.ver}"><h2 id="vh" tabindex="-1">${cur[1]}</h2>
      ${VOICE.secs.map(s => `${s.title ? `<h3>${esc(s.title)}</h3>` : ''}${s.lines.map(l => `<p${s.note ? ' class="vnotep"' : ''}>${esc(l)}</p>`).join('')}`).join('')}
      <button class="vbtn sub" data-a="vPanel" data-v="${cur[0]}">새로 고침</button>
      <button class="vbtn sub" data-a="vPanel" data-v="">목록으로</button></section>` : '';
  const html = `<div class="vshell"><header class="vhead"><h1>중계 모드</h1><span class="vname">${esc(UI.me)}</span><button class="vbtn vmenu" data-a="menu" aria-label="메뉴">메뉴</button></header>
    <main class="vmain" id="vmain">${err}
      <div class="vbtns" role="group" aria-label="보기">
        ${VPANELS.map(([k, l]) => `<button class="vbtn" id="vb-${k}" data-a="vPanel" data-v="${k}" aria-expanded="${VOICE.panel===k}">${l}</button>`).join('')}
        <button class="vbtn" id="vb-radio" data-a="vRadio">무전</button>
        <button class="vbtn" id="vb-msg" data-a="vMsg">문자</button>
      </div>
      ${panel}
    </main></div>`;
  const has = app.firstElementChild && app.firstElementChild.classList.contains('vshell');
  if(!has || VOICE.html !== html){ app.innerHTML = html; VOICE.html = html; }
  if(VOICE.focus){ const el = document.getElementById(VOICE.focus); VOICE.focus = null; if(el) el.focus(); }
}
// 시각 장애가 있는 사용자를 위해, 누를 수 있는 글 조각(div 등)에 단추 역할과 초점을 줌
function voiceA11y(root){
  root.querySelectorAll('[data-a]').forEach(el => {
    if(/^(BUTTON|INPUT|A|SELECT|TEXTAREA|LABEL)$/.test(el.tagName)) return;
    el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0');
  });
}
document.addEventListener('keydown', e => {
  if((e.key==='Enter' || e.key===' ') && e.target && e.target.getAttribute && e.target.getAttribute('role')==='button' && e.target.tagName!=='BUTTON'){ e.preventDefault(); e.target.click(); }
});

/* ---------- 읽기 전용 알림 칸 ---------- */
// 같은 글이 다시 와도 다시 읽도록, 칸을 비웠다가 0.1초 뒤에 넣음. 짧은 시간에 여럿이 오면 이어 붙임
function voiceSay(text){
  if(!text) return;
  VOICE.sayQ.push(text);
  if(VOICE.sayT) return;
  const el = $('#vlive'); if(el) el.textContent = '';
  VOICE.sayT = setTimeout(() => { VOICE.sayT = 0; const t = VOICE.sayQ.splice(0).join(' '); const e2 = $('#vlive'); if(e2) e2.textContent = t; }, 100);
}
// 알림창(토스트)도 보이스오버가 읽도록 따로 둔 차분한 알림 칸에 넣음
function voiceToast(msg){
  if(!voiceMode() || !msg) return;
  const el = $('#vtoast'); if(!el) return;
  el.textContent = ''; clearTimeout(VOICE.toastT);
  VOICE.toastT = setTimeout(() => { el.textContent = vstrip(msg); }, 100);
}
// 새 단체전 결과가 저장되면 읽어 줌: 첫 불러오기와 2분보다 오래된 것은 건너뜀
function matchSpeech(m){
  const E = TEAM[m.event], t = tally(m.event), round = E.mode === 'round';
  const label = round ? `${E.name} ${matchesOf(m.event).findIndex(x => x.id===m.id) + 1}판째` : E.name;
  let res;
  if(m.winner === 'draw') res = '무승부';
  else { const nm = round ? '' : nameOf(m, m.winner); res = `${teamName(m.winner)}${nm ? ' ' + nm : ''} 승리`; }
  // 대결 점수를 기록한 경기는 '점수 3 대 2'를 먼저 읽고, 종목 누적은 '누적'으로 구분
  if(scoreTxt(m)) return `${label}, ${res}, 점수 ${fmtNum(m.blueScore)} 대 ${fmtNum(m.redScore)}. 누적 ${teamName('blue')} ${t.blue}, ${teamName('red')} ${t.red}.`;
  return `${label}, ${res}. 점수 ${teamName('blue')} ${t.blue}, ${teamName('red')} ${t.red}.`;
}
function voiceTick(){
  if(!D.loaded.matches) return;
  if(!VOICE.init){ D.matches.forEach(m => VOICE.seen.add(m.id)); VOICE.init = true; return; }
  const texts = [];
  D.matches.slice().sort((a, b) => (a.at||0) - (b.at||0)).forEach(m => {
    if(VOICE.seen.has(m.id)) return;
    VOICE.seen.add(m.id);
    if(!m.deleted && TEAM[m.event] && (m.at||0) > now() - 120000) texts.push(matchSpeech(m));
  });
  if(texts.length) voiceSay(texts.join(' '));
}

/* ---------- 메뉴 (그림 없이) ---------- */
function voiceMenu(){
  const btn = (a, label, sub) => `<button class="vmbtn" data-a="${a}">${label}${sub ? `<span>${sub}</span>` : ''}</button>`;
  return `<h2>메뉴</h2>
    <p>이 기기: ${esc(UI.me)}. 운영 현황 중계 모드입니다.</p>
    <div class="vmlist">
      ${btn('rename', '이름 바꾸기')}
      ${btn('schedSheet', '진행 일정 보기', '오늘 일정과 남은 시간을 봅니다.')}
      <label class="vmrow"><span>다른 사람 무전 듣기</span><input type="checkbox" data-a="rxToggle" ${RADIO.on ? 'checked' : ''}></label>
      ${btn('micTest', '마이크 미리 허용하기', '처음 한 번 마이크를 허용해 두면 바로 말할 수 있습니다.')}
      ${btn('leaveRole', '담당 다시 고르기', '지금 역할에서 나가고 담당자를 다시 고릅니다.')}
      ${btn('masterLogin', '마스터로 들어가기', '마스터 비밀번호가 필요합니다.')}
    </div>
    ${psMenu()}
    <button class="btn primary wide" data-a="closeSheet" style="margin-top:14px">닫기</button>`;
}

Object.assign(ACT, {
  // 지금 상황 · 개인전 · 단체전: 누른 순간의 내용을 만들고, 제목으로 초점을 옮겨 보이스오버가 바로 읽게 함. 같은 단추가 아닌 빈 값이면 목록으로 돌아감
  vPanel: (el, v) => {
    if(!voiceMode()) return false;
    const back = !v, opener = VOICE.panel;
    VOICE.panel = back ? null : v;
    VOICE.secs = back ? [] : voiceBuild(v); VOICE.ver++;   // 새로 고침도 새로 그려서 보이스오버가 다시 읽게 함
    VOICE.focus = back ? (opener ? 'vb-' + opener : null) : 'vh';
  },
  vRadio: (el) => { WK.tab = 'radio'; ls.set('udh5_wktab', 'radio'); return ACT.wkOpen(el); },
  vMsg: (el) => { WK.tab = 'msg'; ls.set('udh5_wktab', 'msg'); return ACT.wkOpen(el); },
});
