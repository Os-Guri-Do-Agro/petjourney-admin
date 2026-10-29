import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginVitest from '@vitest/eslint-plugin'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores([
    '**/dist/**',
    '**/dist-ssr/**',
    '**/coverage/**',
    '**/src/_mocks/**',
    // Pasta de trabalho local da tradução sr/ar (fora do git).
    '.i18n-work/**',
    // Gerado do openapi.json da API (`npm run contrato:gerar`).
    'src/service/contrato/openapi.ts',
  ]),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    name: 'app/file-route-pages',
    files: ['src/pages/**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },

  {
    // O nome é o do módulo do PrimeVue que o arquivo substitui (`vite.config.ts`).
    name: 'app/primevue-icon-substitutes',
    files: ['src/icons/primevue/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  skipFormatting,
)
