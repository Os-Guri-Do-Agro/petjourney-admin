import { afterEach, describe, expect, it, vi } from 'vitest'

async function carregar() {
  vi.resetModules()

  return import('../captcha')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('chaveDoCaptcha', () => {
  it('usa a chave da build quando existe', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '0x4AAAAAAA-chave')
    const { chaveDoCaptcha } = await carregar()

    expect(chaveDoCaptcha()).toBe('0x4AAAAAAA-chave')
  })

  it('em desenvolvimento, sem chave, cai na chave de teste da Cloudflare', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '')
    vi.stubEnv('DEV', true)
    const { chaveDoCaptcha } = await carregar()

    expect(chaveDoCaptcha()).toBe('1x00000000000000000000AA')
  })

  it('fora de desenvolvimento, sem chave, não inventa uma', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '')
    vi.stubEnv('DEV', false)
    const { chaveDoCaptcha } = await carregar()

    expect(chaveDoCaptcha()).toBeNull()
  })
})

describe('comCaptcha', () => {
  it('põe o token em X-Captcha-Token', async () => {
    const { comCaptcha } = await carregar()
    const headers = new Headers(comCaptcha('tok', { method: 'POST' }).headers)

    expect(headers.get('X-Captcha-Token')).toBe('tok')
  })
})
