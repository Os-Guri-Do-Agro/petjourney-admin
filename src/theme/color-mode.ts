import { computed, ref, watch } from 'vue'

import { ThemeColors, type ThemeMode } from './colors'

const COLOR_MODE_STORAGE_KEY = 'petjourney-color-mode'

export const DEFAULT_COLOR_MODE: ThemeMode = 'light'

/** Claro é o padrão do painel: só a escolha explícita do usuário muda o modo. */
export function getInitialColorMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return DEFAULT_COLOR_MODE
  }

  const storedMode = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY)

  if (storedMode === 'light' || storedMode === 'dark') {
    return storedMode
  }

  return DEFAULT_COLOR_MODE
}

export const colorMode = ref<ThemeMode>(getInitialColorMode())

export const currentColors = computed(() => ThemeColors[colorMode.value])
export const isDarkMode = computed(() => colorMode.value === 'dark')

export function toggleColorMode() {
  colorMode.value = isDarkMode.value ? 'light' : 'dark'
}

watch(
  colorMode,
  (mode) => {
    if (typeof document === 'undefined') {
      return
    }

    document.documentElement.classList.toggle('app-dark', mode === 'dark')
    document.documentElement.style.colorScheme = mode
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode)
  },
  { immediate: true },
)
