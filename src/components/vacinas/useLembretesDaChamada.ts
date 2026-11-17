/**
 * Os lembretes de vacina ligados pela clínica, num estado só para o cartão e para a gaveta (o
 * cartão troca "Ativar lembrete" por "Lembrete ativo" na hora em que a gaveta liga).
 *
 * Enquanto a API não tem a rota, o estado vem deste navegador (`lembrete-de-vacina-service`).
 */
import { ref } from 'vue'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  desligarLembreteDaVacina,
  lembretesGuardados,
  ligarLembreteDaVacina,
  type LembreteDaVacina,
} from '@/service/parceiro/lembrete-de-vacina-service'

const lembretes = ref<Record<string, LembreteDaVacina>>({})
let lidoDe: string | null = null

export function useLembretesDaChamada() {
  const { parceiroQuery } = useParceiroPortal()

  /** Relê o que está guardado (uma vez por parceiro; trocar de empresa relê). */
  function ler() {
    const params = parceiroQuery()
    const chave = params?.parceiroId ?? 'ativo'
    if (lidoDe === chave) return
    lembretes.value = lembretesGuardados(params)
    lidoDe = chave
  }

  async function ligar(aplicacaoId: string) {
    const lembrete = await ligarLembreteDaVacina(aplicacaoId, parceiroQuery())
    lembretes.value = { ...lembretes.value, [aplicacaoId]: lembrete }
  }

  async function desligar(aplicacaoId: string) {
    await desligarLembreteDaVacina(aplicacaoId, parceiroQuery())
    const resto = { ...lembretes.value }
    delete resto[aplicacaoId]
    lembretes.value = resto
  }

  return {
    ler,
    ligar,
    desligar,
    doItem: (aplicacaoId: string) => lembretes.value[aplicacaoId] ?? null,
  }
}
