/**
 * O formato do menu (Seções, Ladrilhos, Só ícones, Menu no alto) é lido de três preferências
 * guardadas: onde o menu mora, o desenho da barra e a largura dela. Estes casos cobrem a ida e a
 * volta entre os formatos, e o botão de recolher a barra, que também troca o formato.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import {
  layoutFormat,
  navigatorLayout,
  navigatorStyle,
  navigatorWidth,
  setLayoutFormat,
  setNavigatorWidth,
} from '@/composables/useLayoutPreferences'

describe('formato do menu', () => {
  beforeEach(() => {
    navigatorLayout.value = 'lateral'
    navigatorStyle.value = 'secoes'
    navigatorWidth.value = 'auto'
  })

  it('nasce em Seções, com a barra recolhendo sozinha nas telas menores', () => {
    expect(layoutFormat.value).toBe('secoes')
  })

  it('o menu no alto vale sobre a largura da barra', () => {
    setNavigatorWidth('icones')
    setLayoutFormat('topo')

    expect(layoutFormat.value).toBe('topo')
  })

  it('só ícones é a barra estreita, e sair dele volta à largura automática', () => {
    setLayoutFormat('icones')

    expect(navigatorWidth.value).toBe('icones')
    expect(layoutFormat.value).toBe('icones')

    setLayoutFormat('ladrilhos')

    expect(navigatorWidth.value).toBe('auto')
    expect(navigatorStyle.value).toBe('ladrilhos')
    expect(layoutFormat.value).toBe('ladrilhos')
  })

  it('quem escolheu a barra sempre larga continua com ela ao trocar de desenho', () => {
    setNavigatorWidth('larga')
    setLayoutFormat('ladrilhos')

    expect(navigatorWidth.value).toBe('larga')
  })

  it('recolher a barra pelo botão vira "Só ícones"', () => {
    setNavigatorWidth('icones')

    expect(layoutFormat.value).toBe('icones')
  })

  it('a escolha fica guardada no navegador', async () => {
    setLayoutFormat('topo')
    await nextTick()

    expect(window.localStorage.getItem('petjourney-navigator-layout')).toBe('topo')

    setLayoutFormat('ladrilhos')
    await nextTick()

    expect(window.localStorage.getItem('petjourney-navigator-layout')).toBe('lateral')
    expect(window.localStorage.getItem('petjourney-navigator-style')).toBe('ladrilhos')
  })
})
