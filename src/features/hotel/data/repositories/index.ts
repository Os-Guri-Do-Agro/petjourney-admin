/**
 * A fronteira do módulo.
 *
 * Tudo o que as telas conhecem da camada de dados passa por aqui. Quando a API existir, o que muda
 * são os arquivos atrás deste índice — as assinaturas são as definitivas.
 */

export { catalogoRepository, type CatalogosDoHotel } from './catalogo-repository'
export {
  rotinaPadraoRepository,
  propostaRepository,
  amanhaNaCasa,
  ajustesDoHospede,
  hospedesParaRotina,
  type HospedeParaRotina,
} from './rotina-repository'
export {
  reservaRepository,
  AdmissaoBloqueadaError,
  VagaIndisponivelError,
  type FaixaNaGrade,
  type GradeDeOcupacao,
  type HospedeNovo,
  type LinhaDaGrade,
  type MapaDoPeriodo,
  type ReservaDetalhada,
  type ReservaNaLista,
} from './reserva-repository'
export {
  hospedagemRepository,
  BoletimRetidoError,
  PassagemTravadaError,
  SaidaBloqueadaError,
  pertencesPendentes,
  situacaoDaTarefa,
  type EstadiaDetalhada,
  type HospedeNaCasa,
  type PassagemDeTurno,
  type TarefaNaPrancheta,
} from './hospedagem-repository'
export {
  acomodacaoRepository,
  CadastroRecusadoError,
  type ImpedimentoDeCadastro,
} from './acomodacao-repository'
export {
  resumoRepository,
  type ContagemDeOcorrencia,
  type FatiaDeServico,
  type FatiaPorOrigem,
  type PontoDeOcupacao,
  type ResumoDoHotel,
} from './resumo-repository'
export { tomDaRotinaAtrasada } from '../../domain/rotina'
