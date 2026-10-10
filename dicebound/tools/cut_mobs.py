import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutlib import *
SRC, OUT = sys.argv[1], sys.argv[2]
NAMES = {
 'heroes-a': ['elf-archer','orc-brute','demon-warrior','ash-revenant','frost-knight','dryad-witch','bone-knight'],
 'heroes-b': ['void-sorceress','steam-golem','storm-caller','sea-witch','scorpion-blade','crystal-mystic','seraph'],
 'heroes-c': ['shell-witch','anchor-brute','tide-caller','shark-raider','coral-reaper','pearl-mystic','gilded-valkyrie'],
 'heroes-d': ['shaman','barbarian','thunder-huntress','jungle-blade','moss-reaper','spore-mystic','leopard-seraph'],
 'monsters-magenta': ['harpy-queen','succubus','cursed-dryad','siren','gorgon','drider-queen','shadow-assassin','void-herald','valkyrie','basilisk-tamer'],
}
for sheet, names in NAMES.items():
    a = load(f'{SRC}/{sheet}.png')
    kind = 'magenta' if 'magenta' in sheet else 'pink'
    bg = bg_mask(a, kind, hole_area=150); rgb, al = matte(a, bg, kind)
    if kind == 'magenta':
        # 제목 글자와 아래 작은 스프라이트는 큰 그림과 떨어져 있으므로 큰 요소만 남는다
        lab, cs = components(al, 4000)
    else:
        lab, cs = components(al, 4000)
    BIG = 8000 if kind == 'magenta' else 15000
    big = [c for c in cs if c['area'] >= BIG]
    for c in cs:  # 작은 조각은 겹치는 큰 인물에 합친다
        if c['area'] >= BIG: continue
        cx, cy = (c['x0'] + c['x1']) / 2, (c['y0'] + c['y1']) / 2
        for g in big:
            if g['x0'] - 20 <= cx <= g['x1'] + 20 and g['y0'] - 20 <= cy <= g['y1'] + 20:
                lab[lab == c['id']] = g['id']
                g['x0'], g['y0'] = min(g['x0'], c['x0']), min(g['y0'], c['y0'])
                g['x1'], g['y1'] = max(g['x1'], c['x1']), max(g['y1'], c['y1'])
                break
    cs = big
    parts = []
    for c in cs:
        m = lab == c['id']
        if c['y1'] - c['y0'] > 520:  # 위아래 인물이 붙은 경우 둘로 나눈다
            cut = 395
            for y0, y1 in ((c['y0'], cut), (cut, c['y1'])):
                mm = m.copy(); mm[:y0] = False; mm[y1:] = False
                ys, xs = np.where(mm)
                parts.append((mm, (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)))
        else:
            parts.append((m, (c['x0'], c['y0'], c['x1'], c['y1'])))
    row = lambda b: 0 if (b[1] + b[3]) / 2 < (420 if kind == 'magenta' else 390) else 1
    parts.sort(key=lambda p: (row(p[1]), p[1][0]))
    assert len(parts) == len(names), (sheet, len(parts))
    for (m, box), n in zip(parts, names):
        print(n, save_rgba(rgb, al, box, f'{OUT}/{n}.webp', keep_mask=m, max_side=560))
