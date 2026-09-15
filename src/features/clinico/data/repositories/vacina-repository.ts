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
 */

import { createClinicClock } from '../../domain/clinic-time'
import { listaDeChamada, proximaDose, reforcosDoPaciente } from '../../domain/vacinacao'
import { CLINIC_UTC_OFFSET, vacinasFixture } from '../fixtures'
import { simularChamada } from '../mock-runtime'
import { agoraIso, getDataset, novoId } from '../store'
import type {
  AplicacaoVacina,
  ISODate,
  PetSpecies,
  PrescriptionRoute,
  ReforcoPendente,
  Vacina,
} from '../types'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

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
  /** Doses da série no catálogo — é o denominador de "2 de 3". */
  dosesNaSerie: number
}

export const vacinaRepository = {
  catalogo(): Vacina[] {
    return [...vacinasFixture]
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
            dosesNaSerie: vacina?.dosesNaSerie ?? 1,
          }
        })
        .filter((item): item is AplicacaoNaLista => item !== null)
        .sort((a, b) => b.aplicadaEm.localeCompare(a.aplicadaEm))
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
   * Registra uma aplicação.
   *
   * A data do próximo reforço é **congelada aqui**, e não recalculada na leitura: se o
   * calendário da vacina mudar no catálogo no ano que vem, o que já foi aplicado continua
   * valendo pela regra do dia em que foi aplicado — que é o que está escrito na carteira do
   * animal.
   */
  registrar(input: {
    petId: string
    vacinaId: string
    professionalId: string
    lote: string
    validadeLote: ISODate
    dose: number
    via: PrescriptionRoute
    observacao: string
  }): Promise<AplicacaoVacina> {
    return simularChamada('encounter.salvar', () => {
      const dataset = getDataset()
      const vacina = vacinasFixture.find((item) => item.id === input.vacinaId)

      if (!vacina) {
        throw new Error(`vacina.registrar: ${input.vacinaId} fora do catálogo`)
      }

      const agora = agoraIso()
      const aplicacao: AplicacaoVacina = {
        id: novoId('apl'),
        petId: input.petId,
        vacinaId: input.vacinaId,
        professionalId: input.professionalId,
        aplicadaEm: agora,
        lote: input.lote.trim(),
        validadeLote: input.validadeLote,
        dose: input.dose,
        via: input.via,
        proximaDoseEm: proximaDose(vacina, input.dose, clock.dateOf(agora)),
        observacao: input.observacao.trim(),
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
        resumo: `Lote ${aplicacao.lote} · dose ${input.dose}/${vacina.dosesNaSerie}`,
        encounterId: null,
        appointmentId: null,
      })

      return aplicacao
    })
  },
}
