'use strict';
/* ===================== 선수 꾸미기 (화면 보며 하기) =====================
   img/cr-parts.png: 96×96 칸, 가로 4칸 × 15줄. 부위마다 3줄(12칸)씩
     0~2줄 바탕 얼굴(피부색 12) · 3~5줄 머리 모양 12 · 6~8줄 눈 12 · 9~11줄 입 12 · 12~14줄 장식 8 + 모자 4
   look = { skin, hair(-1 민머리), hc(머리색), eyes, mouth, acc(-1 없음), hat(-1 없음) }
   바탕 → 눈 → 입 → 머리 → 장식 → 모자 차례로 겹치고, 자홍색(#FF00FF 계열)은 팀 색으로 칠함.
   모자를 쓰면 모자 위로 삐져나오는 머리카락(위쪽 LOOK_CLIP줄)은 지움 */
const LOOK_ROW = { skin:0, hair:3, eyes:6, mouth:9, acc:12 };
const LOOK_CLIP = 36;
const HAIR_COLORS = [null, '#7a4a26', '#e0b04a', '#c0472c', '#b9bcc6', '#3f63d6'];
const HAIR_NAMES = ['검정', '갈색', '금발', '빨강', '은색', '파랑'];
const LOOK_DEF = { skin:2, hair:0, hc:0, eyes:0, mouth:0, acc:-1, hat:0 };
// 부위 고르기 칸: [키, 이름, 고를 수 있는 값]
const LOOK_TABS = [
  ['skin', '피부', [...Array(12).keys()]],
  ['hair', '머리', [-1, ...Array(12).keys()]],
  ['hc', '머리색', [...Array(6).keys()]],
  ['eyes', '눈', [...Array(12).keys()]],
  ['mouth', '입', [...Array(12).keys()]],
  ['acc', '장식', [-1, ...Array(8).keys()]],
  ['hat', '모자', [-1, 0, 1, 2, 3]],
];
const LOOK_PART_NAMES = {
  hair:['짧은 머리', '스포츠머리', '덮은 앞머리', '꽁지머리', '단발', '긴 생머리', '곱슬머리', '레게머리', '묶은 장발', '짧게 깎은 머리', '옆머리 바짝', '웨이브'],
  eyes:['동그란 눈', '웃는 눈', '날카로운 눈', '졸린 눈', '반짝이는 눈', '찡그린 눈', '윙크', '가는 눈', '놀란 눈', '결의에 찬 눈', '처진 눈', '큰 눈'],
  mouth:['미소', '활짝 웃음', '다문 입', '휘파람', '껌 풍선', '놀란 입', '씩 웃음', '메롱', '이 악물기', '작은 입', '함성', '무표정'],
  acc:['아이 블랙', '고글', '동그란 안경', '반창고', '콧수염', '턱수염', '주근깨', '귀걸이'],
  hat:['야구 모자', '거꾸로 쓴 모자', '헬멧', '비니'],
};
const LK = { img:null, ok:false, cache:{} };
function lookLoad(){
  if(LK.img || typeof Image === 'undefined') return;
  LK.img = new Image();
  LK.img.onload = () => { LK.ok = true; if(typeof UI !== 'undefined' && UI.S && /^(cr-|wz-)/.test(UI.S.kind || '') && !(document.activeElement && document.activeElement.id === 'wzName') && typeof skinBody === 'function') skinBody(); };
  LK.img.src = 'img/cr-parts.png';
}
function lookFix(o){
  const l = { ...LOOK_DEF, ...(o || {}) };
  for(const [k, , vals] of LOOK_TABS) if(!vals.includes(Number(l[k]))) l[k] = LOOK_DEF[k]; else l[k] = Number(l[k]);
  return l;
}
function lookRandom(){
  const pick = a => a[Math.floor(Math.random() * a.length)];
  return { skin: pick([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), hair: pick([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), hc: Math.random() < 0.6 ? 0 : pick([1, 2, 3, 4, 5]),
    eyes: pick([...Array(12).keys()]), mouth: pick([0, 1, 2, 6, 9, 11]), acc: Math.random() < 0.6 ? -1 : pick([0, 1, 2, 3, 4, 5, 6, 7]), hat: Math.random() < 0.75 ? 0 : pick([-1, 1, 2, 3]) };
}
const lookName = (k, v) => k === 'skin' ? `피부 ${v + 1}` : k === 'hc' ? HAIR_NAMES[v] : v < 0 ? (k === 'hair' ? '민머리' : '없음') : (LOOK_PART_NAMES[k] || [])[v] || String(v + 1);
// 겹쳐 그린 얼굴 그림 주소 (그림을 아직 못 불러왔으면 빈 글자)
function lookURL(look, color){
  lookLoad(); if(!LK.ok) return '';
  const l = lookFix(look), key = [l.skin, l.hair, l.hc, l.eyes, l.mouth, l.acc, l.hat, color].join(',');
  if(LK.cache[key]) return LK.cache[key];
  const S = 96, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d'), T = [1, 3, 5].map(j => parseInt(String(color || '#3b82f6').slice(j, j + 2), 16));
  const layer = () => { const c = document.createElement('canvas'); c.width = c.height = S; c.getContext('2d', { willReadFrequently:true }); return c; };
  const part = (cnv, row, i) => cnv.getContext('2d').drawImage(LK.img, (i % 4) * S, (row + Math.floor(i / 4)) * S, S, S, 0, 0, S, S);
  // 팀 색: 자홍색 계열을 같은 밝기의 팀 색으로 (바탕 깃·머리끈·모자에만. 입 안·혀의 분홍은 그대로)
  const tint = cnv => {
    const g = cnv.getContext('2d'), d = g.getImageData(0, 0, S, S), p = d.data;
    for(let i = 0; i < p.length; i += 4){
      const r = p[i], gg = p[i + 1], b = p[i + 2];
      if(p[i + 3] && r > 90 && b > 80 && gg < 0.6 * Math.min(r, b) && Math.abs(r - b) < 80){ const v = Math.max(r, b) / 255; p[i] = Math.round(T[0] * v); p[i + 1] = Math.round(T[1] * v); p[i + 2] = Math.round(T[2] * v); }
    }
    g.putImageData(d, 0, 0); return cnv;
  };
  const base = layer(); part(base, LOOK_ROW.skin, l.skin); x.drawImage(tint(base), 0, 0);
  const face = layer(); part(face, LOOK_ROW.eyes, l.eyes); part(face, LOOK_ROW.mouth, l.mouth); x.drawImage(face, 0, 0);
  if(l.hair >= 0){
    const hv = layer(), h = hv.getContext('2d');
    part(hv, LOOK_ROW.hair, l.hair);
    if(l.hat >= 0) h.clearRect(0, 0, S, LOOK_CLIP);
    const col = HAIR_COLORS[l.hc];
    if(col){   // 머리색: 어두운 점의 밝기를 그 색의 명암으로 (윤곽선은 그대로 어두움)
      const d = h.getImageData(0, 0, S, S), p = d.data, H = [1, 3, 5].map(j => parseInt(col.slice(j, j + 2), 16));
      for(let i = 0; i < p.length; i += 4){
        if(!p[i + 3]) continue;
        const r = p[i], g = p[i + 1], b = p[i + 2];
        if(r > 150 && b > 150 && g < 120) continue;   // 머리끈(자홍색)은 팀 색으로
        const v = Math.min(1.7, (r + g + b) / 3 / 52);
        p[i] = Math.min(255, H[0] * v); p[i + 1] = Math.min(255, H[1] * v); p[i + 2] = Math.min(255, H[2] * v);
      }
      h.putImageData(d, 0, 0);
    }
    x.drawImage(tint(hv), 0, 0);
  }
  if(l.acc >= 0){ const a = layer(); part(a, LOOK_ROW.acc, l.acc); x.drawImage(a, 0, 0); }
  if(l.hat >= 0){ const a = layer(); part(a, LOOK_ROW.acc, 8 + l.hat); x.drawImage(tint(a), 0, 0); }
  return LK.cache[key] = cv.toDataURL();
}
// 꾸미기 판: 부위 고르기 칸(탭)과 고를 것 격자. set 키: 'lt'(탭), 'lk'(값), 'lr'(무작위)
let LOOK_TAB = 'skin';
function lookEditor(look, color){
  const l = lookFix(look), tab = LOOK_TABS.find(t => t[0] === LOOK_TAB) || LOOK_TABS[0], k = tab[0];
  const tabs = `<div class="lk-tabs" role="tablist">${LOOK_TABS.map(([key, name]) => `<button type="button" role="tab" class="${key === k ? 'on' : ''}" aria-selected="${key === k}" data-sk="set" data-k="lt" data-v="${key}">${esc(name)}</button>`).join('')}<button type="button" class="lk-rand" data-sk="set" data-k="lr" data-v="1" aria-label="무작위로 꾸미기">🎲</button></div>`;
  // 머리·머리색은 모자를 벗긴 그림으로 보여 줌
  const shown = v => ({ ...l, [k]: v, ...(k === 'hair' || k === 'hc' ? { hat:-1 } : {}) });
  const grid = tab[2].map(v => `<button type="button" class="lk-o${l[k] === v ? ' on' : ''}" data-sk="set" data-k="lk" data-v="${v}" aria-pressed="${l[k] === v}" aria-label="${esc(lookName(k, v))}" title="${esc(lookName(k, v))}">${k === 'hc' ? `<i class="lk-sw" style="background:${HAIR_COLORS[v] || '#222'}"></i>` : ''}${crFace(shown(v), color, 'xs')}</button>`).join('');
  return `<div class="lk">${tabs}<div class="lk-g n${tab[2].length}">${grid}</div><p class="lk-now">${esc(tab[1])}: ${esc(lookName(k, l[k]))}</p></div>`;
}
// 꾸미기 판의 고르기를 look에 반영 (탭 바꾸기는 look을 바꾸지 않음)
function lookSet(look, key, v){
  if(key === 'lt'){ LOOK_TAB = v; return look; }
  if(key === 'lr') return lookRandom();
  if(key === 'lk'){ const l = lookFix(look); l[LOOK_TAB] = Number(v); return lookFix(l); }
  return look;
}
