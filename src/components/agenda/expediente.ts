/**
 * O expediente do profissional na tela (E3-01, seção 1.4), sem tela: cada dia é "como a clínica",
 * "próprio" (com início e fim) ou "folga". A API guarda só os dias que diferem da clínica, então
 * salvar manda só os próprios e as folgas; o resto volta a seguir a clínica.
 */
import { ORDEM_DA_SEMANA } from '@/components/parceiro/estabelecimento/horario'
import type {
  DiaDoExpediente,
  DiaProprio,
  Expediente,
} from '@/service/parceiro/agenda-config-service'

export type ModoDoDia = 'clinica' | 'proprio' | 'folga'

export type ProblemaDoExpediente =
  | 'ABRE_E_FECHA_OBRIGATORIOS'
  | 'HORA_INVALIDA'
  | 'ABRE_DEPOIS_DE_FECHA'

/** O horário da clínica no dia, quando se sabe: vem do próprio expediente nos dias herdados. */
export type HorarioDaClinica = {
  trabalha: boolean
  inicio: string | null
  fim: string | null
  intervaloInicio: string | null
  intervaloFim: string | null
}

export type LinhaDoExpediente = {
  diaSemana: number
  modo: ModoDoDia
  inicio: string
  fim: string
  /** `null` quando o dia já era do profissional: a leitura não diz como a clínica abre nele. */
  clinica: HorarioDaClinica | null
}

const INICIO = /^([01]\d|2[0-3]):[0-5]\d$/
const FIM = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/

function minutos(hora: string) {
  const [hh, mm] = hora.split(':').map(Number)
  return (hh ?? 0) * 60 + (mm ?? 0)
}

function daClinica(dia: DiaDoExpediente): HorarioDaClinica {
  return {
    trabalha: dia.trabalha,
    inicio: dia.inicio,
    fim: dia.fim,
    intervaloInicio: dia.intervaloInicio,
    intervaloFim: dia.intervaloFim,
  }
}

/** Os 7 dias de segunda a domingo, como a casa lê a semana. */
export function linhasDoExpediente(expediente: Pick<Expediente, 'dias'>): LinhaDoExpediente[] {
  return ORDEM_DA_SEMANA.map((diaSemana) => {
    const dia = expediente.dias.find((item) => item.diaSemana === diaSemana)

    if (!dia || dia.origem === 'ESTABELECIMENTO') {
      return {
        diaSemana,
        modo: 'clinica',
        inicio: dia?.inicio ?? '',
        fim: dia?.fim ?? '',
        clinica: dia ? daClinica(dia) : null,
      }
    }

    return {
      diaSemana,
      modo: dia.trabalha ? 'proprio' : 'folga',
      inicio: dia.inicio ?? '',
      fim: dia.fim ?? '',
      clinica: null,
    }
  })
}

/** O mesmo que a API confere (`EXPEDIENTE_INVALIDO`), para marcar o dia antes de enviar. */
export function problemaNaLinha(linha: LinhaDoExpediente): ProblemaDoExpediente | null {
  if (linha.modo !== 'proprio') return null
  if (!linha.inicio || !linha.fim || linha.inicio.includes('_') || linha.fim.includes('_')) {
    return 'ABRE_E_FECHA_OBRIGATORIOS'
  }
  if (!INICIO.test(linha.inicio) || !FIM.test(linha.fim)) return 'HORA_INVALIDA'
  if (minutos(linha.inicio) >= minutos(linha.fim)) return 'ABRE_DEPOIS_DE_FECHA'

  return null
}

/** Só os dias que diferem: próprio com as horas, folga sem hora. */
export function diasParaSalvar(linhas: readonly LinhaDoExpediente[]): DiaProprio[] {
  return linhas
    .filter((linha) => linha.modo !== 'clinica')
    .sort((a, b) => a.diaSemana - b.diaSemana)
    .map((linha) =>
      linha.modo === 'folga'
        ? { diaSemana: linha.diaSemana, trabalha: false }
        : { diaSemana: linha.diaSemana, trabalha: true, inicio: linha.inicio, fim: linha.fim },
    )
}
