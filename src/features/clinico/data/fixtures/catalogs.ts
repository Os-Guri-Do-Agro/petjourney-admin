import type { DiagnosisCatalogItem, ExamCatalogItem } from '../types'

export const diagnosisCatalogFixture: DiagnosisCatalogItem[] = [
  { codigo: 'GE-01', descricao: 'Gastroenterite aguda', sistema: 'digestorio' },
  { codigo: 'DR-04', descricao: 'Dermatite alérgica a pulgas', sistema: 'tegumentar' },
  { codigo: 'DR-09', descricao: 'Otite externa bacteriana', sistema: 'tegumentar' },
  {
    codigo: 'CV-02',
    descricao: 'Doença mixomatosa da valva mitral',
    sistema: 'cardiovascular',
    especies: ['canina'],
  },
  { codigo: 'UR-03', descricao: 'Doença renal crônica, estágio 2', sistema: 'urinario' },
  {
    codigo: 'UR-07',
    descricao: 'Cistite idiopática felina',
    sistema: 'urinario',
    especies: ['felina'],
  },
  { codigo: 'LO-05', descricao: 'Displasia coxofemoral', sistema: 'locomotor' },
  { codigo: 'LO-11', descricao: 'Doença do disco intervertebral', sistema: 'locomotor' },
  { codigo: 'RE-02', descricao: 'Síndrome braquicefálica', sistema: 'respiratorio' },
  { codigo: 'NE-06', descricao: 'Síndrome vestibular periférica', sistema: 'neurologico' },
  { codigo: 'LF-01', descricao: 'Linfadenomegalia reativa', sistema: 'linfonodos' },
  { codigo: 'GN-00', descricao: 'Check-up sem alterações', sistema: null },
]

export const examCatalogFixture: ExamCatalogItem[] = [
  { id: 'exame-hemograma', nome: 'Hemograma completo', grupo: 'laboratorio' },
  { id: 'exame-bioquimico', nome: 'Perfil bioquímico (ALT, FA, ureia, creatinina)', grupo: 'laboratorio' },
  { id: 'exame-urina', nome: 'Urinálise', grupo: 'laboratorio' },
  { id: 'exame-t4', nome: 'T4 livre', grupo: 'laboratorio' },
  { id: 'exame-raiox', nome: 'Radiografia torácica', grupo: 'imagem' },
  { id: 'exame-raiox-quadril', nome: 'Radiografia de quadril', grupo: 'imagem' },
  { id: 'exame-ultrassom', nome: 'Ultrassonografia abdominal', grupo: 'imagem' },
  { id: 'exame-eco', nome: 'Ecodopplercardiograma', grupo: 'imagem' },
  { id: 'exame-citologia', nome: 'Citologia de pele', grupo: 'outros' },
]
