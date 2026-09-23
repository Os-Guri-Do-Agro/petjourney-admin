/**
 * O cadastro da rotina que a casa faz por todos os hóspedes.
 *
 * Quatro operações, e a ordem delas é o desenho: **ler**, **prever**, **publicar**, **desfazer**.
 * A previsão existir antes da publicação não é conveniência — é o que separa um cadastro de uma
 * armadilha. Trocar um horário de água numa casa de quarenta mexe em quarenta tarefas de animais
 * que estão lá dentro agora, e um botão "salvar" sozinho pede um ato de fé.
 *
 * Toda criação e remoção de tarefa passa por `reconciliarDia`, sem exceção. É lá que mora a regra
 * que protege o histórico, e ter uma segunda porta seria ter uma segunda regra.
 */

import { addDays } from '@/features/clinico/domain/clinic-time'

import { dataDe } from '../../domain/hotel-time'
import { reconciliarDia } from '../../domain/materializacao'
import { planejarDia } from '../../domain/rotina'
import {
  previsaoDaPublicacao,
  rotinaEfetiva,
  type PrevisaoDaPublicacao,
} from '../../domain/rotina-padrao'
import {
  proporRotina,
  validarProposta,
  type EntradaDaProposta,
  type PropostaDeRotina,
} from '../../domain/rotina-sugerida'
import { HOTEL_UTC_OFFSET } from '../fixtures'
import { simularChamada } from '../mock-runtime'
import { agoraIso, getDataset, novoId } from '../store'
import type {
  AjusteDeRotina,
  ClockTime,
  Hospedagem,
  ISODate,
  ISODateTime,
  ItemDeRotina,
  PetSpecies,
  RotinaPadrao,
  TarefaDaCasaKind,
} from '../types'

function base() {
  return getDataset()
}

/** Quem está na casa agora. Quem saiu não recebe rotina nova. */
function hospedados(): Hospedagem[] {
  return base().hospedagens.filter((item) => item.status === 'hospedado')
}

/**
 * Os dias que uma publicação alcança.
 *
 * **Só dias já materializados**, e só daqui para a frente. O futuro que ainda não virou registro
 * não precisa de conserto: quando alguém abrir aquele dia, `garantirHorizonte` já vai gerá-lo com
 * o template novo. Sair materializando a estadia inteira na publicação criaria semanas de tarefas
 * de uma vez, e a maioria delas nunca seria olhada.
 */
function diasAlcancados(vigenteDesde: ISODateTime): ISODate[] {
  const inicio = dataDe(vigenteDesde)
  const abertos = new Set(hospedados().map((item) => item.id))

  const dias = new Set(
    base()
      .tarefas.filter((tarefa) => abertos.has(tarefa.hospedagemId))
      .map((tarefa) => dataDe(tarefa.previstaPara))
      .filter((dia) => dia >= inicio),
  )

  /* O dia em que a vigência começa entra mesmo sem tarefa nenhuma: é onde as primeiras nascem. */
  dias.add(inicio)

  return [...dias].sort()
}

/** Monta, para cada hóspede e cada dia alcançado, o que existe e o que o cadastro novo prevê. */
function montarDias(itens: ItemDeRotina[], vigenteDesde: ISODateTime) {
  const dataset = base()
  const dias = diasAlcancados(vigenteDesde)

  return hospedados().flatMap((hospedagem) => {
    const reserva = dataset.reservas.find((item) => item.id === hospedagem.reservaId)
    const medicacoes = dataset.medicacoes.filter((item) => item.hospedagemId === hospedagem.id)
    const passeioAutorizado = hospedagem.autorizacoes.some(
      (item) => item.kind === 'passeio-externo' && item.concedida,
    )

    return dias.map((dia) => ({
      dia,
      hospedagemId: hospedagem.id,
      existentes: dataset.tarefas.filter(
        (tarefa) => tarefa.hospedagemId === hospedagem.id && dataDe(tarefa.previstaPara) === dia,
      ),
      planejadas: planejarDia({
        hospedagemId: hospedagem.id,
        dia,
        utcOffset: HOTEL_UTC_OFFSET,
        planoAlimentar: hospedagem.planoAlimentar,
        medicacoes,
        passeioAutorizado,
        entradaEm: hospedagem.entradaEm,
        saidaPrevistaEm: hospedagem.saidaPrevistaEm,
        servicos: reserva?.servicos,
        catalogoDeServicos: dataset.servicos,
        rotinaPadrao: rotinaEfetiva(itens, ajustesDoHospede(hospedagem.id)),
      }),
    }))
  })
}

export const rotinaPadraoRepository = {
  /** A rotina em vigor. */
  atual(): Promise<RotinaPadrao> {
    return simularChamada('rotina.padrao.ler', () => base().rotinaPadrao)
  },

  /**
   * O que aconteceria se esta rotina fosse publicada agora — sem publicar nada.
   *
   * É a tela de confirmação com números em vez de adjetivos. Roda exatamente o mesmo caminho da
   * publicação, e é por isso que os números batem: não é uma estimativa, é o resultado.
   */
  previsao(entrada: {
    itens: ItemDeRotina[]
    vigenteDesde: ISODateTime
  }): Promise<PrevisaoDaPublicacao> {
    return simularChamada('rotina.padrao.ler', () =>
      previsaoDaPublicacao(montarDias(entrada.itens, entrada.vigenteDesde), agoraIso()),
    )
  },

  /**
   * Publica, e reorganiza o futuro intocado.
   *
   * Guarda os itens anteriores e os ids que nasceram, para que a publicação possa ser desfeita.
   * Não guarda o que foi retirado: desfazer devolve o template à versão anterior, e a
   * materialização recria sozinha o que aquela versão previa — ressuscitar registros criaria uma
   * segunda verdade sobre o mesmo dia.
   */
  publicar(entrada: {
    itens: ItemDeRotina[]
    vigenteDesde: ISODateTime
    por: string
  }): Promise<RotinaPadrao> {
    return simularChamada('rotina.padrao.publicar', () => {
      const dataset = getDataset()
      const agora = agoraIso()
      const anterior = dataset.rotinaPadrao

      const criadas: string[] = []
      let retiradas = 0

      for (const entradaDoDia of montarDias(entrada.itens, entrada.vigenteDesde)) {
        const { criar, retirar } = reconciliarDia({
          existentes: entradaDoDia.existentes,
          planejadas: entradaDoDia.planejadas,
          agora,
        })

        for (const planejada of criar) {
          const id = novoId('tarefa')

          criadas.push(id)
          dataset.tarefas.push({
            id,
            ...planejada,
            status: 'pendente',
            executadaEm: null,
            executadaPor: null,
            turnoId: null,
            observacao: '',
          })
        }

        if (retirar.length > 0) {
          const fora = new Set(retirar.map((tarefa) => tarefa.id))

          retiradas += fora.size
          dataset.tarefas = dataset.tarefas.filter((tarefa) => !fora.has(tarefa.id))
        }
      }

      dataset.publicacoesDeRotina.push({
        id: novoId('pub'),
        versao: anterior.versao,
        itensAnteriores: anterior.itens.map((item) => ({ ...item, horarios: [...item.horarios] })),
        criadas,
        retiradas,
        em: agora,
        por: entrada.por,
      })

      dataset.rotinaPadrao = {
        ...anterior,
        versao: anterior.versao + 1,
        itens: entrada.itens.map((item) => ({ ...item, horarios: [...item.horarios] })),
        vigenteDesde: entrada.vigenteDesde,
        publicadaEm: agora,
        publicadaPor: entrada.por,
      }

      return dataset.rotinaPadrao
    })
  },

  /**
   * Desfaz a última publicação.
   *
   * Um ato só: volta o template à versão anterior **e** remove as tarefas que a publicação criou
   * e que ninguém encostou. Meio desfazer não existe — com o template revertido e as tarefas de
   * pé, a próxima leitura da prancheta encontraria um dia que nenhuma versão do cadastro explica.
   *
   * O que alguém já marcou fica. Uma tarefa criada às 15:00 e feita às 15:20 é trabalho executado,
   * e desfazer uma publicação não desfaz trabalho de ninguém.
   */
  desfazer(): Promise<RotinaPadrao> {
    return simularChamada('rotina.padrao.desfazer', () => {
      const dataset = getDataset()
      const ultima = dataset.publicacoesDeRotina[dataset.publicacoesDeRotina.length - 1]

      if (!ultima) {
        return dataset.rotinaPadrao
      }

      const agora = agoraIso()
      const candidatas = new Set(ultima.criadas)

      dataset.tarefas = dataset.tarefas.filter(
        (tarefa) =>
          !candidatas.has(tarefa.id) ||
          tarefa.status !== 'pendente' ||
          tarefa.previstaPara <= agora,
      )

      dataset.rotinaPadrao = {
        ...dataset.rotinaPadrao,
        versao: ultima.versao,
        itens: ultima.itensAnteriores.map((item: ItemDeRotina) => ({
          ...item,
          horarios: [...item.horarios],
        })),
      }

      dataset.publicacoesDeRotina.pop()

      return dataset.rotinaPadrao
    })
  },

  /** Há o que desfazer? */
  temDesfazer(): boolean {
    return base().publicacoesDeRotina.length > 0
  },
}

/** O dia seguinte ao de hoje, às 00:00 — a vigência padrão de uma publicação. */
export function amanhaNaCasa(): ISODateTime {
  return `${addDays(dataDe(agoraIso()), 1)}T00:00:00${HOTEL_UTC_OFFSET}` as ISODateTime
}

/** Um hóspede na casa, o suficiente para escolher um numa lista. */
export type HospedeParaRotina = {
  hospedagemId: string
  petNome: string
  petIniciais: string
  petEspecie: PetSpecies | null
  petFotoUrl: string
  acomodacaoNome: string
  /** Quantos ajustes vigentes ele tem: é o que distingue quem já saiu do padrão. */
  ajustes: number
}

/** Os hóspedes que podem receber proposta ou medicação. Quem saiu não entra. */
export function hospedesParaRotina(): HospedeParaRotina[] {
  const dataset = base()

  return hospedados()
    .map((hospedagem) => {
      const pet = dataset.pets.find((item) => item.id === hospedagem.petId)
      const acomodacao = dataset.acomodacoes.find((item) => item.id === hospedagem.acomodacaoId)

      return {
        hospedagemId: hospedagem.id,
        petNome: pet?.nome ?? '',
        petIniciais: (pet?.nome ?? '').slice(0, 2).toUpperCase(),
        petEspecie: pet?.especie ?? null,
        petFotoUrl: pet?.fotoUrl ?? '',
        acomodacaoNome: acomodacao?.nome ?? '',
        ajustes: dataset.ajustesDeRotina.filter(
          (ajuste) => ajuste.hospedagemId === hospedagem.id && !ajuste.revogadoEm,
        ).length,
      }
    })
    .sort((um, outro) => um.petNome.localeCompare(outro.petNome))
}

/** Os ajustes vigentes de um hóspede, para a ficha dele. */
export function ajustesDoHospede(hospedagemId: string): AjusteDeRotina[] {
  return base().ajustesDeRotina.filter(
    (ajuste) => ajuste.hospedagemId === hospedagemId && !ajuste.revogadoEm,
  )
}

export const propostaRepository = {
  /**
   * A proposta de rotina para um hóspede.
   *
   * **A costura para a chamada real é aqui, e é a única.** Hoje o corpo monta a entrada a partir do
   * dataset e chama uma função determinista. Amanhã ele vira
   * `POST /hotel/hospedagens/:id/rotina/proposta`, a resposta passa pelo **mesmo** `validarProposta`
   * — a validação não confia no motor por ele ser da casa —, e nada acima muda: nem a store, nem o
   * diálogo, nem a página.
   *
   * `rotina.propor` é uma operação própria no painel de desenvolvimento de propósito: dá para
   * derrubar só a proposta e ver o resto da tela continuar de pé. Um módulo em que a queda da
   * sugestão leva a tela junto é um módulo que não pode ligar a sugestão.
   */
  propor(hospedagemId: string): Promise<PropostaDeRotina> {
    return simularChamada('rotina.propor', () => {
      const entrada = reunirEntrada(hospedagemId)

      return validarProposta(proporRotina(entrada, agoraIso()), entrada)
    })
  },

  /**
   * Aprova as sugestões escolhidas.
   *
   * Grava `AjusteDeRotina`, **nunca `TarefaDeRotina`**. A materialização acontece depois, pela
   * mesma fronteira idempotente de sempre — se a proposta criasse tarefas direto e o dia já
   * estivesse materializado, aprovar sem ler duplicaria o dia inteiro.
   */
  aprovar(entrada: {
    hospedagemId: string
    sugestoes: { kind: TarefaDaCasaKind; horarios: ClockTime[]; motivo: string }[]
    por: string
  }): Promise<AjusteDeRotina[]> {
    return simularChamada('rotina.aprovar', () => {
      const dataset = getDataset()
      const agora = agoraIso()
      const criados: AjusteDeRotina[] = []

      for (const sugestao of entrada.sugestoes) {
        /* Um ajuste novo do mesmo tipo revoga o anterior: dois vigentes seriam duas verdades. */
        for (const ajuste of dataset.ajustesDeRotina) {
          const mesmo =
            ajuste.hospedagemId === entrada.hospedagemId &&
            ajuste.kind === sugestao.kind &&
            !ajuste.revogadoEm

          if (mesmo) ajuste.revogadoEm = agora
        }

        const novo: AjusteDeRotina = {
          id: novoId('ajuste'),
          hospedagemId: entrada.hospedagemId,
          kind: sugestao.kind,
          acao: sugestao.horarios.length === 0 ? 'suspende' : 'substitui',
          horarios: [...sugestao.horarios],
          motivo: sugestao.motivo,
          origem: 'proposta',
          registradoEm: agora,
          registradoPor: entrada.por,
          revogadoEm: null,
        }

        dataset.ajustesDeRotina.push(novo)
        criados.push(novo)
      }

      return criados
    })
  },

  /** Encerra um ajuste sem apagar a linha que explica por que ele existiu. */
  revogar(ajusteId: string): Promise<void> {
    return simularChamada('rotina.aprovar', () => {
      const ajuste = getDataset().ajustesDeRotina.find((item) => item.id === ajusteId)

      if (ajuste) ajuste.revogadoEm = agoraIso()
    })
  },
}

/** Monta o que a proposta lê. Deliberadamente estreito: é o corpo da requisição futura. */
function reunirEntrada(hospedagemId: string): EntradaDaProposta {
  const dataset = base()
  const hospedagem = dataset.hospedagens.find((item) => item.id === hospedagemId)

  if (!hospedagem) {
    throw new Error('hospedagem-nao-encontrada')
  }

  const pet = dataset.pets.find((item) => item.id === hospedagem.petId)
  const ajustes = ajustesDoHospede(hospedagemId)

  const noites = Math.max(
    1,
    Math.round(
      (Date.parse(hospedagem.saidaPrevistaEm) - Date.parse(hospedagem.entradaEm)) / 86_400_000,
    ),
  )

  return {
    hospedagemId,
    especie: pet?.especie ?? null,
    adaptacao: hospedagem.adaptacao,
    inspecaoDeEntrada: hospedagem.inspecaoDeEntrada,
    noites,
    passeioAutorizado: hospedagem.autorizacoes.some(
      (item) => item.kind === 'passeio-externo' && item.concedida,
    ),
    medicacoes: dataset.medicacoes.filter((item) => item.hospedagemId === hospedagemId),
    horariosDeRefeicao: hospedagem.planoAlimentar.horarios,
    rotinaDaCasa: rotinaEfetiva(dataset.rotinaPadrao.itens, ajustes),
  }
}
