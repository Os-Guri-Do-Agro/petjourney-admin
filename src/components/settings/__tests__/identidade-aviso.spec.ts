/**
 * O aviso da identidade em camadas: o texto da API é só cortado, nunca reescrito. A abertura fica
 * à vista, cada "Título. Corpo" vira um tópico, e uma versão sem essa forma cai inteira na abertura.
 */

import { describe, expect, it } from 'vitest'

import { separarAviso, trechosComEmail } from '../identidade-aviso'

const AVISO_PT = [
  'Para representar o parceiro e assinar atos pela PetJourney, como receitas e prontuários, você precisa confirmar quem é. Para isso, envie uma foto do seu documento.',
  'Por que pedimos. Para impedir que alguém use o seu nome.',
  'Como conferimos. Uma pessoa da equipe PetJourney compara as fotos e o CPF.',
  'Por quanto tempo. As fotos são apagadas 30 dias depois da decisão.',
  'Seus direitos. Tire dúvidas pelo e-mail privacidade@petjourney.health. Saiba mais na Política.',
].join('\n\n')

const AVISO_AR = [
  'لكي تمثّل الشريك وتوقّع الإجراءات عبر PetJourney، مثل الوصفات والسجلات الطبية، عليك تأكيد هويتك.',
  'لماذا نطلب ذلك. لمنع أي شخص من استخدام اسمك.',
  'حقوقك. يمكنك إلغاء الإرسال ما دام قيد المراجعة.',
].join('\n\n')

describe('separarAviso', () => {
  it('abertura à vista e um tópico por "Título. Corpo"', () => {
    const aviso = separarAviso(AVISO_PT)

    expect(aviso.abertura).toHaveLength(1)
    expect(aviso.abertura[0]).toMatch(/^Para representar o parceiro/)
    expect(aviso.topicos.map((topico) => topico.titulo)).toEqual([
      'Por que pedimos',
      'Como conferimos',
      'Por quanto tempo',
      'Seus direitos',
    ])
    expect(aviso.topicos[0]!.corpo).toBe('Para impedir que alguém use o seu nome.')
  })

  it('não perde nem troca uma palavra do texto', () => {
    const aviso = separarAviso(AVISO_PT)
    const remontado = [
      ...aviso.abertura,
      ...aviso.topicos.map((topico) => `${topico.titulo}. ${topico.corpo}`),
    ].join('\n\n')

    expect(remontado).toBe(AVISO_PT)
  })

  it('funciona no árabe (a vírgula árabe não vira título)', () => {
    const aviso = separarAviso(AVISO_AR)

    expect(aviso.abertura).toHaveLength(1)
    expect(aviso.topicos.map((topico) => topico.titulo)).toEqual(['لماذا نطلب ذلك', 'حقوقك'])
  })

  it('versão sem tópicos: tudo na abertura, como antes', () => {
    const aviso = separarAviso('Primeiro parágrafo, sem título.\n\nSegundo parágrafo, também sem.')

    expect(aviso.topicos).toEqual([])
    expect(aviso.abertura).toHaveLength(2)
  })

  it('parágrafo sem título depois de um tópico continua o tópico', () => {
    const aviso = separarAviso(
      'Abertura longa, com vírgula.\n\nSeus direitos. Um.\n\nE mais um parágrafo, sem título.',
    )

    expect(aviso.topicos).toHaveLength(1)
    expect(aviso.topicos[0]!.corpo).toBe('Um.\n\nE mais um parágrafo, sem título.')
  })
})

describe('trechosComEmail', () => {
  it('separa o e-mail sem levar o ponto final da frase', () => {
    expect(trechosComEmail('pelo e-mail privacidade@petjourney.health. Saiba mais')).toEqual([
      { texto: 'pelo e-mail ' },
      { texto: 'privacidade@petjourney.health', email: true },
      { texto: '. Saiba mais' },
    ])
  })

  it('sem e-mail, um trecho só', () => {
    expect(trechosComEmail('Sem endereço aqui.')).toEqual([{ texto: 'Sem endereço aqui.' }])
  })
})
