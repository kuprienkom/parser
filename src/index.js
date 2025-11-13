const { startMonitor } = require("./monitor");
const { logger } = require("./logger");

async function bootstrap() {
  try {
    await startMonitor();
  } catch (error) {
    logger.error("Failed to start monitor", { error: error.message });
    process.exitCode = 1;
  }
}

bootstrap();
