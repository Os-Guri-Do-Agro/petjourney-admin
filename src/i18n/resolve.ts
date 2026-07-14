import {
  DEFAULT_LOCALE,
  STORAGE_KEY,
  isLocale,
  type Locale,
} from './locales'

/** Maps browser BCP-47 tags to one of the four supported locales. */
export function resolveDeviceLocale(): Locale {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LOCALE
  }

  const tags = (navigator.languages?.length ? navigator.languages : [navigator.language]).map(
    (tag) => tag.toLowerCase(),
  )

  for (const tag of tags) {
    if (tag === 'en-gb' || tag.startsWith('en-gb')) {
      return 'en-GB'
    }
    if (tag.startsWith('pt')) {
      return 'pt'
    }
    if (tag.startsWith('es')) {
      return 'es'
    }
    if (tag.startsWith('en')) {
      return 'en'
    }
  }

  return DEFAULT_LOCALE
}

export function getStoredLocale(): Locale | null {
  if (typeof localStorage === 'undefined') {
    return null
  }

  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isLocale(value) ? value : null
  } catch {
    return null
  }
}

export function setStoredLocale(locale: Locale): void {
  if (typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // ignore quota / private mode failures
  }
}

/** Stored choice > device > default. */
export function getInitialLocale(): Locale {
  return getStoredLocale() ?? resolveDeviceLocale()
}
