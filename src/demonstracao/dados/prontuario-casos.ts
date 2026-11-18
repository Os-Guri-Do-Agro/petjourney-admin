/**
 * Os casos clínicos que dão corpo aos atendimentos da demonstração: o que o responsável contou, o
 * que o exame achou, o diagnóstico, a conduta, a prescrição e os atos, como uma clínica escreveria.
 *
 * Cada atendimento escolhe um caso pelo tipo (consulta, retorno, vacina, exame, cirurgia,
 * emergência) e pelo grupo da espécie; os pacientes com doença crônica na base (Bento, Duna,
 * Tobias, Cacau, Mel, Lilica, Simba...) têm casos próprios, para o histórico deles contar uma
 * história só. O retorno reaproveita o `depois` do caso da consulta anterior.
 *
 * Exporta `Caso`, `grupoDe`, `casosDaConsulta`, `casosDoPaciente`, `CASOS_DE_*` e `RETORNO_GERAL`.
 */
import type { Atendimento } from '@/service/parceiro/atendimentos-service'
import type { Paciente } from '@/service/parceiro/pacientes-service'

import type { Unidade, Via } from './prontuario-catalogos'

type Anamnese = Atendimento['anamnese']
type ExameFisico = Atendimento['exameFisico']

export type DesdeQuando = NonNullable<Anamnese['desdeQuando']>
export type Evolucao = NonNullable<Anamnese['evolucao']>
export type Apetite = NonNullable<Anamnese['apetite']>
export type Evacuacao = NonNullable<Anamnese['evacuacao']>
export type Miccao = NonNullable<Anamnese['miccao']>
export type Mucosas = NonNullable<ExameFisico['mucosas']>
export type Hidratacao = NonNullable<ExameFisico['hidratacao']>
export type ChaveDoVital = keyof ExameFisico['vitais']
export type SistemaDoExame = ExameFisico['sistemas'][number]['sistema']
export type KindDoDiagnostico = Atendimento['diagnostico']['itens'][number]['kind']
export type KindDoAntecedente = Atendimento['diagnostico']['antecedentes'][number]['kind']

export type Grupo = 'CAO' | 'GATO' | 'COELHO' | 'ROEDOR' | 'AVE' | 'REPTIL' | 'FURAO'

export type ItemPrescrito = {
  med: string
  /** Pelo peso; sem ele, pela quantidade. */
  mgPorKg?: number
  quantidade?: number
  unidade?: Unidade
  via: Via
  freq: number
  dias: number | null
  instrucoes?: string
}

export type AtoDoCaso = {
  kind: 'MEDICAMENTO' | 'PROCEDIMENTO'
  descricao: string
  med?: string
  via?: Via
  dose?: string
  obs?: string
}

export type Depois = {
  queixa: string
  historia: string
  evolucao?: Evolucao
  diagnosticos?: Array<[KindDoDiagnostico, string]>
  alterados?: Array<[SistemaDoExame, string]>
  orientacoes: string
  sinais?: string
  prescricoes?: ItemPrescrito[]
}

export type Caso = {
  queixa: string
  historia: string
  desde?: DesdeQuando
  evolucao?: Evolucao
  apetite?: Apetite
  evacuacao?: Evacuacao
  miccao?: Miccao
  vitais?: Partial<Record<ChaveDoVital, number>>
  mucosas?: Mucosas
  hidratacao?: Hidratacao
  alterados?: Array<[SistemaDoExame, string]>
  exameObs?: string
  diagnosticos: Array<[KindDoDiagnostico, string]>
  antecedentes?: Array<[KindDoAntecedente, string, string | null]>
  orientacoes: string
  sinais?: string
  interna?: string
  retorno?: number
  prescricoes?: ItemPrescrito[]
  atos?: AtoDoCaso[]
  /** O pedido de exame que sai do atendimento. */
  exames?: string[]
  /** Os laudos que voltaram (o nome do exame no catálogo e o resumo do resultado). */
  laudos?: Array<[string, string[]]>
  /** O termo assinado antes do procedimento. */
  termo?: { objeto: string; detalhamento: string }
  depois?: Depois
}

export function grupoDe(p: Pick<Paciente, 'especie' | 'especieOutra'>): Grupo {
  switch (p.especie) {
    case 'CACHORRO':
      return 'CAO'
    case 'GATO':
      return 'GATO'
    case 'COELHO':
      return 'COELHO'
    case 'ROEDOR':
      return 'ROEDOR'
    case 'AVE':
      return 'AVE'
    case 'REPTIL':
      return 'REPTIL'
    default:
      return 'FURAO'
  }
}

/* ----------------------------------------------------------------------------- consultas */

const CONSULTAS_DE_CAO: Caso[] = [
  {
    queixa: 'Coçando e balançando a cabeça, com cheiro forte no ouvido',
    historia:
      'Responsável conta que há uns cinco dias o paciente sacode a cabeça e coça a orelha esquerda com a pata. Notou secreção escura e odor. Toma banho em pet shop a cada 15 dias; não sabe se secam bem o ouvido.',
    desde: 'TRES_A_SETE_DIAS',
    evolucao: 'PIORANDO',
    alterados: [
      [
        'TEGUMENTAR',
        'Conduto auditivo esquerdo eritematoso, com cerúmen castanho-escuro e odor; dor à manipulação do pavilhão. Direito com leve eritema.',
      ],
    ],
    exameObs: 'Citologia otológica no consultório: muitas leveduras (Malassezia) e poucos cocos.',
    diagnosticos: [
      ['DEFINITIVO', 'DER-02'],
      ['DIFERENCIAL', 'DER-01'],
    ],
    orientacoes:
      'Limpar o ouvido com o ceruminolítico, esperar 15 minutos e pingar 5 gotas do otológico no ouvido esquerdo, duas vezes ao dia, por 10 dias. Depois de cada banho, secar bem a entrada da orelha com algodão. Evitar entrar água no ouvido durante o tratamento.',
    sinais: 'Inclinação da cabeça, perda de equilíbrio, olho com secreção ou dor intensa ao toque.',
    retorno: 10,
    prescricoes: [
      {
        med: 'demo-med-otologico',
        quantidade: 5,
        unidade: 'GOTA',
        via: 'OTOLOGICA',
        freq: 12,
        dias: 10,
        instrucoes: 'No ouvido esquerdo, depois da limpeza.',
      },
    ],
    atos: [
      {
        kind: 'PROCEDIMENTO',
        descricao: 'Limpeza otológica com ceruminolítico',
        obs: 'Conduto esquerdo; paciente tolerou bem.',
      },
    ],
    depois: {
      queixa: 'Retorno da otite: parou de sacudir a cabeça',
      historia: 'Responsável fez o tratamento completo. Não sacode mais a cabeça e o cheiro sumiu.',
      evolucao: 'MELHORANDO',
      orientacoes:
        'Otite resolvida. Manter a limpeza do ouvido uma vez por semana e secar bem depois dos banhos. Se voltar a coçar, marcar consulta logo no começo.',
    },
  },
  {
    queixa: 'Lambendo as patas e coçando a barriga',
    historia:
      'Prurido há cerca de duas semanas, pior à noite. Lambe as patas dianteiras até ficarem avermelhadas. Já teve episódios parecidos na primavera do ano passado. Antipulgas em dia (comprimido mensal). Ração super premium há um ano, sem troca recente.',
    desde: 'UMA_A_DUAS_SEMANAS',
    evolucao: 'VAI_E_VOLTA',
    alterados: [
      [
        'TEGUMENTAR',
        'Eritema interdigital nos quatro membros, coloração castanha dos pelos por lambedura; pápulas em região inguinal. Sem pulgas ou fezes de pulga ao pente fino.',
      ],
    ],
    diagnosticos: [
      ['PRESUNTIVO', 'DER-01'],
      ['DIFERENCIAL', 'DER-03'],
    ],
    orientacoes:
      'Dar o comprimido para a coceira duas vezes ao dia por 14 dias e depois uma vez ao dia, até o retorno. Banho com o shampoo de clorexidina duas vezes por semana, deixando o produto agir 10 minutos antes de enxaguar. Secar bem entre os dedos depois dos passeios. Manter o antipulgas todo mês, sem atraso.',
    sinais:
      'Feridas com pus, queda de pelo em placas, inchaço no rosto ou coceira que não melhora em 5 dias.',
    retorno: 21,
    prescricoes: [
      {
        med: 'demo-med-oclacitinib-54',
        mgPorKg: 0.5,
        via: 'ORAL',
        freq: 12,
        dias: 14,
        instrucoes: 'Depois de 14 dias, uma vez ao dia até o retorno.',
      },
      {
        med: 'demo-med-clorexidina-shampoo',
        quantidade: 1,
        unidade: 'APLICACAO',
        via: 'TOPICA',
        freq: 84,
        dias: 28,
        instrucoes: 'Deixar agir 10 minutos antes de enxaguar.',
      },
    ],
    depois: {
      queixa: 'Retorno da dermatite: coceira bem menor',
      historia:
        'Responsável relata que a coceira diminuiu muito na primeira semana. Ainda lambe as patas depois do passeio.',
      evolucao: 'MELHORANDO',
      alterados: [['TEGUMENTAR', 'Eritema interdigital discreto; sem pápulas.']],
      orientacoes:
        'Reduzir o comprimido para uma vez ao dia por mais 30 dias. Continuar o banho semanal. Conversamos sobre o controle de longo prazo da dermatite atópica: ela não tem cura, mas tem controle.',
    },
  },
  {
    queixa: 'Vômito e diarreia desde ontem',
    historia:
      'Vomitou quatro vezes desde ontem à tarde (conteúdo alimentar e depois espuma). Fezes pastosas, sem sangue. Comeu restos de churrasco no domingo. Bebe água, mas vomita logo depois. Sem acesso a lixo ou plantas tóxicas, segundo a responsável.',
    desde: 'UM_A_DOIS_DIAS',
    evolucao: 'ESTAVEL',
    apetite: 'NADA',
    evacuacao: 'PASTOSA',
    hidratacao: 'LEVE',
    vitais: { temperatura: 39.1 },
    alterados: [
      [
        'DIGESTORIO',
        'Dor leve à palpação de abdome cranial; borborigmos aumentados; sem massas palpáveis.',
      ],
    ],
    diagnosticos: [
      ['PRESUNTIVO', 'GE-03'],
      ['DIFERENCIAL', 'GE-04'],
    ],
    orientacoes:
      'Jejum de comida por 6 horas, oferecendo água em pequenas quantidades. Depois, dieta leve (frango cozido sem tempero e arroz) em porções pequenas, 4 vezes ao dia, por 3 dias, voltando aos poucos para a ração. Dar o remédio para enjoo e o protetor gástrico como na receita.',
    sinais:
      'Vômito com sangue, barriga dura ou inchada, prostração, mais de 3 vômitos em 12 horas ou se não beber água.',
    retorno: 3,
    prescricoes: [
      { med: 'demo-med-ondansetrona-4', mgPorKg: 0.5, via: 'ORAL', freq: 12, dias: 3 },
      {
        med: 'demo-med-omeprazol-20',
        mgPorKg: 1,
        via: 'ORAL',
        freq: 24,
        dias: 5,
        instrucoes: 'Em jejum, 30 minutos antes da primeira refeição.',
      },
    ],
    atos: [
      {
        kind: 'MEDICAMENTO',
        descricao: 'Maropitant 1 mg/kg',
        med: 'demo-med-maropitant-10',
        via: 'SUBCUTANEA',
        dose: '1 mg/kg',
      },
    ],
    depois: {
      queixa: 'Retorno: sem vômito desde o dia da consulta',
      historia:
        'Não vomitou mais. Fezes firmes desde ontem. Voltou a comer a ração misturada com a dieta caseira.',
      evolucao: 'MELHORANDO',
      orientacoes:
        'Alta. Terminar a transição para a ração em 2 dias. Evitar oferecer restos de comida, especialmente gordurosos.',
    },
  },
  {
    queixa: 'Check-up anual',
    historia:
      'Consulta de rotina. Responsável sem queixas: come bem, ativo, fezes e urina normais. Vermifugado há 3 meses; antipulgas mensal em dia. Passeia duas vezes ao dia.',
    desde: 'HOJE',
    diagnosticos: [],
    orientacoes:
      'Paciente saudável. Manter a ração na quantidade da embalagem para o peso ideal, passeios diários e escovação dos dentes três vezes por semana. Vermifugar a cada 3 meses e manter o antipulgas todo mês. Próxima avaliação em 12 meses, ou antes se notar mudança no apetite, no peso ou no comportamento.',
    sinais:
      'Perda de apetite por mais de um dia, vômito repetido, tosse persistente ou mudança no xixi.',
    retorno: 365,
    exames: ['Hemograma completo', 'Bioquímico (ureia, creatinina, ALT, FA, albumina)'],
  },
  {
    queixa: 'Mancando da pata traseira',
    historia:
      'Há uma semana às vezes corre com a pata traseira direita levantada por alguns passos e depois volta a apoiar normalmente. Sem trauma conhecido. Piora depois de brincar no parque.',
    desde: 'TRES_A_SETE_DIAS',
    evolucao: 'VAI_E_VOLTA',
    alterados: [
      [
        'LOCOMOTOR',
        'Luxação medial de patela grau II no membro pélvico direito (luxa à manipulação e volta espontaneamente). Esquerdo grau I. Sem dor em coluna.',
      ],
    ],
    diagnosticos: [['DEFINITIVO', 'LO-04']],
    orientacoes:
      'Evitar saltos do sofá e da cama (usar rampa ou escadinha) e brincadeiras de pega-pega com mudança brusca de direção por 3 semanas. Manter o peso ideal ajuda muito as articulações. Dar o anti-inflamatório só nos dias de dor, conforme a receita.',
    sinais: 'Deixar de apoiar a pata por mais de um dia, choro ao toque ou inchaço no joelho.',
    retorno: 30,
    prescricoes: [
      {
        med: 'demo-med-meloxicam-05',
        mgPorKg: 0.1,
        via: 'ORAL',
        freq: 24,
        dias: 5,
        instrucoes: 'Junto com a refeição.',
      },
    ],
    exames: ['Radiografia de corpo inteiro'],
    depois: {
      queixa: 'Retorno da patela: mancando bem menos',
      historia: 'Usando a rampa no sofá. Mancou duas vezes no último mês, por poucos passos.',
      evolucao: 'MELHORANDO',
      orientacoes:
        'Manter as restrições de salto e o peso. Discutimos a correção cirúrgica caso os episódios voltem a ficar frequentes.',
    },
  },
  {
    queixa: 'Mau hálito e tártaro',
    historia:
      'Responsável notou mau hálito forte há alguns meses e dentes amarelados. Come ração seca; não faz escovação. Às vezes mastiga só de um lado.',
    desde: 'MAIS_DE_DUAS_SEMANAS',
    evolucao: 'PIORANDO',
    alterados: [
      [
        'DIGESTORIO',
        'Cálculo dentário moderado a intenso em pré-molares e molares superiores; gengivite com sangramento ao toque; retração gengival no 108.',
      ],
    ],
    diagnosticos: [['DEFINITIVO', 'GE-02']],
    orientacoes:
      'Agendar a limpeza dos dentes (profilaxia) com anestesia geral. Antes do procedimento, coletar sangue para os exames pré-anestésicos. Depois da limpeza, começar a escovação diária com pasta veterinária.',
    sinais: 'Recusa de comida, sangramento na boca ou inchaço no rosto abaixo do olho.',
    retorno: 15,
    exames: [
      'Hemograma completo',
      'Bioquímico (ureia, creatinina, ALT, FA, albumina)',
      'Eletrocardiograma',
    ],
  },
  {
    queixa: 'Tosse seca depois de ficar em hotelzinho',
    historia:
      'Começou a tossir há quatro dias, uma tosse seca, como se estivesse engasgado, que termina com ânsia. Ficou hospedado em um hotel para cães na semana passada. Come normalmente e está ativo.',
    desde: 'TRES_A_SETE_DIAS',
    evolucao: 'ESTAVEL',
    alterados: [
      [
        'RESPIRATORIO',
        'Tosse produtiva-seca desencadeada à palpação traqueal; ausculta pulmonar sem crepitações.',
      ],
    ],
    diagnosticos: [['PRESUNTIVO', 'RE-02']],
    orientacoes:
      'A tosse dos canis costuma melhorar em 7 a 10 dias. Usar peitoral em vez de coleira no pescoço, evitar contato com outros cães por 2 semanas e manter a casa arejada. Dar o antibiótico como na receita, oferecendo água logo depois do comprimido.',
    sinais: 'Febre, cansaço, respiração rápida, secreção amarela no nariz ou perda de apetite.',
    retorno: 10,
    prescricoes: [
      {
        med: 'demo-med-doxiciclina-100',
        mgPorKg: 5,
        via: 'ORAL',
        freq: 12,
        dias: 10,
        instrucoes: 'Oferecer água ou um petisco logo depois.',
      },
    ],
    depois: {
      queixa: 'Retorno da tosse dos canis: tosse rara',
      historia: 'Tossiu só ao acordar nos últimos dois dias.',
      evolucao: 'MELHORANDO',
      orientacoes: 'Alta. Indicamos a vacina contra a tosse dos canis antes da próxima hospedagem.',
    },
  },
  {
    queixa: 'Coceira no dorso e pelos falhados perto do rabo',
    historia:
      'Muita coceira na região lombar e na base da cauda. A responsável viu pulgas no fim de semana. O antipulgas está atrasado há dois meses. Outro cão da casa também se coça.',
    desde: 'UMA_A_DUAS_SEMANAS',
    evolucao: 'PIORANDO',
    alterados: [
      [
        'TEGUMENTAR',
        'Alopecia e escoriações em região lombossacra e base da cauda; fezes de pulga ao pente fino.',
      ],
    ],
    diagnosticos: [['DEFINITIVO', 'DER-04']],
    orientacoes:
      'Dar o antipulgas hoje e repetir todo mês, sem atraso, em todos os animais da casa. Aspirar o chão, sofás e a caminha e lavar os tecidos em água quente. A coceira melhora em uma a duas semanas.',
    sinais: 'Feridas com secreção, mau cheiro na pele ou coceira que piora mesmo com o antipulgas.',
    retorno: 21,
    prescricoes: [
      {
        med: 'demo-med-sarolaner-20',
        mgPorKg: 2,
        via: 'ORAL',
        freq: 720,
        dias: null,
        instrucoes: 'Repetir a cada 30 dias, em todos os cães da casa.',
      },
    ],
  },
  {
    queixa: 'Olho vermelho com secreção',
    historia:
      'Há três dias com o olho esquerdo vermelho e secreção amarelada ao acordar. Pisca mais que o normal. Não bateu o olho que a responsável saiba.',
    desde: 'TRES_A_SETE_DIAS',
    evolucao: 'ESTAVEL',
    alterados: [
      [
        'TEGUMENTAR',
        'Hiperemia conjuntival em olho esquerdo com secreção mucopurulenta; teste de fluoresceína negativo.',
      ],
    ],
    diagnosticos: [
      ['DEFINITIVO', 'OF-01'],
      ['DIFERENCIAL', 'OF-02'],
    ],
    orientacoes:
      'Limpar a secreção com gaze e soro fisiológico e, em seguida, pingar uma gota do colírio no olho esquerdo, três vezes ao dia, por 7 dias. Usar o colar elizabetano se coçar o olho.',
    sinais: 'Olho fechado, opaco ou azulado, dor forte ou piora depois de 3 dias.',
    retorno: 7,
    prescricoes: [
      {
        med: 'demo-med-tobramicina-colirio',
        quantidade: 1,
        unidade: 'GOTA',
        via: 'OFTALMICA',
        freq: 8,
        dias: 7,
        instrucoes: 'No olho esquerdo, depois de limpar.',
      },
    ],
    depois: {
      queixa: 'Retorno da conjuntivite: olho limpo',
      historia: 'Sem secreção desde o quarto dia de colírio.',
      evolucao: 'MELHORANDO',
      orientacoes:
        'Alta. Terminar o colírio hoje e guardar o frasco fora do alcance. Se voltar a secreção, trazer para o teste da lágrima.',
    },
  },
  {
    queixa: 'Fezes moles há duas semanas',
    historia:
      'Fezes pastosas, às vezes com muco, há duas semanas; frequentou creche canina. Come e brinca normalmente. Não foi vermifugado no último semestre.',
    desde: 'UMA_A_DUAS_SEMANAS',
    evolucao: 'VAI_E_VOLTA',
    evacuacao: 'COM_MUCO',
    alterados: [['DIGESTORIO', 'Abdome indolor; alças levemente espessadas à palpação.']],
    diagnosticos: [
      ['PRESUNTIVO', 'IN-02'],
      ['DIFERENCIAL', 'GE-03'],
    ],
    orientacoes:
      'Dar o vermífugo por 3 dias seguidos e o antibiótico como na receita. Recolher as fezes logo depois de cada evacuação e dar banho no fim do tratamento para não reinfectar. Coletar as fezes para o exame em três dias diferentes, em pote limpo, guardado na geladeira.',
    sinais: 'Sangue nas fezes, vômito, desânimo ou perda de peso.',
    retorno: 15,
    prescricoes: [
      { med: 'demo-med-drontal-plus', mgPorKg: 5, via: 'ORAL', freq: 24, dias: 3 },
      { med: 'demo-med-metronidazol-250', mgPorKg: 15, via: 'ORAL', freq: 12, dias: 7 },
    ],
    exames: ['Coproparasitológico (três amostras)'],
  },
  {
    queixa: 'Ganho de peso e cansaço nos passeios',
    historia:
      'Engordou cerca de 3 kg no último ano. Cansa no meio do passeio e prefere ficar deitado. Ganha petiscos da família várias vezes ao dia.',
    desde: 'MAIS_DE_DUAS_SEMANAS',
    evolucao: 'PIORANDO',
    vitais: { escoreCorporal: 7 },
    exameObs: 'Escore 7/9: costelas palpáveis com pressão firme, cintura pouco visível.',
    diagnosticos: [['DEFINITIVO', 'EN-02']],
    orientacoes:
      'Meta: perder 1% do peso por semana. Trocar para a ração de controle de peso, na quantidade indicada para o peso ideal, dividida em duas refeições. Petiscos só de legumes (cenoura, chuchu) e no máximo 10% do dia. Aumentar os passeios aos poucos. Pesar a cada 15 dias aqui na clínica (sem custo).',
    retorno: 30,
    exames: ['Hemograma completo', 'Bioquímico (ureia, creatinina, ALT, FA, albumina)'],
    depois: {
      queixa: 'Acompanhamento do peso',
      historia: 'Seguindo a dieta; a família parou os petiscos.',
      evolucao: 'MELHORANDO',
      orientacoes:
        'Perdeu peso dentro da meta. Manter a quantidade de ração e os passeios. Próxima pesagem em 30 dias.',
    },
  },
]

const CONSULTAS_DE_GATO: Caso[] = [
  {
    queixa: 'Indo muitas vezes à caixa de areia, com pouco xixi',
    historia:
      'Desde ontem vai à caixa a toda hora, faz pouquinho e chegou a urinar fora da caixa. A responsável viu xixi rosado. Houve reforma no apartamento nesta semana. Come ração seca; bebe pouca água.',
    desde: 'UM_A_DOIS_DIAS',
    evolucao: 'ESTAVEL',
    miccao: 'COM_SANGUE',
    alterados: [['URINARIO', 'Bexiga pequena e dolorosa à palpação; sem sinais de obstrução.']],
    diagnosticos: [
      ['PRESUNTIVO', 'UR-01'],
      ['DIFERENCIAL', 'UR-04'],
    ],
    orientacoes:
      'Aumentar a água: oferecer sachê úmido duas vezes ao dia, fonte de água e potes espalhados longe da comida. Uma caixa de areia a mais, em lugar calmo. Diminuir o estresse da reforma (um cômodo fechado e tranquilo para ele). Dar o analgésico como na receita.',
    sinais:
      'URGENTE: se for à caixa e não sair nada de xixi, vomitar ou ficar prostrado — risco de obstrução, procure atendimento na hora.',
    retorno: 7,
    prescricoes: [
      {
        med: 'demo-med-gabapentina-100',
        mgPorKg: 5,
        via: 'ORAL',
        freq: 12,
        dias: 5,
        instrucoes: 'Pode misturar no sachê.',
      },
    ],
    exames: ['Urinálise (urina tipo I)', 'Ultrassonografia abdominal'],
    depois: {
      queixa: 'Retorno da cistite: urinando normalmente',
      historia: 'Urina em quantidade normal, sem sangue, desde o terceiro dia.',
      evolucao: 'MELHORANDO',
      orientacoes:
        'Manter o sachê úmido todo dia e a fonte de água. A cistite idiopática pode voltar em fases de estresse: nesses períodos, reforçar o ambiente calmo.',
    },
  },
  {
    queixa: 'Espirrando e com o olho lacrimejando',
    historia:
      'Há quatro dias espirra várias vezes ao dia, com secreção nasal clara e olhos lacrimejando. Come um pouco menos. Chegou um gato novo na casa há duas semanas.',
    desde: 'TRES_A_SETE_DIAS',
    evolucao: 'ESTAVEL',
    apetite: 'POUCO',
    vitais: { temperatura: 39.4 },
    alterados: [
      [
        'RESPIRATORIO',
        'Secreção nasal serosa bilateral; estertores em vias aéreas superiores; pulmões limpos.',
      ],
    ],
    diagnosticos: [['PRESUNTIVO', 'RE-01']],
    orientacoes:
      'Limpar o nariz e os olhos com soro fisiológico várias vezes ao dia. Aquecer um pouco o sachê para estimular o olfato e o apetite. Separar o gato novo até a melhora e lavar as mãos entre um e outro. Fazer inalação com soro (no banheiro com o chuveiro quente ligado) por 10 minutos, duas vezes ao dia.',
    sinais: 'Ficar mais de 24 horas sem comer, respirar de boca aberta ou secreção verde.',
    retorno: 7,
    prescricoes: [
      {
        med: 'demo-med-doxiciclina-100',
        mgPorKg: 5,
        via: 'ORAL',
        freq: 12,
        dias: 10,
        instrucoes: 'Sempre oferecer água ou sachê logo depois do comprimido.',
      },
    ],
    depois: {
      queixa: 'Retorno: espirros bem menos frequentes',
      historia: 'Voltou a comer normalmente; espirra pouco.',
      evolucao: 'MELHORANDO',
      orientacoes: 'Terminar o antibiótico. Atualizar a vacina V5 dos dois gatos da casa.',
    },
  },
  {
    queixa: 'Check-up anual',
    historia:
      'Sem queixas. Vive dentro de casa com tela nas janelas. Come ração seca e sachê. Vermifugado há 4 meses.',
    desde: 'HOJE',
    diagnosticos: [],
    orientacoes:
      'Gato saudável. Manter o sachê úmido diário para a hidratação, brincadeiras de caça por 15 minutos duas vezes ao dia e caixa de areia sempre limpa. Escovar o pelo uma vez por semana. Vacina e vermífugo em dia.',
    sinais: 'Mudanças no xixi, vômitos frequentes (mais de um por semana) ou perda de peso.',
    retorno: 365,
    exames: [
      'Hemograma completo',
      'Bioquímico (ureia, creatinina, ALT, FA, albumina)',
      'Urinálise (urina tipo I)',
    ],
  },
  {
    queixa: 'Vomitando bolas de pelo',
    historia:
      'Vomita bolas de pelo uma a duas vezes por semana há um mês. Está na troca de pelo. Come bem e as fezes estão normais.',
    desde: 'MAIS_DE_DUAS_SEMANAS',
    evolucao: 'VAI_E_VOLTA',
    diagnosticos: [
      ['PRESUNTIVO', 'GE-07'],
      ['DIFERENCIAL', 'GE-01'],
    ],
    orientacoes:
      'Escovar diariamente durante a troca de pelo. Trocar para ração com fibra para bolas de pelo. Oferecer capim próprio para gatos. Se continuar vomitando mais de uma vez por semana depois de 30 dias, vamos investigar com exames.',
    sinais: 'Vômito várias vezes no mesmo dia, sem fezes por mais de 2 dias ou desânimo.',
    retorno: 30,
  },
  {
    queixa: 'Feridas na boca e dificuldade para comer',
    historia:
      'Está com mau hálito e baba às vezes. Vai até o pote, mas desiste da ração seca. Perdeu peso no último mês.',
    desde: 'MAIS_DE_DUAS_SEMANAS',
    evolucao: 'PIORANDO',
    apetite: 'POUCO',
    alterados: [
      [
        'DIGESTORIO',
        'Gengivite e estomatite caudal intensas, bilaterais, com dor à abertura da boca; reabsorção dentária no 307.',
      ],
    ],
    diagnosticos: [['PRESUNTIVO', 'GE-08']],
    orientacoes:
      'Oferecer só sachê ou patê, levemente aquecido, enquanto a boca estiver dolorida. Dar o analgésico como na receita. Vamos agendar a avaliação odontológica com radiografias sob anestesia; antes, os exames de sangue e o teste de FIV/FeLV.',
    sinais: 'Ficar mais de 24 horas sem comer ou sangramento na boca.',
    retorno: 10,
    prescricoes: [{ med: 'demo-med-meloxicam-05', mgPorKg: 0.05, via: 'ORAL', freq: 24, dias: 3 }],
    exames: [
      'Hemograma completo',
      'Bioquímico (ureia, creatinina, ALT, FA, albumina)',
      'Teste rápido FIV/FeLV',
    ],
  },
  {
    queixa: 'Falhas no pelo da cabeça e das orelhas',
    historia:
      'Apareceram falhas arredondadas no pelo da cabeça e da ponta das orelhas há três semanas. A filha da responsável tem uma mancha avermelhada no braço.',
    desde: 'MAIS_DE_DUAS_SEMANAS',
    evolucao: 'PIORANDO',
    alterados: [
      [
        'TEGUMENTAR',
        'Alopecias circulares com descamação em face, pavilhões auriculares e membro torácico esquerdo; fluorescência positiva à lâmpada de Wood.',
      ],
    ],
    diagnosticos: [['PRESUNTIVO', 'DER-05']],
    orientacoes:
      'Dar o antifúngico como na receita. Aspirar a casa todo dia e lavar caminhas e mantas em água quente. É uma micose que passa para pessoas: lavar as mãos depois de pegar o gato e procurar o médico para a mancha da sua filha. Vamos repetir a cultura em 4 semanas.',
    sinais: 'Feridas com secreção ou falhas novas espalhando rápido.',
    retorno: 28,
    prescricoes: [
      {
        med: 'demo-med-itraconazol-100',
        mgPorKg: 5,
        via: 'ORAL',
        freq: 24,
        dias: 28,
        instrucoes: 'Junto com a refeição.',
      },
    ],
    exames: ['Cultura fúngica (DTM)'],
  },
]

const CONSULTAS_DE_COELHO: Caso[] = [
  {
    queixa: 'Parou de comer e fez poucas bolinhas',
    historia:
      'Desde a manhã de ontem come pouco feno e quase não fez cíbalas; as que fez são pequenas e secas. Fica encolhido no canto. Comeu muita fruta no fim de semana.',
    desde: 'UM_A_DOIS_DIAS',
    evolucao: 'PIORANDO',
    apetite: 'POUCO',
    evacuacao: 'RESSECADA',
    hidratacao: 'LEVE',
    alterados: [
      [
        'DIGESTORIO',
        'Ceco com conteúdo firme e gás à palpação; motilidade reduzida à ausculta; desconforto abdominal.',
      ],
    ],
    diagnosticos: [['DEFINITIVO', 'GE-05']],
    orientacoes:
      'Feno à vontade, sempre fresco. Dar a papinha de alimentação assistida com seringa a cada 6 horas até ele voltar a comer sozinho. Dar o pró-cinético e o analgésico como na receita. Estimular a andar pela casa. Cortar frutas por enquanto.',
    sinais: 'URGENTE: ficar 12 horas sem fazer cíbalas, barriga inchada ou ranger os dentes.',
    retorno: 3,
    prescricoes: [
      { med: 'demo-med-cisaprida-manipulada', mgPorKg: 0.5, via: 'ORAL', freq: 12, dias: 7 },
      { med: 'demo-med-meloxicam-05', mgPorKg: 0.5, via: 'ORAL', freq: 24, dias: 5 },
    ],
    atos: [
      { kind: 'PROCEDIMENTO', descricao: 'Fluidoterapia subcutânea (Ringer lactato, 50 mL/kg)' },
    ],
    depois: {
      queixa: 'Retorno: voltou a comer feno',
      historia: 'Fazendo cíbalas de tamanho normal desde ontem.',
      evolucao: 'MELHORANDO',
      orientacoes:
        'Alta. Dieta com 80% de feno, verduras escuras e ração extrusada em pouca quantidade. Fruta só como petisco.',
    },
  },
  {
    queixa: 'Babando e escolhendo a comida',
    historia: 'Babando no queixo há uma semana; come as verduras, mas deixa o feno. Emagreceu.',
    desde: 'UMA_A_DUAS_SEMANAS',
    evolucao: 'PIORANDO',
    alterados: [
      [
        'DIGESTORIO',
        'Pontas dentárias em pré-molares inferiores ferindo a língua; incisivos levemente desalinhados.',
      ],
    ],
    diagnosticos: [['DEFINITIVO', 'GE-06']],
    orientacoes:
      'Agendar o desgaste dentário sob sedação. Até lá, oferecer feno picado e verduras cortadas em pedaços pequenos. O feno à vontade é o que desgasta os dentes todos os dias.',
    sinais: 'Parar de comer ou não fazer cíbalas por mais de 12 horas.',
    retorno: 7,
    exames: ['Radiografia de corpo inteiro'],
  },
  {
    queixa: 'Avaliação de rotina e orientação de manejo',
    historia:
      'Sem queixas. Vive solto em casa durante o dia. Come feno, verduras e ração extrusada.',
    desde: 'HOJE',
    diagnosticos: [],
    orientacoes:
      'Coelho saudável. Feno de capim à vontade (o mais importante da dieta), verduras escuras duas vezes ao dia e ração em pouca quantidade (uma colher de sopa por quilo). Proteger fios elétricos. Escovar o pelo uma vez por semana.',
    retorno: 180,
  },
]

const CONSULTAS_DE_ROEDOR: Caso[] = [
  {
    queixa: 'Dentes da frente grandes e dificuldade para comer',
    historia:
      'Responsável notou os dentes da frente compridos; come mais devagar e deixa os pedaços duros.',
    desde: 'UMA_A_DUAS_SEMANAS',
    evolucao: 'PIORANDO',
    alterados: [
      [
        'DIGESTORIO',
        'Supercrescimento de incisivos superiores e inferiores; sem lesões em mucosa oral.',
      ],
    ],
    diagnosticos: [['DEFINITIVO', 'GE-06']],
    orientacoes:
      'Feito o desgaste dos incisivos hoje. Oferecer feno à vontade e objetos de madeira próprios para roer. Voltar para nova avaliação em 30 dias.',
    retorno: 30,
    atos: [{ kind: 'PROCEDIMENTO', descricao: 'Desgaste de incisivos com broca de baixa rotação' }],
  },
  {
    queixa: 'Coçando muito e com falhas no pelo',
    historia: 'Coceira intensa há 10 dias, a ponto de gritar ao se coçar. Falhas no pelo do dorso.',
    desde: 'UMA_A_DUAS_SEMANAS',
    evolucao: 'PIORANDO',
    alterados: [
      ['TEGUMENTAR', 'Alopecia e crostas em dorso e flancos; prurido intenso à manipulação.'],
    ],
    diagnosticos: [['PRESUNTIVO', 'DER-08']],
    orientacoes:
      'Feita a aplicação do antiparasitário hoje; repetir em 14 dias aqui na clínica. Trocar toda a forração da gaiola e lavar a gaiola com água quente. Oferecer vitamina C diariamente (porquinho-da-índia não produz).',
    retorno: 14,
    exames: ['Raspado cutâneo'],
  },
  {
    queixa: 'Avaliação de rotina',
    historia:
      'Sem queixas. Mora em gaiola ampla com roda e esconderijo. Come mistura de sementes e ração.',
    desde: 'HOJE',
    diagnosticos: [],
    orientacoes:
      'Paciente saudável. Preferir ração extrusada à mistura de sementes (evita a escolha só das gordurosas). Manter a gaiola longe de sol direto e de correntes de vento. Limpeza da forração duas vezes por semana.',
    retorno: 180,
  },
]

const CONSULTAS_DE_AVE: Caso[] = [
  {
    queixa: 'Arrancando as penas do peito',
    historia:
      'Há três semanas arranca as penas do peito, principalmente à tarde, quando fica sozinha. Alimentação só de sementes de girassol e alpiste.',
    desde: 'MAIS_DE_DUAS_SEMANAS',
    evolucao: 'PIORANDO',
    alterados: [
      ['TEGUMENTAR', 'Áreas sem penas em região peitoral e face interna das asas; pele íntegra.'],
    ],
    diagnosticos: [
      ['PRESUNTIVO', 'DER-07'],
      ['DIFERENCIAL', 'EN-03'],
    ],
    orientacoes:
      'Trocar aos poucos as sementes por ração extrusada para calopsitas, com legumes frescos todo dia. Oferecer brinquedos de forrageio e trocar a posição deles a cada semana. Banho de borrifador com água morna 3 vezes por semana. Deixar a gaiola em um lugar com movimento da casa.',
    retorno: 30,
    interna: 'Contenção com toalha; ave estressa rápido, exame em duas etapas.',
  },
  {
    queixa: 'Avaliação de rotina e corte de unhas',
    historia: 'Sem queixas. Canta e se alimenta bem. Unhas compridas prendendo no poleiro.',
    desde: 'HOJE',
    diagnosticos: [],
    orientacoes:
      'Ave saudável. Feito o corte de unhas. Poleiros de galho natural com espessuras diferentes ajudam no desgaste. Dieta com ração extrusada e legumes; sementes só como petisco.',
    retorno: 180,
    atos: [{ kind: 'PROCEDIMENTO', descricao: 'Corte de unhas' }],
  },
  {
    queixa: 'Fezes mais líquidas e penas arrepiadas',
    historia:
      'Há dois dias fica com as penas arrepiadas, quieta no fundo da gaiola. Fezes com mais parte líquida.',
    desde: 'UM_A_DOIS_DIAS',
    evolucao: 'ESTAVEL',
    apetite: 'POUCO',
    evacuacao: 'DIARREIA',
    alterados: [['DIGESTORIO', 'Cloaca com fezes aderidas; papo vazio.']],
    diagnosticos: [['PRESUNTIVO', 'GE-01']],
    orientacoes:
      'Manter a ave aquecida (gaiola coberta pela metade e lâmpada a uma distância segura). Dar o antibiótico como na receita, no bico, com seringa. Oferecer a ração e as sementes de que ela mais gosta para estimular a comer.',
    sinais: 'Ficar no chão da gaiola, respiração com o rabo balançando ou parar de comer.',
    retorno: 5,
    prescricoes: [
      {
        med: 'demo-med-enrofloxacino-25ml',
        mgPorKg: 15,
        via: 'ORAL',
        freq: 12,
        dias: 7,
        instrucoes: 'Com seringa de insulina, direto no bico.',
      },
    ],
  },
]

const CONSULTAS_DE_REPTIL: Caso[] = [
  {
    queixa: 'Avaliação anual e revisão do recinto',
    historia:
      'Sem queixas. Vive no quintal com área coberta. Come folhas escuras, frutas e flores. Sem lâmpada UVB no abrigo.',
    desde: 'HOJE',
    alterados: [['LOCOMOTOR', 'Casco com leve amolecimento nas placas marginais posteriores.']],
    diagnosticos: [['PRESUNTIVO', 'VMP-02']],
    orientacoes:
      'Instalar lâmpada UVB no abrigo (ligada 10 a 12 horas por dia, trocada a cada 6 meses) e garantir sol direto todo dia. Dar o cálcio como na receita. Frutas no máximo 10% da dieta; a base são folhas escuras e flores.',
    retorno: 90,
    prescricoes: [
      {
        med: 'demo-med-calcio-oral',
        mgPorKg: 100,
        via: 'ORAL',
        freq: 24,
        dias: 30,
        instrucoes: 'Polvilhado ou misturado nas folhas.',
      },
    ],
    exames: ['Radiografia de corpo inteiro'],
  },
  {
    queixa: 'Olhos inchados e sem comer',
    historia: 'Há uma semana com as pálpebras inchadas e sem comer. Fica muito tempo parada.',
    desde: 'UMA_A_DUAS_SEMANAS',
    evolucao: 'PIORANDO',
    apetite: 'NADA',
    alterados: [['TEGUMENTAR', 'Edema palpebral bilateral; descamação de pele em membros.']],
    diagnosticos: [['PRESUNTIVO', 'EN-03']],
    orientacoes:
      'Banhos mornos (água na altura do casco) por 15 minutos, todos os dias. Oferecer folhas escuras e cenoura ralada. A suplementação de vitamina A foi aplicada hoje; repetimos em 10 dias.',
    retorno: 10,
  },
]

const CONSULTAS_DE_FURAO: Caso[] = [
  {
    queixa: 'Avaliação de rotina',
    historia: 'Sem queixas. Brinca bastante. Come ração própria para furões.',
    desde: 'HOJE',
    diagnosticos: [],
    orientacoes:
      'Furão saudável. Manter a ração rica em proteína animal e evitar doces e frutas. Proteger sofás e eletrodomésticos (ele se esconde em lugares pequenos). Vacina contra cinomose em dia.',
    retorno: 180,
  },
  {
    queixa: 'Diarreia esverdeada',
    historia: 'Fezes esverdeadas e moles há dois dias; brinquedo de borracha sumido. Come menos.',
    desde: 'UM_A_DOIS_DIAS',
    evolucao: 'ESTAVEL',
    apetite: 'POUCO',
    evacuacao: 'DIARREIA',
    alterados: [['DIGESTORIO', 'Abdome sem massas palpáveis; leve desconforto.']],
    diagnosticos: [
      ['PRESUNTIVO', 'GE-01'],
      ['DIFERENCIAL', 'GE-03'],
    ],
    orientacoes:
      'Oferecer a ração amolecida em água morna, em porções pequenas. Procurar o brinquedo sumido pela casa. Se parar de comer ou vomitar, voltar no mesmo dia: pode ser corpo estranho.',
    sinais: 'Vômito, barriga dolorida ou ausência de fezes.',
    retorno: 3,
    exames: ['Radiografia de corpo inteiro'],
  },
]

export const CASOS_DE_CONSULTA: Record<Grupo, Caso[]> = {
  CAO: CONSULTAS_DE_CAO,
  GATO: CONSULTAS_DE_GATO,
  COELHO: CONSULTAS_DE_COELHO,
  ROEDOR: CONSULTAS_DE_ROEDOR,
  AVE: CONSULTAS_DE_AVE,
  REPTIL: CONSULTAS_DE_REPTIL,
  FURAO: CONSULTAS_DE_FURAO,
}

/* -------------------------------------------------------- os casos de cada paciente */

/** Pacientes com doença crônica na base: as consultas deles contam a mesma história. */
export const CASOS_DO_PACIENTE: Record<string, Caso[]> = {
  'demo-pac-007-2': [
    {
      queixa: 'Acompanhamento da doença renal crônica',
      historia:
        'Bento segue com a dieta renal úmida. A responsável conta que ele bebe bastante água e urina em quantidade grande na caixa. Comeu um pouco menos nos últimos dias; vomitou uma vez na semana.',
      desde: 'MAIS_DE_DUAS_SEMANAS',
      evolucao: 'ESTAVEL',
      apetite: 'POUCO',
      miccao: 'MUITO',
      hidratacao: 'LEVE',
      vitais: { pressaoSistolica: 158 },
      alterados: [['URINARIO', 'Rins pequenos e irregulares à palpação, indolores.']],
      exameObs: 'Pressão arterial por Doppler: média de 5 medidas, membro torácico direito.',
      diagnosticos: [['DEFINITIVO', 'UR-02']],
      antecedentes: [['DOENCA_PREVIA', 'Doença renal crônica estágio 2 (IRIS)', '2025']],
      orientacoes:
        'Manter a ração renal úmida e a fonte de água sempre limpa. Dar o estimulante de apetite a cada 48 horas, como na receita. Pesar em casa uma vez por semana e anotar no app. Coletaremos sangue e urina no retorno para acompanhar a creatinina e o SDMA.',
      sinais: 'Ficar mais de 24 horas sem comer, vômitos repetidos ou desânimo forte.',
      interna:
        'Creatinina 2,4 mg/dL e SDMA 19 µg/dL no último controle. Pressão no limite: repetir no retorno antes de começar anti-hipertensivo.',
      retorno: 30,
      prescricoes: [
        { med: 'demo-med-mirtazapina-15', mgPorKg: 0.4, via: 'ORAL', freq: 48, dias: 14 },
        {
          med: 'demo-med-benazepril-5',
          mgPorKg: 0.5,
          via: 'ORAL',
          freq: 24,
          dias: null,
          instrucoes: 'Uso contínuo.',
        },
      ],
      exames: [
        'Bioquímico (ureia, creatinina, ALT, FA, albumina)',
        'SDMA',
        'Relação proteína/creatinina urinária',
      ],
      depois: {
        queixa: 'Retorno renal: apetite melhor',
        historia: 'Voltou a comer a ração renal inteira; sem vômitos.',
        evolucao: 'ESTAVEL',
        orientacoes:
          'Exames estáveis em relação ao último controle. Manter a dieta e a medicação. Próximo controle em 60 dias.',
      },
    },
  ],
  'demo-pac-010': [
    {
      queixa: 'Reavaliação cardiológica',
      historia:
        'Duna toma pimobendan duas vezes ao dia há 8 meses. A responsável conta respiração em repouso entre 20 e 26 por minuto, medida no app. Sem tosse ou cansaço nos passeios.',
      desde: 'MAIS_DE_DUAS_SEMANAS',
      evolucao: 'ESTAVEL',
      vitais: { frequenciaCardiaca: 128, frequenciaRespiratoria: 24 },
      alterados: [
        [
          'CARDIOVASCULAR',
          'Sopro sistólico grau IV/VI em foco mitral; ritmo sinusal; pulso femoral normal.',
        ],
      ],
      exameObs: 'Ecocardiograma de hoje: átrio esquerdo/aorta 1,7; sem sinais de congestão.',
      diagnosticos: [['DEFINITIVO', 'CA-01']],
      antecedentes: [['MEDICACAO_CONTINUA', 'Pimobendan 2,5 mg a cada 12 horas', '2026']],
      orientacoes:
        'Manter o pimobendan a cada 12 horas, uma hora antes das refeições. Continuar contando a respiração dormindo uma vez por dia e anotar no app: acima de 35 por minuto, avisar a clínica. Passeios leves, evitando o calor do meio-dia.',
      sinais:
        'Respiração dormindo acima de 35 por minuto, tosse à noite, desmaio ou cansaço fácil.',
      retorno: 90,
      prescricoes: [
        {
          med: 'demo-med-pimobendan-25',
          mgPorKg: 0.3,
          via: 'ORAL',
          freq: 12,
          dias: null,
          instrucoes: 'Uma hora antes da refeição. Uso contínuo.',
        },
      ],
      exames: ['Ecocardiograma', 'Pressão arterial sistólica (Doppler)'],
    },
  ],
  'demo-pac-018': [
    {
      queixa: 'Crise de tosse tipo "grasnado"',
      historia:
        'Tobias teve crises de tosse seca, como um grasnado de ganso, quando fica agitado com visitas ou puxa a guia. Piorou com o tempo seco desta semana.',
      desde: 'TRES_A_SETE_DIAS',
      evolucao: 'PIORANDO',
      alterados: [
        [
          'RESPIRATORIO',
          'Tosse desencadeada à palpação da traqueia cervical; estridor leve à agitação.',
        ],
      ],
      diagnosticos: [['DEFINITIVO', 'RE-03']],
      antecedentes: [
        ['DOENCA_PREVIA', 'Colapso de traqueia diagnosticado por radiografia', '2024'],
      ],
      orientacoes:
        'Usar só peitoral, nunca coleira. Umidificador no quarto nos dias secos. Evitar agitação forte e calor. Dar o corticoide como na receita, com redução gradual. Manter o peso: cada quilo a mais piora a respiração.',
      sinais:
        'Língua arroxeada, desmaio ou falta de ar que não passa em alguns minutos: venha na hora.',
      retorno: 14,
      prescricoes: [
        {
          med: 'demo-med-prednisolona-20',
          mgPorKg: 0.5,
          via: 'ORAL',
          freq: 24,
          dias: 7,
          instrucoes: 'Depois, metade da dose por mais 7 dias.',
        },
      ],
      depois: {
        queixa: 'Retorno: crises de tosse raras',
        historia: 'Desde o início do corticoide teve só duas crises leves.',
        evolucao: 'MELHORANDO',
        orientacoes:
          'Retirar o corticoide como combinado. Manter peitoral, umidificador e controle de peso.',
      },
    },
  ],
  'demo-pac-007': [
    {
      queixa: 'Dor nas costas e relutância para andar',
      historia:
        'Cacau gritou ao ser pega no colo ontem e anda com o dorso arqueado. Subiu no sofá apesar da rampa. Sem perda de força nas patas traseiras.',
      desde: 'UM_A_DOIS_DIAS',
      evolucao: 'ESTAVEL',
      alterados: [
        ['LOCOMOTOR', 'Cifose; dor à palpação de coluna toracolombar (T12–L2).'],
        [
          'NEUROLOGICO',
          'Propriocepção e reflexos preservados nos quatro membros; dor profunda presente.',
        ],
      ],
      diagnosticos: [['DEFINITIVO', 'LO-01']],
      antecedentes: [
        ['DOENCA_PREVIA', 'Hérnia de disco toracolombar tratada clinicamente', '2025'],
      ],
      orientacoes:
        'Repouso rigoroso em espaço pequeno (cercadinho) por 4 semanas, saindo só para fazer as necessidades, no colo, sempre com apoio no peito e no quadril. Nada de escadas, sofá ou cama. Dar os remédios para dor como na receita.',
      sinais: 'URGENTE: arrastar as patas traseiras, não conseguir ficar em pé ou não fazer xixi.',
      interna:
        'Grau 1 (só dor). Se piorar para grau 2 ou mais, encaminhar para neurologista e ressonância.',
      retorno: 10,
      prescricoes: [
        { med: 'demo-med-gabapentina-100', mgPorKg: 10, via: 'ORAL', freq: 12, dias: 14 },
        {
          med: 'demo-med-meloxicam-05',
          mgPorKg: 0.1,
          via: 'ORAL',
          freq: 24,
          dias: 5,
          instrucoes: 'Junto com a refeição.',
        },
      ],
      depois: {
        queixa: 'Retorno da hérnia de disco: sem dor',
        historia:
          'Seguiu o repouso no cercadinho. Anda normalmente e não reclama mais ao ser pega.',
        evolucao: 'MELHORANDO',
        orientacoes:
          'Manter o repouso por mais 2 semanas e depois voltar aos passeios curtos. A rampa no sofá é para sempre.',
      },
    },
  ],
  'demo-pac-003': [
    {
      queixa: 'Acompanhamento da gestação',
      historia:
        'Mel está na quinta semana de gestação (cruzamento em setembro). Come bem, um pouco mais calma. Sem secreção vaginal.',
      desde: 'MAIS_DE_DUAS_SEMANAS',
      evolucao: 'ESTAVEL',
      exameObs:
        'Ultrassonografia no consultório: ao menos 6 vesículas gestacionais com batimentos cardíacos.',
      diagnosticos: [['DEFINITIVO', 'RP-01']],
      orientacoes:
        'A partir da sexta semana, trocar aos poucos para a ração de filhotes, aumentando a quantidade em 10% por semana. Não dar nenhum remédio sem falar com a clínica. Preparar a caixa de parto em lugar calmo a partir da oitava semana. A radiografia para contar os filhotes será perto do 55º dia.',
      sinais:
        'Secreção verde ou com sangue, febre, contrações por mais de 30 minutos sem nascer filhote.',
      interna: 'Gestante: evitar anti-inflamatórios, corticoides e enrofloxacino.',
      retorno: 21,
      exames: ['Radiografia de corpo inteiro'],
    },
  ],
  'demo-pac-008': [
    {
      queixa: 'Ronco alto e cansaço no calor',
      historia:
        'Chico ronca muito, acorda engasgado à noite e cansa nos passeios em dias quentes. A família pergunta sobre cirurgia.',
      desde: 'MAIS_DE_DUAS_SEMANAS',
      evolucao: 'PIORANDO',
      alterados: [
        [
          'RESPIRATORIO',
          'Narinas estenóticas; estridor inspiratório leve; esforço respiratório à agitação.',
        ],
        ['TEGUMENTAR', 'Dobra nasal com eritema e odor.'],
      ],
      diagnosticos: [
        ['DEFINITIVO', 'RE-04'],
        ['DEFINITIVO', 'DER-06'],
      ],
      orientacoes:
        'Passeios só no começo da manhã e à noite. Manter o peso ideal. Limpar a dobra do focinho todo dia com gaze e o produto indicado e secar bem. Vamos agendar a avaliação pré-anestésica para a correção das narinas e do palato.',
      sinais: 'Língua roxa, desmaio, respiração muito ruidosa ou cansaço que não passa em repouso.',
      interna: 'Braquicefálico: intubação rápida, pré-oxigenação e extubação tardia.',
      retorno: 15,
      exames: [
        'Hemograma completo',
        'Bioquímico (ureia, creatinina, ALT, FA, albumina)',
        'Radiografia de tórax (três projeções)',
      ],
    },
  ],
  'demo-pac-005': [
    {
      queixa: 'Olhos secos e secreção grossa',
      historia:
        'Nina está com secreção grossa nos dois olhos todas as manhãs e pisca muito. Coça o rosto no tapete.',
      desde: 'MAIS_DE_DUAS_SEMANAS',
      evolucao: 'PIORANDO',
      alterados: [
        [
          'TEGUMENTAR',
          'Secreção mucoide bilateral; córnea sem brilho; Schirmer 8 mm/min no olho direito e 9 no esquerdo.',
        ],
      ],
      diagnosticos: [['DEFINITIVO', 'OF-02']],
      antecedentes: [['ALERGIA', 'Dipirona: reação grave em 2024', '2024']],
      orientacoes:
        'Limpar os olhos com soro antes de cada colírio. Pingar o colírio como na receita, sem pular dias: o olho seco é tratamento contínuo. Aparar os pelos ao redor dos olhos no banho e tosa.',
      sinais: 'Olho fechado, vermelho intenso ou mancha branca na córnea.',
      interna: 'Alergia a dipirona: usar meloxicam se precisar de analgesia.',
      retorno: 30,
      prescricoes: [
        {
          med: 'demo-med-tobramicina-colirio',
          quantidade: 1,
          unidade: 'GOTA',
          via: 'OFTALMICA',
          freq: 8,
          dias: 10,
          instrucoes: 'Nos dois olhos.',
        },
      ],
      exames: ['Teste de Schirmer', 'Teste de fluoresceína'],
    },
  ],
  'demo-pac-039': [
    {
      queixa: 'Controle do hipertireoidismo',
      historia:
        'Lilica toma metimazol duas vezes ao dia. Recuperou parte do peso. Ainda come com muita vontade e às vezes vomita logo depois.',
      desde: 'MAIS_DE_DUAS_SEMANAS',
      evolucao: 'MELHORANDO',
      vitais: { frequenciaCardiaca: 232 },
      alterados: [
        ['CARDIOVASCULAR', 'Taquicardia; sem sopro; nódulo tireoidiano palpável à direita.'],
      ],
      diagnosticos: [['DEFINITIVO', 'EN-01']],
      antecedentes: [['MEDICACAO_CONTINUA', 'Metimazol 2,5 mg a cada 12 horas', '2026']],
      orientacoes:
        'Manter o metimazol a cada 12 horas, sempre no mesmo horário. Oferecer a comida em porções menores, mais vezes ao dia, para evitar o vômito. Repetir o T4 total e a função renal em 3 semanas.',
      sinais: 'Coceira no rosto, perda de apetite, vômitos frequentes ou gengiva pálida.',
      retorno: 21,
      prescricoes: [
        {
          med: 'demo-med-metimazol-5',
          mgPorKg: 0.6,
          via: 'ORAL',
          freq: 12,
          dias: null,
          instrucoes: 'Uso contínuo.',
        },
      ],
      exames: [
        'T4 total',
        'Bioquímico (ureia, creatinina, ALT, FA, albumina)',
        'Hemograma completo',
      ],
    },
  ],
  'demo-pac-024': [
    {
      queixa: 'Gengiva vermelha e emagrecimento leve',
      historia:
        'Simba é FIV positivo. Perdeu um pouco de peso e está com a gengiva vermelha. Come, mas mais devagar.',
      desde: 'MAIS_DE_DUAS_SEMANAS',
      evolucao: 'ESTAVEL',
      alterados: [
        ['DIGESTORIO', 'Gengivite moderada generalizada.'],
        ['LINFONODOS', 'Linfonodos submandibulares discretamente aumentados.'],
      ],
      diagnosticos: [
        ['DEFINITIVO', 'IN-01'],
        ['PRESUNTIVO', 'GE-08'],
      ],
      orientacoes:
        'Manter Simba dentro de casa e longe de gatos desconhecidos. Oferecer sachê para facilitar a mastigação. Fazer os exames de controle a cada 6 meses. Qualquer infecção nele precisa ser tratada mais cedo: ligue ao primeiro sinal.',
      sinais: 'Febre, perda de apetite, feridas que não cicatrizam ou respiração rápida.',
      interna:
        'Imunossuprimido: evitar corticoide; preferir antibiótico de amplo espectro na primeira infecção.',
      retorno: 30,
      exames: ['Hemograma completo', 'Bioquímico (ureia, creatinina, ALT, FA, albumina)'],
    },
  ],
}

/** O que fica na observação interna de todo atendimento do paciente (contenção, alergia). */
export const NOTA_INTERNA_DO_PACIENTE: Record<string, string> = {
  'demo-pac-002':
    'Focinheira antes do exame; contenção com o responsável presente. Morde quando contido.',
  'demo-pac-005': 'Alergia a dipirona (reação grave em 2024): não prescrever.',
  'demo-pac-008': 'Braquicefálico: cuidado redobrado em sedação.',
}

/* ---------------------------------------------------------------------------- retorno */

export const RETORNO_GERAL: Depois = {
  queixa: 'Retorno: reavaliação depois do tratamento',
  historia:
    'Responsável fez o tratamento completo, sem dificuldade para dar os remédios. Paciente ativo e comendo bem.',
  evolucao: 'MELHORANDO',
  orientacoes: 'Boa evolução. Alta do quadro. Manter os cuidados de rotina e a vacinação em dia.',
}

/* ---------------------------------------------------------------------------- vacina */

export const VACINA_DE_CAO: Caso = {
  queixa: 'Vacinação anual',
  historia:
    'Vem para o reforço anual. Sem queixas; sem reação nas vacinas anteriores. Vermifugado no último trimestre.',
  desde: 'HOJE',
  diagnosticos: [],
  orientacoes:
    'Vacina aplicada conforme o protocolo; a carteira está atualizada no app. Pode ficar um pouco mais quieto e com o local da aplicação sensível por 24 a 48 horas. Evitar banho por 2 dias.',
  sinais:
    'Inchaço no rosto, vômito, coceira intensa ou dificuldade para respirar nas primeiras horas: volte imediatamente.',
}

export const VACINA_DE_GATO: Caso = {
  queixa: 'Vacinação anual',
  historia: 'Reforço anual da vacina. Sem queixas; gato de apartamento.',
  desde: 'HOJE',
  diagnosticos: [],
  orientacoes:
    'Vacina aplicada conforme o protocolo; a carteira está atualizada no app. Pode ficar sonolento por um dia. Se aparecer um caroço no local da aplicação que não sumir em 30 dias, avise a clínica.',
  sinais: 'Vômito, inchaço no rosto ou dificuldade para respirar nas primeiras horas.',
}

export const VACINA_SEM_PROTOCOLO: Caso = {
  queixa: 'Consulta preventiva',
  historia:
    'Agendado como vacinação; a espécie não tem vacina de rotina no Brasil. Feita a avaliação geral e a revisão do manejo.',
  desde: 'HOJE',
  diagnosticos: [],
  orientacoes:
    'Paciente saudável. Revisamos a alimentação e o ambiente. Manter as consultas preventivas a cada 6 meses: em animais exóticos, os sinais de doença aparecem tarde.',
}

/* ---------------------------------------------------------------------------- exame */

export const EXAME_DE_ROTINA: Caso = {
  queixa: 'Coleta de exames de rotina',
  historia: 'Veio em jejum de 8 horas para a coleta dos exames pedidos na última consulta.',
  desde: 'HOJE',
  diagnosticos: [],
  orientacoes:
    'Coleta feita. O resultado sai em até 2 dias úteis e fica disponível no app assim que o veterinário liberar. Pode voltar a comer normalmente.',
  sinais: 'Hematoma grande ou sangramento no local da coleta.',
  atos: [{ kind: 'PROCEDIMENTO', descricao: 'Coleta de sangue (veia jugular)' }],
  laudos: [
    [
      'Hemograma completo',
      [
        'Eritrócitos 6,8 milhões/µL (5,5 a 8,5)',
        'Hemoglobina 15,9 g/dL (12 a 18)',
        'Hematócrito 46% (37 a 55)',
        'Leucócitos 9.800/µL (6.000 a 17.000)',
        'Plaquetas 312.000/µL (200.000 a 500.000)',
        'Conclusão: hemograma dentro dos valores de referência.',
      ],
    ],
    [
      'Bioquímico (ureia, creatinina, ALT, FA, albumina)',
      [
        'Ureia 38 mg/dL (21 a 60)',
        'Creatinina 1,1 mg/dL (0,5 a 1,5)',
        'ALT 54 U/L (10 a 88)',
        'Fosfatase alcalina 72 U/L (20 a 150)',
        'Albumina 3,1 g/dL (2,6 a 3,3)',
        'Conclusão: perfil renal e hepático sem alterações.',
      ],
    ],
  ],
}

export const EXAME_RENAL: Caso = {
  queixa: 'Coleta para controle renal',
  historia:
    'Coleta de sangue e urina para o controle da doença renal crônica, como combinado no último retorno.',
  desde: 'HOJE',
  diagnosticos: [['DEFINITIVO', 'UR-02']],
  orientacoes:
    'Coleta feita. Assim que os resultados chegarem, ligamos para conversar sobre os próximos passos.',
  atos: [
    { kind: 'PROCEDIMENTO', descricao: 'Coleta de sangue (veia jugular)' },
    { kind: 'PROCEDIMENTO', descricao: 'Coleta de urina por cistocentese guiada por ultrassom' },
  ],
  laudos: [
    [
      'Bioquímico (ureia, creatinina, ALT, FA, albumina)',
      [
        'Ureia 84 mg/dL (42 a 64)',
        'Creatinina 2,3 mg/dL (0,8 a 1,8)',
        'Fósforo 4,9 mg/dL (2,7 a 6,2)',
        'Potássio 4,1 mEq/L (3,7 a 5,8)',
        'Conclusão: azotemia discreta, estável em relação ao controle anterior.',
      ],
    ],
    [
      'SDMA',
      [
        'SDMA 18 µg/dL (até 14)',
        'Conclusão: compatível com doença renal crônica estágio 2 (IRIS).',
      ],
    ],
  ],
}

/* ---------------------------------------------------------------------------- cirurgia */

export const CIRURGIA_CASTRACAO_FEMEA: Caso = {
  queixa: 'Ovariohisterectomia eletiva',
  historia:
    'Castração eletiva. Exames pré-operatórios normais. Jejum de 8 horas de comida e 2 de água.',
  desde: 'HOJE',
  diagnosticos: [['DEFINITIVO', 'PR-03']],
  orientacoes:
    'Cirurgia sem intercorrências. Usar a roupa cirúrgica ou o colar por 10 dias, sem lamber os pontos. Limpar a ferida uma vez ao dia com soro fisiológico. Dar os remédios para dor como na receita. Repouso, sem pular, por 10 dias. Retirada dos pontos em 10 dias.',
  sinais:
    'Pontos abertos, secreção ou inchaço na ferida, sangramento ou se não comer até amanhã à noite.',
  retorno: 10,
  prescricoes: [
    {
      med: 'demo-med-meloxicam-05',
      mgPorKg: 0.1,
      via: 'ORAL',
      freq: 24,
      dias: 3,
      instrucoes: 'Junto com a refeição.',
    },
    { med: 'demo-med-dipirona-500', mgPorKg: 25, via: 'ORAL', freq: 8, dias: 3 },
  ],
  atos: [
    {
      kind: 'MEDICAMENTO',
      descricao: 'Medicação pré-anestésica (dexmedetomidina + metadona)',
      med: 'demo-med-dexmedetomidina',
      via: 'INTRAMUSCULAR',
      dose: '5 µg/kg',
    },
    {
      kind: 'MEDICAMENTO',
      descricao: 'Cefazolina (profilaxia)',
      med: 'demo-med-cefazolina-1g',
      via: 'INTRAVENOSA',
      dose: '22 mg/kg',
    },
    {
      kind: 'PROCEDIMENTO',
      descricao: 'Ovariohisterectomia',
      obs: 'Anestesia inalatória com isoflurano; 42 minutos de cirurgia.',
    },
  ],
  termo: {
    objeto: 'Ovariohisterectomia eletiva (castração) sob anestesia geral inalatória',
    detalhamento:
      'Fui informado(a) dos riscos da anestesia e da cirurgia, dos cuidados no pós-operatório e de que intercorrências podem exigir procedimentos adicionais.',
  },
  depois: {
    queixa: 'Retirada de pontos',
    historia: 'Pós-operatório tranquilo, usou a roupa cirúrgica o tempo todo.',
    evolucao: 'MELHORANDO',
    orientacoes:
      'Pontos retirados, cicatrização ótima. Liberada para banho em 3 dias. Atenção ao peso nos próximos meses: castradas tendem a engordar.',
  },
}

export const CIRURGIA_CASTRACAO_MACHO: Caso = {
  queixa: 'Orquiectomia eletiva',
  historia: 'Castração eletiva. Exames pré-operatórios normais. Jejum de 8 horas.',
  desde: 'HOJE',
  diagnosticos: [['DEFINITIVO', 'PR-03']],
  orientacoes:
    'Cirurgia sem intercorrências. Colar elizabetano por 7 dias. Limpar a ferida uma vez ao dia com soro fisiológico. Dar o analgésico como na receita. Repouso relativo por 7 dias.',
  sinais: 'Inchaço grande na bolsa, sangramento ou se não comer até amanhã à noite.',
  retorno: 10,
  prescricoes: [
    {
      med: 'demo-med-meloxicam-05',
      mgPorKg: 0.1,
      via: 'ORAL',
      freq: 24,
      dias: 3,
      instrucoes: 'Junto com a refeição.',
    },
  ],
  atos: [
    {
      kind: 'MEDICAMENTO',
      descricao: 'Cefazolina (profilaxia)',
      med: 'demo-med-cefazolina-1g',
      via: 'INTRAVENOSA',
      dose: '22 mg/kg',
    },
    {
      kind: 'PROCEDIMENTO',
      descricao: 'Orquiectomia pré-escrotal',
      obs: 'Anestesia inalatória; 25 minutos.',
    },
  ],
  termo: {
    objeto: 'Orquiectomia eletiva (castração) sob anestesia geral',
    detalhamento:
      'Fui informado(a) dos riscos anestésicos e cirúrgicos e dos cuidados no pós-operatório.',
  },
}

export const CIRURGIA_DENTARIA: Caso = {
  queixa: 'Profilaxia dentária com extrações',
  historia:
    'Tratamento periodontal agendado na consulta anterior. Exames pré-anestésicos sem alterações. Jejum de 8 horas.',
  desde: 'HOJE',
  alterados: [['DIGESTORIO', 'Cálculo intenso; mobilidade grau 3 em 106 e 206.']],
  diagnosticos: [['DEFINITIVO', 'GE-02']],
  orientacoes:
    'Feita a limpeza completa e a extração de dois dentes com mobilidade. Ração amolecida em água morna por 7 dias. Dar o analgésico e o antibiótico como na receita. Começar a escovação diária depois de 10 dias.',
  sinais: 'Sangramento na boca, inchaço no rosto ou recusa de comida por mais de um dia.',
  retorno: 10,
  prescricoes: [
    { med: 'demo-med-amoxiclav-250', mgPorKg: 20, via: 'ORAL', freq: 12, dias: 7 },
    { med: 'demo-med-meloxicam-05', mgPorKg: 0.1, via: 'ORAL', freq: 24, dias: 4 },
  ],
  atos: [
    { kind: 'PROCEDIMENTO', descricao: 'Profilaxia dentária com ultrassom e polimento' },
    { kind: 'PROCEDIMENTO', descricao: 'Extração dentária (106 e 206)' },
  ],
  termo: {
    objeto: 'Tratamento periodontal com possíveis extrações, sob anestesia geral',
    detalhamento:
      'Autorizo as extrações que o veterinário julgar necessárias durante o procedimento.',
  },
}

export const CIRURGIA_NODULO: Caso = {
  queixa: 'Exérese de nódulo cutâneo',
  historia:
    'Remoção de nódulo subcutâneo no flanco, avaliado na consulta anterior (citologia sugestiva de lipoma).',
  desde: 'HOJE',
  diagnosticos: [['PRESUNTIVO', 'DER-10']],
  orientacoes:
    'Nódulo retirado inteiro e enviado para biópsia; o resultado sai em até 10 dias úteis. Roupa cirúrgica por 10 dias. Analgésico como na receita.',
  sinais: 'Secreção, inchaço ou pontos abertos.',
  retorno: 10,
  prescricoes: [{ med: 'demo-med-meloxicam-05', mgPorKg: 0.1, via: 'ORAL', freq: 24, dias: 3 }],
  atos: [
    {
      kind: 'PROCEDIMENTO',
      descricao: 'Nodulectomia com margem de 1 cm',
      obs: 'Material enviado para histopatológico.',
    },
  ],
  termo: {
    objeto: 'Exérese de nódulo cutâneo sob anestesia geral, com envio para biópsia',
    detalhamento:
      'Fui informado(a) de que o diagnóstico definitivo depende da análise do material.',
  },
}

export const CIRURGIA_EXOTICO: Caso = {
  queixa: 'Procedimento odontológico sob sedação',
  historia: 'Desgaste de dentes planejado na consulta anterior. Jejum curto, adequado à espécie.',
  desde: 'HOJE',
  alterados: [['DIGESTORIO', 'Pontas dentárias em molares e pré-molares.']],
  diagnosticos: [['DEFINITIVO', 'GE-06']],
  orientacoes:
    'Desgaste feito. Oferecer a comida picada e o feno à vontade. Alimentação assistida com seringa se não comer sozinho em 12 horas. Analgésico como na receita.',
  sinais: 'Não fazer fezes em 12 horas ou recusar comida.',
  retorno: 7,
  prescricoes: [{ med: 'demo-med-meloxicam-05', mgPorKg: 0.5, via: 'ORAL', freq: 24, dias: 3 }],
  atos: [{ kind: 'PROCEDIMENTO', descricao: 'Desgaste de pontas dentárias sob sedação' }],
  termo: {
    objeto: 'Desgaste dentário sob sedação',
    detalhamento: 'Fui informado(a) dos riscos da sedação em animais exóticos.',
  },
}

/** A cirurgia de hoje da Frida (buldogue francês): a das narinas, com o termo pendente no app. */
export const CIRURGIA_DA_FRIDA: Caso = {
  queixa: 'Alaplastia (correção de estenose de narinas)',
  historia:
    'Correção das narinas estreitas indicada na avaliação respiratória. Exames pré-anestésicos normais.',
  desde: 'HOJE',
  alterados: [['RESPIRATORIO', 'Narinas estenóticas grau moderado.']],
  diagnosticos: [['DEFINITIVO', 'RE-04']],
  orientacoes:
    'Cirurgia sem intercorrências. Colar elizabetano por 10 dias, sem coçar o focinho. Pode sair um pouco de sangue pelo nariz nas primeiras 24 horas. Ração amolecida por 3 dias.',
  sinais: 'Sangramento que não para, respiração muito difícil ou língua arroxeada.',
  retorno: 10,
  termo: {
    objeto: 'Alaplastia (correção de estenose de narinas) sob anestesia geral inalatória',
    detalhamento:
      'Fui informado(a) de que raças braquicefálicas têm risco anestésico maior e de que a recuperação será acompanhada de perto pela equipe até a extubação.',
  },
}

/* ---------------------------------------------------------------------------- emergência */

export const EMERGENCIAS: Record<'CAO' | 'GATO' | 'OUTRO', Caso[]> = {
  CAO: [
    {
      queixa: 'Comeu uma barra de chocolate',
      historia:
        'Comeu cerca de 100 g de chocolate meio amargo há aproximadamente 1 hora. Está agitado e ofegante.',
      desde: 'HOJE',
      evolucao: 'ESTAVEL',
      vitais: { frequenciaCardiaca: 168, temperatura: 39.4 },
      alterados: [
        ['CARDIOVASCULAR', 'Taquicardia sinusal.'],
        ['NEUROLOGICO', 'Agitação e tremores finos.'],
      ],
      diagnosticos: [['DEFINITIVO', 'GE-09']],
      orientacoes:
        'Feita a indução de vômito (saiu grande parte do chocolate) e dado o carvão ativado. Pode ter fezes escuras amanhã. Deixar em lugar calmo e oferecer água à vontade. Chocolate, uva, cebola e xilitol são tóxicos para cães: guardar fora do alcance.',
      sinais: 'Tremores fortes, convulsão, vômitos repetidos ou batimentos muito acelerados.',
      retorno: 2,
      atos: [
        { kind: 'PROCEDIMENTO', descricao: 'Indução de êmese' },
        { kind: 'PROCEDIMENTO', descricao: 'Carvão ativado via oral (1 g/kg)' },
        { kind: 'PROCEDIMENTO', descricao: 'Fluidoterapia intravenosa (Ringer lactato)' },
      ],
    },
    {
      queixa: 'Rosto inchado depois de picada de abelha',
      historia: 'Mordeu uma abelha no quintal há 30 minutos. O focinho e os olhos incharam rápido.',
      desde: 'HOJE',
      vitais: { frequenciaCardiaca: 142 },
      alterados: [
        [
          'TEGUMENTAR',
          'Angioedema facial importante; ferrão retirado do lábio superior; sem estridor.',
        ],
      ],
      diagnosticos: [['DEFINITIVO', 'DER-09']],
      orientacoes:
        'Aplicados o corticoide e o antialérgico; o inchaço deve diminuir nas próximas horas. Compressa fria no focinho por 10 minutos, 3 vezes hoje. Observar a respiração esta noite.',
      sinais: 'Dificuldade para respirar, gengiva pálida, vômitos ou desmaio.',
      retorno: 2,
      atos: [
        {
          kind: 'MEDICAMENTO',
          descricao: 'Dexametasona 0,2 mg/kg',
          via: 'INTRAVENOSA',
          dose: '0,2 mg/kg',
        },
      ],
    },
  ],
  GATO: [
    {
      queixa: 'Tentando urinar e não sai nada',
      historia:
        'Desde a madrugada entra e sai da caixa de areia sem urinar, mia e lambe a região genital. Vomitou uma vez.',
      desde: 'HOJE',
      evolucao: 'PIORANDO',
      miccao: 'NADA',
      vitais: { frequenciaCardiaca: 196 },
      alterados: [['URINARIO', 'Bexiga grande, firme e muito dolorosa; pênis congesto.']],
      diagnosticos: [
        ['DEFINITIVO', 'UR-05'],
        ['DIFERENCIAL', 'UR-03'],
      ],
      orientacoes:
        'Desobstrução feita sob sedação, com sonda urinária. Indicada a internação por 48 horas para soro e acompanhamento da urina.',
      sinais: 'Depois da alta: ir à caixa sem sair xixi é emergência de novo.',
      atos: [
        {
          kind: 'PROCEDIMENTO',
          descricao: 'Desobstrução uretral com sondagem',
          obs: 'Sob sedação; urina com sangue e cristais.',
        },
        { kind: 'PROCEDIMENTO', descricao: 'Fluidoterapia intravenosa' },
      ],
      exames: [
        'Urinálise (urina tipo I)',
        'Ultrassonografia abdominal',
        'Bioquímico (ureia, creatinina, ALT, FA, albumina)',
      ],
    },
    {
      queixa: 'Respirando de boca aberta',
      historia:
        'De repente começou a respirar de boca aberta depois de brincar. Já tinha cansado mais rápido nas últimas semanas.',
      desde: 'HOJE',
      vitais: { frequenciaRespiratoria: 64, frequenciaCardiaca: 238 },
      mucosas: 'CIANOTICAS',
      alterados: [
        ['RESPIRATORIO', 'Dispneia mista; crepitações difusas.'],
        ['CARDIOVASCULAR', 'Ritmo de galope.'],
      ],
      diagnosticos: [
        ['PRESUNTIVO', 'CA-02'],
        ['DIFERENCIAL', 'RE-01'],
      ],
      orientacoes:
        'Estabilizado no oxigênio e com diurético. Precisa do ecocardiograma ainda hoje, com o cardiologista da clínica.',
      sinais: 'Qualquer respiração de boca aberta é emergência.',
      atos: [
        { kind: 'PROCEDIMENTO', descricao: 'Oxigenoterapia em caixa de oxigênio' },
        {
          kind: 'MEDICAMENTO',
          descricao: 'Furosemida 2 mg/kg',
          med: 'demo-med-furosemida-40',
          via: 'INTRAMUSCULAR',
          dose: '2 mg/kg',
        },
      ],
      exames: ['Ecocardiograma', 'Radiografia de tórax (três projeções)'],
    },
  ],
  OUTRO: [
    {
      queixa: 'Prostrado e sem comer desde ontem',
      historia: 'Parou de comer desde ontem à noite e fica parado no canto. Não fez fezes hoje.',
      desde: 'UM_A_DOIS_DIAS',
      evolucao: 'PIORANDO',
      apetite: 'NADA',
      evacuacao: 'NAO_DEFECOU',
      hidratacao: 'MODERADA',
      alterados: [['DIGESTORIO', 'Distensão abdominal com gás; motilidade ausente à ausculta.']],
      diagnosticos: [['DEFINITIVO', 'GE-05']],
      orientacoes:
        'Ficou em observação para soro, aquecimento e alimentação assistida. Mandamos notícias pelo app até o fim do dia.',
      sinais: 'Barriga muito inchada ou respiração difícil.',
      retorno: 2,
      atos: [{ kind: 'PROCEDIMENTO', descricao: 'Fluidoterapia subcutânea e aquecimento' }],
    },
  ],
}

/** O caso da consulta escolhido pelo grupo, ou o do próprio paciente (crônicos). */
export function casosDaConsulta(pacienteId: string, grupo: Grupo): Caso[] {
  return CASOS_DO_PACIENTE[pacienteId] ?? CASOS_DE_CONSULTA[grupo]
}
