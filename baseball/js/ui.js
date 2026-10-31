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

function go(make, via = 'init', lines = []){
  UI.make = make; UI.say = lines || []; UI.note = null;
  UI.S = make(); if(UI.say.length || !UI.S.say) UI.S.say = UI.say;
  addStatusOpt(UI.S);
  render();
  const say = UI.S.say.map(l => l.s || l);
  const msg = [...say, UI.S.q].filter(Boolean).join(' ');
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
  $('#say').innerHTML = (S.say || []).map(l => `<p class="${l.k ? 'k-' + l.k : ''}">${esc(l.s || l)}</p>`).join('');
  $('#say').hidden = !(S.say || []).length;
  // 메모: 화면이 정한 글, 없으면 방금 note()로 띄운 글 (전체화면 전환 같은 다시 그리기에도 남음)
  const nl = S.note || UI.note || [];
  const nt = $('#note'); nt.innerHTML = nl.map(l => `<p>${esc(l)}</p>`).join(''); nt.hidden = !nl.length;
  // 화면 보며 하기: 긴 질문은 '무엇을 할지'(첫 문장 + 마지막 질문)를 크게, 나머지 설명은 작게
  const qs = gg ? (S.q || '').split(/(?<=[.?!])\s+/) : [];
  if(gg && qs.length > 2) $('#q').innerHTML = `<span class="qt">${esc(qs[0])} ${esc(qs[qs.length - 1])}</span> <span class="qd">${esc(qs.slice(1, -1).join(' '))}</span>`;
  else $('#q').textContent = S.q || '';
  renderOpts(S);
  if(typeof gstatRender === 'function'){ if(gg) gstatRender(G); else if($('#gstat')) $('#gstat').hidden = true; }
  const ex = $('#extra');
  ex.innerHTML = S.back ? '<button type="button" class="btn back" id="backBtn">뒤로<span class="kh" aria-hidden="true"> (점 키)</span></button>' : '';
  $('#logSec').hidden = !S.board;
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
    el.className = 'opt' + (o.cls ? ' ' + o.cls : '');
    el.dataset.n = o.n;
    const html = `<span class="num">${o.n}<span class="sr-only">번. </span></span><span class="tx"><b>${esc(o.t)}</b>${o.s ? `<span class="sr-only">. </span><small>${esc(o.s)}</small>` : ''}</span>`;
    if(el.__h !== html){ el.innerHTML = html; el.__h = html; }
    if(box.children[i] !== el) box.insertBefore(el, box.children[i] || null);
  });
  have.forEach(el => el.remove());
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
  if(o){ choose(o.dataset.n, 'click'); return; }
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
