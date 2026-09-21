export {
  agendaRepository,
  type EntradaDeJustificativa,
  type MutacaoAgenda,
} from './agenda-repository'
export {
  encounterRepository,
  EncounterLockedError,
} from './encounter-repository'
export { waitlistRepository, OFERTA_MINUTOS } from './waitlist-repository'
export {
  patientRepository,
  LIMITE_REINCIDENCIA,
  type FaltaDetalhada,
  type PacienteResumo,
} from './patient-repository'
export { catalogRepository, type CatalogosClinicos } from './catalog-repository'
export { vacinaRepository, type AplicacaoNaLista, type ChamadaDeVacina } from './vacina-repository'
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
