/**
 * O resumo dos documentos por IA que a clínica lê (PJ-87WIZU), na forma da API: a versão do
 * veterinário, com refs opacas e o título da ficha (nunca o nome que o responsável deu ao arquivo).
 *
 * Dois pets das histórias têm resumo: a Duna (cardiopata, resumo em dia) e o Bento (renal, com um
 * exame novo que o resumo ainda não leu, DESATUALIZADO). Os outros com a chave ligada nunca
 * geraram: `SEM_RESUMO`. Nada de dose em lugar nenhum: o remédio sai só pelo nome.
 */
import type { ResumoDosDocumentos } from '@/service/parceiro/leitura-do-app-service'

import { hoje, instante, somarDias } from '../relogio'

const AVISO =
  'Resumo feito automaticamente a partir dos documentos guardados. Pode ter erros e não substitui a avaliação do veterinário. Confira sempre o documento original. Vacinas, alergias e tratamentos valem como estão no cadastro do pet.'

const dia = (diasAtras: number) => somarDias(hoje(), -diasAtras)

type Documento = ResumoDosDocumentos['documentos'][number]

/** Como a API: os da linha do tempo entram como INCLUIDO, e os novos (sem título) depois. */
function comDocumentos(resumo: ResumoDosDocumentos, novos: Documento[] = []): ResumoDosDocumentos {
  const incluidos: Documento[] = (resumo.conteudo?.linhaDoTempo ?? []).map((item) => ({
    ref: item.ref,
    tipo: item.tipo,
    data: item.data,
    titulo: item.titulo,
    situacao: 'INCLUIDO',
  }))

  return { ...resumo, documentos: [...incluidos, ...novos] }
}

function duna(): ResumoDosDocumentos {
  const ECO_1 = 'dN4kq7Wm2xEc0aP1'
  const ECO_2 = 'Hs8vTq1LmZ3cYw0e'
  const BNP = 'pQ2rX9nVb7KtA4sd'
  const RX = 'Jm5wE8yUc1oZr6Lf'
  const RECEITA = 'Tz3bN0qWv8GhK2xa'

  return comDocumentos({
    estado: 'PRONTO',
    geradoEm: instante(dia(6), '21:14'),
    idioma: 'pt-BR',
    mudancas: null,
    aviso: AVISO,
    conteudo: {
      panorama:
        'Cadela com doença valvar mitral acompanhada por dois ecocardiogramas. O segundo mostra o átrio esquerdo maior que no primeiro. O NT-proBNP subiu entre as duas dosagens e ficou acima da faixa do laboratório. A radiografia de tórax mais recente não descreve líquido no pulmão.',
      achados: [
        {
          texto: 'Relação átrio esquerdo/aorta de 1,9 (no exame anterior, 1,6).',
          categoria: 'IMAGEM',
          data: dia(20),
          refs: [ECO_2, ECO_1],
        },
        {
          texto: 'NT-proBNP de 1.480 pmol/L, acima da faixa impressa (até 900).',
          categoria: 'FORA_DA_FAIXA',
          data: dia(20),
          refs: [BNP],
        },
        {
          texto: 'Silhueta cardíaca aumentada, sem sinal de edema pulmonar descrito.',
          categoria: 'LAUDO',
          data: dia(21),
          refs: [RX],
        },
        {
          texto: 'Receita com pimobendan.',
          categoria: 'PRESCRICAO',
          data: dia(240),
          refs: [RECEITA],
        },
      ],
      series: [
        {
          item: 'NT-proBNP',
          unidade: 'pmol/L',
          pontos: [
            {
              data: dia(190),
              valor: '820',
              referencia: 'até 900',
              situacao: 'DENTRO',
              ref: 'aB7cD2eF9gH4iJ1k',
            },
            {
              data: dia(20),
              valor: '1.480',
              referencia: 'até 900',
              situacao: 'ACIMA',
              ref: BNP,
            },
          ],
        },
      ],
      remediosCitados: [{ nome: 'Pimobendan', data: dia(240), ref: RECEITA }],
      linhaDoTempo: [
        { data: dia(20), tipo: 'EXAME_DE_IMAGEM', titulo: 'Ecocardiograma', ref: ECO_2 },
        { data: dia(20), tipo: 'EXAME_LABORATORIAL', titulo: 'NT-proBNP', ref: BNP },
        { data: dia(21), tipo: 'EXAME_DE_IMAGEM', titulo: 'Radiografia de tórax', ref: RX },
        {
          data: dia(190),
          tipo: 'EXAME_LABORATORIAL',
          titulo: 'NT-proBNP',
          ref: 'aB7cD2eF9gH4iJ1k',
        },
        { data: dia(240), tipo: 'RECEITA', titulo: 'Receita', ref: RECEITA },
        { data: dia(250), tipo: 'EXAME_DE_IMAGEM', titulo: 'Ecocardiograma', ref: ECO_1 },
      ],
      naoEntraram: 1,
    },
    documentos: [],
  })
}

function bento(): ResumoDosDocumentos {
  const BIO_1 = 'kL4mN8pQ2rS6tU0v'
  const BIO_2 = 'wX3yZ7aB1cD5eF9g'
  const URINA = 'hI2jK6lM0nO4pQ8r'
  const ALTA = 'sT1uV5wX9yZ3aB7c'

  const resumo: ResumoDosDocumentos = {
    estado: 'DESATUALIZADO',
    geradoEm: instante(dia(34), '08:02'),
    idioma: 'pt-BR',
    mudancas: { novos: 1, alterados: 0 },
    aviso: AVISO,
    conteudo: {
      panorama:
        'Gato com doença renal crônica. As duas bioquímicas mostram a creatinina acima da faixa do laboratório, um pouco mais alta na segunda. A urinálise registra densidade urinária baixa. Há um resumo de alta de uma internação por desidratação.',
      achados: [
        {
          texto: 'Creatinina 2,6 mg/dL, acima da faixa impressa (0,8 a 1,8).',
          categoria: 'FORA_DA_FAIXA',
          data: dia(40),
          refs: [BIO_2],
        },
        {
          texto: 'Densidade urinária 1.018, abaixo da faixa impressa (acima de 1.035).',
          categoria: 'FORA_DA_FAIXA',
          data: dia(40),
          refs: [URINA],
        },
        {
          texto: 'Alta depois de dois dias de fluidoterapia por desidratação.',
          categoria: 'PROCEDIMENTO',
          data: dia(120),
          refs: [ALTA],
        },
      ],
      series: [
        {
          item: 'Creatinina',
          unidade: 'mg/dL',
          pontos: [
            {
              data: dia(130),
              valor: '2,3',
              referencia: '0,8 a 1,8',
              situacao: 'ACIMA',
              ref: BIO_1,
            },
            { data: dia(40), valor: '2,6', referencia: '0,8 a 1,8', situacao: 'ACIMA', ref: BIO_2 },
          ],
        },
        {
          item: 'Fósforo',
          unidade: 'mg/dL',
          pontos: [
            {
              data: dia(130),
              valor: '5,1',
              referencia: '2,5 a 6,0',
              situacao: 'DENTRO',
              ref: BIO_1,
            },
            {
              data: dia(40),
              valor: '5,8',
              referencia: '2,5 a 6,0',
              situacao: 'DENTRO',
              ref: BIO_2,
            },
          ],
        },
      ],
      remediosCitados: [{ nome: 'Benazepril', data: dia(120), ref: ALTA }],
      linhaDoTempo: [
        { data: dia(40), tipo: 'EXAME_LABORATORIAL', titulo: 'Perfil bioquímico', ref: BIO_2 },
        { data: dia(40), tipo: 'EXAME_LABORATORIAL', titulo: 'Urinálise', ref: URINA },
        { data: dia(120), tipo: 'RESUMO_DE_ALTA', titulo: 'Resumo de alta', ref: ALTA },
        { data: dia(130), tipo: 'EXAME_LABORATORIAL', titulo: 'Perfil bioquímico', ref: BIO_1 },
      ],
      naoEntraram: 0,
    },
    documentos: [],
  }

  return comDocumentos(resumo, [
    { ref: 'dE6fG0hI4jK8lM2n', tipo: null, data: dia(3), titulo: null, situacao: 'NOVO' },
  ])
}

const SEM_RESUMO: ResumoDosDocumentos = {
  estado: 'SEM_RESUMO',
  geradoEm: null,
  idioma: null,
  mudancas: null,
  aviso: AVISO,
  conteudo: null,
  documentos: [],
}

/** Duna e Bento com resumo; o resto com a chave ligada nunca gerou. */
export function resumoDosDocumentosDe(pacienteId: string): ResumoDosDocumentos {
  if (pacienteId === 'demo-pac-010') return duna()
  if (pacienteId === 'demo-pac-007-2') return bento()

  return { ...SEM_RESUMO }
}
