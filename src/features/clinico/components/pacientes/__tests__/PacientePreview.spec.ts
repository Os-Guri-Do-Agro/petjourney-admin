/**
 * A prévia desenha o perfil, cheio ou vazio.
 *
 * O que este arquivo protege é a promessa que a coluna faz: **a ficha aparece inteira desde o
 * primeiro segundo**. Um perfil que só se desenha depois da primeira letra deixa metade da tela
 * em branco justamente quando alguém está decidindo se vale preencher — e some com a única pista
 * de que existe um lugar para microchip e um para endereço.
 *
 * O outro ponto é o traço: valor ausente vira `—` e a linha continua lá. Esconder a linha faria
 * o quadro parecer completo faltando metade.
 */

import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { describe, expect, it } from 'vitest'

import i18n from '@/i18n'

import PacientePreview from '../PacientePreview.vue'
import type { RascunhoDoPaciente } from '../PacienteNovoForm.vue'
import type { Pet, Tutor } from '../../../data/types'

i18n.global.locale.value = 'pt'

const COM_I18N = { plugins: [i18n, PrimeVue] }

function pet(patch: Partial<Pet> = {}): Pet {
  return {
    id: 'rascunho-pet',
    nome: 'Quindim',
    especie: 'canina',
    raca: 'SRD',
    sexo: 'macho',
    nascimento: '2020-01-01',
    castrado: true,
    porte: 'medio',
    pesoKg: 12,
    microchip: '900215000111222',
    pelagem: 'Tricolor, pelo curto',
    tutorId: 'rascunho-tutor',
    alertas: [],
    iniciais: 'QU',
    fotoUrl: '',
    ...patch,
  }
}

function tutor(patch: Partial<Tutor> = {}): Tutor {
  return {
    id: 'rascunho-tutor',
    nome: 'Fulano de Tal',
    telefone: '(11) 98422-1030',
    telefoneSecundario: '',
    email: '',
    documento: '',
    preferenciaContato: 'whatsapp',
    endereco: null,
    ...patch,
  }
}

function montar(rascunho: RascunhoDoPaciente | null = null) {
  return mount(PacientePreview, { props: { rascunho }, global: COM_I18N })
}

/** A ficha em repouso: o que a tela mostra antes da primeira tecla. */
function emRepouso(): RascunhoDoPaciente {
  return {
    pet: pet({
      nome: '',
      raca: '',
      nascimento: null,
      pesoKg: null,
      porte: null,
      microchip: '',
      pelagem: '',
      iniciais: '',
      fotoUrl: '',
    }),
    tutor: { ...tutor(), nome: '', telefone: '' },
  }
}

describe('prévia em repouso', () => {
  it('desenha a ficha inteira sem nada preenchido', () => {
    const wrapper = montar(emRepouso())
    const texto = wrapper.text()

    /* Os três quadros existem desde o início: são a lista do que ainda falta. */
    expect(wrapper.findAll('.quadro')).toHaveLength(3)
    expect(texto).toContain('Alertas clínicos')
    expect(texto).toContain('Identificação')
    expect(texto).toContain('Microchip')
    expect(texto).toContain('Endereço')
  })

  it('mostra o lugar do nome e o avatar vazio em vez de um disco mudo', () => {
    const wrapper = montar(emRepouso())

    expect(wrapper.text()).toContain('Nome do paciente')
    expect(wrapper.find('.perfil__avatar--vazio').exists()).toBe(true)
  })

  it('põe traço em cada valor ausente, sem sumir com a linha', () => {
    const wrapper = montar(emRepouso())

    expect(wrapper.findAll('.previa__traco').length).toBeGreaterThan(5)
  })

  it('aguenta não receber rascunho nenhum', () => {
    /* A página monta a prévia antes de o formulário emitir o primeiro rascunho. */
    const wrapper = montar(null)

    expect(wrapper.text()).toContain('Nome do paciente')
  })
})

describe('prévia preenchida', () => {
  it('monta a identidade na mesma ordem do cabeçalho do prontuário', () => {
    const wrapper = montar({ pet: pet(), tutor: tutor() })
    const texto = wrapper.text()

    expect(texto).toContain('Quindim')
    expect(texto).toContain('QU')
    expect(texto).toContain('Fulano de Tal')
    /* O porte entra porque é ele que escolhe a faixa de referência do exame físico. */
    expect(texto).toContain('Médio')
    expect(texto).toContain('Castrado')
    expect(texto).not.toContain('clinico.paciente')
    expect(texto).not.toContain('[object Object]')
  })

  it('não gasta a linha de atributos com "idade não informada"', () => {
    /* Espaço de dado ocupado por ausência é pior que ausência: a falta se lê no vazio. */
    const wrapper = montar({ pet: pet({ nascimento: null }), tutor: tutor() })

    expect(wrapper.text()).not.toContain('idade não informada')
  })

  it('mostra o alerta com o detalhe, que é o que muda conduta', () => {
    const wrapper = montar({
      pet: pet({
        alertas: [{ id: 'a1', kind: 'alergia', severidade: 'risco', detalhe: 'Amoxicilina' }],
      }),
      tutor: tutor(),
    })

    expect(wrapper.text()).toContain('Alergia')
    expect(wrapper.text()).toContain('Amoxicilina')
  })

  it('junta o endereço numa linha legível', () => {
    const wrapper = montar({
      pet: pet(),
      tutor: tutor({
        endereco: {
          cep: '05435-020',
          logradouro: 'Rua Harmonia',
          numero: '812',
          complemento: 'apto 74',
          bairro: 'Vila Madalena',
          cidade: 'São Paulo',
          uf: 'SP',
        },
      }),
    })

    expect(wrapper.text()).toContain('Rua Harmonia, 812')
    expect(wrapper.text()).toContain('São Paulo/SP')
    expect(wrapper.text()).toContain('05435-020')
  })

  it('diz que falta responsável em vez de deixar o quadro mudo', () => {
    const wrapper = montar({ pet: pet(), tutor: null })

    expect(wrapper.text()).toContain('Sem responsável')
  })
})
