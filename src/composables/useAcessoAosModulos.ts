import { computed } from 'vue'

import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import { podeAbrirCaminho, type AcessoDaConta } from '@/navegacao/rotas-dos-modulos'
import { useParceiroStore } from '@/stores/parceiro'

/**
 * O acesso desta conta às telas de módulo, para o menu, o guard e as telas: o que o `GET
 * /parceiro/portal/eu` diz, ou tudo, no modo demonstração (ver `rotas-dos-modulos.ts`).
 */
export function useAcessoAosModulos() {
  const store = useParceiroStore()
  const { ativo: demonstracao } = useModoDemonstracao()

  const acesso = computed<AcessoDaConta>(() => ({
    demonstracao: demonstracao.value,
    podeLer: (modulo) => store.modulo(modulo)?.podeLer ?? false,
    temPermissao: (permissao) => store.temPermissao(permissao),
  }))

  function podeAbrir(caminho: string) {
    return podeAbrirCaminho(caminho, acesso.value)
  }

  return { acesso, podeAbrir, demonstracao }
}
