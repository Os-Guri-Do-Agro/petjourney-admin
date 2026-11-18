/**
 * O conteúdo dos PDFs do prontuário na demonstração: a receita assinada, os documentos clínicos,
 * os laudos e a cópia do prontuário. Cada função monta a `Folha` que `prontuario-pdf.ts` desenha.
 */
import type { Documento, Laudo } from '@/service/parceiro/documentos-service'
import type { PedidoDeCopia } from '@/service/parceiro/copias-service'
import type { Receita } from '@/service/parceiro/receitas-service'

import { agendamento } from '../base/agenda'
import { cliente } from '../base/cadastro'
import { diasEntre, hoje } from '../relogio'
import type { Bloco, Folha } from './prontuario-pdf'
import {
  casoDe,
  crmvDe,
  itensDaLista,
  nomeDoProfissional,
  pacienteDe,
  registroDoAtendimento,
  type RegistroDoAtendimento,
} from './prontuario'

const ESPECIE: Record<string, string> = {
  CACHORRO: 'Cão',
  GATO: 'Gato',
  AVE: 'Ave',
  ROEDOR: 'Roedor',
  COELHO: 'Coelho',
  PEIXE: 'Peixe',
  REPTIL: 'Réptil',
  OUTRO: 'Outra espécie',
}

const TIPO_DO_ATENDIMENTO: Record<string, string> = {
  CONSULTA: 'Consulta',
  RETORNO: 'Retorno',
  EXAME: 'Exame',
  CIRURGIA: 'Cirurgia',
  EMERGENCIA: 'Emergência',
  VACINA: 'Vacinação',
}

const TIPO_DO_DOCUMENTO: Record<string, string> = {
  PEDIDO_EXAME: 'Pedido de exame',
  ENCAMINHAMENTO: 'Encaminhamento',
  ATESTADO_SAUDE: 'Atestado de saúde',
  ATESTADO_VIAGEM: 'Atestado para viagem',
  DECLARACAO_OBITO: 'Declaração de óbito',
  COMPROVANTE_VACINACAO: 'Comprovante de vacinação',
  TERMO_CONSENTIMENTO: 'Termo de consentimento',
  TERMO_RECUSA: 'Termo de recusa',
  TERMO_EUTANASIA: 'Termo de autorização de eutanásia',
}

const ROTULO_DO_CAMPO: Record<string, string> = {
  dataDoExame: 'Data do exame',
  semAlteracoes: 'Sem alterações',
  constatacoes: 'Constatações',
  recomendacoes: 'Recomendações',
  finalidade: 'Finalidade',
  antirrabica: 'Vacina antirrábica',
  vermifugacao: 'Vermifugação',
  validadeExigida: 'Validade exigida',
  destino: 'Destino',
  causaProvavel: 'Causa provável',
  necropsiaRealizada: 'Necropsia realizada',
  destinacao: 'Destinação',
  observacoes: 'Observações',
  indicacao: 'Indicação clínica',
  orientacoesDeColeta: 'Orientações de coleta',
  destinatario: 'Destinatário',
  motivo: 'Motivo',
  historico: 'Histórico',
  achados: 'Achados',
  diagnostico: 'Diagnóstico',
  medicacaoEmUso: 'Medicação em uso',
  solicitacao: 'Solicitação',
  objeto: 'Objeto',
  detalhamento: 'Detalhamento',
}

function dia(data: string | null | undefined) {
  if (!data) return ''
  const [a, m, d] = data.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

function diaEHora(iso: string | null | undefined) {
  return iso ? `${dia(iso)} às ${iso.slice(11, 16)}` : ''
}

function idade(nascimento: string | null) {
  if (!nascimento) return ''
  const meses = Math.floor(diasEntre(nascimento, hoje()) / 30.44)
  if (meses < 12) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`
  const anos = Math.floor(meses / 12)
  return `${anos} ${anos === 1 ? 'ano' : 'anos'}`
}

function identificacao(pacienteId: string): Bloco[] {
  const p = pacienteDe(pacienteId)
  const c = cliente(p.clienteId)
  const especie = p.especieOutra ?? ESPECIE[p.especie] ?? p.especie
  return [
    {
      tipo: 'campo',
      rotulo: 'Paciente',
      texto: [p.nome, especie, p.raca, p.sexo === 'FEMEA' ? 'fêmea' : 'macho', idade(p.nascimento)]
        .filter(Boolean)
        .join(' · '),
    },
    { tipo: 'campo', rotulo: 'Responsável', texto: c?.nome ?? '' },
  ]
}

function assinatura(
  nome: string | null,
  crmv: string | null,
  codigo: string | null,
  em: string | null,
): Bloco[] {
  return [
    { tipo: 'espaco' },
    { tipo: 'linha' },
    { tipo: 'texto', texto: [nome, crmv].filter(Boolean).join(' · ') },
    {
      tipo: 'texto',
      texto: `Assinado eletronicamente em ${diaEHora(em)}${codigo ? ` · código verificador ${codigo}` : ''}`,
    },
  ]
}

/* ----------------------------------------------------------------------------- receita */

export function folhaDaReceita(r: RegistroDoAtendimento, receita: Receita): Folha {
  const controle = receita.folhas.includes('CONTROLE_ESPECIAL')
  const blocos: Bloco[] = [
    { tipo: 'titulo', texto: controle ? 'Receituário de controle especial' : 'Receita' },
    ...identificacao(r.pacienteId),
    {
      tipo: 'campo',
      rotulo: 'Peso',
      texto: r.pesoKg ? `${String(r.pesoKg).replace('.', ',')} kg` : 'não aferido',
    },
    { tipo: 'subtitulo', texto: 'Prescrição' },
  ]
  for (const item of receita.itens.filter((i) => !i.foraDoPdf)) {
    blocos.push({
      tipo: 'texto',
      texto: `${item.ordem}. ${item.nome}${item.apresentacao ? ` (${item.apresentacao})` : ''}`,
    })
    blocos.push({ tipo: 'texto', texto: `   ${item.frase}` })
    if (item.instrucoes) blocos.push({ tipo: 'texto', texto: `   ${item.instrucoes}` })
  }
  if (receita.foraDoPdf.length) {
    blocos.push({ tipo: 'subtitulo', texto: 'Emitidos fora desta receita' })
    for (const fora of receita.foraDoPdf) blocos.push({ tipo: 'texto', texto: fora.instrucao })
  }
  if (receita.validaAte)
    blocos.push({ tipo: 'campo', rotulo: 'Válida até', texto: dia(receita.validaAte) })
  blocos.push(
    ...assinatura(
      receita.prescritorNome,
      receita.prescritorCrmv,
      receita.codigoVerificador,
      receita.emitidaEm,
    ),
  )
  return { titulo: 'Receita', blocos }
}

/* --------------------------------------------------------------------------- documento */

function textoDoCampo(chave: string, valor: unknown): string {
  if (valor === true) return 'Sim'
  if (valor === false) return 'Não'
  if (Array.isArray(valor))
    return valor
      .map((v) => (typeof v === 'object' && v ? (v as { nome?: string }).nome : String(v)))
      .join(', ')
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return dia(valor)
  if (chave === 'destinacao' && typeof valor === 'string')
    return valor.replace(/_/g, ' ').toLowerCase()
  return String(valor ?? '')
}

export function folhaDoDocumento(doc: Documento): Folha {
  const titulo = TIPO_DO_DOCUMENTO[doc.tipo] ?? 'Documento clínico'
  const blocos: Bloco[] = [{ tipo: 'titulo', texto: titulo }, ...identificacao(doc.pacienteId)]
  if (doc.status === 'ANULADO') {
    blocos.push({
      tipo: 'subtitulo',
      texto: `ANULADO em ${dia(doc.anulacao?.em)}: ${doc.anulacao?.motivo ?? ''}`,
    })
  }
  blocos.push({ tipo: 'espaco' })
  for (const [chave, valor] of Object.entries(doc.conteudo)) {
    if (chave === 'exames' && Array.isArray(valor)) {
      blocos.push({ tipo: 'subtitulo', texto: 'Exames solicitados' })
      for (const exame of valor as { nome?: string }[])
        blocos.push({ tipo: 'texto', texto: `· ${exame.nome ?? ''}` })
      continue
    }
    blocos.push({
      tipo: 'campo',
      rotulo: ROTULO_DO_CAMPO[chave] ?? chave,
      texto: textoDoCampo(chave, valor),
    })
  }
  if (doc.tipo.startsWith('TERMO_')) {
    const c = cliente(pacienteDe(doc.pacienteId).clienteId)
    blocos.push(
      { tipo: 'espaco' },
      {
        tipo: 'texto',
        texto: `Eu, ${c?.nome ?? 'responsável'}, declaro que li e compreendi as informações acima e que tive a oportunidade de tirar minhas dúvidas com a equipe.`,
      },
    )
    if (doc.aceiteStatus === 'ACEITO')
      blocos.push({ tipo: 'texto', texto: 'Aceite registrado pelo responsável.' })
  }
  blocos.push(...assinatura(doc.autorNome, doc.autorCrmv, doc.codigoVerificador, doc.emitidoEm))
  return { titulo, blocos }
}

/* ------------------------------------------------------------------------------- laudo */

export function folhaDoLaudo(r: RegistroDoAtendimento, laudo: Laudo): Folha {
  const a = r.agendamentoId ? agendamento(r.agendamentoId) : null
  const linhas = a
    ? (casoDe(a).laudos?.find(([nome]) => laudo.tipoExameNome.startsWith(nome.slice(0, 12)))?.[1] ??
      [])
    : []
  const blocos: Bloco[] = [
    { tipo: 'titulo', texto: `Laudo · ${laudo.tipoExameNome}` },
    ...identificacao(r.pacienteId),
    {
      tipo: 'campo',
      rotulo: 'Solicitante',
      texto: [nomeDoProfissional(r.profissionalId), crmvDe(r.profissionalId)]
        .filter(Boolean)
        .join(' · '),
    },
    { tipo: 'campo', rotulo: 'Data do resultado', texto: dia(laudo.dataDoResultado) },
    { tipo: 'subtitulo', texto: 'Resultado' },
    ...(linhas.length ? linhas : ['Resultado anexado pelo laboratório parceiro.']).map(
      (texto): Bloco => ({ tipo: 'texto', texto }),
    ),
    { tipo: 'espaco' },
    {
      tipo: 'texto',
      texto: 'Resultado emitido pelo laboratório de análises clínicas parceiro da clínica.',
    },
  ]
  return { titulo: laudo.tipoExameNome, blocos, rodape: 'Laudo anexado ao prontuário pela clínica' }
}

/* ------------------------------------------------------------------------------- cópia */

export function folhaDaCopia(pedido: PedidoDeCopia): Folha {
  const blocos: Bloco[] = [
    { tipo: 'titulo', texto: 'Cópia do prontuário' },
    ...identificacao(pedido.pacienteId),
    {
      tipo: 'campo',
      rotulo: 'Período',
      texto:
        pedido.de || pedido.ate
          ? `${dia(pedido.de) || 'início'} a ${dia(pedido.ate) || 'hoje'}`
          : 'todo o histórico',
    },
    { tipo: 'campo', rotulo: 'Pedido recebido em', texto: diaEHora(pedido.recebidoEm) },
  ]
  const itens = itensDaLista({ pacienteId: pedido.pacienteId, status: 'FINALIZADO' })
    .filter(
      (i) =>
        (!pedido.de || i.dataDoAtendimento >= pedido.de) &&
        (!pedido.ate || i.dataDoAtendimento <= pedido.ate),
    )
    .slice(0, 60)
  for (const item of itens) {
    const r = registroDoAtendimento(item.id)
    if (!r) continue
    blocos.push(
      {
        tipo: 'subtitulo',
        texto: `${dia(r.dataDoAtendimento)} · ${TIPO_DO_ATENDIMENTO[r.tipo] ?? r.tipo} · ${nomeDoProfissional(r.profissionalId)}`,
      },
      { tipo: 'campo', rotulo: 'Queixa', texto: r.anamnese.queixaPrincipal ?? '-' },
    )
    if (r.anamnese.historia)
      blocos.push({ tipo: 'campo', rotulo: 'História', texto: r.anamnese.historia })
    const diagnosticos = r.diagnostico.semDiagnostico
      ? 'Sem diagnóstico (avaliação preventiva)'
      : r.diagnostico.itens.map((d) => `${d.descricao} (${d.kind.toLowerCase()})`).join('; ')
    blocos.push({ tipo: 'campo', rotulo: 'Diagnóstico', texto: diagnosticos || '-' })
    if (r.conduta.orientacoes)
      blocos.push({ tipo: 'campo', rotulo: 'Conduta', texto: r.conduta.orientacoes })
    for (const receita of r.receitas.filter((x) => x.status === 'ASSINADA')) {
      blocos.push({
        tipo: 'campo',
        rotulo: 'Receita',
        texto: receita.itens.map((i) => i.nome).join(', '),
      })
    }
    blocos.push({ tipo: 'texto', texto: `Finalizado em ${diaEHora(r.finalizadoEm)}` })
  }
  if (!itens.length)
    blocos.push({ tipo: 'texto', texto: 'Sem atendimentos finalizados no período.' })
  return {
    titulo: 'Cópia do prontuário',
    blocos,
    rodape: 'Cópia do prontuário · uso do responsável',
  }
}
