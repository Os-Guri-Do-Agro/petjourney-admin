export type ApiEnvelope<T> = {
  statusCode: number
  message: string
  data: T
}

export type CursorPage<T> = {
  data: T[]
  meta: {
    proximoCursor?: string | null
  }
}

export type ExtratoPage = {
  items: unknown[]
  nextCursor: string | null
}
