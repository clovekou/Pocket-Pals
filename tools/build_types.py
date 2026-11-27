#!/usr/bin/env python3
"""Give every species its real types (one or two) from the PokeAPI tables in tools/pokeapi/.

  python3 tools/build_types.py      # sets el (first type) and el2 (second type, if it has one)

Run it again after adding Pokémon (import_dex.py / build_forms.py already fill el2 for new ones).
"""
import csv, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_sprites as B  # noqa: E402

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pokeapi')
GAME_TYPES = {'normal', 'grass', 'fire', 'water', 'electric', 'ice', 'fighting', 'poison', 'ground',
              'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'}


def types_by_pokemon():
    with open(os.path.join(DATA, 'types.csv'), encoding='utf-8') as f:
        names = {r['id']: r['identifier'] for r in csv.DictReader(f)}
    out = {}
    with open(os.path.join(DATA, 'pokemon_types.csv'), encoding='utf-8') as f:
        for r in csv.DictReader(f):
            out.setdefault(int(r['pokemon_id']), {})[int(r['slot'])] = names.get(r['type_id'])
    return out


def main():
    pt = types_by_pokemon()
    species = B.load_species()
    changed = dual = missing = 0
    for s in species:
        t = pt.get(int(s['id']))
        if not t:
            missing += 1; continue
        t1, t2 = t.get(1), t.get(2)
        if t1 in GAME_TYPES and s.get('el') != t1:
            s['el'] = t1; changed += 1
        if t2 in GAME_TYPES and t2 != s['el']:
            if s.get('el2') != t2: changed += 1
            s['el2'] = t2; dual += 1
        elif 'el2' in s:
            del s['el2']; changed += 1
    B.write_species(species)
    print(f'{len(species)} species · {dual} with two types · {changed} changes · {missing} not in the PokeAPI data')


if __name__ == '__main__':
    main()
