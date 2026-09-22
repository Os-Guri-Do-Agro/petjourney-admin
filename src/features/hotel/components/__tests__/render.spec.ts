/**
 * As telas do hotel desenham com o dado que o protótipo produz.
 *
 * `vue-tsc` valida o template contra os tipos, e não prova que a tela **desenha**: um slot com o
 * nome errado, uma chave de tradução que resolve para um objeto, ou um `v-for` sobre um campo
 * vazio passam pelos tipos e chegam à apresentação. Aqui os componentes são montados com o
 * dataset de verdade, e o que se afirma é o que o cliente vai ver.
 *
 * O foco é a lista curta do que a demonstração não pode perder: o cartão que mostra vaga, a
 * lista de exigências que trava o check-in, a conta que a recepção lê em voz alta, e a linha da
 * prancheta que alguém marca em pé no corredor.
 */

import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import { setMockConfig } from '@/features/clinico/data/mock-runtime'

import GradeDeOcupacao from '../mapa/GradeDeOcupacao.vue'
import HospedeCard from '../hospedes/HospedeCard.vue'
import ExigenciasLista from '../reserva/ExigenciasLista.vue'
import OrcamentoTabela from '../reserva/OrcamentoTabela.vue'
import TarefaLinha from '../rotina/TarefaLinha.vue'
import HotelSelo from '../base/HotelSelo.vue'
import { addDays } from '@/features/clinico/domain/clinic-time'

import { hospedagemRepository, reservaRepository } from '../../data/repositories'
import { getDataset, resetDataset } from '../../data/store'
import { avaliarAdmissao } from '../../domain/admissao'
import { dataDe } from '../../domain/hotel-time'
import { situacaoDaTarefa } from '../../domain/rotina'
import { useHotelStore } from '../../stores/hotel'

/**
 * Nomeado, e não `global`: sombrear o global do Node num arquivo de teste confunde de graça.
 *
 * O `PrimeVue` entra porque os componentes da biblioteca leem a configuração do plugin ao montar.
 */
const COM_I18N = { plugins: [i18n, PrimeVue] }

beforeEach(async () => {
  /*
   * Idioma fixo em português.
   *
   * O `i18n` do app resolve o idioma pelo navegador, e no jsdom isso cai em inglês. Sem fixar,
   * o teste afirmaria o texto de um idioma e leria o de outro — e passaria a falhar no dia em que
   * alguém mudasse o padrão, por um motivo que não tem nada a ver com o que ele protege.
   */
  i18n.global.locale.value = 'pt'

  setActivePinia(createPinia())
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
  document.body.innerHTML = ''

  /* A store popula os mapas de pet e responsável que os componentes leem por id. */
  await useHotelStore().carregar(true)
})

describe('grade de ocupação', () => {
  /*
   * A grade é a tela que faz o módulo fazer sentido, e o que se afirma aqui é o que a recepção
   * precisa ver: quem está em cada linha, e **o buraco** entre duas estadias.
   */
  async function montar() {
    const dataset = getDataset()
    const grade = await reservaRepository.grade(
      addDays(dataset.ancora, -1),
      addDays(dataset.ancora, 19),
    )

    return {
      dataset,
      grade,
      wrapper: mount(GradeDeOcupacao, {
        props: {
          grade,
          blocos: useHotelStore().blocos,
          hoje: dataset.ancora,
          procura: null,
        },
        global: COM_I18N,
      }),
    }
  }

  it('desenha uma coluna por noite e uma linha por acomodação', async () => {
    const { dataset, grade, wrapper } = await montar()

    expect(grade.dias).toHaveLength(21)
    expect(wrapper.findAll('thead th.dia')).toHaveLength(21)
    expect(wrapper.findAll('tbody tr.linha')).toHaveLength(dataset.acomodacoes.length)
  })

  it('a barra diz de quem é — um retângulo sem nome obriga a clicar para saber', async () => {
    const { wrapper } = await montar()
    const barras = wrapper.findAll('.barra')

    expect(barras.length).toBeGreaterThan(0)
    expect(barras.every((barra) => barra.text().trim() !== '')).toBe(true)
  })

  it('a estadia que já começou entra pela esquerda, em vez de sumir', async () => {
    const { grade } = await montar()

    /* Sem o recorte, a linha de quem está hospedado desde a semana passada pareceria livre. */
    expect(grade.linhas.some((linha) => linha.faixas.some((faixa) => faixa.entraAntes))).toBe(true)
  })

  it('a noite da saída fica livre: quem sai ao meio-dia libera a diária', async () => {
    const { grade } = await montar()
    const comFaixa = grade.linhas.find((linha) => linha.faixas.length > 0)!
    const faixa = comFaixa.faixas[0]!

    /* `ate` é exclusivo. Pintar o dia da saída mostraria uma diária cheia que está à venda. */
    const noitesDesenhadas = faixa.ate - faixa.de
    const noitesReais = Math.round(
      (Date.parse(faixa.saidaPrevista.slice(0, 10)) -
        Date.parse(faixa.entradaPrevista.slice(0, 10))) /
        86_400_000,
    )

    expect(noitesDesenhadas).toBeLessThanOrEqual(noitesReais)
  })

  it('a acomodação parada é hachurada e não recebe clique de reserva', async () => {
    const { wrapper } = await montar()

    expect(wrapper.find('.parada').exists()).toBe(true)
    expect(wrapper.find('.linha--parada .celula').attributes('disabled')).toBeDefined()
  })

  it('a procura acende o que serve e apaga o resto, sem esconder nada', async () => {
    const dataset = getDataset()
    const de = addDays(dataset.ancora, 5)
    const grade = await reservaRepository.grade(
      addDays(dataset.ancora, -1),
      addDays(dataset.ancora, 19),
    )

    const wrapper = mount(GradeDeOcupacao, {
      props: {
        grade,
        blocos: useHotelStore().blocos,
        hoje: dataset.ancora,
        procura: { de, ate: addDays(de, 3) },
      },
      global: COM_I18N,
    })

    expect(wrapper.findAll('.linha--serve').length).toBeGreaterThan(0)
    /* Apagadas, não removidas: quem atende precisa ver que a casa não encolheu. */
    expect(wrapper.findAll('tbody tr.linha')).toHaveLength(dataset.acomodacoes.length)
  })
})

describe('cartão de hóspede', () => {
  it('mostra quem é, como está e o que falta — sem obrigar a abrir', async () => {
    const hospedes = await hospedagemRepository.listar()
    const hospede = hospedes[0]!

    const wrapper = mount(HospedeCard, { props: { hospede }, global: COM_I18N })
    const texto = wrapper.text()

    expect(texto).toContain(hospede.petNome)
    expect(texto).toContain(hospede.acomodacaoNome)
    expect(texto).toContain(hospede.tutorNome)
    expect(texto).not.toContain('hotel.')
  })

  it('o cartão inteiro muda de tom quando algo trava, e não só um selo no canto', async () => {
    const hospedes = await hospedagemRepository.listar()
    const travado = hospedes.find((item) => item.ocorrenciaTravada)!

    const wrapper = mount(HospedeCard, { props: { hospede: travado }, global: COM_I18N })

    /* Um selo pequeno não sobrevive a uma grade de doze cartões: o olho não lê canto. */
    expect(wrapper.find('.cartao--risco').exists()).toBe(true)
    expect(wrapper.text()).toContain(travado.tutorNome)
  })
})

describe('lista de exigências', () => {
  function admissaoDe(reservaId: string) {
    const dataset = getDataset()
    const reserva = dataset.reservas.find((item) => item.id === reservaId)!
    const pet = dataset.pets.find((item) => item.id === reserva.petId)!

    return avaliarAdmissao({
      exigencias: dataset.exigencias,
      comprovantes: dataset.comprovantes,
      petId: pet.id,
      especie: pet.especie,
      saidaPrevista: dataDe(reserva.saidaPrevista),
      hoje: dataset.ancora,
    })
  }

  it('o bloqueio abre a lista, e a ação de resolver aparece na linha', () => {
    const wrapper = mount(ExigenciasLista, {
      props: { admissao: admissaoDe('res-zeus') },
      global: COM_I18N,
    })

    const texto = wrapper.text()

    /* Singular porque falta **um** documento: é a prova de que o plural escolhe a forma certa. */
    expect(texto).toContain('1 documento impede o check-in')
    expect(texto).toContain('Vacina da tosse dos canis')
    expect(texto).toContain('Não apresentado')
    /* Sem a ação ao lado, a recepção registra o papel fora do sistema. */
    expect(texto).toContain('Registrar')
    expect(texto).toContain('Dispensar')
  })

  it('a que vence durante avisa com a data e os dias de folga', () => {
    const wrapper = mount(ExigenciasLista, {
      props: { admissao: admissaoDe('res-bidu') },
      global: COM_I18N,
    })

    expect(wrapper.text()).toContain('Vence durante')
    expect(wrapper.text()).toMatch(/Vence em \d{2}\/\d{2}/)
    /* Avisa e não bloqueia: o reforço ainda cabe antes da entrada. */
    expect(wrapper.text()).not.toContain('impedem o check-in')
  })

  it('somente leitura não oferece ação nenhuma', () => {
    const wrapper = mount(ExigenciasLista, {
      props: { admissao: admissaoDe('res-zeus'), somenteLeitura: true },
      global: COM_I18N,
    })

    expect(wrapper.findAll('button')).toHaveLength(0)
  })
})

describe('orçamento', () => {
  it('mostra cada linha e o total bate com a soma', () => {
    /*
     * "Um total sozinho é uma conta que o cliente não confere e a recepção não defende." O teste
     * afirma as duas metades: as linhas existem, e o total é a soma delas.
     */
    const reserva = getDataset().reservas.find((item) => item.id === 'res-bidu')!

    const wrapper = mount(OrcamentoTabela, {
      props: { orcamento: reserva.orcamento, pagoCentavos: reserva.pagoCentavos },
      global: COM_I18N,
    })

    const linhas = wrapper.findAll('tbody tr')

    expect(linhas).toHaveLength(reserva.orcamento.linhas.length)
    expect(wrapper.text()).toContain('Diária')
    expect(wrapper.text()).toContain('Saldo a receber')

    const soma = reserva.orcamento.linhas.reduce((total, linha) => total + linha.totalCentavos, 0)

    expect(soma).toBe(reserva.orcamento.totalCentavos)
  })

  it('a saída tardia aparece como linha própria, e não embutida na diária', () => {
    const reserva = getDataset().reservas.find((item) => item.id === 'res-bento')!

    const wrapper = mount(OrcamentoTabela, {
      props: { orcamento: reserva.orcamento },
      global: COM_I18N,
    })

    expect(wrapper.text()).toContain('Saída tardia')
  })
})

describe('linha da prancheta', () => {
  it('a pendente oferece feita, recusou e pular — e recusar não é pular', async () => {
    const dataset = getDataset()
    const prancheta = await hospedagemRepository.rotina(dataset.ancora)
    const refeicao = prancheta.find((linha) => linha.tarefa.kind === 'refeicao')!

    /*
     * O status é forçado para `pendente` em vez de procurar uma pendente na lista: o que já foi
     * feito depende da hora em que o teste roda, e um teste que só passa de manhã não protege nada.
     */
    const wrapper = mount(TarefaLinha, {
      props: {
        tarefa: { ...refeicao.tarefa, status: 'pendente' },
        situacao: 'na-janela',
        petNome: refeicao.petNome,
        acomodacaoNome: refeicao.acomodacaoNome,
      },
      global: COM_I18N,
    })

    const rotulos = wrapper.findAll('button').map((botao) => botao.text())

    /*
     * A ordem faz parte do contrato, e é por isso que o teste a fixa em vez de só conferir o
     * conjunto: "Feita" é o último para encostar na borda direita do grupo e cair sempre no mesmo
     * `x`. Com ele em primeiro, o botão principal nascia em dois lugares diferentes conforme a
     * linha tivesse ou não o "Recusou" ao lado, e quem marca as dezoito da manhã perde o
     * automatismo do polegar.
     */
    expect(rotulos).toEqual(['Pular', 'Recusou', 'Feita'])
    expect(wrapper.text()).toContain(refeicao.petNome)
  })

  it('a marcação emite o status e o id, e nada mais', async () => {
    const dataset = getDataset()
    const prancheta = await hospedagemRepository.rotina(dataset.ancora)
    const alguma = prancheta[0]!
    const tarefa = { ...alguma.tarefa, status: 'pendente' as const }

    const wrapper = mount(TarefaLinha, {
      props: { tarefa, situacao: 'atrasada' },
      global: COM_I18N,
    })

    /* Pelo rótulo, e não pela posição: a ordem dos botões é assunto do teste acima. */
    const feita = wrapper.findAll('button').find((botao) => botao.text() === 'Feita')!

    await feita.trigger('click')

    expect(wrapper.emitted('marcar')).toEqual([[{ tarefaId: tarefa.id, status: 'feita' }]])
  })

  it('a recusada mostra o selo e a observação de quem registrou', () => {
    const recusada = getDataset().tarefas.find((item) => item.status === 'recusada')!

    const wrapper = mount(TarefaLinha, {
      props: {
        tarefa: recusada,
        situacao: situacaoDaTarefa(recusada, `${getDataset().ancora}T23:00:00-04:00`),
      },
      global: COM_I18N,
    })

    expect(wrapper.text()).toContain('Recusou')
    expect(wrapper.text()).toContain(recusada.observacao)
    /* Resolvida: sobra só desfazer, porque o toque errado no corredor é frequente. */
    expect(wrapper.findAll('button').map((botao) => botao.text())).toEqual(['Desfazer'])
  })
})

describe('selo', () => {
  it('o tom não é o único canal: o rótulo é sempre texto', () => {
    /*
     * Em escala de cinza, ou para quem não distingue vermelho de âmbar, a palavra é o que resta —
     * e é ela que o leitor de tela entrega.
     */
    const wrapper = mount(HotelSelo, { props: { rotulo: 'Vencido', tom: 'risco' } })

    expect(wrapper.text()).toBe('Vencido')
    expect(wrapper.classes()).toContain('selo--risco')
  })
})
