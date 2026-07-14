import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getAuthUser, getAccessToken } from '@/service/auth/auth-session'

const STORAGE_KEY = 'petjourney-usuario-perfil'

export type UsuarioPerfilSnapshot = {
  userId: string
  nome: string
  email: string
  fotoUrl: string
}

function readFromStorage(storage: Storage): UsuarioPerfilSnapshot | null {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<UsuarioPerfilSnapshot>
    if (typeof parsed.userId !== 'string' || !parsed.userId) {
      return null
    }

    return {
      userId: parsed.userId,
      nome: typeof parsed.nome === 'string' ? parsed.nome : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      fotoUrl: typeof parsed.fotoUrl === 'string' ? parsed.fotoUrl : '',
    }
  } catch {
    return null
  }
}

function writeToStorage(storage: Storage, snapshot: UsuarioPerfilSnapshot | null) {
  if (!snapshot) {
    storage.removeItem(STORAGE_KEY)
    return
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

/** Espelha o storage da sessão auth (local se “manter conectado”, senão session). */
function resolveAuthStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  if (window.localStorage.getItem('access_token')) {
    return window.localStorage
  }

  if (window.sessionStorage.getItem('access_token')) {
    return window.sessionStorage
  }

  return window.localStorage
}

function clearBothStorages() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(STORAGE_KEY)
  window.sessionStorage.removeItem(STORAGE_KEY)
}

export const useUsuarioPerfilStore = defineStore('usuarioPerfil', () => {
  const userId = ref<string | null>(null)
  const nome = ref('')
  const email = ref('')
  const fotoUrl = ref('')

  const displayName = computed(() => nome.value.trim() || 'Veterinário')

  const initials = computed(() => {
    const source = displayName.value || email.value || '?'

    return source
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()
  })

  const avatarUrl = computed(() => {
    const url = fotoUrl.value.trim()
    if (!url) {
      return ''
    }

    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : ''
    } catch {
      return ''
    }
  })

  function snapshot(): UsuarioPerfilSnapshot | null {
    if (!userId.value) {
      return null
    }

    return {
      userId: userId.value,
      nome: nome.value,
      email: email.value,
      fotoUrl: fotoUrl.value,
    }
  }

  function persist() {
    const storage = resolveAuthStorage()
    if (!storage) {
      return
    }

    const data = snapshot()
    writeToStorage(storage, data)

    // Evita snapshot stale no outro storage após trocar “manter conectado”.
    if (typeof window !== 'undefined') {
      const other =
        storage === window.localStorage ? window.sessionStorage : window.localStorage
      if (data) {
        other.removeItem(STORAGE_KEY)
      }
    }
  }

  function hydrate() {
    if (typeof window === 'undefined') {
      return
    }

    const preferred = resolveAuthStorage()
    const fromPreferred = preferred ? readFromStorage(preferred) : null
    const fromLocal = readFromStorage(window.localStorage)
    const fromSession = readFromStorage(window.sessionStorage)
    const data = fromPreferred ?? fromLocal ?? fromSession

    if (!data) {
      return
    }

    userId.value = data.userId
    nome.value = data.nome
    email.value = data.email
    fotoUrl.value = data.fotoUrl
  }

  function applyProfile(partial: Partial<Omit<UsuarioPerfilSnapshot, 'userId'>> & { userId?: string }) {
    if (partial.userId) {
      userId.value = partial.userId
    }

    if (typeof partial.nome === 'string') {
      nome.value = partial.nome
    }

    if (typeof partial.email === 'string') {
      email.value = partial.email
    }

    if (typeof partial.fotoUrl === 'string') {
      fotoUrl.value = partial.fotoUrl
    }

    persist()
  }

  /** Semeia/atualiza a partir do JWT sem apagar foto já persistida do mesmo usuário. */
  function syncFromAuth() {
    if (!getAccessToken()) {
      clear()
      return
    }

    const auth = getAuthUser()
    if (!auth?.userId) {
      return
    }

    const sameUser = userId.value === auth.userId
    userId.value = auth.userId
    nome.value = auth.nome || (sameUser ? nome.value : '')
    email.value = auth.email || (sameUser ? email.value : '')
    if (!sameUser) {
      fotoUrl.value = ''
    }

    persist()
  }

  function clear() {
    userId.value = null
    nome.value = ''
    email.value = ''
    fotoUrl.value = ''
    clearBothStorages()
  }

  return {
    userId,
    nome,
    email,
    fotoUrl,
    displayName,
    initials,
    avatarUrl,
    hydrate,
    persist,
    applyProfile,
    syncFromAuth,
    clear,
  }
})
