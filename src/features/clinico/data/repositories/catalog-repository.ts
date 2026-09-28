/**
 * Catálogos: profissionais, salas, tipos de atendimento, medicamentos, diagnósticos, exames e
 * faixas de referência.
 *
 * São dados que mudam devagar e que a tela consulta o tempo todo. Ficam atrás de repositório
 * pelo mesmo motivo dos outros: componente que importa fixture não sobrevive à API.
 */

import { simularChamada } from '../mock-runtime'
import {
  appointmentTypesFixture,
  diagnosisCatalogFixture,
  examCatalogFixture,
  medicationsFixture,
  professionalsFixture,
  referenceRangesFixture,
  roomsFixture,
  vacinasFixture,
} from '../fixtures'
import { getDataset } from '../store'
import type { PoliticaDaClinica } from '../../contrato/responsavel'
import type {
  AppointmentType,
  Clinic,
  DiagnosisCatalogItem,
  ExamCatalogItem,
  Medication,
  Professional,
  ReferenceRange,
  Room,
  Vacina,
} from '../types'

export type CatalogosClinicos = {
  clinic: Clinic
  /** Os prazos combinados com quem marca pelo app. Ver `domain/politica.ts`. */
  politica: PoliticaDaClinica
  profissionais: Professional[]
  salas: Room[]
  tipos: AppointmentType[]
  medicamentos: Medication[]
  diagnosticos: DiagnosisCatalogItem[]
  exames: ExamCatalogItem[]
  faixas: ReferenceRange[]
  vacinas: Vacina[]
}

export const catalogRepository = {
  carregar(): Promise<CatalogosClinicos> {
    return simularChamada('catalogo.listar', () => ({
      clinic: getDataset().clinic,
      politica: getDataset().politica,
      profissionais: professionalsFixture.filter((professional) => professional.ativo),
      salas: roomsFixture,
      tipos: appointmentTypesFixture,
      medicamentos: medicationsFixture,
      diagnosticos: diagnosisCatalogFixture,
      exames: examCatalogFixture,
      faixas: referenceRangesFixture,
      vacinas: vacinasFixture,
    }))
  },

  buscarDiagnosticos(termo: string, limite = 12): Promise<DiagnosisCatalogItem[]> {
    return simularChamada('catalogo.listar', () => {
      const alvo = termo.trim().toLowerCase()

      return diagnosisCatalogFixture
        .filter(
          (item) =>
            !alvo ||
            item.descricao.toLowerCase().includes(alvo) ||
            item.codigo.toLowerCase().includes(alvo),
        )
        .slice(0, limite)
    })
  },

  buscarMedicamentos(termo: string, limite = 12): Promise<Medication[]> {
    return simularChamada('catalogo.listar', () => {
      const alvo = termo.trim().toLowerCase()

      return medicationsFixture
        .filter(
          (item) =>
            !alvo ||
            item.nome.toLowerCase().includes(alvo) ||
            item.principioAtivo.toLowerCase().includes(alvo),
        )
        .slice(0, limite)
    })
  },
}
