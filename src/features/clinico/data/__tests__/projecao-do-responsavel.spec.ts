/**
 * A projeção do dataset para o responsável — o que a API vai fazer, e o que o JSON de
 * demonstração do app carrega (`npm run contrato:demo`).
 *
 * O modo de falhar daqui é vazar: um boletim retido que chega ao celular, um diagnóstico
 * diferencial lido como certeza, a prioridade da fila dos outros. Nada disso quebra tela nem tipo
 * — só aparece na demonstração, na frente de quem não devia ver.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ROTAS_DAS_NOTIFICACOES_CLINICAS } from '../../contrato/responsavel'
import {
  clockToMinutes,
  createClinicClock,
  setClockSkew,
  weekdayOf,
} from '../../domain/clinic-time'
import { vagaLivre } from '../../domain/politica'
import { CLINIC_UTC_OFFSET } from '../fixtures'
import { montarDemoDoResponsavel, type DemoDoResponsavel } from '../projecao-do-responsavel'
import { calcularAncora, gerarDataset, type SeedResult } from '../seed'
import { RESPONSAVEL_DA_DEMONSTRACAO } from '../seed-responsavel'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

let dataset: SeedResult
let demo: DemoDoResponsavel

/* O mesmo instante do gerador: 07:30 do dia âncora, meia hora antes do prazo de cancelar. */
beforeAll(() => {
  const ancora = calcularAncora(clock.today())

  setClockSkew(Date.parse(clock.toIso(ancora, 7 * 60 + 30)) - Date.now())
  dataset = gerarDataset()
  demo = montarDemoDoResponsavel({
    dataset,
    tutorId: RESPONSAVEL_DA_DEMONSTRACAO,
    agora: clock.nowIso(),
    textos: {
      emInvestigacao: 'em investigação',
      sinaisDeAlerta: 'Procure a clínica antes do retorno.',
      tituloDoDocumento: {
        RECEITUARIO: 'Receituário',
        ORIENTACOES: 'Orientações ao responsável',
        PEDIDO_EXAME: 'Pedido de exame',
      },
    },
  })
})

afterAll(() => {
  setClockSkew(0)
})

describe('só chega o que é do responsável', () => {
  it('nenhum pet de outra família aparece em lugar nenhum', () => {
    const meus = new Set(demo.pets.map((pet) => pet.id))
    const petIds = [
      ...demo.agendamentos.map((item) => item.pet.id),
      ...demo.fila.map((item) => item.pet.id),
      ...demo.atendimentos.map((item) => item.pet.id),
      ...demo.vacinas.map((item) => item.petId),
      ...demo.planosVacinais.map((item) => item.petId),
      ...demo.internacoes.map((item) => item.pet.id),
      ...demo.notificacoes.map((item) => item.dados.petId),
      ...demo.notificacoesDaCarteirinha.map((item) => item.dados.petId),
    ]

    /* O Biscoito é o filhote da carteirinha conectada (`seed-vacinacao.ts`). */
    expect(meus).toEqual(new Set(['pet-perola', 'pet-pipoca', 'pet-bruna', 'pet-biscoito']))
    expect(petIds.filter((petId) => !meus.has(petId))).toEqual([])
  })

  it('a agenda da Fátima é o cenário plantado, sem horário sorteado', () => {
    const sorteados = dataset.appointments.filter(
      (item) =>
        item.tutorId === RESPONSAVEL_DA_DEMONSTRACAO &&
        (item.id.startsWith('apt-ancora') || /^apt-\d{4}-\d{2}-\d{2}/.test(item.id)),
    )

    expect(sorteados).toEqual([])
    expect(demo.agendamentos.map((item) => item.id).sort()).toEqual([
      'apt-falta-brunilda',
      'apt-resumo-perola',
      'apt-resumo-perola-1',
      'apt-resumo-perola-2',
      'apt-resumo-perola-3',
    ])
  })

  it('boletim retido ou liberado não sai da clínica, nem como contagem', () => {
    const enviados = new Set(
      dataset.internacao.boletins
        .filter((item) => item.status === 'enviado')
        .map((item) => item.id),
    )

    expect(demo.boletins.length).toBeGreaterThanOrEqual(3)
    expect(demo.boletins.every((item) => enviados.has(item.id))).toBe(true)
    expect(JSON.stringify(demo.internacoes)).not.toMatch(/retid/i)
  })

  it('o que é da clínica fica na clínica: diferencial, mg/kg, prioridade', () => {
    const texto = JSON.stringify(demo)

    expect(texto).not.toMatch(/mg\/kg/)
    expect(texto).not.toMatch(/"prioridade"/)
    expect(texto).not.toMatch(/"codigo":"[A-Z]{2}-\d/)

    for (const atendimento of demo.atendimentos) {
      const encounter = dataset.encounters.find((item) => item.id === atendimento.id)

      for (const diferencial of encounter?.diagnosticos.filter(
        (item) => item.kind === 'diferencial',
      ) ?? []) {
        expect(atendimento.diagnostico).not.toContain(diferencial.descricao)
      }
    }
  })

  it('a posição na fila só existe para quem espera', () => {
    for (const entrada of demo.fila) {
      expect(entrada.posicao === null).toBe(entrada.status !== 'AGUARDANDO')
    }
  })
})

describe('o que o contrato promete ao app', () => {
  it('uso contínuo é a chave ausente, nunca null nem 365', () => {
    const itens = demo.atendimentos.flatMap((item) => item.receita?.itens ?? [])
    const meloxicam = itens.find((item) => item.medicamento.startsWith('Meloxicam'))
    const omeprazol = itens.find((item) => item.medicamento.startsWith('Omeprazol'))

    expect(meloxicam).toBeDefined()
    expect(meloxicam && 'duracaoDias' in meloxicam).toBe(false)
    expect(omeprazol?.duracaoDias).toBe(14)
  })

  it('especialidade vai como chave da lista do app ou por extenso, nunca a chave do portal', () => {
    const especialidades = [
      ...demo.agendamentos.map((item) => item.profissional.especialidade),
      ...demo.horariosLivres.map((item) => item.profissional.especialidade),
    ]

    for (const especialidade of especialidades) {
      expect(especialidade).toMatch(/^([A-Z_]+|[A-ZÀ-Ú][a-zà-ú]+( [a-zà-ú]+)*)$/)
    }
  })

  it('às 07:30 a consulta das 10:00 da Pérola ainda se cancela pelo app, e a pré-consulta está aberta', () => {
    const hoje = demo.agendamentos.find((item) => item.id === 'apt-resumo-perola')

    expect(hoje?.status).toBe('CONFIRMADO')
    expect(hoje?.podeCancelar).toBe(true)
    expect(hoje?.cancelarAte?.slice(11, 16)).toBe('08:00')
    expect(hoje?.preConsulta?.situacao).toBe('ABERTA')
    expect(demo.preConsultas[0]?.sugestao?.hidratacao).toBe('MUITO')
  })

  it('a falta sem justificativa chega com motivo e canal vazios — é o que pede a justificativa', () => {
    const falta = demo.agendamentos.find((item) => item.status === 'FALTA')

    expect(falta?.falta).toEqual({ motivo: null, canal: null })
  })

  it('a oferta cai dentro das janelas da Brunilda, num horário de fato livre', () => {
    const entrada = demo.fila.find((item) => item.status === 'OFERTADO')
    const oferta = entrada?.oferta

    expect(oferta).toBeTruthy()

    const dia = weekdayOf(clock.dateOf(oferta!.inicio))
    const minutos = clock.minutesOf(oferta!.inicio)
    const cabe = entrada!.janelas.some(
      (janela) =>
        janela.diaDaSemana === dia &&
        minutos >= clockToMinutes(janela.inicio) &&
        clock.minutesOf(oferta!.fim) <= clockToMinutes(janela.fim),
    )

    expect(cabe).toBe(true)
    expect(
      vagaLivre(dataset.appointments, {
        professionalId: oferta!.profissional.id,
        petId: entrada!.pet.id,
        inicio: oferta!.inicio,
        fim: oferta!.fim,
      }),
    ).toBe(true)
  })

  it('toda notificação já foi enviada, abre a tela certa e diz de qual pet é', () => {
    const agora = Date.parse(demo.geradoEm)

    for (const notificacao of demo.notificacoes) {
      expect(Date.parse(notificacao.criadoEm)).toBeLessThanOrEqual(agora)
      expect(
        notificacao.dados.url.startsWith(ROTAS_DAS_NOTIFICACOES_CLINICAS[notificacao.dados.tipo]),
      ).toBe(true)
      expect(notificacao.dados.url).toContain(`petId=${notificacao.dados.petId}`)
      expect(notificacao.titulo.length).toBeGreaterThan(0)
    }
  })

  it('o push do boletim não adianta o conteúdo', () => {
    const boletins = demo.notificacoes.filter((item) => item.dados.tipo === 'INTERNACAO_BOLETIM')

    expect(boletins.length).toBe(demo.boletins.length)

    for (const notificacao of boletins) {
      expect(`${notificacao.titulo} ${notificacao.corpo}`).not.toMatch(/estável|piora|fezes|comeu/i)
    }
  })
})
