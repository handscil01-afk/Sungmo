'use strict';
/* ================= 게임 진행 엔진 =================
   진행 코드는 화면을 직접 만들지 않고 "누가 무엇을 골라야 하는지"를 요청서(ask)로 만듭니다.
   요청서에는 사람(이 기기 화면), 컴퓨터(ai.js), 멀티플레이 참가자(net.js)가 답합니다.
   차례마다 시작 상태와 모든 선택·무작위 값을 기록해서, 되돌리기를 누르면 마지막 선택만 빼고 다시 재생합니다. */
const ABORT={abort:true};
let G=null;                 // 게임 상태 (그대로 저장·전송할 수 있는 값만)
let RUN=0;                  // 진행 흐름 번호: 바뀌면 기다리던 흐름은 멈춥니다
let REPLAY=false;           // 되돌리기·이어하기 재생 중이면 애니메이션과 소리를 건너뜁니다
let PROMPT=null;            // 지금 기다리는 요청서
let PSEQ=0;
let RESUME=false;
const J={turns:[],cur:null,replay:null,reserve:[]};
const WAITS=new Set();
const MAX_ROUNDS=50;
const LV=['빈 땅','장막','집','성'], BLD=['🚩','⛺','🏠','🏰'], MULT=[.2,.6,1.4,3];
const QREWARD={easy:100,normal:150,hard:200};
const AIACC={easy:{easy:.6,normal:.45,hard:.3},normal:{easy:.85,normal:.7,hard:.5},hard:{easy:.95,normal:.9,hard:.8}};
const PALETTE=['#f0506e','#3b8eea','#2fae5b','#9b5de5','#ff8a1f','#e64fc6','#14a8a8','#8a5a2b','#d9a400','#5d6675'];
const PALETTE_KO=['빨강','파랑','초록','보라','주황','분홍','청록','갈색','노랑','회색'];
const SEAT=PALETTE.slice(0,4);
const TOKENS=['🐑','🕊️','🐟','🦁','🐪','🐴','😃','😎','🐯','🐻','🐼','🐰','🦊','🐸','🐵','🐶','🐱','🐧','🦄','🐢','🐳','🦋','🌟','🍎','🍇','🌻','🌈','⚽','🎈','👑','🎵','🚀','😊','🥰','🤩','🙏','🔥','💎','🌳','🍀','🐝','🦉','🐙','🐬'];
const DEF_NAMES=['베드로','요한','야고보','안드레'];
const DEF_CFG={diff:'easy',qmc:true,qsa:true,quizTime:0,tollQuiz:true,quizTile:true,jailQuiz:true,steal:false,aiQuiz:'manual',
  rounds:20,money:2000,salary:200,monopoly:true,doubleAgain:true,cards:true,jailTurns:3,ai:'normal',board:'both'};

function waitFor(setup){const id=RUN;return new Promise((res,rej)=>{const e={rej};WAITS.add(e);setup(v=>{if(!WAITS.has(e))return;WAITS.delete(e);id===RUN?res(v):rej(ABORT)})})}
function SPD(){return window.__SPD!=null?window.__SPD:({slow:1.6,normal:1,fast:.45}[PREF.speed]||1)}
async function sleep(ms){if(REPLAY)return;const id=RUN;await sleepRaw(ms*SPD());if(id!==RUN)throw ABORT}
function abortFlow(){RUN++;for(const e of WAITS)e.rej(ABORT);WAITS.clear();PROMPT=null;UI.clearPrompt();Net.prompt(null)}

/* ---------- 상태 도우미 ---------- */
const cur=()=>G.players[G.turn];
const byId=id=>G.players.find(p=>p.id===id);
const alive=()=>G.players.filter(p=>!p.out);
const T=i=>G.board.tiles[i];
const N=()=>G.board.tiles.length;
const roundLimit=()=>G.cfg.rounds||MAX_ROUNDS;
const spots=()=>G.board.tiles.map((t,i)=>t.t==='spot'?i:-1).filter(i=>i>=0);
const upCost=i=>r10(T(i).price*.5);
function hasGroup(pid,g){return G.board.tiles.every((t,i)=>t.t!=='city'||t.g!==g||(G.own[i]&&G.own[i].o===pid))}
function tollOf(i){const t=T(i),o=G.own[i];if(!o)return 0;
  if(t.t==='spot'){const s=spots();return s.length>1&&s.every(j=>G.own[j]&&G.own[j].o===o.o)?150:50}
  let v=r10(t.price*MULT[o.l]);if(G.cfg.monopoly&&hasGroup(o.o,t.g))v*=2;return v}
function worth(p){let v=p.money;for(const[i,o]of Object.entries(G.own))if(o.o===p.id)v+=T(+i).price+(T(+i).t==='city'?o.l*upCost(+i):0);return v}
function landsOf(p){return Object.entries(G.own).filter(([,o])=>o.o===p.id).map(([i])=>+i).sort((a,b)=>a-b)}
const aiReserve=()=>150+Math.min(250,G.round*12);
const findTile=to=>to==='@start'?0:to==='@fly'?G.board.tiles.findIndex(t=>t.t==='fly'):to==='@jail'?G.board.tiles.findIndex(t=>t.t==='jail'):G.board.tiles.findIndex(t=>t.name===to);

/* ---------- 기록·효과 (재생 중에는 소리·애니메이션 생략) ---------- */
function log(msg,p){G.log.unshift({m:msg,c:p?p.col:null});if(G.log.length>150)G.log.length=150;if(!REPLAY)UI.renderLog()}
const fx=f=>{if(!REPLAY)try{f()}catch(e){console.error(e)}};
function toast(msg){fx(()=>{UI.toast(msg);Net.event({t:'toast',m:msg})})}
function sfx(k){fx(()=>{UI.sfx(k);Net.event({t:'sfx',k})})}
function float(p,d){fx(()=>{UI.float(p.id,d);Net.event({t:'float',id:p.id,d})})}
function burst(i,label,color){fx(()=>{UI.burst(i,label,color);Net.event({t:'burst',i,label,color})})}
function setMsg(h){fx(()=>{UI.setMsg(h);Net.event({t:'msg',h})})}
function render(){if(!REPLAY)UI.render()}
function gain(p,v,why){if(v<=0)return;p.money+=v;float(p,v);sfx('coin');log(`${p.name}: ${why} +${fmt(v)}`,p);render()}

/* ---------- 선택 기록 ---------- */
function nextReplay(kind){
  if(J.replay&&J.replay.length){const s=J.replay.shift();
    if(s.k===kind){J.cur.steps.push(s);if(!J.replay.length)J.replay=null;return s}
    console.warn('재생 기록이 맞지 않아 여기서부터 새로 진행합니다',s.k,kind);J.replay=null}
  if(REPLAY){REPLAY=false;J.replay=null;UI.render()}
  return null}
/* 무작위 값: 되돌리기 뒤에도 같은 주사위·문제가 나오도록 남겨 둔 값을 먼저 씁니다 */
function rnd(kind,gen){const r=nextReplay(kind);if(r)return clone(r.v);
  let v;const i=J.reserve.findIndex(x=>x.k===kind);v=i>=0?J.reserve.splice(i,1)[0].v:gen();
  J.cur.steps.push({k:kind,v:clone(v),r:1});return v}
/* 요청서: 사람·컴퓨터·참가자 가운데 답할 사람이 답할 때까지 기다립니다 */
async function ask(spec){
  const r=nextReplay(spec.kind);if(r)return clone(r.v);
  spec.id=++PSEQ;PROMPT=spec;persist();
  const p=spec.pid!=null?byId(spec.pid):null,allAI=!G.players.some(q=>!q.ai);
  /* 컴퓨터가 답하는 요청서는 되돌리기 대상이 아닙니다 (되돌리기는 사람의 선택만 되돌립니다) */
  const byAI=(spec.who==='player'&&p&&p.ai)||(spec.who!=='player'&&allAI&&spec.kind!=='end');
  const v=await waitFor(done=>{spec.resolve=val=>{if(PROMPT===spec&&validate(spec,val))done(val)};
    if(byAI)AI.respond(spec).then(val=>spec.resolve(val)).catch(()=>{});
    UI.showPrompt(spec);Net.prompt(spec)});
  PROMPT=null;UI.clearPrompt();Net.prompt(null);
  J.cur.steps.push({k:spec.kind,v:clone(v),u:spec.undo&&!byAI?1:0});persist();
  return v}
function validate(spec,v){
  switch(spec.kind){
    case 'roll':return (v&&v.s===1)||(v&&Array.isArray(v.d)&&v.d.length===2&&v.d.every(x=>Number.isInteger(x)&&x>=1&&x<=6));
    case 'buy':case 'upgrade':case 'ark':case 'qj':return v===true||v===false;
    case 'wild':return (spec.opts||[]).includes(v);
    case 'fly':return Number.isInteger(v)&&v>=0&&v<N()&&T(v).t!=='fly';
    case 'qa':return spec.quiz.q.t==='mc'?(Number.isInteger(v)&&v>=-1&&v<spec.quiz.q.choices.length&&!(spec.quiz.tries||[]).some(t=>t.choice===v&&v>=0)):(v==='reveal'||v===-1);
    case 'qs':return v===-1||(spec.cands||[]).includes(v);
    case 'end':return v==='again'||v==='home';
    default:return true}}
function beginTurn(){J.cur={base:clone(G),steps:[]};J.turns.push(J.cur);while(J.turns.length>8)J.turns.shift()}
function canUndo(){return !!G&&J.turns.some(t=>t.steps.some(s=>s.u))}
/* 되돌리기: 가장 최근의 사람 선택 하나를 지우고 그 직전 상태로 다시 재생합니다 */
function undo(){
  if(!canUndo())return false;
  let ti=J.turns.length-1;while(ti>=0&&!J.turns[ti].steps.some(s=>s.u))ti--;
  const t=J.turns[ti];let si=t.steps.length-1;while(!t.steps[si].u)si--;
  const keep=t.steps.slice(0,si),reserve=[];
  for(let k=ti;k<J.turns.length;k++)for(const s of (k===ti?t.steps.slice(si+1):J.turns[k].steps))if(s.r)reserve.push({k:s.k,v:s.v});
  abortFlow();
  J.turns.length=ti;G=clone(t.base);J.cur={base:clone(t.base),steps:[]};J.turns.push(J.cur);
  J.reserve=reserve.concat(J.reserve);J.replay=keep.length?keep.slice():null;REPLAY=!!J.replay;RESUME=true;
  UI.toast('↶ 바로 전 선택으로 되돌렸어요');UI.render();gameLoop();return true}

/* ---------- 저장 ---------- */
let persistT=0;
function persist(){if(!G||REPLAY)return;clearTimeout(persistT);persistT=setTimeout(()=>{
  const data={G,J:{turns:J.turns.slice(-6),reserve:J.reserve},net:Net.saveInfo()};
  if(G.over&&!canUndo())store.del('save');else store.set('save',data)},120)}
function hasSave(){const s=store.get('save',null);return s&&s.G&&s.G.players&&!s.G.over?s:null}

/* ---------- 새 게임 ---------- */
function makeGame(setup){
  const cfg=Object.assign({},DEF_CFG,setup.cfg);
  const board=clone(Content.board(cfg.board));
  const ids=Content.cardAll().filter(c=>c.on&&eraFits(c.era,board.era)&&(c.fx.k!=='move_to'||findTileIn(board,c.fx.to)>=0));
  const cards=ids.length?ids:DEFAULT_CARDS.filter(c=>eraFits(c.era,board.era));
  return {v:3,cfg,board,cards:cards.map(c=>({id:c.id,t:c.t,r:c.r,d:c.d,fx:c.fx})),
    players:setup.players.map((p,k)=>({id:k,name:(p.name||'').trim()||DEF_NAMES[k],ai:!!p.ai,tok:p.emoji||TOKENS[k],col:p.color||SEAT[k],dice:p.dice==='real'?'real':'screen',
      net:p.net||null,money:cfg.money,pos:0,jail:0,skip:0,ark:0,song:0,out:false})),
    own:{},pot:0,turn:0,round:1,dbl:0,deck:[],used:{},log:[],over:false,started:Date.now()}}
function findTileIn(board,to){return to==='@start'?0:to==='@fly'?board.tiles.findIndex(t=>t.t==='fly'):to==='@jail'?board.tiles.findIndex(t=>t.t==='jail'):board.tiles.findIndex(t=>t.name===to)}
function startGame(setup){abortFlow();G=makeGame(setup);J.turns=[];J.cur=null;J.replay=null;J.reserve=[];REPLAY=false;RESUME=false;
  log(`새 게임을 시작했어요. ${G.board.name} 판 · ${G.board.tiles[0].name}에서 출발해요!`);UI.enterGame();gameLoop()}
function resumeGame(save){abortFlow();G=save.G;J.turns=save.J&&save.J.turns||[];J.reserve=save.J&&save.J.reserve||[];
  const t=J.turns.pop();
  if(t){J.cur={base:t.base,steps:[]};J.turns.push(J.cur);G=clone(t.base);J.replay=t.steps.length?t.steps.slice():null;REPLAY=!!J.replay;RESUME=true}
  else{J.cur=null;RESUME=false}
  UI.enterGame();gameLoop()}

/* ---------- 차례 진행 ---------- */
function nextPlayer(){const n=G.players.length;for(let k=0;k<n;k++){G.turn=(G.turn+1)%n;if(G.turn===0)G.round++;if(!G.players[G.turn].out)return}}
async function gameLoop(){
  const id=RUN;
  try{
    while(!G.over){
      const p=cur();
      if(p.out){nextPlayer();continue}
      if(G.round>roundLimit())break;
      if(RESUME)RESUME=false;else beginTurn();
      render();persist();
      await takeTurn(p);
      if(alive().length<=1)break;
      nextPlayer();
      if(G.round>roundLimit())break;
    }
    G.over=true;REPLAY=false;render();persist();sfx('good');
    const v=await ask({kind:'end',who:'any',undo:0});
    UI.afterEnd(v);
  }catch(e){if(e!==ABORT){console.error(e);if(id===RUN)UI.toast('문제가 생겨 게임을 멈췄어요. 되돌리기나 메뉴의 새 게임으로 이어 주세요.',5000)}}
}
async function takeTurn(p){
  G.dbl=0;render();
  if(p.skip){p.skip=0;log(`${p.name}: 안식일이라 한 번 쉽니다`,p);setMsg(`<b>${esc(p.name)}</b>, 이번 차례는 쉬어요.`);toast(`🕯️ ${IGA(p.name)} 안식일이라 쉬어요`);await sleep(1200);return}
  if(p.jail>0){const r=await wilderness(p);if(r!=='free')return}
  for(;;){
    const[a,b]=await rollDice(p),dbl=a===b&&G.cfg.doubleAgain;
    if(dbl&&++G.dbl>=3){await goJail(p,'더블을 세 번 연속으로 던졌어요');return}
    await moveBy(p,a+b);await land(p);
    if(!dbl||p.jail>0||p.out||p.skip||alive().length<2)return;
    toast('🎲 더블! 한 번 더 굴려요');setMsg(`<b>더블!</b> ${esc(p.name)}, 한 번 더 굴려요.`);
  }
}
async function rollDice(p,label){
  let v={s:1};
  if(p.ai){setMsg(`${esc(IGA(p.name))} 주사위를 굴려요…`);await sleep(750)}
  else v=await ask({kind:'roll',who:'player',pid:p.id,mode:p.dice,label:label||'',undo:p.dice==='real'?1:0});
  const real=Array.isArray(v.d),[a,b]=real?v.d:rnd('dice',()=>[1+(Math.random()*6|0),1+(Math.random()*6|0)]);
  if(!REPLAY){sfx('roll');Net.event({t:'dice',a,b,anim:!real});await UI.rollDice(a,b,!real)}
  setMsg(`<b>${a} + ${b} = ${a+b}</b>${a===b?' · 더블!':''}`);log(`${p.name}: 주사위 ${a}+${b}${a===b?' (더블)':''}${real?' · 실물':''}`,p);
  await sleep(300);return[a,b]}
function passStart(p){const v=G.cfg.salary;p.money+=v;float(p,v);sfx('coin');log(`${p.name}: 출발 칸을 지나 축복금 +${v}`,p);render()}
async function moveBy(p,n,salary=true){const dir=n<0?-1:1;
  for(let k=0;k<Math.abs(n);k++){p.pos=(p.pos+dir+N())%N();if(dir>0&&p.pos===0&&salary)passStart(p);
    fx(()=>{UI.moveToken(p.id);Net.event({t:'pos',id:p.id,pos:p.pos})});sfx('step');await sleep(170)}
  fx(()=>UI.pop(p.pos))}
async function moveTo(p,dest,salary){const steps=(dest-p.pos+N())%N();
  for(let k=0;k<steps;k++){p.pos=(p.pos+1)%N();if(p.pos===0&&salary)passStart(p);fx(()=>{UI.moveToken(p.id);Net.event({t:'pos',id:p.id,pos:p.pos})});await sleep(65)}
  fx(()=>UI.pop(p.pos))}
async function goJail(p,why){p.pos=G.board.tiles.findIndex(t=>t.t==='jail');p.jail=G.cfg.jailTurns;G.dbl=0;render();sfx('bad');log(`${p.name}: ${why} → ${G.board.tiles[p.pos].name}`,p);
  const t=T(p.pos);
  await notice(p,{pic:t.pic,kick:t.name,title:`${IGA(p.name)} ${t.name}에 들어갔어요`,body:`<p>${esc(why)}</p><p>다음 차례부터 최대 <b>${G.cfg.jailTurns}번</b> 머뭅니다. ${G.cfg.jailQuiz?'<b>말씀 퀴즈</b>를 맞히거나, ':''}<b>더블</b>이 나오거나, <b>헌금 100</b>을 내면 나올 수 있어요.</p>`,ref:t.ref||'민 14:33',tone:'#ffcf8a'})}
function notice(p,o){return ask(Object.assign({kind:'notice',who:'player',pid:p.id,undo:0},o))}

/* ---------- 돈 ---------- */
async function charge(p,amt,to,why){
  if(amt<=0)return true;
  if(p.money<amt)await liquidate(p,amt);
  const toP=to&&typeof to==='object',toName=toP?to.name:to==='pot'?'헌금함':'은행';
  if(p.money<amt){const rest=p.money;p.money=0;if(toP){to.money+=rest;float(to,rest)}else if(to==='pot')G.pot+=rest;
    log(`${p.name}: ${why} ${fmt(amt)}을 다 내지 못했어요`,p);await bankrupt(p,toP?to:null);return false}
  p.money-=amt;float(p,-amt);if(toP){to.money+=amt;float(to,amt)}else if(to==='pot')G.pot+=amt;
  sfx('pay');log(`${p.name} → ${toName}: ${why} ${fmt(amt)}`,p);render();return true}
async function liquidate(p,need){const sold=[];
  while(p.money<need){const bs=landsOf(p).filter(i=>G.own[i].l>0).sort((a,b)=>upCost(a)-upCost(b));if(!bs.length)break;
    const i=bs[0],v=r10(upCost(i)/2);G.own[i].l--;p.money+=v;sold.push(`${T(i).name} ${LV[G.own[i].l+1]} (+${v})`)}
  while(p.money<need){const ls=landsOf(p).sort((a,b)=>T(a).price-T(b).price);if(!ls.length)break;
    const i=ls[0],v=r10(T(i).price/2);delete G.own[i];p.money+=v;sold.push(`${T(i).name} 땅 (+${v})`)}
  if(!sold.length)return;log(`${p.name}: 빚을 갚으려고 ${sold.length}건을 반값에 팔았어요`,p);render();
  await notice(p,{pic:'💸',kick:'반값 매각',title:`${IGA(p.name)} 재산을 팔았어요`,body:`<p>달란트가 모자라서 건물과 땅을 <b>반값</b>에 팔았습니다.</p><p>${sold.map(esc).join('<br>')}</p>`,tone:'#ff9d9d'})}
async function bankrupt(p,creditor){p.out=true;p.money=0;for(const i of landsOf(p))delete G.own[i];sfx('bad');log(`${p.name}: 파산했어요`,p);render();
  await ask({kind:'notice',who:'any',pid:p.id,undo:0,pic:'😭',kick:'파산',title:`${IGA(p.name)} 파산했어요`,body:`<p>${creditor?esc(creditor.name)+'에게 남은 달란트를 모두 주고, ':''}가진 땅은 모두 주인 없는 땅이 되었습니다.</p>`,tone:'#ff9d9d'})}

/* ---------- 칸에 도착 ---------- */
async function land(p){
  if(p.out)return;const i=p.pos,t=T(i);render();
  switch(t.t){
    case 'start':break;
    case 'city':case 'spot':await onProperty(p,i);break;
    case 'card':if(G.cfg.cards)await drawCard(p);else{toast('말씀 카드를 끈 상태라 쉬어 가요');log(`${p.name}: 카드 칸에서 쉬어 가요`,p)}break;
    case 'quiz':
      if(G.cfg.quizTile){setMsg('❓ 말씀 퀴즈 칸!');const r=await quizFlow(p,'tile',{kick:'❓ 말씀 퀴즈 칸'});
        if(r.by!=null){const base=r.rw||QREWARD[r.lv],w=byId(r.by);gain(w,r.by===p.id?base:r10(base/2),r.by===p.id?'말씀 퀴즈 정답':'다른 팀 기회 정답 (상금 절반)')}}
      else gain(p,100,'말씀 묵상');
      break;
    case 'jail':await goJail(p,`${t.name} 칸에 도착했어요`);break;
    case 'pot':if(G.pot>0){const v=G.pot;G.pot=0;gain(p,v,`${t.name} 헌금함`);
        await notice(p,{pic:t.pic,kick:t.name,title:`헌금함의 ${fmt(v)} 달란트를 받았어요`,body:t.note?`<p>${esc(t.note)}</p>`:'',ref:t.ref,tone:'var(--g7)'})}
      else{toast('헌금함이 비어 있어요');log(`${p.name}: 헌금함이 비어 있어요`,p)}break;
    case 'fly':await fly(p);break;
    case 'tithe':{const v=Math.max(10,r10(p.money*.1));setMsg(`🪙 십일조 ${fmt(v)} 달란트`);await charge(p,v,'pot','십일조');if(!p.out)toast(`${IGA(p.name)} 십일조 ${fmt(v)}을 헌금함에 넣었어요`);break}
    case 'event':await notice(p,{pic:t.pic,kick:'이벤트',title:t.name,body:`<p>${esc(t.note||fxText(t.fx))}</p>`,ref:t.ref,tone:'var(--g5)'});await runFx(p,t.fx||{k:'none'},t.name);break;
  }
  render()}
async function onProperty(p,i){
  const t=T(i),o=G.own[i],grp=t.t==='city'?G.board.groups[t.g]:'명소',tone=t.t==='city'?GROUP_COLORS[t.g]:'#86d5ea';
  if(!o){
    if(p.money<t.price){toast(`${REUL(t.name)} 살 달란트가 모자라요`);log(`${p.name}: ${t.name} 살 달란트가 모자라요`,p);return}
    const buy=await ask({kind:'buy',who:'player',pid:p.id,tile:i,undo:1,tone});
    if(buy){p.money-=t.price;G.own[i]={o:p.id,l:0};float(p,-t.price);sfx('build');log(`${p.name}: ${REUL(t.name)} ${t.price}에 샀어요 🚩`,p);render();burst(i,`${p.tok} 🚩 구매!`,p.col);toast(`${p.tok} ${IGA(p.name)} ${REUL(t.name)} 샀어요!`)}
    return}
  if(o.o===p.id){
    if(t.t!=='city'||o.l>=3){toast(`내 땅 ${t.name}에 도착했어요`);return}
    const c=upCost(i);if(p.money<c){toast(`${LV[o.l+1]}을 지을 달란트가 모자라요`);return}
    const up=await ask({kind:'upgrade',who:'player',pid:p.id,tile:i,undo:1,tone});
    if(up){p.money-=c;o.l++;float(p,-c);sfx('build');log(`${p.name}: ${t.name}에 ${REUL(LV[o.l])} 지었어요 ${BLD[o.l]}`,p);render();burst(i,`${BLD[o.l]} ${LV[o.l]} 완성!`,p.col);toast(`${BLD[o.l]} ${IGA(p.name)} ${t.name}에 ${REUL(LV[o.l])} 지었어요!`)}
    return}
  const owner=byId(o.o);let amt=tollOf(i);
  setMsg(`<b>${esc(owner.name)}</b>의 ${esc(t.name)} · 통행료 ${fmt(amt)}`);
  if(p.ark>0){const use=await ask({kind:'ark',who:'player',pid:p.id,tile:i,amt,undo:1});
    if(use){p.ark--;sfx('card');log(`${p.name}: 방주 카드로 ${t.name} 통행료를 면제받았어요`,p);toast(`🚢 ${IGA(p.name)} 방주 카드를 썼어요`);render();return}}
  if(G.cfg.tollQuiz){const r=await quizFlow(p,'toll',{kick:`💡 말씀 찬스 · ${esc(owner.name)}의 ${esc(t.name)}`,sub:`맞히면 통행료 <b>${fmt(amt)}</b> → <b>${fmt(r10(amt/2))}</b>`});if(r.ok)amt=r10(amt/2)}
  await charge(p,amt,owner,`${t.name} 통행료`);
  if(!p.out)toast(`${IGA(p.name)} ${owner.name}에게 통행료 ${fmt(amt)}을 냈어요`)}
async function drawCard(p){
  if(!G.deck.length)G.deck=rnd('deck',()=>shuffle(G.cards.map(c=>c.id)));
  const id=G.deck.pop(),c=G.cards.find(x=>x.id===id)||G.cards[0];sfx('card');log(`${p.name}: 말씀 카드 「${c.t}」`,p);
  await notice(p,{kind:'card',pic:'📜',kick:'말씀 카드',tone:'var(--g7)',title:c.t,body:`<p>${esc(c.d)}</p>`,ref:c.r,autoMs:2600});
  await runFx(p,c.fx,c.t);render()}
async function runFx(p,f,why){
  switch(f.k){
    case 'gain':gain(p,f.n,why);break;
    case 'talent':gain(p,Math.min(f.max||300,r10(p.money*(f.n||10)/100)),why);break;
    case 'pay_pot':await charge(p,f.n,'pot',why);break;
    case 'pay_bank':await charge(p,f.n,null,why);break;
    case 'move_to':{const d=findTile(f.to);if(d<0){toast(`이 판에는 ${f.to} 칸이 없어요`);break}await moveTo(p,d,true);await land(p);break}
    case 'move_by':await moveBy(p,f.n,f.n>0);await land(p);break;
    case 'jail':await goJail(p,`말씀 카드: ${why}`);break;
    case 'ark':p.ark++;log(`${p.name}: 방주 카드를 얻었어요`,p);render();break;
    case 'song':p.song++;log(`${p.name}: 찬송 카드를 얻었어요`,p);render();break;
    case 'give_each':for(const q of alive().filter(q=>q!==p)){if(!await charge(p,f.n,q,why))break}break;
    case 'take_each':for(const q of alive().filter(q=>q!==p))await charge(q,f.n,p,why);break;
    case 'all_gain':for(const q of alive())gain(q,f.n,why);break;
    case 'give_poorest':{const q=alive().filter(q=>q!==p).sort((a,b)=>a.money-b.money)[0];if(q)await charge(p,f.n,q,why);break}
    case 'take_richest':{const q=alive().filter(q=>q!==p).sort((a,b)=>b.money-a.money)[0];if(q)await charge(q,f.n,p,why);break}
    case 'repair':{const n=landsOf(p).reduce((s,i)=>s+G.own[i].l,0);if(n)await charge(p,n*f.n,'pot',why);else log(`${p.name}: 고칠 건물이 없어요`,p);break}
    case 'skip':p.skip=1;render();break;
    case 'quiz_bonus':{const r=await quizFlow(p,'bonus',{kick:`📜 ${esc(why)} · 보너스 퀴즈`,sub:`맞히면 <b>${f.n}</b> 달란트`});
      if(r.by!=null)gain(byId(r.by),r.by===p.id?f.n:r10(f.n/2),r.by===p.id?'보너스 퀴즈 정답':'다른 팀 기회 정답 (상금 절반)');break}
  }}
async function fly(p){
  const t=T(p.pos);
  const dest=await ask({kind:'fly',who:'player',pid:p.id,undo:1});
  log(`${p.name}: ${t.name}을 타고 ${RO(T(dest).name)}`,p);toast(`${t.pic} ${IGA(p.name)} ${RO(T(dest).name)} 날아가요`);
  await moveTo(p,dest,true);await land(p)}
async function wilderness(p){
  const t=T(p.pos);setMsg(`<b>${esc(p.name)}</b>, ${t.name}에 있어요 (남은 차례 ${p.jail})`);
  const opts=[...(G.cfg.jailQuiz?['quiz']:[]),'dice',...(p.song>0?['song']:[]),...(p.money>=100?['pay']:[])];
  const ch=await ask({kind:'wild',who:'player',pid:p.id,opts,undo:1});
  if(ch==='song'){p.song--;p.jail=0;sfx('card');log(`${p.name}: 찬송 카드로 ${t.name}을 벗어났어요`,p);toast('🎵 옥문이 열렸어요!');render();return'free'}
  if(ch==='pay'){await charge(p,100,'pot',`${t.name} 탈출 헌금`);if(p.out)return'stay';p.jail=0;render();return'free'}
  if(ch==='quiz'){const r=await quizFlow(p,'jail',{kick:`${t.pic} ${esc(t.name)} 탈출 퀴즈`,sub:'맞히면 바로 벗어나 주사위를 굴려요'});
    if(r.ok){p.jail=0;log(`${p.name}: 퀴즈를 맞혀 ${t.name}을 벗어났어요`,p);render();return'free'}}
  else{const[a,b]=await rollDice(p,`<b>${esc(p.name)}</b>, 더블이 나오면 ${t.name}을 벗어나요!`);
    if(a===b){p.jail=0;log(`${p.name}: 더블! ${t.name}을 벗어났어요`,p);render();await moveBy(p,a+b);await land(p);return'moved'}}
  p.jail--;log(`${p.name}: ${t.name}에 머뭅니다${p.jail===0?' (다음 차례에는 나가요)':''}`,p);render();await sleep(500);return'stay'}

/* ---------- 퀴즈 ---------- */
function quizPool(forAI){
  const era=G.board.era,all=Content.quizAll().filter(q=>q.on);
  const types=q=>forAI?q.t==='mc':(q.t==='mc'?G.cfg.qmc!==false:G.cfg.qsa!==false);
  let lvs=G.cfg.diff==='mix'?[(()=>{const r=Math.random();return r<.4?'easy':r<.75?'normal':'hard'})()]:[G.cfg.diff];
  let pool=all.filter(q=>eraFits(q.era,era)&&lvs.includes(q.lv)&&types(q));
  if(!pool.length)pool=all.filter(q=>eraFits(q.era,era)&&types(q));
  if(!pool.length)pool=all.filter(q=>q.t==='mc'||!forAI);
  if(!pool.length)pool=DEFAULT_QUIZ.map(normQuiz).filter(q=>q.t==='mc');
  return pool}
function drawQuestion(forAI){
  const pool=quizPool(forAI);let fresh=pool.filter(q=>!G.used[q.id]),reset=0;
  if(!fresh.length){fresh=pool;reset=1}
  const q=fresh[Math.random()*fresh.length|0];
  const o={id:q.id,t:q.t,q:q.q,lv:q.lv,cat:q.cat,ref:q.ref,ex:q.ex||'',rw:q.rw||0,reset};
  if(q.t==='mc'){const order=shuffle(q.c.map((_,i)=>i));o.choices=order.map(i=>q.c[i]);o.ans=order.indexOf(q.ai)}
  else{o.a=q.a;o.alt=q.alt||[]}
  return o}
/* 화면에 보여 줄 퀴즈 정보: 정답은 판정·결과 단계에서만 담습니다 (참가자 기기에서 미리 볼 수 없게) */
function pubQuiz(QS){const q={...QS.q},open=QS.stage==='result';delete q.reset;if(!open){delete q.ans;delete q.a;delete q.alt;delete q.ex;delete q.ref}
  return {purpose:QS.purpose,kick:QS.kick,sub:QS.sub,pid:QS.pid,stage:QS.stage,stealer:QS.stealer,by:QS.by,q,tries:QS.tries.map(t=>({...t}))}}
function secretQuiz(QS){return {ans:QS.q.ans,a:QS.q.a,alt:QS.q.alt,ex:QS.q.ex}}
async function quizFlow(p,purpose,o){
  const Q=rnd('q',()=>drawQuestion(p.ai));
  if(Q.reset)G.used={};G.used[Q.id]=1;
  const QS={purpose,kick:o.kick,sub:o.sub||'',pid:p.id,q:Q,tries:[],stage:'answer',stealer:null,by:null};
  log(`${p.name}: 말씀 퀴즈 (${LV_KO[Q.lv]})`,p);
  let ok=await answerStep(QS,p),by=ok?p.id:null;
  if(!ok&&(purpose==='tile'||purpose==='bonus')&&G.cfg.steal){
    const cands=alive().filter(x=>x.id!==p.id&&!(Q.t==='sa'&&x.ai)).map(x=>x.id);
    if(cands.length){QS.stage='steal';
      const sid=await ask({kind:'qs',who:'host',pid:p.id,cands,quiz:pubQuiz(QS),secret:secretQuiz(QS),undo:1});
      if(sid>=0){QS.stealer=sid;const sp=byId(sid);log(`${sp.name}: 다른 팀 기회를 받았어요`,sp);if(await answerStep(QS,sp))by=sid}}}
  QS.stage='result';QS.by=by;
  if(G.cfg.aiQuiz==='auto'&&QS.tries.every(t=>byId(t.pid).ai)){fx(()=>{UI.showQuizResult(pubQuiz(QS));Net.event({t:'qres',quiz:pubQuiz(QS)})});await sleep(2600);fx(()=>UI.clearPrompt())}
  else await ask({kind:'qr',who:'any',pid:p.id,quiz:pubQuiz(QS),undo:1});
  return {ok:by===p.id,by,lv:Q.lv,rw:Q.rw}}
async function answerStep(QS,a){
  const Q=QS.q,tr={pid:a.id};QS.tries.push(tr);
  if(a.ai){QS.stage='view';
    if(G.cfg.aiQuiz==='manual')await ask({kind:'qv',who:'any',pid:a.id,quiz:pubQuiz(QS),undo:0});else await sleep(1800);
    const acc=(AIACC[G.cfg.ai]||AIACC.normal)[Q.lv]||.7,ok=rnd('aiq',()=>Math.random()<acc);
    tr.choice=ok?Q.ans:rnd('aiw',()=>{const w=Q.choices.map((_,i)=>i).filter(i=>i!==Q.ans&&!QS.tries.some(t=>t.choice===i));return w.length?w[Math.random()*w.length|0]:-1});
    tr.ok=ok;sfx(ok?'good':'bad');log(`${a.name}: 퀴즈 ${ok?'정답':'오답'}`,a);return ok}
  QS.stage='answer';
  const v=await ask({kind:'qa',who:'player',pid:a.id,quiz:pubQuiz(QS),time:G.cfg.quizTime||0,undo:1});
  if(Q.t==='mc'){tr.choice=v;tr.ok=v===Q.ans;if(v<0)tr.timeout=1;sfx(tr.ok?'good':'bad');log(`${a.name}: 퀴즈 ${tr.ok?'정답':v<0?'시간 초과':'오답'}`,a);return tr.ok}
  if(v===-1)tr.timeout=1;QS.stage='judge';
  const j=await ask({kind:'qj',who:'host',pid:a.id,quiz:pubQuiz(QS),secret:secretQuiz(QS),undo:1});
  tr.ok=j===true;sfx(tr.ok?'good':'bad');log(`${a.name}: 퀴즈 ${tr.ok?'정답':'오답'} (진행자 판정)`,a);return tr.ok}

/* ---------- 컴퓨터가 고를 칸 ---------- */
function aiFly(p){let best=0,score=150;
  G.board.tiles.forEach((t,i)=>{if(t.t==='fly'||t.t==='jail')return;let s=-1;const o=G.own[i];
    if(t.t==='city'||t.t==='spot'){if(!o&&p.money-t.price>=aiReserve())s=t.price;else if(o&&o.o===p.id&&t.t==='city'&&o.l<3&&p.money-upCost(i)>=aiReserve())s=upCost(i)+60}
    else if(t.t==='pot')s=G.pot;else if(t.t==='quiz')s=110;
    if(s>score){score=s;best=i}});return best}
