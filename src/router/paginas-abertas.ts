/**
 * As páginas do portal que abrem sem conta: o agendamento online da clínica e a reserva do hotel.
 *
 * São do responsável, que não tem login no portal — por isso não passam pelo "sem sessão vai para
 * o login" nem pelo "com sessão sai da página pública". Ainda rodam sobre os dados locais: só
 * abrem no modo demonstração (build de desenvolvimento), até a E3-05 e a E7-03 ligarem as duas
 * páginas às rotas `/public` da API.
 *
 * Moram fora da moldura do portal (`App.vue`): quem chega pelo link da clínica não vê menu de
 * parceiro.
 */

export type ModuloDaPaginaAberta = 'clinico' | 'hotel'

const PREFIXOS: Array<[string, ModuloDaPaginaAberta]> = [
  ['/agendar/', 'clinico'],
  ['/reservar/', 'hotel'],
]

export function moduloDaPaginaAberta(caminho: string): ModuloDaPaginaAberta | null {
  return PREFIXOS.find(([prefixo]) => caminho.startsWith(prefixo))?.[1] ?? null
}
