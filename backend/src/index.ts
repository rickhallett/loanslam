import { buildApp } from './composition/composition.js';

/**
 * Process entry point. Builds the wired app and starts listening. Kept tiny:
 * all wiring lives in the composition root, all decisions in the service.
 */
async function main(): Promise<void> {
  const { app, config, logger } = await buildApp();

  const server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, env: config.nodeEnv, widgetOrigin: config.widgetOrigin },
      `Loanslam chat API listening on http://localhost:${config.port}`,
    );
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'shutting down');
    server.close(() => process.exit(0));
    // Hard exit if connections don't drain promptly.
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('fatal: failed to start', err);
  process.exit(1);
});
