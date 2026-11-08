/**
 * Tela que não abre porque o arquivo dela sumiu do servidor.
 *
 * Cada tela do portal é um arquivo que só é baixado na primeira visita. Depois de uma publicação
 * nova, quem deixou o portal aberto ainda tem o `index.html` antigo, que aponta para arquivos que
 * já não existem: o clique na seta de "Acessos" tenta baixar a tela do pet, o servidor responde
 * 404 e o roteador desiste sem barulho. Para a pessoa, "eu clico e não faz nada", e só recarregar
 * a página conserta (setas da lista de Acessos).
 *
 * A saída é recarregar na própria rota que ela pediu: o `index.html` novo traz os arquivos certos
 * e o clique que parecia perdido termina onde devia.
 */

const CHAVE_DA_ULTIMA_RECARGA = 'pj:pagina-velha:recarregou-em'

/** Uma recarga por janela: se o arquivo faltar mesmo no `index.html` novo, não vira laço. */
export const JANELA_ENTRE_RECARGAS_MS = 60_000

/**
 * Os textos que os navegadores dão a um `import()` que falhou: Chrome e Edge, Firefox, Safari, e o
 * pré-carregamento de estilo do Vite.
 */
const PADRAO_DE_ARQUIVO_FALTANDO =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i

export function ehArquivoDeTelaFaltando(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : typeof erro === 'string' ? erro : ''

  return PADRAO_DE_ARQUIVO_FALTANDO.test(mensagem)
}

type Deps = {
  agora: () => number
  ler: () => string | null
  gravar: (valor: string) => void
  recarregarEm: (endereco: string) => void
}

function depsDoNavegador(): Deps {
  return {
    agora: () => Date.now(),
    ler: () => {
      try {
        return window.sessionStorage.getItem(CHAVE_DA_ULTIMA_RECARGA)
      } catch {
        return null
      }
    },
    gravar: (valor) => {
      try {
        window.sessionStorage.setItem(CHAVE_DA_ULTIMA_RECARGA, valor)
      } catch {
        /* Sem sessionStorage (janela privada bloqueada): a recarga acontece, só sem a trava. */
      }
    },
    recarregarEm: (endereco) => window.location.assign(endereco),
  }
}

/**
 * Devolve `true` quando recarregou a página em `destino`. `false` quando o erro é outro, ou quando
 * a recarga já foi tentada há pouco (o erro segue para quem o tratava antes).
 */
export function recarregarSeATelaSumiu(
  erro: unknown,
  destino: string,
  deps: Deps = depsDoNavegador(),
): boolean {
  if (!ehArquivoDeTelaFaltando(erro)) {
    return false
  }

  const ultima = Number(deps.ler())

  if (Number.isFinite(ultima) && ultima > 0 && deps.agora() - ultima < JANELA_ENTRE_RECARGAS_MS) {
    return false
  }

  deps.gravar(String(deps.agora()))
  deps.recarregarEm(destino)

  return true
}
