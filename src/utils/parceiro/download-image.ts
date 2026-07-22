const FETCH_TIMEOUT_MS = 8_000

export type DownloadImageResult = 'downloaded' | 'opened' | 'saved' | 'cancelled'

export type DownloadImageOptions = {
  /** Janela aberta no gesto do usuário (evita bloqueio de popup no fallback). */
  fallbackWindow?: Window | null
}

type SaveFilePickerOptions = {
  suggestedName?: string
  types?: Array<{
    description?: string
    accept: Record<string, string[]>
  }>
}

type FilePickerWindow = Window & {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>
}

/**
 * Abre “Salvar como…” no gesto do clique (Chrome/Edge).
 * Em navegadores sem suporte, retorna `legacy` (download na pasta padrão).
 */
export async function pickImageSaveTarget(
  filename: string,
): Promise<FileSystemFileHandle | 'legacy' | 'cancelled'> {
  const picker = (window as FilePickerWindow).showSaveFilePicker
  if (typeof picker !== 'function') {
    return 'legacy'
  }

  try {
    return await picker.call(window, {
      suggestedName: filename,
      types: [
        {
          description: 'PNG',
          accept: { 'image/png': ['.png'] },
        },
      ],
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return 'cancelled'
    }
    return 'legacy'
  }
}

export async function writeBlobToFileHandle(handle: FileSystemFileHandle, blob: Blob) {
  const writable = await handle.createWritable()
  await writable.write(blob)
  await writable.close()
}

/**
 * Salva o blob com seletor de pasta quando disponível; senão, download automático.
 */
export async function saveImageBlob(
  blob: Blob,
  filename: string,
  target?: FileSystemFileHandle | 'legacy',
): Promise<'saved' | 'downloaded' | 'cancelled'> {
  const resolvedTarget = target ?? (await pickImageSaveTarget(filename))

  if (resolvedTarget === 'cancelled') {
    return 'cancelled'
  }

  if (resolvedTarget !== 'legacy') {
    await writeBlobToFileHandle(resolvedTarget, blob)
    return 'saved'
  }

  triggerBlobDownload(blob, filename)
  return 'downloaded'
}

/**
 * Baixa uma imagem por URL. Se CORS/timeout bloquear o fetch, abre a imagem
 * na janela reservada (ou em nova aba) para o usuário salvar.
 *
 * Prefira chamar `pickImageSaveTarget` no clique (antes do await longo) e
 * passar o handle em `options.saveTarget`.
 */
export async function downloadImageFromUrl(
  url: string,
  filename: string,
  options: DownloadImageOptions & {
    saveTarget?: FileSystemFileHandle | 'legacy'
  } = {},
): Promise<DownloadImageResult> {
  try {
    const blob = await fetchImageBlob(url)
    const result = await saveImageBlob(blob, filename, options.saveTarget)
    if (result === 'cancelled') {
      closeFallbackWindow(options.fallbackWindow)
      return 'cancelled'
    }
    closeFallbackWindow(options.fallbackWindow)
    return result
  } catch {
    openImageFallback(url, options.fallbackWindow)
    return 'opened'
  }
}

/**
 * Tenta exportar a partir de um `<img>` já renderizado (sem novo fetch).
 * Falha em imagens cross-origin sem CORS (canvas “tainted”).
 */
export async function downloadFromHtmlImage(
  img: HTMLImageElement,
  filename: string,
  saveTarget?: FileSystemFileHandle | 'legacy',
): Promise<DownloadImageResult | false> {
  if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
    return false
  }

  try {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return false
    }

    ctx.drawImage(img, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png')
    })

    if (!blob) {
      return false
    }

    return saveImageBlob(blob, filename, saveTarget)
  } catch {
    return false
  }
}

async function fetchImageBlob(url: string): Promise<Blob> {
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return response.blob()
  }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.blob()
  } finally {
    window.clearTimeout(timer)
  }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
}

function openImageFallback(url: string, fallbackWindow?: Window | null) {
  if (fallbackWindow && !fallbackWindow.closed) {
    fallbackWindow.location.href = url
    return
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) {
    throw new Error('popup-blocked')
  }
}

function closeFallbackWindow(fallbackWindow?: Window | null) {
  if (fallbackWindow && !fallbackWindow.closed) {
    fallbackWindow.close()
  }
}
