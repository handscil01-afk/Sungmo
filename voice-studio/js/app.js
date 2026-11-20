/* 야구 중계 녹음실: Gemini API로 대본 묶음을 녹음하고, 문장마다 잘라 zip으로 받음 */
(() => {
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
// 앱 주소(Artifact 등)에서 head 밖으로 나간 설치 태그를 head로 옮김
document.querySelectorAll('body > link[rel="manifest"], body > link[rel~="icon"], body > link[rel="apple-touch-icon"], body > meta[name$="capable"], body > meta[name="apple-mobile-web-app-title"]').forEach(n => document.head.appendChild(n));

// ===== 설정 (이 기기에만 저장) =====
const CFG_KEY = 'voice-studio-cfg';
const cfg = { key:'', model:'gemini-3.8-flash-tts', caster:'Puck', analyst:'Charon', wait:21, autoFS:true, installDismissed:false };
try{ Object.assign(cfg, JSON.parse(localStorage.getItem(CFG_KEY)) || {}); }catch(e){}
const saveCfg = () => { try{ localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }catch(e){} };
const MODELS = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'];
const VOICES = { Puck:'활기참', Charon:'차분하고 또렷함', Fenrir:'들뜸', Kore:'단단함', Orus:'단단함', Zephyr:'밝음', Leda:'젊음', Aoede:'산뜻함',
  Callirrhoe:'느긋함', Autonoe:'밝음', Enceladus:'숨소리 섞임', Iapetus:'맑음', Umbriel:'느긋함', Algieba:'부드러움', Despina:'부드러움', Erinome:'맑음',
  Algenib:'거침', Rasalgethi:'또렷함', Laomedeia:'활기참', Achernar:'부드러움', Alnilam:'단단함', Schedar:'고름', Gacrux:'원숙함', Pulcherrima:'적극적',
  Achird:'친근함', Zubenelgenubi:'편안함', Vindemiatrix:'온화함', Sadachbia:'생기 있음', Sadaltager:'박식함', Sulafat:'따뜻함' };

// ===== 저장소 (IndexedDB: 녹음이 커서 localStorage에는 못 넣음) =====
let db = null;
const dbOpen = () => new Promise(res => {
  try{
    const r = indexedDB.open('voice-studio', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('b', { keyPath:'code' });
    r.onsuccess = () => { db = r.result; res(); }; r.onerror = () => res();
  }catch(e){ res(); }
});
const mem = {};  // IndexedDB를 못 쓰는 환경에서는 메모리에만 둠
const dbAll = () => new Promise(res => {
  if(!db) return res(Object.values(mem));
  try{ const q = db.transaction('b').objectStore('b').getAll(); q.onsuccess = () => res(q.result); q.onerror = () => res([]); }catch(e){ res([]); }
});
const dbPut = rec => new Promise(res => {
  mem[rec.code] = rec; if(!db) return res();
  try{ const t = db.transaction('b', 'readwrite'); t.objectStore('b').put(rec); t.oncomplete = res; t.onerror = res; }catch(e){ res(); }
});
const dbDel = code => new Promise(res => {
  delete mem[code]; if(!db) return res();
  try{ const t = db.transaction('b', 'readwrite'); t.objectStore('b').delete(code); t.oncomplete = res; t.onerror = res; }catch(e){ res(); }
});

let BUNDLES = [], REC = {};
const WHO = { caster:'캐스터', analyst:'해설' };
const voiceOf = b => b.who === 'caster' ? cfg.caster : cfg.analyst;
const pcmOf = r => new Int16Array(r.pcm);

// ===== 화면 도움 =====
function toast(t){ const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2600); }
function sheet(html, onClick){
  const dim = document.createElement('div'); dim.className = 'dim';
  dim.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  dim.addEventListener('click', e => {
    if(e.target === dim || e.target.closest('[data-close]')){ dim.remove(); return; }
    if(onClick) onClick(e, dim);
  });
  $('sheets').appendChild(dim);
  const f = dim.querySelector('input,button'); if(f) setTimeout(() => f.focus(), 30);
  return dim;
}
function ask(text, yes, no = '취소'){
  return new Promise(res => {
    const d = sheet(`<p>${text}</p><div class="row"><button class="btn primary" data-a="y">${esc(yes)}</button><button class="btn" data-a="n">${esc(no)}</button></div>`,
      (e, dim) => { const a = e.target.closest('[data-a]'); if(a){ dim.remove(); res(a.dataset.a === 'y'); } });
    d.addEventListener('click', e => { if(e.target === d) res(false); });
  });
}
const maskKey = k => k ? (k.length > 10 ? k.slice(0, 5) + '…' + k.slice(-4) : '****') : '';

// ===== 소리 재생 =====
let ac = null, playing = null;
function play(pcm, sr, s = 0, e = null){
  try{
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if(playing){ try{ playing.stop(); }catch(x){} }
    const a = Math.floor(s * sr), b = Math.min(pcm.length, e == null ? pcm.length : Math.ceil(e * sr));
    const buf = ac.createBuffer(1, Math.max(1, b - a), sr), ch = buf.getChannelData(0);
    for(let i = a; i < b; i++) ch[i - a] = pcm[i] / 32768;
    const src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination); src.start(); playing = src;
  }catch(x){ toast('소리를 재생하지 못했습니다'); }
}

// ===== Gemini API =====
function promptOf(b){
  return 'Read the following Korean lines aloud exactly as written, word for word, in order. Do not read these instructions. ' +
    'Do not add, remove, repeat, or improvise anything. Pause for about two seconds of complete silence between lines.\n' +
    `Voice and tone: ${b.style}\n\nLines:\n` + b.lines.map(l => l.text).join('\n\n');
}
class ApiError extends Error{ constructor(code, msg, daily){ super(msg); this.code = code; this.daily = daily; } }
async function tts(b){
  const body = { contents:[{ parts:[{ text: promptOf(b) }] }],
    generationConfig:{ responseModalities:['AUDIO'], speechConfig:{ voiceConfig:{ prebuiltVoiceConfig:{ voiceName: voiceOf(b) } } } } };
  let r;
  try{
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
      { method:'POST', headers:{ 'Content-Type':'application/json', 'x-goog-api-key': cfg.key }, body: JSON.stringify(body) });
  }catch(e){ throw new ApiError(0, '인터넷에 연결하지 못했습니다'); }
  const txt = await r.text();
  if(!r.ok){
    let msg = txt.slice(0, 300); try{ msg = JSON.parse(txt).error.message || msg; }catch(e){}
    throw new ApiError(r.status, msg, r.status === 429 && /perday/i.test(txt.replace(/\s/g, '')));
  }
  let part; try{ part = JSON.parse(txt).candidates[0].content.parts.find(p => p.inlineData).inlineData; }catch(e){ throw new ApiError(-1, '소리 없이 응답했습니다'); }
  const m = /rate=(\d+)/.exec(part.mimeType || ''), sr = m ? +m[1] : 24000;
  const bin = atob(part.data), u8 = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return { pcm: u8.buffer.slice(0, u8.length - (u8.length % 2)), sr };
}
// 구글이 보낸 원래 문구도 함께 보여 줌(원인을 알 수 있게)
const apiMsg = e => {
  const why = e.code === 429 ? (e.daily ? `오늘 이 모델(${cfg.model})의 무료 한도를 다 썼습니다. 내일 이어서 만들거나, 설정에서 모델을 바꿔 만들 수 있습니다.` : '1분 한도에 걸렸습니다. 잠시 뒤 다시 시도합니다.')
    : e.code === 400 && /api key/i.test(e.message) ? 'API 키가 맞지 않습니다.'
    : e.code === 403 && /free tier is not available/i.test(e.message) ? '이 키가 속한 구글 프로젝트는 무료로 쓸 수 없습니다. 무료로 쓸 수 있는 다른 프로젝트의 키를 넣거나, 이 프로젝트에 결제를 연결해야 합니다.'
    : e.code === 403 ? '이 키로는 만들 수 없다고 합니다(403).'
    : e.code === 404 ? `모델(${cfg.model})을 찾지 못했습니다. 설정에서 다른 모델을 고르세요.` : '만들지 못했습니다.';
  return e.code > 0 && e.code !== 429 ? `${why} 구글 메시지: ${e.message} (오류 ${e.code})` : e.code === 429 ? why : `${why} ${e.message}`;
};

// ===== 자르기 =====
function cutRec(rec, b){
  const pcm = pcmOf(rec), x = new Float32Array(pcm.length);
  for(let i = 0; i < pcm.length; i++) x[i] = pcm[i] / 32768;
  const r = Cut.split(x, rec.sr, b.lines.map(l => l.text));
  rec.ok = r.ok; rec.why = r.why || ''; rec.segs = r.segs || []; rec.gaps = r.gaps || []; rec.cut = r.cut || []; rec.T0 = r.T0; rec.T1 = r.T1; rec.dur = r.dur; rec.checked = false;
  return rec;
}
async function store(b, pcm, sr, src){
  const rec = cutRec({ code:b.code, pcm, sr, src, at: Date.now(), model: src === 'api' ? cfg.model : '', voice: src === 'api' ? voiceOf(b) : '' }, b);
  REC[b.code] = rec; await dbPut(rec); return rec;
}
const stateOf = b => { const r = REC[b.code]; if(!r) return 'none'; if(!r.ok) return 'fail'; if(r.checked) return 'done'; return r.why || r.segs.some(s => s.warn) ? 'warn' : 'cut'; };
const STATE = { none:['안 만듦', ''], fail:['자르지 못함', 'bad'], warn:['확인 필요', 'warn'], cut:['잘림', 'ok'], done:['들어 봄', 'ok'] };

// ===== 자동으로 차례대로 만들기 =====
let running = false, stopReq = false, wake = null;
async function keepAwake(on){
  try{ if(on && navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); else if(wake){ await wake.release(); wake = null; } }catch(e){}
}
const sleep = (sec, label) => new Promise(res => {
  let left = Math.ceil(sec); const tick = () => { if(stopReq || left <= 0){ res(); return; } status(`${label} ${left}초 뒤 다음 묶음을 만듭니다.`); left--; setTimeout(tick, 1000); }; tick();
});
async function runAll(){
  if(!cfg.key){ keySheet(); return; }
  if(running){ stopReq = true; return; }
  running = true; stopReq = false; keepAwake(true); paint();
  const todo = BUNDLES.filter(b => !REC[b.code]);
  let n = 0, err = '';
  for(const b of todo){
    if(stopReq) break;
    if(n) await sleep(cfg.wait, '');
    if(stopReq) break;
    let tries = 0;
    for(;;){
      status(`${b.code} 만드는 중… (${todo.indexOf(b) + 1}/${todo.length})`);
      try{ const r = await tts(b); await store(b, r.pcm, r.sr, 'api'); n++; paint(); break; }
      catch(e){
        if(e.code === 429 && !e.daily && tries < 3){ tries++; await sleep(60, '1분 한도에 걸렸습니다.'); if(stopReq) break; continue; }
        if(e.code === -1 && tries < 2){ tries++; continue; }
        err = apiMsg(e); status(err); stopReq = true; break;
      }
    }
  }
  const all = BUNDLES.every(b => REC[b.code]);
  status((n ? `이번에 ${n}개 묶음을 만들었습니다. ` : '') + (err || (all ? '모든 묶음을 다 만들었습니다. 확인 필요 묶음을 들어 본 뒤 zip으로 받으세요.' : '멈췄습니다.')));
  running = false; keepAwake(false); paint();
}
function status(t){ $('status').textContent = t; }

// ===== zip으로 받기 =====
async function exportZip(){
  const files = [], list = [];
  for(const b of BUNDLES){
    const r = REC[b.code]; if(!r || !r.ok) continue;
    const pcm = pcmOf(r);
    b.lines.forEach((l, k) => {
      const s = r.segs[k]; const a = Math.floor(s.s * r.sr), e = Math.min(pcm.length, Math.ceil(s.e * r.sr));
      files.push({ name: l.id + '.wav', data: WavZip.wav(pcm.subarray(a, e), r.sr) });
      list.push({ id: l.id, bundle: b.code, warn: !!s.warn && !r.checked });
    });
  }
  if(!files.length){ toast('아직 잘린 녹음이 없습니다'); return; }
  const info = { app:'voice-studio', at: new Date().toISOString(), caster: cfg.caster, analyst: cfg.analyst, lines: list };
  files.push({ name:'manifest.json', data: new TextEncoder().encode(JSON.stringify(info, null, 1)) });
  const blob = WavZip.zip(files), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `baseball-voice-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  toast(`${list.length}줄을 zip으로 받습니다`);
}

// ===== 화면 그리기 =====
let filter = 'all';
function paint(){
  const total = BUNDLES.length, made = BUNDLES.filter(b => REC[b.code]).length;
  const lines = BUNDLES.reduce((a, b) => a + b.lines.length, 0);
  const cut = BUNDLES.filter(b => REC[b.code] && REC[b.code].ok).reduce((a, b) => a + b.lines.length, 0);
  const need = BUNDLES.filter(b => ['warn', 'fail'].includes(stateOf(b))).length;
  $('keyState').innerHTML = cfg.key ? `저장된 키: <b>${esc(maskKey(cfg.key))}</b>` : '<b class="bad">API 키가 없습니다.</b> 키를 넣어야 만들 수 있습니다.';
  $('voiceState').textContent = `캐스터 ${cfg.caster} · 해설 ${cfg.analyst} · ${cfg.model}`;
  $('prog').innerHTML = `묶음 <b>${made}</b>/${total} · 잘린 줄 <b>${cut}</b>/${lines}` + (need ? ` · <span class="warn">확인 필요 ${need}</span>` : '');
  $('bar').style.width = (total ? made / total * 100 : 0) + '%';
  $('run').textContent = running ? '멈추기' : (made ? '이어서 차례대로 만들기' : '자동으로 차례대로 만들기');
  $('run').classList.toggle('stop', running);
  $('zip').disabled = !cut;
  document.querySelectorAll('#filters [data-f]').forEach(x => x.setAttribute('aria-pressed', x.dataset.f === filter));
  const show = BUNDLES.filter(b => filter === 'all' || (filter === 'need' ? ['warn', 'fail'].includes(stateOf(b)) : stateOf(b) === 'none'));
  $('list').innerHTML = show.map(b => {
    const [t, c] = STATE[stateOf(b)];
    return `<li><button class="item" data-code="${b.code}"><span class="code">${b.code}</span><span class="who ${b.who}">${WHO[b.who]}</span>` +
      `<span class="first">${esc(b.lines[0].text)}${b.lines.length > 1 ? ` 외 ${b.lines.length - 1}줄` : ''}</span><span class="st ${c}">${t}</span></button></li>`;
  }).join('') || '<li class="empty">해당하는 묶음이 없습니다.</li>';
}

function detail(code){
  const b = BUNDLES.find(x => x.code === code);
  const draw = () => {
    const r = REC[code];
    const rows = b.lines.map((l, k) => {
      const s = r && r.ok ? r.segs[k] : null;
      return `<li class="${s && s.warn && !r.checked ? 'w' : ''}"><button class="ic" data-a="p" data-k="${k}" ${s ? '' : 'disabled'} aria-label="${k + 1}번 듣기">▶</button>` +
        `<span class="t"><small>${esc(l.id)}${s ? ` · ${(s.e - s.s).toFixed(1)}초${s.warn && !r.checked ? ' · 길이가 예상과 다름' : ''}` : ''}</small>${esc(l.text)}</span>` +
        (s && k < b.lines.length - 1 ? `<span class="mv"><button class="ic" data-a="m" data-k="${k}" data-d="-1" aria-label="${k + 1}번과 ${k + 2}번 경계를 앞으로">◀</button><button class="ic" data-a="m" data-k="${k}" data-d="1" aria-label="${k + 1}번과 ${k + 2}번 경계를 뒤로">▶</button></span>` : '') + '</li>';
    }).join('');
    const info = !r ? '아직 만들지 않았습니다.' : !r.ok ? `<b class="bad">${esc(r.why)}</b> 다시 만들거나 다른 파일을 넣어 주세요.` :
      (r.why ? `<b class="warn">${esc(r.why)}</b> ` : '') + (r.src === 'api' ? `${esc(r.voice)} · ${esc(r.model)}` : '넣은 파일') + ` · ${(pcmOf(r).length / r.sr).toFixed(1)}초`;
    return `<h3>${b.code} · ${WHO[b.who]} · ${b.lines.length}줄</h3><p class="style">${esc(b.style)}</p><p class="info">${info}</p>` +
      `<div class="row wrap"><button class="btn primary" data-a="make">${r ? '다시 만들기' : '만들기'}</button><button class="btn" data-a="file">파일 넣기</button>` +
      `<button class="btn" data-a="copy">AI Studio용 글 복사</button>${r ? '<button class="btn" data-a="all">전체 듣기</button><button class="btn" data-a="recut">다시 자르기</button>' : ''}` +
      `${r && r.ok ? `<button class="btn" data-a="ok">${r.checked ? '들어 봄 표시 지우기' : '다 들어 봄'}</button>` : ''}${r ? '<button class="btn danger" data-a="del">녹음 지우기</button>' : ''}</div>` +
      `<p class="hint">경계가 어긋나면 ◀ ▶로 두 줄 사이 경계를 이전·다음 쉬는 곳으로 옮깁니다.</p><ol class="lines">${rows}</ol><button class="btn wide" data-close>닫기</button>`;
  };
  const d = sheet(draw(), async (e, dim) => {
    const a = e.target.closest('[data-a]'); if(!a || a.disabled) return;
    const r = REC[code], redraw = () => { dim.firstChild.innerHTML = draw(); paint(); };
    switch(a.dataset.a){
      case 'p': { const s = r.segs[+a.dataset.k]; play(pcmOf(r), r.sr, s.s, s.e); break; }
      case 'all': play(pcmOf(r), r.sr); break;
      case 'm': if(!Cut.moveBoundary(r, +a.dataset.k, +a.dataset.d)) toast('더 옮길 쉬는 곳이 없습니다'); else { await dbPut(r); redraw(); play(pcmOf(r), r.sr, r.segs[+a.dataset.k].s, r.segs[+a.dataset.k + 1].e); } break;
      case 'recut': cutRec(r, b); await dbPut(r); redraw(); toast('다시 잘랐습니다'); break;
      case 'ok': r.checked = !r.checked; await dbPut(r); redraw(); break;
      case 'del': if(await ask(`${code} 녹음을 지울까요?`, '지우기')){ delete REC[code]; await dbDel(code); redraw(); } break;
      case 'copy': copyText(`[${b.code}] Voice: ${voiceOf(b)}\n\n` + promptOf(b)); break;
      case 'file': pickFile(b, redraw); break;
      case 'make':
        if(!cfg.key){ keySheet(); break; }
        if(running){ toast('자동으로 만드는 중에는 기다려 주세요'); break; }
        a.disabled = true; a.textContent = '만드는 중…';
        try{ const x = await tts(b); await store(b, x.pcm, x.sr, 'api'); toast(`${code}를 만들고 잘랐습니다`); }
        catch(err){ toast(apiMsg(err)); }
        redraw(); break;
    }
  });
  return d;
}
function pickFile(b, done){
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'audio/*,.wav,.mp3,.m4a,.ogg';
  inp.onchange = async () => {
    const f = inp.files[0]; if(!f) return;
    try{
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const buf = await new Promise((ok, no) => f.arrayBuffer().then(ab => ac.decodeAudioData(ab, ok, no)));
      const ch = buf.getChannelData(0), pcm = new Int16Array(ch.length);
      for(let i = 0; i < ch.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(ch[i] * 32767)));
      const r = await store(b, pcm.buffer, buf.sampleRate, 'file');
      toast(r.ok ? `${b.code}에 파일을 넣고 잘랐습니다` : r.why); done();
    }catch(e){ toast('이 파일을 읽지 못했습니다. wav나 mp3로 넣어 주세요'); }
  };
  inp.click();
}
function copyText(t){
  const done = () => toast('복사했습니다. AI Studio에 붙여 넣으세요');
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => fallback());
  else fallback();
  function fallback(){ const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); done(); }catch(e){ toast('복사하지 못했습니다'); } ta.remove(); }
}

// ===== API 키 =====
function keySheet(){
  sheet(`<h3>API 키</h3><p>${cfg.key ? `지금 키: <b>${esc(maskKey(cfg.key))}</b>` : '아직 키가 없습니다.'}</p>` +
    `<p class="hint">aistudio.google.com/apikey 에서 만든 키를 붙여 넣으세요. 키는 이 기기에만 저장되고, 구글 서버에만 보냅니다.</p>` +
    `<label class="fld">새 키<input id="kIn" type="password" autocomplete="off" spellcheck="false" placeholder="여기에 붙여 넣기"></label>` +
    `<div class="row wrap"><button class="btn primary" data-a="save">저장</button><button class="btn" data-a="test">키 확인</button>${cfg.key ? '<button class="btn danger" data-a="del">키 지우기</button>' : ''}<button class="btn" data-close>닫기</button></div><p id="kMsg" class="info"></p>`,
    async (e, dim) => {
      const a = e.target.closest('[data-a]'); if(!a) return;
      const v = $('kIn').value.trim(), msg = t => { $('kMsg').textContent = t; };
      if(a.dataset.a === 'save'){ if(!v){ msg('키를 붙여 넣어 주세요.'); return; } cfg.key = v; saveCfg(); paint(); dim.remove(); toast('키를 저장했습니다'); }
      if(a.dataset.a === 'del'){ if(await ask('저장된 API 키를 지울까요?', '지우기')){ cfg.key = ''; saveCfg(); paint(); dim.remove(); } }
      if(a.dataset.a === 'test'){
        const k = v || cfg.key; if(!k){ msg('키를 붙여 넣어 주세요.'); return; }
        msg('확인하는 중…');
        try{
          const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers:{ 'x-goog-api-key': k } });
          const j = await r.json();
          if(!r.ok) msg('이 키로는 쓸 수 없습니다: ' + ((j.error && j.error.message) || r.status));
          else { const tts = (j.models || []).map(m => m.name.replace('models/', '')).filter(n => /tts/.test(n)); msg(`쓸 수 있는 키입니다. 음성 모델: ${tts.join(', ') || '없음'}`); }
        }catch(err){ msg('인터넷에 연결하지 못했습니다.'); }
      }
    });
}

// ===== 목소리·모델 =====
function voiceSheet(){
  const opt = (sel) => Object.entries(VOICES).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${k} (${v})</option>`).join('');
  sheet(`<h3>목소리와 모델</h3>` +
    `<label class="fld">캐스터 이하늘<select id="vC">${opt(cfg.caster)}</select></label>` +
    `<label class="fld">해설위원 강태산<select id="vA">${opt(cfg.analyst)}</select></label>` +
    `<label class="fld">모델<select id="vM">${MODELS.map(m => `<option${m === cfg.model ? ' selected' : ''}>${m}</option>`).join('')}</select></label>` +
    `<label class="fld">묶음 사이 기다리는 초<input id="vW" type="number" min="5" max="120" value="${cfg.wait}"></label>` +
    `<p class="hint">무료 사용량은 모델마다 하루 10번입니다(2026년 11월 기준). 묶음 하나가 1번입니다. 목소리를 바꾸면 이미 만든 묶음과 목소리가 달라지니, 한 번 정하면 끝까지 같은 목소리·모델로 만드는 것이 좋습니다.</p>` +
    `<div class="row"><button class="btn primary" data-a="save">저장</button><button class="btn" data-close>닫기</button></div>`,
    (e, dim) => {
      if(!e.target.closest('[data-a="save"]')) return;
      cfg.caster = $('vC').value; cfg.analyst = $('vA').value; cfg.model = $('vM').value;
      cfg.wait = Math.max(5, Math.min(120, +$('vW').value || 21)); saveCfg(); paint(); dim.remove(); toast('저장했습니다');
    });
}

// ===== 홈 화면 설치 · 전체화면 =====
// 브라우저에서 전체화면을 켜도 display-mode가 fullscreen이 되므로, 그때는 홈 화면 앱으로 보지 않음(끄기 버튼이 사라지지 않게)
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true ||
  (matchMedia('(display-mode: fullscreen)').matches && !(document.fullscreenElement || document.webkitFullscreenElement));
let inFrame = false; try{ inFrame = window.self !== window.top; }catch(e){ inFrame = true; }
const SVG = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const ICON = { fsOn: SVG('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'), fsOff: SVG('M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5') };
const FS = {
  userExit: false,
  supported(){ const d = document.documentElement; return !!(d.requestFullscreen || d.webkitRequestFullscreen) && !isStandalone() && !inFrame; },
  on(){ return !!(document.fullscreenElement || document.webkitFullscreenElement); },
  enter(){ const d = document.documentElement; try{ const r = d.requestFullscreen ? d.requestFullscreen({ navigationUI:'hide' }) : d.webkitRequestFullscreen && d.webkitRequestFullscreen(); if(r && r.catch) r.catch(() => {}); }catch(e){} },
  exit(){ try{ const r = document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen && document.webkitExitFullscreen(); if(r && r.catch) r.catch(() => {}); }catch(e){} },
  toggle(){ if(!FS.supported()){ installSheet(); return; } if(FS.on()){ FS.userExit = true; FS.exit(); } else { FS.userExit = false; FS.enter(); } }
};
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; paintInstall(); });
window.addEventListener('appinstalled', () => { installEvt = null; cfg.installDismissed = true; saveCfg(); paintInstall(); toast('홈 화면에 설치했습니다'); });
function paintInstall(){
  const sa = isStandalone();
  $('banner').hidden = sa || inFrame || cfg.installDismissed;
  $('bFs').hidden = !FS.supported();
  $('hFS').hidden = sa;
  $('hFS').innerHTML = FS.on() ? ICON.fsOff : ICON.fsOn;
  $('hFS').setAttribute('aria-label', FS.on() ? '전체화면 끝내기' : '전체화면');
  $('instBtn').hidden = sa;
}
function installSheet(){
  if(isStandalone()){ toast('이미 홈 화면 앱으로 실행 중입니다'); return; }
  if(installEvt){ const ev = installEvt; installEvt = null; try{ ev.prompt(); ev.userChoice.then(r => { if(r && r.outcome === 'accepted'){ cfg.installDismissed = true; saveCfg(); } paintInstall(); }).catch(() => {}); }catch(e){} return; }
  const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const samsung = /SamsungBrowser/i.test(ua), inapp = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(ua), mobile = /Android|Mobi/i.test(ua) || ios;
  const k = t => `<span class="kbd">${t}</span>`;
  const how = inapp ? `<ol><li>${k('⋮')} 메뉴를 누르세요</li><li><b>다른 브라우저로 열기</b>를 누르세요</li><li>열린 화면에서 다시 설치하기를 누르세요</li></ol>`
    : ios ? `<ol><li>사파리의 ${k('공유 ⬆')} 단추를 누르세요</li><li><b>홈 화면에 추가</b>를 누르세요</li><li>오른쪽 위 <b>추가</b>를 누르세요</li></ol>`
    : samsung ? `<ol><li>아래 ${k('≡')} 메뉴를 누르세요</li><li><b>현재 페이지 추가</b> → <b>홈 화면</b>을 누르세요</li></ol>`
    : mobile ? `<ol><li>오른쪽 위 ${k('⋮')} 메뉴를 누르세요</li><li><b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 누르세요</li></ol>`
    : `<ol><li>크롬·엣지 주소창 오른쪽의 ${k('설치 ⊕')} 아이콘을 누르세요</li><li>없으면 ${k('⋮')} 메뉴 → <b>앱 설치</b>를 누르세요</li></ol>`;
  sheet(`<h3>홈 화면에 설치하기</h3><p>설치하면 아이콘으로 바로 열리고 화면을 넓게 쓸 수 있습니다.</p>${how}<button class="btn primary wide" data-close>알겠습니다</button>`);
}
function settingsSheet(){
  let h = '<h3>설정</h3>';
  h += '<button class="btn wide" data-a="key">API 키 바꾸기</button><button class="btn wide" data-a="voice">목소리와 모델</button>';
  if(FS.supported()) h += `<label class="sw"><span>자동 전체화면<small>화면을 처음 누르면 전체화면으로 바꿉니다</small></span><input type="checkbox" id="aFs"${cfg.autoFS ? ' checked' : ''}></label><button class="btn wide" data-a="fs">${FS.on() ? '전체화면 끝내기' : '전체화면 켜기'}</button>`;
  if(!isStandalone()) h += '<button class="btn wide" data-a="inst">홈 화면에 설치하기</button>';
  h += '<button class="btn danger wide" data-a="wipe">만든 녹음 모두 지우기</button><button class="btn primary wide" data-close>닫기</button>';
  const d = sheet(h, async (e, dim) => {
    const a = e.target.closest('[data-a]'); if(!a) return;
    const k = a.dataset.a;
    if(k === 'wipe'){ if(await ask('이 기기에 저장된 녹음을 모두 지울까요? 되돌릴 수 없습니다.', '모두 지우기')){ for(const c of Object.keys(REC)) await dbDel(c); REC = {}; paint(); dim.remove(); } return; }
    dim.remove();
    if(k === 'key') keySheet(); else if(k === 'voice') voiceSheet(); else if(k === 'fs') FS.toggle(); else if(k === 'inst') installSheet();
  });
  const sw = d.querySelector('#aFs'); if(sw) sw.addEventListener('change', () => { cfg.autoFS = sw.checked; saveCfg(); });
}

// ===== 시작 =====
$('hFS').addEventListener('click', FS.toggle);
$('hSet').addEventListener('click', settingsSheet);
$('bInst').addEventListener('click', installSheet);
$('instBtn').addEventListener('click', installSheet);
$('bFs').addEventListener('click', FS.toggle);
$('bLater').addEventListener('click', () => { cfg.installDismissed = true; saveCfg(); paintInstall(); toast('설정이나 화면 아래에서 언제든 설치할 수 있습니다'); });
$('keyBtn').addEventListener('click', keySheet);
$('voiceBtn').addEventListener('click', voiceSheet);
$('run').addEventListener('click', runAll);
$('zip').addEventListener('click', exportZip);
$('filters').addEventListener('click', e => { const f = e.target.closest('[data-f]'); if(f){ filter = f.dataset.f; paint(); } });
$('list').addEventListener('click', e => { const b = e.target.closest('[data-code]'); if(b) detail(b.dataset.code); });
document.addEventListener('click', e => {
  if(!cfg.autoFS || FS.userExit || FS.on() || !FS.supported()) return;
  if(e.target.closest && e.target.closest('#hFS, #hSet, #banner, .dim')) return;
  FS.enter();
}, true);
document.addEventListener('fullscreenchange', paintInstall);
document.addEventListener('webkitfullscreenchange', paintInstall);
document.addEventListener('visibilitychange', () => { if(running && document.visibilityState === 'visible') keepAwake(true); });
if('serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
window.__vs = { cfg, get REC(){ return REC; }, BUNDLES: () => BUNDLES, store, paint };  // 시험용

paintInstall();
(async () => {
  await dbOpen();
  try{ BUNDLES = (await (await fetch('lines.json')).json()).bundles; }catch(e){ status('대본 파일(lines.json)을 읽지 못했습니다.'); }
  (await dbAll()).forEach(r => { REC[r.code] = r; });
  if(!cfg.key) status('먼저 API 키를 넣어 주세요.');
  else if(!BUNDLES.every(b => REC[b.code])) status('준비되었습니다. "차례대로 만들기"를 누르면 묶음을 하나씩 만들고 자릅니다.');
  paint();
})();
})();
