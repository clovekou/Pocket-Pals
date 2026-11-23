#!/usr/bin/env python3
"""Redraw the Pokémon-style UI icon pack as clean 32x32 pixel art.

Every icon is painted on a 32x32 grid, gets the same rim lighting (light top-left
edge, darker bottom-right edge) and a 1px navy outline, then is scaled 4x with
nearest-neighbour to a 128x128 transparent PNG. The designs follow the original
pack (Pokemon_Style_UI_Icons/) with tidier shapes and consistent shading.

    python3 tools/make_ui_icons.py [out_dir]      # default: Pokemon_Style_UI_Icons_v2 (+ game item icons in assets/items/)

No dependencies: PNGs are written with zlib.
"""
import math, os, struct, sys, zlib

N, SCALE = 32, 4
OUT = (29, 21, 48)


def hexc(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def light(c, t=.32): return mix(c, (255, 255, 255), t)
def dark(c, t=.24): return mix(c, (32, 16, 42), t)


class G:
    """A 32x32 grid. Each cell: (rgb, flat). Flat cells skip the automatic rim shading."""

    def __init__(self):
        self.c = [None] * (N * N)

    def set(self, x, y, col, flat=False):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < N and 0 <= y < N:
            self.c[y * N + x] = None if col is None else (hexc(col) if isinstance(col, str) else col, flat)
        return self

    def get(self, x, y):
        return self.c[y * N + x] if 0 <= x < N and 0 <= y < N else None

    def clear(self, x, y): self.set(x, y, None); return self

    def ell(self, cx, cy, rx, ry, col, flat=False, where=None):
        for y in range(N):
            for x in range(N):
                dx, dy = (x + .5 - cx) / rx, (y + .5 - cy) / ry
                if dx * dx + dy * dy <= 1 and (where is None or where(x, y)):
                    self.set(x, y, col, flat)
        return self

    def circ(self, cx, cy, r, col, flat=False, where=None): return self.ell(cx, cy, r, r, col, flat, where)

    def ring(self, cx, cy, r0, r1, col, flat=True):
        for y in range(N):
            for x in range(N):
                d = math.hypot(x + .5 - cx, y + .5 - cy)
                if r1 <= d <= r0: self.set(x, y, col, flat)
        return self

    def rect(self, x0, y0, w, h, col, flat=False):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w): self.set(x, y, col, flat)
        return self

    def rrect(self, x0, y0, w, h, r, col, flat=False):
        """rounded rectangle (r = corner radius in cells)"""
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                cx = min(max(x + .5, x0 + r), x0 + w - r); cy = min(max(y + .5, y0 + r), y0 + h - r)
                if math.hypot(x + .5 - cx, y + .5 - cy) <= r + .01: self.set(x, y, col, flat)
        return self

    def poly(self, pts, col, flat=False):
        for y in range(N):
            for x in range(N):
                px, py, inside = x + .5, y + .5, False
                j = len(pts) - 1
                for i in range(len(pts)):
                    (xi, yi), (xj, yj) = pts[i], pts[j]
                    if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi: inside = not inside
                    j = i
                if inside: self.set(x, y, col, flat)
        return self

    def line(self, x0, y0, x1, y1, col, flat=True, w=1):
        x0, y0, x1, y1 = map(lambda v: int(round(v)), (x0, y0, x1, y1))
        dx, dy = abs(x1 - x0), -abs(y1 - y0); sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1; err = dx + dy
        while True:
            for a in range(w):
                for b in range(w): self.set(x0 + a, y0 + b, col, flat)
            if x0 == x1 and y0 == y1: break
            e2 = 2 * err
            if e2 >= dy: err += dy; x0 += sx
            if e2 <= dx: err += dx; y0 += sy
        return self

    def dots(self, pts, col, flat=True):
        for x, y in pts: self.set(x, y, col, flat)
        return self

    def text(self, x, y, s, col):
        for ch in s:
            rows = FONT[ch]
            for j, row in enumerate(rows):
                for i, bit in enumerate(row):
                    if bit == '#': self.set(x + i, y + j, col, True)
            x += len(rows[0]) + 1
        return self

    def vol(self, cx, cy, r, t=.2):
        """round volume: darken the lower-right crescent of a circle (keeps details drawn later)"""
        for y in range(N):
            for x in range(N):
                p = self.get(x, y)
                if not p or p[1]: continue
                if math.hypot(x + .5 - cx, y + .5 - cy) <= r and math.hypot(x + .5 - (cx - r * .32), y + .5 - (cy - r * .32)) > r * 1.02:
                    self.c[y * N + x] = (dark(p[0], t), True)
        return self

    def star(self, cx, cy, r0, r1, col, n=5, rot=-90, flat=False):
        pts = []
        for k in range(n * 2):
            r = r0 if k % 2 == 0 else r1; a = math.radians(rot + k * 180 / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        return self.poly(pts, col, flat)


FONT = {  # 3x5 caps
    'U': ['#.#', '#.#', '#.#', '#.#', '###'], 'S': ['###', '#..', '###', '..#', '###'], 'E': ['###', '#..', '##.', '#..', '###'],
    'L': ['#..', '#..', '#..', '#..', '###'], 'C': ['###', '#..', '#..', '#..', '###'], 'T': ['###', '.#.', '.#.', '.#.', '.#.'],
    'A': ['###', '#.#', '###', '#.#', '#.#'], 'N': ['#..#', '##.#', '#.##', '#..#', '#..#'], 'B': ['##.', '#.#', '##.', '#.#', '##.'],
    'K': ['#.#', '#.#', '##.', '#.#', '#.#'], 'X': ['#.#', '#.#', '.#.', '#.#', '#.#'], '%': ['#.#', '..#', '.#.', '#..', '#.#'],
}


def render(g, outline=True, shade=True):
    out = [None] * (N * N)
    for y in range(N):
        for x in range(N):
            p = g.get(x, y)
            if not p: continue
            col, flat = p
            if shade and not flat:
                same = lambda a, b: (g.get(a, b) or (None,))[0] == col
                if not same(x, y - 1) or not same(x - 1, y): col = light(col)
                elif not same(x, y + 1) or not same(x + 1, y): col = dark(col)
            out[y * N + x] = col
    if outline:
        for y in range(N):
            for x in range(N):
                if g.get(x, y): continue
                if g.get(x + 1, y) or g.get(x - 1, y) or g.get(x, y + 1) or g.get(x, y - 1): out[y * N + x] = OUT
    return out


def save_png(path, cells):
    W = N * SCALE
    rows = []
    for y in range(W):
        row = bytearray([0])
        for x in range(W):
            c = cells[(y // SCALE) * N + x // SCALE]
            row += bytes((*c, 255)) if c else b'\0\0\0\0'
        rows.append(bytes(row))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, W, 8, 6, 0, 0, 0))
                + chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b''))


# ---------------------------------------------------------------- palette
RED, RED_D, WHITE, CREAM = '#e8383d', '#b3202a', '#f6f4f8', '#fbf6ea'
BLUE, BLUE_L, NAVY = '#3d7de6', '#8fc4ff', '#1d1530'
GOLD, GOLD_D, GOLD_L = '#f5b81c', '#c98612', '#ffe27a'
LEAF, LEAF_D, STEM = '#55c24a', '#2f8a3a', '#7a4a26'
GREY, GREY_D, PINK = '#c9cbd8', '#7d8096', '#ff7fa8'
SHINE = '#ffffff'


def shine(g, pts): g.dots(pts, SHINE)


# ---------------------------------------------------------------- shared parts
def pokeball(g, cx=16, cy=16, r=13, top=RED, bottom=WHITE):
    g.circ(cx, cy, r, bottom)
    g.circ(cx, cy, r, top, where=lambda x, y: y + .5 < cy - 1)
    g.vol(cx, cy, r, .16)
    g.circ(cx, cy, r, NAVY, True, where=lambda x, y: cy - 1 <= y + .5 < cy + 1)
    br = max(1.6, r * .32)
    g.circ(cx, cy, br + 1.2, NAVY, True); g.circ(cx, cy, br, WHITE, True); g.circ(cx - .4, cy - .4, br * .5, '#ffffff', True)
    return g


def coin(g, face=GOLD, emblem=None):
    g.circ(16, 16, 13.5, face); g.vol(16, 16, 13.5, .22)
    g.ring(16, 16, 10.5, 9.6, GOLD_D)
    if emblem: emblem(g)
    shine(g, [(8, 9), (8, 10), (9, 8), (10, 7)])


def leaves(g, x, y, col=LEAF):
    g.poly([(x, y), (x - 7, y - 5), (x - 8, y - 2), (x - 3, y + 1)], col)
    g.poly([(x + 1, y), (x + 8, y - 6), (x + 9, y - 3), (x + 4, y + 1)], col)
    g.line(x - 6, y - 3, x - 2, y, LEAF_D); g.line(x + 7, y - 4, x + 3, y, LEAF_D)


def bubble(g, mark):
    g.rrect(4, 4, 24, 20, 8, WHITE)
    g.poly([(9, 22), (9, 29), (16, 22)], WHITE)
    mark(g)


def pill(g, face, label, ink, y0=9, h=14):
    g.rrect(2, y0, 28, h, 6, face)
    g.rect(5, y0 + 1, 22, 1, light(hexc(face), .5), True)
    g.rect(4, y0 + h - 2, 24, 1, dark(hexc(face) if isinstance(face, str) else face, .18), True)
    w = len(label) * 4 - 1
    g.text(16 - w // 2, y0 + (h - 5) // 2 - 1 + 1, label, ink)


def round_button(g, face, mark):
    g.circ(16, 16, 13.5, face); g.vol(16, 16, 13.5, .14)
    mark(g)
    shine(g, [(9, 7), (8, 8), (7, 9)])


# ---------------------------------------------------------------- designs
D = {}
def icon(path):
    def deco(f): D[path] = f; return f
    return deco


# ---- 01 navigation
@icon('01_Navigation/nav_bag.png')
def _(g):
    g.ring(16, 8, 5.5, 3.6, '#8a5a2b', False)
    g.rrect(5, 8, 22, 21, 5, '#e3aa5c'); g.vol(16, 18, 15, .12)
    g.rrect(5, 8, 22, 8, 4, '#c98c43', True); g.rect(5, 14, 22, 2, '#b07633', True)
    g.rrect(9, 18, 14, 10, 3, '#efc07a', True); g.rect(10, 27, 12, 1, '#d9a24f', True)
    g.rect(14, 12, 4, 4, GOLD, True); g.rect(15, 13, 2, 2, GOLD_D, True)
    pokeball(g, 16, 22, 3.6)
    g.rect(3, 15, 2, 9, '#b07633'); g.rect(27, 15, 2, 9, '#b07633')
    shine(g, [(8, 10), (9, 10)])


@icon('01_Navigation/nav_care_heart.png')
def _(g):
    g.circ(10.5, 12, 7, '#ff6f9c'); g.circ(21.5, 12, 7, '#ff6f9c')
    g.poly([(3.6, 13.5), (28.4, 13.5), (16, 27.5)], '#ff6f9c')
    shine(g, [(8, 8), (9, 8), (7, 9), (7, 10)])


@icon('01_Navigation/nav_explore_compass.png')
def _(g):
    g.circ(16, 16, 14, WHITE)
    g.circ(16, 16, 14, '#e8655a', where=lambda x, y: y < 9)
    g.ring(16, 16, 10.6, 9.7, NAVY)
    g.circ(16, 16, 9.6, '#f2f4fa', True)
    for a in range(0, 360, 90):
        r = math.radians(a); g.set(16 + 8 * math.cos(r) - .5, 16 + 8 * math.sin(r) - .5, GREY_D, True)
    g.poly([(13.5, 17.5), (18.5, 14.5), (22, 9)], RED, True); g.poly([(13.5, 17.5), (18.5, 14.5), (10, 23)], '#3b5dc9', True)
    g.dots([(15, 15), (16, 15), (15, 16), (16, 16)], NAVY)


@icon('01_Navigation/nav_party.png')
def _(g):
    pokeball(g); shine(g, [(9, 7), (8, 8), (10, 6)])


@icon('01_Navigation/nav_dex.png')
def _(g):
    g.rrect(6, 3, 20, 26, 3, '#e23b3b')
    g.rect(9, 7, 14, 11, NAVY, True); g.rect(10, 8, 12, 9, '#6fd3ff', True)
    g.dots([(11, 9), (12, 9), (11, 10)], '#d8f6ff')
    g.circ(11, 23, 2, NAVY, True); g.circ(11, 23, 1.2, '#4fd17a', True)
    g.rect(16, 22, 7, 2, NAVY, True)
    g.dots([(9, 4), (10, 4), (11, 4)], '#ff8a7a')


# ---- 02 items
def berry(g, body, spots):
    g.circ(16, 18.5, 11, body); g.vol(16, 18.5, 11)
    g.dots(spots, dark(hexc(body), .2))
    shine(g, [(10, 13), (11, 12), (9, 14), (10, 14)])


@icon('02_Items/oran_berry.png')
def _(g):
    berry(g, '#3d7de6', [(13, 21), (19, 17), (21, 23), (15, 26), (23, 19), (11, 18)])
    g.line(16, 8, 16, 6, STEM, w=2); leaves(g, 15, 8)


@icon('02_Items/berry_blue_alt.png')
def _(g):
    g.circ(16, 18.5, 10, '#4a6fe0'); g.dots([(12, 21), (18, 17), (20, 23), (15, 25)], '#3550b8')
    g.poly([(11, 9), (14, 11), (16, 8), (18, 11), (21, 9), (20, 13), (12, 13)], LEAF)
    shine(g, [(11, 14), (12, 13), (10, 15)])


@icon('02_Items/berry_pink.png')
def _(g):
    for cx, cy in [(12, 15), (20, 15), (16, 14), (11, 20), (21, 20), (16, 19), (13, 25), (19, 25), (16, 24)]:
        g.circ(cx, cy, 4.3, '#ff6fa0')
    g.dots([(12, 15), (20, 15), (16, 19), (11, 21), (21, 21), (14, 25), (19, 25)], '#c8326b')
    g.poly([(10, 9), (14, 11), (16, 7), (18, 11), (22, 9), (21, 13), (11, 13)], LEAF)
    shine(g, [(10, 14), (11, 13)])


@icon('02_Items/berry_yellow.png')
def _(g):
    g.poly([(8, 20), (11, 12), (16, 10), (22, 12), (25, 19), (22, 26), (16, 29), (10, 26)], '#ffd23b')
    g.dots([(13, 17), (18, 15), (20, 21), (15, 23), (12, 22), (19, 26)], '#d99a00')
    g.poly([(10, 8), (14, 11), (16, 6), (18, 11), (22, 8), (21, 13), (11, 13)], LEAF)
    shine(g, [(12, 14), (11, 15), (13, 13)])


@icon('02_Items/rare_candy.png')
def _(g):
    g.poly([(3, 8), (10, 11), (8, 17)], BLUE_L); g.poly([(29, 24), (22, 21), (24, 15)], BLUE_L)
    g.ell(16, 16, 9, 7, '#4c8df0'); g.line(9, 17, 22, 13, '#9fd0ff', w=1)
    shine(g, [(12, 12), (13, 11), (14, 11)])


@icon('02_Items/blue_candy_alt.png')
def _(g):
    g.poly([(3, 9), (9, 14), (9, 18), (3, 23)], '#7fb6ff'); g.poly([(29, 9), (23, 14), (23, 18), (29, 23)], '#7fb6ff')
    g.circ(16, 16, 8, '#3f6ee0'); g.line(11, 13, 21, 19, '#7fa6ff', w=1)
    shine(g, [(12, 11), (13, 10), (11, 12)])


@icon('02_Items/pearl.png')
def _(g):
    g.circ(16, 16, 12.5, '#efe4fa'); g.vol(16, 16, 12.5, .14)
    g.circ(20, 21, 3, '#f6d9ee', True)
    g.circ(11.5, 11.5, 3.2, '#ffffff', True); g.dots([(15, 9), (16, 9)], '#ffffff')


@icon('02_Items/star_piece.png')
def _(g):
    g.star(16, 17, 14, 6.5, '#ff7a86')
    g.line(16, 17, 16, 4, '#ffb3ba'); g.line(16, 17, 9, 26, '#e65865'); g.line(16, 17, 28, 13, '#ffb3ba')
    shine(g, [(15, 7), (14, 9)])


@icon('02_Items/nugget.png')
def _(g):
    g.poly([(9, 9), (17, 4), (25, 9), (27, 18), (22, 27), (12, 28), (6, 20)], GOLD)
    g.poly([(11, 11), (17, 7), (22, 11), (19, 17), (12, 17)], GOLD_L)
    g.line(19, 17, 24, 24, GOLD_D); g.line(12, 17, 9, 22, GOLD_D); g.line(19, 17, 12, 17, '#e09a14')
    shine(g, [(14, 9), (13, 10), (15, 8)])


@icon('02_Items/pokeball.png')
def _(g):
    pokeball(g); shine(g, [(9, 7), (8, 8), (10, 6)])


@icon('02_Items/great_ball.png')
def _(g):
    pokeball(g, top='#3d7de6')
    g.poly([(6, 10), (10, 4), (12, 5), (9, 12)], RED, True); g.poly([(26, 10), (22, 4), (20, 5), (23, 12)], RED, True)
    shine(g, [(14, 5), (15, 5)])


def potion(g, liquid, cap, wide=False):
    if wide:
        g.rrect(7, 11, 18, 18, 4, '#dfe6f5'); g.rrect(8, 15, 16, 13, 3, liquid)
        g.rrect(9, 5, 14, 7, 2, cap)
    else:
        g.rrect(13, 6, 6, 6, 1, '#dfe6f5'); g.rrect(8, 11, 16, 18, 6, '#dfe6f5'); g.rrect(9, 16, 14, 12, 5, liquid)
        g.rrect(12, 3, 8, 4, 1, cap)
    g.dots([(10, 14), (10, 15), (10, 16), (11, 13)] if not wide else [(9, 13), (10, 13), (9, 14)], '#ffffff')


@icon('02_Items/potion_blue.png')
def _(g): potion(g, '#4aa8f0', '#7c8aa8')


@icon('02_Items/potion_pink.png')
def _(g): potion(g, '#ff7fa8', '#e06a8a')


@icon('02_Items/potion_purple.png')
def _(g):
    potion(g, '#9b7af0', '#8b6ae0', wide=True)
    g.rect(8, 20, 16, 1, '#c3aefc', True); g.rect(8, 24, 16, 1, '#c3aefc', True)


@icon('02_Items/star_purple.png')
def _(g):
    g.star(16, 16, 14, 4.5, '#9b7af0', n=4)
    g.poly([(16, 2), (18, 14), (16, 16), (14, 14)], '#c7b6ff'); g.poly([(16, 16), (30, 16), (18, 18)], '#6f8cf0')
    shine(g, [(16, 6), (16, 7)])


# ---- 03 shop and rewards
@icon('03_Shop_and_Rewards/favorite_star.png')
def _(g):
    g.star(16, 17, 14, 6.5, '#ffcf33'); g.star(16, 17, 8, 3.8, '#ffe27a')
    shine(g, [(15, 7), (15, 8)])


def giftbox(g, box, ribbon):
    g.rect(5, 15, 22, 13, box); g.rect(4, 10, 24, 6, light(hexc(box), .12))
    g.rect(14, 10, 4, 18, ribbon, True); g.rect(4, 12, 24, 2, ribbon, True) if False else None
    g.poly([(16, 10), (9, 4), (7, 7), (11, 10)], ribbon); g.poly([(16, 10), (23, 4), (25, 7), (21, 10)], ribbon)
    g.rect(4, 15, 24, 1, dark(hexc(box), .2), True)


@icon('03_Shop_and_Rewards/gift.png')
def _(g): giftbox(g, '#f6f2ea', '#e0413a')


@icon('03_Shop_and_Rewards/gift_box.png')
def _(g): giftbox(g, '#e8473f', GOLD)


@icon('03_Shop_and_Rewards/gift_purple.png')
def _(g): giftbox(g, '#f6f2ea', '#8b5cf0')


@icon('03_Shop_and_Rewards/gold_token.png')
def _(g):
    coin(g, emblem=lambda g: g.star(16, 16.5, 6.5, 3, GOLD_L, flat=True))


@icon('03_Shop_and_Rewards/shop_coin.png')
def _(g):
    coin(g, emblem=lambda g: (g.rect(9, 15, 14, 2, GOLD_D, True), g.circ(16, 16, 3.6, GOLD_D, True), g.circ(16, 16, 2.2, GOLD_L, True)))


@icon('03_Shop_and_Rewards/pokeball_medal.png')
def _(g):
    g.poly([(10, 19), (15, 21), (12, 30), (9, 27), (6, 28)], '#4a8ff0'); g.poly([(22, 19), (17, 21), (20, 30), (23, 27), (26, 28)], '#4a8ff0')
    pokeball(g, 16, 12.5, 10); shine(g, [(10, 6), (9, 7)])


@icon('03_Shop_and_Rewards/sale_tag.png')
def _(g):
    g.poly([(4, 16), (13, 5), (27, 5), (27, 27), (13, 27)], '#ef4b3f')
    g.circ(9.5, 16, 2, None) if False else None
    for x, y in [(9, 15), (10, 15), (9, 16), (10, 16)]: g.clear(x, y)
    g.rect(15, 11, 3, 3, '#ffffff', True); g.rect(21, 19, 3, 3, '#ffffff', True); g.line(23, 11, 15, 21, '#ffffff', w=2)
    g.rect(13, 6, 14, 1, '#ff8a7f', True)


@icon('03_Shop_and_Rewards/shop_banner.png')
def _(g):
    g.rect(4, 15, 24, 13, CREAM); g.rect(3, 27, 26, 2, '#c9b48a')
    for i in range(6): g.rect(3 + i * 4, 11, 4, 5, RED if i % 2 == 0 else WHITE)
    g.rect(3, 9, 26, 3, RED_D)
    g.rect(13, 19, 6, 9, '#3d7de6'); g.rect(6, 18, 5, 5, '#8fd0ff'); g.rect(21, 18, 5, 5, '#8fd0ff')
    pokeball(g, 16, 6, 4.2)


@icon('03_Shop_and_Rewards/shop_storefront.png')
def _(g):
    g.rect(5, 13, 22, 15, CREAM); g.rect(4, 27, 24, 2, '#c9b48a')
    g.rect(5, 4, 22, 3, '#555a78')
    for i in range(6):
        col = RED if i % 2 == 0 else WHITE
        g.rect(4 + i * 4, 7, 4, 5, col); g.ell(6 + i * 4, 12, 2, 2, col)
    g.rect(13, 17, 6, 11, '#3d7de6'); g.dots([(17, 22)], GOLD_L)
    g.rect(7, 17, 4, 5, '#8fd0ff'); g.rect(21, 17, 4, 5, '#8fd0ff')


@icon('03_Shop_and_Rewards/shopping_cart.png')
def _(g):
    g.line(2, 5, 6, 5, '#4a6fb5', w=2); g.line(6, 5, 9, 21, '#4a6fb5', w=2)
    g.poly([(8, 9), (28, 9), (25, 19), (10, 19)], '#5aa0f0')
    for x in (13, 17, 21): g.line(x, 10, x - 0, 18, '#2f6fc9')
    g.line(9, 22, 26, 22, '#4a6fb5', w=2)
    g.circ(12, 27, 2.5, '#4a5578'); g.circ(23, 27, 2.5, '#4a5578')


@icon('03_Shop_and_Rewards/ticket.png')
def _(g):
    g.rrect(2, 8, 28, 16, 2, '#4a8ff0')
    for y in (15, 16): g.clear(2, y); g.clear(29, y)
    g.rect(2, 14, 1, 4, None) if False else None
    for y in range(9, 24, 2): g.set(22, y, '#9cc8ff', True)
    pokeball(g, 12, 16, 5.2)


@icon('03_Shop_and_Rewards/treasure_chest.png')
def _(g):
    g.rrect(4, 5, 24, 10, 4, '#d8443a'); g.rect(4, 13, 24, 14, '#c43a33')
    g.rect(4, 13, 24, 2, GOLD, True)
    for x in (8, 23): g.rect(x, 5, 2, 22, GOLD, True)
    g.rect(14, 12, 4, 6, GOLD_L, True); g.rect(15, 15, 2, 2, NAVY, True)
    shine(g, [(7, 7), (6, 8)])


@icon('03_Shop_and_Rewards/trophy.png')
def _(g):
    g.ring(6.5, 12, 4.5, 3, GOLD, False); g.ring(25.5, 12, 4.5, 3, GOLD, False)
    g.poly([(7, 5), (25, 5), (23, 15), (19, 19), (13, 19), (9, 15)], GOLD)
    g.rect(14, 19, 4, 4, GOLD_D); g.rrect(9, 23, 14, 5, 1, '#b97a35')
    g.rect(12, 24, 8, 2, GOLD_L, True)
    shine(g, [(11, 7), (11, 8), (11, 9)])


# ---- 04 settings and status
@icon('04_Settings_and_Status/alert.png')
def _(g):
    bubble(g, lambda g: (g.rect(14, 8, 4, 9, RED, True), g.rect(14, 18, 4, 3, RED, True)))


@icon('04_Settings_and_Status/help.png')
def _(g):
    bubble(g, lambda g: (g.rect(12, 8, 8, 2, '#3d4a6e', True), g.rect(18, 9, 3, 4, '#3d4a6e', True), g.rect(15, 12, 4, 2, '#3d4a6e', True),
                         g.rect(14, 13, 3, 3, '#3d4a6e', True), g.rect(14, 18, 3, 3, '#3d4a6e', True), g.rect(11, 9, 2, 2, '#3d4a6e', True)))


@icon('04_Settings_and_Status/battery.png')
def _(g):
    g.rrect(2, 9, 25, 15, 2, '#dfe3ee'); g.rect(27, 13, 3, 7, '#9aa0b8')
    g.rect(5, 12, 19, 9, '#4cc46a', True); g.rect(5, 12, 19, 2, '#86e59a', True)


@icon('04_Settings_and_Status/day_sun.png')
def _(g):
    for k in range(8):
        a = math.radians(k * 45); x, y = 16 + 12 * math.cos(a), 16 + 12 * math.sin(a)
        g.circ(x, y, 2.2, '#ffb02e')
    g.circ(16, 16, 8.5, '#ffd23b'); shine(g, [(12, 11), (13, 10), (11, 12)])


@icon('04_Settings_and_Status/night_moon.png')
def _(g):
    g.circ(15, 16, 12, '#4a6fe0', where=lambda x, y: (x + .5 - 21) ** 2 + (y + .5 - 12) ** 2 > 90)
    g.dots([(25, 6), (27, 10), (24, 22)], '#ffe27a'); shine(g, [(8, 14), (8, 15), (9, 12)])


@icon('04_Settings_and_Status/device_menu.png')
def _(g):
    g.rrect(8, 4, 16, 25, 4, '#e8383d'); g.rect(10, 2, 4, 3, '#555a78')
    g.rect(11, 9, 10, 8, NAVY, True); g.rect(12, 10, 8, 6, '#58d68d', True); g.dots([(13, 11), (14, 11)], '#c9ffd9')
    g.rect(11, 20, 10, 6, '#3a3f5c', True); g.dots([(13, 22), (16, 22), (19, 22), (13, 24), (16, 24), (19, 24)], '#9aa0b8')


@icon('04_Settings_and_Status/phone.png')
def _(g):
    g.rrect(9, 3, 14, 26, 3, '#8b93b5'); g.rect(11, 6, 10, 17, '#7fc7ff', True); g.dots([(12, 7), (13, 7), (12, 8)], '#d8f0ff')
    g.rect(14, 25, 4, 1, '#4a5578', True)


@icon('04_Settings_and_Status/mail.png')
def _(g):
    g.rect(3, 8, 26, 17, CREAM)
    g.line(3, 8, 16, 18, '#c9b48a'); g.line(28, 8, 16, 18, '#c9b48a')
    g.line(3, 24, 12, 15, '#e3d6b8'); g.line(28, 24, 20, 15, '#e3d6b8')


@icon('04_Settings_and_Status/map_flag.png')
def _(g):
    g.rect(9, 4, 2, 24, '#9a6a3a'); g.circ(10, 4, 1.8, GOLD)
    g.poly([(11, 5), (27, 9), (11, 16)], '#ef4b3f'); g.rrect(5, 27, 10, 3, 1, '#7b8a5a')


@icon('04_Settings_and_Status/music_note.png')
def _(g):
    g.circ(9, 24, 4, '#3d4a6e'); g.circ(22, 21, 4, '#3d4a6e')
    g.rect(12, 7, 2, 17, '#3d4a6e'); g.rect(25, 4, 2, 17, '#3d4a6e')
    g.poly([(12, 7), (27, 4), (27, 8), (12, 11)], '#3d4a6e')
    shine(g, [(7, 22), (20, 19)])


@icon('04_Settings_and_Status/profile_orb.png')
def _(g):
    pokeball(g, top='#4a8ff0'); shine(g, [(9, 7), (8, 8), (10, 6)])


@icon('04_Settings_and_Status/settings_gear.png')
def _(g):
    for k in range(8):
        a = math.radians(k * 45); g.circ(16 + 11 * math.cos(a), 16 + 11 * math.sin(a), 3.4, '#6f7fae')
    g.circ(16, 16, 10.5, '#6f7fae'); g.circ(16, 16, 4.2, NAVY, True); g.circ(16, 16, 3, '#dfe3ee', True)


@icon('04_Settings_and_Status/signal_bars.png')
def _(g):
    for i, h in enumerate((6, 11, 16, 21)): g.rect(4 + i * 7, 27 - h, 5, h, '#3d7de6')


def speaker(g):
    g.rect(4, 12, 6, 9, '#8b93b5'); g.poly([(9, 12), (17, 5), (17, 27), (9, 21)], '#8b93b5')


def waves(g, cx, cy, rings, col):
    for r0, r1 in rings:
        for y in range(N):
            for x in range(N):
                dx, dy = x + .5 - cx, y + .5 - cy
                if r1 <= math.hypot(dx, dy) <= r0 and dx > abs(dy) * .75: g.set(x, y, col)


@icon('04_Settings_and_Status/sound_speaker.png')
def _(g):
    speaker(g); waves(g, 15, 16, ((8.5, 6.8), (13.5, 11.8)), '#8b93b5')


@icon('04_Settings_and_Status/sound_muted.png')
def _(g):
    speaker(g); g.line(20, 23, 27, 10, RED, w=3)


def capsule(g, col):
    g.rect(9, 9, 14, 14, col); g.circ(9, 16, 7, col); g.circ(23, 16, 7, col)


@icon('04_Settings_and_Status/toggle_off.png')
def _(g):
    capsule(g, '#a9aec2'); g.circ(9, 16, 6.2, NAVY, True); g.circ(9, 16, 5.2, WHITE); shine(g, [(7, 13), (7, 14)])


@icon('04_Settings_and_Status/toggle_on.png')
def _(g):
    capsule(g, '#43b85a'); g.circ(23, 16, 6.2, NAVY, True); g.circ(23, 16, 5.2, WHITE); shine(g, [(21, 13), (21, 14)])


@icon('04_Settings_and_Status/treasure_map.png')
def _(g):
    g.poly([(4, 7), (27, 5), (28, 26), (5, 27)], '#f0d9a6')
    g.dots([(9, 20), (11, 18), (13, 17), (15, 15), (17, 14)], '#a0784a')
    g.line(19, 9, 24, 14, RED, w=2); g.line(24, 9, 19, 14, RED, w=2)
    g.rect(8, 9, 5, 3, '#c9a96e', True)


@icon('04_Settings_and_Status/volume_slider.png')
def _(g):
    g.rrect(2, 13, 28, 7, 3, '#dfe3ee'); g.rrect(3, 14, 15, 5, 2, '#ef4b3f', True)
    g.circ(18, 16.5, 6.2, NAVY, True); g.circ(18, 16.5, 5.2, WHITE); shine(g, [(16, 14), (16, 15)])


@icon('04_Settings_and_Status/wifi.png')
def _(g):
    for r0, r1 in ((15, 12.5), (10, 7.5)):
        for y in range(N):
            for x in range(N):
                dx, dy = x + .5 - 16, 26 - (y + .5)
                if r1 <= math.hypot(dx, dy) <= r0 and dy > abs(dx) * .8: g.set(x, y, '#3d7de6')
    g.circ(16, 24.5, 2.8, '#3d7de6')


@icon('04_Settings_and_Status/world_map.png')
def _(g):
    g.poly([(3, 7), (11, 4), (21, 7), (29, 4), (29, 25), (21, 28), (11, 25), (3, 28)], '#7fc7ff')
    g.poly([(5, 11), (10, 8), (13, 12), (11, 19), (6, 18)], '#5fbf5a'); g.poly([(17, 13), (25, 10), (27, 19), (20, 22)], '#5fbf5a')
    g.line(11, 4, 11, 25, '#5aa0d8'); g.line(21, 7, 21, 28, '#5aa0d8')


# ---- 05 buttons
@icon('05_Buttons_and_Controls/button_use.png')
def _(g): pill(g, '#e8383d', 'USE', '#ffffff')


@icon('05_Buttons_and_Controls/button_select.png')
def _(g): pill(g, WHITE, 'SELECT', NAVY)


@icon('05_Buttons_and_Controls/button_cancel.png')
def _(g): pill(g, WHITE, 'CANCEL', NAVY)


@icon('05_Buttons_and_Controls/button_back.png')
def _(g): pill(g, WHITE, 'BACK', NAVY)


@icon('05_Buttons_and_Controls/button_close.png')
def _(g):
    round_button(g, '#e8383d', lambda g: (g.line(11, 11, 20, 20, '#ffffff', w=2), g.line(20, 11, 11, 20, '#ffffff', w=2)))


@icon('05_Buttons_and_Controls/button_info.png')
def _(g):
    round_button(g, '#4a8ff0', lambda g: (g.rect(15, 9, 3, 3, '#ffffff', True), g.rect(15, 13, 3, 9, '#ffffff', True), g.rect(13, 13, 2, 1, '#ffffff', True), g.rect(13, 21, 7, 2, '#ffffff', True)))


@icon('05_Buttons_and_Controls/button_plus.png')
def _(g):
    round_button(g, WHITE, lambda g: (g.rect(10, 15, 12, 3, NAVY, True), g.rect(15, 10, 3, 12, NAVY, True)))


@icon('05_Buttons_and_Controls/button_minus.png')
def _(g):
    round_button(g, WHITE, lambda g: g.rect(10, 15, 12, 3, NAVY, True))


@icon('05_Buttons_and_Controls/button_confirm.png')
def _(g):
    round_button(g, '#43b85a', lambda g: (g.line(10, 16, 14, 20, '#ffffff', w=2), g.line(14, 20, 21, 11, '#ffffff', w=2)))


@icon('05_Buttons_and_Controls/button_pokeball.png')
def _(g):
    g.circ(16, 16, 14, WHITE); g.vol(16, 16, 14, .12); g.circ(16, 16, 11, NAVY, True); pokeball(g, 16, 16, 10); shine(g, [(9, 6), (8, 7), (7, 8)])


# ================================================================ game item icons (assets/items/)
ITEM = {}
def item(key):
    def deco(f): ITEM[key] = f; return f
    return deco


ROCK = [(9, 5), (20, 3), (27, 10), (28, 21), (20, 28), (9, 28), (4, 19), (4, 10)]
def stone(g, base, emblem=None):
    g.poly(ROCK, base)
    g.poly([(9, 5), (20, 3), (16, 11), (8, 12)], light(hexc(base), .25), True)
    g.poly([(28, 21), (20, 28), (17, 21)], dark(hexc(base), .18), True)
    if emblem: emblem(g)
    shine(g, [(10, 7), (11, 6), (9, 8)])


@item('fireStone')
def _(g): stone(g, '#f0623a', lambda g: (g.poly([(16, 9), (21, 16), (20, 22), (16, 24), (12, 22), (11, 17), (14, 18)], '#ffd23b', True), g.poly([(16, 15), (18, 19), (16, 22), (14, 20)], '#fff2a0', True)))

@item('waterStone')
def _(g): stone(g, '#3d8ff0', lambda g: (g.poly([(16, 8), (21, 17), (19, 22), (13, 22), (11, 17)], '#bfe4ff', True), g.dots([(14, 16), (14, 17)], '#ffffff')))

@item('thunderStone')
def _(g): stone(g, '#5fbf5a', lambda g: g.poly([(18, 7), (11, 17), (16, 17), (13, 25), (21, 14), (16, 14)], '#ffe14a', True))

@item('leafStone')
def _(g): stone(g, '#3f9d4a', lambda g: (g.poly([(10, 22), (14, 11), (22, 8), (21, 17), (14, 23)], '#8fe07a', True), g.line(11, 22, 20, 10, '#2f7a3a')))

@item('moonStone')
def _(g): stone(g, '#55506e', lambda g: (g.circ(16, 16, 6, '#ffe9a0', True, where=lambda x, y: (x + .5 - 19) ** 2 + (y + .5 - 14) ** 2 > 22), g.dots([(22, 9), (9, 21), (23, 22)], '#fff6c8')))

@item('sunStone')
def _(g):
    def em(g):
        for k in range(8):
            a = math.radians(k * 45); g.circ(16 + 7 * math.cos(a), 16 + 7 * math.sin(a), 1.3, '#ffe14a', True)
        g.circ(16, 16, 4.5, '#ffd23b', True); g.circ(15, 15, 1.5, '#fff6c8', True)
    stone(g, '#f07a32', em)

@item('shinyStone')
def _(g): stone(g, '#e6e9fb', lambda g: (g.star(16, 16, 7, 2.4, '#f5c518', n=4, flat=True), g.star(22, 10, 3, 1, '#ffe27a', n=4, flat=True), g.dots([(10, 22)], '#ffe27a')))

@item('duskStone')
def _(g): stone(g, '#4a3868', lambda g: (g.ell(16, 16, 7, 4.5, '#2a1f40', True), g.circ(16, 16, 2.6, '#c06cf0', True), g.dots([(15, 15)], '#f2d0ff')))

@item('dawnStone')
def _(g): stone(g, '#4fc8b8', lambda g: (g.star(16, 16, 7.5, 3, '#c9fff2', n=5, flat=True), g.dots([(16, 16)], '#ffffff')))

@item('iceStone')
def _(g):
    def em(g):
        for a in (0, 60, 120):
            r = math.radians(a); g.line(16 - 7 * math.cos(r), 16 - 7 * math.sin(r), 16 + 7 * math.cos(r), 16 + 7 * math.sin(r), '#ffffff')
        g.circ(16, 16, 1.6, '#ffffff', True)
    stone(g, '#8fd4f5', em)

@item('linkingCord')
def _(g):
    g.ring(12, 16, 8, 5.6, '#4a8ff0', False); g.ring(20, 16, 8, 5.6, '#ff7fa8', False)
    for y in range(N):
        for x in range(16, 19):
            if 11 <= y <= 13 and g.get(x, y): g.set(x, y, '#4a8ff0')
    shine(g, [(7, 11), (8, 10)])


def apple(g, body, leafc=LEAF):
    g.circ(11.5, 18, 9, body); g.circ(20.5, 18, 9, body); g.circ(16, 22, 8, body); g.vol(16, 18, 13, .14)
    g.rect(15, 5, 2, 6, STEM); g.poly([(17, 8), (25, 4), (24, 9), (18, 11)], leafc)
    shine(g, [(9, 13), (10, 12), (8, 14)])

@item('sweetApple')
def _(g): apple(g, '#c3dc4a')

@item('tartApple')
def _(g): apple(g, '#e8463a')

@item('syrupyApple')
def _(g):
    apple(g, '#f07a2a'); g.poly([(13, 24), (19, 24), (17, 29), (15, 29)], '#ffc84a'); g.dots([(16, 30)], '#ffc84a')


@item('crackedPot')
def _(g):
    g.ell(15, 19, 10, 8, '#9c86c9'); g.rect(10, 8, 10, 4, '#9c86c9'); g.rect(13, 6, 4, 2, '#7c66a9')
    g.poly([(24, 16), (30, 11), (29, 15), (25, 20)], '#9c86c9'); g.ring(5, 19, 4, 2.4, '#9c86c9', False)
    g.line(12, 13, 15, 18, NAVY); g.line(15, 18, 13, 22, NAVY); g.vol(15, 19, 10, .14)

@item('unremarkableTeacup')
def _(g):
    g.poly([(5, 10), (25, 10), (23, 22), (19, 25), (11, 25), (7, 22)], '#8fc97a'); g.ring(26, 15, 4.5, 2.6, '#8fc97a', False)
    g.rect(6, 10, 18, 2, '#e8f5d8', True); g.rrect(8, 26, 14, 3, 1, '#6fa95a')


@item('blackAugurite')
def _(g):
    g.poly([(14, 3), (24, 10), (27, 22), (17, 29), (6, 22), (7, 10)], '#2f2a38')
    g.poly([(14, 3), (17, 14), (7, 10)], '#5a5468', True); g.poly([(17, 14), (24, 10), (27, 22)], '#1f1a28', True)
    shine(g, [(12, 7), (11, 8)])

@item('peatBlock')
def _(g):
    g.poly([(4, 11), (16, 5), (28, 11), (16, 17)], '#9a6a3a'); g.poly([(4, 11), (16, 17), (16, 29), (4, 23)], '#7a4f2a'); g.poly([(16, 17), (28, 11), (28, 23), (16, 29)], '#5e3c20')
    g.dots([(10, 10), (17, 9), (21, 12), (8, 17), (11, 22), (21, 20), (24, 17)], '#4a2f18')

@item('metalAlloy')
def _(g):
    for i, c in enumerate(('#c9cbd8', '#9aa0b8', '#dfe3ee', '#8b93b5')):
        g.rrect(5, 6 + i * 5, 22, 5, 1, c)
    shine(g, [(7, 7), (8, 7)])


def armor(g, c, gem):
    g.poly([(6, 6), (12, 4), (16, 7), (20, 4), (26, 6), (27, 14), (22, 27), (16, 29), (10, 27), (5, 14)], c)
    g.line(16, 8, 16, 26, dark(hexc(c), .2)); g.circ(16, 14, 2.6, gem, True); g.vol(16, 16, 14, .14)
    shine(g, [(8, 8), (9, 7)])

@item('auspiciousArmor')
def _(g): armor(g, '#f5b81c', '#e8383d')

@item('maliciousArmor')
def _(g): armor(g, '#5a4aa0', '#8fd0ff')


def twigs(g, closed):
    for k in range(12 if closed else 9):
        a = math.radians(k * (30 if closed else 22) + (0 if closed else 160)); x, y = 16 + 10 * math.cos(a), 17 + 10 * math.sin(a)
        g.circ(x, y, 2.6, '#9a6a3a')
    if closed:
        for x, y in ((16, 7), (25, 21), (7, 21)): g.circ(x, y, 2.4, '#5fbf5a', True)
    else:
        g.poly([(13, 26), (19, 26), (16, 30)], '#5fbf5a')

@item('galaricaCuff')
def _(g): twigs(g, False); shine(g, [(8, 12)])

@item('galaricaWreath')
def _(g): twigs(g, True); shine(g, [(9, 10)])

def scroll(g, paper, seal):
    g.rrect(6, 7, 20, 18, 2, paper); g.rrect(3, 5, 4, 22, 2, '#9a6a3a'); g.rrect(25, 5, 4, 22, 2, '#9a6a3a')
    for y in (11, 15, 19): g.line(10, y, 22, y, dark(hexc(paper), .25))
    g.circ(16, 22, 3, seal, True)

@item('scrollOfDarkness')
def _(g): scroll(g, '#4a4060', '#c06cf0')

@item('scrollOfWaters')
def _(g): scroll(g, '#bfe4ff', '#3d7de6')


# ---- held items
@item('kingsRock')
def _(g):
    g.poly([(5, 26), (8, 14), (16, 11), (25, 14), (28, 26)], '#9aa0b8')
    g.poly([(8, 13), (9, 4), (13, 9), (16, 3), (19, 9), (23, 4), (24, 13)], GOLD)
    g.dots([(12, 11), (16, 9), (20, 11)], '#e8383d'); shine(g, [(9, 17), (10, 16)])

@item('metalCoat')
def _(g):
    g.poly([(8, 4), (24, 4), (26, 13), (16, 29), (6, 13)], '#c9cbd8'); g.poly([(11, 7), (21, 7), (22, 13), (16, 24), (10, 13)], '#9aa0b8', True)
    g.line(16, 8, 16, 22, '#dfe3ee'); shine(g, [(9, 6), (10, 6)])

@item('dragonScale')
def _(g):
    g.poly([(16, 3), (27, 13), (24, 26), (16, 29), (8, 26), (5, 13)], '#3fb8b0'); g.vol(16, 16, 14, .16)
    for y in (12, 17, 22): g.line(9, y, 16, y + 3, '#2a8a88'); g.line(16, y + 3, 23, y, '#2a8a88')
    shine(g, [(14, 7), (13, 8)])

@item('upgrade')
def _(g):
    g.rrect(5, 8, 22, 16, 3, '#ff8fb3'); g.rect(5, 8, 11, 16, '#6fb8ff'); g.rrect(5, 8, 22, 16, 3, None) if False else None
    g.rect(9, 12, 14, 8, '#f6f4f8', True); g.dots([(11, 15), (14, 15), (17, 15), (20, 15), (12, 17), (15, 17), (18, 17)], '#3d4a6e')

@item('dubiousDisc')
def _(g):
    g.circ(16, 16, 13, '#a070e0'); g.ring(16, 16, 9, 7.5, '#c9a8ff'); g.circ(16, 16, 3.2, None) if False else None
    for x in range(N):
        for y in range(N):
            if math.hypot(x + .5 - 16, y + .5 - 16) < 3: g.clear(x, y)
    g.vol(16, 16, 13, .16); shine(g, [(9, 8), (10, 7), (8, 9)])

@item('protector')
def _(g):
    g.poly([(5, 6), (27, 6), (27, 16), (16, 29), (5, 16)], '#4a4e66'); g.poly([(9, 9), (23, 9), (23, 15), (16, 24), (9, 15)], '#7d8096', True)
    g.rect(14, 9, 4, 14, '#4a4e66', True); g.dots([(7, 8), (25, 8)], '#c9cbd8')

def boxitem(g, c, mark):
    g.rrect(5, 7, 22, 20, 3, c); g.rect(5, 7, 22, 5, dark(hexc(c), .2), True); mark(g); shine(g, [(7, 13), (7, 14)])

@item('electirizer')
def _(g): boxitem(g, '#ffd23b', lambda g: g.poly([(18, 13), (12, 20), (16, 20), (14, 26), (21, 18), (17, 18)], '#3d4a6e', True))

@item('magmarizer')
def _(g): boxitem(g, '#e8463a', lambda g: g.poly([(16, 13), (21, 20), (19, 25), (13, 25), (11, 20), (14, 21)], '#ffd23b', True))

@item('reaperCloth')
def _(g):
    g.poly([(6, 6), (26, 6), (27, 26), (23, 22), (19, 27), (15, 22), (11, 27), (7, 22), (5, 26)], '#6a4a9a')
    g.ell(16, 13, 4, 3, '#1d1530', True); g.circ(16, 13, 1.5, '#ff5a5a', True); shine(g, [(8, 8), (9, 8)])

@item('razorClaw')
def _(g):
    g.poly([(8, 28), (6, 18), (10, 9), (19, 4), (27, 5), (20, 9), (15, 16), (14, 28)], '#eef0f6')
    g.line(9, 20, 18, 7, '#b8bccc'); shine(g, [(18, 5), (19, 5)])

@item('razorFang')
def _(g):
    g.poly([(8, 4), (24, 4), (22, 12), (17, 28), (15, 28), (10, 12)], '#f6f2ea'); g.line(16, 6, 16, 24, '#d8d0bc'); shine(g, [(11, 6), (11, 7)])

@item('ovalStone')
def _(g):
    g.ell(16, 16, 9.5, 12.5, '#f2efe6'); g.vol(16, 16, 12.5, .12); g.dots([(12, 13), (20, 19), (15, 22)], '#d8d2c2'); shine(g, [(12, 7), (11, 8), (11, 9)])

@item('deepSeaTooth')
def _(g):
    g.poly([(6, 5), (15, 3), (24, 8), (27, 20), (20, 29), (21, 17), (14, 10)], '#c9dcef'); g.line(9, 5, 22, 24, '#9fb8d8'); shine(g, [(9, 5), (10, 5)])

@item('deepSeaScale')
def _(g):
    g.poly([(16, 3), (27, 14), (23, 26), (16, 29), (9, 26), (5, 14)], '#ff9fc4'); g.vol(16, 16, 14, .14)
    for y in (12, 18): g.line(10, y, 16, y + 3, '#e07aa0'); g.line(16, y + 3, 22, y, '#e07aa0')
    shine(g, [(14, 7), (13, 8)])

@item('prismScale')
def _(g):
    g.poly([(16, 3), (27, 14), (23, 26), (16, 29), (9, 26), (5, 14)], '#ff8fb3')
    g.poly([(16, 3), (27, 14), (16, 16)], '#ffd23b'); g.poly([(27, 14), (23, 26), (16, 16)], '#5fbf5a'); g.poly([(23, 26), (16, 29), (9, 26), (16, 16)], '#4a8ff0'); g.poly([(9, 26), (5, 14), (16, 16)], '#9b7af0')
    shine(g, [(14, 7), (13, 8)])

@item('sachet')
def _(g):
    g.ell(16, 20, 10, 9, '#ff8fb3'); g.poly([(10, 12), (22, 12), (19, 9), (13, 9)], '#ff8fb3'); g.rect(10, 11, 12, 2, '#c83a6b', True)
    g.poly([(13, 9), (11, 3), (16, 6), (21, 3), (19, 9)], '#ffc2d6'); g.vol(16, 20, 10, .14); shine(g, [(9, 17), (10, 16)])

@item('whippedDream')
def _(g):
    g.ell(16, 24, 12, 5, '#fff6ea'); g.ell(16, 18, 9, 5, '#fff6ea'); g.ell(16, 12, 6, 4, '#fff6ea'); g.poly([(14, 9), (16, 3), (18, 9)], '#fff6ea')
    g.dots([(11, 22), (19, 17), (22, 24), (14, 13)], '#ff8fb3'); g.vol(16, 18, 13, .1)


# ---- treasure
def mushroom(g, cap, dot, cx=16, cy=13, r=11):
    g.rrect(int(cx - r * .36), int(cy), int(r * .72), int(r * 1.3), 2, '#f2ead8')
    g.ell(cx, cy, r, r * .78, cap, where=lambda x, y: y + .5 <= cy + 1)
    for dx, dy in ((-.45, -.3), (.1, -.55), (.5, -.15)): g.circ(cx + dx * r, cy + dy * r * .78, max(1.3, r * .17), dot, True)
    shine(g, [(int(cx - r * .7), int(cy - r * .3))])

@item('tinyMushroom')
def _(g): mushroom(g, '#e8463a', '#ffffff', 16, 16, 8)

@item('bigMushroom')
def _(g): mushroom(g, '#e8463a', '#ffffff', 16, 13, 13)

@item('balmMushroom')
def _(g): mushroom(g, '#d07ae0', '#fff0ff', 16, 13, 13); g.star(26, 5, 3, 1, '#ffe27a', n=4, flat=True)

def pearlball(g, cx, cy, r):
    g.circ(cx, cy, r, '#efe4fa'); g.vol(cx, cy, r, .14); g.circ(cx - r * .35, cy - r * .35, max(1, r * .28), '#ffffff', True)

@item('bigPearl')
def _(g): pearlball(g, 16, 16, 13.5); g.dots([(21, 23), (22, 22)], '#f6d9ee')

@item('pearlString')
def _(g):
    for k in range(9):
        a = math.radians(200 - k * 25); pearlball(g, 16 + 11 * math.cos(a), 13 - 9 * math.sin(a) + 6, 3.2)

@item('stardust')
def _(g):
    g.ell(16, 22, 12, 6, '#ff7a7a'); g.ell(16, 18, 8, 5, '#ff7a7a', where=lambda x, y: y < 20); g.vol(16, 20, 12, .12)
    g.dots([(10, 21), (14, 18), (19, 21), (22, 23), (16, 24), (12, 24)], '#ffd0d0')
    g.star(9, 8, 3.5, 1.2, '#ffe27a', n=4, flat=True); g.star(23, 6, 2.5, .9, '#ffe27a', n=4, flat=True)

@item('cometShard')
def _(g):
    g.poly([(3, 29), (12, 18), (15, 21)], '#bfe4ff'); g.poly([(6, 29), (13, 21), (14, 24)], '#ffffff', True)
    g.poly([(14, 12), (22, 4), (29, 9), (25, 19), (16, 21)], '#4a8ff0'); g.poly([(14, 12), (22, 4), (21, 13)], '#8fd0ff', True)
    shine(g, [(20, 7), (19, 8)])

@item('bigNugget')
def _(g):
    g.poly([(7, 8), (17, 3), (27, 8), (29, 19), (23, 28), (10, 29), (3, 20)], GOLD)
    g.poly([(9, 10), (17, 6), (24, 10), (20, 17), (11, 17)], GOLD_L)
    g.line(20, 17, 26, 25, GOLD_D); g.line(11, 17, 7, 23, GOLD_D); g.line(20, 17, 11, 17, '#e09a14')
    g.star(26, 5, 3.5, 1.2, '#ffffff', n=4, flat=True); shine(g, [(13, 8), (12, 9)])

@item('rareBone')
def _(g):
    for cx, cy in ((7, 22), (10, 26), (22, 6), (26, 10)): g.circ(cx, cy, 3.6, '#f2ead8')
    g.poly([(8, 21), (21, 8), (25, 11), (11, 25)], '#f2ead8'); g.line(11, 22, 22, 11, '#d8cdb4')

@item('prettyFeather')
def _(g):
    g.poly([(6, 27), (9, 17), (15, 9), (24, 4), (27, 8), (22, 17), (13, 24)], '#eef4ff'); g.line(5, 28, 24, 6, '#8fb3e0')
    for k in range(4): g.line(10 + k * 3, 20 - k * 3, 14 + k * 3, 22 - k * 3, '#c9dcf5')

def relic_coin(g, face, rim, mark):
    g.circ(16, 16, 13, face); g.vol(16, 16, 13, .2); g.ring(16, 16, 10.5, 9.5, rim); mark(g)
    shine(g, [(8, 9), (9, 8)])

@item('relicCopper')
def _(g): relic_coin(g, '#d9843a', '#a35a20', lambda g: g.rect(13, 11, 6, 10, '#a35a20', True))

@item('relicSilver')
def _(g): relic_coin(g, '#c9cbd8', '#7d8096', lambda g: (g.circ(16, 16, 4, '#7d8096', True), g.circ(16, 16, 2, '#dfe3ee', True)))

@item('relicGold')
def _(g): relic_coin(g, GOLD, GOLD_D, lambda g: g.star(16, 16.5, 6, 2.6, GOLD_D, flat=True))

@item('relicVase')
def _(g):
    g.poly([(11, 4), (21, 4), (20, 8), (25, 15), (23, 25), (19, 28), (13, 28), (9, 25), (7, 15), (12, 8)], '#4a8ff0')
    g.rect(8, 15, 16, 2, GOLD, True); g.rect(9, 22, 14, 2, GOLD, True); g.vol(16, 18, 12, .14); shine(g, [(10, 13), (10, 14)])

@item('relicBand')
def _(g):
    g.ring(16, 17, 12, 8.5, GOLD, False); g.vol(16, 17, 12, .16)
    for a in (210, 270, 330): r = math.radians(a); g.circ(16 + 10.2 * math.cos(r), 17 + 10.2 * math.sin(r), 2, '#e8383d', True)

@item('relicStatue')
def _(g):
    g.rrect(8, 25, 16, 5, 1, '#9a8a6a'); g.rect(12, 14, 8, 11, '#c9b48a'); g.circ(16, 10, 5, '#c9b48a')
    g.poly([(11, 7), (13, 2), (15, 6)], '#c9b48a'); g.poly([(21, 7), (19, 2), (17, 6)], '#c9b48a')
    g.dots([(14, 10), (18, 10)], NAVY); shine(g, [(12, 8), (13, 16)])

@item('relicCrown')
def _(g):
    g.poly([(4, 24), (5, 9), (11, 16), (16, 6), (21, 16), (27, 9), (28, 24)], GOLD); g.rect(4, 22, 25, 5, GOLD_D)
    for x, c in ((9, '#e8383d'), (16, '#4a8ff0'), (23, '#5fbf5a')): g.circ(x, 24.5, 1.8, c, True)
    g.dots([(5, 9), (16, 6), (27, 9)], GOLD_L)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, '..', 'Pokemon_Style_UI_Icons_v2')
    for path, f in D.items():
        g = G(); f(g); save_png(os.path.join(out, path), render(g))
    print(f'wrote {len(D)} icons to {os.path.normpath(out)}')
    items = os.path.join(here, '..', 'assets', 'items')
    for key, f in ITEM.items():
        g = G(); f(g); save_png(os.path.join(items, key + '.png'), render(g))
    print(f'wrote {len(ITEM)} item icons to {os.path.normpath(items)}')


if __name__ == '__main__':
    main()
