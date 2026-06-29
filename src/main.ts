import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'

import App from './App.vue'
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

app.mount('#app')
