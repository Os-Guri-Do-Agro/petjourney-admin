/**
 * Repositório de vacinação.
 *
 * Duas leituras muito diferentes saem daqui, e é bom que saiam do mesmo lugar:
 *
 * - **A carteira de um paciente** — o que ele já tomou, em ordem. É o que o comprovante imprime
 *   e o que o vet confere antes de aplicar.
 * - **A lista de chamada da clínica** — quem está vencido ou a vencer, de todos os pacientes.
 *   É o motor de recorrência: vacina é a única consulta que a clínica pode **provocar**, e uma
 *   clínica que não chama perde a visita para o pet shop da esquina.
 * - **O que a clínica aplicou** — todas as aplicações, de todos os pacientes, da mais recente
 *   para a mais antiga. É o registro: o que saiu da geladeira, em quem, por quem e de que lote.
 *   A pergunta que ele responde não é "quem chamar", é "o que foi feito" — e é a que aparece
 *   quando a farmacovigilância pergunta por um lote, ou quando alguém confere o estoque.
 * - **O estoque** — o que tem na geladeira, o que vence antes de sair e o que falta comprar.
 *   Vacina é o único insumo da clínica que estraga sozinho na prateleira, e o cálculo inteiro
 *   sai de uma passada só (`domain/estoque-vacinas.ts`) para a tela não ter um cartão dizendo
 *   uma coisa e um gráfico dizendo outra.
 */

import type { PlanoVacinalDoPet, VacinaAplicadaNaClinica } from '../../contrato/responsavel'
import { createClinicClock } from '../../domain/clinic-time'
import { resumirEstoque, type ResumoDoEstoque } from '../../domain/estoque-vacinas'
import {
  avaliarValidade,
  lotesParaAplicar,
  type LoteParaAplicar,
} from '../../domain/lote-na-aplicacao'
import { montarPlanoVacinal, type PlanoVacinal } from '../../domain/protocolo-vacinal'
import { listaDeChamada, proximaDose, reforcosDoPaciente } from '../../domain/vacinacao'
import { CLINIC_UTC_OFFSET, vacinasFixture } from '../fixtures'
import { simularChamada } from '../mock-runtime'
import {
  projetarNotificacaoDaVacina,
  projetarPlanoVacinal,
  projetarVacina,
  type NotificacaoDaCarteirinha,
} from '../projecao-do-responsavel'
import { agoraIso, getDataset, novoId } from '../store'
import type {
  AplicacaoVacina,
  ISODate,
  ISODateTime,
  LoteDeVacina,
  PetSpecies,
  ProcedenciaExterna,
  ReforcoPendente,
  Vacina,
  ViaDeVacina,
} from '../types'

import { atendimentoNovo } from './agenda-repository'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

/**
 * Recusa de uma aplicação que a regra não deixa passar.
 *
 * `kind` traduzível, como o `MockError`: a tela escreve a frase, o repositório só diz qual regra.
 */
export class AplicacaoRecusadaError extends Error {
  readonly kind: 'lote-vencido' | 'sem-validade' | 'vacina-fora-da-especie'

  constructor(kind: AplicacaoRecusadaError['kind']) {
    super(`vacina.aplicar: ${kind}`)
    this.name = 'AplicacaoRecusadaError'
    this.kind = kind
  }
}

/** A carteirinha do app, como o contrato a entrega — o que a prévia do portal desenha. */
export type CarteirinhaNoApp = {
  petNome: string
  petIniciais: string
  /** A foto do perfil do pet, quando há — a mesma que o app mostra. */
  petFotoUrl: string
  nascimento: ISODate | null
  clinicaNome: string
  vacinas: VacinaAplicadaNaClinica[]
  plano: PlanoVacinalDoPet
  /** O aviso mais recente que a carteirinha soltou, para a prévia mostrar no topo do celular. */
  ultimaNotificacao: NotificacaoDaCarteirinha | null
}

/** A próxima dose já marcada na agenda, junto com a aplicação. */
export type ProximaNaAgenda = {
  professionalId: string
  inicio: ISODateTime
  fim: ISODateTime
}

/** Uma linha da lista de chamada, já com o paciente resolvido para a tela não buscar de novo. */
export type ChamadaDeVacina = ReforcoPendente & {
  petNome: string
  tutorNome: string
  tutorTelefone: string
  vacinaNome: string
  obrigatoria: boolean
}

/**
 * Uma aplicação com o que a tela precisa para desenhar a linha sem buscar de novo.
 *
 * Mesma escolha da lista de chamada: o repositório resolve paciente, responsável e vacina uma
 * vez, em vez de deixar a tabela fazer três buscas por linha em cada renderização.
 */
export type AplicacaoNaLista = AplicacaoVacina & {
  petNome: string
  especie: PetSpecies
  tutorNome: string
  vacinaNome: string
  obrigatoria: boolean
}

/**
 * O catálogo com o piso que a clínica ajustou.
 *
 * O piso de fábrica vem da fixture; o ajustado pela tela mora no dataset, por cima. Toda conta de
 * estoque passa por aqui — o gráfico que lesse a fixture e o pedido que lesse o ajuste discordariam
 * sobre o que falta comprar.
 */
export function catalogoComPiso(): Vacina[] {
  const pisos = getDataset().estoqueMinimo

  return vacinasFixture.map((vacina) =>
    pisos[vacina.id] === undefined
      ? { ...vacina }
      : { ...vacina, estoqueMinimo: pisos[vacina.id]! },
  )
}

export const vacinaRepository = {
  catalogo(): Vacina[] {
    return catalogoComPiso()
  },

  /** Carteira do paciente: da aplicação mais recente para a mais antiga. */
  doPaciente(petId: string): Promise<AplicacaoVacina[]> {
    return simularChamada('paciente.historico', () =>
      getDataset()
        .aplicacoesDeVacina.filter((item) => item.petId === petId)
        .sort((a, b) => b.aplicadaEm.localeCompare(a.aplicadaEm)),
    )
  },

  /**
   * Tudo o que a clínica aplicou, da aplicação mais recente para a mais antiga.
   *
   * Aplicação cujo paciente não existe mais no cadastro é descartada em silêncio: a linha não
   * teria nome, e uma tabela com células vazias no lugar do paciente parece defeito de carga.
   */
  aplicadas(): Promise<AplicacaoNaLista[]> {
    return simularChamada('paciente.listar', () => {
      const dataset = getDataset()

      return dataset.aplicacoesDeVacina
        .map((aplicacao) => {
          const pet = dataset.pets.find((item) => item.id === aplicacao.petId)

          if (!pet) {
            return null
          }

          const tutor = dataset.tutores.find((item) => item.id === pet.tutorId)
          const vacina = vacinasFixture.find((item) => item.id === aplicacao.vacinaId)

          return {
            ...aplicacao,
            petNome: pet.nome,
            especie: pet.especie,
            tutorNome: tutor?.nome ?? '',
            vacinaNome: vacina?.nome ?? aplicacao.vacinaId,
            obrigatoria: vacina?.obrigatoria ?? false,
          }
        })
        .filter((item): item is AplicacaoNaLista => item !== null)
        .sort((a, b) => b.aplicadaEm.localeCompare(a.aplicadaEm))
    })
  },

  /** Os lotes crus, para quem precisa do registro e não do cálculo. */
  lotes(): Promise<LoteDeVacina[]> {
    return simularChamada('paciente.listar', () =>
      getDataset().lotesDeVacina.map((lote) => ({ ...lote, perdas: [...lote.perdas] })),
    )
  },

  /**
   * O estoque inteiro, calculado de uma vez.
   *
   * Indicadores, lotes, saldo por vacina e consumo mensal saem juntos e do mesmo recorte. A tela
   * não faz conta nenhuma: o clássico "o cartão diz 40 doses e o gráfico soma 38" nasce de cada
   * pedaço da tela somar por conta própria.
   */
  estoque(): Promise<ResumoDoEstoque> {
    return simularChamada('paciente.listar', () => {
      const dataset = getDataset()

      return resumirEstoque({
        lotes: dataset.lotesDeVacina,
        vacinas: catalogoComPiso(),
        aplicacoes: dataset.aplicacoesDeVacina,
        hoje: clock.today(),
      })
    })
  },

  reforcosDoPaciente(petId: string): Promise<ReforcoPendente[]> {
    return simularChamada('paciente.historico', () =>
      reforcosDoPaciente(
        getDataset().aplicacoesDeVacina.filter((item) => item.petId === petId),
        vacinasFixture,
        clock.today(),
      ),
    )
  },

  /**
   * Quem a clínica precisa chamar.
   *
   * Percorre paciente a paciente em vez de olhar as aplicações soltas, porque o que vence é a
   * **última** dose de cada vacina de cada animal — e agrupar depois produziria o mesmo
   * paciente repetido uma vez por dose já tomada.
   */
  listaDeChamada(): Promise<ChamadaDeVacina[]> {
    return simularChamada('paciente.listar', () => {
      const dataset = getDataset()
      const hoje = clock.today()
      const porPet = new Map<string, AplicacaoVacina[]>()

      for (const aplicacao of dataset.aplicacoesDeVacina) {
        porPet.set(aplicacao.petId, [...(porPet.get(aplicacao.petId) ?? []), aplicacao])
      }

      const linhas: ChamadaDeVacina[] = []

      for (const [petId, aplicacoes] of porPet) {
        const pet = dataset.pets.find((item) => item.id === petId)

        if (!pet) {
          continue
        }

        const tutor = dataset.tutores.find((item) => item.id === pet.tutorId)

        for (const pendente of listaDeChamada(
          reforcosDoPaciente(aplicacoes, vacinasFixture, hoje),
        )) {
          const vacina = vacinasFixture.find((item) => item.id === pendente.vacinaId)

          linhas.push({
            ...pendente,
            petNome: pet.nome,
            tutorNome: tutor?.nome ?? '',
            tutorTelefone: tutor?.telefone ?? '',
            vacinaNome: vacina?.nome ?? pendente.vacinaId,
            obrigatoria: vacina?.obrigatoria ?? false,
          })
        }
      }

      return linhas.sort((a, b) => a.diasParaVencer - b.diasParaVencer)
    })
  },

  /**
   * O protocolo do paciente: a sequência inteira e onde ele está nela.
   *
   * Síncrono de propósito, como o `catalogo`: é conta sobre o que a tela já carregou, e o
   * diálogo de aplicação o recalcula a cada troca de vacina sem pagar latência.
   */
  plano(petId: string): PlanoVacinal | null {
    const dataset = getDataset()
    const pet = dataset.pets.find((item) => item.id === petId)

    if (!pet) {
      return null
    }

    return montarPlanoVacinal({
      pet,
      vacinas: vacinasFixture,
      aplicacoes: dataset.aplicacoesDeVacina,
      agendamentos: dataset.appointments
        .filter((item) => item.petId === petId)
        .map((item) => ({
          id: item.id,
          inicio: item.inicio,
          cancelado: item.status === 'cancelado',
        })),
      hoje: clock.today(),
    })
  },

  /** Os frascos desta vacina na geladeira, na ordem em que devem sair — o vencido travado no fim. */
  lotesParaAplicar(vacinaId: string): Promise<LoteParaAplicar[]> {
    return simularChamada('paciente.listar', () => {
      const dataset = getDataset()
      const hoje = clock.today()
      const { lotes } = resumirEstoque({
        lotes: dataset.lotesDeVacina,
        vacinas: vacinasFixture,
        aplicacoes: dataset.aplicacoesDeVacina,
        hoje,
      })

      return lotesParaAplicar(lotes, vacinaId, hoje)
    })
  },

  /**
   * A carteirinha do responsável, **na forma do contrato**.
   *
   * A prévia do portal desenha isto, e não o registro da clínica, de propósito: se a prévia lesse
   * o dado interno, ela mostraria o que a clínica sabe — e a demonstração precisa mostrar o que o
   * celular recebe, com as mesmas lacunas (sem lote na externa, sem nome de quem aplicou fora).
   */
  naCarteirinha(petId: string): Promise<CarteirinhaNoApp | null> {
    return simularChamada('paciente.historico', () => {
      const dataset = getDataset()
      const pet = dataset.pets.find((item) => item.id === petId)

      if (!pet) {
        return null
      }

      const ctx = { dataset, agora: agoraIso() }
      const doPet = dataset.aplicacoesDeVacina.filter((item) => item.petId === petId)
      const notificacoes = doPet
        .map((item) => projetarNotificacaoDaVacina(item, ctx))
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))

      return {
        petNome: pet.nome,
        petIniciais: pet.iniciais,
        petFotoUrl: pet.fotoUrl,
        nascimento: pet.nascimento,
        clinicaNome: dataset.clinic.nome,
        vacinas: doPet
          .map((item) => projetarVacina(item, ctx))
          .sort((a, b) => b.aplicadaEm.localeCompare(a.aplicadaEm)),
        plano: projetarPlanoVacinal(petId, ctx),
        ultimaNotificacao: notificacoes[0] ?? null,
      }
    })
  },

  /**
   * Aplica uma dose aqui.
   *
   * Três coisas acontecem na mesma gravação, e nenhuma pode ficar para depois:
   *
   * - **A data da próxima dose é congelada.** Se o calendário da vacina mudar no catálogo no ano
   *   que vem, o que já foi aplicado continua valendo pela regra do dia — que é o que está escrito
   *   na carteira do animal. O tamanho da série também: é o da idade em que ela começou.
   * - **O lote é conferido de novo.** A tela já trava o vencido, mas a regra mora aqui: um lote
   *   vencido que passasse por um diálogo desatualizado entraria na carteira com validade anterior
   *   à aplicação.
   * - **A próxima dose é marcada**, quando quem aplica aceitou o horário sugerido. Marcar depois é
   *   o que não acontece: o responsável sai da clínica com a data na cabeça e sem horário.
   */
  aplicar(input: {
    petId: string
    vacinaId: string
    professionalId: string
    lote: string
    validadeLote: ISODate
    dose: number
    dosesNaSerie: number
    via: ViaDeVacina
    observacao: string
    encounterId: string | null
    proximaNaAgenda: ProximaNaAgenda | null
  }): Promise<AplicacaoVacina> {
    return simularChamada('encounter.salvar', () => {
      const dataset = getDataset()
      const vacina = vacinasFixture.find((item) => item.id === input.vacinaId)
      const pet = dataset.pets.find((item) => item.id === input.petId)

      if (!vacina) {
        throw new Error(`vacina.aplicar: ${input.vacinaId} fora do catálogo`)
      }

      if (!pet || !vacina.especies.includes(pet.especie)) {
        throw new AplicacaoRecusadaError('vacina-fora-da-especie')
      }

      const agora = agoraIso()
      const hoje = clock.dateOf(agora)
      const validade = avaliarValidade(input.validadeLote, hoje)

      if (!validade.pode) {
        throw new AplicacaoRecusadaError(
          validade.motivo === 'vencido' ? 'lote-vencido' : 'sem-validade',
        )
      }

      const aplicacao: AplicacaoVacina = {
        id: novoId('apl'),
        petId: input.petId,
        vacinaId: input.vacinaId,
        origem: 'clinica',
        professionalId: input.professionalId,
        aplicadaEm: agora,
        lote: input.lote.trim(),
        validadeLote: input.validadeLote,
        dose: input.dose,
        dosesNaSerie: input.dosesNaSerie,
        via: input.via,
        proximaDoseEm: proximaDose(vacina, input.dose, hoje, input.dosesNaSerie),
        agendamentoDaProximaId: null,
        encounterId: input.encounterId,
        externa: null,
        observacao: input.observacao.trim(),
      }

      if (input.proximaNaAgenda) {
        const marcado = atendimentoNovo(
          {
            petId: pet.id,
            tutorId: pet.tutorId,
            professionalId: input.proximaNaAgenda.professionalId,
            roomIds: [],
            typeId: 'tipo-vacina',
            inicio: input.proximaNaAgenda.inicio,
            fim: input.proximaNaAgenda.fim,
            encaixe: false,
            observacao: `${vacina.nome} · dose ${Math.min(input.dose + 1, input.dosesNaSerie)} de ${input.dosesNaSerie}`,
            origem: 'retorno',
          },
          agora,
        )

        dataset.appointments.push(marcado)
        aplicacao.agendamentoDaProximaId = marcado.id
      }

      dataset.aplicacoesDeVacina.push(aplicacao)

      /*
       * A aplicação também vira evento de histórico. Sem isto, a carteira teria o registro e a
       * linha do tempo do paciente não — e são duas telas que o vet compara.
       */
      dataset.timeline.push({
        id: `tl-vac-${aplicacao.id}`,
        petId: input.petId,
        kind: 'vacina',
        em: agora,
        titulo: vacina.nome,
        resumo: `Lote ${aplicacao.lote} · dose ${input.dose}/${input.dosesNaSerie}`,
        encounterId: input.encounterId,
        appointmentId: null,
      })

      return aplicacao
    })
  },

  /**
   * Registra uma dose que a clínica **não aplicou**.
   *
   * Sem lote e sem validade, e isso não é campo esquecido: a clínica não sabe de que frasco saiu,
   * e um código copiado de memória seria rastreabilidade falsa. O que ela sabe — onde, quando,
   * e se viu o papel — entra, com o nome de quem transcreveu. A próxima dose sai da mesma conta
   * da aplicação daqui, porque a posição na série é a mesma.
   */
  registrarExterna(input: {
    petId: string
    vacinaId: string
    aplicadaEm: ISODate
    dose: number
    dosesNaSerie: number
    local: string
    aplicador: string
    procedencia: ProcedenciaExterna
    registradaPor: string
    observacao: string
  }): Promise<AplicacaoVacina> {
    return simularChamada('encounter.salvar', () => {
      const dataset = getDataset()
      const vacina = vacinasFixture.find((item) => item.id === input.vacinaId)
      const pet = dataset.pets.find((item) => item.id === input.petId)

      if (!vacina) {
        throw new Error(`vacina.registrarExterna: ${input.vacinaId} fora do catálogo`)
      }

      if (!pet || !vacina.especies.includes(pet.especie)) {
        throw new AplicacaoRecusadaError('vacina-fora-da-especie')
      }

      const agora = agoraIso()
      const aplicacao: AplicacaoVacina = {
        id: novoId('apl'),
        petId: input.petId,
        vacinaId: input.vacinaId,
        origem: 'externa',
        professionalId: '',
        /* O papel diz o dia, não a hora: meio-dia é o menos enganoso dos horários inventados. */
        aplicadaEm: clock.toIso(input.aplicadaEm, 12 * 60),
        lote: null,
        validadeLote: null,
        dose: input.dose,
        dosesNaSerie: input.dosesNaSerie,
        via: null,
        proximaDoseEm: proximaDose(vacina, input.dose, input.aplicadaEm, input.dosesNaSerie),
        agendamentoDaProximaId: null,
        encounterId: null,
        externa: {
          local: input.local.trim(),
          aplicador: input.aplicador.trim(),
          procedencia: input.procedencia,
          registradaPor: input.registradaPor,
          registradaEm: agora,
        },
        observacao: input.observacao.trim(),
      }

      dataset.aplicacoesDeVacina.push(aplicacao)
      dataset.timeline.push({
        id: `tl-vac-${aplicacao.id}`,
        petId: input.petId,
        kind: 'vacina',
        em: aplicacao.aplicadaEm,
        titulo: vacina.nome,
        resumo: `${aplicacao.externa!.local} · dose ${input.dose}/${input.dosesNaSerie} · sem lote`,
        encounterId: null,
        appointmentId: null,
      })

      return aplicacao
    })
  },
}
