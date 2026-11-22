# 동작 그림 줄(초록 배경 지운 RGBA)을 같은 배율 칸으로: 큰 덩어리(사람·머신)를 칸으로 삼고, 그 둘레 25% 안의 작은 조각(동작 선)만 함께 둠.
# 칸 사이로 넘어간 공·연기는 버림(게임이 공을 따로 그림). 사용: python3 -I frames.py src.png out.png 칸너비 칸높이 칸수
import sys, numpy as np, cv2
from PIL import Image
src, out, CW, CH, N = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
a = np.array(Image.open(src).convert('RGBA')); m = (a[:, :, 3] > 0).astype(np.uint8)
n, lab, st, cen = cv2.connectedComponentsWithStats(m, 8)
ks = sorted(range(1, n), key=lambda k: -st[k, cv2.CC_STAT_AREA]); big = sorted(ks[:N], key=lambda k: cen[k][0])
frames = []
for b in big:
    x, y, w, h, _ = st[b]; ex = w * 0.25; keep = [b]
    for k in ks[N:]:
        kx, ky, kw, kh, ar = st[k]
        if ar >= 12 and kx >= x - ex and kx + kw <= x + w + ex and ky >= y - h * 0.1 and ky + kh <= y + h * 1.05: keep.append(k)
    sel = np.isin(lab, keep); ys, xs = np.nonzero(sel)
    crop = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy(); crop[:, :, 3] = np.where(sel[ys.min():ys.max() + 1, xs.min():xs.max() + 1], crop[:, :, 3], 0)
    frames.append((crop, x + w / 2 - xs.min()))
s = min(min((CH - 2) / f.shape[0], (CW - 2) / f.shape[1]) for f, _ in frames)
sheet = Image.new('RGBA', (CW * N, CH), (0, 0, 0, 0))
for i, (f, cx) in enumerate(frames):
    im = Image.fromarray(f).resize((max(1, round(f.shape[1] * s)), max(1, round(f.shape[0] * s))), Image.LANCZOS)
    ar = np.array(im); ar[:, :, 3] = np.where(ar[:, :, 3] >= 150, 255, 0); im = Image.fromarray(ar)
    ox = round(i * CW + CW / 2 - cx * s); ox = min(max(ox, i * CW), (i + 1) * CW - im.width)
    sheet.alpha_composite(im, (ox, CH - 1 - im.height))
q = sheet.quantize(64, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert('RGBA')
qa = np.array(q); r, g, b = qa[..., 0].astype(int), qa[..., 1].astype(int), qa[..., 2].astype(int)
mag = (r > 180) & (b > 170) & (g < 110) & (abs(r - b) < 70) & (qa[..., 3] > 0); qa[mag, :3] = [255, 0, 255]
Image.fromarray(qa).save(out)
