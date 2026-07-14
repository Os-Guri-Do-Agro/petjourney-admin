import { readonly, ref } from 'vue'

const visible = ref(false)
const lastSuccessAt = ref(0)

/** Estado compartilhado do modal de validar cupom (header → Visão geral / Divulgação). */
export function useCupomResgateModal() {
  function open() {
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
    open,
    close,
    markSuccess,
  }
}
