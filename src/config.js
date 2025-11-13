const path = require("path");
const dotenv = require("dotenv");
const { logger } = require("./logger");

dotenv.config({ path: process.env.CONFIG_PATH || path.resolve(process.cwd(), ".env") });

const requiredVars = ["MONGODB_URI", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"];
const missing = requiredVars.filter((key) => !process.env[key] || process.env[key].trim().length === 0);

if (missing.length > 0) {
  logger.error("Missing required environment variables", { missing });
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseCities(value) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((city) => city.trim())
    .filter(Boolean);
}

function parseCategoryUrls() {
  const result = { mvideo: {}, eldorado: {} };

  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;

    if (key.startsWith("MVIDEO_CATEGORY_URL_")) {
      const category = key.replace("MVIDEO_CATEGORY_URL_", "").toLowerCase();
      result.mvideo[category] = value;
    }

    if (key.startsWith("ELDORADO_CATEGORY_URL_")) {
      const category = key.replace("ELDORADO_CATEGORY_URL_", "").toLowerCase();
      result.eldorado[category] = value;
    }
  }

  return result;
}

const config = {
  mongodbUri: process.env.MONGODB_URI,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  minDiscount: parseNumber(process.env.MIN_DISCOUNT, 30),
  cronSchedule: process.env.CRON_SCHEDULE || "*/15 * * * *",
  cities: parseCities(process.env.CITIES),
  categoryUrls: parseCategoryUrls(),
  playwright: {
    headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
    slowMo: parseNumber(process.env.PLAYWRIGHT_SLOWMO, undefined),
  },
};

if (config.cities.length === 0) {
  logger.warn("No cities configured. Provide CITIES in .env to enable per-city monitoring.");
}

module.exports = config;
