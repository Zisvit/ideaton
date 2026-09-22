import { spawn } from 'node:child_process';

const PORT = 3131;
const BASE = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let srvLog = '';
srv.stdout.on('data', d => { srvLog += d; });
srv.stderr.on('data', d => { srvLog += '[ERR] ' + d; });
srv.on('error', e => { console.error('spawn error:', e.message); process.exit(2); });

async function waitUp(tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(BASE + '/');
      if (r.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  console.error('SRV LOG:', srvLog);
  throw new Error('server not up');
}

async function req(path, token, body) {
  const r = await fetch(BASE + path, {
    method: body !== undefined ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra = '') {
  if (cond) { pass++; }
  else { fail++; failures.push(`${name} ${extra}`); console.error('FAIL:', name, extra); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

let code = 1;
try {
  await waitUp();
  console.log('server up');

  // ---------- Phase A: edge cases ----------
  const demo = await req('/api/login', null, { phone: '+79990001122', password: 'demo123' });
  check('A1 demo login', demo.status === 200 && !!demo.body.token);
  const dTok = demo.body.token;

  const bad = await req('/api/login', null, { phone: '+79990001122', password: 'wrong' });
  check('A2 wrong password -> 401', bad.status === 401);

  const dup = await req('/api/register', null, { phone: '+79990001122', name: 'x', password: 'y' });
  check('A3 duplicate register -> 400', dup.status === 400);

  const noAuth = await req('/api/cars', null);
  check('A4 no token -> 401', noAuth.status === 401);

  const badTok = await req('/api/cars', 'bad.token.here');
  check('A5 bad token -> 401', badTok.status === 401);

  const nonAdmin = await req('/api/admin/stats', dTok);
  check('A6 non-admin stats -> 403', nonAdmin.status === 403);

  const noCar = await req('/api/bookings', dTok, { car_id: 99999 });
  check('A7 book missing car -> 404', noCar.status === 404);

  const { body: { cars } } = await req('/api/cars', dTok);
  const car1 = cars[0];
  const hold1 = await req('/api/bookings', dTok, { car_id: car1.id });
  check('A8 hold ok', hold1.status === 200);
  const hid = hold1.body.booking?.id;

  const doubleHold = await req('/api/bookings', dTok, { car_id: cars[1].id });
  check('A9 second active booking blocked -> 400', doubleHold.status === 400);

  const wrongCode = await req(`/api/bookings/${hid}/start`, dTok, { code: '0000-бред' });
  check('A10 wrong code -> 400', wrongCode.status === 400);

  const pauseFromHold = await req(`/api/bookings/${hid}/pause`, dTok, {});
  check('A11 pause from hold -> 400', pauseFromHold.status === 400);

  const admin = await req('/api/login', null, { phone: '+70000000000', password: 'admin123' });
  const aTok = admin.body.token;
  const acars = await req('/api/cars', aTok);
  const realCode = acars.body.cars.find(c => c.id === car1.id).code_current;
  check('A12 admin sees code', typeof realCode === 'string' && realCode.length === 4);
  const userView = await req('/api/cars', dTok);
  check('A13 user does NOT see code', userView.body.cars.find(c => c.id === car1.id).code_current === undefined);

  const start = await req(`/api/bookings/${hid}/start`, dTok, { code: realCode });
  check('A14 start with code ok', start.status === 200);

  const resumeFromActive = await req(`/api/bookings/${hid}/resume`, dTok, {});
  check('A15 resume from active -> 400', resumeFromActive.status === 400);

  await req(`/api/bookings/${hid}/pause`, dTok, {});
  const pauseAgain = await req(`/api/bookings/${hid}/pause`, dTok, {});
  check('A16 double pause -> 400', pauseAgain.status === 400);
  await req(`/api/bookings/${hid}/resume`, dTok, {});
  const fin1 = await req(`/api/bookings/${hid}/finish`, dTok, {});
  check('A17 finish ok', fin1.status === 200);
  const b1 = fin1.body.booking;
  const exp1 = Math.ceil(b1.drive_sec / 60) * 12 + Math.ceil(b1.pause_sec / 60) * 3;
  check('A18 billing math', fin1.body.total === exp1, `total=${fin1.body.total} exp=${exp1} d=${b1.drive_sec}s p=${b1.pause_sec}s`);

  const finAgain = await req(`/api/bookings/${hid}/finish`, dTok, {});
  check('A19 double finish -> 400', finAgain.status === 400);

  // cancel path
  const hold2 = await req('/api/bookings', dTok, { car_id: cars[2].id });
  const cancel = await req(`/api/bookings/${hold2.body.booking.id}/cancel`, dTok, {});
  check('A20 cancel hold ok', cancel.status === 200);
  const carsAfter = await req('/api/cars', dTok);
  check('A21 car free after cancel', carsAfter.body.cars.find(c => c.id === cars[2].id).status === 'free');

  // topup
  const me0 = await req('/api/me', dTok);
  const top = await req('/api/topup', dTok, { amount: 500 });
  check('A22 topup +500', top.body.user.balance === me0.body.user.balance + 500);

  // ---------- Phase B: 50 rental cycles ----------
  console.log('Phase B: 50 cycles...');
  let billingFails = 0, balanceFails = 0;
  for (let i = 0; i < 50; i++) {
    const phone = `+7900000${String(1000 + i)}`;
    const reg = await req('/api/register', null, { phone, name: `U${i}`, password: 'pw123456' });
    if (reg.status !== 200) { check(`B${i} register`, false, JSON.stringify(reg.body)); continue; }
    const tok = reg.body.token;
    const startBal = reg.body.user.balance; // 500 bonus
    const cl = await req('/api/cars', tok);
    const free = cl.body.cars.filter(c => c.status === 'free');
    if (!free.length) { check(`B${i} free car exists`, false, 'no free cars'); continue; }
    const car = free[i % free.length];
    const h = await req('/api/bookings', tok, { car_id: car.id });
    if (h.status !== 200) { check(`B${i} hold`, false, JSON.stringify(h.body)); continue; }
    const bid = h.body.booking.id;
    const ac = await req('/api/cars', aTok);
    const codeCur = ac.body.cars.find(c => c.id === car.id).code_current;
    const st = await req(`/api/bookings/${bid}/start`, tok, { code: codeCur });
    if (st.status !== 200) { check(`B${i} start`, false, JSON.stringify(st.body)); continue; }
    await sleep(1100);
    // even iterations use pause, odd go straight to finish
    if (i % 2 === 0) {
      await req(`/api/bookings/${bid}/pause`, tok, {});
      await sleep(1100);
      await req(`/api/bookings/${bid}/resume`, tok, {});
    }
    const f = await req(`/api/bookings/${bid}/finish`, tok, {});
    if (f.status !== 200) { check(`B${i} finish`, false, JSON.stringify(f.body)); continue; }
    const bb = f.body.booking;
    const exp = Math.ceil(bb.drive_sec / 60) * car.tariff_drive + Math.ceil(bb.pause_sec / 60) * car.tariff_pause;
    if (f.body.total !== exp) { billingFails++; failures.push(`B${i} billing total=${f.body.total} exp=${exp}`); fail++; }
    else pass++;
    if (f.body.user.balance !== startBal - exp) { balanceFails++; failures.push(`B${i} balance ${f.body.user.balance} != ${startBal - exp}`); fail++; }
    else pass++;
    if ((i + 1) % 10 === 0) console.log(`  ...${i + 1}/50 done`);
  }
  console.log(`Phase B done: billingFails=${billingFails} balanceFails=${balanceFails}`);

  // ---------- Phase C: concurrency ----------
  console.log('Phase C: concurrency...');
  const racers = [];
  for (let i = 0; i < 8; i++) {
    const r = await req('/api/register', null, { phone: `+7900099${100 + i}`, name: `R${i}`, password: 'pw123456' });
    racers.push(r.body.token);
  }
  const cl2 = await req('/api/cars', aTok);
  const target = cl2.body.cars.find(c => c.status === 'free');
  const results = await Promise.all(racers.map(t => req('/api/bookings', t, { car_id: target.id })));
  const okCount = results.filter(r => r.status === 200).length;
  check('C1 exactly 1 winner of 8 parallel books', okCount === 1, `winners=${okCount}`);
  const winner = results.find(r => r.status === 200);
  if (winner) await req(`/api/bookings/${winner.body.booking.id}/cancel`, racers[results.indexOf(winner)], {});
  const cl3 = await req('/api/cars', aTok);
  check('C2 car free after winner cancel', cl3.body.cars.find(c => c.id === target.id).status === 'free');

  console.log(`\nRESULT: pass=${pass} fail=${fail}`);
  if (fail === 0) { console.log('ALL 50+ TESTS PASS'); code = 0; }
  else { console.log('FAILURES:'); failures.forEach(f => console.log(' -', f)); }
} catch (e) {
  console.error('HARNESS ERROR:', e.message);
} finally {
  srv.kill();
  setTimeout(() => process.exit(code), 500);
}
