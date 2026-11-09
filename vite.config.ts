import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig, normalizePath } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

/*
 * Ícones internos do PrimeVue desenhados com o Phosphor: cada arquivo de `src/icons/primevue/`
 * substitui o módulo `@primevue/icons/<mesmo nome>`. Ícone sem arquivo lá continua o original.
 * Ver `src/icons/icone-do-primevue.ts`.
 *
 * Os substitutos são `.vue` de propósito: o pré-empacotamento do Vite deixa `.vue` de fora do
 * pacote otimizado do PrimeVue e o serve como código da aplicação. Em `.ts`, ele embutiria o
 * arquivo no pacote e a edição só apareceria reiniciando com `--force`.
 */
const iconesDoPrimeVue = normalizePath(
  fileURLToPath(new URL('./src/icons/primevue', import.meta.url)),
)
const substituidos = readdirSync(iconesDoPrimeVue)
  .filter((arquivo) => arquivo.endsWith('.vue'))
  .map((arquivo) => arquivo.slice(0, -'.vue'.length))

/*
 * Versão do portal, a do `package.json`. Sobe a cada push para `develop` ou `main` (Regra 5 do
 * CLAUDE.md) e aparece no pé do menu da conta: é por ela que se confere o que está no ar.
 */
const versaoDoPortal: string = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
).version

// https://vite.dev/config/
export default defineConfig({
  define: {
    __VERSAO_DO_PORTAL__: JSON.stringify(versaoDoPortal),
  },
  plugins: [vue(), vueJsx(), vueDevTools(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      {
        find: new RegExp(`^@primevue/icons/(${substituidos.join('|')})$`),
        replacement: `${iconesDoPrimeVue}/$1.vue`,
      },
    ],
  },
  optimizeDeps: {
    /*
     * Importado só pelos substitutos acima, que o varredor de dependências não percorre. Sem
     * isto o Vite o descobriria na primeira tela aberta e recarregaria a página para otimizá-lo.
     */
    include: ['@primevue/icons/baseicon'],
  },
})
