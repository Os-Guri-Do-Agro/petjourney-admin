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

/**
 * A última mensagem da internação: o animal foi para casa.
 *
 * Fecha a conversa que os boletins abriram. Sem ela, a última coisa que o responsável leu no
 * aplicativo continua sendo o boletim das 14h — e ele fica com o celular na mão num sábado à
 * noite sem saber se pode parar de olhar.
 *
 * Só existe para o desfecho **alta**. Óbito e transferência não saem por mensagem, pela mesma
 * razão que a piora não sai: quem recebe essa notícia por notificação não volta à clínica.
 *
 * Três coisas, nesta ordem, e nada além: **foi para casa**, quanto tempo ficou, e o que fazer
 * agora. A gratidão vem no fim porque no começo soa a formulário.
 */
export type FatosDaAlta = {
  petNome: string
  horas: number
  /** Orientação de alta escrita pelo veterinário. Vazio quando ele não escreveu nada. */
  orientacao: string
}

export function montarTextoDeAlta(fatos: FatosDaAlta): string {
  const partes: string[] = []

  /*
   * "Ficou 3 dias" e "ficou 18 horas" são a mesma informação em unidades diferentes, e quem
   * recebe lê a que corresponde à própria experiência: quem deixou o animal de manhã e buscou à
   * tarde não pensa em dias.
   */
  const dias = Math.floor(fatos.horas / 24)
  const permanencia =
    dias >= 1
      ? `${dias} ${dias === 1 ? 'dia' : 'dias'}`
      : `${Math.max(1, fatos.horas)} ${fatos.horas === 1 ? 'hora' : 'horas'}`

  partes.push(`${fatos.petNome} recebeu alta e já está indo para casa.`)
  partes.push(`Ficou ${permanencia} internado conosco.`)

  if (fatos.orientacao.trim()) {
    partes.push(fatos.orientacao.trim())
  }

  partes.push(
    'As orientações e a receita foram entregues na recepção. Qualquer dúvida, estamos à disposição.',
  )

  return partes.join(' ')
}
