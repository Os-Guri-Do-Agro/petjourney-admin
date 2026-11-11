/**
 * Lacunas N22/N34: algumas listas do portal recusam `?parceiroId=` (400 "property parceiroId should
 * not exist") e usam o parceiro ativo do token. O claim `parceiroAtivoId` falta no login normal e
 * fica para trás quando a empresa troca sem token novo — e aí o `parceiroId` ia na query e a lista
 * dava 400.
 *
 * Aqui, antes dessas chamadas, o token é realinhado à empresa em uso (`/auth/trocar-perfil`), e o
 * `parceiroId` sai da query. Se o realinhamento falhar, ele vai junto como antes: melhor um 400 do
 * que a caixa de outra empresa.
 */
import { trocarParaParceiro } from '../auth/auth-service'
import { getAuthUser } from '../auth/auth-session'

let alinhando: { parceiroId: string; promessa: Promise<boolean> } | null = null

function alinharToken(parceiroId: string) {
  if (alinhando?.parceiroId === parceiroId) return alinhando.promessa

  const promessa = trocarParaParceiro(parceiroId)
    .then(() => getAuthUser()?.parceiroAtivoId === parceiroId)
    .catch(() => false)
    .finally(() => {
      if (alinhando?.promessa === promessa) alinhando = null
    })
  alinhando = { parceiroId, promessa }

  return promessa
}

/** O `parceiroId` que ainda vai na query: `undefined` quando o token já responde por ele. */
export async function parceiroPeloToken(parceiroId?: string | null) {
  if (!parceiroId) return parceiroId
  if (getAuthUser()?.parceiroAtivoId === parceiroId) return undefined

  return (await alinharToken(parceiroId)) ? undefined : parceiroId
}
