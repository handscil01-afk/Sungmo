# 사용법: python3 -I baseball/tools/look_acc.py <장식 시트.png> <저장할 cr-parts.png> [원래 cr-parts.png]
# 필요: numpy, opencv-python-headless, pillow
# 새 장식 시트(부위만, 초록 배경)를 기존 장식 칸의 자리·크기에 맞춰 cr-parts.png 12~14줄에 넣음
import numpy as np, cv2, sys
from PIL import Image
SHEET = sys.argv[1]; PARTS = sys.argv[2]
src = np.array(Image.open(SHEET).convert('RGB')).astype(int)
g = (src[:, :, 1] > src[:, :, 0] + 50) & (src[:, :, 1] > src[:, :, 2] + 50)
fg = (~g).astype(np.uint8)
fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
n, lab, st, cen = cv2.connectedComponentsWithStats(fg, 8)
H, W = fg.shape
groups = {}
for k in range(1, n):
    if st[k, cv2.CC_STAT_AREA] < 25: continue
    cx, cy = cen[k]; col = int(cx // (W / 4)); row = 0 if cy < 330 else 1 if cy < 610 else 2
    groups.setdefault(row * 4 + col, []).append(k)
parts = np.array(Image.open(sys.argv[3] if len(sys.argv) > 3 else PARTS).convert('RGBA'))
S = 96
def oldbox(i):
    r, c = divmod(i, 4); a = parts[(12 + r) * S:(13 + r) * S, c * S:(c + 1) * S, 3]; ys, xs = a.nonzero()
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
# 자리 (x0, y0, x1, y1, 맞춤): 'c' 가운데 맞춤, 't' 위 맞춤, 'b' 아래 맞춤. 얼굴 기준: 눈썹 y36, 눈 43~57, 입 61~66, 귀 x10·85
TARGET = {0:(26, 57, 70, 63, 'c'), 1:(17, 40, 79, 58, 'c'), 2:(21, 42, 75, 58, 'c'), 3:(*oldbox(3), 'c'), 4:(31, 52, 65, 62, 'b'), 5:(22, 46, 74, 78, 't'), 6:(24, 52, 72, 62, 'c'), 7:(*oldbox(7), 'c')}
# 모자: (폭, 얼굴 좌표의 아래 끝). 칸 안에는 위에 붙여 넣고, 얼굴 좌표의 위 끝(음수 가능)은 look.js LOOK_HAT_TOP에 적음
HATS = {8:(76, 42), 9:(70, 40), 10:(80, 58), 11:(76, 42)}
out = parts.copy()
for i in range(12):
    ks = groups.get(i, []); m = np.isin(lab, ks)
    ys, xs = m.nonzero(); x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    crop = src[y0:y1, x0:x1].astype(np.float32); a = m[y0:y1, x0:x1].astype(np.float32)
    if i in HATS:
        hw, hb = HATS[i]; sc = hw / (x1 - x0); hh = round((y1 - y0) * sc); tx0, tx1, ty0, ty1, mode = 48 - hw / 2, 48 + hw / 2, 0, hh, 't'
        print('hat', i, 'top in face', hb - hh)
    else:
        tx0, ty0, tx1, ty1, mode = TARGET[i]
        sc = (tx1 - tx0) / (x1 - x0)
        if i == 5: sc = min(sc, (ty1 - ty0) / (y1 - y0))
    w = max(1, round((x1 - x0) * sc)); h = max(1, round((y1 - y0) * sc))
    A = cv2.resize(a, (w, h), interpolation=cv2.INTER_AREA); P = cv2.resize(crop * a[:, :, None], (w, h), interpolation=cv2.INTER_AREA)
    cell = np.zeros((S, S, 4), np.uint8); on = A > 0.5
    rgb = np.clip(P / np.maximum(A, 1e-6)[:, :, None], 0, 255)
    rgb[:, :, 1] = np.minimum(rgb[:, :, 1], np.maximum(rgb[:, :, 0], rgb[:, :, 2]))   # 초록 번짐 빼기
    px = round((tx0 + tx1) / 2 - w / 2)
    py = round(ty1 - h) if mode == 'b' else round(ty0) if mode == 't' else round((ty0 + ty1) / 2 - h / 2)
    for yy in range(h):
        for xx in range(w):
            X, Y = px + xx, py + yy
            if on[yy, xx] and 0 <= X < S and 0 <= Y < S: cell[Y, X, :3] = rgb[yy, xx]; cell[Y, X, 3] = 255
    r, c = divmod(i, 4); out[(12 + r) * S:(13 + r) * S, c * S:(c + 1) * S] = cell
    print(i, 'src', (x1 - x0, y1 - y0), '->', (w, h), 'at', (px, py))
Image.fromarray(out).quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(PARTS, optimize=True)
