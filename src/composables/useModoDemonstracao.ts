/**
 * Modo demonstração: as telas da Clínica e do Hotel sobre os dados locais
 * (`features/clinico/data`, `features/hotel/data`), **só no build de desenvolvimento**.
 *
 * Substitui o interruptor oculto (`?clinico=on`, `?hotel=on` e a sequência de teclas), que ligava
 * o mock em qualquer build, inclusive produção (E1-02). Agora quem decide se Clínica e Hotel
 * existem é o servidor (`GET /parceiro/portal/eu`); o mock serve para apresentar e para ver as
 * telas que ainda não falam com a API, e não sai do computador de quem desenvolve:
 * `import.meta.env.DEV` é `false` no build de produção, e o modo fica desligado de vez.
 *
 * Liga e desliga pelo menu da conta. Fica gravado no navegador para sobreviver à recarga no meio
 * da apresentação.
 */

import { computed, ref } from 'vue'

const CHAVE = 'pj.demonstracao'

export const DEMONSTRACAO_DISPONIVEL = import.meta.env.DEV

function lerGravado(): boolean {
  try {
    return localStorage.getItem(CHAVE) === 'on'
  } catch {
    return false
  }
}

const ligado = ref(DEMONSTRACAO_DISPONIVEL && lerGravado())

const ativo = computed(() => DEMONSTRACAO_DISPONIVEL && ligado.value)

function definir(valor: boolean) {
  if (!DEMONSTRACAO_DISPONIVEL) {
    return
  }

  ligado.value = valor

  try {
    if (valor) {
      localStorage.setItem(CHAVE, 'on')
    } else {
      localStorage.removeItem(CHAVE)
    }
  } catch {
    /* Armazenamento bloqueado: o modo vale até a recarga. */
  }
}

export function useModoDemonstracao() {
  return { ativo, definir, disponivel: DEMONSTRACAO_DISPONIVEL }
}
