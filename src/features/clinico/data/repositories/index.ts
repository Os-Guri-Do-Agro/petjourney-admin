export {
  agendaRepository,
  type EntradaDeJustificativa,
  type MutacaoAgenda,
} from './agenda-repository'
export { encounterRepository, EncounterLockedError } from './encounter-repository'
export {
  waitlistRepository,
  OFERTA_MINUTOS,
  OfertaExpiradaError,
  VagaJaPreenchidaError,
} from './waitlist-repository'
export {
  patientRepository,
  LIMITE_REINCIDENCIA,
  type FaltaDetalhada,
  type PacienteResumo,
} from './patient-repository'
export { catalogRepository, type CatalogosClinicos } from './catalog-repository'
export {
  migracaoRepository,
  type ResultadoDaLinha,
  type VinculosDaImportacao,
} from './migracao-repository'
export {
  vacinaRepository,
  AplicacaoRecusadaError,
  type AplicacaoNaLista,
  type CarteirinhaNoApp,
  type ChamadaDeVacina,
  type ProximaNaAgenda,
} from './vacina-repository'
export {
  internacaoRepository,
  AltaSemAvisoError,
  BoletimBloqueadoError,
  LeitoOcupadoError,
  LeitoRecusadoError,
  type MapaDeInternacao,
  type LeitoNoMapa,
  type PacienteInternado,
  type PassagemDePlantao,
} from './internacao-repository'
