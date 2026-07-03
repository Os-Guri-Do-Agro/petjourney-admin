import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export function usePartnerTabs<T extends string>(validTabs: readonly T[], defaultTab: T) {
  const route = useRoute()
  const router = useRouter()

  const activeTab = computed<T>(() => {
    const raw = route.query.aba

    if (typeof raw === 'string' && (validTabs as readonly string[]).includes(raw)) {
      return raw as T
    }

    return defaultTab
  })

  function setTab(tab: T) {
    const nextQuery = { ...route.query }

    if (tab === defaultTab) {
      delete nextQuery.aba
    } else {
      nextQuery.aba = tab
    }

    void router.replace({ path: route.path, query: nextQuery })
  }

  return { activeTab, setTab }
}
