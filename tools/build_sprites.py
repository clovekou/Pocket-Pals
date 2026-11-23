#!/usr/bin/env python3
"""Scan Pokemon-Sprites/NNNN_Name/ (PMD SpriteCollab layout) and write sprites.js,
a compact index of what each Pokémon has. Only AnimData.xml and PNG headers are
read, so it stays fast even for 1000+ Pokémon. (Where the feet are in each
sprite is measured by the browser when the image loads.)

SPRITE_DATA[id] = {
  n: name, f: folder, v: version (for cache-busting),
  sub: form sub-folder ("Alola") and r: SpriteCollab path ("0037/0001") for regional forms (see build_forms.py),
  a: { Anim: [frameW, frameH, frames, rows, [durations], fileIfDifferent?] },   normal sprites
  s: { ... } | 0,                                                               shiny sprites
  p: bitmask of portrait emotions (EMOTIONS order), ps: same for shiny portraits
}

Usage:  python3 tools/build_sprites.py      (run from anywhere)
"""
import json, os, re, struct
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'Pokemon-Sprites')
OUT = os.path.join(ROOT, 'sprites.js')
SPECIES_JSON = os.path.join(ROOT, 'species.json')
SPECIES_JS = os.path.join(ROOT, 'species.js')
# animations the game uses (missing ones fall back at runtime)
WANT = ['Idle', 'Walk', 'Sleep', 'Hop', 'Attack', 'Eat', 'Charge', 'Hurt', 'Nod', 'Pose']
EMOTIONS = ['Normal', 'Happy', 'Pain', 'Angry', 'Worried', 'Sad', 'Crying', 'Shouting', 'Teary-Eyed',
            'Determined', 'Joyous', 'Inspired', 'Surprised', 'Dizzy', 'Special0', 'Special1', 'Sigh',
            'Stunned', 'Special2', 'Special3']


def png_size(path):
    with open(path, 'rb') as f:
        head = f.read(24)
    if head[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('not a PNG: ' + path)
    return struct.unpack('>II', head[16:24])


def parse_animdata(sprite_dir):
    root = ET.parse(os.path.join(sprite_dir, 'AnimData.xml')).getroot()
    anims = {}
    for a in root.iter('Anim'):
        name = a.findtext('Name')
        copy = a.findtext('CopyOf')
        if copy:
            anims[name] = {'copy': copy}
        else:
            anims[name] = {'fw': int(a.findtext('FrameWidth')), 'fh': int(a.findtext('FrameHeight')),
                           'dur': [int(d.text) for d in a.iter('Duration')]}
    for name, v in list(anims.items()):
        if 'copy' in v and v['copy'] in anims and 'copy' not in anims[v['copy']]:
            anims[name] = dict(anims[v['copy']], file=v['copy'])
    return anims


def build_variant(sprite_dir):
    anims = parse_animdata(sprite_dir)
    out = {}
    for name in WANT:
        meta = anims.get(name)
        if not meta or 'copy' in meta:
            continue
        file = meta.get('file', name)
        path = os.path.join(sprite_dir, file + '-Anim.png')
        if not os.path.exists(path):
            continue
        w, h = png_size(path)
        fw, fh = meta['fw'], meta['fh']
        if fw <= 0 or fh <= 0 or w < fw or h < fh:
            continue
        cols = w // fw
        entry = [fw, fh, min(cols, len(meta['dur'])) or 1, h // fh, meta['dur'][:cols] or [10]]
        if file != name:
            entry.append(file)
        out[name] = entry
    return out


def face_mask(pdir):
    if not os.path.isdir(pdir):
        return 0
    have = {os.path.splitext(f)[0] for f in os.listdir(pdir) if f.lower().endswith('.png')}
    return sum(1 << i for i, e in enumerate(EMOTIONS) if e in have)


def folder_version(d):
    """Newest modification time among the folders the game reads (cheap cache-buster)."""
    newest = 0
    for sub in ('sprite', 'sprite/0000/Shiny', 'portrait', 'portrait/0000/Shiny'):
        try:
            newest = max(newest, int(os.path.getmtime(os.path.join(SRC, d, *sub.split('/')))))
        except OSError:
            pass
    return newest


def build_one(d):
    m = re.match(r'^(\d+)_(.+)$', d)
    sdir = os.path.join(SRC, d, 'sprite')
    if not m or not os.path.exists(os.path.join(sdir, 'AnimData.xml')):
        return None, None
    num, name = int(m.group(1)), m.group(2).replace('_', ' ').strip()
    entry = {'n': name, 'f': d, 'v': folder_version(d), 'a': build_variant(sdir), 's': 0}
    if 'Idle' not in entry['a']:
        raise ValueError('no Idle animation')
    shiny = os.path.join(sdir, '0000', 'Shiny')
    if os.path.exists(os.path.join(shiny, 'AnimData.xml')):
        try:
            s = build_variant(shiny)
            if 'Idle' in s:
                entry['s'] = s
        except Exception:
            pass
    entry['p'] = face_mask(os.path.join(SRC, d, 'portrait'))
    entry['ps'] = face_mask(os.path.join(SRC, d, 'portrait', '0000', 'Shiny'))
    return num, entry


def build_form(sp):
    """a regional form listed in species.json (id, of, sub, fr): its sprites live in <folder>/sprite/<sub>/"""
    folder = next((d for d in os.listdir(SRC) if re.match(rf'^0*{sp["of"]}_', d)), None)
    if not folder: return None
    sdir = os.path.join(SRC, folder, 'sprite', sp['sub'])
    if not os.path.exists(os.path.join(sdir, 'AnimData.xml')): return None
    entry = {'n': sp['name'], 'f': folder, 'sub': sp['sub'], 'r': f'{sp["of"]:04d}/{sp["fr"]}', 'a': build_variant(sdir), 's': 0}
    if 'Idle' not in entry['a']: return None
    newest = 0
    for sub in (sdir, os.path.join(sdir, 'Shiny'), os.path.join(SRC, folder, 'portrait', sp['sub'])):
        try: newest = max(newest, int(os.path.getmtime(sub)))
        except OSError: pass
    entry['v'] = newest
    shiny = os.path.join(sdir, 'Shiny')
    if os.path.exists(os.path.join(shiny, 'AnimData.xml')):
        try:
            sv = build_variant(shiny)
            if 'Idle' in sv: entry['s'] = sv
        except Exception:
            pass
    entry['p'] = face_mask(os.path.join(SRC, folder, 'portrait', sp['sub']))
    entry['ps'] = face_mask(os.path.join(SRC, folder, 'portrait', sp['sub'], 'Shiny'))
    return entry


def build(verbose=True):
    """Rebuild sprites.js from Pokemon-Sprites/. Returns {id: entry}."""
    result, skipped = {}, []
    if os.path.isdir(SRC):
        for d in sorted(os.listdir(SRC)):
            if d.startswith('.'):
                continue
            try:
                num, entry = build_one(d)
            except Exception as e:  # one broken folder must not break the whole game
                skipped.append(f'{d} ({e})')
                continue
            if num is None:
                if os.path.isdir(os.path.join(SRC, d)):
                    skipped.append(f'{d} (no sprite/AnimData.xml)')
                continue
            if num in result:
                skipped.append(f'{d} (duplicate #{num})')
                continue
            result[num] = entry
        for sp in load_species():            # regional forms (tools/build_forms.py)
            if not sp.get('sub'): continue
            try:
                e = build_form(sp)
            except Exception as ex:
                skipped.append(f'{sp["name"]} ({ex})'); continue
            if e: result[sp['id']] = e
            else: skipped.append(f'{sp["name"]} (no sprites)')
    tmp = OUT + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write('// GENERATED by tools/build_sprites.py — do not edit by hand.\n')
        f.write('const EMOTIONS = ' + json.dumps(EMOTIONS) + ';\n')
        f.write('const SPRITE_DATA = {\n')
        for k in sorted(result):
            f.write(f'{k}:' + json.dumps(result[k], separators=(',', ':'), ensure_ascii=False) + ',\n')
        f.write('};\n')
    os.replace(tmp, OUT)
    if verbose:
        print(f'{len(result)} Pokémon with sprites -> {os.path.relpath(OUT, ROOT)}')
        for s in skipped:
            print('  skipped', s)
    return result


def read_index():
    """Read the current sprites.js back (cheaper than a rebuild)."""
    try:
        s = open(OUT, encoding='utf-8').read()
        body = s[s.index('const SPRITE_DATA = {') + len('const SPRITE_DATA = '):s.rindex('};') + 1]
        body = re.sub(r'^(\d+):', r'"\1":', body, flags=re.M).replace(',\n}', '\n}')
        return {int(k): v for k, v in json.loads(body).items()}
    except (OSError, ValueError):
        return build(verbose=False)


def load_species():
    try:
        with open(SPECIES_JSON, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return []


def write_species(species):
    """Save species.json (the editable source) and species.js (what the game loads)."""
    species = sorted(species, key=lambda s: s['id'])
    with open(SPECIES_JSON, 'w', encoding='utf-8') as f:
        json.dump(species, f, indent=1, ensure_ascii=False)
    with open(SPECIES_JS, 'w', encoding='utf-8') as f:
        f.write('// GENERATED from species.json by the dashboard / tools.\n')
        f.write('const SPECIES_CONFIG = [\n')
        for s in species:
            f.write(json.dumps(s, separators=(',', ':'), ensure_ascii=False) + ',\n')
        f.write('];\n')


def main():
    build()
    write_species(load_species())
    print('wrote species.js')


if __name__ == '__main__':
    main()
