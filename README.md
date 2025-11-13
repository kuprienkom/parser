# Price Watcher Service

Автономный сервис мониторинга скидок для магазинов M.Video и Эльдорадо. Сервис использует Playwright для парсинга веб-страниц, MongoDB для хранения данных и Telegram-бота для уведомлений о выгодных предложениях.

## Возможности
- Периодический парсинг выбранных категорий товаров по расписанию.
- Поддержка нескольких городов.
- Хранение истории цен и скидок в MongoDB.
- Отправка уведомлений в Telegram при обнаружении новых скидок или росте существующих.

## Стек
- Node.js (LTS)
- Playwright (Chromium)
- MongoDB + mongoose
- Telegraf
- node-cron
- dotenv

## Подготовка окружения
1. Установите зависимости: `npm install`.
2. Установите браузеры Playwright (одноразово): `npx playwright install chromium`.
3. Скопируйте `.env.example` в `.env` и укажите собственные значения переменных.

### Пример `.env`
```
MONGODB_URI=mongodb://localhost:27017/priceWatcher
TELEGRAM_BOT_TOKEN=123456:ABC-DEF
TELEGRAM_CHAT_ID=-1001234567890
MIN_DISCOUNT=30
CRON_SCHEDULE=*/15 * * * *
# необязательно: переопределите города или URL категорий
# CITIES=Санкт-Петербург,Москва
# MVIDEO_CATEGORY_URL_SMARTPHONES=https://www.mvideo.ru/smartfony-i-svyaz/smartfony-205
# ELDORADO_CATEGORY_URL_SMARTPHONES=https://www.eldorado.ru/c/smartfony-i-svyaz/smartfony/
```

По умолчанию сервис мониторит весь основной каталог M.Video и Эльдорадо по Санкт-Петербургу — список разделов задан в `src/defaults.js`.

## Структура проекта
```
price-watcher/
├── src/
│   ├── bot.js
│   ├── config.js
│   ├── defaults.js
│   ├── db.js
│   ├── index.js
│   ├── logger.js
│   ├── monitor.js
│   └── scrapers/
│       ├── base.js
│       ├── eldorado.js
│       └── mvideo.js
├── package.json
├── README.md
└── price_watcher_tech_spec.docx
```

## Запуск
1. Запустите MongoDB (локально или в облаке) и убедитесь, что URI указан в `.env`.
2. Заполните `.env` токеном Telegram-бота и целевым чат-ID (если не сделали ранее).
3. Запустите сервис: `npm start`.

После запуска сервис выполнит первый проход парсинга сразу, а затем будет запускать мониторинг по расписанию из переменной `CRON_SCHEDULE`. Для единичного запуска без расписания можно выполнить `npm run once`.

## Примечания по разработке
- Селекторы и URL категорий для магазинов вынесены в конфигурацию. При необходимости можно дополнить `.env` собственными категориями, они будут объединены с базовым набором из `src/defaults.js`.
- Скраперы реализуют общий пайплайн Playwright: установка города, загрузка категории, ожидание карточек и преобразование данных.
- Логи выводятся в стандартный вывод; при необходимости интегрируйте любой JSON-логгер.
