/**
 * O cenário do lado do responsável — a mesma história nos dois protótipos.
 *
 * O app do responsável (outro repositório) monta o seu mock a partir do contrato, e uma
 * demonstração precisa passar do portal para o celular sem trocar de história. Este arquivo
 * planta, no dataset do portal, exatamente o que `docs/clinico/09-*.md` descreve na seção do
 * cenário. Mudou aqui, muda lá.
 *
 * **Fátima Gonçalves**, três pets:
 *
 * - **Pérola** — consulta hoje, marcada pelo app e confirmada pelo app, pré-consulta aberta e
 *   sem resposta; meloxicam de uso contínuo desde a consulta de três meses atrás; V4 felina com
 *   reforço em 25 dias. (A perda de peso e o diário são do `seed-resumo.ts`.)
 * - **Pipoca** — internada, com boletins (em `seed-internacao.ts`).
 * - **Brunilda** — faltou a um retorno há dez dias sem justificar, e está na fila de espera
 *   com uma oferta aberta, vencendo em 25 minutos.
 *
 * E o que o portal precisa para os outros responsáveis conversarem com o app: o consentimento
 * do diário de cada um, e uma falta justificada pelo próprio responsável, pelo app.
 */

import { addDays, weekdayOf } from '../domain/clinic-time'

import type {
  AplicacaoVacina,
  ConsentimentoDoResponsavel,
  ISODate,
  ISODateTime,
  JustificativaDeFalta,
  Tutor,
  WaitlistEntry,
} from './types'

export const RESPONSAVEL_DA_DEMONSTRACAO = 'tutor-fatima'
export const PET_DA_FILA = 'pet-bruna'

/**
 * Quem liberou o diário para a clínica.
 *
 * Quase todos, porque é o caminho que a clínica quer demonstrar — e um, de propósito, não: o
 * Sérgio. O resumo dos pets dele precisa mostrar o estado "o responsável não liberou" sem
 * parecer quebrado, e esse estado só é revisado se existir no dataset.
 */
export function consentimentosDosResponsaveis(
  tutores: Tutor[],
  liberadoEm: ISODateTime,
): ConsentimentoDoResponsavel[] {
  return tutores.map((tutor) => {
    const liberou = tutor.id !== 'tutor-sergio'

    return {
      tutorId: tutor.id,
      diarioCompleto: liberou,
      peso: liberou,
      /* A nota é o que o responsável escreve para si. Ninguém liberou; o resumo vive sem ela. */
      notas: false,
      atualizadoEm: liberou ? liberadoEm : null,
    }
  })
}

/**
 * A V4 da Pérola, aplicada há 340 dias: o reforço vence em 25 e cai em "próximo".
 *
 * O lote é de uma remessa que já saiu do estoque — a dose de antes do controle de estoque, que
 * o dataset já prevê. Tirar de um lote da geladeira mexeria no saldo que a aba de estoque
 * demonstra.
 */
export function vacinaDaPerola(
  hoje: ISODate,
  iso: (data: ISODate, minutos: number) => ISODateTime,
): AplicacaoVacina {
  const aplicadaEm = addDays(hoje, -340)

  return {
    id: 'aplic-perola-v4',
    petId: 'pet-perola',
    vacinaId: 'vac-v4-felina',
    professionalId: 'prof-helena',
    aplicadaEm: iso(aplicadaEm, 15 * 60 + 40),
    lote: 'V4F-2410',
    validadeLote: addDays(aplicadaEm, 190),
    dose: 3,
    via: 'subcutanea',
    proximaDoseEm: addDays(aplicadaEm, 365),
    observacao: 'Reforço anual.',
  }
}

/**
 * O dia útil mais próximo antes (ou em) `data`: a clínica fecha domingo, e falta em domingo não
 * existe.
 */
function diaUtilAte(data: ISODate): ISODate {
  return weekdayOf(data) === 0 ? addDays(data, -1) : data
}

/** O próximo dia depois de `data` em que a clínica abre. */
export function proximoDiaUtil(data: ISODate): ISODate {
  const seguinte = addDays(data, 1)

  return weekdayOf(seguinte) === 0 ? addDays(seguinte, 1) : seguinte
}

/** O retorno a que a Brunilda faltou. Sem justificativa: é o que o app vai pedir. */
export function faltaDaBrunilda(hoje: ISODate) {
  return {
    id: 'apt-falta-brunilda',
    petId: PET_DA_FILA,
    professionalId: 'prof-helena',
    typeId: 'tipo-retorno',
    data: diaUtilAte(addDays(hoje, -10)),
    inicio: '14:00',
  }
}

/** Tardes de segunda a sexta, depois das duas: o que a Fátima disse que serve. */
export const JANELAS_DA_BRUNILDA: WaitlistEntry['janelas'] = ([1, 2, 3, 4, 5] as const).map(
  (weekday) => ({ weekday, inicio: '14:00', fim: '18:00' }),
)

/**
 * A Brunilda na fila, com a oferta aberta.
 *
 * Qualquer profissional, nas `JANELAS_DA_BRUNILDA`. A vaga oferecida é escolhida no `seed.ts`
 * entre os horários de fato livres dessas janelas — uma oferta para um horário ocupado faria o
 * aceite da demonstração cair em "vaga já preenchida".
 */
export function filaDaBrunilda(
  vaga: { inicio: ISODateTime; professionalId: string },
  criadoEm: ISODateTime,
  ofertaExpiraEm: ISODateTime,
): WaitlistEntry {
  return {
    id: 'fila-brunilda',
    petId: PET_DA_FILA,
    tutorId: RESPONSAVEL_DA_DEMONSTRACAO,
    typeId: 'tipo-consulta',
    professionalId: null,
    prioridade: 'normal',
    janelas: JANELAS_DA_BRUNILDA.map((janela) => ({ ...janela })),
    status: 'ofertado',
    criadoEm,
    ofertaExpiraEm,
    ofertaSlotInicio: vaga.inicio,
    ofertaProfessionalId: vaga.professionalId,
    observacao: 'Casco com uma mancha mais clara. Pode ser à tarde, depois das duas.',
    appointmentId: null,
  }
}

/**
 * A falta que o próprio responsável justificou, pelo app.
 *
 * Sem profissional: ninguém da clínica registrou. É a linha do painel de faltas que ninguém
 * precisou ligar para entender.
 */
export function justificativaPeloApp(registradaEm: ISODateTime): JustificativaDeFalta {
  return {
    motivo: 'imprevisto',
    canal: 'app',
    observacao: 'O carro quebrou no caminho. Posso remarcar para a semana que vem?',
    professionalId: '',
    registradaEm,
  }
}
