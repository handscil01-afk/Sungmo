'use strict';
/* ================= 화면: 추가 기능 =================
   시간 제한 시계 · 주사위 화면의 거래/인물 카드 단추 · 땅 거래 창 · 인물 카드 모음 · 즉석 문제(입력·채점) · 암송 구절 넣기
   · 승리 연출(폭죽·시상대) · 결과 이미지 · 명예의 전당 */

/* ---------- 시간 제한 시계 ---------- */
const mmss=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`};
const clockText=g=>{const l=clockLeft(g);return l==null?'':g.lastRound?'⏱ 마지막 라운드':`⏱ ${mmss(l)} 남음`};
function addClock(el,g){if(!el||clockLeft(g)==null)return;const s=document.createElement('span');s.className='clk';s.textContent=' · '+clockText(g);el.appendChild(s)}
setInterval(()=>{const g=VG();if(!g||!(g.cfg.timeLimit>0))return;const l=clockLeft(g);
  $$('.clk').forEach(el=>{el.textContent=' · '+clockText(g);el.classList.toggle('hurry',l<=60000)})},1000);

/* ---------- 주사위 화면: 땅 거래 · 인물 카드 ---------- */
function actsHTML(spec){const a=spec.acts||[];if(!a.length)return '';
  return `<div class="racts">${a.map(x=>{if(x==='trade')return '<button class="btn" data-act="trade">🤝 땅 거래하기</button>';
    const c=charOf(x.slice(5));return c?`<button class="btn" data-act="${esc(x)}">${c.pic} ${esc(c.n)} 카드 · ${esc(c.ab)}</button>`:''}).join('')}</div>`}
function bindActs(spec,box){$$('[data-act]',box).forEach(b=>b.onclick=()=>{$$('[data-act],#rollBtn',box).forEach(x=>x.disabled=true);answer(spec,{act:b.dataset.act})})}

/* ---------- 땅 거래 ---------- */
const landsIn=(g,id)=>Object.entries(g.own).filter(([,o])=>o.o===id).map(([i])=>+i).sort((a,b)=>a-b);
const worthTile=(g,i)=>{const t=g.board.tiles[i],o=g.own[i];return t.price+(t.t==='city'&&o?o.l*r10(t.price*.5):0)};
function tradeCard(g,i,on,side){const t=g.board.tiles[i],o=g.own[i]||{l:0};
  return `<button type="button" class="sellc tcard${on?' on':''}" ${side?`data-${side}="${i}"`:'disabled'} style="--gc:${t.t==='city'?GROUP_COLORS[t.g]:'#86d5ea'}"><span class="sb"></span><span class="spic">${esc(t.pic)}</span><b>${esc(t.short||t.name)}</b><span class="slv">${t.t==='city'?`${BLD[o.l]} ${LV[o.l]}`:'🌊 명소'}</span><span class="sv">${fmt(worthTile(g,i))}</span>${on?'<span class="sok">✔ 골랐어요</span>':''}</button>`}
function showTrade(spec){const g=VG(),p=pOf(spec),others=g.players.filter(q=>q.id!==p.id&&!q.out);
  const st={to:others.length===1?others[0].id:null,give:new Set(),get:new Set(),amt:0,dir:1};
  const L=openLayer('prompt','',{tone:'#8fd3a8',wide:true});
  const draw=()=>{const q=g.players.find(x=>x.id===st.to),max=q?(st.dir>0?p.money:q.money):0;st.amt=Math.max(0,Math.min(st.amt,Math.floor(max/10)*10));
    let h=`<div class="mtop"><span class="sp"></span>${undoBtn()}</div><div class="kick">🤝 땅 거래 · ${esc(p.name)}의 차례</div><h3>${q?`${esc(q.name)}님에게 보낼 제안`:'누구와 거래할까요?'}</h3>
      <div class="tpick">${others.map(x=>`<button type="button" class="btn${x.id===st.to?' main':''}" data-to="${x.id}" style="box-shadow:inset 0 0 0 3px ${x.col},0 3px 0 var(--line)"><span class="tok sm" style="--pc:${x.col}">${tokIn(x.tok)}</span> ${esc(x.name)}</button>`).join('')}</div>`;
    if(q){const gv=[...st.give].reduce((s,i)=>s+worthTile(g,i),0),rv=[...st.get].reduce((s,i)=>s+worthTile(g,i),0);
      h+=`<div class="tcols"><div><b class="cute">내가 줄 땅</b><div class="sellgrid">${landsIn(g,p.id).map(i=>tradeCard(g,i,st.give.has(i),'give')).join('')||'<span class="none">가진 땅이 없어요</span>'}</div></div>
        <div><b class="cute">받고 싶은 땅 · ${esc(q.name)}</b><div class="sellgrid">${landsIn(g,q.id).map(i=>tradeCard(g,i,st.get.has(i),'get')).join('')||'<span class="none">가진 땅이 없어요</span>'}</div></div></div>
        <div class="tmoney"><div class="seg" id="tdir"><button type="button" data-dir="1" class="${st.dir>0?'on':''}">달란트를 더 주기</button><button type="button" data-dir="-1" class="${st.dir<0?'on':''}">달란트를 더 받기</button></div>
        <div class="tstep"><button type="button" class="btn sm" data-dv="-100">−100</button><button type="button" class="btn sm" data-dv="-10">−10</button><b>${fmt(st.amt)}</b><button type="button" class="btn sm" data-dv="10">+10</button><button type="button" class="btn sm" data-dv="100">+100</button></div></div>
        <p class="ref">땅값 합계(건물 포함): 주는 땅 <b>${fmt(gv)}</b> · 받는 땅 <b>${fmt(rv)}</b> · 상대가 받아들이면 바로 바뀌어요.</p>`}
    h+=`<div class="mbtns row"><button class="btn wide" data-tc>그만두기</button><button class="btn main wide" data-ts ${q&&(st.give.size||st.get.size||st.amt)?'':'disabled'}>📨 제안 보내기</button></div>`;
    L.box.innerHTML=h;bindUndo(L.box);
    $$('[data-to]',L.box).forEach(b=>b.onclick=()=>{st.to=+b.dataset.to;st.give.clear();st.get.clear();st.amt=0;draw()});
    $$('[data-give]',L.box).forEach(b=>b.onclick=()=>{const i=+b.dataset.give;st.give.has(i)?st.give.delete(i):st.give.add(i);draw()});
    $$('[data-get]',L.box).forEach(b=>b.onclick=()=>{const i=+b.dataset.get;st.get.has(i)?st.get.delete(i):st.get.add(i);draw()});
    $$('[data-dir]',L.box).forEach(b=>b.onclick=()=>{st.dir=+b.dataset.dir;draw()});
    $$('[data-dv]',L.box).forEach(b=>b.onclick=()=>{st.amt+=+b.dataset.dv;draw()});
    $('[data-tc]',L.box).onclick=()=>{$$('button',L.box).forEach(x=>x.disabled=true);answer(spec,null)};
    $('[data-ts]',L.box).onclick=()=>{$$('button',L.box).forEach(x=>x.disabled=true);answer(spec,{to:st.to,give:[...st.give],get:[...st.get],pay:st.dir*st.amt})}};
  draw()}
function tradeSummary(g,spec,forTo){const p=g.players.find(x=>x.id===spec.from),cards=a=>a.length?`<div class="sellgrid">${a.map(i=>tradeCard(g,i,false,'')).join('')}</div>`:'<span class="none">없음</span>';
  const pay=spec.pay;return `<div class="tcols"><div><b class="cute">${forTo?'내가 받을 땅':`${esc(p.name)}님이 줄 땅`}</b>${cards(spec.give)}</div><div><b class="cute">${forTo?'내가 줄 땅':'받고 싶은 땅'}</b>${cards(spec.get)}</div></div>
    ${pay?`<p class="tpay">💰 ${forTo?(pay>0?`<b>${fmt(pay)}</b> 달란트를 받아요`:`<b>${fmt(-pay)}</b> 달란트를 줘요`):(pay>0?`${esc(p.name)}님이 ${fmt(pay)} 달란트를 더 줘요`:`${esc(p.name)}님이 ${fmt(-pay)} 달란트를 더 받아요`)}</p>`:''}`}
function showTradeOk(spec){const g=VG(),q=pOf(spec),p=g.players.find(x=>x.id===spec.from);
  const {box}=openLayer('prompt',`<div class="kick">🤝 땅 거래 제안</div><h3>${esc(p.name)}님이 거래를 제안했어요</h3><div class="mbody">${tradeSummary(g,spec,true)}${remoteNote(spec)}</div>
    <div class="mbtns row"><button class="btn bad wide" data-k="0">❌ 거절하기</button><button class="btn good wide" data-k="1">✅ 받아들이기</button></div>`,{tone:'#8fd3a8',wide:true});
  $$('[data-k]',box).forEach(b=>b.onclick=()=>{$$('[data-k]',box).forEach(x=>x.disabled=true);answer(spec,b.dataset.k==='1')});focusFirst(box)}
/* 거래 제안을 기다리는 동안 다른 기기에도 내용을 보여 줍니다 */
function watchTrade(spec){const g=VG(),q=pOf(spec),p=g.players.find(x=>x.id===spec.from);if(!p||!q)return watchMsg(spec);
  UI.setMsg(`🤝 <b>${esc(p.name)}</b> → <b>${esc(q.name)}</b>: 거래 제안을 기다리는 중…`)}

/* ---------- 인물 카드 ---------- */
function showCharUse(spec){const g=VG(),c=charOf(spec.c),t=g.board.tiles[spec.tile];
  const {box}=openLayer('prompt',`<div class="mtop"><span class="sp"></span>${undoBtn()}</div><div class="bigpic">${c.pic}</div><div class="kick">🃏 성경 인물 카드 · ${esc(t.name)}</div><h3>${esc(c.n)} 카드를 쓸까요?</h3>
    <div class="mbody"><p>통행료 <b>${fmt(spec.amt)}</b>을 내지 않아요. 카드는 한 번만 쓸 수 있어요.</p>${refHTML(c.ref)}${remoteNote(spec)}</div>
    <div class="mbtns row"><button class="btn wide" data-k="0">아끼기</button><button class="btn main wide" data-k="1">${c.pic} 카드 쓰기</button></div>`,{tone:'#c9a6ff'});
  bindUndo(box);$$('[data-k]',box).forEach(b=>b.onclick=()=>{$$('[data-k]',box).forEach(x=>x.disabled=true);answer(spec,b.dataset.k==='1')});focusFirst(box)}
function openChars(pid){const g=VG(),p=g&&g.players.find(x=>x.id===pid);if(!p)return;const have=p.chars||{};
  openInfo('🃏 성경 인물 카드',`${p.name}의 인물 카드 ${Object.keys(have).length} / ${CHARS.length}`,`<div class="chargrid">${CHARS.map(c=>{const h=c.id in have,used=have[c.id]===1;
    return `<div class="charc${h?'':' no'}${used?' used':''}"><span class="cpic">${h?c.pic:'❔'}</span><b>${h?esc(c.n):'아직 없음'}</b><small>${h?esc(c.ab):''}</small>${used?'<em>썼어요</em>':''}</div>`}).join('')}</div>
    <p class="ref">퀴즈·암송 미션을 맞히거나 헌금함 칸에 가면 받아요. 여섯 명을 모두 모으면 ${fmt(CHAR_SET_BONUS)} 달란트를 받아요.</p>`,'#c9a6ff')}

/* ---------- 진행자 즉석 문제 ---------- */
const hqCan=()=>{const g=VG();if(!g||g.over||g.cfg.hostQ===false)return false;return Net.role==='client'?Net.kind==='remote':MODE()!=='player'};
const HostQ={open(){if(!hqCan())return UI.toast('지금은 즉석 문제를 낼 수 없어요');
  const st={t:'mc',target:'turn',prize:100,a:0};
  const L=openLayer('edit',`<div class="kick">🎤 진행자 즉석 문제</div><h3>문제를 입력해 주세요</h3><div class="mbody hqf">
    <textarea class="inp" id="hqq" maxlength="200" rows="3" placeholder="예: 오늘 설교 본문에서 예수님이 고친 사람은 누구였나요?"></textarea>
    <div class="seg" id="hqt"><button type="button" data-v="mc" class="on">객관식</button><button type="button" data-v="sa">주관식</button></div>
    <div id="hqmc">${[0,1,2,3].map(k=>`<label class="hqc"><button type="button" class="hqa${k===0?' on':''}" data-a="${k}" aria-label="${k+1}번을 정답으로">${k+1}</button><input class="inp" data-c="${k}" maxlength="40" placeholder="${k+1}번 보기${k>1?' (없어도 돼요)':''}"></label>`).join('')}<small>정답 번호를 눌러 주세요.</small></div>
    <div id="hqsa" hidden><input class="inp" id="hqs" maxlength="40" placeholder="정답 (진행자 화면에만 보여요)"></div>
    <b class="cute">누구에게 낼까요?</b><div class="seg" id="hqg"><button type="button" data-v="turn" class="on">다음 차례 사람</button><button type="button" data-v="all">모두에게</button></div>
    <b class="cute">상금</b><div class="seg" id="hqp">${[50,100,200,300].map(v=>`<button type="button" data-v="${v}" class="${v===100?'on':''}">${v}</button>`).join('')}</div>
    <p class="ref">문제는 다음 차례가 시작될 때 나와요. 모두에게 낸 객관식은 각자 답을 고르고, 주관식은 진행자가 맞힌 사람을 골라요.</p></div>
    <div class="mbtns row"><button class="btn wide" data-c>취소</button><button class="btn main wide" data-ok>🎤 문제 내기</button></div>`,{tone:'#ffcf8a',wide:true,close:true});
  const box=L.box,seg=(id,f)=>$$(`#${id} button`,box).forEach(b=>b.onclick=()=>{$$(`#${id} button`,box).forEach(x=>x.classList.toggle('on',x===b));f(b.dataset.v)});
  seg('hqt',v=>{st.t=v;$('#hqmc',box).hidden=v!=='mc';$('#hqsa',box).hidden=v!=='sa'});seg('hqg',v=>st.target=v);seg('hqp',v=>st.prize=+v);
  $$('.hqa',box).forEach(b=>b.onclick=()=>{st.a=+b.dataset.a;$$('.hqa',box).forEach(x=>x.classList.toggle('on',x===b))});
  $('[data-c]',box).onclick=L.close;setTimeout(()=>$('#hqq',box).focus(),60);
  $('[data-ok]',box).onclick=()=>{const raw=$$('[data-c]',box).filter(x=>x.tagName==='INPUT').map(x=>x.value.trim());
    if(!$('#hqq',box).value.trim())return UI.toast('문제를 입력해 주세요');
    const q={t:st.t,q:$('#hqq',box).value,target:st.target,prize:st.prize};
    if(st.t==='mc'){if(!raw[st.a])return UI.toast('정답으로 고른 번호의 보기를 채워 주세요');const c=[],a=raw.slice(0,st.a).filter(Boolean).length;raw.forEach(x=>{if(x)c.push(x)});
      if(c.length<2)return UI.toast('보기를 두 개 이상 넣어 주세요');if(new Set(c).size!==c.length)return UI.toast('같은 보기가 있어요');q.c=c;q.a=a}
    else{q.a=$('#hqs',box).value;if(!q.a.trim())return UI.toast('정답을 입력해 주세요')}
    if(!hqClean(q))return UI.toast('입력한 내용을 다시 확인해 주세요');
    if(Net.role==='client'){Net.cmd({c:'hq',q});UI.toast('🎤 즉석 문제를 보냈어요. 다음 차례가 시작될 때 나와요')}else if(!queueHQ(q))return UI.toast('지금은 즉석 문제를 낼 수 없어요');
    L.close();closeLayer('info')}}};
/* 주관식 · 모두에게: 진행자가 맞힌 사람을 고릅니다 */
function showQmark(spec,act){const g=VG(),q=spec.quiz.q,sel=new Set();
  if(!act){UI.setMsg(`🎤 즉석 문제: <b>${esc(q.q)}</b> · 진행자가 맞힌 사람을 고르는 중이에요`);
    openLayer('prompt',`<div class="kick">🎤 진행자 즉석 문제 · 모두에게</div><p class="qtext">${esc(q.q)}</p><div class="watch">모두 답을 말하거나 적어 보세요. 진행자가 맞힌 사람을 골라요.</div>`,{tone:'#ffcf8a',wide:true});return}
  const L=openLayer('prompt','',{tone:'#ffcf8a',wide:true});
  const draw=()=>{L.box.innerHTML=`<div class="mtop"><span class="sp"></span>${undoBtn()}</div><div class="kick">🎤 진행자 즉석 문제 · 모두에게 · 상금 ${fmt(spec.prize)}</div><p class="qtext">${esc(q.q)}</p>
      ${spec.secret?(Net.kind==='remote'||!Net.role||Net.hostSeesAnswers()?`<div class="rans"><span>정답 (진행자 화면에만 보여요)</span><b>${esc(spec.secret.a)}</b></div>`:`<details class="secret"><summary class="cute">👀 정답 보기 (진행자용)</summary><div class="ans">${esc(spec.secret.a)}</div></details>`):''}
      <b class="cute">맞힌 사람을 모두 눌러 주세요</b><div class="tpick">${spec.cands.map(id=>{const p=g.players.find(x=>x.id===id);return `<button type="button" class="btn${sel.has(id)?' good':''}" data-m="${id}">${sel.has(id)?'⭕':'⬜'} ${tokIn(p.tok)} ${esc(p.name)}</button>`}).join('')}</div>
      <div class="mbtns"><button class="btn main wide" data-ok>${sel.size?`${sel.size}명 정답으로 확정`:'맞힌 사람 없음으로 확정'}</button></div>`;
    bindUndo(L.box);$$('[data-m]',L.box).forEach(b=>b.onclick=()=>{const id=+b.dataset.m;sel.has(id)?sel.delete(id):sel.add(id);draw()});
    $('[data-ok]',L.box).onclick=()=>{$$('button',L.box).forEach(x=>x.disabled=true);answer(spec,[...sel])}};
  draw()}

/* ---------- 암송 구절 직접 넣기 ---------- */
const MemoEdit={async open(){const list=store.get('memo.verses',[])||[];let info=null;try{info=await Bible.info()}catch(e){}
  const L=openLayer('edit',`<div class="kick">📜 말씀 암송 미션</div><h3>암송할 구절</h3><div class="mbody">
    <p>${info?`불러온 성경 본문(${esc(info.name||'')})에서 잘 알려진 구절 ${MEMO_REFS.length}개를 함께 써요.`:'성경 본문을 불러오지 않았어요. 콘텐츠 관리 → 성경 본문에서 불러오거나, 아래에 직접 구절을 넣어 주세요.'}</p>
    <p class="ref">한 줄에 한 구절씩 "주소 | 본문"으로 적어요. 예: 요 3:16 | 하나님이 세상을 이처럼 사랑하사 … (이 기기에만 저장돼요)</p>
    <textarea class="inp" id="mev" rows="8" placeholder="시 23:1 | 여호와는 나의 목자시니 …">${esc(list.map(v=>v.ref?`${v.ref} | ${v.text}`:v.text).join('\n'))}</textarea></div>
    <div class="mbtns row"><button class="btn wide" data-c>취소</button><button class="btn main wide" data-ok>저장</button></div>`,{tone:'#ffcf8a',wide:true,close:true});
  $('[data-c]',L.box).onclick=L.close;
  $('[data-ok]',L.box).onclick=()=>{const out=[];for(const line of $('#mev',L.box).value.split(/\r?\n/)){const s=line.trim();if(!s)continue;
      const m=s.match(/^(.{2,20}?)\s*\|\s*(.+)$/);out.push(m?{ref:m[1].trim(),text:m[2].trim().slice(0,300)}:{ref:'',text:s.slice(0,300)});if(out.length>=200)break}
    store.set('memo.verses',out);UI.toast(`📜 암송 구절 ${out.length}개를 저장했어요`);L.close()}}};

/* ---------- 승리 연출 ---------- */
function podiumHTML(g,rank){return `<div class="podium">${[1,0,2].filter(k=>rank[k]).map(k=>{const p=rank[k];
  return `<div class="pod p${k+1}" style="--pc:${p.col}"><span class="tok">${tokIn(p.tok)}</span><b>${esc(p.name)}</b><small>${p.out?'파산':fmt(worthIn(g,p))}</small><div class="blk">${['🥇','🥈','🥉'][k]}</div></div>`}).join('')}</div>`}
function confetti(ms=4200){if(window.__SPD===0)return;const c=document.createElement('canvas');c.className='confetti';document.body.appendChild(c);
  const x=c.getContext('2d'),W=c.width=innerWidth*devicePixelRatio,H=c.height=innerHeight*devicePixelRatio,cols=['#f0506e','#3b8eea','#2fae5b','#ffcf3a','#9b5de5','#ff8a1f'];
  const ps=Array.from({length:160},()=>({x:Math.random()*W,y:-Math.random()*H*.6,vx:(Math.random()-.5)*3*devicePixelRatio,vy:(2+Math.random()*4)*devicePixelRatio,r:Math.random()*6,s:(5+Math.random()*7)*devicePixelRatio,c:cols[Math.random()*cols.length|0]}));
  const t0=performance.now();const step=t=>{x.clearRect(0,0,W,H);for(const p of ps){p.x+=p.vx;p.y+=p.vy;p.r+=.1;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);x.restore()}
    if(t-t0<ms)requestAnimationFrame(step);else c.remove()};requestAnimationFrame(step)}

/* ---------- 결과 이미지 ---------- */
const ResultImg={
  async make(g,rank){const W=1080,H=1350,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
    const gr=x.createLinearGradient(0,0,0,H);gr.addColorStop(0,'#fff4d6');gr.addColorStop(1,'#e8f4ff');x.fillStyle=gr;x.fillRect(0,0,W,H);
    const font=(s,w=800)=>`${w} ${s}px "Jua","Noto Sans KR",sans-serif`;x.textAlign='center';x.textBaseline='middle';
    x.fillStyle='#ff7a45';x.font=font(84);x.fillText('성경 부루마블',W/2,110);
    const d=new Date();x.fillStyle='#6b6585';x.font=font(36,600);
    const rounds=g.cfg.rounds>0?Math.min(g.round,g.cfg.rounds):g.round;
    x.fillText(`${g.board.name} 판 · ${rounds}라운드 · ${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()}`,W/2,180);
    /* 시상대 */
    x.fillStyle='#ff7a45';x.font=font(46);x.fillText(`🏆 ${rank[0].name} 우승!`,W/2,250);
    const BASE=900,pos=[[W/2,470],[W/2-300,560],[W/2+300,620]],imgs=await Promise.all(rank.slice(0,3).map(p=>this.tokImg(p.tok)));
    rank.slice(0,3).forEach((p,k)=>{const [cx,top]=pos[k];x.fillStyle=p.col;x.globalAlpha=.9;this.rr(x,cx-130,top+115,260,BASE-(top+115),28);x.fill();x.globalAlpha=1;
      x.fillStyle='#fff';x.font=font(80);x.fillText(String(k+1),cx,top+185);
      x.save();x.beginPath();x.arc(cx,top,95,0,Math.PI*2);x.fillStyle='#fff';x.fill();x.lineWidth=12;x.strokeStyle=p.col;x.stroke();x.clip();
      if(imgs[k])x.drawImage(imgs[k],cx-95,top-95,190,190);else{x.font=`110px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;x.fillStyle='#000';x.fillText(p.tok,cx,top+8)}x.restore();
      x.fillStyle='#2a2540';x.font=font(k?44:54);x.fillText(p.name.slice(0,8),cx,top-140);
      x.fillStyle='#fff';x.font=font(36,700);x.fillText(p.out?'파산':`${fmt(worthIn(g,p))}`,cx,top+250)});
    /* 순위표 */
    let y=975;x.textAlign='left';
    rank.forEach((p,k)=>{x.fillStyle='rgba(255,255,255,.85)';this.rr(x,90,y-50,W-180,96,24);x.fill();
      x.fillStyle=p.col;x.font=font(44);x.fillText(`${k+1}`,120,y);x.fillStyle='#2a2540';x.font=font(42,700);x.fillText(p.name.slice(0,10),190,y);
      x.textAlign='right';x.fillStyle='#6b6585';x.font=font(32,600);const s=(g.st&&g.st[p.id])||{ok:0};
      x.fillText(`${p.out?'파산':`총자산 ${fmt(worthIn(g,p))}`} · 땅 ${landsIn(g,p.id).length}곳 · 퀴즈 ${s.ok}개`,W-120,y);x.textAlign='left';y+=106});
    return c},
  rr(x,a,b,w,h,r){x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath()},
  tokImg(t){const s=photoSrc(t);if(!s)return Promise.resolve(null);return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=s})},
  async open(){const g=VG();if(!g)return;const rank=g.players.slice().sort((a,b)=>(a.out-b.out)||worthIn(g,b)-worthIn(g,a));
    const c=await this.make(g,rank),url=c.toDataURL('image/png');
    const L=openLayer('edit',`<div class="kick">📸 결과 이미지</div><img class="resimg" src="${url}" alt="게임 결과 이미지"><div class="mbtns row"><button class="btn wide" data-save>💾 저장하기</button><button class="btn main wide" data-share>📤 보내기</button></div>`,{tone:'var(--g7)',wide:true,close:true});
    const file=()=>new Promise(r=>c.toBlob(b=>r(new File([b],'bible-marble-result.png',{type:'image/png'})),'image/png'));
    $('[data-save]',L.box).onclick=()=>{const a=document.createElement('a');a.href=url;a.download='bible-marble-result.png';document.body.appendChild(a);a.click();a.remove()};
    $('[data-share]',L.box).onclick=async()=>{try{const f=await file();if(navigator.canShare&&navigator.canShare({files:[f]}))await navigator.share({files:[f],title:'성경 부루마블 결과'});
        else{UI.toast('이 기기에서는 바로 보내기를 쓸 수 없어서 이미지를 저장해요');$('[data-save]',L.box).click()}}catch(e){}}}};

/* ---------- 명예의 전당 ---------- */
const Hall={open(){const recs=store.get('records',[])||[],tab=this.tab||'rank';
    const by={};for(const r of recs)r.players.forEach((p,k)=>{if(p.ai)return;const o=by[p.name]=by[p.name]||{name:p.name,tok:p.tok,col:p.col,games:0,wins:0,best:0,ok:0,q:0};
      o.games++;if(k===0)o.wins++;o.best=Math.max(o.best,p.worth||0);o.ok+=p.ok||0;o.q+=p.q||0});
    const rows=Object.values(by).sort((a,b)=>b.wins-a.wins||b.best-a.best);
    const quizKing=Object.values(by).sort((a,b)=>b.ok-a.ok)[0],rich=Object.values(by).sort((a,b)=>b.best-a.best)[0];
    const date=t=>{const d=new Date(t);return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
    const reasonKo={last:'한 명만 남음',time:'시간 끝',rounds:'라운드 끝'};
    const body=!recs.length?'<p>아직 끝난 게임 기록이 없어요. 게임을 끝까지 하면 여기에 모여요.</p>'
      :tab==='rank'?`<div class="hallhi">${quizKing&&quizKing.ok?`<div><span>📖 퀴즈왕</span><b>${esc(quizKing.name)}</b><small>${quizKing.ok}문제</small></div>`:''}${rich?`<div><span>💰 최고 자산</span><b>${esc(rich.name)}</b><small>${fmt(rich.best)}</small></div>`:''}<div><span>🎲 끝난 게임</span><b>${recs.length}판</b></div></div>
        <ol class="rank hall">${rows.map((o,k)=>`<li><span class="no">${['🥇','🥈','🥉'][k]||k+1}</span><span class="tok" style="--pc:${o.col}">${esc(o.tok)}</span><span class="who">${esc(o.name)}<small>${o.games}판 · 우승 ${o.wins}번 · 퀴즈 ${o.ok}/${o.q}</small></span><span class="amt">${fmt(o.best)}</span></li>`).join('')}</ol>`
      :`<ul class="recs">${recs.map(r=>`<li><div class="rh"><b>${date(r.t)}</b> · ${esc(r.board)} 판 · ${r.round}라운드 · ${reasonKo[r.reason]||''}</div><div class="rp">${r.players.map((p,k)=>`<span style="--pc:${p.col}">${['🥇','🥈','🥉'][k]||k+1} ${esc(p.tok)} ${esc(p.name)} ${p.out?'파산':fmt(p.worth)}</span>`).join('')}</div>${r.best?`<small>가장 비싼 땅: ${esc(r.best.name)} (${esc(r.best.owner)}, 통행료 ${fmt(r.best.toll)})</small>`:''}</li>`).join('')}</ul>`;
    const L=openLayer('edit',`<div class="kick">🏆 명예의 전당</div><h3>게임 기록</h3><div class="seg" id="hallTab"><button type="button" data-v="rank" class="${tab==='rank'?'on':''}">순위</button><button type="button" data-v="recent" class="${tab==='recent'?'on':''}">최근 게임</button></div>
      <div class="mbody hallbody">${body}<p class="ref">기록은 이 기기에만 저장돼요 (최근 60판).</p></div>
      <div class="mbtns row">${recs.length?'<button class="btn wide" data-del>🗑️ 기록 지우기</button>':''}<button class="btn main wide" data-c>닫기</button></div>`,{tone:'#ffcf3a',wide:true,close:true});
    $$('#hallTab button',L.box).forEach(b=>b.onclick=()=>{this.tab=b.dataset.v;this.open()});$('[data-c]',L.box).onclick=L.close;
    const del=$('[data-del]',L.box);if(del)del.onclick=()=>{const C=openLayer('edit',`<div class="bigpic">🗑️</div><h3>게임 기록을 모두 지울까요?</h3><div class="mbody"><p>지운 기록은 되돌릴 수 없어요.</p></div><div class="mbtns row"><button class="btn wide" data-n>취소</button><button class="btn bad wide" data-y>지우기</button></div>`,{tone:'#ff9d9d'});
      $('[data-n]',C.box).onclick=()=>this.open();$('[data-y]',C.box).onclick=()=>{store.del('records');UI.toast('게임 기록을 지웠어요');this.open()}}}};
