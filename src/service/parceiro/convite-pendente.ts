/**
 * O token do link do convite para a equipe, guardado fora da URL.
 *
 * O link do e-mail chega como `/parceiro/convite?token=...`. Deixar o token na barra o espalha
 * por histórico, captura de tela e pelo `?redirect=` do login, que é para onde vai quem abre o
 * link sem sessão. A guarda do roteador tira o token da URL na primeira navegação e o guarda
 * aqui; a página do convite lê daqui, depois do login se for o caso.
 *
 * `sessionStorage`: vale para a aba e some com ela, que é o tempo de vida de um convite aberto.
 */

const CHAVE = 'pj.convite-equipe.token'

export function guardarTokenDoConvite(token: string) {
  try {
    sessionStorage.setItem(CHAVE, token)
  } catch {
    /* Armazenamento bloqueado: o token se perde e a página pede para abrir o link de novo. */
  }
}

export function lerTokenDoConvite(): string | null {
  try {
    return sessionStorage.getItem(CHAVE)
  } catch {
    return null
  }
}

export function esquecerTokenDoConvite() {
  try {
    sessionStorage.removeItem(CHAVE)
  } catch {
    /* nada a limpar */
  }
}
