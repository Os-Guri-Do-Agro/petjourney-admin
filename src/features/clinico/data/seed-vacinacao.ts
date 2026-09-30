/**
 * O cenário da carteirinha conectada — vacina aplicada na clínica aparecendo no app.
 *
 * Plantado na família da **Fátima**, a responsável da demonstração do app
 * (`seed-responsavel.ts`), para que o portal e o celular contem a mesma história
 * (`npm run contrato:demo`):
 *
 * - **Biscoito**, filhote de onze semanas. Tomou a primeira V10 no pet shop onde foi comprado —
 *   dose **externa, com comprovante**, sem lote. A giárdia, o criador disse que deu: externa
 *   **só por relato**. A segunda V10 vence hoje, e a antirrábica ainda não cabe — ele faz doze
 *   semanas daqui a quatro dias. É o filhote no meio do protocolo, com a sequência inteira para
 *   mostrar.
 * - **Pérola** ganha a antirrábica **atrasada**: aplicada aqui há pouco mais de um ano, passou da
 *   data e da carência. A consulta dela é hoje — a pendência que a clínica resolve na mesma
 *   visita, e que some dos dois lados ao mesmo tempo.
 *
 * As datas andam com o relógio, como no resto do dataset: filhote de data fixa envelhece na
 * semana seguinte e deixa de ser filhote no meio da demonstração.
 */

import { addDays } from '../domain/clinic-time'
import { proximaDose } from '../domain/vacinacao'

import { vacinasFixture } from './fixtures/vacinas'
import type { AplicacaoVacina, ISODate, ISODateTime, Pet, TimelineEvent } from './types'

export const PET_EM_PROTOCOLO = 'pet-biscoito'

/** Onze semanas e três dias: passou das seis da V10, falta pouco para as doze da antirrábica. */
const IDADE_DO_BISCOITO_EM_DIAS = 80

export function petsDaVacinacao(hoje: ISODate): Pet[] {
  return [
    {
      id: PET_EM_PROTOCOLO,
      nome: 'Biscoito',
      especie: 'canina',
      raca: 'SRD',
      sexo: 'macho',
      nascimento: addDays(hoje, -IDADE_DO_BISCOITO_EM_DIAS),
      castrado: false,
      porte: 'medio',
      pesoKg: 5.8,
      microchip: '',
      pelagem: 'Preto com meias brancas',
      tutorId: 'tutor-fatima',
      iniciais: 'BI',
      fotoUrl: '/demo/pacientes/biscoito.jpg',
      alertas: [],
    },
  ]
}

function vacina(id: string) {
  return vacinasFixture.find((item) => item.id === id)!
}

export function aplicacoesDaVacinacao(
  hoje: ISODate,
  iso: (data: ISODate, minutos: number) => ISODateTime,
): AplicacaoVacina[] {
  const v10 = vacina('vac-v10')
  const giardia = vacina('vac-giardia')
  const antirrabica = vacina('vac-antirrabica-canina')

  /* A V10 do pet shop: 28 dias atrás, para a segunda cair exatamente hoje. */
  const v10NoPetShop = addDays(hoje, -28)
  /* A giárdia do criador: já com oito semanas, que é a idade mínima dela. */
  const giardiaDoCriador = addDays(hoje, -20)
  /* A antirrábica da Pérola: um ano e dezesseis dias — passou da data e da carência de três. */
  const antirrabicaDaPerola = addDays(hoje, -381)
  /* A Fátima trouxe a carteirinha do pet shop dois dias atrás, quando veio conhecer a clínica. */
  const registradaEm = iso(addDays(hoje, -2), 17 * 60 + 10)

  return [
    {
      id: 'aplic-biscoito-v10-1',
      petId: PET_EM_PROTOCOLO,
      vacinaId: v10.id,
      origem: 'externa',
      professionalId: '',
      aplicadaEm: iso(v10NoPetShop, 11 * 60),
      lote: null,
      validadeLote: null,
      dose: 1,
      dosesNaSerie: v10.dosesNaSerie,
      via: 'subcutanea',
      proximaDoseEm: proximaDose(v10, 1, v10NoPetShop, v10.dosesNaSerie),
      agendamentoDaProximaId: null,
      encounterId: null,
      externa: {
        local: 'Pet Shop Amigo Fiel',
        aplicador: 'Dr. Rogério Lins',
        procedencia: 'comprovante',
        registradaPor: 'prof-ana',
        registradaEm,
      },
      observacao: 'Carteirinha do pet shop conferida; sem etiqueta de lote.',
    },
    {
      id: 'aplic-biscoito-giardia-1',
      petId: PET_EM_PROTOCOLO,
      vacinaId: giardia.id,
      origem: 'externa',
      professionalId: '',
      aplicadaEm: iso(giardiaDoCriador, 9 * 60),
      lote: null,
      validadeLote: null,
      dose: 1,
      dosesNaSerie: giardia.dosesNaSerie,
      via: null,
      proximaDoseEm: proximaDose(giardia, 1, giardiaDoCriador, giardia.dosesNaSerie),
      agendamentoDaProximaId: null,
      encounterId: null,
      externa: {
        local: 'Canil de origem',
        aplicador: '',
        procedencia: 'relato',
        registradaPor: 'prof-ana',
        registradaEm,
      },
      observacao: 'O criador disse que deu; não entregou comprovante.',
    },
    {
      id: 'aplic-perola-antirrabica',
      petId: 'pet-perola',
      vacinaId: antirrabica.id,
      origem: 'clinica',
      professionalId: 'prof-helena',
      aplicadaEm: iso(antirrabicaDaPerola, 15 * 60 + 50),
      /* De antes do controle de estoque: o código é o que está na carteira, o estoque não o tem. */
      lote: 'RAB-2408',
      validadeLote: addDays(antirrabicaDaPerola, 210),
      dose: 1,
      dosesNaSerie: antirrabica.dosesNaSerie,
      via: 'subcutanea',
      proximaDoseEm: proximaDose(antirrabica, 1, antirrabicaDaPerola, antirrabica.dosesNaSerie),
      agendamentoDaProximaId: null,
      encounterId: null,
      externa: null,
      observacao: '',
    },
  ]
}

/**
 * As doses de fora na linha do tempo do paciente.
 *
 * É o que o repositório faz ao registrar uma dose externa pela tela (`registrarExterna`), repetido
 * aqui para as que o cenário planta. Sem isso, o histórico do Biscoito — que ainda não teve
 * consulta nenhuma — dizia que não havia nada, com duas vacinas no registro.
 */
export function eventosDaVacinacao(aplicacoes: AplicacaoVacina[]): TimelineEvent[] {
  return aplicacoes
    .filter((aplicacao) => aplicacao.externa !== null)
    .map((aplicacao) => ({
      id: `tl-vac-${aplicacao.id}`,
      petId: aplicacao.petId,
      kind: 'vacina' as const,
      em: aplicacao.aplicadaEm,
      titulo: vacina(aplicacao.vacinaId).nome,
      resumo: `${aplicacao.externa!.local} · dose ${aplicacao.dose}/${aplicacao.dosesNaSerie} · sem lote`,
      encounterId: null,
      appointmentId: null,
    }))
}
