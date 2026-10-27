"""앱 아이콘(야구공)을 만든다. 사용법: python3 baseball/tools/make_icons.py"""
import os, math
from PIL import Image, ImageDraw
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def draw(size, pad):
    S = size * 4
    im = Image.new('RGBA', (S, S), (11, 16, 32, 255))
    d = ImageDraw.Draw(im)
    r = S * (0.5 - pad)
    c = S / 2
    d.ellipse([c - r - S*0.02, c - r - S*0.02, c + r + S*0.02, c + r + S*0.02], fill=(255, 210, 63, 255))
    d.ellipse([c - r, c - r, c + r, c + r], fill=(250, 250, 245, 255))
    # 실밥: 양쪽으로 휘어진 곡선 두 줄과 바늘땀
    for side in (-1, 1):
        cx = c + side * r * 1.32
        rr = r * 0.95
        pts = []
        for i in range(0, 61):
            a = math.radians(180 + side * 0 - 52 + i * (104 / 60)) if side == 1 else math.radians(-52 + i * (104 / 60))
            pts.append((cx + rr * math.cos(a), c + rr * math.sin(a)))
        d.line(pts, fill=(220, 38, 38, 255), width=int(S * 0.022))
        for i in range(4, 60, 7):
            x, y = pts[i]; a = math.atan2(y - c, x - cx)
            nx, ny = math.cos(a), math.sin(a)
            tx, ty = -ny, nx
            L = S * 0.035
            for s in (-1, 1):
                d.line([(x, y), (x - nx * L * side * -1 + tx * L * s * 0.6, y - ny * L * side * -1 + ty * L * s * 0.6)], fill=(220, 38, 38, 255), width=int(S * 0.012))
    return im.resize((size, size), Image.LANCZOS)
draw(192, 0.08).save(os.path.join(here, 'icon-192.png'))
draw(512, 0.08).save(os.path.join(here, 'icon-512.png'))
draw(512, 0.2).save(os.path.join(here, 'icon-maskable-512.png'))
print('ok')
