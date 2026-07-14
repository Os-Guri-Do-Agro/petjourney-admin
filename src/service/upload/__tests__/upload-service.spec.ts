import { describe, expect, it } from 'vitest'

import { extractUploadUrl } from '@/service/upload/upload-service'

describe('extractUploadUrl', () => {
  it('aceita string direta', () => {
    expect(extractUploadUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png')
  })

  it('aceita data.url', () => {
    expect(extractUploadUrl({ url: 'https://cdn.example/b.jpg' })).toBe('https://cdn.example/b.jpg')
  })

  it('aceita aninhamento file.url', () => {
    expect(extractUploadUrl({ file: { url: 'https://cdn.example/c.webp' } })).toBe(
      'https://cdn.example/c.webp',
    )
  })

  it('falha sem URL', () => {
    expect(() => extractUploadUrl({ ok: true })).toThrow(/URL/)
  })
})
