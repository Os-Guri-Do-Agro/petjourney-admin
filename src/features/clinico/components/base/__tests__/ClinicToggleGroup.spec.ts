/**
 * Teclado do grupo de opções.
 *
 * É o componente que mais custa mouse no prontuário: oito sistemas × três opções no exame
 * físico. A afirmação de que ele era um `radiogroup` de verdade morava no comentário e não no
 * código — o Tab percorria as vinte e quatro opções e as setas não faziam nada.
 *
 * Estes testes guardam as três regras que fazem a diferença de velocidade.
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ClinicToggleGroup from '../ClinicToggleGroup.vue'

const OPCOES = [
  { valor: 'normal', rotulo: 'Normal' },
  { valor: 'alterado', rotulo: 'Alterado' },
  { valor: 'nao-avaliado', rotulo: 'Não avaliado' },
]

function montar(modelValue = 'normal') {
  return mount(ClinicToggleGroup, {
    props: { modelValue, opcoes: OPCOES, rotulo: 'Sistema' },
  })
}

function emitido(wrapper: ReturnType<typeof montar>) {
  /* Índice em vez de `at`: o alvo de tipos do projeto é anterior a ES2022. */
  const eventos = wrapper.emitted('update:modelValue')

  return eventos ? eventos[eventos.length - 1]?.[0] : undefined
}

describe('tabindex móvel', () => {
  it('deixa uma parada de Tab por grupo', () => {
    /**
     * O ganho estrutural: o grupo é **uma** pergunta. Com três paradas, atravessar o exame
     * físico custava vinte e quatro Tabs.
     */
    const wrapper = montar('alterado')
    const tabbaveis = wrapper
      .findAll('[role="radio"]')
      .filter((botao) => botao.attributes('tabindex') === '0')

    expect(tabbaveis).toHaveLength(1)
  })

  it('a parada é a opção escolhida', () => {
    const wrapper = montar('alterado')
    const botoes = wrapper.findAll('[role="radio"]')

    expect(botoes[1]?.attributes('tabindex')).toBe('0')
  })

  it('sem escolha, a porta de entrada é a primeira opção', () => {
    const wrapper = montar('')
    const botoes = wrapper.findAll('[role="radio"]')

    expect(botoes[0]?.attributes('tabindex')).toBe('0')
  })
})

describe('setas', () => {
  it('mover é escolher', async () => {
    /** Em radiogroup, navegar seleciona — separar as duas coisas obriga a um espaço a mais. */
    const wrapper = montar('normal')

    await wrapper.find('[role="radiogroup"]').trigger('keydown', { key: 'ArrowRight' })

    expect(emitido(wrapper)).toBe('alterado')
  })

  it('circula da última para a primeira', async () => {
    const wrapper = montar('nao-avaliado')

    await wrapper.find('[role="radiogroup"]').trigger('keydown', { key: 'ArrowRight' })

    expect(emitido(wrapper)).toBe('normal')
  })

  it('circula da primeira para a última', async () => {
    const wrapper = montar('normal')

    await wrapper.find('[role="radiogroup"]').trigger('keydown', { key: 'ArrowLeft' })

    expect(emitido(wrapper)).toBe('nao-avaliado')
  })

  it('Home e End vão às pontas', async () => {
    const wrapper = montar('alterado')
    const grupo = wrapper.find('[role="radiogroup"]')

    await grupo.trigger('keydown', { key: 'End' })
    expect(emitido(wrapper)).toBe('nao-avaliado')

    await grupo.trigger('keydown', { key: 'Home' })
    expect(emitido(wrapper)).toBe('normal')
  })
})

describe('número escolhe direto', () => {
  it('salta para a opção pelo índice', async () => {
    /** É a tecla que faz o exame físico andar: "1 2 1 1" preenche quatro sistemas. */
    const wrapper = montar('normal')

    await wrapper.find('[role="radiogroup"]').trigger('keydown', { key: '3' })

    expect(emitido(wrapper)).toBe('nao-avaliado')
  })

  it('ignora número fora da lista', async () => {
    const wrapper = montar('normal')

    await wrapper.find('[role="radiogroup"]').trigger('keydown', { key: '7' })

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})

describe('desabilitado', () => {
  it('não responde a tecla nenhuma', async () => {
    const wrapper = mount(ClinicToggleGroup, {
      props: { modelValue: 'normal', opcoes: OPCOES, rotulo: 'Sistema', desabilitado: true },
    })

    await wrapper.find('[role="radiogroup"]').trigger('keydown', { key: 'ArrowRight' })
    await wrapper.find('[role="radiogroup"]').trigger('keydown', { key: '2' })

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
