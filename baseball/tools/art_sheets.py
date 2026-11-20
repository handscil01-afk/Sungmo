#!/usr/bin/env python3
"""GPT로 만든 큰 그림(배경·바둑판 그림)을 게임 그림으로 바꿈.
사용법: python3 -I baseball/tools/art_sheets.py <원본 폴더> <설정.json>
설정.json: [{ "src":"원본.png", "out":"이름", "kind":"bg", "w":256, "h":224 },
            { "src":"원본.png", "out":"이름", "kind":"grid", "cols":4, "rows":2, "cw":47, "ch":60, "align":"bottom"|"center" }]
- bg: 같은 비율로 줄이고 색 수를 줄여 픽셀을 또렷하게 함.
- grid: 바둑판을 같은 크기 칸으로 나누고, 칸마다 그림이 있는 범위만 잘라 같은 배율로 줄인 뒤 칸 가운데(사람은 발끝을 칸 아래)에 놓음.
  반투명한 빛 번짐은 지우고(알파 160 미만), 자홍색(#FF00FF)에 가까운 색은 정확히 #FF00FF로 맞춰 게임이 팀 색으로 칠할 수 있게 함.
결과는 baseball/img/<이름>.png 와 img/index.json(칸 크기·칸 수·줄 수)."""
import sys, json, os
import numpy as np
from PIL import Image

SRC, CONF = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img')

def crisp(im, colors=64):
    """색 수를 줄이고(디더링 없음) 반투명을 없앰"""
    rgba = im.convert('RGBA'); a = np.array(rgba)
    alpha = a[..., 3] >= 128
    q = rgba.convert('RGB').quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    b = np.array(q)
    # 자홍색 가까운 색은 정확히 #FF00FF (팀 색 자리)
    r, g, bl = b[..., 0].astype(int), b[..., 1].astype(int), b[..., 2].astype(int)
    mag = (r > 180) & (bl > 170) & (g < 110) & (abs(r - bl) < 70)
    b[mag] = [255, 0, 255]
    out = np.dstack([b, np.where(alpha, 255, 0).astype(np.uint8)])
    return Image.fromarray(out.astype(np.uint8), 'RGBA')

def clean_alpha(im):
    a = np.array(im.convert('RGBA'))
    a[..., 3] = np.where(a[..., 3] >= 160, 255, 0)
    return Image.fromarray(a)

conf = json.load(open(CONF))
idx_path = os.path.join(OUT, 'index.json')
index = json.load(open(idx_path))
for c in conf:
    im = Image.open(os.path.join(SRC, c['src']))
    if c['kind'] == 'bg':
        out = im.convert('RGB').resize((c['w'], c['h']), Image.LANCZOS)
        out = crisp(out, c.get('colors', 64)).convert('RGB')
        out.save(os.path.join(OUT, c['out'] + '.png'))
        index[c['out']] = { 'w': c['w'], 'h': c['h'], 'n': 1, 'rows': 1 }
    else:
        im = clean_alpha(im)
        W, H = im.size; cols, rows, cw, ch = c['cols'], c['rows'], c['cw'], c['ch']
        pad = c.get('pad', 1)
        cells = []
        for r in range(rows):
            for k in range(cols):
                ins = c.get('inset', 0)   # 칸 가장자리에 옆 그림이 걸치면 안쪽으로 조금 잘라 냄
                box = (k * W // cols + ins, r * H // rows + ins, (k + 1) * W // cols - ins, (r + 1) * H // rows - ins)
                cell = im.crop(box); bb = cell.getbbox()
                cells.append(cell.crop(bb) if bb else cell)
        # 모든 칸에 같은 배율 (가장 큰 그림이 칸에 들어가게)
        s = min(min((cw - 2 * pad) / x.size[0], (ch - 2 * pad) / x.size[1]) for x in cells)
        sheet = Image.new('RGBA', (cw * cols, ch * rows), (0, 0, 0, 0))
        for i, x in enumerate(cells):
            w, h = max(1, round(x.size[0] * s)), max(1, round(x.size[1] * s))
            y = crisp(x.resize((w, h), Image.LANCZOS), c.get('colors', 48))
            ox = (i % cols) * cw + (cw - w) // 2
            oy = (i // cols) * ch + ((ch - pad - h) if c.get('align') == 'bottom' else (ch - h) // 2)
            sheet.alpha_composite(y, (ox, oy))
        sheet.save(os.path.join(OUT, c['out'] + '.png'))
        index[c['out']] = { 'w': cw, 'h': ch, 'n': cols, 'rows': rows }
    print('만듦:', c['out'])
json.dump(index, open(idx_path, 'w'), ensure_ascii=False, indent=1)
