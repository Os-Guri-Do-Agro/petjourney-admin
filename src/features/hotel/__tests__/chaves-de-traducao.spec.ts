/**
 * Toda chave de tradução usada pelo hotel existe — nos seis idiomas.
 *
 * O `check:i18n` prova **paridade**: que os seis arquivos têm o mesmo conjunto de chaves. Ele não
 * prova **existência**: uma chave digitada errada na tela some dos seis arquivos ao mesmo tempo, a
 * paridade continua verde, e o `vue-i18n` desenha o caminho da chave na interface sem reclamar.
 *
 * Foi exatamente assim que a seção clínica do menu passou meses se chamando `clinico.modulo` — a
 * chave existia e resolvia para um **objeto**, e nem o typecheck, nem o build, nem o teste olham
 * para o valor. O último `it` deste arquivo é o que impede a repetição; ele nasce aqui varrendo o
 * módulo inteiro, e não uma pasta só, que foi o buraco por onde o defeito escapou da primeira vez.
 *
 * A varredura é textual de propósito. Ler os arquivos como fonte, e não como módulos, é o que
 * permite pegar a chave montada por template — `hotel.impedimento.${impedimento}` — pelo prefixo,
 * que é onde o erro de digitação costuma estar.
 */

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const RAIZ = process.cwd()
const LOCALES = ['pt', 'en', 'en-GB', 'es', 'sr', 'ar']

/** Todo `.vue` e `.ts` do módulo, mais as páginas que o consomem. */
function varrer(diretorio: string): string[] {
  return fs.readdirSync(path.join(RAIZ, diretorio), { withFileTypes: true }).flatMap((entrada) => {
    const caminho = `${diretorio}/${entrada.name}`

    if (entrada.isDirectory()) {
      return entrada.name === '__tests__' ? [] : varrer(caminho)
    }

    return /\.(vue|ts)$/.test(entrada.name) && !entrada.name.endsWith('.spec.ts') ? [caminho] : []
  })
}

const ARQUIVOS = [
  ...varrer('src/features/hotel'),
  ...varrer('src/pages/(accounts)/hotel'),
  'src/composables/useAppNavigation.ts',
  'src/App.vue',
]

/**
 * Só o que está dentro de `t(...)`.
 *
 * Casar a **chamada**, e não o texto solto, é o que evita colher um `hotel.acomodacao(...)` de
 * store — método que se parece com uma chave e não tem nada com tradução.
 */
const CHAMADA = /\bt\(\s*(['"`])([^'"`]*)\1/g

/** E o que a fábrica `porKind` monta: `hotel.<prefixo>.<kind>`. */
const POR_KIND = /porKind<[^>]*>\(\s*'([^']+)'\s*\)/g

function carregar(locale: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(RAIZ, 'src/locales', `${locale}.json`), 'utf8'))
}

function valorDe(json: Record<string, unknown>, chave: string): unknown {
  let atual: unknown = json

  for (const parte of chave.split('.')) {
    if (typeof atual !== 'object' || atual === null || !(parte in atual)) {
      return undefined
    }

    atual = (atual as Record<string, unknown>)[parte]
  }

  return atual
}

function chavesDoCodigo() {
  const completas = new Set<string>()
  const grupos = new Set<string>()

  for (const arquivo of ARQUIVOS) {
    const fonte = fs.readFileSync(path.join(RAIZ, arquivo), 'utf8')

    for (const encontro of fonte.matchAll(CHAMADA)) {
      const bruta = encontro[2] ?? ''

      if (!bruta.startsWith('hotel.')) {
        continue
      }

      const interpolacao = bruta.indexOf('${')

      if (interpolacao >= 0) {
        grupos.add(bruta.slice(0, interpolacao).replace(/\.$/, ''))
      } else {
        completas.add(bruta)
      }
    }

    for (const encontro of fonte.matchAll(POR_KIND)) {
      grupos.add(`hotel.${encontro[1]}`)
    }
  }

  return { completas: [...completas].sort(), grupos: [...grupos].sort() }
}

describe('chaves de tradução do hotel', () => {
  const { completas, grupos } = chavesDoCodigo()

  it('a varredura encontra o que deveria encontrar', () => {
    /* Guarda contra a própria varredura quebrar e o teste passar por vacuidade. */
    expect(completas.length).toBeGreaterThan(200)
    expect(completas).toContain('hotel.reserva.fazerCheckIn')
    expect(grupos).toContain('hotel.impedimento')
    expect(grupos).toContain('hotel.situacaoExigencia')
  })

  it.each(LOCALES)('%s tem todas as chaves citadas na tela', (locale) => {
    const json = carregar(locale)
    const faltando = completas.filter((chave) => valorDe(json, chave) === undefined)

    expect(faltando).toEqual([])
  })

  it.each(LOCALES)('%s tem os grupos montados por template', (locale) => {
    const json = carregar(locale)
    const faltando = grupos.filter((chave) => valorDe(json, chave) === undefined)

    expect(faltando).toEqual([])
  })

  /**
   * Chave que resolve para um objeto é chave incompleta.
   *
   * `t('hotel.turno')` desenharia o caminho da chave na tela sem erro nenhum — e o teste acima
   * passaria, porque o caminho existe. É o defeito exato que a seção clínica do menu teve.
   */
  it.each(LOCALES)('%s não usa como texto nada que seja um grupo', (locale) => {
    const json = carregar(locale)

    const objetos = completas.filter((chave) => {
      const valor = valorDe(json, chave)

      return typeof valor === 'object' && valor !== null
    })

    expect(objetos).toEqual([])
  })

  /** E o contrário: grupo montado por template precisa ter filhos, não ser texto. */
  it.each(LOCALES)('%s tem grupos que de fato são grupos', (locale) => {
    const json = carregar(locale)

    const naoSaoGrupos = grupos.filter((chave) => {
      const valor = valorDe(json, chave)

      return typeof valor !== 'object' || valor === null || Object.keys(valor).length === 0
    })

    expect(naoSaoGrupos).toEqual([])
  })
})
