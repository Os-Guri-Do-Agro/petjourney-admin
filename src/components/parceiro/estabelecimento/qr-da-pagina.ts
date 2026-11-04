/**
 * O QR da página pública, gerado no navegador (o endereço não passa por serviço de terceiro): a
 * miniatura da tela, o PNG para mandar e postar e o SVG para a gráfica. A folha para imprimir é
 * um componente (`EstabelecimentoFolhaDoBalcao`).
 */
import QRCode from 'qrcode'

import type { LinkDaPaginaPublica } from '@/utils/parceiro/pagina-publica'

/* Tinta da casa sobre papel branco: o QR precisa de fundo claro nos dois temas para ler. */
export const CORES_DO_QR = { dark: '#10302A', light: '#FFFFFF' }

export function imagemDoQr(url: string, largura: number, margem = 1) {
  return QRCode.toDataURL(url, { margin: margem, width: largura, color: CORES_DO_QR })
}

/** Vetor: a gráfica amplia para o tamanho que quiser sem borrar. */
export function svgDoQr(url: string) {
  return QRCode.toString(url, { type: 'svg', margin: 2, color: CORES_DO_QR })
}

export function nomeDoArquivo(slug: string, link: LinkDaPaginaPublica, extensao: 'png' | 'svg') {
  return `petjourney-${slug}-${link.tipo}.${extensao}`
}

/** Baixa pelo `<a download>`: o arquivo é gerado aqui, então não há CORS nem janela extra. */
export function baixar(conteudo: string | Blob, nome: string) {
  const href = typeof conteudo === 'string' ? conteudo : URL.createObjectURL(conteudo)
  const ancora = document.createElement('a')

  ancora.href = href
  ancora.download = nome
  ancora.click()

  if (typeof conteudo !== 'string') {
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  }
}
