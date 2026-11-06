/**
 * As frases da agenda (E3-02): o aviso pelo `kind` (guia e3 2.3, nunca o texto do servidor), a
 * duração, o dia e o erro de escrita pelo `codigo`.
 */
import { useI18n } from 'vue-i18n'

import { chaveDoConflito } from '@/components/agendamentos/leitura-da-agenda'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { comMaiuscula, diaLongo } from '@/components/pedidos/leitura-do-pedido'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { ApiError } from '@/service/api'
import {
  outrosNoConflito,
  type Agendamento,
  type Conflito,
} from '@/service/parceiro/agenda-service'

export type ErroDaAgenda = {
  codigo: string
  mensagem: string
  /** `CONFLITO_BLOQUEANTE`: o que pede o segundo passo. */
  conflitos: Conflito[]
  /** `PACIENTE_INATIVO` de paciente mesclado: o cadastro que ficou. */
  mescladoEmId: string | null
}

export function lerErroDaAgenda(err: unknown, generico: string): ErroDaAgenda {
  const lido = lerErroDoCadastro(err, generico)
  const detalhes = err instanceof ApiError ? err.detalhes : {}

  return {
    codigo: lido.codigo,
    mensagem: lido.mensagem,
    conflitos: Array.isArray(detalhes.conflitos) ? (detalhes.conflitos as Conflito[]) : [],
    mescladoEmId: typeof detalhes.mescladoEmId === 'string' ? detalhes.mescladoEmId : null,
  }
}

export function useFrasesDaAgenda() {
  const { t, te } = useI18n()
  const rotulos = useRotulosDoCadastro()

  /** 30 → "30 min"; 90 → "1 h 30 min"; 120 → "2 h". */
  function duracao(minutos: number) {
    const h = Math.floor(minutos / 60)
    const m = minutos % 60
    if (!h) return t('agendamentos.duracao.minutos', { m })
    return m
      ? t('agendamentos.duracao.horasMinutos', { h, m })
      : t('agendamentos.duracao.horas', { h })
  }

  /** O que o servidor manda em minutos ou em código vira texto antes de entrar na frase. */
  function paramsDo(conflito: Conflito) {
    const params: Record<string, string | number> = {}
    for (const [chave, valor] of Object.entries(conflito.params)) {
      if (typeof valor === 'string' || typeof valor === 'number') params[chave] = valor
    }

    if (conflito.kind === 'block-invasion' && typeof params.motivo === 'string') {
      const chave = `agenda.config.bloqueio.motivo.${params.motivo}`
      params.motivo = te(chave) ? t(chave) : params.motivo
    }
    if (conflito.kind === 'over-capacity') {
      params.minutos = duracao(Number(params.minutos ?? 0))
      params.capacidade = duracao(Number(params.capacidade ?? 0))
    }
    if (conflito.kind === 'pedido-pendente') {
      params.origem = t(
        `agendamentos.conflito.origemDoPedido.${String(params.origem ?? 'PEDIDO_APP')}`,
      )
      params.hora =
        typeof params.expiraEm === 'string'
          ? (/T(\d{2}:\d{2})/.exec(params.expiraEm)?.[1] ?? '')
          : ''
    }

    return params
  }

  /** A frase do aviso, com o "e mais {n}" do conflito agregado (v0.3). */
  function frase(conflito: Conflito) {
    const chave = chaveDoConflito(conflito)
    const padrao = `agendamentos.conflito.${conflito.kind}.padrao`
    const usada = te(chave) ? chave : te(padrao) ? padrao : 'agendamentos.conflito.outro'
    const texto = t(usada, paramsDo(conflito))
    const outros = outrosNoConflito(conflito)

    return outros ? `${texto} ${t('agendamentos.conflito.eMais', { n: outros })}` : texto
  }

  /** "Sexta-feira, 6 de novembro". */
  function diaPorExtenso(data: string) {
    return comMaiuscula(diaLongo(data, rotulos.intl()), rotulos.intl())
  }

  /** "sexta-feira, 6 de novembro", para ir no meio da frase. */
  function diaNaFrase(data: string) {
    return diaLongo(data, rotulos.intl())
  }

  /** "09:00 às 09:30 · 30 min". */
  function horario(agendamento: Pick<Agendamento, 'inicio' | 'fim' | 'duracaoMinutos'>) {
    return t('agendamentos.horario', {
      inicio: agendamento.inicio.slice(11, 16),
      fim: agendamento.fim.slice(11, 16),
      duracao: duracao(agendamento.duracaoMinutos),
    })
  }

  return { duracao, frase, diaPorExtenso, diaNaFrase, horario }
}
