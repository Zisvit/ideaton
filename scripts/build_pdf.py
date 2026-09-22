import os

from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'presentation.pdf')
W, H = 960, 540

pdfmetrics.registerFont(TTFont('Sans', '/usr/share/fonts/noto/NotoSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SansB', '/usr/share/fonts/noto/NotoSans-Bold.ttf'))

BG = HexColor('#0c0f14')
PANEL = HexColor('#151a23')
LINE = HexColor('#262e3d')
TXT = HexColor('#eef1f6')
MUT = HexColor('#9aa3b2')
GRN = HexColor('#22c55e')
LGRN = HexColor('#4ade80')
AMB = HexColor('#f59e0b')


def bg(c):
    c.setFillColor(BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(GRN)
    c.rect(0, H - 6, W, 6, fill=1, stroke=0)


def foot(c, n):
    c.setFont('Sans', 11)
    c.setFillColor(MUT)
    c.drawString(40, 26, 'Минутка · Сургут')
    c.drawRightString(W - 40, 26, f'{n}/8 · ~5 мин')


def title(c, kicker, head, sub=None):
    c.setFont('SansB', 20)
    c.setFillColor(GRN)
    c.drawString(60, H - 90, kicker)
    c.setFont('SansB', 44)
    c.setFillColor(TXT)
    c.drawString(60, H - 150, head)
    if sub:
        c.setFont('Sans', 18)
        c.setFillColor(MUT)
        c.drawString(60, H - 185, sub)


def bullets(c, items, y0=330, gap=52):
    y = y0
    for head, sub in items:
        c.setFillColor(GRN)
        c.circle(78, y + 5, 6, fill=1, stroke=0)
        c.setFont('SansB', 19)
        c.setFillColor(TXT)
        c.drawString(100, y, head)
        c.setFont('Sans', 15)
        c.setFillColor(MUT)
        c.drawString(100, y - 24, sub)
        y -= gap


def pricebar(c, x, y, w, h, frac, label):
    c.setFillColor(PANEL)
    c.setStrokeColor(LINE)
    c.roundRect(x, y, w, h, 8, fill=1, stroke=1)
    c.setFillColor(GRN)
    c.roundRect(x + 3, y + 3, (w - 6) * frac, h - 6, 5, fill=1, stroke=0)
    c.setFont('SansB', 14)
    c.setFillColor(TXT)
    c.drawString(x + 12, y + h + 8, label)


c = canvas.Canvas(OUT, pagesize=(W, H))
c.setTitle('Минутка — поминутная аренда авто, Сургут')
c.setAuthor('Minutka')

# 1. Титул
bg(c)
c.setFillColor(GRN)
c.roundRect(60, H - 260, 84, 84, 20, fill=1, stroke=0)
c.setFont('SansB', 56)
c.setFillColor(HexColor('#06270f'))
c.drawCentredString(102, H - 202, 'M')
c.setFont('SansB', 64)
c.setFillColor(TXT)
c.drawString(170, H - 220, 'Минутка')
c.setFont('Sans', 24)
c.setFillColor(MUT)
c.drawString(172, H - 260, 'Поминутная аренда авто · Сургут')
c.setFont('SansB', 20)
c.setFillColor(LGRN)
c.drawString(60, 170, 'Авто у подъезда — бери на минуты, плати только за поездку')
c.setFont('Sans', 15)
c.setFillColor(MUT)
c.drawString(60, 130, 'Пилот: ЖК / кампус / курорт · 3–5 авто · запуск за неделю')
c.drawString(60, 100, 'Демо: +79990001122 / demo123')
foot(c, 1)
c.showPage()

# 2. Проблема
bg(c)
title(c, 'ПРОБЛЕМА', 'Такси дорого,', 'своя машина — ещё дороже')
bullets(c, [
    ('В ЖК и кампусах нет каршеринга', 'Гиганты работают только в миллионниках'),
    ('Такси в час пик ×2–×3', 'Погода и спрос решают цену за тебя'),
    ('Своё авто = стоянка + страховка + ремонт', 'Стоит даже когда стоит'),
])
foot(c, 2)
c.showPage()

# 3. Решение
bg(c)
title(c, 'РЕШЕНИЕ', 'Авто рядом. Три шага.', 'тариф 12 ₽/мин · пауза 3 ₽/мин')
steps = [('1. Бронь', '15 минут бесплатно'), ('2. Код', 'QR / сейф в авто'), ('3. Езда', 'пауза · завершить')]
x = 70
for head, sub in steps:
    c.setFillColor(PANEL)
    c.setStrokeColor(LINE)
    c.roundRect(x, 120, 250, 170, 14, fill=1, stroke=1)
    c.setFont('SansB', 26)
    c.setFillColor(GRN)
    c.drawString(x + 24, 240, head)
    c.setFont('Sans', 16)
    c.setFillColor(MUT)
    c.drawString(x + 24, 205, sub)
    x += 275
foot(c, 3)
c.showPage()

# 4. Продукт
bg(c)
title(c, 'ПРОДУКТ', 'Приложение уже работает')
c.setFillColor(PANEL)
c.setStrokeColor(LINE)
c.roundRect(60, 60, 220, 380, 24, fill=1, stroke=1)
c.setFillColor(HexColor('#0f141c'))
c.roundRect(76, 200, 188, 200, 12, fill=1, stroke=0)
c.setStrokeColor(GRN)
c.circle(170, 300, 60, fill=0, stroke=1)
for dx, dy, col in [(-30, 10, GRN), (25, -25, GRN), (40, 30, AMB), (-10, -40, GRN), (0, 55, HexColor('#ef4444'))]:
    c.setFillColor(col)
    c.circle(170 + dx, 300 + dy, 7, fill=1, stroke=0)
c.setFont('SansB', 15)
c.setFillColor(TXT)
c.drawCentredString(170, 150, 'Сургут · 5 авто')
c.setFont('Sans', 13)
c.setFillColor(MUT)
c.drawCentredString(170, 125, '≈ 15₽ · тикер цены')
c.setFont('SansB', 17)
c.setFillColor(TXT)
y = 400
for t in ['Живой тикер цены и времени', 'PWA: установка на телефон', 'Тёмная / светлая / авто-тема', 'Админка: коды, тарифы, выручка']:
    c.setFillColor(GRN)
    c.circle(330, y, 5, fill=1, stroke=0)
    c.setFont('Sans', 18)
    c.setFillColor(TXT)
    c.drawString(350, y - 6, t)
    y -= 48
foot(c, 4)
c.showPage()

# 5. Технологии
bg(c)
title(c, 'ТЕХНОЛОГИИ', 'Python-only стек')
tech = [('Python + Flask 3', 'бэкенд без зоопарка зависимостей'), ('Flask-Login + SQLite', 'сессии в куках, база в одном файле'),
        ('HTML/CSS/JS + Leaflet', 'фронт без сборки, карта OSM'), ('Тесты: 722 проверки', 'e2e + стресс 100 циклов — всё зелёное')]
bullets(c, tech, y0=340, gap=56)
foot(c, 5)
c.showPage()

# 6. Бизнес-модель
bg(c)
title(c, 'БИЗНЕС', 'SaaS для локальных зон')
bullets(c, [
    ('Клиент: УК, отель, вуз, завод', 'Белый лейбл под их территорию'),
    ('Доход: подписка + % с поездок', 'Оператор получает автопарк без разработки'),
    ('Юнит-экономика держится', 'см. расчёт ниже'),
], y0=350, gap=52)
pricebar(c, 70, 90, 800, 26, 0.72, '5 авто × 3 ч/день × 12 ₽/мин ≈ 10 800 ₽/день выручки')
c.setFont('Sans', 14)
c.setFillColor(MUT)
c.drawString(70, 62, 'Оценка сверху для пилота; net — после топлива, мойки и связи')
foot(c, 6)
c.showPage()

# 7. Пилот
bg(c)
title(c, 'ПИЛОТ · СУРГУТ', '6–8 недель до первых поездок')
weeks = [('1–2', '3–5 авто, номера 86'), ('3–4', 'зона + 30 тестеров'), ('5–6', 'тарифы, поддержка'), ('7–8', 'запуск, метрики')]
x = 70
for w, t in weeks:
    c.setFillColor(PANEL)
    c.setStrokeColor(GRN)
    c.roundRect(x, 140, 190, 150, 14, fill=1, stroke=1)
    c.setFont('SansB', 24)
    c.setFillColor(LGRN)
    c.drawString(x + 20, 245, 'Нед. ' + w)
    c.setFont('Sans', 14)
    c.setFillColor(TXT)
    c.drawString(x + 20, 215, t.split(', ')[0])
    if ', ' in t:
        c.drawString(x + 20, 192, t.split(', ')[1])
    x += 210
foot(c, 7)
c.showPage()

# 8. CTA
bg(c)
title(c, 'ДАЛЕЕ', 'Запустить за неделю')
qr = QrCodeWidget('https://github.com/Zisvit/ideaton')
d = Drawing(180, 180)
qr.barHeight = 180
qr.barWidth = 180
d.add(qr)
d.drawOn(c, 70, 120)
c.setFont('Sans', 15)
c.setFillColor(MUT)
c.drawString(70, 95, 'Код и демо — в репозитории')
c.setFont('SansB', 22)
c.setFillColor(TXT)
c.drawString(300, 300, 'Нужно от вас:')
c.setFont('Sans', 19)
c.setFillColor(TXT)
y = 260
for t in ['5 авто + стоянка в Сургуте', '30 тестеров с правами', '“Давай” — остальное мы берём на себя']:
    c.setFillColor(GRN)
    c.circle(315, y, 5, fill=1, stroke=0)
    c.setFont('Sans', 19)
    c.setFillColor(TXT)
    c.drawString(335, y - 6, t)
    y -= 44
c.setFont('SansB', 20)
c.setFillColor(LGRN)
c.drawString(300, 100, 'Минутка. Поехали?')
foot(c, 8)
c.showPage()

c.save()
print('saved', OUT)
