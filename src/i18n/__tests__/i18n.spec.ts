/**
 * Contrato do sérvio e do árabe.
 *
 * O que estes testes guardam é o que não aparece no typecheck: uma forma de plural a menos só
 * troca a palavra certa pela errada, e um placeholder mal escrito aparece como `{n}` na tela.
 * Por isso o catálogo inteiro é renderizado com o vue-i18n de verdade, com números de cada
 * categoria de plural dos dois idiomas.
 */

import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import ar from '@/locales/ar.json'
import en from '@/locales/en.json'
import pt from '@/locales/pt.json'
import sr from '@/locales/sr.json'

import { API_LOCALE, HTML_LANG, INTL_LOCALE, LOCALES, isRTLLocale } from '../locales'
import {
  PLURAL_RULES,
  arabicPluralRule,
  portuguesePluralRule,
  serbianPluralRule,
} from '../plural'
import { matchLocaleTag } from '../resolve'

type Catalogo = Record<string, unknown>

function folhas(objeto: Catalogo, prefixo = ''): [string, string][] {
  return Object.entries(objeto).flatMap(([chave, valor]) =>
    valor && typeof valor === 'object'
      ? folhas(valor as Catalogo, `${prefixo}${chave}.`)
      : [[`${prefixo}${chave}`, String(valor)] as [string, string]],
  )
}

const placeholders = (texto: string) =>
  [...texto.matchAll(/\{\s*([A-Za-z_]\w*)\s*\}/g)].map((achado) => achado[1] as string)

describe('detecção do idioma do navegador', () => {
  it('casa pela primeira subtag', () => {
    expect(matchLocaleTag('sr')).toBe('sr')
    expect(matchLocaleTag('sr-Latn-RS')).toBe('sr')
    expect(matchLocaleTag('sr-Cyrl')).toBe('sr')
    expect(matchLocaleTag('ar')).toBe('ar')
    expect(matchLocaleTag('ar-EG')).toBe('ar')
    expect(matchLocaleTag('pt-BR')).toBe('pt')
    expect(matchLocaleTag('es-419')).toBe('es')
    expect(matchLocaleTag('en-US')).toBe('en')
    expect(matchLocaleTag('en-GB')).toBe('en-GB')
    expect(matchLocaleTag('en_GB')).toBe('en-GB')
  })

  it('não confunde idioma que só começa com as mesmas letras', () => {
    /* sranan e mapudungun: `startsWith('sr')` e `startsWith('ar')` casariam os dois. */
    expect(matchLocaleTag('srn')).toBeNull()
    expect(matchLocaleTag('arn')).toBeNull()
    expect(matchLocaleTag('fr-FR')).toBeNull()
  })
})

describe('tags por idioma', () => {
  it('todo idioma tem tag de Intl, de API e de <html lang>', () => {
    const semTag = LOCALES.filter(
      (locale) => !INTL_LOCALE[locale] || !API_LOCALE[locale] || !HTML_LANG[locale],
    )

    expect(semTag).toEqual([])
  })

  it('sérvio formata em latim e árabe com dígitos 0-9', () => {
    const setembro = new Date(Date.UTC(2026, 8, 17, 12))

    expect(new Intl.DateTimeFormat(INTL_LOCALE.sr, { month: 'long' }).format(setembro)).toBe(
      'septembar',
    )
    expect(new Intl.NumberFormat(INTL_LOCALE.ar).format(1234.5)).toMatch(/^[\d.,٫٬]+$/)
    expect(new Intl.NumberFormat(INTL_LOCALE.ar).format(1234.5)).not.toMatch(/[٠-٩]/)
  })

  it('só o árabe espelha o layout', () => {
    expect(LOCALES.filter(isRTLLocale)).toEqual(['ar'])
  })
})

describe('regras de plural', () => {
  it('sérvio: one / few / other', () => {
    const forma = (n: number) => serbianPluralRule(n, 3)

    expect([1, 21, 101].map(forma)).toEqual([0, 0, 0])
    expect([2, 3, 4, 22, 24].map(forma)).toEqual([1, 1, 1, 1, 1])
    expect([0, 5, 11, 12, 14, 20, 25, 100].map(forma)).toEqual([2, 2, 2, 2, 2, 2, 2, 2])
    expect(forma(0.5)).toBe(2)
  })

  it('sérvio com forma de zero na origem: zero / one / few / other', () => {
    const forma = (n: number) => serbianPluralRule(n, 4)

    expect([0, 1, 2, 5, 21].map(forma)).toEqual([0, 1, 2, 3, 1])
  })

  it('árabe: zero / one / two / few / many / other', () => {
    const forma = (n: number) => arabicPluralRule(n, 6)

    expect([0, 1, 2, 3, 10, 11, 99, 100, 101, 102].map(forma)).toEqual([
      0, 1, 2, 3, 3, 4, 4, 5, 5, 5,
    ])
  })

  it('português: inteiro como o vue-i18n; com decimais, a parte inteira decide', () => {
    const duas = (n: number) => portuguesePluralRule(n, 2)
    const tres = (n: number) => portuguesePluralRule(n, 3)

    /* "comprimido | comprimidos": 0 e 2+ no plural, como sempre. */
    expect([0, 1, 2, 5].map(duas)).toEqual([1, 0, 1, 1])
    /* "0,66 comprimido", "1,5 comprimido", "2,5 comprimidos". */
    expect([0.66, 1.5, 1.99, 2.5].map(duas)).toEqual([0, 0, 0, 1])
    expect([0, 1, 2, 7, 0.5, 2.5].map(tres)).toEqual([0, 1, 2, 2, 1, 2])
  })
})

describe.each([
  ['sr', sr, [3, 4]],
  ['ar', ar, [6]],
] as const)('catálogo %s', (lang, catalogo, formasPermitidas) => {
  const traduzidas = new Map(folhas(catalogo as Catalogo))
  const origem = folhas(en as Catalogo)

  it('tem exatamente as chaves do português', () => {
    expect([...traduzidas.keys()].sort()).toEqual(folhas(pt as Catalogo).map(([k]) => k).sort())
  })

  it('mantém os placeholders do inglês aprovado', () => {
    const conjunto = (texto: string) => [...new Set(placeholders(texto))].sort().join()
    const divergentes = origem
      .filter(([chave, texto]) => conjunto(traduzidas.get(chave) ?? '') !== conjunto(texto))
      .map(([chave]) => chave)

    expect(divergentes).toEqual([])
  })

  it('renderiza todas as chaves, com números de cada categoria de plural', () => {
    const i18n = createI18n({
      legacy: false,
      locale: lang,
      fallbackLocale: false,
      messages: { [lang]: catalogo },
      pluralRules: PLURAL_RULES,
      missingWarn: false,
      fallbackWarn: false,
    })
    const t = i18n.global.t as (chave: string, ...args: unknown[]) => string
    const problemas: string[] = []

    for (const [chave, texto] of traduzidas) {
      /* Lista separada por `|`, lida com `tm()`: não passa pelo plural. */
      if (/^clinico\.documentos\.termo\.[^.]+\.itens$/.test(chave)) {
        continue
      }

      const variaveis = placeholders(texto)
      const formas = texto.split('|').length

      if (formas > 1 && !(formasPermitidas as readonly number[]).includes(formas)) {
        problemas.push(`${chave}: ${formas} formas`)
        continue
      }

      const numeros = formas > 1 ? [0, 1, 2, 3, 5, 11, 21, 22, 100, 101, 0.5] : [7]

      for (const n of numeros) {
        const valores = Object.fromEntries(variaveis.map((nome) => [nome, n]))
        const saida = formas > 1 ? t(chave, valores, n) : t(chave, valores)

        if (saida === chave || /[{}|]/.test(saida)) {
          problemas.push(`${chave} (n=${n}): ${saida}`)
          break
        }
      }
    }

    expect(problemas).toEqual([])
  })
})
