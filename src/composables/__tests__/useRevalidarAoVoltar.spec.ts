/**
 * A revalidação existe porque o acesso temporário muda em silêncio: o responsável tira uma
 * categoria, apaga um documento ou encurta a validade, e ninguém é notificado. Estes casos
 * cobrem as duas formas de errar — não reler quando devia, e reler a cada alt-tab.
 */

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { useRevalidarAoVoltar } from '@/composables/useRevalidarAoVoltar'

let visibilidade: DocumentVisibilityState = 'visible'

function montarCom(revalidar: () => void, intervaloMs?: number) {
  return mount(
    defineComponent({
      setup() {
        useRevalidarAoVoltar(revalidar, intervaloMs)
        return () => null
      },
    }),
  )
}

function mudarPara(estado: DocumentVisibilityState) {
  visibilidade = estado
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  visibilidade = 'visible'
  vi.useFakeTimers()
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilidade)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useRevalidarAoVoltar', () => {
  it('relê quando a aba volta a ficar visível', () => {
    const revalidar = vi.fn<() => void>()
    montarCom(revalidar)

    mudarPara('hidden')
    vi.advanceTimersByTime(60_000)
    mudarPara('visible')

    expect(revalidar).toHaveBeenCalledTimes(1)
  })

  it('não relê ao esconder a aba', () => {
    const revalidar = vi.fn<() => void>()
    montarCom(revalidar)

    vi.advanceTimersByTime(60_000)
    mudarPara('hidden')

    expect(revalidar).not.toHaveBeenCalled()
  })

  /** Alternar entre janelas não é intenção de atualizar. */
  it('respeita o intervalo mínimo entre releituras', () => {
    const revalidar = vi.fn<() => void>()
    montarCom(revalidar)

    mudarPara('hidden')
    vi.advanceTimersByTime(5_000)
    mudarPara('visible')

    expect(revalidar).not.toHaveBeenCalled()

    mudarPara('hidden')
    vi.advanceTimersByTime(31_000)
    mudarPara('visible')

    expect(revalidar).toHaveBeenCalledTimes(1)
  })

  /** A montagem já leu: voltar logo depois não pode disparar uma segunda chamada. */
  it('conta o intervalo a partir da montagem', () => {
    const revalidar = vi.fn<() => void>()
    montarCom(revalidar)

    mudarPara('visible')

    expect(revalidar).not.toHaveBeenCalled()
  })

  it('para de ouvir quando o componente sai', () => {
    const revalidar = vi.fn<() => void>()
    const wrapper = montarCom(revalidar)

    wrapper.unmount()
    vi.advanceTimersByTime(60_000)
    mudarPara('visible')

    expect(revalidar).not.toHaveBeenCalled()
  })
})
