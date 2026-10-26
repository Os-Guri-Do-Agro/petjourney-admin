/**
 * A moldura do portal (barra lateral e cabeçalho).
 *
 * Desde 26/10/2026 a moldura de todas as telas é a do app: a barra lateral vestida com o menu do
 * app PetJourney, sem a fita do dia. A do portal (a de antes) continua aqui para uma tela que
 * precise dela: quem pede é a página, com `usarMoldura`, e ao sair dela a moldura volta à do app.
 */
import { onBeforeUnmount, readonly, ref, watchEffect } from 'vue'

export type Moldura = 'portal' | 'app'

const PADRAO: Moldura = 'app'

const atual = ref<Moldura>(PADRAO)

/** A moldura pedida pela tela aberta. Só leitura: quem muda é `usarMoldura`. */
export const molduraPedida = readonly(atual)

/** A página declara a moldura que quer enquanto estiver montada. */
export function usarMoldura(qual: () => Moldura) {
  watchEffect(() => {
    atual.value = qual()
  })

  onBeforeUnmount(() => {
    atual.value = PADRAO
  })
}
