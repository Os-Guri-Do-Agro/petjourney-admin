/**
 * Toda chave de tradução usada pela internação existe — nos quatro idiomas.
 *
 * O `check:i18n` prova **paridade**: que os quatro arquivos têm o mesmo conjunto de chaves. Ele
 * não prova **existência**: uma chave digitada errada na tela some dos quatro arquivos ao mesmo
 * tempo, a paridade continua verde, e o `vue-i18n` desenha o caminho da chave na interface sem
 * reclamar. Foi assim que `retidoРRegra`, com um "P" cirílico no meio, passou por revisão de
 * tipos, build e teste.
 *
 * A varredura é textual de propósito. Ler os arquivos como fonte, e não como módulos, é o que
 * permite pegar a chave montada por template — `clinico.internacao.gravidade.${gravidade}` — pelo
 * prefixo, que é onde o erro de digitação costuma estar.
 */

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const RAIZ = process.cwd()

const ARQUIVOS = [
  ...fs
    .readdirSync(path.join(RAIZ, 'src/features/clinico/components/internacao'))
    .filter((nome) => nome.endsWith('.vue'))
    .map((nome) => `src/features/clinico/components/internacao/${nome}`),
  'src/features/clinico/stores/internacao.ts',
  'src/pages/(accounts)/veterinario/internacao.vue',
  'src/pages/(accounts)/veterinario/internacao/[internacaoId].vue',
]

const LOCALES = ['pt', 'en', 'en-GB', 'es']

/**
 * Só o que está dentro de `t(...)`.
 *
 * A primeira versão varria `clinico\.[\w.]+` no arquivo inteiro e colhia `clinico.pet(...)` — a
 * store, que se chama `clinico` e não tem nada com tradução. Casar a **chamada**, e não o texto
 * solto, é o que separa uma coisa da outra.
 */
const CHAMADA = /\bt\(\s*(['"`])([^'"`]*)\1/g

function carregar(locale: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(RAIZ, 'src/locales', `${locale}.json`), 'utf8'))
}

function existe(json: Record<string, unknown>, chave: string): boolean {
  let atual: unknown = json

  for (const parte of chave.split('.')) {
    if (typeof atual !== 'object' || atual === null || !(parte in atual)) {
      return false
    }

    atual = (atual as Record<string, unknown>)[parte]
  }

  return true
}

/**
 * As chaves citadas no código, já separadas em completas e por prefixo.
 *
 * Uma chave terminada em ponto veio de um template — `clinico.internacao.situacao.${situacao}` —
 * e do lado do locale só se pode exigir que o **grupo** exista e não esteja vazio.
 */
function chavesDoCodigo() {
  const completas = new Set<string>()
  const grupos = new Set<string>()

  for (const arquivo of ARQUIVOS) {
    const fonte = fs.readFileSync(path.join(RAIZ, arquivo), 'utf8')

    for (const encontro of fonte.matchAll(CHAMADA)) {
      const bruta = encontro[2] ?? ''

      if (!bruta.startsWith('clinico.')) {
        continue
      }

      const interpolacao = bruta.indexOf('${')

      if (interpolacao >= 0) {
        grupos.add(bruta.slice(0, interpolacao).replace(/\.$/, ''))
      } else {
        completas.add(bruta)
      }
    }
  }

  return { completas: [...completas].sort(), grupos: [...grupos].sort() }
}

describe('chaves de tradução da internação', () => {
  const { completas, grupos } = chavesDoCodigo()

  it('a varredura encontra o que deveria encontrar', () => {
    /* Guarda contra a própria varredura quebrar e o teste passar por vacuidade. */
    expect(completas.length).toBeGreaterThan(80)
    expect(completas).toContain('clinico.internacao.boletim.retidoRegra')
    expect(grupos).toContain('clinico.internacao.gravidade')
  })

  it.each(LOCALES)('%s tem todas as chaves citadas na tela', (locale) => {
    const json = carregar(locale)
    const faltando = completas.filter((chave) => !existe(json, chave))

    expect(faltando).toEqual([])
  })

  it.each(LOCALES)('%s tem os grupos montados por template', (locale) => {
    const json = carregar(locale)
    const faltando = grupos.filter((chave) => !existe(json, chave))

    expect(faltando).toEqual([])
  })

  /**
   * Chave que resolve para um objeto é chave incompleta.
   *
   * `t('clinico.internacao.gravidade')` desenharia `[object Object]` na tela sem erro nenhum — e
   * o teste acima passaria, porque o caminho existe.
   */
  it.each(LOCALES)('%s não usa como texto nada que seja um grupo', (locale) => {
    const json = carregar(locale)

    const objetos = completas.filter((chave) => {
      let atual: unknown = json

      for (const parte of chave.split('.')) {
        atual = (atual as Record<string, unknown>)?.[parte]
      }

      return typeof atual === 'object' && atual !== null
    })

    expect(objetos).toEqual([])
  })
})
