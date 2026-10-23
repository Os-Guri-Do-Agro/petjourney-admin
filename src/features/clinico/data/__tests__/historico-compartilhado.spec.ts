/**
 * O servidor do histórico que viaja com o pet, dos dois lados do mesmo acesso.
 *
 * Fixa o percurso que a demonstração promete — o responsável libera, a recepção digita o código
 * e o paciente novo chega com o histórico completo; cada abertura aparece para o responsável;
 * encerrar no celular some com o histórico da clínica na hora — e os casos difíceis: a clínica
 * de antes que ainda tem acesso depois de um conflito, e a emergência sem o responsável por perto.
 *
 * O relógio fica parado às 10:00 de um dia útil, como no agendamento online.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  addDays,
  createClinicClock,
  epochNow,
  epochToWall,
  isWeekend,
  nextBusinessDay,
  setClockSkew,
  wallToEpoch,
} from '../../domain/clinic-time'
import { CLINIC_UTC_OFFSET } from '../fixtures'
import {
  ErroDoHistorico,
  historicoDoResponsavel as app,
  historicoLiberadoRepository as recepcao,
} from '../historico-compartilhado'
import { setMockConfig } from '../mock-runtime'
import {
  CODIGO_DA_PRIMEIRA_VEZ,
  PET_DO_CONFLITO,
  PET_DO_PRAZO,
  RESPONSAVEL_DO_CONFLITO,
} from '../seed-historico'
import { PET_SEM_VINCULO, RESPONSAVEL_SEM_VINCULO } from '../seed-pedidos'
import { getDataset, resetDataset } from '../store'

const clock = createClinicClock(CLINIC_UTC_OFFSET)
const ANA = 'prof-ana'

function pararRelogio(date: string, minutos: number) {
  setClockSkew(wallToEpoch({ date, minutes: minutos }, CLINIC_UTC_OFFSET) - Date.now())
}

let diaUtil = ''

beforeEach(() => {
  setClockSkew(0)

  const hoje = epochToWall(epochNow(), CLINIC_UTC_OFFSET).date

  diaUtil = isWeekend(hoje) ? nextBusinessDay(hoje) : hoje
  pararRelogio(diaUtil, 10 * 60)
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
})

afterEach(() => {
  setClockSkew(0)
})

async function codigoDe(promessa: Promise<unknown>) {
  try {
    await promessa
  } catch (erro) {
    return erro instanceof ErroDoHistorico ? erro.codigo : String(erro)
  }

  return 'sem erro'
}

describe('a lista da clínica', () => {
  it('o que vale em cima, o que terminou embaixo, e nada de acesso de outra clínica', async () => {
    const linhas = await recepcao.listar()

    expect(linhas.map((linha) => [linha.petId, linha.estado])).toEqual([
      [PET_DO_CONFLITO, 'ativo'],
      [PET_DO_PRAZO, 'terminou'],
    ])
    expect(linhas[0]!.clinicasDeOrigem).toEqual(['Clínica Veterinária Cuidar'])
    expect(linhas[1]!.clinicasDeOrigem).toEqual([])
  })
})

describe('paciente novo chega com o histórico completo', () => {
  it('a recepção digita o código, o Fubá vira paciente e o histórico abre com a origem de cada item', async () => {
    const conferido = await recepcao.conferirCodigo(' 729-154 ')

    expect(conferido.petNome).toBe('Fubá')
    expect(conferido.tutorNome).toBe('Renata Lima')
    expect(conferido.jaEPaciente).toBe(false)

    const recebido = await recepcao.receber(CODIGO_DA_PRIMEIRA_VEZ)

    expect(recebido.petId).toBe(PET_SEM_VINCULO)
    expect(getDataset().pets.some((pet) => pet.id === PET_SEM_VINCULO)).toBe(true)
    expect(getDataset().tutores.some((tutor) => tutor.id === RESPONSAVEL_SEM_VINCULO)).toBe(true)

    const aberto = await recepcao.abrir(recebido.acessoId, ANA)

    expect(aberto.itens?.some((item) => item.titulo === 'Fenobarbital 2,5 mg/kg')).toBe(true)
    // O diário não foi liberado nesse código: não aparece.
    expect(aberto.itens?.some((item) => item.categoria === 'DIARIO')).toBe(false)
    expect(aberto.itens?.find((item) => item.categoria === 'ALERGIAS')?.origem.local).toBe(
      'Clínica Bem-Estar Pinheiros',
    )
    expect(aberto.registrada?.profissionalNome).toBe('Ana Ribeiro')

    // E a Renata vê no celular quem abriu.
    const quemAbriu = await app.aberturas(RESPONSAVEL_SEM_VINCULO, PET_SEM_VINCULO)

    expect(quemAbriu[0]).toMatchObject({ profissionalNome: 'Ana Ribeiro', canal: 'FICHA' })
  })

  it('o código usado não serve para outra clínica, e o vencido diz que venceu', async () => {
    await recepcao.receber(CODIGO_DA_PRIMEIRA_VEZ)

    expect(await codigoDe(recepcao.conferirCodigo(CODIGO_DA_PRIMEIRA_VEZ))).toBe('CODIGO_JA_USADO')
    expect(await codigoDe(recepcao.conferirCodigo('000000'))).toBe('CODIGO_NAO_ENCONTRADO')

    const novo = await app.liberar(RESPONSAVEL_SEM_VINCULO, PET_SEM_VINCULO, ['VACINAS'], 7)

    pararRelogio(addDays(diaUtil, 8), 10 * 60)

    expect(await codigoDe(recepcao.conferirCodigo(novo.codigo))).toBe('CODIGO_EXPIRADO')
  })
})

describe('encerrar é imediato e sem constrangimento', () => {
  it('encerrado no celular, a clínica não vê mais nada e não fica sabendo quem encerrou', async () => {
    const [linha] = await recepcao.listar()

    await app.encerrar(RESPONSAVEL_DO_CONFLITO, linha!.acessoId)

    const depois = await recepcao.abrir(linha!.acessoId, ANA)

    expect(depois.itens).toBeNull()
    expect(depois.registrada).toBeNull()
    expect(depois.linha.estado).toBe('terminou')
    expect(depois.linha.terminouEm).toBe(clock.nowIso())
    expect(depois.linha).not.toHaveProperty('encerradoPor')
  })

  it('a clínica de antes ainda tinha acesso depois da troca; o responsável vê que ela abriu e encerra', async () => {
    const acessos = await app.acessos(RESPONSAVEL_DO_CONFLITO)
    const deAntes = acessos.find((acesso) => acesso.parceiroNome === 'Clínica Veterinária Cuidar')

    expect(deAntes?.estado).toBe('ativo')

    const quemAbriu = await app.aberturas(RESPONSAVEL_DO_CONFLITO, PET_DO_CONFLITO)

    expect(
      quemAbriu.some((abertura) => abertura.parceiroNome === 'Clínica Veterinária Cuidar'),
    ).toBe(true)

    await app.encerrar(RESPONSAVEL_DO_CONFLITO, deAntes!.id)

    const depois = await app.acessos(RESPONSAVEL_DO_CONFLITO)

    expect(depois.find((acesso) => acesso.id === deAntes!.id)?.estado).toBe('encerrado')
    // O acesso desta clínica segue valendo: encerrar um não mexe no outro.
    expect((await recepcao.listar())[0]!.estado).toBe('ativo')
  })

  it('ninguém encerra o acesso de outra conta', async () => {
    const [linha] = await recepcao.listar()

    expect(await codigoDe(app.encerrar(RESPONSAVEL_SEM_VINCULO, linha!.acessoId))).toBe(
      'ACESSO_NAO_ENCONTRADO',
    )
  })
})

describe('liberar para uma clínica nova', () => {
  it('nasce um código esperando a recepção, com o prazo escolhido', async () => {
    const novo = await app.liberar(
      RESPONSAVEL_DO_CONFLITO,
      PET_DO_CONFLITO,
      ['ALERGIAS', 'PESO'],
      30,
    )

    expect(novo.estado).toBe('aguardando')
    expect(novo.parceiroNome).toBeNull()
    expect(novo.codigo).toMatch(/^\d{6}$/)
    expect(clock.dateOf(novo.expiraEm)).toBe(addDays(diaUtil, 30))
  })

  it('nenhum acesso passa de 30 dias, o teto da API', () => {
    const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000

    for (const acesso of getDataset().historicoCompartilhado.acessos) {
      expect(Date.parse(acesso.expiraEm) - Date.parse(acesso.liberadoEm)).toBeLessThanOrEqual(
        TRINTA_DIAS_MS,
      )
    }
  })
})

describe('emergência pelo QR da coleira', () => {
  it('a ficha pública só tem a alergia grave; a de emergência exige CRMV', async () => {
    const publica = await recepcao.lerColeira('fuba-3k9p')

    expect(publica.nome).toBe('Fubá')
    expect(publica.alertasCriticos).toEqual(['Amoxicilina com clavulanato'])

    expect(await codigoDe(recepcao.abrirEmergencia('fuba-3k9p', null))).toBe('CRMV_OBRIGATORIO')
    expect(await codigoDe(recepcao.lerColeira('nao-existe'))).toBe('COLEIRA_NAO_ENCONTRADA')
  })

  it('aberta por quem tem CRMV, fica registrada e o responsável recebe o aviso, sem acesso liberado', async () => {
    const { ficha, abertura } = await recepcao.abrirEmergencia('fuba-3k9p', ANA)

    expect(ficha.medicacaoContinua.map((item) => item.titulo)).toEqual(['Fenobarbital 2,5 mg/kg'])
    expect(ficha.diagnosticosAtivos.map((item) => item.titulo)).toEqual(['Epilepsia idiopática'])
    expect(ficha.responsavelTelefone).toBe('(11) 98120-4471')
    expect(abertura).toMatchObject({
      canal: 'EMERGENCIA',
      acessoId: null,
      conselho: 'CRMV-SP 41208',
    })

    const avisos = await app.avisos(RESPONSAVEL_SEM_VINCULO)

    expect(avisos).toHaveLength(1)
    expect(avisos[0]!.abertura.profissionalNome).toBe('Ana Ribeiro')
    expect((await app.aberturas(RESPONSAVEL_SEM_VINCULO, PET_SEM_VINCULO))[0]!.canal).toBe(
      'EMERGENCIA',
    )
  })
})
