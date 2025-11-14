const path = require("path");
const dotenv = require("dotenv");
const { logger } = require("./logger");
const { DEFAULT_CITIES, DEFAULT_CATEGORY_URLS } = require("./defaults");

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

function resolveCities() {
  const parsed = parseCities(process.env.CITIES);

  if (parsed.length === 0) {
    logger.warn("No cities configured in .env; falling back to default city list", {
      fallback: DEFAULT_CITIES,
    });
    return DEFAULT_CITIES;
  }

  return parsed;
}

function resolveCategoryUrls() {
  const parsed = parseCategoryUrls();

  const merged = {
    mvideo: { ...DEFAULT_CATEGORY_URLS.mvideo, ...parsed.mvideo },
    eldorado: { ...DEFAULT_CATEGORY_URLS.eldorado, ...parsed.eldorado },
  };

  if (Object.keys(parsed.mvideo).length === 0) {
    logger.warn("No M.Video categories configured; using default category set", {
      fallbackCount: Object.keys(DEFAULT_CATEGORY_URLS.mvideo).length,
    });
  }

  if (Object.keys(parsed.eldorado).length === 0) {
    logger.warn("No Eldorado categories configured; using default category set", {
      fallbackCount: Object.keys(DEFAULT_CATEGORY_URLS.eldorado).length,
    });
  }

  return merged;
}

function parseJson(value, fallback, context) {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch (error) {
    logger.warn("Failed to parse JSON configuration", {
      context,
      error: error.message,
    });
    return fallback;
  }
}

function resolveMvideoCategories() {
  const apiListUrl = process.env.MVIDEO_API_LIST_URL;
  const apiDetailsUrl = process.env.MVIDEO_API_DETAILS_URL;
  const apiPricesUrl = process.env.MVIDEO_API_PRICES_URL;

  const missingApi = [
    ["MVIDEO_API_LIST_URL", apiListUrl],
    ["MVIDEO_API_DETAILS_URL", apiDetailsUrl],
    ["MVIDEO_API_PRICES_URL", apiPricesUrl],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingApi.length > 0) {
    logger.warn("M.Video API endpoints are not fully configured; skipping categories", {
      missing: missingApi,
    });
    return [];
  }

  const pageSize = parseNumber(process.env.MVIDEO_PAGE_SIZE, 24);
  const extraParams = parseJson(process.env.MVIDEO_EXTRA_PARAMS, {}, "MVIDEO_EXTRA_PARAMS");

  const definitions = [
    {
      key: "SMARTPHONES",
      id: process.env.MVIDEO_CAT_SMARTPHONES_ID,
      city: process.env.MVIDEO_CAT_SMARTPHONES_CITY || "Санкт-Петербург",
    },
  ];

  const categories = [];

  for (const definition of definitions) {
    if (!definition.id) {
      logger.warn("M.Video category ID is not configured; skipping", {
        key: definition.key,
      });
      continue;
    }

    categories.push({
      key: definition.key,
      id: definition.id,
      apiListUrl,
      apiDetailsUrl,
      apiPricesUrl,
      pageSize,
      extraParams,
      city: definition.city,
    });
  }

  if (categories.length === 0) {
    logger.warn("No M.Video API categories configured; check environment variables");
  }

  return categories;
}

const config = {
  mongodbUri: process.env.MONGODB_URI,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  minDiscount: parseNumber(process.env.MIN_DISCOUNT, 30),
  cronSchedule: process.env.CRON_SCHEDULE || "*/15 * * * *",
  cities: resolveCities(),
  categoryUrls: resolveCategoryUrls(),
  mvideoCategories: resolveMvideoCategories(),
  playwright: {
    headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
    slowMo: parseNumber(process.env.PLAYWRIGHT_SLOWMO, undefined),
  },
};

module.exports = config;
