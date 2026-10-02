/**
 * Vacinação: o que já foi aplicado e o que está para vencer.
 *
 * Este arquivo carrega o **motor de recall** da clínica, que é o que transforma vacinação de
 * evento isolado em recorrência. A pergunta que ele responde não é "o que este pet tomou" — é
 * "quem eu preciso chamar esta semana", e é essa a que paga a conta.
 *
 * Duas regras que a conta precisa acertar:
 *
 * 1. **Série inicial não é reforço.** Filhote de V10 tem três doses com ~28 dias entre elas;
 *    depois vira anual. Tratar tudo como anual perderia as duas visitas mais próximas, que são
 *    justamente as que trazem o cliente de volta no mês seguinte.
 * 2. **Vencido e a vencer não são o mesmo aviso.** Um pede ligação hoje, o outro entra na fila
 *    da semana. Misturá-los faz a lista inteira parecer urgente e nenhuma parte dela ser lida.
 * 3. **Atrasada é a mesma coisa dos dois lados.** A clínica e o app do responsável marcam atraso
 *    no mesmo dia, pela mesma carência — ver `CARENCIA_DE_ATRASO_EM_DIAS`.
 */

import { INTERVALO_ENTRE_DOSES_DA_SERIE } from '../data/fixtures/vacinas'
import type {
  AplicacaoVacina,
  ISODate,
  ReforcoPendente,
  SituacaoDoReforco,
  Vacina,
} from '../data/types'

import { addDays, diffDays } from './clinic-time'

/** Dias antes do vencimento em que o reforço já entra na lista de chamada. */
export const JANELA_DE_AVISO_EM_DIAS = 30

/**
 * Dias depois da data prevista em que a dose passa a ser **atrasada**.
 *
 * O número não é daqui: é o `AJUSTES.vacinaAtrasoDias` do motor de notificação da API, que o app
 * já espelha em `constants/vacina-atraso.ts` (`VACINA_ATRASO_DIAS`). É ele que solta o aviso
 * `VACINA_ATRASADA` no celular do responsável.
 *
 * Até aqui a clínica contava atraso a partir do primeiro dia vencido. Posta ao lado da carteirinha
 * do app — que é o que esta etapa demonstra —, a tela da clínica dizia "atrasada" por três dias
 * enquanto o celular ainda dizia "próxima dose". Dois relógios para a mesma regra, lado a lado, é
 * o defeito que a demonstração inteira existe para não ter. Entre a data e a carência a dose
 * continua **a vencer**, que é o que ela é.
 *
 * Muda lá, muda aqui — e no app.
 */
export const CARENCIA_DE_ATRASO_EM_DIAS = 3

/**
 * Quando é a próxima dose desta vacina, para este paciente.
 *
 * Dentro da série inicial o intervalo é curto e fixo; fechada a série, passa a valer o
 * intervalo de reforço da vacina. `dosesNaSerie` vem da aplicação quando existe — é o tamanho da
 * série **deste** paciente, que depende da idade em que ela começou.
 */
export function proximaDose(
  vacina: Vacina,
  doseAplicada: number,
  aplicadaEm: ISODate,
  dosesNaSerie: number = vacina.dosesNaSerie,
): ISODate {
  const dentroDaSerie = doseAplicada < dosesNaSerie

  return addDays(
    aplicadaEm,
    dentroDaSerie ? INTERVALO_ENTRE_DOSES_DA_SERIE : vacina.intervaloReforcoDias,
  )
}

/** `true` quando a dose já passou da carência — o mesmo `vacinaEstaAtrasada` do app. */
export function doseAtrasada(diasParaVencer: number): boolean {
  return diasParaVencer <= -CARENCIA_DE_ATRASO_EM_DIAS
}

export function situacaoDoReforco(
  proximaEm: ISODate,
  hoje: ISODate,
  serieIncompleta: boolean,
): SituacaoDoReforco {
  const dias = diffDays(hoje, proximaEm)

  if (doseAtrasada(dias)) {
    return 'vencido'
  }

  /*
   * Série incompleta vem **antes** de "próximo" mesmo quando a data ainda está longe: um
   * filhote que tomou a primeira de três e sumiu é um caso diferente de um adulto cujo anual
   * vence em três semanas, e a clínica trata os dois de forma diferente.
   */
  if (serieIncompleta) {
    return 'serie-incompleta'
  }

  return dias <= JANELA_DE_AVISO_EM_DIAS ? 'proximo' : 'em-dia'
}

/**
 * O que cada paciente deve, por vacina.
 *
 * Considera só a **última** aplicação de cada vacina: é ela que define o vencimento. Aplicações
 * anteriores continuam no histórico, mas não geram cobrança própria — senão a lista repetiria o
 * mesmo paciente uma vez por dose já tomada.
 */
export function reforcosDoPaciente(
  aplicacoes: AplicacaoVacina[],
  vacinas: Vacina[],
  hoje: ISODate,
): ReforcoPendente[] {
  const ultimaPorVacina = new Map<string, AplicacaoVacina>()

  for (const aplicacao of aplicacoes) {
    const atual = ultimaPorVacina.get(aplicacao.vacinaId)

    if (!atual || aplicacao.aplicadaEm > atual.aplicadaEm) {
      ultimaPorVacina.set(aplicacao.vacinaId, aplicacao)
    }
  }

  const pendentes: ReforcoPendente[] = []

  for (const [vacinaId, aplicacao] of ultimaPorVacina) {
    const vacina = vacinas.find((item) => item.id === vacinaId)

    if (!vacina) {
      continue
    }

    const serieIncompleta = aplicacao.dose < aplicacao.dosesNaSerie

    pendentes.push({
      petId: aplicacao.petId,
      vacinaId,
      ultimaEm: aplicacao.aplicadaEm,
      proximaDoseEm: aplicacao.proximaDoseEm,
      situacao: situacaoDoReforco(aplicacao.proximaDoseEm, hoje, serieIncompleta),
      diasParaVencer: diffDays(hoje, aplicacao.proximaDoseEm),
      doseSeguinte: serieIncompleta ? aplicacao.dose + 1 : null,
    })
  }

  /* Mais atrasado primeiro: a lista é de chamada, e chamada se faz do pior para o melhor. */
  return pendentes.sort((a, b) => a.diasParaVencer - b.diasParaVencer)
}

/**
 * A lista de recall da clínica: quem chamar.
 *
 * Fora `em-dia`, porque quem está em dia não recebe ligação — e uma lista que inclui todo mundo
 * é uma lista que ninguém abre.
 */
export function listaDeChamada(pendentes: ReforcoPendente[]): ReforcoPendente[] {
  return pendentes.filter((item) => item.situacao !== 'em-dia')
}

/** Vacinas do catálogo aplicáveis à espécie do paciente. Gato não toma V10. */
export function vacinasDaEspecie(vacinas: Vacina[], especie: string): Vacina[] {
  return vacinas.filter((vacina) => vacina.especies.includes(especie as never))
}
