/**
 * O primeiro import do `main.ts`: com a demonstração ligada, desloca o relógio antes de qualquer
 * outro módulo ler a hora. Fora da produção só; no build da `main` isto não faz nada.
 */
import { CHAVE_DA_DEMONSTRACAO } from '@/composables/modo-demonstracao-chave'
import { FORA_DA_PRODUCAO } from '@/utils/versao'

import { instalarRelogio } from './relogio'

function ligada() {
  try {
    return window.localStorage.getItem(CHAVE_DA_DEMONSTRACAO) === 'on'
  } catch {
    return false
  }
}

if (FORA_DA_PRODUCAO && typeof window !== 'undefined' && ligada()) {
  instalarRelogio()
}
