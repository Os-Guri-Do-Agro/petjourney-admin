/**
 * O estabelecimento da demonstração: o perfil público da Vila Madalena Pet, os horários da casa
 * (pela `EXPEDIENTE_DA_CLINICA` da base), os dias especiais (os feriados nacionais do ano, as
 * vésperas de Natal e Ano-Novo em meio período e uma dedetização num sábado), o endereço da página
 * e o expediente de cada profissional, que é exceção ao horário da casa.
 *
 * Exporta:
 * - `estabelecimento()` (o `Estabelecimento` inteiro, como a API devolve), `ESTADO` (perfil, slug,
 *   horários e dias especiais, que as rotas alteram), `pendenciasParaPublicar()`,
 *   `funcionamentoAgora()`, `horarioDoDia(data)` (o horário que vale num dia, já com o dia
 *   especial), `feriadosNacionais(ano)`;
 * - `expedienteDe(profissionalId)` e `salvarExpedienteDe` (o expediente resolvido dos 7 dias).
 */
import type { DiaProprio, Expediente } from '@/service/parceiro/agenda-config-service'
import type {
  DiaEspecial,
  Estabelecimento,
  Funcionamento,
  HorarioDoDia,
  PendenciaParaPublicar,
  PerfilDoEstabelecimento,
} from '@/service/parceiro/estabelecimento-service'

import { idDe } from '../aleatorio'
import {
  ENDERECO,
  EXPEDIENTE_DA_CLINICA,
  EXPEDIENTE_DOS_PROFISSIONAIS,
  PARCEIRO_NOME,
  SALA_PADRAO,
  SLUG,
} from '../base/clinica'
import { agora, diaDaSemana, FUSO, hoje, horaDe, instante, somarDias } from '../relogio'

const HOJE = hoje()
const ANO = Number(HOJE.slice(0, 4))

/* ------------------------------------------------------------------------------ o perfil */

const PERFIL: PerfilDoEstabelecimento = {
  nomePublico: PARCEIRO_NOME,
  descricao:
    'Clínica veterinária de bairro na Vila Madalena. Atendemos cães, gatos e também coelhos, aves, répteis e pequenos roedores, com veterinário dedicado a animais exóticos.\n\nConsultas com hora marcada, vacinação, exames laboratoriais e de imagem, cirurgias e internação. Estacionamento conveniado na Rua Harmonia, 380.',
  idiomaDosTextos: 'pt-BR',
  fusoHorario: FUSO,
  telefonePublico: ENDERECO.telefone,
  whatsappPublico: ENDERECO.whatsapp,
  telefonePlantao: '11981234599',
  emailPublico: ENDERECO.email,
  site: 'https://vilamadalenapet.example.com',
  cep: ENDERECO.cep,
  logradouro: ENDERECO.logradouro,
  numero: ENDERECO.numero,
  complemento: ENDERECO.complemento,
  bairro: ENDERECO.bairro,
  cidade: ENDERECO.cidade,
  uf: ENDERECO.uf,
  pais: 'BR',
  latitude: -23.5567,
  longitude: -46.6893,
  mostrarMapa: true,
  mostrarEndereco: true,
  mensagemForaDoHorario:
    'Estamos fechados agora. Deixe seu pedido de horário que a recepção responde na abertura, às 8h.',
  orientacaoEmergencia:
    'Em emergência fora do horário, ligue para o plantão. Se não atendermos, procure o pronto-socorro veterinário 24 horas mais próximo.',
  publicado: true,
  publicadoEm: '2025-04-02T14:10:00-03:00',
}

function horariosDaCasa(): HorarioDoDia[] {
  return Array.from({ length: 7 }, (_, diaSemana) => {
    const turno = EXPEDIENTE_DA_CLINICA[diaSemana]
    return {
      diaSemana,
      fechado: !turno,
      abre: turno?.inicio ?? null,
      fecha: turno?.fim ?? null,
      intervaloInicio: null,
      intervaloFim: null,
    }
  })
}

/* ------------------------------------------------------------------------ os feriados */

/** O domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function pascoa(ano: number) {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export function feriadosNacionais(ano: number): Array<{ data: string; nome: string }> {
  return [
    { data: `${ano}-01-01`, nome: 'Confraternização Universal' },
    { data: somarDias(pascoa(ano), -2), nome: 'Sexta-feira Santa' },
    { data: `${ano}-04-21`, nome: 'Tiradentes' },
    { data: `${ano}-05-01`, nome: 'Dia do Trabalho' },
    { data: `${ano}-09-07`, nome: 'Independência do Brasil' },
    { data: `${ano}-10-12`, nome: 'Nossa Senhora Aparecida' },
    { data: `${ano}-11-02`, nome: 'Finados' },
    { data: `${ano}-11-15`, nome: 'Proclamação da República' },
    { data: `${ano}-11-20`, nome: 'Dia Nacional de Zumbi e da Consciência Negra' },
    { data: `${ano}-12-25`, nome: 'Natal' },
  ].sort((a, b) => a.data.localeCompare(b.data))
}

let sequenciaDeDia = 0

function novoDia(dados: Omit<DiaEspecial, 'id'>): DiaEspecial {
  return { id: idDe('demo-dia', ++sequenciaDeDia), ...dados }
}

/** O sábado mais perto de daqui a duas semanas e meia. */
function sabadoAdiante() {
  let data = somarDias(HOJE, 17)
  while (diaDaSemana(data) !== 6) data = somarDias(data, 1)
  return data
}

function diasIniciais(): DiaEspecial[] {
  const dias = feriadosNacionais(ANO).map((f) =>
    novoDia({ data: f.data, nome: f.nome, fechado: true, abre: null, fecha: null }),
  )
  dias.push(
    novoDia({
      data: `${ANO}-12-24`,
      nome: 'Véspera de Natal',
      fechado: false,
      abre: '08:00',
      fecha: '12:00',
    }),
    novoDia({
      data: `${ANO}-12-31`,
      nome: 'Véspera de Ano-Novo',
      fechado: false,
      abre: '08:00',
      fecha: '12:00',
    }),
    novoDia({
      data: sabadoAdiante(),
      nome: 'Dedetização da clínica',
      fechado: true,
      abre: null,
      fecha: null,
    }),
  )
  return dias.sort((a, b) => a.data.localeCompare(b.data))
}

/* ------------------------------------------------------------------------------ o estado */

export const ESTADO = {
  perfil: PERFIL,
  slug: SLUG,
  horarios: horariosDaCasa(),
  diasEspeciais: diasIniciais(),
}

export function criarDiaEspecial(dados: Omit<DiaEspecial, 'id'>) {
  const dia = novoDia(dados)
  ESTADO.diasEspeciais.push(dia)
  ESTADO.diasEspeciais.sort((a, b) => a.data.localeCompare(b.data))
  return dia
}

export function pendenciasParaPublicar(): PendenciaParaPublicar[] {
  const p = ESTADO.perfil
  const pendencias: PendenciaParaPublicar[] = []
  if (!p.nomePublico.trim()) pendencias.push('nomePublico')
  if (!p.fusoHorario) pendencias.push('fusoHorario')
  if (!p.telefonePublico && !p.whatsappPublico && !p.telefonePlantao) pendencias.push('telefone')
  return pendencias
}

/** O horário que vale numa data: o dia especial, se houver, senão o da semana. */
export function horarioDoDia(data: string) {
  const especial = ESTADO.diasEspeciais.find((d) => d.data === data)
  const semana = ESTADO.horarios.find((h) => h.diaSemana === diaDaSemana(data))
  if (especial) {
    return especial.fechado
      ? null
      : {
          abre: especial.abre ?? semana?.abre ?? null,
          fecha: especial.fecha ?? semana?.fecha ?? null,
          intervaloInicio: null,
          intervaloFim: null,
        }
  }
  if (!semana || semana.fechado || !semana.abre || !semana.fecha) return null
  return semana
}

export function funcionamentoAgora(): Funcionamento {
  if (!ESTADO.horarios.some((h) => !h.fechado)) {
    return { abertoAgora: null, fechaEm: null, proximaAbertura: null }
  }

  const agoraHora = horaDe(agora())
  const deHoje = horarioDoDia(HOJE)

  if (deHoje?.abre && deHoje.fecha) {
    const noIntervalo =
      deHoje.intervaloInicio &&
      deHoje.intervaloFim &&
      agoraHora >= deHoje.intervaloInicio &&
      agoraHora < deHoje.intervaloFim
    if (agoraHora >= deHoje.abre && agoraHora < deHoje.fecha && !noIntervalo) {
      const fecha =
        deHoje.intervaloInicio && agoraHora < deHoje.intervaloInicio
          ? deHoje.intervaloInicio
          : deHoje.fecha
      return { abertoAgora: true, fechaEm: instante(HOJE, fecha), proximaAbertura: null }
    }
    if (agoraHora < deHoje.abre) {
      return { abertoAgora: false, fechaEm: null, proximaAbertura: instante(HOJE, deHoje.abre) }
    }
    if (noIntervalo && deHoje.intervaloFim) {
      return {
        abertoAgora: false,
        fechaEm: null,
        proximaAbertura: instante(HOJE, deHoje.intervaloFim),
      }
    }
  }

  for (let n = 1; n <= 14; n++) {
    const data = somarDias(HOJE, n)
    const horario = horarioDoDia(data)
    if (horario?.abre) {
      return { abertoAgora: false, fechaEm: null, proximaAbertura: instante(data, horario.abre) }
    }
  }
  return { abertoAgora: false, fechaEm: null, proximaAbertura: null }
}

export function estabelecimento(): Estabelecimento {
  const pendencias = pendenciasParaPublicar()
  const desde = somarDias(HOJE, -30)
  return {
    perfil: { ...ESTADO.perfil },
    slug: ESTADO.slug,
    horarios: ESTADO.horarios.map((h) => ({ ...h })),
    diasEspeciais: ESTADO.diasEspeciais.filter((d) => d.data >= desde).map((d) => ({ ...d })),
    visivelPublicamente: ESTADO.perfil.publicado && !pendencias.length,
    pendenciasParaPublicar: pendencias,
    funcionamento: funcionamentoAgora(),
    podeEditar: true,
  }
}

/* -------------------------------------------------------------------------- expediente */

const DIAS_PROPRIOS = new Map<string, DiaProprio[]>()
const SALAS_PADRAO = new Map<string, string | null>(Object.entries(SALA_PADRAO))

/** Só os dias em que o profissional difere da casa, como a API guarda. */
function diasPropriosIniciais(profissionalId: string): DiaProprio[] {
  const meus = EXPEDIENTE_DOS_PROFISSIONAIS[profissionalId]
  if (!meus) return []
  const dias: DiaProprio[] = []
  for (let d = 0; d < 7; d++) {
    const meu = meus[d]
    const casa = ESTADO.horarios[d]
    if (meu) {
      if (casa && !casa.fechado && casa.abre === meu.inicio && casa.fecha === meu.fim) continue
      dias.push({ diaSemana: d, trabalha: true, inicio: meu.inicio, fim: meu.fim })
    } else if (casa && !casa.fechado) {
      dias.push({ diaSemana: d, trabalha: false, inicio: null, fim: null })
    }
  }
  return dias
}

function diasProprios(profissionalId: string) {
  if (!DIAS_PROPRIOS.has(profissionalId)) {
    DIAS_PROPRIOS.set(profissionalId, diasPropriosIniciais(profissionalId))
  }
  return DIAS_PROPRIOS.get(profissionalId) as DiaProprio[]
}

export function expedienteDe(profissionalId: string): Expediente {
  const proprios = diasProprios(profissionalId)
  return {
    profissionalId,
    salaPadraoId: SALAS_PADRAO.get(profissionalId) ?? null,
    fuso: ESTADO.perfil.fusoHorario,
    estabelecimentoSemHorario: !ESTADO.horarios.some((h) => !h.fechado),
    dias: ESTADO.horarios.map((casa) => {
      const meu = proprios.find((p) => p.diaSemana === casa.diaSemana)
      if (meu) {
        return {
          diaSemana: casa.diaSemana,
          origem: 'PROFISSIONAL' as const,
          trabalha: meu.trabalha,
          inicio: meu.trabalha ? (meu.inicio ?? null) : null,
          fim: meu.trabalha ? (meu.fim ?? null) : null,
          intervaloInicio: null,
          intervaloFim: null,
        }
      }
      return {
        diaSemana: casa.diaSemana,
        origem: 'ESTABELECIMENTO' as const,
        trabalha: !casa.fechado,
        inicio: casa.abre,
        fim: casa.fecha,
        intervaloInicio: casa.intervaloInicio,
        intervaloFim: casa.intervaloFim,
      }
    }),
  }
}

export function salvarExpedienteDe(
  profissionalId: string,
  dias: DiaProprio[],
  salaPadraoId: string | null | undefined,
) {
  DIAS_PROPRIOS.set(
    profissionalId,
    dias.map((d) => ({
      diaSemana: d.diaSemana,
      trabalha: d.trabalha,
      inicio: d.trabalha ? (d.inicio ?? null) : null,
      fim: d.trabalha ? (d.fim ?? null) : null,
    })),
  )
  if (salaPadraoId !== undefined) SALAS_PADRAO.set(profissionalId, salaPadraoId)
  return expedienteDe(profissionalId)
}
