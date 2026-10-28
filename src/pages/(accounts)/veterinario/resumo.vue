<script setup lang="ts">
/**
 * Resumo da clínica.
 *
 * A tela responde, em ordem, as perguntas que um dono de clínica faz na segunda de manhã:
 * quanto atendemos, quanto do que foi marcado aconteceu, quanto da agenda ficou parado, e onde
 * o movimento se concentra.
 *
 * Três escolhas que valem dizer em voz alta:
 *
 * - **Cancelado não entra na taxa de comparecimento.** Quem avisou liberou o horário; quem não
 *   apareceu queimou. Somar os dois faz o número parecer pior do que é e a clínica para de
 *   confiar no painel.
 * - **O período é do filtro, não da tela.** Todos os gráficos leem o mesmo recorte, então não
 *   existe o clássico "o cartão diz uma coisa e a barra diz outra".
 * - **Ocupação é média dos dias abertos.** Incluir feriado e domingo no divisor derruba a média
 *   e faz a semana cheia parecer folgada.
 */
import Select from 'primevue/select'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import UiPagina from '@/components/ui/UiPagina.vue'
import ClinicToggleGroup from '@/features/clinico/components/base/ClinicToggleGroup.vue'
import ClinicChartColumns from '@/features/clinico/components/resumo/ClinicChartColumns.vue'
import ClinicChartRanking from '@/features/clinico/components/resumo/ClinicChartRanking.vue'
import ClinicHeatmap from '@/features/clinico/components/resumo/ClinicHeatmap.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { agendaRepository } from '@/features/clinico/data/repositories'
import type { Appointment, Clinic, Encounter } from '@/features/clinico/data/types'
import { aparenciaDoTipo } from '@/features/clinico/domain/appointment-kind'
import { addDays } from '@/features/clinico/domain/clinic-time'
import {
  FILTRO_RESUMO_PADRAO,
  inicioDaSemana,
  intervaloDoPeriodo,
  PERIODOS,
  resumirClinica,
  type Fatia,
  type PeriodoId,
  type ResumoFiltro,
} from '@/features/clinico/domain/resumo'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'

const { t } = useI18n()
const clinico = useClinicoStore()

/** O ranking por tipo pinta cada barra com a cor do tipo, a mesma da agenda e da legenda. */
function corDoTipo(fatia: Fatia) {
  const tipo = clinico.tipo(fatia.id)

  return tipo ? aparenciaDoTipo(tipo.kind).cor : undefined
}
const formato = useClinicFormat()

const filtro = ref<ResumoFiltro>({ ...FILTRO_RESUMO_PADRAO })
const atendimentos = ref<Appointment[]>([])
const prontuarios = ref<Encounter[]>([])
const carregando = ref(false)
const erro = ref('')

const hoje = computed(() => clinicClock.today())

const opcoesPeriodo = computed(() =>
  PERIODOS.map((periodo) => ({
    valor: periodo,
    rotulo: t(`clinico.resumo.periodo.${periodo}`),
  })),
)

const opcoesProfissional = computed(() => [
  { valor: null, rotulo: t('clinico.resumo.filtro.todosProfissionais') },
  ...clinico.profissionais.map((item) => ({ valor: item.id, rotulo: item.nome })),
])

const opcoesTipo = computed(() => [
  { valor: null, rotulo: t('clinico.resumo.filtro.todosTipos') },
  ...clinico.tipos.map((item) => ({ valor: item.id, rotulo: item.nome })),
])

/** Enquanto o catálogo não chegou, a clínica vazia zera a capacidade — e a ocupação sai 0%. */
const clinicaOuVazia = computed<Clinic>(
  () =>
    clinico.clinic ?? {
      id: '',
      nome: '',
      endereco: '',
      telefone: '',
      utcOffset: clinicClock.utcOffset,
      horarios: [],
      feriados: [],
      slotMinutos: 15,
    },
)

const resumo = computed(() =>
  resumirClinica({
    appointments: atendimentos.value,
    encounters: prontuarios.value,
    clinic: clinicaOuVazia.value,
    profissionais: clinico.profissionais,
    tipos: clinico.tipos,
    diagnosticos: clinico.diagnosticos,
    filtro: filtro.value,
    ancora: hoje.value,
    clock: clinicClock,
  }),
)

/**
 * Trinta colunas com "seg, ter, qua…" repetido quatro vezes não localiza nada; nesse período o
 * eixo passa a mostrar o dia do mês, e só de três em três para o texto não colidir.
 */
const rotulosDosDias = computed(() =>
  resumo.value.porDia.map((ponto, indice) => {
    if (filtro.value.periodo !== 'trinta-dias') {
      return formato.diaDaSemanaCurto(ponto.data)
    }

    return indice % 3 === 0 ? formato.dataCurta(ponto.data) : ''
  }),
)

/** Segunda a domingo, nomeados a partir da semana corrente — sem tabela fixa de rótulos. */
const diasDaSemana = computed(() => {
  const segunda = inicioDaSemana(hoje.value)

  return [0, 1, 2, 3, 4, 5, 6].map((deslocamento) =>
    formato.diaDaSemanaCurto(addDays(segunda, deslocamento)),
  )
})

const intervaloLegivel = computed(() => {
  const { inicio, fim } = resumo.value.intervalo

  return inicio === fim
    ? formato.dataLonga(inicio)
    : t('clinico.resumo.intervalo', {
        inicio: formato.dataCurta(inicio),
        fim: formato.dataCurta(fim),
      })
})

const semMovimento = computed(
  () =>
    !carregando.value &&
    !erro.value &&
    resumo.value.indicadores.finalizados === 0 &&
    resumo.value.indicadores.previstos === 0 &&
    resumo.value.indicadores.faltas === 0,
)

/**
 * A frase da saudação: quantos atendimentos o período fechou. É o número que o dono da clínica
 * procura primeiro; os outros ficam na linha de fatos logo abaixo.
 */
const fraseDoResumo = computed(() => {
  if (erro.value || (carregando.value && atendimentos.value.length === 0)) {
    return ''
  }

  const n = resumo.value.indicadores.finalizados

  return t(`clinico.resumo.saudacao.${filtro.value.periodo}`, { n }, n)
})

/** Abaixo de 85% a falta já pesa na agenda: o fato ganha o ícone de atenção. */
const comparecimentoBaixo = computed(
  () => resumo.value.indicadores.faltas > 0 && resumo.value.indicadores.comparecimento < 0.85,
)

/**
 * A ocupação em frase: a média e o dia mais cheio. Era uma linha num segundo eixo, por cima das
 * colunas — duas perguntas num gráfico só, e a escala da direita competindo com a da esquerda.
 */
const fraseDaOcupacao = computed(() => {
  const abertos = resumo.value.porDia.filter((ponto) => !ponto.fechado && ponto.ocupacao > 0)

  if (abertos.length === 0) {
    return ''
  }

  const media = formato.percentual(resumo.value.indicadores.ocupacaoMedia)

  if (abertos.length < 2) {
    return t('clinico.resumo.ocupacao.media', { media })
  }

  const cheio = abertos.reduce((maior, ponto) => (ponto.ocupacao > maior.ocupacao ? ponto : maior))

  return t('clinico.resumo.ocupacao.comPico', {
    media,
    dia: `${formato.diaDaSemanaCurto(cheio.data)} ${formato.dataCurta(cheio.data)}`,
    valor: formato.percentual(Math.min(1, cheio.ocupacao)),
  })
})

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()

    /*
     * Os gráficos usam só o período escolhido (`resumirClinica` recorta), mas os "novos
     * pacientes" precisam do que veio antes para saber se o primeiro atendimento do bicho foi
     * mesmo neste período. Buscando só a semana, todo paciente que veio na semana "estreava"
     * nela: a tela dizia 24 pacientes novos numa clínica de 29. Um ano para trás cobre quem
     * volta uma vez por ano (a vacina anual) sem trazer o histórico inteiro.
     */
    const janela = intervaloDoPeriodo(filtro.value.periodo, hoje.value)
    const dados = await agendaRepository.obterIntervalo(addDays(janela.inicio, -365), janela.fim)

    atendimentos.value = dados.atendimentos
    prontuarios.value = dados.prontuarios
  } catch {
    erro.value = t('clinico.erros.agenda')
  } finally {
    carregando.value = false
  }
}

watch(() => filtro.value.periodo, carregar)

onMounted(carregar)

/** De onde vêm os atendimentos — app, link, telefone, balcão —, com o nome de cada canal. */
const porOrigem = computed(() =>
  resumo.value.porOrigem.map((fatia) => ({ ...fatia, rotulo: t(`clinico.origem.${fatia.id}`) })),
)

/** Os números do período, na ordem em que o dono da clínica os lê. */
const numeros = computed(() => {
  const indicadores = resumo.value.indicadores
  const lista = [
    {
      id: 'comparecimento',
      icone: 'ph ph-user-check',
      valor: formato.percentual(indicadores.comparecimento),
      rotulo: t('clinico.resumo.indicador.comparecimento'),
      nota: t(
        'clinico.resumo.indicador.faltasNoPeriodo',
        { contagem: indicadores.faltas },
        indicadores.faltas,
      ),
      atencao: comparecimentoBaixo.value,
    },
    {
      id: 'horas',
      icone: 'ph ph-timer',
      valor: `${formato.numero(indicadores.horasAtendidas, 1)} h`,
      rotulo: t('clinico.resumo.numero.horas'),
      nota: t('clinico.resumo.numero.horasNota'),
      atencao: false,
    },
    {
      id: 'ocupacao',
      icone: 'ph ph-chart-pie-slice',
      valor: formato.percentual(indicadores.ocupacaoMedia),
      rotulo: t('clinico.resumo.indicador.ocupacao'),
      nota: t('clinico.resumo.indicador.ocupacaoDetalhe'),
      atencao: false,
    },
    {
      id: 'novos',
      icone: 'ph ph-paw-print',
      valor: String(indicadores.novosPacientes),
      rotulo: t('clinico.resumo.indicador.novos'),
      nota: t(
        'clinico.resumo.indicador.encaixes',
        { contagem: indicadores.encaixes },
        indicadores.encaixes,
      ),
      atencao: false,
    },
  ]

  return lista
})

function trocarPeriodo(periodo: PeriodoId) {
  filtro.value = { ...filtro.value, periodo }
}
</script>

<template>
  <UiPagina
    :resumo="fraseDoResumo"
    :carregando="carregando && atendimentos.length === 0"
    :erro="erro"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
  >
    <div class="relatorio clinic-scope">
      <div class="relatorio__filtros">
        <ClinicToggleGroup
          :model-value="filtro.periodo"
          :opcoes="opcoesPeriodo"
          :rotulo="t('clinico.resumo.periodo.rotulo')"
          @update:model-value="trocarPeriodo($event as PeriodoId)"
        />

        <span class="relatorio__intervalo">
          <i class="ph ph-calendar-blank" aria-hidden="true" />
          <span class="relatorio__intervalo-texto">{{ intervaloLegivel }}</span>
        </span>

        <div class="relatorio__selects">
          <Select
            v-model="filtro.professionalId"
            option-label="rotulo"
            option-value="valor"
            :options="opcoesProfissional"
            :placeholder="t('clinico.resumo.filtro.todosProfissionais')"
            :aria-label="t('clinico.resumo.filtro.todosProfissionais')"
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
          <Select
            v-model="filtro.typeId"
            option-label="rotulo"
            option-value="valor"
            :options="opcoesTipo"
            :placeholder="t('clinico.resumo.filtro.todosTipos')"
            :aria-label="t('clinico.resumo.filtro.todosTipos')"
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
        </div>
      </div>

      <p v-if="semMovimento" class="ui-folha ui-vazio relatorio__vazio">
        <strong>{{ t('clinico.resumo.semMovimento') }}</strong>
      </p>

      <template v-else>
        <!--
          Os quatro números do período, cada um num indicador com o ladrilho no canto: o principal
          já está na frase do alto.
        -->
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

        <!--
          Cada gráfico é um cartão com cabeçalho próprio — ladrilho, título e a pergunta que ele
          responde —, como os cartões do Início.
        -->
        <section id="resumo-por-dia" class="painel painel--salvia ui-folha" aria-labelledby="resumo-por-dia-titulo">
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
              :pontos="resumo.porDia"
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

            <!-- A ocupação é uma taxa, não uma contagem: vira frase, e o gráfico fica com uma pergunta só. -->
            <p v-if="fraseDaOcupacao" class="relatorio__ocupacao ui-poco">
              <i class="ph ph-calendar-check" aria-hidden="true" />
              {{ fraseDaOcupacao }}
            </p>
          </div>
        </section>

        <div class="relatorio__par">
          <section id="resumo-por-tipo" class="painel painel--tipo ui-folha" aria-labelledby="resumo-por-tipo-titulo">
            <header class="painel__cabeca">
              <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-stethoscope" /></span>
              <span class="painel__titulos">
                <h2 id="resumo-por-tipo-titulo">{{ t('clinico.resumo.grafico.porTipo') }}</h2>
              </span>
            </header>
            <div class="relatorio__recheio">
              <ClinicChartRanking
                :fatias="resumo.porTipo"
                :cor-da-fatia="corDoTipo"
                :vazio="t('clinico.resumo.semDados')"
              />
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
              </span>
            </header>
            <div class="relatorio__recheio">
              <ClinicChartRanking
                :fatias="resumo.porProfissional"
                :vazio="t('clinico.resumo.semDados')"
              />
            </div>
          </section>
        </div>

        <div class="relatorio__par">
          <section id="resumo-horarios" class="painel painel--salvia ui-folha" aria-labelledby="resumo-horarios-titulo">
            <header class="painel__cabeca">
              <span class="ui-ladrilho ui-ladrilho--dado" aria-hidden="true">
                <i class="ph ph-clock" />
              </span>
              <span class="painel__titulos">
                <h2 id="resumo-horarios-titulo">{{ t('clinico.resumo.grafico.horarios') }}</h2>
                <span class="painel__descricao">{{ t('clinico.resumo.grafico.horariosAjuda') }}</span>
              </span>
            </header>
            <div class="relatorio__recheio">
              <ClinicHeatmap
                :celulas="resumo.porHora"
                :pico="resumo.picoDaHora"
                :dias="diasDaSemana"
                :vazio="t('clinico.resumo.semDados')"
              />
            </div>
          </section>

          <div class="relatorio__coluna">
            <section id="resumo-origem" class="painel painel--rosa ui-folha" aria-labelledby="resumo-origem-titulo">
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
                <ClinicChartRanking
                  :fatias="resumo.diagnosticos"
                  :vazio="t('clinico.resumo.semProntuario')"
                />
              </div>
            </section>
          </div>
        </div>
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
</style>
