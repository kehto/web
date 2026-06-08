import { createReadStream, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(webRoot, '..');
const gsapVendorPath = join(repoRoot, 'node_modules', 'gsap', 'dist', 'gsap.min.js');

export default {
  plugins: [
    {
      name: 'kehto-site-dev-vendor',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use('/web/assets/vendor/gsap.min.js', (_request, response, next) => {
          if (!existsSync(gsapVendorPath)) {
            next();
            return;
          }

          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          response.setHeader('Cache-Control', 'no-cache');
          createReadStream(gsapVendorPath).pipe(response);
        });
      },
    },
  ],
};
