import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  downloadFromHtmlImage,
  downloadImageFromUrl,
  pickImageSaveTarget,
  saveImageBlob,
} from '../download-image'

describe('pickImageSaveTarget', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('retorna legacy quando o navegador não tem seletor', async () => {
    vi.stubGlobal('showSaveFilePicker', undefined)
    await expect(pickImageSaveTarget('qr.png')).resolves.toBe('legacy')
  })

  it('retorna cancelled quando o usuário fecha o diálogo', async () => {
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')),
    )
    await expect(pickImageSaveTarget('qr.png')).resolves.toBe('cancelled')
  })
})

describe('saveImageBlob', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('grava no handle escolhido', async () => {
    const write = vi.fn<() => void>()
    const close = vi.fn<() => void>()
    const handle = {
      createWritable: vi.fn<() => Promise<unknown>>().mockResolvedValue({ write, close }),
    } as unknown as FileSystemFileHandle

    await expect(saveImageBlob(new Blob(['qr']), 'qr.png', handle)).resolves.toBe('saved')
    expect(write).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })
})

describe('downloadImageFromUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('baixa o arquivo quando o fetch retorna blob (modo legacy)', async () => {
    const click = vi.fn<() => void>()
    const remove = vi.fn<() => void>()
    const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node)
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      rel: '',
      click,
      remove,
    } as unknown as HTMLAnchorElement)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['qr'], { type: 'image/png' }),
      }),
    )
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn<() => string>(() => 'blob:qr'),
      revokeObjectURL: vi.fn<() => void>(),
    })
    vi.stubGlobal('showSaveFilePicker', undefined)

    const fallbackWindow = { closed: false, close: vi.fn<() => void>(), location: { href: '' } }

    await expect(
      downloadImageFromUrl('https://example.com/qr.png', 'petjourney-qr-ABC.png', {
        fallbackWindow: fallbackWindow as unknown as Window,
        saveTarget: 'legacy',
      }),
    ).resolves.toBe('downloaded')

    expect(createElement).toHaveBeenCalledWith('a')
    expect(click).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledOnce()
    expect(appendChild).toHaveBeenCalledOnce()
    expect(fallbackWindow.close).toHaveBeenCalledOnce()
  })

  it('usa a janela reservada quando o fetch falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('cors')))

    const fallbackWindow = {
      closed: false,
      close: vi.fn<() => void>(),
      location: { href: '' },
    }

    await expect(
      downloadImageFromUrl('https://example.com/qr.png', 'petjourney-qr-ABC.png', {
        fallbackWindow: fallbackWindow as unknown as Window,
        saveTarget: 'legacy',
      }),
    ).resolves.toBe('opened')

    expect(fallbackWindow.location.href).toBe('https://example.com/qr.png')
    expect(fallbackWindow.close).not.toHaveBeenCalled()
  })

  it('abre nova aba quando o fetch falha e não há janela reservada', async () => {
    const open = vi.fn<() => unknown>().mockReturnValue({})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('cors')))
    vi.stubGlobal('open', open)

    await expect(
      downloadImageFromUrl('https://example.com/qr.png', 'petjourney-qr-ABC.png', {
        saveTarget: 'legacy',
      }),
    ).resolves.toBe('opened')

    expect(open).toHaveBeenCalledWith(
      'https://example.com/qr.png',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('lança erro quando o popup é bloqueado no fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('cors')))
    vi.stubGlobal('open', vi.fn().mockReturnValue(null))

    await expect(
      downloadImageFromUrl('https://example.com/qr.png', 'petjourney-qr-ABC.png', {
        saveTarget: 'legacy',
      }),
    ).rejects.toThrow('popup-blocked')
  })
})

describe('downloadFromHtmlImage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('retorna false quando a imagem ainda não carregou', async () => {
    const img = {
      complete: false,
      naturalWidth: 0,
      naturalHeight: 0,
    } as HTMLImageElement

    await expect(downloadFromHtmlImage(img, 'qr.png', 'legacy')).resolves.toBe(false)
  })
})
