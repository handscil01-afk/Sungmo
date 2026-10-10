import sys, os
from PIL import Image, ImageFilter
SRC, OUT = sys.argv[1], sys.argv[2]
def unmark(im, cx, cy, r=24, dx=-56):
    """반짝이 워터마크를 옆 부분으로 덮는다"""
    patch = im.crop((cx - r + dx, cy - r, cx + r + dx, cy + r))
    m = Image.new('L', patch.size, 0); m.paste(255, (4, 4, 2 * r - 4, 2 * r - 4)); m = m.filter(ImageFilter.GaussianBlur(4))
    im.paste(patch, (cx - r, cy - r), m)
SHEETS = {
 'bg-regions': ({'forest': (26, 40, 244, 402), 'mushroom': (274, 40, 494, 402), 'coast': (524, 40, 742, 402),
                 'snow': (774, 40, 992, 402), 'ice-castle': (1024, 40, 1240, 402), 'jungle': (26, 446, 244, 800),
                 'swamp': (276, 446, 620, 800), 'crystal-cave': (648, 446, 994, 800), 'hell': (1026, 446, 1240, 800)}, [(1138, 723)]),
 'bg-interiors': ({'shop-in': (26, 38, 404, 404), 'tavern': (436, 38, 826, 404), 'village': (858, 38, 1238, 404),
                   'alley': (26, 444, 404, 800), 'spring': (436, 444, 826, 800), 'throne': (858, 444, 1238, 800)}, [(1167, 716)]),
}
os.makedirs(OUT, exist_ok=True)
for sheet, (boxes, marks) in SHEETS.items():
    im = Image.open(f'{SRC}/{sheet}.png').convert('RGB')
    for cx, cy in marks: unmark(im, cx, cy)
    for n, b in boxes.items():
        im.crop(b).save(f'{OUT}/{n}.jpg', quality=86, optimize=True, progressive=True)
        print(n, b[2] - b[0], b[3] - b[1])
