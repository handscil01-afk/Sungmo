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
const store={
  get(k,d){try{const v=localStorage.getItem('biblemarble.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem('biblemarble.'+k,JSON.stringify(v));return true}catch(e){return false}},
  del(k){try{localStorage.removeItem('biblemarble.'+k)}catch(e){}}};
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
