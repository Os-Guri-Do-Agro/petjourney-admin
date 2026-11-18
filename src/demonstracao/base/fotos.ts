/**
 * As fotos dos pets da demonstração: todo pet tem retrato, escolhido pela espécie e pela raça.
 *
 * São fotos livres do Wikimedia Commons, recortadas em quadrado de 256 px, em
 * `public/demo/pacientes/` (autor, original e licença de cada uma em `CREDITOS.md`, ao lado). Os
 * nove retratos que já existiam (Pérola, Mel, Pipoca...) continuam com os pets deles.
 *
 * Cada grupo é usado em rodízio, na ordem em que os pets nascem na base: os protagonistas (as 45
 * famílias escritas à mão) vêm primeiro e ficam com fotos que não se repetem entre eles; a base
 * gerada repete fotos, como é inevitável com uns 500 pets.
 */
import type { Paciente } from '@/service/parceiro/pacientes-service'

import { FOTO_ESCOLHIDA, FOTOS_POR_GRUPO, type GrupoDeFoto } from './fotos-lista'

const RACAS_DE_CAO: Array<[RegExp, GrupoDeFoto]> = [
  [/shih/i, 'cao-shih-tzu'],
  [/yorkshire/i, 'cao-yorkshire'],
  [/labrador/i, 'cao-labrador'],
  [/golden/i, 'cao-golden'],
  [/buldogue/i, 'cao-buldogue-frances'],
  [/spitz|lulu/i, 'cao-spitz'],
  [/poodle/i, 'cao-poodle'],
  [/lhasa/i, 'cao-lhasa'],
  [/beagle/i, 'cao-beagle'],
  [/border/i, 'cao-border-collie'],
  [/pastor/i, 'cao-pastor-alemao'],
  [/dachshund|salsicha/i, 'cao-dachshund'],
  [/pug/i, 'cao-pug'],
  [/malt[eê]s/i, 'cao-maltes'],
  [/schnauzer/i, 'cao-schnauzer'],
  [/pit ?bull/i, 'cao-pit-bull'],
  [/rottweiler/i, 'cao-rottweiler'],
  [/boxer/i, 'cao-boxer'],
  [/husky/i, 'cao-husky'],
  [/cocker/i, 'cao-cocker'],
  [/cavalier/i, 'cao-cavalier'],
]

const RACAS_DE_GATO: Array<[RegExp, GrupoDeFoto]> = [
  [/siam/i, 'gato-siames'],
  [/persa/i, 'gato-persa'],
  [/maine/i, 'gato-maine-coon'],
  [/angor/i, 'gato-angora'],
  [/ragdoll/i, 'gato-ragdoll'],
  [/british/i, 'gato-british'],
  [/sphynx/i, 'gato-sphynx'],
]

export function grupoDaFoto(
  especie: Paciente['especie'],
  raca: string | null,
  especieOutra: string | null = null,
): GrupoDeFoto | null {
  const texto = raca ?? ''
  switch (especie) {
    case 'CACHORRO':
      return RACAS_DE_CAO.find(([padrao]) => padrao.test(texto))?.[1] ?? 'cao-srd'
    case 'GATO':
      return RACAS_DE_GATO.find(([padrao]) => padrao.test(texto))?.[1] ?? 'gato-srd'
    case 'COELHO':
      return 'coelho'
    case 'ROEDOR':
      return /hamster/i.test(texto) ? 'hamster' : 'porquinho'
    case 'AVE':
      return /periquito/i.test(texto) ? 'periquito' : 'calopsita'
    case 'REPTIL':
      return 'jabuti'
    case 'OUTRO':
      return /fur[aã]o/i.test(especieOutra ?? '') ? 'furao' : null
    default:
      return null
  }
}

const USOS = new Map<GrupoDeFoto, number>()

/**
 * O endereço da foto do pet: a escolhida à mão (pelagem descrita no cadastro) ou a próxima do grupo
 * em rodízio; `null` se a espécie não tem foto.
 */
export function proximaFoto(
  pacienteId: string,
  especie: Paciente['especie'],
  raca: string | null,
  especieOutra: string | null = null,
): string | null {
  const escolhida = FOTO_ESCOLHIDA[pacienteId]
  if (escolhida) return `/demo/pacientes/${escolhida}.jpg`
  const grupo = grupoDaFoto(especie, raca, especieOutra)
  const lista = grupo ? FOTOS_POR_GRUPO[grupo] : undefined
  if (!grupo || !lista?.length) return null
  const vez = USOS.get(grupo) ?? 0
  USOS.set(grupo, vez + 1)
  return `/demo/pacientes/${lista[vez % lista.length]}.jpg`
}
