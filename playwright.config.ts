import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  // margem sobre os 5s padrão: a suíte roda contra um build de produção, então
  // não há compilação no meio do teste, mas as ações de servidor conversam com
  // o Supabase local, que sobe em contêiner
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  /*
   * Build de produção, não `next dev`.
   *
   * O servidor de desenvolvimento recompila cada rota na primeira visita e
   * **cresce sem devolver**: numa suíte inteira ele passou de 1,7 GB, ficou
   * lento e derrubou o navegador por falta de memória. O modo de produção testa
   * o mesmo código que vai para o ar, gasta uma fração da memória, e tira do
   * teste a espera de compilação que não é do produto.
   */
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000/entrar',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
