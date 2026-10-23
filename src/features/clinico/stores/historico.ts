/**
 * Store do histórico liberado — o lado da recepção do histórico que viaja com o pet.
 *
 * `versao` sobe a cada mudança, de lá ou de cá: encerrar no celular da demonstração faz a lista
 * da clínica reler na hora, e abrir aqui faz o celular mostrar a abertura em "Quem abriu".
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { historicoLiberadoRepository, type LinhaDoHistorico } from '../data/historico-compartilhado'

export const useHistoricoLiberadoStore = defineStore('clinico-historico', () => {
  const linhas = ref<LinhaDoHistorico[]>([])
  const carregando = ref(false)
  const carregado = ref(false)
  const erro = ref('')
  const versao = ref(0)

  const valendo = computed(() => linhas.value.filter((linha) => linha.estado === 'ativo'))
  const terminados = computed(() => linhas.value.filter((linha) => linha.estado === 'terminou'))

  async function carregar() {
    carregando.value = true
    erro.value = ''

    try {
      linhas.value = await historicoLiberadoRepository.listar()
      carregado.value = true
    } catch {
      erro.value = 'clinico.historicoLiberado.erros.carregar'
    } finally {
      carregando.value = false
    }
  }

  /** Algo mudou — aqui ou no celular. Relê a lista e avisa quem acompanha a versão. */
  async function avisarMudanca() {
    versao.value += 1
    await carregar()
  }

  return {
    linhas,
    carregando,
    carregado,
    erro,
    versao,
    valendo,
    terminados,
    carregar,
    avisarMudanca,
  }
})
