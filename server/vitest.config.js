import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    /* `assessments/*.unit.test.js` son pruebas unitarias con base de datos falsa.
       La de integración (`integration.test.js`, con emulador) se corre aparte:
       npm run test:assessments:integration. */
    include: ['src/**/*.test.js', 'assessments/*.unit.test.js'],
  },
})
