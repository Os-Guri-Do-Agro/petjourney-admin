/**
 * Versão do portal, a do `package.json`, e de onde saiu o build (injetados pelo `vite.config.ts`).
 *
 * A versão sobe a cada push para `develop` ou `main` (Regra 5 do CLAUDE.md) e aparece no login e
 * no pé do menu da conta, para conferir no ambiente publicado se o que subiu já está no ar.
 */
export const VERSAO_DO_PORTAL = __VERSAO_DO_PORTAL__

/** Commit (7 caracteres, vazio se o build não soube) e momento do build, em ISO. */
export const BUILD_DO_PORTAL = __BUILD_DO_PORTAL__

/** "Build de 09/11/2026 23:50 · 1ceb0b4", no idioma da tela, para a dica sobre a versão. */
export function descricaoDoBuild(rotulo: (data: string) => string, idioma: string): string {
  const data = new Date(BUILD_DO_PORTAL.data)
  const quando = Number.isNaN(data.getTime())
    ? BUILD_DO_PORTAL.data
    : new Intl.DateTimeFormat(idioma, { dateStyle: 'short', timeStyle: 'short' }).format(data)
  const texto = rotulo(quando)
  return BUILD_DO_PORTAL.commit ? `${texto} · ${BUILD_DO_PORTAL.commit}` : texto
}
