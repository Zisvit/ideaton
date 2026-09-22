import base64
import hashlib
import hmac
import json
import mimetypes
import os
import random
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

PORT = int(os.environ.get('PORT', '3000'))
SECRET = os.environ.get('SECRET', 'minutka-local-secret').encode()
DB_PATH = os.environ.get('DB_PATH', './data.db')
HOLD_SEC = 15 * 60
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')

_db = sqlite3.connect(DB_PATH, check_same_thread=False)
_db.row_factory = sqlite3.Row
_lock = threading.Lock()


def now():
    return int(time.time())


def sha256(s):
    return hashlib.sha256(s.encode()).hexdigest()


with _lock:
    _db.executescript('''
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  balance INTEGER DEFAULT 0,
  is_admin INTEGER DEFAULT 0,
  driver_verified INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cars(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model TEXT NOT NULL,
  plate TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  status TEXT DEFAULT 'free',
  fuel INTEGER DEFAULT 80,
  tariff_drive INTEGER DEFAULT 12,
  tariff_pause INTEGER DEFAULT 3,
  code_current TEXT DEFAULT '0000'
);
CREATE TABLE IF NOT EXISTS bookings(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  car_id INTEGER NOT NULL,
  status TEXT DEFAULT 'hold',
  created_at INTEGER NOT NULL,
  hold_until INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  last_tick INTEGER,
  drive_sec INTEGER DEFAULT 0,
  pause_sec INTEGER DEFAULT 0,
  total_rub INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS transactions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
''')
    if _db.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 0:
        t = now()
        _db.execute('INSERT INTO users(phone,name,password_hash,balance,is_admin,driver_verified,created_at)'
                    ' VALUES(?,?,?,?,?,?,?)',
                    ('+70000000000', 'Админ', sha256('admin123'), 0, 1, 1, t))
        _db.execute('INSERT INTO users(phone,name,password_hash,balance,is_admin,driver_verified,created_at)'
                    ' VALUES(?,?,?,?,?,?,?)',
                    ('+79990001122', 'Демо', sha256('demo123'), 1000, 0, 1, t))
        for model, plate, lat, lng in [
            ('Lada Granta', 'А111АА116', 55.7887, 49.1221),
            ('Kia Rio', 'В222ВВ116', 55.7895, 49.1240),
            ('Hyundai Solaris', 'С333СС116', 55.7875, 49.1205),
            ('Chery Tiggo', 'Е444ЕЕ116', 55.7900, 49.1210),
            ('Moskvich 3e (электро)', 'К555КК116', 55.7880, 49.1255),
        ]:
            _db.execute('INSERT INTO cars(model,plate,lat,lng,status,fuel,tariff_drive,tariff_pause,code_current)'
                        ' VALUES(?,?,?,?,?,?,?,?,?)',
                        (model, plate, lat, lng, 'free', random.randint(60, 99), 12, 3,
                         str(random.randint(1000, 9999))))
        _db.commit()
        print('seed: admin +70000000000/admin123, demo +79990001122/demo123', flush=True)


def sign(data):
    return base64.urlsafe_b64encode(hmac.new(SECRET, data.encode(), hashlib.sha256).digest()).rstrip(b'=').decode()


def make_token(user_id):
    payload = base64.urlsafe_b64encode(
        json.dumps({'uid': user_id, 'exp': now() + 86400 * 7}).encode()).rstrip(b'=').decode()
    return payload + '.' + sign(payload)


def check_token(token):
    try:
        payload, sig = token.split('.')
        if not payload or not sig:
            return None
        if not hmac.compare_digest(sign(payload), sig):
            return None
        data = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
        if data['exp'] < now():
            return None
        with _lock:
            return _db.execute('SELECT * FROM users WHERE id=?', (data['uid'],)).fetchone()
    except Exception:
        return None


def pub_user(u):
    return {'id': u['id'], 'phone': u['phone'], 'name': u['name'], 'balance': u['balance'],
            'is_admin': bool(u['is_admin']), 'driver_verified': bool(u['driver_verified'])}


def expire_holds():
    with _lock:
        t = now()
        for b in _db.execute("SELECT * FROM bookings WHERE status='hold' AND hold_until < ?", (t,)).fetchall():
            _db.execute('UPDATE bookings SET status=? WHERE id=?', ('cancelled', b['id']))
            _db.execute('UPDATE cars SET status=? WHERE id=?', ('free', b['car_id']))
        _db.commit()


def expire_loop():
    while True:
        time.sleep(30)
        try:
            expire_holds()
        except Exception:
            pass


class Handler(BaseHTTPRequestHandler):
    server_version = 'Minutka/0.2'

    def log_message(self, *args):
        pass

    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        try:
            n = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            n = 0
        if not n:
            return {}
        try:
            return json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            return {}

    def _user(self, admin=False):
        h = self.headers.get('Authorization') or ''
        token = h[7:] if h.startswith('Bearer ') else None
        if not token:
            return None
        u = check_token(token)
        if not u:
            return None
        if admin and not u['is_admin']:
            return 'forbidden'
        return u

    def _serve_static(self):
        path = urlparse(self.path).path
        if path == '/':
            path = '/index.html'
        full = os.path.normpath(os.path.join(PUBLIC_DIR, path.lstrip('/')))
        if not full.startswith(PUBLIC_DIR) or not os.path.isfile(full):
            self._send(404, {'error': 'not found'})
            return
        ctype = mimetypes.guess_type(full)[0] or 'application/octet-stream'
        with open(full, 'rb') as f:
            body = f.read()
        self.send_response(200)
        self.send_header('Content-Type', ctype + ('; charset=utf-8' if ctype.startswith('text/') else ''))
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/me':
            u = self._user()
            if not u:
                return self._send(401, {'error': 'no token'})
            return self._send(200, {'user': pub_user(u)})
        if path == '/api/cars':
            u = self._user()
            if not u:
                return self._send(401, {'error': 'no token'})
            expire_holds()
            with _lock:
                cars = [dict(r) for r in _db.execute('SELECT * FROM cars').fetchall()]
            if not u['is_admin']:
                for c in cars:
                    c.pop('code_current', None)
            return self._send(200, {'cars': cars})
        if path == '/api/my-active':
            u = self._user()
            if not u:
                return self._send(401, {'error': 'no token'})
            with _lock:
                b = _db.execute('SELECT b.*, c.model, c.plate, c.tariff_drive, c.tariff_pause FROM bookings b'
                                ' JOIN cars c ON c.id=b.car_id WHERE b.user_id=?'
                                " AND b.status IN ('hold','active','paused') ORDER BY b.id DESC LIMIT 1",
                                (u['id'],)).fetchone()
            return self._send(200, {'booking': dict(b) if b else None, 'now': now()})
        if path == '/api/history':
            u = self._user()
            if not u:
                return self._send(401, {'error': 'no token'})
            with _lock:
                rows = [dict(r) for r in _db.execute(
                    'SELECT b.*, c.model, c.plate FROM bookings b JOIN cars c ON c.id=b.car_id'
                    ' WHERE b.user_id=? ORDER BY b.id DESC LIMIT 20', (u['id'],)).fetchall()]
            return self._send(200, {'history': rows})
        if path == '/api/admin/stats':
            u = self._user(admin=True)
            if u == 'forbidden':
                return self._send(403, {'error': 'admin only'})
            if not u:
                return self._send(401, {'error': 'no token'})
            with _lock:
                rev = _db.execute('SELECT COALESCE(SUM(-amount),0) FROM transactions WHERE amount<0').fetchone()[0]
                active = _db.execute("SELECT COUNT(*) FROM bookings WHERE status IN ('hold','active','paused')").fetchone()[0]
            return self._send(200, {'revenue': rev, 'active': active})
        if path == '/api/admin/bookings':
            u = self._user(admin=True)
            if u == 'forbidden':
                return self._send(403, {'error': 'admin only'})
            if not u:
                return self._send(401, {'error': 'no token'})
            with _lock:
                rows = [dict(r) for r in _db.execute(
                    'SELECT b.*, u.phone, c.model FROM bookings b JOIN users u ON u.id=b.user_id'
                    ' JOIN cars c ON c.id=b.car_id ORDER BY b.id DESC LIMIT 50').fetchall()]
            return self._send(200, {'bookings': rows})
        return self._serve_static()

    def _accrue(self, b):
        t = now()
        dt = max(0, t - (b['last_tick'] or t))
        with _lock:
            if b['status'] == 'active':
                _db.execute('UPDATE bookings SET drive_sec=drive_sec+?, last_tick=? WHERE id=?', (dt, t, b['id']))
            elif b['status'] == 'paused':
                _db.execute('UPDATE bookings SET pause_sec=pause_sec+?, last_tick=? WHERE id=?', (dt, t, b['id']))
            _db.commit()

    def _get_booking(self, bid):
        with _lock:
            return _db.execute('SELECT * FROM bookings WHERE id=?', (bid,)).fetchone()

    def do_POST(self):
        path = urlparse(self.path).path
        body = self._body()

        if path == '/api/register':
            phone, password = body.get('phone'), body.get('password')
            if not phone or not password:
                return self._send(400, {'error': 'phone и password обязательны'})
            try:
                with _lock:
                    cur = _db.execute('INSERT INTO users(phone,name,password_hash,balance,is_admin,driver_verified,created_at)'
                                      ' VALUES(?,?,?,?,0,1,?)',
                                      (phone, body.get('name', ''), sha256(password), 500, now()))
                    uid = cur.lastrowid
                    _db.execute('INSERT INTO transactions(user_id,amount,reason,created_at) VALUES(?,?,?,?)',
                                (uid, 500, 'стартовый бонус', now()))
                    _db.commit()
                    user = _db.execute('SELECT * FROM users WHERE id=?', (uid,)).fetchone()
                return self._send(200, {'token': make_token(uid), 'user': pub_user(user)})
            except sqlite3.IntegrityError:
                return self._send(400, {'error': 'такой телефон уже зарегистрирован'})

        if path == '/api/login':
            with _lock:
                user = _db.execute('SELECT * FROM users WHERE phone=?', (body.get('phone'),)).fetchone()
            if not user or user['password_hash'] != sha256(body.get('password') or ''):
                return self._send(401, {'error': 'неверный телефон или пароль'})
            return self._send(200, {'token': make_token(user['id']), 'user': pub_user(user)})

        if path == '/api/topup':
            u = self._user()
            if not u:
                return self._send(401, {'error': 'no token'})
            try:
                amount = int(body.get('amount') or 500)
            except (ValueError, TypeError):
                amount = 500
            amount = min(10000, max(10, amount))
            with _lock:
                _db.execute('UPDATE users SET balance=balance+? WHERE id=?', (amount, u['id']))
                _db.execute('INSERT INTO transactions(user_id,amount,reason,created_at) VALUES(?,?,?,?)',
                            (u['id'], amount, 'пополнение (mock)', now()))
                _db.commit()
                user = _db.execute('SELECT * FROM users WHERE id=?', (u['id'],)).fetchone()
            return self._send(200, {'user': pub_user(user)})

        if path == '/api/bookings':
            u = self._user()
            if not u:
                return self._send(401, {'error': 'no token'})
            expire_holds()
            with _lock:
                car = _db.execute('SELECT * FROM cars WHERE id=?', (body.get('car_id'),)).fetchone()
                if not car:
                    return self._send(404, {'error': 'авто не найдено'})
                if car['status'] != 'free':
                    return self._send(400, {'error': 'авто уже занято'})
                has = _db.execute("SELECT id FROM bookings WHERE user_id=? AND status IN ('hold','active','paused')",
                                  (u['id'],)).fetchone()
                if has:
                    return self._send(400, {'error': 'у вас уже есть активная аренда'})
                bal = _db.execute('SELECT balance FROM users WHERE id=?', (u['id'],)).fetchone()[0]
                if bal < 50:
                    return self._send(400, {'error': 'пополните баланс (мин. 50 ₽)'})
                t = now()
                cur = _db.execute('INSERT INTO bookings(user_id,car_id,status,created_at,hold_until,last_tick)'
                                  " VALUES(?,?, 'hold',?,?,?)", (u['id'], car['id'], t, t + HOLD_SEC, t))
                _db.execute("UPDATE cars SET status='hold' WHERE id=?", (car['id'],))
                _db.commit()
                b = _db.execute('SELECT * FROM bookings WHERE id=?', (cur.lastrowid,)).fetchone()
            return self._send(200, {'booking': dict(b)})

        if path.startswith('/api/bookings/'):
            parts = path.split('/')
            if len(parts) != 5 or not parts[3].isdigit():
                return self._send(404, {'error': 'not found'})
            bid, op = int(parts[3]), parts[4]
            u = self._user()
            if not u:
                return self._send(401, {'error': 'no token'})
            b = self._get_booking(bid)
            if not b or b['user_id'] != u['id']:
                if op == 'start' and (not b or b['user_id'] != u['id']):
                    return self._send(404, {'error': 'бронь не найдена'})
                return self._send(404 if op in ('start', 'finish') else 400,
                                   {'error': 'не найдено' if op in ('start', 'finish') else 'bad state'})
            if op == 'start':
                if b['status'] != 'hold':
                    return self._send(400, {'error': 'старт возможен только из hold'})
                with _lock:
                    car = _db.execute('SELECT * FROM cars WHERE id=?', (b['car_id'],)).fetchone()
                if (body.get('code') or '') != car['code_current']:
                    return self._send(400, {'error': 'неверный код из авто (спросите у админа в demo)'})
                t = now()
                with _lock:
                    _db.execute("UPDATE bookings SET status='active', started_at=?, last_tick=? WHERE id=?",
                                (t, t, bid))
                    _db.execute("UPDATE cars SET status='rent' WHERE id=?", (b['car_id'],))
                    _db.commit()
                return self._send(200, {'booking': dict(self._get_booking(bid))})
            if op == 'pause':
                if b['status'] != 'active':
                    return self._send(400, {'error': 'пауза только из active'})
                self._accrue(b)
                with _lock:
                    _db.execute("UPDATE bookings SET status='paused' WHERE id=?", (bid,))
                    _db.commit()
                return self._send(200, {'booking': dict(self._get_booking(bid))})
            if op == 'resume':
                if b['status'] != 'paused':
                    return self._send(400, {'error': 'продолжить только из paused'})
                self._accrue(b)
                with _lock:
                    _db.execute("UPDATE bookings SET status='active' WHERE id=?", (bid,))
                    _db.commit()
                return self._send(200, {'booking': dict(self._get_booking(bid))})
            if op == 'finish':
                if b['status'] not in ('active', 'paused', 'hold'):
                    return self._send(400, {'error': 'уже завершена'})
                self._accrue(b)
                b = self._get_booking(bid)
                with _lock:
                    car = _db.execute('SELECT * FROM cars WHERE id=?', (b['car_id'],)).fetchone()
                drive_min = (b['drive_sec'] + 59) // 60
                pause_min = (b['pause_sec'] + 59) // 60
                total = drive_min * car['tariff_drive'] + pause_min * car['tariff_pause']
                t = now()
                with _lock:
                    _db.execute("UPDATE bookings SET status='finished', finished_at=?, total_rub=? WHERE id=?",
                                (t, total, bid))
                    _db.execute('UPDATE cars SET status=?, code_current=? WHERE id=?',
                                ('free', str(random.randint(1000, 9999)), car['id']))
                    _db.execute('UPDATE users SET balance=balance-? WHERE id=?', (total, u['id']))
                    _db.execute('INSERT INTO transactions(user_id,amount,reason,created_at) VALUES(?,?,?,?)',
                                (u['id'], -total, f'поездка #{bid}: {drive_min} мин драйв + {pause_min} мин пауза', t))
                    _db.commit()
                    user = _db.execute('SELECT * FROM users WHERE id=?', (u['id'],)).fetchone()
                return self._send(200, {'booking': dict(self._get_booking(bid)), 'total': total,
                                        'user': pub_user(user)})
            if op == 'cancel':
                if b['status'] != 'hold':
                    return self._send(400, {'error': 'отмена только из hold'})
                with _lock:
                    _db.execute("UPDATE bookings SET status='cancelled' WHERE id=?", (bid,))
                    _db.execute("UPDATE cars SET status='free' WHERE id=?", (b['car_id'],))
                    _db.commit()
                return self._send(200, {'ok': True})
            return self._send(404, {'error': 'not found'})

        if path.startswith('/api/admin/cars/'):
            u = self._user(admin=True)
            if u == 'forbidden':
                return self._send(403, {'error': 'admin only'})
            if not u:
                return self._send(401, {'error': 'no token'})
            try:
                cid = int(path.rsplit('/', 1)[1])
            except ValueError:
                return self._send(404, {'error': 'нет авто'})
            with _lock:
                car = _db.execute('SELECT * FROM cars WHERE id=?', (cid,)).fetchone()
                if not car:
                    return self._send(404, {'error': 'нет авто'})
                _db.execute('UPDATE cars SET status=COALESCE(?,status), tariff_drive=COALESCE(?,tariff_drive),'
                            ' tariff_pause=COALESCE(?,tariff_pause), fuel=COALESCE(?,fuel),'
                            ' lat=COALESCE(?,lat), lng=COALESCE(?,lng) WHERE id=?',
                            (body.get('status'), body.get('tariff_drive'), body.get('tariff_pause'),
                             body.get('fuel'), body.get('lat'), body.get('lng'), cid))
                _db.commit()
                car = _db.execute('SELECT * FROM cars WHERE id=?', (cid,)).fetchone()
            return self._send(200, {'car': dict(car)})

        return self._send(404, {'error': 'not found'})


if __name__ == '__main__':
    expire_holds()
    threading.Thread(target=expire_loop, daemon=True).start()
    srv = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    print(f'Minutka PY on http://localhost:{PORT}  demo +79990001122/demo123  admin +70000000000/admin123', flush=True)
    srv.serve_forever()
