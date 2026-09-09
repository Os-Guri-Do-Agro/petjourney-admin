/**
 * O texto que o responsável recebe.
 *
 * Vive fora do repositório porque **o dataset também precisa dele**: os boletins já enviados que
 * o protótipo planta são lidos na tela do celular, e nasceram com o texto em branco — a prévia do
 * app mostrava balões vazios, só com a hora. Um gerador só, usado nos dois lugares, é o que
 * garante que o histórico e o boletim novo falem a mesma língua.
 *
 * O texto é montado em português e **congelado no envio**, e isso não contradiz a disciplina de
 * i18n do módulo: o boletim não é interface, é mensagem endereçada ao responsável, no idioma
 * dele. O idioma da tela da clínica não tem relação com o idioma em que a Rita lê que o gato
 * dela piorou.
 *
 * Escrito para ser lido por quem está com medo, e por isso três regras: **primeiro o estado**,
 * depois o que foi feito, e nunca um número solto sem o que ele significa. "Temperatura 39,4"
 * assusta sem informar; "acima do normal, já sob medicação" informa.
 */

import type { GravidadeClinica } from './types'

const COMO_ESTA: Record<GravidadeClinica, string> = {
  estavel: 'está estável',
  atencao: 'segue sob observação atenta',
  critico: 'está em estado grave',
}

export type FatosDoBoletim = {
  petNome: string
  gravidade: GravidadeClinica
  /** Administrações concluídas e previstas desde o boletim anterior. */
  feitas: number
  previstas: number
  temperatura: number | null
  /** O que o plantão observou: comeu, urinou, dormiu. É o que o responsável quer ouvir. */
  observado: string
  /**
   * Boletim de piora não tenta suavizar — o responsável já ouviu a notícia por telefone antes de
   * receber isto, e um texto ameno depois de uma ligação grave soa a desconversa.
   */
  exigeLigacao: boolean
}

export function montarTextoDoBoletim(fatos: FatosDoBoletim): string {
  const partes: string[] = []

  if (fatos.exigeLigacao) {
    partes.push(
      `${fatos.petNome} apresentou piora e ${COMO_ESTA[fatos.gravidade]}. Nossa equipe entrou em contato por telefone para explicar o quadro e a conduta.`,
    )
  } else {
    partes.push(`${fatos.petNome} ${COMO_ESTA[fatos.gravidade]} neste momento.`)
  }

  if (fatos.observado.trim()) {
    partes.push(fatos.observado.trim())
  }

  if (fatos.previstas > 0) {
    partes.push(
      `Medicações e cuidados do período: ${fatos.feitas} de ${fatos.previstas} realizados no horário.`,
    )
  }

  if (fatos.temperatura !== null) {
    const leitura =
      fatos.temperatura >= 39.2
        ? 'acima do normal, já sob medicação'
        : fatos.temperatura <= 37.5
          ? 'abaixo do normal, sob aquecimento'
          : 'dentro do normal'

    partes.push(`Temperatura ${fatos.temperatura.toFixed(1).replace('.', ',')} °C — ${leitura}.`)
  }

  partes.push('Qualquer mudança, avisamos imediatamente.')

  return partes.join(' ')
}
