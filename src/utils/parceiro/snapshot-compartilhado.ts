import type {
  BlocoSnapshot,
  ItemSnapshot,
  MotivoBlocoVazio,
  SnapshotPetCompartilhado,
  StatusCompartilhamento,
} from '@/service/parceiro/types'

/**
 * Regras de renderização do snapshot compartilhado (Parte 15), sem Vue e sem i18n.
 *
 * O núcleo devolve **chave** de motivo, nunca frase: quem traduz é a tela. Isso
 * mantém a matriz de teste (categoria × vazio × motivo) independente dos 4 locales.
 */

/** `GENERICO` = não sabemos por quê; a tela não pode afirmar ausência de registro. */
export type MotivoVazioRender = MotivoBlocoVazio | 'GENERICO'

/**
 * O que fazer com um bloco:
 * - `OCULTO`: categoria não compartilhada (ou acesso sem snapshot). Sem seção.
 * - `CONTEUDO`: renderiza os itens.
 * - demais: seção presente e vazia, com a frase do motivo.
 */
export type EstadoBloco = 'OCULTO' | 'CONTEUDO' | MotivoVazioRender

/** Categoria de consentimento que autoriza cada bloco do snapshot. */
const CATEGORIA_DO_BLOCO: Record<BlocoSnapshot, string> = {
  alergias: 'ALERGIAS',
  vacinas: 'VACINAS',
  medicamentos: 'MEDICAMENTOS',
  comportamento: 'COMPORTAMENTO',
  diagnosticos: 'DIAGNOSTICOS',
  diario: 'DIARIO',
  documentos: 'DOCUMENTOS',
}

/** Ordem clínica das listas de `ItemSnapshot`. Diário e documentos têm forma própria. */
export const BLOCOS_LISTA = [
  'alergias',
  'vacinas',
  'medicamentos',
  'comportamento',
  'diagnosticos',
] as const satisfies readonly BlocoSnapshot[]

export type BlocoLista = (typeof BLOCOS_LISTA)[number]

export type FonteSnapshot = {
  status: StatusCompartilhamento
  /** Ausente em acesso encerrado: o histórico é enxuto (D8.5). */
  categorias?: string[]
  snapshot?: SnapshotPetCompartilhado | null
}

export type BlocoListaRender = {
  id: BlocoLista
  items: ItemSnapshot[]
  /** `null` quando há conteúdo. */
  motivo: MotivoVazioRender | null
}

/**
 * Acesso encerrado não tem prontuário: o snapshot morre com o acesso e vem `null`.
 * Nada da Parte 15 se aplica aqui — inclusive `motivos`, que não existe para ler.
 */
export function snapshotDisponivel(fonte: FonteSnapshot): boolean {
  return fonte.status === 'ATIVO' && fonte.snapshot != null
}

export function categoriaCompartilhada(fonte: FonteSnapshot, bloco: BlocoSnapshot): boolean {
  return (fonte.categorias ?? []).includes(CATEGORIA_DO_BLOCO[bloco])
}

/**
 * `FILTRADO_JANELA` só faz sentido no diário; `SEM_REGISTRO` e `REMOVIDO_PELO_TUTOR` valem em
 * qualquer bloco. Qualquer outro valor — inclusive um enum novo que o backend passe a mandar —
 * cai em `GENERICO`.
 *
 * O motivo é a regra 5 da spec: não inferir. "O responsável não registrou" é uma
 * afirmação sobre o prontuário de alguém, e errar nela é pior do que ser vago.
 *
 * `REMOVIDO_PELO_TUTOR` é a exceção que confirma a regra: ele **é** a informação. Sem tratá-lo,
 * o bloco que o responsável retirou cai em `GENERICO` e some a única diferença que importa
 * entre "não existe" e "existe e você não pode mais ver".
 */
export function normalizarMotivo(
  bloco: BlocoSnapshot,
  motivo: string | null | undefined,
): MotivoVazioRender {
  if (motivo === 'SEM_REGISTRO') {
    return 'SEM_REGISTRO'
  }

  if (motivo === 'REMOVIDO_PELO_TUTOR') {
    return 'REMOVIDO_PELO_TUTOR'
  }

  if (motivo === 'FILTRADO_JANELA' && bloco === 'diario') {
    return 'FILTRADO_JANELA'
  }

  return 'GENERICO'
}

/** Aplica a ordem de decisão da spec (seção 3) a um bloco, dado quantos itens ele tem. */
export function estadoDoBloco(
  fonte: FonteSnapshot,
  bloco: BlocoSnapshot,
  quantidade: number,
): EstadoBloco {
  if (!snapshotDisponivel(fonte) || !categoriaCompartilhada(fonte, bloco)) {
    return 'OCULTO'
  }

  if (quantidade > 0) {
    return 'CONTEUDO'
  }

  return normalizarMotivo(bloco, fonte.snapshot?.motivos?.[bloco])
}

/** As cinco listas clínicas, na ordem, já resolvidas entre conteúdo e vazio-com-motivo. */
export function montarBlocosLista(fonte: FonteSnapshot): BlocoListaRender[] {
  const blocos: BlocoListaRender[] = []

  for (const id of BLOCOS_LISTA) {
    const items = fonte.snapshot?.[id] ?? []
    const estado = estadoDoBloco(fonte, id, items.length)

    if (estado === 'OCULTO') {
      continue
    }

    blocos.push({ id, items, motivo: estado === 'CONTEUDO' ? null : estado })
  }

  return blocos
}

/**
 * `titulo` e `detalhe` chegam traduzidos pelo backend, no locale do `Accept-Language`
 * da request: aqui só normalizamos o vazio para a tela não decidir entre `undefined`
 * e string em branco. Não existe campo de label separado no contrato.
 */
export function rotuloItem(item: ItemSnapshot) {
  return {
    titulo: item.titulo,
    detalhe: item.detalhe?.trim() ?? '',
  }
}

export type CarimboResumo = {
  /** ISO da data a exibir. */
  data: string
  /** `true` quando o responsável mexeu no resumo depois de entregar o acesso. */
  atualizado: boolean
}

/**
 * Carimbo do resumo: `snapshotAtualizadoEm` quando presente, `criadoEm` quando não.
 * Em atendimento com estadia (hotel, internação) essa diferença é o que avisa que
 * o que o parceiro leu ontem pode não valer mais.
 */
export function carimboDoResumo(fonte: {
  criadoEm: string
  snapshotAtualizadoEm?: string | null
}): CarimboResumo {
  const atualizado = Boolean(fonte.snapshotAtualizadoEm)

  return {
    data: atualizado ? (fonte.snapshotAtualizadoEm as string) : fonte.criadoEm,
    atualizado,
  }
}
