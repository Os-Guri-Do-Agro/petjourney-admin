/**
 * As três telas da demonstração renderizam com o dado que o protótipo produz.
 *
 * `vue-tsc` valida o template contra os tipos, e não prova que a tela **desenha**: um slot com o
 * nome errado, uma chave de tradução que resolve para um objeto ou um `v-for` sobre um campo
 * vazio passam pelos tipos e chegam à apresentação. Aqui os componentes são montados com o
 * dataset de verdade, e o que se afirma é o que o cliente vai ver na tela.
 *
 * O foco é a lista curta do que a demonstração não pode perder: o mapa que mostra vaga, o
 * checklist que mostra quem deu a dose, e o celular do responsável com o boletim retido de fora.
 */

import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import i18n from '@/i18n'

import AltaDialog from '../AltaDialog.vue'
import BoletimNoApp from '../BoletimNoApp.vue'
import InternacaoChecklist from '../InternacaoChecklist.vue'
import GerenciarLeitosDialog from '../GerenciarLeitosDialog.vue'
import LeitoCard from '../LeitoCard.vue'
import { internacaoRepository } from '../../../data/repositories'
import { setMockConfig } from '../../../data/mock-runtime'
import { resetDataset } from '../../../data/store'
import { resumirAlta, situacaoDaAdministracao } from '../../../domain/internacao'
import { getDataset } from '../../../data/store'
import { clinicClock, useClinicoStore } from '../../../stores/clinico'

/**
 * Nomeado, e não `global`: sombrear o global do Node num arquivo de teste confunde de graça.
 *
 * O `PrimeVue` entra junto porque os componentes de overlay — `Dialog`, aqui — leem a
 * configuração do plugin ao montar e quebram sem ela. Botão e campo funcionam sem, mas montar
 * metade da biblioteca com metade do contexto só adia o erro para o próximo teste.
 */
const COM_I18N = { plugins: [i18n, PrimeVue] }

beforeEach(() => {
  setActivePinia(createPinia())
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })

  /*
   * Diálogo do PrimeVue é teleportado para o `body` e a saída dele depende de `requestAnimationFrame`,
   * que o jsdom não roda. Sem esta limpeza, o diálogo de um teste sobrevive no DOM e o próximo
   * conta as linhas dos dois — foi assim que a paginação "mostrou" 24 linhas numa página de 8.
   */
  document.body.innerHTML = ''
})

describe('cartão de leito', () => {
  it('mostra paciente, tempo de internação e o que está atrasado', async () => {
    const mapa = await internacaoRepository.mapa()
    const ocupado = mapa.leitos.find((item) => item.internacao)!

    const wrapper = mount(LeitoCard, { props: { item: ocupado }, global: COM_I18N })
    const texto = wrapper.text()

    expect(texto).toContain(ocupado.leito.nome)
    expect(texto).toContain(ocupado.petNome)
    expect(texto).toContain(ocupado.internacao!.motivo)
    /* Nada de `[object Object]` nem de caminho de chave cru vazando para a tela. */
    expect(texto).not.toContain('clinico.internacao')
    expect(texto).not.toContain('[object Object]')
  })

  /** O leito vazio ocupa lugar na grade — é a informação que uma lista de internados esconde. */
  it('o leito livre oferece internar; o fora de operação não', async () => {
    const mapa = await internacaoRepository.mapa()
    const livre = mapa.leitos.find((item) => !item.internacao && item.leito.ativo)!
    const inativo = mapa.leitos.find((item) => !item.leito.ativo)!

    const comVaga = mount(LeitoCard, { props: { item: livre }, global: COM_I18N })

    expect(comVaga.find('button.p-button').exists()).toBe(true)

    await comVaga.find('button.p-button').trigger('click')

    expect(comVaga.emitted('internar')?.[0]).toEqual([livre.leito.id])

    const parado = mount(LeitoCard, { props: { item: inativo }, global: COM_I18N })

    expect(parado.find('button.p-button').exists()).toBe(false)
    expect(parado.text()).toContain(
      i18n.global.t('clinico.internacao.leito.foraDeOperacao'),
    )
  })

  /**
   * O cartão ocupado inteiro é alvo de clique.
   *
   * A área estendida é um `::after` — pseudo-elemento não existe no jsdom, então o que dá para
   * guardar aqui é o contrato que a liga: a classe que aplica `cursor: pointer` e o alvo
   * estendido só existe onde há paciente. A cobertura real da superfície foi verificada por
   * `elementFromPoint` no navegador, nos quatro cantos de cada cartão.
   */
  it('marca como clicável só o cartão que tem paciente', async () => {
    const mapa = await internacaoRepository.mapa()
    const ocupado = mapa.leitos.find((item) => item.internacao)!
    const livre = mapa.leitos.find((item) => !item.internacao && item.leito.ativo)!

    const comPaciente = mount(LeitoCard, { props: { item: ocupado }, global: COM_I18N })
    const semPaciente = mount(LeitoCard, { props: { item: livre }, global: COM_I18N })

    expect(comPaciente.find('.leito--clicavel').exists()).toBe(true)
    expect(comPaciente.find('.leito__paciente').exists()).toBe(true)

    expect(semPaciente.find('.leito--clicavel').exists()).toBe(false)
    expect(semPaciente.find('.leito__paciente').exists()).toBe(false)
  })

  it('abre o paciente ao clicar no nome', async () => {
    const mapa = await internacaoRepository.mapa()
    const ocupado = mapa.leitos.find((item) => item.internacao)!

    const wrapper = mount(LeitoCard, { props: { item: ocupado }, global: COM_I18N })

    await wrapper.find('.leito__paciente').trigger('click')

    expect(wrapper.emitted('abrir')?.[0]).toEqual([ocupado.internacao!.id])
  })
})

describe('checklist de enfermagem', () => {
  async function montar(internacaoId = 'int-bento') {
    const clinico = useClinicoStore()

    await clinico.carregar()

    const paciente = (await internacaoRepository.doPaciente(internacaoId))!
    const agora = clinicClock.nowIso()

    return {
      paciente,
      wrapper: mount(InternacaoChecklist, {
        props: {
          linhas: paciente.administracoes.map((administracao) => ({
            administracao,
            prescricao:
              paciente.prescricoes.find((item) => item.id === administracao.prescricaoId) ?? null,
            situacao: situacaoDaAdministracao(administracao, agora),
          })),
          agora,
          salvando: false,
          fimDoPlantao: null,
        },
        global: COM_I18N,
      }),
    }
  }

  it('agrupa por horário e traz a linha do agora', async () => {
    const { wrapper } = await montar()

    expect(wrapper.findAll('.grupo').length).toBeGreaterThan(2)
    expect(wrapper.find('.checklist__agora').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('clinico.internacao')
  })

  /** O registro de quem executou é entregável do requisito — precisa estar **na linha**. */
  it('mostra quem deu a dose e a que horas', async () => {
    const { wrapper } = await montar()
    const executores = wrapper.findAll('.item__executor')

    expect(executores.length).toBeGreaterThan(0)
    expect(executores[0]!.text()).toMatch(/\d{1,2}[:h]\d{2}/)
  })

  it('marcar uma dose emite o registro que a store vai gravar', async () => {
    const { wrapper } = await montar()
    const pendente = wrapper.findAll('.item--na-janela, .item--atrasada, .item--futura')[0]!

    await pendente.find('button.p-button').trigger('click')

    const evento = wrapper.emitted('registrar')?.[0]

    expect(evento?.[1]).toBe('feita')
  })
})

describe('celular do responsável', () => {
  it('mostra o que foi enviado e mantém o retido fora da conversa', async () => {
    const paciente = (await internacaoRepository.doPaciente('int-tofu'))!
    const enviados = paciente.boletins.filter((item) => item.status === 'enviado')
    const retido = paciente.boletins.find((item) => item.status === 'retido')!

    const wrapper = mount(BoletimNoApp, {
      props: {
        boletins: paciente.boletins,
        petNome: 'Tofu',
        petIniciais: 'TO',
        clinicaNome: 'Clínica',
      },
      global: COM_I18N,
    })

    expect(wrapper.findAll('.balao')).toHaveLength(enviados.length)
    /* O boletim retido não chegou ao celular — é essa ausência que explica a regra. */
    expect(wrapper.find('.celular__retido').exists()).toBe(true)
    /*
     * O texto precisa existir antes de se afirmar que ele não aparece: `toContain('')` é
     * verdadeiro para qualquer tela, e a asserção passaria sobre um boletim vazio.
     *
     * A guarda anterior era `retido.texto || '\0'` — um byte nulo cru no meio do arquivo, que
     * fazia o `grep` tratar a fonte como binária e não afirmava coisa alguma.
     */
    expect(retido.texto.length).toBeGreaterThan(0)
    expect(wrapper.text()).not.toContain(retido.texto)
  })

  it('depois da ligação e do envio, a mensagem aparece marcada como tal', async () => {
    const antes = (await internacaoRepository.doPaciente('int-tofu'))!
    const retido = antes.boletins.find((item) => item.status === 'retido')!

    await internacaoRepository.registrarLigacao({
      boletimId: retido.id,
      professionalId: 'prof-helena',
    })
    await internacaoRepository.enviarBoletim(retido.id)

    const depois = (await internacaoRepository.doPaciente('int-tofu'))!

    const wrapper = mount(BoletimNoApp, {
      props: {
        boletins: depois.boletins,
        petNome: 'Tofu',
        petIniciais: 'TO',
        clinicaNome: 'Clínica',
      },
      global: COM_I18N,
    })

    expect(wrapper.find('.celular__retido').exists()).toBe(false)
    expect(wrapper.find('.balao__ligacao').exists()).toBe(true)
    expect(wrapper.text()).toContain(
      i18n.global.t('clinico.internacao.app.aposLigacao'),
    )
  })
})

/**
 * Cadastro de leitos: a busca é o que salva a clínica grande.
 *
 * Com cem leitos a lista deixa de ser navegável, e a pergunta que se faz nela quase nunca é "qual
 * é o R37" — é "onde está o Bento". Por isso a busca varre também o paciente internado, e é esse
 * caminho que estes testes guardam.
 */
describe('cadastro de leitos', () => {
  async function montar() {
    const clinico = useClinicoStore()

    await clinico.carregar()

    const dataset = getDataset().internacao

    return mount(GerenciarLeitosDialog, {
      props: {
        aberto: true,
        leitos: dataset.leitos,
        internacoes: dataset.internacoes,
        salvando: false,
        erro: '',
      },
      global: COM_I18N,
      attachTo: document.body,
    })
  }

  function nomesVisiveis(): string[] {
    return [...document.querySelectorAll('.linha__nome')].map(
      (el) => el.textContent?.trim() ?? '',
    )
  }

  it('lista os leitos cadastrados com a conta de quantos estão em operação', async () => {
    const wrapper = await montar()

    /* Pelo próprio catálogo: a suíte roda em inglês, e texto fixo em português passaria a mentir. */
    expect(document.body.textContent).toContain(
      i18n.global.t('clinico.internacao.leitos.conta', { total: 8, ativos: 7 }),
    )
    expect(nomesVisiveis()).toContain('UTI')

    wrapper.unmount()
  })

  it('encontra o leito pelo nome do paciente internado', async () => {
    const wrapper = await montar()
    const dataset = getDataset().internacao

    /* Com poucos leitos a busca nem aparece; o caso que importa é o da clínica grande. */
    for (let i = 1; i <= 40; i += 1) {
      dataset.leitos.push({
        id: `leito-teste-${i}`,
        nome: `R${i + 20}`,
        roomId: 'sala-recuperacao',
        kind: 'geral',
        ativo: true,
        motivoInativo: null,
        detalheInativo: '',
        inativoDesde: null,
      })
    }

    await wrapper.setProps({ leitos: [...dataset.leitos] })

    /*
     * O conteúdo do diálogo é teleportado para o `body`: `wrapper.find` não o alcança, então a
     * busca é feita pelo DOM, como o usuário a encontraria.
     */
    const campo = document.querySelector<HTMLInputElement>('.busca__campo')

    expect(campo).not.toBeNull()

    campo!.value = 'bento'
    campo!.dispatchEvent(new Event('input'))
    await nextTick()

    const encontrados = nomesVisiveis()

    expect(encontrados).toHaveLength(1)
    expect(encontrados[0]).toBe('R1')

    wrapper.unmount()
  })

  it('pagina a lista e nunca mostra mais que uma página de cada vez', async () => {
    const wrapper = await montar()
    const dataset = getDataset().internacao

    for (let i = 1; i <= 40; i += 1) {
      dataset.leitos.push({
        id: `leito-pag-${i}`,
        nome: `P${i}`,
        roomId: 'sala-recuperacao',
        kind: 'geral',
        ativo: true,
        motivoInativo: null,
        detalheInativo: '',
        inativoDesde: null,
      })
    }

    await wrapper.setProps({ leitos: [...dataset.leitos] })

    expect(nomesVisiveis()).toHaveLength(8)
    expect(document.body.textContent).toContain(
      i18n.global.t('clinico.internacao.leitos.intervalo', { de: 1, ate: 8, total: 48 }),
    )

    wrapper.unmount()
  })
})

/**
 * O encerramento — a tela que faltava para o ciclo fechar.
 *
 * O que se afirma aqui não é layout: é que a **regra grave chega até o dedo**. O diálogo não pode
 * deixar registrar óbito sem a ligação, e não pode prometer mensagem onde nenhuma mensagem sai.
 */
describe('diálogo de alta', () => {
  async function montar() {
    const paciente = await internacaoRepository.doPaciente('int-bento')
    const clinico = useClinicoStore()

    await clinico.carregar()

    return mount(AltaDialog, {
      props: {
        aberto: true,
        pet: clinico.pet(paciente!.internacao.petId),
        resumo: resumirAlta({
          internacao: paciente!.internacao,
          administracoes: paciente!.administracoes,
          boletins: paciente!.boletins,
          agora: clinicClock.nowIso(),
        }),
        salvando: false,
        erro: '',
      },
      global: COM_I18N,
      attachTo: document.body,
    })
  }

  /**
   * O botão do rodapé, e não "o botão cujo texto diz alta".
   *
   * As opções do `ClinicToggleGroup` são `button` com `role="radio"`, e uma delas se chama
   * exatamente "Alta" — procurar por texto no `body` inteiro devolvia o rádio e afirmava sobre a
   * coisa errada. O rodapé do diálogo tem dois botões, e o de confirmar é o último.
   */
  function botaoDeConfirmar(): HTMLButtonElement | undefined {
    const rodape = document.body.querySelector('.p-dialog-footer')
    const botoes = [...(rodape?.querySelectorAll('button') ?? [])]

    return botoes[botoes.length - 1]
  }

  /** O diálogo é teleportado para o `body`: `wrapper.find` não o alcança. */
  async function escrever(texto: string) {
    const campo = document.body.querySelector('textarea') as HTMLTextAreaElement | null

    expect(campo).not.toBeNull()

    campo!.value = texto
    campo!.dispatchEvent(new Event('input'))
    await nextTick()
  }

  it('nasce na alta, e nenhum caminho de chave vaza para a tela', async () => {
    const wrapper = await montar()
    await nextTick()

    const texto = document.body.textContent ?? ''

    expect(texto).toContain(i18n.global.t('clinico.internacao.alta.desfecho.alta'))
    expect(texto).toContain(i18n.global.t('clinico.internacao.alta.canal.alta'))
    expect(texto).not.toContain('clinico.internacao')
    expect(texto).not.toContain('[object Object]')

    wrapper.unmount()
  })

  /*
   * A conferência de última hora precisa aparecer sem clique: quem está encerrando não vai
   * expandir uma seção para descobrir que deixou um boletim retido para trás.
   */
  it('mostra os números do que fica registrado', async () => {
    const wrapper = await montar()
    await nextTick()

    const texto = document.body.textContent ?? ''

    expect(texto).toContain(i18n.global.t('clinico.internacao.alta.resumoTitulo'))
    expect(texto).toContain(i18n.global.t('clinico.internacao.alta.dosesFeitas'))

    wrapper.unmount()
  })

  it('a orientação é obrigatória — sem ela, não confirma', async () => {
    const wrapper = await montar()
    await nextTick()

    expect(botaoDeConfirmar()?.disabled).toBe(true)

    await escrever('Repouso por 3 dias.')

    expect(botaoDeConfirmar()?.disabled).toBe(false)
    expect(wrapper.emitted('confirmar')).toBeUndefined()

    botaoDeConfirmar()?.click()
    await nextTick()

    expect(wrapper.emitted('confirmar')?.[0]?.[0]).toMatchObject({
      status: 'alta',
      avisadoPorTelefone: false,
    })

    wrapper.unmount()
  })

  /** A regra que dá nome ao requisito, na outra ponta: óbito não sai sem alguém ter ligado. */
  it('óbito com a orientação escrita continua travado até a ligação ser marcada', async () => {
    const wrapper = await montar()
    await nextTick()

    const opcaoObito = [...document.body.querySelectorAll('[role="radio"]')].find(
      (opcao) =>
        opcao.textContent?.trim() === i18n.global.t('clinico.internacao.alta.desfecho.obito'),
    ) as HTMLElement | undefined

    expect(opcaoObito).toBeDefined()

    opcaoObito!.click()
    await nextTick()

    await escrever('Parada às 3h40.')

    expect(document.body.textContent).toContain(
      i18n.global.t('clinico.internacao.alta.canal.obito'),
    )
    expect(botaoDeConfirmar()?.disabled).toBe(true)

    const caixa = document.body.querySelector('input[type="checkbox"]') as HTMLElement | null

    expect(caixa).not.toBeNull()

    caixa!.click()
    await nextTick()

    expect(botaoDeConfirmar()?.disabled).toBe(false)

    wrapper.unmount()
  })
})
