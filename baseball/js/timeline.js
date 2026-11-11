'use strict';
/* ===================== 공 하나의 시간표 =====================
   그림(gfx.js)·효과음(speech.js)·글(ui.js의 뜸 들이기)·중계 음성(caster.js)·점수판이 모두 이 시간표 하나를 따름.
   (초 단위, 고른 순간이 0)
   release 공을 놓음(피칭 소리) · contact 공이 타자에게 옴(방망이 소리, 헛스윙·볼·스트라이크는 여기서 결정)
   field   땅볼을 야수가 잡음(그다음 1루로 던짐) · result 결과가 정해지는 순간(뜬공을 잡음, 송구가 1루에 도착, 공이 떨어짐, 담장을 넘음)
   runner  타자가 1루에 닿는 순간(아웃이면 송구보다 늦게, 내야 안타면 먼저) */
const TL_BASE = { release:0.8, contact:1.27 };   // 투구 동작 0.8초, 공이 날아가는 시간은 구속으로
// 공이 떨어지거나 내야를 빠져나가는 순간(안타를 말하고 함성이 터지는 때): 친 순간 뒤 몇 초. 안타가 아니면 null
function hitMoment(A){
  const bb = A && A.bb, ps = bb && bb.ps; if(!ps) return null;
  const ev = ps.ev || [], land = ev.find(e => e.k === 'land'), first = ev.find(e => e.k === 'ball'), pick = ev.find(e => e.k === 'pickup');
  return land ? land.t : bb.type === 'gb' && first ? Math.min(first.t1, 1.3) : pick ? pick.t - 0.3 : null;
}
function playTL(A, fx){
  if(!A) return null;
  fx = fx || [];
  const t = { ...TL_BASE, kind:'pitch' };
  t.contact = t.release + 18.4 * 0.93 / ((A.vel || 140) / 3.6);   // 실제 속도: 145킬로면 약 0.42초
  t.result = t.contact;
  const c = t.contact, bb = A.bb;
  // 위치·속도로 계산한 플레이(playsim.js)가 있으면 그 기록의 시간을 그대로 (그림은 ANIM_SCALE배 빠르게 재생)
  if(A.res === 'inplay' && bb && bb.ps){
    const S = typeof ANIM_SCALE === 'number' ? ANIM_SCALE : 0.6, ps = bb.ps;
    t.kind = bb.type; t.scale = S;
    const fe = (ps.ev || []).find(e => e.k === 'field'); if(fe) t.field = c + fe.t * S;
    t.result = c + Math.max(0.6, ps.result) * S;
    if(ps.runT) t.runner = c + ps.runT * S;
    const lastBall = Math.max(0, ...(ps.ev || []).filter(e => e.k === 'ball').map(e => e.t1));
    t.end = Math.max(t.result + 1.6, c + lastBall + 0.4);   // 홈런은 공이 담장 너머에 떨어질 때까지
    return t;
  }
  if(A.res === 'inplay' && bb){
    const d = bb.d || 60;
    t.kind = bb.type;
    if(bb.type === 'gb'){
      t.field = c + 0.75 + Math.min(0.55, d / 70);
      if(bb.hit){ t.result = c + 1.25; t.runner = t.result - 0.1; }          // 내야를 빠져나가는 안타
      else { t.result = t.field + 0.55; t.runner = t.result + 0.25; }       // 1루 송구가 먼저 도착
    }
    else if(bb.type === 'ld') t.result = c + 0.85;
    else if(bb.type === 'pu') t.result = c + 2.1;
    else t.result = c + (bb.hit === 4 ? 2.0 : 1.3 + Math.min(0.9, d / 130));  // 뜬공: 멀리 갈수록 오래 뜸
    if(bb.hit && bb.hit < 4 && bb.type !== 'gb') t.runner = t.result + 0.6;
  }
  else if(A.res === 'bunt'){ t.kind = 'bunt'; t.field = c + 0.9; t.result = c + 1.5; }
  else if(A.res === 'foul' || fx.includes('batF') || fx.some(e => e && e.k === 'contact' && e.foul)){ t.kind = 'foul'; t.result = c + 0.8; }
  else t.kind = A.res || 'take';
  t.end = t.result + (t.kind === 'pitch' || t.kind === 'take' || t.kind === 'whiff' || t.kind === 'hbp' ? 1.0 : 1.5);
  return t;
}
