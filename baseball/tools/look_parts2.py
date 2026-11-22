# 사용법: python3 -I baseball/tools/look_parts2.py <초록을 지운 hair·eyes·mouth.png 폴더> <저장할 cr-parts.png> <원래 cr-parts.png>
# 새 머리·눈·입 시트(부위만, 초록 배경을 지운 RGBA)를 cr-parts.png 3~11줄에 맞춰 넣음
import numpy as np, cv2, sys
from PIL import Image
SRC, PARTS, BASE = sys.argv[1], sys.argv[2], sys.argv[3]
S = 96
base = np.array(Image.open(BASE).convert('RGBA'))
out = base.copy()
def oldbox(row, i):
    r, c = divmod(i, 4); a = base[(row + r) * S:(row + r + 1) * S, c * S:(c + 1) * S, 3]; ys, xs = a.nonzero()
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
def items(path):
    # 그림 덩어리를 시트 전체에서 찾아, 덩어리 가운데가 있는 칸에 넣음 (칸 경계를 넘어 그린 머리카락이 잘리거나 옆 칸에 섞이지 않게)
    a = np.array(Image.open(path).convert('RGBA')); H, W = a.shape[:2]
    m = (a[:, :, 3] > 0).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(m, 8)
    cellOf = {}
    for k in range(1, n):
        if st[k, cv2.CC_STAT_AREA] < 30: continue
        cx, cy = cen[k]; i = min(2, int(cy * 3 / H)) * 4 + min(3, int(cx * 4 / W)); cellOf.setdefault(i, []).append(k)
    res = []
    for i in range(12):
        ks = cellOf.get(i, []); big = max(st[k, cv2.CC_STAT_AREA] for k in ks)
        ks = [k for k in ks if st[k, cv2.CC_STAT_AREA] >= big * 0.03]
        sel = np.isin(lab, ks); cell = a.copy(); cell[:, :, 3] = np.where(sel, cell[:, :, 3], 0)
        ys, xs = np.nonzero(sel); res.append((cell, xs.min(), ys.min(), xs.max() + 1, ys.max() + 1, (i % 4) * W / 4, (i // 4) * H / 3))
    return res
def place(row, i, cell, bx0, by0, bx1, by1, sc, px, py):
    crop = cell[by0:by1, bx0:bx1].astype(np.float32); a = (crop[:, :, 3] > 0).astype(np.float32)
    w, h = max(1, round((bx1 - bx0) * sc)), max(1, round((by1 - by0) * sc))
    A = cv2.resize(a, (w, h), interpolation=cv2.INTER_AREA); P = cv2.resize(crop[:, :, :3] * a[:, :, None], (w, h), interpolation=cv2.INTER_AREA)
    rgb = np.clip(P / np.maximum(A, 1e-6)[:, :, None], 0, 255); rgb[:, :, 1] = np.minimum(rgb[:, :, 1], np.maximum(rgb[:, :, 0], rgb[:, :, 2]) + 8)
    r, c = divmod(i, 4); tile = np.zeros((S, S, 4), np.uint8)
    for yy in range(h):
        for xx in range(w):
            X, Y = px + xx, py + yy
            if A[yy, xx] > 0.5 and 0 <= X < S and 0 <= Y < S: tile[Y, X, :3] = rgb[yy, xx]; tile[Y, X, 3] = 255
    out[(row + r) * S:(row + r + 1) * S, c * S:(c + 1) * S] = tile
# 눈·입: 첫째 칸을 기준으로 한 배율·위치를 모든 칸에 똑같이 (칸 안 자리를 그대로 옮김)
def uniform(path, row, tw, tcx, tcy):
    # 첫째 칸을 기준으로 한 배율·위치를 모든 칸에 똑같이 (칸 안의 자리를 그대로 옮김: 칸 왼쪽 위 기준 좌표로 계산)
    it = items(path); cell, x0, y0, x1, y1, ox, oy = it[0]
    sc = tw / (x1 - x0); rcx, rcy = (x0 + x1) / 2 - ox, (y0 + y1) / 2 - oy
    for i, (cell, x0, y0, x1, y1, ox, oy) in enumerate(it):
        px = round(tcx + (x0 - ox - rcx) * sc); py = round(tcy + (y0 - oy - rcy) * sc)
        place(row, i, cell, x0, y0, x1, y1, sc, px, py)
uniform(f'{SRC}/eyes.png', 6, 50, 47.5, 47)
uniform(f'{SRC}/mouth.png', 9, 17, 47.5, 63.5)
# 머리: 칸마다 예전 머리 자리의 폭에 맞추고 위를 맞춤
for i, (cell, x0, y0, x1, y1, ox, oy) in enumerate(items(f'{SRC}/hair.png')):
    ox0, oy0, ox1, oy1 = oldbox(3, i); sc = (ox1 - ox0) / (x1 - x0)
    place(3, i, cell, x0, y0, x1, y1, sc, round((ox0 + ox1) / 2 - (x1 - x0) * sc / 2), oy0)
Image.fromarray(out).quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(PARTS, optimize=True)
