/**
 * Os rótulos do Diário Pet, nas mesmas palavras que o responsável lê no app.
 *
 * Os valores (`clinico.diario.<campo>.<VALOR>`) foram copiados dos catálogos do app, nos seis
 * idiomas: o vet e o responsável precisam chamar a mesma coisa pelo mesmo nome, senão "Pouco"
 * aqui e "Comeu pouco" lá viram duas informações. Os nomes dos campos são do portal — o vet lê
 * "Alimentação", o app escreve "Comida" —, porque aí o leitor é outro.
 */
import { useI18n } from 'vue-i18n'

import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from '@/i18n/locales'

import type { DoencaDiario, SintomaPet } from '../contrato/responsavel'
import type { AchadoDeAlarme, CampoDoDiario } from '../domain/resumo-do-paciente'

export function useRotulosDoDiario() {
  const { t, locale } = useI18n()

  function campo(nome: CampoDoDiario | 'sintomas' | 'doencas'): string {
    return t(`clinico.diario.campo.${nome}`)
  }

  function valor(nome: CampoDoDiario, chave: string): string {
    return t(`clinico.diario.${nome}.${chave}`)
  }

  function sintoma(chave: SintomaPet): string {
    return t(`clinico.diario.sintomas.${chave}`)
  }

  function doenca(chave: DoencaDiario): string {
    return t(`clinico.diario.doencas.${chave}`)
  }

  /** "Falta de ar"; "Fezes: com sangue". O campo só aparece quando o valor sozinho não se explica. */
  function achado(item: AchadoDeAlarme): string {
    if (item.campo === 'sintomas') {
      return sintoma(item.valor)
    }

    return `${campo(item.campo)}: ${valor(item.campo, item.valor).toLocaleLowerCase()}`
  }

  /** Lista em frase, no idioma da tela, só com o primeiro item em maiúscula: "Falta de ar e fraqueza". */
  function lista(nomes: string[]): string {
    const tag = INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE]

    return new Intl.ListFormat(tag, { type: 'conjunction' }).format(
      nomes.map((nome, indice) => (indice === 0 ? nome : nome.toLocaleLowerCase())),
    )
  }

  return { campo, valor, sintoma, doenca, achado, lista }
}
