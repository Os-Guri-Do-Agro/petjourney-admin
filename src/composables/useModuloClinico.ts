/**
 * Interruptor oculto do módulo clínico.
 *
 * As telas de `/veterinario/*` e a página de referência de `/design/clinico` rodam sobre uma
 * camada **mocada** — pacientes, prontuários e agenda são dados de demonstração. Elas existem
 * para apresentar e testar o módulo enquanto a API clínica não existe, e não devem aparecer
 * para quem abre o portal para trabalhar: um menu "Pacientes" com bichos que não existem é
 * indistinguível de um defeito.
 *
 * Por isso o módulo nasce **desligado** e só aparece quando alguém o liga de propósito.
 *
 * ## Como ligar
 *
 * Dois caminhos, porque servem a duas situações diferentes:
 *
 * 1. **Link**: `?clinico=on` em qualquer rota do portal. É o que se manda para alguém antes de
 *    uma demonstração — a pessoa clica e já entra com o módulo visível, sem instrução.
 * 2. **Teclado**: digitar `clinico` em qualquer tela, fora de campo de texto. É o caminho para
 *    quem já está com a tela aberta e não quer mexer na barra de endereço na frente de um
 *    cliente.
 *
 * Para desligar: `?clinico=off`, ou digitar a sequência de novo.
 *
 * ## Por que `localStorage` e não uma variável de ambiente
 *
 * Variável de ambiente é decidida no deploy e vale para todo mundo — exatamente o oposto do que
 * se quer aqui, que é uma pessoa ligar na própria máquina, para a própria sessão de
 * demonstração, sem republicar nada. E persiste porque quem ligou não quer religar a cada
 * recarga da página no meio da apresentação.
 */

import { computed, ref } from 'vue'

const CHAVE = 'clinic.moduleUnlocked'
/** Nome do parâmetro e da sequência. Curto o bastante para digitar sem errar. */
export const PARAMETRO_DO_MODULO = 'clinico'
const SEQUENCIA = 'clinico'

/**
 * Prefixos de rota que pertencem ao módulo.
 *
 * A página de referência de design entra junto: ela existe para revisar os componentes
 * clínicos e não faz sentido fora do módulo.
 */
export const ROTAS_DO_MODULO = ['/veterinario', '/design/clinico']

function lerArmazenado(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(CHAVE) === 'true'
  } catch {
    /* Navegador com armazenamento bloqueado: o módulo simplesmente fica desligado. */
    return false
  }
}

/**
 * Estado global do módulo, e não por componente: o menu, o guard de rota e a tela de ajustes
 * precisam ver o mesmo valor no mesmo instante.
 */
const desbloqueado = ref(lerArmazenado())

function gravar(valor: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (valor) {
      window.localStorage.setItem(CHAVE, 'true')
    } else {
      window.localStorage.removeItem(CHAVE)
    }
  } catch {
    /* Sem armazenamento, vale só para esta aba — melhor que quebrar a navegação. */
  }
}

export function definirModuloClinico(valor: boolean) {
  desbloqueado.value = valor
  gravar(valor)
}

export function alternarModuloClinico() {
  definirModuloClinico(!desbloqueado.value)

  return desbloqueado.value
}

/**
 * Lê o parâmetro da URL, quando presente.
 *
 * Devolve `true` quando o parâmetro **decidiu** alguma coisa, para que o guard saiba que
 * precisa limpar a query — deixar `?clinico=on` colado na barra de endereço transformaria o
 * caminho oculto numa placa.
 */
export function aplicarParametroDaUrl(valor: unknown): boolean {
  const bruto = Array.isArray(valor) ? valor[0] : valor

  if (typeof bruto !== 'string') {
    return false
  }

  const normalizado = bruto.toLowerCase()

  if (['on', '1', 'true', 'sim'].includes(normalizado)) {
    definirModuloClinico(true)

    return true
  }

  if (['off', '0', 'false', 'nao'].includes(normalizado)) {
    definirModuloClinico(false)

    return true
  }

  return false
}

export function rotaPertenceAoModulo(caminho: string): boolean {
  return ROTAS_DO_MODULO.some(
    (prefixo) => caminho === prefixo || caminho.startsWith(`${prefixo}/`),
  )
}

/**
 * Escuta a sequência de teclas.
 *
 * Ignora o que é digitado dentro de campo, `textarea` ou elemento editável — senão escrever
 * "clínico" numa anamnese ligaria e desligaria o módulo, e a agenda tem atalhos de uma letra
 * que colidiriam com qualquer buffer global.
 *
 * O buffer esquece depois de 1,5 s sem tecla: sem isso, letras digitadas ao longo de uma hora
 * acabariam formando a palavra por acidente.
 */
export function instalarSequenciaSecreta(aoAtivar?: (ativo: boolean) => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  let buffer = ''
  let ultimaTecla = 0

  function aoTeclar(evento: KeyboardEvent) {
    const alvo = evento.target as HTMLElement | null

    if (
      evento.ctrlKey ||
      evento.metaKey ||
      evento.altKey ||
      alvo?.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo?.tagName ?? '')
    ) {
      return
    }

    if (evento.key.length !== 1) {
      return
    }

    const agora = Date.now()

    buffer = agora - ultimaTecla > 1500 ? '' : buffer
    ultimaTecla = agora
    buffer = `${buffer}${evento.key.toLowerCase()}`.slice(-SEQUENCIA.length)

    if (buffer === SEQUENCIA) {
      buffer = ''
      aoAtivar?.(alternarModuloClinico())
    }
  }

  window.addEventListener('keydown', aoTeclar)

  return () => window.removeEventListener('keydown', aoTeclar)
}

export function useModuloClinico() {
  return {
    /** `true` quando as telas clínicas devem existir para esta pessoa, nesta máquina. */
    ativo: computed(() => desbloqueado.value),
    definir: definirModuloClinico,
    alternar: alternarModuloClinico,
  }
}
