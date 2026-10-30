/**
 * Formatação e tradução do módulo clínico.
 *
 * Aqui mora a única camada autorizada a transformar `kind` em frase. Conflito, motivo de
 * bloqueio, status e alerta viajam como identificador o caminho inteiro — texto pronto no
 * payload significaria agenda em português dentro de uma interface em espanhol.
 */

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { INTL_LOCALE, isLocale, DEFAULT_LOCALE } from '@/i18n/locales'

import { minutesToClock } from '../domain/clinic-time'
import type {
  AlertSeverity,
  AppointmentStatus,
  BlockReason,
  CanalDeContato,
  CancelReason,
  Conflict,
  ISODate,
  ISODateTime,
  Measurement,
  MotivoDeFalta,
  PetAlertKind,
  PetSex,
  PetSpecies,
  RangeStatus,
  ReferenceRange,
  WaitlistPriority,
} from '../data/types'
import { CLINIC_UTC_OFFSET } from '../data/fixtures'
import { createClinicClock } from '../domain/clinic-time'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

/** Parâmetros que representam horário chegam em minutos e viram `HH:mm` antes de traduzir. */
const PARAMS_DE_HORARIO = new Set(['hora', 'abre', 'fecha'])

export function useClinicFormat() {
  const { t, locale } = useI18n()

  /**
   * Tag do `Intl` pelo mapa do projeto, nunca o código cru do idioma: `sr` sozinho formata em
   * cirílico e `ar` pode sair com dígitos ٠١٢. Pelo mesmo motivo números não passam pelo `n()` do
   * vue-i18n, que entrega o código cru ao `Intl`.
   */
  const localeIntl = computed(() => INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE])

  function hora(iso: ISODateTime): string {
    return minutesToClock(clock.minutesOf(iso))
  }

  function intervalo(inicio: ISODateTime, fim: ISODateTime): string {
    return `${hora(inicio)}–${hora(fim)}`
  }

  function dataLonga(data: ISODate): string {
    return new Intl.DateTimeFormat(localeIntl.value, {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${data}T12:00:00Z`))
  }

  /**
   * Data com o ano, sem dia da semana — a forma que documento assinado precisa.
   *
   * `dataLonga` existe para a tela, onde "segunda-feira, 24 de agosto" situa quem está olhando
   * a agenda de hoje. Num atestado, o dia da semana é ruído e a **ausência do ano é defeito**:
   * o papel circula meses depois e precisa dizer sozinho a que 24 de agosto se refere.
   */
  function dataPorExtenso(data: ISODate): string {
    return new Intl.DateTimeFormat(localeIntl.value, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${data}T12:00:00Z`))
  }

  function dataCurta(data: ISODate): string {
    return new Intl.DateTimeFormat(localeIntl.value, {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(`${data}T12:00:00Z`))
  }

  /**
   * `27/10/2027` — a data curta com o ano, para o que cai fora do ano corrente.
   *
   * A carteira de vacina mistura as duas coisas na mesma coluna: a dose de hoje e o reforço do ano
   * que vem. Sem o ano, "27/10" do reforço anual lê como daqui a quatro semanas.
   */
  function dataCurtaComAno(data: ISODate): string {
    return new Intl.DateTimeFormat(localeIntl.value, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${data}T12:00:00Z`))
  }

  /**
   * Nome curto do dia a partir do **índice** (0 = domingo), sem precisar de uma data.
   *
   * A fila trabalha com dias da semana soltos — a janela que o responsável aceita não tem data
   * — e montar um ISO falso só para formatar seria inventar um dia que não existe.
   */
  function diaDaSemanaCurtoPorIndice(weekday: number): string {
    /* 2024-01-07 é um domingo: somar o índice cai no dia certo da mesma semana. */
    const base = new Date(Date.UTC(2024, 0, 7 + weekday, 12))

    return new Intl.DateTimeFormat(localeIntl.value, {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(base)
  }

  /**
   * Mês e ano curtos: `set/26`.
   *
   * O eixo do consumo tem doze colunas numa largura de cartão. "Setembro de 2026" não cabe em
   * nenhuma delas, e só o mês — sem o ano — faria a coluna mais antiga e a mais nova de uma
   * janela que atravessa o réveillon parecerem o mesmo mês.
   *
   * Montado por partes em vez de formatado direto: `month: 'short'` com `year: '2-digit'`
   * devolve `mai. de 26` em português e `May 26` em inglês — a primeira não cabe na coluna e as
   * duas juntas não dão uma régua só. As partes dão o nome do mês no idioma de quem lê, com a
   * barra que o eixo precisa. O ponto abreviativo sai junto: `mai/26`, e não `mai./26`.
   */
  function mesCurto(data: ISODate): string {
    const partes = new Intl.DateTimeFormat(localeIntl.value, {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    }).formatToParts(new Date(`${data}T12:00:00Z`))

    const mes = partes.find((parte) => parte.type === 'month')?.value.replace(/\.$/, '') ?? ''
    const ano = partes.find((parte) => parte.type === 'year')?.value ?? ''

    return `${mes}/${ano}`
  }

  /**
   * `2026-11` → "novembro". Com `comAno`, "novembro de 2026".
   *
   * É o nome que as metas de estoque usam em toda frase — "planejar novembro", "meta de outubro". O
   * `mesCurto` do eixo de gráfico ("nov/26") lê como código de lote no meio de uma frase.
   */
  function mesPorExtenso(mes: string, comAno = false): string {
    return new Intl.DateTimeFormat(localeIntl.value, {
      month: 'long',
      ...(comAno ? { year: 'numeric' as const } : {}),
      timeZone: 'UTC',
    }).format(new Date(`${mes}-15T12:00:00Z`))
  }

  /**
   * "ter., 27/10": dia da semana e data, no formato do idioma. Com o ano só quando não é o
   * corrente. Para coluna de "quando foi", onde "há 41 h" obriga a fazer conta de cabeça.
   */
  function diaEData(data: ISODate): string {
    const doAnoCorrente = data.slice(0, 4) === clock.today().slice(0, 4)

    return new Intl.DateTimeFormat(localeIntl.value, {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      ...(doAnoCorrente ? {} : { year: 'numeric' as const }),
      timeZone: 'UTC',
    }).format(new Date(`${data}T12:00:00Z`))
  }

  function diaDaSemanaCurto(data: ISODate): string {
    return new Intl.DateTimeFormat(localeIntl.value, {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${data}T12:00:00Z`))
  }

  /**
   * Duração de um intervalo: sempre em horas e minutos.
   *
   * Não converte para dias. "26 horas de agenda parada" é um número que a clínica compara com
   * o expediente; "1 dia" arredonda fora justamente a precisão que dava sentido ao dado.
   */
  function duracao(minutos: number): string {
    const total = Math.abs(minutos)
    const horas = Math.floor(total / 60)
    const resto = total % 60

    if (horas === 0) {
      return t('clinico.formato.minutos', { valor: resto })
    }

    if (resto === 0) {
      return t('clinico.formato.horas', { valor: horas })
    }

    return t('clinico.formato.horasMinutos', { horas, minutos: resto })
  }

  /**
   * Distância no tempo. Aqui **sim** vira dias depois de dois dias: ninguém conta em horas o
   * que já virou semana, e "há 486 h" obriga a fazer a conta de cabeça.
   */
  function distancia(minutos: number): string {
    const total = Math.abs(minutos)

    if (total >= 48 * 60) {
      const dias = Math.round(total / (24 * 60))

      return t('clinico.formato.dias', { valor: dias }, dias)
    }

    /**
     * Precisão proporcional à distância: "há 30 h 2 min" promete um rigor que ninguém pediu.
     * Passadas seis horas, o minuto deixa de ser informação.
     */
    if (total >= 6 * 60) {
      return t('clinico.formato.horas', { valor: Math.floor(total / 60) })
    }

    return duracao(total)
  }

  /** Diferença até agora, em linguagem de plantão: "há 12 min", "em 40 min". */
  function relativo(iso: ISODateTime): string {
    const minutos = Math.round((Date.parse(iso) - Date.parse(clock.nowIso())) / 60_000)

    if (Math.abs(minutos) < 1) {
      return t('clinico.formato.agora')
    }

    return minutos < 0
      ? t('clinico.formato.haTempo', { valor: distancia(minutos) })
      : t('clinico.formato.emTempo', { valor: distancia(minutos) })
  }

  function idade(nascimento: ISODate | null): string {
    if (!nascimento) {
      return t('clinico.formato.idadeDesconhecida')
    }

    const nasceu = new Date(`${nascimento}T12:00:00Z`)
    const agora = new Date(`${clock.today()}T12:00:00Z`)
    let anos = agora.getUTCFullYear() - nasceu.getUTCFullYear()
    let meses = agora.getUTCMonth() - nasceu.getUTCMonth()

    if (agora.getUTCDate() < nasceu.getUTCDate()) {
      meses -= 1
    }

    if (meses < 0) {
      anos -= 1
      meses += 12
    }

    if (anos <= 0) {
      return t('clinico.formato.meses', { valor: Math.max(meses, 0) }, Math.max(meses, 0))
    }

    return meses === 0
      ? t('clinico.formato.anos', { valor: anos }, anos)
      : t('clinico.formato.anosMeses', { anos, meses })
  }

  function numero(valor: number, casas: number): string {
    return new Intl.NumberFormat(localeIntl.value, {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    }).format(valor)
  }

  /**
   * Miligramas por administração, com as casas que a conta tem (até duas): "128 mg", "0,64 mg".
   *
   * Com uma casa fixa a dose por extenso dizia "0,6 mg" logo abaixo da conta "= 0,64 mg", e
   * "128,0 mg" nos números redondos: duas doses diferentes para quem confere de cabeça.
   */
  function miligramas(valor: number): string {
    return new Intl.NumberFormat(localeIntl.value, { maximumFractionDigits: 2 }).format(valor)
  }

  /**
   * Dinheiro, a partir de **centavos**.
   *
   * A entrada é inteira porque é assim que o valor é guardado: custo unitário em centavos, e a
   * multiplicação por contagem de doses feita antes da divisão. Receber reais com casa decimal
   * aqui devolveria o erro de ponto flutuante que guardar em centavos existe para evitar — o
   * total do painel deixaria de bater com o da nota por alguns centavos, que é justamente o
   * tipo de diferença que faz a clínica parar de confiar na tela.
   *
   * A moeda é do país da clínica e não do idioma de quem lê: o mesmo estoque vale os mesmos
   * reais para quem abre a tela em inglês.
   */
  function moeda(centavos: number): string {
    return new Intl.NumberFormat(localeIntl.value, {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 2,
    }).format(centavos / 100)
  }

  function peso(valor: number | null): string {
    return valor === null ? t('clinico.formato.semvalor') : `${numero(valor, valor >= 100 ? 0 : 1)} kg`
  }

  /**
   * `não aferido` precisa ser distinguível de vazio — na interface e no dado. Um traço para
   * "ninguém preencheu", a palavra inteira para "o profissional decidiu não medir".
   *
   * `unidadeAlternativa` cobre o vital sem faixa de referência de onde herdar a unidade — o
   * peso, cujo normal é o próprio paciente. Sem ela o papel imprimiria "9,0" e deixaria o
   * quilo por conta de quem lê.
   */
  function medicao(
    valor: Measurement | undefined,
    faixa: ReferenceRange | null,
    unidadeAlternativa = '',
  ): string {
    if (!valor) {
      return t('clinico.formato.semvalor')
    }

    if (valor.naoAferido) {
      return t('clinico.prontuario.naoAferido')
    }

    if (valor.valor === null) {
      return t('clinico.formato.semvalor')
    }

    const casas = faixa?.precisao ?? 1
    const unidade = faixa?.unidade ?? unidadeAlternativa

    return `${numero(valor.valor, casas)}${comUnidade(unidade)}`
  }

  function faixaDeReferencia(faixa: ReferenceRange | null): string {
    if (!faixa) {
      return t('clinico.prontuario.semReferencia')
    }

    return `${numero(faixa.min, faixa.precisao)}–${numero(faixa.max, faixa.precisao)}${comUnidade(faixa.unidade)}`
  }

  /**
   * A unidade depois do número: com espaço ("38,6 °C", "112 bpm"), menos a que é parte da
   * fração. O escore corporal é "5/9", e "5 /9" lia como dois números soltos.
   */
  function comUnidade(unidade: string): string {
    if (!unidade) {
      return ''
    }

    return unidade.startsWith('/') ? unidade : ` ${unidade}`
  }

  function percentual(valor: number): string {
    return new Intl.NumberFormat(localeIntl.value, { style: 'percent', maximumFractionDigits: 0 }).format(
      valor,
    )
  }

  // ------------------------------------------------------------ traduções por `kind`

  function status(valor: AppointmentStatus): string {
    return t(`clinico.status.${valor}`)
  }

  function especie(valor: PetSpecies): string {
    return t(`clinico.especie.${valor}`)
  }

  /**
   * Sexo, ou "sexo não informado". O nulo existe desde que a base vem de outro sistema
   * (ver `Pet.sexo`): escrever a chave crua no atestado seria pior que a lacuna.
   */
  function sexo(valor: PetSex | null): string {
    return valor ? t(`clinico.sexo.${valor}`) : t('clinico.sexo.naoInformado')
  }

  function motivoBloqueio(valor: BlockReason): string {
    return t(`clinico.bloqueio.${valor}`)
  }

  function motivoCancelamento(valor: CancelReason | null): string {
    return valor ? t(`clinico.cancelamento.${valor}`) : ''
  }

  function motivoFalta(valor: MotivoDeFalta | null): string {
    return valor ? t(`clinico.faltas.motivo.${valor}`) : ''
  }

  function canalDeContato(valor: CanalDeContato | null): string {
    return valor ? t(`clinico.faltas.canal.${valor}`) : ''
  }

  function alerta(valor: PetAlertKind): string {
    return t(`clinico.alertas.${valor}`)
  }

  function severidade(valor: AlertSeverity): string {
    return t(`clinico.severidade.${valor}`)
  }

  function prioridadeDaFila(valor: WaitlistPriority): string {
    return t(`clinico.fila.prioridade.${valor}`)
  }

  function statusDeFaixa(valor: RangeStatus): string {
    return t(`clinico.prontuario.faixa.${valor}`)
  }

  /** Conflito: `kind` + `params` viram frase só neste ponto. */
  function conflito(valor: Conflict): string {
    const params: Record<string, string | number> = {}

    for (const [chave, conteudo] of Object.entries(valor.params)) {
      params[chave] =
        PARAMS_DE_HORARIO.has(chave) && typeof conteudo === 'number'
          ? minutesToClock(conteudo)
          : chave === 'motivo' && typeof conteudo === 'string'
            ? t(`clinico.bloqueio.${conteudo}`)
            : conteudo
    }

    /* "565 min, acima dos 480 min" é conta de sistema; o balcão lê "9 h 25 min, acima das 8 h". */
    if (valor.kind === 'over-capacity') {
      for (const chave of ['minutos', 'capacidade']) {
        const conteudo = valor.params[chave]

        if (typeof conteudo === 'number') {
          params[chave] = duracao(conteudo)
        }
      }
    }

    return t(`clinico.conflitos.${valor.kind}`, params)
  }

  return {
    hora,
    intervalo,
    distancia,
    dataLonga,
    dataPorExtenso,
    dataCurta,
    dataCurtaComAno,
    mesCurto,
    mesPorExtenso,
    diaEData,
    diaDaSemanaCurto,
    diaDaSemanaCurtoPorIndice,
    duracao,
    relativo,
    idade,
    numero,
    miligramas,
    comUnidade,
    moeda,
    peso,
    medicao,
    faixaDeReferencia,
    percentual,
    status,
    especie,
    sexo,
    motivoBloqueio,
    motivoCancelamento,
    motivoFalta,
    canalDeContato,
    alerta,
    severidade,
    prioridadeDaFila,
    statusDeFaixa,
    conflito,
  }
}
