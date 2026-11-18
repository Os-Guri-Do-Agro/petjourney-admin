/**
 * Saúde pública: protótipo para as apresentações à Câmara de Campo Grande e à Subea (Ofícios 001 e
 * 002/2026, 17/11/2026).
 *
 * O módulo inteiro roda sobre dados ilustrativos (`dados.ts`), sem API, e mostra o que os ofícios
 * prometem ao município: o painel por região e bairro, o piloto com a Subea, as campanhas avisadas
 * aos tutores, as ONGs com a adoção que leva o histórico, e o relatório de 90 dias.
 *
 * **Escondido** (pedido do Luís, 17/11/2026: "deixar o módulo de saúde pública escondido"): o espaço
 * não aparece no menu de ninguém, nem no modo demonstração. Só chega nele quem abre o endereço
 * (`/saude-publica`), e o menu mostra o espaço só enquanto se está numa tela dele, para andar entre
 * o painel, o piloto, as campanhas, as ONGs e o relatório. "Sair do protótipo" volta ao Início, e o
 * espaço some. Antes, abrir uma vez gravava no navegador e o espaço ficava no menu para sempre:
 * essa marca antiga é apagada na primeira leitura.
 */

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

/** O caminho é de uma tela do protótipo: só aí o espaço aparece no menu. */
export function noPrototipoDeSaudePublica(caminho: string) {
  apagarMarcaAntiga()
  return caminho === '/saude-publica' || caminho.startsWith('/saude-publica/')
}
