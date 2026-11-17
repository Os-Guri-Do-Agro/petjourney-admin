/**
 * O lembrete de vacina que a clínica liga pela lista de chamada (pedido do Luís, 17/11/2026):
 * o responsável recebe no app que a vacina do pet está para vencer (ou venceu) e volta a receber
 * se a dose ainda faltar. Para sozinho quando a dose é aplicada.
 *
 * **A API ainda não tem a rota.** Hoje ela só avisa sozinha, uma vez, quando o reforço de uma dose
 * aplicada na clínica entra nos 30 dias (`VACINA_REFORCO_PROXIMO`, guia e4 4.3); a clínica não pede
 * o aviso, não avisa a vencida nem a série aberta, e não vê se saiu. O pedido ao backend está em
 * `docs/integracao-portal-parceiro/novembro/spec-lembrete-de-vacina.md` (lacuna N42).
 *
 * Até a rota existir (`LEMBRETE_NA_API = false`), o lembrete fica marcado **neste navegador**: a
 * tela mostra o estado e a gaveta diz que nada saiu para o app. Quando a API entrar, troque a
 * constante e leia o `lembrete` que a lista de chamada passa a trazer em cada item (spec, seção 3).
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'

export const LEMBRETE_NA_API = false

export type LembreteDaVacina = {
  aplicacaoId: string
  /** Quando a clínica ligou. */
  ligadoEm: string
  /** O último envio pelo app (nulo enquanto não saiu nenhum). */
  ultimoEnvioEm: string | null
}

type ParceiroQuery = { parceiroId?: string | null }

const CHAVE = 'pj.lembretes-de-vacina'

function chaveDoParceiro(params?: ParceiroQuery) {
  return `${CHAVE}.${params?.parceiroId ?? 'ativo'}`
}

/** Os lembretes guardados neste navegador, por aplicação. Armazenamento bloqueado: nenhum. */
export function lembretesGuardados(params?: ParceiroQuery): Record<string, LembreteDaVacina> {
  try {
    const bruto = localStorage.getItem(chaveDoParceiro(params))
    const lido = bruto ? (JSON.parse(bruto) as unknown) : null
    return lido && typeof lido === 'object' ? (lido as Record<string, LembreteDaVacina>) : {}
  } catch {
    return {}
  }
}

function guardar(params: ParceiroQuery | undefined, lembretes: Record<string, LembreteDaVacina>) {
  try {
    localStorage.setItem(chaveDoParceiro(params), JSON.stringify(lembretes))
  } catch {
    /* Armazenamento bloqueado: vale até a recarga. */
  }
}

const daAplicacao = (id: string, params?: ParceiroQuery) => {
  const caminho = `/parceiro/portal/clinica/aplicacoes/${encodeURIComponent(id)}/lembrete`
  return params?.parceiroId
    ? `${caminho}?parceiroId=${encodeURIComponent(params.parceiroId)}`
    : caminho
}

/** Liga o lembrete da dose que falta (a `aplicacaoId` da lista de chamada). */
export async function ligarLembreteDaVacina(
  aplicacaoId: string,
  params?: ParceiroQuery,
): Promise<LembreteDaVacina> {
  if (LEMBRETE_NA_API) {
    const resposta = await apiFetch<ApiEnvelope<LembreteDaVacina>>(
      daAplicacao(aplicacaoId, params),
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    )
    return resposta.data
  }
  const lembrete = { aplicacaoId, ligadoEm: new Date().toISOString(), ultimoEnvioEm: null }
  guardar(params, { ...lembretesGuardados(params), [aplicacaoId]: lembrete })
  return lembrete
}

/** Desliga: nada mais sai para o app; o que já saiu fica no aparelho do responsável. */
export async function desligarLembreteDaVacina(aplicacaoId: string, params?: ParceiroQuery) {
  if (LEMBRETE_NA_API) {
    await apiFetch<void>(daAplicacao(aplicacaoId, params), { method: 'DELETE' })
    return
  }
  const lembretes = lembretesGuardados(params)
  delete lembretes[aplicacaoId]
  guardar(params, lembretes)
}
