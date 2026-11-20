'use strict';
/* ===================== 처음 화면 · 시작 ===================== */
let lobbyOff = null;
function showView(id){
  $$('.view').forEach(v => { v.hidden = v.id !== id; });
  if(id !== 'vStart' && lobbyOff){ lobbyOff(); lobbyOff = null; }
  paintInstall();
}
function startMsg(msg){ const m = $('#startMsg'); m.textContent = msg; m.hidden = !msg; if(msg && DB && !lobbyOff) showStart(); }
function showStart(){
  showView('vStart');
  const h = ls.get('host');
  const rb = $('#resumeBtn'); rb.hidden = !h;
  if(h) rb.textContent = '내가 만든 방에서 이어서 입력하기 (방 ' + h.code + ')';
  if(DB && !lobbyOff) lobbyOff = DB.on('lobby', paintLobby, () => paintLobby(null));
}
function paintLobby(v){
  const now = DB.now();
  const list = Object.entries(v || {}).filter(([, r]) => r && typeof r.at === 'number' && now - r.at < LOBBY_LIVE_MS).sort((a, b) => b[1].at - a[1].at).slice(0, 8);
  const box = $('#roomList');
  if(!list.length){ box.innerHTML = '<p class="muted">지금 열린 방이 없어요. 방 번호를 알면 아래에 넣어 주세요.</p>'; return; }
  box.innerHTML = list.map(([code, r]) => `<button class="btn room" data-join="${esc(code)}">${esc(r.title || '문자통역')}, 방 ${esc(code)} 들어가기</button>`).join('');
}

document.addEventListener('click', e => {
  const j = e.target.closest('[data-join]'); if(j){ startMsg(''); readerJoin(j.dataset.join); return; }
  const a = e.target.closest('[data-act]'); if(!a) return;
  const act = a.dataset.act;
  if(act === 'fs') FS.toggle();
  else if(act === 'install') installSheet();
  else if(act === 'installLater'){ UIP.installDismissed = true; saveUIP(); paintInstall(); }
  else if(act === 'typist'){ if(!DB){ toast('서버에 연결하는 중이에요'); return; } typistStartSheet(); }
  else if(act === 'resume'){ const h = ls.get('host'); if(h && DB) typistResume({ code:h.code, host:true }).then(ok => { if(!ok){ ls.del('host'); showStart(); toast('그 방이 없어졌어요. 새 방을 만들어 주세요'); } }); }
  else if(act === 'settings'){
    const box = openSheet(`<h2 tabindex="-1">설정</h2>${pwaSettingsHtml()}<div class="row"><div class="sp"></div><button class="btn primary" data-close>닫기</button></div>`, e2 => { pwaSettingsBind(box, e2); });
    pwaSettingsBind(box);
  }
});
$('#codeForm').addEventListener('submit', e => { e.preventDefault(); if(!DB){ startMsg('서버에 연결하는 중이에요. 잠시 뒤에 다시 눌러 주세요.'); return; } startMsg(''); readerJoin($('#codeIn').value); });

async function boot(){
  // Artifact 등으로 게시하면 head 태그가 body로 들어가므로 head로 옮김
  $$('body > meta, body > link[rel~="manifest"], body > link[rel~="icon"], body > link[rel="apple-touch-icon"]').forEach(el => document.head.appendChild(el));
  readerInit(); typistInit();
  showStart();
  try{ DB = DEMO ? demoDB() : await firebaseDB(); }
  catch(e){ startMsg('서버에 연결하지 못했어요. 인터넷 연결을 확인한 뒤 새로고침해 주세요.'); onNetChange(); return; }
  onNetChange();
  const tp = ls.get('typing');
  if(tp && await typistResume(tp)) return;
  const r = QS.get('r');
  if(r){ readerJoin(r); return; }
  const lr = ls.get('lastRead');
  if(lr && Date.now() - lr.at < 12 * 3600 * 1000){ readerJoin(lr.code); return; }
  showStart();
}
boot();
