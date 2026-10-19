<script setup lang="ts">
/**
 * Busca e filtros de uma lista.
 *
 * Três decisões que evitam os dois erros clássicos de barra de filtro:
 *
 * 1. **Um botão só.** Espalhar seis facetas pela tela custa a largura toda e empurra a lista
 *    para baixo da dobra. Elas moram num painel nomeado, aberto por um botão.
 * 2. **O que está aplicado fica visível.** Filtro ativo escondido atrás de um botão fechado é
 *    a forma mais rápida de alguém concluir que "sumiu tudo". As escolhas viram fichas na
 *    própria barra, cada uma removível sem abrir o painel.
 * 3. **Contagem por opção.** Saber que "Felina · 4" existe antes de clicar poupa o filtro que
 *    devolve lista vazia.
 *
 * Na pele do Trilha a barra é discreta de propósito: o campo de busca com a lupa, um botão de
 * filtros que só acende quando há filtro aplicado, e a contagem de resultados à direita, em tinta
 * secundária. Quem manda na tela é a lista, não a barra.
 */
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Popover from 'primevue/popover'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { GrupoDeFiltro } from './filter-types'

const props = withDefaults(
  defineProps<{
    grupos: GrupoDeFiltro[]
    /** Valores marcados por grupo. */
    selecionados: Record<string, string[]>
    busca?: string
    placeholderBusca?: string
    /** Total de itens depois de filtrar, mostrado ao lado da busca. */
    resultado?: number
  }>(),
  { busca: '', placeholderBusca: '', resultado: -1 },
)

const emit = defineEmits<{
  'update:busca': [valor: string]
  'update:selecionados': [valor: Record<string, string[]>]
}>()

const { t } = useI18n()
const painel = ref<InstanceType<typeof Popover> | null>(null)

const total = computed(() =>
  Object.values(props.selecionados).reduce((soma, lista) => soma + lista.length, 0),
)

/** As fichas da barra: grupo por grupo, na ordem declarada, para a leitura ser estável. */
const aplicados = computed(() =>
  props.grupos.flatMap((grupo) =>
    (props.selecionados[grupo.id] ?? []).flatMap((valor) => {
      const opcao = grupo.opcoes.find((item) => item.valor === valor)

      return opcao ? [{ grupo: grupo.id, valor, rotulo: opcao.rotulo }] : []
    }),
  ),
)

function alternar(grupoId: string, valor: string) {
  const atual = props.selecionados[grupoId] ?? []

  emit('update:selecionados', {
    ...props.selecionados,
    [grupoId]: atual.includes(valor) ? atual.filter((item) => item !== valor) : [...atual, valor],
  })
}

function limpar() {
  emit('update:selecionados', {})
}
</script>

<template>
  <div class="filtro">
    <div class="filtro__linha">
      <IconField class="filtro__busca">
        <InputIcon class="ph ph-magnifying-glass" />
        <InputText
          type="search"
          fluid
          :model-value="busca"
          :placeholder="placeholderBusca"
          :aria-label="placeholderBusca"
          @update:model-value="emit('update:busca', $event ?? '')"
        />
      </IconField>

      <Button
        type="button"
        class="filtro__botao"
        :class="{ 'filtro__botao--ativo': total > 0 }"
        severity="secondary"
        outlined
        aria-haspopup="true"
        @click="painel?.toggle($event)"
      >
        <i class="ph ph-sliders-horizontal filtro__botao-icone" aria-hidden="true" />
        <span>{{ t('clinico.comum.filtros') }}</span>
        <span v-if="total > 0" class="ui-contagem filtro__total">{{ total }}</span>
      </Button>

      <span v-if="resultado >= 0" class="filtro__resultado" aria-live="polite">
        {{ t('clinico.comum.resultados', { contagem: resultado }, resultado) }}
      </span>
    </div>

    <!-- O que está aplicado, sem precisar abrir o painel. -->
    <div v-if="aplicados.length > 0" class="filtro__aplicados">
      <button
        v-for="ficha in aplicados"
        :key="`${ficha.grupo}-${ficha.valor}`"
        type="button"
        class="ficha ficha--removivel"
        :aria-label="`${ficha.rotulo}: ${t('clinico.comum.remover')}`"
        @click="alternar(ficha.grupo, ficha.valor)"
      >
        <span>{{ ficha.rotulo }}</span>
        <i class="ph ph-x" aria-hidden="true" />
      </button>

      <button type="button" class="filtro__limpar ui-mais" @click="limpar">
        {{ t('clinico.agenda.limparFiltros') }}
      </button>
    </div>

    <Popover ref="painel" class="clinic-overlay hc-tema filtro-painel">
      <div class="painel clinic-scope">
        <section v-for="grupo in grupos" :key="grupo.id" class="painel__grupo">
          <h3 class="painel__titulo">{{ grupo.rotulo }}</h3>

          <div class="painel__opcoes">
            <button
              v-for="opcao in grupo.opcoes"
              :key="opcao.valor"
              type="button"
              class="ficha"
              :class="{ 'ficha--ativa': (selecionados[grupo.id] ?? []).includes(opcao.valor) }"
              :aria-pressed="(selecionados[grupo.id] ?? []).includes(opcao.valor)"
              @click="alternar(grupo.id, opcao.valor)"
            >
              <i
                v-if="(selecionados[grupo.id] ?? []).includes(opcao.valor)"
                class="ph ph-check ficha__marca"
                aria-hidden="true"
              />
              <span>{{ opcao.rotulo }}</span>
              <span v-if="opcao.contagem !== undefined" class="ficha__contagem">
                {{ opcao.contagem }}
              </span>
            </button>
          </div>
        </section>
      </div>
    </Popover>
  </div>
</template>

<style scoped>
.filtro {
  display: grid;
  gap: 10px;
}

.filtro__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
}

/* ----------------------------------------------------------------------------- busca */

.filtro__busca {
  flex: 1 1 20rem;
  max-width: 30rem;
}

.filtro__busca :deep(.p-inputtext) {
  min-height: 38px;
  padding-inline-start: 38px;
  border-color: var(--linha-forte);
  border-radius: 10px;
  background: var(--superficie);
  color: var(--tinta);
  font-family: var(--font-texto);
  font-size: 14px;
}

.filtro__busca :deep(.p-inputtext::placeholder) {
  color: var(--tinta-3);
}

.filtro__busca :deep(.p-inputtext:enabled:hover) {
  border-color: var(--tinta-3);
}

.filtro__busca :deep(.p-inputtext:enabled:focus) {
  border-color: var(--musgo);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--musgo) 22%, transparent);
  outline: none;
}

.filtro__busca :deep(.p-inputicon) {
  inset-inline-start: 13px;
  color: var(--tinta-3);
  font-size: 16px;
}

/* -------------------------------------------------------------------------- filtros */

.filtro__botao.p-button {
  min-height: 38px;
  gap: 8px;
  padding: 0 14px;
  border-color: var(--linha-forte);
  border-radius: 10px;
  background: var(--superficie);
  color: var(--tinta);
  font-size: 14px;
  font-weight: 500;
}

.filtro__botao.p-button:not(:disabled):hover {
  border-color: var(--tinta-3);
  background: var(--superficie-2);
  color: var(--tinta);
}

.filtro__botao-icone {
  color: var(--tinta-2);
  font-size: 16px;
}

/* Com filtro aplicado o botão acende: é o aviso de que a lista não está inteira. */
.filtro__botao--ativo.p-button,
.filtro__botao--ativo.p-button:not(:disabled):hover {
  border-color: color-mix(in oklab, var(--musgo) 55%, var(--linha));
  background: var(--musgo-fundo);
  color: var(--musgo);
}

.filtro__botao--ativo .filtro__botao-icone {
  color: inherit;
}

.filtro__total.ui-contagem {
  height: 20px;
  min-width: 20px;
  padding: 0 6px;
  background: var(--musgo);
  color: var(--sobre-musgo);
  font-size: 11.5px;
}

.filtro__resultado {
  margin-inline-start: auto;
  color: var(--tinta-2);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* ------------------------------------------------------------------------- aplicados */

.filtro__aplicados {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}

.filtro__limpar {
  padding: 4px 2px;
  font-size: 13px;
}

/* ---------------------------------------------------------------------------- painel */

.painel {
  display: grid;
  gap: 18px;
  width: min(24rem, 86vw);
  padding: 6px 4px;
}

.painel__grupo {
  display: grid;
  gap: 10px;
}

.painel__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.painel__opcoes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/*
 * Ficha: um botão de alternar do tamanho da palavra. Raio de controle e não pílula, fio fino em
 * repouso; marcada, ganha o fundo de musgo e o visto — dois sinais além da cor.
 */
.ficha {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  gap: 6px;
  padding: 0 11px;
  border: 1px solid var(--linha-forte);
  border-radius: 8px;
  background: var(--superficie);
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1.2;
  transition:
    background-color var(--pj-tempo-curto, 140ms) ease,
    border-color var(--pj-tempo-curto, 140ms) ease;
}

.ficha:hover {
  border-color: var(--tinta-3);
  background: var(--superficie-2);
}

.ficha:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 2px;
}

.ficha--ativa,
.ficha--ativa:hover,
.ficha--removivel,
.ficha--removivel:hover {
  border-color: color-mix(in oklab, var(--musgo) 45%, var(--linha));
  background: var(--musgo-fundo);
  color: var(--musgo);
  font-weight: 600;
}

.ficha--removivel {
  min-height: 30px;
  padding-inline: 10px 8px;
  font-size: 13px;
}

.ficha--removivel i {
  font-size: 13px;
  opacity: 0.75;
}

.ficha--removivel:hover i {
  opacity: 1;
}

.ficha__marca {
  margin-inline-start: -2px;
  font-size: 14px;
}

.ficha__contagem {
  color: var(--tinta-3);
  font-family: var(--font-dados);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.ficha--ativa .ficha__contagem {
  color: inherit;
  opacity: 0.75;
}

@media (prefers-reduced-motion: reduce) {
  .ficha {
    transition: none;
  }
}

@media (max-width: 640px) {
  .filtro__busca {
    max-width: none;
    flex-basis: 100%;
  }
}
</style>

<style>
/*
 * O painel dos filtros é teleportado para o `body`, fora do escopo deste componente: a moldura dele
 * fica numa regra global, presa à classe própria do painel. Raio de folha e a sombra do que flutua.
 */
.p-popover.clinic-overlay.filtro-painel {
  border-radius: 14px;
  box-shadow: var(--sombra-2);
}

.p-popover.clinic-overlay.filtro-painel .p-popover-content {
  padding: 14px 14px 16px;
}
</style>
