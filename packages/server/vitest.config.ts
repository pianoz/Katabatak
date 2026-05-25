import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@db-types': path.resolve(__dirname, '../../database.types.ts'),
    },
  },
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules'],
    environment: 'node',
  },
})
