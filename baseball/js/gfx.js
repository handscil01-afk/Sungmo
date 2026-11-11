'use strict';
/* ===================== 화면 모드(비장애인 모드)의 도트 그래픽 =====================
   패미컴 해상도(256×224)로 그리고 CSS로 정수배 확대함(image-rendering: pixelated).
   - 투구 화면: 포수 뒤에서 본 야구장. 투수 투구 동작 → 공이 구종에 따라 휘며 날아옴 → 타자 스윙 → 결과 글씨
   - 수비 화면: 공을 치면 위에서 본 야구장으로 바뀌어 타구가 날아가고 야수가 쫓아감. 홈런이면 담장을 넘김
   그림 파일(img/*.png, GPT로 만든 도트 그림)이 있으면 그것을 쓰고, 없으면 코드로 그린 도트 그림을 씀.
   팀 색 자리는 그림에서 자홍색(#FF00FF)으로 칠해 두면 팀 색으로 바꿔 칠함. 이 화면은 눈으로 보는 용도라 화면 낭독기에는 숨김 */
const GX = { W:256, H:224, cv:null, ctx:null, key:'', anim:null, queue:[], raf:0, img:{}, tinted:{}, meta:{}, cam:{ x:0, y:0 }, lastAnimN:null, lastPlayN:null };
const PAL = { sky:'#5c94fc', stand:'#3c3c64', fence:'#00682c', grass:'#38a838', grass2:'#4cbc4c', dirt:'#c88850', dirt2:'#b87840', line:'#fcfcfc',
  skin:'#f8b878', white:'#fcfcfc', black:'#000000', glove:'#a85010', bat:'#e4a050', ball:'#fcfcfc', ink:'#fcfc54', red:'#f83800' };
const GX_FILES = ['bg-pitch', 'bg-field', 'pitcher', 'batter', 'catcher', 'fielder', 'banners', 'banners2', 'umpire', 'umpire-s', 'runner', 'tv', 'fielder2', 'runner-s', 'fielder-set', 'run-g', 'run-b', 'slide', 'run-f', 'run-k', 'cr-cage', 'cr-gym', 'cr-bullpen', 'cr-track', 'cr-room', 'cr-shop', 'cr-fansign', 'cr-rehab', 'cr-train', 'cr-life', 'cr-people', 'cr-props'];
// 결과 글씨 (banners.png를 쓸 때는 이 순서로 한 줄에 하나씩, 128×32)
const BANNERS = ['스트라이크!', '볼', '헛스윙!', '파울', '안타!', '2루타!', '3루타!', '홈런!', '아웃!', '삼진!', '볼넷', '세이프!', '몸에 맞는 공'];
const BANNERS2 = ['비디오 판독', '판정 번복!', '원심 유지', '견제!', '도루!', '병살!', '끝내기!', '게임 셋!'];
// 결과 글씨: 화면 해상도 그대로 글꼴로 그려 매끈하게 (두꺼운 검정 테두리 + 아래쪽 그림자). 홈런은 별 모양 바탕
function banner(text, y, color, size){
  const ctx = GX.ctx, fs = Math.round(size * 1.15);
  ctx.save();
  ctx.font = `900 ${fs}px 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const cy = y + 12;
  if(text === '홈런!'){
    const w = ctx.measureText(text).width / 2 + 16;
    ctx.beginPath();
    for(let i = 0; i < 28; i++){ const a = i / 28 * Math.PI * 2, r = i % 2 ? 0.72 : 1; ctx.lineTo(128 + Math.cos(a) * w * r, cy + Math.sin(a) * (fs * 0.95) * r); }
    ctx.closePath(); ctx.fillStyle = '#fce000'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#f83800'; ctx.stroke();
  }
  ctx.lineWidth = fs * 0.28; ctx.strokeStyle = '#000';
  ctx.strokeText(text, 128, cy + 1.5); ctx.strokeText(text, 128, cy);
  ctx.fillStyle = color; ctx.fillText(text, 128, cy);
  ctx.restore();
}

// img/index.json에 적힌 그림만 불러옴 (없는 파일을 찾느라 오류가 나지 않게)
function gfxLoad(){
  if(GX.img.__) return;
  GX.img.__ = true; GX.pending = 1;
  fetch(new URL('img/index.json', document.baseURI).href).then(r => r.ok ? r.json() : []).catch(() => []).then(list => {
    GX.pending = 0;
    if(list && !Array.isArray(list)){ GX.meta = list; list = Object.keys(list); }
    const want = (list || []).filter(n => GX_FILES.includes(n));
    GX.pending = want.length;
    const done = () => { GX.pending--; if(GX.cv && !GX.raf) GX.raf = requestAnimationFrame(gfxTick); };
    want.forEach(n => {
    const im = new Image();
    im.onerror = done;
    im.onload = () => { GX.img[n] = im; GX.tinted = {}; done(); };
    im.src = new URL(`img/${n}.png`, document.baseURI).href;
    });
  });
}
// 그림 파일의 자홍색 칸을 팀 색으로 바꾼 사본 (색마다 한 번 만들어 둠)
function tinted(name, color){
  const k = name + color; if(GX.tinted[k]) return GX.tinted[k];
  const im = GX.img[name]; if(!im) return null;
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  const r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
  for(let i = 0; i < p.length; i += 4) if(p[i + 3] > 0 && p[i] > 150 && p[i + 2] > 110 && p[i + 1] < 90 && p[i + 2] > p[i + 1] + 60){ p[i] = r; p[i + 1] = g; p[i + 2] = b; }
  x.putImageData(d, 0, 0);
  return (GX.tinted[k] = c);
}
const R = (x, y, w, h, c) => { GX.ctx.fillStyle = c; GX.ctx.fillRect(Math.round(x), Math.round(y), w, h); };
// 도트 글씨: 글자를 그린 뒤 반투명한 테두리를 없애 또렷하게
// 작은 글씨(점수판 등): 화면 해상도 그대로 글꼴로 그림
function pxText(str, x, y, color, size = 10, center = true, outline = true){
  const ctx = GX.ctx;
  ctx.save();
  ctx.font = `bold ${size}px 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif`;
  ctx.textAlign = center ? 'center' : 'left'; ctx.textBaseline = 'top'; ctx.lineJoin = 'round';
  if(outline){ ctx.lineWidth = size * 0.22; ctx.strokeStyle = '#000'; ctx.strokeText(str, x, y + 1); }
  ctx.fillStyle = color; ctx.fillText(str, x, y + 1);
  ctx.restore();
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
// 그림 파일의 동작 칸 (img/index.json의 칸 크기·줄 수). 발끝 가운데를 (x, foot)에 맞춰 그림
const POSE_FRAME = { set:0, lift:1, throw:2, follow:3, stance:0, swing:1, swfollow:2, bunt:3, u0:0, u1:1, u2:2, u3:3, u4:4, run0:0, run1:1, slideH:2, slideF:3, tag0:4, tag1:5, throw0:6, throw1:7, p0:0, p1:1, p2:2, p3:3 };
function drawPerson(kind, x, foot, team, pose, flip, row = 0){
  const im = tinted(kind, team), m = GX.meta[kind];
  if(im && m){
    let f0 = POSE_FRAME[pose] || 0, r = row;
    if(f0 >= m.n){ r = Math.floor(f0 / m.n); f0 %= m.n; }
    const fr = Math.min(m.n - 1, f0), ctx = GX.ctx; r = Math.min(m.rows - 1, r);
    const dx = Math.round(x - m.w / 2), dy = Math.round(foot - m.h);
    ctx.save();
    if(flip){ ctx.translate(dx + m.w, dy); ctx.scale(-1, 1); ctx.drawImage(im, fr * m.w, r * m.h, m.w, m.h, 0, 0, m.w, m.h); }
    else ctx.drawImage(im, fr * m.w, r * m.h, m.w, m.h, dx, dy, m.w, m.h);
    ctx.restore();
    return;
  }
  person(x, foot - (kind === 'catcher' ? 14 : 20), team, pose, flip);
}
// 투수 폼: 투수마다 정해짐 (오버핸드 60%, 사이드암 25%, 언더핸드 15%). 그림 줄 번호
function armSlot(P){ let h = 7; for(const c of String(P.name) + P.id) h = (h * 31 + c.charCodeAt(0)) | 0; const v = Math.abs(h) % 20; return v < 12 ? 0 : v < 17 ? 1 : 2; }
// 화면 배치: 그림 파일 배경과 코드로 그린 배경의 자리가 다름
const LAY_IMG = { pitcher:[128, 121], batR:[76, 214], batL:[180, 214], catcher:[128, 244], zone:[128, 160, 12, 11], release:[[121, 88], [114, 96], [118, 108]] };
const LAY_CODE = { pitcher:[128, 102], batR:[106, 202], batL:[150, 202], catcher:[128, 218], zone:[128, 186, 10, 9], release:[[130, 92], [126, 96], [128, 100]] };
const lay = () => GX.img['bg-pitch'] && GX.meta.pitcher ? LAY_IMG : LAY_CODE;

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
  R(0, 0, 256, 31, '#000'); R(0, 31, 256, 1, '#3c3c64');
  // 왼쪽: 두 팀 점수 (공격 중인 팀 앞에 ▶)
  [[A, 1], [H, 16]].forEach(([T, y], i) => {
    if(!G.over && (i === 0) === G.top) pxText('▶', 2, y + 1, PAL.ink, 8, false, false);
    pxText(T.short, 11, y, T.color, 11, false, false);
    pxText(String(runsOf(T)), 70, y, PAL.white, 11, false, false);
  });
  pxText(G.over ? '경기 끝' : `${G.inning}회${G.top ? '초' : '말'}`, 100, 8, PAL.white, 12, true, false);
  // 볼·스트라이크·아웃
  const lamp = (lx, y, label, n, max, c) => { pxText(label, lx, y, PAL.white, 9, false, false); for(let i = 0; i < max; i++){ R(lx + 10 + i * 9, y + 2, 7, 7, '#000'); R(lx + 11 + i * 9, y + 3, 5, 5, i < n ? c : '#3c3c3c'); } };
  lamp(126, 1, 'B', G.balls, 3, '#58d854'); lamp(126, 11, 'S', G.strikes, 2, '#f8b800'); lamp(126, 21, 'O', G.outs, 2, PAL.red);
  // 주자: 오른쪽 작은 다이아몬드
  const base = (bx, by, on) => { R(bx, by, 8, 8, '#000'); R(bx + 1, by + 1, 6, 6, on ? PAL.ink : '#555'); };
  // (오른쪽 끝 36픽셀은 메뉴 단추 자리)
  base(202, 12, G.bases[0] != null); base(188, 2, G.bases[1] != null); base(174, 12, G.bases[2] != null); R(190, 24, 4, 4, PAL.white);
}
// 스트라이크 존 좌표: x(-몸쪽~+바깥쪽)·y(+높게)를 화면으로. 오른손 타자면 바깥쪽이 화면 오른쪽
const zonePt = (x, y, hand) => { const z = lay().zone; return { x: z[0] + (hand === 'L' ? -x : x) * z[2], y: z[1] - y * z[3] }; };
const BREAK = { FB:[0, -3], SI:[-5, 4], CT:[4, 1], SL:[9, 3], CU:[2, 14], CH:[-2, 8], FK:[0, 12] };
function drawPitchScene(G, A){
  bgPitch();
  const L = lay(), P = curPitcher(G), B = curBatter(G), F = fieldTeam(G), T = batTeam(G);
  const hand = (A && A.hand) || B.hand, left = hand === 'L', pl = P.hand === 'L', slot = armSlot(P);
  const ph = A ? A.ph : 'idle';   // idle·windup·flight·result
  const pPose = ph === 'windup' ? (A.t0 < 0.5 ? 'lift' : 'throw') : ph === 'flight' ? (A.t0 < 0.15 ? 'throw' : 'follow') : ph === 'result' ? 'follow' : 'set';
  drawPerson('pitcher', L.pitcher[0], L.pitcher[1], F.color, pPose, pl, slot);
  // 스트라이크 존 (흐리게)
  const z = L.zone;
  // 스트라이크 존 9칸 (흐리게)
  GX.ctx.strokeStyle = 'rgba(252,252,252,0.4)'; GX.ctx.lineWidth = 0.5;
  for(let i = 0; i <= 3; i++){
    const gx = z[0] - z[2] + i * z[2] * 2 / 3, gy = z[1] - z[3] + i * z[3] * 2 / 3;
    GX.ctx.beginPath(); GX.ctx.moveTo(gx, z[1] - z[3]); GX.ctx.lineTo(gx, z[1] + z[3]); GX.ctx.moveTo(z[0] - z[2], gy); GX.ctx.lineTo(z[0] + z[2], gy); GX.ctx.stroke();
  }
  GX.ctx.lineWidth = 1;
  if(GX.meta.umpire && L === LAY_IMG){
    const call = A && ph === 'result' ? ({ '스트라이크!':'u1', '삼진!':'u1', '헛스윙!':'u1', '파울':'u3' })[A.banner] || 'u0' : 'u0';
    // 주심은 콜할 때만, 타자 반대편 포수 옆에 나타남 (포수 뒤에 그려서 겹쳐도 포수가 앞)
    if(call !== 'u0') drawPerson('umpire', left ? 76 : 180, 226, '#ff00ff', call, false);
  }
  drawPerson('catcher', L.catcher[0], L.catcher[1], F.color, 'squat', false);
  // 공: 투수 손에서 나와 구종에 따라 휘며 커짐 (왼손 투수는 반대쪽 손)
  const rel = L.release[slot], sx = pl ? 2 * L.pitcher[0] - rel[0] : rel[0], sy = rel[1];
  const tgt = A ? zonePt(A.x, A.y, hand) : null;
  if(A && (ph === 'flight' || (ph === 'result' && A.res !== 'inplay'))){
    const k = ph === 'flight' ? A.t0 : 1;
    const br = BREAK[A.t] || [0, 0], dir = pl ? -1 : 1;
    const cx = (sx + tgt.x) / 2 - br[0] * dir * 1.5, cy = (sy + tgt.y) / 2 - 10 - br[1] - (slot === 2 ? -6 : 0);
    const bx = (1 - k) * (1 - k) * sx + 2 * (1 - k) * k * cx + k * k * tgt.x, by = (1 - k) * (1 - k) * sy + 2 * (1 - k) * k * cy + k * k * tgt.y;
    ball(bx, by, 1.5 + k * 2.5);
    if(ph === 'result' && A.res === 'take' && Math.abs(A.x) <= 1 && Math.abs(A.y) <= 1) R(tgt.x - 3, tgt.y - 3, 7, 1, PAL.ink), R(tgt.x - 3, tgt.y + 3, 7, 1, PAL.ink);
  }
  // 쳤을 때: 공이 방망이에 맞고 튀어 나감 (뜬공은 위로, 땅볼은 투수 쪽 아래로)
  if(A && ph === 'result' && A.res === 'inplay' && A.bb){
    const k = Math.min(1, A.t0 * 1.4), up = A.bb.type === 'gb' ? 0.2 : A.bb.type === 'ld' ? 0.6 : 1.2, side = [-1, 0, 1][A.bb.fi ?? 1] * 60;
    ball(tgt.x + side * k, tgt.y - (tgt.y - 40) * k * up, 4 - k * 2);
  }
  // 타자: 오른손은 홈 왼쪽, 왼손은 오른쪽(좌우 뒤집음)
  let bPose = 'stance';
  const isBunt = A && (A.res === 'bunt' || (A.bb && A.bb.ps && A.bb.ps.bunt));
  if(isBunt && (ph === 'flight' || ph === 'result')) bPose = 'bunt';
  else if(A && (ph === 'flight' && A.t0 > 0.8 || ph === 'result')){ if(A.res === 'bunt') bPose = 'bunt'; else if(['whiff', 'foul', 'inplay'].includes(A.res)) bPose = ph === 'result' && A.t0 > 0.3 ? 'swfollow' : 'swing'; }
  // 주자: 베이스에서 리드하고 있는 모습 (1루는 오른쪽, 3루는 왼쪽, 2루는 투수 뒤)
  if(L === LAY_IMG && GX.meta['runner-s']){
    // 다음 베이스 쪽을 바라봄: 1루·2루 주자는 왼쪽(2루·3루 쪽), 3루 주자는 오른쪽(홈 쪽)
    (GX.meta['run-b'] ? [[226, 146, true], [160, 100, true], [30, 146, false]] : [[226, 146, false], [160, 100, true], [30, 146, true]]).forEach(([x, y, flip], i) => {
      if(G.bases[i] == null) return;
      R(x - 4 + (flip ? 6 : -6), y - 1, 8, 3, PAL.white);   // 베이스
      if(GX.meta['run-b']) drawPerson('run-b', x + (flip ? -6 : 6), y, T.color, 'p0', flip); else drawPerson('runner-s', x + (flip ? -6 : 6), y, T.color, 'p0', flip);
    });
  }
  const bp = left ? L.batL : L.batR;
  // 서 있는 자세만 반대로 뒤집음 (왼쪽 타석은 방망이를 오른쪽에 들고 섬). 휘두르는 그림은 원래 방향 그대로
  // 왼쪽 타석(오른손): 방망이를 오른쪽에 들고 서서 왼쪽으로 휘두르고, 휘두른 뒤 방망이가 왼쪽 위로. 오른쪽 타석은 그 반대
  drawPerson('batter', bp[0], bp[1], T.color, bPose, (bPose === 'stance' || bPose === 'swing') ? !left : left);
  scoreBar(G);
  if(A && ph === 'result' && A.banner) banner(A.banner, 112, A.bannerColor || PAL.ink, 22);
}
// 공 하나 (크기 s): 흰 공에 검정 테두리
function ball(x, y, s){
  const r = Math.max(1, Math.round(s));
  if(r <= 1){ R(x, y, 2, 2, PAL.ball); return; }
  R(x - r / 2 - 1, y - r / 2, r + 2, r, '#000'); R(x - r / 2, y - r / 2 - 1, r, r + 2, '#000'); R(x - r / 2, y - r / 2, r, r, PAL.ball);
}

/* ---------- 수비 화면 (위에서 본 넓은 야구장, 화면이 공을 따라감) ----------
   fm(각도, 미터)은 야구장 위 한 점을 '세계 좌표'로. 각도 0은 가운데, +는 오른쪽(1루 쪽), ±0.785가 파울선.
   그림 배경(512×512)은 외야가 실제보다 눌려 있어서, 베이스까지는 그대로 줄이고 그 너머는 그 구장의 담장 거리가 그림의 담장에 오도록 맞춤 */
const HOME = { x:128, y:210 }, PXM = 1.3;   // 코드로 그린 배경: 1미터 = 1.3픽셀
const FIELD_ANG = [-0.55, 0, 0.55];
const FW = { home:[256, 400], b1:[346, 302], b2:[256, 231], b3:[166, 302], gC:1.95, gS:2.38 };
const wide = () => !!(GX.img['bg-field'] && GX.meta['bg-field'] && GX.meta['bg-field'].w >= 512);
const worldW = () => wide() ? GX.meta['bg-field'].w : 256, worldH = () => wide() ? GX.meta['bg-field'].h : 224;
function fm(ang, m){
  if(!wide()) return { x: HOME.x + Math.sin(ang) * m * PXM, y: HOME.y - Math.cos(ang) * m * PXM };
  const a = Math.max(-0.785, Math.min(0.785, ang)), t = Math.abs(a) / 0.785, side = a < 0 ? FW.b3 : FW.b1;
  const ring = [FW.b2[0] + (side[0] - FW.b2[0]) * t, FW.b2[1] + (side[1] - FW.b2[1]) * t];
  const rr = 38.8 / (Math.sin(Math.abs(a)) + Math.cos(a)), fence = fenceAt(G, a), gf = FW.gC + (FW.gS - FW.gC) * t;
  const g = m <= rr ? m / rr : 1 + (gf - 1) * (m - rr) / Math.max(10, fence - rr);
  const p = { x: FW.home[0] + (ring[0] - FW.home[0]) * g, y: FW.home[1] + (ring[1] - FW.home[1]) * g };
  if(ang !== a) p.x += (ang - a) * 260;   // 파울 지역 바깥
  return p;
}
function fenceAt(G, ang){
  if(typeof fenceAng === 'function') return fenceAng(G, ang);   // 판정과 같은 담장
  const f = (G && G.park && G.park.fence) || [98, 120, 98], a = Math.abs(ang) / 0.785, side = ang < 0 ? f[0] : f[2];
  return f[1] + (side - f[1]) * Math.min(1, a);
}
function bgField(G){
  if(wide()){ GX.ctx.drawImage(parkBg(G), 0, 0); parkExtra(G); return; }
  const ctx = GX.ctx;
  R(0, 0, 256, 224, PAL.stand);
  const rnd = mulberry(11);
  for(let y = 0; y < 224; y += 3) for(let x = (y % 2) * 2; x < 256; x += 4) if(rnd() < 0.35) R(x, y, 2, 2, ['#fcfcfc', '#f87858', '#3cbcfc', '#f8b800'][Math.floor(rnd() * 4)]);
  ctx.fillStyle = PAL.fence; ctx.beginPath(); ctx.moveTo(HOME.x, HOME.y + 6);
  for(let a = -0.8; a <= 0.8001; a += 0.05){ const p = fm(a, fenceAt(G, a) + 4); ctx.lineTo(p.x, p.y); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.grass; ctx.beginPath(); ctx.moveTo(HOME.x, HOME.y + 2);
  for(let a = -0.8; a <= 0.8001; a += 0.05){ const p = fm(a, fenceAt(G, a)); ctx.lineTo(p.x, p.y); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.dirt; ctx.beginPath(); ctx.moveTo(HOME.x, HOME.y + 4); ctx.lineTo(HOME.x + 40, HOME.y - 34); ctx.lineTo(HOME.x, HOME.y - 66); ctx.lineTo(HOME.x - 40, HOME.y - 34); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.grass2; ctx.beginPath(); ctx.moveTo(HOME.x, HOME.y - 6); ctx.lineTo(HOME.x + 24, HOME.y - 30); ctx.lineTo(HOME.x, HOME.y - 54); ctx.lineTo(HOME.x - 24, HOME.y - 30); ctx.closePath(); ctx.fill();
  R(HOME.x - 3, HOME.y - 33, 6, 5, PAL.dirt2);
  BASE_POL.forEach(([a, m]) => { const b = fm(a, m); R(b.x - 2, b.y - 2, 4, 4, PAL.white); });
}
const BASE_POL = [[0.785, 27.4], [0, 38.8], [-0.785, 27.4]];
const FPOS = { P:[0, 18.4], '1B':[0.6, 30], '2B':[0.2, 39], SS:[-0.2, 39], '3B':[-0.6, 30], LF:[-0.5, 82], CF:[0, 94], RF:[0.5, 82] };
// 수비 화면의 작은 사람. mode: ready 서 있음 · run 달림 · catch 공 잡음 · throw 던짐 · runner 주자 달림 · base 베이스 위 주자
function tinyPlayer(x, y, team, mode, frame = 0, flip = false, dir = null){
  const has = n => GX.meta[n] && tinted(n, team);
  // 달리기: 움직이는 방향에 맞는 그림 (옆 · 정면(화면 아래로) · 뒷모습(화면 위로)). 수비는 글러브 낀 그림, 주자는 맨손. 옆 그림은 오른쪽을 보므로 왼쪽으로 갈 때 뒤집음
  if((mode === 'run' || mode === 'runner') && has('run-f')){
    const dx = dir ? dir[0] : (flip ? -1 : 1), dy = dir ? dir[1] : 0, f = 'p' + (frame % 4);
    if(Math.abs(dy) > Math.abs(dx) * 1.3) return drawPerson(dy > 0 ? 'run-f' : 'run-k', x, y, team, f, false);
    return drawPerson(mode === 'run' ? 'run-g' : 'run-b', x, y, team, f, dx < 0);
  }
  if(mode === 'slide' && has('slide')) return drawPerson('slide', x, y, team, 'p' + Math.min(3, frame), flip);
  // 달리는 수비수도 주자와 같은 달리기 그림(팀 색), 가는 쪽을 바라봄
  if(mode === 'base' && has('fielder-set')) return drawPerson('fielder-set', x, y, team, 'p0', false);
  if(mode === 'run' && has('fielder')) return drawPerson('fielder', x, y, team, ['set', 'lift', 'throw', 'follow'][frame % 4], false);
  if((mode === 'runner' || mode === 'base') && has('runner-s')) return drawPerson('runner-s', x, y, team, mode === 'base' ? 'p0' : ['p0', 'p1'][frame % 2], flip);
  // 서 있거나 잡거나 던질 때: 투수의 준비 자세(글러브를 가슴에)를 작게. 공 그림이 섞이지 않아 깔끔함
  if(has('fielder-set')) return drawPerson('fielder-set', x, y, team, 'p0', false);
  if(has('fielder2')) return drawPerson('fielder2', x, y, team, { ready:'p1', catch:'p0', throw: frame % 2 ? 'p3' : 'p2' }[mode] || 'p1', flip);
  R(x - 2, y - 7, 4, 2, team); R(x - 2, y - 5, 4, 2, PAL.skin); R(x - 3, y - 3, 6, 4, PAL.white);
  R(x - 3 + (frame % 2), y + 1, 2, 2, PAL.white); R(x + 1 - (frame % 2), y + 1, 2, 2, PAL.white);
}
// 타구가 떨어지는(잡히는) 거리: 엔진이 정한 거리, 없으면 타구 종류로 짐작
function landDist(G, bb, ang){
  const fence = fenceAt(G, ang);
  if(bb.hit === 4) return Math.max(bb.d || 0, fence + 14);
  if(bb.d) return Math.min(bb.d, fence - 2);
  return { gb:35, ld:bb.hit ? 70 : 55, fb:bb.hit >= 2 ? fence - 8 : 78, pu:24 }[bb.type] || 60;
}
function drawFieldScene(G, A){
  if(A.bb && A.bb.ps && A.tl && A.tl.scale) return drawPlayReplay(G, A);
  const F = fieldTeam(G), T = batTeam(G), bb = A.bb || {}, k = Math.min(1, A.t0), ctx = GX.ctx;
  const ang = FIELD_ANG[bb.fi ?? 1] + (A.jit || 0);
  const dist = landDist(G, bb, ang), land = fm(ang, dist), home = fm(0, 0);
  // 타구: 그림자는 땅을 따라가고, 공은 높이만큼 위에 크게 (높이 뜨면 화면에 가까워지는 것처럼)
  // 시간표: 땅볼 아웃은 야수가 잡는 순간(field)까지 공이 굴러가고, 그다음 1루로 송구(result에 도착)
  const TL = A.tl || playTL(A, []), fs = TL.contact + 0.25, now = A.ph === 'fresult' ? TL.result : fs + k * (TL.result - fs);
  const b1 = fm(...BASE_POL[0]), gbOut = bb.type === 'gb' && !bb.hit && TL.field;
  const kRoll = gbOut ? Math.min(1, (now - fs) / (TL.field - fs)) : k;
  let gx = home.x + (land.x - home.x) * kRoll, gy = home.y + (land.y - home.y) * kRoll;
  if(gbOut && now > TL.field){ const q = Math.min(1, (now - TL.field) / (TL.result - TL.field)); gx = land.x + (b1.x - land.x) * q; gy = land.y + (b1.y - land.y) * q; }   // 송구(1루수가 잡았으면 들고 감)
  const apex = { fb: 22 + dist / 5, pu: 38, ld: 5, gb: 0 }[bb.type] ?? 15;
  let h = 4 * apex * k * (1 - k);
  if(bb.type === 'gb') h = gbOut && now > TL.field ? 3 : Math.abs(Math.sin(kRoll * Math.PI * 3)) * 2.5 * (1 - kRoll);
  const lift = h * (wide() ? 1.1 : 0.9);
  // 화면(카메라): 처음엔 내야 전체, 그다음 공을 부드럽게 따라감
  const W = worldW(), H = worldH(), clampC = c => ({ x: Math.max(0, Math.min(W - 256, c.x)), y: Math.max(0, Math.min(H - 224, c.y)) });
  if(!A.camInit){ A.camInit = true; GX.cam = clampC({ x: home.x - 128, y: home.y - 196 }); }
  const want = clampC({ x: gx - 128, y: gy - lift * 0.5 - 118 });
  GX.cam = { x: GX.cam.x + (want.x - GX.cam.x) * 0.12, y: GX.cam.y + (want.y - GX.cam.y) * 0.12 };
  ctx.save(); ctx.translate(-Math.round(GX.cam.x), -Math.round(GX.cam.y));
  bgField(G);
  // 야수: 공에 가장 가까운 야수가 쫓아감 (홈런이면 담장까지)
  const chase = bb.hit === 4 ? fm(ang, fenceAt(G, ang) - 3) : land;
  let near = 'CF', nd = 1e9;
  const pts = {}; Object.keys(FPOS).forEach(p => { pts[p] = fm(FPOS[p][0], FPOS[p][1]); const dd = Math.hypot(pts[p].x - chase.x, pts[p].y - chase.y); if(dd < nd){ nd = dd; near = p; } });
  // 공에 가장 가까운 야수만 쫓아감: 아웃은 떨어지기 전에 도착해 잡고, 안타는 공이 떨어진 뒤에야 도착해 던짐. 나머지는 서 있음
  const people = Object.keys(FPOS).map(p => {
    const hp = pts[p];
    // 땅볼 아웃: 다른 내야수가 잡으면 1루수가 베이스로 들어가 송구를 받음
    if(p === '1B' && gbOut && near !== '1B'){ const q = Math.min(1, (now - fs) / Math.max(0.2, TL.field - fs)); return [hp.x + (b1.x + 4 - hp.x) * q, hp.y + (b1.y - hp.y) * q, F.color, q < 1 ? 'run' : 'catch', Math.floor(now * 12), true]; }
    // 1루수가 직접 잡으면 공을 들고 베이스를 밟음
    if(p === '1B' && gbOut && near === '1B' && now > TL.field){ const q = Math.min(1, (now - TL.field) / (TL.result - TL.field)); return [land.x + (b1.x - land.x) * q, land.y + (b1.y - land.y) * q, F.color, q < 1 ? 'run' : 'catch', Math.floor(now * 12), true]; }
    if(p !== near) return [hp.x, hp.y, F.color, 'ready', 0, hp.x < chase.x];
    // 땅볼은 잡는 순간(field)에 도착, 뜬공 아웃은 떨어지기 직전에 도착, 안타는 늦게
    const go = gbOut ? Math.min(1, (now - fs) / (TL.field - fs)) : Math.min(1, k * (bb.hit ? 0.8 : 1.12)), x = hp.x + (chase.x - hp.x) * go, y = hp.y + (chase.y - hp.y) * go;
    const mode = go < 1 ? 'run' : bb.hit || gbOut ? 'throw' : 'catch';
    return [x, y, F.color, A.ph === 'fresult' ? (bb.hit ? 'throw' : 'catch') : mode, Math.floor(k * 12), x < home.x];
  });
  people.push([home.x, home.y + 12, F.color, 'ready', 0, false]);   // 포수
  // 타자 주자: 1루로 뜀 / 결과가 나오면 지금 주자 자리
  // 타자 주자: 시간표의 runner 순간에 1루에 닿음 (땅볼 아웃이면 송구보다 조금 늦게)
  if(A.ph === 'fly'){ const arr = TL.runner || TL.contact + 1.7, q = Math.min(1, Math.max(0, (now - TL.contact) / (arr - TL.contact))); people.push([home.x + (b1.x - home.x) * q, home.y + (b1.y - home.y) * q, T.color, q < 1 ? 'runner' : 'base', Math.floor(now * 12), false]); }
  else G.bases.forEach((r, i) => { if(r != null){ const b = fm(...BASE_POL[i]); people.push([b.x, b.y + 2, T.color, 'base', 0, false]); } });
  people.sort((p, q) => p[1] - q[1]).forEach(p => tinyPlayer(...p));   // 먼 사람부터 그려서 가까운 사람이 앞에
  // 심판: 결과가 나오면 1루심(세이프·아웃) 또는 주심(홈런)이 콜
  if(A.ph === 'fresult' && GX.meta['umpire-s']){
    if(A.hr) drawPerson('umpire-s', home.x + 14, home.y + 22, '#ff00ff', 'u4', false);
    else { const u = fm(1.1, 38); drawPerson('umpire-s', u.x, u.y, '#ff00ff', /아웃|삼진|병살/.test(A.banner || '') ? 'u1' : 'u2', false); }
  }
  R(gx - 2, gy - 1, 4, 2, 'rgba(0,0,0,0.45)');
  ball(gx, gy - lift, 2 + h / 6);
  ctx.restore();
  scoreBar(G);
  if(A.ph === 'fresult' && A.banner){
    banner(A.banner, 34, A.bannerColor || PAL.ink, 22);   // 위쪽에 (베이스 장면을 가리지 않게)
    if(A.hr) fireworks(performance.now());
  }
}
// 계산한 플레이(playsim.js의 기록)를 그대로 재생: 공의 길·높이, 수비수 움직임, 주자, 베이스마다의 판정
const mw = p => fm(Math.atan2(p[0], p[1]), Math.hypot(p[0], p[1]));   // 미터 좌표 → 야구장 그림 좌표
function pathAt(path, t){
  if(!path || !path.length) return null;
  if(t <= path[0][0]) return path[0][1];
  for(let i = 1; i < path.length; i++){ const [t0, p0] = path[i - 1], [t1, p1] = path[i]; if(t <= t1){ const k = t1 > t0 ? (t - t0) / (t1 - t0) : 1; return [p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k]; } }
  return path[path.length - 1][1];
}
// 베이스 길을 따라 b0(−1은 타석)에서 b1까지, 0~1 비율
function basePath(b0, b1, k){
  const pts = [[0, 0], ...BASE_XY.slice(0, 3), [0, 0]], from = b0 + 1, to = b1 + 1, n = to - from;
  if(n <= 0) return pts[from];
  const x = Math.min(n, Math.max(0, k * n)), i = Math.min(n - 1, Math.floor(x)), f = x - i;
  return lerp2(pts[from + i], pts[from + i + 1], f);
}
function drawPlayReplay(G, A){
  const ps = A.bb.ps, TL = A.tl, F = fieldTeam(G), T = batTeam(G), ctx = GX.ctx;
  const ts = Math.max(0, A.tt - TL.contact);   // 친 순간부터 흐른 실제 시간(초). 결과 뒤에도 그대로 흘러 모두 마지막 자리에 섬
  // 공: 지금 시간이 들어 있는 구간 (구간 사이, 잡고 던지기 전에는 앞 구간 끝 = 글러브 안)
  const balls = (ps.ev || []).filter(e => e.k === 'ball' || e.k === 'carry');
  let seg = balls[0], bp = [0, 0], hgt = 0;
  for(const e of balls){ if(ts >= e.t0) seg = e; }
  if(seg){
    const k = clamp((ts - seg.t0) / Math.max(0.01, seg.t1 - seg.t0), 0, 1);
    // 땅볼은 점점 느려짐(처음 빠르고 끝에 느림), 송구·뜬공은 거의 같은 빠르기
    const kk = seg === balls[0] && A.bb.type === 'gb' ? 1 - (1 - k) * (1 - k) * 0.6 - (1 - k) * 0.4 : k;
    bp = lerp2(seg.from, seg.to, seg === balls[0] && A.bb.type === 'gb' ? Math.min(1, kk) : k);
    hgt = seg.h ? seg.h * 4 * k * (1 - k) : seg === balls[0] && A.bb.type === 'gb' ? Math.abs(Math.sin(k * Math.PI * 3)) * 2.5 * (1 - k) : 0;
  }
  const bw = mw(bp), lift = hgt * (wide() ? 1.1 : 0.9);
  // 화면: 공을 따라감
  const W = worldW(), H = worldH(), clampC = c => ({ x: Math.max(0, Math.min(W - 256, c.x)), y: Math.max(0, Math.min(H - 224, c.y)) }), home = fm(0, 0);
  if(!A.camInit){ A.camInit = true; GX.cam = clampC({ x: home.x - 128, y: home.y - 196 }); }
  const want = clampC({ x: bw.x - 128, y: bw.y - lift * 0.5 - 118 });
  GX.cam = { x: GX.cam.x + (want.x - GX.cam.x) * 0.12, y: GX.cam.y + (want.y - GX.cam.y) * 0.12 };
  ctx.save(); ctx.translate(-Math.round(GX.cam.x), -Math.round(GX.cam.y));
  bgField(G);
  const people = [];
  // 수비수: 기록된 길(반응 → 전력 질주 → 기다림). 움직이는 쪽을 바라봄
  const Fs = fieldersOf(G), holds = (ps.ev || []).filter(e => e.k === 'catch' || e.k === 'field' || e.k === 'pickup');
  Object.keys(Fs).forEach(pos => {
    const path = ps.fm && ps.fm[pos], p = path ? pathAt(path, ts) : Fs[pos].at, p0 = path ? pathAt(path, ts - 0.06) : p, w = mw(p), w0 = mw(p0);
    const moving = Math.hypot(w.x - w0.x, w.y - w0.y) > 0.15;
    const got = holds.some(e => e.pos === pos && ts >= e.t && ts < e.t + 0.7);
    people.push([w.x, w.y + (pos === 'C' ? 10 : 0), F.color, moving ? 'run' : got ? 'catch' : 'ready', Math.floor(ts * 10), moving ? w.x < w0.x : w.x > bw.x, [w.x - w0.x, w.y - w0.y]]);
  });
  // 주자: 저마다 출발(t0)·도착(t) 시각대로 베이스 길을 따라 달림. 아웃된 주자는 잠시 뒤 사라짐. 달리는 쪽을 바라봄(1→2루, 2→3루는 왼쪽)
  const runner = (b0, b1, t0, t1, gone) => {
    if(gone != null && ts > gone + 0.5) return;
    const k = t1 > t0 ? clamp((ts - t0) / (t1 - t0), 0, 1) : 1, p = basePath(b0, b1, k), q = basePath(b0, b1, Math.max(0, k - 0.02)), w = mw(p), wq = mw(q);
    const run = k > 0 && k < 1 && b1 !== b0;
    // 아슬아슬하게 베이스에 들어가면(그 베이스에 판정이 있으면) 마지막 0.4초는 슬라이딩
    const called = b1 >= 0 && b1 < 4 && (ps.call || []).some(c => c.base === (b1 === -1 ? 3 : b1) && Math.abs(c.t - t1) < 0.5);
    if(called && b1 > b0 + 0 && ts > t1 - 0.4 && ts < t1 + 0.6 && b1 !== 0){ const sk = clamp((ts - (t1 - 0.4)) / 0.4, 0, 1); people.push([w.x, w.y, T.color, 'slide', Math.floor(sk * 3.99), w.x < wq.x]); return; }
    people.push([w.x, w.y, T.color, run ? 'runner' : 'base', Math.floor(ts * 12), run ? w.x < wq.x : false, [w.x - wq.x, w.y - wq.y]]);
  };
  const batTo = ps.kind === 'hr' ? 3 : Math.max(1, ps.batTried || ps.bat || 1) - 1;
  if(ps.batOut) runner(-1, ps.batOut.base, 0.6, ps.batOut.t, ps.batOut.t);
  else if(ps.bat === 0){ const c = (ps.call || []).find(x => x.base === 0 && x.out); if(!(ps.ev || []).some(e => e.k === 'catch')) runner(-1, 0, 0.6, ps.runT || 4.3, c ? c.t : 4.3); }
  else runner(-1, batTo, 0.6, ps.kind === 'hr' ? 0.6 + 4 * 27.4 / 6.5 : ps.runT || 4.3, null);
  (ps.rm || []).forEach(m => {
    if(m.to == null) runner(m.from, m.back ? m.from : (m.at ?? m.from + 1), m.t0, m.t, m.t);
    else runner(m.from, m.to, m.t0, m.t, null);
  });
  people.sort((p, q) => p[1] - q[1]).forEach(p => tinyPlayer(...p));
  // 베이스 판정: 그 순간부터 0.9초 동안 OUT / SAFE
  (ps.call || []).forEach(c => {
    if(c.catch || ts < c.t || ts > c.t + 0.9 || c.base == null) return;
    const w = mw(BASE_XY[c.base]); pxText(c.out ? 'OUT' : 'SAFE', w.x, w.y - 26, c.out ? '#3cbcfc' : PAL.ink, 9);
  });
  if(A.ph === 'fresult' && GX.meta['umpire-s'] && ps.kind !== 'hr'){ const u = fm(1.1, 38); drawPerson('umpire-s', u.x, u.y, '#ff00ff', /아웃|삼진|병살/.test(A.banner || '') ? 'u1' : 'u2', false); }
  R(bw.x - 2, bw.y - 1, 4, 2, 'rgba(0,0,0,0.45)');
  ball(bw.x, bw.y - lift, 2 + hgt / 6);
  ctx.restore();
  scoreBar(G);
  if(A.ph === 'fresult' && A.banner){ banner(A.banner, 34, A.bannerColor || PAL.ink, 22); if(A.hr) fireworks(performance.now()); }
}

// 홈런 불꽃: 몇 군데에서 터지며 퍼짐
function fireworks(now){
  const cols = [PAL.red, PAL.ink, '#3cbcfc', '#58d854', PAL.white];
  for(let i = 0; i < 4; i++){
    const t = ((now / 900) + i * 0.27) % 1, cx = [50, 206, 90, 170][i], cy = [74, 80, 60, 64][i], r = 4 + t * 22;
    for(let j = 0; j < 10; j++){ const a = j / 10 * 6.283; R(cx + Math.cos(a) * r, cy + Math.sin(a) * r + t * 6, 2, 2, cols[(i + j) % cols.length]); }
  }
}

/* ---------- 구장마다 다른 바깥 풍경 ----------
   경기장 그림의 바깥(어두운 바탕) 칸을 구장 특징에 맞는 무늬로 칠하고, 구석에 작은 표시를 그림 */
const PARK_LOOK = {
  star:    { name:'손잡다 필드', bg:['#141c3c', '#f8d878'], kind:'city' },     // 도시 야경
  whale:   { name:'블루웨일즈', bg:['#0c3c8c', '#5cb8f8'], kind:'sea', icon:'whale' },
  thunder: { name:'썬더볼츠', bg:['#2c2c3c', '#fce000'], kind:'storm', icon:'bolt' },
  hawk:    { name:'마린필드', bg:['#0c5c7c', '#bcf0fc'], kind:'sea', icon:'wind' },
  swallow: { name:'스위프트', bg:['#5c94fc', '#fcfcfc'], kind:'day' },
  turtle:  { name:'스톤터틀즈', bg:['#1c5c4c', '#7c7c7c'], kind:'lake', icon:'rock' },
  meteor:  { name:'메테오스', bg:['#0c0c2c', '#fcfcfc'], kind:'stars', icon:'meteor' },
  knight:  { name:'나이츠 돔', bg:['#4c4c5c', '#8c8c9c'], kind:'dome' },
  beacon:  { name:'비컨스', bg:['#0c2c5c', '#fcfcfc'], kind:'sea', icon:'light' },
  windy:   { name:'오름구장', bg:['#2c6c2c', '#5cac3c'], kind:'hill', icon:'mill' },
};
function parkBg(G){
  const key = (G.park && G.park.key) || 'star', k = 'park:' + key;
  if(GX.tinted[k]) return GX.tinted[k];
  const im = GX.img['bg-field'], L = PARK_LOOK[key] || PARK_LOOK.star;
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  const f0 = [p[8], p[9], p[10]];   // 바깥 바탕색 (왼쪽 위 구석)
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const A = hex(L.bg[0]), B = hex(L.bg[1]);
  for(let y = 0; y < c.height; y++) for(let xx = 0; xx < c.width; xx++){
    const i = (y * c.width + xx) * 4;
    if(Math.abs(p[i] - f0[0]) + Math.abs(p[i + 1] - f0[1]) + Math.abs(p[i + 2] - f0[2]) > 24) continue;
    let dot = false;
    if(L.kind === 'city') dot = (xx % 6 < 2) && (y % 8 < 3) && ((xx * 7 + y * 13) % 5 === 0);
    else if(L.kind === 'sea' || L.kind === 'lake') dot = (y % 10 === 0) && ((xx + y) % 12 < 5);
    else if(L.kind === 'storm') dot = (xx + y * 3) % 17 === 0;
    else if(L.kind === 'day') dot = (y % 24 < 6) && ((xx + Math.floor(y / 24) * 20) % 40 < 18);
    else if(L.kind === 'stars') dot = ((xx * 31 + y * 17) % 97) === 0;
    else if(L.kind === 'dome') dot = (xx % 16 === 0) || (y % 16 === 0);
    else if(L.kind === 'hill') dot = ((xx + y) % 9 === 0);
    const C = dot ? B : A; p[i] = C[0]; p[i + 1] = C[1]; p[i + 2] = C[2];
  }
  x.putImageData(d, 0, 0);
  return (GX.tinted[k] = c);
}
// 구장 특징 표시: 전광판 이름, 돔 지붕, 높은 왼쪽 담장, 구석 그림
function parkExtra(G){
  const key = (G.park && G.park.key) || 'star', L = PARK_LOOK[key] || PARK_LOOK.star, pk = G.park || {}, ctx = GX.ctx;
  pxText(L.name, 256, 22, PAL.ink, 7, true, false);   // 가운데 담장 뒤 전광판
  if(pk.dome){   // 돔: 경기장 위로 반투명한 지붕 테두리와 살
    ctx.strokeStyle = 'rgba(220,220,235,0.55)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(256, 330, 300, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    ctx.lineWidth = 1; for(let a = 1.12; a < 1.9; a += 0.1){ ctx.beginPath(); ctx.moveTo(256 + Math.cos(a * Math.PI) * 300, 330 + Math.sin(a * Math.PI) * 300); ctx.lineTo(256 + Math.cos(a * Math.PI) * 250, 330 + Math.sin(a * Math.PI) * 250); ctx.stroke(); }
  }
  if(pk.wall && pk.wall[0] > 4){   // 높은 왼쪽 담장: 두껍고 진한 벽
    for(let a = -0.78; a < -0.3; a += 0.02){ const q = fm(a, fenceAt(G, a) + 1); R(q.x - 3, q.y - 4, 6, 7, '#0c4c1c'); R(q.x - 3, q.y - 4, 6, 1, '#8cd88c'); }
  }
  if(pk.foul > 2){ ctx.fillStyle = 'rgba(200,140,80,0.35)'; ctx.fillRect(0, 300, 40, 140); ctx.fillRect(472, 300, 40, 140); }   // 넓은 파울 지역
  const icon = (x, y) => {
    if(L.icon === 'whale'){ R(x, y, 14, 5, '#1c4cbc'); R(x + 12, y - 4, 3, 4, '#1c4cbc'); R(x + 14, y - 6, 4, 2, '#1c4cbc'); R(x + 3, y + 1, 2, 1, PAL.white); }
    else if(L.icon === 'bolt'){ for(let i = 0; i < 5; i++) R(x + (i % 2) * 3, y + i * 3, 3, 3, PAL.ink); }
    else if(L.icon === 'light'){ R(x + 2, y, 4, 14, PAL.white); R(x + 2, y + 4, 4, 2, PAL.red); R(x + 1, y - 3, 6, 3, PAL.ink); }
    else if(L.icon === 'mill'){ R(x + 3, y + 2, 2, 12, PAL.white); R(x - 2, y + 2, 12, 2, PAL.white); R(x + 3, y - 3, 2, 12, PAL.white); }
    else if(L.icon === 'meteor'){ for(let i = 0; i < 6; i++) R(x + i * 2, y + i, 2, 2, i ? '#f8b800' : PAL.white); }
    else if(L.icon === 'rock'){ R(x, y + 4, 10, 6, '#7c7c7c'); R(x + 2, y + 2, 6, 2, '#9c9c9c'); }
    else if(L.icon === 'wind'){ for(let i = 0; i < 3; i++) R(x, y + i * 4, 10 - i * 2, 1, PAL.white); }
  };
  icon(6, 8); icon(494, 8); icon(4, 470); icon(496, 470);
}

/* ---------- 베이스 가까이 (도루·견제·판독 다시 보기) ----------
   옆에서 본 베이스. 도루는 주자가 왼쪽에서 달려와 슬라이딩하고 야수가 오른쪽에서 공을 받아 태그.
   견제는 반대로 주자가 오른쪽(리드한 자리)에서 돌아옴. safe면 주자가 먼저, 아니면 태그가 먼저 */
function drawBasePlay(o, k){
  const T = batTeam(G), F = fieldTeam(G), back = o.k === 'pick', flip = back;
  const X = x => flip ? 256 - x : x;
  R(0, 0, 256, 224, PAL.grass); for(let y = 0; y < 110; y += 12) R(0, y, 256, 6, PAL.grass2);
  R(0, 110, 256, 80, PAL.dirt); R(0, 110, 256, 2, PAL.dirt2);
  R(X(128) - 9, 152, 18, 6, '#000'); R(X(128) - 8, 153, 16, 4, PAL.white);   // 베이스
  // 계산한 시각(주자 도착 tR, 송구·태그 tB)의 차이를 그대로: 먼저 닿는 쪽이 0.7 근처, 늦는 쪽은 차이만큼 뒤
  let arrive = o.safe ? 0.7 : 0.84, tagT = o.safe ? 0.8 : 0.66;
  if(o.tR && o.tB){ const m0 = Math.min(o.tR, o.tB); arrive = clamp(0.68 + (o.tR - m0) / 1.5, 0.6, 0.95); tagT = clamp(0.68 + (o.tB - m0) / 1.5, 0.6, 0.95); }
  // 심판 (뒤쪽)
  if(GX.meta.umpire) drawPerson('umpire', X(196), 132, '#ff00ff', k > Math.max(arrive, tagT) + 0.04 ? (o.safe ? 'u2' : 'u1') : 'u0', flip);
  // 야수: 공을 기다리다 받으면 글러브를 베이스 쪽으로
  const hasRunner = GX.meta.runner && tinted('runner', T.color);
  const fPose = k < tagT - 0.15 ? 'tag1' : 'tag0';
  // 주자: 달리다가 슬라이딩
  const rx = k < arrive ? -30 + (128 - 22 + 30) * (k / arrive) : 128 - 22 + (k - arrive) * 10;
  const sliding = k > arrive - 0.18;
  if(hasRunner){
    drawPerson('runner', X(152), 162, F.color, fPose, flip);
    drawPerson('runner', X(Math.min(rx, 116)), 162, T.color, sliding ? 'slideF' : (Math.floor(k * 14) % 2 ? 'run1' : 'run0'), flip);
    if(sliding) for(let i = 0; i < 4; i++) R(X(rx - 34 - i * 5) , 152 + (i % 2) * 4, 3, 3, '#f8e0b0');
  } else {
    person(X(152), 140, F.color, 'set', flip); person(X(Math.min(rx, 116)), 140, T.color, sliding ? 'follow' : 'set', flip);
  }
  // 공: 오른쪽 위(포수·투수 쪽)에서 날아와 글러브로
  if(k < tagT){ const q = Math.max(0, (k - (tagT - 0.35)) / 0.35); if(q > 0) ball(X(300 - 160 * q), 70 + 60 * q, 3); }
}
// 비디오 판독: 오래된 TV 화면 안에서 느리게 다시 봄
function drawReview(o, k, phase){
  R(0, 0, 256, 224, '#101828');
  for(let y = 20; y < 224; y += 4) R(0, y, 256, 1, '#141e30');
  const tv = GX.meta.tv, tx = 28, ty = 30, sc = tv ? tv.screen : [24, 29, 152, 92];
  const sx = tx + sc[0], sy = ty + sc[1], sw = sc[2], sh = sc[3];
  const ctx = GX.ctx;
  ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
  const z = 0.62; ctx.translate(sx + sw / 2 - 128 * z, sy + sh / 2 - 138 * z); ctx.scale(z, z);
  if(o.rk === 'hr'){   // 담장 끝 타구: 담장 꼭대기 근처로 떨어지는 공
    R(0, 0, 256, 224, PAL.stand); R(0, 110, 256, 60, PAL.fence); R(0, 110, 256, 3, PAL.ink); R(0, 170, 256, 54, PAL.grass);
    const fall = 30 + k * 100, over = o.call === 'hr';
    ball(128 + (over ? -10 : 10) * k, over ? fall : Math.min(fall, 116 + (k - 0.8) * 60), 6);
  } else drawBasePlay({ k: o.rk === 'pick' ? 'pick' : 'steal', safe: o.call === 'safe' }, k);
  ctx.restore();
  if(GX.img.tv) ctx.drawImage(GX.img.tv, tx, ty); else { ctx.strokeStyle = '#888'; ctx.lineWidth = 6; ctx.strokeRect(sx - 3, sy - 3, sw + 6, sh + 6); ctx.lineWidth = 1; }
  scoreBar(G);
  if(phase === 'end') banner(o.flip ? '판정 번복!' : '원심 유지', 186, o.flip ? PAL.red : PAL.ink, 20);
  else if(Math.floor(performance.now() / 500) % 2 || phase === 'replay') banner('비디오 판독', 186, PAL.ink, 20);
}

/* ---------- 공수 교대·경기 끝 카드 (TV 중계처럼 이닝별 점수) ---------- */
function drawCard(A){
  drawPitchScene(G, null);
  const ctx = GX.ctx, k = A.t0, y0 = 50 + (1 - k) * 30;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 32, 256, 192);
  R(10, y0, 236, 120, '#000'); R(10, y0, 236, 2, PAL.ink); R(10, y0 + 118, 236, 2, PAL.ink);
  // 제목
  if(A.mode === 'end') banner(G.walkoff ? '끝내기!' : '게임 셋!', y0 - 2, PAL.ink, 18);
  else pxText(A.mode === 'skip' ? '▶▶ 내 차례까지 넘어감' : '공수 교대', 128, y0 + 6, PAL.ink, 16);
  // 이닝별 점수: 마지막 9이닝까지, 그리고 R(점수)·H(안타)
  const n = Math.max(G.innings, G.inning), first = Math.max(1, n - 8), cols = n - first + 1;
  const cx = i => 66 + i * 14, top = y0 + 38;
  for(let i = 0; i < cols; i++) pxText(String(first + i), cx(i) + 4, top, '#9c9c9c', 8, true, false);
  pxText('R', 66 + cols * 14 + 8, top, PAL.ink, 8, true, false); pxText('H', 66 + cols * 14 + 26, top, PAL.ink, 8, true, false);
  G.teams.forEach((T, r) => {
    const y = top + 14 + r * 18;
    R(14, y - 1, 4, 13, T.color); pxText(T.short, 21, y, PAL.white, 10, false, false);
    for(let i = 0; i < cols; i++){ const v = T.R[first + i - 1]; pxText(v == null ? '' : String(v), cx(i) + 4, y + 1, PAL.white, 9, true, false); }
    pxText(String(runsOf(T)), 66 + cols * 14 + 8, y, PAL.ink, 10, true, false);
    pxText(String(T.H || 0), 66 + cols * 14 + 26, y + 1, PAL.white, 9, true, false);
  });
  // 다음 이닝 안내
  const bt = ['1루', '2루', '3루'].filter((_, i) => G.bases[i] != null);
  const msg = A.mode === 'skip' ? `${G.inning}회${G.top ? '초' : '말'} ${G.outs}아웃 ${bt.length ? '주자 ' + bt.join('·') : '주자 없음'} · 내 차례` : A.mode === 'end' ? (G.winner >= 0 ? `${G.teams[G.winner].short} 승리!` : '무승부') : `${G.inning}회${G.top ? '초' : '말'} · ${batTeam(G).short} 공격`;
  pxText(msg, 128, y0 + 98, PAL.white, 11);
}

/* ---------- 움직임 ---------- */
// 결과 글씨: 이번 결과의 사건 목록(engine.js의 ev)으로 정함. 문장을 읽지 않음
function bannerOf(evs){
  const pa = r => evs.some(e => e.k === 'pa' && e.r === r), call = c => evs.some(e => e.k === 'call' && e.c === c), pl = evs.find(e => e.k === 'play');
  if(G && G.over) return [G.walkoff ? '끝내기!' : '게임 셋!', PAL.ink, pa('hr')];
  if(pa('hr')) return ['홈런!', PAL.red, true];
  if(pl && pl.kind === 'err') return ['실책!', PAL.red];
  if(pl && pl.kind === 'dp') return ['병살!', '#3cbcfc'];
  if(pa('b3')) return ['3루타!', PAL.ink]; if(pa('b2')) return ['2루타!', PAL.ink]; if(pa('b1')) return ['안타!', PAL.ink];
  if(pa('k')) return ['삼진!', '#3cbcfc']; if(pa('bb')) return ['볼넷', '#58d854']; if(pa('out')) return ['아웃!', '#3cbcfc'];
  if(call('whiff')) return ['헛스윙!', '#f8b800']; if(call('foul')) return ['파울', PAL.white];
  if(call('strike')) return ['스트라이크!', '#f8b800']; if(call('ball')) return ['볼', '#58d854']; if(pa('safe')) return ['세이프!', PAL.ink];
  return null;
}
// 새 투구·새 플레이가 있으면 차례대로 보여 줌 (투구 → 도루·견제·판독)
function gfxStart(G, fx, lines, pre, skip, evs){
  const now = performance.now();
  evs = evs || [];
  // skip: 육성 모드에서 내 차례 뒤 다음 내 차례까지 건너뜀. 내 공(skip.snap.anim)만 보여 주고, 건너뛴 장면 대신 '건너뜀' 카드
  const A0 = skip ? skip.snap.anim : G.anim, P0 = skip ? skip.snap.play : G.play;
  const newPitch = !!(A0 && A0.n !== GX.lastAnimN);
  // 이번 결과에서 새로 일어난 플레이만 (이 공에서, 또는 이 공 바로 전의 견제, 공 없이 일어난 판독 결과). 옛 견제를 다시 보여 주지 않게
  const newPlay = !!(P0 && P0.n !== GX.lastPlayN && (P0.an == null || !A0 || P0.an === A0.n || (newPitch && P0.an === A0.n - 1) || !newPitch));
  GX.lastAnimN = G.anim ? G.anim.n : null; GX.lastPlayN = G.play ? G.play.n : null;
  const list = [];
  if(newPitch){
    document.documentElement.classList.add('gfxhold');   // 결과 글은 공을 잡거나 떨어질 때 보여 줌
    if(G.over) document.documentElement.classList.add('gfxholdall');   // 마지막 공: 잡히기 전에는 '경기가 끝났습니다'와 선택지도 숨김
    // 도루·견제의 세이프·아웃은 뒤의 베이스 장면에서 보여 줌
    const pfx = newPlay && A0.res !== 'inplay' ? evs.filter(e => !(e.k === 'pa' && (e.r === 'safe' || e.r === 'out'))) : evs;
    let bn = bannerOf(pfx);
    if(A0.res === 'hbp') bn = ['몸에 맞는 공', '#58d854'];
    list.push({ kind:'pitch', ...A0, tl: playTL(A0, pfx), view: skip ? skip.snap : null, ph:'windup', t0:0, banner: bn && bn[0], bannerColor: bn && bn[1], hr: bn && bn[2], jit: (Math.random() - 0.5) * 0.3 });
  }
  if(newPlay){
    const p = P0;
    if(p.k === 'wp') list.push({ kind:'banner', ph:'result', t0:1, banner: p.word + '!', bannerColor: PAL.ink });
    else if(p.k === 'steal' || p.k === 'pick') list.push({ kind:'base', o: p, t0:0, banner: p.safe ? (p.k === 'steal' ? '도루!' : '세이프!') : '아웃!', intro: p.k === 'pick' ? '견제!' : null });
    else if(p.k === 'review') list.push({ kind:'review', o: p, t0:0 });
    else if(p.k === 'reviewEnd') list.push({ kind:'reviewEnd', o: p, t0:0 });
  }
  if(skip){ list.push({ kind:'card', mode:'skip', from: skip.from }); }
  // 공수 교대·경기 끝: 이닝별 점수판 카드를 이어서 보여 줌
  else if(G.over && GX.overShown !== G.at){ GX.overShown = G.at; list.push({ kind:'card', mode:'end' }); }
  else if(evs.some(e => e.k === 'inning')) list.push({ kind:'card', mode:'change' });
  if(!list.length){ const bn = bannerOf(evs); if(bn) list.push({ kind:'banner', ph:'result', t0:1, banner: bn[0], bannerColor: bn[1], hr: bn[2] }); }
  if(!list.length) return;
  list.forEach(a => { a.start = now; if(a.kind !== 'card') a.pre = pre; });
  GX.anim = list.shift(); GX.queue = list;
  if(!GX.raf && GX.cv) GX.raf = requestAnimationFrame(gfxTick);
}
// 시간이 흐른 만큼 단계를 정함. 끝났으면 false
function stepAnim(A, el){
  if(A.kind === 'banner') return el < 1200;
  if(A.kind === 'card'){ A.t0 = Math.min(1, el / 250); return A.mode === 'end' || el < (A.mode === 'skip' ? 3000 : 2600); }   // 경기 끝 카드는 계속 둠
  if(A.kind === 'base'){ A.t0 = Math.min(1, el / 1500); return el < 2400; }
  if(A.kind === 'review'){ A.t0 = (el % 2600) / 2600; return true; }   // 판독을 고르는 동안 계속 다시 보여 줌
  if(A.kind === 'reviewEnd'){ A.t0 = Math.min(1, el / 2600); A.phase = el < 2600 ? 'replay' : 'end'; return el < 4400; }
  // 투구: 공 하나의 시간표(timeline.js) 그대로. 투구 동작 → 공이 날아옴(방망이) → (치면) 위에서 본 야구장에서 결과가 정해질 때까지 → 결과
  const T = A.tl || (A.tl = playTL(A, [])), ms = x => x * 1000;
  A.tt = el / 1000;
  if(el < ms(T.release)){ A.ph = 'windup'; A.t0 = el / ms(T.release); return true; }
  if(el < ms(T.contact)){ A.ph = 'flight'; A.t0 = (el - ms(T.release)) / ms(T.contact - T.release); return true; }
  if(A.res !== 'inplay' || !A.bb){ A.ph = 'result'; A.t0 = 1; return el < ms(T.end); }
  const fs = T.contact + 0.12;   // 맞는 순간을 잠깐 보여 주고 바로 위에서 본 야구장으로 (같은 시간 흐름)
  if(el < ms(fs)){ A.ph = 'result'; A.t0 = (el - ms(T.contact)) / 250; return true; }
  if(el < ms(T.result)){ A.ph = 'fly'; A.t0 = (el - ms(fs)) / ms(T.result - fs); return true; }
  A.ph = 'fresult'; A.t0 = 1; return el < ms(T.end);
}
const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// 그림에 쓸 경기 상태: 마지막 공으로 공수가 바뀌었거나 경기가 끝났으면, 움직임이 끝날 때까지 공을 던지기 전 상태(팀 색·타자·투수·주자)로 그림
function viewOf(A){
  // 육성 건너뛰기: '지금'은 내 타석이 끝난 직후 모습(A.view), 그 전은 던지기 전 모습(A.pre)
  const now = (A && A.view) || G, p = A && A.pre;
  // 결과가 정해지기 전(공이 날아가는 동안)에는 던지기 전 상태로: 아웃 카운트·주자·점수는 잡히는 순간에 바뀜
  if(p && A.kind === 'pitch' && (A.ph === 'windup' || A.ph === 'flight' || A.ph === 'fly' || (A.ph === 'result' && A.res === 'inplay' && A.bb))) return p;
  // 공수가 바뀌었으면 움직임이 끝날 때까지 바뀌기 전 팀 색·자리로
  return p && (p.top !== now.top || p.inning !== now.inning || (now.over && !p.over)) ? p : now;
}
const snapOf = G => ({ ...G, teams: G.teams.map(T => ({ ...T, R: [...T.R] })), bases: [...G.bases] });
function gfxTick(){
  GX.raf = 0;
  if(!GX.cv || !document.contains(GX.cv)) return;
  if(GX.scene){   // 육성 장면은 경기 상태 없이 그림
    if(GX.pending > 0){ R(0, 0, 256, 224, '#000'); pxText('그림 불러오는 중…', 128, 104, PAL.white, 12); }
    else drawScene(GX.scene, (performance.now() - GX.scene.start) / 1000);
    GX.raf = requestAnimationFrame(gfxTick); return;
  }
  if(!G) return;
  const real = G;
  try{ G = viewOf(GX.anim); gfxDraw(); } finally { G = real; }
  if(GX.anim) GX.raf = requestAnimationFrame(gfxTick);
}
function gfxDraw(){
  const now = performance.now();
  let A = GX.anim;
  while(A && !stepAnim(A, (now - A.start) * (REDUCED() ? 3 : 1))){ A = GX.anim = GX.queue.shift() || null; if(A){ A.start = now; } }
  // 결과가 나오는 순간(또는 움직임이 없을 때) 아래 결과 글을 보여 줌
  if(!A || A.kind !== 'pitch' || A.ph === 'fresult' || (A.ph === 'result' && !(A.res === 'inplay' && A.bb))) document.documentElement.classList.remove('gfxhold', 'gfxholdall');
  if(GX.pending > 0){ R(0, 0, 256, 224, '#000'); pxText('그림 불러오는 중…', 128, 104, PAL.white, 12); return; }
  if(!A) drawPitchScene(G, null);
  else if(A.kind === 'banner'){ drawPitchScene(G, null); banner(A.banner, 112, A.bannerColor || PAL.ink, 22); }
  else if(A.kind === 'base'){
    drawBasePlay(A.o, A.t0); scoreBar(G);
    if(A.intro && A.t0 < 0.45) banner(A.intro, 40, PAL.ink, 22);
    if(A.t0 >= 1) banner(A.banner, 40, A.o.safe ? PAL.ink : '#3cbcfc', 22);
  }
  else if(A.kind === 'card') drawCard(A);
  else if(A.kind === 'review') drawReview(A.o, A.t0, 'wait');
  else if(A.kind === 'reviewEnd') drawReview(A.o, A.t0, A.phase);
  else if(A.ph === 'fly' || A.ph === 'fresult') drawFieldScene(G, A);
  else drawPitchScene(G, A.res === 'inplay' && A.ph === 'result' && A.bb ? { ...A, banner:null } : A);
}
// 그림판 내부 해상도 = 보이는 크기 × 기기 픽셀 비율. 그림은 언제나 256×224 좌표로 그림
function gfxSize(){
  const cv = GX.cv; if(!cv) return;
  const w = Math.max(256, Math.round((cv.clientWidth || 256) * (window.devicePixelRatio || 1)));
  const h = Math.round(w * 224 / 256);
  if(cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
  GX.ctx.setTransform(w / 256, 0, 0, h / 224, 0, 0);
  GX.ctx.imageSmoothingEnabled = false;
  if(!GX.raf) GX.raf = requestAnimationFrame(gfxTick);
}
// render()가 부름: 화면 모드일 때 상황판 자리에 그림판을 두고, 새 투구·플레이가 있으면 움직임을 시작
function gfxRender(G, fx, lines, evs){
  GX.scene = null;
  const bs = $('#boardSec');
  let wrap = bs.querySelector('.gfxwrap');
  if(!wrap){
    wrap = document.createElement('div'); wrap.className = 'gfxwrap'; wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = '<canvas id="gfx" width="512" height="448"></canvas>';
    GX.cv = wrap.firstChild; GX.ctx = GX.cv.getContext('2d'); GX.key = '';
    gfxSize();
    // 그림판 크기가 바뀌면 화면 실제 픽셀 수에 맞춰 다시 만듦 (늘려서 생기는 계단·자글거림을 없앰)
    if(window.ResizeObserver) new ResizeObserver(() => gfxSize()).observe(GX.cv);
    if(!GX.img.__) gfxLoad();
  }
  bs.prepend(wrap);
  const key = `${G.at}:${G.anim ? G.anim.n : 0}:${G.play ? G.play.n : 0}:${G.seq}`;
  if(key !== GX.key){
    const fresh = GX.key && GX.key.split(':')[0] === String(G.at);
    GX.key = key;
    if(fresh) gfxStart(G, fx || [], lines, GX.lastSnap, UI.lastSkip, evs);
    else { GX.lastAnimN = G.anim ? G.anim.n : null; GX.lastPlayN = G.play ? G.play.n : null; GX.anim = null; GX.queue = []; }
  }
  GX.lastSnap = snapOf(G);   // 다음 움직임에서 '던지기 전 상태'로 씀
  UI.lastSkip = null;
  if(!GX.raf) GX.raf = requestAnimationFrame(gfxTick);
}

// 화면 모드면 시작하자마자 그림을 미리 불러옴 (처음 경기 화면에서 임시 그림이 보이지 않게)
if(typeof SET !== 'undefined' && VIEW.gfx) gfxLoad();

/* ---------- 지금 타자·투수 능력치 게이지 (화면 보며 하기, 선택지 아래 빈자리) ----------
   우리 팀은 숫자와 길이 그대로, 상대 팀은 등급(5단계)만 보이게 해서 글로 듣는 정보와 같은 만큼만 알려 줌 */
function gstatRender(G){
  let box = $('#gstat');
  if(!box){ box = document.createElement('div'); box.id = 'gstat'; box.setAttribute('aria-hidden', 'true'); $('#opts').after(box); }
  if(!G || G.over || G.pre){ box.hidden = true; return; }
  const bi = G.top ? 0 : 1, fi = 1 - bi, B = curBatter(G), P = curPitcher(G);
  const own = typeof ownTeam === 'function' ? ownTeam : () => true;
  const lvl = v => v >= 80 ? 5 : v >= 65 ? 4 : v >= 45 ? 3 : v >= 32 ? 2 : 1;
  // 막대 한 줄: big이면 굵게(파워·체력). 상대 팀은 숫자 대신 등급(5단계)만
  const bar = (label, v, mine, color, big) => {
    const w = mine ? Math.max(4, Math.min(100, v)) : lvl(v) * 20;
    return `<div class="gs-row${big ? ' big' : ''}"><span class="gs-l">${label}</span><span class="gs-bar"><i style="width:${w}%;background:${color}"></i></span><span class="gs-v">${mine ? v : gradeWord(v)}</span></div>`;
  };
  // 컨디션 화살표: 좋으면 ▲ 나쁘면 ▼ (색과 모양을 함께). 상대 컨디션은 첫 타석 뒤에만 앎
  const condMark = (c, show) => !show || !c ? '' : `<span class="gs-cond ${c > 0 ? 'up' : 'dn'}">${c > 0 ? '▲'.repeat(c) : '▼'.repeat(-c)}</span>`;
  const mb = own(bi), mp = own(fi), left = Math.round(clamp(1 - P.load / P.sta, 0, 1) * 100);
  const staCol = left > 60 ? '#58d854' : left > 30 ? '#f8b800' : '#f83800';
  const velPct = Math.round(clamp((P.vel - 120) / 40, 0, 1) * 100);
  const pitches = P.pitches.map(x => `<span class="gs-p">${esc(PITCH[x.t].name)} <b>${mp ? x.g : gradeWord(x.g)}</b></span>`).join('');
  box.hidden = false;
  box.dataset.v = SET.gview === 'trace' ? 'trace' : 'bars';   // 자리가 좁으면 능력치와 공 자취 가운데 하나만 (아주 큰 화면은 둘 다)
  box.innerHTML = situationRow(G) + `
    <div class="gs-card" style="--tc:${G.teams[bi].color}"><div class="gs-h"><button type="button" class="gs-tog" data-gs="1" aria-hidden="true" tabindex="-1" title="능력치와 공 자취 바꾸기 (V)">⇄</button><b>타자</b> ${esc(B.name)} ${condMark(B.cond, mb || B.seen)} <small>${B.hand === 'L' ? '좌타' : '우타'} · ${esc(batterLine(B))}</small></div>
      ${bar('컨택', B.con, mb, '#3cbcfc')}${bar('파워', B.pow, mb, '#f87858', true)}${bar('선구안', B.eye, mb, '#b8f818')}${bar('주력', B.spd, mb, '#f8d878')}${bar('수비', B.def, mb, '#c8a0f8')}</div>
    <div class="gs-card" style="--tc:${G.teams[fi].color}"><div class="gs-h"><b>투수</b> ${esc(P.name)} ${condMark(P.cond, mp)} <small>${P.hand === 'L' ? '좌투' : '우투'} · ${P.n}구</small></div>
      ${mp ? `<div class="gs-row"><span class="gs-l">구속</span><span class="gs-bar"><i style="width:${velPct}%;background:#f8b8d8"></i></span><span class="gs-v">${P.vel}km</span></div>` : ''}${bar('제구', P.ctl, mp, '#3cbcfc')}${bar('구위', P.stf, mp, '#f87858')}
      <div class="gs-row big"><span class="gs-l">체력</span><span class="gs-bar"><i style="width:${Math.max(3, left)}%;background:${staCol}"></i></span><span class="gs-v">${left}%</span></div>
      <div class="gs-pit">${pitches}</div></div>`;
}
// 상황 줄: 이번 공(구종·구속)과 지난 공 세 개의 자취를 스트라이크 존 그림 위에 번호로 찍고(위치), 내가 노린 칸을 점선으로 보여 줌.
// 존의 좌우는 타자 쪽(몸쪽)이 왼쪽이 되게 하고, 왼손 타자면 뒤집음 (코스 고르기 화면과 같은 방향)
// 능력치 ↔ 공 자취 바꾸기 (V 키나 단추)
function gstatToggle(){ SET.gview = SET.gview === 'trace' ? 'bars' : 'trace'; saveSet(); if(typeof G !== 'undefined' && G) gstatRender(G); }
function situationRow(G){
  const hist = G.hist || [], A = G.anim, B = curBatter(G);
  const flip = B.hand === 'L' ? -1 : 1, X = 72, S = 30;   // 그림 한가운데와 1단위의 크기(점)
  const px = x => X + x * flip * S, py = y => X - y * S;   // 몸쪽(x가 음수)은 오른손 타자 기준 왼쪽
  const col = l => l === '스트라이크' || l === '헛스윙' || l === '삼진' ? '#f8b800' : l === '볼' || l === '볼넷' ? '#58d854' : l === '파울' ? '#fff' : l === '아웃' ? '#3cbcfc' : '#f87858';
  const aim = typeof GS !== 'undefined' && GS.aim && G.pa === GS.guessPA ? GS.aim : null;
  let svg = `<svg viewBox="0 0 144 144" class="gs-zone" role="img" aria-hidden="true"><rect x="${X - S}" y="${X - S}" width="${2 * S}" height="${2 * S}" fill="#0d1430" stroke="#c9d3f0" stroke-width="2"/>`
    + [1, 2].map(k => `<path d="M${X - S + k * 2 * S / 3} ${X - S}v${2 * S}M${X - S} ${X - S + k * 2 * S / 3}h${2 * S}" stroke="#3a4678" stroke-width="1"/>`).join('');
  if(aim){ const ax = [-1, 0, 1][aim.c] * 2 / 3, ay = [1, 0, -1][aim.r] * 2 / 3; svg += `<rect x="${px(ax) - S / 3}" y="${py(ay) - S / 3}" width="${2 * S / 3}" height="${2 * S / 3}" fill="none" stroke="#b8f818" stroke-width="2.5" stroke-dasharray="4 3"/>`; }
  hist.forEach((h, i) => { const last = i === hist.length - 1; svg += `<circle cx="${px(h.x)}" cy="${py(h.y)}" r="${last ? 9 : 7}" fill="${col(h.l)}" stroke="#000" stroke-width="2"${last ? '' : ' opacity="0.8"'}/><text x="${px(h.x)}" y="${py(h.y) + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#000">${i + 1}</text>`; });
  svg += '</svg>';
  // 작은 구장 그림: 최근 친 공의 방향과 떨어진 곳 (번호는 위 공 자취와 같음). 안타는 주황, 아웃은 파랑
  const HX = 72, HY = 128, SC = 0.62, fx = x => HX + x * SC, fy = y => HY - y * SC;
  let fld = `<svg viewBox="0 0 144 144" class="gs-zone gs-field" role="img" aria-hidden="true"><path d="M${HX} ${HY} L${fx(-72)} ${fy(72)} A${100 * SC} ${100 * SC} 0 0 1 ${fx(72)} ${fy(72)} Z" fill="#14401f" stroke="#c9d3f0" stroke-width="1.5"/>`
    + `<path d="M${HX} ${HY} L${fx(19.4)} ${fy(19.4)} L${HX} ${fy(38.8)} L${fx(-19.4)} ${fy(19.4)} Z" fill="#7a4a24" stroke="#fff" stroke-width="1"/>`;
  hist.forEach((h, i) => { if(!h.land) return; const lx = fx(h.land[0]), ly = fy(h.land[1]); fld += `<path d="M${HX} ${HY} L${lx} ${ly}" stroke="${col(h.l)}" stroke-width="2" stroke-dasharray="3 2" opacity="${i === hist.length - 1 ? 1 : 0.6}"/><circle cx="${lx}" cy="${ly}" r="6" fill="${col(h.l)}" stroke="#000" stroke-width="1.5"/><text x="${lx}" y="${ly + 3.5}" text-anchor="middle" font-size="9" font-weight="700" fill="#000">${i + 1}</text>`; });
  fld += '</svg>';
  const list = hist.map((h, i) => `<span class="gs-h3"><i style="background:${col(h.l)}">${i + 1}</i>${esc(PITCH[h.t].name)} ${h.vel}km <b>${esc(h.l)}</b></span>`).join('');
  return `<div class="gs-situ" data-gs="1">${svg}${fld}<div class="gs-list"><div class="gs-t">${G.pitchNo ? `이번 타석 ${G.pitchNo}구까지` : '첫 공 전'}${aim ? ' · 노려 치기 칸 표시' : ''}</div>${list || '<span class="gs-h3">아직 던진 공이 없습니다.</span>'}</div></div>`;
}

/* ---------- 선수 육성 장면: GPT 그림(배경 cr-*, 동작 cr-train·cr-life, 사람 cr-people, 소품 cr-props) ----------
   cell(그림, 칸 번호, x, 발끝 y, 팀 색, 좌우 뒤집기, 배율): 칸 번호는 왼쪽 위부터 0 (한 줄에 meta.n칸) */
function cell(name, i, x, foot, color, flip = false, sc = 1){
  const m = GX.meta[name], im = m && tinted(name, color || '#ff00ff');
  if(!im) return;
  const fx = (i % m.n) * m.w, fy = Math.floor(i / m.n) * m.h, ctx = GX.ctx;
  ctx.save(); ctx.translate(Math.round(x), Math.round(foot)); ctx.scale(flip ? -sc : sc, sc);
  ctx.drawImage(im, fx, fy, m.w, m.h, -m.w / 2, -m.h, m.w, m.h);
  ctx.restore();
}
function bgImg(name, color){ const im = color ? tinted(name, color) : GX.img[name]; if(!im) return false; GX.ctx.drawImage(im, 0, 0); return true; }
// 서 있는 내 선수: 투수 준비 자세 그림
const standMe = (x, foot, col, sc = 1.6) => big(() => drawPerson('pitcher', 0, 0, col, 'set', false, 0), x, foot, sc);
function drawSceneImg(sc, t){
  const col = sc.color || '#facc15', k = sc.kind, loop = t % 1.2;
  if(!GX.img['cr-cage'] || !GX.meta['cr-train']) return false;
  const title = () => { R(0, 0, 256, 24, 'rgba(0,0,0,0.75)'); pxText(sc.title || '', 128, 5, PAL.ink, 12); };
  const bob = Math.round(Math.sin(t * 6) * 1.5);
  if(k === 'con' || k === 'eye'){
    bgImg('cr-cage');
    // 피칭 머신(배경 가운데)에서 공이 날아오고 타자가 침. 선구안 훈련은 빠지는 공을 골라냄
    const n = Math.floor(t / 1.2), off = k === 'eye' && n % 2 === 1, q = Math.min(1, loop / 0.5);
    const sx = 128, sy = 100, tx = off ? 170 : 132, ty = off ? 190 : 168;
    const swing = !off && loop > 0.45, after = loop - 0.5;
    drawPerson('batter', 92, 216, col, swing ? (loop < 0.6 ? 'swing' : 'swfollow') : 'stance', swing ? loop < 0.6 : true);
    if(loop < 0.5) ball(sx + (tx - sx) * q, sy + (ty - sy) * q, 1.5 + q * 3);
    else if(!off) ball(tx + after * 60, ty - after * 260, 4 - after * 3);
    else ball(tx, ty, 4.5);
    if(off && loop > 0.55) pxText('볼! 잘 골라냈습니다', 128, 40, '#58d854', 12);
  } else if(k === 'pow'){
    bgImg('cr-gym');
    cell('cr-train', Math.floor(t * 1.6) % 2, 128, 214, col, false, 1.8);
    if(Math.floor(t * 1.6) % 2) pxText('으라차!', 128, 40, PAL.ink, 13);
  } else if(k === 'spd'){
    bgImg('cr-track');
    const x = 40 + ((t * 70) % 200);
    cell('cr-train', 4 + Math.floor(t * 8) % 2, x, 212 + bob, col, false, 1.6);
    for(let i = 0; i < 3; i++) R(x - 30 - i * 9, 206 + (i % 2) * 4, 3, 3, '#e8d8a8');
  } else if(k === 'sta'){
    bgImg('cr-track');
    const pushup = Math.floor(t / 2) % 2;
    cell('cr-train', pushup ? 3 : 2, 128, 212 + (pushup ? 0 : -Math.abs(Math.round(Math.sin(t * 8) * 8))), col, false, 1.7);
    pxText(pushup ? '팔굽혀펴기' : '줄넘기', 128, 40, PAL.white, 12);
  } else if(k === 'def'){
    bgImg('cr-track');
    const q = (t % 1.4) / 1.4, fx = 70 + (Math.floor(t / 1.4) % 2) * 116, k2 = Math.min(1, q * 1.2), h = Math.sin(k2 * Math.PI) * 70;
    big(() => drawPerson(q < 0.8 ? 'fielder' : 'fielder-set', 0, 0, col, ['set', 'lift', 'throw', 'follow'][Math.floor(t * 10) % 4], false), 128 + (fx - 128) * Math.min(1, q * 1.3), 212, 2.6);
    ball(128 + (fx - 128) * k2, 180 - h, 3 + h / 18);
  } else if(k === 'vel' || k === 'ctl' || k === 'stf'){
    bgImg('cr-bullpen');
    // 왼쪽 마운드에서 저 멀리 포수 자리(홈플레이트)로
    const pose = loop < 0.25 ? 'set' : loop < 0.45 ? 'lift' : loop < 0.55 ? 'throw' : 'follow';
    const hx = 68, hy = 76, q = Math.max(0, Math.min(1, (loop - 0.5) / 0.4));
    if(k === 'ctl'){ GX.ctx.strokeStyle = PAL.red; GX.ctx.lineWidth = 1.5; GX.ctx.beginPath(); GX.ctx.arc(hx, hy, 5, 0, 6.3); GX.ctx.stroke(); GX.ctx.lineWidth = 1; }
    if(loop >= 0.5){ const bend = k === 'stf' ? Math.sin(q * Math.PI) * 18 : 0; ball(70 + (hx - 70) * q + bend, 150 + (hy - 150) * q, 4 - q * 2.5); }
    big(() => drawPerson('pitcher', 0, 0, col, pose, false, 0), 70, 140, 1.6);
    if(k === 'vel' && loop > 0.85){ R(176, 34, 70, 22, '#000'); pxText(`${140 + Math.floor((t * 7) % 15)}km`, 211, 38, PAL.red, 13); }
  } else if(k === 'rest'){
    bgImg('cr-room');
    cell('cr-life', 3, 150, 214, col, false, 1.4);
  } else if(k === 'clinic' || k === 'massage'){
    bgImg('cr-rehab');
    cell('cr-people', 6, 70, 214, null, true, 1.6);
    cell('cr-life', k === 'clinic' ? 5 : 3, 170, 214, col, false, 1.5);
  } else if(k === 'fans'){
    bgImg('cr-fansign', col);
    cell('cr-life', 0, 128, 150, col, false, 1.1);
    cell('cr-people', 0, 60, 222, null, false, 1.5); cell('cr-people', 1, 200, 222, null, true, 1.5);
    for(let i = 0; i < 3; i++){ const hy = 110 - ((t * 30 + i * 25) % 70); pxText('♥', 150 + i * 18, hy, PAL.red, 12, true, false); }
  } else if(k === 'shop'){
    bgImg('cr-shop', col);
    cell('cr-people', 5, 206, 160, null, false, 1.3);
    standMe(80, 218 + bob, col);
  } else if(k.startsWith('ev-')){
    const e = k.slice(3), me = (x, f) => standMe(x, f, col);
    if(e === 'senior' || e === 'rival' || e === 'coach'){
      bgImg('cr-cage');
      cell('cr-people', e === 'coach' ? 4 : 7, 78, 216, e === 'coach' ? null : col, false, 1.6);
      me(184, 216);
      if(e === 'rival') cell('cr-props', 7, 128, 120 + bob, null, false, 1.3);
    } else if(e === 'fan'){ bgImg('cr-fansign', col); cell('cr-people', 0, 80, 218, null, false, 1.6); me(180, 218); }
    else if(e === 'sponsor'){ bgImg('cr-shop', col); cell('cr-props', 5, 70, 216, null, false, 1.6); cell('cr-people', 2, 128, 216, null, false, 1.5); cell('cr-train', 7, 196, 216, col, false, 1.4); }
    else if(e === 'press'){ bgImg('cr-fansign', col); cell('cr-life', 1, 128, 196, col, false, 1.3); cell('cr-people', 3, 50, 222, null, false, 1.4); cell('cr-people', 2, 208, 222, null, true, 1.4); if(Math.floor(t * 3) % 3 === 0) R(0, 0, 256, 224, 'rgba(255,255,255,0.25)'); }
    else if(e === 'cold'){ bgImg('cr-room'); cell('cr-life', 4, 130, 214, col, false, 1.6); cell('cr-props', 6, 210, 200, null, false, 1.2); }
    else if(e === 'birthday'){ bgImg('cr-room'); cell('cr-life', 6, 128, 214, col, false, 1.6); cell('cr-props', 1, 50, 214, null, false, 1.2); cell('cr-props', 2, 210, 110 + bob, null, false, 1.2); }
    else if(e === 'family'){ bgImg('cr-room'); cell('cr-life', 2, 128, 214, col, false, 1.6); }
    else { bgImg('cr-room'); me(128, 214); }
  } else return false;
  title();
  return true;
}

/* ---------- 선수 육성 장면 (훈련·방문). S.scene = { kind, title, color } ---------- */
function gfxScene(bs, sc){
  let wrap = bs.querySelector('.gfxwrap');
  if(!wrap){
    bs.innerHTML = '';
    wrap = document.createElement('div'); wrap.className = 'gfxwrap'; wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = '<canvas id="gfx" width="512" height="448"></canvas>';
    bs.appendChild(wrap);
    GX.cv = wrap.firstChild; GX.ctx = GX.cv.getContext('2d'); GX.key = '';
    gfxSize();
    if(window.ResizeObserver) new ResizeObserver(() => gfxSize()).observe(GX.cv);
    gfxLoad();
  }
  if(!GX.scene || GX.scene.kind !== sc.kind || GX.scene.title !== sc.title) GX.scene = { ...sc, start: performance.now() };
  if(!GX.raf) GX.raf = requestAnimationFrame(gfxTick);
}
// 2배로 키워 그리기
function big(fn, x, y, s = 2){ const ctx = GX.ctx; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); fn(); ctx.restore(); }
function drawScene(sc, t){
  if(drawSceneImg(sc, t)) return;
  const col = sc.color || '#facc15', k = sc.kind, loop = t % 1.2, ctx = GX.ctx;
  const batting = ['con', 'eye'].includes(k), pitching = ['vel', 'ctl', 'stf'].includes(k);
  if(batting || pitching){
    bgPitch();
    if(batting){
      // 피칭 머신에서 공이 날아오고 타자가 침 (선구안 훈련은 빠지는 공을 골라냄)
      R(118, 104, 20, 12, '#7c7c7c'); R(122, 100, 12, 4, '#5c5c5c');
      const n = Math.floor(t / 1.2), off = k === 'eye' && n % 2 === 1, z = lay().zone;
      const tx = z[0] + (off ? 22 : 0), ty = z[1] + (off ? 10 : 0), q = Math.min(1, loop / 0.5);
      const swing = !off && loop > 0.45, after = loop - 0.5;
      if(loop < 0.5) ball(128 + (tx - 128) * q, 110 + (ty - 110) * q, 1.5 + q * 2.5);
      else if(!off) ball(tx - after * 120, ty - after * 160, 3);
      else ball(tx, ty, 4);
      drawPerson('batter', lay().batR[0], lay().batR[1], col, swing ? (loop < 0.6 ? 'swing' : 'swfollow') : 'stance', swing ? loop < 0.6 : true);
      if(off && loop > 0.55) pxText('볼! 잘 골라냈습니다', 128, 130, '#58d854', 11);
    } else {
      // 투구 훈련: 포수 미트로 계속 던짐 (구속은 스피드건, 제구는 과녁, 구위는 휘는 공)
      const pose = loop < 0.25 ? 'set' : loop < 0.45 ? 'lift' : loop < 0.55 ? 'throw' : 'follow';
      drawPerson('pitcher', lay().pitcher[0], lay().pitcher[1], col, pose, false, 0);
      drawPerson('catcher', lay().catcher[0], lay().catcher[1], '#888888', 'squat', false);
      const z = lay().zone, q = Math.max(0, Math.min(1, (loop - 0.5) / 0.35));
      if(k === 'ctl'){ GX.ctx.strokeStyle = PAL.red; GX.ctx.lineWidth = 1.5; GX.ctx.beginPath(); GX.ctx.arc(z[0] + 8, z[1] + 6, 5, 0, 6.3); GX.ctx.stroke(); GX.ctx.lineWidth = 1; }
      if(loop >= 0.5){
        const ex = z[0] + (k === 'ctl' ? 8 : 0), ey = z[1] + (k === 'ctl' ? 6 : 0), bend = k === 'stf' ? Math.sin(q * Math.PI) * 14 : 0;
        ball(124 + (ex - 124) * q + bend, 90 + (ey - 90) * q, 1.5 + q * 2.5);
      }
      if(k === 'vel' && loop > 0.85){ R(196, 40, 54, 18, '#000'); pxText(`${140 + Math.floor((t * 7) % 15)}km`, 223, 43, PAL.red, 11); }
    }
  } else if(k === 'pow'){
    // 힘 훈련: 체육관에서 역기 들기
    R(0, 0, 256, 224, '#3c2c1c'); for(let x = 0; x < 256; x += 32) R(x, 0, 2, 150, '#2c1c0c');
    R(0, 150, 256, 74, '#5c4c3c'); R(20, 60, 50, 60, '#2c2c3c'); R(186, 60, 50, 60, '#2c2c3c');
    const up = Math.sin(t * 4) > 0, by = up ? 82 : 108;
    big(() => drawPerson('pitcher', 0, 0, col, 'set', false, 0), 128, 196, 2.4);
    R(70, by, 116, 4, '#c0c0c0'); R(62, by - 10, 10, 24, '#202020'); R(184, by - 10, 10, 24, '#202020');
    if(up) pxText('하나! 둘!', 128, 40, PAL.ink, 12);
  } else if(k === 'spd' || k === 'sta' || k === 'def'){
    // 달리기·수비: 잔디 위에서
    for(let y = 0; y < 224; y += 16) R(0, y, 256, 8, PAL.grass), R(0, y + 8, 256, 8, PAL.grass2);
    const sc2 = (t * 120) % 64;
    for(let x = -64; x < 256; x += 64) R(x + (k === 'def' ? 0 : -sc2) + 64, 150, 30, 2, '#ffffff88');
    if(k === 'def'){
      const n = Math.floor(t / 1.4), q = (t % 1.4) / 1.4, fx = 80 + (n % 2) * 96;
      const bx = 128 + (fx - 128) * Math.min(1, q * 1.2), bh = Math.sin(Math.min(1, q * 1.2) * Math.PI) * 60;
      big(() => drawPerson(q < 0.8 ? 'fielder' : 'fielder-set', 0, 0, col, ['set', 'lift', 'throw', 'follow'][Math.floor(t * 10) % 4], false), 128 + (fx - 128) * Math.min(1, q * 1.3), 170, 2.4);
      ball(bx, 150 - bh, 3 + bh / 20);
    } else {
      big(() => drawPerson('runner-s', 0, 0, col, Math.floor(t * 8) % 2 ? 'p1' : 'p0', false), 128, 180, 3);
      for(let i = 0; i < 3; i++) R(70 - i * 10 - (t * 60) % 10, 172 + i % 2 * 3, 3, 3, '#e8d8a8');
      if(k === 'sta') pxText(`${(t * 0.12).toFixed(1)}km`, 128, 40, PAL.white, 11);
    }
  } else if(k === 'fans'){
    // 팬 사인회: 탁자 앞에 팬들이 줄을 섬
    R(0, 0, 256, 224, '#1c2c5c'); for(let i = 0; i < 120; i++) R((i * 37) % 256, (i * 53) % 110, 2, 2, ['#fcfcfc', '#f87858', '#f8b800', '#3cbcfc'][i % 4]);
    R(40, 140, 176, 20, '#a85010'); R(40, 140, 176, 3, '#c87030');
    big(() => drawPerson('pitcher', 0, 0, col, 'set', false, 0), 128, 142, 1.6);
    ['#f83800', '#3cbcfc', '#58d854', '#f8b800'].forEach((c2, i) => { const x = 40 + i * 30 + Math.sin(t * 3 + i) * 2; drawPerson('fielder-set', x, 210, c2, 'p0', false); });
    for(let i = 0; i < 3; i++){ const hy = 120 - ((t * 30 + i * 25) % 70); pxText('♥', 150 + i * 18, hy, PAL.red, 10, true, false); }
  } else {
    // 쉬기: 밤, 창밖의 달, 쿨쿨
    R(0, 0, 256, 224, '#0c1838'); R(170, 40, 60, 50, '#1c2c5c'); R(198, 40, 2, 50, '#3c4c7c'); R(170, 64, 60, 2, '#3c4c7c');
    ctx.fillStyle = '#fce890'; ctx.beginPath(); ctx.arc(188, 56, 8, 0, 6.3); ctx.fill();
    R(40, 150, 130, 24, '#a87850'); R(40, 140, 40, 14, '#fcfcfc'); R(70, 144, 100, 16, col);
    for(let i = 0; i < 3; i++){ const zy = 130 - ((t * 20 + i * 18) % 50); pxText('Z', 80 + i * 14 + Math.sin(t + i) * 3, zy, PAL.white, 8 + i * 2, true, false); }
  }
  // 제목 띠
  R(0, 0, 256, 24, 'rgba(0,0,0,0.75)'); pxText(sc.title || '', 128, 5, PAL.ink, 12);
}
