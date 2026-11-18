/**
 * Internação: leitos (Configuração › Leitos), o mapa e as vagas, internar, o caso, mudar de
 * leito, gravidade, previsão e encerramento; prescrições e doses, os dois checklists, o plantão e
 * a passagem, as evoluções; o boletim ao responsável e a fila da recepção. O estado e as contas da
 * API moram em `dados/internacao.ts`; aqui ficam as validações e a forma de cada resposta.
 */
import type {
  BoletinsPendentes,
  ConversaDoBoletim,
  EnvioDoBoletim,
  LigacaoDaInternacao,
  ModelosDoBoletim,
  NovaPreferenciaDoBoletim,
  PreferenciaDoBoletim,
} from '@/service/parceiro/boletins-da-internacao-service'
import type {
  Desfecho,
  Gravidade,
  Internacao,
  KindDoLeito,
  Leito,
  ListaDeLeitos,
  Mapa,
  MotivoDoLeitoInativo,
  NovaInternacao,
  Vagas,
} from '@/service/parceiro/internacao-service'
import type {
  ChecklistDaInternacao,
  ChecklistDoPlantao,
  DoseRegistrada,
  Entrega,
  EvolucaoSalva,
  ListaDePrescricoes,
  NovaEvolucao,
  NovaPrescricaoNaInternacao,
  Passagem,
  Plantao,
  PlantaoAtual,
  PrescricaoCriada,
  Registro,
  VersoesDaEvolucao,
} from '@/service/parceiro/plantao-da-internacao-service'
import type {
  EditarInternacaoDto,
  EncerrarInternacaoDto,
  FotoDoBoletimDto,
  ListaDeEvolucoesDto,
  MudarLeitoDto,
  PrescricaoDeInternacaoSuspensaDto,
} from '@/service/contrato/openapi'

import { agendamentosDoPaciente } from '../base/agenda'
import { paciente } from '../base/cadastro'
import { SALAS, USUARIO_ID } from '../base/clinica'
import { agoraIso, dataDe, FUSO, isoDe, jaPassou, somarMinutos } from '../relogio'
import {
  corpoDe,
  despachar,
  erro,
  normalizar,
  ok,
  paginar,
  rota,
  vazio,
  type Pedido,
  type Resposta,
} from '../roteador'
import {
  agruparPorHora,
  aplicarGravidade,
  atualizadoAgora,
  BOLETINS,
  boletim,
  boletimAbertoDe,
  boletimDto,
  boletinsDa,
  boletinsPendentes,
  calcularDose,
  celulasDoMapa,
  conferenciasAtrasadas,
  contarDosesAtrasadas,
  descricaoDaDose,
  dose,
  DOSES,
  dosesDa,
  emCurso,
  emOrdemDeUrgencia,
  EU,
  EVOLUCOES,
  evolucaoDto,
  evolucoesDa,
  existeProfissional,
  gradeDe,
  horaCheia,
  internacao,
  internacaoDoChecklist,
  internacaoDto,
  internacaoNoLeito,
  INTERNACOES,
  itemDaFila,
  leito,
  leitoDto,
  LEITOS,
  leitosEmOrdem,
  ligacaoDevidaDesde,
  linhaDaDose,
  marcarEnviado,
  materializar,
  ms,
  nomeDe,
  novoBoletim,
  novoId,
  observadoDaUltimaEvolucao,
  pacienteDa,
  pacienteInternado,
  pendenciaDoBoletim,
  pendenciasDoPlantao,
  periodoDoBoletim,
  pesoBase,
  plantao,
  plantaoAberto,
  plantaoDoChecklist,
  plantaoDto,
  plantaoParaRegistrar,
  PLANTOES,
  preferenciaDto,
  prescricao,
  prescricaoAtiva,
  prescricaoDoChecklist,
  prescricaoDto,
  PRESCRICOES,
  prescricoesDa,
  profissionaisDas,
  proximaGrade,
  registrarLigacao,
  SALA_DA_INTERNACAO,
  semCanalNoApp,
  situacaoDe,
  suspenderPrescricao,
  vagasPorKind,
  type DoseDaDemo,
  type InternacaoDaDemo,
  type LeitoDaDemo,
  type PlantaoDaDemo,
  type PrescricaoDaDemo,
} from '../dados/internacao'
import { MEDICAMENTOS, type MedicamentoDaInternacao } from '../dados/internacao-roteiro'

const MINUTO = 60_000
const HORA = 60 * MINUTO
const C = '/parceiro/portal/clinica'

const naoEncontrada = () =>
  erro(403, 'OWNERSHIP_FORBIDDEN', 'Não encontramos este registro nesta clínica.')
const encerrada = () =>
  erro(409, 'INTERNACAO_ENCERRADA', 'A internação foi encerrada: ela só se lê agora.')

function hora(iso: string) {
  return isoDe(new Date(iso)).slice(11, 16)
}

/** A internação do pedido, ou a resposta de erro. */
function daInternacao(pedido: Pedido): InternacaoDaDemo | Resposta {
  return internacao(pedido.params.id ?? '') ?? naoEncontrada()
}

function eResposta(valor: unknown): valor is Resposta {
  return typeof valor === 'object' && valor !== null && 'status' in valor && 'corpo' in valor
}

/* ------------------------------------------------------------------------------ leitos */

function nomeLivre(prefixo: string, separador = '') {
  const usados = new Set(LEITOS.map((l) => normalizar(l.nome).replace(/\s+/g, '')))
  for (let n = 1; ; n++) {
    const nome = `${prefixo}${separador}${n}`
    if (!usados.has(normalizar(nome).replace(/\s+/g, ''))) return nome
  }
}

function nomeEmUso(nome: string, fora?: string) {
  const alvo = normalizar(nome.trim())
  return LEITOS.some((l) => l.id !== fora && normalizar(l.nome.trim()) === alvo)
}

function registrarLeitos() {
  rota('GET', `${C}/leitos`, () =>
    ok<ListaDeLeitos>({
      itens: leitosEmOrdem().map(leitoDto),
      nomeSugerido: {
        GERAL: nomeLivre('R'),
        FELINO: nomeLivre('F'),
        ISOLAMENTO: nomeLivre('I'),
        UTI: nomeLivre('UTI', ' '),
      },
      limite: 100,
    }),
  )

  rota('POST', `${C}/leitos`, (pedido) => {
    const corpo = corpoDe<{ salaId: string; nome: string; kind: KindDoLeito }>(pedido)
    const nome = corpo.nome?.trim() ?? ''
    if (!nome || nome.length > 40)
      return erro(400, 'LEITO_INVALIDO', 'O nome do leito precisa ter de 1 a 40 caracteres.')
    if (nomeEmUso(nome)) return erro(409, 'LEITO_NOME_EM_USO', 'Já existe um leito com este nome.')
    if (LEITOS.length >= 100)
      return erro(409, 'LEITOS_NO_LIMITE', 'A clínica chegou ao limite de 100 leitos.')
    const sala = SALAS.find((s) => s.id === corpo.salaId) ?? SALA_DA_INTERNACAO
    const novo: LeitoDaDemo = {
      id: novoId('leito'),
      nome,
      kind: corpo.kind ?? 'GERAL',
      salaId: sala.id,
      ativo: true,
      motivoInativo: null,
      detalheInativo: null,
      inativoDesde: null,
      jaRecebeuPaciente: false,
    }
    LEITOS.push(novo)
    return ok<Leito>(leitoDto(novo), 201)
  })

  rota('PATCH', `${C}/leitos/:id`, (pedido) => {
    const l = leito(pedido.params.id ?? '')
    if (!l) return naoEncontrada()
    const corpo = corpoDe<{ salaId: string; nome: string; kind: KindDoLeito }>(pedido)
    if (corpo.nome !== undefined) {
      const nome = corpo.nome.trim()
      if (!nome || nome.length > 40)
        return erro(400, 'LEITO_INVALIDO', 'O nome do leito precisa ter de 1 a 40 caracteres.')
      if (nomeEmUso(nome, l.id))
        return erro(409, 'LEITO_NOME_EM_USO', 'Já existe um leito com este nome.')
      l.nome = nome
    }
    if (corpo.kind) l.kind = corpo.kind
    if (corpo.salaId && SALAS.some((s) => s.id === corpo.salaId)) l.salaId = corpo.salaId
    return ok<Leito>(leitoDto(l))
  })

  rota('POST', `${C}/leitos/:id/desativar`, (pedido) => {
    const l = leito(pedido.params.id ?? '')
    if (!l) return naoEncontrada()
    const corpo = corpoDe<{ motivo: MotivoDoLeitoInativo; detalhe: string }>(pedido)
    if (internacaoNoLeito(l.id))
      return erro(
        409,
        'LEITO_OCUPADO',
        'O leito tem paciente internado: mude o paciente de leito antes.',
      )
    if (!corpo.motivo) return erro(400, 'LEITO_INVALIDO', 'Escolha o motivo.')
    if (corpo.motivo === 'OUTRO' && !corpo.detalhe?.trim())
      return erro(400, 'LEITO_INVALIDO', 'Com o motivo "outro", conte o que aconteceu.')
    l.ativo = false
    l.motivoInativo = corpo.motivo
    l.detalheInativo = corpo.detalhe?.trim() || null
    l.inativoDesde = agoraIso()
    return ok<Leito>(leitoDto(l))
  })

  rota('POST', `${C}/leitos/:id/reativar`, (pedido) => {
    const l = leito(pedido.params.id ?? '')
    if (!l) return naoEncontrada()
    l.ativo = true
    l.motivoInativo = null
    l.detalheInativo = null
    l.inativoDesde = null
    return ok<Leito>(leitoDto(l))
  })

  rota('DELETE', `${C}/leitos/:id`, (pedido) => {
    const l = leito(pedido.params.id ?? '')
    if (!l) return naoEncontrada()
    if (l.jaRecebeuPaciente)
      return erro(
        409,
        'LEITO_COM_HISTORICO',
        'Este leito já recebeu paciente: desative em vez de apagar.',
      )
    LEITOS.splice(LEITOS.indexOf(l), 1)
    return vazio()
  })
}

/* ----------------------------------------------------------------------- mapa e vagas */

function registrarMapa() {
  rota('GET', `${C}/internacao/mapa`, () => {
    const leitos = celulasDoMapa()
    const internados = leitos.flatMap((c) => (c.internacao ? [c.internacao] : []))
    return ok<Mapa>({
      leitos,
      porUrgencia: emOrdemDeUrgencia(internados).map((i) => i.id),
      vagas: vagasPorKind(),
      cabecalho: {
        ativos: LEITOS.filter((l) => l.ativo).length,
        ocupados: internados.length,
        livres: LEITOS.filter((l) => l.ativo && !internacaoNoLeito(l.id)).length,
        inativos: LEITOS.filter((l) => !l.ativo).length,
        criticos: internados.filter((i) => i.gravidade === 'CRITICO').length,
        cobramAcao: internados.filter((i) => i.urgencia.nivel !== 'NENHUMA').length,
      },
      geradoEm: agoraIso(),
    })
  })

  rota('GET', `${C}/internacao/vagas`, () => {
    const porKind = vagasPorKind()
    return ok<Vagas>({
      porKind,
      livres: porKind.reduce((soma, v) => soma + v.livres, 0),
      ocupados: porKind.reduce((soma, v) => soma + v.ocupados, 0),
      inativos: porKind.reduce((soma, v) => soma + v.inativos, 0),
    })
  })
}

/* --------------------------------------------------------------------------- internar */

type AvisoDeLeito = 'GATO_EM_LEITO_COMUM' | 'NAO_GATO_EM_LEITO_FELINO'

function avisosDoLeito(especie: string, kind: KindDoLeito): AvisoDeLeito[] {
  if (especie === 'GATO' && kind === 'GERAL') return ['GATO_EM_LEITO_COMUM']
  if (especie !== 'GATO' && kind === 'FELINO') return ['NAO_GATO_EM_LEITO_FELINO']
  return []
}

function faltaConfirmar(avisos: AvisoDeLeito[], confirmados: AvisoDeLeito[] | undefined) {
  return avisos.length > 0 && !avisos.every((a) => confirmados?.includes(a))
}

function registrarCasos() {
  rota('POST', `${C}/internacoes`, (pedido) => {
    const corpo = corpoDe<NovaInternacao>(pedido)
    const p = corpo.pacienteId ? paciente(corpo.pacienteId) : null
    if (!p || !p.ativo) return naoEncontrada()
    if (pacienteInternado(p.id))
      return erro(409, 'PACIENTE_INTERNADO', `${p.nome} já está internado nesta clínica.`)
    const l = corpo.leitoId ? leito(corpo.leitoId) : null
    if (!l || !l.ativo || internacaoNoLeito(l.id))
      return erro(409, 'LEITO_INDISPONIVEL', 'Este leito não está mais livre. Escolha outro.')
    const motivo = corpo.motivo?.trim() ?? ''
    if (!motivo || motivo.length > 300)
      return erro(400, 'INTERNACAO_INVALIDA', 'Conte o motivo da internação (até 300 caracteres).')
    const peso = corpo.pesoEntradaKg
    if (typeof peso !== 'number' || peso < 0.01 || peso > 999.99)
      return erro(400, 'INTERNACAO_INVALIDA', 'Informe o peso de entrada em kg.')
    const avisos = avisosDoLeito(p.especie, l.kind)
    if (faltaConfirmar(avisos, corpo.confirmarAvisos))
      return erro(
        409,
        'LEITO_INCOMPATIVEL',
        'Este leito não é o indicado para a espécie. Confirme para seguir.',
        { avisos },
      )
    if (
      p.pesoKg &&
      (peso / p.pesoKg > 1.5 || peso / p.pesoKg < 0.67) &&
      corpo.confirmarPesoKg !== peso
    )
      return erro(
        422,
        'PESO_DIVERGENTE',
        'O peso está muito diferente do último registrado. Digite de novo para confirmar.',
        {
          ultimoPesoKg: p.pesoKg,
          informadoKg: peso,
        },
      )
    const entradaEm = corpo.entradaEm ?? agoraIso()
    if (ms(entradaEm) > Date.now() + MINUTO || ms(entradaEm) < Date.now() - 24 * HORA)
      return erro(
        400,
        'INTERNACAO_DATA_INVALIDA',
        'A entrada pode ser de até 24 horas atrás, nunca no futuro.',
        { campo: 'entradaEm' },
      )
    if (
      corpo.altaPrevistaEm &&
      (!jaPassou(entradaEm) ||
        ms(corpo.altaPrevistaEm) <= ms(entradaEm) ||
        jaPassou(corpo.altaPrevistaEm))
    )
      return erro(
        400,
        'INTERNACAO_DATA_INVALIDA',
        'A previsão de alta precisa ser depois de agora.',
        { campo: 'altaPrevistaEm' },
      )
    const responsavel = corpo.responsavelProfissionalId ?? EU
    if (!existeProfissional(responsavel))
      return erro(403, 'CRMV_OBRIGATORIO', 'Escolha um veterinário com CRMV em dia.', {
        campo: 'responsavelProfissionalId',
      })

    const nova: InternacaoDaDemo = {
      id: novoId('internacao'),
      pacienteId: p.id,
      leitoId: l.id,
      status: 'INTERNADO',
      responsavelId: responsavel,
      internadoPorId: EU,
      atendimentoId: corpo.atendimentoId ?? null,
      motivo,
      diagnosticoDeTrabalho: corpo.diagnosticoDeTrabalho?.trim() || null,
      observacao: corpo.observacao?.trim() || null,
      entradaEm,
      altaPrevistaEm: corpo.altaPrevistaEm ?? null,
      encerradaEm: null,
      gravidade: corpo.gravidade ?? 'ESTAVEL',
      gravidadeNaEntrada: corpo.gravidade ?? 'ESTAVEL',
      pesoEntradaKg: peso,
      orientacaoDeSaida: null,
      avisadoPorTelefone: null,
      motivoEncerramentoAdministrativo: null,
      mudancasDeLeito: [],
      mudancasDeGravidade: [],
      ligacoes: [],
      preferencia: {
        frequenciaHoras: 6,
        fotoSempre: false,
        silencioNoturno: true,
        definidaPor: null,
        definidaEm: null,
      },
    }
    INTERNACOES.push(nova)
    l.jaRecebeuPaciente = true
    return ok<Internacao>(internacaoDto(nova), 201)
  })

  rota('GET', `${C}/internacoes/:id`, (pedido) => {
    const i = daInternacao(pedido)
    return eResposta(i) ? i : ok<Internacao>(internacaoDto(i))
  })

  rota('PATCH', `${C}/internacoes/:id`, (pedido) => {
    const i = daInternacao(pedido)
    if (eResposta(i)) return i
    if (!emCurso(i)) return encerrada()
    const corpo = corpoDe<EditarInternacaoDto>(pedido)
    if ('diagnosticoDeTrabalho' in corpo)
      i.diagnosticoDeTrabalho = corpo.diagnosticoDeTrabalho?.trim() || null
    if ('observacao' in corpo) i.observacao = corpo.observacao?.trim() || null
    if (corpo.responsavelProfissionalId) {
      if (!existeProfissional(corpo.responsavelProfissionalId))
        return erro(403, 'CRMV_OBRIGATORIO', 'Escolha um veterinário com CRMV em dia.', {
          campo: 'responsavelProfissionalId',
        })
      i.responsavelId = corpo.responsavelProfissionalId
    }
    return ok<Internacao>(internacaoDto(i))
  })

  rota('POST', `${C}/internacoes/:id/mudar-leito`, (pedido) => {
    const i = daInternacao(pedido)
    if (eResposta(i)) return i
    if (!emCurso(i)) return encerrada()
    const corpo = corpoDe<MudarLeitoDto>(pedido)
    const para = corpo.paraLeitoId ? leito(corpo.paraLeitoId) : null
    if (!para || !para.ativo || internacaoNoLeito(para.id))
      return erro(409, 'LEITO_INDISPONIVEL', 'Este leito não está mais livre. Escolha outro.')
    const avisos = avisosDoLeito(pacienteDa(i).especie, para.kind)
    if (faltaConfirmar(avisos, corpo.confirmarAvisos))
      return erro(
        409,
        'LEITO_INCOMPATIVEL',
        'Este leito não é o indicado para a espécie. Confirme para seguir.',
        { avisos },
      )
    const de = leito(i.leitoId)
    i.mudancasDeLeito.push({
      de: { id: i.leitoId, nome: de?.nome ?? '', kind: de?.kind ?? 'GERAL' },
      para: { id: para.id, nome: para.nome, kind: para.kind },
      em: agoraIso(),
      motivo: corpo.motivo?.trim() || null,
    })
    i.leitoId = para.id
    para.jaRecebeuPaciente = true
    return ok<Internacao>(internacaoDto(i))
  })

  rota('POST', `${C}/internacoes/:id/gravidade`, (pedido) => {
    const i = daInternacao(pedido)
    if (eResposta(i)) return i
    if (!emCurso(i)) return encerrada()
    const nova = corpoDe<{ gravidade: Gravidade }>(pedido).gravidade
    if (!nova) return erro(400, 'INTERNACAO_INVALIDA', 'Escolha a gravidade.')
    const mudou = aplicarGravidade(i, nova)
    return ok<Internacao>({ ...internacaoDto(i), semMudanca: !mudou })
  })

  rota('POST', `${C}/internacoes/:id/previsao-de-alta`, (pedido) => {
    const i = daInternacao(pedido)
    if (eResposta(i)) return i
    if (!emCurso(i)) return encerrada()
    const valor = corpoDe<{ altaPrevistaEm: string | null }>(pedido).altaPrevistaEm ?? null
    if (
      valor !== null &&
      (jaPassou(valor) ||
        ms(valor) <= ms(i.entradaEm) ||
        ms(valor) > ms(i.entradaEm) + 60 * 24 * HORA)
    )
      return erro(
        400,
        'INTERNACAO_DATA_INVALIDA',
        'A previsão precisa ser depois de agora e até 60 dias da entrada.',
        { campo: 'altaPrevistaEm' },
      )
    i.altaPrevistaEm = valor
    return ok<Internacao>(internacaoDto(i))
  })

  rota('POST', `${C}/internacoes/:id/encerrar`, (pedido) => encerrar(pedido))

  rota('POST', `${C}/internacoes/:id/encerrar-administrativo`, (pedido) => {
    const i = daInternacao(pedido)
    if (eResposta(i)) return i
    if (!emCurso(i)) return encerrada()
    return erro(
      409,
      'ENCERRAMENTO_ADMINISTRATIVO_COM_VETERINARIO',
      'A clínica tem veterinário com CRMV em dia: quem encerra é o veterinário.',
    )
  })
}

const DESFECHOS: Desfecho[] = ['ALTA', 'TRANSFERIDO', 'OBITO']

function encerrar(pedido: Pedido): Resposta {
  const i = daInternacao(pedido)
  if (eResposta(i)) return i
  if (!emCurso(i)) return encerrada()
  const corpo = corpoDe<EncerrarInternacaoDto>(pedido)
  const desfecho = corpo.desfecho
  if (!desfecho || !DESFECHOS.includes(desfecho))
    return erro(400, 'INTERNACAO_INVALIDA', 'Escolha o desfecho: alta, transferência ou óbito.')
  const orientacao = corpo.orientacao?.trim() ?? ''
  if (orientacao.length < 10 || orientacao.length > 2000)
    return erro(
      422,
      'ORIENTACAO_OBRIGATORIA',
      'Escreva a orientação de saída (pelo menos 10 caracteres).',
      { minimo: 10 },
    )
  if (desfecho !== 'ALTA' && !corpo.avisadoPorTelefone)
    return erro(422, 'ALTA_SEM_AVISO', 'Registre quem avisou a família por telefone.', { desfecho })
  const ocorreuEm = corpo.ocorreuEm ?? agoraIso()
  if (ms(ocorreuEm) < ms(i.entradaEm) || ms(ocorreuEm) > Date.now() + MINUTO)
    return erro(
      400,
      'INTERNACAO_DATA_INVALIDA',
      'O desfecho precisa ser entre a entrada e agora.',
      { campo: 'ocorreuEm' },
    )

  const agora = agoraIso()
  const doses = dosesDa(i.id)
  const feitas = doses.filter((d) => d.status === 'FEITA').length
  const naoFeitas = doses.filter((d) => d.status === 'PULADA' || d.status === 'RECUSADA').length
  const pendentes = doses.filter((d) => d.status === 'PENDENTE')
  const pendentesAgora = pendentes.filter((d) => {
    const s = situacaoDe(d)
    return s === 'na-janela' || s === 'atrasada'
  }).length
  const futuras = pendentes.filter((d) => situacaoDe(d) === 'futura')
  for (const d of futuras) d.status = 'SUSPENSA'
  const boletinsRetidos = BOLETINS.filter(
    (b) => b.internacaoId === i.id && b.status === 'RETIDO',
  ).length
  const boletinsEnviados = BOLETINS.filter(
    (b) => b.internacaoId === i.id && b.status === 'ENVIADO',
  ).length

  for (const p of prescricoesDa(i.id).filter(prescricaoAtiva))
    p.suspensao = { em: agora, motivo: 'Internação encerrada', porId: EU, substituidaPorId: null }
  for (const b of BOLETINS) {
    if (b.internacaoId !== i.id) continue
    if (b.status === 'RASCUNHO' || b.status === 'RETIDO' || b.status === 'LIBERADO') {
      b.status = 'CANCELADO'
      b.canceladoEm = agora
      b.motivoCancelamento = 'ENCERRAMENTO'
      b.atualizadoEm = agora
    }
  }

  i.status = desfecho
  i.encerradaEm = ocorreuEm
  i.orientacaoDeSaida = orientacao
  i.avisadoPorTelefone = corpo.avisadoPorTelefone
    ? { em: corpo.avisadoPorTelefone.em, porId: corpo.avisadoPorTelefone.porProfissionalId }
    : null

  if (desfecho === 'ALTA' && !semCanalNoApp(i)) {
    const b = novoBoletim(i, {
      tipo: 'ALTA',
      status: 'ENVIADO',
      geradoEm: agora,
      autorUsuarioId: USUARIO_ID,
      texto: `${pacienteDa(i).nome} teve alta. Estas são as orientações da equipe para casa:\n\n${orientacao}`,
    })
    marcarEnviado(b, i, agora)
  }

  let obito: NonNullable<Internacao['encerramento']>['obito'] = null
  if (desfecho === 'OBITO') {
    const p = pacienteDa(i)
    const dia = dataDe(new Date(ocorreuEm))
    const vinculos = p.noApp ? 1 : 0
    p.ativo = false
    p.inativoMotivo = 'OBITO'
    p.obitoEm = dia
    p.noApp = false
    let cancelados = 0
    for (const a of agendamentosDoPaciente(p.id)) {
      if (a.inicio.slice(0, 10) >= dia && (a.status === 'AGENDADO' || a.status === 'CONFIRMADO')) {
        a.status = 'CANCELADO'
        a.canceladoEm = agora
        a.motivoCancelamento = 'OBITO'
        a.canceladoPor = null
        cancelados++
      }
    }
    obito = {
      obitoEm: dia,
      agendamentosCancelados: cancelados,
      vinculosEncerrados: vinculos,
      hospedagensEncerradas: 0,
    }
  }

  const avisos: NonNullable<Internacao['encerramento']>['avisos'] = []
  if (pendentesAgora) avisos.push('DOSE_PENDENTE')
  if (futuras.length) avisos.push('DOSE_FUTURA')
  if (boletinsRetidos) avisos.push('BOLETIM_RETIDO')

  const dto = internacaoDto(i)
  return ok<Internacao>({
    ...dto,
    encerramento: {
      resumo: {
        horas: dto.horasInternado,
        feitas,
        naoFeitas,
        pendentesAgora,
        aSuspender: futuras.length,
        boletinsRetidos,
        boletinsEnviados,
      },
      avisos,
      obito,
    },
  })
}

/* ------------------------------------------------------------------------ prescrições */

/** O remédio do catálogo: os do roteiro, ou o catálogo da área do prontuário (a busca dela). */
async function medicamentoPorId(id: string): Promise<MedicamentoDaInternacao | null> {
  const meu = Object.values(MEDICAMENTOS).find((m) => m.id === id)
  if (meu) return meu
  try {
    const resposta = await despachar(`${C}/catalogos/medicamentos?limite=100`, { method: 'GET' })
    if (!resposta.ok) return null
    const corpo = (await resposta.json()) as { data?: unknown }
    const lista = Array.isArray(corpo.data) ? corpo.data : []
    const item = lista.find(
      (m): m is Record<string, unknown> => Boolean(m) && (m as { id?: unknown }).id === id,
    )
    if (!item) return null
    const unidade = String(item.unidadeApresentacao ?? 'ML')
    const controle = String(item.controle ?? 'NENHUM')
    return {
      id,
      nome: String(item.nome ?? 'Medicamento'),
      principioAtivo: String(item.principioAtivo ?? ''),
      concentracao: Number(item.concentracao) || 1,
      unidade:
        unidade === 'COMPRIMIDO' || unidade === 'GOTA' || unidade === 'APLICACAO' ? unidade : 'ML',
      regime:
        controle === 'MAPA_VETERINARIO' ||
        controle === 'ANVISA_HUMANO' ||
        controle === 'ANVISA_RETENCAO'
          ? controle
          : 'NENHUM',
    }
  } catch {
    return null
  }
}

function mesmoFarmaco(outra: PrescricaoDaDemo, p: PrescricaoDaDemo) {
  if (outra.id === p.id || outra.id === p.substituiPrescricaoId) return true
  return Boolean(
    p.principioAtivo &&
    outra.principioAtivo &&
    outra.internacaoId === p.internacaoId &&
    normalizar(outra.principioAtivo) === normalizar(p.principioAtivo),
  )
}

function registrarPrescricoes() {
  rota('GET', `${C}/internacoes/:id/prescricoes`, (pedido) => {
    const i = daInternacao(pedido)
    if (eResposta(i)) return i
    const todas = prescricoesDa(i.id)
    const ativas = todas
      .filter(prescricaoAtiva)
      .sort((a, b) => a.primeiroHorario.localeCompare(b.primeiroHorario))
    const inativas = todas
      .filter((p) => !prescricaoAtiva(p))
      .sort((a, b) =>
        (b.suspensao?.em ?? b.encerraEm ?? '').localeCompare(a.suspensao?.em ?? a.encerraEm ?? ''),
      )
    return ok<ListaDePrescricoes>({
      internacaoId: i.id,
      encerrada: !emCurso(i),
      peso: pesoBase(i),
      ativas: ativas.slice(0, 40).map(prescricaoDto),
      inativas: inativas.slice(0, 100).map(prescricaoDto),
      inativasTruncado: inativas.length > 100,
      medicacaoDaEstadia: null,
    })
  })

  rota('POST', `${C}/internacoes/:id/prescricoes`, async (pedido) => {
    const i = daInternacao(pedido)
    if (eResposta(i)) return i
    if (!emCurso(i)) return encerrada()
    const corpo = corpoDe<NovaPrescricaoNaInternacao>(pedido)
    const kind = corpo.kind ?? 'MEDICAMENTO'
    const primeiro = corpo.primeiroHorario
    if (!primeiro || ms(primeiro) < Date.now() - 30 * MINUTO)
      return erro(
        400,
        'PRESCRICAO_PRIMEIRO_HORARIO_NO_PASSADO',
        'O primeiro horário pode ser de no máximo 30 minutos atrás.',
        { toleranciaMinutos: 30 },
      )
    if (ms(primeiro) > Date.now() + 7 * 24 * HORA)
      return erro(
        400,
        'INTERNACAO_DATA_INVALIDA',
        'O primeiro horário pode ser de até 7 dias à frente.',
        { campo: 'primeiroHorario', reason: 'DISTANTE' },
      )
    if (corpo.encerraEm && ms(corpo.encerraEm) < ms(primeiro))
      return erro(
        400,
        'INTERNACAO_DATA_INVALIDA',
        'O fim precisa ser depois do primeiro horário.',
        { campo: 'encerraEm', reason: 'ANTES_DO_PRIMEIRO_HORARIO' },
      )
    const frequencia = corpo.frequenciaHoras ?? (kind === 'FLUIDO' ? 1 : 0)
    if (!frequencia || frequencia > 168)
      return erro(400, 'PRESCRICAO_INVALIDA', 'Escolha de quantas em quantas horas.', {
        campo: 'frequenciaHoras',
      })

    const antiga = corpo.substituiPrescricaoId ? prescricao(corpo.substituiPrescricaoId) : null
    if (corpo.substituiPrescricaoId && (!antiga || antiga.internacaoId !== i.id))
      return naoEncontrada()
    if (antiga && !prescricaoAtiva(antiga))
      return erro(
        409,
        'PRESCRICAO_ENCERRADA',
        'A prescrição que você queria trocar já foi suspensa ou terminou.',
      )

    let med: MedicamentoDaInternacao | null = null
    let conta: ReturnType<typeof calcularDose> | null = null
    let descricao = corpo.descricao?.trim() ?? ''
    if (kind === 'MEDICAMENTO') {
      if (!corpo.medicamentoId || !corpo.via || !corpo.mgPorKg)
        return erro(400, 'PRESCRICAO_INVALIDA', 'Escolha o medicamento, a via e a dose em mg/kg.')
      med = (await medicamentoPorId(corpo.medicamentoId)) ?? {
        id: corpo.medicamentoId,
        nome:
          antiga?.medicamentoId === corpo.medicamentoId
            ? antiga.descricao
            : 'Medicamento do catálogo',
        principioAtivo:
          antiga?.medicamentoId === corpo.medicamentoId ? (antiga.principioAtivo ?? '') : '',
        concentracao: 1,
        unidade: 'ML',
        regime: 'NENHUM',
      }
      const alergia = pacienteDa(i).alertas.find(
        (a) =>
          a.ativo &&
          a.tipo === 'ALERGIA' &&
          med!.principioAtivo &&
          normalizar(a.detalhe).includes(normalizar(med!.principioAtivo)),
      )
      if (alergia && !corpo.alergiaConfirmada)
        return erro(422, 'CONFIRMACAO_PENDENTE', 'Confira os avisos da dose antes de prescrever.', {
          avisos: ['ALERGIA'],
          detalhes: { alergia: alergia.detalhe },
        })
      conta = calcularDose(med, corpo.mgPorKg, i.pesoEntradaKg, frequencia, corpo.via)
      if (conta.dose && conta.dose.arredondamentoConfirmado && !corpo.arredondamentoConfirmado)
        return erro(422, 'CONFIRMACAO_PENDENTE', 'Confira os avisos da dose antes de prescrever.', {
          avisos: ['DOSE_ARREDONDADA'],
          dose: {
            mgCalculado: conta.dose.mgPorAdministracao,
            mgReal: conta.dose.mgReal,
            aproximado: true,
            quantidade: conta.dose.quantidade,
            unidade: conta.dose.unidade,
            fracao: conta.dose.fracao,
          },
        })
      descricao = med.nome
    } else if (!descricao || descricao.length > 200) {
      return erro(400, 'PRESCRICAO_INVALIDA', 'Descreva o item (até 200 caracteres).', {
        campo: 'descricao',
      })
    }

    const ativas = prescricoesDa(i.id).filter((p) => prescricaoAtiva(p) && p.id !== antiga?.id)
    const iguais =
      kind === 'MEDICAMENTO'
        ? ativas.filter(
            (p) =>
              p.medicamentoId === med!.id ||
              Boolean(
                p.principioAtivo &&
                med!.principioAtivo &&
                normalizar(p.principioAtivo) === normalizar(med!.principioAtivo),
              ),
          )
        : kind === 'FLUIDO'
          ? ativas.filter((p) => p.kind === 'FLUIDO')
          : []
    if (iguais.length && !corpo.confirmarDuplicidade)
      return erro(
        409,
        'PRESCRICAO_DUPLICADA',
        'Este item já está prescrito e ativo nesta internação.',
        {
          prescricaoIds: iguais.map((p) => p.id),
          exigeConfirmacao: true,
        },
      )
    if (ativas.length >= 40)
      return erro(
        409,
        'PRESCRICOES_NO_LIMITE',
        'A internação chegou ao limite de 40 prescrições ativas.',
        { limite: 40 },
      )

    const nova: PrescricaoDaDemo = {
      id: novoId('prescricao'),
      internacaoId: i.id,
      kind,
      medicamentoId: med?.id ?? null,
      descricao,
      principioAtivo: med?.principioAtivo || null,
      via: kind === 'MEDICAMENTO' ? (corpo.via ?? null) : (corpo.via ?? null),
      dose: conta?.dose ?? null,
      doseTexto: conta?.doseTexto ?? null,
      regime: med?.regime ?? null,
      frequenciaHoras: frequencia,
      continuo: kind === 'FLUIDO',
      primeiroHorario: isoDe(new Date(Math.floor(ms(primeiro) / MINUTO) * MINUTO)),
      encerraEm: corpo.encerraEm ?? null,
      materializadoAte: primeiro,
      prescritoPorId: EU,
      prescritoEm: agoraIso(),
      suspensao: null,
      substituiPrescricaoId: antiga?.id ?? null,
      observacao: corpo.observacao?.trim() || null,
    }
    if (antiga) suspenderPrescricao(antiga, 'Dose trocada por uma prescrição nova', EU, nova.id)
    PRESCRICOES.push(nova)
    const dosesCriadas = materializar(nova)

    return ok<PrescricaoCriada>(
      {
        ...prescricaoDto(nova),
        peso: pesoBase(i),
        dosesCriadas,
        avisos: [],
        responsabilidade: 'A conta é para conferência: a dose e a decisão são do veterinário.',
        substituida: antiga?.id ?? null,
      },
      201,
    )
  })

  rota('POST', `${C}/internacoes/:id/prescricoes/:pid/suspender`, (pedido) => {
    const i = daInternacao(pedido)
    if (eResposta(i)) return i
    const p = prescricao(pedido.params.pid ?? '')
    if (!p || p.internacaoId !== i.id) return naoEncontrada()
    if (!emCurso(i)) return encerrada()
    const motivo = corpoDe<{ motivo: string }>(pedido).motivo?.trim() ?? ''
    if (!motivo || motivo.length > 300)
      return erro(400, 'PRESCRICAO_INVALIDA', 'Conte o motivo da suspensão (até 300 caracteres).', {
        campo: 'motivo',
      })
    if (p.suspensao)
      return ok<PrescricaoDeInternacaoSuspensaDto>({
        ...prescricaoDto(p),
        dosesSuspensas: 0,
        semMudanca: true,
      })
    const dosesSuspensas = suspenderPrescricao(p, motivo, EU)
    return ok<PrescricaoDeInternacaoSuspensaDto>({
      ...prescricaoDto(p),
      dosesSuspensas,
      semMudanca: false,
    })
  })
}

/* ---------------------------------------------------------------------- checklists */

function periodoDe(pedido: Pedido, padrao: { de: number; ate: number }, maxHoras: number) {
  const deTexto = pedido.query.get('de')
  const ateTexto = pedido.query.get('ate')
  let de = deTexto ? ms(deTexto) : NaN
  let ate = ateTexto ? ms(ateTexto) : NaN
  if (!deTexto && !ateTexto) {
    de = padrao.de
    ate = padrao.ate
  } else if (!ateTexto) {
    ate = de + 24 * HORA
  } else if (!deTexto) {
    de = ate - 24 * HORA
  }
  if (!Number.isFinite(de) || !Number.isFinite(ate) || ate <= de)
    return erro(400, 'CHECKLIST_PERIODO_INVALIDO', 'O período do checklist é inválido.', {
      reason: 'ANTES_DO_INICIO',
      maxHoras,
    })
  if (ate - de > maxHoras * HORA)
    return erro(
      400,
      'CHECKLIST_PERIODO_INVALIDO',
      `O checklist mostra no máximo ${maxHoras} horas.`,
      { maxHoras },
    )
  return { de, ate }
}

function contarSituacoes(linhas: DoseDaDemo[]) {
  let dosesAtrasadas = 0
  let conferenciasAtrasadas = 0
  let naJanela = 0
  for (const d of linhas) {
    const s = situacaoDe(d)
    if (s === 'atrasada') {
      if (d.conferencia) conferenciasAtrasadas++
      else dosesAtrasadas++
    } else if (s === 'na-janela') naJanela++
  }
  return { dosesAtrasadas, conferenciasAtrasadas, naJanela }
}

function prescricoesDas(linhas: DoseDaDemo[]) {
  const ids = [...new Set(linhas.map((d) => d.prescricaoId))]
  return ids.flatMap((id) => {
    const p = prescricao(id)
    return p ? [prescricaoDoChecklist(p)] : []
  })
}

function registrarChecklists() {
  rota('GET', `${C}/internacoes/:id/checklist`, (pedido) => {
    const i = daInternacao(pedido)
    if (eResposta(i)) return i
    const agora = Date.now()
    const periodo = periodoDe(pedido, { de: agora - 12 * HORA, ate: agora + 12 * HORA }, 48)
    if (eResposta(periodo)) return periodo
    const linhas = dosesDa(i.id).filter((d) => {
      const t = ms(d.previstaPara)
      return t >= periodo.de && t <= periodo.ate
    })
    return ok<ChecklistDaInternacao>({
      de: isoDe(new Date(periodo.de)),
      ate: isoDe(new Date(periodo.ate)),
      agora: agoraIso(),
      linhaDoAgora: horaCheia(agoraIso()),
      truncado: false,
      totalLido: linhas.length,
      plantao: plantaoDoChecklist(),
      prescricoes: prescricoesDas(linhas),
      profissionais: profissionaisDas(linhas),
      internacaoId: i.id,
      encerrada: !emCurso(i),
      contagens: contarSituacoes(linhas),
      grupos: agruparPorHora(linhas.map((d) => ({ ...linhaDaDose(d), observacao: d.observacao }))),
    })
  })

  rota('GET', `${C}/internacao/checklist`, (pedido) => {
    const grade = gradeDe(agoraIso())
    const periodo = periodoDe(pedido, { de: ms(grade.inicio), ate: ms(grade.fimPrevisto) }, 12)
    if (eResposta(periodo)) return periodo
    const desde = periodo.de - 12 * HORA
    const linhas = DOSES.filter((d) => {
      const i = internacao(d.internacaoId)
      if (!i || !emCurso(i)) return false
      const t = ms(d.previstaPara)
      if (t >= periodo.de && t <= periodo.ate) return true
      return t >= desde && t < periodo.de && situacaoDe(d) === 'atrasada'
    })
    const contagens = contarSituacoes(linhas)
    const geral = contarDosesAtrasadas()
    const internacoes = [...new Set(linhas.map((d) => d.internacaoId))].flatMap((id) => {
      const i = internacao(id)
      return i ? [internacaoDoChecklist(i)] : []
    })
    return ok<ChecklistDoPlantao>({
      de: isoDe(new Date(periodo.de)),
      ate: isoDe(new Date(periodo.ate)),
      agora: agoraIso(),
      linhaDoAgora: horaCheia(agoraIso()),
      truncado: false,
      totalLido: linhas.length,
      plantao: plantaoDoChecklist(),
      prescricoes: prescricoesDas(linhas),
      profissionais: profissionaisDas(linhas),
      atrasadasDesde: isoDe(new Date(desde)),
      internacoes,
      contagens: {
        dosesAtrasadas: geral,
        conferenciasAtrasadas: Math.max(
          contagens.conferenciasAtrasadas,
          conferenciasAtrasadas().length,
        ),
        naJanela: contagens.naJanela,
        atrasadasForaDaLista: Math.max(0, geral - contagens.dosesAtrasadas),
      },
      grupos: agruparPorHora(linhas.map(linhaDaDose)),
    })
  })
}

/* --------------------------------------------------------------------- registrar a dose */

function doseRegistrada(d: DoseDaDemo, semMudanca: boolean): DoseRegistrada {
  const p = prescricao(d.prescricaoId)!
  return {
    ...linhaDaDose(d),
    observacao: d.observacao,
    prescricao: prescricaoDoChecklist(p),
    executadaPor: d.executadaPorId
      ? { profissionalId: d.executadaPorId, nome: nomeDe(d.executadaPorId) }
      : null,
    atribuidaA: d.atribuidaAId
      ? { profissionalId: d.atribuidaAId, nome: nomeDe(d.atribuidaAId) }
      : null,
    semMudanca,
  }
}

function registrarDoses() {
  rota('POST', `${C}/administracoes/:id/registrar`, (pedido) => {
    const d = dose(pedido.params.id ?? '')
    if (!d) return naoEncontrada()
    const i = internacao(d.internacaoId)
    const p = prescricao(d.prescricaoId)
    if (!i || !p) return naoEncontrada()
    if (!emCurso(i)) return encerrada()
    if (d.status === 'SUSPENSA' || p.suspensao)
      return erro(
        409,
        'PRESCRICAO_ENCERRADA',
        'Esta prescrição foi suspensa: a dose não se registra mais.',
        { reason: 'SUSPENSA' },
      )
    if (d.status !== 'PENDENTE') {
      const quem = d.executadaPorId ? nomeDe(d.executadaPorId) : 'Alguém da equipe'
      return erro(
        409,
        'DOSE_JA_REGISTRADA',
        `${quem} registrou esta dose às ${hora(d.registradaEm ?? agoraIso())}.`,
        {
          status: d.status,
          em: d.registradaEm,
          porNome: quem,
        },
      )
    }
    const corpo = corpoDe<Registro>(pedido)
    const status = corpo.status
    if (status !== 'FEITA' && status !== 'PULADA' && status !== 'RECUSADA')
      return erro(400, 'MOTIVO_OBRIGATORIO', 'Diga se deu, pulou ou se o animal recusou.', {
        campo: 'status',
      })
    if (d.conferencia && status === 'RECUSADA')
      return erro(
        422,
        'PRESCRICAO_INVALIDA',
        'A conferência da bomba não se recusa: confira ou pule.',
        { reason: 'CONFERENCIA_NAO_SE_RECUSA' },
      )
    if (status === 'FEITA' && corpo.motivo)
      return erro(400, 'MOTIVO_OBRIGATORIO', 'O motivo só vale para a dose não dada.', {
        reason: 'SO_NA_NAO_DADA',
      })
    if (status !== 'FEITA' && !d.conferencia && !corpo.motivo)
      return erro(400, 'MOTIVO_OBRIGATORIO', 'Escolha o motivo.', { campo: 'motivo' })
    const observacao = corpo.observacao?.trim() ?? ''
    if ((corpo.motivo === 'OUTRO' || (d.conferencia && status === 'PULADA')) && !observacao)
      return erro(400, 'MOTIVO_OBRIGATORIO', 'Conte o que aconteceu na observação.', {
        campo: 'observacao',
      })
    const executadaEm = corpo.executadaEm ?? agoraIso()
    if (ms(executadaEm) > Date.now() + MINUTO)
      return erro(400, 'INTERNACAO_DATA_INVALIDA', 'A hora não pode ser no futuro.', {
        campo: 'executadaEm',
        reason: 'NO_FUTURO',
      })
    if (ms(executadaEm) < Date.now() - 12 * HORA)
      return erro(400, 'INTERNACAO_DATA_INVALIDA', 'O registro pode ser de até 12 horas atrás.', {
        campo: 'executadaEm',
        reason: 'ANTIGA_DEMAIS',
      })

    if (status === 'FEITA') {
      const antecipada = Math.round((ms(d.previstaPara) - ms(executadaEm)) / MINUTO)
      if (antecipada > 30 && !corpo.confirmarAntecipada)
        return erro(
          409,
          'DOSE_FORA_DA_JANELA',
          `A dose está ${antecipada} minutos adiantada. Confirme e explique na observação.`,
          {
            antecipadaMinutos: antecipada,
            toleranciaMinutos: 30,
            exigeConfirmacao: true,
          },
        )
      if (antecipada > 30 && !observacao)
        return erro(
          400,
          'MOTIVO_OBRIGATORIO',
          'Explique na observação por que a dose foi adiantada.',
          { campo: 'observacao' },
        )
      if (p.kind === 'MEDICAMENTO' && !corpo.confirmarIntervalo) {
        const metade = (p.frequenciaHoras * HORA) / 2
        const outra = DOSES.find((x) => {
          if (x.id === d.id || x.status !== 'FEITA' || !x.executadaEm) return false
          const dela = prescricao(x.prescricaoId)
          return Boolean(
            dela && mesmoFarmaco(dela, p) && Math.abs(ms(x.executadaEm) - ms(executadaEm)) < metade,
          )
        })
        if (outra)
          return erro(
            409,
            'INTERVALO_CURTO_ENTRE_DOSES',
            `Uma dose deste medicamento foi dada às ${hora(outra.executadaEm!)}, há menos da metade do intervalo.`,
            {
              outraEm: outra.executadaEm,
              frequenciaHoras: p.frequenciaHoras,
              exigeConfirmacao: true,
            },
          )
      }
    }

    d.status = status
    d.motivo = status === 'FEITA' ? null : (corpo.motivo ?? null)
    d.observacao = observacao || null
    d.executadaEm = executadaEm
    d.registradaEm = agoraIso()
    d.executadaPorId = EU
    d.turnoId = plantaoParaRegistrar().id
    return ok<DoseRegistrada>(doseRegistrada(d, false))
  })

  rota('POST', `${C}/administracoes/:id/desfazer`, (pedido) => {
    const d = dose(pedido.params.id ?? '')
    if (!d) return naoEncontrada()
    const i = internacao(d.internacaoId)
    const p = prescricao(d.prescricaoId)
    if (!i || !p) return naoEncontrada()
    if (!emCurso(i)) return encerrada()
    if (d.status === 'SUSPENSA' || p.suspensao)
      return erro(
        409,
        'PRESCRICAO_ENCERRADA',
        'Esta prescrição foi suspensa: não há mais o que dar.',
        { reason: 'SUSPENSA' },
      )
    if (d.status === 'PENDENTE') return ok<DoseRegistrada>(doseRegistrada(d, true))
    const negado = (reason: string) =>
      erro(
        403,
        'DESFAZER_NEGADO',
        'Só quem registrou desfaz, no mesmo plantão e em até 12 horas.',
        { reason, limiteHoras: 12 },
      )
    if (d.executadaPorId !== EU) return negado('OUTRO_AUTOR')
    if (d.turnoId !== plantaoAberto()?.id) return negado('OUTRO_PLANTAO')
    if (d.registradaEm && ms(d.registradaEm) < Date.now() - 12 * HORA) return negado('PRAZO')
    Object.assign(d, {
      status: 'PENDENTE',
      motivo: null,
      executadaEm: null,
      registradaEm: null,
      executadaPorId: null,
      turnoId: null,
      observacao: null,
    })
    return ok<DoseRegistrada>(doseRegistrada(d, false))
  })
}

/* ---------------------------------------------------------------------------- plantão */

type SituacaoPendente = 'futura' | 'na-janela' | 'atrasada'

function situacaoPendente(d: DoseDaDemo): SituacaoPendente {
  const s = situacaoDe(d)
  return s === 'na-janela' || s === 'atrasada' ? s : 'futura'
}

function registrarPlantao() {
  rota('GET', `${C}/turnos/atual`, () => {
    const aberto = plantaoAberto()
    const grade = gradeDe(agoraIso())
    const pendencias = pendenciasDoPlantao()
    const anterior = aberto?.turnoAnteriorId ? plantao(aberto.turnoAnteriorId) : null
    const passagem = anterior?.passagem && anterior.entregueEm ? anterior.passagem : null

    const recebida: PlantaoAtual['passagemRecebida'] =
      passagem && anterior?.entregueEm
        ? {
            turnoId: anterior.id,
            entregueEm: anterior.entregueEm,
            entreguePor: {
              profissionalId: passagem.entreguePorId,
              nome: nomeDe(passagem.entreguePorId),
            },
            nota: passagem.nota,
            pendencias: passagem.pendencias.map((pc) => {
              const d = dose(pc.administracaoId)
              return {
                administracaoId: pc.administracaoId,
                previstaPara: pc.previstaPara,
                descricao: pc.descricao,
                situacaoNaEntrega: pc.situacaoNaEntrega,
                atribuidaAId: pc.atribuidaAId,
                statusAgora: d?.status ?? 'PENDENTE',
                situacaoAgora: d ? situacaoDe(d) : 'nao-registrada',
              }
            }),
            truncado: false,
          }
        : null

    const internacoes = [...new Set(pendencias.map((d) => d.internacaoId))].flatMap((id) => {
      const i = internacao(id)
      return i ? [internacaoDoChecklist(i)] : []
    })
    const extras = [
      ...(aberto ? [aberto.responsavelId] : []),
      ...(passagem ? [passagem.entreguePorId] : []),
      ...(passagem?.pendencias.flatMap((pc) => (pc.atribuidaAId ? [pc.atribuidaAId] : [])) ?? []),
    ]
    return ok<PlantaoAtual>({
      agora: agoraIso(),
      atual: aberto ? plantaoDto(aberto) : null,
      sugerido: aberto
        ? null
        : { kind: grade.kind, inicio: grade.inicio, fimPrevisto: grade.fimPrevisto },
      pendencias: pendencias.map((d) => {
        const situacao = situacaoPendente(d)
        return {
          administracaoId: d.id,
          internacaoId: d.internacaoId,
          prescricaoId: d.prescricaoId,
          previstaPara: d.previstaPara,
          situacao,
          conferencia: d.conferencia,
          atribuidaAId: d.atribuidaAId,
          exigeDonoNaPassagem: situacao === 'na-janela',
        }
      }),
      pendenciasTruncado: false,
      passagemRecebida: recebida,
      prescricoes: prescricoesDas(pendencias),
      internacoes,
      profissionais: profissionaisDas(pendencias, extras),
    })
  })

  rota('POST', `${C}/turnos/assumir`, () => {
    const aberto = plantaoAberto()
    if (aberto)
      return erro(
        409,
        'PLANTAO_JA_ABERTO',
        'Já há um plantão aberto: a troca de mãos é pela passagem.',
        { turnoId: aberto.id },
      )
    let grade = gradeDe(agoraIso())
    if (ms(grade.fimPrevisto) - Date.now() < HORA) grade = proximaGrade(grade)
    const novo: PlantaoDaDemo = {
      id: novoId('plantao'),
      kind: grade.kind,
      data: grade.data,
      inicio: agoraIso(),
      fimPrevisto: grade.fimPrevisto,
      origem: 'ASSUMIDO',
      responsavelId: EU,
      entregueEm: null,
      turnoAnteriorId: PLANTOES[PLANTOES.length - 1]?.id ?? null,
      passagem: null,
    }
    PLANTOES.push(novo)
    return ok<Plantao>(plantaoDto(novo), 201)
  })

  rota('POST', `${C}/turnos/:id/entregar`, (pedido) => {
    const p = plantao(pedido.params.id ?? '')
    if (!p) return naoEncontrada()
    if (p.entregueEm) return erro(409, 'PLANTAO_ENCERRADO', 'Este plantão já foi entregue.')
    const corpo = corpoDe<Passagem>(pedido)
    if (!corpo.recebidoPorId || !existeProfissional(corpo.recebidoPorId)) return naoEncontrada()
    if (corpo.recebidoPorId === p.responsavelId)
      return erro(409, 'PASSAGEM_PARA_SI_MESMO', 'Quem recebe o plantão precisa ser outra pessoa.')
    const nota = corpo.nota?.trim() ?? ''
    if (!nota || nota.length > 1000)
      return erro(400, 'PASSAGEM_INVALIDA', 'Escreva a nota de passagem (até 1000 caracteres).', {
        campo: 'nota',
      })
    if (p.responsavelId !== EU && !jaPassou(p.fimPrevisto))
      return erro(403, 'PASSAGEM_NEGADA', 'Só o responsável entrega o plantão.', {
        reason: 'NAO_E_O_RESPONSAVEL',
        vencido: false,
      })

    const atribuicoes = new Map(
      (corpo.atribuicoes ?? []).map((a) => [a.administracaoId, a.profissionalId]),
    )
    const invalidas = [...atribuicoes.keys()].filter((id) => dose(id)?.status !== 'PENDENTE')
    if (invalidas.length)
      return erro(422, 'ATRIBUICAO_INVALIDA', 'Algumas doses não estão mais pendentes.', {
        reason: 'NAO_PENDENTE',
        administracaoIds: invalidas,
      })

    const pendencias = pendenciasDoPlantao()
    const semDono = pendencias.filter(
      (d) => situacaoDe(d) === 'na-janela' && !atribuicoes.get(d.id) && !d.atribuidaAId,
    )
    if (semDono.length)
      return erro(
        409,
        'DOSE_SEM_DONO_NA_PASSAGEM',
        'Escolha quem fica com cada dose em cima da troca.',
        {
          administracaoIds: semDono.slice(0, 50).map((d) => d.id),
          total: semDono.length,
        },
      )

    const agora = agoraIso()
    const congeladas = pendencias.map((d) => {
      const situacao = situacaoPendente(d)
      const dono =
        atribuicoes.get(d.id) ??
        d.atribuidaAId ??
        (situacao === 'atrasada' ? corpo.recebidoPorId! : null)
      d.atribuidaAId = dono
      return {
        administracaoId: d.id,
        previstaPara: d.previstaPara,
        descricao: descricaoDaDose(d),
        situacaoNaEntrega: situacao,
        atribuidaAId: dono,
      }
    })
    p.entregueEm = agora
    p.passagem = { nota, entreguePorId: EU, pendencias: congeladas }
    const grade = gradeDe(agora)
    const novo: PlantaoDaDemo = {
      id: novoId('plantao'),
      kind: grade.kind,
      data: grade.data,
      inicio: agora,
      fimPrevisto: grade.fimPrevisto,
      origem: 'RECEBIDO',
      responsavelId: corpo.recebidoPorId,
      entregueEm: null,
      turnoAnteriorId: p.id,
      passagem: null,
    }
    PLANTOES.push(novo)
    return ok<Entrega>({
      entregue: plantaoDto(p),
      novo: plantaoDto(novo),
      pendenciasCongeladas: congeladas.length,
      atribuicoes: atribuicoes.size,
    })
  })
}

/* ---------------------------------------------------------------------------- evolução */

function registrarEvolucoes() {
  rota('GET', `${C}/internacoes/:id/evolucoes`, (pedido) => {
    const i = daInternacao(pedido)
    if (eResposta(i)) return i
    const { itens, proximoCursor } = paginar(evolucoesDa(i.id).map(evolucaoDto), pedido.query, 50)
    return ok<ListaDeEvolucoesDto>({ itens, truncado: false, proximoCursor })
  })

  rota('GET', `${C}/internacoes/:id/evolucoes/:evolucaoId/versoes`, (pedido) => {
    const i = daInternacao(pedido)
    if (eResposta(i)) return i
    const e = EVOLUCOES.find((x) => x.id === pedido.params.evolucaoId && x.internacaoId === i.id)
    if (!e) return naoEncontrada()
    return ok<VersoesDaEvolucao>({
      evolucaoId: e.id,
      itens: e.versoes,
      truncado: false,
      proximoCursor: null,
    })
  })

  rota('POST', `${C}/internacoes/:id/evolucoes`, (pedido) => {
    const i = daInternacao(pedido)
    if (eResposta(i)) return i
    if (!emCurso(i)) return encerrada()
    const corpo = corpoDe<NovaEvolucao>(pedido)
    if (!corpo.gravidade || !corpo.gravidadeVista)
      return erro(400, 'EVOLUCAO_INVALIDA', 'Escolha a gravidade.')
    if (corpo.gravidadeVista !== i.gravidade)
      return erro(409, 'INTERNACAO_ALTERADA', 'A internação mudou enquanto você trabalhava nela.', {
        reason: 'GRAVIDADE',
        gravidade: i.gravidade,
      })
    const textos = [corpo.observado, corpo.avaliacao, corpo.plano]
    if (textos.some((t) => (t?.length ?? 0) > 1000))
      return erro(400, 'EVOLUCAO_INVALIDA', 'Cada campo da evolução vai até 1000 caracteres.')

    const p = plantaoParaRegistrar()
    let evolucao = corpo.evolucaoId
      ? EVOLUCOES.find((e) => e.id === corpo.evolucaoId && e.internacaoId === i.id)
      : undefined
    let reescrita = false

    if (corpo.evolucaoId) {
      if (!evolucao) return naoEncontrada()
      const dela = plantao(evolucao.plantaoId)
      if (dela?.entregueEm)
        return erro(
          409,
          'EVOLUCAO_CONGELADA',
          'O plantão desta evolução já foi entregue: ela não muda mais.',
          { reason: 'PLANTAO_ENTREGUE' },
        )
      if (corpo.atualizadoEmVisto !== evolucao.atualizadoEm)
        return erro(
          409,
          'EVOLUCAO_ALTERADA',
          'Outra pessoa salvou esta evolução depois de você abrir.',
          {
            evolucaoId: evolucao.id,
            atualizadoEm: evolucao.atualizadoEm,
          },
        )
      if (evolucao.profissionalId !== EU && dela?.responsavelId !== EU)
        return erro(
          409,
          'EVOLUCAO_CONGELADA',
          'Só o autor ou o responsável do plantão reescrevem.',
          { reason: 'OUTRO_AUTOR' },
        )
      const agora = agoraIso()
      evolucao.versoes.unshift({
        id: novoId('versao'),
        profissional: {
          profissionalId: evolucao.profissionalId,
          nome: nomeDe(evolucao.profissionalId),
        },
        escritaEm: evolucao.atualizadoEm.slice(0, 19) + evolucao.atualizadoEm.slice(23),
        substituidaPor: { profissionalId: EU, nome: nomeDe(EU) },
        substituidaEm: agora,
        vitais: evolucao.vitais,
        observado: evolucao.observado,
        avaliacao: evolucao.avaliacao,
        plano: evolucao.plano,
        gravidade: evolucao.gravidade,
      })
      reescrita = true
    } else {
      const existente = EVOLUCOES.find((e) => e.internacaoId === i.id && e.plantaoId === p.id)
      if (existente)
        return erro(
          409,
          'EVOLUCAO_ALTERADA',
          'Este plantão já tem evolução: reescreva a que está na lista.',
          {
            evolucaoId: existente.id,
            atualizadoEm: existente.atualizadoEm,
          },
        )
      evolucao = {
        id: novoId('evolucao'),
        internacaoId: i.id,
        plantaoId: p.id,
        profissionalId: EU,
        registradoEm: agoraIso(),
        atualizadoEm: '',
        vitais: {},
        observado: null,
        avaliacao: null,
        plano: null,
        gravidade: corpo.gravidade,
        versoes: [],
      }
      EVOLUCOES.push(evolucao)
    }

    evolucao.profissionalId = EU
    evolucao.atualizadoEm = atualizadoAgora()
    evolucao.vitais = corpo.vitais ?? {}
    evolucao.observado = corpo.observado?.trim() || null
    evolucao.avaliacao = corpo.avaliacao?.trim() || null
    evolucao.plano = corpo.plano?.trim() || null
    evolucao.gravidade = corpo.gravidade
    const gravidadeMudou = aplicarGravidade(i, corpo.gravidade)
    return ok<EvolucaoSalva>({ ...evolucaoDto(evolucao), gravidadeMudou, reescrita })
  })
}

/* ---------------------------------------------------------------------------- boletim */

const IDIOMAS = ['pt-BR', 'en-US', 'en-GB', 'es-419', 'sr-Latn', 'ar'] as const
const FREQUENCIAS = [1, 2, 4, 6, 8, 12, 24] as const

function validarLigacao(i: InternacaoDaDemo, em: string, desde: string | null) {
  if (ms(em) > Date.now() + 5 * MINUTO)
    return erro(400, 'LIGACAO_INVALIDA', 'A hora da ligação não pode ser no futuro.', {
      reason: 'NO_FUTURO',
    })
  if (ms(em) < ms(i.entradaEm))
    return erro(400, 'LIGACAO_INVALIDA', 'A ligação não pode ser antes da entrada.', {
      reason: 'ANTES_DA_ENTRADA',
    })
  if (desde && ms(em) < ms(desde))
    return erro(400, 'LIGACAO_INVALIDA', 'A ligação precisa ser depois da piora.', {
      reason: 'ANTES_DA_PIORA',
      desde,
    })
  return null
}

function boletimDoPedido(pedido: Pedido) {
  const b = boletim(pedido.params.id ?? '')
  const i = b ? internacao(b.internacaoId) : null
  return b && i ? { b, i } : null
}

function boletimFechado(status: string) {
  if (status === 'ENVIADO') return erro(409, 'BOLETIM_JA_ENVIADO', 'Este boletim já foi enviado.')
  if (status === 'CANCELADO') return erro(409, 'BOLETIM_CANCELADO', 'Este boletim foi cancelado.')
  return null
}

function registrarBoletins() {
  rota('GET', `${C}/internacao/boletins-pendentes`, () =>
    ok<BoletinsPendentes>({ fuso: FUSO, itens: boletinsPendentes(), truncado: false }),
  )

  rota('GET', `${C}/internacoes/:id/boletins`, (pedido) => {
    const i = daInternacao(pedido)
    if (eResposta(i)) return i
    const { itens, proximoCursor } = paginar(boletinsDa(i.id).map(boletimDto), pedido.query, 30)
    return ok<ConversaDoBoletim>({
      internacaoId: i.id,
      fuso: FUSO,
      semCanalNoApp: semCanalNoApp(i),
      itens,
      proximoCursor,
    })
  })

  rota('GET', `${C}/internacoes/:id/boletins/modelos`, (pedido) => {
    const i = daInternacao(pedido)
    if (eResposta(i)) return i
    const pet = pacienteDa(i).nome
    const periodo = periodoDoBoletim(i)
    return ok<ModelosDoBoletim>({
      internacaoId: i.id,
      idioma: 'pt-BR',
      sugestoes: [
        {
          chave: 'ESTAVEL',
          texto: `${pet} segue estável, comendo e recebendo as medicações nos horários. A equipe continua acompanhando de perto e manda novas notícias no próximo boletim.`,
        },
        {
          chave: 'EM_OBSERVACAO',
          texto: `${pet} está em observação mais de perto hoje. A equipe ajustou os cuidados e acompanha cada sinal. Se algo mudar, a clínica liga para você.`,
        },
        {
          chave: 'APOS_LIGACAO',
          texto: `Como conversamos por telefone, ${pet} segue em acompanhamento. A equipe manda notícias ao longo do dia.`,
        },
      ],
      observadoDaUltimaEvolucao: observadoDaUltimaEvolucao(i.id),
      dosesDadasNoPeriodo: periodo.doses,
      periodoDesde: periodo.desde,
      exigeLigacao: pendenciaDoBoletim(i) === 'LIGAR',
    })
  })

  rota('POST', `${C}/internacoes/:id/boletins`, (pedido) => {
    const i = daInternacao(pedido)
    if (eResposta(i)) return i
    if (!emCurso(i)) return encerrada()
    const corpo = corpoDe<{ texto: string; idioma: (typeof IDIOMAS)[number] }>(pedido)
    const texto = corpo.texto?.trim() ?? ''
    if (!texto || texto.length > 2000)
      return erro(400, 'BOLETIM_INVALIDO', 'O texto do boletim vai de 1 a 2000 caracteres.')
    const aberto = boletimAbertoDe(i.id)
    if (aberto)
      return erro(409, 'BOLETIM_JA_ABERTO', 'Já há um boletim aberto nesta internação.', {
        boletimId: aberto.id,
      })
    const retido = pendenciaDoBoletim(i) === 'LIGAR'
    const desde = ligacaoDevidaDesde(i)
    const b = novoBoletim(i, {
      status: retido ? 'RETIDO' : 'RASCUNHO',
      texto,
      idioma: corpo.idioma && IDIOMAS.includes(corpo.idioma) ? corpo.idioma : 'pt-BR',
      geradoEm: agoraIso(),
      gravidade: i.gravidade,
      autorUsuarioId: USUARIO_ID,
      exigeLigacao: retido,
      motivoDaRetencao: retido
        ? desde === i.entradaEm && i.gravidadeNaEntrada === 'CRITICO'
          ? 'ENTROU_CRITICO'
          : 'PIORA'
        : null,
      retidoDesde: retido ? desde : null,
    })
    return ok(boletimDto(b), 201)
  })

  rota('POST', `${C}/boletins/:id/descartar`, (pedido) => {
    const achado = boletimDoPedido(pedido)
    if (!achado) return naoEncontrada()
    const { b } = achado
    const fechado = boletimFechado(b.status)
    if (fechado) return fechado
    if (b.autorUsuarioId === null)
      return erro(
        409,
        'BOLETIM_RETIDO_DO_SISTEMA',
        'O boletim criado pelo sistema na piora não se descarta: ligue e envie.',
        { boletimId: b.id },
      )
    b.status = 'CANCELADO'
    b.canceladoEm = agoraIso()
    b.motivoCancelamento = 'DESCARTADO'
    b.atualizadoEm = b.canceladoEm
    return ok(boletimDto(b))
  })

  rota('POST', `${C}/boletins/:id/ligacao`, (pedido) => {
    const achado = boletimDoPedido(pedido)
    if (!achado) return naoEncontrada()
    const { b, i } = achado
    if (!emCurso(i)) return encerrada()
    const fechado = boletimFechado(b.status)
    if (fechado) return fechado
    const corpo = corpoDe<{ porProfissionalId: string; em: string }>(pedido)
    if (!corpo.porProfissionalId || !existeProfissional(corpo.porProfissionalId))
      return naoEncontrada()
    const em = corpo.em ?? agoraIso()
    const invalida = validarLigacao(i, em, b.status === 'RETIDO' ? b.retidoDesde : null)
    if (invalida) return invalida
    registrarLigacao(i, em, corpo.porProfissionalId, b)
    return ok(boletimDto(b))
  })

  rota('POST', `${C}/internacoes/:id/ligacao`, (pedido) => {
    const i = daInternacao(pedido)
    if (eResposta(i)) return i
    if (!emCurso(i)) return encerrada()
    const corpo = corpoDe<{ porProfissionalId: string; em: string }>(pedido)
    if (!corpo.porProfissionalId || !existeProfissional(corpo.porProfissionalId))
      return naoEncontrada()
    if (pendenciaDoBoletim(i) !== 'LIGAR')
      return ok<LigacaoDaInternacao>({
        internacaoId: i.id,
        registrada: false,
        em: null,
        boletimLiberadoId: null,
        pendencia: itemDaFila(i),
      })
    const em = corpo.em ?? agoraIso()
    const invalida = validarLigacao(i, em, ligacaoDevidaDesde(i))
    if (invalida) return invalida
    const liberado = registrarLigacao(i, em, corpo.porProfissionalId)
    return ok<LigacaoDaInternacao>({
      internacaoId: i.id,
      registrada: true,
      em,
      boletimLiberadoId: liberado?.id ?? null,
      pendencia: itemDaFila(i),
    })
  })

  rota('POST', `${C}/boletins/:id/enviar`, (pedido) => {
    const achado = boletimDoPedido(pedido)
    if (!achado) return naoEncontrada()
    const { b, i } = achado
    const fechado = boletimFechado(b.status)
    if (fechado) return fechado
    if (!emCurso(i)) return encerrada()
    if (b.status === 'RETIDO')
      return erro(
        409,
        'BOLETIM_EXIGE_LIGACAO',
        'Ligue para o responsável antes de enviar este boletim.',
        {
          motivo: b.motivoDaRetencao,
          desde: b.retidoDesde,
        },
      )
    const agora = agoraIso()
    if (semCanalNoApp(i)) {
      b.entrega = {
        situacao: 'NAO_ENVIADO',
        canal: 'NENHUM',
        motivo: 'SEM_CANAL_NO_APP',
        destinatarios: 0,
        soInbox: false,
        em: agora,
      }
      return ok<EnvioDoBoletim>({
        id: b.id,
        entregue: false,
        motivo: 'SEM_CANAL_NO_APP',
        boletim: boletimDto(b),
      })
    }
    marcarEnviado(b, i, agora)
    return ok<EnvioDoBoletim>({ id: b.id, entregue: true, motivo: null, boletim: boletimDto(b) })
  })

  rota('POST', `${C}/boletins/:id/foto`, (pedido) => {
    const achado = boletimDoPedido(pedido)
    if (!achado) return naoEncontrada()
    const { b, i } = achado
    if (!emCurso(i) || b.tipo === 'ALTA') return encerrada()
    const fechado = boletimFechado(b.status)
    if (fechado) return fechado
    const form = pedido.corpo instanceof FormData ? pedido.corpo : null
    const arquivo = form?.get('file')
    if (!(arquivo instanceof Blob))
      return erro(400, 'BOLETIM_FOTO_INVALIDA', 'Não conseguimos ler esta imagem.', {
        reason: 'ILEGIVEL',
      })
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type))
      return erro(400, 'BOLETIM_FOTO_INVALIDA', 'Envie a foto em JPEG, PNG ou WEBP.', {
        reason: 'TIPO',
      })
    if (arquivo.size > 12 * 1024 * 1024)
      return erro(400, 'BOLETIM_FOTO_INVALIDA', 'A foto pode ter até 12 MB.', { reason: 'TAMANHO' })
    const legenda = String(form?.get('legenda') ?? '').trim()
    if (legenda.length > 200)
      return erro(400, 'BOLETIM_FOTO_INVALIDA', 'A legenda vai até 200 caracteres.', {
        reason: 'LEGENDA',
      })
    if (b.fotoUrl?.startsWith('blob:')) URL.revokeObjectURL(b.fotoUrl)
    b.fotoUrl = URL.createObjectURL(arquivo)
    b.temFoto = true
    b.fotoLegenda = legenda || null
    b.atualizadoEm = agoraIso()
    return ok(boletimDto(b))
  })

  rota('DELETE', `${C}/boletins/:id/foto`, (pedido) => {
    const achado = boletimDoPedido(pedido)
    if (!achado) return naoEncontrada()
    const { b } = achado
    const fechado = boletimFechado(b.status)
    if (fechado) return fechado
    if (b.fotoUrl?.startsWith('blob:')) URL.revokeObjectURL(b.fotoUrl)
    b.fotoUrl = null
    b.temFoto = false
    b.fotoLegenda = null
    b.atualizadoEm = agoraIso()
    return vazio()
  })

  rota('GET', `${C}/boletins/:id/foto`, (pedido) => {
    const achado = boletimDoPedido(pedido)
    if (!achado) return naoEncontrada()
    const { b } = achado
    const url = b.temFoto ? b.fotoUrl : null
    return ok<FotoDoBoletimDto>({ url, expiraEm: url ? somarMinutos(agoraIso(), 10) : null })
  })

  rota('GET', `${C}/internacoes/:id/preferencias`, (pedido) => {
    const i = daInternacao(pedido)
    return eResposta(i) ? i : ok<PreferenciaDoBoletim>(preferenciaDto(i))
  })

  rota('PUT', `${C}/internacoes/:id/preferencias`, (pedido) => {
    const i = daInternacao(pedido)
    if (eResposta(i)) return i
    if (!emCurso(i)) return encerrada()
    const corpo = corpoDe<NovaPreferenciaDoBoletim>(pedido)
    const frequencia = FREQUENCIAS.find((f) => f === corpo.frequenciaHoras)
    if (!frequencia)
      return erro(400, 'PREFERENCIA_INVALIDA', 'Escolha uma das frequências permitidas.', {
        permitidas: FREQUENCIAS,
      })
    i.preferencia = {
      frequenciaHoras: frequencia,
      fotoSempre: corpo.fotoSempre ?? i.preferencia.fotoSempre,
      silencioNoturno: corpo.silencioNoturno ?? i.preferencia.silencioNoturno,
      definidaPor: 'CLINICA',
      definidaEm: agoraIso(),
    }
    return ok<PreferenciaDoBoletim>(preferenciaDto(i))
  })
}

/* -------------------------------------------------------------------------- o registro */

export function registrarInternacao() {
  registrarLeitos()
  registrarMapa()
  registrarCasos()
  registrarPrescricoes()
  registrarChecklists()
  registrarDoses()
  registrarPlantao()
  registrarEvolucoes()
  registrarBoletins()
}
