/**
 * O QR da página pública, gerado no navegador (o endereço não passa por serviço de terceiro): a
 * miniatura da tela, o PNG para mandar e postar, o SVG para a gráfica e a folha para imprimir.
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

export type TextosDaFolha = {
  nome: string
  instrucao: string
  endereco: string
}

/**
 * A folha do balcão: o nome da casa, o QR grande, a instrução e o endereço, numa A4 em retrato.
 * Montada com DOM, nunca com HTML em texto: o nome vem do cadastro e não é marcação. Devolve
 * `false` quando o navegador bloqueia a janela.
 */
export function imprimirFolha(imagem: string, textos: TextosDaFolha) {
  const janela = window.open('', '_blank')

  if (!janela) return false

  const documento = janela.document
  documento.title = textos.nome

  const estilo = documento.createElement('style')
  estilo.textContent = [
    '@page { size: A4 portrait; margin: 18mm; }',
    'html, body { margin: 0; background: #fff; color: #10302A; }',
    'body { min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; }',
    'figure { margin: 0; display: grid; gap: 10mm; justify-items: center; text-align: center; }',
    'h1 { margin: 0; font-size: 30px; font-weight: 700; max-width: 150mm; }',
    'img { width: 110mm; height: 110mm; }',
    'figcaption { display: grid; gap: 4mm; }',
    'p { margin: 0; font-size: 20px; max-width: 140mm; line-height: 1.35; }',
    'small { font-size: 16px; letter-spacing: 0.02em; }',
  ].join('\n')
  documento.head.append(estilo)

  const figura = documento.createElement('figure')
  const titulo = documento.createElement('h1')
  titulo.textContent = textos.nome

  const qr = documento.createElement('img')
  qr.src = imagem
  qr.alt = ''

  const legenda = documento.createElement('figcaption')
  const instrucao = documento.createElement('p')
  instrucao.textContent = textos.instrucao
  const endereco = documento.createElement('small')
  endereco.textContent = textos.endereco
  endereco.dir = 'ltr'
  legenda.append(instrucao, endereco)

  figura.append(titulo, qr, legenda)
  documento.body.append(figura)

  janela.addEventListener('afterprint', () => janela.close())

  const disparar = () => {
    janela.focus()
    janela.print()
  }

  if (qr.complete) {
    disparar()
  } else {
    qr.addEventListener('load', disparar, { once: true })
    qr.addEventListener('error', disparar, { once: true })
  }

  return true
}
