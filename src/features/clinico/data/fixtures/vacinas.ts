import type { Vacina } from '../types'

/**
 * Catálogo de vacinas da clínica.
 *
 * Os intervalos são os de rotina no Brasil. Dois pontos que o catálogo precisa acertar para o
 * recall funcionar:
 *
 * - **Série inicial e reforço são coisas diferentes.** Filhote toma três doses de V10 com 21 a
 *   30 dias entre elas; depois passa a uma por ano. Um catálogo que só guardasse "anual"
 *   perderia justamente as duas visitas mais próximas — que são as que trazem o cliente de
 *   volta no mês seguinte.
 * - **Obrigatória muda a insistência.** Antirrábica é exigência legal e de viagem; giárdia é
 *   opcional. Cobrar as duas com o mesmo tom faz a clínica parecer insistente no lugar errado.
 */
export const vacinasFixture: Vacina[] = [
  {
    id: 'vac-v10',
    nome: 'V10 (múltipla canina)',
    fabricante: 'Zoetis',
    especies: ['canina'],
    dosesNaSerie: 3,
    intervaloReforcoDias: 365,
    obrigatoria: false,
  },
  {
    id: 'vac-antirrabica-canina',
    nome: 'Antirrábica',
    fabricante: 'Boehringer',
    especies: ['canina', 'felina'],
    dosesNaSerie: 1,
    intervaloReforcoDias: 365,
    /* Exigência legal e de trânsito: sem ela em dia, o animal não viaja. */
    obrigatoria: true,
  },
  {
    id: 'vac-gripe-canina',
    nome: 'Traqueobronquite (gripe canina)',
    fabricante: 'MSD',
    especies: ['canina'],
    dosesNaSerie: 2,
    intervaloReforcoDias: 365,
    obrigatoria: false,
  },
  {
    id: 'vac-giardia',
    nome: 'Giárdia',
    fabricante: 'Zoetis',
    especies: ['canina'],
    dosesNaSerie: 2,
    intervaloReforcoDias: 365,
    obrigatoria: false,
  },
  {
    id: 'vac-v4-felina',
    nome: 'V4 (quádrupla felina)',
    fabricante: 'Zoetis',
    especies: ['felina'],
    dosesNaSerie: 3,
    intervaloReforcoDias: 365,
    obrigatoria: false,
  },
  {
    id: 'vac-felv',
    nome: 'FeLV (leucemia felina)',
    fabricante: 'Boehringer',
    especies: ['felina'],
    dosesNaSerie: 2,
    intervaloReforcoDias: 365,
    obrigatoria: false,
  },
]

/** Dias entre doses da série inicial. Fora disso, o intervalo é o de reforço da vacina. */
export const INTERVALO_ENTRE_DOSES_DA_SERIE = 28
