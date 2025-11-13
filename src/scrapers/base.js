const { chromium } = require("playwright");
const config = require("../config");
const { logger } = require("../logger");

function parsePrice(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const numeric = String(value)
    .replace(/[^0-9.,]/g, "")
    .replace(",", ".");

  const parsed = Number.parseFloat(numeric);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatUrl(base, relative) {
  if (!relative) {
    return base;
  }

  try {
    return new URL(relative, base).toString();
  } catch (error) {
    return relative;
  }
}

async function withBrowser(run) {
  const browser = await chromium.launch({
    headless: config.playwright.headless,
    slowMo: config.playwright.slowMo,
  });

  try {
    return await run(browser);
  } finally {
    await browser.close();
  }
}

async function withPage(run) {
  return withBrowser(async (browser) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      return await run(page, context);
    } finally {
      await context.close();
    }
  });
}

async function scrapeCategory({
  page,
  url,
  selectors,
  cityName,
  preprocess,
  postprocess,
  shop,
}) {
  logger.info("Scraping category", { shop, url, city: cityName });

  if (preprocess) {
    await preprocess(page, cityName);
  }

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector(selectors.card, { timeout: 30_000 });

  const items = await page.$$eval(selectors.card, (cards, selectorsIn) => {
    const toNumber = (value) => {
      if (value == null) return null;
      const numeric = String(value)
        .replace(/[^0-9.,]/g, "")
        .replace(",", ".");
      const parsed = Number.parseFloat(numeric);
      return Number.isNaN(parsed) ? null : parsed;
    };

    return cards
      .map((card) => {
        const skuAttr = selectorsIn.skuAttr;
        const sku = skuAttr ? card.getAttribute(skuAttr) : null;
        const title = selectorsIn.title ? card.querySelector(selectorsIn.title)?.textContent?.trim() : null;
        const priceRaw = selectorsIn.price ? card.querySelector(selectorsIn.price)?.textContent : null;
        const oldPriceRaw = selectorsIn.oldPrice ? card.querySelector(selectorsIn.oldPrice)?.textContent : null;
        const linkEl = selectorsIn.url ? card.querySelector(selectorsIn.url) : null;

        return {
          sku,
          title,
          price: toNumber(priceRaw),
          oldPrice: toNumber(oldPriceRaw),
          url: linkEl?.href || linkEl?.getAttribute?.("href"),
        };
      })
      .filter((item) => item && item.sku && item.title && item.price && item.oldPrice && item.url);
  }, selectors);

  const normalized = items
    .map((item) => {
      const price = parsePrice(item.price);
      const oldPrice = parsePrice(item.oldPrice);

      if (price === null || oldPrice === null || price >= oldPrice) {
        return null;
      }

      const discount = Math.round((1 - price / oldPrice) * 100);

      return {
        ...item,
        price,
        oldPrice,
        discount,
        city: cityName,
        url: formatUrl(url, item.url),
      };
    })
    .filter(Boolean);

  return postprocess ? postprocess(normalized, { cityName }) : normalized;
}

module.exports = {
  parsePrice,
  formatUrl,
  withBrowser,
  withPage,
  scrapeCategory,
};
