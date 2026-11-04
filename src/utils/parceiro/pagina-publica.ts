/**
 * Os endereços da página pública do estabelecimento, que mora no site (E1-01, Q2 de 22/10): a
 * clínica em `/agendar/<slug>` e o hotel em `/reservar/<slug>`, os dois no mesmo slug.
 *
 * Sempre a raiz `petjourney.health`, nunca um subdomínio do portal: é o endereço que vai no QR do
 * balcão e no Instagram, e precisa abrir para qualquer pessoa. `VITE_SITE_URL` troca só para testar
 * um site de homologação.
 */

import type { ModuloDoPortal, NomeDoModulo } from '@/service/parceiro/acesso-service'

export const SITE_PUBLICO = (import.meta.env.VITE_SITE_URL || 'https://petjourney.health').replace(
  /\/+$/,
  '',
)

export type LinkDaPaginaPublica = {
  tipo: 'clinica' | 'hotel'
  url: string
}

const CAMINHO: Record<LinkDaPaginaPublica['tipo'], string> = {
  clinica: 'agendar',
  hotel: 'reservar',
}

/**
 * Que páginas a casa tem: a do módulo pedido ou ligado e a que a categoria do cadastro sugere
 * (`elegiveis`). Casa sem nenhum dos dois (um pet shop, por exemplo) fica com a de `/agendar`, que é
 * a página do estabelecimento com nome, endereço e horários.
 */
export function linksDaPaginaPublica(
  slug: string,
  modulos: readonly Pick<ModuloDoPortal, 'modulo' | 'status'>[],
  elegiveis: readonly NomeDoModulo[],
): LinkDaPaginaPublica[] {
  const tem = (nome: NomeDoModulo) =>
    elegiveis.includes(nome) || modulos.some((item) => item.modulo === nome && item.status != null)

  const tipos: LinkDaPaginaPublica['tipo'][] = []

  if (tem('CLINICA')) {
    tipos.push('clinica')
  }

  if (tem('HOTEL')) {
    tipos.push('hotel')
  }

  return (tipos.length ? tipos : (['clinica'] as const)).map((tipo) => ({
    tipo,
    url: `${SITE_PUBLICO}/${CAMINHO[tipo]}/${encodeURIComponent(slug)}`,
  }))
}
