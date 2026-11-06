<script setup lang="ts">
/**
 * Resumo da clínica pela rota `resumo` (E3-08, PJ-W2RB1D; guia e3 8.2 e 8.3).
 *
 * O mesmo desenho da demonstração, com a conta toda no servidor: nenhuma soma do resumo fica no
 * navegador. O que a guia pede e esta tela cumpre:
 *
 * - comparecimento e ocupação `null` são "sem dados", nunca 0%; a ocupação pode passar de 100%, e
 *   a tela mostra o número como veio, com a nota de que passou da capacidade;
 * - "horas agendadas" (a duração marcada dos finalizados), não tempo de relógio;
 * - `semDesfecho` à vista: os horários que ninguém fechou ficam fora do comparecimento;
 * - "atualizado às 10:42" quando a resposta veio da memória (`emCache`);
 * - o 400 de 20.000 atendimentos oferece o período que cabe (`diasQueCabem`);
 * - por profissional sem ranking: em ordem alfabética, sem destacar ninguém; sem `auditoria.ler`,
 *   só a linha de quem pede, e o filtro de profissional some;
 * - diagnósticos ausentes são "sem permissão", diferente de "sem dado".
 */
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDaAgenda } from '@/components/agendamentos/useFrasesDaAgenda'
import { hojeNoFuso } from '@/components/parceiro/estabelecimento/horario'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import ClinicToggleGroup from '@/features/clinico/components/base/ClinicToggleGroup.vue'
import ClinicChartColumns from '@/features/clinico/components/resumo/ClinicChartColumns.vue'
import ClinicChartRanking from '@/features/clinico/components/resumo/ClinicChartRanking.vue'
import ClinicHeatmap from '@/features/clinico/components/resumo/ClinicHeatmap.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import type { CelulaDeHora, Fatia, PontoDoDia } from '@/features/clinico/domain/resumo'
import { ApiError } from '@/service/api'
import { listarTipos } from '@/service/parceiro/agenda-config-service'
import {
  lerResumo,
  PERIODOS_DO_RESUMO,
  type FiltroDoResumo,
  type PeriodoDoPortal,
  type ResumoDaClinica,
} from '@/service/parceiro/painel-service'
import { listarProfissionais } from '@/service/parceiro/profissionais-service'
import { useParceiroStore } from '@/stores/parceiro'

const { t, te } = useI18n()
const formato = useClinicFormat()
const parceiro = useParceiroStore()
const { parceiroQuery } = useParceiroPortal()

const PERIODOS = Object.keys(PERIODOS_DO_RESUMO) as PeriodoDoPortal[]

const periodo = ref<PeriodoDoPortal>('semana')
/** O período menor que coube, depois do 400 de leitura excedida. */
const livre = ref<{ de: string; ate: string } | null>(null)
const profissionalId = ref<string | null>(null)
const tipoId = ref<string | null>(null)

const resposta = ref<ResumoDaClinica | null>(null)
const carregando = ref(false)
const erro = ref('')
const aviso = ref('')
/** "Esta clínica tem atendimentos demais para este período; tente N dias." */
const cabem = ref<number | null>(null)

const tipos = ref<{ id: string; nome: string }[]>([])
const profissionais = ref<{ id: string; nome: string }[]>([])

/** Filtrar por colega pede `auditoria.ler`; sem ela, o servidor já devolve só a própria linha. */
const podeFiltrarProfissional = computed(() => parceiro.temPermissao('auditoria.ler'))

const opcoesPeriodo = computed(() =>
  PERIODOS.map((valor) => ({ valor, rotulo: t(`clinico.resumo.periodo.${valor}`) })),
)

const opcoesProfissional = computed(() => [
  { valor: null, rotulo: t('clinico.resumo.filtro.todosProfissionais') },
  ...profissionais.value.map((item) => ({ valor: item.id, rotulo: item.nome })),
])

const opcoesTipo = computed(() => [
  { valor: null, rotulo: t('clinico.resumo.filtro.todosTipos') },
  ...tipos.value.map((item) => ({ valor: item.id, rotulo: item.nome })),
])

function filtro(): FiltroDoResumo {
  const comuns = { profissionalId: profissionalId.value, tipoId: tipoId.value }
  return livre.value ? { ...livre.value, ...comuns } : { periodo: periodo.value, ...comuns }
}

function esperar(segundos: number) {
  return new Promise((resolver) => setTimeout(resolver, Math.max(1, segundos) * 1000))
}

async function carregar(tentativa = 0): Promise<void> {
  carregando.value = true
  erro.value = ''
  aviso.value = ''
  cabem.value = null
  try {
    resposta.value = await lerResumo(filtro(), parceiroQuery())
  } catch (err) {
    const codigo = err instanceof ApiError ? err.codigo : undefined
    const detalhes = err instanceof ApiError ? err.detalhes : {}
    if (codigo === 'RESUMO_EM_ANDAMENTO' && tentativa === 0) {
      /* Outro resumo desta clínica está sendo feito: espera o que a API pede e tenta uma vez. */
      await esperar(Number(detalhes.tenteDeNovoEmSegundos ?? 2))
      return carregar(1)
    }
    if (codigo === 'RESUMO_LEITURA_EXCEDIDA' && typeof detalhes.diasQueCabem === 'number') {
      cabem.value = detalhes.diasQueCabem
      aviso.value = t('clinico.resumo.api.excedida', { dias: detalhes.diasQueCabem })
    } else if (resposta.value) {
      aviso.value = lerErroDaAgenda(err, t('clinico.erros.agenda')).mensagem
    } else {
      erro.value = lerErroDaAgenda(err, t('clinico.erros.agenda')).mensagem
    }
  } finally {
    carregando.value = false
  }
}

/** O período que coube: os últimos N dias até hoje, na parede da clínica. */
function verOQueCabe() {
  if (!cabem.value) return
  const fuso = resposta.value?.fuso ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const ate = hojeNoFuso(fuso)
  const [a, m, d] = ate.split('-').map(Number)
  const inicio = new Date(Date.UTC(a!, m! - 1, d! - (cabem.value - 1)))
  livre.value = { de: inicio.toISOString().slice(0, 10), ate }
  void carregar()
}

function trocarPeriodo(valor: PeriodoDoPortal) {
  livre.value = null
  periodo.value = valor
}

watch([periodo, profissionalId, tipoId], () => void carregar())

async function carregarFiltros() {
  try {
    const [listaDeTipos, listaDeProfissionais] = await Promise.all([
      listarTipos(parceiroQuery()),
      podeFiltrarProfissional.value ? listarProfissionais(parceiroQuery()) : Promise.resolve([]),
    ])
    tipos.value = listaDeTipos.map((tipo) => ({ id: tipo.id, nome: tipo.nome }))
    profissionais.value = listaDeProfissionais.map((p) => ({ id: p.id, nome: p.nome }))
  } catch {
    /* Sem as listas, os filtros ficam só com "todos": o resumo vale igual. */
  }
}

onMounted(() => {
  void carregarFiltros()
  void carregar()
})

/* ------------------------------------------------------------------------------- leitura */

const indicadores = computed(() => resposta.value?.indicadores ?? null)

const intervaloLegivel = computed(() => {
  const lido = resposta.value
  if (!lido) return ''
  const { inicio, fim } = lido.intervalo
  const periodoTexto =
    inicio === fim
      ? formato.dataLonga(inicio)
      : t('clinico.resumo.intervalo', {
          inicio: formato.dataCurta(inicio),
          fim: formato.dataCurta(fim),
        })
  return lido.emCache
    ? `${periodoTexto} · ${t('clinico.resumo.api.atualizadoAs', { hora: lido.geradoEm.slice(11, 16) })}`
    : periodoTexto
})

const semMovimento = computed(() => Boolean(indicadores.value) && indicadores.value!.total === 0)

const fraseDoResumo = computed(() => {
  if (!indicadores.value) return ''
  const n = indicadores.value.finalizados
  return livre.value
    ? t('clinico.resumo.api.saudacaoLivre', { n, dias: resposta.value!.intervalo.dias }, n)
    : t(`clinico.resumo.saudacao.${periodo.value}`, { n }, n)
})

const comparecimentoBaixo = computed(() => {
  const ind = indicadores.value
  return Boolean(ind && ind.comparecimento !== null && ind.faltas > 0 && ind.comparecimento < 0.85)
})

const numeros = computed(() => {
  const ind = indicadores.value
  if (!ind) return []
  const semDados = t('clinico.resumo.api.semDados')
  return [
    {
      id: 'comparecimento',
      icone: 'ph ph-user-check',
      valor: ind.comparecimento === null ? semDados : formato.percentual(ind.comparecimento),
      rotulo: t('clinico.resumo.indicador.comparecimento'),
      nota: t('clinico.resumo.indicador.faltasNoPeriodo', { contagem: ind.faltas }, ind.faltas),
      atencao: comparecimentoBaixo.value,
    },
    {
      id: 'horas',
      icone: 'ph ph-timer',
      valor: `${formato.numero(ind.horasAgendadas, 1)} h`,
      rotulo: t('clinico.resumo.api.horasAgendadas'),
      nota: t('clinico.resumo.api.horasAgendadasNota'),
      atencao: false,
    },
    {
      id: 'ocupacao',
      icone: 'ph ph-chart-pie-slice',
      valor: ind.ocupacaoMedia === null ? semDados : formato.percentual(ind.ocupacaoMedia),
      rotulo: t('clinico.resumo.indicador.ocupacao'),
      nota:
        ind.ocupacaoMedia !== null && ind.ocupacaoMedia > 1
          ? t('clinico.resumo.api.acimaDaCapacidade')
          : t('clinico.resumo.indicador.ocupacaoDetalhe'),
      atencao: false,
    },
    {
      id: 'novos',
      icone: 'ph ph-paw-print',
      valor: String(ind.novosPacientes),
      rotulo: t('clinico.resumo.indicador.novos'),
      nota: t('clinico.resumo.indicador.encaixes', { contagem: ind.encaixes }, ind.encaixes),
      atencao: false,
    },
  ]
})

/** O gráfico da demonstração lê `ocupacao` como número: o dia sem capacidade já vem `fechado`. */
const porDia = computed<PontoDoDia[]>(() =>
  (resposta.value?.porDia ?? []).map((ponto) => ({
    data: ponto.data,
    finalizados: ponto.finalizados,
    previstos: ponto.previstos,
    faltas: ponto.faltas,
    cancelados: ponto.cancelados,
    ocupacao: ponto.ocupacao ?? 0,
    fechado: ponto.fechado,
  })),
)

const rotulosDosDias = computed(() =>
  porDia.value.map((ponto, indice) =>
    porDia.value.length <= 14
      ? formato.diaDaSemanaCurto(ponto.data)
      : indice % 3 === 0
        ? formato.dataCurta(ponto.data)
        : '',
  ),
)

const hoje = computed(() =>
  hojeNoFuso(resposta.value?.fuso ?? Intl.DateTimeFormat().resolvedOptions().timeZone),
)

/** A ocupação em frase: a média e o dia mais cheio, como veio (pode passar de 100%). */
const fraseDaOcupacao = computed(() => {
  const ind = indicadores.value
  if (!ind || ind.ocupacaoMedia === null) return ''
  const abertos = (resposta.value?.porDia ?? []).filter(
    (ponto) => !ponto.fechado && ponto.ocupacao !== null && ponto.ocupacao > 0,
  )
  if (!abertos.length) return ''
  const media = formato.percentual(ind.ocupacaoMedia)
  if (abertos.length < 2) return t('clinico.resumo.ocupacao.media', { media })
  const cheio = abertos.reduce((maior, ponto) =>
    (ponto.ocupacao ?? 0) > (maior.ocupacao ?? 0) ? ponto : maior,
  )
  return t('clinico.resumo.ocupacao.comPico', {
    media,
    dia: `${formato.diaDaSemanaCurto(cheio.data)} ${formato.dataCurta(cheio.data)}`,
    valor: formato.percentual(cheio.ocupacao ?? 0),
  })
})

function comOutros(fatias: Fatia[]) {
  return fatias.map((fatia) =>
    fatia.id === 'OUTROS' ? { ...fatia, rotulo: t('clinico.resumo.api.outros') } : fatia,
  )
}

const porTipo = computed(() => comOutros(resposta.value?.porTipo ?? []))

/** Sem ranking: por nome, com "Outros" no fim. */
const porProfissional = computed(() =>
  comOutros(resposta.value?.porProfissional ?? []).sort((a, b) =>
    a.id === 'OUTROS' ? 1 : b.id === 'OUTROS' ? -1 : a.rotulo.localeCompare(b.rotulo),
  ),
)

const porOrigem = computed(() =>
  comOutros(resposta.value?.porOrigem ?? []).map((fatia) => {
    const chave = `clinico.origem.${fatia.id.toLowerCase()}`
    return fatia.id !== 'OUTROS' && te(chave) ? { ...fatia, rotulo: t(chave) } : fatia
  }),
)

const porHora = computed<CelulaDeHora[]>(() =>
  (resposta.value?.porHora ?? []).map((celula) => ({
    weekday: celula.diaSemana,
    hora: celula.hora,
    valor: celula.valor,
  })),
)

/** Segunda a domingo. */
const diasDaSemana = computed(() =>
  [1, 2, 3, 4, 5, 6, 0].map((dia) => formato.diaDaSemanaCurtoPorIndice(dia)),
)

/** A chave ausente é falta de permissão (`prontuario.ler`), diferente de "nenhum diagnóstico". */
const diagnosticos = computed(() => {
  const lidos = resposta.value?.diagnosticos
  if (!lidos) return null
  return {
    fatias: lidos.itens.map((fatia) =>
      fatia.id === 'SEM_CODIGO' ? { ...fatia, rotulo: t('clinico.resumo.api.semCodigo') } : fatia,
    ),
    notas: [
      lidos.semDiagnostico
        ? t('clinico.resumo.api.semDiagnostico', { n: lidos.semDiagnostico }, lidos.semDiagnostico)
        : '',
      lidos.avulsos ? t('clinico.resumo.api.avulsos', { n: lidos.avulsos }, lidos.avulsos) : '',
    ].filter(Boolean),
  }
})
</script>

<template>
  <UiPagina
    :resumo="fraseDoResumo"
    :carregando="carregando && !resposta"
    :erro="erro"
    bloquear-se-suspenso
    @tentar-de-novo="carregar()"
  >
    <div class="relatorio clinic-scope" :aria-busy="carregando">
      <div class="relatorio__filtros">
        <ClinicToggleGroup
          :model-value="livre ? '' : periodo"
          :opcoes="opcoesPeriodo"
          :rotulo="t('clinico.resumo.periodo.rotulo')"
          @update:model-value="trocarPeriodo($event as PeriodoDoPortal)"
        />

        <span v-if="intervaloLegivel" class="relatorio__intervalo">
          <i class="ph ph-calendar-blank" aria-hidden="true" />
          <span class="relatorio__intervalo-texto">{{ intervaloLegivel }}</span>
        </span>

        <div class="relatorio__selects">
          <Select
            v-if="podeFiltrarProfissional"
            v-model="profissionalId"
            option-label="rotulo"
            option-value="valor"
            :options="opcoesProfissional"
            :placeholder="t('clinico.resumo.filtro.todosProfissionais')"
            :aria-label="t('clinico.resumo.filtro.todosProfissionais')"
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
          <Select
            v-model="tipoId"
            option-label="rotulo"
            option-value="valor"
            :options="opcoesTipo"
            :placeholder="t('clinico.resumo.filtro.todosTipos')"
            :aria-label="t('clinico.resumo.filtro.todosTipos')"
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
        </div>
      </div>

      <!-- O 400 de 20.000 atendimentos (o período que cabe) e o erro de uma releitura. -->
      <p v-if="aviso" class="relatorio__aviso ui-poco" role="status">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ aviso }}</span>
        <Button
          v-if="cabem"
          type="button"
          size="small"
          severity="secondary"
          outlined
          :label="t('clinico.resumo.api.verDias', { dias: cabem })"
          @click="verOQueCabe"
        />
      </p>

      <template v-if="indicadores">
        <p v-if="semMovimento" class="ui-folha ui-vazio relatorio__vazio">
          <strong>{{ t('clinico.resumo.semMovimento') }}</strong>
        </p>

        <template v-else>
          <ul class="ui-indicadores numeros" :aria-label="t('clinico.resumo.fatos.aria')">
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
              <strong class="ui-indicador__valor ui-num numero__valor">
                <i
                  v-if="numero.atencao"
                  class="ph ph-warning"
                  :title="t('clinico.resumo.fatos.comparecimentoBaixo')"
                  :aria-label="t('clinico.resumo.fatos.comparecimentoBaixo')"
                />
                {{ numero.valor }}
              </strong>
              <span class="ui-indicador__rotulo">{{ numero.rotulo }}</span>
              <span class="ui-indicador__nota">{{ numero.nota }}</span>
            </li>
          </ul>

          <!-- Horários que ninguém fechou: ficam fora do comparecimento e da falta. -->
          <p v-if="indicadores.semDesfecho" class="relatorio__aviso ui-poco">
            <i class="ph ph-question" aria-hidden="true" />
            <span>{{
              t(
                'clinico.resumo.api.semDesfecho',
                { n: indicadores.semDesfecho },
                indicadores.semDesfecho,
              )
            }}</span>
          </p>

          <section
            id="resumo-por-dia"
            class="painel painel--salvia ui-folha"
            aria-labelledby="resumo-por-dia-titulo"
          >
            <header class="painel__cabeca">
              <span class="ui-ladrilho ui-ladrilho--dado" aria-hidden="true">
                <i class="ph ph-chart-bar" />
              </span>
              <span class="painel__titulos">
                <h2 id="resumo-por-dia-titulo">{{ t('clinico.resumo.grafico.porDia') }}</h2>
                <span class="painel__descricao">{{ t('clinico.resumo.grafico.porDiaAjuda') }}</span>
              </span>
            </header>

            <div class="relatorio__grafico">
              <ClinicChartColumns
                :pontos="porDia"
                :rotulos="rotulosDosDias"
                :destaque="hoje"
                :rotulo-destaque="t('clinico.resumo.periodo.hoje')"
                :mostrar-ocupacao="false"
                :legenda="{
                  finalizados: t('clinico.resumo.legenda.finalizados'),
                  previstos: t('clinico.resumo.legenda.previstos'),
                  faltas: t('clinico.resumo.legenda.faltas'),
                  ocupacao: t('clinico.resumo.legenda.ocupacao'),
                  fechado: t('clinico.resumo.legenda.fechado'),
                }"
              />

              <p v-if="fraseDaOcupacao" class="relatorio__ocupacao ui-poco">
                <i class="ph ph-calendar-check" aria-hidden="true" />
                {{ fraseDaOcupacao }}
              </p>
            </div>
          </section>

          <div class="relatorio__par">
            <section
              id="resumo-por-tipo"
              class="painel painel--tipo ui-folha"
              aria-labelledby="resumo-por-tipo-titulo"
            >
              <header class="painel__cabeca">
                <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-stethoscope" /></span>
                <span class="painel__titulos">
                  <h2 id="resumo-por-tipo-titulo">{{ t('clinico.resumo.grafico.porTipo') }}</h2>
                </span>
              </header>
              <div class="relatorio__recheio">
                <ClinicChartRanking :fatias="porTipo" :vazio="t('clinico.resumo.semDados')" />
              </div>
            </section>

            <section
              id="resumo-por-profissional"
              class="painel painel--lavanda ui-folha"
              aria-labelledby="resumo-por-profissional-titulo"
            >
              <header class="painel__cabeca">
                <span class="ui-ladrilho ui-ladrilho--dado" aria-hidden="true">
                  <i class="ph ph-users" />
                </span>
                <span class="painel__titulos">
                  <h2 id="resumo-por-profissional-titulo">
                    {{ t('clinico.resumo.grafico.porProfissional') }}
                  </h2>
                  <span
                    v-if="resposta && !resposta.porProfissionalCompleto"
                    class="painel__descricao"
                  >
                    {{ t('clinico.resumo.api.soASuaLinha') }}
                  </span>
                </span>
              </header>
              <div class="relatorio__recheio">
                <ClinicChartRanking
                  :fatias="porProfissional"
                  :ordenada="false"
                  :vazio="t('clinico.resumo.semDados')"
                />
              </div>
            </section>
          </div>

          <div class="relatorio__par">
            <section
              id="resumo-horarios"
              class="painel painel--salvia ui-folha"
              aria-labelledby="resumo-horarios-titulo"
            >
              <header class="painel__cabeca">
                <span class="ui-ladrilho ui-ladrilho--dado" aria-hidden="true">
                  <i class="ph ph-clock" />
                </span>
                <span class="painel__titulos">
                  <h2 id="resumo-horarios-titulo">{{ t('clinico.resumo.grafico.horarios') }}</h2>
                  <span class="painel__descricao">{{
                    t('clinico.resumo.grafico.horariosAjuda')
                  }}</span>
                </span>
              </header>
              <div class="relatorio__recheio">
                <ClinicHeatmap
                  :celulas="porHora"
                  :pico="resposta?.picoDaHora ?? 0"
                  :dias="diasDaSemana"
                  :vazio="t('clinico.resumo.semDados')"
                />
              </div>
            </section>

            <div class="relatorio__coluna">
              <section
                id="resumo-origem"
                class="painel painel--rosa ui-folha"
                aria-labelledby="resumo-origem-titulo"
              >
                <header class="painel__cabeca">
                  <span class="ui-ladrilho ui-ladrilho--dado" aria-hidden="true">
                    <i class="ph ph-signpost" />
                  </span>
                  <span class="painel__titulos">
                    <h2 id="resumo-origem-titulo">{{ t('clinico.resumo.grafico.porOrigem') }}</h2>
                  </span>
                </header>
                <div class="relatorio__recheio">
                  <ClinicChartRanking :fatias="porOrigem" :vazio="t('clinico.resumo.semDados')" />
                </div>
              </section>

              <section
                id="resumo-diagnosticos"
                class="painel painel--barro ui-folha"
                aria-labelledby="resumo-diagnosticos-titulo"
              >
                <header class="painel__cabeca">
                  <span class="ui-ladrilho ui-ladrilho--dado" aria-hidden="true">
                    <i class="ph ph-clipboard-text" />
                  </span>
                  <span class="painel__titulos">
                    <h2 id="resumo-diagnosticos-titulo">
                      {{ t('clinico.resumo.grafico.diagnosticos') }}
                    </h2>
                  </span>
                </header>
                <div class="relatorio__recheio">
                  <p v-if="!diagnosticos" class="relatorio__nota">
                    {{ t('clinico.resumo.api.diagnosticosSemPermissao') }}
                  </p>
                  <template v-else>
                    <ClinicChartRanking
                      :fatias="diagnosticos.fatias"
                      :vazio="t('clinico.resumo.semProntuario')"
                    />
                    <p v-for="nota in diagnosticos.notas" :key="nota" class="relatorio__nota">
                      {{ nota }}
                    </p>
                  </template>
                </div>
              </section>
            </div>
          </div>
        </template>
      </template>
    </div>
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

.relatorio__intervalo-texto {
  display: inline-block;
}

.relatorio__intervalo-texto::first-letter {
  text-transform: uppercase;
}

.relatorio__selects {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-inline-start: auto;
}

.relatorio__selects :deep(.p-select) {
  min-width: 13rem;
}

.relatorio__vazio {
  padding: 32px 24px;
}

/* Os quatro indicadores numa fileira; o número com o ícone de atenção, quando há. */
.numeros {
  margin: 0;
  padding: 0;
  list-style: none;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.numero__valor {
  display: flex;
  align-items: center;
  gap: 8px;
}

.numero__valor i {
  font-size: 22px;
}

/* ------------------------------------------------------------------ os cartões dos gráficos */

/*
 * Cada gráfico na cor do que mede, no ícone e nas marcas: o dia e os horários na sálvia, os
 * profissionais em lavanda, a origem em rosa, os diagnósticos em barro; o tipo, na cor de cada
 * tipo. Antes tudo saía no azul da Clínica, e os cinco gráficos liam como um só.
 */
/* Os tipos no claro são tons médios (feitos para traço e ícone): na barra, clareados a pastel. */
.painel--tipo {
  --ranking-pastel: 68%;
}

.app-dark .painel--tipo {
  --ranking-pastel: 100%;
}

.painel--salvia {
  --dado: var(--pets);
  --dado-fundo-do-icone: var(--pets-fundo);
  --dado-tinta-do-icone: var(--pets-tinta);
}

.painel--lavanda {
  --dado: var(--hotel);
  --dado-fundo-do-icone: var(--hotel-fundo);
  --dado-tinta-do-icone: var(--hotel-tinta);
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

.painel {
  --ranking-cor: var(--dado);
  --mapa-cor: var(--dado);

  display: grid;
  min-width: 0;
  align-content: start;
  overflow: hidden;
}

/* O ícone da seção no fundo e na tinta da cor do gráfico. */
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

.relatorio__grafico {
  display: grid;
  gap: 12px;
  padding: 10px 16px 18px;
}

/* A frase da ocupação num poço, embaixo do gráfico: apoia, não compete. */
.relatorio__ocupacao {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 4px;
  padding: 10px 14px;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.relatorio__ocupacao i {
  flex: none;
  color: var(--app-salvia-texto, var(--musgo));
  font-size: 18px;
}

.relatorio__par {
  display: grid;
  align-items: start;
  gap: 24px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.relatorio__coluna {
  display: grid;
  gap: 24px;
}

.relatorio__recheio {
  padding: 18px 22px 22px 20px;
}

@media (max-width: 1100px) {
  .numeros {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .relatorio__par {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .relatorio__selects {
    width: 100%;
    margin-inline-start: 0;
  }

  .relatorio__selects :deep(.p-select) {
    flex: 1;
    min-width: 0;
  }
}

@media (max-width: 359px) {
  .numeros {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* O período que coube, o erro de uma releitura e os horários sem desfecho: um poço, como a ocupação. */
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

.relatorio__nota {
  margin: 10px 0 0;
  color: var(--tinta-2);
  font-size: 13px;
}
</style>
