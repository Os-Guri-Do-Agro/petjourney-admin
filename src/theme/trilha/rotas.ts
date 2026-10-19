import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

/**
 * O Trilha vale no portal inteiro.
 *
 * Entrou primeiro na Agenda, como o `.hc-tema` entrou tela a tela, e de lá passou para todas. A raiz
 * leva `html.trilha` e a moldura veste a pele dele. Esta lista são as exceções: uma tela posta aqui
 * volta ao design anterior inteira, moldura incluída. Hoje não há nenhuma.
 */
export const ROTAS_FORA_DO_TRILHA: readonly string[] = []

export function rotaUsaTrilha(caminho: string) {
  return !ROTAS_FORA_DO_TRILHA.some((rota) => caminho === rota || caminho.startsWith(`${rota}/`))
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
