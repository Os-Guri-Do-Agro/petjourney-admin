/**
 * Concordância de número nas telas do hotel.
 *
 * A primeira rodada evitou o mecanismo de plural do projeto, e o preço apareceu na primeira
 * captura de tela: **"1 noites", "1 atrasadas", "1 diárias"**. Não é detalhe de acabamento — é o
 * tipo de erro que faz quem está olhando desconfiar de tudo o mais que está na tela.
 *
 * O que estes testes provam é o que o `check:i18n` não prova: que a chave **escolhe a forma**. A
 * paridade garante que sr tem três formas e ar tem seis; só a renderização garante que o número
 * chegou como terceiro argumento do `t()` no código da tela. Sem ele, o vue-i18n devolve sempre a
 * primeira forma — e o catálogo pluralizado produz o erro oposto ao que veio corrigir: "2 noite".
 */

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import { PLURAL_RULES } from '@/i18n/plural'
import pt from '@/locales/pt.json'

const RAIZ = process.cwd()

/** As chaves com plural, e o que cada forma precisa conter para um dado número. */
const CASOS = [
  { chave: 'hotel.hospedes.cartao.noites', um: 'noite', muitos: 'noites' },
  { chave: 'hotel.reserva.diarias', um: 'diária', muitos: 'diárias' },
  { chave: 'hotel.formato.dias', um: 'dia', muitos: 'dias', variavel: 'valor' },
  { chave: 'hotel.rotina.atrasadas', um: 'atrasada', muitos: 'atrasadas' },
  { chave: 'hotel.painel.resumo.atrasadas', um: 'atrasada', muitos: 'atrasadas' },
  { chave: 'hotel.hospedes.cartao.atrasadas', um: 'atrasada', muitos: 'atrasadas' },
  { chave: 'hotel.mapa.respostaSim', um: 'acomodação serve', muitos: 'acomodações servem' },
  { chave: 'hotel.resumo.reservas', um: 'reserva', muitos: 'reservas' },
  { chave: 'hotel.resumo.vezes', um: 'vez', muitos: 'vezes' },
  {
    chave: 'hotel.acomodacoes.resumo',
    um: 'acomodação cadastrada',
    muitos: 'acomodações cadastradas',
  },
  {
    chave: 'hotel.exigencias.bloqueado',
    um: 'documento impede',
    muitos: 'documentos impedem',
  },
  {
    chave: 'hotel.exigencias.venceDurante',
    um: 'dia antes da saída',
    muitos: 'dias antes da saída',
    variavel: 'dias',
  },
  { chave: 'hotel.mapa.respostaNao', um: 'noite', muitos: 'noites', variavel: 'noites' },
  { chave: 'hotel.acomodacoes.cabem', um: 'cabe', muitos: 'cabem' },
  /*
   * A frase-resumo do painel: o número mora num `<strong>` à parte, então é o rótulo que concorda.
   * A captura de apresentação mostrava "1 saem".
   */
  { chave: 'hotel.painel.resumo.chegam', um: 'chega', muitos: 'chegam' },
  { chave: 'hotel.painel.resumo.saem', um: 'sai', muitos: 'saem' },
  { chave: 'hotel.painel.resumo.tarefas', um: 'tarefa para', muitos: 'tarefas para' },
] as const

/**
 * O catálogo entra por `import`, e não por `JSON.parse`.
 *
 * Lido em tempo de execução ele chega como `any`, e o `createI18n` tenta inferir a forma das
 * mensagens a partir dele — com centenas de chaves aninhadas, o compilador estoura em "type
 * instantiation is excessively deep". Importado, o TypeScript já tem a forma pronta. É como o
 * `src/i18n/__tests__/i18n.spec.ts` faz, pelo mesmo motivo.
 */
const i18n = createI18n({
  legacy: false,
  locale: 'pt',
  fallbackLocale: false,
  messages: { pt },
  pluralRules: PLURAL_RULES,
  missingWarn: false,
  fallbackWarn: false,
})

const t = i18n.global.t as (chave: string, ...args: unknown[]) => string

describe('o português escolhe a forma certa', () => {
  it.each(CASOS)('$chave', ({ chave, um, muitos, ...resto }) => {
    const variavel = 'variavel' in resto ? (resto as { variavel: string }).variavel : 'total'

    const singular = t(chave, { [variavel]: 1 }, 1)
    const plural = t(chave, { [variavel]: 3 }, 3)

    expect(singular).toContain(um)
    expect(plural).toContain(muitos)

    /* E a forma do singular não é a do plural: é isso que "1 noites" violava. */
    expect(singular).not.toBe(plural)
  })
})

describe('toda chave com plural é chamada com o número', () => {
  /**
   * Varredura textual do código.
   *
   * Uma chave pluralizada chamada sem o terceiro argumento passa por typecheck, por build e pelo
   * `check:i18n` — e mostra a forma errada na tela. Só uma varredura pega isso, porque o erro é a
   * **ausência** de um argumento opcional.
   */
  function varrer(diretorio: string): string[] {
    return fs
      .readdirSync(path.join(RAIZ, diretorio), { withFileTypes: true })
      .flatMap((entrada) => {
        const caminho = `${diretorio}/${entrada.name}`

        if (entrada.isDirectory()) {
          return entrada.name === '__tests__' ? [] : varrer(caminho)
        }

        return /\.(vue|ts)$/.test(entrada.name) && !entrada.name.endsWith('.spec.ts')
          ? [caminho]
          : []
      })
  }

  const fontes = [...varrer('src/features/hotel'), ...varrer('src/pages/(accounts)/hotel')].map(
    (arquivo) => ({ arquivo, texto: fs.readFileSync(path.join(RAIZ, arquivo), 'utf8') }),
  )

  const comPlural = Object.entries(
    Object.fromEntries(
      Object.entries(pt.hotel).flatMap(([secao, valor]) =>
        achatar(valor as Record<string, unknown>, `hotel.${secao}.`),
      ),
    ),
  )
    .filter(([, valor]) => typeof valor === 'string' && valor.includes('|'))
    .map(([chave]) => chave)

  function achatar(objeto: Record<string, unknown>, prefixo: string): [string, unknown][] {
    return Object.entries(objeto).flatMap(([chave, valor]) =>
      valor && typeof valor === 'object'
        ? achatar(valor as Record<string, unknown>, `${prefixo}${chave}.`)
        : [[`${prefixo}${chave}`, valor] as [string, unknown]],
    )
  }

  it('a varredura encontra as chaves com plural', () => {
    expect(comPlural.length).toBeGreaterThanOrEqual(20)
  })

  it.each(comPlural)('%s recebe o número em toda chamada', (chave) => {
    const semContagem: string[] = []

    for (const { arquivo, texto } of fontes) {
      /*
       * Casa a chamada inteira, do `t(` até o `)` de fechamento no mesmo nível. Um contador de
       * parênteses é o que permite aceitar a quebra de linha que o Prettier insere nas chamadas
       * longas — que é justamente a forma das chamadas com três argumentos.
       */
      let posicao = texto.indexOf(`'${chave}'`)

      while (posicao >= 0) {
        const abertura = texto.lastIndexOf('t(', posicao)

        if (abertura < 0) {
          break
        }

        let nivel = 0
        let fim = abertura + 1

        for (; fim < texto.length; fim += 1) {
          if (texto[fim] === '(') nivel += 1
          if (texto[fim] === ')') {
            nivel -= 1

            if (nivel === 0) break
          }
        }

        const chamada = texto.slice(abertura, fim + 1)

        /* Três argumentos no nível de cima: a chave, os valores e a contagem. */
        const virgulasNoTopo = contarVirgulasNoTopo(chamada)

        if (virgulasNoTopo < 2) {
          semContagem.push(`${arquivo}: ${chamada.replace(/\s+/g, ' ').slice(0, 90)}`)
        }

        posicao = texto.indexOf(`'${chave}'`, fim)
      }
    }

    expect(semContagem).toEqual([])
  })

  function contarVirgulasNoTopo(chamada: string): number {
    let nivel = 0
    let virgulas = 0

    for (const caractere of chamada.slice(2, -1)) {
      if (caractere === '(' || caractere === '{' || caractere === '[') nivel += 1
      if (caractere === ')' || caractere === '}' || caractere === ']') nivel -= 1
      if (caractere === ',' && nivel === 0) virgulas += 1
    }

    return virgulas
  }
})
