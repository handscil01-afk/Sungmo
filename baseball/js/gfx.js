'use strict';
/* ===================== 화면 모드(비장애인 모드)의 도트 그래픽 =====================
   패미컴 해상도(256×224)로 그리고 CSS로 정수배 확대함(image-rendering: pixelated).
   - 투구 화면: 포수 뒤에서 본 야구장. 투수 투구 동작 → 공이 구종에 따라 휘며 날아옴 → 타자 스윙 → 결과 글씨
   - 수비 화면: 공을 치면 위에서 본 야구장으로 바뀌어 타구가 날아가고 야수가 쫓아감. 홈런이면 담장을 넘김
   그림 파일(img/*.png, GPT로 만든 도트 그림)이 있으면 그것을 쓰고, 없으면 코드로 그린 도트 그림을 씀.
   팀 색 자리는 그림에서 자홍색(#FF00FF)으로 칠해 두면 팀 색으로 바꿔 칠함. 이 화면은 눈으로 보는 용도라 화면 낭독기에는 숨김 */
const GX = { W:256, H:224, cv:null, ctx:null, key:'', anim:null, raf:0, img:{}, tinted:{}, crowd:null };
const PAL = { sky:'#5c94fc', stand:'#3c3c64', fence:'#00682c', grass:'#38a838', grass2:'#4cbc4c', dirt:'#c88850', dirt2:'#b87840', line:'#fcfcfc',
  skin:'#f8b878', white:'#fcfcfc', black:'#000000', glove:'#a85010', bat:'#e4a050', ball:'#fcfcfc', ink:'#fcfc54', red:'#f83800' };
const GX_FILES = ['bg-pitch', 'bg-field', 'pitcher', 'batter', 'catcher', 'fielder', 'banners'];
// 결과 글씨 (banners.png를 쓸 때는 이 순서로 한 줄에 하나씩, 128×32)
const BANNERS = ['스트라이크!', '볼', '헛스윙!', '파울', '안타!', '2루타!', '3루타!', '홈런!', '아웃!', '삼진!', '볼넷', '세이프!', '몸에 맞는 공'];
function banner(text, y, color, size){
  const im = GX.img.banners, i = BANNERS.indexOf(text);
  if(im && i >= 0 && im.height >= (i + 1) * 32){ GX.ctx.drawImage(im, 0, i * 32, 128, 32, 64, Math.round(y - 4), 128, 32); return; }
  pxText(text, 128, y, color, size);
}

// img/index.json에 적힌 그림만 불러옴 (없는 파일을 찾느라 오류가 나지 않게)
function gfxLoad(){
  GX.img.__ = true;
  fetch(new URL('img/index.json', document.baseURI).href).then(r => r.ok ? r.json() : []).catch(() => []).then(list => (list || []).filter(n => GX_FILES.includes(n)).forEach(n => {
    const im = new Image();
    im.onload = () => { GX.img[n] = im; GX.tinted = {}; GX.key = ''; };
    im.src = new URL(`img/${n}.png`, document.baseURI).href;
  }));
}
// 그림 파일의 자홍색 칸을 팀 색으로 바꾼 사본 (색마다 한 번 만들어 둠)
function tinted(name, color){
  const k = name + color; if(GX.tinted[k]) return GX.tinted[k];
  const im = GX.img[name]; if(!im) return null;
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  const r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
  for(let i = 0; i < p.length; i += 4) if(p[i + 3] > 0 && p[i] > 180 && p[i + 2] > 180 && p[i + 1] < 90){ p[i] = r; p[i + 1] = g; p[i + 2] = b; }
  x.putImageData(d, 0, 0);
  return (GX.tinted[k] = c);
}
const R = (x, y, w, h, c) => { GX.ctx.fillStyle = c; GX.ctx.fillRect(Math.round(x), Math.round(y), w, h); };
// 도트 글씨: 글자를 그린 뒤 반투명한 테두리를 없애 또렷하게
function pxText(str, x, y, color, size = 10, center = true, outline = true){
  const k = `t${str}${color}${size}${outline}`;
  let c = GX.tinted[k];
  if(!c){
    const m = document.createElement('canvas').getContext('2d'); m.font = `bold ${size}px sans-serif`;
    const w = Math.ceil(m.measureText(str).width) + 4, h = size + 6;
    c = document.createElement('canvas'); c.width = w; c.height = h;
    const t = c.getContext('2d'); t.font = `bold ${size}px sans-serif`; t.textBaseline = 'top';
    if(outline){ t.fillStyle = '#000'; [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]].forEach(([dx, dy]) => t.fillText(str, 2 + dx, 2 + dy)); }
    t.fillStyle = color; t.fillText(str, 2, 2);
    const d = t.getImageData(0, 0, w, h), p = d.data;
    for(let i = 3; i < p.length; i += 4) p[i] = p[i] > 110 ? 255 : 0;
    t.putImageData(d, 0, 0);
    GX.tinted[k] = c;
  }
  GX.ctx.drawImage(c, Math.round(center ? x - c.width / 2 : x), Math.round(y));
}

/* ---------- 코드로 그린 사람 (그림 파일이 없을 때) ----------
   pose: set·lift·throw·follow (투수, 앞모습) / stance·swing·follow·bunt (타자, 뒷모습) / squat (포수) */
function person(x, y, team, pose, flip){
  const X = (dx, w) => flip ? x - dx - w : x + dx;   // 좌우를 뒤집을 때 쓰는 좌표
  const P = (dx, dy, w, h, c) => R(X(dx, w), y + dy, w, h, c);
  if(pose === 'squat'){
    P(-4, 0, 8, 2, team); P(-3, 2, 6, 3, PAL.skin); P(-5, 5, 10, 5, PAL.white); P(-5, 10, 4, 3, PAL.white); P(1, 10, 4, 3, PAL.white); P(-6, 13, 4, 1, PAL.black); P(2, 13, 4, 1, PAL.black);
    return;
  }
  P(-3, 0, 6, 2, team); P(-4, 1, 2, 1, team);           // 모자
  P(-2, 2, 4, 4, PAL.skin);                            // 얼굴(뒷모습이면 목덜미)
  P(-4, 6, 8, 7, PAL.white); P(-4, 8, 8, 1, team);      // 몸통·팀 색 줄
  P(-4, 13, 8, 1, PAL.black);                          // 허리띠
  const leg = (dx, len, lift) => { P(dx, 14 - lift, 3, len, PAL.white); P(dx, 14 - lift + len, 3, 1, team); P(dx - (dx < 0 ? 1 : 0), 15 - lift + len, 4, 1, PAL.black); };
  if(pose === 'lift'){ leg(-4, 5, 0); P(1, 11, 5, 3, PAL.white); P(5, 12, 2, 3, team); }
  else if(pose === 'follow' || pose === 'throw'){ leg(-5, 5, 0); leg(2, 5, 0); }
  else { leg(-4, 5, 0); leg(1, 5, 0); }
  // 팔과 글러브·방망이
  if(pose === 'set'){ P(-6, 7, 2, 5, PAL.white); P(4, 7, 2, 5, PAL.white); P(-1, 8, 3, 3, PAL.glove); }
  else if(pose === 'lift'){ P(-6, 6, 2, 4, PAL.white); P(-2, 7, 3, 3, PAL.glove); P(4, 6, 2, 4, PAL.white); }
  else if(pose === 'throw'){ P(4, 2, 2, 5, PAL.white); P(4, 0, 2, 2, PAL.skin); P(-7, 8, 3, 2, PAL.glove); }
  else if(pose === 'follow'){ P(-6, 9, 2, 4, PAL.white); P(3, 10, 4, 2, PAL.white); P(-7, 12, 3, 2, PAL.glove); }
  else if(pose === 'stance'){ P(2, 3, 2, 4, PAL.skin); P(3, -8, 2, 11, PAL.bat); }
  else if(pose === 'swing'){ P(-2, 7, 6, 2, PAL.skin); P(-15, 7, 13, 2, PAL.bat); }
  else if(pose === 'swfollow'){ P(-5, 3, 2, 4, PAL.skin); P(-10, -1, 2, 8, PAL.bat); }
  else if(pose === 'bunt'){ P(-2, 7, 2, 2, PAL.skin); P(-6, 6, 12, 2, PAL.bat); }
}
// 그림 파일의 동작 칸 (pitcher·batter: 32×48 네 칸)
const POSE_FRAME = { set:0, lift:1, throw:2, follow:3, stance:0, swing:1, swfollow:2, bunt:3 };
function drawPerson(kind, x, y, team, pose, flip){
  const file = kind === 'catcher' ? 'catcher' : kind;
  const im = tinted(file, team);
  if(im){
    const fw = kind === 'catcher' ? im.width : 32, fh = kind === 'catcher' ? im.height : 48, fr = POSE_FRAME[pose] || 0;
    const ctx = GX.ctx;
    ctx.save();
    if(flip){ ctx.translate(Math.round(x), 0); ctx.scale(-1, 1); ctx.drawImage(im, fr * fw, 0, fw, fh, -fw / 2, Math.round(y - fh + 20), fw, fh); }
    else ctx.drawImage(im, fr * fw, 0, fw, fh, Math.round(x - fw / 2), Math.round(y - fh + 20), fw, fh);
    ctx.restore();
    return;
  }
  person(x, y, team, pose, flip);
}

/* ---------- 투구 화면 ---------- */
function bgPitch(){
  if(GX.img['bg-pitch']){ GX.ctx.drawImage(GX.img['bg-pitch'], 0, 0); return; }
  R(0, 0, 256, 34, PAL.sky);
  R(0, 34, 256, 30, PAL.stand);
  const rnd = mulberry(7);   // 관중: 매번 같은 자리에 같은 색
  for(let y = 36; y < 62; y += 3) for(let x = (y % 2) * 2; x < 256; x += 4){ const c = ['#fcfcfc', '#f87858', '#fcd8a8', '#3cbcfc', '#f8b800', '#d8d8d8'][Math.floor(rnd() * 6)]; R(x, y, 2, 2, c); }
  R(0, 64, 256, 8, PAL.fence); R(0, 64, 256, 1, '#fcfcfc');
  for(let y = 72; y < 224; y += 8) R(0, y, 256, 4, PAL.grass), R(0, y + 4, 256, 4, PAL.grass2);
  // 내야 흙과 마운드, 홈 근처
  GX.ctx.fillStyle = PAL.dirt; GX.ctx.beginPath(); GX.ctx.moveTo(128, 96); GX.ctx.lineTo(236, 160); GX.ctx.lineTo(128, 224); GX.ctx.lineTo(20, 160); GX.ctx.closePath(); GX.ctx.fill();
  GX.ctx.fillStyle = PAL.grass; GX.ctx.beginPath(); GX.ctx.moveTo(128, 118); GX.ctx.lineTo(196, 158); GX.ctx.lineTo(128, 200); GX.ctx.lineTo(60, 158); GX.ctx.closePath(); GX.ctx.fill();
  R(110, 104, 36, 10, PAL.dirt2); R(116, 102, 24, 2, PAL.dirt2); R(124, 106, 8, 2, PAL.white);   // 마운드·투수판
  R(100, 190, 56, 30, PAL.dirt2); R(122, 200, 12, 4, PAL.white); R(124, 204, 8, 2, PAL.white);   // 홈
  R(104, 188, 12, 18, 'rgba(252,252,252,0.5)'); R(140, 188, 12, 18, 'rgba(252,252,252,0.5)');     // 타석 선
}
function mulberry(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// 위쪽 점수판 (볼·스트라이크·아웃 등과 주자 미니 다이아몬드)
function scoreBar(G){
  const [A, H] = G.teams;
  R(0, 0, 256, 18, '#000');
  pxText(`${A.short} ${runsOf(A)}`, 4, 2, A.color, 10, false, false);
  pxText(`${H.short} ${runsOf(H)}`, 70, 2, H.color, 10, false, false);
  pxText(G.over ? '경기 끝' : `${G.inning}회${G.top ? '초' : '말'}`, 136, 2, PAL.white, 10, false, false);
  const lamp = (lx, label, n, max, c) => { pxText(label, lx, 4, PAL.white, 8, false, false); for(let i = 0; i < max; i++) R(lx + 8 + i * 6, 7, 4, 4, i < n ? c : '#3c3c3c'); };
  lamp(170, 'B', G.balls, 3, '#58d854'); lamp(200, 'S', G.strikes, 2, '#f8b800'); lamp(224, 'O', G.outs, 2, PAL.red);
  // 주자: 오른쪽 위 작은 다이아몬드
  const base = (bx, by, on) => { R(bx, by, 5, 5, on ? PAL.ink : '#000'); R(bx + 1, by + 1, 3, 3, on ? PAL.ink : '#555'); };
  R(224, 20, 30, 22, 'rgba(0,0,0,0.55)');
  base(244, 29, G.bases[0] != null); base(236, 22, G.bases[1] != null); base(228, 29, G.bases[2] != null); R(237, 37, 3, 3, PAL.white);
}
// 스트라이크 존 좌표: x(-몸쪽~+바깥쪽)·y(+높게)를 화면으로. 오른손 타자면 바깥쪽이 화면 오른쪽
const zonePt = (x, y, hand) => ({ x: 128 + (hand === 'L' ? -x : x) * 10, y: 186 - y * 9 });
const BREAK = { FB:[0, -3], SI:[-5, 4], CT:[4, 1], SL:[9, 3], CU:[2, 14], CH:[-2, 8], FK:[0, 12] };
function drawPitchScene(G, A){
  bgPitch();
  const P = curPitcher(G), B = curBatter(G), F = fieldTeam(G), T = batTeam(G);
  const hand = (A && A.hand) || B.hand, left = hand === 'L';
  const ph = A ? A.ph : 'idle';   // idle·windup·flight·result
  const pPose = ph === 'windup' ? (A.t0 < 0.5 ? 'lift' : 'throw') : ph === 'flight' || ph === 'result' ? 'follow' : 'set';
  drawPerson('pitcher', 128, 82, F.color, pPose, false);
  // 공
  if(A && (ph === 'flight' || (ph === 'result' && A.res !== 'inplay'))){
    const tgt = zonePt(A.x, A.y, hand), k = ph === 'flight' ? A.t0 : 1;
    const br = BREAK[A.t] || [0, 0], dir = left ? -1 : 1;
    const sx = 130, sy = 92, cx = (sx + tgt.x) / 2 - br[0] * dir * 1.5, cy = (sy + tgt.y) / 2 - 10 - br[1];
    const bx = (1 - k) * (1 - k) * sx + 2 * (1 - k) * k * cx + k * k * tgt.x, by = (1 - k) * (1 - k) * sy + 2 * (1 - k) * k * cy + k * k * tgt.y;
    const s = 1 + k * 2.2;
    R(bx - s / 2, by - s / 2, s, s, PAL.ball);
    if(ph === 'result'){ R(tgt.x - 2, tgt.y - 2, 5, 5, A.res === 'take' && Math.abs(A.x) <= 1 && Math.abs(A.y) <= 1 ? PAL.ink : PAL.ball); }
  }
  // 스트라이크 존 (흐리게)
  GX.ctx.strokeStyle = 'rgba(252,252,252,0.35)'; GX.ctx.strokeRect(118.5, 177.5, 20, 18);
  // 타자: 오른손은 홈 왼쪽, 왼손은 오른쪽(좌우 뒤집음)
  let bPose = 'stance';
  if(A && (ph === 'flight' && A.t0 > 0.8 || ph === 'result')){ if(A.res === 'bunt') bPose = 'bunt'; else if(['whiff', 'foul', 'inplay'].includes(A.res)) bPose = ph === 'result' ? 'swfollow' : 'swing'; }
  drawPerson('batter', left ? 150 : 106, 182, T.color, bPose, left);
  drawPerson('catcher', 128, 204, F.color, 'squat', false);
  scoreBar(G);
  if(A && ph === 'result' && A.banner) banner(A.banner, 120, A.bannerColor || PAL.ink, 22);
}

/* ---------- 수비 화면 (위에서 본 야구장) ---------- */
const HOME = { x:128, y:210 }, PXM = 1.3;   // 1미터 = 1.3픽셀
const fieldPt = (ang, m) => ({ x: HOME.x + Math.sin(ang) * m * PXM, y: HOME.y - Math.cos(ang) * m * PXM });
const FIELD_ANG = [-0.55, 0, 0.55];
function fenceAt(G, ang){
  const f = (G.park && G.park.fence) || [98, 120, 98], a = Math.abs(ang) / 0.785, side = ang < 0 ? f[0] : f[2];
  return f[1] + (side - f[1]) * Math.min(1, a);
}
function bgField(G){
  if(GX.img['bg-field']){ GX.ctx.drawImage(GX.img['bg-field'], 0, 0); return; }
  const ctx = GX.ctx;
  R(0, 0, 256, 224, PAL.stand);
  const rnd = mulberry(11);
  for(let y = 0; y < 224; y += 3) for(let x = (y % 2) * 2; x < 256; x += 4) if(rnd() < 0.35) R(x, y, 2, 2, ['#fcfcfc', '#f87858', '#3cbcfc', '#f8b800'][Math.floor(rnd() * 4)]);
  ctx.fillStyle = PAL.fence; ctx.beginPath(); ctx.moveTo(HOME.x, HOME.y + 6);
  for(let a = -0.8; a <= 0.8001; a += 0.05){ const p = fieldPt(a, fenceAt(G, a) + 4); ctx.lineTo(p.x, p.y); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.grass; ctx.beginPath(); ctx.moveTo(HOME.x, HOME.y + 2);
  for(let a = -0.8; a <= 0.8001; a += 0.05){ const p = fieldPt(a, fenceAt(G, a)); ctx.lineTo(p.x, p.y); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.dirt; ctx.beginPath(); ctx.moveTo(HOME.x, HOME.y + 4); ctx.lineTo(HOME.x + 40, HOME.y - 34); ctx.lineTo(HOME.x, HOME.y - 66); ctx.lineTo(HOME.x - 40, HOME.y - 34); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.grass2; ctx.beginPath(); ctx.moveTo(HOME.x, HOME.y - 6); ctx.lineTo(HOME.x + 24, HOME.y - 30); ctx.lineTo(HOME.x, HOME.y - 54); ctx.lineTo(HOME.x - 24, HOME.y - 30); ctx.closePath(); ctx.fill();
  R(HOME.x - 3, HOME.y - 33, 6, 5, PAL.dirt2);
}
const BASE_PT = [{ x:153, y:185 }, { x:128, y:160 }, { x:103, y:185 }];
const FIELDER_HOME = { P:{ x:128, y:181 }, C:{ x:128, y:216 }, '1B':{ x:150, y:178 }, '2B':{ x:140, y:162 }, SS:{ x:115, y:162 }, '3B':{ x:106, y:178 }, LF:fieldPt(-0.5, 78), CF:fieldPt(0, 88), RF:fieldPt(0.5, 78) };
function tinyPlayer(x, y, team, frame){
  const im = tinted('fielder', team);
  if(im){ GX.ctx.drawImage(im, (frame % 4) * 16, 0, 16, 24, Math.round(x - 8), Math.round(y - 20), 16, 24); return; }
  R(x - 2, y - 7, 4, 2, team); R(x - 2, y - 5, 4, 2, PAL.skin); R(x - 3, y - 3, 6, 4, PAL.white);
  R(x - 3 + (frame % 2), y + 1, 2, 2, PAL.white); R(x + 1 - (frame % 2), y + 1, 2, 2, PAL.white);
}
function drawFieldScene(G, A){
  bgField(G);
  const F = fieldTeam(G), T = batTeam(G), bb = A.bb || {}, k = A.t0;
  const ang = FIELD_ANG[bb.fi ?? 1] + (A.jit || 0);
  const dist = bb.d || 60, land = fieldPt(ang, Math.min(dist, 140));
  // 야수: 공에 가장 가까운 야수가 쫓아감
  const keys = Object.keys(FIELDER_HOME);
  let near = 'CF', nd = 1e9;
  keys.forEach(p => { const h = FIELDER_HOME[p], dd = Math.hypot(h.x - land.x, h.y - land.y); if(p !== 'C' && dd < nd){ nd = dd; near = p; } });
  keys.forEach(p => {
    const h = FIELDER_HOME[p], hx = h.x, hy = h.y;
    const go = p === near ? Math.min(1, k * 1.2) : 0;
    tinyPlayer(hx + (land.x - hx) * go * 0.9, hy + (land.y - hy) * go * 0.9, F.color, Math.floor(k * 10));
  });
  // 주자 (플레이가 끝난 뒤의 자리)
  G.bases.forEach((r, i) => { if(r != null && A.ph === 'fresult') tinyPlayer(BASE_PT[i].x, BASE_PT[i].y, T.color, 0); });
  BASE_PT.forEach(b => R(b.x - 2, b.y - 2, 4, 4, PAL.white));
  // 타구: 뜬공은 높이 떠서(그림자와 공), 땅볼은 굴러감
  const kk = Math.min(1, k);
  const bx = HOME.x + (land.x - HOME.x) * kk, by = HOME.y + (land.y - HOME.y) * kk;
  const high = bb.type === 'fb' || bb.type === 'pu' ? Math.sin(kk * Math.PI) * (bb.type === 'pu' ? 40 : 30 + dist / 6) : bb.type === 'ld' ? Math.sin(kk * Math.PI) * 8 : 0;
  R(bx - 1, by - 1, 3, 2, 'rgba(0,0,0,0.45)');
  R(bx - 1.5, by - 1.5 - high, 3, 3, PAL.ball);
  scoreBar(G);
  if(A.ph === 'fresult' && A.banner){ banner(A.banner, 96, A.bannerColor || PAL.ink, 24); if(A.hr && Math.floor(performance.now() / 150) % 2) pxText('★', 60, 70, PAL.red, 18), pxText('★', 196, 70, PAL.ink, 18); }
}

/* ---------- 움직임 ---------- */
// 결과 글씨: 이번에 생긴 효과음 사건으로 정함
function bannerOf(fx){
  const has = n => fx.includes(n);
  if(has('hr')) return ['홈런!', PAL.red, true];
  if(has('b3')) return ['3루타!', PAL.ink]; if(has('b2')) return ['2루타!', PAL.ink]; if(has('hit')) return ['안타!', PAL.ink];
  if(has('k')) return ['삼진!', '#3cbcfc']; if(has('ball')) return ['볼넷', '#58d854']; if(has('out')) return ['아웃!', '#3cbcfc'];
  if(fx.some(n => /^whiff/.test(n))) return ['헛스윙!', '#f8b800']; if(has('foul')) return ['파울', PAL.white];
  if(has('strike')) return ['스트라이크!', '#f8b800']; if(has('ballc')) return ['볼', '#58d854']; if(has('safe')) return ['세이프!', PAL.ink];
  return null;
}
function gfxStart(G, fx){
  const A0 = G.anim;
  let bn = bannerOf(fx || []);
  if(A0 && A0.res === 'hbp') bn = ['몸에 맞는 공', '#58d854'];
  if(!A0){ if(bn) GX.anim = { simple:true, ph:'result', t0:1, start: performance.now(), banner: bn[0], bannerColor: bn[1], hr: bn[2] }; return; }
  GX.anim = { ...A0, ph:'windup', t0:0, start: performance.now(), banner: bn && bn[0], bannerColor: bn && bn[1], hr: bn && bn[2], jit: (Math.random() - 0.5) * 0.3 };
}
const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function gfxTick(){
  GX.raf = 0;
  if(!GX.cv || !document.contains(GX.cv) || !G) return;
  const A = GX.anim, now = performance.now();
  if(A){
    const el = (now - A.start) / (REDUCED() ? 4 : 1);
    // 시간표: 투구 동작 0.3초 → 공 0.4초 → 결과 0.9초 (치면) → 타구 1.1초 → 결과 1.2초
    if(A.simple){ A.ph = 'result'; if(el > 1200) GX.anim = null; }
    else if(el < 300){ A.ph = 'windup'; A.t0 = el / 300; }
    else if(el < 700){ A.ph = 'flight'; A.t0 = (el - 300) / 400; }
    else if(A.res !== 'inplay' || !A.bb){ A.ph = 'result'; A.t0 = 1; if(el > 1600) GX.anim = null; }
    else if(el < 1000){ A.ph = 'result'; A.banner0 = A.banner; }
    else if(el < 2100){ A.ph = 'fly'; A.t0 = (el - 1000) / 1100; }
    else { A.ph = 'fresult'; A.t0 = 1; if(el > 3300) GX.anim = null; }
  }
  const B = GX.anim;
  if(B && (B.ph === 'fly' || B.ph === 'fresult')) drawFieldScene(G, B);
  else drawPitchScene(G, B && !(B.res === 'inplay' && B.ph === 'result' && B.bb) ? B : (B ? { ...B, banner:null } : null));
  if(GX.anim) GX.raf = requestAnimationFrame(gfxTick);
}
// render()가 부름: 화면 모드일 때 상황판 자리에 그림판을 두고, 새 투구가 있으면 움직임을 시작
function gfxRender(G, fx){
  const bs = $('#boardSec');
  let wrap = bs.querySelector('.gfxwrap');
  if(!wrap){
    wrap = document.createElement('div'); wrap.className = 'gfxwrap'; wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = '<canvas id="gfx" width="256" height="224"></canvas>';
    GX.cv = wrap.firstChild; GX.ctx = GX.cv.getContext('2d'); GX.ctx.imageSmoothingEnabled = false; GX.key = '';
    if(!GX.img.__) gfxLoad();
  }
  bs.prepend(wrap);
  const key = `${G.at}:${G.anim ? G.anim.n : 0}:${G.seq}`;
  if(key !== GX.key){
    const fresh = GX.key && GX.key.split(':')[0] === String(G.at);
    GX.key = key;
    if(fresh) gfxStart(G, fx);
  }
  if(!GX.raf) GX.raf = requestAnimationFrame(gfxTick);
}
