/**
 * A verificação de identidade da pessoa (E1-08): documento com foto, selfie segurando o documento e
 * o CPF, conferidos por uma pessoa da PetJourney. É da pessoa, não do parceiro: as rotas não levam
 * `?parceiroId=`, e o mesmo envio vale em todas as empresas em que ela está.
 *
 * Sem a identidade aprovada, o CRMV não ganha o selo e a pessoa não assina receita, prontuário,
 * resumo nem prescrição. O resto do portal segue liberado.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  ConsentimentoDaIdentidadeDto,
  IdentidadeDaPessoaDto,
  VerificacaoDaPessoaDto,
} from '../contrato/openapi'

export type IdentidadeDaPessoa = IdentidadeDaPessoaDto
export type VerificacaoDaPessoa = VerificacaoDaPessoaDto
export type StatusDaIdentidade = VerificacaoDaPessoaDto['status']
/** O aviso de privacidade que a pessoa lê antes de enviar, servido pela API no idioma do pedido. */
export type AvisoDaIdentidade = ConsentimentoDaIdentidadeDto

/** O que o envio leva. O verso é opcional (a CNH digital em PDF já tem os dois lados). */
export type EnvioDaIdentidade = {
  cpf: string
  nomeCompleto: string
  /** A versão do aviso lido: sempre a `consentimentoVersaoAtual` da última leitura. */
  consentimentoVersao: string
  documento: File
  documentoVerso?: File | null
  selfie: File
}

/** Os tipos que a API aceita. Sem HEIC: o Safari do iPhone entrega JPEG quando o `accept` não o lista. */
export const TIPOS_DA_FOTO = 'image/jpeg,image/png,image/webp'
export const TIPOS_DO_DOCUMENTO = `${TIPOS_DA_FOTO},application/pdf`
/** 8 MB por arquivo, o teto da API. */
export const TAMANHO_MAXIMO = 8 * 1024 * 1024

const BASE = '/parceiro/portal/eu/identidade'

export async function obterIdentidade(): Promise<IdentidadeDaPessoa> {
  const resposta = await apiFetch<ApiEnvelope<IdentidadeDaPessoa>>(BASE)

  return resposta.data
}

export async function obterAvisoDaIdentidade(versao: string): Promise<AvisoDaIdentidade> {
  const resposta = await apiFetch<ApiEnvelope<AvisoDaIdentidade>>(
    `${BASE}/consentimento/${encodeURIComponent(versao)}`,
  )

  return resposta.data
}

export async function enviarIdentidade(envio: EnvioDaIdentidade): Promise<IdentidadeDaPessoa> {
  const corpo = new FormData()

  corpo.set('cpf', envio.cpf.replace(/\D/g, ''))
  corpo.set('nomeCompleto', envio.nomeCompleto.trim())
  corpo.set('consentimentoVersao', envio.consentimentoVersao)
  corpo.set('documento', envio.documento)
  corpo.set('selfie', envio.selfie)

  if (envio.documentoVerso) {
    corpo.set('documentoVerso', envio.documentoVerso)
  }

  const resposta = await apiFetch<ApiEnvelope<IdentidadeDaPessoa>>(BASE, {
    method: 'POST',
    body: corpo,
  })

  return resposta.data
}

/** Cancela o envio em análise; os arquivos saem na hora. Reenviar cria outro. */
export async function cancelarIdentidade(): Promise<void> {
  await apiFetch<unknown>(BASE, { method: 'DELETE' })
}
