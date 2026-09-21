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

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicStat from '@/features/clinico/components/base/ClinicStat.vue'
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
    :subtitle="t('clinico.resumo.subtitulo')"
    :title="t('clinico.resumo.titulo')"
    :loading="carregando && atendimentos.length === 0"
    :error="erro"
    block-when-suspended
    @retry="carregar"
  >
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
            :options="opcoesProfissional"
            :placeholder="t('clinico.resumo.filtro.todosProfissionais')"
            :aria-label="t('clinico.resumo.filtro.todosProfissionais')"
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
          <Select
            v-model="filtro.typeId"
            class="resumo__select"
            option-label="rotulo"
            option-value="valor"
            :options="opcoesTipo"
            :placeholder="t('clinico.resumo.filtro.todosTipos')"
            :aria-label="t('clinico.resumo.filtro.todosTipos')"
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
        </div>
      </header>

      <div class="resumo__numeros">
        <ClinicStat
          icone="pi pi-check-circle"
          tom="acento"
          :rotulo="t('clinico.resumo.indicador.atendidos')"
          :valor="String(resumo.indicadores.finalizados)"
          :detalhe="
            t('clinico.resumo.indicador.horas', {
              valor: formato.numero(resumo.indicadores.horasAtendidas, 1),
            })
          "
        />
        <ClinicStat
          icone="pi pi-percentage"
          :tom="resumo.indicadores.comparecimento < 0.85 ? 'atencao' : 'acento'"
          :rotulo="t('clinico.resumo.indicador.comparecimento')"
          :valor="formato.percentual(resumo.indicadores.comparecimento)"
          :detalhe="
            t('clinico.resumo.indicador.faltasNoPeriodo', {
              contagem: resumo.indicadores.faltas,
            }, resumo.indicadores.faltas)
          "
        />
        <ClinicStat
          icone="pi pi-chart-bar"
          :rotulo="t('clinico.resumo.indicador.ocupacao')"
          :valor="formato.percentual(resumo.indicadores.ocupacaoMedia)"
          :detalhe="t('clinico.resumo.indicador.ocupacaoDetalhe')"
        />
        <ClinicStat
          icone="pi pi-sparkles"
          :rotulo="t('clinico.resumo.indicador.novos')"
          :valor="String(resumo.indicadores.novosPacientes)"
          :detalhe="
            t('clinico.resumo.indicador.encaixes', {
              contagem: resumo.indicadores.encaixes,
            }, resumo.indicadores.encaixes)
          "
        />
      </div>

      <p v-if="semMovimento" class="resumo__vazio">
        {{ t('clinico.resumo.semMovimento') }}
      </p>

      <template v-else>
        <section class="cartao cartao--largo">
          <header class="cartao__topo">
              <span class="cartao__marca" aria-hidden="true"><i class="pi pi-chart-bar" /></span>
              <h2>{{ t('clinico.resumo.grafico.porDia') }}</h2>
            <p>{{ t('clinico.resumo.grafico.porDiaAjuda') }}</p>
          </header>

          <ClinicChartColumns
            :pontos="resumo.porDia"
            :rotulos="rotulosDosDias"
            :destaque="hoje"
            :rotulo-destaque="t('clinico.resumo.periodo.hoje')"
            :legenda="{
              finalizados: t('clinico.resumo.legenda.finalizados'),
              previstos: t('clinico.resumo.legenda.previstos'),
              faltas: t('clinico.resumo.legenda.faltas'),
              ocupacao: t('clinico.resumo.legenda.ocupacao'),
              fechado: t('clinico.resumo.legenda.fechado'),
            }"
          />
        </section>

        <div class="resumo__par">
          <section class="cartao">
            <header class="cartao__topo">
                <span class="cartao__marca" aria-hidden="true"><i class="pi pi-tags" /></span>
                <h2>{{ t('clinico.resumo.grafico.porTipo') }}</h2>
            </header>
            <ClinicChartRanking
              :fatias="resumo.porTipo"
              :vazio="t('clinico.resumo.semDados')"
            />
          </section>

          <section class="cartao">
            <header class="cartao__topo">
                <span class="cartao__marca" aria-hidden="true"><i class="pi pi-users" /></span>
                <h2>{{ t('clinico.resumo.grafico.porProfissional') }}</h2>
            </header>
            <ClinicChartRanking
              :fatias="resumo.porProfissional"
              :vazio="t('clinico.resumo.semDados')"
            />
          </section>
        </div>

        <div class="resumo__par">
          <section class="cartao">
            <header class="cartao__topo">
                <span class="cartao__marca" aria-hidden="true"><i class="pi pi-clock" /></span>
                <h2>{{ t('clinico.resumo.grafico.horarios') }}</h2>
              <p>{{ t('clinico.resumo.grafico.horariosAjuda') }}</p>
            </header>
            <ClinicHeatmap
              :celulas="resumo.porHora"
              :pico="resumo.picoDaHora"
              :dias="diasDaSemana"
              :vazio="t('clinico.resumo.semDados')"
            />
          </section>

          <section class="cartao">
            <header class="cartao__topo">
                <span class="cartao__marca" aria-hidden="true"><i class="pi pi-heart" /></span>
                <h2>{{ t('clinico.resumo.grafico.diagnosticos') }}</h2>
            </header>
            <ClinicChartRanking
              tom="atencao"
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
  gap: var(--clinic-space-4);
}

.resumo__filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-3);
}

.resumo__intervalo {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.resumo__intervalo::first-letter {
  text-transform: uppercase;
}

.resumo__selects {
  display: flex;
  gap: var(--clinic-space-2);
  margin-inline-start: auto;
}

.resumo__select {
  min-width: 11rem;
}

.resumo__numeros {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
}

.resumo__par {
  display: grid;
  align-items: start;
  gap: var(--clinic-space-4);
  grid-template-columns: repeat(auto-fit, minmax(21rem, 1fr));
}

.cartao {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

/*
 * Ladrilho à esquerda, título e ajuda empilhados à direita.
 *
 * As áreas são nomeadas de propósito. Com `grid-row: 1 / -1` o ladrilho colapsava para uma linha
 * só — `-1` conta linhas da grade **explícita**, e não havia nenhuma — e a ajuda era empurrada
 * para baixo do ícone. Com `grid-template-areas` o ladrilho cobre as duas linhas quando há ajuda
 * e a linha vazia simplesmente colapsa quando não há.
 */
.cartao__topo {
  display: grid;
  align-items: center;
  gap: 0 var(--clinic-space-3);
  grid-template-areas:
    'marca titulo'
    'marca ajuda';
  grid-template-columns: auto minmax(0, 1fr);
}

.cartao__marca {
  display: grid;
  width: 2rem;
  height: 2rem;
  grid-area: marca;
  place-items: center;
  border-radius: 0.65rem;
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-size: 0.8rem;
}

.cartao__topo h2 {
  margin: 0;
  grid-area: titulo;
  color: var(--clinic-text);
  font-size: var(--clinic-font-value);
  font-weight: 750;
  letter-spacing: -0.015em;
}

.cartao__topo p {
  margin: 0;
  grid-area: ajuda;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  line-height: 1.4;
}

.resumo__vazio {
  margin: 0;
  padding: var(--clinic-space-5);
  border: 1px dashed var(--clinic-line-strong);
  border-radius: var(--clinic-radius-card);
  color: var(--clinic-muted);
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
