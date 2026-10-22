<script setup lang="ts">
/**
 * O widget do Cloudflare Turnstile para as páginas públicas que escrevem (pedido de horário,
 * reserva de hotel). Entrega o token por `v-model:token`; vencido ou com erro, o token volta a
 * `null`. Quem envia chama `reset()` quando a API responde `CAPTCHA_INVALIDO`.
 *
 * O script da Cloudflare entra uma vez por página, só quando o widget aparece.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { chaveDoCaptcha } from '@/service/captcha'

type Turnstile = {
  render: (
    elemento: HTMLElement,
    opcoes: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
      theme?: 'auto' | 'light' | 'dark'
    },
  ) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let carregando: Promise<Turnstile> | null = null

function carregarTurnstile(): Promise<Turnstile> {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile)
  }

  carregando ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile'))
    script.onerror = () => {
      carregando = null
      reject(new Error('turnstile'))
    }
    document.head.appendChild(script)
  })

  return carregando
}

const token = defineModel<string | null>('token', { default: null })

const { t } = useI18n()
const alvo = ref<HTMLElement | null>(null)
const falhou = ref(false)
let widgetId: string | null = null
let api: Turnstile | null = null

onMounted(async () => {
  const chave = chaveDoCaptcha()

  if (!chave || !alvo.value) {
    falhou.value = true
    return
  }

  try {
    api = await carregarTurnstile()
    widgetId = api.render(alvo.value, {
      sitekey: chave,
      theme: 'auto',
      callback: (valor) => {
        falhou.value = false
        token.value = valor
      },
      'expired-callback': () => {
        token.value = null
      },
      'error-callback': () => {
        token.value = null
        falhou.value = true
      },
    })
  } catch {
    falhou.value = true
  }
})

onBeforeUnmount(() => {
  if (api && widgetId) {
    api.remove(widgetId)
  }
})

/** Novo desafio: depois de `CAPTCHA_INVALIDO`, ou quando o token já foi usado. */
function reset() {
  token.value = null

  if (api && widgetId) {
    api.reset(widgetId)
  }
}

defineExpose({ reset })
</script>

<template>
  <div class="captcha">
    <div ref="alvo" />
    <p v-if="falhou" class="captcha__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      {{ t('captcha.erro') }}
    </p>
  </div>
</template>

<style scoped>
.captcha {
  display: grid;
  gap: 6px;
}

.captcha__erro {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.45;
}

.captcha__erro i {
  margin-top: 1px;
  color: var(--risco-tinta);
  font-size: 16px;
}
</style>
