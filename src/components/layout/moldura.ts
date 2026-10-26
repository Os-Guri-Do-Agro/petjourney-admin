/**
 * A moldura do portal (barra lateral e cabeçalho) pode mudar com a tela aberta.
 *
 * Quase toda tela usa a moldura do portal. As versões em avaliação do Hoje da Clínica trazem a
 * delas: a do app veste a barra lateral com o menu do app PetJourney; a dos Cartões troca a barra
 * por um trilho de ícones flutuante; a da Lista põe a navegação no topo. Nenhuma delas tem a fita
 * do dia. Quem pede é a página, com `usarMoldura`; ao sair dela, a moldura volta à do portal sozinha.
 *
 * Em tela estreita (a barra já é gaveta) vale sempre a moldura do portal.
 */
import { onBeforeUnmount, readonly, ref, watchEffect } from 'vue'

export type Moldura = 'portal' | 'app' | 'cartoes' | 'lista'

const atual = ref<Moldura>('portal')

/** A moldura pedida pela tela aberta. Só leitura: quem muda é `usarMoldura`. */
export const molduraPedida = readonly(atual)

/** A página declara a moldura que quer enquanto estiver montada. */
export function usarMoldura(qual: () => Moldura) {
  watchEffect(() => {
    atual.value = qual()
  })

  onBeforeUnmount(() => {
    atual.value = 'portal'
  })
}

const buscas = ref(0)

/** Cada pedido de busca vindo de uma página (um campo de busca dela); quem abre é a moldura. */
export const pedidosDeBusca = readonly(buscas)

/** Abre a busca da Clínica, a mesma do Ctrl K, a partir de um campo da página. */
export function pedirBusca() {
  buscas.value += 1
}
