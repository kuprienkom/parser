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
2. Создайте файл `.env` на основе примера ниже.

### Пример `.env`
```
MONGODB_URI=mongodb+srv://user:pass@host/db
TELEGRAM_BOT_TOKEN=123456:ABC-DEF
TELEGRAM_CHAT_ID=-1001234567890
MIN_DISCOUNT=30
CRON_SCHEDULE=*/15 * * * *
CITIES=Санкт-Петербург,Москва

# Примеры URL категорий (добавьте свои при необходимости)
MVIDEO_CATEGORY_URL_SMARTPHONES=https://www.mvideo.ru/smartfony-i-svyaz/smartfony-205
ELDORADO_CATEGORY_URL_SMARTPHONES=https://www.eldorado.ru/c/tehnika-dlya-doma/smartfony/
```

## Структура проекта
```
price-watcher/
├── src/
│   ├── bot.js
│   ├── config.js
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
2. Заполните `.env` токеном Telegram-бота и целевым чат-ID.
3. Запустите сервис: `npm start`.

После запуска сервис выполнит первый проход парсинга сразу, а затем будет запускать мониторинг по расписанию из переменной `CRON_SCHEDULE`.

## Примечания по разработке
- Селекторы и URL категорий для магазинов вынесены в конфигурацию, поэтому при изменении DOM сайтов достаточно обновить значения в `.env`.
- Скраперы реализуют общий пайплайн Playwright: установка города, загрузка категории, ожидание карточек и преобразование данных.
- Логи выводятся в стандартный вывод; при необходимости интегрируйте любой JSON-логгер.
