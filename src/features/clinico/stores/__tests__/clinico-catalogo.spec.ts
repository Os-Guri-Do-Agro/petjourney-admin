/**
 * O catálogo clínico segue o idioma da tela, sem recarregar nada.
 *
 * A tradução do bulário só entrega o que promete se ela for **reativa**: trocar de idioma no
 * seletor tem que reescrever o nome do exame na conduta e a contraindicação no bulário na mesma
 * hora. Se dependesse de recarregar o catálogo, metade da tela ficaria num idioma e metade no
 * outro até alguém navegar para outra rota — que é como esse tipo de bug costuma passar pela
 * revisão.
 *
 * Este teste exercita a ponta que os testes de conteúdo não alcançam: a ligação entre o
 * `locale` do vue-i18n e os catálogos da store.
 */

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import type { Locale } from '@/i18n/locales'

import { useClinicoStore } from '../clinico'

const IDIOMA_ORIGINAL = i18n.global.locale.value as Locale

function trocarIdioma(locale: Locale) {
  i18n.global.locale.value = locale
}

describe('catálogo clínico da store', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    trocarIdioma('pt')
  })

  afterEach(() => {
    trocarIdioma(IDIOMA_ORIGINAL)
  })

  it('entrega diagnósticos, exames e bulário no idioma da tela', async () => {
    const clinico = useClinicoStore()

    await clinico.carregar()

    expect(clinico.diagnosticos.find((item) => item.codigo === 'GE-01')?.descricao).toBe(
      'Gastroenterite aguda',
    )
    expect(clinico.exames.find((item) => item.id === 'exame-urina')?.nome).toBe('Urinálise')
    expect(clinico.medicamento('med-dipirona')?.principioAtivo).toBe('Dipirona')

    trocarIdioma('en')

    expect(clinico.diagnosticos.find((item) => item.codigo === 'GE-01')?.descricao).toBe(
      'Acute gastroenteritis',
    )
    expect(clinico.exames.find((item) => item.id === 'exame-urina')?.nome).toBe('Urinalysis')
    expect(clinico.medicamento('med-dipirona')?.principioAtivo).toBe('Metamizole')

    trocarIdioma('es')

    expect(clinico.exames.find((item) => item.id === 'exame-urina')?.nome).toBe(
      'Análisis de orina',
    )
  })

  it('mantém a faixa de dose intacta ao traduzir o bulário', async () => {
    const clinico = useClinicoStore()

    await clinico.carregar()

    const emPortugues = clinico.medicamento('med-meloxicam')

    trocarIdioma('en')

    const emIngles = clinico.medicamento('med-meloxicam')

    expect(emIngles?.doses.map((dose) => dose.mgPorKg)).toEqual(
      emPortugues?.doses.map((dose) => dose.mgPorKg),
    )
    expect(emIngles?.doses.find((dose) => dose.especie === 'felina')?.nota).toContain(
      'one fifth',
    )
  })

  /**
   * O prontuário guarda a descrição do diagnóstico junto do código. O catálogo tem precedência
   * sobre o que ficou gravado; o gravado só aparece quando o código não é mais do catálogo.
   */
  it('renomeia o diagnóstico gravado pelo código, e cai no texto gravado quando não reconhece', async () => {
    const clinico = useClinicoStore()

    await clinico.carregar()
    trocarIdioma('en')

    expect(
      clinico.descricaoDoDiagnostico({ codigo: 'GE-01', descricao: 'Gastroenterite aguda' }),
    ).toBe('Acute gastroenteritis')

    expect(
      clinico.descricaoDoDiagnostico({ codigo: 'XX-99', descricao: 'Vindo de outro sistema' }),
    ).toBe('Vindo de outro sistema')
  })
})
