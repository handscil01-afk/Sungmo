# 선수 꾸미기 부위 그림 만들기: 얼굴을 통째로 그린 시트 다섯 장(skin·hair·eyes·mouth·acc, 4칸 × 3줄, 초록 배경)에서
# 민머리 얼굴과 달라진 부분만 떼어 img/cr-parts.png(96칸 4 × 15줄)를 만듦. 필요: numpy, opencv-python-headless, pillow
# 사용법: python3 -I baseball/tools/look_parts.py <시트 다섯 장이 있는 폴더>  → 지금 폴더에 cr-parts.png, parts-prev.png
import numpy as np, cv2, json, sys
from PIL import Image
CW, CH = 384, 341
WX, WY, WS = 12, -19, 360          # 기준(민머리 시트) 좌표에서 자를 창
OUT = 96
reg = {"eyes": [0.98, 0, -7], "mouth": [0.9874999999999998, -1, -5], "acc": [0.9874999999999998, -1, -5], "hair": [1.1099999999999999, -1, -5]}; reg['skin'] = [1.0, 0, 0]   # 시트마다 크기·위치 (머리 윤곽을 민머리 시트에 맞춰 찾은 값)
SRC = sys.argv[1] if len(sys.argv) > 1 else 'src'
def load(n): return np.array(Image.open(f'{SRC}/{n}.png').convert('RGB'))
def cell(a, i):
    r, c = divmod(i, 4); y0 = int(r * a.shape[0] / 3); x0 = int(c * a.shape[1] / 4)
    return a[y0:y0 + CH, x0:x0 + CW]
def towin(c, n):
    s, dx, dy = reg[n]; cx, cy = CW / 2, CH
    M = np.float32([[s, 0, (1 - s) * cx + dx - WX], [0, s, (1 - s) * cy + dy - WY]])
    return cv2.warpAffine(c, M, (WS, WS), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 255, 0))
def isgreen(c):
    c = c.astype(int); return (c[:, :, 1] > c[:, :, 0] + 50) & (c[:, :, 1] > c[:, :, 2] + 50)
def rdiff(x, b, r=3):
    # 위치가 한두 점 어긋나도 같다고 보도록, 둘레 r 안의 기준 점 가운데 가장 가까운 색과 비교
    x = x.astype(int); best = np.full(x.shape[:2], 10 ** 6)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            sh = np.roll(np.roll(b.astype(int), dy, 0), dx, 1)
            best = np.minimum(best, np.abs(x - sh).sum(axis=2))
    return best
def skinlike(x, tone, t=50): return np.abs(x.astype(int) - np.array(tone)).sum(axis=2) < t
def tone_of(c):
    # 얼굴 가운데 둘레에서 가장 흔한 밝은 색
    p = c[150:200, 130:230].reshape(-1, 3).astype(int); p = p[p.sum(1) > 500]
    q = (p // 8) * 8; v, cnt = np.unique(q, axis=0, return_counts=True); return tuple(v[cnt.argmax()] + 4)
def clean(m, minarea=60):
    m = m.astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    keep = np.zeros_like(m)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= minarea: keep[lab == i] = 1
    return keep.astype(bool)
def fillholes(m, maxarea=900):
    m = m.astype(np.uint8); inv = (1 - m).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(inv, 4)
    H, Wd = m.shape
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if a <= maxarea and x > 0 and y > 0 and x + w < Wd and y + h < H: m[lab == i] = 1
    return m.astype(bool)
def dropdark(m, c, maxarea):
    # 거의 검은 점만 있는 조각(다른 얼굴의 윤곽선·눈썹)은 뺌
    m = m.astype(np.uint8); n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8); dk = c.max(axis=2) < 90
    for k in range(1, n):
        sel = lab == k
        if st[k, cv2.CC_STAT_AREA] < maxarea and dk[sel].mean() > 0.85: m[sel] = 0
    return m.astype(bool)
def shrink(rgb, mask):
    # 미리 곱한 색으로 넓이 평균 → 96칸, 반 넘게 덮인 칸만 남김
    a = mask.astype(np.float32); pre = rgb.astype(np.float32) * a[:, :, None]
    A = cv2.resize(a, (OUT, OUT), interpolation=cv2.INTER_AREA); P = cv2.resize(pre, (OUT, OUT), interpolation=cv2.INTER_AREA)
    out = np.zeros((OUT, OUT, 4), np.uint8); on = A > 0.5
    out[on, :3] = np.clip(P[on] / A[on, None], 0, 255); out[on, 3] = 255
    # 초록 빛 번짐 지우기: 초록이 빨강·파랑 중 큰 값보다 크면 그 값으로 낮춤
    o = out[:, :, :3].astype(int); g = np.minimum(o[:, :, 1], np.maximum(o[:, :, 0], o[:, :, 2])); out[:, :, 1] = g
    return out
W = {n: [towin(cell(load(n), i), n) for i in range(12)] for n in ['skin', 'hair', 'eyes', 'mouth', 'acc']}
yy, xx = np.mgrid[0:WS, 0:WS]
def R(y0, y1, x0=0, x1=WS): return (yy >= y0 - WY) & (yy < y1 - WY) & (xx >= x0 - WX) & (xx < x1 - WX)   # 기준 좌표로 범위
layers = {}
# 1) 바탕 얼굴 (피부색 12)
layers['base'] = [shrink(c, ~isgreen(c)) for c in W['skin']]
bare = W['skin'][2]
# 2) 머리 모양: 민머리와 다른 점, 피부색 아님
hl = []
for c in W['hair']:
    t = tone_of(c); ci = c.astype(int)
    warm = (ci[:, :, 0] - ci[:, :, 2] > 45) & (ci.sum(2) > 300)     # 피부·주황 빛 번짐
    m = (rdiff(c, bare, 2) > 70) & ~skinlike(c, t, 60) & ~isgreen(c) & ~warm & ~R(150, 400, 95, 290)
    m = clean(m, 250)
    # 머리카락 밑에 깔린 원래 머리 윤곽선도 머리카락으로 (선 모양 틈 없애기)
    near = cv2.dilate(m.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    m = m | (near & (bare.max(axis=2) < 90) & (c.max(axis=2) < 110))
    m = fillholes(m, 1500)
    hl.append(shrink(c, m))
layers['hair'] = hl
# 3) 눈: 얼굴 안 눈썹~눈 범위에서 민머리와 다르고 피부색 아닌 점
el = []
for c in W['eyes']:
    t = tone_of(c); m = (rdiff(c, bare) > 70) & ~skinlike(c, t, 60) & ~isgreen(c) & R(95, 222, 82, 302)
    el.append(shrink(c, clean(m, 30)))
layers['eyes'] = el
# 4) 입: 같은 시트의 가운데값(기본 눈 얼굴)과 다른 점, 눈 아래만
med = np.median(np.stack(W['mouth']), axis=0).astype(np.uint8)
ml = []
for c in W['mouth']:
    t = tone_of(c); m = (rdiff(c, med) > 70) & ~skinlike(c, t, 60) & ~isgreen(c) & R(200, 320, 110, 275)
    ml.append(shrink(c, fillholes(clean(m, 20), 3000)))
layers['mouth'] = ml
# 5) 장식 8 + 모자 4: 같은 시트의 가운데값과 다른 점 (모자 1의 지워진 눈처럼 피부색은 뺌)
med = np.median(np.stack(W['acc']), axis=0).astype(np.uint8)
al = []
# 장식마다 들어갈 자리 (기준 좌표 y0, y1, x0, x1), 모자는 눈 자리를 뺌
AREA = [(196, 228, 90, 300), (95, 222, 60, 330), (95, 222, 60, 330), (10, 112, 225, 340), (200, 248, 120, 270), (190, 275, 85, 305), (175, 232, 90, 300), (195, 265, 270, 340)]
for i, c in enumerate(W['acc']):
    t = tone_of(c); m = (rdiff(c, med, 0 if i in (4, 5) else 3) > 70) & ~skinlike(c, t, 25 if i == 6 else 60) & ~isgreen(c)
    if i < 8:
        m &= R(*AREA[i]); m = clean(m, 12)
        if i == 3: m = dropdark(m, c, 10 ** 6)   # 반창고: 눈썹 조각 빼기
    else:
        m &= R(-19, 240) & ~R(118, 240, 92, 292); m = fillholes(dropdark(clean(m, 200), c, 3000), 2500)
    if i == 5: m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)).astype(bool)   # 수염: 얇은 턱선 빼기
    al.append(shrink(c, m))
layers['acc'] = al
# 한 장으로: 4칸 × 15줄 (바탕 3줄, 머리 3줄, 눈 3줄, 입 3줄, 장식·모자 3줄)
sheet = np.zeros((OUT * 15, OUT * 4, 4), np.uint8)
for k, name in enumerate(['base', 'hair', 'eyes', 'mouth', 'acc']):
    for i, L in enumerate(layers[name]):
        r, c = divmod(i, 4); sheet[(k * 3 + r) * OUT:(k * 3 + r + 1) * OUT, c * OUT:(c + 1) * OUT] = L
Image.fromarray(sheet).quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save('cr-parts.png', optimize=True)
# 모자 아래로 머리를 가릴 줄: 모자마다 가운데 열들에서 모자 점이 끝나는 높이
clip = []
for L in layers['acc'][8:]:
    a = L[:, 30:66, 3] > 0; rows = a.any(axis=1).nonzero()[0]; clip.append(int(rows.max()) if len(rows) else 0)
print('hat clip rows', clip)
json.dump({'hatClip': clip}, open('parts-meta.json', 'w'))
# 미리보기: 초록 바탕에 4배
bg = np.zeros_like(sheet); bg[:] = (40, 160, 60, 255)
a = sheet[:, :, 3:] / 255; prev = (sheet[:, :, :3] * a + bg[:, :, :3] * (1 - a)).astype(np.uint8)
Image.fromarray(prev).resize((OUT * 4 * 2, OUT * 15 * 2), Image.NEAREST).save('parts-prev.png')
