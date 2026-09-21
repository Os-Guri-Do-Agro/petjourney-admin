/**
 * Contrato dos documentos emitidos.
 *
 * O modo de falhar aqui é chato de achar: um `DocumentoId` novo sem tradução de cartão faz a
 * grade mostrar a **chave crua** (`clinico.documentos.cartao.x.titulo`) em vez do nome, e isso
 * passa por revisão porque parece um rótulo estranho, não um erro. Em quatro idiomas, passa
 * quatro vezes.
 */

import { describe, expect, it } from 'vitest'

import ar from '@/locales/ar.json'
import en from '@/locales/en.json'
import enGB from '@/locales/en-GB.json'
import es from '@/locales/es.json'
import pt from '@/locales/pt.json'
import sr from '@/locales/sr.json'

import type { DocumentoId, TermoKind } from '../documento-types'

/** A lista viva do contrato. Ao acrescentar um documento, ele entra aqui e o teste cobra o resto. */
const DOCUMENTOS: DocumentoId[] = [
  'prontuario',
  'receituario',
  'pedido-exame',
  'orientacoes',
  'encaminhamento',
  'relatorio-plano',
  'atestado-saude',
  'atestado-comparecimento',
  'atestado-viagem',
  'declaracao-obito',
  'comprovante-vacinacao',
  'termo-consentimento',
  'termo-recusa',
  'termo-eutanasia',
  'orcamento',
]

const TERMOS: TermoKind[] = ['consentimento', 'recusa', 'eutanasia']

const IDIOMAS = { pt, en, 'en-GB': enGB, es, sr, ar } as Record<string, typeof pt>

describe('cartões de documento', () => {
  it('todo documento tem título e descrição em todos os idiomas', () => {
    for (const [nome, dicionario] of Object.entries(IDIOMAS)) {
      const cartoes = dicionario.clinico.documentos.cartao as Record<
        string,
        { titulo?: string; descricao?: string }
      >

      for (const id of DOCUMENTOS) {
        expect(cartoes[id]?.titulo, `${nome} · ${id} · título`).toBeTruthy()
        expect(cartoes[id]?.descricao, `${nome} · ${id} · descrição`).toBeTruthy()
      }
    }
  })
})

describe('termos assinados pelo responsável', () => {
  it('cada termo tem declaração, itens e ciência', () => {
    for (const [nome, dicionario] of Object.entries(IDIOMAS)) {
      const termos = dicionario.clinico.documentos.termo as Record<
        string,
        { titulo?: string; declaracao?: string; itens?: string; ciencia?: string }
      >

      for (const kind of TERMOS) {
        expect(termos[kind]?.titulo, `${nome} · ${kind}`).toBeTruthy()
        expect(termos[kind]?.declaracao, `${nome} · ${kind}`).toBeTruthy()
        expect(termos[kind]?.ciencia, `${nome} · ${kind}`).toBeTruthy()
      }
    }
  })

  it('os itens vêm separados por barra, com pelo menos três', () => {
    /**
     * Os itens moram numa string separada por `|` para não virar array por idioma. Se alguém
     * traduzir esquecendo a barra, o termo sai com **um item só** — e um termo de consentimento
     * com um risco listado protege menos que nenhum.
     */
    for (const [nome, dicionario] of Object.entries(IDIOMAS)) {
      const termos = dicionario.clinico.documentos.termo as Record<string, { itens?: string }>

      for (const kind of TERMOS) {
        const itens = (termos[kind]?.itens ?? '').split('|').filter(Boolean)

        expect(itens.length, `${nome} · ${kind}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('a declaração cita responsável, paciente e objeto', () => {
    /** Termo genérico não protege ninguém: precisa dizer quem, sobre qual animal e do quê. */
    for (const [nome, dicionario] of Object.entries(IDIOMAS)) {
      const termos = dicionario.clinico.documentos.termo as Record<
        string,
        { declaracao?: string }
      >

      for (const kind of TERMOS) {
        const texto = termos[kind]?.declaracao ?? ''

        expect(texto, `${nome} · ${kind}`).toContain('{responsavel}')
        expect(texto, `${nome} · ${kind}`).toContain('{paciente}')
        expect(texto, `${nome} · ${kind}`).toContain('{objeto}')
      }
    }
  })
})
