import { describe, expect, it } from 'vitest'

import type { AppNavigationSection } from '@/composables/useAppNavigation'

import { localizar, lugarDaRota, montarEspacos, tomMaisGrave } from '../espacos'

const t = (chave: string) => chave

const item = (to: string, extra: Partial<AppNavigationSection['items'][number]> = {}) => ({
  label: to,
  to,
  icon: 'ph ph-circle',
  ...extra,
})

const secoes: AppNavigationSection[] = [
  {
    id: 'portal',
    label: 'Portal',
    icon: 'ph ph-briefcase',
    items: [item('/parceiro/programas'), item('/parceiro/acessos')],
  },
  {
    id: 'clinical',
    label: 'Clínica',
    icon: 'ph ph-calendar-blank',
    items: [
      item('/clinica/meu-dia'),
      item('/clinica/agenda'),
      item('/clinica/pedidos', { badge: 4, badgeTom: 'atencao' }),
      item('/clinica/fila', { badge: 2, badgeTom: 'neutro' }),
      item('/clinica/atendimentos'),
      item('/clinica/internacao', { badge: 2, badgeTom: 'risco' }),
      item('/clinica/atividades'),
      item('/clinica/faltas'),
      item('/clinica/vacinas'),
      item('/clinica/estoque'),
      item('/clinica/tratamentos'),
      item('/clinica/resumo'),
    ],
  },
  {
    id: 'patients',
    label: 'Pets',
    icon: 'ph ph-heart',
    items: [item('/clinica/pacientes'), item('/clinica/bulario')],
  },
  { id: 'account', label: 'Conta', icon: 'ph ph-user', items: [item('/settings')] },
]

describe('montarEspacos', () => {
  const espacos = montarEspacos(secoes, t)

  it('junta clínica e pets num espaço só e põe o portal depois', () => {
    expect(espacos.map((espaco) => espaco.id)).toEqual(['clinica', 'portal'])
  })

  it('agrupa as telas irmãs como abas de um destino', () => {
    const clinica = espacos[0]!

    expect(clinica.destinos.map((destino) => destino.id)).toEqual([
      'hoje',
      'agenda',
      'pacientes',
      'internacao',
      'pendencias',
      'relatorios',
    ])
    expect(clinica.destinos[1]!.abas.map((aba) => aba.to)).toEqual([
      '/clinica/agenda',
      '/clinica/pedidos',
      '/clinica/fila',
    ])
  })

  it('soma os selos das abas no destino e no espaço, com o tom mais grave', () => {
    const [clinica] = espacos
    const agenda = clinica!.destinos.find((destino) => destino.id === 'agenda')!

    expect(agenda.selo).toBe(6)
    expect(agenda.tom).toBe('atencao')
    expect(clinica!.selo).toBe(8)
    expect(clinica!.tom).toBe('risco')
  })

  it('deixa de fora o destino cujas telas o menu não oferece', () => {
    const semHotel = montarEspacos(secoes, t)

    expect(semHotel.some((espaco) => espaco.id === 'hotel')).toBe(false)
  })

  it('dá ao destino a frase do selo quando só uma aba tem selo', () => {
    const comEquipe: AppNavigationSection[] = [
      {
        ...secoes[0]!,
        items: [
          item('/parceiro/equipe', {
            badge: 1,
            badgeTom: 'neutro',
            badgeTitulo: '1 convite esperando resposta',
          }),
          item('/parceiro/profissionais'),
        ],
      },
    ]
    const equipe = montarEspacos(comEquipe, t)[0]!.destinos.find(
      (destino) => destino.id === '/parceiro/equipe',
    )!

    expect(equipe.abas).toHaveLength(2)
    expect(equipe.tituloDoSelo).toBe('1 convite esperando resposta')

    const agenda = espacos[0]!.destinos.find((destino) => destino.id === 'agenda')!
    expect(agenda.tituloDoSelo).toBeUndefined()
  })
})

describe('localizar', () => {
  const espacos = montarEspacos(secoes, t)

  it('acha o destino e a aba de uma rota de aba', () => {
    const aqui = localizar(espacos, '/clinica/pedidos')

    expect(aqui.espaco?.id).toBe('clinica')
    expect(aqui.destino?.id).toBe('agenda')
    expect(aqui.aba?.to).toBe('/clinica/pedidos')
  })

  it('põe as telas de detalhe no destino delas, sem aba acesa', () => {
    const ficha = localizar(espacos, '/clinica/paciente/pet-mel/resumo')
    const leito = localizar(espacos, '/clinica/internacao/int-bento')

    expect(ficha.destino?.id).toBe('pacientes')
    expect(ficha.aba).toBeNull()
    expect(leito.destino?.id).toBe('internacao')
  })

  it('não acha nada fora do mapa', () => {
    expect(localizar(espacos, '/inicio').destino).toBeNull()
  })
})

describe('tomMaisGrave e lugarDaRota', () => {
  it('escolhe o pior tom', () => {
    expect(tomMaisGrave(['neutro', 'risco', 'atencao'])).toBe('risco')
    expect(tomMaisGrave([undefined])).toBeUndefined()
  })

  it('dá a cor do lugar pela rota', () => {
    expect(lugarDaRota('/clinica/agenda')).toBe('clinica')
    expect(lugarDaRota('/hotel/mapa')).toBe('hotel')
    expect(lugarDaRota('/parceiro/carteira')).toBe('portal')
    expect(lugarDaRota('/settings')).toBe('conta')
    expect(lugarDaRota('/inicio')).toBe('inicio')
  })
})
