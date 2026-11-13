/** Optional temporal protection. Importing this package does not install a limiter. */
export * from './rate-limit.js';
export { createRateLimiter } from './limiter.js';
export type { RateLimiter } from './limiter.js';
