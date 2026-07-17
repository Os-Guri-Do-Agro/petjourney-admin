import { onBeforeUnmount, watch, type Ref } from 'vue'

/**
 * Painéis laterais não-modais (drawers à direita) empurram o conteúdo da página
 * em vez de flutuar sobre ele. O painel seta `--pj-side-panel-offset` no <html>
 * enquanto está aberto e o `.app-content` do AppShell consome esse valor como
 * padding-right (só em telas largas; no mobile o painel sobrepõe).
 */
let activeCount = 0

function applyOffset(width: string) {
  document.documentElement.style.setProperty('--pj-side-panel-offset', width)
}

function clearOffset() {
  document.documentElement.style.removeProperty('--pj-side-panel-offset')
}

export function useSidePanelOffset(visible: Ref<boolean>, width: string) {
  function release() {
    activeCount = Math.max(0, activeCount - 1)

    if (activeCount === 0) {
      clearOffset()
    }
  }

  watch(
    visible,
    (open, wasOpen) => {
      if (open && !wasOpen) {
        activeCount += 1
        applyOffset(width)
      } else if (!open && wasOpen) {
        release()
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    if (visible.value) {
      release()
    }
  })
}
