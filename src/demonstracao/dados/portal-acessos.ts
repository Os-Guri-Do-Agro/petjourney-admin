/**
 * Os acessos temporários da demonstração (Compartilhamentos): o histórico que o responsável libera
 * no app para a clínica atender, vinculado pelo código de 6 dígitos.
 *
 * São 20 acessos de pets da base: 12 ativos (dois chegaram hoje, dois fecham em menos de um dia, a
 * Mel tem dois) e 8 encerrados (vencidos ou encerrados pelo responsável). O resumo de cada pet sai
 * dos dados dele no cadastro (alergia, doença crônica, remédio contínuo) e as anotações são da
 * própria clínica, escritas pela equipe da base. O status é decidido na hora da leitura: o acesso
 * que vence durante a apresentação passa a vencido sozinho.
 *
 * Exporta:
 * - `ACESSOS` (os registros, `AcessoDaDemo`), `acesso(id)`, `statusDoAcesso`, `resumoDoAcesso`,
 *   `detalheDoAcesso`;
 * - `acessosDoPaciente(pacienteId)`: o que um paciente tem aqui, para a linha do tempo (vínculo,
 *   prazo e anotações de cada acesso);
 * - `contagensDosAcessos()`: ativos, novos hoje e vencendo em menos de um dia (pendências);
 * - `vincularPorCodigo`, `criarAnotacaoDoFormulario`, `LEITURAS` e `criarLeitura`/`leituraAgora`
 *   (leitura de receita com IA), `CATALOGO_DO_DIARIO`, `arquivoParaAbrir` (a URL de um anexo ou
 *   documento do cofre).
 */
import type {
  AnexoAnotacao,
  Anotacao,
  AnotacaoDiario,
  AnotacaoEstruturada,
  AnotacaoPrescricaoItemInput,
  CatalogoDiario,
  CompartilhamentoDetalhe,
  CompartilhamentoResumo,
  DocumentoCompartilhado,
  EntradaDiarioCompartilhada,
  ItemFormularioLeitura,
  ItemSnapshot,
  ItemTratamentoContinuo,
  LeituraReceitaParceiro,
  MotivoBlocoVazio,
  SnapshotPetCompartilhado,
  StatusCompartilhamento,
  TipoServicoPrestador,
} from '@/service/parceiro/types'

import { criarSorteio, idDe } from '../aleatorio'
import { cliente, paciente, PACIENTES, type PacienteDaDemo } from '../base/cadastro'
import { PARCEIRO_NOME, profissional } from '../base/clinica'
import { agoraIso, hoje, instante, jaPassou, minutosAte, somarDias, somarMinutos } from '../relogio'

const sorte = criarSorteio('portal-acessos')
const HOJE = hoje()

/* ---------------------------------------------------------------------------- os tempos */

/** Um instante `dias` atrás, na hora dada; hoje, nunca depois do agora. */
function em(dias: number, hora: string) {
  const iso = instante(somarDias(HOJE, -dias), hora)
  return dias === 0 && !jaPassou(iso) ? somarMinutos(agoraIso(), -45) : iso
}

function haMinutos(n: number) {
  return somarMinutos(agoraIso(), -n)
}

/** `dd/mm/aaaa` de `dias` atrás, como o responsável escreve. */
function dataBr(dias: number) {
  const [a, m, d] = somarDias(HOJE, -dias).split('-')
  return `${d}/${m}/${a}`
}

function dia(dias: number) {
  return somarDias(HOJE, -dias)
}

/* ------------------------------------------------------------------------ as categorias */

type Categoria =
  | 'ALERGIAS'
  | 'VACINAS'
  | 'MEDICAMENTOS'
  | 'COMPORTAMENTO'
  | 'DIAGNOSTICOS'
  | 'TRATAMENTOS'
  | 'DIARIO'
  | 'DOCUMENTOS'

const TODAS: Categoria[] = [
  'ALERGIAS',
  'VACINAS',
  'MEDICAMENTOS',
  'COMPORTAMENTO',
  'DIAGNOSTICOS',
  'TRATAMENTOS',
  'DIARIO',
  'DOCUMENTOS',
]

const DO_EXAME: Categoria[] = ['ALERGIAS', 'DIAGNOSTICOS', 'TRATAMENTOS', 'DOCUMENTOS']

const BLOCO_DA_CATEGORIA = {
  ALERGIAS: 'alergias',
  VACINAS: 'vacinas',
  MEDICAMENTOS: 'medicamentos',
  COMPORTAMENTO: 'comportamento',
  DIAGNOSTICOS: 'diagnosticos',
  TRATAMENTOS: 'tratamentosContinuos',
  DIARIO: 'diario',
  DOCUMENTOS: 'documentos',
} as const

/* ------------------------------------------------------------------- o resumo do pet */

/** O resumo completo do pet; cada acesso leva só as categorias que o responsável marcou. */
type ResumoDoPet = {
  alergias: ItemSnapshot[]
  vacinas: ItemSnapshot[]
  medicamentos: ItemSnapshot[]
  comportamento: ItemSnapshot[]
  diagnosticos: ItemSnapshot[]
  tratamentosContinuos: ItemTratamentoContinuo[]
  diario: EntradaDiarioCompartilhada[]
  documentos: DocumentoCompartilhado[]
  observacoesTutor: string | null
  /** Bloco que o responsável tirou depois de entregar. */
  removido?: keyof typeof BLOCO_DA_CATEGORIA
}

function vacina(titulo: string, dias: number, reforco = 'reforço anual'): ItemSnapshot {
  return { titulo, detalhe: `Última dose em ${dataBr(dias)} · ${reforco}` }
}

function entrada(
  dias: number,
  extra: Partial<EntradaDiarioCompartilhada> = {},
): EntradaDiarioCompartilhada {
  return { data: dia(dias), sintomas: [], doencas: [], ...extra }
}

/** Os documentos do cofre do responsável, para abrir pelo link de 15 minutos. */
const ARQUIVOS = new Map<string, { titulo: string; linhas: string[] }>()

function documento(
  id: string,
  nome: string,
  tipo: string,
  dias: number,
  linhas: string[],
  paginas = 1,
): DocumentoCompartilhado {
  const arquivoIds = Array.from({ length: paginas }, (_, i) => `demo-arq-${id}-${i + 1}`)
  arquivoIds.forEach((arquivo, i) =>
    ARQUIVOS.set(arquivo, {
      titulo: paginas > 1 ? `${nome} (${i + 1} de ${paginas})` : nome,
      linhas,
    }),
  )
  return { origemId: `demo-doc-${id}`, nome, tipo, dataEmissao: dia(dias), arquivoIds }
}

function semNada(): ResumoDoPet {
  return {
    alergias: [],
    vacinas: [],
    medicamentos: [],
    comportamento: [],
    diagnosticos: [],
    tratamentosContinuos: [],
    diario: [],
    documentos: [],
    observacoesTutor: null,
  }
}

const RESUMOS: Record<string, () => ResumoDoPet> = {
  /* Mel, golden gestante. */
  'demo-pac-003': () => ({
    ...semNada(),
    vacinas: [
      vacina('V10 (polivalente)', 277),
      vacina('Antirrábica', 277),
      vacina('Tosse dos canis (intranasal)', 312),
    ],
    medicamentos: [
      { titulo: 'Ácido fólico 5 mg', detalhe: '1 comprimido ao dia, durante a gestação' },
    ],
    comportamento: [
      { titulo: 'Dócil e sociável' },
      { titulo: 'Ansiosa no carro', detalhe: 'Baba e fica ofegante em trajetos longos' },
    ],
    diagnosticos: [
      {
        titulo: 'Gestação',
        detalhe: 'Cerca de 5 semanas, confirmada por ultrassom',
        destaque: true,
      },
    ],
    diario: [
      entrada(1, {
        vitalidade: 'Calmo',
        alimentacao: 'Muito',
        observacoes: 'Dormiu quase a tarde toda.',
      }),
      entrada(4, {
        sintomas: ['Cansaço'],
        vitalidade: 'Sonolento',
        observacoes: 'Parou duas vezes no passeio da manhã.',
      }),
    ],
    documentos: [
      documento('mel-us', 'Ultrassom gestacional', 'Ultrassom', 10, [
        'Útero gravídico com 6 vesículas gestacionais viáveis.',
        'Batimentos cardíacos fetais presentes em todas.',
        'Idade gestacional estimada: 34 a 36 dias.',
      ]),
    ],
    observacoesTutor:
      'Primeira gestação da Mel. Está comendo bem, mas mais cansada nos passeios. Queremos acompanhar até o parto aqui na clínica.',
  }),

  /* Duna, cavalier com cardiopatia. */
  'demo-pac-010': () => ({
    ...semNada(),
    alergias: [{ titulo: 'Frango', detalhe: 'Alimentar · coceira e otite' }],
    vacinas: [
      vacina('V10 (polivalente)', 201),
      vacina('Antirrábica', 201),
      vacina('Gripe canina', 309),
    ],
    medicamentos: [
      {
        titulo: 'Bravecto 4,5–10 kg',
        detalhe: `1 comprimido a cada 12 semanas · último em ${dataBr(40)}`,
      },
    ],
    comportamento: [{ titulo: 'Calma e carinhosa' }],
    diagnosticos: [
      { titulo: 'Cardiopatia', detalhe: 'Doença da valva mitral, estágio B2', destaque: true },
    ],
    tratamentosContinuos: [
      {
        titulo: 'Pimobendan 2,5 mg',
        detalhe: '2,5 mg · 2x ao dia · oral',
        detalheLabel: '2,5 mg · 2x ao dia · oral',
        destaque: true,
        motivo: 'Para o coração',
        diagnostico: 'Cardíaca',
        desde: dia(61),
        observacoes: 'Dar com um pouco de patê: ela cospe o comprimido puro.',
      },
    ],
    diario: [
      entrada(2, { vitalidade: 'Normal', alimentacao: 'Normal' }),
      entrada(4, {
        sintomas: ['Tosse'],
        vitalidade: 'Calmo',
        observacoes: 'Tossiu duas vezes depois do passeio.',
      }),
      entrada(9, { sintomas: ['Cansaço'], observacoes: 'Respiração dormindo: 26 por minuto.' }),
    ],
    documentos: [
      documento('duna-eco', 'Ecocardiograma', 'Ultrassom', 95, [
        'Espessamento de folhetos da valva mitral com regurgitação moderada.',
        'Aumento discreto de átrio esquerdo (AE/Ao 1,7).',
        'Função sistólica preservada. Conclusão: DMVD estágio B2.',
      ]),
    ],
    observacoesTutor:
      'Ela cansa mais rápido nas caminhadas desde o inverno. À noite conto a respiração dormindo: entre 22 e 26 por minuto.',
  }),

  /* Nina, shih-tzu alérgica a dipirona. */
  'demo-pac-005': () => ({
    ...semNada(),
    alergias: [
      {
        titulo: 'Dipirona',
        detalhe: 'Medicamentosa · reação grave (inchaço no focinho e vômito)',
        destaque: true,
      },
      { titulo: 'Picada de pulga', detalhe: 'Inseto · dermatite' },
    ],
    vacinas: [vacina('V10 (polivalente)', 122), vacina('Antirrábica', 122)],
    medicamentos: [
      { titulo: 'Apoquel 5,4 mg', detalhe: 'Meio comprimido 1x ao dia nas crises de coceira' },
    ],
    comportamento: [
      { titulo: 'Não gosta que mexam nas patas', detalhe: 'Rosna no corte de unhas' },
    ],
    diagnosticos: [{ titulo: 'Dermatite atópica', detalhe: 'Diagnosticada em 2023' }],
    diario: [
      entrada(1, { sintomas: ['Coceira'], observacoes: 'Lambendo as patas a noite toda.' }),
      entrada(3, { sintomas: ['Coceira', 'Vermelhidão na pele'], vitalidade: 'Agitado' }),
    ],
    documentos: [
      documento('nina-receita', 'Receita do dermatologista', 'Receita Médica', 210, [
        'Oclacitinib 5,4 mg: meio comprimido a cada 12 horas por 14 dias, depois 1x ao dia.',
        'Banho com xampu de clorexidina 2% a cada 5 dias.',
      ]),
    ],
    observacoesTutor:
      'A Nina está se coçando muito nas patas e na barriga há uma semana. Por favor, nada de dipirona: ela teve reação grave em 2024.',
  }),

  /* Pérola, gata que vomita. */
  'demo-pac-001': () => ({
    ...semNada(),
    vacinas: [vacina('V5 (quíntupla felina)', 298), vacina('Antirrábica', 298)],
    medicamentos: [
      { titulo: 'Revolution Plus', detalhe: `Pipeta mensal · última em ${dataBr(22)}` },
    ],
    comportamento: [{ titulo: 'Arisca com estranhos', detalhe: 'Usar toalha para a contenção' }],
    diario: [
      entrada(2, {
        sintomas: ['Vômito'],
        alimentacao: 'Normal',
        observacoes: 'Vomitou bola de pelo depois do café da manhã.',
      }),
      entrada(6, { sintomas: ['Vômito'], fezes: 'Normal' }),
      entrada(11, { sintomas: ['Vômito', 'Lambedura excessiva'], hidratacao: 'Normal' }),
    ],
    observacoesTutor:
      'Tem vomitado de duas a três vezes por semana, quase sempre bola de pelo misturada com ração. Come e bebe normalmente.',
  }),

  /* Brunilda, jabuti-piranga. */
  'demo-pac-006': () => ({
    ...semNada(),
    comportamento: [
      { titulo: 'Hiberna parcialmente no inverno', detalhe: 'Come menos de junho a agosto' },
    ],
    observacoesTutor:
      'A Brunilda vive no quintal, com abrigo e lâmpada UVB trocada em março. Come folhas escuras, abóbora e frutas. Notamos o casco um pouco irregular.',
  }),

  /* Bento, persa com doença renal. */
  'demo-pac-007-2': () => ({
    ...semNada(),
    diagnosticos: [{ titulo: 'Doença renal crônica', detalhe: 'Estágio 2 (IRIS)', destaque: true }],
    tratamentosContinuos: [
      {
        titulo: 'Benazepril 2,5 mg',
        detalhe: 'Meio comprimido · 1x ao dia · oral',
        detalheLabel: 'Meio comprimido · 1x ao dia · oral',
        destaque: true,
        motivo: 'Para os rins e a pressão',
        diagnostico: 'Renal',
        desde: dia(402),
        observacoes: 'De manhã, antes da ração.',
      },
      {
        titulo: 'Ipakitine',
        detalhe: '1 medida · 2x ao dia · na comida',
        detalheLabel: '1 medida · 2x ao dia · na comida',
        destaque: true,
        motivo: 'Para segurar o fósforo',
        diagnostico: 'Renal',
        desde: dia(118),
        observacoes: null,
      },
    ],
    documentos: [
      documento('bento-bioq', 'Bioquímico renal', 'Exame de Sangue', 5, [
        'Creatinina 2,1 mg/dL (referência 0,8 a 1,8).',
        'Ureia 78 mg/dL (referência 30 a 60).',
        'SDMA 19 µg/dL (referência abaixo de 14). Fósforo 5,2 mg/dL.',
      ]),
      documento('bento-ago', 'Hemograma e bioquímico', 'Exame de Sangue', 92, [
        'Hematócrito 31% (referência 30 a 45). Creatinina 2,0 mg/dL. SDMA 18 µg/dL.',
      ]),
      documento(
        'bento-us',
        'Ultrassom abdominal',
        'Ultrassom',
        160,
        ['Rins de contornos irregulares, perda parcial da definição corticomedular. Sem cálculos.'],
        2,
      ),
    ],
    observacoesTutor:
      'Exame de rotina do Bento a cada três meses, como combinado com a Dra. Camila.',
  }),

  /* Pingo, furão. */
  'demo-pac-020': () => ({
    ...semNada(),
    vacinas: [vacina('Cinomose (furão)', 252), vacina('Antirrábica', 252)],
    comportamento: [{ titulo: 'Muito curioso, morde de brincadeira' }],
    diario: [
      entrada(9, { sintomas: ['Queda de pelo'], observacoes: 'Mais falhas na cauda.' }),
      entrada(23, { sintomas: ['Queda de pelo', 'Coceira'] }),
    ],
    observacoesTutor:
      'O Pingo está perdendo pelo na cauda e no quadril há uns dois meses. Continua ativo e comendo bem.',
  }),

  /* Chico, pug que vai para a limpeza de tártaro. */
  'demo-pac-008': () => ({
    ...semNada(),
    vacinas: [vacina('V10 (polivalente)', 151), vacina('Antirrábica', 151)],
    medicamentos: [{ titulo: 'Simparic 10,1–20 kg', detalhe: '1 comprimido por mês' }],
    diagnosticos: [
      {
        titulo: 'Síndrome braquicefálica',
        detalhe: 'Palato mole alongado e narinas estreitas',
        destaque: true,
      },
      { titulo: 'Doença periodontal', detalhe: 'Tártaro grau 2' },
    ],
    documentos: [
      documento('chico-hemo', 'Hemograma pré-operatório', 'Exame de Sangue', 4, [
        'Hemácias, leucócitos e plaquetas dentro da referência.',
        'Ureia 38 mg/dL, creatinina 1,1 mg/dL, ALT 42 U/L.',
      ]),
      documento('chico-rx', 'Radiografia de tórax', 'Raio-X', 4, [
        'Silhueta cardíaca normal. Traqueia de calibre discretamente reduzido, compatível com a raça.',
      ]),
    ],
    observacoesTutor: 'Limpeza de tártaro marcada. Ele ronca bastante e cansa no calor.',
  }),

  /* Floquinho, coelho sem comer. */
  'demo-pac-017': () => ({
    ...semNada(),
    comportamento: [
      {
        titulo: 'Assusta fácil com barulho',
        detalhe: 'Segurar com as duas mãos, apoiando o quadril',
      },
    ],
    diario: [
      entrada(0, {
        sintomas: ['Falta de apetite'],
        alimentacao: 'Pouco',
        fezes: 'Poucas e pequenas',
      }),
      entrada(1, { alimentacao: 'Recusou', vitalidade: 'Desanimado' }),
    ],
    observacoesTutor:
      'Desde ontem o Floquinho quase não comeu feno e fez poucas bolinhas. Está mais quieto.',
  }),

  /* Kiwi, calopsita que arranca as penas. */
  'demo-pac-013': () => ({
    ...semNada(),
    comportamento: [
      { titulo: 'Arranca as próprias penas', detalhe: 'Piora quando fica sozinha', destaque: true },
      { titulo: 'Morde quando contida' },
    ],
    removido: 'MEDICAMENTOS',
    observacoesTutor:
      'A Kiwi começou a arrancar as penas do peito depois da mudança de apartamento. Fica muito tempo sozinha durante o dia.',
  }),

  /* Simba, gato com FIV. */
  'demo-pac-024': () => ({
    ...semNada(),
    vacinas: [vacina('V4 (quádrupla felina)', 212), vacina('Antirrábica', 212)],
    comportamento: [{ titulo: 'Dócil, mas foge da caixa de transporte' }],
    diagnosticos: [
      { titulo: 'FIV', detalhe: 'Positivo desde 2024', destaque: true },
      { titulo: 'Gengivite crônica' },
    ],
    diario: [
      entrada(2, { sintomas: ['Mau hálito', 'Salivação'], alimentacao: 'Pouco' }),
      entrada(7, {
        sintomas: ['Mau hálito'],
        alimentacao: 'Pouco',
        observacoes: 'Só comeu sachê.',
      }),
    ],
    documentos: [
      documento('simba-fiv', 'Sorologia FIV/FeLV', 'Exame de Sangue', 401, [
        'FIV: reagente. FeLV: não reagente (imunocromatografia, confirmada por PCR).',
      ]),
      documento('simba-carteira', 'Carteira de vacinação', 'Carteira de Vacinação', 212, [
        'V4 felina e antirrábica aplicadas na mesma data, lote anotado pela clínica.',
      ]),
    ],
    observacoesTutor: 'O Simba emagreceu e está comendo só sachê. A gengiva está bem vermelha.',
  }),
}

/** O resumo de um pet sem texto escrito à mão: o que o cadastro dele já diz. */
function resumoDoCadastro(p: PacienteDaDemo): ResumoDoPet {
  const resumo = semNada()
  const vacinas: Partial<Record<string, ItemSnapshot[]>> = {
    CACHORRO: [vacina('V10 (polivalente)', 180), vacina('Antirrábica', 180)],
    GATO: [vacina('V5 (quíntupla felina)', 200), vacina('Antirrábica', 200)],
  }
  resumo.vacinas = vacinas[p.especie] ?? []

  for (const alerta of p.alertas) {
    const [titulo = alerta.detalhe ?? '', resto] = (alerta.detalhe ?? '').split(/:\s*/, 2)
    if (alerta.tipo === 'ALERGIA') {
      resumo.alergias.push({
        titulo,
        detalhe: resto ?? undefined,
        destaque: alerta.severidade === 'RISCO',
      })
    } else if (alerta.tipo === 'AGRESSIVO') {
      resumo.comportamento.push({
        titulo: 'Reage à contenção',
        detalhe: alerta.detalhe ?? undefined,
        destaque: true,
      })
    } else if (alerta.tipo === 'MEDICACAO_CONTINUA') {
      resumo.tratamentosContinuos.push({
        titulo: (alerta.detalhe ?? '').split(',')[0] ?? '',
        detalhe: alerta.detalhe,
        detalheLabel: alerta.detalhe,
        destaque: true,
        motivo: null,
        diagnostico: null,
        desde: null,
        observacoes: null,
      })
    } else if (alerta.tipo !== 'GESTANTE') {
      resumo.diagnosticos.push({ titulo, detalhe: resto ?? undefined })
    }
  }

  const artigo = p.sexo === 'FEMEA' ? 'da' : 'do'
  resumo.observacoesTutor = `Libero o histórico ${artigo} ${p.nome} para o atendimento na clínica.`
  return resumo
}

function snapshotDe(
  p: PacienteDaDemo,
  categorias: Categoria[],
  resumo: ResumoDoPet,
): SnapshotPetCompartilhado {
  const snapshot: SnapshotPetCompartilhado = {
    pesoKg: p.pesoKg,
    observacoesTutor: resumo.observacoesTutor,
    motivos: {},
  }
  const motivos = snapshot.motivos as Partial<Record<string, MotivoBlocoVazio>>

  for (const categoria of TODAS) {
    const bloco = BLOCO_DA_CATEGORIA[categoria]
    if (resumo.removido === categoria) {
      snapshot[bloco] = [] as never
      motivos[bloco] = 'REMOVIDO_PELO_TUTOR'
      continue
    }
    if (!categorias.includes(categoria)) continue
    const itens = resumo[bloco]
    snapshot[bloco] = itens as never
    if (!itens.length) motivos[bloco] = 'SEM_REGISTRO'
  }

  return snapshot
}

/* --------------------------------------------------------------------- as anotações */

const ESPECIALIDADE: Record<string, string> = {
  'demo-prof-marina': 'CLINICO_GERAL',
  'demo-prof-rafael': 'CARDIOLOGIA',
  'demo-prof-camila': 'Medicina felina',
  'demo-prof-bruno': 'ANIMAIS_EXOTICOS',
}

function estruturadoVazio(): AnotacaoEstruturada {
  return {
    motivo: null,
    diagnostico: null,
    pesoKg: null,
    tipoExame: null,
    laudoTexto: null,
    dataResultado: null,
    produtos: null,
    condicaoPele: null,
    comportamento: null,
    dataEntrada: null,
    dataSaida: null,
    alimentacao: null,
    intercorrencias: null,
    prescricaoItens: [],
    examesSolicitados: [],
  }
}

let sequenciaDeAnotacao = 0
let sequenciaDeAnexo = 0

/** O que abre quando a equipe clica no anexo: o arquivo enviado ou o documento escrito aqui. */
const ANEXOS = new Map<string, { arquivo?: Blob; titulo: string; linhas: string[] }>()

type AnexoDaTabela = {
  nome: string
  tipo: string
  mime?: string
  descricao?: string
  linhas: string[]
}

type Prescricao = [
  nome: string,
  dose: string,
  unidade: string,
  frequencia: string,
  dias: number | null,
  instrucoes?: string,
]

type AnotacaoDaTabela = {
  quando: string
  profissionalId: string
  servico: string
  texto: string
  estruturado?: Partial<Omit<AnotacaoEstruturada, 'prescricaoItens' | 'examesSolicitados'>>
  prescricao?: Prescricao[]
  exames?: Array<[nome: string, observacao?: string]>
  anexos?: AnexoDaTabela[]
}

function anotacaoDe(a: AnotacaoDaTabela): Anotacao {
  const id = idDe('demo-anot', ++sequenciaDeAnotacao)
  const prof = profissional(a.profissionalId)
  return {
    ...estruturadoVazio(),
    ...a.estruturado,
    prescricaoItens: (a.prescricao ?? []).map(
      ([nome, dose, unidade, frequencia, dias, instrucoes], i) => ({
        id: `${id}-rx-${i + 1}`,
        nome,
        dose,
        unidade,
        frequencia,
        duracaoDias: dias,
        instrucoes: instrucoes ?? null,
      }),
    ),
    examesSolicitados: (a.exames ?? []).map(([nome, observacao], i) => ({
      id: `${id}-ex-${i + 1}`,
      nome,
      observacao: observacao ?? null,
    })),
    id,
    empresaNome: PARCEIRO_NOME,
    profissionalNome: prof?.nome ?? null,
    profissionalEspecialidade: ESPECIALIDADE[a.profissionalId] ?? null,
    servicoRealizado: a.servico,
    texto: a.texto,
    criadaEm: a.quando,
    anexos: (a.anexos ?? []).map((anexo) => {
      const anexoId = idDe('demo-anexo', ++sequenciaDeAnexo)
      ANEXOS.set(anexoId, { titulo: anexo.nome, linhas: anexo.linhas })
      const resultado: AnexoAnotacao = {
        id: anexoId,
        tipoDocumento: anexo.tipo,
        nome: anexo.nome,
        mimeType: anexo.mime ?? 'application/pdf',
        tamanhoBytes: sorte.inteiro(120_000, 1_400_000),
        salvoNosDocumentos: true,
        documentoId: `demo-docpet-${anexoId}`,
        descricao: anexo.descricao ?? null,
      }
      return resultado
    }),
    diario: null,
  }
}

/* --------------------------------------------------------------------------- os acessos */

export type AcessoDaDemo = {
  id: string
  codigo: string
  pacienteId: string
  tipoServico: TipoServicoPrestador
  servicoOutroLabel: string | null
  empresaNome: string | null
  mensagemTutor: string | null
  categorias: Categoria[]
  criadoEm: string
  vinculadoEm: string
  expiraEm: string
  revogadoEm: string | null
  snapshot: SnapshotPetCompartilhado
  snapshotAtualizadoEm: string | null
  anotacoes: Anotacao[]
}

type AcessoDaTabela = {
  pacienteId: string
  tipo: TipoServicoPrestador
  outro?: string
  criado: string
  vinculado: string
  /** Validade, em horas desde a criação. */
  horas: number
  revogado?: string
  empresa?: string
  mensagem?: string
  categorias?: Categoria[]
  atualizado?: string
  anotacoes?: AnotacaoDaTabela[]
}

const TABELA: AcessoDaTabela[] = [
  /* -------------------------------------------------------------- ativos */
  {
    pacienteId: 'demo-pac-003',
    tipo: 'CONSULTA',
    criado: em(1, '21:12'),
    vinculado: haMinutos(108),
    horas: 72,
    mensagem:
      'Oi! Libero o histórico da Mel para a consulta de pré-natal. Qualquer dúvida, me chama no WhatsApp.',
  },
  {
    pacienteId: 'demo-pac-003',
    tipo: 'EXAME',
    criado: em(4, '07:40'),
    vinculado: em(4, '08:05'),
    horas: 7 * 24,
    categorias: DO_EXAME,
    anotacoes: [
      {
        quando: em(3, '15:20'),
        profissionalId: 'demo-prof-marina',
        servico: 'Ultrassonografia gestacional',
        texto:
          'Exame sem intercorrências, paciente tranquila. Laudo completo em anexo. Orientada a responsável sobre alimentação de gestante e sinais de parto.',
        estruturado: {
          tipoExame: 'Ultrassom gestacional',
          laudoTexto:
            'Útero gravídico com 6 vesículas gestacionais viáveis, batimentos cardíacos fetais presentes. Idade gestacional estimada em 34 a 36 dias. Previsão de parto em 4 semanas.',
          dataResultado: dia(3),
        },
        anexos: [
          {
            nome: 'laudo-ultrassom-mel.pdf',
            tipo: 'Ultrassom',
            linhas: [
              'Paciente: Mel, Golden Retriever, fêmea, 29,3 kg.',
              'Útero gravídico com 6 vesículas gestacionais viáveis.',
              'Idade gestacional estimada: 34 a 36 dias.',
            ],
          },
        ],
      },
    ],
  },
  {
    pacienteId: 'demo-pac-010',
    tipo: 'CONSULTA',
    criado: em(1, '13:20'),
    vinculado: em(1, '14:02'),
    horas: 14 * 24,
    empresa: 'Clínica Vila Madalena',
    mensagem: 'Para o Dr. Rafael: segue o histórico da Duna com o último eco.',
    anotacoes: [
      {
        quando: em(1, '15:10'),
        profissionalId: 'demo-prof-rafael',
        servico: 'Consulta cardiológica',
        texto:
          'Sopro sistólico grau III/VI em foco mitral, ritmo regular. Frequência respiratória em repouso de 24 mpm segundo a responsável. Mantido pimobendan; retorno em 30 dias com ecocardiograma e radiografia de tórax.',
        estruturado: {
          motivo: 'Reavaliação do sopro e do pimobendan',
          diagnostico: 'Doença valvar mitral degenerativa, estágio B2',
          pesoKg: 7.6,
        },
        prescricao: [
          [
            'Pimobendan',
            '2,5',
            'mg',
            'a cada 12 horas',
            null,
            'Uso contínuo. Dar 1 hora antes da refeição.',
          ],
        ],
        exames: [['Ecocardiograma'], ['Radiografia de tórax', 'Duas incidências']],
        anexos: [
          {
            nome: 'receita-duna.pdf',
            tipo: 'Receita Medica',
            linhas: ['Pimobendan 2,5 mg: 1 comprimido a cada 12 horas, uso contínuo.'],
          },
        ],
      },
    ],
  },
  {
    pacienteId: 'demo-pac-005',
    tipo: 'CONSULTA',
    criado: em(1, '08:15'),
    vinculado: haMinutos(69),
    horas: 48,
    mensagem: 'A Nina tem alergia grave a dipirona. Obrigada!',
  },
  {
    pacienteId: 'demo-pac-001',
    tipo: 'CONSULTA',
    criado: em(2, '19:40'),
    vinculado: em(1, '09:12'),
    horas: 5 * 24,
    categorias: [
      'ALERGIAS',
      'VACINAS',
      'MEDICAMENTOS',
      'COMPORTAMENTO',
      'DIAGNOSTICOS',
      'TRATAMENTOS',
      'DIARIO',
    ],
    anotacoes: [
      {
        quando: em(1, '09:50'),
        profissionalId: 'demo-prof-camila',
        servico: 'Consulta clínica felina',
        texto:
          'Paciente alerta, hidratada, mucosas normocoradas. Palpação abdominal sem dor. Vômitos de tricobezoar associados a lambedura excessiva. Iniciado protetor gástrico e pasta de malte; exames para descartar causa sistêmica.',
        estruturado: {
          motivo: 'Vômitos esporádicos há duas semanas',
          diagnostico: 'Gastrite leve por tricobezoar, a confirmar',
          pesoKg: 4.1,
        },
        prescricao: [
          ['Omeprazol', '5', 'mg', 'a cada 24 horas', 10, 'Em jejum, pela manhã.'],
          ['Pasta de malte', '2', 'cm', '3x por semana', 30],
        ],
        exames: [['Hemograma e bioquímico'], ['Ultrassom abdominal']],
      },
    ],
  },
  {
    pacienteId: 'demo-pac-006',
    tipo: 'CONSULTA',
    criado: em(5, '08:00'),
    vinculado: em(5, '08:30'),
    horas: 7 * 24,
    categorias: [
      'ALERGIAS',
      'VACINAS',
      'MEDICAMENTOS',
      'COMPORTAMENTO',
      'DIAGNOSTICOS',
      'TRATAMENTOS',
    ],
    anotacoes: [
      {
        quando: em(5, '09:10'),
        profissionalId: 'demo-prof-bruno',
        servico: 'Consulta de animais exóticos',
        texto:
          'Jabuti ativo, olhos limpos, narinas sem secreção. Leve piramidismo nos escudos vertebrais, compatível com excesso de proteína e pouca umidade no passado. Orientados banhos mornos 2x por semana e mais folhas escuras.',
        estruturado: {
          motivo: 'Avaliação anual e casco irregular',
          diagnostico: 'Saudável; piramidismo leve do casco',
          pesoKg: 3.4,
        },
        prescricao: [
          [
            'Suplemento de cálcio em pó',
            '1',
            'pitada',
            '3x por semana',
            null,
            'Polvilhar sobre as folhas.',
          ],
        ],
      },
    ],
  },
  {
    pacienteId: 'demo-pac-007-2',
    tipo: 'EXAME',
    criado: em(7, '19:30'),
    vinculado: em(6, '08:40'),
    horas: 7 * 24,
    categorias: DO_EXAME,
    anotacoes: [
      {
        quando: em(5, '16:05'),
        profissionalId: 'demo-prof-camila',
        servico: 'Coleta e resultado de exames',
        texto:
          'Coleta sem intercorrências. Valores estáveis em relação a agosto. Manter benazepril e quelante; nova coleta em 90 dias.',
        estruturado: {
          tipoExame: 'Bioquímico renal (creatinina, ureia, SDMA e fósforo)',
          laudoTexto:
            'Creatinina 2,1 mg/dL (ref. 0,8–1,8); ureia 78 mg/dL (ref. 30–60); SDMA 19 µg/dL (ref. < 14); fósforo 5,2 mg/dL. Compatível com DRC estágio 2 (IRIS), estável.',
          dataResultado: dia(5),
        },
        anexos: [
          {
            nome: 'bioquimico-bento.pdf',
            tipo: 'Exame de Sangue',
            linhas: [
              'Creatinina 2,1 mg/dL',
              'Ureia 78 mg/dL',
              'SDMA 19 µg/dL',
              'Fósforo 5,2 mg/dL',
            ],
          },
        ],
      },
    ],
  },
  {
    pacienteId: 'demo-pac-020',
    tipo: 'CONSULTA',
    criado: em(1, '10:00'),
    vinculado: em(1, '10:20'),
    horas: 14 * 24,
    categorias: [
      'ALERGIAS',
      'VACINAS',
      'MEDICAMENTOS',
      'COMPORTAMENTO',
      'DIAGNOSTICOS',
      'TRATAMENTOS',
      'DIARIO',
    ],
    anotacoes: [
      {
        quando: em(1, '11:00'),
        profissionalId: 'demo-prof-bruno',
        servico: 'Consulta de animais exóticos',
        texto:
          'Alopecia simétrica em cauda e região lombar, sem prurido intenso. Vulva/prepúcio sem aumento. Suspeita de doença adrenal, frequente em furões a partir de 3 anos. Solicitado ultrassom das adrenais.',
        estruturado: {
          motivo: 'Queda de pelo na cauda e no quadril',
          diagnostico: 'Suspeita de hiperadrenocorticismo do furão',
          pesoKg: 1.2,
        },
        exames: [['Ultrassom abdominal', 'Foco nas adrenais']],
      },
    ],
  },
  {
    pacienteId: 'demo-pac-008',
    tipo: 'OUTRO',
    outro: 'Avaliação pré-anestésica',
    criado: em(4, '18:00'),
    vinculado: em(4, '18:24'),
    horas: 10 * 24,
    categorias: [
      'ALERGIAS',
      'VACINAS',
      'MEDICAMENTOS',
      'DIAGNOSTICOS',
      'TRATAMENTOS',
      'DOCUMENTOS',
    ],
    anotacoes: [
      {
        quando: em(3, '10:20'),
        profissionalId: 'demo-prof-marina',
        servico: 'Avaliação pré-anestésica',
        texto:
          'ASA II pela condição braquicefálica. Exames pré-operatórios dentro da referência. Liberado para profilaxia dentária com intubação precoce e extubação tardia. Jejum de 8 horas de comida e 2 horas de água.',
      },
    ],
  },
  {
    pacienteId: 'demo-pac-017',
    tipo: 'CONSULTA',
    criado: haMinutos(42),
    vinculado: haMinutos(34),
    horas: 7 * 24,
    mensagem: 'Ele quase não comeu desde ontem. Estamos indo para a clínica.',
  },
  {
    pacienteId: 'demo-pac-013',
    tipo: 'CONSULTA',
    criado: em(8, '14:00'),
    vinculado: em(8, '14:25'),
    horas: 14 * 24,
    categorias: ['ALERGIAS', 'COMPORTAMENTO', 'DIAGNOSTICOS', 'TRATAMENTOS'],
    atualizado: em(2, '20:15'),
    anotacoes: [
      {
        quando: em(8, '15:00'),
        profissionalId: 'demo-prof-bruno',
        servico: 'Consulta de aves',
        texto:
          'Arrancamento de penas no peito e nas asas, pele íntegra. Sem ectoparasitas. Quadro comportamental ligado à solidão e à mudança de casa. Orientado enriquecimento ambiental, banho de sol e rotina de luz de 12 horas.',
        estruturado: {
          motivo: 'Arrancando as penas do peito',
          diagnostico: 'Arrancamento de penas por estresse',
          pesoKg: 0.09,
        },
        prescricao: [
          ['Suplemento vitamínico', '2', 'gotas', '1x ao dia', 30, 'Na água do bebedouro.'],
        ],
      },
    ],
  },
  {
    pacienteId: 'demo-pac-024',
    tipo: 'CONSULTA',
    criado: em(3, '08:30'),
    vinculado: em(3, '09:00'),
    horas: 7 * 24,
    atualizado: em(1, '22:10'),
    anotacoes: [
      {
        quando: em(3, '09:40'),
        profissionalId: 'demo-prof-camila',
        servico: 'Consulta clínica felina',
        texto:
          'Gengivoestomatite moderada, perda de 400 g desde a última consulta. Iniciado antibiótico e analgesia; reavaliar em 14 dias para planejar extrações.',
        estruturado: {
          motivo: 'Gengivite e perda de peso',
          diagnostico: 'Gengivoestomatite associada ao FIV',
          pesoKg: 4.3,
        },
        prescricao: [
          ['Clindamicina 25 mg/ml', '1', 'ml', 'a cada 12 horas', 14],
          ['Meloxicam 0,5 mg/ml', '0,2', 'ml', 'a cada 24 horas', 4, 'Depois da comida.'],
        ],
        exames: [['Hemograma completo'], ['Bioquímico (ureia, creatinina, ALT)']],
      },
    ],
  },

  /* ----------------------------------------------------------- encerrados */
  {
    pacienteId: 'demo-pac-010',
    tipo: 'CONSULTA',
    criado: em(62, '10:00'),
    vinculado: em(62, '10:30'),
    horas: 7 * 24,
    anotacoes: [
      {
        quando: em(62, '11:00'),
        profissionalId: 'demo-prof-rafael',
        servico: 'Consulta cardiológica',
        texto:
          'Sopro sistólico grau III/VI identificado na vacinação. Eco solicitado; iniciado pimobendan pelo aumento de átrio esquerdo na radiografia.',
        estruturado: {
          motivo: 'Sopro cardíaco percebido na vacinação',
          diagnostico: 'Doença valvar mitral, estágio B2',
          pesoKg: 7.8,
        },
        prescricao: [['Pimobendan', '2,5', 'mg', 'a cada 12 horas', null, 'Uso contínuo.']],
        exames: [['Ecocardiograma']],
      },
    ],
  },
  {
    pacienteId: 'demo-pac-002',
    tipo: 'CONSULTA',
    criado: em(27, '08:10'),
    vinculado: em(27, '08:40'),
    horas: 7 * 24,
    anotacoes: [
      {
        quando: em(27, '09:20'),
        profissionalId: 'demo-prof-marina',
        servico: 'Vacinação e check-up',
        texto:
          'Contido com focinheira, conforme o alerta. Aplicadas V10 e antirrábica. Escore corporal 6/9: orientada redução de 10% na ração.',
        estruturado: {
          motivo: 'Vacinação anual',
          diagnostico: 'Saudável; leve sobrepeso',
          pesoKg: 44.2,
        },
        exames: [['Hemograma completo']],
      },
    ],
  },
  {
    pacienteId: 'demo-pac-001-2',
    tipo: 'CONSULTA',
    criado: em(15, '18:30'),
    vinculado: em(15, '18:45'),
    horas: 7 * 24,
    revogado: em(12, '07:58'),
  },
  {
    pacienteId: 'demo-pac-007',
    tipo: 'EXAME',
    criado: em(42, '08:00'),
    vinculado: em(42, '08:20'),
    horas: 7 * 24,
    categorias: DO_EXAME,
    anotacoes: [
      {
        quando: em(41, '14:00'),
        profissionalId: 'demo-prof-bruno',
        servico: 'Radiografia de coluna',
        texto:
          'Exame feito sem sedação. Manter restrição de saltos e escadas; fisioterapia indicada.',
        estruturado: {
          tipoExame: 'Radiografia de coluna toracolombar',
          laudoTexto:
            'Calcificação de discos intervertebrais em T12-T13 e L1-L2, sem sinais de compressão aguda. Espaços intervertebrais preservados.',
          dataResultado: dia(41),
        },
        anexos: [
          {
            nome: 'rx-coluna-cacau.jpg',
            tipo: 'Raio-X',
            mime: 'image/jpeg',
            linhas: ['Radiografia lateral da coluna toracolombar.'],
          },
          {
            nome: 'laudo-rx-cacau.pdf',
            tipo: 'Raio-X',
            linhas: ['Calcificação de discos em T12-T13 e L1-L2, sem compressão aguda.'],
          },
        ],
      },
    ],
  },
  {
    pacienteId: 'demo-pac-009',
    tipo: 'CONSULTA',
    criado: em(57, '09:00'),
    vinculado: em(57, '09:15'),
    horas: 7 * 24,
    anotacoes: [
      {
        quando: em(57, '10:00'),
        profissionalId: 'demo-prof-marina',
        servico: 'Primeira consulta e vacinação',
        texto:
          'Filhote ativo e saudável. Aplicada a segunda dose da V10. Vermifugação feita. Próxima dose em 21 dias, com a antirrábica.',
        estruturado: {
          motivo: 'Protocolo vacinal de filhote',
          diagnostico: 'Saudável',
          pesoKg: 9.4,
        },
        prescricao: [
          [
            'Vermífugo (praziquantel + pirantel)',
            '1',
            'comprimido',
            'dose única',
            1,
            'Repetir em 15 dias.',
          ],
        ],
      },
    ],
  },
  {
    pacienteId: 'demo-pac-004',
    tipo: 'CONSULTA',
    criado: em(16, '11:30'),
    vinculado: em(16, '11:42'),
    horas: 7 * 24,
    anotacoes: [
      {
        quando: em(16, '12:15'),
        profissionalId: 'demo-prof-rafael',
        servico: 'Consulta clínica',
        texto:
          'Diarreia pastosa há dois dias, sem sangue, apetite preservado. Comeu petisco novo no fim de semana. Dieta leve por 3 dias e probiótico.',
        estruturado: {
          motivo: 'Diarreia há dois dias',
          diagnostico: 'Gastroenterite alimentar',
          pesoKg: 14.6,
        },
        prescricao: [
          ['Probiótico em pasta', '2', 'g', 'a cada 24 horas', 5],
          ['Metronidazol 250 mg', '1/2', 'comprimido', 'a cada 12 horas', 5, 'Junto com a comida.'],
        ],
      },
    ],
  },
  {
    pacienteId: 'demo-pac-011',
    tipo: 'CONSULTA',
    criado: em(6, '10:00'),
    vinculado: em(6, '10:15'),
    horas: 7 * 24,
    revogado: em(3, '21:40'),
    anotacoes: [
      {
        quando: em(5, '10:30'),
        profissionalId: 'demo-prof-camila',
        servico: 'Check-up anual',
        texto:
          'Exame físico sem alterações. Escore corporal 6/9. Orientada troca para ração light e brincadeiras diárias.',
        estruturado: {
          motivo: 'Check-up anual',
          diagnostico: 'Saudável; leve sobrepeso',
          pesoKg: 4.8,
        },
      },
    ],
  },
  {
    pacienteId: 'demo-pac-039',
    tipo: 'EXAME',
    criado: em(32, '08:00'),
    vinculado: em(32, '08:10'),
    horas: 7 * 24,
    categorias: DO_EXAME,
    anotacoes: [
      {
        quando: em(31, '17:00'),
        profissionalId: 'demo-prof-camila',
        servico: 'Coleta e resultado de exames',
        texto:
          'Controle adequado do hipertireoidismo com a dose atual de metimazol. Repetir em 3 meses.',
        estruturado: {
          tipoExame: 'T4 total',
          laudoTexto:
            'T4 total 3,1 µg/dL (referência 0,8 a 4,0), em uso de metimazol 2,5 mg a cada 12 horas.',
          dataResultado: dia(31),
        },
        anexos: [
          {
            nome: 't4-lilica.pdf',
            tipo: 'Exame de Sangue',
            linhas: ['T4 total: 3,1 µg/dL (referência 0,8 a 4,0).'],
          },
        ],
      },
    ],
  },
]

export const ACESSOS: AcessoDaDemo[] = []

function codigoNovo() {
  let codigo = ''
  do {
    codigo = String(sorte.inteiro(100000, 999999))
  } while (ACESSOS.some((a) => a.codigo === codigo))
  return codigo
}

function montar() {
  TABELA.forEach((linha, i) => {
    const p = paciente(linha.pacienteId)
    if (!p) return
    const categorias = linha.categorias ?? (linha.tipo === 'EXAME' ? DO_EXAME : TODAS)
    const resumo = (RESUMOS[p.id] ?? (() => resumoDoCadastro(p)))()
    ACESSOS.push({
      id: idDe('demo-acesso', i + 1),
      codigo: codigoNovo(),
      pacienteId: p.id,
      tipoServico: linha.tipo,
      servicoOutroLabel: linha.outro ?? null,
      empresaNome: linha.empresa ?? PARCEIRO_NOME,
      mensagemTutor: linha.mensagem ?? null,
      categorias,
      criadoEm: linha.criado,
      vinculadoEm: linha.vinculado,
      expiraEm: somarMinutos(linha.criado, linha.horas * 60),
      revogadoEm: linha.revogado ?? null,
      snapshot: snapshotDe(p, categorias, resumo),
      snapshotAtualizadoEm: linha.atualizado ?? null,
      anotacoes: (linha.anotacoes ?? [])
        .map(anotacaoDe)
        .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm)),
    })
  })
}

montar()

/* ---------------------------------------------------------------------------- leituras */

export function acesso(id: string) {
  return ACESSOS.find((a) => a.id === id) ?? null
}

export function statusDoAcesso(a: AcessoDaDemo): StatusCompartilhamento {
  if (a.revogadoEm) return 'REVOGADO'
  return jaPassou(a.expiraEm) ? 'EXPIRADO' : 'ATIVO'
}

const ROTULO_DA_ESPECIE: Record<string, string> = {
  CACHORRO: 'Cachorro',
  GATO: 'Gato',
  AVE: 'Ave',
  ROEDOR: 'Roedor',
  COELHO: 'Coelho',
  PEIXE: 'Peixe',
  REPTIL: 'Réptil',
  OUTRO: 'Outro',
}

function pet(a: AcessoDaDemo) {
  const p = paciente(a.pacienteId) as PacienteDaDemo
  return {
    petNome: p.nome,
    especie: p.especie,
    especieLabel: ROTULO_DA_ESPECIE[p.especie] ?? p.especie,
    tipoEspecie: p.especie === 'OUTRO' ? p.especieOutra : null,
    petFoto: p.fotoUrl,
  }
}

export function resumoDoAcesso(a: AcessoDaDemo): CompartilhamentoResumo {
  const status = statusDoAcesso(a)
  const ativo = status === 'ATIVO'
  return {
    id: a.id,
    ...pet(a),
    tipoServico: a.tipoServico,
    servicoOutroLabel: a.servicoOutroLabel,
    status,
    expiraEm: a.expiraEm,
    vinculadoEm: a.vinculadoEm,
    criadoEm: a.criadoEm,
    totalAnotacoes: a.anotacoes.length,
    totalDocumentos: ativo ? (a.snapshot.documentos?.length ?? 0) : 0,
    temDiario: ativo && Boolean(a.snapshot.diario?.length),
    snapshotAtualizadoEm: a.snapshotAtualizadoEm,
  }
}

export function detalheDoAcesso(a: AcessoDaDemo): CompartilhamentoDetalhe {
  const status = statusDoAcesso(a)
  const ativo = status === 'ATIVO'
  const p = paciente(a.pacienteId) as PacienteDaDemo
  return {
    id: a.id,
    codigo: a.codigo,
    ...pet(a),
    petCastrado: p.castrado,
    tipoServico: a.tipoServico,
    servicoOutroLabel: a.servicoOutroLabel,
    empresaNome: a.empresaNome,
    mensagemTutor: a.mensagemTutor,
    /* Encerrado: o histórico é enxuto, sem as categorias nem o resumo. */
    categorias: ativo ? [...a.categorias] : undefined,
    criadoEm: a.criadoEm,
    expiraEm: a.expiraEm,
    revogadoEm: a.revogadoEm,
    vinculadoEm: a.vinculadoEm,
    status,
    snapshotAtualizadoEm: a.snapshotAtualizadoEm,
    snapshot: ativo ? a.snapshot : null,
    anotacoes: a.anotacoes,
  }
}

/** O que um paciente tem aqui, para a linha do tempo: um item por acesso. */
export function acessosDoPaciente(pacienteId: string) {
  return ACESSOS.filter((a) => a.pacienteId === pacienteId).map((a) => ({
    acessoId: a.id,
    tipoServico: a.tipoServico,
    status: statusDoAcesso(a),
    vinculadoEm: a.vinculadoEm,
    expiraEm: a.expiraEm,
    responsavel: cliente(paciente(pacienteId)?.clienteId ?? '')?.nome ?? null,
    anotacoes: a.anotacoes.map((n) => ({
      id: n.id,
      criadaEm: n.criadaEm,
      servicoRealizado: n.servicoRealizado,
      profissionalNome: n.profissionalNome,
    })),
  }))
}

export function contagensDosAcessos() {
  const ativos = ACESSOS.filter((a) => statusDoAcesso(a) === 'ATIVO')
  return {
    ativos: ativos.length,
    novosHoje: ativos.filter((a) => a.vinculadoEm.slice(0, 10) === hoje()).length,
    vencendoEmUmDia: ativos.filter((a) => minutosAte(a.expiraEm) < 24 * 60).length,
  }
}

/* --------------------------------------------------------------------- vincular código */

/** Código que ainda não estava aqui: o acesso que um responsável criou para um pet da base. */
export function vincularPorCodigo(codigo: string): AcessoDaDemo {
  const existente = ACESSOS.find((a) => a.codigo === codigo)
  if (existente) return existente

  const comAcessoAtivo = new Set(
    ACESSOS.filter((a) => statusDoAcesso(a) === 'ATIVO').map((a) => a.pacienteId),
  )
  const livres = PACIENTES.filter((p) => p.ativo && !comAcessoAtivo.has(p.id))
  const escolhido =
    livres[Number(codigo) % Math.max(1, livres.length)] ?? (PACIENTES[0] as PacienteDaDemo)
  const criadoEm = haMinutos(12)
  const categorias = TODAS.filter((c) => c !== 'DIARIO' && c !== 'DOCUMENTOS')
  const novo: AcessoDaDemo = {
    id: idDe('demo-acesso', ACESSOS.length + 1),
    codigo,
    pacienteId: escolhido.id,
    tipoServico: 'CONSULTA',
    servicoOutroLabel: null,
    empresaNome: PARCEIRO_NOME,
    mensagemTutor: null,
    categorias,
    criadoEm,
    vinculadoEm: agoraIso(),
    expiraEm: somarMinutos(criadoEm, 7 * 24 * 60),
    revogadoEm: null,
    snapshot: snapshotDe(escolhido, categorias, resumoDoCadastro(escolhido)),
    snapshotAtualizadoEm: null,
    anotacoes: [],
  }
  ACESSOS.push(novo)
  return novo
}

/* ---------------------------------------------------------------- anotação nova */

function textoDe(form: FormData, campo: string) {
  const valor = form.get(campo)
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null
}

function jsonDe<T>(form: FormData, campo: string): T | null {
  const valor = textoDe(form, campo)
  if (!valor) return null
  try {
    return JSON.parse(valor) as T
  } catch {
    return null
  }
}

/** A anotação que a equipe escreveu no formulário (multipart), como a API grava. */
export function criarAnotacaoDoFormulario(a: AcessoDaDemo, form: FormData): Anotacao {
  const id = idDe('demo-anot', ++sequenciaDeAnotacao)
  const peso = textoDe(form, 'pesoKg')
  const prescricao = jsonDe<AnotacaoPrescricaoItemInput[]>(form, 'prescricaoItens') ?? []
  const exames =
    jsonDe<Array<{ nome: string; observacao?: string }>>(form, 'examesSolicitados') ?? []
  const diario = jsonDe<Partial<AnotacaoDiario>>(form, 'diario')
  const tipos = jsonDe<(string | null)[]>(form, 'tiposDocumento') ?? []
  const descricoes = jsonDe<(string | null)[]>(form, 'descricoesAnexos') ?? []

  const anexos: AnexoAnotacao[] = form
    .getAll('anexos')
    .filter((f): f is File => f instanceof File)
    .map((arquivo, i) => {
      const anexoId = idDe('demo-anexo', ++sequenciaDeAnexo)
      ANEXOS.set(anexoId, { arquivo, titulo: arquivo.name, linhas: [] })
      return {
        id: anexoId,
        tipoDocumento: tipos[i] ?? null,
        nome: arquivo.name,
        mimeType: arquivo.type || 'application/octet-stream',
        tamanhoBytes: arquivo.size,
        salvoNosDocumentos: true,
        documentoId: `demo-docpet-${anexoId}`,
        descricao: descricoes[i] ?? null,
      }
    })

  const leituraId = textoDe(form, 'leituraReceitaId')
  const leitura = leituraId ? LEITURAS.get(leituraId) : undefined
  if (leitura) {
    leitura.arquivos.forEach((arquivo, i) => {
      const anexoId = idDe('demo-anexo', ++sequenciaDeAnexo)
      ANEXOS.set(anexoId, { arquivo, titulo: arquivo.name, linhas: [] })
      anexos.push({
        id: anexoId,
        tipoDocumento: 'Receita Medica',
        nome: arquivo.name || `receita-${i + 1}`,
        mimeType: arquivo.type || 'image/jpeg',
        tamanhoBytes: arquivo.size,
        salvoNosDocumentos: true,
        documentoId: `demo-docpet-${anexoId}`,
        descricao: null,
      })
    })
    leitura.status = 'CONFIRMADA'
    leitura.anotacaoId = id
  }

  const nova: Anotacao = {
    ...estruturadoVazio(),
    motivo: textoDe(form, 'motivo'),
    diagnostico: textoDe(form, 'diagnostico'),
    pesoKg: peso ? Number(peso.replace(',', '.')) : null,
    tipoExame: textoDe(form, 'tipoExame'),
    laudoTexto: textoDe(form, 'laudoTexto'),
    dataResultado: textoDe(form, 'dataResultado'),
    produtos: textoDe(form, 'produtos'),
    condicaoPele: textoDe(form, 'condicaoPele'),
    comportamento: textoDe(form, 'comportamento'),
    dataEntrada: textoDe(form, 'dataEntrada'),
    dataSaida: textoDe(form, 'dataSaida'),
    alimentacao: textoDe(form, 'alimentacao'),
    intercorrencias: textoDe(form, 'intercorrencias'),
    prescricaoItens: prescricao.map((item, i) => ({
      id: `${id}-rx-${i + 1}`,
      nome: item.nome,
      dose: item.dose ?? null,
      unidade: item.unidade ?? null,
      frequencia: item.frequencia ?? null,
      duracaoDias: item.duracaoDias ?? null,
      instrucoes: item.instrucoes ?? null,
    })),
    examesSolicitados: exames.map((item, i) => ({
      id: `${id}-ex-${i + 1}`,
      nome: item.nome,
      observacao: item.observacao ?? null,
    })),
    id,
    empresaNome: PARCEIRO_NOME,
    profissionalNome: textoDe(form, 'profissionalNome'),
    profissionalEspecialidade: textoDe(form, 'profissionalEspecialidade'),
    servicoRealizado: textoDe(form, 'servicoRealizado') ?? '',
    texto: textoDe(form, 'texto') ?? '',
    criadaEm: agoraIso(),
    anexos,
    diario: diario
      ? {
          vitalidade: diario.vitalidade ?? null,
          alimentacao: diario.alimentacao ?? null,
          hidratacao: diario.hidratacao ?? null,
          fezes: diario.fezes ?? null,
          urina: diario.urina ?? null,
          sintomas: diario.sintomas ?? [],
          temperamento: diario.temperamento ?? [],
        }
      : null,
    diarioRegistrado: Boolean(diario),
  }

  a.anotacoes.unshift(nova)
  return nova
}

/* --------------------------------------------------------------- leitura de receita */

export type LeituraDaDemo = {
  id: string
  acessoId: string
  status: LeituraReceitaParceiro['status']
  criadaEm: number
  anotacaoId: string | null
  arquivos: File[]
  urls: string[]
}

export const LEITURAS = new Map<string, LeituraDaDemo>()

/** O que a IA "leu" na receita: um antibiótico, um anti-inflamatório e um suplemento. */
const ITENS_LIDOS: ItemFormularioLeitura[] = [
  {
    nome: 'Amoxicilina + clavulanato de potássio 250 mg',
    dose: '1',
    unidade: 'comprimido',
    frequencia: 'a cada 12 horas',
    duracaoDias: 7,
    instrucoes: 'Dar junto com a comida.',
  },
  {
    nome: 'Meloxicam 0,5 mg/ml',
    dose: '0,3',
    unidade: 'ml',
    frequencia: 'a cada 24 horas',
    duracaoDias: 3,
    instrucoes: null,
  },
  {
    nome: 'Ômega 3 (EPA + DHA)',
    dose: '1',
    unidade: 'cápsula',
    frequencia: '1x ao dia',
    duracaoDias: null,
    instrucoes: 'Uso contínuo.',
  },
]

export function criarLeitura(acessoId: string, arquivos: File[]) {
  const id = idDe('demo-leitura', LEITURAS.size + 1)
  LEITURAS.set(id, {
    id,
    acessoId,
    status: 'PROCESSANDO',
    criadaEm: Date.now(),
    anotacaoId: null,
    arquivos,
    urls: arquivos.map((f) => URL.createObjectURL(f)),
  })
  return id
}

/** A leitura leva uns segundos, como a de verdade. */
export function leituraAgora(leitura: LeituraDaDemo): LeituraReceitaParceiro {
  if (leitura.status === 'PROCESSANDO' && Date.now() - leitura.criadaEm > 3500) {
    leitura.status = 'AGUARDANDO_CONFIRMACAO'
  }
  const pronta = leitura.status !== 'PROCESSANDO'
  return {
    id: leitura.id,
    status: leitura.status,
    anotacaoId: leitura.anotacaoId,
    motivoFalha: null,
    mensagemFalha: null,
    itensFormulario: pronta ? ITENS_LIDOS.map((i) => ({ ...i })) : [],
    confianca: pronta
      ? [
          { nome: 'ALTA', dose: 'ALTA', frequencia: 'ALTA', duracaoDias: 'MEDIA' },
          { nome: 'ALTA', dose: 'MEDIA', frequencia: 'ALTA', duracaoDias: 'ALTA' },
          { nome: 'MEDIA', dose: 'ALTA', frequencia: 'MEDIA', duracaoDias: null },
        ]
      : [],
    avisos: pronta
      ? [
          {
            codigo: 'DURACAO_NAO_LIDA',
            mensagem:
              'A duração do Ômega 3 não está escrita na receita. Confira com o responsável.',
          },
        ]
      : [],
    arquivos: leitura.arquivos.map((f, i) => ({
      ordem: i + 1,
      mimetype: f.type || 'image/jpeg',
      url: leitura.urls[i] ?? '',
    })),
  }
}

/* --------------------------------------------------------------- os arquivos para abrir */

function escapar(texto: string) {
  return texto.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  )
}

/** Uma folha simples com o conteúdo do documento: é o que abre no lugar do PDF guardado. */
function folha(titulo: string, linhas: string[]) {
  const corpo = linhas.map((l) => `<p>${escapar(l)}</p>`).join('')
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(titulo)}</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;padding:0 24px;color:#10302A;line-height:1.6}h1{font-size:22px;border-bottom:2px solid #84C1B4;padding-bottom:8px}small{color:#5b6b66}</style></head><body><h1>${escapar(titulo)}</h1>${corpo}<p><small>${escapar(PARCEIRO_NOME)}</small></p></body></html>`
  return URL.createObjectURL(new Blob([html], { type: 'text/html' }))
}

/** A URL de um anexo de anotação ou de um documento do cofre, ou `null` se não existe. */
export function arquivoParaAbrir(tipo: 'anexo' | 'arquivo', id: string): string | null {
  if (tipo === 'arquivo') {
    const doc = ARQUIVOS.get(id)
    return doc ? folha(doc.titulo, doc.linhas) : null
  }
  const anexo = ANEXOS.get(id)
  if (!anexo) return null
  return anexo.arquivo ? URL.createObjectURL(anexo.arquivo) : folha(anexo.titulo, anexo.linhas)
}

/* ------------------------------------------------------------ o catálogo do Diário */

function opcoes(pares: Array<[string, string]>) {
  return pares.map(([value, label]) => ({ value, label }))
}

const CONSUMO = opcoes([
  ['MUITO', 'Muito'],
  ['NORMAL', 'Normal'],
  ['POUCO', 'Pouco'],
  ['NADA', 'Nada'],
  ['RECUSOU', 'Recusou'],
  ['VOMITOU_APOS', 'Vomitou depois'],
])

export const CATALOGO_DO_DIARIO: CatalogoDiario = {
  vitalidade: opcoes([
    ['AGITADO', 'Agitado'],
    ['ATIVO', 'Ativo'],
    ['NORMAL', 'Normal'],
    ['CALMO', 'Calmo'],
    ['SONOLENTO', 'Sonolento'],
    ['DESANIMADO', 'Desanimado'],
    ['APATICO', 'Apático'],
    ['LETARGICO', 'Letárgico'],
  ]),
  alimentacao: CONSUMO,
  hidratacao: CONSUMO,
  fezes: opcoes([
    ['NORMAL', 'Normal'],
    ['MOLE', 'Mole'],
    ['PASTOSA', 'Pastosa'],
    ['DIARREIA', 'Diarreia'],
    ['RESSECADA', 'Ressecada'],
    ['COM_SANGUE', 'Com sangue'],
    ['COM_MUCO', 'Com muco'],
    ['COM_VERMES', 'Com vermes'],
    ['ESCURA', 'Escura'],
    ['CLARA', 'Clara'],
    ['NAO_DEFECOU', 'Não fez'],
  ]),
  urina: opcoes([
    ['NORMAL', 'Normal'],
    ['MUITO', 'Muito'],
    ['POUCO', 'Pouco'],
    ['NADA', 'Nada'],
    ['COM_SANGUE', 'Com sangue'],
    ['ESCURA', 'Escura'],
    ['COM_DIFICULDADE', 'Com dificuldade'],
    ['COM_ODOR_FORTE', 'Com cheiro forte'],
  ]),
  sintomas: opcoes([
    ['VOMITO', 'Vômito'],
    ['DIARREIA', 'Diarreia'],
    ['TOSSE', 'Tosse'],
    ['ESPIRRO', 'Espirro'],
    ['COCEIRA', 'Coceira'],
    ['FALTA_DE_APETITE', 'Falta de apetite'],
    ['MANCANDO', 'Mancando'],
    ['OLHO_IRRITADO', 'Olho irritado'],
    ['QUEDA_DE_PELO', 'Queda de pelo'],
    ['FEBRE', 'Febre'],
  ]),
  temperamento: opcoes([
    ['DOCIL', 'Dócil'],
    ['BRINCALHAO', 'Brincalhão'],
    ['MEDROSO', 'Medroso'],
    ['AGITADO', 'Agitado'],
    ['ANSIOSO', 'Ansioso'],
    ['REATIVO', 'Reativo com outros animais'],
    ['MORDEU', 'Tentou morder'],
  ]),
}
