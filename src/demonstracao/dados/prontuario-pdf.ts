/**
 * Um PDF de verdade, montado no navegador, para o "abrir o PDF" da demonstração (receita,
 * documento, laudo, cópia do prontuário): texto em Helvetica, uma ou mais folhas A4, aberto por uma
 * URL `blob:` (a tela abre a aba vazia e leva a ela; uma URL `data:` o navegador bloqueia).
 *
 * `urlDoPdf(chave, folha)` guarda a URL pela chave, para não criar um arquivo a cada clique.
 */
import { ENDERECO, PARCEIRO_NOME, CNPJ } from '../base/clinica'

export type Bloco =
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'campo'; rotulo: string; texto: string }
  | { tipo: 'espaco' }
  | { tipo: 'linha' }

export type Folha = { titulo: string; blocos: Bloco[]; rodape?: string }

const LARGURA = 595
const ALTURA = 842
const MARGEM = 56
const COLUNAS = 92

/** Só o Latin-1 cabe na fonte padrão: troca o que ficaria de fora. */
function latin1(texto: string) {
  return texto
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/•/g, '·')
    .replace(/µ/g, 'µ')
    .replace(/[^\p{ASCII} -ÿ]/gu, '?')
}

function escapar(texto: string) {
  return latin1(texto).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function quebrar(texto: string, colunas: number): string[] {
  const linhas: string[] = []
  for (const paragrafo of texto.split('\n')) {
    let atual = ''
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      if ((atual + ' ' + palavra).trim().length > colunas) {
        if (atual) linhas.push(atual)
        atual = palavra
      } else {
        atual = (atual + ' ' + palavra).trim()
      }
    }
    linhas.push(atual)
  }
  return linhas
}

type Linha = { texto: string; fonte: 'F1' | 'F2'; tamanho: number; antes: number; cor?: string }

function linhasDe(folha: Folha): Linha[] {
  const saida: Linha[] = []
  for (const bloco of folha.blocos) {
    switch (bloco.tipo) {
      case 'titulo':
        saida.push({ texto: bloco.texto, fonte: 'F2', tamanho: 15, antes: 22 })
        break
      case 'subtitulo':
        saida.push({
          texto: bloco.texto,
          fonte: 'F2',
          tamanho: 11,
          antes: 22,
          cor: '0.06 0.19 0.16',
        })
        break
      case 'texto':
        quebrar(bloco.texto, COLUNAS).forEach((t, i) =>
          saida.push({ texto: t, fonte: 'F1', tamanho: 10, antes: i ? 13 : 15 }),
        )
        break
      case 'campo':
        quebrar(`${bloco.rotulo}: ${bloco.texto}`, COLUNAS).forEach((t, i) =>
          saida.push({ texto: t, fonte: i ? 'F1' : 'F1', tamanho: 10, antes: i ? 13 : 15 }),
        )
        break
      case 'espaco':
        saida.push({ texto: '', fonte: 'F1', tamanho: 10, antes: 10 })
        break
      case 'linha':
        saida.push({ texto: '\u0000linha', fonte: 'F1', tamanho: 10, antes: 12 })
        break
    }
  }
  return saida
}

function cabecalho(): string {
  const endereco = `${ENDERECO.logradouro}, ${ENDERECO.numero} - ${ENDERECO.bairro}, ${ENDERECO.cidade}/${ENDERECO.uf}`
  return [
    '0.52 0.76 0.71 rg',
    `0 ${ALTURA - 8} ${LARGURA} 8 re f`,
    '0.06 0.19 0.16 rg',
    'BT',
    `/F2 13 Tf ${MARGEM} ${ALTURA - 44} Td (${escapar(PARCEIRO_NOME)}) Tj`,
    'ET',
    '0.35 0.4 0.38 rg',
    'BT',
    `/F1 8.5 Tf ${MARGEM} ${ALTURA - 58} Td (${escapar(`${endereco} · CNPJ ${CNPJ}`)}) Tj`,
    'ET',
    '0.8 0.84 0.82 RG 0.6 w',
    `${MARGEM} ${ALTURA - 68} m ${LARGURA - MARGEM} ${ALTURA - 68} l S`,
  ].join('\n')
}

function rodape(texto: string, pagina: number, total: number): string {
  return [
    '0.45 0.5 0.48 rg',
    'BT',
    `/F1 8 Tf ${MARGEM} 34 Td (${escapar(texto)}) Tj`,
    'ET',
    'BT',
    `/F1 8 Tf ${LARGURA - MARGEM - 40} 34 Td (${escapar(`${pagina} de ${total}`)}) Tj`,
    'ET',
  ].join('\n')
}

/** Os bytes do PDF (Latin-1: um caractere, um byte). */
export function pdfDe(folha: Folha): Uint8Array {
  const linhas = linhasDe(folha)
  const paginas: Linha[][] = [[]]
  let y = ALTURA - 90
  for (const linha of linhas) {
    y -= linha.antes
    if (y < 70) {
      paginas.push([])
      y = ALTURA - 90 - linha.antes
    }
    ;(paginas[paginas.length - 1] as Linha[]).push(linha)
  }

  const textoDoRodape = folha.rodape ?? `${PARCEIRO_NOME} · documento emitido pelo PetJourney`
  const conteudos = paginas.map((pagina, i) => {
    let yy = ALTURA - 90
    const partes = [cabecalho()]
    for (const linha of pagina) {
      yy -= linha.antes
      if (linha.texto === '\u0000linha') {
        partes.push(
          '0.85 0.88 0.86 RG 0.5 w',
          `${MARGEM} ${yy + 4} m ${LARGURA - MARGEM} ${yy + 4} l S`,
        )
        continue
      }
      if (!linha.texto) continue
      partes.push(
        `${linha.cor ?? '0.12 0.14 0.13'} rg`,
        'BT',
        `/${linha.fonte} ${linha.tamanho} Tf ${MARGEM} ${yy} Td (${escapar(linha.texto)}) Tj`,
        'ET',
      )
    }
    partes.push(rodape(textoDoRodape, i + 1, paginas.length))
    return partes.join('\n')
  })

  const objetos: string[] = []
  objetos.push('<< /Type /Catalog /Pages 2 0 R >>')
  const kids = conteudos.map((_, i) => `${5 + i * 2} 0 R`).join(' ')
  objetos.push(`<< /Type /Pages /Kids [${kids}] /Count ${conteudos.length} >>`)
  objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  objetos.push(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  )
  conteudos.forEach((conteudo, i) => {
    const conteudoId = 6 + i * 2
    objetos.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LARGURA} ${ALTURA}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${conteudoId} 0 R >>`,
    )
    objetos.push(`<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`)
  })
  /* Os objetos 3 e 4 são as fontes; as páginas começam no 5. */
  const ordenados = [
    objetos[0],
    objetos[1],
    objetos[2],
    objetos[3],
    ...objetos.slice(4),
  ] as string[]

  let corpo = '%PDF-1.4\n%âãÏÓ\n'
  const posicoes: number[] = []
  ordenados.forEach((objeto, i) => {
    posicoes.push(corpo.length)
    corpo += `${i + 1} 0 obj\n${objeto}\nendobj\n`
  })
  const xref = corpo.length
  corpo += `xref\n0 ${ordenados.length + 1}\n0000000000 65535 f \n`
  for (const posicao of posicoes) corpo += `${String(posicao).padStart(10, '0')} 00000 n \n`
  corpo += `trailer\n<< /Size ${ordenados.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`

  const bytes = new Uint8Array(corpo.length)
  for (let i = 0; i < corpo.length; i++) bytes[i] = corpo.charCodeAt(i) & 0xff
  return bytes
}

const URLS = new Map<string, string>()

/** A URL do PDF (uma por chave; o arquivo muda quando a chave muda). */
export function urlDoPdf(chave: string, montar: () => Folha): string {
  const guardada = URLS.get(chave)
  if (guardada) return guardada
  let url: string
  try {
    url = URL.createObjectURL(new Blob([pdfDe(montar()) as BlobPart], { type: 'application/pdf' }))
  } catch {
    url = 'about:blank'
  }
  URLS.set(chave, url)
  return url
}

/** Esquece a URL guardada (o documento mudou: anulado, assinado). */
export function esquecerPdf(chave: string) {
  const guardada = URLS.get(chave)
  if (guardada) {
    try {
      URL.revokeObjectURL(guardada)
    } catch {
      /* nada a fazer */
    }
  }
  URLS.delete(chave)
}

/** A URL de um arquivo enviado na demonstração (o laudo anexado abre o próprio arquivo). */
export function urlDoArquivo(arquivo: Blob): string {
  try {
    return URL.createObjectURL(arquivo)
  } catch {
    return 'about:blank'
  }
}
