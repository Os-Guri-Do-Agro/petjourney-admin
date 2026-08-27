<script setup lang="ts" generic="T">
/**
 * Tabela densa do módulo clínico.
 *
 * Densidade vem dos tokens (32/36/44 px de linha), não de prop: duas tabelas com alturas
 * diferentes na mesma tela seria ruído. Coluna numérica é tabular por padrão — coluna de
 * número que dança na vertical obriga a reler linha a linha, e reler número é onde o erro
 * entra.
 *
 * Navegação por teclado é requisito do módulo, não cortesia: setas movem a linha focada,
 * `Enter` abre, `Home`/`End` vão às pontas.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ColunaTabela } from './table-types'

const props = withDefaults(
  defineProps<{
    colunas: ColunaTabela[]
    linhas: T[]
    chave: (linha: T) => string
    carregando?: boolean
    erro?: string
    vazioTitulo?: string
    vazioDescricao?: string
    selecionadaId?: string | null
    /** Rótulo acessível da tabela inteira. */
    rotulo?: string
  }>(),
  {
    carregando: false,
    erro: '',
    vazioTitulo: '',
    vazioDescricao: '',
    selecionadaId: null,
    rotulo: '',
  },
)

const emit = defineEmits<{
  ativar: [linha: T]
  selecionar: [linha: T]
  tentarDeNovo: []
}>()

const { t } = useI18n()
const corpo = ref<HTMLElement | null>(null)

const template = computed(() =>
  props.colunas.map((coluna) => coluna.largura ?? 'minmax(0, 1fr)').join(' '),
)

/**
 * Em tela estreita a coluna escondida some do template inteiro — trilha e célula juntas.
 *
 * Antes a trilha ficava com largura `0` e a célula levava `display: none`. As duas coisas não
 * combinam: `display: none` **retira o item do grid**, e o posicionamento automático empurra
 * todas as células seguintes uma trilha para trás. A coluna de data caía na trilha de zero
 * pixel e escrevia "2 4 / 0 8" na vertical, com o cabeçalho por cima do vizinho.
 */
const templateEstreito = computed(() =>
  props.colunas
    .filter((coluna) => !coluna.ocultarEmTelaEstreita)
    .map((coluna) => coluna.largura ?? 'minmax(0, 1fr)')
    .join(' '),
)

const vazia = computed(
  () => !props.carregando && !props.erro && props.linhas.length === 0,
)

function focarLinha(indice: number) {
  const alvo = corpo.value?.querySelectorAll<HTMLElement>('[data-linha]')?.[indice]

  alvo?.focus()
}

function aoTeclar(evento: KeyboardEvent, indice: number, linha: T) {
  if (evento.key === 'ArrowDown') {
    evento.preventDefault()
    focarLinha(Math.min(indice + 1, props.linhas.length - 1))

    return
  }

  if (evento.key === 'ArrowUp') {
    evento.preventDefault()
    focarLinha(Math.max(indice - 1, 0))

    return
  }

  if (evento.key === 'Home') {
    evento.preventDefault()
    focarLinha(0)

    return
  }

  if (evento.key === 'End') {
    evento.preventDefault()
    focarLinha(props.linhas.length - 1)

    return
  }

  if (evento.key === 'Enter' || evento.key === ' ') {
    evento.preventDefault()
    emit('ativar', linha)
  }
}
</script>

<template>
  <div class="tabela" role="group" :aria-label="rotulo || undefined">
    <div class="tabela__rolagem">
      <div
        class="tabela__grade"
        :style="{ '--colunas': template, '--colunas-estreita': templateEstreito }"
      >
        <div class="tabela__cabecalho" role="row">
          <div
            v-for="coluna in colunas"
            :key="coluna.id"
            class="tabela__th"
            :class="{
              'tabela__celula--fim': coluna.alinharAoFim,
              'tabela__celula--oculta': coluna.ocultarEmTelaEstreita,
            }"
            role="columnheader"
          >
            {{ coluna.rotulo }}
          </div>
        </div>

        <div v-if="carregando" class="tabela__estado" role="status" aria-live="polite">
          <i class="pi pi-spin pi-spinner" aria-hidden="true" />
          <span>{{ t('clinico.tabela.carregando') }}</span>
        </div>

        <div v-else-if="erro" class="tabela__estado tabela__estado--erro" role="alert">
          <i class="pi pi-exclamation-circle" aria-hidden="true" />
          <span>{{ erro }}</span>
          <button type="button" class="tabela__retry" @click="emit('tentarDeNovo')">
            {{ t('clinico.tabela.tentarDeNovo') }}
          </button>
        </div>

        <div v-else-if="vazia" class="tabela__estado tabela__estado--vazio">
          <i class="pi pi-inbox" aria-hidden="true" />
          <strong>{{ vazioTitulo || t('clinico.tabela.vazio') }}</strong>
          <span v-if="vazioDescricao">{{ vazioDescricao }}</span>
        </div>

        <div v-else ref="corpo" class="tabela__corpo">
          <div
            v-for="(linha, indice) in linhas"
            :key="chave(linha)"
            class="tabela__linha clinic-focusable"
            :class="{ 'tabela__linha--selecionada': selecionadaId === chave(linha) }"
            :data-linha="chave(linha)"
            role="row"
            tabindex="0"
            @click="emit('selecionar', linha)"
            @dblclick="emit('ativar', linha)"
            @keydown="aoTeclar($event, indice, linha)"
          >
            <div
              v-for="coluna in colunas"
              :key="coluna.id"
              class="tabela__td"
              :class="{
                'clinic-value': coluna.numerico,
                'tabela__celula--fim': coluna.alinharAoFim,
                'tabela__celula--oculta': coluna.ocultarEmTelaEstreita,
              }"
              role="cell"
            >
              <slot :name="`celula-${coluna.id}`" :linha="linha" :indice="indice" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tabela {
  overflow: hidden;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

/* Tabela larga rola dentro de si mesma; a página nunca rola na horizontal. */
.tabela__rolagem {
  overflow-x: auto;
}

.tabela__grade {
  min-width: 100%;
}

.tabela__cabecalho,
.tabela__linha {
  display: grid;
  grid-template-columns: var(--colunas);
  align-items: center;
  gap: var(--clinic-space-3);
  padding: 0 var(--clinic-space-4);
}

.tabela__cabecalho {
  position: sticky;
  top: 0;
  z-index: 1;
  min-height: var(--clinic-hit-target);
  padding-block: 0.35rem;
  border-bottom: 1px solid var(--clinic-line);
  background: var(--clinic-surface-soft);
}

.tabela__th {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.tabela__linha {
  min-height: var(--clinic-row-height);
  border-bottom: 1px solid var(--clinic-line-soft);
  cursor: pointer;
  transition: background 120ms ease;
}

.tabela__linha:last-child {
  border-bottom: none;
}

.tabela__linha:hover {
  background: var(--clinic-surface-soft);
}

.tabela__linha--selecionada {
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-weight: 700;
}

.tabela__td {
  min-width: 0;
  padding-block: var(--clinic-cell-padding-y);
  overflow-wrap: anywhere;
}

/*
 * Valor clínico não quebra. Sem isto, uma coluna estreita transforma "7,8 kg" numa coluna de
 * caracteres empilhados — e número ilegível numa tabela clínica é pior que número cortado.
 */
.tabela__td.clinic-value {
  overflow-wrap: normal;
  white-space: nowrap;
}

.tabela__celula--fim {
  justify-self: end;
  text-align: right;
}

.tabela__estado {
  display: grid;
  gap: var(--clinic-space-2);
  justify-items: center;
  padding: var(--clinic-space-6) var(--clinic-space-4);
  color: var(--clinic-muted);
  text-align: center;
}

.tabela__estado i {
  color: var(--clinic-accent-strong);
  font-size: 1.15rem;
}

.tabela__estado--erro {
  color: var(--clinic-risk-text);
}

.tabela__estado--erro i {
  color: var(--clinic-risk-text);
}

.tabela__estado--vazio strong {
  color: var(--clinic-text);
  font-size: var(--clinic-font-value);
}

.tabela__retry {
  min-height: var(--clinic-hit-target);
  padding: 0 var(--clinic-space-4);
  border: 1px solid var(--clinic-line-strong);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
  color: var(--clinic-text);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

@media (max-width: 1024px) {
  .tabela__cabecalho,
  .tabela__linha {
    grid-template-columns: var(--colunas-estreita);
  }

  .tabela__celula--oculta {
    display: none;
  }
}
</style>
