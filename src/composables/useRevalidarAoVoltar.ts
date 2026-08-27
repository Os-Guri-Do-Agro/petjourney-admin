import { onMounted, onUnmounted } from 'vue'

/**
 * Relê os dados quando a aba volta a ficar visível.
 *
 * Existe por causa de uma decisão de produto do acesso temporário: **não há notificação**
 * quando o responsável mexe num acesso já concedido. O canal público é anônimo por desenho — a
 * trilha de abertura não pode gravar quem o responsável escolheu confiar —, e avisar só o
 * parceiro com conta criaria um sistema em que a mesma operação é visível para um e invisível
 * para outro. A consequência é que o estado muda em silêncio entre dois carregamentos.
 *
 * Sem isso, uma tela aberta desde a manhã segue mostrando categorias que já foram retiradas e
 * uma contagem regressiva para uma validade que já foi encurtada. Voltar para a aba é o momento
 * mais barato de corrigir: não custa clique e é quando a pessoa vai voltar a confiar no que lê.
 *
 * O intervalo mínimo evita a rajada de quem alterna entre janelas — alt-tab não é intenção de
 * atualizar. Só `visibilitychange`, e não `focus`: clicar de volta na mesma aba dispara `focus`
 * sem que nada tenha tido tempo de mudar.
 */
const INTERVALO_MINIMO_MS = 30_000

export function useRevalidarAoVoltar(revalidar: () => void, intervaloMs = INTERVALO_MINIMO_MS) {
  let ultimaEm = Date.now()

  function aoMudarVisibilidade() {
    if (document.visibilityState !== 'visible') {
      return
    }

    const agora = Date.now()

    if (agora - ultimaEm < intervaloMs) {
      return
    }

    ultimaEm = agora
    revalidar()
  }

  onMounted(() => {
    /** A montagem já leu; o relógio começa aqui para a primeira volta não reler à toa. */
    ultimaEm = Date.now()
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', aoMudarVisibilidade)
  })
}
