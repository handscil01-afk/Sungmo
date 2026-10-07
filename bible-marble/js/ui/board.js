'use strict';
/* ================= 화면: 보드 · 상황판 · 가운데 ================= */
const UI={};
const PREF=Object.assign({sound:true,volume:.7,speed:'normal',autoFS:true,installHide:false,textScale:1,tokScale:1},store.get('prefs',{}));
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
/* 중계 모드 참가자 휴대폰: 게임판 대신 자기 상황판 중심 화면(대시보드)을 씁니다 */
const isDash=()=>Net.role==='client'&&Net.kind==='player'&&Net.mode==='relay'&&Net.mySeat!=null;

/* ---------- 보드 만들기 ---------- */
UI.buildBoard=function(){
  const g=VG(),b=$('#board');document.body.appendChild($('#toast'));b.innerHTML='';
  document.body.classList.toggle('dash',isDash());document.body.classList.toggle('display',Net.kind==='display');document.body.classList.toggle('remote',Net.kind==='remote');
  if(isDash())return UI.buildDash();$('#dash')?.remove();
  g.board.tiles.forEach((t,i)=>{
    const [r,c]=cellOf(i),s=sideOf(i),el=document.createElement('div');
    el.className=`tile t-${t.t} ${s}`+(s==='corner'?` c-${t.t}`:'');el.style.gridArea=`${r}/${c}`;el.dataset.i=i;el.tabIndex=0;el.setAttribute('role','button');
    if(t.t==='city')el.style.setProperty('--gc',GROUP_COLORS[t.g]);
    let h='';
    if(t.t==='city')h=`<i class="band"></i><span class="pic">${esc(t.pic)}</span><b class="nm">${esc(t.short||t.name)}</b><span class="pr"></span><span class="flag" hidden></span><span class="bld"></span>`;
    else if(t.t==='spot')h=`<span class="pic">${esc(t.pic)}</span><b class="nm">${esc(t.short||t.name)}</b><span class="pr"></span><span class="flag" hidden></span>`;
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
    el.classList.toggle('owned',!!o);const pr=$('.pr',el),fl=$('.flag',el),bd=$('.bld',el);
    if(o){const p=g.players.find(x=>x.id===o.o);el.style.setProperty('--oc',p.col);pr.textContent='통행 '+tollOfIn(g,i);fl.hidden=false;fl.textContent=p.tok;
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
      layer.insertAdjacentHTML('beforeend',`<span class="tok${p.id===hopId?' hop':''}${p.id===(g.players[g.turn]||{}).id&&!g.over?' now':''}" style="--pc:${p.col};left:${L.toFixed(1)}px;top:${T.toFixed(1)}px;width:${ts.toFixed(1)}px;height:${ts.toFixed(1)}px;font-size:${(ts*.62).toFixed(1)}px" title="${esc(p.name)}">${esc(p.tok)}</span>`)})}
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
    <div class="pc-top"><span class="tok">${esc(p.tok)}</span><div class="nmw"><div class="nm">${esc(p.name)}${me?' (나)':''}</div><div class="who">${whoT} · ${p.ai?'자동 주사위':p.dice==='real'?'🎲 실물 주사위':'화면 주사위'} ${conn}</div></div>${act?'<span class="turnb">차례</span>':''}</div>
    <div class="money">${p.out?'파산':fmt(p.money)}${p.out?'':'<small>달란트</small>'}</div>
    <div class="psub"><span>총자산 ${fmt(worthIn(g,p))}</span><span>땅 ${own.length}곳</span><span>건물 ${blds}단계</span></div>
    ${tags.length?`<div class="tags">${tags.join('')}</div>`:''}
    <div class="lands">${own.length?own.map(i=>{const t=g.board.tiles[i],o=g.own[i];return `<span class="ln" data-tile="${i}" role="button" tabindex="0" style="--gc:${t.t==='city'?GROUP_COLORS[t.g]:'#bfe3ff'}"><span class="bgp">${esc(t.pic)}</span><b>${t.t==='city'?BLD[o.l]:'🌊'} ${esc(t.name)}</b><span class="meta">${t.t==='city'?LV[o.l]:'명소'} · 통행 ${fmt(tollOfIn(g,i))}</span></span>`}).join(''):'<span class="none">아직 가진 땅이 없어요</span>'}</div></div>`}
UI.renderPlayers=function(){const g=VG();if(!g)return;const [L,R]=seatsOf(g.players.length);
  $('#pl').innerHTML=L.map(k=>cardHTML(g,g.players[k])).join('');$('#pr').innerHTML=R.map(k=>cardHTML(g,g.players[k])).join('');
  const wide=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pw'))>=290;$$('.pc').forEach(e=>e.classList.toggle('wide',wide))};
UI.renderCenter=function(){const g=VG();if(!g||!$('#cRnd'))return;const lim=g.cfg.rounds||MAX_ROUNDS;
  $('#cRnd').textContent=`${g.board.name} 판 · 라운드 ${Math.min(g.round,lim)} / ${lim}${Net.code?` · 방 ${Net.code}`:''}`;
  const p=g.players[g.turn];$('#cWho').innerHTML=g.over?'<span class="chip" style="--pc:var(--g7)">🏆 게임 끝</span>':`<span class="chip" style="--pc:${p.col}"><span class="tok">${esc(p.tok)}</span>${esc(p.name)}의 차례</span>`;
  $('#cPot').textContent=fmt(g.pot)};
UI.renderLog=function(){const g=VG(),el=$('#cLog');if(!g||!el)return;el.innerHTML=g.log.slice(0,3).map(e=>`<li style="${e.c?'--pc:'+e.c:''}"><i></i><span>${esc(e.m)}</span></li>`).join('')};
UI.render=function(){if(!VG())return;if($('#dash')){UI.renderDash();UI.updateHeader();return}if(!$('#board .tile'))return;UI.renderTiles();UI.renderTokens();UI.renderPlayers();UI.renderCenter();UI.renderLog();UI.updateHeader();Net.pushState()};
UI.setMsg=h=>{const m=$('#cMsg');if(m)m.innerHTML=h};

/* ---------- 주사위 굴림: 상자 안에서 튕기며 구르는 가벼운 애니메이션 ---------- */
UI.rollDice=async function(a,b,anim){
  const d1=$('#d1'),d2=$('#d2');if(!d1)return;d1.classList.remove('dbl');d2.classList.remove('dbl');
  if(anim&&SPD()>0&&!reducedMotion()&&d1.animate){
    const tray=$('.tray'),tw=tray.clientWidth,th=tray.clientHeight,dur=Math.round(950*Math.min(1,SPD()+.25));
    const path=dir=>{const k=[];let rot=0;for(let s=0;s<5;s++){rot+=(140+Math.random()*160)*dir;k.push({transform:`translate(${(Math.random()-.5)*tw*.55}px,${-Math.random()*th*.9}px) rotate(${rot}deg)`,offset:s/5})}k.push({transform:'translate(0,0) rotate(0deg)',offset:1});return k};
    d1.animate(path(1),{duration:dur,easing:'cubic-bezier(.25,.7,.35,1)'});d2.animate(path(-1),{duration:dur,easing:'cubic-bezier(.25,.7,.35,1)'});
    const t0=performance.now();await new Promise(res=>{const f=()=>{if(performance.now()-t0>=dur-90)return res();drawDie(d1,1+(Math.random()*6|0));drawDie(d2,1+(Math.random()*6|0));setTimeout(f,75)};f()})}
  drawDie(d1,a);drawDie(d2,b);if(a===b){d1.classList.add('dbl');d2.classList.add('dbl')}};

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
document.addEventListener('pointerdown',()=>SND.init(),{passive:true});document.addEventListener('keydown',()=>SND.init());

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
  const ln=e.target.closest('.ln[data-tile]');if(ln){onTileClick(+ln.dataset.tile);return}
  const tg=e.target.closest('.tag[data-tip]');if(tg){const t=TIPS[tg.dataset.tip];if(t)openInfo('상황판',t[0],`<p>${esc(t[1])}</p>${refHTML(t[2])}`,'var(--g7)');return}
  const ot=e.target.closest('[data-see]');if(ot){UI.dashSee=+ot.dataset.see;UI.renderDash();return}});
document.addEventListener('keydown',e=>{if(e.key!=='Enter')return;const ln=e.target.closest&&e.target.closest('.ln[data-tile]');if(ln)onTileClick(+ln.dataset.tile)});

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
  $('#dlist',d).innerHTML=g.players.filter(p=>p!==me).map(p=>`<button class="dp${p===see?' on':''}${p===me?' me':''}${p.out?' out':''}" data-see="${p.id}" style="--pc:${p.col}"><span class="tok" style="--pc:${p.col}">${esc(p.tok)}</span><span class="nm">${esc(p.name)}${p===me?' (나)':''}</span><span class="mo">💰 ${p.out?'파산':fmt(p.money)}</span>${p.id===g.players[g.turn].id&&!g.over?'<i class="tb">차례</i>':''}</button>`).join('');
  const back=see&&me&&see!==me?`<button class="btn sm wide back" data-see="${me.id}">↩️ 내 상황판으로 돌아가기</button>`:'';
  const pos=see?g.board.tiles[see.pos]:null;
  $('#dcard',d).innerHTML=see?`${back}${cardHTML(g,see)}<div class="dpos" data-tile-pos="${see.pos}">📍 지금 위치: <b>${esc(pos.pic)} ${esc(pos.name)}</b></div>`:'<p class="muted">상황판을 불러오는 중…</p>';
  $$('.pc',d).forEach(e=>e.classList.add('wide'));
  const dp=$('[data-tile-pos]',d);if(dp)dp.onclick=()=>onTileClick(+dp.dataset.tilePos);
  const lim=g.cfg.rounds||MAX_ROUNDS,tp=g.players[g.turn];
  $('.dtop .room',d).textContent=`📱 방 ${Net.code||''} · 라운드 ${Math.min(g.round,lim)}/${lim} · ${g.over?'게임 끝':tp.name+'의 차례'}`};
