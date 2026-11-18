import { computed } from 'vue'

import { useParceiroStore } from '@/stores/parceiro'

import { PRESTADOR } from './notas'

/**
 * A prestadora das notas: a empresa da sessão (nome e CNPJ do cadastro). Sem o cadastro carregado,
 * os dados ilustrativos de `PRESTADOR`. O endereço e o telefone seguem os do protótipo.
 */
export function usePrestador() {
  const store = useParceiroStore()

  return computed(() => ({
    ...PRESTADOR,
    razaoSocial: store.dashboard?.parceiro.nome ?? PRESTADOR.razaoSocial,
    cnpj: store.dashboard?.parceiro.cnpj ?? PRESTADOR.cnpj,
  }))
}
