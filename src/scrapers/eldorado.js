const config = require("../config");
const { logger } = require("../logger");
const { withPage, scrapeCategory } = require("./base");

const DEFAULT_SELECTORS = {
  card: "div.catalogItem",
  skuAttr: "data-product-sku",
  title: ".catalogItem-title",
  price: ".catalogItem-priceCurrent",
  oldPrice: ".catalogItem-priceOld",
  url: "a.catalogItem-title",
};

function selectorOverrides(prefix, defaults) {
  return Object.entries(defaults).reduce((acc, [key, value]) => {
    const envKey = `${prefix}${key.toUpperCase()}`;
    acc[key] = process.env[envKey] || value;
    return acc;
  }, {});
}

const SELECTORS = selectorOverrides("ELDORADO_SELECTOR_", DEFAULT_SELECTORS);

let warnedCity = false;

async function setupCity(page, cityName) {
  if (!cityName) {
    return;
  }

  const template = process.env.ELDORADO_CITY_URL_TEMPLATE;
  if (!template) {
    if (!warnedCity) {
      logger.warn("Eldorado city template is not configured; region might be incorrect", { city: cityName });
      warnedCity = true;
    }
    return;
  }

  const url = template.replace("{city}", encodeURIComponent(cityName));
  logger.info("Setting Eldorado city", { city: cityName, url });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1_000);
}

async function scrapeEldorado(options = {}) {
  const cityName = options.cityName || config.cities[0] || "Москва";
  const categories = Object.entries(config.categoryUrls.eldorado);

  if (categories.length === 0) {
    logger.warn("Eldorado categories are not configured. Provide ELDORADO_CATEGORY_URL_* in .env");
    return [];
  }

  return withPage(async (page) => {
    await setupCity(page, cityName);

    const result = [];

    for (const [category, url] of categories) {
      try {
        const items = await scrapeCategory({
          page,
          url,
          selectors: SELECTORS,
          cityName,
          shop: "eldorado",
        });

        result.push(
          ...items.map((item) => ({
            ...item,
            shop: "eldorado",
            category,
          }))
        );
      } catch (error) {
        logger.error("Eldorado category scraping failed", {
          category,
          url,
          city: cityName,
          error: error.message,
        });
      }
    }

    return result;
  });
}

module.exports = {
  scrapeEldorado,
};
