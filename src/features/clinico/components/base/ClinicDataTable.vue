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

import { ordenarLinhas, proximaOrdenacao } from '../../domain/table-sort'

import type { AcaoDeLinha, ColunaTabela, OrdenacaoTabela } from './table-types'

const props = withDefaults(
  defineProps<{
    colunas: ColunaTabela<T>[]
    linhas: T[]
    chave: (linha: T) => string
    carregando?: boolean
    erro?: string
    vazioTitulo?: string
    vazioDescricao?: string
    selecionadaId?: string | null
    /**
     * Somente leitura: o quarto estado.
     *
     * Não é "desabilitada". A tabela continua legível, rolável e ordenável — o que sai é o
     * que **muda alguma coisa**: seleção e ações. Prontuário finalizado e atendimento em
     * edição noutro dispositivo são para ler, e ler continua valendo.
     */
    somenteLeitura?: boolean
    motivoSomenteLeitura?: string
    /** Ações por linha. Vazio significa coluna de ação nenhuma. */
    acoes?: AcaoDeLinha<T>[]
    /** Rótulo acessível da tabela inteira. */
    rotulo?: string
  }>(),
  {
    carregando: false,
    erro: '',
    vazioTitulo: '',
    vazioDescricao: '',
    selecionadaId: null,
    somenteLeitura: false,
    motivoSomenteLeitura: '',
    acoes: () => [],
    rotulo: '',
  },
)

const emit = defineEmits<{
  ativar: [linha: T]
  selecionar: [linha: T]
  tentarDeNovo: []
  acao: [payload: { acao: AcaoDeLinha<T>; linha: T }]
}>()

const { t, locale } = useI18n()
const corpo = ref<HTMLElement | null>(null)

// --------------------------------------------------------------------------- ordenação

const ordenacao = ref<OrdenacaoTabela>({ coluna: null, direcao: 'asc' })

const colunaOrdenada = computed(() =>
  props.colunas.find((coluna) => coluna.id === ordenacao.value.coluna) ?? null,
)

/**
 * As linhas como a tabela as mostra.
 *
 * Sem coluna escolhida, devolve a lista **como veio** — a ordem de chegada costuma ser
 * significativa (a fila chega por prioridade e antiguidade) e não pode ser perdida só por a
 * tabela saber ordenar.
 */
const linhasVisiveis = computed(() => {
  const coluna = colunaOrdenada.value

  if (!coluna?.ordenarPor) {
    return props.linhas
  }

  return ordenarLinhas(props.linhas, coluna.ordenarPor, ordenacao.value.direcao, locale.value)
})

function ordemInicialDe(coluna: ColunaTabela<T>) {
  return coluna.ordemInicial ?? (coluna.numerico ? 'desc' : 'asc')
}

function alternarOrdenacao(coluna: ColunaTabela<T>) {
  if (!coluna.ordenarPor) {
    return
  }

  ordenacao.value = proximaOrdenacao(ordenacao.value, coluna.id, ordemInicialDe(coluna))
}

/** `aria-sort` é o que faz a ordenação existir para leitor de tela; a seta é para o resto. */
function ariaSort(coluna: ColunaTabela<T>) {
  if (!coluna.ordenarPor) {
    return undefined
  }

  if (ordenacao.value.coluna !== coluna.id) {
    return 'none' as const
  }

  return ordenacao.value.direcao === 'asc' ? ('ascending' as const) : ('descending' as const)
}

// ------------------------------------------------------------------------------ ações

const temAcoes = computed(() => props.acoes.length > 0 && !props.somenteLeitura)

function acoesDaLinha(linha: T) {
  return props.acoes.filter((acao) => acao.visivel?.(linha) ?? true)
}

/**
 * O `stopPropagation` que toda tela reimplementava.
 *
 * Sem ele, clicar em "Remover" também seleciona a linha — e a tela abre o detalhe do registro
 * que acabou de sair.
 */
function dispararAcao(evento: MouseEvent, acao: AcaoDeLinha<T>, linha: T) {
  evento.stopPropagation()

  if (acao.desabilitada?.(linha)) {
    return
  }

  emit('acao', { acao, linha })
}

function aoSelecionar(linha: T) {
  if (props.somenteLeitura) {
    return
  }

  emit('selecionar', linha)
}

/**
 * Largura da coluna de ações.
 *
 * Sai do número de ações em vez de ser fixa: uma tabela com uma ação não deve reservar a
 * largura de três, e três ações não podem espremer-se na largura de uma.
 */
const larguraDasAcoes = computed(() => `${Math.max(props.acoes.length, 1) * 2.2 + 0.6}rem`)

const template = computed(() =>
  [
    ...props.colunas.map((coluna) => coluna.largura ?? 'minmax(0, 1fr)'),
    ...(temAcoes.value ? [larguraDasAcoes.value] : []),
  ].join(' '),
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
  [
    ...props.colunas
      .filter((coluna) => !coluna.ocultarEmTelaEstreita)
      .map((coluna) => coluna.largura ?? 'minmax(0, 1fr)'),
    ...(temAcoes.value ? [larguraDasAcoes.value] : []),
  ].join(' '),
)

const vazia = computed(
  () => !props.carregando && !props.erro && props.linhas.length === 0,
)

function focarLinha(indice: number) {
  const alvo = corpo.value?.querySelectorAll<HTMLElement>('[data-linha]')?.[indice]

  alvo?.focus()
}

function aoTeclar(evento: KeyboardEvent, indice: number, linha: T) {
  const total = linhasVisiveis.value.length

  if (evento.key === 'ArrowDown') {
    evento.preventDefault()
    focarLinha(Math.min(indice + 1, total - 1))

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
    focarLinha(total - 1)

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
              'tabela__th--ordenavel': Boolean(coluna.ordenarPor),
              'tabela__th--ativa': ordenacao.coluna === coluna.id,
            }"
            role="columnheader"
            :aria-sort="ariaSort(coluna)"
          >
            <!--
              Coluna ordenável é um botão de verdade, não um `div` com `@click`: é o que dá
              foco por teclado e ativação por `Enter` de graça.
            -->
            <button
              v-if="coluna.ordenarPor"
              type="button"
              class="tabela__ordenar clinic-focusable"
              @click="alternarOrdenacao(coluna)"
            >
              <span>{{ coluna.rotulo }}</span>
              <!--
                A seta só aparece na coluna ativa; nas demais, um traço discreto no hover diz
                que dá para ordenar. Sete setas cinzas no cabeçalho ensinam a ignorar todas.
              -->
              <i
                class="pi tabela__seta"
                :class="
                  ordenacao.coluna === coluna.id
                    ? ordenacao.direcao === 'asc'
                      ? 'pi-sort-amount-up-alt'
                      : 'pi-sort-amount-down'
                    : 'pi-sort-alt tabela__seta--fantasma'
                "
                aria-hidden="true"
              />
            </button>

            <template v-else>{{ coluna.rotulo }}</template>
          </div>

          <div v-if="temAcoes" class="tabela__th tabela__celula--fim" role="columnheader">
            <span class="tabela__oculto-visual">{{ t('clinico.tabela.acoes') }}</span>
          </div>
        </div>

        <!--
          Somente leitura anuncia o motivo. Tabela que simplesmente para de responder ao
          clique parece quebrada; com o motivo, é uma regra.
        -->
        <p v-if="somenteLeitura && motivoSomenteLeitura" class="tabela__leitura" role="status">
          <i class="pi pi-lock" aria-hidden="true" />
          <span>{{ motivoSomenteLeitura }}</span>
        </p>

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
            v-for="(linha, indice) in linhasVisiveis"
            :key="chave(linha)"
            class="tabela__linha clinic-focusable"
            :class="{
              'tabela__linha--selecionada': selecionadaId === chave(linha),
              'tabela__linha--leitura': somenteLeitura,
            }"
            :data-linha="chave(linha)"
            role="row"
            tabindex="0"
            @click="aoSelecionar(linha)"
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

            <div v-if="temAcoes" class="tabela__td tabela__acoes" role="cell">
              <button
                v-for="acao in acoesDaLinha(linha)"
                :key="acao.id"
                type="button"
                class="tabela__acao clinic-focusable"
                :class="{ 'tabela__acao--perigo': acao.perigo }"
                :disabled="acao.desabilitada?.(linha) ?? false"
                :title="acao.rotulo"
                :aria-label="acao.rotulo"
                @click="dispararAcao($event, acao, linha)"
              >
                <i v-if="acao.icone" :class="acao.icone" aria-hidden="true" />
                <span v-else>{{ acao.rotulo }}</span>
              </button>
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

/* ------------------------------------------------------------------------- ordenação */

.tabela__ordenar {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  max-width: 100%;
  padding: 0;
  border: 0;
  border-radius: 0.3rem;
  background: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
}

.tabela__ordenar:hover {
  color: var(--clinic-text);
}

.tabela__th--ativa {
  color: var(--clinic-text);
}

.tabela__seta {
  flex: 0 0 auto;
  font-size: 0.62rem;
}

/*
 * Nas colunas ordenáveis ainda não usadas, a seta fica invisível e só aparece no hover ou no
 * foco. Sete setas cinzas permanentes no cabeçalho treinam o olho a ignorar todas — inclusive
 * a que marca a ordenação em vigor.
 */
.tabela__seta--fantasma {
  opacity: 0;
  transition: opacity 120ms ease;
}

.tabela__ordenar:hover .tabela__seta--fantasma,
.tabela__ordenar:focus-visible .tabela__seta--fantasma {
  opacity: 0.55;
}

/* -------------------------------------------------------------------- somente leitura */

.tabela__leitura {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: var(--clinic-cell-padding-y) var(--clinic-space-4);
  border-bottom: 1px solid var(--clinic-line);
  background: var(--clinic-surface-soft);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.tabela__linha {
  min-height: var(--clinic-row-height);
  border-bottom: 1px solid var(--clinic-line-soft);
  cursor: pointer;
  transition: background 120ms ease;
}

/* Leitura não é "desabilitada": o texto continua com contraste cheio, só não é clicável. */
.tabela__linha--leitura {
  cursor: default;
}

.tabela__linha--leitura:hover {
  background: transparent;
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

/* ----------------------------------------------------------------------- ações da linha */

.tabela__acoes {
  display: flex;
  justify-content: flex-end;
  gap: 0.15rem;
}

/*
 * As ações só aparecem no hover, no foco de dentro delas ou na linha selecionada. Uma fileira
 * de ícones em todas as linhas de uma tabela de duzentas transforma a coluna num padrão
 * visual que compete com o dado — e a tabela clínica existe para ler dado.
 */
.tabela__acao {
  display: grid;
  width: var(--clinic-hit-target);
  height: var(--clinic-hit-target);
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid transparent;
  border-radius: var(--clinic-radius-control);
  background: transparent;
  color: var(--clinic-muted);
  cursor: pointer;
  font: inherit;
  opacity: 0;
  transition:
    opacity 120ms ease,
    background 120ms ease;
}

.tabela__linha:hover .tabela__acao,
.tabela__linha--selecionada .tabela__acao,
.tabela__acao:focus-visible {
  opacity: 1;
}

.tabela__acao:hover:not(:disabled) {
  border-color: var(--clinic-line-strong);
  background: var(--clinic-surface);
  color: var(--clinic-text);
}

.tabela__acao--perigo:hover:not(:disabled) {
  border-color: var(--clinic-risk-line);
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
}

.tabela__acao:disabled {
  cursor: not-allowed;
  opacity: 0.3;
}

/*
 * Sem `hover` — dedo e caneta não têm hover, e a ação ficaria inalcançável. Em tela de toque
 * as ações são sempre visíveis.
 */
@media (hover: none) {
  .tabela__acao {
    opacity: 1;
  }
}

/** Escondido do olho, presente para leitor de tela. */
.tabela__oculto-visual {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
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
