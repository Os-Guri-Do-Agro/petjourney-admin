import { describe, expect, it } from 'vitest'

import { tituloDoDia } from '@/components/home/pauta-tabela'

/* Um `t` que devolve a chave e os valores, para a ordem dos assuntos ficar à vista. */
function t(chave: string, valores?: Record<string, unknown>) {
  if (chave === 'clinico.meuDia.resumo.recepcao') return `${valores?.total} na recepção`
  if (chave === 'clinico.meuDia.resumo.eMais') return `${valores?.assunto} e mais ${valores?.total}`
  return chave
}

describe('tituloDoDia', () => {
  it('sem nada parado, diz que o dia está em dia', () => {
    expect(tituloDoDia(t, [], 0)).toBe('clinico.meuDia.resumo.emDia')
  })

  it('com um assunto só, o título é o próprio assunto, com maiúscula', () => {
    expect(tituloDoDia(t, [{ frase: '5 prontuários em rascunho', tom: 'neutro' }], 0)).toBe(
      '5 prontuários em rascunho',
    )
    expect(tituloDoDia(t, [{ frase: 'mel internado pede atenção', tom: 'risco' }], 0)).toBe(
      'Mel internado pede atenção',
    )
  })

  it('o urgente vem antes da recepção, e a recepção antes do resto', () => {
    const linhas = [
      { frase: '5 prontuários em rascunho', tom: 'neutro' as const },
      { frase: 'Bob internado pede atenção', tom: 'risco' as const },
    ]
    expect(tituloDoDia(t, linhas, 2)).toBe('Bob internado pede atenção e mais 2')
    expect(tituloDoDia(t, [linhas[0]!], 2)).toBe('2 na recepção e mais 1')
  })
})
