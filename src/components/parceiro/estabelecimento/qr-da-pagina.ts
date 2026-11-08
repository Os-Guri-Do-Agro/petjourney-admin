/**
 * O QR da página pública. O de verdade vem da API (`obterQrDaPagina`): imagem do WFQR, no padrão da
 * marca (sage, arredondado, pata no centro), que conta as leituras e segue o endereço quando o slug
 * muda. Este arquivo tem o que a tela faz com essa imagem (os endereços de cada tamanho, o download
 * dela) e a RESERVA: o QR desenhado no navegador pela biblioteca `qrcode`, para quando o WFQR está
 * fora do ar (`qrImageUrl: null`, imagem que não carrega, download que falha). A reserva sai fora do
 * padrão (verde escuro, quadrado, sem a pata) e não conta leituras; ela só existe para a tela nunca
 * ficar em branco enquanto o WFQR não responde. A folha para imprimir é um componente
 * (`EstabelecimentoFolhaDoBalcao`).
 */
import QRCode from 'qrcode'

import type { LinkDaPaginaPublica } from '@/utils/parceiro/pagina-publica'

/* Reserva: tinta da casa sobre papel branco, o QR precisa de fundo claro nos dois temas para ler. */
export const CORES_DO_QR = { dark: '#10302A', light: '#FFFFFF' }

export function imagemDoQr(url: string, largura: number, margem = 1) {
  return QRCode.toDataURL(url, { margin: margem, width: largura, color: CORES_DO_QR })
}

/** Vetor: a gráfica amplia para o tamanho que quiser sem borrar. */
export function svgDoQr(url: string) {
  return QRCode.toString(url, { type: 'svg', margin: 2, color: CORES_DO_QR })
}

/** Tamanhos pedidos ao WFQR (`?size=64..2000`): a tela fica nítida em retina, a gaveta e o PNG em 1024, a folha no máximo. */
export const TAMANHO_DO_QR = { miniatura: 560, gaveta: 1024, folha: 2000 } as const

/** O endereço da imagem do WFQR no tamanho pedido, ou em vetor (`?format=svg`, com a pata, para a gráfica). */
export function urlDoQr(qrImageUrl: string, opcao: { size: number } | { svg: true }) {
  const url = new URL(qrImageUrl)

  if ('svg' in opcao) {
    url.searchParams.set('format', 'svg')
  } else {
    url.searchParams.set('size', String(opcao.size))
  }

  return url.toString()
}

const TEMPO_DO_DOWNLOAD_MS = 8000

/** Baixa a imagem do WFQR para a memória (o CORS dele libera o portal). Falha em erro de rede, status ruim ou demora. */
export async function baixarImagemDoQr(url: string): Promise<Blob> {
  const controle = new AbortController()
  const prazo = setTimeout(() => controle.abort(), TEMPO_DO_DOWNLOAD_MS)

  try {
    const resposta = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      signal: controle.signal,
    })

    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`)

    return await resposta.blob()
  } finally {
    clearTimeout(prazo)
  }
}

export function nomeDoArquivo(slug: string, link: LinkDaPaginaPublica, extensao: 'png' | 'svg') {
  return `petjourney-${slug}-${link.tipo}.${extensao}`
}

/** Baixa pelo `<a download>`: o arquivo já está na memória (data URL ou Blob), então não há CORS nem janela extra. */
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
