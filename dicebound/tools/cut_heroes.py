import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutlib import *
SRC, OUT = sys.argv[1], sys.argv[2]
def keep_near(lab, cs, main, min_area=900):
    m = (lab == main['id'])
    for c in cs:
        if c is main or c['area'] < min_area: continue
        if c['x0'] < main['x1'] and c['x1'] > main['x0'] and c['y0'] < main['y1'] and c['y1'] > main['y0'] and c['y0'] > 60:
            m |= (lab == c['id'])
    ys, xs = np.where(m)
    return m, (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
for name in ['druid','archer','knight']:
    a=load(f'{SRC}/pc-{name}.png')
    if name != 'druid':
        save_rgb(a,(23,53,139,169),f'{OUT}/{name}-face.jpg',90)
        a[45:178,14:148]=a[300,700]
    bg=bg_mask(a,'pink',hole_area=120); rgb,al=matte(a,bg,'pink')
    lab,cs=components(al,300)
    left=max([c for c in cs if c['x1']<700],key=lambda c:c['area'])
    right=max([c for c in cs if c['x0']>650],key=lambda c:c['area'])
    for side,c in (('front',left),('back',right)):
        m,box=keep_near(lab,[x for x in cs if (x['x1']<700)==(side=='front')],c)
        print(name,side,save_rgba(rgb,al,box,f'{OUT}/{name}-{side}.webp',keep_mask=m))

# 전사: 흰 배경, 정상·부상 × 앞·뒤
a = load(f'{SRC}/pc-knight-alt.png')
a[:140] = 255  # 위쪽 제목 글자 제거
bg = bg_mask(a, 'white', hole_area=150); rgb, al = matte(a, bg, 'white')
lab, cs = components(al, 3000)
fgm = al > 0.5
lab, cs = components(al, 3000)
cs.sort(key=lambda c: c['x0'])
masks = [lab == cs[0]['id'], lab == cs[1]['id']]
# 뒷모습 두 명은 붙어 있으므로 그 덩어리 안에서 가장 비어 있는 열로 나눈다
mb = lab == cs[2]['id']
cols = mb.sum(axis=0); mid = (cs[2]['x0'] + cs[2]['x1']) // 2
cut = mid - 80 + int(np.argmin(cols[mid - 80: mid + 80]))
left = mb.copy(); left[:, cut:] = False
right = mb.copy(); right[:, :cut] = False
masks += [left, right]
names = ['warrior-front', 'warrior-front-hurt', 'warrior-back', 'warrior-back-hurt']
for m, n in zip(masks, names):
    ys, xs = np.where(m)
    print(n, save_rgba(rgb, al, (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1), f'{OUT}/{n}.webp', keep_mask=m))
# 얼굴: 드루이드와 전사는 앞모습에서 얼굴 부분을 잘라 쓴다
from PIL import Image
FACE = {'druid': (0.533, 0.13, 0.18), 'warrior': (0.50, 0.065, 0.16)}  # (중심 x, 중심 y, 크기) 비율
for n, (fx, fy, fs) in FACE.items():
    im = Image.open(f'{OUT}/{n}-front.webp').convert('RGBA')
    w, h = im.size; sz = int(h * fs)
    cx, cy = int(w * fx), int(h * fy)
    face = im.crop((cx - sz // 2, cy - sz // 2, cx + sz // 2, cy + sz // 2))
    bgc = Image.new('RGBA', face.size, (40, 30, 45, 255)); bgc.alpha_composite(face)
    bgc.convert('RGB').resize((116, 116), Image.LANCZOS).save(f'{OUT}/{n}-face.jpg', quality=90)
