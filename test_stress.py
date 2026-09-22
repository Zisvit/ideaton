import concurrent.futures
import http.cookiejar
import json
import os
import subprocess
import sys
import time
import urllib.request

PORT = 3131
BASE = f'http://localhost:{PORT}'
HERE = os.path.dirname(os.path.abspath(__file__))
VENV_PY = '/home/php/.venvs/minutka/bin/python'
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
                       env={**os.environ, 'PORT': str(PORT), 'DB_PATH': '/tmp/minutka-pystress.db'},
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
    print('server up', flush=True)

    demo, admin = Sess(), Sess()
    st, me = demo.api('/api/login', {'phone': '+79990001122', 'password': 'demo123'})
    check('A1 demo login', st == 200 and bool(me.get('user')))

    st, _ = demo.api('/api/login', {'phone': '+79990001122', 'password': 'wrong'})
    check('A2 wrong password -> 401', st == 401)
    st, _ = Sess().api('/api/register', {'phone': '+79990001122', 'name': 'x', 'password': 'y'})
    check('A3 duplicate register -> 400', st == 400)
    st, _ = Sess().api('/api/cars')
    check('A4 no session -> 401', st == 401)
    st, _ = admin.api('/api/login', {'phone': '+70000000000', 'password': 'admin123'})
    check('A4b admin login', st == 200)
    st, _ = demo.api('/api/admin/stats')
    check('A6 non-admin stats -> 403', st == 403)
    st, _ = demo.api('/api/bookings', {'car_id': 99999})
    check('A7 book missing car -> 404', st == 404)

    st, data = demo.api('/api/cars')
    cars = data['cars']
    car1 = cars[0]
    st, hold1 = demo.api('/api/bookings', {'car_id': car1['id']})
    check('A8 hold ok', st == 200)
    hid = (hold1.get('booking') or {}).get('id')
    st, _ = demo.api('/api/bookings', {'car_id': cars[1]['id']})
    check('A9 second active booking blocked -> 400', st == 400)
    st, _ = demo.api(f'/api/bookings/{hid}/start', {'code': '0000-nope'})
    check('A10 wrong code -> 400', st == 400)
    st, _ = demo.api(f'/api/bookings/{hid}/pause', {})
    check('A11 pause from hold -> 400', st == 400)

    st, data = admin.api('/api/cars')
    real_code = next(c for c in data['cars'] if c['id'] == car1['id'])['code_current']
    check('A12 admin sees code', isinstance(real_code, str) and len(real_code) == 4)
    st, data = demo.api('/api/cars')
    check('A13 user does NOT see code',
          next(c for c in data['cars'] if c['id'] == car1['id']).get('code_current') is None)

    st, _ = demo.api(f'/api/bookings/{hid}/start', {'code': real_code})
    check('A14 start with code ok', st == 200)
    st, _ = demo.api(f'/api/bookings/{hid}/resume', {})
    check('A15 resume from active -> 400', st == 400)
    demo.api(f'/api/bookings/{hid}/pause', {})
    st, _ = demo.api(f'/api/bookings/{hid}/pause', {})
    check('A16 double pause -> 400', st == 400)
    demo.api(f'/api/bookings/{hid}/resume', {})
    st, fin1 = demo.api(f'/api/bookings/{hid}/finish', {})
    check('A17 finish ok', st == 200)
    b1 = fin1.get('booking', {})
    exp1 = -(-b1.get('drive_sec', 0) // 60) * 12 + -(-b1.get('pause_sec', 0) // 60) * 3
    check('A18 billing math', fin1.get('total') == exp1, f"total={fin1.get('total')} exp={exp1}")
    st, _ = demo.api(f'/api/bookings/{hid}/finish', {})
    check('A19 double finish -> 400', st == 400)

    st, hold2 = demo.api('/api/bookings', {'car_id': cars[2]['id']})
    st, _ = demo.api(f"/api/bookings/{hold2['booking']['id']}/cancel", {})
    check('A20 cancel hold ok', st == 200)
    st, data = demo.api('/api/cars')
    check('A21 car free after cancel',
          next(c for c in data['cars'] if c['id'] == cars[2]['id'])['status'] == 'free')

    st, me0 = demo.api('/api/me')
    st, top = demo.api('/api/topup', {'amount': 500})
    check('A22 topup +500', top['user']['balance'] == me0['user']['balance'] + 500)
    st, _ = demo.api('/api/logout', {})
    check('A23 logout ok', st == 200)
    st, _ = demo.api('/api/me')
    check('A24 session dead after logout -> 401', st == 401)
    st, me = demo.api('/api/login', {'phone': '+79990001122', 'password': 'demo123'})
    check('A25 relogin ok', st == 200)

    print('Phase B: 50 cycles...', flush=True)
    for i in range(50):
        u = Sess()
        st, reg = u.api('/api/register', {'phone': f'+7900000{1000 + i}', 'name': f'U{i}', 'password': 'pw123456'})
        if st != 200:
            check(f'B{i} register', False, str(reg))
            continue
        start_bal = reg['user']['balance']
        st, data = u.api('/api/cars')
        free = [c for c in data['cars'] if c['status'] == 'free']
        if not free:
            check(f'B{i} free car exists', False, 'no free cars')
            continue
        car = free[i % len(free)]
        st, h = u.api('/api/bookings', {'car_id': car['id']})
        if st != 200:
            check(f'B{i} hold', False, str(h))
            continue
        bid = h['booking']['id']
        st, data = admin.api('/api/cars')
        code = next(c for c in data['cars'] if c['id'] == car['id'])['code_current']
        st, _ = u.api(f'/api/bookings/{bid}/start', {'code': code})
        if st != 200:
            check(f'B{i} start', False)
            continue
        time.sleep(1.1)
        if i % 2 == 0:
            u.api(f'/api/bookings/{bid}/pause', {})
            time.sleep(1.1)
            u.api(f'/api/bookings/{bid}/resume', {})
        st, f = u.api(f'/api/bookings/{bid}/finish', {})
        if st != 200:
            check(f'B{i} finish', False, str(f))
            continue
        bb = f['booking']
        exp = -(-bb['drive_sec'] // 60) * car['tariff_drive'] + -(-bb['pause_sec'] // 60) * car['tariff_pause']
        check(f'B{i} billing', f['total'] == exp, f"total={f['total']} exp={exp}")
        check(f'B{i} balance', f['user']['balance'] == start_bal - exp)
        if (i + 1) % 10 == 0:
            print(f'  ...{i + 1}/50 done', flush=True)
    print('Phase B done', flush=True)

    print('Phase C: concurrency...', flush=True)
    racers = []
    for i in range(8):
        u = Sess()
        st, r = u.api('/api/register', {'phone': f'+7900099{100 + i}', 'name': f'R{i}', 'password': 'pw123456'})
        racers.append(u)
    st, data = admin.api('/api/cars')
    target = next(c for c in data['cars'] if c['status'] == 'free')

    def grab(u):
        return u.api('/api/bookings', {'car_id': target['id']})

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(grab, racers))
    winners = [(u, r) for u, r in zip(racers, results) if r[0] == 200]
    check('C1 exactly 1 winner of 8 parallel books', len(winners) == 1, f'winners={len(winners)}')
    if winners:
        u, r = winners[0]
        u.api(f"/api/bookings/{r[1]['booking']['id']}/cancel", {})
    st, data = admin.api('/api/cars')
    check('C2 car free after winner cancel',
          next(c for c in data['cars'] if c['id'] == target['id'])['status'] == 'free')

    print(f'\nRESULT: pass={passed} fail={failed}', flush=True)
    if failed == 0:
        print('ALL 50+ TESTS PASS', flush=True)
        exit_code = 0
    else:
        print('FAILURES:', flush=True)
        for f in failures:
            print(' -', f, flush=True)
except Exception as e:
    print('HARNESS ERROR:', e, flush=True)
finally:
    srv.kill()
    sys.exit(exit_code)
