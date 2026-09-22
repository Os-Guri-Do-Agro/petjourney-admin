/**
 * Catálogos do hotel: a casa, quem trabalha nela e quanto custa.
 *
 * Uma chamada só, porque é isso que o backend vai entregar: seis listas pequenas e estáveis que
 * toda tela precisa antes de mostrar qualquer coisa. Seis requisições para montar um cabeçalho
 * seria seis oportunidades de a tela abrir pela metade.
 */

import type { Pet, Tutor } from '@/features/clinico/data/types'

import type { TemporadaSazonal } from '../fixtures'
import { simularChamada } from '../mock-runtime'
import { getDataset } from '../store'
import type {
  Acomodacao,
  Bloco,
  Comprovante,
  Cuidador,
  Exigencia,
  Hotel,
  Servico,
  Tarifa,
  Temporada,
} from '../types'

export type CatalogosDoHotel = {
  hotel: Hotel
  blocos: Bloco[]
  acomodacoes: Acomodacao[]
  tarifas: Tarifa[]
  temporadas: Temporada[]
  /** As temporadas como foram cadastradas, para a tela de configuração. Ver `SeedResult`. */
  temporadasSazonais: TemporadaSazonal[]
  servicos: Servico[]
  exigencias: Exigencia[]
  cuidadores: Cuidador[]
  /**
   * Os comprovantes da casa inteira.
   *
   * Vêm com os catálogos e não por reserva porque a carteira é do **animal**, não da estadia: o
   * mesmo comprovante responde pela reserva de julho e pela de dezembro, e buscá-lo uma vez por
   * reserva faria a lista da véspera disparar vinte chamadas para reler os mesmos papéis.
   */
  comprovantes: Comprovante[]
  pets: Pet[]
  tutores: Tutor[]
}

export const catalogoRepository = {
  carregar(): Promise<CatalogosDoHotel> {
    return simularChamada('catalogo.carregar', () => {
      const dataset = getDataset()

      return {
        hotel: dataset.hotel,
        blocos: [...dataset.blocos].sort((um, outro) => um.ordem - outro.ordem),
        acomodacoes: [...dataset.acomodacoes],
        tarifas: [...dataset.tarifas],
        temporadas: [...dataset.temporadas],
        temporadasSazonais: [...dataset.temporadasSazonais],
        servicos: dataset.servicos.filter((servico) => servico.ativo),
        exigencias: [...dataset.exigencias],
        cuidadores: dataset.cuidadores.filter((cuidador) => cuidador.ativo),
        comprovantes: [...dataset.comprovantes],
        pets: [...dataset.pets],
        tutores: [...dataset.tutores],
      }
    })
  },

  /** Os casos plantados, para o painel de desenvolvimento. Não passa pelo envelope de latência. */
  casos() {
    return getDataset().casos
  },
}
