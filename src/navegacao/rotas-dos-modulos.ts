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
  /* O Meu dia pela rota `meu-dia` (E3-08, PJ-W2RB1D). */
  { prefixo: '/clinica/meu-dia', modulo: 'CLINICA', permissao: 'agenda.ler', integrada: true },
  /* A agenda pela API (E3-02, PJ-4BS8TK); a demonstração segue com a de sempre. */
  { prefixo: '/clinica/agenda', modulo: 'CLINICA', permissao: 'agenda.ler', integrada: true },
  {
    prefixo: '/clinica/pedidos',
    modulo: 'CLINICA',
    permissao: 'pedido.responder',
    /* A caixa pela API (E3-05, PJ-SVL85R); a demonstração segue com a de sempre. */
    integrada: true,
  },
  /* A fila pela API (E3-04, PJ-07YV9I): ler é agenda.ler; gerir, fila.gerir (a tela esconde os botões). */
  { prefixo: '/clinica/fila', modulo: 'CLINICA', permissao: 'agenda.ler', integrada: true },
  /* As faltas pela API (E3-03, PJ-MVMNOZ); a demonstração segue com o painel de sempre. */
  { prefixo: '/clinica/faltas', modulo: 'CLINICA', permissao: 'agenda.ler', integrada: true },
  {
    prefixo: '/clinica/atividades',
    modulo: 'CLINICA',
    permissao: 'agenda.ler',
    integrada: true,
  },
  /* Atividades e resumo pelas rotas de painel (E3-08, PJ-W2RB1D). */
  { prefixo: '/clinica/resumo', modulo: 'CLINICA', permissao: 'agenda.ler', integrada: true },

  /* Clínica: a configuração da agenda (E3-01, PJ-GL3IVL), já pela API. */
  {
    prefixo: '/clinica/configuracao',
    modulo: 'CLINICA',
    permissao: 'agenda.ler',
    integrada: true,
  },

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

  /*
   * O cadastro de clientes e pacientes é dos dois módulos (E2-01, PJ-ECWI3Z): a lista, a ficha do
   * cadastro (`/clinica/ficha/:id`) e o cadastro novo falam com a API. A ficha da demonstração
   * (`/clinica/paciente/:id/historico`, vacinas, tratamento) espera o prontuário (E4).
   */
  {
    prefixo: '/clinica/pacientes',
    modulo: 'QUALQUER',
    permissao: 'paciente.ler',
    integrada: true,
  },
  /* Os pedidos de correção que os responsáveis mandam pelo app (E2-02, PJ-HD8PAB). */
  {
    prefixo: '/clinica/correcoes',
    modulo: 'QUALQUER',
    permissao: 'paciente.ler',
    integrada: true,
  },
  {
    prefixo: '/clinica/ficha',
    modulo: 'QUALQUER',
    permissao: 'paciente.ler',
    integrada: true,
  },
  {
    prefixo: '/clinica/paciente/novo',
    modulo: 'QUALQUER',
    permissao: 'paciente.escrever',
    integrada: true,
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
    integrada: true,
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
