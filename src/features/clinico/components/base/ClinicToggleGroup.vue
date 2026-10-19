<script setup lang="ts" generic="T extends string | number | boolean | null">
/**
 * Escolha entre poucas opções, em linha.
 *
 * Um `Select` para responder "sim ou não" custa dois cliques e esconde a resposta atrás de um
 * campo fechado. Com três opções ou menos, mostrar todas de uma vez é mais rápido de ler e de
 * responder — e o formulário deixa de parecer uma coluna de caixas iguais.
 *
 * **A marcação precisa saltar.** É o controle segmentado do Trilha: um trilho afundado
 * (`--superficie-3`) e a opção escolhida em papel (`--superficie`) com `--sombra-1` — ela sobe do
 * trilho. Forma, sombra e peso: três sinais, e nenhum deles depende de enxergar cor, o que mantém
 * a régua da escala de cinza.
 *
 * O `tom` é opcional e carrega **significado**, não enfeite: numa lista de sistemas, ver de
 * relance quais estão normais, quais alterados e quais nem foram avaliados é o motivo de a
 * lista existir. A escolhida com tom ganha a tinta do tom e um ponto na cor dele.
 *
 * É um `radiogroup` de verdade — e agora com o teclado que a função exige.
 *
 * **A afirmação estava no comentário e não no código.** Cada opção era um `button` solto: o Tab
 * percorria todas (oito sistemas × três opções = vinte e quatro paradas para atravessar um
 * formulário) e as setas não faziam nada.
 *
 * Agora vale o padrão de `radiogroup`:
 *
 * - **Uma parada de Tab por grupo** (tabindex móvel). O grupo é uma pergunta, não três.
 * - **Setas navegam e escolhem.** Num radiogroup, mover é escolher — é o que o leitor de tela
 *   anuncia e o que o dedo espera.
 * - **Número escolhe direto.** É a tecla que faz o prontuário andar: com o grupo em foco, `2`
 *   marca a segunda opção sem passar pela primeira. Oito sistemas viram oito toques.
 */
import SelectButton from 'primevue/selectbutton'
import { computed, nextTick, ref } from 'vue'

export type TomDaOpcao = 'neutro' | 'ok' | 'atencao' | 'risco' | 'acento'

/**
 * `contagem` desenha o número na pílula de contagem do kit (`ui-contagem`) ao lado do rótulo, no
 * par do tom da opção — o "Checklist · 1" escrito no texto virava parte do nome e não se lia como
 * número.
 */
type Opcao = { valor: T; rotulo: string; icone?: string; tom?: TomDaOpcao; contagem?: number }

const props = defineProps<{
  modelValue: T
  opcoes: Opcao[]
  rotulo: string
  desabilitado?: boolean
  /** Permite desmarcar clicando na opção já escolhida. */
  limpavel?: boolean
  /** Valor devolvido ao limpar. */
  vazio?: T
}>()

const emit = defineEmits<{ 'update:modelValue': [valor: T] }>()

const grupo = ref<{ $el: HTMLElement } | null>(null)

const indiceAtivo = computed(() => {
  const encontrado = props.opcoes.findIndex((opcao) => opcao.valor === props.modelValue)

  /* Nada escolhido: a primeira opção carrega o foco, para o grupo ter uma porta de entrada. */
  return encontrado >= 0 ? encontrado : 0
})

/**
 * O `SelectButton` desenha as opções, mas a semântica continua sendo a de `radiogroup`.
 *
 * Ele nasce como `group` de botões com `aria-pressed` e uma parada de Tab por opção — o oposto
 * do que este componente promete. O passthrough de cada `ToggleButton` devolve o papel de
 * `radio`, o `aria-checked`, o tabindex móvel e o tom da opção.
 *
 * O botão só conhece o próprio rótulo (`onLabel`), então é por ele que se acha o índice.
 */
const indicePorRotulo = computed(
  () => new Map(props.opcoes.map((opcao, indice) => [opcao.rotulo, indice])),
)

const passthrough = computed(() => ({
  pcToggleButton: {
    root: ({ props: botao }: { props: { onLabel?: string } }) => {
      const indice = indicePorRotulo.value.get(botao.onLabel ?? '') ?? -1
      const opcao = props.opcoes[indice]

      return {
        class: [
          'grupo__opcao',
          `grupo__opcao--${opcao?.tom ?? 'acento'}`,
          /* Com contagem, o tom mora no número (a pílula), não no rótulo da opção escolhida. */
          { 'grupo__opcao--contada': opcao?.contagem !== undefined },
        ],
        role: 'radio',
        'aria-checked': opcao !== undefined && opcao.valor === props.modelValue,
        'aria-pressed': undefined,
        tabindex: indice === indiceAtivo.value ? 0 : -1,
        title: opcao ? `${opcao.rotulo} (${indice + 1})` : undefined,
      }
    },
  },
}))

function focarOpcao(indice: number) {
  const alvo = grupo.value?.$el?.querySelectorAll<HTMLElement>('[role="radio"]')?.[indice]

  alvo?.focus()
}

/**
 * Move e escolhe ao mesmo tempo.
 *
 * Em `radiogroup`, navegar **é** selecionar — separar as duas coisas obrigaria a apertar
 * espaço depois de cada seta, e é o que faz teclado parecer mais lento que mouse.
 *
 * Circular: da última volta para a primeira. Um grupo de três opções não tem por que ter parede.
 */
function mover(passo: number) {
  if (props.desabilitado) {
    return
  }

  const total = props.opcoes.length
  const proximo = (indiceAtivo.value + passo + total) % total
  const opcao = props.opcoes[proximo]

  if (opcao) {
    emit('update:modelValue', opcao.valor)
    nextTick(() => focarOpcao(proximo))
  }
}

function aoTeclar(evento: KeyboardEvent) {
  if (props.desabilitado) {
    return
  }

  const teclas: Record<string, () => void> = {
    ArrowRight: () => mover(1),
    ArrowDown: () => mover(1),
    ArrowLeft: () => mover(-1),
    ArrowUp: () => mover(-1),
    Home: () => mover(-indiceAtivo.value),
    End: () => mover(props.opcoes.length - 1 - indiceAtivo.value),
  }

  const acao = teclas[evento.key]

  if (acao) {
    evento.preventDefault()
    acao()

    return
  }

  /*
   * Número escolhe direto. É o atalho que faz o exame físico andar: com o grupo em foco,
   * "1 2 1 1 3" preenche cinco sistemas sem tirar a mão do teclado.
   */
  const numero = Number(evento.key)

  if (Number.isInteger(numero) && numero >= 1 && numero <= props.opcoes.length) {
    evento.preventDefault()
    mover(numero - 1 - indiceAtivo.value)
  }
}

/**
 * Clique numa opção.
 *
 * Com `limpavel`, o `SelectButton` devolve `null` ao desmarcar; aqui ele vira o `vazio` que
 * quem usa o grupo combinou. Sem `limpavel`, a opção já escolhida nem chega a emitir.
 */
function escolher(valor: T | null) {
  if (props.desabilitado) {
    return
  }

  if (valor === null && props.limpavel) {
    emit('update:modelValue', (props.vazio ?? null) as T)

    return
  }

  emit('update:modelValue', valor as T)
}
</script>

<template>
  <SelectButton
    ref="grupo"
    class="grupo grupo--trilho"
    :model-value="modelValue"
    :options="opcoes"
    option-label="rotulo"
    option-value="valor"
    :disabled="desabilitado"
    :allow-empty="Boolean(limpavel)"
    role="radiogroup"
    :aria-label="rotulo"
    :pt="passthrough"
    @update:model-value="escolher"
    @keydown="aoTeclar"
  >
    <template #option="{ option }">
      <i v-if="option.icone" :class="option.icone" aria-hidden="true" />
      <span class="grupo__rotulo">{{ option.rotulo }}</span>
      <span v-if="option.contagem !== undefined" class="grupo__contagem ui-contagem">
        {{ option.contagem }}
      </span>
    </template>
  </SelectButton>
</template>

<style scoped>
/*
 * O controle segmentado do Trilha.
 *
 * Trilho afundado (`--superficie-3`, raio 10) e a escolhida em papel com `--sombra-1`: a escolha
 * sobe, em vez de ganhar cor. Quem diz o significado é o tom — a tinta da opção escolhida e o
 * ponto antes do rótulo —, e a contagem, na pílula do kit.
 *
 * `.grupo.grupo--trilho.p-selectbutton` mais `:deep`: os botões são filhos do `SelectButton` e não
 * recebem o atributo de escopo, e a especificidade precisa passar a do tema (`html.trilha body
 * .grupo.p-selectbutton …`) e a da camada global da clínica (`.clinic-scope .p-togglebutton`).
 */
.grupo.grupo--trilho.p-selectbutton {
  display: inline-flex;
  max-width: 100%;
  flex-wrap: wrap;
  gap: 2px;
  padding: 3px;
  border: 0;
  border-radius: 10px;
  background: var(--superficie-3);
}

/*
 * `1 1 auto`, e **não** `1`.
 *
 * `flex: 1` é `1 1 0%`: a base de cada opção vira zero e todas terminam com a mesma largura,
 * a do rótulo médio. Quem tem rótulo mais longo que a média perde o que sobra — e perde em
 * silêncio, porque o `ToggleButton` do tema corta com `overflow: hidden` e sem reticências.
 * Com a base no conteúdo, nenhuma opção encolhe abaixo do próprio texto, e quando a linha
 * acaba o `flex-wrap` do trilho desce a opção inteira para a linha de baixo.
 */
.grupo.grupo--trilho.p-selectbutton :deep(.p-togglebutton) {
  min-height: 34px;
  flex: 1 1 auto;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--tinta-2);
  font-family: var(--font-texto);
  font-size: 13.5px;
  font-weight: 500;
  white-space: nowrap;
}

.grupo.grupo--trilho.p-selectbutton :deep(.p-togglebutton .p-togglebutton-content) {
  gap: 6px;
  height: 100%;
  padding: 0 11px;
  border-radius: 8px;
  background: transparent;
  box-shadow: none;
  transition:
    background-color var(--pj-tempo-curto, 140ms) ease-out,
    box-shadow var(--pj-tempo-curto, 140ms) ease-out,
    color var(--pj-tempo-curto, 140ms) ease-out;
}

.grupo.grupo--trilho.p-selectbutton
  :deep(.p-togglebutton:not(:disabled):not(.p-togglebutton-checked):hover) {
  background: transparent;
  color: var(--tinta);
}

.grupo.grupo--trilho.p-selectbutton
  :deep(.p-togglebutton:not(:disabled):not(.p-togglebutton-checked):hover .p-togglebutton-content) {
  background: color-mix(in oklab, var(--superficie) 45%, transparent);
}

/* A escolhida: papel sobre o trilho, com a sombra curta de quem está um degrau acima. */
.grupo.grupo--trilho.p-selectbutton :deep(.p-togglebutton.p-togglebutton-checked) {
  border-color: transparent;
  background: transparent;
  color: var(--tinta);
  font-weight: 600;
}

.grupo.grupo--trilho.p-selectbutton
  :deep(.p-togglebutton.p-togglebutton-checked .p-togglebutton-content) {
  background: var(--superficie);
  box-shadow: var(--sombra-1);
}

/*
 * O tom da escolhida: a tinta do estado e um ponto na cor dele antes do rótulo. O ponto é o que
 * se vê de longe numa coluna de oito sistemas; a palavra continua sendo quem diz. Opção com
 * contagem (os recortes de uma lista) leva o tom só na pílula do número: lá a escolhida é um
 * recorte, não um achado.
 */
.grupo.grupo--trilho.p-selectbutton :deep(.p-togglebutton-checked .p-togglebutton-content::before) {
  display: var(--grupo-ponto-exibe, none);
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background: var(--grupo-ponto);
  content: '';
}

.grupo.grupo--trilho.p-selectbutton
  :deep(.grupo__opcao--ok.p-togglebutton-checked:not(.grupo__opcao--contada)) {
  --grupo-ponto: var(--ok);
  --grupo-ponto-exibe: block;

  color: var(--ok-tinta);
}

.grupo.grupo--trilho.p-selectbutton
  :deep(.grupo__opcao--atencao.p-togglebutton-checked:not(.grupo__opcao--contada)) {
  --grupo-ponto: var(--atencao);
  --grupo-ponto-exibe: block;

  color: var(--atencao-tinta);
}

.grupo.grupo--trilho.p-selectbutton
  :deep(.grupo__opcao--risco.p-togglebutton-checked:not(.grupo__opcao--contada)) {
  --grupo-ponto: var(--risco);
  --grupo-ponto-exibe: block;

  color: var(--risco-tinta);
}

/* Neutro é a escolha que não afirma nada — "não avaliado", "sem preferência". */
.grupo.grupo--trilho.p-selectbutton :deep(.grupo__opcao--neutro.p-togglebutton-checked) {
  color: var(--tinta-2);
}

.grupo.grupo--trilho.p-selectbutton :deep(.p-togglebutton:focus-visible) {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 1px;
}

.grupo.grupo--trilho.p-selectbutton :deep(.p-togglebutton:disabled) {
  cursor: not-allowed;
  opacity: 0.55;
}

.grupo.grupo--trilho.p-selectbutton :deep(.p-togglebutton-content i) {
  font-size: 15px;
}

.grupo__rotulo {
  line-height: 1.2;
}

/* ------------------------------------------------------------------ contagem
 * A pílula do kit (`ui-contagem`). No trilho afundado ela vira papel — a cor de fundo do kit é a
 * do próprio trilho e a pílula sumiria —, e na opção escolhida volta ao afundado. Os tons de
 * atenção e risco levam o par do estado: é o número que faz alguém abrir aquele recorte.
 */
.grupo.grupo--trilho :deep(.p-togglebutton) .grupo__contagem {
  height: 20px;
  min-width: 22px;
  padding: 0 6px;
  background: var(--superficie);
  color: var(--tinta-2);
  font-size: 11.5px;
}

.grupo.grupo--trilho :deep(.p-togglebutton-checked) .grupo__contagem {
  background: var(--superficie-3);
}

.grupo.grupo--trilho :deep(.grupo__opcao--atencao) .grupo__contagem {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.grupo.grupo--trilho :deep(.grupo__opcao--risco) .grupo__contagem {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.grupo.grupo--trilho :deep(.grupo__opcao--ok) .grupo__contagem {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

@media (prefers-reduced-motion: reduce) {
  .grupo.grupo--trilho.p-selectbutton :deep(.p-togglebutton .p-togglebutton-content) {
    transition: none;
  }
}
</style>
