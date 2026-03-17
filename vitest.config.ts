import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, 'test/__mocks__/vscode.ts'),
    },
  },
  test: {
    globals: true,
    include: ['test/**/*.test.ts'],
    exclude: [
      'test/suite/**',
    ],
    setupFiles: ['./test/vitest.setup.ts'],
    testTimeout: 120000,
    pool: 'forks',
  },
});
