'use strict';
/* ===================== 효과음 · 배경음 (내 PC 파일) =====================
   방송 음원처럼 저작권이 있는 소리 파일은 저장소(깃허브)에 넣지 않음.
   진행자 PC에서 파일을 골라 이 브라우저(IndexedDB)에만 저장하고, 같은 브라우저로 연 프로젝터 창이 꺼내 재생함.
   프로젝터를 다른 PC로 띄우면 그 PC에서도 한 번 불러와야 함.
   자리: 인트로 · 행진곡 · 배경음(반복) = 음악(진행자가 켜고 끔, 한 번에 하나) / 시간 끝 · 정답 발표 = 효과음(자동) */
const SFX_SLOTS = [
  { key:'intro',  name:'인트로',                 kind:'music', kw:/인트로|intro/i },
  { key:'march',  name:'행진곡 (입장·시상)',      kind:'music', kw:/행진|위풍|march/i },
  { key:'bgm',    name:'배경음 (반복)',           kind:'music', loop:true, kw:/bgm|배경|my\s*girl/i },
  { key:'timeup', name:'시간 끝 (정답 들어주세요)', kind:'fx',    kw:/들어|time\s*up/i },
  { key:'reveal', name:'정답 발표 (정답은)',      kind:'fx',    kw:/정답\s*은|reveal/i },
];
const SFX_ORDER_MATCH = ['bgm', 'timeup', 'reveal', 'march', 'intro'];   // 파일 이름으로 자리를 찾는 순서
const SFX = { files:{}, music:null, musicKey:'', loaded:false };

function idb(){
  return new Promise((res, rej) => {
    if(!('indexedDB' in window)) return rej(new Error('no idb'));
    const r = indexedDB.open('gb1sfx', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idbDo(mode, fn){
  const db = await idb();
  return new Promise((res, rej) => { const tx = db.transaction('files', mode), st = tx.objectStore('files'); const out = fn(st); tx.oncomplete = () => res(out && out.result !== undefined ? out.result : out); tx.onerror = () => rej(tx.error); });
}
async function sfxLoad(){
  try{
    const keys = await idbDo('readonly', st => st.getAllKeys());
    const next = {};
    for(const k of keys || []){
      const v = await idbDo('readonly', st => st.get(k));
      if(!v || !v.blob) continue;
      const old = SFX.files[k];
      next[k] = old && old.size === v.blob.size && old.name === v.name ? old : { name:v.name, size:v.blob.size, url:URL.createObjectURL(v.blob), dur:0 };
    }
    Object.entries(SFX.files).forEach(([k, f]) => { if(next[k] !== f) try{ URL.revokeObjectURL(f.url); }catch(e){} });
    SFX.files = next; SFX.loaded = true;
    Object.entries(SFX.files).forEach(([k, f]) => { if(f.dur) return; const a = new Audio(); a.preload = 'metadata'; a.src = f.url; a.onloadedmetadata = () => { f.dur = isFinite(a.duration) ? a.duration : 0; }; });
  }catch(e){ SFX.loaded = true; }
  if(typeof schedule === 'function') schedule();
  if(typeof pushPresence === 'function') pushPresence();
}
async function sfxSave(key, file){
  await idbDo('readwrite', st => st.put({ name:file.name, blob:file }, key));
  try{ localStorage.setItem('gb1_sfxRev', String(Date.now())); }catch(e){}
  await sfxLoad();
}
async function sfxDelete(key){
  await idbDo('readwrite', st => st.delete(key));
  try{ localStorage.setItem('gb1_sfxRev', String(Date.now())); }catch(e){}
  await sfxLoad();
}
// 다른 창(진행자 창)에서 파일을 바꾸면 프로젝터 창도 다시 읽음
addEventListener('storage', e => { if(e.key === 'gb1_sfxRev') sfxLoad(); });
// 여러 파일을 한꺼번에 고르면 파일 이름으로 자리를 찾아 넣음
function sfxGuess(name){
  for(const k of SFX_ORDER_MATCH){ const s = SFX_SLOTS.find(x => x.key === k); if(s.kw.test(name)) return k; }
  return '';
}
const sfxHas = k => !!SFX.files[k];

/* 효과음 한 번: 재생 시간(초)을 돌려줌 */
function sfxPlay(key, vol){
  const f = SFX.files[key]; if(!f) return 0;
  try{ const a = new Audio(f.url); a.volume = vol == null ? 1 : vol; a.play().catch(() => {}); }catch(e){ return 0; }
  return f.dur || 2;
}
/* 음악: 한 번에 하나. 끌 때는 1.2초 동안 작아지며 멈춤 */
function musicStart(key, vol, id){
  const f = SFX.files[key]; if(!f) return false;
  // 같은 요청이면 다시 틀지 않음 (인트로처럼 한 번 끝난 곡이 화면이 바뀔 때마다 다시 나오지 않게)
  if(SFX.music && SFX.musicKey === key && SFX.musicId === id){ SFX.music.volume = vol == null ? 0.8 : vol; return true; }
  musicStop(true);
  const slot = SFX_SLOTS.find(s => s.key === key) || {};
  const a = new Audio(f.url); a.loop = !!slot.loop; a.volume = vol == null ? 0.8 : vol;
  a.play().catch(() => {});
  SFX.music = a; SFX.musicKey = key; SFX.musicId = id;
  return true;
}
function musicStop(now){
  const a = SFX.music; SFX.music = null; SFX.musicKey = ''; SFX.musicId = '';
  if(!a) return;
  if(now){ try{ a.pause(); }catch(e){} return; }
  const v0 = a.volume, t0 = performance.now();
  const step = () => { const p = (performance.now() - t0) / 1200; if(p >= 1){ try{ a.pause(); }catch(e){} return; } a.volume = Math.max(0, v0 * (1 - p)); requestAnimationFrame(step); };
  step();
}
// 프로젝터 창: 진행자가 정한 음악 상태를 따라감
function musicFollow(){
  if(ROLE !== 'screen') { return; }
  const m = S.live.music;
  if(m && m.on && m.key){ if(!musicStart(m.key, m.vol == null ? 0.8 : m.vol, m.id)){} }
  else if(SFX.music) musicStop();
}
sfxLoad();
