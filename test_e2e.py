import http.cookiejar
import json
import os
import subprocess
import sys
import time
import urllib.request

PORT = 3101
BASE = f'http://localhost:{PORT}'
HERE = os.path.dirname(os.path.abspath(__file__))
VENV_PY = '/home/php/.venvs/minutka/bin/python'


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
            with self.opener.open(req, timeout=10) as r:
                return r.status, json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read() or b'{}')
            except Exception:
                return e.code, {}


srv = subprocess.Popen([VENV_PY, 'app.py'], cwd=HERE,
                       env={**os.environ, 'PORT': str(PORT), 'DB_PATH': '/tmp/minutka-pye2e.db'},
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
try:
    import urllib.request as u
    for _ in range(40):
        try:
            if u.urlopen(BASE + '/', timeout=2).status == 200:
                break
        except Exception:
            time.sleep(0.3)
    else:
        raise RuntimeError('server not up')
    print('UP ok')

    demo, admin = Sess(), Sess()
    st, me = demo.api('/api/login', {'phone': '+79990001122', 'password': 'demo123'})
    assert st == 200, me
    st, _ = admin.api('/api/login', {'phone': '+70000000000', 'password': 'admin123'})
    assert st == 200
    print('login ok, balance:', me['user']['balance'])

    st, data = demo.api('/api/cars')
    free = next(c for c in data['cars'] if c['status'] == 'free')
    print('booking car:', free['model'], free['plate'])

    st, data = demo.api('/api/bookings', {'car_id': free['id']})
    assert st == 200, data
    bid = data['booking']['id']
    print('hold ok:', bid)

    st, data = admin.api('/api/cars')
    code = next(c for c in data['cars'] if c['id'] == free['id'])['code_current']
    print('code:', code)

    st, _ = demo.api(f'/api/bookings/{bid}/start', {'code': code})
    assert st == 200
    print('start ok')
    time.sleep(2.5)
    demo.api(f'/api/bookings/{bid}/pause', {})
    print('pause ok')
    demo.api(f'/api/bookings/{bid}/resume', {})
    print('resume ok')
    time.sleep(1.5)
    st, fin = demo.api(f'/api/bookings/{bid}/finish', {})
    assert st == 200, fin
    b = fin['booking']
    exp = -(-b['drive_sec'] // 60) * 12 + -(-b['pause_sec'] // 60) * 3
    assert fin['total'] == exp, (fin['total'], exp)
    print('finish ok, total:', fin['total'], 'new balance:', fin['user']['balance'])

    st, hist = demo.api('/api/history')
    print('history len:', len(hist['history']))
    st, stats = admin.api('/api/admin/stats')
    print('admin revenue:', stats['revenue'], 'active:', stats['active'])

    st, _ = demo.api('/api/logout', {})
    assert st == 200
    st, _ = demo.api('/api/me')
    assert st == 401, 'logout must invalidate session'
    print('logout ok')
    print('E2E PASS')
    code = 0
except Exception as e:
    print('E2E FAIL:', e)
    code = 1
finally:
    srv.kill()
    sys.exit(code)
