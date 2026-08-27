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
      <label class="filtro__busca">
        <i class="pi pi-search" aria-hidden="true" />
        <input
          class="filtro__campo"
          type="search"
          :value="busca"
          :placeholder="placeholderBusca"
          :aria-label="placeholderBusca"
          @input="emit('update:busca', ($event.target as HTMLInputElement).value)"
        />
      </label>

      <button
        type="button"
        class="filtro__botao clinic-focusable"
        :class="{ 'filtro__botao--ativo': total > 0 }"
        :aria-label="t('clinico.comum.filtros')"
        @click="painel?.toggle($event)"
      >
        <i class="pi pi-sliders-h" aria-hidden="true" />
        <span>{{ t('clinico.comum.filtros') }}</span>
        <span v-if="total > 0" class="filtro__contagem">{{ total }}</span>
      </button>

      <span v-if="resultado >= 0" class="filtro__resultado clinic-value">
        {{ t('clinico.comum.resultados', { contagem: resultado }, resultado) }}
      </span>
    </div>

    <!-- O que está aplicado, sem precisar abrir o painel. -->
    <div v-if="aplicados.length > 0" class="filtro__aplicados">
      <button
        v-for="ficha in aplicados"
        :key="`${ficha.grupo}-${ficha.valor}`"
        type="button"
        class="ficha ficha--removivel clinic-focusable"
        @click="alternar(ficha.grupo, ficha.valor)"
      >
        {{ ficha.rotulo }}
        <i class="pi pi-times" aria-hidden="true" />
      </button>

      <button type="button" class="filtro__limpar clinic-focusable" @click="limpar">
        {{ t('clinico.agenda.limparFiltros') }}
      </button>
    </div>

    <Popover ref="painel" class="clinic-overlay">
      <div class="painel clinic-scope">
        <section v-for="grupo in grupos" :key="grupo.id" class="painel__grupo">
          <h3 class="clinic-label">{{ grupo.rotulo }}</h3>

          <div class="painel__opcoes">
            <button
              v-for="opcao in grupo.opcoes"
              :key="opcao.valor"
              type="button"
              class="ficha clinic-focusable"
              :class="{ 'ficha--ativa': (selecionados[grupo.id] ?? []).includes(opcao.valor) }"
              :aria-pressed="(selecionados[grupo.id] ?? []).includes(opcao.valor)"
              @click="alternar(grupo.id, opcao.valor)"
            >
              {{ opcao.rotulo }}
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
  gap: var(--clinic-space-2);
}

.filtro__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-2);
}

.filtro__busca {
  position: relative;
  display: block;
  flex: 1 1 18rem;
  max-width: 28rem;
}

.filtro__busca i {
  position: absolute;
  top: 50%;
  left: var(--clinic-space-3);
  color: var(--clinic-faint);
  font-size: 0.8rem;
  pointer-events: none;
  transform: translateY(-50%);
}

.filtro__campo {
  width: 100%;
  min-height: 2.3rem;
  padding: 0 var(--clinic-space-3) 0 2.1rem;
  border: 1px solid var(--clinic-line-strong);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
  color: var(--clinic-text);
  font: inherit;
  font-size: var(--clinic-font-base);
}

.filtro__campo::placeholder {
  color: var(--clinic-faint);
}

.filtro__campo:focus {
  border-color: var(--clinic-accent-deep);
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--clinic-accent) 35%, transparent);
}

.filtro__botao {
  display: inline-flex;
  min-height: 2.3rem;
  align-items: center;
  gap: 0.35rem;
  padding: 0 var(--clinic-space-3);
  border: 1px solid var(--clinic-line-strong);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
  color: var(--clinic-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.filtro__botao:hover {
  border-color: var(--clinic-accent);
  color: var(--clinic-accent-strong);
}

.filtro__botao--ativo {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.filtro__contagem {
  min-width: 1.1rem;
  padding: 0 0.25rem;
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-accent-strong);
  color: var(--clinic-surface);
  font-size: 0.62rem;
  font-weight: 800;
  text-align: center;
}

.filtro__resultado {
  margin-left: auto;
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

.filtro__limpar {
  border: none;
  background: none;
  color: var(--clinic-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
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

.ficha {
  display: inline-flex;
  min-height: 1.8rem;
  align-items: center;
  gap: 0.35rem;
  padding: 0 var(--clinic-space-2);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-surface);
  color: var(--clinic-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.ficha:hover {
  border-color: var(--clinic-accent);
  color: var(--clinic-accent-strong);
}

.ficha--ativa {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.ficha--removivel {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.ficha--removivel i {
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
