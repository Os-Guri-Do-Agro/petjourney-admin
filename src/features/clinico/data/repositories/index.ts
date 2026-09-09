export { agendaRepository, type MutacaoAgenda } from './agenda-repository'
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
export { vacinaRepository, type ChamadaDeVacina } from './vacina-repository'
export {
  internacaoRepository,
  BoletimBloqueadoError,
  LeitoOcupadoError,
  LeitoRecusadoError,
  type MapaDeInternacao,
  type LeitoNoMapa,
  type PacienteInternado,
  type PassagemDePlantao,
} from './internacao-repository'
