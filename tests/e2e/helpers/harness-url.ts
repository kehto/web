/** Shared harness endpoint for Playwright, its preview server, and CORS fixtures. */
export const HARNESS_PORT = Number(process.env.KEHTO_HARNESS_PORT ?? '4173');
if (!Number.isInteger(HARNESS_PORT) || HARNESS_PORT < 1 || HARNESS_PORT > 65535) {
  throw new Error('KEHTO_HARNESS_PORT must be an integer from 1 to 65535');
}
export const HARNESS_URL = `http://localhost:${HARNESS_PORT}`;
