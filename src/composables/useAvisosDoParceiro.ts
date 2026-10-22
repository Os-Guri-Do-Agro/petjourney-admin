/**
 * O sino do portal (E1-06): quantos avisos deste parceiro estão por ler, e a lista deles quando a
 * gaveta abre.
 *
 * Quem é membro de dois parceiros vê no sino de cada um só os avisos dele (`?parceiroId=`). O
 * número vem do servidor (`naoLidasDoParceiro`) e é conferido de novo como os selos do menu: a cada
 * 5 minutos com a aba visível e ao voltar para a janela (`criarReconferencia`).
 */

import { computed, ref, watch } from 'vue'

import { criarReconferencia } from '@/composables/conferencia'
import {
  abrirAviso,
  listarAvisos,
  marcarAvisoComoLido,
  type Aviso,
} from '@/service/parceiro/avisos-service'
import { useParceiroStore } from '@/stores/parceiro'

const POR_PAGINA = 20

export function useAvisosDoParceiro(ativo: () => boolean) {
  const store = useParceiroStore()

  /** `null` enquanto não se sabe: o sino fica sem número, em vez de afirmar zero. */
  const naoLidas = ref<number | null>(null)
  const avisos = ref<Aviso[]>([])
  const proximoCursor = ref<string | null>(null)
  const carregandoLista = ref(false)
  const carregandoMais = ref(false)
  const erroDaLista = ref(false)
  const listaCarregada = ref(false)
  const marcandoTodas = ref(false)
  const conferidoEm = ref<Date | null>(null)
  /** Para qual parceiro são os números na tela. */
  const doParceiro = ref<string | null | undefined>(undefined)

  function parceiroQuery() {
    return store.parceiroId
  }

  async function contar() {
    const parceiroId = parceiroQuery()

    try {
      const pagina = await listarAvisos({ parceiroId, limit: 1 })

      if (parceiroQuery() !== parceiroId) return

      naoLidas.value = pagina.naoLidasDoParceiro ?? 0
      conferidoEm.value = new Date()
    } catch {
      /* O sino fica com o último número que conheceu; sem nenhum, sem número. */
    } finally {
      if (parceiroQuery() === parceiroId) doParceiro.value = parceiroId
    }
  }

  async function carregarLista() {
    const parceiroId = parceiroQuery()

    carregandoLista.value = true
    erroDaLista.value = false

    try {
      const pagina = await listarAvisos({ parceiroId, limit: POR_PAGINA })

      if (parceiroQuery() !== parceiroId) return

      avisos.value = pagina.itens
      proximoCursor.value = pagina.proximoCursor
      naoLidas.value = pagina.naoLidasDoParceiro ?? 0
      conferidoEm.value = new Date()
      listaCarregada.value = true
    } catch {
      erroDaLista.value = true
    } finally {
      carregandoLista.value = false
    }
  }

  async function carregarMais() {
    if (!proximoCursor.value || carregandoMais.value) return

    const parceiroId = parceiroQuery()
    carregandoMais.value = true

    try {
      const pagina = await listarAvisos({
        parceiroId,
        cursor: proximoCursor.value,
        limit: POR_PAGINA,
      })

      if (parceiroQuery() !== parceiroId) return

      const vistos = new Set(avisos.value.map((aviso) => aviso.id))
      avisos.value = [...avisos.value, ...pagina.itens.filter((aviso) => !vistos.has(aviso.id))]
      proximoCursor.value = pagina.proximoCursor
      naoLidas.value = pagina.naoLidasDoParceiro ?? naoLidas.value
    } catch {
      erroDaLista.value = true
    } finally {
      carregandoMais.value = false
    }
  }

  function marcarNaTela(ids: Set<string>) {
    const agora = new Date().toISOString()
    let marcados = 0

    avisos.value = avisos.value.map((aviso) => {
      if (!ids.has(aviso.id) || aviso.lidaEm) return aviso

      marcados += 1
      return { ...aviso, lidaEm: agora }
    })

    if (naoLidas.value !== null) {
      naoLidas.value = Math.max(0, naoLidas.value - marcados)
    }
  }

  /**
   * Quem abriu um aviso leu. A tela marca na hora; se a API recusar, a próxima conferência corrige
   * o número.
   */
  function abrir(aviso: Aviso) {
    if (aviso.lidaEm) return

    marcarNaTela(new Set([aviso.id]))
    void abrirAviso(aviso.id).catch(() => contar())
  }

  /** Marca como lidos os avisos não lidos que estão na lista, um por um (ver `avisos-service`). */
  async function marcarTodasComoLidas() {
    const pendentes = avisos.value.filter((aviso) => !aviso.lidaEm).map((aviso) => aviso.id)

    if (pendentes.length === 0) return

    marcandoTodas.value = true

    try {
      const resultados = await Promise.allSettled(pendentes.map((id) => marcarAvisoComoLido(id)))
      const lidos = pendentes.filter((_, indice) => resultados[indice]?.status === 'fulfilled')

      marcarNaTela(new Set(lidos))
      /* Pode haver não lidas além da página carregada: o número volta do servidor. */
      await contar()
    } finally {
      marcandoTodas.value = false
    }
  }

  const naoLidasNaLista = computed(() => avisos.value.filter((aviso) => !aviso.lidaEm).length)

  /* Troca de parceiro: o sino e a lista são de outro. */
  watch(
    [ativo, () => store.parceiroId],
    ([ligado, parceiroId]) => {
      if (!ligado) return

      if (doParceiro.value !== parceiroId) {
        naoLidas.value = null
        avisos.value = []
        proximoCursor.value = null
        listaCarregada.value = false
        void contar()
      }
    },
    { immediate: true },
  )

  const reconferencia = criarReconferencia({
    recarregar: contar,
    conferidoEm: () => conferidoEm.value,
    carregado: () => doParceiro.value !== undefined,
  })

  reconferencia.assinar(ativo)

  return {
    naoLidas: computed(() => (ativo() ? naoLidas.value : null)),
    avisos,
    proximoCursor,
    carregandoLista,
    carregandoMais,
    erroDaLista,
    listaCarregada,
    marcandoTodas,
    naoLidasNaLista,
    carregarLista,
    carregarMais,
    abrir,
    marcarTodasComoLidas,
  }
}
