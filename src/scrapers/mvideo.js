const config = require("../config");
const { logger } = require("../logger");
const { withPage, scrapeCategory } = require("./base");

const DEFAULT_SELECTORS = {
  card: "div.product-cards-layout__item",
  skuAttr: "data-product-sku",
  title: ".product-title__text",
  price: ".price__main-value",
  oldPrice: ".price__old-value",
  url: "a.product-title__text",
};

function selectorOverrides(prefix, defaults) {
  return Object.entries(defaults).reduce((acc, [key, value]) => {
    const envKey = `${prefix}${key.toUpperCase()}`;
    acc[key] = process.env[envKey] || value;
    return acc;
  }, {});
}

const SELECTORS = selectorOverrides("MVIDEO_SELECTOR_", DEFAULT_SELECTORS);

let warnedCity = false;

async function setupCity(page, cityName) {
  if (!cityName) {
    return;
  }

  const template = process.env.MVIDEO_CITY_URL_TEMPLATE;
  if (!template) {
    if (!warnedCity) {
      logger.warn("M.Video city template is not configured; region might be incorrect", { city: cityName });
      warnedCity = true;
    }
    return;
  }

  const url = template.replace("{city}", encodeURIComponent(cityName));
  logger.info("Setting M.Video city", { city: cityName, url });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1_000);
}

async function scrapeMvideo(options = {}) {
  const cityName = options.cityName || config.cities[0] || "Москва";
  const categories = Object.entries(config.categoryUrls.mvideo);

  if (categories.length === 0) {
    logger.warn("M.Video categories are not configured. Provide MVIDEO_CATEGORY_URL_* in .env");
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
          shop: "mvideo",
        });

        result.push(
          ...items.map((item) => ({
            ...item,
            shop: "mvideo",
            category,
          }))
        );
      } catch (error) {
        logger.error("M.Video category scraping failed", {
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
  scrapeMvideo,
};
