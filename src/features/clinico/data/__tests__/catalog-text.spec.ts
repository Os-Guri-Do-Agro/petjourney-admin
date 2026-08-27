/**
 * Contrato de completude da tradução do catálogo clínico.
 *
 * A regra que estes testes guardam: **traduzir não pode perder informação**. Numa interface,
 * uma chave faltando aparece como chave e alguém percebe. Num bulário, uma contraindicação a
 * menos aparece como bulário normal — e é lida como "não há mais nada a saber".
 *
 * Por isso a verificação é por quantidade, não só por presença: se a lista original tem quatro
 * contraindicações e a traduzida tem três, uma sumiu no caminho, e o merge do módulo descarta a
 * lista inteira em vez de mostrar três de quatro. O teste faz esse desencontro falhar aqui, e
 * não em produção.
 *
 * Cada expectativa compara uma **lista de faltas com a lista vazia**, e não um item por vez: o
 * relatório de falha passa a nomear tudo que falta de uma vez, em vez de parar no primeiro.
 *
 * O português não é verificado porque não é traduzido: ele é a fixture.
 */

import { describe, expect, it } from 'vitest'

import { LOCALES, type Locale } from '@/i18n/locales'

import { traduzirMedicamentos } from '../../domain/catalog-i18n'
import { TEXTO_DO_CATALOGO, type TextoDoCatalogo } from '../fixtures/catalog-text'
import { diagnosisCatalogFixture, examCatalogFixture } from '../fixtures/catalogs'
import { medicationsFixture } from '../fixtures/medications'

const IDIOMAS = LOCALES.filter((locale) => locale !== 'pt')

/** Listas do bulário que precisam sobreviver inteiras à tradução. */
const LISTAS = ['indicacoes', 'contraindicacoes', 'efeitosAdversos', 'interacoes'] as const

/** Campos de uma linha só que não podem chegar vazios. */
const TEXTOS = ['nome', 'principioAtivo', 'apresentacao', 'observacao'] as const

function catalogo(locale: Locale): TextoDoCatalogo {
  const texto = TEXTO_DO_CATALOGO[locale]

  if (!texto) {
    throw new Error(`catálogo ausente para ${locale}`)
  }

  return texto
}

describe.each(IDIOMAS)('catálogo clínico em %s', (locale) => {
  const texto = catalogo(locale)

  it('nomeia todos os diagnósticos', () => {
    const semNome = diagnosisCatalogFixture
      .filter((item) => !texto.diagnosticos[item.codigo])
      .map((item) => item.codigo)

    expect(semNome).toEqual([])
  })

  it('nomeia todos os exames', () => {
    const semNome = examCatalogFixture
      .filter((item) => !texto.exames[item.id])
      .map((item) => item.id)

    expect(semNome).toEqual([])
  })

  it('traz todos os medicamentos, com todos os campos de texto', () => {
    const faltando = medicationsFixture.flatMap((base) => {
      const traduzido = texto.medicamentos[base.id]

      if (!traduzido) {
        return [base.id]
      }

      return TEXTOS.filter((campo) => !traduzido[campo]).map(
        (campo) => `${base.id}.${campo}`,
      )
    })

    expect(faltando).toEqual([])
  })

  it('mantém o tamanho de cada lista do bulário', () => {
    const divergentes = medicationsFixture.flatMap((base) =>
      LISTAS.filter(
        (lista) => texto.medicamentos[base.id]?.[lista].length !== base[lista].length,
      ).map((lista) => `${base.id}.${lista}`),
    )

    expect(divergentes).toEqual([])
  })

  /** Nota de dose é o aviso que separa "cuidado" de "não use": não pode ficar em português. */
  it('traduz toda nota de faixa de dose', () => {
    const semNota = medicationsFixture.flatMap((base) =>
      base.doses
        .filter((dose) => dose.nota && !texto.medicamentos[base.id]?.notas?.[dose.especie])
        .map((dose) => `${base.id}.${dose.especie}`),
    )

    expect(semNota).toEqual([])
  })

  /** Nota traduzida sem nota original é aviso inventado — some no merge e engana quem revisa. */
  it('não inventa nota onde a fixture não tem', () => {
    const inventadas = medicationsFixture.flatMap((base) => {
      const comNota = new Set(base.doses.filter((dose) => dose.nota).map((dose) => dose.especie))

      return Object.keys(texto.medicamentos[base.id]?.notas ?? {})
        .filter((especie) => !comNota.has(especie as never))
        .map((especie) => `${base.id}.${especie}`)
    })

    expect(inventadas).toEqual([])
  })

  it('chega inteiro na sobreposição, sem cair de volta para o português', () => {
    const traduzidos = traduzirMedicamentos(medicationsFixture, texto)

    const recaidas = traduzidos.filter((medicamento) => {
      const esperado = texto.medicamentos[medicamento.id]

      return (
        medicamento.contraindicacoes !== esperado?.contraindicacoes ||
        medicamento.doses.length !== medicationsFixture.find((base) => base.id === medicamento.id)?.doses.length
      )
    })

    expect(recaidas.map((medicamento) => medicamento.id)).toEqual([])
  })
})

/**
 * O britânico é derivado do americano por tabela de grafia. O teste não confere a tabela toda —
 * confere que ela **rodou**, porque uma derivação que silenciosamente não aconteceu deixa
 * `en-GB` idêntico a `en` e ninguém repara.
 */
describe('inglês britânico', () => {
  it('aplica a grafia britânica sobre o texto americano', () => {
    expect(catalogo('en').medicamentos['med-amoxicilina']?.efeitosAdversos).toContain('Diarrhea')
    expect(catalogo('en-GB').medicamentos['med-amoxicilina']?.efeitosAdversos).toContain(
      'Diarrhoea',
    )
  })

  it('preserva a maiúscula do início da frase', () => {
    const britanico = catalogo('en-GB').medicamentos['med-furosemida']

    expect(britanico?.indicacoes[0]).toBe('Cardiogenic pulmonary oedema')
    expect(britanico?.efeitosAdversos).toContain('Hypokalaemia')
  })
})
