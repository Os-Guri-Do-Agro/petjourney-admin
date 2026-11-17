import type AutoComplete from 'primevue/autocomplete'
import { ref } from 'vue'

/** O que o AutoComplete do PrimeVue tem por dentro (a API dele não publica como abrir a lista). */
type CampoPorDentro = {
  disabled: boolean
  overlayVisible: boolean
  searching: boolean
  search: (evento: Event, termo: string, origem: string) => void
}

/**
 * Campo de paciente que já mostra a lista ao clicar (pedido do Luís, 17/11/2026: "ao clicar, já
 * aparecer a lista de pacientes da clínica, não esperar eu começar a digitar").
 *
 * O AutoComplete só pesquisa ao digitar. O clique no campo (e a seta para baixo, no teclado) pede a
 * busca sem termo, que a API responde com os primeiros pacientes da clínica; digitando, filtra como
 * antes. Com a lista já aberta, ou uma busca a caminho, o clique não pede de novo.
 *
 * Uso: `ref="campo"`, `@click="abrirLista"` e `@keydown.down="abrirLista"` no AutoComplete.
 */
export function useListaAoClicar() {
  const campo = ref<InstanceType<typeof AutoComplete> | null>(null)

  function abrirLista(evento: Event) {
    const porDentro = campo.value as unknown as CampoPorDentro | null

    if (!porDentro || porDentro.disabled || porDentro.overlayVisible || porDentro.searching) return

    porDentro.search(evento, '', 'clique')
  }

  return { campo, abrirLista }
}
