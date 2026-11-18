/**
 * Os catálogos clínicos da demonstração: medicamentos (o bulário), diagnósticos, exames, vacinas e
 * as faixas de referência dos sinais vitais. O global da PetJourney aparece revisado; a clínica tem
 * alguns acréscimos próprios (`origem: 'PARCEIRO'`), que a Configuração › Catálogo lista e edita.
 *
 * Exporta:
 * - `MEDICAMENTOS`, `DIAGNOSTICOS`, `EXAMES`, `VACINAS` (forma "admin", com `traducoes`) e as
 *   consultas `medicamento(id)`, `diagnostico(codigo)`, `exame(nome)`;
 * - `VACINAS_DO_CATALOGO`: os ids das vacinas (`demo-vac-*`), para a área de vacinas usar os mesmos;
 * - `buscarMedicamentos`, `buscarDiagnosticos`, `pacoteDeCatalogos`, `acrescimos`;
 * - `faixasDoPaciente`, `faixaDoVital`, `statusDoVital`, `faixaEtariaDe`, `porteDe`;
 * - `calcularDose` (a conta da dose, igual à que o prontuário usa na prescrição).
 */
import type {
  Acrescimos,
  Diagnostico,
  EspecieDoCatalogo,
  Exame,
  FaixasDoPaciente,
  Medicamento,
  PacoteDeCatalogos,
  PedidoDeDose,
  ResultadoDaDose,
  Vacina,
} from '@/service/parceiro/catalogos-service'
import type {
  DiagnosticoAdminDto,
  ExameAdminDto,
  FaixaDeReferenciaDto,
  MedicamentoAdminDto,
  VacinaAdminDto,
} from '@/service/contrato/openapi'

import { normalizar } from '../roteador'
import { diasEntre, hoje } from '../relogio'
import { paciente as pacienteDaBase } from '../base/cadastro'

export type Via = MedicamentoAdminDto['viasPermitidas'][number]
export type Unidade = MedicamentoAdminDto['unidadeApresentacao']
export type Classe = MedicamentoAdminDto['classe']
export type Cuidado = MedicamentoAdminDto['cuidados'][number]
export type Sistema = NonNullable<DiagnosticoAdminDto['sistema']>
export type Vital = FaixaDeReferenciaDto['vital']
export type Porte = FaixaDeReferenciaDto['porte']
export type FaixaEtaria = FaixaDeReferenciaDto['faixaEtaria']

const FONTE = "Plumb's Veterinary Drug Handbook, 10ª ed."
const REVISADO_POR = 'Responsável técnico PetJourney'
const REVISADO_EM = '2026-08-12T14:00:00-03:00'

/* ---------------------------------------------------------------------------- medicamentos */

type DoseDaTabela = [EspecieDoCatalogo, number, number, number, number | null, string?, boolean?]

type MedicamentoDaTabela = {
  id: string
  nome: string
  principio: string
  sinonimos?: string[]
  apresentacao: string
  concentracao: number
  unidade: Unidade
  classe: Classe
  controle?: MedicamentoAdminDto['controle']
  lista?: string
  manipulado?: boolean
  vias: Via[]
  usual: [number, number]
  indicacoes: string[]
  contra?: string[]
  efeitos?: string[]
  interacoes?: string[]
  cuidados?: Cuidado[]
  observacao?: string
  doses: DoseDaTabela[]
  daClinica?: boolean
  inativo?: boolean
}

const TABELA_DE_MEDICAMENTOS: MedicamentoDaTabela[] = [
  {
    id: 'demo-med-amoxiclav-250',
    nome: 'Amoxicilina + clavulanato 250 mg',
    principio: 'Amoxicilina + ácido clavulânico',
    sinonimos: ['amoxiclav', 'clavulin'],
    apresentacao: 'Comprimido 250 mg',
    concentracao: 250,
    unidade: 'COMPRIMIDO',
    classe: 'ANTIBIOTICO',
    vias: ['ORAL'],
    usual: [12.5, 25],
    indicacoes: [
      'Piodermite',
      'Infecção de pele e tecidos moles',
      'Infecção urinária',
      'Doença periodontal',
    ],
    contra: ['Hipersensibilidade a penicilinas', 'Coelhos e roedores herbívoros (disbiose grave)'],
    efeitos: ['Vômito', 'Diarreia', 'Inapetência'],
    interacoes: ['Antibióticos bacteriostáticos (tetraciclinas) reduzem o efeito'],
    observacao: 'Dar junto com a refeição para reduzir o desconforto gástrico.',
    doses: [
      ['CACHORRO', 12.5, 25, 12, 10],
      ['GATO', 12.5, 25, 12, 10],
      ['COELHO', 0, 0, 12, null, 'Contraindicado: risco de enterotoxemia por disbiose.', true],
      ['ROEDOR', 0, 0, 12, null, 'Contraindicado em porquinho-da-índia e hamster.', true],
    ],
  },
  {
    id: 'demo-med-cefalexina-500',
    nome: 'Cefalexina 500 mg',
    principio: 'Cefalexina',
    apresentacao: 'Comprimido 500 mg',
    concentracao: 500,
    unidade: 'COMPRIMIDO',
    classe: 'ANTIBIOTICO',
    vias: ['ORAL'],
    usual: [22, 30],
    indicacoes: ['Piodermite superficial e profunda', 'Infecção de ferida'],
    efeitos: ['Vômito', 'Salivação', 'Diarreia'],
    doses: [
      ['CACHORRO', 22, 30, 12, 21],
      ['GATO', 22, 30, 12, 14],
    ],
  },
  {
    id: 'demo-med-enrofloxacino-50',
    nome: 'Enrofloxacino 50 mg',
    principio: 'Enrofloxacino',
    sinonimos: ['baytril'],
    apresentacao: 'Comprimido 50 mg',
    concentracao: 50,
    unidade: 'COMPRIMIDO',
    classe: 'ANTIBIOTICO',
    vias: ['ORAL', 'SUBCUTANEA'],
    usual: [5, 10],
    indicacoes: ['Infecção urinária', 'Infecção respiratória', 'Infecções em exóticos'],
    contra: ['Cães em crescimento (lesão de cartilagem)'],
    efeitos: ['Vômito', 'Inapetência'],
    cuidados: ['FILHOTE'],
    doses: [
      ['CACHORRO', 5, 10, 24, 10],
      ['GATO', 5, 5, 24, 7, 'Não passar de 5 mg/kg/dia: risco de degeneração de retina.'],
      ['COELHO', 5, 10, 12, 10],
      ['ROEDOR', 5, 10, 12, 10],
      ['AVE', 10, 15, 12, 10],
      ['REPTIL', 5, 10, 48, 14],
    ],
  },
  {
    id: 'demo-med-enrofloxacino-25ml',
    nome: 'Enrofloxacino 2,5% solução',
    principio: 'Enrofloxacino',
    sinonimos: ['baytril 2,5%'],
    apresentacao: 'Solução 25 mg/mL, frasco de 10 mL',
    concentracao: 25,
    unidade: 'ML',
    classe: 'ANTIBIOTICO',
    vias: ['ORAL', 'SUBCUTANEA', 'INTRAMUSCULAR'],
    usual: [5, 15],
    indicacoes: ['Infecções em aves, répteis, coelhos e roedores'],
    observacao: 'Por via oral, diluir em água ou suco de fruta para mascarar o sabor amargo.',
    doses: [
      ['AVE', 10, 15, 12, 10],
      ['REPTIL', 5, 10, 48, 14],
      ['COELHO', 5, 10, 12, 10],
      ['ROEDOR', 5, 10, 12, 10],
    ],
  },
  {
    id: 'demo-med-metronidazol-250',
    nome: 'Metronidazol 250 mg',
    principio: 'Metronidazol',
    apresentacao: 'Comprimido 250 mg',
    concentracao: 250,
    unidade: 'COMPRIMIDO',
    classe: 'ANTIBIOTICO',
    vias: ['ORAL'],
    usual: [10, 15],
    indicacoes: ['Giardíase', 'Diarreia por supercrescimento bacteriano'],
    efeitos: ['Salivação (sabor amargo)', 'Sinais neurológicos em dose alta'],
    doses: [
      ['CACHORRO', 10, 15, 12, 7],
      ['GATO', 10, 15, 12, 7, 'Amargo: dar dentro de cápsula vazia ou petisco.'],
    ],
  },
  {
    id: 'demo-med-doxiciclina-100',
    nome: 'Doxiciclina 100 mg',
    principio: 'Doxiciclina',
    apresentacao: 'Comprimido 100 mg',
    concentracao: 100,
    unidade: 'COMPRIMIDO',
    classe: 'ANTIBIOTICO',
    vias: ['ORAL'],
    usual: [5, 10],
    indicacoes: ['Erliquiose', 'Traqueobronquite infecciosa', 'Micoplasmose felina'],
    efeitos: ['Esofagite se o comprimido ficar parado no esôfago'],
    observacao: 'Oferecer água logo depois do comprimido.',
    doses: [
      ['CACHORRO', 5, 10, 12, 28],
      ['GATO', 5, 5, 12, 14, 'Sempre seguida de água: risco de estenose esofágica.'],
    ],
  },
  {
    id: 'demo-med-meloxicam-05',
    nome: 'Meloxicam 0,5 mg/mL suspensão oral',
    principio: 'Meloxicam',
    sinonimos: ['maxicam', 'metacam'],
    apresentacao: 'Suspensão oral 0,5 mg/mL, frasco de 20 mL',
    concentracao: 0.5,
    unidade: 'ML',
    classe: 'ANTI_INFLAMATORIO',
    vias: ['ORAL', 'SUBCUTANEA'],
    usual: [0.05, 0.1],
    indicacoes: ['Dor e inflamação musculoesquelética', 'Analgesia pós-operatória', 'Osteoartrite'],
    contra: ['Doença renal descompensada', 'Desidratação', 'Úlcera gastrointestinal'],
    efeitos: ['Vômito', 'Fezes escuras', 'Inapetência'],
    interacoes: ['Corticoides', 'Outros anti-inflamatórios não esteroides'],
    cuidados: ['RENAL', 'GASTRICO', 'IDOSO', 'GESTANTE'],
    doses: [
      ['CACHORRO', 0.05, 0.1, 24, 5],
      ['GATO', 0.025, 0.05, 24, 3, 'Uso curto; evitar em doença renal crônica.'],
      ['COELHO', 0.3, 0.6, 24, 5],
      ['ROEDOR', 0.5, 1, 24, 5],
      ['AVE', 0.5, 1.6, 12, 5],
      ['REPTIL', 0.1, 0.2, 24, 5],
    ],
  },
  {
    id: 'demo-med-carprofeno-75',
    nome: 'Carprofeno 75 mg',
    principio: 'Carprofeno',
    sinonimos: ['rimadyl', 'carproflan'],
    apresentacao: 'Comprimido palatável 75 mg',
    concentracao: 75,
    unidade: 'COMPRIMIDO',
    classe: 'ANTI_INFLAMATORIO',
    vias: ['ORAL'],
    usual: [2.2, 4.4],
    indicacoes: ['Osteoartrite', 'Dor pós-operatória'],
    contra: ['Gatos', 'Doença renal ou hepática'],
    cuidados: ['RENAL', 'HEPATICO', 'GASTRICO'],
    doses: [
      ['CACHORRO', 2.2, 4.4, 24, 7],
      ['GATO', 0, 0, 24, null, 'Não usar em gatos: risco de lesão renal e gastrointestinal.', true],
    ],
  },
  {
    id: 'demo-med-dipirona-500',
    nome: 'Dipirona 500 mg/mL solução oral',
    principio: 'Dipirona sódica',
    sinonimos: ['metamizol', 'novalgina'],
    apresentacao: 'Solução oral 500 mg/mL (gotas), frasco de 10 mL',
    concentracao: 500,
    unidade: 'ML',
    classe: 'ANALGESICO',
    vias: ['ORAL', 'SUBCUTANEA', 'INTRAVENOSA'],
    usual: [12.5, 25],
    indicacoes: ['Dor leve a moderada', 'Febre'],
    contra: ['Hipersensibilidade à dipirona', 'Discrasias sanguíneas'],
    doses: [
      ['CACHORRO', 25, 25, 8, 3],
      ['GATO', 12.5, 25, 24, 3, 'Intervalo de 24 h em gatos.'],
    ],
  },
  {
    id: 'demo-med-gabapentina-100',
    nome: 'Gabapentina 100 mg',
    principio: 'Gabapentina',
    apresentacao: 'Cápsula 100 mg',
    concentracao: 100,
    unidade: 'COMPRIMIDO',
    classe: 'ANALGESICO',
    controle: 'ANVISA_HUMANO',
    lista: 'C1',
    vias: ['ORAL'],
    usual: [5, 10],
    indicacoes: ['Dor neuropática', 'Hérnia de disco', 'Ansiedade antes da consulta (gatos)'],
    efeitos: ['Sonolência', 'Ataxia leve'],
    cuidados: ['RENAL'],
    doses: [
      ['CACHORRO', 5, 10, 12, 14],
      ['GATO', 5, 10, 12, 7, 'Dose única 90 min antes da consulta reduz o estresse.'],
    ],
  },
  {
    id: 'demo-med-prednisolona-20',
    nome: 'Prednisolona 20 mg',
    principio: 'Prednisolona',
    apresentacao: 'Comprimido 20 mg',
    concentracao: 20,
    unidade: 'COMPRIMIDO',
    classe: 'CORTICOIDE',
    vias: ['ORAL'],
    usual: [0.5, 1],
    indicacoes: ['Dermatite alérgica', 'Colapso de traqueia (crise)', 'Doenças imunomediadas'],
    contra: ['Diabetes descompensado', 'Infecção sistêmica não tratada'],
    efeitos: ['Poliúria e polidipsia', 'Aumento do apetite'],
    interacoes: ['Anti-inflamatórios não esteroides'],
    cuidados: ['GESTANTE', 'GASTRICO'],
    observacao: 'Retirar de forma gradual depois de uso prolongado.',
    doses: [
      ['CACHORRO', 0.5, 1, 24, 7],
      ['GATO', 1, 2, 24, 7],
    ],
  },
  {
    id: 'demo-med-omeprazol-20',
    nome: 'Omeprazol 20 mg',
    principio: 'Omeprazol',
    apresentacao: 'Cápsula 20 mg',
    concentracao: 20,
    unidade: 'COMPRIMIDO',
    classe: 'GASTROPROTETOR',
    vias: ['ORAL'],
    usual: [0.7, 1],
    indicacoes: ['Gastrite', 'Proteção gástrica com anti-inflamatório'],
    doses: [
      ['CACHORRO', 0.7, 1, 24, 10],
      ['GATO', 0.7, 1, 24, 10],
    ],
  },
  {
    id: 'demo-med-ondansetrona-4',
    nome: 'Ondansetrona 4 mg',
    principio: 'Ondansetrona',
    apresentacao: 'Comprimido orodispersível 4 mg',
    concentracao: 4,
    unidade: 'COMPRIMIDO',
    classe: 'ANTIEMETICO',
    vias: ['ORAL'],
    usual: [0.5, 1],
    indicacoes: ['Vômito agudo', 'Náusea da doença renal'],
    doses: [
      ['CACHORRO', 0.5, 1, 12, 3],
      ['GATO', 0.5, 1, 12, 3],
    ],
  },
  {
    id: 'demo-med-maropitant-10',
    nome: 'Maropitant 10 mg/mL injetável',
    principio: 'Citrato de maropitant',
    sinonimos: ['cerenia'],
    apresentacao: 'Solução injetável 10 mg/mL, frasco de 20 mL',
    concentracao: 10,
    unidade: 'ML',
    classe: 'ANTIEMETICO',
    vias: ['SUBCUTANEA', 'INTRAVENOSA'],
    usual: [1, 1],
    indicacoes: ['Vômito agudo', 'Prevenção de náusea pré-anestésica'],
    efeitos: ['Dor na aplicação subcutânea'],
    doses: [
      ['CACHORRO', 1, 1, 24, 5],
      ['GATO', 1, 1, 24, 5],
    ],
  },
  {
    id: 'demo-med-pimobendan-25',
    nome: 'Pimobendan 2,5 mg',
    principio: 'Pimobendan',
    sinonimos: ['vetmedin'],
    apresentacao: 'Comprimido mastigável 2,5 mg',
    concentracao: 2.5,
    unidade: 'COMPRIMIDO',
    classe: 'CARDIOLOGICO',
    vias: ['ORAL'],
    usual: [0.2, 0.3],
    indicacoes: ['Doença valvar mitral estágio B2', 'Insuficiência cardíaca congestiva'],
    contra: ['Cardiomiopatia hipertrófica', 'Estenose aórtica'],
    observacao: 'Dar 1 hora antes da refeição.',
    doses: [
      ['CACHORRO', 0.2, 0.3, 12, null],
      ['GATO', 0.25, 0.3, 12, null, 'Uso fora da bula; só com ecocardiograma.'],
    ],
  },
  {
    id: 'demo-med-furosemida-40',
    nome: 'Furosemida 40 mg',
    principio: 'Furosemida',
    apresentacao: 'Comprimido 40 mg',
    concentracao: 40,
    unidade: 'COMPRIMIDO',
    classe: 'CARDIOLOGICO',
    vias: ['ORAL', 'INTRAVENOSA', 'INTRAMUSCULAR'],
    usual: [1, 2],
    indicacoes: ['Edema pulmonar cardiogênico', 'Ascite'],
    cuidados: ['RENAL'],
    doses: [
      ['CACHORRO', 1, 2, 12, null],
      ['GATO', 1, 2, 12, null],
    ],
  },
  {
    id: 'demo-med-benazepril-5',
    nome: 'Benazepril 5 mg',
    principio: 'Cloridrato de benazepril',
    sinonimos: ['fortekor'],
    apresentacao: 'Comprimido 5 mg',
    concentracao: 5,
    unidade: 'COMPRIMIDO',
    classe: 'CARDIOLOGICO',
    vias: ['ORAL'],
    usual: [0.25, 0.5],
    indicacoes: ['Proteinúria da doença renal crônica', 'Insuficiência cardíaca'],
    cuidados: ['RENAL'],
    doses: [
      ['CACHORRO', 0.25, 0.5, 24, null],
      ['GATO', 0.5, 1, 24, null],
    ],
  },
  {
    id: 'demo-med-amlodipina-5',
    nome: 'Amlodipina 5 mg',
    principio: 'Besilato de amlodipina',
    apresentacao: 'Comprimido 5 mg',
    concentracao: 5,
    unidade: 'COMPRIMIDO',
    classe: 'CARDIOLOGICO',
    vias: ['ORAL'],
    usual: [0.125, 0.25],
    indicacoes: ['Hipertensão arterial sistêmica'],
    doses: [
      ['GATO', 0.125, 0.25, 24, null, 'Em gatos, ¼ de comprimido (1,25 mg) por gato.'],
      ['CACHORRO', 0.1, 0.25, 24, null],
    ],
  },
  {
    id: 'demo-med-metimazol-5',
    nome: 'Metimazol 5 mg',
    principio: 'Tiamazol',
    sinonimos: ['tapazol'],
    apresentacao: 'Comprimido 5 mg',
    concentracao: 5,
    unidade: 'COMPRIMIDO',
    classe: 'OUTRA',
    vias: ['ORAL'],
    usual: [0.3, 0.6],
    indicacoes: ['Hipertireoidismo felino'],
    efeitos: ['Vômito', 'Prurido facial', 'Alterações no hemograma'],
    observacao: 'Repetir T4 total e função renal de 3 a 4 semanas depois de mudar a dose.',
    doses: [['GATO', 0.3, 0.6, 12, null]],
  },
  {
    id: 'demo-med-oclacitinib-54',
    nome: 'Oclacitinib 5,4 mg',
    principio: 'Maleato de oclacitinib',
    sinonimos: ['apoquel'],
    apresentacao: 'Comprimido 5,4 mg',
    concentracao: 5.4,
    unidade: 'COMPRIMIDO',
    classe: 'DERMATOLOGICO',
    vias: ['ORAL'],
    usual: [0.4, 0.6],
    indicacoes: ['Prurido da dermatite atópica', 'Dermatite alérgica'],
    contra: ['Cães com menos de 12 meses', 'Infecção grave'],
    cuidados: ['FILHOTE'],
    observacao: 'Duas vezes ao dia por até 14 dias; depois, uma vez ao dia.',
    doses: [['CACHORRO', 0.4, 0.6, 12, 14]],
  },
  {
    id: 'demo-med-itraconazol-100',
    nome: 'Itraconazol 100 mg',
    principio: 'Itraconazol',
    apresentacao: 'Cápsula 100 mg',
    concentracao: 100,
    unidade: 'COMPRIMIDO',
    classe: 'DERMATOLOGICO',
    vias: ['ORAL'],
    usual: [5, 10],
    indicacoes: ['Dermatofitose', 'Malasseziose'],
    cuidados: ['HEPATICO'],
    doses: [
      ['GATO', 5, 5, 24, 28, 'Em semanas alternadas, conforme a cultura de controle.'],
      ['CACHORRO', 5, 10, 24, 28],
    ],
  },
  {
    id: 'demo-med-sarolaner-20',
    nome: 'Sarolaner 20 mg',
    principio: 'Sarolaner',
    sinonimos: ['simparic'],
    apresentacao: 'Comprimido mastigável 20 mg (cães de 5,1 a 10 kg)',
    concentracao: 20,
    unidade: 'COMPRIMIDO',
    classe: 'ANTIPARASITARIO',
    vias: ['ORAL'],
    usual: [2, 4],
    indicacoes: ['Pulgas e carrapatos', 'Sarna demodécica', 'Sarna sarcóptica'],
    doses: [['CACHORRO', 2, 4, 720, null]],
  },
  {
    id: 'demo-med-drontal-plus',
    nome: 'Praziquantel + pirantel + febantel',
    principio: 'Praziquantel + pamoato de pirantel + febantel',
    sinonimos: ['drontal plus', 'vermífugo'],
    apresentacao: 'Comprimido para 10 kg (praziquantel 50 mg)',
    concentracao: 50,
    unidade: 'COMPRIMIDO',
    classe: 'ANTIPARASITARIO',
    vias: ['ORAL'],
    usual: [5, 5],
    indicacoes: ['Vermifugação de rotina', 'Giardíase (febantel, 3 dias)'],
    cuidados: ['GESTANTE'],
    doses: [['CACHORRO', 5, 5, 24, 1]],
  },
  {
    id: 'demo-med-tobramicina-colirio',
    nome: 'Tobramicina 0,3% colírio',
    principio: 'Tobramicina',
    apresentacao: 'Colírio 0,3%, frasco de 5 mL',
    concentracao: 0.15,
    unidade: 'GOTA',
    classe: 'ANTIBIOTICO',
    vias: ['OFTALMICA'],
    usual: [0, 0],
    indicacoes: ['Conjuntivite bacteriana', 'Úlcera de córnea superficial'],
    observacao: 'Limpar a secreção com soro fisiológico antes de pingar.',
    doses: [],
  },
  {
    id: 'demo-med-otologico',
    nome: 'Gentamicina + betametasona + clotrimazol otológico',
    principio: 'Gentamicina + betametasona + clotrimazol',
    sinonimos: ['otomax', 'posatex'],
    apresentacao: 'Suspensão otológica, frasco de 15 mL',
    concentracao: 0.15,
    unidade: 'GOTA',
    classe: 'DERMATOLOGICO',
    vias: ['OTOLOGICA'],
    usual: [0, 0],
    indicacoes: ['Otite externa bacteriana e fúngica'],
    contra: ['Tímpano rompido'],
    observacao: 'Limpar o conduto com ceruminolítico 15 min antes.',
    doses: [],
  },
  {
    id: 'demo-med-clorexidina-shampoo',
    nome: 'Clorexidina 2% + miconazol 2% shampoo',
    principio: 'Clorexidina + miconazol',
    apresentacao: 'Shampoo, frasco de 200 mL',
    concentracao: 1,
    unidade: 'APLICACAO',
    classe: 'DERMATOLOGICO',
    vias: ['TOPICA'],
    usual: [0, 0],
    indicacoes: ['Piodermite superficial', 'Malasseziose', 'Dermatite de dobras'],
    observacao: 'Deixar agir 10 minutos antes de enxaguar.',
    doses: [],
  },
  {
    id: 'demo-med-cefazolina-1g',
    nome: 'Cefazolina 1 g injetável',
    principio: 'Cefazolina sódica',
    apresentacao: 'Pó para solução injetável 1 g',
    concentracao: 100,
    unidade: 'ML',
    classe: 'ANTIBIOTICO',
    vias: ['INTRAVENOSA', 'INTRAMUSCULAR'],
    usual: [22, 22],
    indicacoes: ['Profilaxia antimicrobiana cirúrgica'],
    observacao: 'Reconstituir em 10 mL (100 mg/mL). Aplicar 30 a 60 min antes da incisão.',
    doses: [
      ['CACHORRO', 22, 22, 8, 1],
      ['GATO', 22, 22, 8, 1],
    ],
  },
  {
    id: 'demo-med-dexmedetomidina',
    nome: 'Dexmedetomidina 0,5 mg/mL',
    principio: 'Cloridrato de dexmedetomidina',
    apresentacao: 'Solução injetável 0,5 mg/mL',
    concentracao: 0.5,
    unidade: 'ML',
    classe: 'SEDATIVO',
    vias: ['INTRAMUSCULAR', 'INTRAVENOSA'],
    usual: [0.002, 0.01],
    indicacoes: ['Medicação pré-anestésica', 'Sedação para exames'],
    contra: ['Cardiopatas descompensados'],
    cuidados: ['CARDIACO', 'IDOSO'],
    doses: [
      ['CACHORRO', 0.002, 0.01, 24, 1],
      ['GATO', 0.005, 0.015, 24, 1],
    ],
  },
  {
    id: 'demo-med-cetamina',
    nome: 'Cetamina 100 mg/mL',
    principio: 'Cloridrato de cetamina',
    apresentacao: 'Solução injetável 100 mg/mL, frasco de 10 mL',
    concentracao: 100,
    unidade: 'ML',
    classe: 'SEDATIVO',
    controle: 'MAPA_VETERINARIO',
    vias: ['INTRAMUSCULAR', 'INTRAVENOSA'],
    usual: [2, 5],
    indicacoes: ['Indução anestésica (associada)'],
    observacao: 'Uso hospitalar; escrituração no livro de controlados.',
    doses: [
      ['CACHORRO', 2, 5, 24, 1],
      ['GATO', 2, 5, 24, 1],
      ['COELHO', 10, 20, 24, 1],
    ],
  },
  {
    id: 'demo-med-mirtazapina-15',
    nome: 'Mirtazapina 15 mg',
    principio: 'Mirtazapina',
    apresentacao: 'Comprimido 15 mg',
    concentracao: 15,
    unidade: 'COMPRIMIDO',
    classe: 'OUTRA',
    controle: 'ANVISA_HUMANO',
    lista: 'C1',
    vias: ['ORAL'],
    usual: [0.3, 0.5],
    indicacoes: ['Estímulo de apetite', 'Náusea da doença renal crônica'],
    cuidados: ['RENAL', 'HEPATICO'],
    doses: [['GATO', 0.3, 0.5, 48, 14, 'Na doença renal, a cada 48 horas.']],
  },
  {
    id: 'demo-med-sucralfato-1g',
    nome: 'Sucralfato 1 g',
    principio: 'Sucralfato',
    apresentacao: 'Comprimido 1 g',
    concentracao: 1000,
    unidade: 'COMPRIMIDO',
    classe: 'GASTROPROTETOR',
    vias: ['ORAL'],
    usual: [25, 50],
    indicacoes: ['Úlcera gástrica', 'Esofagite'],
    interacoes: ['Separar 2 horas de outros medicamentos orais'],
    doses: [['CACHORRO', 25, 50, 8, 10]],
  },
  {
    id: 'demo-med-cisaprida-manipulada',
    nome: 'Cisaprida 1 mg/mL (manipulada)',
    principio: 'Cisaprida',
    apresentacao: 'Suspensão oral manipulada 1 mg/mL, 30 mL',
    concentracao: 1,
    unidade: 'ML',
    classe: 'OUTRA',
    manipulado: true,
    vias: ['ORAL'],
    usual: [0.5, 0.5],
    indicacoes: ['Estase gastrointestinal em coelhos', 'Megacólon felino'],
    doses: [
      ['COELHO', 0.5, 0.5, 12, 7],
      ['GATO', 0.1, 0.5, 12, 14],
    ],
    daClinica: true,
  },
  {
    id: 'demo-med-calcio-oral',
    nome: 'Gluconato de cálcio 10% oral',
    principio: 'Gluconato de cálcio',
    apresentacao: 'Solução oral 100 mg/mL, 100 mL',
    concentracao: 100,
    unidade: 'ML',
    classe: 'OUTRA',
    vias: ['ORAL'],
    usual: [50, 100],
    indicacoes: ['Doença metabólica óssea em répteis', 'Hipocalcemia em aves'],
    doses: [
      ['REPTIL', 50, 100, 24, 30],
      ['AVE', 50, 100, 24, 14],
    ],
    daClinica: true,
  },
  {
    id: 'demo-med-simeticona-gotas',
    nome: 'Simeticona 75 mg/mL gotas',
    principio: 'Simeticona',
    apresentacao: 'Emulsão oral 75 mg/mL, 10 mL',
    concentracao: 75,
    unidade: 'ML',
    classe: 'OUTRA',
    vias: ['ORAL'],
    usual: [20, 40],
    indicacoes: ['Timpanismo em coelhos e porquinhos-da-índia'],
    doses: [
      ['COELHO', 20, 40, 8, 3],
      ['ROEDOR', 20, 40, 8, 3],
    ],
    daClinica: true,
    inativo: false,
  },
]

function montarMedicamento(m: MedicamentoDaTabela): MedicamentoAdminDto {
  const daClinica = Boolean(m.daClinica)
  return {
    fonte: daClinica ? null : FONTE,
    revisado: !daClinica,
    revisadoPor: daClinica ? null : REVISADO_POR,
    revisadoEm: daClinica ? null : REVISADO_EM,
    id: m.id,
    origem: daClinica ? 'PARCEIRO' : 'GLOBAL',
    nome: m.nome,
    principioAtivo: m.principio,
    sinonimosDoPrincipio: m.sinonimos ?? [],
    apresentacao: m.apresentacao,
    concentracao: m.concentracao,
    unidadeApresentacao: m.unidade,
    classe: m.classe,
    controle: m.controle ?? 'NENHUM',
    listaControle: m.lista ?? null,
    manipulado: Boolean(m.manipulado),
    viasPermitidas: m.vias,
    doseUsualMgKg: { min: m.usual[0], max: m.usual[1] },
    indicacoes: m.indicacoes,
    contraindicacoes: m.contra ?? [],
    efeitosAdversos: m.efeitos ?? [],
    interacoes: m.interacoes ?? [],
    cuidados: m.cuidados ?? [],
    observacao: m.observacao ?? null,
    ativo: !m.inativo,
    doses: m.doses.map(([especie, min, max, frequenciaHoras, dias, nota, proibido], i) => ({
      id: `${m.id}-dose-${i + 1}`,
      especie,
      mgKgMin: min,
      mgKgMax: max,
      frequenciaHoras,
      duracaoUsualDias: dias,
      proibido: Boolean(proibido),
      nota: nota ?? null,
      traducoes: null,
    })),
    traducoes: null,
  }
}

export const MEDICAMENTOS: MedicamentoAdminDto[] = TABELA_DE_MEDICAMENTOS.map(montarMedicamento)

export function medicamento(id: string | null | undefined) {
  return MEDICAMENTOS.find((m) => m.id === id) ?? null
}

/** O medicamento na forma da busca (sem as traduções cruas). */
export function medicamentoDto(m: MedicamentoAdminDto): Medicamento {
  const { traducoes: _traducoes, doses, ...resto } = m
  return { ...resto, doses: doses.map(({ traducoes: _t, ...dose }) => dose) }
}

/** Nome, princípio, sinônimo ou indicação, sem acento; vazio devolve os primeiros por nome. */
export function buscarMedicamentos(
  q: string | null,
  especie: EspecieDoCatalogo | null,
  limite: number,
): Medicamento[] {
  const termo = normalizar(q).trim()
  const achados = MEDICAMENTOS.filter((m) => m.ativo)
    .filter((m) => !especie || m.doses.length === 0 || m.doses.some((d) => d.especie === especie))
    .filter((m) => {
      if (!termo) return true
      const campos = [m.nome, m.principioAtivo, ...m.sinonimosDoPrincipio, ...m.indicacoes]
      return campos.some((campo) => normalizar(campo).includes(termo))
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  return achados.slice(0, Math.max(1, Math.min(limite, 50))).map(medicamentoDto)
}

/* ---------------------------------------------------------------------------- diagnósticos */

const TABELA_DE_DIAGNOSTICOS: Array<[string, string, Sistema | null, string?]> = [
  ['DER-01', 'Dermatite atópica', 'TEGUMENTAR'],
  ['DER-02', 'Otite externa', 'TEGUMENTAR'],
  ['DER-03', 'Piodermite superficial', 'TEGUMENTAR'],
  ['DER-04', 'Dermatite alérgica à picada de pulga (DAPP)', 'TEGUMENTAR'],
  ['DER-05', 'Dermatofitose', 'TEGUMENTAR'],
  ['DER-06', 'Dermatite de dobras cutâneas', 'TEGUMENTAR'],
  ['DER-07', 'Arrancamento de penas (picacismo)', 'TEGUMENTAR'],
  ['DER-08', 'Sarna por Trixacarus caviae', 'TEGUMENTAR'],
  ['DER-09', 'Reação alérgica aguda (angioedema)', 'TEGUMENTAR'],
  ['GE-01', 'Gastroenterite aguda', 'DIGESTORIO'],
  ['GE-02', 'Doença periodontal', 'DIGESTORIO'],
  ['GE-03', 'Indiscrição alimentar', 'DIGESTORIO'],
  ['GE-04', 'Pancreatite aguda', 'DIGESTORIO'],
  ['GE-05', 'Estase gastrointestinal', 'DIGESTORIO'],
  ['GE-06', 'Má oclusão dentária', 'DIGESTORIO'],
  ['GE-07', 'Tricobezoar', 'DIGESTORIO'],
  ['GE-08', 'Gengivoestomatite crônica felina', 'DIGESTORIO'],
  ['GE-09', 'Intoxicação por metilxantinas (chocolate)', 'DIGESTORIO'],
  ['UR-01', 'Cistite idiopática felina', 'URINARIO'],
  ['UR-02', 'Doença renal crônica', 'URINARIO'],
  ['UR-03', 'Urolitíase', 'URINARIO'],
  ['UR-04', 'Infecção do trato urinário', 'URINARIO'],
  ['UR-05', 'Obstrução uretral', 'URINARIO'],
  ['RE-01', 'Complexo respiratório felino', 'RESPIRATORIO'],
  ['RE-02', 'Traqueobronquite infecciosa canina', 'RESPIRATORIO'],
  ['RE-03', 'Colapso de traqueia', 'RESPIRATORIO'],
  ['RE-04', 'Síndrome braquicefálica obstrutiva', 'RESPIRATORIO'],
  ['CA-01', 'Doença valvar mitral degenerativa (estágio B2)', 'CARDIOVASCULAR'],
  ['CA-02', 'Cardiomiopatia hipertrófica', 'CARDIOVASCULAR'],
  ['CA-03', 'Hipertensão arterial sistêmica', 'CARDIOVASCULAR'],
  ['LO-01', 'Doença do disco intervertebral', 'LOCOMOTOR'],
  ['LO-02', 'Displasia coxofemoral', 'LOCOMOTOR'],
  ['LO-03', 'Osteoartrite', 'LOCOMOTOR'],
  ['LO-04', 'Luxação de patela', 'LOCOMOTOR'],
  ['LO-05', 'Doença metabólica óssea', 'LOCOMOTOR'],
  ['NE-01', 'Síndrome vestibular', 'NEUROLOGICO'],
  ['NE-02', 'Epilepsia idiopática', 'NEUROLOGICO'],
  ['LI-01', 'Linfadenomegalia reativa', 'LINFONODOS'],
  ['EN-01', 'Hipertireoidismo felino', null],
  ['EN-02', 'Obesidade', null],
  ['EN-03', 'Hipovitaminose A', null],
  ['OF-01', 'Conjuntivite', null],
  ['OF-02', 'Ceratoconjuntivite seca', null],
  ['RP-01', 'Gestação (acompanhamento pré-natal)', null],
  ['IN-01', 'Imunodeficiência viral felina (FIV)', null],
  ['IN-02', 'Giardíase', 'DIGESTORIO'],
  ['IN-03', 'Erliquiose monocítica canina', 'LINFONODOS'],
  ['PR-01', 'Paciente hígido: avaliação preventiva', null],
  ['PR-02', 'Avaliação pré-anestésica', null],
  ['PR-03', 'Esterilização eletiva', null],
  ['DER-10', 'Neoformação cutânea a esclarecer', 'TEGUMENTAR'],
  ['VMP-01', 'Pododermatite ulcerativa (coelhos e roedores)', 'TEGUMENTAR', 'clinica'],
  ['VMP-02', 'Manejo inadequado de UVB e temperatura (répteis)', null, 'clinica'],
]

export const DIAGNOSTICOS: DiagnosticoAdminDto[] = TABELA_DE_DIAGNOSTICOS.map(
  ([codigo, descricao, sistema, daClinica], i) => ({
    id: `demo-diag-${String(i + 1).padStart(3, '0')}`,
    origem: daClinica ? 'PARCEIRO' : 'GLOBAL',
    codigo,
    codigoExterno: null,
    descricao,
    sistema,
    ativo: true,
    traducoes: null,
  }),
)

export function diagnostico(codigo: string) {
  return DIAGNOSTICOS.find((d) => d.codigo === codigo) ?? null
}

function diagnosticoDto(d: DiagnosticoAdminDto): Diagnostico {
  const { traducoes: _traducoes, ...resto } = d
  return resto
}

/** Por código ("GE-01" ou "ge01") e por descrição. */
export function buscarDiagnosticos(q: string | null, limite: number): Diagnostico[] {
  const termo = normalizar(q).trim()
  const semHifen = termo.replace(/[^a-z0-9]/g, '')
  return DIAGNOSTICOS.filter((d) => d.ativo)
    .filter(
      (d) =>
        !termo ||
        normalizar(d.descricao).includes(termo) ||
        normalizar(d.codigo)
          .replace(/[^a-z0-9]/g, '')
          .startsWith(semHifen),
    )
    .slice(0, Math.max(1, Math.min(limite, 50)))
    .map(diagnosticoDto)
}

/* --------------------------------------------------------------------------------- exames */

const TABELA_DE_EXAMES: Array<[string, Exame['grupo'], string?]> = [
  ['Hemograma completo', 'LABORATORIO'],
  ['Bioquímico (ureia, creatinina, ALT, FA, albumina)', 'LABORATORIO'],
  ['SDMA', 'LABORATORIO'],
  ['Urinálise (urina tipo I)', 'LABORATORIO'],
  ['Urocultura com antibiograma', 'LABORATORIO'],
  ['Relação proteína/creatinina urinária', 'LABORATORIO'],
  ['Coproparasitológico (três amostras)', 'LABORATORIO'],
  ['T4 total', 'LABORATORIO'],
  ['Teste rápido FIV/FeLV', 'LABORATORIO'],
  ['Teste rápido 4Dx (erliquiose, anaplasma, Lyme, dirofilária)', 'LABORATORIO'],
  ['Glicemia e frutosamina', 'LABORATORIO'],
  ['Raspado cutâneo', 'LABORATORIO'],
  ['Cultura fúngica (DTM)', 'LABORATORIO'],
  ['Citologia otológica', 'LABORATORIO', 'clinica'],
  ['Ultrassonografia abdominal', 'IMAGEM'],
  ['Radiografia de tórax (três projeções)', 'IMAGEM'],
  ['Radiografia de coluna toracolombar', 'IMAGEM'],
  ['Radiografia de corpo inteiro', 'IMAGEM'],
  ['Ecocardiograma', 'IMAGEM'],
  ['Eletrocardiograma', 'OUTROS'],
  ['Pressão arterial sistólica (Doppler)', 'OUTROS'],
  ['Teste de Schirmer', 'OUTROS'],
  ['Teste de fluoresceína', 'OUTROS'],
]

export const EXAMES: ExameAdminDto[] = TABELA_DE_EXAMES.map(([nome, grupo, daClinica], i) => ({
  id: `demo-exame-${String(i + 1).padStart(3, '0')}`,
  origem: daClinica ? 'PARCEIRO' : 'GLOBAL',
  nome,
  grupo,
  ativo: true,
  traducoes: null,
}))

/** O exame pelo começo do nome ("Hemograma", "Ultrassonografia"). */
export function exame(nome: string) {
  const termo = normalizar(nome)
  return EXAMES.find((e) => normalizar(e.nome).startsWith(termo)) ?? null
}

/* -------------------------------------------------------------------------------- vacinas */

type VacinaDaTabela = Omit<
  VacinaAdminDto,
  'fonte' | 'revisado' | 'revisadoPor' | 'revisadoEm' | 'origem' | 'ativo' | 'traducoes'
>

const TABELA_DE_VACINAS: VacinaDaTabela[] = [
  {
    id: 'demo-vac-v10',
    nome: 'V10 (polivalente canina)',
    fabricante: 'Zoetis',
    especies: ['CACHORRO'],
    dosesSerieFilhote: 3,
    dosesSerieAdultoSemHistorico: 2,
    idadeMinimaDias: 42,
    essencial: true,
    vias: ['SUBCUTANEA'],
    intervaloReforcoDias: 365,
    intervaloEntreDosesDias: 21,
    obrigatoria: false,
    estoqueMinimoPadrao: 10,
    modoSerieFilhote: 'ATE_IDADE_MINIMA',
    idadeMinimaUltimaDoseFilhoteDias: 112,
  },
  {
    id: 'demo-vac-antirrabica',
    nome: 'Antirrábica',
    fabricante: 'Boehringer Ingelheim',
    especies: ['CACHORRO', 'GATO', 'OUTRO'],
    dosesSerieFilhote: 1,
    dosesSerieAdultoSemHistorico: 1,
    idadeMinimaDias: 84,
    essencial: true,
    vias: ['SUBCUTANEA', 'INTRAMUSCULAR'],
    intervaloReforcoDias: 365,
    intervaloEntreDosesDias: 0,
    obrigatoria: true,
    estoqueMinimoPadrao: 12,
    modoSerieFilhote: 'FIXA',
    idadeMinimaUltimaDoseFilhoteDias: null,
  },
  {
    id: 'demo-vac-tosse',
    nome: 'Tosse dos canis (Bordetella + parainfluenza)',
    fabricante: 'MSD Saúde Animal',
    especies: ['CACHORRO'],
    dosesSerieFilhote: 1,
    dosesSerieAdultoSemHistorico: 1,
    idadeMinimaDias: 56,
    essencial: false,
    vias: ['INTRANASAL'],
    intervaloReforcoDias: 365,
    intervaloEntreDosesDias: 0,
    obrigatoria: false,
    estoqueMinimoPadrao: 6,
    modoSerieFilhote: 'FIXA',
    idadeMinimaUltimaDoseFilhoteDias: null,
  },
  {
    id: 'demo-vac-giardia',
    nome: 'Giárdia',
    fabricante: 'Zoetis',
    especies: ['CACHORRO'],
    dosesSerieFilhote: 2,
    dosesSerieAdultoSemHistorico: 2,
    idadeMinimaDias: 56,
    essencial: false,
    vias: ['SUBCUTANEA'],
    intervaloReforcoDias: 365,
    intervaloEntreDosesDias: 21,
    obrigatoria: false,
    estoqueMinimoPadrao: 4,
    modoSerieFilhote: 'FIXA',
    idadeMinimaUltimaDoseFilhoteDias: null,
  },
  {
    id: 'demo-vac-leish',
    nome: 'Leishmaniose visceral canina',
    fabricante: 'Ceva',
    especies: ['CACHORRO'],
    dosesSerieFilhote: 3,
    dosesSerieAdultoSemHistorico: 3,
    idadeMinimaDias: 120,
    essencial: false,
    vias: ['SUBCUTANEA'],
    intervaloReforcoDias: 365,
    intervaloEntreDosesDias: 21,
    obrigatoria: false,
    estoqueMinimoPadrao: 3,
    modoSerieFilhote: 'FIXA',
    idadeMinimaUltimaDoseFilhoteDias: null,
  },
  {
    id: 'demo-vac-v5-felina',
    nome: 'V5 felina (quíntupla)',
    fabricante: 'Zoetis',
    especies: ['GATO'],
    dosesSerieFilhote: 3,
    dosesSerieAdultoSemHistorico: 2,
    idadeMinimaDias: 56,
    essencial: true,
    vias: ['SUBCUTANEA'],
    intervaloReforcoDias: 365,
    intervaloEntreDosesDias: 21,
    obrigatoria: false,
    estoqueMinimoPadrao: 8,
    modoSerieFilhote: 'ATE_IDADE_MINIMA',
    idadeMinimaUltimaDoseFilhoteDias: 112,
  },
  {
    id: 'demo-vac-v4-felina',
    nome: 'V4 felina (quádrupla)',
    fabricante: 'Boehringer Ingelheim',
    especies: ['GATO'],
    dosesSerieFilhote: 3,
    dosesSerieAdultoSemHistorico: 2,
    idadeMinimaDias: 56,
    essencial: true,
    vias: ['SUBCUTANEA'],
    intervaloReforcoDias: 365,
    intervaloEntreDosesDias: 21,
    obrigatoria: false,
    estoqueMinimoPadrao: 6,
    modoSerieFilhote: 'ATE_IDADE_MINIMA',
    idadeMinimaUltimaDoseFilhoteDias: 112,
  },
]

export const VACINAS: VacinaAdminDto[] = TABELA_DE_VACINAS.map((v) => ({
  ...v,
  fonte: 'Diretrizes WSAVA de vacinação de cães e gatos (2024)',
  revisado: true,
  revisadoPor: REVISADO_POR,
  revisadoEm: REVISADO_EM,
  origem: 'GLOBAL',
  ativo: true,
  traducoes: null,
}))

/** Os ids das vacinas do catálogo, para as outras áreas usarem os mesmos. */
export const VACINAS_DO_CATALOGO = Object.fromEntries(VACINAS.map((v) => [v.id, v.nome]))

function vacinaDto(v: VacinaAdminDto): Vacina {
  const { traducoes: _traducoes, ...resto } = v
  return resto
}

/* -------------------------------------------------------------------- faixas dos vitais */

type FaixaDaTabela = [Vital, EspecieDoCatalogo, Porte, FaixaEtaria, number, number, string, number]

const TABELA_DE_FAIXAS: FaixaDaTabela[] = [
  ['TEMPERATURA', 'CACHORRO', null, null, 37.5, 39.2, '°C', 1],
  ['FREQUENCIA_CARDIACA', 'CACHORRO', 'MINI', null, 90, 160, 'bpm', 0],
  ['FREQUENCIA_CARDIACA', 'CACHORRO', 'PEQUENO', null, 80, 140, 'bpm', 0],
  ['FREQUENCIA_CARDIACA', 'CACHORRO', 'MEDIO', null, 70, 130, 'bpm', 0],
  ['FREQUENCIA_CARDIACA', 'CACHORRO', 'GRANDE', null, 60, 110, 'bpm', 0],
  ['FREQUENCIA_CARDIACA', 'CACHORRO', 'GIGANTE', null, 60, 100, 'bpm', 0],
  ['FREQUENCIA_CARDIACA', 'CACHORRO', null, 'FILHOTE', 100, 180, 'bpm', 0],
  ['FREQUENCIA_RESPIRATORIA', 'CACHORRO', null, null, 10, 30, 'mpm', 0],
  ['TEMPO_PREENCHIMENTO_CAPILAR', 'CACHORRO', null, null, 1, 2, 's', 1],
  ['ESCORE_CORPORAL', 'CACHORRO', null, null, 4, 5, '/9', 0],
  ['PRESSAO_SISTOLICA', 'CACHORRO', null, null, 110, 160, 'mmHg', 0],
  ['TEMPERATURA', 'GATO', null, null, 37.8, 39.2, '°C', 1],
  ['FREQUENCIA_CARDIACA', 'GATO', null, null, 140, 220, 'bpm', 0],
  ['FREQUENCIA_RESPIRATORIA', 'GATO', null, null, 20, 40, 'mpm', 0],
  ['TEMPO_PREENCHIMENTO_CAPILAR', 'GATO', null, null, 1, 2, 's', 1],
  ['ESCORE_CORPORAL', 'GATO', null, null, 4, 5, '/9', 0],
  ['PRESSAO_SISTOLICA', 'GATO', null, null, 120, 160, 'mmHg', 0],
  ['TEMPERATURA', 'COELHO', null, null, 38.5, 40, '°C', 1],
  ['FREQUENCIA_CARDIACA', 'COELHO', null, null, 180, 300, 'bpm', 0],
  ['FREQUENCIA_RESPIRATORIA', 'COELHO', null, null, 30, 60, 'mpm', 0],
  ['TEMPERATURA', 'ROEDOR', null, null, 37.2, 39.5, '°C', 1],
  ['FREQUENCIA_CARDIACA', 'ROEDOR', null, null, 230, 400, 'bpm', 0],
  ['FREQUENCIA_RESPIRATORIA', 'ROEDOR', null, null, 40, 110, 'mpm', 0],
]

export const FAIXAS: FaixaDeReferenciaDto[] = TABELA_DE_FAIXAS.map(
  ([vital, especie, porte, faixaEtaria, min, max, unidade, precisao], i) => ({
    fonte: 'Manual Merck de Veterinária, 11ª ed.',
    revisado: true,
    revisadoPor: REVISADO_POR,
    revisadoEm: REVISADO_EM,
    id: `demo-faixa-${String(i + 1).padStart(3, '0')}`,
    vital,
    especie,
    porte,
    faixaEtaria,
    min,
    max,
    unidade,
    precisao,
    ativo: true,
  }),
)

export const VITAIS: readonly Vital[] = [
  'PESO',
  'TEMPERATURA',
  'FREQUENCIA_CARDIACA',
  'FREQUENCIA_RESPIRATORIA',
  'TEMPO_PREENCHIMENTO_CAPILAR',
  'ESCORE_CORPORAL',
  'PRESSAO_SISTOLICA',
]

/** Filhote até 1 ano, idoso a partir de 8 (cães e gatos); nos outros, adulto. */
export function faixaEtariaDe(
  nascimento: string | null,
  especie: string,
  data = hoje(),
): FaixaEtaria {
  if (!nascimento) return null
  const anos = diasEntre(nascimento, data) / 365.25
  if (anos < 1) return 'FILHOTE'
  if ((especie === 'CACHORRO' || especie === 'GATO') && anos >= 8) return 'IDOSO'
  return 'ADULTO'
}

export function porteDe(porte: Porte | undefined): Porte {
  return porte ?? null
}

/** A faixa mais específica que vale para o paciente (porte e idade, quando há). */
export function faixaDoVital(
  vital: Vital,
  especie: EspecieDoCatalogo,
  porte: Porte,
  faixaEtaria: FaixaEtaria,
): FaixaDeReferenciaDto | null {
  const candidatas = FAIXAS.filter(
    (f) =>
      f.vital === vital &&
      f.especie === especie &&
      (f.porte === null || f.porte === porte) &&
      (f.faixaEtaria === null || f.faixaEtaria === faixaEtaria),
  )
  candidatas.sort(
    (a, b) =>
      Number(b.faixaEtaria !== null) - Number(a.faixaEtaria !== null) ||
      Number(b.porte !== null) - Number(a.porte !== null),
  )
  return candidatas[0] ?? null
}

export function statusDoVital(
  valor: number | null,
  naoAferido: boolean,
  faixa: FaixaDeReferenciaDto | null,
): 'ABAIXO' | 'DENTRO' | 'ACIMA' | 'SEM_REFERENCIA' | 'NAO_AFERIDO' {
  if (naoAferido || valor === null) return 'NAO_AFERIDO'
  if (!faixa) return 'SEM_REFERENCIA'
  if (valor < faixa.min) return 'ABAIXO'
  if (valor > faixa.max) return 'ACIMA'
  return 'DENTRO'
}

export function faixasDoPaciente(pacienteId: string): FaixasDoPaciente | null {
  const p = pacienteDaBase(pacienteId)
  if (!p) return null
  const faixaEtaria = faixaEtariaDe(p.nascimento, p.especie)
  return {
    pacienteId,
    especie: p.especie,
    porte: p.porte,
    porteEstimado: false,
    faixaEtaria,
    faixas: VITAIS.map((vital) => ({
      vital,
      faixa: faixaDoVital(vital, p.especie, p.porte, faixaEtaria),
    })),
  }
}

/* -------------------------------------------------------------------------- o pacote */

export function pacoteDeCatalogos(): PacoteDeCatalogos {
  return {
    faixas: FAIXAS,
    exames: EXAMES.filter((e) => e.ativo).map(({ traducoes: _t, ...resto }) => resto),
    vacinas: VACINAS.filter((v) => v.ativo).map(vacinaDto),
    classes: [
      'ANTIBIOTICO',
      'ANTI_INFLAMATORIO',
      'ANALGESICO',
      'CORTICOIDE',
      'ANTIEMETICO',
      'GASTROPROTETOR',
      'ANTIPARASITARIO',
      'SEDATIVO',
      'CARDIOLOGICO',
      'DERMATOLOGICO',
      'OUTRA',
    ],
  }
}

/** Os itens da própria clínica, ativos e inativos. */
export function acrescimos(): Acrescimos {
  return {
    medicamentos: MEDICAMENTOS.filter((m) => m.origem === 'PARCEIRO'),
    vacinas: VACINAS.filter((v) => v.origem === 'PARCEIRO'),
    exames: EXAMES.filter((e) => e.origem === 'PARCEIRO'),
    diagnosticos: DIAGNOSTICOS.filter((d) => d.origem === 'PARCEIRO'),
  }
}

/* --------------------------------------------------------------------------- a dose */

type Fracao = NonNullable<ResultadoDaDose['fracionamento']>['tipo']

/** O comprimido arredonda em quartos; o líquido, em décimos de mL; a gota, inteira. */
export function fracionar(quantidade: number, unidade: Unidade) {
  if (unidade === 'COMPRIMIDO') {
    const quartos = Math.max(1, Math.round(quantidade * 4))
    const arredondada = quartos / 4
    const inteiros = Math.floor(arredondada)
    const resto = arredondada - inteiros
    let tipo: Fracao = 'APROXIMADO'
    if (arredondada === 0.25) tipo = 'QUARTO'
    else if (arredondada === 0.5) tipo = 'MEIO'
    else if (arredondada === 0.75) tipo = 'TRES_QUARTOS'
    else if (arredondada === 1) tipo = 'INTEIRO'
    else if (arredondada === 1.5) tipo = 'UM_E_MEIO'
    else if (resto === 0) tipo = 'MULTIPLO'
    return {
      tipo,
      inteiros,
      quantidade: arredondada,
      aproximado: Math.abs(arredondada - quantidade) > 0.05,
    }
  }
  if (unidade === 'GOTA') {
    const gotas = Math.max(1, Math.round(quantidade))
    return { tipo: 'INTEIRO' as Fracao, inteiros: gotas, quantidade: gotas, aproximado: false }
  }
  /* Abaixo de 1 mL (pets pequenos e exóticos), a seringa de insulina mede centésimos. */
  const passo = quantidade < 1 ? 100 : 10
  const medida = Math.max(1 / passo, Math.round(quantidade * passo) / passo)
  return {
    tipo: 'APROXIMADO' as Fracao,
    inteiros: Math.floor(medida),
    quantidade: medida,
    aproximado: Math.abs(medida - quantidade) > 0.005,
  }
}

export function calcularDose(pedido: PedidoDeDose): ResultadoDaDose | null {
  const m = medicamento(pedido.medicamentoId)
  const p = pacienteDaBase(pedido.pacienteId)
  if (!m || !p) return null
  const pesoKg = pedido.pesoKg ?? p.pesoKg ?? null
  const daEspecie = m.doses.find((d) => d.especie === p.especie) ?? null
  const faixa = daEspecie
    ? {
        mgKgMin: daEspecie.mgKgMin,
        mgKgMax: daEspecie.mgKgMax,
        origem: 'ESPECIE' as const,
        frequenciaHoras: daEspecie.frequenciaHoras,
        duracaoUsualDias: daEspecie.duracaoUsualDias,
      }
    : {
        mgKgMin: m.doseUsualMgKg.min,
        mgKgMax: m.doseUsualMgKg.max,
        origem: 'GERAL' as const,
        frequenciaHoras: null,
        duracaoUsualDias: null,
      }
  const avisos: ResultadoDaDose['avisos'] = []
  if (daEspecie?.proibido) {
    avisos.push({
      codigo: 'ESPECIE_PROIBIDA',
      bloqueante: true,
      cuidado: null,
      detalhe: daEspecie.nota,
    })
  }
  if (!daEspecie) {
    avisos.push({ codigo: 'SEM_DOSE_DA_ESPECIE', bloqueante: false, cuidado: null, detalhe: null })
  }
  const alergia = p.alertas.find(
    (a) =>
      a.tipo === 'ALERGIA' &&
      normalizar(a.detalhe).includes(normalizar(m.principioAtivo.split(' ')[0])),
  )
  if (alergia) {
    avisos.push({ codigo: 'ALERGIA', bloqueante: true, cuidado: null, detalhe: alergia.detalhe })
  }
  if (!pesoKg)
    avisos.push({ codigo: 'PESO_AUSENTE', bloqueante: false, cuidado: null, detalhe: null })
  if (faixa.mgKgMax > 0 && pedido.mgPorKg > faixa.mgKgMax) {
    avisos.push({ codigo: 'ACIMA_DA_USUAL', bloqueante: false, cuidado: null, detalhe: null })
  } else if (faixa.mgKgMin > 0 && pedido.mgPorKg < faixa.mgKgMin) {
    avisos.push({ codigo: 'ABAIXO_DA_USUAL', bloqueante: false, cuidado: null, detalhe: null })
  }
  const idoso = faixaEtariaDe(p.nascimento, p.especie) === 'IDOSO'
  for (const cuidado of m.cuidados) {
    const vale =
      (cuidado === 'IDOSO' && idoso) ||
      (cuidado === 'GESTANTE' && p.alertas.some((a) => a.tipo === 'GESTANTE')) ||
      (cuidado === 'RENAL' && p.alertas.some((a) => normalizar(a.detalhe).includes('renal')))
    if (vale) avisos.push({ codigo: 'CUIDADO', bloqueante: false, cuidado, detalhe: null })
  }

  const passos: ResultadoDaDose['passos'] = []
  let calculo: ResultadoDaDose['calculo'] = null
  let fracionamento: ResultadoDaDose['fracionamento'] = null
  if (pesoKg) {
    const mgPorAdministracao = Math.round(pesoKg * pedido.mgPorKg * 1000) / 1000
    const quantidadeApresentacao = Math.round((mgPorAdministracao / m.concentracao) * 1000) / 1000
    const administracoesPorDia = Math.round((24 / pedido.frequenciaHoras) * 100) / 100
    const duracaoDias = pedido.duracaoDias ?? null
    calculo = {
      pesoKg,
      mgPorKg: pedido.mgPorKg,
      mgPorAdministracao,
      quantidadeApresentacao,
      unidadeApresentacao: m.unidadeApresentacao,
      frequenciaHoras: pedido.frequenciaHoras,
      administracoesPorDia,
      duracaoDias,
      totalAdministracoes: duracaoDias ? Math.ceil(administracoesPorDia * duracaoDias) : null,
    }
    passos.push(
      {
        tipo: 'PESO_POR_DOSE',
        params: { pesoKg, mgPorKg: pedido.mgPorKg, mg: mgPorAdministracao },
      },
      {
        tipo: 'DOSE_POR_CONCENTRACAO',
        params: {
          mg: mgPorAdministracao,
          concentracao: m.concentracao,
          unidade: m.unidadeApresentacao,
          quantidade: quantidadeApresentacao,
        },
      },
    )
    if (calculo.totalAdministracoes) {
      passos.push({
        tipo: 'TOTAL',
        params: {
          administracoesPorDia,
          duracaoDias,
          total: calculo.totalAdministracoes,
        },
      })
    }
    fracionamento = fracionar(quantidadeApresentacao, m.unidadeApresentacao)
  }

  return {
    medicamento: {
      id: m.id,
      origem: m.origem,
      nome: m.nome,
      principioAtivo: m.principioAtivo,
      concentracao: m.concentracao,
      unidadeApresentacao: m.unidadeApresentacao,
    },
    paciente: {
      id: p.id,
      especie: p.especie,
      pesoKg,
      pesoOrigem: pedido.pesoKg ? 'INFORMADO' : p.pesoKg ? 'CADASTRO' : null,
    },
    calculo,
    passos,
    fracionamento,
    faixaDeReferencia: faixa,
    avisos,
    exigeConfirmacao: avisos.some((a) => a.bloqueante),
    responsabilidade:
      'A conta é uma ajuda: a dose e a decisão de prescrever são do médico-veterinário responsável.',
  }
}

/* --------------------------------------------------------------- acréscimos novos */

let acrescimosCriados = 0

/** Um id novo para o acréscimo que a clínica cria na demonstração. */
export function idDoAcrescimo(tipo: string) {
  acrescimosCriados += 1
  return `demo-${tipo}-clinica-${acrescimosCriados}`
}
