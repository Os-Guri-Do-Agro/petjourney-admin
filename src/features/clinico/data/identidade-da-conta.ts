/**
 * O nome da clínica da demonstração é o da empresa que está usando o portal.
 *
 * A demonstração nasceu como "PetJourney Clínica Veterinária", e era esse o nome que a página
 * pública de agendamento mostrava, com o endereço `/agendar/petjourney-vila-madalena`, para uma
 * conta que se chama "Aurora Clínica e Hotel Veterinário". Na apresentação, o tutor caía numa
 * clínica com outro nome e o dono perguntava de onde ela tinha saído.
 *
 * O nome vem do mesmo lugar que a barra do portal usa para mostrar a empresa no primeiro quadro:
 * o que a store do parceiro guarda ao ler o painel (`petjourney-parceiro-nome`, em
 * `src/stores/parceiro.ts`). Fica guardado depois de sair, e é por isso que a página pública,
 * aberta sem sessão, também o encontra. Sem nome guardado (teste, navegador limpo), segue o da
 * demonstração.
 */

/** A chave que `src/stores/parceiro.ts` usa para o nome da empresa da última sessão. */
const CHAVE_DO_NOME = 'petjourney-parceiro-nome'

export function nomeDaConta(): string | null {
  try {
    const nome = globalThis.localStorage?.getItem(CHAVE_DO_NOME)?.trim()

    return nome ? nome : null
  } catch {
    return null
  }
}

/** "Aurora Clínica e Hotel Veterinário" vira `aurora-clinica-e-hotel-veterinario`. */
export function slugDoNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
