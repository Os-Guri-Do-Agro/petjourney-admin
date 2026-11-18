/**
 * A clínica da demonstração: **Vila Madalena Pet**, clínica veterinária em São Paulo, com o
 * módulo Clínica ativo (o Hotel está pausado no portal e fica desligado aqui também).
 *
 * Tudo inventado: pessoas, CRMV, CNPJ, telefones (e-mails em `example.com`, que não existe). É a
 * base que todas as áreas da demonstração usam — mesma equipe, mesmas salas, mesmos tipos — para
 * uma tela não contradizer a outra.
 */
import type { Permissao, NomeDoModulo, ModuloDoPortal } from '@/service/parceiro/acesso-service'
import type { Profissional } from '@/service/parceiro/profissionais-service'
import type { Sala, TipoDeAtendimento } from '@/service/parceiro/agenda-config-service'
import type { PapelOperacional } from '@/service/parceiro/equipe-service'

export const PARCEIRO_ID = 'demo-parceiro-vila-madalena'
export const PARCEIRO_NOME = 'Vila Madalena Pet'
export const SLUG = 'vila-madalena-pet'
export const CNPJ = '41.827.365/0001-08'

export const ENDERECO = {
  cep: '05435-000',
  logradouro: 'Rua Harmonia',
  numero: '412',
  complemento: null as string | null,
  bairro: 'Vila Madalena',
  cidade: 'São Paulo',
  uf: 'SP',
  telefone: '1131234567',
  whatsapp: '11981234567',
  email: 'contato@vilamadalenapet.example.com',
}

/* ---------------------------------------------------------------------------- a equipe */

export type PessoaDaEquipe = {
  usuarioId: string
  nome: string
  email: string
  telefone: string
  papel: 'DONO' | 'OPERADOR'
  papeisOperacionais: PapelOperacional[]
  /** O profissional da agenda, para quem atende. */
  profissionalId: string | null
  entrouEm: string
}

/** A pessoa que entra na demonstração: a dona, veterinária e gestora. */
export const USUARIO_ID = 'demo-usr-marina'

export const EQUIPE: PessoaDaEquipe[] = [
  {
    usuarioId: USUARIO_ID,
    nome: 'Marina Albuquerque',
    email: 'marina@vilamadalenapet.example.com',
    telefone: '11987651201',
    papel: 'DONO',
    papeisOperacionais: ['VETERINARIO', 'GESTOR'],
    profissionalId: 'demo-prof-marina',
    entrouEm: '2025-03-10T09:00:00-03:00',
  },
  {
    usuarioId: 'demo-usr-rafael',
    nome: 'Rafael Nogueira',
    email: 'rafael@vilamadalenapet.example.com',
    telefone: '11987651202',
    papel: 'OPERADOR',
    papeisOperacionais: ['VETERINARIO'],
    profissionalId: 'demo-prof-rafael',
    entrouEm: '2025-04-02T09:00:00-03:00',
  },
  {
    usuarioId: 'demo-usr-camila',
    nome: 'Camila Torres',
    email: 'camila@vilamadalenapet.example.com',
    telefone: '11987651203',
    papel: 'OPERADOR',
    papeisOperacionais: ['VETERINARIO'],
    profissionalId: 'demo-prof-camila',
    entrouEm: '2025-06-16T09:00:00-03:00',
  },
  {
    usuarioId: 'demo-usr-bruno',
    nome: 'Bruno Saito',
    email: 'bruno@vilamadalenapet.example.com',
    telefone: '11987651204',
    papel: 'OPERADOR',
    papeisOperacionais: ['VETERINARIO'],
    profissionalId: 'demo-prof-bruno',
    entrouEm: '2025-09-01T09:00:00-03:00',
  },
  {
    usuarioId: 'demo-usr-juliana',
    nome: 'Juliana Prado',
    email: 'juliana@vilamadalenapet.example.com',
    telefone: '11987651205',
    papel: 'OPERADOR',
    papeisOperacionais: ['RECEPCAO'],
    profissionalId: null,
    entrouEm: '2025-03-12T09:00:00-03:00',
  },
  {
    usuarioId: 'demo-usr-lucas',
    nome: 'Lucas Ferreira',
    email: 'lucas@vilamadalenapet.example.com',
    telefone: '11987651206',
    papel: 'OPERADOR',
    papeisOperacionais: ['ENFERMAGEM'],
    profissionalId: 'demo-prof-lucas',
    entrouEm: '2025-05-05T09:00:00-03:00',
  },
  {
    usuarioId: 'demo-usr-patricia',
    nome: 'Patrícia Lima',
    email: 'patricia@vilamadalenapet.example.com',
    telefone: '11987651207',
    papel: 'OPERADOR',
    papeisOperacionais: ['GESTOR', 'FINANCEIRO'],
    profissionalId: null,
    entrouEm: '2025-03-10T09:00:00-03:00',
  },
]

/** Convite que ainda espera resposta (aparece na Equipe). */
export const CONVITES_PENDENTES = [
  {
    id: 'demo-convite-ana',
    email: 'ana.ribeiro@example.com',
    nome: 'Ana Ribeiro',
    papeisOperacionais: ['ENFERMAGEM'] as PapelOperacional[],
    enviadoHaDias: 2,
  },
]

export function pessoaDaEquipe(usuarioId: string) {
  return EQUIPE.find((p) => p.usuarioId === usuarioId) ?? null
}

/* ----------------------------------------------------------------------- os profissionais */

export const PROFISSIONAIS: Profissional[] = [
  {
    id: 'demo-prof-marina',
    nome: 'Dra. Marina Albuquerque',
    conselho: 'CRMV',
    registro: '21847',
    uf: 'SP',
    crmvConferidoEm: '2025-03-11T10:00:00-03:00',
    especialidades: ['Clínica geral', 'Dermatologia'],
    corIndice: 0,
    atendeNaAgenda: true,
    ativo: true,
    usuarioId: 'demo-usr-marina',
  },
  {
    id: 'demo-prof-rafael',
    nome: 'Dr. Rafael Nogueira',
    conselho: 'CRMV',
    registro: '30512',
    uf: 'SP',
    crmvConferidoEm: '2025-04-03T10:00:00-03:00',
    especialidades: ['Cardiologia', 'Clínica geral'],
    corIndice: 1,
    atendeNaAgenda: true,
    ativo: true,
    usuarioId: 'demo-usr-rafael',
  },
  {
    id: 'demo-prof-camila',
    nome: 'Dra. Camila Torres',
    conselho: 'CRMV',
    registro: '34290',
    uf: 'SP',
    crmvConferidoEm: '2025-06-17T10:00:00-03:00',
    especialidades: ['Medicina felina'],
    corIndice: 2,
    atendeNaAgenda: true,
    ativo: true,
    usuarioId: 'demo-usr-camila',
  },
  {
    id: 'demo-prof-bruno',
    nome: 'Dr. Bruno Saito',
    conselho: 'CRMV',
    registro: '28733',
    uf: 'SP',
    crmvConferidoEm: '2025-09-02T10:00:00-03:00',
    especialidades: ['Animais exóticos', 'Cirurgia'],
    corIndice: 3,
    atendeNaAgenda: true,
    ativo: true,
    usuarioId: 'demo-usr-bruno',
  },
  {
    /* A enfermagem tem ficha (plantão, doses e evoluções da internação), mas não atende na agenda. */
    id: 'demo-prof-lucas',
    nome: 'Lucas Ferreira',
    conselho: 'NENHUM',
    registro: null,
    uf: null,
    crmvConferidoEm: null,
    especialidades: ['Enfermagem veterinária'],
    corIndice: 4,
    atendeNaAgenda: false,
    ativo: true,
    usuarioId: 'demo-usr-lucas',
  },
]

export function profissional(id: string) {
  return PROFISSIONAIS.find((p) => p.id === id) ?? null
}

/**
 * Quem atende em cada dia da semana (0 = domingo) e em que horário. Sábado é meio período; domingo
 * a clínica fecha.
 */
export const EXPEDIENTE_DOS_PROFISSIONAIS: Record<
  string,
  Partial<Record<number, { inicio: string; fim: string }>>
> = {
  'demo-prof-marina': {
    1: { inicio: '08:00', fim: '17:00' },
    2: { inicio: '08:00', fim: '17:00' },
    3: { inicio: '08:00', fim: '17:00' },
    4: { inicio: '08:00', fim: '17:00' },
    5: { inicio: '08:00', fim: '17:00' },
  },
  'demo-prof-rafael': {
    1: { inicio: '10:00', fim: '19:00' },
    2: { inicio: '10:00', fim: '19:00' },
    3: { inicio: '10:00', fim: '19:00' },
    4: { inicio: '10:00', fim: '19:00' },
    5: { inicio: '10:00', fim: '19:00' },
  },
  'demo-prof-camila': {
    2: { inicio: '08:00', fim: '17:00' },
    3: { inicio: '08:00', fim: '17:00' },
    4: { inicio: '08:00', fim: '17:00' },
    5: { inicio: '08:00', fim: '17:00' },
    6: { inicio: '08:00', fim: '13:00' },
  },
  'demo-prof-bruno': {
    1: { inicio: '08:00', fim: '17:00' },
    3: { inicio: '08:00', fim: '17:00' },
    5: { inicio: '08:00', fim: '17:00' },
    6: { inicio: '08:00', fim: '13:00' },
  },
}

/** O horário da casa. */
export const EXPEDIENTE_DA_CLINICA: Partial<Record<number, { inicio: string; fim: string }>> = {
  1: { inicio: '08:00', fim: '19:00' },
  2: { inicio: '08:00', fim: '19:00' },
  3: { inicio: '08:00', fim: '19:00' },
  4: { inicio: '08:00', fim: '19:00' },
  5: { inicio: '08:00', fim: '19:00' },
  6: { inicio: '08:00', fim: '13:00' },
}

export const ALMOCO = { inicio: '12:00', fim: '13:00' }

/* ------------------------------------------------------------------------- salas e tipos */

export const SALAS: Sala[] = [
  { id: 'demo-sala-c1', nome: 'Consultório 1', tipo: 'CONSULTORIO', ativa: true, ordem: 1 },
  { id: 'demo-sala-c2', nome: 'Consultório 2', tipo: 'CONSULTORIO', ativa: true, ordem: 2 },
  { id: 'demo-sala-c3', nome: 'Consultório 3', tipo: 'CONSULTORIO', ativa: true, ordem: 3 },
  { id: 'demo-sala-c4', nome: 'Consultório 4', tipo: 'CONSULTORIO', ativa: true, ordem: 4 },
  { id: 'demo-sala-vac', nome: 'Sala de vacina', tipo: 'EXAME', ativa: true, ordem: 5 },
  { id: 'demo-sala-cir', nome: 'Centro cirúrgico', tipo: 'CIRURGIA', ativa: true, ordem: 6 },
  { id: 'demo-sala-int', nome: 'Internação', tipo: 'INTERNACAO', ativa: true, ordem: 7 },
]

/** A sala de cada profissional, quando a consulta não pede outra. */
export const SALA_PADRAO: Record<string, string> = {
  'demo-prof-marina': 'demo-sala-c1',
  'demo-prof-rafael': 'demo-sala-c2',
  'demo-prof-camila': 'demo-sala-c3',
  'demo-prof-bruno': 'demo-sala-c4',
}

export const TIPOS: TipoDeAtendimento[] = [
  {
    id: 'demo-tipo-consulta',
    nome: 'Consulta',
    kind: 'CONSULTA',
    duracaoMinutos: 30,
    salasCompativeis: ['CONSULTORIO'],
    permiteEncaixe: true,
    ofertadoOnline: true,
    podeSerOfertadoOnline: true,
    ativo: true,
    ordem: 1,
  },
  {
    id: 'demo-tipo-retorno',
    nome: 'Retorno',
    kind: 'RETORNO',
    duracaoMinutos: 20,
    salasCompativeis: ['CONSULTORIO'],
    permiteEncaixe: true,
    ofertadoOnline: true,
    podeSerOfertadoOnline: true,
    ativo: true,
    ordem: 2,
  },
  {
    id: 'demo-tipo-vacina',
    nome: 'Vacinação',
    kind: 'VACINA',
    duracaoMinutos: 15,
    salasCompativeis: ['EXAME', 'CONSULTORIO'],
    permiteEncaixe: true,
    ofertadoOnline: true,
    podeSerOfertadoOnline: true,
    ativo: true,
    ordem: 3,
  },
  {
    id: 'demo-tipo-exame',
    nome: 'Coleta de exames',
    kind: 'EXAME',
    duracaoMinutos: 15,
    salasCompativeis: ['EXAME'],
    permiteEncaixe: true,
    ofertadoOnline: false,
    podeSerOfertadoOnline: true,
    ativo: true,
    ordem: 4,
  },
  {
    id: 'demo-tipo-cirurgia',
    nome: 'Cirurgia eletiva',
    kind: 'CIRURGIA',
    duracaoMinutos: 90,
    salasCompativeis: ['CIRURGIA'],
    permiteEncaixe: false,
    ofertadoOnline: false,
    podeSerOfertadoOnline: false,
    ativo: true,
    ordem: 5,
  },
  {
    id: 'demo-tipo-emergencia',
    nome: 'Emergência',
    kind: 'EMERGENCIA',
    duracaoMinutos: 30,
    salasCompativeis: ['CONSULTORIO'],
    permiteEncaixe: true,
    ofertadoOnline: false,
    podeSerOfertadoOnline: false,
    ativo: true,
    ordem: 6,
  },
]

export function tipo(id: string) {
  return TIPOS.find((t) => t.id === id) ?? null
}

export function sala(id: string) {
  return SALAS.find((s) => s.id === id) ?? null
}

/* --------------------------------------------------------------------- módulos e acesso */

/** Todas as permissões: quem entra é a dona. */
export const PERMISSOES: Permissao[] = [
  'equipe.gerir',
  'estabelecimento.editar',
  'modulos.solicitar',
  'paciente.ler',
  'paciente.escrever',
  'agenda.ler',
  'agenda.escrever',
  'pedido.responder',
  'fila.gerir',
  'prontuario.ler',
  'prontuario.escrever',
  'prontuario.finalizar',
  'resumo.liberar',
  'receita.assinar',
  'vacina.aplicar',
  'catalogo.gerir',
  'copia.gerir',
  'internacao.prescrever',
  'internacao.executar',
  'boletim.compor',
  'boletim.enviar',
  'estoque.ler',
  'estoque.movimentar',
  'estoque.planejar',
  'importacao.executar',
  'auditoria.ler',
  'financeiro.ler',
  'financeiro.gerir',
]

export function modulos(): ModuloDoPortal[] {
  const clinica: ModuloDoPortal = {
    modulo: 'CLINICA' satisfies NomeDoModulo,
    status: 'ATIVO',
    ativoAte: null,
    podeLer: true,
    podeEscrever: true,
    motivoSomenteLeitura: null,
    podeSolicitar: false,
    origem: 'PLANO',
    desligadoPeloDono: false,
    podeLigar: false,
    ligarVira: null,
    bloqueioAoLigar: 'MODULO_JA_ATIVO',
    podeDesligar: true,
    diasDeTesteGratis: 30,
  }
  const hotel: ModuloDoPortal = {
    modulo: 'HOTEL',
    status: null,
    ativoAte: null,
    podeLer: false,
    podeEscrever: false,
    motivoSomenteLeitura: null,
    podeSolicitar: false,
    origem: null,
    desligadoPeloDono: false,
    podeLigar: false,
    ligarVira: null,
    bloqueioAoLigar: 'MODULO_FORA_DA_CATEGORIA',
    podeDesligar: false,
    diasDeTesteGratis: 30,
  }
  return [clinica, hotel]
}
