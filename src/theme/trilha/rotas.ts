import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

/**
 * As telas que já estão no design Trilha.
 *
 * O Trilha entra tela a tela, como entrou o `.hc-tema`: a tela da lista leva a raiz para
 * `html.trilha` e a moldura veste a pele nova; as outras seguem como estão. Para migrar mais uma,
 * acrescente o caminho aqui e confira-a no claro e no escuro.
 */
export const ROTAS_DO_TRILHA = ['/veterinario/agenda'] as const

export function rotaUsaTrilha(caminho: string) {
  return ROTAS_DO_TRILHA.some((rota) => caminho === rota || caminho.startsWith(`${rota}/`))
}

/** O lugar de cada seção do menu: é ele que escolhe a cor (`pj-lugar--*`). */
export type LugarDoTrilha = 'inicio' | 'portal' | 'clinica' | 'pets' | 'hotel' | 'conta'

const LUGAR_DA_SECAO: Record<string, LugarDoTrilha> = {
  overview: 'inicio',
  portal: 'portal',
  clinical: 'clinica',
  patients: 'pets',
  hotel: 'hotel',
  account: 'conta',
}

export function lugarDaSecao(idDaSecao: string): LugarDoTrilha {
  return LUGAR_DA_SECAO[idDaSecao] ?? 'inicio'
}

/** Se a tela aberta está no Trilha. */
export function useDesignTrilha() {
  const route = useRoute()

  return computed(() => rotaUsaTrilha(route.path))
}

/**
 * Põe e tira `trilha` da raiz conforme a rota.
 *
 * Na raiz, e não num contêiner: diálogo, popover e painel de Select do PrimeVue vão para o `body`,
 * e precisam dos mesmos tokens que a tela que os abriu.
 */
export function useClasseDoDesignTrilha() {
  const ativo = useDesignTrilha()

  watch(
    ativo,
    (ligado) => {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('trilha', ligado)
      }
    },
    { immediate: true },
  )

  return ativo
}
