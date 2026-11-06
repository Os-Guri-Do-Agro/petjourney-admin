/**
 * A edição de um atendimento pela API (E4-01, guia e4 5.4): lock por aba, autosave por seção e as
 * corridas que o servidor avisa.
 *
 * - **Lock**: `abrir-edicao` ao entrar e a cada 5 min com a aba à vista (vale 10); `liberar-edicao`
 *   ao sair. Com o lock em outra aba, a tela entra em leitura e oferece "Assumir edição".
 * - **Autosave**: 800 ms depois da última mudança, a seção inteira; **uma gravação em voo por vez**
 *   (a próxima espera a `versao` nova). Seção igual à última enviada não vai.
 * - **409 `ATENDIMENTO_ALTERADO`** (um ato em outra aba sobe a versão): usa a versão do `atual` e
 *   grava de novo o que esta aba tem (o lock é dela).
 * - **409 `EDICAO_EM_OUTRO_DISPOSITIVO` / `EDICAO_ASSUMIDA`**: guarda o rascunho desta aba na sessão
 *   e entra em leitura; "Assumir edição" volta com ele.
 */
import { computed, onBeforeUnmount, reactive, ref, watch, type Ref } from 'vue'

import { ApiError } from '@/service/api'
import {
  abrirEdicao,
  assumirEdicao,
  AUTOSAVE_MS,
  dispositivoDaAba,
  gravarSecao,
  liberarEdicao,
  obterAtendimento,
  RENOVAR_EDICAO_MS,
  type Atendimento,
  type EstadoDaEdicao,
  type SecaoDoAtendimento,
} from '@/service/parceiro/atendimentos-service'

import {
  aplicarIdsDoServidor,
  assinaturaDaSecao,
  dadosDaSecao,
  rascunhoDe,
  rotuloDoDispositivo,
  SECOES,
  type RascunhoNaTela,
} from './rascunho-do-atendimento'

type ParceiroQuery = () => { parceiroId?: string | null } | undefined

export type SituacaoDaGravacao = 'salvo' | 'pendente' | 'salvando' | 'falhou'

/** Por que a aba perdeu a edição no meio: o rascunho dela ficou guardado na sessão. */
export type PerdaDaEdicao = 'OUTRO_DISPOSITIVO' | 'ASSUMIDA' | null

const CHAVE_DO_GUARDADO = (id: string) => `pj.prontuario.guardado.${id}`

function lerGuardado(id: string): { rascunho: RascunhoNaTela; em: string } | null {
  try {
    const texto = sessionStorage.getItem(CHAVE_DO_GUARDADO(id))
    return texto ? (JSON.parse(texto) as { rascunho: RascunhoNaTela; em: string }) : null
  } catch {
    return null
  }
}

function guardar(id: string, rascunho: RascunhoNaTela) {
  try {
    sessionStorage.setItem(
      CHAVE_DO_GUARDADO(id),
      JSON.stringify({ rascunho, em: new Date().toISOString() }),
    )
  } catch {
    /* Sem armazenamento (aba privada): a faixa ainda diz que outra aba editou. */
  }
}

function esquecerGuardado(id: string) {
  try {
    sessionStorage.removeItem(CHAVE_DO_GUARDADO(id))
  } catch {
    /* nada a fazer */
  }
}

export function useEdicaoDoAtendimento(
  id: Ref<string>,
  opcoes: { parceiroQuery: ParceiroQuery; podeEscrever: Ref<boolean> },
) {
  const dispositivoId = dispositivoDaAba()
  const dispositivoRotulo =
    typeof navigator === 'undefined' ? 'Navegador' : rotuloDoDispositivo(navigator.userAgent)

  const atendimento = ref<Atendimento | null>(null)
  const rascunho = ref<RascunhoNaTela | null>(null)
  const versao = ref(0)
  const carregando = ref(false)
  const erroDeLeitura = ref<unknown>(null)

  const edicao = reactive<Pick<EstadoDaEdicao, 'somenteLeitura' | 'motivoSomenteLeitura' | 'lock'>>(
    { somenteLeitura: true, motivoSomenteLeitura: null, lock: null },
  )
  const perda = ref<PerdaDaEdicao>(null)
  const assumindo = ref(false)

  const gravacao = reactive({
    situacao: 'salvo' as SituacaoDaGravacao,
    ultimaEm: null as Date | null,
    erro: null as unknown,
    secaoComErro: null as SecaoDoAtendimento | null,
  })

  /** Esta aba tem o lock de um rascunho e pode gravar. */
  const editando = computed(
    () =>
      atendimento.value?.status === 'RASCUNHO' &&
      opcoes.podeEscrever.value &&
      !edicao.somenteLeitura &&
      !perda.value,
  )

  /* -------------------------------------------------------------------------- leitura */

  /** O que cada seção tinha na última gravação aceita (ou na leitura). */
  const enviado: Partial<Record<SecaoDoAtendimento, string>> = {}

  function marcarComoEnviado(atual: RascunhoNaTela) {
    for (const secao of SECOES) enviado[secao] = assinaturaDaSecao(atual, secao)
  }

  function aplicarEdicao(estado: EstadoDaEdicao) {
    edicao.somenteLeitura = estado.somenteLeitura
    edicao.motivoSomenteLeitura = estado.motivoSomenteLeitura
    edicao.lock = estado.lock
    versao.value = Math.max(versao.value, estado.versao)
  }

  async function carregar() {
    carregando.value = true
    erroDeLeitura.value = null
    pararRenovacao()
    try {
      const lido = await obterAtendimento(id.value, dispositivoId, opcoes.parceiroQuery())
      atendimento.value = lido
      versao.value = lido.versao
      const novo = rascunhoDe(lido)
      marcarComoEnviado(novo)
      rascunho.value = novo
      edicao.somenteLeitura = lido.somenteLeitura
      edicao.motivoSomenteLeitura = lido.motivoSomenteLeitura
      edicao.lock = lido.lock
      perda.value = null
      gravacao.situacao = 'salvo'
      gravacao.erro = null
      gravacao.secaoComErro = null
      if (lido.status === 'RASCUNHO' && opcoes.podeEscrever.value) await tomarEdicao()
    } catch (err) {
      erroDeLeitura.value = err
    } finally {
      carregando.value = false
    }
  }

  /** Relê o corpo (atos, adendos, resumo) sem tocar no que esta aba ainda não gravou. */
  async function reler() {
    try {
      const lido = await obterAtendimento(id.value, dispositivoId, opcoes.parceiroQuery())
      atendimento.value = lido
      versao.value = Math.max(versao.value, lido.versao)
      if (lido.status !== 'RASCUNHO' && rascunho.value) {
        const novo = rascunhoDe(lido)
        marcarComoEnviado(novo)
        rascunho.value = novo
      }
    } catch {
      /* A leitura de fundo não interrompe quem está digitando. */
    }
  }

  /** Depois de finalizar, anular ou do 409 de estado: a resposta é o atendimento novo. */
  function substituir(novo: Atendimento) {
    atendimento.value = novo
    versao.value = novo.versao
    const tela = rascunhoDe(novo)
    marcarComoEnviado(tela)
    rascunho.value = tela
    edicao.somenteLeitura = novo.somenteLeitura
    edicao.motivoSomenteLeitura = novo.motivoSomenteLeitura
    edicao.lock = novo.lock
    if (novo.status !== 'RASCUNHO') {
      pararRenovacao()
      esquecerGuardado(id.value)
    }
  }

  /* ----------------------------------------------------------------------------- lock */

  let renovacao: ReturnType<typeof setInterval> | null = null
  let temLock = false

  function pararRenovacao() {
    if (renovacao) clearInterval(renovacao)
    renovacao = null
  }

  async function tomarEdicao() {
    try {
      const estado = await abrirEdicao(
        id.value,
        { dispositivoId, dispositivoRotulo },
        opcoes.parceiroQuery(),
      )
      aplicarEdicao(estado)
      temLock = !estado.somenteLeitura
      if (temLock && !renovacao) {
        renovacao = setInterval(() => void renovar(), RENOVAR_EDICAO_MS)
      }
    } catch {
      /* Sem o lock, a tela fica em leitura; o motivo vem do `GET`. */
      edicao.somenteLeitura = true
    }
  }

  async function renovar() {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    if (!editando.value) return
    await tomarEdicao()
    if (edicao.somenteLeitura) perderEdicao('OUTRO_DISPOSITIVO')
  }

  async function assumir() {
    assumindo.value = true
    try {
      const guardado = lerGuardado(id.value)
      const estado = await assumirEdicao(
        id.value,
        { dispositivoId, dispositivoRotulo },
        opcoes.parceiroQuery(),
      )
      aplicarEdicao(estado)
      temLock = !estado.somenteLeitura
      if (temLock && !renovacao) {
        renovacao = setInterval(() => void renovar(), RENOVAR_EDICAO_MS)
      }
      perda.value = null
      /* O que esta aba tinha antes de perder a edição volta e grava por cima. */
      if (guardado && rascunho.value) {
        rascunho.value = guardado.rascunho
        esquecerGuardado(id.value)
        for (const secao of SECOES) agendar(secao, true)
      }
    } finally {
      assumindo.value = false
    }
  }

  function perderEdicao(motivo: Exclude<PerdaDaEdicao, null>) {
    if (rascunho.value) guardar(id.value, rascunho.value)
    perda.value = motivo
    edicao.somenteLeitura = true
    temLock = false
    pararRenovacao()
    limparFila()
  }

  function soltar() {
    if (!temLock) return
    temLock = false
    void liberarEdicao(id.value, dispositivoId, opcoes.parceiroQuery()).catch(() => undefined)
  }

  function aoMudarVisibilidade() {
    if (document.visibilityState === 'visible') void renovar()
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    window.addEventListener('pagehide', soltar)
  }

  /* ------------------------------------------------------------------------- autosave */

  const sujas = new Set<SecaoDoAtendimento>()
  let espera: ReturnType<typeof setTimeout> | null = null
  let emVoo: Promise<void> | null = null

  function limparFila() {
    sujas.clear()
    if (espera) clearTimeout(espera)
    espera = null
  }

  function agendar(secao: SecaoDoAtendimento, forcar = false) {
    if (!editando.value || !rascunho.value) return
    if (!forcar && assinaturaDaSecao(rascunho.value, secao) === enviado[secao]) return
    sujas.add(secao)
    gravacao.situacao = 'pendente'
    if (espera) clearTimeout(espera)
    espera = setTimeout(() => void gravar(), AUTOSAVE_MS)
  }

  async function gravar(): Promise<void> {
    if (espera) clearTimeout(espera)
    espera = null
    if (emVoo) {
      await emVoo
      if (sujas.size) return gravar()
      return
    }
    if (!sujas.size || !editando.value) return

    emVoo = enviarFila()
    try {
      await emVoo
    } finally {
      emVoo = null
    }
    if (sujas.size && gravacao.situacao !== 'falhou' && editando.value) return gravar()
  }

  async function enviarFila() {
    gravacao.situacao = 'salvando'
    let alteradoSeguido = 0

    while (sujas.size && rascunho.value && editando.value) {
      const secao = sujas.values().next().value as SecaoDoAtendimento
      sujas.delete(secao)
      const dados = dadosDaSecao(rascunho.value, secao)
      const assinatura = JSON.stringify(dados)
      if (assinatura === enviado[secao]) continue

      try {
        const resposta = await gravarSecao(
          id.value,
          { secao, dados, versao: versao.value, dispositivoId, dispositivoRotulo },
          opcoes.parceiroQuery(),
        )
        versao.value = resposta.versao
        edicao.lock = resposta.lock
        enviado[secao] = assinatura
        alteradoSeguido = 0
        if (gravacao.secaoComErro === secao) {
          gravacao.erro = null
          gravacao.secaoComErro = null
        }
        /* Item novo do diagnóstico ganha `id` no servidor: a próxima lista precisa mandá-lo. */
        if (secao === 'DIAGNOSTICO') await adotarIds()
        /* O status de cada vital é do servidor (pela faixa): relê depois de gravar o exame. */
        if (secao === 'EXAME_FISICO') agendarReler()
      } catch (err) {
        const codigo = err instanceof ApiError ? err.codigo : undefined
        const detalhes = err instanceof ApiError ? (err.detalhes ?? {}) : {}

        if (codigo === 'ATENDIMENTO_ALTERADO' && alteradoSeguido < 3) {
          const atual = detalhes.atual as { versao?: number } | undefined
          versao.value = typeof atual?.versao === 'number' ? atual.versao : versao.value + 1
          alteradoSeguido += 1
          sujas.add(secao)
          void reler()
          continue
        }
        if (codigo === 'EDICAO_EM_OUTRO_DISPOSITIVO' || codigo === 'EDICAO_ASSUMIDA') {
          sujas.add(secao)
          perderEdicao(codigo === 'EDICAO_ASSUMIDA' ? 'ASSUMIDA' : 'OUTRO_DISPOSITIVO')
          if (detalhes.lock) edicao.lock = detalhes.lock as EstadoDaEdicao['lock']
          gravacao.situacao = 'falhou'
          return
        }
        if (codigo === 'ATENDIMENTO_FINALIZADO' || codigo === 'ATENDIMENTO_ANULADO') {
          limparFila()
          await carregar()
          return
        }

        sujas.add(secao)
        gravacao.erro = err
        gravacao.secaoComErro = secao
        gravacao.situacao = 'falhou'

        const segundos = Number(detalhes.tenteDeNovoEmSegundos)
        if (codigo === 'ATENDIMENTO_TAXA_EXCEDIDA' && Number.isFinite(segundos)) {
          espera = setTimeout(() => void gravar(), Math.max(1, segundos) * 1000)
        }
        return
      }
    }

    gravacao.situacao = sujas.size ? 'pendente' : 'salvo'
    if (!sujas.size) gravacao.ultimaEm = new Date()
  }

  async function adotarIds() {
    try {
      const lido = await obterAtendimento(id.value, dispositivoId, opcoes.parceiroQuery())
      atendimento.value = lido
      versao.value = Math.max(versao.value, lido.versao)
      if (rascunho.value) {
        aplicarIdsDoServidor(rascunho.value, lido.diagnostico)
        enviado.DIAGNOSTICO = assinaturaDaSecao(rascunho.value, 'DIAGNOSTICO')
      }
    } catch {
      /* Sem os ids, a próxima gravação recria os itens: o servidor substitui a lista inteira. */
    }
  }

  let releitura: ReturnType<typeof setTimeout> | null = null

  function agendarReler() {
    if (releitura) clearTimeout(releitura)
    releitura = setTimeout(() => void reler(), 1200)
  }

  /** Antes de finalizar e de sair: nada pendente, nada em voo. */
  async function esperarGravar() {
    await gravar()
    return !sujas.size && gravacao.situacao !== 'falhou'
  }

  /** Tentar de novo depois de um erro que não se resolve sozinho. */
  function tentarDeNovo() {
    gravacao.situacao = 'pendente'
    void gravar()
  }

  /** Um ato em rascunho sobe a versão (guia 5.8): o próximo PATCH usa a dele. */
  function versaoDoAto(nova: number | null | undefined) {
    if (typeof nova === 'number') versao.value = Math.max(versao.value, nova)
  }

  watch(
    () => rascunho.value?.anamnese,
    () => agendar('ANAMNESE'),
    { deep: true },
  )
  watch(
    () => rascunho.value?.exame,
    () => agendar('EXAME_FISICO'),
    { deep: true },
  )
  watch(
    () => rascunho.value?.diagnostico,
    () => agendar('DIAGNOSTICO'),
    { deep: true },
  )
  watch(
    () => rascunho.value?.conduta,
    () => agendar('CONDUTA'),
    { deep: true },
  )

  watch(id, () => {
    soltar()
    limparFila()
    void carregar()
  })

  onBeforeUnmount(() => {
    pararRenovacao()
    if (espera) clearTimeout(espera)
    if (releitura) clearTimeout(releitura)
    /* O que ficou pendente vai antes de soltar o lock. */
    if (sujas.size && editando.value) {
      void gravar().finally(soltar)
    } else {
      soltar()
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
      window.removeEventListener('pagehide', soltar)
    }
  })

  return {
    dispositivoId,
    atendimento,
    rascunho,
    versao,
    carregando,
    erroDeLeitura,
    edicao,
    perda,
    assumindo,
    gravacao,
    editando,
    carregar,
    reler,
    substituir,
    assumir,
    esperarGravar,
    tentarDeNovo,
    versaoDoAto,
    temGuardado: () => Boolean(lerGuardado(id.value)),
    descartarGuardado: () => esquecerGuardado(id.value),
  }
}
