/**
 * Atalhos globais do módulo clínico.
 *
 * Regra de ouro: **toda ação de mouse tem equivalente de teclado**. Quem opera agenda o dia
 * inteiro não larga o teclado para arrastar um card, e quem não usa mouse precisa chegar aos
 * mesmos lugares.
 *
 * O ouvinte ignora tecla digitada dentro de campo — exceto `Esc`, que sempre fecha o que
 * estiver aberto.
 */

import { onBeforeUnmount, onMounted } from 'vue'

export type AcaoAtalho =
  | 'visaoDia'
  | 'visaoSemana'
  | 'agruparProfissional'
  | 'agruparSala'
  | 'hoje'
  | 'diaAnterior'
  | 'proximoDia'
  | 'semanaAnterior'
  | 'proximaSemana'
  | 'novo'
  | 'bloquear'
  | 'encaixar'
  | 'buscar'
  | 'densidade'
  | 'desfazer'
  | 'ajuda'
  | 'fechar'

export type MapaDeAtalhos = Partial<Record<AcaoAtalho, () => void>>

/** Tecla → ação. Documentado aqui e espelhado no diálogo de ajuda. */
export const TECLAS: Array<{ acao: AcaoAtalho; tecla: string; comShift?: boolean }> = [
  { acao: 'visaoDia', tecla: 'd' },
  { acao: 'visaoSemana', tecla: 's' },
  { acao: 'agruparProfissional', tecla: 'p' },
  { acao: 'agruparSala', tecla: 'r' },
  { acao: 'hoje', tecla: 't' },
  { acao: 'diaAnterior', tecla: 'ArrowLeft' },
  { acao: 'proximoDia', tecla: 'ArrowRight' },
  { acao: 'semanaAnterior', tecla: 'ArrowLeft', comShift: true },
  { acao: 'proximaSemana', tecla: 'ArrowRight', comShift: true },
  { acao: 'novo', tecla: 'n' },
  { acao: 'bloquear', tecla: 'b' },
  { acao: 'encaixar', tecla: 'e' },
  { acao: 'buscar', tecla: '/' },
  { acao: 'densidade', tecla: ',' },
  { acao: 'desfazer', tecla: 'z' },
  { acao: 'ajuda', tecla: '?' },
  { acao: 'fechar', tecla: 'Escape' },
]

function ehCampoDeTexto(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) {
    return false
  }

  if (alvo.isContentEditable) {
    return true
  }

  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)
}

/**
 * Tecla que nasce num diálogo, gaveta ou lista aberta pertence a ela, não à agenda por trás.
 *
 * Sem isto, quem abria "Novo atendimento", clicava em Paciente e digitava "Rita" trocava a agenda
 * para "por sala" no "R" (o foco ainda estava no combobox, que não é campo de texto) e a busca
 * ficava com "ita". O mesmo valia para "d", "s", "t" e as setas com um modal aberto.
 */
const CAMADAS =
  '[role="dialog"], [role="alertdialog"], [role="combobox"], [role="listbox"], [role="menu"], .p-overlay, .p-popover, .p-select-overlay, .p-datepicker-panel'

function ehDeOutraCamada(alvo: EventTarget | null): boolean {
  if (alvo instanceof Element && alvo.closest(CAMADAS)) {
    return true
  }

  /* Modal aberto e foco perdido no corpo da página: a tecla também não é da agenda. */
  return Boolean(document.querySelector('.p-dialog-mask'))
}

export function useClinicShortcuts(mapa: MapaDeAtalhos) {
  function aoTeclar(evento: KeyboardEvent) {
    if (evento.altKey || evento.ctrlKey || evento.metaKey) {
      return
    }

    const noCampo = ehCampoDeTexto(evento.target)

    /** `Esc` é o único que atravessa campo: é a saída universal. */
    if (evento.key === 'Escape') {
      mapa.fechar?.()

      return
    }

    if (noCampo || ehDeOutraCamada(evento.target)) {
      return
    }

    /**
     * Seta sem Shift dentro de um card é movimento de foco do próprio card; aqui só a
     * navegação de data. `Shift + seta` num card é remarcação, e o card já preveniu o padrão.
     */
    if (evento.defaultPrevented) {
      return
    }

    const tecla = evento.key.length === 1 ? evento.key.toLowerCase() : evento.key

    const encontrado = TECLAS.find(
      (item) =>
        item.tecla === tecla && Boolean(item.comShift) === (evento.shiftKey && tecla.startsWith('Arrow')),
    )

    if (!encontrado) {
      return
    }

    const acao = mapa[encontrado.acao]

    if (!acao) {
      return
    }

    evento.preventDefault()
    acao()
  }

  onMounted(() => window.addEventListener('keydown', aoTeclar))
  onBeforeUnmount(() => window.removeEventListener('keydown', aoTeclar))
}
