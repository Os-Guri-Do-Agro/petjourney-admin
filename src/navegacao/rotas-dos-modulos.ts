/**
 * Quem abre cada tela da Clínica e do Hotel.
 *
 * Uma tela de módulo abre quando:
 * - o módulo dela tem `podeLer` no `GET /parceiro/portal/eu` (E1-02);
 * - a conta tem a permissão da tela, da matriz da E1-03;
 * - a tela já fala com a API (`integrada`).
 *
 * Fora disso, só no modo demonstração (build de desenvolvimento), sobre os dados locais.
 *
 * `integrada` é o estado da integração tela a tela: nasce `false` e vira `true` no commit que liga
 * a tela às rotas da API. Enquanto for `false`, a tela some do menu e a rota volta para o início
 * fora da demonstração: dado de mentira não aparece para quem está trabalhando.
 *
 * As permissões seguem as seções "Quem entra" dos guias (`docs/integracao-portal-parceiro/guias`).
 */

import type { NomeDoModulo, Permissao } from '@/service/parceiro/acesso-service'

export type ModuloDaRota = NomeDoModulo | 'QUALQUER'

export type RotaDeModulo = {
  /** Prefixo do caminho. O mais longo que casa vence. */
  prefixo: string
  modulo: ModuloDaRota
  permissao: Permissao
  integrada: boolean
  /** Só existe na demonstração, com ou sem API (vitrine de design, páginas públicas de mock). */
  soDemonstracao?: boolean
}

export const ROTAS_DOS_MODULOS: readonly RotaDeModulo[] = [
  /* Clínica: a recepção e o dia (E3). */
  { prefixo: '/clinica/meu-dia', modulo: 'CLINICA', permissao: 'agenda.ler', integrada: false },
  { prefixo: '/clinica/agenda', modulo: 'CLINICA', permissao: 'agenda.ler', integrada: false },
  {
    prefixo: '/clinica/pedidos',
    modulo: 'CLINICA',
    permissao: 'pedido.responder',
    integrada: false,
  },
  { prefixo: '/clinica/fila', modulo: 'CLINICA', permissao: 'fila.gerir', integrada: false },
  { prefixo: '/clinica/faltas', modulo: 'CLINICA', permissao: 'agenda.ler', integrada: false },
  {
    prefixo: '/clinica/atividades',
    modulo: 'CLINICA',
    permissao: 'agenda.ler',
    integrada: false,
  },
  { prefixo: '/clinica/resumo', modulo: 'CLINICA', permissao: 'agenda.ler', integrada: false },

  /* Clínica: prontuário, receita, vacinas e adesão (E4). */
  {
    prefixo: '/clinica/atendimentos',
    modulo: 'CLINICA',
    permissao: 'prontuario.ler',
    integrada: false,
  },
  {
    prefixo: '/clinica/atendimento',
    modulo: 'CLINICA',
    permissao: 'prontuario.ler',
    integrada: false,
  },
  {
    prefixo: '/clinica/bulario',
    modulo: 'CLINICA',
    permissao: 'prontuario.ler',
    integrada: false,
  },
  { prefixo: '/clinica/vacinas', modulo: 'CLINICA', permissao: 'agenda.ler', integrada: false },
  {
    prefixo: '/clinica/tratamentos',
    modulo: 'CLINICA',
    permissao: 'prontuario.ler',
    integrada: false,
  },

  /* Clínica: internação e estoque (E5, E6). */
  {
    prefixo: '/clinica/internacao',
    modulo: 'CLINICA',
    permissao: 'internacao.executar',
    integrada: false,
  },
  {
    prefixo: '/clinica/estoque',
    modulo: 'CLINICA',
    permissao: 'estoque.ler',
    integrada: false,
  },

  /* O cadastro de clientes e pacientes é dos dois módulos (E2-01). */
  {
    prefixo: '/clinica/pacientes',
    modulo: 'QUALQUER',
    permissao: 'paciente.ler',
    integrada: false,
  },
  {
    prefixo: '/clinica/paciente',
    modulo: 'QUALQUER',
    permissao: 'paciente.ler',
    integrada: false,
  },
  {
    prefixo: '/clinica/paciente/importar',
    modulo: 'QUALQUER',
    permissao: 'importacao.executar',
    integrada: false,
  },

  /* Vitrine de design do módulo: não é tela de trabalho. */
  {
    prefixo: '/design/clinico',
    modulo: 'CLINICA',
    permissao: 'agenda.ler',
    integrada: false,
    soDemonstracao: true,
  },

  /* Hotel (E7): ainda sem API. */
  { prefixo: '/hotel', modulo: 'HOTEL', permissao: 'hotel.ler', integrada: false },
]

/** Caminhos de módulo que não têm entrada própria caem no prefixo do módulo. */
const PREFIXOS_DO_MODULO: ReadonlyArray<[string, NomeDoModulo]> = [
  ['/clinica', 'CLINICA'],
  ['/hotel', 'HOTEL'],
]

function casa(caminho: string, prefixo: string) {
  return caminho === prefixo || caminho.startsWith(`${prefixo}/`)
}

/** A entrada do registro para o caminho, ou `null` quando ele não é de módulo. */
export function rotaDoModulo(caminho: string): RotaDeModulo | null {
  const candidatas = ROTAS_DOS_MODULOS.filter((rota) => casa(caminho, rota.prefixo))

  if (candidatas.length) {
    return candidatas.reduce((maior, rota) =>
      rota.prefixo.length > maior.prefixo.length ? rota : maior,
    )
  }

  const modulo = PREFIXOS_DO_MODULO.find(([prefixo]) => casa(caminho, prefixo))?.[1]

  /* Tela de módulo sem entrada é tela nova: abre só na demonstração até alguém registrá-la. */
  return modulo
    ? { prefixo: caminho, modulo, permissao: 'agenda.ler', integrada: false, soDemonstracao: true }
    : null
}

export type AcessoDaConta = {
  demonstracao: boolean
  podeLer: (modulo: NomeDoModulo) => boolean
  temPermissao: (permissao: Permissao) => boolean
}

export function podeAbrirRotaDeModulo(rota: RotaDeModulo, acesso: AcessoDaConta): boolean {
  if (acesso.demonstracao) {
    return true
  }

  if (rota.soDemonstracao || !rota.integrada) {
    return false
  }

  const moduloLiberado =
    rota.modulo === 'QUALQUER'
      ? acesso.podeLer('CLINICA') || acesso.podeLer('HOTEL')
      : acesso.podeLer(rota.modulo)

  return moduloLiberado && acesso.temPermissao(rota.permissao)
}

/** Atalho para o guard e para o menu: caminho que não é de módulo sempre abre. */
export function podeAbrirCaminho(caminho: string, acesso: AcessoDaConta): boolean {
  const rota = rotaDoModulo(caminho)

  return rota ? podeAbrirRotaDeModulo(rota, acesso) : true
}
