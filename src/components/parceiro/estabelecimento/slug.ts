/**
 * O endereço da página pública, como a API aceita: de 3 a 60 caracteres, só `a-z`, `0-9` e hífen,
 * sem hífen nas pontas nem dois seguidos. Palavra reservada a API confere.
 */
const FORMATO = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function slugValido(slug: string) {
  return slug.length >= 3 && slug.length <= 60 && FORMATO.test(slug)
}

/** "Clínica Boa Vista!" vira "clinica-boa-vista": sem acento, minúsculo, hífen no lugar do resto. */
export function paraSlug(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}
