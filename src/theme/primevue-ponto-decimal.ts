import InputNumber from 'primevue/inputnumber'

type CampoNumerico = {
  locale?: string
  mode?: string
  readonly?: boolean
  insert: (
    event: KeyboardEvent,
    texto: string,
    sinal: { isDecimalSign: boolean; isMinusSign: boolean },
  ) => void
}

type InputNumberComTeclas = {
  methods: {
    onInputKeyPress: (this: CampoNumerico, event: KeyboardEvent) => void
  }
}

/** A vírgula do `pt-BR` e do `es`; `null` quando o idioma já usa o ponto. */
function separadorDecimal(locale: string | undefined): string | null {
  const partes = new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).formatToParts(1.1)
  const decimal = partes.find((parte) => parte.type === 'decimal')?.value

  return decimal && decimal !== '.' ? decimal : null
}

/**
 * No `InputNumber` do PrimeVue em português, o ponto é o separador de milhar: digitar "2.5" no peso
 * gravava 25, e não havia jeito de chegar a 2,5 sem saber que a tecla é a vírgula (relato do Luís,
 * 18/11/2026). O PrimeVue só aceita os dois sinais no francês. Aqui, num campo com casas decimais
 * (`mode="decimal"`), o ponto entra como a vírgula do idioma — o mesmo que o teclado numérico
 * americano manda. Dinheiro (`mode="currency"`) fica como está: lá "1.500" é mil e quinhentos. Campo
 * só de inteiros também: o próprio PrimeVue recusa a vírgula quando não há `maxFractionDigits`.
 */
export function aceitarPontoComoDecimal() {
  const metodos = (InputNumber as unknown as InputNumberComTeclas).methods
  const original = metodos.onInputKeyPress

  if ((original as { ajustado?: boolean }).ajustado) {
    return
  }

  const ajustado = function (this: CampoNumerico, event: KeyboardEvent) {
    const decimal = event.key === '.' && this.mode !== 'currency' && separadorDecimal(this.locale)

    if (!decimal) {
      original.call(this, event)

      return
    }

    event.preventDefault()

    if (!this.readonly) {
      this.insert(event, decimal, { isDecimalSign: true, isMinusSign: false })
    }
  }

  ;(ajustado as { ajustado?: boolean }).ajustado = true
  metodos.onInputKeyPress = ajustado
}
