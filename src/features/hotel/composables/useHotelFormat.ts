/**
 * Formatação e tradução do módulo hotel.
 *
 * Aqui mora a única camada autorizada a transformar `kind` em frase. Situação de exigência, tipo
 * de acomodação, motivo de cancelamento, tipo de ocorrência e status de reserva viajam como
 * identificador o caminho inteiro — texto pronto no payload significaria um hotel em português
 * dentro de uma interface em espanhol.
 *
 * Datas e números passam pelo `Intl` com a tag do projeto, nunca com o código cru do idioma: `sr`
 * sozinho formata em cirílico e `ar` pode sair com dígitos ٠١٢.
 */

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from '@/i18n/locales'

import { HOTEL_UTC_OFFSET } from '../data/fixtures'
import type {
  AcomodacaoInativaMotivo,
  AcomodacaoKind,
  Adaptacao,
  AutorizacaoKind,
  ExigenciaKind,
  GravidadeDaOcorrencia,
  ISODate,
  ISODateTime,
  MotivoDeCancelamento,
  OcorrenciaKind,
  PetPorte,
  PetSpecies,
  RecursoDaAcomodacao,
  RegistroKind,
  ReservaOrigem,
  ReservaStatus,
  ServicoKind,
  SituacaoDaExigencia,
  SituacaoDaTarefa,
  TarefaKind,
  TurnoKind,
  ViaDeMedicacao,
} from '../data/types'
import { createClinicClock, dataDe, horaDe } from '../domain/hotel-time'

const clock = createClinicClock(HOTEL_UTC_OFFSET)

/** Tom na escada do portal: neutro, atenção, risco. Usado por selo, cartão e número. */
export type Tom = 'neutro' | 'atencao' | 'risco' | 'acento'

/**
 * A situação de admissão, no tom certo.
 *
 * `vence-durante` é atenção e não risco de propósito: o animal **pode** entrar. Pintá-lo de
 * vermelho ao lado do que de fato bloqueia ensinaria a recepção a ignorar o vermelho.
 */
export function tomDaAdmissao(situacao: SituacaoDaExigencia): Tom {
  if (situacao === 'vencido' || situacao === 'ausente') {
    return 'risco'
  }

  return situacao === 'vence-durante' ? 'atencao' : 'neutro'
}

export function tomDaSituacaoDaTarefa(situacao: SituacaoDaTarefa): Tom {
  if (situacao === 'atrasada') {
    return 'risco'
  }

  if (situacao === 'na-janela') {
    return 'atencao'
  }

  return 'neutro'
}

export function useHotelFormat() {
  const { t, locale } = useI18n()

  const localeIntl = computed(
    () => INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE],
  )

  // ------------------------------------------------------------------ tempo

  function hora(iso: ISODateTime): string {
    return horaDe(iso)
  }

  function data(iso: ISODate): string {
    return new Intl.DateTimeFormat(localeIntl.value, {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(`${iso}T12:00:00Z`))
  }

  /**
   * Um `MM-DD` sem ano, na ordem do idioma: `20/12` em pt, `12/20` em en.
   *
   * Temporada é recorrente — "todo ano, de 20 de dezembro a 5 de janeiro" —, e carimbar um ano
   * nela faria a mesma faixa parecer três faixas diferentes na tela de configuração. O ano usado
   * aqui é descartável: só existe para o `Intl` ter uma data para ordenar.
   */
  function mesDia(valor: string): string {
    return data(`2001-${valor}` as ISODate)
  }

  function dataLonga(iso: ISODate): string {
    return new Intl.DateTimeFormat(localeIntl.value, {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${iso}T12:00:00Z`))
  }

  /** Data com ano, para o que circula fora da tela — contrato, relatório de estadia. */
  function dataPorExtenso(iso: ISODate): string {
    return new Intl.DateTimeFormat(localeIntl.value, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${iso}T12:00:00Z`))
  }

  /** Data e hora de um instante: `14/06 · 16:30`. */
  function quando(iso: ISODateTime): string {
    return `${data(dataDe(iso))} · ${horaDe(iso)}`
  }

  /**
   * O período de uma estadia, como o balcão o diz em voz alta.
   *
   * Com as horas, sempre: elas decidem a meia diária e a ordem do dia, e um período sem hora
   * devolve ao cliente a pergunta que ele acabou de fazer.
   */
  function periodo(inicio: ISODateTime, fim: ISODateTime): string {
    return `${quando(inicio)} → ${quando(fim)}`
  }

  function duracao(minutos: number): string {
    const total = Math.abs(minutos)
    const horas = Math.floor(total / 60)
    const resto = total % 60

    if (horas === 0) {
      return t('hotel.formato.minutos', { valor: resto })
    }

    return resto === 0
      ? t('hotel.formato.horas', { valor: horas })
      : t('hotel.formato.horasMinutos', { horas, minutos: resto })
  }

  /** Distância até agora, em linguagem de plantão: "há 12 min", "em 40 min". */
  function relativo(iso: ISODateTime): string {
    const minutos = Math.round((Date.parse(iso) - Date.parse(clock.nowIso())) / 60_000)

    if (Math.abs(minutos) < 1) {
      return t('hotel.formato.agora')
    }

    const texto =
      Math.abs(minutos) >= 48 * 60
        ? (() => {
            const dias = Math.round(Math.abs(minutos) / (24 * 60))

            return t('hotel.formato.dias', { valor: dias }, dias)
          })()
        : duracao(minutos)

    return minutos < 0
      ? t('hotel.formato.haTempo', { valor: texto })
      : t('hotel.formato.emTempo', { valor: texto })
  }

  /** "há 21 dias", para o que envelhece calado — a acomodação parada, a espera na fila. */
  function haDias(dias: number): string {
    return t('hotel.formato.haTempo', { valor: t('hotel.formato.dias', { valor: dias }, dias) })
  }

  // ------------------------------------------------------------------ números

  function numero(valor: number, casas = 0): string {
    return new Intl.NumberFormat(localeIntl.value, {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    }).format(valor)
  }

  /**
   * Dinheiro, a partir de **centavos**.
   *
   * A entrada é inteira porque é assim que o valor é guardado. Receber reais com casa decimal aqui
   * devolveria o erro de ponto flutuante que guardar em centavos existe para evitar — e o total da
   * tela deixaria de bater com o da nota por alguns centavos, que é o tipo de diferença que faz o
   * cliente parar de confiar na conta.
   *
   * A moeda é do país do hotel e não do idioma de quem lê: a mesma diária vale os mesmos reais
   * para quem abre a tela em inglês.
   */
  function moeda(centavos: number): string {
    return new Intl.NumberFormat(localeIntl.value, {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 2,
    }).format(centavos / 100)
  }

  function percentual(valor: number): string {
    return new Intl.NumberFormat(localeIntl.value, {
      style: 'percent',
      maximumFractionDigits: 0,
    }).format(valor)
  }

  function peso(valor: number | null): string {
    return valor === null
      ? t('hotel.formato.semvalor')
      : `${numero(valor, valor >= 100 ? 0 : 1)} kg`
  }

  /** Variação de peso com sinal: o `+` importa tanto quanto o `−`. */
  function variacao(valor: number | null): string {
    if (valor === null) {
      return t('hotel.formato.semvalor')
    }

    const formatado = new Intl.NumberFormat(localeIntl.value, {
      style: 'percent',
      maximumFractionDigits: 1,
      signDisplay: 'exceptZero',
    }).format(valor)

    return formatado
  }

  // ------------------------------------------------------- traduções por `kind`

  const porKind =
    <T extends string>(prefixo: string) =>
    (valor: T) =>
      t(`hotel.${prefixo}.${valor}`)

  return {
    hora,
    data,
    mesDia,
    dataLonga,
    dataPorExtenso,
    quando,
    periodo,
    duracao,
    relativo,
    haDias,
    numero,
    moeda,
    percentual,
    peso,
    variacao,

    acomodacaoKind: porKind<AcomodacaoKind>('acomodacaoKind'),
    motivoInativa: porKind<AcomodacaoInativaMotivo>('motivoInativa'),
    recurso: porKind<RecursoDaAcomodacao>('recurso'),
    porte: porKind<PetPorte>('porte'),
    especie: porKind<PetSpecies>('especie'),
    statusDaReserva: porKind<ReservaStatus>('reservaStatus'),
    origem: porKind<ReservaOrigem>('origem'),
    motivoCancelamento: porKind<MotivoDeCancelamento>('motivoCancelamento'),
    exigencia: porKind<ExigenciaKind>('exigencia'),
    situacaoDaExigencia: porKind<SituacaoDaExigencia>('situacaoExigencia'),
    servico: porKind<ServicoKind>('servico'),
    tarefaKind: porKind<TarefaKind>('tarefaKind'),
    situacaoDaTarefa: porKind<SituacaoDaTarefa>('situacaoTarefa'),
    registroKind: porKind<RegistroKind>('registroKind'),
    ocorrenciaKind: porKind<OcorrenciaKind>('ocorrenciaKind'),
    gravidade: porKind<GravidadeDaOcorrencia>('gravidade'),
    adaptacao: porKind<Adaptacao>('adaptacao'),
    autorizacao: porKind<AutorizacaoKind>('autorizacao'),
    via: porKind<ViaDeMedicacao>('via'),
    turno: porKind<TurnoKind>('turno'),
  }
}
