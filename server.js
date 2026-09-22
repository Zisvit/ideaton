import express from 'express';
import crypto from 'node:crypto';
import { db, sha256 } from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.SECRET || 'minutka-local-secret';
const HOLD_SEC = 15 * 60;

app.use(express.json());
app.use(express.static('public'));

const now = () => Math.floor(Date.now() / 1000);

function sign(data) {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
}
function makeToken(userId) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: now() + 86400 * 7 })).toString('base64url');
  return payload + '.' + sign(payload);
}
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'no token' });
  const [payload, sig] = token.split('.');
  if (!payload || !sig || sign(payload) !== sig) return res.status(401).json({ error: 'bad token' });
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.exp < now()) return res.status(401).json({ error: 'expired' });
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(data.uid);
    if (!user) return res.status(401).json({ error: 'no user' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'bad token' });
  }
}
function admin(req, res, next) {
  if (!req.user.is_admin) return res.status(403).json({ error: 'admin only' });
  next();
}

function expireHolds() {
  const t = now();
  const expired = db.prepare(`SELECT * FROM bookings WHERE status='hold' AND hold_until < ?`).all(t);
  for (const b of expired) {
    db.prepare(`UPDATE bookings SET status='cancelled' WHERE id=?`).run(b.id);
    db.prepare(`UPDATE cars SET status='free' WHERE id=?`).run(b.car_id);
  }
}
setInterval(expireHolds, 30000);
expireHolds();

function pubUser(u) {
  return { id: u.id, phone: u.phone, name: u.name, balance: u.balance, is_admin: !!u.is_admin, driver_verified: !!u.driver_verified };
}

app.post('/api/register', (req, res) => {
  const { phone, name = '', password } = req.body || {};
  if (!phone || !password) return res.status(400).json({ error: 'phone и password обязательны' });
  try {
    const r = db.prepare(`INSERT INTO users(phone,name,password_hash,balance,is_admin,driver_verified,created_at)
      VALUES(?,?,?,?,0,1,?)`).run(phone, name, sha256(password), 500, now());
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid);
    db.prepare('INSERT INTO transactions(user_id,amount,reason,created_at) VALUES(?,?,?,?)')
      .run(user.id, 500, 'стартовый бонус', now());
    res.json({ token: makeToken(user.id), user: pubUser(user) });
  } catch {
    res.status(400).json({ error: 'такой телефон уже зарегистрирован' });
  }
});

app.post('/api/login', (req, res) => {
  const { phone, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE phone=?').get(phone);
  if (!user || user.password_hash !== sha256(password || '')) {
    return res.status(401).json({ error: 'неверный телефон или пароль' });
  }
  res.json({ token: makeToken(user.id), user: pubUser(user) });
});

app.get('/api/me', auth, (req, res) => {
  res.json({ user: pubUser(req.user) });
});

app.post('/api/topup', auth, (req, res) => {
  const amount = Math.min(10000, Math.max(10, parseInt(req.body?.amount || 500)));
  db.prepare('UPDATE users SET balance=balance+? WHERE id=?').run(amount, req.user.id);
  db.prepare('INSERT INTO transactions(user_id,amount,reason,created_at) VALUES(?,?,?,?)')
    .run(req.user.id, amount, 'пополнение (mock)', now());
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  res.json({ user: pubUser(u) });
});

app.get('/api/cars', auth, (req, res) => {
  expireHolds();
  const cars = db.prepare('SELECT * FROM cars').all();
  res.json({ cars: cars.map(c => ({ ...c, code_current: req.user.is_admin ? c.code_current : undefined })) });
});

app.get('/api/my-active', auth, (req, res) => {
  const b = db.prepare(`SELECT b.*, c.model, c.plate, c.tariff_drive, c.tariff_pause
    FROM bookings b JOIN cars c ON c.id=b.car_id
    WHERE b.user_id=? AND b.status IN ('hold','active','paused') ORDER BY b.id DESC LIMIT 1`).get(req.user.id);
  res.json({ booking: b || null, now: now() });
});

app.post('/api/bookings', auth, (req, res) => {
  expireHolds();
  const { car_id } = req.body || {};
  const car = db.prepare('SELECT * FROM cars WHERE id=?').get(car_id);
  if (!car) return res.status(404).json({ error: 'авто не найдено' });
  if (car.status !== 'free') return res.status(400).json({ error: 'авто уже занято' });
  const has = db.prepare(`SELECT id FROM bookings WHERE user_id=? AND status IN ('hold','active','paused')`).get(req.user.id);
  if (has) return res.status(400).json({ error: 'у вас уже есть активная аренда' });
  if (req.user.balance < 50) return res.status(400).json({ error: 'пополните баланс (мин. 50 ₽)' });
  const t = now();
  const r = db.prepare(`INSERT INTO bookings(user_id,car_id,status,created_at,hold_until,last_tick)
    VALUES(?,?, 'hold',?,?,?)`).run(req.user.id, car_id, t, t + HOLD_SEC, t);
  db.prepare(`UPDATE cars SET status='hold' WHERE id=?`).run(car_id);
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(r.lastInsertRowid);
  res.json({ booking: b });
});

app.post('/api/bookings/:id/start', auth, (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);
  if (!b || b.user_id !== req.user.id) return res.status(404).json({ error: 'бронь не найдена' });
  if (b.status !== 'hold') return res.status(400).json({ error: 'старт возможен только из hold' });
  const car = db.prepare('SELECT * FROM cars WHERE id=?').get(b.car_id);
  if ((req.body?.code || '') !== car.code_current) {
    return res.status(400).json({ error: 'неверный код из авто (спросите у админа в demo)' });
  }
  const t = now();
  db.prepare(`UPDATE bookings SET status='active', started_at=?, last_tick=? WHERE id=?`).run(t, t, b.id);
  db.prepare(`UPDATE cars SET status='rent' WHERE id=?`).run(b.car_id);
  res.json({ booking: db.prepare('SELECT * FROM bookings WHERE id=?').get(b.id) });
});

function accrue(b) {
  const t = now();
  const dt = Math.max(0, t - b.last_tick);
  if (b.status === 'active') {
    db.prepare('UPDATE bookings SET drive_sec=drive_sec+?, last_tick=? WHERE id=?').run(dt, t, b.id);
  } else if (b.status === 'paused') {
    db.prepare('UPDATE bookings SET pause_sec=pause_sec+?, last_tick=? WHERE id=?').run(dt, t, b.id);
  }
}

app.post('/api/bookings/:id/pause', auth, (req, res) => {
  let b = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);
  if (!b || b.user_id !== req.user.id || b.status !== 'active') return res.status(400).json({ error: 'пауза только из active' });
  accrue(b);
  db.prepare(`UPDATE bookings SET status='paused' WHERE id=?`).run(b.id);
  res.json({ booking: db.prepare('SELECT * FROM bookings WHERE id=?').get(b.id) });
});

app.post('/api/bookings/:id/resume', auth, (req, res) => {
  let b = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);
  if (!b || b.user_id !== req.user.id || b.status !== 'paused') return res.status(400).json({ error: 'продолжить только из paused' });
  accrue(b);
  db.prepare(`UPDATE bookings SET status='active' WHERE id=?`).run(b.id);
  res.json({ booking: db.prepare('SELECT * FROM bookings WHERE id=?').get(b.id) });
});

app.post('/api/bookings/:id/finish', auth, (req, res) => {
  let b = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);
  if (!b || b.user_id !== req.user.id) return res.status(404).json({ error: 'не найдено' });
  if (!['active', 'paused', 'hold'].includes(b.status)) return res.status(400).json({ error: 'уже завершена' });
  accrue(b);
  b = db.prepare('SELECT * FROM bookings WHERE id=?').get(b.id);
  const car = db.prepare('SELECT * FROM cars WHERE id=?').get(b.car_id);
  const driveMin = Math.ceil(b.drive_sec / 60);
  const pauseMin = Math.ceil(b.pause_sec / 60);
  const total = driveMin * car.tariff_drive + pauseMin * car.tariff_pause + (b.status === 'hold' ? 0 : 0);
  const t = now();
  db.prepare(`UPDATE bookings SET status='finished', finished_at=?, total_rub=? WHERE id=?`).run(t, total, b.id);
  db.prepare(`UPDATE cars SET status='free', code_current=? WHERE id=?`)
    .run(String(Math.floor(1000 + Math.random() * 9000)), car.id);
  db.prepare('UPDATE users SET balance=balance-? WHERE id=?').run(total, req.user.id);
  db.prepare('INSERT INTO transactions(user_id,amount,reason,created_at) VALUES(?,?,?,?)')
    .run(req.user.id, -total, `поездка #${b.id}: ${driveMin} мин драйв + ${pauseMin} мин пауза`, t);
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  res.json({ booking: db.prepare('SELECT * FROM bookings WHERE id=?').get(b.id), total, user: pubUser(u) });
});

app.post('/api/bookings/:id/cancel', auth, (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);
  if (!b || b.user_id !== req.user.id || b.status !== 'hold') return res.status(400).json({ error: 'отмена только из hold' });
  db.prepare(`UPDATE bookings SET status='cancelled' WHERE id=?`).run(b.id);
  db.prepare(`UPDATE cars SET status='free' WHERE id=?`).run(b.car_id);
  res.json({ ok: true });
});

app.get('/api/history', auth, (req, res) => {
  const rows = db.prepare(`SELECT b.*, c.model, c.plate FROM bookings b
    JOIN cars c ON c.id=b.car_id WHERE b.user_id=? ORDER BY b.id DESC LIMIT 20`).all(req.user.id);
  res.json({ history: rows });
});

app.get('/api/admin/stats', auth, admin, (req, res) => {
  const rev = db.prepare(`SELECT COALESCE(SUM(-amount),0) as s FROM transactions WHERE amount<0`).get();
  const active = db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE status IN ('hold','active','paused')`).get();
  const cars = db.prepare(`SELECT COUNT(*) as c FROM cars`).all?.() ?? [];
  res.json({ revenue: rev.s, active: active.c });
});

app.get('/api/admin/bookings', auth, admin, (req, res) => {
  const rows = db.prepare(`SELECT b.*, u.phone, c.model FROM bookings b
    JOIN users u ON u.id=b.user_id JOIN cars c ON c.id=b.car_id ORDER BY b.id DESC LIMIT 50`).all();
  res.json({ bookings: rows });
});

app.post('/api/admin/cars/:id', auth, admin, (req, res) => {
  const { status, tariff_drive, tariff_pause, fuel, lat, lng } = req.body || {};
  const car = db.prepare('SELECT * FROM cars WHERE id=?').get(req.params.id);
  if (!car) return res.status(404).json({ error: 'нет авто' });
  db.prepare(`UPDATE cars SET status=COALESCE(?,status), tariff_drive=COALESCE(?,tariff_drive),
    tariff_pause=COALESCE(?,tariff_pause), fuel=COALESCE(?,fuel),
    lat=COALESCE(?,lat), lng=COALESCE(?,lng) WHERE id=?`)
    .run(status ?? null, tariff_drive ?? null, tariff_pause ?? null, fuel ?? null, lat ?? null, lng ?? null, car.id);
  res.json({ car: db.prepare('SELECT * FROM cars WHERE id=?').get(car.id) });
});

app.listen(PORT, () => console.log(`Minutka MVP on http://localhost:${PORT}  demo +79990001122/demo123  admin +70000000000/admin123`));
