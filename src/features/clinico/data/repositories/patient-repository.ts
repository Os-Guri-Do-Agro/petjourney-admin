/**
 * Repositório de pacientes e responsáveis.
 *
 * A busca é a mesma que a recepção faz no balcão: nome do paciente **ou** nome/telefone de
 * quem responde por ele. Acento não pode ser barreira — quem digita "acai" precisa achar
 * "Açaí".
 */

import { resumirFaltas } from '../../domain/load'
import { createClinicClock } from '../../domain/clinic-time'
import { CLINIC_UTC_OFFSET } from '../fixtures'
import { simularChamada } from '../mock-runtime'
import { getDataset, novoId } from '../store'
import type {
  Appointment,
  ISODate,
  NoShowSummary,
  Pet,
  PetSex,
  PetSpecies,
  Tutor,
} from '../types'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

export const LIMITE_REINCIDENCIA = 3

/** Duas letras para o avatar: primeira do nome e primeira do segundo termo, quando existe. */
function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/s+/).filter(Boolean)
  const primeira = partes[0]?.[0] ?? '?'
  const segunda = partes[1]?.[0] ?? partes[0]?.[1] ?? ''

  return (primeira + segunda).toUpperCase()
}

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

export type PacienteResumo = {
  pet: Pet
  tutor: Tutor | null
  ultimoAtendimentoEm: string | null
  proximoAtendimentoEm: string | null
  atendimentosNoAno: number
}

export const patientRepository = {
  buscar(termo: string, limite = 50): Promise<PacienteResumo[]> {
    return simularChamada('paciente.listar', () => {
      const alvo = normalizar(termo)
      const dataset = getDataset()
      const agora = clock.nowIso()

      return getDataset().pets
        .map((pet) => {
          const tutor = getDataset().tutores.find((item) => item.id === pet.tutorId) ?? null
          const doPet = dataset.appointments.filter(
            (appointment) => appointment.petId === pet.id && appointment.status !== 'cancelado',
          )

          const passados = doPet
            .filter((appointment) => appointment.fim < agora)
            .sort((a, b) => b.inicio.localeCompare(a.inicio))
          const futuros = doPet
            .filter((appointment) => appointment.inicio >= agora)
            .sort((a, b) => a.inicio.localeCompare(b.inicio))

          return {
            pet,
            tutor,
            ultimoAtendimentoEm: passados[0]?.inicio ?? null,
            proximoAtendimentoEm: futuros[0]?.inicio ?? null,
            atendimentosNoAno: doPet.filter(
              (appointment) => appointment.inicio.slice(0, 4) === agora.slice(0, 4),
            ).length,
          }
        })
        .filter(({ pet, tutor }) => {
          if (!alvo) {
            return true
          }

          return (
            normalizar(pet.nome).includes(alvo) ||
            normalizar(pet.raca).includes(alvo) ||
            normalizar(tutor?.nome ?? '').includes(alvo) ||
            (tutor?.telefone ?? '').replace(/\D/g, '').includes(alvo.replace(/\D/g, '')) ||
            false
          )
        })
        .sort((a, b) => a.pet.nome.localeCompare(b.pet.nome, 'pt-BR'))
        .slice(0, limite)
    })
  },

  obter(petId: string): Promise<{ pet: Pet; tutor: Tutor | null } | null> {
    return simularChamada('paciente.listar', () => {
      const pet = getDataset().pets.find((item) => item.id === petId)

      if (!pet) {
        return null
      }

      return { pet, tutor: getDataset().tutores.find((item) => item.id === pet.tutorId) ?? null }
    })
  },

  atendimentosDoPet(petId: string): Promise<Appointment[]> {
    return simularChamada('paciente.historico', () =>
      getDataset()
        .appointments.filter((appointment) => appointment.petId === petId)
        .sort((a, b) => b.inicio.localeCompare(a.inicio)),
    )
  },

  /** Painel de faltas: quantas **e quanto** — minutos de agenda parados. */
  resumoDeFaltas(): Promise<Array<NoShowSummary & { pet: Pet | null; tutor: Tutor | null }>> {
    return simularChamada('paciente.listar', () =>
      resumirFaltas(getDataset().appointments, clock, LIMITE_REINCIDENCIA).map((resumo) => ({
        ...resumo,
        pet: getDataset().pets.find((item) => item.id === resumo.petId) ?? null,
        tutor: getDataset().tutores.find((item) => item.id === resumo.tutorId) ?? null,
      })),
    )
  },

  /*
   * Cópia, não a array do dataset.
   *
   * Devolvendo a array viva, cadastrar um paciente mutava em lugar: a store reatribuía a **mesma
   * referência**, o Vue não via mudança nenhuma, e o paciente recém-criado não aparecia na lista
   * do agendamento. De quebra, quem recebia a array podia alterar o dataset sem passar por aqui.
   */
  todosOsPets(): Pet[] {
    return [...getDataset().pets]
  },

  todosOsTutores(): Tutor[] {
    return [...getDataset().tutores]
  },

  /**
   * Cadastro de paciente feito no balcão, no meio de um agendamento.
   *
   * Aceita responsável existente ou novo — quem liga para marcar costuma ser cliente antigo com
   * bicho novo, e obrigar a recadastrar a pessoa criaria um segundo cadastro com o mesmo telefone.
   *
   * O que é exigido aqui é o mínimo para o atendimento acontecer: nome, espécie e alguém por quem
   * chamar. Data de nascimento e peso entram depois, na primeira consulta — pedi-los no telefone
   * é convidar quem atende a inventar.
   */
  criarPaciente(input: {
    nome: string
    especie: PetSpecies
    raca: string
    sexo: PetSex
    nascimento: ISODate | null
    pesoKg: number | null
    castrado: boolean
    tutorId: string | null
    novoTutor: { nome: string; telefone: string; documento: string; email: string } | null
  }): Promise<{ pet: Pet; tutor: Tutor }> {
    return simularChamada('paciente.listar', () => {
      const dataset = getDataset()

      const tutor = input.tutorId
        ? dataset.tutores.find((item) => item.id === input.tutorId)
        : undefined

      const responsavel: Tutor = tutor ?? {
        id: novoId('tutor'),
        nome: input.novoTutor?.nome.trim() ?? '',
        telefone: input.novoTutor?.telefone.trim() ?? '',
        email: input.novoTutor?.email.trim() ?? '',
        documento: input.novoTutor?.documento.trim() ?? '',
      }

      if (!tutor) {
        dataset.tutores.push(responsavel)
      }

      const pet: Pet = {
        id: novoId('pet'),
        nome: input.nome.trim(),
        especie: input.especie,
        raca: input.raca.trim(),
        sexo: input.sexo,
        nascimento: input.nascimento,
        castrado: input.castrado,
        pesoKg: input.pesoKg,
        tutorId: responsavel.id,
        alertas: [],
        iniciais: iniciaisDe(input.nome),
      }

      dataset.pets.push(pet)

      return { pet, tutor: responsavel }
    })
  },
}
