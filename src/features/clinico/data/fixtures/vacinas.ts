import type { Vacina } from '../types'

/**
 * Catálogo de vacinas da clínica.
 *
 * Os intervalos são os de rotina no Brasil. Os pontos que o catálogo precisa acertar para o
 * recall e o protocolo funcionarem:
 *
 * - **Série inicial e reforço são coisas diferentes.** Filhote toma três doses de V10 com 21 a
 *   30 dias entre elas; depois passa a uma por ano. Um catálogo que só guardasse "anual"
 *   perderia justamente as duas visitas mais próximas — que são as que trazem o cliente de
 *   volta no mês seguinte.
 * - **Filhote e adulto sem histórico não fazem a mesma série.** O anticorpo que o filhote
 *   recebe da mãe anula as primeiras doses, e é por isso que ele precisa de três; o adulto que
 *   chega sem carteira não tem esse anticorpo no caminho e fecha com duas.
 * - **Idade mínima é por vacina.** A V10 começa com 6 semanas; a antirrábica, com 12. Antes da
 *   idade, a dose não está atrasada — ainda não cabe.
 * - **Obrigatória muda a insistência.** Antirrábica é exigência legal e de viagem; giárdia é
 *   opcional. Cobrar as duas com o mesmo tom faz a clínica parecer insistente no lugar errado.
 * - **O piso de estoque é por vacina.** Quem define o número é o giro: antirrábica sai toda
 *   semana e precisa de fôlego, FeLV sai uma vez por mês e um piso alto só produziria frasco
 *   vencendo na geladeira. Um piso único da clínica erraria os dois lados ao mesmo tempo.
 */
export const vacinasFixture: Vacina[] = [
  {
    id: 'vac-v10',
    nome: 'V10 (múltipla canina)',
    fabricante: 'Zoetis',
    especies: ['canina'],
    dosesNaSerie: 3,
    dosesAdultoSemHistorico: 2,
    idadeMinimaDias: 42,
    essencial: true,
    vias: ['subcutanea'],
    intervaloReforcoDias: 365,
    obrigatoria: false,
    estoqueMinimo: 10,
  },
  {
    id: 'vac-antirrabica-canina',
    nome: 'Antirrábica',
    fabricante: 'Boehringer',
    especies: ['canina', 'felina'],
    dosesNaSerie: 1,
    dosesAdultoSemHistorico: 1,
    idadeMinimaDias: 84,
    essencial: true,
    vias: ['subcutanea', 'intramuscular'],
    intervaloReforcoDias: 365,
    /* Exigência legal e de trânsito: sem ela em dia, o animal não viaja. */
    obrigatoria: true,
    estoqueMinimo: 12,
  },
  {
    id: 'vac-gripe-canina',
    nome: 'Traqueobronquite (gripe canina)',
    fabricante: 'MSD',
    especies: ['canina'],
    dosesNaSerie: 2,
    dosesAdultoSemHistorico: 2,
    idadeMinimaDias: 56,
    essencial: false,
    /* A intranasal é a apresentação que mais sai; a injetável fica para o cão que não deixa. */
    vias: ['intranasal', 'subcutanea'],
    intervaloReforcoDias: 365,
    obrigatoria: false,
    estoqueMinimo: 8,
  },
  {
    id: 'vac-giardia',
    nome: 'Giárdia',
    fabricante: 'Zoetis',
    especies: ['canina'],
    dosesNaSerie: 2,
    dosesAdultoSemHistorico: 2,
    idadeMinimaDias: 56,
    essencial: false,
    vias: ['subcutanea'],
    intervaloReforcoDias: 365,
    obrigatoria: false,
    estoqueMinimo: 6,
  },
  {
    id: 'vac-v4-felina',
    nome: 'V4 (quádrupla felina)',
    fabricante: 'Zoetis',
    especies: ['felina'],
    dosesNaSerie: 3,
    dosesAdultoSemHistorico: 2,
    idadeMinimaDias: 56,
    essencial: true,
    vias: ['subcutanea'],
    intervaloReforcoDias: 365,
    obrigatoria: false,
    estoqueMinimo: 6,
  },
  {
    id: 'vac-felv',
    nome: 'FeLV (leucemia felina)',
    fabricante: 'Boehringer',
    especies: ['felina'],
    dosesNaSerie: 2,
    dosesAdultoSemHistorico: 2,
    idadeMinimaDias: 56,
    /* Depende de o gato sair de casa e do teste negativo antes — decisão de consulta. */
    essencial: false,
    vias: ['subcutanea'],
    intervaloReforcoDias: 365,
    obrigatoria: false,
    estoqueMinimo: 4,
  },
]

/** Dias entre doses da série inicial. Fora disso, o intervalo é o de reforço da vacina. */
export const INTERVALO_ENTRE_DOSES_DA_SERIE = 28
