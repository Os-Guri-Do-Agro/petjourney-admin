import { onBeforeUnmount, ref } from 'vue'

/**
 * A janela tem largura para uma gaveta empurrar a página sem espremer o que fica ao lado?
 *
 * Empurrar (`useSidePanelOffset`) é o melhor quando sobra espaço: a lista continua inteira à vista
 * enquanto se responde. Em 1024 px, porém, o menu e uma gaveta de 30 rem deixavam a caixa com
 * 250 px. Abaixo do mínimo, a gaveta passa por cima — sem véu, a lista continua clicável.
 */
export function useTelaLarga(minimo = 1280) {
  const consulta =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(`(min-width: ${minimo}px)`)
      : null
  const larga = ref(consulta?.matches ?? true)

  function mudou(evento: MediaQueryListEvent) {
    larga.value = evento.matches
  }

  consulta?.addEventListener('change', mudou)

  onBeforeUnmount(() => consulta?.removeEventListener('change', mudou))

  return larga
}
