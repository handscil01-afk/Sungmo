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
const GX_FILES = ['bg-pitch', 'bg-field', 'pitcher', 'batter', 'catcher', 'fielder', 'banners', 'banners2', 'umpire', 'umpire-s', 'runner', 'tv'];
// 결과 글씨 (banners.png를 쓸 때는 이 순서로 한 줄에 하나씩, 128×32)
const BANNERS = ['스트라이크!', '볼', '헛스윙!', '파울', '안타!', '2루타!', '3루타!', '홈런!', '아웃!', '삼진!', '볼넷', '세이프!', '몸에 맞는 공'];
const BANNERS2 = ['비디오 판독', '판정 번복!', '원심 유지', '견제!', '도루!', '병살!', '끝내기!', '게임 셋!'];
function banner(text, y, color, size){
  for(const [file, list] of [['banners', BANNERS], ['banners2', BANNERS2]]){
    const im = GX.img[file], m = GX.meta[file], i = list.indexOf(text);
    if(im && m && i >= 0 && im.height >= (i + 1) * m.h){ const sc = m.scale || 1, w = m.w / sc, h = m.h / sc; GX.ctx.drawImage(im, 0, i * m.h, m.w, m.h, Math.round(128 - w / 2), Math.round(y + 12 - h / 2), w, h); return; }
  }
  pxText(text, 128, y, color, size);
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
  for(let i = 0; i < p.length; i += 4) if(p[i + 3] > 0 && p[i] > 180 && p[i + 2] > 180 && p[i + 1] < 90){ p[i] = r; p[i + 1] = g; p[i + 2] = b; }
  x.putImageData(d, 0, 0);
  return (GX.tinted[k] = c);
}
const R = (x, y, w, h, c) => { GX.ctx.fillStyle = c; GX.ctx.fillRect(Math.round(x), Math.round(y), w, h); };
// 도트 글씨: 글자를 그린 뒤 반투명한 테두리를 없애 또렷하게
// 글씨: 그림판이 2배 해상도라 글씨는 2배 크기로 만들어 반으로 줄여 그림 (도트 그림보다 또렷하게)
function pxText(str, x, y, color, size = 10, center = true, outline = true){
  const k = `t${str}${color}${size}${outline}`;
  let c = GX.tinted[k];
  if(!c){
    const S = size * 2, font = `bold ${S}px 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif`;
    const m = document.createElement('canvas').getContext('2d'); m.font = font;
    const w = Math.ceil(m.measureText(str).width) + 8, h = S + 10;
    c = document.createElement('canvas'); c.width = w; c.height = h;
    const t = c.getContext('2d'); t.font = font; t.textBaseline = 'top'; t.lineJoin = 'round';
    if(outline){ t.strokeStyle = '#000'; t.lineWidth = 4; t.strokeText(str, 4, 4); }
    t.fillStyle = color; t.fillText(str, 4, 4);
    GX.tinted[k] = c;
  }
  GX.ctx.drawImage(c, center ? x - c.width / 4 : x, y, c.width / 2, c.height / 2);
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
const POSE_FRAME = { set:0, lift:1, throw:2, follow:3, stance:0, swing:1, swfollow:2, bunt:3, u0:0, u1:1, u2:2, u3:3, u4:4, run0:0, run1:1, slideH:2, slideF:3, tag0:4, tag1:5, throw0:6, throw1:7 };
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
    if(call !== 'u0') drawPerson('umpire', 140, 238, '#ff00ff', call, false);   // 주심은 콜할 때만 보임
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
  if(A && (ph === 'flight' && A.t0 > 0.8 || ph === 'result')){ if(A.res === 'bunt') bPose = 'bunt'; else if(['whiff', 'foul', 'inplay'].includes(A.res)) bPose = ph === 'result' && A.t0 > 0.3 ? 'swfollow' : 'swing'; }
  const bp = left ? L.batL : L.batR;
  // 서 있는 자세만 반대로 뒤집음 (왼쪽 타석은 방망이를 오른쪽에 들고 섬). 휘두르는 그림은 원래 방향 그대로
  drawPerson('batter', bp[0], bp[1], T.color, bPose, bPose === 'stance' ? !left : left);
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
function tinyPlayer(x, y, team, frame){
  if(tinted('fielder', team) && GX.meta.fielder){ drawPerson('fielder', x, y, team, ['set', 'lift', 'throw', 'follow'][frame % 4], false); return; }
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
  const F = fieldTeam(G), T = batTeam(G), bb = A.bb || {}, k = Math.min(1, A.t0), ctx = GX.ctx;
  const ang = FIELD_ANG[bb.fi ?? 1] + (A.jit || 0);
  const dist = landDist(G, bb, ang), land = fm(ang, dist), home = fm(0, 0);
  // 타구: 그림자는 땅을 따라가고, 공은 높이만큼 위에 크게 (높이 뜨면 화면에 가까워지는 것처럼)
  const gx = home.x + (land.x - home.x) * k, gy = home.y + (land.y - home.y) * k;
  const apex = { fb: 22 + dist / 5, pu: 38, ld: 5, gb: 0 }[bb.type] ?? 15;
  let h = 4 * apex * k * (1 - k);
  if(bb.type === 'gb') h = Math.abs(Math.sin(k * Math.PI * 3)) * 2.5 * (1 - k);
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
  const people = Object.keys(FPOS).map(p => { const hp = pts[p], go = p === near ? Math.min(1, k * 1.15) : 0; return [hp.x + (chase.x - hp.x) * go, hp.y + (chase.y - hp.y) * go, F.color, p === near && go < 1 ? Math.floor(k * 12) : 0]; });
  people.push([home.x, home.y + 12, F.color, 0]);   // 포수
  // 타자 주자: 1루로 뜀 / 결과가 나오면 지금 주자 자리
  if(A.ph === 'fly'){ const b1 = fm(...BASE_POL[0]), q = Math.min(1, k * 1.3); people.push([home.x + (b1.x - home.x) * q, home.y + (b1.y - home.y) * q, T.color, Math.floor(k * 12)]); }
  else G.bases.forEach((r, i) => { if(r != null){ const b = fm(...BASE_POL[i]); people.push([b.x, b.y + 2, T.color, 0]); } });
  people.sort((p, q) => p[1] - q[1]).forEach(p => tinyPlayer(...p));   // 먼 사람부터 그려서 가까운 사람이 앞에
  // 심판: 결과가 나오면 1루심(세이프·아웃) 또는 주심(홈런)이 콜
  if(A.ph === 'fresult' && GX.meta['umpire-s']){
    if(A.hr) drawPerson('umpire-s', home.x + 14, home.y + 22, '#ff00ff', 'u4', false);
    else { const u = fm(0.95, 30); drawPerson('umpire-s', u.x, u.y, '#ff00ff', /아웃|삼진|병살/.test(A.banner || '') ? 'u1' : 'u2', false); }
  }
  R(gx - 2, gy - 1, 4, 2, 'rgba(0,0,0,0.45)');
  ball(gx, gy - lift, 2 + h / 6);
  ctx.restore();
  scoreBar(G);
  if(A.ph === 'fresult' && A.banner){
    banner(A.banner, 92, A.bannerColor || PAL.ink, 24);
    if(A.hr) fireworks(performance.now());
  }
}
// 홈런 불꽃: 몇 군데에서 터지며 퍼짐
function fireworks(now){
  const cols = [PAL.red, PAL.ink, '#3cbcfc', '#58d854', PAL.white];
  for(let i = 0; i < 4; i++){
    const t = ((now / 900) + i * 0.27) % 1, cx = [50, 206, 90, 170][i], cy = [50, 56, 36, 40][i], r = 4 + t * 22;
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
  const arrive = o.safe ? 0.7 : 0.84, tagT = o.safe ? 0.8 : 0.66;
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
  else pxText('공수 교대', 128, y0 + 6, PAL.ink, 16);
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
  const msg = A.mode === 'end' ? (G.winner >= 0 ? `${G.teams[G.winner].short} 승리!` : '무승부') : `${G.inning}회${G.top ? '초' : '말'} · ${batTeam(G).short} 공격`;
  pxText(msg, 128, y0 + 98, PAL.white, 11);
}

/* ---------- 움직임 ---------- */
// 결과 글씨: 이번에 생긴 효과음 사건과 중계 문장으로 정함
function bannerOf(fx, text){
  const has = n => fx.includes(n);
  if(G && G.over) return [G.walkoff ? '끝내기!' : '게임 셋!', PAL.ink, has('hr')];
  if(has('hr')) return ['홈런!', PAL.red, true];
  if(/병살/.test(text)) return ['병살!', '#3cbcfc'];
  if(has('b3')) return ['3루타!', PAL.ink]; if(has('b2')) return ['2루타!', PAL.ink]; if(has('hit')) return ['안타!', PAL.ink];
  if(has('k')) return ['삼진!', '#3cbcfc']; if(has('ball')) return ['볼넷', '#58d854']; if(has('out')) return ['아웃!', '#3cbcfc'];
  if(fx.some(n => /^whiff/.test(n))) return ['헛스윙!', '#f8b800']; if(has('foul')) return ['파울', PAL.white];
  if(has('strike')) return ['스트라이크!', '#f8b800']; if(has('ballc')) return ['볼', '#58d854']; if(has('safe')) return ['세이프!', PAL.ink];
  return null;
}
// 새 투구·새 플레이가 있으면 차례대로 보여 줌 (투구 → 도루·견제·판독)
function gfxStart(G, fx, lines){
  const now = performance.now(), text = (lines || []).map(l => l.s || l).join(' ');
  const newPitch = !!(G.anim && G.anim.n !== GX.lastAnimN), newPlay = !!(G.play && G.play.n !== GX.lastPlayN);
  GX.lastAnimN = G.anim ? G.anim.n : null; GX.lastPlayN = G.play ? G.play.n : null;
  const list = [];
  if(newPitch){
    // 도루·견제의 세이프·아웃은 뒤의 베이스 장면에서 보여 줌
    const pfx = newPlay && G.anim.res !== 'inplay' ? fx.filter(n => n !== 'safe' && n !== 'out') : fx;
    let bn = bannerOf(pfx, text);
    if(G.anim.res === 'hbp') bn = ['몸에 맞는 공', '#58d854'];
    list.push({ kind:'pitch', ...G.anim, ph:'windup', t0:0, banner: bn && bn[0], bannerColor: bn && bn[1], hr: bn && bn[2], jit: (Math.random() - 0.5) * 0.3 });
  }
  if(newPlay){
    const p = G.play;
    if(p.k === 'steal' || p.k === 'pick') list.push({ kind:'base', o: p, t0:0, banner: p.safe ? (p.k === 'steal' ? '도루!' : '세이프!') : '아웃!', intro: p.k === 'pick' ? '견제!' : null });
    else if(p.k === 'review') list.push({ kind:'review', o: p, t0:0 });
    else if(p.k === 'reviewEnd') list.push({ kind:'reviewEnd', o: p, t0:0 });
  }
  // 공수 교대·경기 끝: 이닝별 점수판 카드를 이어서 보여 줌
  if(G.over && GX.overShown !== G.at){ GX.overShown = G.at; list.push({ kind:'card', mode:'end' }); }
  else if((fx || []).includes('change')) list.push({ kind:'card', mode:'change' });
  if(!list.length){ const bn = bannerOf(fx || [], text); if(bn) list.push({ kind:'banner', ph:'result', t0:1, banner: bn[0], bannerColor: bn[1], hr: bn[2] }); }
  if(!list.length) return;
  list.forEach(a => a.start = now);
  GX.anim = list.shift(); GX.queue = list;
  if(!GX.raf && GX.cv) GX.raf = requestAnimationFrame(gfxTick);
}
// 시간이 흐른 만큼 단계를 정함. 끝났으면 false
function stepAnim(A, el){
  if(A.kind === 'banner') return el < 1200;
  if(A.kind === 'card'){ A.t0 = Math.min(1, el / 250); return A.mode === 'end' || el < 2600; }   // 경기 끝 카드는 계속 둠
  if(A.kind === 'base'){ A.t0 = Math.min(1, el / 1500); return el < 2400; }
  if(A.kind === 'review'){ A.t0 = (el % 2600) / 2600; return true; }   // 판독을 고르는 동안 계속 다시 보여 줌
  if(A.kind === 'reviewEnd'){ A.t0 = Math.min(1, el / 2600); A.phase = el < 2600 ? 'replay' : 'end'; return el < 4400; }
  // 투구: 투구 동작 0.3초 → 공 0.4초 → 결과 0.9초 (치면 공이 튀어 나가고) → 타구 1.1초 → 결과 1.2초
  if(el < 300){ A.ph = 'windup'; A.t0 = el / 300; return true; }
  if(el < 700){ A.ph = 'flight'; A.t0 = (el - 300) / 400; return true; }
  if(A.res !== 'inplay' || !A.bb){ A.ph = 'result'; A.t0 = 1; return el < 1600; }
  if(el < 1000){ A.ph = 'result'; A.t0 = (el - 700) / 300; return true; }
  const fly = A.bb.type === 'gb' ? 1300 : 1900;
  if(el < 1000 + fly){ A.ph = 'fly'; A.t0 = (el - 1000) / fly; return true; }
  A.ph = 'fresult'; A.t0 = 1; return el < 1000 + fly + 1500;
}
const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function gfxTick(){
  GX.raf = 0;
  if(!GX.cv || !document.contains(GX.cv) || !G) return;
  const now = performance.now();
  let A = GX.anim;
  while(A && !stepAnim(A, (now - A.start) * (REDUCED() ? 3 : 1))){ A = GX.anim = GX.queue.shift() || null; if(A){ A.start = now; } }
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
  if(GX.anim) GX.raf = requestAnimationFrame(gfxTick);
}
// render()가 부름: 화면 모드일 때 상황판 자리에 그림판을 두고, 새 투구·플레이가 있으면 움직임을 시작
function gfxRender(G, fx, lines){
  const bs = $('#boardSec');
  let wrap = bs.querySelector('.gfxwrap');
  if(!wrap){
    wrap = document.createElement('div'); wrap.className = 'gfxwrap'; wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = '<canvas id="gfx" width="512" height="448"></canvas>';
    GX.cv = wrap.firstChild; GX.ctx = GX.cv.getContext('2d'); GX.ctx.imageSmoothingEnabled = false; GX.key = '';
    GX.ctx.setTransform(2, 0, 0, 2, 0, 0);   // 그림은 256×224 좌표로 그리고 2배로 (글씨는 2배 해상도 그대로)
    if(!GX.img.__) gfxLoad();
  }
  bs.prepend(wrap);
  const key = `${G.at}:${G.anim ? G.anim.n : 0}:${G.play ? G.play.n : 0}:${G.seq}`;
  if(key !== GX.key){
    const fresh = GX.key && GX.key.split(':')[0] === String(G.at);
    GX.key = key;
    if(fresh) gfxStart(G, fx || [], lines);
    else { GX.lastAnimN = G.anim ? G.anim.n : null; GX.lastPlayN = G.play ? G.play.n : null; GX.anim = null; GX.queue = []; }
  }
  if(!GX.raf) GX.raf = requestAnimationFrame(gfxTick);
}

// 화면 모드면 시작하자마자 그림을 미리 불러옴 (처음 경기 화면에서 임시 그림이 보이지 않게)
if(typeof SET !== 'undefined' && SET.view === 'gfx') gfxLoad();
