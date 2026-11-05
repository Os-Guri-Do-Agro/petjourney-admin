import { describe, expect, it } from 'vitest'

import { nomeDoDia, quandoCurto, textoDaFaixa } from '../leitura-da-fila'

const t = (chave: string, valores: Record<string, string>) =>
  chave === 'fila.diasDe'
    ? `${valores.de} a ${valores.ate}`
    : `${valores.dias} ${valores.inicio} a ${valores.fim}`

describe('leitura da fila', () => {
  it('o dia da semana no idioma da sessão, de domingo (0) a sábado (6)', () => {
    expect(nomeDoDia(0, 'pt-BR', 'long')).toBe('domingo')
    expect(nomeDoDia(5, 'pt-BR', 'long')).toBe('sexta-feira')
  })

  it('as janelas agrupadas pela API viram uma frase', () => {
    expect(textoDaFaixa({ de: 1, ate: 5, inicio: '14:00', fim: '18:00' }, 'pt-BR', t)).toBe(
      'seg. a sex. 14:00 a 18:00',
    )
    expect(textoDaFaixa({ de: 6, ate: 6, inicio: '08:00', fim: '12:00' }, 'pt-BR', t)).toBe(
      'sáb. 08:00 a 12:00',
    )
  })

  it('o horário do instante sai do próprio texto, sem fuso do navegador', () => {
    expect(quandoCurto('2026-11-06T09:00:00-04:00', 'pt-BR')).toMatch(/^Sex\.?, 06\/11 · 09:00$/)
  })
})
