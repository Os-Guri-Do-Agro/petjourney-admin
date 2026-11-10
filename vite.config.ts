import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig, normalizePath, type Plugin } from 'vite'
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
 * CLAUDE.md) e aparece no login e no pé do menu da conta: é por ela que se confere o que está no ar.
 */
const versaoDoPortal: string = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
).version

/*
 * De qual commit e quando saiu o build. O git da máquina responde no build local; no da
 * hospedagem, se não houver git, vale a variável que ela publica. Sem nenhum dos dois, fica vazio.
 */
function commitDoBuild(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    const daHospedagem =
      process.env.AWS_COMMIT_ID ??
      process.env.CODEBUILD_RESOLVED_SOURCE_VERSION ??
      process.env.GITHUB_SHA ??
      ''
    return daHospedagem.slice(0, 7)
  }
}

const buildDoPortal = { commit: commitDoBuild(), data: new Date().toISOString() }

/*
 * A mesma informação no `index.html`, que todo deploy precisa trocar: `npm run conferir:publicacao`
 * lê esta etiqueta no endereço publicado para saber se o que subiu já está no ar.
 */
const etiquetaDaVersao: Plugin = {
  name: 'etiqueta-da-versao',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: {
        name: 'versao-do-portal',
        content: versaoDoPortal,
        'data-commit': buildDoPortal.commit,
        'data-build': buildDoPortal.data,
      },
      injectTo: 'head',
    },
  ],
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __VERSAO_DO_PORTAL__: JSON.stringify(versaoDoPortal),
    __BUILD_DO_PORTAL__: JSON.stringify(buildDoPortal),
  },
  plugins: [vue(), vueJsx(), vueDevTools(), tailwindcss(), etiquetaDaVersao],
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
