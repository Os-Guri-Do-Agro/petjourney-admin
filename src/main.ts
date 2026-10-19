import './assets/main.css'
import './features/clinico/theme/clinic-tokens.css'
import './theme/hc-tokens.css'
import './theme/hc-tema.css'
import './components/home/home-card.css'
import './theme/trilha/trilha-tokens.css'
import './theme/trilha/trilha-tema.css'
import './theme/trilha/trilha-ui.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'

import App from './App.vue'
import i18n, { syncDocumentLang } from './i18n'
import { sincronizarPrimeVue } from './i18n/primevue'
import router from './router'
import './theme/color-mode'
import { PetJourneyPreset } from './theme/primevue'

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
app.use(router)
app.use(i18n)
sincronizarPrimeVue(app)

syncDocumentLang()
app.mount('#app')
