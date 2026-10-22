/**
 * Interruptor oculto do módulo clínico.
 *
 * As telas de `/veterinario/*` e a página de referência de `/design/clinico` rodam sobre uma
 * camada **mocada** — pacientes, prontuários e agenda são dados de demonstração. Elas existem para
 * apresentar e testar o módulo enquanto a API clínica não existe, e não devem aparecer para quem
 * abre o portal para trabalhar: um menu "Pacientes" com bichos que não existem é indistinguível de
 * um defeito.
 *
 * Por isso o módulo nasce **desligado** e só aparece quando alguém o liga de propósito.
 *
 * ## Como ligar
 *
 * Dois caminhos, porque servem a duas situações diferentes:
 *
 * 1. **Link**: `?clinico=on` em qualquer rota do portal. É o que se manda para alguém antes de uma
 *    demonstração — a pessoa clica e já entra com o módulo visível, sem instrução.
 * 2. **Teclado**: digitar `clinico` em qualquer tela, fora de campo de texto. É o caminho para
 *    quem já está com a tela aberta e não quer mexer na barra de endereço na frente de um cliente.
 *
 * Para desligar: `?clinico=off`, ou digitar a sequência de novo.
 *
 * ## Onde mora o mecanismo
 *
 * Em `useModuloOculto`, partilhado com o hotel. O que **não** pode ser perdido numa refatoração
 * está documentado lá: o desbloqueio pertence à conta que o ligou, e não ao navegador. A regra
 * nasceu de um vazamento em produção, e `__tests__/useModuloClinico.spec.ts` existe para que ela
 * não volte.
 */

import {
  criarModuloOculto,
  instalarSequenciasSecretas,
  type ModuloOculto,
} from './useModuloOculto'

/** Nome do parâmetro e da sequência. Curto o bastante para digitar sem errar. */
export const PARAMETRO_DO_MODULO = 'clinico'

/**
 * Prefixos de rota que pertencem ao módulo.
 *
 * A página de referência de design entra junto: ela existe para revisar os componentes clínicos e
 * não faz sentido fora do módulo.
 */
export const ROTAS_DO_MODULO = ['/veterinario', '/design/clinico']

const modulo: ModuloOculto = criarModuloOculto({
  chave: 'clinic.moduleUnlocked',
  parametro: PARAMETRO_DO_MODULO,
  rotas: ROTAS_DO_MODULO,
})

export function definirModuloClinico(valor: boolean) {
  modulo.definir(valor)
}

export function alternarModuloClinico() {
  return modulo.alternar()
}

export function aplicarParametroDaUrl(valor: unknown): boolean {
  return modulo.aplicarParametroDaUrl(valor)
}

export function rotaPertenceAoModulo(caminho: string): boolean {
  return modulo.rotaPertenceAoModulo(caminho)
}

/**
 * Continua exportada para quem só quer a sequência clínica.
 *
 * A raiz do app usa `instalarSequenciasSecretas` com os dois módulos de uma vez: dois ouvintes de
 * `keydown` globais sobre o mesmo buffer seriam dois lugares para esquecer a guarda de campo de
 * texto.
 */
export function instalarSequenciaSecreta(aoAtivar?: (ativo: boolean) => void) {
  return instalarSequenciasSecretas([{ modulo, aoAlternar: aoAtivar }])
}

export function useModuloClinico() {
  return {
    /** `true` quando as telas clínicas devem existir para **esta conta**, nesta máquina. */
    ativo: modulo.ativo,
    definir: modulo.definir,
    alternar: modulo.alternar,
  }
}

/** O módulo cru, para a raiz do app instalar a sequência junto com a dos outros. */
export const moduloClinico = modulo
