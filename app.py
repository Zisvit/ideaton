import hashlib
import os
import random
import sqlite3
import threading
import time

from flask import Flask, jsonify, request, send_from_directory
from flask_login import LoginManager, UserMixin, current_user, login_required, login_user, logout_user

PORT = int(os.environ.get('PORT', '3000'))
SECRET = os.environ.get('SECRET', 'minutka-local-secret')
DB_PATH = os.environ.get('DB_PATH', './data.db')
HOLD_SEC = 15 * 60
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')

app = Flask(__name__)
app.secret_key = SECRET
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

login_manager = LoginManager()
login_manager.init_app(app)


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({'error': 'no login'}), 401


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


class User(UserMixin):
    def __init__(self, row):
        self._row = dict(row)

    def get_id(self):
        return str(self._row['id'])

    @property
    def id(self):
        return self._row['id']

    @property
    def is_admin(self):
        return bool(self._row['is_admin'])

    def pub(self):
        r = self._row
        return {'id': r['id'], 'phone': r['phone'], 'name': r['name'], 'balance': r['balance'],
                'is_admin': bool(r['is_admin']), 'driver_verified': bool(r['driver_verified'])}


@login_manager.user_loader
def load_user(uid):
    with _lock:
        row = _db.execute('SELECT * FROM users WHERE id=?', (int(uid),)).fetchone()
    return User(row) if row else None


def admin_or_403():
    if not current_user.is_admin:
        return jsonify({'error': 'admin only'}), 403
    return None


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


def accrue(bid):
    with _lock:
        b = _db.execute('SELECT * FROM bookings WHERE id=?', (bid,)).fetchone()
        t = now()
        dt = max(0, t - (b['last_tick'] or t))
        if b['status'] == 'active':
            _db.execute('UPDATE bookings SET drive_sec=drive_sec+?, last_tick=? WHERE id=?', (dt, t, bid))
        elif b['status'] == 'paused':
            _db.execute('UPDATE bookings SET pause_sec=pause_sec+?, last_tick=? WHERE id=?', (dt, t, bid))
        _db.commit()


@app.post('/api/register')
def register():
    body = request.get_json(silent=True) or {}
    if not body.get('phone') or not body.get('password'):
        return jsonify({'error': 'phone и password обязательны'}), 400
    try:
        with _lock:
            cur = _db.execute('INSERT INTO users(phone,name,password_hash,balance,is_admin,driver_verified,created_at)'
                              ' VALUES(?,?,?,?,0,1,?)',
                              (body['phone'], body.get('name', ''), sha256(body['password']), 500, now()))
            uid = cur.lastrowid
            _db.execute('INSERT INTO transactions(user_id,amount,reason,created_at) VALUES(?,?,?,?)',
                        (uid, 500, 'стартовый бонус', now()))
            _db.commit()
            user = User(_db.execute('SELECT * FROM users WHERE id=?', (uid,)).fetchone())
        login_user(user)
        return jsonify({'user': user.pub()})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'такой телефон уже зарегистрирован'}), 400


@app.post('/api/login')
def login():
    body = request.get_json(silent=True) or {}
    with _lock:
        row = _db.execute('SELECT * FROM users WHERE phone=?', (body.get('phone'),)).fetchone()
    if not row or row['password_hash'] != sha256(body.get('password') or ''):
        return jsonify({'error': 'неверный телефон или пароль'}), 401
    user = User(row)
    login_user(user)
    return jsonify({'user': user.pub()})


@app.post('/api/logout')
@login_required
def logout():
    logout_user()
    return jsonify({'ok': True})


@app.get('/api/me')
@login_required
def me():
    return jsonify({'user': current_user.pub()})


@app.post('/api/topup')
@login_required
def topup():
    body = request.get_json(silent=True) or {}
    try:
        amount = int(body.get('amount') or 500)
    except (ValueError, TypeError):
        amount = 500
    amount = min(10000, max(10, amount))
    with _lock:
        _db.execute('UPDATE users SET balance=balance+? WHERE id=?', (amount, current_user.id))
        _db.execute('INSERT INTO transactions(user_id,amount,reason,created_at) VALUES(?,?,?,?)',
                    (current_user.id, amount, 'пополнение (mock)', now()))
        _db.commit()
        row = _db.execute('SELECT * FROM users WHERE id=?', (current_user.id,)).fetchone()
    return jsonify({'user': User(row).pub()})


@app.get('/api/cars')
@login_required
def cars():
    expire_holds()
    with _lock:
        rows = [dict(r) for r in _db.execute('SELECT * FROM cars').fetchall()]
    if not current_user.is_admin:
        for c in rows:
            c.pop('code_current', None)
    return jsonify({'cars': rows})


@app.get('/api/my-active')
@login_required
def my_active():
    with _lock:
        b = _db.execute('SELECT b.*, c.model, c.plate, c.tariff_drive, c.tariff_pause FROM bookings b'
                        ' JOIN cars c ON c.id=b.car_id WHERE b.user_id=?'
                        " AND b.status IN ('hold','active','paused') ORDER BY b.id DESC LIMIT 1",
                        (current_user.id,)).fetchone()
    return jsonify({'booking': dict(b) if b else None, 'now': now()})


@app.post('/api/bookings')
@login_required
def book():
    body = request.get_json(silent=True) or {}
    expire_holds()
    with _lock:
        car = _db.execute('SELECT * FROM cars WHERE id=?', (body.get('car_id'),)).fetchone()
        if not car:
            return jsonify({'error': 'авто не найдено'}), 404
        if car['status'] != 'free':
            return jsonify({'error': 'авто уже занято'}), 400
        has = _db.execute("SELECT id FROM bookings WHERE user_id=? AND status IN ('hold','active','paused')",
                          (current_user.id,)).fetchone()
        if has:
            return jsonify({'error': 'у вас уже есть активная аренда'}), 400
        bal = _db.execute('SELECT balance FROM users WHERE id=?', (current_user.id,)).fetchone()[0]
        if bal < 50:
            return jsonify({'error': 'пополните баланс (мин. 50 ₽)'}), 400
        t = now()
        cur = _db.execute('INSERT INTO bookings(user_id,car_id,status,created_at,hold_until,last_tick)'
                          " VALUES(?,?, 'hold',?,?,?)", (current_user.id, car['id'], t, t + HOLD_SEC, t))
        _db.execute("UPDATE cars SET status='hold' WHERE id=?", (car['id'],))
        _db.commit()
        b = _db.execute('SELECT * FROM bookings WHERE id=?', (cur.lastrowid,)).fetchone()
    return jsonify({'booking': dict(b)})


def _own(bid):
    with _lock:
        b = _db.execute('SELECT * FROM bookings WHERE id=?', (bid,)).fetchone()
    if not b or b['user_id'] != int(current_user.id):
        return None
    return b


@app.post('/api/bookings/<int:bid>/start')
@login_required
def start(bid):
    b = _own(bid)
    if not b:
        return jsonify({'error': 'бронь не найдена'}), 404
    if b['status'] != 'hold':
        return jsonify({'error': 'старт возможен только из hold'}), 400
    body = request.get_json(silent=True) or {}
    with _lock:
        car = _db.execute('SELECT * FROM cars WHERE id=?', (b['car_id'],)).fetchone()
    if (body.get('code') or '') != car['code_current']:
        return jsonify({'error': 'неверный код из авто (спросите у админа в demo)'}), 400
    t = now()
    with _lock:
        _db.execute("UPDATE bookings SET status='active', started_at=?, last_tick=? WHERE id=?", (t, t, bid))
        _db.execute("UPDATE cars SET status='rent' WHERE id=?", (b['car_id'],))
        _db.commit()
        b = _db.execute('SELECT * FROM bookings WHERE id=?', (bid,)).fetchone()
    return jsonify({'booking': dict(b)})


@app.post('/api/bookings/<int:bid>/pause')
@login_required
def pause(bid):
    b = _own(bid)
    if not b or b['status'] != 'active':
        return jsonify({'error': 'пауза только из active'}), 400
    accrue(bid)
    with _lock:
        _db.execute("UPDATE bookings SET status='paused' WHERE id=?", (bid,))
        _db.commit()
        b = _db.execute('SELECT * FROM bookings WHERE id=?', (bid,)).fetchone()
    return jsonify({'booking': dict(b)})


@app.post('/api/bookings/<int:bid>/resume')
@login_required
def resume(bid):
    b = _own(bid)
    if not b or b['status'] != 'paused':
        return jsonify({'error': 'продолжить только из paused'}), 400
    accrue(bid)
    with _lock:
        _db.execute("UPDATE bookings SET status='active' WHERE id=?", (bid,))
        _db.commit()
        b = _db.execute('SELECT * FROM bookings WHERE id=?', (bid,)).fetchone()
    return jsonify({'booking': dict(b)})


@app.post('/api/bookings/<int:bid>/finish')
@login_required
def finish(bid):
    b = _own(bid)
    if not b:
        return jsonify({'error': 'не найдено'}), 404
    if b['status'] not in ('active', 'paused', 'hold'):
        return jsonify({'error': 'уже завершена'}), 400
    accrue(bid)
    with _lock:
        b = _db.execute('SELECT * FROM bookings WHERE id=?', (bid,)).fetchone()
        car = _db.execute('SELECT * FROM cars WHERE id=?', (b['car_id'],)).fetchone()
    drive_min = (b['drive_sec'] + 59) // 60
    pause_min = (b['pause_sec'] + 59) // 60
    total = drive_min * car['tariff_drive'] + pause_min * car['tariff_pause']
    t = now()
    with _lock:
        _db.execute("UPDATE bookings SET status='finished', finished_at=?, total_rub=? WHERE id=?", (t, total, bid))
        _db.execute('UPDATE cars SET status=?, code_current=? WHERE id=?',
                    ('free', str(random.randint(1000, 9999)), car['id']))
        _db.execute('UPDATE users SET balance=balance-? WHERE id=?', (total, current_user.id))
        _db.execute('INSERT INTO transactions(user_id,amount,reason,created_at) VALUES(?,?,?,?)',
                    (current_user.id, -total, f'поездка #{bid}: {drive_min} мин драйв + {pause_min} мин пауза', t))
        _db.commit()
        row = _db.execute('SELECT * FROM users WHERE id=?', (current_user.id,)).fetchone()
        b = _db.execute('SELECT * FROM bookings WHERE id=?', (bid,)).fetchone()
    return jsonify({'booking': dict(b), 'total': total, 'user': User(row).pub()})


@app.post('/api/bookings/<int:bid>/cancel')
@login_required
def cancel(bid):
    b = _own(bid)
    if not b or b['status'] != 'hold':
        return jsonify({'error': 'отмена только из hold'}), 400
    with _lock:
        _db.execute("UPDATE bookings SET status='cancelled' WHERE id=?", (bid,))
        _db.execute("UPDATE cars SET status='free' WHERE id=?", (b['car_id'],))
        _db.commit()
    return jsonify({'ok': True})


@app.get('/api/history')
@login_required
def history():
    with _lock:
        rows = [dict(r) for r in _db.execute(
            'SELECT b.*, c.model, c.plate FROM bookings b JOIN cars c ON c.id=b.car_id'
            ' WHERE b.user_id=? ORDER BY b.id DESC LIMIT 20', (current_user.id,)).fetchall()]
    return jsonify({'history': rows})


@app.get('/api/admin/stats')
@login_required
def admin_stats():
    if (r := admin_or_403()):
        return r
    with _lock:
        rev = _db.execute('SELECT COALESCE(SUM(-amount),0) FROM transactions WHERE amount<0').fetchone()[0]
        active = _db.execute("SELECT COUNT(*) FROM bookings WHERE status IN ('hold','active','paused')").fetchone()[0]
    return jsonify({'revenue': rev, 'active': active})


@app.get('/api/admin/bookings')
@login_required
def admin_bookings():
    if (r := admin_or_403()):
        return r
    with _lock:
        rows = [dict(r) for r in _db.execute(
            'SELECT b.*, u.phone, c.model FROM bookings b JOIN users u ON u.id=b.user_id'
            ' JOIN cars c ON c.id=b.car_id ORDER BY b.id DESC LIMIT 50').fetchall()]
    return jsonify({'bookings': rows})


@app.post('/api/admin/cars/<int:cid>')
@login_required
def admin_car(cid):
    if (r := admin_or_403()):
        return r
    body = request.get_json(silent=True) or {}
    with _lock:
        car = _db.execute('SELECT * FROM cars WHERE id=?', (cid,)).fetchone()
        if not car:
            return jsonify({'error': 'нет авто'}), 404
        _db.execute('UPDATE cars SET status=COALESCE(?,status), tariff_drive=COALESCE(?,tariff_drive),'
                    ' tariff_pause=COALESCE(?,tariff_pause), fuel=COALESCE(?,fuel),'
                    ' lat=COALESCE(?,lat), lng=COALESCE(?,lng) WHERE id=?',
                    (body.get('status'), body.get('tariff_drive'), body.get('tariff_pause'),
                     body.get('fuel'), body.get('lat'), body.get('lng'), cid))
        _db.commit()
        car = _db.execute('SELECT * FROM cars WHERE id=?', (cid,)).fetchone()
    return jsonify({'car': dict(car)})


@app.get('/')
def index():
    return send_from_directory(PUBLIC_DIR, 'index.html')


@app.get('/<path:filename>')
def static_files(filename):
    return send_from_directory(PUBLIC_DIR, filename)


if __name__ == '__main__':
    expire_holds()
    threading.Thread(target=expire_loop, daemon=True).start()
    print(f'Minutka Flask on http://localhost:{PORT}  demo +79990001122/demo123  admin +70000000000/admin123',
          flush=True)
    app.run(host='0.0.0.0', port=PORT, threaded=True)
