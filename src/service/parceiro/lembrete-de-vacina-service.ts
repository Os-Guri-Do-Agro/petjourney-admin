/**
 * O lembrete de vacina que a clínica liga pela lista de chamada (pedido do Luís, 17/11/2026; lacuna
 * N42, guia `pedidos-luis-17-11.md` seção 5): o responsável recebe no app um aviso na hora e uma
 * repetição (no dia da próxima dose, se ainda vai vencer, ou 7 dias depois, se já venceu). Para
 * sozinho quando a dose é aplicada ou registrada, quando a aplicação é anulada e quando o paciente
 * ou o vínculo deixam de valer.
 *
 * O estado vem da própria lista de chamada: cada item traz `lembrete` (nulo sem lembrete ligado) e
 * `responsavelNoApp` (falso: a clínica liga para o telefone do cadastro, sem chamar a rota). Ligar
 * e desligar pedem `agenda.escrever`; depois dos dois, a tela relê a lista.
 *
 * Até o N42, o lembrete ficava marcado só no navegador (`pj.lembretes-de-vacina.<parceiro>`):
 * `apagarLembretesGuardados` limpa o que sobrou.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type { ChamadaDto, LembreteDaVacinaDto } from '../contrato/openapi'

/** A rota existe desde o N42 (API `a0db382`): o lembrete sai pelo app. */
export const LEMBRETE_NA_API = true

export type LembreteDaVacina = LembreteDaVacinaDto
export type EntregaDoLembrete = NonNullable<LembreteDaVacinaDto['entrega']>
export type MotivoSemEnvio = NonNullable<LembreteDaVacinaDto['motivoSemEnvio']>

type ParceiroQuery = { parceiroId?: string | null }

const daAplicacao = (id: string, params?: ParceiroQuery) => {
  const caminho = `/parceiro/portal/clinica/aplicacoes/${encodeURIComponent(id)}/lembrete`
  return params?.parceiroId
    ? `${caminho}?parceiroId=${encodeURIComponent(params.parceiroId)}`
    : caminho
}

/**
 * Liga o lembrete da dose que falta (a `aplicacaoId` da lista de chamada). 201 ligou agora; 200 já
 * estava ligado (o mesmo lembrete, sem envio novo).
 */
export async function ligarLembreteDaVacina(
  aplicacaoId: string,
  params?: ParceiroQuery,
): Promise<LembreteDaVacina> {
  const resposta = await apiFetch<ApiEnvelope<LembreteDaVacina>>(daAplicacao(aplicacaoId, params), {
    method: 'POST',
    body: JSON.stringify({}),
  })
  return resposta.data
}

/** Desliga (204 sempre): nada mais sai para o app; o que já saiu fica no aparelho do responsável. */
export async function desligarLembreteDaVacina(aplicacaoId: string, params?: ParceiroQuery) {
  await apiFetch<void>(daAplicacao(aplicacaoId, params), { method: 'DELETE' })
}

/** O lembrete do item da lista (a API mais velha que o N42 não manda o campo). */
export function lembreteDoItem(item: Pick<ChamadaDto, 'lembrete'>): LembreteDaVacina | null {
  return item.lembrete ?? null
}

/**
 * Sem canal no app e sem lembrete ligado: no lugar do botão, "Ligue para o telefone do cadastro".
 * Só o `false` explícito conta (sem o campo, a API é anterior ao N42 e o botão fica).
 */
export function semCanalNoApp(item: Pick<ChamadaDto, 'lembrete' | 'responsavelNoApp'>) {
  return item.responsavelNoApp === false && !lembreteDoItem(item)
}

/** Os motivos que a tela explica quando o envio não saiu (guia, seção 5, item 4). */
const MOTIVOS_EXPLICADOS: readonly MotivoSemEnvio[] = [
  'TETO_DO_DIA',
  'SEM_CANAL_NO_APP',
  'SUPERADO',
]

export type SituacaoDoLembrete = {
  /** A entrega do último envio; nula antes do primeiro. */
  entrega: EntregaDoLembrete | null
  /** Com `FALHOU`, por que não saiu (só os que a tela explica). */
  motivo: MotivoSemEnvio | null
  /** O próximo envio previsto; nulo: "Sem novo envio previsto". */
  proximoEnvioEm: string | null
}

/** O que o cartão e a gaveta mostram de um lembrete ligado. */
export function situacaoDoLembrete(lembrete: LembreteDaVacina): SituacaoDoLembrete {
  const motivo = lembrete.motivoSemEnvio
  return {
    entrega: lembrete.entrega ?? null,
    motivo:
      lembrete.entrega === 'FALHOU' && motivo && MOTIVOS_EXPLICADOS.includes(motivo)
        ? motivo
        : null,
    proximoEnvioEm: lembrete.proximoEnvioEm ?? null,
  }
}

const GUARDADOS = 'pj.lembretes-de-vacina'

/** Apaga os lembretes que ficaram marcados neste navegador antes do N42. Devolve quantos. */
export function apagarLembretesGuardados(): number {
  try {
    const chaves: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i)
      if (chave === GUARDADOS || chave?.startsWith(`${GUARDADOS}.`)) chaves.push(chave)
    }
    for (const chave of chaves) localStorage.removeItem(chave)
    return chaves.length
  } catch {
    /* Armazenamento bloqueado: não há o que apagar. */
    return 0
  }
}
