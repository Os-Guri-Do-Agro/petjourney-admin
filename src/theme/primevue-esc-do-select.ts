import Select from 'primevue/select'

type SelectComEsc = {
  methods: {
    onEscapeKey: (this: { overlayVisible: boolean }, event: KeyboardEvent) => void
  }
}

/**
 * O `Select` do PrimeVue 4.5 engole o Esc mesmo com a lista fechada (`stopPropagation`, com um
 * "@todo" no próprio código). O `Dialog` e o `Drawer` escutam o Esc no `document` e nunca o
 * recebiam: com o foco num Select fechado, Esc não fechava o "Novo atendimento" nem formulário
 * nenhum. Aberta, a lista continua ficando com o Esc (fecha só ela, como antes); fechada, o Esc
 * segue para quem estiver em volta. O `MultiSelect` já se comporta assim.
 */
export function deixarEscPassarPeloSelectFechado() {
  const metodos = (Select as unknown as SelectComEsc).methods
  const original = metodos.onEscapeKey

  if ((original as { ajustado?: boolean }).ajustado) {
    return
  }

  const ajustado = function (this: { overlayVisible: boolean }, event: KeyboardEvent) {
    if (!this.overlayVisible) {
      return
    }

    original.call(this, event)
  }

  ;(ajustado as { ajustado?: boolean }).ajustado = true
  metodos.onEscapeKey = ajustado
}
