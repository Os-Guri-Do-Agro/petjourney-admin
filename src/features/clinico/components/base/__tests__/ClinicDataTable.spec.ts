/**
 * A seta de abrir da tabela densa.
 *
 * A linha sempre abriu no duplo clique e no `Enter`, e nunca contou isso a ninguém: duplo clique
 * é convenção de grade de aplicativo desktop, e na web produz uma lista que parece inerte. A seta
 * é o anúncio dessa ação.
 *
 * Ela aparece **lendo o ouvinte** `@ativar`, e não por uma prop de opt-in, porque três das nove
 * telas que usam esta tabela não abrem linha nenhuma — nelas a seta seria promessa falsa. Essa
 * decisão é invisível no código de quem consome e fácil de quebrar sem perceber: quem trocasse a
 * detecção por `props.acoes.length` ou por um `v-if` mais frouxo passaria a desenhar seta morta em
 * `fila` e `faltas`, e ninguém notaria até alguém clicar. Daí estes testes.
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import ClinicDataTable from '../ClinicDataTable.vue'
import type { ColunaTabela } from '../table-types'

type Linha = { id: string; nome: string }

const LINHAS: Linha[] = [
  { id: 'a', nome: 'Bento' },
  { id: 'b', nome: 'Cacau' },
]

const COLUNAS: ColunaTabela<Linha>[] = [{ id: 'nome', rotulo: 'Nome' }]

const i18n = createI18n({
  legacy: false,
  locale: 'pt',
  messages: {
    pt: {
      clinico: {
        tabela: {
          abrir: 'Ver detalhes',
          acoes: 'Ações',
          carregando: 'Carregando…',
          tentarDeNovo: 'Tentar de novo',
          vazio: 'Nada por aqui',
        },
      },
    },
  },
})

function montar(ouvintes: Record<string, unknown> = {}) {
  /* O `T` da tabela não é inferido pelas props no `mount`: sem fixá-lo aqui, ele cai em `unknown`. */
  return mount(ClinicDataTable<Linha>, {
    props: { colunas: COLUNAS, linhas: LINHAS, chave: (linha: Linha) => linha.id, ...ouvintes },
    global: { plugins: [i18n] },
  })
}

const SETA = '.tabela__seta-abrir'

describe('a seta que anuncia que a linha abre', () => {
  it('desenha uma seta por linha quando alguém escuta ativar', () => {
    const wrapper = montar({ onAtivar: () => {} })

    expect(wrapper.findAll(SETA)).toHaveLength(LINHAS.length)
  })

  it('não desenha seta nenhuma quando a linha não leva a lugar nenhum', () => {
    const wrapper = montar()

    expect(wrapper.findAll(SETA)).toHaveLength(0)
  })

  it('emite ativar com a linha que foi apontada, e não com a primeira', async () => {
    const wrapper = montar({ onAtivar: () => {} })

    await wrapper.findAll(SETA)[1]!.trigger('click')

    expect(wrapper.emitted('ativar')?.[0]).toEqual([LINHAS[1]])
  })

  /*
   * O clique na seta não pode subir até a linha: lá ele viraria seleção, e a pessoa terminaria com
   * a linha aberta **e** marcada — dois efeitos para um gesto.
   */
  it('não seleciona a linha ao abrir pela seta', async () => {
    const wrapper = montar({ onAtivar: () => {} })

    await wrapper.findAll(SETA)[0]!.trigger('click')

    expect(wrapper.emitted('selecionar')).toBeUndefined()
  })

  /* É botão, e não ícone clicável: sem isso o teclado não chega nela e o leitor de tela não a lê. */
  it('expõe a seta como botão com rótulo acessível', () => {
    const seta = montar({ onAtivar: () => {} }).find(SETA)

    expect(seta.element.tagName).toBe('BUTTON')
    expect(seta.attributes('aria-label')).toBe('Ver detalhes')
  })
})
