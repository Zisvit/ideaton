import http.cookiejar
import json
import os
import subprocess
import sys
import time
import urllib.request

PORT = 3141
BASE = f'http://localhost:{PORT}'
HERE = os.path.dirname(os.path.abspath(__file__))
VENV_PY = '/home/php/.venvs/minutka/bin/python'
passed = failed = 0


def check(name, cond, extra=''):
    global passed, failed
    if cond:
        passed += 1
    else:
        failed += 1
        print('FAIL:', name, extra, flush=True)


def get(path):
    with urllib.request.urlopen(BASE + path, timeout=10) as r:
        return r.status, r.read().decode('utf-8', 'replace'), dict(r.headers)


srv = subprocess.Popen([VENV_PY, 'app.py'], cwd=HERE,
                       env={**os.environ, 'PORT': str(PORT), 'DB_PATH': '/tmp/minutka-pyfront.db'},
                       stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
code = 1
try:
    for _ in range(40):
        try:
            if urllib.request.urlopen(BASE + '/', timeout=2).status == 200:
                break
        except Exception:
            time.sleep(0.3)
    else:
        raise RuntimeError('server not up')

    st, index, _ = get('/')
    check('F1 index 200', st == 200)
    check('F2 viewport mobile', 'viewport-fit=cover' in index)
    check('F3 manifest linked', 'rel="manifest"' in index)
    check('F4 theme-color meta', 'name="theme-color"' in index)
    check('F5 apple touch icon', 'apple-touch-icon' in index)
    check('F6 theme button', 'id="themeBtn"' in index and 'cycleTheme' in index)
    check('F7 auto theme 7-19', 'h >= 7 && h < 19' in index)
    check('F8 Surgut center', '61.2500' in index and '73.3960' in index)
    check('F9 Surgut label', 'Сургут' in index)
    check('F10 logout button', 'onclick="logout()"' in index)
    check('F11 no Bearer tokens', 'Bearer' not in index)
    check('F12 responsive css', '@media(min-width:920px)' in index and '@media(max-width:560px)' in index)
    check('F12b live ticker', 'liveCost' in index and 'tickLive' in index)
    check('F12c colored markers', 'circleMarker' in index)
    check('F12d regname field', 'id="regname"' in index)

    st, admin, _ = get('/admin.html')
    check('F13 admin 200', st == 200)
    check('F14 admin theme button', 'id="themeBtn"' in admin)
    check('F15 admin Surgut', 'Сургут' in admin)
    check('F16 admin no Bearer', 'Bearer' not in admin)

    st, mf, _ = get('/manifest.json')
    m = json.loads(mf)
    check('F17 manifest 200+json', st == 200 and m.get('short_name') == 'Минутка')
    check('F18 manifest start_url', m.get('start_url') == '/')
    check('F19 manifest icons', bool(m.get('icons')))
    st, icon, headers = get('/icon.svg')
    check('F20 icon 200 svg', st == 200 and '<svg' in icon)

    jar = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

    def api(path, body='GET'):
        data = json.dumps(body or {}).encode() if body != 'GET' else None
        req = urllib.request.Request(BASE + path, data=data,
                                     method='GET' if body == 'GET' else 'POST',
                                     headers={'Content-Type': 'application/json'})
        try:
            with op.open(req, timeout=10) as r:
                return r.status, json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read() or b'{}')
            except Exception:
                return e.code, {}

    st, me = api('/api/login', {'phone': '+79990001122', 'password': 'demo123'})
    check('F21 login sets cookie', st == 200 and len(jar) > 0, f'cookies={len(jar)}')
    check('F22 session cookie httponly-ish', st == 200)
    st, data = api('/api/cars')
    check('F23 cars in Surgut bbox',
          all(61.2 < c['lat'] < 61.3 and 73.3 < c['lng'] < 73.5 for c in data['cars']),
          str([(c['lat'], c['lng']) for c in data['cars']]))
    check('F24 plates region 86', all(c['plate'].endswith('86') for c in data['cars']))
    st, _ = api('/api/logout', {})
    check('F25 logout ok', st == 200)
    st, _ = api('/api/me')
    check('F26 me after logout -> 401', st == 401)
    check('F27 cookie cleared', len(jar) == 0, f'cookies={len(jar)}')

    print(f'\nFRONT RESULT: pass={passed} fail={failed}', flush=True)
    code = 0 if failed == 0 else 1
    print('FRONT ALL PASS' if code == 0 else 'FRONT FAILURES', flush=True)
except Exception as e:
    print('HARNESS ERROR:', e, flush=True)
finally:
    srv.kill()
    sys.exit(code)
