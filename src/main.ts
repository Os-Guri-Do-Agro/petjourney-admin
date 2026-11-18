/* Primeiro de tudo: com a demonstração ligada, o relógio desloca antes de outro módulo ler a hora. */
import './demonstracao/cedo'
import './assets/main.css'
import './features/clinico/theme/clinic-tokens.css'
import './theme/hc-tokens.css'
import './theme/hc-tema.css'
import './components/home/home-card.css'
import './theme/trilha/trilha-tokens.css'
import './theme/trilha/trilha-tema.css'
import './theme/trilha/trilha-ui.css'
import './theme/trilha/trilha-acabamento.css'
import './components/layout/moldura-app.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'

import App from './App.vue'
import { prepararDemonstracao, useModoDemonstracao } from './composables/useModoDemonstracao'
import i18n, { syncDocumentLang } from './i18n'
import { sincronizarPrimeVue } from './i18n/primevue'
import router from './router'
import { instalarRegistroDeUso } from './service/uso/registro-de-uso'
import { useParceiroStore } from './stores/parceiro'
import './theme/color-mode'
import { PetJourneyPreset } from './theme/primevue'
import { deixarEscPassarPeloSelectFechado } from './theme/primevue-esc-do-select'
import { aceitarPontoComoDecimal } from './theme/primevue-ponto-decimal'

deixarEscPassarPeloSelectFechado()
aceitarPontoComoDecimal()

/* Antes do router: a primeira navegação já pede dados, e na demonstração eles vêm daqui. */
await prepararDemonstracao()

const app = createApp(App)

app.use(PrimeVue, {
  theme: {
    preset: PetJourneyPreset,
    options: {
      darkModeSelector: '.app-dark',
    },
  },
})
app.use(ToastService)
app.use(createPinia())
/* Antes do router: a primeira tela também entra no registro (docs/monitoramento-de-uso). */
instalarRegistroDeUso(router, {
  parceiroAtual: () => useParceiroStore().parceiroId,
  emDemonstracao: () => useModoDemonstracao().ativo.value,
})
app.use(router)
app.use(i18n)
sincronizarPrimeVue(app)

syncDocumentLang()
app.mount('#app')
