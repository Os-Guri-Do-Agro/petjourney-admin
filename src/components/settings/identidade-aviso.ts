/**
 * O aviso de privacidade da identidade chega da API como um texto só, em parágrafos separados por
 * linha em branco (`GET /parceiro/portal/eu/identidade/consentimento/:versao`). Nos 6 idiomas ele
 * tem a mesma forma: uma abertura e tópicos que começam por um título curto terminado em ponto
 * ("Por que pedimos. Para impedir…").
 *
 * Aqui o texto é só separado, nunca reescrito: a abertura fica à vista e cada tópico vira um item
 * que abre (o aviso em camadas). Se uma versão nova vier sem essa forma, tudo fica na abertura,
 * como antes.
 */

export type TopicoDoAviso = { titulo: string; corpo: string }

export type AvisoEmCamadas = { abertura: string[]; topicos: TopicoDoAviso[] }

/* Título de tópico: até 6 palavras, sem vírgula, fechado por ponto ou dois-pontos. */
const TOPICO = /^([^.,!?:\n،]{2,48})[.:]\s+([\s\S]+)$/

export function separarAviso(texto: string): AvisoEmCamadas {
  const paragrafos = texto
    .split(/\n\s*\n/)
    .map((paragrafo) => paragrafo.trim())
    .filter(Boolean)

  const abertura: string[] = []
  const topicos: TopicoDoAviso[] = []

  for (const paragrafo of paragrafos) {
    const achado = TOPICO.exec(paragrafo)
    const titulo = achado?.[1]?.trim()

    if (achado && titulo && titulo.split(/\s+/).length <= 6) {
      topicos.push({ titulo, corpo: achado[2]!.trim() })
    } else if (topicos.length > 0) {
      /* Parágrafo sem título depois de um tópico: é continuação dele. */
      const ultimo = topicos[topicos.length - 1]!
      ultimo.corpo = `${ultimo.corpo}\n\n${paragrafo}`
    } else {
      abertura.push(paragrafo)
    }
  }

  return { abertura, topicos }
}

export type TrechoDoAviso = { texto: string; email?: true }

const EMAIL = /([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g

/** O texto em trechos, com o e-mail separado para virar link. */
export function trechosComEmail(texto: string): TrechoDoAviso[] {
  return texto
    .split(EMAIL)
    .filter(Boolean)
    .map((trecho) =>
      /^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/.test(trecho)
        ? { texto: trecho, email: true }
        : { texto: trecho },
    )
}
