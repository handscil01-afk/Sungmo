'use strict';
/* ================= 컴퓨터 플레이어 =================
   요청서를 받아 사람처럼 잠깐 생각한 뒤 답합니다. 퀴즈 답은 engine.js에서 정답률로 정합니다. */
const AI={
  async respond(spec){
    const p=spec.pid!=null?byId(spec.pid):null;
    switch(spec.kind){
      case 'roll':await sleep(600);return {s:1};
      case 'buy':{await sleep(500);const t=T(spec.tile);return p.money-t.price>=aiReserve()}
      case 'upgrade':{await sleep(500);return p.money-upCost(spec.tile)>=aiReserve()-50}
      case 'ark':await sleep(450);return spec.amt>=100;
      case 'wild':{await sleep(650);const o=spec.opts;return o.includes('song')?'song':o.includes('quiz')?'quiz':(o.includes('pay')&&p.money-100>=aiReserve())?'pay':'dice'}
      case 'fly':{await sleep(800);return aiFly(p)}
      case 'qs':await sleep(900);return spec.cands.length?spec.cands[0]:-1;
      case 'qv':case 'qr':await sleep(2200);return true;
      case 'qo':await sleep(400);return false;
      /* 사람 자리를 컴퓨터가 이어받았을 때 이미 나온 문제에 답합니다 */
      case 'qa':{await sleep(1500);const q=spec.quiz.q,h=spec.secret||{},acc=(AIACC[p.aiLv||G.cfg.ai]||AIACC.normal)[q.lv]||.7,ok=Math.random()<acc;
        if(q.t!=='mc')return ok&&h.a?{text:h.a}:-1;
        const tried=(spec.quiz.tries||[]).map(t=>t.choice),w=q.choices.map((_,i)=>i).filter(i=>i!==h.ans&&!tried.includes(i));
        return ok||!w.length?h.ans:w[Math.random()*w.length|0]}
      case 'notice':case 'card':await sleep(spec.autoMs||1700);return true;
      default:await sleep(400);return true;
    }
  }
};
