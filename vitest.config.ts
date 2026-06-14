import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@kehto/acl/capabilities': resolve(__dirname, 'packages/acl/src/capabilities.ts'),
      '@kehto/acl': resolve(__dirname, 'packages/acl/src/index.ts'),
      '@kehto/runtime': resolve(__dirname, 'packages/runtime/src/index.ts'),
      '@kehto/services/cvm-nostr-transport': resolve(__dirname, 'packages/services/src/cvm-nostr-transport.ts'),
      '@kehto/services': resolve(__dirname, 'packages/services/src/index.ts'),
      '@kehto/shell': resolve(__dirname, 'packages/shell/src/index.ts'),
      '@kehto/nip/66': resolve(__dirname, 'packages/nip/src/66.ts'),
      '@kehto/nip': resolve(__dirname, 'packages/nip/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: [
      'packages/*/src/**/*.test.ts',
      'packages/*/tests/**/*.test.ts',
      'tests/unit/**/*.test.ts',
    ],
    exclude: [
      'tests/e2e/**',
      'node_modules/**',
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['packages/*/src/**/*.test.ts', 'packages/*/dist/**'],
    },
  },
});
