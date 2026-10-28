/**
 * Cadastro das acomodações.
 *
 * Configuração, e não trabalho de plantão: acontece no dia da mudança. Mesmo assim mora num
 * repositório com as mesmas regras do resto, porque **remover uma acomodação errada é
 * irreversível** — e a única coisa que separa o cadastro de um apagamento acidental são as três
 * recusas deste arquivo.
 */

import { reservaSegura } from '../../domain/disponibilidade'
import { simularChamada } from '../mock-runtime'
import { agoraIso, getDataset } from '../store'
import type {
  Acomodacao,
  AcomodacaoInativaMotivo,
  PetPorte,
  PetSpecies,
  RecursoDaAcomodacao,
} from '../types'

function base() {
  return getDataset()
}

/**
 * Por que uma mudança de cadastro foi recusada.
 *
 * `kind` e não frase: a tela traduz. Sem ele, a interface só saberia dizer "não deu" numa tela de
 * configuração — e "não deu" faz a pessoa tentar de novo exatamente do mesmo jeito.
 */
export type ImpedimentoDeCadastro =
  | 'nome-repetido'
  | 'ocupada'
  | 'tem-reserva'
  /** Tirar de operação com reserva marcada: a reserva precisa mudar de acomodação antes. */
  | 'tem-reserva-inativar'
  | 'tem-historico'
  | 'nao-encontrada'
  /**
   * O item ainda é apontado por outro.
   *
   * Vale para o corredor que tem acomodação dentro e para a tabela de preço que alguma acomodação
   * usa. Apagar qualquer um dos dois deixaria a acomodação apontando para um identificador morto —
   * e o defeito não apareceria no momento do apagamento, e sim na próxima vez que alguém tentasse
   * fazer uma reserva.
   */
  | 'em-uso'
  /**
   * Sobrou um, e um é o mínimo.
   *
   * Sem nenhuma tabela de preço não há como cadastrar acomodação nenhuma; sem nenhum corredor não
   * há onde pôr o que se cadastrar. A tela ficaria num estado do qual ela mesma não sabe sair.
   */
  | 'ultimo'

export class CadastroRecusadoError extends Error {
  readonly kind: ImpedimentoDeCadastro

  constructor(kind: ImpedimentoDeCadastro) {
    super(`[mock] cadastro de acomodação recusado: ${kind}`)
    this.name = 'CadastroRecusadoError'
    this.kind = kind
  }
}

function nomeJaExiste(nome: string, exceto?: string) {
  const alvo = nome.trim().toLocaleLowerCase('pt-BR')

  return base().acomodacoes.some(
    (item) => item.id !== exceto && item.nome.trim().toLocaleLowerCase('pt-BR') === alvo,
  )
}

/** Reservas futuras ou em curso que dependem desta acomodação. */
function reservasVivas(acomodacaoId: string) {
  return base().reservas.filter(
    (reserva) => reserva.acomodacaoId === acomodacaoId && reservaSegura(reserva),
  )
}

export const acomodacaoRepository = {
  listar(): Promise<Acomodacao[]> {
    return simularChamada('acomodacao.salvar', () => [...base().acomodacoes])
  },

  criar(entrada: {
    nome: string
    blocoId: string
    tipoId: string
    capacidade: number
    porteMaximo: PetPorte
    especiesAceitas: PetSpecies[]
    recursos: RecursoDaAcomodacao[]
    higienizacaoMinutos: number
    tarifaId: string
  }): Promise<Acomodacao> {
    return simularChamada('acomodacao.salvar', () => {
      if (!entrada.nome.trim() || nomeJaExiste(entrada.nome)) {
        throw new CadastroRecusadoError('nome-repetido')
      }

      const acomodacao: Acomodacao = {
        /*
         * Id derivado do nome e não sequencial: a casa chama a baia de "A8", e um identificador que
         * não diga isso transforma qualquer investigação de log numa tradução.
         */
        id: `acom-${entrada.nome.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, '-')}`,
        nome: entrada.nome.trim(),
        blocoId: entrada.blocoId,
        tipoId: entrada.tipoId,
        capacidade: Math.max(1, entrada.capacidade),
        porteMaximo: entrada.porteMaximo,
        especiesAceitas: entrada.especiesAceitas,
        recursos: entrada.recursos,
        higienizacaoMinutos: Math.max(0, entrada.higienizacaoMinutos),
        tarifaId: entrada.tarifaId,
        ativa: true,
        motivoInativa: null,
        detalheInativa: '',
        inativaDesde: null,
      }

      base().acomodacoes.push(acomodacao)

      return acomodacao
    })
  },

  editar(entrada: {
    acomodacaoId: string
    nome: string
    tipoId: string
    capacidade: number
    porteMaximo: PetPorte
    especiesAceitas: PetSpecies[]
    recursos: RecursoDaAcomodacao[]
    higienizacaoMinutos: number
    tarifaId: string
  }): Promise<Acomodacao> {
    return simularChamada('acomodacao.salvar', () => {
      const acomodacao = base().acomodacoes.find((item) => item.id === entrada.acomodacaoId)

      if (!acomodacao) {
        throw new CadastroRecusadoError('nao-encontrada')
      }

      if (!entrada.nome.trim() || nomeJaExiste(entrada.nome, acomodacao.id)) {
        throw new CadastroRecusadoError('nome-repetido')
      }

      /*
       * Reduzir capacidade ou porte com reserva viva em cima é recusado: a reserva foi vendida
       * contra o que a acomodação era, e encolher a acomodação por baixo dela produziria um hóspede
       * gigante numa baia média no dia da chegada.
       */
      const vivas = reservasVivas(acomodacao.id)

      if (
        vivas.length > 0 &&
        (entrada.capacidade < acomodacao.capacidade || entrada.tipoId !== acomodacao.tipoId)
      ) {
        throw new CadastroRecusadoError('tem-reserva')
      }

      acomodacao.nome = entrada.nome.trim()
      acomodacao.tipoId = entrada.tipoId
      acomodacao.capacidade = Math.max(1, entrada.capacidade)
      acomodacao.porteMaximo = entrada.porteMaximo
      acomodacao.especiesAceitas = entrada.especiesAceitas
      acomodacao.recursos = entrada.recursos
      acomodacao.higienizacaoMinutos = Math.max(0, entrada.higienizacaoMinutos)
      acomodacao.tarifaId = entrada.tarifaId

      return acomodacao
    })
  },

  /**
   * Tira de operação.
   *
   * Recusa se há alguém dentro — desativar uma acomodação ocupada não é configuração, é despejo. O
   * `inativaDesde` é gravado aqui e não editável: é ele que transforma "em manutenção" em
   * informação, e uma data que alguém pode digitar deixa de ser prova.
   */
  desativar(entrada: {
    acomodacaoId: string
    motivo: AcomodacaoInativaMotivo
    detalhe: string
  }): Promise<Acomodacao> {
    return simularChamada('acomodacao.salvar', () => {
      const dataset = base()
      const acomodacao = dataset.acomodacoes.find((item) => item.id === entrada.acomodacaoId)

      if (!acomodacao) {
        throw new CadastroRecusadoError('nao-encontrada')
      }

      const ocupada = dataset.hospedagens.some(
        (item) => item.acomodacaoId === acomodacao.id && item.status === 'hospedado',
      )

      if (ocupada) {
        throw new CadastroRecusadoError('ocupada')
      }

      /*
       * Reserva marcada também trava. Sem isto, tirar a Baia A5 para manutenção deixava a estadia
       * do Bidu, confirmada para daqui a três dias, presa numa baia fora de operação, e ninguém
       * ficava sabendo até o dia da chegada.
       */
      if (reservasVivas(acomodacao.id).length > 0) {
        throw new CadastroRecusadoError('tem-reserva-inativar')
      }

      acomodacao.ativa = false
      acomodacao.motivoInativa = entrada.motivo
      acomodacao.detalheInativa = entrada.detalhe
      acomodacao.inativaDesde = agoraIso()

      return acomodacao
    })
  },

  reativar(acomodacaoId: string): Promise<Acomodacao> {
    return simularChamada('acomodacao.salvar', () => {
      const acomodacao = base().acomodacoes.find((item) => item.id === acomodacaoId)

      if (!acomodacao) {
        throw new CadastroRecusadoError('nao-encontrada')
      }

      acomodacao.ativa = true
      acomodacao.motivoInativa = null
      acomodacao.detalheInativa = ''
      acomodacao.inativaDesde = null

      return acomodacao
    })
  },

  /**
   * Remove — e só o que nunca hospedou.
   *
   * Apagar uma acomodação com história apagaria a história junto: a estadia de março passaria a
   * apontar para um lugar que não existe, e o relatório de ocupação do trimestre mudaria sozinho.
   * O que a casa quer, nesse caso, é `desativar`.
   */
  remover(acomodacaoId: string): Promise<void> {
    return simularChamada('acomodacao.salvar', () => {
      const dataset = base()
      const indice = dataset.acomodacoes.findIndex((item) => item.id === acomodacaoId)

      if (indice < 0) {
        throw new CadastroRecusadoError('nao-encontrada')
      }

      if (dataset.hospedagens.some((item) => item.acomodacaoId === acomodacaoId)) {
        throw new CadastroRecusadoError('tem-historico')
      }

      if (reservasVivas(acomodacaoId).length > 0) {
        throw new CadastroRecusadoError('tem-reserva')
      }

      dataset.acomodacoes.splice(indice, 1)
    })
  },
}
