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
import {
  PhCalendarCheck,
  PhChartBar,
  PhClock,
  PhHeartbeat,
  PhTag,
  PhUsersThree,
} from '@phosphor-icons/vue'
import Select from 'primevue/select'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicToggleGroup from '@/features/clinico/components/base/ClinicToggleGroup.vue'
import ClinicChartColumns from '@/features/clinico/components/resumo/ClinicChartColumns.vue'
import ClinicChartRanking from '@/features/clinico/components/resumo/ClinicChartRanking.vue'
import ClinicHeatmap from '@/features/clinico/components/resumo/ClinicHeatmap.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { agendaRepository } from '@/features/clinico/data/repositories'
import type { Appointment, Clinic, Encounter } from '@/features/clinico/data/types'
import { addDays } from '@/features/clinico/domain/clinic-time'
import {
  FILTRO_RESUMO_PADRAO,
  inicioDaSemana,
  intervaloDoPeriodo,
  PERIODOS,
  resumirClinica,
  type PeriodoId,
  type ResumoFiltro,
} from '@/features/clinico/domain/resumo'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'

const { t } = useI18n()
const clinico = useClinicoStore()
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
     * A janela buscada é sempre a do período escolhido — menos os "novos pacientes", que
     * precisam da base inteira para saber se o primeiro atendimento do bicho foi mesmo aqui.
     * Trinta dias para trás e a semana inteira para frente cobrem os dois casos sem trazer o
     * histórico completo para dentro da tela.
     */
    const janela = intervaloDoPeriodo(filtro.value.periodo, hoje.value)
    const dados = await agendaRepository.obterIntervalo(janela.inicio, janela.fim)

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

function trocarPeriodo(periodo: PeriodoId) {
  filtro.value = { ...filtro.value, periodo }
}
</script>

<template>
  <PartnerPageFrame
    class="hc-tema"
    :subtitle="t('clinico.resumo.subtitulo')"
    :title="t('clinico.resumo.titulo')"
    :loading="carregando && atendimentos.length === 0"
    :error="erro"
    block-when-suspended
    @retry="carregar"
  >
    <template #cabecalho>
      <div class="hc-saudacao">
        <p class="hc-saudacao__data">{{ t('clinico.resumo.subtitulo') }}</p>
        <h1 class="hc-saudacao__titulo">{{ t('clinico.resumo.titulo') }}</h1>

        <div class="hc-saudacao__linha">
          <p v-if="fraseDoResumo" class="hc-saudacao__resumo" aria-live="polite">
            {{ fraseDoResumo }}
          </p>
        </div>
      </div>
    </template>

    <div class="resumo clinic-scope">
      <header class="resumo__filtros">
        <ClinicToggleGroup
          :model-value="filtro.periodo"
          :opcoes="opcoesPeriodo"
          :rotulo="t('clinico.resumo.periodo.rotulo')"
          @update:model-value="trocarPeriodo($event as PeriodoId)"
        />

        <span class="resumo__intervalo">{{ intervaloLegivel }}</span>

        <div class="resumo__selects">
          <Select
            v-model="filtro.professionalId"
            class="resumo__select"
            option-label="rotulo"
            option-value="valor"
            size="small"
            :options="opcoesProfissional"
            :placeholder="t('clinico.resumo.filtro.todosProfissionais')"
            :aria-label="t('clinico.resumo.filtro.todosProfissionais')"
            :pt="{ overlay: { class: 'clinic-overlay hc-tema' } }"
          />
          <Select
            v-model="filtro.typeId"
            class="resumo__select"
            option-label="rotulo"
            option-value="valor"
            size="small"
            :options="opcoesTipo"
            :placeholder="t('clinico.resumo.filtro.todosTipos')"
            :aria-label="t('clinico.resumo.filtro.todosTipos')"
            :pt="{ overlay: { class: 'clinic-overlay hc-tema' } }"
          />
        </div>
      </header>

      <p v-if="semMovimento" class="hc resumo__vazio">
        {{ t('clinico.resumo.semMovimento') }}
      </p>

      <template v-else>
        <!-- Os quatro cartões de número viraram uma linha de fatos: o principal já está na frase. -->
        <section class="hc resumo-fatos" :aria-label="t('clinico.resumo.fatos.aria')">
          <ul class="resumo-fatos__lista">
            <li :class="{ 'resumo-fatos__item--atencao': comparecimentoBaixo }">
              <i
                v-if="comparecimentoBaixo"
                class="ph ph-warning"
                :title="t('clinico.resumo.fatos.comparecimentoBaixo')"
                :aria-label="t('clinico.resumo.fatos.comparecimentoBaixo')"
              />
              <strong>{{ formato.percentual(resumo.indicadores.comparecimento) }}</strong>
              {{ t('clinico.resumo.fatos.comparecimento') }}
              <span class="resumo-fatos__nota">
                ({{
                  t(
                    'clinico.resumo.indicador.faltasNoPeriodo',
                    { contagem: resumo.indicadores.faltas },
                    resumo.indicadores.faltas,
                  )
                }})
              </span>
            </li>
            <li>
              <strong>{{ formato.numero(resumo.indicadores.horasAtendidas, 1) }} h</strong>
              {{ t('clinico.resumo.fatos.horas') }}
            </li>
            <li>
              <strong>{{ formato.percentual(resumo.indicadores.ocupacaoMedia) }}</strong>
              {{ t('clinico.resumo.fatos.ocupacao') }}
            </li>
            <li>
              <strong>{{ resumo.indicadores.novosPacientes }}</strong>
              {{ t('clinico.resumo.fatos.novos', resumo.indicadores.novosPacientes) }}
            </li>
            <li v-if="resumo.indicadores.encaixes > 0">
              <strong>{{ resumo.indicadores.encaixes }}</strong>
              {{ t('clinico.resumo.fatos.encaixes', resumo.indicadores.encaixes) }}
            </li>
          </ul>
        </section>

        <section class="hc" aria-labelledby="resumo-por-dia">
          <header class="hc__cabeca">
            <h2 id="resumo-por-dia" class="hc__titulo">
              <PhChartBar class="hc__icone" weight="duotone" aria-hidden="true" />
              {{ t('clinico.resumo.grafico.porDia') }}
            </h2>
            <span class="hc__ferramentas">{{ t('clinico.resumo.grafico.porDiaAjuda') }}</span>
          </header>

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
          <p v-if="fraseDaOcupacao" class="resumo__ocupacao">
            <PhCalendarCheck class="resumo__ocupacao-icone" weight="duotone" aria-hidden="true" />
            {{ fraseDaOcupacao }}
          </p>
        </section>

        <div class="resumo__par">
          <section class="hc" aria-labelledby="resumo-por-tipo">
            <header class="hc__cabeca">
              <h2 id="resumo-por-tipo" class="hc__titulo">
                <PhTag class="hc__icone" weight="duotone" aria-hidden="true" />
                {{ t('clinico.resumo.grafico.porTipo') }}
              </h2>
            </header>
            <ClinicChartRanking :fatias="resumo.porTipo" :vazio="t('clinico.resumo.semDados')" />
          </section>

          <section class="hc" aria-labelledby="resumo-por-profissional">
            <header class="hc__cabeca">
              <h2 id="resumo-por-profissional" class="hc__titulo">
                <PhUsersThree class="hc__icone" weight="duotone" aria-hidden="true" />
                {{ t('clinico.resumo.grafico.porProfissional') }}
              </h2>
            </header>
            <ClinicChartRanking
              :fatias="resumo.porProfissional"
              :vazio="t('clinico.resumo.semDados')"
            />
          </section>
        </div>

        <div class="resumo__par">
          <section class="hc" aria-labelledby="resumo-horarios">
            <header class="hc__cabeca">
              <h2 id="resumo-horarios" class="hc__titulo">
                <PhClock class="hc__icone" weight="duotone" aria-hidden="true" />
                {{ t('clinico.resumo.grafico.horarios') }}
              </h2>
              <span class="hc__ferramentas">{{ t('clinico.resumo.grafico.horariosAjuda') }}</span>
            </header>
            <ClinicHeatmap
              :celulas="resumo.porHora"
              :pico="resumo.picoDaHora"
              :dias="diasDaSemana"
              :vazio="t('clinico.resumo.semDados')"
            />
          </section>

          <section class="hc" aria-labelledby="resumo-diagnosticos">
            <header class="hc__cabeca">
              <h2 id="resumo-diagnosticos" class="hc__titulo">
                <PhHeartbeat class="hc__icone" weight="duotone" aria-hidden="true" />
                {{ t('clinico.resumo.grafico.diagnosticos') }}
              </h2>
            </header>
            <!-- Na tinta da marca: diagnóstico frequente não é alerta, e o laranja dizia que era. -->
            <ClinicChartRanking
              :fatias="resumo.diagnosticos"
              :vazio="t('clinico.resumo.semProntuario')"
            />
          </section>
        </div>
      </template>
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
.resumo {
  display: grid;
  gap: 1.1rem;
}

.resumo__filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem 1rem;
}

.resumo__intervalo {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  font-weight: 650;
}

.resumo__intervalo::first-letter {
  text-transform: uppercase;
}

.resumo__selects {
  display: flex;
  gap: 0.5rem;
  margin-inline-start: auto;
}

.resumo__select {
  min-width: 11rem;
}

.resumo-fatos {
  padding-block: 0.85rem;
}

.resumo-fatos__lista {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.75rem;
  margin: 0;
  padding: 0;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
  list-style: none;
}

.resumo-fatos__lista li {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
}

.resumo-fatos__lista strong {
  color: var(--hc-tinta);
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.resumo-fatos__nota {
  color: var(--hc-tinta-3);
}

/* Comparecimento abaixo de 85%: a urgência mora no ícone, a linha não muda de cor. */
.resumo-fatos__item--atencao i {
  align-self: center;
  color: var(--hc-pessego-tinta);
  font-size: 0.85rem;
}

.resumo__par {
  display: grid;
  align-items: start;
  gap: 1.1rem;
  grid-template-columns: repeat(auto-fit, minmax(21rem, 1fr));
}

.resumo__ocupacao {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  padding-top: 0.75rem;
  border-top: 1px solid var(--hc-linha);
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.resumo__ocupacao-icone {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  color: var(--hc-marca);
}

.resumo__vazio {
  margin: 0;
  color: var(--hc-tinta-2);
  text-align: center;
}

@media (max-width: 720px) {
  .resumo__selects {
    width: 100%;
    margin-inline-start: 0;
  }

  .resumo__select {
    flex: 1 1 auto;
    min-width: 0;
  }
}
</style>
