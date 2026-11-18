import { computed } from 'vue'

import { podeAbrirCaminho, type AcessoDaConta } from '@/navegacao/rotas-dos-modulos'
import { useParceiroStore } from '@/stores/parceiro'

/**
 * O acesso desta conta às telas de módulo, para o menu, o guard e as telas: o que o `GET
 * /parceiro/portal/eu` diz (ver `rotas-dos-modulos.ts`). No modo demonstração é o mesmo: quem
 * responde o `/eu` é a clínica de exemplo.
 */
export function useAcessoAosModulos() {
  const store = useParceiroStore()

  const acesso = computed<AcessoDaConta>(() => ({
    podeLer: (modulo) => store.modulo(modulo)?.podeLer ?? false,
    temPermissao: (permissao) => store.temPermissao(permissao),
  }))

  function podeAbrir(caminho: string) {
    return podeAbrirCaminho(caminho, acesso.value)
  }

  return { acesso, podeAbrir }
}
