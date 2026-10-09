'use strict';
/* ================= Firebase 중계 연결 =================
   기기끼리 직접 잇지 않고 Firebase Realtime Database를 우편함처럼 거쳐서 주고받습니다(일반 웹 연결이라 아이폰·앱 안 브라우저·LTE에서도 안정적).
   rooms/{방코드}/meta  방장 기기 표시 · hp 방장 접속 여부 · in 참가자→방장 우편함 · q/{기기} 방장→참가자 우편함 · pr/{기기} 참가자 접속 여부
   기기 이름표는 Firebase 익명 로그인 ID라서 다른 기기가 흉내 낼 수 없습니다. SDK는 함께하기를 쓸 때만 불러옵니다. */
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('fbload'));document.head.appendChild(s)})}
const FB={api:null,uid:null,ready:null,
  configured(){if(window.__FBMOCK)return true;const c=window.FIREBASE_CONFIG;return !!(c&&c.apiKey&&c.databaseURL)},
  load(){if(this.ready)return this.ready;
    this.ready=(async()=>{
      if(window.__FBMOCK){this.api=await window.__FBMOCK();this.uid=this.api.uid;return this}
      if(!window.firebase||!firebase.database)for(const f of ['app','auth','database'])await loadScript(`vendor/firebase-${f}-compat.js`);
      const app=firebase.apps.find(a=>a.name==='bm')||firebase.initializeApp(window.FIREBASE_CONFIG,'bm');
      const auth=app.auth();
      try{if(!auth.currentUser)await auth.signInAnonymously()}catch(e){throw new Error(/admin-restricted|operation-not-allowed/.test(e.code||'')?'fbauth':'fbnet')}
      this.uid=auth.currentUser.uid;const db=app.database(),TS=firebase.database.ServerValue.TIMESTAMP;
      const fix=v=>JSON.parse(JSON.stringify(v,(k,x)=>x===FB.TS?TS:x));
      this.api={uid:this.uid,
        set:(p,v)=>db.ref(p).set(fix(v)),push:(p,v)=>db.ref(p).push(fix(v)).then(r=>r.key),remove:p=>db.ref(p).remove(),
        get:p=>db.ref(p).once('value').then(s=>s.val()),
        onChildAdded(p,cb){const r=db.ref(p),f=r.on('child_added',s=>cb(s.key,s.val()));return ()=>r.off('child_added',f)},
        onValue(p,cb){const r=db.ref(p),f=r.on('value',s=>cb(s.val()));return ()=>r.off('value',f)},
        onDisconnectSet:(p,v)=>db.ref(p).onDisconnect().set(fix(v)),cancelDisconnect:p=>db.ref(p).onDisconnect().cancel(),
        onConnected(cb){const r=db.ref('.info/connected'),f=r.on('value',s=>cb(!!s.val()));return ()=>r.off('value',f)}};
      return this})().catch(e=>{this.ready=null;throw e});
    return this.ready},
  TS:'__TS__',
  /* 방 목록 듣기: 공개·비공개 방 모두 보이고(비공개는 🔒), 방장이 나가면 목록에서 사라집니다 */
  async watchLobby(cb){await this.load();return this.api.onValue('lobby',v=>cb(v||{}))}};
const FBTransport={
  /* 방장: 방 코드를 내 기기 이름으로 잡고, 우편함에 온 편지를 보낸 기기별 연결로 나눠 줍니다 */
  async host(code,onConn){await FB.load();const A=FB.api,u=FB.uid,R=`rooms/${code}`;
    const meta=await A.get(R+'/meta').catch(()=>null);if(meta&&meta.host!==u)throw new Error('taken');
    try{await A.set(R+'/meta',{host:u,t:FB.TS,v:1})}catch(e){throw new Error('taken')}
    await A.remove(R+'/in').catch(()=>{});
    const conns={};let offs=[];
    const mk=f=>{const w={vid:f,send:o=>{A.push(`${R}/q/${f}`,{s:JSON.stringify(o)}).catch(()=>{})},close:()=>{A.push(`${R}/q/${f}`,{s:'{"t":"__close"}'}).catch(()=>{});delete conns[f]},_d:null,_c:null};conns[f]=w;onConn(w);return w};
    const drop=f=>{const w=conns[f];if(!w)return;delete conns[f];w._c&&w._c()};
    /* 방 목록(lobby/{코드}): 방장이 접속해 있는 동안만 보이도록 끊기면 서버가 지웁니다 */
    let pub=null;const L='lobby/'+code;
    const publish=e=>{pub=e;if(!e){A.cancelDisconnect(L).catch(()=>{});A.remove(L).catch(()=>{});return}
      A.set(L,{...e,hu:u,t:FB.TS}).catch(()=>{});A.onDisconnectSet(L,null).catch(()=>{})};
    offs.push(A.onConnected(on=>{if(on){A.set(R+'/hp',{on:true,t:FB.TS});A.onDisconnectSet(R+'/hp',{on:false,t:FB.TS});if(pub)publish(pub)}}));
    offs.push(A.onChildAdded(R+'/in',(k,v)=>{A.remove(`${R}/in/${k}`).catch(()=>{});if(!v||typeof v.f!=='string'||typeof v.s!=='string')return;let o;try{o=JSON.parse(v.s)}catch(e){return}
      if(o&&o.t==='__close')return drop(v.f);
      const w=conns[v.f]||(o&&o.t==='hello'?mk(v.f):null);if(w&&w._d)w._d(o)}));
    offs.push(A.onValue(R+'/pr',all=>{for(const f in conns){const p=all&&all[f];if(p&&p.on===false)drop(f)}}));
    return {publish,close:async final=>{offs.forEach(f=>f());offs=[];for(const f in conns)conns[f].close();publish(null);
      try{await A.cancelDisconnect(R+'/hp');if(final){await A.remove(R+'/q');await A.remove(R+'/pr');await A.remove(R+'/in');await A.remove(R+'/hp');await A.remove(R+'/meta')}else await A.set(R+'/hp',{on:false,t:FB.TS})}catch(e){}}}},
  /* 참가자: 방이 열려 있는지 확인하고, 내 우편함을 듣고, 접속 여부를 남깁니다(끊기면 서버가 자동으로 "끊김"으로 바꿈) */
  async join(code){await FB.load();const A=FB.api,u=FB.uid,R=`rooms/${code}`;
    const meta=await A.get(R+'/meta').catch(()=>null);if(!meta)throw new Error('noroom');
    const hp=await A.get(R+'/hp').catch(()=>null);if(!hp||!hp.on)throw new Error('hostaway');
    await A.remove(`${R}/q/${u}`).catch(()=>{});
    let offs=[],closed=false,wasOff=false;
    const w={send:o=>{A.push(R+'/in',{f:u,s:JSON.stringify(o)}).catch(()=>{})},close:()=>{stop();A.push(R+'/in',{f:u,s:'{"t":"__close"}'}).catch(()=>{});A.set(`${R}/pr/${u}`,{on:false,t:FB.TS}).catch(()=>{})},_d:null,_c:null,_re:null};
    const stop=()=>{closed=true;offs.forEach(f=>f());offs=[];A.cancelDisconnect(`${R}/pr/${u}`).catch(()=>{})};
    const lost=()=>{if(closed)return;stop();w._c&&w._c()};
    offs.push(A.onConnected(on=>{if(on){A.set(`${R}/pr/${u}`,{on:true,t:FB.TS});A.onDisconnectSet(`${R}/pr/${u}`,{on:false,t:FB.TS});
        /* 잠깐 끊겼다가 다시 이어지면 방장이 나를 끊긴 사람으로 봤을 수 있으니 다시 인사합니다 */
        if(wasOff&&w._re)w._re();wasOff=false}else wasOff=true}));
    offs.push(A.onChildAdded(`${R}/q/${u}`,(k,v)=>{A.remove(`${R}/q/${u}/${k}`).catch(()=>{});if(!v||typeof v.s!=='string')return;let o;try{o=JSON.parse(v.s)}catch(e){return}
      if(o&&o.t==='__close')return lost();w._d&&w._d(o)}));
    let first=true;offs.push(A.onValue(R+'/hp',v=>{if(first){first=false;return}if(!v||!v.on)lost()}));
    return {conn:w,close:()=>w.close(),vid:u}}
};
