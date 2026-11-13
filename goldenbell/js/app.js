'use strict';
/* ===================== 점자 골든벨: 상태 · 화면 · 동작 ===================== */
const DEF_CFG = { ox:60, choice:120, short:60, timeup:'both', revealSfx:true, vol:0.8 };
const DEF_LIVE = { mode:'banner', theme:'night', qi:0, showTimer:true, showAuthor:true, autoTimer:false, scale:1, strip:'m', stripLogos:false,
  timer:{ dur:60, endAt:0, remain:60, running:false }, ann:null, intro:0, title:{ text:'', sub:'' }, award:{ i:0, show:false },
  music:null, sfx:null, cfg:{ ...DEF_CFG }, rev:0 };
// 콘티의 시상 순서 (시상 탭에서 바꿀 수 있음)
const DEFAULT_AWARDS = [
  { rank:'4', title:'점자사랑상', prize:'상장 · 문화상품권 3만원' },
  { rank:'3', title:'우수상', prize:'상장 · 신세계상품권 5만원' },
  { rank:'2', title:'최우수상', prize:'상장 · 신세계상품권 7만원' },
  { rank:'11', title:'점자친구상', prize:'상장 · 한글 점자의 날(11월 4일) 기념 특별상' },
  { rank:'5-10', title:'5등 ~ 10등', prize:'작은 선물' },
  { rank:'1', title:'대상', prize:'상장 · 신세계상품권 10만원' },
];
const TITLE_PRESETS = [
  ['곧 시작합니다', '자리에 앉아 OX 팻말과 1234 팻말을 준비해 주세요'],
  ['연습 게임', 'OX 팻말과 1234 팻말을 들어 봅시다'],
  ['1부 시작', ''],
  ['이벤트 퀴즈', '활동지원사·통역사·자원봉사자 여러분을 위한 퀴즈'],
  ['쉬는 시간', ''],
  ['댄스 타임!', ''],
  ['2부 시작', ''],
  ['채점 중입니다', '화장실에 다녀오시고 만족도 조사에 참여해 주세요'],
  ['시상식', ''],
  ['감사합니다', '함께해 주신 모든 분께 감사드립니다'],
];
const S = {
  live:clone(DEF_LIVE),
  qs:{ list:[], rev:0 },
  seats:{ rows:4, cols:5, people:[], map:{}, adjust:{}, rev:0 },
  banner:{ l1:'제1회 시청각장애인', l2:'점자 골든벨', sub:'손잡다장애인자립생활센터', info:'', items:[], rev:0 },
  bimg:{ img:'', rev:0 }, logos:{},
  marks:{}, favs:[], devices:{}, staffs:{}, assign:{}, done:{}, awards:null,
};
let ROLE = '', QS_DENIED = false;
const ME = { master:false, staff:false, known:false, name:ls.get('name', '') };
const myName = () => ROLE === 'host' ? '진행자' : (ME.name || '직원');

/* ---------- 문제 · 점수 계산 ---------- */
const curQ = () => S.qs.list[Math.max(0, Math.min(S.qs.list.length - 1, S.live.qi))] || null;
const peopleMap = () => { const m = {}; S.seats.people.forEach(p => m[p.id] = p); return m; };
function seatOf(){ const o = {}; for(const [k, pid] of Object.entries(S.seats.map || {})){ const [r, c] = k.split('-').map(Number); if(r < S.seats.rows && c < S.seats.cols) o[pid] = { k, r, c }; } return o; }
const seatLabel = s => s ? `${s.r + 1}줄 ${s.c + 1}번` : '자리 없음';
const markFor = (q, pid) => q && S.marks[pid] ? S.marks[pid][q.id] || null : null;
const isMarked = m => !!(m && m.by && Object.keys(m.by).length);
const hasParts = () => S.qs.list.some(q => q.kind === 'main' && q.part === '2');
// i번째 문제가 같은 구분 안에서 몇 번째인지 (본문제는 연습·이벤트를 빼고 셈)
function qMeta(i){
  const q = S.qs.list[i]; if(!q) return { n:0, total:0 };
  let n = 0, total = 0;
  S.qs.list.forEach((x, j) => { if(x.kind === q.kind){ total++; if(j <= i) n++; } });
  return { n, total };
}
function qTitle(i){
  const q = S.qs.list[i]; if(!q) return '';
  const m = qMeta(i);
  if(q.kind === 'practice') return '연습 문제';
  if(q.kind === 'event') return '이벤트 퀴즈';
  if(q.kind === 'final') return `결승 문제 ${m.n}`;
  return `${hasParts() ? q.part + '부 · ' : ''}${m.n}번 문제`;
}
function mainDone(){ let n = 0; S.qs.list.forEach((q, j) => { if(q.kind === 'main' && j <= S.live.qi) n++; }); return n; }
function scoreParts(){
  const out = {}; const kindOf = {}, partOf = {};
  S.qs.list.forEach(q => { kindOf[q.id] = q.kind; partOf[q.id] = q.part; });
  S.seats.people.forEach(p => {
    const o = { s:Number(S.seats.adjust?.[p.id] || 0), p1:0, p2:0, tb:0 };
    const ms = S.marks[p.id] || {};
    for(const [qid, m] of Object.entries(ms)){
      if(!isMarked(m) || !kindOf[qid]) continue;
      if(kindOf[qid] === 'main'){ o.s++; if(partOf[qid] === '2') o.p2++; else o.p1++; }
      else if(kindOf[qid] === 'final') o.tb++;
    }
    out[p.id] = o;
  });
  return out;
}
function scores(){ const sp = scoreParts(), o = {}; for(const k in sp) o[k] = sp[k].s; return o; }
// 순위: 본문제 점수 → 결승 점수 순. 둘 다 같으면 같은 등수(동점)
function rankRows(){
  const sp = scoreParts(), so = seatOf();
  const rows = S.seats.people.map(p => ({ p, s:sp[p.id].s, tb:sp[p.id].tb, p1:sp[p.id].p1, p2:sp[p.id].p2, seat:so[p.id] }));
  const pos = r => r.seat ? r.seat.r * 100 + r.seat.c : 9999;
  rows.sort((a, b) => b.s - a.s || b.tb - a.tb || pos(a) - pos(b));
  rows.forEach(r => { r.rank = 1 + rows.filter(x => x.s > r.s || (x.s === r.s && x.tb > r.tb)).length; });
  rows.forEach(r => { r.tied = rows.filter(x => x.rank === r.rank).length > 1; });
  return rows;
}
function introList(){
  const pm = peopleMap(), out = [], seen = new Set();
  for(let r = 0; r < S.seats.rows; r++) for(let c = 0; c < S.seats.cols; c++){ const p = pm[S.seats.map[r + '-' + c]]; if(p && !seen.has(p.id)){ seen.add(p.id); out.push({ p, seat:{ r, c } }); } }
  S.seats.people.forEach(p => { if(!seen.has(p.id)) out.push({ p, seat:null }); });
  return out;
}
const awardsList = () => (S.awards && S.awards.length ? S.awards : DEFAULT_AWARDS);
function parseRank(s){ const m = String(s || '').match(/^\s*(\d+)\s*(?:[-~]\s*(\d+))?\s*$/); if(!m) return null; const a = +m[1], b = m[2] ? +m[2] : a; return [Math.min(a, b), Math.max(a, b)]; }
function awardSteps(){
  const rows = rankRows();
  return awardsList().map(a => {
    const rg = parseRank(a.rank) || [0, -1];
    return { ...a, rg, rankLabel:rg[0] === rg[1] ? `${rg[0]}등` : `${rg[0]}등 ~ ${rg[1]}등`, people:rows.filter(r => r.rank >= rg[0] && r.rank <= rg[1] && rows.length) };
  });
}
// 시상에 걸린 동점: 한 사람만 받는 상에 여러 명이거나, 그 등수에 아무도 없음(앞 등수가 동점)
function tieWarnings(){
  const out = [];
  awardSteps().forEach(a => {
    if(a.rg[0] === a.rg[1] && a.people.length > 1) out.push(`${a.rankLabel} ${a.title}: ${a.people.map(r => r.p.name).join(', ')} (${a.people[0].s}점 동점)`);
    if(a.rg[0] === a.rg[1] && !a.people.length && S.seats.people.length >= a.rg[0]) out.push(`${a.rankLabel} ${a.title}: 앞 등수가 동점이라 ${a.rg[0]}등이 비어 있습니다`);
  });
  return out;
}

/* ---------- 담당 자리 ---------- */
const STAFF_COLORS = ['#5cc8f5', '#3ccf8e', '#f28c4e', '#c58af7', '#f26ba8', '#9ad84a', '#5a8dff', '#e8d44d', '#4fd6c9', '#ff8f8f'];
function staffUids(){ const s = new Set(Object.keys(S.staffs || {})); Object.values(S.assign || {}).forEach(u => u && s.add(u)); return Array.from(s).sort(); }
const staffColor = uid => STAFF_COLORS[Math.max(0, staffUids().indexOf(uid)) % STAFF_COLORS.length];
function staffName(uid){ const a = S.staffs[uid], d = S.devices[uid]; return (a && a.name) || (d && d.name) || '직원'; }
const myKeys = () => Object.keys(S.assign || {}).filter(k => S.assign[k] === (DB && DB.uid));
function keysText(keys){
  if(!keys.length) return '';
  const byRow = {};
  keys.forEach(k => { const [r, c] = k.split('-').map(Number); (byRow[r] ||= []).push(c); });
  return Object.keys(byRow).map(Number).sort((a, b) => a - b).map(r => { const cs = byRow[r].sort((a, b) => a - b); return cs.length === S.seats.cols ? `${r + 1}줄 전체` : `${r + 1}줄 ${cs.map(c => c + 1).join('·')}번`; }).join(', ');
}
const zoneText = () => ROLE === 'staff' ? keysText(myKeys()).slice(0, 20) : '';
function canMark(pid){
  if(ROLE === 'host' && ME.master) return true;
  if(!ME.staff && !ME.master) return false;
  const s = seatOf()[pid]; return !!s && S.assign[s.k] === DB.uid;
}
// 서버 규칙이 '직원은 맡은 사람만 체크'를 확인할 수 있게, 기기별 맡은 사람 목록(zonep)을 진행자 기기가 만들어 둠
let lastZonep = null;
function syncZonep(){
  if(!ME.master || ROLE !== 'host' || !DB) return;
  const z = {};
  for(const [k, u] of Object.entries(S.assign || {})){ const pid = S.seats.map[k]; if(pid && u){ (z[u] ||= {})[pid] = true; } }
  const js = JSON.stringify(z); if(js === lastZonep) return; lastZonep = js;
  save('zonep', () => Object.keys(z).length ? z : null);
}

/* ===================== 저장 ===================== */
const W = {};
function save(path, get){
  const w = W[path] || (W[path] = { busy:false, dirty:false }); w.get = get; if(!DB) return;
  if(w.busy){ w.dirty = true; return; } w.busy = true;
  (async () => { do{ w.dirty = false; const d = w.get(); try{ await (d == null ? DB.remove(path) : DB.set(path, d)); }catch(e){ writeErr(e); } }while(w.dirty); w.busy = false; })();
}
const deb = {};
function saveSoon(path, get, ms){ clearTimeout(deb[path]); deb[path] = setTimeout(() => save(path, get), ms || 450); }
let lastErr = 0;
function writeErr(e){
  console.warn(e); const t = now(); if(t - lastErr < 2500) return; lastErr = t;
  toast(isDenied(e) ? (RULES_OLD ? '서버 규칙이 예전 것이라 저장하지 못했습니다. 새 규칙 파일을 Firebase에 다시 게시해 주세요.' : '이 기기는 바꿀 권한이 없습니다. 진행자 비밀번호로 들어오거나 직원 승인을 받아 주세요.') : '저장하지 못했습니다. 인터넷 연결을 확인해 주세요.');
}
function setLive(patch){
  if(!ME.master){ toast('진행자 기기에서만 화면을 넘길 수 있습니다.'); return; }
  const prev = S.live;
  S.live = { ...S.live, ...patch, rev:now() };
  screenTransitions(prev, S.live);
  schedule(); save('live', () => S.live);
}
let prevLiveSeen = null;
function applyLive(d){
  if(!d) return;
  if((d.rev || 0) < (S.live.rev || 0)) return;
  const prev = S.live;
  const a = d.ann && d.ann.text ? d.ann : null;
  if(ROLE === 'screen' && a && a.id !== lastAnnId){ if(lastAnnId !== '' && a.chime && srvNow() - (a.at || 0) < 15000) SND.chime(); }
  lastAnnId = a ? a.id : (lastAnnId === '' ? '-' : lastAnnId);
  S.live = { ...clone(DEF_LIVE), ...d, ann:a, timer:{ ...DEF_LIVE.timer, ...(d.timer || {}) }, cfg:{ ...DEF_CFG, ...(d.cfg || {}) },
    title:{ text:'', sub:'', ...(d.title || {}) }, award:{ i:0, show:false, ...(d.award || {}) } };
  if(prevLiveSeen) screenTransitions(prev, S.live);
  prevLiveSeen = true;
  schedule();
}
// 프로젝터 창: 화면이 바뀌는 순간의 소리 (정답 발표 → '정답은~'·두구두구, 시상 발표 → 팡파르, 음악 켜고 끄기, 효과음 시험)
function screenTransitions(p, n){
  if(ROLE !== 'screen' || !p) return;
  if(n.mode === 'answer' && p.mode === 'question' && p.qi === n.qi && n.cfg.revealSfx){
    const dur = sfxHas('reveal') ? sfxPlay('reveal') : SND.drumroll(1.6);
    HOLD.until = Date.now() + dur * 1000 + 120; HOLD.qi = n.qi;
    setTimeout(() => schedule(), dur * 1000 + 150);
  }
  if(n.mode !== 'answer') HOLD.until = 0;
  if(n.mode === 'award' && n.award.show && !(p.mode === 'award' && p.award.show && p.award.i === n.award.i)) SND.fanfare();
  if(n.sfx && n.sfx.id && (!p.sfx || p.sfx.id !== n.sfx.id) && srvNow() - (n.sfx.at || 0) < 10000){
    if(n.sfx.key === 'bell') SND.bell(); else if(n.sfx.key === 'drum') SND.drumroll(1.6); else if(n.sfx.key === 'chime') SND.chime(); else sfxPlay(n.sfx.key);
  }
  musicFollow();
}
function saveQs(){ S.qs.rev = now(); saveSoon('questions', () => ({ list:S.qs.list, rev:S.qs.rev }), 400); schedule('noEditor'); }
function saveSeats(){ S.seats.rev = now(); saveSoon('seats', () => ({ rows:S.seats.rows, cols:S.seats.cols, people:S.seats.people, map:S.seats.map, adjust:S.seats.adjust, rev:S.seats.rev }), 300); syncZonep(); schedule('noTable'); }
function saveBanner(){ S.banner.rev = now(); saveSoon('banner', () => ({ ...S.banner, items:S.banner.items || [] }), 400); schedule('noBannerForm'); }
function saveAssign(){ save('assign', () => Object.keys(S.assign).length ? S.assign : null); syncZonep(); schedule(); }
function saveAwards(){ save('awards', () => ({ list:S.awards || DEFAULT_AWARDS })); schedule(); }

/* ===================== 받아 오기 ===================== */
const SUBS = { qs:null, host:[] };
let RULES_MISSING = false, RULES_OLD = false;
function subscribeBase(){
  // 규칙 버전 확인: rv3 는 3판 규칙에만 읽기가 열려 있음 (못 읽으면 예전 규칙이 게시돼 있음)
  DB.on('rv3', () => { RULES_OLD = false; }, e => { if(isDenied(e)){ RULES_OLD = true; if(!$('#sheet').hidden && $('#mForm')) openSheet(rulesMissingHTML()); schedule(); } });
  // live 는 로그인한 모든 기기가 읽을 수 있어야 함: 못 읽으면 서버 규칙을 아직 게시하지 않은 것
  DB.on('live', d => { RULES_MISSING = false; applyLive(d); }, e => { if(isDenied(e)){ RULES_MISSING = true; rulesNotice(); } });
  DB.on('seats', d => { if(d && (d.rev || 0) >= S.seats.rev){ S.seats = { rows:d.rows || 4, cols:d.cols || 5, people:asList(d.people).map(p => ({ id:String(p.id), name:String(p.name || '') })), map:clone(d.map || {}), adjust:clone(d.adjust || {}), rev:d.rev || 0 }; syncZonep(); schedule(); } });
  DB.on('banner', d => { if(d && (d.rev || 0) >= S.banner.rev){ S.banner = { ...S.banner, ...d, items:asList(d.items).map(normBI) }; schedule(); } });
  DB.on('bannerimg', d => { if(!d){ if(!S.bimg.img) return; S.bimg = { img:'', rev:0 }; schedule(); return; } if((d.rev || 0) >= S.bimg.rev){ S.bimg = { img:d.img || '', rev:d.rev || 0 }; schedule(); } });
  DB.on('logos', d => { const o = {}; Object.entries(d || {}).forEach(([k, v]) => { if(v && v.img) o[k] = v.img; }); S.logos = o; schedule(); }, () => {});
  DB.on('marks', d => { S.marks = d || {}; schedule(); });
  DB.on('favs', d => { S.favs = asList(d && d.list).map(String); schedule(); });
  DB.on('assign', d => { S.assign = d || {}; syncZonep(); schedule(); }, () => {});
  DB.on('awards', d => { S.awards = d && d.list ? asList(d.list).map(a => ({ rank:String(a.rank || ''), title:String(a.title || ''), prize:String(a.prize || '') })) : null; schedule(); }, () => {});
}
function onRoleChange(){
  // 문제(정답 포함)·체크 끝 표시는 진행자·직원 기기만 받음
  if(SUBS.qs){ SUBS.qs.forEach(f => f()); SUBS.qs = null; }
  QS_DENIED = false;
  if(ME.master || ME.staff){
    SUBS.qs = [
      DB.on('questions', d => { QS_DENIED = false; if(d && (d.rev || 0) >= S.qs.rev){ S.qs = { list:asList(d.list).map(normQ), rev:d.rev || 0 }; schedule(); } else if(!d){ S.qs = { list:[], rev:0 }; schedule(); } }, e => { if(isDenied(e)){ QS_DENIED = true; schedule(); } }),
      DB.on('done', d => { S.done = d || {}; schedule(); }, () => {}),
    ];
  }else{ S.qs = { list:[], rev:0 }; QS_DENIED = true; }
  SUBS.host.forEach(f => f()); SUBS.host = [];
  if(ME.master){
    SUBS.host.push(DB.on('devices', d => { S.devices = d || {}; schedule(); }));
    SUBS.host.push(DB.on('staffs', d => { S.staffs = d || {}; schedule(); }, () => {}));
  }
  radioSubscribe();
  pushPresence();
  syncZonep();
  if(ROLE) ensureAccess(ROLE);
  schedule();
}
function pushPresence(){
  if(!DB) return;
  const v = { name:(ROLE === 'host' ? '진행자' : ROLE === 'screen' ? '프로젝터' : ME.name || '이름 없음').slice(0, 20), role:ROLE || 'pick', zone:zoneText(), at:srvNow(), master:ME.master, staff:ME.staff };
  if(ROLE === 'screen') v.sfx = Object.keys(SFX.files).join(',');
  DB.presence(v).catch(() => {});
}
function onNetChange(){
  if(RULES_MISSING && !DEMO) return rulesNotice();
  const ok = DB && DB.st.connected;
  $$('.pill.net').forEach(el => { el.className = 'pill net ' + (DEMO ? 'warn' : ok ? 'ok' : 'bad'); el.textContent = DEMO ? '연습 모드' : ok ? '연결됨' : '연결 끊김 · 다시 연결 중'; });
  if(typeof radioRender === 'function') radioRender();
}

/* ===================== 들어오기 (진행자·직원) ===================== */
function rulesMissingHTML(){
  return `<h3>${RULES_OLD && !RULES_MISSING ? '서버 규칙을 새 것으로 한 번 더 게시해 주세요' : '서버 준비가 아직 안 됐습니다'}</h3>
    <p>${RULES_OLD && !RULES_MISSING ? '지금 게시된 골든벨 규칙은 예전 것이라 새 기능(담당 자리·후원사 로고·시상 등)이 저장되지 않습니다. 아래처럼 새 규칙 파일을 다시 붙여 넣고 게시해 주세요.' : '골든벨용 서버 규칙을 Firebase에 한 번 게시해야 진행자 비밀번호를 정하고 쓸 수 있습니다. 가을운동회 때와 같은 곳입니다.'}</p>
    <ol>
      <li>PC에서 <b>console.firebase.google.com</b>에 들어가 <b>handscil-sports</b> 프로젝트를 엽니다.</li>
      <li>왼쪽 <b>빌드 → Realtime Database → 규칙</b> 탭을 엽니다.</li>
      <li>안의 내용을 모두 지우고, 깃허브 저장소의 <b>sports-day/database.rules.json</b> 내용을 그대로 붙여 넣은 뒤 <b>게시</b>를 누릅니다. (운동회·야구 규칙도 함께 들어 있어 그대로 유지됩니다)</li>
      <li>이 화면을 새로 고침합니다.</li>
    </ol>
    <p class="muted small">규칙 파일 주소: github.com/handscil01-afk/Sungmo/blob/main/sports-day/database.rules.json</p>
    <div class="row"><button class="btn" data-act="reload">새로 고침</button><div class="sp"></div><button class="btn primary" data-close>닫기</button></div>`;
}
function loginMasterSheet(next){
  if(RULES_MISSING && !DEMO){ openSheet(rulesMissingHTML()); return; }
  openSheet(`<h3>진행자 비밀번호</h3><p class="muted small">진행자 도구와 프로젝터 화면은 진행자 비밀번호로 한 번 들어온 기기에서만 열립니다. 같은 브라우저의 다른 창은 다시 묻지 않습니다.</p>
    <form id="mForm"><input type="password" id="mPw" autocomplete="current-password" placeholder="비밀번호" style="width:100%"><div class="row" style="margin-top:12px"><div class="sp"></div><button type="button" class="btn" data-close>취소</button><button class="btn primary">들어가기</button></div></form>
    ${DEMO ? '<p class="muted small">연습 모드 비밀번호는 0000입니다.</p>' : '<div class="first-run"><b>처음 쓰시나요?</b> 아직 진행자 비밀번호를 정한 적이 없으면 여기서 정하세요. 한 번 정하면 다른 사람은 새로 정할 수 없습니다.<div class="row" style="margin-top:8px"><button type="button" class="btn" data-first>진행자 비밀번호 처음 정하기</button></div></div>'}`, e => {
    if(e.target.closest('[data-first]')) firstPwSheet(next);
  });
  $('#mForm').addEventListener('submit', async e => {
    e.preventDefault(); const pw = $('#mPw').value;
    if(!pw){ toast('비밀번호를 넣어 주세요'); return; }
    try{ await DB.set('masters/' + DB.uid, pw); ME.master = true; closeSheet(); toast('진행자로 들어왔습니다'); onRoleChange(); next && next(); }
    catch(err){ toast(isDenied(err) ? '비밀번호가 맞지 않습니다. 아직 정한 적이 없으면 아래 "처음 정하기"를 누르세요.' : '서버에 연결하지 못했습니다.'); }
  });
}
function rulesNotice(){
  $$('.pill.net').forEach(el => { el.className = 'pill net bad'; el.textContent = '서버 규칙 게시 필요'; });
  if(!$('#sheet').hidden && $('#mForm')) openSheet(rulesMissingHTML());
}
function firstPwSheet(next){
  openSheet(`<h3>진행자 비밀번호 정하기</h3><p class="muted small">진행자 도구와 프로젝터 화면을 열 때 쓰는 비밀번호입니다(4~30자). 진행을 맡을 직원끼리만 알고 계세요. 나중에 바꾸려면 Firebase 콘솔의 데이터 탭에서 goldenbell1 → secret → masterPw를 고칩니다.</p>
    <form id="fForm"><label class="field"><span>새 비밀번호</span><input type="password" id="fPw1" autocomplete="new-password" maxlength="30"></label>
    <label class="field" style="margin-top:8px"><span>한 번 더</span><input type="password" id="fPw2" autocomplete="new-password" maxlength="30"></label>
    <div class="row" style="margin-top:12px"><div class="sp"></div><button type="button" class="btn" data-close>취소</button><button class="btn primary">정하고 들어가기</button></div></form>`);
  $('#fForm').addEventListener('submit', async e => {
    e.preventDefault(); const a = $('#fPw1').value, b = $('#fPw2').value;
    if(a.length < 4){ toast('4자 이상으로 정해 주세요'); return; }
    if(a !== b){ toast('두 번 넣은 비밀번호가 다릅니다'); return; }
    try{ await DB.set('secret/masterPw', a); }
    catch(err){ toast(isDenied(err) ? (RULES_OLD ? '서버 규칙이 예전 것입니다. 새 규칙 파일을 다시 게시한 뒤 해 주세요.' : '진행자 비밀번호가 이미 정해져 있습니다. 정한 사람에게 물어봐 주세요.') : '서버에 연결하지 못했습니다.'); return; }
    try{ await DB.set('masters/' + DB.uid, a); ME.master = true; closeSheet(); toast('진행자 비밀번호를 정하고 들어왔습니다'); onRoleChange(); next && next(); }
    catch(err){ toast('비밀번호는 정했지만 들어가지 못했습니다. 새로 고침한 뒤 그 비밀번호로 들어가 주세요.'); }
  });
}
function loginStaffSheet(){
  openSheet(`<h3>현장 직원으로 들어가기</h3><p class="muted small">이름은 무전과 정답 체크에 함께 나옵니다. 직원 비밀번호를 모르면 이름만 넣고 '승인 기다리기'를 누르세요. 진행자가 진행자 도구 → 직원 탭에서 승인하면 바로 쓸 수 있습니다.</p>
    <form id="sForm"><label class="field"><span>이름</span><input type="text" id="sName" maxlength="20" value="${esc(ME.name)}" placeholder="예: 정성모"></label>
    <label class="field" style="margin-top:8px"><span>직원 비밀번호</span><input type="password" id="sPw" autocomplete="off"></label>
    <div class="row" style="margin-top:12px"><button type="button" class="btn" data-wait>승인 기다리기</button><div class="sp"></div><button type="button" class="btn" data-close>취소</button><button class="btn primary">들어가기</button></div></form>`, e => {
    if(e.target.closest('[data-wait]')){ const n = $('#sName').value.trim(); if(!n){ toast('이름을 넣어 주세요'); return; } ME.name = n.slice(0, 20); ls.set('name', ME.name); closeSheet(); pushPresence(); toast('진행자 승인을 기다립니다'); schedule(); }
  });
  $('#sForm').addEventListener('submit', async e => {
    e.preventDefault(); const n = $('#sName').value.trim().slice(0, 20), pw = $('#sPw').value;
    if(!n){ toast('이름을 넣어 주세요'); return; }
    ME.name = n; ls.set('name', n);
    try{ await DB.set('staffs/' + DB.uid, { pw, name:n, at:srvNow() }); ME.staff = true; closeSheet(); toast('직원으로 들어왔습니다'); onRoleChange(); }
    catch(err){ toast(RULES_MISSING && !DEMO ? '진행자가 아직 서버 준비(규칙 게시)를 하지 않았습니다. 진행자에게 알려 주세요.' : isDenied(err) ? '직원 비밀번호가 맞지 않거나 아직 정해지지 않았습니다. 진행자에게 확인해 주세요.' : '서버에 연결하지 못했습니다.'); pushPresence(); }
  });
}
function ensureAccess(r){
  if(!ME.known || !$('#sheet').hidden) return;
  if((r === 'host' || r === 'screen') && !ME.master) loginMasterSheet();
  if(r === 'staff' && !ME.staff && !ME.master && !ME.name) loginStaffSheet();
}

/* ===================== 진행 동작 ===================== */
const qSecs = q => q ? (Number(q.secs) || Number(S.live.cfg[q.type]) || 60) : 60;
function freshTimer(q){ const d = qSecs(q || curQ()); return { dur:d, remain:d, endAt:0, running:false }; }
function startTimer(t){ t = t || S.live.timer; const r = t.running ? remain() : (t.remain > 0 ? t.remain : t.dur); return { ...t, remain:r, endAt:srvNow() + r * 1000, running:true }; }
function goQ(qi, mode){
  const n = S.qs.list.length; if(!n){ toast('문제 탭에서 문제를 먼저 넣어 주세요'); return; }
  qi = Math.max(0, Math.min(n - 1, qi)); mode = mode || 'question';
  let timer = S.live.timer; const changed = qi !== S.live.qi;
  if(changed || (S.live.mode !== 'question' && S.live.mode !== 'answer' && !timer.running && timer.remain >= timer.dur)) timer = freshTimer(S.qs.list[qi]);
  if(mode === 'question' && S.live.autoTimer && !timer.running && (changed || timer.remain >= timer.dur)) timer = startTimer(timer);
  if(mode === 'answer' && timer.running) timer = { ...timer, remain:remain(), running:false };
  setLive({ qi, mode, timer });
}
function setMode(m){
  if(m === 'question' || m === 'answer') return goQ(S.live.qi, m);
  if(m === 'award') return setLive({ mode:'award', award:S.live.mode === 'award' ? S.live.award : { i:0, show:false } });
  if(m === 'title' && !S.live.title.text) return setTab('ann');
  setLive({ mode:m });
}
function stepNext(){
  const L = S.live, n = S.qs.list.length;
  if(L.mode === 'intro'){ const len = introList().length; if(L.intro < len - 1) return setLive({ intro:L.intro + 1 }); return toast('마지막 참여자입니다'); }
  if(L.mode === 'award'){ const len = awardSteps().length; if(!L.award.show) return setLive({ award:{ i:L.award.i, show:true } }); if(L.award.i < len) return setLive({ award:{ i:L.award.i + 1, show:false } }); return; }
  if(L.mode === 'question') return setMode('answer');
  if(L.mode === 'answer'){ if(L.qi < n - 1) return goQ(L.qi + 1, 'question'); return setLive({ mode:'score' }); }
  if(!n) return toast('문제 탭에서 문제를 먼저 넣어 주세요');
  setMode('question');
}
function stepPrev(){
  const L = S.live;
  if(L.mode === 'intro'){ if(L.intro > 0) return setLive({ intro:L.intro - 1 }); return setLive({ mode:'banner' }); }
  if(L.mode === 'award'){ if(L.award.show) return setLive({ award:{ i:L.award.i, show:false } }); if(L.award.i > 0) return setLive({ award:{ i:L.award.i - 1, show:true } }); return; }
  if(L.mode === 'answer') return setMode('question');
  if(L.mode === 'question'){ if(L.qi > 0) return goQ(L.qi - 1, 'answer'); return setLive({ mode:'banner' }); }
  setMode('question');
}
function tToggle(){ const t = S.live.timer; if(t.running) setLive({ timer:{ ...t, remain:remain(), running:false } }); else setLive({ timer:startTimer(remain() <= 0 ? { ...t, remain:t.dur } : t) }); }
function tReset(){ setLive({ timer:freshTimer() }); }
function tPlus(){ const t = S.live.timer; if(t.running) setLive({ timer:{ ...t, endAt:t.endAt + 10000, dur:t.dur + 10 } }); else setLive({ timer:{ ...t, remain:remain() + 10, dur:Math.max(t.dur, remain() + 10) } }); }
function toggleMusic(key){
  const m = S.live.music;
  if(m && m.on && m.key === key) setLive({ music:{ ...m, on:false } });
  else setLive({ music:{ key, on:true, id:uid(), vol:S.live.cfg.vol } });
}

document.addEventListener('keydown', e => {
  if(ROLE !== 'host' && ROLE !== 'screen') return;
  const tg = e.target; if(tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName))) return;
  if(!$('#sheet').hidden) return;
  if(ROLE === 'host' && $('#tab-run').hidden) return;
  if(e.ctrlKey || e.metaKey || e.altKey) return;
  if(ROLE === 'screen' && !$('#screenStart').hidden){ e.preventDefault(); screenGo(-2); return; }
  const k = e.key; let done = true;
  if(k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'ArrowDown') stepNext();
  else if(k === 'ArrowLeft' || k === 'PageUp' || k === 'ArrowUp' || k === 'Backspace') stepPrev();
  else if(k === 'b' || k === 'B' || k === '.') setLive({ mode:S.live.mode === 'blank' ? 'question' : 'blank' });
  else if(k === 'a' || k === 'A') setMode('answer');
  else if(k === 'q' || k === 'Q') setMode('question');
  else if(k === 't' || k === 'T') tToggle();
  else if(k === 'h' || k === 'H' || k === 'Home' || k === 'F5') setLive({ mode:'banner' });
  else if(k === 'g' || k === 'G') setLive({ mode:'seats' });
  else if(k === 's' || k === 'S') setLive({ mode:'score' });
  else done = false;
  if(done) e.preventDefault();
});

/* ===================== 정답 체크 ===================== */
function toggleMark(pid){
  const q = curQ(); if(!q){ toast('문제를 먼저 넣어 주세요'); return; }
  if(!canMark(pid)){ toast(ROLE === 'staff' ? '맡은 자리만 체크할 수 있습니다' : '체크할 권한이 없습니다'); return; }
  const cur = markFor(q, pid), by = { ...(cur && cur.by || {}) }, me = DB.uid;
  const base = `marks/${pid}/${q.id}`;
  let p;
  S.marks[pid] = { ...(S.marks[pid] || {}) };
  if(ROLE === 'host'){
    if(cur && by[me]){ delete S.marks[pid][q.id]; p = DB.remove(base); }
    else { by[me] = { n:'진행자', t:srvNow(), r:'host' }; S.marks[pid][q.id] = { by }; p = DB.set(`${base}/by/${me}`, by[me]); }
  }else{
    if(by[me]){ delete by[me]; S.marks[pid][q.id] = { by }; p = DB.remove(`${base}/by/${me}`); }
    else { by[me] = { n:myName().slice(0, 20), t:srvNow(), r:'staff' }; S.marks[pid][q.id] = { by }; p = DB.set(`${base}/by/${me}`, by[me]); }
  }
  p.catch(writeErr); schedule();
  vib(isMarked(S.marks[pid][q.id]) ? 25 : [10, 40, 10]);
}
function adjust(pid, d){ S.seats.adjust = { ...(S.seats.adjust || {}) }; S.seats.adjust[pid] = (Number(S.seats.adjust[pid]) || 0) + d; if(!S.seats.adjust[pid]) delete S.seats.adjust[pid]; saveSeats(); }
function toggleDone(){
  const q = curQ(); if(!q) return;
  const d = S.done[q.id] && S.done[q.id][DB.uid];
  S.done = { ...S.done, [q.id]:{ ...(S.done[q.id] || {}) } };
  if(d){ delete S.done[q.id][DB.uid]; DB.remove(`done/${q.id}/${DB.uid}`).catch(writeErr); }
  else { S.done[q.id][DB.uid] = srvNow(); DB.set(`done/${q.id}/${DB.uid}`, srvNow()).catch(writeErr); toast('진행자 화면에 체크 끝으로 표시했습니다'); }
  vib(30); schedule();
}

/* ===================== 좌석 격자 ===================== */
let selPid = null, selStaff = null, showAllSeats = false;
function seatGridHTML(kind){
  const { rows, cols, map } = S.seats, pm = peopleMap(), sc = scores(), q = curQ(), me = DB ? DB.uid : '';
  const mine = kind === 'staff' ? new Set(myKeys()) : null;
  const onlyMine = kind === 'staff' && !showAllSeats && mine.size;
  const minW = kind === 'staff' ? 76 : kind === 'layout' || kind === 'assign' ? 84 : 72;
  let h = `<div class="seat-grid" style="--cols:${cols};--min:${minW}px">`;
  for(let r = 0; r < rows; r++){
    if(onlyMine && !Array.from(mine).some(k => k.startsWith(r + '-'))) continue;
    if(kind === 'assign') h += `<div class="seat-row-lbl"><button class="btn sm" data-act="assignRow" data-r="${r}">${r + 1}줄 전체 맡기기</button></div>`;
    else if(kind === 'staff' && rows > 1) h += `<div class="seat-row-lbl">${r + 1}줄</div>`;
    for(let c = 0; c < cols; c++){
      const key = r + '-' + c, p = pm[map[key]], code = `${r + 1}-${c + 1}`, su = S.assign[key];
      if(kind === 'layout'){
        h += p ? `<div class="seat ${selPid === p.id ? 'sel' : ''}" data-seat="${key}" data-pid="${p.id}" draggable="true"><span class="s-code">${code}</span><span class="s-name">${esc(p.name)}</span><button class="s-x" data-act="unseat" data-pid="${p.id}" aria-label="${esc(p.name)} 자리에서 빼기">×</button></div>`
               : `<div class="seat empty" data-seat="${key}"><span class="s-code">${code}</span><span class="s-name" style="font-weight:400;font-size:13px">빈자리</span></div>`;
        continue;
      }
      if(kind === 'assign'){
        const col = su ? staffColor(su) : '';
        h += `<button class="seat assign ${su ? 'has' : ''} ${!p ? 'empty' : ''}" data-act="assignSeat" data-k="${key}" style="${col ? `--sc:${col}` : ''}"><span class="s-code">${code}</span><span class="s-name">${p ? esc(p.name) : '빈자리'}</span><span class="s-staff">${su ? esc(staffName(su)) : '담당 없음'}</span></button>`;
        continue;
      }
      if(!p){ if(!(onlyMine && !mine.has(key))) h += `<div class="seat empty"><span class="s-code">${code}</span></div>`; else h += '<div class="seat gap"></div>'; continue; }
      if(onlyMine && !mine.has(key)){ h += '<div class="seat gap"></div>'; continue; }
      const m = markFor(q, p.id), by = m && m.by || {}, ks = Object.keys(by);
      const hostN = ks.filter(k => by[k] && by[k].r === 'host').length, staffN = ks.length - hostN, myMark = !!by[me] && kind === 'staff';
      let tags = ''; if(hostN) tags += '<i>진행</i>'; if(staffN) tags += `<i>직원${staffN > 1 ? ' ' + staffN : ''}</i>`;
      const other = kind === 'staff' && !mine.has(key);
      const col = kind === 'host' && su ? `--sc:${staffColor(su)}` : '';
      h += `<button class="seat ${isMarked(m) ? 'is-right' : ''} ${myMark ? 'mine' : ''} ${other ? 'other' : ''} ${col ? 'has' : ''}" ${other ? 'disabled' : `data-act="mark" data-pid="${p.id}"`} style="${col}" aria-pressed="${isMarked(m)}"><span class="s-code">${code}</span><span class="s-name">${esc(p.name)}</span><span class="s-score">${sc[p.id] || 0}점</span><span class="s-by">${tags}</span></button>`;
    }
  }
  return h + '</div>';
}

/* ===================== 그리기 ===================== */
let rq = false, rqFlags = new Set();
function schedule(flag){
  rqFlags.add(flag || 'all'); if(rq) return; rq = true;
  const run = () => { if(!rq) return; rq = false; const f = rqFlags; rqFlags = new Set(); render(f); };
  requestAnimationFrame(run); setTimeout(run, 120);
}
function render(flags){
  try{
    $('#pickTitle').innerHTML = `${esc(S.banner.l1)} <em>${esc(S.banner.l2)}</em>`;
    if(ROLE === 'screen'){ paintStage($('#fullStage')); const ss = $('#ssSfx'); if(ss) ss.textContent = Object.keys(SFX.files).length ? `이 PC에 저장된 소리 파일 ${Object.keys(SFX.files).length}개를 여기서 재생합니다.` : '이 PC에 저장된 소리 파일이 없습니다 (땡·두구두구는 기본 소리로 납니다).'; }
    if(ROLE === 'host') renderHost(flags);
    if(ROLE === 'staff') renderStaff();
    radioRender();
    showErr(null);
  }catch(e){ console.error(e); showErr(e); }
}
// 화면을 그리다 오류가 나면 빈 화면 대신 오류 내용을 띄움 (새로 고침 안내 + 알려 줄 글)
function showErr(e){
  let b = $('#errBar');
  if(!e){ if(b) b.hidden = true; return; }
  if(!b){ b = document.createElement('div'); b.id = 'errBar'; document.body.appendChild(b); }
  b.hidden = false;
  b.innerHTML = `<b>화면을 그리지 못했습니다.</b> Ctrl+Shift+R(강력 새로 고침)을 눌러 보세요. 계속되면 아래 글을 알려 주세요.<br><code>${esc(String(e && (e.stack || e.message) || e).split('\n').slice(0, 3).join(' / ')).slice(0, 300)}</code>`;
}
window.addEventListener('error', e => { if(e && e.error && /\/goldenbell\/js\//.test(String(e.filename || ''))) showErr(e.error); });
function answerText(q){ if(!q) return ''; if(q.type === 'ox') return q.answer || ''; if(q.type === 'choice'){ const c = (q.choices || [])[Number(q.answer) - 1]; return q.answer ? `${q.answer}번${c ? ' · ' + c : ''}` : ''; } return q.answer || ''; }
const KIND_TAG = q => q.kind !== 'main' ? `<span class="kind-chip k-${q.kind}">${KINDS[q.kind]}${q.kind === 'final' ? '' : ' · 점수 없음'}</span>` : '';
function notesHTML(q, ttl, i){
  if(!q) return `<div class="card-h">${ttl}</div><div class="empty-state">문제 탭에서 문제를 붙여넣으세요.</div>`;
  const a = answerText(q);
  return `<div class="card-h">${ttl} ${KIND_TAG(q)}<span class="hint">${TYPE_LABEL[q.type] || ''} · ${mmss(qSecs(q))}${q.secs ? '' : '(기본)'}${q.author ? ' · 출제 ' + esc(q.author) : ''}</span></div>
    <div class="q-t">${esc(q.text)}</div>
    ${q.type === 'choice' ? `<div class="memo">${(q.choices || []).map((c, j) => `${j + 1}. ${esc(c)}`).join('&nbsp;&nbsp; ')}</div>` : ''}
    <div class="ans-line">${a ? `<span class="ans-badge">정답 ${esc(a)}</span>` : '<span class="ans-badge none">정답 미입력</span>'}${q.dots ? cellsHTML(q.dots) : ''}</div>
    ${q.expl ? `<div class="memo">해설: <b>${esc(q.expl)}</b></div>` : ''}${q.memo ? `<div class="memo">메모: <b>${esc(q.memo)}</b></div>` : ''}`;
}
function introNotesHTML(){
  const list = introList(), i = Math.min(S.live.intro, list.length - 1);
  if(!list.length) return '<div class="card-h">참여자 소개</div><div class="empty-state">좌석·점수 탭에서 명단을 넣으세요.</div>';
  const cur = list[i], nx = list[i + 1];
  return `<div class="card-h">참여자 소개 · ${i + 1} / ${list.length} <span class="hint">'다음'을 누르면 다음 분</span></div><div class="q-t">${esc(cur.p.name)} <span class="muted">${cur.seat ? seatLabel(cur.seat) : ''}</span></div>${nx ? `<div class="memo">다음: <b>${esc(nx.p.name)}</b></div>` : '<div class="memo">마지막 분입니다</div>'}`;
}
function awardNotesHTML(){
  const steps = awardSteps(), st = S.live.award, a = steps[st.i];
  const warns = tieWarnings();
  if(!a) return `<div class="card-h">시상식</div><div class="memo">모든 시상을 마쳤습니다. '현수막'이나 '안내'로 바꾸세요.</div>`;
  const nx = steps[st.i + 1];
  return `<div class="card-h">시상식 · ${st.i + 1} / ${steps.length} <span class="hint">${st.show ? '수상자 발표 중 · 다음을 누르면 다음 상' : '상 이름만 보이는 중 · 다음을 누르면 수상자 발표'}</span></div>
    <div class="q-t">${esc(a.rankLabel)} ${esc(a.title)}</div><div class="memo">${esc(a.prize)}</div>
    <div class="memo">수상자: <b>${a.people.length ? a.people.map(r => `${esc(r.p.name)}(${r.s}점)`).join(', ') : '없음'}</b></div>
    ${nx ? `<div class="memo">다음: <b>${esc(nx.rankLabel)} ${esc(nx.title)}</b></div>` : ''}
    ${warns.length ? `<div class="warn-box">동점이 있습니다. 결승 문제로 가린 뒤 발표하세요.<br>${warns.map(esc).join('<br>')}</div>` : ''}`;
}
function annQuickHTML(){
  const a = S.live.ann;
  const favs = S.favs.slice(0, 8).map((t, i) => `<button class="btn sm" data-act="favSend" data-i="${i}">${esc(t.length > 16 ? t.slice(0, 16) + '…' : t)}</button>`).join('');
  if(!favs && !a) return '';
  return `<span class="lbl">방송</span>${favs}${a ? `<span class="ann-on">지금: ${esc(a.text.slice(0, 22))}</span><button class="btn sm danger" data-act="annClear">내리기</button>` : ''}`;
}
function sndGrpHTML(){
  const m = S.live.music, on = k => m && m.on && m.key === k;
  const scr = Object.values(S.devices).find(d => d && d.role === 'screen');
  const scrHas = k => scr ? String(scr.sfx || '').split(',').includes(k) : sfxHas(k);
  const b = (k, t) => `<button class="btn sm ${on(k) ? 'on' : ''} ${scrHas(k) ? '' : 'nofile'}" data-act="music" data-k="${k}" title="${scrHas(k) ? '' : '소리 파일 없음 (설정 탭에서 불러오기)'}">${on(k) ? '■ ' : '▶ '}${t}</button>`;
  return `<span class="lbl">소리</span>${b('intro', '인트로')}${b('march', '행진곡')}${b('bgm', '배경음')}`;
}
function renderHost(flags){
  const L = S.live, q = curQ(), n = S.qs.list.length, all = flags.has('all');
  if(!$('#tab-run').hidden){
    paintStage($('#miniStage'));
    $('#modeName').textContent = '· ' + MODE_LABEL[L.mode] + (annPhase() ? ' · 방송 문구 표시 중' : '');
    $$('#modeSeg [data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === L.mode));
    $$('.theme-seg [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === (L.theme === 'day' ? 'day' : 'night')));
    $('#annQuick').innerHTML = annQuickHTML(); $('#annQuick').hidden = !$('#annQuick').innerHTML;
    $('#sndGrp').innerHTML = sndGrpHTML();
    if(L.mode === 'intro'){ $('#hostNotes').innerHTML = introNotesHTML(); $('#hostNext').innerHTML = notesHTML(q, '그다음 문제 · ' + qTitle(L.qi), L.qi); }
    else if(L.mode === 'award'){ $('#hostNotes').innerHTML = awardNotesHTML(); $('#hostNext').innerHTML = ''; }
    else {
      $('#hostNotes').innerHTML = notesHTML(q, n ? `지금 · ${qTitle(L.qi)}` : '지금 문제', L.qi);
      const nq = S.qs.list[L.qi + 1];
      $('#hostNext').innerHTML = nq ? notesHTML(nq, `다음 · ${qTitle(L.qi + 1)}`, L.qi + 1) : `<div class="card-h">다음 문제</div><div class="muted">${n ? '마지막 문제입니다. 다음을 누르면 점수 순위가 나옵니다.' : ''}</div>`;
    }
    $('#hostNext').hidden = !$('#hostNext').innerHTML;
    $('#nextBtn').textContent = L.mode === 'question' ? '정답 공개 ▶' : L.mode === 'answer' ? (L.qi < n - 1 ? '다음 문제 ▶' : '점수 순위 ▶')
      : L.mode === 'intro' ? '다음 분 ▶' : L.mode === 'award' ? (L.award.show ? '다음 상 ▶' : '수상자 발표 ▶') : '문제 띄우기 ▶';
    $('#qStrip').innerHTML = n ? qStripHTML() : '<span class="muted">문제가 없습니다</span>';
    $('#hostSeats').innerHTML = S.seats.people.length ? seatGridHTML('host') : '<div class="empty-state">좌석·점수 탭에서 참가자 명단을 넣고 좌석에 배치하세요.<br>배치하면 여기서 이름을 눌러 정답자를 체크합니다.</div>';
    $('#markCount').textContent = q ? `${S.seats.people.filter(p => isMarked(markFor(q, p.id))).length}명` : '';
    $('#doneRow').innerHTML = doneRowHTML();
    const rk = ME.master ? 'm' : 's';
    if($('#radioHost').dataset.ok !== rk){ $('#radioHost').innerHTML = radioPanelHTML('h'); $('#radioHost').dataset.ok = rk; }
  }
  if(!$('#tab-ann').hidden) renderAnn();
  if(!$('#tab-qs').hidden && (all || !flags.has('noEditor'))) renderEditor();
  if(!$('#tab-seat').hidden) renderSeatTab(flags);
  if(!$('#tab-staff').hidden) renderStaffTab();
  if(!$('#tab-banner').hidden) renderBannerTab(flags);
  if(!$('#tab-award').hidden) renderAwardTab();
  if(!$('#tab-set').hidden) renderSettings();
  tickTimers();
}
function qStripHTML(){
  const L = S.live; let h = '', lastSec = '';
  S.qs.list.forEach((x, i) => {
    const sec = x.kind === 'main' ? (hasParts() ? x.part + '부' : '') : KINDS[x.kind];
    if(sec !== lastSec){ if(sec) h += `<span class="qs-sec">${sec}</span>`; lastSec = sec; }
    const m = qMeta(i), lbl = x.kind === 'main' ? m.n : x.kind === 'final' ? '결' + m.n : x.kind === 'practice' ? '연' : '이';
    h += `<button data-act="jump" data-i="${i}" class="${i === L.qi ? 'cur' : i < L.qi ? 'done' : ''} k-${x.kind}" title="${esc(qTitle(i) + ' · ' + x.text.slice(0, 40))}">${lbl}</button>`;
  });
  return h;
}
function doneRowHTML(){
  const q = curQ(); if(!q) return '';
  const uids = Array.from(new Set(Object.values(S.assign || {}).filter(Boolean)));
  if(!uids.length) return '<span class="muted small">직원 탭에서 담당 자리를 정하면 직원별 체크 끝 표시가 여기 나옵니다</span>';
  const d = S.done[q.id] || {};
  const ok = uids.filter(u => d[u]).length;
  return `<span class="lbl">담당 체크</span>${uids.map(u => `<span class="done-chip ${d[u] ? 'ok' : ''}" style="--sc:${staffColor(u)}">${d[u] ? '✓' : '…'} ${esc(staffName(u))}</span>`).join('')}${ok === uids.length ? '<b class="all-done">모두 끝</b>' : ''}`;
}
function renderStaff(){
  const L = S.live, q = curQ(), n = S.qs.list.length;
  if(!radioOK()){
    $('#staffQ').innerHTML = `<div class="card-h">진행자 승인을 기다리는 중</div><p class="muted small" style="margin:0 0 10px">${ME.name ? esc(ME.name) + ' 님, ' : ''}진행자가 승인하면 문제·정답과 체크·무전이 바로 열립니다. 직원 비밀번호를 알면 지금 들어갈 수 있어요.</p><button class="btn primary" data-act="staffLogin">직원 비밀번호로 들어가기</button>`;
  }else if(!q){ $('#staffQ').innerHTML = '<div class="muted">진행자가 아직 문제를 넣지 않았습니다.</div>'; }
  else{
    const a = answerText(q), off = L.mode !== 'question' && L.mode !== 'answer';
    $('#staffQ').innerHTML = `<div class="sq-top"><b>${esc(qTitle(L.qi))}</b>${KIND_TAG(q)}<span>${TYPE_LABEL[q.type] || ''}${q.author ? ' · 출제 ' + esc(q.author) : ''}</span>${off ? `<span class="pill warn">화면: ${MODE_LABEL[L.mode]}</span>` : L.mode === 'answer' ? '<span class="pill ok">정답 공개 중</span>' : ''}<span class="sq-timer" id="sqTimer"></span></div>
      <div class="sq-text">${esc(q.text)}</div>
      ${q.type === 'choice' ? `<div class="memo">${(q.choices || []).map((c, i) => `${i + 1}. ${esc(c)}`).join('&nbsp;&nbsp; ')}</div>` : ''}
      <div class="sq-ans">${a ? `<span class="ans-badge">정답 ${esc(a)}</span>` : '<span class="ans-badge none">정답 미입력</span>'}${q.expl ? `<span class="muted">${esc(q.expl)}</span>` : ''}</div>`;
  }
  const keys = myKeys();
  $('#staffHint').textContent = !radioOK() ? '' : keys.length ? `맡은 자리: ${keysText(keys)} (${keys.length}자리). 참가자가 맞힌 걸 확인했으면 이름을 누르세요. 잘못 눌렀으면 다시 누르면 취소됩니다.` : '진행자가 담당 자리를 정하면 그 자리만 체크할 수 있습니다. 지금은 보기만 됩니다.';
  $('#showAll').checked = showAllSeats; $('#showAll').closest('label').hidden = !keys.length;
  $('#staffSeats').innerHTML = S.seats.people.length ? seatGridHTML('staff') : '<div class="empty-state">진행자가 좌석을 배치하면 여기에 이름이 나옵니다.</div>';
  $('#staffCount').textContent = q ? `${S.seats.people.filter(p => isMarked(markFor(q, p.id))).length}명 정답` : '';
  const done = q && S.done[q.id] && S.done[q.id][DB.uid];
  const db = $('#myDoneBtn'); db.hidden = !keys.length || !q; db.classList.toggle('on', !!done); db.textContent = done ? '✓ 체크 끝 (다시 누르면 취소)' : '✓ 내 담당 체크 끝';
  if(!$('#radioStaff').dataset.ok){ $('#radioStaff').innerHTML = radioPanelHTML('s'); $('#radioStaff').dataset.ok = 1; $('#pttDock').innerHTML = '<button class="ptt dock" data-ptt aria-label="누르고 있는 동안 말하기"><span class="ptt-ic">🎙</span><span class="ptt-t">누르고 말하기</span></button>'; }
  tickTimers();
}

/* ---------- 방송·안내 ---------- */
function renderAnn(){
  const a = S.live.ann, ph = annPhase();
  $('#annNow').innerHTML = a ? `<div class="ann-cur"><b>지금 띄운 문구</b> (${ph === 'full' ? '크게 보이는 중' : '아래 띠'}) <span>${esc(a.text)}</span></div>` : '';
  $('#favList').innerHTML = S.favs.length ? S.favs.map((t, i) => `<div class="fav"><button class="btn fav-t" data-act="favSend" data-i="${i}">${esc(t)}</button><button class="btn sm" data-act="favEdit" data-i="${i}">고치기</button><button class="btn sm danger" data-act="favDel" data-i="${i}">지우기</button></div>`).join('')
    : '<div class="empty-state">저장한 문구가 없습니다.<br>예: "정답 팻말을 들어 주세요", "잠시 체크 중입니다. 팻말을 들고 기다려 주세요"</div>';
  const cur = S.live.mode === 'title' ? S.live.title.text : '';
  $('#titlePresets').innerHTML = TITLE_PRESETS.map((p, i) => `<button class="btn sm ${cur === p[0] ? 'on' : ''}" data-act="ttPreset" data-i="${i}">${esc(p[0])}</button>`).join('');
}
function annSend(text){
  text = String(text || '').trim().slice(0, 120); if(!text){ toast('문구를 적어 주세요'); return; }
  const style = ($('input[name="annStyle"]:checked') || {}).value || 'full';
  setLive({ ann:{ id:uid(), text, style, secs:Number($('#annSecs').value), chime:$('#annChime').checked, at:srvNow() } });
  toast('프로젝터에 문구를 띄웠습니다');
}
function saveFavs(){ save('favs', () => ({ list:S.favs })); schedule(); }

/* ---------- 문제 편집 ---------- */
const SEC_OPTS = [0, 30, 45, 60, 90, 120, 150, 180];
function qCardHTML(q, i){
  const cur = i === S.live.qi, missing = !q.answer;
  const ansField = q.type === 'ox' ? `<select data-f="answer"><option value="">정답 선택</option><option value="O" ${q.answer === 'O' ? 'selected' : ''}>O</option><option value="X" ${q.answer === 'X' ? 'selected' : ''}>X</option></select>`
    : q.type === 'choice' ? `<select data-f="answer"><option value="">정답 선택</option>${(q.choices || []).map((c, j) => `<option value="${j + 1}" ${String(q.answer) === String(j + 1) ? 'selected' : ''}>${j + 1}번 ${esc(c.slice(0, 16))}</option>`).join('')}</select>`
    : `<input type="text" data-f="answer" value="${esc(q.answer)}" placeholder="정답">`;
  return `<div class="qe ${cur ? 'cur' : ''} k-${q.kind}" data-qid="${q.id}">
    <div class="qe-h"><b class="qe-n">${esc(qTitle(i))}</b>
      <select data-f="kind" aria-label="구분">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${q.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      ${q.kind === 'main' ? `<select data-f="part" aria-label="부"><option value="1" ${q.part === '1' ? 'selected' : ''}>1부</option><option value="2" ${q.part === '2' ? 'selected' : ''}>2부</option></select>` : ''}
      <select data-f="type" aria-label="문제 형식"><option value="ox" ${q.type === 'ox' ? 'selected' : ''}>O / X</option><option value="choice" ${q.type === 'choice' ? 'selected' : ''}>4지선다</option><option value="short" ${q.type === 'short' ? 'selected' : ''}>주관식</option></select>
      <select data-f="secs" aria-label="제한 시간">${SEC_OPTS.map(s => `<option value="${s}" ${Number(q.secs || 0) === s ? 'selected' : ''}>${s ? mmss(s) : `기본 ${mmss(Number(S.live.cfg[q.type]) || 60)}`}</option>`).join('')}</select>
      <input type="text" data-f="author" value="${esc(q.author)}" placeholder="출제자" aria-label="출제자">
      ${missing ? '<span class="warn-chip">정답 미입력</span>' : ''}
      <div class="sp"></div>
      <button class="btn sm" data-act="qShow">띄우기</button>
      <button class="btn sm" data-act="qUp" aria-label="위로">▲</button><button class="btn sm" data-act="qDown" aria-label="아래로">▼</button>
      <button class="btn sm danger" data-act="qDel">삭제</button></div>
    <textarea data-f="text" rows="2" aria-label="문제">${esc(q.text)}</textarea>
    ${q.type === 'choice' ? `<label class="field"><span>보기 (한 줄에 하나씩)</span><textarea data-f="choices" rows="${Math.max(2, (q.choices || []).length)}">${esc((q.choices || []).join('\n'))}</textarea></label>` : ''}
    <div class="qe-grid">
      <label class="field"><span>정답</span>${ansField}</label>
      <label class="field"><span>해설 (정답 공개 때 화면에 나옴)</span><input type="text" data-f="expl" value="${esc(q.expl)}"></label>
      <label class="field"><span>점자 그림 (예: 156 / 145 126 34)</span><input type="text" data-f="dots" value="${esc(q.dots)}" placeholder="비우면 안 나옴"></label>
      <label class="field"><span>진행자 메모 (진행자·직원만 봄)</span><input type="text" data-f="memo" value="${esc(q.memo)}"></label>
    </div></div>`;
}
let editorDirty = false;
function renderEditor(force){
  const box = $('#qList');
  if(!force && box.contains(document.activeElement) && document.activeElement.matches('input,textarea,select')){ editorDirty = true; return; }
  editorDirty = false;
  const L = S.qs.list, cnt = k => L.filter(q => q.kind === k).length;
  $('#qCount').textContent = L.length ? `본문제 ${cnt('main')}${hasParts() ? ` (1부 ${L.filter(q => q.kind === 'main' && q.part === '1').length} · 2부 ${L.filter(q => q.kind === 'main' && q.part === '2').length})` : ''} · 연습 ${cnt('practice')} · 이벤트 ${cnt('event')} · 결승 ${cnt('final')} · 정답 미입력 ${L.filter(q => !q.answer).length}` : '';
  box.innerHTML = L.length ? L.map(qCardHTML).join('') : '<div class="empty-state">아직 문제가 없습니다.<br>왼쪽에 문제를 붙여넣고 <b>읽어오기</b>를 누르거나, <b>새 문제 추가</b>를 누르세요.</div>';
}
$('#qList').addEventListener('focusout', () => setTimeout(() => { if(editorDirty && !$('#qList').contains(document.activeElement)) renderEditor(); }, 0));
$('#qList').addEventListener('input', e => {
  const el = e.target, f = el.dataset.f, card = el.closest('.qe'); if(!f || !card) return;
  const q = S.qs.list.find(x => x.id === card.dataset.qid); if(!q) return;
  if(f === 'choices') q.choices = el.value.split('\n').map(s => s.trim()).filter(Boolean);
  else if(f === 'type' || f === 'kind' || f === 'part' || f === 'secs'){
    q[f] = f === 'secs' ? Number(el.value) : el.value;
    if(f === 'type' && q.type === 'ox' && !/^[OX]$/.test(q.answer)) q.answer = '';
    if(S.qs.list.indexOf(q) === S.live.qi && f === 'secs' && ME.master && !S.live.timer.running) setLive({ timer:freshTimer(q) });
    saveQs(); renderEditor(true); return;
  }
  else q[f] = el.value;
  if(f === 'answer') card.querySelector('.warn-chip')?.remove();
  saveQs();
});
$('#qList').addEventListener('change', e => { const el = e.target; if(el.dataset.f === 'choices'){ const card = el.closest('.qe'); const q = S.qs.list.find(x => x.id === card.dataset.qid); if(q && q.type === 'choice' && +q.answer > q.choices.length) q.answer = ''; renderEditor(true); } });
let parsed = [];
function doParse(){
  parsed = parseQuestions($('#pasteBox').value);
  const miss = parsed.filter(q => !q.answer).length;
  $('#parseInfo').textContent = parsed.length ? `${parsed.length}문제를 찾았습니다${miss ? ` · 정답 없는 문제 ${miss}개` : ''}` : '문제를 찾지 못했습니다';
  $('#parsePrev').innerHTML = parsed.map((q, i) => `<div class="pp"><b>${i + 1}</b> [${KINDS[q.kind]}${q.kind === 'main' ? ' ' + q.part + '부' : ''} · ${TYPE_LABEL[q.type]}${q.author ? ' · ' + esc(q.author) : ''}] ${esc(q.text.slice(0, 60))}${q.text.length > 60 ? '…' : ''}${q.type === 'choice' ? ` <span class="muted">(보기 ${q.choices.length})</span>` : ''} → ${q.answer ? '정답 ' + esc(answerText(q)) : '<span class="w">정답 없음</span>'}${q.expl ? ` <span class="muted">해설: ${esc(q.expl)}</span>` : ''}${q.memo ? ` <span class="w">${esc(q.memo)}</span>` : ''}</div>`).join('');
  $('#parseBtns').hidden = !parsed.length;
}
function parseDone(msg){ parsed = []; $('#parseBtns').hidden = true; $('#parsePrev').innerHTML = ''; $('#parseInfo').textContent = msg; $('#pasteBox').value = ''; saveQs(); renderEditor(true); }

/* ---------- 좌석·점수 ---------- */
let scoreView = ls.get('scoreView', 'map');
function scoreBoardHTML(){
  const rows = rankRows(); if(!rows.length) return '<div class="empty-state">명단을 넣고 좌석을 배치하면 점수 현황이 여기 나옵니다.</div>';
  const byPid = {}; rows.forEach(r => byPid[r.p.id] = r);
  const parts = hasParts(), finals = S.qs.list.some(q => q.kind === 'final');
  const sub = r => [parts ? `1부 ${r.p1} · 2부 ${r.p2}` : '', finals && r.tb ? `결승 ${r.tb}` : '', S.seats.adjust?.[r.p.id] ? `보정 ${S.seats.adjust[r.p.id] > 0 ? '+' : ''}${S.seats.adjust[r.p.id]}` : ''].filter(Boolean).join(' · ');
  if(scoreView === 'table'){
    return `<div class="tbl-scroll"><table class="ptable"><thead><tr><th>순위</th><th>이름</th><th>좌석</th><th class="num">점수</th>${parts ? '<th class="num">1부</th><th class="num">2부</th>' : ''}${finals ? '<th class="num">결승</th>' : ''}<th>보정</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.tied ? 'tied' : ''}"><td>${r.rank}${r.tied ? ' <small>동점</small>' : ''}</td><td>${esc(r.p.name)}</td><td>${esc(seatLabel(r.seat))}</td><td class="num"><b>${r.s}</b></td>${parts ? `<td class="num">${r.p1}</td><td class="num">${r.p2}</td>` : ''}${finals ? `<td class="num">${r.tb}</td>` : ''}<td><div class="row nowrap"><button class="btn sm" data-act="adj" data-pid="${r.p.id}" data-d="-1">−1</button><span class="num" style="min-width:2em">${S.seats.adjust?.[r.p.id] || 0}</span><button class="btn sm" data-act="adj" data-pid="${r.p.id}" data-d="1">+1</button></div></td></tr>`).join('')}</tbody></table></div>`;
  }
  const { rows:R, cols:C, map } = S.seats;
  let h = `<div class="seat-scroll"><div class="front-lbl">무대 (앞)</div><div class="seat-grid sb-host" style="--cols:${C};--min:96px">`;
  for(let r = 0; r < R; r++) for(let c = 0; c < C; c++){
    const pid = map[r + '-' + c], x = pid && byPid[pid];
    if(!x){ h += `<div class="seat empty"><span class="s-code">${r + 1}-${c + 1}</span></div>`; continue; }
    h += `<button class="seat score-cell ${x.rank <= 3 && x.s > 0 ? 'top' : ''} ${x.tied ? 'tied' : ''}" data-act="scorePop" data-pid="${pid}"><span class="s-code">${r + 1}-${c + 1}</span><span class="s-rank">${x.rank}등${x.tied ? ' 동점' : ''}</span><span class="s-name">${esc(x.p.name)}</span><span class="s-big">${x.s}<small>점</small></span><span class="s-sub">${esc(sub(x))}</span></button>`;
  }
  h += '</div></div>';
  const un = rows.filter(r => !r.seat);
  if(un.length) h += `<p class="muted small" style="margin:8px 0 0">자리 없는 사람: ${un.map(r => `${esc(r.p.name)} ${r.s}점`).join(', ')}</p>`;
  return h;
}
function renderSeatTab(flags){
  const { rows, cols } = S.seats;
  $('#svMap').classList.toggle('on', scoreView === 'map'); $('#svTable').classList.toggle('on', scoreView === 'table');
  const sb = $('#scoreBoard'); if(!(sb.contains(document.activeElement) && document.activeElement.tagName === 'INPUT')) sb.innerHTML = scoreBoardHTML();
  if(document.activeElement !== $('#rowsIn')) $('#rowsIn').value = rows;
  if(document.activeElement !== $('#colsIn')) $('#colsIn').value = cols;
  const so = seatOf(), pm = S.seats.people, free = pm.filter(p => !so[p.id]);
  $('#peopleCount').textContent = `전체 ${pm.length}명 · 좌석 ${rows * cols}자리 · 자리 없음 ${free.length}명`;
  $('#pool').innerHTML = free.length ? free.map(p => `<span class="chip ${selPid === p.id ? 'sel' : ''}" draggable="true" data-pid="${p.id}" data-act="selChip" tabindex="0">${esc(p.name)}</span>`).join('') : `<span class="muted small">${pm.length ? '모두 자리에 앉았습니다' : '명단을 붙여넣고 추가하세요'}</span>`;
  $('#layoutSeats').innerHTML = seatGridHTML('layout');
  const tb = $('#pTable');
  if(tb.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  tb.innerHTML = pm.length ? `<tbody>${pm.map(p => `<tr><td><input type="text" value="${esc(p.name)}" data-pname="${p.id}" aria-label="이름"></td><td class="muted small">${esc(seatLabel(so[p.id]))}</td><td><button class="btn sm danger" data-act="pDel" data-pid="${p.id}">빼기</button></td></tr>`).join('')}</tbody>` : '<tbody><tr><td class="muted">명단이 비어 있습니다</td></tr></tbody>';
}
function place(pid, key){
  const map = { ...S.seats.map }; let oldKey = null;
  for(const [k, v] of Object.entries(map)) if(v === pid){ oldKey = k; delete map[k]; }
  const other = map[key];
  if(other && other !== pid){ if(oldKey) map[oldKey] = other; else delete map[key]; }
  map[key] = pid; S.seats.map = map; selPid = null; saveSeats();
}
function unseat(pid){ const map = { ...S.seats.map }; for(const [k, v] of Object.entries(map)) if(v === pid) delete map[k]; S.seats.map = map; saveSeats(); }
function addPeople(){
  const raw = $('#peopleIn').value.trim(); if(!raw) return;
  let names = raw.split(/\n/); if(names.length === 1) names = raw.split(/[,，\t]/);
  names = names.map(s => s.replace(/^\s*\d+\s*[.)]\s*/, '').split('\t')[0].trim()).filter(Boolean);
  S.seats.people = [...S.seats.people, ...names.map(name => ({ id:'p' + uid(), name:name.slice(0, 20) }))];
  $('#peopleIn').value = ''; saveSeats(); toast(`${names.length}명을 명단에 추가했습니다`);
}
function autoSeat(){
  const so = seatOf(), free = S.seats.people.filter(p => !so[p.id]); const map = { ...S.seats.map }; let i = 0;
  for(let r = 0; r < S.seats.rows; r++) for(let c = 0; c < S.seats.cols; c++){ const k = r + '-' + c; if(!map[k] && i < free.length) map[k] = free[i++].id; }
  S.seats.map = map; saveSeats(); if(i < free.length) toast(`자리가 모자라 ${free.length - i}명은 그대로 남았습니다`);
}
function setGrid(r, c){
  r = Math.max(1, Math.min(12, r | 0)); c = Math.max(1, Math.min(15, c | 0)); const map = {};
  for(const [k, v] of Object.entries(S.seats.map)){ const [a, b] = k.split('-').map(Number); if(a < r && b < c) map[k] = v; }
  const lost = Object.keys(S.seats.map).length - Object.keys(map).length; S.seats.rows = r; S.seats.cols = c; S.seats.map = map; saveSeats();
  if(lost) toast(`좌석이 줄어 ${lost}명이 자리 없음으로 옮겨졌습니다`);
}
document.addEventListener('dragstart', e => { const el = e.target.closest && e.target.closest('[draggable][data-pid]'); if(!el) return; e.dataTransfer.setData('text/plain', el.dataset.pid); e.dataTransfer.effectAllowed = 'move'; });
document.addEventListener('dragover', e => { const t = e.target.closest && e.target.closest('#layoutSeats [data-seat],#pool'); if(!t) return; e.preventDefault(); $$('.drop').forEach(x => x !== t && x.classList.remove('drop')); t.classList.add('drop'); });
document.addEventListener('dragleave', e => { const t = e.target.closest && e.target.closest('.drop'); if(t && !t.contains(e.relatedTarget)) t.classList.remove('drop'); });
document.addEventListener('drop', e => { const t = e.target.closest && e.target.closest('#layoutSeats [data-seat],#pool'); if(!t) return; e.preventDefault(); $$('.drop').forEach(x => x.classList.remove('drop')); const pid = e.dataTransfer.getData('text/plain'); if(!pid) return; if(t.id === 'pool') unseat(pid); else place(pid, t.dataset.seat); });
document.addEventListener('dragend', () => $$('.drop').forEach(x => x.classList.remove('drop')));

/* ---------- 직원 (담당 자리 · 기기) ---------- */
const ROLE_NAME = { host:'진행자 도구', screen:'프로젝터 화면', staff:'현장 직원', pick:'고르는 중' };
function renderStaffTab(){
  const uids = Object.keys(S.staffs || {});
  if(selStaff && !uids.includes(selStaff)) selStaff = null;
  const cnt = u => Object.values(S.assign).filter(x => x === u).length;
  $('#staffChips').innerHTML = uids.length ? uids.map(u => `<button class="staff-chip ${selStaff === u ? 'sel' : ''}" data-act="selStaff" data-u="${esc(u)}" style="--sc:${staffColor(u)}"><i></i>${esc(staffName(u))} <small>${cnt(u)}자리${S.devices[u] ? '' : ' · 접속 안 함'}</small></button>`).join('') + `<span class="muted small">${selStaff ? `<b>${esc(staffName(selStaff))}</b> 님에게 맡길 자리를 누르세요. 다시 누르면 빠집니다.` : '먼저 직원을 고르세요.'}</span>`
    : '<div class="empty-state">아직 승인된 직원이 없습니다.<br>직원이 휴대폰으로 들어오면 오른쪽 목록에 나오고, 승인하면 여기서 자리를 맡길 수 있습니다.</div>';
  $('#assignSeats').innerHTML = S.seats.people.length ? seatGridHTML('assign') : '<div class="empty-state">좌석·점수 탭에서 명단과 좌석을 먼저 정하세요.</div>';
  const at = ls.get('staffPwAt', 0);
  $('#staffPwInfo').textContent = at ? `이 기기에서 ${new Date(at).toLocaleString('ko-KR')}에 정했습니다. 직원들에게 알려 주세요.` : '아직 이 기기에서 정한 적이 없습니다. 먼저 정해 두세요. (보안상 정해 둔 비밀번호는 다시 볼 수 없습니다)';
  const devs = Object.entries(S.devices).filter(([, d]) => d && typeof d === 'object');
  const c = { screen:0, host:0, staff:0 }; devs.forEach(([, d]) => { if(d.role in c) c[d.role]++; });
  $('#devHint').textContent = `프로젝터 ${c.screen} · 진행자 ${c.host} · 직원 ${c.staff}`;
  devs.sort((a, b) => (a[1].role === 'staff' ? 0 : 1) - (b[1].role === 'staff' ? 0 : 1) || String(a[1].name).localeCompare(String(b[1].name), 'ko'));
  $('#devList').innerHTML = devs.length ? devs.map(([u, d]) => {
    const isStaff = !!S.staffs[u], me = u === DB.uid;
    const btn = me || d.master ? '' : isStaff ? `<button class="btn sm danger" data-act="unstaff" data-u="${esc(u)}">승인 빼기</button>` : `<button class="btn sm primary" data-act="grant" data-u="${esc(u)}" data-n="${esc(d.name || '')}">직원으로 승인</button>`;
    const n = Object.values(S.assign).filter(x => x === u).length;
    return `<div class="dev"><div class="dev-t"><b>${esc(d.name || '이름 없음')}</b>${me ? ' <small>(이 기기)</small>' : ''}<span class="muted small">${ROLE_NAME[d.role] || ''}${d.master ? ' · 진행자' : isStaff ? ` · 직원 승인됨 · 담당 ${n}자리` : d.role === 'staff' ? ' · 승인 기다림' : ''}${d.role === 'screen' ? ` · 소리 파일 ${d.sfx ? String(d.sfx).split(',').filter(Boolean).length : 0}개` : ''}</span></div>${btn}</div>`;
  }).join('') : '<div class="muted small">접속한 기기가 없습니다</div>';
}
function assignSeat(k){
  if(!selStaff){ toast('먼저 위에서 직원을 고르세요'); return; }
  S.assign = { ...S.assign };
  if(S.assign[k] === selStaff) delete S.assign[k]; else S.assign[k] = selStaff;
  saveAssign();
}
function assignRow(r){
  if(!selStaff){ toast('먼저 위에서 직원을 고르세요'); return; }
  S.assign = { ...S.assign };
  const keys = Array.from({ length:S.seats.cols }, (_, c) => r + '-' + c);
  const all = keys.every(k => S.assign[k] === selStaff);
  keys.forEach(k => { if(all) delete S.assign[k]; else S.assign[k] = selStaff; });
  saveAssign();
}

/* ---------- 현수막 꾸미기 ---------- */
const BI = { sel:null, drag:null };
function normBI(it){
  it = it || {};
  return { id:String(it.id || 'b' + uid()), type:it.type === 'img' ? 'img' : 'txt', x:Number(it.x) || 50, y:Number(it.y) || 50, w:Number(it.w) || 14,
    text:String(it.text || ''), fs:Number(it.fs) || 40, color:BI_COLORS[it.color] ? it.color : 'white', bold:!!it.bold, font:it.font === 'disp' ? 'disp' : 'body', box:!!it.box };
}
function renderBannerTab(flags){
  paintStage($('#bannerEdit'), 'banner', { noAnn:true, edit:true });
  paintStage($('#stripPrev'), 'question', { noAnn:true });
  const b = S.banner;
  [['#bnL1', 'l1'], ['#bnL2', 'l2'], ['#bnSub', 'sub'], ['#bnInfo', 'info']].forEach(([s, k]) => { const el = $(s); if(document.activeElement !== el) el.value = b[k] || ''; });
  $('#bnImgInfo').textContent = S.bimg.img ? `이미지 사용 중 (${Math.round(S.bimg.img.length * 0.75 / 1024)}KB)` : '이미지 없음 · 글 현수막 사용 중';
  $('#bnClearBtn').disabled = !S.bimg.img;
  $$('#stripSeg [data-v]').forEach(x => x.classList.toggle('on', x.dataset.v === S.live.strip));
  $('#optStripLogos').checked = !!S.live.stripLogos;
  const p = $('#biPanel');
  if(p.contains(document.activeElement) && document.activeElement.matches('input,textarea')) return;
  const it = (b.items || []).find(x => x.id === BI.sel);
  if(!it){ p.innerHTML = `<p class="muted small">${(b.items || []).length ? '현수막 위의 로고나 글을 누르면 여기서 크기·내용을 바꿀 수 있습니다.' : '후원사 로고나 글을 넣으면 현수막 위에 올라갑니다. 끌어서 원하는 자리에 놓으세요.'}</p>`; return; }
  const sz = it.type === 'img' ? `<label class="field grow"><span>크기 (화면 너비의 ${Math.round(it.w)}%)</span><input type="range" min="3" max="80" step="1" value="${it.w}" data-bi="w"></label>`
    : `<label class="field grow"><span>글자 크기 (${Math.round(it.fs)})</span><input type="range" min="16" max="200" step="2" value="${it.fs}" data-bi="fs"></label>`;
  const txt = it.type === 'txt' ? `<label class="field grow2"><span>글</span><input type="text" maxlength="60" value="${esc(it.text)}" data-bi="text"></label>
    <div class="field"><span>색</span><div class="seg sm">${Object.keys(BI_COLORS).map(k => `<button data-act="biSet" data-k="color" data-v="${k}" class="${it.color === k ? 'on' : ''}"><i class="cdot" style="background:${BI_COLORS[k]}"></i></button>`).join('')}</div></div>
    <div class="field"><span>모양</span><div class="seg sm"><button data-act="biSet" data-k="bold" data-v="${it.bold ? '' : '1'}" class="${it.bold ? 'on' : ''}">굵게</button><button data-act="biSet" data-k="font" data-v="${it.font === 'disp' ? 'body' : 'disp'}" class="${it.font === 'disp' ? 'on' : ''}">제목체</button><button data-act="biSet" data-k="box" data-v="${it.box ? '' : '1'}" class="${it.box ? 'on' : ''}">흰 바탕</button></div></div>` : '';
  p.innerHTML = `<div class="bi-edit"><b>${it.type === 'img' ? '로고' : '글'}</b>${txt}${sz}
    <div class="row"><button class="btn sm" data-act="biCenter">가운데로</button><button class="btn sm" data-act="biFront">맨 앞으로</button><button class="btn sm danger" data-act="biDel">빼기</button><button class="btn sm" data-act="biDone">다 됨</button></div></div>`;
}
function biUpdate(id, patch, live){
  S.banner.items = (S.banner.items || []).map(x => x.id === id ? { ...x, ...patch } : x);
  if(live){ const el = $(`#bannerEdit .bi[data-bid="${id}"]`); if(el){ if('x' in patch) el.style.left = patch.x + '%'; if('y' in patch) el.style.top = patch.y + '%'; if('w' in patch) el.style.width = patch.w + '%'; if('fs' in patch) el.style.fontSize = patch.fs + 'px'; } return; }
  saveBanner();
}
async function addLogos(files){
  for(const f of files){
    try{
      const img = await compressLogo(f), id = 'b' + uid();
      S.logos = { ...S.logos, [id]:img };
      await DB.set('logos/' + id, { img });
      const n = (S.banner.items || []).filter(x => x.type === 'img').length;
      S.banner.items = [...(S.banner.items || []), { id, type:'img', x:12 + (n % 5) * 19, y:86, w:13, text:'', fs:40, color:'white', bold:false, font:'body', box:false }];
      BI.sel = id; saveBanner();
    }catch(e){ toast(isDenied(e) ? '저장할 권한이 없습니다 (서버 규칙을 새 것으로 게시했는지 확인해 주세요)' : `${f.name}: 이미지를 읽지 못했습니다`); }
  }
}
async function compressLogo(file){
  const url = URL.createObjectURL(file); const img = new Image();
  try{ await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; }); }
  finally{ setTimeout(() => URL.revokeObjectURL(url), 1000); }
  let s = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  for(let a = 0; a < 6; a++){
    c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
    const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    const png = c.toDataURL('image/png'); if(png.length < 450000) return png;
    const webp = c.toDataURL('image/webp', 0.85); if(webp.startsWith('data:image/webp') && webp.length < 450000) return webp;
    s *= 0.75;
  }
  throw new Error('too big');
}
async function compressImage(file){
  const url = URL.createObjectURL(file); const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const s = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight)); let cw = Math.round(img.naturalWidth * s), ch = Math.round(img.naturalHeight * s);
  const c = document.createElement('canvas');
  for(let a = 0; a < 8; a++){
    c.width = cw; c.height = ch; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, cw, ch); x.drawImage(img, 0, 0, cw, ch);
    for(const qy of [0.88, 0.78, 0.68, 0.58]){ const d = c.toDataURL('image/jpeg', qy); if(d.length < 700000){ URL.revokeObjectURL(url); return d; } }
    cw = Math.round(cw * .8); ch = Math.round(ch * .8);
  }
  URL.revokeObjectURL(url); throw new Error('too big');
}
// 끌어서 옮기기 (현수막 꾸미기 화면)
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('#bannerEdit .bi'); if(!el) return;
  e.preventDefault();
  const wrap = $('#bannerEdit'), s = stageScale(wrap); if(!s) return;
  const it = (S.banner.items || []).find(x => x.id === el.dataset.bid); if(!it) return;
  BI.drag = { id:it.id, sx:e.clientX, sy:e.clientY, x0:it.x, y0:it.y, s, moved:false, pid:e.pointerId };
  try{ el.setPointerCapture(e.pointerId); }catch(x){}
  if(BI.sel !== it.id){ BI.sel = it.id; schedule(); }
});
document.addEventListener('pointermove', e => {
  const d = BI.drag; if(!d || e.pointerId !== d.pid) return;
  const dx = (e.clientX - d.sx) / d.s / 1600 * 100, dy = (e.clientY - d.sy) / d.s / 900 * 100;
  if(Math.abs(dx) + Math.abs(dy) > 0.2) d.moved = true;
  biUpdate(d.id, { x:Math.max(0, Math.min(100, d.x0 + dx)), y:Math.max(0, Math.min(100, d.y0 + dy)) }, true);
});
['pointerup', 'pointercancel'].forEach(ev => document.addEventListener(ev, e => { const d = BI.drag; if(!d || e.pointerId !== d.pid) return; BI.drag = null; if(d.moved) saveBanner(); }));

/* ---------- 시상 ---------- */
function renderAwardTab(){
  const box = $('#awList');
  if(!(box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT')){
    box.innerHTML = awardsList().map((a, i) => `<div class="aw-row" data-i="${i}"><input type="text" value="${esc(a.rank)}" data-aw="rank" placeholder="4 또는 5-10" aria-label="등수" class="aw-r"><span class="muted">등</span>
      <input type="text" value="${esc(a.title)}" data-aw="title" placeholder="상 이름" aria-label="상 이름" class="aw-t"><input type="text" value="${esc(a.prize)}" data-aw="prize" placeholder="상품" aria-label="상품" class="aw-p">
      <button class="btn sm" data-act="awUp" aria-label="위로">▲</button><button class="btn sm" data-act="awDown" aria-label="아래로">▼</button><button class="btn sm danger" data-act="awDel">빼기</button></div>`).join('');
  }
  const steps = awardSteps(), warns = tieWarnings();
  $('#awPreview').innerHTML = (warns.length ? `<div class="warn-box"><b>동점이 있습니다.</b> 결승 문제(문제 탭에서 구분 '결승')로 가린 뒤 발표하세요.<br>${warns.map(esc).join('<br>')}</div>` : '')
    + steps.map(a => `<div class="aw-pv"><b>${esc(a.rankLabel)} ${esc(a.title)}</b> <span class="muted small">${esc(a.prize)}</span><div>${a.people.length ? a.people.map(r => `${esc(r.p.name)} <small>${r.s}점${r.tb ? ` · 결승 ${r.tb}` : ''}</small>`).join(', ') : '<span class="muted">없음</span>'}</div></div>`).join('');
}
function awardsEdit(fn){ S.awards = clone(awardsList()); fn(S.awards); saveAwards(); }

/* ---------- 설정 ---------- */
function secOptions(sel){ return [30, 45, 60, 90, 120, 150, 180, 240].map(s => `<option value="${s}" ${s === sel ? 'selected' : ''}>${mmss(s)}</option>`).join(''); }
function renderSettings(){
  const L = S.live, cfg = L.cfg;
  $('#optTimer').checked = !!L.showTimer; $('#optAuthor').checked = !!L.showAuthor; $('#optAuto').checked = !!L.autoTimer;
  [['#secOx', 'ox'], ['#secChoice', 'choice'], ['#secShort', 'short']].forEach(([s, k]) => { const el = $(s); if(document.activeElement !== el) el.innerHTML = secOptions(Number(cfg[k])); });
  $$('#scaleSeg [data-v]').forEach(x => x.classList.toggle('on', Number(x.dataset.v) === Number(L.scale || 1)));
  $$('.theme-seg [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === (L.theme === 'day' ? 'day' : 'night')));
  const card = $('#sfxCard');
  if(card.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
  card.innerHTML = `<div class="card-h">소리 <span class="hint">효과음·배경음 파일은 이 PC의 브라우저에만 저장됩니다</span></div>
    <p class="muted small">방송 음원 같은 파일은 공개 저장소에 올릴 수 없어서, 진행자 PC에서 한 번 불러와 두면 같은 PC에서 연 프로젝터 창이 재생합니다. 프로젝터를 다른 PC에서 띄우면 그 PC에서도 불러와 주세요.</p>
    <div class="row"><label class="btn sm primary"><input type="file" id="sfxMulti" accept="audio/*" multiple hidden>소리 파일 여러 개 한꺼번에 불러오기</label><span class="muted small">파일 이름으로 자리를 찾아 넣습니다</span></div>
    <div class="sfx-list">${SFX_SLOTS.map(s => { const f = SFX.files[s.key]; return `<div class="sfx-row"><b>${s.name}</b><span class="muted small sfx-f">${f ? esc(f.name) + (f.dur ? ` · ${Math.round(f.dur)}초` : '') : '없음'}</span>
      <label class="btn sm"><input type="file" accept="audio/*" data-sfx="${s.key}" hidden>${f ? '바꾸기' : '불러오기'}</label>${f ? `<button class="btn sm" data-act="sfxTest" data-k="${s.key}">▶ 여기서</button><button class="btn sm" data-act="sfxRemote" data-k="${s.key}">▶ 프로젝터</button><button class="btn sm danger" data-act="sfxDel" data-k="${s.key}">지우기</button>` : ''}</div>`; }).join('')}</div>
    <div class="field"><span>시간이 다 되면</span><select id="cfgTimeup"><option value="both" ${cfg.timeup === 'both' ? 'selected' : ''}>땡! 다음에 '시간 끝' 파일</option><option value="bell" ${cfg.timeup === 'bell' ? 'selected' : ''}>땡!만</option><option value="file" ${cfg.timeup === 'file' ? 'selected' : ''}>'시간 끝' 파일만</option><option value="off" ${cfg.timeup === 'off' ? 'selected' : ''}>소리 없음</option></select></div>
    <label class="chk"><input type="checkbox" id="cfgReveal" ${cfg.revealSfx ? 'checked' : ''}> 정답 공개 때 '정답 발표' 소리(없으면 두구두구)가 끝난 뒤 정답 보이기</label>
    <div class="field"><span>음악 소리 크기</span><input type="range" id="cfgVol" min="0.1" max="1" step="0.05" value="${cfg.vol}"></div>
    <div class="row"><button class="btn sm" data-act="testBell">땡 들어 보기</button><button class="btn sm" data-act="testDrum">두구두구 들어 보기</button><button class="btn sm" data-act="testBellRemote">프로젝터에서 땡</button></div>`;
}
function saveCSV(){
  const rows = rankRows(), qs = S.qs.list.filter(q => q.kind === 'main' || q.kind === 'final');
  const head = ['순위', '이름', '좌석', '점수', '1부', '2부', '결승', '보정', ...qs.map(q => qTitle(S.qs.list.indexOf(q)))];
  const lines = [head, ...rows.map(r => [r.rank + (r.tied ? '(동점)' : ''), r.p.name, seatLabel(r.seat), r.s, r.p1, r.p2, r.tb, S.seats.adjust?.[r.p.id] || 0, ...qs.map(q => isMarked(markFor(q, r.p.id)) ? 'O' : '')])];
  const csv = '﻿' + lines.map(l => l.map(v => { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' })); a.download = '점자골든벨_결과.csv';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('결과 표를 저장했습니다 (다운로드 폴더)');
}
async function resetScores(){ S.marks = {}; S.done = {}; S.seats.adjust = {}; saveSeats(); schedule(); try{ await DB.remove('marks'); await DB.remove('done'); toast('정답 체크와 점수를 모두 지웠습니다'); }catch(e){ writeErr(e); } }

/* ===================== 화면 전환 ===================== */
function showRole(r){
  ROLE = ['screen', 'host', 'staff'].includes(r) ? r : '';
  $('#vPick').hidden = !!ROLE; $('#vScreen').hidden = ROLE !== 'screen'; $('#vHost').hidden = ROLE !== 'host'; $('#vStaff').hidden = ROLE !== 'staff';
  document.body.classList.toggle('screen-mode', ROLE === 'screen');
  if(ROLE) ss.set('role', ROLE);
  if(ROLE === 'screen'){ $('#screenStart').hidden = fsActive(); screenStartDraw(); musicFollow(); }
  else musicStop(true);
  ensureAccess(ROLE);
  pushPresence(); syncZonep(); schedule(); paintInstall();
}
function setRole(r){ try{ if(location.hash !== '#' + r) history.replaceState(null, '', '#' + r); }catch(e){} showRole(r); }
function route(){ const h = (location.hash || '').replace('#', ''); if(['screen', 'host', 'staff'].includes(h)) showRole(h); else if(h === 'pick' || !ss.get('role')) showRole(''); else showRole(ss.get('role')); }
addEventListener('hashchange', route);
const TABS = ['run', 'ann', 'qs', 'seat', 'staff', 'banner', 'award', 'set'];
function setTab(t){ $$('#hostTabs [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t)); TABS.forEach(x => $('#tab-' + x).hidden = x !== t); if(t === 'qs') renderEditor(true); schedule(); }

/* 점수 보정 창: 진행 좌석표 길게 누르기 · 점수 현황 배치도 누르기 */
let lpTimer = null, lpFired = false, popPid = null;
document.addEventListener('pointerdown', e => { const s = e.target.closest('#hostSeats [data-pid]'); if(!s) return; lpFired = false; clearTimeout(lpTimer); lpTimer = setTimeout(() => { lpFired = true; openPop(s.dataset.pid, e.clientX, e.clientY); }, 600); });
['pointerup', 'pointercancel'].forEach(ev => document.addEventListener(ev, () => clearTimeout(lpTimer), true));
document.addEventListener('contextmenu', e => { const s = e.target.closest('#hostSeats [data-pid]'); if(!s) return; e.preventDefault(); openPop(s.dataset.pid, e.clientX, e.clientY); });
function openPop(pid, x, y){
  popPid = pid; const p = peopleMap()[pid]; if(!p) return; const pop = $('#pop');
  pop._draw = () => { const r = rankRows().find(z => z.p.id === pid) || {}; pop.innerHTML = `<div class="pn">${esc(p.name)} <span class="muted small">${esc(seatLabel(seatOf()[pid]))} · ${r.rank || '-'}등</span></div><div class="ps">${r.s || 0}점</div><div class="muted small">문제와 상관없이 점수를 더하거나 뺍니다 (보정 ${S.seats.adjust?.[pid] || 0})</div><div class="row"><button class="btn" data-act="popAdj" data-d="-1">−1점</button><button class="btn" data-act="popAdj" data-d="1">+1점</button><div class="sp"></div><button class="btn sm" data-act="popClose">닫기</button></div>`; };
  pop._draw(); pop.hidden = false; const r = pop.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(innerWidth - r.width - 8, x - r.width / 2)) + 'px'; pop.style.top = Math.max(8, Math.min(innerHeight - r.height - 8, y + 12)) + 'px';
}
const closePop = () => { $('#pop').hidden = true; popPid = null; };

/* ===================== 누르기 ===================== */
document.addEventListener('click', e => {
  const pop = $('#pop'); if(!pop.hidden && !pop.contains(e.target) && !e.target.closest('#hostSeats') && !e.target.closest('[data-act="scorePop"]')) closePop();
  const lsd = e.target.closest('#layoutSeats [data-seat]');
  if(lsd && !e.target.closest('[data-act="unseat"]')){ if(selPid){ place(selPid, lsd.dataset.seat); return; } if(lsd.dataset.pid){ selPid = lsd.dataset.pid; schedule(); return; } }
  if(e.target.closest('#bannerEdit') && !e.target.closest('.bi') && BI.sel){ BI.sel = null; schedule(); }
  const el = e.target.closest('[data-act]'); if(!el) return;
  const a = el.dataset.act;
  if(e.detail > 0 && el.tagName === 'BUTTON' && (ROLE === 'host' || ROLE === 'screen')) el.blur();
  switch(a){
    case 'role': setRole(el.dataset.r); break;
    case 'reload': location.reload(); break;
    case 'pick': setRole('pick'); break;
    case 'tab': setTab(el.dataset.t); break;
    case 'fsToggle': FS.toggle(); break;
    case 'install': installSheet(); break;
    case 'installLater': UIP.installDismissed = true; saveUIP(); paintInstall(); toast('아래 "홈 화면에 설치하기"로 언제든 설치할 수 있어요'); break;
    case 'settings': settingsSheet(); break;
    case 'openScreen': openScreenFlow(); break;
    case 'ssGo': screenGo(+el.dataset.i); break;
    case 'ssLoad': loadScreens().then(screenStartDraw); break;
    case 'screenPick': $('#screenStart').hidden = false; screenStartDraw(); break;
    case 'stepNext': stepNext(); break;
    case 'stepPrev': stepPrev(); break;
    case 'mode': setMode(el.dataset.m); break;
    case 'jump': goQ(+el.dataset.i, 'question'); break;
    case 'tToggle': tToggle(); break;
    case 'tReset': tReset(); break;
    case 'tPlus': tPlus(); break;
    case 'music': toggleMusic(el.dataset.k); break;
    case 'mark': if(lpFired){ lpFired = false; return; } toggleMark(el.dataset.pid); break;
    case 'scorePop': { const r = el.getBoundingClientRect(); openPop(el.dataset.pid, r.left + r.width / 2, r.bottom); break; }
    case 'popAdj': if(popPid){ adjust(popPid, +el.dataset.d); setTimeout(() => { const p = $('#pop'); p._draw && p._draw(); }, 0); } break;
    case 'popClose': closePop(); break;
    case 'annSend': annSend($('#annText').value); break;
    case 'annSave': { const t = $('#annText').value.trim().slice(0, 120); if(!t){ toast('문구를 적어 주세요'); break; } if(!S.favs.includes(t)){ S.favs = [...S.favs, t]; saveFavs(); } toast('자주 쓰는 문구에 저장했습니다'); break; }
    case 'annClear': setLive({ ann:null }); toast('문구를 내렸습니다'); break;
    case 'favSend': { const t = S.favs[+el.dataset.i]; if(t) annSend(t); break; }
    case 'favEdit': { const t = S.favs[+el.dataset.i]; if(t != null){ $('#annText').value = t; S.favs = S.favs.filter((_, i) => i !== +el.dataset.i); saveFavs(); $('#annText').focus(); toast('위 칸에서 고친 뒤 다시 저장하세요'); } break; }
    case 'favDel': if(arm(el, 'fav' + el.dataset.i, '정말 지우기')){ S.favs = S.favs.filter((_, i) => i !== +el.dataset.i); saveFavs(); } break;
    case 'ttPreset': { const p = TITLE_PRESETS[+el.dataset.i]; $('#ttText').value = p[0]; $('#ttSub').value = p[1]; setLive({ mode:'title', title:{ text:p[0], sub:p[1] } }); toast(`'${p[0]}' 화면을 띄웠습니다`); break; }
    case 'ttShow': { const t = $('#ttText').value.trim(); if(!t){ toast('큰 글씨를 적어 주세요'); break; } setLive({ mode:'title', title:{ text:t.slice(0, 40), sub:$('#ttSub').value.trim().slice(0, 80) } }); toast('안내 화면을 띄웠습니다'); break; }
    case 'parse': doParse(); break;
    case 'parseAppend': if(parsed.length){ S.qs.list = [...S.qs.list, ...parsed]; parseDone('목록 뒤에 추가했습니다'); } break;
    case 'parseReplace': if(parsed.length && arm(el, 'replace', '한 번 더 누르면 기존 문제를 모두 바꿉니다')){ S.qs.list = parsed; if(S.live.qi >= S.qs.list.length) setLive({ qi:0 }); parseDone('전체를 바꿨습니다'); } break;
    case 'qAdd': { const last = S.qs.list.at(-1); S.qs.list = [...S.qs.list, { id:'q' + uid(), type:'ox', kind:last ? last.kind : 'main', part:last ? last.part : '1', secs:0, author:last?.author || '', text:'', choices:[], answer:'', expl:'', dots:'', memo:'' }]; saveQs(); renderEditor(true); setTimeout(() => { const t = $$('#qList .qe textarea[data-f="text"]').pop(); t && t.focus(); }, 30); break; }
    case 'qShow': case 'qUp': case 'qDown': case 'qDel': {
      const card = el.closest('.qe'); const i = S.qs.list.findIndex(x => x.id === card.dataset.qid); if(i < 0) break;
      if(a === 'qShow'){ goQ(i, 'question'); toast(`${qTitle(i)}를 띄웠습니다`); renderEditor(true); break; }
      if(a === 'qDel'){ if(!arm(el, 'del' + card.dataset.qid, '정말 삭제')) break; S.qs.list = S.qs.list.filter((_, j) => j !== i); if(S.live.qi >= S.qs.list.length && S.qs.list.length) setLive({ qi:S.qs.list.length - 1 }); }
      else { const j = a === 'qUp' ? i - 1 : i + 1; if(j < 0 || j >= S.qs.list.length) break; const L = S.qs.list.slice(); [L[i], L[j]] = [L[j], L[i]]; S.qs.list = L; }
      saveQs(); renderEditor(true); break; }
    case 'scoreView': scoreView = el.dataset.v; ls.set('scoreView', scoreView); schedule(); break;
    case 'preset': setGrid(+el.dataset.r, +el.dataset.c); break;
    case 'autoSeat': autoSeat(); break;
    case 'clearSeats': if(arm(el, 'clearSeats', '한 번 더 누르면 모두 비웁니다')){ S.seats.map = {}; saveSeats(); } break;
    case 'addPeople': addPeople(); break;
    case 'selChip': selPid = selPid === el.dataset.pid ? null : el.dataset.pid; schedule(); break;
    case 'unseat': e.stopPropagation(); unseat(el.dataset.pid); break;
    case 'adj': adjust(el.dataset.pid, +el.dataset.d); break;
    case 'pDel': if(arm(el, 'pdel' + el.dataset.pid, '정말 빼기')){ const pid = el.dataset.pid; S.seats.people = S.seats.people.filter(p => p.id !== pid); unseat(pid); } break;
    case 'selStaff': selStaff = selStaff === el.dataset.u ? null : el.dataset.u; schedule(); break;
    case 'assignSeat': assignSeat(el.dataset.k); break;
    case 'assignRow': assignRow(+el.dataset.r); break;
    case 'assignClear': if(arm(el, 'assignClear', '한 번 더 누르면 모두 지웁니다')){ S.assign = {}; saveAssign(); } break;
    case 'bnClear': if(arm(el, 'bnClear', '한 번 더 누르면 지웁니다')){ S.bimg = { img:'', rev:now() }; save('bannerimg', () => null); schedule(); } break;
    case 'biAddText': { const id = 'b' + uid(); S.banner.items = [...(S.banner.items || []), { id, type:'txt', x:50, y:93, w:14, text:'후원: ', fs:36, color:'white', bold:true, font:'body', box:false }]; BI.sel = id; saveBanner(); setTimeout(() => { const t = $('#biPanel [data-bi="text"]'); if(t){ t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }, 150); break; }
    case 'biSet': if(BI.sel){ const k = el.dataset.k, v = el.dataset.v; biUpdate(BI.sel, { [k]:k === 'color' || k === 'font' ? v : !!v }); } break;
    case 'biCenter': if(BI.sel) biUpdate(BI.sel, { x:50 }); break;
    case 'biFront': if(BI.sel){ const it = S.banner.items.find(x => x.id === BI.sel); S.banner.items = [...S.banner.items.filter(x => x.id !== BI.sel), it]; saveBanner(); } break;
    case 'biDel': if(BI.sel){ const id = BI.sel, it = S.banner.items.find(x => x.id === id); S.banner.items = S.banner.items.filter(x => x.id !== id); BI.sel = null; saveBanner(); if(it && it.type === 'img') save('logos/' + id, () => null); } break;
    case 'biDone': BI.sel = null; schedule(); break;
    case 'strip': setLive({ strip:el.dataset.v }); break;
    case 'scale': setLive({ scale:Number(el.dataset.v) }); break;
    case 'theme': setLive({ theme:el.dataset.v === 'day' ? 'day' : 'night' }); toast(el.dataset.v === 'day' ? '프로젝터를 낮(밝은 바탕) 화면으로 바꿨습니다' : '프로젝터를 밤(어두운 바탕) 화면으로 바꿨습니다'); break;
    case 'awAdd': awardsEdit(L => L.push({ rank:'', title:'', prize:'' })); break;
    case 'awDefault': if(arm(el, 'awDef', '한 번 더 누르면 되돌립니다')){ S.awards = clone(DEFAULT_AWARDS); saveAwards(); } break;
    case 'awUp': case 'awDown': case 'awDel': { const i = +el.closest('.aw-row').dataset.i; awardsEdit(L => { if(a === 'awDel') L.splice(i, 1); else { const j = a === 'awUp' ? i - 1 : i + 1; if(j >= 0 && j < L.length) [L[i], L[j]] = [L[j], L[i]]; } }); break; }
    case 'awStart': if(tieWarnings().length) toast('동점이 남아 있습니다. 결승 문제로 가린 뒤 발표하세요.'); setLive({ mode:'award', award:{ i:0, show:false } }); setTab('run'); break;
    case 'testBell': SND.unlock(); SND.bell(); break;
    case 'testDrum': SND.unlock(); SND.drumroll(1.6); break;
    case 'testBellRemote': setLive({ sfx:{ id:uid(), key:'bell', at:srvNow() } }); break;
    case 'sfxTest': { SND.unlock(); sfxPlay(el.dataset.k, 0.9); break; }
    case 'sfxRemote': setLive({ sfx:{ id:uid(), key:el.dataset.k, at:srvNow() } }); toast('프로젝터 창에서 재생합니다'); break;
    case 'sfxDel': if(arm(el, 'sfx' + el.dataset.k, '정말 지우기')) sfxDelete(el.dataset.k); break;
    case 'csv': saveCSV(); break;
    case 'resetScores': if(arm(el, 'reset', '한 번 더 누르면 모두 지웁니다')) resetScores(); break;
    case 'setStaffPw': { const pw = $('#staffPwIn').value.trim(); if(pw.length < 4){ toast('4자 이상으로 정해 주세요'); break; } DB.set('secret/staffPw', pw).then(() => { ls.set('staffPwAt', now()); $('#staffPwIn').value = ''; toast('직원 비밀번호를 정했습니다'); schedule(); }).catch(writeErr); break; }
    case 'grant': DB.set('staffs/' + el.dataset.u, { name:(el.dataset.n || '직원').slice(0, 20), by:'host', at:srvNow() }).then(() => toast('직원으로 승인했습니다')).catch(writeErr); break;
    case 'unstaff': if(arm(el, 'un' + el.dataset.u, '정말 빼기')) DB.remove('staffs/' + el.dataset.u).then(() => toast('승인을 뺐습니다')).catch(writeErr); break;
    case 'radioCut': DB.forceRelease().then(() => toast('무전을 끊었습니다')).catch(writeErr); break;
    case 'rq': sendMsg(el.dataset.t); break;
    case 'staffLogin': loginStaffSheet(); break;
    case 'staffSetup': $('#staffSetup').hidden = !$('#staffSetup').hidden; $('#meName').value = ME.name; break;
    case 'staffSave': { const n = $('#meName').value.trim().slice(0, 20); if(n){ ME.name = n; ls.set('name', n); } $('#staffSetup').hidden = true; pushPresence(); schedule(); toast('저장했습니다'); break; }
    case 'myDone': toggleDone(); break;
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  const cfg = patch => setLive({ cfg:{ ...S.live.cfg, ...patch } });
  if(t.id === 'optTimer') setLive({ showTimer:t.checked });
  else if(t.id === 'optAuthor') setLive({ showAuthor:t.checked });
  else if(t.id === 'optAuto') setLive({ autoTimer:t.checked });
  else if(t.id === 'optStripLogos') setLive({ stripLogos:t.checked });
  else if(t.id === 'secOx') cfg({ ox:+t.value }); else if(t.id === 'secChoice') cfg({ choice:+t.value }); else if(t.id === 'secShort') cfg({ short:+t.value });
  else if(t.id === 'cfgTimeup') cfg({ timeup:t.value });
  else if(t.id === 'cfgReveal') cfg({ revealSfx:t.checked });
  else if(t.id === 'cfgVol'){ cfg({ vol:+t.value }); const m = S.live.music; if(m && m.on) setLive({ music:{ ...m, vol:+t.value } }); }
  else if(t.id === 'rowsIn' || t.id === 'colsIn') setGrid(+$('#rowsIn').value, +$('#colsIn').value);
  else if(t.id === 'showAll'){ showAllSeats = t.checked; schedule(); }
  else if(t.id === 'bnFile' && t.files && t.files[0]){
    compressImage(t.files[0]).then(d => { S.bimg = { img:d, rev:now() }; save('bannerimg', () => ({ img:S.bimg.img, rev:S.bimg.rev })); schedule(); toast('현수막 이미지를 올렸습니다'); })
      .catch(() => toast('이미지를 읽지 못했습니다. JPG나 PNG로 다시 올려 주세요.'));
    t.value = '';
  }
  else if(t.id === 'logoFile' && t.files && t.files.length){ addLogos(Array.from(t.files)); t.value = ''; }
  else if(t.id === 'sfxMulti' && t.files && t.files.length){
    const fs = Array.from(t.files); t.value = '';
    (async () => { const done = [], skip = []; for(const f of fs){ const k = sfxGuess(f.name); if(k){ await sfxSave(k, f); done.push(SFX_SLOTS.find(s => s.key === k).name); } else skip.push(f.name); }
      toast(`${done.length}개를 넣었습니다${skip.length ? ` · 자리를 못 찾은 파일 ${skip.length}개는 아래에서 직접 넣어 주세요` : ''}`); })();
  }
  else if(t.dataset.sfx && t.files && t.files[0]){ const k = t.dataset.sfx, f = t.files[0]; t.value = ''; sfxSave(k, f).then(() => toast('소리 파일을 넣었습니다')); }
});
document.addEventListener('input', e => {
  const t = e.target, bn = { bnL1:'l1', bnL2:'l2', bnSub:'sub', bnInfo:'info' }[t.id];
  if(bn){ S.banner[bn] = t.value; saveBanner(); return; }
  if(t.dataset.pname){ const p = S.seats.people.find(x => x.id === t.dataset.pname); if(p){ p.name = t.value.slice(0, 20); saveSeats(); } return; }
  if(t.dataset.bi && BI.sel){ const k = t.dataset.bi; const v = k === 'text' ? t.value : Number(t.value); biUpdate(BI.sel, { [k]:v }, k !== 'text'); if(k === 'text') paintStage($('#bannerEdit'), 'banner', { noAnn:true, edit:true }); clearTimeout(BI.saveT); BI.saveT = setTimeout(saveBanner, 400); const lbl = t.closest('.field') && t.closest('.field').querySelector('span'); if(lbl && k === 'w') lbl.textContent = `크기 (화면 너비의 ${Math.round(v)}%)`; if(lbl && k === 'fs') lbl.textContent = `글자 크기 (${Math.round(v)})`; return; }
  if(t.dataset.aw){ const i = +t.closest('.aw-row').dataset.i, k = t.dataset.aw; S.awards = clone(awardsList()); S.awards[i][k] = t.value.slice(0, 60); clearTimeout(BI.awT); BI.awT = setTimeout(saveAwards, 500); $('#awPreview') && renderAwardTab(); }
});
document.addEventListener('keydown', e => { const c = e.target.closest && e.target.closest('.chip[data-pid]'); if(c && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); c.click(); } });
$('#peopleIn').addEventListener('keydown', e => { if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addPeople(); });
let idleT = null; document.addEventListener('mousemove', () => { document.body.classList.remove('idle'); clearTimeout(idleT); if(ROLE === 'screen') idleT = setTimeout(() => document.body.classList.add('idle'), 3000); });

/* ===================== 시작 ===================== */
async function boot(){
  observeStages(); route(); paintInstall();
  if(DEMO) $$('.demo-note').forEach(x => x.hidden = false);
  try{ DB = DEMO ? demoDB() : await firebaseDB(); }
  catch(e){ console.error(e); $$('.pill.net').forEach(el => { el.className = 'pill net bad'; el.textContent = '서버에 연결하지 못했습니다'; }); toast('서버에 연결하지 못했습니다. 인터넷을 확인한 뒤 새로 고침해 주세요.'); return; }
  onNetChange();
  subscribeBase();
  let gotM = false, gotS = false;
  const settle = () => { if(gotM && gotS && !ME.known){ ME.known = true; onRoleChange(); } else if(ME.known) onRoleChange(); };
  DB.on('masters/' + DB.uid, v => { ME.master = v != null; gotM = true; settle(); }, () => { ME.master = false; gotM = true; settle(); });
  DB.on('staffs/' + DB.uid, v => { ME.staff = v != null; gotS = true; if(v && v.name && !ME.name){ ME.name = String(v.name); ls.set('name', ME.name); } settle(); }, () => { ME.staff = false; gotS = true; settle(); });
  setTimeout(() => { if(!ME.known){ gotM = gotS = true; settle(); } }, 6000);
}
boot();
