const axios = require("axios");
const { logger } = require("./logger");

const REQUEST_TIMEOUT_MS = 15_000;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeParams(value) {
  return isPlainObject(value) ? value : {};
}

function splitPath(path) {
  return String(path)
    .replace(/\[(\w+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
}

function getValueByPath(object, path) {
  if (!object || !path) {
    return undefined;
  }

  const segments = Array.isArray(path) ? path : splitPath(path);
  let current = object;

  for (const key of segments) {
    if (current == null) {
      return undefined;
    }

    current = current[key];
  }

  return current;
}

function toNumber(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function ensureArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null) {
    return [];
  }

  if (isPlainObject(value)) {
    return Object.values(value);
  }

  return [value];
}

function extractProductId(item, idPath) {
  if (item === undefined || item === null) {
    return null;
  }

  if (typeof item === "string" || typeof item === "number") {
    return String(item);
  }

  if (!isPlainObject(item)) {
    return null;
  }

  if (idPath) {
    const id = getValueByPath(item, idPath);
    if (id !== undefined && id !== null) {
      return String(id);
    }
  }

  const fallback = item.productId ?? item.sku ?? item.id;
  return fallback !== undefined && fallback !== null ? String(fallback) : null;
}

function pickString(paths, sources) {
  for (const path of paths) {
    if (!path) continue;

    for (const source of sources) {
      const value = getValueByPath(source, path);
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return null;
}

function extractPriceFromArray(entries, predicate) {
  let fallback = null;

  for (const entry of entries) {
    if (!entry) continue;

    const type = String(entry.type || entry.priceType || "").toLowerCase();
    const candidate = toNumber(entry.value ?? entry.amount ?? entry.price);
    if (candidate === null) {
      continue;
    }

    if (predicate(type)) {
      return candidate;
    }

    if (fallback === null) {
      fallback = candidate;
    }
  }

  return fallback;
}

function extractPrice(entry, categoryConfig, kind) {
  if (!entry) {
    return null;
  }

  const isSale = kind === "sale";

  const configuredPath = isSale ? categoryConfig?.priceValuePath : categoryConfig?.priceBaseValuePath;
  const defaultPaths = isSale
    ? ["price.salePrice", "price.currentPrice", "salePrice", "currentPrice", "price.value", "price"]
    : ["price.basePrice", "basePrice", "oldPrice", "price.oldPrice", "basePrice.value"];

  const paths = [configuredPath, ...(categoryConfig?.priceAdditionalPaths || []), ...defaultPaths].filter(Boolean);

  for (const path of paths) {
    const value = getValueByPath(entry, path);
    const numeric = toNumber(value);
    if (numeric !== null) {
      return numeric;
    }
  }

  if (Array.isArray(entry.prices)) {
    const value = extractPriceFromArray(entry.prices, (type) => {
      if (!type) return false;
      if (isSale) {
        return type.includes("sale") || type.includes("card") || type.includes("actual") || type.includes("discount");
      }

      return type.includes("base") || type.includes("old") || type.includes("list");
    });

    if (value !== null) {
      return value;
    }
  }

  if (isPlainObject(entry.price)) {
    const value = toNumber(entry.price.value ?? entry.price.amount ?? entry.price.price);
    if (value !== null) {
      return value;
    }
  }

  return toNumber(entry.value ?? entry.amount ?? entry.price);
}

function parseHeadersFromEnv() {
  const raw = process.env.MVIDEO_HEADERS;

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : {};
  } catch (error) {
    logger.warn("Failed to parse MVIDEO_HEADERS; falling back to empty headers", {
      error: error.message,
    });
    return {};
  }
}

async function callMvideoApi(name, url, params, headers, cookies, method = "get") {
  if (!url) {
    throw new Error(`M.Video API URL for ${name} is not configured`);
  }

  const finalHeaders = { ...headers };
  if (cookies) {
    finalHeaders.Cookie = cookies;
  }

  logger.info("Calling M.Video API", {
    op: "mvideoApiRequest",
    name,
    url,
    params,
  });

  const lowerMethod = (method || "get").toLowerCase();

  const requestConfig = {
    method: lowerMethod,
    url,
    headers: finalHeaders,
    timeout: REQUEST_TIMEOUT_MS,
  };

  if (lowerMethod === "get") {
    requestConfig.params = params;
  } else {
    requestConfig.data = params;
  }

  const response = await axios(requestConfig);
  return response.data;
}

async function fetchCategoryOffers(categoryConfig, city) {
  if (!categoryConfig) {
    logger.warn("M.Video category configuration is missing");
    return [];
  }

  const { id: categoryId, apiListUrl, apiDetailsUrl, apiPricesUrl } = categoryConfig;

  if (!categoryId || !apiListUrl || !apiDetailsUrl || !apiPricesUrl) {
    logger.warn("M.Video category has incomplete API configuration; skipping", {
      op: "mvideoCategoryInvalid",
      categoryId,
      key: categoryConfig.key,
    });
    return [];
  }

  const headers = parseHeadersFromEnv();
  const cookies = process.env.MVIDEO_COOKIES || "";
  const pageSize = Number.isFinite(categoryConfig.pageSize) && categoryConfig.pageSize > 0 ? categoryConfig.pageSize : 24;
  const extraParams = normalizeParams(categoryConfig.extraParams);

  try {
    const listMethod = categoryConfig.listMethod || "get";
    const listParams = { categoryId, offset: 0, limit: pageSize, ...extraParams };
    const totalPath = categoryConfig.listTotalPath || "body.total";
    const itemsPath = categoryConfig.listItemsPath || "body.products";
    const listItemIdPath = categoryConfig.listItemIdPath || "productId";

    const productIds = new Set();

    const firstPageData = await callMvideoApi("list", apiListUrl, listParams, headers, cookies, listMethod);
    const firstItems = ensureArray(getValueByPath(firstPageData, itemsPath));
    for (const item of firstItems) {
      const id = extractProductId(item, listItemIdPath);
      if (id) {
        productIds.add(id);
      }
    }

    const totalRaw = getValueByPath(firstPageData, totalPath);
    const total = toNumber(totalRaw);
    const effectiveTotal = Number.isFinite(total) ? total : firstItems.length;
    const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));

    for (let pageIndex = 1; pageIndex < totalPages; pageIndex += 1) {
      const offset = pageIndex * pageSize;
      const pageData = await callMvideoApi(
        "list",
        apiListUrl,
        { ...listParams, offset },
        headers,
        cookies,
        listMethod
      );

      const pageItems = ensureArray(getValueByPath(pageData, itemsPath));
      if (pageItems.length === 0) {
        break;
      }

      for (const item of pageItems) {
        const id = extractProductId(item, listItemIdPath);
        if (id) {
          productIds.add(id);
        }
      }
    }

    if (productIds.size === 0) {
      logger.info("M.Video category returned no products", {
        op: "mvideoCategoryEmpty",
        categoryId,
        city,
      });
      return [];
    }

    const productIdList = Array.from(productIds);
    const joinedIds = productIdList.join(",");

    const detailsMethod = categoryConfig.detailsMethod || "get";
    const pricesMethod = categoryConfig.pricesMethod || "get";
    const detailsParams = { productIds: joinedIds, ...normalizeParams(categoryConfig.detailsParams) };
    const pricesParams = { productIds: joinedIds, ...normalizeParams(categoryConfig.pricesParams) };

    const [detailsData, pricesData] = await Promise.all([
      callMvideoApi("details", apiDetailsUrl, detailsParams, headers, cookies, detailsMethod),
      callMvideoApi("prices", apiPricesUrl, pricesParams, headers, cookies, pricesMethod),
    ]);

    const detailsItems = ensureArray(getValueByPath(detailsData, categoryConfig.detailsItemsPath || "body.products"));
    const pricesItems = ensureArray(getValueByPath(pricesData, categoryConfig.pricesItemsPath || "body.materialPrices"));
    const detailsIdPath = categoryConfig.detailsIdPath || "productId";
    const pricesIdPath = categoryConfig.pricesIdPath || "productId";

    const detailsMap = new Map();
    for (const item of detailsItems) {
      const id = extractProductId(item, detailsIdPath);
      if (id) {
        detailsMap.set(id, item);
      }
    }

    const pricesMap = new Map();
    for (const item of pricesItems) {
      const id = extractProductId(item, pricesIdPath);
      if (id) {
        pricesMap.set(id, item);
      }
    }

    const offers = [];

    for (const productId of productIdList) {
      const detail = detailsMap.get(productId) || {};
      const priceEntry = pricesMap.get(productId) || {};

      const title =
        pickString(
          [
            categoryConfig.detailsTitlePath,
            "name",
            "productName",
            "title",
            "model",
          ],
          [detail]
        ) || `Товар ${productId}`;

      const rawUrl = pickString(
        [categoryConfig.detailsUrlPath, "productUrl", "url", "link"],
        [detail]
      );

      const urlTemplate = categoryConfig.urlTemplate;
      const url = urlTemplate ? urlTemplate.replace("{productId}", productId) : rawUrl;

      const price = extractPrice(priceEntry, categoryConfig, "sale");
      const basePrice = extractPrice(priceEntry, categoryConfig, "base");

      if (price === null) {
        continue;
      }

      const oldPrice = basePrice !== null ? basePrice : price;
      const discount = oldPrice > 0 ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;

      offers.push({
        shop: "mvideo",
        city,
        sku: productId,
        title,
        url: url || categoryConfig.fallbackProductUrl || "",
        price,
        oldPrice,
        discount: discount < 0 ? 0 : discount,
      });
    }

    logger.info("M.Video category offers ready", {
      op: "mvideoCategoryOffersReady",
      categoryId,
      city,
      count: offers.length,
    });

    return offers;
  } catch (error) {
    logger.error("Failed to fetch M.Video category via API", {
      op: "mvideoApiError",
      categoryId,
      city,
      error: error.message,
    });
    return [];
  }
}

module.exports = {
  fetchCategoryOffers,
};

