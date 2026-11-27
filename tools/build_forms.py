#!/usr/bin/env python3
"""Add regional forms (Alolan, Galarian, Hisuian, Paldean) to species.json as their own Pokémon.

A form is added when its sprites exist in Pokemon-Sprites/NNNN_Name/sprite/<Region>/. It gets:
  id    PokéAPI's Pokémon id for the form (e.g. Alolan Vulpix = 10103)
  of    the Pokédex number it shares with the regular form (37)
  sub   the local sprite sub-folder ("Alola")
  fr    the SpriteCollab form folder ("0001"), so sprites also load online
  name, el (type), base [ATK, DEF, SPD] and tier (copied from the regular form)
Evolutions (next / evo) are filled in by tools/build_evolutions.py; run that afterwards.

    python3 tools/build_forms.py
Needs internet once, for SpriteCollab's tracker.json (it says which folder number each form uses).
"""
import csv, json, os, re, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
API = os.path.join(HERE, 'pokeapi')
SPRITES = os.path.join(ROOT, 'Pokemon-Sprites')
SPECIES_JSON = os.path.join(ROOT, 'species.json')
TRACKER_URL = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/tracker.json'
CACHE = os.path.join(HERE, '.cache')

# local sub-folder -> (PokéAPI form suffix, name prefix, name suffix)
REGIONS = {
    'Alola': ('alola', 'Alolan ', ''),
    'Galar': ('galar', 'Galarian ', ''),
    'Hisui': ('hisui', 'Hisuian ', ''),
    'Paldea': ('paldea', 'Paldean ', ''),
    'Paldea_Blaze': ('paldea-blaze-breed', 'Paldean ', ' (Blaze)'),
    'Paldea_Aqua': ('paldea-aqua-breed', 'Paldean ', ' (Aqua)'),
}
# PokéAPI names a few regional forms differently from "<species>-<region>"
SPECIAL = {('darmanitan', 'galar'): 'darmanitan-galar-standard', ('tauros', 'paldea'): 'tauros-paldea-combat-breed'}


def rows(name):
    return list(csv.DictReader(open(os.path.join(API, name), encoding='utf-8')))


def tracker():
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, 'tracker.json')
    if not os.path.exists(path):
        print('downloading SpriteCollab tracker.json …')
        urllib.request.urlretrieve(TRACKER_URL, path)
    return json.load(open(path, encoding='utf-8'))


def main():
    species = json.load(open(SPECIES_JSON, encoding='utf-8'))
    by_id = {s['id']: s for s in species}
    sp_ident = {int(r['id']): r['identifier'] for r in rows('pokemon_species.csv')}
    poke = {r['identifier']: int(r['id']) for r in rows('pokemon.csv')}
    types = {r['id']: r['identifier'] for r in rows('types.csv')}
    ptype = {}
    for r in rows('pokemon_types.csv'):
        if r['slot'] == '1': ptype[int(r['pokemon_id'])] = types[r['type_id']]
    ptype2 = {int(r['pokemon_id']): types[r['type_id']] for r in rows('pokemon_types.csv') if r['slot'] == '2'}
    stats = {}
    for r in rows('pokemon_stats.csv'):
        stats.setdefault(int(r['pokemon_id']), {})[r['stat_id']] = int(r['base_stat'])
    track = tracker()

    added, kept = [], 0
    for d in sorted(os.listdir(SPRITES)) if os.path.isdir(SPRITES) else []:
        m = re.match(r'^(\d+)_', d)
        if not m: continue
        num = int(m.group(1))
        base = by_id.get(num)
        if not base: continue
        for sub, (suffix, pre, post) in REGIONS.items():
            sdir = os.path.join(SPRITES, d, 'sprite', sub)
            if not os.path.exists(os.path.join(sdir, 'AnimData.xml')): continue
            ident = SPECIAL.get((sp_ident.get(num), suffix), f'{sp_ident.get(num)}-{suffix}')
            pid = poke.get(ident)
            if not pid:
                print(f'  skipped {d}/{sub}: no PokéAPI Pokémon "{ident}"'); continue
            groups = track.get(f'{num:04d}', {}).get('subgroups', {})
            fr = next((k for k, g in groups.items() if g.get('name') == sub), None)
            if not fr:
                print(f'  skipped {d}/{sub}: not in SpriteCollab tracker'); continue
            st = stats.get(pid, {})
            entry = {
                'id': pid, 'name': pre + base['name'] + post, 'el': ptype.get(pid, base['el']),
                'next': [], 'evo': 0, 'tier': base.get('tier', 'common'), 'starter': False,
                'base': [st.get('2', base['base'][0]), st.get('3', base['base'][1]), st.get('6', base['base'][2])],
                'of': num, 'sub': sub, 'fr': fr,
            }
            if ptype2.get(pid) and ptype2[pid] != entry['el']: entry['el2'] = ptype2[pid]
            old = by_id.get(pid)
            if old:   # keep what the dashboard may have changed (tier, starter, stats, evolutions)
                for k in ('tier', 'starter', 'base', 'next', 'evo', 'name', 'el'): entry[k] = old.get(k, entry[k])
                kept += 1
            else:
                added.append(entry['name'])
            by_id[pid] = entry
    out = sorted(by_id.values(), key=lambda s: s['id'])
    json.dump(out, open(SPECIES_JSON, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(f'{len(added)} forms added, {kept} already there -> species.json')
    if added: print('  ' + ', '.join(added))


if __name__ == '__main__':
    main()
