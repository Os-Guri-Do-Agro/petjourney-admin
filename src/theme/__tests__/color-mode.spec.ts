import { afterEach, describe, expect, it, vi } from 'vitest'

import { getInitialColorMode } from '@/theme/color-mode'

const STORAGE_KEY = 'petjourney-color-mode'

function stubSystemPrefersDark(prefersDark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn<typeof window.matchMedia>().mockReturnValue({ matches: prefersDark } as MediaQueryList),
  )
}

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('getInitialColorMode', () => {
  it('sem escolha salva, abre no claro mesmo com o sistema no escuro', () => {
    stubSystemPrefersDark(true)

    expect(getInitialColorMode()).toBe('light')
  })

  it('respeita o modo escuro escolhido pelo usuário', () => {
    localStorage.setItem(STORAGE_KEY, 'dark')

    expect(getInitialColorMode()).toBe('dark')
  })

  it('respeita o modo claro escolhido pelo usuário', () => {
    localStorage.setItem(STORAGE_KEY, 'light')

    expect(getInitialColorMode()).toBe('light')
  })

  it('ignora valor inválido no storage', () => {
    localStorage.setItem(STORAGE_KEY, 'sepia')

    expect(getInitialColorMode()).toBe('light')
  })
})
