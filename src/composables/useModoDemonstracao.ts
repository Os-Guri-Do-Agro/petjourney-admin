/**
 * Modo demonstração: as telas de verdade do portal sobre uma clínica de exemplo cheia de dados, para
 * apresentar e tirar capturas (`src/demonstracao`).
 *
 * Não troca tela nenhuma: com o modo ligado, as chamadas à API são respondidas no navegador, na
 * forma do contrato, e o portal monta como montaria com o servidor. Só existe fora da produção
 * (`npm run dev` e o build do `develop`): no build da `main`, `FORA_DA_PRODUCAO` é `false` e o modo
 * fica desligado de vez.
 *
 * Liga e desliga pelo menu da conta. Fica gravado no navegador para sobreviver à recarga no meio da
 * apresentação. Ligar e desligar recarregam a página: as telas e os stores não misturam dado de
 * verdade com dado de exemplo.
 */

import { computed, ref } from 'vue'

import { CHAVE_DA_DEMONSTRACAO } from '@/composables/modo-demonstracao-chave'
import { FORA_DA_PRODUCAO } from '@/utils/versao'

export const DEMONSTRACAO_DISPONIVEL = FORA_DA_PRODUCAO

function lerGravado(): boolean {
  try {
    return localStorage.getItem(CHAVE_DA_DEMONSTRACAO) === 'on'
  } catch {
    return false
  }
}

const ligado = ref(DEMONSTRACAO_DISPONIVEL && lerGravado())

const ativo = computed(() => DEMONSTRACAO_DISPONIVEL && ligado.value)

/**
 * Liga ou desliga e recarrega a página em `destino` (o Início, por padrão). Ao ligar, a sessão de
 * verdade fica guardada e entra a da clínica de exemplo; ao desligar, ela volta.
 */
async function definir(valor: boolean, destino = '/inicio') {
  if (!DEMONSTRACAO_DISPONIVEL || valor === ligado.value) {
    return
  }

  const sessao = await import('@/demonstracao/sessao')

  try {
    if (valor) {
      localStorage.setItem(CHAVE_DA_DEMONSTRACAO, 'on')
      sessao.entrarNaSessaoDaDemonstracao()
    } else {
      localStorage.removeItem(CHAVE_DA_DEMONSTRACAO)
      sessao.sairDaSessaoDaDemonstracao()
    }
  } catch {
    /* Armazenamento bloqueado: sem onde guardar, o modo não tem como mudar. */
    return
  }

  ligado.value = valor
  window.location.assign(destino)
}

export function useModoDemonstracao() {
  return { ativo, definir, disponivel: DEMONSTRACAO_DISPONIVEL }
}

/** Para o `main.ts`: com o modo ligado, as rotas de exemplo entram antes do primeiro pedido. */
export async function prepararDemonstracao() {
  if (!DEMONSTRACAO_DISPONIVEL || !ativo.value) return
  const { instalarDemonstracao } = await import('@/demonstracao')
  await instalarDemonstracao()
}
