import json
import os
import subprocess
import sys
import time
import urllib.request

PORT = 3101
BASE = f'http://localhost:{PORT}'
HERE = os.path.dirname(os.path.abspath(__file__))


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
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b'{}')
        except Exception:
            return e.code, {}


srv = subprocess.Popen([sys.executable, 'app.py'], cwd=HERE,
                       env={**os.environ, 'PORT': str(PORT), 'DB_PATH': '/tmp/minutka-pye2e.db'},
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
try:
    for _ in range(40):
        try:
            if urllib.request.urlopen(BASE + '/', timeout=2).status == 200:
                break
        except Exception:
            time.sleep(0.3)
    else:
        raise RuntimeError('server not up')

    print('UP ok')
    st, demo = api('/api/login', body={'phone': '+79990001122', 'password': 'demo123'})
    assert st == 200, demo
    st, admin = api('/api/login', body={'phone': '+70000000000', 'password': 'admin123'})
    assert st == 200, admin
    print('login ok, balance:', demo['user']['balance'])

    st, data = api('/api/cars', demo['token'])
    free = next(c for c in data['cars'] if c['status'] == 'free')
    print('booking car:', free['model'], free['plate'])

    st, data = api('/api/bookings', demo['token'], {'car_id': free['id']})
    assert st == 200, data
    bid = data['booking']['id']
    print('hold ok:', bid)

    st, data = api('/api/cars', admin['token'])
    code = next(c for c in data['cars'] if c['id'] == free['id'])['code_current']
    print('code:', code)

    st, _ = api(f'/api/bookings/{bid}/start', demo['token'], {'code': code})
    assert st == 200
    print('start ok')
    time.sleep(2.5)
    api(f'/api/bookings/{bid}/pause', demo['token'], {})
    print('pause ok')
    api(f'/api/bookings/{bid}/resume', demo['token'], {})
    print('resume ok')
    time.sleep(1.5)
    st, fin = api(f'/api/bookings/{bid}/finish', demo['token'], {})
    assert st == 200, fin
    b = fin['booking']
    exp = -(-b['drive_sec'] // 60) * 12 + -(-b['pause_sec'] // 60) * 3
    assert fin['total'] == exp, (fin['total'], exp)
    print('finish ok, total:', fin['total'], 'new balance:', fin['user']['balance'])

    st, hist = api('/api/history', demo['token'])
    print('history len:', len(hist['history']))
    st, stats = api('/api/admin/stats', admin['token'])
    print('admin revenue:', stats['revenue'], 'active:', stats['active'])
    print('E2E PASS')
    code = 0
except Exception as e:
    print('E2E FAIL:', e)
    code = 1
finally:
    srv.kill()
    sys.exit(code)
