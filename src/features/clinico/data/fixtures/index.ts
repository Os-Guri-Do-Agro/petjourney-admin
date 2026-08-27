/**
 * Ponto único de leitura das fixtures — e mesmo assim **só o `seed` e o `store` importam
 * daqui**. Componente que importa fixture direto acopla a tela ao dado de mentira e não
 * sobrevive à troca pela API.
 */
export {
  CLINIC_UTC_OFFSET,
  appointmentTypesFixture,
  clinicFixture,
  professionalsFixture,
  roomsFixture,
} from './clinic'
export { petsFixture, tutorsFixture } from './people'
export { diagnosisCatalogFixture, examCatalogFixture } from './catalogs'
export { medicationsFixture } from './medications'
export { referenceRangesFixture, unidadePorVital } from './reference-ranges'
