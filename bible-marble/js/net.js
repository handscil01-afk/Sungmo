'use strict';
/* ================= 함께하기(멀티플레이) =================
   방장 기기가 게임 엔진을 돌리는 심판입니다. 참가자 기기는 방장이 보낸 상태를 그대로 그리고, 자기 차례의 선택만 보냅니다.
   방장은 "지금 기다리는 요청서"와 "그 자리의 플레이어"가 맞을 때만 선택을 받아들이고 값도 검사하므로,
   참가자가 달란트·땅·위치 같은 상태를 임의로 바꿀 수 없습니다.
   연결: PeerJS(기기끼리 직접 연결, 처음 연결할 때만 무료 PeerJS 서버 사용). 시험용으로 같은 브라우저 안에서는 BroadcastChannel을 씁니다. */
const NET_PREFIX='biblemarble-v1-';
const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode=()=>Array.from({length:6},()=>CODE_CHARS[Math.random()*CODE_CHARS.length|0]).join('');
function myDeviceId(){let id=store.get('net.cid',null);if(!id){id=uid('d');store.set('net.cid',id)}return id}

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
  join(code){return new Promise((res,rej)=>{const ch=new BroadcastChannel('bm-'+code),me=uid('c');let done=false;
    const w={send:o=>ch.postMessage({to:'host',from:me,d:o}),close:()=>{ch.postMessage({to:'host',from:me,t:'__close'});setTimeout(()=>ch.close(),50)},_d:null,_c:null};
    ch.onmessage=e=>{const m=e.data;if(m.to!==me)return;if(m.t==='__ok'){done=true;res({conn:w,close:()=>w.close()})}else if(m.t==='__close'){w._c&&w._c()}else w._d&&w._d(m.d)};
    addEventListener('pagehide',()=>ch.postMessage({to:'host',from:me,t:'__close'}));
    ch.postMessage({to:'host',from:me,t:'__open'});setTimeout(()=>{if(!done){ch.close();rej(new Error('noroom'))}},2500)})}};
const transport=()=>window.__NET==='bc'?BCTransport:PeerTransport;

const Net={
  role:null,code:null,link:null,members:new Map(),G:null,curPrompt:null,mySeat:null,cid:null,online:{},conn:null,retryT:0,pushT:0,lastLobby:null,
  /* ---------- 엔진·화면이 부르는 함수 (혼자 할 때는 아무 일도 하지 않음) ---------- */
  event(e){if(this.role==='host')this.broadcast({t:'e',e})},
  prompt(spec){if(this.role!=='host')return;this.lastPrompt=spec?this.pubSpec(spec):null;this.broadcast({t:'p',p:this.lastPrompt})},
  pubSpec(spec){const o={};for(const [k,v] of Object.entries(spec))if(k!=='resolve'&&k!=='secret'&&typeof v!=='function')o[k]=v;return clone(o)},
  pushState(){if(this.role!=='host'||!G)return;clearTimeout(this.pushT);this.pushT=setTimeout(()=>this.broadcast({t:'s',G,online:this.onlineMap()}),40)},
  saveInfo(){return this.role==='host'?{code:this.code,seats:[...this.members.values()].map(m=>({cid:m.cid,name:m.name}))}:null},
  savedSession(){const s=store.get('net.session',null);return s&&Date.now()-s.t<6*3600e3?s:null},
  isOnline(cid){return this.role==='host'?!!(this.members.get(cid)||{}).online:!!this.online[cid]},
  onlineMap(){const o={};for(const m of this.members.values())o[m.cid]=!!m.online;return o},
  broadcast(msg){for(const m of this.members.values())if(m.online&&m.conn)m.conn.send(msg)},

  /* ---------- 방장 ---------- */
  async host(code){
    this.leave(true);this.role='host';this.members=new Map();
    let tries=0;for(;;){this.code=code||genCode();
      try{this.link=await transport().host(this.code,c=>this.onConn(c));break}
      catch(e){if(e.message==='taken'&&!code&&tries++<5)continue;if(e.message==='taken'&&code&&tries++<12){await sleepRaw(2500);continue}
        this.role=null;this.code=null;throw e}}
    store.set('net.session',{role:'host',code:this.code,t:Date.now()});UI.updateHeader();return this.code},
  onConn(c){let member=null;
    c._d=msg=>{if(!msg||typeof msg!=='object')return;
      if(msg.t==='hello'){member=this.hello(c,msg);return}
      if(!member)return;member.last=Date.now();
      if(msg.t==='profile')this.profile(member,msg);
      else if(msg.t==='in')this.onInput(member,msg);
      else if(msg.t==='ping')c.send({t:'pong'})};
    c._c=()=>{if(member&&member.conn===c){member.online=false;member.conn=null;UI.toast(`📴 ${member.name}님 연결이 끊겼어요`);this.lobbyChanged();if(G)UI.render()}}},
  hello(c,msg){const cid=String(msg.cid||'').slice(0,40);if(!cid)return null;
    let m=this.members.get(cid);if(!m){m={cid};this.members.set(cid,m)}
    if(m.conn&&m.conn!==c)m.conn.close();
    Object.assign(m,{conn:c,online:true,last:Date.now(),name:String(msg.name||'참가자').slice(0,10),emoji:String(msg.emoji||'😀').slice(0,4),color:PALETTE.includes(msg.color)?msg.color:PALETTE[0]});
    if(G){const p=G.players.find(x=>x.net===cid);c.send({t:'welcome',cid,code:this.code,seat:p?p.id:null});c.send({t:'s',G,online:this.onlineMap()});c.send({t:'p',p:this.lastPrompt||null});UI.toast(`📶 ${m.name}님이 ${p?'다시 들어왔어요':'구경하러 들어왔어요'}`);UI.render()}
    else{this.seat(m);UI.toast(`📶 ${m.name}님이 들어왔어요`);this.lobbyChanged()}
    return m},
  /* 로비: 참가자를 빈 자리(컴퓨터 자리 먼저)에 앉힙니다 */
  seat(m){const P=SETUP.players;let k=P.findIndex(p=>p.net===m.cid);
    if(k<0){k=P.findIndex(p=>!p.net&&p.ai);if(k<0&&P.length<4){P.push({name:'',ai:false,emoji:'',color:'',dice:'screen'});k=P.length-1}}
    if(k<0){m.conn&&m.conn.send({t:'welcome',cid:m.cid,code:this.code,seat:null});return}
    const p=P[k],usedC=P.filter((x,i)=>i!==k).map(x=>x.color);
    Object.assign(p,{net:m.cid,ai:false,name:m.name,emoji:m.emoji,color:usedC.includes(m.color)?PALETTE.find(c=>!usedC.includes(c)):m.color});
    m.conn&&m.conn.send({t:'welcome',cid:m.cid,code:this.code,seat:k});saveSetup()},
  unseat(cid){const m=this.members.get(cid);if(m&&m.conn)m.conn.send({t:'welcome',cid,code:this.code,seat:null})},
  profile(m,msg){if(G)return;m.name=String(msg.name||m.name).slice(0,10);m.emoji=String(msg.emoji||m.emoji).slice(0,4);
    const P=SETUP.players,k=P.findIndex(p=>p.net===m.cid);if(k<0)return;const usedC=P.filter((x,i)=>i!==k).map(x=>x.color);
    P[k].name=m.name;P[k].emoji=m.emoji;if(PALETTE.includes(msg.color)&&!usedC.includes(msg.color))P[k].color=msg.color;saveSetup();this.lobbyChanged()},
  lobbyChanged(){if(this.role!=='host')return;
    const lobby={t:'lobby',code:this.code,seats:SETUP.players.map(p=>({name:p.name,emoji:p.emoji,color:p.color,ai:p.ai,net:p.net||null,online:p.net?this.isOnline(p.net):true})),board:Content.board(SETUP.cfg.board).name};
    this.broadcast(lobby);if(Setup.L&&$('#tabpane')&&Setup.tab==='people'&&!Setup.inGame)Setup.pane()},
  onInput(m,msg){const spec=PROMPT;if(!spec||spec.id!==msg.id)return;
    const p=G.players.find(x=>x.net===m.cid);if(!p||spec.pid!==p.id||!['player','any'].includes(spec.who))return;
    spec.resolve&&spec.resolve(msg.v)},

  /* ---------- 참가자 ---------- */
  async join(code,profile){
    this.leave(true);this.role='client';this.code=code;this.cid=myDeviceId();this.profileData=profile;this.G=null;this.mySeat=null;
    store.set('net.profile',profile);
    await this.connect(true)},
  async connect(first){
    try{const r=await transport().join(this.code);this.link=r;this.conn=r.conn;}
    catch(e){if(first){this.role=null;throw e}throw e}
    this.conn._d=msg=>this.onMsg(msg);
    this.conn._c=()=>{if(this.role==='client')this.lost()};
    this.conn.send({t:'hello',cid:this.cid,...this.profileData});
    store.set('net.session',{role:'client',code:this.code,t:Date.now()});
    clearInterval(this.pingT);this.pingT=setInterval(()=>this.conn&&this.conn.send({t:'ping'}),5000);
    $('#netbar')?.remove()},
  lost(){if(this.role!=='client')return;this.conn=null;
    if(!$('#netbar')){const b=document.createElement('div');b.id='netbar';b.className='netbar';b.textContent='📴 방장과 연결이 끊겼어요 · 다시 연결하는 중…';document.body.appendChild(b)}
    clearTimeout(this.retryT);this.retryT=setTimeout(()=>this.connect(false).catch(()=>this.lost()),3000)},
  onMsg(msg){if(!msg||typeof msg!=='object')return;
    switch(msg.t){
      case 'welcome':this.mySeat=msg.seat;break;
      case 'lobby':this.lastLobby=msg;if(!this.G)NetUI.lobby();break;
      case 's':{const first=!this.G||!document.body.classList.contains('ingame');this.G=msg.G;this.online=msg.online||{};
        if(first){closeLayer('info');UI.enterGame();if(this.curPrompt)UI.showPrompt(this.curPrompt)}else UI.render();break}
      case 'p':this.curPrompt=msg.p;if(!this.G)break;if(msg.p)UI.showPrompt(msg.p);else UI.clearPrompt();break;
      case 'e':this.onEvent(msg.e);break;
      case 'bye':this.leave();App.home();UI.toast('방장이 방을 닫았어요');break}},
  onEvent(e){switch(e.t){
    case 'toast':UI.toast(e.m);break;case 'sfx':UI.sfx(e.k);break;case 'float':UI.float(e.id,e.d);break;case 'burst':UI.burst(e.i,e.label,e.color);break;
    case 'msg':UI.setMsg(e.h);break;case 'dice':UI.rollDice(e.a,e.b,e.anim);break;case 'qres':UI.showQuizResult(e.quiz);break;
    case 'pos':if(this.G){const p=this.G.players.find(x=>x.id===e.id);if(p){p.pos=e.pos;UI.moveToken(e.id)}}break}},
  input(id,v){if(this.conn)this.conn.send({t:'in',id,v});else UI.toast('방장과 연결이 끊겨서 보내지 못했어요')},
  sendProfile(p){this.profileData=p;store.set('net.profile',p);this.conn&&this.conn.send({t:'profile',...p})},

  /* ---------- 공통 ---------- */
  leave(silent){clearTimeout(this.retryT);clearInterval(this.pingT);$('#netbar')?.remove();
    if(this.role==='host'){this.broadcast({t:'bye'});}
    if(this.role==='client'&&this.conn)this.conn.close();
    try{this.link&&this.link.close()}catch(e){}
    if(this.role&&!silent)store.del('net.session');
    if(this.role==='host')SETUP.players.forEach(p=>{if(p.net){p.net=null;p.ai=true}});
    this.role=null;this.code=null;this.link=null;this.conn=null;this.members=new Map();this.G=null;this.curPrompt=null;this.mySeat=null;this.lastPrompt=null;UI.updateHeader&&UI.updateHeader()},
  /* 새로고침 뒤 다시 들어가기 */
  async rejoin(){const s=this.savedSession();if(!s)return;
    if(s.role==='client'){const prof=store.get('net.profile',{name:'참가자',emoji:'😀',color:PALETTE[0]});
      try{UI.toast('방에 다시 들어가는 중…');await this.join(s.code,prof);NetUI.lobby()}catch(e){UI.toast('방을 찾지 못했어요. 방 코드를 다시 확인해 주세요');store.del('net.session');Home.show()}}
    else{try{UI.toast('방을 다시 여는 중… (최대 30초)');await this.host(s.code);const save=hasSave();if(save)resumeGame(save);else Setup.open('people')}
      catch(e){UI.toast('방을 다시 열지 못했어요. 새 방을 만들어 주세요');store.del('net.session');Home.show()}}}
};

/* ---------- 함께하기 화면 ---------- */
const NetUI={
  open(prefill){
    const L=openLayer('info',`<div class="kick">👥 함께하기</div><h3>여러 기기로 함께 해요</h3>
      <div class="mbody"><p>방장 기기(TV나 태블릿)가 게임판을 보여 주고, 다른 사람은 각자 휴대폰으로 참가해서 <b>자기 차례에 직접</b> 주사위를 굴리고 퀴즈를 풀어요.</p>
      <p class="ref">모든 기기가 인터넷에 연결되어 있어야 해요. 처음 연결할 때만 무료 연결 서버를 거치고, 그 뒤에는 기기끼리 직접 주고받아요. 같은 와이파이가 가장 안정적이에요.</p></div>
      <div class="mbtns row"><button class="btn main" data-host>👑 방 만들기 <small>이 기기가 진행</small></button><button class="btn mint" data-join>📱 방 참가하기 <small>방 코드 입력</small></button></div>`,{close:true,tone:'var(--mint)',wide:true});
    $('[data-host]',L.box).onclick=async()=>{L.close();try{UI.toast('방을 만드는 중…');await Net.host();Setup.open('people')}catch(e){netError(e)}};
    $('[data-join]',L.box).onclick=()=>{L.close();this.joinForm(prefill)};
    if(prefill){L.close();this.joinForm(prefill)}},
  joinForm(prefill){const prof=store.get('net.profile',{name:'',emoji:TOKENS[6],color:PALETTE[1]});
    const draw=()=>`<div class="kick">📱 방 참가하기</div><h3>방 코드와 내 캐릭터</h3><div class="mbody">
      <label class="cute">방 코드 (6자리)<input class="inp" id="jcode" maxlength="8" style="font-size:2rem;letter-spacing:.2em;text-transform:uppercase;text-align:center" value="${esc(prefill||'')}" placeholder="ABC123" autocomplete="off"></label>
      <label class="cute">내 이름<input class="inp" id="jname" maxlength="10" value="${esc(prof.name)}" placeholder="예: 민수"></label>
      <div class="pedit" style="--pc:${prof.color};grid-template-columns:auto 1fr"><span class="tok" style="--pc:${prof.color}">${esc(prof.emoji)}</span><button class="btn sm" data-look>🎨 동물·색깔 고르기</button></div></div>
      <div class="mbtns"><button class="btn main wide" data-go>참가하기</button></div>`;
    const L=openLayer('info',draw(),{close:true,tone:'var(--mint)'});
    const bind=()=>{$('[data-look]',L.box).onclick=()=>{prof.name=$('#jname',L.box).value;prefill=$('#jcode',L.box).value;pickLook(prof,[],()=>{store.set('net.profile',prof);this.joinForm(prefill)})};
      $('[data-go]',L.box).onclick=async()=>{const code=$('#jcode',L.box).value.trim().toUpperCase().replace(/[^A-Z0-9]/g,''),name=$('#jname',L.box).value.trim();
        if(code.length<4)return UI.toast('방 코드를 확인해 주세요');if(!name)return UI.toast('이름을 적어 주세요');
        prof.name=name;store.set('net.profile',prof);const b=$('[data-go]',L.box);b.disabled=true;b.textContent='연결하는 중…';
        try{await Net.join(code,{name,emoji:prof.emoji,color:prof.color});L.close();this.lobby()}catch(e){b.disabled=false;b.textContent='참가하기';netError(e)}};
      setTimeout(()=>$(prefill?'#jname':'#jcode',L.box).focus(),60)};bind()},
  lobby(){if(Net.role!=='client'||Net.G)return;const lb=Net.lastLobby,me=Net.cid;
    const seats=lb?lb.seats:[];const mine=seats.find(s=>s.net===me);
    const html=`<div class="kick">📱 방 ${esc(Net.code)} · ${lb?esc(lb.board)+' 판':''}</div><h3>방장이 게임을 시작하기를 기다려요</h3>
      <div class="code">${esc(Net.code)}</div>
      <div class="members">${seats.map(s=>`<div class="m" style="box-shadow:inset .35rem 0 0 ${s.color}"><span class="tok" style="--pc:${s.color}">${esc(s.emoji)}</span>${esc(s.name)}${s.net===me?' (나)':''}<span class="st">${s.ai?'🤖 컴퓨터':s.net?(s.online?'🟢 접속':'⚪ 끊김'):'🙂 방장 기기'}</span></div>`).join('')||'<div class="m">참가자 목록을 받는 중…</div>'}</div>
      ${mine?'':'<p class="ref">빈 자리가 없어서 구경하는 사람으로 들어왔어요.</p>'}
      <div class="mbtns row"><button class="btn" data-look>🎨 내 캐릭터 바꾸기</button><button class="btn" data-leave>방 나가기</button></div>`;
    const L=openLayer('info',html,{tone:'var(--mint)'});
    $('[data-leave]',L.box).onclick=()=>{L.close();Net.leave();App.home()};
    $('[data-look]',L.box).onclick=()=>{const prof={...Net.profileData};pickLook(prof,seats.filter(s=>s.net!==me).map(s=>({color:s.color})),()=>{Net.sendProfile(prof);setTimeout(()=>this.lobby(),200)})}},
  clientMenu(){const L=openLayer('info',`<div class="kick">📱 방 ${esc(Net.code)}</div><h3>참가자 메뉴</h3><div class="sgrid">${itemsHTML(SET_ITEMS.etc,{},false)}</div>
    <div class="mbtns row"><button class="btn" data-leave>방 나가기</button><button class="btn main" data-close>닫기</button></div>`,{close:true,wide:true});
    bindItems(L.box,SET_ITEMS.etc,{},()=>{});$('[data-close]',L.box).onclick=L.close;$('[data-leave]',L.box).onclick=()=>{L.close();Net.leave();App.home()}}
};
function netError(e){const m=e&&e.message;
  UI.toast(m==='noroom'?'그 방 코드의 방을 찾지 못했어요. 코드를 확인해 주세요':m==='timeout'?'연결이 오래 걸려요. 인터넷 연결을 확인해 주세요':m==='nolib'?'연결 기능을 불러오지 못했어요. 인터넷 연결을 확인해 주세요':'연결하지 못했어요. 잠시 뒤 다시 해 주세요',4500)}
