<script setup lang="ts">
/**
 * Os filtros do Piloto com a Subea, no desenho da barra do Painel. O piloto tem calendário próprio
 * (60 dias num bairro), então o período é o dele: o piloto inteiro até hoje, ou os últimos 30 ou 7
 * dias. Período e espécie valem para as metas e para a lista; procedimento e situação, só para a
 * lista de atendimentos.
 */
import Button from 'primevue/button'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { computed } from 'vue'

import {
  PROCEDIMENTOS,
  type Procedimento,
  type SituacaoNoPiloto,
} from '@/features/saude-publica/dados'
import type { Especie, JanelaDoPiloto } from '@/features/saude-publica/serie'

const janela = defineModel<JanelaDoPiloto>('janela', { required: true })
const especie = defineModel<Especie>('especie', { required: true })
const procedimento = defineModel<Procedimento | null>('procedimento', { required: true })
const situacao = defineModel<SituacaoNoPiloto | null>('situacao', { required: true })

const JANELAS: { valor: JanelaDoPiloto; rotulo: string }[] = [
  { valor: 'inteiro', rotulo: 'Piloto inteiro' },
  { valor: '30', rotulo: '30 dias' },
  { valor: '7', rotulo: '7 dias' },
]

const ESPECIES: { valor: Especie; rotulo: string; icone: string }[] = [
  { valor: 'todos', rotulo: 'Cães e gatos', icone: 'ph ph-paw-print' },
  { valor: 'caes', rotulo: 'Cães', icone: 'ph ph-dog' },
  { valor: 'gatos', rotulo: 'Gatos', icone: 'ph ph-cat' },
]

const OPCOES_DE_PROCEDIMENTO = PROCEDIMENTOS.map((item) => ({
  valor: item.id,
  rotulo: item.rotulo,
  icone: item.icone,
}))

const OPCOES_DE_SITUACAO: { valor: SituacaoNoPiloto; rotulo: string; icone: string }[] = [
  { valor: 'cumpriu', rotulo: 'Voltou no prazo', icone: 'ph ph-check' },
  { valor: 'atrasado', rotulo: 'Passou da data', icone: 'ph ph-clock-countdown' },
  { valor: 'abriu', rotulo: 'Abriu a ficha', icone: 'ph ph-eye' },
  { valor: 'nao-abriu', rotulo: 'Não abriu a ficha', icone: 'ph ph-eye-slash' },
]

const ativos = computed(
  () =>
    Number(janela.value !== 'inteiro') +
    Number(especie.value !== 'todos') +
    Number(procedimento.value !== null) +
    Number(situacao.value !== null),
)

function limpar() {
  janela.value = 'inteiro'
  especie.value = 'todos'
  procedimento.value = null
  situacao.value = null
}
</script>

<template>
  <div class="pl-filtros" role="search" aria-label="Filtros do piloto">
    <SelectButton
      v-model="janela"
      :options="JANELAS"
      option-label="rotulo"
      option-value="valor"
      :allow-empty="false"
      aria-label="Período do piloto"
    />

    <SelectButton
      v-model="especie"
      class="pl-filtros__trilho"
      :options="ESPECIES"
      option-label="rotulo"
      option-value="valor"
      :allow-empty="false"
      aria-label="Espécie"
    >
      <template #option="{ option }">
        <i :class="option.icone" aria-hidden="true" />
        <span>{{ option.rotulo }}</span>
      </template>
    </SelectButton>

    <Select
      v-model="procedimento"
      class="pl-filtros__lista"
      :options="OPCOES_DE_PROCEDIMENTO"
      option-label="rotulo"
      option-value="valor"
      placeholder="Todos os procedimentos"
      show-clear
      aria-label="Procedimento (só a lista de atendimentos)"
    >
      <template #option="{ option }">
        <span class="pl-filtros__opcao">
          <i :class="option.icone" aria-hidden="true" />
          {{ option.rotulo }}
        </span>
      </template>
    </Select>

    <Select
      v-model="situacao"
      class="pl-filtros__lista"
      :options="OPCOES_DE_SITUACAO"
      option-label="rotulo"
      option-value="valor"
      placeholder="Todas as situações"
      show-clear
      aria-label="Situação depois do atendimento (só a lista)"
    >
      <template #option="{ option }">
        <span class="pl-filtros__opcao">
          <i :class="option.icone" aria-hidden="true" />
          {{ option.rotulo }}
        </span>
      </template>
    </Select>

    <Button
      v-if="ativos > 0"
      type="button"
      class="pl-filtros__limpar"
      severity="secondary"
      outlined
      icon="ph ph-x"
      :label="ativos === 1 ? 'Limpar o filtro' : `Limpar ${ativos} filtros`"
      @click="limpar"
    />
  </div>
</template>

<style scoped>
.pl-filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
}

.pl-filtros__trilho :deep(.p-togglebutton-content) {
  gap: 6px;
}

.pl-filtros__lista {
  min-width: 13rem;
}

.pl-filtros__opcao {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.pl-filtros__limpar {
  margin-inline-start: auto;
}
</style>
