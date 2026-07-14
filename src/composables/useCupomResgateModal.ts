import { computed, readonly, ref } from 'vue'

import { useParceiroStore } from '@/stores/parceiro'

const visible = ref(false)
const lastSuccessAt = ref(0)

/** Estado compartilhado do modal de validar cupom (header → telas do portal). */
export function useCupomResgateModal() {
  const store = useParceiroStore()

  /** Só parceiro com membership e operação liberada pode validar cupom. */
  const canOpen = computed(
    () =>
      !store.semAcessoParceiro &&
      store.loadState === 'ready' &&
      Boolean(store.dashboard) &&
      store.podeOperar,
  )

  function open() {
    if (!canOpen.value) {
      return
    }

    visible.value = true
  }

  function close() {
    visible.value = false
  }

  function markSuccess() {
    lastSuccessAt.value = Date.now()
  }

  return {
    visible,
    lastSuccessAt: readonly(lastSuccessAt),
    canOpen,
    open,
    close,
    markSuccess,
  }
}
