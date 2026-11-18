/**
 * Versão do portal, a do `package.json`, e de onde saiu o build (injetados pelo `vite.config.ts`).
 *
 * A versão sobe a cada push para `develop` ou `main` (Regra 5 do CLAUDE.md) e aparece no login e
 * no pé do menu da conta, para conferir no ambiente publicado se o que subiu já está no ar.
 */
export const VERSAO_DO_PORTAL = __VERSAO_DO_PORTAL__

/** Commit (7 caracteres, vazio se o build não soube) e momento do build, em ISO. */
export const BUILD_DO_PORTAL = __BUILD_DO_PORTAL__

/** Ramo de onde saiu o build (`develop`, `main`...); vazio quando o build não soube. */
export const RAMO_DO_BUILD = __RAMO_DO_BUILD__

/**
 * O build não é o de produção: roda na máquina (`npm run dev`) ou saiu de um ramo que não é a
 * `main` (o `develop`, publicado em portal-dev). O que só existe para mostrar e testar abre aqui e
 * fica fechado em produção. Ramo desconhecido conta como produção.
 */
export const FORA_DA_PRODUCAO =
  import.meta.env.DEV || (RAMO_DO_BUILD !== '' && RAMO_DO_BUILD !== 'main')

/** "Build de 09/11/2026 23:50 · 1ceb0b4", no idioma da tela, para a dica sobre a versão. */
export function descricaoDoBuild(rotulo: (data: string) => string, idioma: string): string {
  const data = new Date(BUILD_DO_PORTAL.data)
  const quando = Number.isNaN(data.getTime())
    ? BUILD_DO_PORTAL.data
    : new Intl.DateTimeFormat(idioma, { dateStyle: 'short', timeStyle: 'short' }).format(data)
  const texto = rotulo(quando)
  return BUILD_DO_PORTAL.commit ? `${texto} · ${BUILD_DO_PORTAL.commit}` : texto
}
