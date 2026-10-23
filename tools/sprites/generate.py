"""Generates the pet sprite sheets in assets/sprites/.

Every pet is drawn from simple shapes (ellipses, polygons, thick lines) on a
32x32 grid, then finished the same way: a dark outline around the shape and a
highlight along its top edge. Animation frames are the same pet with a
different pose, so every frame of every pet has the same style.

Sheets are one row of 32x32 frames, in the order of FRAMES below, which
assets/js/engine.js mirrors. The art is original and GPL-2.0-or-later like the
plugin. Wapuu is the WordPress mascot by Kazuko Kaneuchi, GPL-2.0-or-later;
this is a new pixel drawing of the character.

Usage: python3 tools/sprites/generate.py [--preview preview.png]
"""
import argparse
import math
import os
import struct
import zlib

SIZE = 32
GROUND = 30  # Last row a foot may use; the outline takes row 31.

FRAMES = [
    'idle0', 'idle1',
    'walk0', 'walk1', 'walk2', 'walk3',
    'run0', 'run1', 'run2', 'run3',
    'sit0', 'sit1',
    'sleep0', 'sleep1',
    'jump', 'fall',
]

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# Drawing ------------------------------------------------------------------

class Canvas:
    def __init__(self):
        self.px = [[None] * SIZE for _ in range(SIZE)]

    def put(self, x, y, c):
        if 0 <= x < SIZE and 0 <= y < SIZE:
            self.px[int(y)][int(x)] = c

    def ellipse(self, cx, cy, rx, ry, c):
        for y in range(SIZE):
            for x in range(SIZE):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1:
                    self.px[y][x] = c

    def poly(self, pts, c):
        for y in range(SIZE):
            for x in range(SIZE):
                px, py, inside = x + .5, y + .5, False
                j = len(pts) - 1
                for i in range(len(pts)):
                    xi, yi = pts[i]
                    xj, yj = pts[j]
                    if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi:
                        inside = not inside
                    j = i
                if inside:
                    self.px[y][x] = c

    def line(self, pts, r, c):
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 4) + 1
            for s in range(steps + 1):
                t = s / steps
                self.ellipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, c)

    def rect(self, x0, y0, x1, y1, c):
        for y in range(int(y0), int(y1)):
            for x in range(int(x0), int(x1)):
                self.put(x, y, c)

    def finish(self, outline, highlights):
        """Outline every empty pixel touching the pet; light the top edge of the given colours."""
        src = self.px
        out = [row[:] for row in src]
        for y in range(SIZE):
            for x in range(SIZE):
                if src[y][x] is None:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < SIZE and 0 <= ny < SIZE and src[ny][nx] not in (None, 'K'):
                            out[y][x] = 'K'
                            break
        for y in range(1, SIZE):
            for x in range(SIZE):
                if src[y][x] in highlights and src[y - 1][x] is None:
                    out[y][x] = highlights[src[y][x]]
        self.px = out
        self.outline = outline
        return self


# Pets ---------------------------------------------------------------------

def leg(c, hip_x, hip_y, foot_x, foot_y, color, w=1.0):
    c.line([(hip_x, hip_y), (foot_x, foot_y)], w, color)


def quadruped(frame, p):
    """Cat, dog and fox: body, head, ears, snout, tail and four legs."""
    c = Canvas()
    body, belly = p['body'], p['belly']
    bob = {'walk1': -1, 'walk3': -1, 'run1': -2, 'run3': -2, 'jump': -3, 'fall': -2}.get(frame, 0)
    tail_up = {'idle1': 1, 'walk1': 1, 'walk3': -1, 'run0': 2, 'run2': 2}.get(frame, 0)

    if frame.startswith('sleep'):
        breathe = .4 if frame == 'sleep1' else 0
        c.ellipse(15, 25.5 - breathe, 11, 5 + breathe, body)
        p['sleep_tail'](c)
        c.ellipse(23.5, 24, 5.5, 4.5, body)
        p['ears'](c, 23.5, 24.5, sleeping=True)
        p['snout'](c, 23.5, 24.5, sleeping=True)
        c.put(23, 24, 'E')
        c.put(24, 24, 'E')
        if p.get('stripes'):
            for x in (11, 14, 17):
                c.put(x, 21, p['stripes'])
                c.put(x, 22, p['stripes'])
        return c

    if frame.startswith('sit'):
        p['sit_tail'](c)
        c.ellipse(15, 22.5, 6.5, 7, body)
        c.ellipse(16.8, 25, 3.6, 4, belly)
        leg(c, 18, 25, 18, GROUND - .5, body, 1)
        leg(c, 21, 25, 21, GROUND - .5, body, 1)
        c.ellipse(11.5, 27.5, 4.5, 2.6, body)
        hx, hy = 18.5, 14.5
    else:
        y0 = 22 + bob
        legs = {
            'idle0': (0, 0, 0, 0), 'idle1': (0, 0, 0, 0),
            'walk0': (2, -2, -2, 2), 'walk1': (0, 0, 0, 0), 'walk2': (-2, 2, 2, -2), 'walk3': (0, 0, 0, 0),
            'run0': (-4, -3, 4, 3), 'run1': (3, 4, -3, -4), 'run2': (-4, -2, 4, 2), 'run3': (3, 3, -3, -3),
            'jump': (-5, -4, 5, 4), 'fall': (-1, 1, 1, -1),
        }[frame]
        hips = (8.5, 11.5, 19.5, 22.5)
        for hip, dx in zip(hips, legs):
            lift = 1.5 if (frame.startswith('walk') and dx > 0) or frame.startswith('run') else 0
            foot_y = GROUND - .5 - lift if frame not in ('jump', 'fall') else y0 + 6
            leg(c, hip, y0 + 2, hip + dx, foot_y, body, 1)
        p['tail'](c, 6, y0 - 1, tail_up)
        c.ellipse(15.5, y0, 9.5, 4.8, body)
        c.ellipse(15.5, y0 + 2.6, 6.5, 2, belly)
        if p.get('stripes'):
            for x in (11, 14, 17):
                c.put(x, int(y0 - 4), p['stripes'])
                c.put(x, int(y0 - 3), p['stripes'])
        hx, hy = 24.5, y0 - 5.5

    c.ellipse(hx, hy, 5.4, 4.8, body)
    p['ears'](c, hx, hy)
    p['snout'](c, hx, hy)
    if p.get('mask'):
        p['mask'](c, hx, hy)
    eye_x, eye_y = int(hx + 1.5), int(hy - .5)
    c.put(eye_x, eye_y, 'E')
    if frame not in ('idle1', 'sit1'):
        c.put(eye_x, eye_y - 1, 'E')
    return c


def cat(colors):
    body, light, stripes, belly = colors

    def ears(c, hx, hy, sleeping=False):
        if sleeping:
            c.poly([(hx - 4.4, hy - 2.2), (hx - 3, hy - 8), (hx - .6, hy - 3.4)], body)
            c.poly([(hx + .6, hy - 3.4), (hx + 3, hy - 8), (hx + 4.4, hy - 2.2)], body)
            c.poly([(hx - 3.5, hy - 3), (hx - 3, hy - 6.2), (hx - 1.7, hy - 3.4)], 'P')
            c.poly([(hx + 1.7, hy - 3.4), (hx + 3, hy - 6.2), (hx + 3.5, hy - 3)], 'P')
            return
        c.poly([(hx - 4.6, hy - 2.4), (hx - 3.1, hy - 8.4), (hx - .7, hy - 3.6)], body)
        c.poly([(hx + .7, hy - 3.6), (hx + 3.1, hy - 8.4), (hx + 4.6, hy - 2.4)], body)
        c.poly([(hx - 3.7, hy - 3.2), (hx - 3.1, hy - 6.6), (hx - 1.8, hy - 3.6)], 'P')
        c.poly([(hx + 1.8, hy - 3.6), (hx + 3.1, hy - 6.6), (hx + 3.7, hy - 3.2)], 'P')

    def snout(c, hx, hy, sleeping=False):
        c.ellipse(hx + 2.6, hy + 2.1, 2.6, 1.8, belly)
        if not sleeping:
            c.put(hx + 4.6, hy + 1, 'P')

    def tail(c, x, y, up):
        c.line([(x + 2, y + 1), (x - 1.5, y - 2), (x - 2.5, y - 6 - up), (x - 1, y - 9 - up)], 1.1, body)

    def sit_tail(c):
        c.line([(10, 27), (6, 28.5), (4, 26.5), (4.5, 23.5)], 1.1, body)

    def sleep_tail(c):
        c.line([(5, 26), (4, 28.5), (9, 29.5), (19, 29.5)], 1.1, body)

    return {
        'body': body, 'belly': belly, 'stripes': stripes, 'ears': ears, 'snout': snout,
        'tail': tail, 'sit_tail': sit_tail, 'sleep_tail': sleep_tail, 'light': light,
    }


def dog():
    body, belly = 'T', 'W'

    def ears(c, hx, hy, sleeping=False):
        c.poly([(hx - 4.8, hy - 3.6), (hx - 1.6, hy - 4.6), (hx - 2.2, hy + 1.8), (hx - 4.6, hy + 2.6)], 'B')

    def snout(c, hx, hy, sleeping=False):
        c.ellipse(hx + 3.4, hy + 1.6, 3.4, 2.4, belly)
        if not sleeping:
            c.put(hx + 6, hy + .6, 'E')
            c.put(hx + 6, hy + 1.6, 'E')
            c.put(hx + 3, hy + 3.6, 'R')

    def tail(c, x, y, up):
        c.line([(x + 2, y), (x - 1, y - 3), (x - 1 + up * .5, y - 6 - up)], 1.2, body)

    def sit_tail(c):
        c.line([(10, 27), (6.5, 27.5), (5, 25.5)], 1.2, body)

    def sleep_tail(c):
        c.line([(5, 26), (4, 28.5), (8, 29.5)], 1.2, body)

    def mask(c, hx, hy):
        c.ellipse(hx - .5, hy - 1.5, 2.2, 2, 'B')

    return {
        'body': body, 'belly': belly, 'ears': ears, 'snout': snout, 'tail': tail,
        'sit_tail': sit_tail, 'sleep_tail': sleep_tail, 'mask': mask,
    }


def fox():
    body, belly = 'F', 'W'

    def ears(c, hx, hy, sleeping=False):
        tip = 6.5 if sleeping else 9.6
        c.poly([(hx - 5, hy - 2), (hx - 3.4, hy - tip), (hx - .6, hy - 3.6)], body)
        c.poly([(hx + .6, hy - 3.6), (hx + 3.4, hy - tip), (hx + 5, hy - 2)], body)
        if not sleeping:
            c.poly([(hx - 3.9, hy - 3.6), (hx - 3.4, hy - 7.4), (hx - 1.8, hy - 3.8)], 'E')
            c.poly([(hx + 1.8, hy - 3.8), (hx + 3.4, hy - 7.4), (hx + 3.9, hy - 3.6)], 'E')

    def snout(c, hx, hy, sleeping=False):
        c.poly([(hx + 1, hy + 3.6), (hx + 7, hy + 1.4), (hx + 1.5, hy - .2)], belly)
        c.ellipse(hx - 1.8, hy + 2.4, 2.4, 1.6, belly)
        if not sleeping:
            c.put(hx + 6.4, hy + 1, 'E')

    def tail(c, x, y, up):
        c.line([(x + 2, y + 1), (x - 1.5, y - 1 - up * .5), (x - 3.5, y - 3 - up)], 2.4, body)
        c.ellipse(x - 4, y - 3.6 - up, 1.8, 1.8, 'W')

    def sit_tail(c):
        c.line([(10, 27), (5.5, 28), (3.5, 26)], 2.2, body)
        c.ellipse(3.2, 25, 1.8, 1.8, 'W')

    def sleep_tail(c):
        c.line([(6, 25), (5, 28.5), (12, 29.5), (20, 28.5)], 2, body)
        c.ellipse(21, 28.2, 1.8, 1.6, 'W')

    return {
        'body': body, 'belly': belly, 'ears': ears, 'snout': snout, 'tail': tail,
        'sit_tail': sit_tail, 'sleep_tail': sleep_tail,
    }


def duck(frame):
    """Rubber duck: waddles instead of walking."""
    c = Canvas()
    waddle = {'walk0': -1, 'walk1': 0, 'walk2': 1, 'walk3': 0, 'run0': -1, 'run1': -2, 'run2': 1, 'run3': -2, 'jump': -4, 'fall': -2}.get(frame, 0)
    tilt = {'walk0': -1, 'walk2': 1, 'run0': -1, 'run2': 1}.get(frame, 0)
    sleeping, sitting = frame.startswith('sleep'), frame.startswith('sit')
    base = 25 + (2 if sitting or sleeping else 0) + min(0, waddle) * (0 if frame.startswith('walk') else 1)
    if not (sitting or sleeping):
        feet = {'walk0': (0, 1), 'walk2': (1, 0), 'run0': (0, 2), 'run2': (2, 0), 'run1': (1, 1), 'run3': (1, 1)}.get(frame, (0, 0))
        c.rect(12, GROUND - feet[0], 15, GROUND + 1 - feet[0], 'A')
        c.rect(17, GROUND - feet[1], 20, GROUND + 1 - feet[1], 'A')
    breathe = .4 if frame == 'sleep1' else 0
    c.ellipse(15.5, base, 9.5, 5.6 + breathe, 'Y')
    c.poly([(6.5, base - 2), (3.5, base - 5.5), (8.5, base - 4)], 'Y')
    c.ellipse(13.5, base + .5, 4.5, 2.6, 'G')
    hx = 20.5 + tilt
    hy = base - 8.5 if not sleeping else base - 5
    c.ellipse(hx, hy, 5, 4.7, 'Y')
    c.poly([(hx + 3.5, hy + .3), (hx + 8.5, hy + 1.5), (hx + 3.5, hy + 3)], 'A')
    if sleeping:
        c.put(hx + 1, hy - .5, 'E')
        c.put(hx + 2, hy - .5, 'E')
    else:
        c.put(hx + 1.5, hy - 1, 'E')
        if frame not in ('idle1', 'sit1'):
            c.put(hx + 1.5, hy - 2, 'E')
    c.put(hx - 1, hy + 1.5, 'C')
    return c


def wapuu(frame):
    """Wapuu: round and blue, with big ears and a short trunk."""
    c = Canvas()
    bob = {'walk1': -1, 'walk3': -1, 'run1': -2, 'run3': -2, 'jump': -4, 'fall': -2}.get(frame, 0)
    sleeping, sitting = frame.startswith('sleep'), frame.startswith('sit')
    if not (sitting or sleeping):
        step = {'walk0': (1, -1), 'walk2': (-1, 1), 'run0': (2, -2), 'run1': (-1, 1), 'run2': (-2, 2), 'run3': (1, -1), 'jump': (-2, 2)}.get(frame, (0, 0))
        for x0, dx in ((11, step[0]), (18, step[1])):
            lift = 1 if dx > 0 else 0
            c.rect(x0 + dx, 26 + bob, x0 + dx + 3, GROUND + 1 - lift, 'U')
    cy = (23.5 if not (sitting or sleeping) else 25) + bob + (2 if sleeping else 0)
    breathe = .4 if frame == 'sleep1' else 0
    ry = (6.8 if not sleeping else 5.2) + breathe
    c.ellipse(16, cy, 8.5, ry, 'U')
    c.ellipse(16.8, cy + 1.6, 4.6, ry - 2.6, 'W')
    c.line([(8, cy + 1), (5, cy - 1), (5, cy - 3)], .9, 'U')
    c.put(5, cy - 4, 'V')
    ear_y = cy - (4.5 if not sleeping else 2.5)
    c.ellipse(12, ear_y, 4.2, 4.6 if not sleeping else 3.2, 'V')
    c.ellipse(12, ear_y, 2.4, 2.8 if not sleeping else 1.8, 'P')
    hx, hy = 20.5, cy - 4.5 + (2 if sleeping else 0)
    c.ellipse(hx, hy, 5.2, 4.8, 'U')
    c.line([(hx + 4, hy + 1), (hx + 6.5, hy + 2), (hx + 7.5, hy + 4)], .9, 'U')
    c.ellipse(hx + 1.5, hy + 2.4, 1.3, .9, 'P')
    if sleeping:
        c.put(hx + 1, hy - .5, 'E')
        c.put(hx + 2, hy - .5, 'E')
    else:
        c.put(hx + 2, hy - 1, 'E')
        if frame not in ('idle1', 'sit1'):
            c.put(hx + 2, hy - 2, 'E')
    # The W on Wapuu's head.
    for x, y in ((hx - 3, hy - 3), (hx - 2.5, hy - 2), (hx - 2, hy - 3), (hx - 1.5, hy - 2), (hx - 1, hy - 3)):
        c.put(x, y, 'W')
    return c


# Pets, palettes and output ----------------------------------------------------

BASE = {
    'K': (46, 30, 26), 'E': (30, 26, 28), 'P': (240, 150, 170), 'W': (255, 246, 232), 'R': (226, 84, 96),
}
PETS = {
    'cat-orange': (lambda f: quadruped(f, cat(('O', 'L', 'D', 'W'))), {'O': (233, 146, 58), 'L': (247, 190, 115), 'D': (186, 101, 33)}, {'O': 'L'}),
    'cat-grey': (lambda f: quadruped(f, cat(('O', 'L', 'D', 'W'))), {'O': (140, 146, 160), 'L': (186, 192, 205), 'D': (96, 100, 114)}, {'O': 'L'}),
    'cat-black': (lambda f: quadruped(f, cat(('O', 'L', None, 'S'))), {'O': (52, 50, 62), 'L': (92, 90, 108), 'S': (210, 205, 215)}, {'O': 'L'}),
    'dog': (lambda f: quadruped(f, dog()), {'T': (205, 160, 104), 'L': (232, 196, 146), 'B': (122, 82, 50)}, {'T': 'L'}),
    'fox': (lambda f: quadruped(f, fox()), {'F': (226, 104, 40), 'L': (246, 150, 84)}, {'F': 'L'}),
    'duck': (duck, {'Y': (252, 208, 50), 'L': (255, 236, 130), 'G': (238, 182, 30), 'A': (246, 128, 36), 'C': (255, 160, 120)}, {'Y': 'L'}),
    'wapuu': (wapuu, {'U': (46, 134, 200), 'L': (110, 180, 232), 'V': (34, 106, 166)}, {'U': 'L'}),
}


def rgba_rows(frames, palette, scale):
    rows = []
    for y in range(SIZE * scale):
        row = bytearray([0])
        for f in frames:
            for x in range(SIZE * scale):
                key = f.px[y // scale][x // scale]
                color = palette.get(key) if key else None
                row += bytes(color + (255,)) if color else b'\0\0\0\0'
        rows.append(bytes(row))
    return rows


def write_png(path, rows, width, height):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xFFFFFFFF)

    with open(path, 'wb') as fh:
        fh.write(b'\x89PNG\r\n\x1a\n')
        fh.write(chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)))
        fh.write(chunk(b'IDAT', zlib.compress(b''.join(rows), 9)))
        fh.write(chunk(b'IEND', b''))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', help='also write every sheet, scaled up, into one image')
    args = parser.parse_args()

    out = os.path.join(ROOT, 'assets', 'sprites')
    os.makedirs(out, exist_ok=True)
    all_rows = []
    for name, (draw, colors, highlights) in PETS.items():
        palette = dict(BASE, **colors)
        frames = [draw(f).finish('K', highlights) for f in FRAMES]
        write_png(os.path.join(out, name + '.png'), rgba_rows(frames, palette, 1), SIZE * len(FRAMES), SIZE)
        all_rows.extend(rgba_rows(frames, palette, 4))
        print('wrote assets/sprites/%s.png' % name)

    if args.preview:
        write_png(args.preview, all_rows, SIZE * len(FRAMES) * 4, SIZE * 4 * len(PETS))


if __name__ == '__main__':
    main()
