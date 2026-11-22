import sys, numpy as np, cv2
from PIL import Image
U = sys.argv[1]
for src, name in [('2786dd15', 'cr-academy'), ('636f3632', 'cr-hospital'), ('a0644a6d', 'cr-house'), ('22cdc6f1', 'cr-airport'), ('ed036159', 'cr-plaza')]:
    a = np.array(Image.open(f'{U}/{src}-image.png').convert('RGB')).astype(int)
    g = ((a[:, :, 1] > a[:, :, 0] + 60) & (a[:, :, 1] > a[:, :, 2] + 60) & (a[:, :, 1] > 180)).astype(np.uint8)
    H, W = g.shape; ff = g.copy(); mask = np.zeros((H + 2, W + 2), np.uint8)
    for x in range(0, W, 3):
        for y in (0, H - 1):
            if ff[y, x] == 1: cv2.floodFill(ff, mask, (x, y), 2)
    for y in range(0, H, 3):
        for x in (0, W - 1):
            if ff[y, x] == 1: cv2.floodFill(ff, mask, (x, y), 2)
    bg = ff == 2
    ys, xs = np.nonzero(~bg); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    # 그림 가장자리(바깥 60픽셀 안)에 갇힌 배경 초록 덩어리도 배경으로 (가운데의 나무·풀은 남김)
    pure = ((a[:, :, 1] > 225) & (a[:, :, 0] < 70) & (a[:, :, 2] < 70)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(pure, 8)
    for k in range(1, n):
        x, y, w, h, ar = st[k]
        if name == 'cr-hospital' and ar > 800 and (x < x0 + 60 or x + w > x1 - 60 or y < y0 + 60 or y + h > y1 - 60): bg |= lab == k
    bg = cv2.dilate(bg.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    crop = a[y0:y1, x0:x1].copy(); crop[bg[y0:y1, x0:x1]] = [26, 42, 74]
    im = Image.fromarray(crop.astype(np.uint8)).resize((512, round(512 * crop.shape[0] / crop.shape[1])), Image.LANCZOS)
    q = im.quantize(128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    qa = np.array(q).astype(int); r, gg, b = qa[..., 0], qa[..., 1], qa[..., 2]
    mag = (r > 180) & (b > 170) & (gg < 110) & (abs(r - b) < 70); qa[mag] = [255, 0, 255]
    Image.fromarray(qa.astype(np.uint8)).save(f'/home/user/Sungmo/baseball/img/{name}.png', optimize=True)
