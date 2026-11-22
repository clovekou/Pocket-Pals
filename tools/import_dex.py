#!/usr/bin/env python3
"""Fill species.json for every Pokémon that has sprites, using the PokeAPI data
tables in tools/pokeapi/ (types, evolutions, base stats, legendary flags).

  python3 tools/import_dex.py            # add missing Pokémon, keep ones you edited
  python3 tools/import_dex.py --force    # overwrite everything with PokeAPI data

Evolutions that aren't by level are converted to a level, like the original
TamaPoke: stones / items ≈ 30, trade ≈ 40, friendship ≈ 22, anything else ≈ 30.
Each evolution is always at least 5 levels after the previous one.
"""
import csv, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_sprites as B  # noqa: E402

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pokeapi')
STARTERS = {1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656,
            722, 725, 728, 810, 813, 816, 906, 909, 912}
GAME_TYPES = {'normal', 'grass', 'fire', 'water', 'electric', 'ice', 'fighting', 'poison', 'ground',
              'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'}


def rows(name):
    with open(os.path.join(DATA, name + '.csv'), encoding='utf-8') as f:
        return list(csv.DictReader(f))


def is_placeholder(s):
    """An entry the dashboard created on upload and nobody has edited yet."""
    return s.get('el') == 'normal' and not s.get('next') and list(s.get('base', [])) == [50, 50, 50]


def main(force=False):
    sprites = B.read_index()
    species = {int(r['id']): r for r in rows('pokemon_species')}
    types = {r['id']: r['identifier'] for r in rows('types')}
    ptype = {}
    for r in rows('pokemon_types'):
        if r['slot'] == '1':
            ptype[int(r['pokemon_id'])] = types.get(r['type_id'], 'normal')
    stats = {}
    for r in rows('pokemon_stats'):
        stats.setdefault(int(r['pokemon_id']), {})[r['stat_id']] = int(r['base_stat'])
    # how each species is reached: lowest sensible level over its evolution methods
    reach = {}
    for r in rows('pokemon_evolution'):
        sid, trig = int(r['evolved_species_id']), r['evolution_trigger_id']
        if r['minimum_level']:
            lv = int(r['minimum_level'])
        elif trig == '2':
            lv = 40                      # trade
        elif trig == '3':
            lv = 30                      # stone / item
        elif r['minimum_happiness'] or r['minimum_affection']:
            lv = 22                      # friendship
        else:
            lv = 30
        reach[sid] = min(reach.get(sid, 999), lv)

    have = set(sprites)
    entries = {}
    for sid, r in species.items():
        if sid not in have:
            continue
        prev = int(r['evolves_from_species_id']) if r['evolves_from_species_id'] else None
        # skip over a missing middle stage so the line still works (A -> [B missing] -> C becomes A -> C)
        while prev is not None and prev not in have:
            p = species.get(prev)
            prev = int(p['evolves_from_species_id']) if p and p['evolves_from_species_id'] else None
        st = stats.get(sid, {})
        legend = r['is_legendary'] == '1' or r['is_mythical'] == '1'
        cap = int(r['capture_rate'] or 255)
        tier = 'legend' if legend else 'rare' if (cap <= 45 or sid in STARTERS) else 'common'
        el = ptype.get(sid, 'normal')
        entries[sid] = {
            'id': sid, 'name': sprites[sid]['n'], 'el': el if el in GAME_TYPES else 'normal',
            'next': [], 'evo': 0, 'tier': tier, 'starter': sid in STARTERS,
            'base': [st.get('2', 50), st.get('3', 50), st.get('6', 50)], '_prev': prev,
        }
    for sid, e in entries.items():
        if e['_prev'] is not None:
            parent = entries[e['_prev']]
            parent['next'].append(sid)
            lv = reach.get(sid, 30)
            parent['evo'] = lv if not parent['evo'] else min(parent['evo'], lv)
    # each stage at least 5 levels after the one before
    def fix(sid, floor):
        e = entries[sid]
        if e['next']:
            e['evo'] = max(e['evo'], floor + 5)
            for n in e['next']:
                fix(n, e['evo'])
    for sid, e in entries.items():
        if e['_prev'] is None:
            fix(sid, 0)
    for e in entries.values():
        e['next'].sort()
        del e['_prev']

    current = {s['id']: s for s in B.load_species()}
    kept = 0
    for sid, s in current.items():
        if sid in entries and not force and not is_placeholder(s):
            entries[sid] = s; kept += 1
        elif sid not in entries:
            entries[sid] = s; kept += 1   # something you added by hand that PokeAPI doesn't know
    # drop links to Pokémon that aren't in the game
    for e in entries.values():
        e['next'] = [n for n in e['next'] if n in entries]
        if not e['next']:
            e['evo'] = 0
    B.write_species(list(entries.values()))
    n = len(entries)
    lines = sum(1 for e in entries.values() if e['next'])
    print(f'species.json: {n} Pokémon ({kept} kept as you had them), {lines} that evolve, '
          f'{sum(1 for e in entries.values() if e["starter"])} starters, '
          f'{sum(1 for e in entries.values() if e["tier"] == "legend")} legendary/mythical')


if __name__ == '__main__':
    main(force='--force' in sys.argv)
