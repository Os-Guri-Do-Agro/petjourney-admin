/**
 * O que o desenho do Meu dia (`MeuDiaFoco`) lê, e nada mais. Duas fontes dão esta forma: a
 * demonstração (`useMeuDia`, sobre os dados locais) e a clínica de verdade (`useMeuDiaDaClinica`,
 * pela rota `meu-dia`). Mudar o layout nunca muda a conta, e trocar a fonte nunca muda o layout.
 *
 * As funções vão como método (não como propriedade com tipo de função): assim a demonstração, que
 * recebe o `Appointment` inteiro, cabe no mesmo contrato que a API, que recebe só o horário.
 */
import type { RouteLocationRaw } from 'vue-router'

import type { LinhaDaTabela } from '@/components/home/pauta-tabela'
import type { IndicadorDaAbertura } from '@/components/ui/UiAbertura.vue'
import type { AppointmentStatus, Pet } from '@/features/clinico/data/types'

/** Um horário do dia, como o desenho lê. */
export interface HorarioDoDia {
  id: string
  petId: string
  status: AppointmentStatus
  inicio: string
  chegadaEm?: string | null
  iniciadoEm?: string | null
}

/** O rosto e os alertas de um paciente. A API não manda alerta no painel: lista vazia. */
export interface PacienteDoDia {
  nome: string
  iniciais: string
  especie: Pet['especie'] | null
  fotoUrl: string
  alertas: Pet['alertas']
  /** Só a demonstração tem: a API não manda raça nem idade no painel. */
  raca?: string
  nascimento?: Pet['nascimento']
}

/** "Minha agenda" ou "Clínica": só quando quem abre tem ficha de profissional. */
export interface EscopoDoDia {
  atual: 'PROFISSIONAL' | 'CLINICA'
  profissionalNome: string | null
  trocar(escopo: 'PROFISSIONAL' | 'CLINICA'): void
}

export interface ModeloDoMeuDia {
  carregando: boolean
  erro: string
  emConsulta: HorarioDoDia[]
  naRecepcao: HorarioDoDia[]
  aSeguir: HorarioDoDia[]
  destaque: HorarioDoDia | null
  linhasDaPauta: LinhaDaTabela[]
  fraseDoResumo: string
  dataDeHoje: string
  andamentoDoDia: string
  progressoDoDia: { feitos: number; total: number }
  indicadores: IndicadorDaAbertura[]
  /** Só na clínica de verdade: o seletor de escopo, quando cabe. */
  escopo?: EscopoDoDia | null
  /** Blocos que não carregaram desta vez (a leitura passou do tempo): o resto vem normal. */
  falhas?: string[]
  pet(id: string): PacienteDoDia | null | undefined
  alertasRelevantes(pet: PacienteDoDia | null | undefined): Pet['alertas']
  textoDoAlerta(alerta: Pet['alertas'][number]): string
  minutosDesde(iso: string | null | undefined): number | null
  linhaDoAtendimento(item: HorarioDoDia): string
  linhaCurtaDoAtendimento(item: HorarioDoDia): string
  linhaDoPaciente(pet: PacienteDoDia): string
  rotaDoProntuario(item: HorarioDoDia): RouteLocationRaw
  rotaDoResumo(item: HorarioDoDia): RouteLocationRaw
  abrirProntuario(item: HorarioDoDia): void
  focoNaAgenda(id: string): RouteLocationRaw
  carregar(): Promise<void>
}
