"""시트 자르기 공용 함수: 배경 제거(마젠타·분홍 그라데이션·단색), 연결 요소 분리, 저장"""
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage


def load(path):
    return np.array(Image.open(path).convert('RGB')).astype(float)


def hsv(a):
    r, g, b = a[..., 0] / 255, a[..., 1] / 255, a[..., 2] / 255
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); d = mx - mn + 1e-6
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 0, (mx - mn) / (mx + 1e-6), 0)
    return h, s, mx


def bg_mask(a, kind, seed_border=True, hole_area=0):
    """배경일 가능성이 높은 픽셀 → 테두리와 이어진 것만 배경으로 본다"""
    h, s, v = hsv(a)
    if kind == 'magenta':
        cand = (a[..., 0] > 150) & (a[..., 2] > 150) & (a[..., 1] < 120) & (np.abs(a[..., 0] - a[..., 2]) < 70)
    elif kind == 'pink':
        cand = ((h > 295) | (h < 2)) & (s > 0.42) & (v > 0.18)
    elif kind == 'white':
        cand = (a.min(axis=2) > 232)
    elif kind == 'navy':
        cand = (np.abs(a - np.array([27, 26, 57])).max(axis=2) < 34)
    else:
        raise ValueError(kind)
    if not seed_border:
        return cand
    lab, n = ndimage.label(cand)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    if hole_area:
        # 팔·다리 사이처럼 테두리와 떨어진 배경 구멍도 일정 크기 이상이면 배경으로 본다
        sizes = ndimage.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
        border |= {i + 1 for i, sz in enumerate(sizes) if sz >= hole_area}
    return np.isin(lab, list(border))


def matte(a, bg, kind):
    """배경 마스크로 알파를 만들고, 가장자리의 배경색 번짐을 줄인다"""
    fg = ~bg
    fg = ndimage.binary_opening(fg, iterations=1)
    if kind in ('magenta', 'pink'):
        # 가장자리에 남은 분홍 광원·테두리 제거: 배경에서 가까운 분홍 픽셀은 배경으로 본다
        h, s, v = hsv(a)
        pinkish = ((h > (285 if kind == 'magenta' else 295)) | (h < 6)) & (s > 0.28) & (v > 0.3)
        for _ in range(3):
            dist = ndimage.distance_transform_edt(fg)
            kill = pinkish & fg & (dist < 7)
            if not kill.any():
                break
            fg &= ~kill
        if kind == 'pink':
            # 배경과 같은 진한 분홍 광원은 안쪽에 있어도 지운다
            fg &= ~(((h > 305) & (h < 345)) & (s > 0.45) & (v > 0.55))
        fg = ndimage.binary_opening(fg, iterations=1)
    alpha = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    al = np.array(alpha).astype(float) / 255
    al = np.where(fg, np.maximum(al, 0.0), al)
    rgb = a.copy()
    edge = (al > 0) & (al < 0.98)
    if kind in ('magenta', 'pink'):
        # 마젠타 계열 번짐: R,B 를 G 쪽으로 눌러 준다
        cap = rgb[..., 1] + 40
        rgb[..., 0] = np.where(edge, np.minimum(rgb[..., 0], np.maximum(cap, rgb[..., 0] * 0.8)), rgb[..., 0])
        rgb[..., 2] = np.where(edge, np.minimum(rgb[..., 2], cap), rgb[..., 2])
    return rgb, al


def components(al, min_area=200):
    lab, n = ndimage.label(al > 0.5)
    objs = ndimage.find_objects(lab)
    out = []
    for i, sl in enumerate(objs, 1):
        area = int((lab[sl] == i).sum())
        if area >= min_area:
            out.append(dict(id=i, area=area, y0=sl[0].start, y1=sl[0].stop, x0=sl[1].start, x1=sl[1].stop))
    return lab, out


def save_rgba(rgb, al, box, path, keep_mask=None, max_side=None, pad=4):
    x0, y0, x1, y1 = box
    H, W = al.shape
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad); x1, y1 = min(W, x1 + pad), min(H, y1 + pad)
    a2 = al[y0:y1, x0:x1].copy()
    if keep_mask is not None:
        km = ndimage.binary_dilation(keep_mask[y0:y1, x0:x1], iterations=2)
        a2 = a2 * km
    img = np.dstack([rgb[y0:y1, x0:x1].clip(0, 255), a2 * 255]).astype(np.uint8)
    im = Image.fromarray(img, 'RGBA')
    if max_side and max(im.size) > max_side:
        im.thumbnail((max_side, max_side), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'WEBP', quality=88, method=6)
    return im.size


def save_rgb(a, box, path, quality=86, max_side=None):
    im = Image.fromarray(a[box[1]:box[3], box[0]:box[2]].clip(0, 255).astype(np.uint8))
    if max_side and max(im.size) > max_side:
        im.thumbnail((max_side, max_side), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'JPEG', quality=quality, optimize=True, progressive=True)
    return im.size
