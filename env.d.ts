/// <reference types="vite/client" />

/** Versão do `package.json`, injetada pelo `define` do `vite.config.ts`. Use `VERSAO_DO_PORTAL`. */
declare const __VERSAO_DO_PORTAL__: string

declare module 'country-flag-icons/string/3x2/*' {
  const svg: string
  export default svg
}
