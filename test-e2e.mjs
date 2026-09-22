import { spawn } from 'node:child_process';

const PORT = 3101;
const BASE = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
srv.stdout.on('data', d => process.stdout.write('[srv] ' + d));
srv.stderr.on('data', d => process.stderr.write('[srv-err] ' + d));

async function waitUp(tries = 30) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(BASE + '/');
      if (r.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error('server not up');
}

async function api(path, token, body) {
  const r = await fetch(BASE + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${path} -> ${JSON.stringify(j)}`);
  return j;
}

let code = 0;
try {
  await waitUp();
  console.log('UP ok');
  const demo = await api('/api/login', null, { phone: '+79990001122', password: 'demo123' });
  const admin = await api('/api/login', null, { phone: '+70000000000', password: 'admin123' });
  console.log('login ok, balance:', demo.user.balance);
  const { cars } = await api('/api/cars', demo.token);
  const free = cars.find(c => c.status === 'free');
  if (!free) throw new Error('no free cars');
  console.log('booking car:', free.model, free.plate);
  const { booking: hold } = await api('/api/bookings', demo.token, { car_id: free.id });
  console.log('hold ok:', hold.id);
  const adminCars = await api('/api/cars', admin.token);
  const target = adminCars.cars.find(c => c.id === free.id);
  console.log('code:', target.code_current);
  await api(`/api/bookings/${hold.id}/start`, demo.token, { code: target.code_current });
  console.log('start ok');
  await new Promise(r => setTimeout(r, 2500));
  await api(`/api/bookings/${hold.id}/pause`, demo.token, {});
  console.log('pause ok');
  await api(`/api/bookings/${hold.id}/resume`, demo.token, {});
  console.log('resume ok');
  await new Promise(r => setTimeout(r, 1500));
  const fin = await api(`/api/bookings/${hold.id}/finish`, demo.token, {});
  console.log('finish ok, total:', fin.total, 'new balance:', fin.user.balance);
  const hist = await api('/api/history', demo.token);
  console.log('history len:', hist.history.length);
  const stats = await api('/api/admin/stats', admin.token);
  console.log('admin revenue:', stats.revenue, 'active:', stats.active);
  console.log('E2E PASS');
  code = 0;
} catch (e) {
  console.error('E2E FAIL:', e.message);
  code = 1;
} finally {
  srv.kill();
  setTimeout(() => process.exit(code), 500);
}
