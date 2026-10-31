'use strict';
/* ===================== 셔틀: 목적지 접근 알림 · 운전자·보조 화면 · 마스터 셔틀·채널 설정 =====================
   - 운전자(담당자 명단의 무전 채널 + 셔틀 역할 '운전자') 기기는 이 화면이 열려 있는 동안 위치를 받아 선택한 목적지까지 남은 거리를 보여 주고,
     정한 거리(예: 300m)에 처음 들어서면 그 채널 사람과 운영진에게 문자(kind 'shuttle', to 'ch:<채널번호>')를 한 번 보냄.
   - 위치(좌표)는 계속 공유하지 않음. 운전자 기기가 15초마다 '내 기기 문서'(main/devices/내번호)에 신호 시각·목적지 이름·남은 거리만 적고,
     보조·마스터·운영 현황 기기는 그 신호가 끊겼는지만 봄.
   - 화면이 보이지 않으면 브라우저가 위치를 주지 않으므로, 화면 분할(삼성: 분할 화면·팝업 화면)로 함께 띄워 쓰도록 안내함. */
const SH_MAX_ACC = 150;        // 이보다 정확도가 나쁜 위치로는 알림을 판단하지 않음 (m)
const SH_REARM_M = 150;        // 알림을 보낸 뒤 이만큼 더 멀어져야(알림 거리 + 150m) 같은 알림을 다시 보낼 수 있음
const SH_HB_MS = 15000;        // 운전자 신호를 적는 간격
const SH_STALE_MS = 60000;     // 이보다 오래 신호가 없으면 '끊김'
const SH_NOFIX_MS = 30000;     // 이보다 오래 위치를 못 받으면 운전자 화면에 큰 경고

// 처음에 채워 두는 목적지. 좌표는 지도 자료(위키백과 낙성대역·낙성대 좌표)에서 가져온 대략값이라 현장에서 '지금 위치로 저장'으로 맞춰야 함
const DEFAULT_DESTS = [
  { id:'dasi', name:'다시가는 캠퍼스', lat:37.4712, lng:126.9600, alerts:[300], cal:'', acc:0 },
  { id:'nak4', name:'낙성대역 4번 출구', lat:37.4770, lng:126.9637, alerts:[300], cal:'', acc:0 },
];
const SH = { watch:0, pos:null, fixAt:0, started:0, err:'', dist:null, arm:{}, hbAt:0, tick:0, lastAlert:null, drv:{}, vis:true };

/* ---------- 목적지 ---------- */
// 이름 앞뒤의 따옴표·글머리 기호·공백을 걷어 냄 (붙여넣은 글 정리)
const cleanName = s => String(s ?? '').replace(/[​ ]/g, ' ').replace(/^[\s"'“”‘’`*•·\-–—_,;:|/\\>]+|[\s"'“”‘’`*•·\-–—_,;:|/\\<]+$/g, '').replace(/\s+/g, ' ').trim();
const fin = v => v !== null && v !== '' && v !== undefined && isFinite(Number(v));
function shuttleDests(){
  const sh = D.config.shuttle, list = (sh && Array.isArray(sh.dests)) ? sh.dests : DEFAULT_DESTS;
  return list.filter(d => d && d.id && d.name).map(d => ({
    id:String(d.id), name:String(d.name), lat: fin(d.lat) ? +d.lat : null, lng: fin(d.lng) ? +d.lng : null,
    alerts: (Array.isArray(d.alerts) ? d.alerts : [300]).map(Number).filter(n => n > 0 && n <= 100000).sort((a, b) => b - a),
    cal: d.cal || '', acc: +d.acc || 0 }));
}
const shDest = () => { const l = shuttleDests(), id = idStore.get('udh5_shdest', ''); return (l.find(d => d.id===id) || l[0] || {}).id || ''; };
const shCurDest = () => shuttleDests().find(d => d.id===shDest()) || null;
function haversine(a, b, c, d){
  const R = 6371000, r = x => x * Math.PI / 180, dLat = r(c - a), dLng = r(d - b);
  const h = Math.sin(dLat/2)**2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
// 820m · 1.2km (10m 단위로 어림)
function fmtDist(m){
  if(!fin(m)) return '-';
  m = Number(m);
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.max(0, Math.round(m / 10) * 10)}m`;
}
// '37.4712, 126.9600' 같은 붙여넣은 글에서 위도·경도를 뽑음
function parseCoord(text){
  const n = String(text ?? '').match(/-?\d+(?:\.\d+)?/g);
  if(!n || n.length < 2) return null;
  const lat = +n[0], lng = +n[1];
  return (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) ? { lat, lng } : null;
}

/* ---------- 이 기기의 셔틀 역할 ---------- */
// 'driver'(운전자) · 'helper'(보조) · '' : 맡은 종목이 없는 채널 기기만 셔틀 화면을 씀
function shuttleMode(){
  if(!store || !UI.me || D.amMaster) return '';
  const r = myRole(); if(r.role!=='wait') return '';
  const m = myCh(); return (m && m.sr) ? m.sr : '';
}
const shuttleScreenOn = r => r.role==='wait' && !r.offDuty && !!shuttleMode();

/* ---------- 위치 받기 (운전자 기기) ---------- */
function shGpsStart(){
  if(SH.watch) return;
  SH.started = now(); SH.err = '';
  if(!('geolocation' in navigator)){ SH.err = 'unsupported'; return; }
  try{ SH.watch = navigator.geolocation.watchPosition(shOnPos, shOnErr, { enableHighAccuracy:true, maximumAge:5000, timeout:30000 }); }
  catch(e){ SH.err = 'fail'; }
  if(typeof keepAwake==='function') keepAwake();                 // 화면이 꺼지지 않게 (실패해도 조용히 넘어감)
}
function shGpsStop(){
  if(SH.watch){ try{ navigator.geolocation.clearWatch(SH.watch); }catch(e){} }
  SH.watch = 0; SH.pos = null; SH.fixAt = 0; SH.dist = null; SH.arm = {}; SH.err = '';
}
function shOnPos(p){
  const c = p.coords;
  SH.pos = { lat:c.latitude, lng:c.longitude, acc:c.accuracy || 0 }; SH.fixAt = now(); SH.err = '';
  shEvaluate(); shuttleUpdate();
}
function shOnErr(e){ SH.err = (e && e.code===1) ? 'denied' : 'fail'; shuttleUpdate(); }
// 알림 판단: 처음 본 거리가 이미 안쪽이면 알리지 않고 기다림. 바깥에서 안쪽으로 처음 들어설 때 한 번 보내고,
// 알림 거리 + 150m보다 멀어지거나 목적지를 바꾸면 다시 보낼 수 있음
function shEvaluate(){
  if(shuttleMode()!=='driver' || !SH.pos) return;
  const d = shCurDest(); if(!d || d.lat==null) { SH.dist = null; return; }
  const dist = SH.dist = haversine(SH.pos.lat, SH.pos.lng, d.lat, d.lng);
  if(SH.pos.acc > SH_MAX_ACC) return;
  const A = (SH.arm[d.id] ||= {});
  Object.keys(A).forEach(k => { if(!d.alerts.includes(+k)) delete A[k]; });
  d.alerts.forEach(th => {
    const st = A[th];
    if(st===undefined) A[th] = dist > th;
    else if(st===true && dist <= th){ A[th] = false; shSendAlert(d, th); }
    else if(st===false && dist > th + SH_REARM_M) A[th] = true;
  });
}
function shSendAlert(d, th){
  const m = myCh(); if(!m) return;
  const text = `셔틀이 ${d.name} 약 ${th}m 앞입니다`;
  SH.lastAlert = { text, at:now() };
  sendMsg(text, 'ch:' + m.ch, 'shuttle', true);
  vib([120, 60, 120]); toast(`${th}m 앞 알림을 보냈습니다.`);
}
// 운전자 신호: 좌표 없이 시각·목적지 이름·남은 거리만
function shHeartbeat(){
  if(shuttleMode()!=='driver' || !SH.pos || now() - SH.fixAt > SH_NOFIX_MS || now() - SH.hbAt < SH_HB_MS) return;
  const d = shCurDest(); SH.hbAt = now();
  store.put(['main','devices',store.uid], { gpsAt:now(), gpsDest: d ? d.name : '', gpsDist: SH.dist==null ? null : Math.round(SH.dist) }).catch(() => {});
}
// 위치를 못 받고 있는가: 큰 경고를 띄울 이유
function shWarnWhy(){
  if(SH.err==='denied') return '위치 권한이 꺼져 있습니다. 브라우저(또는 휴대폰) 설정에서 위치를 허용해 주세요.';
  if(SH.err==='unsupported') return '이 브라우저에서는 위치를 쓸 수 없습니다.';
  if(!SH.watch) return '';
  const base = SH.fixAt || SH.started;
  if(base && now() - base > SH_NOFIX_MS) return SH.err==='fail' ? '위치를 받지 못하고 있습니다.' : `${Math.floor((now() - base) / 1000)}초째 위치를 받지 못하고 있습니다.`;
  return '';
}

/* ---------- 운전자 신호 보기 (보조·마스터·운영 현황) ---------- */
// 운전자 기기 번호들: 담당자 명단(또는 기기별 설정)에서 셔틀 운전자로 정한 기기
const shDrivers = () => Object.keys(D.roles).filter(id => { const c = chInfoOf(id); return c && c.sr==='driver'; });
function shuttleSubs(){
  if(!store || !UI.me) return;
  const need = (D.amMaster || shuttleMode()==='helper' || (myRole().monitor)) ? shDrivers() : [];
  Object.keys(SH.drv).forEach(id => { if(!need.includes(id)){ try{ SH.drv[id].unsub && SH.drv[id].unsub(); }catch(e){} delete SH.drv[id]; } });
  need.forEach(id => {
    if(SH.drv[id]) return;
    const o = SH.drv[id] = { data:null, unsub:null };
    o.unsub = store.onDoc(['main','devices',id], d => { o.data = d; shuttleUpdate(); }, e => console.error(e));
  });
}
function shDriverStatus(id){
  const o = SH.drv[id], d = o && o.data, name = (D.roles[id] || {}).name || '운전자';
  if(!d || !d.gpsAt || now() - d.gpsAt > 6*3600000) return { ok:false, name, text:'운전자 위치 신호 없음(아직 시작 전)' };
  const age = Math.max(0, Math.round((now() - d.gpsAt) / 1000));
  if(age * 1000 > SH_STALE_MS) return { ok:false, name, text:'운전자 위치 신호 끊김(1분 넘게 없음)' };
  return { ok:true, name, text:`셔틀: ${d.gpsDest || '목적지'}까지 ${fmtDist(d.gpsDist)} · ${age}초 전` };
}
function shStatusHtml(){
  const ids = shDrivers();
  if(!ids.length) return '<div class="shline off">셔틀 운전자가 정해져 있지 않습니다.</div>';
  return ids.map(id => { const s = shDriverStatus(id); return `<div class="shline ${s.ok?'ok':'bad'}">${ids.length > 1 ? `<small>${esc(s.name)}</small> ` : ''}${esc(s.text)}</div>`; }).join('');
}
// 진행 현황 위쪽에 붙는 한 줄 (마스터·운영 현황)
function shuttleProgCard(){
  const ids = shDrivers(); if(!ids.length) return '';
  return `<div class="card shprog"><div class="row nowrap"><h2 class="grow h2" style="margin:0">🚌 셔틀</h2></div><div class="shstat" data-shstat>${shStatusHtml()}</div></div>`;
}

/* ---------- 화면: 운전자 · 보조 ---------- */
const shAlertsHtml = () => {
  const m = myCh(); if(!m) return '';
  const l = D.msgs.filter(x => x.kind==='shuttle' && x.to==='ch:' + m.ch).sort((a, b) => (b.at||0) - (a.at||0)).slice(0, 3);
  return l.map(x => `<div class="shal"><span>${hm(x.at)}</span><b>${esc(x.text||'')}</b></div>`).join('') || '<div class="shal none">아직 받은 셔틀 알림이 없습니다.</div>';
};
function shPttHtml(){
  return `<div class="shptt"><div class="seg shtg" id="shtg" role="group" aria-label="말할 곳"></div>
    <button class="wkbig shbig" id="shbtn" data-kind="radio"><span class="ic"></span><span class="lb"></span><span class="hint"></span></button></div>`;
}
function shuttleBody(){
  const mode = shuttleMode();
  if(mode==='driver'){
    const dests = shuttleDests(), cur = shDest();
    const dh = dests.length > 1
      ? `<div class="shdests" role="group" aria-label="목적지">${dests.map(d => `<button class="${d.id===cur?'on':''}" data-a="shDest" data-v="${esc(d.id)}" aria-pressed="${d.id===cur}">${esc(d.name)}</button>`).join('')}</div>`
      : `<div class="shdests one"><b>${esc((dests[0] || {}).name || '목적지 없음')}</b></div>`;
    return `<div class="shut driver" id="shut">
      <div class="shwarn" id="shwarn" role="alert" hidden></div>
      ${dh}
      <div class="shdist"><small>남은 거리</small><b id="shdist">-</b></div>
      <div class="shgps" id="shgps"></div>
      ${shPttHtml()}
      <button class="shhelp" data-a="shHelp">화면 분할 방법</button>
    </div>`;
  }
  return `<div class="shut helper" id="shut">
    <div class="shstat" id="shstat" data-shstat>${shStatusHtml()}</div>
    <div class="shalerts" id="shalerts"><small>최근 셔틀 알림</small>${shAlertsHtml()}</div>
    ${shPttHtml()}
  </div>`;
}
// 화면을 다시 그리지 않고 바뀐 글자만 고침 (누르고 말하는 단추가 사라지지 않게)
function shuttleUpdate(){
  const set = (id, fn) => { const el = document.getElementById(id); if(el) fn(el); };
  set('shdist', el => {
    const d = shCurDest();
    const t = !d ? '목적지 없음' : d.lat==null ? '좌표 없음' : !SH.pos ? '확인 중' : fmtDist(SH.dist);
    if(el.textContent!==t) el.textContent = t;
  });
  set('shgps', el => {
    const d = shCurDest(), al = d && d.alerts.length ? `알림 ${d.alerts.map(a => a + 'm').join('·')}` : '알림 거리 없음';
    const t = SH.pos ? `GPS 정확도 ±${Math.round(SH.pos.acc)}m · ${Math.max(0, Math.round((now() - SH.fixAt) / 1000))}초 전 · ${al}` : `GPS 위치 확인 중… · ${al}`;
    if(el.textContent!==t) el.textContent = t;
  });
  set('shwarn', el => {
    const why = shWarnWhy();
    const h = why ? `<b>앱이 화면에 보이지 않으면 위치를 알 수 없습니다. 화면 분할로 함께 띄워 주세요.</b><small>${esc(why)}</small>` : '';
    if(el.hidden === !why && el.innerHTML===h) return;
    el.hidden = !why; if(el.innerHTML!==h) el.innerHTML = h;
    document.getElementById('shut')?.classList.toggle('warned', !!why);
  });
  document.querySelectorAll('[data-shstat]').forEach(el => { const h = shStatusHtml(); if(el.innerHTML!==h) el.innerHTML = h; });
  set('shalerts', el => { const h = `<small>최근 셔틀 알림</small>${shAlertsHtml()}`; if(el.innerHTML!==h) el.innerHTML = h; });
}
// 큰 무전 단추와 말할 곳 고르기 (무전 창과 같은 모양·같은 동작)
function shuttleBtnSync(){
  const b = document.getElementById('shbtn'); if(!b) return;
  const key = (TALK.kind && TALK.kind!=='cast') ? TALK.kind : curTarget();
  if(!TALK.kind) b.dataset.kind = key;
  const L = pttLook(key);
  b.className = L.cls + ' shbig'; b.querySelector('.ic').textContent = L.ic; b.querySelector('.lb').textContent = L.lb; b.querySelector('.hint').textContent = L.hint;
  b.setAttribute('aria-label', L.aria);
  const ts = talkTargets(), tg = document.getElementById('shtg');
  if(tg){
    tg.style.display = ts.length > 1 ? '' : 'none';
    const h = ts.length > 1 ? ts.map(t => `<button class="${key===t.key?'on':''}" data-a="rtarget" data-v="${esc(t.key)}" aria-pressed="${key===t.key}" ${TALK.kind?'disabled':''}>${esc(t.label.replace('에게', ''))}</button>`).join('') : '';
    if(tg.innerHTML!==h) tg.innerHTML = h;
  }
}
// render()가 화면을 새로 그린 뒤에 부름
function shuttleAfterRender(){
  const b = document.getElementById('shbtn');
  if(b){ pttBind(b); shuttleBtnSync(); }
  shuttleUpdate();
}
// 셔틀 화면에서 누르고 말하는 동안에는 화면을 다시 그리지 않음 (누르고 있던 단추가 사라져 말하기가 끊기지 않게)
const talkHolds = () => !!TALK.kind && TALK.pressed && !TALK.toggle && !!document.getElementById('shbtn');
// render() 마다 부름: 운전자는 위치 받기를 시작·멈추고, 보조·마스터는 운전자 신호를 구독함
function shuttleSync(){
  if(!store || !UI.me) return;
  if(shuttleMode()==='driver'){ if(!SH.watch) shGpsStart(); } else if(SH.watch) shGpsStop();
  shuttleSubs();
  if(!SH.tick) SH.tick = setInterval(shTick, 1000);
}
function shTick(){
  if(shuttleMode()==='driver'){ shEvaluate(); shHeartbeat(); }
  shuttleUpdate();
}
document.addEventListener('visibilitychange', () => {
  // 화면으로 돌아오면 위치 받기를 새로 시작 (일부 기기는 숨어 있는 동안 위치 받기를 멈춤)
  if(document.visibilityState==='visible' && SH.watch && shuttleMode()==='driver'){
    try{ navigator.geolocation.clearWatch(SH.watch); }catch(e){}
    SH.watch = 0; const keep = SH.fixAt; shGpsStart(); SH.fixAt = keep;
  }
});

function shHelpSheet(){
  return `<h2>화면 분할 방법</h2>
    <p class="sub" style="margin-top:0">이 앱이 화면에 보이는 동안만 위치를 받을 수 있습니다. 내비게이션 앱만 크게 열면 이 앱의 위치 받기가 멈춥니다. 삼성 갤럭시는 이렇게 둘을 함께 띄웁니다.</p>
    <ol class="shsteps">
      <li>이 앱을 연 채로 <b>최근 앱 버튼</b>(화면 아래 |||, 또는 아래에서 위로 쓸어 올려 잠깐 멈춤)을 누릅니다.</li>
      <li>목록에서 이 앱 위쪽의 <b>앱 아이콘</b>(가을운동회 점수판)을 누릅니다.</li>
      <li><b>분할 화면으로 열기</b>를 누릅니다. 작은 창으로 띄우려면 <b>팝업 화면으로 열기</b>를 누릅니다.</li>
      <li>반대쪽 칸에서 내비게이션 앱을 고릅니다.</li>
    </ol>
    <p class="sub">이 앱 칸의 위쪽에 남은 거리와 큰 무전 단추가 한 번에 보이도록 만들었습니다. 화면은 꺼지지 않게 해 둡니다. 위치 권한은 처음 한 번 '허용'으로 해 주세요.</p>
    <button class="btn primary wide" data-a="closeSheet">알겠습니다</button>`;
}

/* ---------- 마스터: 셔틀·무전 채널 설정 (명단·설정의 '셔틀·채널' 탭) ---------- */
function shSave(list){
  const clean = list.map(d => ({ id:d.id, name:d.name, lat: d.lat==null ? null : d.lat, lng: d.lng==null ? null : d.lng, alerts:(d.alerts||[]).map(Number).filter(n => n > 0), cal:d.cal||'', acc:d.acc||0 }));
  return setConfig({ shuttle:{ dests:clean } });
}
const shPatch = (id, patch) => shSave(shuttleDests().map(d => d.id===id ? { ...d, ...patch } : d));
function coordState(d){
  if(d.lat==null) return '<span class="tag warn">좌표 없음</span>';
  if(d.cal==='gps') return `<span class="tag ok">현장 위치로 저장함${d.acc ? ` (±${d.acc}m)` : ''}</span>`;
  if(d.cal==='input') return '<span class="tag">직접 입력한 좌표</span>';
  return '<span class="tag warn">현장에서 확인 필요</span>';
}
function shuttleSettingsTab(){
  const chs = channels(), dests = shuttleDests();
  const uses = id => presetList().filter(p => p.ch===id).length;
  const chRows = chs.map(c => `<div class="item"><span class="name">${esc(c.name)}<span class="sub">담당자 ${uses(c.id)}명</span></span>
      <button class="ibtn" data-a="chRename" data-v="${esc(c.id)}" aria-label="이름 고치기">✏️</button><button class="ibtn danger" data-a="chDel" data-v="${esc(c.id)}" aria-label="삭제">🗑</button></div>`).join('');
  const destCards = dests.map(d => `<div class="card shdc" data-id="${esc(d.id)}">
      <div class="shr1"><input class="shi-name" data-sh="name" data-id="${esc(d.id)}" value="${esc(d.name)}" autocomplete="off" aria-label="목적지 이름">
        <input class="shi-coord" data-sh="coord" data-id="${esc(d.id)}" value="${d.lat==null ? '' : esc(`${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}`)}" placeholder="위도, 경도 붙여넣기" inputmode="decimal" autocomplete="off" aria-label="좌표">
        <button class="btn small shi-here" data-a="shHere" data-v="${esc(d.id)}">📍 지금 위치로 저장</button>
        <button class="ibtn danger shi-del" data-a="shDestDel" data-v="${esc(d.id)}" aria-label="목적지 지우기">🗑</button></div>
      <div class="shal-row"><span class="shcs">${coordState(d)}</span><span class="sub">알림 거리(m)</span>
        ${d.alerts.map((a, i) => `<span class="shnum"><input type="number" inputmode="numeric" min="10" max="100000" step="10" data-sh="alert" data-id="${esc(d.id)}" data-i="${i}" value="${a}" aria-label="알림 거리"><button class="ibtn xs" data-a="shAlertDel" data-v="${esc(d.id)}" data-i="${i}" aria-label="이 거리 지우기">✕</button></span>`).join('')}
        <button class="btn small" data-a="shAlertAdd" data-v="${esc(d.id)}">＋ 추가</button>${d.alerts.length ? `<button class="btn small danger" data-a="shAlertClear" data-v="${esc(d.id)}">모두 지우기</button>` : ''}</div>
    </div>`).join('');
  return `<div class="bctl shset">
    <div class="shtop"><button class="btn small" data-a="shBack" aria-label="뒤로">← 뒤로</button><h2 class="grow">🚌 셔틀·무전 채널</h2></div>
    <div class="shcols">
      <div class="shcol">
        <div class="card"><h2>📡 무전 채널</h2>
          <p class="sub">채널의 말은 그 채널 사람과 운영진(마스터·운영 현황)만 듣습니다. 채널은 담당자 명단에서 사람마다 정합니다.</p>
          <div class="list"><div class="item"><span class="name">전체<span class="sub">모든 진행요원 · 고정</span></span><span class="tag">고정</span></div>${chRows}</div>
          <div class="row nowrap" style="margin-top:8px"><input id="chNew" placeholder="새 채널 이름 (예: 주차)" autocomplete="off"><button class="btn primary" data-a="chAdd" style="white-space:nowrap;flex:none">추가</button></div>
          ${chs.length ? '<button class="btn danger wide" data-a="chClear" style="margin-top:8px">채널 모두 지우기</button>' : '<p class="sub">만든 채널이 없습니다. 전체 무전만 씁니다.</p>'}
        </div>
        <div class="card"><h2>이 알림은 이렇게 갑니다</h2>
          <p class="sub">운전자 기기가 목적지에서 정한 거리 안으로 처음 들어서면 문자 한 번이 갑니다. 알림 거리보다 150m 넘게 멀어졌다 다시 오면 또 갑니다. 받는 곳은 운전자와 같은 채널 사람, 마스터, 운영 현황 기기입니다.</p></div>
      </div>
      <div class="shcol">
        <div class="card"><div class="row nowrap"><h2 class="grow h2" style="margin:0">📍 셔틀 목적지</h2><button class="btn small primary" data-a="shDestAdd">＋ 추가</button></div>
          <p class="sub">좌표는 '위도, 경도'를 붙여넣거나, 현장에서 [지금 위치로 저장]을 누릅니다. 미리 넣은 좌표는 지도 자료의 대략값이라 현장에서 맞춰야 합니다.</p></div>
        ${destCards || '<div class="card empty">목적지가 없습니다.</div>'}
        <div class="row"><button class="btn danger grow" data-a="shDestClear" ${dests.length?'':'disabled'}>목적지 모두 지우기</button><button class="btn grow" data-a="shDestDefault">처음 목록 다시 넣기</button></div>
      </div>
    </div></div>`;
}
Object.assign(ACT, {
  shHelp: () => { openSheet(shHelpSheet); return false; },
  shDest: (el, v) => { idStore.set('udh5_shdest', v); SH.arm = {}; SH.dist = null; SH.hbAt = 0; shEvaluate(); },
  shBack: () => { ITAB.settings = 'list'; ls.set('udh5_itab', ITAB); const m = document.querySelector('main'); if(m) m.scrollTop = 0; },
  // 채널
  chAdd: () => {
    if(!can.master()) return denied();
    const inp = document.getElementById('chNew'), name = cleanName(inp ? inp.value : '');
    if(!name){ toast('채널 이름을 적어 주세요.'); return false; }
    if(name==='전체' || channels().some(c => c.name===name)){ toast(`'${name}' 채널은 이미 있습니다.`); return false; }
    if(channels().length >= 8){ toast('채널은 8개까지 만들 수 있습니다.'); return false; }
    setConfig({ radioChannels:[...channels(), { id:'c' + uid(), name }] }); if(inp) inp.value = ''; toast(`'${name}' 채널을 만들었습니다.`); return false;
  },
  chRename: async (el, v) => {
    if(!can.master()) return denied();
    const c = chById(v); if(!c) return false;
    const n = cleanName(await askText('채널 이름 고치기', c.name)); if(!n) return false;
    if(n==='전체' || channels().some(x => x.id!==v && x.name===n)){ toast(`'${n}' 채널은 이미 있습니다.`); return false; }
    setConfig({ radioChannels: channels().map(x => x.id===v ? { ...x, name:n } : x) }); return false;
  },
  chDel: async (el, v) => {
    if(!can.master()) return denied();
    const c = chById(v); if(!c) return false;
    const n = presetList().filter(p => p.ch===v).length;
    if(!(await ask(`'${c.name}' 채널을 지울까요?${n ? `\n이 채널에 속한 담당자 ${n}명은 채널 없이 남고, 맡은 종목이 없으면 역할 대기가 됩니다.` : ''}`, '지우기', true))) return false;
    setConfig({ radioChannels: channels().filter(x => x.id!==v) }); return false;
  },
  chClear: async () => {
    if(!can.master()) return denied();
    if(!(await ask('만든 무전 채널을 모두 지울까요?\n전체 무전은 그대로 남습니다.', '모두 지우기', true))) return false;
    setConfig({ radioChannels:[] }); return false;
  },
  // 목적지
  shDestAdd: async () => {
    if(!can.master()) return denied();
    const n = cleanName(await askText('목적지 이름', '', '추가')); if(!n) return false;
    shSave([...shuttleDests(), { id:'d' + uid(), name:n, lat:null, lng:null, alerts:[300], cal:'', acc:0 }]); return false;
  },
  shDestDel: async (el, v) => {
    if(!can.master()) return denied();
    const d = shuttleDests().find(x => x.id===v); if(!d) return false;
    if(!(await ask(`'${d.name}' 목적지를 지울까요?`, '지우기', true))) return false;
    shSave(shuttleDests().filter(x => x.id!==v)); return false;
  },
  shDestClear: async () => {
    if(!can.master()) return denied();
    if(!(await ask('셔틀 목적지를 모두 지울까요?', '모두 지우기', true))) return false;
    shSave([]); return false;
  },
  shDestDefault: async () => {
    if(!can.master()) return denied();
    if(shuttleDests().length && !(await ask('지금 목적지를 모두 지우고 처음 목록(다시가는 캠퍼스, 낙성대역 4번 출구)으로 되돌릴까요?', '되돌리기', true))) return false;
    shSave(DEFAULT_DESTS); return false;
  },
  shAlertAdd: (el, v) => {
    if(!can.master()) return denied();
    const d = shuttleDests().find(x => x.id===v); if(!d) return false;
    const have = d.alerts, next = have.length ? Math.max(100, Math.min(...have) - 100) : 300;
    shPatch(v, { alerts:[...have, have.includes(next) ? next + 50 : next] }); return false;
  },
  shAlertDel: (el, v) => {
    if(!can.master()) return denied();
    const d = shuttleDests().find(x => x.id===v); if(!d) return false;
    shPatch(v, { alerts: d.alerts.filter((a, i) => i!==+el.dataset.i) }); return false;
  },
  shAlertClear: async (el, v) => {
    if(!can.master()) return denied();
    if(!(await ask('이 목적지의 알림 거리를 모두 지울까요?\n지우면 이 목적지에서는 알림이 가지 않습니다.', '모두 지우기', true))) return false;
    shPatch(v, { alerts:[] }); return false;
  },
  // 지금 이 기기가 있는 곳을 목적지로 저장
  shHere: (el, v) => {
    if(!can.master()) return denied();
    if(!('geolocation' in navigator)){ toast('이 브라우저에서는 위치를 쓸 수 없습니다.'); return false; }
    toast('지금 위치를 확인하는 중입니다…');
    navigator.geolocation.getCurrentPosition(p => {
      const c = p.coords, acc = Math.round(c.accuracy || 0);
      shPatch(v, { lat:+c.latitude.toFixed(6), lng:+c.longitude.toFixed(6), cal:'gps', acc });
      toast(`지금 위치를 저장했습니다. (정확도 ±${acc}m)`);
    }, e => toast(e && e.code===1 ? '위치 권한이 꺼져 있습니다. 브라우저 설정에서 위치를 허용해 주세요.' : '지금 위치를 받지 못했습니다. 바깥에서 다시 눌러 주세요.'), { enableHighAccuracy:true, maximumAge:0, timeout:20000 });
    return false;
  },
});
// 입력칸은 값을 바꾸고 칸을 벗어날 때(change) 저장함
document.addEventListener('change', e => {
  const el = e.target, k = el.dataset && el.dataset.sh; if(!k || !can.master()) return;
  const id = el.dataset.id, d = shuttleDests().find(x => x.id===id); if(!d) return;
  if(k==='name'){ const n = cleanName(el.value); if(!n){ toast('목적지 이름을 적어 주세요.'); el.value = d.name; return; } if(n!==d.name) shPatch(id, { name:n }); }
  else if(k==='coord'){
    if(!String(el.value).trim()){ shPatch(id, { lat:null, lng:null, cal:'', acc:0 }); return; }
    const c = parseCoord(el.value);
    if(!c){ toast("좌표를 읽지 못했습니다. '37.4712, 126.9600'처럼 위도, 경도 순서로 적어 주세요."); el.value = d.lat==null ? '' : `${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}`; return; }
    shPatch(id, { lat:c.lat, lng:c.lng, cal:'input', acc:0 });
  }
  else if(k==='alert'){
    const n = Math.round(Number(el.value)), i = +el.dataset.i;
    if(!(n >= 10 && n <= 100000)){ toast('알림 거리는 10m 이상으로 적어 주세요.'); el.value = d.alerts[i]; return; }
    const al = d.alerts.slice(); al[i] = n; shPatch(id, { alerts:[...new Set(al)] });
  }
});
