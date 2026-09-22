# Минутка — MVP поминутной аренды для локальной зоны

SaaS-прототип: пользовательское веб-приложение + админка + API с биллингом.

## Запуск
```
export PATH="$HOME/.local/share/node/bin:$PATH"
npm install
npm start
```
Открой http://localhost:3000

## Демо-доступ
- Пользователь: `+79990001122` / `demo123` (баланс 1000₽)
- Админ: `+70000000000` / `admin123`

## Сценарий MVP
1. Войди как пользователь, выбери свободное авто → Забронировать (hold 15 мин).
2. Открой `/admin.html`, посмотри код авто (эмуляция QR/сейфа).
3. В приложении введи код → Старт. Тариф 12₽/мин, пауза 3₽/мин.
4. Пауза → Продолжить → Завершить. Сумма спишется с баланса.
5. Пополнение — кнопка +500₽ (mock вместо ЮKassa).

## API
- POST /api/register, POST /api/login, GET /api/me, POST /api/topup
- GET /api/cars, POST /api/bookings, POST /api/bookings/:id/start|pause|resume|finish|cancel
- GET /api/my-active, GET /api/history
- GET /api/admin/stats, GET /api/admin/bookings, POST /api/admin/cars/:id

## Что дальше (не в MVP)
ЮKassa, верификация прав по фото, BLE/Телематика Teltonika, пуши, тарифы по зонам, скоринг.
