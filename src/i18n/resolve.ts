import {
  DEFAULT_LOCALE,
  STORAGE_KEY,
  isLocale,
  type Locale,
} from './locales'

/**
 * Maps one browser BCP-47 tag to a supported locale, or `null`.
 *
 * Casa pela 1ª subtag, nunca por `startsWith`: `startsWith('sr')` casaria `srn` (sranan) e
 * `startsWith('ar')` casaria `arn` (mapudungun). `sr-Cyrl` também vira `sr` (o portal só tem
 * o alfabeto latino).
 */
export function matchLocaleTag(tag: string): Locale | null {
  const [language, ...rest] = tag.toLowerCase().replace(/_/g, '-').split('-')

  switch (language) {
    case 'pt':
      return 'pt'
    case 'es':
      return 'es'
    case 'sr':
      return 'sr'
    case 'ar':
      return 'ar'
    case 'en':
      return rest.includes('gb') ? 'en-GB' : 'en'
    default:
      return null
  }
}

/** Maps browser BCP-47 tags to one of the supported locales. */
export function resolveDeviceLocale(): Locale {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LOCALE
  }

  const tags = navigator.languages?.length ? navigator.languages : [navigator.language]

  for (const tag of tags) {
    const locale = tag ? matchLocaleTag(tag) : null
    if (locale) {
      return locale
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
