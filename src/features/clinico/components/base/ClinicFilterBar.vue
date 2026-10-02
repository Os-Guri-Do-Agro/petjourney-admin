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
    [grupoId]: atual.includes(valor)
      ? atual.filter((item) => item !== valor)
      : [...atual, valor],
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
        <InputIcon class="pi pi-search" />
        <InputText
          type="search"
          size="small"
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
        size="small"
        icon="pi pi-sliders-h"
        :label="t('clinico.comum.filtros')"
        :badge="total > 0 ? String(total) : undefined"
        :aria-label="t('clinico.comum.filtros')"
        @click="painel?.toggle($event)"
      />

      <span v-if="resultado >= 0" class="filtro__resultado clinic-value">
        {{ t('clinico.comum.resultados', { contagem: resultado }, resultado) }}
      </span>
    </div>

    <!-- O que está aplicado, sem precisar abrir o painel. -->
    <div v-if="aplicados.length > 0" class="filtro__aplicados">
      <Button
        v-for="ficha in aplicados"
        :key="`${ficha.grupo}-${ficha.valor}`"
        type="button"
        class="ficha ficha--removivel"
        severity="secondary"
        outlined
        rounded
        size="small"
        :label="ficha.rotulo"
        icon="pi pi-times"
        icon-pos="right"
        @click="alternar(ficha.grupo, ficha.valor)"
      />

      <Button
        type="button"
        class="filtro__limpar"
        link
        size="small"
        :label="t('clinico.agenda.limparFiltros')"
        @click="limpar"
      />
    </div>

    <Popover ref="painel" class="clinic-overlay hc-tema">
      <div class="painel clinic-scope">
        <section v-for="grupo in grupos" :key="grupo.id" class="painel__grupo">
          <h3 class="clinic-label">{{ grupo.rotulo }}</h3>

          <div class="painel__opcoes">
            <Button
              v-for="opcao in grupo.opcoes"
              :key="opcao.valor"
              type="button"
              class="ficha"
              :class="{ 'ficha--ativa': (selecionados[grupo.id] ?? []).includes(opcao.valor) }"
              severity="secondary"
              outlined
              rounded
              size="small"
              :aria-pressed="(selecionados[grupo.id] ?? []).includes(opcao.valor)"
              @click="alternar(grupo.id, opcao.valor)"
            >
              {{ opcao.rotulo }}
              <span v-if="opcao.contagem !== undefined" class="ficha__contagem">
                {{ opcao.contagem }}
              </span>
            </Button>
          </div>
        </section>
      </div>
    </Popover>
  </div>
</template>

<style scoped>
.filtro {
  display: grid;
  gap: var(--clinic-space-2);
}

.filtro__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-2);
}

.filtro__busca {
  flex: 1 1 18rem;
  max-width: 28rem;
}

/* Com filtro aplicado o botão acende: é o aviso de que a lista não está inteira. */
.filtro__botao--ativo.p-button.p-button-secondary.p-button-outlined {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.filtro__resultado {
  margin-inline-start: auto;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.filtro__aplicados {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-1);
}

.filtro__limpar.p-button {
  padding-inline: var(--clinic-space-2);
  font-size: var(--clinic-font-label);
}

.painel {
  display: grid;
  gap: var(--clinic-space-4);
  width: min(24rem, 90vw);
  padding: var(--clinic-space-2);
}

.painel__grupo {
  display: grid;
  gap: var(--clinic-space-2);
}

.painel__opcoes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-1);
}

/*
 * Ficha: botão pílula compacto. A especificidade passa a regra global da clínica para botão
 * secundário contornado, que pintaria toda ficha com a borda forte e o texto cheio.
 */
.ficha.p-button {
  min-height: 1.8rem;
  gap: 0.35rem;
  padding: 0 var(--clinic-space-2);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.ficha.p-button.p-button-secondary.p-button-outlined {
  border-color: var(--clinic-line);
  color: var(--clinic-muted);
}

.ficha.p-button.p-button-secondary.p-button-outlined:not(:disabled):hover {
  border-color: var(--clinic-accent);
  background: var(--clinic-surface);
  color: var(--clinic-accent-strong);
}

.ficha--ativa.p-button.p-button-secondary.p-button-outlined,
.ficha--ativa.p-button.p-button-secondary.p-button-outlined:not(:disabled):hover,
.ficha--removivel.p-button.p-button-secondary.p-button-outlined,
.ficha--removivel.p-button.p-button-secondary.p-button-outlined:not(:disabled):hover {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.ficha--removivel.p-button :deep(.p-button-icon) {
  font-size: 0.55rem;
  opacity: 0.7;
}

.ficha__contagem {
  color: var(--clinic-faint);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}

.ficha--ativa .ficha__contagem {
  color: inherit;
  opacity: 0.7;
}
</style>
