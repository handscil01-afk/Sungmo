'use strict';
/* ================= 함께하기(멀티플레이) =================
   방장 기기가 게임 엔진을 돌리는 심판입니다. 참가자 기기는 방장이 보낸 상태를 그대로 그리고, 자기 차례의 선택만 보냅니다.
   방장은 "지금 기다리는 요청서"의 답할 사람(engine.js의 actorOf)과 보낸 기기가 맞을 때만 선택을 받아들이고 값도 검사하므로,
   참가자가 남의 행동을 하거나 달란트·땅·위치 같은 상태를 임의로 바꿀 수 없습니다.
   역할: 플레이어(자기 자리만) · 게임 화면(공개 정보만 받는 TV·표시 창) · 진행자 리모컨(중계 모드, PIN 필요, 정답을 받음).
   자리마다 방장이 발급한 열쇠가 있어서, 같은 열쇠로 다시 들어와야 같은 자리로 돌아갑니다.
   연결: PeerJS(기기끼리 직접 연결, 처음 연결할 때만 무료 PeerJS 서버 사용). 시험용으로 같은 브라우저 안에서는 BroadcastChannel을 씁니다. */
const NET_PREFIX='biblemarble-v1-';
const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode=()=>Array.from({length:6},()=>CODE_CHARS[Math.random()*CODE_CHARS.length|0]).join('');
function myDeviceId(){if(window.__CID)return window.__CID;let id=store.get('net.cid',null);if(!id){id=uid('d');store.set('net.cid',id)}return id}

/* ---------- 연결 방식 ---------- */
function wrapPeerConn(c){const w={send:o=>{try{if(c.open)c.send(o)}catch(e){}},close:()=>{try{c.close()}catch(e){}},_d:null,_c:null,closed:false};
  c.on('data',d=>w._d&&w._d(d));const cl=()=>{if(w.closed)return;w.closed=true;w._c&&w._c()};c.on('close',cl);c.on('error',cl);return w}
const PeerTransport={
  host(code,onConn){return new Promise((res,rej)=>{if(typeof Peer==='undefined')return rej(new Error('nolib'));
    const peer=new Peer(NET_PREFIX+code,{debug:0});let opened=false;
    peer.on('open',()=>{opened=true;res({close:()=>{try{peer.destroy()}catch(e){}}})});
    peer.on('error',e=>{if(!opened){rej(e.type==='unavailable-id'?new Error('taken'):e);try{peer.destroy()}catch(x){}}});
    peer.on('connection',c=>c.on('open',()=>onConn(wrapPeerConn(c))));
    peer.on('disconnected',()=>{try{peer.reconnect()}catch(e){}})})},
  join(code){return new Promise((res,rej)=>{if(typeof Peer==='undefined')return rej(new Error('nolib'));
    const peer=new Peer(undefined,{debug:0});let done=false;const fail=e=>{if(done)return;done=true;try{peer.destroy()}catch(x){}rej(e)};
    const to=setTimeout(()=>fail(new Error('timeout')),15000);
    peer.on('open',()=>{const c=peer.connect(NET_PREFIX+code,{reliable:true,serialization:'json'});c.on('open',()=>{if(done)return;done=true;clearTimeout(to);res({conn:wrapPeerConn(c),close:()=>{try{peer.destroy()}catch(e){}}})})});
    peer.on('error',e=>fail(e.type==='peer-unavailable'?new Error('noroom'):e))})}};
const BCTransport={
  host(code,onConn){const ch=new BroadcastChannel('bm-'+code),conns={};
    ch.onmessage=e=>{const m=e.data;if(m.to!=='host')return;
      if(m.t==='__open'){const id=m.from,w={send:o=>ch.postMessage({to:id,d:o}),close:()=>ch.postMessage({to:id,t:'__close'}),_d:null,_c:null};conns[id]=w;ch.postMessage({to:id,t:'__ok'});onConn(w)}
      else if(m.t==='__close'){const w=conns[m.from];delete conns[m.from];w&&w._c&&w._c()}else{const w=conns[m.from];w&&w._d&&w._d(m.d)}};
    const bye=()=>{for(const id in conns)ch.postMessage({to:id,t:'__close'})};addEventListener('pagehide',bye);
    return Promise.resolve({close:()=>{bye();removeEventListener('pagehide',bye);setTimeout(()=>ch.close(),50)}})},
  join(code){return new Promise((res,rej)=>{const ch=new BroadcastChannel('bm-'+code),me=uid('c');let done=false,shut=false;
    const post=o=>{if(!shut)try{ch.postMessage(o)}catch(e){}};
    const w={send:o=>post({to:'host',from:me,d:o}),close:()=>{post({to:'host',from:me,t:'__close'});removeEventListener('pagehide',bye);setTimeout(()=>{shut=true;ch.close()},50)},_d:null,_c:null};
    ch.onmessage=e=>{const m=e.data;if(m.to!==me)return;if(m.t==='__ok'){done=true;res({conn:w,close:()=>w.close()})}else if(m.t==='__close'){w._c&&w._c()}else w._d&&w._d(m.d)};
    const bye=()=>post({to:'host',from:me,t:'__close'});addEventListener('pagehide',bye);
    post({to:'host',from:me,t:'__open'});setTimeout(()=>{if(!done){shut=true;removeEventListener('pagehide',bye);ch.close();rej(new Error('noroom'))}},2500)})}};
/* 연결 방식: 같은 기기의 창끼리는 BroadcastChannel, Firebase 설정이 있으면 Firebase 중계, 없으면 PeerJS 직접 연결 */
const transport=local=>local||window.__NET==='bc'?BCTransport:FB.configured()?FBTransport:PeerTransport;
const LOBBY_GRACE_MS=()=>window.__LOBBYMS||15000;

const OFFLINE_ASK_MS=()=>window.__OFFMS||30000;
const Net={
  role:null,kind:null,mode:null,code:null,links:[],members:new Map(),keys:{},pin:null,G:null,curPrompt:null,mySeat:null,cid:null,key:null,online:{},conn:null,
  retryT:0,pushT:0,watchT:0,lastLobby:null,lastPrompt:null,lastSecret:null,reqs:[],
  /* ---------- 엔진·화면이 부르는 함수 (혼자 할 때는 아무 일도 하지 않음) ---------- */
  event(e){if(this.role==='host')this.broadcast({t:'e',e})},
  prompt(spec){if(this.role!=='host')return;this.lastPrompt=spec?this.pubSpec(spec):null;
    /* 정답·해설은 진행자 리모컨에만 보냅니다 (리모컨은 진행자 PIN으로만 연결) */
    this.lastSecret=spec&&spec.secret?clone(spec.secret):null;
    for(const m of this.members.values())if(m.online&&m.conn)m.conn.send(this.promptMsg(m))},
  promptMsg(m){return {t:'p',p:this.lastPrompt||null,secret:m.kind==='remote'?this.lastSecret:null}},
  pubSpec(spec){const o={};for(const [k,v] of Object.entries(spec))if(!['resolve','secret','aiSeq','by','picks'].includes(k)&&typeof v!=='function')o[k]=v;return clone(o)},
  /* 상태 보내기: 바뀌지 않는 보드·카드는 처음 한 번만(st), 매번은 바뀌는 부분만(s) 보냅니다 */
  pushState(){if(this.role!=='host'||!G)return;this.publishLobby();clearTimeout(this.pushT);this.pushT=setTimeout(()=>{if(!G)return;this.sendPhotos();
    if(this.sentSid!==G.started){this.sentSid=G.started;this.broadcast({t:'st',S:this.staticPart()})}
    this.broadcast({t:'s',G:this.slim(),online:this.onlineMap()})},60)},
  staticPart(){return {sid:G.started,board:G.board,cards:G.cards}},
  slim(){const o={};for(const [k,v] of Object.entries(G))if(!['board','cards','setup','used'].includes(k))o[k]=v;o.log=G.log.slice(0,40);return o},
  saveInfo(){return this.role==='host'?{code:this.code,mode:this.mode,keys:this.keys,pin:this.pin,room:this.room}:null},
  savedSession(){const s=store.get('net.session',null);return s&&Date.now()-s.t<12*3600e3?s:null},
  isOnline(cid){return this.role==='host'?!!(this.members.get(cid)||{}).online:!!this.online[cid]},
  onlineMap(){const o={};for(const m of this.members.values())if(m.kind==='player')o[m.cid]=!!m.online;return o},
  broadcast(msg){for(const m of this.members.values())if(m.online&&m.conn)m.conn.send(msg)},
  /* 같은 기기의 게임 화면 창이 연결되어 있으면 이 기기는 진행자 전용 화면이므로 정답을 보여 줍니다 */
  hostSeesAnswers(){return this.role==='host'&&[...this.members.values()].some(m=>m.kind==='display'&&m.online&&m.local)},
  displays(){return [...this.members.values()].filter(m=>m.kind==='display'&&m.online)},

  /* ---------- 방장 ---------- */
  async host(mode,code,restore,room){
    this.leave(true);this.role='host';this.mode=mode==='relay'?'relay':'player';this.members=new Map();this.reqs=[];
    const kept=restore||store.get('net.keys',null);
    /* 방 이름·공개 여부·비밀번호: 비밀번호는 서버에 올리지 않고 방장 기기만 알고 있다가 들어오는 사람을 확인합니다 */
    this.room=room||(kept&&kept.code===code&&kept.room)||{title:'',pub:true,pw:''};
    this.keys=kept&&kept.code===code&&kept.keys?kept.keys:{};this.pin=kept&&kept.code===code&&kept.pin?kept.pin:String(1000+Math.random()*9000|0);
    let tries=0;for(;;){this.code=code||genCode();
      try{this.links=[await transport().host(this.code,c=>this.onConn(c,window.__NET==='bc'))];break}
      catch(e){if(e.message==='taken'&&!code&&tries++<5)continue;if(e.message==='taken'&&code&&tries++<12){await sleepRaw(2500);continue}
        /* 인터넷이 안 되어도 중계 모드는 같은 PC의 게임 화면 창만으로 진행할 수 있어요 */
        if(this.mode==='relay'&&window.__NET!=='bc'){this.code=this.code||genCode();this.links=[];UI.toast('인터넷 연결이 없어 같은 기기의 게임 화면 창만 연결할 수 있어요',4000);break}
        this.role=null;this.code=null;throw e}}
    if(window.__NET!=='bc')try{this.links.push(await BCTransport.host(this.code,c=>this.onConn(c,true)))}catch(e){}
    this.lastPub=null;this.saveKeys();store.set('net.session',{role:'host',code:this.code,mode:this.mode,t:Date.now()});this.publishLobby();
    clearInterval(this.watchT);this.watchT=setInterval(()=>this.watch(),2000);UI.updateHeader();return this.code},
  saveKeys(){if(this.role==='host')store.set('net.keys',{code:this.code,keys:this.keys,pin:this.pin,room:this.room})},
  /* 방 목록에 보일 정보 (Firebase로 연결할 때만) */
  lobbyEntry(){const P=G?G.players:SETUP.players,cfg=G?G.cfg:SETUP.cfg,host=P.find(p=>p.host);
    const prof=store.get('net.profile',null);
    return {title:(this.room&&this.room.title)||'',host:host?host.name:(prof&&prof.name)||'진행자',mode:this.mode,pub:!(this.room&&this.room.pw),
      n:P.filter(p=>p.host||p.net).length,max:P.length,board:G?G.board.name:Content.board(cfg.board).name,diff:cfg.diff,rounds:cfg.rounds||0,started:!!G&&!G.over,v:1}},
  publishLobby(){if(this.role!=='host')return;clearTimeout(this.pubT);this.pubT=setTimeout(()=>{if(this.role!=='host')return;const e=this.lobbyEntry(),j=JSON.stringify(e);
    if(j===this.lastPub)return;this.lastPub=j;for(const l of this.links)if(l.publish)l.publish(e)},400)},
  onConn(c,local){let member=null;
    c._d=msg=>{if(!msg||typeof msg!=='object')return;
      if(msg.t==='hello'){member=this.hello(c,msg,local);return}
      if(!member||member.conn!==c)return;member.last=Date.now();
      if(msg.t==='profile')this.profile(member,msg);
      else if(msg.t==='photo')this.onPhoto(member,msg);
      else if(msg.t==='team')this.moveTeam(member,+msg.seat);
      else if(msg.t==='in')this.onInput(member,msg);
      else if(msg.t==='cmd')this.onCmd(member,msg);
      else if(msg.t==='reqseat'&&G&&member.kind==='player'&&!G.players.some(p=>p.net===member.cid))this.request(member);
      else if(msg.t==='ping')c.send({t:'pong',at:msg.at})};
    c._c=()=>{if(member&&member.conn===c){member.online=false;member.conn=null;member.offSince=Date.now();member.asked=0;
      this.reqs=this.reqs.filter(r=>r.cid!==member.cid);if(this.reqUI&&this.reqUI.cid===member.cid){this.closeReq();this.nextReq()}
      if(member.kind==='remote')setTimeout(()=>this.remoteGone(),300);
      if(member.kind==='player')UI.toast(`📴 ${member.name}님 연결이 끊겼어요`);if(!G&&member.kind==='player')this.lobbyLeft(member.cid);this.lobbyChanged();if(G)UI.render()}}},
  hello(c,msg,local){let cid=String(c.vid||msg.cid||'').slice(0,40);if(!cid)return null;const kind=['display','remote'].includes(msg.kind)?msg.kind:'player';
    if(kind==='remote'&&(this.mode!=='relay'||String(msg.pin||'')!==this.pin)){c.send({t:'deny',why:this.mode!=='relay'?'mode':'pin'});return null}
    /* 비공개 방: 처음 들어오는 기기는 비밀번호가 맞아야 해요 (전에 들어온 적 있는 기기·같은 PC의 게임 화면 창은 통과) */
    const pw=this.room&&this.room.pw,known=this.keys[cid]&&(c.vid||this.keys[cid]===msg.key);
    if(pw&&!local&&kind!=='remote'&&!known&&String(msg.pw||'')!==pw){c.send({t:'deny',why:'pw'});return null}
    /* 열쇠가 다르면 다른 기기가 같은 이름표를 쓰는 것이므로 새 기기로 봅니다 */
    if(!c.vid&&kind==='player'&&this.keys[cid]&&this.keys[cid]!==msg.key)cid=cid+'-'+uid('x').slice(-4);
    let m=this.members.get(cid);if(!m){m={cid};this.members.set(cid,m)}
    if(m.conn&&m.conn!==c)m.conn.close();
    Object.assign(m,{conn:c,online:true,local:!!local,kind,last:Date.now(),offSince:0,asked:0,name:String(msg.name||'참가자').slice(0,10),emoji:String(msg.emoji||'😀').slice(0,7),color:PALETTE.includes(msg.color)?msg.color:PALETTE[0],ph:new Set()});
    if(kind==='player'&&!this.keys[cid]){this.keys[cid]=uid('k');this.saveKeys()}
    const welcome=seat=>c.send({t:'welcome',cid,key:this.keys[cid]||null,code:this.code,mode:this.mode,kind,seat});
    if(kind!=='player'){welcome(null);if(G)this.sendGame(m);else this.lobbyChanged();
      UI.toast(kind==='display'?'📺 게임 화면이 연결됐어요':'🎛️ 진행자 리모컨이 연결됐어요');
      if(kind==='remote'&&this.mode==='relay')for(const x of Object.values(this.decs)){if(x.d.on==='host')closeLayer('edit');x.d.on='remote';c.send({t:'ask',d:x.d})}
      if(G)UI.render();return m}
    if(G){const p=G.players.find(x=>x.net===cid||(x.mates||[]).some(y=>y.cid===cid));welcome(p?p.id:null);this.sendGame(m);
      if(p){UI.toast(`📶 ${m.name}님이 다시 들어왔어요`);redispatch()}
      else this.request(m);
      UI.render()}
    else{this.seat(m);UI.toast(`📶 ${m.name}님이 들어왔어요`);this.lobbyChanged()}
    return m},
  sendGame(m){this.sendPhotos();m.conn.send({t:'st',S:this.staticPart()});m.conn.send({t:'s',G:this.slim(),online:this.onlineMap()});m.conn.send(this.promptMsg(m))},
  /* 로비 자리 규칙: 정한 인원까지 컴퓨터로 채워 두고, 사람이 들어오면 컴퓨터 한 자리를 넘겨받습니다(최대 4명).
     다른 브라우저로 다시 들어온 사람은 이름이 같은 끊긴 자리로 돌려보내서 이름이 두 번 생기지 않게 합니다 */
  seat(m){const P=SETUP.players;let k=P.findIndex(p=>p.net===m.cid);
    /* 팀전: 이미 팀원으로 들어와 있던 기기는 그 팀으로 돌려보냅니다 */
    const mk=P.findIndex(p=>(p.mates||[]).some(x=>x.cid===m.cid));if(k<0&&mk>=0){const x=P[mk].mates.find(x=>x.cid===m.cid);x.name=m.name;
      m.conn&&m.conn.send({t:'welcome',cid:m.cid,key:this.keys[m.cid],code:this.code,mode:this.mode,kind:'player',seat:mk});saveSetup();return}
    if(k<0){k=P.findIndex(p=>p.net&&!this.isOnline(p.net)&&p.name===m.name);if(k>=0){clearTimeout(this.relT[P[k].net]);this.members.delete(P[k].net)}}
    if(k<0)k=P.findIndex(p=>!p.net&&p.ai&&!p.host);
    if(k<0&&P.length<4&&!SETUP.cfg.teams){P.push({pid:uid('p'),name:'',ai:false,emoji:'',color:'',dice:'screen'});k=P.length-1}
    /* 팀전: 빈 자리가 없으면 팀원이 가장 적은 팀에 팀원으로 넣습니다 */
    if(k<0&&SETUP.cfg.teams){const t=this.teamSeats();if(t.length){const q=t.sort((a,b)=>(a.mates||[]).length-(b.mates||[]).length)[0];this.addMate(q,m);
      m.conn&&m.conn.send({t:'welcome',cid:m.cid,key:this.keys[m.cid],code:this.code,mode:this.mode,kind:'player',seat:P.indexOf(q)});saveSetup();return}}
    if(k<0){m.conn&&m.conn.send({t:'welcome',cid:m.cid,key:this.keys[m.cid],code:this.code,mode:this.mode,kind:'player',seat:null});m.conn&&m.conn.send({t:'note',m:'방이 가득 차서(최대 4명) 구경하는 사람으로 들어왔어요'});return}
    const p=P[k],usedC=P.filter((x,i)=>i!==k).map(x=>x.color),usedE=P.filter((x,i)=>i!==k).map(x=>x.emoji);
    /* 팀전에서 방장이 이름을 붙여 둔 자리(예: 사랑반)는 팀 이름을 그대로 둡니다 */
    const keepName=SETUP.cfg.teams&&p.ai&&p.name&&!AI_NAMES.includes(p.name);
    Object.assign(p,{net:m.cid,ai:false,host:false,op:false,name:keepName?p.name:m.name,emoji:usedE.includes(m.emoji)?TOKENS.find(t=>!usedE.includes(t)):m.emoji,color:usedC.includes(m.color)?PALETTE.find(c=>!usedC.includes(c)):m.color});
    m.conn&&m.conn.send({t:'welcome',cid:m.cid,key:this.keys[m.cid],code:this.code,mode:this.mode,kind:'player',seat:k});saveSetup()},
  /* ---------- 팀전: 한 자리에 여러 기기 ---------- */
  teamSeats(){return SETUP.players.filter(p=>p.net&&!p.host)},
  addMate(p,m){p.mates=(p.mates||[]).filter(x=>x.cid!==m.cid);p.mates.push({cid:m.cid,name:m.name})},
  /* 자리에서 빼기: 팀원이면 팀원 목록에서, 자리 주인이면 첫 팀원이 주인이 되고, 팀원이 없으면 컴퓨터 자리로 */
  leaveSeat(cid){const P=SETUP.players;for(const p of P){if(p.mates&&p.mates.some(x=>x.cid===cid)){p.mates=p.mates.filter(x=>x.cid!==cid);return}}
    const p=P.find(x=>x.net===cid);if(!p)return;
    if(p.mates&&p.mates.length){const n=p.mates.shift();p.net=n.cid;return}
    const usedN=P.map(x=>x.name),usedE=P.filter(x=>x!==p).map(x=>x.emoji);
    Object.assign(p,{net:null,ai:true,name:AI_NAMES.find(n=>!usedN.includes(n))||'컴퓨터',emoji:usedE.includes(p.emoji)?TOKENS.find(t=>!usedE.includes(t)):p.emoji})},
  moveTeam(m,k){if(G||m.kind!=='player'||!SETUP.cfg.teams)return;const P=SETUP.players,t=P[k];if(!t||t.host||t.op||t.net===m.cid||(t.mates||[]).some(x=>x.cid===m.cid))return;
    if(!t.net&&!t.ai)return;
    this.leaveSeat(m.cid);
    if(t.ai&&!t.net){const usedC=P.filter(x=>x!==t).map(x=>x.color),usedE=P.filter(x=>x!==t).map(x=>x.emoji),keepName=t.name&&!AI_NAMES.includes(t.name);
      Object.assign(t,{net:m.cid,ai:false,op:false,name:keepName?t.name:m.name,emoji:usedE.includes(m.emoji)?TOKENS.find(e=>!usedE.includes(e)):m.emoji,color:usedC.includes(m.color)?PALETTE.find(c=>!usedC.includes(c)):m.color})}
    else this.addMate(t,m);
    m.conn&&m.conn.send({t:'welcome',cid:m.cid,key:this.keys[m.cid],code:this.code,mode:this.mode,kind:'player',seat:k});saveSetup();this.lobbyChanged()},
  /* 로비에서 연결이 끊긴 채 잠시 돌아오지 않으면 그 자리를 컴퓨터로 채웁니다 */
  relT:{},
  lobbyLeft(cid){clearTimeout(this.relT[cid]);this.relT[cid]=setTimeout(()=>{if(this.role!=='host'||G||this.isOnline(cid))return;
    const P=SETUP.players,p=P.find(x=>x.net===cid||(x.mates||[]).some(y=>y.cid===cid));if(!p)return;
    const mate=p.net!==cid,solo=!mate&&!(p.mates&&p.mates.length);
    UI.toast(solo?`📴 ${p.name}님이 돌아오지 않아 컴퓨터로 채웠어요`:'📴 팀원 한 명이 돌아오지 않아 팀에서 뺐어요');
    this.leaveSeat(cid);this.members.delete(cid);saveSetup();this.lobbyChanged()},LOBBY_GRACE_MS())},
  unseat(cid){const m=this.members.get(cid);if(m&&m.conn)m.conn.send({t:'welcome',cid,key:this.keys[cid],code:this.code,mode:this.mode,kind:'player',seat:null})},
  profile(m,msg){if(G||m.kind!=='player')return;m.name=String(msg.name||m.name).slice(0,10);m.emoji=String(msg.emoji||m.emoji).slice(0,7);
    const P=SETUP.players,k=P.findIndex(p=>p.net===m.cid);if(k<0)return;const usedC=P.filter((x,i)=>i!==k).map(x=>x.color);
    P[k].name=m.name;P[k].emoji=m.emoji;if(PALETTE.includes(msg.color)&&!usedC.includes(msg.color))P[k].color=msg.color;saveSetup();this.lobbyChanged()},
  /* 사진 말: 참가자가 보낸 사진을 받아 두고(같은 번호가 이미 있으면 바꾸지 않음), 쓰이는 사진을 아직 못 받은 기기에만 보냅니다 */
  onPhoto(m,msg){const id=String(msg.id||'');if(m.kind!=='player'||PHOTOS[id]||!savePhoto(id,msg.d))return;this.sendPhotos();if(G)UI.render();else this.lobbyChanged()},
  usedPhotos(){const ids=new Set();for(const p of SETUP.players)if(isPhoto(p.emoji))ids.add(p.emoji.slice(1));if(G)for(const p of G.players)if(isPhoto(p.tok))ids.add(p.tok.slice(1));return [...ids].filter(id=>PHOTOS[id])},
  sendPhotos(){if(this.role!=='host')return;const used=this.usedPhotos();if(!used.length)return;
    for(const m of this.members.values()){if(!m.online||!m.conn)continue;m.ph=m.ph||new Set();const P={};let n=0;for(const id of used)if(!m.ph.has(id)){P[id]=PHOTOS[id].d;m.ph.add(id);n++}if(n)m.conn.send({t:'ph',P})}},
  sendMyPhoto(){const e=this.profileData&&this.profileData.emoji;if(this.role==='client'&&this.kind==='player'&&this.conn&&photoSrc(e))this.conn.send({t:'photo',id:e.slice(1),d:photoSrc(e)})},
  lobbyChanged(){if(this.role!=='host')return;this.sendPhotos();
    const lobby={t:'lobby',code:this.code,mode:this.mode,title:(this.room&&this.room.title)||'',teams:!!SETUP.cfg.teams,seats:SETUP.players.map(p=>({name:p.name,emoji:p.emoji,color:p.color,ai:p.ai,host:!!p.host,op:!!p.op,net:p.net||null,online:p.net?this.isOnline(p.net):true,mates:(p.mates||[]).map(x=>({cid:x.cid,name:x.name}))})),board:Content.board(SETUP.cfg.board).name};
    this.broadcast(lobby);this.publishLobby();if(Setup.L&&$('#tabpane')&&Setup.tab==='people'&&!Setup.inGame)Setup.pane();if(Setup.L&&Setup.tab==='net')Setup.pane()},
  /* 참가자의 선택: 지금 요청서의 답할 사람이 이 기기일 때만 받아들입니다 */
  onInput(m,msg){const spec=PROMPT;if(!spec||spec.id!==msg.id||!spec.actor)return;const a=spec.actor;
    if(spec.kind==='qall')return allPart(spec,msg.v,m);
    if(msg.v==='skip'&&a.t==='ai'&&m.kind==='remote'&&['notice','card'].includes(spec.kind))return spec.resolve&&spec.resolve(true,'skip');
    const ok=(a.t==='net'&&m.kind==='player'&&(a.cid===m.cid||(a.cids||[]).includes(m.cid)))||(a.t==='judge'&&m.kind==='remote');
    if(ok&&spec.resolve)spec.resolve(msg.v,'net')},

  /* 진행자 리모컨의 명령: 리모컨 기기에서 온 것만 받고 값도 검사합니다 */
  onCmd(m,msg){if(m.kind!=='remote'||!G||this.mode!=='relay')return;const p=G.players.find(x=>x.id===msg.id),lv=['easy','normal','hard'].includes(msg.lv)?msg.lv:null;
    switch(msg.c){
      case 'toai':if(!p||!lv||p.out)break;if(p.op){p.op=false;p.ai=true;p.aiLv=lv;log(`${p.name} 자리를 컴퓨터가 이어서 해요`,p);UI.render();persist();redispatch()}else if(p.net)this.toAI(p,lv);else if(p.ai){p.aiLv=lv;UI.render();persist()}break;
      case 'op':if(p&&p.ai&&!p.out){p.ai=false;p.op=true;log(`${p.name} 자리를 진행자가 조작해요`,p);UI.render();persist();redispatch()}break;
      case 'money':{const v=+msg.v;if(p&&Number.isInteger(v)&&Math.abs(v)<=100000)adjustMoney(p.id,v,String(msg.why||'').slice(0,30));break}
      case 'undo':if(canUndo())undo();break;
      case 'pause':setPause(!!msg.on);break;
      case 'hq':queueHQ(msg.q);break
      case 'ans':if(typeof msg.id==='string'&&this.decs[msg.id])this.finishDecision(msg.id,String(msg.v||''));break}},
  cmd(o){if(this.role==='client'&&this.kind==='remote')this.conn?this.conn.send({t:'cmd',...o}):UI.toast('방장과 연결이 끊겨서 보내지 못했어요')},

  /* ---------- 게임 중 자리 바꾸기 ---------- */
  freeSeats(cid){if(!G)return [];return G.players.filter(p=>!p.out&&!p.host&&(p.ai||(p.net&&p.net!==cid&&!this.isOnline(p.net))||(p.prev===cid)))},
  mateSeats(){return G&&G.cfg.teams?G.players.filter(p=>!p.out&&p.net&&!p.ai&&!p.host):[]},
  request(m){const seats=this.freeSeats(m.cid);
    if(!seats.length&&!this.mateSeats().length){m.conn.send({t:'note',m:'빈 자리가 없어서 구경하는 사람으로 들어왔어요'});return}
    this.reqs=this.reqs.filter(r=>r.cid!==m.cid);this.reqs.push({cid:m.cid});m.conn.send({t:'note',m:'방장이 자리를 확인하고 있어요. 잠시만 기다려 주세요',wait:1});this.nextReq()},
  nextReq(){if(this.reqUI||!this.reqs.length)return;const r=this.reqs[0],m=this.members.get(r.cid);
    if(!m||!m.online){this.reqs.shift();return this.nextReq()}
    const seats=this.freeSeats(m.cid),mates=this.mateSeats();if(!seats.length&&!mates.length){this.reqs.shift();m.conn.send({t:'note',m:'빈 자리가 없어서 구경하는 사람으로 들어왔어요'});return this.nextReq()}
    const same=p=>p.prev===m.cid||(p.name===m.name&&(p.ai?!!p.prev:!!p.net&&!this.isOnline(p.net)));
    const back=seats.some(same);
    const lab=p=>same(p)?`↩️ 원래 자리(${p.name})를 돌려주기`:p.ai?`🤖 컴퓨터 ${p.name} 자리를 이 사람에게 넘기기`:`📴 연결이 끊긴 ${p.name} 자리를 이 사람에게 넘기기`;
    seats.sort((a,b)=>same(b)-same(a));
    this.reqUI={cid:m.cid};
    this.decide({kick:`📶 참가 요청 · 방 ${this.code}`,title:back?`"${m.name}"님이 다시 들어왔어요`:'새로운 플레이어가 참가하려고 합니다',tone:'var(--mint)',
      who:{name:m.name,emoji:m.emoji,color:m.color},
      text:`${back?'컴퓨터가 이어서 하던 원래 자리를 돌려줄까요? ':seats.some(p=>p.ai)?'지금 컴퓨터 플레이어를 이 플레이어로 교체할까요? ':''}자리를 넘겨도 위치·달란트·땅·건물·카드는 그대로 이어져요.`,
      opts:[...seats.map(p=>({v:'seat:'+p.id,label:lab(p),main:same(p),col:p.col})),...mates.map(p=>({v:'mate:'+p.id,label:`👥 ${p.name} 팀의 팀원으로 넣기`,col:p.col})),{v:'no',label:'취소 (구경만 하게 하기)'}]},
      v=>{this.reqUI=null;this.reqs=this.reqs.filter(x=>x.cid!==m.cid);
        if(v&&v.startsWith('seat:'))this.takeSeat(m,+v.slice(5));else if(v&&v.startsWith('mate:'))this.takeMate(m,+v.slice(5));else m.conn&&m.conn.send({t:'note',m:'진행자가 구경하는 사람으로 들어오게 했어요',spect:1});this.nextReq()},
      ()=>!this.members.get(m.cid)||!this.members.get(m.cid).online)},
  /* ---------- 진행자 결정 창: 중계 모드에서 리모컨이 연결되어 있으면 리모컨에, 아니면 이 기기에 띄웁니다 ---------- */
  decs:{},decSeq:0,
  remotes(){return [...this.members.values()].filter(m=>m.kind==='remote'&&m.online&&m.conn)},
  decide(d,cb,stale){const id='d'+(++this.decSeq);d.id=id;this.decs[id]={d,cb,stale};
    const rs=this.mode==='relay'?this.remotes():[];
    if(rs.length){d.on='remote';rs.forEach(r=>r.conn.send({t:'ask',d}))}else this.showDecision(d)},
  finishDecision(id,v){const x=this.decs[id];if(!x)return;delete this.decs[id];closeLayer('edit');
    this.remotes().forEach(r=>r.conn.send({t:'askdone',id}));if(x.stale&&x.stale())return x.cb(null);x.cb(v)},
  showDecision(d){d.on='host';const L=openLayer('edit',decisionHTML(d),{tone:d.tone});
    $$('[data-dv]',L.box).forEach(b=>b.onclick=()=>this.finishDecision(d.id,b.dataset.dv))},
  /* 리모컨이 끊기면 리모컨에 띄웠던 결정 창을 이 기기에 다시 띄웁니다 */
  remoteGone(){if(this.remotes().length)return;for(const x of Object.values(this.decs))if(x.d.on==='remote')this.showDecision(x.d)},
  closeReq(){if(!this.reqUI)return;const cid=this.reqUI.cid;for(const [id,x] of Object.entries(this.decs))if(x.d.who&&x.d.title&&x.d.kick.startsWith('📶')){delete this.decs[id];closeLayer('edit');this.remotes().forEach(r=>r.conn.send({t:'askdone',id}))}this.reqUI=null;this.reqs=this.reqs.filter(r=>r.cid!==cid)},
  takeSeat(m,id){const p=byId(id);if(!p||!m.online)return;
    const usedC=G.players.filter(x=>x!==p).map(x=>x.col);
    Object.assign(p,{net:m.cid,ai:false,host:false,op:false,prev:null,name:m.name,tok:m.emoji,col:usedC.includes(m.color)?p.col:m.color});
    log(`${p.name}님이 ${p.id+1}번 자리를 이어받았어요`,p);m.conn.send({t:'welcome',cid:m.cid,key:this.keys[m.cid],code:this.code,mode:this.mode,kind:'player',seat:p.id});
    UI.toast(`🙂 ${p.name}님이 자리를 이어받았어요`);UI.render();persist();redispatch()},
  takeMate(m,id){const p=byId(id);if(!p||!m.online||p.ai||!p.net)return;p.mates=(p.mates||[]).filter(x=>x.cid!==m.cid);p.mates.push({cid:m.cid,name:m.name});
    log(`👥 ${m.name}님이 ${p.name} 팀의 팀원이 됐어요`,p);m.conn.send({t:'welcome',cid:m.cid,key:this.keys[m.cid],code:this.code,mode:this.mode,kind:'player',seat:p.id});
    UI.toast(`👥 ${m.name}님이 ${p.name} 팀에 들어왔어요`);UI.render();persist();redispatch()},
  /* 플레이어가 나간 채로 오래 돌아오지 않으면 방장에게 컴퓨터로 대체할지 묻습니다 */
  watch(){if(this.role!=='host'||!G||G.over||$('#eov'))return;const now=Date.now();
    for(const p of G.players){if(!p.net||p.out||p.ai)continue;const m=this.members.get(p.net);
      if(!m){this.members.set(p.net,{cid:p.net,kind:'player',name:p.name,online:false,offSince:now,asked:0});continue}
      if(m.online||(p.mates||[]).some(x=>this.isOnline(x.cid)))continue;if(!m.offSince)m.offSince=now;if(m.asked===-1||(m.asked&&now<m.asked))continue;
      if(now-m.offSince<OFFLINE_ASK_MS())continue;
      return this.askReplace(p,m)}},
  askReplace(p,m){m.asked=Date.now()+600000;
    this.decide({kick:'📴 연결 끊김',title:`플레이어 "${p.name}"가 게임에서 나갔습니다`,tone:'#ff9d9d',
      text:'계속 진행하려면 컴퓨터 플레이어로 대체할까요? 위치·달란트·땅·건물·카드는 그대로 이어지고, 나중에 다시 들어오면 자리를 돌려줄 수 있어요.',
      opts:[{v:'easy',label:'🤖 컴퓨터(쉬움)로 대체'},{v:'normal',label:'🤖 컴퓨터(보통)로 대체',main:true},{v:'hard',label:'🤖 컴퓨터(어려움)로 대체'},{v:'wait',label:'기다리기 (1분 뒤 다시 묻기)'},{v:'never',label:'취소 (다시 묻지 않기)'}]},
      v=>{if(!v)return;if(v==='wait')m.asked=Date.now()+60000;else if(v==='never')m.asked=-1;else if(['easy','normal','hard'].includes(v))this.toAI(p,v)},
      ()=>!G||!p.net||this.isOnline(p.net))},
  toAI(p,lv){if(!p||p.ai)return;const m=this.members.get(p.net);
    /* 접속 중인 사람을 진행자가 바꾼 경우 그 사람 기기에 알려 줍니다 */
    if(m&&m.online&&m.conn){m.conn.send({t:'welcome',cid:m.cid,key:this.keys[m.cid],code:this.code,mode:this.mode,kind:'player',seat:null});m.conn.send({t:'kicked',name:p.name})}
    for(const x of p.mates||[]){const mm=this.members.get(x.cid);if(mm&&mm.online&&mm.conn){mm.conn.send({t:'welcome',cid:mm.cid,key:this.keys[mm.cid],code:this.code,mode:this.mode,kind:'player',seat:null});mm.conn.send({t:'kicked',name:p.name})}}
    p.mates=[];p.prev=p.net;p.net=null;p.ai=true;p.aiLv=lv;
    log(`${p.name} 자리를 컴퓨터(${LV_KO[lv]})가 이어서 해요`,p);UI.toast(`🤖 ${p.name} 자리를 컴퓨터가 이어서 해요`);UI.render();persist();redispatch()},

  /* ---------- 참가자 ---------- */
  async join(code,profile,kind,opt={}){
    this.leave(true);this.role='client';this.kind=kind||'player';this.code=code;this.cid=myDeviceId();this.profileData=profile;this.G=null;this.mySeat=null;this.pin=opt.pin||null;this.pw=opt.pw||null;this.localLink=!!opt.local;
    const s=this.savedSession();this.key=s&&s.role==='client'&&s.code===code&&s.cid===this.cid?s.key:null;
    if(s&&s.role==='client'&&s.code===code&&s.cid&&s.cid!==this.cid&&s.cid.startsWith(this.cid))this.cid=s.cid;
    if(this.kind==='player')store.set('net.profile',profile);
    await this.connect(true)},
  async connect(first){
    try{for(const l of this.links)try{l.close()}catch(e){}const r=await transport(this.localLink).join(this.code);this.links=[r];this.conn=r.conn;if(r.vid)this.cid=r.vid}
    catch(e){if(first){this.role=null;throw e}throw e}
    this.conn._d=msg=>this.onMsg(msg);
    this.conn._c=()=>{if(this.role==='client')this.lost()};
    const hi=()=>this.conn&&this.conn.send({t:'hello',cid:this.cid,key:this.key,kind:this.kind,pin:this.pin,pw:this.pw,...this.profileData});
    this.conn._re=hi;hi();
    this.saveSession();
    clearInterval(this.pingT);this.pingT=setInterval(()=>this.conn&&this.conn.send({t:'ping',at:Date.now()}),8000);
    $('#netbar')?.remove()},
  saveSession(){if(this.role!=='client'||this.kind==='display')return;store.set('net.session',{role:'client',code:this.code,cid:this.cid,key:this.key,kind:this.kind,pin:this.kind==='remote'?this.pin:null,pw:this.pw||null,t:Date.now()})},
  lost(msg){if(this.role!=='client')return;this.conn=null;
    let b=$('#netbar');if(!b){b=document.createElement('div');b.id='netbar';b.className='netbar';document.body.appendChild(b)}
    if(msg)this.pauseMsg=msg;b.textContent=this.pauseMsg||'📴 방장과 연결이 끊겼어요 · 다시 연결하는 중…';
    clearTimeout(this.retryT);this.retryT=setTimeout(()=>this.connect(false).catch(()=>this.lost(msg)),3000)},
  onMsg(msg){if(!msg||typeof msg!=='object')return;
    switch(msg.t){
      case 'ph':{let n=0;for(const [id,d] of Object.entries(msg.P||{}))if(savePhoto(id,d))n++;if(n){if(this.G)UI.render();else if(this.lastLobby)NetUI.lobby()}break}
      case 'welcome':this.sendMyPhoto();this.pauseMsg=null;this.mySeat=msg.seat;this.mode=msg.mode||this.mode;if(msg.cid)this.cid=msg.cid;if(msg.key)this.key=msg.key;this.saveSession();
        $('#waitNote')?.remove();if(this.G){UI.enterGame()}break;
      case 'deny':{const why=msg.why,code=this.code;this.leave();App.home();UI.toast(why==='pin'?'진행자 PIN이 맞지 않아요':why==='pw'?'비밀번호가 맞지 않아요':'이 방은 중계 모드가 아니라서 리모컨으로 들어갈 수 없어요',4000);if(why==='pw')NetUI.quick(code,'',{pub:false});break}
      case 'note':UI.toast(msg.m,3500);if(msg.wait)this.waitNote(msg.m);else $('#waitNote')?.remove();if(msg.spect)this.spectNote();break;
      case 'kicked':this.kickedNote(msg.name);break;
      case 'ask':if(this.kind==='remote')this.showAsk(msg.d);break;
      case 'askdone':if(this.askId===msg.id){closeLayer('edit');this.askId=null}break;
      case 'lobby':this.lastLobby=msg;this.mode=msg.mode||this.mode;if(!this.G)NetUI.lobby();break;
      case 'st':this.GS=msg.S;break;
      case 's':{if(!this.GS||this.GS.sid!==msg.G.started)break;const first=!this.G||!document.body.classList.contains('ingame');this.G=Object.assign({},this.GS,msg.G);this.online=msg.online||{};this.mode=(msg.G.room&&msg.G.room.mode)||this.mode;
        if(first){closeLayer('info');UI.enterGame();if(this.curPrompt)UI.showPrompt(this.curPrompt)}else UI.render();break}
      case 'p':this.curPrompt=msg.p;this.curSecret=msg.secret||null;if(msg.p&&this.curSecret)msg.p.secret=this.curSecret;if(!this.G)break;if(msg.p)UI.showPrompt(msg.p);else UI.clearPrompt();break;
      case 'e':this.onEvent(msg.e);break;
      case 'pong':if(msg.at)this.rtt=Date.now()-msg.at;this.lastPong=Date.now();break;
      case 'bye':if(msg.pause){this.lost('⏸️ 방장이 잠시 나갔어요 · 방이 다시 열리면 자동으로 들어가요');break}
        this.leave();App.home();UI.toast('방장이 방을 닫았어요');break}},
  /* 진행자가 내 자리를 컴퓨터로 바꿨을 때 */
  kickedNote(name){const L=openLayer('edit',`<div class="bigpic">🤖</div><h3>진행자가 내 자리(${esc(name)})를 컴퓨터로 바꿨어요</h3>
      <div class="mbody"><p>지금은 구경하는 사람으로 게임을 볼 수 있어요. 다시 하고 싶으면 참가 요청을 보내 주세요. 진행자가 확인하면 원래 자리로 돌아가요.</p></div>
      <div class="mbtns"><button class="btn main wide" data-rq>🙋 다시 참가 요청</button><button class="btn wide" data-c>구경하기</button></div>`,{tone:'#ffcf8a'});
    $('[data-rq]',L.box).onclick=()=>{L.close();this.reqSeat()};$('[data-c]',L.box).onclick=L.close;if(this.G)UI.enterGame()},
  spectNote(){},
  reqSeat(){if(this.conn){this.conn.send({t:'reqseat'});UI.toast('🙋 참가 요청을 보냈어요. 진행자가 확인하면 자리에 앉아요',3500)}},
  /* 리모컨: 진행자 결정 창 */
  showAsk(d){this.askId=d.id;const L=openLayer('edit',decisionHTML(d),{tone:d.tone});
    $$('[data-dv]',L.box).forEach(b=>b.onclick=()=>{$$('[data-dv]',L.box).forEach(x=>x.disabled=true);this.cmd({c:'ans',id:d.id,v:b.dataset.dv})})},
  waitNote(m){if($('#waitNote'))return;const d=document.createElement('div');d.id='waitNote';d.className='netbar wait';d.textContent='⏳ '+m;document.body.appendChild(d)},
  onEvent(e){switch(e.t){
    case 'toast':UI.toast(e.m);break;case 'sfx':UI.sfx(e.k);break;case 'float':UI.float(e.id,e.d);break;case 'burst':UI.burst(e.i,e.label,e.color);break;
    case 'msg':UI.setMsg(e.h);break;case 'pay':UI.payFx(e.a,e.b,e.v);break;case 'dice':UI.rollDice(e.a,e.b,e.anim);break;case 'qres':UI.showQuizResult(e.quiz);break;
    case 'pos':if(this.G){const p=this.G.players.find(x=>x.id===e.id);if(p){p.pos=e.pos;UI.moveToken(e.id)}}break}},
  input(id,v){if(this.conn)this.conn.send({t:'in',id,v});else UI.toast('방장과 연결이 끊겨서 보내지 못했어요')},
  sendProfile(p){this.profileData=p;store.set('net.profile',p);this.sendMyPhoto();this.conn&&this.conn.send({t:'profile',...p})},

  /* ---------- 공통 ---------- */
  /* pause: 게임 중인 방장이 잠시 나갈 때. 방 정보와 자리 주인을 그대로 두고, 이어하기로 같은 방 코드를 다시 엽니다 */
  leave(silent,pause){clearTimeout(this.retryT);clearInterval(this.pingT);clearInterval(this.watchT);$('#netbar')?.remove();$('#waitNote')?.remove();
    if(this.role==='host'){this.broadcast(pause?{t:'bye',pause:true}:{t:'bye'});if(this.reqUI)this.closeReq()}
    if(this.role==='client'&&this.conn)this.conn.close();
    for(const l of this.links)try{l.close(this.role==='host'&&!pause)}catch(e){}
    if(this.role&&!silent&&!pause){store.del('net.session');if(this.role==='host')store.del('net.keys')}
    if(this.role==='host'&&pause){const ss=store.get('net.session',null);if(ss)store.set('net.session',{...ss,paused:true,t:Date.now()})}
    if(this.role==='host'&&!G&&!pause)SETUP.players.forEach(p=>{if(p.net){p.net=null;p.ai=true}});
    this.role=null;this.kind=null;this.mode=null;this.code=null;this.links=[];this.conn=null;this.members=new Map();this.reqs=[];this.G=null;this.curPrompt=null;this.mySeat=null;this.lastPrompt=null;
    document.body.classList.remove('dash','display','remote');UI.updateHeader&&UI.updateHeader()},
  /* 새로고침·앱 종료 뒤 다시 들어가기 */
  async rejoin(){const s=this.savedSession();if(!s)return;
    if(s.role==='client'){const prof=store.get('net.profile',{name:'참가자',emoji:'😀',color:PALETTE[0]});
      try{UI.toast('방에 다시 들어가는 중…');await this.join(s.code,s.kind==='remote'?{name:'진행자',emoji:'🎛️',color:PALETTE[9]}:prof,s.kind||'player',{pin:s.pin,pw:s.pw});if(this.kind==='player')NetUI.lobby()}
      catch(e){UI.toast('방을 찾지 못했어요. 방장이 방을 다시 열면 "방 다시 들어가기"를 눌러 주세요',4500);Home.show()}}
    else{const save=hasSave(),restore=save&&save.net&&save.net.code===s.code?save.net:null;
      try{UI.toast('방을 다시 여는 중… (최대 30초)');await this.host(s.mode||(restore&&restore.mode)||'player',s.code,restore);if(save&&save.G.room)resumeGame(save);else Setup.open('people')}
      catch(e){UI.toast('방을 다시 열지 못했어요. 잠시 뒤 이어하기를 다시 눌러 주세요',4500);Home.show()}}}
};
/* 진행자 결정 창 모양 (방장 기기·리모컨 공용) */
function decisionHTML(d){return `<div class="kick">${esc(d.kick||'')}</div><h3>${esc(d.title||'')}</h3><div class="mbody">
    ${d.who?`<div class="pedit" style="--pc:${d.who.color};grid-template-columns:auto 1fr"><span class="tok" style="--pc:${d.who.color}">${tokIn(d.who.emoji)}</span><b class="cute" style="font-size:1.4rem">${esc(d.who.name)}</b></div>`:''}
    <p>${esc(d.text||'')}</p></div><div class="mbtns">${d.opts.map(o=>`<button class="btn wide ${o.main?'main':''}" ${o.col?`style="box-shadow:inset 0 0 0 3px ${o.col},0 3px 0 var(--line)"`:''} data-dv="${esc(o.v)}">${esc(o.label)}</button>`).join('')}</div>`}
/* 컴퓨터 난이도 고르기 */
function pickAiLevel(cur,done){const L=openLayer('edit',`<div class="kick">🤖 컴퓨터로 대체</div><h3>컴퓨터 난이도를 골라 주세요</h3>
    <div class="mbody"><p>난이도에 따라 퀴즈 정답률이 달라져요.</p></div>
    <div class="mbtns">${['easy','normal','hard'].map(v=>`<button class="btn wide ${v===cur?'main':''}" data-lv="${v}">${LV_KO[v]}</button>`).join('')}<button class="btn wide" data-c>취소</button></div>`,{tone:'var(--sky-2)'});
  $$('[data-lv]',L.box).forEach(b=>b.onclick=()=>{L.close();done(b.dataset.lv)});$('[data-c]',L.box).onclick=()=>{L.close();done(null)}}

/* ---------- 함께하기 화면 ---------- */
const MODE_KO={player:'플레이어 모드',relay:'중계 모드'};
const NetUI={
  /* 함께하기: Firebase로 연결할 때는 방 목록(대기실)을 먼저 보여 줍니다 */
  open(prefill,pw){
    if(prefill)return this.quick(prefill,pw);
    if(!FB.configured())return this.menu();
    const L=openLayer('info',`<div class="kick">👥 함께하기</div><h3>방 목록</h3>
      <div class="tbar"><button class="btn main" data-host>👑 방 만들기</button><button class="btn" data-code>🔢 방 코드로 참가</button><button class="btn" data-more>📺 게임 화면·리모컨</button></div>
      <div class="rooms" id="rooms"><p class="muted">방 목록을 불러오는 중…</p></div>
      <p class="ref">방장이 방을 만들면 여기에 나타나요. 🔒 방은 비밀번호가 있어야 들어갈 수 있어요.</p>`,{close:true,tone:'var(--mint)',wide:true,onClose:()=>{off&&off();off=null}});
    let off=null;
    $('[data-host]',L.box).onclick=()=>{L.close();this.createRoom()};
    $('[data-code]',L.box).onclick=()=>{L.close();this.joinForm()};
    $('[data-more]',L.box).onclick=()=>{L.close();this.joinForm('','display')};
    const draw=all=>{const box=$('#rooms',L.box);if(!box)return;const now=Date.now();
      const list=Object.entries(all).filter(([c,r])=>r&&r.v===1&&(!r.t||now-r.t<12*3600e3)).sort((a,b)=>(a[1].started-b[1].started)||(b[1].t||0)-(a[1].t||0));
      box.innerHTML=list.length?list.map(([c,r])=>`<button class="room ${r.started?'busy':''}" data-room="${esc(c)}"><span class="rt">${r.pub?'':'🔒 '}${esc(r.title||r.host+'의 방')}</span>
          <span class="rh">👑 ${esc(r.host||'')} · ${MODE_KO[r.mode]||''}</span>
          <span class="rb"><b>👥 ${r.n}/${r.max}</b><i>${r.pub?'공개':'비공개'}</i><i>${esc(r.board||'')}</i><i>${LV_KO[r.diff]||'섞어서'}</i><i>${r.rounds?r.rounds+'라운드':'파산까지'}</i><i class="${r.started?'on':'wait'}">${r.started?'게임 중':'모집 중'}</i></span></button>`).join('')
        :'<p class="muted">지금 열린 방이 없어요. 👑 방 만들기를 눌러 첫 방을 만들어 보세요.</p>';
      $$('[data-room]',box).forEach(b=>b.onclick=()=>{const c=b.dataset.room,r=all[c];L.close();this.quick(c,'',r)})};
    FB.watchLobby(draw).then(f=>{if(L.ov.isConnected)off=f;else f()}).catch(e=>{const box=$('#rooms',L.box);if(box)box.innerHTML='<p class="muted">방 목록을 불러오지 못했어요. 방 코드로 참가할 수 있어요.</p>'})},
  /* Firebase 설정이 없을 때의 예전 메뉴 */
  menu(){
    const L=openLayer('info',`<div class="kick">👥 함께하기</div><h3>여러 기기로 함께 해요</h3>
      <div class="mbody"><p>방을 만든 기기가 게임을 진행하고, 다른 사람은 각자 휴대폰으로 방 코드를 넣어 참가해요. 각자 <b>자기 자리만</b> 조작할 수 있어요.</p></div>
      <div class="mbtns row"><button class="btn main" data-host>👑 방 만들기</button><button class="btn mint" data-join>📱 방 참가하기 <small>방 코드 입력</small></button></div>`,{close:true,tone:'var(--mint)',wide:true});
    $('[data-host]',L.box).onclick=()=>{L.close();this.createRoom()};
    $('[data-join]',L.box).onclick=()=>{L.close();this.joinForm()}},
  /* 방 만들기: 가장 먼저 방장이 플레이어로 참여할지, 진행자(중계 모드)로 진행할지 고릅니다 */
  createRoom(){
    const L=openLayer('info',`<div class="kick">👑 방 만들기</div><h3>게임 진행 방식을 골라 주세요</h3>
      <div class="modepick">
        <button class="mode" data-mode="player"><span class="e">🙂</span><b>플레이어 모드</b><small>방장도 <b>플레이어 한 명</b>으로 참가해요. 진행자 없이 모두 같은 규칙으로 하고, 주관식은 직접 입력하면 게임이 채점해요. 방장도 다른 사람의 행동은 대신할 수 없어요.</small><em>소규모 · 각자 휴대폰</em></button>
        <button class="mode" data-mode="relay"><span class="e">🎤</span><b>중계 모드</b><small>방장은 <b>진행자·심판</b>이 되어 TV에 게임 화면을 띄우고 판정해요. 참가자는 휴대폰으로 자기 상황판을 보며 자기 차례를 조작해요. PC는 게임 화면 창을 따로 띄울 수 있어요.</small><em>교회·교육 프로그램 · TV</em></button>
      </div>`,{close:true,tone:'var(--accent)',wide:true});
    $$('[data-mode]',L.box).forEach(b=>b.onclick=()=>{L.close();this.roomForm(b.dataset.mode)})},
  /* 방 이름 · 공개/비공개 · 비밀번호 */
  roomForm(mode){const prof=store.get('net.profile',null),me=SETUP.players.find(p=>p.host);
    const def=mode==='relay'?'성경 부루마블 중계':`${(me&&me.name)||(prof&&prof.name)||'우리'}의 방`;
    let pub=true,auto=true;const autoPw=String(1000+Math.random()*9000|0);
    const html=()=>`<div class="kick">👑 ${MODE_KO[mode]} · 방 만들기</div><h3>방 정보를 정해 주세요</h3><div class="mbody">
      <label class="cute">방 이름<input class="inp" id="rtitle" maxlength="20" value="${esc(this._title||def)}"></label>
      <div class="seg" id="rpub"><button type="button" data-v="1" class="${pub?'on':''}">🔓 공개 방</button><button type="button" data-v="0" class="${pub?'':'on'}">🔒 비공개 방</button></div>
      ${pub?'<p class="ref">방 목록에 보이고 누구나 들어올 수 있어요.</p>':`<div class="seg" id="rauto"><button type="button" data-v="1" class="${auto?'on':''}">자동 비밀번호</button><button type="button" data-v="0" class="${auto?'':'on'}">직접 정하기</button></div>
        ${auto?`<p class="ref">비밀번호: <b class="roomcode">${autoPw}</b> · 방 공유 링크에는 비밀번호가 들어 있어서 링크로 오면 바로 들어와요.</p>`:`<label class="cute">비밀번호 (4~12자)<input class="inp" id="rpw" maxlength="12" value="${esc(this._pw||'')}" autocomplete="off"></label>`}`}</div>
      <div class="mbtns"><button class="btn main wide" data-go>${mode==='player'?'다음: 내 캐릭터 정하기':'방 만들기'}</button></div>`;
    const L=openLayer('info',html(),{close:true,tone:'var(--accent)'});
    const keep=()=>{this._title=$('#rtitle',L.box).value;const pw=$('#rpw',L.box);if(pw)this._pw=pw.value};
    const redraw=()=>{keep();const box=$('.mbox',L.ov);box.innerHTML='<button class="xclose" data-x aria-label="닫기">×</button>'+html();$('[data-x]',box).onclick=L.close;bind()};
    const bind=()=>{$('#rpub',L.box).onclick=e=>{const b=e.target.closest('button');if(!b)return;pub=b.dataset.v==='1';redraw()};
      const ra=$('#rauto',L.box);if(ra)ra.onclick=e=>{const b=e.target.closest('button');if(!b)return;auto=b.dataset.v==='1';redraw()};
      $('[data-go]',L.box).onclick=()=>{keep();const title=(this._title||'').trim()||def;let pw='';
        if(!pub){pw=auto?autoPw:(this._pw||'').trim();if(!auto&&(pw.length<4||pw.length>12))return UI.toast('비밀번호는 4~12자로 정해 주세요')}
        const room={title,pub:!pw,pw};this._title='';this._pw='';L.close();mode==='player'?this.hostAsPlayer(room):this.openRoom('relay',room)}};
    bind()},
  hostAsPlayer(room){const P=SETUP.players,me=P.find(p=>p.host)||P.find(p=>!p.ai&&!p.net)||P[0];
    const prof=store.get('net.profile',null);
    if(!me.host&&prof){me.name=prof.name||me.name;if(prof.emoji)me.emoji=prof.emoji;if(prof.color&&!P.some(x=>x!==me&&x.color===prof.color))me.color=prof.color}
    const L=openLayer('info',`<div class="kick">🙂 플레이어 모드 · 방장</div><h3>내 캐릭터를 정해 주세요</h3><div class="mbody">
      <label class="cute">내 이름<input class="inp" id="hname" maxlength="10" value="${esc(me.name||'')}" placeholder="예: 베드로"></label>
      <div class="pedit" style="--pc:${me.color};grid-template-columns:auto 1fr"><span class="tok" style="--pc:${me.color}">${tokIn(me.emoji)}</span><button class="btn sm" data-look>🎨 동물·사진·색깔 고르기</button></div></div>
      <div class="mbtns"><button class="btn main wide" data-go>방 만들기</button></div>`,{close:true,tone:me.color});
    $('[data-look]',L.box).onclick=()=>{me.name=$('#hname',L.box).value;pickLook(me,P.filter(x=>x!==me),()=>this.hostAsPlayer(room))};
    $('[data-go]',L.box).onclick=()=>{const n=$('#hname',L.box).value.trim();if(!n)return UI.toast('이름을 적어 주세요');me.name=n;
      store.set('net.profile',{name:n,emoji:me.emoji,color:me.color});
      P.forEach(p=>{p.host=p===me;if(p===me){p.ai=false;p.net=null;p.op=false}});
      const k=P.indexOf(me);if(k>0){P.splice(k,1);P.unshift(me)}L.close();this.openRoom('player',room)}},
  async openRoom(mode,room){const P=SETUP.players;
    /* 방장 기기에서 조작하는 자리는 플레이어 모드의 방장 자리와 중계 모드의 진행자 조작 자리뿐입니다 */
    P.forEach(p=>{p.net=null;if(mode==='relay')p.host=false;if(!p.host&&!p.op&&!p.ai)p.ai=true;if(mode==='player')p.op=false;if(!p.pid)p.pid=uid('p')});saveSetup();
    try{UI.toast('방을 만드는 중…');await Net.host(mode,null,null,room||{title:'',pub:true,pw:''});Setup.open('people')}catch(e){netError(e)}},
  /* 공유 링크로 들어왔을 때: 이름만 적으면 바로 참가합니다 (캐릭터는 대기실에서 바꿀 수 있어요) */
  quick(code,pw,info){const prof=store.get('net.profile',null)||{name:'',emoji:TOKENS[6+(Math.random()*30|0)],color:PALETTE[Math.random()*PALETTE.length|0]};
    const needPw=info&&info.pub===false&&!pw;
    const L=openLayer('info',`<div class="kick">📱 방 ${esc(code)}${info&&info.title?` · ${esc(info.title)}`:''}</div><h3>${needPw?'비밀번호와 이름을 적어 주세요':'이름만 적으면 바로 들어가요'}</h3><div class="mbody">
      ${info&&info.started?'<p class="ref">이미 게임 중인 방이에요. 들어가면 방장이 비어 있는 자리(컴퓨터 자리)를 넘겨줄지 정해요.</p>':''}
      ${needPw?`<label class="cute">🔒 비밀번호<input class="inp" id="qpw" maxlength="12" autocomplete="off" style="font-size:1.4rem"></label>`:''}
      <label class="cute">내 이름<input class="inp" id="qname" maxlength="10" value="${esc(prof.name||'')}" placeholder="예: 민수" style="font-size:1.6rem;min-height:3.6rem" enterkeyhint="go"></label>
      <p class="ref">동물·색깔은 들어간 뒤 대기실에서 바꿀 수 있어요. 다른 브라우저로 다시 들어와도 같은 이름이면 원래 자리로 돌아가요.</p></div>
      <div class="mbtns"><button class="btn main wide big" data-go>🙂 참가하기</button><button class="linkbtn" data-more>게임 화면(TV)·진행자 리모컨으로 연결하기</button></div>`,{close:true,tone:'var(--mint)'});
    const go=async()=>{const name=$('#qname',L.box).value.trim();if(!name)return UI.toast('이름을 적어 주세요');const p2=needPw?$('#qpw',L.box).value.trim():pw;if(needPw&&!p2)return UI.toast('비밀번호를 적어 주세요');
      prof.name=name;store.set('net.profile',prof);const b=$('[data-go]',L.box);b.disabled=true;b.textContent='들어가는 중…';
      try{await Net.join(code,{name,emoji:prof.emoji,color:prof.color},'player',{pw:p2||null});L.close();this.lobby()}catch(e){b.disabled=false;b.textContent='🙂 참가하기';netError(e)}};
    $('[data-go]',L.box).onclick=go;$('#qname',L.box).onkeydown=e=>{if(e.key==='Enter')go()};
    $('[data-more]',L.box).onclick=()=>{L.close();this.joinForm(code,'display')};
    setTimeout(()=>$(needPw?'#qpw':'#qname',L.box).focus(),80)},
  joinForm(prefill,kind){const prof=store.get('net.profile',{name:'',emoji:TOKENS[6],color:PALETTE[1]});kind=kind||'player';
    const draw=()=>`<div class="kick">📱 방 참가하기</div><h3>${kind==='display'?'게임 화면(TV)으로 연결':kind==='remote'?'진행자 리모컨으로 연결':'방 코드와 내 캐릭터'}</h3><div class="mbody">
      <div class="seg" id="jkind"><button type="button" data-v="player" class="${kind==='player'?'on':''}">🙂 플레이어</button><button type="button" data-v="display" class="${kind==='display'?'on':''}">📺 게임 화면</button><button type="button" data-v="remote" class="${kind==='remote'?'on':''}">🎛️ 진행자 리모컨</button></div>
      <label class="cute">방 코드 (6자리)<input class="inp" id="jcode" maxlength="8" style="font-size:2rem;letter-spacing:.2em;text-transform:uppercase;text-align:center" value="${esc(prefill||'')}" placeholder="ABC123" autocomplete="off"></label>
      ${kind==='player'?`<label class="cute">내 이름<input class="inp" id="jname" maxlength="10" value="${esc(prof.name)}" placeholder="예: 민수"></label>
      <div class="pedit" style="--pc:${prof.color};grid-template-columns:auto 1fr"><span class="tok" style="--pc:${prof.color}">${tokIn(prof.emoji)}</span><button class="btn sm" data-look>🎨 동물·사진·색깔 고르기</button></div>`:''}
      ${kind!=='remote'?'<label class="cute">🔒 비밀번호 (비공개 방만)<input class="inp" id="jpw" maxlength="12" autocomplete="off"></label>':''}
      ${kind==='display'?'<p class="ref">TV·프로젝터에 연결한 기기에서 고르세요. 모두가 보는 게임판과 문제만 나오고, 정답은 결과가 나올 때까지 나오지 않아요.</p>':''}
      ${kind==='remote'?`<label class="cute">진행자 PIN (4자리)<input class="inp" id="jpin" inputmode="numeric" maxlength="4" style="font-size:1.8rem;letter-spacing:.3em;text-align:center" placeholder="0000"></label><p class="ref">중계 모드의 진행자 기기 설정 → 멀티플레이에 PIN이 있어요. 리모컨에서는 주관식 정답을 보고 판정할 수 있어요. 리모컨은 꼭 쓰지 않아도 돼요.</p>`:''}</div>
      <div class="mbtns"><button class="btn main wide" data-go>연결하기</button></div>`;
    const L=openLayer('info',draw(),{close:true,tone:'var(--mint)'});
    $('#jkind',L.box).onclick=e=>{const b=e.target.closest('button');if(!b)return;const c=$('#jcode',L.box).value;L.close();this.joinForm(c,b.dataset.v)};
    const lk=$('[data-look]',L.box);if(lk)lk.onclick=()=>{prof.name=$('#jname',L.box).value;const c=$('#jcode',L.box).value;pickLook(prof,[],()=>{store.set('net.profile',prof);this.joinForm(c,kind)})};
    $('[data-go]',L.box).onclick=async()=>{const code=$('#jcode',L.box).value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
      if(code.length<4)return UI.toast('방 코드를 확인해 주세요');
      let profile;
      if(kind==='player'){const name=$('#jname',L.box).value.trim();if(!name)return UI.toast('이름을 적어 주세요');prof.name=name;store.set('net.profile',prof);profile={name,emoji:prof.emoji,color:prof.color}}
      else profile=kind==='display'?{name:'게임 화면',emoji:'📺',color:PALETTE[9]}:{name:'진행자',emoji:'🎛️',color:PALETTE[9]};
      const pin=kind==='remote'?$('#jpin',L.box).value.trim():null;if(kind==='remote'&&!/^\d{4}$/.test(pin))return UI.toast('진행자 PIN 4자리를 적어 주세요');
      const b=$('[data-go]',L.box);b.disabled=true;b.textContent='연결하는 중…';
      const jp=$('#jpw',L.box),pw=jp?jp.value.trim():'';
      try{await Net.join(code,profile,kind,{pin,pw:pw||null});L.close();if(kind==='player')this.lobby();else this.waiting()}catch(e){b.disabled=false;b.textContent='연결하기';netError(e)}};
    setTimeout(()=>$(prefill&&kind==='player'?'#jname':'#jcode',L.box)?.focus(),60)},
  /* 게임 화면·리모컨: 게임이 시작되기를 기다리는 화면 */
  waiting(){if(Net.G)return;const L=openLayer('info',`<div class="kick">${Net.kind==='display'?'📺 게임 화면':'🎛️ 진행자 리모컨'} · 방 ${esc(Net.code)}</div><h3>진행자가 게임을 시작하기를 기다려요</h3>
      <div class="code">${esc(Net.code)}</div><div class="mbtns"><button class="btn" data-leave>연결 끊기</button></div>`,{tone:'var(--mint)'});
    $('[data-leave]',L.box).onclick=()=>{L.close();Net.leave();App.home()}},
  lobby(){if(Net.role!=='client'||Net.G)return;if(Net.kind!=='player')return this.waiting();const lb=Net.lastLobby,me=Net.cid;
    const seats=lb?lb.seats:[];const mine=seats.find(s=>s.net===me);
    const html=`<div class="kick">📱 방 ${esc(Net.code)} · ${lb?`${MODE_KO[lb.mode]||''} · ${esc(lb.board)} 판`:''}</div><h3>${lb&&lb.title?esc(lb.title)+' · ':''}방장이 게임을 시작하기를 기다려요</h3>
      <div class="code">${esc(Net.code)}</div>
      <div class="members">${seats.map((s,k)=>{const inT=s.net===me||(s.mates||[]).some(x=>x.cid===me),canJoin=lb.teams&&!inT&&!s.host&&!s.op&&(s.ai||s.net);
        return `<div class="m" style="box-shadow:inset .35rem 0 0 ${s.color}"><span class="tok" style="--pc:${s.color}">${tokIn(s.emoji)}</span>${esc(s.name)}${inT?' (나)':''}${(s.mates||[]).length?`<small class="mates">👥 ${s.mates.map(x=>esc(x.name)).join('·')}</small>`:''}<span class="st">${s.ai?'🤖 컴퓨터':s.host?'👑 방장':s.op?'🎤 진행자가 조작':s.net?(s.online?'🟢 접속':'⚪ 끊김'):''}</span>${canJoin?`<button class="btn sm" data-team="${k}">${s.ai?'이 자리에 앉기':'이 팀으로'}</button>`:''}</div>`}).join('')||'<div class="m">참가자 목록을 받는 중…</div>'}</div>
      ${lb&&lb.teams?'<p class="ref">👥 팀전: 한 팀에 여러 명이 들어갈 수 있어요. 팀원 휴대폰 어느 것으로든 그 팀 차례를 조작해요.</p>':''}
      ${mine||seats.some(s=>(s.mates||[]).some(x=>x.cid===me))?'':'<p class="ref">빈 자리가 없어서 구경하는 사람으로 들어왔어요.</p>'}
      <div class="mbtns row"><button class="btn" data-look>🎨 내 캐릭터 바꾸기</button><button class="btn" data-share>📤 방 공유하기</button><button class="btn" data-leave>방 나가기</button></div>`;
    const L=openLayer('info',html,{tone:'var(--mint)'});$('[data-share]',L.box).onclick=()=>shareRoom();
    $('[data-leave]',L.box).onclick=()=>{L.close();Net.leave();App.home()};
    $$('[data-team]',L.box).forEach(b=>b.onclick=()=>{b.disabled=true;Net.conn&&Net.conn.send({t:'team',seat:+b.dataset.team})});
    $('[data-look]',L.box).onclick=()=>{const prof={...Net.profileData};pickLook(prof,seats.filter(s=>s.net!==me).map(s=>({color:s.color})),()=>{Net.sendProfile(prof);setTimeout(()=>this.lobby(),200)})}},
  clientMenu(){Setup.openClient()},
  /* PC 중계: 게임 화면 창을 따로 띄웁니다. 크롬·엣지에서 화면 배치 권한을 허용하면 확장 모니터(TV)에 바로 띄웁니다 */
  openDisplay(){if(Net.role!=='host')return;
    const url=`${location.pathname}?display=${Net.code}&local=1`;
    /* 창은 누른 순간 바로 엽니다(팝업 차단 방지). 화면 배치 권한이 있으면 그 뒤에 확장 모니터로 옮깁니다 */
    const w=window.open(url,'bm-display-'+Net.code,'popup,width=1280,height=760');
    if(!w)return openInfo('게임 화면 창','📺 팝업이 막혔어요',`<p>브라우저가 새 창을 막았어요. 주소창 오른쪽의 팝업 차단 아이콘에서 <b>항상 허용</b>을 고른 뒤 다시 눌러 주세요.</p><p>또는 TV에 연결한 다른 기기에서 <b>함께하기 → 방 참가하기 → 📺 게임 화면</b>을 고르고 방 코드 <b>${esc(Net.code)}</b>를 넣어도 돼요.</p>`,'var(--mint)');
    try{if(window.getScreenDetails)window.getScreenDetails().then(sd=>{const ext=sd.screens.find(x=>x!==sd.currentScreen);
      if(ext&&!w.closed){w.moveTo(ext.availLeft,ext.availTop);w.resizeTo(ext.availWidth,ext.availHeight)}}).catch(()=>{})}catch(e){}
    UI.toast('📺 게임 화면 창을 TV(확장 모니터)로 옮긴 뒤, 그 창을 한 번 누르면 전체화면이 돼요',5000)}
};
function netError(e){const m=e&&e.message;
  UI.toast(m==='noroom'?'그 방 코드의 방을 찾지 못했어요. 코드를 확인해 주세요':m==='hostaway'?'방장이 아직 방을 열지 않았어요. 방장이 "이어하기"로 방을 열면 다시 눌러 주세요'
    :m==='timeout'?'연결이 오래 걸려요. 인터넷 연결을 확인해 주세요':m==='nolib'||m==='fbload'?'연결 기능을 불러오지 못했어요. 인터넷 연결을 확인해 주세요'
    :m==='fbauth'?'Firebase 익명 로그인이 꺼져 있어요. Firebase 콘솔 → Authentication → 로그인 방법에서 "익명"을 켜 주세요':m==='taken'?'방 코드가 이미 쓰이고 있어요. 새 방을 만들어 주세요'
    :m==='fbnet'?'연결 서버에 접속하지 못했어요. 인터넷 연결을 확인해 주세요':'연결하지 못했어요. 잠시 뒤 다시 해 주세요',5000)}
