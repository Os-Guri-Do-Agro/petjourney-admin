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
import UiSecao from '@/components/ui/UiSecao.vue'
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
      valor: `${formato.numero(indicadores.horasAtendidas, 1)} h`,
      rotulo: t('clinico.resumo.numero.horas'),
      nota: t('clinico.resumo.numero.horasNota'),
      atencao: false,
    },
    {
      id: 'ocupacao',
      valor: formato.percentual(indicadores.ocupacaoMedia),
      rotulo: t('clinico.resumo.indicador.ocupacao'),
      nota: t('clinico.resumo.indicador.ocupacaoDetalhe'),
      atencao: false,
    },
    {
      id: 'novos',
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

        <span class="relatorio__intervalo">{{ intervaloLegivel }}</span>

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
        <!-- Os quatro números do período, numa régua só: o principal já está na frase do alto. -->
        <ul class="numeros ui-folha" :aria-label="t('clinico.resumo.fatos.aria')">
          <li
            v-for="numero in numeros"
            :key="numero.id"
            class="numero"
            :class="{ 'numero--atencao': numero.atencao }"
          >
            <span class="numero__rotulo">{{ numero.rotulo }}</span>
            <strong class="numero__valor ui-num">
              <i
                v-if="numero.atencao"
                class="ph ph-warning"
                :title="t('clinico.resumo.fatos.comparecimentoBaixo')"
                :aria-label="t('clinico.resumo.fatos.comparecimentoBaixo')"
              />
              {{ numero.valor }}
            </strong>
            <span class="numero__nota">{{ numero.nota }}</span>
          </li>
        </ul>

        <UiSecao
          id="resumo-por-dia"
          :titulo="t('clinico.resumo.grafico.porDia')"
          :descricao="t('clinico.resumo.grafico.porDiaAjuda')"
          folha
        >
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
            <p v-if="fraseDaOcupacao" class="relatorio__ocupacao">
              <i class="ph ph-calendar-check" aria-hidden="true" />
              {{ fraseDaOcupacao }}
            </p>
          </div>
        </UiSecao>

        <div class="relatorio__par">
          <UiSecao id="resumo-por-tipo" :titulo="t('clinico.resumo.grafico.porTipo')" folha>
            <div class="relatorio__recheio">
              <ClinicChartRanking :fatias="resumo.porTipo" :vazio="t('clinico.resumo.semDados')" />
            </div>
          </UiSecao>

          <UiSecao
            id="resumo-por-profissional"
            :titulo="t('clinico.resumo.grafico.porProfissional')"
            folha
          >
            <div class="relatorio__recheio">
              <ClinicChartRanking
                :fatias="resumo.porProfissional"
                :vazio="t('clinico.resumo.semDados')"
              />
            </div>
          </UiSecao>
        </div>

        <div class="relatorio__par">
          <UiSecao
            id="resumo-horarios"
            :titulo="t('clinico.resumo.grafico.horarios')"
            :descricao="t('clinico.resumo.grafico.horariosAjuda')"
            folha
          >
            <div class="relatorio__recheio">
              <ClinicHeatmap
                :celulas="resumo.porHora"
                :pico="resumo.picoDaHora"
                :dias="diasDaSemana"
                :vazio="t('clinico.resumo.semDados')"
              />
            </div>
          </UiSecao>

          <div class="relatorio__coluna">
            <UiSecao id="resumo-origem" :titulo="t('clinico.resumo.grafico.porOrigem')" folha>
              <div class="relatorio__recheio">
                <ClinicChartRanking :fatias="porOrigem" :vazio="t('clinico.resumo.semDados')" />
              </div>
            </UiSecao>

            <UiSecao
              id="resumo-diagnosticos"
              :titulo="t('clinico.resumo.grafico.diagnosticos')"
              folha
            >
              <div class="relatorio__recheio">
                <ClinicChartRanking
                  :fatias="resumo.diagnosticos"
                  :vazio="t('clinico.resumo.semProntuario')"
                />
              </div>
            </UiSecao>
          </div>
        </div>
      </template>
    </div>
  </UiPagina>
</template>

<style scoped>
.relatorio {
  display: grid;
  gap: 28px;
}

.relatorio__filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}

.relatorio__intervalo {
  display: inline-block;
  color: var(--tinta-2);
  font-size: 14px;
  font-weight: 500;
}

.relatorio__intervalo::first-letter {
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

/* A régua de números: quatro colunas com fio entre elas, número grande e legenda embaixo. */
.numeros {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.numero {
  display: grid;
  align-content: start;
  gap: 4px;
  padding: 18px 22px 20px;
}

.numero + .numero {
  border-left: 1px solid var(--linha);
}

.numero__rotulo {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 500;
}

.numero__valor {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 32px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.numero__valor i {
  font-size: 22px;
}

.numero__nota {
  color: var(--tinta-3);
  font-size: 12.5px;
}

.numero--atencao .numero__valor {
  color: var(--atencao-tinta);
}

.relatorio__grafico {
  display: grid;
  gap: 8px;
  padding: 12px 16px 18px;
}

.relatorio__ocupacao {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0 6px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.relatorio__ocupacao i {
  color: var(--clinica);
  font-size: 18px;
}

.relatorio__par {
  display: grid;
  align-items: start;
  gap: 20px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.relatorio__coluna {
  display: grid;
  gap: 28px;
}

.relatorio__recheio {
  padding: 18px 20px;
}

@media (max-width: 1100px) {
  .numeros {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .numero:nth-child(3) {
    border-left: 0;
  }

  .numero:nth-child(n + 3) {
    border-top: 1px solid var(--linha);
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
</style>
