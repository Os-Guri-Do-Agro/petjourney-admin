import { onUnmounted, ref } from 'vue'

/**
 * Relógio reativo para rótulos que envelhecem sozinhos (contagem até expirar).
 * Sem ele, o texto congela no instante da renderização e um portal aberto o dia todo
 * segue mostrando "expira em 3d 2h" muito depois de o acesso ter fechado.
 */
export function useAgora(intervaloMs = 60_000) {
  const agora = ref(Date.now())
  const id = setInterval(() => {
    agora.value = Date.now()
  }, intervaloMs)

  onUnmounted(() => {
    clearInterval(id)
  })

  return agora
}
