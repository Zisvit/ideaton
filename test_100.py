import concurrent.futures
import http.cookiejar
import json
import os
import subprocess
import sys
import time
import urllib.request

PORT = 3135
BASE = f'http://localhost:{PORT}'
HERE = os.path.dirname(os.path.abspath(__file__))
VENV_PY = '/home/php/.venvs/minutka/bin/python'
N = 100
passed = failed = 0
failures = []


class Sess:
    def __init__(self):
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def api(self, path, body='GET'):
        data = None
        method = 'GET'
        if body != 'GET':
            data = json.dumps(body or {}).encode()
            method = 'POST'
        req = urllib.request.Request(BASE + path, data=data, method=method,
                                     headers={'Content-Type': 'application/json'})
        try:
            with self.opener.open(req, timeout=15) as r:
                return r.status, json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read() or b'{}')
            except Exception:
                return e.code, {}


def check(name, cond, extra=''):
    global passed, failed
    if cond:
        passed += 1
    else:
        failed += 1
        failures.append(f'{name} {extra}')
        print('FAIL:', name, extra, flush=True)


srv = subprocess.Popen([VENV_PY, 'app.py'], cwd=HERE,
                       env={**os.environ, 'PORT': str(PORT), 'DB_PATH': '/tmp/minutka-py100.db'},
                       stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
exit_code = 1
try:
    for _ in range(40):
        try:
            if urllib.request.urlopen(BASE + '/', timeout=2).status == 200:
                break
        except Exception:
            time.sleep(0.3)
    else:
        raise RuntimeError('server not up')
    print(f'server up, running {N} iterations', flush=True)

    admin = Sess()
    st, _ = admin.api('/api/login', {'phone': '+70000000000', 'password': 'admin123'})
    assert st == 200, 'admin login failed'
    st, zdata = admin.api('/api/cars')
    check('Z1 Surgut bbox', all(61.2 < c['lat'] < 61.3 and 73.3 < c['lng'] < 73.5 for c in zdata['cars']))
    check('Z2 plates 86', all(c['plate'].endswith('86') for c in zdata['cars']))

    for i in range(N):
        u = Sess()
        st, reg = u.api('/api/register', {'phone': f'+7911000{2000 + i}', 'name': f'W{i}', 'password': 'pw123456'})
        if st != 200:
            check(f'I{i} register', False, str(reg))
            continue
        check(f'I{i} bonus=500', reg['user']['balance'] == 500)
        start_bal = 500

        if i % 11 == 0:
            st, _ = Sess().api('/api/login', {'phone': f'+7911000{2000 + i}', 'password': 'bad'})
            check(f'I{i} wrong pw -> 401', st == 401)

        st, data = u.api('/api/cars')
        free = [c for c in data['cars'] if c['status'] == 'free']
        if not free:
            check(f'I{i} free car', False, 'none free')
            continue
        car = free[i % len(free)]
        check(f'I{i} code hidden', all(c.get('code_current') is None for c in data['cars']))

        st, h = u.api('/api/bookings', {'car_id': car['id']})
        if st != 200:
            check(f'I{i} hold', False, str(h))
            continue
        bid = h['booking']['id']

        if i % 7 == 0:
            st, _ = u.api(f'/api/bookings/{bid}/start', {'code': 'wrong'})
            check(f'I{i} wrong code -> 400', st == 400)
            st, _ = u.api(f'/api/bookings/{bid}/pause', {})
            check(f'I{i} pause-from-hold -> 400', st == 400)

        st, data = admin.api('/api/cars')
        code = next(c for c in data['cars'] if c['id'] == car['id'])['code_current']
        st, _ = u.api(f'/api/bookings/{bid}/start', {'code': code})
        if st != 200:
            check(f'I{i} start', False)
            continue

        if i % 3 == 0:
            st, _ = u.api(f'/api/bookings/{bid}/cancel', {})
            check(f'I{i} cancel-from-active -> 400', st == 400)
            time.sleep(1.1)
            st, _ = u.api(f'/api/bookings/{bid}/pause', {})
            if st != 200:
                check(f'I{i} pause', False)
                continue
            time.sleep(1.1)
            st, _ = u.api(f'/api/bookings/{bid}/resume', {})
            if st != 200:
                check(f'I{i} resume', False)
                continue
            st, f = u.api(f'/api/bookings/{bid}/finish', {})
        elif i % 5 == 0:
            st, _ = u.api(f'/api/bookings/{bid}/cancel', {})
            check(f'I{i} cancel-hold path', st in (200, 400))
            if st == 200:
                st2, d2 = u.api('/api/cars')
                check(f'I{i} freed', next(c for c in d2['cars'] if c['id'] == car['id'])['status'] == 'free')
                continue
            st, f = u.api(f'/api/bookings/{bid}/finish', {})
        else:
            st, f = u.api(f'/api/bookings/{bid}/finish', {})

        if st != 200:
            check(f'I{i} finish', False, str(f))
            continue
        bb = f['booking']
        exp = -(-bb['drive_sec'] // 60) * car['tariff_drive'] + -(-bb['pause_sec'] // 60) * car['tariff_pause']
        check(f'I{i} billing', f['total'] == exp, f"got={f['total']} exp={exp} d={bb['drive_sec']} p={bb['pause_sec']}")
        check(f'I{i} balance', f['user']['balance'] == start_bal - exp,
              f"bal={f['user']['balance']} want={start_bal - exp}")
        check(f'I{i} status finished', bb['status'] == 'finished')
        st, _ = u.api(f'/api/bookings/{bid}/finish', {})
        check(f'I{i} double finish -> 400', st == 400)

        if i % 10 == 9:
            st, _ = u.api('/api/logout', {})
            check(f'I{i} logout ok', st == 200)
            st, _ = u.api('/api/me')
            check(f'I{i} me after logout -> 401', st == 401)
            st, _ = u.api('/api/login', {'phone': f'+7911000{2000 + i}', 'password': 'pw123456'})
            check(f'I{i} relogin ok', st == 200)

        if (i + 1) % 20 == 0:
            print(f'  ...{i + 1}/{N} done (fails={failed})', flush=True)

    print('Race: 10 parallel books on one car...', flush=True)
    racers = []
    for k in range(10):
        u = Sess()
        st, r = u.api('/api/register', {'phone': f'+7912000{3000 + k}', 'name': f'Q{k}', 'password': 'pw123456'})
        racers.append(u)
    st, data = admin.api('/api/cars')
    target = next(c for c in data['cars'] if c['status'] == 'free')
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        res = list(ex.map(lambda u: u.api('/api/bookings', {'car_id': target['id']}), racers))
    wins = [x for x in zip(racers, res) if x[1][0] == 200]
    check('RACE exactly 1 winner of 10', len(wins) == 1, f'winners={len(wins)}')
    for u, r in wins:
        u.api(f"/api/bookings/{r[1]['booking']['id']}/cancel", {})

    st, s = admin.api('/api/admin/stats')
    check('ADMIN stats ok', st == 200 and s['revenue'] > 0, str(s))
    st, b = admin.api('/api/admin/bookings')
    check('ADMIN bookings list (limit 50)', st == 200 and len(b['bookings']) == 50, f"len={len(b.get('bookings', []))}")

    print(f'\nRESULT: iterations={N} pass={passed} fail={failed}', flush=True)
    if failed == 0:
        print('100x ALL PASS', flush=True)
        exit_code = 0
    else:
        for f in failures[:30]:
            print(' -', f, flush=True)
except Exception as e:
    import traceback
    traceback.print_exc()
    print('HARNESS ERROR:', e, flush=True)
finally:
    srv.kill()
    sys.exit(exit_code)
