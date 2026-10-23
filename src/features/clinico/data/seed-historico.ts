/**
 * Semente do histórico que viaja com o pet (doc 19).
 *
 * Três situações, cada uma um caso do requisito:
 *
 * - **Thor (Eduardo)** chegou há três semanas com o histórico da clínica de antes. A clínica de
 *   antes continua com acesso — o responsável trocou de clínica depois de um desentendimento e
 *   não encerrou — e ainda abriu a ficha anteontem. É o caso "trocou por conflito": encerrar
 *   precisa ser imediato e sem constrangimento.
 * - **Nina (Camila)** tem o acesso desta clínica vencido no prazo, e o da clínica de oncologia
 *   valendo. É o acesso que termina sozinho, visto dos dois lados.
 * - **Fubá (Renata)** só existe no app. A Renata gerou hoje cedo um código para a primeira
 *   consulta; a recepção ainda não digitou. É o paciente novo chegando com o histórico completo.
 *
 * As coleiras de demonstração são as dos três: o QR abre a ficha pública, e o profissional com
 * CRMV abre a de emergência.
 */

import { addDays } from '../domain/clinic-time'
import type {
  AberturaDoHistorico,
  AcessoAoHistorico,
  ItemDoHistorico,
  OrigemDoItem,
} from '../domain/historico-compartilhado'

import { PET_SEM_VINCULO, RESPONSAVEL_SEM_VINCULO } from './seed-pedidos'
import type { Clinic, ISODate, ISODateTime } from './types'

/** O QR da coleira aponta para um código; o código aponta para o pet. */
export type ColeiraDoPet = { codigo: string; petId: string }

/** O aviso que o responsável recebe no celular. Por enquanto, só o da ficha de emergência aberta. */
export type AvisoDoHistorico = {
  id: string
  tutorId: string
  petId: string
  em: ISODateTime
  aberturaId: string
}

export type SementeDoHistorico = {
  /** O histórico de cada pet como o app guarda: de todas as clínicas e do que a casa anotou. */
  itensPorPet: Record<string, ItemDoHistorico[]>
  acessos: AcessoAoHistorico[]
  aberturas: AberturaDoHistorico[]
  avisos: AvisoDoHistorico[]
  coleiras: ColeiraDoPet[]
}

export const PET_DO_CONFLITO = 'pet-thor'
export const RESPONSAVEL_DO_CONFLITO = 'tutor-eduardo'
export const PET_DO_PRAZO = 'pet-nina'
export const RESPONSAVEL_DO_PRAZO = 'tutor-camila'
/** O código que a Renata mostra na recepção na primeira consulta do Fubá. */
export const CODIGO_DA_PRIMEIRA_VEZ = '729154'

const CLINICA_DE_ANTES = { id: 'parceiro-vet-cuidar', nome: 'Clínica Veterinária Cuidar' }
const CLINICA_DO_FUBA = 'Clínica Bem-Estar Pinheiros'
const CLINICA_DE_ONCOLOGIA = { id: 'parceiro-onco-pet', nome: 'Onco Pet Centro Veterinário' }

type Entrada = {
  hoje: ISODate
  iso: (date: ISODate, minutes: number) => ISODateTime
  clinic: Clinic
}

const daClinica = (local: string, profissional: string | null): OrigemDoItem => ({
  tipo: 'CLINICA',
  local,
  profissional,
})

const doResponsavel: OrigemDoItem = { tipo: 'RESPONSAVEL', local: '', profissional: null }

export function semearHistoricoCompartilhado({ hoje, iso, clinic }: Entrada): SementeDoHistorico {
  const dia = (dias: number) => addDays(hoje, dias)
  const momento = (dias: number, hora: number, minuto = 0) => iso(dia(dias), hora * 60 + minuto)

  const rogerio = 'Rogério Lins · CRMV-SP 28877'
  const livia = 'Lívia Moura · CRMV-SP 47215'
  const paulo = 'Paulo Arruda · CRMV-SP 31560'

  const itensPorPet: Record<string, ItemDoHistorico[]> = {
    [PET_DO_CONFLITO]: [
      {
        id: 'hist-thor-dx-1',
        categoria: 'DIAGNOSTICOS',
        titulo: 'Displasia coxofemoral leve',
        detalhe: 'Bilateral, pior à esquerda. Controle de peso e exercício sem impacto.',
        em: dia(-420),
        origem: daClinica(CLINICA_DE_ANTES.nome, rogerio),
        marcador: 'ativo',
      },
      {
        id: 'hist-thor-dx-2',
        categoria: 'DIAGNOSTICOS',
        titulo: 'Otite externa',
        detalhe: 'Orelha direita. Resolvida com o tratamento tópico.',
        em: dia(-540),
        origem: daClinica(CLINICA_DE_ANTES.nome, rogerio),
        marcador: null,
      },
      {
        id: 'hist-thor-med-1',
        categoria: 'MEDICAMENTOS',
        titulo: 'Condroitina e glicosamina',
        detalhe: '1 comprimido ao dia, com a refeição',
        em: dia(-420),
        origem: daClinica(CLINICA_DE_ANTES.nome, rogerio),
        marcador: 'continuo',
      },
      {
        id: 'hist-thor-med-2',
        categoria: 'MEDICAMENTOS',
        titulo: 'Carprofeno 2 mg/kg',
        detalhe: 'Se dor depois do passeio, no máximo 5 dias',
        em: dia(-420),
        origem: daClinica(CLINICA_DE_ANTES.nome, rogerio),
        marcador: null,
      },
      {
        id: 'hist-thor-vac-1',
        categoria: 'VACINAS',
        titulo: 'V10',
        detalhe: 'Dose anual',
        em: dia(-410),
        origem: daClinica(CLINICA_DE_ANTES.nome, rogerio),
        marcador: null,
      },
      {
        id: 'hist-thor-vac-2',
        categoria: 'VACINAS',
        titulo: 'Antirrábica',
        detalhe: 'Dose anual',
        em: dia(-410),
        origem: daClinica(CLINICA_DE_ANTES.nome, rogerio),
        marcador: null,
      },
      {
        id: 'hist-thor-peso-1',
        categoria: 'PESO',
        titulo: '43,8 kg',
        detalhe: 'Balança de casa',
        em: dia(-73),
        origem: doResponsavel,
        marcador: null,
      },
      {
        id: 'hist-thor-peso-2',
        categoria: 'PESO',
        titulo: '44,6 kg',
        detalhe: 'Pesado na consulta',
        em: dia(-410),
        origem: daClinica(CLINICA_DE_ANTES.nome, rogerio),
        marcador: null,
      },
      {
        id: 'hist-thor-doc-1',
        categoria: 'DOCUMENTOS',
        titulo: 'Raio-X de quadril, laudo',
        detalhe: 'PDF, 2 páginas',
        em: dia(-420),
        origem: daClinica(CLINICA_DE_ANTES.nome, rogerio),
        marcador: null,
      },
      {
        id: 'hist-thor-dia-1',
        categoria: 'DIARIO',
        titulo: 'Mancou da pata traseira esquerda',
        detalhe: 'Depois do passeio longo de domingo. No dia seguinte já andava normal.',
        em: dia(-20),
        origem: doResponsavel,
        marcador: null,
      },
    ],
    [PET_SEM_VINCULO]: [
      {
        id: 'hist-fuba-al-1',
        categoria: 'ALERGIAS',
        titulo: 'Amoxicilina com clavulanato',
        detalhe: 'Urticária e inchaço no focinho meia hora depois da primeira dose.',
        em: dia(-380),
        origem: daClinica(CLINICA_DO_FUBA, livia),
        marcador: 'grave',
      },
      {
        id: 'hist-fuba-dx-1',
        categoria: 'DIAGNOSTICOS',
        titulo: 'Epilepsia idiopática',
        detalhe: 'Crises curtas, sem perda de consciência prolongada. Controlada com fenobarbital.',
        em: dia(-400),
        origem: daClinica(CLINICA_DO_FUBA, livia),
        marcador: 'ativo',
      },
      {
        id: 'hist-fuba-dx-2',
        categoria: 'DIAGNOSTICOS',
        titulo: 'Giardíase',
        detalhe: 'Tratada e com exame de controle negativo.',
        em: dia(-520),
        origem: daClinica(CLINICA_DO_FUBA, livia),
        marcador: null,
      },
      {
        id: 'hist-fuba-med-1',
        categoria: 'MEDICAMENTOS',
        titulo: 'Fenobarbital 2,5 mg/kg',
        detalhe: 'De 12 em 12 horas, sem pular dose',
        em: dia(-400),
        origem: daClinica(CLINICA_DO_FUBA, livia),
        marcador: 'continuo',
      },
      {
        id: 'hist-fuba-vac-1',
        categoria: 'VACINAS',
        titulo: 'V10',
        detalhe: 'Dose anual',
        em: dia(-200),
        origem: daClinica(CLINICA_DO_FUBA, livia),
        marcador: null,
      },
      {
        id: 'hist-fuba-vac-2',
        categoria: 'VACINAS',
        titulo: 'Antirrábica',
        detalhe: 'Dose anual',
        em: dia(-200),
        origem: daClinica(CLINICA_DO_FUBA, livia),
        marcador: null,
      },
      {
        id: 'hist-fuba-peso-1',
        categoria: 'PESO',
        titulo: '12,6 kg',
        detalhe: 'Balança de casa',
        em: dia(-12),
        origem: doResponsavel,
        marcador: null,
      },
      {
        id: 'hist-fuba-doc-1',
        categoria: 'DOCUMENTOS',
        titulo: 'Fenobarbital sérico, resultado',
        detalhe: 'PDF, 1 página',
        em: dia(-60),
        origem: daClinica(CLINICA_DO_FUBA, livia),
        marcador: null,
      },
      {
        id: 'hist-fuba-dia-1',
        categoria: 'DIARIO',
        titulo: 'Crise de um minuto às 22h',
        detalhe: 'Voltou ao normal em uns dez minutos. Dei a dose da noite no horário.',
        em: dia(-9),
        origem: doResponsavel,
        marcador: null,
      },
    ],
    [PET_DO_PRAZO]: [
      {
        id: 'hist-nina-al-1',
        categoria: 'ALERGIAS',
        titulo: 'Dipirona',
        detalhe: 'Vômito e prostração no mesmo dia.',
        em: null,
        origem: daClinica(CLINICA_DE_ONCOLOGIA.nome, paulo),
        marcador: 'grave',
      },
      {
        id: 'hist-nina-dx-1',
        categoria: 'DIAGNOSTICOS',
        titulo: 'Linfoma multicêntrico',
        detalhe: 'Em quimioterapia, protocolo oral.',
        em: dia(-120),
        origem: daClinica(CLINICA_DE_ONCOLOGIA.nome, paulo),
        marcador: 'ativo',
      },
      {
        id: 'hist-nina-med-1',
        categoria: 'MEDICAMENTOS',
        titulo: 'Clorambucil 2 mg',
        detalhe: 'Em dias alternados, com luva ao manipular',
        em: dia(-118),
        origem: daClinica(CLINICA_DE_ONCOLOGIA.nome, paulo),
        marcador: 'continuo',
      },
      {
        id: 'hist-nina-med-2',
        categoria: 'MEDICAMENTOS',
        titulo: 'Prednisolona 0,5 mg/kg',
        detalhe: '1 vez ao dia, de manhã',
        em: dia(-118),
        origem: daClinica(CLINICA_DE_ONCOLOGIA.nome, paulo),
        marcador: 'continuo',
      },
      {
        id: 'hist-nina-peso-1',
        categoria: 'PESO',
        titulo: '6,4 kg',
        detalhe: 'Balança de casa',
        em: dia(-5),
        origem: doResponsavel,
        marcador: null,
      },
      {
        id: 'hist-nina-doc-1',
        categoria: 'DOCUMENTOS',
        titulo: 'Hemograma de controle',
        detalhe: 'PDF, 1 página',
        em: dia(-14),
        origem: daClinica(CLINICA_DE_ONCOLOGIA.nome, paulo),
        marcador: null,
      },
      {
        id: 'hist-nina-dia-1',
        categoria: 'DIARIO',
        titulo: 'Comeu metade da ração',
        detalhe: 'Bebeu água normalmente e fez cocô firme.',
        em: dia(-2),
        origem: doResponsavel,
        marcador: null,
      },
    ],
  }

  const acessos: AcessoAoHistorico[] = [
    {
      id: 'acesso-thor-aqui',
      codigo: '418207',
      petId: PET_DO_CONFLITO,
      tutorId: RESPONSAVEL_DO_CONFLITO,
      parceiroId: clinic.id,
      parceiroNome: clinic.nome,
      categorias: ['ALERGIAS', 'MEDICAMENTOS', 'DIAGNOSTICOS', 'VACINAS', 'PESO', 'DOCUMENTOS'],
      liberadoEm: momento(-20, 19, 40),
      expiraEm: momento(10, 19, 40),
      vinculadoEm: momento(-19, 9, 12),
      encerradoEm: null,
    },
    {
      id: 'acesso-thor-antes',
      codigo: '502731',
      petId: PET_DO_CONFLITO,
      tutorId: RESPONSAVEL_DO_CONFLITO,
      parceiroId: CLINICA_DE_ANTES.id,
      parceiroNome: CLINICA_DE_ANTES.nome,
      categorias: ['ALERGIAS', 'MEDICAMENTOS', 'DIAGNOSTICOS', 'VACINAS', 'PESO', 'DOCUMENTOS'],
      liberadoEm: momento(-25, 10, 5),
      expiraEm: momento(5, 10, 5),
      vinculadoEm: momento(-25, 10, 20),
      encerradoEm: null,
    },
    {
      id: 'acesso-nina-aqui',
      codigo: '663041',
      petId: PET_DO_PRAZO,
      tutorId: RESPONSAVEL_DO_PRAZO,
      parceiroId: clinic.id,
      parceiroNome: clinic.nome,
      categorias: ['ALERGIAS', 'MEDICAMENTOS', 'DIAGNOSTICOS', 'PESO'],
      liberadoEm: momento(-35, 8, 30),
      expiraEm: momento(-5, 8, 30),
      vinculadoEm: momento(-35, 8, 50),
      encerradoEm: null,
    },
    {
      id: 'acesso-nina-onco',
      codigo: '784259',
      petId: PET_DO_PRAZO,
      tutorId: RESPONSAVEL_DO_PRAZO,
      parceiroId: CLINICA_DE_ONCOLOGIA.id,
      parceiroNome: CLINICA_DE_ONCOLOGIA.nome,
      categorias: ['ALERGIAS', 'MEDICAMENTOS', 'DIAGNOSTICOS', 'PESO', 'DOCUMENTOS', 'DIARIO'],
      liberadoEm: momento(-15, 15, 0),
      expiraEm: momento(15, 15, 0),
      vinculadoEm: momento(-15, 15, 10),
      encerradoEm: null,
    },
    {
      id: 'acesso-fuba-codigo',
      codigo: CODIGO_DA_PRIMEIRA_VEZ,
      petId: PET_SEM_VINCULO,
      tutorId: RESPONSAVEL_SEM_VINCULO,
      parceiroId: null,
      parceiroNome: null,
      categorias: ['ALERGIAS', 'MEDICAMENTOS', 'DIAGNOSTICOS', 'VACINAS', 'PESO', 'DOCUMENTOS'],
      liberadoEm: momento(0, 7, 42),
      expiraEm: momento(30, 7, 42),
      vinculadoEm: null,
      encerradoEm: null,
    },
  ]

  const aberturas: AberturaDoHistorico[] = [
    {
      id: 'abertura-thor-1',
      petId: PET_DO_CONFLITO,
      acessoId: 'acesso-thor-aqui',
      canal: 'FICHA',
      em: momento(-19, 9, 15),
      profissionalNome: 'Ana Ribeiro',
      conselho: 'CRMV-SP 41208',
      parceiroNome: clinic.nome,
      categorias: ['ALERGIAS', 'MEDICAMENTOS', 'DIAGNOSTICOS', 'VACINAS'],
    },
    {
      id: 'abertura-thor-2',
      petId: PET_DO_CONFLITO,
      acessoId: 'acesso-thor-aqui',
      canal: 'FICHA',
      em: momento(-3, 14, 20),
      profissionalNome: 'Caio Nogueira',
      conselho: 'CRMV-SP 39877',
      parceiroNome: clinic.nome,
      categorias: ['DIAGNOSTICOS', 'DOCUMENTOS'],
    },
    {
      id: 'abertura-thor-antes-1',
      petId: PET_DO_CONFLITO,
      acessoId: 'acesso-thor-antes',
      canal: 'FICHA',
      em: momento(-24, 10, 5),
      profissionalNome: 'Rogério Lins',
      conselho: 'CRMV-SP 28877',
      parceiroNome: CLINICA_DE_ANTES.nome,
      categorias: ['DIAGNOSTICOS'],
    },
    {
      id: 'abertura-thor-antes-2',
      petId: PET_DO_CONFLITO,
      acessoId: 'acesso-thor-antes',
      canal: 'FICHA',
      em: momento(-2, 18, 40),
      profissionalNome: 'Rogério Lins',
      conselho: 'CRMV-SP 28877',
      parceiroNome: CLINICA_DE_ANTES.nome,
      categorias: ['VACINAS', 'PESO'],
    },
    {
      id: 'abertura-nina-1',
      petId: PET_DO_PRAZO,
      acessoId: 'acesso-nina-aqui',
      canal: 'FICHA',
      em: momento(-30, 16, 10),
      profissionalNome: 'Helena Vasconcelos Prado',
      conselho: 'CRMV-SP 45610',
      parceiroNome: clinic.nome,
      categorias: ['ALERGIAS', 'MEDICAMENTOS'],
    },
    {
      id: 'abertura-nina-onco-1',
      petId: PET_DO_PRAZO,
      acessoId: 'acesso-nina-onco',
      canal: 'FICHA',
      em: momento(-6, 11, 30),
      profissionalNome: 'Paulo Arruda',
      conselho: 'CRMV-SP 31560',
      parceiroNome: CLINICA_DE_ONCOLOGIA.nome,
      categorias: ['MEDICAMENTOS', 'DIARIO'],
    },
  ]

  return {
    itensPorPet,
    acessos,
    aberturas,
    avisos: [],
    coleiras: [
      { codigo: 'thor-7h2k', petId: PET_DO_CONFLITO },
      { codigo: 'fuba-3k9p', petId: PET_SEM_VINCULO },
      { codigo: 'nina-6w4t', petId: PET_DO_PRAZO },
    ],
  }
}
