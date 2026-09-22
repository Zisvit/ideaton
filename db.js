import { DatabaseSync } from 'node:sqlite';
import { createHash, randomInt } from 'node:crypto';

export const db = new DatabaseSync(process.env.DB_PATH || './data.db');

db.exec(`
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
  total_rub INTEGER DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(car_id) REFERENCES cars(id)
);
CREATE TABLE IF NOT EXISTS transactions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
`);

export function sha256(s) {
  return createHash('sha256').update(s).digest('hex');
}

const now = () => Math.floor(Date.now() / 1000);

function seed() {
  const u = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (u.c > 0) return;
  db.prepare(`INSERT INTO users(phone,name,password_hash,balance,is_admin,driver_verified,created_at)
    VALUES(?,?,?,?,?,?,?)`).run('+70000000000', 'Админ', sha256('admin123'), 0, 1, 1, now());
  db.prepare(`INSERT INTO users(phone,name,password_hash,balance,is_admin,driver_verified,created_at)
    VALUES(?,?,?,?,?,?,?)`).run('+79990001122', 'Демо', sha256('demo123'), 1000, 0, 1, now());

  const cars = [
    ['Lada Granta', 'А111АА116', 55.7887, 49.1221],
    ['Kia Rio', 'В222ВВ116', 55.7895, 49.1240],
    ['Hyundai Solaris', 'С333СС116', 55.7875, 49.1205],
    ['Chery Tiggo', 'Е444ЕЕ116', 55.7900, 49.1210],
    ['Moskvich 3e (электро)', 'К555КК116', 55.7880, 49.1255],
  ];
  const ins = db.prepare(`INSERT INTO cars(model,plate,lat,lng,status,fuel,tariff_drive,tariff_pause,code_current)
    VALUES(?,?,?,?,?,?,?,?,?)`);
  for (const [model, plate, lat, lng] of cars) {
    ins.run(model, plate, lat, lng, 'free', 60 + randomInt(40), 12, 3, String(randomInt(1000, 9999)));
  }
  console.log('seed: admin +70000000000/admin123, demo +79990001122/demo123');
}
seed();
