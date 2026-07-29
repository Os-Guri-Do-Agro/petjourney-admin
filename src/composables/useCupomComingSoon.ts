import { ref } from 'vue'

import { CUPOM_FEATURE_ENABLED } from '@/features/cupom-feature'

const visible = ref(false)

/** Modal de teaser quando cupom/divulgação ainda não está liberado. */
export function useCupomComingSoon() {
  function open() {
    visible.value = true
  }

  function close() {
    visible.value = false
  }

  /**
   * Se a feature estiver off, abre o teaser e retorna `false`.
   * Se estiver on, retorna `true` para o caller seguir o fluxo real.
   */
  function tryAccess(): boolean {
    if (CUPOM_FEATURE_ENABLED) {
      return true
    }

    open()
    return false
  }

  return {
    visible,
    enabled: CUPOM_FEATURE_ENABLED,
    open,
    close,
    tryAccess,
  }
}
