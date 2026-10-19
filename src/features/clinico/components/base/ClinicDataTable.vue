<script setup lang="ts" generic="T">
/**
 * Tabela do módulo clínico, na folha do Trilha.
 *
 * Uma folha (`--superficie`, fio `--linha`, raio 16, sem sombra) com o rótulo das colunas em
 * caixa normal e linhas de 58 px — a mesma altura das linhas de lista (`ui-linha`), para que a
 * tabela de faltas e a pauta do Hoje leiam como a mesma família. A densidade escolhida na Agenda
 * ainda vale aqui (46/58/64 px), mas vem da raiz, não de prop: duas tabelas com alturas
 * diferentes na mesma tela seria ruído. Coluna numérica é tabular por padrão — coluna de
 * número que dança na vertical obriga a reler linha a linha, e reler número é onde o erro
 * entra.
 *
 * Navegação por teclado é requisito do módulo, não cortesia: setas movem a linha focada,
 * `Enter` abre, `Home`/`End` vão às pontas.
 */
import Button from 'primevue/button'
import { computed, getCurrentInstance, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { INTL_LOCALE, type Locale } from '@/i18n/locales'

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

const colunaOrdenada = computed(
  () => props.colunas.find((coluna) => coluna.id === ordenacao.value.coluna) ?? null,
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

  return ordenarLinhas(
    props.linhas,
    coluna.ordenarPor,
    ordenacao.value.direcao,
    INTL_LOCALE[locale.value as Locale],
  )
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

/**
 * A seta de abrir, e por que ela precisa existir.
 *
 * A linha sempre abriu — `@dblclick` no mouse, `Enter` no teclado. Só que duplo clique é convenção
 * de grade de aplicativo desktop: na web ninguém tenta, e o resultado é uma lista que parece
 * inerte. Quem olhou esta tela concluiu que não havia interação nenhuma, e estava certo do ponto
 * de vista de quem usa: uma ação que não se anuncia não existe.
 *
 * A seta é a única coisa que muda. O clique simples continua selecionando, o duplo continua
 * abrindo, e o teclado continua igual — trocar essas regras mexeria no hábito de oito telas, e o
 * problema aqui nunca foi o que o clique faz, foi ninguém saber que ele faz.
 *
 * ## Por que detectar o ouvinte em vez de uma prop
 *
 * Três das nove telas que usam esta tabela (`faltas`, `fila`, e a página de design) não escutam
 * `ativar`: nelas a linha não leva a lugar nenhum. Uma prop de opt-in obrigaria a editar as seis
 * restantes uma a uma, e quem criasse a décima tela esqueceria — o padrão voltaria a ser a seta
 * ausente. Lendo o ouvinte, quem passa `@ativar` ganha a seta no mesmo gesto em que declara que a
 * linha abre, e quem não passa não ganha seta morta.
 */
const podeAbrir = computed(
  () => Boolean(getCurrentInstance()?.vnode.props?.onAtivar) && !props.somenteLeitura,
)

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
/**
 * Largura da coluna de ações: 2,2 rem por ícone, e o tamanho do rótulo para a ação escrita. A ação
 * principal de uma linha (o "Registrar aceite" da fila) vai por extenso — ícone de ✓ sozinho não
 * diz aceite de quê.
 */
const larguraDasAcoes = computed(() => {
  const soma = props.acoes.reduce(
    (total, acao) => total + (acao.icone ? 2.2 : 1.2 + acao.rotulo.length * 0.48),
    0,
  )

  return `${Math.max(soma, 2.2) + 0.6}rem`
})

/**
 * A trilha da seta é fixa e estreita: ela não é uma coluna de dado, é a borda da linha ganhando
 * uma alça. Reservada sempre que a linha abre, mesmo com a seta invisível, para que aparecer ao
 * passar o mouse não empurre o conteúdo da linha um centímetro para a esquerda.
 */
const LARGURA_DA_SETA = '1.75rem'

const template = computed(() =>
  [
    ...props.colunas.map((coluna) => coluna.largura ?? 'minmax(0, 1fr)'),
    ...(temAcoes.value ? [larguraDasAcoes.value] : []),
    ...(podeAbrir.value ? [LARGURA_DA_SETA] : []),
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
    ...(podeAbrir.value ? [LARGURA_DA_SETA] : []),
  ].join(' '),
)

const vazia = computed(() => !props.carregando && !props.erro && props.linhas.length === 0)

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
              class="tabela__ordenar"
              @click="alternarOrdenacao(coluna)"
            >
              <span class="tabela__ordenar-rotulo">{{ coluna.rotulo }}</span>
              <!--
                A seta só aparece na coluna ativa; nas demais, um traço discreto no hover diz
                que dá para ordenar. Sete setas cinzas no cabeçalho ensinam a ignorar todas.
              -->
              <i
                class="ph tabela__seta"
                :class="
                  ordenacao.coluna === coluna.id
                    ? ordenacao.direcao === 'asc'
                      ? 'ph-arrow-up'
                      : 'ph-arrow-down'
                    : 'ph-arrows-down-up tabela__seta--fantasma'
                "
                aria-hidden="true"
              />
            </button>

            <template v-else>{{ coluna.rotulo }}</template>
          </div>

          <div v-if="temAcoes" class="tabela__th tabela__celula--fim" role="columnheader">
            <span class="tabela__oculto-visual">{{ t('clinico.tabela.acoes') }}</span>
          </div>

          <div v-if="podeAbrir" class="tabela__th tabela__celula--fim" role="columnheader">
            <span class="tabela__oculto-visual">{{ t('clinico.tabela.abrir') }}</span>
          </div>
        </div>

        <!--
          Somente leitura anuncia o motivo. Tabela que simplesmente para de responder ao
          clique parece quebrada; com o motivo, é uma regra.
        -->
        <p v-if="somenteLeitura && motivoSomenteLeitura" class="tabela__leitura" role="status">
          <i class="ph ph-lock-simple" aria-hidden="true" />
          <span>{{ motivoSomenteLeitura }}</span>
        </p>

        <!--
          Os três estados têm a cara dos estados da página (`UiPagina`): o sinal num disco, uma
          frase e, quando existe, a saída. A tabela que carrega, falha ou volta vazia continua
          sendo a mesma folha — o cabeçalho das colunas fica, e diz o que vai aparecer ali.
        -->
        <div v-if="carregando" class="tabela__estado" role="status" aria-live="polite">
          <span class="tabela__girando" aria-hidden="true" />
          <p class="tabela__estado-frase">{{ t('clinico.tabela.carregando') }}</p>
        </div>

        <div v-else-if="erro" class="tabela__estado tabela__estado--erro" role="alert">
          <span class="tabela__estado-icone" aria-hidden="true">
            <i class="ph ph-warning-circle" />
          </span>
          <p class="tabela__estado-frase">{{ erro }}</p>
          <Button
            type="button"
            class="tabela__retry"
            severity="secondary"
            outlined
            icon="ph ph-arrow-clockwise"
            :label="t('clinico.tabela.tentarDeNovo')"
            @click="emit('tentarDeNovo')"
          />
        </div>

        <div v-else-if="vazia" class="tabela__estado tabela__estado--vazio">
          <span class="tabela__estado-icone" aria-hidden="true"><i class="ph ph-tray" /></span>
          <strong class="tabela__estado-titulo">{{
            vazioTitulo || t('clinico.tabela.vazio')
          }}</strong>
          <p v-if="vazioDescricao" class="tabela__estado-frase">{{ vazioDescricao }}</p>

          <!--
            A saída do vazio.

            Lista vazia que só descreve o vazio deixa quem chegou sem próximo passo — e o
            próximo passo quase sempre existe: cadastrar o que não está lá. O slot é opcional
            porque nem toda tabela tem uma saída (a fila de hoje vazia é boa notícia).
          -->
          <div v-if="$slots['vazio-acao']" class="tabela__estado-acao">
            <slot name="vazio-acao" />
          </div>
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
            :aria-selected="selecionadaId === chave(linha) ? true : undefined"
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
              <Button
                v-for="acao in acoesDaLinha(linha)"
                :key="acao.id"
                type="button"
                class="tabela__acao"
                :class="{
                  'tabela__acao--perigo': acao.perigo,
                  'tabela__acao--escrita': !acao.icone,
                }"
                :text="Boolean(acao.icone)"
                :outlined="!acao.icone"
                :severity="acao.perigo ? 'danger' : 'secondary'"
                size="small"
                :icon="acao.icone"
                :label="acao.icone ? undefined : acao.rotulo"
                :disabled="acao.desabilitada?.(linha) ?? false"
                :title="acao.rotulo"
                :aria-label="acao.rotulo"
                @click="dispararAcao($event, acao, linha)"
              />
            </div>

            <!--
              Botão de verdade, e não um ícone decorativo: quem navega por teclado chega nele com
              Tab e o aciona com Enter, e o leitor de tela anuncia "Abrir <linha>" em vez de uma
              seta muda. O `stopPropagation` impede que abrir também selecione por baixo.
            -->
            <div v-if="podeAbrir" class="tabela__td tabela__abrir" role="cell">
              <button
                type="button"
                class="tabela__seta-abrir"
                :aria-label="t('clinico.tabela.abrir')"
                :title="t('clinico.tabela.abrir')"
                @click.stop="emit('ativar', linha)"
              >
                <i class="ph ph-caret-right" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * A folha. Plana: no Trilha a sombra é só do que flutua, e a tabela não flutua — ela é o chão
 * da tela. O fio `--linha` é quem separa a folha do fundo.
 */
.tabela {
  /*
   * 58 px na densidade média, e a escolha da Agenda vale aqui também (52 na compacta, 70 na
   * confortável): o token da densidade é a linha antiga de 32/36/44 px, e a régua nova sai dele.
   */
  --tabela-linha: calc(var(--clinic-row-height, 36px) * 1.5 + 4px);
  --tabela-recuo: 18px;

  overflow: hidden;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
  color: var(--tinta);
  font-family: var(--font-texto);
  font-size: 14px;
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
  gap: 16px;
  padding: 0 var(--tabela-recuo);
}

/* ---------------------------------------------------------------------- cabeçalho */

/*
 * O rótulo das colunas é frase, como o resto do sistema: 12.5 px, peso 550, tinta secundária.
 * A caixa alta espaçada era o rótulo do design anterior — gritava mais alto que o dado.
 */
.tabela__cabecalho {
  position: sticky;
  top: 0;
  z-index: 1;
  min-height: 44px;
  border-bottom: 1px solid var(--linha);
  background: var(--superficie);
}

/* `.tabela .tabela__th` vence a regra global antiga de `.hc-tema .tabela__th`. */
.tabela .tabela__th {
  min-width: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
  letter-spacing: 0;
  line-height: 1.3;
  text-transform: none;
}

/* ------------------------------------------------------------------------- ordenação */

/*
 * O botão é o próprio rótulo da coluna, só que clicável: herda a tipografia do cabeçalho e
 * troca o fundo de hover por uma mudança de tinta. Um fundo de botão atrás de uma palavra de
 * 12 px vira uma pílula maior que a palavra.
 */
.tabela__ordenar {
  position: relative;
  display: inline-flex;
  max-width: 100%;
  min-height: 28px;
  align-items: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
  letter-spacing: inherit;
  text-align: inherit;
}

.tabela__ordenar-rotulo {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tabela__ordenar:hover {
  color: var(--tinta);
}

.tabela__ordenar:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 3px;
}

.tabela .tabela__th--ativa {
  color: var(--tinta);
  font-weight: 600;
}

/*
 * A seta mora **fora** do rótulo, no vão entre as colunas (16 px): dentro dele ela tomava a
 * largura de uma coluna estreita mesmo invisível, e "Faltas" virava "Fa…". Na coluna alinhada ao
 * fim ela passa para o lado de dentro, à esquerda do rótulo.
 */
.tabela__seta {
  position: absolute;
  top: 50%;
  inset-inline-start: calc(100% + 2px);
  font-size: 13px;
  transform: translateY(-50%);
}

.tabela__celula--fim .tabela__seta {
  inset-inline: auto calc(100% + 2px);
}

/*
 * Nas colunas ordenáveis ainda não usadas, a seta fica invisível e só aparece no hover ou no
 * foco. Sete setas cinzas permanentes no cabeçalho treinam o olho a ignorar todas — inclusive
 * a que marca a ordenação em vigor.
 */
.tabela__seta--fantasma {
  color: var(--tinta-3);
  opacity: 0;
  transition: opacity var(--pj-tempo-curto, 140ms) ease;
}

.tabela__ordenar:hover .tabela__seta--fantasma,
.tabela__ordenar:focus-visible .tabela__seta--fantasma {
  opacity: 1;
}

/* -------------------------------------------------------------------- somente leitura */

.tabela__leitura {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px var(--tabela-recuo);
  border-bottom: 1px solid var(--linha);
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 500;
}

.tabela__leitura i {
  font-size: 15px;
}

/* --------------------------------------------------------------------------- linhas */

.tabela__linha {
  position: relative;
  min-height: var(--tabela-linha);
  border-bottom: 1px solid var(--linha);
  cursor: pointer;
  transition: background-color var(--pj-tempo-curto, 140ms) ease;
}

.tabela__linha:last-child {
  border-bottom: none;
}

.tabela__linha:hover {
  background: var(--superficie-2);
}

/*
 * A linha escolhida: o fundo de musgo e o traço do lugar na borda esquerda — o mesmo traço das
 * linhas de lista (`ui-marca`), aqui dizendo "é esta" e não uma gravidade. O texto não muda de
 * peso: negrito numa linha inteira faz a coluna saltar de largura.
 */
.tabela__linha--selecionada,
.tabela__linha--selecionada:hover {
  background: var(--musgo-fundo);
}

.tabela__linha--selecionada::before {
  position: absolute;
  top: 10px;
  bottom: 10px;
  inset-inline-start: 0;
  width: 4px;
  border-start-end-radius: 4px;
  border-end-end-radius: 4px;
  background: var(--pj-lugar, var(--musgo));
  content: '';
}

/* O foco do teclado é um contorno por dentro: a folha corta qualquer anel que saia dela. */
.tabela__linha.clinic-focusable:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: -2px;
  box-shadow: none;
}

/* Leitura não é "desabilitada": o texto continua com contraste cheio, só não é clicável. */
.tabela__linha--leitura {
  cursor: default;
}

.tabela__linha--leitura:hover {
  background: transparent;
}

.tabela__td {
  min-width: 0;
  padding-block: 8px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

/*
 * Valor clínico não quebra e usa a fonte de dados. Sem isto, uma coluna estreita transforma
 * "7,8 kg" numa coluna de caracteres empilhados — e número ilegível numa tabela clínica é pior
 * que número cortado.
 */
.tabela__td.clinic-value {
  font-family: var(--font-dados);
  font-feature-settings: 'tnum' 1;
  font-size: 14.5px;
  font-variant-numeric: tabular-nums;
  overflow-wrap: normal;
  white-space: nowrap;
}

.tabela__celula--fim {
  justify-self: end;
  text-align: end;
}

/* ----------------------------------------------------------------------- ações da linha */

.tabela__acoes {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

/*
 * ## Por que a seta fica visível o tempo todo, em vez de aparecer ao passar o mouse
 *
 * Revelar no `:hover` resolveria o "qual linha estou apontando" e deixaria intacto o problema que
 * originou isto: a lista **parece inerte à primeira vista**. Quem abre a tela e varre os olhos não
 * passa o mouse em nada; decide em um segundo se ali há algo clicável. Uma coluna de setas fracas
 * responde essa pergunta antes de qualquer gesto — é o mesmo motivo pelo qual a lista do celular
 * carrega o seu chevron sempre aceso.
 *
 * Fraca é o que a mantém honesta: ela informa que a linha leva a algum lugar sem competir com o
 * dado, que é o que a pessoa veio ler. No `:hover` e no foco ela ganha tinta, e aí sim responde
 * "esta aqui".
 */
.tabela__abrir {
  display: flex;
  justify-content: flex-end;
}

.tabela__seta-abrir {
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--tinta-3);
  cursor: pointer;
  font-size: 16px;
  place-items: center;
  transition:
    color var(--pj-tempo-curto, 140ms) ease-out,
    background-color var(--pj-tempo-curto, 140ms) ease-out;
}

.tabela__linha:hover .tabela__seta-abrir,
.tabela__linha:focus-within .tabela__seta-abrir {
  color: var(--tinta);
}

.tabela__seta-abrir:hover {
  background: var(--superficie-3);
  color: var(--tinta);
}

.tabela__seta-abrir:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 0;
}

/* RTL: a seta aponta para onde a leitura avança. */
[dir='rtl'] .tabela__seta-abrir i {
  transform: scaleX(-1);
}

/* Linha só de leitura não leva a lugar nenhum: a seta seria uma promessa falsa. */
.tabela__linha--leitura .tabela__seta-abrir {
  display: none;
}

/*
 * As ações de ícone só aparecem no hover, no foco de dentro delas ou na linha selecionada. Uma
 * fileira de ícones em todas as linhas de uma tabela de duzentas transforma a coluna num padrão
 * visual que compete com o dado — e a tabela clínica existe para ler dado.
 */
.tabela__acao.p-button {
  min-width: 36px;
  min-height: 36px;
  flex: 0 0 auto;
  border-radius: 10px;
  opacity: 0;
  transition:
    opacity var(--pj-tempo-curto, 140ms) ease,
    background-color var(--pj-tempo-curto, 140ms) ease;
}

.tabela__acao.p-button.p-button-text {
  color: var(--tinta-2);
}

.tabela__acao.p-button.p-button-text:not(:disabled):hover {
  background: var(--superficie-3);
  color: var(--tinta);
}

.tabela__linha:hover .tabela__acao,
.tabela__linha:focus-within .tabela__acao,
.tabela__linha--selecionada .tabela__acao,
.tabela__acao.p-button:focus-visible {
  opacity: 1;
}

/*
 * A ação escrita é a principal da linha ("Registrar aceite"): fica sempre à vista, contornada. O
 * esconde-até-o-hover vale para fileira de ícones, que viraria textura; uma ação por extenso que só
 * aparece com o mouse em cima é a ação que ninguém encontra.
 */
.tabela__acao--escrita.p-button {
  padding-inline: 12px;
  border-color: var(--linha-forte);
  background: var(--superficie);
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 550;
  opacity: 1;
  white-space: nowrap;
}

.tabela__acao--escrita.p-button:not(:disabled):hover {
  border-color: var(--tinta-3);
  background: var(--superficie-2);
  color: var(--tinta);
}

.tabela__acao.p-button-icon-only {
  width: 36px;
}

.tabela__acao.p-button :deep(.p-button-icon) {
  font-size: 16px;
}

.tabela__acao--perigo.p-button.p-button-text,
.tabela__acao--perigo.p-button.p-button-outlined {
  color: var(--risco-tinta);
}

.tabela__acao--perigo.p-button:not(:disabled):hover,
.tabela__acao--perigo.p-button.p-button-text:not(:disabled):hover {
  border-color: var(--risco-fundo);
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.tabela__linha:hover .tabela__acao.p-button:disabled,
.tabela__linha--selecionada .tabela__acao.p-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

/*
 * Sem `hover` — dedo e caneta não têm hover, e a ação ficaria inalcançável. Em tela de toque
 * as ações são sempre visíveis.
 */
@media (hover: none) {
  .tabela__acao.p-button {
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

/* --------------------------------------------------------------------------- estados */

.tabela__estado {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 44px 24px 48px;
  text-align: center;
}

.tabela__estado-icone {
  display: grid;
  width: 52px;
  height: 52px;
  margin-bottom: 4px;
  place-items: center;
  border-radius: 16px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 24px;
}

.tabela__estado--erro .tabela__estado-icone {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.tabela__estado-titulo {
  color: var(--tinta);
  font-size: 16px;
  font-weight: 600;
}

.tabela__estado-frase {
  max-width: 48ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

.tabela__estado--erro .tabela__estado-frase {
  color: var(--tinta);
}

.tabela__estado-acao,
.tabela__retry.p-button {
  margin-top: 10px;
}

/* O mesmo anel que gira no carregando da página. */
.tabela__girando {
  width: 28px;
  height: 28px;
  margin-bottom: 4px;
  border: 3px solid var(--superficie-3);
  border-top-color: var(--pj-lugar, var(--musgo));
  border-radius: 50%;
  animation: tabela-girar 0.9s linear infinite;
}

@keyframes tabela-girar {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tabela__linha,
  .tabela__seta-abrir,
  .tabela__acao.p-button,
  .tabela__seta--fantasma {
    transition: none;
  }

  .tabela__girando {
    animation-duration: 2.4s;
  }
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

@media (max-width: 900px) {
  .tabela {
    --tabela-recuo: 14px;
  }
}
</style>
