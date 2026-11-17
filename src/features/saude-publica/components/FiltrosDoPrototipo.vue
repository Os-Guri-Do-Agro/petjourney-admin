<script setup lang="ts">
/**
 * A barra de filtros das telas de Saúde pública, no desenho da do relatório da Clínica: o período
 * em trilho, o selo com as datas (que abre o calendário), e as escolhas em lista. Cada tela pede os
 * campos que lhe servem (`campos`); o estado é um só para o espaço inteiro (`filtros.ts`).
 *
 * "Limpar filtros" só aparece quando algum filtro saiu do padrão, e diz quantos.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import MultiSelect from 'primevue/multiselect'
import Popover from 'primevue/popover'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { computed, ref } from 'vue'

import {
  dataCurta,
  PERIODO,
  REGIOES,
  tipoDeCampanha,
  type IdDaRegiao,
} from '@/features/saude-publica/dados'
import { useFiltrosDoPrototipo, type AtalhoDoPeriodo } from '@/features/saude-publica/filtros'
import { CAMPANHAS_DO_PERIODO, type Especie } from '@/features/saude-publica/serie'

export type CampoDoFiltro = 'periodo' | 'regiao' | 'campanha' | 'especie'

const props = withDefaults(defineProps<{ campos?: CampoDoFiltro[] }>(), {
  campos: () => ['periodo', 'regiao', 'campanha', 'especie'],
})

const filtros = useFiltrosDoPrototipo()
const tem = (campo: CampoDoFiltro) => props.campos.includes(campo)

/* --------------------------------------------------------------------------------- período */

const ATALHOS: { valor: Exclude<AtalhoDoPeriodo, 'datas'>; rotulo: string }[] = [
  { valor: '90', rotulo: '90 dias' },
  { valor: '30', rotulo: '30 dias' },
  { valor: '7', rotulo: '7 dias' },
]

const calendario = ref<InstanceType<typeof Popover> | null>(null)
const datas = ref<(Date | null)[] | null>(null)

const limites = {
  min: paraData(PERIODO.inicio),
  max: paraData(PERIODO.fim),
}

function paraData(valor: string) {
  const [ano, mes, dia] = valor.split('-').map(Number) as [number, number, number]
  return new Date(ano, mes - 1, dia)
}

function paraTexto(data: Date) {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

function abrirCalendario(evento: Event) {
  datas.value = [paraData(filtros.de.value), paraData(filtros.ate.value)]
  calendario.value?.toggle(evento)
}

/** O segundo clique fecha o intervalo: aplica e fecha o calendário. */
function aoEscolherDatas(valor: unknown) {
  const lista = Array.isArray(valor) ? (valor as (Date | null)[]) : null
  datas.value = lista
  const [inicio, fim] = lista ?? []
  if (inicio && fim) {
    filtros.escolherDatas(paraTexto(inicio), paraTexto(fim))
    calendario.value?.hide()
  }
}

/* -------------------------------------------------------------------- região e campanha */

const opcoesDeRegiao = REGIOES.map((regiao) => ({ valor: regiao.id, rotulo: regiao.nome })).sort(
  (uma, outra) => uma.rotulo.localeCompare(outra.rotulo, 'pt'),
)

const opcoesDeCampanha = CAMPANHAS_DO_PERIODO.map((campanha) => ({
  valor: campanha.id,
  rotulo: `${tipoDeCampanha(campanha.tipo).rotulo} · ${dataCurta(campanha.data).slice(0, 5)}`,
  icone: tipoDeCampanha(campanha.tipo).icone,
}))

/* -------------------------------------------------------------------------------- espécie */

const ESPECIES: { valor: Especie; rotulo: string; icone: string }[] = [
  { valor: 'todos', rotulo: 'Cães e gatos', icone: 'ph ph-paw-print' },
  { valor: 'caes', rotulo: 'Cães', icone: 'ph ph-dog' },
  { valor: 'gatos', rotulo: 'Gatos', icone: 'ph ph-cat' },
]

const rotuloDoLimpar = computed(() =>
  filtros.ativos.value === 1 ? 'Limpar o filtro' : `Limpar ${filtros.ativos.value} filtros`,
)
</script>

<template>
  <div class="sp-filtros" role="search" aria-label="Filtros do painel">
    <template v-if="tem('periodo')">
      <SelectButton
        class="sp-filtros__trilho"
        :model-value="filtros.atalho.value === 'datas' ? null : filtros.atalho.value"
        :options="ATALHOS"
        option-label="rotulo"
        option-value="valor"
        :allow-empty="false"
        aria-label="Período"
        @update:model-value="
          (valor: AtalhoDoPeriodo | null) =>
            valor && valor !== 'datas' && filtros.escolherAtalho(valor)
        "
      />

      <!-- O "de quando" de todos os números; clicar abre o calendário para escolher as datas. -->
      <Button
        type="button"
        class="sp-filtros__datas"
        :class="{ 'sp-filtros__datas--escolhidas': filtros.atalho.value === 'datas' }"
        severity="secondary"
        outlined
        icon="ph ph-calendar-blank"
        :label="filtros.intervalo.value"
        aria-haspopup="dialog"
        :aria-label="`Período: ${filtros.intervalo.value}. Escolher as datas`"
        @click="abrirCalendario"
      />
      <Popover ref="calendario">
        <div class="sp-filtros__calendario">
          <strong>Escolha o começo e o fim</strong>
          <DatePicker
            :model-value="datas"
            selection-mode="range"
            inline
            :min-date="limites.min"
            :max-date="limites.max"
            :manual-input="false"
            @update:model-value="aoEscolherDatas"
          />
          <small>Os 90 dias do programa: de 01/12/2026 a 28/02/2027.</small>
        </div>
      </Popover>
    </template>

    <MultiSelect
      v-if="tem('regiao')"
      class="sp-filtros__lista"
      :model-value="filtros.regioes.value"
      :options="opcoesDeRegiao"
      option-label="rotulo"
      option-value="valor"
      placeholder="Cidade inteira"
      :max-selected-labels="2"
      selected-items-label="{0} regiões"
      :show-toggle-all="false"
      aria-label="Regiões urbanas"
      @update:model-value="(ids: IdDaRegiao[]) => filtros.escolherRegioes(ids)"
    />

    <Select
      v-if="tem('campanha')"
      class="sp-filtros__lista sp-filtros__lista--campanha"
      :model-value="filtros.campanha.value"
      :options="opcoesDeCampanha"
      option-label="rotulo"
      option-value="valor"
      placeholder="Todas as campanhas"
      show-clear
      aria-label="Campanha"
      @update:model-value="(id: string | null) => filtros.escolherCampanha(id)"
    >
      <template #option="{ option }">
        <span class="sp-filtros__opcao">
          <i :class="option.icone" aria-hidden="true" />
          {{ option.rotulo }}
        </span>
      </template>
    </Select>

    <SelectButton
      v-if="tem('especie')"
      class="sp-filtros__trilho"
      :model-value="filtros.especie.value"
      :options="ESPECIES"
      option-label="rotulo"
      option-value="valor"
      :allow-empty="false"
      aria-label="Espécie"
      @update:model-value="(valor: Especie | null) => valor && filtros.escolherEspecie(valor)"
    >
      <template #option="{ option }">
        <i :class="option.icone" aria-hidden="true" />
        <span>{{ option.rotulo }}</span>
      </template>
    </SelectButton>

    <Button
      v-if="filtros.ativos.value > 0"
      type="button"
      class="sp-filtros__limpar"
      severity="secondary"
      outlined
      icon="ph ph-x"
      :label="rotuloDoLimpar"
      @click="filtros.limpar()"
    />
  </div>
</template>

<style scoped>
.sp-filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
}

.sp-filtros__trilho :deep(.p-togglebutton-content) {
  gap: 6px;
}

/* O selo das datas: papel com o calendário, como o intervalo do relatório da Clínica. */
.sp-filtros__datas {
  font-variant-numeric: tabular-nums;
}

.sp-filtros__datas--escolhidas {
  border-color: var(--app-salvia-texto, var(--musgo));
  color: var(--app-salvia-texto, var(--musgo));
}

.sp-filtros__lista {
  min-width: 11.5rem;
}

.sp-filtros__lista--campanha {
  min-width: 15rem;
}

.sp-filtros__opcao {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.sp-filtros__limpar {
  margin-inline-start: auto;
}

.sp-filtros__calendario {
  display: grid;
  gap: 8px;
}

.sp-filtros__calendario strong {
  color: var(--tinta);
  font-size: 13.5px;
}

.sp-filtros__calendario small {
  color: var(--tinta-2);
  font-size: 12px;
}
</style>
