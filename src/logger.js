const levels = ["debug", "info", "warn", "error"];

function format(level, message, meta) {
  const payload = {
    level,
    message,
    time: new Date().toISOString(),
    ...meta,
  };

  return JSON.stringify(payload);
}

function createLogger(minLevel = "info") {
  const threshold = levels.indexOf(minLevel);

  return levels.reduce((acc, level, index) => {
    acc[level] = (message, meta = {}) => {
      if (index < threshold) {
        return;
      }

      const output = format(level, message, meta);
      if (level === "error") {
        console.error(output);
      } else if (level === "warn") {
        console.warn(output);
      } else {
        console.log(output);
      }
    };

    return acc;
  }, {});
}

const logger = createLogger(process.env.LOG_LEVEL || "info");

module.exports = {
  createLogger,
  logger,
};
