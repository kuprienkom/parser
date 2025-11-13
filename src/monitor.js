const cron = require("node-cron");
const config = require("./config");
const { connectDb, Offer } = require("./db");
const { launchBot, sendOfferMessage } = require("./bot");
const { scrapeMvideo } = require("./scrapers/mvideo");
const { scrapeEldorado } = require("./scrapers/eldorado");
const { logger } = require("./logger");

const SCRAPERS = {
  mvideo: scrapeMvideo,
  eldorado: scrapeEldorado,
};

function shouldNotify(existing, incoming) {
  if (!existing) {
    return true;
  }

  const discountIncreased = incoming.discount > (existing.discount ?? 0);
  const dayPassed =
    !existing.lastNotifiedAt || Date.now() - existing.lastNotifiedAt.getTime() > 24 * 60 * 60 * 1000;

  return discountIncreased || dayPassed;
}

async function persistOffer(shop, incoming, notify) {
  const now = new Date();
  const update = {
    shop,
    sku: incoming.sku,
    city: incoming.city,
    title: incoming.title,
    url: incoming.url,
    price: incoming.price,
    oldPrice: incoming.oldPrice,
    discount: incoming.discount,
    category: incoming.category,
    lastSeenAt: now,
  };

  if (notify) {
    update.lastNotifiedAt = now;
  }

  const updated = await Offer.findOneAndUpdate(
    { shop, sku: incoming.sku, city: incoming.city },
    { $set: update },
    { upsert: true, new: true }
  ).lean();

  return updated;
}

async function processOffers(shop, offers) {
  const toNotify = [];
  let considered = 0;

  for (const offer of offers) {
    if (offer.discount < config.minDiscount) {
      continue;
    }

    considered += 1;

    try {
      const existing = await Offer.findOne({ shop, sku: offer.sku, city: offer.city });
      const notify = shouldNotify(existing, offer);
      const updated = await persistOffer(shop, offer, notify);

      if (notify) {
        toNotify.push(updated);
      }
    } catch (error) {
      logger.error("Failed to process offer", {
        shop,
        sku: offer.sku,
        city: offer.city,
        error: error.message,
      });
    }
  }

  for (const offer of toNotify) {
    try {
      await sendOfferMessage(offer);
    } catch (error) {
      logger.error("Failed to notify about offer", {
        shop,
        sku: offer.sku,
        city: offer.city,
        error: error.message,
      });
    }
  }

  return {
    scraped: offers.length,
    considered,
    notified: toNotify.length,
  };
}

async function jobOnce() {
  logger.info("Monitor job started");

  const cities = config.cities.length > 0 ? config.cities : [undefined];
  const summary = [];

  for (const city of cities) {
    for (const [shop, scraper] of Object.entries(SCRAPERS)) {
      try {
        const offers = await scraper({ cityName: city });
        const result = await processOffers(shop, offers);
        summary.push({ shop, city, ...result });
        logger.info("Scraper finished", { shop, city, ...result });
      } catch (error) {
        logger.error("Scraper failed", { shop, city, error: error.message });
      }
    }
  }

  if (summary.length === 0) {
    logger.warn("Monitor job finished with no data");
  } else {
    logger.info("Monitor job finished", { summary });
  }

  return summary;
}

async function startMonitor() {
  await connectDb();
  await launchBot();

  await jobOnce();

  cron.schedule(config.cronSchedule, async () => {
    try {
      await jobOnce();
    } catch (error) {
      logger.error("Scheduled job failed", { error: error.message });
    }
  });

  logger.info("Monitor scheduled", { cron: config.cronSchedule });
}

module.exports = {
  startMonitor,
  jobOnce,
  processOffers,
};
