/**
 * O selo de quem assina (E1-08): o CRMV conferido pela PetJourney nos últimos 365 dias e a
 * identidade do login aprovada. Sem ele, a API recusa os atos legais (receita, prontuário
 * finalizado, resumo liberado, prescrição de internação...) com 403 `CRMV_NAO_CONFERIDO`.
 *
 * Tudo sai do `GET /parceiro/portal/eu` que a store já carrega: `aguardandoConferencia` (as
 * permissões), `atosAguardandoConferencia` (os atos, inclusive os que dividem permissão com o
 * rascunho) e `motivoDaConferencia`. A regra do guia é mostrar o botão com o aviso, nunca escondê-lo:
 * a pessoa precisa saber o que falta para assinar.
 */
import { computed } from 'vue'

import { ApiError } from '@/service/api'
import type { AtoLegal, MotivoSemSelo } from '@/service/contrato/openapi'
import type { Permissao } from '@/service/parceiro/acesso-service'
import { useParceiroStore } from '@/stores/parceiro'

/** Onde a pessoa envia o documento e a selfie: a aba Perfil, com a gaveta já aberta. */
export const ROTA_DA_IDENTIDADE = { path: '/settings', query: { identidade: 'enviar' } } as const

/**
 * O motivo de um 403 de assinatura. `CRMV_OBRIGATORIO` (falta o CRMV na ficha) vem antes do selo e
 * tem caminho próprio: a ficha do profissional.
 */
export type MotivoDaRecusa = MotivoSemSelo | 'CRMV_OBRIGATORIO'

const MOTIVOS: readonly MotivoSemSelo[] = ['SEM_SELO', 'VENCIDO', 'SEM_IDENTIDADE']

export function motivoDaRecusa(erro: unknown): MotivoDaRecusa | null {
  if (!(erro instanceof ApiError)) return null
  if (erro.codigo === 'CRMV_OBRIGATORIO') return 'CRMV_OBRIGATORIO'
  if (erro.codigo !== 'CRMV_NAO_CONFERIDO') return null

  return MOTIVOS.find((motivo) => motivo === erro.reason) ?? 'SEM_SELO'
}

export function useSeloDeAssinatura() {
  const store = useParceiroStore()

  const motivo = computed<MotivoSemSelo | null>(() => store.eu?.motivoDaConferencia ?? null)
  const identidade = computed(() => store.eu?.identidade?.status ?? null)

  /** A permissão que a API recusaria agora por falta do selo. */
  function permissaoAguarda(permissao: Permissao) {
    return store.eu?.aguardandoConferencia.includes(permissao) ?? false
  }

  /** O ato que a API recusaria agora por falta do selo (iniciar a escuta, ato avulso, assinar...). */
  function atoAguarda(ato: AtoLegal) {
    return store.eu?.atosAguardandoConferencia.includes(ato) ?? false
  }

  return { motivo, identidade, permissaoAguarda, atoAguarda }
}
