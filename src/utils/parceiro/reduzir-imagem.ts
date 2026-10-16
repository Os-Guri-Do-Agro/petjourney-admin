import { dimensoesReduzidas, LADO_MAXIMO_IMAGEM, QUALIDADE_JPEG } from './leitura-receita'

/**
 * Reduz a foto da receita antes de mandar para a leitura: lado maior até 2576 px, em JPEG 0.85.
 * Foto de celular de 10 MB vira menos de 1 MB, e a leitura sai mais rápida.
 *
 * Imagem que já cabe e já é JPEG segue como está. A orientação do EXIF é aplicada
 * (`imageOrientation: 'from-image'`), senão a foto em pé chegaria deitada. PNG com
 * transparência ganha fundo branco: em JPEG, transparente viraria preto.
 */
export async function reduzirImagemParaLeitura(arquivo: File): Promise<File> {
  const imagem = await carregar(arquivo)

  try {
    const { largura, altura } = dimensoesReduzidas(imagem.width, imagem.height, LADO_MAXIMO_IMAGEM)
    const jaCabe = largura === imagem.width && altura === imagem.height

    if (jaCabe && arquivo.type === 'image/jpeg') {
      return arquivo
    }

    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura

    const contexto = canvas.getContext('2d')

    if (!contexto) {
      return arquivo
    }

    contexto.fillStyle = '#ffffff'
    contexto.fillRect(0, 0, largura, altura)
    contexto.drawImage(imagem.fonte, 0, 0, largura, altura)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALIDADE_JPEG),
    )

    if (!blob) {
      return arquivo
    }

    const nome = arquivo.name.replace(/\.[^.]+$/, '') || 'receita'

    return new File([blob], `${nome}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } finally {
    imagem.liberar()
  }
}

type ImagemCarregada = {
  fonte: CanvasImageSource
  width: number
  height: number
  liberar: () => void
}

async function carregar(arquivo: File): Promise<ImagemCarregada> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })

      return {
        fonte: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        liberar: () => bitmap.close(),
      }
    } catch {
      // Navegador sem suporte ao formato no bitmap: tenta pelo <img>.
    }
  }

  const url = URL.createObjectURL(arquivo)

  try {
    const elemento = new Image()
    elemento.decoding = 'async'
    elemento.src = url
    await elemento.decode()

    return {
      fonte: elemento,
      width: elemento.naturalWidth,
      height: elemento.naturalHeight,
      liberar: () => URL.revokeObjectURL(url),
    }
  } catch (erro) {
    URL.revokeObjectURL(url)
    throw erro
  }
}
