/**
 * A leitura do pedido de horário na caixa (E3-05), sem tela: o dia e a hora lidos do próprio texto
 * do instante (a API manda com o offset da clínica; nada de converter para o fuso do navegador), o
 * motivo e a recusa na chave dos textos que a demonstração já tinha.
 */
import type {
  ClienteDaLista,
  PacienteDoCliente,
  PacienteNaLista,
} from '@/service/parceiro/pacientes-service'
import type {
  Aceite,
  AgendamentoDoPedido,
  Conflito,
  MotivoDaRecusa,
  MotivoDoPedido,
} from '@/service/parceiro/pedidos-service'

type VinculoDoLink = NonNullable<Aceite['vincularA']>

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

/**
 * O agendamento que o aceite marcou, na agenda: o dia dele e a gaveta aberta (`?horario=`, como o
 * Meu dia e as Atividades levam). O dia sai do próprio texto do instante, no fuso da clínica.
 */
export function rotaNaAgenda(agendamento: Pick<AgendamentoDoPedido, 'id' | 'inicio'>) {
  return {
    path: '/clinica/agenda',
    query: { data: agendamento.inicio.slice(0, 10), horario: agendamento.id },
  }
}

/** Os avisos que importam ao aceitar: `info` não pede atenção de ninguém. */
export function conflitosQueAvisam(conflitos: readonly Conflito[]) {
  return conflitos.filter((conflito) => conflito.severity !== 'info')
}

/* ------------------------------------------------- o cadastro que a clínica já tem (pelo link) */

/**
 * O pedido pelo site (canal `LINK`) traz só o cadastro mínimo: sem escolha, o aceite cria um cliente
 * e um paciente novos, mesmo quando a clínica já tem os dois. O guia (6.5) manda oferecer o que a
 * casa já tem pelo `vincularA { clienteId?, pacientes: [{ pedidoId, pacienteId }] }`. Os clientes vêm
 * da busca pelo telefone do pedido (`GET clientes?telefone=`: com ou sem o 55, o principal ou o
 * secundário, N54), e as fichas de cada um numa chamada (`GET clientes/:id/pacientes`, N47). O
 * cliente sem paciente ativo também aparece: o aceite cria a ficha nele, não outro cliente.
 */
export type FichaDaCasa = Pick<PacienteNaLista, 'id' | 'nome' | 'especie' | 'fotoUrl'>
export type ClienteDaCasa = { id: string; nome: string; fichas: FichaDaCasa[] }
type PetDoPedido = { pedidoId: string; nome: string; especie: string }

/** Nome sem acento, caixa e espaço repetido: "Paçoca  C" e "pacoca c" são o mesmo. */
function nomeComparavel(nome: string) {
  return nome.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Os clientes da casa com o telefone do pedido, cada um com as fichas ativas dele. O de nome igual
 * ao de quem pede vem primeiro.
 */
export function clientesDoTelefone(
  achados: readonly {
    cliente: Pick<ClienteDaLista, 'id' | 'nome'>
    pacientes: readonly PacienteDoCliente[]
  }[],
  quemPede: string,
): ClienteDaCasa[] {
  const alvo = nomeComparavel(quemPede)
  const igual = (cliente: ClienteDaCasa) => (nomeComparavel(cliente.nome) === alvo ? 1 : 0)

  return achados
    .map(({ cliente, pacientes }) => ({
      id: cliente.id,
      nome: cliente.nome,
      fichas: pacientes
        .filter((paciente) => paciente.ativo)
        .map(({ id, nome, especie, fotoUrl }) => ({ id, nome, especie, fotoUrl })),
    }))
    .sort((a, b) => igual(b) - igual(a))
}

/**
 * A ficha de cada pet do pedido: a do cliente com o mesmo nome e a mesma espécie, sem usar a mesma
 * ficha para dois pets. Sem ela, `null` (o aceite cria a ficha).
 */
export function fichasParecidas(pets: readonly PetDoPedido[], fichas: readonly FichaDaCasa[]) {
  const usadas = new Set<string>()
  const escolha: Record<string, string | null> = {}

  for (const pet of pets) {
    const achada = fichas.find(
      (ficha) =>
        !usadas.has(ficha.id) &&
        ficha.especie === pet.especie &&
        nomeComparavel(ficha.nome) === nomeComparavel(pet.nome),
    )
    escolha[pet.pedidoId] = achada?.id ?? null
    if (achada) usadas.add(achada.id)
  }

  return escolha
}

/** O `vincularA` do aceite: o cliente escolhido e as fichas que já existem. Sem cliente, nada. */
export function vinculoDoAceite(
  clienteId: string | null,
  fichas: Record<string, string | null>,
): VinculoDoLink | undefined {
  if (!clienteId) return undefined

  const pacientes = Object.entries(fichas)
    .filter((par): par is [string, string] => Boolean(par[1]))
    .map(([pedidoId, pacienteId]) => ({ pedidoId, pacienteId }))

  return pacientes.length ? { clienteId, pacientes } : { clienteId }
}
