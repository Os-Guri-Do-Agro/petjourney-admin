/**
 * Saúde pública: protótipo para a apresentação à Câmara de Campo Grande (Ofício 001/2026, 17/11/2026).
 *
 * O módulo inteiro roda sobre dados ilustrativos (`dados.ts`), sem API, e mostra o que o ofício
 * promete ao município: o painel por região e bairro para a Subea e o CCZ, as campanhas avisadas
 * aos tutores, as ONGs com a adoção que leva o histórico, e o relatório de 90 dias.
 *
 * O espaço aparece no menu no modo demonstração ou depois de abrir `/saude-publica` (qualquer
 * build, para apresentar também do ambiente publicado); "Sair do protótipo" tira de novo. Nada aqui
 * toca os dados da clínica.
 */
import { computed, ref } from 'vue'

import { useModoDemonstracao } from '@/composables/useModoDemonstracao'

const CHAVE = 'pj.prototipo.saude-publica'

function lerGravado(): boolean {
  try {
    return localStorage.getItem(CHAVE) === 'on'
  } catch {
    return false
  }
}

const ligado = ref(lerGravado())

function gravar(valor: boolean) {
  ligado.value = valor
  try {
    if (valor) localStorage.setItem(CHAVE, 'on')
    else localStorage.removeItem(CHAVE)
  } catch {
    /* Armazenamento bloqueado: vale até a recarga. */
  }
}

export function usePrototipoSaudePublica() {
  const { ativo: demonstracao } = useModoDemonstracao()

  const visivel = computed(() => demonstracao.value || ligado.value)

  return {
    visivel,
    ligar: () => gravar(true),
    desligar: () => gravar(false),
  }
}
