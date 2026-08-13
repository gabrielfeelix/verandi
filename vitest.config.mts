import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const raiz = import.meta.dirname

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // os testes de banco compartilham o Supabase local: rodar arquivos em
    // paralelo faz um `db reset` de um derrubar o outro pela metade
    fileParallelism: false,
    testTimeout: 20_000,
  },
  resolve: {
    alias: { '@': resolve(raiz, 'src') },
  },
})
