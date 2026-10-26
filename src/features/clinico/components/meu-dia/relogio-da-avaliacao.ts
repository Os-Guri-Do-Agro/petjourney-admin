/**
 * O relógio da avaliação dos layouts do Hoje.
 *
 * A clínica roda sobre dados de demonstração que andam com o relógio: à noite o dia acabou (todos
 * atendidos, ninguém na sala), e no fim de semana o dia de demonstração, o dos 40 atendimentos com
 * alguém em consulta e alguém esperando, cai na segunda seguinte. Comparar layouts numa tela vazia
 * não diz nada; então a avaliação abre numa manhã de movimento, às 10:40 do dia de demonstração, e
 * o seletor das versões deixa voltar à hora real.
 *
 * O relógio deslocado continua valendo ao sair da tela (a agenda aberta pelo "Ver na agenda"
 * mostra o mesmo dia) e volta ao normal ao recarregar a página.
 *
 * É andaime de avaliação, como o seletor: escolhida a versão, sai junto.
 */
import { CLINIC_UTC_OFFSET } from '@/features/clinico/data/fixtures'
import { calcularAncora } from '@/features/clinico/data/seed'
import { getSemente, resetDataset } from '@/features/clinico/data/store'
import {
  epochNow,
  epochToWall,
  getClockSkew,
  setClockSkew,
  wallToEpoch,
} from '@/features/clinico/domain/clinic-time'
import { useClinicoStore } from '@/features/clinico/stores/clinico'

export type RelogioDaAvaliacao = 'movimento' | 'real'

const HORA_DE_MOVIMENTO = 10 * 60 + 40

/** Ligado por esta tela. O deslocamento que o painel de desenvolvimento põe não é dela. */
let emMovimento = false

/** Quanto o relógio precisa andar para cair às 10:40 do dia de demonstração. */
function deslocamentoParaOMovimento() {
  const agoraReal = epochNow() - getClockSkew()
  const hoje = epochToWall(agoraReal, CLINIC_UTC_OFFSET).date
  const alvo = wallToEpoch(
    { date: calcularAncora(hoje), minutes: HORA_DE_MOVIMENTO },
    CLINIC_UTC_OFFSET,
  )

  return alvo - agoraReal
}

/**
 * Põe o relógio da clínica no horário pedido e recria os dados de demonstração nele. Devolve se
 * algo mudou: quem chama recarrega a tela só nesse caso.
 */
export function ajustarRelogio(pedido: RelogioDaAvaliacao): boolean {
  if ((pedido === 'movimento') === emMovimento) {
    return false
  }

  setClockSkew(pedido === 'movimento' ? deslocamentoParaOMovimento() : 0)
  emMovimento = pedido === 'movimento'
  resetDataset(getSemente())
  useClinicoStore().$resetModulo()

  return true
}
