import concurrent.futures
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

PORT = 3131
BASE = f'http://localhost:{PORT}'
HERE = os.path.dirname(os.path.abspath(__file__))
passed = failed = 0
failures = []


def api(path, token=None, body='GET'):
    data = None
    method = 'GET'
    if body != 'GET':
        data = json.dumps(body or {}).encode()
        method = 'POST'
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={'Content-Type': 'application/json'})
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
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


srv = subprocess.Popen([sys.executable, 'app.py'], cwd=HERE,
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

    st, demo = api('/api/login', body={'phone': '+79990001122', 'password': 'demo123'})
    check('A1 demo login', st == 200 and bool(demo.get('token')))
    d_tok = demo.get('token', '')

    st, _ = api('/api/login', body={'phone': '+79990001122', 'password': 'wrong'})
    check('A2 wrong password -> 401', st == 401)
    st, _ = api('/api/register', body={'phone': '+79990001122', 'name': 'x', 'password': 'y'})
    check('A3 duplicate register -> 400', st == 400)
    st, _ = api('/api/cars', None)
    check('A4 no token -> 401', st == 401)
    st, _ = api('/api/cars', 'bad.token.here')
    check('A5 bad token -> 401', st == 401)
    st, _ = api('/api/admin/stats', d_tok)
    check('A6 non-admin stats -> 403', st == 403)
    st, _ = api('/api/bookings', d_tok, {'car_id': 99999})
    check('A7 book missing car -> 404', st == 404)

    st, data = api('/api/cars', d_tok)
    cars = data['cars']
    car1 = cars[0]
    st, hold1 = api('/api/bookings', d_tok, {'car_id': car1['id']})
    check('A8 hold ok', st == 200)
    hid = (hold1.get('booking') or {}).get('id')
    st, _ = api('/api/bookings', d_tok, {'car_id': cars[1]['id']})
    check('A9 second active booking blocked -> 400', st == 400)
    st, _ = api(f'/api/bookings/{hid}/start', d_tok, {'code': '0000-nope'})
    check('A10 wrong code -> 400', st == 400)
    st, _ = api(f'/api/bookings/{hid}/pause', d_tok, {})
    check('A11 pause from hold -> 400', st == 400)

    st, admin = api('/api/login', body={'phone': '+70000000000', 'password': 'admin123'})
    a_tok = admin['token']
    st, data = api('/api/cars', a_tok)
    real_code = next(c for c in data['cars'] if c['id'] == car1['id'])['code_current']
    check('A12 admin sees code', isinstance(real_code, str) and len(real_code) == 4)
    st, data = api('/api/cars', d_tok)
    check('A13 user does NOT see code',
          next(c for c in data['cars'] if c['id'] == car1['id']).get('code_current') is None)

    st, _ = api(f'/api/bookings/{hid}/start', d_tok, {'code': real_code})
    check('A14 start with code ok', st == 200)
    st, _ = api(f'/api/bookings/{hid}/resume', d_tok, {})
    check('A15 resume from active -> 400', st == 400)
    api(f'/api/bookings/{hid}/pause', d_tok, {})
    st, _ = api(f'/api/bookings/{hid}/pause', d_tok, {})
    check('A16 double pause -> 400', st == 400)
    api(f'/api/bookings/{hid}/resume', d_tok, {})
    st, fin1 = api(f'/api/bookings/{hid}/finish', d_tok, {})
    check('A17 finish ok', st == 200)
    b1 = fin1.get('booking', {})
    exp1 = -(-b1.get('drive_sec', 0) // 60) * 12 + -(-b1.get('pause_sec', 0) // 60) * 3
    check('A18 billing math', fin1.get('total') == exp1, f"total={fin1.get('total')} exp={exp1}")
    st, _ = api(f'/api/bookings/{hid}/finish', d_tok, {})
    check('A19 double finish -> 400', st == 400)

    st, hold2 = api('/api/bookings', d_tok, {'car_id': cars[2]['id']})
    st, _ = api(f"/api/bookings/{hold2['booking']['id']}/cancel", d_tok, {})
    check('A20 cancel hold ok', st == 200)
    st, data = api('/api/cars', d_tok)
    check('A21 car free after cancel',
          next(c for c in data['cars'] if c['id'] == cars[2]['id'])['status'] == 'free')

    st, me0 = api('/api/me', d_tok)
    st, top = api('/api/topup', d_tok, {'amount': 500})
    check('A22 topup +500', top['user']['balance'] == me0['user']['balance'] + 500)

    print('Phase B: 50 cycles...', flush=True)
    for i in range(50):
        phone = f'+7900000{1000 + i}'
        st, reg = api('/api/register', body={'phone': phone, 'name': f'U{i}', 'password': 'pw123456'})
        if st != 200:
            check(f'B{i} register', False, str(reg))
            continue
        tok, start_bal = reg['token'], reg['user']['balance']
        st, data = api('/api/cars', tok)
        free = [c for c in data['cars'] if c['status'] == 'free']
        if not free:
            check(f'B{i} free car exists', False, 'no free cars')
            continue
        car = free[i % len(free)]
        st, h = api('/api/bookings', tok, {'car_id': car['id']})
        if st != 200:
            check(f'B{i} hold', False, str(h))
            continue
        bid = h['booking']['id']
        st, data = api('/api/cars', a_tok)
        code = next(c for c in data['cars'] if c['id'] == car['id'])['code_current']
        st, _ = api(f'/api/bookings/{bid}/start', tok, {'code': code})
        if st != 200:
            check(f'B{i} start', False)
            continue
        time.sleep(1.1)
        if i % 2 == 0:
            api(f'/api/bookings/{bid}/pause', tok, {})
            time.sleep(1.1)
            api(f'/api/bookings/{bid}/resume', tok, {})
        st, f = api(f'/api/bookings/{bid}/finish', tok, {})
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
        st, r = api('/api/register', body={'phone': f'+7900099{100 + i}', 'name': f'R{i}', 'password': 'pw123456'})
        racers.append(r['token'])
    st, data = api('/api/cars', a_tok)
    target = next(c for c in data['cars'] if c['status'] == 'free')

    def grab(t):
        return api('/api/bookings', t, {'car_id': target['id']})

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(grab, racers))
    winners = [(t, r) for t, r in zip(racers, results) if r[0] == 200]
    check('C1 exactly 1 winner of 8 parallel books', len(winners) == 1, f'winners={len(winners)}')
    if winners:
        t, r = winners[0]
        api(f"/api/bookings/{r[1]['booking']['id']}/cancel", t, {})
    st, data = api('/api/cars', a_tok)
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
