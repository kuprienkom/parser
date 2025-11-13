const { Telegraf } = require("telegraf");
const config = require("./config");
const { logger } = require("./logger");

const bot = new Telegraf(config.telegramBotToken);
let launched = false;

function formatPrice(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMessage(offer) {
  const title = offer.title ?? "Неизвестный товар";
  const oldPrice = offer.oldPrice ? `Старая цена: ~${formatPrice(offer.oldPrice)}~\n` : "";

  return (
    `🔥 Большая скидка (${offer.shop.toUpperCase()}, ${offer.city})\n` +
    `Товар: ${title}\n` +
    `${oldPrice}` +
    `Новая цена: *${formatPrice(offer.price)}*\n` +
    `Скидка: *${offer.discount}%*\n` +
    `[Открыть товар](${offer.url})`
  );
}

async function launchBot() {
  if (launched) {
    return;
  }

  await bot.launch();
  launched = true;
  logger.info("Telegram bot launched");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

async function sendOfferMessage(offer) {
  const text = formatMessage(offer);

  try {
    await bot.telegram.sendMessage(config.telegramChatId, text, {
      parse_mode: "Markdown",
      disable_web_page_preview: false,
    });
    logger.info("Offer notification sent", {
      shop: offer.shop,
      sku: offer.sku,
      city: offer.city,
      discount: offer.discount,
    });
  } catch (error) {
    logger.error("Failed to send Telegram message", {
      error: error.message,
      shop: offer.shop,
      sku: offer.sku,
    });
    throw error;
  }
}

module.exports = {
  bot,
  launchBot,
  sendOfferMessage,
};
