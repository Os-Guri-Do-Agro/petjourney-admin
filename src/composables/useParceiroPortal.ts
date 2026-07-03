import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useParceiroStore } from '@/stores/parceiro'

export function useParceiroPortal() {
  const store = useParceiroStore()
  const router = useRouter()
  const bootstrapping = ref(false)

  async function ensureContext(force = false) {
    if (store.loadState === 'ready' && store.dashboard && !force) {
      return
    }

    bootstrapping.value = true

    try {
      await store.bootstrap(force)
    } catch {
      if (store.needsParceiroSelection) {
        await router.replace('/parceiro/selecionar')
      }
    } finally {
      bootstrapping.value = false
    }
  }

  function parceiroQuery() {
    return store.parceiroId ? { parceiroId: store.parceiroId } : undefined
  }

  return {
    store,
    bootstrapping,
    ensureContext,
    parceiroQuery,
  }
}
