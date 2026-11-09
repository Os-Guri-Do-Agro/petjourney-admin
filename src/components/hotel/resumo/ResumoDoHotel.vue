<script setup lang="ts">
/**
 * Resumo e faturamento do hotel pela API (E7-06, PJ-62YZHU; guia e7 20 e 20.1).
 *
 * Nenhuma soma fica no navegador: a tela escreve o que veio. O que o guia pede e esta tela cumpre:
 *
 * - toda taxa com o denominador ao lado ("62% (31 de 50 noites)") e "sem dados" quando ele é 0;
 * - as noites seguradas só por reserva pendente à parte, fora da ocupação; os dias depois de hoje
 *   (`prevista`) na cor clara, fora da média;
 * - a cancelada por óbito numa linha própria, fora da taxa e das perdas;
 * - o retorno por cliente, com "dados desde" quando a casa ainda não tem histórico;
 * - "capacidade estimada" quando o período começa antes do histórico das acomodações;
 * - o dinheiro só para quem tem `hotel.faturamento`: no bloco `receita` do resumo (dono e gestor)
 *   ou pela rota da receita (o financeiro, que não lê a casa). Sem a chave, nenhum cartão de
 *   dinheiro. Sinal retido, a devolver e o pago em não comparecimento são informativos;
 * - nada de repetir o pedido sozinho: o limite é de 10 por minuto. A única espera é a do
 *   `RESUMO_DO_HOTEL_EM_ANDAMENTO` (outro período da casa em cálculo), uma vez.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDasReservas } from '@/components/hotel/reservas/useRotulosDasReservas'
import { hojeNoFuso } from '@/components/parceiro/estabelecimento/horario'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import ClinicToggleGroup from '@/features/clinico/components/base/ClinicToggleGroup.vue'
import ClinicChartRanking from '@/features/clinico/components/resumo/ClinicChartRanking.vue'
import type { Fatia } from '@/features/clinico/domain/resumo'
import { ApiError } from '@/service/api'
import {
  lerReceitaDoHotel,
  lerResumoDoHotel,
  PERIODOS_DO_HOTEL,
  RESUMO_DO_HOTEL_MAX_DIAS,
  type FiltroDoResumoDoHotel,
  type PeriodoDoHotel,
  type ReceitaDoHotelResposta,
  type ResumoDoHotel,
  type TaxaComBase,
} from '@/service/parceiro/hotel-resumo-service'

const { t, te } = useI18n()
const rotulos = useRotulosDasReservas()
const { store, parceiroQuery } = useParceiroPortal()

/** O financeiro não lê a casa: chega só pela rota da receita. */
const leACasa = computed(() => store.temPermissao('hotel.ler'))
const veFaturamento = computed(() => store.temPermissao('hotel.faturamento'))

const PERIODOS = Object.keys(PERIODOS_DO_HOTEL) as PeriodoDoHotel[]

const periodo = ref<PeriodoDoHotel>('trinta-dias')
/** O período escolhido no calendário, ou o que coube depois do 400 de leitura excedida. */
const livre = ref<{ de: string; ate: string } | null>(null)

const resumo = ref<ResumoDoHotel | null>(null)
const soReceita = ref<ReceitaDoHotelResposta | null>(null)
const carregando = ref(false)
const erro = ref('')
const aviso = ref('')
/** "Cabem N dias": só no limite de reservas; casa de baias demais não se resolve com período. */
const cabem = ref<number | null>(null)
let pedido = 0

const opcoesPeriodo = computed(() =>
  PERIODOS.map((valor) => ({ valor, rotulo: t(`resumoDoHotel.periodo.${valor}`) })),
)

function filtro(): FiltroDoResumoDoHotel {
  return livre.value ? { ...livre.value } : { periodo: periodo.value }
}

function esperar(segundos: number) {
  return new Promise((resolver) => setTimeout(resolver, Math.max(1, segundos) * 1000))
}

/** A frase de cada recusa do resumo, pelo `codigo`. */
function frase(err: unknown): string {
  const codigo = err instanceof ApiError ? err.codigo : undefined
  const detalhes = err instanceof ApiError ? (err.detalhes ?? {}) : {}
  if (codigo === 'RESUMO_DO_HOTEL_LEITURA_EXCEDIDA') {
    return typeof detalhes.diasQueCabem === 'number'
      ? t('resumoDoHotel.erro.excedida', { dias: detalhes.diasQueCabem })
      : t('resumoDoHotel.erro.casaGrande')
  }
  if (codigo === 'RESUMO_DO_HOTEL_TAXA_EXCEDIDA' || codigo === 'RESUMO_DO_HOTEL_EM_ANDAMENTO') {
    const segundos = Number(detalhes.tenteDeNovoEmSegundos ?? 0)
    return segundos > 0
      ? t('resumoDoHotel.erro.taxa', { segundos }, segundos)
      : t('resumoDoHotel.erro.taxaSemTempo')
  }
  if (codigo === 'PAINEL_OCUPADO') return t('resumoDoHotel.erro.ocupado')
  if (codigo === 'RESUMO_PERIODO_INVALIDO' && detalhes.motivo === 'MUITOS_DIAS') {
    return t('resumoDoHotel.erro.muitosDias', { max: RESUMO_DO_HOTEL_MAX_DIAS })
  }
  return lerErroDoCadastro(err, t('resumoDoHotel.erro.ler')).mensagem
}

async function carregar(tentativa = 0): Promise<void> {
  if (!leACasa.value && !veFaturamento.value) return
  const este = ++pedido
  carregando.value = true
  erro.value = ''
  aviso.value = ''
  cabem.value = null
  try {
    if (leACasa.value) {
      const lido = await lerResumoDoHotel(filtro(), parceiroQuery())
      if (este !== pedido) return
      resumo.value = lido
      soReceita.value = null
    } else {
      const lido = await lerReceitaDoHotel(filtro(), parceiroQuery())
      if (este !== pedido) return
      soReceita.value = lido
      resumo.value = null
    }
  } catch (err) {
    if (este !== pedido) return
    const codigo = err instanceof ApiError ? err.codigo : undefined
    const detalhes = err instanceof ApiError ? (err.detalhes ?? {}) : {}
    if (codigo === 'RESUMO_DO_HOTEL_EM_ANDAMENTO' && tentativa === 0) {
      /* Outro período da casa em cálculo: espera o que a API pede e repete uma vez. */
      await esperar(Number(detalhes.tenteDeNovoEmSegundos ?? 2))
      if (este === pedido) return carregar(1)
      return
    }
    if (
      codigo === 'RESUMO_DO_HOTEL_LEITURA_EXCEDIDA' &&
      typeof detalhes.diasQueCabem === 'number'
    ) {
      cabem.value = detalhes.diasQueCabem
    }
    if (resumo.value || soReceita.value || cabem.value) aviso.value = frase(err)
    else erro.value = frase(err)
  } finally {
    if (este === pedido) carregando.value = false
  }
}

const fuso = computed(
  () =>
    resumo.value?.fuso ?? soReceita.value?.fuso ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
)

/** O período que coube: os últimos N dias até hoje, na parede da casa. */
function verOQueCabe() {
  if (!cabem.value) return
  const ate = hojeNoFuso(fuso.value)
  const [a, m, d] = ate.split('-').map(Number)
  const inicio = new Date(Date.UTC(a!, m! - 1, d! - (cabem.value - 1)))
  livre.value = { de: inicio.toISOString().slice(0, 10), ate }
  void carregar()
}

function trocarPeriodo(valor: PeriodoDoHotel) {
  if (!valor) return
  const mudou = livre.value !== null || valor !== periodo.value
  livre.value = null
  periodo.value = valor
  if (mudou) void carregar()
}

/* ------------------------------------------------------------------- outro período (gaveta) */

const gavetaAberta = ref(false)
const intervalo = ref<Date[] | null>(null)
const tentouIntervalo = ref(false)

function paraData(texto: string) {
  const [a, m, d] = texto.split('-').map(Number)
  return new Date(a!, m! - 1, d!)
}

function paraTexto(data: Date) {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

const periodoAtual = computed(() => resumo.value?.periodo ?? soReceita.value?.periodo ?? null)

function abrirOutroPeriodo() {
  const atual = periodoAtual.value
  intervalo.value = atual ? [paraData(atual.de), paraData(atual.ate)] : null
  tentouIntervalo.value = false
  gavetaAberta.value = true
}

const diasNoIntervalo = computed(() => {
  const [de, ate] = intervalo.value ?? []
  if (!de || !ate) return 0
  return Math.round((ate.getTime() - de.getTime()) / 86_400_000) + 1
})

const erroDoIntervalo = computed(() => {
  if (!tentouIntervalo.value) return ''
  if (!diasNoIntervalo.value) return t('resumoDoHotel.outro.faltaData')
  if (diasNoIntervalo.value > RESUMO_DO_HOTEL_MAX_DIAS)
    return t('resumoDoHotel.erro.muitosDias', { max: RESUMO_DO_HOTEL_MAX_DIAS })
  return ''
})

function aplicarIntervalo() {
  tentouIntervalo.value = true
  if (erroDoIntervalo.value) return
  const [de, ate] = intervalo.value!
  livre.value = { de: paraTexto(de!), ate: paraTexto(ate!) }
  gavetaAberta.value = false
  void carregar()
}

watch(intervalo, () => (tentouIntervalo.value = false))

onMounted(() => void carregar())

/* ------------------------------------------------------------------------------- leitura */

const receita = computed(() => resumo.value?.receita ?? soReceita.value?.receita ?? null)
const lido = computed(() => resumo.value ?? soReceita.value)

function pct(valor: number) {
  return new Intl.NumberFormat(rotulos.intl(), {
    style: 'percent',
    maximumFractionDigits: valor > 0 && valor < 0.1 ? 1 : 0,
  }).format(valor)
}

/** "62%", ou "Sem dados" quando o denominador é 0. */
function taxa(base: TaxaComBase) {
  return base.de > 0 ? pct(base.valor) : t('resumoDoHotel.semDados')
}

/** O numerador da taxa: `valor` é a razão sobre `de`. */
function parte(base: TaxaComBase) {
  return Math.round(base.valor * base.de)
}

const intervaloLegivel = computed(() => {
  const atual = lido.value
  if (!atual) return ''
  const { de, ate } = atual.periodo
  const texto =
    de === ate
      ? rotulos.dia(de)
      : t('resumoDoHotel.intervalo', { de: rotulos.dia(de), ate: rotulos.dia(ate) })
  return atual.emCache
    ? `${texto} · ${t('resumoDoHotel.atualizadoAs', { hora: atual.geradoEm.slice(11, 16) })}`
    : texto
})

const fraseDoResumo = computed(() => {
  const atual = lido.value
  if (!atual) return ''
  const dias = atual.periodo.dias
  if (resumo.value) {
    const media = resumo.value.ocupacao.media
    return media.de > 0
      ? t('resumoDoHotel.frase', { ocupacao: pct(media.valor), dias }, dias)
      : t('resumoDoHotel.fraseSemDados', { dias }, dias)
  }
  return t(
    'resumoDoHotel.fraseReceita',
    { receita: rotulos.dinheiro(receita.value?.receitaCentavos ?? 0), dias },
    dias,
  )
})

const numeros = computed(() => {
  const r = resumo.value
  if (!r) return []
  const { media } = r.ocupacao
  const retorno = r.retorno
  return [
    {
      id: 'ocupacao',
      icone: 'ph ph-moon-stars',
      valor: taxa(media),
      rotulo: t('resumoDoHotel.numero.ocupacao'),
      nota:
        media.de > 0
          ? t(
              'resumoDoHotel.numero.noites',
              { parte: r.ocupacao.noitesOcupadas, de: media.de },
              media.de,
            )
          : t('resumoDoHotel.numero.ocupacaoSemBase'),
      atencao: false,
    },
    {
      id: 'diarias',
      icone: 'ph ph-calendar-check',
      valor: rotulos.numero(r.diariasVendidas),
      rotulo: t('resumoDoHotel.numero.diarias'),
      nota: t('resumoDoHotel.numero.diariasNota'),
      atencao: false,
    },
    {
      id: 'retorno',
      icone: 'ph ph-arrow-u-up-left',
      valor: taxa(retorno.taxa),
      rotulo: t('resumoDoHotel.numero.retorno'),
      nota:
        retorno.atendidos > 0
          ? t(
              'resumoDoHotel.numero.voltaram',
              { parte: retorno.queVoltaram, de: retorno.atendidos },
              retorno.atendidos,
            )
          : retorno.historicoDesde
            ? t('resumoDoHotel.numero.desde', { data: rotulos.dia(retorno.historicoDesde) })
            : t('resumoDoHotel.numero.semHistorico'),
      atencao: false,
    },
    {
      id: 'semDesfecho',
      icone: 'ph ph-question',
      valor: rotulos.numero(r.semDesfecho),
      rotulo: t('resumoDoHotel.numero.semDesfecho'),
      nota: t('resumoDoHotel.numero.semDesfechoNota'),
      atencao: r.semDesfecho > 0,
    },
  ]
})

/* --------------------------------------------------------------------- ocupação por dia */

const hoje = computed(() => hojeNoFuso(fuso.value))

function fimDeSemana(data: string) {
  const dia = paraData(data).getDay()
  return dia === 0 || dia === 6
}

/** "8/10": o rótulo curto das colunas, que cabe embaixo da barra. */
function diaEMes(data: string) {
  return new Intl.DateTimeFormat(rotulos.intl(), { day: 'numeric', month: 'numeric' }).format(
    paraData(data),
  )
}

function diaDaSemana(data: string) {
  return new Intl.DateTimeFormat(rotulos.intl(), { weekday: 'short' }).format(paraData(data))
}

const colunas = computed(() => {
  const dias = resumo.value?.ocupacao.porDia ?? []
  return dias.map((ponto, indice) => {
    const fechado = ponto.operando === 0
    const dica = fechado
      ? t('resumoDoHotel.ocupacao.dicaFechado', { dia: rotulos.dia(ponto.data) })
      : [
          t('resumoDoHotel.ocupacao.dica', {
            dia: rotulos.dia(ponto.data),
            ocupadas: ponto.ocupadas,
            total: ponto.operando,
            taxa: pct(ponto.taxa),
          }),
          ponto.pendentes
            ? t('resumoDoHotel.ocupacao.dicaPendentes', { n: ponto.pendentes }, ponto.pendentes)
            : '',
          ponto.prevista ? t('resumoDoHotel.ocupacao.prevista') : '',
        ]
          .filter(Boolean)
          .join(' · ')
    return {
      data: ponto.data,
      altura: fechado ? 0 : Math.min(1, ponto.taxa) * 100,
      ocupadas: ponto.ocupadas,
      fechado,
      prevista: ponto.prevista,
      fim: fimDeSemana(ponto.data),
      hoje: ponto.data === hoje.value,
      rotulo:
        dias.length <= 14 ? diaDaSemana(ponto.data) : indice % 3 === 0 ? diaEMes(ponto.data) : '',
      dica,
    }
  })
})

const temPrevista = computed(() => colunas.value.some((coluna) => coluna.prevista))

/** A média e a noite mais cheia, entre as que já passaram. */
const fraseDaOcupacao = computed(() => {
  const r = resumo.value
  if (!r || r.ocupacao.media.de === 0) return ''
  const passadas = r.ocupacao.porDia.filter((p) => !p.prevista && p.operando > 0 && p.ocupadas > 0)
  if (!passadas.length) return ''
  const media = pct(r.ocupacao.media.valor)
  if (passadas.length < 2) return t('resumoDoHotel.ocupacao.media', { media })
  const cheia = passadas.reduce((maior, p) => (p.taxa > maior.taxa ? p : maior))
  return t('resumoDoHotel.ocupacao.comPico', {
    media,
    dia: `${diaDaSemana(cheia.data)} ${rotulos.dia(cheia.data)}`,
    ocupadas: cheia.ocupadas,
    total: cheia.operando,
  })
})

const notasDaOcupacao = computed(() => {
  const r = resumo.value
  if (!r) return []
  return [
    r.ocupacao.noitesPendentes
      ? {
          icone: 'ph ph-hourglass-medium',
          texto: t(
            'resumoDoHotel.ocupacao.pendentes',
            { n: r.ocupacao.noitesPendentes },
            r.ocupacao.noitesPendentes,
          ),
        }
      : null,
    r.capacidadeExata
      ? null
      : { icone: 'ph ph-info', texto: t('resumoDoHotel.ocupacao.capacidadeEstimada') },
    r.ocupacaoUsaDatasPrevistas
      ? { icone: 'ph ph-info', texto: t('resumoDoHotel.ocupacao.datasPrevistas') }
      : null,
  ].filter((nota): nota is { icone: string; texto: string } => nota !== null)
})

/* ---------------------------------------------------------------- perdas, origem, ocorrências */

const perdas = computed(() => {
  const r = resumo.value
  if (!r) return null
  const { cancelamento, naoComparecimento } = r
  return {
    cancelamento: {
      taxa: taxa(cancelamento.taxa),
      base:
        cancelamento.taxa.de > 0
          ? t(
              'resumoDoHotel.perdas.reservas',
              { parte: parte(cancelamento.taxa), de: cancelamento.taxa.de },
              cancelamento.taxa.de,
            )
          : '',
      prazo: t('resumoDoHotel.perdas.prazo', {
        dentro: cancelamento.dentroDoPrazo,
        fora: cancelamento.foraDoPrazo,
      }),
      diarias: cancelamento.perdasEmDiarias
        ? t(
            'resumoDoHotel.perdas.diarias',
            { n: cancelamento.perdasEmDiarias },
            cancelamento.perdasEmDiarias,
          )
        : '',
    },
    naoComparecimento: {
      taxa: taxa(naoComparecimento.taxa),
      atencao: naoComparecimento.quantidade > 0,
      base:
        naoComparecimento.taxa.de > 0
          ? t(
              'resumoDoHotel.perdas.reservas',
              { parte: naoComparecimento.quantidade, de: naoComparecimento.taxa.de },
              naoComparecimento.taxa.de,
            )
          : '',
      diarias: naoComparecimento.perdasEmDiarias
        ? t(
            'resumoDoHotel.perdas.diarias',
            { n: naoComparecimento.perdasEmDiarias },
            naoComparecimento.perdasEmDiarias,
          )
        : '',
    },
    obito: cancelamento.canceladasPorObito
      ? t(
          'resumoDoHotel.perdas.obito',
          { n: cancelamento.canceladasPorObito },
          cancelamento.canceladasPorObito,
        )
      : '',
  }
})

function fatias<T>(
  itens: T[],
  id: (item: T) => string,
  rotulo: (item: T) => string,
  valor: (item: T) => number,
): Fatia[] {
  const total = itens.reduce((soma, item) => soma + valor(item), 0)
  return itens.map((item) => ({
    id: id(item),
    rotulo: rotulo(item),
    valor: valor(item),
    parte: total > 0 ? valor(item) / total : 0,
  }))
}

const porOrigem = computed(() =>
  fatias(
    resumo.value?.porOrigem ?? [],
    (item) => item.origem,
    (item) => rotulos.origem(item.origem),
    (item) => item.reservas,
  ),
)

function nomeDaOcorrencia(kind: string) {
  const chave = `resumoDoHotel.ocorrenciaKind.${kind}`
  return te(chave) ? t(chave) : kind
}

const ocorrencias = computed(() => {
  const lidas = resumo.value?.ocorrencias ?? []
  const graves = new Map(lidas.map((item) => [item.kind, item.grave]))
  return {
    fatias: fatias(
      lidas,
      (item) => item.kind,
      (item) => nomeDaOcorrencia(item.kind),
      (item) => item.leve + item.moderada + item.grave,
    ),
    escrever: (fatia: Fatia) => {
      const grave = graves.get(fatia.id) ?? 0
      return grave
        ? `${fatia.valor} · ${t('resumoDoHotel.ocorrencias.graves', { n: grave }, grave)}`
        : String(fatia.valor)
    },
  }
})

/**
 * As graves criadas e comunicadas pela mesma pessoa em menos de 10 minutos (E7-05b, guia e7 43): um
 * aviso discreto ao gestor, para conferir (a grave criada só para ver o telefone do responsável).
 */
const gravesDoProprioAutor = computed(() =>
  store.temPermissao('estabelecimento.editar')
    ? (resumo.value?.ocorrencias ?? []).reduce(
        (soma, item) => soma + (item.graveDoProprioAutor ?? 0),
        0,
      )
    : 0,
)

/* ------------------------------------------------------------------------------ dinheiro */

const pelaReserva = computed(
  () =>
    (receita.value?.criterios as Record<string, unknown> | undefined)?.receita ===
    'ORCAMENTO_CONGELADO',
)

const numerosDaReceita = computed(() => {
  const r = receita.value
  if (!r) return []
  const semDiarias = r.diariasVendidas === 0
  const diaria =
    r.diariaMediaCentavos === undefined
      ? null
      : {
          id: 'diaria',
          rotulo: t('resumoDoHotel.receita.diariaMedia'),
          valor: semDiarias ? t('resumoDoHotel.semDados') : rotulos.dinheiro(r.diariaMediaCentavos),
          nota: t('resumoDoHotel.receita.diariaMediaNota'),
        }
  return [
    {
      id: 'receita',
      rotulo: t('resumoDoHotel.receita.receita'),
      valor: rotulos.dinheiro(r.receitaCentavos),
      nota: rotulos.diarias(r.diariasVendidas),
    },
    ...(diaria ? [diaria] : []),
    {
      id: 'porDiaria',
      rotulo: t('resumoDoHotel.receita.porDiaria'),
      valor: semDiarias
        ? t('resumoDoHotel.semDados')
        : rotulos.dinheiro(r.receitaPorDiariaCentavos),
      nota: t('resumoDoHotel.receita.porDiariaNota'),
    },
  ]
})

const dinheiroDaFatia = (fatia: Fatia) => rotulos.dinheiro(fatia.valor)

const receitaPorOrigem = computed(() =>
  fatias(
    receita.value?.porOrigem ?? [],
    (item) => item.origem,
    (item) => rotulos.origem(item.origem),
    (item) => item.receitaCentavos,
  ),
)

function nomeDoServico(servico: string) {
  const chave = `casaDoHotel.servicoKind.${servico}`
  return te(chave) ? t(chave) : servico
}

const receitaPorServico = computed(() =>
  fatias(
    receita.value?.porServico ?? [],
    (item) => item.servico,
    (item) => nomeDoServico(item.servico),
    (item) => item.receitaCentavos,
  ),
)

const sinal = computed(() => {
  const r = receita.value
  if (!r) return []
  const { sinalRetido, canceladasPorObito } = r
  const reservas = (n: number) => t('resumoDoHotel.receita.reservas', { n }, n)
  return [
    {
      id: 'retido',
      rotulo: t('resumoDoHotel.receita.retido'),
      valor: rotulos.dinheiro(sinalRetido.retidoCentavos),
      nota: reservas(sinalRetido.reservas),
      ajuda: t('resumoDoHotel.receita.retidoAjuda'),
    },
    {
      id: 'aDevolver',
      rotulo: t('resumoDoHotel.receita.aDevolver'),
      valor: rotulos.dinheiro(sinalRetido.aDevolverCentavos),
      nota: reservas(sinalRetido.reservasADevolver),
      ajuda: t('resumoDoHotel.receita.aDevolverAjuda'),
    },
    {
      id: 'naoCompareceu',
      rotulo: t('resumoDoHotel.receita.naoCompareceu'),
      valor: rotulos.dinheiro(sinalRetido.pagoEmNaoCompareceuCentavos),
      nota: reservas(sinalRetido.reservasNaoCompareceu),
      ajuda: t('resumoDoHotel.receita.naoCompareceuAjuda'),
    },
    ...(canceladasPorObito.reservas
      ? [
          {
            id: 'obito',
            rotulo: t('resumoDoHotel.receita.obito'),
            valor: rotulos.dinheiro(canceladasPorObito.valorParadoCentavos),
            nota: reservas(canceladasPorObito.reservas),
            ajuda: t('resumoDoHotel.receita.obitoAjuda'),
          },
        ]
      : []),
  ]
})
</script>

<template>
  <UiPagina
    :resumo="fraseDoResumo"
    :carregando="carregando && !lido"
    :erro="erro"
    @tentar-de-novo="carregar()"
  >
    <div class="relatorio" :aria-busy="carregando">
      <div class="relatorio__filtros">
        <ClinicToggleGroup
          :model-value="livre ? '' : periodo"
          :opcoes="opcoesPeriodo"
          :rotulo="t('resumoDoHotel.periodo.rotulo')"
          @update:model-value="trocarPeriodo($event as PeriodoDoHotel)"
        />

        <Button
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-calendar-dots"
          :label="t('resumoDoHotel.outro.abrir')"
          @click="abrirOutroPeriodo"
        />

        <span v-if="intervaloLegivel" class="relatorio__intervalo">
          <i class="ph ph-calendar-blank" aria-hidden="true" />
          <span>{{ intervaloLegivel }}</span>
        </span>
      </div>

      <p v-if="aviso" class="relatorio__aviso ui-poco" role="status">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ aviso }}</span>
        <Button
          v-if="cabem"
          type="button"
          size="small"
          severity="secondary"
          outlined
          :label="t('resumoDoHotel.verDias', { dias: cabem }, cabem)"
          @click="verOQueCabe"
        />
      </p>

      <template v-if="resumo">
        <ul class="ui-indicadores numeros" :aria-label="t('resumoDoHotel.numero.aria')">
          <li
            v-for="numero in numeros"
            :key="numero.id"
            class="ui-indicador"
            :class="{ 'ui-indicador--atencao': numero.atencao }"
          >
            <span
              class="ui-ladrilho"
              :class="{ 'ui-ladrilho--atencao': numero.atencao }"
              aria-hidden="true"
            >
              <i :class="numero.icone" />
            </span>
            <strong class="ui-indicador__valor ui-num numero__valor">{{ numero.valor }}</strong>
            <span class="ui-indicador__rotulo">{{ numero.rotulo }}</span>
            <span class="ui-indicador__nota">{{ numero.nota }}</span>
          </li>
        </ul>

        <section class="painel ui-folha" aria-labelledby="rh-ocupacao">
          <header class="painel__cabeca">
            <span class="ui-ladrilho ui-ladrilho--dado" aria-hidden="true">
              <i class="ph ph-chart-bar" />
            </span>
            <span class="painel__titulos">
              <h2 id="rh-ocupacao">{{ t('resumoDoHotel.ocupacao.titulo') }}</h2>
              <span class="painel__descricao">{{ t('resumoDoHotel.ocupacao.descricao') }}</span>
            </span>
          </header>

          <div class="relatorio__recheio ocupacao">
            <p v-if="!colunas.length" class="relatorio__nota">{{ t('resumoDoHotel.semDados') }}</p>
            <div
              v-else
              class="grafico"
              role="img"
              :aria-label="fraseDaOcupacao || t('resumoDoHotel.ocupacao.titulo')"
            >
              <div class="grafico__escala" aria-hidden="true">
                <span v-for="marca in [100, 75, 50, 25, 0]" :key="marca" class="grafico__fio">
                  <small class="ui-num">{{ marca }}%</small>
                </span>
              </div>
              <div class="grafico__colunas" :style="{ '--colunas': colunas.length }">
                <div
                  v-for="coluna in colunas"
                  :key="coluna.data"
                  class="grafico__coluna"
                  :class="{ 'grafico__coluna--hoje': coluna.hoje }"
                  :title="coluna.dica"
                >
                  <span v-if="coluna.fechado" class="grafico__fechado" />
                  <span
                    v-else
                    class="grafico__barra"
                    :class="{
                      'grafico__barra--fim': coluna.fim && !coluna.prevista,
                      'grafico__barra--prevista': coluna.prevista,
                    }"
                    :style="{
                      blockSize: `${Math.max(coluna.altura, coluna.ocupadas > 0 ? 2 : 0)}%`,
                    }"
                  />
                  <small class="grafico__rotulo ui-num" aria-hidden="true">{{
                    coluna.rotulo
                  }}</small>
                </div>
              </div>
            </div>

            <div v-if="colunas.length" class="ocupacao__pe">
              <ul class="legenda" aria-hidden="true">
                <li>
                  <span class="legenda__cor legenda__cor--fim" />{{
                    t('resumoDoHotel.ocupacao.fimDeSemana')
                  }}
                </li>
                <li><span class="legenda__cor" />{{ t('resumoDoHotel.ocupacao.diaDeSemana') }}</li>
                <li v-if="temPrevista">
                  <span class="legenda__cor legenda__cor--prevista" />{{
                    t('resumoDoHotel.ocupacao.previstas')
                  }}
                </li>
              </ul>
              <p v-if="fraseDaOcupacao" class="ocupacao__frase">
                <i class="ph ph-moon-stars" aria-hidden="true" />
                {{ fraseDaOcupacao }}
              </p>
            </div>

            <ul v-if="notasDaOcupacao.length" class="notas">
              <li v-for="nota in notasDaOcupacao" :key="nota.texto">
                <i :class="nota.icone" aria-hidden="true" />
                <span>{{ nota.texto }}</span>
              </li>
            </ul>
          </div>
        </section>

        <div class="relatorio__par">
          <section v-if="perdas" class="painel ui-folha" aria-labelledby="rh-perdas">
            <header class="painel__cabeca">
              <span class="ui-ladrilho ui-ladrilho--dado" aria-hidden="true">
                <i class="ph ph-trend-down" />
              </span>
              <span class="painel__titulos">
                <h2 id="rh-perdas">{{ t('resumoDoHotel.perdas.titulo') }}</h2>
                <span class="painel__descricao">{{ t('resumoDoHotel.perdas.descricao') }}</span>
              </span>
            </header>
            <dl class="relatorio__recheio perdas">
              <div class="perda">
                <dt>{{ t('resumoDoHotel.perdas.cancelamento') }}</dt>
                <dd>
                  <strong class="ui-num">{{ perdas.cancelamento.taxa }}</strong>
                  <span v-if="perdas.cancelamento.base">{{ perdas.cancelamento.base }}</span>
                  <small>{{ perdas.cancelamento.prazo }}</small>
                  <small v-if="perdas.cancelamento.diarias">{{
                    perdas.cancelamento.diarias
                  }}</small>
                </dd>
              </div>
              <div class="perda">
                <dt>{{ t('resumoDoHotel.perdas.naoComparecimento') }}</dt>
                <dd>
                  <strong class="ui-num perda__valor">
                    <i
                      v-if="perdas.naoComparecimento.atencao"
                      class="ph ph-warning"
                      aria-hidden="true"
                    />
                    {{ perdas.naoComparecimento.taxa }}
                  </strong>
                  <span v-if="perdas.naoComparecimento.base">{{
                    perdas.naoComparecimento.base
                  }}</span>
                  <small v-if="perdas.naoComparecimento.diarias">{{
                    perdas.naoComparecimento.diarias
                  }}</small>
                </dd>
              </div>
              <p v-if="perdas.obito" class="perdas__obito">{{ perdas.obito }}</p>
            </dl>
          </section>

          <section class="painel painel--rosa ui-folha" aria-labelledby="rh-origem">
            <header class="painel__cabeca">
              <span class="ui-ladrilho ui-ladrilho--dado" aria-hidden="true">
                <i class="ph ph-signpost" />
              </span>
              <span class="painel__titulos">
                <h2 id="rh-origem">{{ t('resumoDoHotel.origem.titulo') }}</h2>
                <span class="painel__descricao">{{ t('resumoDoHotel.origem.descricao') }}</span>
              </span>
            </header>
            <div class="relatorio__recheio">
              <ClinicChartRanking :fatias="porOrigem" :vazio="t('resumoDoHotel.origem.vazio')" />
            </div>
          </section>
        </div>

        <section
          v-if="resumo.ocorrenciasDisponiveis"
          class="painel painel--barro ui-folha"
          aria-labelledby="rh-ocorrencias"
        >
          <header class="painel__cabeca">
            <span class="ui-ladrilho ui-ladrilho--dado" aria-hidden="true">
              <i class="ph ph-flag" />
            </span>
            <span class="painel__titulos">
              <h2 id="rh-ocorrencias">{{ t('resumoDoHotel.ocorrencias.titulo') }}</h2>
            </span>
          </header>
          <div class="relatorio__recheio">
            <p v-if="resumo.ocorrenciasFalhou" class="relatorio__nota">
              {{ t('resumoDoHotel.ocorrencias.falhou') }}
            </p>
            <ClinicChartRanking
              v-else
              :fatias="ocorrencias.fatias"
              :escrever-valor="ocorrencias.escrever"
              :vazio="t('resumoDoHotel.ocorrencias.vazio')"
            />
            <p v-if="gravesDoProprioAutor > 0" class="relatorio__nota">
              <i class="ph ph-eye" aria-hidden="true" />
              {{
                t(
                  'resumoDoHotel.ocorrencias.doProprioAutor',
                  { n: gravesDoProprioAutor },
                  gravesDoProprioAutor,
                )
              }}
            </p>
          </div>
        </section>
      </template>

      <template v-if="receita">
        <section class="painel painel--salvia ui-folha" aria-labelledby="rh-receita">
          <header class="painel__cabeca">
            <span class="ui-ladrilho ui-ladrilho--dado" aria-hidden="true">
              <i class="ph ph-receipt" />
            </span>
            <span class="painel__titulos">
              <h2 id="rh-receita">{{ t('resumoDoHotel.receita.titulo') }}</h2>
              <span class="painel__descricao">{{
                pelaReserva
                  ? `${t('resumoDoHotel.receita.descricao')} ${t('resumoDoHotel.receita.pelaReserva')}`
                  : t('resumoDoHotel.receita.descricao')
              }}</span>
            </span>
          </header>
          <div class="relatorio__recheio receita">
            <dl class="valores">
              <div v-for="numero in numerosDaReceita" :key="numero.id" class="valor">
                <dt>{{ numero.rotulo }}</dt>
                <dd>
                  <strong class="ui-num">{{ numero.valor }}</strong>
                  <small>{{ numero.nota }}</small>
                </dd>
              </div>
            </dl>

            <div class="receita__rankings">
              <div class="receita__ranking">
                <h3>{{ t('resumoDoHotel.receita.porOrigem') }}</h3>
                <ClinicChartRanking
                  :fatias="receitaPorOrigem"
                  :escrever-valor="dinheiroDaFatia"
                  :vazio="t('resumoDoHotel.receita.vazio')"
                />
              </div>
              <div class="receita__ranking">
                <h3>{{ t('resumoDoHotel.receita.porServico') }}</h3>
                <p v-if="receita.porServicoFalhou" class="relatorio__nota">
                  {{ t('resumoDoHotel.receita.servicosFalharam') }}
                </p>
                <ClinicChartRanking
                  v-else
                  :fatias="receitaPorServico"
                  :escrever-valor="dinheiroDaFatia"
                  :vazio="t('resumoDoHotel.receita.semServicos')"
                />
              </div>
            </div>
          </div>
        </section>

        <section class="painel painel--lavanda ui-folha" aria-labelledby="rh-sinal">
          <header class="painel__cabeca">
            <span class="ui-ladrilho ui-ladrilho--dado" aria-hidden="true">
              <i class="ph ph-hand-coins" />
            </span>
            <span class="painel__titulos">
              <h2 id="rh-sinal">{{ t('resumoDoHotel.receita.sinalTitulo') }}</h2>
              <span class="painel__descricao">{{ t('resumoDoHotel.receita.informativo') }}</span>
            </span>
          </header>
          <dl class="relatorio__recheio valores valores--sinal">
            <div v-for="linha in sinal" :key="linha.id" class="valor">
              <dt>{{ linha.rotulo }}</dt>
              <dd>
                <strong class="ui-num">{{ linha.valor }}</strong>
                <small>{{ linha.nota }}</small>
                <small class="valor__ajuda">{{ linha.ajuda }}</small>
              </dd>
            </div>
          </dl>
        </section>
      </template>
    </div>

    <CadastroGaveta
      v-model:visible="gavetaAberta"
      :titulo="t('resumoDoHotel.outro.titulo')"
      icone="ph ph-calendar-dots"
      largura="30rem"
    >
      <form id="resumo-outro-periodo" class="eg" novalidate @submit.prevent="aplicarIntervalo">
        <section class="eg__secao">
          <span id="rh-intervalo" class="eg__rotulo">{{ t('resumoDoHotel.outro.quando') }}</span>
          <DatePicker
            v-model="intervalo"
            selection-mode="range"
            inline
            :invalid="Boolean(erroDoIntervalo)"
            aria-labelledby="rh-intervalo"
          />
          <small class="eg__ajuda">{{
            diasNoIntervalo
              ? t('resumoDoHotel.outro.dias', { n: diasNoIntervalo }, diasNoIntervalo)
              : t('resumoDoHotel.outro.ajuda', { max: RESUMO_DO_HOTEL_MAX_DIAS })
          }}</small>
        </section>
        <p v-if="erroDoIntervalo" class="eg__erro" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ erroDoIntervalo }}</span>
        </p>
      </form>
      <template #pe>
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="t('cadastro.cancelar')"
          @click="gavetaAberta = false"
        />
        <Button
          type="submit"
          form="resumo-outro-periodo"
          icon="ph ph-check"
          :label="t('resumoDoHotel.outro.ver')"
        />
      </template>
    </CadastroGaveta>
  </UiPagina>
</template>

<style scoped>
.relatorio {
  display: grid;
  gap: 24px;
}

.relatorio__filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}

/* O intervalo do período, num selo de papel com o calendário: o "de quando" de todos os números. */
.relatorio__intervalo {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 8px;
  padding: 0 12px 0 10px;
  border: 1px solid var(--linha);
  border-radius: 999px;
  background: var(--superficie);
  box-shadow: var(--sombra-xs);
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.relatorio__intervalo i {
  color: var(--app-salvia-texto, var(--musgo));
  font-size: 16px;
}

.relatorio__aviso {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 0;
  padding: 10px 14px;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.relatorio__aviso i {
  flex: none;
  font-size: 18px;
}

.numeros {
  margin: 0;
  padding: 0;
  list-style: none;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

/* ------------------------------------------------------------------ os cartões */

/*
 * Cada cartão na cor do que mede: a ocupação e as perdas na do hotel (lavanda), a origem em rosa,
 * as ocorrências em barro, a receita na sálvia e o sinal na lavanda.
 */
.painel {
  --dado: var(--hotel);
  --dado-fundo-do-icone: var(--hotel-fundo);
  --dado-tinta-do-icone: var(--hotel-tinta);
  --ranking-cor: var(--dado);

  display: grid;
  min-width: 0;
  align-content: start;
  overflow: hidden;
}

.painel--salvia {
  --dado: var(--pets);
  --dado-fundo-do-icone: var(--pets-fundo);
  --dado-tinta-do-icone: var(--pets-tinta);
}

.painel--rosa {
  --dado: var(--dado-rosa);
  --dado-fundo-do-icone: var(--dado-rosa-fundo);
  --dado-tinta-do-icone: var(--dado-rosa-tinta);
}

.painel--barro {
  --dado: var(--dado-barro);
  --dado-fundo-do-icone: var(--dado-barro-fundo);
  --dado-tinta-do-icone: var(--dado-barro-tinta);
}

.painel .ui-ladrilho--dado {
  background: var(--dado-fundo-do-icone, var(--app-veu-forte));
  color: var(--dado-tinta-do-icone, var(--app-salvia-texto));
}

.painel__cabeca {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 22px 0 20px;
}

.painel__titulos {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.painel__titulos h2 {
  margin: 0;
  color: var(--tinta);
  font-size: 16px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.painel__descricao {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
}

.relatorio__recheio {
  margin: 0;
  padding: 18px 22px 22px 20px;
}

.relatorio__par {
  display: grid;
  align-items: start;
  gap: 24px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.relatorio__nota {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

/* ------------------------------------------------------------- a ocupação dia a dia */

.ocupacao {
  display: grid;
  gap: 14px;
}

.grafico {
  position: relative;
  display: grid;
  block-size: 200px;
  grid-template-columns: 40px minmax(0, 1fr);
}

.grafico__escala {
  position: absolute;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  inset: 0 0 22px;
}

.grafico__fio {
  position: relative;
  display: block;
  block-size: 0;
  border-top: 1px dashed var(--linha);
  margin-inline-start: 40px;
}

.grafico__fio:last-child {
  border-top-style: solid;
  border-top-color: var(--linha-forte);
}

.grafico__fio small {
  position: absolute;
  inset-block-start: -8px;
  inset-inline-start: -40px;
  color: var(--tinta-2);
  font-size: 11px;
}

.grafico__colunas {
  position: relative;
  display: grid;
  align-items: end;
  gap: 3px;
  grid-column: 2;
  grid-template-columns: repeat(var(--colunas), minmax(0, 1fr));
  padding-block-end: 22px;
}

.grafico__coluna {
  position: relative;
  display: flex;
  block-size: 100%;
  flex-direction: column;
  justify-content: flex-end;
}

.grafico__barra {
  display: block;
  border-radius: 6px 6px 2px 2px;
  background: color-mix(in oklab, var(--hotel) 45%, var(--superficie));
}

.grafico__barra--fim {
  background: var(--hotel);
}

/* O que ainda não aconteceu: contorno tracejado, sem tinta cheia. Fora da média. */
.grafico__barra--prevista {
  border: 1px dashed var(--hotel-tinta);
  background: transparent;
}

.app-dark .grafico__barra:not(.grafico__barra--fim, .grafico__barra--prevista),
.app-dark .legenda__cor:not(.legenda__cor--fim, .legenda__cor--prevista) {
  background: color-mix(in oklab, var(--hotel) 70%, var(--superficie));
}

.grafico__coluna:hover .grafico__barra:not(.grafico__barra--prevista) {
  background: var(--hotel-tinta);
}

.grafico__fechado {
  display: block;
  block-size: 2px;
  margin-inline: 25%;
  background: var(--linha-forte);
}

/* Embaixo da linha do zero, no respiro das colunas, centrado na barra. */
.grafico__rotulo {
  position: absolute;
  inset-block-start: calc(100% + 6px);
  inset-inline-start: 50%;
  color: var(--tinta-2);
  font-size: 11px;
  transform: translateX(-50%);
  white-space: nowrap;
}

[dir='rtl'] .grafico__rotulo {
  transform: translateX(50%);
}

.grafico__coluna--hoje .grafico__rotulo {
  color: var(--tinta);
  font-weight: 700;
}

.ocupacao__pe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 20px;
}

.legenda {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin: 0;
  padding: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
  list-style: none;
}

.legenda li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legenda__cor {
  inline-size: 12px;
  block-size: 12px;
  border-radius: 3px;
  background: color-mix(in oklab, var(--hotel) 45%, var(--superficie));
}

.legenda__cor--fim {
  background: var(--hotel);
}

.legenda__cor--prevista {
  border: 1px dashed var(--hotel-tinta);
  background: transparent;
}

.ocupacao__frase {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.ocupacao__frase i {
  color: var(--hotel-tinta);
  font-size: 18px;
}

.notas {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 12px 0 0;
  border-top: 1px solid var(--linha);
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
  list-style: none;
}

.notas li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.notas i {
  flex: none;
  margin-top: 1px;
  font-size: 16px;
}

/* ------------------------------------------------------------------------ perdas */

.perdas {
  display: grid;
  gap: 16px;
}

.perda {
  display: grid;
  gap: 4px;
}

.perda + .perda {
  padding-top: 16px;
  border-top: 1px solid var(--linha);
}

.perda dt,
.valor dt {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
}

.perda dd,
.valor dd {
  display: grid;
  gap: 2px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.perda small,
.valor small {
  font-size: inherit;
}

.perda strong,
.valor strong {
  color: var(--tinta);
  font-size: 18px;
  font-weight: 650;
}

.perda__valor {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.perda__valor i {
  color: var(--atencao-tinta, var(--tinta));
  font-size: 16px;
}

.perdas__obito {
  margin: 0;
  padding-top: 12px;
  border-top: 1px solid var(--linha);
  color: var(--tinta-2);
  font-size: 13px;
}

/* ---------------------------------------------------------------------- dinheiro */

.receita {
  display: grid;
  gap: 20px;
}

.valores {
  display: grid;
  gap: 16px 24px;
  margin: 0;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
}

.valores--sinal {
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
}

.valor {
  display: grid;
  align-content: start;
  gap: 4px;
}

.valor__ajuda {
  margin-top: 4px;
  line-height: 1.4;
}

.receita__rankings {
  display: grid;
  gap: 20px 32px;
  padding-top: 18px;
  border-top: 1px solid var(--linha);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.receita__ranking {
  display: grid;
  align-content: start;
  gap: 12px;
}

.receita__ranking h3 {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 650;
}

@media (max-width: 1100px) {
  .numeros {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .relatorio__par,
  .receita__rankings {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: no-preference) {
  .grafico__barra {
    transition: background-color 150ms ease-out;
  }
}
</style>
