"""DICEBOUND 이미지 시트를 개별 리소스로 잘라 assets/ 에 저장한다.

사용법 (저장소 루트에서):
  python3 dicebound/tools/cut_sheets.py <UI·아이콘 시트(마젠타 배경)> <캐릭터 시트> <배경·UI 시트> dicebound/assets
필요 패키지: pillow, numpy
"""
import sys, os, glob
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

def cut_magenta(src, out):
    im = np.array(Image.open(src).convert('RGB')).astype(float)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    # 마젠타 정도: r,b가 높고 g가 낮을수록 배경
    m = np.clip((np.minimum(r, b) - g - 60) / 110, 0, 1)
    alpha = 1 - m
    # 디스필: 남은 마젠타 기운을 g 쪽으로 눌러줌
    cap = g + (np.maximum(r, b) - g) * alpha
    r2 = np.where(m > 0, np.minimum(r, cap), r); b2 = np.where(m > 0, np.minimum(b, cap), b)
    rgba = np.dstack([r2, g, b2, alpha * 255]).clip(0, 255).astype(np.uint8)
    I = Image.fromarray(rgba, 'RGBA')
    boxes = {
     'ui/frame-tall': (648, 14, 255, 378), 'ui/frame-list': (948, 32, 558, 354), 'ui/frame-wide': (23, 57, 587, 324),
     'nodes/battle': (34, 419, 208, 207), 'nodes/elite': (281, 418, 209, 208), 'nodes/shop': (523, 419, 208, 207),
     'nodes/treasure': (763, 419, 209, 207), 'nodes/rest': (1006, 418, 208, 208), 'nodes/event': (1256, 419, 209, 208),
     'icons/bleed': (26, 663, 134, 146), 'icons/freeze': (165, 663, 133, 146), 'icons/block': (304, 663, 133, 146),
     'icons/burn': (441, 663, 134, 146), 'icons/heal': (580, 663, 136, 147),
     'dice/d1': (798, 698, 95, 94), 'dice/d2': (919, 698, 94, 94), 'dice/d3': (1041, 698, 94, 94),
     'dice/d4': (1162, 698, 92, 94), 'dice/d5': (1282, 698, 93, 94), 'dice/d6': (1401, 697, 93, 95),
     'icons/px-sword': (42, 861, 94, 98), 'icons/px-potion': (186, 856, 74, 103), 'icons/px-bag': (308, 857, 99, 102), 'icons/px-chest': (449, 873, 104, 83),
     'ui/btn-dark': (694, 869, 253, 100), 'ui/btn-teal': (979, 869, 251, 99), 'ui/btn-gray': (1260, 870, 241, 97),
    }
    for name, (x, y, w, h) in boxes.items():
        p = 3
        c = I.crop((x - p, y - p, x + w + p, y + h + p))
        os.makedirs(os.path.join(out, os.path.dirname(name)), exist_ok=True)
        c.save(os.path.join(out, name + '.png'), optimize=True)
    print('ok', len(boxes))


def cut_dark(chars_src, ui_src, out):
    C = Image.open(chars_src).convert('RGB'); U = Image.open(ui_src).convert('RGB')
    def save(img, name, q=None):
        p = os.path.join(out, name); os.makedirs(os.path.dirname(p), exist_ok=True)
        if name.endswith('.jpg'): img.convert('RGB').save(p, quality=q or 88, optimize=True, progressive=True)
        else: img.save(p, optimize=True)
    # 1) 캐릭터 초상 (불투명 jpg)
    chars = {
     'chars/player.jpg': (24, 62, 166, 158),      # 여행자 (플레이어)
     'chars/innkeeper.jpg': (190, 62, 334, 165),  # 여관 주인
     'chars/librarian.jpg': (357, 62, 503, 170),  # 도서관 관리자
     'chars/merchant.jpg': (519, 62, 654, 165),   # 상인
     'chars/healer.jpg': (672, 62, 810, 170),     # 치유사
     'chars/shopkeeper.jpg': (22, 534, 177, 648), # 아이템 상점
     'chars/questgiver.jpg': (194, 534, 354, 650),# 퀘스트 의뢰인
     'chars/mystic.jpg': (372, 534, 540, 672),    # 이벤트 NPC
     'chars/villager.jpg': (557, 534, 718, 648),  # 마을 주민
     'monsters/goblin.jpg': (844, 63, 968, 260), 'monsters/skeleton.jpg': (984, 63, 1104, 260),
     'monsters/mage.jpg': (1119, 63, 1238, 260), 'monsters/werewolf.jpg': (1254, 63, 1376, 260),
     'monsters/golem.jpg': (1393, 63, 1513, 260),
     'bosses/necromancer.jpg': (750, 534, 930, 642), 'bosses/hell-lord.jpg': (945, 534, 1123, 750),
     'bosses/fallen-knight.jpg': (1140, 534, 1320, 640), 'bosses/abyss-dragon.jpg': (1334, 534, 1513, 750),
    }
    for n, b in chars.items(): save(C.crop(b), n)
    # 2) 배경 (불투명 jpg)
    bgs = {
     'bg/menu.jpg': (397, 53, 521, 266), 'bg/menu-wide.jpg': (0, 160, 385, 297),
     'bg/forest.jpg': (534, 53, 646, 266), 'bg/city.jpg': (661, 53, 773, 266), 'bg/cave.jpg': (784, 53, 898, 266),
     'bg/snow.jpg': (911, 53, 1016, 266), 'bg/hell.jpg': (1028, 53, 1137, 266),
     'bg/battle.jpg': (597, 338, 896, 556), 'bg/shop.jpg': (923, 338, 1204, 556), 'bg/event.jpg': (1231, 338, 1518, 480),
     'ui/treasure-glow.jpg': (296, 740, 435, 801),
    }
    for n, b in bgs.items(): save(U.crop(b), n, 90)
    a = np.array(U).astype(float)
    def keyed(box, name, lo=14, hi=48):
        x0, y0, x1, y1 = box
        c = a[y0:y1, x0:x1]
        border = np.concatenate([c[0], c[-1], c[:, 0], c[:, -1]])
        bg = np.median(border, axis=0)
        dist = np.abs(c - bg).max(axis=2)
        al = np.clip((dist - lo) / (hi - lo), 0, 1)
        al[:2, :] = 0; al[-2:, :] = 0; al[:, :2] = 0; al[:, -2:] = 0
        # 가장자리 1px 페더링
        A = Image.fromarray((al * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
        al2 = np.minimum(np.array(A).astype(float) / 255, 1)
        # 배경색 혼입 제거(언프리멀티플라이)
        rgb = np.where(al2[..., None] > 0.02, (c - bg * (1 - al2[..., None])) / np.maximum(al2[..., None], 0.02), c)
        img = np.dstack([rgb.clip(0, 255), al2 * 255]).astype(np.uint8)
        save(Image.fromarray(img, 'RGBA'), name)
    def box(cx, cy, w, h): return (int(cx - w / 2), int(cy - h / 2), int(cx + w / 2), int(cy + h / 2))
    # 3) 유물 아이콘 3줄
    relic_names = [['arrow', 'chainmail', 'dark-ring', 'silver-ring', 'amulet', 'pack', 'lantern', 'scepter'],
                   ['leather', 'broken-heart', 'crown', 'ruby-ring', 'gold-tome', 'purple-tome', 'torch', 'blue-vase'],
                   ['purple-gem', 'chest', 'hammer', 'green-book', 'blue-book', 'altar', 'purple-chest']]
    xs = [641.7, 685, 728.3, 771.7, 815, 856.7, 898.3, 935]; ys = [630, 676.7, 723.3]
    for r, row in enumerate(relic_names):
        for i, n in enumerate(row): keyed(box(xs[i], ys[r], 44 if i < 7 else 34, 44), f'relics/{n}.png')
    pot = ['red', 'blue', 'green', 'scroll-roll', 'scroll-open', 'vial', 'bomb', 'crystal']
    pxs = [643.3, 686.7, 730, 773.3, 816.7, 860, 901.7, 935]
    for i, n in enumerate(pot): keyed(box(pxs[i], 817, 44 if i < 7 else 32, 48), f'potions/{n}.png')
    # 4) 보스 마커, 문장, 둥근 버튼
    for i, n in enumerate(['demon', 'skull', 'crystal', 'wolf', 'beast', 'dragon']):
        keyed(box([61, 140, 210, 281, 344, 406][i], 946, [70,70,66,66,62,66][i], 92), f'bossicons/{n}.png')
    for i, n in enumerate(['blue', 'purple', 'gold', 'red']):
        keyed(box([1322.5, 1377.5, 1432.5, 1487.5][i], 807, 54, 66), f'emblems/{n}.png')
    for i, n in enumerate(['menu', 'share', 'mail', 'settings']):
        keyed(box([1317.5, 1372.5, 1429, 1485][i], 627.5, 42, 42), f'ui/round-{n}.png', 18, 60)
    # 5) 시트3의 보스/미지 노드: 마름모 마스크
    for n, (cx, cy) in {'boss': (1382, 209), 'mystery': (1473.5, 209)}.items():
        R = 44; b = (cx - R, cy - R, cx + R, cy + R)
        crop = U.crop(b).resize((R * 4, R * 4), Image.LANCZOS)
        m = Image.new('L', crop.size, 0); d = ImageDraw.Draw(m); s = R * 4; k = s * 0.035
        d.polygon([(s / 2, k), (s - k, s / 2), (s / 2, s - k), (k, s / 2)], fill=255)
        m = m.filter(ImageFilter.GaussianBlur(1.2))
        crop.putalpha(m); save(crop, f'nodes/{n}.png')
    # 6) 로고: 밝기 기반 알파
    lb = (48, 16, 348, 140); L = a[lb[1]:lb[3], lb[0]:lb[2]]
    lum = L.mean(axis=2); sat = L.max(axis=2) - L.min(axis=2)
    al = np.clip((np.maximum(lum - 45, (sat - 40) * 0.8)) / 70, 0, 1)
    hh, ww = al.shape
    yy = np.minimum(np.arange(hh) / (hh * .12), (hh - 1 - np.arange(hh)) / (hh * .22)).clip(0, 1)
    xx = np.minimum(np.arange(ww), ww - 1 - np.arange(ww)) / (ww * .06)
    al = al * yy[:, None] * xx.clip(0, 1)[None, :]
    logo = np.dstack([L, al * 255]).clip(0, 255).astype(np.uint8)
    lg = Image.fromarray(logo, 'RGBA'); lg = lg.resize((lg.width * 2, lg.height * 2), Image.LANCZOS); save(lg, 'ui/logo.png')
    # 7) 이펙트: 배경색을 빼서 검은 바탕 (screen 합성용)
    fxn = [['slash-ice', 'vortex', 'slash-fire', 'shards'], ['heal', 'void', 'bolt', 'burst-ice'], ['burst-pink', 'burst-fire', 'burst-purple', 'rune']]
    fx_x = [1015, 1082.5, 1160, 1227.5]; fx_y = [647.5, 732.5, 812.5]
    for r, row in enumerate(fxn):
        for i, n in enumerate(row):
            x0, y0, x1, y1 = box(fx_x[i], fx_y[r], 76, 76); c = a[y0:y1, x0:x1]
            bg = np.median(np.concatenate([c[0], c[-1], c[:, 0], c[:, -1]]), axis=0)
            v = ((c - bg - 4) * 1.15).clip(0, 255).astype(np.uint8)
            save(Image.fromarray(v).resize((152, 152), Image.LANCZOS), f'fx/{n}.jpg')
    print('done')


def to_webp(out):
    # 투명 PNG는 용량이 커서 WebP로 바꾼다
    for f in glob.glob(os.path.join(out, '*', '*.png')):
        Image.open(f).save(f[:-4] + '.webp', 'WEBP', quality=90, method=6)
        os.remove(f)


if __name__ == '__main__':
    ui_sheet, char_sheet, bg_sheet, out = sys.argv[1:5]
    cut_magenta(ui_sheet, out)
    cut_dark(char_sheet, bg_sheet, out)
    to_webp(out)
