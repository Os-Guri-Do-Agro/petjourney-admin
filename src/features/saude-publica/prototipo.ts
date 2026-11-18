/**
 * Saúde pública: protótipo para as apresentações à Câmara de Campo Grande e à Subea (Ofícios 001 e
 * 002/2026, 17/11/2026).
 *
 * O módulo inteiro roda sobre dados ilustrativos (`dados.ts`), sem API, e mostra o que os ofícios
 * prometem ao município: o painel por região e bairro, o piloto com a Subea, as campanhas avisadas
 * aos tutores, as ONGs com a adoção que leva o histórico, e o relatório de 90 dias.
 *
 * **Aberto fora da produção** (pedido do Luís, 18/11/2026: "na branch de develop deixe ele
 * aberto"): no `npm run dev` e no build do `develop` (portal-dev), o espaço fica no menu de todos.
 * No build da `main` continua escondido, como pedido em 17/11: só chega nele quem abre o endereço
 * (`/saude-publica`), e o menu mostra o espaço só enquanto se está numa tela dele. "Sair do
 * protótipo" volta ao Início. A marca que uma versão antiga gravava no navegador é apagada na
 * primeira leitura.
 */
import { FORA_DA_PRODUCAO } from '@/utils/versao'

const CHAVE_ANTIGA = 'pj.prototipo.saude-publica'

let antigaApagada = false

function apagarMarcaAntiga() {
  if (antigaApagada) return
  antigaApagada = true
  try {
    localStorage.removeItem(CHAVE_ANTIGA)
  } catch {
    /* Armazenamento bloqueado: não há marca para apagar. */
  }
}

/** O caminho é de uma tela do protótipo. */
export function noPrototipoDeSaudePublica(caminho: string) {
  apagarMarcaAntiga()
  return caminho === '/saude-publica' || caminho.startsWith('/saude-publica/')
}

/**
 * O espaço aparece no menu: sempre fora da produção; em produção, só enquanto se está numa tela
 * dele.
 */
export function saudePublicaNoMenu(caminho: string, foraDaProducao = FORA_DA_PRODUCAO) {
  return noPrototipoDeSaudePublica(caminho) || foraDaProducao
}
