/*
 * Ícone interno do PrimeVue desenhado com o Phosphor.
 *
 * Os componentes do PrimeVue trazem os próprios ícones — a seta do Select, o X do Dialog, o visto
 * do Checkbox — importados de `@primevue/icons/<nome>`. A biblioteca não tem configuração global
 * para trocá-los, e passar slot de ícone em cada uso espalharia a troca por centenas de telas. O
 * `vite.config.ts` aponta cada um desses módulos para o arquivo de mesmo nome em
 * `src/icons/primevue/`, que devolve o componente feito aqui.
 *
 * O substituto estende o `BaseIcon` do próprio PrimeVue, e não só desenha um `<svg>`: é dele que
 * vêm a classe `p-icon` (o tamanho do tema), a `p-icon-spin` do `spin`, o `aria-label` do `label`,
 * o modo sem estilo e o passthrough. A classe que o componente pai põe no ícone
 * (`p-select-dropdown-icon`, `p-checkbox-icon`) chega como atributo herdado, como chegava antes.
 */
import BaseIcon from '@primevue/icons/baseicon'
import { defineComponent, h, type Component } from 'vue'

type Peso = 'regular' | 'fill'

/*
 * O desenho do Phosphor deixa margem dentro da grade de 256; o do PrimeVue enche a caixa. Recortar
 * o `viewBox` em 25% aproxima o glifo do tamanho que o tema espera — a mesma compensação que a
 * fonte recebe em `src/assets/main.css` (`.ph::before`). Ícone que encosta na borda da grade (o
 * triângulo de alerta) passa do recorte, por isso o `overflow` visível.
 *
 * 256 / 1,25 = 204,8 de lado, sobrando 25,6 em cada borda.
 */
const VIEW_BOX = '25.6 25.6 204.8 204.8'

export function iconeDoPrimeVue(nome: string, icone: Component, peso: Peso = 'regular') {
  return defineComponent({
    name: nome,
    extends: BaseIcon,
    render() {
      const base = this as unknown as { pti: () => Record<string, unknown> }

      return h(icone, {
        ...base.pti(),
        weight: peso,
        viewBox: VIEW_BOX,
        style: { overflow: 'visible' },
      })
    },
  })
}
