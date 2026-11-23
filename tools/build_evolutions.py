#!/usr/bin/env python3
"""Build evodata.js: how every Pokémon in the game evolves, following the main games (PokéAPI data,
the same data pokemondb.net/evolution shows), including regional forms.

Each step is one of
    {to, lv}            level up (real levels from the games)
    {to, item}          an evolution item (used, or held + level up: see items.js `how`)
    {to, bond}          friendship: level up with a bond of at least `bond` (0-100)
plus an optional time of day ('morning' | 'afternoon' | 'night' | 'day').

Methods the game doesn't have are turned into something close:
  trading            -> Linking Cord (held-item trades -> hold that item and level up)
  know a move, walk 1000 steps, 3 critical hits, coins… -> level up at a fitting level (FALLBACK_LV)
  "level up at a special place" (Magnezone, Leafeon…) -> left out: those Pokémon also evolve with a stone
It also updates species.json (next / evo), so the Pokédex lines match.

    python3 tools/build_forms.py        # first, if new regional-form sprites were added
    python3 tools/build_evolutions.py
"""
import csv, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
API = os.path.join(HERE, 'pokeapi')
sys.path.insert(0, HERE)

# PokéAPI item id -> game item key (items.js)
ITEM_IDS = {
    82: 'fireStone', 84: 'waterStone', 83: 'thunderStone', 85: 'leafStone', 81: 'moonStone', 80: 'sunStone',
    107: 'shinyStone', 108: 'duskStone', 109: 'dawnStone', 885: 'iceStone', 2160: 'linkingCord',
    1174: 'sweetApple', 1175: 'tartApple', 2109: 'syrupyApple', 1311: 'crackedPot', 1312: 'crackedPot',
    2110: 'unremarkableTeacup', 2111: 'unremarkableTeacup', 2230: 'blackAugurite', 2231: 'peatBlock',
    2232: 'metalAlloy', 2045: 'auspiciousArmor', 1677: 'maliciousArmor',
    1633: 'galaricaCuff', 1643: 'galaricaWreath', 1675: 'scrollOfDarkness', 1676: 'scrollOfWaters',
    198: 'kingsRock', 210: 'metalCoat', 212: 'dragonScale', 229: 'upgrade', 301: 'dubiousDisc', 298: 'protector',
    299: 'electirizer', 300: 'magmarizer', 302: 'reaperCloth', 303: 'razorClaw', 304: 'razorFang', 110: 'ovalStone',
    203: 'deepSeaTooth', 204: 'deepSeaScale', 580: 'prismScale', 687: 'sachet', 686: 'whippedDream',
}
# level used when the games use a method this game doesn't have (keyed by the Pokémon it evolves into)
FALLBACK_LV = {
    'mr-mime': 18, 'sudowoodo': 17, 'mantine': 25, 'shedinja': 20, 'ambipom': 32, 'lickilicky': 33, 'tangrowth': 33,
    'yanmega': 33, 'mamoswine': 34, 'tsareena': 29, 'naganadel': 40, 'grapploct': 35, 'sirfetchd': 30,
    'runerigus': 34, 'wyrdeer': 31, 'basculegion': 36, 'overqwil': 28, 'pawmot': 30, 'brambleghast': 30, 'rabsca': 30,
    'annihilape': 35, 'farigiraf': 32, 'dudunsparce': 32, 'kingambit': 52, 'gholdengo': 40, 'hydrapple': 40,
    'melmetal': 40, 'alcremie': 30,
}
DEFAULT_LV = 30
FRIENDSHIP_BOND = 70          # games: 160-220 friendship out of 255
TIMES = {'day': 'day', 'night': 'night', 'dusk': 'afternoon', 'full-moon': ''}
REGIONAL = ('alola', 'galar', 'hisui', 'paldea')


def rows(name):
    return list(csv.DictReader(open(os.path.join(API, name), encoding='utf-8')))


def main():
    species = json.load(open(os.path.join(ROOT, 'species.json'), encoding='utf-8'))
    roster = {s['id'] for s in species}
    sp_ident = {int(r['id']): r['identifier'] for r in rows('pokemon_species.csv')}
    pre = {int(r['id']): int(r['evolves_from_species_id']) for r in rows('pokemon_species.csv') if r['evolves_from_species_id']}
    forms = {r['id']: r for r in rows('pokemon_forms.csv')}
    regional = lambda f: any(x in f['form_identifier'] for x in REGIONAL)

    def form_pokemon(form_id, fallback):
        """the game's id for a PokéAPI form: the regional form's own id, or the regular Pokémon for looks-only forms"""
        if not form_id: return fallback
        f = forms.get(form_id)
        if not f: return fallback
        pid = int(f['pokemon_id'])
        if pid in roster: return pid
        return None if regional(f) else fallback

    data = {}
    def add(fr, step):
        lst = data.setdefault(fr, [])
        key = lambda s: (s['to'], s.get('item'), s.get('lv') if 'lv' in s else None, 'bond' in s, s.get('time', ''))
        if any(key(s) == key(step) for s in lst): return
        # the same item listed as both "use" and "hold" (different games): keep one
        if 'item' in step and any(s['to'] == step['to'] and s.get('item') == step['item'] and s.get('time', '') == step.get('time', '') for s in lst): return
        lst.append(step)

    skipped = 0
    for r in rows('pokemon_evolution.csv'):
        trig = r['evolution_trigger_id']
        to_sp = int(r['evolved_species_id']); fr_sp = pre.get(to_sp)
        if not fr_sp: continue
        fr = form_pokemon(r['required_pokemon_form_id'], fr_sp)
        to = form_pokemon(r['evolved_pokemon_form_id'], to_sp)
        if fr is None or to is None or fr not in roster or to not in roster: skipped += 1; continue
        time = TIMES.get(r['time_of_day'], '')
        item = r['trigger_item_id'] or r['held_item_id']
        if trig in ('5', '6', '7'):                     # Alcremie's spin (items not in this game), Kubfu's towers (scrolls below)
            if trig == '5': add(fr, {'to': to, 'lv': FALLBACK_LV['alcremie'], 'time': ''})
            continue
        if item:
            key = ITEM_IDS.get(int(item))
            if not key: skipped += 1; continue
            add(fr, {'to': to, 'item': key, 'time': time}); continue
        if trig == '2':                                 # trade without an item -> Linking Cord
            add(fr, {'to': to, 'item': 'linkingCord', 'time': ''}); continue
        if r['minimum_happiness'] or r['minimum_affection']:
            step = {'to': to, 'bond': FRIENDSHIP_BOND, 'time': time}
            add(fr, step); continue
        if r['minimum_level']:
            add(fr, {'to': to, 'lv': int(r['minimum_level']), 'time': time}); continue
        if r['location_id'] or r['minimum_beauty']: skipped += 1; continue   # these also evolve with an item
        lv = FALLBACK_LV.get(sp_ident.get(to_sp), DEFAULT_LV)
        add(fr, {'to': to, 'lv': lv, 'time': time})

    # tidy: drop empty times, sort branches
    for fr, lst in data.items():
        for s in lst:
            if not s.get('time'): s.pop('time', None)
        lst.sort(key=lambda s: (s['to'], s.get('item', ''), s.get('lv', 0)))

    # species.json: next / evo follow the data (the Pokédex "line" and stages come from these)
    for s in species:
        steps = data.get(s['id'], [])
        s['next'] = sorted({st['to'] for st in steps})
        lvs = [st['lv'] for st in steps if 'lv' in st]
        s['evo'] = min(lvs) if lvs else 0
    from build_sprites import write_species
    write_species(species)

    lines = ['// GENERATED by tools/build_evolutions.py from PokéAPI data (matches the main games / pokemondb.net/evolution).',
             '// EVO_DATA[from] = steps: { to, lv } level up · { to, item } evolution item · { to, bond } friendship (bond 0-100)',
             '// with an optional time: "morning" | "afternoon" | "night" | "day". Admin → Evolutions can override any Pokémon.',
             'const EVO_DATA = {']
    for fr in sorted(data):
        lines.append(f'  {fr}: {json.dumps(data[fr], separators=(",", ":"))},')
    lines.append('};')
    open(os.path.join(ROOT, 'evodata.js'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    n = sum(len(v) for v in data.values())
    print(f'wrote evodata.js: {len(data)} Pokémon evolve, {n} evolutions ({skipped} rows left out); updated species.json/.js')


if __name__ == '__main__':
    main()
