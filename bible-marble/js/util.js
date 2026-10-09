'use strict';
/* ================= 공통 도구 ================= */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const r10=v=>Math.round(v/10)*10;
const fmt=n=>Number(n||0).toLocaleString('ko-KR');
const clone=o=>o==null?o:JSON.parse(JSON.stringify(o));
const uid=(p='')=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sleepRaw=ms=>new Promise(r=>setTimeout(r,ms));
/* 받침에 맞는 조사 */
const lastCode=w=>{w=String(w).trim();return w.charCodeAt(w.length-1)-0xAC00};
const batchim=w=>{const c=lastCode(w);return c>=0&&c<11172&&c%28!==0};
const IGA=w=>w+(batchim(w)?'이':'가'), EUN=w=>w+(batchim(w)?'은':'는'), REUL=w=>w+(batchim(w)?'을':'를'), WA=w=>w+(batchim(w)?'과':'와');
const RO=w=>w+(batchim(w)&&lastCode(w)%28!==8?'으로':'로');
/* localStorage: 막혀 있어도 게임은 돌아가도록 모두 감쌉니다 */
/* 저장 이름 앞에 붙는 글자 (시험할 때 한 브라우저에서 여러 기기를 흉내 내려고 바꿀 수 있어요) */
const SP=()=>window.__SP||'biblemarble.';
const store={
  get(k,d){try{const v=localStorage.getItem(SP()+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem(SP()+k,JSON.stringify(v));return true}catch(e){return false}},
  del(k){try{localStorage.removeItem(SP()+k)}catch(e){}}};
/* 사진 말: 말(토큰) 값이 '@'+사진 번호(6글자)이면 이 기기에 저장한 사진을 동그랗게 보여 줍니다.
   사진은 고를 때 작게(128px) 줄여서 기기 안(localStorage)에만 두고, 함께하기에서는 방장이 같은 방 기기들에게만 나눠 줍니다. */
const PHOTOS=store.get('photos',{})||{};
const isPhoto=t=>typeof t==='string'&&/^@[a-z0-9]{6}$/.test(t);
const photoSrc=t=>isPhoto(t)&&PHOTOS[t.slice(1)]?PHOTOS[t.slice(1)].d:null;
function tokIn(t){if(!isPhoto(t))return esc(t);const s=photoSrc(t);return s?`<img class="ph" src="${s}" alt="" draggable="false">`:'📷'}
const tokTxt=t=>isPhoto(t)?'📷':t;
const okPhotoData=d=>typeof d==='string'&&d.length<60000&&/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(d);
function savePhoto(id,d){if(!/^[a-z0-9]{6}$/.test(id)||!okPhotoData(d))return false;
  PHOTOS[id]={d,t:Date.now()};for(const x of Object.keys(PHOTOS).sort((a,b)=>PHOTOS[b].t-PHOTOS[a].t).slice(24))delete PHOTOS[x];
  /* 저장 공간이 모자라면 오래된 사진부터 지웁니다 */
  while(!store.set('photos',PHOTOS)){const old=Object.keys(PHOTOS).sort((a,b)=>PHOTOS[a].t-PHOTOS[b].t);if(old.length<=1)break;delete PHOTOS[old[0]]}
  return true}
/* IndexedDB: 성경 본문처럼 큰 자료를 저장합니다 */
const IDB={db:null,
  open(){if(this.db)return Promise.resolve(this.db);return new Promise((res,rej)=>{let q;try{q=indexedDB.open('biblemarble',1)}catch(e){return rej(e)}
    q.onupgradeneeded=()=>q.result.createObjectStore('kv');q.onsuccess=()=>{this.db=q.result;res(this.db)};q.onerror=()=>rej(q.error)})},
  async get(k){try{const db=await this.open();return await new Promise((res,rej)=>{const r=db.transaction('kv').objectStore('kv').get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}catch(e){return undefined}},
  async set(k,v){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=()=>res(true);t.onerror=()=>rej(t.error)})},
  async del(k){try{const db=await this.open();return await new Promise(res=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').delete(k);t.oncomplete=()=>res(true);t.onerror=()=>res(false)})}catch(e){return false}}};
/* 파일 저장: 링크를 만들어 내려받게 합니다 */
function saveFile(name,data,type){
  const blob=data instanceof Blob?data:new Blob([data],{type:type||'application/octet-stream'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);
}
function pickFile(accept){return new Promise(res=>{const i=document.createElement('input');i.type='file';i.accept=accept||'';i.onchange=()=>res(i.files[0]||null);i.click()})}
const today=()=>{const d=new Date(),z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}${z(d.getMonth()+1)}${z(d.getDate())}`};
/* 한글 텍스트 파일은 UTF-8 또는 EUC-KR(CP949)인 경우가 많습니다 */
async function readText(file){const buf=await file.arrayBuffer();
  try{return new TextDecoder('utf-8',{fatal:true}).decode(buf).replace(/^﻿/,'')}catch(e){}
  try{return new TextDecoder('euc-kr').decode(buf)}catch(e){return new TextDecoder().decode(buf)}}
