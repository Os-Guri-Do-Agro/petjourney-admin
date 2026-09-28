/**
 * Digitação rápida do prontuário — o modo sem mouse.
 *
 * A diferença para os atalhos da agenda é onde a mão está. Na agenda ela está **livre**, e por
 * isso uma letra solta pode ser atalho. Aqui ela está **dentro de um campo**, digitando queixa
 * principal — então todo atalho global precisa de modificador, senão escrever "duração" mudaria
 * de etapa três vezes.
 *
 * O que faz o prontuário andar, em ordem de ganho:
 *
 * 1. **`Enter` avança para o próximo campo.** Num formulário de campos curtos é o que o dedo
 *    espera; Tab funciona, mas obriga a sair da posição de digitação. Em `textarea` o `Enter`
 *    continua sendo quebra de linha — lá ele é conteúdo, não navegação.
 * 2. **Número escolhe a opção** com o grupo em foco (isso mora no `ClinicToggleGroup`). Oito
 *    sistemas do exame físico viram oito toques.
 * 3. **`Alt + →` e `Alt + ←` trocam de etapa**, sem tirar a mão do teclado nem procurar o
 *    rodapé.
 * 4. **`Alt + s`** foca o primeiro campo da etapa — o jeito de voltar ao começo depois de
 *    consultar o histórico.
 *
 * Ao trocar de etapa o foco vai sozinho para o primeiro campo. Sem isso, cada mudança custaria
 * um Tab desde o topo da página, e o modo perderia justamente para o mouse.
 */

import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue'

export type AcaoDoProntuario = 'proximaEtapa' | 'etapaAnterior' | 'focarPrimeiro' | 'ajuda'

export type MapaDoProntuario = Partial<Record<AcaoDoProntuario, () => void>>

/** Tecla → ação. Alimenta o ouvinte e o mapa de teclas, para os dois não divergirem. */
export const TECLAS_DO_PRONTUARIO: Array<{
  acao: AcaoDoProntuario
  tecla: string
  comAlt?: boolean
}> = [
  { acao: 'proximaEtapa', tecla: 'ArrowRight', comAlt: true },
  { acao: 'etapaAnterior', tecla: 'ArrowLeft', comAlt: true },
  { acao: 'focarPrimeiro', tecla: 's', comAlt: true },
  { acao: 'ajuda', tecla: '?', comAlt: true },
]

/** Campos em que `Enter` é conteúdo, não navegação. */
function ehMultilinha(alvo: EventTarget | null): boolean {
  return alvo instanceof HTMLTextAreaElement
}

/**
 * O que pode receber foco dentro da etapa, na ordem em que aparece.
 *
 * Exclui o que está desabilitado e o que tem `tabindex="-1"` — este último é o que mantém o
 * `radiogroup` como uma parada só: pular para dentro dele opção a opção desfaria o ganho.
 */
function focaveis(raiz: HTMLElement): HTMLElement[] {
  const seletor = [
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    'button:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',')

  return [...raiz.querySelectorAll<HTMLElement>(seletor)].filter(
    (elemento) =>
      elemento.tabIndex !== -1 && elemento.offsetParent !== null && !foraDoTeclado(elemento),
  )
}

/**
 * Painéis que não são sequência de campos — a anamnese por voz, com a revisão dela — ficam fora
 * do avanço por `Enter` e do foco inicial da etapa. Continuam no Tab: saem do atalho, não do
 * teclado. Sem isto, abrir a anamnese pousaria o foco em "Gravar consulta" e não na queixa.
 */
function foraDoTeclado(elemento: Element): boolean {
  return elemento.closest('[data-fora-do-teclado]') !== null
}

export function useProntuarioTeclado(opcoes: {
  /** Raiz da etapa. O avanço por `Enter` só percorre o que está dentro dela. */
  raiz: Ref<HTMLElement | null>
  /** Muda quando a etapa muda: é o gatilho para reposicionar o foco. */
  etapa: Ref<string>
  ativo: Ref<boolean>
  acoes: MapaDoProntuario
}) {
  function focarPrimeiro() {
    const raiz = opcoes.raiz.value

    if (!raiz) {
      return
    }

    /*
     * `requestAnimationFrame` porque a etapa acabou de trocar e o DOM novo ainda não existe.
     * Sem a espera, o foco cairia no primeiro campo da etapa **anterior**.
     */
    requestAnimationFrame(() => {
      focaveis(raiz)[0]?.focus()
    })
  }

  function avancarCampo(atual: HTMLElement) {
    const raiz = opcoes.raiz.value

    if (!raiz) {
      return
    }

    const lista = focaveis(raiz)
    const indice = lista.indexOf(atual)

    /*
     * No último campo, `Enter` passa para a etapa seguinte em vez de não fazer nada. É a
     * continuação natural: quem chegou ao fim da anamnese quer o exame físico.
     */
    if (indice >= 0 && indice === lista.length - 1) {
      opcoes.acoes.proximaEtapa?.()

      return
    }

    lista[indice + 1]?.focus()
  }

  function aoTeclar(evento: KeyboardEvent) {
    if (!opcoes.ativo.value) {
      return
    }

    if (evento.altKey) {
      const combinacao = TECLAS_DO_PRONTUARIO.find(
        (item) => item.comAlt && item.tecla.toLowerCase() === evento.key.toLowerCase(),
      )

      if (combinacao) {
        evento.preventDefault()

        if (combinacao.acao === 'focarPrimeiro') {
          focarPrimeiro()

          return
        }

        opcoes.acoes[combinacao.acao]?.()
      }

      return
    }

    /*
     * `Enter` avança. Fora de campo ele não faz nada aqui — botão focado já responde a Enter
     * por conta própria, e interceptá-lo transformaria "Finalizar" num salto de campo.
     */
    if (evento.key === 'Enter' && !evento.shiftKey && !ehMultilinha(evento.target)) {
      const alvo = evento.target

      if (
        (alvo instanceof HTMLInputElement || alvo instanceof HTMLSelectElement) &&
        !foraDoTeclado(alvo)
      ) {
        evento.preventDefault()
        avancarCampo(alvo)
      }
    }
  }

  onMounted(() => window.addEventListener('keydown', aoTeclar))
  onBeforeUnmount(() => window.removeEventListener('keydown', aoTeclar))

  /** Trocou de etapa: o foco vai para o começo dela, sem Tab desde o topo da página. */
  watch(
    () => opcoes.etapa.value,
    () => {
      if (opcoes.ativo.value) {
        focarPrimeiro()
      }
    },
  )

  return { focarPrimeiro }
}
