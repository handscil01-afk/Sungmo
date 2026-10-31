#!/usr/bin/env python3
"""GPT로 만든 큰 도트 그림을 게임 크기(256x224 화면 기준) 스프라이트로 바꿈.
사용법: python3 -I baseball/tools/sprites.py <원본 폴더>   (결과는 baseball/img/ 와 img/index.json)
- 투명 배경이 아니면(체크무늬) 테두리에서부터 밝은 무채색을 지워 배경을 만든다(검정 윤곽선에서 멈춤).
- 빈 줄·빈 칸으로 동작 칸을 나누고, 같은 비율로 줄인 뒤 색 수를 줄이고 반투명을 없앤다.
- 칸은 모두 같은 크기로 맞추고, 발끝을 칸 아래에, 모자(자홍색) 가운데를 칸 가운데에 맞춘다."""
import sys, json, os
import numpy as np
from PIL import Image

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img')

def load(name):
    return Image.open(os.path.join(SRC, name)).convert('RGBA')

def remove_checker(im):
    """체크무늬(밝은 회색·흰색) 배경을 테두리부터 지움"""
    a = np.array(im).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    bgc = (mn > 150) & (mx - mn < 30)
    h, w = bgc.shape
    seen = np.zeros_like(bgc)
    stack = [(y, x) for x in range(w) for y in (0, h - 1)] + [(y, x) for y in range(h) for x in (0, w - 1)]
    while stack:
        y, x = stack.pop()
        if y < 0 or x < 0 or y >= h or x >= w or seen[y, x] or not bgc[y, x]: continue
        seen[y, x] = True
        stack += [(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)]
    a[..., 3] = np.where(seen, 0, 255)
    return Image.fromarray(a.astype(np.uint8))

def runs(profile, gap):
    """값이 있는 구간들 (gap보다 짧은 빈 구간은 이어 붙임)"""
    out, start, empty = [], None, 0
    for i, v in enumerate(profile):
        if v:
            if start is None: start = i
            empty = 0; end = i
        elif start is not None:
            empty += 1
            if empty > gap: out.append((start, end + 1)); start = None
    if start is not None: out.append((start, end + 1))
    return out

def components(mask):
    """연결된 덩어리마다 경계 상자 (4배 줄인 판에서 셈)"""
    h, w = mask.shape
    sm = mask[: h // 4 * 4, : w // 4 * 4].reshape(h // 4, 4, w // 4, 4).any(axis=(1, 3))
    lab = np.zeros(sm.shape, int); boxes = []
    for y0, x0 in zip(*np.where(sm)):
        if lab[y0, x0]: continue
        k = len(boxes) + 1; st = [(y0, x0)]; lab[y0, x0] = k; ys = []; xs = []
        while st:
            y, x = st.pop(); ys.append(y); xs.append(x)
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < sm.shape[0] and 0 <= xx < sm.shape[1] and sm[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = k; st.append((yy, xx))
        boxes.append([min(xs) * 4, min(ys) * 4, max(xs) * 4 + 4, max(ys) * 4 + 4, len(ys)])
    return boxes, lab

def frames(im, min_area=400):
    """한 줄의 동작 칸들: 큰 덩어리가 사람, 작은 덩어리(공·떨어진 조각)는 가장 가까운 사람에 붙임"""
    al = np.array(im)[..., 3] > 128
    bx, lab = components(al)
    for i, b in enumerate(bx): b.append([i + 1])
    big = sorted([b for b in bx if b[4] >= min_area], key=lambda b: b[0])
    for b in bx:
        if b[4] >= min_area or b[4] < 3: continue
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        t = min(big, key=lambda B: abs((B[0] + B[2]) / 2 - cx) + 0.3 * abs((B[1] + B[3]) / 2 - cy))
        t[0], t[1], t[2], t[3] = min(t[0], b[0]), min(t[1], b[1]), max(t[2], b[2]), max(t[3], b[3]); t[5] += b[5]
    res, arr = [], np.array(im)
    for b in big:
        # 상자가 겹쳐도 옆 사람 조각(방망이 끝 등)이 섞이지 않게 이 사람의 덩어리 칸만 남김
        keep = np.isin(lab, b[5]).repeat(4, 0).repeat(4, 1)
        full = np.zeros(al.shape, bool); full[: keep.shape[0], : keep.shape[1]] = keep
        a = arr.copy(); a[~full] = 0
        res.append(Image.fromarray(a).crop((b[0], b[1], min(b[2], im.width), min(b[3], im.height))))
    return res

def rows(im, gap=3, n=None, th=128):
    """빈 줄로 나눔. n을 주면 글씨 줄처럼 붙어 있어도 가장 옅은 곳 n-1군데에서 나눔"""
    al = np.array(im)[..., 3] > th
    prof = al.sum(1)
    if n is None:
        return [im.crop((0, y0, im.width, y1)) for y0, y1 in runs(prof > 2, gap) if y1 - y0 > 20]
    # 글씨 줄: 밝은 글자 칸이 있는 구간을 찾고, 가까운 구간(한 글자의 위아래 조각)은 합침
    a = np.array(im).astype(int)
    txt = al & ((a[..., 0] + a[..., 1] + a[..., 2]) > 200)
    rr = runs(txt.sum(1) > 3, 0)
    merged = [list(rr[0])]
    for y0, y1 in rr[1:]:
        if y0 - merged[-1][1] < 10 and min(y1 - y0, merged[-1][1] - merged[-1][0]) < 50: merged[-1][1] = y1
        else: merged.append([y0, y1])
    assert len(merged) == n, f'글씨 줄 {len(merged)}개 (기대 {n})'
    cuts = [max(0, merged[0][0] - 4)] + [(merged[i][1] + merged[i + 1][0]) // 2 for i in range(n - 1)] + [min(im.height, merged[-1][1] + 4)]
    return [im.crop((0, cuts[i], im.width, cuts[i + 1])) for i in range(n)]

def shrink(im, s):
    """BOX로 줄이고 반투명을 없앰"""
    w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    # 미리 곱한 알파로 줄여야 테두리 색이 번지지 않음
    a = np.array(im).astype(float)
    a[..., :3] *= a[..., 3:4] / 255
    pm = Image.fromarray(a.astype(np.uint8))
    sm = np.array(pm.resize((w, h), Image.BOX)).astype(float)
    al = sm[..., 3:4]
    sm[..., :3] = np.where(al > 0, sm[..., :3] * 255 / np.maximum(al, 1), 0)
    sm[..., 3] = np.where(sm[..., 3] > 110, 255, 0)
    return Image.fromarray(np.clip(sm, 0, 255).astype(np.uint8))

def tidy(im, colors=20):
    """색 수를 줄이고, 자홍색 비슷한 색은 순수한 자홍색, 아주 어두운 색은 검정으로"""
    a = np.array(im)
    rgb = Image.fromarray(a[..., :3]).quantize(colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    q = np.array(rgb).astype(int)
    r, g, b = q[..., 0], q[..., 1], q[..., 2]
    mag = (r > 150) & (b > 150) & (g < 110)
    q[mag] = [255, 0, 255]
    q[(r + g + b) < 90] = [0, 0, 0]
    out = np.dstack([q.astype(np.uint8), a[..., 3]])
    out[a[..., 3] == 0] = 0
    return Image.fromarray(out)

def anchor_x(im):
    """모자·헬멧(자홍색)의 가운데, 없으면 그림 가운데"""
    a = np.array(im).astype(int)
    top = a[: max(1, a.shape[0] * 4 // 10)]
    m = (top[..., 0] > 200) & (top[..., 2] > 200) & (top[..., 1] < 80) & (top[..., 3] > 0)
    xs = np.where(m)[1]
    return int(round(xs.mean())) if len(xs) else im.width // 2

def sheet(name, frame_rows, height, colors=20):
    """frame_rows: [[칸 그림…], …]. 가장 큰 칸의 높이가 height가 되게 같은 비율로 줄임"""
    tallest = max(f.height for row in frame_rows for f in row)
    s = height / tallest
    small = [[tidy(shrink(f, s), colors) for f in row] for row in frame_rows]
    ax = [[anchor_x(f) for f in row] for row in small]
    left = max(a for row, arow in zip(small, ax) for a in arow)
    right = max(f.width - a for row, arow in zip(small, ax) for f, a in zip(row, arow))
    cw, ch = left + right, max(f.height for row in small for f in row)
    n = max(len(r) for r in small)
    out = Image.new('RGBA', (cw * n, ch * len(small)), (0, 0, 0, 0))
    for j, (row, arow) in enumerate(zip(small, ax)):
        for i, (f, a) in enumerate(zip(row, arow)):
            out.paste(f, (i * cw + left - a, j * ch + ch - f.height), f)
    out.save(os.path.join(OUT, name + '.png'))
    print(name, out.size, 'cell', cw, ch)
    return { 'w': cw, 'h': ch, 'n': n, 'rows': len(small) }

def outline(im):
    """글씨 둘레에 검정 1도트 테두리"""
    a = np.array(im)
    al = a[..., 3] > 0
    grow = al.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        grow |= np.roll(np.roll(al, dy, 0), dx, 1)
    add = grow & ~al
    a[add] = [0, 0, 0, 255]
    return Image.fromarray(a)

TEXT_PAL = np.array([[0, 0, 0], [252, 224, 0], [252, 252, 252], [255, 0, 255], [248, 56, 0], [252, 152, 56]])
def clean_text(im):
    """글씨 색을 몇 가지(검정 테두리, 노랑, 흰색, 자홍, 빨강, 주황)로만 맞춰 지저분한 중간색을 없앰"""
    a = np.array(im).astype(int)
    rgb = a[..., :3]
    d = ((rgb[..., None, :] - TEXT_PAL[None, None]) ** 2).sum(-1)
    idx = d.argmin(-1)
    dark = rgb.sum(-1) < 200
    idx[dark] = 0
    out = TEXT_PAL[idx]
    res = np.dstack([out, a[..., 3]]).astype(np.uint8)
    res[a[..., 3] == 0] = 0
    return Image.fromarray(res)

def banners(name, im, n_expected, cell_w=384, cell_h=80, text_h=60):
    rs = rows(im, n=n_expected, th=240)
    out = Image.new('RGBA', (cell_w, cell_h * len(rs)), (0, 0, 0, 0))
    text_ref = sorted(r.height for r in rs)[len(rs) // 2]   # 보통 줄 높이 (홈런처럼 큰 줄은 더 크게)
    for j, r in enumerate(rs):
        a = np.array(r); a[..., 3] = np.where(a[..., 3] > 240, 255, 0); r = Image.fromarray(a)
        al = a[..., 3] > 0
        xs = np.where(al.sum(0) > 1)[0]; ys = np.where(al.sum(1) > 1)[0]
        r = r.crop((xs[0], ys[0], xs[-1] + 1, ys[-1] + 1))
        s = min((cell_h - 2 if r.height > 1.6 * text_ref else text_h) / r.height, (cell_w - 4) / r.width)
        f = outline(outline(clean_text(shrink(r, s))))
        out.paste(f, ((cell_w - f.width) // 2, j * cell_h + (cell_h - f.height) // 2), f)
    out.save(os.path.join(OUT, name + '.png'))
    print(name, out.size)
    return { 'w': cell_w, 'h': cell_h, 'n': 1, 'rows': len(rs), 'scale': 2 }

def background(name, im, colors=32):
    bg = im.convert('RGB').resize((256, 224), Image.BOX)
    bg = bg.quantize(colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    bg.save(os.path.join(OUT, name + '.png'))
    print(name, bg.size)
    return { 'w': 256, 'h': 224, 'n': 1, 'rows': 1 }

def bgwide(name, im, size):
    """넓은 경기장: 체크무늬 바깥은 어두운 관중석 색으로 채우고 정사각형 size로"""
    base = Image.new('RGBA', im.size, (28, 28, 60, 255)); base.alpha_composite(im)
    bg = base.convert('RGB').resize((size, size), Image.BOX)
    bg = bg.quantize(48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    bg.save(os.path.join(OUT, name + '.png'))
    print(name, bg.size)
    return { 'w': size, 'h': size, 'n': 1, 'rows': 1 }

def picture(name, im, width):
    """틀 그림(TV): 가운데 투명한 화면 자리의 상자도 함께 적음"""
    s = width / im.width
    f = tidy(shrink(im, s), 24)
    al = np.array(f)[..., 3] == 0
    h, w = al.shape
    # 테두리와 이어지지 않은 투명 칸 = 화면 자리
    seen = np.zeros_like(al); st = [(y, x) for x in range(w) for y in (0, h - 1)] + [(y, x) for y in range(h) for x in (0, w - 1)]
    while st:
        y, x = st.pop()
        if 0 <= y < h and 0 <= x < w and al[y, x] and not seen[y, x]:
            seen[y, x] = True; st += [(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)]
    hole = al & ~seen
    ys, xs = np.where(hole)
    f.save(os.path.join(OUT, name + '.png'))
    scr = [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)] if len(xs) else [0, 0, w, h]
    print(name, f.size, 'screen', scr)
    return { 'w': f.width, 'h': f.height, 'n': 1, 'rows': 1, 'screen': scr }

meta = {}
cfg = json.load(open(os.path.join(SRC, 'sprites.json')))
for name, c in cfg.items():
    im = load(c['file'])
    if c.get('crop'): im = im.crop(tuple(c['crop']))
    if c.get('checker'): im = remove_checker(im)
    kind = c['kind']
    if kind == 'bg': meta[name] = background(name, im)
    elif kind == 'bgwide': meta[name] = bgwide(name, im, c['size'])
    elif kind == 'picture': meta[name] = picture(name, im, c['width'])
    elif kind == 'banners': meta[name] = banners(name, im, c['n'])
    else:
        rr = rows(im) if c.get('rows', 1) > 1 else [im]
        fr = [frames(r) for r in rr]
        if c.get('pick'): fr = [[row[i] for i in c['pick']] for row in fr]
        print(name, [len(r) for r in fr])
        meta[name] = sheet(name, fr, c['height'])
json.dump(meta, open(os.path.join(OUT, 'index.json'), 'w'), ensure_ascii=False, indent=1)
