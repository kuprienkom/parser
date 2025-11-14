const { fetchCategoryOffers } = require("../mvideoApi");
const config = require("../config");
const { logger } = require("../logger");

async function scrapeMvideo(options = {}) {
  const results = [];
  const categories = config.mvideoCategories || [];

  if (categories.length === 0) {
    logger.warn("No M.Video API categories available for scraping");
    return results;
  }

  for (const category of categories) {
    const city = options.cityName || category.city || config.cities[0] || "Санкт-Петербург";

    logger.info("Starting M.Video category scraping", {
      op: "mvideoCategoryStart",
      categoryId: category.id,
      city,
    });

    const offers = await fetchCategoryOffers(category, city);
    results.push(...offers);

    logger.info("Finished M.Video category scraping", {
      op: "mvideoCategoryDone",
      categoryId: category.id,
      city,
      offers: offers.length,
    });
  }

  return results;
}

module.exports = {
  scrapeMvideo,
};

