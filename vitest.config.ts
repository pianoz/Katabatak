import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'packages/web'),
    },
  },
  test: {
    include: ['packages/web/lib/**/*.test.ts'],
    env: (() => {
      // Load .env.test.local manually since vitest doesn't auto-load it
      const fs = require('fs');
      const envPath = path.resolve(__dirname, 'packages/web/.env.test.local');
      if (!fs.existsSync(envPath)) return {};
      return Object.fromEntries(
        fs.readFileSync(envPath, 'utf8')
          .split('\n')
          .filter((l: string) => l && !l.startsWith('#') && l.includes('='))
          .map((l: string) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] as [string, string]; })
      );
    })(),
  },
});
