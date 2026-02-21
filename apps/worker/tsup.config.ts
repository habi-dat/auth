import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  noExternal: [/@habidat\/.*/],
  external: ['@prisma/client', '@prisma/adapter-pg', 'pg', 'bullmq', 'ioredis', 'ldapjs-client'],
})
