import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  // o `next dev` compila a rota na primeira visita, e isso passa dos 5s
  // padrão. Não é lentidão do produto: em produção a rota já vem compilada.
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/entrar',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
