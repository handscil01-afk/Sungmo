# 달리기 그림 5종(검은 바탕, 4칸씩)을 작은 그림 줄로: 바탕을 지우고, 테두리를 다시 그리고, 발끝을 맞춰 키 22픽셀로 줄임
# 쓰는 법: python3 tools/run_sprites.py <원본 폴더>
import sys, numpy as np
from PIL import Image
from collections import deque
SRC = sys.argv[1]
SETS = [('run-g', '7e9eb805'), ('run-b', 'be4fa965'), ('slide', '432f4c05'), ('run-f', '097e1ce4'), ('run-k', '46ee2c18')]
H = 22
def clean(im):
    a = np.array(im.convert('RGB')).astype(int); h, w, _ = a.shape
    dark = (a.max(2) < 60)
    bg = np.zeros((h, w), bool); q = deque()
    for x in range(w):
        for y in (0, h - 1): q.append((y, x))
    for y in range(h):
        for x in (0, w - 1): q.append((y, x))
    while q:
        y, x = q.popleft()
        if y < 0 or x < 0 or y >= h or x >= w or bg[y, x] or not dark[y, x]: continue
        bg[y, x] = True; q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    return a, ~bg
def frames(a, fg):
    w = a.shape[1]; cols = fg.any(0); out = []; x = 0
    # 4칸: 그림이 있는 열을 덩어리로 묶음 (먼지·줄은 작은 덩어리라 옆 칸에 붙임)
    runs = []; inr = False
    for i, c in enumerate(cols):
        if c and not inr: s = i; inr = True
        if not c and inr: runs.append([s, i]); inr = False
    if inr: runs.append([s, w])
    # 가까운 덩어리 합치기 → 4개가 될 때까지
    while len(runs) > 4:
        gaps = [runs[i + 1][0] - runs[i][1] for i in range(len(runs) - 1)]; i = int(np.argmin(gaps))
        runs[i] = [runs[i][0], runs[i + 1][1]]; del runs[i + 1]
    return runs
def shrink(a, fg, x0, x1, scale):
    rows = fg[:, x0:x1].any(1); y0 = np.argmax(rows); y1 = len(rows) - np.argmax(rows[::-1])
    sub = a[y0:y1, x0:x1]; m = fg[y0:y1, x0:x1]
    nh = max(1, round((y1 - y0) * scale)); nw = max(1, round((x1 - x0) * scale))
    rgb = Image.fromarray(np.where(m[..., None], sub, 0).astype('uint8')).resize((nw, nh), Image.BOX)
    al = Image.fromarray((m * 255).astype('uint8')).resize((nw, nh), Image.BOX)
    rgb = np.array(rgb).astype(float); al = np.array(al).astype(float) / 255
    keep = al > 0.45
    col = np.where(keep[..., None], rgb / np.maximum(al, 0.01)[..., None], 0).clip(0, 255)
    # 바깥 테두리 1픽셀 검정
    pad = np.zeros((nh + 2, nw + 2), bool); pad[1:-1, 1:-1] = keep
    edge = (np.roll(pad, 1, 0) | np.roll(pad, -1, 0) | np.roll(pad, 1, 1) | np.roll(pad, -1, 1)) & ~pad
    out = np.zeros((nh + 2, nw + 2, 4), 'uint8')
    out[1:-1, 1:-1, :3] = col.astype('uint8'); out[1:-1, 1:-1, 3] = keep * 255
    out[edge] = [0, 0, 0, 255]
    # 자홍(팀 색 자리)은 순수한 자홍으로 맞춰 팀 색으로 잘 바뀌게
    r, g, b = out[..., 0].astype(int), out[..., 1].astype(int), out[..., 2].astype(int)
    mag = (r > 150) & (b > 150) & (g < 110) & (out[..., 3] > 0)
    out[mag, :3] = [255, 0, 255]
    mag2 = (r > 90) & (b > 90) & (g < 60) & ~mag & (out[..., 3] > 0)
    out[mag2, :3] = [133, 7, 130]
    return Image.fromarray(out)
meta = {}
for name, key in SETS:
    a, fg = clean(Image.open(f'{SRC}/{key}-image.png'))
    runs = frames(a, fg)
    # 크기: 이 줄에서 가장 큰 키를 H-2로 (슬라이딩은 누워 있어 넓이 기준)
    hs = []
    for x0, x1 in runs:
        rows = fg[:, x0:x1].any(1); hs.append(len(rows) - np.argmax(rows[::-1]) - np.argmax(rows))
    scale = (H - 2) / max(hs) if name != 'slide' else (H - 2) / max(hs) * 0.9
    ims = [shrink(a, fg, x0, x1, scale) for x0, x1 in runs]
    W = max(im.width for im in ims); HH = max(H, max(im.height for im in ims))
    sheet = Image.new('RGBA', (W * len(ims), HH))
    for i, im in enumerate(ims): sheet.paste(im, (i * W + (W - im.width) // 2, HH - im.height))
    sheet.save(f'img/{name}.png'); meta[name] = {'w': W, 'h': HH, 'n': len(ims), 'rows': 1}
    print(name, len(runs), W, HH)
import json
m = json.load(open('img/index.json')); m.update(meta); m.pop('runner-t', None)
json.dump(m, open('img/index.json', 'w'), ensure_ascii=False, indent=1)
