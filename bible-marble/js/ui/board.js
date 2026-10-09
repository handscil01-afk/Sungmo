'use strict';
/* ================= 화면: 보드 · 상황판 · 가운데 ================= */
const UI={};
const PREF=Object.assign({sound:true,volume:.7,bgmVol:.3,speed:'normal',autoFS:true,installHide:false,textScale:1,tokScale:1},store.get('prefs',{}));
const savePref=()=>store.set('prefs',PREF);
const LOGO_COLORS=['#ff7b54','#f7b500','#38b996','#4f8dff','#b06ce8','#ff6fae','#ff7b54'];
const logoHTML=t=>[...t].map((ch,k)=>ch===' '?'<span class="sp"></span>':`<span style="--c:${LOGO_COLORS[k%LOGO_COLORS.length]};--r:${k%2?3:-3}deg;--d:${k*.12}s">${ch}</span>`).join('');
const reducedMotion=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const PIPS={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
const pipHTML=v=>Array.from({length:9},(_,k)=>`<i class="${PIPS[v].includes(k)?'on':''}"></i>`).join('');
function drawDie(el,v){if(!el)return;el.innerHTML=pipHTML(v);el.classList.toggle('d1',v===1);el.setAttribute('aria-label','주사위 '+v)}
const cellOf=i=>{if(i===0)return[9,9];if(i<8)return[9,9-i];if(i===8)return[9,1];if(i<16)return[9-(i-8),1];if(i===16)return[1,1];if(i<24)return[1,1+(i-16)];if(i===24)return[1,9];return[1+(i-24),9]};
const sideOf=i=>i%8===0?'corner':i<8?'sb':i<16?'sl':i<24?'st':'sr';
/* 이 기기에서 볼 상태 (멀티플레이 참가자는 방장이 보낸 상태) */
const VG=()=>Net.role==='client'?Net.G:G;
const roundText=g=>g.cfg.rounds>0?`${Math.min(g.round,g.cfg.rounds)} / ${g.cfg.rounds}`:`${g.round} · 파산까지`;
/* 중계 모드 참가자 휴대폰: 게임판 대신 자기 상황판 중심 화면(대시보드)을 씁니다 */
const isDash=()=>Net.role==='client'&&Net.kind==='player'&&Net.mode==='relay'&&Net.mySeat!=null;

/* ---------- 보드 만들기 ---------- */
UI.buildBoard=function(){
  const g=VG(),b=$('#board');document.body.appendChild($('#toast'));b.innerHTML='';
  document.body.classList.toggle('dash',isDash());document.body.classList.toggle('display',Net.kind==='display');document.body.classList.toggle('remote',Net.kind==='remote');
  $('#rmt')?.remove();if(Net.kind==='remote')return UI.buildRemote();
  if(isDash())return UI.buildDash();$('#dash')?.remove();
  g.board.tiles.forEach((t,i)=>{
    const [r,c]=cellOf(i),s=sideOf(i),el=document.createElement('div');
    el.className=`tile t-${t.t} ${s}`+(s==='corner'?` c-${t.t}`:'')+([...(t.short||t.name)].length>=4?' long':'');el.style.gridArea=`${r}/${c}`;el.dataset.i=i;el.tabIndex=0;el.setAttribute('role','button');
    if(t.t==='city')el.style.setProperty('--gc',GROUP_COLORS[t.g]);
    let h='';
    if(t.t==='city')h=`<i class="band"></i><i class="deco"></i><i class="drL"></i><i class="drR"></i><span class="pic">${esc(t.pic)}</span><b class="nm">${esc(t.short||t.name)}</b><span class="pr"></span><span class="flag" hidden></span><span class="bld"></span>`;
    else if(t.t==='spot')h=`<i class="deco"></i><span class="pic">${esc(t.pic)}</span><b class="nm">${esc(t.short||t.name)}</b><span class="pr"></span><span class="flag" hidden></span>`;
    else if(s==='corner')h=`<span class="pic">${esc(t.pic)}</span><b class="nm">${esc(t.short||t.name)}</b><span class="sub">${esc(t.sub||'')}</span>`;
    else h=`<span class="pic">${esc(t.pic)}</span><b class="nm">${esc(t.short||t.name)}</b>`;
    el.innerHTML=h;b.appendChild(el)});
  const c=document.createElement('div');c.id='center';
  /* 게임 중에는 머리줄을 없애고 가운데 정보 줄에 작은 버튼(되돌리기 · 진행자 메뉴 · 설정)만 둡니다. 말이 놓이는 가장자리 띠와 겹치지 않는 자리예요 */
  c.innerHTML=`<div class="ttl">${[...'성경 부루마블'].map((ch,k)=>`<span style="--c:${LOGO_COLORS[k%7]}">${ch}</span>`).join('')}</div>
    <div class="cinfo"><button class="gb" id="gUndo" aria-label="되돌리기" title="되돌리기" hidden>↩️</button><span class="rnd" id="cRnd"></span><button class="gb" id="gHost" aria-label="진행자 메뉴" title="진행자 메뉴" hidden>🎤</button><button class="gb" id="gSet" aria-label="설정" title="설정">⚙️</button></div><div id="cWho"></div>
    <div class="tray"><div class="die" id="d1"></div><div class="die" id="d2"></div></div>
    <div id="cMsg"></div><div id="cAct"></div><ul id="cLog"></ul><div class="pot">🧺 헌금함 <b id="cPot">0</b> 달란트</div>
    <div id="pickBar" hidden>날아갈 칸을 눌러 주세요</div>`;
  b.appendChild(c);const tl=document.createElement('div');tl.id='tokLayer';b.appendChild(tl);drawDie($('#d1'),5);drawDie($('#d2'),2);c.appendChild($('#toast'));UI.bindGameBtns(c);
  b.onclick=e=>{const el=e.target.closest('.tile');if(el)onTileClick(+el.dataset.i)};
  b.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('tile')){e.preventDefault();onTileClick(+e.target.dataset.i)}};
};
UI.renderTiles=function(){const g=VG();if(!g)return;
  $$('#board .tile').forEach(el=>{const i=+el.dataset.i,t=g.board.tiles[i],o=g.own[i];
    if(t.t!=='city'&&t.t!=='spot'){el.setAttribute('aria-label',t.name);return}
    el.classList.toggle('owned',!!o);[0,1,2,3].forEach(l=>el.classList.toggle('lv'+l,!!o&&o.l===l));const pr=$('.pr',el),fl=$('.flag',el),bd=$('.bld',el);
    if(o){const p=g.players.find(x=>x.id===o.o);el.style.setProperty('--oc',p.col);pr.textContent='통행 '+tollOfIn(g,i);fl.hidden=false;fl.innerHTML=tokIn(p.tok);
      if(bd)bd.innerHTML=o.l?`<span class="bi">${BLD[o.l]}</span><span class="lvp">${[1,2,3].map(k=>`<i class="${k<=o.l?'on':''}"></i>`).join('')}</span>`:'';
      el.setAttribute('aria-label',`${t.name}, ${p.name}의 땅, ${LV[o.l]}, 통행료 ${tollOfIn(g,i)}`)}
    else{el.style.removeProperty('--oc');pr.textContent=t.price;fl.hidden=true;if(bd)bd.innerHTML='';el.setAttribute('aria-label',`${t.name}, 땅값 ${t.price}`)}})};
/* 멀티플레이 참가자도 같은 계산을 하도록 상태를 받는 함수 */
function tollOfIn(g,i){const s=G;G=g;try{return tollOf(i)}finally{G=s}}
function worthIn(g,p){const s=G;G=g;try{return worth(p)}finally{G=s}}
/* 말은 칸 안의 글씨 위가 아니라 칸 바로 안쪽(보드 가운데 쪽) 띠에 놓습니다. 한 칸에 여럿이면 두 줄로 나란히 놓아 서로 겹치지 않게 합니다 */
UI.renderTokens=function(hopId){const g=VG(),layer=$('#tokLayer');if(!g||!layer)return;
  const u=$('#board').clientWidth/100,ts=Math.max(16,u*4.4*(PREF.tokScale||1)),gap=Math.max(1,u*.45),at={};
  layer.innerHTML='';
  for(const p of g.players){if(p.out)continue;(at[p.pos]=at[p.pos]||[]).push(p)}
  for(const [pos,list] of Object.entries(at)){const el=$(`#board .tile[data-i="${pos}"]`);if(!el)continue;
    const x=el.offsetLeft,y=el.offsetTop,w=el.offsetWidth,h=el.offsetHeight,side=sideOf(+pos),n=list.length;
    list.forEach((p,j)=>{const col=j%2,row=j/2|0,inRow=Math.min(2,n-row*2),span=inRow*ts+(inRow-1)*gap,step=ts+gap;let L,T;
      if(side==='sb'){L=x+w/2-span/2+col*step;T=y-gap-ts-row*step}
      else if(side==='st'){L=x+w/2-span/2+col*step;T=y+h+gap+row*step}
      else if(side==='sl'){T=y+h/2-span/2+col*step;L=x+w+gap+row*step}
      else if(side==='sr'){T=y+h/2-span/2+col*step;L=x-gap-ts-row*step}
      else{const i=+pos,dx=(i===0||i===24)?-1:1,dy=(i===0||i===8)?-1:1;
        L=(dx<0?x-gap-ts:x+w+gap)+dx*col*step;T=(dy<0?y-gap-ts:y+h+gap)+dy*row*step}
      layer.insertAdjacentHTML('beforeend',`<span class="tok${p.id===hopId?' hop':''}${p.id===(g.players[g.turn]||{}).id&&!g.over?' now':''}" style="--pc:${p.col};left:${L.toFixed(1)}px;top:${T.toFixed(1)}px;width:${ts.toFixed(1)}px;height:${ts.toFixed(1)}px;font-size:${(ts*.62).toFixed(1)}px" title="${esc(p.name)}">${tokIn(p.tok)}</span>`)})}
  $$('#board .tile.here').forEach(e=>e.classList.remove('here'));
  if(!g.over){const cp=g.players[g.turn];if(cp)$(`#board .tile[data-i="${cp.pos}"]`)?.classList.add('here')}};
UI.moveToken=id=>UI.renderTokens(id);
UI.pop=i=>{const el=$(`#board .tile[data-i="${i}"]`);if(!el)return;el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop')};
UI.burst=(i,label,color)=>{const el=$(`#board .tile[data-i="${i}"]`);if(!el)return;const s=document.createElement('span');s.className='tag-burst';s.style.setProperty('--bc',color||'var(--accent)');s.textContent=label;
  const b=$('#board'),r=el.getBoundingClientRect(),br=b.getBoundingClientRect();s.style.left=(r.left-br.left+r.width/2)+'px';s.style.top=(r.top-br.top+r.height/2)+'px';b.appendChild(s);setTimeout(()=>s.remove(),1700)};

/* ---------- 상황판 ---------- */
function seatsOf(n){return n===2?[[0],[1]]:n===3?[[0,2],[1]]:[[0,3],[1,2]]}
function cardHTML(g,p){
  const k=g.players.indexOf(p),own=Object.entries(g.own).filter(([,o])=>o.o===p.id).map(([i])=>+i).sort((a,b)=>a-b),blds=own.reduce((s,i)=>s+g.own[i].l,0),tags=[];
  const jt=g.board.tiles.find(t=>t.t==='jail');
  if(p.jail>0)tags.push(`<span class="tag w" data-tip="jail">${esc(jt.pic)} ${esc(jt.name)} ${p.jail}번 남음</span>`);
  if(p.skip)tags.push('<span class="tag w" data-tip="skip">🕯️ 한 번 쉼</span>');
  if(p.ark)tags.push(`<span class="tag" data-tip="ark">🚢 방주 ${p.ark}</span>`);
  if(p.song)tags.push(`<span class="tag" data-tip="song">🎵 찬송 ${p.song}</span>`);
  const act=k===g.turn&&!g.over,me=Net.role==='client'&&Net.mySeat===p.id;
  const conn=p.net?(Net.isOnline(p.net)?'<span class="on">● 접속 중</span>':'<span class="off">● 연결 끊김</span>'):'';
  const whoT=p.ai?`🤖 컴퓨터(${LV_KO[p.aiLv]||'보통'})`:p.host?'👑 방장':p.op?'🎤 진행자가 조작':p.net?'📱 참가자':'🙂 사람';
  return `<div class="pc${act?' act':''}${p.out?' out':''}" data-id="${p.id}" style="--pc:${p.col}">
    <div class="pc-top"><span class="tok">${tokIn(p.tok)}</span><div class="nmw"><div class="nm">${esc(p.name)}${me?' (나)':''}</div><div class="who">${whoT} · ${p.ai?'자동 주사위':p.dice==='real'?'🎲 실물 주사위':'화면 주사위'} ${conn}</div></div>${act?'<span class="turnb">차례</span>':''}</div>
    <div class="money">${p.out?'파산':fmt(p.money)}${p.out?'':'<small>달란트</small>'}</div>
    <div class="psub"><span>총자산 ${fmt(worthIn(g,p))}</span><span>땅 ${own.length}곳</span><span>건물 ${blds}단계</span></div>
    ${tags.length?`<div class="tags">${tags.join('')}</div>`:''}
    <div class="hand" data-n="${own.length}">${own.length?own.map((i,k)=>{const t=g.board.tiles[i],o=g.own[i];
      return `<span class="hc" data-tile="${i}" role="button" tabindex="0" style="--gc:${t.t==='city'?GROUP_COLORS[t.g]:'#86d5ea'};--k:${k}"><span class="hpic">${esc(t.pic)}</span><b>${esc(t.short||t.name)}</b><span class="hlv">${t.t==='city'?`${BLD[o.l]} ${LV[o.l]}`:'🌊 명소'}</span><span class="htoll">${fmt(tollOfIn(g,i))}</span></span>`}).join(''):'<span class="none">아직 가진 땅이 없어요</span>'}</div></div>`}
/* 가진 땅 카드를 포커 패처럼 부채꼴로 겹쳐 펼칩니다 (카드가 많으면 더 겹쳐요) */
UI.fanHands=function(){$$('.hand').forEach(h=>{const cs=$$('.hc',h),n=cs.length;if(!n||!h.clientWidth)return;const W=h.clientWidth,cw=cs[0].offsetWidth||60;
  const step=n>1?Math.min(cw*.92,(W-cw-6)/(n-1)):0,mid=(n-1)/2,spread=Math.min(5,26/Math.max(1,n));
  cs.forEach((c,k)=>{c.style.left=(3+k*step)+'px';c.style.setProperty('--rot',((k-mid)*spread).toFixed(1)+'deg');c.style.setProperty('--lift',(Math.abs(k-mid)*Math.min(4,14/Math.max(1,n))).toFixed(1)+'px');c.style.zIndex=k+1})})};
UI.renderPlayers=function(){const g=VG();if(!g)return;const [L,R]=seatsOf(g.players.length);
  $('#pl').innerHTML=L.map(k=>cardHTML(g,g.players[k])).join('');$('#pr').innerHTML=R.map(k=>cardHTML(g,g.players[k])).join('');
  const wide=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pw'))>=290;$$('.pc').forEach(e=>e.classList.toggle('wide',wide));UI.fanHands()};
UI.renderCenter=function(){const g=VG();if(!g||!$('#cRnd'))return;
  $('#cRnd').textContent=`${g.board.name} 판 · 라운드 ${roundText(g)}${Net.code?` · 방 ${Net.code}`:''}`;
  const p=g.players[g.turn];$('#cWho').innerHTML=g.over?'<span class="chip" style="--pc:var(--g7)">🏆 게임 끝</span>':`<span class="chip" style="--pc:${p.col}"><span class="tok">${tokIn(p.tok)}</span>${esc(p.name)}의 차례</span>`;
  $('#cPot').textContent=fmt(g.pot)};
UI.renderLog=function(){const g=VG(),el=$('#cLog');if(!g||!el)return;el.innerHTML=g.log.slice(0,3).map(e=>`<li style="${e.c?'--pc:'+e.c:''}"><i></i><span>${esc(e.m)}</span></li>`).join('')};
UI.render=function(){if(!VG())return;UI.pauseOv();if($('#rmt')){UI.renderRemote();return}if($('#dash')){UI.renderDash();UI.updateHeader();return}if(!$('#board .tile'))return;UI.renderTiles();UI.renderTokens();UI.renderPlayers();UI.renderCenter();UI.renderLog();UI.updateHeader();Net.pushState()};
UI.setMsg=h=>{UI.lastMsg=h;const m=$('#cMsg');if(m)m.innerHTML=h;if($('#rmt'))UI.renderRemote()};

/* ---------- 주사위 굴림: 화면 전체에서 튕기며 굴러와 가운데에 크게 멈춥니다 (모든 기기, 컴퓨터 주사위 포함) ---------- */
UI.rollDice=async function(a,b,anim){
  const d1=$('#d1'),d2=$('#d2');if(d1){drawDie(d1,a);drawDie(d2,b)}
  if(SPD()===0)return;
  let fx=$('#rollfx');if(!fx){fx=document.createElement('div');fx.id='rollfx';fx.setAttribute('aria-live','polite');document.body.appendChild(fx)}
  clearTimeout(fx._t);const W=innerWidth,H=innerHeight,S=Math.round(clamp(Math.min(W,H)*.26,84,280)),gap=Math.round(S*.22);
  fx.style.setProperty('--ds',S+'px');fx.className='on';
  fx.innerHTML=`<div class="rdie" id="rd1"></div><div class="rdie" id="rd2"></div><div class="rsum"></div>`;
  const r1=$('#rd1',fx),r2=$('#rd2',fx),sum=$('.rsum',fx);
  const fy=Math.round(H/2-S*.72),fx1=Math.round(W/2-S-gap/2),fx2=Math.round(W/2+gap/2);
  drawDie(r1,a);drawDie(r2,b);
  const place=(el,x,y)=>{el.style.transform=`translate(${x}px,${y}px)`};
  place(r1,fx1,fy);place(r2,fx2,fy);
  const speed=Math.min(1,SPD()+.25);
  if(anim&&!reducedMotion()&&r1.animate){
    const dur=Math.round(1150*speed);
    /* 화면 아래 양쪽 바깥에서 들어와 벽에 몇 번 튕긴 뒤 가운데에 멈춥니다 */
    const path=(fromLeft,endX)=>{const k=[];let rot=0,x=fromLeft?-S:W,y=H*.75;
      k.push({transform:`translate(${x}px,${y}px) rotate(0deg)`,offset:0});
      for(let s=1;s<=4;s++){rot+=(200+Math.random()*160)*(fromLeft?1:-1);x=Math.random()*(W-S);y=s%2?Math.random()*H*.25:H*.55+Math.random()*(H*.4-S);
        k.push({transform:`translate(${Math.round(x)}px,${Math.round(Math.max(0,y))}px) rotate(${Math.round(rot)}deg)`,offset:s/5.4})}
      k.push({transform:`translate(${endX}px,${fy}px) rotate(${Math.round(rot/360)*360}deg)`,offset:1});return k};
    const ease={duration:dur,easing:'cubic-bezier(.3,.6,.35,1)'};
    r1.animate(path(true,fx1),ease);r2.animate(path(false,fx2),ease);
    const t0=performance.now();await new Promise(res=>{const f=()=>{if(performance.now()-t0>=dur-110){drawDie(r1,a);drawDie(r2,b);return res()}drawDie(r1,1+(Math.random()*6|0));drawDie(r2,1+(Math.random()*6|0));setTimeout(f,80)};f()})}
  else if(r1.animate){const k=[{transform:`translate(${fx1}px,${fy}px) scale(.4)`,opacity:0},{transform:`translate(${fx1}px,${fy}px) scale(1)`,opacity:1}];
    r1.animate(k,{duration:260});r2.animate(k.map(f=>({...f,transform:f.transform.replace(`${fx1}px`,`${fx2}px`)})),{duration:260});await sleepRaw(260)}
  if(a===b){r1.classList.add('dbl');r2.classList.add('dbl')}
  sum.innerHTML=`${a} + ${b} = <b>${a+b}</b>${a===b?' <em>더블!</em>':''}`;sum.style.top=(fy+S+Math.round(S*.12))+'px';sum.classList.add('on');
  await sleepRaw(Math.round(950*speed));
  fx.classList.add('out');fx._t=setTimeout(()=>{fx.className='';fx.innerHTML=''},380)};

/* ---------- 알림·소리 ---------- */
UI.toast=(msg,ms)=>{const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('on');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),ms||2300)};
UI.float=(id,delta)=>{if(!delta)return;const el=$(`.pc[data-id="${id}"]`);if(!el)return;const f=document.createElement('span');f.className='float '+(delta>0?'p':'m');f.textContent=(delta>0?'+':'')+fmt(delta);el.appendChild(f);setTimeout(()=>f.remove(),1400)};
const SND={ctx:null,
  init(){if(this.ctx)return;try{const C=window.AudioContext||window.webkitAudioContext;this.ctx=new C()}catch(e){}},
  tone(f,t0,d,type='triangle',v=.07){const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;v*=(PREF.volume==null?.7:PREF.volume)/.7;o.frequency.setValueAtTime(f,t0);g.gain.setValueAtTime(v,t0);g.gain.exponentialRampToValueAtTime(.0001,t0+d);o.connect(g);g.connect(c.destination);o.start(t0);o.stop(t0+d+.02)},
  play(k){if(!PREF.sound||!this.ctx||SPD()===0)return;const c=this.ctx;if(c.state==='suspended')c.resume();const t=c.currentTime;
    switch(k){case 'step':this.tone(880,t,.06,'sine',.06);break;case 'roll':for(let i=0;i<6;i++)this.tone(300+Math.random()*300,t+i*.05,.04,'square',.025);break;
      case 'coin':this.tone(1046,t,.08,'square',.04);this.tone(1568,t+.08,.2,'square',.04);break;case 'pay':this.tone(587,t,.1,'triangle',.07);this.tone(440,t+.1,.18,'triangle',.07);break;
      case 'good':[523,659,784,1047].forEach((f,i)=>this.tone(f,t+i*.08,.18,'triangle',.08));break;case 'bad':this.tone(330,t,.16,'triangle',.08);this.tone(262,t+.16,.3,'triangle',.08);break;
      case 'card':[784,988,1175,1568].forEach((f,i)=>this.tone(f,t+i*.06,.24,'sine',.07));break;case 'build':[392,523,659,784].forEach((f,i)=>this.tone(f,t+i*.06,.1,'square',.04));break;
      case 'tick':this.tone(1200,t,.03,'sine',.04);break}}};
UI.sfx=k=>SND.play(k);
/* ---------- 배경 음악: 잔잔한 1분(80BPM 20마디) 곡을 미리 정한 악보대로 이어서 예약하므로 끝과 처음이 끊김 없이 이어집니다 ---------- */
const BGM={on:false,timer:0,next:0,step:0,out:null,
  STEP:.375,STEPS:160,                                   // 8분음표 0.375초 × 160 = 60초
  PROG:[[48,[60,64,67]],[45,[57,60,64]],[41,[57,60,65]],[43,[59,62,67]]],  // C · Am · F · G
  /* 기기마다 따로 정하지 않았으면: 방장·혼자 하는 기기·게임 화면 창에서만 켭니다 (참가자 휴대폰끼리 겹치지 않게) */
  want(){return PREF.bgm!=null?!!PREF.bgm:!(Net.role==='client'&&Net.kind!=='display')},
  vol(){return (PREF.bgmVol||.3)*.5},
  mel:null,
  melody(){if(this.mel)return this.mel;let seed=7;const r=()=>(seed=(seed*16807)%2147483647)/2147483647;
    const pent=[60,62,64,67,69,72,74,76],m=new Array(this.STEPS).fill(null);
    for(let bar=4;bar<20;bar++){const ch=this.PROG[bar%4][1],at=[0,3,4,6];
      for(const e of at)if(e===0||r()<.62){const pool=e===0?ch.map(x=>x+12):pent;m[bar*8+e]=pool[Math.floor(r()*pool.length)]}}
    m[19*8]=74;m[19*8+4]=71;return this.mel=m},
  note(midi,t,d,type,v){const c=SND.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(440*Math.pow(2,(midi-69)/12),t);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+Math.min(.4,d*.3));g.gain.exponentialRampToValueAtTime(.0001,t+d);
    o.connect(g);g.connect(this.out);o.start(t);o.stop(t+d+.05)},
  sched(s,t){const bar=s>>3,e=s&7,[bass,ch]=this.PROG[bar%4];
    if(e===0){ch.forEach(n=>this.note(n,t,3.2,'sine',.05));this.note(bass,t,1.4,'triangle',.09)}
    if(e===4)this.note(bass+7,t,1.2,'triangle',.06);
    this.note(ch[[0,1,2,1,2,1,0,1][e]]+12,t,.5,'triangle',.022);
    const m=this.melody()[s];if(m)this.note(m,t,e===0?1.1:.7,'sine',.07)},
  tick(){const c=SND.ctx;if(!c)return;if(this.next<c.currentTime)this.next=c.currentTime+.05;
    while(this.next<c.currentTime+.8){this.sched(this.step,this.next);this.step=(this.step+1)%this.STEPS;this.next+=this.STEP}},
  start(){const c=SND.ctx;if(!c||this.on)return;if(c.state==='suspended')c.resume();this.on=true;
    this.out=c.createGain();this.out.gain.setValueAtTime(0,c.currentTime);this.out.gain.linearRampToValueAtTime(this.vol(),c.currentTime+1.5);this.out.connect(c.destination);
    this.next=c.currentTime+.1;this.tick();this.timer=setInterval(()=>this.tick(),200)},
  stop(){if(!this.on)return;this.on=false;clearInterval(this.timer);const c=SND.ctx,o=this.out;this.out=null;
    try{o.gain.cancelScheduledValues(c.currentTime);o.gain.setValueAtTime(o.gain.value,c.currentTime);o.gain.linearRampToValueAtTime(0,c.currentTime+.6);setTimeout(()=>{try{o.disconnect()}catch(e){}},900)}catch(e){}},
  sync(){const ok=PREF.sound&&this.want()&&SND.ctx&&!document.hidden;if(ok&&!this.on)this.start();else if(!ok&&this.on)this.stop();
    else if(this.on&&this.out)this.out.gain.setTargetAtTime(this.vol(),SND.ctx.currentTime,.2)}};
document.addEventListener('pointerdown',()=>{SND.init();BGM.sync()},{passive:true});document.addEventListener('keydown',()=>{SND.init();BGM.sync()});
document.addEventListener('visibilitychange',()=>BGM.sync());

/* ---------- 화면 크기 맞춤 ---------- */
UI.fit=function(){
  const root=document.documentElement,W=Math.min(innerWidth,root.clientWidth||innerWidth),H=innerHeight;
  /* 화면을 돌리거나 전체화면을 오가면 이전 방향의 스크롤 위치가 남아 화면이 한쪽으로 쏠릴 수 있어서 처음 위치로 돌려놓습니다 */
  if(document.body.classList.contains('ingame')){if(scrollX||scrollY)scrollTo(0,0);const se=document.scrollingElement;if(se){se.scrollLeft=0;se.scrollTop=0}}
  const fs=clamp(Math.sqrt(W*H)/52,14,30)*(PREF.textScale||1);root.style.setProperty('--fs',fs.toFixed(2)+'px');
  const hdr=$('#hdr').offsetHeight;root.style.setProperty('--hdr',hdr+'px');
  if(!document.body.classList.contains('ingame')||$('#dash'))return;
  const tab=W/H>=1.15&&W>=640;document.body.classList.toggle('tab',tab);document.body.classList.toggle('port',!tab);
  let bs,pw=0;const gap=fs*.7,side=fs*1.2;
  /* 가로 화면: 게임판을 먼저 화면 높이만큼 크게 잡고, 남는 너비를 양옆 상황판에 나눠 줍니다 (상황판은 최소 너비만 지킵니다) */
  if(tab){bs=H-hdr-fs*.9;pw=Math.max(fs*9,(W-bs-2*gap-side)/2);bs=Math.max(260,Math.min(bs,W-2*pw-2*gap-side));pw=Math.floor((W-bs-2*gap-side)/2)}
  else{const panelsH=Math.max(fs*11,H*.24);bs=Math.max(260,Math.min(W-fs*1.2,H-hdr-panelsH-fs))}
  bs=Math.floor(bs);root.style.setProperty('--bs',bs+'px');root.style.setProperty('--pw',pw+'px');
  document.body.classList.toggle('small',bs<520);document.body.classList.toggle('np',tab&&pw<fs*11.5);$('#board')?.classList.toggle('lg',bs/9.6>=62);
  if(VG()){UI.renderPlayers();UI.renderTokens()}};
/* 크기가 바뀌는 순간에는 브라우저가 아직 새 크기를 다 알려 주지 않을 때가 있어서, 바뀐 뒤 몇 번 더 다시 계산합니다 */
let fitTs=[];
UI.refit=function(){fitTs.forEach(clearTimeout);requestAnimationFrame(()=>UI.fit());fitTs=[120,350,800].map(ms=>setTimeout(()=>UI.fit(),ms))};
addEventListener('resize',UI.refit);addEventListener('orientationchange',UI.refit);
if(window.visualViewport)visualViewport.addEventListener('resize',UI.refit);
if(screen.orientation&&screen.orientation.addEventListener)screen.orientation.addEventListener('change',UI.refit);

/* ---------- 게임 화면 구석 버튼: 되돌리기 · 진행자 메뉴 · 설정 ---------- */
UI.bindGameBtns=function(root){
  const u=$('#gUndo',root),s=$('#gSet',root),h=$('#gHost',root);
  if(u)u.onclick=()=>confirmUndo();
  if(s)s.onclick=()=>Net.role==='client'?Setup.openClient():Setup.openInGame();
  if(h)h.onclick=()=>Setup.openInGame('net');
  UI.updateHeader()};

/* ---------- 상황판의 땅·카드를 누르면 설명 창 ---------- */
const TIPS={ark:['🚢 노아의 방주 카드','남의 땅에 도착했을 때 이 카드를 쓰면 통행료를 한 번 내지 않아요.','창 7:1'],
  song:['🎵 찬송 카드','광야에 있을 때 이 카드를 쓰면 바로 벗어날 수 있어요. 바울과 실라가 찬송할 때 옥문이 열렸어요.','행 16:25-26'],
  skip:['🕯️ 안식일','다음 차례에 한 번 쉬어요.','출 20:8'],jail:['🌵 광야','퀴즈를 맞히거나, 더블이 나오거나, 헌금 100을 내면 벗어날 수 있어요. 남은 차례가 끝나면 저절로 나와요.','민 14:33']};
document.addEventListener('click',e=>{if(!document.body.classList.contains('ingame'))return;
  const ln=e.target.closest('.ln[data-tile],.hc[data-tile]');if(ln){onTileClick(+ln.dataset.tile);return}
  const tg=e.target.closest('.tag[data-tip]');if(tg){const t=TIPS[tg.dataset.tip];if(t)openInfo('상황판',t[0],`<p>${esc(t[1])}</p>${refHTML(t[2])}`,'var(--g7)');return}
  const ot=e.target.closest('[data-see]');if(ot){UI.dashSee=+ot.dataset.see;UI.renderDash();return}});
document.addEventListener('keydown',e=>{if(e.key!=='Enter')return;const ln=e.target.closest&&e.target.closest('.ln[data-tile],.hc[data-tile]');if(ln)onTileClick(+ln.dataset.tile)});

/* ---------- 중계 모드 참가자 휴대폰: 내 상황판 + 다른 플레이어 ----------
   모두는 TV로 게임판을 보므로, 휴대폰에는 왼쪽에 다른 플레이어를 간단히, 가운데에 내 상황판(또는 고른 사람의 상황판)을 크게 보여 줍니다 */
UI.dashSee=null;
UI.buildDash=function(){let d=$('#dash');if(!d){d=document.createElement('div');d.id='dash';$('#game').appendChild(d)}
  d.innerHTML=`<div class="dtop"><span class="room">📱 방 ${esc(Net.code||'')}</span><span class="sp"></span><button class="gb" id="gSet" aria-label="설정">⚙️</button></div>
    <div class="dlist" id="dlist"></div><div class="dmain"><div id="dcard"></div>
    <div class="dact"><div class="tray"><div class="die" id="d1"></div><div class="die" id="d2"></div></div><div id="cMsg"></div><div id="cAct"></div></div></div>`;
  drawDie($('#d1'),5);drawDie($('#d2'),2);d.appendChild($('#toast'));UI.bindGameBtns(d);UI.renderDash()};
UI.renderDash=function(){const g=VG(),d=$('#dash');if(!g||!d)return;const me=g.players.find(p=>p.id===Net.mySeat);
  if(UI.dashSee!=null&&!g.players.some(p=>p.id===UI.dashSee))UI.dashSee=null;
  const see=UI.dashSee!=null?g.players.find(p=>p.id===UI.dashSee):me;
  $('#dlist',d).innerHTML=g.players.filter(p=>p!==me).map(p=>`<button class="dp${p===see?' on':''}${p===me?' me':''}${p.out?' out':''}" data-see="${p.id}" style="--pc:${p.col}"><span class="tok" style="--pc:${p.col}">${tokIn(p.tok)}</span><span class="nm">${esc(p.name)}${p===me?' (나)':''}</span><span class="mo">💰 ${p.out?'파산':fmt(p.money)}</span>${p.id===g.players[g.turn].id&&!g.over?'<i class="tb">차례</i>':''}</button>`).join('');
  const back=see&&me&&see!==me?`<button class="btn sm wide back" data-see="${me.id}">↩️ 내 상황판으로 돌아가기</button>`:'';
  const pos=see?g.board.tiles[see.pos]:null;
  $('#dcard',d).innerHTML=see?`${back}${cardHTML(g,see)}<div class="dpos" data-tile-pos="${see.pos}">📍 지금 위치: <b>${esc(pos.pic)} ${esc(pos.name)}</b></div>`:'<p class="muted">상황판을 불러오는 중…</p>';
  $$('.pc',d).forEach(e=>e.classList.add('wide'));UI.fanHands();
  const dp=$('[data-tile-pos]',d);if(dp)dp.onclick=()=>onTileClick(+dp.dataset.tilePos);
  const tp=g.players[g.turn];
  $('.dtop .room',d).textContent=`📱 방 ${Net.code||''} · 라운드 ${roundText(g)} · ${g.over?'게임 끝':tp.name+'의 차례'}`};

/* ---------- 잠시 멈춤: 모든 기기에 알리고, 진행자 기기에는 다시 시작 버튼 ---------- */
UI.pauseOv=function(){const g=VG();let o=$('#pauseov');
  if(!(g&&g.paused&&!g.over)){if(o)o.remove();return}
  const judge=Net.role==='host'||Net.kind==='remote';
  if(!o){o=document.createElement('div');o.id='pauseov';document.body.appendChild(o)}
  o.innerHTML=`<div class="pbox"><div class="bigpic">⏸️</div><h3>잠시 멈췄어요</h3><p>${judge?'다시 시작하면 멈춘 곳부터 이어서 해요.':'진행자가 다시 시작하면 이어서 해요.'}</p>${judge?'<button class="btn main big" data-resume>▶️ 다시 시작</button>':''}</div>`;
  const r=$('[data-resume]',o);if(r)r.onclick=()=>{if(Net.kind==='remote')Net.cmd({c:'pause',on:false});else setPause(false)}};

/* ---------- 진행자 리모컨: 게임판 대신 진행에 필요한 것만 크게 ----------
   지금 상황과 정답·해설을 미리 보고, 판정·계속하기는 큰 창으로, 플레이어 관리·달란트 조정·되돌리기·잠시 멈춤을 한 화면에서 합니다 */
UI.buildRemote=function(){$('#dash')?.remove();let d=$('#rmt');if(!d){d=document.createElement('div');d.id='rmt';$('#game').appendChild(d)}
  d.innerHTML=`<div class="rtop"><span class="room">🎛️ 진행자 리모컨 · 방 ${esc(Net.code||'')}</span><span class="sp"></span><button class="gb" id="gSet" aria-label="설정">⚙️</button></div>
    <div class="rinfo" id="rinfo"></div><div class="rturn" id="rturn"></div><section class="rnow" id="rnow"></section>
    <div class="rtools"><button class="btn" data-r="undo">↩️ 되돌리기</button><button class="btn" data-r="pause">⏸️ 잠시 멈춤</button></div>
    <section class="rpl" id="rpl"></section><div hidden><div id="cMsg"></div><div id="cAct"></div><div id="d1"></div><div id="d2"></div></div>`;
  d.appendChild($('#toast'));UI.bindGameBtns(d);
  $('[data-r="undo"]',d).onclick=()=>{const L=openLayer('edit',`<div class="bigpic">↩️</div><h3>이전 게임 상태로 되돌릴까요?</h3><div class="mbody"><p>바로 전 사람의 선택 하나를 취소해요. 주사위 값과 문제는 그대로예요.</p></div><div class="mbtns row"><button class="btn wide" data-c>취소</button><button class="btn main wide" data-u>↩️ 되돌리기</button></div>`,{close:true,tone:'var(--accent)'});
    $('[data-c]',L.box).onclick=L.close;$('[data-u]',L.box).onclick=()=>{L.close();Net.cmd({c:'undo'})}};
  $('[data-r="pause"]',d).onclick=()=>{const g=VG();Net.cmd({c:'pause',on:!(g&&g.paused)})};
  UI.renderRemote()};
UI.renderRemote=function(){const g=VG(),d=$('#rmt');if(!g||!d)return;
  $('#rinfo',d).textContent=`${g.board.name} 판 · 라운드 ${roundText(g)}`;
  /* 차례 순서: 늘 같은 자리에 모든 플레이어를 순서대로 두고 지금 차례만 강조합니다 */
  $('#rturn',d).innerHTML=g.players.map((p,k)=>`<span class="rt ${k===g.turn&&!g.over?'on':''} ${p.out?'out':''}" style="--pc:${p.col}"><span class="tok" style="--pc:${p.col}">${tokIn(p.tok)}</span><b>${esc(p.name)}</b></span>`).join('<i>›</i>');
  $('[data-r="pause"]',d).textContent=g.paused?'▶️ 다시 시작':'⏸️ 잠시 멈춤';
  /* 지금 상황 + 정답 미리 보기 */
  const sp=Net.curPrompt,sec=Net.curSecret,Q=sp&&sp.quiz;let h='';
  if(Q){const q=Q.q,who=g.players.find(x=>x.id===(['qa','qv','qj','qo'].includes(sp.kind)?sp.pid:Q.pid)),mc=q.t==='mc';
    const st={qa:'답하는 중',qv:'컴퓨터가 생각하는 중',qj:'판정을 기다려요',qs:'다른 팀 기회를 고르는 중',qo:'도전할지 고르는 중',qr:'결과'}[sp.kind]||'';
    const ans=sec?(mc&&sec.ans!=null?`${sec.ans+1}번 · ${esc(q.choices[sec.ans])}`:esc(sec.a||'')):mc&&q.ans!=null?`${q.ans+1}번 · ${esc(q.choices[q.ans])}`:esc(q.a||'');
    const last=(Q.tries||[])[Q.tries.length-1]||{};
    h=`<div class="rq"><div class="kick">${Q.kick} · ${LV_KO[q.lv]} · ${mc?'객관식':'주관식'}</div><div class="rwho">${who?`${tokIn(who.tok)} ${esc(who.name)}`:''} <b>${st}</b></div>
      <p class="rqt">${esc(q.q)}</p>${mc?`<ol class="rch">${q.choices.map((c,k)=>`<li class="${sec&&sec.ans===k?'ok':''}">${esc(c)}</li>`).join('')}</ol>`:''}
      ${last.text?`<div class="rtyped">✍️ 입력한 답: <b>${esc(last.text)}</b></div>`:''}
      <div class="rans"><span>정답</span><b>${ans||'—'}</b>${sec&&sec.alt&&sec.alt.length?`<small>함께 인정: ${esc(sec.alt.join(', '))}</small>`:''}${(sec&&sec.ex)||q.ex?`<small>${esc((sec&&sec.ex)||q.ex)}</small>`:''}${(sec&&sec.ref)||q.ref?`<small>${refHTML((sec&&sec.ref)||q.ref)}</small>`:''}</div></div>`}
  else h=`<div class="rmsg">${UI.lastMsg||'진행 중이에요'}</div>`;
  /* 아래 두 줄은 늘 같은 자리: 누구를 기다리는지 · 진행 버튼 */
  h+=`<div class="rwait">${sp?(canAct(sp)?'👉 진행자가 할 차례예요':`⏳ ${esc(waitWho(sp))} 차례를 기다려요`):'⏳ 진행 중'}</div>
    <button class="btn main big wide" data-open ${sp&&canAct(sp)?'':'disabled'}>👉 진행하기 (판정·계속하기)</button>`;
  $('#rnow',d).innerHTML=h;const op=$('[data-open]',d);if(op)op.onclick=()=>UI.showPrompt(sp,true);
  /* 플레이어 관리 */
  $('#rpl',d).innerHTML=g.players.map(p=>{const on=p.net?Net.isOnline(p.net):null;
    const st=p.out?'파산':p.ai?`🤖 컴퓨터(${LV_KO[p.aiLv]||'보통'})`:p.op?'🎤 진행자 조작':p.net?(on?'🟢 접속 중':'⚪ 연결 끊김'):'';
    return `<div class="rp" data-pid="${p.id}" style="--pc:${p.col}"><span class="tok" style="--pc:${p.col}">${tokIn(p.tok)}</span><div class="nm"><b>${esc(p.name)}</b><small>${st}</small></div><span class="mo">${p.out?'-':fmt(p.money)}</span>
      ${p.out?'':`<div class="btnrow"><button class="btn sm" data-money="${p.id}">💰 조정</button>${p.ai?`<button class="btn sm" data-lv="${p.id}">난이도</button><button class="btn sm" data-op="${p.id}">🎤</button>`:`<button class="btn sm" data-toai="${p.id}">🤖 대체</button>`}</div>`}</div>`}).join('');
  $$('[data-money]',d).forEach(b=>b.onclick=()=>openMoney(g.players.find(x=>x.id===+b.dataset.money),(v,why)=>Net.cmd({c:'money',id:+b.dataset.money,v,why})));
  $$('[data-toai],[data-lv]',d).forEach(b=>b.onclick=()=>{const id=+(b.dataset.toai||b.dataset.lv),p=g.players.find(x=>x.id===id);pickAiLevel(p.aiLv||'normal',lv=>{if(lv)Net.cmd({c:'toai',id,lv})})});
  $$('[data-op]',d).forEach(b=>b.onclick=()=>Net.cmd({c:'op',id:+b.dataset.op}))};

/* 작은 게임판 (휴대폰 상황판 화면에서 칸 고르기용): 실제 게임판과 같은 배치로 그립니다 */
function miniBoardHTML(g,ok,here){return `<div class="miniboard">${g.board.tiles.map((t,i)=>{const [r,c]=cellOf(i),o=g.own[i],p=o&&g.players.find(x=>x.id===o.o),can=ok(i);
    return `<button type="button" class="mt t-${t.t}${can?'':' no'}${i===here?' here':''}" style="grid-area:${r}/${c};${t.t==='city'?`--gc:${GROUP_COLORS[t.g]};`:''}${p?`--oc:${p.col};`:''}" data-mt="${i}" ${can?'':'disabled'} aria-label="${esc(t.name)}"><span>${esc(t.pic)}</span><b>${esc(t.short||t.name)}</b>${p?`<i>${tokIn(p.tok)}</i>`:''}</button>`}).join('')}
    <div class="mcen">${g.players.filter(p=>!p.out).map(p=>`<span class="tok" style="--pc:${p.col}" title="${esc(p.name)}">${tokIn(p.tok)}</span>`).join('')}<small>지금 위치는 빨간 테두리 칸이에요</small></div></div>`}

/* ---------- 돈이 오가는 모습: 10 단위는 동전, 100 단위는 지폐로 낸 사람에게서 받는 사람에게 날아갑니다 ---------- */
function moneySpot(id){if(id==='pot')return $('#cPot')||$('#center');if(id==='bank')return $('#center');
  return $(`.pc[data-id="${id}"]`)||$(`.dp[data-see="${id}"]`)||$(`.rp[data-pid="${id}"]`)}
function rectMid(el){if(!el)return {x:innerWidth/2,y:innerHeight/2};const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+Math.min(r.height/2,60)}}
function bigAmt(el,txt,cls){const p=rectMid(el),d=document.createElement('div');d.className='bigamt '+cls;d.textContent=txt;d.style.left=p.x+'px';d.style.top=p.y+'px';document.body.appendChild(d);setTimeout(()=>d.remove(),1700)}
UI.payFx=function(from,to,amt){if(!amt||SPD()===0)return;const A=moneySpot(from),B=moneySpot(to);
  if(from!=='pot'&&from!=='bank')bigAmt(A,`-${fmt(amt)}`,'neg');
  const bills=Math.min(6,Math.floor(amt/100)),coins=Math.min(6,Math.floor(amt%100/10))||(bills?0:1),pieces=[...Array(bills).fill('💵'),...Array(coins).fill('🪙')];
  const a=rectMid(A),b=rectMid(B),dur=Math.round(750*Math.min(1,SPD()+.3));
  pieces.forEach((e,k)=>{const m=document.createElement('div');m.className='coinfx';m.textContent=e;document.body.appendChild(m);
    const lift=Math.min(160,Math.abs(a.x-b.x)*.25+60),mx=(a.x+b.x)/2+(Math.random()-.5)*40,my=Math.min(a.y,b.y)-lift;
    const kf=[{transform:`translate(${a.x}px,${a.y}px) scale(.6) rotate(0deg)`,opacity:0},{transform:`translate(${a.x}px,${a.y}px) scale(1)`,opacity:1,offset:.1},
      {transform:`translate(${mx}px,${my}px) scale(1.25) rotate(${(Math.random()-.5)*90}deg)`,opacity:1,offset:.55},{transform:`translate(${b.x}px,${b.y}px) scale(.8) rotate(0deg)`,opacity:.9}];
    const an=m.animate?m.animate(kf,{duration:dur,delay:k*70,easing:'cubic-bezier(.4,.1,.3,1)',fill:'both'}):null;setTimeout(()=>m.remove(),dur+k*70+60)});
  setTimeout(()=>{if(to!=='pot'&&to!=='bank')bigAmt(B,`+${fmt(amt)}`,'pos')},dur*.8+pieces.length*70)};
