const mongoose = require("mongoose");
const config = require("./config");
const { logger } = require("./logger");

mongoose.set("strictQuery", true);

const offerSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      enum: ["mvideo", "eldorado"],
      required: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    oldPrice: {
      type: Number,
      min: 0,
    },
    discount: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastNotifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

offerSchema.index({ shop: 1, sku: 1, city: 1 }, { unique: true });

const Offer = mongoose.models.Offer || mongoose.model("Offer", offerSchema);

async function connectDb() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  try {
    await mongoose.connect(config.mongodbUri, {
      dbName: "priceWatcher",
    });
    logger.info("Mongo connected");
  } catch (error) {
    logger.error("Mongo connection error", { error: error.message });
    throw error;
  }
}

module.exports = {
  connectDb,
  Offer,
};
