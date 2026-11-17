/**
 * O que a apresentação cria durante a sessão: campanhas novas e adoções registradas. Fica na
 * memória da aba (recarregar volta ao começo), para a demonstração poder ser repetida do zero.
 */
import { ref } from 'vue'

import { ADOCOES, CAMPANHAS, type Adocao, type Campanha } from '@/features/saude-publica/dados'

const campanhas = ref<Campanha[]>([...CAMPANHAS])
const adocoes = ref<Adocao[]>([...ADOCOES])
/** Os animais que já foram adotados na sessão, para sair da lista de quem espera. */
const adotados = ref<string[]>([])

export function useEstadoDoPrototipo() {
  function criarCampanha(campanha: Omit<Campanha, 'id'>) {
    campanhas.value = [{ ...campanha, id: `n${campanhas.value.length + 1}` }, ...campanhas.value]
  }

  function registrarAdocao(adocao: Omit<Adocao, 'id'>, animalId: string) {
    adocoes.value = [{ ...adocao, id: `n${adocoes.value.length + 1}` }, ...adocoes.value]
    adotados.value = [...adotados.value, animalId]
  }

  return { campanhas, adocoes, adotados, criarCampanha, registrarAdocao }
}
