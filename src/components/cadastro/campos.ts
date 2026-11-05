/**
 * Os campos do paciente e do responsável no cadastro (E2-01), fora dos componentes: o `<script
 * setup>` não exporta função. Vazios, validação e a conversão para a API.
 */
import {
  telefoneNaTela,
  type Cliente,
  type ContatoPreferido,
  type Especie,
  type Porte,
} from '@/service/parceiro/pacientes-service'

export type CamposDoPaciente = {
  nome: string
  especie: Especie | null
  especieOutra: string
  raca: string
  sexo: 'MACHO' | 'FEMEA' | null
  /** `AAAA-MM-DD` ou vazio. */
  nascimento: string
  nascimentoEstimado: boolean
  castrado: boolean | null
  porte: Porte | null
  pesoKg: number | null
  microchip: string
  pelagem: string
}

export function camposVazios(): CamposDoPaciente {
  return {
    nome: '',
    especie: null,
    especieOutra: '',
    raca: '',
    sexo: null,
    nascimento: '',
    nascimentoEstimado: false,
    castrado: null,
    porte: null,
    pesoKg: null,
    microchip: '',
    pelagem: '',
  }
}

export type ErrosDoPaciente = Partial<Record<'nome' | 'especie' | 'especieOutra', string>>

/** O que falta para salvar, em texto para o campo. */
export function validarPaciente(
  campos: CamposDoPaciente,
  t: (chave: string) => string,
): ErrosDoPaciente {
  const erros: ErrosDoPaciente = {}

  if (!campos.nome.trim()) erros.nome = t('cadastro.erros.nomeDoPaciente')
  if (!campos.especie) erros.especie = t('cadastro.erros.especie')
  if (campos.especie === 'OUTRO' && !campos.especieOutra.trim()) {
    erros.especieOutra = t('cadastro.erros.especieOutra')
  }

  return erros
}

export type CamposDoCliente = {
  nome: string
  cpf: string
  telefone: string
  telefoneSecundario: string
  email: string
  contatoPreferido: ContatoPreferido
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  observacao: string
  emergenciaNome: string
  emergenciaTelefone: string
}

export function clienteVazio(): CamposDoCliente {
  return {
    nome: '',
    cpf: '',
    telefone: '',
    telefoneSecundario: '',
    email: '',
    contatoPreferido: 'WHATSAPP',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    observacao: '',
    emergenciaNome: '',
    emergenciaTelefone: '',
  }
}

/** O cliente da API nos campos da tela: telefone formatado, nulos como texto vazio. */
export function camposDoCliente(cliente: Cliente): CamposDoCliente {
  return {
    nome: cliente.nome,
    cpf: cliente.cpf ?? '',
    telefone: telefoneNaTela(cliente.telefone),
    telefoneSecundario: telefoneNaTela(cliente.telefoneSecundario),
    email: cliente.email ?? '',
    contatoPreferido: cliente.contatoPreferido,
    cep: cliente.cep ?? '',
    logradouro: cliente.logradouro ?? '',
    numero: cliente.numero ?? '',
    complemento: cliente.complemento ?? '',
    bairro: cliente.bairro ?? '',
    cidade: cliente.cidade ?? '',
    uf: cliente.uf ?? '',
    observacao: cliente.observacao ?? '',
    emergenciaNome: cliente.emergenciaNome ?? '',
    emergenciaTelefone: telefoneNaTela(cliente.emergenciaTelefone),
  }
}

/** Para a API: texto vazio vira `null` (limpa o campo); o CPF vai só com os dígitos. */
export function clienteParaApi(campos: CamposDoCliente) {
  const ou = (valor: string) => (valor.trim() ? valor.trim() : null)

  return {
    nome: campos.nome.trim(),
    cpf: campos.cpf.replace(/\D/g, '') || null,
    telefone: ou(campos.telefone),
    telefoneSecundario: ou(campos.telefoneSecundario),
    email: ou(campos.email),
    contatoPreferido: campos.contatoPreferido,
    cep: campos.cep.replace(/\D/g, '') || null,
    logradouro: ou(campos.logradouro),
    numero: ou(campos.numero),
    complemento: ou(campos.complemento),
    bairro: ou(campos.bairro),
    cidade: ou(campos.cidade),
    uf: ou(campos.uf),
    observacao: ou(campos.observacao),
    emergenciaNome: ou(campos.emergenciaNome),
    emergenciaTelefone: ou(campos.emergenciaTelefone),
  }
}

export type ErrosDoCliente = Partial<Record<keyof CamposDoCliente, string>>

export function validarCliente(campos: CamposDoCliente, t: (chave: string) => string) {
  const erros: ErrosDoCliente = {}

  if (!campos.nome.trim()) erros.nome = t('cadastro.erros.nomeDoResponsavel')
  if (campos.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campos.email.trim())) {
    erros.email = t('cadastro.erros.email')
  }

  return erros
}
