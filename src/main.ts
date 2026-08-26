import './assets/main.css'
import './features/clinico/theme/clinic-tokens.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'

import App from './App.vue'
import i18n, { syncDocumentLang } from './i18n'
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

syncDocumentLang()
app.mount('#app')
