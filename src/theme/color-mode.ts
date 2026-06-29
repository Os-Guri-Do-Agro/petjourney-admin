import { computed, ref, watch } from 'vue'

import { ThemeColors, type ThemeMode } from './colors'

const COLOR_MODE_STORAGE_KEY = 'petjourney-color-mode'
const faviconByMode: Record<ThemeMode, string> = {
  light: '/pata-clara.png',
  dark: '/pata-escura.png',
}

function getInitialColorMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const storedMode = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY)

  if (storedMode === 'light' || storedMode === 'dark') {
    return storedMode
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const colorMode = ref<ThemeMode>(getInitialColorMode())

export const currentColors = computed(() => ThemeColors[colorMode.value])
export const isDarkMode = computed(() => colorMode.value === 'dark')

export function toggleColorMode() {
  colorMode.value = isDarkMode.value ? 'light' : 'dark'
}

function updateFavicon(mode: ThemeMode) {
  const favicon = document.querySelector<HTMLLinkElement>('#app-favicon,link[rel~="icon"]')

  if (!favicon) {
    return
  }

  favicon.href = faviconByMode[mode]
}

watch(
  colorMode,
  (mode) => {
    if (typeof document === 'undefined') {
      return
    }

    document.documentElement.classList.toggle('app-dark', mode === 'dark')
    document.documentElement.style.colorScheme = mode
    updateFavicon(mode)
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode)
  },
  { immediate: true },
)
