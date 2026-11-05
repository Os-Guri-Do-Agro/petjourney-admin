/**
 * A leitura do pedido de horário na caixa (E3-05), sem tela: o dia e a hora lidos do próprio texto
 * do instante (a API manda com o offset da clínica; nada de converter para o fuso do navegador), o
 * motivo e a recusa na chave dos textos que a demonstração já tinha.
 */
import type { Conflito, MotivoDaRecusa, MotivoDoPedido } from '@/service/parceiro/pedidos-service'

/** `AAAA-MM-DD` como data civil, para o `Intl` dizer o dia sem mudar de fuso. */
function dataCivil(dia: string) {
  return new Date(`${dia}T12:00:00Z`)
}

/** "ter., 10/11" no idioma da sessão. */
export function diaCurto(dia: string, locale: string) {
  const texto = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(dataCivil(dia))

  return texto.charAt(0).toLocaleUpperCase(locale) + texto.slice(1)
}

/** "terça-feira, 10 de novembro" no idioma da sessão, para ir no meio da frase. */
export function diaLongo(dia: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(dataCivil(dia))
}

/** A primeira letra em maiúscula, para a frase que começa pelo dia. */
export function comMaiuscula(texto: string, locale: string) {
  return texto.charAt(0).toLocaleUpperCase(locale) + texto.slice(1)
}

/** O motivo do pedido na chave de `clinico.pedidos.motivo` (`CHECKUP` → `checkup`). */
export function chaveDoMotivo(motivo: MotivoDoPedido) {
  return `clinico.pedidos.motivo.${motivo.toLowerCase()}`
}

/** A recusa na chave de `clinico.pedidos.recusa.motivo` (`SEM_HORARIO` → `sem-horario`). */
export function chaveDaRecusa(motivo: MotivoDaRecusa) {
  return `clinico.pedidos.recusa.motivo.${motivo.toLowerCase().replace(/_/g, '-')}`
}

const KINDS_CONHECIDOS = [
  'professional-overlap',
  'room-overlap',
  'pet-double-book',
  'block-invasion',
  'outside-hours',
  'lunch-overlap',
  'holiday-closed',
  'over-capacity',
  'type-room-mismatch',
  'pedido-pendente',
] as const

/** O aviso pelo `kind`, sem texto da API: o que não se conhece cai no genérico. */
export function chaveDoConflito(conflito: Pick<Conflito, 'kind'>) {
  return (KINDS_CONHECIDOS as readonly string[]).includes(conflito.kind)
    ? `pedidos.caixa.conflito.${conflito.kind}`
    : 'pedidos.caixa.conflito.outro'
}

/** Os avisos que importam ao aceitar: `info` não pede atenção de ninguém. */
export function conflitosQueAvisam(conflitos: readonly Conflito[]) {
  return conflitos.filter((conflito) => conflito.severity !== 'info')
}
