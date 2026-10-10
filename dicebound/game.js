(() => {
const $ = id => document.getElementById(id);
const state = {
  maxHp: 40, hp: 40, gold: 12, floor: 1, maxFloor: 8,
  dice: [], enemy: null, rollNo: 0, phase: 'combat', locked: [],
  relics: [], reward: null, mapOptions: [], log: '', runs: 0
};
const relicPool = [
 {id:'ring',name:'도박사의 반지',desc:'재굴림을 모두 사용하면 피해 +4',emoji:'💍'},
 {id:'crest',name:'왕의 문장',desc:'트리플 이상 족보 피해 +25%',emoji:'👑'},
 {id:'scale',name:'탐욕의 저울',desc:'골드 10마다 공격력 +1 (최대 +5)',emoji:'⚖️'},
 {id:'heart',name:'얼음 심장',desc:'빙결 주사위 효과 +1',emoji:'🧊'},
 {id:'balance',name:'완벽한 균형',desc:'투 페어 완성 시 방어 5 획득',emoji:'☯️'},
 {id:'coin',name:'운명의 동전',desc:'전투 시작 시 첫 굴림 주사위 하나를 +1 (최대 6)',emoji:'🪙'}
];
const dicePool = [
 {id:'gold',name:'황금',emoji:'✨',desc:'6이 나오면 골드 +2',rarity:'희귀'},
 {id:'curse',name:'저주',emoji:'☠️',desc:'1이 나오면 추가 피해 8, 체력 -2',rarity:'희귀'},
 {id:'ice',name:'빙결',emoji:'❄️',desc:'4 이상이면 빙결 중첩 1',rarity:'일반'},
 {id:'transmute',name:'변환',emoji:'🔮',desc:'전투당 한 번 결과를 원하는 눈으로 변경',rarity:'희귀'},
 {id:'alchemy',name:'연금술',emoji:'🧪',desc:'2 또는 3이면 방어 2',rarity:'일반'},
 {id:'steel',name:'강철',emoji:'🛡️',desc:'트리플 이상 족보에 포함되면 피해 +3',rarity:'일반'}
];
const enemyPool = [
 {name:'길 잃은 도적',icon:'🗡️',hp:24,damage:6,type:'일반',desc:'기본 공격'},
 {name:'늪지 늑대',icon:'🐺',hp:28,damage:7,type:'일반',desc:'빠른 공격'},
 {name:'폐허의 경비병',icon:'🪖',hp:32,damage:8,type:'일반',desc:'단단한 방어'},
 {name:'주사위 사냥꾼',icon:'🎭',hp:42,damage:9,type:'정예',desc:'매 턴 공격 +1'},
 {name:'저주받은 기사',icon:'💀',hp:48,damage:10,type:'정예',desc:'강력한 공격'},
 {name:'주사위 왕',icon:'👑',hp:100,damage:12,type:'보스',desc:'왕의 심판'}
];
const rand = n => Math.floor(Math.random()*n);
const pick = arr => arr[rand(arr.length)];
function setLog(msg){state.log=msg;$('combatLog').textContent=msg}
function addRelic(relic){if(state.relics.some(r=>r.id===relic.id)) return false;state.relics.push(relic);renderRelics();return true}
function renderRelics(){$('relics').innerHTML=state.relics.length?state.relics.map(r=>`<div class="relic"><b>${r.emoji} ${r.name}</b>${r.desc}</div>`).join(''):'<span class="muted">아직 유물이 없습니다.</span>'}
function renderStatus(){
 $('hp').textContent=`${state.hp} / ${state.maxHp}`;$('hpBar').style.width=`${Math.max(0,state.hp/state.maxHp*100)}%`;
 $('gold').textContent=state.gold;$('floor').textContent=`${Math.min(state.floor,state.maxFloor)} / ${state.maxFloor}`;$('diceCount').textContent=state.dice.length;
 if(state.enemy){$('enemyHp').textContent=`${Math.max(0,state.enemy.hp)} / ${state.enemy.maxHp}`;$('enemyHpBar').style.width=`${Math.max(0,state.enemy.hp/state.enemy.maxHp*100)}%`;$('enemyName').textContent=state.enemy.name;$('enemyIcon').textContent=state.enemy.icon;$('enemyType').textContent=state.enemy.type;$('enemyIntent').textContent=`다음 행동: ${state.enemy.desc} · 피해 ${state.enemy.damage}`}
}
function createDie(kind=null){return {uid:Math.random().toString(36).slice(2),kind:kind||null,value:1,locked:false,used:false}}
function rollOne(d){if(!d.locked)d.value=1+rand(6)}
function newEnemy(type='일반'){
 let e;
 if(type==='보스') e={...enemyPool[5]};
 else if(type==='정예') e={...pick(enemyPool.filter(x=>x.type==='정예'))};
 else e={...pick(enemyPool.filter(x=>x.type==='일반'))};
 e.maxHp=e.hp;e.turn=0;state.enemy=e;state.rollNo=0;state.dice.forEach(d=>{d.locked=false;d.used=false});
 if(state.relics.some(r=>r.id==='coin')){state.dice[0].value=Math.min(6,state.dice[0].value+1)}
 state.phase='combat';showOnly('combatPanel');$('attackBtn').disabled=true;$('rollBtn').disabled=false;renderDice();renderStatus();
 setLog(`${e.name}이(가) 나타났다. 적의 행동을 살피고 주사위를 굴려라.`);
}
function showOnly(id){['mapPanel','combatPanel','rewardPanel','shopPanel','endPanel'].forEach(x=>$(x).classList.toggle('hidden',x!==id));}
function handOf(values){
 const counts={};values.forEach(v=>counts[v]=(counts[v]||0)+1);
 const groups=Object.values(counts).sort((a,b)=>b-a);
 const uniq=[...new Set(values)].sort((a,b)=>a-b);
 const straight=uniq.length===5 && (uniq[4]-uniq[0]===4 || uniq.join(',')==='1,2,3,4,6' /* no special joker; retained as non-straight */);
 if(groups[0]===5)return {name:'파이브 오브 어 카인드',rank:8,base:values.reduce((a,b)=>a+b,0)*6};
 if(groups[0]===4)return {name:'포카드',rank:7,base:values.filter(v=>counts[v]===4).reduce((a,b)=>a+b,0)*5};
 if(groups[0]===3&&groups[1]===2)return {name:'풀하우스',rank:6,base:values.filter(v=>counts[v]===3).reduce((a,b)=>a+b,0)*4,block:4};
 if(straight && uniq.length===5 && uniq[4]-uniq[0]===4)return {name:'스트레이트',rank:5,base:12};
 if(groups[0]===3)return {name:'트리플',rank:4,base:values.filter(v=>counts[v]===3).reduce((a,b)=>a+b,0)*4};
 if(groups[0]===2&&groups[1]===2)return {name:'투 페어',rank:3,base:values.filter(v=>counts[v]===2).reduce((a,b)=>a+b,0)*3};
 if(groups[0]===2)return {name:'원 페어',rank:2,base:values.filter(v=>counts[v]===2).reduce((a,b)=>a+b,0)*3};
 return {name:'하이 카드',rank:1,base:Math.max(...values)*2};
}
function calcDamage(hand){
 let dmg=hand.base;
 if(state.relics.some(r=>r.id==='crest')&&hand.rank>=4)dmg=Math.floor(dmg*1.25);
 if(state.relics.some(r=>r.id==='scale'))dmg+=Math.min(5,Math.floor(state.gold/10));
 if(state.relics.some(r=>r.id==='ring')&&state.rollNo===3)dmg+=4;
 if(hand.rank===3&&state.relics.some(r=>r.id==='balance'))state.pendingBlock=(state.pendingBlock||0)+5;
 state.dice.forEach(d=>{
  if(d.kind==='steel'&&hand.rank>=4)dmg+=3;
  if(d.kind==='curse'&&d.value===1){dmg+=8;state.hp=Math.max(1,state.hp-2)}
  if(d.kind==='gold'&&d.value===6)state.gold+=2;
  if(d.kind==='alchemy'&&(d.value===2||d.value===3))state.pendingBlock=(state.pendingBlock||0)+2;
  if(d.kind==='ice'&&d.value>=4)state.enemy.chill=(state.enemy.chill||0)+1+(state.relics.some(r=>r.id==='heart')?1:0);
 });
 return Math.max(0,dmg);
}
function renderDice(){
 $('diceTray').innerHTML=state.dice.map((d,i)=>`<button class="die ${d.locked?'locked':''}" data-uid="${d.uid}" title="${d.kind?dicePool.find(k=>k.id===d.kind)?.desc:'기본 주사위'}"><span class="kind">${d.kind?(dicePool.find(k=>k.id===d.kind)?.emoji||''):' '}</span>${state.rollNo?d.value:'?' }<span class="die-label">${d.locked?'🔒 보존':d.kind?(dicePool.find(k=>k.id===d.kind)?.name||'주사위'):'주사위 '+(i+1)}</span></button>`).join('');
 document.querySelectorAll('.die').forEach(el=>el.addEventListener('click',()=>{if(state.rollNo===0||state.rollNo>=3||state.phase!=='combat')return;const d=state.dice.find(x=>x.uid===el.dataset.uid);d.locked=!d.locked;renderDice()}));
 $('rollCount').textContent=`굴림 ${state.rollNo} / 3`;
 if(state.rollNo>0){const h=handOf(state.dice.map(d=>d.value));$('handName').textContent=h.name;$('damage').textContent=calcPreview(h);$('attackBtn').disabled=false}
 else{$('handName').textContent='아직 굴리지 않음';$('damage').textContent='—';$('attackBtn').disabled=true}
 $('rollBtn').disabled=state.rollNo>=3||state.phase!=='combat';
}
function calcPreview(hand){
 let dmg=hand.base;
 if(state.relics.some(r=>r.id==='crest')&&hand.rank>=4)dmg=Math.floor(dmg*1.25);
 if(state.relics.some(r=>r.id==='scale'))dmg+=Math.min(5,Math.floor(state.gold/10));
 if(state.relics.some(r=>r.id==='ring')&&state.rollNo===3)dmg+=4;
 if(state.dice.some(d=>d.kind==='steel')&&hand.rank>=4)dmg+=3;
 return dmg;
}
function roll(){
 if(state.phase!=='combat'||state.rollNo>=3)return;
 state.rollNo++;state.dice.forEach(d=>{if(!d.locked)rollOne(d)});
 if(state.rollNo===1&&state.relics.some(r=>r.id==='coin'))state.dice[0].value=Math.min(6,state.dice[0].value+1);
 renderDice();setLog(`굴림 ${state.rollNo}/3. 마음에 드는 주사위를 눌러 보존할 수 있다.`);renderStatus();
}
function attack(){
 if(state.phase!=='combat'||state.rollNo===0)return;
 const h=handOf(state.dice.map(d=>d.value));let dmg=calcDamage(h);
 state.enemy.hp-=dmg;
 const block=state.pendingBlock||0;state.pendingBlock=0;
 setLog(`${h.name} 완성! ${dmg} 피해를 주었다.${block?` 방어 ${block}을 준비했다.`:''}`);
 renderStatus();
 if(state.enemy.hp<=0){winCombat();return}
 state.enemy.turn++;
 let enemyDamage=state.enemy.damage;
 if(state.enemy.type==='정예')enemyDamage+=Math.floor(state.enemy.turn/2);
 if(state.enemy.name==='주사위 왕'&&state.enemy.turn%3===0)enemyDamage+=6;
 if((state.enemy.chill||0)>=3){enemyDamage=Math.max(1,enemyDamage-3);state.enemy.chill-=3}
 const actual=Math.max(0,enemyDamage-block);state.hp-=actual;
 if(state.hp<=0){state.hp=0;renderStatus();endRun(false);return}
 state.rollNo=0;state.dice.forEach(d=>{d.locked=false;d.used=false});
 renderDice();renderStatus();setLog(`${h.name}으로 ${dmg} 피해. 적이 ${actual} 피해로 반격했다.`);
}
function winCombat(){
 state.phase='reward';state.gold+=state.enemy.type==='정예'?8:5;
 if(state.enemy.type==='보스'){renderStatus();endRun(true);return}
 const options=[];
 options.push({title:'주사위 획득',emoji:'🎲',desc:'특수 주사위 하나를 선택한다.',action:()=>offerDice()});
 options.push({title:'유물 발견',emoji:'🏺',desc:'새 유물 하나를 획득한다.',action:()=>offerRelic()});
 options.push({title:'골드 챙기기',emoji:'🪙',desc:'골드 8을 추가로 획득한다.',action:()=>{state.gold+=8;showRewardDone('골드 8을 획득했다.')}})
 $('rewardTitle').textContent=`${state.enemy.name} 격파!`;$('rewardText').textContent=`골드 ${state.enemy.type==='정예'?8:5} 획득. 보상을 선택하세요.`;$('rewardChoices').innerHTML='';
 options.forEach((o,i)=>{const b=document.createElement('button');b.className='choice';b.innerHTML=`<span class="emoji">${o.emoji}</span><strong>${o.title}</strong><small>${o.desc}</small>`;b.onclick=o.action;$('rewardChoices').appendChild(b)});
 $('continueBtn').classList.add('hidden');showOnly('rewardPanel');renderStatus();
}
function showRewardDone(msg){$('rewardText').textContent=msg;$('rewardChoices').innerHTML='';$('continueBtn').classList.remove('hidden');}
function offerDice(){
 const pool=[...dicePool].sort(()=>Math.random()-.5).slice(0,3);$('rewardChoices').innerHTML='';
 pool.forEach(k=>{const b=document.createElement('button');b.className='choice';b.innerHTML=`<span class="emoji">${k.emoji}</span><strong>${k.name} 주사위 · ${k.rarity}</strong><small>${k.desc}</small>`;b.onclick=()=>{state.dice.push(createDie(k.id));showRewardDone(`${k.name} 주사위를 덱에 추가했다.`);renderStatus()};$('rewardChoices').appendChild(b)});
}
function offerRelic(){
 const available=relicPool.filter(r=>!state.relics.some(x=>x.id===r.id));
 if(!available.length){showRewardDone('모든 유물을 이미 보유했다. 대신 골드 6을 획득했다.');state.gold+=6;renderStatus();return}
 $('rewardChoices').innerHTML='';available.sort(()=>Math.random()-.5).slice(0,3).forEach(r=>{const b=document.createElement('button');b.className='choice';b.innerHTML=`<span class="emoji">${r.emoji}</span><strong>${r.name}</strong><small>${r.desc}</small>`;b.onclick=()=>{addRelic(r);showRewardDone(`${r.name} 유물을 획득했다.`)};$('rewardChoices').appendChild(b)});
}
function generateMap(){
 const types=['전투','보물','상점','휴식','이벤트','정예'];
 const opts=[];
 while(opts.length<3){let t=pick(types);if(state.floor>=6&&opts.length===0)t='정예';if(opts.some(o=>o.type===t)&&t!=='전투')continue;opts.push({type:t})}
 if(state.floor===state.maxFloor-1)opts[2]={type:'정예'};
 state.mapOptions=opts;
 $('mapCaption').textContent=`층 ${state.floor} · 다음은 ${state.floor===state.maxFloor-1?'보스 전 마지막 준비':'세 경로 중 하나'}`;
 $('mapChoices').innerHTML='';
 const meta={
 '전투':['⚔️','일반 전투','기본 보상과 골드.'],
 '정예':['💀','정예 전투','위험하지만 희귀 보상.'],
 '보물':['💎','보물 상자','주사위 또는 유물 획득.'],
 '상점':['🏪','떠돌이 상인','골드로 주사위와 회복을 구매.'],
 '휴식':['🔥','야영지','체력을 회복하거나 골드를 얻는다.'],
 '이벤트':['📜','수상한 제단','대가를 치르고 보상을 얻을 수도 있다.']
 };
 opts.forEach((o,i)=>{const m=meta[o.type],b=document.createElement('button');b.className='choice '+(o.type==='정예'?'danger':o.type==='보물'?'gold':'');b.innerHTML=`<span class="emoji">${m[0]}</span><strong>${m[1]}</strong><small>${m[2]}</small>`;b.onclick=()=>chooseNode(o.type);$('mapChoices').appendChild(b)});
 showOnly('mapPanel');
}
function chooseNode(type){
 if(type==='전투'||type==='정예'){newEnemy(type);return}
 if(type==='보물'){state.gold+=3;showOnly('rewardPanel');$('rewardTitle').textContent='보물 발견';$('rewardText').textContent='골드 3을 발견했다. 보상을 선택하세요.';$('rewardChoices').innerHTML='';$('continueBtn').classList.add('hidden');const a=document.createElement('button');a.className='choice';a.innerHTML='<span class="emoji">🎲</span><strong>특수 주사위</strong><small>무작위 주사위 하나 획득</small>';a.onclick=offerDice;$('rewardChoices').appendChild(a);const b=document.createElement('button');b.className='choice';b.innerHTML='<span class="emoji">🏺</span><strong>유물</strong><small>유물 하나 획득</small>';b.onclick=offerRelic;$('rewardChoices').appendChild(b);renderStatus();return}
 if(type==='상점'){openShop();return}
 if(type==='휴식'){state.hp=Math.min(state.maxHp,state.hp+12);state.gold+=2;renderStatus();setLog('야영지에서 체력 12를 회복하고 골드 2를 얻었다.');advanceFloor();return}
 if(type==='이벤트'){if(Math.random()<.5){state.hp=Math.max(1,state.hp-5);state.gold+=15;setLog('제단이 체력 5를 요구했다. 대신 골드 15를 받았다.')}else{state.hp=Math.min(state.maxHp,state.hp+8);setLog('제단이 체력 8을 회복해 주었다.')}renderStatus();advanceFloor()}
}
function openShop(){
 showOnly('shopPanel');$('shopChoices').innerHTML='';
 const items=[
 {emoji:'🎲',title:'특수 주사위',desc:'골드 8 · 무작위 주사위',cost:8,act:()=>{state.dice.push(createDie(pick(dicePool).id));}},
 {emoji:'❤️',title:'치유 물약',desc:'골드 6 · 체력 12 회복',cost:6,act:()=>{state.hp=Math.min(state.maxHp,state.hp+12)}},
 {emoji:'🏺',title:'유물',desc:'골드 12 · 무작위 유물',cost:12,act:()=>{const r=relicPool.find(r=>!state.relics.some(x=>x.id===r.id));if(r)addRelic(r);else{state.gold+=4}}}
 ];
 items.forEach(it=>{const b=document.createElement('button');b.className='choice';b.innerHTML=`<span class="emoji">${it.emoji}</span><strong>${it.title} · ${it.cost}G</strong><small>${it.desc}</small>`;b.onclick=()=>{if(state.gold<it.cost){setLog('골드가 부족하다.');return}state.gold-=it.cost;it.act();renderStatus();b.disabled=true;b.querySelector('small').textContent='구매 완료';};$('shopChoices').appendChild(b)});
}
function advanceFloor(){
 if(state.floor>=state.maxFloor-1){state.floor=state.maxFloor;newEnemy('보스');return}
 state.floor++;renderStatus();generateMap()
}
function endRun(won){
 state.phase='ended';showOnly('endPanel');$('endIcon').textContent=won?'🏆':'💀';$('endTitle').textContent=won?'주사위 왕을 물리쳤다!':'여정이 끝났다';$('endText').textContent=won?`축하합니다! ${state.floor}층에서 보스를 쓰러뜨렸습니다. 골드 ${state.gold}, 주사위 ${state.dice.length}개로 런을 마쳤습니다.`:`${state.floor}층에서 쓰러졌습니다. 주사위와 유물을 다시 구성해 도전하세요.`;renderStatus()
}
function startRun(){
 state.hp=40;state.maxHp=40;state.gold=12;state.floor=1;state.relics=[];state.dice=Array.from({length:5},()=>createDie());state.enemy=null;state.rollNo=0;state.phase='combat';state.pendingBlock=0;renderRelics();renderStatus();newEnemy('일반');
}
$('rollBtn').addEventListener('click',roll);$('attackBtn').addEventListener('click',attack);
$('continueBtn').addEventListener('click',advanceFloor);$('leaveShop').addEventListener('click',advanceFloor);
$('newRun').addEventListener('click',startRun);$('restartBtn').addEventListener('click',startRun);
startRun();
})();