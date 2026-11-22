#!/usr/bin/env python3
"""Pocket Pal local server: serves the game and powers the sprite dashboard.

    python3 server.py            # then open http://localhost:8000
    python3 server.py 8080       # another port

Everything stays on this computer: uploads are written into Pokemon-Sprites/,
and species settings into species.json / species.js.
"""
import io, json, os, re, shutil, socket, sys, tempfile, time, uuid, zipfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import build_sprites as B  # noqa: E402

SPRITES = os.path.join(ROOT, 'Pokemon-Sprites')
STAGE = os.path.join(tempfile.gettempdir(), 'pocketpal-uploads')
ALLOWED = {'.png', '.xml', '.txt'}
ELEMENTS = ['normal', 'grass', 'fire', 'water', 'electric', 'ice', 'fighting', 'poison', 'ground',
            'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy']
TIERS = ['common', 'rare', 'legend']
MAX_UPLOAD = 60 * 1024 * 1024


class ApiError(Exception):
    pass


def safe_rel(path):
    """Clean a relative path from the browser; reject anything that escapes the folder."""
    parts = [p for p in path.replace('\\', '/').split('/') if p not in ('', '.')]
    if not parts or any(p == '..' or p.startswith('.') for p in parts) or parts[0] == '__MACOSX':
        return None
    return '/'.join(parts)


def find_layout(stage):
    """Locate the main/shiny sprite dirs and the main/shiny portrait dirs in an upload."""
    anims, portraits = [], []
    for dp, _, files in os.walk(stage):
        rel = os.path.relpath(dp, stage).replace('\\', '/')
        if 'AnimData.xml' in files:
            anims.append(rel)
        elif any(f.lower().endswith('.png') for f in files) and 'Normal.png' in files:
            portraits.append(rel)
    if not anims:
        raise ApiError("No AnimData.xml found — this doesn't look like a PMD SpriteCollab sprite folder.")
    alt = ('female', 'altcolor', 'alternate', 'mega', 'gigantamax')
    low = lambda r: r.lower()
    shortest = lambda xs: min(xs, key=lambda r: (r.count('/'), len(r))) if xs else None
    main = shortest([a for a in anims if 'shiny' not in low(a) and not any(k in low(a) for k in alt)] or anims)
    shiny = shortest([a for a in anims if 'shiny' in low(a) and not any(k in low(a) for k in alt)])
    portrait = shortest([p for p in portraits if 'shiny' not in low(p) and not any(k in low(p) for k in alt)])
    portrait_shiny = shortest([p for p in portraits if 'shiny' in low(p) and not any(k in low(p) for k in alt)])
    return main, shiny, portrait, portrait_shiny


def copy_files(src, dst):
    os.makedirs(dst, exist_ok=True)
    n = 0
    for f in os.listdir(src):
        p = os.path.join(src, f)
        if os.path.isfile(p) and os.path.splitext(f)[1].lower() in ALLOWED:
            shutil.copy2(p, os.path.join(dst, f)); n += 1
    return n


def folder_for(dex):
    if not os.path.isdir(SPRITES):
        return None
    for d in os.listdir(SPRITES):
        m = re.match(r'^(\d+)_', d)
        if m and int(m.group(1)) == dex:
            return d
    return None


def clean_name(name):
    name = re.sub(r'[\x00-\x1f<>"`\\/]', '', str(name)).strip()
    return name[:24]


def commit_upload(stage, dex, name):
    if not (1 <= dex <= 9999):
        raise ApiError('Dex number must be between 1 and 9999.')
    name = clean_name(name)
    if not name:
        raise ApiError('Please give the Pokémon a name.')
    main, shiny, portrait, portrait_shiny = find_layout(stage)
    if not os.path.exists(os.path.join(stage, main, 'Idle-Anim.png')):
        raise ApiError('The sprite folder has no Idle-Anim.png, which the game needs.')
    folder = f'{dex:04d}_' + name.replace(' ', '_')
    tmp_dest = os.path.join(SPRITES, '.incoming-' + uuid.uuid4().hex[:8])
    copy_files(os.path.join(stage, main), os.path.join(tmp_dest, 'sprite'))
    if shiny:
        copy_files(os.path.join(stage, shiny), os.path.join(tmp_dest, 'sprite', '0000', 'Shiny'))
    if portrait:
        copy_files(os.path.join(stage, portrait), os.path.join(tmp_dest, 'portrait'))
    if portrait_shiny:
        copy_files(os.path.join(stage, portrait_shiny), os.path.join(tmp_dest, 'portrait', '0000', 'Shiny'))
    # check it parses before replacing anything
    try:
        v = B.build_variant(os.path.join(tmp_dest, 'sprite'))
        if 'Idle' not in v:
            raise ApiError('Could not read the Idle animation.')
    except ApiError:
        shutil.rmtree(tmp_dest, ignore_errors=True); raise
    except Exception as e:
        shutil.rmtree(tmp_dest, ignore_errors=True)
        raise ApiError(f'Could not read these sprites: {e}')
    old = folder_for(dex)
    if old:
        shutil.rmtree(os.path.join(SPRITES, old), ignore_errors=True)
    os.rename(tmp_dest, os.path.join(SPRITES, folder))
    data = B.build(verbose=False)
    species = B.load_species()
    existing = next((s for s in species if s['id'] == dex), None)
    if existing:
        existing['name'] = name
    else:
        species.append({'id': dex, 'name': name, 'el': 'normal', 'next': [], 'evo': 0,
                        'tier': 'common', 'starter': False, 'base': [50, 50, 50]})
    B.write_species(species)
    return {'ok': True, 'id': dex, 'name': name, 'folder': folder,
            'anims': list(data.get(dex, {}).get('a', {}).keys()), 'shiny': bool(data.get(dex, {}).get('s')),
            'portraits': bin(data.get(dex, {}).get('p', 0)).count('1')}


def validate_species(species, sprite_ids):
    if not isinstance(species, list):
        raise ApiError('Bad data.')
    ids, out = set(), []
    for s in species:
        try:
            sid = int(s['id'])
        except (KeyError, TypeError, ValueError):
            raise ApiError('Every species needs a Dex number.')
        if sid in ids:
            raise ApiError(f'#{sid} appears twice.')
        ids.add(sid)
        name = clean_name(s.get('name', ''))
        if not name:
            raise ApiError(f'#{sid} needs a name.')
        el = s.get('el') if s.get('el') in ELEMENTS else 'normal'
        tier = s.get('tier') if s.get('tier') in TIERS else 'common'
        nxt = []
        for n in s.get('next') or []:
            n = int(n)
            if n == sid:
                raise ApiError(f'{name} cannot evolve into itself.')
            if n not in nxt:
                nxt.append(n)
        evo = int(s.get('evo') or 0)
        if nxt and not (2 <= evo <= 100):
            raise ApiError(f'{name}: evolution level must be between 2 and 100.')
        base = [max(1, min(255, int(x))) for x in (s.get('base') or [50, 50, 50])[:3]]
        while len(base) < 3:
            base.append(50)
        out.append({'id': sid, 'name': name, 'el': el, 'next': nxt, 'evo': evo if nxt else 0,
                    'tier': tier, 'starter': bool(s.get('starter')), 'base': base})
    by = {s['id']: s for s in out}
    prev = {}
    for s in out:
        if s['id'] not in sprite_ids:
            raise ApiError(f"{s['name']} (#{s['id']}) has no sprites uploaded.")
        for n in s['next']:
            if n not in by:
                raise ApiError(f"{s['name']} evolves into #{n}, which doesn't exist.")
            if n in prev:
                raise ApiError(f"{by[n]['name']} can only evolve from one Pokémon "
                               f"({by[prev[n]]['name']} and {s['name']} both point to it).")
            prev[n] = s['id']
    for s in out:  # cycle check
        seen, cur = set(), s['id']
        while cur in prev:
            if cur in seen:
                raise ApiError(f"Evolution loop involving {s['name']}.")
            seen.add(cur); cur = prev[cur]
    if not any(s['id'] not in prev for s in out):
        raise ApiError('At least one Pokémon must be a first stage (hatches from eggs).')
    return out


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, fmt, *args):
        if '/api/' in (args[0] if args else ''):
            sys.stderr.write('%s\n' % (fmt % args))

    def end_headers(self):
        path = urlparse(self.path).path
        if path.endswith(('.js', '.html', '.json', '/')) or path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n > MAX_UPLOAD:
            raise ApiError('That upload is too big (60 MB max).')
        return self.rfile.read(n) if n else b''

    def handle_api(self, method):
        path = unquote(urlparse(self.path).path)
        try:
            if method == 'GET' and path == '/api/state':
                return self.send_json({'species': B.load_species(), 'sprites': sprite_index(), 'elements': ELEMENTS})
            m = re.match(r'^/api/stage/([a-f0-9]{8,32})/(.+)$', path)
            if method == 'PUT' and m:
                rel = safe_rel(m.group(2))
                if not rel or os.path.splitext(rel)[1].lower() not in ALLOWED:
                    return self.send_json({'ok': True, 'skipped': True})
                dst = os.path.join(STAGE, m.group(1), rel)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                with open(dst, 'wb') as f:
                    f.write(self.read_body())
                return self.send_json({'ok': True})
            m = re.match(r'^/api/stage-zip/([a-f0-9]{8,32})$', path)
            if method == 'POST' and m:
                dst = os.path.join(STAGE, m.group(1))
                try:
                    z = zipfile.ZipFile(io.BytesIO(self.read_body()))
                except zipfile.BadZipFile:
                    raise ApiError("That file isn't a valid .zip.")
                for info in z.infolist():
                    rel = safe_rel(info.filename)
                    if info.is_dir() or not rel or os.path.splitext(rel)[1].lower() not in ALLOWED:
                        continue
                    out = os.path.join(dst, rel)
                    os.makedirs(os.path.dirname(out), exist_ok=True)
                    with z.open(info) as src, open(out, 'wb') as f:
                        shutil.copyfileobj(src, f)
                return self.send_json({'ok': True})
            if method == 'POST' and path == '/api/commit':
                req = json.loads(self.read_body() or b'{}')
                token = str(req.get('token', ''))
                if not re.match(r'^[a-f0-9]{8,32}$', token):
                    raise ApiError('Bad upload.')
                stage = os.path.join(STAGE, token)
                if not os.path.isdir(stage):
                    raise ApiError('Nothing was uploaded.')
                try:
                    res = commit_upload(stage, int(req.get('id') or 0), req.get('name', ''))
                finally:
                    shutil.rmtree(stage, ignore_errors=True)
                return self.send_json(res)
            if method == 'POST' and path == '/api/species':
                req = json.loads(self.read_body() or b'{}')
                species = validate_species(req.get('species'), set(B.read_index().keys()))
                B.write_species(species)
                return self.send_json({'ok': True, 'species': species})
            if method == 'POST' and path == '/api/delete':
                req = json.loads(self.read_body() or b'{}')
                dex = int(req.get('id') or 0)
                species = [s for s in B.load_species() if s['id'] != dex]
                for s in species:
                    s['next'] = [n for n in s['next'] if n != dex]
                    if not s['next']:
                        s['evo'] = 0
                if req.get('files'):
                    old = folder_for(dex)
                    if old:
                        shutil.rmtree(os.path.join(SPRITES, old), ignore_errors=True)
                if req.get('files'):
                    B.build(verbose=False)
                B.write_species(species)
                return self.send_json({'ok': True})
            return self.send_json({'error': 'Not found'}, 404)
        except ApiError as e:
            return self.send_json({'error': str(e)}, 400)
        except Exception as e:  # report, don't crash the server
            return self.send_json({'error': f'Server error: {e}'}, 500)

    def do_GET(self):
        if self.path.startswith('/api/'):
            return self.handle_api('GET')
        return super().do_GET()

    def do_POST(self):
        return self.handle_api('POST')

    def do_PUT(self):
        return self.handle_api('PUT')


def sprite_index():
    """Sprite info for the dashboard, keyed by Dex number as a string."""
    return {str(k): v for k, v in B.read_index().items()}


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1)); ip = s.getsockname()[0]; s.close()
        return ip
    except OSError:
        return None


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.makedirs(SPRITES, exist_ok=True)
    os.makedirs(STAGE, exist_ok=True)
    B.build(verbose=False)
    if not os.path.exists(B.SPECIES_JS) or not B.load_species():
        B.write_species(B.load_species())
    ip = lan_ip()
    print(f'Pocket Pal running:\n  game:      http://localhost:{port}/\n  dashboard: http://localhost:{port}/dashboard.html')
    if ip:
        print(f'  on your phone (same Wi-Fi): http://{ip}:{port}/')
    ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
