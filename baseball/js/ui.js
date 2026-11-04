'use strict';
/* ===================== 화면 틀: 번호로 고르는 메뉴 =====================
   모든 화면은 "질문 하나 + 번호 붙은 선택지"로 되어 있어서, 같은 방법으로 고름
   - 단추 누르기(보이스오버·톡백 두 번 탭, 마우스)
   - 숫자 키(리보 키보드 숫자판, PC 키보드)
   - 명령 칸에 숫자나 낱말을 적고 입력(한소네 점자 입력, 보이스오버 빠른 탐색이 켜져 있을 때)
   공통 키: 0 지금 상황 · 점(.) 뒤로 · 더하기(+) 점수판 · 빼기(-) 타자·투수 정보 · 곱하기(*) 키 안내 · 나누기(/) 최근 기록

   화면(S): { q:질문, opts:[{ n:번호, t:이름, s:설명, act(via) }], grid:코스 판, back:뒤로 함수, board:경기 상황판, top:위쪽 HTML, note:처음 보일 메모 }
   go(만드는 함수, via, say): via는 click(단추) · key(키·명령 칸) · auto(자동 진행) · init(처음 열기)
   - click: 결과 글(#say)이나 질문으로 초점을 옮겨 화면 낭독기가 바로 읽게 함
   - key·auto: 초점은 그대로 두고 숨은 알림 칸으로 읽어 줌 */
const UI = { make:null, S:null, say:[], logN:0 };

/* ---------- 뜸 들이는 중계 ----------
   공을 친 결과 문장을 '친 순간'(앞부분)과 '결과'(뒷부분)로 나눔. 앞부분만 먼저 보여 주고 읽은 뒤,
   타구 종류에 맞춘 시간이 지나면 결과와 다음 질문·선택지를 보여 주고 읽음 (그사이 선택지는 숨기고 키도 받지 않음) */
const RESULT_WORD = /(잡습니다|잡아|잡아냅니다|잡아 냅니다|잡혔|아웃|안타|2루타|3루타|홈런|파울|세이프|떨어집니다|빠져나갑니다|넘어갑니다|넘어갔|병살|트리플|정면|처리|실책|놓칩니다|빗나갑니다|희생|맞고|가릅니다|살짝 넘|훌쩍)/;
function splitResult(s){
  const from = Math.max(0, s.lastIndexOf('… ') + 2);
  const m = RESULT_WORD.exec(s.slice(from)); if(!m) return null;
  const at = from + m.index;
  let cut = Math.max(s.lastIndexOf(', ', at), s.lastIndexOf('. ', at), s.lastIndexOf('! ', at), s.lastIndexOf('… ', at));
  if(cut < from - 2) cut = at - 1;
  const head = s.slice(0, cut + 1).trim(), tail = s.slice(cut + 1).trim();
  return head.length > 4 && tail ? { head, tail } : null;
}
function suspend(lines){
  const ms = UI.susp; UI.susp = 0;
  // 자동 시험(Playwright)은 window.__susp를 켠 때만 기다림
  if(!ms || !lines.length || (navigator.webdriver && !window.__susp)) return null;
  let i = lines.findIndex(l => (l.k === 'r' || l.k === 'p') && splitResult(l.s || ''));
  let sp = i >= 0 ? splitResult(lines[i].s) : null;
  // 친 공이 아니면(스트라이크·볼·헛스윙) 공 설명까지만 먼저, 판정은 공이 미트에 들어갈 때
  if(!sp){ i = lines.findIndex(l => (l.k === 'r' || l.k === 'p') && /… ./.test(l.s || '')); if(i < 0) return null; const s0 = lines[i].s, at = s0.indexOf('… ') + 1; sp = { head: s0.slice(0, at), tail: s0.slice(at + 1) }; }
  const out = lines.map((l, j) => j < i ? l : j === i ? { ...l, s: sp.head, tail: sp.tail } : { ...l, after:true });
  return { lines: out, ms, tail: [sp.tail, ...lines.slice(i + 1).map(l => l.s || l)] };
}
function go(make, via = 'init', lines = []){
  if(UI.holdT){ clearTimeout(UI.holdT); UI.holdT = 0; document.documentElement.classList.remove('hold'); }
  // 중계 음성이 끝날 때까지 다음 선택을 받지 않음 (자동 시험은 window.__susp를 켠 때만)
  const lock = UI.castLock && !(navigator.webdriver && !window.__susp) ? UI.castLock : 0; UI.castLock = 0;
  if(UI.castT){ clearTimeout(UI.castT); UI.castT = 0; document.documentElement.classList.remove('castwait'); }
  const sus = suspend(lines || []);
  UI.make = make; UI.say = sus ? sus.lines : lines || []; UI.note = null;
  UI.S = make(); if(UI.say.length || !UI.S.say) UI.S.say = UI.say;
  addStatusOpt(UI.S);
  if(sus) document.documentElement.classList.add('hold');
  render();
  const castNow = UI.castNow; UI.castNow = false;   // 중계 음성이 결과를 말하면 화면 낭독기는 질문만
  const say = castNow ? [] : UI.S.say.filter(l => !l.after).map(l => l.s || l);
  if(lock){
    document.documentElement.classList.add('castwait'); UI.castEnd = performance.now() + lock;
    UI.castT = setTimeout(() => {
      UI.castT = 0; document.documentElement.classList.remove('castwait');
      if(typeof castIdleArm === 'function' && UI.S && UI.S.board) castIdleArm();
      if(castNow && !sus) speak(UI.S.q || '');
      if(via === 'click' && !$('#opts').contains(document.activeElement)) $('#q').focus({ preventScroll:true });
    }, Math.max(lock, sus ? sus.ms : 0) + 50);
  }
  if(sus){
    // 앞부분만 먼저 읽고, 시간이 지나면 결과와 질문
    speak(say.join(' '));
    UI.holdT = setTimeout(() => {
      UI.holdT = 0; document.documentElement.classList.remove('hold');
      speak([...(castNow ? [] : sus.tail), lock && sus.ms < lock ? '' : UI.S.q].filter(Boolean).join(' '));
      if(via === 'click' && !$('#opts').contains(document.activeElement)) $('#q').focus({ preventScroll:true });
    }, sus.ms);
    return;
  }
  const msg = [...say, lock && castNow ? '' : UI.S.q].filter(Boolean).join(' ');
  if(via === 'click'){
    setTimeout(() => { const el = UI.S.focusCmd ? $('#cmd') : say.length ? $('#say') : $('#q'); if(el) el.focus({ preventScroll:false }); }, 40);
    if(SET.voice === 'tts') ttsSay(msg);
  } else if(via === 'key' || via === 'auto') speak(msg);
}
// 같은 화면을 다시 그림 (설정을 바꿨을 때, 설치 단추가 생겼을 때). 초점은 그대로
function rerender(){ if(!UI.make) return; UI.S = UI.make(); if(UI.say.length || !UI.S.say) UI.S.say = UI.say; addStatusOpt(UI.S); render(); }
// 경기 화면에는 언제나 "지금 상황 확인" 단추(0번)를 둠: 아웃·볼카운트·주자·점수를 한 번에 들음
function addStatusOpt(S){
  if(!S.board || typeof G === 'undefined' || !G || S.input) return;
  S.opts = [...(S.opts || []), { n:0, key:'status', t:'지금 상황 확인', s:'점수, 아웃, 볼카운트, 주자 위치, 타자와 투수를 알려 줍니다. 0번 키와 같습니다.', act: v => note(gameStatus(), v) }];
}
function stay(msg){ rerender(); speak(msg); }

function render(){
  const S = UI.S, hadFocus = $('#opts').contains(document.activeElement);
  applySet();
  // 화면 보며 하기의 경기 화면: 그림 + 짧은 결과 한 줄 + 선택지만 한 화면에 (머리줄·글 상황판·기록은 숨김)
  const gg = SET.view === 'gfx' && !!S.board && !!G;
  document.documentElement.classList.toggle('gfxgame', gg);
  // 화면 보며 하기의 메뉴·설정: 따로 꾸밈 (시청각장애인 모드는 그대로)
  const gu = SET.view === 'gfx' && !gg && !S.board;
  document.documentElement.classList.toggle('gfxui', gu);
  document.documentElement.classList.toggle('gfxinput', !!S.input);
  let hero = $('#hero');
  if(gu && S.hero){ if(!hero){ hero = document.createElement('div'); hero.id = 'hero'; hero.setAttribute('aria-hidden', 'true'); hero.innerHTML = '<b>손잡다 야구</b><span>공 하나하나를 고르는 확률 야구</span>'; $('#top').before(hero); } hero.hidden = false; }
  else if(hero) hero.hidden = true;
  document.documentElement.classList.toggle('hashero', gu && !!S.hero);
  $('#top').innerHTML = S.top || '';
  const bs = $('#boardSec');
  if(S.board && typeof boardHTML === 'function' && G){
    bs.hidden = false;
    const keep = SET.view === 'gfx' && typeof gfxRender === 'function' && bs.querySelector('.gfxwrap');
    bs.innerHTML = boardHTML();
    if(SET.view === 'gfx' && typeof gfxRender === 'function'){ if(keep) bs.prepend(keep); gfxRender(G, UI.lastFx || [], UI.lastLines || []); UI.lastFx = []; UI.lastLines = []; }
  }
  else if(S.scene && SET.view === 'gfx' && typeof gfxScene === 'function'){ bs.hidden = false; gfxScene(bs, S.scene); }
  else { bs.hidden = true; bs.innerHTML = ''; if(typeof GX !== 'undefined') GX.scene = null; }
  $('#say').innerHTML = (S.say || []).map(l => `<p class="${l.k ? 'k-' + l.k : ''}${l.after ? ' after' : ''}${l.tail ? ' cur' : ''}">${esc(l.s || l)}${l.tail ? `<span class="tail"> ${esc(l.tail)}</span>` : ''}</p>`).join('');
  // 시청각장애인 모드에서 중계 음성이 켜져 있으면 경기 중 결과 글은 소리로만 (화면 낭독기가 같은 내용을 또 읽지 않게): 지금 내 차례의 질문과 선택지만
  const castOnly = SET.view !== 'gfx' && !!S.board && typeof G !== 'undefined' && G && !G.over && typeof castOn === 'function' && castOn();
  $('#say').hidden = !(S.say || []).length || castOnly;
  if($('#logSec')) $('#logSec').dataset.castOnly = castOnly ? '1' : '';
  // 메모: 화면이 정한 글, 없으면 방금 note()로 띄운 글 (전체화면 전환 같은 다시 그리기에도 남음)
  const nl = S.note || UI.note || [];
  const nt = $('#note'); nt.innerHTML = nl.map(l => `<p>${esc(l)}</p>`).join(''); nt.hidden = !nl.length;
  // 화면 보며 하기: 긴 질문은 '무엇을 할지'(첫 문장 + 마지막 질문)를 크게, 나머지 설명은 작게
  const qs = gg ? (S.q || '').split(/(?<=[.?!])\s+/) : [];
  // 첫 문장(공격·수비·수비 작전 등)은 색 띠, 마지막 질문은 크게, 가운데 설명은 작게
  if(gg && qs.length >= 2) $('#q').innerHTML = `<span class="qchip ${/수비/.test(qs[0]) ? 'def' : /공격/.test(qs[0]) ? 'off' : ''}">${esc(qs[0].replace(/\.$/, ''))}</span> <span class="qt">${esc(qs[qs.length - 1])}</span>${qs.length > 2 ? ` <span class="qd">${esc(qs.slice(1, -1).join(' '))}</span>` : ''}`;
  else $('#q').textContent = S.q || '';
  renderOpts(S);
  if(typeof gstatRender === 'function'){ if(gg) gstatRender(G); else if($('#gstat')) $('#gstat').hidden = true; }
  const ex = $('#extra');
  ex.innerHTML = S.back ? '<button type="button" class="btn back" id="backBtn">뒤로<span class="kh" aria-hidden="true"> (점 키)</span></button>' : '';
  $('#logSec').hidden = !S.board || $('#logSec').dataset.castOnly === '1';
  if(S.board) renderLog();
  if(typeof renderChat === 'function') renderChat(true);
  if(typeof voiceUI === 'function') voiceUI();
  if(typeof crowdSync === 'function') crowdSync();
  if(hadFocus && !$('#opts').contains(document.activeElement)) $('#q').focus();
}
function renderOpts(S){
  const box = $('#opts');
  box.className = 'opts' + (S.grid ? ' grid' : '');
  box.setAttribute('aria-label', S.grid ? '코스 고르기 (스트라이크 존)' : '선택지');
  const want = (S.opts || []).filter(o => !o.hide);
  const have = new Map([...box.children].map(el => [el.dataset.k, el]));
  want.forEach((o, i) => {
    const k = String(o.key || o.n);
    let el = have.get(k);
    if(el) have.delete(k);
    else { el = document.createElement('button'); el.type = 'button'; el.dataset.k = k; }
    // 화면 보며 하기: 메뉴 성격의 선택지(더 보기·지금 상황·맡기기 등)는 아래쪽 작은 단추로
    const minor = document.documentElement.classList.contains('gfxgame') && /더 보기|지금 상황|맡기기|노림수|사인대로|수비 위치|투수 상태|작전:/.test(o.t);
    el.className = 'opt' + (o.cls ? ' ' + o.cls : '') + (minor ? ' minor' : '');
    el.dataset.n = o.n;
    let ico = o.icon ? `<span class="oicon" aria-hidden="true" style="--ix:${o.icon[1] % 4};--iy:${Math.floor(o.icon[1] / 4)};background-image:url(img/${o.icon[0]}.png)"></span>` : '';
    // 화면 보며 하기의 메뉴: 그림 아이콘, "이름: 값"은 이름과 값 알약으로 나눠 보임 (읽는 글은 그대로)
    const gui = document.documentElement.classList.contains('gfxui');
    let title = `<b>${esc(o.t)}</b>`, kind = '';
    if(gui){
      const tm = !ico && typeof TEAMS !== 'undefined' && TEAMS.find(T => o.t.startsWith(T.name) || o.t.startsWith(T.short));
      if(tm) ico = `<span class="gico tm" aria-hidden="true" style="--tc:${tm.color}">${esc(tm.short[0])}</span>`;
      if(!ico){ const g = uiGlyph(o.t); if(g) ico = `<span class="gico g-${g[0]}" aria-hidden="true">${g[1]}</span>`; }
      if(!ico) kind += ' noico';
      const m = /^([^:]{2,24}):\s*(.+)$/.exec(o.t);
      if(m){ const v = m[2], on = /^(켬|켜짐)$/.test(v), off = /^(끔|꺼짐|읽지 않음)$/.test(v); kind = v.length > 8 ? ' set long' : ' set'; title = `<b>${esc(m[1])}<span class="sr-only">: </span></b><span class="val${on ? ' on' : off ? ' off' : ''}">${esc(v)}</span>`; }
    }
    const html = `<span class="num">${o.n}<span class="sr-only">번. </span></span>${ico}<span class="tx">${title}${o.s ? `<span class="sr-only">. </span><small>${esc(o.s)}</small>` : ''}</span>`;
    if(kind) el.className += kind;
    if(el.__h !== html){ el.innerHTML = html; el.__h = html; }
    if(box.children[i] !== el) box.insertBefore(el, box.children[i] || null);
  });
  have.forEach(el => el.remove());
  // 화면 보며 하기 메뉴: 설정(이름: 값)이 많으면 한 줄에 하나, 아니면 바둑판
  const sets = box.querySelectorAll('.opt.set').length;
  box.classList.toggle('setlist', sets * 2 >= want.length && sets > 0);
}
// 중계 기록: 새 줄만 덧붙이고 최근 80줄만 둠
function renderLog(){
  const ol = $('#log');
  if(!G){ ol.innerHTML = ''; UI.logN = 0; return; }
  const shown = G.log.filter(l => l.k !== 'd' || SET.dice);
  if(UI.logG !== G || ol.__dice !== SET.dice || !ol.children.length){ ol.innerHTML = ''; UI.logN = 0; UI.logG = G; ol.__dice = SET.dice; }
  const fresh = shown.filter(l => l.n > UI.logN);
  fresh.slice(-80).forEach(l => { const li = document.createElement('li'); li.className = 'k-' + l.k; li.textContent = l.s; ol.appendChild(li); });
  if(fresh.length) UI.logN = fresh[fresh.length - 1].n;
  while(ol.children.length > 80) ol.removeChild(ol.firstChild);
}
// 보이는 문장만 (판정 과정은 설정에 따라)
// 감독 모드에서 '타석 결과만' 중계일 때는 공 하나하나의 문장과 앞선 타자 소개를 빼고 읽음
const visible = lines => {
  let L = (lines || []).filter(l => l.k !== 'd' || SET.dice);
  if(typeof G !== 'undefined' && G && G.mode === 'manager' && !SET.mgrPitch){
    // 타석 결과는 "타자 이름: 결과"로 줄이고, 공 하나하나·앞선 타자 소개·상대 수비 위치 변경은 뺌 (중계 기록에는 모두 남음)
    const lastN = L.map(l => l.k).lastIndexOf('n');
    L = L.filter((l, i) => l.k !== 'p' && (l.k !== 'n' || i === lastN) && !/수비 위치 변경/.test(l.s))
      .map(l => l.k === 'r' && l.b && /^(제\d+구|주사위)/.test(l.s) ? { ...l, s: `${l.b}: ${l.s.replace(/^제\d+구, [^.]+?공\.\s*/, '')}` } : l);
  }
  return L;
};

/* ---------- 고르기 ---------- */
function choose(n, via){
  const o = (UI.S.opts || []).find(x => !x.hide && String(x.n) === String(n));
  if(!o){ speak(`${n}번은 지금 고를 수 없습니다.`); return; }
  stopAutoPlay();
  o.act(via);
}
function back(via){
  if(UI.S && UI.S.back){ stopAutoPlay(); UI.S.back(via); }
  else speak('뒤로 갈 곳이 없습니다.');
}
// 메모: 상황·점수판 같은 정보를 결과 글 아래에 보여 주고 읽어 줌
function note(lines, via){
  UI.note = lines;
  const nt = $('#note');
  nt.innerHTML = lines.map(l => `<p>${esc(l)}</p>`).join(''); nt.hidden = false;
  if(via === 'click'){ setTimeout(() => nt.focus(), 40); if(SET.voice === 'tts') ttsSay(lines.join(' ')); }
  else speak(lines.join(' '));
}
function optionsText(){
  return (UI.S.opts || []).filter(o => !o.hide).map(o => `${o.n}번 ${o.t}`).join(', ');
}
const KEY_HELP = [
  '숫자 1부터 9: 선택지 고르기.',
  '0: 지금 상황 듣기. 경기 화면마다 있는 "지금 상황 확인" 단추와 같습니다. 점수, 아웃, 볼카운트, 주자 위치와 이름, 타자와 투수를 알려 줍니다.',
  '점(.) 또는 백스페이스: 뒤로.',
  '더하기(+): 점수판 듣기.',
  '빼기(-): 지금 타자와 투수 정보 듣기.',
  '곱하기(*): 이 키 안내.',
  '나누기(/): 최근 기록 듣기.',
  '명령 칸에는 숫자나 낱말(상황, 점수, 선수, 기록, 도움, 뒤로, 또는 선택지 이름)을 적고 입력합니다.',
];
function keyCmd(k, via){
  if(UI.S.input && /^[0-9]$/.test(k)) return UI.S.onDigit(k, via);   // 방 코드처럼 숫자를 입력하는 화면
  if(/^[1-9]$/.test(k)) return choose(k, via);
  if(k === '.') return back(via);
  if(k === '0') return note(typeof gameStatus === 'function' && G && UI.S.board ? gameStatus() : [`${UI.S.q || ''}`, optionsText() + '.'], via);
  if(k === '*') return note(KEY_HELP, via);
  if(G && UI.S.board){
    if(k === '+') return note(scoreboard(G), via);
    if(k === '-') return note(whoInfo(), via);
    if(k === '/') return note(recentLines(8), via);
  } else if('+-/'.includes(k)) return note(['경기 중에만 쓰는 키입니다.'], via);
}
const WORDS = { '상황':'0', '점수':'+', '점수판':'+', '선수':'-', '정보':'-', '도움':'*', '도움말':'*', '키':'*', '?':'*', '기록':'/', '뒤로':'.', '취소':'.' };
function textCmd(v){
  v = v.trim(); if(!v) return;
  if(/^[0-9.+\-*/]$/.test(v)) return keyCmd(v, 'key');
  if(UI.S.onText) return UI.S.onText(v, 'key');   // 이름·방 코드·채팅처럼 글을 받는 화면
  if(WORDS[v]) return keyCmd(WORDS[v], 'key');
  const ops = (UI.S.opts || []).filter(o => !o.hide);
  const exact = ops.find(x => x.t === v);
  if(exact) return choose(exact.n, 'key');
  // 온라인 대전: 명령이 아닌 글은 채팅으로 보냄
  if(typeof NET !== 'undefined' && NET.on){ netChat(v); speak('채팅을 보냈습니다.'); return; }
  const o = ops.find(x => x.t.replace(/\s/g, '').includes(v.replace(/\s/g, '')));
  if(o) return choose(o.n, 'key');
  speak(`알아듣지 못했습니다. 번호를 입력해 주세요. ${optionsText()}.`);
}

/* ---------- 입력 연결 ---------- */
document.addEventListener('click', e => {
  const o = e.target.closest && e.target.closest('#opts .opt');
  if(o){
    choose(o.dataset.n, 'click');
    return;
  }
  if(e.target.closest && e.target.closest('#backBtn')){ back('click'); return; }
  if(e.target.closest && e.target.closest('#menuBtn')){ stopAutoPlay(); if(typeof openMenu === 'function') openMenu('click'); }
});
function keyName(e){
  if(e.code && /^Numpad[0-9]$/.test(e.code)) return e.code.slice(6);
  if(/^[0-9]$/.test(e.key)) return e.key;
  if(e.code === 'NumpadDecimal' || e.key === '.' || e.key === 'Backspace' || e.key === 'Escape') return '.';
  if(e.key === '+' || e.code === 'NumpadAdd') return '+';
  if(e.key === '-' || e.code === 'NumpadSubtract') return '-';
  if(e.key === '*' || e.code === 'NumpadMultiply') return '*';
  if(e.key === '/' || e.code === 'NumpadDivide') return '/';
  return null;
}
document.addEventListener('keydown', e => {
  const cl = document.documentElement.classList;
  if(cl.contains('hold') && !e.target.closest('input, textarea')) { e.preventDefault(); return; }   // 결과를 기다리는 동안은 고르지 않음 (중계 중에는 골라도 됨: 중계를 끊고 바로 진행)   // 결과를 기다리는 동안은 고르지 않음
  if(dlgOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target, tag = t && t.tagName;
  if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  const k = keyName(e);
  if(!k) return;
  e.preventDefault();
  keyCmd(k, 'key');
});
function bindCmd(){
  const inp = $('#cmd');
  inp.addEventListener('input', () => {
    if(!SET.quick) return;
    const v = inp.value.trim();
    if(/^[0-9.+\-*/]$/.test(v)){ inp.value = ''; keyCmd(v, 'key'); }
  });
  inp.addEventListener('keydown', e => { if(e.key === 'Escape'){ e.preventDefault(); inp.value = ''; back('key'); } });
  $('#cmdForm').addEventListener('submit', e => { e.preventDefault(); const v = inp.value; inp.value = ''; textCmd(v); });
}

// 화면 보며 하기의 메뉴 아이콘 (선택지 이름으로 고름): [색 이름, svg]
const UI_GLYPHS = [
  [/^간단 모드/, 'g', '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.3"/><circle cx="15" cy="15" r="1.3"/><circle cx="15" cy="9" r="1.3"/><circle cx="9" cy="15" r="1.3"/>'],
  [/^정밀 모드/, 'y', '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>'],
  [/^감독 모드/, 'o', '<rect x="5.5" y="4.5" width="13" height="16" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 13.5h7M8.5 17h4"/>'],
  [/^공 하나씩|^지금 경기 이어|^새 경기/, 'b', '<circle cx="12" cy="12" r="8.5"/><path d="M7 5.5c2 2 2.8 4 2.8 6.5S9 16.5 7 18.5M17 5.5c-2 2-2.8 4-2.8 6.5s.8 4.5 2.8 6.5"/>'],
  [/^타석 한 번/, 'p', '<path d="M5 19 16.5 7.5a2.3 2.3 0 0 1 3.2 3.2L8.2 22.2"/><circle cx="6.5" cy="7" r="2.2"/>'],
  [/혼자|이어 하기/, 'b', '<circle cx="12" cy="7" r="3.5"/><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/>'],
  [/둘이/, 'b', '<circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="8" r="3"/><path d="M2.5 19c0-3.3 2.4-5.4 5.5-5.4s5.5 2.1 5.5 5.4M11.5 19c.3-3 2.3-5.4 5-5.4 3 0 5 2.1 5 5.4"/>'],
  [/온라인/, 'g', '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.5 3.8 5.3 3.8 8.5s-1.2 6-3.8 8.5c-2.6-2.5-3.8-5.3-3.8-8.5s1.2-6 3.8-8.5z"/>'],
  [/리그|시즌/, 'y', '<path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5A3 3 0 0 0 7 10.5M17 6h3v1.5a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4"/>'],
  [/육성|선수/, 'o', '<path d="M12 3.5l2.4 5 5.4.6-4 3.7 1.1 5.4L12 15.5l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>'],
  [/관전|지켜/, 'p', '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'],
  [/설정|더 보기/, 's', '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/>'],
  [/설치/, 'g', '<path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5M4.5 17.5v2h15v-2"/>'],
  [/게임 방법|키 안내|도움/, 'p', '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6M12 16.6v.4"/>'],
  [/화면 방식|화면 색/, 'b', '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M9 20h6M12 16.5V20"/>'],
  [/글자/, 'b', '<path d="M4 18 8.5 6h1L14 18M5.7 14h6.6M15 18v-6.5M15 14.5c0-1.8 1.2-3 2.8-3s2.7 1.2 2.7 3V18"/>'],
  [/읽어 주기|음성 빠르기|채팅 읽어/, 'p', '<path d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11"/>'],
  [/중계/, 'o', '<rect x="8.5" y="3" width="7" height="11" rx="3.5"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'],
  [/효과음|관중|소리 시험/, 'g', '<path d="M9 17.5V5.5l10-2v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>'],
  [/진동/, 's', '<rect x="8" y="3.5" width="8" height="17" rx="1.8"/><path d="M4.5 8v8M2 10v4M19.5 8v8M22 10v4"/>'],
  [/전체화면/, 'b', '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'],
  [/난이도/, 'y', '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/>'],
  [/판정 과정|주사위/, 'p', '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/><circle cx="12" cy="12" r="1.2"/>'],
  [/코스|정밀 모드/, 'y', '<rect x="5" y="5" width="14" height="14"/><path d="M9.7 5v14M14.3 5v14M5 9.7h14M5 14.3h14"/>'],
  [/명령 칸|숫자/, 's', '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>'],
  [/자동 재생|간격/, 'g', '<circle cx="12" cy="12" r="8.5"/><path d="M10 8.5v7l5.5-3.5z"/>'],
  [/지우기/, 'r', '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>'],
];
function uiGlyph(t){
  const g = UI_GLYPHS.find(([re]) => re.test(t));
  return g ? [g[1], `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${g[2]}</svg>`] : null;
}
