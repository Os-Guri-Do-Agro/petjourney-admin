/**
 * As páginas do portal que abrem sem conta: o agendamento online da clínica e a reserva do hotel.
 *
 * São do responsável, que não tem login no portal — por isso não passam pelo "sem sessão vai para
 * o login" nem pelo "com sessão sai da página pública". E são do módulo oculto (dados de
 * demonstração): só abrem com o módulo ligado, pelo mesmo `?clinico=on` / `?hotel=on` de sempre,
 * que funciona também sem sessão.
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
