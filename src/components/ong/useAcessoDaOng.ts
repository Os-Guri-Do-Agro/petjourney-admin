import { computed } from 'vue'

import { useParceiroPortal } from '@/composables/useParceiroPortal'

/**
 * O que esta conta faz no módulo ONG (seção 1 do guia): ler é `ong.ler`; cadastrar, editar, saúde,
 * encerrar e retorno, `ong.escrever`; o convite de adoção, `ong.entregar` (DONO e GESTOR). Toda
 * escrita também pede o módulo escrevendo: suspenso pelo admin, sem a categoria ONG, cadastro não
 * aprovado ou CNPJ encerrado deixam só a consulta (a faixa do `UiPagina` diz por quê).
 */
export function useAcessoDaOng() {
  const { store } = useParceiroPortal()

  const moduloEscreve = computed(() => Boolean(store.modulo('ONG')?.podeEscrever))

  const podeEscrever = computed(() => moduloEscreve.value && store.temPermissao('ong.escrever'))

  const podeEntregar = computed(() => moduloEscreve.value && store.temPermissao('ong.entregar'))

  return { moduloEscreve, podeEscrever, podeEntregar }
}
