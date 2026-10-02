/**
 * Contratos de domínio do módulo hotel.
 *
 * Estes tipos são a forma da API futura: a camada mocada em `data/` os produz e os repositórios
 * os devolvem com a mesma assinatura que o backend terá. Componente nenhum conhece `fixtures` —
 * só estes contratos.
 *
 * Terminologia: `tutorId` / `Tutor` sobrevivem como identificador de código e campo de API. Em
 * texto visível em português o termo é sempre "responsável".
 *
 * O que **não** está aqui, de propósito: `Pet` e `Tutor`. Pet e responsável são cadastro da casa,
 * compartilhado entre os módulos do portal — o mesmo labrador que se consulta na clínica é o que
 * se hospeda no hotel. Duplicá-los aqui criaria dois cadastros que divergem no terceiro mês. Ver
 * `data/fixtures/people.ts`.
 */

import type {
  ClockTime,
  ISODate,
  ISODateTime,
  PetPorte,
  PetSpecies,
} from '@/features/clinico/data/types'

/**
 * Reexportados para que o módulo hotel tenha um ponto único de tipos, como o clínico tem.
 *
 * `ISODate` e `ClockTime` não são "tipos da clínica": são a forma como o portal inteiro escreve
 * data e hora de parede. Redeclará-los aqui criaria dois aliases idênticos que divergem no dia em
 * que alguém mudar um deles.
 */
export type { ClockTime, ISODate, ISODateTime, PetPorte, PetSpecies }

// ---------------------------------------------------------------------------
// A casa
// ---------------------------------------------------------------------------

/**
 * Um bloco físico do hotel.
 *
 * Existe porque a operação anda por bloco, não por acomodação: quem alimenta às 8h percorre o
 * canil inteiro, e a tela de rotina precisa poder se reduzir ao que aquela pessoa vai fazer. É
 * também o que separa o gatil do canil no mapa — e um gato que ouve latido a noite inteira não
 * come.
 */
export type Bloco = {
  id: string
  nome: string
  /**
   * O desenho, escolhido pela casa.
   *
   * Era um `kind` fechado — canil, gatil, área externa, isolamento —, que é a mesma imposição de
   * vocabulário que o tipo de acomodação tinha: "canil" e "gatil" pressupõem que a casa hospeda
   * cão e gato. O nome do corredor sempre foi dela; agora o resto também é.
   */
  icone: IconeDeAcomodacao
  /** Ordem de exibição no mapa. A casa tem uma ordem física, e a tela a respeita. */
  ordem: number
}

/**
 * O desenho de um tipo de acomodação.
 *
 * Esta lista é fechada e **é a única coisa nossa** que sobra no tipo: é vocabulário visual, não
 * vocabulário de negócio. A casa escolhe entre estes desenhos; o nome quem dá é ela.
 */
export type IconeDeAcomodacao =
  | 'casa'
  | 'cama'
  | 'gato'
  | 'cao'
  | 'grupo'
  | 'escudo'
  | 'arvore'
  | 'passaro'
  | 'coelho'

/**
 * Tipo de acomodação — **cadastrado pela casa**, não herdado de nós.
 *
 * Era uma união fechada: `suite | baia | gatil | coletiva | isolamento`. Cinco palavras nossas,
 * moldadas em cão e gato, impostas a quem abre a tela. Um hotel que chama as unidades de "chalé"
 * lia "Baia" e não se reconhecia; um que hospeda aves não tinha vocabulário nenhum — "gatil" e
 * "canil" não são nomes neutros, são a nossa suposição sobre que animais existem.
 *
 * O tipo continua decidindo **quem pode ficar onde**, mas por meio das espécies e do porte da
 * acomodação, que são dado. A regra de vaga nunca ramificou pelo nome do tipo — ela só o usa para
 * filtrar —, e é isso que torna a abertura segura: nenhuma decisão de negócio dependia da palavra.
 */
export type TipoDeAcomodacao = {
  id: string
  nome: string
  icone: IconeDeAcomodacao
  /** Ordem de exibição. A casa lista os tipos na ordem em que pensa neles. */
  ordem: number
}

/**
 * O que a acomodação oferece.
 *
 * Entra no dado porque é **argumento de venda e critério de escolha**: o responsável que paga
 * suíte paga pela câmera, e o hotel que oferece a acomodação errada num dia de 34 °C descobre
 * isso pela reclamação.
 */
export type RecursoDaAcomodacao =
  | 'camera'
  | 'climatizacao'
  | 'area-externa'
  | 'piso-aquecido'
  | 'janela'

/**
 * Por que uma acomodação saiu de operação.
 *
 * `kind`, e não texto livre, pelo mesmo motivo que o motivo de inatividade do leito: é o que
 * permite contar quantas diárias a casa perde por reforma num trimestre, e traduzir nos seis
 * idiomas. O caso concreto vai no `detalheInativa`, ao lado.
 */
export type AcomodacaoInativaMotivo =
  | 'manutencao'
  | 'desinfeccao'
  | 'reforma'
  | 'equipamento'
  | 'outro'

/**
 * Uma acomodação do hotel.
 *
 * **O sistema não adivinha como o hotel é.** Quem monta a casa é a operação: cadastra o que tem,
 * dá nome, e mexe nesse número quando cresce ou reforma. Por isso a acomodação é dado editável, e
 * não constante de código.
 */
export type Acomodacao = {
  id: string
  nome: string
  blocoId: string
  /** Aponta para um `TipoDeAcomodacao` cadastrado pela casa. */
  tipoId: string
  /**
   * Quantos animais **da mesma casa** cabem.
   *
   * Não é lotação de desconhecidos: dois cães que moram juntos dormem juntos, e separá-los é
   * pior para os dois. Capacidade maior que 1 é o que permite a reserva com acompanhante.
   */
  capacidade: number
  /** Porte máximo aceito. Um gigante numa baia de porte médio não deita esticado. */
  porteMaximo: PetPorte
  /** Espécies aceitas. Lista vazia significa qualquer uma — que na prática nunca é o caso. */
  especiesAceitas: PetSpecies[]
  recursos: RecursoDaAcomodacao[]
  /**
   * Minutos entre uma saída e a entrada seguinte.
   *
   * É a regra R2 virando número: lavar, secar e trocar a cama leva tempo, e uma vaga oferecida
   * dentro dessa janela é uma vaga que não existe. Zero é resposta válida para coletiva.
   */
  higienizacaoMinutos: number
  tarifaId: string
  ativa: boolean
  /** Só faz sentido com `ativa: false`. Nulo enquanto a acomodação está em operação. */
  motivoInativa: AcomodacaoInativaMotivo | null
  /** O caso concreto: "trocar o piso", "aguardando peça". Vazio quando o motivo basta. */
  detalheInativa: string
  /**
   * Desde quando está parada.
   *
   * É o que transforma "em manutenção" em informação: parada há duas horas é manutenção; parada
   * há três semanas é uma vaga que o hotel esqueceu que tinha.
   */
  inativaDesde: ISODateTime | null
}

// ---------------------------------------------------------------------------
// Preço
// ---------------------------------------------------------------------------

/**
 * Tabela de diárias.
 *
 * Tudo em **centavos**, inteiro. Guardar reais com casa decimal devolveria o erro de ponto
 * flutuante que centavos existem para evitar — e o total do orçamento deixaria de bater com o da
 * nota por alguns centavos, que é o tipo de diferença que faz o cliente parar de confiar na conta.
 */
export type Tarifa = {
  id: string
  nome: string
  /** Diária cheia por porte. O gigante ocupa mais espaço e come mais. */
  diariaPorPorte: Record<PetPorte, number>
  /**
   * Quanto custa o segundo animal da mesma casa, em percentual da diária cheia.
   *
   * Percentual e não valor fixo porque a diária varia por porte, e um desconto fixo viraria
   * gratuidade no porte mini.
   */
  acompanhantePercentual: number
}

/**
 * Período com preço diferente.
 *
 * Dezembro, julho, feriado prolongado. É acréscimo percentual sobre a diária, e não uma segunda
 * tabela, porque o que muda numa alta temporada é o multiplicador — manter duas tabelas faria a
 * casa esquecer de reajustar uma delas.
 */
export type Temporada = {
  id: string
  nome: string
  inicio: ISODate
  fim: ISODate
  acrescimoPercentual: number
}

export type ServicoKind =
  | 'banho'
  | 'tosa'
  | 'passeio-extra'
  | 'recreacao-individual'
  | 'transporte'
  | 'adestramento'
  | 'medicacao-assistida'

export type Servico = {
  id: string
  kind: ServicoKind
  precoCentavos: number
  /** Cobrado uma vez pela estadia, ou por diária. */
  porDiaria: boolean
  ativo: boolean
}

export type ServicoContratado = {
  servicoId: string
  quantidade: number
  /** Preço no momento da contratação. O reajuste de amanhã não altera o que foi combinado. */
  precoUnitarioCentavos: number
  observacao: string
  /**
   * Quando ele acontece. Ausente: o primeiro dia inteiro da estadia, que é o padrão de sempre.
   *
   * Existe para o serviço **vendido no meio da estadia** — o responsável liga na quarta e pede um
   * banho antes de buscar o animal na sexta. Sem isto, a geração jogaria esse banho no primeiro dia
   * inteiro, que já passou; e nada nasce no passado, então o banho simplesmente nunca apareceria na
   * prancheta de ninguém. Seria cobrado e não seria feito.
   */
  dia?: ISODate
  /** A hora escolhida. Ausente: a do catálogo (ver `HORA_DO_SERVICO`). */
  hora?: ClockTime
}

/**
 * Política da casa sobre horário e sinal.
 *
 * Vive no cadastro e não em constante porque é **a regra que mais gera discussão no balcão**, e
 * discussão de balcão se resolve mostrando a regra na tela antes de o cliente chegar.
 */
export type PoliticaDoHotel = {
  /** Depois deste horário a saída começa a custar. */
  horarioDeSaida: ClockTime
  /** Até aqui, meia diária; passou, diária cheia. */
  limiteMeiaDiaria: ClockTime
  meiaDiariaPercentual: number
  /** A partir de que horas a entrada do dia é aceita. */
  horarioDeEntrada: ClockTime
  /** Percentual da estadia cobrado como sinal para confirmar a reserva. */
  sinalPercentual: number
  /** Cancelamento com mais dias que isto devolve o sinal. */
  cancelamentoSemCustoDias: number
}

export type Hotel = {
  id: string
  nome: string
  endereco: string
  telefone: string
  /** Offset fixo da parede do hotel. Toda conversão de tempo passa por aqui. */
  utcOffset: string
  politica: PoliticaDoHotel
}

// ---------------------------------------------------------------------------
// Equipe
// ---------------------------------------------------------------------------

export type FuncaoDaEquipe =
  | 'recepcao'
  | 'cuidador'
  | 'banhista'
  | 'adestrador'
  | 'veterinario'
  | 'gerente'

/**
 * Quem trabalha na casa.
 *
 * Toda execução de tarefa, toda ocorrência e toda passagem de turno carregam um nome daqui — é o
 * que permite responder "quem estava com ele às três da manhã", que é a pergunta que ninguém faz
 * até o dia em que precisa.
 */
export type Cuidador = {
  id: string
  nome: string
  iniciais: string
  funcao: FuncaoDaEquipe
  /** Índice na escala de cores (0..5). Nunca uma cor literal. */
  corIndice: number
  ativo: boolean
}

export type TurnoKind = 'manha' | 'tarde' | 'noite'

/**
 * Um turno do hotel.
 *
 * A passagem é o momento em que a informação mais se perde numa hospedagem, e o protótipo a trata
 * como registro e não como conversa: `entregueEm` e `recebidoPor` existem para que haja resposta
 * quando alguém perguntar quem estava com o animal.
 */
export type Turno = {
  id: string
  kind: TurnoKind
  inicio: ISODateTime
  fim: ISODateTime
  responsavelId: string
  /** Nulo enquanto o turno está aberto. */
  entregueEm: ISODateTime | null
  recebidoPor: string | null
  notaDePassagem: string
  /**
   * Tarefas que o turno **não** fechou e passou adiante, congeladas na entrega.
   *
   * Congeladas porque a lista precisa dizer o que estava pendente **naquele instante**;
   * recalculada depois, mostraria a pendência já resolvida pelo turno seguinte, e a passagem
   * perderia o sentido.
   */
  pendenciasEntregues: string[]
}

// ---------------------------------------------------------------------------
// Exigências de admissão
// ---------------------------------------------------------------------------

/**
 * O que a casa exige para aceitar um hóspede.
 *
 * É **dado e não constante de código** porque varia entre hotéis e muda com a legislação local:
 * um hotel de São Paulo exige gripe canina, um do interior pode não exigir, e a lista precisa
 * mudar sem republicar o portal.
 */
export type ExigenciaKind =
  | 'vacina-polivalente'
  | 'vacina-antirrabica'
  | 'vacina-tosse-canis'
  | 'vacina-giardia'
  | 'vermifugo'
  | 'antipulgas'
  | 'exame-parasitologico'
  | 'termo-responsabilidade'

export type Exigencia = {
  kind: ExigenciaKind
  /** Espécies a que se aplica. Antirrábica vale para cão e gato; tosse dos canis, só para cão. */
  especies: PetSpecies[]
  /** Quantos meses o comprovante vale. `null` é documento sem validade (o termo assinado). */
  validadeMeses: number | null
  /**
   * Vencida impede a entrada, ou apenas avisa?
   *
   * Nem toda exigência é da mesma natureza. A antirrábica é lei; o antipulgas é boa prática. Tratar
   * as duas como bloqueio faria o balcão dispensar as duas com a mesma leveza — e a dispensa que
   * vira rotina deixa de ser decisão.
   */
  bloqueia: boolean
}

/**
 * Um comprovante apresentado.
 *
 * É registro **do hotel**, e não leitura da carteira clínica, de propósito: a maioria dos hóspedes
 * se vacina em outro lugar, e um hotel que só soubesse ler a carteira da própria clínica recusaria
 * quem está em dia. Quando o animal também é paciente da casa, o comprovante nasce pré-preenchido
 * — mas quem responde por ele continua sendo o registro daqui.
 */
export type Comprovante = {
  id: string
  petId: string
  kind: ExigenciaKind
  apresentadoEm: ISODate
  /** `null` para documento sem validade. */
  validoAte: ISODate | null
  /** Identificação do papel: lote da vacina, número da receita, nome do arquivo. */
  documento: string
  observacao: string
}

/**
 * Dispensa nominal de uma exigência, para uma reserva.
 *
 * Existe porque a alternativa é pior. Sem ela, o hotel que decide aceitar um hóspede sem um
 * comprovante faz isso **fora do sistema**, e some o registro de que alguém decidiu, quem decidiu
 * e por quê. A dispensa nominal transforma uma burla numa decisão auditável.
 */
export type DispensaDeExigencia = {
  kind: ExigenciaKind
  motivo: string
  autorizadaPor: string
  autorizadaEm: ISODateTime
}

/**
 * Situação de uma exigência, calculada contra o **último dia da estadia**.
 *
 * `vence-durante` é o estado que dá razão a este tipo existir. Checar contra hoje aprovaria uma
 * antirrábica que vence no dia 27 para uma reserva que sai no dia 30 — e o problema apareceria no
 * dia 27, com o responsável a 600 km dali.
 */
export type SituacaoDaExigencia = 'ok' | 'vence-durante' | 'vencido' | 'ausente' | 'dispensado'

// ---------------------------------------------------------------------------
// Reserva
// ---------------------------------------------------------------------------

/**
 * Estados de uma reserva.
 *
 * `nao-compareceu` é distinto de `cancelada` pelo mesmo motivo que falta é distinta de
 * cancelamento na agenda clínica: um é aviso — alguém decidiu antes e a casa pôde revender —, o
 * outro é vaga queimada. Só o segundo tem política de sinal, e juntá-los tornaria impossível saber
 * quanto a casa perde por ano com quem simplesmente não aparece.
 */
export type ReservaStatus =
  | 'pendente'
  | 'confirmada'
  | 'hospedado'
  | 'encerrada'
  | 'cancelada'
  | 'nao-compareceu'

export type ReservaOrigem = 'balcao' | 'telefone' | 'whatsapp' | 'app' | 'retorno' | 'indicacao'

export type MotivoDeCancelamento =
  | 'responsavel-desistiu'
  | 'viagem-cancelada'
  | 'animal-doente'
  | 'hotel-indisponivel'
  | 'preco'
  | 'outro'

/**
 * Uma linha do orçamento.
 *
 * O orçamento é uma lista e não um total porque **um total sozinho é uma conta que o cliente não
 * confere e a recepção não defende**. Cada linha diz o que é, quantas vezes e quanto — e a soma
 * acontece à vista.
 */
export type LinhaDoOrcamento = {
  kind: 'diaria' | 'acompanhante' | 'temporada' | 'servico' | 'meia-diaria' | 'desconto'
  /** `kind` do serviço, quando a linha é de serviço. A tela traduz; nada de texto pronto. */
  servicoKind: ServicoKind | null
  quantidade: number
  valorUnitarioCentavos: number
  totalCentavos: number
}

export type Orcamento = {
  linhas: LinhaDoOrcamento[]
  totalCentavos: number
  sinalCentavos: number
  /** Total menos o que já foi pago. É o número que o balcão cobra na saída. */
  saldoCentavos: number
}

export type Reserva = {
  id: string
  petId: string
  tutorId: string
  /** Segundo animal da mesma casa, na mesma acomodação. `null` no caso normal. */
  acompanhantePetId: string | null
  acomodacaoId: string
  entradaPrevista: ISODateTime
  saidaPrevista: ISODateTime
  /**
   * Diárias contadas pela regra da casa, não por diferença de datas.
   *
   * Guardado e não derivado porque a regra pode mudar, e uma reserva vendida com sete diárias
   * continua valendo sete mesmo que a casa passe a contar diferente no mês seguinte.
   */
  diarias: number
  status: ReservaStatus
  origem: ReservaOrigem
  servicos: ServicoContratado[]
  orcamento: Orcamento
  /** Quanto já entrou. Sinal e pagamentos parciais somam aqui. */
  pagoCentavos: number
  /** O que o responsável contou e não cabe em campo: "tem medo de trovão". */
  observacao: string
  /**
   * Quem, além do responsável, pode retirar o animal.
   *
   * Combinado na reserva porque é quando a pessoa está disponível para dizer — descobrir no balcão
   * que quem veio buscar não é o responsável, com o animal já pronto, é a conversa que ninguém
   * quer ter. A conferência acontece no check-out, e o nome de quem retirou fica gravado.
   *
   * Lista vazia significa "só o responsável".
   */
  autorizadosARetirar: string[]
  dispensas: DispensaDeExigencia[]
  criadoEm: ISODateTime
  atualizadoEm: ISODateTime
  canceladaEm: ISODateTime | null
  motivoCancelamento: MotivoDeCancelamento | null
}

/**
 * Quem quer um intervalo que está lotado.
 *
 * Alta temporada lota, e reserva cai. Sem esta fila, a vaga que abre no dia 18 de dezembro é
 * vendida para quem ligar por acaso, e não para quem pediu primeiro.
 */
export type EsperaStatus = 'aguardando' | 'ofertada' | 'convertida' | 'desistiu' | 'expirada'

export type EntradaDeEspera = {
  id: string
  petId: string
  tutorId: string
  entradaDesejada: ISODate
  saidaDesejada: ISODate
  /** Tipos aceitos, por id. Vazio significa qualquer um que caiba no porte. */
  tiposAceitos: string[]
  status: EsperaStatus
  criadoEm: ISODateTime
  /** Quando a vaga foi oferecida, e até quando a oferta vale. */
  ofertadaEm: ISODateTime | null
  ofertaExpiraEm: ISODateTime | null
  observacao: string
}

// ---------------------------------------------------------------------------
// Estadia
// ---------------------------------------------------------------------------

/**
 * Um pertence que entrou com o hóspede.
 *
 * A regra R4 vira este tipo: o que entrou tem que sair. Pertence perdido é a reclamação mais
 * barata de evitar — custa uma linha no check-in — e a mais cara de resolver.
 */
export type Pertence = {
  id: string
  descricao: string
  quantidade: number
  /** Marcado na conferência de saída. */
  devolvido: boolean
  /** Quando não foi devolvido: o que houve. Sem isto, o check-out não fecha. */
  observacao: string
}

/**
 * O que o hóspede come.
 *
 * `racaoPropria` importa mais do que parece: trocar a ração de um animal ansioso longe de casa
 * produz diarreia no segundo dia, e o hotel leva a culpa por uma mudança que o responsável pediu.
 */
export type PlanoAlimentar = {
  racaoPropria: boolean
  marca: string
  porcaoGramas: number
  /** Horários das refeições, na parede do hotel. */
  horarios: ClockTime[]
  restricoes: string
  petiscos: string
}

export type ViaDeMedicacao = 'oral' | 'topica' | 'otologica' | 'oftalmica' | 'subcutanea'

/**
 * Medicação que o hóspede já usava e continua usando.
 *
 * Não é prescrição: o hotel **não prescreve**. É a continuidade de um tratamento decidido fora,
 * com a receita como documento de respaldo. Por isso `receita` é campo e não observação — sem ela,
 * o hotel administra medicamento por conta própria.
 */
export type MedicacaoDaEstadia = {
  id: string
  hospedagemId: string
  descricao: string
  via: ViaDeMedicacao
  doseTexto: string
  horarios: ClockTime[]
  inicio: ISODate
  /** `null` é "durante toda a estadia". */
  fim: ISODate | null
  receita: string
  observacao: string
  suspensaEm: ISODateTime | null
}

/**
 * Um cuidado recorrente deste hóspede, que não é remédio nem serviço.
 *
 * Tem a forma de `MedicacaoDaEstadia` de propósito — descrição, horários, janela e um campo para
 * encerrar sem apagar — porque as duas respondem à mesma pergunta: *o que este animal precisa que
 * os outros não precisam, e a que horas*. O que as separa é o que **não** está aqui: não há dose,
 * não há via e não há receita.
 *
 * Essa ausência é a regra, não um campo esquecido. Pomada, colírio e comprimido entram por
 * `MedicacaoDaEstadia`, onde a dose é obrigatória e a receita é o documento de respaldo — o hotel
 * administra medicamento de outra pessoa, e precisa poder provar com o quê e por ordem de quem.
 */
export type CuidadoDaEstadia = {
  id: string
  hospedagemId: string
  /** O que fazer, em palavras de quem executa: "trocar o curativo da pata direita". */
  descricao: string
  horarios: ClockTime[]
  inicio: ISODate
  /** `null` é "durante toda a estadia". */
  fim: ISODate | null
  observacao: string
  encerradoEm: ISODateTime | null
}

/**
 * O que o responsável autorizou.
 *
 * Cada uma é um sim ou não registrado, com data — e não um parágrafo de termo que ninguém lê. É a
 * diferença entre "o termo dizia" e "ele marcou não no dia 12".
 */
export type AutorizacaoKind =
  | 'banho'
  | 'passeio-externo'
  | 'recreacao-em-grupo'
  | 'foto-em-rede-social'
  | 'atendimento-veterinario'
  | 'transporte'

export type Autorizacao = {
  kind: AutorizacaoKind
  concedida: boolean
  /** Teto de gasto autorizado, em centavos. Só faz sentido no atendimento veterinário. */
  limiteCentavos: number | null
  registradaEm: ISODateTime
}

export type HospedagemStatus = 'hospedado' | 'encerrada'

/**
 * Como o hóspede está se dando.
 *
 * Três degraus, e o do meio é o que importa: um animal "em adaptação" no terceiro dia é uma
 * conversa com o responsável; no primeiro, é o normal.
 */
export type Adaptacao = 'tranquilo' | 'em-adaptacao' | 'estressado'

export type Hospedagem = {
  id: string
  reservaId: string
  petId: string
  tutorId: string
  acomodacaoId: string
  entradaEm: ISODateTime
  saidaPrevistaEm: ISODateTime
  saidaEm: ISODateTime | null
  status: HospedagemStatus
  /** Peso na entrada. É a referência da dose e a prova do que o animal perdeu ou ganhou. */
  pesoEntradaKg: number
  pesoSaidaKg: number | null
  /** O que foi visto na inspeção de chegada: carrapato, ferida, claudicação. */
  inspecaoDeEntrada: string
  pertences: Pertence[]
  planoAlimentar: PlanoAlimentar
  autorizacoes: Autorizacao[]
  contatoEmergencia: string
  /** Veterinário de confiança do responsável — quem se liga antes do plantão desconhecido. */
  veterinarioDeConfianca: string
  adaptacao: Adaptacao
  observacao: string
  /** Quem fez o check-in, e quem fez o check-out. São pessoas **do hotel**. */
  recebidoPor: string
  entreguePor: string | null
  /**
   * Quem, da família, levou o animal embora.
   *
   * Diferente de `entreguePor`, que é o funcionário. Esta é a outra ponta do gesto, e não existia:
   * o sistema sabia qual atendente entregou e não sabia **a quem**. Vazio enquanto a estadia está
   * aberta.
   */
  retiradoPor: string
}

// ---------------------------------------------------------------------------
// Rotina
// ---------------------------------------------------------------------------

/**
 * O que se faz por um hóspede num dia.
 *
 * `banho`, `tosa`, `recreacao` e `adestramento` são os **serviços vendidos** virando trabalho.
 * Antes eles existiam no catálogo de preço e não na prancheta: cobrava-se o banho e ninguém era
 * avisado de dar o banho.
 */
export type TarefaKind =
  | 'refeicao'
  | 'medicacao'
  | 'passeio'
  | 'recreacao'
  | 'higiene'
  | 'agua'
  | 'pesagem'
  | 'banho'
  | 'tosa'
  | 'adestramento'
  /**
   * O cuidado deste hóspede: o curativo que se troca, a compressa, o casaco à noite.
   *
   * Existe porque havia um buraco entre três coisas que já existiam. Não é **medicação** — não tem
   * dose, via nem receita, e por isso não pode entrar por aquela porta. Não é **serviço vendido** —
   * ninguém cobra por trocar um curativo. E não é **rotina da casa** — vale para um animal só.
   *
   * Sem ele, esse trabalho ou não era registrado, ou era registrado como remédio, que é pior:
   * produz uma linha de medicação sem dose e sem receita no prontuário de um animal.
   */
  | 'cuidado'

/**
 * O que a **casa** faz por todos os hóspedes, e portanto o que a casa pode cadastrar.
 *
 * Este recorte é a parede do gerenciamento de rotinas, e existe como tipo — e não como uma
 * verificação em algum lugar — para que atravessá-lo seja **erro de compilação**. Uma regra
 * escrita num `if` some numa refatoração de sexta-feira sem ninguém notar; um `Extract` não some.
 *
 * Quem fica de fora, e por quê:
 *
 * - **`refeicao`** — os horários vêm de `PlanoAlimentar.horarios`, que é o que o responsável
 *   ditou na entrada. A casa não decide a que horas o animal de outra pessoa come.
 * - **`medicacao`** — o hotel **não prescreve** (ver `MedicacaoDaEstadia`). Horário e dose saem da
 *   receita, e nenhum cadastro de rotina pode criá-los, alterá-los ou removê-los.
 * - **`banho`, `tosa`, `recreacao`, `adestramento`** — são serviços **vendidos**, e nascem do que
 *   foi contratado na reserva. Um template que os criasse produziria trabalho que ninguém cobrou,
 *   e um que os retirasse apagaria serviço já pago.
 *
 * `pesagem` entra, e é a primeira vez que este `kind` fica alcançável: ele já tinha ícone e nunca
 * teve gerador.
 */
export type TarefaDaCasaKind = Extract<
  TarefaKind,
  'agua' | 'higiene' | 'passeio' | 'pesagem'
>

/** Os quatro, em ordem de leitura. A tela não inventa a própria ordem. */
export const TAREFAS_DA_CASA: TarefaDaCasaKind[] = ['agua', 'higiene', 'passeio', 'pesagem']

export function ehTarefaDaCasa(kind: TarefaKind): kind is TarefaDaCasaKind {
  return (TAREFAS_DA_CASA as TarefaKind[]).includes(kind)
}

/**
 * Uma linha da rotina padrão: um serviço da casa e os horários em que ele acontece.
 *
 * `ativo` existe em vez de simplesmente apagar a linha porque desligar a pesagem por um mês e
 * religá-la depois não pode custar redigitar os horários — e porque uma linha apagada não conta a
 * história de que a casa já fez aquilo.
 */
export type ItemDeRotina = {
  id: string
  kind: TarefaDaCasaKind
  horarios: ClockTime[]
  /**
   * A autorização sem a qual este item não vira tarefa para um hóspede.
   *
   * Passeio é o caso: o responsável autoriza ou não, e **a casa não decide isso por ninguém**.
   * Sem a autorização concedida, o item existe no cadastro e simplesmente não gera tarefa
   * para aquele animal — não é erro, não é aviso, é o consentimento funcionando.
   */
  exigeAutorizacao: AutorizacaoKind | null
  ativo: boolean
}

/**
 * A rotina que a casa faz por todos os hóspedes.
 *
 * Era três constantes dentro de `domain/rotina.ts`, com um comentário explicando que virariam
 * cadastro quando alguém pedisse. Alguém pediu.
 *
 * **Uma só, sem escopo por espécie nem por bloco.** Dois templates que casam com o mesmo animal
 * exigem uma regra de precedência, e regra de precedência sem ninguém pedindo é exatamente a
 * dívida que este tipo está pagando. Quando a casa precisar de rotina diferente por bloco, ela
 * vai dizer qual ganha.
 *
 * `versao` sobe a cada publicação e não é decoração: é o que permite a uma tarefa materializada
 * ontem conviver com o plano de hoje sem ninguém precisar decidir qual das duas mente.
 */
export type RotinaPadrao = {
  id: string
  versao: number
  itens: ItemDeRotina[]
  /** A partir de quando vale. Nada antes disto é tocado, nunca. */
  vigenteDesde: ISODateTime
  publicadaEm: ISODateTime
  publicadaPor: string
}

/**
 * O que muda na rotina **de um hóspede específico**.
 *
 * A rotina da casa vale para todos; isto é a exceção, e exceção sem motivo escrito é exceção que
 * ninguém sabe desfazer em dezembro. Por isso `motivo` é campo obrigatório e não observação.
 *
 * `revogadoEm` é a lição de `MedicacaoDaEstadia.suspensaEm`, que mora neste mesmo arquivo:
 * encerrar não pode ser apagar a linha que carrega o porquê. "Nina sem passeio enquanto se adapta"
 * precisa terminar no terceiro dia **e** continuar explicando por que existiu.
 *
 * O `kind` é `TarefaDaCasaKind`: um ajuste é fisicamente incapaz de mexer em refeição ou medicação.
 */
export type AjusteDeRotina = {
  id: string
  hospedagemId: string
  kind: TarefaDaCasaKind
  /** `suspende` é `substitui` com lista vazia, mas escrito — é o que aparece no histórico. */
  acao: 'substitui' | 'suspende'
  horarios: ClockTime[]
  motivo: string
  /** De onde veio o aceite: alguém digitou, ou alguém aprovou uma sugestão. */
  origem: 'pessoa' | 'proposta'
  registradoEm: ISODateTime
  registradoPor: string
  revogadoEm: ISODateTime | null
}

/**
 * O registro de uma publicação, para que ela possa ser desfeita.
 *
 * Guarda os itens **anteriores** e os ids que nasceram. Não guarda o que foi retirado, e isso é
 * de propósito: desfazer devolve o template à versão anterior, e a materialização recria sozinha
 * o que aquela versão previa. Ressuscitar registros seria uma segunda verdade sobre o mesmo dia.
 */
export type PublicacaoDeRotina = {
  id: string
  versao: number
  itensAnteriores: ItemDeRotina[]
  /** Ids das tarefas criadas por esta publicação. Só elas podem ser removidas ao desfazer. */
  criadas: string[]
  retiradas: number
  em: ISODateTime
  por: string
}

/**
 * Situação **persistida** de uma tarefa.
 *
 * `atrasada` não está aqui de propósito: atraso é uma leitura do relógio contra o horário
 * previsto, e gravá-lo produziria um registro que envelhece errado — a refeição marcada como
 * atrasada às 8h continuaria atrasada depois de servida às 8h10. Ver `situacaoDaTarefa()`.
 *
 * `recusada` não é `pulada`. Pular é decisão da casa; recusar é o animal não ter comido, e **isso
 * é informação clínica** — alimenta o boletim e, repetido, vira ocorrência.
 */
export type TarefaStatus = 'pendente' | 'feita' | 'recusada' | 'pulada'

export type SituacaoDaTarefa = 'futura' | 'na-janela' | 'atrasada' | 'feita' | 'recusada' | 'pulada'

export type TarefaDeRotina = {
  id: string
  hospedagemId: string
  kind: TarefaKind
  /** O que quem está no canil lê na prancheta. Para medicação, a dose já escrita. */
  descricao: string
  /** De onde a tarefa nasceu, quando nasceu de um registro: a medicação da estadia. */
  origemId: string | null
  previstaPara: ISODateTime
  status: TarefaStatus
  executadaEm: ISODateTime | null
  /** Quem executou. Não é quem planejou, e a diferença é o ponto do registro. */
  executadaPor: string | null
  turnoId: string | null
  observacao: string
}

// ---------------------------------------------------------------------------
// Diário, ocorrência e boletim
// ---------------------------------------------------------------------------

export type RegistroKind =
  | 'refeicao'
  | 'passeio'
  | 'brincadeira'
  | 'sono'
  | 'eliminacao'
  | 'banho'
  | 'carinho'
  | 'observacao'

/**
 * Uma entrada do diário do hóspede.
 *
 * É o conteúdo do boletim e o motivo pelo qual o responsável recontrata. O hotel vende diária; o
 * que o cliente compra é saber que o animal está bem, e o diário é a única prova disso.
 */
export type RegistroDoDiario = {
  id: string
  hospedagemId: string
  kind: RegistroKind
  texto: string
  /** Iniciais que o mock desenha no lugar da foto; a API trará a URL. */
  foto: string | null
  registradoEm: ISODateTime
  registradoPor: string
  turnoId: string | null
}

export type OcorrenciaKind =
  | 'briga'
  | 'tentativa-de-fuga'
  | 'lesao'
  | 'vomito'
  | 'diarreia'
  | 'recusa-alimentar'
  | 'apatia'
  | 'tosse'
  | 'estresse'
  | 'destruicao'
  | 'outro'

/**
 * Gravidade de uma ocorrência.
 *
 * É o campo que aciona a regra R3: `grave` exige contato por voz com o responsável antes do fim do
 * turno, e trava a passagem enquanto não houver. Leve e moderada vão para o diário e viram
 * conteúdo do boletim do dia.
 */
export type GravidadeDaOcorrencia = 'leve' | 'moderada' | 'grave'

export type Ocorrencia = {
  id: string
  hospedagemId: string
  kind: OcorrenciaKind
  gravidade: GravidadeDaOcorrencia
  descricao: string
  /** O que a casa fez a respeito. Ocorrência sem conduta é fofoca. */
  conduta: string
  registradaEm: ISODateTime
  registradaPor: string
  /**
   * Contato com o responsável, e o instante em que aconteceu.
   *
   * Duas informações e não uma: `exigeContato` sem `contatoEm` é a ocorrência travada, e é esse
   * par que a tela precisa mostrar para que o travamento seja compreensível em vez de parecer um
   * defeito.
   */
  exigeContato: boolean
  contatoEm: ISODateTime | null
  contatoPor: string | null
  /** Levado ao veterinário de retaguarda. */
  encaminhadaAoVeterinario: boolean
}

export type BoletimStatus = 'rascunho' | 'retido' | 'enviado'

/**
 * O boletim que sai para o responsável.
 *
 * `retido` existe pela regra R3: um boletim que carrega ocorrência grave **não sai sozinho** —
 * fica retido até alguém da casa ligar. Notícia ruim chegando por notificação de aplicativo, sem
 * voz humana antes, é a forma mais rápida de transformar um diferencial de produto num processo.
 *
 * O texto é montado no repositório, em português, e não na apresentação. Parece contradizer a
 * disciplina do módulo (`kind` viaja, texto se traduz), e não contradiz: o boletim **não é
 * interface**, é uma mensagem endereçada ao responsável, escrita no idioma dele e congelada no
 * envio. O idioma da tela do hotel não tem nada a ver com o idioma em que a Rita lê que o gato
 * dela não comeu.
 */
export type Boletim = {
  id: string
  hospedagemId: string
  status: BoletimStatus
  texto: string
  fotos: string[]
  geradoEm: ISODateTime
  /** Quem compôs ou revisou. `null` em boletim automático que ninguém tocou. */
  autorId: string | null
  enviadoEm: ISODateTime | null
  exigeContato: boolean
  contatoEm: ISODateTime | null
}

/**
 * Frequência com que o responsável recebe boletim.
 *
 * Menor que 12 h não existe aqui, ao contrário da internação: hotel não é UTI, e um boletim de
 * hora em hora sobre um animal que está bem ensina o responsável a não ler nenhum.
 */
export type FrequenciaDeBoletim = 12 | 24 | 48

export type PreferenciaDeBoletim = {
  hospedagemId: string
  frequenciaHoras: FrequenciaDeBoletim
  fotoSempre: boolean
}
