import sys, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
def unmix(c, bg, scale):
    """배경색과의 차이로 알파를 구하고, 배경색 섞임을 걷어 낸 색을 복원한다"""
    d = np.abs(c - bg).max(axis=2)
    a = np.clip((d - 10) / scale, 0, 1)
    a = ndimage.grey_opening(a, size=2)
    f = (c - bg * (1 - a[..., None])) / np.maximum(a[..., None], 0.35)
    # 가장자리 14px 은 서서히 투명하게 (액자 선·잘린 경계 제거). 색 복원 뒤에 알파에만 적용한다
    h, w = a.shape; e = 14
    ry = np.clip(np.minimum(np.arange(h), h - 1 - np.arange(h)) / e, 0, 1)
    rx = np.clip(np.minimum(np.arange(w), w - 1 - np.arange(w)) / e, 0, 1)
    a = a * np.minimum(ry[:, None], rx[None, :]) ** 1.5
    return np.dstack([f.clip(0, 255), a * 255]).astype(np.uint8)
def trim_save(rgba, path, side=300):
    im = Image.fromarray(rgba, 'RGBA')
    bbox = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    if bbox: im = im.crop(bbox)
    im.thumbnail((side, side), Image.LANCZOS)
    im.save(path, 'WEBP', quality=86, method=6)
    return im.size
# 1) 픽셀 이펙트 (남색 바탕, 4×2, 아래쪽 글자 제외)
a = np.array(Image.open(f'{SRC}/fx-pixel.png').convert('RGB')).astype(float)
names = ['impact', 'slash', 'arrow', 'missile', 'bleed', 'heal', 'burn', 'freeze']
for i, n in enumerate(names):
    cx0 = (i % 4) * 316; cy0 = (i // 4) * 421
    box = (cx0 + 10, cy0 + 14, cx0 + 306, cy0 + 335)
    c = a[box[1]:box[3], box[0]:box[2]].copy()
    bg0 = c[5, 5].copy()
    if n == 'freeze': c[280:, 150:215] = bg0  # 오른쪽 아래 반짝이 워터마크 제거
    bg = np.median(np.concatenate([c[:6].reshape(-1, 3), c[-6:].reshape(-1, 3), c[:, :6].reshape(-1, 3), c[:, -6:].reshape(-1, 3)]), axis=0)
    print('px', n, trim_save(unmix(c, bg, 90), f'{OUT}/px-{n}.webp'))
# 2) 카드 이펙트 (마젠타 바탕, 5×2, 액자 안쪽만)
a = np.array(Image.open(f'{SRC}/fx-cards.png').convert('RGB')).astype(float)
names = ['punch', 'slash-green', 'fire-arrow', 'rune-orb', 'blood', 'heal-burst', 'combustion', 'frostbite', 'poison', 'shock']
xs = [(36, 256), (308, 529), (580, 801), (853, 1074), (1124, 1344)]; ys = [(42, 356), (414, 700)]
bgm = np.array([250., 0., 250.])
for i, n in enumerate(names):
    (x0, x1), (y0, y1) = xs[i % 5], ys[i // 5]
    c = a[y0:y1, x0:x1].copy()
    if n == 'shock':  # 오른쪽 아래 반짝이 워터마크 제거
        c[214:279, 99:164] = bgm
    print('card', n, trim_save(unmix(c, bgm, 150), f'{OUT}/{n}.webp'))
