/**
 * O cadastro de paciente desenha, valida e salva.
 *
 * `vue-tsc` prova que o template casa com os tipos; não prova que a tela aparece. Slot com nome
 * errado, chave de tradução que resolve para um objeto e `v-for` sobre campo vazio passam pelos
 * tipos e chegam à apresentação — e este formulário tem os três: slots de `ClinicField`, sete
 * chaves de dica por tipo de alerta e uma lista de alertas em edição.
 *
 * O que se afirma aqui é o que separa este cadastro do anterior: **o obrigatório não cresceu**
 * com os campos novos, o dado clínico chega ao paciente criado, e o cadastro repetido é avisado
 * antes de nascer em vez de depois.
 */

import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import i18n from '@/i18n'

import PacienteNovoForm from '../PacienteNovoForm.vue'
import { setMockConfig } from '../../../data/mock-runtime'
import { getDataset, resetDataset } from '../../../data/store'
import { useClinicoStore } from '../../../stores/clinico'

const COM_I18N = { plugins: [i18n, PrimeVue] }

/*
 * O idioma é fixado aqui porque o `i18n` é um singleton que decide o locale inicial pelo
 * navegador — e o jsdom se apresenta em inglês. As afirmações abaixo são sobre frases em
 * português; sem esta linha, elas falhariam por motivo nenhum.
 */
i18n.global.locale.value = 'pt'

async function montarCompleto() {
  const clinico = useClinicoStore()

  await clinico.carregar(true)

  const wrapper = mount(PacienteNovoForm, { props: { modo: 'completo' }, global: COM_I18N })

  await nextTick()

  return wrapper
}

/** O `v-model` de um `InputText` do PrimeVue: o valor entra pelo `input` de dentro. */
async function digitar(wrapper: ReturnType<typeof mount>, rotulo: string, valor: string) {
  const campo = wrapper
    .findAll('.campo')
    .find((item) => item.find('.campo__rotulo').text().startsWith(rotulo))

  if (!campo) {
    throw new Error(`campo não encontrado: ${rotulo}`)
  }

  const input = campo.find('input')

  await input.setValue(valor)
  await nextTick()
}

/**
 * Espera o formulário terminar de salvar.
 *
 * Salvar não é uma promessa só: o repositório cria, a store recarrega o catálogo e só então o
 * `criado` sai. Um `await nextTick()` cobre a primeira e perde as outras duas — e um
 * `setTimeout` de duração arbitrária troca o teste que falha sempre pelo que falha às vezes.
 */
async function ateEmitirCriado(wrapper: ReturnType<typeof mount>) {
  for (let tentativa = 0; tentativa < 50; tentativa += 1) {
    if (wrapper.emitted('criado')) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  throw new Error('o formulário não emitiu "criado"')
}

beforeEach(() => {
  setActivePinia(createPinia())
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
  document.body.innerHTML = ''
})

describe('cadastro completo de paciente', () => {
  it('desenha as seções sem vazar chave de tradução', async () => {
    const wrapper = await montarCompleto()
    const texto = wrapper.text()

    expect(texto).toContain('Identificação')
    expect(texto).toContain('Alertas clínicos')
    expect(texto).toContain('Responsável')
    expect(texto).toContain('Microchip')
    expect(texto).toContain('CEP')
    expect(texto).not.toContain('clinico.paciente')
    expect(texto).not.toContain('[object Object]')
  })

  it('mostra uma ficha por tipo de alerta, com a dica própria de cada um', async () => {
    const wrapper = await montarCompleto()
    const fichas = wrapper.findAll('.ficha')

    expect(fichas).toHaveLength(7)

    const alergia = fichas.find((ficha) => ficha.text().includes('Alergia'))!

    await alergia.trigger('click')
    await nextTick()

    /* A dica é por tipo: "qual princípio ativo" e "qual condição" não são a mesma pergunta. */
    const detalhe = wrapper.find('.alerta input')

    expect(detalhe.attributes('placeholder')).toContain('princípio ativo')
  })

  it('não deixa salvar sem nome, e diz o que falta', async () => {
    const wrapper = await montarCompleto()

    await wrapper.find('form').trigger('submit')
    await nextTick()

    expect(wrapper.text()).toContain('Campo obrigatório')
    expect(getDataset().pets.some((pet) => pet.nome === '')).toBe(false)
  })

  it('recusa CPF inválido e aceita o rascunho quando o campo fica em branco', async () => {
    const wrapper = await montarCompleto()

    await digitar(wrapper, 'Nome do paciente', 'Quindim')
    await digitar(wrapper, 'Nome do responsável', 'Fulano de Tal')
    await digitar(wrapper, 'Telefone', '11984221030')
    await digitar(wrapper, 'CPF', '11111111111')

    await wrapper.find('form').trigger('submit')
    await nextTick()

    expect(wrapper.text()).toContain('CPF inválido')

    /* Em branco é resposta honesta: o mesmo rascunho sem CPF passa. */
    await digitar(wrapper, 'CPF', '')
    await nextTick()

    expect(wrapper.text()).not.toContain('CPF inválido')
  })

  it('avisa do responsável repetido antes de criar o segundo cadastro', async () => {
    const wrapper = await montarCompleto()
    const jaExiste = getDataset().tutores[0]!

    await digitar(wrapper, 'Telefone', jaExiste.telefone)

    expect(wrapper.text()).toContain('Já existe um responsável parecido')
    expect(wrapper.text()).toContain(jaExiste.nome)

    /* "Usar este" troca para o cadastro existente e o formulário para de pedir os dados dele. */
    await wrapper.find('.repetido__linha button').trigger('click')
    await nextTick()

    expect(wrapper.find('.repetido').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Nome do responsável')
  })

  it('leva microchip, pelagem e alerta para o paciente criado', async () => {
    const wrapper = await montarCompleto()

    await digitar(wrapper, 'Nome do paciente', 'Quindim')
    await digitar(wrapper, 'Microchip', '900215000111222')
    await digitar(wrapper, 'Pelagem', 'Tricolor, pelo curto')
    await digitar(wrapper, 'Nome do responsável', 'Fulano de Tal')
    await digitar(wrapper, 'Telefone', '11984221030')

    const alergia = wrapper.findAll('.ficha').find((ficha) => ficha.text().includes('Alergia'))!

    await alergia.trigger('click')
    await wrapper.find('.alerta input').setValue('Amoxicilina')

    await wrapper.find('form').trigger('submit')
    await ateEmitirCriado(wrapper)

    const criado = getDataset().pets.find((pet) => pet.nome === 'Quindim')!

    expect(criado).toBeDefined()
    expect(criado.microchip).toBe('900215000111222')
    expect(criado.pelagem).toBe('Tricolor, pelo curto')
    expect(criado.alertas).toHaveLength(1)
    expect(criado.alertas[0]!.kind).toBe('alergia')
    /* Alergia nasce em risco: é o padrão que faz o alerta existir no dia corrido. */
    expect(criado.alertas[0]!.severidade).toBe('risco')
    expect(criado.alertas[0]!.detalhe).toBe('Amoxicilina')

    const responsavel = getDataset().tutores.find((item) => item.id === criado.tutorId)!

    expect(responsavel.nome).toBe('Fulano de Tal')
    expect(wrapper.emitted('criado')).toHaveLength(1)
  })
})

describe('os dois caminhos do responsável', () => {
  /** A opção do `radiogroup` pelo texto — é assim que quem usa a tela a encontra. */
  function caminho(wrapper: ReturnType<typeof mount>, rotulo: string) {
    const opcao = wrapper.findAll('[role="radio"]').find((item) => item.text().trim() === rotulo)

    if (!opcao) {
      throw new Error(`caminho não encontrado: ${rotulo}`)
    }

    return opcao
  }

  it('mostra a escolha em vez de escondê-la dentro do seletor', async () => {
    const wrapper = await montarCompleto()

    expect(caminho(wrapper, 'Novo responsável').attributes('aria-checked')).toBe('true')
    expect(caminho(wrapper, 'Já cadastrado').exists()).toBe(true)
  })

  it('troca de caminho troca o que a tela pede', async () => {
    const wrapper = await montarCompleto()

    expect(wrapper.text()).toContain('Nome do responsável')

    await caminho(wrapper, 'Já cadastrado').trigger('click')
    await nextTick()

    expect(wrapper.text()).not.toContain('Nome do responsável')
    expect(wrapper.text()).toContain('Quem responde pelo paciente')
  })

  it('não deixa escolher "já cadastrado" e não escolher ninguém', async () => {
    /*
     * O buraco que a escolha explícita criou: com o seletor antigo, "ninguém selecionado"
     * *significava* responsável novo, e o meio do caminho não existia. Agora existe, e um
     * paciente sem responsável é um paciente que ninguém consegue avisar.
     */
    const wrapper = await montarCompleto()

    await caminho(wrapper, 'Já cadastrado').trigger('click')
    await digitar(wrapper, 'Nome do paciente', 'Quindim')

    await wrapper.find('form').trigger('submit')
    await nextTick()

    expect(wrapper.text()).toContain('Campo obrigatório')
    expect(getDataset().pets.some((pet) => pet.nome === 'Quindim')).toBe(false)
  })

  it('liga o paciente novo a um responsável que já existe, sem duplicá-lo', async () => {
    /*
     * O caso mais comum da clínica: cliente antigo com bicho novo. Aqui ele entra pelo aviso de
     * repetido — digitar um telefone conhecido oferece o cadastro que já existe, e "Usar este"
     * troca de caminho e escolhe a pessoa de uma vez.
     */
    const wrapper = await montarCompleto()
    const jaExiste = getDataset().tutores[0]!
    const quantosAntes = getDataset().tutores.length

    await digitar(wrapper, 'Telefone', jaExiste.telefone)
    await wrapper.find('.repetido__linha button').trigger('click')
    await nextTick()

    await digitar(wrapper, 'Nome do paciente', 'Quindim')
    await wrapper.find('form').trigger('submit')
    await ateEmitirCriado(wrapper)

    const criado = getDataset().pets.find((pet) => pet.nome === 'Quindim')!

    expect(criado).toBeDefined()
    expect(criado.tutorId).toBe(jaExiste.id)
    /* Nenhum segundo cadastro da mesma pessoa: é esse o defeito que o caminho existe para evitar. */
    expect(getDataset().tutores).toHaveLength(quantosAntes)
  })
})

describe('rascunho para a prévia', () => {
  /** O último rascunho emitido, por índice: a `lib` deste projeto não tem `Array.at`. */
  function ultimoRascunho(wrapper: ReturnType<typeof mount>) {
    const emitidos = wrapper.emitted('rascunho')!

    return emitidos[emitidos.length - 1]![0]
  }

  it('sai já na primeira renderização, antes de alguém digitar', async () => {
    /*
     * A prévia desenha a ficha vazia desde o primeiro segundo — e para isso precisa do rascunho
     * antes da primeira tecla. Sem o `immediate`, a coluna da direita nasceria em branco e só
     * apareceria quando alguém digitasse, que é exatamente o instante em que ela deixa de ser
     * necessária para decidir se vale preencher.
     */
    const wrapper = await montarCompleto()
    const primeiro = wrapper.emitted('rascunho')![0]![0] as { pet: { nome: string } }

    expect(primeiro.pet.nome).toBe('')
  })

  it('carrega o que a prévia desenha, na forma de um paciente de verdade', async () => {
    const wrapper = await montarCompleto()

    await digitar(wrapper, 'Nome do paciente', 'Quindim')
    await digitar(wrapper, 'Pelagem', 'Tricolor, pelo curto')
    await digitar(wrapper, 'Nome do responsável', 'Fulano de Tal')

    const alergia = wrapper.findAll('.ficha').find((ficha) => ficha.text().includes('Alergia'))!

    await alergia.trigger('click')
    await nextTick()

    const ultimo = ultimoRascunho(wrapper) as {
      pet: { nome: string; iniciais: string; pelagem: string; alertas: unknown[] }
      tutor: { nome: string } | null
    }

    expect(ultimo.pet.nome).toBe('Quindim')
    expect(ultimo.pet.pelagem).toBe('Tricolor, pelo curto')
    expect(ultimo.pet.alertas).toHaveLength(1)
    expect(ultimo.tutor?.nome).toBe('Fulano de Tal')
    /* As iniciais do avatar precisam existir antes do paciente existir. */
    expect(ultimo.pet.iniciais).toBe('QU')
  })
})

describe('cadastro rápido, no meio do agendamento', () => {
  async function montarRapido() {
    const clinico = useClinicoStore()

    await clinico.carregar(true)

    const wrapper = mount(PacienteNovoForm, { global: COM_I18N })

    await nextTick()

    return wrapper
  }

  it('pede só o que cabe num diálogo, sem sanfona', async () => {
    const wrapper = await montarRapido()

    /*
     * O que não pode acontecer: o balcão no telefone ganhar vinte campos. O obrigatório é o
     * mesmo dos dois lados, mas o que está à vista não é — e o que não está à vista aqui não
     * está escondido atrás de um botão, está na página de cadastro.
     */
    expect(wrapper.text()).not.toContain('Microchip')
    expect(wrapper.text()).not.toContain('Alertas clínicos')
    expect(wrapper.text()).not.toContain('CEP')
    expect(wrapper.find('.novo__mais').exists()).toBe(false)
  })

  it('exige o mesmo que o cadastro completo, e nada além', async () => {
    /*
     * A regra que separa os dois modos é de exposição, não de validação. Se o formulário curto
     * exigisse menos, o mesmo paciente entraria pela agenda sem o que a página cobra — e se
     * exigisse mais, o botão travaria por um campo que esta tela nem desenha.
     */
    const wrapper = await montarRapido()

    await wrapper.find('form').trigger('submit')
    await nextTick()

    expect(wrapper.text()).toContain('Campo obrigatório')

    await digitar(wrapper, 'Nome do paciente', 'Quindim')
    await digitar(wrapper, 'Nome do responsável', 'Fulano de Tal')
    await digitar(wrapper, 'Telefone', '11984221030')

    await wrapper.find('form').trigger('submit')
    await ateEmitirCriado(wrapper)

    const criado = getDataset().pets.find((pet) => pet.nome === 'Quindim')!

    expect(criado).toBeDefined()
    /* O que a tela não pergunta nasce vazio — e não com um palpite. */
    expect(criado.microchip).toBe('')
    expect(criado.pelagem).toBe('')
    expect(criado.alertas).toEqual([])
  })

  it('acusa telefone inválido no lugar do campo', async () => {
    const wrapper = await montarRapido()

    await digitar(wrapper, 'Nome do paciente', 'Quindim')
    await digitar(wrapper, 'Nome do responsável', 'Fulano de Tal')
    await digitar(wrapper, 'Telefone', '1184221030')

    await wrapper.find('form').trigger('submit')
    await nextTick()

    expect(wrapper.text()).toContain('Telefone inválido')
    expect(getDataset().pets.some((pet) => pet.nome === 'Quindim')).toBe(false)
  })
})
