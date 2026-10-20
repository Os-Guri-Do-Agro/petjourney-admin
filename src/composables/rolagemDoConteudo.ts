/**
 * Quem rola a tela.
 *
 * Em tela larga a moldura é uma folha presa na janela, e quem rola é o `main#conteudo` dentro
 * dela; no celular a folha some e quem rola é a janela, como sempre. Telas que acompanham a
 * rolagem (o prontuário, que encolhe o cabeçalho do paciente) perguntam aqui, em vez de supor a
 * janela.
 */

/** O elemento que rola o conteúdo, ou `window` quando é a janela. */
export function roladorDoConteudo(): HTMLElement | Window {
  if (typeof document === 'undefined') {
    return window
  }

  const conteudo = document.getElementById('conteudo')

  if (!conteudo) {
    return window
  }

  const estilo = getComputedStyle(conteudo).overflowY

  return estilo === 'auto' || estilo === 'scroll' ? conteudo : window
}

/** Onde, na janela, começa a área visível do conteúdo (0 quando quem rola é a janela). */
export function topoDoRolador(): number {
  const rolador = roladorDoConteudo()

  return rolador instanceof HTMLElement ? rolador.getBoundingClientRect().top : 0
}

/** Rola o conteúdo até `top` (em coordenadas do próprio rolador). */
export function rolarConteudoPara(top: number, behavior: ScrollBehavior = 'auto') {
  roladorDoConteudo().scrollTo({ top, behavior })
}

/** Quanto o conteúdo já rolou. */
export function rolagemAtual(): number {
  const rolador = roladorDoConteudo()

  return rolador instanceof HTMLElement ? rolador.scrollTop : window.scrollY
}
