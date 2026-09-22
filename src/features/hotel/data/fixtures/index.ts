/**
 * Ponto único de leitura das fixtures — e mesmo assim **só o `seed` e o `store` importam daqui**.
 * Componente que importa fixture direto acopla a tela ao dado de mentira e não sobrevive à troca
 * pela API.
 */

export {
  HOTEL_UTC_OFFSET,
  acomodacoesFixture,
  blocosFixture,
  cuidadoresFixture,
  exigenciasFixture,
  hotelFixture,
  servicosFixture,
  tarifasFixture,
  temporadasFixture,
  type TemporadaSazonal,
} from './hotel'
export { petsFixture, tutorsFixture, type Pet, type Tutor } from './people'
