/**
 * Interruptor oculto do módulo hotel.
 *
 * As telas de `/hotel/*` rodam sobre uma camada **mocada** — hóspedes, reservas e acomodações são
 * dados de demonstração. Elas existem para apresentar e testar o módulo enquanto a API de
 * hospedagem não existe, e não devem aparecer para quem abre o portal para trabalhar: um menu
 * "Hóspedes" com animais que não existem é indistinguível de um defeito.
 *
 * Mesmo mecanismo do clínico — inclusive a parte que importa, que é o desbloqueio pertencer à
 * **conta** e não ao navegador. Ver `useModuloOculto`.
 *
 * ## Como ligar
 *
 * 1. **Link**: `?hotel=on` em qualquer rota do portal.
 * 2. **Teclado**: digitar `hotel` em qualquer tela, fora de campo de texto.
 *
 * Para desligar: `?hotel=off`, ou digitar a sequência de novo.
 *
 * ## Por que a chave é separada da clínica
 *
 * Uma casa pode ter os dois módulos e pode ter só um. Uma chave única faria a demonstração do
 * hotel acender o menu clínico junto — doze telas de prontuário para quem foi ver hospedagem — e
 * desligar um desligaria o outro no meio da apresentação.
 */

import {
  criarModuloOculto,
  instalarSequenciasSecretas,
  type ModuloOculto,
} from './useModuloOculto'

/** Nome do parâmetro e da sequência. */
export const PARAMETRO_DO_HOTEL = 'hotel'

export const ROTAS_DO_HOTEL = ['/hotel']

const modulo: ModuloOculto = criarModuloOculto({
  chave: 'hotel.moduleUnlocked',
  parametro: PARAMETRO_DO_HOTEL,
  rotas: ROTAS_DO_HOTEL,
})

export function definirModuloHotel(valor: boolean) {
  modulo.definir(valor)
}

export function alternarModuloHotel() {
  return modulo.alternar()
}

export function aplicarParametroDoHotel(valor: unknown): boolean {
  return modulo.aplicarParametroDaUrl(valor)
}

export function rotaPertenceAoHotel(caminho: string): boolean {
  return modulo.rotaPertenceAoModulo(caminho)
}

export function instalarSequenciaDoHotel(aoAtivar?: (ativo: boolean) => void) {
  return instalarSequenciasSecretas([{ modulo, aoAlternar: aoAtivar }])
}

export function useModuloHotel() {
  return {
    /** `true` quando as telas do hotel devem existir para **esta conta**, nesta máquina. */
    ativo: modulo.ativo,
    definir: modulo.definir,
    alternar: modulo.alternar,
  }
}

/** O módulo cru, para a raiz do app instalar a sequência junto com a dos outros. */
export const moduloHotel = modulo
