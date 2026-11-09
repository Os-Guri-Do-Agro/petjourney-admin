/**
 * Versão do portal, a do `package.json` (injetada no build pelo `vite.config.ts`).
 *
 * Sobe a cada push para `develop` ou `main` (Regra 5 do CLAUDE.md) e aparece no pé do menu da
 * conta, para conferir no ambiente publicado se o que subiu já está no ar.
 */
export const VERSAO_DO_PORTAL = __VERSAO_DO_PORTAL__
