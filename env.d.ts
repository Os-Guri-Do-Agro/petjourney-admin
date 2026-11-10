/// <reference types="vite/client" />

/** Versão do `package.json`, injetada pelo `define` do `vite.config.ts`. Use `VERSAO_DO_PORTAL`. */
declare const __VERSAO_DO_PORTAL__: string

/** Commit e momento do build, injetados pelo `define` do `vite.config.ts`. Use `BUILD_DO_PORTAL`. */
declare const __BUILD_DO_PORTAL__: { commit: string; data: string }

declare module 'country-flag-icons/string/3x2/*' {
  const svg: string
  export default svg
}
